// The POD missions across the guided route. One shared, saved state (which project, who is selected,
// whether each project's Develop task was fixed) and four activities shown inside guide stops:
//   records  (Develop)  the project's starting data: find the problem and fix it
//   pod      (Engineer) the centrepiece and team: pick a person, run a prepared example
//   report   (Verify)   one person's sample ETAF report
//   employer (Deploy)   what an employer can inspect, and how to take interest further
// Three projects share the same place on the engineering floor; only the active one is shown.
// It talks to the 3D scene through the bridge and asks the story camera to focus. Nothing is live.

import type { FactoryApi, P3 } from '../bridge';
import type { StoryActivity } from '../story/guide';
import { MISSIONS, POD_PLACE, DEVELOP_AREAS, STAGE_NAMES, type Mission } from './missions';
import { tr, i18n } from '../app/i18n';
import { motion } from '../app/motion';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const t = (s: string) => esc(tr(s));

export interface MissionHost {
  factory(): FactoryApi | undefined;
  /** Focus the camera in a room (default the engineering floor; null: the room's own view). */
  focus(pose: [P3, P3] | null, room?: string): void;
  /** Go to another room on the current guided route (e.g. 'engineer', 'verify'). */
  goRoom(room: string): void;
  /** Show the honest "not available yet" message for an engagement action. */
  enquire(label: string): void;
}

/** The default room camera looks from here; person close-ups are framed from the same side. */
const VIEW_FROM: P3 = [21.6, 3.6, -17.4];
const SAVE = 'ee-mission';
/** Verify: the six evidence sources; which can be traced in this example (assessments and credentials can't). */
const SOURCES = ['Assessments', 'Artifacts and code', 'Project delivery', 'Performance data', 'Observed behaviour', 'Credentials'];
const TRACEABLE = [1, 2, 3, 4];
/** Deploy courtyard: the demonstration table with the employer. */
const DEMO_POSE: [P3, P3] = [[-0.6, 2.8, -88.2], [-3.3, 1.3, -80.6]];
/** Develop: the project bench framed so the notebook reads; area close-ups from the room's open side. */
const BENCH: [P3, P3] = [[-9.8, 8.1, -36.5], [-10.9, 6.7, -39.4]];
const areaPose = (i: number): [P3, P3] => { const a = DEVELOP_AREAS[i].at; return [[a[0] + 0.7, 8.3, a[2] + 4.3], [a[0], 6.9, a[2]]]; };
/** Specialise: the chosen pod, framed from the front of the room. */
const specPose = (q: P3): [P3, P3] => [[q[0] + 0.8, 8.4, q[2] + 5.0], [q[0], 6.9, q[2]]];
/** Which project each guided route starts with, until the visitor picks one. */
const DEFAULT_FOR: Record<string, number> = { student: 0, university: 0, founder: 2, hr: 2, region: 1, workforce: 1 };

/** On phones the panel docks at the bottom, so pull back and look lower: the subject sits in the top part. */
function fitPhone(p: [P3, P3] | null): [P3, P3] | null {
  if (!p || (innerWidth > 760 && innerHeight > 500)) return p;
  const [c, l] = p, back = innerHeight <= 500 ? 1.15 : 1.45;
  // Stay under the ceiling above the subject: the walkway (y 6) on the engineering floor, the room roofs upstairs.
  const top = l[1] >= 5.5 ? 10.2 : 4.6;
  const cam: P3 = [l[0] + (c[0] - l[0]) * back, Math.min(top, c[1] + 0.3), l[2] + (c[2] - l[2]) * back];
  return innerHeight <= 500 ? [cam, l] : [cam, [l[0], l[1] - 1.5, l[2]]];
}


export class PodMission {
  mi = 0;
  /** The visitor picked a project themselves (audience defaults no longer apply). */
  chosen = false;
  sel = -1;
  cond = -1;
  revised = false;
  view: 'team' | 'machine' | 'person' = 'team';
  /** Develop task per project: 0 not checked, 1 problem found, 2 fixed. */
  dev = [0, 0, 0];
  /** Verify: whose report is open. */
  reportOf = 0;
  /** Each project keeps its own selected person and open report (never another project's evidence). */
  selOf = [-1, -1, -1];
  repOf = [0, 0, 0];
  /** Verify: the evidence source being traced to its origin (-1 none). */
  trace = -1;
  /** Develop: the area close-up being looked at, and which ones have played their result. */
  area = -1;
  areaDone = new Set<number>();
  /** Specialise: the task brought forward. */
  task = -1;
  /** Engineer: the delivery stage shown (-1 none) and the overview timer while it plays. */
  stage = -1;
  private stageTimer = 0;

