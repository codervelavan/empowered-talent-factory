// "Your journey": a browsing record of the career stages a visitor has looked at, and which tracks
// they explored. It lives only in this browser and says nothing about programme progress.

import { i18n, translateDom } from './i18n';

const KEY = 'ee-journey';

/** Career stages in route order, keyed by their site path. */
const STAGES: { path: string; name: string }[] = [
  { path: 'career/assessment/', name: 'Entry Assessment' },
  { path: 'career/launch/', name: 'Career Launch' },
  { path: 'career/specialisation/', name: 'Career Pro pods' },
  { path: 'career/accelerate/', name: 'Career Accelerate' },
  { path: 'career/assurance/', name: 'ETAF™ assurance' },
  { path: 'career/opportunities/', name: 'Opportunities' },
];
const TRACKS: Record<string, string> = { launch: 'Career Launch', pro: 'Career Pro', accel: 'Career Accelerate' };
const TRACK_OF: Record<string, string> = { 'career/launch/': 'launch', 'career/specialisation/': 'pro', 'career/accelerate/': 'accel' };

interface Saved { seen: string[]; tracks: string[]; last: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class Passport {
  private data: Saved = { seen: [], tracks: [], last: '' };
  private btn: HTMLButtonElement;
  private pop: HTMLElement;
  private open = false;
  /** The same entry inside the site menu, used on phones where the header has no room. */
  private item: HTMLLIElement;

  constructor(private onContinue: (path: string) => void, private here: () => string = () => '', private beforeOpen: () => void = () => {}) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Saved>;
        this.data = { seen: (d.seen ?? []).filter((p) => STAGES.some((s) => s.path === p)), tracks: (d.tracks ?? []).filter((t) => t in TRACKS), last: typeof d.last === 'string' ? d.last : '' };
      }
    } catch { /* storage blocked: start empty */ }

    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'hBtn';
    this.btn.id = 'jBtn';
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.setAttribute('aria-controls', 'jPop');
    this.btn.innerHTML = 'Your journey <b id="jCount"></b>';
    this.btn.onclick = () => (this.open ? this.close() : this.show());
    const hdr = document.querySelector('.hdrR');
    hdr?.insertBefore(this.btn, document.getElementById('menuBtn'));
    this.item = document.createElement('li');
    this.item.className = 'jItem';
    this.item.innerHTML = '<button type="button">Your journey <span id="jCount2"></span></button>';
    this.item.querySelector('button')!.onclick = () => this.show();
    document.querySelector('#menu ul')?.prepend(this.item);

    this.pop = document.createElement('section');
    this.pop.id = 'jPop';
    this.pop.hidden = true;
    this.pop.setAttribute('aria-label', 'Your journey');
    document.getElementById('top')?.appendChild(this.pop);
    this.pop.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-j]');
      if (!b) return;
      if (b.dataset.j === 'continue' && this.data.last) { this.close(); this.onContinue(this.data.last); }
      else if (b.dataset.j === 'clear') { this.data = { seen: [], tracks: [], last: '' }; this.save(); this.close(); }
    });
    addEventListener('pointerdown', (e) => { if (this.open && !(e.target as Element).closest('#jPop,#jBtn,.jItem')) this.close(); });
    addEventListener('keydown', (e) => { if (this.open && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);
    i18n.on(() => this.paint());
    this.paint();
  }

  /** Record a place the visitor reached (a site path). Only career stages count. */
  visit(path: string) {
    if (!STAGES.some((s) => s.path === path)) return;
    const d = this.data;
    const isNew = !d.seen.includes(path);
    if (isNew) d.seen.push(path);
    const t = TRACK_OF[path];
    if (t && !d.tracks.includes(t)) d.tracks.push(t);
    if (!isNew && d.last === path && !t) return;
    d.last = path;
    this.save();
  }

  /** Record interest in a track (launch, pro or accel), e.g. from a track button. */
  interest(track: string) {
    if (!(track in TRACKS) || this.data.tracks.includes(track)) return;
    this.data.tracks.push(track);
    this.save();
  }

  close() {
    if (!this.open) return;
    const f = this.pop.contains(document.activeElement);
    this.pop.hidden = true;
    this.open = false;
    this.btn.setAttribute('aria-expanded', 'false');
    if (f) (this.btn.offsetParent ? this.btn : document.getElementById('menuBtn'))?.focus();
  }

  private show() {
    this.beforeOpen();
    this.paint();
    this.pop.hidden = false;
    this.open = true;
    this.btn.setAttribute('aria-expanded', 'true');
    this.pop.querySelector<HTMLElement>('button')?.focus();
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage blocked */ }
    this.paint();
  }

  private paint() {
    const d = this.data;
    this.btn.hidden = d.seen.length === 0;
    const c = this.btn.querySelector('#jCount');
    if (c) c.textContent = `${d.seen.length}/${STAGES.length}`;
    this.item.hidden = d.seen.length === 0;
    const c2 = this.item.querySelector('#jCount2');
    if (c2) c2.textContent = `${d.seen.length}/${STAGES.length}`;
    this.btn.setAttribute('aria-label', `Your journey: ${d.seen.length} of ${STAGES.length} career stages explored`);
    const last = d.last !== this.here() ? STAGES.find((s) => s.path === d.last) : undefined;
    const stages = STAGES.map((s) => {
      const on = d.seen.includes(s.path);
      return `<li class="${on ? 'on' : ''}"><i aria-hidden="true">${on ? '✓' : ''}</i>${esc(s.name)}<span class="sr">${on ? ' (explored)' : ' (not yet explored)'}</span></li>`;
    }).join('');
    const tracks = d.tracks.length
      ? d.tracks.map((t) => `<span class="jChip">${esc(TRACKS[t])}</span>`).join('')
      : '<span class="jNone">None yet</span>';
    this.pop.innerHTML =
      `<h2>Your journey</h2><p class="jNote">This shows where you’ve explored, not your programme progress.</p>`
      + `<small>Career stages explored</small><ol class="jStages">${stages}</ol>`
      + `<small>Tracks you looked at</small><div class="jTracks">${tracks}</div>`
      + `<div class="jActs">${last ? `<button type="button" class="cta" data-j="continue">Continue: ${esc(last.name)} <span>→</span></button>` : ''}`
      + `<button type="button" class="jClear" data-j="clear">Clear</button></div>`;
    translateDom(this.pop);
    translateDom(this.btn);
    translateDom(this.item);
  }
}
