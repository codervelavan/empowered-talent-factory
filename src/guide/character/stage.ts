// Puts the guide character on screen: works out where it should stand (departure board,
// beside the ride text, or in a corner of the factory), walks it there, keeps the speech
// bubble next to it, and renders it on a transparent canvas above the scene.
import * as THREE from 'three';
import { buildFigure, type Rig } from './figure';
import { Animator, type Gesture } from './animator';

export interface CharacterStage {
  /** The speech bubble element; the guide fills it with text and buttons. */
  bubble: HTMLElement;
  talk(on: boolean): void;
  /** React to a guide line starting: wave, point at what the line is about, or celebrate. */
  cue(id: string): void;
}

type Ctx = 'hidden' | 'board' | 'ride' | 'factory';
interface Spot {
  /** Feet position in viewport pixels. */
  x: number;
  y: number;
  /** Figure height in pixels. */
  h: number;
  /** 1 turns toward the right of the screen, -1 toward the left. */
  face: 1 | -1;
  bubble: 'right' | 'top';
  /** The bubble never rises above this (keeps it clear of the ride text). */
  minTop?: number;
  phone: boolean;
}

const WAVE_LINES = new Set(['welcome', 'career-1', 'build-1', 'work-1']);
/** What each line is about on screen. Lines not listed point at the middle of the scene. */
const POINT_AT: Record<string, string> = {
  welcome: '.stBoard',
  board: '.stBoard',
  howto: '#stMap',
  'career-3': '#crCards .crCard.rec',
  'career-5': '#crPass',
  'build-4': '.crPin.bBadge',
  'work-1': '#wfSg .crPin',
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const shown = (el: HTMLElement | null) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? r : null;
};

function context(): Ctx {
  const st = document.getElementById('station');
  if (st && !st.hidden) {
    const map = document.getElementById('stMap');
    const board = $('.stBW');
    const riding = Number(map?.style.opacity || 0) >= 0.5 || Number(board?.style.opacity || 1) < 0.5;
    return riding ? 'ride' : 'board';
  }
  const mode = window.__factMode?.();
  if (!document.getElementById('storyIntro') && (mode === 'arrive' || mode === 'free')) return 'factory';
  return 'hidden';
}

function spotFor(ctx: Ctx): Spot | null {
  const W = innerWidth, H = innerHeight, phone = W <= 700;
  if (ctx === 'board') {
    // Beside the departure board on wide screens; on narrower ones the board needs the room.
    const b = shown($('.stBoard'));
    if (W < 1180 || !b) return null;
    const h = clamp(H * 0.38, 200, 300);
    const x = b.right + Math.max(90, h * 0.45);
    if (x + 80 > W) return null;
    return { x, y: b.bottom, h, face: -1, bubble: 'top', phone };
  }
  if (ctx === 'ride') {
    if (phone) return { x: 44, y: H - 86, h: 100, face: 1, bubble: 'right', phone };
    const cr = document.getElementById('crTxt');
    const r = cr?.classList.contains('on') ? shown(cr) : null;
    const top = r ? r.bottom + 16 : 140;
    const ground = W < 1000 ? H - 92 : H - 28;
    const h = clamp(ground - top, 130, 290);
    return { x: (r ? r.left : 40) + h * 0.28, y: ground, h, face: 1, bubble: 'right', minTop: top, phone };
  }
  if (ctx === 'factory') {
    if (phone) return { x: 42, y: H - 92, h: 96, face: 1, bubble: 'right', phone };
    // Below 1000px the factory map strip spans the bottom, so stand above it.
    const h = clamp(H * 0.32, 160, 260);
    return { x: 40 + h * 0.28, y: W < 1000 ? H - 92 : H - 24, h, face: 1, bubble: 'right', phone };
  }
  return null;
}

