/**
 * Recipe Reborn's public recipe catalog.
 *
 * These are house recipes written for Recipe Reborn — NOT user data. They
 * power the public surfaces that must never touch anyone's account:
 *   - the Muse / MCP connector tools (app/api/mcp)
 *   - the no-login kitchen display + WebXR demo (/kitchen/demo)
 *
 * Wording rule for everything in this file: describe food, not health.
 * No weight-loss, medical, or "diet for condition X" claims. `contains` lists
 * common allergens as a courtesy only — it is not an allergen guarantee.
 */

export type Aisle =
  | 'produce'
  | 'dairy & eggs'
  | 'meat & seafood'
  | 'pantry'
  | 'baking'
  | 'spices'
  | 'bakery'
  | 'frozen';

export interface CatalogIngredient {
  qty: number | null;
  unit: string;
  item: string;
  note?: string;
  aisle: Aisle;
}

export interface CatalogRecipe {
  id: string;
  title: string;
  replaces: string;
  summary: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  contains: string[];
  ingredients: CatalogIngredient[];
  steps: string[];
}

// The recipe the no-login demo (/kitchen/demo, /kitchen/demo/xr) opens.
export const DEMO_RECIPE_ID = 'rr-weeknight-tomato-soup';

export const PUBLIC_RECIPES: CatalogRecipe[] = [
  {
    id: 'rr-weeknight-tomato-soup',
    title: 'Weeknight Tomato Soup',
    replaces: 'canned condensed tomato soup',
    summary:
      'A smooth, simple tomato soup made from canned whole tomatoes, onion and garlic — no added sugar syrups or flavor enhancers.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 30,
    tags: ['vegetarian', 'one-pot', 'make-ahead'],
    contains: ['dairy'],
    ingredients: [
      { qty: 2, unit: 'tbsp', item: 'olive oil', aisle: 'pantry' },
      { qty: 1, unit: '', item: 'yellow onion', note: 'diced', aisle: 'produce' },
      { qty: 3, unit: 'cloves', item: 'garlic', note: 'minced', aisle: 'produce' },
      { qty: 28, unit: 'oz', item: 'canned whole tomatoes', aisle: 'pantry' },
      { qty: 2, unit: 'cups', item: 'vegetable broth', aisle: 'pantry' },
      { qty: 1, unit: 'tsp', item: 'dried basil', aisle: 'spices' },
      { qty: 0.5, unit: 'tsp', item: 'salt', note: 'plus more to taste', aisle: 'spices' },
      { qty: 0.25, unit: 'tsp', item: 'black pepper', aisle: 'spices' },
      { qty: 0.25, unit: 'cup', item: 'heavy cream', note: 'optional', aisle: 'dairy & eggs' },
    ],
    steps: [
      'Warm the olive oil in a large pot over medium heat.',
      'Add the diced onion and cook, stirring now and then, for 5 minutes until soft.',
      'Stir in the garlic and cook for 1 minute until fragrant.',
      'Add the whole tomatoes with their juice, the vegetable broth, dried basil, salt and black pepper.',
      'Bring to a boil, then lower the heat and simmer for 20 minutes.',
      'Blend until smooth with an immersion blender, or carefully in batches in a regular blender.',
      'Stir in the heavy cream if using, taste, and adjust the salt. Serve hot.',
    ],
  },
  {
    id: 'rr-chewy-oat-granola-bars',
    title: 'Chewy Oat Granola Bars',
    replaces: 'packaged granola bars',
    summary:
      'Chewy bars of oats, nut butter and honey, pressed into a pan and baked — no corn syrup solids or preservatives.',
    servings: 12,
    prepMinutes: 10,
    cookMinutes: 20,
    tags: ['vegetarian', 'make-ahead', 'snack'],
    contains: ['peanuts'],
    ingredients: [
      { qty: 2, unit: 'cups', item: 'rolled oats', aisle: 'pantry' },
      { qty: 0.5, unit: 'cup', item: 'peanut butter', aisle: 'pantry' },
      { qty: 0.33, unit: 'cup', item: 'honey', aisle: 'pantry' },
      { qty: 2, unit: 'tbsp', item: 'coconut oil', note: 'melted', aisle: 'pantry' },
      { qty: 1, unit: 'tsp', item: 'vanilla extract', aisle: 'baking' },
      { qty: 0.25, unit: 'tsp', item: 'salt', aisle: 'spices' },
      { qty: 0.5, unit: 'cup', item: 'raisins', aisle: 'pantry' },
    ],
    steps: [
      'Heat the oven to 350°F and line an 8-inch square pan with parchment paper.',
      'Whisk the peanut butter, honey, melted coconut oil, vanilla extract and salt in a large bowl.',
      'Stir in the rolled oats and raisins until everything is coated.',
      'Press the mixture firmly and evenly into the pan.',
      'Bake for 20 minutes until the edges are golden.',
      'Cool in the pan for 30 minutes, then lift out and cut into 12 bars.',
    ],
  },
  {
    id: 'rr-herby-ranch-dressing',
    title: 'Herby Ranch Dressing',
    replaces: 'bottled ranch dressing',
    summary:
      'A creamy ranch made with yogurt, mayonnaise and fresh herbs — no gums, flavor enhancers or artificial flavors.',
    servings: 8,
    prepMinutes: 10,
    cookMinutes: 0,
    tags: ['vegetarian', 'no-cook', 'make-ahead'],
    contains: ['dairy', 'egg'],
    ingredients: [
      { qty: 0.5, unit: 'cup', item: 'plain yogurt', aisle: 'dairy & eggs' },
      { qty: 0.25, unit: 'cup', item: 'mayonnaise', aisle: 'pantry' },
      { qty: 0.25, unit: 'cup', item: 'milk', aisle: 'dairy & eggs' },
      { qty: 1, unit: 'tbsp', item: 'lemon juice', aisle: 'produce' },
      { qty: 2, unit: 'tbsp', item: 'fresh dill', note: 'chopped', aisle: 'produce' },
      { qty: 2, unit: 'tbsp', item: 'fresh chives', note: 'chopped', aisle: 'produce' },
      { qty: 0.5, unit: 'tsp', item: 'garlic powder', aisle: 'spices' },
      { qty: 0.25, unit: 'tsp', item: 'salt', aisle: 'spices' },
    ],
    steps: [
      'Whisk the plain yogurt, mayonnaise, milk and lemon juice together in a bowl.',
      'Stir in the fresh dill, fresh chives, garlic powder and salt.',
      'Chill for 30 minutes so the flavors come together.',
      'Stir again before serving. Keeps in the fridge for up to 5 days.',
    ],
  },
  {
    id: 'rr-stovetop-mac-and-cheese',
    title: 'Stovetop Mac and Cheese',
    replaces: 'boxed macaroni and cheese',
    summary:
      'Real cheddar melted into a quick milk sauce and folded into pasta — no powdered cheese mix or added colors.',
    servings: 4,
    prepMinutes: 5,
    cookMinutes: 15,
    tags: ['vegetarian', 'kid-friendly', 'quick'],
    contains: ['dairy', 'wheat'],
    ingredients: [
      { qty: 8, unit: 'oz', item: 'elbow macaroni', aisle: 'pantry' },
      { qty: 2, unit: 'tbsp', item: 'butter', aisle: 'dairy & eggs' },
      { qty: 2, unit: 'tbsp', item: 'all-purpose flour', aisle: 'baking' },
      { qty: 1.5, unit: 'cups', item: 'milk', aisle: 'dairy & eggs' },
      { qty: 2, unit: 'cups', item: 'shredded cheddar cheese', aisle: 'dairy & eggs' },
      { qty: 0.5, unit: 'tsp', item: 'salt', aisle: 'spices' },
      { qty: 0.25, unit: 'tsp', item: 'mustard powder', aisle: 'spices' },
    ],
    steps: [
      'Bring a large pot of salted water to a boil.',
      'Cook the elbow macaroni for 8 minutes until just tender, then drain.',
      'In the same pot, melt the butter over medium heat and whisk in the flour for 1 minute.',
      'Slowly whisk in the milk and cook for 3 minutes, stirring, until slightly thickened.',
      'Take the pot off the heat and stir in the cheddar cheese, salt and mustard powder until smooth.',
      'Fold the macaroni back into the sauce and serve right away.',
    ],
  },
  {
    id: 'rr-oven-baked-chicken-tenders',
    title: 'Oven-Baked Chicken Tenders',
    replaces: 'frozen breaded chicken nuggets',
    summary:
      'Chicken strips in a crunchy panko and parmesan coating, baked on a sheet pan — no fillers or mechanically separated meat.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 18,
    tags: ['kid-friendly', 'sheet-pan'],
    contains: ['egg', 'wheat', 'dairy'],
    ingredients: [
      { qty: 1.5, unit: 'lb', item: 'chicken breast', note: 'cut into strips', aisle: 'meat & seafood' },
      { qty: 2, unit: '', item: 'eggs', aisle: 'dairy & eggs' },
      { qty: 1, unit: 'cup', item: 'panko breadcrumbs', aisle: 'bakery' },
      { qty: 0.5, unit: 'cup', item: 'grated parmesan', aisle: 'dairy & eggs' },
      { qty: 1, unit: 'tsp', item: 'smoked paprika', aisle: 'spices' },
      { qty: 0.5, unit: 'tsp', item: 'salt', aisle: 'spices' },
      { qty: 2, unit: 'tbsp', item: 'olive oil', aisle: 'pantry' },
    ],
    steps: [
      'Heat the oven to 425°F and line a sheet pan with parchment paper.',
      'Beat the eggs in a shallow bowl.',
      'Mix the panko breadcrumbs, grated parmesan, smoked paprika and salt in a second shallow bowl.',
      'Dip each chicken strip in egg, then press it into the crumb mixture and set it on the pan.',
      'Drizzle the olive oil over the tenders.',
      'Bake for 18 minutes, until golden and the chicken reaches 165°F inside.',
    ],
  },
  {
    id: 'rr-taco-seasoning',
    title: 'Pantry Taco Seasoning',
    replaces: 'taco seasoning packets',
    summary:
      'A jar-ready spice blend for tacos — no anti-caking agents, maltodextrin or flavor enhancers.',
    servings: 6,
    prepMinutes: 5,
    cookMinutes: 0,
    tags: ['vegan', 'no-cook', 'pantry'],
    contains: [],
    ingredients: [
      { qty: 2, unit: 'tbsp', item: 'chili powder', aisle: 'spices' },
      { qty: 1, unit: 'tbsp', item: 'ground cumin', aisle: 'spices' },
      { qty: 1, unit: 'tsp', item: 'smoked paprika', aisle: 'spices' },
      { qty: 1, unit: 'tsp', item: 'garlic powder', aisle: 'spices' },
      { qty: 1, unit: 'tsp', item: 'onion powder', aisle: 'spices' },
      { qty: 1, unit: 'tsp', item: 'dried oregano', aisle: 'spices' },
      { qty: 1, unit: 'tsp', item: 'salt', aisle: 'spices' },
    ],
    steps: [
      'Stir all the spices together in a small bowl.',
      'Store in a sealed jar for up to 6 months.',
      'Use 2 tablespoons per pound of meat or beans, with a splash of water.',
    ],
  },
  {
    id: 'rr-simple-marinara',
    title: 'Simple Marinara Sauce',
    replaces: 'jarred pasta sauce',
    summary:
      'A bright tomato sauce with olive oil, garlic and basil — no added sugar or thickeners.',
    servings: 6,
    prepMinutes: 5,
    cookMinutes: 25,
    tags: ['vegan', 'one-pot', 'make-ahead'],
    contains: [],
    ingredients: [
      { qty: 3, unit: 'tbsp', item: 'olive oil', aisle: 'pantry' },
      { qty: 4, unit: 'cloves', item: 'garlic', note: 'thinly sliced', aisle: 'produce' },
      { qty: 28, unit: 'oz', item: 'crushed tomatoes', aisle: 'pantry' },
      { qty: 1, unit: 'tsp', item: 'dried oregano', aisle: 'spices' },
      { qty: 0.5, unit: 'tsp', item: 'salt', aisle: 'spices' },
      { qty: 0.25, unit: 'tsp', item: 'red pepper flakes', note: 'optional', aisle: 'spices' },
      { qty: 6, unit: 'leaves', item: 'fresh basil', aisle: 'produce' },
    ],
    steps: [
      'Warm the olive oil in a saucepan over medium-low heat.',
      'Add the garlic and cook for 2 minutes until pale golden, without letting it brown.',
      'Pour in the crushed tomatoes and add the dried oregano, salt and red pepper flakes.',
      'Simmer uncovered for 20 minutes, stirring now and then.',
      'Tear in the fresh basil, taste, and adjust the salt.',
    ],
  },
  {
    id: 'rr-buttermilk-pancakes',
    title: 'From-Scratch Buttermilk Pancakes',
    replaces: 'boxed pancake mix',
    summary:
      'Fluffy pancakes from flour, buttermilk and eggs — no hydrogenated oils or artificial flavors.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    tags: ['vegetarian', 'breakfast', 'kid-friendly'],
    contains: ['wheat', 'dairy', 'egg'],
    ingredients: [
      { qty: 2, unit: 'cups', item: 'all-purpose flour', aisle: 'baking' },
      { qty: 2, unit: 'tbsp', item: 'sugar', aisle: 'baking' },
      { qty: 2, unit: 'tsp', item: 'baking powder', aisle: 'baking' },
      { qty: 0.5, unit: 'tsp', item: 'baking soda', aisle: 'baking' },
      { qty: 0.5, unit: 'tsp', item: 'salt', aisle: 'spices' },
      { qty: 2, unit: 'cups', item: 'buttermilk', aisle: 'dairy & eggs' },
      { qty: 2, unit: '', item: 'eggs', aisle: 'dairy & eggs' },
      { qty: 3, unit: 'tbsp', item: 'butter', note: 'melted', aisle: 'dairy & eggs' },
    ],
    steps: [
      'Whisk the flour, sugar, baking powder, baking soda and salt in a large bowl.',
      'In another bowl, whisk the buttermilk, eggs and melted butter.',
      'Pour the wet ingredients into the dry ones and stir until just combined. A few lumps are fine.',
      'Let the batter rest for 5 minutes while a skillet heats over medium heat.',
      'Pour 1/4 cup of batter per pancake and cook for 2 minutes, until bubbles form on top.',
      'Flip and cook for 1 minute more. Repeat with the rest of the batter.',
    ],
  },
];

