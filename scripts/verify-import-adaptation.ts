import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildImportAdaptationPrompt,
  parseAdaptedImportOutput,
  validateAdaptedImport,
  type AppliedFoodPreferences,
  type ImportedRecipeSnapshot,
} from '../lib/import-recipe-adaptation';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFile(new URL(path, root), 'utf8');

const imported: ImportedRecipeSnapshot = {
  title: 'Pork and Chicken Supper',
  freshIngredients: ['2 pork chops', '4 chicken thighs', '1/2 cup fresh cilantro leaves', '1 cup rice'],
  instructions: ['Brown the pork chops.', 'Roast the chicken thighs for 30 minutes.', 'Fold in the cilantro and rice.'],
  prepTime: '15 minutes', cookTime: '35 minutes', servings: '4', dietaryTags: [],
};
const preferences: AppliedFoodPreferences = { allergies: ['peanut'], dislikes: [], likes: [] };

async function main() {
  const originalJson = JSON.stringify(imported);
  const substitutionRequest = {
    recipe: imported,
    action: { type: 'substitute' as const, original: '4 chicken thighs', substitute: '4 chicken breasts' },
  };
  const breastVersion: ImportedRecipeSnapshot = {
    ...imported,
    freshIngredients: ['2 pork chops', '4 chicken breasts', '1/2 cup fresh cilantro leaves', '1 cup rice'],
    instructions: ['Brown the pork chops.', 'Roast the chicken breasts for 22 minutes.', 'Fold in the cilantro and rice.'],
    cookTime: '27 minutes',
  };
  assert.deepEqual(validateAdaptedImport(breastVersion, substitutionRequest, preferences), breastVersion);
  assert.equal(JSON.stringify(imported), originalJson, 'Validation must never mutate the faithful source draft.');
  assert.throws(() => validateAdaptedImport({ ...breastVersion, instructions: imported.instructions }, substitutionRequest, preferences), /replaced ingredient still appears/);

  const sausageLine = '1 pound Italian sausage (pork or chicken), cut into 1-inch pieces';
  const sausageSource = { ...imported, freshIngredients: [sausageLine, '1 pound potatoes, cut into 1-inch pieces', '2 bell peppers'], instructions: ['Roast the Italian sausage, potatoes and peppers.'] };
  const sausageRequest = { recipe: sausageSource, action: { type: 'substitute' as const, original: sausageLine, substitute: 'ground beef' } };
  const beefVersion = { ...sausageSource, freshIngredients: ['1 pound ground beef', '1 pound potatoes, cut into 1-inch pieces', '2 bell peppers, cut into inch pieces'], instructions: ['Brown the ground beef. Roast the potatoes and peppers.'] };
  assert.deepEqual(validateAdaptedImport(beefVersion, sausageRequest, preferences), beefVersion);
  for (const substitute of ['Ground beef with Italian seasoning', 'Ground beef (seasoned with fennel, garlic, and paprika)']) {
    assert.deepEqual(validateAdaptedImport(beefVersion, { ...sausageRequest, action: { ...sausageRequest.action, substitute } }, preferences), beefVersion);
  }
  for (const substitute of ['Ground beef with Italian sausage seasoning', 'Ground beef (seasoned with Italian sausage spices)']) {
    const request = { ...sausageRequest, action: { ...sausageRequest.action, substitute } };
    assert.deepEqual(validateAdaptedImport(beefVersion, request, preferences), beefVersion);
    assert.throws(() => validateAdaptedImport({ ...beefVersion, freshIngredients: [...beefVersion.freshIngredients, sausageLine] }, request, preferences), /replaced ingredient still appears/);
    assert.throws(() => validateAdaptedImport({ ...beefVersion, instructions: sausageSource.instructions }, request, preferences), /replaced ingredient still appears/);
  }
  for (const [substitute, ingredient] of [['Tofu, pressed and cubed', '14 oz firm tofu, cubed'], ['Greek yogurt (plain)', '1 cup Greek yogurt']]) {
    const candidate = { ...beefVersion, freshIngredients: [ingredient], instructions: ['Cook gently.'] };
    assert.deepEqual(validateAdaptedImport(candidate, { ...sausageRequest, action: { ...sausageRequest.action, substitute } }, preferences), candidate);
  }
  const almondVersion = { ...beefVersion, freshIngredients: ['1 cup almond flour'], instructions: ['Stir in the almond flour.'] };
  assert.deepEqual(validateAdaptedImport(almondVersion, { ...sausageRequest, action: { ...sausageRequest.action, substitute: 'flour (almond)' } }, preferences), almondVersion);
  const turkey = { ...beefVersion, freshIngredients: ['1 pound Italian turkey sausage', '2 bell peppers'], instructions: ['Cook the turkey sausage and peppers.'] };
  assert.deepEqual(validateAdaptedImport(turkey, { ...sausageRequest, action: { ...sausageRequest.action, substitute: 'Turkey Italian sausage' } }, preferences), turkey);
  assert.throws(() => validateAdaptedImport({ ...beefVersion, freshIngredients: ['1 pound chicken', '1 tsp Italian seasoning'] }, { ...sausageRequest, action: { ...sausageRequest.action, substitute: 'ground beef with Italian seasoning' } }, preferences), /substitute is missing/);
  assert.throws(() => validateAdaptedImport({ ...beefVersion, freshIngredients: ['1 cup wheat flour', '1 cup almonds'] }, { ...sausageRequest, action: { ...sausageRequest.action, substitute: 'flour (almond)' } }, preferences), /substitute is missing/);
  assert.throws(() => validateAdaptedImport({ ...beefVersion, freshIngredients: ['1 cup milk with coconut oil'] }, { ...sausageRequest, action: { ...sausageRequest.action, substitute: 'coconut milk' } }, preferences), /substitute is missing/);
  assert.throws(() => validateAdaptedImport({ ...beefVersion, instructions: sausageSource.instructions }, sausageRequest, preferences), /replaced ingredient still appears/);
  const chickenLine = '4 oz boneless, skinless chicken breast, cut into strips';
  const chickenSource = { ...imported, freshIngredients: [chickenLine, '1 cup rice'], instructions: ['Cook the chicken breast. Serve with rice.'] };
  const tofuRequest = { recipe: chickenSource, action: { type: 'substitute' as const, original: chickenLine, substitute: 'tofu' } };
  const tofuVersion = { ...chickenSource, freshIngredients: ['4 oz tofu', '1 cup rice'], instructions: ['Cook the tofu. Serve with rice.'] };
  assert.deepEqual(validateAdaptedImport(tofuVersion, tofuRequest, preferences), tofuVersion);
  assert.throws(() => validateAdaptedImport({ ...tofuVersion, instructions: chickenSource.instructions }, tofuRequest, preferences), /replaced ingredient still appears/);
  const flourSource = { ...imported, freshIngredients: ['1 cup flour (almond)', '2 tbsp coconut flour'], instructions: ['Mix the flours.'] };
  const flourRemoved = { ...flourSource, freshIngredients: ['2 tbsp coconut flour'], instructions: ['Use the coconut flour.'] };
  assert.deepEqual(validateAdaptedImport(flourRemoved, { recipe: flourSource, action: { type: 'remove', original: '1 cup flour (almond)' } }, preferences), flourRemoved);

  const butterSource: ImportedRecipeSnapshot = { ...imported, freshIngredients: ['2 tbsp butter', '1 cup rice'], instructions: ['Melt the butter.', 'Stir in the rice.'] };
  const peanutButterRequest = { recipe: butterSource, action: { type: 'substitute' as const, original: '2 tbsp butter', substitute: '2 tbsp peanut butter' } };
  const peanutButterVersion = { ...butterSource, freshIngredients: ['2 tbsp peanut butter', '1 cup rice'], instructions: ['Warm the peanut butter.', 'Stir in the rice.'] };
  assert.deepEqual(validateAdaptedImport(peanutButterVersion, peanutButterRequest, { allergies: [], dislikes: [], likes: [] }), peanutButterVersion, 'Shared words in a substitute must not cause a false old-reference rejection.');

  assert.throws(() => validateAdaptedImport({ ...peanutButterVersion, freshIngredients: ['1 cup butternut squash', '2 tbsp butter'], instructions: ['Cook the butternut squash in butter.'] }, { ...peanutButterRequest, action: { ...peanutButterRequest.action, substitute: 'butternut squash' } }, preferences), /replaced ingredient still appears/, 'A partial word must not bypass removal of the original ingredient.');

  const removeRequest = { recipe: imported, action: { type: 'remove' as const, original: '1/2 cup fresh cilantro leaves' } };
  const noCilantro = { ...imported, freshIngredients: imported.freshIngredients.filter((item) => !item.includes('cilantro')), instructions: ['Brown the pork chops.', 'Roast the chicken thighs for 30 minutes.', 'Serve with rice.'] };
  assert.deepEqual(validateAdaptedImport(noCilantro, removeRequest, preferences), noCilantro);
  assert.throws(() => validateAdaptedImport({ ...noCilantro, instructions: imported.instructions }, removeRequest, preferences), /removed ingredient still appears/);

  const preferenceRequest = { recipe: imported, action: { type: 'preferences' as const, oneRecipeDiet: '' } };
  const preferenceRules = { allergies: ['peanut'], dislikes: ['pork', 'chicken thighs', 'cilantro'], likes: ['lemon'] };
  const preferenceVersion = { ...imported, title: 'Lemon Chicken Breast Supper', freshIngredients: ['4 chicken breasts', '1 lemon', '1 cup rice'], instructions: ['Roast the chicken breasts with lemon.', 'Serve with rice.'] };
  assert.deepEqual(validateAdaptedImport(preferenceVersion, preferenceRequest, preferenceRules), preferenceVersion);
  assert.throws(() => validateAdaptedImport(imported, preferenceRequest, preferenceRules), /disliked ingredient/);
  assert.throws(() => validateAdaptedImport({ ...preferenceVersion, freshIngredients: [...preferenceVersion.freshIngredients, '1 tbsp peanut oil'] }, preferenceRequest, preferenceRules), /saved allergy/);

  assert.equal(parseAdaptedImportOutput({ status: 'cannot_adapt', reason: 'Removing the only main ingredient would make a different dish.' }).status, 'cannot_adapt');
  const prompt = buildImportAdaptationPrompt(imported, removeRequest.action, preferences);
  assert.match(prompt, /cannot_adapt/);
  assert.match(prompt, /must not remain anywhere/);
  assert.match(prompt, /basic grocery ingredients/);

  const [route, webDraft, webSaved, mobileDraft, mobileSaved, mobileService, webSave, mobileSave, migration, webNutrition, webPresentation, mobileComparison] = await Promise.all([
    source('app/api/import-recipe/adapt/route.ts'),
    source('app/generator/_components/recipe-generator.tsx'),
    source('app/recipes/_components/recipe-detail-modal.tsx'),
    source('mobile/src/app/import-recipe.tsx'),
    source('mobile/src/app/recipes/[id].tsx'),
    source('mobile/src/services/recipe-import.ts'),
    source('app/api/recipes/route.ts'),
    source('app/api/mobile/recipes/route.ts'),
    source('prisma/migrations/20261002180000_add_import_source_snapshot/migration.sql'),
    source('app/generator/_components/nutrition-comparison.tsx'),
    source('components/recipe-presentation.tsx'),
    source('mobile/src/components/recipe-comparison.tsx'),
  ]);
  assert.match(route, /getRequestUserId/);
  assert.match(route, /attempt\s*<\s*2/);
  assert.match(route, /only ingredient/);
  assert.match(route, /request\.signal/);
  assert.match(route, /quotaUsed:\s*false/);
  assert.doesNotMatch(route, /generationCount|prisma\.recipe\.(?:create|update|delete)/, 'Adaptation must not charge quota or save a partial draft.');
  for (const client of [webDraft]) {
    assert.match(client, /Substitute/);
    assert.match(client, /Remove/);
    assert.match(client, /Apply my preferences/);
    assert.match(client, /Revert to imported source/);
    assert.match(client, /Cancel adaptation/);
  }
  for (const savedClient of [webSaved]) {
    assert.match(savedClient, /Save Adapted Copy|Save adapted copy/);
    assert.match(savedClient, /original.*unchanged|original recipe.*unchanged/is);
    assert.match(savedClient, /source revert is unavailable/);
  }
  assert.match(webSaved, /sourceHasDirections\(storedImportSourceSnapshot.instructions\)/);
  const nativeDetail = await source('mobile/src/components/recipe-detail.tsx');
  assert.match(mobileDraft, /RecipeDetail/);
  assert.match(mobileSaved, /RecipeDetail/);
  for (const label of ['Substitute', 'Remove', 'Keto', 'Restore imported source', 'Cancel change', 'Save recipe']) assert.ok(nativeDetail.includes(label));
  assert.match(nativeDetail, /original stays unchanged/);
  assert.match(mobileSaved, /sourceRecipe=\{recipe.importSourceSnapshot\}/);
  assert.match(webNutrition, /estimate is unavailable right now/);
  assert.match(webPresentation, /typeof recipe\?\.estimatedCostPerServing === 'number'/);
  assert.match(mobileComparison, /— means unavailable/);
  assert.match(mobileService, /importSourceSnapshot/);
  assert.match(webSave, /importSourceSnapshot/);
  assert.match(mobileSave, /importSourceSnapshot/);
  assert.match(migration, /importSourceSnapshot/);
  console.log('Import adaptation verification passed: coherent substitute/remove, preference exclusions, immutable source, bounded failure/cancel contract, no extra quota, explicit save/copy, and web/Android parity.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
