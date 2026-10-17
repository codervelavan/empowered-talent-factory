// The predictive-maintenance POD mission across the guided route. One shared state (who is selected,
// whether the records were fixed), four activities shown inside guide stops:
//   records  (Develop)  check a week of machine records and add the missing job
//   pod      (Engineer) the machine and team: pick a person, run a prepared machine condition
//   report   (Verify)   one person's sample ETAF report
//   employer (Deploy)   what an employer can inspect, and how to take interest further
// It talks to the 3D scene through the bridge and asks the story camera to focus. Nothing is live.

import type { FactoryApi, P3 } from '../bridge';
import type { StoryActivity } from '../story/guide';
import { MAINTENANCE, MAINTENANCE_GOAL, RECORDS, REPORTS, type Mission } from './missions';
import { tr, i18n } from '../app/i18n';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const t = (s: string) => esc(tr(s));

export interface MissionHost {
  factory(): FactoryApi | undefined;
  /** Focus the camera at the mission's room (null: the room's own view). */
  focus(pose: [P3, P3] | null): void;
  /** Go to another room on the current guided route (e.g. 'engineer', 'verify'). */
  goRoom(room: string): void;
  /** Show the honest "not available yet" message for an engagement action. */
  enquire(label: string): void;
}

/** The default room camera looks from here; person close-ups are framed from the same side. */
const VIEW_FROM: P3 = [21.6, 3.6, -17.4];
const SAVE = 'ee-mission';

export class PodMission {
  readonly m: Mission = MAINTENANCE;
  sel = -1;
  cond = -1;
  revised = false;
  view: 'team' | 'machine' | 'person' = 'team';
  /** Develop: 0 not checked, 1 gap found, 2 job schedule added. */
  records = 0;
  /** Verify: whose report is open. */
  reportOf = 0;

