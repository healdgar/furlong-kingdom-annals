#!/usr/bin/env node
// Local, serial baseline/candidate histories and CPU timings in hardware-GPU-backed Chrome.
// node tools/performance-check.mjs --baseline main --seeds 1001:sea,2002:land --years 10 --out /tmp/furlong-performance
// --variants baseline,candidate,off also compares the worker-disabled synchronous fallback (worker=off: the ROUTING worker only).
// Drives the main-thread reference simulation (foreground=1); the simulation worker itself is not timed here.
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
const OUT=path.resolve(args.out||path.join(os.tmpdir(),'furlong-performance-'+Date.now())),shortDays=args.days===undefined?null:Number(args.days),years=Number(args.years??(shortDays===null?10:0)),era=Number(args.era??850),bootTimeout=Number(args['boot-timeout']??120)*1000;
const worlds=String(args.seeds||'1001:sea,2002:land').split(',').map(v=>{const[s,coast]=v.split(':');return{seed:Number(s),coast};});
const variants=String(args.variants||'baseline,candidate').split(',');
if((shortDays!==null&&(!Number.isInteger(shortDays)||shortDays<1||shortDays%1!==0||args.years!==undefined))||!Number.isInteger(years)||years<0||!Number.isInteger(era)||era<850||era>1500||!Number.isFinite(bootTimeout)||bootTimeout<1000||worlds.some(w=>!Number.isInteger(w.seed)||!['sea','land'].includes(w.coast))||variants.some(v=>!['baseline','candidate','off'].includes(v)))throw new Error('invalid days/years, era, timeout, seed:coast or variants');
if(fs.existsSync(OUT))throw new Error('choose a fresh evidence directory');fs.mkdirSync(OUT,{recursive:true});
const sources={baseline:execFileSync('git',['show',(args.baseline||'main')+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:20e6}),candidate:fs.readFileSync(args.source||path.join(ROOT,'index.html'),'utf8')};
const hash=s=>createHash('sha256').update(s).digest('hex');for(const[k,s]of Object.entries(sources))fs.writeFileSync(path.join(OUT,k+'.html'),s);
const run={sourceSHA256:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,hash(s)])),harnessSHA256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),args,schema:args.commodity?'commodity-v3':'runtime-detected',startedUTC:new Date().toISOString(),node:process.version};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',sleep=ms=>new Promise(r=>setTimeout(r,ms)),active=new Set();
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const stop of active)stop();process.exit(sig==='SIGINT'?130:143);});
class CDP{
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.listeners=new Map();this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=rej;});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=this.wait.get(m.id);if(p){this.wait.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else for(const f of this.listeners.get(m.method)||[])f(m.params);};
    this.ws.onclose=()=>{for(const p of this.wait.values())p.reject(new Error('Chrome closed'));this.wait.clear();};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.wait.set(id,{resolve,reject}));}
  on(method,f){if(!this.listeners.has(method))this.listeners.set(method,[]);this.listeners.get(method).push(f);}
}
async function evaluate(c,expression){const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function launch(){const profile=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-performance-'));
  const proc=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(process.platform==='darwin'?['--use-angle=metal']:[]),'--enable-gpu','--ignore-gpu-blocklist','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  let c;const stop=()=>{active.delete(stop);c?.ws.close();proc.kill('SIGKILL');fs.rmSync(profile,{recursive:true,force:true});};active.add(stop);
  try{const ws=await new Promise((res,rej)=>{let buf='';const timer=setTimeout(()=>rej(new Error('Chrome startup timeout')),30000);proc.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(timer);res(m[1]);}});proc.on('error',rej);proc.on('exit',code=>{clearTimeout(timer);rej(new Error('Chrome exited '+code));});});
    const list=await(await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json();c=new CDP(list.find(t=>t.type==='page').webSocketDebuggerUrl);await c.open;return{c,stop};
  }catch(e){stop();throw e;}}

// Canonical graph encoding retains Map/Set and array order, reference identity, numeric precision,
// genomes, parish records, ownership, food, coin, terrain, and land. Only derived caches/graphics
// are excluded. DOM/UI intervals are suppressed equally; deferred simulation work is still flushed.
const SERIALIZE=`(()=>{const seen=new Map(),pending=[],nodes=[],omit=new Set(${JSON.stringify(['_pm','_folkIndex','_folkRevision','_householdsV','_popTotal','_popValid','routes',...(args['ignore-life-ledger']?['ev','historyCells']:[])])});
  const walk=v=>{if(v===undefined)return['undefined'];if(typeof v==='function')return['function'];if(typeof v==='number'&&!Number.isFinite(v))return['number',String(v)];if(v===null||typeof v!=='object')return v;
    if(v.isObject3D||v.isMaterial||v.isTexture||v.isBufferGeometry||v.nodeType)return['graphic'];if(!seen.has(v)){seen.set(v,pending.length);pending.push(v);}return['ref',seen.get(v)];};
  const LAND=W.land||G.land,root=walk({world:W,land:{F:LAND.F,mask:LAND.mask,flood:LAND.flood,perHead:LAND.perHead},annals:allLines,journal:JOURNAL,mod:MOD,personID:PID,notableID:NID});
  for(let i=0;i<pending.length;i++){const v=pending[i];if(ArrayBuffer.isView(v))nodes[i]=['typed',v.constructor.name,Array.from(v)];else if(v instanceof Map)nodes[i]=['map',[...v].map(([k,x])=>[walk(k),walk(x)])];else if(v instanceof Set)nodes[i]=['set',[...v].map(walk)];
    else if(Array.isArray(v))nodes[i]=['array',v.map(walk)];else nodes[i]=['object',Object.keys(v).filter(k=>!omit.has(k)&&typeof v[k]!=='function').sort().map(k=>[k,walk(v[k])])];}
  return JSON.stringify({root,nodes});})()`;
