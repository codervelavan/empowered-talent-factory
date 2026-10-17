// The POD mission activity at the Engineer stop: choose who to watch, run a prepared machine cycle
// under a condition, inspect the false alert and the team's revision. It owns the mission state, talks
// to the 3D scene through the bridge and asks the story camera to focus. Nothing here is a live system.

import type { FactoryApi, P3 } from '../bridge';
import type { StoryActivity } from '../story/guide';
import { MAINTENANCE, MAINTENANCE_GOAL, type Mission } from './missions';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export interface MissionHost {
  factory(): FactoryApi | undefined;
  /** Focus the camera at the mission's room (null: the room's own view). */
  focus(pose: [P3, P3] | null): void;
  /** Ask the panel to re-render (state changed outside a click, e.g. a cycle finished). */
  changed(): void;
}

/** The default room camera looks from here; person close-ups are framed from the same side. */
const VIEW_FROM: P3 = [21.6, 3.6, -17.4];

export class PodMission implements StoryActivity {
  readonly m: Mission = MAINTENANCE;
  sel = -1;
  cond = -1;
  revised = false;
  view: 'team' | 'machine' | 'person' = 'team';
  private lastKey = '';

  constructor(private h: MissionHost) {}

  /** Camera framings: the whole team, the machine and its traces, or one person and their work.
   *  On phones the panel docks at the bottom, so pull back and look lower: the subject sits in the top part. */
  pose(): [P3, P3] | null {
    const p = this.basePose();
    if (!p || (innerWidth > 760 && innerHeight > 500)) return p;
    const [c, l] = p, back = innerHeight <= 500 ? 1.15 : 1.45;
    // Stay under the upper walkway (y 6): pull back horizontally only.
    const cam: P3 = [l[0] + (c[0] - l[0]) * back, Math.min(4.6, c[1] + 0.3), l[2] + (c[2] - l[2]) * back];
    return innerHeight <= 500 ? [cam, l] : [cam, [l[0], l[1] - 1.5, l[2]]];
  }

  private basePose(): [P3, P3] | null {
    if (this.view === 'machine') return [[16.4, 4.3, -23.8], [14.6, 2.1, -32.6]];
    if (this.view === 'person' && this.sel >= 0) {
      const p = this.m.people[this.sel];
      // Three-quarter front view: turn the person-from-work direction 50 degrees toward the room camera's side.
      const fx = p.at[0] - p.art[0], fz = p.at[2] - p.art[2], L = Math.hypot(fx, fz) || 1;
      const turn = (a: number): [number, number] => [(fx * Math.cos(a) + fz * Math.sin(a)) / L, (-fx * Math.sin(a) + fz * Math.cos(a)) / L];
      const [ax, az] = turn(0.9), [bx, bz] = turn(-0.9);
      const toward = (x: number, z: number) => x * (VIEW_FROM[0] - p.at[0]) + z * (VIEW_FROM[2] - p.at[2]);
      const [dx, dz] = toward(ax, az) >= toward(bx, bz) ? [ax, az] : [bx, bz];
      const mid: P3 = [(p.at[0] + p.art[0]) / 2, 1.3, (p.at[2] + p.art[2]) / 2];
      return [[mid[0] + dx * 4, 2.6, mid[2] + dz * 4], mid];
    }
    return [[20.8, 4.8, -20.4], [14.6, 1.5, -31.2]];
  }

  key(): string {
    const st = this.h.factory()?.podState();
    return [this.sel, this.cond, this.revised, this.view, st ? (st.done ? 'd' : st.ran ? 'r' : '-') + (st.alert ? 'A' : '') : ''].join('|');
  }

  /** Called every frame: re-render when a running cycle reaches a new state (alert, done). */
  tick() {
    if (this.cond < 0) return;
    const k = this.key();
    if (k !== this.lastKey) { this.lastKey = k; this.h.changed(); }
  }

