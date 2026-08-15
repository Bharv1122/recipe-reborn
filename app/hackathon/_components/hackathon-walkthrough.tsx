'use client';

import { useEffect, useRef, useState } from 'react';
import { Ban, CalendarDays, CheckCircle2, Clock3, FolderPlus, ListChecks, RotateCcw, Sparkles } from 'lucide-react';

type DemoState = 'idle' | 'generating' | 'canceled' | 'complete';

const FRESH_INGREDIENTS = [
  'Elbow pasta',
  'Sharp cheddar',
  'Whole milk',
  'Butter',
  'Paprika',
];

export function HackathonWalkthrough() {
  const [state, setState] = useState<DemoState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const completionRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'generating') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    completionRef.current = window.setTimeout(() => setState('complete'), 5200);

    return () => {
      window.clearInterval(timer);
      if (completionRef.current) window.clearTimeout(completionRef.current);
    };
  }, [state]);

  const start = () => {
    setElapsed(0);
    setShowNextSteps(false);
    setState('generating');
  };

  const cancel = () => {
    if (completionRef.current) window.clearTimeout(completionRef.current);
    setState('canceled');
  };

  const reset = () => {
    setElapsed(0);
    setShowNextSteps(false);
    setState('idle');
  };

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-xl sm:p-7">
      {/* Just the action and its result. The label preamble and the
          before/after panels were removed: the transformation is the point,
          and showing both sides up front gave the ending away before anyone
          pressed the button. The generated ingredients now appear here, on
          completion, so there is still a payoff. */}
      <div className="rounded-2xl bg-slate-950 p-5 text-white" aria-live="polite">
        {state === 'idle' && (
          <div className="flex justify-center">
            <button
              onClick={start}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3 font-bold text-slate-950 outline-none hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" /> Generate demo recipe
            </button>
          </div>
        )}

        {state === 'generating' && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-bold"><Clock3 className="h-5 w-5 text-orange-300" aria-hidden="true" /> Building the fresh recipe…</p>
              <p className="mt-1 text-sm text-slate-300">Elapsed: {elapsed}s. Checking structure and substitutions.</p>
            </div>
            <button onClick={cancel} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 font-bold outline-none hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-white/30">
              <Ban className="h-5 w-5" aria-hidden="true" /> Cancel generation
            </button>
          </div>
        )}

        {state === 'canceled' && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Generation canceled safely.</p>
              <p className="mt-1 text-sm text-slate-300">Nothing was created — no recipe, no account record.</p>
            </div>
            <button onClick={start} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3 font-bold text-slate-950 outline-none hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200">
              <RotateCcw className="h-5 w-5" aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {state === 'complete' && (
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" /> Creamy Homestyle Pasta is ready</p>
                <p className="mt-1 text-sm text-slate-300">Made with whole ingredients instead of the packaged mix.</p>
              </div>
              <button onClick={() => setShowNextSteps(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-400 px-5 py-3 font-bold text-slate-950 outline-none hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200">
                Preview save and planning
              </button>
            </div>

            <ul className="mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-5">
              {FRESH_INGREDIENTS.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>

            {showNextSteps ? (
              <div className="mt-5 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-3">
                <div className="rounded-xl bg-white/10 p-4"><FolderPlus className="h-5 w-5 text-orange-300" aria-hidden="true" /><p className="mt-2 font-bold">Save to a collection</p><p className="mt-1 text-xs text-slate-300">Organize approved recipes after sign-in.</p></div>
                <div className="rounded-xl bg-white/10 p-4"><CalendarDays className="h-5 w-5 text-orange-300" aria-hidden="true" /><p className="mt-2 font-bold">Add to a meal plan</p><p className="mt-1 text-xs text-slate-300">Schedule a chosen recipe for the week.</p></div>
                <div className="rounded-xl bg-white/10 p-4"><ListChecks className="h-5 w-5 text-orange-300" aria-hidden="true" /><p className="mt-2 font-bold">Build a shopping list</p><p className="mt-1 text-xs text-slate-300">Turn selected recipe ingredients into a checklist.</p></div>
              </div>
            ) : null}

            <button onClick={reset} className="mt-5 text-sm font-semibold text-slate-300 underline decoration-slate-500 underline-offset-4 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white">
              Restart walkthrough
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