const FINGERPRINT=`(async()=>{const s=${SERIALIZE},buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return{sha256:[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join(''),bytes:s.length};})()`;
const YEAR=`(async()=>{let tickMs=0;const start=performance.now();for(let i=0;i<360;i++){const t=performance.now();if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;continue;}tickMs+=performance.now()-t;if(day()%30===15||day()%360===0)await new Promise(r=>setTimeout(r,0));}
  return {day:day(),AD:AD(),tickMsDay:tickMs/360,elapsedMsDay:(performance.now()-start)/360,places:W.settlements.length,pop:W.settlements.reduce((n,s)=>n+s.pop,0),errors:errN,worker:typeof ROUTING==='undefined'?null:{...ROUTING.stats,busy:ROUTING.busy,disabled:ROUTING.disabled}};})()`;
const SHORT_RUN=shortDays===null?null:`(async()=>{let tickMs=0;const start=performance.now();for(let i=0;i<${shortDays};i++){const t=performance.now();if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;continue;}tickMs+=performance.now()-t;if(day()%15===0)await new Promise(r=>setTimeout(r,0));}
  return {day:day(),AD:AD(),tickMsDay:tickMs/${shortDays},elapsedMsDay:(performance.now()-start)/${shortDays},places:W.settlements.length,pop:W.settlements.reduce((n,s)=>n+s.pop,0),errors:errN,worker:typeof ROUTING==='undefined'?null:{...ROUTING.stats,busy:ROUTING.busy,disabled:ROUTING.disabled}};})()`;
async function check(variant,w){const{c,stop}=await launch(),id=`${variant}-${w.seed}-${w.coast}`,errors=[],result={id,variant,...w,annual:[]};
  try{await c.send('Page.enable');await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));c.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e.args.map(a=>a.description||a.value).join(' '));});
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.FURLONG_COMMODITY_BALANCES=${!!args.commodity&&variant==='candidate'};window.requestAnimationFrame=()=>0;const nativeInterval=window.setInterval.bind(window);window.setInterval=()=>0;window.__perfBootDelays=[];let heartbeat=performance.now();window.__perfBootTimer=nativeInterval(()=>{const now=performance.now();window.__perfBootDelays.push(now-heartbeat);heartbeat=now;},20);`});
    // foreground=1 selects the page's main-thread reference driver: under the default worker, simTick() throws. Pre-worker builds ignore it. Timings are the reference driver's, not the simulation worker's.
    const started=Date.now();await c.send('Page.navigate',{url:pathToFileURL(path.join(OUT,variant==='baseline'?'baseline.html':'candidate.html')).href+`#s=${w.seed}&f=${w.seed}&c=${w.coast}&y=${era}`+(variant==='off'?'&worker=off':'')+'&foreground=1'});
    while(!await evaluate(c,"typeof W!=='undefined'&&!!W&&!document.getElementById('loading')").catch(()=>false)){if(errors.length)throw new Error(errors.join('\n'));if(Date.now()-started>bootTimeout)throw new Error('boot timeout');await sleep(100);}
    result.bootMs=Date.now()-started;result.bootHeartbeat=await evaluate(c,"(()=>{clearInterval(window.__perfBootTimer);const a=window.__perfBootDelays.slice().sort((a,b)=>a-b);return{samples:a.length,p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};})()");result.browser=await c.send('Browser.getVersion');result.gpu=await evaluate(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()");assert.ok(!/SwiftShader|llvmpipe|Software Rasterizer/i.test(result.gpu));
    await evaluate(c,'setSpeed(0);ownershipTick()');result.initial=await evaluate(c,FINGERPRINT);result.bootStorageVersion=await evaluate(c,"Math.max(0,...W.settlements.map(s=>s.storage?.version||0))");result.bootWorker=await evaluate(c,"typeof ROUTING==='undefined'?null:{...ROUTING.stats,disabled:ROUTING.disabled}");
    if(SHORT_RUN){result.shortRun=await evaluate(c,SHORT_RUN);result.shortRun.state=await evaluate(c,FINGERPRINT);assert.equal(result.shortRun.errors,0);assert.ok(Number.isFinite(result.shortRun.pop));fs.writeFileSync(path.join(OUT,id+'.jsonl'),JSON.stringify(result.shortRun)+'\n');console.log(`${id}: ${result.shortRun.day} days, ${result.shortRun.places} places, ${result.shortRun.tickMsDay.toFixed(2)} ms/tick`);}
    for(let y=1;y<=years;y++){const annual=await evaluate(c,YEAR);annual.state=await evaluate(c,FINGERPRINT);assert.equal(annual.errors,0);assert.ok(Number.isFinite(annual.pop));result.annual.push(annual);fs.appendFileSync(path.join(OUT,id+'.jsonl'),JSON.stringify(annual)+'\n');
      if(y===1||y%5===0||y===years)console.log(`${id}: AD ${annual.AD}, ${annual.places} places, ${annual.tickMsDay.toFixed(2)} ms/tick`);}
    result.storageVersion=await evaluate(c,"Math.max(0,...W.settlements.map(s=>s.storage?.version===3?3:s.storage?.lots instanceof Map?2:0))");
    result.rngNext=await evaluate(c,"Object.fromEntries(['gen','sim','folk'].map(k=>[k,Array.from({length:16},()=>RS[k]())]))");result.errors=errors;assert.equal(errors.length,0);
    if(variant==='candidate'&&!SHORT_RUN)assert.ok(result.bootWorker?.workerTrees>0||result.annual.some(y=>y.worker?.workerTrees>0),'Chrome worker produced no trees');
    if(variant==='off')assert.ok(result.bootWorker?.disabled&&result.bootWorker.workerTrees===0&&result.annual.every(y=>y.worker?.disabled&&y.worker.workerTrees===0),'worker=off did not disable the Chrome worker');
    // Keep the final semantic state locally for diagnosing any mismatch, before further game steps.
    fs.writeFileSync(path.join(OUT,id+'.state.json'),await evaluate(c,SERIALIZE));
    fs.writeFileSync(path.join(OUT,id+'.result.json'),JSON.stringify(result,null,2));return result;
  }catch(e){result.failed=e.message;result.errors=errors;fs.writeFileSync(path.join(OUT,id+'.result.json'),JSON.stringify(result,null,2));return result;}finally{stop();}}

