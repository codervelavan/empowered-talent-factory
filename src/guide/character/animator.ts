// Procedural animation for the guide character: idle, talk, wave, point, walk and celebrate.
// Each frame builds a target pose, and every joint eases toward it, so states blend smoothly.
import type { Rig } from './figure';

export type Gesture = 'none' | 'wave' | 'point' | 'celebrate';

/** Direction (screen space, y up) from a shoulder to whatever the character is pointing at. */
export interface PointAim { arm: 0 | 1; dx: number; dy: number }

export interface AnimInput {
  talking: boolean;
  /** 0 standing still, 1 walking at full stride. */
  walk: number;
  gesture: Gesture;
  /** Required when gesture is 'point'. */
  aim?: PointAim | null;
  /** Arm used for waving and talking gestures (the one away from the content). */
  freeArm: 0 | 1;
}

type Channels = Record<string, number>;

export class Animator {
  private cur: Channels = {};
  private t = 0;
  private stride = 0;
  private blinkAt = 2;

  constructor(private rig: Rig, private reduce: boolean) {}

  update(dt: number, inp: AnimInput): void {
    const r = this.reduce;
    this.t += dt;
    const t = this.t;
    if (!r) this.stride += dt * 7.5 * inp.walk;
    const s = this.stride;
    const osc = (amp: number, freq: number, phase = 0) => (r ? 0 : amp * Math.sin(t * freq + phase));
    const tg: Channels = {};
    const side = (arm: 0 | 1) => (arm === 0 ? 1 : -1);

    // Body: breathing, gentle sway, walking bob.
    tg.bodyY = osc(0.004, 2.1) + (r ? 0 : inp.walk * 0.014 * Math.abs(Math.sin(s)));
    tg.torsoZ = osc(0.012, 0.9);
    tg.headY = osc(0.07, 0.55);
    tg.headX = inp.talking ? osc(0.05, 5.3) - 0.02 : 0;
    tg.headZ = inp.talking ? osc(0.035, 1.7) : 0;

    // Legs.
    for (const i of [0, 1] as const) {
      const ph = s + (i ? Math.PI : 0);
      tg['hipX' + i] = r ? 0 : inp.walk * 0.5 * Math.sin(ph);
      tg['kneeX' + i] = r ? 0 : inp.walk * 0.7 * Math.max(0, -Math.sin(ph));
    }

    // Arms: relaxed by default, swinging when walking.
    for (const i of [0, 1] as const) {
      tg['shZ' + i] = side(i) * 0.09;
      tg['shX' + i] = r ? 0 : -inp.walk * 0.4 * Math.sin(s + (i ? 0 : Math.PI));
      tg['elX' + i] = -0.12;
      tg['elZ' + i] = 0;
    }

    const free = inp.freeArm;
    if (inp.talking && inp.gesture !== 'wave' && inp.gesture !== 'celebrate') {
      // Explaining: forearm forward, hand moving with the words.
      tg['shZ' + free] = side(free) * (0.28 + osc(0.1, 2.3));
      tg['shX' + free] = -0.45;
      tg['elX' + free] = -1.05 + osc(0.22, 3.1);
    }
    if (inp.gesture === 'wave') {
      tg['shZ' + free] = side(free) * 2.55;
      tg['shX' + free] = 0;
      tg['elX' + free] = 0;
      tg['elZ' + free] = side(free) * 0.2 + osc(0.45, 9);
    } else if (inp.gesture === 'point' && inp.aim) {
      const a = inp.aim;
      tg['shZ' + a.arm] = Math.atan2(a.dx, -a.dy);
      tg['shX' + a.arm] = -0.18;
      tg['elX' + a.arm] = 0;
      tg['elZ' + a.arm] = 0;
    } else if (inp.gesture === 'celebrate') {
      for (const i of [0, 1] as const) {
        tg['shZ' + i] = side(i) * 2.45;
        tg['shX' + i] = 0;
        tg['elX' + i] = 0;
        tg['elZ' + i] = side(i) * (0.25 + osc(0.15, 8));
      }
      tg.bodyY += r ? 0 : Math.abs(Math.sin(t * 6)) * 0.02;
    }

    // Ease every channel toward its target.
    const k = r ? 1 : Math.min(1, dt * 11);
    for (const key in tg) {
      const c = this.cur[key] ?? tg[key];
      this.cur[key] = c + (tg[key] - c) * k;
    }
    this.apply();

    // Face: blinking and a moving mouth while talking.
    let blink = 1;
    if (!r) {
      if (t > this.blinkAt + 0.13) this.blinkAt = t + 2.5 + Math.random() * 3;
      else if (t > this.blinkAt) blink = 0.12;
    }
    this.rig.eyes.forEach((e) => e.scale.set(1, blink, 1));
    const open = inp.talking && !r ? 0.3 + 0.7 * Math.abs(Math.sin(t * 9.3) * Math.sin(t * 4.1 + 1)) : 0.28;
    this.rig.mouth.scale.set(1, open, 1);
  }

  private apply(): void {
    const c = this.cur, g = this.rig;
    g.body.position.y = c.bodyY;
    g.torso.rotation.z = c.torsoZ;
    g.head.rotation.set(c.headX, c.headY, c.headZ);
    for (const i of [0, 1] as const) {
      g.hips[i].rotation.x = c['hipX' + i];
      g.knees[i].rotation.x = c['kneeX' + i];
      g.shoulders[i].rotation.set(c['shX' + i], 0, c['shZ' + i]);
      g.elbows[i].rotation.set(c['elX' + i], 0, c['elZ' + i]);
    }
  }
}
