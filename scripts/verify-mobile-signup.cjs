const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

async function bundle(entry, mocks) {
  const built = await esbuild.build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    jsx: 'automatic', tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
    alias: { '@': path.resolve('mobile/src') },
    plugins: [{ name: 'synthetic-mobile', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : null);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const m = new Module(path.resolve('scripts/mobile-signup-under-test.cjs'), module);
  m.filename = path.resolve('scripts/mobile-signup-under-test.cjs'); m.paths = module.paths;
  m._compile(built.outputFiles[0].text, m.filename); return m.exports;
}
function hooks() {
  const values = []; let cursor = 0;
  return {
    reset() { cursor = 0; },
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }]; },
  };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, predicate); if (hit) return hit; } return null; }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

(async () => {
  try {
    const common = {
      react: 'export const useState=(...a)=>globalThis.mobileSignupHooks.useState(...a); export const useCallback=f=>f; export const useEffect=()=>{}; export const useMemo=f=>f(); export const createContext=()=>({Provider:"AuthProvider"}); export const useContext=()=>null;',
      'react/jsx-runtime': 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment="Fragment";',
      'react-native': 'export const Platform={OS:"android"}; export const StyleSheet={create:x=>x}; export const KeyboardAvoidingView="KeyboardAvoidingView",ScrollView="ScrollView",Text="Text",View="View",Pressable="Pressable";',
      'expo-router': 'export const Link="Link";',
      '@/components/ui': 'export const Button="Button",Card="Card",Field="Field",InlineError="InlineError",Screen="Screen";',
    };
    const calls = []; globalThis.mobileSignupCalls = calls; globalThis.mobileSignupHooks = hooks();
    const screen = await bundle('mobile/src/app/(auth)/sign-up.tsx', { ...common,
      '@/providers/auth-provider': 'export const useAuth=()=>({signUp:async(...args)=>{globalThis.mobileSignupCalls.push(args);}});',
    });
    const render = () => { globalThis.mobileSignupHooks.reset(); return screen.default(); };
    const button = tree => find(tree, n => n.props?.label === 'Create account');
    const checkbox = tree => find(tree, n => n.props?.accessibilityRole === 'checkbox');
    let tree = render();
    assert.equal(checkbox(tree).props.accessibilityState.checked, false);
    assert.equal(checkbox(tree).props.accessibilityLabel, 'I confirm I am 18 or older.');
    find(tree, n => n.props?.accessibilityLabel === 'Email').props.onChangeText('adult@example.com');
    find(tree, n => n.props?.accessibilityLabel === 'Password').props.onChangeText('synthetic-password');
    tree = render(); assert.equal(button(tree).props.disabled, true);
    await button(tree).props.onPress(); assert.equal(calls.length, 0, 'Unconfirmed submission must not call signup, even when invoked directly.');
    checkbox(tree).props.onPress(); tree = render();
    assert.equal(checkbox(tree).props.accessibilityState.checked, true); assert.equal(button(tree).props.disabled, false);
    await button(tree).props.onPress(); assert.deepEqual(calls, [['adult@example.com', 'synthetic-password', '', true]]);
    tree = render(); checkbox(tree).props.onPress(); tree = render(); assert.equal(button(tree).props.disabled, true);
    await button(tree).props.onPress(); assert.equal(calls.length, 1);
    console.log('PASS: mobile signup starts unchecked, blocks unconfirmed submission, sends the selected true value, and blocks again when unchecked.');

    globalThis.mobileSignupHooks = hooks(); const requests = []; globalThis.mobileSignupRequests = requests;
    const provider = await bundle('mobile/src/providers/auth-provider.tsx', { ...common,
      'expo-device': 'export const deviceName="Synthetic Android",modelName="Synthetic";',
      'expo-sqlite': 'export const useSQLiteContext=()=>({});',
      '@/services/api': 'export const apiRequest=async()=>({}); export const publicRequest=async(url,init)=>{globalThis.mobileSignupRequests.push({url,body:JSON.parse(init.body)}); return {tokens:{accessToken:"synthetic",refreshToken:"synthetic"},user:{id:"synthetic",email:"adult@example.com",name:null}};};',
      '@/services/auth-storage': 'export const getSessionRevision=()=>0; export const clearRegisteredPushToken=async()=>{},clearTokens=async()=>{},readRegisteredPushToken=async()=>null,readTokens=async()=>null,saveCachedUser=async()=>true,saveTokens=async()=>true;',
      '@/services/shopping-cache': 'export const clearShoppingCache=async()=>{};',
      '@/services/session-recovery': 'export const restoreStoredSession=async()=>null;',
    });
    const auth = provider.AuthProvider({ children: null }).props.value;
    await auth.signUp('adult@example.com', 'synthetic-password', 'CODE', true);
    assert.equal(requests[0].url, '/api/signup'); assert.equal(requests[0].body.adultConfirmed, true);
    assert.equal(requests[0].body.src, 'mobile'); assert.equal(requests[0].body.code, 'CODE');
    requests.length = 0; await auth.signUp('adult@example.com', 'synthetic-password');
    assert.equal(requests[0].body.adultConfirmed, false, 'The provider must never infer acceptance from an omitted argument.');
    console.log('PASS: auth provider sends explicit confirmation and defaults omitted confirmation to false. No live account or network calls.');
  } finally {
    delete globalThis.mobileSignupHooks; delete globalThis.mobileSignupCalls; delete globalThis.mobileSignupRequests;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
