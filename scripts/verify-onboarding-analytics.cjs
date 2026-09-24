const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

// Exercise the real component handlers with controlled hooks and network responses.
// No accounts, preferences, analytics events, or AI requests leave this process.
function harness(entry, { analytics = 'pending', saveOk = true, loginError = false } = {}) {
  const state = [], effects = [], requests = [], routes = [], messages = [];
  let cursor = 0, mounted = false, signIns = 0;
  const context = vm.createContext({
    console,
    window: { location: { pathname: '/signup' } },
    localStorage: { getItem: () => 'rr-sep23-personal' },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === '/api/analytics/event') {
        if (analytics === 'pending') return new Promise(() => {});
        if (analytics === 'rejected') throw new Error('Analytics unavailable');
        return { ok: true };
      }
      if (url === '/api/user/subscription') return { ok: true, json: async () => ({
        subscriptionTier: 'free', subscriptionStatus: 'active', generationCount: 0,
        lastGenerationReset: '2026-09-23T00:00:00Z', currentPeriodEnd: null,
      }) };
      if (url === '/api/user/preferences') return {
        ok: options?.method === 'PUT' ? saveOk : true,
        json: async () => ({ allergies: [], dislikedIngredients: ['olives'] }),
      };
      assert.equal(url, '/api/signup', 'Unexpected network destination');
      return { ok: saveOk, json: async () => saveOk ? {} : { error: 'Email already exists' } };
    },
  });
  const ui = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : String(name) });
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useEffect(callback) { if (!mounted) effects.push(callback); },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next-auth/react': {
      useSession: () => ({ status: 'authenticated' }),
      signIn: async () => { signIns++; return loginError ? { error: 'CredentialsSignin' } : {}; },
    },
    'next/navigation': { useRouter: () => ({
      push: path => routes.push(path), replace: path => routes.push(path), refresh() {},
    }) },
    'react-hot-toast': { success: text => messages.push(text), error: text => messages.push(text) },
  };
  function load(file) {
    const compiled = esbuild.transformSync(fs.readFileSync(file, 'utf8'), {
      loader: file.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs', jsx: 'automatic',
    }).code;
    const module = { exports: {} };
    const importer = name => {
      if (name === '@/lib/funnel-analytics') return load('lib/funnel-analytics.ts');
      if (name in dependencies) return dependencies[name];
      if (name.startsWith('@/components/') || name === 'lucide-react' || name === 'next/link') return ui;
      throw new Error(`Unexpected import: ${name}`);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(importer, module, module.exports);
    return module.exports;
  }
  const component = load(entry);
  function render() {
    cursor = 0;
    return (component.SignupForm || component.default)();
  }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = find(child, predicate);
      if (match) return match;
    }
    return null;
  }
  return {
    render, find, requests, routes, messages, signIns: () => signIns,
    mount() { render(); mounted = true; effects.forEach(effect => effect()); },
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
async function verifySignup(options) {
  const h = harness('app/signup/_components/signup-form.tsx', options);
  h.mount();
  let tree = h.render();
  h.find(tree, n => n.props?.id === 'email').props.onChange({ target: { value: 'synthetic@example.com' } });
  h.find(tree, n => n.props?.id === 'password').props.onChange({ target: { value: 'test-only-password' } });
  tree = h.render();
  assert.equal(h.find(tree, n => n.props?.id === 'adult-confirmed').props.checked, false);
  assert.equal(h.find(tree, n => n.props?.type === 'submit').props.disabled, true);
  await h.find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests.filter(r => r.url === '/api/signup').length, 0, 'Unchecked confirmation must reject even a direct submit event');
  h.find(tree, n => n.props?.id === 'adult-confirmed').props.onChange({ target: { checked: true } });
  tree = h.render();
  let done = false;
  const submission = h.find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} }).then(() => { done = true; });
  await flush();
  assert.ok(done, 'Account created, but analytics prevented signup from finishing');
  await submission;
  const payload = JSON.parse(h.requests.find(r => r.url === '/api/signup').options.body);
  assert.equal(payload.src, 'rr-sep23-personal', 'Campaign attribution must survive signup');
  assert.equal(payload.confirmPassword, payload.password);
  assert.equal(payload.adultConfirmed, true);
  assert.equal(h.signIns(), options.saveOk === false ? 0 : 1);
  assert.deepEqual(h.routes, options.saveOk === false ? [] : [options.loginError ? '/login' : '/generator']);
  const completionEvents = h.requests.filter(r => r.url === '/api/analytics/event' && JSON.parse(r.options.body).event === 'signup_completed');
  assert.equal(completionEvents.length, options.saveOk === false ? 0 : 1);
  assert.equal(h.find(h.render(), n => n.props?.type === 'submit').props.disabled, false);
}

async function verifyPreferences(options) {
  const h = harness('app/account/page.tsx', options);
  h.mount();
  await flush();
  const save = h.find(h.render(), n => n.props?.children === 'Save Preferences');
  assert.ok(save, 'Preferences form must load');
  let done = false;
  const saving = save.props.onClick().then(() => { done = true; });
  await flush();
  assert.ok(done, 'Preferences saved, but analytics prevented confirmation');
  await saving;
  assert.ok(h.messages.some(message => options.saveOk === false ? message === 'Failed to save preferences' : message.startsWith('Food preferences saved')));
  assert.equal(h.find(h.render(), n => n.props?.children === 'Save Preferences').props.disabled, false);
}

(async () => {
  const failures = [];
  for (const verify of [verifySignup, verifyPreferences]) {
    for (const options of [{ analytics: 'pending' }, { analytics: 'rejected' }, { analytics: 'resolved' }, { saveOk: false }, ...(verify === verifySignup ? [{ loginError: true }] : [])]) {
      try { await verify(options); }
      catch (error) { failures.push(`${verify.name} ${JSON.stringify(options)}: ${error.message}`); }
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS: signup and preference completion with pending/failed/successful analytics, API errors, login fallback, attribution, and loading-state recovery. No live requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
