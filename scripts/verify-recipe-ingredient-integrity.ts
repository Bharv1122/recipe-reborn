import assert from 'node:assert/strict';
import {
  buildIngredientReconciliationPrompt,
  validateIngredientReconciliation,
  type IngredientReconciliationContext,
} from '../lib/recipe-ingredient-integrity';

const recipe = {
  title: 'Quick Pantry Turkey Chili',
  freshIngredients: ['1 tbsp olive oil', '1 onion, diced', '2 cloves garlic, minced'],
  instructions: [
    'Heat olive oil in a pot. Cook onion and garlic until softened.',
    'Add turkey chili, canned carrots, green beans, chicken broth and sherry. Simmer for 10 minutes.',
    'Serve with optional shredded cheese and chopped parsley.',
  ],
};
const context: IngredientReconciliationContext = {
  pantryIngredients: '1 can Hormel turkey chili with beans, 1 can organic sliced carrots, 1 can green beans, 1 carton chicken broth, 1 bottle sherry, shredded cheese, fresh parsley, 2 ripe bananas',
  recipe,
};
const complete = {
  freshIngredients: [
    ...recipe.freshIngredients, '1 can turkey chili with beans', '1 can carrots, drained',
    '1 can green beans, drained', '1 cup chicken broth', '2 tbsp sherry',
    '1/4 cup shredded cheese (optional)', '1 tbsp chopped parsley (optional)',
  ],
  instructionIngredients: [] as { ingredient: string; steps: number[] }[],
};
complete.instructionIngredients = complete.freshIngredients.map((ingredient, index) => ({
  ingredient, steps: [index < 3 ? 1 : index < 8 ? 2 : 3],
}));

let cases = 0;
function passes(name: string, value: unknown, givenContext = context) {
  assert.doesNotThrow(() => validateIngredientReconciliation(value, givenContext), name);
  cases++;
}
function rejects(name: string, value: unknown, givenContext = context) {
  assert.throws(() => validateIngredientReconciliation(value, givenContext), /Ingredient reconciliation/, name);
  cases++;
}
function copy() { return structuredClone(complete); }
function omit(index: number) {
  const changed = copy();
  changed.freshIngredients.splice(index, 1);
  changed.instructionIngredients.splice(index, 1);
  return changed;
}

passes('complete canned-food recipe and optional toppings', complete);
assert.deepEqual(validateIngredientReconciliation(complete, context), complete.freshIngredients);
assert.ok(!complete.freshIngredients.some(line => line.includes('banana')), 'unused inventory is not required');
cases++;
rejects('reported three-staple list cannot pass a partial food map', {
  freshIngredients: recipe.freshIngredients,
  instructionIngredients: complete.instructionIngredients.slice(0, 3),
});
for (const [index, name] of [[3, 'turkey chili'], [4, 'carrots'], [5, 'green beans'], [6, 'broth'], [7, 'sherry'], [8, 'optional cheese'], [9, 'optional parsley']] as const) {
  rejects(`food actually used cannot be omitted: ${name}`, omit(index));
}
for (const value of [null, [], {}, { ...complete, instructions: recipe.instructions }, { ...complete, freshIngredients: [] }]) {
  rejects('invalid or expanded response contract', value);
}
{
  const changed = copy();
  changed.instructionIngredients.pop();
  rejects('complete list with incomplete step map', changed);
}
for (const steps of [[], [0], [-1], [1.5], [4], [1, 1], ['1']]) {
  const changed = copy();
  changed.instructionIngredients[0].steps = steps as number[];
  rejects('invalid, duplicate, or noninteger step references', changed);
}
{
  const changed = copy();
  changed.instructionIngredients[0].ingredient = 'olive oil';
  rejects('reference must match the full ingredient line exactly', changed);
}
{
  const changed = copy();
  changed.instructionIngredients.push(changed.instructionIngredients[0]);
  rejects('duplicate ingredient mappings', changed);
}
{
  const changed = copy();
  changed.freshIngredients.push(changed.freshIngredients[0].toUpperCase());
  changed.instructionIngredients.push({ ingredient: changed.freshIngredients[changed.freshIngredients.length - 1], steps: [1] });
  rejects('duplicate ingredient lines with different capitalization', changed);
}
rejects('missing referenced cooking step', complete, {
  ...context, recipe: { ...recipe, instructions: ['', ...recipe.instructions.slice(1)] },
});
rejects('existing draft ingredient cannot disappear even when not in inventory', omit(0));
{
  const changed = copy();
  changed.freshIngredients[2] = '1 tsp minced garlic';
  changed.instructionIngredients[2].ingredient = changed.freshIngredients[2];
  passes('quantity and preparation wording may change without dropping identity', changed);
}
{
  const shorthandContext = {
    pantryIngredients: '2 organic carrots, 1 can greenbeans, 1 carton chicken broth, extra virgin olive oil, 2 bananas',
    recipe: {
      title: 'Vegetables', freshIngredients: ['1 tbsp EVOO', '1 carrot'],
      instructions: ['Heat the oil. Add the carrot and beans, then pour in broth.'],
    },
  };
  const lines = ['1 tbsp olive oil', '1 carrot', '1 cup green beans', '1 cup chicken broth'];
  passes('plural, quantities, packaging and basic head-noun shorthand', {
    freshIngredients: lines,
    instructionIngredients: lines.map(ingredient => ({ ingredient, steps: [1] })),
  }, shorthandContext);
}
{
  const changed = copy();
  const old = changed.freshIngredients[4];
  changed.freshIngredients[4] = '1 can carrot';
  changed.instructionIngredients.find(entry => entry.ingredient === old)!.ingredient = '1 can carrot';
  passes('singular and plural food forms', changed);
}
const prompt = buildIngredientReconciliationPrompt({ ...context, originalPrompt: 'Use the pantry. Avoid peanuts. Vegetarian request remains applicable.' });
assert.ok(prompt.includes('Avoid peanuts. Vegetarian request remains applicable.'));
assert.ok(prompt.includes(JSON.stringify({ pantryIngredients: context.pantryIngredients, recipe })));
assert.ok(prompt.includes('ALL ingredients') && prompt.includes('Do not add unused pantry inventory'));
cases++;
console.log(`Ingredient integrity: ${cases} pure regression cases passed; no network or account data used.`);
