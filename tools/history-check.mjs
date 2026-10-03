#!/usr/bin/env node
// Actual-history archive checks in native, hardware-GPU-backed Chrome. No seed replay.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT=path.resolve(process.argv[2]||'tools/soak-results/history');
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

// Independent descriptor-based graph oracle: does not call HistoryGraph or getters.
// Function/ accessor code is compared as inert metadata; graphics as projection handles.
const ORACLE=`root=>{const seen=new Map(),pending=[],nodes=[];
 const walk=v=>{
  if(v===undefined)return ['undefined'];if(typeof v==='number'&&(Object.is(v,-0)||!Number.isFinite(v)))return ['number',Object.is(v,-0)?'-0':String(v)];if(typeof v==='bigint')return ['bigint',String(v)];
  if(typeof v==='function')return ['function',Function.prototype.toString.call(v),typeof v.state==='function'?v.state():null];
  if(v?.historyBehavior)return ['function',v.source,v.state];if(v?.historyProjection)return ['projection',v.type];
  if(v?.isObject3D||v?.isMaterial||v?.isTexture||v?.isBufferGeometry||v?.nodeType)return ['projection',v.constructor.name];
  if(v===null||typeof v!=='object')return v;if(!seen.has(v)){seen.set(v,pending.length);pending.push(v);}return ['ref',seen.get(v)];};
 const props=v=>Reflect.ownKeys(v).map(k=>{const d=Object.getOwnPropertyDescriptor(v,k);let flags=(d.enumerable?1:0)|(d.configurable?2:0)|(d.writable?4:0),x;
  if(d.value?.historyAccessor){x=['accessor',walk(d.value.get),walk(d.value.set)];flags&=3;}
  else x='value'in d?walk(d.value):['accessor',walk(d.get),walk(d.set)];return [k,flags,x];});
 const r=walk(root);for(let i=0;i<pending.length;i++){const v=pending[i];
  if(v instanceof ArrayBuffer)nodes[i]=['buffer',Array.from(new Uint8Array(v))];
  else if(ArrayBuffer.isView(v))nodes[i]=['view',v.constructor.name,walk(v.buffer),v.byteOffset,v instanceof DataView?v.byteLength:v.length];
  else if(v instanceof Map)nodes[i]=['map',[...Map.prototype.entries.call(v)].map(([k,x])=>[walk(k),walk(x)]),props(v)];
  else if(v instanceof Set)nodes[i]=['set',[...v].map(walk),props(v)];
  else if(v instanceof RegExp)nodes[i]=['regexp',v.source,v.flags,props(v)];else if(v instanceof Date)nodes[i]=['date',walk(v.getTime()),props(v)];
  else nodes[i]=[Array.isArray(v)?'array':'object',props(v)];}return JSON.stringify({r,nodes});}`;
