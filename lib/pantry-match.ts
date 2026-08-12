const UNITS = new Set([
  'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
  'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg', 'milliliter', 'milliliters', 'ml', 'liter', 'liters',
  'l', 'pinch', 'dash', 'clove', 'cloves', 'can', 'cans', 'package', 'packages',
  'slice', 'slices', 'piece', 'pieces', 'bunch', 'bunches',
]);

const PREPARATION_WORDS = new Set([
  'a', 'an', 'and', 'of', 'to', 'taste', 'optional', 'divided', 'fresh', 'dried',
  'chopped', 'minced', 'diced', 'sliced', 'peeled', 'grated', 'shredded', 'melted',
  'softened', 'large', 'medium', 'small', 'whole', 'sharp', 'unsalted', 'salted',
  'extra', 'virgin', 'approximately', 'about',
]);

const CATEGORY_MAP: Array<[string, string]> = [
  ['tomato', 'Produce'], ['onion', 'Produce'], ['garlic', 'Produce'], ['potato', 'Produce'],
  ['carrot', 'Produce'], ['lettuce', 'Produce'], ['spinach', 'Produce'], ['apple', 'Produce'],
  ['banana', 'Produce'], ['lemon', 'Produce'], ['lime', 'Produce'], ['pepper', 'Produce'],
  ['broccoli', 'Produce'], ['mushroom', 'Produce'], ['avocado', 'Produce'], ['parsley', 'Produce'],
  ['milk', 'Dairy'], ['cheese', 'Dairy'], ['butter', 'Dairy'], ['cream', 'Dairy'],
  ['yogurt', 'Dairy'], ['egg', 'Dairy'],
  ['chicken', 'Meat & Seafood'], ['beef', 'Meat & Seafood'], ['pork', 'Meat & Seafood'],
  ['fish', 'Meat & Seafood'], ['salmon', 'Meat & Seafood'], ['shrimp', 'Meat & Seafood'],
  ['turkey', 'Meat & Seafood'],
  ['flour', 'Pantry'], ['sugar', 'Pantry'], ['salt', 'Pantry'], ['oil', 'Pantry'],
  ['rice', 'Pantry'], ['pasta', 'Pantry'], ['bread', 'Pantry'], ['sauce', 'Pantry'],
  ['spice', 'Pantry'], ['herb', 'Pantry'], ['vinegar', 'Pantry'],
];

const QUANTITY_PREFIX = /^[\s\d\u00bc-\u00be\u2150-\u215e./-]+/;

function singularize(word: string) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ses') && word.length > 4 && !word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1);
  }
  return word;
}

export function normalizeIngredientName(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(QUANTITY_PREFIX, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((token) => !UNITS.has(token) && !PREPARATION_WORDS.has(token))
    .map(singularize);

  return tokens.join(' ');
}

export function splitPantryInput(value: string) {
  return value
    .replace(/\b(?:i|we)\s+(?:already\s+)?have\b/gi, '')
    .replace(/\bthere\s+(?:is|are)\b/gi, '')
    .split(/[\n,;]+/)
    .map((item) => item.replace(/^\s*(?:and\s+)?/i, '').trim())
    .filter(Boolean)
    .slice(0, 100);
}

export interface ParsedIngredient {
  ingredient: string;
  quantity?: string;
  unit?: string;
}

export function parseIngredientLine(ingredientLine: string): ParsedIngredient {
  const trimmed = ingredientLine.trim();
  const match = trimmed.match(/^([\d\u00bc-\u00be\u2150-\u215e/\-.\s]+)?\s*([a-zA-Z]+)?\s*(.+)$/);

  if (!match) return { ingredient: trimmed };

  const possibleUnit = match[2]?.trim().toLowerCase();
  const hasUnit = Boolean(possibleUnit && UNITS.has(possibleUnit));
  const ingredient = hasUnit
    ? match[3]?.trim() || trimmed
    : [match[2], match[3]].filter(Boolean).join(' ').trim() || trimmed;

  return {
    ingredient: ingredient.replace(/^(?:of\s+)?/i, ''),
    quantity: match[1]?.trim() || undefined,
    unit: hasUnit ? match[2]?.trim() : undefined,
  };
}

export function categorizeIngredient(ingredient: string) {
  const normalized = normalizeIngredientName(ingredient);
  if (/\b(?:powder|paprika|cayenne|black pepper|salt|spice|seasoning)\b/.test(normalized)) {
    return 'Pantry';
  }
  for (const [key, category] of CATEGORY_MAP) {
    if (normalized.includes(key)) return category;
  }
  return 'Other';
}

export interface PantryMatch {
  ingredient: string;
  pantryMatches: string[];
}

export interface PantryComparison {
  pantryItems: string[];
  matched: PantryMatch[];
  missing: string[];
}

export function comparePantryToRecipe(
  recipeIngredients: string[],
  pantryInput: string | string[],
): PantryComparison {
  const pantryItems = Array.isArray(pantryInput)
    ? pantryInput.map((item) => item.trim()).filter(Boolean).slice(0, 100)
    : splitPantryInput(pantryInput);
  const normalizedPantry = pantryItems.map((item) => ({
    original: item,
    normalized: normalizeIngredientName(item),
  })).filter((item) => item.normalized);
  const pantryTokens = new Set(normalizedPantry.flatMap((item) => item.normalized.split(' ')));

  const matched: PantryMatch[] = [];
  const missing: string[] = [];

  for (const ingredient of recipeIngredients.map(String).filter((item) => item.trim())) {
    const required = normalizeIngredientName(ingredient);
    const directMatches = normalizedPantry.filter(({ normalized }) =>
      required === normalized || required.includes(normalized) || normalized.includes(required),
    );
    const requiredTokens = required.split(' ').filter(Boolean);
    const coveredByPantry = requiredTokens.length > 0 && requiredTokens.every((token) => pantryTokens.has(token));

    if (directMatches.length > 0 || coveredByPantry) {
      matched.push({
        ingredient,
        pantryMatches: directMatches.length > 0
          ? directMatches.map((item) => item.original)
          : pantryItems.filter((item) => normalizeIngredientName(item).split(' ').some((token) => requiredTokens.includes(token))),
      });
    } else {
      missing.push(ingredient);
    }
  }

  return { pantryItems, matched, missing };
}

export function parseStoredIngredients(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter((item) => item.trim());
  } catch {
    // Older recipes may store newline-separated ingredients.
  }
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}