const byId = new Map(PUBLIC_RECIPES.map((r) => [r.id, r]));

export function getPublicRecipe(id: string): CatalogRecipe | undefined {
  if (id === 'demo') return byId.get(DEMO_RECIPE_ID);
  return byId.get(id);
}

// --- Formatting -----------------------------------------------------------

const FRACTIONS: Array<[number, string]> = [
  [0.25, '1/4'],
  [0.33, '1/3'],
  [0.5, '1/2'],
  [0.67, '2/3'],
  [0.75, '3/4'],
];

/** 1.5 → "1 1/2", 0.33 → "1/3", 2 → "2". Keeps kitchen-friendly fractions. */
export function formatQty(qty: number): string {
  const whole = Math.floor(qty);
  const rest = qty - whole;
  if (rest < 0.05) return String(whole);
  if (rest > 0.95) return String(whole + 1);
  const [, frac] = FRACTIONS.reduce((best, cur) =>
    Math.abs(cur[0] - rest) < Math.abs(best[0] - rest) ? cur : best
  );
  return whole > 0 ? `${whole} ${frac}` : frac;
}

const PLURAL_UNITS: Record<string, string> = { cups: 'cup', cloves: 'clove', leaves: 'leaf' };

/** "cups" → "cup" when the amount is one or less, so scaling reads naturally. */
export function unitFor(qty: number, unit: string): string {
  return qty <= 1.05 && PLURAL_UNITS[unit] ? PLURAL_UNITS[unit] : unit;
}

