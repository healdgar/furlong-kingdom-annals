import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

const baseline=execFileSync('git',['show','e3636c6:index.html'],{encoding:'utf8',maxBuffer:20e6});
const current=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const oldExposed=baseline.match(/^  exposedLots\(\)\{.*$/m)[0].trim().replace(/^exposedLots/,'function');
const historyGraph=current.match(/class HistoryGraph\{[\s\S]*?(?=class HistoryArchive\{)/)[0];
function pair(){return [true,false].map(old=>{
  const r=realm({grain:0,fish:0,cash:100});
  r.eval("storageInit(s);globalThis.K=s.storage;K.location('yard',{exposed:true,x:0,z:0});K.create('ore',1,null,'yard');K.create('ore',2,null,'yard');storageTitles(s)");
  if(old)r.eval('K.exposedLots='+oldExposed);
  return r;
});}
function ids(r){return JSON.parse(r.eval("JSON.stringify(K.exposedLots().map(l=>l.id))"));}
function compare(pair,expr){const values=pair.map(r=>r.eval(expr));assert.deepEqual(values[1],values[0]);}
function ledgerState(r){return r.eval("JSON.stringify({next:K.next,revision:K.revision,sequence:K.sequence,events:K.events,lots:[...K.lots.values()].map(l=>K.lotState(l)),locations:[...K.locations.values()].map(n=>K.locationState(n)),byLocation:[...K.byLocation].map(([id,ids])=>[id,[...ids]])})");}

test('exposed lookup visits one indexed location amid large cargo archives',()=>{
  for(const cargo of [1000,10000]){
    const P=pair();
    assert.equal(P[0].eval('typeof K.exposedLots'),'function');
    for(const r of P)r.eval(`for(let i=0;i<${cargo};i++)K.location('cargo:'+i,{transit:true,capacity:Infinity})`);
    assert.equal(P[1].eval('typeof K.exposedLots'),'function');
    assert.deepEqual(ids(P[1]),ids(P[0]));
    assert.equal(ledgerState(P[1]),ledgerState(P[0]));
    assert.equal(P[1].eval("[...storageExposedLocations(K)].length"),1);
    assert.equal(P[1].eval("K.byLocation.get('yard').size"),1);
    assert.equal(P[1].eval("STORAGE_FACILITY_INDEXES.get(K).uncovered.length"),1);
    assert.equal(P[1].eval('K.locations.size'),cargo+1);
  }
});

test('managed exposed toggles and appends preserve live Map order without ledger writes',()=>{
  const P=pair();
  for(const r of P)r.eval("K.location('a',{exposed:true});K.location('b',{});K.location('c',{exposed:true})");
  const outputs=[];
  for(let i=0;i<P.length;i++)outputs.push(P[i].eval(`(()=>{const before=[K.revision,K.sequence,K.events.length],out=[];for(const[id,n]of ${i?'storageExposedLocations(K)':'K.locations'}){if(n.exposed)out.push(id);if(id==='a'){storageFacilityLocationSet(K,'b',{id:'b',exposed:true});storageFacilityLocationSet(K,'c',{id:'c'});storageFacilityLocationSet(K,'d',{id:'d',exposed:true});}}return JSON.stringify({out,before,after:[K.revision,K.sequence,K.events.length]})})()`));
  assert.equal(outputs[1],outputs[0]);
  assert.equal(ledgerState(P[1]),ledgerState(P[0]));
  const state=JSON.parse(outputs[1]);assert.deepEqual(state.out,['yard','a','b','d']);assert.deepEqual(state.after,state.before);
});

test('delete/reinsert and clear/reappend retain native Map iterator semantics',()=>{
  for(const mutation of [
    "storageFacilityLocationDelete(K,'b');storageFacilityLocationSet(K,'b',{id:'b',exposed:true});",
    "storageFacilityLocationClear(K);storageFacilityLocationSet(K,'fresh',{id:'fresh',exposed:true});"
  ]){
    const P=pair();for(const r of P)r.eval("K.location('a',{exposed:true});K.location('b',{exposed:true});K.location('c',{exposed:true})");
    const out=P.map((r,i)=>r.eval(`(()=>{const out=[];for(const[id,n]of ${i?'storageExposedLocations(K)':'K.locations'}){if(n.exposed)out.push(id);if(id==='a'){${mutation}}}return JSON.stringify(out)})()`));
    assert.equal(out[1],out[0]);
    assert.equal(ledgerState(P[1]),ledgerState(P[0]));
  }
});

test('public invalidation, custom Map iteration and prototype exposure use full-scan fallback',()=>{
  const P=pair();
  for(const r of P)r.eval("K.location('late',{exposed:true})");
  P[1].eval('storageFacilityInvalidate(K)');
  assert.deepEqual(ids(P[1]),ids(P[0]));
  assert.equal(P[1].eval('storageFacilityIndex(K)'),null);

  const Q=pair();
  for(const r of Q)r.eval("K.location('late',{exposed:true});Object.defineProperty(K.locations,Symbol.iterator,{configurable:true,value:function*(){yield* Map.prototype.entries.call(this)}})");
  compare(Q,"JSON.stringify(K.exposedLots().map(l=>l.id))");
  assert.deepEqual(ids(Q[1]),ids(Q[0]));

  const R=pair();
  for(const r of R)r.eval("K.location('late',{exposed:true});Object.defineProperty(Object.prototype,'exposed',{configurable:true,value:false})");
  try{assert.deepEqual(ids(R[1]),ids(R[0]));assert.equal(R[1].eval("[...storageExposedLocations(K)].length"),[...R[1].eval('K.locations.keys()')].length);}
  finally{for(const r of R)r.eval("delete Object.prototype.exposed")}
});

test('adoption rejects exposed accessors and falls back without getter reads during indexing',()=>{
  const P=pair();
  for(const r of P)r.eval("let reads=0;const n=K.locations.get('yard');const v=n.exposed;Object.defineProperty(n,'exposed',{configurable:true,get(){reads++;return v}})");
  assert.equal(P[1].eval('storageFacilityAdopt(K)'),false);
  assert.deepEqual(ids(P[1]),ids(P[0]));
  assert.equal(P[1].eval('reads'),1);
  assert.equal(P[1].eval('storageFacilityIndex(K)'),null);
});

test('exposure cache stays outside enumerable ledger state and HistoryGraph roots',()=>{
  const r=pair()[1];
  const before=r.eval('Object.keys(K).join(",")');
  r.eval("K.location('extra',{exposed:true});storageExposedLocations(K)");
  assert.equal(r.eval('Object.keys(K).join(",")'),before);
  assert.equal(r.eval("Object.hasOwn(K,'uncovered')"),false);
  assert.equal(r.eval("Object.hasOwn(STORAGE_FACILITY_INDEXES.get(K),'uncovered')"),true);
  r.eval(historyGraph+';globalThis.HistoryGraph=HistoryGraph');
  const frames=r.eval('(()=>{const g=new HistoryGraph(),root={ledger:K};g.capture(root);storageFacilityAdopt(K);return g.capture(root)})()');
  assert.equal(JSON.stringify(frames.changes),'[]');
});
