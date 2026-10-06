#!/usr/bin/env node
/* Speed check: how fast does each game speed really run in the worker build, and what does the player see?
   Per speed it reloads index.html (frozen copy, file://, worker build, hardware GPU), pauses, then calls setSpeed(i) as the UI does and samples
   the worker's own day (BACKGROUND.request('view',{kind:'summary'}), the only copy of the clock that advances) against the foreground day()
   that presentation packets install, with main-thread busy time (CDP Performance.getMetrics), renderer CPU (SystemInfo) and frame times.
   Then pause checks. The player takes the crown (so petitions exist) and the worker pauses itself the way the game does, in petition() when W.player.pause
   is set; we time how long the foreground takes to learn. Mode natural: the unmodified page, wait for the first petition to arise on its own.
   Mode probe: a second copy of index.html with a small hook in the worker (its audit view) raises a petition inside a tick, --pause-at s after setSpeed.
   node tools/speed-check.mjs --speeds 4,5 --seconds 15 --out /tmp/speed-check-1
   Options: --speeds 1,2,3,4,5,6 (default 4,5)  --seconds N (15)  --every ms (1000)  --warmup s (2)  --seed N (1001)  --fate N (42)  --coast sea|land (sea)
            --pause-speeds 5,4|none (5,4)  --pause-modes probe,natural (both)  --pause-at s (8)  --natural-timeout s (30)  --learn-ms N (3000)  --boot-timeout s (240)  --chrome path  --allow-software 1  --out <fresh dir> */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

