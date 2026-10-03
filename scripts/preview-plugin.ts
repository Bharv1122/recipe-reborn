// Loopback-only synthetic host. Not imported by any deployed route.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { PluginOAuth, SCOPES, hash, opaque } from '../lib/plugin/oauth';
import { PluginTools, type Backend } from '../lib/plugin/tools';
import { handleMcp } from '../lib/plugin/mcp';
import type { PluginStore } from '../lib/plugin/store';

async function main() {
  const origin = 'http://127.0.0.1:4181';
  const entries = new Map<string, { value: unknown; expires: number }>();
  const store: PluginStore = {
    async get<T>(key: string) { const row = entries.get(key); return row && row.expires > Date.now() ? structuredClone(row.value) as T : null; },
    async put(key, value, seconds) { entries.set(key, { value: structuredClone(value), expires: Date.now() + seconds * 1000 }); },
    async take<T>(key: string) { const row = entries.get(key); entries.delete(key); return row && row.expires > Date.now() ? structuredClone(row.value) as T : null; },
    async remove(key) { entries.delete(key); },
    async limit(key, max, seconds) { const n = (await store.get<number>(`limit:${key}`) || 0) + 1; await store.put(`limit:${key}`, n, seconds); return n <= max; },
  };
  const recipe = { id: 'demo-lentil-soup', title: 'From-scratch lentil soup', freshIngredients: ['1 cup dry lentils', '2 carrots, chopped', '4 cups water', 'Salt to taste'], instructions: ['Rinse the lentils and chop the carrots.', 'Simmer lentils and carrots in water until tender. Season to taste.'], servings: '2', synthetic: true };
  const lists: Record<string, unknown>[] = [];
  const backend: Backend = {
    account: async () => ({ membership: 'Synthetic Premium fixture', generationCount: 0, synthetic: true }),
    search: async (_user, q) => ({ recipes: recipe.title.toLowerCase().includes(q.toLowerCase()) ? [recipe] : [], synthetic: true }),
    recipe: async (_user, id) => { if (id !== recipe.id) throw new Error('Not found'); return recipe; },
    plans: async () => ({ mealPlans: [], synthetic: true }), shopping: async () => ({ shoppingLists: lists, synthetic: true }),
    scale: async (_user, id, factor) => { if (id !== recipe.id) throw new Error('Not found'); return { ...recipe, factor, freshIngredients: recipe.freshIngredients.map(line => line.replace(/^\d+/, n => String(Number(n) * factor))), note: 'Synthetic demo. Cooking instructions stay unchanged.' }; },
    wine: async () => ({ available: false, synthetic: true }),
    execute: async (_user, action) => { if (action.kind === 'create_shopping_list') { const list = { id: `demo-list-${lists.length + 1}`, name: action.name, items: recipe.freshIngredients }; lists.push(list); return { shoppingList: list, synthetic: true }; } return { message: 'Synthetic action completed; no real AI or account was contacted.', action, synthetic: true }; },
  };
  const auth = new PluginOAuth({ origin, resource: `${origin}/api/plugin/mcp`, clients: { demo: { name: 'Local synthetic host', redirectUris: [`${origin}/callback`] } } }, store);
  const verifier = opaque();
  const consent = await auth.consent(new URLSearchParams({ response_type: 'code', client_id: 'demo', redirect_uri: `${origin}/callback`, resource: auth.config.resource, scope: SCOPES.join(' '), state: 'local-only', code_challenge_method: 'S256', code_challenge: hash(verifier) }), 'synthetic-demo-user');
  const redirect = new URL(await auth.authorize(consent.nonce, 'synthetic-demo-user', true));
  let tokens = await auth.token(new URLSearchParams({ grant_type: 'authorization_code', client_id: 'demo', redirect_uri: `${origin}/callback`, resource: auth.config.resource, code: redirect.searchParams.get('code')!, code_verifier: verifier }));
  let issued = Date.now();
  const tools = new PluginTools(store, backend), panel = readFileSync('plugins/recipe-reborn/ui/panel.html', 'utf8');
  const host = `<!doctype html><html><meta charset="utf-8"><title>Recipe Reborn plugin — local demo</title><style>body{margin:0;background:#e7eee6;font:16px system-ui}header{padding:18px;background:#173d2c;color:white}iframe{width:100%;height:850px;border:0}button{padding:10px;font:inherit}</style><header><strong>LOCAL PLUGIN DEMO · SYNTHETIC DATA ONLY</strong><p>No real account, provider, billing or production writes. This is an MCP Apps host simulator, not ChatGPT.</p><button id="prepare">Preview a shopping-list action</button></header><iframe id="panel" src="/panel"></iframe><script>const frame=document.querySelector('iframe');let serial=0;async function tool(name,args){const r=await fetch('/demo/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++serial,method:'tools/call',params:{name,arguments:args}})});return (await r.json()).result}window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;const m=e.data;if(m.jsonrpc!=='2.0'||!m.id)return;try{const result=m.method==='ui/initialize'?{protocolVersion:'2026-01-26',hostInfo:{name:'Synthetic host',version:'1'},hostCapabilities:{}}:await tool(m.params.name,m.params.arguments);frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result},location.origin)}catch{frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,error:{code:-32603,message:'Demo error'}},location.origin)}});document.querySelector('#prepare').onclick=async()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:await tool('prepare_action',{action:{kind:'create_shopping_list',recipeIds:['demo-lentil-soup'],name:'Soup ingredients'}})},location.origin);</script></html>`;
  createServer(async (req, res) => {
    try {
      if (req.headers.host !== '127.0.0.1:4181' || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403).end(); return; }
      if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end(host); return; }
      if (req.method === 'GET' && req.url === '/panel') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end(panel); return; }
      if (req.method !== 'POST' || req.url !== '/demo/call' || req.headers.origin !== origin) { res.writeHead(404).end(); return; }
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 131072) { res.writeHead(413).end(); return; } }
      if (Date.now() - issued > 800000) { tokens = await auth.token(new URLSearchParams({ grant_type: 'refresh_token', client_id: 'demo', resource: auth.config.resource, refresh_token: tokens.refresh_token })); issued = Date.now(); }
      const response = await handleMcp(new Request(auth.config.resource, { method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' }, body }), auth, tools, panel);
      res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
    } catch { res.writeHead(500).end('Local demo error'); }
  }).listen(4181, '127.0.0.1', () => console.log(`Synthetic Recipe Reborn plugin demo: ${origin}`));
}
main().catch(() => { console.error('Could not start local plugin demo'); process.exitCode = 1; });
