// Story mode: a guided tour through the company, one stop per room. A gold-suited EmpowerED
// guide walks the visitor's own blocky character (picked by "What would you like help with?")
// from room to room. After the goal, "Your route" previews what changes and the five stops;
// then at each stop one guide panel recognises the visitor's concern, gives the EmpowerED
// answer, stands beside an illustrative example board in the room, offers optional questions
// and names the next room. Scroll or the named Next button moves one room.
import * as THREE from 'three';
import type { P3, ScreenPoint } from '../bridge';
import type { TourHotspot, TourStop } from '../company/tour';
import { board, flow } from './exhibits';

export type RoomId = 'entrance' | 'preview' | 'intake' | 'develop' | 'engineer' | 'delivery' | 'verify' | 'deploy' | 'dock' | 'talent' | 'teams' | 'apply' | 'campus' | 'scope' | 'plaza' | 'pTask' | 'pDemo' | 'pPath' | 'pNext';
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
  /** The whole Next button label, when "Next to …" would suggest a move that isn't one. */
  nextLabel?: string;
  /** The visitor's concern, in their words. */
  concern: Txt;
  /** The guide's answer. */
  guide: Txt;
  /** Illustrative example board (HTML) the guide stands beside. */
  exhibit?: (c: StoryCtx) => string;
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
  /** "Your route": what changes for the visitor, and one line per stop on what they'll discover. */
  preview: { from: string; to: string; lines: string[] };
  stops: StoryStop[];
  primary: EndAction;
  more?: EndAction[];
}
export interface RoomDef {
  label: string;
  hotspots?: TourHotspot[];
}
/** An example board placed in the 3D scene. */
export interface Board { place(at: P3, face: P3, width: number): void; show(on: boolean): void }
export interface StoryHost {
  project(x: number, y: number, z: number): ScreenPoint;
  addWorld(o: THREE.Object3D): void;
  /** A board in the scene for this element, or null until the scene exists. */
  board(el: HTMLElement): Board | null;
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
  /** The visitor picked a journey in the lobby before choosing a route (keeps the address bar in step). */
  journey(j: Journey | null): void;
  /** Government and regional visitors go to the Ecosystem bay. */
  region(): void;
  /** Camera field of view in degrees (for placing boards on screen). */
  fov(): number;
  /** Reduced motion (rooms change with a short fade instead of a walk). */
  reduced(): boolean;
  setReduced(on: boolean): void;
}
/** A profession the professional route can use (complete copy only). */
export interface Profession { name: string; line: string; uses: string[] }

// ---- Where things happen ----------------------------------------------------------
interface Spot { guide: P3; you: P3; cam: [P3, P3]; /** On wide screens, where the pair sits across the screen (-1 left … 1 right). */ aim?: number }
const SPOTS: Record<RoomId, Spot> = {
  // Out on the plaza, with the glowing entrance icons and the HQ behind the characters.
  // The lobby on the plaza, under the Career, Workforce and AI for Everyone icons.
  entrance: { guide: [-1.6, 0, 25], you: [1.6, 0, 27.5], cam: [[3.5, 4.2, 41], [-0.5, 4.8, 10]], aim: 0.24 },
  // "Your route": closer to the entrance, the building still in view.
  preview: { guide: [-1, 0, 10], you: [1.6, 0, 11.2], cam: [[3, 3.2, 20], [-0.5, 4, -2]] },
  intake: { guide: [6.5, 0, -9], you: [4.1, 0, -7.1], cam: [[-0.8, 3.4, 2.6], [6.4, 1.9, -11]] },
  develop: { guide: [-9.5, 6, -37.6], you: [-6.6, 6, -36], cam: [[-3.2, 8.8, -27.4], [-9, 7.4, -42]] },
  engineer: { guide: [13.6, 0, -25.6], you: [16.5, 0, -24.4], cam: [[21.6, 3.6, -17.4], [13.4, 1.6, -31]] },
  // Further along the POD floor, by the six stage boards.
  delivery: { guide: [2.2, 0, -25.6], you: [4.4, 0, -26.2], cam: [[7.5, 3.8, -15.5], [0, 1.4, -32]] },
  verify: { guide: [18.6, 6, -38.6], you: [21.5, 6, -37.3], cam: [[24.6, 8.8, -29.4], [20, 7.6, -44]] },
  deploy: { guide: [-1.6, 0, -77], you: [1.6, 0, -78.4], cam: [[4.5, 3.8, -91], [0, 4.2, -68]] },
  // Outside the east wall, by the five workforce bays.
  dock: { guide: [39, 0, -12], you: [41.4, 0, -14.4], cam: [[50, 4, -4], [35, 2, -15]] },
  // Just inside the east wall, at the verified talent shelf.
  talent: { guide: [22.2, 0, -3.4], you: [23.5, 0, -4.9], cam: [[29, 3.8, 1.5], [20.5, 1.6, -7.5]] },
  // West side of the ground floor, at the open front of the reskilling line.
  teams: { guide: [-25, 0, -2.2], you: [-23.4, 0, -2.7], cam: [[-21.5, 3.6, 5.5], [-24.5, 1.6, -10]] },
  // Inside the reskilling line, beside the Apply station.
  apply: { guide: [-22.2, 0, -9.4], you: [-20.4, 0, -11.2], cam: [[-19.8, 3, -2.4], [-25, 1.4, -13]] },
  // Outside the west wall, where the campus extension slides in.
  campus: { guide: [-41, 0, -8], you: [-38.6, 0, -9.8], cam: [[-31, 4.6, 2], [-48, 2.4, -18]] },
  // Closer to the campus blocks.
  scope: { guide: [-42, 0, -10.2], you: [-40, 0, -12], cam: [[-36, 4, -5], [-52, 2.4, -22]] },
  // Five stations around the "AI for Everyone" icon on the plaza.
  plaza: { guide: [5, 0, 22.5], you: [7, 0, 23.6], cam: [[0.5, 3.2, 33], [7, 4.4, 17]] },
  pTask: { guide: [9.5, 0, 20.5], you: [11.3, 0, 21.6], cam: [[6, 3, 29.5], [12, 3, 15]] },
  pDemo: { guide: [13, 0, 17], you: [14.7, 0, 18.2], cam: [[9, 3, 26], [16, 2.6, 11]] },
  pPath: { guide: [1, 0, 19], you: [2.8, 0, 20.1], cam: [[-3, 3.2, 28.5], [3, 3.6, 12]] },
  pNext: { guide: [-2, 0, 23], you: [0, 0, 24], cam: [[3, 3.4, 33], [0, 4.4, 14]] },
};
/** Camera field of view (degrees), kept current by the story for screen-space framing. */
let FOV = 50;
/**
 * A spot's camera. On wide screens it is turned so the two characters stand between the guide
 * panel (left) and the example board (right): their midpoint lands just right of screen centre.
 */
