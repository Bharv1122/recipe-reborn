'use client';

import { useEffect, useRef, useState } from 'react';
import { Ban, CalendarDays, CheckCircle2, Clock3, FolderPlus, ListChecks, RotateCcw, Sparkles } from 'lucide-react';

type DemoState = 'idle' | 'generating' | 'canceled' | 'complete';

const DEMO_LABEL = [
  'Enriched flour',
  'High-fructose corn syrup',
  'Palm oil',
  'Modified food starch',
  'Artificial flavor',
  'Yellow 5',
];

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
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-emerald-700">Synthetic label example</p>
          <h3 className="text-2xl font-black">Creamy boxed pasta mix</h3>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
          Demo mode — nothing is saved
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="label-title" className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Before</p>
          <h4 id="label-title" className="mt-1 text-lg font-black text-slate-950">Detected on the label</h4>
          <ul className="mt-4 flex flex-wrap gap-2">
            {DEMO_LABEL.map((item) => (
              <li key={item} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="fresh-title" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">After</p>
          <h4 id="fresh-title" className="mt-1 text-lg font-black text-slate-950">Generated fresh ingredients</h4>
          {state === 'complete' ? (
            <ul className="mt-4 space-y-2">
              {FRESH_INGREDIENTS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Start the walkthrough to reveal a fixed example recipe. The production generator uses
              the same honest elapsed-time and cancel pattern with live AI output.
            </p>
          )}
        </section>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white" aria-live="polite">
        {state === 'idle' && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Ready to transform the demo label</p>
              <p className="mt-1 text-sm text-slate-300">No finish-time promise. The elapsed clock is exact.</p>
            </div>
            <button onClick={start} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-400 px-5 py-3 font-bold text-slate-950 outline-none hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200">
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
              <p className="mt-1 text-sm text-slate-300">The demo label is still here. No recipe or account record was created.</p>
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
                <p className="mt-1 text-sm text-slate-300">The comparison uses only the fixed demo label and generated ingredient list above.</p>
              </div>
              <button onClick={() => setShowNextSteps(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-400 px-5 py-3 font-bold text-slate-950 outline-none hover:bg-orange-300 focus-visible:ring-4 focus-visible:ring-orange-200">
                Preview save and planning
              </button>
            </div>

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
