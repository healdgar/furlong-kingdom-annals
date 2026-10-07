#!/usr/bin/env node
// Full-source, graphics-free simulation runner. It executes the game's own
// generator and master tick; no fixture world or replacement simTick is used.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEFAULT_SOURCE=path.join(ROOT,'index.html');

export function inlineGameScript(html){
  const marker='<script>',first=html.indexOf(marker),start=html.indexOf(marker,first+marker.length);
  if(first<0||start<0)throw Error('Could not locate the game script');
  const bodyStart=start+marker.length,end=html.indexOf('</script>',bodyStart);
  if(end<0)throw Error('Could not close the game script');
  return html.slice(bodyStart,end);
}

// math: the engine's Math, or a stand-in for another engine's (its own rounding of sin, exp, pow...). The game puts its own
// functions (DM) on the Math it is given, so it gets a child of it, and this process's Math stays as it was.
export function contextFor(source,hash,math=Math){
  const context={FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash},__hashWorldGraph:graph=>{
    const digest=createHash('sha256');const feed=v=>{
      if(v===null||typeof v!=='object'){digest.update(JSON.stringify(v));return;}
      if(Array.isArray(v)){digest.update('[');for(let i=0;i<v.length;i++){if(i)digest.update(',');feed(v[i]);}digest.update(']');return;}
      digest.update('{');const keys=Object.keys(v);for(let i=0;i<keys.length;i++){if(i)digest.update(',');digest.update(JSON.stringify(keys[i])+':');feed(v[keys[i]]);}digest.update('}');
    };feed(graph);return {sha256:digest.digest('hex'),nodes:graph.state.length,changes:graph.changes.length,functions:graph.code.length};
  },
    addEventListener(){},removeEventListener(){},requestAnimationFrame(){},setTimeout,clearTimeout,
    performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,
    Date,Math:Object.create(math),Number,Intl,Promise,Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,
    Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,
    Error,TypeError,RangeError,JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,
    ...(typeof CompressionStream==='undefined'?{}:{CompressionStream}),
    ...(typeof DecompressionStream==='undefined'?{}:{DecompressionStream}),
    ...(typeof Response==='undefined'?{}:{Response})};
  const vmContext=vm.createContext(context,{name:'furlong-model-only'});
  new vm.Script(source,{filename:'index.html'}).runInContext(vmContext,{timeout:30_000});
  return vmContext;
}

const ownerId=(o,W)=>o==null?'unassigned':typeof o!=='object'?`${typeof o}:${o}`:
  o.household?`household:${o.id}`:W.houses?.includes(o)?`house:${W.houses.indexOf(o)}`:
  W.settlements?.includes(o)?`settlement:${W.settlements.indexOf(o)}`:
  o.id!=null?`entity:${o.id}`:o.name?`name:${o.name}`:o.arch?`building:${o.arch}:${o.x}:${o.z}`:'object';
const numeric=o=>Object.fromEntries(Object.entries(o||{}).filter(([,v])=>typeof v==='number').sort(([a],[b])=>a.localeCompare(b)));

