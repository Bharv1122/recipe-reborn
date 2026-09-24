const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

async function bundle(entry, mocks = {}) {
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    packages: 'external', plugins: [{ name: 'test-dependencies', setup(build) {
      for (const [name, contents] of Object.entries(mocks)) {
        build.onResolve({ filter: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }, () => ({ path: name, namespace: 'mock' }));
        build.onLoad({ filter: /.*/, namespace: 'mock' }, args => args.path === name ? { contents, loader: 'js' } : null);
      }
    } }] });
  const module = new Module(path.resolve(entry), moduleParent);
  module.filename = path.resolve(entry); module.paths = Module._nodeModulePaths(path.dirname(module.filename));
  module._compile(result.outputFiles[0].text, module.filename);
  return module.exports;
}
const moduleParent = module;

(async () => {
  const facts = await bundle('lib/nutrition-facts.ts');
  const additives = await bundle('lib/additives.ts');
  const handoff = await bundle('mobile/src/services/scan-recipe-handoff.ts');
  for (const value of [null, undefined, '', ' ', false, true, {}, -1, 'NaN', Infinity]) assert.equal(facts.nullableNutritionNumber(value), null);
  assert.equal(facts.nullableNutritionNumber(0), 0);
  const original = facts.originalNutritionFromOpenFoodFactsProduct({ product_name: 'Sample', nutriments: { 'energy-kcal_100g': 200, sodium_100g: 0.25, proteins_100g: null } });
  assert.equal(original.values.sodium, 250, 'OpenFoodFacts sodium grams must become mg.');
  assert.equal(original.values.protein, null, 'Unknown package values must not become zero.');
  assert.equal(original.basisLabel, 'Per 100 g');
  assert.equal(facts.originalNutritionFromOpenFoodFactsProduct({ nutriments: { sodium_100g: null } }), null);
  assert.equal(facts.originalNutritionFromLabelScan({ calories: 100 }).reviewRequired, true);
  assert.deepEqual(additives.detectAdditives('High fructose corn syrup, artificial flavor').map(a => a.name), ['Artificial flavor', 'High-fructose corn syrup']);
  assert.equal(additives.detectAdditives('high fructose corn syrup, corn syrup').length, 2, 'Separately listed corn syrup still counts.');
  assert.equal(additives.detectAdditives('MSG, monosodium glutamate, msg').length, 1);
  assert.equal(additives.detectAdditives('swordfish, tomsgreen').length, 0);
  handoff.stageScanRecipeHandoff({ source: 'label', origin: 'barcode', ingredients: 'oats', context: 'Sample', originalNutrition: original });
  assert.deepEqual(handoff.takeScanRecipeHandoff().originalNutrition, original);
  assert.equal(handoff.takeScanRecipeHandoff(), null);

  const route = await bundle('app/api/nutrition/estimate/route.ts', {
    '@/lib/request-auth': 'export async function getRequestUserId(request) { return request.headers.get("authorization") === "Bearer qa" ? "qa" : null; }',
    '@/lib/rate-limit': 'export async function rateLimit() { return { success: !globalThis.qaRateLimited }; }',
    '@/lib/ai': 'export const AI_API_KEY="test", AI_CHAT_URL="https://example.invalid", MODEL_FAST="test";',
  });
  let providerCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { providerCalls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ calories: 200.6, protein: 4.14, carbs: null, fat: -2, sodium: 0 }) } }] }); };
  const request = (body, authorized = true) => new Request('https://example.invalid/api/nutrition/estimate', { method: 'POST', headers: authorized ? { authorization: 'Bearer qa' } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const recipe = { title: 'Oats', freshIngredients: ['1 cup oats'], instructions: ['Cook oats'], servings: '2' };
  try {
    assert.equal((await route.POST(request(recipe, false))).status, 401);
    global.qaRateLimited = true;
    assert.equal((await route.POST(request(recipe))).status, 429);
    global.qaRateLimited = false;
    assert.equal((await route.POST(request('{'))).status, 400);
    assert.equal((await route.POST(request({ title: 'Empty' }))).status, 400);
    assert.equal(providerCalls, 0, 'Invalid, unauthorized, and limited requests must not call the AI provider.');
    const response = await route.POST(request(recipe));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.calories, 201); assert.equal(result.protein, 4.1);
    assert.equal(result.carbs, null); assert.equal(result.fat, null); assert.equal(result.fiber, null); assert.equal(result.sodium, 0);
    assert.equal(result.accuracy, 'estimated'); assert.match(result.basisLabel, /makes 2/);
    assert.equal(providerCalls, 1);

  } finally { global.fetch = originalFetch; delete global.qaRateLimited; }
  console.log('PASS: package source handoff, additive deduplication, unknown nutrients, sodium units, auth/rate gates, and estimated nutrition response. No live AI or database calls.');

  const voice = await bundle('app/api/transcribe-audio/route.ts', {
    '@/lib/request-auth': 'export async function getRequestUserId(request) { return request.headers.get("authorization") === "Bearer qa" ? "qa" : null; }',
    '@/lib/rate-limit': 'export async function rateLimit() { return { success: !globalThis.qaRateLimited }; }',
    '@/lib/ai': 'export const AI_API_KEY="test", AI_AUDIO_URL="https://example.invalid/models/test:generateContent";',
  });
  let audioPayload;
  providerCalls = 0;
  global.fetch = async (url, options) => { assert.match(url,/generateContent$/);providerCalls++; audioPayload = JSON.parse(options.body); return Response.json({ candidates: [{ content: { parts: [{text:'  eggs and spinach  '}] } }] }); };
  const recording = (blob, authorized = true) => { const form = new FormData(); if (blob) form.append('audio', blob, 'clip.m4a'); return new Request('https://example.invalid/api/transcribe-audio', {method:'POST',headers:authorized?{authorization:'Bearer qa'}:{},body:form}); };
  const mp4 = new Blob([new Uint8Array([0,0,0,20,0x66,0x74,0x79,0x70,0,0])], {type:'application/octet-stream'});
  try {
    assert.equal((await voice.POST(recording(mp4, false))).status, 401);
    global.qaRateLimited = true;
    assert.equal((await voice.POST(recording(mp4))).status, 429);
    global.qaRateLimited = false;
    assert.equal((await voice.POST(request('{'))).status, 400);
    assert.equal((await voice.POST(recording())).status, 400);
    assert.equal((await voice.POST(recording(new Blob([])))).status, 400);
    assert.equal((await voice.POST(recording(new Blob([new Uint8Array(10*1024*1024+1)])))).status, 413);
    assert.equal(providerCalls, 0, 'Invalid audio must not reach the provider.');
    const response = await voice.POST(recording(mp4));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, 'eggs and spinach');
    assert.equal(audioPayload.contents[0].parts[1].inlineData.mimeType, 'audio/m4a', 'Phone M4A must use the native audio endpoint and its supported MIME type.');
    assert.equal(providerCalls, 1);
    for (const candidate of [
      { candidates: [{ finishReason:'MAX_TOKENS', content:{parts:[{text:'partial ingredients'}]} }] },
      { promptFeedback:{blockReason:'SAFETY'} },
      { candidates:[{finishReason:'SAFETY'}] },
      { candidates:[{finishReason:'STOP'}] },
    ]) {
      global.fetch = async () => Response.json(candidate);
      const failure = await voice.POST(recording(mp4));
      assert.equal(failure.status, 502, 'Blocked, truncated or malformed provider responses must not be accepted as complete.');
      assert.equal((await failure.json()).text, undefined);
    }
    global.fetch = async () => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:''}]}}]});
    assert.equal((await (await voice.POST(recording(mp4))).json()).text,'','Valid silence stays distinct from provider failure.');
    const originalTimer = global.setTimeout;
    try {
      global.setTimeout = (callback, delay, ...args) => originalTimer(callback, delay === 45_000 ? 1 : delay, ...args);
      global.fetch = async (_url, options) => new Promise((_resolve,reject) => {
        const abort = () => reject(new DOMException('Aborted','AbortError'));
        if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});
      });
      assert.equal((await voice.POST(recording(mp4))).status,504,'Provider timeout must be visible as retryable.');
      const abort = new AbortController();
      const canceled = new Request(recording(mp4),{signal:abort.signal});abort.abort();
      assert.equal((await voice.POST(canceled)).status,499,'User cancellation must not look like a server crash.');
    } finally { global.setTimeout = originalTimer; }
  } finally { global.fetch = originalFetch; delete global.qaRateLimited; }

  const calls = [];
  global.qaExpoFetch = async (url, options) => { calls.push({ transport:'expo',url,options }); return calls.length===1 ? Response.json({}, {status:401}) : Response.json({text:'eggs'}); };
  global.fetch = async (url, options) => { calls.push({transport:'global',url,options}); return Response.json({tokens:{accessToken:'fresh',refreshToken:'refresh'}}); };
  const api = await bundle('mobile/src/services/api.ts', {
    'expo-constants':'export default {expoConfig:{extra:{apiBaseUrl:"https://example.invalid"}}};',
    'expo/fetch':'export const fetch = (...args) => globalThis.qaExpoFetch(...args);',
    '@/services/auth-storage':'let tokens={accessToken:"expired",refreshToken:"refresh"}; export function getSessionRevision(){return 0;} export async function readTokens(){return tokens;} export async function saveTokens(value){tokens=value;return true;} export async function clearTokens(){tokens=null;}',
  });
  try {
    const form = new FormData(); form.append('audio', mp4, 'clip.m4a');
    const controller = new AbortController();
    assert.equal((await api.apiRequest('/api/transcribe-audio',{method:'POST',body:form,signal:controller.signal})).text,'eggs');
    assert.deepEqual(calls.map(c=>c.transport),['expo','global','expo']);
    assert.equal(calls[0].options.headers.Authorization,'Bearer expired');
    assert.equal(calls[2].options.headers.Authorization,'Bearer fresh');
    assert.equal(calls[2].options.body,form);
    assert.equal(calls[2].options.signal,controller.signal);
    assert.equal(calls[2].options.headers['Content-Type'],undefined, 'Multipart transport must supply its own boundary.');
  } finally { global.fetch = originalFetch; delete global.qaExpoFetch; }
  console.log('PASS: voice auth/rate/size gates, native M4A recognition, transcript review response, and authenticated multipart refresh/retry. No live microphone or AI calls.');

  const photo = await bundle('mobile/src/services/photo-upload.ts', {
    'expo-file-system':'export class File { constructor(uri){this.uri=uri;this.size=globalThis.qaPhotoSizes.shift();this.exists=true;} delete(){globalThis.qaPhotoDeleted.push(this.uri);} }',
    'expo-image-manipulator':'export const SaveFormat={JPEG:"jpeg"}; export const ImageManipulator={manipulate(uri){globalThis.qaPhotoSources.push(uri);return {resize(){},async renderAsync(){return {async saveAsync(){return {uri:`cache://copy-${globalThis.qaPhotoSources.length}.jpg`};},release(){globalThis.qaPhotoReleases++;}};},release(){globalThis.qaPhotoReleases++;}};}};',
  });
  global.qaPhotoSources=[]; global.qaPhotoDeleted=[]; global.qaPhotoReleases=0; global.qaPhotoSizes=[2*1024*1024,800*1024];
  try {
    const file=await photo.preparePhotoUpload('library://original');
    assert.ok(file.size<=900*1024);
    assert.deepEqual(global.qaPhotoSources,['library://original','library://original']);
    assert.deepEqual(global.qaPhotoDeleted,['cache://copy-1.jpg']);
    assert.equal(global.qaPhotoReleases,4);
    photo.removeUploadCopy(file);
    assert.deepEqual(global.qaPhotoDeleted,['cache://copy-1.jpg','cache://copy-2.jpg']);
    global.qaPhotoSizes=[2*1024*1024,2*1024*1024,2*1024*1024];
    await assert.rejects(photo.preparePhotoUpload('library://original'),/try a closer photo/);
    assert.equal(global.qaPhotoDeleted.length,5);
    assert.ok(!global.qaPhotoDeleted.includes('library://original'));
  } finally { for(const key of ['qaPhotoSources','qaPhotoDeleted','qaPhotoReleases','qaPhotoSizes'])delete global[key]; }
  console.log('PASS: photo size fallback and cleanup delete only temporary upload copies, keeping original photos intact. Image encoding itself still requires device QA.');
})().catch(error => { console.error(error); process.exitCode = 1; });
