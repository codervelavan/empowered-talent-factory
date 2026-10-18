// The opening, "Follow the work": a short prologue the visitor moves through, in the real scene.
// Five beats follow one contribution: a learner's record (O1), the company assembling around it (O2),
// the machine problem the team works on (O3), the contribution traced to a reviewed output (O4), and
// the choice of perspective at the entrance (O5). Wheel, swipe, arrow keys and Back/Continue all drive
// the same bounded progress; nothing is timed after a brief establishing move. Only the labelled Skip
// skips. Reduced motion shows each beat as a still composition with manual Back/Continue.
import * as THREE from 'three';
import type { P3 } from '../bridge';
import { i18n, tr, translateDom } from '../app/i18n';

export interface OpeningFrame {
  pos: P3;
  look: P3;
  guide: P3;
  walking: boolean;
  wave: number;
  guideVisible: boolean;
  youVisible: boolean;
  /** Company assembly, 0..1 (1 = complete). */
  build: number;
  done: boolean;
}
/** How the prologue ended: a chosen perspective, Skip, or a different address (Back/Forward). */
export type OpeningEnd = 'career' | 'workforce' | 'ai' | 'skip' | 'path';
/** Scene effects the beats ask for (the controller maps them to the factory). */
export interface OpeningScene {
  note(state: number): void;
  select(person: number): void;
  run(cond: number, revised: boolean): void;
  reset(): void;
}

type Pose = [P3, P3];
type Size = 'desk' | 'phone' | 'land';
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const V = (p: P3) => new THREE.Vector3(...p);

/** Doorway in the front facade (the path into the building crosses here). */
const DOOR_Z = 4.35, DOOR_W = 2.3, DOOR_H = 3.6;
/** Where the guide stands aside at the machine, and where the visitor waits at the end. */
const GUIDE_POD: P3 = [9.4, 0, -27.6];

/** Composed camera poses per beat (approved A1 compositions), by screen shape. */
/** On desktop the caption card sits bottom-left, so each subject is framed right of centre. */
const POSES: Record<Size, { o1: Pose; o1c: Pose; o2: Pose; o3: Pose; o4: Pose }> = {
  desk: { o1: [[-5.3, 2.05, 15.3], [-7.7, 0.8, 11.7]], o1c: [[-5.6, 1.75, 13.8], [-7.3, 0.78, 11.95]], o2: [[-20, 13, 38], [-6, 6, -18]], o3: [[13.8, 3.5, -22.6], [11.6, 1.6, -32.0]], o4: [[23.4, 2.8, -25.2], [18.4, 1.4, -30.4]] },
  phone: { o1: [[-6.1, 2.9, 19], [-6.2, 1.9, 11.6]], o1c: [[-6.5, 2.55, 16.2], [-6.55, 1.3, 11.9]], o2: [[-14, 15, 52], [-2, 9, -14]], o3: [[13.0, 2.7, -20.5], [15.2, 2.5, -32]], o4: [[21.8, 2.9, -24.0], [18.8, 1.9, -30.4]] },
  land: { o1: [[-5.0, 1.85, 14.6], [-8.2, 0.9, 11.8]], o1c: [[-5.6, 1.6, 13.8], [-7.6, 0.8, 11.95]], o2: [[-20, 11, 36], [-7, 7, -18]], o3: [[13.8, 3.3, -22.6], [11.8, 1.7, -32.0]], o4: [[23.4, 2.7, -25.2], [18.4, 1.5, -30.4]] },
};
/** Clearance waypoints between beats: in through the entrance (clear of the stairs and the data panels), and back out. */
const IN_P: P3[] = [[-2, 4.2, 14], [0.6, 2.9, 6.5], [3.4, 3.0, -4], [4.6, 3.1, -13], [8.5, 3.3, -20]];
const IN_L: P3[] = [[0, 3, -6], [2, 2.8, -12], [6, 2.6, -20], [11, 2.0, -27], [14, 1.4, -31]];
const OUT_P: P3[] = [[11, 3.3, -17], [4.6, 3.1, -15], [4.0, 3.0, -5], [1.0, 2.9, 6]];
const OUT_L: P3[] = [[15, 1.6, -30], [8, 2.6, -26], [4, 3.0, -20], [1, 3.2, -14]];

