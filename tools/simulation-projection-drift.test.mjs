// The display world is only what the packets bring. Run the real model, carry its actual daily and Reel packets into
// a display context exactly as the foreground installs them, and hold the result to a fresh projection of the same day;
// then hold every drawn kind of thing to the whole of its record, and every geometry copy to the world it came from.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=inlineGameScript(fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8'));
// A small realm (six places, ~500 buildings), a month of daily packets and a month at the Reel cadence. A longer or larger soak:
// DRIFT_KM=0 (the default map size) DRIFT_DAILY=150 DRIFT_REEL=90 DRIFT_BYTES=400000 node --test tools/simulation-projection-drift.test.mjs
const env=(k,d)=>process.env[k]===undefined?d:+process.env[k];
const BYTES_MEDIAN=env('DRIFT_BYTES',100_000); // JSON bytes of a daily packet in this month (about 600 000 before geometry crossed once)
const SEED=env('DRIFT_SEED',1001),FATE=env('DRIFT_FATE',42),KM=env('DRIFT_KM',6),HASH=`#s=${SEED}&f=${FATE}&c=sea&y=850${KM?'&km='+KM:''}`,DAILY=env('DRIFT_DAILY',30),REEL=env('DRIFT_REEL',30);

// Names that may lag in the display: each is read only by worker-side queries (inspector, accounts, overlays the worker
// computes) or differs only as null against absent. Keys are kind.name, or W.name.path for world fields.
const DRIFT_ALLOWED={
  'b.ownerId':(a,b)=>true, // who holds a building: inspector and accounts, answered in the worker
  'b.storageId':(a,b)=>true, // the storage ledger's key: worker-side storage reports
  'r.vol':(a,b)=>true, // road traffic: the inspector's row and the trade overlay, both computed in the worker
  'f.worked':(a,b)=>true, // "worked land before": the inspector's history row
  'f.dirt':(a,b)=>true, // the survey flag the simulation clears within days; the area it refreshes is then published
  'f.wild0':(a,b)=>a===undefined&&b===null, // null and absent alike: sapling growth reads wild0 ?? today
  'W.roadCells':(a,b)=>true, // bootstrap-only cells the simulation reads; drawn roads come from W.roads
  'W.dragon.target':(a,b)=>a===null&&b===undefined, // the town the wyrm means: the simulation's alone (see below)
};
// Object-valued names of drawn things that stay in the worker, with why. Anything else object-valued must cross.
const WORKER_ONLY={
  settlement:{stores:'goods: overlays and inspectors ask the worker',storage:'storage ledger',storageReport:'storage ledger',households:'household accounts',
    mkt:'markets',rsv:'reserved stock',px:'prices',res:'resources',frt:'freight rates',hm:'herd management (herds come from actor plans)',
    history:'inspector text',cashY:'annual cash totals: reports ask the worker',cashPrev:'previous annual cash totals: reports ask the worker',oldWalls:'inspector count',dead:'the dead, for inspector links',growSlots:'building planner',roadSpoke:'layout planner',
    joinOut:'layout planner',landing:'shore landing for boats',burns:'generation burn scars',mill:'crosses as millId',
    custom:'the customs of the manor: the lord\'s and crown\'s panels and the settlement card ask the worker',pleas:'the manor court\'s roll (#37)',court:'court accounts and rulings: inspectors ask the worker',enrolments:'land and customary transaction witnesses: court inspectors ask the worker',royalPleas:'held criminal presentments: court inspectors ask the worker'},
  building:{s:'crosses as si',title:'title accounts',hh:'households',st:'street link, for gate placement in the worker',why:'planner notes',
    ownerId:'accessor; crosses when it names an owner',farm:'the mill\'s or bakehouse\'s farm: the settlement card asks the worker'},
  field:{title:'title accounts',trees:'cross as treeRefs',own:'accessor; crosses when it names a holder',wk:'accessor; crosses when it names a worker',
    wild0:'a day number when set'},
  army:{flag:'foreground flags are its own',target:'a settlement index when set'},
  caravan:{m:'merchant account',drv:'driver',crew:'crew',storageCargo:'cargo ledger (its id is the render key)'},
  dragon:{target:'the town it means to raid'},
  project:{payer:'an account, for storage works',reason:'a sentence when set'},
  road:{open:'the untrimmed open-country path; path and drawn cross'},
  banditCamp:{king:'a name when set'},
};

