#!/usr/bin/env node
/* Session resume check, in an owned headless Chrome on the worker build (the real index.html, file://).
   1. A refresh resumes the tab's game (#5): seed/fate/coast as given, take the crown, change the tax, give relief, play on
      at reel speed to --days, pause; the worker's authoritative audit (day, world-graph SHA-256, RNG, ledger revisions,
      outcome sequence, journal) is taken; Page.reload; the same audit after the resume must match exactly.
   2. Another realm in the same tab (a different seed in the link) does not resume.
   3. A save made right after a goods command (relief) reloads with the same ledger revision counters (#25).
   The worker's audit view is added by wrapping Blob in the page (the worker's source is the page's own script); the
   game's file is not changed. node tools/session-resume-check.mjs --out /tmp/session-check [--days 400 --seed 1001 --fate 42 --coast sea] */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
const OUT=path.resolve(args.out||path.join(os.tmpdir(),'furlong-session-check-'+Date.now()));fs.mkdirSync(OUT,{recursive:true});
const SOURCE=path.resolve(args.source||path.join(ROOT,'index.html')),PAGE=pathToFileURL(SOURCE).href;
const seed=+(args.seed||1001),fate=+(args.fate||42),coast=args.coast||'sea',days=+(args.days||400),bootTimeout=+(args['boot-timeout']||600)*1000;
const HASH=`#s=${seed}&f=${fate}&c=${coast}&y=850`,OTHER=`#s=${seed+1}&f=${fate}&c=${coast}&y=850`;
const CHROME=args.chrome||process.env.CHROME||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!CHROME)throw Error('Chrome or Chromium was not found');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// The worker's audit: the same world-graph digest the replay investigations used, plus RNG, ledger revisions and the journal.
const AUDIT=`
globalThis.FURLONG_WORKER_AUDIT=async()=>{const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
 const graph=new HistoryGraph(),frame=graph.capture(W,{skipQueryScratch:true});
 const worldSHA256=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({root:frame.root,state:[...graph.state],code:graph.code}))));
 return{day:day(),ad:AD(),worldSHA256,rng:Object.fromEntries(Object.entries(RS).map(([k,r])=>[k,r.state()])),settlementRevisions:W.settlements.map(s=>s.storage?.settlementRevision??null),
  storageSeq:STORAGE_OUTCOMES.journal.seq,journal:JOURNAL.map(e=>({...e})),treasury:W.treasury,households:W.households.size,tax:MOD.tax,player:{...W.player,amb:undefined,cd:undefined},speed:speedIdx};};
`;
const INJECT=`(()=>{const B=window.Blob,AUDIT=${JSON.stringify(AUDIT)};
 window.Blob=class extends B{constructor(parts,options){if(Array.isArray(parts)&&parts.at(-1)==='\\nsimulationWorkerRuntime();')parts=[...parts.slice(0,-1),AUDIT,parts.at(-1)];super(parts,options);}};})();`;

