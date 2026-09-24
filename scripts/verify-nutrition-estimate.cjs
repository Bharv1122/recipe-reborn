const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

let state;
let passed = 0;
const recipe = { title: 'Oatmeal', freshIngredients: ['1 cup oats', '2 cups milk'], instructions: ['Simmer until cooked.'], servings: '2' };
const values = { calories: 220.4, protein: 0, carbs: 33.36, fat: null, fiber: 3.12, sodium: 0 };
const keys = Object.keys(values);
function reset() {
  state = { owner: 'test-user', rateAllowed: true, calls: [], reply: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(values) } }] }, providerStatus: 200, networkError: false, logs: [] };
  global.__nutritionQA = state;
}
async function bundle() {
  const mocks = {
    '@/lib/request-auth': 'export async function getRequestUserId(){ return globalThis.__nutritionQA.owner; }',
    '@/lib/rate-limit': 'export async function rateLimit(){ return {success: globalThis.__nutritionQA.rateAllowed}; }',
    '@/lib/ai': "export const AI_API_KEY='synthetic', AI_CHAT_URL='https://provider.example.invalid', MODEL_FAST='gemini-2.5-flash-lite';",
  };
  const built = await build({
    entryPoints: ['app/api/nutrition/estimate/route.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'isolated-nutrition', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/(request-auth|rate-limit|ai)$/ }, ({ path: name }) => ({ path: name, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path: name }) => ({ contents: mocks[name], loader: 'js' }));
    } }],
  });
  const compiled = new Module(path.resolve('scripts/nutrition-qa.cjs'), module);
  compiled.filename = path.resolve('scripts/nutrition-qa.cjs');
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(built.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}
const request = (body = recipe) => new Request('http://localhost/api/nutrition/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
async function check(name, run) { reset(); await run(); passed++; console.log('PASS:', name); }
async function main() {
  const { POST } = await bundle();
  const original = { fetch: global.fetch, error: console.error };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://provider.example.invalid', 'No real network call permitted');
    state.calls.push(JSON.parse(options.body));
    assert(options.signal instanceof AbortSignal);
    if (state.networkError) throw new Error('PRIVATE_RECIPE_CONTENT');
    return Response.json(state.reply, { status: state.providerStatus });
  };
  console.error = (...args) => state.logs.push(args);
  try {
    await check('structured request and output preserve legitimate zero/null with consistent units', async () => {
      const response = await POST(request()); assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, { calories: 220, protein: 0, carbs: 33.4, fat: null, fiber: 3.1, sodium: 0, perServing: true, accuracy: 'estimated', basisLabel: 'Per recipe serving (recipe makes 2)', sourceLabel: 'Estimated from the generated recipe' });
      const sent = state.calls[0];
      assert.equal(sent.reasoning_effort, 'none');
      assert.equal(sent.response_format.type, 'json_schema');
      assert.equal(sent.response_format.json_schema.strict, true);
      assert.deepEqual(sent.response_format.json_schema.schema.required, keys);
      assert.equal(sent.response_format.json_schema.schema.additionalProperties, false);
      assert.match(sent.messages[1].content, /flat JSON object/);
      assert.match(sent.messages[1].content, /ONE serving/);
    });
    await check('all zero nutrients are usable rather than treated as absent', async () => {
      state.reply.choices[0].message.content = JSON.stringify(Object.fromEntries(keys.map(key => [key, 0])));
      const response = await POST(request()); assert.equal(response.status, 200);
      const body = await response.json(); for (const key of keys) assert.equal(body[key], 0);
    });
    for (const [name, content] of [
      ['all-null estimate', JSON.stringify(Object.fromEntries(keys.map(key => [key, null])))],
      ['nested nutrition shape', JSON.stringify({ nutrition: values })],
      ['missing required key', JSON.stringify({ ...values, sodium: undefined })],
      ['negative value', JSON.stringify({ ...values, sodium: -1 })],
      ['unit-bearing value', JSON.stringify({ ...values, protein: '4 grams' })],
      ['unexpected property', JSON.stringify({ ...values, description: 'PRIVATE_RECIPE_CONTENT' })],
      ['infinite value', '{"calories":1e309,"protein":0,"carbs":0,"fat":0,"fiber":0,"sodium":0}'],
      ['empty reply', ''], ['malformed reply', 'PRIVATE_RECIPE_CONTENT {broken}'],
    ]) await check(name + ' is an error instead of a successful empty nutrition card', async () => {
      state.reply.choices[0].message.content = content;
      const response = await POST(request()); assert.equal(response.status, 503);
      const body = await response.json(); assert.equal(body.calories, undefined); assert.equal(typeof body.error, 'string');
      assert.doesNotMatch(JSON.stringify(state.logs), /PRIVATE_RECIPE_CONTENT/);
    });
    for (const reason of ['length', 'content_filter', undefined]) await check('unfinished response (' + reason + ') is rejected even with valid JSON', async () => {
      state.reply.choices[0].finish_reason = reason;
      assert.equal((await POST(request())).status, 503);
    });
    await check('authentication, rate limits and malformed input avoid provider work', async () => {
      state.owner = null; assert.equal((await POST(request())).status, 401);
      state.owner = 'test-user'; state.rateAllowed = false; assert.equal((await POST(request())).status, 429);
      state.rateAllowed = true; assert.equal((await POST(request('{broken'))).status, 400);
      assert.equal((await POST(request({ ...recipe, freshIngredients: [] }))).status, 400);
      assert.equal(state.calls.length, 0);
    });
    await check('provider and network failures return a safe retryable error', async () => {
      state.providerStatus = 429; assert.equal((await POST(request())).status, 503);
      state.networkError = true; assert.equal((await POST(request())).status, 503);
      assert.doesNotMatch(JSON.stringify(state.logs), /PRIVATE_RECIPE_CONTENT/);
    });
  } finally { global.fetch = original.fetch; console.error = original.error; delete global.__nutritionQA; }
  console.log(`${passed} nutrition estimate checks passed with synthetic provider I/O.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
