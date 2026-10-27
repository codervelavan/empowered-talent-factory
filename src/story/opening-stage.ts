import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export type Size = 'desk' | 'phone' | 'land';
const PAPER = 0xf2efe2, INK = 0x1e4632, GOLD = 0xc9a33a;
const asset = (name: string) => `${import.meta.env.BASE_URL}opening/${name}`;
function disposeObject(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh; mesh.geometry?.dispose();
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m));
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).skeleton.dispose();
  });
  materials.forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); }); m.dispose(); });
  textures.forEach(t => t.dispose());
}
/** An isolated stage, driven by the controller and rendered on the existing factory canvas. */
export class OpeningStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 80);
  private dead = false;
  private panels: THREE.Group[] = [];
  private sheets: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private loaded = new Set<number>();
  private hand = new THREE.Group();
  private handModel = new THREE.Group();
  private joints: { bone: THREE.Bone; rest: THREE.Quaternion; index: boolean }[] = [];
  private target = new THREE.Vector2();
  private mouse = new THREE.Vector2();
  private connected = 0;
  private request: THREE.Group;
  private halo: THREE.Mesh;
  private loading = 0;
  private paper = new THREE.Color(PAPER);
  private axis = new THREE.Vector3(1, 0, 0);
  private curlQ = new THREE.Quaternion();
  constructor() {
    this.scene.background = this.paper;
    this.scene.add(new THREE.HemisphereLight(0xfff9e9, 0x466551, 2.5));
    const key = new THREE.DirectionalLight(0xffedc9, 3); key.position.set(-4, 7, 8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9d8b3, 1.6); rim.position.set(5, 2, -3); this.scene.add(rim);
    this.camera.position.z = 13;
    const plane = new THREE.PlaneGeometry(7.7, 5.13);
    for (let i = 0; i < 7; i++) {
      const panel = new THREE.Group();
      const backing = new THREE.Mesh(plane.clone(), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true }));
      panel.add(backing); this.sheets.push(backing);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(plane), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .35 }));
      line.position.z = .015; panel.add(line);
      const shadow = new THREE.Mesh(plane.clone(), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .08 }));
      shadow.position.set(.14, -.17, -.12); panel.add(shadow);
      panel.visible = false; this.panels.push(panel); this.scene.add(panel);
    }
    plane.dispose(); this.request = this.document(); this.scene.add(this.request);
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(.77, .012, 6, 64), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: .5 }));
    this.halo.position.z = .7; this.scene.add(this.halo); this.hand.add(this.handModel); this.scene.add(this.hand);
    this.loadPanel(0); this.loadHand();
  }
  pointer(x: number, y: number) { this.target.set(x, y); }
  private document() {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(.92, 1.23, .035), new THREE.MeshStandardMaterial({ color: 0xfffbec, roughness: .9 }));
    g.add(paper, new THREE.LineSegments(new THREE.EdgesGeometry(paper.geometry), new THREE.LineBasicMaterial({ color: INK })));
    const ink = new THREE.MeshBasicMaterial({ color: INK });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(i === 0 ? .37 : .58, i === 0 ? .065 : .018), ink);
      line.position.set(i === 0 ? -.1 : 0, .4 - i * .13, .021); g.add(line);
    }
    const sketch = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.34, .25, .11)), new THREE.LineBasicMaterial({ color: GOLD }));
    sketch.position.set(0, -.31, .07); sketch.rotation.set(.25, .35, .15); g.add(sketch); return g;
  }
  private loadPanel(index: number) {
    if (index < 0 || index >= this.sheets.length || this.loaded.has(index) || this.dead) return;
    this.loaded.add(index); this.loading++;
    new THREE.TextureLoader().load(asset(`scene-${index + 1}.webp`), texture => {
      this.loading--; if (this.dead) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
      this.sheets[index].material.map = texture; this.sheets[index].material.needsUpdate = true;
      if (!this.loading) this.loadPanel(index + 1);
    }, undefined, () => { this.loading--; if (!this.dead && !this.loading) this.loadPanel(index + 1); });
  }
  private loadHand() {
    new GLTFLoader().load(asset('hand.glb'), gltf => {
      if (this.dead) { disposeObject(gltf.scene); return; }
      const root = gltf.scene; root.updateMatrixWorld(true);
      // WebXR joints are siblings. Reparent at the bind pose, preserving world transforms,
      // so each authored curl propagates down its finger while skin inverse binds stay intact.
      const wrist = root.getObjectByName('wrist');
      for (const finger of ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) {
        let parent = wrist;
        for (const part of ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip']) {
          const bone = root.getObjectByName(`${finger}-${part}`) as THREE.Bone | undefined;
          if (!bone) continue;
          parent?.attach(bone); parent = bone;
          if (part.startsWith('phalanx') && finger !== 'thumb') this.joints.push({ bone, rest: bone.quaternion.clone(), index: finger === 'index-finger' });
        }
      }
      const old = new Set<THREE.Material>();
      const porcelain = new THREE.MeshStandardMaterial({ color: 0xdccfae, roughness: .58, metalness: .08 });
      root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) {
        (Array.isArray(m.material) ? m.material : [m.material]).forEach(v => old.add(v)); m.material = porcelain; m.frustumCulled = false;
      } });
      old.forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture) v.dispose(); }); m.dispose(); });
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root), dimensions = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
      const normal = new THREE.Group(); normal.add(root); root.position.sub(centre);
      normal.scale.setScalar(3.2 / Math.max(dimensions.x, dimensions.y, dimensions.z)); normal.rotation.z = Math.PI;
      this.handModel.add(normal);
    }, undefined, () => { /* Artwork, story and controls remain usable without the hand. */ });
  }
  frame(progress: number, connected: boolean, reduced: boolean, size: Size, now: number, dt: number) {
    const phone = size === 'phone', landscape = size === 'land';
    this.scene.background = progress > 6.5 ? null : this.paper;
    this.camera.aspect = innerWidth / Math.max(1, innerHeight); this.camera.position.z = phone ? 16.8 : landscape ? 12.2 : 13; this.camera.updateProjectionMatrix();
    if (reduced) this.mouse.set(0, 0); else this.mouse.lerp(this.target, 1 - Math.exp(-dt * 4));
    this.connected += ((connected ? 1 : 0) - this.connected) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
    const baseX = phone ? 0 : landscape ? 3.05 : 2.75, baseY = phone ? 2.25 : .35;
    this.loadPanel(Math.min(6, Math.round(progress)));
    for (let i = 0; i < this.panels.length; i++) {
      const distance = i - progress, panel = this.panels[i]; panel.visible = Math.abs(distance) < 1.45;
      if (!panel.visible) continue;
      const opacity = Math.max(0, 1 - Math.abs(distance));
      panel.rotation.set(reduced ? 0 : this.mouse.y * -.012, reduced ? 0 : distance * -.14 + this.mouse.x * .018, reduced ? 0 : (i % 2 ? -.018 : .025));
      panel.scale.setScalar((phone ? .70 : landscape ? .83 : 1) * (1 - Math.min(.1, Math.abs(distance) * .08)));
      panel.position.set(baseX + (reduced ? 0 : distance * 3.1) + this.mouse.x * .1, baseY + (reduced ? 0 : Math.sin(now * .0007 + i) * .045) + Math.abs(distance) * .2, -Math.abs(distance) * 1.3);
      panel.traverse(o => { const material = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (material && 'opacity' in material) material.opacity = opacity * (o === panel.children[2] ? .07 : o === panel.children[1] ? .3 : 1);
      });
      if (progress > 6) { panel.position.x += (progress - 6) * 3; panel.rotation.y += (progress - 6) * -.35; }
    }
    const time = reduced ? 0 : now * .001;
    const hesitation = progress > 1.5 && progress < 3 ? Math.sin(time * 1.8) * .16 : 0;
    this.hand.position.set(baseX - (phone ? .85 : 2.3) + this.mouse.x * .17 + hesitation + this.connected * .4,
      phone ? .95 : -2.25 + Math.sin(time * .9) * .07 + this.connected * .27, 2);
    this.hand.scale.setScalar(phone ? .85 : landscape ? .75 : .95);
    this.hand.rotation.set(-.25 + this.mouse.y * .07, -.35 + this.mouse.x * .09, -.5 + Math.sin(progress * .7) * .28);
    this.handModel.rotation.y = progress > 6 ? (progress - 6) * -.5 : this.connected * .2;
    const curl = progress < 1 ? .14 : progress < 3 ? .28 : progress < 5 ? .08 : .35 * (1 - this.connected);
    this.joints.forEach(({ bone, rest, index }) => bone.quaternion.copy(rest).multiply(this.curlQ.setFromAxisAngle(this.axis, curl * (index ? .35 : 1))));
    this.request.visible = progress < 6.5;
    this.request.position.set(baseX - (phone ? .8 : 2.45) + this.connected * 1.6, (phone ? 1.0 : -1.0) + this.connected * .75 + (reduced ? 0 : Math.sin(time * .8) * .08), 2.4 - this.connected);
    this.request.rotation.set(.04, -.14, -.17 + this.connected * .17); this.request.scale.setScalar(phone ? .52 : .75);
    this.halo.visible = progress >= 4.7 && progress < 6.3; this.halo.position.set(baseX + (phone ? .4 : .7), phone ? 1.9 : -.25, 1);
    (this.halo.material as THREE.MeshBasicMaterial).opacity = connected ? .65 : .25 + Math.sin(time * 2) * .1;
  }
  dispose() { this.dead = true; disposeObject(this.scene); this.scene.clear(); this.joints = []; }
}
