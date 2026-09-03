import assert from 'node:assert/strict';
import {
  DAYS,
  normalizeMealTypes,
  validateMealPlan,
  type MealType,
} from '../lib/meal-plan-validation';

const selectedMealTypes: MealType[] = ['breakfast', 'dinner'];

function validPlan() {
  const breakfastTitles = [
    'Banana oatmeal',
    'Berry yogurt bowl',
    'Spinach scrambled eggs',
    'Apple cinnamon quinoa',
    'Avocado tomato toast',
    'Peach chia pudding',
    'Vegetable breakfast hash',
  ];
  const dinnerTitles = [
    'Chicken broccoli rice bowl',
    'Turkey sweet potato skillet',
    'Lentil tomato stew',
    'Ginger tofu vegetable stir-fry',
    'Baked pork chops with green beans',
    'Black bean stuffed peppers',
    'Beef mushroom barley soup',
  ];

  return DAYS.map((day, index) => ({
    day,
    breakfast: {
      title: breakfastTitles[index],
      ingredients: ['1/2 cup rolled oats', '1 cup oat milk', '1 banana'],
      instructions: 'Simmer the oats and oat milk, then top with banana.',
      prepTime: '5 min',
      cookTime: '8 min',
      servings: 1,
      dietaryTags: ['vegetarian'],
      estimatedCalories: 350,
    },
    dinner: {
      title: dinnerTitles[index],
      ingredients: ['4 oz chicken breast', '1/2 cup brown rice', '1 cup broccoli'],
      instructions: 'Cook the chicken and rice. Steam the broccoli and combine.',
      prepTime: '10 min',
      cookTime: '20 min',
      servings: '1',
      dietaryTags: ['high protein'],
      estimatedCalories: '520',
    },
  }));
}

assert.deepEqual(normalizeMealTypes(['dinner', 'breakfast'], 4), ['breakfast', 'dinner']);
assert.deepEqual(normalizeMealTypes(undefined, 2), ['breakfast', 'dinner']);

const valid = validateMealPlan(validPlan(), {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: ['fish'],
});
assert.equal(valid.success, true);

const extraMeal = validPlan();
extraMeal[0] = {
  ...extraMeal[0],
  lunch: {
    title: 'Extra lunch',
    ingredients: ['bread'],
    instructions: 'Serve.',
    servings: 1,
  },
} as (typeof extraMeal)[number];
const extraResult = validateMealPlan(extraMeal, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.equal(extraResult.success, false);
assert.ok(!extraResult.success && extraResult.errors.some((error) => error.code === 'unexpected_meal'));

const wrongServing = validPlan();
wrongServing[1].dinner.servings = '2';
const servingResult = validateMealPlan(wrongServing, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.equal(servingResult.success, false);
assert.ok(!servingResult.success && servingResult.errors.some((error) => error.code === 'serving_mismatch'));

const unsafe = validPlan();
unsafe[2].dinner.ingredients.push('1 tbsp fish sauce');
const allergyResult = validateMealPlan(unsafe, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: ['fish'],
});
assert.equal(allergyResult.success, false);
assert.ok(!allergyResult.success && allergyResult.errors.some((error) => error.code === 'allergen_detected'));
assert.ok(!allergyResult.success && allergyResult.errors.some((error) =>
  error.code === 'allergen_detected' && error.day === 'wednesday' && error.mealType === 'dinner'
));

const preparedShortcutCases = [
  {
    title: 'Rotisserie chicken bowls',
    ingredients: ['4 oz chicken breast', '1 cup brown rice', '1 cup broccoli'],
    instructions: 'Cook the chicken and serve it over cooked rice and broccoli.',
  },
  {
    title: 'Chicken and potatoes',
    ingredients: ['4 oz chicken breast', '1 bag frozen mashed potatoes', '1 cup green beans'],
    instructions: 'Cook the chicken and reheat the frozen mashed potatoes.',
  },
  {
    title: 'Shortcut meatballs',
    ingredients: ['4 oz ground beef', '1 egg', '2 oz spaghetti'],
    instructions: 'Cook the meatballs, coat them with jarred prepared pasta sauce, and serve over spaghetti.',
  },
  {
    title: 'Quick pizza',
    ingredients: ['1 store-bought pizza dough', '2 tomatoes', '2 oz mozzarella'],
    instructions: 'Top the ready-made dough and bake.',
  },
];

preparedShortcutCases.forEach((shortcut, index) => {
  const plan = validPlan();
  plan[index].dinner = {
    ...plan[index].dinner,
    ...shortcut,
  };
  const result = validateMealPlan(plan, {
    mealTypes: selectedMealTypes,
    servings: 1,
    allergies: [],
  });
  assert.ok(!result.success && result.errors.some((error) =>
    error.code === 'prepared_shortcut'
      && error.day === DAYS[index]
      && error.mealType === 'dinner'
  ));
});

const ordinaryStaples = validPlan();
ordinaryStaples[0].breakfast.ingredients = [
  '1 plain flour tortilla',
  '1/2 cup canned black beans',
  '1/2 cup frozen bell peppers',
];
ordinaryStaples[0].breakfast.instructions = 'Warm the tortilla and beans. Cook the frozen peppers, then assemble.';
ordinaryStaples[0].dinner.ingredients = [
  '4 oz chicken breast',
  '1/2 cup canned tomatoes',
  '1 cup low-sodium broth',
  '1 tsp hot sauce',
];
ordinaryStaples[0].dinner.instructions = 'Cook the chicken, then simmer it with tomatoes, broth, and hot sauce.';
const ordinaryStaplesResult = validateMealPlan(ordinaryStaples, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.equal(ordinaryStaplesResult.success, true);

const exactDuplicate = validPlan();
exactDuplicate[2].dinner.title = exactDuplicate[0].dinner.title;
const exactDuplicateResult = validateMealPlan(exactDuplicate, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.ok(!exactDuplicateResult.success && exactDuplicateResult.errors.some((error) =>
  error.code === 'duplicate_meal'
    && error.day === 'wednesday'
    && error.mealType === 'dinner'
));

const minorTitleVariation = validPlan();
minorTitleVariation[0].dinner.title = 'Lemon herb roasted chicken and asparagus';
minorTitleVariation[3].dinner.title = 'Roasted lemon-herb chicken with asparagus';
const minorTitleVariationResult = validateMealPlan(minorTitleVariation, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.ok(!minorTitleVariationResult.success && minorTitleVariationResult.errors.some((error) =>
  error.code === 'duplicate_meal'
    && error.day === 'thursday'
    && error.mealType === 'dinner'
));

const distinctMeals = validPlan();
distinctMeals[0].dinner.title = 'Lemon herb roasted chicken and asparagus';
distinctMeals[1].dinner.title = 'Ginger chicken rice bowl with broccoli';
const distinctMealsResult = validateMealPlan(distinctMeals, {
  mealTypes: selectedMealTypes,
  servings: 1,
  allergies: [],
});
assert.equal(distinctMealsResult.success, true);

console.log('Meal-plan safety verification passed.');