const globals={FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash:HASH},addEventListener(){},removeEventListener(){},requestAnimationFrame(){},setTimeout,clearTimeout,
  performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,Date,Math,Number,Intl,Promise,
  Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,
  Error,TypeError,RangeError,JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,structuredClone,
  ...(typeof CompressionStream==='undefined'?{}:{CompressionStream,DecompressionStream,Response})};
const realm=()=>{const c=vm.createContext({...globals});new vm.Script(source,{filename:'index.html'}).runInContext(c,{timeout:60_000});return c;};
const run=(c,code)=>vm.runInContext(code,c,{timeout:300_000});
const display=()=>{const c=realm();run(c,'BACKGROUND={options:{startAD:850},closed:true}');return c;}; // the foreground's W, built only by installPresentation
const install=(c,packet)=>{c.__packet=structuredClone(packet);run(c,'installPresentation(__packet)');};

// What each daily packet carries, against what the foreground already holds from the packets before it. Geometry that has not changed must not cross
// again, nor a record that has not changed. (The drift test below shows the display is nonetheless whole.)
function deltaAudit(){
  const GEOMETRY='ch lot mill millWater dam _graveyard pos keepPos lake motte bailey hillCastle ward burgRing cas citadel tg wallRad wallKind wallDmg wallBuild buildings streets places furl remnants relicWalls poly path drawn bridges field battlePos raft objective berth sap'.split(' ');
  const bytes=[],again=[],held=new Map(),omitted={poly:0,streets:0},sent={poly:0,streets:0,buildings:0,roads:0,fields:0},flags={structures:0,details:0,roads:0,days:0};
  let typed=0; // typed arrays cross by transfer: counted at their size, beside the JSON
  const json=v=>{typed=0;return JSON.stringify(v,(k,x)=>{if(ArrayBuffer.isView(x)){typed+=x.byteLength;return undefined;}return x;});},content=v=>JSON.stringify(v,(k,x)=>ArrayBuffer.isView(x)?Array.from(x):x);
  const hold=(name,value)=>{const text=content(value);if(held.get(name)===text)again.push(name);held.set(name,text);};
  const entity=(list,key)=>(p,day)=>{for(const r of p[list]||[]){const k=list+':'+r[key];for(const f of GEOMETRY)if(r[f]!==undefined&&r[f]!==null&&typeof r[f]==='object'){hold(k+'.'+f,r[f]);if(f==='poly')sent.poly++;}}};
  const seen=new Set(),sees=[entity('armies','id'),entity('caravans','renderKey'),entity('envoys','id'),entity('travellers','renderKey'),entity('ships','id')];
  return {bytes,again,omitted,sent,flags,
    see(p){
      const text=json(p);bytes.push(text.length+typed);flags.days++;if(text.includes('"cands"'))again.push('the layout planner\'s lot candidates (cands) crossed');for(const k of ['structures','details','roads'])if(p.dirty[k])flags[k]++;
      for(const f of sees)f(p);
      for(const l of ['caravans','travellers','ships','envoys'])for(const r of p[l]||[]){const k=l+':'+(r.renderKey??r.id);if(r.poly===undefined&&seen.has(k))omitted.poly++;seen.add(k);}
      for(const r of p.roads||[]){const k='road:'+r.renderKey;for(const f of ['path','drawn','bridges'])if(r[f]!==undefined)hold(k+'.'+f,r[f]);if(r.path!==undefined)sent.roads++;}
      for(const s of p.settlements)for(const f of GEOMETRY)if(s[f]!==undefined&&s[f]!==null&&typeof s[f]==='object'){hold('settlement:'+s.si+'.'+f,s[f]);if(f==='streets')sent.streets++;}
      for(const s of p.settlements)if(s.streets===undefined&&seen.has('streets'+s.si))omitted.streets++;else if(s.streets!==undefined)seen.add('streets'+s.si);
      for(const b of p.buildings||[]){for(const f of GEOMETRY)if(b[f]!==undefined&&b[f]!==null&&typeof b[f]==='object')hold('building:'+b.idx+'.'+f,b[f]);sent.buildings++;}
      for(const f of p.fields||[]){for(const g of ['poly','sap'])if(f[g]!==undefined&&f[g]!==null)hold('field:'+f.k+'.'+g,f[g]);sent.fields++;}
    }};
}

