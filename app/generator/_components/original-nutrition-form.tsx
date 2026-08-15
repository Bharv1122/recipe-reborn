'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EMPTY_NUTRITION_VALUES,
  NUTRIENT_FIELDS,
  type NutritionValues,
  type OriginalNutrition,
  nullableNutritionNumber,
} from '@/lib/nutrition-facts';
import { CheckCircle2, HeartPulse, Pencil, Trash2 } from 'lucide-react';

interface OriginalNutritionFormProps {
  value: OriginalNutrition | null;
  onChange: (value: OriginalNutrition | null) => void;
  disabled?: boolean;
}

const SOURCE_NAMES: Record<OriginalNutrition['source'], string> = {
  label_scan: 'Scanned from Nutrition Facts label',
  barcode: 'OpenFoodFacts barcode record',
  typed: 'Typed from package label',
};

export function OriginalNutritionForm({ value, onChange, disabled }: OriginalNutritionFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  const startTypedEntry = () => {
    onChange({
      values: { ...EMPTY_NUTRITION_VALUES },
      basisLabel: 'Per labeled serving',
      servingsPerContainer: null,
      source: 'typed',
      sourceLabel: SOURCE_NAMES.typed,
      accuracy: 'exact',
      reviewRequired: false,
    });
    setIsEditing(true);
  };

  const updateValue = (patch: Partial<OriginalNutrition>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  const updateNutrient = (key: keyof NutritionValues, next: string) => {
    if (!value) return;
    updateValue({
      values: {
        ...value.values,
        [key]: nullableNutritionNumber(next),
      },
    });
  };

  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-3">
        <p className="text-sm font-medium text-blue-950">Have the original Nutrition Facts?</p>
        <p className="mt-1 text-xs leading-5 text-blue-900">
          Add only the numbers printed on the package. Unknown values stay blank—Recipe Reborn will not guess them.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={startTypedEntry}
          disabled={disabled}
          className="mt-3 min-h-11 border-blue-700 text-blue-800 hover:bg-blue-100"
        >
          <HeartPulse className="mr-2 h-4 w-4" aria-hidden="true" />
          Enter Nutrition Facts
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-blue-950">Original product nutrition loaded</p>
          <p className="mt-1 text-xs text-blue-900">
            Exact source values • {value.sourceLabel || SOURCE_NAMES[value.source]}
          </p>
          <p className="mt-1 text-xs text-blue-900">
            Basis: {value.basisLabel || 'Not provided'}
            {value.servingsPerContainer != null ? ` • ${value.servingsPerContainer} servings per container` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing((current) => !current)}
            disabled={disabled}
            className="border-blue-600 text-blue-800"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {isEditing ? 'Done' : 'Review'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="border-gray-300 text-gray-700"
            aria-label="Clear original nutrition"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {value.reviewRequired && !isEditing && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          These numbers were read by AI. Review them against the package before using the comparison.
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 min-h-10 border-amber-700 text-amber-900 hover:bg-amber-100"
            onClick={() => updateValue({ reviewRequired: false })}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            I checked the label
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-800">
              Serving basis
              <Input
                className="mt-1 bg-white"
                value={value.basisLabel}
                onChange={(event) => updateValue({ basisLabel: event.target.value })}
                placeholder="e.g. Per 1 tray (283 g)"
                disabled={disabled}
              />
            </label>
            <label className="text-sm font-medium text-gray-800">
              Servings per container (optional)
              <Input
                className="mt-1 bg-white"
                type="number"
                min="0"
                step="any"
                value={value.servingsPerContainer ?? ''}
                onChange={(event) => updateValue({ servingsPerContainer: nullableNutritionNumber(event.target.value) })}
                disabled={disabled}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUTRIENT_FIELDS.map((field) => (
              <label key={field.key} className="text-sm font-medium text-gray-800">
                {field.label} ({field.unit})
                <Input
                  className="mt-1 bg-white"
                  type="number"
                  min="0"
                  step="any"
                  value={value.values[field.key] ?? ''}
                  onChange={(event) => updateNutrient(field.key, event.target.value)}
                  placeholder="—"
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
          <p className="text-xs leading-5 text-blue-900">
            Copy the package values exactly in the units shown. Leave anything you cannot verify blank.
          </p>
        </div>
      )}
    </div>
  );
}
