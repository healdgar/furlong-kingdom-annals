#!/usr/bin/env node
/* Economy probes: play one world in Node (a worker thread's own realm, as tools/driver-parity.mjs does) and read the economy
   from outside the simulation every few days. Reads only; the history is the model runner's.

   node tools/economy-probe.mjs --probe crown --world 42:42:sea --days 1800 [--every 30] [--src index.html] [--km 15] [--place capital|N]
   Probes:
     crown    every change to the crown's chest, by year: a transfer's reason (and the payee's kind when the crown pays), or the
              function that wrote W.treasury itself; sales tagged with the good and the kind of place; the chest each month
     capital  a place each --every days: people, hunger, purses, coinless share, strips by tenure, prices, the crown's stock
              (held, on sale, its reserve against the price)
     locked   stock on sale that its seller's reserve keeps above the market, by good and kind of seller, and how much of it
              lies in hungry places; the places in famine
     prices   place-goods above 10x their base price, and the six furthest above it */
import fs from 'node:fs';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const A=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
const PROBE=A.probe||'crown',[seed,fate,coast]=(A.world||'42:42:sea').split(':'),DAYS=+(A.days||1800),EVERY=+(A.every||(PROBE==='crown'?30:180)),PLACE=A.place||'capital';
if(!['crown','capital','locked','prices'].includes(PROBE))throw Error('--probe crown|capital|locked|prices');
const hash=`#s=${+seed}&f=${+(fate??seed)}&c=${coast||'sea'}&y=850${A.km?'&km='+A.km:''}`;

// Installed once, before the first day: wrappers that pass every call through unchanged and only tally.
const SETUP={crown:`(()=>{const T=globalThis.__probe={year:{},rows:[]};let why=null;const add=(k,v)=>{const y=Math.floor((day()-1)/360)+1,Y=T.year[y]||(T.year[y]={});Y[k]=(Y[k]||0)+v;};
    const kind=to=>to==='out'?'out':to&&to.household?'hh':to&&to.gn!==undefined?'person':to&&to.ch?'church':to&&to.buildings?'town':to?'house':'nobody';
    const t0=transfer;globalThis.transfer=function(from,to,v,w){const o=why;why=(w||'?')+(from==='crown'?'>'+kind(to):'');try{return t0.apply(this,arguments);}finally{why=o;}};
    for(const n of ['purchase','commodityClearMarket']){const f=globalThis[n];globalThis[n]=function(s,g){const o=why;why=(o?o+'/':'')+'sale:'+g+'@'+(s===W.capital?'capital':s.kind);try{return f.apply(this,arguments);}finally{why=o;}};}
    let tv=W.treasury;Object.defineProperty(W,'treasury',{configurable:true,enumerable:true,get(){return tv;},set(x){const d=x-tv;tv=x;if(!d)return;let k;
      if(why)k='T:'+why;else{const L=new Error().stack.split('\\n');let i=2;while(L[i]&&/at (acct|Object\\.set) /.test(L[i]))i++;const m=/at (\\S+)/.exec(L[i]||'');k='W:'+(m?m[1]:'?');}add((d>0?'+':'-')+k,d);}});})()`,
  capital:'globalThis.__probe={rows:[]}',locked:'globalThis.__probe={rows:[]}',prices:'globalThis.__probe={rows:[]}'};
