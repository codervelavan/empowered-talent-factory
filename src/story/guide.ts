// Story mode: a scroll-driven story through the company. A gold-suited EmpowerED guide walks
// the visitor's own blocky character (picked by "What are you looking for?") room to room.
// The visitor's character asks the questions people really ask; the guide answers. Each
// scroll step is one beat; between rooms both characters walk real paths (stairs included)
// and the camera follows them.
import * as THREE from 'three';
import type { P3, ScreenPoint } from '../bridge';
import type { TourHotspot, TourStop } from '../company/tour';

export type RoomId = 'entrance' | 'intake' | 'develop' | 'engineer' | 'verify' | 'deploy';
export interface Choice { id: string; label: string; you: string; guide: string }
export interface Beat {
  room: RoomId;
  /** The visitor's character's line. */
  you?: string;
  /** The guide's line. */
  guide?: string;
  /** The visitor picks the question; the chosen option supplies both lines. */
  choices?: Choice[];
  /** The guide points at the room's hotspot. */
  point?: boolean;
  /** Last beat: show the path's next-step buttons. */
  end?: boolean;
}
export interface RoomDef {
  label: string;
  eyebrow: string;
  title: string;
  copy: string;
  action?: { label: string; run(): void };
  hotspots?: TourHotspot[];
}
export type Audience = 'student' | 'founder' | 'hr' | 'university' | 'professional' | 'explore';
export interface StoryHost {
  project(x: number, y: number, z: number): ScreenPoint;
  addWorld(o: THREE.Object3D): void;
  /** Replace the story route's beats and go to beat i. */
  setBeats(stops: TourStop[], goTo: number): void;
  /** Paths not built as stories yet hand over to the matching part of the tour. */
  other(a: Exclude<Audience, 'student'>): void;
  /** Buttons on the last beat. */
  endActions: { label: string; primary?: boolean; run(): void }[];
}

// ---- Where things happen ----------------------------------------------------------
interface Spot { guide: P3; you: P3; cam: [P3, P3] }
const SPOTS: Record<RoomId, Spot> = {
  // Out on the plaza, with the glowing entrance icons and the HQ behind the characters.
  entrance: { guide: [-2, 0, 30], you: [1.5, 0, 31.4], cam: [[3.5, 3.4, 43], [-0.5, 4.6, 14]] },
  intake: { guide: [6.5, 0, -9], you: [4.1, 0, -7.1], cam: [[-0.8, 3.4, 2.6], [6.4, 1.9, -11]] },
  develop: { guide: [-9.5, 6, -37.6], you: [-6.6, 6, -36], cam: [[-3.2, 8.8, -27.4], [-9, 7.4, -42]] },
  engineer: { guide: [13.6, 0, -25.6], you: [16.5, 0, -24.4], cam: [[21.6, 3.6, -17.4], [13.4, 1.6, -31]] },
  verify: { guide: [18.6, 6, -38.6], you: [21.5, 6, -37.3], cam: [[24.6, 8.8, -29.4], [20, 7.6, -44]] },
  deploy: { guide: [-1.6, 0, -77], you: [1.6, 0, -78.4], cam: [[4.5, 3.8, -91], [0, 4.2, -68]] },
};
/** Walking routes between rooms (guide spot to guide spot), up and down the atrium stairs. */
const PATHS: Record<string, P3[]> = {
  'entrance>intake': [[-2, 0, 30], [0, 0, 16], [0, 0, 3], [3, 0, -3], [6.5, 0, -9]],
  'intake>develop': [[6.5, 0, -9], [2, 0, -5], [0, 0, -5.6], [0, 6, -22], [-3, 6, -27], [-7, 6, -33], [-9.5, 6, -37.6]],
  'develop>engineer': [[-9.5, 6, -37.6], [-7, 6, -30], [-1, 6, -24], [0, 6, -22], [0, 0, -6], [4, 0, -10], [10, 0, -18], [13.6, 0, -25.6]],
  'engineer>verify': [[13.6, 0, -25.6], [8, 0, -14], [0, 0, -6], [0, 6, -22], [8, 6, -26], [16, 6, -32], [18.6, 6, -38.6]],
  'verify>deploy': [[18.6, 6, -38.6], [20, 6, -31], [6, 6, -24], [0, 6, -22], [0, 0, -6], [-4, 0, -9], [-4, 0, -57], [0, 0, -61], [0, 0, -70], [-1.6, 0, -77]],
};

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixPose = (a: [P3, P3], b: [P3, P3], t: number): [P3, P3] => [lerp3(a[0], b[0], t), lerp3(a[1], b[1], t)];

