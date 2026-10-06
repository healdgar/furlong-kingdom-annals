#!/usr/bin/env node
// Local, serial baseline/candidate histories and CPU timings in hardware-GPU-backed Chrome.
// node tools/performance-check.mjs --baseline main --seeds 1001:sea,2002:land --years 10 --out /tmp/furlong-performance
// --variants baseline,candidate,off also compares the worker-disabled synchronous fallback.
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
const OUT=path.resolve(args.out||path.join(os.tmpdir(),'furlong-performance-'+Date.now())),years=Number(args.years??1),era=Number(args.era??850),bootTimeout=Number(args['boot-timeout']??120)*1000;
const worlds=String(args.seeds||'1001:sea,2002:land').split(',').map(v=>{const[s,coast]=v.split(':');return{seed:Number(s),coast};});
const variants=String(args.variants||'baseline,candidate').split(',');
if(!Number.isInteger(years)||years<0||!Number.isInteger(era)||era<850||era>1500||!Number.isFinite(bootTimeout)||bootTimeout<1000||worlds.some(w=>!Number.isInteger(w.seed)||!['sea','land'].includes(w.coast))||variants.some(v=>!['baseline','candidate'].includes(v)))throw new Error('invalid years, era, timeout, seed:coast or variants');
if(fs.existsSync(OUT))throw new Error('choose a fresh evidence directory');fs.mkdirSync(OUT,{recursive:true});
const sources={baseline:args['baseline-source']?fs.readFileSync(args['baseline-source'],'utf8'):execFileSync('git',['show',(args.baseline||'main')+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:20e6}),candidate:fs.readFileSync(args.source||path.join(ROOT,'index.html'),'utf8')};
const hash=s=>createHash('sha256').update(s).digest('hex');for(const[k,s]of Object.entries(sources))fs.writeFileSync(path.join(OUT,k+'.html'),s);
const run={sourceSHA256:Object.fromEntries(Object.entries(sources).map(([k,s])=>[k,hash(s)])),harnessSHA256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),args,startedUTC:new Date().toISOString(),node:process.version};
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

const SERIALIZE=`(()=>{const seen=new Map(),pending=[],nodes=[],omit=new Set(${JSON.stringify(['__hs','_pm','_folkIndex','_folkRevision','_householdsV','_popTotal','_popValid','routes',...(args['ignore-life-ledger']?['ev','historyCells']:[])])});
  const walk=v=>{if(v===undefined)return['undefined'];if(typeof v==='function')return['function'];if(typeof v==='number'&&!Number.isFinite(v))return['number',String(v)];if(v===null||typeof v!=='object')return v;
    if(v.isObject3D||v.isMaterial||v.isTexture||v.isBufferGeometry||v.nodeType)return['graphic'];if(!seen.has(v)){seen.set(v,pending.length);pending.push(v);}return['ref',seen.get(v)];};
  const LAND=W.land||G.land,root=walk({world:W,land:{F:LAND.F,mask:LAND.mask,flood:LAND.flood,perHead:LAND.perHead},annals:allLines,journal:JOURNAL,mod:MOD,personID:PID,notableID:NID,geography:{bldList:W.bldList??G.bldList,treeSpots:W.treeSpots??G.treeSpots,treeHash:W.treeHash??G.treeHash,trackSet:W.trackSet??G.trackSet,tg:W.tg??G.tg,rivStrips:W.rivStrips??G.rivStrips,rivHash:W.rivHash??G.rivHash,trackBridgeAt:W.trackBridgeAt??G.trackBridgeAt,bridgeSpans:G.bridgeSpans}});
  for(let i=0;i<pending.length;i++){const v=pending[i];if(ArrayBuffer.isView(v))nodes[i]=['typed',v.constructor.name,Array.from(v)];else if(v instanceof Map)nodes[i]=['map',[...v].map(([k,x])=>[walk(k),walk(x)])];else if(v instanceof Set)nodes[i]=['set',[...v].map(walk)];
    else if(Array.isArray(v))nodes[i]=['array',v.map(walk)];else nodes[i]=['object',Object.keys(v).filter(k=>!omit.has(k)&&!(v instanceof StorageLedger&&['totals','occupancy'].includes(k))&&typeof v[k]!=='function').sort().map(k=>[k,walk(v[k])])];}
  return JSON.stringify({root,nodes});})()`;
