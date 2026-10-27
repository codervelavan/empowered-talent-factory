import type * as THREE from 'three';
import type { P3 } from '../bridge';
import { i18n, tr } from '../app/i18n';
import { motion } from '../app/motion';
import { OpeningStage, type Size } from './opening-stage';

export interface OpeningFrame {
  pos: P3; look: P3; guide: P3; walking: boolean; wave: number;
  guideVisible: boolean; youVisible: boolean; build: number; done: boolean; stage: OpeningStage; reveal: boolean;
}
export type OpeningEnd = 'career' | 'workforce' | 'ai' | 'skip' | 'path' | 'enter';
export interface OpeningScene {
  note(state: number): void; select(person: number): void; run(cond: number, revised: boolean): void; reset(): void;
}
interface Beat { cap: string; line: string; eye: string; act?: string; done?: string; note?: string }
/** The narrative source for both the 3D opening and the readable standard page. */
export const BEATS: Beat[] = [
  { eye: '01 / THE OPPORTUNITY', cap: 'The next opportunity won’t wait.', line: 'A new enquiry lands. Drawings to check. Costs to estimate. A delivery date to promise. And a team already at capacity.' },
  { eye: '02 / THE PRESSURE', cap: 'Can you compete on time and price?', line: 'While you search scattered files, an AI-enabled competitor can prepare a response sooner—with less repetitive work.' },
  { eye: '03 / THE ADOPTION GAP', cap: 'Where should AI help? Who can make it work here?', line: 'More tools do not answer the real question: what should change in your business, and who can deliver it?' },
  { eye: '04 / THE GRADUATE', cap: 'How do I get experience before someone gives me a chance?', line: 'You have studied the tools. But employers want industrial experience—and AI keeps changing what the job asks of you.' },
  { eye: '05 / THE ENGINEER', cap: 'I know the work. How do I evolve with AI?', line: 'Your judgment, your industry knowledge, your experience: they matter. You need a practical way to bring AI into the work.' },
  { eye: '06 / THE CONNECTION', cap: 'Real business problems. Expert-led teams.', line: 'Put the enquiry on the shared workbench. An accountable expert leads; an engineer brings industrial judgment; a graduate contributes and learns.', act: 'Bring the team together', done: 'Connected. The expert scopes the work, the engineer checks assumptions, and the graduate prepares the information.' },
  { eye: '07 / THE PROOF', cap: 'Useful work for the business. Proven capability for the people.', line: 'A reviewed estimating workflow. Assumptions checked. Contributions recorded. A business can evaluate the output—and the people behind it.', note: 'An illustrative project, not a claim of measured savings or a job guarantee.' },
  { eye: '08 / YOUR NEXT CHAPTER', cap: 'Build what comes next. Together.', line: 'Step inside EmpowerED. Explore how we develop capability, engineer for real, verify readiness, and deploy with confidence.', act: 'Enter EmpowerED' },
];
const LAST = BEATS.length - 1, CONNECT = 5;
const clamp = (v: number, max = LAST) => Math.min(max, Math.max(0, v));