/** A polyline you can sample by distance. */
class Path {
  private len: number[] = [0];
  constructor(private pts: P3[]) {
    for (let i = 1; i < pts.length; i++) this.len.push(this.len[i - 1] + Math.hypot(...([0, 1, 2].map((k) => pts[i][k] - pts[i - 1][k]) as [number, number, number])));
  }
  get length() { return this.len[this.len.length - 1]; }
  at(d: number): { p: P3; dir: P3 } {
    d = Math.min(this.length, Math.max(0, d));
    let i = 1;
    while (i < this.len.length - 1 && this.len[i] < d) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.len[i] - this.len[i - 1] || 1;
    const t = (d - this.len[i - 1]) / seg, L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    return { p: lerp3(a, b, t), dir: [(b[0] - a[0]) / L, 0, (b[2] - a[2]) / L] };
  }
}
const PATH_CACHE: Record<string, Path> = {};
const pathFor = (a: RoomId, b: RoomId): Path | null => {
  const k = a + '>' + b;
  if (PATH_CACHE[k]) return PATH_CACHE[k];
  const pts = PATHS[k] ?? (PATHS[b + '>' + a] ? [...PATHS[b + '>' + a]].reverse() : null);
  return pts ? (PATH_CACHE[k] = new Path(pts)) : null;
};

