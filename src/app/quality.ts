// Rendering quality. "Lighter 3D" is the visitor's own choice (saved): it caps the pixel ratio at 1
// and pauses ambient animation. Otherwise the pixel ratio is capped at 1.5 on desktop and 1.25 on phones.

const KEY = 'ee-light';
type Fn = (light: boolean) => void;

let light = false;
try { light = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
const subs = new Set<Fn>();

const phone = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || innerWidth <= 760;

export const quality = {
  get light() { return light; },
  set(v: boolean) {
    if (v === light) return;
    light = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
    subs.forEach((f) => f(v));
  },
  on(fn: Fn) { subs.add(fn); return () => subs.delete(fn); },
  /** Device pixel ratio to render at. */
  pixelRatio() { return Math.min(devicePixelRatio || 1, light ? 1 : phone() ? 1.25 : 1.5); },
};
