'use client';

import { AlertTriangle, ArrowRight, Leaf, PiggyBank, Clock, Users, Loader2 } from 'lucide-react';
import { InteractiveIngredient } from '@/app/generator/_components/interactive-ingredient';
import { NutritionComparison } from '@/app/generator/_components/nutrition-comparison';
import type { RecipeComparisonSnapshot } from '@/shared/recipe-comparison';

export interface RecipePresentationData {
  title: string;
  freshIngredients: string[];
  instructions: string[];
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  estimatedCostPerServing?: number | null;
  storeBoughtCost?: number | null;
}

interface Props {
  recipe: RecipePresentationData;
  dietaryTags: string[];
  comparison: RecipeComparisonSnapshot | null;
  isLoadingNutrition?: boolean;
  onDeleteIngredient?: (index: number) => void;
  onSubstituteIngredient?: (index: number, original: string, substitute: string) => void;
  isRegeneratingWithSubstitute?: boolean;
  substituteName?: string;
}

// The generated result and saved recipe deliberately share this entire body.
export function RecipePresentation({ recipe, dietaryTags, comparison,
  isLoadingNutrition = false, onDeleteIngredient, onSubstituteIngredient,
  isRegeneratingWithSubstitute = false, substituteName }: Props) {
  const detectedAdditives = comparison?.detectedAdditives ?? [];
  return <div className="space-y-6" data-recipe-presentation>
    {/* Truthful transformation reveal: detected source items vs generated output. */}
    {comparison?.source === 'label' && (
      <div className="rounded-xl border border-emerald-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 via-white to-emerald-50 px-4 py-3 border-b border-emerald-100">
          <p className="text-center text-sm font-semibold text-gray-700">
            Processed label → generated fresh recipe
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch">
          {/* BEFORE */}
          <div className="p-4 bg-red-50/60">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Detected on the label
              </span>
            </div>
            <p className="text-2xl font-bold text-red-600 mb-2">
              {detectedAdditives.length > 0
                ? `${detectedAdditives.length} flagged item${detectedAdditives.length === 1 ? '' : 's'}`
                : 'No common additives matched'}
            </p>
            {detectedAdditives.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {detectedAdditives.slice(0, 6).map((a) => (
                <span
                  key={a}

                  className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium"
                >
                  {a}
                </span>
              ))}
              {detectedAdditives.length > 6 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  +{detectedAdditives.length - 6} more
                </span>
              )}
            </div>
            ) : (
              <p className="text-sm text-red-700">The label is still shown next to its fresh-ingredient replacement.</p>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center py-2 sm:px-2 bg-white">
            <div className="bg-emerald-100 rounded-full p-2">
              <ArrowRight className="h-5 w-5 text-emerald-700 rotate-90 sm:rotate-0" aria-hidden="true" />
            </div>
          </div>

          {/* AFTER */}
          <div className="p-4 bg-emerald-50/60">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Generated fresh ingredients
              </span>
            </div>
            <ul className="space-y-1 text-sm text-gray-700">
              {recipe.freshIngredients.slice(0, 5).map((ingredient, index) => (
                <li key={`${ingredient}-${index}`} className="break-words">• {ingredient}</li>
              ))}
            </ul>
            {recipe.freshIngredients.length > 5 && (
              <p className="mt-2 text-xs font-medium text-emerald-800">
                +{recipe.freshIngredients.length - 5} more in the recipe
              </p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Cost Savings Banner */}
    {typeof recipe?.estimatedCostPerServing === 'number' &&
      typeof recipe?.storeBoughtCost === 'number' &&
      recipe.storeBoughtCost > recipe.estimatedCostPerServing && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-orange-50 border border-emerald-200 rounded-lg">
          <PiggyBank className="h-8 w-8 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-700">
              Estimated cost difference: ~${(recipe.storeBoughtCost - recipe.estimatedCostPerServing).toFixed(2)} per serving
            </p>
            <p className="text-sm text-gray-600">
              AI estimate only: homemade ~${recipe.estimatedCostPerServing.toFixed(2)}/serving vs. store-bought ~$
              {recipe.storeBoughtCost.toFixed(2)}/serving. Actual prices vary.
            </p>
          </div>
        </div>
      )}

    <NutritionComparison
      original={comparison?.originalNutrition ?? null}
      fresh={comparison?.freshNutrition ?? null}
      isLoading={isLoadingNutrition}
    />

    {/* Recipe Meta Info */}
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>Prep: {recipe?.prepTime || '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>Cook: {recipe?.cookTime || '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>Servings: {recipe?.servings || '—'}</span>
      </div>
    </div>

    {/* Dietary Tags */}
    {dietaryTags?.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {dietaryTags?.map?.((tag) => (
          <span
            key={tag}
            className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    )}

    {/* Ingredients */}
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-lg font-semibold text-gray-900">Fresh Ingredients</h3>
        {isRegeneratingWithSubstitute && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Regenerating with {substituteName}...</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Tap any ingredient for info, substitutes, shopping list, or to remove it
      </p>
      <ul className="space-y-1">
        {recipe?.freshIngredients?.map?.((ingredient, index) => (
          <li key={index}>
            <InteractiveIngredient
              ingredient={ingredient}
              index={index}
              onDelete={onDeleteIngredient}
              onSubstitute={onSubstituteIngredient}
              showDelete={Boolean(onDeleteIngredient)}
              isRegenerating={isRegeneratingWithSubstitute}
            />
          </li>
        ))}
      </ul>
    </div>

    {/* Instructions */}
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h3>
      <ol className="space-y-3">
        {recipe?.instructions?.map?.((instruction, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
              {index + 1}
            </span>
            <span className="text-gray-700 pt-0.5">{instruction}</span>
          </li>
        ))}
      </ol>
    </div>

  </div>;
}
