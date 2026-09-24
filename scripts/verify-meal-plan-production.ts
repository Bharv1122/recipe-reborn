import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';
import { DAYS, validateMealPlan, type MealType } from '../lib/meal-plan-validation';

// Opt-in integration test: uses a disposable account, real website sign-in,
// generation and persistence. No customer account or payment is touched.
async function main() {
  assert.equal(process.env.ALLOW_PRODUCTION_SYNTHETIC_TEST, '1',
    'Explicitly enable ALLOW_PRODUCTION_SYNTHETIC_TEST to run this live test.');
  const base = (process.env.MEAL_PLAN_VERIFY_BASE_URL || 'https://recipereborn.com').replace(/\/$/, '');
  const email = `meal-plan-audit-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString('base64url');
  const cookies = new Map<string, string>();
  const options = {
    weekStartDate: '2026-09-28', mealTypes: ['breakfast', 'lunch', 'dinner'] as MealType[],
    servings: 2, dietaryPreferences: [], allergies: ['shellfish'],
    dislikedIngredients: ['asparagus', 'broccoli'],
  };
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
      email, password: await bcrypt.hash(password, 10), name: 'Synthetic meal-plan audit',
      signupSource: 'synthetic-meal-plan-audit', subscriptionTier: 'premium',
      subscriptionStatus: 'active', allergies: options.allergies,
      dislikedIngredients: options.dislikedIngredients,
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

    const started = Date.now();
    const response = await request('/api/meal-plans/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    assert.equal(response.status, 201, `Full weekly generation failed (HTTP ${response.status})`);
    const body = await response.json();
    assert.equal(body.userId, userId);
    assert.equal(body.mealPlanRecipes.length, 21);
    const rawPlan = DAYS.map(day => {
      const entries = body.mealPlanRecipes.filter((entry: { day: string }) => entry.day === day);
      return { day, ...Object.fromEntries(entries.map((entry: {
        mealType: string; servings: number;
        recipe: { title: string; freshIngredients: string; instructions: string; prepTime: string;
          cookTime: string; servings: string; dietaryTags: string[]; calories: number | null };
      }) => {
        assert.equal(entry.servings, options.servings);
        return [entry.mealType, { ...entry.recipe,
          ingredients: entry.recipe.freshIngredients.split('\n'),
          estimatedCalories: entry.recipe.calories,
        }];
      })) };
    });
    const validation = validateMealPlan(rawPlan, options);
    assert.equal(validation.success, true, 'Persisted recipes failed independent safety validation');
    assert.equal(await prisma.recipe.count({ where: { userId } }), 21);
    const saved = await prisma.mealPlan.findUnique({
      where: { id: body.id }, include: { _count: { select: { mealPlanRecipes: true } } },
    });
    assert.equal(saved?.userId, userId);
    assert.equal(saved?._count.mealPlanRecipes, 21);
    const reload = await request(`/api/meal-plans/${encodeURIComponent(body.id)}`);
    assert.equal(reload.status, 200, 'Saved plan could not be reloaded through the website API');
    assert.equal((await reload.json()).mealPlanRecipes.length, 21);
    console.log(JSON.stringify({ ok: true, site: base, authentication: 'website-session',
      status: response.status, days: 7, meals: 21, persisted: true,
      safetyValidated: true, elapsedMs: Date.now() - started,
      serverTiming: response.headers.get('server-timing') }));
  } finally {
    // The schema cascades this disposable user's recipes, plans and sessions.
    try {
      // Covers a committed create whose response was lost in transit.
      const disposable = await prisma.user.findFirst({
        where: { email, signupSource: 'synthetic-meal-plan-audit' }, select: { id: true },
      });
      if (disposable) {
        if (userId) assert.equal(disposable.id, userId);
        await prisma.user.delete({ where: { id: disposable.id } });
        assert.equal(await prisma.user.count({ where: { id: disposable.id } }), 0);
        assert.equal(await prisma.recipe.count({ where: { userId: disposable.id } }), 0);
        assert.equal(await prisma.mealPlan.count({ where: { userId: disposable.id } }), 0);
        console.log('Synthetic account, recipes and plan cleanup verified.');
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(error => {
  // Avoid printing response bodies, credentials, or database connection details.
  console.error(error instanceof assert.AssertionError ? error.message :
    `Live meal-plan verification failed (${error?.name ?? 'Error'}, ${error?.code ?? 'no code'}).`);
  process.exitCode = 1;
});