let pending=null;
function world(){return pending||(pending=(async()=>{
  const M=realm(),D=display();
  await run(M,`WORKER_PRESENTATION.started=true;startSimulation({seed:${SEED},fate:${FATE},coast:'sea',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})`);
  install(D,run(M,'workerPresentation(true)'));
  const delta=deltaAudit();
  for(let i=1;i<=DAILY+REEL;i++){ // a month of daily packets, then a month at the Reel cadence; dirty marks accumulate between them
    await run(M,'STORAGE_OUTCOMES.wait()');assert.notEqual(run(M,'simTick()'),false);if(i%8===0)await run(M,'STORAGE_OUTCOMES.journal.flush()');
    if(i<=DAILY||(i-DAILY)%30===0){const packet=run(M,'workerPresentation()');if(i<=DAILY)delta.see(packet);install(D,packet);}
  }
  const out={M,D,day:run(M,'day()'),delta};
  out.completeness=run(M,`(()=>{const V=VISUAL_ENTITY,kinds=[['settlement',W.settlements,s=>visualSettlement(s,true)],['building',W.bldList,b=>visualBuilding(b)],['field',W.land.F,f=>visualField(f)],
    ['army',W.armies,a=>V.army(a)],['caravan',W.caravans,c=>V.caravan(c,0)],['envoy',W.envoys,e=>V.envoy(e)],['traveller',W.travellers,t=>V.traveller(t)],['ship',W.ships,s=>V.ship(s)],
    ['banditCamp',W.banditCamps,c=>V.banditCamp(c)],['dragon',W.dragon?[W.dragon]:[],d=>V.dragon(d)],['road',W.roads,r=>V.road(r)],['project',W.projects,q=>V.project(q)]];
    const missing={},probed=new Set(),counts={};
    for(const [kind,list,project] of kinds){counts[kind]=(list||[]).length;for(const o of list||[]){const record=project(o);
      for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(o))){if(k.startsWith('_'))continue;const name=kind+'.'+k;
        if(!Object.hasOwn(d,'value')){if(record[k]===undefined)missing[name]='accessor';continue;}
        if(d.value!==null&&typeof d.value==='object'){if(record[k]===undefined)missing[name]='object';continue;}
        // null today: would it cross on the day it holds something? (siegeBy was null at generation and dropped ever after)
        if(d.value===null&&!probed.has(name)){probed.add(name);const probe=Object.create(Object.getPrototypeOf(o),Object.getOwnPropertyDescriptors(o));probe[k]={x:1,z:2};
          const r=project(probe)[k];if(r===null||typeof r!=='object')missing[name]='null, then dropped as an object';}}}}
    return {counts,missing};})()`);
  // a fresh projection of the same day, installed into a display that never saw the daily packets
  const F=display();install(F,run(M,'workerPresentation(true)'));out.F=F;
  // every geometry copy in a bootstrap packet: primitives all cross, links are cut, no world entity is copied whole
  out.copies=run(M,`(()=>{const inner=visualGeometry,ents=new Map();const tag=(l,n)=>(l||[]).forEach(o=>o&&ents.set(o,n));
    tag(W.settlements,'settlement');tag(W.bldList,'building');tag(W.armies,'army');tag(W.land.F,'field');tag(W.caravans,'caravan');tag(W.roads,'road');
    const dropped={},copied={};let calls=0;
    visualGeometry=function(value,seen=new Set()){calls++;if(ents.has(value))copied[ents.get(value)]=(copied[ents.get(value)]||0)+1;const out=inner(value,seen);
      if(out&&typeof out==='object'&&!ArrayBuffer.isView(out))for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(value))){
        if(k.startsWith('_')||VISUAL_PRIVATE.has(k)||!Object.hasOwn(d,'value'))continue;const v=d.value;if((v===null||['number','string','boolean'].includes(typeof v))&&out[k]!==v&&!(Number.isNaN(v)&&Number.isNaN(out[k])))dropped[k]=(dropped[k]||0)+1;}
      return out;};
    try{const packet=workerPresentation(true);const trees=Object.values(packet.static.treeSpots).flat();
      return {calls,dropped,copied,trees:trees.length,sized:trees.filter(t=>Number.isFinite(t.s)).length,packet};}finally{visualGeometry=inner;}})()`);
  return out;
})());}