class CDP{
  constructor(url){this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.open=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data),p=this.pending.get(m.id);if(p){this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))logs.push(m.params.type+': '+m.params.args.map(a=>a.value??a.description).join(' '));};
    this.ws.onclose=()=>{for(const p of this.pending.values())p.reject(Error('Chrome closed'));this.pending.clear();};}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression,ms=120000){let timer;const r=await Promise.race([this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('evaluate timed out: '+expression.slice(0,120))),ms);})]).finally(()=>clearTimeout(timer));
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
}
const errors=[],logs=[],result={seed,fate,coast,days,source:SOURCE,started:new Date().toISOString(),stages:{},passed:false};
let child,cdp,profile;
function cleanup(){try{cdp?.ws.close();}catch{}try{child?.kill('SIGKILL');}catch{}if(profile)fs.rmSync(profile,{recursive:true,force:true});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup();process.exit(130);});
async function launch(){
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-session-profile-'));
  child=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',...(process.platform==='darwin'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader']),'--window-size=1280,800','about:blank'],{stdio:['ignore','ignore','pipe']});
  const ws=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timed out')),60000);child.stderr.on('data',d=>{text+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(text);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('error',reject);});
  const tabs=await(await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json();cdp=new CDP(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await cdp.open;
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:INJECT});
}
async function waitFor(expression,label,limit=bootTimeout){const until=Date.now()+limit;while(Date.now()<until){try{const v=await cdp.eval(expression,15000);if(v)return v;}catch{}if(errors.length)throw Error(label+': '+errors.join('\n'));await sleep(500);}throw Error(label+' timed out');}
const booted=`!window.__left&&document.getElementById('loading')===null&&typeof renderer!=='undefined'&&!!renderer&&!!W&&!!BACKGROUND&&!!G.workerRevision`;
const leave=()=>cdp.eval('window.__left=1'); // the next document lacks the mark: a wait cannot be satisfied by the page being left
const audit=()=>cdp.eval("BACKGROUND.request('view',{kind:'audit'})");
const session=()=>cdp.eval("(()=>{const e=JSON.parse(sessionStorage.getItem('furlong-session')||'null'),d=JSON.parse(sessionStorage.getItem('furlong-session-day')||'null');return e&&{n:e.n,hash:e.record.hash,recordDay:e.record.day,commands:e.record.j.length,journal:e.record.j,day:d&&d.n===e.n?d.day:null};})()");
const same=(a,b,keys)=>Object.fromEntries(keys.map(k=>[k,JSON.stringify(a[k])===JSON.stringify(b[k])]));
const KEYS=['day','ad','worldSHA256','rng','settlementRevisions','storageSeq','journal','treasury','households','tax','player'];
function stage(name,value){result.stages[name]=value;fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));console.error(name,JSON.stringify(value).slice(0,300));}
const crown=async()=>{await cdp.eval('setSpeed(0)');await cdp.eval('setSovereign(true,0)');await sleep(300);if((await audit()).player.pause)await cdp.eval("runCmd('pause-toggle','')");}; // petitions must not stop the reel
async function playTo(target){await cdp.eval('setSpeed(5)');await waitFor(`(async()=>(await BACKGROUND.request('view',{kind:'summary'})).day>=${target})()`,'reel to day '+target);await cdp.eval('setSpeed(0)');await sleep(1500);} // the 1 s storage flush and the session's last writes

