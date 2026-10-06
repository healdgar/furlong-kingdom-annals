#!/usr/bin/env node
/* Compare the complete HISTORY root after 30 identical simulation days with no
   renderer, with browser rendering absent/throttled/continuous. */
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
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
async function graphDigest(c){return ev(c,`(async()=>{const q=HISTORY.roots(),root={world:q.world,globals:q.globals,rng:q.rng,layouts:q.layouts},g=new HistoryGraph();g.capture(root,{skipQueryScratch:true});const rows=[...g.state].sort(([a],[b])=>a-b),bytes=new TextEncoder().encode(JSON.stringify(rows)),hash=await crypto.subtle.digest('SHA-256',bytes),fingerprints=rows.map(([id,s])=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return id+':'+(h>>>0).toString(16)}).join(','),targets=new Set([101,102,103,104,105,106,8043]),found=new Map(),seen=new WeakSet(),todo=[[root,'root']];while(todo.length&&found.size<targets.size){const[o,p]=todo.pop();if(!o||typeof o!=='object'||seen.has(o))continue;seen.add(o);const id=g.ids.get(o);if(targets.has(id)){found.set(id,p);targets.delete(id);}if(o instanceof Map){for(const[k,v]of o)todo.push([v,p+'.<map:'+String(k)+'>']);}else if(o instanceof Set){let i=0;for(const v of o)todo.push([v,p+'.<set:'+(i++)+'>']);}else for(const k of Reflect.ownKeys(o)){const d=Object.getOwnPropertyDescriptor(o,k);if(d&&'value'in d&&d.value&&typeof d.value==='object')todo.push([d.value,p+'.'+String(k)]);}}globalThis.__cadenceGraph=g;return{hash:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join(''),nodes:rows.length,fingerprints,head:rows.slice(0,110).map(([id,s])=>[id,s.slice(0,1800)]),focus:[101,102,103,104,105,106,8043].map(id=>({id,path:found.get(id)||'?',state:g.state.get(id)}))};})()`);}
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


