'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  KITCHEN_HELP,
  detectTimers,
  initKitchenState,
  kitchenReducer,
  newlyFinished,
  parseKitchenCommand,
  type KitchenRecipe,
  type KitchenState,
} from '@/lib/kitchen/engine';
import { startVoice, voiceSupported, voiceUnsupportedReason, type VoiceEngine, type VoiceState } from '@/lib/kitchen/voice';

/**
 * React glue around the shared step engine: ticking timers, the timer alarm,
 * read-aloud, and optional voice commands. Both the kitchen display and the
 * WebXR scene use this one hook, so they behave the same.
 */

export interface KitchenController {
  recipe: KitchenRecipe;
  state: KitchenState;
  now: number;
  next: () => void;
  back: () => void;
  goto: (step: number) => void;
  repeat: () => void;
  restart: () => void;
  toggleIngredient: (index: number) => void;
  startTimer: (label: string, ms: number, step?: number | null) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  addMinute: (id: string) => void;
  cancelTimer: (id: string) => void;
  readAloud: boolean;
  toggleReadAloud: () => void;
  ttsSupported: boolean;
  voice: VoiceState;
  voiceEngine: VoiceEngine | null;
  voiceNote: string;
  heard: string;
  toggleVoice: () => void;
  /** Short status line (voice feedback, "timer done" etc.). */
  toast: string;
  alarming: boolean;
}

interface Options {
  /** Called for the "ingredients" voice command. */
  onShowIngredients?: () => void;
}

function beep(ctx: AudioContext) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.35, t + i * 0.3 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.3);
    osc.stop(t + i * 0.3 + 0.25);
  }
}