export function formatIngredient(ing: CatalogIngredient, scale = 1): string {
  const parts: string[] = [];
  if (ing.qty !== null) parts.push(formatQty(ing.qty * scale));
  if (ing.unit) parts.push(ing.qty === null ? ing.unit : unitFor(ing.qty * scale, ing.unit));
  parts.push(ing.item);
  return ing.note ? `${parts.join(' ')}, ${ing.note}` : parts.join(' ');
}

// --- Search ---------------------------------------------------------------

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

export interface SearchOptions {
  query?: string;
  tag?: string;
  maxTotalMinutes?: number;
  limit?: number;
}

/**
 * Keyword search over the catalog. Title and "replaces" matches outrank
 * ingredient matches so "ranch" finds the dressing before anything that
 * merely contains buttermilk.
 */
export function searchPublicRecipes({
  query = '',
  tag,
  maxTotalMinutes,
  limit = 5,
}: SearchOptions): CatalogRecipe[] {
  const q = tokens(query);
  const scored = PUBLIC_RECIPES.filter((r) => !tag || r.tags.includes(tag.toLowerCase()))
    .filter((r) => !maxTotalMinutes || r.prepMinutes + r.cookMinutes <= maxTotalMinutes)
    .map((r) => {
      if (q.length === 0) return { r, score: 1 };
      const title = new Set(tokens(`${r.title} ${r.replaces}`));
      const body = new Set(
        tokens(`${r.summary} ${r.tags.join(' ')} ${r.ingredients.map((i) => i.item).join(' ')}`)
      );
      let score = 0;
      for (const t of q) {
        if (title.has(t)) score += 3;
        else if (body.has(t)) score += 1;
      }
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, Math.min(limit, 10))).map((x) => x.r);
}

