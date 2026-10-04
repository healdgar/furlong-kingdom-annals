#!/usr/bin/env node
// Storage outcome persistence, sequence and failure checks in native Metal Chrome.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT=path.resolve(process.argv[2]||'tools/soak-results/storage-history');
fs.mkdirSync(OUT,{recursive:true});
const source=fs.readFileSync(ROOT+'/index.html');fs.writeFileSync(OUT+'/index.snapshot.html',source);
const PAGE=pathToFileURL(OUT+'/index.snapshot.html').href;
class CDP{ // the least of the DevTools protocol: send a command, await its answer, listen for events
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();
    this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=e=>rej(new Error('websocket: '+(e.message||'failed')));});
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(new Error('Chrome connection closed'));this.wait.clear();};
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.wait.has(m.id)){const w=this.wait.get(m.id);this.wait.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result);}
      else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.wait.set(id,{res,rej}));}
  on(method,f){if(!this.subs.has(method))this.subs.set(method,[]);this.subs.get(method).push(f);}
  close(){try{this.ws.close();}catch{}}}
async function ev(c,expr){const r=await c.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);return r.result.value;}
const active=new Set();
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const kill of active)kill();process.exit(sig==='SIGINT'?130:143);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function launch(){ // a headless Chrome of its own, with a throwaway profile
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-chrome-'));
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--enable-gpu','--ignore-gpu-blocklist']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const kill=()=>{active.delete(kill);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(kill);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);
    p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',c=>{clearTimeout(t);rej(new Error('Chrome exited '+c));});p.on('error',e=>{clearTimeout(t);rej(e);});});
  const port=new URL(ws).port,list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(),pg=list.find(t=>t.type==='page');
  const c=new CDP(pg.webSocketDebuggerUrl);await c.open;
  const cleanup=()=>{c.close();kill();};return {c,kill:cleanup};
  }catch(e){kill();throw e;}}

