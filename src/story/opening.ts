// The 3D opening: a short, skippable film in the real scene. A wide shot of the headquarters
// ("LEARNING ≠ GETTING HIRED."), the camera approaches ("WHAT CAN YOU ACTUALLY DO?"), the glass
// doors slide open on the floor inside (the value proposition), then the camera settles on the
// plaza as the guide walks out through the doors, waves, and asks what you'd like to explore.
// Captions are HTML. Any click, key or the Skip button ends it at once. With reduced motion the
// same story plays as four still frames with short fades.
import * as THREE from 'three';
import type { P3 } from '../bridge';
import { tr } from '../app/i18n';

export interface OpeningFrame {
  pos: P3;
  look: P3;
  /** Guide position, whether walking, and how far into the wave (0 = not waving). */
  guide: P3;
  walking: boolean;
  wave: number;
  /** The guide is out of sight inside the building until it reaches the doors. */
  guideVisible: boolean;
  done: boolean;
}

type Pose = [P3, P3];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixPose = (a: Pose, b: Pose, t: number): Pose => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

/** Doorway in the front facade (the path into the building crosses here). */
const DOOR_Z = 4.35, DOOR_W = 2.3, DOOR_H = 3.6;
/** Where the guide comes out, and where it stops on the plaza. */
const DOOR_OUT: P3 = [0, 0, 5.2];

const CAPTIONS: [string, string][] = [
  ['LEARNING ≠ GETTING HIRED.', 'big'],
  ['WHAT CAN YOU ACTUALLY DO?', 'big'],
  ['Develop capability. Engineer for real. Verify readiness. Deploy with confidence.', 'mid'],
  ['', ''],
];

export class Opening {
  private doors: THREE.Mesh[] = [];
  private t0 = 0;
  private playing = false;
  private onDone: (() => void) | null = null;
  private el: HTMLElement;
  private cap: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private fade: HTMLElement;
  private shownCap = -1;
  private stillBeat = -1;
  private readonly onKey = (e: KeyboardEvent) => { if (e.key !== 'Tab' && e.key !== 'Shift') { e.preventDefault(); this.finish(); } };
  private readonly onPointer = (e: PointerEvent) => { if (!(e.target as Element)?.closest?.('#menu,#menuBtn')) this.finish(); };

  constructor(addWorld: (o: THREE.Object3D) => void, private lobby: () => { guide: P3; cam: Pose }) {
    // Two sliding glass doors with dark green frames, in the gap the walking paths use.
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
    this.el.innerHTML = '<p class="opCap" aria-live="polite"></p><button type="button" class="opSkip">Skip intro <span aria-hidden="true">→</span></button>';
    this.cap = this.el.querySelector('.opCap')!;
    this.skipBtn = this.el.querySelector('.opSkip')!;
    this.skipBtn.onclick = (e) => { e.stopPropagation(); this.finish(); };
    this.fade = document.createElement('div');
    this.fade.id = 'opFade';
    document.body.append(this.el, this.fade);
  }

  /** 0 = closed, 1 = fully open. */
  private setDoors(open: number) {
    for (const d of this.doors) {
      const side = d.userData.side as number;
      d.position.set(side * (DOOR_W / 2 + open * (DOOR_W - 0.1)), DOOR_H / 2, DOOR_Z);
    }
  }

  get active(): boolean { return this.playing; }

  start(onDone: () => void) {
    this.onDone = onDone;
    this.playing = true;
    this.t0 = performance.now();
    this.shownCap = -1;
    this.stillBeat = -1;
    this.setDoors(0);
    this.el.hidden = false;
    document.documentElement.classList.add('opening');
    addEventListener('keydown', this.onKey, true);
    setTimeout(() => { if (this.playing) addEventListener('pointerdown', this.onPointer, true); }, 300);
    this.skipBtn.focus({ preventScroll: true });
  }

  /** End now (skip or natural end): doors stay open, the guide is on the plaza. */
  finish() {
    if (!this.playing) return;
    this.playing = false;
    this.setDoors(1);
    this.el.hidden = true;
    document.documentElement.classList.remove('opening');
    removeEventListener('keydown', this.onKey, true);
    removeEventListener('pointerdown', this.onPointer, true);
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  private caption(i: number) {
    if (i === this.shownCap) return;
    this.shownCap = i;
    const [text, size] = CAPTIONS[i] ?? ['', ''];
    this.cap.className = 'opCap ' + size;
    this.cap.textContent = tr(text);
    this.cap.classList.remove('in');
    void this.cap.offsetWidth;
    if (text) this.cap.classList.add('in');
  }

  /** The frame at the current time. */
  frame(now: number, reduce: boolean): OpeningFrame {
    const t = (now - this.t0) / 1000;
    const L = this.lobby();
    const A: Pose = [[22, 10, 48], [0, 6, -8]], A2: Pose = [[16, 8.5, 42], [0, 6, -6]];
    const B: Pose = [[0, 3.4, 17], [0, 3.6, 0]];
    const C: Pose = [[0, 2.9, 9.5], [0, 2.2, -16]];
    if (reduce) {
      // Four still frames, each held for a moment, with a short fade between them.
      const beat = Math.min(3, Math.floor(t / 2.2));
      if (beat !== this.stillBeat) { this.stillBeat = beat; this.fade.classList.remove('go'); void this.fade.offsetWidth; this.fade.classList.add('go'); }
      this.caption(beat);
      this.setDoors(beat >= 2 ? 1 : 0);
      const pose = [A, B, C, L.cam][beat];
      const done = t > 2.2 * 4;
      return { pos: pose[0], look: pose[1], guide: L.guide, walking: false, wave: beat === 3 ? 1 : 0, guideVisible: beat === 3, done };
    }
    let pose: Pose, guide = DOOR_OUT, walking = false, wave = 0, guideVisible = false;
    if (t < 3) { this.caption(0); pose = mixPose(A, A2, sm(0, 3, t)); }
    else if (t < 6) { this.caption(1); pose = mixPose(A2, B, sm(3, 6, t)); }
    else if (t < 8.6) {
      this.caption(2);
      this.setDoors(sm(6.1, 7.1, t));
      pose = mixPose(B, C, sm(6.6, 8.4, t));
    } else {
      this.caption(3);
      pose = mixPose(C, L.cam, sm(8.6, 10.8, t));
      // The guide walks out through the doors to the plaza, then turns and waves.
      const w = sm(8.6, 12.2, t);
      guide = mix(DOOR_OUT, L.guide, w);
      guideVisible = true;
      walking = w > 0 && w < 1;
      wave = t > 12.2 ? Math.min(1, (t - 12.2) / 1.4) : 0;
    }
    return { pos: pose[0], look: pose[1], guide, walking, wave, guideVisible, done: t > 13.8 };
  }
}
