#!/usr/bin/env node
/* The late-world farm (#48): play a world in Node to a late year in segments, each in a fresh realm loaded from the last
   segment's world save (docs/WORLD-SAVE.md), and take a census of the world at every save. Saves stay on disk, so a study
   can start from any of them, and a farm that stopped goes on from its last save.

   node tools/farm.mjs --world 42:42:sea --to 1066 --out tools/soak-results/farm-42 [--segment 10] [--check 30] [--from file]
   Options: --km N (map size)  --segment years (10)  --milestones 900,950,1000,1066,1250,1450 (saves fall on these years too)
            --check days: after each save, the realm plays on this many days and the next segment's loaded realm must play the
                          same days (world graph, RNG, annals, commands, journal); 0: no check (default 30)
            --from file.fws.gz: go on from a save (its world must be the one named)
   Writes <out>/<world>-AD<year>.fws.gz, <out>/census.jsonl (one line per save) and <out>/farm.log; prints each segment's
   CPU per day and the load beside it. Runs one realm at a time. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const A=Object.fromEntries(process.argv.slice(2).reduce((o,a,i,v)=>{if(a.startsWith('--'))o.push([a.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:'1']);return o;},[]));
const [seed,fate,coast]=(A.world||'42:42:sea').split(':'),W0={seed:+seed,fate:+(fate??seed),coast:coast||'sea',km:A.km?+A.km:null};
const TO=+(A.to||1066),SEG=+(A.segment||10),CHECK=+(A.check??30),MILES=(A.milestones||'900,950,1000,1066,1250,1450').split(',').map(Number);
const OUT=path.resolve(A.out||path.join(HERE,'soak-results','farm-'+W0.seed+'-'+W0.coast));fs.mkdirSync(OUT,{recursive:true});
const ID=`${W0.seed}-${W0.fate}-${W0.coast}${W0.km?'-km'+W0.km:''}`,HASH=`#s=${W0.seed}&f=${W0.fate}&c=${W0.coast}&y=850${W0.km?'&km='+W0.km:''}`;
const SOURCE=inlineGameScript(fs.readFileSync(path.join(HERE,'..','index.html'),'utf8'));
const log=(...a)=>{const line=new Date().toISOString().slice(11,19)+' '+a.join(' ');console.log(line);fs.appendFileSync(path.join(OUT,'farm.log'),line+'\n');};

// The census, read from outside the simulation: what the world has grown into by this year.
const CENSUS=`(()=>{const S=W.settlements,kinds={},arch={},lists={};let walled=0,sound=0,ruins=0,folk=0,streetN=0,streetE=0,density=[];
  for(const s of S){kinds[s.kind]=(kinds[s.kind]||0)+1;if(s.wallRad||s.walls>0)walled++;folk+=(s.folk||[]).length;let n=0;
    for(const b of s.buildings||[]){if(b.removed)continue;if(b.state==='sound'){sound++;n++;arch[b.arch]=(arch[b.arch]||0)+1;}else if(b.state==='ruin')ruins++;}
    const R=s.extentR||s.radius||0;if(s.kind!=='village'&&R>0)density.push([s.name,+(n/(Math.PI*R*R/1e4)).toFixed(2)]);
    if(s.kind!=='village'){const g=streetGraph(s);streetN+=g.N.length;for(const a of g.adj)streetE+=a.length;}}
  for(const k of Object.keys(W)){const v=W[k];const n=Array.isArray(v)?v.length:v instanceof Map||v instanceof Set?v.size:null;if(n!=null)lists[k]=n;}
  const big=Object.entries(lists).sort((a,b)=>b[1]-a[1]).slice(0,16);
  return {ad:AD(),day:day(),realm:W.name,places:S.length,kinds,pop:Math.round(S.reduce((t,s)=>t+s.pop,0)),capital:Math.round(W.capital?.pop||0),
    largest:S.map(s=>[s.name,s.kind,Math.round(s.pop)]).sort((a,b)=>b[2]-a[2]).slice(0,5),walled,buildings:sound,ruins,arch:Object.fromEntries(Object.entries(arch).sort((a,b)=>b[1]-a[1]).slice(0,24)),
    density:density.sort((a,b)=>b[1]-a[1]).slice(0,6),streetNodes:streetN,streetEdges:streetE/2,households:W.households?.size??null,folk,abbeys:W.abbeys?.length||0,guilds:W.guilds?.length||0,
    treasury:Math.round(W.treasury),houses:Math.round(W.houses.slice(1).reduce((t,h)=>t+(h?.gold||0),0)),famine:S.filter(s=>s.famineFlag).length,lists:Object.fromEntries(big),faults:typeof SIM_FAULTS!=='undefined'?SIM_FAULTS.list.length:0};})()`;
const DIGEST=`JSON.stringify((()=>{const g=new HistoryGraph(),f=g.capture(W,{skipQueryScratch:true});let a=0x811c9dc5;const t=JSON.stringify([f.root,[...g.state],g.code]);for(let i=0;i<t.length;i++)a=Math.imul(a^t.charCodeAt(i),16777619);
  return {day:day(),world:(a>>>0).toString(16)+':'+t.length,rng:JSON.stringify(Object.entries(RS).map(([k,r])=>[k,r.state()])),annals:allLines.length+':'+JSON.stringify(allLines.slice(-3)),commands:JSON.stringify(JOURNAL).length,journal:STORAGE_OUTCOMES.journal.seq};})())`;

// One segment in a realm of its own: start (or load the last save), check the days the last realm played past its save, play to
// the segment's end, save, take the census, and play on the check days for the next segment to match.
const REALM=`{const {parentPort,workerData:{source,hash,w,doc,endDay,check,census,digest}}=require('node:worker_threads'),vm=require('node:vm');
  for(const k of ['localStorage','sessionStorage','navigator'])Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
  Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
  vm.runInThisContext(source,{filename:'index.html'});const R=c=>vm.runInThisContext(c);globalThis.__source=source;globalThis.__doc=doc;
  const journal='new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})';
  const play=async()=>{await R('STORAGE_OUTCOMES.wait()');if(R('simTick()')===false)throw Error('day '+R('day()')+' was blocked by the storage journal');if(R('day()')%8===0)await R('STORAGE_OUTCOMES.journal.flush()');};
  (async()=>{const out={};
    if(doc)await R('worldLoad(__doc,{source:__source,outcomeJournal:'+journal+'})');
    else await R('startSimulation({seed:'+w.seed+',fate:'+w.fate+',coast:'+JSON.stringify(w.coast)+',startAD:850,outcomeJournal:'+journal+'})');
    out.startDay=R('day()');
    if(doc&&check){out.checked=[];for(let i=0;i<check;i++)await play();out.checked=R(digest);}
    const t0=process.cpuUsage(),d0=R('day()');while(R('day()')<endDay)await play();const c=process.cpuUsage(t0);out.days=R('day()')-d0;out.cpu=(c.user+c.system)/1e3;
    await R('STORAGE_OUTCOMES.flush()');out.census=R(census);out.doc=await R('worldSave({source:__source})');
    if(check){for(let i=0;i<check;i++)await play();out.after=R(digest);}
    parentPort.postMessage(out);})().catch(e=>parentPort.postMessage({error:String(e.stack||e)}));}`;
function segment(doc,endDay){return new Promise((resolve,reject)=>{const w=new Worker(REALM,{eval:true,resourceLimits:{maxOldGenerationSizeMb:12288},workerData:{source:SOURCE,hash:HASH,w:W0,doc,endDay,check:CHECK,census:CENSUS,digest:DIGEST}});
  w.once('message',m=>{w.terminate();m.error?reject(Error(m.error)):resolve(m);});w.once('error',reject);w.once('exit',code=>{if(code)reject(Error('realm exited '+code));});});}

const dayOf=ad=>(ad-850)*360; // a world starts on day 0 of AD 850
const ends=[];for(let y=850+SEG;y<TO;y+=SEG)ends.push(y);for(const m of MILES)if(m>850&&m<=TO)ends.push(m);ends.push(TO);
const years=[...new Set(ends)].sort((a,b)=>a-b);
let doc=null,prev=null,from=850;
if(A.from){doc=gunzipSync(fs.readFileSync(A.from));const m=/AD(\d+)/.exec(path.basename(A.from));from=m?+m[1]:850;}
log(`farm ${ID}: AD ${from} to ${TO} in ${years.filter(y=>y>from).length} segments, check ${CHECK} days → ${OUT}`);
for(const y of years){if(y<=from)continue;const load0=os.loadavg()[0],t0=Date.now();
  const r=await segment(doc,dayOf(y));
  if(prev&&CHECK){const same=JSON.stringify(r.checked)===JSON.stringify(prev);if(!same){log(`AD ${y}: the loaded world parted from the one saved, ${CHECK} days on: ${JSON.stringify({saved:prev,loaded:r.checked}).slice(0,600)}`);process.exit(1);}}
  doc=Buffer.from(r.doc);prev=r.after||null;const file=path.join(OUT,`${ID}-AD${y}.fws.gz`),gz=gzipSync(doc);fs.writeFileSync(file,gz);
  fs.appendFileSync(path.join(OUT,'census.jsonl'),JSON.stringify({world:ID,...r.census,msDay:+(r.cpu/r.days).toFixed(1),days:r.days,load:+load0.toFixed(2),save:{bytes:doc.length,gzipped:gz.length}})+'\n');
  log(`AD ${y}: ${r.days} days at ${(r.cpu/r.days).toFixed(1)} ms CPU/day (load ${load0.toFixed(2)}), ${((Date.now()-t0)/60e3).toFixed(1)} min; ${r.census.places} places, ${r.census.pop} people, capital ${r.census.capital}, ${r.census.buildings} buildings; save ${(gz.length/1e6).toFixed(1)} MB${prev&&CHECK?'; continuation checked':''}`);}
log('farm done');
