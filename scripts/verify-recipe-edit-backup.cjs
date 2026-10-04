const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

// Exercise the real route, transport and validation. Only auth, storage,
// rate limits and network I/O are synthetic; no paid calls or account writes.
async function bundle(entry) {
  const mocks = {
    '@/lib/request-auth': `export async function getRequestUserId() { return 'synthetic'; }`,
    '@/lib/db': `export const prisma = { user: {
      async findUnique() { return globalThis.editQA.user; },
      async updateMany() { globalThis.editQA.writes++; return {count:1}; },
      async update() { globalThis.editQA.writes++; return {}; }
    }};`,
    '@/lib/rate-limit': `export async function rateLimit() { return {success:true}; }`,
    '@/lib/ai-rate-limit': `export async function limitAiRequest() { return null; }`,
    '@/lib/partner-offer-server': `export async function resolvePartnerTrial() { return {}; }`,
    '@/lib/entitlement': `export function hasPremiumAccess() { return false; }`,
  };
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', plugins: [{ name: 'isolated-edit', setup(build) {
    build.onResolve({ filter: /^@\/lib\// }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  }}] });
  const compiled = new Module(path.resolve(entry), module);
  compiled.filename = path.resolve(entry);
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports.POST;
}

const source = { title: 'Rice with butter', freshIngredients: ['1 cup rice', '2 tbsp butter'], instructions: ['Cook the rice.', 'Stir in the butter.'], prepTime: '5 minutes', cookTime: '20 minutes', servings: '2', dietaryTags: [] };
const requestBody = { recipe: source, action: { type: 'substitute', original: '2 tbsp butter', substitute: '2 tbsp olive oil' } };
const validRecipe = { ...source, freshIngredients: ['1 cup rice', '2 tbsp olive oil'], instructions: ['Cook the rice.', 'Stir in the olive oil.'] };
const adapted = recipe => ({ status: 'adapted', recipe, changeSummary: 'Replaced butter with olive oil.', reviewNotes: [] });
const completion = output => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
const native = output => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] });
const real = { fetch: global.fetch, now: Date.now, setTimeout: global.setTimeout };
let qa, passed = 0;
function reset(mode = 'auto') {
  process.env.AI_PROVIDER = mode;
  qa = global.editQA = { user: { id: 'synthetic', allergies: ['peanut'], dislikedIngredients: [], likedIngredients: [], generationCount: 0, lastGenerationReset: new Date(), subscriptionTier: 'free', subscriptionStatus: 'active', createdAt: new Date() }, writes: 0, calls: [] };
  Date.now = real.now; global.setTimeout = real.setTimeout;
}
function mock(reply) { global.fetch = async (url, options) => { const call = { url: String(url), options, body: JSON.parse(options.body) }; qa.calls.push(call); return reply(call); }; }
const req = (body, signal) => new Request('https://test.invalid/api/import-recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
async function check(name, run) { reset(); await run(); assert.equal(qa.writes, 0, 'Failures and adaptations must not save or charge recipe quota'); passed++; console.log('PASS:', name); }

async function main() {
  process.env.GEMINI_API_KEY = 'synthetic-gemini'; process.env.OPENAI_API_KEY = 'synthetic-openai';
  const edit = await bundle('app/api/import-recipe/adapt/route.ts');
  const read = await bundle('app/api/import-recipe/route.ts');
  const photo = await bundle('app/api/extract-recipe-from-photo/route.ts');
  const noBackup = () => { process.env.AI_PROVIDER = 'gemini'; };
  for (const status of [400, 403, 429, 503]) await check(`Import HTTP ${status} does not blame photo`, async () => {
    noBackup(); mock(() => new Response('', { status }));
    const response = await read(req({ text: 'Synthetic recipe' })); assert.equal(response.status, 503);
    const body = await response.json(); assert.match(body.error, /temporarily unavailable/); assert.doesNotMatch(body.error, /photo|billing|quota/);
  });
  await check('Gemini connection failure is service unavailable', async () => {
    noBackup(); mock(() => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); });
    assert.equal((await read(req({ text: 'Synthetic recipe' }))).status, 503); assert.equal(qa.calls.length, 1);
  });
  for (const [name, failure] of [
    ['unlisted connection error', () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'EHOSTUNREACH' } }); }],
    ['interrupted body', () => new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('terminated')); } }))],
  ]) for (const [routeName, handler, body] of [['import', read, { text: 'Synthetic recipe' }], ['adapt', edit, requestBody]]) await check(`${routeName}: ${name} never becomes content repair`, async () => {
    noBackup(); mock(failure); assert.equal((await handler(req(body))).status, 503); assert.equal(qa.calls.length, 1);
  });
  await check('OpenAI quota failure is not retried or blamed on source', async () => {
    mock(call => call.url.includes('googleapis') ? new Response('', { status: 403 }) : Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }));
    assert.equal((await read(req({ text: 'Synthetic recipe' }))).status, 503); assert.equal(qa.calls.length, 2);
  });
  for (const mode of ['gemini', 'openai']) await check(`Label photo ${mode} transport failure is service unavailable`, async () => {
    process.env.AI_PROVIDER = mode;
    mock(() => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); });
    const form = new FormData(); form.set('image', new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:'image/png'}), 'synthetic.png');
    const response = await photo(new Request('https://test.invalid/api/extract-recipe-from-photo', {method:'POST',body:form}));
    assert.equal(response.status, 503); assert.equal(qa.calls.length, 1);
  });
  await check('Readable source without directions stays recoverable', async () => {
    noBackup(); mock(() => native({ title: 'Rice', ingredients: ['1 cup rice'], instructions: [] }));
    const request = req({ text: 'Rice ingredients only' }); request.headers.set('x-recipe-partial-review', '1');
    const response = await read(request); assert.equal(response.status, 200); assert.equal((await response.json()).status, 'partial');
  });
  await check('Adaptation Gemini403 stops after one call without backup', async () => {
    noBackup(); mock(() => new Response('', { status: 403 }));
    const response = await edit(req(requestBody)); assert.equal(response.status, 503); assert.equal(qa.calls.length, 1); assert.match((await response.json()).error, /not changed or saved/);
  });
  await check('Blocked Gemini falls back to validated OpenAI adaptation', async () => {
    mock(call => call.url.includes('googleapis') ? new Response('', { status: 403 }) : completion(adapted(validRecipe)));
    const response = await edit(req(requestBody)); assert.equal(response.status, 200); assert.equal(qa.calls.length, 2);
    const body = await response.json(); assert.deepEqual(body.recipe, validRecipe); assert.equal(body.quotaUsed, false);
    assert.equal(new Headers(qa.calls[1].options.headers).get('Authorization'), 'Bearer synthetic-openai');
    assert.match(JSON.stringify(qa.calls[1].body), /peanut/);
  });
  await check('Invalid completed content gets one coherent repair', async () => {
    process.env.AI_PROVIDER = 'openai'; mock(() => completion(adapted(qa.calls.length === 1 ? source : validRecipe)));
    assert.equal((await edit(req(requestBody))).status, 200); assert.equal(qa.calls.length, 2); assert.match(JSON.stringify(qa.calls[1].body), /Correct|validation|original/i);
  });
  await check('Allergy violation cannot be returned by either attempt', async () => {
    const bad = { ...validRecipe, freshIngredients: [...validRecipe.freshIngredients, '1 tbsp peanut oil'] };
    mock(call => call.url.includes('googleapis') ? new Response('', { status: 403 }) : completion(adapted(bad)));
    const response = await edit(req(requestBody)); assert.equal(response.status, 422); assert.equal(qa.calls.length, 4); assert.equal((await response.json()).recipe, undefined);
  });
  await check('Failed OpenAI transport cannot start another edit attempt', async () => {
    mock(call => { if (call.url.includes('googleapis')) return new Response('', { status: 403 }); throw new TypeError('Synthetic connection failed'); });
    assert.equal((await edit(req(requestBody))).status, 503); assert.equal(qa.calls.length, 2);
  });
  await check('OpenAI refusal cannot trigger a content repair', async () => {
    process.env.AI_PROVIDER = 'openai'; mock(() => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'refused', content: null } }] }));
    assert.equal((await edit(req(requestBody))).status, 422); assert.equal(qa.calls.length, 1);
  });
  for (const reason of ['PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'promptFeedback']) await check(`Gemini ${reason} is not repaired`, async () => {
    noBackup(); mock(() => Response.json(reason === 'promptFeedback' ? { promptFeedback: { blockReason: 'SAFETY' } } : { candidates: [{ finishReason: reason }] }));
    assert.equal((await edit(req(requestBody))).status, 422); assert.equal(qa.calls.length, 1);
  });
  await check('A truncated completed response permits one content repair', async () => {
    process.env.AI_PROVIDER = 'openai'; mock(() => qa.calls.length === 1 ? Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) : completion(adapted(validRecipe)));
    assert.equal((await edit(req(requestBody))).status, 200); assert.equal(qa.calls.length, 2);
  });
  await check('Model cannot-adapt on repair is respected', async () => {
    process.env.AI_PROVIDER = 'openai'; mock(() => completion(qa.calls.length === 1 ? adapted(source) : { status: 'cannot_adapt', reason: 'The requested substitute will not work.' }));
    const response = await edit(req(requestBody)); assert.equal(response.status, 422); assert.equal((await response.json()).code, 'cannot_adapt'); assert.equal(qa.calls.length, 2);
  });
  await check('Measurements remain faithful instead of applying saved allergies', async () => {
    process.env.AI_PROVIDER = 'openai';
    const metric = { ...source, freshIngredients: ['240 ml milk'], instructions: ['Warm 240 ml milk.'] };
    const converted = { ...metric, freshIngredients: ['1 cup milk'], instructions: ['Warm 1 cup milk.'] };
    qa.user.allergies = ['milk']; mock(() => completion(adapted(converted)));
    const response = await edit(req({ recipe: metric, action: { type: 'measurements', system: 'us' } }));
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).recipe, converted);
  });
  await check('A late invalid answer cannot start a paid repair', async () => {
    process.env.AI_PROVIDER = 'openai'; const start = real.now(); let elapsed = 0; Date.now = () => start + elapsed;
    mock(() => { elapsed = 42000; return completion(adapted(source)); });
    assert.equal((await edit(req(requestBody))).status, 422); assert.equal(qa.calls.length, 1);
  });
  await check('Entire adaptation has one deadline and aborts hung work', async () => {
    const durations = [];
    global.setTimeout = (fn, ms, ...args) => { durations.push(ms); return real.setTimeout(fn, ms >= 50000 ? ms / 1000 : ms, ...args); };
    mock(call => new Promise((_, reject) => call.options.signal.addEventListener('abort', () => reject(call.options.signal.reason), { once: true })));
    const response = await edit(req(requestBody)); assert.equal(response.status, 504); assert.equal(qa.calls.length, 1); assert.equal(qa.calls[0].options.signal.aborted, true);
    assert.equal(durations[0], 50000); assert(durations.slice(1).every(ms => ms > 50000), 'Inner timers must expire later than the shared deadline');
  });
  await check('Client cancel stops active OpenAI without repair', async () => {
    process.env.AI_PROVIDER = 'openai'; const controller = new AbortController();
    mock(call => new Promise((_, reject) => { call.options.signal.addEventListener('abort', () => reject(call.options.signal.reason), { once: true }); controller.abort(); }));
    assert.equal((await edit(req(requestBody, controller.signal))).status, 499); assert.equal(qa.calls.length, 1);
  });
  console.log(`${passed} route-level checks passed. Mocked providers only.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = real.fetch; Date.now = real.now; global.setTimeout = real.setTimeout; delete global.editQA; });
