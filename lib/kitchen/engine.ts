/**
 * The hands-free cooking step engine, shared by the kitchen display
 * (/kitchen/[recipeId]) and the WebXR mode (/kitchen/[recipeId]/xr).
 *
 * Pure functions and a reducer only — no React, no DOM — so both surfaces
 * behave identically and scripts/verify-kitchen-engine.ts can test it all.
 * Timers store an absolute end time (not a countdown) so they stay accurate
 * even when the tab is throttled or the headset drops frames.
 */

export interface KitchenRecipe {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  /** House sample recipe (demo / public catalog), not a user's saved recipe. */
  isSample: boolean;
  replaces?: string;
}

export type TimerStatus = 'running' | 'paused' | 'done';

export interface KitchenTimer {
  id: string;
  label: string;
  durationMs: number;
  /** When running: absolute epoch ms the timer ends. */
  endsAt: number;
  /** When paused: time left. */
  remainingMs: number;
  status: TimerStatus;
  /** Step the timer was started from (so the UI can show "Step 5"). */
  step: number | null;
}

export interface KitchenState {
  step: number;
  total: number;
  finished: boolean;
  checked: boolean[];
  timers: KitchenTimer[];
  /** Bumped on "repeat" so the UI re-reads / re-announces the step. */
  repeatNonce: number;
  timerSeq: number;
}

export const MAX_TIMERS = 6;
const MAX_TIMER_MS = 6 * 60 * 60 * 1000;

export function initKitchenState(recipe: Pick<KitchenRecipe, 'steps' | 'ingredients'>): KitchenState {
  return {
    step: 0,
    total: recipe.steps.length,
    finished: false,
    checked: recipe.ingredients.map(() => false),
    timers: [],
    repeatNonce: 0,
    timerSeq: 0,
  };
}

export type KitchenAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; step: number }
  | { type: 'repeat' }
  | { type: 'restart' }
  | { type: 'toggleIngredient'; index: number }
  | { type: 'startTimer'; label: string; ms: number; now: number; step?: number | null }
  | { type: 'pauseTimer'; id: string; now: number }
  | { type: 'resumeTimer'; id: string; now: number }
  | { type: 'addTime'; id: string; ms: number; now: number }
  | { type: 'cancelTimer'; id: string }
  | { type: 'tick'; now: number };

export function timeLeft(t: KitchenTimer, now: number): number {
  if (t.status === 'running') return Math.max(0, t.endsAt - now);
  if (t.status === 'paused') return t.remainingMs;
  return 0;
}

