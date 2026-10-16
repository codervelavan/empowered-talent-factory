// "Your selection": the workforce choices a visitor adds from each bay, kept across bays and reloads
// (in this browser only), with a summary they can copy. Nothing is sent anywhere.
import { CONTACT } from './contact';

const KEY = 'ee-workforce';

export const BAYS = ['Verified Talent (TaaS)', 'Product Engineering PODs', 'Workforce Capability', 'Campus Talent Factory', 'Ecosystem at Scale'];
export const AUDIENCES: Record<string, string> = { all: '', ent: 'An enterprise', uni: 'A university or college', gov: 'Government or a region', st: 'A startup or product team' };

export interface WfSaved {
  /** Organisation type (a key of AUDIENCES). */
  aud: string;
  /** Bays the visitor added, in the order added. */
  chosen: number[];
  /** Each bay's control values, owned by the controller. */
  ctl: Record<string, unknown>;
}

export interface SelectionHost {
  /** One line describing the current choice in bay i. */
  text(i: number): string;
  /** The next step's name for bay i (e.g. "Model My Requirement"). */
  next(i: number): string;
  /** Go to bay i. */
  openBay(i: number): void;
  /** Show the summary drawer section (key "wsum"). */
  openSummary(): void;
  /** Called after any change, so bay buttons can show their state. */
  changed(): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class SelectionTray {
  data: WfSaved = { aud: 'all', chosen: [], ctl: {} };
  private pill: HTMLButtonElement;
  private pop: HTMLElement;
  private sum: HTMLElement;
  private open = false;
  private shown = false;

  constructor(private host: SelectionHost) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<WfSaved>;
        this.data = {
          aud: typeof d.aud === 'string' && d.aud in AUDIENCES ? d.aud : 'all',
          chosen: Array.isArray(d.chosen) ? d.chosen.filter((i) => Number.isInteger(i) && i >= 0 && i < BAYS.length) : [],
          ctl: d.ctl && typeof d.ctl === 'object' ? d.ctl : {},
        };
      }
    } catch { /* storage blocked: start empty */ }

    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.id = 'wsPill';
    this.pill.hidden = true;
    this.pill.setAttribute('aria-expanded', 'false');
    this.pill.setAttribute('aria-controls', 'wsPop');
    this.pill.onclick = () => (this.open ? this.close() : this.show());
    this.pop = document.createElement('section');
    this.pop.id = 'wsPop';
    this.pop.hidden = true;
    this.pop.setAttribute('aria-label', 'Your selection');
    document.body.append(this.pill, this.pop);
    this.pop.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-ws]');
      if (!b) return;
      const [k, v] = b.dataset.ws!.split(':');
      if (k === 'bay') { this.close(); this.host.openBay(+v); }
      else if (k === 'rm') this.toggle(+v);
      else if (k === 'sum') { this.close(); this.host.openSummary(); }
    });
    addEventListener('pointerdown', (e) => { if (this.open && !(e.target as Element).closest('#wsPop,#wsPill')) this.close(); });
    addEventListener('keydown', (e) => { if (this.open && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);

    // The summary, shown in the site's side drawer.
    this.sum = document.createElement('section');
    this.sum.dataset.d = 'wsum';
    this.sum.hidden = true;
    this.sum.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-ws]');
      if (!b) return;
      const [k, v] = b.dataset.ws!.split(':');
      if (k === 'copy') this.copy(b);
      else if (k === 'bay') this.host.openBay(+v);
    });
    document.getElementById('cDrawer')?.appendChild(this.sum);
    this.paint();
  }

  has(i: number) { return this.data.chosen.includes(i); }

  /** Add bay i to the selection, or remove it. */
  toggle(i: number) {
    const c = this.data.chosen;
    if (c.includes(i)) c.splice(c.indexOf(i), 1); else c.push(i);
    this.save();
  }

  setAudience(k: string) {
    if (!(k in AUDIENCES) || this.data.aud === k) return;
    this.data.aud = k;
    this.save();
  }

  /** Store the controller's bay controls (call after any change in a bay). */
  saveControls(ctl: Record<string, unknown>) {
    this.data.ctl = ctl;
    this.save();
  }

  /** Show the pill where it makes sense (in the workforce journey, once something is chosen). */
  visible(on: boolean) {
    const want = on && (this.data.chosen.length > 0 || this.data.aud !== 'all');
    if (want === this.shown) return;
    this.shown = want;
    this.pill.hidden = !want;
    if (!want) this.close();
  }

  close() {
    if (!this.open) return;
    const f = this.pop.contains(document.activeElement);
    this.pop.hidden = true;
    this.open = false;
    this.pill.setAttribute('aria-expanded', 'false');
    if (f) this.pill.focus();
  }

  /** Plain-text summary for copying. */
  summaryText() {
    const d = this.data, lines = ['EmpowerED workforce selection'];
    if (AUDIENCES[d.aud]) lines.push('Building for: ' + AUDIENCES[d.aud]);
    d.chosen.forEach((i, n) => lines.push('', `${n + 1}. ${BAYS[i]}`, '   ' + this.host.text(i), '   Next step: ' + this.host.next(i)));
    if (!d.chosen.length) lines.push('', 'No services added yet.');
    lines.push('', 'Examples on the site are illustrative. Scope, timing and terms are agreed with EmpowerED.');
    return lines.join('\n');
  }

  private show() {
    this.paint();
    this.pop.hidden = false;
    this.open = true;
    this.pill.setAttribute('aria-expanded', 'true');
    this.pop.querySelector<HTMLElement>('button')?.focus();
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage blocked */ }
    this.paint();
    this.host.changed();
  }

  private async copy(b: HTMLElement) {
    const ta = this.sum.querySelector<HTMLTextAreaElement>('textarea');
    let ok = false;
    try { await navigator.clipboard.writeText(this.summaryText()); ok = true; } catch {
      if (ta) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } }
    }
    const st = this.sum.querySelector('.wsCopied');
    if (st) st.textContent = ok ? 'Copied. Paste it into an email or note.' : 'Select the text above and copy it.';
    b.blur();
  }

  paint() {
    const d = this.data, n = d.chosen.length;
    this.pill.innerHTML = `Your selection <b>${n}</b>`;
    this.pill.setAttribute('aria-label', `Your selection: ${n} service${n === 1 ? '' : 's'}`);
    const aud = AUDIENCES[d.aud] ? `<p class="wsAud">Building for: <b>${esc(AUDIENCES[d.aud])}</b></p>` : '';
    const rows = d.chosen.map((i) => `<li><button type="button" class="wsBay" data-ws="bay:${i}"><b>${esc(BAYS[i])}</b><span>${esc(this.host.text(i))}</span></button><button type="button" class="wsRm" data-ws="rm:${i}" aria-label="Remove ${esc(BAYS[i])}">×</button></li>`).join('');
    this.pop.innerHTML = `<h2>Your selection</h2>${aud}`
      + (n ? `<ol class="wsList">${rows}</ol>` : '<p class="wsEmpty">Add a service from any bay with “Add to my selection”.</p>')
      + `<button type="button" class="cta" data-ws="sum">Review and continue <span>→</span></button>`;

    const contact = CONTACT.email || CONTACT.phone
      ? `<div class="wsContact"><small>Send it to EmpowerED</small>${CONTACT.email ? `<p>Email: <b class="sel">${esc(CONTACT.email)}</b></p>` : ''}${CONTACT.phone ? `<p>Phone: <b class="sel">${esc(CONTACT.phone)}</b></p>` : ''}</div>`
      : `<div class="wsContact"><small>Send it to EmpowerED</small><p><span class="tbc">Coming soon</span> Contact details are being set up. Copy your summary and keep it until they’re published.</p></div>`;
    const list = d.chosen.map((i) => `<li><b>${esc(BAYS[i])}</b><p>${esc(this.host.text(i))}</p><p class="wsNext">Next step: ${esc(this.host.next(i))}</p><button type="button" class="opt" data-ws="bay:${i}">Change in this bay</button></li>`).join('');
    this.sum.innerHTML = `<div class="eyebrow">Build My Workforce</div><h3>Your selection</h3>${aud}`
      + (n ? `<ol class="wsSum">${list}</ol>` : '<p class="note">No services added yet. Visit a bay and choose “Add to my selection”.</p>')
      + `<label class="wsTxt">Summary to copy<textarea readonly rows="7">${esc(this.summaryText())}</textarea></label>`
      + `<div class="acts"><button type="button" class="cta" data-ws="copy">Copy summary <span>⧉</span></button></div><p class="wsCopied note" role="status"></p>`
      + contact
      + '<p class="note">Saved in this browser only. Nothing is sent from this page.</p>';
  }
}