/* ---- pure helpers ---- */
export const parseArgs=argv=>Object.fromEntries(argv.reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
export const parseList=(s,lo,hi)=>{if(s==='none')return [];const v=String(s).split(',').map(Number);if(!v.length||v.some(n=>!Number.isInteger(n)||n<lo||n>hi)||new Set(v).size!==v.length)throw Error(`expected distinct integers ${lo}..${hi}, got ${s}`);return v;};
export const mean=a=>a.length?a.reduce((t,x)=>t+x,0)/a.length:NaN;
export const linFit=pts=>{const n=pts.length;if(n<2)return{slope:NaN,intercept:NaN,r2:NaN};const mx=mean(pts.map(p=>p.x)),my=mean(pts.map(p=>p.y));let sxx=0,sxy=0,syy=0;
  for(const p of pts){sxx+=(p.x-mx)**2;sxy+=(p.x-mx)*(p.y-my);syy+=(p.y-my)**2;}
  return sxx?{slope:sxy/sxx,intercept:my-sxy/sxx*mx,r2:syy?sxy*sxy/(sxx*syy):1}:{slope:NaN,intercept:NaN,r2:NaN};};
/* the foreground day at time t: installs are {t,day} in time order; it changes only when a presentation packet installs */
export const hudDayAt=(installs,t,initial)=>{let d=initial;for(const i of installs){if(i.t>t)break;d=i.day;}return d;};
/* rows are {wd,hd}: worker day, foreground day at the same instant */
export const lagStats=rows=>{const L=rows.map(r=>r.wd-r.hd);return{n:L.length,mean:mean(L),max:L.length?Math.max(...L):NaN,min:L.length?Math.min(...L):NaN};};
/* installs are {t,from,day,ms}: what the player sees step by step */
export const jumpStats=(installs,seconds)=>{const ch=installs.filter(i=>i.day!==i.from),gaps=ch.slice(1).map((i,k)=>i.t-ch[k].t),J=ch.map(i=>i.day-i.from);
  return{packets:installs.length,changes:ch.length,perSec:installs.length/seconds,maxJump:J.length?Math.max(...J):0,meanJump:mean(J),maxGapMs:gaps.length?Math.max(...gaps):NaN,meanGapMs:mean(gaps),meanInstallMs:mean(installs.map(i=>i.ms)),maxInstallMs:installs.length?Math.max(...installs.map(i=>i.ms)):NaN};};

/* ---- in the page ---- */
const PROBE=`(()=>{if(window.__sc){window.__sc.reset();return 'reset';}
  const S=window.__sc={inst:[],hud:[],fr:[],reset(){this.inst.length=this.hud.length=this.fr.length=0;}};
  const ip=installPresentation;installPresentation=function(p){const r0=G.workerRevision||0,from=day(),t=performance.now(),out=ip.apply(this,arguments);if((G.workerRevision||0)!==r0)S.inst.push({t:performance.now(),from,day:day(),ms:performance.now()-t});return out;};
  const uh=updateHUD;updateHUD=function(){S.hud.push({t:performance.now(),day:day()});return uh.apply(this,arguments);};
  let last=performance.now();const f=t=>{S.fr.push([t,t-last]);last=t;requestAnimationFrame(f);};requestAnimationFrame(f);return 'ok';})()`;
const SAMPLE=`(async()=>{const a=performance.now(),s=await BACKGROUND.request('view',{kind:'summary'}),b=performance.now();return{t:(a+b)/2,rtt:b-a,wd:s.day,ws:s.speed,hd:day(),hs:speedIdx,rev:G.workerRevision,chip:document.getElementById('datechip').textContent};})()`;
const READY=`document.getElementById('loading')===null&&typeof renderer!=='undefined'&&!!renderer&&!!W&&!!BACKGROUND&&!BACKGROUND.closed&&(G.workerRevision||0)>0&&!!document.getElementById('speedselect')`;
/* appended before the worker runtime in a second copy of the page: arms a petition to be raised at the end of the next worker tick */
const INJECT=`\nlet __scArm=false;globalThis.FURLONG_WORKER_AUDIT=p=>{if(p.action!=='speed-check-petition')throw Error('unknown audit action');__scArm=true;return{day:day(),speed:speedIdx,sov:sovOn(),pause:!!W.player?.pause};};
const __scTick=simTick;simTick=function(){const r=__scTick.apply(this,arguments);if(__scArm){__scArm=false;W.player.pause=true;petition({key:'speed-check',to:W.player.house|0,title:'Speed check',pos:W.capital.pos,days:30,ai:0,text:'Probe petition.',opts:[{label:'Dismiss',act(){}}]});}return r;};\n`;

class CDP{
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=()=>rej(Error('websocket failed'));});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data),w=this.wait.get(m.id);if(w){this.wait.delete(m.id);m.error?w.rej(Error(m.error.message)):w.res(m.result);}else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(Error('Chrome closed'));this.wait.clear();};}
  send(method,params={}){const id=++this.n;return new Promise((res,rej)=>{this.wait.set(id,{res,rej});this.ws.send(JSON.stringify({id,method,params}));});}
  on(m,f){if(!this.subs.has(m))this.subs.set(m,[]);this.subs.get(m).push(f);}
  async eval(expression){let timer;const r=await Promise.race([this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}),new Promise((_,rej)=>{timer=setTimeout(()=>rej(Error('evaluate timed out: '+expression.slice(0,120))),60000);})]).finally(()=>clearTimeout(timer));
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  close(){try{this.ws.close();}catch{}}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'-';

async function launch(chrome){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-speed-')),p=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--enable-gpu','--ignore-gpu-blocklist']),'--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  let c,b;const kill=()=>{c?.close();b?.close();try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{kill();process.exit(sig==='SIGINT'?130:143);});
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(Error('Chrome did not start')),30000);p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',x=>{clearTimeout(t);rej(Error('Chrome exited '+x));});});
    const pg=(await (await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json()).find(t=>t.type==='page');
    c=new CDP(pg.webSocketDebuggerUrl);b=new CDP(ws);await Promise.all([c.open,b.open]);return {c,b,kill};
  }catch(e){kill();throw e;}
}