export function kitchenReducer(state: KitchenState, action: KitchenAction): KitchenState {
  switch (action.type) {
    case 'next':
      if (state.finished || state.total === 0) return state;
      if (state.step >= state.total - 1) return { ...state, finished: true };
      return { ...state, step: state.step + 1 };
    case 'back':
      if (state.finished) return { ...state, finished: false };
      return { ...state, step: Math.max(0, state.step - 1) };
    case 'goto':
      if (state.total === 0) return state;
      return { ...state, finished: false, step: Math.max(0, Math.min(state.total - 1, Math.floor(action.step))) };
    case 'repeat':
      return { ...state, repeatNonce: state.repeatNonce + 1 };
    case 'restart':
      return { ...state, step: 0, finished: false, checked: state.checked.map(() => false) };
    case 'toggleIngredient': {
      if (action.index < 0 || action.index >= state.checked.length) return state;
      const checked = state.checked.slice();
      checked[action.index] = !checked[action.index];
      return { ...state, checked };
    }
    case 'startTimer': {
      const ms = Math.min(MAX_TIMER_MS, Math.max(1000, Math.round(action.ms)));
      const seq = state.timerSeq + 1;
      const timer: KitchenTimer = {
        id: `t${seq}`,
        label: action.label.slice(0, 60),
        durationMs: ms,
        endsAt: action.now + ms,
        remainingMs: ms,
        status: 'running',
        step: action.step ?? null,
      };
      // Keep the newest timers; drop the oldest finished one first when full.
      const timers = [...state.timers, timer];
      while (timers.length > MAX_TIMERS) {
        const doneIdx = timers.findIndex((t) => t.status === 'done');
        timers.splice(doneIdx >= 0 ? doneIdx : 0, 1);
      }
      return { ...state, timers, timerSeq: seq };
    }
    case 'pauseTimer':
      return mapTimer(state, action.id, (t) =>
        t.status === 'running' ? { ...t, status: 'paused', remainingMs: timeLeft(t, action.now) } : t
      );
    case 'resumeTimer':
      return mapTimer(state, action.id, (t) =>
        t.status === 'paused' ? { ...t, status: 'running', endsAt: action.now + t.remainingMs } : t
      );
    case 'addTime':
      return mapTimer(state, action.id, (t) => {
        if (t.status === 'running') return { ...t, endsAt: t.endsAt + action.ms, durationMs: t.durationMs + action.ms };
        if (t.status === 'paused') return { ...t, remainingMs: t.remainingMs + action.ms, durationMs: t.durationMs + action.ms };
        // "+1 min" on a finished timer restarts it for that long.
        return { ...t, status: 'running', endsAt: action.now + action.ms, remainingMs: action.ms, durationMs: action.ms };
      });
    case 'cancelTimer':
      return { ...state, timers: state.timers.filter((t) => t.id !== action.id) };
    case 'tick': {
      let changed = false;
      const timers = state.timers.map((t) => {
        if (t.status === 'running' && t.endsAt <= action.now) {
          changed = true;
          return { ...t, status: 'done' as const, remainingMs: 0 };
        }
        return t;
      });
      return changed ? { ...state, timers } : state;
    }
  }
}

function mapTimer(state: KitchenState, id: string, fn: (t: KitchenTimer) => KitchenTimer): KitchenState {
  return { ...state, timers: state.timers.map((t) => (t.id === id ? fn(t) : t)) };
}

/** IDs of timers that went from running to done between two states. */
export function newlyFinished(prev: KitchenState, next: KitchenState): string[] {
  const wasRunning = new Set(prev.timers.filter((t) => t.status === 'running').map((t) => t.id));
  return next.timers.filter((t) => t.status === 'done' && wasRunning.has(t.id)).map((t) => t.id);
}

// --- Step text helpers ------------------------------------------------------

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, sixty: 60,
};

const DURATION_RE =
  /\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty-five|sixty)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

export interface DetectedTimer {
  label: string;
  ms: number;
}

/**
 * Finds durations in a step ("simmer for 20 minutes", "3-4 min", "an hour").
 * For a range we time the shorter end, so the cook checks early rather than late.
 */
export function detectTimers(step: string): DetectedTimer[] {
  const out: DetectedTimer[] = [];
  for (const m of Array.from(step.matchAll(DURATION_RE))) {
    const first = m[1].toLowerCase();
    const n = /^\d/.test(first) ? parseFloat(first) : WORD_NUMBERS[first];
    if (!n) continue;
    // "a minute" is a timer; "a few seconds" style vagueness is not matched by the regex.
    const unit = m[3].toLowerCase();
    const ms = n * (unit.startsWith('h') ? 3_600_000 : unit.startsWith('s') ? 1000 : 60_000);
    if (ms < 5000) continue;
    out.push({ label: m[0].replace(/\s+/g, ' ').trim(), ms });
  }
  return out;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export interface TextSegment {
  text: string;
  amount: boolean;
}

// Quantities worth making huge: "1/4 cup", "2 tbsp", "28 oz", "350°F", "8-inch", "½ tsp".
const AMOUNT_RE =
  /(\d+\s+\d\/\d|\d+\/\d|\d+(?:\.\d+)?|[¼½¾⅓⅔])(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?(?:\s*(?:°\s?[FC]|-inch|inch(?:es)?|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|cloves?|minutes?|mins?|hours?|seconds?))?\b/gi;

/** Splits text into plain and "amount" runs, for emphasis in the UI. */
export function splitAmounts(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(AMOUNT_RE))) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), amount: false });
    out.push({ text: m[0], amount: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), amount: false });
  return out;
}