const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),worlds:[]};
const timing=process.argv.includes('--timing');
async function ready(c){const start=Date.now();while(!await ev(c,"typeof W!=='undefined'&&!!W&&!document.getElementById('loading')").catch(()=>false)){if(Date.now()-start>120000)throw Error('boot timeout');await sleep(100);}}
for(const [seed,coast] of [[1001,'sea'],[2002,'land']]){
 const {c,kill}=await launch(),errors=[];try{
  await c.send('Page.enable');await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;window.setInterval=()=>0;'});
  await c.send('Page.navigate',{url:PAGE+`#s=${seed}&f=${seed}&c=${coast}&history=full`});await ready(c);
  const gpu=await ev(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()");assert.ok(!/SwiftShader|llvmpipe|Software Rasterizer/i.test(gpu));
  await ev(c,`window.__oracle=${ORACLE};window.__expected=[];window.__saveExpected=async()=>{const text=__oracle(HISTORY.roots()),b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));__expected.push({seq:HISTORY.seq-1,day:day(),sha:[...new Uint8Array(b)].join(',')});};`);
  await ev(c,"setSpeed(0);HISTORY.capture('test-pause');__saveExpected()");
  if(timing)await ev(c,"(async()=>{HISTORY.flush();await HISTORY.store.chain;HISTORY.stats={captureMs:0,captures:0,workMs:0};HISTORY.store.stats={serializeMs:0,compressMs:0,commitMs:0,commits:0,bytes:0};})()");
  const timings=[];
  for(let d=0;d<12;d++){
   timings.push(await ev(c,'(()=>{const t=performance.now();simTick();return performance.now()-t})()'));
   // Flush deferred tracks and fences; archive the state after those callbacks too.
   await ev(c,"new Promise(r=>setTimeout(r,0))");
   if(timing)await ev(c,"(async()=>{HISTORY.flush();await HISTORY.store.chain;})()");else await ev(c,'__saveExpected()');
  }
  await ev(c,"setSovereign(true,0);runCmd('pause-toggle');applySetting('tax',9);__saveExpected()");
  const lifeCheck=await ev(c,"(async()=>{const s=W.settlements.find(s=>s.folk?.length),p=s.folk[0],before=p.ev?.length||0;W.prehistory=true;for(let i=0;i<150;i++)life(p,'Retained history event '+i);simTick();W.prehistory=false;showInspect({type:'person',p,s});HISTORY.capture('life-and-prehistory-test');await __saveExpected();const text=document.getElementById('insp').textContent;return {retained:p.ev.length>=before+150,first:text.includes('Retained history event 0'),last:text.includes('Retained history event 149')};})()");
  assert.deepEqual(lifeCheck,{retained:true,first:true,last:true});
  const verification=await ev(c,`(async()=>{const archive=await FURLONG_HISTORY.export(),reader=FURLONG_HISTORY.open(JSON.parse(JSON.stringify(archive))),failures=[];
   for(const e of [...__expected,...__expected.slice().reverse()]){const text=__oracle(reader.seek(e.seq)),b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)),sha=[...new Uint8Array(b)].join(',');if(sha!==e.sha)failures.push({seq:e.seq,day:e.day});}
   window.__archive=archive;return {status:HISTORY.status(),failures,steps:archive.steps.length,bytes:JSON.stringify(archive).length,events:archive.steps.reduce((n,s)=>n+s.events.length,0)};})()`);
  const render=await ev(c,"(()=>{renderer.render(scene,camera);return renderer.info.render.calls})()");assert.ok(render>0);
  // Storage failure must pause before another day and retain the uncommitted
  // tail for download, not quietly discard it when IndexedDB runs out of room.
  const failureCheck=await ev(c,"(async()=>{HISTORY.store.write=()=>Promise.reject(Error('injected quota failure'));HISTORY.event('test',{text:'retain me'});HISTORY.capture('quota-test');HISTORY.flush();await HISTORY.store.chain.catch(()=>{});const before=day();let blocked=false;try{simTick()}catch{blocked=true}const rescued=await FURLONG_HISTORY.export();return {paused:speedIdx===0,blocked,sameDay:before===day(),tail:rescued.steps.at(-1).events.some(e=>e.text==='retain me')};})()");
  assert.deepEqual(failureCheck,{paused:true,blocked:true,sameDay:true,tail:true});
  const w={seed,coast,gpu,timings,...verification,lifeCheck,failureCheck,errors};result.worlds.push(w);fs.writeFileSync(OUT+`/${seed}-${coast}.json`,JSON.stringify(w,null,2));console.log(JSON.stringify(w));
  assert.equal(verification.status.fault,null);assert.equal(verification.failures.length,0,'independent live/archive state differs');assert.equal(errors.length,0);
 }catch(e){const diagnostic=await ev(c,"({status:HISTORY.status(),nodes:HISTORY.graph.state.size,batch:HISTORY.batch.map(s=>({kind:s.kind,day:s.day,bytes:JSON.stringify(s).length,changes:s.changes.length})),buffers:[...HISTORY.graph.state.values()].map(j=>JSON.parse(j)).filter(n=>n[0]==='buffer').map(n=>n[1].length).sort((a,b)=>b-a).slice(0,20)})").catch(()=>null);fs.writeFileSync(OUT+'/failure.json',JSON.stringify({error:String(e),diagnostic},null,2));console.log(JSON.stringify(diagnostic));throw e;}finally{kill();}
}
fs.writeFileSync(OUT+'/result.json',JSON.stringify(result,null,2));console.log('History archive forward/reverse checks passed');
