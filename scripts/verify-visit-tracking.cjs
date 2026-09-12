const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');

(async () => {
  const build = await esbuild.build({entryPoints:['lib/visit-tracking.ts'],bundle:true,platform:'node',format:'cjs',write:false});
  const compiled = new Module('visit-tracking-test');
  compiled._compile(build.outputFiles[0].text, 'visit-tracking-test.cjs');
  const {recordVisit} = compiled.exports;
  const now = Date.parse('2026-09-12T12:00:00Z');
  const day = 86400000;
  function store(initial) { let value=initial; return {getItem:()=>value,setItem:(_,next)=>{value=next;}}; }
  for (const initial of [null,'',' ','NaN','Infinity','0','-1',String(now+day)]) {
    const storage=store(initial);
    assert.equal(recordVisit(storage,now),false,`Must not count ${JSON.stringify(initial)} as a return`);
    assert.equal(storage.getItem(),String(now));
  }
  assert.equal(recordVisit(store(String(now-day+1)),now),false);
  const returning=store(String(now-day));
  assert.equal(recordVisit(returning,now),true);
  assert.equal(recordVisit(returning,now),false,'A second effect or reload must not double-count');
  assert.equal(recordVisit({getItem(){throw new Error('Blocked');},setItem(){}},now),false);
  assert.equal(recordVisit({getItem(){return String(now-day);},setItem(){throw new Error('Blocked');}},now),false);
  console.log('PASS: first visits, corrupt/future timestamps, repeat mounts, 24-hour boundary, and unavailable storage. No live analytics events sent.');
})().catch(error=>{console.error(error);process.exitCode=1;});
