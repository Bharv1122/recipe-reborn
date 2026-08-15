export interface NutritionValues {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sodium: number | null;
}

export type OriginalNutritionSource = 'label_scan' | 'barcode' | 'typed';

export interface OriginalNutrition {
  values: NutritionValues;
  basisLabel: string;
  servingsPerContainer: number | null;
  source: OriginalNutritionSource;
  sourceLabel: string;
  accuracy: 'exact';
  reviewRequired?: boolean;
}

export const EMPTY_NUTRITION_VALUES: NutritionValues = {
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  sodium: null,
};

export const NUTRIENT_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
] as const;

export function nullableNutritionNumber(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function hasNutritionValues(values: NutritionValues | null | undefined): boolean {
  return Boolean(values && Object.values(values).some((value) => value != null));
}

export function originalNutritionFromOpenFoodFactsProduct(
  product: Record<string, unknown>
): OriginalNutrition | null {
  const nutriments = (product.nutriments && typeof product.nutriments === 'object')
    ? product.nutriments as Record<string, unknown>
    : {};
  const servingSize = String(product.serving_size ?? '').trim();
  const productName = String(product.product_name ?? '').trim();
  const numeric = (key: string, multiplier = 1) => {
    const value = Number(nutriments[key]);
    return Number.isFinite(value) && value >= 0
      ? Math.round(value * multiplier * 10) / 10
      : null;
  };
  const valuesFor = (suffix: 'serving' | '100g'): NutritionValues => ({
    calories: numeric(`energy-kcal_${suffix}`),
    protein: numeric(`proteins_${suffix}`),
    carbs: numeric(`carbohydrates_${suffix}`),
    fat: numeric(`fat_${suffix}`),
    fiber: numeric(`fiber_${suffix}`),
    // OpenFoodFacts stores sodium in grams; Recipe Reborn displays milligrams.
    sodium: numeric(`sodium_${suffix}`, 1000),
  });

  const perServingValues = valuesFor('serving');
  const per100gValues = valuesFor('100g');
  const useServing = Boolean(servingSize && hasNutritionValues(perServingValues));
  const values = useServing ? perServingValues : per100gValues;
  if (!hasNutritionValues(values)) return null;

  return {
    values,
    basisLabel: useServing ? `Per ${servingSize}` : 'Per 100 g',
    servingsPerContainer: null,
    source: 'barcode',
    sourceLabel: productName
      ? `${productName} • OpenFoodFacts product record`
      : 'OpenFoodFacts product record',
    accuracy: 'exact',
    reviewRequired: false,
  };
}

export function originalNutritionFromLabelScan(scanned: unknown): OriginalNutrition | null {
  if (!scanned || typeof scanned !== 'object') return null;
  const facts = scanned as Record<string, unknown>;
  const values: NutritionValues = {
    calories: nullableNutritionNumber(facts.calories),
    protein: nullableNutritionNumber(facts.protein),
    carbs: nullableNutritionNumber(facts.carbs),
    fat: nullableNutritionNumber(facts.fat),
    fiber: nullableNutritionNumber(facts.fiber),
    sodium: nullableNutritionNumber(facts.sodium),
  };
  if (!hasNutritionValues(values)) return null;

  return {
    values,
    basisLabel:
      typeof facts.basisLabel === 'string' && facts.basisLabel.trim()
        ? facts.basisLabel.trim()
        : 'Per labeled serving (serving size unreadable)',
    servingsPerContainer: nullableNutritionNumber(facts.servingsPerContainer),
    source: 'label_scan',
    sourceLabel: 'Nutrition Facts label scan',
    accuracy: 'exact',
    reviewRequired: true,
  };
}
