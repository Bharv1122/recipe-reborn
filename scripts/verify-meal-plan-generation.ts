import assert from 'node:assert/strict';
import { AI_CHAT_URL, MODEL_FAST, MODEL_SMART } from '../lib/ai';
import { generateValidatedPlan, MealPlanProviderError, MealPlanSafetyError } from '../lib/meal-plan-generation';
import { DAYS, validateMeal, validateMealPlan, type DayName } from '../lib/meal-plan-validation';

type Options = Parameters<typeof generateValidatedPlan>[0];
type ModelCall = { kind: 'plan' | 'repair'; model: string; prompt: string; day?: DayName };
type Reply = (call: ModelCall, index: number, signal?: AbortSignal | null) => Response | Promise<Response>;

const options: Options = {
  weekStartDate: '2026-09-28', dietaryPreferences: [], mealTypes: ['dinner'],
  servings: 2, allergies: ['fish'], dislikedIngredients: [],
};
const titles = [
  'Chicken broccoli bowl', 'Lentil tomato stew', 'Turkey sweet potato skillet',
  'Ginger tofu stir fry', 'Pork green bean supper', 'Black bean stuffed peppers',
  'Beef mushroom barley soup',
];

function meal(title: string) {
  return {
    title, ingredients: ['1 cup brown rice', '2 cups broccoli', '1 tablespoon olive oil'],
    instructions: 'Cook the rice. Steam broccoli until tender and combine with olive oil.',
    prepTime: '5 min', cookTime: '25 min', servings: 2,
    dietaryTags: [], estimatedCalories: 450,
  };
}

function validPlan() {
  return DAYS.map((day, index) => ({ day, dinner: meal(titles[index]) }));
}

function invalidSlots(...days: DayName[]) {
  return validPlan().map((entry) => days.includes(entry.day)
    ? { ...entry, dinner: { ...entry.dinner, instructions: '' } }
    : entry);
}

function completion(value: unknown, finishReason = 'stop') {
  return contentCompletion(JSON.stringify(value), finishReason);
}

function contentCompletion(content: string, finishReason = 'stop') {
  return Response.json({ choices: [{ message: { content }, finish_reason: finishReason }] });
}

function validateResult(result: Awaited<ReturnType<typeof generateValidatedPlan>>, validationOptions = options) {
  // Independently revalidate the returned, normalized plan as the provider shape.
  const flattened = result.plan.map(({ day, meals }) => ({ day, ...meals }));
  const checked = validateMealPlan(flattened, validationOptions);
  assert.equal(checked.success, true, 'Generation returned an invalid or unsafe plan.');
  assert.equal(result.plan.length, 7);
  return result.plan;
}

