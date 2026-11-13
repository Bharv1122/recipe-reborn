const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const row = { id: 'collection', name: 'Soup', description: 'Shared recipes', viewCount: 0, userId: 'private-owner', shareToken: 'share', isPublic: true, createdAt: 'private-date',
  user: { name: 'Display name', email: 'private@example.com' },
  collectionRecipes: [{ id: 'private-join', collectionId: 'collection', recipeId: 'recipe', addedAt: 'private-date', recipe: { id: 'recipe', title: 'Soup', freshIngredients: '["water"]', instructions: '["Boil"]', dietaryTags: [], notes: 'private note', userId: 'private-owner', prepTime: '', cookTime: '', servings: '1', rating: 4 } }],
};
let publicLink = true, writes = 0;
function project(value, select) {
  if (Array.isArray(value)) return value.map(item => project(item, select));
  return Object.fromEntries(Object.entries(select).map(([key, rule]) => [key, rule === true ? value[key] : project(value[key], rule.select)]));
}
global.__publicCollectionDb = { collection: {
  findFirst: async query => { assert.equal(query.where.isPublic, true); assert.equal(query.where.shareToken, 'share'); assert(query.select); return publicLink ? project(row, query.select) : null; },
  update: async () => { writes++; },
} };
(async () => {
  const result = await build({ entryPoints: ['app/api/collections/public/[shareToken]/route.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'isolated', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(db|rate-limit)$/ }, ({ path }) => ({ path, namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: path.endsWith('/db') ? 'export const prisma=global.__publicCollectionDb;' : 'export const getClientIp=()=>"test"; export const rateLimit=async()=>({success:true});', loader: 'js' }));
  } }] });
  const mod = new Module(path.resolve('collection-security-test.cjs'), module); mod.filename = path.resolve('collection-security-test.cjs'); mod.paths = module.paths; mod._compile(result.outputFiles[0].text, mod.filename);
  const get = () => mod.exports.GET(new Request('https://example.invalid/share'), { params: Promise.resolve({ shareToken: 'share' }) });
  const response = await get(); assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.name, 'Soup'); assert.equal(data.user.name, 'Display name'); assert.equal(data.collectionRecipes[0].recipe.title, 'Soup');
  assert.doesNotMatch(JSON.stringify(data), /private|userId|collectionId|recipeId|shareToken|addedAt|createdAt|notes|email/);
  publicLink = false; assert.equal((await get()).status, 404); assert.equal(writes, 1);
  delete global.__publicCollectionDb;
  console.log('PASS public collection display fields retained; owner, private notes, email and join metadata excluded; non-public links rejected.');
})().catch(error => { console.error(error); process.exitCode = 1; });