async function main(){
  const A=parseArgs(process.argv.slice(2));
  if(A.help){console.log(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('/*')[1].split('*/')[0].trim());return 0;}
  if(typeof WebSocket!=='function'){console.error('this Node needs a built-in WebSocket (Node 22+)');return 2;}
  const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME=A.chrome||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
  let SPEEDS,PAUSES,MODES;try{SPEEDS=parseList(A.speeds||'4,5',1,6);PAUSES=parseList(A['pause-speeds']||'5,4',1,6);MODES=String(A['pause-modes']||'probe,natural').split(',');if(MODES.some(m=>!['probe','natural'].includes(m)))throw Error('--pause-modes: probe, natural');}catch(e){console.error(String(e.message));return 2;}
  const SEC=+(A.seconds||15),EVERY=+(A.every||1000),WARM=+(A.warmup??2),SEED=+(A.seed||1001),FATE=+(A.fate||42),COAST=A.coast||'sea',PAUSE_AT=+(A['pause-at']||8),NAT=+(A['natural-timeout']||30)*1000,LEARN=+(A['learn-ms']||3000),BOOT=+(A['boot-timeout']||240)*1000;
  if(!CHROME){console.error('no Chrome found: pass --chrome <path>');return 2;}
  if(!A.out){console.error('--out <fresh dir> is required');return 2;}
  if(!(SEC>WARM&&WARM>=0&&EVERY>=100)||!Number.isInteger(SEED)||!Number.isInteger(FATE)||!['sea','land'].includes(COAST)){console.error('invalid --seconds/--warmup/--every/--seed/--fate/--coast');return 2;}
  const OUT=path.resolve(A.out);if(fs.existsSync(OUT)){console.error('refusing to overwrite '+OUT+'; choose a fresh --out directory');return 2;}
  fs.mkdirSync(OUT,{recursive:true});
  const SRC=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),MARK='function simulationWorkerRuntime(){';if(!SRC.includes(MARK))throw Error('index.html lacks the worker runtime marker');
  const PROBED=SRC.replace(MARK,INJECT+MARK),sha=s=>createHash('sha256').update(s).digest('hex');
  fs.writeFileSync(path.join(OUT,'index.snapshot.html'),SRC);const probing=PAUSES.length&&MODES.includes('probe');if(probing)fs.writeFileSync(path.join(OUT,'index.pause-probe.html'),PROBED);
  // fresh=1: each run boots a new game; without it a reload in this tab takes up the game it was playing (#5).
  const hash=`#s=${SEED}&f=${FATE}&c=${COAST}&fresh=1`,PAGE=pathToFileURL(path.join(OUT,'index.snapshot.html')).href+hash,PROBE_PAGE=pathToFileURL(path.join(OUT,'index.pause-probe.html')).href+hash;
  const R={schema:1,started:new Date().toISOString(),indexSHA256:sha(SRC),pauseProbeSHA256:probing?sha(PROBED):null,harnessSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),node:process.version,platform:`${process.platform}/${process.arch}`,cpus:os.cpus().length,
    loadavgStart:os.loadavg(),options:{speeds:SPEEDS,pauseSpeeds:PAUSES,pauseModes:MODES,seconds:SEC,everyMs:EVERY,warmupS:WARM,seed:SEED,fate:FATE,coast:COAST,pauseAtS:PAUSE_AT,naturalTimeoutMs:NAT,learnMs:LEARN},speeds:[],pause:[]};
  const {c,b,kill}=await launch(CHROME),E={exceptions:[],console:[],faults:[]};
  const save=()=>fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(R,null,2));
  try{
    R.chrome=(await b.send('Browser.getVersion')).product;
    await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Performance.enable');
    c.on('Runtime.exceptionThrown',p=>E.exceptions.push((p.exceptionDetails.exception?.description||p.exceptionDetails.text).slice(0,600)));
    c.on('Runtime.consoleAPICalled',p=>{const t=p.args.map(a=>a.value!==undefined?String(a.value):a.description||'').join(' ').slice(0,600);if(p.type==='error')E.console.push(t);if(/Background simulation/.test(t))E.faults.push(t);});
    c.on('Page.javascriptDialogOpening',()=>c.send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{}));
    const ev=x=>c.eval(x);
    const load=async url=>{ // a fresh page, booted, paused, probe installed, nothing in flight
      for(const k in E)E[k].length=0;await c.send('Page.navigate',{url:'about:blank'});await sleep(200);await c.send('Page.navigate',{url});
      const t0=Date.now();while(!await ev(READY).catch(()=>false)){if(E.exceptions.length)throw Error('boot failed: '+E.exceptions[0]);if(Date.now()-t0>BOOT)throw Error('boot timed out');await sleep(250);}
      const bootMs=Date.now()-t0;await ev(PROBE);await ev('setSpeed(0)');await sleep(700);
      const base=await ev(`(async()=>{const s=await BACKGROUND.request('view',{kind:'summary'});const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');
        return{day:s.day,hudDay:day(),speed:s.speed,fgSpeed:speedIdx,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),SPEEDS,labels:Object.fromEntries([...document.getElementById('speedselect').options].map(o=>[o.value,o.textContent])),build:BACKGROUND.options.hash};})()`);
      if(base.speed!==0||base.fgSpeed!==0)throw Error('could not pause before the run: '+JSON.stringify(base));
      if(!R.gpu){R.gpu=base.gpu;if(/SwiftShader|llvmpipe|Software Rasterizer/i.test(base.gpu)&&!A['allow-software']){const e=Error('hardware GPU required; got '+base.gpu);e.exit=2;throw e;}}
      return {...base,bootMs};};
    const metrics=async()=>{const [m,p]=await Promise.all([c.send('Performance.getMetrics'),b.send('SystemInfo.getProcessInfo').catch(()=>null)]),M=Object.fromEntries(m.metrics.map(x=>[x.name,x.value])),cpu=t=>p?p.processInfo.filter(x=>x.type.toLowerCase()===t).reduce((s,x)=>s+x.cpuTime,0):NaN;
      return{wall:Date.now()/1000,ts:M.Timestamp,task:M.TaskDuration,script:M.ScriptDuration,layout:M.LayoutDuration,rend:cpu('renderer'),gpu:cpu('gpu')};};
    const measure=async i=>{
      const base=await load(PAGE),nominal=base.SPEEDS[i];await ev(PROBE);
      let m0=await metrics();const T0=await ev(`(()=>{const t=performance.now();setSpeed(${i});return t;})()`),rows=[],t0=Date.now();
      for(let k=1;k<=Math.round(SEC*1000/EVERY);k++){await sleep(Math.max(0,t0+k*EVERY-Date.now()));const [r,m1]=[await ev(SAMPLE),await metrics()];
        Object.assign(r,{x:(r.t-T0)/1000,busy:100*(m1.task-m0.task)/(m1.ts-m0.ts),script:100*(m1.script-m0.script)/(m1.ts-m0.ts),rendCores:(m1.rend-m0.rend)/(m1.wall-m0.wall),gpuCores:(m1.gpu-m0.gpu)/(m1.wall-m0.wall)});rows.push(r);m0=m1;}
      const log=await ev('({inst:__sc.inst,hud:__sc.hud,fr:__sc.fr})'),fault=await ev("BACKGROUND.fault?.message||(BACKGROUND.closed?'worker closed':null)"),end=rows.at(-1).t;
      const inst=log.inst.filter(x=>x.t>=T0),hud=log.hud.filter(x=>x.t>=T0),fr=log.fr.filter(x=>x[0]>=T0),dur=(end-T0)/1000,warm=rows.filter(r=>r.x>=WARM);
      for(const r of rows)r.hdi=hudDayAt(inst,r.t,base.hudDay); // the foreground day at the sampled instant, from the install log
      const wf=linFit(warm.map(r=>({x:r.x,y:r.wd}))),hf=linFit(warm.map(r=>({x:r.x,y:r.hdi}))),lag=lagStats(warm.map(r=>({wd:r.wd,hd:r.hdi}))),js=jumpStats(inst,dur),
        cj=hud.slice(1).map((h,k)=>h.day-hud[k].day),frs=fr.map(x=>x[1]).sort((a,b)=>a-b);
      return{speed:i,label:base.labels[i],nominalDaysPerSec:nominal,startDay:base.day,bootMs:base.bootMs,seconds:+dur.toFixed(2),
        workerDaysPerSec:wf.slope,workerFitR2:wf.r2,workerDays:rows.at(-1).wd-base.day,hudDaysPerSec:hf.slope,workerSpeedSeen:[...new Set(rows.map(r=>r.ws))],fgSpeedSeen:[...new Set(rows.map(r=>r.hs))],
        lagDays:lag,hud:js,chipRepaints:hud.length,chipMaxJump:cj.length?Math.max(...cj):0,
        mainBusyPct:{mean:mean(warm.map(r=>r.busy)),max:Math.max(...warm.map(r=>r.busy))},scriptPct:mean(warm.map(r=>r.script)),rendererCores:mean(warm.map(r=>r.rendCores)),gpuCores:mean(warm.map(r=>r.gpuCores)),
        fps:fr.length/dur,p95FrameMs:frs[Math.floor(frs.length*.95)]??NaN,worstFrameMs:frs.at(-1)??NaN,rttMs:{mean:mean(rows.map(r=>r.rtt)),max:Math.max(...rows.map(r=>r.rtt))},
        lastChip:rows.at(-1).chip,errors:{exceptions:E.exceptions.slice(),console:E.console.slice(),workerFaults:E.faults.slice(),workerFault:fault},samples:rows};};
    const pauseCheck=async(i,mode)=>{
      await load(mode==='probe'?PROBE_PAGE:PAGE);await ev(PROBE);await ev("(async()=>{await setSovereign(true,0);})()");await sleep(600);const sov=await ev('!!W.player?.on');
      if(mode==='probe')await ev("(async()=>{if(W.player.pause)await runCmd('pause-toggle','');})()"); // petitions stop pausing on their own, so the probe's is the first pause
      let tA=await ev(`(()=>{const t=performance.now();setSpeed(${i});return t;})()`),armed=null;
      if(mode==='probe'){await sleep(PAUSE_AT*1000);armed=await ev("BACKGROUND.request('view',{kind:'audit',action:'speed-check-petition'})");tA=await ev('performance.now()');}
      const polls=[];let pausedAt=null,learnedAt=null;
      for(;;){const r=await ev(`(async()=>{const s=await BACKGROUND.request('view',{kind:'summary'});return{t:performance.now(),wd:s.day,ws:s.speed,hs:speedIdx,btn:document.getElementById('pausebtn').textContent,sel:document.getElementById('speedselect').value,pet:W.petitions.length,rev:G.workerRevision,hd:day()};})()`);
        r.x=r.t-tA;polls.push(r);if(pausedAt===null&&r.ws===0)pausedAt=r.x;if(learnedAt===null&&r.hs===0)learnedAt=r.x;
        if(pausedAt===null&&r.x>(mode==='probe'?10000:NAT))break;if(pausedAt!==null&&(learnedAt!==null&&r.x-pausedAt>=1000||r.x-pausedAt>=LEARN))break;await sleep(100);}
      const after=polls.filter(p=>pausedAt!==null&&p.x>=pausedAt),stopped=pausedAt!==null&&after.every(p=>p.ws===0&&p.wd===after[0].wd),lastP=polls.at(-1),lagMs=pausedAt!==null&&learnedAt!==null?Math.max(0,learnedAt-pausedAt):null;
      return{mode,speed:i,sovereign:sov,armed,armedWhileRunning:armed?armed.speed===i:null,workerPausedAtMs:pausedAt,workerStopped:stopped,workerDay:after[0]?.wd??null,workerDayAfter:lastP.wd,fgLearnedAtMs:learnedAt,fgLearnLagMs:lagMs,fgLearnedWithin2s:lagMs!==null&&lagMs<=2000,
        fgFinal:{speed:lastP.hs,button:lastP.btn,select:lastP.sel,petitions:lastP.pet,day:lastP.hd},observedForMs:pausedAt===null?null:+(lastP.x-pausedAt).toFixed(0),errors:{exceptions:E.exceptions.slice(),console:E.console.slice(),workerFaults:E.faults.slice()},polls};};
    for(const i of SPEEDS){console.log(`measuring speed ${i}...`);R.speeds.push(await measure(i));save();}
    for(const i of PAUSES)for(const m of MODES){console.log(`pause check (${m}) at speed ${i}...`);R.pause.push(await pauseCheck(i,m));save();}
  }catch(e){R.failure=String(e.stack||e);R.exit=e.exit??1;}
  finally{kill();}
  R.loadavgEnd=os.loadavg();R.finished=new Date().toISOString();
  const bad=[...R.speeds,...R.pause].filter(x=>x.errors.exceptions.length||x.errors.console.length||x.errors.workerFaults.length||x.errors.workerFault);R.passed=!R.failure&&!bad.length;
  save();const md=summary(R);fs.writeFileSync(path.join(OUT,'summary.md'),md);console.log('\n'+md+(R.failure?'\nFAILED: '+R.failure+'\n':'')+`\nresults: ${path.join(OUT,'results.json')}`);
  return R.failure?R.exit:R.passed?0:1;
}