const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),checks:{}};
const {c,kill}=await launch(),errors=[];
try{
  await c.send('Page.enable');await c.send('Runtime.enable');
  c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;window.setInterval=()=>0;'});
  await c.send('Page.navigate',{url:PAGE+'#s=1001&f=1001&c=sea&y=850'});
  const start=Date.now();while(!await ev(c,"typeof W!=='undefined'&&!!W&&!document.getElementById('loading')").catch(()=>false)){if(errors.length)throw Error(errors.join('\n'));if(Date.now()-start>180000)throw Error('Boot timeout');await sleep(100);}
  await ev(c,'setSpeed(0);STORAGE_OUTCOMES.flush()');
  result.gpu=await ev(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);})()");
  assert.ok(!/SwiftShader|llvmpipe|Software/i.test(result.gpu));
  result.checks.roundTrip=await ev(c,`(async()=>{
    const J=STORAGE_OUTCOMES.journal,start=J.seq;
    for(let n=0;n<3000;n++)storageOutcome({kind:'journal-fixture',n,day:day(),values:[undefined,-0,Infinity,NaN,123n,,n],text:'persistent outcome '+n});
    await STORAGE_OUTCOMES.flush();let count=0,exact=true;
    for await(const {seq,event:e} of STORAGE_OUTCOMES.records())if(seq>=start){exact&&=e.n===count&&Object.hasOwn(e.values,0)&&e.values[0]===undefined&&Object.is(e.values[1],-0)&&e.values[2]===Infinity&&Number.isNaN(e.values[3])&&e.values[4]===123n&&!(5 in e.values);count++;}
    const old=await STORAGE_OUTCOMES.open(STORAGE_OUTCOMES.meta.id);let persisted=0;for await(const _ of old.records())persisted++;
    const chunks=await new Promise((resolve,reject)=>{const r=STORAGE_OUTCOMES.db.transaction('chunks').objectStore('chunks').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return {exact,count,persisted,expected:J.seq,status:J.status(),compressed:chunks.every(c=>c.blob instanceof Blob&&c.blob.size>0),chunks:chunks.length};
  })()`);
  assert.equal(result.checks.roundTrip.count,3000);assert.equal(result.checks.roundTrip.exact,true);assert.equal(result.checks.roundTrip.persisted,result.checks.roundTrip.expected);assert.equal(result.checks.roundTrip.status.pendingBytes,0);assert.equal(result.checks.roundTrip.compressed,true);
  result.checks.pinnedExport=await ev(c,`(async()=>{const end=STORAGE_OUTCOMES.journal.seq-1,stream=STORAGE_OUTCOMES.stream();storageOutcome({kind:'later-fixture'});const lines=(await new Response(stream).text()).trimEnd().split('\\n').map(outcomeParse),head=lines.shift();return {end,declared:head.endSeq,count:lines.length,last:lines.at(-1).seq,laterPresent:lines.some(r=>r.event.kind==='later-fixture')};})()`);
  assert.equal(result.checks.pinnedExport.declared,result.checks.pinnedExport.end);assert.equal(result.checks.pinnedExport.last,result.checks.pinnedExport.end);assert.equal(result.checks.pinnedExport.count,result.checks.pinnedExport.end+1);assert.equal(result.checks.pinnedExport.laterPresent,false);
  result.checks.reopen=await ev(c,`(async()=>{await STORAGE_OUTCOMES.flush();const id=STORAGE_OUTCOMES.meta.id;STORAGE_OUTCOMES.db.close();STORAGE_OUTCOMES.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('furlong-storage-outcomes',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const old=await STORAGE_OUTCOMES.open(id);let count=0;for await(const _ of old.records())count++;return {count,expected:STORAGE_OUTCOMES.journal.seq,listed:(await STORAGE_OUTCOMES.saved()).some(m=>m.id===id)};})()`);
  assert.equal(result.checks.reopen.count,result.checks.reopen.expected);assert.equal(result.checks.reopen.listed,true);
  result.checks.corruption=await ev(c,`(async()=>{const D=STORAGE_OUTCOMES,key=[D.meta.id,1],original=await new Promise((resolve,reject)=>{const r=D.db.transaction('chunks').objectStore('chunks').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),put=x=>new Promise((resolve,reject)=>{const t=D.db.transaction('chunks','readwrite');t.objectStore('chunks').put(x,key);t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error);});let checksum=false,gap=false;
    try{const blob=await new Response(new Blob(['corrupt']).stream().pipeThrough(new CompressionStream('gzip'))).blob();await put({...original,blob});try{for await(const _ of D.records()){} }catch(e){checksum=/checksum/.test(e.message);}await put({...original,previous:'wrong predecessor'});try{for await(const _ of D.records()){} }catch(e){gap=/gap/.test(e.message);}}finally{await put(original);}return {checksum,gap};})()`);
  assert.deepEqual(result.checks.corruption,{checksum:true,gap:true});
  result.checks.backpressure=await ev(c,`(async()=>{await STORAGE_OUTCOMES.flush();const J=STORAGE_OUTCOMES.journal,write=J.write,limit=J.maxPendingBytes,chunk=J.chunkBytes;let release;J.write=async entry=>{await new Promise(r=>release=r);return write(entry);};J.maxPendingBytes=1;J.chunkBytes=1;const before=day();storageOutcome({kind:'blocked-fixture'});await Promise.resolve();const blocked=simTick()===false&&day()===before,retained=J.pending.size>0;release();await STORAGE_OUTCOMES.flush();J.write=write;J.maxPendingBytes=limit;J.chunkBytes=chunk;return {blocked,retained,ready:J.ready,pending:J.bytes};})()`);
  assert.deepEqual(result.checks.backpressure,{blocked:true,retained:true,ready:true,pending:0});
  result.checks.modelFault=await ev(c,`(async()=>{const D=STORAGE_OUTCOMES,before=day();storageModelFault(new Error('Injected invariant failure'));const blocked=simTick()===false&&day()===before;let mutationBlocked=false,waitRejected=false;try{storageOutcomeAssert();}catch{mutationBlocked=true;}try{await D.wait();}catch{waitRejected=true;}await D.flush();let logged=false;for await(const r of D.records())if(r.event.kind==='storage-model-fault')logged=r.event.message==='Injected invariant failure';return {blocked,mutationBlocked,waitRejected,logged,visible:document.getElementById('storagefault')?.getAttribute('role')==='alert',id:D.meta.id,count:D.journal.seq};})()`);
  for(const k of ['blocked','mutationBlocked','waitRejected','logged','visible'])assert.equal(result.checks.modelFault[k],true);
  await c.send('Page.reload',{ignoreCache:true});
  const reloadStart=Date.now();while(!await ev(c,`typeof W!=='undefined'&&!!W&&!document.getElementById('loading')&&STORAGE_OUTCOMES.meta.id!==${JSON.stringify(result.checks.modelFault.id)}`).catch(()=>false)){if(errors.length)throw Error(errors.join('\n'));if(Date.now()-reloadStart>180000)throw Error('Reload timeout');await sleep(100);}
  result.checks.navigationRecovery=await ev(c,`(async()=>{const old=await STORAGE_OUTCOMES.open(${JSON.stringify(result.checks.modelFault.id)});let count=0,faultLogged=false;for await(const r of old.records()){count++;if(r.event.kind==='storage-model-fault')faultLogged=true;}return {count,faultLogged,newSession:STORAGE_OUTCOMES.meta.id!==old.meta.id,modelFaultCleared:STORAGE_OUTCOMES.modelFault===null};})()`);
  assert.equal(result.checks.navigationRecovery.count,result.checks.modelFault.count);for(const k of ['faultLogged','newSession','modelFaultCleared'])assert.equal(result.checks.navigationRecovery[k],true);
  result.checks.failure=await ev(c,`(async()=>{const J=STORAGE_OUTCOMES.journal;J.write=async()=>{throw new DOMException('Injected quota failure','QuotaExceededError');};J.chunkBytes=1;const start=J.seq,before=day();storageOutcome({kind:'rescue-fixture',before:1,after:0});let rejected=false;try{await STORAGE_OUTCOMES.flush();}catch{rejected=true;}const blocked=simTick()===false&&day()===before;let mutationBlocked=false;try{storageOutcomeAssert();}catch{mutationBlocked=true;}let tail=false,count=0;for await(const r of STORAGE_OUTCOMES.records()){count++;if(r.seq===start)tail=r.event.kind==='rescue-fixture'&&r.event.after===0;}return {rejected,blocked,mutationBlocked,tail,count,expected:start+1,pending:J.pending.size,status:J.status()};})()`);
  for(const k of ['rejected','blocked','mutationBlocked','tail'])assert.equal(result.checks.failure[k],true);
  assert.equal(result.checks.failure.count,result.checks.failure.expected);assert.ok(result.checks.failure.pending>0);
  assert.deepEqual(errors,[]);result.passed=true;
}catch(e){result.passed=false;result.error=e.stack;result.errors=errors;process.exitCode=1;}
finally{kill();fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
