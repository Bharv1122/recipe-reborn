import assert from 'node:assert/strict';
import { cookingMeasurementIdentity, equivalentCookingMeasurements, hasMetricCookingMeasures, US_COOKING_MEASURES } from '../shared/cooking-measurements';
import { buildImportAdaptationPrompt, importAdaptationRequestSchema, validateAdaptedImport } from '../lib/import-recipe-adaptation';

for (const line of ['200 g pasta', '250g chicken', '0.5 kg chicken', '120 ml cream', '1 litre water']) assert.equal(hasMetricCookingMeasures([line]), true, line);
for (const line of ['2 cups dry penne', '1/2 cup cream', '8 oz chicken', '1 lb chicken', '2 large eggs', '1 tsp salt']) assert.equal(hasMetricCookingMeasures([line]), false, line);
assert.match(US_COOKING_MEASURES, /cups/);
assert.match(US_COOKING_MEASURES, /instead of inventing a gram-to-cup equivalence/);
assert.match(US_COOKING_MEASURES, /nutrition in its standard units/);
assert.equal(cookingMeasurementIdentity('120 ml cream'), cookingMeasurementIdentity('about ½ cup cream'));
assert.equal(cookingMeasurementIdentity('250 g chicken, diced into 1-inch pieces'), cookingMeasurementIdentity('8.8 oz chicken, diced into 1-inch pieces'));
assert.notEqual(cookingMeasurementIdentity('1 egg'), cookingMeasurementIdentity('2 eggs'));
assert.notEqual(cookingMeasurementIdentity('Cook for 5 minutes to 165°F.'), cookingMeasurementIdentity('Cook for 15 minutes to 145°F.'));
const request = importAdaptationRequestSchema.parse({ action: { type: 'measurements', system: 'us' }, recipe: {
  title: 'Cream sauce', freshIngredients: ['120 ml cream', '5 g butter'], instructions: ['Simmer 120 ml cream for 5 minutes. Stir in 5 g butter.'], prepTime: '1 min', cookTime: '5 min', servings: '2', dietaryTags: [],
} });
const converted = { ...request.recipe, freshIngredients: ['about ½ cup cream', '0.18 oz butter'], instructions: ['Simmer about ½ cup cream for 5 minutes. Stir in 0.18 oz butter.'] };
const preferences = { allergies: ['milk'], dislikes: ['butter'], likes: [] };
assert.deepEqual(validateAdaptedImport(converted, request, preferences), converted, 'A measurement change preserves foods; it does not claim to apply dietary preferences.');
assert.throws(() => validateAdaptedImport({ ...converted, freshIngredients: ['½ cup oat milk', '0.18 oz butter'] }, request, preferences), /same foods/);
assert.throws(() => validateAdaptedImport({ ...converted, freshIngredients: ['½ cup cream'] }, request, preferences), /same foods/);
assert.throws(() => validateAdaptedImport({ ...converted, servings: '4' }, request, preferences), /servings/);
assert.throws(() => validateAdaptedImport({ ...converted, instructions: ['Simmer ½ cup cream for 15 minutes. Stir in 0.18 oz butter.'] }, request, preferences), /same foods/);
assert.throws(() => validateAdaptedImport(request.recipe, request, preferences), /U.S. cooking measures/);
const prompt = buildImportAdaptationPrompt(request.recipe, request.action, preferences);
assert.doesNotMatch(prompt, /allergiesToAvoid|savedPreferences/);
assert.match(prompt, /Do not apply saved food preferences/);


assert.equal(cookingMeasurementIdentity('1,5 kg rice'), cookingMeasurementIdentity('3.3 lb rice'));
for (const [before, after] of [['1,5 kg rice', '3.3 lb rice'], ['120 ml cream', '½ cup cream'], ['250 g chicken', '8.8 oz chicken'], ['1 litre stock', '4.25 cups stock'], ['500 g flour', 'about 4 cups flour']]) assert.equal(equivalentCookingMeasurements(before, after), true, `${before} -> ${after}`);
for (const [before, after] of [['250 g chicken', '2 lb chicken'], ['1 l stock', '1 cup stock'], ['5 g butter', '0.5 oz butter'], ['500 g flour', '4 cups flour'], ['2 cups stock', '1 cup stock'], ['5 g butter', '1/0 oz butter']]) assert.equal(equivalentCookingMeasurements(before, after), false, `${before} -> ${after}`);
assert.throws(() => validateAdaptedImport({ ...converted, freshIngredients: ['2 cups cream', '0.18 oz butter'] }, request, preferences), /equivalent cooking amounts/);
assert.equal(equivalentCookingMeasurements('120 ml cream', '4 fl oz cream'), true);
assert.equal(cookingMeasurementIdentity('120 ml cream'), cookingMeasurementIdentity('4 fl oz cream'));
assert.equal(equivalentCookingMeasurements('1,000 g flour', '0.035 oz flour'), false);
console.log('Cooking measurement checks passed: U.S. policy, numeric equivalence, food/count/time preservation, metric rejection and unchanged nutrient units.');