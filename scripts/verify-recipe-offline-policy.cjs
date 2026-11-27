const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
(async () => {
  const state = { error: null, revision: 0, owner: 'alice', reads: 0, recipe: { id: 'one' } };
  globalThis.recipeOfflineTest = state;
  const mocks = {
    '@/services/api': `export class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
      export async function apiRequest(){const s=globalThis.recipeOfflineTest;if(s.changeSession)s.revision++;if(s.error)throw s.error;return {recipes:[s.recipe],recipe:s.recipe};} export const apiResponse=apiRequest;`,
    '@/services/auth-storage': `export const getSessionRevision=()=>globalThis.recipeOfflineTest.revision; export const readCachedUser=async()=>({id:globalThis.recipeOfflineTest.owner});`,
    '@/services/recipe-cache': `export const recipeCacheRevision=()=>0; export const pruneRecipeCache=async()=>{}; export const cacheRecipe=async()=>{};
      export const readCachedRecipes=async()=>{const s=globalThis.recipeOfflineTest;s.reads++;return [s.recipe];};`,
  };
  const result = await esbuild.build({entryPoints:['mobile/src/services/recipes.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'mock',setup(build){
    build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:null);
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  }}]});
  const mod = new Module(path.resolve('scripts/recipe-policy-test.cjs'),module); mod.paths=module.paths; mod._compile(result.outputFiles[0].text,mod.filename||'recipe-policy-test.cjs');
  const api = mod.exports;
  assert.equal((await api.listRecipesWithCache({})).offline,false);
  state.error = new TypeError('Network request failed');
  assert.equal((await api.getRecipeWithCache({},'one')).offline,true);
  const reads=state.reads;
  // Use the actual bundled ApiError class by loading its exported constructor through a tiny second export.
  const augmented=result.outputFiles[0].text+'\nmodule.exports.TestApiError=ApiError;';
  const testMod=new Module(path.resolve('scripts/recipe-policy-errors.cjs'),module);testMod.paths=module.paths;testMod._compile(augmented,'recipe-policy-errors.cjs');
  for(const status of [401,403,404,409,429]) {
    state.error=new testMod.exports.TestApiError('Denied',status);
    await assert.rejects(testMod.exports.getRecipeWithCache({},'one'));
  }
  assert.equal(state.reads,reads,'authorization, not-found and rate-limit errors must never read offline data');
  state.error=new testMod.exports.TestApiError('Unavailable',503);
  assert.equal((await testMod.exports.listRecipesWithCache({})).offline,true);
  state.changeSession=true; state.error=new TypeError('Offline');
  await assert.rejects(api.listRecipesWithCache({}));
  delete globalThis.recipeOfflineTest;
  console.log('PASS: network/server fallback, online path, authorization/not-found/rate-limit rejection, changed-session rejection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