export class Opening {
  private playing = false;
  private onDone: ((end: OpeningEnd) => void) | null = null;
  private el: HTMLElement;
  private fade: HTMLElement;
  private stage: OpeningStage | null = null;
  private p = 0;
  private target = 0;
  private shown = -1;
  private connected = false;
  private reduce = false;
  private last = 0;
  private wheelAt = 0;
  private touchY: number | null = null;
  private drag: { id: number; x: number; y: number } | null = null;
  private exitTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private unsubMotion: (() => void) | null = null;
  private suppressClick = false;
  private inertBefore = new Map<HTMLElement, boolean>();
  private readonly onWheel = (e: WheelEvent) => {
    if (!this.playing || this.busy || this.reduce || (e.target as Element)?.closest('#menu,.opCard,.opWorkbench')) return;
    this.move(this.target + e.deltaY * .0015); this.wheelAt = performance.now();
  };
  private readonly onTouchStart = (e: TouchEvent) => {
    if (!(e.target as Element)?.closest('button,.opCard,#menu,.opWorkbench')) this.touchY = e.touches[0].clientY;
  };
  private readonly onTouchMove = (e: TouchEvent) => {
    if (this.touchY === null || this.reduce || this.drag) return;
    const y = e.touches[0].clientY; this.move(this.target + (this.touchY - y) * .008);
    this.touchY = y; this.wheelAt = performance.now();
  };
  private readonly onTouchEnd = () => { this.touchY = null; };
  private readonly onKey = (e: KeyboardEvent) => {
    if ((e.target as Element)?.closest('input,textarea,select,#menu')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); this.step(1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.step(-1); }
  };
  private readonly onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.stage?.pointer(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2);
  };
  constructor(_addWorld: (o: THREE.Object3D) => void, private lobby: () => { guide: P3; cam: [P3, P3] }, private scene: () => OpeningScene | null) {
    this.el = document.createElement('div'); this.el.id = 'opening'; this.el.hidden = true;
    this.el.innerHTML = `<div class="opMast"><span>EmpowerED<span class="opMastDot"> / </span></span><span class="opMastLabel"></span></div>
      <div class="opGrain" aria-hidden="true"></div><div class="opIndex" aria-hidden="true"></div>
      <section class="opCard" aria-labelledby="opCap" aria-roledescription="story">
        <p class="opStep" aria-live="polite" aria-atomic="true"></p><h1 class="opCap" id="opCap"></h1><p class="opLine"></p>
        <div class="opActs"></div><p class="opDone" role="status"></p><p class="opNote"></p>
        <nav class="opNav" aria-label="Story navigation"><button type="button" class="opBack"></button><button type="button" class="opNext"></button></nav>
      </section><div class="opWorkbench" hidden><button type="button" class="opEnquiry"><span class="opSheetIcon" aria-hidden="true">↗</span><span></span></button><div class="opDrop"><span aria-hidden="true">＋</span><b></b></div></div>
      <button type="button" class="opSkip"></button><p class="opHint"></p>
      <div class="opRail" role="progressbar" aria-valuemin="1" aria-valuemax="8"><i></i></div>`;
    this.fade = document.createElement('div'); this.fade.id = 'opFade'; document.body.append(this.el, this.fade);
    this.q<HTMLButtonElement>('.opSkip').onclick = () => this.finish('skip');
    this.q<HTMLButtonElement>('.opBack').onclick = () => this.step(-1);
    this.q<HTMLButtonElement>('.opNext').onclick = () => this.step(1);
    const sheet = this.q<HTMLButtonElement>('.opEnquiry');
    sheet.onclick = () => { if (!this.suppressClick) this.connect(); };
    sheet.onpointerdown = e => {
      if (this.connected || e.button !== 0) return;
      this.suppressClick = false; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; sheet.setPointerCapture(e.pointerId);
    };
    sheet.onpointermove = e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      sheet.style.transform = `translate(${e.clientX - this.drag.x}px,${e.clientY - this.drag.y}px) rotate(-5deg)`;
      const r = this.q('.opDrop').getBoundingClientRect();
      this.q('.opDrop').classList.toggle('over', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    };
    const release = (e: PointerEvent, cancelled = false) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 8;
      const r = this.q('.opDrop').getBoundingClientRect();
      const hit = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      this.drag = null; this.suppressClick = moved || cancelled; sheet.style.transform = ''; this.q('.opDrop').classList.remove('over');
      if (sheet.hasPointerCapture(e.pointerId)) sheet.releasePointerCapture(e.pointerId);
      if (!cancelled && hit) this.connect();
      setTimeout(() => { this.suppressClick = false; }, 0);
    };
    sheet.onpointerup = e => release(e); sheet.onpointercancel = e => release(e, true);
    i18n.on(() => { if (this.playing) this.paint(this.shown); });
  }
  private q<T extends HTMLElement = HTMLElement>(s: string) { return this.el.querySelector<T>(s)!; }
  get active() { return this.playing; }
  get beat() { return Math.round(this.target); }
  start(onDone: (end: OpeningEnd) => void, reduce: boolean) {
    if (this.playing) { this.onDone = null; this.finish('path'); }
    this.onDone = onDone; this.playing = true; this.reduce = reduce;
    this.p = this.target = 0; this.shown = -1; this.connected = false; this.busy = false;
    this.wheelAt = 0; this.touchY = null; this.last = performance.now(); this.stage = new OpeningStage();
    this.el.hidden = false; this.el.classList.remove('isConnected'); document.documentElement.classList.add('opening'); this.fade.className = '';
    addEventListener('wheel', this.onWheel, { passive: true }); addEventListener('touchstart', this.onTouchStart, { passive: true });
    addEventListener('touchmove', this.onTouchMove, { passive: true }); addEventListener('touchend', this.onTouchEnd);
    addEventListener('keydown', this.onKey); addEventListener('pointermove', this.onPointer);
    this.unsubMotion = motion.on(reduced => { this.reduce = reduced; this.p = this.target = Math.round(this.target); this.wheelAt = 0; this.paint(this.beat); });
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement) || ['top','opening','opFade'].includes(node.id) || node.tagName === 'SCRIPT') continue;
      this.inertBefore.set(node, node.inert); node.inert = true;
    }
    this.scene()?.reset(); this.paint(0); this.q('.opNext').focus({ preventScroll: true });
  }
  private move(value: number) { if (this.playing && !this.busy) this.target = clamp(value, this.connected ? LAST : CONNECT); }
  step(direction: number) {
    if (!this.playing || this.busy) return;
    if (direction > 0 && this.beat === CONNECT && !this.connected) { this.el.querySelector<HTMLElement>('.opAct')?.focus(); return; }
    this.move(Math.round(this.target) + direction);
    if (this.reduce) { this.p = this.target; this.paint(this.beat); }
  }
  private connect() {
    if (!this.playing || this.shown !== CONNECT || this.connected) return;
    this.connected = true; this.drag = null; this.el.classList.add('isConnected'); this.q('.opEnquiry').style.transform = '';
    this.paint(CONNECT); this.q('.opNext').focus({ preventScroll: true });
  }
  private enter() {
    if (this.busy) return;
    if (this.reduce) { this.finish('enter'); return; }
    this.busy = true; this.fade.className = 'opWipe';
    this.exitTimer = setTimeout(() => { this.exitTimer = null; this.finish('enter'); this.fade.className = 'opReveal'; }, 440);
  }
  finish(end: OpeningEnd) {
    if (!this.playing) return;
    if (this.exitTimer) clearTimeout(this.exitTimer);
    this.exitTimer = null; this.busy = false; this.playing = false; this.el.hidden = true;
    document.documentElement.classList.remove('opening'); this.fade.className = '';
    removeEventListener('wheel', this.onWheel); removeEventListener('touchstart', this.onTouchStart); removeEventListener('touchmove', this.onTouchMove);
    removeEventListener('touchend', this.onTouchEnd); removeEventListener('keydown', this.onKey); removeEventListener('pointermove', this.onPointer);
    this.inertBefore.forEach((inert, node) => { node.inert = inert; }); this.inertBefore.clear();
    this.unsubMotion?.(); this.unsubMotion = null; this.drag = null; this.stage?.dispose(); this.stage = null;
    const sc = this.scene(); sc?.select(-1); sc?.reset(); sc?.note(2);
    const cb = this.onDone; this.onDone = null; cb?.(end);
  }
  private paint(beat: number) {
    if (beat < 0) return;
    const focusNext = document.activeElement === this.q('.opNext');
    this.shown = beat; this.el.dataset.beat = String(beat); const b = BEATS[beat];
    this.q('.opStep').textContent = tr(b.eye); this.q('.opCap').textContent = tr(b.cap); this.q('.opLine').textContent = tr(b.line);
    this.q('.opMastLabel').textContent = tr('THE AI TALENT COMPANY'); this.q('.opIndex').textContent = String(beat + 1).padStart(2, '0');
    this.q('.opDone').textContent = beat === CONNECT && this.connected ? tr(b.done!) : ''; this.q('.opNote').textContent = tr(b.note || '');
    this.q('.opBack').textContent = '← ' + tr('Back'); this.q<HTMLButtonElement>('.opBack').disabled = beat === 0;
    this.q('.opNext').textContent = tr('Continue') + ' →'; this.q<HTMLButtonElement>('.opNext').disabled = beat === CONNECT && !this.connected;
    this.q('.opNext').hidden = beat === LAST; this.q('.opSkip').textContent = tr('Skip opening') + ' ↗';
    this.q('.opHint').textContent = tr(this.reduce ? 'Use Back and Continue to explore' : 'Scroll to follow the work');
    this.q('.opNav').setAttribute('aria-label', tr('Story navigation'));
    this.q('.opRail').setAttribute('aria-label', tr('Story progress')); this.q('.opRail').setAttribute('aria-valuenow', String(beat + 1));
    this.q('.opRail').setAttribute('aria-valuetext', `${beat + 1} / ${BEATS.length}: ${tr(b.cap)}`);
    this.q('.opRail i').style.width = `${(beat + 1) / BEATS.length * 100}%`;
    this.q('.opWorkbench').hidden = beat !== CONNECT;
    this.q('.opEnquiry span:last-child').textContent = tr(this.connected ? 'Enquiry connected' : 'Your enquiry');
    this.q('.opEnquiry').setAttribute('aria-label', tr('Place the enquiry on the shared workbench')); this.q<HTMLButtonElement>('.opEnquiry').disabled = this.connected;
    this.q('.opDrop b').textContent = tr(this.connected ? 'Expert-led team' : 'Shared workbench');
    const acts = this.q('.opActs'); acts.replaceChildren();
    if (b.act) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'opAct'; button.textContent = tr(b.act) + (beat === LAST ? ' ↗' : '');
      if (beat === CONNECT) { button.setAttribute('aria-pressed', String(this.connected)); button.disabled = this.connected; }
      button.onclick = () => beat === LAST ? this.enter() : this.connect(); acts.append(button);
    }
    if (beat === LAST && focusNext) this.q('.opAct').focus({ preventScroll: true });
    this.q('.opCard').scrollTop = 0;
  }
  frame(now: number, size: Size): OpeningFrame {
    const dt = Math.min(.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
    if (this.wheelAt && now - this.wheelAt > 240) { this.target = Math.round(this.target); this.wheelAt = 0; }
    if (this.reduce) this.p = this.target; else this.p += (this.target - this.p) * (1 - Math.exp(-dt * 7));
    const b = Math.round(this.p); if (b !== this.shown) { if (b === LAST && !this.reduce) this.fade.className = 'opSceneReveal'; this.paint(b); }
    this.stage!.frame(this.p, this.connected, this.reduce, size, now, dt);
    const l = this.lobby();
    return { pos: l.cam[0], look: l.cam[1], guide: l.guide, walking: false, wave: 0, guideVisible: false, youVisible: false, build: 1, done: false, stage: this.stage!, reveal: this.p > 6.5 };
  }
}
