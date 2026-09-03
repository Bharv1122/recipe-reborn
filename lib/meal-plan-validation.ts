import { z } from 'zod';

export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export type DayName = (typeof DAYS)[number];
export type MealType = (typeof MEAL_TYPES)[number];

export interface ValidatedMeal {
  title: string;
  ingredients: string[];
  instructions: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  dietaryTags: string[];
  estimatedCalories: number | null;
}

export interface ValidatedDayPlan {
  day: DayName;
  meals: Record<MealType, ValidatedMeal | undefined>;
}

export type MealPlanValidationCode =
  | 'invalid_shape'
  | 'wrong_day_count'
  | 'missing_day'
  | 'duplicate_day'
  | 'missing_meal'
  | 'unexpected_meal'
  | 'invalid_meal'
  | 'serving_mismatch'
  | 'allergen_detected'
  | 'prepared_shortcut'
  | 'duplicate_meal';

export interface MealPlanValidationError {
  code: MealPlanValidationCode;
  message: string;
  day?: DayName;
  mealType?: MealType;
}

export type MealPlanValidationResult =
  | { success: true; plan: ValidatedDayPlan[] }
  | { success: false; errors: MealPlanValidationError[] };

const mealSchema = z.object({
  title: z.string().trim().min(1).max(160),
  ingredients: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
  instructions: z.union([
    z.string().trim().min(1).max(8000),
    z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
  ]),
  prepTime: z.string().trim().max(50).optional().default(''),
  cookTime: z.string().trim().max(50).optional().default(''),
  servings: z.union([z.number(), z.string()]),
  dietaryTags: z.array(z.string().trim().min(1).max(50)).max(12).optional().default([]),
  estimatedCalories: z.union([z.number(), z.string(), z.null()]).optional().default(null),
}).passthrough();

const ALLERGEN_EXPANSIONS: Record<string, string[]> = {
  fish: [
    'fish', 'seafood', 'anchovy', 'anchovies', 'bass', 'bonito', 'carp', 'catfish',
    'caviar', 'cod', 'dashi', 'flounder', 'grouper', 'haddock', 'halibut', 'herring',
    'mackerel', 'mahi mahi', 'perch', 'pollock', 'salmon', 'sardine', 'sardines',
    'snapper', 'sole', 'swordfish', 'tilapia', 'trout', 'tuna', 'fish sauce',
    'worcestershire', 'surimi', 'roe',
  ],
  shellfish: [
    'shellfish', 'crab', 'crayfish', 'crawfish', 'lobster', 'prawn', 'prawns',
    'shrimp', 'scallop', 'scallops', 'clam', 'clams', 'mussel', 'mussels',
    'oyster', 'oysters',
  ],
  peanut: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  'tree nut': [
    'tree nut', 'tree nuts', 'almond', 'almonds', 'brazil nut', 'cashew', 'cashews',
    'hazelnut', 'hazelnuts', 'macadamia', 'pecan', 'pecans', 'pistachio',
    'pistachios', 'walnut', 'walnuts', 'marzipan', 'praline',
  ],
  dairy: ['dairy', 'milk', 'butter', 'buttermilk', 'casein', 'cheese', 'cream', 'ghee', 'whey', 'yogurt', 'yoghurt'],
  milk: ['milk', 'butter', 'buttermilk', 'casein', 'cheese', 'cream', 'ghee', 'whey', 'yogurt', 'yoghurt'],
  egg: ['egg', 'eggs', 'albumin', 'mayonnaise', 'meringue'],
  wheat: ['wheat', 'flour', 'bread', 'breadcrumbs', 'couscous', 'farina', 'semolina', 'spelt'],
  gluten: ['gluten', 'wheat', 'barley', 'rye', 'malt', 'farro', 'spelt', 'semolina'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
  sesame: ['sesame', 'tahini', 'benne'],
};

// These patterns intentionally target prepared dishes and meal components, not
// ordinary grocery staples such as bread, tortillas, canned beans or tomatoes,
// condiments, broth, or plain frozen fruit and vegetables.
const PREPARED_SHORTCUT_PATTERNS = [
  /\brotisserie\s+(?:chicken|turkey)\b/i,
  /\b(?:ready[- ]made|ready[- ]to[- ]eat|pre[- ]?cooked|fully cooked|heat[- ]and[- ]serve|commercially[- ]prepared)\s+(?:chicken|turkey|beef|pork|meatballs?|entrees?|meals?|sides?(?: dishes?)?|mashed potatoes?|rice|pasta|pizza|lasagna|casserole|gravy|sauce|dough|crust)\b/i,
  /\bfrozen\s+(?:mashed potatoes?|dinners?|meals?|entrees?|meatballs?|pizza|lasagna|casseroles?|mac(?:aroni)?\s+(?:and|&)\s+cheese)\b/i,
  /\b(?:jarred|prepared|ready[- ]made|store[- ]bought)\s+(?:gravy|(?:pasta|marinara|alfredo|cheese|cream|tomato)\s+sauce|pizza dough|pie crust|cookie dough)\b/i,
  /\b(?:jar|jars)\s+(?:of\s+)?(?:prepared\s+)?(?:gravy|(?:pasta|marinara|alfredo|cheese|cream|tomato)\s+sauce)\b/i,
  /\b(?:boxed|packaged)\s+(?:cake|brownie|pancake|waffle|biscuit|cookie|muffin|cornbread|stuffing)\s+mix\b/i,
  /\b(?:prepared|store[- ]bought|ready[- ]made|commercially[- ]prepared)\s+(?:meals?|entrees?|side dishes?|mashed potatoes?|meatballs?|lasagna|casserole)\b/i,
];

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesWholeTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return ` ${haystack} `.includes(` ${normalizedTerm} `);
}

