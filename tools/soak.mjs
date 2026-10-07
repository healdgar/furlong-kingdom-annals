#!/usr/bin/env node
/* Soak: play several worlds headless for decades or centuries and check them, so every change to the simulation
   can be tried against more than one history. Each world runs in its own headless Chrome, driven over the DevTools
   protocol (no dependencies: Node with a built-in WebSocket, and a Chrome or Chromium).

   Each simulated year it records: sim errors; population, households and places; famine (place-days, onsets,
   hunger weighted by people); food and tilled land per head; money in every purse against the money the flow book
   says came in, went out, was declared prepaid or paid to nobody (the residual is a mismatch between purse changes and the flow book);
   walls far wider than their towns; deserted houses; time per day and per part of the day (each tick timed);
   heap. CPU profiles of the first, middle and last years (by default) rank the functions and the parts of the day
   by CPU in ms per simulated day; each world's ranking joins a running hot list (tools/soak-results/hotlist.json),
   and the summary shows the top ten with the change since that world's previous run.

   node tools/soak.mjs --seeds 11,22,33 --coast sea,land --years 100 --par 6 --out /tmp/soak
   Options: --seeds a,b  --coast sea,land (each seed once per coast; omit for the seed's own)  --years N  --par N
            --fate N (override fate seed)  --km N  --y AD (start year: older history replayed first)  --profile year,year (0: none)  --profile-interval µs (1000)  --hotlist file (0: none)  --render years (draw at these years: 0 is the start)  --devices laptop,phone  --cpu 1,4 (CPU slowdown for drawing)
            --speeds 1,4,5  --boot-cpu N (boot under a slower CPU)  --audit N (pin unrecorded money to the part of the day
            that makes or loses it, for the first N days of each year in --audit-years)  --audit-years 1,19 | all (default 1)  --audit-fns a,b (also attribute these global functions, nested inside the ticks)  --inventory 1 (independent daily matching)  --out dir  --chrome path
   Drives the main-thread reference simulation (foreground=1); --render frame costs are the reference driver's, not the worker's. */
import {spawn,execFileSync} from 'node:child_process';
import {moneyFlowGap} from './money-flow.mjs';
import {inventoryAudit} from './inventory-audit.mjs';
import {finishJournal,assertJournalComplete} from './soak-journal.mjs';
import {DAY_PARTS,scoreProfile,compactScore,formatScore,updateHotlist,hotlistReport} from './cpu-score.mjs';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const A=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
if(typeof WebSocket!=='function')throw new Error('this Node needs a built-in WebSocket; verified with Node 25.2.1');
if(A.help){console.log(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('/*')[1].split('*/')[0].trim());process.exit(0);}
const seeds=(A.seeds||'688673834').split(',').map(Number),coasts=A.coast?A.coast.split(','):[null];
const YEARS=+(A.years||50),PAR=+(A.par||Math.max(1,Math.min(6,os.cpus().length>>1))),KM=A.km?+A.km:null,Y0=A.y?+A.y:null;
const RENDER=A.render!==undefined?new Set(A.render.split(',').map(Number)):null,DEVICES=(A.devices||'laptop,phone').split(','),CPUS=(A.cpu||'1,4').split(',').map(Number),SPEEDS_=(A.speeds||'1,4,5').split(',').map(Number),BOOTCPU=+(A['boot-cpu']||1);
const AUDIT=+(A.audit||0),AUDITY=A['audit-years']==='all'?null:new Set((A['audit-years']||'1').split(',').map(Number)),AUDITFNS=(A['audit-fns']||'').split(',').filter(Boolean),PROFILE=new Set((A.profile||[1,Math.ceil(YEARS/2),YEARS].join(',')).split(',').map(Number)),PROFILE_US=+(A['profile-interval']||1000);
const OUT=path.resolve(A.out||path.join(os.tmpdir(),'furlong-soak-'+new Date().toISOString().replace(/[:.]/g,'-')));
const CHROME=A.chrome||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
if(!CHROME){console.error('no Chrome found: pass --chrome <path>');process.exit(2);}
if(!Number.isInteger(YEARS)||YEARS<0||!Number.isInteger(PAR)||PAR<1||seeds.some(s=>!Number.isInteger(s)||s<0||s>0xffffffff)||new Set(seeds).size!==seeds.length||new Set(coasts).size!==coasts.length||coasts.some(c=>c&&!['sea','land'].includes(c)))throw new Error('invalid years, parallelism, seeds or coast');
if(fs.existsSync(OUT)&&fs.readdirSync(OUT).some(n=>/\.(jsonl|cpuprofile)$/.test(n)))throw new Error('output already contains a run; choose a fresh --out directory');
if(CPUS.some(n=>!(n>=1))||DEVICES.some(d=>!['laptop','phone'].includes(d))||SPEEDS_.some(n=>!Number.isInteger(n)||n<0||n>5)||RENDER&&[...RENDER].some(n=>!Number.isInteger(n)||n<0||n>YEARS))throw new Error('invalid rendering options');
fs.mkdirSync(OUT,{recursive:true});
const SOURCE=fs.readFileSync(path.join(ROOT,'index.html'));fs.writeFileSync(path.join(OUT,'index.snapshot.html'),SOURCE);
const HOTLIST=A.hotlist==='0'?null:path.resolve(A.hotlist||path.join(ROOT,'tools/soak-results/hotlist.json'));
const COMMIT=(()=>{try{const sha=execFileSync('git',['-C',ROOT,'rev-parse','--short','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();
  const dirty=execFileSync('git',['-C',ROOT,'status','--porcelain','--','index.html'],{stdio:['ignore','pipe','ignore']}).toString().trim();return sha+(dirty?'+dirty':'');}catch{return null;}})();
const PAGE=pathToFileURL(path.join(OUT,'index.snapshot.html')).href;
const provenance={schema:2,startedUTC:new Date().toISOString(),harnessSHA256:createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),sourceSHA256:createHash('sha256').update(SOURCE).digest('hex'),node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,chrome:CHROME,args:process.argv.slice(2)};
fs.writeFileSync(path.join(OUT,'run.json'),JSON.stringify(provenance,null,2));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);

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

