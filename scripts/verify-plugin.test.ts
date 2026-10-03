import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PluginOAuth, SCOPES, hash, opaque, pluginConfig } from '../lib/plugin/oauth';
import type { PluginStore } from '../lib/plugin/store';
import { PluginTools, type Backend } from '../lib/plugin/tools';
import { authorizeGet, authorizePost, form } from '../lib/plugin/http';
import { handleMcp } from '../lib/plugin/mcp';

// Test-only store and data; production code has no memory/demo mode switch.
class MemoryStore implements PluginStore {
  rows = new Map<string, { value: unknown; expires: number }>();
  clock = Date.now();
  async get<T>(key: string): Promise<T | null> { const row = this.rows.get(key); return row && row.expires > this.clock ? structuredClone(row.value) as T : null; }
  async put(key: string, value: unknown, seconds: number) { this.rows.set(key, { value: structuredClone(value), expires: this.clock + seconds * 1000 }); }
  async take<T>(key: string) { const row = this.rows.get(key); this.rows.delete(key); return row && row.expires > this.clock ? structuredClone(row.value) as T : null; }
  async remove(key: string) { this.rows.delete(key); }
  async limit(key: string, max: number, seconds: number) { const count = (await this.get<number>(`lim:${key}`) || 0) + 1; await this.put(`lim:${key}`, count, seconds); return count <= max; }
}
const config = { origin: 'http://127.0.0.1:4180', resource: 'http://127.0.0.1:4180/api/plugin/mcp', clients: { test: { name: 'Local test host', redirectUris: ['http://127.0.0.1:4190/callback'] } } };
function setup() {
  const store = new MemoryStore(); const auth = new PluginOAuth(config, store, () => store.clock); const verifier = opaque();
  const params = new URLSearchParams({ response_type: 'code', client_id: 'test', redirect_uri: config.clients.test.redirectUris[0], resource: config.resource, scope: SCOPES.join(' '), state: 'test-state', code_challenge_method: 'S256', code_challenge: hash(verifier) });
  return { store, auth, verifier, params };
}
async function linked() {
  const s = setup(); const consent = await s.auth.consent(s.params, 'alice');
  const redirect = new URL(await s.auth.authorize(consent.nonce, 'alice', true));
  const exchange = new URLSearchParams({ grant_type: 'authorization_code', client_id: 'test', redirect_uri: config.clients.test.redirectUris[0], resource: config.resource, code: redirect.searchParams.get('code')!, code_verifier: s.verifier });
  const tokens = await s.auth.token(exchange); const principal = await s.auth.authenticate(`Bearer ${tokens.access_token}`);
  return { ...s, tokens, principal, exchange };
}
const fakeBackend: Backend = {
  account: async userId => { assert.ok(['alice', 'bob'].includes(userId)); return { premium: true }; },
  search: async userId => ({ recipes: [{ id: `${userId}-recipe`, title: 'Synthetic lentil soup' }] }),
  recipe: async (userId, recipeId) => { if (recipeId !== `${userId}-recipe`) throw new Error('not owned'); return { id: recipeId, title: 'Synthetic lentil soup' }; },
  plans: async () => ({ mealPlans: [] }), shopping: async () => ({ shoppingLists: [] }),
  scale: async () => ({ scaled: true }), wine: async () => ({ available: false }), execute: async () => ({ created: true }),
};
test('OAuth discovery advertises PKCE, exact audience and no fabricated OIDC', () => { const { auth } = setup(); assert.deepEqual(auth.metadata().code_challenge_methods_supported, ['S256']); assert.equal(auth.protectedMetadata().resource, config.resource); assert.equal('registration_endpoint' in auth.metadata(), false); });
test('OAuth rejects foreign callbacks, duplicate parameters, scopes and resource', () => {
  for (const [key, value] of [['redirect_uri', 'https://evil.test'], ['resource', 'https://evil.test'], ['scope', 'admin'], ['code_challenge_method', 'plain'], ['client_id', '__proto__']]) { const { auth, params } = setup(); params.set(key, value); assert.throws(() => auth.validate(params)); }
  const { auth, params } = setup(); params.append('client_id', 'test'); assert.throws(() => auth.validate(params));
});
test('Consent is bound to signed-in user, denial echoes state/issuer and creates no token', async () => { const { auth, store, params } = setup(); const c = await auth.consent(params, 'alice'); await assert.rejects(auth.authorize(c.nonce, 'bob', true)); const url = new URL(await auth.authorize(c.nonce, 'alice', false)); assert.equal(url.searchParams.get('error'), 'access_denied'); assert.equal(url.searchParams.get('iss'), config.origin); assert.equal(url.searchParams.get('state'), 'test-state'); assert.equal([...store.rows.keys()].some(k => k.startsWith('code:')), false); });
test('Wrong verifier cannot redeem; code expires and is single-use', async () => {
  const s = setup(); const c = await s.auth.consent(s.params, 'alice'); const r = new URL(await s.auth.authorize(c.nonce, 'alice', true));
  const p = new URLSearchParams({ grant_type: 'authorization_code', client_id: 'test', redirect_uri: config.clients.test.redirectUris[0], resource: config.resource, code: r.searchParams.get('code')!, code_verifier: opaque() });
  await assert.rejects(s.auth.token(p)); p.set('code_verifier', s.verifier); s.store.clock += 121000; await assert.rejects(s.auth.token(p));
  const l = await linked(); await assert.rejects(l.auth.token(l.exchange));
});
test('Access token is opaque, audience-bound, expires; stored keys never contain raw token', async () => { const s = await linked(); assert.equal(s.principal.userId, 'alice'); assert.equal([...s.store.rows.keys()].some(k => k.includes(s.tokens.access_token)), false); await assert.rejects(new PluginOAuth({ ...config, resource: 'https://other.test/mcp' }, s.store).authenticate(`Bearer ${s.tokens.access_token}`)); s.store.clock += 901000; await assert.rejects(s.auth.authenticate(`Bearer ${s.tokens.access_token}`)); });
test('Refresh rotation invalidates replayed family and revocation invalidates access', async () => {
  const s = await linked(); const p = new URLSearchParams({ grant_type: 'refresh_token', client_id: 'test', resource: config.resource, refresh_token: s.tokens.refresh_token });
  const next = await s.auth.token(p); await assert.rejects(s.auth.token(p)); await assert.rejects(s.auth.authenticate(`Bearer ${next.access_token}`));
  const r = await linked(); await r.auth.revoke(r.tokens.refresh_token, 'test'); await assert.rejects(r.auth.authenticate(`Bearer ${r.tokens.access_token}`));
});
test('Concurrent code redemptions only issue one token pair', async () => { const s = setup(); const c = await s.auth.consent(s.params, 'alice'); const url = new URL(await s.auth.authorize(c.nonce, 'alice', true)); const p = new URLSearchParams({ grant_type: 'authorization_code', client_id: 'test', resource: config.resource, redirect_uri: config.clients.test.redirectUris[0], code: url.searchParams.get('code')!, code_verifier: s.verifier }); const results = await Promise.allSettled([s.auth.token(p), s.auth.token(p)]); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); });
test('Browser consent requires session, same origin and nonce cookie; client name is escaped', async () => {
  const s = setup(); const req = new Request(`${config.origin}/api/plugin/authorize?${s.params}`); const login = await authorizeGet(req, null, s.auth); assert.equal(login.status, 303); assert.ok(login.headers.get('location')?.startsWith(`${config.origin}/login?`));
  const response = await authorizeGet(req, 'alice', s.auth); assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/); const cookie = response.headers.get('set-cookie')!.split(';')[0]; const nonce = cookie.split('=')[1];
  const post = (origin: string, c = cookie) => new Request(`${config.origin}/api/plugin/authorize`, { method: 'POST', headers: { origin, cookie: c, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ nonce, decision: 'allow' }) });
  await assert.rejects(authorizePost(post('https://evil.test'), 'alice', s.auth)); await assert.rejects(authorizePost(post(config.origin, ''), 'alice', s.auth)); assert.equal((await authorizePost(post(config.origin), 'alice', s.auth)).status, 303);
});
test('Oversized OAuth forms rejected', async () => { await assert.rejects(form(new Request(config.origin, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'x='.padEnd(9000, 'a') }))); });
test('Production configuration is disabled unless explicitly enabled', () => { const old = process.env.PLUGIN_ENABLED; delete process.env.PLUGIN_ENABLED; assert.throws(pluginConfig); if (old !== undefined) process.env.PLUGIN_ENABLED = old; });
test('Action preview does not execute; confirmation is user/grant bound, one-use, and immutable', async () => {
  const s = await linked(); let calls = 0; const tools = new PluginTools(s.store, { ...fakeBackend, execute: async () => { calls++; return { created: true }; } });
  const action = { kind: 'generate_recipe', ingredients: 'lentils, onion, water' };
  const preview = await tools.prepare(s.principal, action); assert.equal(calls, 0);
  await assert.rejects(tools.execute({ ...s.principal, userId: 'bob' }, preview.confirmationId)); await assert.rejects(tools.execute({ ...s.principal, grantId: 'different' }, preview.confirmationId));
  await tools.execute(s.principal, preview.confirmationId); await assert.rejects(tools.execute(s.principal, preview.confirmationId)); assert.equal(calls, 1);
  await assert.rejects(tools.prepare(s.principal, { ...action, userId: 'bob' }));
});
test('Missing scope, foreign recipe, expired preview and storage failure stop execution', async () => {
  const s = await linked(); const tools = new PluginTools(s.store, fakeBackend);
  await assert.rejects(tools.prepare({ ...s.principal, scopes: ['recipes:read'] }, { kind: 'generate_recipe', ingredients: 'lentils' }));
  await assert.rejects(tools.prepare(s.principal, { kind: 'create_shopping_list', recipeIds: ['bob-recipe'], name: 'Groceries' }));
  const preview = await tools.prepare(s.principal, { kind: 'generate_recipe', ingredients: 'lentils' }); s.store.clock += 301000; await assert.rejects(tools.execute(s.principal, preview.confirmationId));
  const broken = new PluginTools({ ...s.store, limit: async () => { throw new Error('offline'); } } as unknown as PluginStore, fakeBackend); await assert.rejects(broken.check(s.principal, []));
});
test('MCP initialize, tool schemas, resources and account-scoped call work over HTTP', async () => {
  const s = await linked(); const tools = new PluginTools(s.store, fakeBackend); const html = readFileSync('plugins/recipe-reborn/ui/panel.html', 'utf8');
  let n = 0; const call = async (method: string, params: unknown = {}, token = s.tokens.access_token) => {
    const response = await handleMcp(new Request(config.resource, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) }), s.auth, tools, html); return { status: response.status, body: await response.json() };
  };
  assert.equal((await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).body.result.serverInfo.name, 'recipe-reborn');
  const listing = (await call('tools/list')).body.result.tools; assert.equal(listing.length, 9); assert.equal(listing.find((t: { name: string }) => t.name === 'execute_action').annotations.readOnlyHint, false);
  const result = (await call('tools/call', { name: 'search_recipes', arguments: {} })).body.result; assert.equal(result.structuredContent.recipes[0].id, 'alice-recipe');
  assert.equal((await call('tools/call', { name: 'execute_action', arguments: { confirmationId: opaque(), confirmed: false } })).body.result.isError, true);
  assert.equal((await call('resources/read', { uri: 'ui://recipe-reborn/panel.html' })).body.result.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.equal((await call('tools/list', {}, 'bad')).status, 401);
});
test('MCP rejects hostile Origin and Host', async () => { const s = await linked(); const tools = new PluginTools(s.store, fakeBackend); for (const [url, origin] of [[config.resource, 'https://evil.test'], ['https://evil.test/api/plugin/mcp', config.origin]]) { const r = await handleMcp(new Request(url, { method: 'POST', headers: { origin } }), s.auth, tools, ''); assert.equal(r.status, 403); } });
test('MCP missing scope returns an actionable OAuth challenge without executing', async () => {
  const s = await linked(); const grantKey = `grant:${s.principal.grantId}`;
  await s.store.put(grantKey, { ...s.principal, scopes: ['recipes:read'] }, 3600);
  const response = await handleMcp(new Request(config.resource, { method: 'POST', headers: { authorization: `Bearer ${s.tokens.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'prepare_action', arguments: { action: { kind: 'generate_recipe', ingredients: 'lentils' } } } }) }), s.auth, new PluginTools(s.store, fakeBackend), '');
  const result = (await response.json()).result;
  assert.equal(result.isError, true); assert.match(result._meta['mcp/www_authenticate'][0], /scope="ai:generate"/);
  assert.equal([...s.store.rows.keys()].some(key => key.startsWith('action:')), false);
});
test('Concurrent confirmation attempts execute once and AI limit fails closed', async () => {
  const s = await linked(); let writes = 0;
  const tools = new PluginTools(s.store, { ...fakeBackend, execute: async () => { writes++; return {}; } });
  const preview = await tools.prepare(s.principal, { kind: 'generate_recipe', ingredients: 'lentils' });
  const outcomes = await Promise.allSettled([tools.execute(s.principal, preview.confirmationId), tools.execute(s.principal, preview.confirmationId)]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.equal(writes, 1);
  const blocked = new PluginTools({ get: s.store.get.bind(s.store), put: s.store.put.bind(s.store), take: s.store.take.bind(s.store), remove: s.store.remove.bind(s.store), limit: async key => !key.startsWith('ai-') }, fakeBackend);
  const next = await blocked.prepare(s.principal, { kind: 'generate_recipe', ingredients: 'lentils' });
  await assert.rejects(blocked.execute(s.principal, next.confirmationId), /ai_limit_reached/);
});
