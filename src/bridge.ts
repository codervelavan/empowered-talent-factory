// Typed contract for the hooks the station, factory controller, factory scene and
// guide expose to each other. They're attached to `window` (as in the prototype) so
// each module can call the others lazily without import cycles; this file is the
// single place that documents them.
import type { Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { Guide } from './guide/guide';

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
export interface TalentUnit { id: string; dom: string; band: string; state: string; off?: boolean }
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
  poseRoute(r: string, k: number): void;
  snapshot(): void;
  poseBack(t: number): void;
  routeWP(r: string, s: number): [P3, P3];
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

    // guide/guide.ts
    __guide?: Guide;

    // station/station.ts
    __rideInput?: (e: Event) => void;
    __stFrame?: (u: number) => void;
    __stDbg?: { start(k: LineKey): void; go(i: number): void };
    __enterFactory?: () => void;
    __replayStory?: () => void;
    __showStation?: () => void;
    /** Set on the story iframe's window once station.ts has hooked its scroll handlers. */
    __hooked?: number;

    // factory/controller.ts
    __step?: () => void;
    __choose?: (r: string) => void;
    __factMode?: () => FactoryMode;
    __stopC?: () => Record<string, StopCopy[]>;
    __openStop?: (r: string, i: number) => void;
    __setCat?: (c: string) => void;
    __rideIn?: (k: LineKey) => void;
    __factoryReset?: () => void;
    __boardLine?: (k: string) => void;
    __pendingBoard?: string | null;
    __wfGo?: (i: number) => void;
    __topOf?: (r: string, i: number) => number;
    __back?: () => void;
    __toGlobe?: () => void;
    __openSide?: (i: number) => void;
    __goForm?: (i: number, title: string) => void;
    __wform?: (title: string) => void;
  }
}

export {};