/* what runs in the page: stop the frame loop, time every tick, and play a year at a time, measuring as it goes */
const HARNESS=`(()=>{if(window.__soak)return 'ok';
  const RAF=window.__soakRAF||window.requestAnimationFrame.bind(window);setSpeed(0);window.requestAnimationFrame=()=>0; // the soak drives the days itself; nothing is drawn (until S.draw)
  const S={T:{},F:{fishProduced:0,fishBought:0,grainBought:0,fishEaten:0,grainEaten:0,hungryWithFoodDays:0,hungryWithFishDays:0},foodExamples:[],R:{calls:0,cold:0,unreachable:0}},route0=window.route;
  window.route=function(ai,bi,sea){S.R.calls++;if(!W.routes[ai+'_'+bi+(sea?'s':'')])S.R.cold++;const r=route0.apply(this,arguments);if(!r)S.R.unreachable++;return r;};
  const made0=window.made,clear0=window.clearMarket,pop0=window.tickPopulation;
  window.made=function(s,g,q){if(g==='fish'&&q>0)S.F.fishProduced+=q;return made0.apply(this,arguments);};
  window.clearMarket=function(s,g){const r=clear0.apply(this,arguments);if(g==='fish'||g==='grain')S.F[g+'Bought']+=r.reduce((t,q)=>t+q,0);return r;};
  window.tickPopulation=function(){const before=W.settlements.map(s=>[s.stores.fish||0,s.stores.grain||0]);const r=pop0.apply(this,arguments);
    W.settlements.forEach((s,i)=>{S.F.fishEaten+=Math.max(0,before[i][0]-(s.stores.fish||0));S.F.grainEaten+=Math.max(0,before[i][1]-(s.stores.grain||0));
      if(s.hunger>0.4&&s.pop>100){const need=Math.max(0,s.pop*(NEED.grain+NEED.fish)-(s._homeDay||0));
        if(s.stores.fish+s.stores.grain>=need)S.F.hungryWithFoodDays++;
        if(s.stores.fish>=need){S.F.hungryWithFishDays++;if(S.foodExamples.length<8&&!S.foodExamples.some(x=>x.name===s.name))S.foodExamples.push({name:s.name,ad:AD(),day:day(),pop:Math.round(s.pop),hunger:s.hunger,fish:s.stores.fish,grain:s.stores.grain,larderFish:s._lard?.fish||0,larderGrain:s._lard?.grain||0});}}});return r;};
  S.E={crown0:null,houses0:null,crownLow:null,housesLow:null,px:{n:0,g:0,f:0,gC:0,fC:0,nC:0},led:{grain:{produced:0,eaten:0,rotted:0,relief:0,carted:0},fish:{produced:0,eaten:0,rotted:0,relief:0,carted:0}},poor:{n:0,souls:0,coinless:0,coinlessHunger:0,capital:0,capitalHunger:0,hunger:0}}; // the economy, read from outside the simulation (#23)
  if(typeof CommodityBalanceLedger==='function'){const PR=CommodityBalanceLedger.prototype,set0=PR._set;PR._set=function(fac,loc,good,owner,av,after,cause){if(good==='grain'||good==='fish'){const d=after-(fac.balances.get(good)?.get(owner)?.get(av)||0),T=S.E.led[good];
    if(cause==='production')T.produced+=d;else if(cause==='consumption')T.eaten-=d;else if(cause==='exposure-loss'||cause==='stored-spoilage')T.rotted-=d;else if(cause==='relief'&&d>0)T.relief+=d;else if(cause==='dispatch'&&av==='transit'&&d>0)T.carted+=d;}return set0.apply(this,arguments);};}
  const housesGold=()=>{let t=0;for(let i=1;i<W.houses.length;i++)if(W.houses[i])t+=W.houses[i].gold||0;return t;};
  S.econDay=()=>{if(S.E.crown0===null){S.E.crown0=W.treasury;S.E.houses0=housesGold();}
    if(S.E.crownLow===null&&W.treasury<0.05*S.E.crown0)S.E.crownLow=day();if(S.E.housesLow===null&&housesGold()<0.05*S.E.houses0)S.E.housesLow=day();
    if(day()%30===0){let n=0,g=0,f=0;for(const s of W.settlements){const P=s.px||{};if(P.grain>0&&P.fish>0&&s.pop>0){n+=s.pop;g+=P.grain*s.pop;f+=P.fish*s.pop;}}
      if(n>0){S.E.px.n++;S.E.px.g+=g/n;S.E.px.f+=f/n;}const C=W.capital?.px;if(C&&C.grain>0&&C.fish>0){S.E.px.nC++;S.E.px.gC+=C.grain;S.E.px.fC+=C.fish;}
      if(W.households){const Q=S.E.poor;Q.n++;for(const s of W.settlements)for(const h of s.households||[]){const k=h.population?.get(s)||0;if(!(k>0))continue;const hu=h.hunger||0;Q.souls+=k;Q.hunger+=hu*k;if(!((h.assets?.w||0)>0)){Q.coinless+=k;Q.coinlessHunger+=hu*k;}if(s===W.capital){Q.capital+=k;Q.capitalHunger+=hu*k;}}}}};
  S.econYear=()=>{const E=S.E,L=JSON.parse(JSON.stringify(E.led)),px=E.px;let b=0,mead=0,field=0;for(const s of W.settlements)for(const x of s.buildings||[])if(x.state==='sound'&&!x.removed)b++;
    const LAND=W.land||G.land;if(LAND&&LAND.F)for(const f of LAND.F)if(f.state===LS.TILLED){if(f.kind===LK.MEADOW)mead++;else if(ARABLE.has(f.kind))field++;}
    const r={crown:Math.round(W.treasury),houses:Math.round(housesGold()),crown0:Math.round(E.crown0),houses0:Math.round(E.houses0),crownLowDay:E.crownLow,housesLowDay:E.housesLow,
      pxGrain:px.n?+(px.g/px.n).toFixed(3):null,pxFish:px.n?+(px.f/px.n).toFixed(3):null,pxGrainCapital:px.nC?+(px.gC/px.nC).toFixed(3):null,pxFishCapital:px.nC?+(px.fC/px.nC).toFixed(3):null,
      buildings:b,households:W.households?W.households.size:null,meadow:mead,field,grain:Object.fromEntries(Object.entries(L.grain).map(([k,v])=>[k,Math.round(v)])),fish:Object.fromEntries(Object.entries(L.fish).map(([k,v])=>[k,Math.round(v)]))};
    {const Q=E.poor,purse={capital:0,town:0,village:0},souls={capital:0,town:0,village:0};let carters=0;if(W.households)for(const h of W.households.values()){const hd=h.head;if(!hd||hd.dead)continue;const t=W.settlements[hd.si];if(!t)continue;const k=t===W.capital?'capital':t.kind==='village'?'village':'town';purse[k]+=Math.max(0,h.assets?.w||0);let n=0;for(const v of h.population?.values()||[])n+=v;souls[k]+=n;if(hd.tr==='carter'||hd.tr==='boatman')carters++;}
      r.coinlessShare=Q.souls?+(Q.coinless/Q.souls).toFixed(3):null;r.coinlessHunger=Q.coinless?+(Q.coinlessHunger/Q.coinless).toFixed(3):null;r.capitalHunger=Q.capital?+(Q.capitalHunger/Q.capital).toFixed(3):null;r.otherHunger=Q.souls-Q.capital>0?+((Q.hunger-Q.capitalHunger)/(Q.souls-Q.capital)).toFixed(3):null;
      r.pursePerSoul=Object.fromEntries(Object.keys(purse).map(k=>[k,souls[k]?+(purse[k]/souls[k]).toFixed(2):null]));r.carters=carters;}
    E.px={n:0,g:0,f:0,gC:0,fC:0,nC:0};E.led={grain:{produced:0,eaten:0,rotted:0,relief:0,carted:0},fish:{produced:0,eaten:0,rotted:0,relief:0,carted:0}};E.poor={n:0,souls:0,coinless:0,coinlessHunger:0,capital:0,capitalHunger:0,hunger:0};return r;};
  const A0=()=>({hostDays:0,campDays:0,longestCamp:0,march:{},marchFailed:{},objectiveFailed:0,objectiveRepeat:0,noted:0,raftsLords:0,raftsPlayer:0,ships:0,cannotReach:0,loses:0,noShips:0,camps:[],wars:[],feudsBegun:0,feudsEnded:0});
  S.A=A0();const campRun=new Map(),lastFail=new Map();let cause=null,feuds0=[]; // the war, read from outside the simulation (#33): wrappers count and pass every call through unchanged
  const wrapA=(n,f)=>{const o=window[n];if(typeof o==='function')window[n]=f(o);},as=c=>o=>function(){const c0=cause;cause=c;try{return o.apply(this,arguments);}finally{cause=c0;}};
  wrapA('chaseStep',as('chase'));wrapA('orderArmy',as('order'));wrapA('orderArmyTo',as('order'));
  wrapA('marchArmy',o=>function(a,t){const s=W.settlements[t],k=cause||(a.house===plyH()?'order':t===a.home?'home':s&&s.owner===a.house?(a.supply<18?'hungry':'own'):'objective'),r=o.apply(this,arguments),A=S.A;
    A.march[k]=(A.march[k]||0)+1;if(r===false){A.marchFailed[k]=(A.marchFailed[k]||0)+1;if(k==='objective'){A.objectiveFailed++;const key=a.id+':'+t,d=lastFail.get(key);if(d!=null&&day()-d<=90)A.objectiveRepeat++;lastFail.set(key,day());}}return r;});
  wrapA('routHome',o=>function(){S.A.march.home=(S.A.march.home||0)+1;return o.apply(this,arguments);});
  wrapA('armyNoWayNote',o=>function(){S.A.noted++;return o.apply(this,arguments);});
  wrapA('buildArmyRaft',o=>function(a){const r=o.apply(this,arguments);if(r===true){if(a.house===plyH())S.A.raftsPlayer++;else S.A.raftsLords++;}return r;});
  wrapA('endWar',o=>function(res){const w=W.war,r=o.apply(this,arguments);if(w)S.A.wars.push({name:w.name,day:day(),result:res,months:Math.round((day()-w.start)/30)});return r;});
  wrapA('startFeud',o=>function(){S.A.feudsBegun++;return o.apply(this,arguments);});
  wrapA('emit',o=>function(cat,pri,pos,text){if(cat==='war'&&typeof text==='string'){const A=S.A;if(text.includes(' takes ship for ')||text.startsWith('Cogs are hired at ')||text.includes(' embarks, horses and all'))A.ships++;
    if(text.includes(' cannot reach '))A.cannotReach++;if(text.includes('cannot pay for the ships'))A.noShips++;if(text.includes(' loses ')&&text.includes(': no passable way'))A.loses++;}return o.apply(this,arguments);});
  S.armyDay=()=>{const A=S.A;for(const a of W.armies){if(a.gone)continue;A.hostDays++;if(a.state==='idle'&&a.field&&!a.hold){const n=(campRun.get(a.id)||0)+1;campRun.set(a.id,n);A.campDays++;if(n>A.longestCamp)A.longestCamp=n;if(n===30&&A.camps.length<12){const h=W.settlements[a.home],t=W.settlements[a.at],p=a._spos||a.field;A.camps.push({day:day(),id:a.id,house:a.house,atWar:houseAtWar(a.house)?1:0,fit:fitToCampaign(a)?1:0,rebel:inRebellion(a)?1:0,supply:Math.round(a.supply),strength:Math.round(a.strength),why:a.why||null,station:t?t.name:null,stationOwn:t&&t.owner===a.house?1:0,fromStation:t?Math.round(dist2d(p.x,p.z,t.pos.x,t.pos.z)):null,homeOwn:h&&h.owner===a.house?1:0,fromHome:h?Math.round(dist2d(p.x,p.z,h.pos.x,h.pos.z)):null,noWay:(a._noWay||[]).length,holdUntil:Math.max(0,(a.holdUntil||0)-day()),homeAfter:Math.max(0,(a._homeAfter||0)-day()),raft:a.raft?1:0});}}else campRun.set(a.id,0);}
    const F=W.feuds||[];for(const f of feuds0)if(!F.includes(f))A.feudsEnded++;feuds0=F.slice();};
  S.armyYear=()=>{const A=S.A,r={...A,hostYears:+(A.hostDays/360).toFixed(2)};S.A=A0();S.A.longestCamp=0;return r;};
  const TICKS=${JSON.stringify(DAY_PARTS.concat(AUDITFNS.filter(f=>!DAY_PARTS.includes(f))))};
  for(const n of TICKS){const f=window[n];if(typeof f!=='function')continue;window[n]=function(){
    const m0=S.audit?money().t:0,f0=S.audit?flows():null,t=performance.now(); // the purse census is not the part's own time
    try{return f.apply(this,arguments);}finally{S.T[n]=(S.T[n]||0)+performance.now()-t;
      if(S.audit){const r=money().t-m0-gap(f0,flows()).expect;if(Math.abs(r)>1e-6){const L=S.L[n]||(S.L[n]={r:0,days:0,first:[]});L.r+=r;L.days++;if(L.first.length<4)L.first.push([day(),+r.toFixed(6)]);}}}};}
  S.L={};S.D=[]; // S.D: the days whose census change the flow book did not explain (whole days, every year)
  S.inventory={enabled:${Number(A.inventory||0)>0},first:null,checks:0};const checkInventory=${inventoryAudit.toString()};
  const auditInventory=()=>{if(!S.inventory.enabled||S.inventory.first)return;const issue=checkInventory(W.settlements,S.inventory,BEASTS,typeof STORAGE_GOODS==='undefined'?{}:STORAGE_GOODS);if(issue)S.inventory.first={day:day(),...issue};};
  const gap=${moneyFlowGap.toString()};
  const money=()=>{let bad=0;const coin=v=>{if(v!==undefined&&!Number.isFinite(v))bad++;return v??0;};const by={crown:coin(W.treasury),houses:0,folk:0,church:0,murage:0,pool:0,hoard:coin(W.dragon?.hoard),escrow:0},seen=new Set(),P=p=>{if(!p||p.merc||W.households&&p._hh)return;if(seen.has(p))return;seen.add(p);by.folk+=coin(p.w);}; // folk in a household are counted with it: skip them before the set
    if(W.households)for(const h of W.households.values())by.folk+=coin(h.assets.w);
    for(let i=1;i<W.houses.length;i++)if(W.houses[i])by.houses+=coin(W.houses[i].gold);
    for(const s of W.settlements){for(const p of s.folk||[])P(p);by.murage+=coin(s.murage);by.pool+=coin(s._poolCash);for(const v of Object.values(s._poolBy||{}))by.pool+=coin(v);}
    for(const a of W.armies||[])for(const p of a.men||[])P(p);for(const t of W.travellers||[])P(t&&t.p?t.p:t);for(const l of W.levies||[])P(l&&l.p?l.p:l);
    const chs=new Set();for(const b of W.bldList)if(b&&b.ch&&!chs.has(b.ch)){chs.add(b.ch);by.church+=coin(b.ch.fund);}
    for(const q of W.projects||[])if(q.type==='persuade'&&q.lever==='gold')by.escrow+=coin(q.pay);
    let t=0;for(const k in by)t+=by[k];return {t,by,bad};};
  const flows=()=>Object.assign({},W._flow||{});
  const land=(()=>{let n=0,l=0;for(let i=0;i<W.water.length;i++){n++;if(W.water[i]!==1)l++;}return l/n;})();
  if(typeof ownershipTick==='function')ownershipTick(); // complete the initial registry before taking the baseline census
  if(typeof SIM_FAULTS!=='undefined')SIM_FAULTS.carry=true; // a fault in one part of the day is recorded and the day goes on, so later faults still show; the run is no baseline after the first
  let M0=money(),F0=flows(),E0=errN,Y=0,FL0=0;
  S.draw=on=>{if(on){window.requestAnimationFrame=RAF;RAF(animate);perfToggle(true);}else{setSpeed(0);window.requestAnimationFrame=()=>0;}return on;};
  S.view=v=>{const s=W.capital;cam.follow=null;cam.mode='free';if(v==='street')flyTo(s.pos.x,s.pos.z,160);else flyTo(s.pos.x,s.pos.z,3000*MAPK);return v;};
  S.frames=()=>{const F=PERF.f.slice(),g=PERF.gpu.slice(),n=F.length;if(!n)return null;const a=k=>F.reduce((t,x)=>t+x[k],0)/n,d=F.map(x=>x.dt).sort((x,y)=>x-y),inf=renderer.info;
    return {n,fps:+(1000/a('dt')).toFixed(1),frame:+a('dt').toFixed(1),p95:+d[Math.floor(n*0.95)].toFixed(1),worst:Math.round(d[n-1]),busy:Math.round(a('total')/a('dt')*100),sim:+a('sim').toFixed(1),days:+a('ticks').toFixed(2),
      world:+a('world').toFixed(1),rebuild:+a('rebuild').toFixed(1),render:+a('render').toFixed(1),gpu:g.length?+(g.reduce((t,v)=>t+v,0)/g.length).toFixed(1):null,calls:inf.render.calls,tris:inf.render.triangles,buildings:W.bldList.length};};
  S.info=()=>({land,places:W.settlements.length,pop:Math.round(W.settlements.reduce((t,s)=>t+s.pop,0)),realm:W.name,startAD:AD(),startDay:day(),gpu:(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()});
  S.year=async(aud=0)=>{S.L={};const Fd0={...S.F},R0={...S.R},T0=Object.assign({},S.T),t0=performance.now(),was=new Map();let famDays=0,onsets=0,famPop=0,hung=0,popDays=0,placeDays=0,tickMs=0;
    for(const s of W.settlements)was.set(s,!!s.famineFlag);
    for(let i=0;i<360;i++){S.audit=i<aud;const tickStart=performance.now();try{auditInventory();const dm0=money().t,df0=flows(),dd=day();if(simTick()===false){await STORAGE_OUTCOMES.wait();i--;continue;}{const r=money().t-dm0-gap(df0,flows()).expect;if(Math.abs(r)>1e-6&&S.D.length<40)S.D.push([dd,+r.toFixed(6)]);}auditInventory();}catch(e){if(typeof STORAGE_OUTCOMES!=='undefined'&&(STORAGE_OUTCOMES.journal?.fault||STORAGE_OUTCOMES.modelFault))throw e;simErr(e);}tickMs+=performance.now()-tickStart;
      if(day()%30===15||day()%360===0)await new Promise(resolve=>setTimeout(resolve,0)); // finish deferred tracks/fences before later days use them, and flush the yearly autosave
      S.econDay();S.armyDay();placeDays+=W.settlements.length;for(const s of W.settlements){const f=!!s.famineFlag;if(f){famDays++;famPop+=s.pop;if(!was.get(s))onsets++;}was.set(s,f);hung+=(s.hunger||0)*s.pop;popDays+=s.pop;}}
    const ms=performance.now()-t0,M=money(),F=flows();Y++;
    S.audit=false;const {expect,minted,mintT}=gap(F0,F);
    const lostT=((F['<>lost']||0)-(F0['<>lost']||0))+mintT; // what was paid to nobody (the lost account also takes the mirror of every coin minted)
    let pop=0,folk=0,towns=0,walled=0,maxWall=0,grain=0,deserted=0,badPop=0;
    for(const s of W.settlements){if(!Number.isFinite(s.pop))badPop++;pop+=s.pop||0;folk+=(s.folk||[]).length;grain+=(s.stores&&s.stores.grain)||0;if(s.kind!=='village')towns++;
      if(s.wallRad){walled++;maxWall=Math.max(maxWall,(s.wallR||0)/Math.max(60,s.extentR||0));}for(const b of s.buildings)if(b.state==='ruin'&&b.deserted)deserted++;}
    let tilled=0;const LAND=W.land||G.land;if(LAND&&LAND.F)for(const f of LAND.F)if(f.state===LS.TILLED)tilled++; // W.land on current builds, G.land on older baselines
    const T={};for(const k in S.T){const d=S.T[k]-(T0[k]||0);if(d>0.5)T[k]=Math.round(d);}
    const out={y:Y,ad:AD(),auditDays:Math.min(aud,360),ms:Math.round(ms),msDay:+(ms/360).toFixed(2),tickMsDay:+(tickMs/360).toFixed(2),pop:Math.round(pop),folk,places:W.settlements.length,towns,walled,maxWallRatio:+maxWall.toFixed(2),badPop,
      food:Object.fromEntries(Object.entries(S.F).map(([k,v])=>[k,+(v-Fd0[k]).toFixed(3)])),foodExamples:S.foodExamples,famPop,popDays,hungerSum:hung,routes:Object.fromEntries(Object.entries(S.R).map(([k,v])=>[k,v-R0[k]])),placeDays,famDays,famOnsets:onsets,famPopShare:+(famPop/Math.max(1,popDays)).toFixed(4),hunger:+(hung/Math.max(1,popDays)).toFixed(4),grainPerHead:+(grain/Math.max(1,pop)).toFixed(2),tilled,tilledPerHead:+(tilled/Math.max(1,pop)).toFixed(4),deserted,
            journal:typeof STORAGE_OUTCOMES==='undefined'?null:STORAGE_OUTCOMES.status(),inventory:S.inventory.enabled?{checks:S.inventory.checks,first:S.inventory.first,unclaimed:S.inventory.unclaimed,lots:S.inventory.lots,commodityRows:S.inventory.commodityRows}:undefined,money:Math.round(M.t),moneyBy:Object.fromEntries(Object.entries(M.by).map(([k,v])=>[k,Math.round(v)])),dMoney:Math.round(M.t-M0.t),expected:Math.round(expect),residual:+(M.t-M0.t-expect).toFixed(3),
      prepaid:+gap(F0,F).prepaid.toFixed(3),minted:Object.fromEntries(Object.entries(minted).filter(e=>Math.abs(e[1])>=1).map(([k,v])=>[k,Math.round(v)])),paidToNobody:Math.round(lostT),
      badMoney:M.bad,nanFlows:(F['!nan']||0)-(F0['!nan']||0),errN,dErr:errN-E0,faults:typeof SIM_FAULTS==='undefined'?undefined:SIM_FAULTS.list.slice(FL0),firstFault:typeof SIM_FAULTS==='undefined'?undefined:SIM_FAULTS.first,badDays:S.D.splice(0),leaks:aud?Object.fromEntries(Object.entries(S.L).sort((a,b)=>Math.abs(b[1].r)-Math.abs(a[1].r)).map(([k,v])=>[k,{r:+v.r.toFixed(3),days:v.days,first:v.first}])):undefined,heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,econ:S.econYear(),armies:S.armyYear(),T};
    M0=M;F0=F;E0=errN;FL0=typeof SIM_FAULTS==='undefined'?0:SIM_FAULTS.list.length;return out;};
  window.__soak=S;return new Promise(resolve=>RAF(()=>resolve('ok')));})()`;

