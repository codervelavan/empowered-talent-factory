// The guide: the 3D character's voice and speech bubble. Lines always show in the bubble;
// the voice is off until the visitor turns it on (browsers block audio before a click).
// Uses a recorded mp3 when one exists, else speechSynthesis.
import { GUIDE_LINES, type GuideLineId } from '../data/guideLines';
import { audioUrl } from '../config';
import type { LineKey } from '../bridge';
import type { CharacterStage } from './character/stage';

export interface Guide {
  /** Speak the line for station `i` (0-based) of a ride. */
  stop(line: LineKey, i: number): void;
  /** Cut speech but keep the bubble. */
  hush(): void;
  /** Story replay started: go quiet. */
  story(): void;
  /** At the station (after the story): introduce the guide and the board. */
  station(): void;
  /** "Change line": back at the board. */
  board(): void;
  factory(): void;
  /** "Back to the station" from the factory. */
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

/** Roughly how long a line takes to read or say, for timing silent lines. */
const readTime = (text: string) => Math.max(3500, text.length * 65);

export function initGuide(stage: CharacterStage): Guide {
  const SS: SpeechSynthesis | undefined = window.speechSynthesis;
  let voiceOn = false;
  let cur: GuideLineId | null = null;
  let tok = 0;
  let audio: HTMLAudioElement | null = null;
  let timer = 0;
  let talkTimer = 0;
  let howtoDone = false;
  let quiet = false;
  let voice: SpeechSynthesisVoice | null = null;
  const noFile: Partial<Record<GuideLineId, true>> = {};

  try { voiceOn = sessionStorage.getItem(VOICE_KEY) === 'on'; } catch { /* storage blocked */ }

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

  const bubble = stage.bubble;
  bubble.setAttribute('role', 'region');
  bubble.setAttribute('aria-label', 'Your EmpowerED guide');
  bubble.innerHTML = '<p aria-live="polite"></p><div class="gBtns"><button type="button" class="gR" aria-label="Replay guide">' + RPL + '</button><button type="button" class="gV"></button></div>';
  const textEl = bubble.querySelector('p')!;
  const bV = bubble.querySelector<HTMLButtonElement>('.gV')!;
  const boardBtn = document.querySelector<HTMLButtonElement>('.stGuide');

  function voiceUI() {
    bV.innerHTML = voiceOn ? SPK : MUTE;
    bV.setAttribute('aria-label', voiceOn ? 'Turn voice off' : 'Turn voice on');
    bV.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
    if (boardBtn) {
      boardBtn.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
      boardBtn.lastChild!.textContent = voiceOn ? 'Turn off voice' : 'Turn on voice';
    }
  }
  voiceUI();

  function silence() {
    tok++;
    clearTimeout(timer);
    clearTimeout(talkTimer);
    if (audio) {
      try { audio.pause(); } catch { /* ignore */ }
      audio.onended = audio.onerror = null;
      audio = null;
    }
    SS?.cancel();
    stage.talk(false);
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
    if (quiet) return;
    silence();
    const k = tok;
    cur = id;
    textEl.textContent = GUIDE_LINES[id];
    bubble.hidden = false;
    stage.cue(id);
    stage.talk(true);
    const done = () => {
      if (k !== tok) return;
      stage.talk(false);
      if (then) then();
    };
    if (voiceOn) voiceLine(id, k, done);
    else {
      // Silent: the character mouths the line for about as long as it takes to read.
      const ms = readTime(GUIDE_LINES[id]);
      talkTimer = window.setTimeout(() => { if (k === tok) stage.talk(false); }, Math.min(ms, 6000));
      if (then) timer = window.setTimeout(done, ms);
    }
  }

  function hush(hide: boolean) {
    silence();
    if (hide) { cur = null; bubble.hidden = true; }
  }

  function setVoice(on: boolean) {
    voiceOn = on;
    try { sessionStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
    voiceUI();
    if (!on) silence();
    else if (cur) say(cur, null);
  }

  bubble.querySelector<HTMLButtonElement>('.gR')!.onclick = () => { if (cur) say(cur, null); };
  bV.onclick = () => setVoice(!voiceOn);
  if (boardBtn) boardBtn.onclick = () => setVoice(!voiceOn);

  return {
    stop(line, i) {
      if (!PREFIX[line]) return;
      const id = (PREFIX[line] + (i + 1)) as GuideLineId;
      if (i === 0 && !howtoDone) { howtoDone = true; say(id, () => say('howto', null)); }
      else say(id, null);
    },
    hush() { silence(); },
    story() { quiet = true; hush(true); },
    station() { quiet = false; say('welcome', null); },
    board() { say('board', null); },
    factory() { say('factory', null); },
    end() { say('board', null); },
  };
}