const camOf = (room: RoomId): [P3, P3] => {
  const { cam: [c, l], guide: g, you: y, aim } = SPOTS[room];
  if (innerWidth <= 760) {
    // Phones: the panel docks at the bottom, so face the pair and look a little below them;
    // they appear in the upper part of the screen, above the panel.
    const mx = (g[0] + y[0]) / 2 - c[0], my = Math.max(g[1], y[1]) + 1 - c[1], mz = (g[2] + y[2]) / 2 - c[2];
    const h = Math.hypot(mx, mz) || 1, yaw = Math.atan2(mx, mz);
    const pitch = Math.atan2(my, h) - Math.atan(0.42 * Math.tan((FOV * Math.PI) / 360));
    return [c, [c[0] + Math.sin(yaw) * h, c[1] + Math.tan(pitch) * h, c[2] + Math.cos(yaw) * h]];
  }
  const mx = (g[0] + y[0]) / 2 - c[0], mz = (g[2] + y[2]) / 2 - c[2];
  const t = Math.tan((FOV * Math.PI) / 360) * (innerWidth / Math.max(1, innerHeight));
  const yaw = Math.atan2(mx, mz) + Math.atan((aim ?? 0.04) * t), hd = Math.hypot(l[0] - c[0], l[2] - c[2]);
  return [c, [c[0] + Math.sin(yaw) * hd, l[1], c[2] + Math.cos(yaw) * hd]];
};
const UP_STAIRS: P3[] = [[0, 0, -5.6], [0, 6, -22], [8, 6, -26], [16, 6, -32], [18.6, 6, -38.6]];
/** Walking routes between rooms (guide spot to guide spot), up and down the atrium stairs. */
const PATHS: Record<string, P3[]> = {
  'entrance>preview': [[-1.6, 0, 25], [-1.2, 0, 16], [-1, 0, 10]],
  'preview>dock': [[-1, 0, 10], [12, 0, 12], [28, 0, 12], [40, 0, 4], [42, 0, -6], [39, 0, -12]],
  'preview>campus': [[-1, 0, 10], [-14, 0, 13], [-34, 0, 12], [-42, 0, 0], [-41, 0, -8]],
  'preview>plaza': [[-1, 0, 10], [1, 0, 16], [5, 0, 22.5]],
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
  'entrance>plaza': [[-1.6, 0, 25], [2, 0, 24], [5, 0, 22.5]],
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
  let pts = PATHS[k] ?? (PATHS[b + '>' + a] ? [...PATHS[b + '>' + a]].reverse() : null);
  // From "Your route", walk on along the entrance path toward the first room.
  if (!pts && a === 'preview' && PATHS['entrance>' + b]) {
    const rest = PATHS['entrance>' + b].filter((p) => p[2] < SPOTS.preview.guide[2] - 0.5);
    pts = [SPOTS.preview.guide, ...rest];
  }
  return pts && pts.length > 1 ? (PATH_CACHE[k] = new Path(pts)) : null;
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

/** The three journeys offered in the lobby, in the order shown. */
export type Journey = 'career' | 'workforce' | 'ai';
const JOURNEYS: [Journey, string, string][] = [
  ['career', 'Build my career', 'Find out what you’re capable of'],
  ['workforce', 'Build my workforce', 'Talent, teams, campuses and product PODs'],
  ['ai', 'AI for everyone', 'What AI means for the work you already do'],
];
/** Who a workforce visitor is building for: a guided route, or the region bay for government. */
const WORKFORCE_FOR: [PathId | 'region', string][] = [
  ['hr', 'My company’s teams'],
  ['university', 'A university or college'],
  ['founder', 'A product or startup'],
  ['region', 'Government or a region'],
];
const JOURNEY_OF: Record<PathId, Journey> = { student: 'career', founder: 'workforce', hr: 'workforce', university: 'workforce', professional: 'ai' };

/** The site path (relative to the base) for a guided stop, so the address bar follows the tour. */
export function storyPath(a: PathId | null, i: number, room: RoomId): string {
  if (!a || i === 0) return '';
  if (a === 'professional') return 'ai-for-everyone/';
  if (a === 'student') {
    if (i === 1) return 'career/';
    return ({ intake: 'career/assessment/', develop: 'career/launch/', engineer: 'career/accelerate/', verify: 'career/assurance/', deploy: 'career/opportunities/' } as Partial<Record<RoomId, string>>)[room] ?? 'career/';
  }
  if (i === 1) return 'workforce/';
  return ({ talent: 'workforce/verified-talent/', engineer: 'workforce/product-engineering/', delivery: 'workforce/product-engineering/', teams: 'workforce/capability/', apply: 'workforce/capability/', intake: 'workforce/capability/', campus: 'workforce/campus/', scope: 'workforce/campus/' } as Partial<Record<RoomId, string>>)[room] ?? 'workforce/';
}
/** The lobby: where the opening ends (guide spot and the camera the tour will use there). */
export const lobbyPose = () => ({ guide: SPOTS.entrance.guide, cam: camOf('entrance') });

/** Progress kept for this browser tab, so a replay, reload or the standard page can return to it. */
const SAVE_KEY = 'ee-story';
interface Saved { a: PathId; i: number; p: number }
const loadSaved = (): Saved | null => { try { const s = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null'); return s && s.a ? s : null; } catch { return null; } };

// ---- The story ----------------------------------------------------------------------
export class Story {
  audience: PathId | null = null;
  private path: StoryPath | null = null;
  private stops: StoryStop[] = [];
  private ctx: StoryCtx = { profession: -1 };
  private ask: { stop: number; k: number } | null = null;
  private mapOpen = false;
  /** The lobby is asking a workforce visitor who they're building for. */
  private wfAsk = false;
  private filter = '';
  private guide = makeGuide();
  private rigs: Record<PathId, Rig> = { student: makeStudent(), founder: makeFounder(), hr: makeManager(), university: makeDean(), professional: makeProfessional() };
  private you: Rig = this.rigs.student;
  private last: { g: P3; y: P3 } | null = null;
  private walkT = 0;
  private panel: HTMLElement;
  private fade: HTMLElement;
  private boardEl: HTMLElement;
  private board: Board | null = null;
  private boardKey = '';
  private shownKey = '';
  private visible = false;
  /** Keyboard focus was in the panel when it last re-rendered, so it goes back to the Next button. */
  private keepFocus = false;
  /** Where focus goes after a re-render the visitor caused (the control they used). */
  private focusSel = '';
  private lastIdx = -1;
  private saved: Saved | null = loadSaved();
  /** Stop the panel was last fully showing (so Next/Previous step from where the visitor is). */
  private at = 0;

  constructor(private host: StoryHost, private rooms: Record<RoomId, RoomDef>, private paths: Record<PathId, StoryPath>, private professions: Profession[]) {
    host.addWorld(this.guide.root);
    for (const r of Object.values(this.rigs)) { host.addWorld(r.root); r.root.visible = false; }
    this.guide.root.visible = false;
    const hud = document.getElementById('hud') ?? document.body;
    this.panel = document.createElement('aside');
    this.panel.id = 'storyPanel';
    this.panel.setAttribute('aria-live', 'polite');
    this.panel.setAttribute('aria-label', 'Your EmpowerED guide');
    this.panel.hidden = true;
    // Contain gestures in the readable panel, including at its scroll boundaries.
    this.panel.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    this.panel.addEventListener('touchmove', (event) => event.stopPropagation(), { passive: true });
    this.fade = document.createElement('div');
    this.fade.id = 'storyFade';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'sx';
    hud.append(this.fade, this.panel);
    this.panel.addEventListener('click', (e) => this.onClick(e));
    // Development builds expose the story for layout checks.
    if (import.meta.env.DEV) (window as unknown as { __story: Story }).__story = this;
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
    this.wfAsk = false;
    this.stops = [];
    this.shownKey = '';
    return this.toStops();
  }

  private welcome(): StoryStop { return { room: 'entrance', title: 'Welcome', concern: '', guide: '' }; }
  private previewStop(): StoryStop {
    const p = this.path!;
    return { room: 'preview', title: 'Your route', concern: '', guide: '', exhibit: () => board('What changes for you', flow([['Today', p.preview.from], ['Through EmpowerED', p.preview.to]])) };
  }
  private all(): StoryStop[] { return this.path ? [this.welcome(), this.previewStop(), ...this.stops] : [this.welcome()]; }

  private toStops(): TourStop[] {
    return this.all().map((s, i) => {
      const r = this.rooms[s.room];
      return { id: 'stop' + i, room: 'stop' + i, label: s.title, eyebrow: '', title: s.title, copy: '', hotspots: i > 1 ? r.hotspots : undefined, pose: () => camOf(s.room) };
    });
  }

  /** Choose a goal. A new choice walks on to "Your route"; a resumed one returns to its stop. */
  private pick(a: Audience, resume?: Saved) {
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
    if (resume) this.ctx.profession = resume.p;
    this.host.onAudience(a);
    const n = this.all().length;
    this.host.setStops(this.toStops(), resume ? Math.min(n - 1, resume.i) : 0);
    if (!resume) this.host.travel(1);
    this.save(resume ? resume.i : 0);
  }

  private save(i: number) {
    if (!this.audience) return;
    this.saved = { a: this.audience, i, p: this.ctx.profession };
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(this.saved)); } catch { /* storage blocked */ }
  }

  /** Start a path directly (e.g. from the menu). */
  choose(a: Audience) { this.pick(a); }

  /** Start a route at stop i directly (a deep link such as /career/assurance/). */
  chooseAt(a: PathId, i: number) { this.pick(a, { a, i, p: this.ctx.profession }); }

  /** A lobby journey: Career and AI start their guided routes; Workforce asks who it's for. */
  chooseJourney(j: Journey) {
    if (j === 'career') { this.pick('student'); return; }
    if (j === 'ai') { this.pick('professional'); return; }
    this.askWorkforce();
  }

  /** Show the lobby's workforce question (also used by /workforce/). */
  askWorkforce() {
    this.wfAsk = true;
    this.shownKey = '';
    this.keepFocus = true;
    this.host.journey('workforce');
  }

  /** The journey a route belongs to. */
  journeyOf(a: PathId): Journey { return JOURNEY_OF[a]; }

  /** Site path for stop i of the current route (the address bar follows the tour). */
  pathAt(i: number): string {
    if (!this.audience) return this.wfAsk ? 'workforce/' : '';
    return storyPath(this.audience, i, this.roomAt(i));
  }

  /** Saved progress for this tab, and the path it was at (to resume it on reload). */
  savedState(): { saved: { a: PathId; i: number; p: number }; path: string } | null {
    const sv = this.saved;
    if (!sv) return null;
    const rooms: RoomId[] = ['entrance', 'preview', ...this.paths[sv.a].stops.map((x) => x.room)];
    return { saved: sv, path: storyPath(sv.a, sv.i, rooms[sv.i] ?? 'entrance') };
  }

  /** Resume this tab's saved route and stop (and profession). */
  resumeSaved() { if (this.saved) this.pick(this.saved.a, this.saved); }

  /** The stop on the current route whose path matches, nearest to `from` (preferring earlier stops), or -1. */
  indexNear(path: string, from: number): number {
    const n = this.all().length;
    for (let d = 0; d < n; d++) {
      for (const k of [from - d, from + d]) if (k >= 0 && k < n && this.pathAt(k) === path) return k;
    }
    return -1;
  }

  /** The stop index of a room on a route (first match). */
  indexOfRoom(a: PathId, room: RoomId): number {
    const k = this.paths[a].stops.findIndex((x) => x.room === room);
    return k < 0 ? 1 : k + 2;
  }

  /** Back to the goal question. */
  reset(): TourStop[] { this.host.onAudience(null); return this.entranceStops(); }

  /** Camera between stop i and i+1 at eased progress e. */
  camAt(i: number, e: number): [P3, P3] {
    const all = this.all();
    const a = all[i]?.room ?? 'entrance', b = all[i + 1]?.room ?? a;
    if (a === b) return camOf(a);
    const path = pathFor(a, b);
    if (!path) return mixPose(camOf(a), camOf(b), e);
    const { p, dir } = path.at(e * path.length);
    const follow: [P3, P3] = [[p[0] - dir[0] * 6.5, p[1] + 3.3, p[2] - dir[2] * 6.5], [p[0] + dir[0] * 5, p[1] + 1.4, p[2] + dir[2] * 5]];
    return mixPose(mixPose(camOf(a), follow, sm(0, 0.22, e)), camOf(b), sm(0.78, 1, e));
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.guide.root.visible = this.you.root.visible = false;
    this.panel.hidden = true;
    this.board?.show(false);
    this.boardKey = '';
    this.shownKey = '';
  }

  /** Per frame while the story route is showing. */
  update(v: number, settled: boolean, dt: number) {
    FOV = this.host.fov();
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
    // Reduced motion: the room changes at once, behind a short fade.
    if (idx !== this.lastIdx) {
      if (this.lastIdx >= 0 && this.host.reduced()) { this.fade.classList.remove('go'); void this.fade.offsetWidth; this.fade.classList.add('go'); }
      this.lastIdx = idx;
    }
    const hasBoard = !!all[idx].exhibit;
    this.pose(this.guide, g, y, this.last?.g, cam, walking, dt, arrived, arrived && hasBoard && idx > 0, 0);
    this.pose(this.you, y, g, this.last?.y, cam, walking, dt, false, false, 0);
    this.last = { g, y };
    this.paint(idx, v, arrived);
    this.paintBoard(idx, arrived);
  }

  /** Place and animate one character: walk when moving, otherwise face the other (turned a little to the camera). */
  private pose(rig: Rig, p: P3, other: P3, prev: P3 | undefined, cam: P3, walking: boolean, dt: number, speaking: boolean, pointing: boolean, wave: number) {
    rig.root.position.set(p[0], p[1], p[2]);
    let yaw: number;
    if (walking && prev && Math.hypot(p[0] - prev[0], p[2] - prev[2]) > 0.0005) yaw = Math.atan2(p[0] - prev[0], p[2] - prev[2]);
    else {
      const toOther = Math.atan2(other[0] - p[0], other[2] - p[2]), toCam = Math.atan2(cam[0] - p[0], cam[2] - p[2]);
      let d = toCam - toOther; d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw = toOther + d * (wave ? 0.85 : 0.5);
    }
    const cur = rig.root.rotation.y;
    let dd = yaw - cur; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    rig.root.rotation.y = this.host.reduced() ? yaw : cur + dd * Math.min(1, dt * 8);
    const sw = walking ? Math.sin(this.walkT) * 0.5 : 0;
    rig.legs[0].rotation.x = sw; rig.legs[1].rotation.x = -sw;
    rig.arms[0].rotation.x = -sw * 0.7;
    if (wave > 0) {
      // A friendly wave: arm up, hand swinging side to side, then back down.
      const up = Math.sin(Math.min(1, wave) * Math.PI);
      rig.arms[1].rotation.x = -2.7 * Math.min(1, up * 1.6);
      rig.arms[1].rotation.z = 0.25 + Math.sin(performance.now() / 120) * 0.35 * up;
    } else {
      rig.arms[1].rotation.x = pointing ? -1.35 : sw * 0.7;
      rig.arms[1].rotation.z = pointing ? 0.25 : 0;
    }
    rig.body.position.y = walking ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0;
    rig.head.rotation.x = speaking && !walking ? Math.sin(performance.now() / 160) * 0.06 : 0;
  }

  /** During the opening: the guide comes out through the doors and waves; the visitor waits in the lobby. */
  openingPose(o: { guide: P3; walking: boolean; wave: number; guideVisible: boolean }, cam: P3, dt: number) {
    this.panel.hidden = true;
    this.board?.show(false);
    this.boardKey = '';
    this.shownKey = '';
    this.visible = true;
    const y = SPOTS.entrance.you;
    if (o.walking) this.walkT += dt * 9;
    this.guide.root.visible = o.guideVisible;
    this.you.root.visible = true;
    this.pose(this.guide, o.guide, y, this.last?.g, cam, o.walking, dt, false, false, o.wave);
    this.pose(this.you, y, o.guide, undefined, cam, false, dt, false, false, 0);
    this.last = { g: o.guide, y };
  }

  /** The example board stands beside the characters, to the right as the camera sees them. */
  private paintBoard(idx: number, arrived: boolean) {
    const s = this.all()[idx];
    const narrow = innerWidth <= 760;
    const on = arrived && !!s?.exhibit && !narrow && !this.host.detailOpen();
    if (on && !this.board) this.board = this.host.board(this.boardEl);
    if (!this.board) return;
    if (!on) { if (this.boardKey) { this.board.show(false); this.boardKey = ''; } return; }
    const key = idx + '|' + this.ctx.profession + '|' + (this.audience ?? '');
    if (key === this.boardKey) return;
    this.boardKey = key;
    this.boardEl.innerHTML = s.exhibit!(this.ctx);
    // Place the board by where it sits on screen (right of the characters, about 30% of the width),
    // at a depth in front of them, square to the view. The same framing works in every room.
    const sp = SPOTS[s.room], [c, l] = camOf(s.room);
    const len = (v: P3) => Math.hypot(v[0], v[1], v[2]) || 1;
    const fv: P3 = [l[0] - c[0], l[1] - c[1], l[2] - c[2]], fL = len(fv), F: P3 = [fv[0] / fL, fv[1] / fL, fv[2] / fL];
    const rv: P3 = [-F[2], 0, F[0]], rL = len(rv), Rt: P3 = [rv[0] / rL, 0, rv[2] / rL];
    const U: P3 = [Rt[1] * F[2] - Rt[2] * F[1], Rt[2] * F[0] - Rt[0] * F[2], Rt[0] * F[1] - Rt[1] * F[0]];
    const mid: P3 = [(sp.guide[0] + sp.you[0]) / 2, Math.max(sp.guide[1], sp.you[1]) + 1, (sp.guide[2] + sp.you[2]) / 2];
    const D = Math.min(9, Math.max(3.5, 0.75 * len([mid[0] - c[0], mid[1] - c[1], mid[2] - c[2]])));
    const halfH = D * Math.tan((this.host.fov() * Math.PI) / 360), halfW = halfH * (innerWidth / Math.max(1, innerHeight));
    const at: P3 = [0, 1, 2].map((k) => c[k] + F[k] * D + Rt[k] * halfW * 0.56 + U[k] * halfH * 0.14) as P3;
    this.board.place(at, [at[0] - F[0], at[1] - F[1], at[2] - F[2]], halfW * 2 * 0.3);
    this.boardEl.classList.remove('in');
    this.board.show(true);
    if (this.host.reduced()) this.boardEl.classList.add('in', 'still');
    else { this.boardEl.classList.remove('still'); requestAnimationFrame(() => this.boardEl.classList.add('in')); }
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
    const changedStop = !moving && this.at !== idx;
    if (!moving && this.at !== idx) { this.at = idx; this.save(idx); }
    const key = moving ? 'walk' + Math.floor(v) + '>' + (Math.floor(v) + 1) : 'stop' + idx + '|' + (this.ask?.stop === idx ? this.ask.k : -1) + '|' + this.mapOpen + '|' + this.wfAsk + '|' + this.ctx.profession + '|' + (this.audience ?? '') + '|' + this.host.reduced() + '|' + (innerWidth <= 760);
    this.panel.classList.toggle('moving', moving);
    if (key === this.shownKey) return;
    this.shownKey = key;
    // Keep keyboard focus with the panel while it re-renders.
    if (this.panel.contains(document.activeElement)) this.keepFocus = true;
    const all = this.all();
    if (moving) {
      // On the way: say why the next room matters; the explanation appears after arrival.
      const back = Math.max(0, Math.floor(v)), forward = Math.min(all.length - 1, back + 1);
      const from = all[back], to = all[v < this.at ? back : forward];
      const line = v > (this.at ?? 0) ? from.bridge ?? '' : '';
      this.panel.innerHTML = this.topHtml(`On the way to ${to.title}`) +
        `<p class="spGuide"><small>Your EmpowerED guide</small>${esc(line || 'Follow me.')}</p>` +
        `<div class="spNav"><button type="button" class="spLink" data-go="${back}">Back to ${esc(all[back].title)}</button><button type="button" class="spNext" data-go="${forward}">Continue to ${esc(all[forward].title)} →</button></div>`;
      this.panel.tabIndex = -1;
      if (this.keepFocus) this.panel.focus({ preventScroll: true });
      return;
    }
    this.panel.removeAttribute('tabindex');
    this.panel.innerHTML = idx === 0 ? this.welcomeHtml() : idx === 1 ? this.previewHtml() : this.stopHtml(idx);
    if (changedStop) this.panel.scrollTop = 0;
    if (all[idx]?.pick === 'profession') this.paintProfessions();
    if (this.keepFocus) {
      this.keepFocus = false;
      const to = [this.focusSel, '.spNext', '.spGoals button', 'button'].filter(Boolean).map((q) => this.panel.querySelector<HTMLElement>(q)).find(Boolean);
      to?.focus({ preventScroll: true });
      this.focusSel = '';
    }
  }

  private topHtml(eye: string): string {
    const map = this.audience ? `<button type="button" class="spLink" data-act="map" aria-expanded="${this.mapOpen}">Tour map</button>` : '';
    const motion = `<button type="button" class="spLink" data-act="motion" aria-pressed="${this.host.reduced()}">Reduce motion</button>`;
    return `<div class="spTop"><span class="spEye">${esc(eye)}</span><span class="spCtl">${map}${motion}<button type="button" class="spLink" data-act="exit">Exit tour</button></span></div>` +
      (this.mapOpen && this.audience ? this.mapHtml() : '');
  }

  private mapHtml(): string {
    return `<ol class="spMap">${this.all().map((s, i) => `<li><button type="button" data-go="${i}"${i === this.at ? ' aria-current="step"' : ''}>${i > 1 ? `<b>${i - 1}</b>` : ''}${esc(s.title)}</button></li>`).join('')}</ol>`;
  }

  /** The example board, inside the panel on phones. */
  private inlineBoard(s: StoryStop): string {
    return s.exhibit && innerWidth <= 760 ? `<div class="sx in${this.host.reduced() ? ' still' : ''}">${s.exhibit(this.ctx)}</div>` : '';
  }

  /** Next button text for moving to stop i. */
  private nextText(i: number): string {
    const s = this.all()[i];
    if (i === 1) return 'See your route';
    if (i === 2) return s.pick === 'profession' ? 'Choose your profession' : `Start at ${s.title}`;
    return s.nextLabel ?? `Next to ${s.go ?? s.title}`;
  }

  private welcomeHtml(): string {
    if (!this.audience || !this.path) {
      if (this.wfAsk) {
        return this.topHtml('Welcome · Build my workforce') +
          `<p class="spYou"><small>You</small>I want to build my workforce.</p>` +
          `<p class="spGuide"><small>Your EmpowerED guide</small>Great. Who are you building for?</p>` +
          `<div class="spGoals" role="group" aria-label="Who are you building for?">${WORKFORCE_FOR.map(([k, t]) => k === 'region' ? `<button type="button" data-act="region">${esc(t)}</button>` : `<button type="button" data-goal="${k}">${esc(t)}</button>`).join('')}</div>` +
          `<button type="button" class="spLink spFree" data-act="unwf"><span aria-hidden="true">←</span> Back to the three journeys</button>`;
      }
      const sv = this.saved, cont = sv ? this.paths[sv.a] : null;
      const title = sv && cont ? (sv.i > 1 ? cont.stops[sv.i - 2]?.title : sv.i === 1 ? 'Your route' : 'Welcome') : '';
      return this.topHtml('Welcome') +
        `<p class="spGuide"><small>Your EmpowerED guide</small>Hi, I'm your EmpowerED guide. What would you like to explore?</p>` +
        (cont && title ? `<button type="button" class="spNext spCont" data-act="continue">Continue: ${esc(cont.goal)} · ${esc(title)} <span aria-hidden="true">→</span></button>` : '') +
        `<div class="spGoals spJourneys" role="group" aria-label="Choose a journey">${JOURNEYS.map(([k, t, s]) => `<button type="button" data-journey="${k}"><b>${esc(t)}</b><span>${esc(s)}</span></button>`).join('')}</div>` +
        `<button type="button" class="spLink spFree" data-goal="explore">Explore freely instead</button>`;
    }
    const sv = this.saved && this.saved.a === this.audience && this.saved.i > 1 ? this.saved : null;
    return this.topHtml('Welcome · ' + this.path.goal) +
      `<p class="spYou"><small>You</small>${esc(this.path.goal)}.</p>` +
      `<p class="spGuide"><small>Your EmpowerED guide</small>I'll show you how we help with that, what the process produces and how to start.</p>` +
      `<div class="spNav"><button type="button" class="spLink" data-act="goal">Change my goal</button>` +
      (sv ? `<button type="button" class="spLink" data-go="${sv.i}">Continue at ${esc(this.all()[sv.i]?.title ?? '')}</button>` : '') +
      `<button type="button" class="spNext" data-go="1">${this.nextText(1)} <span aria-hidden="true">→</span></button></div>`;
  }

  private previewHtml(): string {
    const p = this.path!;
    return this.topHtml('Your route · ' + p.goal) +
      `<p class="spGuide"><small>Your EmpowerED guide</small>Here’s what changes for you, and the ${this.stops.length} stops we’ll visit.</p>` +
      this.inlineBoard(this.all()[1]) +
      `<ol class="spRoute">${this.stops.map((s, k) => `<li><b>${esc(s.title)}</b><span>${esc(p.preview.lines[k] ?? '')}</span></li>`).join('')}</ol>` +
      `<div class="spNav"><button type="button" class="spLink" data-go="0"><span aria-hidden="true">←</span> Welcome</button><button type="button" class="spNext" data-go="2">${esc(this.nextText(2))} <span aria-hidden="true">→</span></button></div>`;
  }

  private stopHtml(idx: number): string {
    const all = this.all(), s = all[idx], n = this.stops.length, num = idx - 1, last = num === n;
    const asks = this.asksAt(s);
    const picked = this.ask?.stop === idx ? asks[this.ask.k] : undefined;
    const you = picked ? this.txt(picked.q) : this.txt(s.concern);
    const said = picked ? this.txt(picked.a) : this.txt(s.guide);
    let h = this.topHtml(`${s.title} · Stop ${num} of ${n}`);
    h += `<p class="spYou"><small>You</small>${esc(you)}</p><p class="spGuide"><small>Your EmpowerED guide</small>${esc(said)}</p>`;
    if (picked) h += `<button type="button" class="spLink" data-act="unask">Back to ${esc(s.title)}</button>`;
    if (s.pick === 'profession') h += `<div class="spPick"><label class="spSearch"><span>Find your profession</span><input type="search" data-search placeholder="Search professions" value="${esc(this.filter)}" autocomplete="off"></label><div class="spProfs" role="group" aria-label="Professions"></div></div>`;
    h += this.inlineBoard(s);
    if (s.show) h += `<button type="button" class="spShow" data-act="show">${esc(this.txt(s.show.label))} <span aria-hidden="true">↗</span></button>`;
    if (asks.length) {
      h += `<details class="spAsk"${picked ? ' open' : ''}><summary>Ask your guide</summary><div>` +
        asks.map((q, k) => `<button type="button" data-ask="${k}"${picked === q ? ' aria-pressed="true"' : ''}>${esc(this.txt(q.q))}</button>`).join('') + '</div></details>';
    }
    const back = `<button type="button" class="spLink" data-go="${idx - 1}"><span aria-hidden="true">←</span> ${esc(all[idx - 1].title)}</button>`;
    if (!last) {
      h += `<div class="spNav">${back}<button type="button" class="spNext" data-go="${idx + 1}">${esc(this.nextText(idx + 1))} <span aria-hidden="true">→</span></button></div>`;
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
      ? list.map(([p, i]) => `<button type="button" data-prof="${i}" aria-pressed="${i === this.ctx.profession}">${esc(p.name)}</button>`).join('')
      : '<p class="spNone">No match yet. Choose the closest, or ask us about your profession at the last stop.</p>';
  }

  private onClick(e: Event) {
    const b = (e.target as Element).closest<HTMLElement>('button,summary');
    if (!b || !this.panel.contains(b)) return;
    const d = b.dataset;
    if (d.goal) { this.pick(d.goal as Audience); return; }
    if (d.journey) { this.chooseJourney(d.journey as Journey); return; }
    if (d.go !== undefined) { this.ask = null; this.mapOpen = false; this.shownKey = ''; this.host.travel(+d.go); return; }
    if (d.ask !== undefined) { this.ask = { stop: this.at, k: +d.ask }; this.shownKey = ''; this.keepFocus = true; this.focusSel = '.spAsk [aria-pressed="true"]'; return; }
    if (d.prof !== undefined) { this.ctx.profession = +d.prof; this.save(this.at); this.shownKey = ''; this.keepFocus = true; this.focusSel = '.spProfs [aria-pressed="true"]'; return; }
    if (d.end !== undefined && this.path) { const a = +d.end < 0 ? this.path.primary : this.path.more?.[+d.end]; a?.run(this.ctx); return; }
    switch (d.act) {
      case 'continue': if (this.saved) this.pick(this.saved.a, this.saved); break;
      case 'unwf': this.wfAsk = false; this.shownKey = ''; this.keepFocus = true; this.host.journey(null); break;
      case 'region': this.host.region(); break;
      case 'unask': this.ask = null; this.shownKey = ''; this.keepFocus = true; this.focusSel = '.spAsk summary'; break;
      case 'map': this.mapOpen = !this.mapOpen; this.shownKey = ''; this.keepFocus = true; this.focusSel = '[data-act="map"]'; break;
      case 'motion': this.host.setReduced(!this.host.reduced()); this.shownKey = ''; this.boardKey = ''; this.keepFocus = true; this.focusSel = '[data-act="motion"]'; break;
      case 'exit': this.host.explore(); break;
      case 'goal': this.host.setStops(this.reset(), 0); break;
      case 'show': { const s = this.all()[this.at]; if (s?.show) this.host.open(s.show.open, this.ctx); break; }
    }
  }

  /** Restore focus after a detail closes, including controls recreated on arrival. */
  restoreFocus(opener: HTMLElement | null) {
    const data = opener?.dataset;
    if (this.panel.hidden) {
      // The drawer closes before the next tour frame makes the guide visible.
      // Defer focus until that frame instead of attempting to focus hidden DOM.
      this.keepFocus = true;
      const entry = data ? Object.entries(data).find(([key]) => ['act','end','go','ask','prof','goal'].includes(key)) : undefined;
      this.focusSel = entry ? `[data-${entry[0]}="${CSS.escape(entry[1] ?? '')}"]` : '.spNext';
      this.shownKey = '';
      return;
    }
    const same = data ? [...this.panel.querySelectorAll<HTMLElement>('button,input,summary')].find(el => Object.keys(data).length > 0 && Object.entries(data).every(([k,v]) => el.dataset[k] === v)) : null;
    const visible = opener?.isConnected && opener.getClientRects().length && !opener.closest('[hidden]');
    const target = visible ? opener : same ?? this.panel.querySelector<HTMLElement>('[data-act="show"],.spNext,.spGoals button,button');
    target?.focus({ preventScroll: true });
  }

  /** Profession the professional route is following (first complete one until the visitor picks). */
  profession(): Profession { return this.professions[Math.max(0, this.ctx.profession)]; }
  get context(): StoryCtx { return this.ctx; }
  /** Room of stop i (for the scene highlights). */
  roomAt(i: number): RoomId { return this.all()[i]?.room ?? 'entrance'; }
  /** Stop index the visitor last arrived at. */
  get stopIndex(): number { return this.at; }
  /** Screen boxes of the characters and the board (development layout checks). */
  layout() {
    const box = (r: Rig) => { const p = r.root.position, a = this.host.project(p.x, p.y, p.z), b = this.host.project(p.x, p.y + 2, p.z); const hw = Math.max(12, (a.y - b.y) * 0.22); return [Math.round(a.x - hw), Math.round(b.y), Math.round(a.x + hw), Math.round(a.y)]; };
    const b = this.boardEl.getBoundingClientRect();
    return { guide: box(this.guide), you: box(this.you), board: b.width ? [b.left, b.top, b.right, b.bottom].map(Math.round) : null };
  }
}