const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),outAt=args.indexOf('--out'),modeAt=args.indexOf('--modes'),daysAt=args.indexOf('--days'),DAYS=daysAt>=0?Number(args[daysAt+1]):30,selectedModes=modeAt>=0?args[modeAt+1]?.split(','):['model','none','throttled','continuous'];
if(outAt>=0&&!args[outAt+1])throw Error('--out requires a directory');
if(!selectedModes?.length||selectedModes.some(m=>!['model','none','throttled','continuous'].includes(m)))throw Error('--modes expects comma-separated model,none,throttled,continuous');
if(!selectedModes.includes('model'))throw Error('the --modes selection must include model as the canonical reference');
if(!Number.isInteger(DAYS)||DAYS<0)throw Error('--days expects a nonnegative integer');
const OUT=outAt>=0?path.resolve(args[outAt+1]):fs.mkdtempSync(path.join(os.tmpdir(),'furlong-cadence-'));fs.mkdirSync(OUT,{recursive:true});
const current=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');fs.writeFileSync(path.join(OUT,'candidate.html'),current);const scriptMarker='<script>\n/* =========================================================================\n   ANNALS';if(!current.includes(scriptMarker))throw Error('main script marker missing');fs.writeFileSync(path.join(OUT,'model-only.html'),current.replace(scriptMarker,'<script>globalThis.FURLONG_HEADLESS=true;</script>'+scriptMarker));
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,f=p.startsWith('/assets/')?ROOT+p:OUT+p;if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.webp')?'image/webp':'image/png');fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const capture=`day()`;
const results=[];
try{for(const mode of selectedModes){const{c,kill}=await launch();try{const errors=[];c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails.exception?.description));await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.requestAnimationFrame=()=>0;'});await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'+(mode==='model'?'model-only':'candidate')+'.html#s=1001&f=1001&c=sea'});for(let i=0;i<600;i++){if(errors.length)throw Error(errors.join('\n'));if(await ev(c,mode==='model'?"typeof startSimulation==='function'&&typeof HistoryGraph==='function'":"typeof simTick==='function'&&document.getElementById('loading')===null"))break;await sleep(200);}
if(mode==='model')await ev(c,"startSimulation({seed:1001,fate:1001,coast:'sea',outcomeJournal:new OutcomeJournal(async entry=>({chunk:entry.chunk,first:entry.first,last:entry.last}),{maxPendingBytes:64*1024*1024})}).then(()=>setSpeed(0))");else await ev(c,"setSpeed(0);cam.mode='free';document.body.classList.add('hideui');");
await ev(c,`(()=>{const st=W.rivStrips?.[0];if(st){riverName(st);const p=st.pts[0],o=p&&riverAt(p.x,p.z,2);if(o&&!MODEL_ONLY)showInspect({type:'river',st,o});}for(const s of W.settlements)if(s.wallRad)fortGateAngles(s,s);if(!MODEL_ONLY){const s=W.settlements[0];showInspect({type:'settlement',s});contextUI.expanded=true;const p=s.folk?.find(x=>!x.dead);if(p)showInspect({type:'person',p,s});const k=Object.keys(BEAST_TEXT)[0];if(k)showInspect({type:'beast',si:0,k});}return true})()`);
const frames=[];frames.push(await ev(c,capture));const graphDay0=await graphDigest(c);let graphDay30=DAYS===0?graphDay0:null,timing={tick:0,projection:0};
for(let dayIndex=1;dayIndex<=DAYS;dayIndex++){const t=await ev(c,`(async()=>{let t=performance.now(),ran=simTick();if(ran===false){await STORAGE_OUTCOMES.wait();t=performance.now();simTick();}const tick=performance.now()-t;let projection=0;if(${mode==='continuous'||mode==='throttled'&&dayIndex%10===0}){t=performance.now();animateWorld(0.02,${dayIndex/10});projection=performance.now()-t;}return{tick,projection};})()`);timing.tick+=t.tick;timing.projection+=t.projection;frames.push(await ev(c,capture));if(dayIndex===DAYS)graphDay30=await graphDigest(c);}
const probes=await ev(c,`(()=>{const q=HISTORY.roots(),root={world:q.world,globals:q.globals,rng:q.rng,layouts:q.layouts},g=new HistoryGraph();g.capture(root,{skipQueryScratch:true});if(!MODEL_ONLY)animateWorld(.02,5);const changes=g.capture(root,{skipQueryScratch:true}).changes,pathTo=id=>{const seen=new WeakSet(),todo=[[root,'root']];while(todo.length){const[o,p]=todo.pop();if(!o||typeof o!=='object'||seen.has(o))continue;seen.add(o);if(g.ids.get(o)===id)return p;if(o instanceof Map){for(const[k,v]of o)todo.push([v,p+'.<map:'+String(k)+'>']);}else if(o instanceof Set){let i=0;for(const v of o)todo.push([v,p+'.<set:'+(i++)+'>']);}else for(const k of Reflect.ownKeys(o)){const d=Object.getOwnPropertyDescriptor(o,k);if(d&&'value'in d&&d.value&&typeof d.value==='object')todo.push([d.value,p+'.'+String(k)]);}}return '?'};return{changes:changes.map(([id,b,a])=>({id,path:pathTo(id),before:b,after:a}))};})()`);const result={mode,frames,timing,graphDay0,graphDay30,projectionChanges:probes.changes.length,projectionChangedNodes:probes.changes.slice(0,20),errors};results.push(result);fs.writeFileSync(path.join(OUT,mode+'.json'),JSON.stringify(result));console.log(JSON.stringify({mode,timing,graphDay0:{hash:graphDay0.hash,nodes:graphDay0.nodes},graphDay30:{hash:graphDay30.hash,nodes:graphDay30.nodes},projectionChanges:probes.changes.length,projectionChangedNodes:result.projectionChangedNodes,errors}));}finally{kill();}}
const reference=results.find(r=>r.mode==='model'),equality=Object.fromEntries(results.map(r=>[r.mode,{day0:r.graphDay0.hash===reference.graphDay0.hash,day30:r.graphDay30.hash===reference.graphDay30.hash}]));
const firstDifference=(a,b)=>{if(!a||!b)return null;const x=a.split(','),y=b.split(','),n=Math.min(x.length,y.length);for(let i=0;i<n;i++)if(x[i]!==y[i])return{index:i,a:x[i],b:y[i]};return x.length===y.length?null:{index:n,a:x[n],b:y[n]};};
const graphDiffs=Object.fromEntries(results.filter(r=>r.mode!=='model').map(r=>[r.mode,{day0:firstDifference(reference.graphDay0.fingerprints,r.graphDay0.fingerprints),day30:firstDifference(reference.graphDay30.fingerprints,r.graphDay30.fingerprints)}]));
const meta={sourceSHA256:createHash('sha256').update(current).digest('hex'),seed:1001,fate:1001,coast:'sea',days:DAYS,equality,firstCanonicalDifferences:graphDiffs};
fs.writeFileSync(path.join(OUT,'meta.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));console.log(OUT);
if(Object.values(equality).some(v=>!v.day0||!v.day30))process.exitCode=1;
}finally{server.close();}
