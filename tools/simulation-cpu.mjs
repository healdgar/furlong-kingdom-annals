#!/usr/bin/env node
/* Matched native tick and projection CPU through two years. The isolated
   baseline snapshot repairs its known siegeArc null-target crash only.
   node tools/simulation-cpu.mjs --baseline e0cd7e5 --out /tmp/furlong-cpu
   No source or user browser state is changed.
   Drives the main-thread reference simulation (foreground=1), not the simulation worker. */
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const CHROME=process.env.CHROME||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p)),RENDER=true;
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
    ...(RENDER?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const kill=()=>{active.delete(kill);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(kill);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);
    p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',c=>{clearTimeout(t);rej(new Error('Chrome exited '+c));});p.on('error',e=>{clearTimeout(t);rej(e);});});
  const port=new URL(ws).port,list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(),pg=list.find(t=>t.type==='page');
  const c=new CDP(pg.webSocketDebuggerUrl);await c.open;
  const cleanup=()=>{c.close();kill();};return {c,kill:cleanup};
  }catch(e){kill();throw e;}}


const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),value=(n,f)=>{const i=args.indexOf(n);return i<0?f:args[i+1];},OUT=path.resolve(value('--out',fs.mkdtempSync(path.join(os.tmpdir(),'furlong-cpu-')))),BASELINE=value('--baseline','e0cd7e5');
fs.mkdirSync(OUT,{recursive:true});
const modes=value('--modes','baseline,candidate').split(',');
if(!modes.length||modes.some(m=>!['baseline','candidate'].includes(m)))throw Error('--modes expects baseline,candidate or either one');
const sources={baseline:execFileSync('git',['show',BASELINE+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:10e6}),candidate:fs.readFileSync(path.join(ROOT,'index.html'),'utf8')};
// The baseline's unrelated year-two siege crash is repaired in this temporary snapshot only.
const baselineCrashRepair=sources.baseline.includes('aim=target===circuit');if(baselineCrashRepair)sources.baseline=sources.baseline.replace('aim=target===circuit','aim=!!target&&target===circuit');
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname; if(p==='/baseline.html'||p==='/candidate.html'){res.setHeader('Content-Type','text/html');res.end(sources[p.slice(1,-5)]);return;}const f=path.resolve(ROOT,'.'+p);if(!f.startsWith(ROOT+'/assets/')||!fs.existsSync(f)){res.writeHead(404);res.end();return;}fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const results=[];
try{for(const which of modes){console.log('CPU '+which);const {c,kill}=await launch();try{
const errors=[];await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',m=>errors.push(m.exceptionDetails.exception?.description||m.exceptionDetails.text));await c.send('Page.enable');
await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;'});
/* foreground=1: reference driver (simTick() throws under the worker); 'candidate' CPU is the reference driver's, not the worker's */await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'+which+'.html#s=1001&f=1001&c=sea&foreground=1'});
let ready=false;const end=Date.now()+120000;while(Date.now()<end){if(errors.length)throw Error(errors.join('\n'));ready=await ev(c,"document.getElementById('loading')===null&&typeof renderer!=='undefined'");if(ready)break;await sleep(100)}if(!ready)throw Error('boot timeout');await ev(c,'setSpeed(0)');
const years=[];for(let year=0;year<2;year++){let simMs=0,projectionMs=0,state;for(let block=0;block<12;block++){const m=await ev(c,`(async()=>{let sim=0,projection=0;for(let i=0;i<30;i++){const t=performance.now();if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;continue;}sim+=performance.now()-t;if((i+1)%10===0){const v=performance.now();animateWorld(.1,day());projection+=performance.now()-v;}}return{sim,projection,errors:errN,day:day(),population:W.settlements.reduce((n,s)=>n+s.pop,0),people:W.settlements.reduce((n,s)=>n+(s.folk?.length||0),0),households:W.households?.size||0,buildings:W.bldList?.length||G.bldList?.length||0}})()`);state={day:m.day,population:m.population,people:m.people,households:m.households,buildings:m.buildings};simMs+=m.sim;projectionMs+=m.projection;if(m.errors)throw Error('simulation errors '+m.errors);await sleep(0)}years.push({year:year+1,simMs,projectionMs,totalMs:simMs+projectionMs,state});console.log(which,JSON.stringify(years.at(-1)))}results.push({which,sha256:createHash('sha256').update(sources[which]).digest('hex'),years,baselineRef:BASELINE,baselineCrashRepair:which==='baseline'&&baselineCrashRepair});
}finally{kill()}}fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}finally{server.close()}
