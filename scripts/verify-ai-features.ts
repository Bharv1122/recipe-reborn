import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';

const baseUrl = (process.env.RECIPE_REBORN_VERIFY_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = `ai-feature-audit-${Date.now()}@example.com`;
const password = `Audit-${crypto.randomBytes(12).toString('hex')}!`;

async function jsonRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function main() {
  if (process.env.ALLOW_SYNTHETIC_AI_TEST !== '1') {
    throw new Error('Set ALLOW_SYNTHETIC_AI_TEST=1 to run and clean the synthetic AI feature check.');
  }

  let accountCreated = false;
  let primaryError: unknown;
  try {
    const signup = await jsonRequest('/api/signup', {
      method: 'POST', body: JSON.stringify({ email, password, confirmPassword: password, src: 'ai-feature-audit' }),
    });
    assert.equal(signup.response.status, 201, JSON.stringify(signup.body));
    accountCreated = true;
    await prisma.user.update({
      where: { email },
      data: { subscriptionTier: 'premium', allergies: ['fish'], dislikedIngredients: ['olives'] },
    });

    const login = await jsonRequest('/api/mobile/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, deviceName: 'Synthetic AI audit', platform: 'android' }),
    });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const auth = { Authorization: `Bearer ${login.body.tokens.accessToken}` };

    const chat = await jsonRequest('/api/mobile/chat', {
      method: 'POST', headers: auth, body: JSON.stringify({ messages: [{ role: 'user', content: 'What can I use instead of olives in a simple pasta?' }] }),
    });
    assert.equal(chat.response.status, 200, JSON.stringify(chat.body));
    assert.equal(chat.body.message.role, 'assistant');
    assert.ok(String(chat.body.message.content).trim().length > 10);

    const recipe = await jsonRequest('/api/mobile/recipes', {
      method: 'POST', headers: auth, body: JSON.stringify({
        title: 'Synthetic rice bowl', originalIngredients: 'rice, beans, carrots',
        freshIngredients: ['1 cup rice', '1 cup black beans', '2 carrots'], instructions: ['Cook the rice.', 'Add the beans and carrots.'],
        prepTime: '10 min', cookTime: '20 min', servings: '2', dietaryTags: ['synthetic-audit'],
      }),
    });
    assert.equal(recipe.response.status, 201, JSON.stringify(recipe.body));

    const plan = await jsonRequest('/api/mobile/meal-plans', {
      method: 'POST', headers: auth, body: JSON.stringify({ name: 'Synthetic replacement week', weekStartDate: new Date().toISOString() }),
    });
    assert.equal(plan.response.status, 201, JSON.stringify(plan.body));
    const added = await jsonRequest(`/api/mobile/meal-plans/${plan.body.mealPlan.id}/recipes`, {
      method: 'POST', headers: auth, body: JSON.stringify({ recipeId: recipe.body.recipe.id, day: 'monday', mealType: 'dinner', servings: 2 }),
    });
    assert.equal(added.response.status, 201, JSON.stringify(added.body));

    const replacement = await jsonRequest(`/api/meal-plans/${plan.body.mealPlan.id}/recipes/${added.body.entry.id}/replace`, {
      method: 'POST', headers: auth,
    });
    assert.equal(replacement.response.status, 200, JSON.stringify(replacement.body));
    assert.notEqual(replacement.body.entry.recipe.id, recipe.body.recipe.id);
    assert.notEqual(String(replacement.body.entry.recipe.title).toLowerCase(), 'synthetic rice bowl');
    assert.equal(replacement.body.entry.servings, 2);

    const oldRecipe = await jsonRequest(`/api/mobile/recipes/${recipe.body.recipe.id}`, { headers: auth });
    assert.equal(oldRecipe.response.status, 200, 'Replacing a plan entry should not delete the previously saved recipe.');
    console.log('AI feature verification passed: authenticated chat answered, meal replacement generated a different safe recipe, the plan entry changed, and the prior saved recipe remained.');
  } catch (error) {
    primaryError = error;
  } finally {
    if (accountCreated) {
      try {
        await prisma.user.deleteMany({ where: { email } });
        assert.equal(await prisma.user.count({ where: { email } }), 0, 'Synthetic AI audit cleanup failed.');
      } catch (cleanupError) {
        if (!primaryError) primaryError = cleanupError;
        else console.error('Synthetic AI audit cleanup also failed:', cleanupError);
      }
    }
    await prisma.$disconnect();
  }
  if (primaryError) throw primaryError;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