interface Beat { cap: string; line: string; act?: string; done?: string; note?: string }
/** The prologue's beats (also the readable story on the standard page). */
export const BEATS: Beat[] = [
  { cap: 'Bring what you already know.', line: 'A learner and a peer organise observations from a machine. One record is missing its source.', act: 'Inspect the record', done: 'The peer brings the job schedule: the warm housing happened during a heavy cut on job 2217.', note: 'An illustrative project. Exploring it is not an assessment.' },
  { cap: 'Build something together.', line: 'The company takes shape around that first contribution: connected rooms, real teams, one process.' },
  { cap: 'Different skills. One useful system.', line: 'A machine needs attention. Each person brings a different task to the same problem.', act: 'Show the connection', done: 'The hands-on maintainer checks the spindle. Their notes feed the data work.' },
  { cap: 'See the work behind the result.', line: 'Follow one contribution from the record, through the team, to a reviewed output.', act: 'Trace the contribution', done: 'The job context was added. The reviewed service no longer raises the false alert on a heavy cut.', note: 'A prepared example, not a live machine or a real result.' },
  { cap: 'What would you like to explore?', line: 'Choose a perspective. You can change it at any time.' },
];
/** Beats sit at even steps along the progress; how long an automatic move between two beats takes (s). */
const AT = [0, 0.25, 0.5, 0.75, 1];
const SEG_S = [2.6, 2.4, 1.4, 2.2];