async function runWorld(w){
  const id=`s${w.seed}${w.coast?'-'+w.coast:''}`,file=path.join(OUT,id+'.jsonl'),load0=os.loadavg()[0];fs.writeFileSync(file,'');
  const errs=[],t0=Date.now(),phases=[];let c,kill=()=>{};
  try{({c,kill}=await launch());
    const browser=await c.send('Browser.getVersion');fs.writeFileSync(path.join(OUT,id+'.browser.json'),JSON.stringify(browser,null,2));
    await c.send('Runtime.enable');await c.send('Page.enable');await c.send('Profiler.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`${A.commodity!==undefined?'window.FURLONG_COMMODITY_BALANCES='+!!Number(A.commodity)+';':''}window.__soakRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;`});
    c.on('Page.javascriptDialogOpening',()=>c.send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{}));
    c.on('Runtime.exceptionThrown',p=>{if(errs.length<30)errs.push('exception: '+((p.exceptionDetails.exception&&p.exceptionDetails.exception.description)||p.exceptionDetails.text).slice(0,600));});
    c.on('Runtime.consoleAPICalled',p=>{if(p.type==='error'&&errs.length<30)errs.push('console: '+p.args.map(a=>a.value!==undefined?String(a.value):(a.description||'')).join(' ').slice(0,600));});
    const hash=`#s=${w.seed}&f=${w.fate}`+(w.coast?`&c=${w.coast}`:'')+(KM?`&km=${KM}`:'')+(Y0?`&y=${Y0}`:'')+'&foreground=1'; // foreground=1: reference driver (simTick() throws under the worker)
    if(BOOTCPU>1)await c.send('Emulation.setCPUThrottlingRate',{rate:BOOTCPU});
    await c.send('Page.navigate',{url:PAGE+hash});
    let last='';for(;;){await sleep(250);if(Date.now()-t0>30*60e3)throw new Error('the world did not finish loading');
      const st=await ev(c,`({line:(document.getElementById('loadline')||{}).textContent||'',ready:!document.getElementById('loading')&&typeof W!=='undefined'&&!!W&&!!W.settlements&&typeof errN!=='undefined'})`).catch(()=>({line:'',ready:false}));
      const ph=st.line.replace(/[\d,]+/g,'#').slice(0,40);if(ph!==last){phases.push([ph,Date.now()-t0]);last=ph;}if(st.ready)break;}
    const bootMs=Date.now()-t0;if(BOOTCPU>1)await c.send('Emulation.setCPUThrottlingRate',{rate:1});await ev(c,HARNESS);const info=await ev(c,'__soak.info()');
    if(/SwiftShader|llvmpipe|Software Rasterizer/i.test(info.gpu))throw new Error('hardware GPU required; got '+info.gpu);
    log(`${id}: ${info.realm}, ${info.places} places, land ${(info.land*100).toFixed(0)}%, booted in ${(bootMs/1000).toFixed(1)} s`);
    const years=[],prof={},render=[];
    const reset=async y=>{ // each drawing scenario starts with the same undrawn history, not the previous scenario's later world
      await ev(c,`history.replaceState(null,'',${JSON.stringify(hash)})`); // boot() rewrites the hash without foreground=1; restore it so the reload is foreground again
      await c.send('Page.reload',{ignoreCache:true});const t=Date.now();
      while(!await ev(c,"!window.__soak&&!document.getElementById('loading')&&typeof errN!=='undefined'&&!!W?.settlements").catch(()=>false)){
        if(Date.now()-t>30*60e3)throw new Error('render world did not finish loading');await sleep(250);}
      await ev(c,HARNESS);for(let i=0;i<y;i++)await ev(c,'__soak.year()');
    };
    const measure=async y=>{ // headless drawing on this host's GPU; viewport and CPU throttling are not measurements of physical phones/laptops
      for(const dev of DEVICES)for(const cpu of CPUS)for(const view of ['realm','street'])for(const sp of SPEEDS_){
        await reset(y);await c.send('Emulation.setDeviceMetricsOverride',dev==='phone'?{width:390,height:844,deviceScaleFactor:3,mobile:true}:{width:1440,height:900,deviceScaleFactor:2,mobile:false});
        await ev(c,`__soak.view('${view}');__soak.draw(true)`);await sleep(3000);
        await c.send('Emulation.setCPUThrottlingRate',{rate:cpu});
        const startDay=await ev(c,'day()');await ev(c,`setSpeed(${sp});PERF.f.length=0;PERF.gpu.length=0`);await sleep(1500);
        await ev(c,'PERF.f.length=0;PERF.gpu.length=0');await sleep(4000);
        const f=await ev(c,'__soak.frames()');if(!f||!(f.n>0)||!Number.isFinite(f.fps)||!Number.isFinite(f.p95))throw new Error('drawing produced no finite frames');
        const state=await ev(c,'({errN,popFinite:W.settlements.every(s=>Number.isFinite(s.pop)&&s.pop>=0)})');
        render.push({y,ad:await ev(c,'AD()'),startDay,endDay:await ev(c,'day()'),dev,cpu,view,speed:sp,...f,...state});
        fs.writeFileSync(path.join(OUT,id+'.render.json'),JSON.stringify(render,null,1));
        if(state.errN||!state.popFinite)throw new Error('drawing simulation failed: '+JSON.stringify(state));
        log(`${id} draw ${dev} cpu×${cpu} ${view} speed ${sp}: ${f.fps} fps, p95 ${f.p95} ms, busy ${f.busy}%, sim ${f.sim} world ${f.world} render ${f.render} gpu ${f.gpu}`);
        await ev(c,'__soak.draw(false)');await c.send('Emulation.setCPUThrottlingRate',{rate:1});await c.send('Emulation.clearDeviceMetricsOverride');
      }
      if(y<YEARS)await reset(y); // yearly accounting continues from the undrawn baseline
    };
    if(RENDER&&RENDER.has(0))await measure(0);
    for(let y=1;y<=YEARS;y++){
      const profile=PROFILE.has(y);if(profile){await c.send('Profiler.setSamplingInterval',{interval:PROFILE_US});await c.send('Profiler.start');}
      const stepStart=Date.now(),r=await ev(c,`__soak.year(${AUDIT&&(!AUDITY||AUDITY.has(y))?AUDIT:0})`);r.driverMs=Date.now()-stepStart;years.push(r);fs.appendFileSync(file,JSON.stringify(r)+'\n');
      if(profile){const p=(await c.send('Profiler.stop')).profile;fs.writeFileSync(path.join(OUT,id+'-y'+y+'.cpuprofile'),JSON.stringify(p));prof[y]={...topFunctions(p),score:compactScore(scoreProfile(p,{days:360}))};}
      fs.writeFileSync(path.join(OUT,id+'.summary.json'),JSON.stringify(summarize(w,id,info,bootMs,phases,years,prof,errs),null,1));
      if(RENDER&&RENDER.has(y))await measure(y);
      if(y%10===0||y===YEARS||r.dErr)log(`${id}: AD ${r.ad} pop ${r.pop} places ${r.places} famine days ${r.famDays} residual ${r.residual} ${r.msDay} ms/day${r.dErr?' ERRORS '+r.dErr+(r.faults?.length?' — new: '+r.faults.map(f=>`${f.part} day ${f.day}: ${f.error}`).join('; '):''):''}`);
    }
    const finalJournal=await ev(c,`(${finishJournal.toString()})(STORAGE_OUTCOMES)`);
    fs.writeFileSync(path.join(OUT,id+'.journal.json'),JSON.stringify(finalJournal,null,2),{flag:'wx'});
    assertJournalComplete(finalJournal);
    fs.writeFileSync(path.join(OUT,id+'.summary.json'),JSON.stringify({...summarize(w,id,info,bootMs,phases,years,prof,errs),finalJournal},null,1));
    if(render.length)fs.writeFileSync(path.join(OUT,id+'.render.json'),JSON.stringify(render,null,1));
    return Object.assign(summarize(w,id,info,bootMs,phases,years,prof,errs),{render,finalJournal,load:[load0,os.loadavg()[0]]});
  }catch(e){log(`${id}: FAILED ${e.message}`);return {id,seed:w.seed,coast:w.coast,failed:e.message,errs};}
  finally{kill();}}

