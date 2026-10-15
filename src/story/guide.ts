// Story mode: a guided tour through the company, one stop per room. A gold-suited EmpowerED
// guide walks the visitor's own blocky character (picked by "What would you like help with?")
// from room to room. At each stop one guide panel recognises the visitor's concern, gives the
// EmpowerED answer, offers a detail to look at and optional questions, then names the next room.
// Scroll or the named Next button moves one room; both characters walk real paths between rooms.
import * as THREE from 'three';
import type { P3, ScreenPoint } from '../bridge';
import type { TourHotspot, TourStop } from '../company/tour';

export type RoomId = 'entrance' | 'intake' | 'develop' | 'engineer' | 'delivery' | 'verify' | 'deploy' | 'dock' | 'talent' | 'teams' | 'apply' | 'campus' | 'scope' | 'plaza';
export type Audience = 'student' | 'founder' | 'hr' | 'university' | 'professional' | 'explore';
export type PathId = Exclude<Audience, 'explore'>;

/** Story state the copy can depend on (the professional route follows the chosen profession). */
export interface StoryCtx { profession: number }
export type Txt = string | ((c: StoryCtx) => string);
export interface Ask { q: Txt; a: Txt }
export interface EndAction { label: string; run(c: StoryCtx): void }
export interface StoryStop {
  room: RoomId;
  /** Stop name in the panel and on the map. */
  title: string;
  /** How the Next button names this stop ("Next to Verify the work"); defaults to the title. */
  go?: string;
  /** The visitor's concern, in their words. */
  concern: Txt;
  /** The guide's answer. */
  guide: Txt;
  /** A concrete detail to look at: opens one of the site's panels (host.open). */
  show?: { label: Txt; open: string };
  /** Optional questions under "Ask your guide". */
  asks?: Ask[] | ((c: StoryCtx) => Ask[]);
  /** Said on the way out, while walking to the next stop. */
  bridge?: string;
  /** This stop asks the visitor to choose a profession. */
  pick?: 'profession';
}
export interface StoryPath {
  /** The goal as the visitor chose it ("Start my career"). */
  goal: string;
  stops: StoryStop[];
  primary: EndAction;
  more?: EndAction[];
}
export interface RoomDef {
  label: string;
  hotspots?: TourHotspot[];
}
export interface StoryHost {
  project(x: number, y: number, z: number): ScreenPoint;
  addWorld(o: THREE.Object3D): void;
  /** Replace the story route's stops and go to stop i. */
  setStops(stops: TourStop[], goTo: number): void;
  /** Move to stop i (smoothly). */
  travel(i: number): void;
  /** Open a detail panel by key ("career:1", "workforce:3"). */
  open(key: string, c: StoryCtx): void;
  /** True while a detail panel covers the scene. */
  detailOpen(): boolean;
  /** Leave the guided tour for free exploration. */
  explore(): void;
  /** The visitor chose (or cleared) a goal. */
  onAudience(a: PathId | null): void;
}
/** A profession the professional route can use (complete copy only). */
export interface Profession { name: string; line: string; uses: string[] }

