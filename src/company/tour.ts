// The company tour: a continuous, scroll-driven camera through a fixed list of stops
// (camera workflow taken from the web2ite "immersive company" prototype). Page scroll
// sets the target stop; the camera eases toward it, can be dragged to look around, and
// each stop has a HUD card, glowing hotspots and a place on the stage map.
import type { P3, ScreenPoint } from '../bridge';

export type TourRoute = 'career' | 'workforce' | 'story';

export interface TourHotspot {
  /** World position of the marker. */
  at: P3;
  label: string;
  run(): void;
}

export interface TourStop {
  id: string;
  /** Short name on the stage map. */
  label: string;
  eyebrow: string;
  title: string;
  copy: string;
  /** Camera position and look-at target. */
  pose(): [P3, P3];
  action?: { label: string; run(): void };
  hotspots?: TourHotspot[];
  /** Stops that share a room show as one place on the stage map (story beats). */
  room?: string;
}

export interface TourHost {
  project(x: number, y: number, z: number): ScreenPoint;
  /** Called when the nearest stop changes, and again once the camera settles there. */
  onStop(route: TourRoute, index: number, settled: boolean): void;
  /** The visitor chose a route on the Company stop. */
  onRoute(route: TourRoute): void;
  /** Optional camera path between stop i and i+1 at eased progress e (e.g. along an existing curve). */
  between?(route: TourRoute, i: number, e: number): [P3, P3] | null;
  /** Every frame: continuous position, for overlays that follow the camera (the story guide). */
  frame?(route: TourRoute, v: number, settled: boolean, dt: number): void;
  /** While true (a detail panel is open) scrolling must not move the tour. */
  paused?(): boolean;
}

export interface TourFrame {
  pos: P3;
  look: P3;
  /** Continuous stop position, e.g. 2.4 is between stops 2 and 3. */
  v: number;
  /** Nearest stop. */
  index: number;
  settled: boolean;
}