try{
  await launch();
  // 1. a new game: crown, tax, relief, play on, pause
  await cdp.send('Page.navigate',{url:PAGE+HASH});await waitFor(booted,'first boot');
  const first=await cdp.eval('({resumed:RESUMED,day:day(),ad:AD(),hash:location.hash})');stage('boot',first);
  if(first.resumed||first.day>3)throw Error('a new tab must begin a new game');
  await crown();
  await cdp.eval("(async()=>{const i=document.querySelector('#sovtax-number');if(!i)throw Error('tax control missing');i.value='17';i.dispatchEvent(new Event('change',{bubbles:true}));for(let k=0;k<80;k++){if((await BACKGROUND.request('view',{kind:'audit'})).tax===17)return;await new Promise(r=>setTimeout(r,25));}throw Error('tax did not reach the worker');})()");
  const town=await cdp.eval('W.settlements.findIndex(s=>s.owner===0)');
  await playTo(40);await cdp.eval(`runCmd('s-relief','${town}')`);await sleep(1500);
  await playTo(days);
  const before=await audit(),beforeSession=await session(),beforeScreen=await cdp.eval('({day:day(),ad:AD()})');
  stage('before-refresh',{day:before.day,ad:before.ad,worldSHA256:before.worldSHA256,revisions:before.settlementRevisions.reduce((t,v)=>t+(v||0),0),storageSeq:before.storageSeq,journal:before.journal,screen:beforeScreen,session:{...beforeSession,journal:undefined}});
  if(!beforeSession||beforeSession.day!==before.day||JSON.stringify(beforeSession.journal)!==JSON.stringify(before.journal))throw Error('the tab session does not hold the worker’s game: '+JSON.stringify({beforeSession,day:before.day,journal:before.journal}));
  // the refresh
  errors.length=0;const t0=Date.now();await leave();await cdp.send('Page.reload',{});await waitFor(booted+'&&RESUMED','refresh resume');
  const after=await audit(),afterBoot=await cdp.eval('({resumed:RESUMED,resumeDay:BACKGROUND.options.resumeDay,resume:!!BACKGROUND.options.resume,day:day(),ad:AD(),speed:speedIdx,hash:location.hash})');
  const match=same(before,after,KEYS);stage('after-refresh',{ms:Date.now()-t0,boot:afterBoot,day:after.day,ad:after.ad,worldSHA256:after.worldSHA256,match});
  if(!afterBoot.resumed||after.day!==before.day||Object.values(match).some(v=>!v))throw Error('the refresh did not resume the same game');
  if(after.ad===850)throw Error('the refresh restarted at AD 850');
  // 2. another realm in the same tab: a new game, and the old entry gone
  errors.length=0;await leave();await cdp.send('Page.navigate',{url:PAGE+OTHER});await waitFor(`${booted}&&location.hash.includes('s=${seed+1}&')`,'other realm boot');
  const other=await cdp.eval('({resumed:RESUMED,day:day(),ad:AD(),hash:location.hash})');await sleep(1000);const otherSession=await session();
  stage('other-realm',{...other,session:otherSession&&{hash:otherSession.hash,day:otherSession.day,commands:otherSession.commands}});
  if(other.resumed||other.day>3||!otherSession||!otherSession.hash.includes(`s=${seed+1}&`))throw Error('another realm must not resume the old game');
  // 3. a save made right after a goods command reloads with the same ledger revisions
  await crown();await playTo(20);
  const town2=await cdp.eval('W.settlements.findIndex(s=>s.owner===0)');
  const saved=await cdp.eval(`(async()=>{await runCmd('s-relief','${town2}');const o=await saveNow('relief check',false);window.__saved=o;return o&&{day:o.day,j:o.j};})()`);
  const atSave=await audit();
  stage('save-after-relief',{day:saved.day,journalTail:saved.j.slice(-3),revisions:atSave.settlementRevisions,storageSeq:atSave.storageSeq,worldSHA256:atSave.worldSHA256});
  if(saved.j.at(-1)?.k!=='settle'||saved.j.at(-2)?.c!=='s-relief')throw Error('the relief’s early settlement was not journaled: '+JSON.stringify(saved.j.slice(-3)));
  errors.length=0;await leave();await cdp.eval('resumeSave(window.__saved)').catch(()=>{});await waitFor(booted+"&&RESUMED&&!!BACKGROUND.options.resume",'save reload');
  const loaded=await audit(),loadMatch=same(atSave,loaded,KEYS);
  stage('save-reloaded',{day:loaded.day,revisions:loaded.settlementRevisions,storageSeq:loaded.storageSeq,worldSHA256:loaded.worldSHA256,match:loadMatch});
  if(Object.values(loadMatch).some(v=>!v))throw Error('the save after relief reloaded differently');
  // and a refresh of that loaded game resumes it too (the opened save became the tab's game)
  errors.length=0;await leave();await cdp.send('Page.reload',{});await waitFor(booted+'&&RESUMED','refresh after load');
  const again=await audit();stage('loaded-then-refreshed',{day:again.day,worldSHA256:again.worldSHA256,match:same(atSave,again,KEYS)});
  if(Object.values(same(atSave,again,KEYS)).some(v=>!v))throw Error('a refresh of the loaded game differs');
  result.passed=true;
}catch(e){result.error=String(e.stack||e);}finally{result.errors=errors;result.logs=logs.slice(-40);result.finished=new Date().toISOString();fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(result,null,2));cleanup();}
console.log(JSON.stringify({passed:result.passed,error:result.error,out:OUT,stages:Object.fromEntries(Object.entries(result.stages).map(([k,v])=>[k,{...v,journal:undefined}]))},null,1));
process.exitCode=result.passed?0:1;