function topFunctions(p){ // self time by function, from the sampled CPU profile
  const byId=new Map(p.nodes.map(n=>[n.id,n])),self=new Map();let total=0;
  for(let i=0;i<p.samples.length;i++){const n=byId.get(p.samples[i]),dt=(p.timeDeltas[i]||0)/1000;total+=dt;const f=n.callFrame,k=`${f.functionName||'(anonymous)'}${f.url?':'+(f.lineNumber+1):''}`;self.set(k,(self.get(k)||0)+dt);}
  return {totalMs:Math.round(total),top:[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>[k,Math.round(v),+(v/total*100).toFixed(1)])};}

function summarize(w,id,info,bootMs,phases,Y,prof,errs){
  const avg=(a,f)=>a.length?a.reduce((t,x)=>t+f(x),0)/a.length:0,first=Y.slice(0,10),lastY=Y.slice(-10),L=Y[Y.length-1]||{};
  const T={};for(const y of Y)for(const k in y.T)T[k]=(T[k]||0)+y.T[k];const tt=Object.values(T).reduce((a,b)=>a+b,0)||1;
  const mint={};for(const y of Y)for(const k in y.minted)mint[k]=(mint[k]||0)+y.minted[k];
  const resid=Y.reduce((t,y)=>t+y.residual,0),errN=Y.reduce((t,y)=>t+y.dErr,0),placeDays=Y.reduce((t,y)=>t+y.placeDays,0)||1;
  const checks={complete:Y.length===YEARS,noSimErrors:errN===0&&!errs.length,popFinite:Y.every(y=>y.badPop===0),noNanMoney:Y.every(y=>!y.nanFlows&&!y.badMoney),realmAlive:(L.pop??info.pop)>0,
    inventoryMatched:Y.every(y=>!y.inventory?.first),moneyAccounted:Y.every(y=>Math.abs(y.residual)<=0.01),wallsSane:Y.every(y=>y.maxWallRatio<4)};
  return {id,seed:w.seed,fate:w.fate,coast:w.coast,realm:info.realm,gpu:info.gpu,startDay:info.startDay,land:+info.land.toFixed(3),bootMs,phases,years:Y.length,endAD:L.ad??info.startAD,
    pop:{start:info.pop,end:L.pop??info.pop,max:Math.max(info.pop,...Y.map(y=>y.pop))},places:L.places,towns:L.towns,walled:L.walled,
    famine:{daysPerPlaceYear:+(Y.reduce((t,y)=>t+y.famDays,0)/placeDays*360).toFixed(1),onsetsPerYear:+avg(Y,y=>y.famOnsets).toFixed(2),popShare:+(Y.reduce((t,y)=>t+y.famPop,0)/Math.max(1,Y.reduce((t,y)=>t+y.popDays,0))).toFixed(4),hunger:+(Y.reduce((t,y)=>t+y.hungerSum,0)/Math.max(1,Y.reduce((t,y)=>t+y.popDays,0))).toFixed(4),
      tilledPerHead:+avg(Y,y=>y.tilledPerHead).toFixed(4),grainPerHead:+avg(Y,y=>y.grainPerHead).toFixed(2)},
    money:{end:L.money,residualTotal:+resid.toFixed(3),maxAbsResidual:Math.max(0,...Y.map(y=>Math.abs(y.residual))),residualPerYear:Math.round(resid/Math.max(1,Y.length)),mintedTotal:Object.fromEntries(Object.entries(mint).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,12)),
      paidToNobody:Y.reduce((t,y)=>t+y.paidToNobody,0)},
    food:Object.fromEntries(['fishProduced','fishBought','grainBought','fishEaten','grainEaten','hungryWithFoodDays','hungryWithFishDays'].map(k=>[k,+(Y.reduce((t,y)=>t+(y.food?.[k]||0),0)).toFixed(3)])),foodExamples:Y.at(-1)?.foodExamples||[],
    routes:Object.fromEntries(['calls','cold','unreachable'].map(k=>[k,Y.reduce((t,y)=>t+(y.routes?.[k]||0),0)])),
    armies:(()=>{const A=Y.map(y=>y.armies).filter(Boolean);if(!A.length)return undefined;const sum=k=>A.reduce((t,a)=>t+(a[k]||0),0),hy=Math.max(1e-9,sum('hostYears')),per=k=>+(sum(k)/hy).toFixed(2),by=(g)=>{const m={};for(const a of A)for(const k in a[g]||{})m[k]=(m[k]||0)+a[g][k];return m;};
      return {hostsByYear:A.map(a=>a.hostYears),tickMilitaryMsDayByYear:Y.map(y=>+(((y.T&&y.T.tickMilitary)||0)/360).toFixed(2)),hostYears:+hy.toFixed(2),objectiveFailed:sum('objectiveFailed'),objectiveFailedPerHostYear:per('objectiveFailed'),
        objectiveRepeat:sum('objectiveRepeat'),noted:sum('noted'),campDays:sum('campDays'),campDaysPerHostYear:per('campDays'),longestCamp:Math.max(...A.map(a=>a.longestCamp)),march:by('march'),marchFailed:by('marchFailed'),
        raftsLords:sum('raftsLords'),raftsPlayer:sum('raftsPlayer'),ships:sum('ships'),noShips:sum('noShips'),camps:A.flatMap(a=>a.camps||[]).slice(0,24),cannotReach:sum('cannotReach'),loses:sum('loses'),wars:A.flatMap(a=>a.wars),feudsBegun:sum('feudsBegun'),feudsEnded:sum('feudsEnded')};})(),
    econ:(()=>{const E=Y.map(y=>y.econ).filter(Boolean);if(!E.length)return undefined;const L=E.at(-1),mean=k=>{const v=E.map(e=>e[k]).filter(x=>x!=null);return v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(3):null;},sum=(g,k)=>E.reduce((t,e)=>t+(e[g]?.[k]||0),0);
      return {crown0:E[0].crown0,houses0:E[0].houses0,crownByYear:E.map(e=>e.crown),housesByYear:E.map(e=>e.houses),crownLowDay:L.crownLowDay,housesLowDay:L.housesLowDay,famineByYear:Y.map(y=>y.famPopShare),hungerByYear:Y.map(y=>y.hunger),
        pxGrain:mean('pxGrain'),pxFish:mean('pxFish'),pxGrainCapital:mean('pxGrainCapital'),pxFishCapital:mean('pxFishCapital'),pxGrainByYear:E.map(e=>e.pxGrain),pxFishByYear:E.map(e=>e.pxFish),
        placesByYear:Y.map(y=>y.places),townsByYear:Y.map(y=>y.towns),buildingsByYear:E.map(e=>e.buildings),householdsByYear:E.map(e=>e.households),walledByYear:Y.map(y=>y.walled),meadow:L.meadow,field:L.field,meadowByYear:E.map(e=>e.meadow),fieldByYear:E.map(e=>e.field),
        grain:{produced:sum('grain','produced'),eaten:sum('grain','eaten'),rotted:sum('grain','rotted'),relief:sum('grain','relief'),carted:sum('grain','carted')},fish:{produced:sum('fish','produced'),eaten:sum('fish','eaten'),rotted:sum('fish','rotted'),relief:sum('fish','relief'),carted:sum('fish','carted')},
        coinlessShareByYear:E.map(e=>e.coinlessShare),coinlessHungerByYear:E.map(e=>e.coinlessHunger),capitalHungerByYear:E.map(e=>e.capitalHunger),otherHungerByYear:E.map(e=>e.otherHunger),pursePerSoul:L.pursePerSoul,cartersByYear:E.map(e=>e.carters)};})(),
    perf:{tickMsDayFirst10:+avg(first,y=>y.tickMsDay).toFixed(2),tickMsDayLast10:+avg(lastY,y=>y.tickMsDay).toFixed(2),msDayFirst10:+avg(first,y=>y.msDay).toFixed(2),msDayLast10:+avg(lastY,y=>y.msDay).toFixed(2),msDayByYear:Y.map(y=>y.msDay),heapMBEnd:L.heapMB,
      ticks:Object.entries(T).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>[k,+(v/tt*100).toFixed(1)]),profile:prof},
        leaks:(()=>{const m={};for(const y of Y)for(const k in y.leaks||{}){const e=m[k]||(m[k]={r:0,days:0,first:[]});e.r+=y.leaks[k].r;e.days+=y.leaks[k].days;for(const f of y.leaks[k].first||[])if(e.first.length<6)e.first.push([y.y,...f]);}return Object.keys(m).length?m:undefined;})(),badDays:Y.flatMap(y=>(y.badDays||[]).map(d=>[y.y,...d])),errN,errs:errs.slice(0,10),firstFault:Y.find(y=>y.firstFault)?.firstFault||null,faults:Y.flatMap(y=>y.faults||[]).slice(0,40),checks,pass:Object.values(checks).every(Boolean)};}

