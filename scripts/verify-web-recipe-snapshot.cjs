const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

// Run the real website handlers with isolated storage, sessions and provider I/O.
// This verifies a save -> reopen -> edit -> estimate lifecycle without real users.
let state;
let passed = 0;
const facts = { calories: 0, protein: 4.2, carbs: 33, fat: null, fiber: 3, sodium: 0 };
const snapshot = {
  version: 1, source: 'label', detectedAdditives: ['Artificial flavor'], originalProductName: 'Test cereal',
  originalNutrition: { values: facts, basisLabel: 'Per 40 g packet', sourceLabel: 'Test label', servingsPerContainer: null, source: 'label_scan', accuracy: 'exact', reviewRequired: false },
  freshNutrition: { ...facts, calories: 220.4, perServing: true, accuracy: 'estimated', basisLabel: 'Per recipe serving', sourceLabel: 'Original generated estimate' },
};
const input = { title: 'Oatmeal', originalIngredients: 'oats, artificial flavor', freshIngredients: ['1 cup oats', '2 cups milk'], instructions: ['Simmer until cooked.'], servings: '2', comparisonSnapshot: snapshot, estimatedCostPerServing: 1.25, storeBoughtCost: 3 };
const clone = (value) => JSON.parse(JSON.stringify(value));
const params = (id) => ({ params: Promise.resolve({ id }) });
const request = (body, method = 'POST') => new Request('http://localhost/api/recipes', { method, headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
function reset() {
  state = { owner: 'owner-a', rows: new Map(), writes: [], providerCalls: 0, providerHook: null, estimate: facts };
  global.__webRecipeQA = state;
}
const db = { recipe: {
  async create({ data }) {
    const row = clone({ id: 'recipe-' + state.rows.size, updatedAt: '2026-09-24T08:00:00Z', ...data });
    state.rows.set(row.id, row); state.writes.push(data); return clone(row);
  },
  async findFirst({ where }) {
    const row = state.rows.get(where.id);
    return row?.userId === where.userId ? clone(row) : null;
  },
  async update({ where, data }) {
    const row = { ...state.rows.get(where.id), ...clone(data) };
    state.rows.set(where.id, row); state.writes.push(data); return clone(row);
  },
  async updateMany({ where, data }) {
    const row = state.rows.get(where.id);
    if (!row || Object.entries(where).some(([key, value]) => row[key] !== value)) return { count: 0 };
    await this.update({ where, data }); return { count: 1 };
  },
} };
async function bundle() {
  global.__webRecipeDB = db;
  const mocks = {
    '@/lib/db': 'export const prisma = globalThis.__webRecipeDB;',
    '@/lib/auth-options': 'export const authOptions = {};',
    'next-auth': 'export async function getServerSession(){ const id=globalThis.__webRecipeQA.owner; return id?{user:{id}}:null; }',
    '@/lib/ai': "export const AI_API_KEY='synthetic', AI_CHAT_URL='https://provider.example.invalid', MODEL_FAST='synthetic';",
    '@/lib/usda': 'export async function lookupNutrients(){ throw new Error("Unexpected USDA call"); }',
  };
  const built = await build({
    stdin: { contents: "export { POST as save } from './app/api/recipes/route'; export { GET as reopen, PATCH as edit } from './app/api/recipes/[id]/route'; export { POST as nutrition } from './app/api/recipes/[id]/nutrition/route';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'isolated-web-recipes', setup(builder) {
      builder.onResolve({ filter: /^(@\/lib\/(db|auth-options|ai|usda)|next-auth)$/ }, ({ path: name }) => ({ path: name, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path: name }) => ({ contents: mocks[name], loader: 'js' }));
    } }],
  });
  const compiled = new Module(path.resolve('scripts/web-recipe-qa.cjs'), module);
  compiled.filename = path.resolve('scripts/web-recipe-qa.cjs');
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(built.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}
async function check(name, run) { reset(); await run(); passed++; console.log('PASS:', name); }
async function main() {
  const route = await bundle();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, 'https://provider.example.invalid', 'No network calls permitted');
    state.providerCalls++;
    state.providerHook?.();
    const content = state.providerCalls % 2 === 1 ? { ingredients: [] } : state.estimate;
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  };
  async function save(body = input) {
    const response = await route.save(request(body));
    assert.equal(response.status, 201);
    return (await response.json()).recipe;
  }
  try {
    await check('website save/reopen preserves all comparison details, costs and core recipe data', async () => {
      const row = await save({ ...input, userId: 'forged-owner' });
      assert.equal(row.userId, 'owner-a');
      const response = await route.reopen(new Request('http://localhost'), params(row.id));
      const reopened = (await response.json()).recipe;
      assert.deepEqual(reopened.comparisonSnapshot, snapshot);
      assert.deepEqual(JSON.parse(reopened.freshIngredients), input.freshIngredients);
      assert.deepEqual(JSON.parse(reopened.instructions), input.instructions);
      assert.equal(reopened.estimatedCostPerServing, 1.25);
      assert.equal(reopened.storeBoughtCost, 3);
      assert.equal(reopened.calories, 220); assert.equal(reopened.sodium, 0); assert.equal(reopened.fat, null);
    });
    await check('older web/mobile snapshot shapes and saves without comparison remain accepted', async () => {
      const older = clone(snapshot); delete older.detectedAdditives; delete older.originalProductName;
      assert.deepEqual((await save({ ...input, comparisonSnapshot: older })).comparisonSnapshot, older);
      const legacy = await save({ ...input, comparisonSnapshot: undefined });
      assert.equal(legacy.comparisonSnapshot, undefined);
    });
    await check('invalid snapshots and malformed JSON cannot create recipes', async () => {
      for (const invalid of [null, { ...snapshot, version: 2 }, { ...snapshot, source: 'pantry' }, { ...snapshot, detectedAdditives: [42] }, { ...snapshot, originalProductName: 42 }, { ...snapshot, freshNutrition: { ...snapshot.freshNutrition, calories: -1 } }]) {
        assert.equal((await route.save(request({ ...input, comparisonSnapshot: invalid }))).status, 400);
      }
      assert.equal((await route.save(request('{bad json'))).status, 400);
      assert.equal(state.writes.length, 0);
    });
    await check('anonymous and non-owner access is rejected', async () => {
      const row = await save(); state.owner = 'owner-b';
      assert.equal((await route.reopen(new Request('http://localhost'), params(row.id))).status, 404);
      assert.equal((await route.edit(request({ notes: 'Mine' }, 'PATCH'), params(row.id))).status, 404);
      assert.equal((await route.nutrition(new Request('http://localhost'), params(row.id))).status, 404);
      state.owner = null;
      assert.equal((await route.save(request(input))).status, 401);
      assert.equal((await route.nutrition(new Request('http://localhost'), params(row.id))).status, 401);
    });
    await check('notes/rating and equivalent JSON preserve exact nutrition and costs', async () => {
      const row = await save();
      const response = await route.edit(request({ notes: 'Try cinnamon', rating: 5, freshIngredients: JSON.stringify(input.freshIngredients, null, 2) }, 'PATCH'), params(row.id));
      const edited = (await response.json()).recipe;
      assert.deepEqual(edited.comparisonSnapshot, snapshot);
      assert.equal(edited.calories, 220); assert.equal(edited.estimatedCostPerServing, 1.25);
    });
    await check('ingredient edit clears all derived estimates but preserves package facts and additives', async () => {
      const row = await save();
      const response = await route.edit(request({ freshIngredients: JSON.stringify(['1 cup oats', '2 cups water']) }, 'PATCH'), params(row.id));
      const edited = (await response.json()).recipe;
      assert.deepEqual(edited.comparisonSnapshot, { ...snapshot, freshNutrition: null });
      for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'estimatedCostPerServing', 'storeBoughtCost']) assert.equal(edited[key], null, key);
    });
    await check('notes save converting legacy newline ingredients to JSON preserves estimates', async () => {
      const row = await save();
      state.rows.get(row.id).freshIngredients = input.freshIngredients.join('\n');
      const response = await route.edit(request({ notes: 'Legacy format', freshIngredients: JSON.stringify(input.freshIngredients) }, 'PATCH'), params(row.id));
      const edited = (await response.json()).recipe;
      assert.deepEqual(edited.comparisonSnapshot, snapshot);
      assert.equal(edited.calories, 220); assert.equal(edited.estimatedCostPerServing, 1.25);
    });
    await check('legacy recipes also invalidate old nutrition and costs after edits', async () => {
      const row = await save({ ...input, comparisonSnapshot: undefined });
      state.rows.get(row.id).calories = 500;
      await route.edit(request({ freshIngredients: '["water"]' }, 'PATCH'), params(row.id));
      assert.equal(state.rows.get(row.id).calories, null);
      assert.equal(state.rows.get(row.id).estimatedCostPerServing, null);
    });
    await check('nutrition endpoint returns the exact saved snapshot without provider calls', async () => {
      const row = await save();
      const response = await route.nutrition(new Request('http://localhost'), params(row.id));
      assert.deepEqual(await response.json(), snapshot.freshNutrition);
      assert.equal(state.providerCalls, 0);
    });
    await check('legacy zero calorie nutrition stays zero without an unwanted recalculation', async () => {
      const row = await save({ ...input, comparisonSnapshot: undefined });
      Object.assign(state.rows.get(row.id), facts);
      const response = await route.nutrition(new Request('http://localhost'), params(row.id));
      assert.equal((await response.json()).calories, 0); assert.equal(state.providerCalls, 0);
    });
    await check('explicit estimate saves exact fresh values and source while preserving original facts', async () => {
      const row = await save({ ...input, comparisonSnapshot: { ...snapshot, freshNutrition: null } });
      state.estimate = { ...facts, calories: 12.6, protein: 0 };
      const response = await route.nutrition(new Request('http://localhost'), params(row.id));
      assert.equal(response.status, 200);
      const fresh = await response.json();
      assert.equal(fresh.calories, 12.6); assert.equal(fresh.protein, 0); assert.equal(fresh.fat, null);
      const stored = state.rows.get(row.id);
      assert.deepEqual(stored.comparisonSnapshot, { ...snapshot, freshNutrition: fresh });
      assert.equal(stored.calories, 13); assert.equal(stored.protein, 0); assert.equal(stored.sodium, 0);
      const again = await route.nutrition(new Request('http://localhost'), params(row.id));
      assert.deepEqual(await again.json(), fresh); assert.equal(state.providerCalls, 2);
    });
    for (const field of ['freshIngredients', 'servings', 'updatedAt']) {
      await check('concurrent ' + field + ' change prevents stale nutrition persistence', async () => {
        const row = await save({ ...input, comparisonSnapshot: { ...snapshot, freshNutrition: null } });
        state.providerHook = () => { state.rows.get(row.id)[field] = 'changed'; };
        const response = await route.nutrition(new Request('http://localhost'), params(row.id));
        assert.equal(response.status, 409);
        assert.equal(state.rows.get(row.id).comparisonSnapshot.freshNutrition, null);
        assert.equal(state.writes.length, 1);
      });
    }
  } finally {
    global.fetch = originalFetch;
    delete global.__webRecipeQA; delete global.__webRecipeDB;
  }
  console.log(`${passed} website recipe snapshot checks passed. Database and provider are isolated doubles.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