  constructor(private h: MissionHost) {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE) || '{}');
      if (Number.isInteger(d.mi) && d.mi >= 0 && d.mi < MISSIONS.length) this.mi = d.mi;
      this.chosen = d.chosen === true;
      if (Number.isInteger(d.sel) && d.sel >= -1 && d.sel < 5) this.sel = d.sel;
      if (Array.isArray(d.dev)) this.dev = [0, 1, 2].map((i) => (d.dev[i] === 2 ? 2 : 0));
      if (Number.isInteger(d.reportOf) && d.reportOf >= 0 && d.reportOf < 5) this.reportOf = d.reportOf;
      const ok = (v: unknown, lo: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) < 5;
      if (Array.isArray(d.selOf)) this.selOf = [0, 1, 2].map((i) => (ok(d.selOf[i], -1) ? d.selOf[i] : -1));
      if (Array.isArray(d.repOf)) this.repOf = [0, 1, 2].map((i) => (ok(d.repOf[i], 0) ? d.repOf[i] : 0));
      this.selOf[this.mi] = this.sel; this.repOf[this.mi] = this.reportOf;
    } catch { /* storage blocked or bad data */ }
  }

  get m(): Mission { return MISSIONS[this.mi]; }

  private save() {
    this.selOf[this.mi] = this.sel; this.repOf[this.mi] = this.reportOf;
    try { localStorage.setItem(SAVE, JSON.stringify({ mi: this.mi, chosen: this.chosen, sel: this.sel, dev: this.dev.map((v) => (v === 2 ? 2 : 0)), reportOf: this.reportOf, selOf: this.selOf, repOf: this.repOf })); } catch { /* storage blocked */ }
  }

  /** Make the scene show the active project (call once the 3D is ready, and on arrival). */
  sync() { const F = this.h.factory(); F?.podMission(this.mi); F?.podSelect(this.sel); this.syncDev(); }

  /** Draw the active project's record on the notebook in Develop (and on the Engineer data bench). */
  syncDev() {
    const F = this.h.factory(), d = this.m.develop;
    F?.devNote({ title: tr(d.region), head: d.head.map((c) => tr(c)), rows: d.rows.map((r) => r.map((c) => (c ? tr(c) : ''))), row: d.row, col: d.col, fix: tr(d.fix), state: this.dev[this.mi], linked: tr('Reviewed and linked to the POD record'), missing: tr('missing') });
  }

  /** Switch project. Keeps the stop; resets the example and the selection. */
  setMission(i: number, byUser: boolean) {
    if (byUser) this.chosen = true;
    // Switching restores that project's own person and report; the example run starts fresh.
    if (i !== this.mi) { this.selOf[this.mi] = this.sel; this.repOf[this.mi] = this.reportOf; this.mi = i; this.sel = this.selOf[i]; this.reportOf = this.repOf[i]; this.cond = -1; this.revised = false; this.view = this.sel >= 0 ? 'person' : 'team'; this.stage = -1; this.trace = -1; this.h.factory()?.podReset(); this.h.factory()?.etafTrace(-1, null); }
    this.sync();
    this.save();
  }

  /** A guided route or bay starts on the project that suits its audience, unless the visitor picked one. */
  defaultFor(audience: string) { if (!this.chosen && audience in DEFAULT_FOR) this.setMission(DEFAULT_FOR[audience], false); }

  /** The activity shown in a stop, by id. */
  activity(id: string): StoryActivity | null {
    const key = () => this.key(id), act = (a: string) => this.act(id, a);
    if (id === 'pod') return { html: () => this.podHtml(), key, act };
    if (id === 'records') return { html: () => this.recordsHtml(), key, act };
    if (id === 'report') return { html: () => this.reportHtml(), key, act };
    if (id === 'employer') return { html: () => this.employerHtml(), key, act };
    if (id === 'tasks') return { html: () => this.tasksHtml(), key, act };
    return null;
  }

  // ---- Camera ---------------------------------------------------------------------------
  /** Framings: the whole team, the centrepiece and its screens, or one person and their work.
   *  On phones the panel docks at the bottom, so pull back and look lower: the subject sits in the top part. */
  pose(): [P3, P3] | null { return fitPhone(this.basePose()); }

  private basePose(): [P3, P3] | null {
    if (this.view === 'machine') return [[16.4, 4.3, -23.8], [14.6, 2.1, -32.6]];
    if (this.view === 'person' && this.sel >= 0) {
      const at = POD_PLACE.at[this.sel], art = POD_PLACE.art[this.sel];
      // Three-quarter front view: turn the person-from-work direction 50 degrees toward the room camera's side.
      const fx = at[0] - art[0], fz = at[2] - art[2], L = Math.hypot(fx, fz) || 1;
      const turn = (a: number): [number, number] => [(fx * Math.cos(a) + fz * Math.sin(a)) / L, (-fx * Math.sin(a) + fz * Math.cos(a)) / L];
      const [ax, az] = turn(0.9), [bx, bz] = turn(-0.9);
      const toward = (x: number, z: number) => x * (VIEW_FROM[0] - at[0]) + z * (VIEW_FROM[2] - at[2]);
      const [dx, dz] = toward(ax, az) >= toward(bx, bz) ? [ax, az] : [bx, bz];
      const mid: P3 = [(at[0] + art[0]) / 2, 1.3, (at[2] + art[2]) / 2];
      return [[mid[0] + dx * 4, 2.6, mid[2] + dz * 4], mid];
    }
    return [[20.8, 4.8, -20.4], [14.6, 1.5, -31.2]];
  }

  /** Arriving at the Engineer stop: frame the selected person (if any), else the whole team. */
  enter() { this.view = this.sel >= 0 && this.view === 'person' ? 'person' : 'team'; this.sync(); this.h.focus(this.pose()); }

  // ---- State and actions ----------------------------------------------------------------
  key(id: string): string {
    const st = this.h.factory()?.podState();
    const run = st ? (st.done ? 'd' : st.ran ? 'r' : '-') + (st.alert ? 'A' : '') : '';
    return [id, i18n.lang, this.mi, this.sel, this.cond, this.revised, this.view, this.dev.join(''), this.reportOf, this.area, [...this.areaDone].join(''), this.task, this.stage, this.trace, this.stageTimer ? 'p' : '', motion.reduced, id === 'pod' ? run : ''].join('|');
  }

  act(id: string, a: string) {
    const F = this.h.factory();
    const [k, v] = a.split(':');
    if (k === 'm') { this.setMission(+v, true); if (id === 'pod') this.h.focus(this.pose()); return; }
    if (id === 'records') {
      if (k === 'check') { this.dev[this.mi] = Math.max(this.dev[this.mi], 1); this.area = -1; this.h.focus(fitPhone(BENCH), 'develop'); }
      else if (k === 'fix') { this.dev[this.mi] = 2; this.area = -1; this.h.focus(fitPhone(BENCH), 'develop'); }
      else if (k === 'who') { this.sel = 0; this.view = 'person'; this.save(); this.h.goRoom('engineer'); return; }
      else if (k === 'area') { const i = +v; this.area = this.area === i ? -1 : i; this.h.focus(fitPhone(this.area >= 0 ? areaPose(this.area) : BENCH), 'develop'); }
      else if (k === 'ado') this.areaDone.add(+v);
      this.save();
      this.syncDev();
      return;
    }
    if (id === 'tasks') {
      if (k === 't') { const i = +v; this.task = this.task === i ? -1 : i; const at = this.h.factory()?.specPod(this.task); this.h.focus(at ? fitPhone(specPose(at)) : null, 'pro'); }
      return;
    }
    if (id === 'report') {
      if (k === 'r') { this.reportOf = +v; this.trace = -1; this.h.factory()?.etafTrace(-1, null); }
      else if (k === 'tr') { const i = +v; this.trace = this.trace === i ? -1 : i; this.h.factory()?.etafTrace(TRACEABLE.includes(this.trace) ? this.trace : -1, this.trace === 4 ? POD_PLACE.centre : POD_PLACE.art[this.reportOf]); }
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
    else if (k === 'stage') { this.stopStages(); this.showStage(+v); }
    else if (k === 'stages') { this.playStages(); return; }
    this.save();
    this.h.focus(this.pose());
  }

  /** Arriving at Verify: the report opens on the person selected at the POD (if any). */
  enterVerify() { if (this.sel >= 0) this.reportOf = this.sel; this.trace = -1; this.h.factory()?.etafTrace(-1, null); }
  /** Leaving Verify clears the trace. */
  leaveVerify() { this.trace = -1; this.h.factory()?.etafTrace(-1, null); }
  /** Arriving at Deploy: the courtyard demonstration shows this project's reviewed version. */
  enterDeploy() {
    const m = this.m, c = m.conditions[1];
    this.h.factory()?.demoScreen(tr('Demonstration · reviewed version').toUpperCase(), [tr(m.short), tr(c.revised ?? m.finding.revisedTitle)], tr('Example data · not a live system'));
    this.h.focus(fitPhone(DEMO_POSE), 'deploy');
  }

  /** Arriving at Develop: show the project's record on the bench, framed so the notebook reads. */
  enterDevelop() { this.area = -1; this.sync(); this.h.focus(fitPhone(BENCH), 'develop'); }
  /** Arriving at Specialise: no task chosen yet, so no pod is marked. */
  enterSpecialise() { this.task = -1; this.h.factory()?.specPod(-1); }

  /** One delivery stage: its lead is selected and, for testing and the demo, the prepared finding replays. */
  private showStage(i: number) {
    const F = this.h.factory(), st = this.m.stages[i];
    if (!st) return;
    this.stage = i;
    this.sel = st.by; this.view = 'team'; F?.podSelect(st.by);
    if (st.run) { this.cond = 1; this.revised = st.run === 'revised'; F?.podRun(1, this.revised); }
    this.h.focus(this.pose());
  }
  private stopStages() { if (this.stageTimer) { clearTimeout(this.stageTimer); this.stageTimer = 0; } }
  /** The about-12-second overview: two seconds per stage. Next stays available throughout. */
  private playStages() {
    this.stopStages();
    let i = 0;
    const tick = () => { this.showStage(i); i += 1; this.stageTimer = i < this.m.stages.length ? window.setTimeout(tick, 2000) : 0; };
    tick();
  }
  /** Leaving the Engineer stop ends the overview. */
  leave() { this.stopStages(); }

  // ---- Panels -----------------------------------------------------------------------------
  private tag() { return `<p class="pmTag">${t(this.m.status)}</p>`; }

  /** "Change project": the three missions. */
  private picker() {
    return `<div class="pmPick" role="group" aria-label="${t('Change project')}"><small class="pmL">${t('Project')}</small><div class="pmConds">` +
      MISSIONS.map((m, i) => `<button type="button" data-pod="m:${i}" aria-pressed="${i === this.mi}">${t(m.short)}</button>`).join('') + '</div></div>';
  }

  private podHtml(): string {
    const m = this.m, st = this.h.factory()?.podState();
    const pressed = (b: boolean) => `aria-pressed="${b}"`;
    // The prepared example comes first; the team and the lifecycle are there to explore after it.
    let h = `<section class="pm" aria-label="${t(m.title)}">${this.tag()}<h4 class="pmH">${t(m.headline)}</h4>`;
    h += `<small class="pmL">${t(m.id === 'maintenance' ? 'Try a machine condition' : 'Try an example')}</small><div class="pmConds" role="group" aria-label="${t('Run a prepared example')}">` + m.conditions.map((c, i) =>
      `<button type="button" data-pod="c:${i}" ${pressed(this.cond === i)}>${t(c.label)}</button>`).join('') + '</div>';
    if (this.cond >= 0 && st) {
      const c = m.conditions[this.cond];
      let out = t(c.what) + ' ';
      if (!st.done) out += t('Running the example…');
      else out += t(this.cond === 1 && this.revised && c.revised ? c.revised : c.done);
      h += `<p class="pmOut" role="status">${out}</p>`;
      if (st.done && this.cond === 1 && !this.revised && st.alert)
        h += `<div class="pmFind"><b>${t(m.finding.title)}</b><p>${t(m.finding.text)}</p><button type="button" data-pod="revise">${t(m.finding.revise)}</button></div>`;
      if (st.done && this.cond === 1 && this.revised)
        h += `<div class="pmFind pmOk"><b>${t(m.finding.revisedTitle)}</b><p>${t(m.people[m.finding.by].review)}</p><button type="button" data-pod="p:${m.finding.by}">${t('Who made this change?')}</button></div>`;
      if (st.done && this.cond === 2) h += `<p class="pmGoal">${t(m.goal)}</p>`;
    }
    h += `<p class="pmP">${t(m.problem)}</p>${this.picker()}`;
    h += `<div class="pmViews" role="group" aria-label="${t('What to look at')}"><button type="button" data-pod="view:team" ${pressed(this.view === 'team')}>${t('The whole team')}</button><button type="button" data-pod="view:machine" ${pressed(this.view === 'machine')}>${t(m.id === 'maintenance' ? 'The machine' : m.id === 'inspection' ? 'The inspection cell' : 'The sources and the answer')}</button></div>`;
    h += `<details class="pmMore"${this.sel >= 0 ? ' open' : ''}><summary>${t('Select a contributor')}</summary><ul class="pmPeople">` + m.people.map((p, i) =>
      `<li><button type="button" data-pod="p:${i}" ${pressed(this.sel === i)}><b>${t(p.task)}</b><span>${t(p.role)}</span></button></li>`).join('') + '</ul>';
    if (this.sel >= 0) {
      const p = m.people[this.sel];
      h += `<div class="pmPerson" role="status"><small>${t(p.role)} · ${t('example')}</small><p><b>${t('Work to inspect:')}</b> ${t(p.artifact)}</p><p><b>${t('What review changed:')}</b> ${t(p.review)}</p><button type="button" class="pmLink" data-pod="report">${t('Open their sample ETAF report')} →</button></div>`;
    }
    h += '</details>';
    // Six delivery stages: an about-12-second overview (or one stage at a time), separate from the example above.
    h += `<details class="pmMore"${this.stage >= 0 ? ' open' : ''}><summary>${t('The six delivery stages')}</summary>`;
    if (!motion.reduced) h += `<button type="button" class="pmAct" data-pod="stages">${t(this.stageTimer ? 'Playing the overview…' : 'Play the overview (about 12 seconds)')}</button>`;
    h += `<div class="pmConds pmStages" role="group" aria-label="${t('Delivery stages')}">` + STAGE_NAMES.map((n, i) => `<button type="button" data-pod="stage:${i}" ${pressed(this.stage === i)}>${t(n)}</button>`).join('') + '</div>';
    if (this.stage >= 0) {
      const sg = m.stages[this.stage];
      h += `<div class="pmPerson" role="status"><small>${t(STAGE_NAMES[this.stage])} · ${this.stage * 2}–${this.stage * 2 + 2}s · ${t('led by')} ${t(m.people[sg.by].role)}</small><p>${t(sg.event)}</p><p><b>${t('To inspect:')}</b> ${t(sg.artifact)}</p></div>`;
    }
    h += `<p class="pmGoal">${t('An overview of the lifecycle. The full test and its review take longer; replay the example above at your own pace.')}</p></details>`;
    return h + '</section>';
  }

  private recordsHtml(): string {
    const d = this.m.develop, s = this.dev[this.mi];
    let h = `<section class="pm" aria-label="${t(d.region)}">${this.picker()}${this.tag()}<h4 class="pmH">${t(d.title)}</h4><p class="pmP">${t(d.intro)}</p>`;
    h += `<div class="pmTable" role="region" aria-label="${t(d.region)}" tabindex="0"><table><thead><tr>${d.head.map((c) => `<th scope="col">${t(c)}</th>`).join('')}</tr></thead><tbody>`;
    d.rows.forEach((r, i) => {
      const bad = i === d.row;
      h += `<tr${bad && s === 1 ? ' class="pmGap"' : bad && s === 2 ? ' class="pmFixed"' : ''}>` + r.map((c, j) => {
        if (!bad || j !== d.col) return `<td>${t(c)}</td>`;
        if (s === 2) return `<td>${t(d.fix)}</td>`;
        return `<td>${c ? `<span${s === 1 ? ' class="pmMissing"' : ''}>${t(c)}</span>` : `<span class="pmMissing">${t('missing')}</span>`}</td>`;
      }).join('') + '</tr>';
    });
    h += `</tbody></table></div><small class="pmL">${t(d.note)}</small>`;
    if (s === 0) h += `<button type="button" class="pmAct" data-pod="check">${t(d.check)}</button>`;
    if (s === 1) h += `<div class="pmFind" role="status"><b>${t(d.gapTitle)}</b><p>${t(d.gapText)}</p><button type="button" data-pod="fix">${t(d.fixLabel)}</button></div>`;
    if (s === 2) h += `<div class="pmFind pmOk" role="status"><b>${t(d.fixedTitle)}</b><p>${t(d.fixedText)}</p><button type="button" data-pod="who">${t('See it at the POD')} →</button></div>`;
    // The rest of the room: four optional close-ups, each with one prepared result.
    h += `<details class="pmMore"${this.area >= 0 ? ' open' : ''}><summary>${t('Look around Develop')}</summary><div class="pmConds" role="group" aria-label="${t('Develop areas')}">` +
      DEVELOP_AREAS.map((a, i) => `<button type="button" data-pod="area:${i}" aria-pressed="${this.area === i}">${t(a.name)}</button>`).join('') + '</div>';
    if (this.area >= 0) {
      const a = DEVELOP_AREAS[this.area], done = this.areaDone.has(this.area);
      h += `<div class="pmPerson" role="status"><small>${t(a.name)} · ${t('example')}</small><p>${t(a.see)}</p>` +
        (done ? `<p><b>${t(a.result)}</b></p>` : `<button type="button" class="pmLink" data-pod="ado:${this.area}">${t(a.act)} →</button>`) + '</div>';
    }
    h += '</details>';
    return h + '</section>';
  }

  /** Specialise: the project's tasks first; the discipline name appears once a task is chosen. */
  private tasksHtml(): string {
    const m = this.m;
    let h = `<section class="pm" aria-label="${t('Tasks in the project')}"><h4 class="pmH">${t('See the task before the title.')}</h4><p class="pmP">${t('Different strengths contribute to the same project. Choose a task to see who does it and what they make.')}</p>`;
    h += `<ul class="pmPeople">` + m.people.map((p, i) => `<li><button type="button" data-pod="t:${i}" aria-pressed="${this.task === i}"><b>${t(p.task)}</b>${this.task === i ? `<span>${t(p.role)}</span>` : ''}</button></li>`).join('') + '</ul>';
    if (this.task >= 0) {
      const p = m.people[this.task];
      h += `<div class="pmPerson" role="status"><small>${t(p.role)} · ${t('example')}</small><p><b>${t('What they make:')}</b> ${t(p.artifact)}</p><p>${t('It connects to the rest of the team’s work at the Engineer stop.')}</p></div>`;
    }
    h += `<p class="pmGoal">${t('Illustrative responsibilities from the example project, not confirmed specialisation tracks. Choosing one here doesn’t assign a career or confirm eligibility.')}</p>`;
    return h + '</section>';
  }

  private reportHtml(): string {
    const m = this.m, i = this.reportOf, p = m.people[i], r = m.reports[p.id];
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
    h += row('Project delivery', t(m.employer.delivery));
    h += row('Performance data', t(r.performance));
    h += row('Observed behaviour', t(r.observed));
    h += row('Credentials', t('Kept separate; none shown in this example'), ' pmNone');
    h += `</dl><dl class="pmReport">`;
    h += row('Still to show', t(r.gaps));
    h += row('Readiness', t('Not evaluated in this example. A real report shows a reviewer, a date and a status only from approved ETAF data.'), ' pmNone');
    h += `</dl>`;
    // Trace one source back to where it comes from; sources this example doesn't have say so.
    h += `<small class="pmL">${t('Trace an evidence source to its origin')}</small><div class="pmConds" role="group" aria-label="${t('Evidence sources')}">` +
      SOURCES.map((n, k) => `<button type="button" data-pod="tr:${k}" ${pressed(this.trace === k)}>${t(n)}</button>`).join('') + '</div>';
    if (this.trace >= 0) {
      const origin = [t('No assessment evidence in this example. A real report links the assessment record itself.'),
        `${t(p.role)}: ${t(p.artifact)}. ${t('The gold line runs from their work at the POD into this gate.')}`,
        `${t(m.employer.delivery)} ${t('Team output is not proof of every individual’s skill.')}`,
        `${t(r.performance)} ${t('Measured in the prepared example only; not a benchmark.')}`,
        `${t(r.observed)} ${t('From the team’s review discussion at the POD.')}`,
        t('Kept separate. This example creates no qualification.')][this.trace];
      h += `<p class="pmOut" role="status">${origin}</p>`;
    }
    h += `<button type="button" class="pmLink" data-pod="work">${t('See this person’s work at the POD')} →</button>`;
    return h + '</section>';
  }

  private employerHtml(): string {
    const m = this.m;
    let h = `<section class="pm" aria-label="${t('Employer view')}">${this.tag()}<h4 class="pmH">${t('What an employer can inspect.')}</h4><p class="pmP">${t(m.title)}</p>`;
    h += `<ul class="pmList"><li><b>${t('The problem and a working demo')}</b>${t(m.employer.demo)}</li>`;
    h += `<li><b>${t('Who did what')}</b>${m.people.map((p) => t(p.role)).join(' · ')}</li>`;
    h += `<li><b>${t('How it was reviewed')}</b>${t(m.employer.review)}</li>`;
    h += `<li><b>${t('Individual reports')}</b><span class="pmChips">${m.people.map((p, k) => `<button type="button" class="pmChip" data-pod="report:${k}">${t(p.role)}</button>`).join('')}</span></li></ul>`;
    h += `<div class="pmEnd"><button type="button" class="pmAct" data-pod="pod">${t('Consider the POD')}</button><button type="button" class="pmAct pmAlt" data-pod="people">${t('Review individual contributions')}</button></div>`;
    h += `<p class="pmGoal">${t('Hiring and engagement are the employer’s decision. Nothing here is an offer.')}</p>`;
    h += `<h4 class="pmH">${t('How to start')}</h4><p class="pmP">${t('Every career path starts with the Entry Assessment. It informs a recommended path; exploring this site is not an assessment or an eligibility decision. Mentored POD experience is not an internship or placement guarantee.')}</p>`;
    return h + '</section>';
  }
}