// ---- Where things happen ----------------------------------------------------------
interface Spot { guide: P3; you: P3; cam: [P3, P3] }
const SPOTS: Record<RoomId, Spot> = {
  // Out on the plaza, with the glowing entrance icons and the HQ behind the characters.
  entrance: { guide: [-2, 0, 30], you: [1.5, 0, 31.4], cam: [[3.5, 3.4, 43], [-0.5, 4.6, 14]] },
  intake: { guide: [6.5, 0, -9], you: [4.1, 0, -7.1], cam: [[-0.8, 3.4, 2.6], [6.4, 1.9, -11]] },
  develop: { guide: [-9.5, 6, -37.6], you: [-6.6, 6, -36], cam: [[-3.2, 8.8, -27.4], [-9, 7.4, -42]] },
  engineer: { guide: [13.6, 0, -25.6], you: [16.5, 0, -24.4], cam: [[21.6, 3.6, -17.4], [13.4, 1.6, -31]] },
  // Further along the POD floor, by the six stage boards.
  delivery: { guide: [2.2, 0, -25.6], you: [4.8, 0, -26.4], cam: [[6, 3.2, -19.5], [0, 1.4, -32]] },
  verify: { guide: [18.6, 6, -38.6], you: [21.5, 6, -37.3], cam: [[24.6, 8.8, -29.4], [20, 7.6, -44]] },
  deploy: { guide: [-1.6, 0, -77], you: [1.6, 0, -78.4], cam: [[4.5, 3.8, -91], [0, 4.2, -68]] },
  // Outside the east wall, by the five workforce bays.
  dock: { guide: [39, 0, -12], you: [41.4, 0, -14.4], cam: [[50, 4, -4], [35, 2, -15]] },
  // Just inside the east wall, at the verified talent shelf.
  talent: { guide: [22.2, 0, -3.4], you: [24.8, 0, -6], cam: [[28.8, 3.2, 0], [20.5, 1.6, -7.5]] },
  // West side of the ground floor, at the open front of the reskilling line.
  teams: { guide: [-25, 0, -2.2], you: [-22.4, 0, -3], cam: [[-21.5, 3.4, 4.5], [-24.5, 1.6, -10]] },
  // Inside the reskilling line, beside the Apply station.
  apply: { guide: [-22.2, 0, -9.4], you: [-20.4, 0, -11.2], cam: [[-19.8, 3, -2.4], [-25, 1.4, -13]] },
  // Outside the west wall, where the campus extension slides in.
  campus: { guide: [-41, 0, -8], you: [-38.6, 0, -9.8], cam: [[-31, 4.6, 2], [-48, 2.4, -18]] },
  // Closer to the campus blocks.
  scope: { guide: [-42, 0, -10.2], you: [-40, 0, -12], cam: [[-36, 4, -5], [-52, 2.4, -22]] },
  // On the plaza under the "AI for Everyone" icon.
  plaza: { guide: [5, 0, 22.5], you: [8, 0, 24], cam: [[0.5, 3.2, 33], [7, 4.4, 17]] },
};
const UP_STAIRS: P3[] = [[0, 0, -5.6], [0, 6, -22], [8, 6, -26], [16, 6, -32], [18.6, 6, -38.6]];
/** Walking routes between rooms (guide spot to guide spot), up and down the atrium stairs. */
const PATHS: Record<string, P3[]> = {
  'entrance>intake': [[-2, 0, 30], [0, 0, 16], [0, 0, 3], [3, 0, -3], [6.5, 0, -9]],
  'intake>develop': [[6.5, 0, -9], [2, 0, -5], [0, 0, -5.6], [0, 6, -22], [-3, 6, -27], [-7, 6, -33], [-9.5, 6, -37.6]],
  'develop>engineer': [[-9.5, 6, -37.6], [-7, 6, -30], [-1, 6, -24], [0, 6, -22], [0, 0, -6], [4, 0, -10], [10, 0, -18], [13.6, 0, -25.6]],
  'engineer>verify': [[13.6, 0, -25.6], [8, 0, -14], [0, 0, -6], ...UP_STAIRS.slice(1)],
  'verify>deploy': [[18.6, 6, -38.6], [20, 6, -31], [6, 6, -24], [0, 6, -22], [0, 0, -6], [-4, 0, -9], [-4, 0, -57], [0, 0, -61], [0, 0, -70], [-1.6, 0, -77]],
  'entrance>dock': [[-2, 0, 30], [10, 0, 24], [28, 0, 14], [40, 0, 4], [42, 0, -6], [39, 0, -12]],
  'dock>engineer': [[39, 0, -12], [34, 0, -13.5], [30, 0, -13.5], [24, 0, -14], [18, 0, -20], [13.6, 0, -25.6]],
  'engineer>delivery': [[13.6, 0, -25.6], [8, 0, -24.6], [2.2, 0, -25.6]],
  'delivery>verify': [[2.2, 0, -25.6], [3, 0, -14], [1.5, 0, -7], ...UP_STAIRS],
  'verify>talent': [[18.6, 6, -38.6], [16, 6, -32], [8, 6, -26], [0, 6, -22], [0, 0, -5.6], [2, 0, -5], [12, 0, -4.4], [22.2, 0, -3.4]],
  'intake>teams': [[6.5, 0, -9], [2, 0, -4], [-8, 0, 1], [-22, 0, 1], [-25, 0, -2.2]],
  'teams>apply': [[-25, 0, -2.2], [-22.6, 0, -4.2], [-22.2, 0, -9.4]],
  'apply>verify': [[-22.2, 0, -9.4], [-22, 0, -4], [-22, 0, 1], [-8, 0, 1], [-1.5, 0, -3], ...UP_STAIRS],
  'verify>dock': [[18.6, 6, -38.6], [16, 6, -32], [8, 6, -26], [0, 6, -22], [0, 0, -6], [12, 0, -11], [26, 0, -13.5], [30, 0, -13.5], [36, 0, -13.5], [39, 0, -12]],
  'entrance>campus': [[-2, 0, 30], [-16, 0, 24], [-36, 0, 14], [-42, 0, 0], [-41, 0, -8]],
  'campus>scope': [[-41, 0, -8], [-42, 0, -10.2]],
  'scope>engineer': [[-42, 0, -10.2], [-42, 0, -6], [-42, 0, 0], [-36, 0, 14], [-16, 0, 16], [0, 0, 16], [0, 0, 3], [4, 0, -10], [10, 0, -18], [13.6, 0, -25.6]],
  'entrance>plaza': [[-2, 0, 30], [2, 0, 25], [5, 0, 22.5]],
};

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixPose = (a: [P3, P3], b: [P3, P3], t: number): [P3, P3] => [lerp3(a[0], b[0], t), lerp3(a[1], b[1], t)];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

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
type BoxFn = (c: number, w: number, h: number, d: number, x: number, y: number, z: number, parent?: THREE.Object3D) => THREE.Mesh;
function blocky(o: { top: number; legs: number; skin: number; hair: number; extra?: (body: THREE.Group, box: BoxFn) => void }): Rig {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const edgeM = new THREE.LineBasicMaterial({ color: 0x0f2b22, transparent: true, opacity: 0.55 });
  const box: BoxFn = (c, w, h, d, x, y, z, parent = body) => {
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
const makeFounder = () => blocky({ top: 0x2c3e5c, legs: 0x2a2f3a, skin: 0xc68e6a, hair: 0x231a14, extra: (_b, box) => {
  box(0xf2efe2, 0.14, 0.4, 0.02, 0, 1.24, 0.155); // shirt
  box(0x9aa3ad, 0.08, 0.42, 0.32, 0.42, 1.06, 0.02); // laptop under the arm
} });
const makeManager = () => blocky({ top: 0x3b7d7a, legs: 0x40434a, skin: 0x8d5f45, hair: 0x1a1410, extra: (_b, box) => {
  box(0x0f2b22, 0.3, 0.38, 0.03, 0.12, 1.0, 0.2); // tablet held in front
  box(0x35dc78, 0.24, 0.3, 0.01, 0.12, 1.0, 0.218);
} });
const makeDean = () => blocky({ top: 0x5a4632, legs: 0x3a3530, skin: 0xe0b898, hair: 0x9a9a9a, extra: (_b, box) => {
  box(0xf2efe2, 0.14, 0.4, 0.02, 0, 1.24, 0.155);
  box(0x1e4632, 0.05, 0.3, 0.025, 0, 1.22, 0.166); // tie
  box(0xc9a33a, 0.06, 0.36, 0.28, 0.4, 1.08, 0.02); // folder under the arm
} });
const makeProfessional = () => blocky({ top: 0xd8dde2, legs: 0x2f3b4c, skin: 0xa87b5c, hair: 0x3a2a1c, extra: (_b, box) => {
  box(0x1fa85a, 0.03, 0.34, 0.02, -0.07, 1.32, 0.156); // lanyard
  box(0x1fa85a, 0.03, 0.34, 0.02, 0.07, 1.32, 0.156);
  box(0xffffff, 0.14, 0.18, 0.02, 0, 1.08, 0.16); // badge
} });

/** The goals offered at the entrance, in the order shown. */
const GOALS: [PathId, string][] = [
  ['student', 'Start my career'],
  ['founder', 'Build a product or find a team'],
  ['hr', 'Upskill my workforce'],
  ['university', 'Build industry readiness at my university'],
  ['professional', 'Use AI in my profession'],
];

// ---- The story ----------------------------------------------------------------------
export class Story {
  audience: PathId | null = null;
  private path: StoryPath | null = null;
  private stops: StoryStop[] = [];
  private ctx: StoryCtx = { profession: -1 };
  private ask: { stop: number; k: number } | null = null;
  private mapOpen = false;
  private filter = '';
  private guide = makeGuide();
  private rigs: Record<PathId, Rig> = { student: makeStudent(), founder: makeFounder(), hr: makeManager(), university: makeDean(), professional: makeProfessional() };
  private you: Rig = this.rigs.student;
  private last: { g: P3; y: P3 } | null = null;
  private walkT = 0;
  private panel: HTMLElement;
  private shownKey = '';
  private visible = false;
  /** Stop the panel was last fully showing (so Next/Previous step from where the visitor is). */
  private at = 0;

  constructor(private host: StoryHost, private rooms: Record<RoomId, RoomDef>, private paths: Record<PathId, StoryPath>, private professions: Profession[]) {
    host.addWorld(this.guide.root);
    for (const r of Object.values(this.rigs)) { host.addWorld(r.root); r.root.visible = false; }
    this.guide.root.visible = false;
    this.panel = document.createElement('aside');
    this.panel.id = 'storyPanel';
    this.panel.setAttribute('aria-live', 'polite');
    this.panel.setAttribute('aria-label', 'Your EmpowerED guide');
    this.panel.hidden = true;
    (document.getElementById('hud') ?? document.body).appendChild(this.panel);
    this.panel.addEventListener('click', (e) => this.onClick(e));
    this.panel.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.matches('[data-search]')) { this.filter = t.value; this.paintProfessions(); }
    });
  }

  /** The Welcome stop only (before the visitor picks a goal). */
  entranceStops(): TourStop[] {
    this.audience = null;
    this.path = null;
    this.ask = null;
    this.mapOpen = false;
    this.stops = [];
    this.shownKey = '';
    return this.toStops();
  }

  private welcome(): StoryStop { return { room: 'entrance', title: 'Welcome', concern: '', guide: '' }; }
  private all(): StoryStop[] { return [this.welcome(), ...this.stops]; }

  private toStops(): TourStop[] {
    return this.all().map((s, i) => {
      const r = this.rooms[s.room];
      return { id: 'stop' + i, room: 'stop' + i, label: i ? s.title : 'Welcome', eyebrow: '', title: s.title, copy: '', hotspots: i ? r.hotspots : undefined, pose: () => SPOTS[s.room].cam };
    });
  }

  private pick(a: Audience) {
    if (a === 'explore') { this.host.explore(); return; }
    this.audience = a;
    this.path = this.paths[a];
    this.stops = this.path.stops;
    this.ask = null;
    this.mapOpen = false;
    this.you.root.visible = false;
    this.you = this.rigs[a];
    this.last = null;
    this.shownKey = '';
    this.host.onAudience(a);
    this.host.setStops(this.toStops(), 0);
  }

  /** Start a path directly (e.g. from the menu): goal chosen, waiting at Welcome. */
  choose(a: Audience) { this.pick(a); }

  /** Back to the goal question. */
  reset(): TourStop[] { this.host.onAudience(null); return this.entranceStops(); }

  /** Camera between stop i and i+1 at eased progress e. */
  camAt(i: number, e: number): [P3, P3] {
    const all = this.all();
    const a = all[i]?.room ?? 'entrance', b = all[i + 1]?.room ?? a;
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
    this.panel.hidden = true;
    this.shownKey = '';
  }

  /** Per frame while the story route is showing. */
  update(v: number, settled: boolean, dt: number) {
    const all = this.all();
    this.visible = true;
    this.guide.root.visible = this.you.root.visible = true;
    const n = all.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(v)));
    const f = v - i;
    const e = sm(0.08, 0.92, f);
    const a = all[i].room, b = all[Math.min(n - 1, i + 1)].room;
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
    const idx = Math.round(v);
    const cam = SPOTS[all[idx].room].cam[0];
    const arrived = settled && Math.abs(v - idx) < 0.03;
    const place = (rig: Rig, p: P3, other: P3, prev: P3 | undefined, speaking: boolean, pointing: boolean) => {
      rig.root.position.set(p[0], p[1], p[2]);
      let yaw: number;
      if (walking && prev && Math.hypot(p[0] - prev[0], p[2] - prev[2]) > 0.0005) yaw = Math.atan2(p[0] - prev[0], p[2] - prev[2]);
      else {
        const toOther = Math.atan2(other[0] - p[0], other[2] - p[2]), toCam = Math.atan2(cam[0] - p[0], cam[2] - p[2]);
        let d = toCam - toOther; d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw = toOther + d * 0.5;
      }
      const cur = rig.root.rotation.y;
      let dd = yaw - cur; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      rig.root.rotation.y = cur + dd * Math.min(1, dt * 8);
      const sw = walking ? Math.sin(this.walkT) * 0.5 : 0;
      rig.legs[0].rotation.x = sw; rig.legs[1].rotation.x = -sw;
      rig.arms[0].rotation.x = -sw * 0.7;
      rig.arms[1].rotation.x = pointing ? -1.35 : sw * 0.7;
      rig.arms[1].rotation.z = pointing ? 0.25 : 0;
      rig.body.position.y = walking ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0;
      rig.head.rotation.x = speaking && !walking ? Math.sin(performance.now() / 160) * 0.06 : 0;
    };
    const hasDetail = idx > 0 && !!(all[idx].show || this.rooms[all[idx].room].hotspots?.length);
    place(this.guide, g, y, this.last?.g, arrived, arrived && hasDetail);
    place(this.you, y, g, this.last?.y, false, false);
    this.last = { g, y };
    this.paint(idx, v, arrived);
  }

  // ---- The guide panel ----------------------------------------------------------------
  private txt(t: Txt | undefined): string { return t === undefined ? '' : typeof t === 'function' ? t(this.ctx) : t; }
  private asksAt(s: StoryStop): Ask[] { return typeof s.asks === 'function' ? s.asks(this.ctx) : s.asks ?? []; }

  private paint(idx: number, v: number, arrived: boolean) {
    const detail = this.host.detailOpen();
    // Opening a detail hides the guide; closing it brings back the same stop.
    this.panel.hidden = detail;
    if (detail) return;
    const moving = !arrived && Math.abs(v - idx) > 0.04;
    if (!moving) this.at = idx;
    const key = moving ? 'walk' + Math.floor(v) + '>' + (Math.floor(v) + 1) : 'stop' + idx + '|' + (this.ask?.stop === idx ? this.ask.k : -1) + '|' + this.mapOpen + '|' + this.ctx.profession + '|' + (this.audience ?? '');
    this.panel.classList.toggle('moving', moving);
    if (key === this.shownKey) return;
    this.shownKey = key;
    const all = this.all();
    if (moving) {
      // On the way: say why the next room matters; the explanation appears after arrival.
      const from = all[Math.floor(v)], to = all[Math.min(all.length - 1, Math.floor(v) + 1)];
      const line = v > (this.at ?? 0) ? from.bridge ?? '' : '';
      this.panel.innerHTML = `<div class="spTop"><span class="spEye">On the way to ${esc(to.title)}</span></div>` +
        `<p class="spGuide"><small>Your EmpowerED guide</small>${esc(line || 'Follow me.')}</p>`;
      return;
    }
    this.panel.innerHTML = idx === 0 ? this.welcomeHtml() : this.stopHtml(idx);
    if (idx > 0 && all[idx].pick === 'profession') this.paintProfessions();
  }

  private topHtml(eye: string): string {
    const map = this.audience ? `<button type="button" class="spLink" data-act="map" aria-expanded="${this.mapOpen}">Tour map</button>` : '';
    return `<div class="spTop"><span class="spEye">${esc(eye)}</span><span class="spCtl">${map}<button type="button" class="spLink" data-act="exit">Exit tour</button></span></div>` +
      (this.mapOpen && this.audience ? this.mapHtml() : '');
  }

  private mapHtml(): string {
    const all = this.all();
    return `<ol class="spMap">${all.map((s, i) => `<li><button type="button" data-go="${i}"${i === this.at ? ' aria-current="step"' : ''}>${i ? `<b>${i}</b>` : ''}${esc(i ? s.title : 'Welcome')}</button></li>`).join('')}</ol>`;
  }

  private welcomeHtml(): string {
    if (!this.audience || !this.path) {
      return this.topHtml('Welcome') +
        `<p class="spGuide"><small>Your EmpowerED guide</small>Hi, I'm your EmpowerED guide. What would you like help with?</p>` +
        `<div class="spGoals" role="group" aria-label="Choose your goal">${GOALS.map(([k, t]) => `<button type="button" data-goal="${k}">${esc(t)}</button>`).join('')}</div>` +
        `<button type="button" class="spLink spFree" data-goal="explore">Explore freely instead</button>`;
    }
    const first = this.stops[0];
    return this.topHtml('Welcome · ' + this.path.goal) +
      `<p class="spYou"><small>You</small>${esc(this.path.goal)}.</p>` +
      `<p class="spGuide"><small>Your EmpowerED guide</small>I'll show you how we help with that, what the process produces and how to start. It takes ${this.stops.length} stops.</p>` +
      `<div class="spNav"><button type="button" class="spLink" data-act="goal">Change my goal</button><button type="button" class="spNext" data-go="1">Next to ${esc(first.go ?? first.title)} <span aria-hidden="true">→</span></button></div>`;
  }

  private stopHtml(idx: number): string {
    const all = this.all(), s = all[idx], n = this.stops.length, last = idx === n;
    const asks = this.asksAt(s);
    const picked = this.ask?.stop === idx ? asks[this.ask.k] : undefined;
    const you = picked ? this.txt(picked.q) : this.txt(s.concern);
    const said = picked ? this.txt(picked.a) : this.txt(s.guide);
    let h = this.topHtml(`${s.title} · Stop ${idx} of ${n}`);
    h += `<p class="spYou"><small>You</small>${esc(you)}</p><p class="spGuide"><small>Your EmpowerED guide</small>${esc(said)}</p>`;
    if (picked) h += `<button type="button" class="spLink" data-act="unask">Back to ${esc(s.title)}</button>`;
    if (s.pick === 'profession') h += `<div class="spPick"><label class="spSearch"><span>Find your profession</span><input type="search" data-search placeholder="Search professions" value="${esc(this.filter)}" autocomplete="off"></label><div class="spProfs" role="group" aria-label="Professions"></div></div>`;
    if (s.show) h += `<button type="button" class="spShow" data-act="show">${esc(this.txt(s.show.label))} <span aria-hidden="true">↗</span></button>`;
    if (asks.length) {
      h += `<details class="spAsk"${picked ? ' open' : ''}><summary>Ask your guide</summary><div>` +
        asks.map((q, k) => `<button type="button" data-ask="${k}"${picked === q ? ' aria-pressed="true"' : ''}>${esc(this.txt(q.q))}</button>`).join('') + '</div></details>';
    }
    const prev = all[idx - 1];
    const back = `<button type="button" class="spLink" data-go="${idx - 1}"><span aria-hidden="true">←</span> ${esc(idx - 1 ? prev.title : 'Welcome')}</button>`;
    if (!last) {
      const nx = all[idx + 1];
      h += `<div class="spNav">${back}<button type="button" class="spNext" data-go="${idx + 1}">Next to ${esc(nx.go ?? nx.title)} <span aria-hidden="true">→</span></button></div>`;
    } else if (this.path) {
      h += `<div class="spEnd"><button type="button" class="spNext" data-end="-1">${esc(this.path.primary.label)} <span aria-hidden="true">↗</span></button>` +
        (this.path.more ?? []).map((m, k) => `<button type="button" class="spAlt" data-end="${k}">${esc(m.label)}</button>`).join('') + '</div>' +
        `<div class="spNav">${back}<span class="spCtl"><button type="button" class="spLink" data-act="goal">Change my goal</button><button type="button" class="spLink" data-act="exit">Explore freely</button></span></div>`;
    }
    return h;
  }

  private paintProfessions() {
    const box = this.panel.querySelector('.spProfs');
    if (!box) return;
    const f = this.filter.trim().toLowerCase();
    const list = this.professions.map((p, i) => [p, i] as const).filter(([p]) => !f || p.name.toLowerCase().includes(f));
    box.innerHTML = list.length
      ? list.map(([p, i]) => `<button type="button" data-prof="${i}"${i === this.ctx.profession ? ' aria-pressed="true"' : ''}>${esc(p.name)}</button>`).join('')
      : '<p class="spNone">No match yet. Choose the closest, or ask us about your profession at the last stop.</p>';
  }

  private onClick(e: Event) {
    const b = (e.target as Element).closest<HTMLElement>('button,summary');
    if (!b || !this.panel.contains(b)) return;
    const d = b.dataset;
    if (d.goal) { this.pick(d.goal as Audience); return; }
    if (d.go !== undefined) { this.ask = null; this.mapOpen = false; this.shownKey = ''; this.host.travel(+d.go); return; }
    if (d.ask !== undefined) { this.ask = { stop: this.at, k: +d.ask }; this.shownKey = ''; return; }
    if (d.prof !== undefined) { this.ctx.profession = +d.prof; this.shownKey = ''; return; }
    if (d.end !== undefined && this.path) { const a = +d.end < 0 ? this.path.primary : this.path.more?.[+d.end]; a?.run(this.ctx); return; }
    switch (d.act) {
      case 'unask': this.ask = null; this.shownKey = ''; break;
      case 'map': this.mapOpen = !this.mapOpen; this.shownKey = ''; break;
      case 'exit': this.host.explore(); break;
      case 'goal': this.host.setStops(this.reset(), 0); break;
      case 'show': { const s = this.all()[this.at]; if (s?.show) this.host.open(s.show.open, this.ctx); break; }
    }
  }

  /** Profession the professional route is following (first complete one until the visitor picks). */
  profession(): Profession { return this.professions[Math.max(0, this.ctx.profession)]; }
  get context(): StoryCtx { return this.ctx; }
  /** Room of stop i (for the scene highlights). */
  roomAt(i: number): RoomId { return this.all()[i]?.room ?? 'entrance'; }
  /** Stop index the visitor last arrived at. */
  get stopIndex(): number { return this.at; }
}