async function withModel(reply: Reply, check: (calls: ModelCall[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const calls: ModelCall[] = [];
  let mockFailure: unknown;
  globalThis.fetch = async (input, init) => {
    try {
      assert.equal(String(input), AI_CHAT_URL, 'Only the expected AI request may be made.');
      assert.equal(init?.method, 'POST');
      assert.equal(typeof init.body, 'string');
      const body = JSON.parse(init.body as string) as {
        model: string; messages: Array<{ role: string; content: string }>;
      };
      const prompt = body.messages.find((message) => message.role === 'user')?.content ?? '';
      const repair = prompt.includes('Replace one rejected meal-plan entry');
      const day = repair ? prompt.match(/\bDay:\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)?.[1] as DayName | undefined : undefined;
      if (repair) assert.ok(day, 'A repair request must identify its requested day.');
      const call: ModelCall = { kind: repair ? 'repair' : 'plan', model: body.model, prompt, ...(day ? { day } : {}) };
      calls.push(call);
      return await reply(call, calls.length - 1, init.signal);
    } catch (error) {
      // A production retry must not hide a broken test fixture/assertion.
      if (error instanceof assert.AssertionError) mockFailure = error;
      throw error;
    }
  };
  try {
    await check(calls);
    if (mockFailure) throw mockFailure;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

let cases = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  cases += 1;
  console.log(`PASS ${name}`);
}

async function main() {
  await test('Valid plan needs no repair', () => withModel(() => completion(validPlan()), async (calls) => {
    validateResult(await generateValidatedPlan(options));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'plan');
  }));

  const brokenRepairs: Array<[string, () => Response]> = [
    ['malformed replacement JSON', () => contentCompletion('{"title":"Incomplete",')],
    ['empty replacement content', () => contentCompletion('')],
    // Complete JSON with a truncation marker must still be rejected.
    ['truncated replacement content', () => completion(meal('Truncated answer must not survive'), 'length')],
  ];
  for (const [label, brokenReply] of brokenRepairs) {
    await test(`${label} recovers through a safe repair`, () => withModel((call) => {
      if (call.kind === 'plan') return completion(invalidSlots('wednesday'));
      assert.equal(call.day, 'wednesday');
      return call.model === MODEL_FAST ? brokenReply() : completion(meal('Squash risotto'));
    }, async (calls) => {
      const result = validateResult(await generateValidatedPlan(options));
      assert.equal(result[2].meals.dinner?.title, 'Squash risotto');
      assert.equal(calls.filter((call) => call.kind === 'plan').length, 1);
      assert.equal(calls.filter((call) => call.kind === 'repair' && call.model === MODEL_FAST).length, 1);
      assert.equal(calls.filter((call) => call.kind === 'repair' && call.model === MODEL_SMART).length, 1);
    }));
  }

  const initialFailures: Array<[string, () => Response | Promise<Response>]> = [
    ['429', () => new Response('', { status: 429 })],
    ['502', () => new Response('', { status: 502 })],
    ['transport rejection', () => Promise.reject(new TypeError('Synthetic network interruption'))],
    ['malformed response envelope', () => new Response('not-json', { status: 200 })],
    ['malformed plan JSON', () => contentCompletion('[{"day":"monday"')],
    ['empty plan content', () => contentCompletion('')],
    ['truncated plan content', () => completion(validPlan(), 'length')],
  ];
  for (const [label, failure] of initialFailures) {
    await test(`Initial ${label} retries within the two-plan budget`, () => withModel((call, index) => {
      assert.equal(call.kind, 'plan');
      return index === 0 ? failure() : completion(validPlan());
    }, async (calls) => {
      validateResult(await generateValidatedPlan(options));
      assert.equal(calls.length, 2);
    }));
  }

  for (const phase of ['initial', 'repair'] as const) {
    await test(`${phase} authentication 401 fails fast`, () => withModel((call) => {
      if (phase === 'repair' && call.kind === 'plan') return completion(invalidSlots('monday'));
      return new Response('', { status: 401 });
    }, async (calls) => {
      await assert.rejects(() => generateValidatedPlan(options));
      assert.equal(calls.filter((call) => call.kind === 'plan').length, 1);
      assert.equal(calls.filter((call) => call.kind === 'repair').length, phase === 'repair' ? 1 : 0);
    }));
  }

  await test('Repeated provider errors stop after two plan attempts', () => withModel(
    () => new Response('', { status: 502 }),
    async (calls) => {
      await assert.rejects(() => generateValidatedPlan(options), (error: unknown) => error instanceof MealPlanProviderError);
      assert.equal(calls.length, 2);
    },
  ));

  await test('Repeated malformed repairs fail closed without an unbounded retry loop', () => withModel(
    (call) => call.kind === 'plan'
      ? completion(invalidSlots('wednesday'))
      : contentCompletion('{"title":'),
    async (calls) => {
      await assert.rejects(() => generateValidatedPlan(options), (error: unknown) => error instanceof MealPlanSafetyError);
      assert.equal(calls.filter((call) => call.kind === 'plan').length, 2);
      assert.ok(calls.length <= 6);
    },
  ));

  await test('Provider deadline signal aborts requests and exhausts bounded retries', async () => {
    const originalTimeout = AbortSignal.timeout;
    const budgets: number[] = [];
    // Accelerate the real signal mechanism; no 45-second wall-clock wait.
    AbortSignal.timeout = (milliseconds: number) => {
      budgets.push(milliseconds);
      const controller = new AbortController();
      queueMicrotask(() => controller.abort(new DOMException('Synthetic deadline', 'TimeoutError')));
      return controller.signal;
    };
    try {
      await withModel((_call, _index, signal) => {
        assert.ok(signal, 'Every provider request needs its deadline signal.');
        return new Promise<Response>((_resolve, reject) => {
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }, async (calls) => {
        await assert.rejects(() => generateValidatedPlan(options), (error: unknown) => error instanceof MealPlanProviderError);
        assert.equal(calls.length, 2);
        assert.equal(budgets.length, 2);
        assert.ok(budgets.every((milliseconds) => milliseconds > 0 && milliseconds <= 45_000));
      });
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });

  await test('Repeated unsafe meals fail closed within a bounded request budget', () => withModel((call) => {
    const unsafeMeal = (title: string) => ({ ...meal(title), ingredients: ['8 oz salmon', '1 cup rice'] });
    if (call.kind === 'plan') return completion(DAYS.map((day, index) => ({ day, dinner: unsafeMeal(titles[index]) })));
    return completion(unsafeMeal(`Unsafe salmon ${call.day}`));
  }, async (calls) => {
    await assert.rejects(() => generateValidatedPlan(options), (error: unknown) => error instanceof MealPlanSafetyError);
    assert.ok(calls.filter((call) => call.kind === 'plan').length <= 2);
    assert.ok(calls.length <= 30, 'Two plan attempts and two repair passes per seven slots are the maximum.');
  }));

  await test('Successful fast repairs survive another slot failing and recovering', () => withModel((call) => {
    if (call.kind === 'plan') return completion(invalidSlots('wednesday', 'friday'));
    if (call.day === 'wednesday') {
      assert.equal(call.model, MODEL_FAST, 'A successful repaired slot should not be regenerated.');
      return completion(meal('Squash risotto'));
    }
    assert.equal(call.day, 'friday');
    return call.model === MODEL_FAST
      ? contentCompletion('{"title":')
      : completion(meal('Cabbage chickpea skillet'));
  }, async (calls) => {
    const plan = validateResult(await generateValidatedPlan(options));
    assert.equal(plan[2].meals.dinner?.title, 'Squash risotto');
    assert.equal(plan[4].meals.dinner?.title, 'Cabbage chickpea skillet');
    assert.equal(plan[0].meals.dinner?.title, titles[0], 'Unrejected meals must be preserved.');
    assert.equal(calls.filter((call) => call.kind === 'plan').length, 1);
    assert.equal(calls.filter((call) => call.kind === 'repair').length, 3);
  }));

  await test('Expanded exclusions reach both phases without weakening validation', async () => {
    const aliasOptions: Options = { ...options, allergies: ['shellfish'], dislikedIngredients: ['scrambled eggs'] };
    const initial = validPlan();
    initial[2].dinner = { ...meal('Rice supper'), ingredients: ['8 oz salmon', '1 cup rice'] };
    const unsafeRepair = { ...meal('Chickpea salad'), ingredients: ['1 cup chickpeas', '1 tablespoon mayonnaise'] };
    const allergyGuard = validateMeal(initial[2].dinner, aliasOptions);
    const dislikeGuard = validateMeal(unsafeRepair, aliasOptions);
    assert.equal(allergyGuard.success, false, 'The existing expanded allergy guard must stay active.');
    assert.equal(dislikeGuard.success, false, 'The existing expanded dislike guard must stay active.');
    if (!allergyGuard.success) assert.equal(allergyGuard.error.code, 'allergen_detected');
    if (!dislikeGuard.success) assert.equal(dislikeGuard.error.code, 'disliked_ingredient');
    await withModel((call) => {
      const exclusions = call.prompt.match(/Validation also excludes these ingredient names and aliases: ([^\n]+?)\. Use alternatives;/)?.[1]
        .split(',').map((term) => term.trim());
      assert.ok(exclusions, `${call.kind} prompt is missing the validator's expanded exclusions.`);
      for (const term of ['shellfish', 'fish', 'salmon', 'shrimp', 'scrambled eggs', 'egg', 'mayonnaise', 'meringue']) {
        assert.ok(exclusions.includes(term), `${call.kind} prompt omitted the blocked alias ${term}.`);
      }
      if (call.kind === 'plan') return completion(initial);
      assert.equal(call.day, 'wednesday');
      return completion(call.model === MODEL_FAST ? unsafeRepair : meal('Squash risotto'));
    }, async (calls) => {
      const plan = validateResult(await generateValidatedPlan(aliasOptions), aliasOptions);
      assert.equal(plan[2].meals.dinner?.title, 'Squash risotto');
      assert.equal(calls.filter((call) => call.kind === 'plan').length, 1);
      assert.deepEqual(calls.filter((call) => call.kind === 'repair').map((call) => call.model), [MODEL_FAST, MODEL_SMART]);
    });
  });

  await test('Later duplicate repairs exclude the earlier chosen replacement', () => withModel((call) => {
    if (call.kind === 'plan') {
      const duplicated = validPlan();
      duplicated[1].dinner = meal(titles[0]);
      duplicated[2].dinner = meal(titles[0]);
      return completion(duplicated);
    }
    assert.equal(call.model, MODEL_FAST);
    if (call.day === 'tuesday') return completion(meal('Squash risotto'));
    assert.equal(call.day, 'wednesday');
    const excludedTitles = call.prompt.match(/Do not reuse or lightly rename any of these recipe titles: ([^\n]+)/)?.[1] ?? '';
    assert.ok(excludedTitles.includes('Squash risotto'), 'The second replacement must know the first replacement title.');
    return completion(meal('Lemon chickpea salad'));
  }, async (calls) => {
    const plan = validateResult(await generateValidatedPlan(options));
    assert.equal(plan[1].meals.dinner?.title, 'Squash risotto');
    assert.equal(plan[2].meals.dinner?.title, 'Lemon chickpea salad');
    assert.equal(calls.filter((call) => call.kind === 'plan').length, 1);
    assert.equal(calls.filter((call) => call.kind === 'repair').length, 2);
  }));

  let inFlight = 0;
  let peakInFlight = 0;
  await test('Seven needed repairs never exceed four concurrent provider requests', () => withModel(async (call) => {
    if (call.kind === 'plan') return completion(invalidSlots(...DAYS));
    assert.equal(call.model, MODEL_FAST);
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      return completion(meal(titles[DAYS.indexOf(call.day!)]));
    } finally {
      inFlight -= 1;
    }
  }, async (calls) => {
    validateResult(await generateValidatedPlan(options));
    assert.equal(calls.filter((call) => call.kind === 'repair').length, 7);
    assert.ok(peakInFlight <= 4, `Observed ${peakInFlight} concurrent repair requests.`);
    assert.equal(inFlight, 0);
  }));

  console.log(`Meal-plan generation: ${cases} isolated cases passed; mocked provider only, no database or live API.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