const FINGERPRINT=`(async()=>{const s=${SERIALIZE},buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return{sha256:[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join(''),bytes:s.length};})()`;
// Paired persistence boundaries make every original tagged record independently comparable.
// Full journal stays enabled; only automatic flush cadence is replaced by explicit fixed batches.
const INSTRUMENT=`window.__titleCost={};window.__chunkHashes=[];STORAGE_OUTCOMES.schedule=()=>{};
for(const name of ['storageTitles','simTick','outcomeJSON','storageRecordState','storageRoute','storageAccess']){const fn=window[name];window[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{const x=__titleCost[name]||(__titleCost[name]={ms:0,n:0});x.ms+=performance.now()-t;x.n++;}};}
{const fn=OutcomeJournal.prototype.append;OutcomeJournal.prototype.append=function(e){this.chunkBytes=Infinity;if(!this.__observedWrite){this.__observedWrite=true;const write=this.write;this.write=async entry=>{await write(entry);__chunkHashes.push({first:entry.first,last:entry.last,hash:STORAGE_OUTCOMES.lastHash});};}const seq=fn.call(this,e);if(this.seq%1024===0)this.seal();return seq;};}`;
for(const[k,s]of Object.entries(sources)){fs.writeFileSync(path.join(OUT,k+'.source.html'),s);fs.writeFileSync(path.join(OUT,k+'.html'),s.replace('\nboot();','\n'+INSTRUMENT+'\nboot();'));}
run.instrumentSHA256=hash(INSTRUMENT);fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(run,null,2));
const target=Number(args.days??270);assert.ok(Number.isInteger(target)&&target>0);
async function check(variant,w){const{c,stop}=await launch(),id=`${variant}-${w.seed}-${w.coast}`,errors=[],r={id,...w,variant};try{
await c.send('Page.enable');await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;window.setInterval=()=>0;'});
await c.send('Page.navigate',{url:pathToFileURL(path.join(OUT,variant+'.html')).href+`#s=${w.seed}&f=${w.seed}&c=${w.coast}&y=850`});const start=Date.now();
while(!await evaluate(c,"typeof W!=='undefined'&&!!W&&!document.getElementById('loading')").catch(()=>false)){if(errors.length)throw Error(errors.join('\n'));if(Date.now()-start>bootTimeout)throw Error('boot timeout');await sleep(100);}
r.gpu=await evaluate(c,"(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);})()");assert.ok(!/SwiftShader|llvmpipe|Software/i.test(r.gpu));
await evaluate(c,"setSpeed(0);jot({k:'sov',on:true,hi:0});setSovereign(true,0)");
r.site=await evaluate(c,`(()=>{for(let si=0;si<W.settlements.length;si++){const s=W.settlements[si];if(s.owner!==0)continue;for(const st of s.streets||[])for(const p of st.pts||[])for(const rad of [18,25,36])for(let k=0;k<8;k++){const x=p.x+rad*Math.cos(k*Math.PI/4),z=p.z+rad*Math.sin(k*Math.PI/4),q=storageSiteQuote(si,'grange',x,z,0);if(q.ok){window.__project=storageCommission(q);return{si,x,z,cost:q.cost};}}}return null;})()`);assert.ok(r.site);r.boundaries=[];
for(let end=Math.min(30,target);;end=Math.min(end+30,target)){await evaluate(c,`(async()=>{while(day()<${end}){if(simTick()===false){await STORAGE_OUTCOMES.wait();continue;}if(day()%15===0)await new Promise(r=>setTimeout(r,0));}await STORAGE_OUTCOMES.flush();})()`);r.boundaries.push({day:end,state:await evaluate(c,FINGERPRINT),history:await evaluate(c,'STORAGE_OUTCOMES.status()')});if(end===target)break;}
r.cost=await evaluate(c,'__titleCost');r.chunks=await evaluate(c,'__chunkHashes');r.final=await evaluate(c,FINGERPRINT);r.rng=await evaluate(c,"Object.fromEntries(['gen','sim','folk'].map(k=>[k,Array.from({length:16},()=>RS[k]())]))");r.errors=errors;r.stateFile=id+'.state.json';fs.writeFileSync(path.join(OUT,r.stateFile),await evaluate(c,SERIALIZE));
}catch(e){r.failed=e.stack;r.errors=errors;try{r.failureState=await evaluate(c,'({day:day(),log:STORAGE_OUTCOMES.status()})');}catch{}}finally{stop();fs.writeFileSync(path.join(OUT,id+'.result.json'),JSON.stringify(r,null,2));}return r;}
const results=[];for(const w of worlds)for(const v of variants){console.log('Checking '+v+' '+w.seed+' '+w.coast);results.push(await check(v,w));}
const checks=worlds.map(w=>{const b=results.find(r=>r.variant==='baseline'&&r.seed===w.seed&&r.coast===w.coast),c=results.find(r=>r.variant==='candidate'&&r.seed===w.seed&&r.coast===w.coast);return{...w,passed:!b?.failed&&!c?.failed&&b.final.sha256===c.final.sha256&&JSON.stringify(b.rng)===JSON.stringify(c.rng)&&JSON.stringify(b.chunks)===JSON.stringify(c.chunks)&&JSON.stringify(b.boundaries.map(x=>x.state))===JSON.stringify(c.boundaries.map(x=>x.state)),sameEvents:JSON.stringify(b?.chunks)===JSON.stringify(c?.chunks),baselineCost:b?.cost,candidateCost:c?.cost};});fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify({out:OUT,checks},null,2));process.exit(checks.every(c=>c.passed)?0:1);
