const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function main() {
  if (process.env.ALLOW_PRODUCTION_SYNTHETIC_TEST !== '1') throw new Error('Synthetic test opt-in required');
  const email = `save-audit-${randomUUID()}@example.com`;
  const password = `Audit-${randomUUID()}!`;
  let token;
  let created = false;
  async function request(path, body, method = 'POST') {
    const response = await fetch(`https://recipereborn.com${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000),
    });
    return { status: response.status, body: await response.json() };
  }
  async function login() {
    const result = await request('/api/mobile/auth/login', { email, password, deviceName: 'Synthetic recipe-save audit', platform: 'android' });
    assert.equal(result.status, 200);
    token = result.body.tokens.accessToken;
  }
  try {
    const signup = await request('/api/signup', { email, password, confirmPassword: password, adultConfirmed: true, src: 'mobile-save-audit' });
    assert.equal(signup.status, 201);
    created = true;
    await login();
    const recipe = {
      title: 'Synthetic save regression soup', originalIngredients: 'carrots, water',
      freshIngredients: ['2 carrots', '2 cups water'], instructions: ['Chop the carrots.', 'Simmer in water until tender.'],
      dietaryTags: null, prepTime: null, cookTime: null, servings: null, estimatedCostPerServing: null, storeBoughtCost: null,
      comparisonSnapshot: { version: 1, source: 'label', freshNutrition: null, originalNutrition: {
        values: { calories: 40, protein: null, carbs: 9, fat: 0, fiber: 2, sodium: 0 },
        basisLabel: 'Per serving', sourceLabel: 'Synthetic label', servingsPerContainer: 0,
        source: 'label_scan', accuracy: 'exact', reviewRequired: true,
      } },
    };
    const saved = await request('/api/mobile/recipes', recipe);
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    const reopened = await request(`/api/mobile/recipes/${saved.body.recipe.id}`, undefined, 'GET');
    assert.equal(reopened.status, 200);
    assert.deepEqual(JSON.parse(reopened.body.recipe.instructions), recipe.instructions);
    assert.equal(reopened.body.recipe.comparisonSnapshot.originalNutrition.servingsPerContainer, null);
    assert.deepEqual(reopened.body.recipe.dietaryTags, []);
    const rejected = await request('/api/mobile/recipes', { ...recipe, instructions: [] });
    assert.equal(rejected.status, 400);
    assert.deepEqual(rejected.body.fields, ['instructions']);
    const metadata = 'Handwritten timing note: '.padEnd(100, 'x');
    const source = { title: recipe.title, freshIngredients: recipe.freshIngredients, instructions: recipe.instructions, dietaryTags: [], prepTime: metadata, cookTime: metadata, servings: metadata };
    const imported = await request('/api/mobile/recipes', { ...source, originalIngredients: recipe.originalIngredients, librarySource: 'imported', importSourceSnapshot: source });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const importedRead = await request(`/api/mobile/recipes/${imported.body.recipe.id}`, undefined, 'GET');
    assert.equal(importedRead.status, 200);
    assert.equal(importedRead.body.recipe.prepTime, metadata);
    assert.deepEqual(importedRead.body.recipe.importSourceSnapshot, source);
    console.log('PASS: imported recipe saves and reopens with full 100-character metadata and original source.');
    console.log('PASS: live mobile save, reopen, optional metadata normalization, required-field validation.');
  } finally {
    if (created) {
      if (!token) await login();
      const deleted = await request('/api/mobile/account/delete', { password, confirmation: 'DELETE' });
      assert.equal(deleted.status, 200, 'Synthetic account cleanup failed');
      assert.equal(deleted.body.deleted, true);
      console.log('PASS: temporary account and test recipes deleted.');
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
