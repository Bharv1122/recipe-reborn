const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

// Exercise the real generation route and ingredient-integrity library. Only
// external account/provider/cancellation boundaries are synthetic. No network.
const originals = { fetch: global.fetch, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
const endpoint = 'https://synthetic-provider.example.invalid/chat';
const draft = {
  title: 'Beef chili',
  freshIngredients: ['1 lb ground beef', '1 onion, diced', '2 cloves garlic, minced'],
  instructions: [
    'Brown the ground beef with the onion and garlic in a pot.',
    'Stir in chili powder, carrots, kidney beans, beef broth, and red wine. Simmer until the carrots are tender.',
  ],
  prepTime: '10 minutes', cookTime: '30 minutes', servings: '4',
};
const completeIngredients = [
  ...draft.freshIngredients, '2 tsp chili powder', '2 carrots, diced',
  '1 can kidney beans, drained', '2 cups beef broth', '1/2 cup red wine',
];
const baseBody = {
  source: 'pantry', ingredients: 'ground beef, onion, garlic, carrots, kidney beans, beef broth, red wine, chili powder',
  generationId: 'e09b938c-8f15-4e8b-b086-0fdd521f2842',
};
let state;
let passed = 0;

function reconciliation() {
  return {
    freshIngredients: [...completeIngredients],
    instructionIngredients: completeIngredients.map((ingredient, index) => ({ ingredient, steps: [index < 3 ? 1 : 2] })),
  };
}

function streamReply(recipe) {
  const text = JSON.stringify(recipe);
  const chunks = [text.slice(0, 38), text.slice(38)];
  const sse = chunks.map(content => 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\n').join('')
    + 'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\n'
    + 'data: [DONE]\n\n';
  return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
}

function structuredReply(value, finishReason = 'stop') {
  return Response.json({ choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(value) } }] });
}

function reset() {
  state = {
    user: { id: 'synthetic-user', subscriptionTier: 'free', subscriptionStatus: 'active', generationCount: 0,
      lastGenerationReset: new Date(), allergies: [], dislikedIngredients: [], signupSource: null,
      createdAt: new Date(), currentPeriodEnd: null },
    draft: structuredClone(draft), correction: reconciliation(), calls: [], updates: [], timers: [],
    cleared: new Set(), logs: [], canceled: false, correctionReturned: false, clearCalls: 0,
    reply: async () => structuredReply(state.correction),
  };
  global.recipeIntegrityQA = state;
}