// Explicit semantic projection: presentation buffers, camera interpolation,
// visual caches, and DOM state are omitted. Simulation journals and RNG are kept.
export function captureExpression(){return `(()=>{
 const own=o=>o==null?'unassigned':typeof o!=='object'?typeof o+':'+o:o.household?'household:'+o.id:W.houses?.includes(o)?'house:'+W.houses.indexOf(o):W.settlements?.includes(o)?'settlement:'+W.settlements.indexOf(o):o.id!=null?'entity:'+o.id:o.name?'name:'+o.name:o.arch?'building:'+o.arch+':'+o.x+':'+o.z:'object';
 const nums=o=>Object.fromEntries(Object.entries(o||{}).filter(([,v])=>typeof v==='number').sort(([a],[b])=>a.localeCompare(b)));
 const person=p=>p&&({id:p.id,b:p.b,dd:p.dd,dead:!!p.dead,alive:p.alive,sx:p.sx,si:p.si,household:p._hh?.id??null,w:p.w,debt:p._debt,lifeEventCount:p.ev?.length||0,traits:p.traits,skills:p.sk});
 const people=new Map();const add=p=>{if(p&&Number.isInteger(p.id)&&!people.has(p.id))people.set(p.id,person(p));};
 for(const s of W.settlements||[])for(const p of s.folk||[])add(p);
 for(const h of W.households?.values()||[]){add(h.head);for(const p of h.members||[])add(p);}
 for(const p of W.notables||[])add(p);
 const settlements=(W.settlements||[]).map((s,si)=>({si,name:s.name,kind:s.kind,pop:s.pop,hunger:s.hunger,stores:nums(s.stores),
   buildings:(s.buildings||[]).map(b=>({arch:b.arch,x:b.x,z:b.z,w:b.w,d:b.d,rot:b.rot,state:b.state,removed:!!b.removed,tier:b.tier,owner:own(b.ownerId),hh:(b.hh||[]).map(h=>h.id)})),
   owners:[...(s._owners||[])].map(([o,x])=>[own(o),{held:nums(x.held),sale:nums(x.sale),reserve:nums(x.reserve),animals:nums(x.animals)}]).sort(([a],[b])=>a.localeCompare(b)),
   households:[...(s.folk||[])].length,land:W.land?.F?.filter(f=>f.dom===si).map(f=>({k:f.k,state:f.state,dom:f.dom,lord:f.lord,ten:own(f.ten),own:own(f.own),held:f.held,area:f.area}))||[],
   storage:s.storage?{version:s.storage.version,revision:s.storage.revision,lots:[...(s.storage.lots?.values()||[])].map(l=>({id:l.id,owner:own(l.owner),good:l.good,qty:l.qty,availability:l.availability,location:l.location})).sort((a,b)=>String(a.id).localeCompare(String(b.id)))}:null}));
 const households=[...(W.households?.values()||[])].map(h=>({id:h.id,head:h.head?.id??null,members:[...(h.members||[])].map(p=>p.id).sort((a,b)=>a-b),population:[...(h.population||[])].map(([s,n])=>[W.settlements.indexOf(s),n]).sort(([a],[b])=>a-b),hunger:h.hunger,purse:h.assets?.w??0,debt:h.assets?._debt??0,owe:(h.assets?._owe||[]).map(([o,q])=>[own(o),q]).sort(([a],[b])=>a.localeCompare(b)),pantry:(W.settlements||[]).map((s,i)=>[i,s._owners?.get(h)?.held||{}]).filter(([,p])=>Object.keys(p||{}).length)})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const graph=new HistoryGraph();const frame=graph.capture(HISTORY.roots(),{skipQueryScratch:true});
 const worldGraph=globalThis.__hashWorldGraph({root:frame.root,changes:frame.changes,state:[...graph.state].sort(([a],[b])=>a-b),code:graph.code});
 const modelGraph=new HistoryGraph(),modelFrame=modelGraph.capture(W,{skipQueryScratch:true});
 const worldOnlyGraph=globalThis.__hashWorldGraph({root:modelFrame.root,changes:modelFrame.changes,state:[...modelGraph.state].sort(([a],[b])=>a-b),code:modelGraph.code});
 return {day:W.clock.day,startAD:W.startAD,seed:W.seed,fate:W.fate,treasury:W.treasury,population:W.settlements?.map(s=>s.pop),settlements,households,people:[...people.values()].sort((a,b)=>a.id-b.id),houses:(W.houses||[]).map(h=>({name:h.name,gold:h.gold,debt:h.debt,extinct:h.extinct})),journals:{commands:JOURNAL,annals:allLines,history:HISTORY.active?HISTORY.records:null,storage:STORAGE_OUTCOMES.journal?{seq:STORAGE_OUTCOMES.journal.seq,rows:[...STORAGE_OUTCOMES.journal.uncommitted()].map(r=>({seq:r.seq,event:r.event}))}:null},rng:Object.fromEntries(Object.entries(RS||{}).map(([k,r])=>[k,r.state?.()||null])),resumed:RESUMED,worldGraph,worldOnlyGraph,mod:{...MOD}};
})()`;}

