#!/usr/bin/env node
/* Storage check: play days of the real game (main-thread reference driver, headless Chrome over DevTools, no dependencies)
   and hold the commodity ledger (v3 numeric balances) to goods conservation. After every day:
   - the game's own audit (tools/inventory-audit.mjs): balances finite and positive, goods accepted, volume within capacity,
     town stock and owner held/sale claims equal the sums of the balances they read;
   - the daily-settlement events replayed by tools/commodity-settlement-reducer.mjs (before/after/delta arithmetic, contiguous
     revisions) and matched to the live facility balances and locations;
   - every balance change attributed to a recorded flow cause; internal movements (transfer, sale, ...) net to zero in a town,
     cross-town movements (settlement-transfer, cargo dispatch/arrival) net to zero in the realm;
   - the realm's total of each good changing only by its recorded flows (production, consumption, spoilage, ...).
   node tools/storage-check.mjs --seed 1001 --coast sea --days 30 --out /tmp/furlong-storage-check
   Options: --seed N  --coast sea|land  --days N (30)  --y AD (850)  --out FRESH_DIR  --chrome PATH  --timeout SECONDS (900)
   Prints a summary, writes results.json to --out, exits 1 on any violation. */
import {spawn} from 'node:child_process';
import {CommoditySettlementReducer} from './commodity-settlement-reducer.mjs';
import {inventoryAudit} from './inventory-audit.mjs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const A=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
if(A.help){console.log(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('/*')[1].split('*/')[0].trim());process.exit(0);}
if(typeof WebSocket!=='function')throw new Error('this Node needs a built-in WebSocket; verified with Node 25.2.1');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),SEED=+(A.seed??1001),COAST=A.coast||'sea',DAYS=+(A.days??30),ERA=+(A.y??850),TIMEOUT=+(A.timeout??900)*1000;
const OUT=path.resolve(A.out||path.join(os.tmpdir(),'furlong-storage-check-'+Date.now()));
const CHROME=A.chrome||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!CHROME)throw new Error('no Chrome found: pass --chrome <path>');
if(!Number.isInteger(SEED)||SEED<0||!['sea','land'].includes(COAST)||!Number.isInteger(DAYS)||DAYS<1||!Number.isInteger(ERA)||ERA<850||ERA>1500||!(TIMEOUT>0))throw new Error('invalid seed, coast, days, era or timeout');
if(fs.existsSync(OUT)&&fs.readdirSync(OUT).length)throw new Error('choose a fresh --out directory');
fs.mkdirSync(OUT,{recursive:true});
const SOURCE=fs.readFileSync(path.join(ROOT,'index.html'));fs.writeFileSync(path.join(OUT,'index.snapshot.html'),SOURCE);

class CDP{ // the least of the DevTools protocol: send a command, await its answer, listen for events
  constructor(url){this.ws=new WebSocket(url);this.n=0;this.wait=new Map();this.subs=new Map();
    this.open=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=e=>rej(new Error('websocket: '+(e.message||'failed')));});
    this.ws.onclose=()=>{for(const w of this.wait.values())w.rej(new Error('Chrome connection closed'));this.wait.clear();};
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.wait.has(m.id)){const w=this.wait.get(m.id);this.wait.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result);}
      else if(m.method)for(const f of this.subs.get(m.method)||[])f(m.params);};}
  send(method,params={}){const id=++this.n;this.ws.send(JSON.stringify({id,method,params}));return new Promise((res,rej)=>this.wait.set(id,{res,rej}));}
  on(method,f){if(!this.subs.has(method))this.subs.set(method,[]);this.subs.get(method).push(f);}}
const ev=async(c,expr)=>{const r=await c.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),active=new Set();
async function launch(){ // a headless Chrome of its own, with a throwaway profile
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-chrome-'));
  const p=spawn(CHROME,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    ...(process.platform==='darwin'?['--use-angle=metal']:[]),'--enable-gpu','--ignore-gpu-blocklist','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  const kill=()=>{active.delete(kill);try{p.kill('SIGKILL');}catch{}try{fs.rmSync(dir,{recursive:true,force:true});}catch{}};active.add(kill);
  try{const ws=await new Promise((res,rej)=>{let buf='';const t=setTimeout(()=>rej(new Error('Chrome did not start')),30000);
      p.stderr.on('data',d=>{buf+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(buf);if(m){clearTimeout(t);res(m[1]);}});p.on('exit',x=>{clearTimeout(t);rej(new Error('Chrome exited '+x));});});
    const list=await (await fetch(`http://127.0.0.1:${new URL(ws).port}/json/list`)).json(),c=new CDP(list.find(t=>t.type==='page').webSocketDebuggerUrl);await c.open;return {c,kill};
  }catch(e){kill();throw e;}}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const kill of active)kill();process.exit(sig==='SIGINT'?130:143);});

