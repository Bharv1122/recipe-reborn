import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';
import { recipeComparisonSchema } from '../lib/recipe-comparison-validation';

// Opt-in integration test: uses a disposable account, real website sign-in,
// generation and persistence. No customer account or payment is touched.
async function main() {
  assert.equal(process.env.ALLOW_PRODUCTION_SYNTHETIC_TEST, '1',
    'Explicitly enable ALLOW_PRODUCTION_SYNTHETIC_TEST to run this live test.');
  const base = (process.env.RECIPE_VERIFY_BASE_URL || 'https://recipereborn.com').replace(/\/$/, '');
  const email = `recipe-snapshot-audit-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString('base64url');
  const cookies = new Map<string, string>();
  const input = { title: 'Synthetic maple oatmeal persistence audit', originalIngredients: 'oats, artificial flavor',
    freshIngredients: ['1 cup oats', '2 cups water', '1 tablespoon maple syrup'],
    instructions: ['Simmer oats in water, then stir in maple syrup.'], servings: '2', prepTime: '2 minutes', cookTime: '5 minutes',
    dietaryTags: ['vegan'], estimatedCostPerServing: 0.8, storeBoughtCost: 2.5 };
  let userId: string | undefined;

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${base}${path}`, {
      ...init, redirect: 'manual', signal: AbortSignal.timeout(240_000),
      headers: {
        Cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; '),
        ...init.headers,
      },
    });
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(';', 1)[0];
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }

  try {
    const user = await prisma.user.create({ data: {
      email, password: await bcrypt.hash(password, 10), name: 'Synthetic recipe snapshot audit',
      signupSource: 'synthetic-recipe-snapshot-audit', subscriptionTier: 'premium',
      subscriptionStatus: 'active', allergies: [], dislikedIngredients: [],
    }, select: { id: true } });
    userId = user.id;
    const csrfResponse = await request('/api/auth/csrf');
    assert.equal(csrfResponse.status, 200, 'Website CSRF endpoint failed');
    const csrf = await csrfResponse.json();
    const login = await request('/api/auth/callback/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken,
        callbackUrl: `${base}/meal-planner`, json: 'true' }),
    });
    assert.equal(login.status, 200, 'Website sign-in failed');
    const sessionResponse = await request('/api/auth/session');
    const session = await sessionResponse.json();
    assert.equal(session.user?.id, userId, 'Website session identity mismatch');

    const json = (body: unknown, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const estimateResponse = await request('/api/nutrition/estimate', json(input));
    assert.equal(estimateResponse.status, 200, 'Live nutrition estimate failed');
    const freshNutrition = await estimateResponse.json();
    assert.ok(['calories','protein','carbs','fat','fiber','sodium'].some(key => typeof freshNutrition[key] === 'number'));
    const comparisonSnapshot = recipeComparisonSchema.parse({ version: 1, source: 'label', detectedAdditives: ['Artificial flavor'],
      originalNutrition: { values: { calories: 150, protein: 4, carbs: null, fat: 2, fiber: null, sodium: 0 },
        basisLabel: 'Per 40 g test packet', sourceLabel: 'Synthetic package facts', servingsPerContainer: null,
        source: 'typed', accuracy: 'exact', reviewRequired: false }, freshNutrition });
    const save = await request('/api/recipes', json({ ...input, comparisonSnapshot }));
    assert.equal(save.status, 201, 'Website recipe save failed');
    const recipeId = (await save.json()).recipe.id;
    const reopen = async () => {
      const response = await request('/api/recipes/' + recipeId);
      assert.equal(response.status, 200); return (await response.json()).recipe;
    };
    let saved = await reopen();
    assert.deepEqual(saved.comparisonSnapshot, comparisonSnapshot);
    assert.deepEqual(JSON.parse(saved.freshIngredients), input.freshIngredients);
    assert.deepEqual(JSON.parse(saved.instructions), input.instructions);
    assert.equal(saved.estimatedCostPerServing, input.estimatedCostPerServing);
    const cache = await request('/api/recipes/' + recipeId + '/nutrition', { method: 'POST' });
    assert.equal(cache.status, 200); assert.deepEqual(await cache.json(), freshNutrition);
    const note = await request('/api/recipes/' + recipeId, json({ notes: 'Synthetic notes edit', freshIngredients: JSON.stringify(input.freshIngredients) }, 'PATCH'));
    assert.equal(note.status, 200); saved = await reopen(); assert.deepEqual(saved.comparisonSnapshot, comparisonSnapshot);
    const edit = await request('/api/recipes/' + recipeId, json({ freshIngredients: JSON.stringify(['1 cup oats', '2 cups water']) }, 'PATCH'));
    assert.equal(edit.status, 200); saved = await reopen();
    assert.equal(saved.comparisonSnapshot.freshNutrition, null);
    assert.deepEqual(saved.comparisonSnapshot.originalNutrition, comparisonSnapshot.originalNutrition);
    assert.equal(saved.estimatedCostPerServing, null); assert.equal(saved.calories, null);
    console.log(JSON.stringify({ok:true,site:base,authentication:'website-session',liveNutrition:true,saveAndReopen:true,
      exactSnapshot:true,notesPreserveComparison:true,ingredientEditInvalidatesEstimate:true,zeroAndUnknownValuesPreserved:true}));
  } finally {
    // The schema cascades this disposable user's recipes, plans and sessions.
    try {
      // Covers a committed create whose response was lost in transit.
      const disposable = await prisma.user.findFirst({
        where: { email, signupSource: 'synthetic-recipe-snapshot-audit' }, select: { id: true },
      });
      if (disposable) {
        if (userId) assert.equal(disposable.id, userId);
        await prisma.user.delete({ where: { id: disposable.id } });
        assert.equal(await prisma.user.count({ where: { id: disposable.id } }), 0);
        assert.equal(await prisma.recipe.count({ where: { userId: disposable.id } }), 0);
        assert.equal(await prisma.mealPlan.count({ where: { userId: disposable.id } }), 0);
        console.log('Synthetic account and recipe cleanup verified.');
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(error => {
  // Avoid printing response bodies, credentials, or database connection details.
  console.error(error instanceof assert.AssertionError ? error.message :
    `Live recipe snapshot verification failed (${error?.name ?? 'Error'}, ${error?.code ?? 'no code'}).`);
  process.exitCode = 1;
});
