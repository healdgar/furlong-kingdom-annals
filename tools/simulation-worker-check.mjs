#!/usr/bin/env node
// Isolated full-source Chrome worker/main comparison; never attaches to a player tab.
// --gpu-only true measures the annual kernel without installing its output in W.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';
import {probeLandValues} from './gpu-land-value-probe.mjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,l)=>v.startsWith('--')?[...a,[v.slice(2),l[i+1]]]:a,[]));
const out=path.resolve(args.out||'/tmp/furlong-simulation-worker-'+Date.now());
if(fs.existsSync(out))throw Error('Choose a fresh output directory');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(args.source||new URL('../index.html',import.meta.url),'utf8'),source=inlineGameScript(html);
const sourceSHA256=createHash('sha256').update(html).digest('hex');
const seed=Number(args.seed||1001),fate=Number(args.fate||42),days=Number(args.days||8);
if(!Number.isInteger(days)||days<1||days>360)throw Error('Invalid days');
const options={seed,fate,coast:args.coast||'sea',startAD:850},hash=`#s=${seed}&f=${fate}&c=${options.coast}&y=850`;
fs.writeFileSync(path.join(out,'index.snapshot.html'),html);fs.writeFileSync(path.join(out,'run.json'),JSON.stringify({sourceSHA256,harnessSHA256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),gpuProbeSHA256:createHash('sha256').update(fs.readFileSync(new URL('./gpu-land-value-probe.mjs',import.meta.url))).digest('hex'),options,days,node:process.version},null,2));
const CHROME=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const quote=s=>JSON.stringify(s).replaceAll('<','\\u003c');
const audit=`async()=>{const graph=new HistoryGraph(),f=graph.capture(W,{skipQueryScratch:true});const bytes=new TextEncoder().encode(JSON.stringify({root:f.root,state:[...graph.state],code:graph.code}));const digest=await crypto.subtle.digest('SHA-256',bytes);return{day:day(),worldSHA256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join(''),rng:Object.fromEntries(Object.entries(RS).map(([k,r])=>[k,r.state()])),households:W.households.size,population:W.settlements.map(s=>s.pop),commands:JOURNAL,annals:allLines,mod:{...MOD},storageSeq:STORAGE_OUTCOMES.journal.seq};}`;
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.open=new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j;});this.ws.onmessage=e=>{const m=JSON.parse(e.data),p=this.pending.get(m.id);if(p){this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};this.ws.onclose=()=>{for(const p of this.pending.values())p.reject(Error('Chrome closed'));this.pending.clear();};}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
}
let child,profile,c;
async function launch(){profile=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-simulation-worker-'));child=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding',...(process.platform==='darwin'?['--use-angle=metal']:[]),'--enable-gpu','--ignore-gpu-blocklist','about:blank'],{stdio:['ignore','ignore','pipe']});const ws=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timed out')),30000);child.stderr.on('data',d=>{text+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(text);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});const tabs=await(await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json();c=new CDP(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await c.open;await c.send('Page.enable');await c.send('Runtime.enable');}
function cleanup(){try{c?.ws.close();child?.kill('SIGKILL');}finally{if(profile)fs.rmSync(profile,{recursive:true,force:true});}}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{cleanup();process.exit(130);});
const results={sourceSHA256,options,days};
try{
 await launch();
 for(const mode of args['gpu-only']?['gpu']:['worker','main','worker-resume','main-resume']){
 const isWorker=mode==='gpu'||mode.startsWith('worker'),isResume=mode.endsWith('resume'),initOptions={...options,...(isResume?{resume:results.worker.save}:{})};
  // Archive IDs and asynchronous persistence counters differ per realm; compare logical status only.
  // Full authoritative graph, RNG and journal sequence are independently compared below.
  const viewProbe=args.views==='true'?`const queryView=(kind,payload={})=>${isWorker?"client.request('view',{kind,...payload})":"model.view(kind,{...payload,fraction:0})"};const viewChecks=[],keys=['worldSHA256','rng','commands','annals','mod','storageSeq'],viewDelta={};const digestView=async(kind,value)=>{const projected={...value};delete projected.at; /* when the screen took its reading (wall clock), not what it read */if(projected.storageStatus){const st=projected.storageStatus;projected.storageStatus={records:st.records,mode:st.mode,fault:st.fault,modelFault:st.modelFault,continuation:st.continuation};}const text=JSON.stringify(projected),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));viewChecks.push({kind,bytes:text.length,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')});return value;};const auditView=()=>${isWorker?"client.request('view',{kind:'audit'})":"model.view('audit')"};let priorViews=await auditView();const checkView=async kind=>{const next=await auditView();viewDelta[kind]=Object.fromEntries(keys.map(k=>[k,JSON.stringify(priorViews[k])!==JSON.stringify(next[k])]));priorViews=next;};const bootstrap=await digestView('bootstrap',await queryView('bootstrap'));await checkView('bootstrap');await digestView('landscape',await queryView('landscape'));await checkView('landscape');await digestView('inspect',await queryView('inspect',{code:'s0',full:false}));await checkView('inspect');const accounts=await digestView('accounts',await queryView('ui',{panel:'info',infoKind:'accounts'}));await checkView('accounts');const actors=await digestView('actors',await queryView('actors',{si:0,focus:bootstrap.settlements[0].pos,fraction:0}));await checkView('actors');for(const mode of ['trade','value','production','landuse']){await digestView('overlay:'+mode,await queryView('overlay',{mode}));await checkView('overlay:'+mode);}const viewRngStable=Object.values(viewDelta).every(x=>!x.rng);const viewWorldStable=Object.values(viewDelta).every(x=>!x.worldSHA256);window.__viewEvidence={views:viewChecks,viewRngStable,viewWorldStable,viewDelta,accountsBytes:accounts.html.length,actorCount:actors.citizens?.people?.length||0};if(!viewRngStable)throw Error('A read-only UI view changed simulation RNG: '+JSON.stringify(viewDelta));` : '';
  const prefix=`globalThis.FURLONG_HEADLESS=true;globalThis.FURLONG_OPTIONS=${JSON.stringify({hash,build:'worker-check'})};`;
  const driver=mode==='gpu'?`\n(async()=>{try{const code=${quote(source)},prefix=${quote(prefix)},audit=${quote('globalThis.FURLONG_WORKER_AUDIT=()=>('+probeLandValues.toString()+')();')};const url=URL.createObjectURL(new Blob([prefix,code,audit,'simulationWorkerRuntime();'],{type:'text/javascript'}));const client=new SimulationWorkerClient(new Worker(url));URL.revokeObjectURL(url);await client.request('init',{...${JSON.stringify(initOptions)},source:code});const result=await client.request('view',{kind:'audit'});await client.close();window.__result=result;}catch(e){window.__error=String(e.stack||e);}})();`:`\n(async()=>{const measurements={boot:[],advance:[]},views=[];let phase='boot',last=performance.now();const timer=setInterval(()=>{const n=performance.now();measurements[phase].push(n-last);last=n;},16);const started=performance.now();try{\n`+
   (isWorker?`const code=${quote(source)},prefix=${quote(prefix)},audit=${quote('globalThis.FURLONG_WORKER_AUDIT='+audit+';')};const url=URL.createObjectURL(new Blob([prefix,code,audit,'simulationWorkerRuntime();'],{type:'text/javascript'}));const client=new SimulationWorkerClient(new Worker(url));URL.revokeObjectURL(url);await client.request('init',{...${JSON.stringify(initOptions)},source:code});`:`globalThis.FURLONG_WORKER_AUDIT=${audit};const model=simulationWorkerModel();await model.init({...${JSON.stringify(initOptions)},source:${quote(source)}});model.speed(0);model.view('summary');`)+
   `const bootMs=performance.now()-started;`+viewProbe+
   (isResume?'':isWorker?`await client.request('command',{k:'sov',on:true,hi:0});await client.request('command',{k:'set',n:'tax',v:19});`:`model.validate({k:'sov',on:true,hi:0});model.command({k:'sov',on:true,hi:0});model.validate({k:'set',n:'tax',v:19});model.command({k:'set',n:'tax',v:19});`)+
   (isWorker?`client.onview=view=>{views.push({day:view.day,towns:view.settlements.length});};await client.request('watch',{everyDays:3});`:'')+
   `await new Promise(r=>setTimeout(r,20));phase='advance';last=performance.now();const tickStart=performance.now();`+
   (isWorker?`const advanced=await client.request('advance',{days:${days}});`:`for(let i=0;i<${days};i++){await model.wait();if(model.tick()===false){i--;continue;}}`)+
   `const advanceMs=performance.now()-tickStart;await new Promise(r=>setTimeout(r,20));clearInterval(timer);`+
   (isWorker?`const save=await client.request('save',{name:'worker boundary'});const journal=await client.request('flush');const state=await client.request('view',{kind:'audit'});await client.close();`:`const save=await model.save('worker boundary');const journal=await model.flush();const state=await model.view('audit');`)+
   `window.__result={mode:${quote(mode)},bootMs,advanceMs,heartbeat:measurements,views,state,journal,save,viewEvidence:window.__viewEvidence||null};}catch(e){clearInterval(timer);window.__error=String(e.stack||e);}})();`;
  const page=`<!doctype html><meta charset="utf-8"><title>Simulation worker check</title><p>Full-source ${mode} check</p><script>${prefix}</script><script>${source}</script><script>${driver}</script>`;
  const pagePath=path.join(out,mode+'.html');fs.writeFileSync(pagePath,page);
  await c.send('Page.navigate',{url:pathToFileURL(pagePath).href});let result;const until=Date.now()+600000;
  while(Date.now()<until){await sleep(1000);const state=await c.evaluate('({result:window.__result,error:window.__error})');if(state.error)throw Error(state.error);if(state.result){result=state.result;break;}}
  if(!result)throw Error(mode+' timed out');results[mode]=result;fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(result,null,2));if(mode==='gpu'){console.log(JSON.stringify(result,null,2));continue;}console.log(mode+': '+Math.round(result.advanceMs)+' ms for '+days+' days; UI heartbeat max '+Math.round(Math.max(0,...result.heartbeat.advance))+' ms');
 }
 if(args['gpu-only']){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}else{
 results.parity=JSON.stringify(results.worker.state)===JSON.stringify(results.main.state);
 results.resumeParity=JSON.stringify(results['worker-resume'].state)===JSON.stringify(results['main-resume'].state);
 if(args.views==='true'){
   results.viewParity=['worker','main','worker-resume','main-resume'].every(m=>JSON.stringify(results[m].viewEvidence?.views)===JSON.stringify(results[m.startsWith('worker')?'main'+m.slice(6):'worker'+m.slice(4)].viewEvidence?.views));
   results.viewRngStable=['worker','main','worker-resume','main-resume'].every(m=>results[m].viewEvidence?.viewRngStable);
   results.viewWorldStable=['worker','main','worker-resume','main-resume'].every(m=>results[m].viewEvidence?.viewWorldStable);
 }
 results.responsive=results.worker.heartbeat.advance.length>=2&&results.worker.views.length>=Math.floor(days/3);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 if(!results.parity||!results.resumeParity)throw Error('Worker/main canonical state differs');
 if(args.views==='true'&&(!results.viewParity||!results.viewRngStable))throw Error('Worker/main view outputs differ or a view changed simulation RNG');
 if(!results.responsive)throw Error('Main-thread heartbeat did not run during worker advancement');
 for(const mode of ['worker','main','worker-resume','main-resume'])if(results[mode].journal.fault||results[mode].journal.pendingBytes||results[mode].journal.pendingChunks)throw Error(mode+' journal did not settle');
 console.log('PASS: full W graph, RNG, household count, population, commands, annals, settings and storage sequence match.');
}
}finally{cleanup();}