/* in the page, before boot: collect the daily-settlement events the game hands its audit observer */
const PRE=`window.requestAnimationFrame=()=>0;window.setInterval=()=>0;window.__sc={ev:[],state:{},audit:${inventoryAudit.toString()}};
window.FURLONG_STORAGE_AUDIT_OBSERVER=e=>{if(e.kind==='storage'&&e.cause==='daily-settlement')__sc.ev.push(e);};`;
/* one day (none for i=0: the initial settlement): tick, settle, audit, and read the ledger's balances directly, independent of its events */
const STEP=i=>`(async()=>{const S=__sc,cmp=(a,b)=>a<b?-1:a>b?1:0,plain=v=>v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(plain):Object.fromEntries(Object.keys(v).sort().map(k=>[k,plain(v[k])]));
  if(${i}>0){while(simTick()===false)await STORAGE_OUTCOMES.wait();if(day()%30===15||day()%360===0)await new Promise(r=>setTimeout(r,0));}
  await STORAGE_OUTCOMES.flush();const events=S.ev.splice(0),touched=new Set(events.map(e=>e.settlement)),totals={},snap=[];let rows=0,legacy=0;
  W.settlements.forEach((s,settlement)=>{const K=s.storage;if(K?.version!==3){if(K)legacy++;return;}const balances=[];
    for(const[id,f]of K.facilities)for(const[good,owners]of f.balances)for(const[owner,kinds]of owners)for(const[availability,quantity]of kinds)if(quantity>0){rows++;totals[good]=(totals[good]||0)+quantity;balances.push({location:id,good,owner:storageOwnerId(owner),availability,quantity});}
    if(${i===DAYS}||touched.has(settlement))snap.push({settlement,locations:[...K.facilities].sort((a,b)=>cmp(a[0],b[0])).map(([id,f])=>({id,metadata:plain(f.metadata)})),balances:balances.sort((a,b)=>cmp(a.location,b.location)||cmp(a.good,b.good)||cmp(a.owner,b.owner)||cmp(a.availability,b.availability))});});
  return {day:day(),events,snap,totals,rows,legacy,errors:errN,issue:S.audit(W.settlements,S.state,BEASTS,STORAGE_GOODS),settlements:W.settlements.length};})()`;

/* what a flow cause may do to goods. Anything not in MADE_OR_LOST only moves them: INTERNAL ones within a town, the rest between towns. */
const MADE_OR_LOST=new Set(['initial','new-good-migration','adjustment','production','consumption','exposure-loss','stored-spoilage','physical-loss','conversion','construction-material','army-provisions','cargo-robbery','cargo-stolen-arrival','cargo-robbery-loss']);
const INTERNAL=new Set(['transfer','purchase','sale','allocation','release','dispatch','facility-refit','facility-destroyed','market-roundoff','local-carriage','deposit','custody-move','inheritance','relief']);
const PAIRED=[['cargo-departure','arrival']]; // a cargo's leaving one ledger and arriving in another are separate causes of one movement
const violations=[],bad=(day,kind,detail)=>{if(violations.length<50)violations.push({day,kind,...detail});else violations.overflow=(violations.overflow||0)+1;};
const sum=(o,k,q)=>{o[k]=(o[k]||0)+q;},tol=(terms,magnitude)=>Number.EPSILON*16*Math.max(1,terms)*(1+magnitude); // rounding of a sum of `terms` quantities
const diff=(want,got)=>{if(want.length!==got.length)return {what:'settlement count',reducer:want.length,live:got.length};
  for(const w of want){const g=got.find(x=>x.settlement===w.settlement);if(!g)return {settlement:w.settlement,what:'missing'};
    if(!isDeepStrictEqual(w.locations,g.locations))return {settlement:w.settlement,what:'locations',reducer:w.locations.find((l,i)=>!isDeepStrictEqual(l,g.locations[i])),live:g.locations.find((l,i)=>!isDeepStrictEqual(l,w.locations[i]))};
    for(let i=0;i<Math.max(w.balances.length,g.balances.length);i++)if(!isDeepStrictEqual(w.balances[i],g.balances[i]))return {settlement:w.settlement,what:'balance',row:i,reducer:w.balances[i],live:g.balances[i]};}
  return null;};

