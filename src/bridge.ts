// Typed contract for the hooks the station, factory controller, factory scene and
// guide expose to each other. They're attached to `window` (as in the prototype) so
// each module can call the others lazily without import cycles; this file is the
// single place that documents them.
import type { Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export type LineKey = 'career' | 'build' | 'workforce';
/** Factory controller mode (`mode` in controller.ts). */
export type FactoryMode = 'intro' | 'fly' | 'route' | 'hub' | 'arrive' | 'free' | 'globe' | 'gIn' | 'gOut' | (string & {});

/** Copy for one factory stop: [title, paragraph, chips, action label] (STOPC in controller.ts). */
export type StopCopy = [title: string, para: string, chips: string[], action: string];

/** A world-space point as an [x, y, z] tuple. */
export type P3 = [x: number, y: number, z: number];
/** A world point projected to the viewport (`FACTORY.project`); `face` is set by `FACTORY.nodes`. */
export interface ScreenPoint { x: number; y: number; vis: boolean; face?: number }
/** One unit on the TaaS talent shelf (UNITD in controller.ts). */
export interface TalentUnit { id: string; dom: string; band: string; state: string; off?: boolean; /** Part of the chosen engagement model (steps forward on the shelf). */ grp?: boolean }
/** Ecosystem network state pushed by the controller (`FACTORY.setNet`). */
export interface EcoNet { sec: number; act: Record<string, number>; mode: number; links: number[] }

/** Public surface of the 3D scene, built in factory/scene.ts and driven by factory/controller.ts. */
export interface FactoryApi {
  // camera poses
  stops(r: string): number[];
  podPose(b: number, i: number): void;
  podEls(): HTMLElement[];
  podCentre(): number;
  fromSnap(e: number): void;
  poseIntro(d?: number): void;
  poseFly(r: string, e: number): void;
  poseAt(p: number[], l: number[]): void;
  /** Company assembly progress for the opening (1 = complete). */
  build(p: number): void;
  /** Opening notebook state: 0 gap, 1 source shown, 2 reviewed. */
  opNote(n: number): void;
  /** The project record notebook (Develop bench and Engineer data bench). state: 0 as found, 1 gap marked, 2 fixed and linked. */
  devNote(d: { title: string; head: string[]; rows: string[][]; row: number; col: number; fix: string; state: number; linked: string; missing: string }): void;
  /** Mark Specialise pod i (-1 clears); returns its floor position. */
  specPod(i: number): P3 | null;
  poseRoute(r: string, k: number): void;
  snapshot(): void;
  poseBack(t: number): void;
  routeWP(r: string, s: number): [P3, P3];
  /** Camera position and look-at at waypoint position k along a route curve (k may be fractional). */
  routePose(r: string, k: number): [P3, P3];
  /** World positions of the floating entrance icons: Career, Workforce, AI for Everyone. */
  brandIcons(): P3[];
  /** Add an object to the company building (moves with it onto the globe). */
  addWorld(o: Object3D): void;
  /** Development check: points where the segment a→b passes through a wall or object (horizontal surfaces and story characters are ignored). */
  rayHits(a: P3, b: P3): { p: P3; d: number }[];
  /** Development check: what the segment a→b hits first (for diagnosing the wall check). */
  rayWhat(a: P3, b: P3): unknown[];
  /** Development check: many segments at once; true where a segment hits a wall (walls) or a floor (!walls). */
  rayBatch(segs: [P3, P3][], walls: boolean): boolean[];
  /** Development check: wall segments (x1,z1,x2,z2…) in a height band, and floor triangles (x,z ×3…) at its base. */
  obstacles(y0: number, y1: number): { walls: number[]; floor: number[]; low: number[]; high: number[]; highY: number[] };
  cam(): PerspectiveCamera;
  render(mode: string, introS: number): void;
  // intro / career floor
  setHover(k: string | null): void;
  setSpine(on: boolean): void;
  outline(): [P3, P3][];
  setCrate(g: number | null): void;
  setTicks(a: number[]): void;
  setWalk(on: boolean): void;
  etaf(on: boolean): void;
  etafLit(): number;
  glance(i: number): void;
  pick(cx: number, cy: number, stop: number | string): string | null;
  setCareer(f: number, s: boolean, sh: number): void;
  scanY(): number;
  gates(): [number, number][];
  // workforce
  setWf(on: boolean): void;
  setBays(hv: number, sel: number[], dim: number[]): void;
  setUnits(u: TalentUnit[]): void;
  setTeam(n: string): void;
  wfStop(i: number): void;
  campusIn(r?: boolean): void;
  podCross(): void;
  setCampus(a: number[], c: number): void;
  setActor(i: number): void;
  setNet(o: EcoNet): void;
  pod(on: boolean): void;
  podJump(i: number): void;
  /** Light the lead roles (indexes into the POD's six roles) for the chosen problem type. */
  setPodLead(lead: number[]): void;
  /** Zoom the globe camera onto a profession's workflow diorama (-1 zooms back out). */
  globeZoom(node: number): void;
  /** Show one diorama step (0 sample input, 1 AI draft, 2 you check), or -1 to play them in turn. */
  dioStep(k: number): void;
  /** The diorama step currently shown. */
  dioAt(): number;
  /** Development: render cost (CPU ms to submit a frame, draw calls, triangles, pixel ratio). */
  stats(): { ms: number; calls: number; tris: number; dpr: number };
  /** POD mission (src/pod): highlight a team member (-1 none). */
  podSelect(i: number): void;
  /** Run one prepared machine cycle: condition index, and whether the team's reviewed version is used. */
  podRun(cond: number, revised: boolean): void;
  podReset(): void;
  /** Show one mission's centrepiece: 0 CNC machine, 1 inspection cell, 2 source table. */
  podMission(i: number): void;
  podState(): { ran: boolean; u: number; done: boolean; alert: boolean; cond: number; revised: boolean; mi: number };
  /** Text drawn on the trace panel and alert screen (for the language switch). */
  podLabels(l: Record<string, string>): void;
  /** Evidence & Impact gallery frames (centre and the point each exhibit faces). */
  gallery(): { at: P3; face: P3 }[];
  /** Whether a profession (globe node) has a workflow diorama. */
  hasDio(node: number): boolean;
  /** Development check: where the zoomed diorama sits. */
  dioDebug(): unknown;
  podG(): number;
  podTime(): number;
  campusOn(): boolean;
  netA(): number;
  setFlow(p: number): void;
  // globe
  globeBegin(dir: 'in' | 'out'): void;
  globeStep(t: number): void;
  globeArrive(): void;
  globeHold(): void;
  globeReset(): void;
  setPanel(v: number): void;
  setSel(i: number): void;
  gNode(i: number): Vector3;
  gFront(): Vector3;
  focusNode(i: number): void;
  drag(dx: number, dy: number): void;
  nodes(): ScreenPoint[];
  // CSS3D placement
  css(el: HTMLElement, par?: string): CSS3DObject;
  fitBoard(o: Object3D, p: P3, l: P3, pxW: number): void;
  aim(o: Object3D, pos: P3, cp?: P3 | null, z?: number, flat?: number, ww?: number, pxW?: number): void;
  project(x: number, y: number, z: number): ScreenPoint;
}

declare global {
  interface Window {
    // factory/scene.ts
    FACTORY?: FactoryApi;
    // main.ts / story/intro.ts: true while the story intro covers the page.
    __storyShowing?: boolean;
    /** Set on the story iframe's window once story/intro.ts has hooked its scroll handlers. */
    __hooked?: number;

    // factory/controller.ts
    __step?: () => void;
    __goForm?: (i: number, title: string) => void;
    __wform?: (title: string) => void;
  }
}

export {};