export function initCharacterStage(): CharacterStage {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = document.createElement('div');
  wrap.id = 'gStage';
  wrap.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  wrap.appendChild(cv);
  const bubble = document.createElement('div');
  bubble.id = 'gBubble';
  bubble.hidden = true;
  wrap.appendChild(bubble);
  document.body.appendChild(wrap);

  // three.js setup. If WebGL isn't available the bubble still works, just without the figure.
  let R: THREE.WebGLRenderer | null = null;
  let rig: Rig | null = null;
  let anim: Animator | null = null;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  cam.position.z = 1000;
  try {
    R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    R.setClearColor(0x000000, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9dfc4, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-0.6, 1, 1.2);
    scene.add(sun);
    rig = buildFigure();
    scene.add(rig.root);
    anim = new Animator(rig, reduce);
  } catch (err) {
    console.warn('Guide character could not start WebGL; showing captions only.', err);
    cv.remove();
  }

  let size = [0, 0, 0];
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (size[0] === innerWidth && size[1] === innerHeight && size[2] === dpr) return;
    size = [innerWidth, innerHeight, dpr];
    cam.right = innerWidth;
    cam.bottom = -innerHeight;
    cam.updateProjectionMatrix();
    R?.setPixelRatio(dpr);
    R?.setSize(innerWidth, innerHeight, false);
  };

  // Where the character is now (it walks toward the target spot).
  let ctx: Ctx = 'hidden';
  let pos: { x: number; y: number; h: number } | null = null;
  let face: 1 | -1 = 1;
  let talking = false;
  let gesture: Gesture = 'none';
  let gestureUntil = 0;
  let pointSel: string | null = null;
  let lastLine = '';
  let restAt = 0;
  let fadeT0 = 0;

  const pointTarget = (): { x: number; y: number } => {
    const r = pointSel ? shown($(pointSel)) : null;
    if (r) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return { x: innerWidth * 0.62, y: innerHeight * 0.5 };
  };

  function place(sp: Spot) {
    if (!pos) return;
    const b = bubble;
    b.classList.toggle('top', sp.bubble === 'top');
    b.classList.toggle('phone', sp.phone);
    if (b.hidden) return;
    const { x, y, h } = pos;
    if (sp.bubble === 'top') {
      b.style.maxWidth = Math.min(380, innerWidth - 32) + 'px';
      const bw = b.offsetWidth, bh = b.offsetHeight;
      b.style.left = clamp(x - bw / 2, 16, innerWidth - 16 - bw) + 'px';
      b.style.top = Math.max(12, y - h * 1.04 - bh - 12) + 'px';
      return;
    }
    const left = x + h * (sp.phone ? 0.34 : 0.3) + 6;
    b.style.left = left + 'px';
    b.style.maxWidth = Math.max(160, Math.min(sp.phone ? 9999 : 420, innerWidth - left - 12)) + 'px';
    const bh = b.offsetHeight;
    let top = (sp.phone ? y : y - h * 0.5) - bh;
    if (sp.minTop != null && top < sp.minTop) top = sp.minTop;
    top = Math.min(top, innerHeight - 8 - bh);
    b.style.top = Math.max(8, top) + 'px';
  }

  let last = performance.now();
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const next = context();
    const sp = spotFor(next);
    if (!sp) {
      if (ctx !== 'hidden' || wrap.style.display !== 'none') wrap.style.display = 'none';
      ctx = 'hidden';
      pos = null;
      document.documentElement.style.removeProperty('--gReserve');
      return;
    }

    // Live with the scene it belongs to, so station panels (z-index 3) still cover it.
    const host = next === 'factory' ? document.body : document.getElementById('station')!;
    if (wrap.parentElement !== host) {
      host.appendChild(wrap);
      // The station marks other body children inert while the story plays; don't carry that over.
      wrap.inert = false;
    }
    if (next !== ctx || !pos) {
      // New scene: appear at the spot (fading in) instead of walking across the screen.
      pos = { x: sp.x, y: sp.y, h: sp.h };
      fadeT0 = now;
      ctx = next;
    }
    wrap.style.display = '';
    wrap.style.opacity = reduce ? '1' : String(clamp((now - fadeT0) / 350, 0, 1));
    face = sp.face;

    // Walk toward the spot when it moves within the same scene.
    let walk = 0;
    const dx = sp.x - pos.x;
    if (reduce || Math.abs(dx) < 2) pos.x = sp.x;
    else {
      const step = Math.sign(dx) * Math.min(Math.abs(dx), 480 * dt);
      pos.x += step;
      walk = 1;
      face = dx > 0 ? 1 : -1;
    }
    const k = reduce ? 1 : Math.min(1, dt * 6);
    pos.y += (sp.y - pos.y) * k;
    pos.h += (sp.h - pos.h) * k;

    // Gestures run out after their time; pointing ends shortly after the line does.
    if (gesture === 'wave' && now > gestureUntil) gesture = pointSel !== null || lastLine ? 'point' : 'none';
    if (gesture === 'celebrate' && now > gestureUntil) gesture = 'none';
    if (gesture === 'point' && !talking && now > restAt) gesture = 'none';

    resize();
    if (R && rig && anim) {
      const rotY = face * 0.42;
      rig.root.position.set(pos.x, -pos.y, 0);
      rig.root.scale.setScalar(pos.h);
      rig.root.rotation.y = rotY;
      rig.outline.value = 2.2 / pos.h;
      let aim = null;
      if (gesture === 'point') {
        const t = pointTarget();
        const arm: 0 | 1 = t.x >= pos.x ? 0 : 1;
        const sx = pos.x + (arm === 0 ? 1 : -1) * 0.138 * pos.h * Math.cos(rotY);
        const sy = pos.y - 0.785 * pos.h;
        aim = { arm, dx: t.x - sx, dy: -(t.y - sy) };
      }
      anim.update(dt, { talking, walk, gesture, aim, freeArm: face === 1 ? 1 : 0 });
      R.render(scene, cam);
    }
    place(sp);

    // On phones, tell the passport card and hint how much room the guide takes at the bottom.
    if (sp.phone && ctx === 'ride') {
      const topOfGuide = Math.min(pos.y - pos.h, bubble.hidden ? Infinity : bubble.getBoundingClientRect().top);
      document.documentElement.style.setProperty('--gReserve', Math.round(innerHeight - topOfGuide + 8) + 'px');
    } else document.documentElement.style.removeProperty('--gReserve');
  }
  requestAnimationFrame(frame);

  return {
    bubble,
    talk(on) {
      talking = on;
      if (!on) restAt = performance.now() + 600;
    },
    cue(id) {
      const now = performance.now();
      lastLine = id;
      pointSel = POINT_AT[id] ?? null;
      if (id === 'factory') {
        gesture = 'celebrate';
        gestureUntil = now + 1400;
      } else if (WAVE_LINES.has(id)) {
        gesture = 'wave';
        gestureUntil = now + 1600;
      } else gesture = 'point';
    },
  };
}
