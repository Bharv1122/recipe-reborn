const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

// Exercise the real auxiliary routes and the real lib/ai-provider transport.
// Only auth, storage, rate limits, USDA and network I/O are synthetic: no paid
// calls, no database, no accounts.
const mocks = {
  'next-auth': `export async function getServerSession() { return { user: { id: 'synthetic', email: 'synthetic@example.invalid' } }; }`,
  'next-auth/next': `export async function getServerSession() { return { user: { id: 'synthetic', email: 'synthetic@example.invalid' } }; }`,
  '@/lib/auth-options': `export const authOptions = {};`,
  '@/lib/request-auth': `export async function getRequestUserId() { return 'synthetic'; }`,
  '@/lib/rate-limit': `export async function rateLimit() { return { success: true }; } export function getClientIp() { return '203.0.113.9'; }`,
  '@/lib/ai-rate-limit': `export async function limitAiRequest() { return null; }`,
  '@/lib/guest-rate-limit': `export async function checkGuestLimit() { return { allowed: true, remaining: 2 }; }`,
  '@/lib/guest-recipe-handoff': `export const guestRecipeHandoffRecipeSchema = { safeParse: data => ({ success: true, data }) };
    export async function createGuestRecipeHandoff() { globalThis.auxQA.writes++; return { token: 'synthetic-token', expiresAt: new Date() }; }`,
  '@/lib/usda': `export async function lookupNutrients() { return null; }`,
  '@/lib/entitlement': `export const ENTITLEMENT_SELECT = {}; export function hasPremiumAccess() { return true; } export function premiumRequiredMessage() { return ''; }`,
  '@/lib/db': `export const prisma = {
    user: { async findUnique() { return { allergies: [], dislikedIngredients: [] }; } },
    recipe: {
      async findFirst() { return { id: 'r1', title: 'Rice', freshIngredients: '1 cup rice', instructions: 'Cook.', servings: '2', updatedAt: new Date(0),
        calories: null, protein: null, carbs: null, fat: null, fiber: null, sodium: null, comparisonSnapshot: null }; },
      async updateMany() { globalThis.auxQA.writes++; return { count: 1 }; },
    },
  };`,
};

async function bundle(entry) {
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', plugins: [{ name: 'isolated-aux', setup(build) {
    build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  }}] });
  const compiled = new Module(path.resolve(entry), module);
  compiled.filename = path.resolve(entry);
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports.POST;
}

const real = { fetch: global.fetch, setTimeout: global.setTimeout, error: console.error, warn: console.warn, log: console.log };
const PRIVATE = 'PRIVATE_PROVIDER_BODY';
let qa, passed = 0;

const completion = content => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });
const sse = text => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
const guestRecipe = { title: 'Homemade Ketchup', freshIngredients: ['2 cups tomatoes', '1 tbsp vinegar', '1 tsp honey', '1/2 tsp salt', '1/4 tsp clove', '1 tbsp onion'],
  instructions: ['Simmer everything.', 'Blend until smooth.'], prepTime: '5 minutes', cookTime: '20 minutes', servings: '4', estimatedCostPerServing: 0.5, storeBoughtCost: 0.4 };
const nutrition = { calories: 200, protein: 4, carbs: 40, fat: 1, fiber: 2, sodium: 5 };

// A correct answer for whichever route asked, keyed off its own prompt.
function answer(body) {
  const text = JSON.stringify(body.messages);
  if (body.stream) return sse('Simmer gently.');
  if (/substitute options/.test(text)) return completion(JSON.stringify({ substitutes: [{ name: 'olive oil', ratio: '1:1', notes: 'fruity' }] }));
  if (/sommelier/.test(text)) return completion(JSON.stringify({ pairings: [{ wineType: 'White', varietal: 'Riesling', description: 'Bright.', servingTemp: '45F', priceRange: 'Mid-range' }] }));
  if (/grocery costs/.test(text)) return completion('{"estimatedCostPerServing":1.25,"storeBoughtCost":3}');
  if (/pantry assistant/.test(text)) return completion(JSON.stringify({ makeNow: { title: 'Rice', summary: 'Cook it.' }, upgrade: { title: 'Fried rice', addIngredient: 'egg', summary: 'Add egg.' } }));
  if (/Scale the following/.test(text)) return completion('2 cups rice');
  if (/ingredient information/.test(text)) return completion(JSON.stringify({ name: 'Kale', category: 'Vegetable' }));
  if (/parse recipe ingredients/.test(text)) return completion('{"ingredients":[{"name":"rice","grams":200}]}');
  if (/nutritionist|nutrition per serving/.test(text)) return completion(JSON.stringify(nutrition));
  if (/AI Chef/.test(text)) return completion('Toast the rice first.');
  if (/Ingredient list copied from the package/.test(text)) return completion(JSON.stringify(guestRecipe));
  if (/INGREDIENTS list/.test(text)) return completion('{"found":true,"productName":"Ketchup","ingredients":"tomatoes, vinegar"}');
  if (/refrigerator and\/or pantry/.test(text)) return completion('{"items":[{"name":"eggs","quantity":"6","location":"fridge","confidence":"high"}],"reviewNotes":[]}');
  throw new Error('Unrecognized synthetic prompt');
}