async function bundle() {
  const mocks = {
    '@/lib/request-auth': `export async function getRequestUserId() { return 'synthetic-user'; }`,
    '@/lib/rate-limit': `export async function rateLimit() { return {success:true}; }`,
    '@/lib/partner-offer-server': `export async function resolvePartnerTrial() { return {offer:null,trialRecipeLimit:3}; }`,
    '@/lib/server-error-log': `export function logServerError(...args) { globalThis.recipeIntegrityQA.logs.push(args); }`,
    '@/lib/generation-cancellation': `export async function wasGenerationCanceled() { return globalThis.recipeIntegrityQA.canceled; }
      export async function clearGenerationCancellation() { globalThis.recipeIntegrityQA.clearCalls++; }`,
    '@/lib/ai': `export const AI_API_KEY='synthetic-key', AI_CHAT_URL=${JSON.stringify(endpoint)}, MODEL_SMART='synthetic-model';`,
    '@/lib/db': `export const prisma = { user: {
      async findUnique() { return globalThis.recipeIntegrityQA.user; },
      async updateMany(query) { globalThis.recipeIntegrityQA.updates.push({query,correctionReturned:globalThis.recipeIntegrityQA.correctionReturned}); return {count:1}; },
      async update(query) { globalThis.recipeIntegrityQA.updates.push({query,correctionReturned:globalThis.recipeIntegrityQA.correctionReturned}); return globalThis.recipeIntegrityQA.user; }
    } };`,
  };
  const entry = 'app/api/generate-recipe/route.ts';
  const result = await esbuild.build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external',
    plugins: [{ name: 'synthetic-recipe-integrity', setup(build) {
      build.onResolve({ filter: /^@\/lib\// }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const compiled = new Module(path.resolve(entry), module);
  compiled.filename = path.resolve(entry);
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

function charges() { return state.updates.filter(({ query }) => query.data.generationCount?.increment); }

async function run(route, body = {}, signal) {
  const response = await route.POST(new Request('https://synthetic-site.example.invalid/api/generate-recipe', {
    method: 'POST', body: JSON.stringify({ ...baseBody, ...body }), signal,
    headers: { 'content-type': 'application/json' },
  }));
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const events = text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
  assert.doesNotMatch(text, /PRIVATE_|synthetic-key/);
  return events;
}

function assertRejected(events) {
  assert.equal(events.filter(event => event.status === 'completed').length, 0);
  assert.equal(events.filter(event => event.status === 'error').length, 1);
  assert.equal(charges().length, 0, 'Failed/canceled reconciliation must never charge quota.');
  assert.equal(state.clearCalls, 0, 'A failed generation must not be marked completed.');
}

function assertTwoCalls() {
  assert.equal(state.calls.length, 2, 'Every successful pantry draft needs exactly one reconciliation call.');
  assert.equal(state.calls[0].body.stream, true);
  assert.equal(state.calls[1].body.stream, false);
  assert.equal(state.calls[1].body.response_format.type, 'json_object');
}

async function check(name, test) {
  reset();
  await test();
  for (const timer of state.timers) assert.ok(state.cleared.has(timer), name + ': provider timeout was not cleared');
  passed++;
  console.log('PASS:', name);
}

async function main() {
  const route = await bundle();
  global.setTimeout = (callback, duration) => {
    const timer = { callback, duration };
    state.timers.push(timer);
    return timer;
  };
  global.clearTimeout = timer => state.cleared.add(timer);
  global.fetch = async (url, options) => {
    assert.equal(String(url), endpoint, 'Unexpected network access is forbidden.');
    assert.ok(state.calls.length < 2, 'No extra provider retries or unrelated network calls allowed.');
    const body = JSON.parse(options.body);
    state.calls.push({ body, options });
    if (state.calls.length === 1) return streamReply(state.draft);
    assert.equal(charges().length, 0, 'Quota charged before reconciliation.');
    const reply = await state.reply(options);
    state.correctionReturned = true;
    return reply;
  };

  await check('three-line draft becomes complete eight-ingredient chili before completion/charge', async () => {
    const events = await run(route);
    assertTwoCalls();
    const completions = events.filter(event => event.status === 'completed');
    assert.equal(completions.length, 1);
    assert.deepEqual(completions[0].result.freshIngredients, completeIngredients);
    assert.deepEqual(completions[0].result.instructions, draft.instructions);
    assert.equal(completions[0].result.title, draft.title);
    assert.equal(charges().length, 1);
    assert.equal(charges()[0].correctionReturned, true);
    assert.equal(state.clearCalls, 1);
    const prompt = JSON.stringify(state.calls[1].body.messages);
    for (const food of ['chili powder', 'carrots', 'kidney beans', 'beef broth', 'red wine']) assert.ok(prompt.includes(food));
  });

  await check('already-complete pantry drafts still receive exactly one structured reconciliation', async () => {
    state.draft.freshIngredients = [...completeIngredients];
    const events = await run(route);
    assertTwoCalls();
    assert.equal(events.filter(event => event.status === 'completed').length, 1);
    assert.equal(charges().length, 1);
  });

  for (const [name, mutate] of [
    ['missing map', value => { delete value.instructionIngredients; }],
    ['missing used ingredient', value => { value.freshIngredients.pop(); value.instructionIngredients.pop(); }],
    ['zero-based reference', value => { value.instructionIngredients[0].steps = [0]; }],
    ['out-of-range reference', value => { value.instructionIngredients[0].steps = [3]; }],
    ['unmapped ingredient', value => { value.instructionIngredients.pop(); }],
    ['non-exact ingredient line', value => { value.instructionIngredients[0].ingredient = 'ground beef'; }],
    ['unknown top-level field', value => { value.instructions = ['Replace the entire recipe']; }],
  ]) {
    await check('rejects malformed reconciliation: ' + name, async () => {
      mutate(state.correction);
      assertRejected(await run(route));
      assertTwoCalls();
    });
  }

  for (const [name, reply] of [
    ['HTTP failure', async () => new Response('PRIVATE_PROVIDER_BODY', { status: 503 })],
    ['network failure', async () => { throw Error('PRIVATE_PROVIDER_NETWORK'); }],
    ['malformed outer JSON', async () => new Response('PRIVATE_NOT_JSON')],
    ['malformed model JSON', async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{' } }] })],
    ['truncated completion', async () => structuredReply(state.correction, 'length')],
    ['safety-blocked completion', async () => structuredReply(state.correction, 'content_filter')],
    ['completion missing finish reason', async () => Response.json({ choices: [{ message: { content: JSON.stringify(state.correction) } }] })],
    ['empty completion', async () => Response.json({ choices: [] })],
  ]) {
    await check('reconciliation ' + name + ' produces error without quota charge', async () => {
      state.reply = reply;
      assertRejected(await run(route));
      assertTwoCalls();
    });
  }

  for (const stage of ['fetch', 'body']) {
    await check('reconciliation ' + stage + ' timeout aborts upstream without quota charge', async () => {
      const stalled = options => new Promise((resolve, reject) => {
        assert.ok(options.signal, 'Reconciliation must have an abortable timeout.');
        options.signal.addEventListener('abort', () => reject(new DOMException('PRIVATE_TIMEOUT', 'AbortError')), { once: true });
        const timer = state.timers.at(-1);
        assert.ok(timer && timer.duration > 0 && timer.duration <= 52_000);
        timer.callback();
      });
      state.reply = stage === 'fetch' ? stalled : async options => ({ ok: true, json: () => stalled(options) });
      assertRejected(await run(route));
      assertTwoCalls();
      assert.equal(state.calls[1].options.signal.aborted, true);
    });
  }

  for (const location of ['ingredients', 'instructions']) {
    await check('saved allergen in ' + location + ' cannot complete or charge', async () => {
      state.user.allergies = ['peanut'];
      if (location === 'ingredients') state.draft.freshIngredients.push('1 tbsp peanut butter');
      else state.draft.instructions[1] += ' Add peanut butter.';
      assertRejected(await run(route, { allergies: [] }));
    });
  }

  await check('reconciliation cannot introduce a saved allergen', async () => {
    state.user.allergies = ['peanut'];
    state.correction.freshIngredients.push('1 tbsp peanut butter');
    state.correction.instructionIngredients.push({ ingredient: '1 tbsp peanut butter', steps: [2] });
    assertRejected(await run(route));
    assertTwoCalls();
  });

  await check('client abort during reconciliation cancels upstream and never charges', async () => {
    const controller = new AbortController();
    state.reply = options => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('PRIVATE_CLIENT_ABORT', 'AbortError')), { once: true });
      controller.abort();
    });
    assertRejected(await run(route, {}, controller.signal));
    assertTwoCalls();
    assert.equal(state.calls[1].options.signal.aborted, true);
  });

  await check('persisted cancellation during reconciliation prevents quota charge', async () => {
    state.reply = async () => { state.canceled = true; return structuredReply(state.correction); };
    assertRejected(await run(route));
    assertTwoCalls();
  });

  await check('canceling the response body aborts a pending review without completing or charging', async () => {
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    state.reply = options => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('PRIVATE_BODY_CANCEL', 'AbortError')), { once: true });
      markStarted();
    });
    const response = await route.POST(new Request('https://synthetic-site.example.invalid/api/generate-recipe', {
      method: 'POST', body: JSON.stringify(baseBody), headers: { 'content-type': 'application/json' },
    }));
    await started;
    await response.body.cancel();
    // Let the route's rejected fetch settle; no real timeout or provider call.
    await new Promise(resolve => setImmediate(resolve));
    assertTwoCalls();
    assert.equal(state.calls[1].options.signal.aborted, true);
    assert.equal(charges().length, 0);
    assert.equal(state.clearCalls, 0);
  });

  await check('pantry dietary request and saved preferences survive both prompt stages', async () => {
    state.user.allergies = ['shellfish'];
    state.user.dislikedIngredients = ['cilantro'];
    const events = await run(route, { dietaryRestriction: 'low sodium', pantryTargetTitle: 'Beef chili', pantryExtraIngredient: 'red wine' });
    assertTwoCalls();
    assert.equal(events.filter(event => event.status === 'completed').length, 1);
    for (const call of state.calls) {
      const prompt = JSON.stringify(call.body.messages);
      for (const required of ['low sodium', 'shellfish', 'cilantro', 'Beef chili', 'red wine']) assert.ok(prompt.includes(required), 'Missing prompt constraint: ' + required);
    }
  });

  await check('non-pantry generation retains its single-provider-call contract', async () => {
    const events = await run(route, { source: 'dish', ingredients: 'Beef chili' });
    assert.equal(state.calls.length, 1);
    assert.equal(events.filter(event => event.status === 'completed').length, 1);
    assert.equal(charges().length, 1);
    assert.deepEqual(events.find(event => event.status === 'completed').result.freshIngredients, draft.freshIngredients);
  });
  console.log(`PASS: ${passed} actual-handler ingredient-integrity regressions; no live provider, account, or database calls.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originals.fetch;
  global.setTimeout = originals.setTimeout;
  global.clearTimeout = originals.clearTimeout;
  delete global.recipeIntegrityQA;
});
