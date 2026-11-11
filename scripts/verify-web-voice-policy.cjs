const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules, extra={}) {
 const context={exports:{},require:name=>{if(!(name in modules))throw Error('Unexpected import '+name);return modules[name]},URL,Request,Response,FormData,Blob,Uint8Array,Buffer,AbortController,setTimeout,clearTimeout,console,...extra};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports;
}
class NextResponse extends Response {static json(data,init){return new NextResponse(JSON.stringify(data),init)} static next(){return new NextResponse(null)} static redirect(url){return new NextResponse(null,{status:307,headers:{location:String(url)}})}}
(async()=>{
 let signedIn=false;
 const proxy=load('proxy.ts',{'next/server':{NextResponse},'next-auth/jwt':{getToken:async()=>signedIn?{sub:'test'}:null}},{process:{env:{NEXTAUTH_SECRET:'test-only'}}}).proxy;
 for(const path of ['/','/generator','/api/transcribe-audio']){
  const req={nextUrl:new URL('https://example.invalid'+path),url:'https://example.invalid'+path};
  const res=await proxy(req);
  assert.equal(res.headers.get('permissions-policy'),'camera=(), microphone=(self), geolocation=()');
  assert.equal(res.headers.get('x-frame-options'),'DENY');
  assert.equal(res.status,path==='/generator'?307:200);
 }
 signedIn=true;
 assert.equal((await proxy({nextUrl:new URL('https://example.invalid/generator'),url:'https://example.invalid/generator'})).status,200);
 let userId='test',allowed=true,hasKey=true,providerCalls=0,formatSeen='',provider=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'two eggs and rice'}]}}]});
 class BackupInputError extends Error{}
 const route=load('app/api/transcribe-audio/route.ts',{
  '@/lib/request-auth':{getRequestUserId:async()=>userId},
  '@/lib/rate-limit':{rateLimit:async()=>({success:allowed})},
  'next/server':{NextResponse},
  '@/lib/ai-provider':{hasRecipeAIKey:()=>hasKey,BackupInputError},
  '@/lib/audio-transcription':{transcribeAudio:async(audio,format)=>{providerCalls++;formatSeen=format;return provider()}},
 }).POST;
 const req=(blob)=>{const f=new FormData();if(blob!==undefined)f.append('audio',blob,'test.m4a');return new Request('https://example.invalid/api/transcribe-audio',{method:'POST',body:f})};
 userId=null;assert.equal((await route(req())).status,401);userId='test';
 allowed=false;assert.equal((await route(req())).status,429);allowed=true;
 hasKey=false;assert.equal((await route(req())).status,500);hasKey=true;
 assert.equal((await route(req())).status,400);
 assert.equal((await route(req(new Blob([])))).status,400);
 assert.equal((await route(req(new Blob([new Uint8Array(4*1024*1024+1)])))).status,413);
 assert.equal(providerCalls,0);
 const mp4=new Blob([new Uint8Array([0,0,0,20,102,116,121,112,77,52,65,32])],{type:'audio/webm'});
 let res=await route(req(mp4));assert.equal(res.status,200);assert.equal((await res.json()).text,'two eggs and rice');assert.equal(formatSeen,'mp4');
 provider=()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:''}]}}]});assert.equal((await (await route(req(mp4))).json()).text,'');
 provider=()=>new Response('PRIVATE PROVIDER BODY',{status:503});res=await route(req(mp4));assert.equal(res.status,502);assert.ok(!(await res.text()).includes('PRIVATE'));
 provider=()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]});assert.equal((await route(req(mp4))).status,502);
 provider=()=>Response.json({promptFeedback:{blockReason:'SAFETY'}});assert.equal((await route(req(mp4))).status,502);
 console.log('PASS web voice: same-origin microphone policy, protected-route auth, rate limit, missing key/audio, empty/oversize rejection, true MP4 detection, transcript/silence, provider failure/truncation/block handling.');
})().catch(e=>{console.error(e);process.exitCode=1});

