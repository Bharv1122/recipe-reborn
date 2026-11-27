const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const Module=require('node:module');
const path=require('node:path');
(async()=>{
  process.env.GOOGLE_MOBILE_WEB_CLIENT_ID='synthetic-client';
  const mocks={
    '@/lib/db':'export const prisma=globalThis.googleRouteTest.db;',
    '@/lib/rate-limit':'export const getClientIp=()=>"synthetic",rateLimit=async()=>({success:true});',
    '@/lib/google-mobile-identity':'export const verifyGoogleMobileIdentity=async()=>({subject:"google-subject",email:"cook@example.com",name:"Cook"});',
    '@/lib/mobile-auth':'export const issueMobileTokenPair=async id=>{globalThis.googleRouteTest.issued.push(id);return {accessToken:"synthetic"};};',
    bcryptjs:'export default {compare:async password=>password==="correct-test-password"};',
  };
  const fixture={issued:[],created:0,consumed:0,existing:null,linked:null,other:null};
  const user={id:'user-1',email:'cook@example.com',password:'hash',allergies:[],dislikedIngredients:[],likedIngredients:[]};
  fixture.db={verificationToken:{deleteMany:async()=>({count:fixture.consumed++===0?1:0})},account:{findUnique:async()=>fixture.linked,findFirst:async()=>fixture.other,create:async()=>{fixture.created++;return{};}},user:{findUnique:async()=>fixture.existing,create:async()=>{fixture.created++;return user;}},$transaction:async fn=>fn(fixture.db)};
  globalThis.googleRouteTest=fixture;
  const build=await esbuild.build({entryPoints:['app/api/mobile/auth/google/route.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'auth-mocks',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
  const filename=path.resolve('scripts/google-route-test.cjs');const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(build.outputFiles[0].text,filename);
  const call=(extra={})=>mod.exports.POST(new Request('https://example.test/api/mobile/auth/google',{method:'POST',body:JSON.stringify({idToken:'synthetic',nonce:'a'.repeat(64),...extra})}));
  const reset=()=>{fixture.issued=[];fixture.created=0;fixture.consumed=0;fixture.existing=null;fixture.linked=null;fixture.other=null;};
  reset();fixture.existing=user;assert.equal((await call()).status,409);assert.equal(fixture.created,0);assert.equal(fixture.issued.length,0);
  reset();fixture.existing=user;assert.equal((await call({linkPassword:'wrong'})).status,409);assert.equal(fixture.created,0);
  reset();fixture.existing=user;assert.equal((await call({linkPassword:'correct-test-password'})).status,200);assert.equal(fixture.created,1);assert.deepEqual(fixture.issued,['user-1']);assert.equal((await call({linkPassword:'correct-test-password'})).status,401);assert.equal(fixture.created,1);
  reset();assert.equal((await call()).status,400);assert.equal(fixture.created,0);
  reset();assert.equal((await call({adultConfirmed:true})).status,200);assert.equal(fixture.created,1);
  reset();fixture.linked={user};assert.equal((await call()).status,200);assert.equal(fixture.created,0);
  reset();fixture.existing=user;fixture.other={providerAccountId:'another'};assert.equal((await call({linkPassword:'correct-test-password'})).status,409);assert.equal(fixture.created,0);
  delete globalThis.googleRouteTest;
  console.log('PASS: existing accounts require password proof; wrong password, duplicate Google link and replay blocked; new accounts require adult confirmation; linked accounts sign in without creating duplicates. Mocked database, no live user changes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
