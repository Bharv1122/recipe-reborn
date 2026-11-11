import { onDeviceSupported, startLocalVoice } from '@/lib/kitchen/voice-local';

/**
 * Optional voice input for the kitchen modes: the browser's Web Speech API
 * where it exists (Chrome, Edge, Safari), otherwise on-device Vosk (Quest).
 * Ported from the Hardware Anatomy Lab XR voice engine. Every failure
 * degrades to a status message — cooking always works by hand.
 */

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | undefined => {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

// `?voice=local` forces the on-device engine on desktop, to try what the Quest runs.
const forceLocal = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('voice') === 'local';
export const webSpeechSupported = () => typeof window !== 'undefined' && !!ctor() && !forceLocal();
export const voiceSupported = () => typeof window !== 'undefined' && (webSpeechSupported() || onDeviceSupported());
export const voiceUnsupportedReason = () =>
  typeof window !== 'undefined' && !window.isSecureContext
    ? 'Voice needs the page to be served over HTTPS. Everything works by hand.'
    : 'This browser can’t listen for voice commands. Everything works by hand.';

export type VoiceState = 'unsupported' | 'off' | 'loading' | 'listening' | 'error';
export type VoiceEngine = 'web-speech' | 'on-device';
export type VoiceHandlers = {
  onText: (text: string) => void;
  onState: (s: VoiceState, detail?: string, engine?: VoiceEngine) => void;
};

// Web Speech errors that mean "this browser can't do cloud speech", as opposed to the user saying no.
const FALL_BACK = new Set(['network', 'service-not-allowed', 'language-not-supported', 'bad-grammar']);

function startWebSpeech(h: VoiceHandlers, fallback: () => void): () => void {
  const C = ctor()!;
  let active = true;
  let heard = false;
  let rec: Recognition;
  try {
    rec = new C();
  } catch {
    fallback();
    return () => {};
  }
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    heard = true;
    for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) h.onText(e.results[i][0].transcript);
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    active = false;
    if (FALL_BACK.has(e.error) && !heard && onDeviceSupported()) return fallback();
    h.onState(
      'error',
      e.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow the microphone for this site, then turn voice on again.'
        : e.error === 'network'
          ? 'The speech service is unreachable from this browser.'
          : `Voice stopped (${e.error}).`
    );
  };
  // Continuous recognition ends by itself after a pause, so restart it until the user turns voice off.
  rec.onend = () => {
    if (!active) return;
    try {
      rec.start();
    } catch {
      active = false;
      h.onState('off');
    }
  };
  try {
    rec.start();
    h.onState('listening', undefined, 'web-speech');
  } catch {
    active = false;
    fallback();
    return () => {};
  }
  return () => {
    active = false;
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  };
}

/** Returns a stop function (which reports nothing; the caller owns the 'off' state). */
export function startVoice(h: VoiceHandlers): () => void {
  if (!voiceSupported()) {
    h.onState('unsupported', voiceUnsupportedReason());
    return () => {};
  }
  let stop: () => void = () => {};
  let stopped = false;
  const local = () => {
    if (!stopped)
      stop = startLocalVoice({
        onText: h.onText,
        onLoading: (d) => h.onState('loading', d, 'on-device'),
        onListening: () => h.onState('listening', undefined, 'on-device'),
        onError: (d) => h.onState('error', d, 'on-device'),
      });
  };
  if (webSpeechSupported()) stop = startWebSpeech(h, local);
  else local();
  return () => {
    stopped = true;
    stop();
  };
}
