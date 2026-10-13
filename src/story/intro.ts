// Story intro: the self-contained story page runs in a full-screen iframe. While it shows,
// the rest of the site is inert and page scroll is locked. Scrolling past its end (or
// clicking its "Enter EmpowerED" link) fades it out and hands over to the company tour.
import { storyIntroUrl } from '../config';

export interface StoryIntro {
  /** Show the story again, fading it in over the current view. */
  replay(): void;
  /** Hide the story at once (deep links go straight into the site). */
  skip(): void;
  isShowing(): boolean;
}

const ENTER_LINK = /Enter (EmpowerED|the Factory)/i;

export function initStoryIntro(onEnter: () => void, onReplay: () => void): StoryIntro {
  const de = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fr = document.getElementById('storyIntro') as HTMLIFrameElement;
  let showing = true;
  /** After the hand-over, ignore leftover scroll momentum for a moment so the tour starts at its first stop. */
  let settleUntil = 0;
  let reduceSkip = false;

  const keep = (el: Element) => el === fr || el.tagName === 'SCRIPT' || el.tagName === 'STYLE';
  const inertAll = () => {
    for (const el of Array.from(document.body.children) as HTMLElement[]) if (!keep(el)) el.inert = showing;
  };
  new MutationObserver(inertAll).observe(document.body, { childList: true });

  function lock() {
    showing = true;
    de.classList.add('introOn');
    inertAll();
    scrollTo(0, 0);
  }
  lock();
  try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
  fr.src = storyIntroUrl();

  // While the story shows, swallow scroll and keys aimed at the page underneath.
  const block = (e: Event) => {
    if (!showing && performance.now() > settleUntil) return;
    e.stopImmediatePropagation();
    if (e.cancelable && e.type !== 'keyup') e.preventDefault();
  };
  ['wheel', 'keydown', 'keyup', 'touchmove'].forEach((t) => addEventListener(t, block, { capture: true, passive: false }));
  addEventListener('scroll', () => { if ((showing || performance.now() < settleUntil) && scrollY) scrollTo(0, 0); }, true);

  function enter() {
    if (!showing) return;
    const me = fr;
    showing = false;
    settleUntil = performance.now() + 1200;
    de.classList.remove('introOn');
    inertAll();
    onEnter();
    me.style.pointerEvents = 'none';
    if (reduce || reduceSkip) me.style.transition = 'none';
    me.style.opacity = '0';
    setTimeout(() => { me.remove(); try { document.body.focus(); } catch { /* ignore */ } }, reduce ? 0 : 760);
  }

  /** Watch the story document for "scrolled past the end" or the enter link. */
  function hook() {
    let w: Window;
    try { w = fr.contentWindow as Window; void w.document; } catch { return; }
    if (!w || w.__hooked) return;
    w.__hooked = 1;
    try { w.history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    try { w.scrollTo(0, 0); } catch { /* ignore */ }
    const se = () => w.document.scrollingElement || w.document.documentElement;
    const atBottom = () => { const s = se(); return s.scrollHeight > w.innerHeight + 4 && s.scrollTop + w.innerHeight >= s.scrollHeight - 2; };
    let bT = 0, acc = 0, ty: number | null = null, seen = false, lastDoc: HTMLElement | null = null, user = false;
    const arm = () => {
      const s = se();
      if (s.scrollTop < s.scrollHeight - 2 * w.innerHeight) seen = true;
      if (seen && atBottom()) { if (!bT) { bT = performance.now(); acc = 0; } } else { bT = 0; acc = 0; }
    };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => w.addEventListener(t, (e) => { if (e.isTrusted) user = true; }, { capture: true, passive: true }));
    w.addEventListener('scroll', () => {
      if (!user) {
        const s = se();
        if (s.scrollTop > 0) { try { w.scrollTo(0, 0); } catch { /* ignore */ } seen = false; bT = 0; acc = 0; return; }
      }
      arm();
    }, { passive: true });
    // The story page renders itself after load; keep it at the top until the visitor scrolls.
    const rs = setInterval(() => {
      if (!showing) { clearInterval(rs); return; }
      const d = w.document;
      if (d.documentElement !== lastDoc) { lastDoc = d.documentElement; try { w.scrollTo(0, 0); } catch { /* ignore */ } seen = false; bT = 0; acc = 0; }
    }, 200);
    setTimeout(() => clearInterval(rs), 15000);
    w.addEventListener('wheel', (e) => {
      if (!e.isTrusted) return;
      arm();
      if (!bT || e.deltaY <= 0) { if (e.deltaY < 0) acc = 0; return; }
      if (performance.now() - bT < 400) return;
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (acc > 140) enter();
    }, { passive: true });
    w.addEventListener('touchstart', (e) => { if (!e.isTrusted) return; arm(); ty = bT ? e.touches[0].clientY : null; }, { passive: true });
    w.addEventListener('touchmove', (e) => {
      if (e.isTrusted && ty != null && performance.now() - bT > 400 && ty - e.touches[0].clientY > 70) { ty = null; enter(); }
    }, { passive: true });
    w.addEventListener('keydown', (e) => {
      if (!e.isTrusted) return;
      arm();
      const k = e.key;
      if (bT && (k === 'ArrowDown' || k === 'PageDown' || k === 'End' || (k === ' ' && !e.shiftKey))) { e.preventDefault(); enter(); }
    });
    w.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (a && ENTER_LINK.test(a.textContent || '')) { e.preventDefault(); if (e.isTrusted) enter(); }
    }, true);
    try { w.focus(); } catch { /* ignore */ }
  }
  const pollHook = () => {
    let n = 0;
    const iv = setInterval(() => { hook(); if (++n > 40 || !showing) clearInterval(iv); }, 250);
  };
  fr.addEventListener('load', hook);
  pollHook();

  return {
    isShowing: () => showing,
    skip() { if (!showing) return; reduceSkip = true; enter(); },
    replay() {
      if (showing) return;
      onReplay();
      document.getElementById('storyIntro')?.remove();
      fr = document.createElement('iframe');
      fr.id = 'storyIntro';
      fr.title = 'EmpowerED Careers story';
      fr.style.opacity = '0';
      fr.style.transition = 'none';
      document.body.insertBefore(fr, document.body.firstChild);
      lock();
      fr.addEventListener('load', hook);
      fr.src = storyIntroUrl();
      pollHook();
      // Fade in over the current view once it has loaded (or after 4s if loading stalls).
      const me = fr;
      let began = false;
      const fade = () => {
        if (began || me !== fr || !showing) return;
        began = true;
        let t0 = 0;
        const f = (now: number) => {
          if (me !== fr || !showing) return;
          if (!t0) t0 = now;
          const u = reduce ? 1 : Math.min(1, (now - t0) / 700);
          me.style.opacity = String(u * u * (3 - 2 * u));
          if (u < 1) requestAnimationFrame(f);
          else { me.style.transition = ''; try { me.focus(); } catch { /* ignore */ } }
        };
        requestAnimationFrame(f);
      };
      me.addEventListener('load', () => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(fade)), 100), { once: true });
      setTimeout(fade, 4000);
    },
  };
}
