// A world saved at a day's end and loaded into a fresh realm goes on as the world that was saved (docs/WORLD-SAVE.md):
// the loaded realm captures equal to the saved one, saves again to the same bytes, and every day after is the same day
// in both: the world's graph (its closures' source text included), every RNG stream, the annals, the commands and the
// storage journal. Each realm is a worker thread of its own, as tools/engine-math.test.mjs grows one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {inlineGameScript,captureExpression} from './simulation-boundary.mjs';

const SOURCE=inlineGameScript(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
const N=37,K=55; // the save falls on no week, month or year: the journal's flushes, the month's reckoning and the year's turn come after it
const KEYS=process.env.FURLONG_WORLD_SAVE_KEYS==='1'; // name the keys of W that differ (slower)

const REALM=`{const {parentPort,workerData:{source,seed,fate,coast,N,K,doc,capture,keys}}=require('node:worker_threads'),vm=require('node:vm'),{createHash}=require('node:crypto');
  for(const k of ['localStorage','sessionStorage','navigator'])Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
  Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash:'#s='+seed+'&f='+fate+'&c='+coast+'&y=850'},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
  globalThis.__hashWorldGraph=graph=>{const digest=createHash('sha256'),feed=v=>{ // as tools/simulation-boundary.mjs hashes it
      if(v===null||typeof v!=='object'){digest.update(JSON.stringify(v));return;}
      if(Array.isArray(v)){digest.update('[');for(let i=0;i<v.length;i++){if(i)digest.update(',');feed(v[i]);}digest.update(']');return;}
      digest.update('{');const ks=Object.keys(v);for(let i=0;i<ks.length;i++){if(i)digest.update(',');digest.update(JSON.stringify(ks[i])+':');feed(v[ks[i]]);}digest.update('}');};
    feed(graph);return {sha256:digest.digest('hex'),nodes:graph.state.length,changes:graph.changes.length,functions:graph.code.length};};
  vm.runInThisContext(source,{filename:'index.html'});const R=c=>vm.runInThisContext(c),h=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
  globalThis.__source=source;globalThis.__doc=doc;
  const journal='new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})';
  const summary=()=>{const c=R(capture),o={day:c.day};for(const k of Object.keys(c))if(k!=='day'&&k!=='worldGraph'&&k!=='worldOnlyGraph')o[k]=h(JSON.stringify(c[k]));
    o.worldGraph=c.worldGraph.sha256;o.worldOnlyGraph=c.worldOnlyGraph.sha256;
    if(keys){o.keys=R('(()=>{const out={};for(const k of Object.keys(W)){const g=new HistoryGraph(),f=g.capture(W[k],{skipQueryScratch:true});out[k]=JSON.stringify([f.root,[...g.state].sort((x,y)=>x[0]-y[0]),g.code]);}return out;})()');for(const k in o.keys)o.keys[k]=h(o.keys[k]);}
    return o;};
  const day=()=>({day:R('W.clock.day'),rng:h(R('JSON.stringify(Object.entries(RS).map(([k,r])=>[k,r.state()]))')),annals:h(R('JSON.stringify(allLines)')),commands:h(R('JSON.stringify(JOURNAL)')),
    journal:R('STORAGE_OUTCOMES.journal.seq'),treasury:R('W.treasury'),people:R('W.settlements.reduce((t,s)=>t+s.pop,0)')});
  const play=async i=>{await R('STORAGE_OUTCOMES.wait()');if(R('simTick()')===false)throw Error('day '+i+' was blocked by the storage journal');if(i%8===0)await R('STORAGE_OUTCOMES.journal.flush()');};
  (async()=>{const out={},t0=process.cpuUsage();
    if(!doc){await R('startSimulation({seed:'+seed+',fate:'+fate+',coast:'+JSON.stringify(coast)+',startAD:850,outcomeJournal:'+journal+'})');
      for(let i=1;i<=N;i++)await play(i);
      R(\`(()=>{const s=W.capital,P=folkIndex(),h=headsOf(s)[0],f=(s.furl||[]).find(f=>P.has(f.wk));if(!h||!f)throw Error('court save fixture needs a head and holding');
        f._arr=10;courtPlead(s,'arrears',f.wk,10,f,lordAcct(s));
        courtPlead(s,'farm',h.id,10000,{who:h.id,arr:10000,paid:0},lordAcct(s)); // a retired farm survives through its unpaid plea alone
        courtPlead(s,'entry',h.id,10000,f,lordAcct(s));return true;})()\`);
      await R('STORAGE_OUTCOMES.flush()');out.at=summary(); // the save commits the journal: capture after the commit, as the document holds it
      const s0=process.cpuUsage();out.doc=await R('worldSave({source:__source})');out.saveCPU=process.cpuUsage(s0);parentPort.postMessage({doc:out.doc});}
    else{const l0=process.cpuUsage();await R('worldLoad(__doc,{source:__source,outcomeJournal:'+journal+'})');out.loadCPU=process.cpuUsage(l0);
      out.at=summary();out.doc=await R('worldSave({source:__source})');}
    out.days=[];for(let i=N+1;i<=N+K;i++){await play(i);out.days.push(day());}
    out.end=summary();out.cpu=process.cpuUsage(t0);parentPort.postMessage({done:out});})().catch(e=>parentPort.postMessage({error:String(e.stack||e)}));}`; // in a block: its names stay out of the game's global scope

// One realm: the played one posts its document as soon as it has saved, then plays on; a loaded one is given a document.
function realm(world,doc=null,onDoc=()=>{}){return new Promise((resolve,reject)=>{
  const w=new Worker(REALM,{eval:true,workerData:{source:SOURCE,...world,N,K,doc,capture:captureExpression(),keys:KEYS}});
  w.on('message',m=>{if(m.error){reject(Error(m.error));w.terminate();}else if(m.doc)onDoc(m.doc);else if(m.done){resolve(m.done);w.terminate();}});
  w.once('error',reject);w.once('exit',code=>{if(code)reject(Error('realm exited '+code));});});}
const differ=(a,b)=>Object.keys({...a,...b}).filter(k=>k!=='keys'&&JSON.stringify(a[k])!==JSON.stringify(b[k])).concat(a.keys&&b.keys?Object.keys({...a.keys,...b.keys}).filter(k=>a.keys[k]!==b.keys[k]).map(k=>'W.'+k):[]);
const cpu=c=>((c.user+c.system)/1e6).toFixed(1)+' s';

for(const world of [{seed:42,fate:42,coast:'sea'},{seed:1001,fate:42,coast:'sea'}])
  test(`world ${world.seed} ${world.coast}: saved on day ${N} and loaded in a fresh realm, it goes on as the world that was saved`,async t=>{
    let loaded;const played=realm(world,null,doc=>{loaded=realm(world,doc);});
    const A=await played,B=await loaded;
    t.diagnostic(`document ${(A.doc.length/1e6).toFixed(2)} MB, gzipped ${(gzipSync(A.doc).length/1e6).toFixed(2)} MB; save ${cpu(A.saveCPU)} CPU, load ${cpu(B.loadCPU)} CPU; realms ${cpu(A.cpu)} and ${cpu(B.cpu)} CPU`);
    assert.equal(A.at.day,N);
    assert.deepEqual(differ(A.at,B.at),[],'the loaded world captures as the saved one');
    assert.equal(createHash('sha256').update(B.doc).digest('hex'),createHash('sha256').update(A.doc).digest('hex'),'saved again, the loaded world is the same document');
    for(let i=0;i<K;i++)assert.deepEqual(B.days[i],A.days[i],`day ${N+1+i}`);
    assert.deepEqual(differ(A.end,B.end),[],`the worlds after ${K} more days`);
  });
