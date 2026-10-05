// Opt-in synthetic nested-label test. No owner photos or account data.
import assert from 'node:assert/strict';
import { AI_API_KEY, AI_CHAT_URL, MODEL_SMART } from '../lib/ai';
import { labelRecipePrompt } from '../lib/label-recipe-prompt';
import { US_COOKING_MEASURES } from '../shared/cooking-measurements';
import { parseGeneratedRecipe, GenerationValidationError } from '../lib/recipe-generation-validation';

async function main() {
  if (process.env.QA26_LIVE !== '1' || !AI_API_KEY) throw new Error('Explicit QA26_LIVE and configured provider required.');
  const label = 'CRUST (WHEAT FLOUR, WATER, RICE FLOUR, LESS THAN 2% SALT, SOY FLOUR, OLIVE OIL, YEAST, MALTED BARLEY FLOUR), TOMATOES, CHEESE (PASTEURIZED MILK, CREAM, VINEGAR, ENZYMES, SALT), GARLIC SAUCE (OLIVE OIL, GARLIC FLAVOR [SUNFLOWER OIL, NATURAL FLAVOR]), BASIL, PARMESAN CHEESE (MILK, CULTURES, SALT, RENNET), CELLULOSE, SPICE';
  const prompt = `${labelRecipePrompt(label, 'Synthetic mini tomato pizza')}\n${US_COOKING_MEASURES}\nList every ingredient used in every step, with quantities. Saved preference for this synthetic test: vegan. Use only vegan ingredients.`;
  const response = await fetch(AI_CHAT_URL, { method: 'POST', signal: AbortSignal.timeout(52000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` }, body: JSON.stringify({ model: MODEL_SMART, messages: [{ role: 'user', content: prompt }], stream: true, max_tokens: 6000, reasoning_effort: 'low', response_format: { type: 'json_object' } }) });
  assert.equal(response.status, 200);
  const events = (await response.text()).split('\n').filter(line => line.startsWith('data: ') && line !== 'data: [DONE]').map(line => JSON.parse(line.slice(6)));
  const content = events.map(event => event.choices?.[0]?.delta?.content ?? '').join('');
  const finish = events.map(event => event.choices?.[0]?.finish_reason).find(Boolean) ?? null;
  console.log(JSON.stringify({ streamFinishReason: finish, responseCharacters: content.length, streamEvents: events.length }));
  let recipe;
  let repaired = false;
  try { recipe = parseGeneratedRecipe(content, finish, { us: true, allergies: [], dislikes: [] }); }
  catch (error) {
    if (!(error instanceof GenerationValidationError)) throw error;
    const repair = await fetch(AI_CHAT_URL, { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` }, body: JSON.stringify({ model: MODEL_SMART, messages: [{ role: 'user', content: `${prompt}\nRepair the previous candidate. Validation reason: ${error.reason}. Return one complete JSON recipe satisfying all original constraints. Previous candidate data: ${JSON.stringify(content)}` }], stream: false, max_tokens: 6000, reasoning_effort: 'low', response_format: { type: 'json_object' } }) });
    assert.equal(repair.status, 200);
    const choice = (await repair.json()).choices?.[0];
    recipe = parseGeneratedRecipe(choice?.message?.content ?? '', choice?.finish_reason ?? null, { us: true, allergies: [], dislikes: [] }); repaired = true;
  }
  assert.match(recipe.title, /pizz(?:a|etta)/i);
  console.log(JSON.stringify({ finishReason: finish, repaired, title: recipe.title, ingredients: recipe.freshIngredients.length, steps: recipe.instructions.length, validation: 'passed' }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Synthetic test failed'); process.exitCode = 1; });
