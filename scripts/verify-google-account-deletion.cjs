const assert=require('node:assert/strict'),esbuild=require('esbuild'),Module=require('node:module'),path=require('node:path');
(async()=>{
 process.env.GOOGLE_MOBILE_WEB_CLIENT_ID='synthetic';
 const f={deleted:0,linked:'owner',nonce:1,subscription:false,invalid:false};globalThis.deleteTest=f;
 f.db={user:{findUnique:async()=>({password:'hash',stripeSubscriptionId:f.subscription?'sub':null,subscriptionStatus:'active'}),delete:async()=>{f.deleted++;}},account:{findUnique:async()=>({userId:f.linked})},verificationToken:{deleteMany:async()=>({count:f.nonce--})}};
 const mocks={'@/lib/db':'export const prisma=globalThis.deleteTest.db;', '@/lib/mobile-auth':'export class MobileAuthError extends Error{};export const requireMobileUserId=()=>"owner";', '@/lib/rate-limit':'export const rateLimit=async()=>({success:true});', '@/lib/google-mobile-identity':'export const verifyGoogleMobileIdentity=async()=>{if(globalThis.deleteTest.invalid)throw Error();return {subject:"sub"}};',bcryptjs:'export default {compare:async p=>p==="correct"};'};
 const b=await esbuild.build({entryPoints:['app/api/mobile/account/delete/route.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'mocks',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
 const m=new Module(path.resolve('scripts/deletion-under-test.cjs'),module);m.paths=module.paths;m._compile(b.outputFiles[0].text,m.id);
 const call=data=>m.exports.POST(new Request('https://example.test',{method:'POST',body:JSON.stringify({confirmation:'DELETE',...data})}));
 const google={idToken:'synthetic',nonce:'a'.repeat(64)};
 assert.equal((await call({password:'wrong'})).status,403);assert.equal(f.deleted,0);
 f.linked='someone-else';assert.equal((await call(google)).status,403);assert.equal(f.deleted,0);
 f.linked='owner';f.nonce=1;f.invalid=true;assert.equal((await call(google)).status,403);assert.equal(f.deleted,0);
 f.invalid=false;f.subscription=true;assert.equal((await call(google)).status,409);assert.equal(f.deleted,0);
 f.subscription=false;f.nonce=1;assert.equal((await call(google)).status,200);assert.equal(f.deleted,1);
 assert.equal((await call(google)).status,403);assert.equal(f.deleted,1);
 assert.equal((await call({password:'correct'})).status,200);assert.equal(f.deleted,2);
 delete globalThis.deleteTest;console.log('PASS: deletion requires correct password or linked Google subject and fresh nonce; wrong subject, invalid identity, replay and active subscription blocked. Mock database only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
