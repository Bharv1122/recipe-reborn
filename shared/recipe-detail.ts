import { detectAdditives } from './additives';

export type DetailRecipe = { title: string; freshIngredients: string[]; instructions: string[]; prepTime: string; cookTime: string; servings: string; dietaryTags?: string[] };

// Match the current ingredient lines, never the title or original package.
// Ambiguous foods are explicitly marked possible; absence is not an all-clear.
const allergens: { name: string; explicit: RegExp; possible?: RegExp; alternatives?: RegExp }[] = [
  { name: 'Wheat', explicit: /\b(wheat|semolina|durum|spelt|farina|couscous|bulgur|seitan)\b/i, possible: /\b(pasta|flour|bread|breadcrumbs|noodles|soy sauce|spaghetti|penne|macaroni|lasagn[ae]|orzo|linguine|fettuccine|panko|tortillas?|pita|crackers?|croutons?|soba)\b/i, alternatives: /\b(?:gluten|wheat)[- ]free\s+(?:rice\s+)?(?:pasta|flour|bread|breadcrumbs|noodles|soy sauce|spaghetti|penne|macaroni)\b|\b(?:rice|chickpea|almond|coconut|corn|lentil)\s+(?:flour|noodles|pasta)\b/gi },
  { name: 'Milk', explicit: /\b(milk|cream|butter|cheese|yogh?urt|whey|casein(?:ate)?|ghee|parmesan|mozzarella|cheddar|buttermilk|ricotta|feta|paneer|mascarpone|kefir|creme fraiche|half[- ]and[- ]half|gouda|gruyere|brie)\b/i, possible: /\bcreamer\b/i, alternatives: /\b(?:coconut|almond|oat|soy|soya|cashew|rice|peanut|cocoa|shea|sunflower)\s+(?:milk|cream|butter|yogh?urt|cheese)\b|\b(?:dairy[- ]free|vegan|plant[- ]based)\s+(?:(?:cooking|heavy|whipping|double|single|sour)\s+)?(?:milk|cream|butter|yogh?urt|cheese|creamer)\b|\b(?:dairy[- ]free|vegan|plant[- ]based)\s+(?:parmesan|mozzarella|cheddar|ricotta|feta|paneer|mascarpone|gouda|gruyere|brie)(?:[- ]style)?(?:\s+cheese)?\b|\bcream of tartar\b/gi },
  { name: 'Egg', explicit: /\b(eggs?|albumin|meringue|mayonnaise)\b/i, alternatives: /\b(?:egg[- ]free|vegan)\s+(?:mayonnaise|eggs?)\b|\b(?:flax|chia)\s+eggs?\b|\begg\s+(?:replacer|substitute)\b/gi },
  { name: 'Soy', explicit: /\b(soy|soya|soybeans?|tofu|tempeh|edamame|miso|tamari)\b/i },
  { name: 'Peanut', explicit: /\b(peanuts?|groundnuts?)\b/i },
  { name: 'Tree nuts', explicit: /\b(almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|macadamias?|brazil nuts?|pine nuts?|chestnuts?|marzipan|praline)\b/i },
  { name: 'Sesame', explicit: /\b(sesame|tahini|benne)\b/i },
  { name: 'Fish', explicit: /\b(fish|salmon|tuna|cod|anchov(?:y|ies)|sardines?|trout|tilapia|haddock|mackerel|bonito|halibut|catfish|pollock|swordfish|bass)\b/i, possible: /\bworcestershire\b/i },
  { name: 'Shellfish', explicit: /\b(shellfish|shrimp|prawns?|crab|lobster|crayfish|crawfish|clams?|mussels?|oysters?|scallops?)\b/i },
];

export function ingredientAllergens(ingredients: string[]) {
  return ingredients.flatMap(ingredient => allergens.flatMap(rule => {
    // Remove only directly qualified alternatives, not a whole mixed line.
    const normalized = ingredient.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      // Fresh water's intended use is not an ingredient it contains. Keep
      // reserved pasta water and any separately listed ingredients intact.
      .replace(/\bwater\s*,?\s+(?:for|to)\s+(?:cooking|boiling|cook|boil)\s+(?:the\s+)?(?:pasta|noodles|spaghetti|penne|macaroni)\b/gi, 'water');
    const qualified = normalized.replace(rule.alternatives ?? /$^/, '');
    const text = qualified.replace(/\b(?:wheat|gluten|milk|dairy|egg|soy|peanut|nut|sesame|fish|shellfish)[- ]free\b/gi, '');
    const explicit = rule.explicit.test(text);
    // A brand/base mentioned only as an example does not establish its use.
    // Keep definite matches outside examples, even with words like "fresh or frozen".
    const withoutExamples = text.replace(/\(\s*e\.g\.[^)]*\)|\be\.g\..*$/gi, '');
    const possible = explicit ? !rule.explicit.test(withoutExamples) : Boolean(rule.possible?.test(text));
    return explicit || possible ? [{ name: rule.name, ingredient, possible }] : [];
  }));
}

export function ingredientAdditives(ingredients: string[]) {
  return ingredients.flatMap(ingredient => detectAdditives(ingredient).map(additive => ({ ...additive, ingredient })));
}

