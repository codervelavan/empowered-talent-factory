// The guide character, built from three.js primitives in the site's colours (no model files).
// Units: the figure stands on y = 0 and is 1 unit tall, facing +z. The stage scales it to pixels.
import * as THREE from 'three';

const C = {
  outfit: 0x1e4632,
  dark: 0x0f2b22,
  skin: 0xf7f1e3,
  gold: 0xc9a33a,
  line: 0x0f2b22,
};

/** Joints the animator drives. Rotations are in radians, applied on top of the rest pose. */
export interface Rig {
  root: THREE.Group;
  /** Moves up/down for breathing and walking bob. */
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  /** Index 0 is the arm on the figure's +x side (screen right when facing the camera). */
  shoulders: [THREE.Group, THREE.Group];
  elbows: [THREE.Group, THREE.Group];
  hips: [THREE.Group, THREE.Group];
  knees: [THREE.Group, THREE.Group];
  eyes: THREE.Mesh[];
  mouth: THREE.Mesh;
  /** Outline thickness in figure units; the stage sets it so lines stay ~2px at any size. */
  outline: { value: number };
  dispose(): void;
}

/** Inverted-hull outline: the back faces, pushed out along their normals and filled with ink. */
function outlineMaterial(thickness: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { thickness, color: { value: new THREE.Color(C.line) } },
    vertexShader: `uniform float thickness;
      void main() {
        vec3 p = position + normal * thickness / length(modelMatrix[0].xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
  });
}

export function buildFigure(): Rig {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const outline = { value: 0.012 };
  const lineMat = outlineMaterial(outline);
  mats.push(lineMat);
  const mat = (color: number) => {
    const m = new THREE.MeshLambertMaterial({ color });
    mats.push(m);
    return m;
  };
  const outfit = mat(C.outfit), dark = mat(C.dark), skin = mat(C.skin), gold = mat(C.gold);
  const flatDark = new THREE.MeshBasicMaterial({ color: C.dark });
  mats.push(flatDark);

  /** A filled part with an ink outline. */
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, withLine = true) => {
    geos.push(geo);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, m));
    if (withLine) g.add(new THREE.Mesh(geo, lineMat));
    return g;
  };
  const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const joint = (parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  };

  const root = new THREE.Group();
  const body = joint(root, 0, 0);

  // Legs: hip at y .5, knee at .27, feet on the ground.
  const hips: [THREE.Group, THREE.Group] = [joint(body, 0.058, 0.5), joint(body, -0.058, 0.5)];
  const knees = hips.map((hip) => {
    const thigh = part(capsule(0.047, 0.17), dark);
    thigh.position.y = -0.115;
    hip.add(thigh);
    const knee = joint(hip, 0, -0.23);
    const shin = part(capsule(0.043, 0.17), dark);
    shin.position.y = -0.11;
    knee.add(shin);
    const foot = part(capsule(0.036, 0.06), dark);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, -0.245, 0.03);
    knee.add(foot);
    return knee;
  }) as [THREE.Group, THREE.Group];

  // Torso: hips to shoulders, with a gold lanyard and ID card.
  const torso = joint(body, 0, 0.5);
  const chest = part(capsule(0.112, 0.2), outfit);
  chest.position.y = 0.17;
  chest.scale.set(1, 1, 0.78);
  torso.add(chest);
  const lanyard = part(new THREE.TorusGeometry(0.06, 0.009, 6, 24, Math.PI), gold, false);
  lanyard.rotation.set(Math.PI * 0.62, 0, Math.PI);
  lanyard.position.set(0, 0.315, 0.05);
  torso.add(lanyard);
  const card = part(new THREE.BoxGeometry(0.06, 0.075, 0.012), gold);
  card.position.set(0, 0.215, 0.098);
  torso.add(card);

  // Head: neck, face, short hair cap, eyes and mouth.
  const head = joint(torso, 0, 0.35);
  const neck = part(new THREE.CylinderGeometry(0.03, 0.034, 0.06, 12), skin, false);
  neck.position.y = 0.01;
  head.add(neck);
  const face = part(new THREE.SphereGeometry(0.092, 24, 18), skin);
  face.position.y = 0.105;
  head.add(face);
  const hair = part(new THREE.SphereGeometry(0.097, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), dark);
  hair.position.y = 0.112;
  hair.rotation.x = -0.32;
  head.add(hair);
  const eyeGeo = new THREE.SphereGeometry(0.0115, 10, 8);
  geos.push(eyeGeo);
  const eyes = [-0.033, 0.033].map((x) => {
    const e = new THREE.Mesh(eyeGeo, flatDark);
    e.position.set(x, 0.113, 0.085);
    head.add(e);
    return e;
  });
  const mouthGeo = new THREE.CircleGeometry(0.022, 16);
  geos.push(mouthGeo);
  const mouth = new THREE.Mesh(mouthGeo, flatDark);
  mouth.position.set(0, 0.066, 0.092);
  mouth.scale.set(1, 0.28, 1);
  head.add(mouth);

  // Arms: shoulder, upper arm, elbow, forearm, hand. Rest pose hangs straight down.
  const shoulders: [THREE.Group, THREE.Group] = [joint(torso, 0.138, 0.285), joint(torso, -0.138, 0.285)];
  const elbows = shoulders.map((sh) => {
    const upper = part(capsule(0.036, 0.13), outfit);
    upper.position.y = -0.085;
    sh.add(upper);
    const elbow = joint(sh, 0, -0.17);
    const fore = part(capsule(0.032, 0.12), outfit);
    fore.position.y = -0.075;
    elbow.add(fore);
    const hand = part(new THREE.SphereGeometry(0.037, 14, 10), skin);
    hand.position.y = -0.165;
    elbow.add(hand);
    return elbow;
  }) as [THREE.Group, THREE.Group];

  // Soft ground shadow.
  const shadowGeo = new THREE.CircleGeometry(0.16, 24);
  geos.push(shadowGeo);
  const shadowMat = new THREE.MeshBasicMaterial({ color: C.dark, transparent: true, opacity: 0.14, depthWrite: false });
  mats.push(shadowMat);
  // The stage camera looks straight on, so the shadow is a flattened ellipse facing it, behind the feet.
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.scale.set(1, 0.2, 1);
  shadow.position.set(0, 0.005, -0.12);
  root.add(shadow);

  return {
    root, body, torso, head, shoulders, elbows, hips, knees, eyes, mouth, outline,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
