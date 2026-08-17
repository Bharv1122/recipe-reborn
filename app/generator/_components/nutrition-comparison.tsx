'use client';

import { Button } from '@/components/ui/button';
import {
  NUTRIENT_FIELDS,
  hasNutritionValues,
  type NutritionValues,
  type OriginalNutrition,
} from '@/lib/nutrition-facts';
import { HeartPulse, Loader2 } from 'lucide-react';

export interface FreshNutritionEstimate extends NutritionValues {
  perServing: true;
  accuracy: 'estimated';
  basisLabel: string;
  sourceLabel: string;
}

interface NutritionComparisonProps {
  original: OriginalNutrition | null;
  fresh: FreshNutritionEstimate | null;
  isLoading: boolean;
  canLoadFresh: boolean;
  onLoadFresh: () => void;
}

function NutritionCard({
  title,
  basis,
  values,
  tone,
}: {
  title: string;
  basis: string;
  values: NutritionValues;
  tone: 'before' | 'after';
}) {
  const palette = tone === 'before'
    ? 'border-amber-200 bg-amber-50/80 text-amber-950'
    : 'border-emerald-200 bg-emerald-50/80 text-emerald-950';

  return (
    <div className={`rounded-xl border p-4 ${palette}`}>
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-xs leading-5 opacity-80">{basis}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {NUTRIENT_FIELDS.map((field) => (
          <div key={field.key} className="rounded-lg bg-white px-3 py-2 text-gray-900 shadow-sm">
            <dt className="text-xs text-gray-500">{field.label}</dt>
            <dd className="font-semibold">
              {values[field.key] ?? '—'}{values[field.key] == null ? '' : ` ${field.unit}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function NutritionComparison({
  original,
  fresh,
  isLoading,
  canLoadFresh,
  onLoadFresh,
}: NutritionComparisonProps) {
  const originalReady = Boolean(
    original && !original.reviewRequired && hasNutritionValues(original.values)
  );

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-4" aria-labelledby="nutrition-comparison-title">
      <div className="flex items-start gap-3">
        <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id="nutrition-comparison-title" className="font-semibold text-blue-950">
            Nutrition
          </h3>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            Fresh-recipe values are estimates based on ingredients, portions, brand choices, preparation, and available nutrition data. Actual values can vary.
          </p>

          {!original && (
            <p className="mt-3 rounded-lg bg-white p-3 text-sm text-blue-900 shadow-sm">
              No original Nutrition Facts were provided. Add the package values in the input area to enable the before side; Recipe Reborn will not infer them from an ingredient list.
            </p>
          )}
          {original?.reviewRequired && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              The scanned label values must be reviewed and confirmed in the input area before they are shown as exact source values.
            </p>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {originalReady && original && (
                <NutritionCard
                title="Original product"
                basis={original.basisLabel}
                values={original.values}
                tone="before"
              />
            )}

            {fresh ? (
                <NutritionCard
                title="Fresh recipe"
                basis={fresh.basisLabel}
                values={fresh}
                tone="after"
              />
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
                <h4 className="font-semibold">Fresh recipe</h4>
                <p className="mt-2 text-sm leading-6">
                  Save this recipe to see its per-serving nutrition estimate.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLoadFresh}
                  disabled={!canLoadFresh || isLoading}
                  className="mt-3 min-h-11 border-emerald-700 text-emerald-800 hover:bg-emerald-100"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <HeartPulse className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Estimate fresh-recipe nutrition
                </Button>
                {!canLoadFresh && (
                  <p className="mt-2 text-xs">Save the recipe first so its estimate can be stored.</p>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-blue-900">
            Original package values are shown separately when provided. No percentage improvement is claimed when serving sizes differ.
          </p>
        </div>
      </div>
    </section>
  );
}
