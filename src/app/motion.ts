// One reduced-motion setting for the whole site. It starts from the visitor's saved choice, or the
// operating system's preference, and every part of the site (tour travel, 3D scene, branding, story)
// reads it here so a change applies everywhere at once.

const KEY = 'ee-reduce-motion';
type Fn = (reduced: boolean) => void;

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let chosen: boolean | null = null;
try { const v = localStorage.getItem(KEY); if (v === '1' || v === '0') chosen = v === '1'; } catch { /* storage blocked */ }

const subs = new Set<Fn>();
let value = chosen ?? !!mq?.matches;

function emit(v: boolean) { if (v === value) return; value = v; subs.forEach((f) => f(v)); }

// Follow the system setting until the visitor makes their own choice.
mq?.addEventListener?.('change', (e) => { if (chosen === null) emit(e.matches); });

export const motion = {
  get reduced() { return value; },
  /** The visitor's choice (saved). */
  set(v: boolean) {
    chosen = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
    emit(v);
  },
  /** Call fn whenever the setting changes. */
  on(fn: Fn) { subs.add(fn); return () => subs.delete(fn); },
};
