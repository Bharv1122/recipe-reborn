// USDA FoodData Central client — real nutrient data for the hybrid nutrition
// route (Phase 3d). Free API key: https://fdc.nal.usda.gov/api-key-signup
// Without FDC_API_KEY set, falls back to DEMO_KEY (rate-limited to ~30
// requests/hour per IP — fine for local dev, get a real key for production).

const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const FDC_API_KEY = process.env.FDC_API_KEY || 'DEMO_KEY';

export interface NutrientsPer100g {
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  sodium: number; // mg
}

interface FdcFoodNutrient {
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface FdcSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: FdcFoodNutrient[];
}

// FDC "nutrient numbers" are stable across data types.
const NUTRIENT_NUMBERS: Record<string, keyof NutrientsPer100g> = {
  '208': 'calories', // Energy (kcal)
  '203': 'protein', // Protein
  '205': 'carbs', // Carbohydrate, by difference
  '204': 'fat', // Total lipid (fat)
  '291': 'fiber', // Fiber, total dietary
  '307': 'sodium', // Sodium (mg)
};

// Foundation foods sometimes report energy only via Atwater factors (957/958)
// or in kJ (268) — accept those when 208 is missing.
const ENERGY_FALLBACK_NUMBERS = ['957', '958'];
const ENERGY_KJ_NUMBER = '268';
const KJ_PER_KCAL = 4.184;

// Simple in-memory cache (per server process / lambda instance). Ingredient
// names repeat constantly across recipes, so even a per-instance cache cuts
// most USDA calls. `null` entries cache misses so we don't re-search them.
const cache = new Map<string, NutrientsPer100g | null>();
const CACHE_MAX_ENTRIES = 500;

function cacheSet(key: string, value: NutrientsPer100g | null) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function extractNutrients(
  foodNutrients: FdcFoodNutrient[] | undefined
): NutrientsPer100g | null {
  if (!foodNutrients?.length) return null;

  const result: NutrientsPer100g = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
  };
  let hasCalories = false;

  for (const n of foodNutrients) {
    const number = n.nutrientNumber ?? '';
    const value = n.value;
    if (typeof value !== 'number' || !isFinite(value)) continue;

    const key = NUTRIENT_NUMBERS[number];
    if (key) {
      if (key === 'calories') {
        result.calories = value;
        hasCalories = true;
      } else {
        result[key] = value;
      }
    } else if (!hasCalories && ENERGY_FALLBACK_NUMBERS.includes(number)) {
      result.calories = value;
      hasCalories = true;
    } else if (!hasCalories && number === ENERGY_KJ_NUMBER) {
      result.calories = value / KJ_PER_KCAL;
      hasCalories = true;
    }
  }

  // A food with no energy data is useless for our totals.
  if (!hasCalories || result.calories <= 0) return null;
  return result;
}

// FDC relevance search often ranks concentrated variants ("Carrots, dried",
// "Potato flour") above the plain raw food, which wildly inflates totals.
// Treat those as second-choice unless the query itself asked for them.
const PREPARED_VARIANT_WORDS = [
  'dried',
  'dehydrated',
  'powder',
  'powdered',
  'flour',
  'freeze-dried',
  'chips',
  'canned',
  'juice',
  'syrup',
  'cooked',
  'roasted',
  'baked',
  'fried',
  'smoked',
  'cured',
];

function isPreparedVariant(description: string, query: string): boolean {
  const desc = description.toLowerCase();
  return PREPARED_VARIANT_WORDS.some(
    (word) => desc.includes(word) && !query.includes(word)
  );
}

async function searchFoods(
  query: string,
  dataTypes?: string
): Promise<FdcSearchFood[]> {
  const params = new URLSearchParams({
    api_key: FDC_API_KEY,
    query,
    pageSize: '5',
  });
  if (dataTypes) params.set('dataType', dataTypes);

  const response = await fetch(`${FDC_BASE_URL}/foods/search?${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`FDC search failed: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data?.foods) ? data.foods : [];
}

/**
 * Look up per-100g nutrients for a generic ingredient name.
 * Returns null when USDA has no usable match (caller should fall back).
 * Never throws — network/API errors also resolve to null.
 */
export async function lookupNutrients(
  name: string
): Promise<NutrientsPer100g | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  try {
    // Foundation + SR Legacy are generic per-100g foods — best match for
    // recipe ingredients. Fall back to all data types (incl. Branded) only
    // when the generic datasets have nothing.
    let foods = await searchFoods(key, 'Foundation,SR Legacy');
    if (foods.length === 0) {
      foods = await searchFoods(key);
    }

    // Results come back relevance-sorted; take the first with usable data,
    // preferring plain foods over dried/powdered/etc. variants.
    let preparedFallback: NutrientsPer100g | null = null;
    for (const food of foods) {
      const nutrients = extractNutrients(food.foodNutrients);
      if (!nutrients) continue;
      if (!isPreparedVariant(food.description, key)) {
        cacheSet(key, nutrients);
        return nutrients;
      }
      if (!preparedFallback) preparedFallback = nutrients;
    }

    cacheSet(key, preparedFallback);
    return preparedFallback;
  } catch (error) {
    console.error(`USDA lookup failed for "${key}":`, error);
    // Don't cache transient failures — a later request may succeed.
    return null;
  }
}