function termsForAllergy(allergy: string): string[] {
  const normalized = normalizeText(allergy);
  const terms = new Set<string>([normalized]);

  for (const [category, expansions] of Object.entries(ALLERGEN_EXPANSIONS)) {
    if (normalized === category || normalized.includes(category) || category.includes(normalized)) {
      expansions.forEach((term) => terms.add(term));
    }
  }

  return Array.from(terms).filter(Boolean);
}

function detectAllergen(meal: ValidatedMeal, allergies: string[]): string | null {
  if (allergies.length === 0) return null;

  const searchable = normalizeText([
    meal.title,
    ...meal.ingredients,
    meal.instructions,
  ].join(' '));

  for (const allergy of allergies) {
    const matched = termsForAllergy(allergy).find((term) => includesWholeTerm(searchable, term));
    if (matched) return matched;
  }

  return null;
}

function containsPreparedShortcut(meal: ValidatedMeal): boolean {
  const searchable = [meal.title, ...meal.ingredients, meal.instructions].join(' ');
  const normalized = normalizeText(searchable);
  return PREPARED_SHORTCUT_PATTERNS.some((pattern) =>
    pattern.test(searchable) || pattern.test(normalized)
  );
}

const NON_DISTINCT_TITLE_WORDS = new Set([
  ...DAYS,
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'recipe',
  'and',
  'with',
  'the',
]);

function distinctiveTitleTokens(title: string): string[] {
  return normalizeText(title)
    .split(' ')
    .filter((token) => token.length > 1 && !NON_DISTINCT_TITLE_WORDS.has(token as DayName));
}

function titlesDescribeSameMeal(first: string, second: string): boolean {
  const firstTokens = new Set(distinctiveTitleTokens(first));
  const secondTokens = new Set(distinctiveTitleTokens(second));
  if (firstTokens.size === 0 || secondTokens.size === 0) return false;

  const firstKey = Array.from(firstTokens).sort().join(' ');
  const secondKey = Array.from(secondTokens).sort().join(' ');
  if (firstKey === secondKey) return true;

  // Catch minor wording changes such as "lemon herb roasted chicken" versus
  // "roasted lemon herb chicken" without collapsing broadly similar dishes.
  if (Math.min(firstTokens.size, secondTokens.size) < 3) return false;
  const shared = Array.from(firstTokens).filter((token) => secondTokens.has(token)).length;
  return shared / Math.max(firstTokens.size, secondTokens.size) >= 0.8;
}

export function normalizeMealTypes(
  requestedMealTypes: unknown,
  legacyMealsPerDay: unknown,
): MealType[] {
  if (Array.isArray(requestedMealTypes)) {
    const requested = new Set(
      requestedMealTypes.filter((value): value is MealType =>
        typeof value === 'string' && MEAL_TYPES.includes(value as MealType)
      ),
    );
    const ordered = MEAL_TYPES.filter((mealType) => requested.has(mealType));
    if (ordered.length > 0) return ordered;
  }

  const count = Number.isInteger(Number(legacyMealsPerDay))
    ? Math.min(4, Math.max(1, Number(legacyMealsPerDay)))
    : 3;

  const defaults: Record<number, MealType[]> = {
    1: ['dinner'],
    2: ['breakfast', 'dinner'],
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'dinner', 'snack'],
  };

  return defaults[count];
}