export class Opening {
  private doors: THREE.Mesh[] = [];
  private playing = false;
  private onDone: ((end: OpeningEnd) => void) | null = null;
  private el: HTMLElement;
  private card: HTMLElement;
  private fade: HTMLElement;
  /** Shown progress and where it is heading (0..1). */
  private p = 0;
  private target = 0;
  private t0 = 0;
  private lastNow = 0;
  private wheelIdle = 0;
  private touchY: number | null = null;
  private inspected = 0;
  private insp = false;
  private acted = new Set<number>();
  private shownBeat = -1;
  private reduce = false;
  private curves: { inP: THREE.CatmullRomCurve3; inL: THREE.CatmullRomCurve3; outP: THREE.CatmullRomCurve3; outL: THREE.CatmullRomCurve3; size: Size } | null = null;

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.playing || this.reduce || (e.target as Element)?.closest?.('#menu,.opCard')) return;
    this.target = Math.min(1, Math.max(0, this.target + e.deltaY * 0.00045));
    this.wheelIdle = performance.now();
  };
  private readonly onTouchStart = (e: TouchEvent) => { if (this.playing && !(e.target as Element)?.closest?.('.opCard,#menu')) this.touchY = e.touches[0].clientY; };
  private readonly onTouchMove = (e: TouchEvent) => {
    if (!this.playing || this.touchY === null || this.reduce) return;
    const y = e.touches[0].clientY;
    this.target = Math.min(1, Math.max(0, this.target + (this.touchY - y) * 0.0011));
    this.touchY = y;
    this.wheelIdle = performance.now();
  };
  private readonly onTouchEnd = () => { this.touchY = null; };
  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.playing || (e.target as Element)?.closest?.('input,textarea,select,#menu')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); this.step(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.step(-1); }
  };

  constructor(addWorld: (o: THREE.Object3D) => void, private lobby: () => { guide: P3; cam: Pose }, private scene: () => OpeningScene | null) {
    // Two sliding glass doors with dark green frames, in the gap the walking paths use (open after the prologue).
    const glass = new THREE.MeshBasicMaterial({ color: 0xcfeedd, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    const edge = new THREE.LineBasicMaterial({ color: 0x0f2b22 });
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.08);
      const m = new THREE.Mesh(g, glass);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edge));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0xc9a33a }));
      bar.position.set(-side * (DOOR_W / 2 - 0.25), 0, 0.08);
      m.add(bar);
      m.userData.side = side;
      addWorld(m);
      this.doors.push(m);
    }
    this.setDoors(1);

    this.el = document.createElement('div');
    this.el.id = 'opening';
    this.el.hidden = true;
    this.el.innerHTML = '<section class="opCard" aria-labelledby="opCap" aria-roledescription="prologue">'
      + '<p class="opStep" aria-live="polite"></p><h2 class="opCap" id="opCap"></h2><p class="opLine"></p>'
      + '<div class="opActs"></div><p class="opDone" role="status"></p><p class="opNote"></p>'
      + '<div class="opNav"><button type="button" class="opBack">← Back</button><button type="button" class="opNext">Continue →</button></div></section>'
      + '<button type="button" class="opSkip">Skip opening <span aria-hidden="true">→</span></button>'
      + '<p class="opHint" aria-hidden="true">Scroll, swipe or use the arrow keys</p>';
    this.card = this.el.querySelector('.opCard')!;
    this.el.querySelector<HTMLButtonElement>('.opSkip')!.onclick = () => this.finish('skip');
    this.el.querySelector<HTMLButtonElement>('.opBack')!.onclick = () => this.step(-1);
    this.el.querySelector<HTMLButtonElement>('.opNext')!.onclick = () => this.step(1);
    this.fade = document.createElement('div');
    this.fade.id = 'opFade';
    document.body.append(this.el, this.fade);
    // A language switch mid-prologue repaints the card in place (the beat and actions are kept).
    i18n.on(() => { if (this.playing && this.shownBeat >= 0) this.paint(this.shownBeat); });
  }

  /** 0 = closed, 1 = fully open. */
  private setDoors(open: number) {
    for (const d of this.doors) {
      const side = d.userData.side as number;
      d.position.set(side * (DOOR_W / 2 + open * (DOOR_W - 0.1)), DOOR_H / 2, DOOR_Z);
    }
  }

  get active(): boolean { return this.playing; }
  /** The beat the visitor is at (0..4), by the progress target. */
  get beat(): number { return Math.round(this.target * 4); }

  start(onDone: (end: OpeningEnd) => void, reduce: boolean) {
    this.onDone = onDone;
    this.playing = true;
    this.reduce = reduce;
    this.p = this.target = 0;
    this.t0 = this.lastNow = performance.now();
    this.inspected = 0;
    this.insp = false;
    this.acted.clear();
    this.shownBeat = -1;
    this.setDoors(1);
    this.el.hidden = false;
    document.documentElement.classList.add('opening');
    addEventListener('wheel', this.onWheel, { passive: true });
    addEventListener('touchstart', this.onTouchStart, { passive: true });
    addEventListener('touchmove', this.onTouchMove, { passive: true });
    addEventListener('touchend', this.onTouchEnd);
    addEventListener('keydown', this.onKey);
    const sc = this.scene();
    sc?.reset();
    sc?.note(0);
    this.paint(0);
    requestAnimationFrame(() => this.el.querySelector<HTMLElement>('.opNext')?.focus({ preventScroll: true }));
  }

  /** Move one beat forward or back (Continue/Back, arrow keys). */
  step(d: number) {
    if (!this.playing) return;
    const b = Math.max(0, Math.min(4, Math.round(this.target * 4) + d));
    this.target = AT[b];
    if (this.reduce) { this.p = this.target; this.flash(); }
  }

  /** End the prologue (a choice, Skip, or a new address): construction completes and the scene is tidied. */
  finish(end: OpeningEnd) {
    if (!this.playing) return;
    this.playing = false;
    this.el.hidden = true;
    document.documentElement.classList.remove('opening');
    removeEventListener('wheel', this.onWheel);
    removeEventListener('touchstart', this.onTouchStart);
    removeEventListener('touchmove', this.onTouchMove);
    removeEventListener('touchend', this.onTouchEnd);
    removeEventListener('keydown', this.onKey);
    const sc = this.scene();
    sc?.select(-1);
    sc?.reset();
    sc?.note(2);
    for (const d of this.doors) d.visible = true;
    const cb = this.onDone;
    this.onDone = null;
    cb?.(end);
  }

  private flash() { this.fade.classList.remove('go'); void this.fade.offsetWidth; this.fade.classList.add('go'); }

  /** Beat actions: each changes something visible in the scene. */
  private act(b: number) {
    const sc = this.scene();
    this.acted.add(b);
    if (b === 0) { this.insp = true; sc?.note(1); }
    if (b === 2) { sc?.select(1); sc?.run(0, false); }
    if (b === 3) { sc?.select(0); sc?.run(1, true); }
    this.paint(b, true);
  }

  private paint(b: number, keepFocus = false) {
    this.shownBeat = b;
    const B = BEATS[b], q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s)!;
    q('.opStep').textContent = tr('Opening') + ' · ' + (b + 1) + ' / 5';
    q('.opCap').textContent = tr(B.cap);
    q('.opLine').textContent = tr(B.line);
    q('.opLine').hidden = !B.line;
    const acts = q('.opActs');
    acts.innerHTML = '';
    if (b === 4) {
      acts.className = 'opActs opChoices';
      ([['career', 'Build my career', 'Start at Intake'], ['workforce', 'Build my workforce', 'Teams, talent, campuses and PODs'], ['ai', 'AI for Everyone', 'AI for the work you already do']] as [OpeningEnd, string, string][]).forEach(([k, t, s]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opChoice';
        btn.innerHTML = '<b></b><span></span>';
        btn.querySelector('b')!.textContent = tr(t);
        btn.querySelector('span')!.textContent = tr(s);
        btn.onclick = () => this.finish(k);
        acts.appendChild(btn);
      });
    } else {
      acts.className = 'opActs';
      if (B.act) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opAct';
        btn.textContent = tr(B.act);
        btn.setAttribute('aria-pressed', String(this.acted.has(b)));
        btn.onclick = () => this.act(b);
        acts.appendChild(btn);
      }
    }
    q('.opDone').textContent = this.acted.has(b) && B.done ? tr(B.done) : '';
    q('.opNote').textContent = B.note ? tr(B.note) : '';
    q<HTMLButtonElement>('.opBack').disabled = b === 0;
    q('.opNext').hidden = b === 4;
    // Static controls follow the language; the beat text above is already translated with tr().
    ['.opSkip', '.opHint', '.opNav'].forEach((sel) => translateDom(this.el.querySelector(sel)));
    // The status update keeps focus on the action that caused it.
    if (keepFocus) q<HTMLElement>('.opAct')?.focus({ preventScroll: true });
  }

  private curvesFor(size: Size) {
    if (this.curves?.size === size) return this.curves;
    const P = POSES[size], L = this.lobby();
    const mk = (pts: P3[]) => new THREE.CatmullRomCurve3(pts.map(V), false, 'centripetal');
    this.curves = {
      size,
      inP: mk([P.o2[0], ...IN_P, P.o3[0]]), inL: mk([P.o2[1], ...IN_L, P.o3[1]]),
      outP: mk([P.o4[0], ...OUT_P, L.cam[0]]), outL: mk([P.o4[1], ...OUT_L, L.cam[1]]),
    };
    return this.curves;
  }

  /** The frame for now: eases the progress toward its target and composes camera, construction and figures. */
  frame(now: number, size: Size): OpeningFrame {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    // After a scroll or swipe pauses, settle on the nearest beat.
    if (!this.reduce && this.wheelIdle && now - this.wheelIdle > 650) { this.wheelIdle = 0; this.target = AT[Math.round(this.target * 4)]; }
    if (this.reduce) this.p = this.target;
    else {
      const seg = Math.min(3, Math.floor(Math.min(this.p, this.target) * 4 + 1e-6));
      const speed = 0.25 / SEG_S[seg];
      const d = this.target - this.p;
      this.p += Math.sign(d) * Math.min(Math.abs(d), speed * dt * (1 + Math.min(3, Math.abs(d) * 6)));
    }
    const b = Math.round(this.p * 4 * 1000) / 1000;
    const nearBeat = Math.round(this.target * 4);
    if (Math.abs(this.p - this.target) < 0.002 && nearBeat !== this.shownBeat) this.paint(nearBeat);
    if (!this.reduce) this.inspected += ((this.insp ? 1 : 0) - this.inspected) * Math.min(1, dt * 2.4);
    else this.inspected = this.insp ? 1 : 0;

    const P = POSES[size], C = this.curvesFor(size), L = this.lobby();
    const o1: Pose = [mix(P.o1[0], P.o1c[0], sm(0, 1, this.inspected)), mix(P.o1[1], P.o1c[1], sm(0, 1, this.inspected))];
    // A brief establishing move: settle from slightly higher and wider into the first composition.
    const est = this.reduce ? 1 : sm(0, 1.6, (now - this.t0) / 1000);
    o1[0] = mix([o1[0][0] + 1.4, o1[0][1] + 1.6, o1[0][2] + 3.2], o1[0], est);
    let pos: P3, look: P3;
    const k = Math.min(3, Math.floor(b)), t = b - k;
    if (k === 0) { const e = sm(0, 1, t); pos = mix(o1[0], P.o2[0], e); look = mix(o1[1], P.o2[1], e); }
    else if (k === 1) { const e = sm(0, 1, t); pos = C.inP.getPoint(e).toArray() as P3; look = C.inL.getPoint(e).toArray() as P3; }
    else if (k === 2) { const e = sm(0, 1, t); pos = mix(P.o3[0], P.o4[0], e); look = mix(P.o3[1], P.o4[1], e); }
    else { const e = sm(0, 1, t); pos = C.outP.getPoint(e).toArray() as P3; look = C.outL.getPoint(e).toArray() as P3; }
    // Construction follows the pull-back from the record (O1 → O2); it is complete from O2 on.
    const build = this.reduce ? (this.p >= 0.125 ? 1 : 0) : sm(0.01, 0.245, this.p);
    for (const d of this.doors) d.visible = build > 0.99;
    const atEnd = this.p > 0.93;
    const guide: P3 = atEnd ? L.guide : GUIDE_POD;
    return { pos, look, guide, walking: false, wave: atEnd ? Math.min(1, (this.p - 0.93) / 0.07) : 0, guideVisible: this.p > 0.4, youVisible: atEnd, build, done: false };
  }
}
