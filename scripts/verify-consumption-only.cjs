const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const jwt = require('jsonwebtoken');
const forbidden = /revenuecat|react-native-purchases|native-subscriptions?|EXPO_BILLING_TEST|billing-test|purchase-policy/i;
let checked = 0;
function scan(target) {
  if (!fs.existsSync(target)) return;
  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) scan(path.join(target, entry));
  } else if (/\.(?:tsx?|jsx?|json|prisma|sql|md)$/.test(target)) {
    assert.doesNotMatch(fs.readFileSync(target, 'utf8'), forbidden, target);
    checked++;
  }
}
async function bundle(entry) {
  const mocks = {
    '@/lib/db': 'export const prisma={user:{async findUnique(q){global.qaBilling.ids.push(q.where.id);return global.qaBilling.user}}}',
    '@/lib/partner-offer-server': 'export async function resolvePartnerTrial(){return {offer:null,trialDays:14,fullPremium:false,trialRecipeLimit:3}}',
  };
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'synthetic-billing', setup(build) {
      build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? {path:args.path,namespace:'mock'} : null);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({contents:mocks[args.path],loader:'js'}));
    }}],
  });
  const mod = new Module(path.resolve(entry), module);
  mod.filename=path.resolve(entry); mod.paths=module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  return mod.exports;
}
async function main() {
  for (const target of ['app','lib','mobile/src','mobile/store','docs','prisma','mobile/app.config.ts','mobile/eas.json','mobile/package.json','mobile/package-lock.json','package.json']) scan(target);
  assert.equal(fs.existsSync('mobile/src/app/premium.tsx'),false);
  assert.equal(fs.existsSync('app/api/mobile/account/purchases/sync/route.ts'),false);
  const eas=JSON.parse(fs.readFileSync('mobile/eas.json','utf8'));
  assert.equal(eas.build['play-internal'].android.buildType,'app-bundle');
  const account=fs.readFileSync('mobile/src/app/(tabs)/account.tsx','utf8');
  assert.match(account,/Purchases are not available in this app/);
  assert.doesNotMatch(account,/create-checkout-session|\/pricing|\/premium|billing_portal/);
  const routes=await Promise.all(['app/api/mobile/account/subscription/route.ts','app/api/mobile/auth/me/route.ts'].map(bundle));
  const secret='synthetic-consumption-only-local-check-not-a-real-secret';
  process.env.NEXTAUTH_SECRET=secret;
  const token=jwt.sign({type:'access'},secret,{subject:'fixture-account',issuer:'recipe-reborn',audience:'recipe-reborn-mobile',expiresIn:60});
  const req=auth=>new Request('https://synthetic.invalid',{headers:auth?{authorization:auth}:{}});
  for(const route of routes) {
    global.qaBilling={ids:[],user:{id:'fixture-account',name:'Test',email:'test@example.invalid',subscriptionTier:'premium',subscriptionStatus:'active',currentPeriodEnd:null,stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_fixture',allergies:[],dislikedIngredients:[]}};
    assert.equal((await route.GET(req())).status,401);
    assert.equal((await route.GET(req('Bearer invalid'))).status,401);
    assert.equal(global.qaBilling.ids.length,0);
    const response=await route.GET(req('Bearer '+token));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal((body.subscription || body.entitlement).tier,'premium');
    assert.deepEqual(global.qaBilling.ids,['fixture-account']);
    assert.doesNotMatch(JSON.stringify(body),/revenuecat|canPurchase|nativeSubscription/i);
    global.qaBilling.user=null;
    assert.equal((await route.GET(req('Bearer '+token))).status,404);
  }
  console.log('PASS consumption-only source scan: '+checked+' files; signed native auth and Stripe account status preserved; no live service calls.');
}
const previousSecret=process.env.NEXTAUTH_SECRET,previousFetch=global.fetch;
global.fetch=async()=>{throw new Error('Network is forbidden in this test');};
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=previousFetch;if(previousSecret===undefined)delete process.env.NEXTAUTH_SECRET;else process.env.NEXTAUTH_SECRET=previousSecret;delete global.qaBilling;});
