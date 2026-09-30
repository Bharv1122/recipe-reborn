/* Runs the REAL plugin backend with synthetic database and existing-route boundaries.
 * Never connects to a database or AI provider. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { build } = require('esbuild');
const jwt = require('jsonwebtoken');

async function main() {
  process.env.NEXTAUTH_SECRET = 'local-plugin-test-secret-not-a-real-credential';
  global.fetch = async () => { throw new Error('Network forbidden in plugin backend verification'); };
  let premium = true, exists = true, writeCount = 0, routeStatus = 200;
  let lastBody, routeUser, lastWhere;
  const recipe = { id: 'alice-recipe', title: 'Lentil soup', freshIngredients: '["1/2 cup lentils","2 cups water"]', instructions: '["Simmer at 180 C for 30 minutes."]', dietaryTags: [], servings: '2' };
  const db = {
    user: { findUnique: async ({ where }) => { assert.equal(where.id, 'alice'); return exists ? { subscriptionTier: premium ? 'premium' : 'free', subscriptionStatus: 'active', generationCount: 2 } : null; } },
    recipe: {
      findFirst: async ({ where, select }) => { lastWhere = where; assert.equal(where.userId, 'alice'); if (where.id !== recipe.id) return null; return select.winePairing ? { winePairing: null } : recipe; },
      findMany: async ({ where }) => { lastWhere = where; assert.equal(where.userId, 'alice'); if (where.id) return where.id.in.includes(recipe.id) ? [recipe] : []; return [recipe]; },
    },
    mealPlan: { findMany: async ({ where, select }) => { assert.equal(where.userId, 'alice'); assert.equal(select.mealPlanRecipes.where.recipe.userId, 'alice'); return []; } },
    shoppingList: {
      findMany: async ({ where }) => { assert.equal(where.userId, 'alice'); return []; },
      create: async ({ data }) => { assert.equal(data.userId, 'alice'); writeCount++; return { id: 'list', ...data }; },
    },
    $transaction: async work => work(db),
  };
  global.__pluginDb = db;
  global.__pluginRoute = async (request, kind) => {
    const token = request.headers.get('authorization').slice(7);
    const claims = jwt.verify(token, process.env.NEXTAUTH_SECRET, { audience: 'recipe-reborn-mobile', issuer: 'recipe-reborn', algorithms: ['HS256'] });
    assert.equal(claims.type, 'access'); assert.ok(claims.exp - claims.iat <= 60); routeUser = claims.sub;
    lastBody = await request.json();
    if (routeStatus !== 200) return Response.json({ error: 'Generation limit reached' }, { status: routeStatus });
    if (kind === 'generate') return new Response('data: {"status":"processing"}\n\ndata: {"status":"completed","result":{"title":"Synthetic soup"}}\n\n', { headers: { 'content-type': 'text/event-stream' } });
    return Response.json({ kind, saved: true });
  };
  const result = await build({ entryPoints: ['lib/plugin/backend.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'synthetic-boundaries', setup(b) {
      b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'mock' }));
      b.onResolve({ filter: /^@\/app\/api\/(generate-recipe|meal-plans\/generate|mobile\/recipes)\/route$/ }, a => ({ path: a.path.includes('generate-recipe') ? 'generate' : a.path.includes('meal-plans') ? 'plan' : 'save', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: a.path === 'db' ? 'export const prisma = globalThis.__pluginDb;' : `export const POST = request => globalThis.__pluginRoute(request, ${JSON.stringify(a.path)});`, loader: 'js' }));
    } }],
  });
  const m = new Module(path.resolve('scripts/plugin-backend-fixture.cjs'), module);
  m.filename = path.resolve('scripts/plugin-backend-fixture.cjs'); m.paths = module.paths;
  m._compile(result.outputFiles[0].text, m.filename);
  const { backend, routeResult, scaleLine } = m.exports;
  await backend.search('alice', 'soup', 0); assert.equal(lastWhere.userId, 'alice');
  assert.equal((await backend.recipe('alice', recipe.id)).freshIngredients[0], '1/2 cup lentils');
  await assert.rejects(backend.recipe('alice', 'bob-recipe'), /recipe_not_found/);
  await backend.plans('alice', 0); await backend.shopping('alice', 0);
  const scaled = await backend.scale('alice', recipe.id, 2); assert.equal(scaled.freshIngredients[0], '1 cup lentils'); assert.equal(scaled.instructions[0], 'Simmer at 180 C for 30 minutes.');
  assert.equal(scaleLine('1 (400 g) can tomatoes', 2), '2 (400 g) can tomatoes'); assert.equal(scaleLine('salt to taste', 2), 'salt to taste'); assert.equal(scaleLine('½ cup oil', 2), '1 cup oil');
  assert.equal((await backend.wine('alice', recipe.id)).available, false);
  premium = false; await assert.rejects(backend.wine('alice', recipe.id), /premium_required/);
  await assert.rejects(backend.execute('alice', { kind: 'generate_meal_plan', weekStartDate: '2026-10-05', servings: 2, mealTypes: ['dinner'], dietaryPreferences: [] }), /premium_required/);
  const generated = await backend.execute('alice', { kind: 'generate_recipe', ingredients: 'lentils', dietaryRestriction: 'None' }); assert.equal(generated.saved, false); assert.equal(routeUser, 'alice'); assert.match(lastBody.generationId, /^[a-f0-9-]{36}$/); assert.equal('isSubstitutionRegeneration' in lastBody, false);
  routeStatus = 403; await assert.rejects(backend.execute('alice', { kind: 'generate_recipe', ingredients: 'lentils', dietaryRestriction: 'None' }), /Generation limit reached/); routeStatus = 200;
  premium = true; await backend.execute('alice', { kind: 'generate_meal_plan', weekStartDate: '2026-10-05', servings: 2, mealTypes: ['dinner'], dietaryPreferences: [] }); assert.deepEqual(lastBody.allergies, []); assert.equal(routeUser, 'alice');
  await assert.rejects(backend.execute('alice', { kind: 'create_shopping_list', name: 'List', recipeIds: ['alice-recipe', 'bob-recipe'] }), /recipe_not_found/); assert.equal(writeCount, 0);
  await backend.execute('alice', { kind: 'create_shopping_list', name: 'List', recipeIds: ['alice-recipe'] }); assert.equal(writeCount, 1);
  await assert.rejects(routeResult(new Response('data: {"status":"error","message":"Safety rejected"}\n\n', { headers: { 'content-type': 'text/event-stream' } })), /Safety rejected/);
  exists = false; await assert.rejects(backend.execute('alice', { kind: 'create_shopping_list', name: 'List', recipeIds: ['alice-recipe'] }), /account_not_found/);
  console.log('PASS: real backend ownership, membership, quota propagation, in-process token scope, SSE errors, servings and atomic shopping creation (synthetic boundaries only).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