export function summary(R){
  const w=(R.speeds.map(s=>s.errors).concat(R.pause.map(p=>p.errors))),n=w.reduce((t,e)=>t+e.exceptions.length+e.console.length+e.workerFaults.length+(e.workerFault?1:0),0);
  let md=`# Speed check\n\nindex.html sha256 ${R.indexSHA256.slice(0,16)}, ${R.chrome}, GPU ${R.gpu}, seed ${R.options.seed} fate ${R.options.fate} ${R.options.coast}; load average at start ${R.loadavgStart.map(x=>x.toFixed(1)).join(' ')}, at end ${(R.loadavgEnd||[]).map(x=>x.toFixed(1)).join(' ')}; ${R.options.seconds} s per speed, fit after ${R.options.warmupS} s.\n\n`;
  md+=`| speed | nominal d/s | worker d/s | HUD d/s | lag mean/max (d) | max HUD jump (d) | HUD packets/s | install ms mean/max | main busy % | renderer cores | fps | worst frame ms | errors |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for(const s of R.speeds)md+=`| ${s.speed} ${s.label} | ${f(s.nominalDaysPerSec,2)} | ${f(s.workerDaysPerSec)} | ${f(s.hudDaysPerSec)} | ${f(s.lagDays.mean)} / ${f(s.lagDays.max,0)} | ${f(s.hud.maxJump,0)} | ${f(s.hud.perSec)} | ${f(s.hud.meanInstallMs)} / ${f(s.hud.maxInstallMs)} | ${f(s.mainBusyPct.mean,0)} | ${f(s.rendererCores,2)} | ${f(s.fps,0)} | ${f(s.worstFrameMs,0)} | ${s.errors.exceptions.length+s.errors.console.length+s.errors.workerFaults.length+(s.errors.workerFault?1:0)} |\n`;
  if(R.pause.length){md+=`\nPause check (the worker pauses itself in petition(); probe: raised ${R.options.pauseAtS} s after setSpeed, natural: first petition on its own, unmodified page):\n\n| mode | speed | worker paused at day | worker stopped | foreground learned | learn lag ms | within 2 s | foreground after ${R.options.learnMs} ms |\n|---|---|---|---|---|---|---|---|\n`;
    for(const p of R.pause)md+=`| ${p.mode}${p.armedWhileRunning===false?' (already paused at arm: invalid)':''} | ${p.speed} | ${p.workerDay??'never'} | ${p.workerPausedAtMs===null?'no pause seen':p.workerStopped?'yes':'NO'} | ${p.fgLearnedAtMs===null?'never':'after '+f(p.fgLearnedAtMs,0)+' ms'} | ${p.fgLearnLagMs===null?'-':f(p.fgLearnLagMs,0)} | ${p.fgLearnedWithin2s?'yes':'NO'} | speed ${p.fgFinal.speed}, button "${p.fgFinal.button}", select ${p.fgFinal.select}, petitions ${p.fgFinal.petitions}, day ${p.fgFinal.day} |\n`;}
  return md+`\nerrors recorded: ${n}\n`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().then(code=>process.exit(code),e=>{console.error(e.stack||e);process.exit(2);});
