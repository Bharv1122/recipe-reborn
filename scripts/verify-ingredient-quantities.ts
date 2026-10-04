import assert from 'node:assert/strict';
import { findUnmeasuredIngredients, ingredientHasQuantity, INGREDIENT_QUANTITY_RULES } from '../shared/ingredient-quantities';
import type { MealPlanSafetyError as SafetyError } from '../lib/meal-plan-generation';
import { DAYS, validateMeal, validateMealPlan } from '../lib/meal-plan-validation';

// Offline: synthetic key and mocked provider only. No database or live API.
// The key is read at import time, so provider modules are imported after it is set.
process.env.GEMINI_API_KEY ||= 'synthetic-gemini';

// The exact line from the one-serving screenshot.
const SCREENSHOT_LINE = 'Cooked rice for serving';

let cases = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  cases += 1;
  console.log(`PASS ${name}`);
}

type Call = { model: string; prompt: string; repair: boolean };
async function withProvider(reply: (call: Call, index: number) => unknown, check: (calls: Call[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const calls: Call[] = [];
  let fixtureError: unknown;
  globalThis.fetch = async (_input, init) => {
    try {
      const body = JSON.parse(String(init?.body));
      const prompt = body.messages.find((message: { role: string }) => message.role === 'user')?.content ?? '';
      const call = { model: body.model, prompt, repair: prompt.includes('Replace one rejected meal-plan entry') };
      calls.push(call);
      return Response.json({ choices: [{ message: { content: JSON.stringify(reply(call, calls.length - 1)) }, finish_reason: 'stop' }] });
    } catch (error) {
      fixtureError = error;
      throw error;
    }
  };
  try {
    await check(calls);
    if (fixtureError) throw fixtureError;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const titles = ['Chicken rice bowl', 'Lentil tomato stew', 'Turkey sweet potato skillet', 'Ginger tofu stir fry',
  'Pork green bean supper', 'Black bean stuffed peppers', 'Beef mushroom barley soup'];
const meal = (title: string, ingredients = ['4 oz chicken breast', '1 cup cooked brown rice (from 1/3 cup dry)', '1 cup broccoli', 'Salt to taste']) => ({
  title, ingredients, instructions: 'Season and cook the chicken. Steam the broccoli and serve over the rice.',
  prepTime: '5 min', cookTime: '20 min', servings: 1, dietaryTags: [], estimatedCalories: 450,
});
const onePerson = { weekStartDate: '2026-10-05', dietaryPreferences: [], mealTypes: ['dinner' as const], servings: 1, allergies: [], dislikedIngredients: [] };
const screenshotMeal = (title: string) => meal(title, ['4 oz chicken breast', SCREENSHOT_LINE, '1 cup broccoli', 'Salt to taste']);

async function main() {
  const { MODEL_FAST, MODEL_SMART } = await import('../lib/ai');
  const { generateValidatedPlan, MealPlanSafetyError } = await import('../lib/meal-plan-generation');
  const { generateMealReplacement } = await import('../lib/meal-plan-replacement');
  await test('Screenshot line is unmeasured; measured rice and salt to taste are accepted', () => {
    assert.equal(ingredientHasQuantity(SCREENSHOT_LINE), false);
    assert.equal(ingredientHasQuantity('1 cup cooked rice'), true);
    assert.equal(ingredientHasQuantity('1 cup cooked brown rice (from 1/3 cup dry)'), true);
    assert.equal(ingredientHasQuantity('Salt to taste'), true);
    assert.equal(ingredientHasQuantity('Salt and freshly ground black pepper, to taste'), true);
  });

  await test('Numbers, unicode fractions, word numbers and counts count as amounts', () => {
    for (const line of ['½ cup jasmine rice, cooked', '1½ cups cooked quinoa', '1 1/2 cups water', '0.5 lb ground turkey', '2-3 cloves garlic',
      'One large egg', 'two eggs', 'Half an avocado', 'a dozen cherry tomatoes', 'A pinch of salt', 'Pinch of cinnamon', 'Dash of hot sauce',
      'Juice of 1 lemon', 'Rice, 1 cup cooked', 'Chicken breast (8 oz)', '1 (15-ounce) can black beans, rinsed', 'an 8-ounce sweet potato',
      '- 2 tbsp olive oil', '3 eggs']) assert.equal(ingredientHasQuantity(line), true, line);
  });

  await test('Staples, sides and sauces without amounts are flagged, including number-only distractions', () => {
    for (const line of [SCREENSHOT_LINE, 'Cooked rice for 2 servings', 'Cooked rice (serves 1)', 'Brown rice (cooked)', 'Rice to taste',
      'Olive oil as needed', 'Bread for serving', 'Sour cream for serving', 'Steamed broccoli, on the side', 'Pasta, cooked 10 minutes',
      'Half-and-half', '2% milk', 'Chicken, baked at 400°F', 'Five-spice powder', 'Salt', 'A little olive oil', '']) {
      assert.equal(ingredientHasQuantity(line), false, line);
    }
  });

  await test('Small garnish and seasoning exceptions stay narrow', () => {
    for (const line of ['Fresh parsley, chopped, for garnish', 'Lemon wedges, for serving', 'Water as needed', 'Red pepper flakes, optional',
      'Toasted sesame seeds for garnish', 'Nonstick cooking spray, for greasing']) assert.equal(ingredientHasQuantity(line), true, line);
  });

  await test('Shared flag helper returns original lines in order and never guesses amounts', () => {
    const lines = ['4 oz chicken breast', SCREENSHOT_LINE, 'Salt to taste', 'Olive oil as needed'];
    const copy = [...lines];
    assert.deepEqual(findUnmeasuredIngredients(lines), [SCREENSHOT_LINE, 'Olive oil as needed']);
    assert.deepEqual(lines, copy, 'input is not modified');
    assert.deepEqual(findUnmeasuredIngredients(['1 cup rice', 'Salt to taste']), []);
  });

  await test('Old drafts and manual edits are not blocked; the generation path (usMeasures) is', () => {
    const value = screenshotMeal('Chicken rice bowl');
    assert.equal(validateMeal(value, { servings: 1, allergies: [] }).success, true, 'stored drafts/edits validate without the check');
    const generated = validateMeal(value, { servings: 1, allergies: [], usMeasures: true });
    assert.equal(generated.success, false);
    if (!generated.success) assert.equal(generated.error.code, 'missing_quantity');
    assert.equal(validateMeal(value, { servings: 1, allergies: [], requireQuantities: true }).success, false, 'explicit opt-in');
    assert.equal(validateMeal(value, { servings: 1, allergies: [], usMeasures: true, requireQuantities: false }).success, true, 'explicit opt-out');
    assert.equal(validateMeal(meal('Chicken rice bowl'), { servings: 1, allergies: [], usMeasures: true }).success, true);
    // Serving count matching does not make missing amounts acceptable.
    assert.equal(validateMealPlan(DAYS.map((day, i) => ({ day, dinner: screenshotMeal(titles[i]) })), { ...onePerson, usMeasures: true }).success, false);
  });

  await test('Plan prompt requires amounts for sides, cooked/raw state and totals for the one stated serving', () => withProvider(
    () => DAYS.map((day, i) => ({ day, dinner: meal(titles[i]) })),
    async calls => {
      await generateValidatedPlan(onePerson);
      assert.ok(calls[0].prompt.includes(INGREDIENT_QUANTITY_RULES));
      assert.match(calls[0].prompt, /cooked or dry\/raw/);
      assert.match(calls[0].prompt, /makes exactly 1 serving, so amounts are for that one serving/);
    }));

  await test('Generated plan with the screenshot line is repaired for that slot only', () => withProvider(
    call => {
      if (!call.repair) return DAYS.map((day, i) => ({ day, dinner: i === 2 ? screenshotMeal(titles[i]) : meal(titles[i]) }));
      assert.match(call.prompt, /Day: wednesday/);
      assert.match(call.prompt, /Rejected checks for this slot: missing_quantity\./);
      assert.ok(call.prompt.includes(INGREDIENT_QUANTITY_RULES));
      return meal('Turkey rice skillet', ['4 oz ground turkey', '3/4 cup cooked white rice (from 1/4 cup dry)', '1 cup spinach', 'Pepper to taste']);
    },
    async calls => {
      const result = await generateValidatedPlan(onePerson);
      assert.equal(calls.length, 2);
      for (const day of result.plan) assert.deepEqual(findUnmeasuredIngredients(day.meals.dinner!.ingredients), []);
      assert.equal(result.plan[2].meals.dinner!.title, 'Turkey rice skillet');
    }));

  await test('A plan that never states rice amounts fails safely with a bounded missing_quantity code', () => withProvider(
    call => call.repair ? screenshotMeal('Another rice bowl') : DAYS.map((day, i) => ({ day, dinner: i === 0 ? screenshotMeal(titles[i]) : meal(titles[i]) })),
    async () => {
      await assert.rejects(generateValidatedPlan(onePerson), (error: unknown) => {
        assert.ok(error instanceof MealPlanSafetyError);
        const safety: SafetyError = error;
        assert.ok(safety.failures.some(failure => failure.code === 'missing_quantity' && failure.day === 'monday'));
        return true;
      });
    }));

  const replacement = { day: 'monday' as const, mealType: 'dinner' as const, servings: 1, allergies: [], dislikedIngredients: [],
    dietaryPreferences: [], preferredIngredients: [], excludedTitles: ['Old meal'] };
  await test('Meal replacement rejects the screenshot line and accepts the measured backup', () => withProvider(
    call => call.model === MODEL_FAST ? screenshotMeal('Chicken rice plate') : meal('Chicken rice plate'),
    async calls => {
      const result = await generateMealReplacement({ ...replacement, signal: new AbortController().signal });
      assert.deepEqual(calls.map(call => call.model), [MODEL_FAST, MODEL_SMART]);
      assert.ok(calls[0].prompt.includes(INGREDIENT_QUANTITY_RULES));
      assert.match(calls[0].prompt, /Amounts cover all 1 serving together/);
      assert.ok(result);
      assert.deepEqual(findUnmeasuredIngredients(result!.ingredients), []);
    }));

  await test('Meal replacement returns no meal when every model omits the rice amount', () => withProvider(
    () => screenshotMeal('Chicken rice plate'),
    async () => { assert.equal(await generateMealReplacement({ ...replacement, signal: new AbortController().signal }), null); }));

  console.log(`Ingredient quantity checks: ${cases} cases passed; mocked provider only. Amount presence is checked, not nutrition accuracy.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
