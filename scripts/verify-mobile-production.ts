import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';

const baseUrl = (process.env.MOBILE_VERIFY_BASE_URL || 'https://recipereborn.com').replace(/\/$/, '');
const email = `mobile-audit-${Date.now()}@example.com`;
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
  if (process.env.ALLOW_PRODUCTION_SYNTHETIC_TEST !== '1') {
    throw new Error('Set ALLOW_PRODUCTION_SYNTHETIC_TEST=1 to create and clean a synthetic production account.');
  }

  try {
    const [security] = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean }[]>(
      `SELECT relrowsecurity FROM pg_class WHERE oid = 'public."MobilePushToken"'::regclass`,
    );
    const grants = await prisma.$queryRawUnsafe<{ grantee: string; privilege_type: string }[]>(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'MobilePushToken' AND grantee IN ('anon', 'authenticated')`,
    );
    assert.equal(security?.relrowsecurity, true, 'MobilePushToken RLS is not enabled.');
    assert.equal(grants.length, 0, `Unexpected direct MobilePushToken grants: ${JSON.stringify(grants)}`);

    const signup = await jsonRequest('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirmPassword: password, src: 'mobile-production-audit' }),
    });
    assert.equal(signup.response.status, 201, JSON.stringify(signup.body));

    const login = await jsonRequest('/api/mobile/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceName: 'Synthetic API audit', platform: 'ios' }),
    });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const firstTokens = login.body.tokens as { accessToken: string; refreshToken: string };
    assert.ok(firstTokens.accessToken && firstTokens.refreshToken);

    const auth = { Authorization: `Bearer ${firstTokens.accessToken}` };
    const me = await jsonRequest('/api/mobile/auth/me', { headers: auth });
    assert.equal(me.response.status, 200, JSON.stringify(me.body));
    assert.equal(me.body.user.email, email);

    const barcode = await jsonRequest('/api/mobile/barcode/737628064502', { headers: auth });
    assert.equal(barcode.response.status, 200, JSON.stringify(barcode.body));
    assert.equal(barcode.body.found, true);

    const invalidGeneration = await jsonRequest('/api/generate-recipe', {
      method: 'POST', headers: auth, body: JSON.stringify({}),
    });
    assert.equal(invalidGeneration.response.status, 400, 'Invalid generation input reached AI or bypassed validation.');

    const savedRecipe = await jsonRequest('/api/mobile/recipes', {
      method: 'POST', headers: auth, body: JSON.stringify({
        title: 'Synthetic carrot soup', originalIngredients: 'carrots, water',
        freshIngredients: ['2 carrots', '2 cups water'], instructions: ['Simmer safely.'],
        dietaryTags: ['synthetic-audit'], prepTime: '5 min', cookTime: '20 min', servings: '1 serving',
      }),
    });
    assert.equal(savedRecipe.response.status, 201, JSON.stringify(savedRecipe.body));
    const recipeId = savedRecipe.body.recipe.id as string;
    const recipes = await jsonRequest('/api/mobile/recipes', { headers: auth });
    assert.equal(recipes.response.status, 200, JSON.stringify(recipes.body));
    assert.ok(recipes.body.recipes.some((recipe: { id: string }) => recipe.id === recipeId));
    const recipeDetail = await jsonRequest(`/api/mobile/recipes/${recipeId}`, { headers: auth });
    assert.equal(recipeDetail.response.status, 200, JSON.stringify(recipeDetail.body));
    const recipeUpdate = await jsonRequest(`/api/mobile/recipes/${recipeId}`, {
      method: 'PATCH', headers: auth, body: JSON.stringify({ rating: 5, notes: 'Synthetic audit' }),
    });
    assert.equal(recipeUpdate.response.status, 200, JSON.stringify(recipeUpdate.body));

    const collection = await jsonRequest('/api/mobile/collections', {
      method: 'POST', headers: auth, body: JSON.stringify({ name: 'Synthetic favorites' }),
    });
    assert.equal(collection.response.status, 201, JSON.stringify(collection.body));
    const collectionId = collection.body.collection.id as string;
    const collected = await jsonRequest(`/api/mobile/collections/${collectionId}/recipes`, {
      method: 'POST', headers: auth, body: JSON.stringify({ recipeId }),
    });
    assert.equal(collected.response.status, 201, JSON.stringify(collected.body));
    const collectionDetail = await jsonRequest(`/api/mobile/collections/${collectionId}`, { headers: auth });
    assert.equal(collectionDetail.response.status, 200, JSON.stringify(collectionDetail.body));
    assert.equal(collectionDetail.body.collection.collectionRecipes[0].recipe.id, recipeId);

    const mealPlan = await jsonRequest('/api/mobile/meal-plans', {
      method: 'POST', headers: auth, body: JSON.stringify({ name: 'Synthetic week', weekStartDate: new Date().toISOString() }),
    });
    assert.equal(mealPlan.response.status, 201, JSON.stringify(mealPlan.body));
    const mealPlanId = mealPlan.body.mealPlan.id as string;
    const planned = await jsonRequest(`/api/mobile/meal-plans/${mealPlanId}/recipes`, {
      method: 'POST', headers: auth, body: JSON.stringify({ recipeId, day: 'monday', mealType: 'dinner', servings: 1 }),
    });
    assert.equal(planned.response.status, 201, JSON.stringify(planned.body));
    const planDetail = await jsonRequest(`/api/mobile/meal-plans/${mealPlanId}`, { headers: auth });
    assert.equal(planDetail.response.status, 200, JSON.stringify(planDetail.body));
    assert.equal(planDetail.body.mealPlan.mealPlanRecipes[0].servings, 1);

    const pantrySave = await jsonRequest('/api/pantry-inventory', {
      method: 'PUT', headers: auth, body: JSON.stringify({ items: [{ name: 'carrots', quantity: '2', location: 'fridge' }], reviewConfirmed: true }),
    });
    assert.equal(pantrySave.response.status, 200, JSON.stringify(pantrySave.body));
    const pantryGet = await jsonRequest('/api/pantry-inventory', { headers: auth });
    assert.equal(pantryGet.response.status, 200, JSON.stringify(pantryGet.body));
    assert.equal(pantryGet.body.inventory.items[0].name, 'carrots');
    const extractionRequiresPhoto = await jsonRequest('/api/pantry-inventory/extract', { method: 'POST', headers: auth });
    assert.equal(extractionRequiresPhoto.response.status, 400, 'Photo extraction accepted a request with no review source photo.');

    const pushToken = `ExpoPushToken[synthetic_${crypto.randomBytes(12).toString('hex')}]`;
    const pushRegistered = await jsonRequest('/api/mobile/push-tokens', {
      method: 'PUT', headers: auth, body: JSON.stringify({ token: pushToken, platform: 'ios', deviceName: 'Synthetic audit' }),
    });
    assert.equal(pushRegistered.response.status, 200, JSON.stringify(pushRegistered.body));
    const pushDeleted = await jsonRequest('/api/mobile/push-tokens', {
      method: 'DELETE', headers: auth, body: JSON.stringify({ token: pushToken }),
    });
    assert.equal(pushDeleted.response.status, 200, JSON.stringify(pushDeleted.body));

    const subscription = await jsonRequest('/api/mobile/account/subscription', { headers: auth });
    assert.equal(subscription.response.status, 200, JSON.stringify(subscription.body));

    const createdList = await jsonRequest('/api/mobile/shopping-lists', {
      method: 'POST', headers: auth, body: JSON.stringify({ name: 'Synthetic mobile audit' }),
    });
    assert.equal(createdList.response.status, 201, JSON.stringify(createdList.body));
    const listId = createdList.body.id as string;

    const createdItem = await jsonRequest(`/api/mobile/shopping-lists/${listId}/items`, {
      method: 'POST', headers: auth, body: JSON.stringify({ ingredient: 'carrots', quantity: '2' }),
    });
    assert.equal(createdItem.response.status, 201, JSON.stringify(createdItem.body));
    const itemId = createdItem.body.id as string;

    const toggled = await jsonRequest(`/api/mobile/shopping-lists/${listId}/items/${itemId}`, {
      method: 'PATCH', headers: auth, body: JSON.stringify({ checked: true }),
    });
    assert.equal(toggled.response.status, 200, JSON.stringify(toggled.body));
    assert.equal(toggled.body.checked, true);

    const refresh = await jsonRequest('/api/mobile/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken: firstTokens.refreshToken }),
    });
    assert.equal(refresh.response.status, 200, JSON.stringify(refresh.body));
    const rotatedTokens = refresh.body.tokens as { accessToken: string; refreshToken: string };
    assert.notEqual(rotatedTokens.refreshToken, firstTokens.refreshToken);

    const replay = await jsonRequest('/api/mobile/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken: firstTokens.refreshToken }),
    });
    assert.equal(replay.response.status, 401, 'A rotated refresh token was accepted twice.');

    const logout = await jsonRequest('/api/mobile/auth/logout', {
      method: 'POST', body: JSON.stringify({ refreshToken: rotatedTokens.refreshToken }),
    });
    assert.equal(logout.response.status, 200, JSON.stringify(logout.body));

    const loginForDeletion = await jsonRequest('/api/mobile/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, deviceName: 'Synthetic deletion audit', platform: 'android' }),
    });
    assert.equal(loginForDeletion.response.status, 200, JSON.stringify(loginForDeletion.body));
    const deleteAuth = { Authorization: `Bearer ${loginForDeletion.body.tokens.accessToken}` };
    const wrongDeletion = await jsonRequest('/api/mobile/account/delete', {
      method: 'POST', headers: deleteAuth, body: JSON.stringify({ password: 'wrong-password', confirmation: 'DELETE' }),
    });
    assert.equal(wrongDeletion.response.status, 403, 'Account deletion accepted an incorrect password.');
    const deletion = await jsonRequest('/api/mobile/account/delete', {
      method: 'POST', headers: deleteAuth, body: JSON.stringify({ password, confirmation: 'DELETE' }),
    });
    assert.equal(deletion.response.status, 200, JSON.stringify(deletion.body));

    console.log(JSON.stringify({
      signup: signup.response.status,
      login: login.response.status,
      me: me.response.status,
      barcode: barcode.response.status,
      shopping: toggled.response.status,
      recipes: recipeUpdate.response.status,
      collections: collectionDetail.response.status,
      mealPlans: planDetail.response.status,
      pantryReviewSave: pantrySave.response.status,
      pushRegistration: pushRegistered.response.status,
      subscription: subscription.response.status,
      refreshRotation: refresh.response.status,
      replayBlocked: replay.response.status,
      logout: logout.response.status,
      accountDeletionGuard: wrongDeletion.response.status,
      accountDeletion: deletion.response.status,
      mobilePushTokenRls: security.relrowsecurity,
      directClientGrants: grants.length,
    }));
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    const remaining = await prisma.user.count({ where: { email } });
    assert.equal(remaining, 0, 'Synthetic audit account cleanup failed.');
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