export async function runSimulation({sourcePath=DEFAULT_SOURCE,seed=1001,fate=42,coast='sea',startAD=850,days=8,roundTrip=false,math=Math}={}){
  if(!Number.isInteger(days)||days<0||days>360)throw Error('days must be an integer from 0 through 360');
  const html=fs.readFileSync(sourcePath,'utf8'),htmlSHA256=createHash('sha256').update(html).digest('hex');
  const source=inlineGameScript(html);
  const hash=`#s=${seed>>>0}&f=${fate>>>0}&c=${coast}&y=${startAD}`;
  const ctx=contextFor(source,hash,math);
  await vm.runInContext(`startSimulation({seed:${seed>>>0},fate:${fate>>>0},coast:${JSON.stringify(coast)},startAD:${startAD},outcomeJournal:new OutcomeJournal(async entry=>({chunk:entry.chunk,first:entry.first,last:entry.last}),{maxPendingBytes:64*1024*1024})})`,ctx,{timeout:120_000});
  if(roundTrip)vm.runInContext(`jot({k:'sov',on:true,hi:0});setSovereign(true,0);setRulerRate('tax',20)`,ctx,{timeout:15_000});
  const snapshot=`JSON.stringify(${captureExpression()})`;
  const start=JSON.parse(vm.runInContext(snapshot,ctx,{timeout:30_000}));
  for(let i=0;i<days;i++){
    await vm.runInContext('STORAGE_OUTCOMES.wait()',ctx,{timeout:15_000});
    const ran=vm.runInContext('simTick()',ctx,{timeout:15_000});
    if(ran===false)throw Error(`simulation tick ${i+1} was blocked by the storage journal`);
    if((i+1)%8===0&&i+1<days)await vm.runInContext('STORAGE_OUTCOMES.journal.flush()',ctx,{timeout:15_000});
  }
  const end=JSON.parse(vm.runInContext(snapshot,ctx,{timeout:30_000}));
  const canonical=JSON.stringify(end),digest=createHash('sha256').update(canonical).digest('hex');
  let replay=null,saveInfo=null;
  if(roundTrip){
    const code=await vm.runInContext('packSave(makeSave("simulation boundary"))',ctx,{timeout:30_000});
    const savedEnd=JSON.parse(vm.runInContext(snapshot,ctx,{timeout:30_000}));
    const saveJSON=await vm.runInContext(`unpackSave(${JSON.stringify(code)}).then(o=>JSON.stringify(o))`,ctx,{timeout:30_000});
    const save=JSON.parse(saveJSON);saveInfo={day:save.day,commands:save.j.length,build:save.build,encoding:code.slice(0,2)};
    const replayCtx=contextFor(source,hash,math);
    await vm.runInContext(`startSimulation({seed:${seed>>>0},fate:${fate>>>0},coast:${JSON.stringify(coast)},startAD:${startAD},outcomeJournal:new OutcomeJournal(async entry=>({chunk:entry.chunk,first:entry.first,last:entry.last}),{maxPendingBytes:64*1024*1024})})`,replayCtx,{timeout:120_000});
    await vm.runInContext(`replaySave(${saveJSON}).then(()=>undefined)`,replayCtx,{timeout:120_000});
    const replayEnd=JSON.parse(vm.runInContext(snapshot,replayCtx,{timeout:30_000}));
    replay={readyDay:start.day,endDay:replayEnd.day,worldOnlySHA256:replayEnd.worldOnlyGraph.sha256,rng:replayEnd.rng,households:replayEnd.households,settlements:replayEnd.settlements,journals:replayEnd.journals,mod:replayEnd.mod,resumed:replayEnd.resumed,annals:replayEnd.journals.annals,savedEnd:{worldOnlySHA256:savedEnd.worldOnlyGraph.sha256,rng:savedEnd.rng,households:savedEnd.households,settlements:savedEnd.settlements,mod:savedEnd.mod,journals:savedEnd.journals}};
  }
  return {htmlSHA256,seed:seed>>>0,fate:fate>>>0,coast,startAD,requestedDays:days,readyDay:start.day,endDay:end.day,settlementCount:end.settlements.length,buildingCount:end.settlements.reduce((n,s)=>n+s.buildings.length,0),householdCount:end.households.length,digest,start,end,saveInfo,replay};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
  const result=await runSimulation({sourcePath:value('--source',DEFAULT_SOURCE),seed:Number(value('--seed',1001)),fate:Number(value('--fate',42)),coast:value('--coast','sea'),startAD:Number(value('--start-ad',850)),days:Number(value('--days',8)),roundTrip:args.includes('--roundtrip')});
  const out=value('--out',null);if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,start:undefined,end:undefined},null,2));
}