// --- Shopping list ----------------------------------------------------------

export interface ShoppingLine {
  item: string;
  amount: string;
  aisle: Aisle;
}

/** Scales a catalog recipe and groups its ingredients by store aisle. */
export function shoppingListFor(
  recipe: CatalogRecipe,
  servings = recipe.servings
): Record<string, ShoppingLine[]> {
  const scale = servings / recipe.servings;
  const merged = new Map<string, { qty: number | null; unit: string; aisle: Aisle }>();
  for (const ing of recipe.ingredients) {
    const key = `${ing.item}|${ing.unit}`;
    const prev = merged.get(key);
    if (prev && prev.qty !== null && ing.qty !== null) prev.qty += ing.qty * scale;
    else merged.set(key, { qty: ing.qty === null ? null : ing.qty * scale, unit: ing.unit, aisle: ing.aisle });
  }
  const groups: Record<string, ShoppingLine[]> = {};
  for (const [key, v] of Array.from(merged.entries())) {
    const item = key.split('|')[0];
    const amount = v.qty === null ? 'to taste' : [formatQty(v.qty), unitFor(v.qty, v.unit)].filter(Boolean).join(' ');
    (groups[v.aisle] ??= []).push({ item, amount, aisle: v.aisle });
  }
  return groups;
}