// ---- Blocky characters --------------------------------------------------------------
interface Rig { root: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group; body: THREE.Group }
function blocky(o: { top: number; legs: number; skin: number; hair: number; extra?: (body: THREE.Group, box: (c: number, w: number, h: number, d: number, x: number, y: number, z: number, parent?: THREE.Object3D) => THREE.Mesh) => void }): Rig {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const edgeM = new THREE.LineBasicMaterial({ color: 0x0f2b22, transparent: true, opacity: 0.55 });
  const box = (c: number, w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c }));
    m.position.set(x, y, z);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeM));
    parent.add(m);
    return m;
  };
  const limb = (x: number, y: number, c: number, w: number, len: number, d: number, hand?: number) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    body.add(j);
    box(c, w, len, d, 0, -len / 2, 0, j);
    if (hand !== undefined) box(hand, w * 0.86, 0.1, d * 0.86, 0, -len - 0.05, 0, j);
    return j;
  };
  const legs = [limb(-0.12, 0.88, o.legs, 0.2, 0.88, 0.22), limb(0.12, 0.88, o.legs, 0.2, 0.88, 0.22)];
  box(o.top, 0.54, 0.62, 0.3, 0, 1.19, 0);
  const arms = [limb(-0.35, 1.46, o.top, 0.15, 0.5, 0.17, o.skin), limb(0.35, 1.46, o.top, 0.15, 0.5, 0.17, o.skin)];
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  body.add(head);
  box(o.skin, 0.36, 0.36, 0.36, 0, 0.18, 0, head);
  box(o.hair, 0.39, 0.09, 0.39, 0, 0.38, 0, head);
  box(o.hair, 0.38, 0.3, 0.07, 0, 0.22, -0.17, head);
  for (const ex of [-0.08, 0.08]) box(0x0f2b22, 0.055, 0.055, 0.02, ex, 0.21, 0.181, head);
  o.extra?.(body, box);
  return { root, legs, arms, head, body };
}
const makeGuide = () => {
  const r = blocky({ top: 0xc9a33a, legs: 0x8e7121, skin: 0xa87b5c, hair: 0x1a1410, extra: (_b, box) => {
    box(0xf2efe2, 0.16, 0.42, 0.02, 0, 1.24, 0.155);
    box(0x1e4632, 0.06, 0.32, 0.025, 0, 1.22, 0.166);
    box(0x35dc78, 0.1, 0.12, 0.02, -0.15, 1.3, 0.162);
  } });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 40), new THREE.MeshBasicMaterial({ color: 0x35dc78, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  r.root.add(ring);
  return r;
};
const makeStudent = () => blocky({ top: 0x8fbf9a, legs: 0x3e5c7a, skin: 0xe0b898, hair: 0x4a3424, extra: (body, box) => {
  box(0x1e4632, 0.44, 0.5, 0.18, 0, 1.2, -0.24, body); // backpack
  box(0x7fae8a, 0.4, 0.14, 0.12, 0, 1.47, -0.18, body); // hood
} });

// ---- The story ----------------------------------------------------------------------
export class Story {
  audience: Audience | null = null;
  private beats: Beat[] = [];
  private picked: Record<number, string> = {};
  private guide = makeGuide();
  private you = makeStudent();
  private last: { g: P3; y: P3 } | null = null;
  private walkT = 0;
  private bubbleG: HTMLDivElement;
  private bubbleY: HTMLDivElement;
  private shownBeat = -1;
  private visible = false;

  constructor(private host: StoryHost, private rooms: Record<RoomId, RoomDef>, private script: Beat[]) {
    host.addWorld(this.guide.root);
    host.addWorld(this.you.root);
    this.guide.root.visible = this.you.root.visible = false;
    const mk = (cls: string) => { const d = document.createElement('div'); d.className = 'sbub ' + cls; d.hidden = true; (document.getElementById('hud') ?? document.body).appendChild(d); return d; };
    this.bubbleG = mk('guide');
    this.bubbleY = mk('you');
    this.bubbleG.setAttribute('aria-live', 'polite');
  }

  /** The entrance beat only (before the visitor picks a path). */
  entranceStops(): TourStop[] { this.audience = null; this.beats = [{ room: 'entrance' }]; return this.toStops(); }

  private toStops(): TourStop[] {
    return this.beats.map((b, i) => {
      const r = this.rooms[b.room];
      return { id: 'beat' + i, room: b.room, label: r.label, eyebrow: r.eyebrow, title: r.title, copy: r.copy, action: r.action, hotspots: r.hotspots, pose: () => SPOTS[b.room].cam };
    });
  }

  private pick(a: Audience) {
    if (a !== 'student') { this.host.other(a); return; }
    this.audience = a;
    this.picked = {};
    this.beats = [{ room: 'entrance' }, ...this.script];
    this.shownBeat = -1;
    this.host.setBeats(this.toStops(), 1);
  }

  /** Camera between beat i and i+1 at eased progress e. */
  camAt(i: number, e: number): [P3, P3] {
    const a = this.beats[i]?.room ?? 'entrance', b = this.beats[i + 1]?.room ?? a;
    if (a === b) return SPOTS[a].cam;
    const path = pathFor(a, b);
    if (!path) return mixPose(SPOTS[a].cam, SPOTS[b].cam, e);
    const { p, dir } = path.at(e * path.length);
    const follow: [P3, P3] = [[p[0] - dir[0] * 6.5, p[1] + 3.3, p[2] - dir[2] * 6.5], [p[0] + dir[0] * 5, p[1] + 1.4, p[2] + dir[2] * 5]];
    return mixPose(mixPose(SPOTS[a].cam, follow, sm(0, 0.22, e)), SPOTS[b].cam, sm(0.78, 1, e));
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.guide.root.visible = this.you.root.visible = false;
    this.bubbleG.hidden = this.bubbleY.hidden = true;
    this.shownBeat = -1;
  }

  /** Per frame while the story route is showing. */
  update(v: number, settled: boolean, dt: number) {
    if (!this.beats.length) return;
    this.visible = true;
    this.guide.root.visible = this.you.root.visible = true;
    const n = this.beats.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(v)));
    const f = v - i;
    const e = sm(0.08, 0.92, f);
    const a = this.beats[i].room, b = this.beats[Math.min(n - 1, i + 1)].room;
    let g: P3, y: P3;
    if (a === b || f <= 0) { g = SPOTS[a].guide; y = SPOTS[a].you; }
    else {
      const path = pathFor(a, b);
      if (!path) { g = lerp3(SPOTS[a].guide, SPOTS[b].guide, e); y = lerp3(SPOTS[a].you, SPOTS[b].you, e); }
      else {
        const d = e * path.length;
        g = path.at(d).p;
        const behind = path.at(d - 1.5).p;
        y = lerp3(lerp3(SPOTS[a].you, behind, sm(0, 0.12, e)), SPOTS[b].you, sm(0.86, 1, e));
      }
    }
    // Animate: walk when moving, otherwise face each other (turned a little to the camera) and talk.
    const moved = this.last ? Math.hypot(g[0] - this.last.g[0], g[2] - this.last.g[2]) + Math.hypot(y[0] - this.last.y[0], y[2] - this.last.y[2]) : 0;
    const walking = moved > 0.002;
    if (walking) this.walkT += dt * 9;
    const beatIdx = Math.round(v);
    const beat = this.beats[beatIdx];
    const cam = SPOTS[beat.room].cam[0];
    const place = (rig: Rig, p: P3, other: P3, prev: P3 | undefined, speaking: boolean, pointing: boolean) => {
      rig.root.position.set(p[0], p[1], p[2]);
      let yaw: number;
      if (walking && prev && Math.hypot(p[0] - prev[0], p[2] - prev[2]) > 0.0005) yaw = Math.atan2(p[0] - prev[0], p[2] - prev[2]);
      else {
        const toOther = Math.atan2(other[0] - p[0], other[2] - p[2]), toCam = Math.atan2(cam[0] - p[0], cam[2] - p[2]);
        let d = toCam - toOther; d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw = toOther + d * 0.5;
      }
      let cur = rig.root.rotation.y, dd = yaw - cur; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      rig.root.rotation.y = cur + dd * Math.min(1, dt * 8);
      const sw = walking ? Math.sin(this.walkT) * 0.5 : 0;
      rig.legs[0].rotation.x = sw; rig.legs[1].rotation.x = -sw;
      rig.arms[0].rotation.x = -sw * 0.7;
      rig.arms[1].rotation.x = pointing ? -1.35 : sw * 0.7;
      rig.arms[1].rotation.z = pointing ? 0.25 : 0;
      rig.body.position.y = walking ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0;
      rig.head.rotation.x = speaking && !walking ? Math.sin(performance.now() / 160) * 0.06 : 0;
    };
    const near = Math.abs(v - beatIdx) < 0.35;
    place(this.guide, g, y, this.last?.g, near && !!this.lineFor(beatIdx).guide, near && settled && !!beat.point);
    place(this.you, y, g, this.last?.y, near && !!this.lineFor(beatIdx).you, false);
    this.last = { g, y };
    this.bubbles(beatIdx, near, settled);
  }

  /** The lines shown at a beat, honouring the visitor's question choice. */
  private lineFor(i: number): { you?: string; guide?: string } {
    const b = this.beats[i];
    if (!b) return {};
    if (b.choices) {
      const c = b.choices.find((x) => x.id === this.picked[i]);
      return c ? { you: c.you, guide: c.guide } : { guide: b.guide };
    }
    if (b.room === 'entrance' && i === 0) return { guide: this.audience ? 'Great choice. Let me show you around. Scroll to follow me.' : "Hi! I'm your EmpowerED guide. Welcome to EmpowerED Careers, home of the AI Talent Factory. What are you looking for?" };
    return { you: b.you, guide: b.guide };
  }

  private bubbles(i: number, near: boolean, settled: boolean) {
    const b = this.beats[i];
    if (!near) { this.bubbleG.hidden = this.bubbleY.hidden = true; return; }
    if (i !== this.shownBeat) {
      this.shownBeat = i;
      this.fill(i);
    }
    const head = (rig: Rig): ScreenPoint => { const p = rig.root.position; return this.host.project(p.x, p.y + 2.25, p.z); };
    const put = (el: HTMLDivElement, p: ScreenPoint, side: 1 | -1) => {
      if (el.hidden || !p.vis) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      const w = el.offsetWidth, h = el.offsetHeight, card = document.getElementById('tourHud')?.getBoundingClientRect();
      let x = p.x - (side > 0 ? w * 0.18 : w * 0.82), yy = p.y - h - 14;
      const minX = card && card.width && innerWidth > 760 ? card.right + 12 : 12;
      x = Math.min(Math.max(x, minX), innerWidth - w - 12);
      yy = Math.min(Math.max(yy, 76), innerHeight - h - 110);
      el.style.transform = `translate(${x.toFixed(1)}px,${yy.toFixed(1)}px)`;
      el.style.setProperty('--tail', Math.min(Math.max(p.x - x, 22), w - 22).toFixed(0) + 'px');
    };
    const gp = head(this.guide), yp = head(this.you);
    const guideLeft = gp.x < yp.x;
    put(this.bubbleG, gp, guideLeft ? -1 : 1);
    put(this.bubbleY, yp, guideLeft ? 1 : -1);
    // If the two bubbles overlap, lift the guide's above the visitor's.
    if (!this.bubbleG.hidden && !this.bubbleY.hidden) {
      const A = this.bubbleG.getBoundingClientRect(), B = this.bubbleY.getBoundingClientRect();
      if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) {
        const yy = Math.max(76, B.top - A.height - 10);
        this.bubbleG.style.transform = `translate(${A.left.toFixed(1)}px,${yy.toFixed(1)}px)`;
      }
    }
    this.bubbleG.classList.toggle('settled', settled);
  }

  private fill(i: number) {
    const b = this.beats[i], L = this.lineFor(i);
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    // Visitor's bubble (with question choices when it's their turn to pick).
    if (b.choices && !this.picked[i]) {
      this.bubbleY.hidden = false;
      this.bubbleY.innerHTML = '<small>Ask the guide</small><div class="sbChips">' + b.choices.map((c) => `<button type="button" data-q="${c.id}">${esc(c.label)}</button>`).join('') + '</div>';
      this.bubbleY.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((btn) => (btn.onclick = () => { this.picked[i] = btn.dataset.q!; this.fill(i); }));
    } else if (L.you) {
      this.bubbleY.hidden = false;
      this.bubbleY.innerHTML = `<small>You</small><p>${esc(L.you)}</p>` + (b.choices ? '<button type="button" class="sbAgain">Ask something else</button>' : '');
      this.bubbleY.querySelector<HTMLButtonElement>('.sbAgain')?.addEventListener('click', () => { delete this.picked[i]; this.fill(i); });
    } else this.bubbleY.hidden = true;
    // Guide's bubble (with the path picker at the entrance, or next steps at the end).
    if (L.guide) {
      this.bubbleG.hidden = false;
      let extra = '';
      if (i === 0 && !this.audience) {
        const opts: [Audience, string][] = [['student', 'I want to build my career'], ['founder', 'I need a product or a team'], ['hr', 'I want to upskill my people'], ['university', 'I run a university'], ['professional', "I'm exploring AI for my profession"], ['explore', "I'll explore on my own"]];
        extra = '<div class="sbChips">' + opts.map(([k, t]) => `<button type="button" data-a="${k}"${k === 'explore' ? ' class="ghost"' : ''}>${esc(t)}</button>`).join('') + '</div>';
      } else if (b.end) {
        extra = '<div class="sbChips">' + this.host.endActions.map((x, k) => `<button type="button" data-end="${k}"${x.primary ? ' class="pri"' : ''}>${esc(x.label)}</button>`).join('') + '</div>';
      } else if (b.point) extra = '<span class="sbHint">Tap the glowing marker to look closer</span>';
      this.bubbleG.innerHTML = `<small>Your EmpowerED guide</small><p>${esc(L.guide)}</p>${extra}`;
      this.bubbleG.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((btn) => (btn.onclick = () => this.pick(btn.dataset.a as Audience)));
      this.bubbleG.querySelectorAll<HTMLButtonElement>('[data-end]').forEach((btn) => (btn.onclick = () => this.host.endActions[+btn.dataset.end!].run()));
    } else this.bubbleG.hidden = true;
  }

  /** Start a path directly (e.g. from the menu). */
  choose(a: Audience) { this.pick(a); }

  /** Back to the entrance question. */
  reset(): TourStop[] { return this.entranceStops(); }
}
