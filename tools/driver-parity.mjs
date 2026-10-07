#!/usr/bin/env node
/* Driver parity: one build must play one history whoever drives it. Each world is played to the given days by
   (1) the model runner's loop in Node (as tools/model-run.cjs and tools/simulation-boundary.mjs drive it),
   (2) the soak's reference driver in Chrome: the page at #foreground=1, frames off, the soak's own harness playing year by year,
       with its yields to the event loop (as tools/soak.mjs drives it), and
   (3) the worker build in Chrome: the game's own simulation worker, advanced by its host (as the player's page drives it).
   At each day it compares W's whole graph, every RNG stream, the annals and the player's commands; any difference fails.

   node tools/driver-parity.mjs --worlds 42:42:sea,1001:42:sea --days 360,720 --out DIR
   Options: --source index.html (default: this checkout's)  --chrome path  --drivers node,soak,worker  --audit N (the soak's
            purse census on the first N days of each year, as soak.mjs --audit; default 360)
   Days must be whole years (multiples of 360) for the soak driver. Needs a GPU (the foreground page draws its world once). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {inlineGameScript} from './simulation-boundary.mjs';
import {moneyFlowGap} from './money-flow.mjs';
import {inventoryAudit} from './inventory-audit.mjs';
import {DAY_PARTS} from './cpu-score.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const A=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
const OUT=path.resolve(A.out||path.join(os.tmpdir(),'furlong-driver-parity-'+Date.now()));
if(fs.existsSync(OUT)&&fs.readdirSync(OUT).length)throw Error('Choose a fresh --out directory');fs.mkdirSync(OUT,{recursive:true});
const SOURCE_PATH=path.resolve(A.source||path.join(HERE,'..','index.html')),HTML=fs.readFileSync(SOURCE_PATH,'utf8'),GAME=inlineGameScript(HTML);
const WORLDS=(A.worlds||'42:42:sea,1001:42:sea').split(',').map(w=>{const [seed,fate,coast]=w.split(':');return {seed:+seed,fate:+fate,coast:coast||'sea'};});
const DAYS=(A.days||'360,720').split(',').map(Number).sort((a,b)=>a-b),LAST=DAYS.at(-1),DRIVERS=(A.drivers||'node,soak,worker').split(','),AUDIT=+(A.audit??360);
if(DAYS.some(d=>!Number.isInteger(d)||d<1||(DRIVERS.includes('soak')&&d%360)))throw Error('days must be positive whole years for the soak driver');
const CHROME=A.chrome||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
fs.writeFileSync(path.join(OUT,'index.snapshot.html'),HTML);
const PAGE=pathToFileURL(path.join(OUT,'index.snapshot.html')).href;
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);

// The same digest in every realm: the graph of W (as the history recorder captures it), the RNG streams, the annals, the commands.
const DIGEST=`(()=>{const h=s=>{let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677);}
    a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);return (b>>>0).toString(16).padStart(8,'0')+(a>>>0).toString(16).padStart(8,'0')+':'+s.length;};
  const keys={};for(const k of Object.keys(W).sort()){const g=new HistoryGraph(),f=g.capture(W[k],{skipQueryScratch:true});keys[k]=h(JSON.stringify([f.root,[...g.state].sort((x,y)=>x[0]-y[0]),g.code]));} // key by key, so a difference is named
  return {day:W.clock.day,world:h(JSON.stringify(keys)),keys,rng:h(JSON.stringify(Object.entries(RS).map(([k,r])=>[k,r.state()]))),
    annals:h(JSON.stringify(allLines)),commands:h(JSON.stringify(JOURNAL.filter(e=>e.k!=='settle'))),treasury:W.treasury,pop:W.settlements.reduce((t,s)=>t+s.pop,0)};})()`;

function nodeRun(w){ // the model runner's loop, in a worker thread's own realm
  const code=`const {parentPort,workerData:{source,seed,fate,coast,days,digest}}=require('node:worker_threads'),vm=require('node:vm');
    for(const k of ['localStorage','sessionStorage','navigator'])Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
    Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash:'#s='+seed+'&f='+fate+'&c='+coast+'&y=850'},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
    vm.runInThisContext(source,{filename:'index.html'});const R=c=>vm.runInThisContext(c);
    (async()=>{await R('startSimulation({seed:'+seed+',fate:'+fate+',coast:'+JSON.stringify(coast)+',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})');
      const out=[],last=Math.max(...days);for(let i=1;i<=last;i++){await R('STORAGE_OUTCOMES.wait()');if(R('simTick()')===false)throw Error('blocked');if(i%8===0)await R('STORAGE_OUTCOMES.journal.flush()');if(days.includes(i))out.push(R(digest));}
      parentPort.postMessage(out);})().catch(e=>{throw e;});`;
  return new Promise((resolve,reject)=>{const t=new Worker(code,{eval:true,workerData:{source:GAME,...w,days:DAYS,digest:DIGEST}});t.once('message',m=>{resolve(m);t.terminate();});t.once('error',reject);});
}

class CDP{
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=()=>rej(Error('websocket failed'));});
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(Error('Chrome connection closed'));this.wait.clear();};
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.wait.has(m.id)){const w=this.wait.get(m.id);this.wait.delete(m.id);m.error?w.rej(Error(m.error.message)):w.res(m.result);}};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.wait.set(id,{res,rej}));}
}
const ev=async(c,expr)=>{const r=await c.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function chrome(fn){ // one headless Chrome with a throwaway profile, as the soak launches it
  if(!CHROME)throw Error('no Chrome found: pass --chrome');
  const dir=fs.mkdtempSync(path.join(OUT,'chrome-'));
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal']:[]),'--enable-gpu','--ignore-gpu-blocklist','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(Error('Chrome did not start')),30000);p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',code=>{clearTimeout(t);rej(Error('Chrome exited '+code));});});
    const list=await(await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json(),c=new CDP(list.find(t=>t.type==='page').webSocketDebuggerUrl);await c.open;await c.send('Runtime.enable');await c.send('Page.enable');
    c.errors=[];return await fn(c);}
  finally{try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}
}

const soak=fs.readFileSync(path.join(HERE,'soak.mjs'),'utf8'),h0=soak.indexOf('const HARNESS=`')+'const HARNESS='.length,h1=soak.lastIndexOf('`',soak.indexOf('\nasync function runWorld'))+1;
const HARNESS=new Function('DAY_PARTS','AUDITFNS','A','inventoryAudit','moneyFlowGap','return '+soak.slice(h0,h1))(DAY_PARTS,[],{},inventoryAudit,moneyFlowGap);
function soakRun(w){ // the soak's reference driver: the whole page in the foreground, its harness playing a year at a time
  return chrome(async c=>{
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__soakRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;'});
    const t0=Date.now();await c.send('Page.navigate',{url:PAGE+`#s=${w.seed}&f=${w.fate}&c=${w.coast}&foreground=1`});
    for(;;){await sleep(250);if(Date.now()-t0>20*60e3)throw Error('the world did not finish loading');
      if(await ev(c,`!document.getElementById('loading')&&typeof W!=='undefined'&&!!W&&!!W.settlements&&typeof errN!=='undefined'`).catch(()=>false))break;}
    await ev(c,HARNESS);const out=[];
    for(let y=1;y*360<=LAST;y++){const r=await ev(c,`__soak.year(${AUDIT})`);if(r.dErr)throw Error(`soak driver: ${r.dErr} simulation errors in year ${y}`);if(DAYS.includes(y*360))out.push(await ev(c,DIGEST));}
    return out;});
}
function workerRun(w){ // the worker build: the game's simulation worker, advanced by its host
  return chrome(async c=>{
    const q=s=>JSON.stringify(s).replaceAll('<','\\u003c'),hash=`#s=${w.seed}&f=${w.fate}&c=${w.coast}&y=850`,prefix=`globalThis.FURLONG_HEADLESS=true;globalThis.FURLONG_OPTIONS=${JSON.stringify({hash,build:'driver-parity'})};`;
    const driver=`(async()=>{try{const code=${q(GAME)},prefix=${q(prefix)},audit=${q('globalThis.FURLONG_WORKER_AUDIT=()=>'+DIGEST+';')};
      const url=URL.createObjectURL(new Blob([prefix,code,audit,'simulationWorkerRuntime();'],{type:'text/javascript'}));const client=new SimulationWorkerClient(new Worker(url));URL.revokeObjectURL(url);
      await client.request('init',{seed:${w.seed},fate:${w.fate},coast:${q(w.coast)},startAD:850,source:code});const out=[];let at=0;
      for(const d of ${JSON.stringify(DAYS)}){await client.request('advance',{days:d-at});at=d;out.push(await client.request('view',{kind:'audit'}));}
      await client.close();window.__result=out;}catch(e){window.__error=String(e.stack||e);}})();`;
    const page=path.join(OUT,`worker-${w.seed}-${w.coast}.html`);
    fs.writeFileSync(page,`<!doctype html><meta charset="utf-8"><title>Driver parity worker</title><script>${prefix}</script><script>${GAME}</script><script>${driver}</script>`);
    await c.send('Page.navigate',{url:pathToFileURL(page).href});const until=Date.now()+60*60e3;
    for(;;){await sleep(1000);if(Date.now()>until)throw Error('worker run timed out');const s=await ev(c,'({r:window.__result,e:window.__error})');if(s.e)throw Error(s.e);if(s.r)return s.r;}});
}

const KEYS=['world','rng','annals','commands'],report={source:SOURCE_PATH,sourceSHA256:createHash('sha256').update(HTML).digest('hex'),days:DAYS,drivers:DRIVERS,worlds:[]};let ok=true;
for(const w of WORLDS){const id=`${w.seed}/${w.fate}/${w.coast}`,R={...w,runs:{}};report.worlds.push(R);
  for(const d of DRIVERS){const t0=Date.now(),cpu0=process.cpuUsage();log(id,d,'…');
    try{R.runs[d]=await ({node:nodeRun,soak:soakRun,worker:workerRun})[d](w);}catch(e){R.runs[d]={error:String(e.message||e)};ok=false;log(id,d,'FAILED',e.message);continue;}
    const cpu=process.cpuUsage(cpu0);log(id,d,'done in',((Date.now()-t0)/1000).toFixed(1),'s (this process',((cpu.user+cpu.system)/1e6).toFixed(1),'s CPU)');}
  R.equal={};for(const day of DAYS){const at=DRIVERS.map(d=>Array.isArray(R.runs[d])?R.runs[d].find(x=>x.day===day):null),ref=at[0];
    const same=!!ref&&at.every(x=>x&&KEYS.every(k=>x[k]===ref[k]));R.equal[day]=same;if(!same)ok=false;
    console.log(`${id} day ${day}: ${same?'EQUAL':'DIFFERENT'}  `+DRIVERS.map((d,i)=>`${d} ${at[i]?`world ${at[i].world.split(':')[0]} rng ${at[i].rng.split(':')[0]} pop ${at[i].pop.toFixed(2)} treasury ${at[i].treasury.toFixed(2)}`:'—'}`).join(' | '));
    if(!same&&ref)for(let i=1;i<at.length;i++)if(at[i]){const k=Object.keys({...ref.keys,...at[i].keys}).filter(k=>ref.keys[k]!==at[i].keys[k]);if(k.length)console.log(`  W keys apart, ${DRIVERS[0]} v ${DRIVERS[i]}: ${k.join(', ')}`);}}
  fs.writeFileSync(path.join(OUT,'parity.json'),JSON.stringify(report,null,1));}
report.pass=ok;fs.writeFileSync(path.join(OUT,'parity.json'),JSON.stringify(report,null,1));
console.log(ok?'PASS: every driver played the same history.':'FAIL: the drivers parted.');process.exit(ok?0:1);
