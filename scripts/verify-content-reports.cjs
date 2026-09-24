const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

// Exercise the actual route with Request streams and Zod, isolating persistence
// and rate limiting. No credentials, customer records or network calls.
class MobileAuthError extends Error {}
let state;
const reset = () => { state = { user: 'test-owner', exists: true, limited: false, stored: [], recent: 0, owned: true, fail: false, locks: 0, transactionCalls: 0 }; };
const canonical = { title: 'Owned soup', freshIngredients: '["carrot"]', instructions: '["Cook safely."]' };
const dependencies = {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  zod: require('zod'),
  '@/lib/mobile-auth': { MobileAuthError, requireMobileUserId: () => { if (!state.user) throw new MobileAuthError(); return state.user; } },
  '@/lib/rate-limit': { rateLimit: async () => ({ success: !state.limited }) },
  '@/lib/db': { prisma: { $transaction: async callback => {
    state.transactionCalls++;
    let locked = false;
    return callback({
      $queryRaw: async (parts, owner) => {
        assert.match(parts.join('?'), /WHERE "id" = \? FOR UPDATE$/);
        assert.equal(owner, 'test-owner');
        locked = true; state.locks++;
        return state.exists ? [{ id: owner }] : [];
      },
      recipe: { findFirst: async ({ where, select }) => {
        assert.equal(locked, true);
        assert.equal(where.userId, 'test-owner');
        assert.equal(where.id, 'saved-recipe');
        assert.equal(select.title, true);
        return state.owned ? canonical : null;
      } },
      recipeReport: {
        count: async ({ where }) => {
          assert.equal(locked, true, 'Count must run after the owner lock');
          assert.equal(where.userId, 'test-owner');
          assert.ok(where.createdAt.gte instanceof Date);
          return state.recent;
        },
        create: async ({ data, select }) => {
          assert.equal(locked, true);
          assert.equal(select.id, true);
          if (state.fail) throw new Error('Synthetic database failure');
          state.stored.push(data); state.recent++;
          return { id: 'stored-report-id' };
        },
      },
    });
  } } },
};
const compiled = esbuild.transformSync(fs.readFileSync('app/api/mobile/recipe-reports/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
const sandbox = { module: { exports: {} }, Request, Response, TextDecoder, Uint8Array, Date, console: { error() {} } };
sandbox.exports = sandbox.module.exports;
sandbox.require = name => { assert(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`); return dependencies[name]; };
vm.runInNewContext(compiled, sandbox);
const post = (body, headers = {}) => sandbox.module.exports.POST(new Request('https://test.invalid/api/mobile/recipe-reports', {
  method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const recipe = { title: 'Fresh soup', freshIngredients: ['carrot'], instructions: ['Cook safely.'] };
let checks = 0;
async function expectStatus(body, expected, headers) { const result = await post(body, headers); assert.equal(result.status, expected); checks++; return result; }

(async () => {
  reset(); state.user = null;
  await expectStatus({ source: 'chat', reason: 'unsafe', message: 'selected' }, 401);
  assert.equal(state.transactionCalls, 0);
  reset(); state.limited = true;
  await expectStatus('{bad json', 429);
  assert.equal(state.transactionCalls, 0);
  reset();
  for (const body of [
    '{bad json',
    { source: 'chat', reason: 'invalid', message: 'selected' },
    { source: 'chat', reason: 'unsafe', message: '' },
    { source: 'chat', reason: 'unsafe', message: 'x'.repeat(16001) },
    { source: 'chat', reason: 'unsafe', message: 'selected', details: 'x'.repeat(501) },
    { source: 'chat', reason: 'unsafe', message: 'selected', userId: 'other-owner' },
    { source: 'chat', reason: 'unsafe', message: 'selected', messages: ['private full conversation'] },
    { source: 'generated', reason: 'unsafe', recipe: { ...recipe, instructions: [] } },
  ]) await expectStatus(body, 400);
  assert.equal(state.stored.length, 0);
  await expectStatus('x', 413, { 'content-length': '131073' });
  await expectStatus('x'.repeat(131073), 413, { 'content-length': '1' });
  assert.equal(state.transactionCalls, 0);
  reset();
  const generated = await expectStatus({ source: 'generated', reason: 'allergen', details: '  selected note  ', recipe }, 201);
  assert.deepEqual(await generated.json(), { ok: true, id: 'stored-report-id' });
  assert.equal(state.stored[0].userId, 'test-owner');
  assert.equal(state.stored[0].details, 'selected note');
  assert.equal(state.stored[0].recipeId, null);
  assert.equal(state.stored[0].recipeSnapshot.title, 'Fresh soup');
  reset();
  await expectStatus({ source: 'saved', reason: 'incorrect', recipeId: 'saved-recipe', recipe }, 201);
  assert.equal(state.stored[0].recipeTitle, 'Owned soup');
  assert.equal(state.stored[0].recipeSnapshot, canonical);
  reset(); state.owned = false;
  await expectStatus({ source: 'saved', reason: 'unsafe', recipeId: 'saved-recipe' }, 404);
  assert.equal(state.stored.length, 0);
  reset();
  await expectStatus({ source: 'chat', reason: 'offensive', message: ' selected assistant response ' }, 201);
  assert.equal(state.stored[0].recipeTitle, 'AI Chef response');
  assert.deepEqual(JSON.parse(JSON.stringify(state.stored[0].recipeSnapshot)), { kind: 'chat', content: 'selected assistant response' });
  assert.equal(state.stored[0].recipeId, null);
  assert.equal(state.stored[0].details, null);
  assert.equal(state.locks, 1);
  reset(); state.recent = 9;
  await expectStatus({ source: 'chat', reason: 'other', message: 'tenth report' }, 201);
  await expectStatus({ source: 'chat', reason: 'other', message: 'eleventh report' }, 429);
  assert.equal(state.stored.length, 1);
  reset(); state.exists = false;
  await expectStatus({ source: 'chat', reason: 'other', message: 'deleted account' }, 401);
  assert.equal(state.stored.length, 0);
  reset(); state.fail = true;
  const failed = await expectStatus({ source: 'chat', reason: 'other', message: 'storage failure' }, 500);
  assert.equal((await failed.json()).ok, undefined);
  assert.equal(state.stored.length, 0);
  console.log(`PASS: ${checks} actual content-report handler checks; auth, bounded streams, strict validation, canonical ownership, selected-only chat, transaction lock/cap and persistence failure.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