  constructor(private h: MissionHost) {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (Number.isInteger(d.sel) && d.sel >= -1 && d.sel < this.m.people.length) this.sel = d.sel;
      if (d.records === 2) this.records = 2;
      if (Number.isInteger(d.reportOf) && d.reportOf >= 0 && d.reportOf < this.m.people.length) this.reportOf = d.reportOf;
    } catch { /* storage blocked or bad data */ }
  }

  private save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ sel: this.sel, records: this.records === 2 ? 2 : 0, reportOf: this.reportOf })); } catch { /* storage blocked */ }
  }

  /** The activity shown in a stop, by id. */
  activity(id: string): StoryActivity | null {
    const key = () => this.key(id), act = (a: string) => this.act(id, a);
    if (id === 'pod') return { html: () => this.podHtml(), key, act };
    if (id === 'records') return { html: () => this.recordsHtml(), key, act };
    if (id === 'report') return { html: () => this.reportHtml(), key, act };
    if (id === 'employer') return { html: () => this.employerHtml(), key, act };
    return null;
  }

  // ---- Camera ---------------------------------------------------------------------------
  /** Framings: the whole team, the machine and its traces, or one person and their work.
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

  /** Arriving at the Engineer stop: frame the selected person (if any), else the whole team. */
  enter() { this.view = this.sel >= 0 && this.view === 'person' ? 'person' : 'team'; this.h.factory()?.podSelect(this.sel); this.h.focus(this.pose()); }

  // ---- State and actions ----------------------------------------------------------------
  key(id: string): string {
    const st = this.h.factory()?.podState();
    const run = st ? (st.done ? 'd' : st.ran ? 'r' : '-') + (st.alert ? 'A' : '') : '';
    return [id, i18n.lang, this.sel, this.cond, this.revised, this.view, this.records, this.reportOf, id === 'pod' ? run : ''].join('|');
  }

  act(id: string, a: string) {
    const F = this.h.factory();
    const [k, v] = a.split(':');
    if (id === 'records') {
      if (k === 'check') this.records = Math.max(this.records, 1);
      else if (k === 'fix') this.records = 2;
      else if (k === 'who') { this.sel = 0; this.view = 'person'; this.save(); this.h.goRoom('engineer'); return; }
      this.save();
      return;
    }
    if (id === 'report') {
      if (k === 'r') this.reportOf = +v;
      else if (k === 'work') { this.sel = this.reportOf; this.view = 'person'; this.save(); this.h.goRoom('engineer'); return; }
      this.save();
      return;
    }
    if (id === 'employer') {
      if (k === 'report') { this.reportOf = +v; this.save(); this.h.goRoom('verify'); return; }
      if (k === 'pod') this.h.enquire(tr('Consider the POD'));
      if (k === 'people') this.h.enquire(tr('Review individual contributions'));
      return;
    }
    // pod
    if (k === 'view') { this.view = v === 'machine' ? 'machine' : 'team'; if (this.view === 'team') { this.sel = -1; F?.podSelect(-1); } }
    else if (k === 'p') { const i = +v; this.sel = this.sel === i && this.view === 'person' ? -1 : i; this.view = this.sel >= 0 ? 'person' : 'team'; F?.podSelect(this.sel); if (this.sel >= 0) this.reportOf = this.sel; }
    else if (k === 'c') { this.cond = +v; this.revised = false; this.view = 'machine'; F?.podRun(this.cond, false); }
    else if (k === 'revise') { this.revised = true; this.view = 'machine'; F?.podRun(1, true); }
    else if (k === 'report') { this.reportOf = this.sel >= 0 ? this.sel : 0; this.save(); this.h.goRoom('verify'); return; }
    this.save();
    this.h.focus(this.pose());
  }

  // ---- Panels -----------------------------------------------------------------------------
  private tag() { return `<p class="pmTag">${t(this.m.status)}</p>`; }

  private podHtml(): string {
    const m = this.m, st = this.h.factory()?.podState();
    const pressed = (b: boolean) => `aria-pressed="${b}"`;
    let h = `<section class="pm" aria-label="${t(m.title)}">${this.tag()}<h4 class="pmH">${t(m.headline)}</h4><p class="pmP">${t(m.problem)}</p>`;
    h += `<div class="pmViews" role="group" aria-label="${t('What to look at')}"><button type="button" data-pod="view:team" ${pressed(this.view === 'team')}>${t('The whole team')}</button><button type="button" data-pod="view:machine" ${pressed(this.view === 'machine')}>${t('The machine')}</button></div>`;
    h += `<small class="pmL">${t('Who does what')}</small><ul class="pmPeople">` + m.people.map((p, i) =>
      `<li><button type="button" data-pod="p:${i}" ${pressed(this.sel === i)}><b>${t(p.task)}</b><span>${t(p.role)}</span></button></li>`).join('') + '</ul>';
    if (this.sel >= 0) {
      const p = m.people[this.sel];
      h += `<div class="pmPerson" role="status"><small>${t(p.role)} · ${t('example')}</small><p><b>${t('Work to inspect:')}</b> ${t(p.artifact)}</p><p><b>${t('What review changed:')}</b> ${t(p.review)}</p><button type="button" class="pmLink" data-pod="report">${t('Open their sample ETAF report')} →</button></div>`;
    }
    h += `<small class="pmL">${t('Try a machine condition')}</small><div class="pmConds" role="group" aria-label="${t('Run a prepared machine cycle')}">` + m.conditions.map((c, i) =>
      `<button type="button" data-pod="c:${i}" ${pressed(this.cond === i)}>${t(c.label)}</button>`).join('') + '</div>';
    if (this.cond >= 0 && st) {
      const c = m.conditions[this.cond];
      let out = t(c.what) + ' ';
      if (!st.done) out += t('Running the example cycle…');
      else if (this.cond === 0) out += t('No alert. This is the baseline the team compares against.');
      else if (this.cond === 1 && !this.revised) out += st.alert ? t('The first version raised an alert.') : t('No alert.');
      else if (this.cond === 1) out += t('No alert: the reading is expected during a scheduled heavy cut.');
      else out += t('Alert: early wear signs, shown with the operating context. A technician decides when to inspect.');
      h += `<p class="pmOut" role="status">${out}</p>`;
      if (st.done && this.cond === 1 && !this.revised && st.alert)
        h += `<div class="pmFind"><b>${t('Finding: a false alert.')}</b><p>${t('The heavy cut was planned, so the high reading was expected. An alert here would teach technicians to ignore the screen.')}</p><button type="button" data-pod="revise">${t('See the team’s revision')}</button></div>`;
      if (st.done && this.cond === 1 && this.revised)
        h += `<div class="pmFind pmOk"><b>${t('Revised.')}</b><p>${t(m.people[0].review)}</p><button type="button" data-pod="p:0">${t('Who made this change?')}</button></div>`;
      if (st.done && this.cond === 2) h += `<p class="pmGoal">${t(MAINTENANCE_GOAL)}</p>`;
    }
    return h + '</section>';
  }

  private recordsHtml(): string {
    const R = RECORDS, s = this.records;
    let h = `<section class="pm" aria-label="${t('Machine records')}">${this.tag()}<h4 class="pmH">${t('Make the records useful.')}</h4>`;
    h += `<p class="pmP">${t('The maintenance POD starts with a week of machine records. Careful records are a real contribution: the alerts later depend on them.')}</p>`;
    h += `<div class="pmTable" role="region" aria-label="${t('Machine records, example week')}" tabindex="0"><table><thead><tr>${R.head.map((c) => `<th scope="col">${t(c)}</th>`).join('')}</tr></thead><tbody>`;
    R.rows.forEach((r, i) => {
      const miss = i === R.missingRow;
      h += `<tr${miss && s === 1 ? ' class="pmGap"' : miss && s === 2 ? ' class="pmFixed"' : ''}>` + r.map((c, j) => {
        if (miss && j === 1) return `<td>${s === 2 ? t(R.fix) : `<span class="pmMissing">${t('missing')}</span>`}</td>`;
        return `<td>${t(c)}</td>`;
      }).join('') + '</tr>';
    });
    h += `</tbody></table></div><small class="pmL">${t('Example records · not a real machine')}</small>`;
    if (s === 0) h += `<button type="button" class="pmAct" data-pod="check">${t('Check the records')}</button>`;
    if (s === 1) h += `<div class="pmFind" role="status"><b>${t('Tuesday’s job is missing.')}</b><p>${t('Its vibration was high, but nothing says why. Without the job, the reading looks like a fault.')}</p><button type="button" data-pod="fix">${t('Add the job schedule')}</button></div>`;
    if (s === 2) h += `<div class="pmFind pmOk" role="status"><b>${t('Fixed: a scheduled heavy cut.')}</b><p>${t('Now the high reading has a reason. This same change later stops a false alert at the POD.')}</p><button type="button" data-pod="who">${t('See it at the POD')} →</button></div>`;
    return h + '</section>';
  }

  private reportHtml(): string {
    const m = this.m, i = this.reportOf, p = m.people[i], r = REPORTS[p.id];
    const pressed = (b: boolean) => `aria-pressed="${b}"`;
    let h = `<section class="pm" aria-label="${t('Sample ETAF report')}"><p class="pmTag">${t('Sample report · illustrative')}</p><h4 class="pmH">${t('See the work behind readiness.')}</h4>`;
    h += `<p class="pmP">${t('Each person in the POD gets their own report. A team product doesn’t prove that everyone can do every task.')}</p>`;
    h += `<small class="pmL">${t('Whose report')}</small><div class="pmConds" role="group" aria-label="${t('Whose report')}">` + m.people.map((q, k) =>
      `<button type="button" data-pod="r:${k}" ${pressed(k === i)}>${t(q.role)}</button>`).join('') + '</div>';
    const row = (label: string, body: string, cls = '') => `<div class="pmRow${cls}"><dt>${t(label)}</dt><dd>${body}</dd></div>`;
    h += `<dl class="pmReport">`;
    h += row('Project and role', `${t(m.title)} · ${t(p.role)}`);
    h += row('Contribution', t(p.task));
    h += row('Work and version', `${t(p.artifact)}<br><span class="pmSub">${t(r.version)}</span>`);
    h += `</dl><small class="pmL">${t('Evidence sources')}</small><dl class="pmReport">`;
    h += row('Assessments', t('Not available in this example'), ' pmNone');
    h += row('Artifacts and code', t(p.artifact));
    h += row('Project delivery', t('Team demo of the alert service (team-level evidence, not individual)'));
    h += row('Performance data', t(r.performance));
    h += row('Observed behaviour', t(r.observed));
    h += row('Credentials', t('Kept separate; none shown in this example'), ' pmNone');
    h += `</dl><dl class="pmReport">`;
    h += row('Still to show', t(r.gaps));
    h += row('Readiness', t('Not evaluated in this example. A real report shows a reviewer, a date and a status only from approved ETAF data.'), ' pmNone');
    h += `</dl><button type="button" class="pmLink" data-pod="work">${t('See this person’s work at the POD')} →</button>`;
    return h + '</section>';
  }

  private employerHtml(): string {
    const m = this.m;
    let h = `<section class="pm" aria-label="${t('Employer view')}">${this.tag()}<h4 class="pmH">${t('What an employer can inspect.')}</h4>`;
    h += `<ul class="pmList"><li><b>${t('The problem and a working demo')}</b>${t('The alert screen, run on example data with the technician’s view.')}</li>`;
    h += `<li><b>${t('Who did what')}</b>${m.people.map((p) => t(p.role)).join(' · ')}</li>`;
    h += `<li><b>${t('How it was reviewed')}</b>${t('The false alert on a heavy cut, and the change that fixed it.')}</li>`;
    h += `<li><b>${t('Individual reports')}</b><span class="pmChips">${m.people.map((p, k) => `<button type="button" class="pmChip" data-pod="report:${k}">${t(p.role)}</button>`).join('')}</span></li></ul>`;
    h += `<div class="pmEnd"><button type="button" class="pmAct" data-pod="pod">${t('Consider the POD')}</button><button type="button" class="pmAct pmAlt" data-pod="people">${t('Review individual contributions')}</button></div>`;
    h += `<p class="pmGoal">${t('Hiring and engagement are the employer’s decision. Nothing here is an offer.')}</p>`;
    return h + '</section>';
  }
}

/** Labels drawn on the 3D trace panel and alert screen, in the current language. */
export function podLabels(): Record<string, string> {
  const en: Record<string, string> = {
    traceT: 'SENSOR READINGS · EXAMPLE DATA', cut: 'Scheduled heavy cut', vib: 'Vibration', temp: 'Temperature', thr: 'Alert line',
    alertH: 'ALERT · SPINDLE BEARING', okH: 'SPINDLE BEARING · WATCHING', idle: 'No cycle running',
    wearMsg: 'Early wear signs. Inspect at the next planned stop.', loadMsg: 'Vibration above the alert line.',
    ctxMsg: 'Heavy cut scheduled. Reading expected, no alert.', okMsg: 'Cycle complete. No alert.', runMsg: 'Reading the cycle…',
    ctx: 'Context: job schedule, tool, operating hours', ex: 'Example data · not a live machine',
  };
  return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, tr(v)]));
}
