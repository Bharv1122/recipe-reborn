const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const jwt = require('jsonwebtoken');
const Module = require('node:module');
const path = require('node:path');

// Bundle the real ingredient-info and ingredient-substitute handlers with the
// real shared auth helper, native JWT verifier, food matcher and AI transport.
// Only the web session, rate limits, account storage and network are synthetic.
const mocks = {
  'next-auth': `export async function getServerSession() { globalThis.ingredientQA.sessionCalls++; return globalThis.ingredientQA.session; }`,
  '@/lib/auth-options': 'export const authOptions = {};',
  '@/lib/ai-rate-limit': `export async function limitAiRequest(userId) {
    globalThis.ingredientQA.limited.push(userId);
    return globalThis.ingredientQA.rateLimited ? Response.json({ error: 'Too many requests.' }, { status: 429 }) : null;
  }`,
  '@/lib/db': `export const prisma = { user: { async findUnique(query) {
    globalThis.ingredientQA.queries.push(query);
    return globalThis.ingredientQA.user;
  } } };`,
};

async function bundle(entry) {
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', plugins: [{ name: 'isolated-ingredient', setup(build) {
    build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }] });
  const compiled = new Module(path.resolve(entry), module);
  compiled.filename = path.resolve(entry);
  compiled.paths = Module._nodeModulePaths(path.dirname(compiled.filename));
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports.POST;
}

const original = { fetch: global.fetch, error: console.error, secret: process.env.NEXTAUTH_SECRET, gemini: process.env.GEMINI_API_KEY, provider: process.env.AI_PROVIDER };
const syntheticSecret = 'ingredient-helpers-synthetic-jwt-secret';
const PRIVATE = 'PRIVATE_MODEL_OUTPUT';
const kaleInfo = {
  name: 'Kale', category: 'Vegetable',
  nutrition: { calories: 49, protein: '4.3 g', carbs: '8.8 g', fat: '0.9 g', fiber: '3.6 g', vitamins: ['Vitamin K', 'Vitamin C'] },
  healthBenefits: ['High in fiber'], substitutions: [{ ingredient: 'Spinach', ratio: '1:1', note: 'Wilts faster' }],
  allergens: [], seasonality: 'Autumn to early spring', storageType: 'Refrigerate unwashed', shelfLife: '5-7 days',
};
const butterSubs = { substitutes: [
  { name: 'Olive oil', ratio: '3/4 cup per 1 cup', notes: 'Fruity flavor' },
  { name: 'Coconut oil', ratio: '1:1', notes: 'Solid when cool' },
  { name: 'Ghee', ratio: '1:1', notes: 'Nutty' },
  { name: 'Unsweetened applesauce', ratio: '1/2 cup per 1 cup', notes: 'Best for baking, unlike butter it adds moisture' },
] };
let state, passed = 0;