const reducer=new CommoditySettlementReducer(),causes={},results={seed:SEED,coast:COAST,days:DAYS,era:ERA,node:process.version,chrome:CHROME,startedUTC:new Date().toISOString(),
  sourceSHA256:createHash('sha256').update(SOURCE).digest('hex'),harnessSHA256:createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')};
const errs=[],t0=Date.now();let c,kill=()=>{},prev=null,eventCount=0,rowsChecked=0,towns=0;const perDay=[];
try{({c,kill}=await launch());await c.send('Runtime.enable');await c.send('Page.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:PRE});
  c.on('Runtime.exceptionThrown',p=>errs.push((p.exceptionDetails.exception?.description||p.exceptionDetails.text).slice(0,600)));
  // foreground=1 selects the page's main-thread reference driver: under the default worker, simTick() throws.
  await c.send('Page.navigate',{url:pathToFileURL(path.join(OUT,'index.snapshot.html')).href+`#s=${SEED}&f=${SEED}&c=${COAST}&y=${ERA}&foreground=1`});
  while(!await ev(c,"typeof W!=='undefined'&&!!W&&!!W.settlements&&!document.getElementById('loading')&&typeof errN!=='undefined'").catch(()=>false)){if(Date.now()-t0>TIMEOUT)throw new Error('boot timeout');await sleep(250);}
  await ev(c,'setSpeed(0)');
  for(let i=0;i<=DAYS&&violations.length<50;i++){
    if(Date.now()-t0>TIMEOUT)throw new Error('timeout after '+(i-1)+' days');
    const d=await ev(c,STEP(i)),flow={},held={},heldMag={};
    if(d.issue)bad(d.day,'inventory-audit',{issue:d.issue});
    if(d.legacy||i===DAYS&&!d.rows)bad(d.day,'not-commodity-ledger',{legacyTowns:d.legacy,rows:d.rows});
    if(d.errors||errs.length)bad(d.day,'browser-errors',{errors:d.errors,messages:errs.slice(0,3)});
    for(const e of d.events){eventCount++;
      try{reducer.apply(e);}catch(x){bad(d.day,'reducer',{settlement:e.settlement,error:x.message});continue;}
      const rows={},mag={},fl={};for(const r of e.deltas){sum(rows,r.good,r.delta);sum(mag,r.good,Math.abs(r.delta));sum(heldMag,r.good,Math.abs(r.delta));}
      for(const[cause,goods]of Object.entries(e.flows))for(const[g,q]of Object.entries(goods)){sum(fl,g,q);sum(flow,g,q);sum(causes[cause]??={},g,q);
        if(INTERNAL.has(cause)&&Math.abs(q)>tol(e.deltas.length,mag[g]||0))bad(d.day,'internal-flow-nonzero',{settlement:e.settlement,cause,good:g,net:q});
        if(!MADE_OR_LOST.has(cause)&&!INTERNAL.has(cause))sum(held[(PAIRED.find(p=>p.includes(cause))||[cause])[0]]??={},g,q);}
      for(const g of new Set([...Object.keys(rows),...Object.keys(fl)]))if(Math.abs((rows[g]||0)-(fl[g]||0))>tol(e.deltas.length,(mag[g]||0)*2))bad(d.day,'unattributed-change',{settlement:e.settlement,good:g,balances:rows[g]||0,flows:fl[g]||0});}
    for(const[cause,goods]of Object.entries(held))for(const[g,q]of Object.entries(goods))if(Math.abs(q)>tol(d.rows,heldMag[g]||0))bad(d.day,'movement-not-conserved',{cause,good:g,net:q,note:'a cause that moves goods between towns must net to zero in the realm; declare goods-making causes in MADE_OR_LOST'});
    const touched=new Set(d.events.map(e=>e.settlement)),mismatch=diff(reducer.snapshot().filter(r=>i===DAYS||touched.has(r.settlement)).map(({settlement,locations,balances})=>({settlement,locations,balances})),d.snap);
    if(mismatch)bad(d.day,'reducer-vs-live-balances',mismatch);
    if(prev)for(const g of new Set([...Object.keys(prev.totals),...Object.keys(d.totals),...Object.keys(flow)])){const was=prev.totals[g]||0,now=d.totals[g]||0;
      if(Math.abs(now-was-(flow[g]||0))>tol(Math.max(d.rows,prev.rows),Math.abs(was)+Math.abs(now)+(heldMag[g]||0)))bad(d.day,'realm-total-vs-flows',{good:g,was,now,change:now-was,flows:flow[g]||0});}
    towns=d.settlements;prev=d;rowsChecked+=d.rows;perDay.push({day:d.day,events:d.events.length,rows:d.rows});
    if(i%10===0||i===DAYS)console.log(`day ${d.day} (${i}/${DAYS}): ${d.events.length} settlements settled, ${d.rows} balance rows, ${violations.length} violations`);
  }
  results.lastTotals=prev?.totals;
}catch(e){bad(null,'harness',{error:e.stack});}
finally{kill();}
Object.assign(results,{pass:!violations.length,violations,overflow:violations.overflow||0,settlements:towns,daysChecked:perDay.length-1,settlementDaysSettled:eventCount,balanceRowsAudited:rowsChecked,
  realmFlowsByCause:causes,perDay,elapsedSec:Math.round((Date.now()-t0)/1000)});
fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,1));
const top=Object.entries(causes).map(([k,v])=>[k,Object.values(v).reduce((a,b)=>a+b,0)]).filter(x=>Math.abs(x[1])>=0.5).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8).map(([k,v])=>`${k} ${v>0?'+':''}${v.toFixed(0)}`).join(', ');
console.log(`storage check seed ${SEED} ${COAST}: ${results.daysChecked} days, ${towns} towns, ${eventCount} settlement events, ${rowsChecked} balance rows audited, ${results.elapsedSec} s`);
console.log(`net units by cause, largest: ${top}`);
console.log(violations.length?`FAIL ${violations.length}${results.overflow?'+'+results.overflow:''} violations, first: ${JSON.stringify(violations[0]).slice(0,400)}`:'PASS: goods conserved and balances sane every day');
console.log('results: '+path.join(OUT,'results.json'));
process.exit(violations.length?1:0);
