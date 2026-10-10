// Voice tour guide: narrates each stop with captions. Silent until the visitor
// clicks "Start the guided tour". Uses a recorded mp3 when one exists, else speechSynthesis.
import { GUIDE_LINES, type GuideLineId } from '../data/guideLines';
import { audioUrl } from '../config';
import type { LineKey } from '../bridge';

export interface Guide {
  /** Speak the line for station `i` (0-based) of a ride. */
  stop(line: LineKey, i: number): void;
  /** Cut speech but keep the caption. */
  hush(): void;
  /** Story replay started: go quiet. */
  story(): void;
  /** Back at the station after the story: say `welcome` if the story silenced us. */
  station(): void;
  /** "Change line": silence and hide the caption. */
  board(): void;
  factory(): void;
  /** "Back to the station": silence and hide the caption. */
  end(): void;
}

const PREFIX: Record<LineKey, string> = { career: 'career-', build: 'build-', workforce: 'work-' };
const VOICE_KEY = 'empowered-guide-voice';
const VOICE_PREFS = [/natural/i, /neural/i, /google us english/i, /samantha/i, /aria|jenny|guy/i, /google uk english/i, /daniel|karen|moira/i];

const ICON = (paths: string) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
const SPK = ICON('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>');
const MUTE = ICON('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/>');
const RPL = ICON('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>');

export function initGuide(): Guide {
  const SS: SpeechSynthesis | undefined = window.speechSynthesis;
  let on = false;
  let voiceOn = true;
  let cur: GuideLineId | null = null;
  let tok = 0;
  let audio: HTMLAudioElement | null = null;
  let timer = 0;
  let howtoDone = false;
  let quiet = false;
  let voice: SpeechSynthesisVoice | null = null;
  const noFile: Partial<Record<GuideLineId, true>> = {};

  try { voiceOn = sessionStorage.getItem(VOICE_KEY) !== 'off'; } catch { /* storage blocked */ }

  function pickVoice() {
    if (!SS) return;
    const en = SS.getVoices().filter((x) => /^en/i.test(x.lang));
    for (const re of VOICE_PREFS) {
      const m = en.find((x) => re.test(x.name));
      if (m) { voice = m; return; }
    }
    voice = en.find((x) => /en-US/i.test(x.lang)) || en[0] || null;
  }
  if (SS) { pickVoice(); SS.addEventListener?.('voiceschanged', pickVoice); }

  const cap = document.createElement('div');
  cap.id = 'gCap';
  cap.hidden = true;
  cap.setAttribute('role', 'region');
  cap.setAttribute('aria-label', 'Tour guide captions');
  cap.innerHTML = '<p aria-live="polite"></p><button type="button" class="gR" aria-label="Replay guide">' + RPL + '</button><button type="button" class="gV"></button>';
  document.body.appendChild(cap);
  const capP = cap.querySelector('p')!;
  const bV = cap.querySelector<HTMLButtonElement>('.gV')!;

  function vBtn() {
    bV.innerHTML = voiceOn ? SPK : MUTE;
    bV.setAttribute('aria-label', voiceOn ? 'Turn voice off' : 'Turn voice on');
    bV.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
  }
  vBtn();

  function silence() {
    tok++;
    clearTimeout(timer);
    if (audio) {
      try { audio.pause(); } catch { /* ignore */ }
      audio.onended = audio.onerror = null;
      audio = null;
    }
    SS?.cancel();
  }

  /** On the departure board the caption moves bottom-right so it never covers the board. */
  function place() {
    const st = document.getElementById('station');
    const m = document.getElementById('stMap');
    // The station sets the map's target opacity inline when a ride starts. Read that, not the
    // computed value: the map is still fading in when the first line plays, and the prototype's
    // computed-style check kept the caption in board mode (hidden below 1180px) for the whole ride.
    const onBoard = !!st && !st.hidden && (!m || Number(m.style.opacity || 0) < 0.5);
    cap.classList.toggle('board', onBoard);
  }

  function tts(text: string, k: number, done: () => void) {
    if (!SS) { done(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang || 'en-US';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => { if (k === tok) done(); };
    u.onerror = () => { if (k === tok) done(); };
    SS.speak(u);
  }

  function voiceLine(id: GuideLineId, k: number, done: () => void) {
    if (noFile[id]) { tts(GUIDE_LINES[id], k, done); return; }
    const a = new Audio(audioUrl(id));
    let started = false;
    audio = a;
    const fallback = () => {
      if (k !== tok || started) return;
      noFile[id] = true;
      audio = null;
      tts(GUIDE_LINES[id], k, done);
    };
    a.onerror = fallback;
    a.onended = () => { if (k === tok) done(); };
    a.onplaying = () => { started = true; };
    a.play()?.catch(fallback);
  }

  function say(id: GuideLineId, then: (() => void) | null) {
    if (!on || (quiet && id !== 'welcome')) return;
    silence();
    const k = tok;
    cur = id;
    capP.textContent = GUIDE_LINES[id];
    place();
    cap.hidden = false;
    const done = () => { if (k === tok && then) then(); };
    if (voiceOn) voiceLine(id, k, done);
    else if (then) timer = window.setTimeout(done, Math.max(3500, GUIDE_LINES[id].length * 65));
  }

  function hush(hide: boolean) {
    silence();
    if (hide) { cur = null; cap.hidden = true; }
  }

  cap.querySelector<HTMLButtonElement>('.gR')!.onclick = () => { if (cur) say(cur, null); };
  bV.onclick = () => {
    voiceOn = !voiceOn;
    try { sessionStorage.setItem(VOICE_KEY, voiceOn ? 'on' : 'off'); } catch { /* storage blocked */ }
    vBtn();
    if (!voiceOn) silence();
    else if (cur) say(cur, null);
  };

  const guide: Guide = {
    stop(line, i) {
      if (!on || !PREFIX[line]) return;
      const id = (PREFIX[line] + (i + 1)) as GuideLineId;
      if (i === 0 && !howtoDone) { howtoDone = true; say(id, () => say('howto', null)); }
      else say(id, null);
    },
    hush() { if (on) silence(); },
    story() { quiet = true; if (on) hush(true); },
    station() { const q = quiet; quiet = false; if (on && q) say('welcome', null); },
    board() { if (on) hush(true); },
    factory() { if (on) say('factory', null); },
    end() { if (on) hush(true); },
  };

  const btn = document.querySelector<HTMLButtonElement>('.stGuide');
  if (btn) btn.onclick = () => { on = true; btn.setAttribute('aria-pressed', 'true'); say('welcome', null); };

  return guide;
}