  /** Entering the stop: show the whole team. */
  enter() { this.view = 'team'; this.h.focus(this.pose()); }

  act(a: string) {
    const F = this.h.factory();
    const [k, v] = a.split(':');
    if (k === 'view') { this.view = v === 'machine' ? 'machine' : 'team'; if (this.view === 'team') { this.sel = -1; F?.podSelect(-1); } }
    else if (k === 'p') { const i = +v; this.sel = this.sel === i && this.view === 'person' ? -1 : i; this.view = this.sel >= 0 ? 'person' : 'team'; F?.podSelect(this.sel); }
    else if (k === 'c') { this.cond = +v; this.revised = false; this.view = 'machine'; F?.podRun(this.cond, false); }
    else if (k === 'revise') { this.revised = true; this.view = 'machine'; F?.podRun(1, true); }
    else if (k === 'reset') { this.cond = -1; this.revised = false; F?.podReset(); }
    this.h.focus(this.pose());
    this.lastKey = this.key();
  }

  html(): string {
    const m = this.m, st = this.h.factory()?.podState();
    const pressed = (b: boolean) => `aria-pressed="${b}"`;
    let h = `<section class="pm" aria-label="${esc(m.title)}"><p class="pmTag">${esc(m.status)}</p><h4 class="pmH">${esc(m.headline)}</h4><p class="pmP">${esc(m.problem)}</p>`;
    h += `<div class="pmViews" role="group" aria-label="What to look at"><button type="button" data-pod="view:team" ${pressed(this.view === 'team')}>The whole team</button><button type="button" data-pod="view:machine" ${pressed(this.view === 'machine')}>The machine</button></div>`;
    h += `<small class="pmL">Who does what</small><ul class="pmPeople">` + m.people.map((p, i) =>
      `<li><button type="button" data-pod="p:${i}" ${pressed(this.sel === i)}><b>${esc(p.task)}</b><span>${esc(p.role)}</span></button></li>`).join('') + '</ul>';
    if (this.sel >= 0) {
      const p = m.people[this.sel];
      h += `<div class="pmPerson" role="status"><small>${esc(p.role)} · example</small><p><b>Work to inspect:</b> ${esc(p.artifact)}</p><p><b>What review changed:</b> ${esc(p.review)}</p></div>`;
    }
    h += `<small class="pmL">Try a machine condition</small><div class="pmConds" role="group" aria-label="Run a prepared machine cycle">` + m.conditions.map((c, i) =>
      `<button type="button" data-pod="c:${i}" ${pressed(this.cond === i)}>${esc(c.label)}</button>`).join('') + '</div>';
    if (this.cond >= 0 && st) {
      const c = m.conditions[this.cond];
      let out = esc(c.what) + ' ';
      if (!st.done) out += 'Running the example cycle…';
      else if (this.cond === 0) out += 'No alert. This is the baseline the team compares against.';
      else if (this.cond === 1 && !this.revised) out += st.alert ? 'The first version raised an alert.' : 'No alert.';
      else if (this.cond === 1) out += 'No alert: the reading is expected during a scheduled heavy cut.';
      else out += 'Alert: early wear signs, shown with the operating context. A technician decides when to inspect.';
      h += `<p class="pmOut" role="status">${out}</p>`;
      if (st.done && this.cond === 1 && !this.revised && st.alert)
        h += `<div class="pmFind"><b>Finding: a false alert.</b><p>The heavy cut was planned, so the high reading was expected. An alert here would teach technicians to ignore the screen.</p><button type="button" data-pod="revise">See the team’s revision</button></div>`;
      if (st.done && this.cond === 1 && this.revised)
        h += `<div class="pmFind pmOk"><b>Revised.</b><p>${esc(m.people[0].review)}</p><button type="button" data-pod="p:0">Who made this change?</button></div>`;
      if (st.done && this.cond === 2) h += `<p class="pmGoal">${esc(MAINTENANCE_GOAL)}</p>`;
    }
    return h + '</section>';
  }
}
