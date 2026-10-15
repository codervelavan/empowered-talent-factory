// EmpowerED Careers company branding for the 3D building (art board: ink-on-cream line art,
// neon-green holographic accents, blocky people, a city around the HQ). Everything is built
// with the scene's own helpers (passed in as a kit) so it reveals, fogs and fades like the rest.
import * as THREE from 'three';
import logoUrl from '../assets/empowered-careers-logo.png';
import type { P3 } from '../bridge';
import type { Pose } from '../data/content';

export type Tone = 'ink' | 'fine' | 'faint' | 'gold';
/** The parts of a scene area that branding needs (see Area in scene.ts). */
export interface BrandArea { name: string; r: number; mats: THREE.Material[] }
type BoxOpts = { solid?: 'none' | 'green' | 'gold'; tone?: Tone | null; rx?: number; ry?: number; rz?: number };
type PlaneOpts = { rx?: number; ry?: number; mat?: THREE.Material; fill?: boolean; tone?: Tone };
type Tex = THREE.CanvasTexture & { redraw(): void };

export interface BrandKit {
  area(name: string, o: { at?: number; c?: THREE.Vector3; full?: number; start?: number; fixed?: number; parent?: THREE.Object3D }): BrandArea;
  box(a: BrandArea, x: number, y: number, z: number, w: number, h: number, d: number, o?: BoxOpts): void;
  line(a: BrandArea, t: Tone, p: P3, q: P3): void;
  plane(a: BrandArea, x: number, y: number, z: number, w: number, h: number, o?: PlaneOpts): THREE.Matrix4;
  amat(a: BrandArea, color: THREE.ColorRepresentation, base?: number, map?: THREE.Texture | null): THREE.MeshBasicMaterial;
  ctex(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void): Tex;
  figure(a: BrandArea, pose: Pose, x: number, y: number, z: number, ry?: number, flip?: number, h?: number): void;
  /** Build into a group (the scene's current target group) for the duration of fn. */
  into(g: THREE.Object3D, fn: () => void): void;
  root: THREE.Group;
  cam(): THREE.Camera;
}

export interface Brand {
  /** City around the HQ: always shown, fades out as the globe takes over. */
  skyline: BrandArea;
  /** World positions of the three floating entrance icons (Career, Workforce, AI for Everyone). */
  icons: P3[];
  tick(now: number, dt: number): void;
}

export const NEON = 0x35dc78;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---- Logo ------------------------------------------------------------------
const logo = new Image();
const logoWaiters: (() => void)[] = [];
logo.onload = () => logoWaiters.splice(0).forEach((f) => f());
logo.src = logoUrl;
/** Draw the logo (square) if it has loaded; the texture redraws once it does. */
export function drawLogo(x: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  if (logo.complete && logo.naturalWidth) x.drawImage(logo, cx - size / 2, cy - size / 2, size, size);
}
export function whenLogo(t: { redraw(): void }): void {
  if (logo.complete && logo.naturalWidth) return;
  logoWaiters.push(() => t.redraw());
}

const sp = (x: CanvasRenderingContext2D, v: string) => { if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v; };
/** Fit text to a width by shrinking the font. */
function fitText(x: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number) {
  x.font = `${weight} ${size}px Manrope, sans-serif`;
  const w = x.measureText(text).width;
  if (w > max) x.font = `${weight} ${Math.floor((size * max) / w)}px Manrope, sans-serif`;
}

