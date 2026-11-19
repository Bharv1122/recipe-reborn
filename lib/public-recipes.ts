// Public, search-indexable "homemade version of a packaged food" recipes.
// These are hand-written static pages (no AI call, no database) so they cost
// nothing to serve and can be crawled. Keep claims about packaged products
// general ("often contain"), never about a specific brand.

export type PublicRecipe = {
  slug: string;
  /** The packaged product this replaces, lower case, e.g. "taco seasoning packets". */
  replaces: string;
  title: string;
  description: string;
  /** Additives that packaged versions often list. General, not brand-specific. */
  oftenContains: string[];
  prepMinutes: number;
  cookMinutes: number;
  yield: string;
  ingredients: string[];
  steps: string[];
  tips: string[];
  category: 'Seasonings' | 'Sauces & dressings' | 'Meals' | 'Breakfast' | 'Snacks';
};

export const PUBLIC_RECIPES: PublicRecipe[] = [
  {
    slug: 'homemade-taco-seasoning',
    replaces: 'taco seasoning packets',
    title: 'Homemade Taco Seasoning',
    description:
      'A five-minute homemade taco seasoning made from spices you already own. One batch replaces a store-bought packet and seasons one pound of meat.',
    oftenContains: ['maltodextrin', 'silicon dioxide (anti-caking)', 'added sugar', 'modified corn starch'],
    prepMinutes: 5,
    cookMinutes: 0,
    yield: 'About 3 tablespoons (seasons 1 lb of meat)',
    ingredients: [
      '1 tablespoon chili powder',
      '1 1/2 teaspoons ground cumin',
      '1 teaspoon paprika',
      '1/2 teaspoon garlic powder',
      '1/2 teaspoon onion powder',
      '1/2 teaspoon dried oregano',
      '1/2 teaspoon fine salt',
      '1/4 teaspoon black pepper',
      'Pinch of cayenne pepper (optional)',
    ],
    steps: [
      'Measure all of the spices into a small bowl or jar.',
      'Stir or shake until evenly mixed.',
      'To use: brown 1 pound of ground meat, drain if needed, then add the seasoning and 1/2 cup water. Simmer 3 to 5 minutes until the liquid thickens.',
    ],
    tips: [
      'Make a triple batch and keep it in a sealed jar for up to 6 months.',
      'For a thicker sauce, stir 1 teaspoon cornstarch into the water before adding it.',
    ],
    category: 'Seasonings',
  },
  {
    slug: 'homemade-ranch-dressing',
    replaces: 'bottled ranch dressing',
    title: 'Homemade Ranch Dressing',
    description:
      'Creamy homemade ranch dressing with buttermilk, fresh herbs and garlic. Ready in ten minutes with no gums or preservatives.',
    oftenContains: ['soybean oil', 'monosodium glutamate', 'xanthan gum', 'calcium disodium EDTA', 'artificial flavor'],
    prepMinutes: 10,
    cookMinutes: 0,
    yield: 'About 1 1/4 cups',
    ingredients: [
      '1/2 cup mayonnaise',
      '1/2 cup sour cream or plain Greek yogurt',
      '1/4 cup buttermilk, plus more to thin',
      '1 small garlic clove, finely grated',
      '1 tablespoon chopped fresh chives',
      '1 tablespoon chopped fresh parsley',
      '1 teaspoon chopped fresh dill (or 1/2 teaspoon dried)',
      '1 teaspoon lemon juice',
      '1/4 teaspoon onion powder',
      '1/4 teaspoon fine salt',
      'Black pepper to taste',
    ],
    steps: [
      'Whisk the mayonnaise, sour cream and buttermilk in a bowl until smooth.',
      'Stir in the garlic, herbs, lemon juice, onion powder, salt and pepper.',
      'Add more buttermilk a tablespoon at a time until it is as thin as you like.',
      'Chill for at least 30 minutes so the flavors blend.',
    ],
    tips: [
      'Keeps in a sealed jar in the refrigerator for up to 5 days.',
      'No buttermilk? Stir 1 teaspoon lemon juice into 1/4 cup milk and let it sit 5 minutes.',
    ],
    category: 'Sauces & dressings',
  },
  {
    slug: 'homemade-mac-and-cheese',
    replaces: 'boxed macaroni and cheese',
    title: 'Homemade Stovetop Mac and Cheese',
    description:
      'Stovetop mac and cheese made with real cheddar, milk and butter. One pot, about twenty minutes, and no powdered cheese packet.',
    oftenContains: ['artificial color (Yellow 5, Yellow 6)', 'sodium phosphate', 'modified food starch', 'whey powder'],
    prepMinutes: 5,
    cookMinutes: 15,
    yield: '4 servings',
    ingredients: [
      '8 oz elbow macaroni',
      '2 tablespoons butter',
      '2 tablespoons all-purpose flour',
      '1 1/2 cups whole milk',
      '2 cups (8 oz) sharp cheddar, freshly grated',
      '1/2 teaspoon fine salt',
      '1/4 teaspoon mustard powder (optional)',
      'Pinch of paprika',
    ],
    steps: [
      'Cook the macaroni in salted boiling water until just tender. Drain.',
      'In the same pot, melt the butter over medium heat. Whisk in the flour and cook 1 minute.',
      'Slowly whisk in the milk. Simmer, stirring, 3 to 4 minutes until it coats a spoon.',
      'Take the pot off the heat. Stir in the cheddar a handful at a time until melted, then the salt, mustard powder and paprika.',
      'Fold in the macaroni and serve right away.',
    ],
    tips: [
      'Grate the cheese yourself. Pre-shredded cheese is coated to stop clumping and melts grainy.',
      'Add the cheese off the heat so the sauce stays smooth.',
    ],
    category: 'Meals',
  },
  {
    slug: 'homemade-cream-of-mushroom-soup',
    replaces: 'canned condensed cream of mushroom soup',
    title: 'Homemade Condensed Cream of Mushroom Soup',
    description:
      'A homemade substitute for one can of condensed cream of mushroom soup. Use it in casseroles and slow-cooker recipes, cup for cup.',
    oftenContains: ['modified food starch', 'monosodium glutamate', 'soy protein concentrate', 'yeast extract', 'vegetable oil'],
    prepMinutes: 5,
    cookMinutes: 15,
    yield: 'About 1 1/4 cups (replaces one 10.5 oz can)',
    ingredients: [
      '2 tablespoons butter',
      '4 oz mushrooms, finely chopped',
      '1 small garlic clove, minced',
      '3 tablespoons all-purpose flour',
      '1/2 cup chicken or vegetable broth',
      '1/2 cup whole milk',
      '1/4 teaspoon fine salt',
      'Black pepper to taste',
    ],
    steps: [
      'Melt the butter in a saucepan over medium heat. Add the mushrooms and cook 5 to 6 minutes until browned and their liquid has cooked off.',
      'Add the garlic and cook 30 seconds.',
      'Stir in the flour and cook 1 minute.',
      'Slowly whisk in the broth, then the milk. Simmer, stirring, 3 to 5 minutes until very thick.',
      'Season with salt and pepper. Use right away in place of one can, or cool and refrigerate.',
    ],
    tips: [
      'Keeps 4 days in the refrigerator. It thickens as it cools, like the canned kind.',
      'Leave out the mushrooms and use all broth for a cream of chicken substitute.',
    ],
    category: 'Meals',
  },
  {
    slug: 'homemade-pancake-mix',
    replaces: 'boxed pancake mix',
    title: 'Homemade Pancake Mix',
    description:
      'A pantry pancake mix made from flour, baking powder, sugar and salt. Mix a big batch once, then make fluffy pancakes any morning.',
    oftenContains: ['partially hydrogenated oil', 'dextrose', 'sodium aluminum phosphate', 'artificial flavor'],
    prepMinutes: 5,
    cookMinutes: 10,
    yield: 'Mix for about 24 pancakes (3 batches)',
    ingredients: [
      'For the mix: 3 cups all-purpose flour',
      '3 tablespoons sugar',
      '2 tablespoons baking powder',
      '1 teaspoon fine salt',
      'For each batch of 8 pancakes: 1 cup mix',
      '1 egg',
      '3/4 cup milk',
      '2 tablespoons melted butter or oil',
    ],
    steps: [
      'Whisk the flour, sugar, baking powder and salt together. Store in a sealed jar.',
      'For one batch, whisk 1 egg, 3/4 cup milk and the melted butter in a bowl.',
      'Add 1 cup of mix and stir until just combined. A few lumps are fine.',
      'Cook 1/4 cup portions on a lightly greased pan over medium heat, about 2 minutes per side, flipping when bubbles form.',
    ],
    tips: [
      'The dry mix keeps 3 months in the pantry.',
      'Rest the batter 5 minutes before cooking for fluffier pancakes.',
    ],
    category: 'Breakfast',
  },
  {
    slug: 'homemade-bbq-sauce',
    replaces: 'bottled barbecue sauce',
    title: 'Homemade BBQ Sauce',
    description:
      'A tangy, lightly sweet homemade BBQ sauce that simmers in fifteen minutes. Sweetened with a little honey or maple instead of corn syrup.',
    oftenContains: ['high fructose corn syrup', 'modified corn starch', 'caramel color', 'sodium benzoate', 'natural smoke flavor'],
    prepMinutes: 5,
    cookMinutes: 15,
    yield: 'About 1 1/2 cups',
    ingredients: [
      '1 cup tomato sauce (plain, no salt added)',
      '2 tablespoons tomato paste',
      '3 tablespoons apple cider vinegar',
      '3 tablespoons honey or maple syrup',
      '1 tablespoon Worcestershire sauce',
      '1 teaspoon smoked paprika',
      '1/2 teaspoon garlic powder',
      '1/2 teaspoon onion powder',
      '1/2 teaspoon fine salt',
      '1/4 teaspoon black pepper',
    ],
    steps: [
      'Whisk everything together in a small saucepan.',
      'Bring to a gentle simmer over medium heat.',
      'Simmer 12 to 15 minutes, stirring now and then, until thick enough to coat a spoon.',
      'Taste and adjust: more vinegar for tang, more honey for sweetness.',
    ],
    tips: [
      'Keeps 2 weeks in a sealed jar in the refrigerator.',
      'Brush it on in the last few minutes of grilling so the sugars do not burn.',
    ],
    category: 'Sauces & dressings',
  },
  {
    slug: 'homemade-chicken-nuggets',
    replaces: 'frozen chicken nuggets',
    title: 'Homemade Baked Chicken Nuggets',
    description:
      'Crispy baked chicken nuggets made from whole chicken breast and a simple breadcrumb coating. Freezer-friendly, so they are as easy as the boxed kind.',
    oftenContains: ['sodium phosphates', 'modified food starch', 'dextrose', 'soybean oil', 'natural flavors'],
    prepMinutes: 15,
    cookMinutes: 18,
    yield: '4 servings (about 30 nuggets)',
    ingredients: [
      '1 lb boneless, skinless chicken breast, cut into 1-inch pieces',
      '1/3 cup all-purpose flour',
      '2 eggs, beaten',
      '1 cup breadcrumbs (panko for extra crunch)',
      '1/4 cup grated Parmesan (optional)',
      '1/2 teaspoon garlic powder',
      '1/2 teaspoon paprika',
      '1/2 teaspoon fine salt',
      'Olive oil or cooking spray',
    ],
    steps: [
      'Heat the oven to 425°F (220°C). Line a baking sheet and brush it lightly with oil.',
      'Set up three bowls: flour; beaten eggs; breadcrumbs mixed with the Parmesan, garlic powder, paprika and salt.',
      'Coat each piece of chicken in flour, then egg, then the breadcrumb mixture. Place on the baking sheet.',
      'Drizzle or spray the tops lightly with oil.',
      'Bake 16 to 18 minutes, turning once, until golden and the chicken reaches 165°F (74°C) inside.',
    ],
    tips: [
      'To freeze: bake, cool, then freeze on a tray before bagging. Reheat from frozen at 400°F for 10 to 12 minutes.',
      'Wash hands, boards and bowls after handling raw chicken.',
    ],
    category: 'Meals',
  },
  {
    slug: 'homemade-italian-dressing',
    replaces: 'bottled Italian dressing',
    title: 'Homemade Italian Dressing',
    description:
      'A bright homemade Italian dressing with olive oil, red wine vinegar and dried herbs. Shake it in a jar in five minutes.',
    oftenContains: ['soybean oil', 'high fructose corn syrup', 'xanthan gum', 'calcium disodium EDTA', 'artificial color'],
    prepMinutes: 5,
    cookMinutes: 0,
    yield: 'About 3/4 cup',
    ingredients: [
      '1/2 cup extra virgin olive oil',
      '3 tablespoons red wine vinegar',
      '1 tablespoon lemon juice',
      '1 small garlic clove, finely grated',
      '1 teaspoon dried oregano',
      '1/2 teaspoon dried basil',
      '1/2 teaspoon Dijon mustard',
      '1/2 teaspoon honey (optional)',
      '1/2 teaspoon fine salt',
      '1/4 teaspoon black pepper',
    ],
    steps: [
      'Put everything in a jar with a tight lid.',
      'Shake hard for 20 to 30 seconds until blended.',
      'Taste on a leaf of lettuce and adjust the salt or vinegar.',
    ],
    tips: [
      'Keeps 1 week in the refrigerator. Olive oil firms up when cold, so let it sit out 10 minutes and shake again.',
      'It doubles as a marinade for chicken or vegetables.',
    ],
    category: 'Sauces & dressings',
  },
  {
    slug: 'homemade-onion-soup-mix',
    replaces: 'dry onion soup mix packets',
    title: 'Homemade Onion Soup Mix',
    description:
      'A homemade dry onion soup mix that replaces one store-bought packet in dips, roasts, meatloaf and slow-cooker recipes.',
    oftenContains: ['maltodextrin', 'hydrolyzed soy protein', 'caramel color', 'disodium inosinate', 'corn syrup solids'],
    prepMinutes: 5,
    cookMinutes: 0,
    yield: 'About 1/4 cup (replaces 1 packet)',
    ingredients: [
      '3 tablespoons dried minced onion',
      '1 teaspoon onion powder',
      '1/2 teaspoon garlic powder',
      '1/2 teaspoon dried parsley',
      '1/4 teaspoon celery seed (optional)',
      '1/4 teaspoon paprika',
      '1/4 teaspoon black pepper',
      '1/2 teaspoon fine salt',
    ],
    steps: [
      'Stir everything together in a small bowl.',
      'Use in place of one packet. For a savory base, add it along with 1 cup of low-sodium beef or vegetable broth.',
      'For onion dip, stir the full batch into 2 cups of sour cream and chill 1 hour.',
    ],
    tips: [
      'Packets usually include bouillon, so recipes may need a little extra salt or broth to match.',
      'Store in a sealed jar for up to 6 months.',
    ],
    category: 'Seasonings',
  },
  {
    slug: 'homemade-granola-bars',
    replaces: 'packaged granola bars',
    title: 'Homemade Chewy Granola Bars',
    description:
      'No-bake chewy granola bars with oats, nut butter and honey. Seven ingredients, one bowl, and they hold together in a lunchbox.',
    oftenContains: ['corn syrup', 'soy lecithin', 'BHT (preservative)', 'palm kernel oil', 'natural flavor'],
    prepMinutes: 15,
    cookMinutes: 0,
    yield: '12 bars',
    ingredients: [
      '2 1/2 cups rolled oats',
      '1/2 cup peanut butter or other nut or seed butter',
      '1/2 cup honey',
      '1/4 cup butter or coconut oil',
      '1 teaspoon vanilla extract',
      '1/4 teaspoon fine salt',
      '1/2 cup add-ins: chocolate chips, chopped nuts or dried fruit',
    ],
    steps: [
      'Line an 8-inch square pan with parchment, leaving extra over the sides.',
      'Warm the nut butter, honey and butter in a saucepan over low heat, stirring, until smooth and just bubbling. Take off the heat and stir in the vanilla and salt.',
      'Stir in the oats until fully coated. Let cool 5 minutes, then fold in the add-ins.',
      'Press the mixture very firmly into the pan with the back of a spoon.',
      'Chill at least 2 hours, then lift out and cut into 12 bars.',
    ],
    tips: [
      'Pressing hard is what keeps the bars from crumbling.',
      'Store in the refrigerator up to 1 week, or freeze up to 3 months.',
      'Honey is not safe for babies under 12 months.',
    ],
    category: 'Snacks',
  },
  {
    slug: 'homemade-coffee-creamer',
    replaces: 'flavored liquid coffee creamer',
    title: 'Homemade Vanilla Coffee Creamer',
    description:
      'A three-ingredient homemade vanilla coffee creamer made with real milk and cream. No oils, gums or artificial flavor.',
    oftenContains: ['vegetable oil', 'corn syrup solids', 'dipotassium phosphate', 'carrageenan', 'artificial flavor'],
    prepMinutes: 5,
    cookMinutes: 0,
    yield: 'About 2 cups',
    ingredients: [
      '1 cup half-and-half (or 1/2 cup milk plus 1/2 cup cream)',
      '1 cup whole milk',
      '3 tablespoons maple syrup or sugar, to taste',
      '2 teaspoons vanilla extract',
      'Pinch of salt',
    ],
    steps: [
      'Pour everything into a jar with a tight lid.',
      'Shake until the sweetener dissolves. If using sugar, warm 1/4 cup of the milk first to help it dissolve.',
      'Refrigerate and shake before each use.',
    ],
    tips: [
      'Use it within 7 days, or by the date on your milk, whichever is sooner.',
      'Swap the vanilla for 1/2 teaspoon cinnamon, or add 1 tablespoon cocoa powder for mocha.',
    ],
    category: 'Breakfast',
  },
  {
    slug: 'homemade-ramen-seasoning',
    replaces: 'instant ramen flavor packets',
    title: 'Homemade Ramen Seasoning',
    description:
      'A homemade ramen seasoning blend to use instead of the flavor packet. Mix it once and season a bowl of noodles in seconds.',
    oftenContains: ['monosodium glutamate', 'disodium guanylate', 'TBHQ (preservative)', 'hydrolyzed corn protein', 'maltodextrin'],
    prepMinutes: 5,
    cookMinutes: 0,
    yield: 'About 6 servings',
    ingredients: [
      '2 tablespoons garlic powder',
      '2 tablespoons onion powder',
      '1 tablespoon ground ginger',
      '1 tablespoon dried parsley or chives',
      '2 teaspoons black pepper',
      '2 teaspoons fine salt',
      '1 teaspoon ground turmeric (optional, for color)',
      'To serve: low-sodium broth and a splash of soy sauce',
    ],
    steps: [
      'Mix all of the dried seasonings and store in a sealed jar.',
      'For one bowl, bring 2 cups of low-sodium chicken or vegetable broth to a boil and cook the noodles in it.',
      'Stir in 2 teaspoons of the seasoning and 1 teaspoon of soy sauce. Taste and add more if you like.',
    ],
    tips: [
      'Add a soft-boiled egg, sliced scallions or frozen vegetables to make it a meal.',
      'The blend keeps 6 months in the pantry.',
    ],
    category: 'Seasonings',
  },
];

export function getPublicRecipe(slug: string): PublicRecipe | undefined {
  return PUBLIC_RECIPES.find((recipe) => recipe.slug === slug);
}

/** ISO 8601 duration for schema.org, e.g. 15 -> "PT15M". */
export function isoMinutes(minutes: number): string {
  return `PT${minutes}M`;
}