const completion = content => Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });
function reset() {
  state = global.ingredientQA = {
    session: { user: { id: 'synthetic-web-user' } }, sessionCalls: 0, rateLimited: false,
    user: { allergies: ['dairy'], dislikedIngredients: ['coconut'] },
    queries: [], limited: [], calls: [], logs: [],
    reply: body => completion(JSON.stringify(/substitute options/.test(JSON.stringify(body.messages)) ? butterSubs : kaleInfo)),
  };
}
function nativeToken(options = {}, secret = syntheticSecret) {
  return jwt.sign({ type: 'access' }, secret, {
    subject: 'synthetic-native-user', issuer: 'recipe-reborn', audience: 'recipe-reborn-mobile', expiresIn: 60, algorithm: 'HS256', ...options,
  });
}
const request = (url, body, authorization) => new Request(`https://test.invalid${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
async function check(name, run) {
  reset();
  await run();
  assert.doesNotMatch(JSON.stringify(state.logs), new RegExp(`${PRIVATE}|synthetic-gemini`), `${name}: model output and keys are never logged`);
  passed++;
  console.log('PASS:', name);
}

async function main() {
  process.env.NEXTAUTH_SECRET = syntheticSecret;
  process.env.GEMINI_API_KEY = 'synthetic-gemini';
  process.env.AI_PROVIDER = 'gemini';
  const routes = {
    info: { POST: await bundle('app/api/ingredient-info/route.ts'), url: '/api/ingredient-info', body: { ingredient: 'kale' } },
    substitute: { POST: await bundle('app/api/ingredient-substitute/route.ts'), url: '/api/ingredient-substitute', body: { ingredient: 'butter' } },
  };
  global.fetch = async (url, options) => {
    assert(String(url).includes('generativelanguage.googleapis.com'), 'No other network destination is permitted');
    const body = JSON.parse(options.body);
    state.calls.push(body);
    return state.reply(body);
  };
  console.error = (...args) => state.logs.push(args);
  const call = (name, authorization, body = routes[name].body) => routes[name].POST(request(routes[name].url, body, authorization));

  try {
    await check('info: web session returns the full detail contract', async () => {
      const response = await call('info');
      assert.equal(response.status, 200);
      // Numeric amounts are normalized to text; everything else passes through.
      assert.deepEqual(await response.json(), { ...kaleInfo, nutrition: { ...kaleInfo.nutrition, calories: '49' } });
      assert.deepEqual(state.limited, ['synthetic-web-user']);
      assert.match(state.calls[0].messages[1].content, /"kale"/);
    });

    await check('substitute: web session returns name/ratio/notes with profile exclusions removed', async () => {
      const response = await call('substitute');
      assert.equal(response.status, 200);
      // Ghee is dairy (allergy), coconut oil is disliked. The applesauce note
      // mentions butter, but only names are matched, so it stays.
      assert.deepEqual(await response.json(), { substitutes: [butterSubs.substitutes[0], butterSubs.substitutes[3]] });
      assert.deepEqual(state.queries, [{ where: { id: 'synthetic-web-user' }, select: { allergies: true, dislikedIngredients: true } }]);
      assert.deepEqual(state.limited, ['synthetic-web-user']);
      assert.match(state.calls[0].messages[1].content, /Never suggest anything containing: dairy, coconut\./);
    });

    await check('substitute: client-supplied preferences are ignored in favor of the saved profile', async () => {
      state.user = { allergies: [], dislikedIngredients: [] };
      const response = await call('substitute', undefined, { ingredient: 'butter', allergies: ['olive'], dislikedIngredients: ['apple'] });
      assert.equal((await response.json()).substitutes.length, 4);
      assert.doesNotMatch(state.calls[0].messages[1].content, /Never suggest|olive|apple/);
    });

    await check('substitute: every suggestion excluded is an honest empty list', async () => {
      state.user = { allergies: ['dairy'], dislikedIngredients: ['olive oil', 'coconut', 'applesauce'] };
      const response = await call('substitute');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { substitutes: [] });
    });

    for (const name of Object.keys(routes)) {
      await check(`${name}: signed native token is accepted without a web session lookup`, async () => {
        const response = await call(name, 'Bearer ' + nativeToken());
        assert.equal(response.status, 200);
        assert.equal(state.sessionCalls, 0);
        assert.deepEqual(state.limited, ['synthetic-native-user']);
        if (name === 'substitute') assert.equal(state.queries[0].where.id, 'synthetic-native-user');
      });

      for (const [label, authorization] of [
        ['forged signature', 'Bearer ' + nativeToken({}, 'attacker-secret')],
        ['malformed token', 'Bearer not-a-jwt'],
        ['wrong scheme', 'Basic synthetic'],
        ['expired token', 'Bearer ' + nativeToken({ expiresIn: -1 })],
        ['wrong audience', 'Bearer ' + nativeToken({ audience: 'different-app' })],
      ]) {
        await check(`${name}: ${label} is 401 and never falls back to the web session`, async () => {
          assert.equal((await call(name, authorization)).status, 401);
          assert.equal(state.sessionCalls, 0);
          assert.equal(state.limited.length, 0);
          assert.equal(state.queries.length, 0);
          assert.equal(state.calls.length, 0);
        });
      }

      await check(`${name}: anonymous request is 401 before any work`, async () => {
        state.session = null;
        assert.equal((await call(name)).status, 401);
        assert.equal(state.limited.length + state.queries.length + state.calls.length, 0);
      });

      await check(`${name}: shared AI rate gate stops the request before provider work`, async () => {
        state.rateLimited = true;
        assert.equal((await call(name)).status, 429);
        assert.equal(state.queries.length + state.calls.length, 0);
      });

      for (const [label, body] of [['malformed JSON', '{'], ['missing ingredient', {}], ['blank ingredient', { ingredient: '   ' }],
        ['non-text ingredient', { ingredient: 42 }], ['oversized ingredient', { ingredient: 'x'.repeat(201) }]]) {
        await check(`${name}: ${label} is 400 without provider work`, async () => {
          assert.equal((await call(name, undefined, body)).status, 400);
          assert.equal(state.calls.length, 0);
        });
      }

      const valid = name === 'info' ? kaleInfo : butterSubs;
      for (const [label, content] of [
        ['non-JSON reply', `${PRIVATE} {broken`],
        ['empty object', '{}'],
        ['wrong shape', JSON.stringify(name === 'info' ? { name: PRIVATE, category: 'Vegetable' } : { substitutes: [{ substitute: PRIVATE }] })],
        ['wrong field type', JSON.stringify(name === 'info' ? { ...kaleInfo, allergens: PRIVATE } : { substitutes: [{ ...butterSubs.substitutes[0], ratio: 1 }] })],
        ['blank required text', JSON.stringify(name === 'info' ? { ...kaleInfo, category: '  ' } : { substitutes: [{ ...butterSubs.substitutes[0], name: ' ' }] })],
        ['no suggestions', JSON.stringify(name === 'info' ? { ...kaleInfo, nutrition: null } : { substitutes: [] })],
      ]) {
        await check(`${name}: ${label} is an honest error, never fallback content`, async () => {
          state.reply = () => completion(content);
          const response = await call(name);
          assert.equal(response.status, 500);
          const body = await response.json();
          assert.equal(typeof body.error, 'string');
          assert.deepEqual(Object.keys(body), ['error']);
          assert.doesNotMatch(JSON.stringify(body), new RegExp(`${PRIVATE}|Not available|Unknown`));
        });
      }

      await check(`${name}: unknown fields from the model are not passed through`, async () => {
        state.reply = () => completion(JSON.stringify(name === 'info'
          ? { ...kaleInfo, debug: PRIVATE }
          : { substitutes: [{ ...butterSubs.substitutes[0], debug: PRIVATE }], debug: PRIVATE }));
        const response = await call(name);
        assert.equal(response.status, 200);
        assert.doesNotMatch(await response.text(), new RegExp(PRIVATE));
      });

      await check(`${name}: fenced JSON is still accepted`, async () => {
        state.reply = () => completion('```json\n' + JSON.stringify(valid) + '\n```');
        assert.equal((await call(name)).status, 200);
      });
    }

    await check('substitute: deleted account with a still-signed token is 404 before provider work', async () => {
      state.user = null;
      assert.equal((await call('substitute', 'Bearer ' + nativeToken())).status, 404);
      assert.equal(state.calls.length, 0);
    });
  } finally {
    global.fetch = original.fetch; console.error = original.error;
    for (const [key, value] of [['NEXTAUTH_SECRET', original.secret], ['GEMINI_API_KEY', original.gemini], ['AI_PROVIDER', original.provider]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    delete global.ingredientQA;
  }
  console.log(`${passed} ingredient helper checks passed. Real auth/JWT, food matcher and AI transport; mocked session, storage and provider.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
