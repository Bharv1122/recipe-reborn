/**
 * Built-in recipes for the hands-first XR kitchen.
 *
 * Why bundled instead of fetched: the XR mode has to work for contest judges
 * (and anyone in a headset) with no account, no paywall and no network-bound
 * AI call between them and the first satisfying moment. These are the same
 * "processed label -> fresh recipe" transformations the main app generates,
 * written out once and checked by hand. Product names are generic on purpose:
 * no real brands.
 */

export type XrStep = {
  text: string;
  /** When set, the step offers a one-pinch timer of this many seconds. */
  timerSeconds?: number;
  timerLabel?: string;
};

export type XrRecipe = {
  id: string;
  /** The packaged product the user is replacing. */
  product: string;
  /** What the label said, in label order. */
  labelIngredients: string[];
  /** Label items most home cooks would not keep in a kitchen. */
  unfamiliar: string[];
  title: string;
  tagline: string;
  totalMinutes: number;
  servings: number;
  accent: string;
  ingredients: string[];
  steps: XrStep[];
};

export const XR_RECIPES: XrRecipe[] = [
  {
    id: 'mac-and-cheese',
    product: 'Boxed mac & cheese',
    labelIngredients: [
      'Enriched macaroni',
      'Whey',
      'Milkfat',
      'Milk protein concentrate',
      'Salt',
      'Sodium triphosphate',
      'Citric acid',
      'Sodium phosphate',
      'Lactic acid',
      'Calcium phosphate',
      'Enzymes',
      'Cheese culture',
      'Yellow 5',
      'Yellow 6',
    ],
    unfamiliar: [
      'Milk protein concentrate',
      'Sodium triphosphate',
      'Sodium phosphate',
      'Calcium phosphate',
      'Yellow 5',
      'Yellow 6',
    ],
    title: 'Stovetop mac & cheese',
    tagline: 'Real cheddar, one pot, 20 minutes',
    totalMinutes: 20,
    servings: 4,
    accent: '#f59e0b',
    ingredients: [
      '8 oz elbow pasta',
      '2 tbsp butter',
      '2 tbsp flour',
      '1 1/2 cups milk',
      '6 oz sharp cheddar, grated',
      '1/2 tsp mustard powder',
      'Pinch of paprika',
      'Salt and pepper',
    ],
    steps: [
      {
        text: 'Bring a large pot of salted water to a boil.',
        timerSeconds: 8 * 60,
        timerLabel: 'Water boil',
      },
      {
        text: 'Add the pasta and cook until just tender.',
        timerSeconds: 7 * 60,
        timerLabel: 'Pasta',
      },
      { text: 'Drain the pasta and set it aside. Use the same pot for the sauce.' },
      {
        text: 'Melt the butter over medium heat, whisk in the flour and cook for one minute.',
        timerSeconds: 60,
        timerLabel: 'Roux',
      },
      {
        text: 'Slowly whisk in the milk. Simmer, stirring, until it coats a spoon.',
        timerSeconds: 4 * 60,
        timerLabel: 'Sauce',
      },
      { text: 'Turn off the heat. Stir in the cheddar, mustard powder and paprika until smooth.' },
      { text: 'Fold the pasta back in. Season with salt and pepper and serve.' },
    ],
  },
  {
    id: 'ramen',
    product: 'Instant ramen cup',
    labelIngredients: [
      'Enriched wheat flour',
      'Palm oil',
      'Salt',
      'Monosodium glutamate',
      'Hydrolyzed soy protein',
      'Maltodextrin',
      'Sodium carbonate',
      'Potassium carbonate',
      'TBHQ',
      'Dehydrated vegetables',
      'Caramel color',
      'Disodium inosinate',
    ],
    unfamiliar: [
      'Hydrolyzed soy protein',
      'Maltodextrin',
      'TBHQ',
      'Caramel color',
      'Disodium inosinate',
    ],
    title: 'Fresh miso ramen bowl',
    tagline: 'Miso broth, soft egg, crisp greens',
    totalMinutes: 15,
    servings: 2,
    accent: '#ef4444',
    ingredients: [
      '2 bundles fresh or dried ramen noodles',
      '3 cups low-sodium stock',
      '2 tbsp white miso',
      '1 tsp soy sauce',
      '1 clove garlic, grated',
      '1 tsp fresh ginger, grated',
      '2 eggs',
      '2 handfuls baby spinach',
      '2 green onions, sliced',
    ],
    steps: [
      {
        text: 'Lower the eggs into simmering water for a jammy yolk.',
        timerSeconds: 6 * 60 + 30,
        timerLabel: 'Soft eggs',
      },
      { text: 'Move the eggs to cold water. Peel when cool enough to handle.' },
      {
        text: 'Warm the stock with the garlic, ginger and soy sauce.',
        timerSeconds: 5 * 60,
        timerLabel: 'Broth',
      },
      { text: 'Take the broth off the heat and whisk in the miso. Do not boil it after this.' },
      {
        text: 'Cook the noodles in a separate pot of water.',
        timerSeconds: 3 * 60,
        timerLabel: 'Noodles',
      },
      { text: 'Divide noodles and spinach between bowls and ladle the hot broth over.' },
      { text: 'Top with a halved egg and green onions. Eat right away.' },
    ],
  },
  {
    id: 'granola-bar',
    product: 'Chewy granola bar',
    labelIngredients: [
      'Granola (rolled oats, brown sugar, rice crisp)',
      'Corn syrup',
      'Invert sugar',
      'Sugar',
      'Corn syrup solids',
      'Glycerin',
      'Sorbitol',
      'Palm kernel oil',
      'Soy lecithin',
      'Natural flavor',
      'BHT',
    ],
    unfamiliar: ['Invert sugar', 'Corn syrup solids', 'Glycerin', 'Sorbitol', 'BHT'],
    title: 'No-bake oat energy bites',
    tagline: 'Five ingredients, no oven, 10 minutes',
    totalMinutes: 10,
    servings: 12,
    accent: '#22c55e',
    ingredients: [
      '1 cup rolled oats',
      '1/2 cup peanut butter',
      '1/3 cup honey',
      '1/3 cup dark chocolate chips',
      '2 tbsp ground flaxseed',
      'Pinch of salt',
    ],
    steps: [
      { text: 'Stir the peanut butter and honey together in a bowl until glossy.' },
      { text: 'Add the oats, flaxseed, chocolate chips and salt. Mix until no dry oats remain.' },
      {
        text: 'Chill the mixture so it is easier to roll.',
        timerSeconds: 5 * 60,
        timerLabel: 'Chill',
      },
      { text: 'Roll into 12 bites, about one tablespoon each.' },
      { text: 'Eat now or keep in the fridge for up to a week.' },
    ],
  },
];

export function findXrRecipe(id: string | null | undefined): XrRecipe | undefined {
  return XR_RECIPES.find((recipe) => recipe.id === id);
}
