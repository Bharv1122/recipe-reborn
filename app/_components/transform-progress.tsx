'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Search, ChefHat } from 'lucide-react';
import type { DetectedAdditive } from '@/lib/additives';

/**
 * Fills the ~19s a guest recipe takes to generate.
 *
 * The additive scan is pure client-side string matching, so its result exists
 * within a millisecond of the button press — there is no reason to hide it
 * behind a spinner for twenty seconds. Showing it immediately turns dead time
 * into the "oh, THAT is in my food" moment, and the recipe finishes underneath.
 *
 * The stage labels below describe work that is genuinely happening. No fake
 * percentage bar: we cannot know how far along the model is, and inventing a
 * number that jumps to 90% and sits there is worse than saying nothing.
 */

const STAGES = [
  { at: 0, icon: Search, label: 'Reading your ingredient list…' },
  { at: 2500, icon: ChefHat, label: 'Writing a fresh recipe without them…' },
  { at: 11000, icon: ChefHat, label: 'Working out quantities and steps…' },
];

export function TransformProgress({ additives }: { additives: DetectedAdditive[] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(id);
  }, []);

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) ?? STAGES[0];
  const StageIcon = stage.icon;

  return (
    <div className="mt-4 space-y-3" aria-live="polite">
      {additives.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Detected on the label
            </span>
          </div>
          <p className="mb-2 text-2xl font-bold text-red-600">
            {additives.length} flagged item{additives.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {additives.slice(0, 6).map((a) => (
              <span
                key={a.name}
                className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                {a.name}
              </span>
            ))}
            {additives.length > 6 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                +{additives.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-emerald-600" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <StageIcon className="h-4 w-4 flex-shrink-0" />
            {stage.label}
          </p>
          <p className="text-xs text-emerald-700/70">
            Usually about 20 seconds — hang tight.
          </p>
        </div>
      </div>

      {/* Skeleton of the recipe card that is about to land, so the layout does
          not jump when it arrives. */}
      <div className="space-y-2" aria-hidden="true">
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