function report(R){
  const ok=R.filter(r=>!r.failed),pct=x=>(x*100).toFixed(1)+'%';
  let md=`# Soak: ${R.length} worlds, ${YEARS} years each\n\n${new Date().toISOString()} · source SHA256 ${provenance.sourceSHA256} · build ${(SOURCE.toString('utf8').match(/build [^<]+/)||[''])[0]}\n\n`;
  md+=`| world | land | boot s | AD | pop start→end | places | famine days/place-yr | famine pop share | hunger | tilled/head | money residual/yr | ms/day first→last | checks |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for(const r of R){if(r.failed){md+=`| ${r.id} | | | | | | | | | | | | FAILED: ${r.failed} |\n`;continue;}
    md+=`| ${r.id} | ${pct(r.land)} | ${(r.bootMs/1000).toFixed(1)} | ${r.endAD} | ${r.pop.start}→${r.pop.end} | ${r.places} | ${r.famine.daysPerPlaceYear} | ${pct(r.famine.popShare)} | ${r.famine.hunger} | ${r.famine.tilledPerHead} | ${r.money.residualPerYear} | ${r.perf.msDayFirst10}→${r.perf.msDayLast10} | ${r.pass?'pass':Object.entries(r.checks).filter(e=>!e[1]).map(e=>e[0]).join(', ')} |\n`;}
  if(ok.length>2){const xs=ok.map(r=>r.land),ys=ok.map(r=>r.famine.popShare),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
    const cov=xs.reduce((t,x,i)=>t+(x-mx)*(ys[i]-my),0),sx=Math.sqrt(xs.reduce((t,x)=>t+(x-mx)**2,0)),sy=Math.sqrt(ys.reduce((t,y)=>t+(y-my)**2,0));
    md+=`\nDescriptive correlation only; paired seeds and a small sample do not establish causation.\n\nLand share against famine (share of people in famine): r = ${(sx&&sy?cov/(sx*sy):0).toFixed(2)} over ${ok.length} worlds.\n`;}
  const mint={};for(const r of ok)for(const k in r.money.mintedTotal)mint[k]=(mint[k]||0)+r.money.mintedTotal[k];
  md+=`\nTiming includes instrumentation and deferred land work; tickMsDay in JSON excludes deferred callbacks. Audit years also include the purse census overhead. Drawing scenarios restart from the same undrawn year, then advance at the selected speed; startDay/endDay retain that interval.\n\nMoney reconciliation checks every year's residual against 0.01 coin; a net residual alone can hide cancelling errors. The oracle pairs declared prepaid star credits with their synthetic negative lost-account mirror. Missing upstream debits, omitted purses and actual creation/loss still produce residuals.\n\n## Declared prepaid payouts (all worlds; upstream debit must reconcile)\n\n`+Object.entries(mint).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,15).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join('\n')+'\n';
  const T={};for(const r of ok)for(const [k,v] of r.perf.ticks)T[k]=(T[k]||0)+v/ok.length;
  const broken=R.filter(r=>r.firstFault);if(broken.length)md+=`\n## Faults (the run carried on; each world is no baseline after its first fault)\n\n`+broken.map(r=>`- ${r.id}: from day ${r.firstFault.day}, ${r.firstFault.part}: ${r.firstFault.error}`+(r.faults.length>1?` (and ${r.faults.length-1} more distinct)`:'')).join('\n')+'\n';
  md+=`\n## Where a day's time goes (share of tick time, mean over worlds)\n\n`+Object.entries(T).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`- ${k}: ${v.toFixed(1)}%`).join('\n')+'\n';
  const scored=ok.filter(r=>r.hot);
  if(scored.length)md+=`\n## CPU by function and part of the day (ms per simulated day; the hot list)\n\nSampled CPU profiles of whole years (every ${PROFILE_US} µs). Own time is a function's own code; total time includes what it calls. '(outside the day)' is work between days (the harness, journal flushes, deferred land work); '(harness)' is the harness's and runtime's own code. Profiled years run a few per cent slower.${HOTLIST?` Hot list: ${HOTLIST}.`:''}\n\n`+
    scored.map(r=>r.hot.report+'\n'+formatScore(r.hot.last,{top:15,title:`${r.id}, year ${r.hot.lastYear} in full`})).join('\n')+'\n';
  const ec=ok.filter(r=>r.econ);if(ec.length)md+=`\n## Economy (#23)\n\nGold by year (crown; houses together), the day each first fell below 5% of its opening, famine share and hunger by year, mean grain and fish prices (realm, people-weighted; capital), growth at the end, tilled meadow against field furlongs, and grain and fish produced, eaten and rotted over the run.\n\n| world | crown by year | houses by year | crown <5% day | houses <5% day | famine share by year | hunger by year | grain / fish price (capital) | places / towns / buildings / households / walled | meadow / field | grain made / eaten / rotted | fish made / eaten / rotted |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`+ec.map(r=>{const e=r.econ,j=a=>a.join(' '),pc=a=>a.map(x=>(x*100).toFixed(0)+'%').join(' ');return `| ${r.id} | ${e.crown0} → ${j(e.crownByYear)} | ${e.houses0} → ${j(e.housesByYear)} | ${e.crownLowDay??'–'} | ${e.housesLowDay??'–'} | ${pc(e.famineByYear)} | ${e.hungerByYear.map(x=>x.toFixed(2)).join(' ')} | ${e.pxGrain} / ${e.pxFish} (${e.pxGrainCapital} / ${e.pxFishCapital}) | ${e.placesByYear.at(-1)} / ${e.townsByYear.at(-1)} / ${e.buildingsByYear.at(-1)} / ${e.householdsByYear.at(-1)} / ${e.walledByYear.at(-1)} | ${e.meadow} / ${e.field} | ${e.grain.produced} / ${e.grain.eaten} / ${e.grain.rotted} | ${e.fish.produced} / ${e.fish.eaten} / ${e.fish.rotted} |`;}).join('\n')+'\n';
  if(ec.some(r=>r.econ.coinlessShareByYear))md+=`\n| world | souls with no coin, by year | their hunger | hunger at the capital / elsewhere | purse per soul at the end (capital / towns / villages) | carters and boatmen by year | grain and fish carted | relief given (grain, fish) |\n|---|---|---|---|---|---|---|---|\n`+ec.map(r=>{const e=r.econ,f=a=>(a||[]).map(x=>x==null?'–':x).join(' ');return `| ${r.id} | ${f(e.coinlessShareByYear)} | ${f(e.coinlessHungerByYear)} | ${f(e.capitalHungerByYear)} / ${f(e.otherHungerByYear)} | ${e.pursePerSoul?[e.pursePerSoul.capital,e.pursePerSoul.town,e.pursePerSoul.village].join(' / '):'–'} | ${f(e.cartersByYear)} | ${e.grain.carted} / ${e.fish.carted} | ${e.grain.relief} / ${e.fish.relief} |`;}).join('\n')+'\n';
  const ar=ok.filter(r=>r.armies);if(ar.length)md+=`\n## Armies (#33)\n\nHosts alive by year (host-years), tickMilitary CPU ms per day by year, campaign marches that failed per host-year (noted as unreachable; repeated on the same place within 90 days), days idle in a field camp off hold per host-year (longest run), marches by cause (failed), rafts lashed (lords / player), ships taken, wars ended (result: 1 crown, -1 rebels, 0 peace; months), feuds begun / ended, and annal lines telling a failed order or pursuit.\n\n| world | hosts by year | tickMilitary ms/day by year | failed campaign marches / host-yr (noted; repeated) | camp days / host-yr (longest) | marches by cause (failed) | rafts | ships (no ships to be had) | wars | feuds | cannot reach / loses |\n|---|---|---|---|---|---|---|---|---|---|---|\n`+ar.map(r=>{const a=r.armies,m=Object.entries(a.march).sort((x,y)=>y[1]-x[1]).map(([k,v])=>k+' '+v+(a.marchFailed[k]?' ('+a.marchFailed[k]+')':'')).join(', ');return '| '+r.id+' | '+a.hostsByYear.join(' ')+' | '+a.tickMilitaryMsDayByYear.join(' ')+' | '+a.objectiveFailedPerHostYear+' ('+a.noted+'; '+a.objectiveRepeat+') | '+a.campDaysPerHostYear+' ('+a.longestCamp+') | '+(m||'–')+' | '+a.raftsLords+' / '+a.raftsPlayer+' | '+a.ships+' ('+(a.noShips||0)+') | '+(a.wars.map(w=>w.result+', '+w.months+' mo').join('; ')||'–')+' | '+a.feudsBegun+' / '+a.feudsEnded+' | '+a.cannotReach+' / '+a.loses+' |';}).join('\n')+'\n';
  const cp=ar.filter(r=>r.armies.camps&&r.armies.camps.length);if(cp.length)md+='\nLong field camps (each as the host stood on its 30th day in camp):\n\n'+cp.map(r=>r.armies.camps.slice(0,6).map(c=>'- '+r.id+', day '+c.day+': host '+c.id+' of house '+c.house+', '+(c.atWar?'at war':'at peace')+(c.fit?'':', too few to campaign')+(c.rebel?', in a rising':'')+', supply '+c.supply+', '+c.fromStation+' m from '+c.station+(c.stationOwn?' (its own)':'')+', '+c.fromHome+' m from home'+(c.homeOwn?'':' (lost)')+'; why: '+(c.why||'–')+'; places noted '+c.noWay+'; waits '+c.holdUntil+' / '+c.homeAfter+' days'+(c.raft?'; a raft':'')).join('\n')).join('\n')+'\n';
  if(ok.some(r=>r.food))md+=`\n## Fish and provisioning\n\n| world | GPU | fish produced | fish bought by households | fish eaten | high-hunger place-days with a day's fish still in storage |\n|---|---|---|---|---|---|\n`+ok.map(r=>`| ${r.id} | ${r.gpu} | ${Math.round(r.food.fishProduced)} | ${Math.round(r.food.fishBought)} | ${Math.round(r.food.fishEaten)} | ${r.food.hungryWithFishDays} |`).join('\n')+'\n';
  const lk={};for(const r of ok)for(const k in r.leaks||{})lk[k]=(lk[k]||0)+r.leaks[k].r;
  if(Object.keys(lk).length)md+=`\n## Money-flow reconciliation residual, by part of the day (audit of the first ${AUDIT} days, all worlds)\n\n`+Object.entries(lk).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,12).map(([k,v])=>`- ${k}: ${Math.round(v)}`).join('\n')+'\n';
  const rr=ok.flatMap(r=>(r.render||[]).map(x=>({id:r.id,...x})));
  if(rr.length)md+=`\n## Drawing (headless Chrome on this Mac's GPU; viewport emulation and CPU throttling only, not physical device measurements)\n\n| world | AD | device | cpu | view | speed | fps | p95 ms | busy | sim | world | rebuilds | render | GPU ms | draw calls | tris |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`+
    rr.map(x=>`| ${x.id} | ${x.ad} | ${x.dev} | ×${x.cpu} | ${x.view} | ${x.speed} | ${x.fps} | ${x.p95} | ${x.busy}% | ${x.sim} | ${x.world} | ${x.rebuild} | ${x.render} | ${x.gpu??'–'} | ${x.calls} | ${(x.tris/1e6).toFixed(2)}M |`).join('\n')+'\n';
  const bad=R.filter(r=>r.errs&&r.errs.length);if(bad.length)md+=`\n## Errors\n\n`+bad.map(r=>`- ${r.id}:\n`+r.errs.map(e=>'  - '+e.replace(/\n/g,' ').slice(0,300)).join('\n')).join('\n')+'\n';
  return md;}

