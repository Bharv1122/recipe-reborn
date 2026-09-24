import type { FreshNutritionEstimate, OriginalNutrition } from './nutrition-facts';

export interface RecipeComparisonSnapshot {
  version: 1;
  source: 'label' | 'pantry' | 'dish' | 'random';
  originalNutrition: OriginalNutrition | null;
  freshNutrition: FreshNutritionEstimate | null;
  detectedAdditives?: string[];
  originalProductName?: string | null;
}