const canonFor=c=>{const W=run(c,'W'),ids=new Map(),tag=(l,n)=>(l||[]).forEach((o,i)=>o&&typeof o==='object'&&ids.set(o,n+':'+(o.idx??o.k??o.id??o.renderKey??i)));
  tag(W.settlements,'s');tag(W.bldList,'b');tag(W.land?.F,'f');tag(W.armies,'a');tag(W.roads,'r');tag(W.caravans,'c');tag(W.travellers,'t');tag(W.ships,'sh');tag(W.envoys,'e');tag(W.banditCamps,'bc');
  const canon=(v,top,seen=new Set())=>{if(v===null||typeof v!=='object')return Number.isNaN(v)?'NaN':v;if(!top&&ids.has(v))return '#'+ids.get(v);if(seen.has(v))return '#cycle';
    if(ArrayBuffer.isView(v))return Array.from(v);seen.add(v);let out;
    if(Array.isArray(v))out=v.map(x=>canon(x,false,seen));else{out={};for(const k of Object.keys(v).sort())if(!(k==='cut'&&v[k]===false))out[k]=canon(v[k],false,seen);} // an uncut tree may say so or not
    seen.delete(v);return out;};
  return {W,canon};};
const firstDifference=(x,y,p='')=>{if(JSON.stringify(x)===JSON.stringify(y))return null;
  if(x&&y&&typeof x==='object'&&typeof y==='object')for(const k of new Set([...Object.keys(x),...Object.keys(y)])){const r=firstDifference(x[k],y[k],p+'.'+k);if(r)return r;}
  return {path:p,a:x,b:y};};

test('daily and Reel packets keep the display world equal to a fresh projection of the same day',{timeout:300_000},async()=>{
  const {D,F,day}=await world();assert.equal(day,DAILY+REEL);
  const A=canonFor(D),B=canonFor(F),drift={};
  const note=(name,d)=>{if(!d)return;const allowed=DRIFT_ALLOWED[name];if(allowed&&allowed(d.a,d.b))return;(drift[name]||(drift[name]=[])).push(JSON.stringify(d).slice(0,300));};
  const compare=(kind,a,b)=>{for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))note(kind+'.'+k,firstDifference(A.canon(a?.[k],false),B.canon(b?.[k],false)));};
  for(const [list,kind,key] of [['settlements','s'],['bldList','b'],['armies','a','id'],['caravans','c','renderKey'],['travellers','t','renderKey'],['ships','sh','id'],['envoys','e','id'],['banditCamps','bc','id'],['roads','r','renderKey']]){
    const a=(A.W[list]||[]).filter(o=>!o.gone),b=B.W[list]||[];assert.equal(a.length,b.length,`${list}: as many in the display as in the world`);
    if(!key)a.forEach((o,i)=>compare(kind,o,b[i]));else{const by=new Map(b.map(o=>[o[key],o]));for(const o of a){assert.ok(by.has(o[key]),`${list} ${o[key]} is still in the world`);compare(kind,o,by.get(o[key]));}}
  }
  A.W.land.F.forEach((f,i)=>compare('f',f,B.W.land.F[i]));
  assert.ok(A.W.bldList.filter(b=>b?.lot?.length>2).length>300,'house lots (fences, gardens, furrow bearings) are among the records compared');
  assert.deepEqual(Array.from(A.W.land.mask),Array.from(B.W.land.mask),'land mask');
  for(const k of new Set([...Object.keys(A.W),...Object.keys(B.W)]))if(!['settlements','bldList','armies','caravans','travellers','ships','envoys','banditCamps','roads','land'].includes(k)){
    const d=firstDifference(A.canon(A.W[k],true),B.canon(B.W[k],true));if(d)note('W.'+k+d.path,{...d,path:''});}
  assert.deepEqual(drift,{},'display fields that drifted from the world');
});

test('a daily packet carries only what changed: geometry the foreground already holds does not cross again',{timeout:300_000},async()=>{
  const {delta}=await world();
  assert.deepEqual([...new Set(delta.again)].slice(0,10),[],'geometry that crossed again, unchanged');
  assert.ok(delta.omitted.poly>0&&delta.omitted.streets>0,'the month has records the screen held from an earlier packet: '+JSON.stringify(delta.omitted));
  assert.ok(delta.sent.poly>0&&delta.sent.buildings>0,'and new ones that crossed whole: '+JSON.stringify(delta.sent));
  const steady=delta.bytes.slice(1).sort((a,b)=>a-b),median=steady[steady.length>>1];
  assert.ok(median<BYTES_MEDIAN,`a daily packet's median size is ${median} bytes; ${JSON.stringify(steady.slice(-3))} at most`);
  assert.ok(delta.flags.structures<delta.flags.days,'the screen is told its structures changed on some days only: '+JSON.stringify(delta.flags));
});