const fateOverride=A.fate===undefined?null:Number(A.fate);if(fateOverride!==null&&(!Number.isInteger(fateOverride)||fateOverride<0||fateOverride>0xffffffff))throw new Error('invalid fate seed');
const worlds=[];for(const s of seeds)for(const co of coasts)worlds.push({seed:s,fate:fateOverride??s,coast:co});
log(`soak: ${worlds.length} worlds × ${YEARS} years, ${PAR} at a time → ${OUT}`);
const results=[],queue=worlds.slice();
await Promise.all(Array.from({length:Math.min(PAR,worlds.length)},async()=>{while(queue.length){const w=queue.shift();results.push(await runWorld(w));
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,1));}}));
results.sort((a,b)=>worlds.findIndex(w=>`s${w.seed}${w.coast?'-'+w.coast:''}`===a.id)-worlds.findIndex(w=>`s${w.seed}${w.coast?'-'+w.coast:''}`===b.id));
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(results,null,1));
for(const r of results){if(r.failed||!r.perf?.profile)continue; // each world's CPU score joins the hot list
  const ages=Object.entries(r.perf.profile).filter(([,p])=>p.score).map(([y,p])=>{return {year:+y,days:p.score.days,msDay:p.score.msDay,wallMsDay:r.perf.msDayByYear?.[+y-1]??null,parts:p.score.parts,self:p.score.self,total:p.score.total,where:p.score.where};}).sort((a,b)=>a.year-b.year);
  if(!ages.length)continue;
  const rec={at:new Date().toISOString(),tool:'soak',world:r.id+(r.fate!==r.seed?'-f'+r.fate:'')+(KM?'-km'+KM:'')+(Y0&&Y0!==850?'-y'+Y0:''),seed:r.seed,fate:r.fate,coast:r.coast,build:provenance.sourceSHA256.slice(0,12),commit:COMMIT,load:r.load||null,fault:r.firstFault?{day:r.firstFault.day,part:r.firstFault.part}:null,args:provenance.args,ages};
  let prev=null;if(HOTLIST)try{prev=updateHotlist(HOTLIST,rec);}catch(e){log('hot list not updated: '+e.message);}
  const lastYear=ages.at(-1).year;r.hot={report:hotlistReport(rec,prev),last:r.perf.profile[lastYear].score,lastYear};}
const md=report(results)+(results.some(r=>!r.failed)?`\nBoot: `+results.filter(r=>!r.failed).map(r=>`${r.id} ${(r.bootMs/1000).toFixed(1)} s${BOOTCPU>1?' (cpu ×'+BOOTCPU+')':''}`).join(', ')+'\n':'');fs.writeFileSync(path.join(OUT,'summary.md'),md);console.log('\n'+md);
process.exit(results.every(r=>r.pass)?0:1);
