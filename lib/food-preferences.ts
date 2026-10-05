const ALLERGEN_EXPANSIONS: Record<string, string[]> = {
  fish: ['fish', 'seafood', 'anchovy', 'anchovies', 'bass', 'bonito', 'carp', 'catfish', 'caviar', 'cod', 'dashi', 'flounder', 'grouper', 'haddock', 'halibut', 'herring', 'mackerel', 'mahi mahi', 'perch', 'pollock', 'salmon', 'sardine', 'sardines', 'snapper', 'sole', 'swordfish', 'tilapia', 'trout', 'tuna', 'fish sauce', 'worcestershire', 'surimi', 'roe'],
  shellfish: ['shellfish', 'crab', 'crayfish', 'crawfish', 'lobster', 'prawn', 'prawns', 'shrimp', 'scallop', 'scallops', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters'],
  peanut: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
  'tree nut': ['tree nut', 'tree nuts', 'almond', 'almonds', 'brazil nut', 'cashew', 'cashews', 'hazelnut', 'hazelnuts', 'macadamia', 'pecan', 'pecans', 'pistachio', 'pistachios', 'walnut', 'walnuts', 'marzipan', 'praline'],
  dairy: ['dairy', 'milk', 'butter', 'buttermilk', 'casein', 'cheese', 'cream', 'ghee', 'whey', 'yogurt', 'yoghurt'],
  milk: ['milk', 'butter', 'buttermilk', 'casein', 'cheese', 'cream', 'ghee', 'whey', 'yogurt', 'yoghurt'],
  egg: ['egg', 'eggs', 'albumin', 'mayonnaise', 'meringue'],
  wheat: ['wheat', 'flour', 'bread', 'breadcrumbs', 'couscous', 'farina', 'semolina', 'spelt'],
  gluten: ['gluten', 'wheat', 'barley', 'rye', 'malt', 'farro', 'spelt', 'semolina'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
  sesame: ['sesame', 'tahini', 'benne'],
};

// Dislike aliases stay deliberately narrow. They capture common names without
// turning a specific preference (for example chicken thighs) into a ban on a
// different food (chicken breast), or cilantro into coriander seed.
const DISLIKE_EXPANSIONS: Record<string, string[]> = {
  pork: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta'],
  cilantro: ['cilantro', 'coriander leaf', 'coriander leaves', 'fresh coriander leaf', 'fresh coriander leaves'],
  'bell pepper': ['bell pepper', 'bell peppers', 'sweet pepper', 'sweet peppers', 'capsicum'],
  'chicken thigh': ['chicken thigh', 'chicken thighs'],
  'goat cheese': ['goat cheese', 'goats cheese', 'chevre'],
  feta: ['feta', 'feta cheese'],
};

export function normalizeFoodText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function wholeTerm(haystack: string, term: string): boolean {
  const normalized = normalizeFoodText(term);
  return Boolean(normalized) && ` ${haystack} `.includes(` ${normalized} `);
}

function withoutExplicitNonPorkAlternative(searchable: string, value: string, term: string, kind: 'allergy' | 'dislike'): string {
  if (kind !== 'dislike' || normalizeFoodText(value) !== 'pork' || !['bacon', 'bacons', 'ham', 'hams'].includes(normalizeFoodText(term))) {
    return searchable;
  }
  // “Turkey bacon” and “plant-based ham” are explicit alternatives, not pork.
  // Adjacency is required so “turkey and bacon” still blocks the pork alias.
  const alternative = '(?:turkey|beef|chicken|duck|plant(?:\\s+based)?|vegan|vegetarian|meatless|soy|tempeh|seitan|non\\s+pork|pork\\s+free)';
  const food = normalizeFoodText(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return ` ${searchable} `.replace(new RegExp(`\\b${alternative}\\s+(?:style\\s+)?${food}\\b`, 'g'), ' ');
}

function matchesFoodTerm(searchable: string, value: string, term: string, kind: 'allergy' | 'dislike'): boolean {
  return wholeTerm(withoutExplicitNonPorkAlternative(searchable, value, term, kind), term);
}

function simpleVariants(value: string): string[] {
  const normalized = normalizeFoodText(value);
  if (!normalized) return [];
  const words = normalized.split(' ');
  const last = words.at(-1)!;
  const variants = new Set([normalized]);
  if (last.endsWith('ies') && last.length > 3) variants.add([...words.slice(0, -1), `${last.slice(0, -3)}y`].join(' '));
  else if (last.endsWith('s') && !last.endsWith('ss') && last.length > 2) variants.add([...words.slice(0, -1), last.slice(0, -1)].join(' '));
  else variants.add([...words.slice(0, -1), `${last}s`].join(' '));
  return [...variants];
}

export function allergyTerms(value: string): string[] {
  const normalized = normalizeFoodText(value);
  const terms = new Set(simpleVariants(normalized));
  for (const [category, expansions] of Object.entries(ALLERGEN_EXPANSIONS)) {
    if (normalized === category || simpleVariants(category).includes(normalized)) {
      expansions.forEach((term) => simpleVariants(term).forEach((variant) => terms.add(variant)));
    }
  }
  return [...terms].filter(Boolean);
}

export function dislikedTerms(value: string): string[] {
  const normalized = normalizeFoodText(value);
  const terms = new Set(simpleVariants(normalized));
  for (const [category, expansions] of Object.entries(DISLIKE_EXPANSIONS)) {
    if (normalized === category || simpleVariants(category).includes(normalized)) {
      expansions.forEach((term) => simpleVariants(term).forEach((variant) => terms.add(variant)));
    }
  }
  return [...terms].filter(Boolean);
}

export function findBlockedFood(text: string | string[], values: string[], kind: 'allergy' | 'dislike'): string | null {
  const searchable = normalizeFoodText(Array.isArray(text) ? text.join(' ') : text);
  for (const value of values) {
    const terms = kind === 'allergy' ? allergyTerms(value) : dislikedTerms(value);
    if (terms.some((term) => matchesFoodTerm(searchable, value, term, kind))) return value;
  }
  return null;
}

function withoutExplicitOmissions(instructions: string, terms: string[]): string {
  let normalized = ` ${normalizeFoodText(instructions)} `;
  for (const term of terms) {
    const escaped = normalizeFoodText(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Only direct, unambiguous omission language is ignored. Phrases such as
    // “no need to chop feta” are preparation instructions, not an exclusion.
    const patterns = [
      new RegExp(`\\bwithout\\s+(?:the\\s+)?${escaped}\\b`, 'g'),
      new RegExp(`\\bomit\\s+(?:the\\s+)?${escaped}\\b`, 'g'),
      new RegExp(`\\bleave\\s+(?:the\\s+)?${escaped}\\s+out\\b`, 'g'),
      new RegExp(`\\bdo\\s+not\\s+(?:add|use|include|serve)\\s+(?:the\\s+)?${escaped}\\b`, 'g'),
    ];
    for (const pattern of patterns) normalized = normalized.replace(pattern, ' ');
  }
  return normalized;
}

export function findBlockedFoodInRecipe(
  recipe: { title: string; ingredients: string[]; instructions: string | string[] },
  values: string[],
  kind: 'allergy' | 'dislike',
): string | null {
  const ingredientMatch = findBlockedFood([recipe.title, ...recipe.ingredients], values, kind);
  if (ingredientMatch) return ingredientMatch;
  const instructionText = Array.isArray(recipe.instructions) ? recipe.instructions.join(' ') : recipe.instructions;
  for (const value of values) {
    const terms = kind === 'allergy' ? allergyTerms(value) : dislikedTerms(value);
    const searchable = withoutExplicitOmissions(instructionText, terms);
    if (terms.some((term) => matchesFoodTerm(searchable, value, term, kind))) return value;
    if (
      kind === 'dislike'
      && simpleVariants(normalizeFoodText(value)).includes('chicken thigh')
      && wholeTerm(normalizeFoodText([recipe.title, ...recipe.ingredients].join(' ')), 'chicken')
    ) {
      const contextualDirections = withoutExplicitOmissions(instructionText, ['chicken thigh', 'chicken thighs', 'thigh', 'thighs']);
      if (wholeTerm(contextualDirections, 'thigh') || wholeTerm(contextualDirections, 'thighs')) return value;
    }
  }
  return null;
}

export function expandedFoodTerms(allergies: string[], dislikes: string[]): string[] {
  return [...new Set([
    ...allergies.flatMap(allergyTerms),
    ...dislikes.flatMap(dislikedTerms),
  ])];
}