export function parseMealPlanContent(content: string): unknown {
  let jsonText = content.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  jsonText = fenceMatch ? fenceMatch[1] : jsonText.replace(/^```(?:json)?\s*/, '');
  const start = jsonText.indexOf('[');
  const end = jsonText.lastIndexOf(']');
  if (start !== -1 && end > start) jsonText = jsonText.slice(start, end + 1);
  return JSON.parse(jsonText.trim());
}

export function validateMealPlan(
  value: unknown,
  options: { mealTypes: MealType[]; servings: number; allergies: string[] },
): MealPlanValidationResult {
  if (!Array.isArray(value)) {
    return {
      success: false,
      errors: [{ code: 'invalid_shape', message: 'The response must be a JSON array.' }],
    };
  }

  const errors: MealPlanValidationError[] = [];
  if (value.length !== DAYS.length) {
    errors.push({
      code: 'wrong_day_count',
      message: `Expected exactly ${DAYS.length} days but received ${value.length}.`,
    });
  }

  const seenDays = new Set<string>();
  const validatedByDay = new Map<DayName, ValidatedDayPlan>();
  const acceptedMealsByType = new Map<MealType, Array<{ day: DayName; title: string }>>();

  for (const rawDay of value) {
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) {
      errors.push({ code: 'invalid_shape', message: 'Every day must be an object.' });
      continue;
    }

    const dayRecord = rawDay as Record<string, unknown>;
    const day = typeof dayRecord.day === 'string'
      ? normalizeText(dayRecord.day) as DayName
      : '' as DayName;

    if (!DAYS.includes(day)) {
      errors.push({ code: 'missing_day', message: 'A day has an invalid or missing name.' });
      continue;
    }
    if (seenDays.has(day)) {
      errors.push({ code: 'duplicate_day', message: `${day} appears more than once.` });
      continue;
    }
    seenDays.add(day);

    const meals: Record<MealType, ValidatedMeal | undefined> = {
      breakfast: undefined,
      lunch: undefined,
      dinner: undefined,
      snack: undefined,
    };

    for (const mealType of MEAL_TYPES) {
      const rawMeal = dayRecord[mealType];
      const expected = options.mealTypes.includes(mealType);

      if (!expected && rawMeal != null) {
        errors.push({
          code: 'unexpected_meal',
          message: `${day} contains unrequested meal type ${mealType}.`,
          day,
          mealType,
        });
        continue;
      }
      if (expected && rawMeal == null) {
        errors.push({
          code: 'missing_meal',
          message: `${day} is missing requested meal type ${mealType}.`,
          day,
          mealType,
        });
        continue;
      }
      if (!expected) continue;

      const parsed = mealSchema.safeParse(rawMeal);
      if (!parsed.success) {
        errors.push({
          code: 'invalid_meal',
          message: `${day} ${mealType} is incomplete or malformed.`,
          day,
          mealType,
        });
        continue;
      }

      const servingCount = Number(parsed.data.servings);
      if (!Number.isFinite(servingCount) || servingCount !== options.servings) {
        errors.push({
          code: 'serving_mismatch',
          message: `${day} ${mealType} has ${String(parsed.data.servings)} servings instead of ${options.servings}.`,
          day,
          mealType,
        });
        continue;
      }

      const calories = parsed.data.estimatedCalories == null
        ? null
        : Number(parsed.data.estimatedCalories);
      const meal: ValidatedMeal = {
        title: parsed.data.title,
        ingredients: parsed.data.ingredients,
        instructions: Array.isArray(parsed.data.instructions)
          ? parsed.data.instructions.join('\n')
          : parsed.data.instructions,
        prepTime: parsed.data.prepTime,
        cookTime: parsed.data.cookTime,
        servings: servingCount,
        dietaryTags: parsed.data.dietaryTags,
        estimatedCalories: Number.isFinite(calories) && calories! > 0
          ? Math.round(calories!)
          : null,
      };

      const allergenMatch = detectAllergen(meal, options.allergies);
      if (allergenMatch) {
        errors.push({
          code: 'allergen_detected',
          message: `${day} ${mealType} contains a blocked allergen term.`,
          day,
          mealType,
        });
        continue;
      }

      if (containsPreparedShortcut(meal)) {
        errors.push({
          code: 'prepared_shortcut',
          message: `${day} ${mealType} uses a commercially prepared meal shortcut instead of basic grocery ingredients.`,
          day,
          mealType,
        });
        continue;
      }

      const priorMeal = (acceptedMealsByType.get(mealType) ?? []).find((candidate) =>
        titlesDescribeSameMeal(candidate.title, meal.title)
      );
      if (priorMeal) {
        errors.push({
          code: 'duplicate_meal',
          message: `${day} ${mealType} repeats or closely duplicates ${priorMeal.day} ${mealType} (${priorMeal.title}).`,
          day,
          mealType,
        });
        continue;
      }

      const acceptedMeals = acceptedMealsByType.get(mealType) ?? [];
      acceptedMeals.push({ day, title: meal.title });
      acceptedMealsByType.set(mealType, acceptedMeals);

      meals[mealType] = meal;
    }

    validatedByDay.set(day, { day, meals });
  }

  for (const day of DAYS) {
    if (!seenDays.has(day)) {
      errors.push({ code: 'missing_day', message: `${day} is missing from the plan.` });
    }
  }

  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    plan: DAYS.map((day) => validatedByDay.get(day)!),
  };
}