const results=[];if(args.reference){const reference=JSON.parse(fs.readFileSync(path.join(args.reference,'run.json')));assert.equal(reference.sourceSHA256.baseline,run.sourceSHA256.baseline);assert.equal(Number(reference.args.years??10),years);assert.equal(Number(reference.args.era??850),era);for(const w of worlds)results.push(JSON.parse(fs.readFileSync(path.join(args.reference,`baseline-${w.seed}-${w.coast}.result.json`))));}
for(const w of worlds)for(const variant of variants){console.log('Checking '+variant+' '+w.seed+' '+w.coast);results.push(await check(variant,w));fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));}
const checks=[];for(const w of worlds){const base=results.find(r=>r.variant==='baseline'&&r.seed===w.seed&&r.coast===w.coast);for(const variant of variants.filter(v=>v!=='baseline')){const next=results.find(r=>r.variant===variant&&r.seed===w.seed&&r.coast===w.coast),schemaComparable=!!base&&!!next&&base.storageVersion===next.storageVersion,matched=schemaComparable?!!base&&!base.failed&&!next.failed&&base.initial.sha256===next.initial.sha256&&base.annual.length===next.annual.length&&base.annual.every((a,i)=>a.state.sha256===next.annual[i].state.sha256)&&(!SHORT_RUN||base.shortRun?.state?.sha256===next.shortRun?.state?.sha256)&&JSON.stringify(base.rngNext)===JSON.stringify(next.rngNext):null;
    const timing=r=>r?.annual?.length>1?r.annual.slice(1).reduce((n,a)=>n+a.tickMsDay,0)/(r.annual.length-1):null,b=timing(base),c=timing(next);checks.push({...w,variant,matched,schemaComparable,comparison:schemaComparable?'exact initial, annual/short-run graph and RNG': 'incomparable storage schema; household/economy not independently compared',baselineStorageVersion:base?.storageVersion,candidateStorageVersion:next?.storageVersion,baselineBootMs:base?.bootMs,candidateBootMs:next?.bootMs,bootSpeedup:base?.bootMs/next?.bootMs,baselineMsDay:b,candidateMsDay:c,speedup:b!==null&&c>0?b/c:null,failed:next.failed||base?.failed||null});}}
fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify({schema:args.commodity?'commodity-v3':'legacy-v2',schemaComparable:checks.every(c=>c.schemaComparable),checks},null,2));console.log(JSON.stringify({out:OUT,checks},null,2));process.exit(checks.every(c=>c.matched===true||c.matched===null&&!c.schemaComparable&&!c.failed)?0:1);