const STOP_WORDS = new Set([
  'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 'ounce', 'ounces',
  'pound', 'pounds', 'large', 'small', 'medium', 'fresh', 'chopped', 'diced', 'minced', 'sliced', 'thinly',
  'plus', 'more', 'taste', 'optional', 'into', 'cut', 'strips', 'melted', 'ground', 'dried', 'whole', 'canned',
  'leaves', 'cloves', 'grated', 'shredded', 'plain', 'with', 'their', 'juice', 'extract', 'purpose',
]);

const stem = (w: string) => (w.length > 3 && w.endsWith('es') && !w.endsWith('oes') ? w.slice(0, -1) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

function keyWords(ingredient: string): string[] {
  const name = ingredient.split(',')[0].toLowerCase();
  return name
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map(stem);
}

/** Which ingredients a step mentions, so the display can show their amounts next to the step. */
export function ingredientsForStep(ingredients: string[], step: string): number[] {
  const words = new Set(step.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(stem));
  const hits: number[] = [];
  ingredients.forEach((ing, i) => {
    const keys = keyWords(ing);
    if (keys.length === 0) return;
    // The last key word is usually the noun ("olive oil" → oil); require it, plus any one other if present.
    const noun = keys[keys.length - 1];
    if (words.has(noun)) hits.push(i);
  });
  return hits;
}

// --- Voice commands ---------------------------------------------------------

export type KitchenCommand =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'repeat' }
  | { type: 'ingredients' }
  | { type: 'timer'; minutes: number | null }
  | { type: 'pause-timers' }
  | { type: 'resume-timers' }
  | { type: 'stop-timers' }
  | { type: 'help' }
  | { type: 'stop-listening' };

// Word-boundary matching keeps "backstage" from triggering "back". Order matters:
// timer phrases are checked before the bare "stop"/"next" words they contain.
export function parseKitchenCommand(transcript: string): KitchenCommand | null {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  if (!t.trim()) return null;
  if (/\b(help|what can i say|commands)\b/.test(t)) return { type: 'help' };
  if (/\b(pause|hold) (the )?timers?\b/.test(t)) return { type: 'pause-timers' };
  if (/\b(resume|continue|restart) (the )?timers?\b/.test(t)) return { type: 'resume-timers' };
  if (/\b(stop|cancel|clear|silence|dismiss) (the |all )?(timers?|alarms?)\b/.test(t)) return { type: 'stop-timers' };
  if (/\b(start|set|add)?\s*(a )?timer\b/.test(t)) {
    const m = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty)\s*(minutes?|mins?)\b/);
    const minutes = m ? (/^\d/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUMBERS[m[1]]) : null;
    return { type: 'timer', minutes };
  }
  if (/\b(stop listening|voice off|stop voice)\b/.test(t)) return { type: 'stop-listening' };
  if (/\b(ingredients?|what do i need|shopping)\b/.test(t)) return { type: 'ingredients' };
  if (/\b(repeat|again|say that again|one more time|read it)\b/.test(t)) return { type: 'repeat' };
  if (/\b(back|previous|go back|last step)\b/.test(t)) return { type: 'back' };
  if (/\b(next|forward|continue|go on|done|okay next|ok next)\b/.test(t)) return { type: 'next' };
  return null;
}

/** Closed vocabulary for the on-device recognizer, so it only listens for commands. */
export const KITCHEN_GRAMMAR = [
  'next', 'next step', 'go on', 'done', 'back', 'go back', 'previous', 'repeat', 'say that again', 'read it',
  'ingredients', 'start timer', 'set a timer', 'start timer five minutes', 'start timer ten minutes',
  'start timer one minute', 'start timer two minutes', 'start timer three minutes', 'start timer twenty minutes',
  'pause timer', 'resume timer', 'stop timer', 'cancel timer', 'help', 'stop listening', '[unk]',
];

export const KITCHEN_HELP =
  'Say “next”, “back”, “repeat”, “ingredients”, “start timer”, “start timer five minutes”, “pause timer”, “stop timer” or “stop listening”.';