/** Labels drawn on the 3D screens and signs, in the current language. */
export function podLabels(): Record<string, string> {
  const en: Record<string, string> = {
    traceT: 'SENSOR READINGS · EXAMPLE DATA', cut: 'Scheduled heavy cut', vib: 'Vibration', temp: 'Temperature', thr: 'Alert line',
    alertH: 'ALERT · SPINDLE BEARING', okH: 'SPINDLE BEARING · WATCHING', idle: 'No cycle running',
    wearMsg: 'Early wear signs. Inspect at the next planned stop.', loadMsg: 'Vibration above the alert line.',
    ctxMsg: 'Heavy cut scheduled. Reading expected, no alert.', okMsg: 'Cycle complete. No alert.', runMsg: 'Reading the cycle…',
    ctx: 'Context: job schedule, tool, operating hours', ex: 'Example data · not a live machine',
    camT: 'CAMERA VIEW · EXAMPLE IMAGE', camWait: 'Waiting for the next part', camClean: 'No visible anomaly', camMaybe: 'Possible scratch', camDefect: 'Edge damage',
    camLow: 'Confidence: low', camHigh: 'Confidence: high', laneH: 'REVIEW LANE', laneIdle: 'No part under the camera', laneRun: 'Inspecting…',
    lanePass: 'Passed: no visible anomaly.', laneReview: 'Sent to human review: low confidence.', laneAuto: 'Rejected automatically.', laneReject: 'Rejected: edge damage.',
    laneCtx: 'Each decision shows its image region', laneEx: 'Example images · not a live line',
    retT: 'RETRIEVAL · EXAMPLE SOURCES', retWait: 'Ask a question to see which sources are used', rolePlan: 'Role: planner (no contract access)', roleLog: 'Role: logistics coordinator',
    stNo: 'Not needed', stUsed: 'Used', stBlocked: 'Blocked before retrieval', stLeak: 'Used: not allowed for this role', stNone: 'No support for this question',
    docN0: 'Customs declaration', docN1: 'Bill of materials', docN2: 'Export-rule summary', docN3: 'Supplier contract (restricted)',
    doc0: 'CUSTOMS', doc1: 'BILL OF MATERIALS', doc2: 'EXPORT RULES', doc3: 'CONTRACT',
    ansH: 'DRAFT ANSWER · FOR REVIEW', ansLeak: 'RESTRICTED SOURCE USED', ansNone: 'NEEDS EVIDENCE', ansIdle: 'No question asked yet', ansRun: 'Retrieving the permitted sources…',
    ansNoneMsg: 'Not enough support in the approved sources. Please add the evidence needed.',
    ansLeakMsg: 'Missing: export licence number and net weight [1][2][3]. Contract terms [4].',
    ansRoleMsg: 'Missing: export licence number and net weight [1][2][3]. One document isn’t available to your role.',
    ansOkMsg: 'Missing: export licence number and net weight [1][2][3].',
    ansCtx: 'A person reviews every answer', ansEx: 'Example documents · not real shipment data',
  };
  return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, tr(v)]));
}
