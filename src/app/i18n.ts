// English / Tamil for the guided site. English text is the key: tr('Next') returns the Tamil when the
// visitor has chosen Tamil and a translation exists, otherwise the English. The Tamil is a draft for
// native review (src/i18n/ta.ts). Missing keys are collected in development so none slip through.

import { TA } from '../i18n/ta';

export type Lang = 'en' | 'ta';
const KEY = 'ee-lang';
type Fn = (l: Lang) => void;

let lang: Lang = 'en';
try { if (localStorage.getItem(KEY) === 'ta') lang = 'ta'; } catch { /* storage blocked */ }
const subs = new Set<Fn>();

/** English strings with no Tamil yet (development check). */
export const MISSING = new Set<string>();

export const i18n = {
  get lang() { return lang; },
  set(l: Lang) {
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    document.documentElement.lang = l === 'ta' ? 'ta' : 'en';
    subs.forEach((f) => f(l));
  },
  on(fn: Fn) { subs.add(fn); return () => subs.delete(fn); },
};
document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';

/** Translate a string (English is the key). */
export function tr(s: string): string {
  if (lang === 'en' || !s || /^[\s\d.,:;·→←↗▶×+\-–—()%/|*#&]*$/.test(s)) return s;
  const t = TA[s];
  if (t === undefined) { MISSING.add(s); return s; }
  return t;
}

/** Translate a template with {named} slots, e.g. trf('Stop {n} of {m}', { n: 2, m: 5 }). */
export function trf(s: string, v: Record<string, string | number>): string {
  return tr(s).replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

/** Pick between hand-written English and Tamil (for sentences built from other values). */
export const L = (en: string, ta: string) => (lang === 'ta' ? ta : en);

// ---- Translating rendered HTML ---------------------------------------------------------------
// Panels are rendered in English and then translated in place. Each text node keeps its English
// original, so switching back to English restores it. Composite lines use the patterns in ta.ts.

import { TA_PATTERNS } from '../i18n/ta';

const ORIG = new WeakMap<Node, string>();
const ORIG_ATTR = new WeakMap<Element, Record<string, string>>();
const TAMIL = /[஀-௿]/;
const SKIP = /^[\s\d.,:;·→←↗▶×+\-–—()%/|*#&’'"“”]*$/;

/** Translate one string: exact entry first, then the patterns (whose parts are translated in turn). */
function trText(s: string): string {
  const k = s.trim();
  if (!k || SKIP.test(k) || TAMIL.test(k)) return s;
  let out = TA[k];
  if (out === undefined) {
    for (const [re, fn] of TA_PATTERNS) { const m = k.match(re); if (m) { const r = fn(m, (p) => trText(p)); if (r !== undefined) { out = r; break; } } }
  }
  if (out === undefined) { MISSING.add(k); return s; }
  const lead = s.match(/^\s*/)![0], tail = s.match(/\s*$/)![0];
  return lead + out + tail;
}
export { trText };

/** Translate (or restore) every text node and label inside root for the current language. */
export function translateDom(root: Element | null) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = (n as Text).parentElement;
    if (p && (p.closest('[data-notr]') || p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
    if (!ORIG.has(n)) ORIG.set(n, (n as Text).data);
    const o = ORIG.get(n)!;
    const v = lang === 'ta' ? trText(o) : o;
    if ((n as Text).data !== v) (n as Text).data = v;
  }
  root.querySelectorAll('[aria-label],[placeholder],[title]').forEach((el) => {
    let o = ORIG_ATTR.get(el);
    if (!o) { o = {}; for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v) o[a] = v; } ORIG_ATTR.set(el, o); }
    for (const [a, v] of Object.entries(o)) el.setAttribute(a, lang === 'ta' ? trText(v) : v);
  });
}

// Development: list untranslated strings (window.__i18n.MISSING) so they can be filled in.
if (import.meta.env.DEV) Object.assign(window as object, { __i18n: { MISSING, i18n, trText } });