test('every object-valued name of a drawn thing crosses, or is named here as the worker\'s own',{timeout:300_000},async()=>{
  const {completeness:{counts,missing}}=await world();
  assert.ok(counts.settlement>=6&&counts.building>300&&counts.army>0,'the run exercises towns, buildings and hosts: '+JSON.stringify(counts));
  const unexplained=Object.entries(missing).filter(([name])=>{const [kind,k]=name.split('.');return !WORKER_ONLY[kind]?.[k];});
  assert.deepEqual(Object.fromEntries(unexplained),{},'project these names, or say in WORKER_ONLY why the foreground never reads them');
});

test('geometry copies keep every primitive (a tree\'s size s) and never copy a world entity whole',{timeout:300_000},async()=>{
  const {copies:raw}=await world(),copies={...JSON.parse(JSON.stringify({...raw,packet:undefined})),packet:raw.packet}; // out of the model's realm
  assert.ok(copies.calls>1000);assert.deepEqual(copies.dropped,{},'primitive names dropped by visualGeometry');assert.deepEqual(copies.copied,{},'world entities copied into a packet');
  assert.ok(copies.trees>1000);assert.equal(copies.sized,copies.trees,'every tree crosses with its size');
  const forbidden=new Set(['_owners','_hh','household','households','account','ownerAccount','beneficiary','storage','ledger','holdings']),seen=new Set();
  const visit=(v,p)=>{if(!v||typeof v!=='object'||seen.has(v)||ArrayBuffer.isView(v))return;seen.add(v);assert.ok(!['[object Map]','[object Set]'].includes(Object.prototype.toString.call(v)),p+' is a Map or Set');
    for(const [k,x] of Object.entries(v)){assert.ok(!forbidden.has(k),`${p}.${k} leaks private state`);visit(x,p+'.'+k);}};
  visit(copies.packet,'$');
});

test('a real siege crosses as names: the besiegers\' ring, the stormed circuit and the gate are the displayed ones',{timeout:300_000},async()=>{
  const {M,D}=await world();
  const before=run(M,`(()=>{const s=W.settlements.find(t=>fortCircuits(t).length),a=W.armies.find(x=>!x.gone);if(!s||!a)return null;
    a.state='siege';s.siegeBy={houseName:W.houses[a.house].name,army:a};siegeArc(a,s);s.takenCircuit=a.siegeArc.circuit;
    const p=workerPresentation(),rec=p.armies.find(x=>x.id===a.id),key=fortCircuitKey(s,a.siegeArc.circuit),si=W.settlements.indexOf(s);
    return {packet:p,si,id:a.id,key,arcBytes:JSON.stringify(rec.siegeArc).length,gate:siegeGate(s,a.siegeArc)?.a??null};})()`);
  assert.ok(before,'the realm has a fortified place and a host');
  assert.ok(before.key&&before.arcBytes<200,`the besiegers' lines cross as a circuit name, not a copy of the town (${before.arcBytes} bytes)`);
  install(D,before.packet);
  const after=run(D,`(()=>{const s=W.settlements[${before.si}],a=W.armies.find(x=>x.id===${before.id}),ring=fortCircuitFor(s,${JSON.stringify(before.key)});
    return {ring:a.siegeArc.circuit===ring,taken:s.takenCircuit===ring,host:s.siegeBy?.army===a,house:s.siegeBy?.houseName,gate:siegeGate(s,a.siegeArc)?.a??null,gateCircuit:siegeGate(s,a.siegeArc)?.circuit===ring};})()`);
  assert.equal(after.ring,true,'siegeArc.circuit is the displayed ring');assert.equal(after.taken,true,'takenCircuit is the displayed ring');
  assert.equal(after.host,true,'siegeBy.army is the displayed host');assert.ok(after.house);
  assert.equal(after.gateCircuit,true);assert.equal(after.gate,before.gate,'the gate the rams go for is the worker\'s gate');
});
