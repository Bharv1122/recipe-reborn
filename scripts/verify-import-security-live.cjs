const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');

async function main() {
  assert.equal(process.env.ALLOW_PRODUCTION_SYNTHETIC_TEST, '1');
  const accounts = [];
  async function request(path, { token, body, method = 'POST', multipart = false } = {}) {
    const response = await fetch(`https://recipereborn.com${path}`, {
      method, headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), 'x-recipe-partial-review': '1' },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(65000),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function account() {
    const value = { email: `import-security-${randomUUID()}@example.com`, password: `Audit-${randomUUID()}!` };
    const signup = await request('/api/signup', { body: { ...value, confirmPassword: value.password, adultConfirmed: true, src: 'synthetic-import-security-audit' } });
    assert.equal(signup.status, 201);
    accounts.push(value);
    await login(value);
    return value;
  }
  async function login(value) {
    const response = await request('/api/mobile/auth/login', { body: { email: value.email, password: value.password, platform: 'android' } });
    assert.equal(response.status, 200);
    value.token = response.body.tokens.accessToken;
    value.id = response.body.user.id;
  }
  try {
    for (const path of ['/api/import-recipe', '/api/mobile/recipes', '/api/recipes']) {
      for (const token of [undefined, 'invalid-token']) {
        assert.equal((await request(path, { token, body: {} })).status, 401, `Unauthenticated ${path}`);
      }
    }
    console.log('PASS unauthenticated and invalid-token import/save rejection');
    const owner = await account();
    const stranger = await account();
    const token = owner.token;
    for (const url of ['http://example.com/recipe', 'https://127.0.0.1/recipe', 'https://169.254.169.254/latest/meta-data/']) {
      const response = await request('/api/import-recipe', { token, body: { url } });
      assert.equal(response.status, 400, `Blocked non-public import ${url}`);
    }
    const fake = new FormData();
    fake.append('file', new Blob(['not an image'], { type: 'image/jpeg' }), 'fake.jpg');
    assert.equal((await request('/api/import-recipe', { token, body: fake, multipart: true })).status, 415);
    console.log('PASS URL-import private-address protections and mismatched file rejection');
    const photo = new FormData();
    photo.append('file', new Blob([fs.readFileSync('outputs/security-import-audit/typed-and-script-recipe.png')], { type: 'image/png' }), 'recipe.png');
    const extracted = await request('/api/import-recipe', { token, body: photo, multipart: true });
    assert.equal(extracted.status, 200, JSON.stringify(extracted.body));
    const recipe = extracted.body.recipe;
    assert.match(recipe.title, /carrot/i);
    assert.match(recipe.instructions, /mash/i, 'Script-font cooking step must be transcribed');
    assert.match(JSON.stringify(recipe), /butter/i, 'Script-font addition must survive');
    const lines = text => Array.isArray(text) ? text : text.split('\n').filter(Boolean);
    const source = { title: recipe.title, freshIngredients: lines(recipe.freshIngredients), instructions: lines(recipe.instructions), dietaryTags: [], prepTime: recipe.prepTime, cookTime: recipe.cookTime, servings: recipe.servings };
    const saved = await request('/api/mobile/recipes', { token, body: { ...source, originalIngredients: recipe.originalIngredients, librarySource: 'imported', importSourceSnapshot: source, userId: stranger.id } });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.equal(saved.body.recipe.userId, owner.id, 'Request cannot override recipe owner');
    const id = saved.body.recipe.id;
    const path = `/api/mobile/recipes/${id}`;
    const reopened = await request(path, { token, method: 'GET' });
    assert.equal(reopened.status, 200);
    assert.deepEqual(reopened.body.recipe.importSourceSnapshot, source);
    assert.deepEqual(JSON.parse(reopened.body.recipe.instructions), source.instructions);
    console.log('PASS actual PNG extraction of typed/script text, save and reopen preserving source');
    const partial = await request('/api/import-recipe', { token, body: { text: 'Ingredients only: 1 cup flour; 1 egg. This card contains no cooking directions.' } });
    assert.equal(partial.status, 200, JSON.stringify(partial.body));
    assert.equal(partial.body.status, 'partial');
    assert.equal(partial.body.quotaUsed, false);
    assert.equal(partial.body.recipe.instructions, '');
    assert.equal((await request('/api/mobile/recipes', { token, method: 'GET' })).body.recipes.length, 1, 'Extraction must never silently save');
    console.log('PASS text partial import preserves ingredients without invented steps, quota charge, or automatic save');
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      assert.equal((await request(path, { token: stranger.token, method, ...(method === 'PATCH' ? { body: { notes: 'unauthorized' } } : {}) })).status, 404, `Cross-account ${method}`);
    }
    const bulk = await request('/api/recipes/library', { token: stranger.token, method: 'PATCH', body: { action: 'remove', recipeIds: [id] } });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.body.removed, 0);
    assert.equal((await request('/api/mobile/recipes', { token: stranger.token, method: 'GET' })).body.recipes.some(r => r.id === id), false);
    assert.ok((await request(path, { token, method: 'GET' })).body.recipe.savedAt);
    console.log('PASS cross-account read/edit/delete/list/bulk removal isolation and owner spoofing rejection');
    const cookies = new Map();
    async function web(path, init = {}) {
      const response = await fetch(`https://recipereborn.com${path}`, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...init.headers } });
      for (const line of response.headers.getSetCookie()) { const pair = line.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
      return response;
    }
    const csrf = await (await web('/api/auth/csrf')).json();
    const webLogin = await web('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: owner.email, password: owner.password, csrfToken: csrf.csrfToken, callbackUrl: 'https://recipereborn.com/recipes', json: 'true' }) });
    assert.equal(webLogin.status, 200);
    assert.equal((await (await web('/api/auth/session')).json()).user.id, owner.id);
    const webPayload = { ...source, originalIngredients: recipe.originalIngredients, librarySource: 'imported', importSourceSnapshot: source };
    const webSave = body => web('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await webSave({ ...webPayload, instructions: [] })).status, 400);
    const webSaved = await webSave(webPayload);
    assert.equal(webSaved.status, 201);
    const webRow = (await webSaved.json()).recipe;
    const webRead = await web(`/api/recipes/${webRow.id}`);
    assert.equal(webRead.status, 200);
    assert.deepEqual((await webRead.json()).recipe.importSourceSnapshot, source);
    console.log('PASS real website sign-in, malformed-save rejection, valid import save/reopen');
    const jsonPost = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const collectionResponse = await web('/api/collections', jsonPost({ name: 'Synthetic privacy audit', description: 'Temporary synthetic recipe only' }));
    assert.equal(collectionResponse.status, 201);
    const collection = await collectionResponse.json();
    const addRecipe = await web(`/api/collections/${collection.id}/recipes`, jsonPost({ recipeId: webRow.id }));
    assert.equal(addRecipe.status, 201);
    const shared = await web(`/api/collections/${collection.id}/share`, jsonPost({}));
    assert.equal(shared.status, 200);
    const share = await shared.json();
    const publicRead = await request(`/api/collections/public/${share.shareToken}`, { method: 'GET' });
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.body.collectionRecipes[0].recipe.title, source.title);
    assert.doesNotMatch(JSON.stringify(publicRead.body), /"(?:userId|email|notes|collectionId|recipeId|shareToken|createdAt|addedAt)"/);
    assert.equal((await web(`/api/collections/${collection.id}/share`, jsonPost({}))).status, 200);
    assert.equal((await request(`/api/collections/public/${share.shareToken}`, { method: 'GET' })).status, 404);
    console.log('PASS public collection privacy, display fields, and revoked-link rejection');
    assert.equal(reopened.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(reopened.headers.get('x-frame-options'), 'DENY');
    assert.ok(reopened.headers.get('strict-transport-security'));
    console.log('PASS live security headers');
  } finally {
    for (const value of accounts) {
      if (!value.token) await login(value);
      const removed = await request('/api/mobile/account/delete', { token: value.token, body: { password: value.password, confirmation: 'DELETE' } });
      assert.equal(removed.status, 200, 'Test account cleanup failed');
    }
    console.log(`PASS deleted ${accounts.length} temporary accounts and their recipes`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
