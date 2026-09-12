import type { OriginalNutrition } from '../../../shared/nutrition-facts';

export type ScanRecipeHandoff = {
  source: 'label' | 'pantry';
  origin: 'barcode' | 'label-photo' | 'pantry-photo';
  ingredients: string;
  context: string;
  originalNutrition?: OriginalNutrition | null;
};

let pendingHandoff: ScanRecipeHandoff | null = null;

export function stageScanRecipeHandoff(handoff: ScanRecipeHandoff) {
  const ingredients = handoff.ingredients.trim();
  if (!ingredients) throw new Error('A scanned ingredient list is required.');
  pendingHandoff = {
    ...handoff,
    ingredients,
    context: handoff.context.trim(),
  };
}

export function takeScanRecipeHandoff() {
  const handoff = pendingHandoff;
  pendingHandoff = null;
  return handoff;
}