export function recipeKey(recipe: DetailRecipe): string {
  return JSON.stringify([recipe.title, recipe.freshIngredients, recipe.instructions, recipe.servings, recipe.prepTime, recipe.cookTime, recipe.dietaryTags ?? []]);
}

export function nutritionKey(recipe: DetailRecipe): string {
  return JSON.stringify([recipe.title, recipe.freshIngredients, recipe.instructions, recipe.servings]);
}

export function servingCount(value: string): number | null {
  const match = value.trim().match(/^(?:(?:serves|makes|yield:?)\s*)?(\d+)(?:\s+(?:servings?|people|portions?))?$/i);
  const count = match ? Number(match[1]) : NaN;
  return Number.isInteger(count) && count > 0 && count <= 100 ? count : null;
}

const fractions: Record<string, string> = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const quantity = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)';
const units = '(?:cups?|tablespoons?|tbsp|teaspoons?|tsp|grams?|g|kilograms?|kg|milliliters?|ml|liters?|litres?|l|ounces?|oz|pounds?|lbs?)';
function normalizedQuantities(text: string) { return text.replace(/(\d)?([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_, whole, fraction) => `${whole ? `${whole} ` : ''}${fractions[fraction]}`); }
function multiply(value: string, factor: number) {
  const parts = value.trim().split(/\s+/);
  const parsed = parts.reduce((total, part) => { const [a, b] = part.split('/').map(Number); return total + (b ? a / b : a); }, 0);
  const scaled = parsed * factor;
  const whole = Math.floor(scaled);
  const remainder = scaled - whole;
  const common: [number, string][] = [[0, ''], [1/8, '⅛'], [1/4, '¼'], [1/3, '⅓'], [1/2, '½'], [2/3, '⅔'], [3/4, '¾'], [7/8, '⅞'], [1, '']];
  const near = common.find(([fraction]) => Math.abs(remainder - fraction) < 0.001);
  if (near) return near[0] === 1 ? String(whole + 1) : `${whole || !near[1] ? whole : ''}${near[1]}`;
  return String(Math.round(scaled * 1000) / 1000);
}

export function scaleDetailRecipe(recipe: DetailRecipe, count: number): DetailRecipe {
  const original = servingCount(recipe.servings);
  if (!original || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('Enter a whole serving count from 1 to 100 first.');
  if (count === original) return recipe;
  const factor = count / original;
  const prefix = new RegExp(`^(${quantity})(?=\\s|[a-z])`, 'i');
  const countedFoods = new Set<string>();
  const freshIngredients = recipe.freshIngredients.map(line => {
    const normalized = normalizedQuantities(line);
    // Ranges and package sizes need manual review rather than guessing.
    if (new RegExp(`^${quantity}\\s*(?:[-–]|to|or)\\s*${quantity}`, 'i').test(normalized) || /^\d+\s*\(/.test(normalized)) throw new Error('This recipe has a range or package-size quantity. Edit recipe details to review the quantities first.');
    const match = normalized.match(prefix);
    if (!match && /\d/.test(normalized)) throw new Error('A quantity is not at the start of an ingredient. Review it in Edit recipe details before changing servings.');
    if (match) {
      const rest = normalized.slice(match[0].length).trim();
      const quantityText = rest.replace(/\b\d+(?:\.\d+)?[ -]*(?:inch(?:es)?|cm|mm)[ -]*(?:pieces?|cubes?|chunks?|slices?|thick)\b/gi, '');
      if (/\d/.test(quantityText)) throw new Error('An ingredient has multiple quantities. Review them in Edit recipe details before changing servings.');
      if (!new RegExp(`^${units}\\b`, 'i').test(rest)) {
        const noun = rest.replace(/^(?:small|medium|large|whole|fresh)\s+/i, '').match(/^[a-z]+/i)?.[0];
        if (noun && !/^(inch|cm|piece|slice|minute|can|jar|package)s?$/i.test(noun)) countedFoods.add(noun.replace(/s$/, ''));
      }
    }
    return normalized.replace(prefix, value => multiply(value, factor));
  });
  // Scale food measurements in directions, not temperature, time or step numbers.
  const measurement = new RegExp(`(${quantity})(\\s*${units}\\b)`, 'gi');
  const counted = countedFoods.size ? new RegExp(`(${quantity})(\\s+(?:(?:small|medium|large|whole|fresh)\\s+)?(?:${[...countedFoods].join('|')})s?\\b)`, 'gi') : null;
  const instructions = recipe.instructions.map(step => {
    if (/\b\d+(?:\.\d+)?[\s-]*(?:oz|ounces?|g|grams?|ml)\)?\s+(?:cans?|jars?|packages?)\b/i.test(step)) throw new Error('The directions include a package size. Review these quantities in Edit recipe details before changing servings.');
    let next = normalizedQuantities(step).replace(measurement, (_, amount, unit) => `${multiply(amount, factor)}${unit}`);
    if (counted) next = next.replace(counted, (_, amount, noun) => `${multiply(amount, factor)}${noun}`);
    return next.replace(new RegExp(`\\b${original} (servings?|portions?|bowls?|plates?)\\b`, 'gi'), (_, noun) => `${count} ${noun}`);
  });
  return { ...recipe, freshIngredients, instructions, servings: String(count) };
}