function reset(mode = 'auto') {
  process.env.AI_PROVIDER = mode;
  qa = global.auxQA = { calls: [], logs: [], writes: 0 };
  global.setTimeout = real.setTimeout;
  for (const level of ['error', 'warn', 'log']) console[level] = (...args) => qa.logs.push(args);
}
// gemini/openai: (call) => Response | throws. Every call is recorded with its provider.
function providers({ gemini = call => answer(call.body), openai = call => answer(call.body) } = {}) {
  global.fetch = async (url, options) => {
    const provider = String(url).includes('generativelanguage.googleapis.com') ? 'gemini' : String(url).startsWith('https://api.openai.com/') ? 'openai' : null;
    assert(provider, 'No other network destination is permitted');
    const call = { provider, options, body: JSON.parse(options.body), headers: new Headers(options.headers) };
    qa.calls.push(call);
    return (provider === 'gemini' ? gemini : openai)(call);
  };
}
const providerOrder = () => qa.calls.map(call => call.provider).join(',');
async function check(name, run) {
  reset();
  try { await run(); } finally { for (const level of ['error', 'warn', 'log']) console[level] = real[level]; }
  assert.doesNotMatch(JSON.stringify(qa.logs), new RegExp(`${PRIVATE}|synthetic-openai|synthetic-gemini`), `${name}: provider bodies and keys must never be logged`);
  passed++;
  console.log('PASS:', name);
}

const json = (url, body, signal) => new Request(`https://test.invalid${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
function photos(url, field, type) {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array([1, 2, 3, 4])], { type }), 'synthetic');
  if (field === 'images') form.append('locations', 'fridge');
  return new Request(`https://test.invalid${url}`, { method: 'POST', body: form });
}
const params = { params: Promise.resolve({ id: 'r1' }) };

