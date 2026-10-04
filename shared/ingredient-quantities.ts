// Pure ingredient-line checks shared by the web and native apps.
// This only answers "does the line state an amount?". It never suggests or
// guesses an amount, and a stated amount is not a nutrition check: a recipe
// whose serving count matches can still have wrong totals.

const UNICODE_FRACTIONS = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
const WORD_NUMBERS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|dozen|half|quarter|third|couple|few|several';
// Units that make "a"/"an" an amount: "a pinch", "an 8-ounce", "a cup".
const ARTICLE_UNITS = 'pinch|dash|splash|handful|cup|tablespoon|tbsp|teaspoon|tsp|pound|lb|ounce|oz|clove|can|jar|slice|piece|stalk|sprig|bunch|head|knob|wedge|sheet|loaf|large|medium|small|whole|dozen|couple|few';

const QUANTITY = new RegExp([
  `\\d`,
  `[${UNICODE_FRACTIONS}]`,
  `\\b(?:${WORD_NUMBERS})\\b`,
  `\\b(?:a|an)\\s+(?:\\d|(?:${ARTICLE_UNITS})\\b)`,
  // Recognized small measures without a number: "pinch of salt", "dash of hot sauce".
  `\\b(?:pinch|dash)(?:es)?\\b`,
].join('|'), 'i');

// Numbers that describe something other than how much food to use. Removing
// them keeps "Cooked rice for 2 servings" from passing as measured.
const NON_AMOUNT_NUMBERS = [
  /\b(?:for|serves?|makes|yields?)\s+(?:about\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:-|to)\s*\d+)?(?:\s+(?:servings?|people|portions?|persons?))?\b/gi,
  /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:servings?|portions?|people|persons?)\b/gi,
  /\b\d+(?:\.\d+)?\s*%/g,
  /\b\d+\s*°\s*[fc]?\b/gi,
  /\b\d+\s*(?:-|to)?\s*\d*\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/gi,
  // Food names that contain number words.
  /\bhalf[- ](?:and|&)[- ]half\b/gi,
  /\bfive[- ]spice\b/gi,
];

// Lines allowed without an amount: seasonings, garnish herbs, water or spray
// that are explicitly "to taste", "as needed", or "for garnish".
const EXEMPT_PHRASE = /\b(?:to taste|as needed|as desired|for garnish(?:ing)?|to garnish|garnish|for greasing|for serving|optional)\b/i;
const EXEMPT_ITEM_WORDS = new Set([
  'salt', 'pepper', 'peppercorns', 'kosher', 'sea', 'flaky', 'black', 'white', 'cracked', 'ground', 'freshly', 'fresh',
  'and', 'or', 'more', 'extra', 'plus', 'additional', 'of', 'a', 'little', 'chopped', 'minced', 'torn', 'sliced', 'finely', 'roughly',
  'red', 'chili', 'chile', 'flakes', 'crushed', 'cayenne', 'paprika', 'smoked', 'cumin', 'garlic', 'powder', 'onion', 'dried',
  'herbs', 'herb', 'parsley', 'cilantro', 'basil', 'dill', 'chives', 'mint', 'thyme', 'oregano', 'rosemary', 'scallion', 'scallions', 'green', 'onions',
  'hot', 'sauce', 'lemon', 'lime', 'wedges', 'wedge', 'zest', 'juice', 'squeeze', 'sesame', 'seeds', 'toasted',
  'water', 'nonstick', 'cooking', 'spray', 'ice',
]);

function isSmallSeasoning(line: string): boolean {
  if (!EXEMPT_PHRASE.test(line)) return false;
  const words = line.toLowerCase().replace(EXEMPT_PHRASE, ' ').replace(/\([^)]*\)/g, ' ').match(/[a-z]+/g) ?? [];
  // "for serving" alone must not excuse a staple such as rice or bread.
  const remaining = words.filter(word => !['to', 'taste', 'as', 'needed', 'desired', 'for', 'garnish', 'garnishing', 'greasing', 'serving', 'optional'].includes(word));
  return remaining.length > 0 && remaining.every(word => EXEMPT_ITEM_WORDS.has(word));
}

/** True when an ingredient line states an amount (numbers, ½-style fractions, word counts) or is a small to-taste seasoning. */
export function ingredientHasQuantity(line: string): boolean {
  const text = line.trim().replace(/^[-*•·]\s*/, '');
  if (!text) return false;
  if (isSmallSeasoning(text)) return true;
  const amountsOnly = NON_AMOUNT_NUMBERS.reduce((value, pattern) => value.replace(pattern, ' '), text);
  return QUANTITY.test(amountsOnly);
}

/** Ingredient lines that state no amount, in their original order. No amounts are guessed. */
export function findUnmeasuredIngredients(lines: readonly string[]): string[] {
  return lines.filter(line => !ingredientHasQuantity(line));
}

export const INGREDIENT_QUANTITY_RULES = 'Give every ingredient an amount: a number or count plus a unit when it is not a whole item (for example "1 cup cooked brown rice (from 1/3 cup dry)", "2 large eggs", "8 oz chicken breast"). This includes sides, grains, breads, sauces, oils and garnishes that add food. Say whether grains, pasta and beans are measured cooked or dry/raw. Amounts are totals for every stated serving combined, not for one serving. Only salt, pepper, small amounts of spices, fresh herb or citrus garnish, and water may say "to taste", "as needed" or "for garnish"; never write a grain, bread, protein, vegetable, sauce or oil as "for serving" without an amount.';
