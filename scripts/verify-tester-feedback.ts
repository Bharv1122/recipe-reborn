import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findBlockedFoodInRecipe } from '../lib/food-preferences';
import { resolveMealPlanPreferences } from '../lib/meal-plan-preferences';
import { removeFromLibraryUpdate, saveToLibraryUpdate } from '../lib/recipe-library';
import { validateMeal } from '../lib/meal-plan-validation';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFile(new URL(path, root), 'utf8');

function recipe(ingredients: string[], instructions = 'Cook and serve.') {
  return { title: 'Test meal', ingredients, instructions, prepTime: '5 min', cookTime: '15 min', servings: 2, dietaryTags: [], estimatedCalories: 400 };
}

async function main() {
  for (const phrase of ['PORK chops', 'crispy bacon', 'sliced ham', 'pancetta']) {
    assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [phrase], instructions: '' }, ['pork'], 'dislike'), 'pork');
  }
  for (const phrase of ['turkey bacon', 'beef bacon', 'plant bacon', 'plant-based ham', 'vegan ham']) {
    assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [phrase], instructions: '' }, ['pork'], 'dislike'), null, phrase);
  }
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['turkey bacon', 'pork chops'], instructions: '' }, ['pork'], 'dislike'), 'pork');
  for (const phrase of ['chicken thigh', 'Chicken Thighs', 'chicken-thigh pieces']) {
    assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [phrase], instructions: '' }, ['chicken thighs'], 'dislike'), 'chicken thighs');
  }
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['chicken breast'], instructions: '' }, ['chicken thighs'], 'dislike'), null);
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['fresh coriander leaves'], instructions: '' }, ['cilantro'], 'dislike'), 'cilantro');
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['1 tsp coriander seed'], instructions: '' }, ['cilantro'], 'dislike'), null);
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['1 tsp fresh coriander seed'], instructions: '' }, ['cilantro'], 'dislike'), null);
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [], instructions: 'Without skin, add chicken thighs and roast.' }, ['chicken thighs'], 'dislike'), 'chicken thighs');
  assert.equal(findBlockedFoodInRecipe({ title: 'Chicken dinner', ingredients: ['2 pounds boneless chicken'], instructions: 'Season the thighs and roast.' }, ['chicken thighs'], 'dislike'), 'chicken thighs');
  assert.equal(findBlockedFoodInRecipe({ title: 'Chicken breast', ingredients: ['2 chicken breasts'], instructions: 'Do not use thighs.' }, ['chicken thighs'], 'dislike'), null);
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [], instructions: 'No need to chop feta; crumble it over the top.' }, ['feta'], 'dislike'), 'feta');
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: [], instructions: 'Serve without feta.' }, ['feta'], 'dislike'), null);
  assert.equal(findBlockedFoodInRecipe({ title: 'Meal', ingredients: ['1 bell pepper'], instructions: '' }, ['bell peppers'], 'dislike'), 'bell peppers');

  const unsafeDirections = validateMeal(recipe(['1 cup rice'], 'Fold in chopped bacon before serving.'), { servings: 2, allergies: [], dislikedIngredients: ['pork'] });
  assert.equal(unsafeDirections.success, false);
  if (!unsafeDirections.success) assert.equal(unsafeDirections.error.code, 'disliked_ingredient');
  const safeGranularity = validateMeal(recipe(['8 oz chicken breast']), { servings: 2, allergies: [], dislikedIngredients: ['chicken thighs'] });
  assert.equal(safeGranularity.success, true);

  const profile = { allergies: ['Shellfish'], dislikedIngredients: ['cilantro'] };
  assert.deepEqual(resolveMealPlanPreferences(profile, {}), profile, 'Omitted overrides inherit Account defaults.');
  assert.deepEqual(resolveMealPlanPreferences(profile, { allergies: [], dislikedIngredients: [] }), { allergies: ['Shellfish'], dislikedIngredients: [] }, 'Empty allergies cannot weaken Account safety; empty dislikes are a one-plan clear.');
  assert.deepEqual(resolveMealPlanPreferences(profile, { allergies: ['Peanuts', 'shellfish'] }), { allergies: ['Shellfish', 'Peanuts'], dislikedIngredients: ['cilantro'] }, 'Plan allergies may only add, case-insensitively.');

  const originalDate = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(saveToLibraryUpdate(originalDate, 'generated').savedAt, originalDate, 'Repeated Save must be idempotent.');
  assert.equal(saveToLibraryUpdate(null, 'meal_plan').librarySource, 'generated');
  assert.deepEqual(removeFromLibraryUpdate(), { savedAt: null });
  const graph: { recipe: { savedAt: Date | null }; planRecipeIds: string[]; collectionRecipeIds: string[] } = {
    recipe: { savedAt: originalDate }, planRecipeIds: ['r1'], collectionRecipeIds: ['r1'],
  };
  graph.recipe = { ...graph.recipe, ...removeFromLibraryUpdate() };
  assert.deepEqual(graph.planRecipeIds, ['r1']);
  assert.deepEqual(graph.collectionRecipeIds, ['r1']);

  const [planRoute, replacementRoute, webList, mobileList, mobileSave, bulkRoute, prefsRoute, webAccount, mobileAccount, mobilePlans, authProvider, webCollectionAdd, mobileCollectionAdd, guestHandoff] = await Promise.all([
    source('app/api/meal-plans/generate/route.ts'),
    source('app/api/meal-plans/[id]/recipes/[recipeId]/replace/route.ts'),
    source('app/api/recipes/route.ts'),
    source('app/api/mobile/recipes/route.ts'),
    source('app/api/mobile/recipes/route.ts'),
    source('app/api/recipes/library/route.ts'),
    source('app/api/user/preferences/route.ts'),
    source('app/account/page.tsx'),
    source('mobile/src/app/(tabs)/account.tsx'),
    source('mobile/src/app/meal-plans/index.tsx'),
    source('mobile/src/providers/auth-provider.tsx'),
    source('app/api/collections/[id]/recipes/route.ts'),
    source('app/api/mobile/collections/[id]/recipes/route.ts'),
    source('lib/guest-recipe-handoff.ts'),
  ]);
  for (const route of [planRoute, replacementRoute]) {
    assert.match(route, /savedAt:\s*null/);
    assert.match(route, /librarySource:\s*'meal_plan'/);
  }
  assert.match(planRoute, /allergies:\s*z\.array\([^\n]+\.optional\(\)/);
  assert.match(planRoute, /dislikedIngredients:\s*z\.array\([^\n]+\.optional\(\)/);
  assert.doesNotMatch(planRoute, /(?:allergies|dislikedIngredients):[^\n]*nullable\(/, 'Null plan overrides must be rejected, not treated as an unsafe clear.');
  for (const route of [webList, mobileList]) assert.match(route, /savedAt:\s*\{\s*not:\s*null\s*\}/);
  assert.match(bulkRoute, /updateMany/);
  assert.match(bulkRoute, /userId/);
  assert.doesNotMatch(bulkRoute, /\.delete/);
  for (const collectionRoute of [webCollectionAdd, mobileCollectionAdd]) {
    assert.match(collectionRoute, /userId/);
    assert.doesNotMatch(collectionRoute, /savedAt\s*:/, 'Collection membership must not resave or unsave a recipe.');
  }
  assert.doesNotMatch(mobileSave, /findBlockedFood|validateMeal/, 'A faithful imported recipe remains explicitly saveable after its warning.');
  assert.doesNotMatch(guestHandoff, /tx\.recipe\.(?:create|update)/);
  assert.doesNotMatch(guestHandoff, /savedAt|librarySource/);
  assert.match(prefsRoute, /getRequestUserId/);
  assert.match(prefsRoute, /hasOwnProperty/);
  assert.match(prefsRoute, /likedIngredients/);
  assert.match(webAccount, /prefsDirty/);
  assert.match(mobileAccount, /preferencesDirty/);
  assert.match(mobileAccount, /refreshAccount\(\)/);
  assert.match(mobilePlans, /preferencesDirty/);
  assert.match(mobilePlans, /refreshAccount\(\)/);
  assert.match(authProvider, /AppState\.addEventListener/);
  assert.match(authProvider, /refreshAccount\(\)/);
  assert.doesNotMatch(`${webAccount}\n${mobileAccount}\n${mobilePlans}`, /blocked by recipe safety checks/i);

  console.log('Tester-feedback verification passed: preference aliases/final validation, saved-library separation, non-destructive bulk removal, bearer preference API, likes, and hydration guards.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