const READ={crown:`__probe.rows.push([day(),Math.round(W.treasury),Math.round(W.settlements.reduce((t,s)=>t+s.pop,0)),Math.round(W.capital.pop)])`,
  capital:`(()=>{const s=${PLACE==='capital'?'W.capital':'W.settlements['+(+PLACE)+']'},si=W.settlements.indexOf(s),ten={};for(const f of tilledOf(s,si))ten[f.ten]=(ten[f.ten]||0)+1;
    const H=householdsOf(s);let coinless=0,souls=0,purse=0;for(const h of H){const n=h.population.get(s)||0;souls+=n;purse+=Math.max(0,h.assets.w||0);if(!((h.assets.w||0)>0))coinless+=n;}
    const cr=stockOf(s,'crown'),px=g=>+price(s,g).toFixed(2);__probe.rows.push({d:day(),name:s.name,pop:Math.round(s.pop),households:H.length,hunger:+(s.hunger||0).toFixed(2),coinless:souls?+(coinless/souls).toFixed(2):0,purse:Math.round(purse),ten,
      price:{grain:px('grain'),fish:px('fish'),ore:px('ore'),tools:px('tools')},crownGrain:{held:Math.round(cr.held.grain||0),sale:Math.round(cr.sale.grain||0),reserve:+((s.rsv?.grain?.get('crown'))||0).toFixed(2)},treasury:Math.round(W.treasury)});})()`,
  locked:`(()=>{const out={d:day(),locked:{},open:{},lockedBy:{},inHungry:0,famine:W.settlements.filter(s=>s.famineFlag).map(s=>s.name+' '+Math.round(s.pop)+' '+(s.hunger||0).toFixed(2))};
    const kind=w=>w==='crown'?'crown':w==='out'?'out':w&&w.household?'hh':w&&w.gn!==undefined?'person':w&&w.ch?'church':w&&w.buildings?'town':'house';
    for(const s of W.settlements){if(!s.mkt)continue;for(const g of ['grain','fish']){const L=s.mkt[g];if(!L)continue;const p=price(s,g),R=s.rsv?.[g];
      for(const[w,v]of L.ownedEntries?L.ownedEntries():L){const q=forSale(w,v,g);if(!(q>0))continue;const lk=R&&R.get(w)>p,B=lk?out.locked:out.open;B[g]=(B[g]||0)+q;
        if(lk){const k=g+':'+kind(w);out.lockedBy[k]=(out.lockedBy[k]||0)+q;if((s.hunger||0)>0.3)out.inHungry+=q;}}}}
    for(const B of [out.locked,out.open,out.lockedBy])for(const k in B)B[k]=Math.round(B[k]);out.inHungry=Math.round(out.inHungry);__probe.rows.push(out);})()`,
  prices:`(()=>{const all=[];let over10=0;for(const s of W.settlements)for(const g of GOODS){const p=s.px?.[g];if(p==null)continue;const k=p/GOODBASE[g];if(k>10)over10++;all.push([+k.toFixed(1),g,s===W.capital?'capital':s.kind,s.name,+p.toFixed(1)]);}
    all.sort((a,b)=>b[0]-a[0]);__probe.rows.push({d:day(),over10,top:all.slice(0,6)});})()`};

const RUN=`const {parentPort,workerData:{source,hash,days,every,setup,read}}=require('node:worker_threads'),vm=require('node:vm');
  for(const k of ['localStorage','sessionStorage','navigator'])Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
  Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
  vm.runInThisContext(source,{filename:'index.html'});const R=c=>vm.runInThisContext(c),o=Object.fromEntries(hash.slice(1).split('&').map(kv=>kv.split('=')));
  (async()=>{await R('startSimulation({seed:'+o.s+',fate:'+o.f+',coast:'+JSON.stringify(o.c)+',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})');
    R(setup);for(let i=1;i<=days;i++){await R('STORAGE_OUTCOMES.wait()');if(R('simTick()')===false)throw Error('blocked');if(i%8===0)await R('STORAGE_OUTCOMES.journal.flush()');if(i%every===0)R(read);}
    parentPort.postMessage(R('JSON.stringify(__probe)'));})().catch(e=>{throw e;});`;
const source=inlineGameScript(fs.readFileSync(path.resolve(A.src||path.join(HERE,'..','index.html')),'utf8'));
const out=JSON.parse(await new Promise((res,rej)=>{const w=new Worker(RUN,{eval:true,workerData:{source,hash,days:DAYS,every:EVERY,setup:SETUP[PROBE],read:READ[PROBE]}});w.once('message',m=>{res(m);w.terminate();});w.once('error',rej);}));
if(PROBE!=='crown'){for(const r of out.rows)console.log(JSON.stringify(r));process.exit(0);}
console.log('the chest: '+out.rows.map(([d,t])=>`d${d} ${t}`).join(', '));
const years=Object.keys(out.year).sort((a,b)=>a-b),keys=[...new Set(years.flatMap(y=>Object.keys(out.year[y])))],tot=k=>Math.abs(years.reduce((t,y)=>t+(out.year[y][k]||0),0));
keys.sort((a,b)=>tot(b)-tot(a));console.log('reason'.padEnd(48)+years.map(y=>('y'+y).padStart(8)).join(''));
for(const k of keys.slice(0,+(A.top||40)))console.log(k.slice(0,47).padEnd(48)+years.map(y=>String(Math.round(out.year[y][k]||0)).padStart(8)).join(''));
console.log('net'.padEnd(48)+years.map(y=>String(Math.round(Object.values(out.year[y]).reduce((t,v)=>t+v,0))).padStart(8)).join(''));
