/**
 * Local test for the public MCP endpoint behind the Muse connector.
 * Drives the real handler through the official MCP client — no server, no
 * network, no database, no AI calls.
 *
 *   npm run verify:muse-mcp
 */
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  MAX_BATCH,
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
  handleMcpPost,
  methodNotAllowed,
  resetLocalRateLimit,
} from '../lib/mcp/http';
import { PUBLIC_RECIPES } from '../lib/public-recipes';

const ENDPOINT = 'https://recipereborn.test/api/mcp';

// Words the connector must never say about food (Muse policy + our own rule).
const BANNED = /\b(weight[- ]?loss|lose weight|slimming|fat[- ]burning|diabet\w*|cure\w*|treat(s|ment)?|disease|detox|keto|low[- ]carb|heart[- ]healthy|medical|clinically|prevents?)\b/i;
const PII = /@[a-z0-9-]+\.[a-z]|userId|email|password|\bname"\s*:\s*"(?!Recipe)/i;

let clientIp = '203.0.113.1';
const localFetch: typeof fetch = async (input, init) => {
  const req = new Request(input as RequestInfo, init);
  const headers = new Headers(req.headers);
  headers.set('x-forwarded-for', clientIp);
  const withIp = new Request(req.url, { method: req.method, headers, body: req.method === 'POST' ? await req.text() : undefined });
  if (req.method === 'POST') return handleMcpPost(withIp);
  return methodNotAllowed();
};

function textOf(result: unknown): string {
  const r = result as { content: Array<{ type: string; text?: string }> };
  return r.content.map((c) => c.text ?? '').join('\n');
}

async function rawPost(body: string, ip = '198.51.100.7') {
  return handleMcpPost(
    new Request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': ip },
      body,
    })
  );
}

