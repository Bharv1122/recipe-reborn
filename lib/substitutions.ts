/**
 * Static, hand-written ingredient swaps for the public MCP connector.
 *
 * Deliberately a lookup table rather than an AI call: it is free to serve,
 * instant, and can't drift into health or medical advice. Swaps are about
 * cooking results (texture, flavor, rise) only.
 */

export interface Substitution {
  swap: string;
  ratio: string;
  notes: string;
  goodFor: Array<'baking' | 'cooking' | 'sauces' | 'dressings' | 'any'>;
}

interface Entry {
  names: string[];
  options: Substitution[];
}

const TABLE: Entry[] = [
  {
    names: ['egg', 'eggs'],
    options: [
      { swap: 'ground flaxseed + water', ratio: '1 tbsp ground flaxseed + 3 tbsp water per egg; rest 5 minutes', notes: 'Binds well in muffins, pancakes and quick breads. Slightly nutty; does not whip.', goodFor: ['baking'] },
      { swap: 'unsweetened applesauce', ratio: '1/4 cup per egg', notes: 'Adds moisture to cakes and brownies; results are a little denser.', goodFor: ['baking'] },
    ],
  },
  {
    names: ['buttermilk'],
    options: [
      { swap: 'milk + lemon juice', ratio: '1 cup milk + 1 tbsp lemon juice; stand 5 minutes', notes: 'Works in pancakes, biscuits and marinades.', goodFor: ['baking', 'cooking'] },
      { swap: 'plain yogurt thinned with milk', ratio: '3/4 cup yogurt + 1/4 cup milk', notes: 'Thicker and tangier; good in dressings.', goodFor: ['baking', 'dressings'] },
    ],
  },
  {
    names: ['butter'],
    options: [
      { swap: 'olive oil', ratio: '3/4 cup oil per 1 cup butter', notes: 'Best for sautéing and savory baking; changes texture in cookies.', goodFor: ['cooking', 'baking'] },
      { swap: 'coconut oil', ratio: '1:1', notes: 'Solid when cool like butter; refined coconut oil has little coconut flavor.', goodFor: ['baking'] },
    ],
  },
  {
    names: ['heavy cream', 'cream', 'whipping cream'],
    options: [
      { swap: 'whole milk + butter', ratio: '3/4 cup milk + 1/4 cup melted butter per cup', notes: 'Fine in soups and sauces; will not whip.', goodFor: ['sauces', 'cooking'] },
      { swap: 'canned coconut milk (full fat)', ratio: '1:1', notes: 'Rich and dairy-free; adds a light coconut flavor.', goodFor: ['sauces', 'cooking'] },
    ],
  },
  {
    names: ['sour cream'],
    options: [
      { swap: 'plain Greek yogurt', ratio: '1:1', notes: 'Tangier and thicker. Stir in off the heat so it does not split.', goodFor: ['any'] },
    ],
  },
  {
    names: ['milk'],
    options: [
      { swap: 'unsweetened oat or soy milk', ratio: '1:1', notes: 'Works in most baking and sauces.', goodFor: ['any'] },
      { swap: 'water + a little butter', ratio: '1 cup water + 1 tbsp butter', notes: 'In a pinch for baking; slightly less rich.', goodFor: ['baking'] },
    ],
  },
  {
    names: ['mayonnaise', 'mayo'],
    options: [
      { swap: 'plain Greek yogurt', ratio: '1:1', notes: 'Tangier and lighter in texture; good in dressings and salads.', goodFor: ['dressings'] },
    ],
  },
  {
    names: ['brown sugar'],
    options: [
      { swap: 'white sugar + molasses', ratio: '1 cup sugar + 1 tbsp molasses', notes: 'Nearly identical in baking.', goodFor: ['baking'] },
      { swap: 'coconut sugar', ratio: '1:1', notes: 'Similar caramel flavor; slightly drier.', goodFor: ['baking'] },
    ],
  },
  {
    names: ['honey'],
    options: [
      { swap: 'maple syrup', ratio: '1:1', notes: 'Thinner; bars may need a few extra minutes in the oven.', goodFor: ['any'] },
    ],
  },
  {
    names: ['breadcrumbs', 'panko', 'panko breadcrumbs', 'bread crumbs'],
    options: [
      { swap: 'crushed cornflakes', ratio: '1:1', notes: 'Extra crunchy coating for baked chicken or fish.', goodFor: ['cooking'] },
      { swap: 'rolled oats, pulsed', ratio: '1:1', notes: 'Good binder in meatballs; softer as a coating.', goodFor: ['cooking'] },
    ],
  },
  {
    names: ['cornstarch', 'corn starch'],
    options: [
      { swap: 'all-purpose flour', ratio: '2 tbsp flour per 1 tbsp cornstarch', notes: 'Cook a minute longer to lose the raw flour taste; sauce will be less glossy.', goodFor: ['sauces'] },
      { swap: 'arrowroot powder', ratio: '1:1', notes: 'Glossy finish; add at the end and do not boil hard.', goodFor: ['sauces'] },
    ],
  },
  {
    names: ['baking powder'],
    options: [
      { swap: 'baking soda + cream of tartar', ratio: '1/4 tsp baking soda + 1/2 tsp cream of tartar per 1 tsp', notes: 'Mix into the batter right before baking.', goodFor: ['baking'] },
    ],
  },
  {
    names: ['lemon juice'],
    options: [
      { swap: 'lime juice', ratio: '1:1', notes: 'Slightly different citrus flavor.', goodFor: ['any'] },
      { swap: 'white wine vinegar', ratio: '1/2 the amount', notes: 'Sharper; good in dressings, not for desserts.', goodFor: ['dressings', 'cooking'] },
    ],
  },
  {
    names: ['soy sauce'],
    options: [
      { swap: 'coconut aminos', ratio: '1:1, then taste', notes: 'Sweeter and less salty.', goodFor: ['cooking', 'sauces'] },
    ],
  },
  {
    names: ['vegetable broth', 'chicken broth', 'broth', 'stock'],
    options: [
      { swap: 'water + a pinch of salt and dried herbs', ratio: '1:1', notes: 'Lighter flavor; add a splash of soy sauce or tomato paste for depth.', goodFor: ['cooking', 'sauces'] },
    ],
  },
  {
    names: ['fresh herbs', 'fresh basil', 'fresh dill', 'fresh parsley', 'fresh chives'],
    options: [
      { swap: 'dried herbs', ratio: '1 tsp dried per 1 tbsp fresh', notes: 'Add dried herbs earlier in cooking so they soften.', goodFor: ['any'] },
    ],
  },
  {
    names: ['all-purpose flour', 'flour'],
    options: [
      { swap: 'whole wheat pastry flour', ratio: '1:1', notes: 'Nuttier and slightly denser; good in pancakes and muffins.', goodFor: ['baking'] },
    ],
  },
];

export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Exact name first, then the entry whose name appears inside the query ("2 large eggs" → egg). */
export function findSubstitutions(ingredient: string): { matched: string; options: Substitution[] } | null {
  const q = normalizeIngredientName(ingredient);
  if (!q) return null;
  for (const e of TABLE) if (e.names.includes(q)) return { matched: e.names[0], options: e.options };
  let best: { entry: Entry; len: number } | null = null;
  for (const e of TABLE) {
    for (const n of e.names) {
      if (new RegExp(`\\b${n}\\b`).test(q) && (!best || n.length > best.len)) best = { entry: e, len: n.length };
    }
  }
  return best ? { matched: best.entry.names[0], options: best.entry.options } : null;
}

export const KNOWN_SUBSTITUTION_INGREDIENTS = TABLE.map((e) => e.names[0]);