export function useKitchen(recipe: KitchenRecipe, options: Options = {}): KitchenController {
  const [state, dispatch] = useReducer(kitchenReducer, recipe, initKitchenState);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToastText] = useState('');
  const toastTimer = useRef<number>(0);
  const setToast = useCallback((text: string, ms = 4500) => {
    setToastText(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(''), ms);
  }, []);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const stateRef = useRef(state);

  // --- speech output ---------------------------------------------------------
  const [ttsSupported, setTtsSupported] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  useEffect(() => setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window), []);
  const say = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, []);
  const stepText = useCallback(
    (s: KitchenState) => (s.finished ? 'All done. Enjoy your meal!' : `Step ${s.step + 1}. ${recipe.steps[s.step] ?? ''}`),
    [recipe.steps]
  );

  // Read the step aloud when it changes or on "repeat", if read-aloud is on.
  const lastSpoken = useRef('');
  useEffect(() => {
    const key = `${state.step}:${state.finished}:${state.repeatNonce}`;
    if (!readAloud || lastSpoken.current === key) return;
    lastSpoken.current = key;
    say(stepText(state));
  }, [readAloud, say, state, stepText]);

  const toggleReadAloud = useCallback(() => {
    setReadAloud((on) => {
      if (on) window.speechSynthesis?.cancel();
      else {
        // Turning it on is the user gesture browsers need before speaking.
        lastSpoken.current = `${stateRef.current.step}:${stateRef.current.finished}:${stateRef.current.repeatNonce}`;
        say(stepText(stateRef.current));
      }
      return !on;
    });
  }, [say, stepText]);

  // --- timers ------------------------------------------------------------------
  const anyRunning = state.timers.some((t) => t.status === 'running');
  const alarming = state.timers.some((t) => t.status === 'done');
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const audioRef = useRef<AudioContext | null>(null);
  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume().catch(() => {});
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const prev = stateRef.current;
    stateRef.current = state;
    const finished = newlyFinished(prev, state);
    if (finished.length === 0) return;
    const labels = state.timers.filter((t) => finished.includes(t.id)).map((t) => t.label);
    setToast(`⏰ Timer done: ${labels.join(', ')}`, 8000);
    try {
      navigator.vibrate?.([300, 150, 300]);
    } catch {
      /* not supported */
    }
    if (readAloud) say(`Timer done: ${labels.join(', ')}`);
  }, [state, readAloud, say, setToast]);

  // Beep every couple of seconds while any timer is finished and not dismissed (max ~1 minute).
  useEffect(() => {
    if (!alarming) return;
    let count = 0;
    const ring = () => {
      const ctx = ensureAudio();
      if (ctx) beep(ctx);
    };
    ring();
    const id = window.setInterval(() => {
      if (++count >= 30) return window.clearInterval(id);
      ring();
    }, 2000);
    return () => window.clearInterval(id);
  }, [alarming, ensureAudio]);

  // --- actions -------------------------------------------------------------------
  const actions = useMemo(
    () => ({
      next: () => dispatch({ type: 'next' }),
      back: () => dispatch({ type: 'back' }),
      goto: (step: number) => dispatch({ type: 'goto', step }),
      repeat: () => dispatch({ type: 'repeat' }),
      restart: () => dispatch({ type: 'restart' }),
      toggleIngredient: (index: number) => dispatch({ type: 'toggleIngredient', index }),
      startTimer: (label: string, ms: number, step: number | null = null) => {
        ensureAudio(); // unlock audio on this user gesture so the alarm can sound later
        const t = Date.now();
        setNow(t);
        dispatch({ type: 'startTimer', label, ms, now: t, step });
      },
      pauseTimer: (id: string) => dispatch({ type: 'pauseTimer', id, now: Date.now() }),
      resumeTimer: (id: string) => {
        const t = Date.now();
        setNow(t);
        dispatch({ type: 'resumeTimer', id, now: t });
      },
      addMinute: (id: string) => {
        const t = Date.now();
        setNow(t);
        dispatch({ type: 'addTime', id, ms: 60_000, now: t });
      },
      cancelTimer: (id: string) => dispatch({ type: 'cancelTimer', id }),
    }),
    [ensureAudio]
  );

  // "Repeat" always reads the step out loud (when the browser can speak);
  // with read-aloud on, the step effect above does the speaking.
  const repeat = useCallback(() => {
    if (!readAloud) say(stepText(stateRef.current));
    actions.repeat();
  }, [actions, readAloud, say, stepText]);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  // --- voice input -----------------------------------------------------------------
  const [voice, setVoice] = useState<VoiceState>('off');
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine | null>(null);
  const [voiceNote, setVoiceNote] = useState('');
  const [heard, setHeard] = useState('');
  useEffect(() => {
    if (!voiceSupported()) {
      setVoice('unsupported');
      setVoiceNote(voiceUnsupportedReason());
    }
  }, []);
  const stopVoice = useRef<(() => void) | null>(null);

  const handleText = useCallback(
    (text: string) => {
      setHeard(text);
      const c = parseKitchenCommand(text);
      const s = stateRef.current;
      if (!c) return setToast(`Heard “${text}”. Say “help” for commands.`);
      switch (c.type) {
        case 'next':
          return actions.next();
        case 'back':
          return actions.back();
        case 'repeat':
          return repeatRef.current();
        case 'ingredients':
          optionsRef.current.onShowIngredients?.();
          return setToast('Showing ingredients.');
        case 'help':
          return setToast(KITCHEN_HELP, 9000);
        case 'timer': {
          const detected = detectTimers(recipe.steps[s.step] ?? '')[0];
          const ms = c.minutes ? c.minutes * 60_000 : detected?.ms ?? 5 * 60_000;
          const label = c.minutes ? `${c.minutes} min` : detected?.label ?? '5 min';
          actions.startTimer(`Step ${s.step + 1}: ${label}`, ms, s.step);
          return setToast(`Timer started: ${label}.`);
        }
        case 'pause-timers':
          s.timers.filter((t) => t.status === 'running').forEach((t) => actions.pauseTimer(t.id));
          return setToast('Timers paused.');
        case 'resume-timers':
          s.timers.filter((t) => t.status === 'paused').forEach((t) => actions.resumeTimer(t.id));
          return setToast('Timers resumed.');
        case 'stop-timers': {
          // Silence finished timers first; if none are ringing, cancel them all.
          const done = s.timers.filter((t) => t.status === 'done');
          (done.length ? done : s.timers).forEach((t) => actions.cancelTimer(t.id));
          return setToast(done.length ? 'Alarm off.' : 'Timers cancelled.');
        }
        case 'stop-listening':
          stopVoice.current?.();
          stopVoice.current = null;
          setVoice('off');
          return setToast('Voice off.');
      }
    },
    [actions, recipe.steps, setToast]
  );
  const handleTextRef = useRef(handleText);
  handleTextRef.current = handleText;

  const toggleVoice = useCallback(() => {
    if (stopVoice.current) {
      stopVoice.current();
      stopVoice.current = null;
      setVoice('off');
      setVoiceNote('');
      return;
    }
    let ended = false;
    const stop = startVoice({
      onText: (t) => handleTextRef.current(t),
      onState: (v, detail, engine) => {
        setVoice(v);
        setVoiceNote(detail ?? '');
        if (engine) setVoiceEngine(engine);
        if (v === 'error' || v === 'unsupported' || v === 'off') {
          ended = true;
          stopVoice.current?.();
          stopVoice.current = null;
        }
      },
    });
    if (ended) stop();
    else stopVoice.current = stop;
  }, []);

  useEffect(
    () => () => {
      stopVoice.current?.();
      window.clearTimeout(toastTimer.current);
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      void audioRef.current?.close().catch(() => {});
    },
    []
  );

  return {
    recipe,
    state,
    now,
    ...actions,
    repeat,
    readAloud,
    toggleReadAloud,
    ttsSupported,
    voice,
    voiceEngine,
    voiceNote,
    heard,
    toggleVoice,
    toast,
    alarming,
  };
}