async function main() {
  const client = new Client({ name: 'verify-muse-mcp', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(ENDPOINT), { fetch: localFetch }));

  // --- discovery ---
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['get_recipe', 'search_recipes', 'shopping_list_for_recipe', 'substitute_ingredient']);
  for (const t of tools) {
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} is read-only`);
    assert.equal(t.annotations?.destructiveHint, false, `${t.name} is not destructive`);
    assert.ok(t.description && t.description.length > 20, `${t.name} has a description`);
    assert.ok(!BANNED.test(`${t.description} ${JSON.stringify(t.inputSchema)}`), `${t.name} description has no health claims`);
  }
  console.log('PASS: lists 4 read-only tools with clean descriptions');

  const outputs: string[] = [];

  // --- search_recipes ---
  const search = await client.callTool({ name: 'search_recipes', arguments: { query: 'ranch dressing' } });
  const searchJson = JSON.parse(textOf(search));
  assert.equal(searchJson.results[0].id, 'rr-herby-ranch-dressing');
  assert.match(searchJson.results[0].kitchenModeUrl, /^https:\/\/recipereborn\.com\/kitchen\/rr-herby-ranch-dressing$/);
  outputs.push(textOf(search));

  const all = JSON.parse(textOf(await client.callTool({ name: 'search_recipes', arguments: { limit: 10 } })));
  assert.equal(all.count, PUBLIC_RECIPES.length);
  const vegan = JSON.parse(textOf(await client.callTool({ name: 'search_recipes', arguments: { tag: 'vegan' } })));
  assert.ok(vegan.results.length > 0 && vegan.results.every((r: { tags: string[] }) => r.tags.includes('vegan')));
  const quick = JSON.parse(textOf(await client.callTool({ name: 'search_recipes', arguments: { maxTotalMinutes: 20 } })));
  assert.ok(quick.results.every((r: { totalMinutes: number }) => r.totalMinutes <= 20));
  const none = JSON.parse(textOf(await client.callTool({ name: 'search_recipes', arguments: { query: 'zzqx unicorn' } })));
  assert.equal(none.count, 0);
  assert.ok(none.hint);
  console.log('PASS: search_recipes ranks, filters by tag/time, and handles no match');

  // --- get_recipe ---
  for (const r of PUBLIC_RECIPES) {
    const res = await client.callTool({ name: 'get_recipe', arguments: { recipeId: r.id } });
    assert.ok(!res.isError, `get_recipe ${r.id}`);
    const body = JSON.parse(textOf(res));
    assert.equal(body.steps.length, r.steps.length);
    assert.equal(body.ingredients.length, r.ingredients.length);
    outputs.push(textOf(res));
  }
  const scaled = JSON.parse(textOf(await client.callTool({ name: 'get_recipe', arguments: { recipeId: 'rr-weeknight-tomato-soup', servings: 8 } })));
  assert.equal(scaled.servings, 8);
  assert.ok(scaled.ingredients.includes('4 tbsp olive oil'), 'olive oil doubled');
  assert.ok(scaled.scalingNote);
  const missing = await client.callTool({ name: 'get_recipe', arguments: { recipeId: 'does-not-exist' } });
  assert.equal(missing.isError, true);
  console.log('PASS: get_recipe returns every catalog recipe, scales, and reports unknown ids');

  // --- shopping_list_for_recipe ---
  const list = JSON.parse(textOf(await client.callTool({ name: 'shopping_list_for_recipe', arguments: { recipeId: 'rr-buttermilk-pancakes', servings: 2 } })));
  assert.equal(list.servings, 2);
  assert.ok(list.aisles.baking.some((l: { item: string; amount: string }) => l.item === 'all-purpose flour' && l.amount === '1 cup'));
  assert.ok(list.aisles['dairy & eggs'].some((l: { item: string; amount: string }) => l.item === 'eggs' && l.amount === '1'));
  outputs.push(JSON.stringify(list));
  console.log('PASS: shopping_list_for_recipe scales and groups by aisle');

  // --- substitute_ingredient ---
  const eggs = JSON.parse(textOf(await client.callTool({ name: 'substitute_ingredient', arguments: { ingredient: '2 large eggs' } })));
  assert.equal(eggs.matched, 'egg');
  assert.ok(eggs.options.length >= 1);
  const bm = JSON.parse(textOf(await client.callTool({ name: 'substitute_ingredient', arguments: { ingredient: 'Buttermilk' } })));
  assert.equal(bm.matched, 'buttermilk');
  const unknown = JSON.parse(textOf(await client.callTool({ name: 'substitute_ingredient', arguments: { ingredient: 'saffron' } })));
  assert.equal(unknown.options.length, 0);
  outputs.push(JSON.stringify(eggs), JSON.stringify(bm));
  console.log('PASS: substitute_ingredient matches loosely and handles unknowns');

  // --- input validation ---
  const bad = await client.callTool({ name: 'get_recipe', arguments: { recipeId: '../../etc/passwd' } });
  assert.equal(bad.isError, true, 'path-like id rejected');
  const tooLong = await client.callTool({ name: 'search_recipes', arguments: { query: 'x'.repeat(500) } });
  assert.equal(tooLong.isError, true, 'overlong query rejected');
  const ctrl = await client.callTool({ name: 'substitute_ingredient', arguments: { ingredient: 'egg\u0000' } });
  assert.equal(ctrl.isError, true, 'control characters rejected');
  const badServings = await client.callTool({ name: 'get_recipe', arguments: { recipeId: 'rr-taco-seasoning', servings: 10_000 } });
  assert.equal(badServings.isError, true, 'servings capped');
  console.log('PASS: invalid inputs are rejected by schema validation');

  // --- content policy over every output ---
  for (const o of outputs) {
    assert.ok(!BANNED.test(o), `no health/medical claims in output: ${o.match(BANNED)?.[0]}`);
    assert.ok(!PII.test(o), `no personal data in output: ${o.match(PII)?.[0]}`);
    assert.ok(!/secret|api[_-]?key|DATABASE_URL|GEMINI/i.test(o), 'no secrets in output');
  }
  for (const r of PUBLIC_RECIPES) {
    assert.ok(!BANNED.test(JSON.stringify(r)), `catalog recipe ${r.id} has no health claims`);
  }
  console.log('PASS: no health claims, personal data or secrets in any output');
  await client.close();

  // --- transport hardening ---
  assert.equal(methodNotAllowed().status, 405);
  const huge = await rawPost(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(MAX_BODY_BYTES) } }));
  assert.equal(huge.status, 413);
  const notJson = await rawPost('{not json');
  assert.equal(notJson.status, 400);
  const batch = await rawPost(JSON.stringify(Array.from({ length: MAX_BATCH + 1 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' }))));
  assert.equal(batch.status, 400);
  console.log('PASS: rejects GET, oversized bodies, bad JSON and oversized batches');

  resetLocalRateLimit();
  clientIp = '192.0.2.50';
  const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  let limited: Response | null = null;
  for (let i = 0; i <= RATE_LIMIT_PER_MINUTE; i++) {
    const res = await rawPost(ping, '192.0.2.50');
    if (res.status === 429) {
      limited = res;
      break;
    }
  }
  assert.ok(limited, 'rate limit kicks in');
  assert.equal(limited!.headers.get('retry-after'), '60');
  const otherIp = await rawPost(ping, '192.0.2.51');
  assert.notEqual(otherIp.status, 429, 'other clients unaffected');
  console.log(`PASS: rate limit returns 429 after ${RATE_LIMIT_PER_MINUTE} calls/minute per IP`);

  console.log('\nAll Muse MCP checks passed.');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
