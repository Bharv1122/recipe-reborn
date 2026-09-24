const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

async function bundle(entry, mocks) {
  const built = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    jsx: 'automatic', tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } }, alias: { '@': path.resolve('mobile/src') },
    plugins: [{ name: 'report-test', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : null);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const m = new Module(path.resolve('scripts/report-under-test.cjs'), module); m.filename = path.resolve('scripts/report-under-test.cjs'); m.paths = module.paths;
  m._compile(built.outputFiles[0].text, m.filename); return m.exports;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const result = find(child, predicate); if (result) return result; } return null; }
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function hooks() {
  const values = [], effects = []; let cursor = 0, pending = [], active = true, writesAfterUnmount = 0;
  return {
    reset() { cursor = 0; pending = []; },
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { if (!active) writesAfterUnmount++; values[i] = typeof value === 'function' ? value(values[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || deps.some((v, j) => v !== effects[i].deps[j])) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
    flush() { pending.forEach(fn => fn()); },
    unmount() { active = false; effects.forEach(effect => effect?.cleanup?.()); },
    get writesAfterUnmount() { return writesAfterUnmount; },
  };
}

(async () => {
  globalThis.reportRevision = 1;
  const authMock = 'export const getSessionRevision=()=>globalThis.reportRevision;';
  const calls = []; globalThis.reportApi = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true, id: 'stored-id' }), { status: 201 }); };
  const service = await bundle('mobile/src/services/content-reports.ts', {
    '@/services/auth-storage': authMock,
    '@/services/api': 'export class ApiError extends Error { constructor(message,status){super(message);this.status=status;} } export const apiResponse=(...args)=>globalThis.reportApi(...args);',
  });
  const selected = { source: 'chat', message: 'Selected reply only', conversation: ['DO NOT SEND'] };
  assert.equal(await service.submitContentReport(selected, 'unsafe', '  Note  '), 'stored-id');
  assert.equal(calls[0].url, '/api/mobile/recipe-reports');
  assert.deepEqual(JSON.parse(calls[0].init.body), { source: 'chat', message: 'Selected reply only', reason: 'unsafe', details: 'Note' });
  assert.equal(calls[0].init.method, 'POST'); assert.ok(calls[0].init.signal instanceof AbortSignal);
  await service.submitContentReport({ source: 'saved', recipeId: 'owned-id', recipe: { title: 'DO NOT TRUST' } }, 'other', '');
  assert.deepEqual(JSON.parse(calls[1].init.body), { source: 'saved', recipeId: 'owned-id', reason: 'other' });
  await service.submitContentReport({ source: 'generated', recipe: { title: 'Test soup', freshIngredients: ['water'], instructions: ['Boil'], privateExtra: 'DO NOT SEND' } }, 'incorrect', '');
  assert.deepEqual(JSON.parse(calls[2].init.body), { source: 'generated', reason: 'incorrect', recipe: { title: 'Test soup', freshIngredients: ['water'], instructions: ['Boil'] } });
  for (const [status, body] of [[200, { ok: true, id: 'id' }], [201, { ok: true }], [201, { ok: false, id: 'id' }], [201, { ok: true, id: ' ' }]]) {
    globalThis.reportApi = async () => new Response(JSON.stringify(body), { status });
    await assert.rejects(service.submitContentReport(selected, 'unsafe', ''), /could not confirm/);
  }
  globalThis.reportApi = async () => new Response('{', { status: 201 });
  await assert.rejects(service.submitContentReport(selected, 'unsafe', ''), /could not confirm/);
  for (const status of [401, 429, 503]) {
    globalThis.reportApi = async () => new Response(JSON.stringify({ error: 'Please try later.' }), { status });
    await assert.rejects(service.submitContentReport(selected, 'unsafe', ''), error => error.status === status && error.message === 'Please try later.');
  }
  globalThis.reportApi = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(service.submitContentReport(selected, 'unsafe', ''), /Network unavailable/);
  globalThis.reportApi = async () => ({ status: 201, ok: true, json: async () => { globalThis.reportRevision++; return { ok: true, id: 'stale' }; } });
  await assert.rejects(service.submitContentReport(selected, 'unsafe', ''), error => error.status === 409);
  console.log('PASS: transport sends only selected content; saved snapshot stays server-owned; only durable 201 + ID succeeds; malformed, network, HTTP and session-change failures remain failures.');

  globalThis.reportUser = { id: 'owner-a' }; globalThis.reportRevision = 10;
  const uiCalls = []; let request = deferred();
  globalThis.reportSubmit = (...args) => { uiCalls.push(args); return request.promise; };
  const component = await bundle('mobile/src/components/report-content.tsx', {
    react: 'export const useState=(...a)=>globalThis.reportHooks.useState(...a); export const useRef=(...a)=>globalThis.reportHooks.useRef(...a); export const useEffect=(...a)=>globalThis.reportHooks.useEffect(...a);',
    'react/jsx-runtime': 'export const jsx=(type,props,key)=>({type,props,key}); export const jsxs=jsx; export const Fragment="Fragment";',
    'react-native': 'export const Platform={OS:"android"}; export const StyleSheet={create:x=>x}; export const KeyboardAvoidingView="KeyboardAvoidingView",Modal="Modal",ScrollView="ScrollView",Text="Text",View="View",Pressable="Pressable";',
    '@/components/ui': 'export const Button="Button",Field="Field",InlineError="InlineError";',
    '@/providers/auth-provider': 'export const useAuth=()=>({user:globalThis.reportUser});',
    '@/services/auth-storage': authMock,
    '@/services/content-reports': 'export const submitContentReport=(...a)=>globalThis.reportSubmit(...a);',
  });
  let target = { source: 'chat', message: 'One selected reply' }, key, state, tree;
  function render() {
    const element = component.ReportContentAction({ target });
    if (!element) { state?.unmount(); key = undefined; tree = null; return tree; }
    if (key !== element.key) { state?.unmount(); state = hooks(); key = element.key; }
    globalThis.reportHooks = state; state.reset(); tree = element.type(element.props); state.flush(); return tree;
  }
  const button = label => find(tree, n => n.props?.label === label);
  const modal = () => find(tree, n => n.type === 'Modal');
  const note = () => find(tree, n => n.props?.accessibilityLabel === 'Optional report note');
  const radio = label => find(tree, n => n.props?.accessibilityRole === 'radio' && n.props.accessibilityLabel === label);
  function open() { render(); find(tree, n => n.type === 'Pressable' && n.props.accessibilityRole === 'button').props.onPress(); render(); }
  function select() { radio('Unsafe advice').props.onPress(); render(); }
  render(); assert.equal(modal().props.visible, false); open();
  assert.equal(modal().props.visible, true); assert.equal(button('Send report').props.disabled, true);
  assert.equal(note().props.maxLength, 500); assert.ok(find(tree, n => n.props?.accessibilityViewIsModal));
  assert.ok(find(tree, n => n.type === 'ScrollView')); assert.ok(find(tree, n => n.type === 'KeyboardAvoidingView'));
  await button('Send report').props.onPress(); assert.equal(uiCalls.length, 0);
  select(); note().props.onChangeText('Keep this retry note'); render();
  const send = button('Send report').props.onPress; const pending = send(); await send();
  assert.equal(uiCalls.length, 1, 'Two taps before rerender must send once.');
  render(); assert.equal(button('Send report').props.loading, true); modal().props.onRequestClose(); render(); assert.equal(modal().props.visible, true);
  request.reject(new Error('Report limit reached. Try again in one hour.')); await pending; render();
  assert.match(find(tree, n => n.type === 'InlineError').props.message, /limit/);
  assert.equal(note().props.value, 'Keep this retry note'); assert.equal(radio('Unsafe advice').props.accessibilityState.checked, true);
  assert.equal(button('Send report').props.loading, false); request = deferred();
  const retried = button('Send report').props.onPress(); request.resolve('stored-id'); await retried; render();
  assert.ok(button('Done')); assert.equal(button('Send report'), null); assert.equal(uiCalls.length, 2);
  button('Done').props.onPress(); render(); assert.equal(modal().props.visible, false);
  console.log('PASS: accessible in-app dialog requires a reason, prevents duplicate pending taps, preserves a failed report for retry, and confirms only a saved report.');

  open(); select(); note().props.onChangeText('Owner A private note'); render(); request = deferred();
  const oldRequest = button('Send report').props.onPress(), oldState = state;
  globalThis.reportUser = { id: 'owner-b' }; render(); assert.equal(modal().props.visible, false);
  open(); assert.equal(note().props.value, ''); assert.equal(button('Send report').props.disabled, true);
  request.resolve('old-account-report'); await oldRequest; render(); assert.equal(oldState.writesAfterUnmount, 0); assert.equal(button('Done'), null);
  select(); request = deferred(); const changedContent = button('Send report').props.onPress(), oldContentState = state;
  target = { source: 'chat', message: 'Different selected reply' }; render(); assert.equal(modal().props.visible, false);
  request.reject(new Error('Old response error')); await changedContent; render(); assert.equal(oldContentState.writesAfterUnmount, 0);
  open(); select(); request = deferred(); const unmountedRequest = button('Send report').props.onPress(), unmountedState = state;
  state.unmount(); request.resolve('late'); await unmountedRequest; assert.equal(unmountedState.writesAfterUnmount, 0);
  key = undefined; open(); select(); request = deferred(); const changedSession = button('Send report').props.onPress();
  globalThis.reportRevision++; request.resolve('stale-session'); await changedSession; render(); assert.equal(modal().props.visible, false);
  globalThis.reportUser = null; assert.equal(render(), null);
  console.log('PASS: account, session, selected-content changes and unmount discard old notes, late success and late errors; signed-out users cannot report.');

  for (const [file, pattern] of [
    ['mobile/src/app/generate.tsx', /ReportContentAction target=\{\{ source: 'generated'/],
    ['mobile/src/app/recipes/[id].tsx', /ReportContentAction target=\{\{ source: 'saved', recipeId: recipe.id/],
    ['mobile/src/app/chat.tsx', /message.role === 'assistant' \? <ReportContentAction target=\{\{ source: 'chat', message: message.content/],
  ]) assert.match(fs.readFileSync(file, 'utf8'), pattern, `Missing reporting entry point in ${file}`);
  console.log('PASS: generated recipes, saved recipes and assistant replies expose reporting entry points. No network, real reports or personal data used.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const name of ['reportRevision', 'reportApi', 'reportUser', 'reportSubmit', 'reportHooks']) delete globalThis[name];
});
