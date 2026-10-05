import assert from 'node:assert/strict';
import { barcodeIngredientText } from '../lib/barcode-lookup';
import { GenerationValidationError, parseGeneratedRecipe, generationFailureMessage, type GenerationConstraints } from '../lib/recipe-generation-validation';

const recipe = { title: 'Tomato rice', freshIngredients: ['1 cup rice', '2 tomatoes'], instructions: ['Simmer the rice in water for 20 minutes.', 'Stir in chopped tomatoes and serve.'], prepTime: '5 minutes', cookTime: '20 minutes', servings: '2' };
const constraints: GenerationConstraints = { us: true, allergies: [], dislikes: [] };
assert.equal(parseGeneratedRecipe(JSON.stringify(recipe), 'stop', constraints).title, recipe.title);
const fails = (value: unknown, reason: string, finish: string | null = 'stop', limits = constraints) => {
  assert.throws(() => parseGeneratedRecipe(typeof value === 'string' ? value : JSON.stringify(value), finish, limits), error => error instanceof GenerationValidationError && error.reason === reason);
};
fails(recipe, 'truncated', 'length');
fails(recipe, 'truncated', null);
fails('{"title":', 'json');
fails({ ...recipe, instructions: [] }, 'schema');
fails({ ...recipe, freshIngredients: ['100 g rice', '2 tomatoes'] }, 'metric_units');
fails({ ...recipe, freshIngredients: ['1 cup milk', '1 cup rice'] }, 'allergy', 'stop', { ...constraints, allergies: ['milk'] });
fails(recipe, 'dislike', 'stop', { ...constraints, dislikes: ['tomato'] });
assert.doesNotMatch(generationFailureMessage(new GenerationValidationError('schema')), /after a repair/i, 'Do not claim repair completed when the deadline prevented it.');
assert.equal(barcodeIngredientText({ ingredients_text: '  ', ingredients_text_en: '_Wheat_ flour, _milk_' }), 'Wheat flour, milk');
assert.equal(barcodeIngredientText({ ingredients_text: 'Original label', ingredients_text_en: 'Translation' }), 'Original label');
assert.equal(barcodeIngredientText({ ingredients: [{ text: 'wheat' }] }), '', 'Parsed fragments must not masquerade as a complete label.');
assert.equal(barcodeIngredientText({ ingredients_text_fr: 'farine, lait' }), 'farine, lait');
console.log('Generation validation and barcode recovery checks passed. No AI requests made.');
