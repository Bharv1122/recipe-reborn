const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');

(async () => {
  const originalFetch = global.fetch;
  const stored = new Map(); globalThis.sessionTestStore = stored;
  try {
    const source = await esbuild.build({
      stdin: { contents: "export * from './mobile/src/services/session-recovery'; export * from './mobile/src/services/auth-storage'; export * from './mobile/src/services/api';", resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, platform: 'node', format: 'cjs', write: false,
      alias: { '@': path.resolve('mobile/src') },
      plugins: [{ name: 'native-mocks', setup(build) {
        const mocks = {
          'react-native': "export const Platform={OS:'android'};",
          'expo-constants': "export default {expoConfig:{extra:{apiBaseUrl:'https://example.invalid'}}};",
          'expo/fetch': 'export const fetch=(...args)=>globalThis.fetch(...args);',
          'expo-secure-store': 'export const WHEN_UNLOCKED_THIS_DEVICE_ONLY="locked-device-only"; export const getItemAsync=async key=>globalThis.sessionTestStore.get(key)||null; export const setItemAsync=async(key,value)=>{await globalThis.sessionTestBeforeWrite?.(key,value);globalThis.sessionTestStore.set(key,value);}; export const deleteItemAsync=async key=>globalThis.sessionTestStore.delete(key);',
        };
        for (const [name,contents] of Object.entries(mocks)) {
          build.onResolve({ filter: new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$') }, () => ({path:name,namespace:'mock'}));
          build.onLoad({ filter: /.*/, namespace:'mock' }, args=>args.path===name?{contents,loader:'js'}:null);
        }
      } }],
    });
    const m = new Module(path.resolve('scripts/session-under-test.cjs'), module); m.filename=path.resolve('scripts/session-under-test.cjs'); m.paths=module.paths; m._compile(source.outputFiles[0].text,m.filename);
    const s=m.exports;
    const tokens={accessToken:'test-access',refreshToken:'test-refresh',accessTokenExpiresIn:900,refreshTokenExpiresAt:'2026-10-01T00:00:00Z'};
    const user={id:'synthetic',email:'qa@example.com',name:'QA',allergies:['peanuts'],dislikedIngredients:[]};
    const seed=async()=>{await s.saveTokens(tokens);await s.saveCachedUser({...user,subscriptionTier:'premium',trialActive:true});};
    await seed();
    const identity=JSON.parse(stored.get('recipe-reborn.mobile-user.v1'));assert.equal(identity.subscriptionTier,undefined);assert.equal(identity.trialActive,undefined);
    global.fetch=async()=>{throw new TypeError('Synthetic network unavailable');};
    assert.deepEqual(await s.restoreStoredSession(),user);assert.deepEqual(await s.readTokens(),tokens);
    console.log('PASS: cold offline restart restores identity and retains tokens, without caching entitlement.');

    global.fetch=async url=>{if(url.endsWith('/refresh'))throw new TypeError('Synthetic refresh network error');return Response.json({error:'expired'},{status:401});};
    assert.deepEqual(await s.restoreStoredSession(),user);assert.deepEqual(await s.readTokens(),tokens);
    global.fetch=async url=>Response.json({error:'temporary'},{status:url.endsWith('/refresh')?503:401});
    assert.deepEqual(await s.restoreStoredSession(),user);assert.deepEqual(await s.readTokens(),tokens);
    console.log('PASS: refresh connection failures and temporary server failures preserve the session.');

    global.fetch=async()=>Response.json({error:'invalid session'},{status:401});
    assert.equal(await s.restoreStoredSession(),null);assert.equal(await s.readTokens(),null);assert.equal(await s.readCachedUser(),null);
    await seed();global.fetch=async()=>Response.json({error:'revoked'},{status:403});
    assert.equal(await s.restoreStoredSession(),null);assert.equal(await s.readTokens(),null);assert.equal(await s.readCachedUser(),null);
    console.log('PASS: explicit 401/403 rejection clears tokens and cached identity.');

    await s.saveTokens(tokens);global.fetch=async()=>Response.json({user});assert.deepEqual(await s.restoreStoredSession(),user);assert.deepEqual(await s.readCachedUser(),user);
    await s.clearTokens();assert.equal(await s.restoreStoredSession(),null);assert.equal(await s.readCachedUser(),null);
    await seed();stored.set('recipe-reborn.mobile-user.v1','{"id":17}');assert.equal(await s.readCachedUser(),null);
    console.log('PASS: online identity refresh, sign-out cleanup and malformed-cache handling.');

    await seed();
    let enteredRefresh, finishRefresh;
    const refreshEntered=new Promise(resolve=>{enteredRefresh=resolve;});
    const refreshResponse=new Promise(resolve=>{finishRefresh=resolve;});
    const rotated={...tokens,accessToken:'rotated-access',refreshToken:'rotated-refresh'};
    global.fetch=async(url,init)=>{
      if(url.endsWith('/refresh')){enteredRefresh();return refreshResponse;}
      return init.headers.Authorization==='Bearer rotated-access'?Response.json({user}):Response.json({error:'expired'},{status:401});
    };
    const restoring=s.restoreStoredSession();await refreshEntered;
    await s.clearTokens();finishRefresh(Response.json({tokens:rotated}));
    assert.equal(await restoring,null,'A refresh completed after sign-out must not restore the old user.');
    assert.equal(await s.readTokens(),null,'Sign-out must survive an in-flight refresh.');
    assert.equal(await s.readCachedUser(),null);
    console.log('PASS: a late token refresh cannot restore a signed-out account.');

    await seed();
    const secondUser={...user,id:'second-user',email:'second@example.com'};
    const secondTokens={...tokens,accessToken:'second-access',refreshToken:'second-refresh'};
    let rejectOldRefresh, oldRefreshEntered;
    const oldRefreshStarted=new Promise(resolve=>{oldRefreshEntered=resolve;});
    const oldRefreshResponse=new Promise(resolve=>{rejectOldRefresh=resolve;});
    global.fetch=async url=>{if(url.endsWith('/refresh')){oldRefreshEntered();return oldRefreshResponse;}return Response.json({error:'expired'},{status:401});};
    const previousAccount=s.restoreStoredSession();await oldRefreshStarted;
    await s.clearTokens();await s.saveTokens(secondTokens);await s.saveCachedUser(secondUser);
    rejectOldRefresh(Response.json({error:'revoked'},{status:401}));
    assert.equal(await previousAccount,null);assert.deepEqual(await s.readTokens(),secondTokens);assert.deepEqual(await s.readCachedUser(),secondUser);
    console.log('PASS: an old account refresh rejection cannot clear a newer signed-in account.');

    await seed();
    let returnOldIdentity;
    const oldIdentity=new Promise(resolve=>{returnOldIdentity=resolve;});
    let requestStarted;
    const identityStarted=new Promise(resolve=>{requestStarted=resolve;});
    global.fetch=async()=>{requestStarted();return oldIdentity;};
    const oldIdentityRequest=s.restoreStoredSession();await identityStarted;
    await s.clearTokens();await s.saveTokens(secondTokens);await s.saveCachedUser(secondUser);
    returnOldIdentity(Response.json({user}));
    assert.equal(await oldIdentityRequest,null);assert.deepEqual(await s.readCachedUser(),secondUser);
    console.log('PASS: a late identity response cannot overwrite a different signed-in account.');

    await seed();
    let storageEntered, finishStorage;
    const storageStarted=new Promise(resolve=>{storageEntered=resolve;});
    const storageWaiting=new Promise(resolve=>{finishStorage=resolve;});
    globalThis.sessionTestBeforeWrite=async key=>{if(key==='recipe-reborn.mobile-session.v1'){storageEntered();await storageWaiting;}};
    const writing=s.saveTokens(rotated,s.getSessionRevision());await storageStarted;
    const clearing=s.clearTokens();finishStorage();
    assert.equal(await writing,false);await clearing;
    assert.equal(await s.readTokens(),null);assert.equal(await s.readCachedUser(),null);
    console.log('PASS: sign-out serializes after an already-started SecureStore write and clears it.');
  } finally {global.fetch=originalFetch;delete globalThis.sessionTestStore;delete globalThis.sessionTestBeforeWrite;}
})().catch(error=>{console.error(error);process.exitCode=1;});