async function main() {
  process.env.GEMINI_API_KEY = 'synthetic-gemini'; process.env.OPENAI_API_KEY = 'synthetic-openai';
  // Mirrors lib/ai-provider OPENAI_BACKUP_MODEL; a model change should be noticed here.
  const OPENAI_BACKUP_MODEL = 'gpt-4.1-mini-2025-04-14';
  const routes = {
    'mobile chat': [await bundle('app/api/mobile/chat/route.ts'), () => [json('/api/mobile/chat', { messages: [{ role: 'user', content: 'Rice tips?' }] })]],
    'ingredient substitute': [await bundle('app/api/ingredient-substitute/route.ts'), () => [json('/api/ingredient-substitute', { ingredient: 'butter' })]],
    'ingredient info': [await bundle('app/api/ingredient-info/route.ts'), () => [json('/api/ingredient-info', { ingredient: 'kale' })]],
    'wine pairing': [await bundle('app/api/wine-pairing/route.ts'), () => [json('/api/wine-pairing', { recipeName: 'Rice', ingredients: 'rice' })]],
    'recipe cost': [await bundle('app/api/recipe-cost/estimate/route.ts'), () => [json('/api/recipe-cost/estimate', { title: 'Rice', freshIngredients: ['1 cup rice'], servings: '2' })]],
    'pantry recommendation': [await bundle('app/api/pantry-recommendation/route.ts'), () => [json('/api/pantry-recommendation', { ingredients: 'rice, beans, onion' })]],
    'nutrition estimate': [await bundle('app/api/nutrition/estimate/route.ts'), () => [json('/api/nutrition/estimate', { title: 'Rice', freshIngredients: ['1 cup rice'], instructions: ['Cook.'], servings: '2' })]],
    'recipe scale': [await bundle('app/api/recipes/[id]/scale/route.ts'), () => [json('/api/recipes/r1/scale', { scaleFactor: 2 }), params]],
    'saved recipe nutrition': [await bundle('app/api/recipes/[id]/nutrition/route.ts'), () => [json('/api/recipes/r1/nutrition', {}), params]],
    'guest generate': [await bundle('app/api/guest/generate-recipe/route.ts'), () => [json('/api/guest/generate-recipe', { ingredients: 'tomato paste, corn syrup, vinegar' })]],
    'guest label': [await bundle('app/api/guest/extract-label/route.ts'), () => [photos('/api/guest/extract-label', 'image', 'image/png')]],
    'pantry photos': [await bundle('app/api/pantry-inventory/extract/route.ts'), () => [photos('/api/pantry-inventory/extract', 'images', 'image/png')]],
    'recipe chat': [await bundle('app/api/recipe-chat/route.ts'), () => [json('/api/recipe-chat', { messages: [{ role: 'user', content: 'How long?' }], recipe: { title: 'Rice' } })]],
    'voice chat': [await bundle('app/api/voice-chat/route.ts'), () => [json('/api/voice-chat', { messages: [{ role: 'user', content: 'Rice ideas?' }], mode: 'conversational' })]],
  };
  const call = name => routes[name][0](...routes[name][1]());

  for (const name of Object.keys(routes)) {
    await check(`${name}: blocked Gemini falls back once to a sanitized OpenAI request`, async () => {
      providers({ gemini: () => new Response(PRIVATE, { status: 403 }) });
      const response = await call(name);
      assert.equal(response.status, 200, `${name} status`);
      await response.arrayBuffer();
      // Saved nutrition makes two different requests; each may fall back once, never twice.
      const backups = qa.calls.filter(c => c.provider === 'openai').length;
      assert(backups >= 1, 'backup must answer');
      assert.equal(backups, qa.calls.filter(c => c.provider === 'gemini').length, 'one backup per Gemini call');
      const backup = qa.calls.find(c => c.provider === 'openai');
      assert.equal(backup.headers.get('Authorization'), 'Bearer synthetic-openai');
      assert.equal(backup.body.model, OPENAI_BACKUP_MODEL);
      assert.equal(backup.body.store, false);
      assert.equal(backup.body.reasoning_effort, undefined);
      assert(backup.options.signal instanceof AbortSignal, 'backup call must be cancellable');
    });
    await check(`${name}: Gemini 400 never reaches the paid backup`, async () => {
      providers({ gemini: () => new Response(PRIVATE, { status: 400 }) });
      const response = await call(name);
      assert.notEqual(response.status, 200);
      assert.equal(qa.calls.some(c => c.provider === 'openai'), false);
    });
  }

  for (const [name, expected] of [['ingredient info', 500], ['guest generate', 503], ['saved recipe nutrition', 503]]) {
    await check(`${name}: a failed backup answer is not retried or re-asked`, async () => {
      providers({ gemini: () => new Response(PRIVATE, { status: 503 }), openai: () => new Response(PRIVATE, { status: 500 }) });
      assert.equal((await call(name)).status, expected);
      assert.equal(providerOrder(), 'gemini,openai');
      assert.equal(qa.writes, 0);
    });
  }
  for (const name of ['guest generate', 'saved recipe nutrition']) {
    await check(`${name}: a refusal is final, never repaired or re-estimated`, async () => {
      reset('openai');
      providers({ openai: () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'refused', content: null } }] }) });
      assert.notEqual((await call(name)).status, 200);
      assert.equal(providerOrder(), 'openai');
      assert.equal(qa.writes, 0);
    });
  }
  await check('guest generate: Gemini quota with OpenAI quota exhausted is Busy, not retried', async () => {
    providers({ gemini: () => new Response(PRIVATE, { status: 429 }), openai: () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }) });
    const response = await call('guest generate');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error, 'Busy');
    // Honest outage copy: no popularity claim, no promise that signing up bypasses it.
    assert.doesNotMatch(body.message, /popular|sign up/i);
    assert.match(body.message, /unavailable/); assert.match(body.message, /ingredients are still here/);
    assert.equal(providerOrder(), 'gemini,openai');
  });

  // Correct content inside an unfinished completion envelope must never be accepted.
  const tampered = mutate => async c => { const body = await answer(c.body).json(); mutate(body.choices[0]); return Response.json(body); };
  const unfinished = [
    ['missing finish reason', choice => { delete choice.finish_reason; }],
    ['unknown finish reason', choice => { choice.finish_reason = 'tool_calls'; }],
    ['truncated answer', choice => { choice.finish_reason = 'length'; }],
    ['refusal', choice => { choice.message.refusal = 'refused'; }],
  ];
  for (const name of Object.keys(routes).filter(n => n !== 'recipe chat' && n !== 'voice chat')) {
    for (const [label, mutate] of unfinished) {
      await check(`${name}: ${label} is not accepted`, async () => {
        providers({ gemini: tampered(mutate) });
        const response = await call(name);
        assert.notEqual(response.status, 200);
        await response.arrayBuffer();
        assert.equal(qa.writes, 0);
        assert.equal(qa.calls.some(c => c.provider === 'openai'), false);
      });
    }
  }
  for (const [label, content] of [['blank', '  '], ['malformed', 'Here you go:\n2 cups rice']]) {
    await check(`recipe scale: ${label} output fails instead of returning unscaled ingredients`, async () => {
      providers({ gemini: () => completion(content) });
      const response = await call('recipe scale');
      assert.equal(response.status, 500);
      assert.doesNotMatch(await response.text(), /1 cup rice/);
    });
  }
  await check('saved recipe nutrition: provider-neutral source and no parsed ingredient log', async () => {
    providers();
    const response = await call('saved recipe nutrition');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sourceLabel, 'AI estimate from recipe ingredients');
    assert.doesNotMatch(JSON.stringify(qa.logs), /rice=|200g/);
  });

  for (const [name, field, url] of [['guest label', 'image', '/api/guest/extract-label'], ['pantry photos', 'images', '/api/pantry-inventory/extract']]) {
    await check(`${name}: HEIC on the backup path is 415 without an OpenAI call`, async () => {
      providers({ gemini: () => new Response(PRIVATE, { status: 503 }) });
      const response = await routes[name][0](photos(url, field, 'image/heic'));
      assert.equal(response.status, 415);
      assert.equal(providerOrder(), 'gemini');
    });
  }

  for (const name of ['recipe chat', 'voice chat']) {
    await check(`${name}: fallback happens before the first byte and passes SSE through unchanged`, async () => {
      providers({ gemini: () => new Response(PRIVATE, { status: 429 }) });
      const response = await call(name);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), `data: ${JSON.stringify({ choices: [{ delta: { content: 'Simmer gently.' } }] })}\n\ndata: [DONE]\n\n`);
      assert.equal(providerOrder(), 'gemini,openai');
    });
    await check(`${name}: client cancelling the stream aborts the provider`, async () => {
      reset('openai');
      providers({ openai: () => new Response(new ReadableStream({ pull: () => new Promise(() => {}) })) });
      const response = await call(name);
      assert.equal(response.status, 200);
      await response.body.cancel();
      assert.equal(qa.calls[0].options.signal.aborted, true);
    });
    await check(`${name}: OpenAI-only transport failure is 503 without a retry`, async () => {
      reset('openai');
      providers({ openai: () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); } });
      assert.equal((await call(name)).status, 503);
      assert.equal(qa.calls.length, 1);
    });
  }

  await check('mobile chat: client cancel stops OpenAI and returns 499', async () => {
    reset('openai'); const controller = new AbortController();
    providers({ openai: c => new Promise((_, reject) => { c.options.signal.addEventListener('abort', () => reject(c.options.signal.reason), { once: true }); controller.abort(); }) });
    const response = await routes['mobile chat'][0](json('/api/mobile/chat', { messages: [{ role: 'user', content: 'Rice tips?' }] }, controller.signal));
    assert.equal(response.status, 499); assert.equal(qa.calls.length, 1); assert.equal(qa.calls[0].options.signal.aborted, true);
  });

  for (const name of ['guest generate', 'saved recipe nutrition']) {
    await check(`${name}: one shared deadline aborts hung work with 504 and no write`, async () => {
      // Shrink only long timers so the real deadline logic runs in milliseconds.
      global.setTimeout = (fn, ms, ...args) => real.setTimeout(fn, ms >= 30000 ? ms / 1000 : ms, ...args);
      providers({ gemini: c => new Promise((_, reject) => c.options.signal.addEventListener('abort', () => reject(c.options.signal.reason), { once: true })) });
      assert.equal((await call(name)).status, 504);
      assert.equal(qa.calls.length, 1); assert.equal(qa.calls[0].options.signal.aborted, true); assert.equal(qa.writes, 0);
    });
  }

  console.log(`${passed} auxiliary AI backup checks passed. Mocked providers only; no network, database or paid calls.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = real.fetch; global.setTimeout = real.setTimeout;
  for (const level of ['error', 'warn', 'log']) console[level] = real[level];
  delete global.auxQA;
});
