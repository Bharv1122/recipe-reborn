import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { recipeComparisonSchema } from '../lib/recipe-comparison-validation';
import { originalNutritionFromLabelScan } from '../shared/nutrition-facts';

// Execute the real handlers against a JSON-round-tripping repository double.
// No live database, user account, model or network request is used.
async function main() {
  let owner: string | null = 'owner-a';
  const rows = new Map<string, Record<string, any>>();
  const db = {
    recipe: {
      async create({ data }: any) {
        const row = JSON.parse(JSON.stringify({ id: `recipe-${rows.size}`, ...data }));
        rows.set(row.id, row);
        return row;
      },
      async findFirst({ where }: any) {
        const row = rows.get(where.id);
        return row?.userId === where.userId ? structuredClone(row) : null;
      },
      async update({ where, data }: any) {
        const row = { ...rows.get(where.id), ...JSON.parse(JSON.stringify(data)) };
        rows.set(where.id, row);
        return row;
      },
    },
  };
  const scope = globalThis as typeof globalThis & { __comparisonDb?: unknown; __comparisonOwner?: () => string | null };
  scope.__comparisonDb = db;
  scope.__comparisonOwner = () => owner;
  const bundle = await build({
    stdin: { contents: `export { POST } from './app/api/mobile/recipes/route'; export { GET } from './app/api/mobile/recipes/[id]/route'; export { PATCH } from './app/api/recipes/[id]/route';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'isolated-repository', setup(builder) {
      builder.onResolve({ filter: /^(@\/lib\/(db|mobile-auth|auth-options)|next-auth)$/ }, ({ path }) => ({ path, namespace: 'test-double' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-double' }, ({ path }) => ({ contents:
        path.endsWith('/db') ? 'export const prisma = globalThis.__comparisonDb;' :
        path.endsWith('/mobile-auth') ? 'export class MobileAuthError extends Error {} export function requireMobileUserId(){const id=globalThis.__comparisonOwner();if(!id)throw new MobileAuthError();return id;}' :
        path === 'next-auth' ? 'export async function getServerSession(){const id=globalThis.__comparisonOwner();return id?{user:{id}}:null;}' : 'export const authOptions = {};', loader: 'js' }));
    } }],
  });
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<Response>> };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { POST, GET, PATCH } = module.exports;
  const send = (body: unknown, method = 'POST') => new Request('http://localhost/api/mobile/recipes', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const facts = { calories: 0, protein: 4, carbs: 33, fat: null, fiber: 3, sodium: 240 };
  const snapshot = {
    version: 1, source: 'label',
    originalNutrition: { values: facts, basisLabel: 'Per 40 g packet', sourceLabel: 'Test label', servingsPerContainer: null, source: 'label_scan', accuracy: 'exact', reviewRequired: false },
    freshNutrition: { ...facts, calories: 220, perServing: true, accuracy: 'estimated', basisLabel: 'Per recipe serving', sourceLabel: 'Test estimate' },
  };
  const recipe = { title: 'Oatmeal', originalIngredients: 'oats, artificial flavor', freshIngredients: ['1 cup oats', '2 cups milk'], instructions: ['Simmer until cooked.'], servings: '2', comparisonSnapshot: snapshot };
  const created = await POST(send({ ...recipe, userId: 'someone-else' }));
  assert.equal(created.status, 201);
  const saved = (await created.json()).recipe;
  assert.equal(saved.userId, 'owner-a');
  const params = { params: Promise.resolve({ id: saved.id }) };
  const loaded = await GET(new Request('http://localhost'), params);
  assert.equal(loaded.status, 200);
  assert.deepEqual((await loaded.json()).recipe.comparisonSnapshot, snapshot, 'Save and reopen must preserve package, zero, null and estimate values.');

  const missingReview = structuredClone(snapshot) as any;
  delete missingReview.originalNutrition.reviewRequired;
  assert.equal(recipeComparisonSchema.parse(missingReview).originalNutrition?.reviewRequired, true);
  for (const invalid of [
    { ...snapshot, version: 2 },
    { ...snapshot, source: 'pantry' },
    { ...snapshot, originalNutrition: { ...snapshot.originalNutrition, values: { ...facts, sodium: -1 } } },
    { ...snapshot, originalNutrition: { ...snapshot.originalNutrition, values: { ...facts, calories: '0' } } },
    { ...snapshot, freshNutrition: { ...snapshot.freshNutrition, accuracy: 'exact' } },
  ]) assert.equal((await POST(send({ ...recipe, comparisonSnapshot: invalid }))).status, 400);
  assert.equal(rows.size, 1, 'Rejected input must not create recipes.');

  owner = 'owner-b';
  assert.equal((await GET(new Request('http://localhost'), params)).status, 404);
  assert.equal((await PATCH(send({ notes: 'not mine' }, 'PATCH'), params)).status, 404);
  owner = null;
  assert.equal((await POST(send(recipe))).status, 401);
  assert.equal((await GET(new Request('http://localhost'), params)).status, 401);
  owner = 'owner-a';

  assert.equal((await POST(send({ ...recipe, comparisonSnapshot: undefined }))).status, 201, 'Older clients remain accepted.');
  assert.equal((await POST(send({ ...recipe, comparisonSnapshot: { version: 1, source: 'pantry', originalNutrition: null, freshNutrition: null } }))).status, 201);
  const note = await PATCH(send({ notes: 'Try cinnamon' }, 'PATCH'), params);
  assert.deepEqual((await note.json()).recipe.comparisonSnapshot, snapshot, 'Notes must not discard nutrition.');
  const unchanged = await PATCH(send({ freshIngredients: JSON.stringify(recipe.freshIngredients) }, 'PATCH'), params);
  assert.deepEqual((await unchanged.json()).recipe.comparisonSnapshot, snapshot);
  const changed = await PATCH(send({ freshIngredients: JSON.stringify(['1 cup oats', '2 cups water']) }, 'PATCH'), params);
  assert.equal(changed.status, 200);
  const afterEdit = (await changed.json()).recipe.comparisonSnapshot;
  assert.equal(afterEdit.freshNutrition, null, 'Ingredient edits must invalidate the previous estimate.');
  assert.deepEqual(afterEdit.originalNutrition, snapshot.originalNutrition, 'Ingredient edits must preserve original package facts.');
  for (const [scannedCount, expectedCount] of [
    [undefined, null], [null, null], [0, null], [-1, null], [NaN, null], [Infinity, null],
    ['unreadable', null], [2.5, 2.5], ['3.5', 3.5], [8, 8],
  ] as const) {
    const originalNutrition = originalNutritionFromLabelScan({ calories: 100, servingsPerContainer: scannedCount });
    assert(originalNutrition, 'Usable nutrient values must survive an unknown serving count.');
    assert.equal(originalNutrition.servingsPerContainer, expectedCount);
    assert.equal(originalNutrition.reviewRequired, true);
    const response = await POST(send({ ...recipe, comparisonSnapshot: { ...snapshot, originalNutrition } }));
    assert.equal(response.status, 201, 'Optional scanned serving metadata must not block saving the recipe.');
    const createdScan = (await response.json()).recipe;
    const reopenedScan = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: createdScan.id }) });
    assert.equal((await reopenedScan.json()).recipe.comparisonSnapshot.originalNutrition.servingsPerContainer, expectedCount);
  }
  delete scope.__comparisonDb;
  delete scope.__comparisonOwner;
  console.log('Comparison regression checks passed: save/reopen, validation, ownership, legacy saves, estimate invalidation and scanned serving-count normalization/persistence. Database is a test double; deployment/device QA is separate.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