export function buildBrand(k: BrandKit, mobile: boolean): Brand {
  const glowMats: THREE.Material[] = [];
  /** Neon-green material that fades with its area. Normal blending: additive washes out to white on cream. */
  const glow = (a: BrandArea, base = 0.85, map: THREE.Texture | null = null, color: number = NEON) => {
    const m = k.amat(a, color, base, map);
    m.depthWrite = false;
    glowMats.push(m);
    return m;
  };
  const haloTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(170,255,200,.55)');
    g.addColorStop(1, 'rgba(53,220,120,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halos: { s: THREE.Sprite; size: number; ph: number }[] = [];
  /** Soft glow sprite (skipped on phones). */
  const halo = (a: BrandArea, parent: THREE.Object3D, p: P3, size: number, base = 0.5) => {
    if (mobile) return;
    const m = new THREE.SpriteMaterial({ map: haloTex, color: NEON, transparent: true, depthWrite: false, opacity: 0 });
    m.userData.base = base;
    a.mats.push(m);
    const s = new THREE.Sprite(m);
    s.position.set(...p);
    s.scale.setScalar(size);
    parent.add(s);
    halos.push({ s, size, ph: Math.random() * 6 });
  };
  /** A flat sign: dark green with cream text (or light with ink), optional logo on the left. */
  const plate = (text: string, o: { w?: number; h?: number; light?: boolean; logo?: boolean; sub?: string } = {}) => {
    const W = o.w ?? 1024, H = o.h ?? 160;
    const t = k.ctex(W, H, (x, w, h) => {
      x.fillStyle = o.light ? '#F2EFE2' : '#1E4632';
      x.fillRect(0, 0, w, h);
      if (o.light) { x.strokeStyle = '#0F2B22'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); }
      let left = 0;
      if (o.logo) { drawLogo(x, h * 0.62, h / 2, h * 0.78); left = h * 1.1; }
      x.fillStyle = o.light ? '#0F2B22' : '#F2EFE2';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      sp(x, Math.round(h * 0.06) + 'px');
      const cx = left + (w - left) / 2, max = w - left - h * 0.4;
      if (o.sub) {
        fitText(x, text, 800, h * 0.42, max);
        x.fillText(text, cx, h * 0.4);
        x.fillStyle = o.light ? '#1E4632' : '#C9D6CE';
        fitText(x, o.sub, 700, h * 0.18, max);
        x.fillText(o.sub, cx, h * 0.76);
      } else {
        fitText(x, text, 800, h * 0.5, max);
        x.fillText(text, cx, h / 2 + 2);
      }
    });
    if (o.logo) whenLogo(t);
    return t;
  };
  /** Neon text/icon on transparent, for hologram planes. */
  const neonTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) =>
    k.ctex(w, h, (x, ww, hh) => {
      x.clearRect(0, 0, ww, hh);
      x.strokeStyle = '#1FC765';
      x.fillStyle = '#1FC765';
      x.shadowColor = '#35DC78';
      x.shadowBlur = 18;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      draw(x, ww, hh);
    });

  const ticks: ((now: number, dt: number) => void)[] = [];

  // ---- Exterior: crown, signage, plaza ----------------------------------------
  const bx = k.area('brandExt', { at: 0.35 });
  const glass = k.amat(bx, 0xbfd9c6, 0.16);
  glass.depthWrite = false;
  // Stepped glass crown on the roof: the company-HQ silhouette.
  ([[30, 22, 16, 6], [20, 15, 22, 5.5], [11, 9, 27.5, 4.5]] as [number, number, number, number][]).forEach(([w, d, y, h], i) => {
    const cz = -36;
    k.box(bx, 0, y, cz, w, h, d, { solid: 'none' });
    for (const [px, pz, pw, ry] of [[0, cz + d / 2, w, 0], [0, cz - d / 2, w, 0], [-w / 2, cz, d, Math.PI / 2], [w / 2, cz, d, Math.PI / 2]] as [number, number, number, number][])
      k.plane(bx, px, y + h / 2, pz, pw, h, { ry, mat: glass });
    for (let x = -w / 2 + 2.5; x < w / 2; x += 2.5) k.line(bx, 'fine', [x, y, cz + d / 2], [x, y + h, cz + d / 2]);
    for (let z = cz - d / 2 + 2.5; z < cz + d / 2; z += 2.5) { k.line(bx, 'fine', [w / 2, y, z], [w / 2, y + h, z]); k.line(bx, 'fine', [-w / 2, y, z], [-w / 2, y + h, z]); }
    for (let yy = y + 2; yy < y + h; yy += 2) { k.line(bx, 'faint', [-w / 2, yy, cz + d / 2], [w / 2, yy, cz + d / 2]); k.line(bx, 'faint', [w / 2, yy, cz - d / 2], [w / 2, yy, cz + d / 2]); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(bx, sx * w / 2, y, cz + sz * d / 2, 0.35, h, 0.35, { solid: 'green' });
    k.box(bx, 0, y + h - 0.25, cz + d / 2 + 0.05, w + 0.3, 0.25, 0.25, { solid: 'green' });
    if (i === 1) k.plane(bx, 0, y + h / 2 + 0.3, cz + d / 2 + 0.12, 15, 2.1, { mat: k.amat(bx, 0xffffff, 1, plate('EMPOWERED CAREERS', { logo: true })) });
  });
  // Neon crown band on the top tier.
  { const m = glow(bx, 0.9); const g = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.12, 9.4), m); g.position.set(0, 32.05, -36); k.root.add(g); }
  // Entrance canopy line: "Home of the AI Talent Factory".
  k.plane(bx, 0, 9.35, 4.08, 13.6, 0.95, { mat: k.amat(bx, 0xffffff, 1, plate('HOME OF THE AI TALENT FACTORY', { w: 1536, h: 110 })) });
  // Plaza: cube trees and planters, clear of the two entrance lanes.
  const tree = (x: number, z: number, s = 1) => {
    k.box(bx, x, 0, z, 0.3 * s, 1.5 * s, 0.3 * s, { solid: 'green' });
    k.box(bx, x, 1.3 * s, z, 2.4 * s, 2.5 * s, 2.4 * s, { solid: 'green' });
    k.box(bx, x, 0, z, 3 * s, 0.25, 3 * s, { tone: 'fine' });
  };
  for (const z of [12, 24, 36]) { tree(-11, z); tree(-22, z); }
  for (const [x, z] of [[32, 16], [38, 28], [31, 40], [-30, 8], [-34, 22]] as [number, number][]) tree(x, z, 0.9);
  for (const x of [-16, 16]) { k.box(bx, x, 0, 6.5, 6, 0.55, 1.4, { tone: 'ink' }); k.box(bx, x, 0.55, 6.5, 5.6, 0.05, 1.1, { solid: 'green' }); }

  // Floating hologram icons over the plaza (frame 1): Career, Workforce, AI for Everyone.
  const iconDefs: { p: P3; label: string; draw: (x: CanvasRenderingContext2D) => void }[] = [
    { p: [-15, 6.2, 18], label: 'CAREER', draw: (x) => { x.lineWidth = 9; x.strokeRect(78, 40, 100, 120); x.beginPath(); x.moveTo(98, 100); x.lineTo(122, 126); x.lineTo(162, 72); x.stroke(); x.fillRect(108, 28, 40, 16); } },
    { p: [-4.5, 7.4, 23], label: 'WORKFORCE', draw: (x) => { x.lineWidth = 7; for (const [bx2, by, s] of [[70, 100, 46], [128, 100, 46], [99, 54, 46]] as [number, number, number][]) { x.strokeRect(bx2, by, s, s); x.beginPath(); x.moveTo(bx2, by); x.lineTo(bx2 + 14, by - 12); x.lineTo(bx2 + s + 14, by - 12); x.lineTo(bx2 + s, by); x.stroke(); } } },
    { p: [6, 6.2, 18], label: 'AI FOR EVERYONE', draw: (x) => { x.lineWidth = 7; x.beginPath(); x.arc(128, 98, 62, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.ellipse(128, 98, 26, 62, 0, 0, Math.PI * 2); x.stroke(); for (const dy of [-30, 0, 30]) { const r = Math.sqrt(62 * 62 - dy * dy); x.beginPath(); x.moveTo(128 - r, 98 + dy); x.lineTo(128 + r, 98 + dy); x.stroke(); } } },
  ];
  const icons: { g: THREE.Group; base: P3; ph: number }[] = iconDefs.map((d, i) => {
    const g = new THREE.Group();
    g.position.set(...d.p);
    k.root.add(g);
    const t = neonTex(256, 300, (x, w) => {
      d.draw(x);
      x.shadowBlur = 10;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      fitText(x, d.label, 800, 34, w - 20);
      x.fillText(d.label, w / 2, 262);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4), glow(bx, 1, t));
    g.add(m);
    halo(bx, g, [0, 0.2, -0.1], 6.5, 0.35);
    // Glowing pad on the ground under each icon.
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), glow(bx, 0.35));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(d.p[0], 0.04, d.p[2]);
    k.root.add(pad);
    return { g, base: d.p, ph: i * 1.7 };
  });
  ticks.push((now) => {
    const cam = k.cam();
    icons.forEach((o) => {
      o.g.position.y = o.base[1] + Math.sin(now / 900 + o.ph) * 0.25;
      o.g.rotation.y = Math.atan2(cam.position.x - o.g.position.x, cam.position.z - o.g.position.z);
    });
  });

  // Workforce exterior signs on the east façade (frame 6).
  {
    const ws = k.area('wfsigns', { c: V(32, 8, -14), full: 34, start: 60 });
    ([['CAPABILITY BUILT', -6], ['INDUSTRY READY', -21]] as [string, number][]).forEach(([n, z]) => {
      k.plane(ws, 31.6, 12.2, z, 10, 1.9, { ry: Math.PI / 2 - 0.42, mat: k.amat(ws, 0xffffff, 1, plate(n, { light: true })) });
      k.line(ws, 'ink', [30, 13.4, z - 2], [31.2, 13.1, z]);
      k.line(ws, 'ink', [30, 11, z - 2], [31.2, 11.3, z]);
    });
  }

  // ---- Intake lobby (frame 2) ---------------------------------------------------
  {
    const lb = k.area('lobby', { c: V(0, 3, -14), full: 24, start: 34 });
    const wallT = k.ctex(1024, 512, (x, w, h) => {
      x.fillStyle = '#F7F5EC'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#0F2B22'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
      drawLogo(x, w / 2, h * 0.36, h * 0.42);
      x.fillStyle = '#0F2B22'; x.textAlign = 'center'; x.textBaseline = 'middle'; sp(x, '18px');
      fitText(x, 'INTAKE', 800, 120, w - 80); x.fillText('INTAKE', w / 2, h * 0.78);
    });
    whenLogo(wallT);
    k.box(lb, -19.5, 0, -21.4, 9.6, 6.2, 0.4, { tone: 'ink' });
    k.plane(lb, -19.5, 3.3, -21.15, 8.6, 4.3, { mat: k.amat(lb, 0xffffff, 1, wallT) });
    // Turnstiles across the entrance.
    for (const x of [-7.5, -5.5, 5.5, 7.5]) {
      k.box(lb, x, 0, -2.6, 0.32, 1.05, 1.3, { tone: 'ink' });
      k.box(lb, x, 1.05, -2.6, 0.36, 0.06, 1.34, { solid: 'gold' });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), glow(lb, 0.35));
      f.position.set(x + (x < 0 ? 0.62 : -0.62), 0.75, -2.6);
      f.rotation.y = Math.PI / 2;
      k.root.add(f);
    }
    // Glowing glass entry booth.
    k.box(lb, 9.5, 0, -11, 2.6, 3.1, 2.6, { solid: 'none', tone: 'ink' });
    for (const [px, pz, ry] of [[9.5, -9.7, 0], [9.5, -12.3, 0], [8.2, -11, Math.PI / 2], [10.8, -11, Math.PI / 2]] as [number, number, number][]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.1), glow(lb, 0.22));
      g.position.set(px, 1.55, pz);
      g.rotation.y = ry;
      k.root.add(g);
    }
    k.plane(lb, 9.5, 3.55, -9.68, 2.4, 0.55, { mat: k.amat(lb, 0xffffff, 1, plate('INTAKE', { w: 512, h: 120 })) });
    halo(lb, k.root, [9.5, 1.6, -11], 5, 0.3);
    // Plants in the corners.
    for (const [x, z] of [[-14, -4], [14, -4], [-16.5, -19], [15, -19]] as [number, number][]) {
      k.box(lb, x, 0, z, 0.8, 0.8, 0.8, { tone: 'ink' });
      k.box(lb, x, 0.8, z, 1.3, 1.5, 1.3, { solid: 'green' });
    }
  }

  // ---- Develop: Evidence Passport screen (frame 3) -------------------------------
  {
    const pa = k.area('passport', { c: V(-7, 8, -41), full: 13.5, start: 21 });
    const t = k.ctex(640, 400, (x, w, h) => {
      x.fillStyle = '#0F2B22'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#35DC78'; x.lineWidth = 8; x.shadowColor = '#35DC78'; x.shadowBlur = 16; x.strokeRect(10, 10, w - 20, h - 20);
      x.fillStyle = '#7CFFB0'; x.textAlign = 'left'; x.textBaseline = 'middle'; sp(x, '4px');
      x.font = '800 40px Manrope, sans-serif'; x.fillText('EVIDENCE PASSPORT', 36, 58);
      ['Assessments', 'Project work', 'Reviewed delivery', 'Readiness'].forEach((n, i) => {
        const y = 128 + i * 64;
        x.strokeRect(36, y - 18, 36, 36);
        x.beginPath(); x.moveTo(44, y); x.lineTo(52, y + 9); x.lineTo(66, y - 10); x.stroke();
        x.font = '700 30px Manrope, sans-serif'; x.fillText(n, 92, y);
        x.fillRect(420, y - 4, 170 - i * 30, 8);
      });
    });
    k.box(pa, -11.4, 6, -40.6, 0.12, 2.2, 0.12, { solid: 'green' });
    k.plane(pa, -11.4, 9, -40.5, 3.2, 2, { mat: k.amat(pa, 0xffffff, 1, t), tone: 'ink' });
    halo(pa, k.root, [-11.4, 9, -40.6], 5.5, 0.35);
  }

  // ---- Engineer: POD hologram over a round table (frame 4) -------------------------
  {
    const ho = k.area('holo', { c: V(15, 3, -33), full: 18, start: 28 });
    const cx = 14.5, cz = -33.6;
    k.box(ho, cx, 0, cz, 2.8, 0.8, 2.8, { tone: 'ink' });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), glow(ho, 0.4));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.83, cz);
    k.root.add(pad);
    const holo = new THREE.Group();
    holo.position.set(cx, 0.86, cz);
    k.root.add(holo);
    const fill = glow(ho, 0.22), lineM = new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    lineM.userData.base = 1;
    ho.mats.push(lineM);
    let s = 3;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9; i++) {
      const w = 0.32 + rnd() * 0.3, hgt = 0.4 + rnd() * 1.3, x = (rnd() - 0.5) * 1.8, z = (rnd() - 0.5) * 1.8;
      const geo = new THREE.BoxGeometry(w, hgt, w);
      const m = new THREE.Mesh(geo, fill);
      m.position.set(x, hgt / 2, z);
      holo.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineM);
      e.position.copy(m.position);
      holo.add(e);
    }
    halo(ho, holo, [0, 1, 0], 4.5, 0.4);
    ticks.push((now) => { holo.rotation.y = now / 4000; });
  }

  // ---- Deploy: out the back, through the ETAF gate into the city (frame 5) ------------
  const dep = k.area('deploy', { c: V(0, 4, -76), full: 44, start: 70 });
  {
    // Doorway in the back wall.
    k.box(dep, -3.4, 0, -60.1, 0.4, 5.2, 0.4, { solid: 'green' });
    k.box(dep, 3.4, 0, -60.1, 0.4, 5.2, 0.4, { solid: 'green' });
    k.box(dep, 0, 5.2, -60.1, 7.2, 0.5, 0.4, { solid: 'green' });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.1), glow(dep, 0.28));
    door.position.set(0, 2.55, -60.25);
    k.root.add(door);
    // The gate arch.
    const gz = -71;
    k.box(dep, -5.6, 0, gz, 1.6, 8, 1.6, { solid: 'green' });
    k.box(dep, 5.6, 0, gz, 1.6, 8, 1.6, { solid: 'green' });
    k.box(dep, 0, 8, gz, 13.6, 2.6, 1.8, { solid: 'green' });
    k.plane(dep, 0, 9.3, gz - 0.92, 9, 1.8, { ry: Math.PI, mat: k.amat(dep, 0xffffff, 1, plate('DEPLOY', { w: 768, h: 150 })) });
    const gateT = neonTex(768, 160, (x, w, h) => {
      x.fillStyle = 'rgba(15,43,34,.9)'; x.fillRect(0, 0, w, h);
      x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16);
      x.textAlign = 'center'; x.textBaseline = 'middle'; sp(x, '10px');
      x.fillStyle = '#9CFFC6'; fitText(x, 'ETAF™ GATE', 800, 92, w - 60); x.fillText('ETAF™ GATE', w / 2, h / 2 + 4);
    });
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.55), k.amat(dep, 0xffffff, 1, gateT));
    gp.position.set(0, 6.35, gz - 0.05);
    gp.rotation.y = Math.PI;
    k.root.add(gp);
    const frame = glow(dep, 0.9);
    for (const [x, y, w, h] of [[-4.75, 3.6, 0.12, 7.2], [4.75, 3.6, 0.12, 7.2], [0, 7.25, 9.6, 0.12]] as [number, number, number, number][]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frame);
      b.position.set(x, y, gz - 0.85);
      k.root.add(b);
    }
    halo(dep, k.root, [0, 6.4, gz - 1.2], 10, 0.3);
    // Path and neon lawns out to the city.
    for (const x of [-2.6, 2.6]) k.line(dep, 'ink', [x, 0.02, -60.5], [x, 0.02, -112]);
    for (let z = -62; z > -112; z -= 2.5) k.line(dep, 'faint', [-2.6, 0.02, z], [2.6, 0.02, z]);
    for (const x of [-9, 9]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(9, 46), glow(dep, 0.18));
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.03, -86);
      k.root.add(l);
    }
    // Dark glass towers flanking the gate.
    for (const [x, z, w, d, h] of [[-26, -84, 12, 12, 46], [-40, -104, 14, 14, 62], [24, -88, 12, 14, 38], [38, -108, 16, 14, 56], [-14, -128, 12, 12, 34], [14, -132, 14, 12, 44]] as [number, number, number, number, number][]) {
      k.box(dep, x, 0, z, w, h, d, { solid: 'green' });
      for (let y = 3; y < h; y += 3) k.line(dep, 'faint', [x - w / 2, y, z + d / 2 + 0.02], [x + w / 2, y, z + d / 2 + 0.02]);
      for (let xx = x - w / 2 + 2; xx < x + w / 2; xx += 2) k.line(dep, 'faint', [xx, 0, z + d / 2 + 0.02], [xx, h, z + d / 2 + 0.02]);
    }
    for (const [x, z] of [[-12, -68], [12, -68], [-12, -82], [12, -82]] as [number, number][]) tree(x, z, 1.1);
  }
  // Walkers going out through the gate.
  const walkers = Array.from({ length: mobile ? 3 : 6 }, (_, i) => {
    const g = new THREE.Group();
    k.root.add(g);
    const a = k.area('walker' + i, { c: V(0, 4, -76), full: 44, start: 70, parent: g });
    k.into(g, () => k.figure(a, 'walk', 0, 0, 0, Math.PI, 1, 1.75 + (i % 3) * 0.05));
    return { g, x: (i % 2 ? 1 : -1) * (0.8 + (i % 3) * 0.45), ph: i / (mobile ? 3 : 6) };
  });
  ticks.push((now) => {
    walkers.forEach((w) => {
      const u = (now / 16000 + w.ph) % 1;
      w.g.position.set(w.x, Math.abs(Math.sin(u * 160)) * 0.04, -60.6 - u * 46);
      w.g.visible = u > 0.01 && u < 0.97;
    });
  });

  // ---- City around the HQ (frames 5 and 8) -------------------------------------------
  const sky = k.area('skyline', { fixed: 1 });
  {
    let s = 11;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const step = mobile ? 30 : 20;
    for (let x = -160; x <= 160; x += step) {
      for (let z = 70; z >= -190; z -= step) {
        // Keep the city clear of the building and every tour camera (the compare stop sits at x = 62).
        const inside = x > -85 && x < 88 && z > -150 && z < 64;
        if (inside || rnd() < 0.28) continue;
        const w = 8 + rnd() * 8, d = 8 + rnd() * 8, h = 10 + rnd() * rnd() * 46;
        const xx = x + (rnd() - 0.5) * 4, zz = z + (rnd() - 0.5) * 4;
        k.box(sky, xx, 0, zz, w, h, d, {});
        if (!mobile) for (let y = 3.5; y < h; y += 3.5) k.line(sky, 'faint', [xx - w / 2, y, zz + d / 2], [xx + w / 2, y, zz + d / 2]);
      }
    }
  }

  return {
    skyline: sky,
    icons: iconDefs.map((d) => d.p),
    tick(now, dt) {
      ticks.forEach((f) => f(now, dt));
      if (!mobile) halos.forEach((h) => h.s.scale.setScalar(h.size * (1 + Math.sin(now / 700 + h.ph) * 0.06)));
      // Gentle neon pulse.
      const p = 0.9 + Math.sin(now / 520) * 0.1;
      glowMats.forEach((m) => { (m as THREE.MeshBasicMaterial).color.setRGB(0.13 * p, 0.78 * p, 0.4 * p); });
    },
  };
}