const REDUCE_KEY = 'ee-reduce-motion';
function readReduce(): boolean {
  try { const v = localStorage.getItem(REDUCE_KEY); if (v === '1' || v === '0') return v === '1'; } catch { /* storage blocked */ }
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One stop takes this many viewport heights of scrolling. */
const SEG = 1.15;
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class Tour {
  active = false;
  route: TourRoute = 'story';
  private stops: TourStop[] = [];
  private current = 0;
  private target = 0;
  private yaw = 0;
  private pitch = 0;
  private drag: { x: number; y: number } | null = null;
  private shownCard = -1;
  private lastIndex = -1;
  private lastSettled = false;
  private held = false;
  /** Stop a button or key asked for, and the scroll position this tour last set while moving there. */
  private goal: number | null = null;
  private setY = -1;
  /** Reduced motion: the system setting, unless the visitor chose otherwise in the guide panel. */
  reduce = readReduce();

  private readonly hud: HTMLElement;
  private readonly map: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly hots: HTMLElement;
  private readonly hint: HTMLElement;
  private hotEls: HTMLButtonElement[] = [];

  constructor(
    private readonly host: TourHost,
    private readonly routes: Record<TourRoute, TourStop[]>,
    private readonly track: HTMLElement,
  ) {
    this.hud = document.createElement('aside');
    this.hud.id = 'tourHud';
    this.hud.setAttribute('aria-live', 'polite');
    this.map = document.createElement('nav');
    this.map.id = 'tourMap';
    this.map.setAttribute('aria-label', 'Journey stops');
    this.fill = document.createElement('div');
    this.fill.id = 'tourFill';
    this.hots = document.createElement('div');
    this.hots.id = 'tourHots';
    this.hint = document.createElement('div');
    this.hint.id = 'tourHint';
    this.hint.textContent = 'Scroll to move · Drag to look · Select a glowing marker';
    const progress = document.createElement('div');
    progress.id = 'tourProgress';
    progress.appendChild(this.fill);
    const hud = document.getElementById('hud') ?? document.body;
    hud.append(this.hots, this.hud, this.hint, this.map, progress);
    this.setVisible(false);
    this.bindInput();
  }

  /** Replace a route's stops (the story grows once the visitor picks a path). */
  setStops(route: TourRoute, stops: TourStop[]): void {
    this.routes[route] = stops;
    if (this.route === route && this.active) { this.stops = stops; this.track.style.height = ((stops.length - 1) * SEG + 1) * 100 + 'vh'; this.buildMap(); this.shownCard = -1; }
  }

  /** Begin (or switch to) a route, at a stop. */
  start(route: TourRoute, at = 0): void {
    const changed = route !== this.route || !this.active;
    this.route = route;
    this.stops = this.routes[route];
    this.active = true;
    document.documentElement.dataset.route = route;
    this.track.style.height = ((this.stops.length - 1) * SEG + 1) * 100 + 'vh';
    if (changed) { this.buildMap(); this.shownCard = -1; this.lastIndex = -1; }
    this.setVisible(true);
    this.jump(at);
  }

  stop(): void {
    this.active = false;
    delete document.documentElement.dataset.route;
    this.setVisible(false);
    this.track.style.height = '';
  }

  /** Move to a stop at walking pace (buttons and keys). A new request replaces the old one; scrolling cancels it. */
  travel(i: number): void {
    if (!this.active) return;
    i = clamp(Math.round(i), 0, this.stops.length - 1);
    if (this.reduce) { this.goal = null; scrollTo({ top: i * SEG * innerHeight, behavior: 'instant' }); return; }
    this.goal = i;
    this.setY = -1;
  }

  /** Jump to a stop without animating the camera there. */
  jump(i: number): void {
    i = clamp(i, 0, this.stops.length - 1);
    this.goal = null;
    this.current = this.target = i;
    scrollTo({ top: i * SEG * innerHeight, behavior: 'instant' });
  }

  /** Turn reduced motion on or off and remember the choice on this device. */
  setReduce(on: boolean): void {
    this.reduce = on;
    try { localStorage.setItem(REDUCE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
    if (on && this.goal !== null) { const g = this.goal; this.goal = null; scrollTo({ top: g * SEG * innerHeight, behavior: 'instant' }); }
  }

  get count(): number { return this.stops.length; }
  get index(): number { return Math.round(this.current); }

  update(dt: number): TourFrame {
    dt = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
    const n = this.stops.length;
    // innerHeight can be 0 while the page is hidden; never let NaN into the camera.
    // While details are open the tour holds its stop; afterwards the page returns to that stop.
    const paused = !!this.host.paused?.();
    if (paused) this.held = true;
    else if (this.held) { this.held = false; scrollTo({ top: Math.round(this.target) * SEG * innerHeight, behavior: 'instant' }); }
    // A requested move walks the target toward its stop and keeps the page scroll in step,
    // unless the visitor scrolls themselves (then scrolling wins).
    if (this.goal !== null && this.setY >= 0 && Math.abs(scrollY - this.setY) > 3) this.goal = null;
    if (this.goal !== null && !paused && innerHeight > 0) {
      const left = this.goal - this.target, step = dt * (0.5 + Math.min(1.5, Math.abs(left) * 0.6));
      this.target = Math.abs(left) <= step ? this.goal : this.target + Math.sign(left) * step;
      if (this.target === this.goal) this.goal = null;
      this.setY = Math.round(this.target * SEG * innerHeight);
      scrollTo({ top: this.setY, behavior: 'instant' });
      this.setY = Math.round(scrollY);
    } else {
      const t = innerHeight > 0 && !paused ? scrollY / (SEG * innerHeight) : this.target;
      this.target = clamp(Number.isFinite(t) ? t : 0, 0, n - 1);
    }
    if (!Number.isFinite(this.current)) this.current = this.target;
    this.current = this.reduce ? this.target : this.current + (this.target - this.current) * (1 - Math.exp(-dt * 5));
    if (Math.abs(this.target - this.current) < 0.0005) this.current = this.target;
    const v = this.current;
    const i = Math.min(n - 2, Math.floor(v));
    const f = n > 1 ? clamp(v - i, 0, 1) : 0;
    const e = this.reduce ? (f < 0.5 ? 0 : 1) : sm(0.08, 0.92, f);
    let pos: P3, look: P3;
    const curve = n > 1 ? this.host.between?.(this.route, Math.max(0, i), e) : null;
    if (curve) [pos, look] = [[...curve[0]] as P3, [...curve[1]] as P3];
    else {
      const [p0, l0] = this.stops[Math.max(0, i)].pose();
      const [p1, l1] = this.stops[Math.min(n - 1, i + 1)].pose();
      pos = lerp3(p0, p1, e);
      look = lerp3(l0, l1, e);
      // Lift the camera a little on long moves so it glides over the building instead of through it.
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      pos[1] += Math.sin(Math.PI * e) * Math.min(8, dist * 0.12);
    }

    const moving = Math.abs(this.target - this.current) > 0.02;
    if (moving && !this.drag) {
      const k = Math.min(1, dt * 3);
      this.yaw -= this.yaw * k;
      this.pitch -= this.pitch * k;
    }
    if (this.yaw || this.pitch) {
      const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw), len = Math.hypot(dx, dy, dz);
      look[0] = pos[0] + dx * c + dz * s;
      look[2] = pos[2] - dx * s + dz * c;
      look[1] = pos[1] + dy + this.pitch * len;
    }

    const index = Math.round(v);
    const settled = Math.abs(v - index) < 0.03 && !moving;
    if (index !== this.lastIndex || settled !== this.lastSettled) {
      this.lastIndex = index;
      this.lastSettled = settled;
      this.host.onStop(this.route, index, settled);
    }
    this.paint(index, v, settled);
    this.host.frame?.(this.route, v, settled, dt);
    return { pos, look, v, index, settled };
  }

  private setVisible(on: boolean) {
    for (const el of [this.hud, this.map, this.fill.parentElement!, this.hots, this.hint]) {
      el.style.visibility = on ? 'visible' : 'hidden';
      el.style.opacity = on ? '1' : '0';
    }
  }

  private buildMap() {
    const n = this.stops.length;
    this.map.innerHTML =
      '<button type="button" class="tPrev" aria-label="Previous stop">←</button><ol>' +
      this.stops.map((s, i) => (s.room && i > 0 && this.stops[i - 1].room === s.room) ? '' : `<li><button type="button" data-ts="${i}" aria-label="Go to ${s.label}"><i></i><span>${s.label}</span></button></li>`).join('') +
      '</ol><button type="button" class="tNext">Next <span aria-hidden="true">→</span></button>';
    this.map.querySelectorAll<HTMLButtonElement>('[data-ts]').forEach((b) => (b.onclick = () => this.travel(+b.dataset.ts!)));
    this.map.querySelector<HTMLButtonElement>('.tPrev')!.onclick = () => this.travel(this.index - 1);
    this.map.querySelector<HTMLButtonElement>('.tNext')!.onclick = () => this.travel(this.index + 1);
    this.hots.innerHTML = '';
    this.hotEls = [];
    void n;
  }

  private paint(index: number, v: number, settled: boolean) {
    const n = this.stops.length;
    this.fill.style.width = (n > 1 ? (v / (n - 1)) * 100 : 0) + '%';
    // With rooms, the current dot is the room the current beat belongs to.
    const roomStart = (k: number) => { const rm = this.stops[k]?.room; if (!rm) return k; while (k > 0 && this.stops[k - 1].room === rm) k--; return k; };
    const cur = roomStart(index);
    this.map.querySelectorAll<HTMLElement>('[data-ts]').forEach((b) => {
      const i = +b.dataset.ts!;
      b.classList.toggle('on', i === cur);
      b.classList.toggle('past', i < cur);
      if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    const next = this.map.querySelector<HTMLButtonElement>('.tNext')!;
    next.disabled = index >= n - 1;
    this.map.querySelector<HTMLButtonElement>('.tPrev')!.disabled = index <= 0;
    if (index !== this.shownCard) this.fillCard(index);
    this.hud.classList.toggle('dim', !settled && Math.abs(v - index) > 0.3);
    this.placeHotspots(index, settled);
  }

  private fillCard(i: number) {
    this.shownCard = i;
    const s = this.stops[i];
    const n = this.stops.length;
    const pad = (x: number) => String(x).padStart(2, '0');
    const routeChoice = i === 0 && this.route !== 'story'
      ? `<div class="tRoutes" role="group" aria-label="Choose your journey">
          <button type="button" data-tr="career" class="${this.route === 'career' ? 'on' : ''}"><b>Build Career <span aria-hidden="true">↗</span></b><span>Inside the company · Students and professionals</span></button>
          <button type="button" data-tr="workforce" class="${this.route === 'workforce' ? 'on' : ''}"><b>Build Workforce <span aria-hidden="true">↗</span></b><span>Around the building · Enterprise, university and government</span></button>
        </div>`
      : '';
    this.hud.innerHTML =
      `<div class="tEye"><span>${s.eyebrow}</span><span>${s.room ? '' : pad(i + 1) + ' / ' + pad(n)}</span></div>` +
      `<h2>${s.title}</h2><p>${s.copy}</p>` + routeChoice +
      (s.action ? `<button type="button" class="tAct">${s.action.label} <span aria-hidden="true">↗</span></button>` : '');
    this.hud.querySelectorAll<HTMLButtonElement>('[data-tr]').forEach((b) => {
      b.onclick = () => {
        const r = b.dataset.tr as TourRoute;
        if (r !== this.route) { this.host.onRoute(r); this.start(r, 0); }
        this.travel(1);
      };
    });
    const act = this.hud.querySelector<HTMLButtonElement>('.tAct');
    if (act && s.action) act.onclick = () => s.action!.run();
  }

  private placeHotspots(index: number, settled: boolean) {
    const hs = settled ? this.stops[index].hotspots ?? [] : [];
    while (this.hotEls.length < hs.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tHot';
      b.innerHTML = '<i></i><span></span>';
      this.hots.appendChild(b);
      this.hotEls.push(b);
    }
    this.hotEls.forEach((b, k) => {
      const h = hs[k];
      if (!h) { b.hidden = true; return; }
      const p = this.host.project(...h.at);
      const onScreen = p.vis && p.x > 20 && p.x < innerWidth - 20 && p.y > 70 && p.y < innerHeight - 90;
      b.hidden = !onScreen;
      if (!onScreen) return;
      b.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      b.querySelector('span')!.textContent = h.label;
      b.setAttribute('aria-label', h.label);
      b.onclick = () => h.run();
    });
  }

  private bindInput() {
    const skip = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('button,a,input,select,textarea,aside,nav,header,dialog,#cDrawer,#tourHud,#tourMap');
    addEventListener('pointerdown', (e) => {
      if (!this.active || e.button > 0 || skip(e.target)) return;
      this.drag = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.yaw = clamp(this.yaw - (e.clientX - this.drag.x) * 0.0035, -0.75, 0.75);
      this.pitch = clamp(this.pitch + (e.clientY - this.drag.y) * 0.002, -0.35, 0.35);
      this.drag = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
    });
    const end = () => { if (this.drag) { this.drag = null; document.body.style.cursor = ''; } };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('keydown', (e) => {
      if (!this.active || e.defaultPrevented) return;
      const t = e.target as Element | null;
      if (t?.closest?.('input,textarea,select,[contenteditable],dialog,#cDrawer.open')) return;
      if (document.getElementById('cDrawer')?.classList.contains('open')) return;
      const k = e.key;
      const d = k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown' ? 1 : k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      if (!e.repeat) this.travel(this.index + d);
    });
  }
}
