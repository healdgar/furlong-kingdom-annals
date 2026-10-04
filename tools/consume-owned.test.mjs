import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {realm as candidateRealm} from './ownership-fixture.mjs';
const baseline=execFileSync('git',['show','405fed30436477184cf04d51fcf51fa0ba0e6bff:index.html'],{encoding:'utf8',maxBuffer:20e6});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'furlong-consume-baseline-')),file=path.join(temp,'index.html');fs.writeFileSync(file,baseline);
const previous=process.env.FURLONG_TEST_SOURCE;process.env.FURLONG_TEST_SOURCE=file;
const {realm:baselineRealm}=await import('./ownership-fixture.mjs?consume-baseline=405fed3');
if(previous===undefined)delete process.env.FURLONG_TEST_SOURCE;else process.env.FURLONG_TEST_SOURCE=previous;fs.rmSync(temp,{recursive:true});
function canonical(v){if(v===undefined)return ['undefined'];if(typeof v==='number'&&(!Number.isFinite(v)||Object.is(v,-0)))return ['number',Object.is(v,-0)?'-0':String(v)];if(v===null||typeof v!=='object')return v;return [Array.isArray(v)?'array':'object',Reflect.ownKeys(v).map(k=>[k,canonical(Object.getOwnPropertyDescriptor(v,k).value)])];}
function pair(){return [baselineRealm,candidateRealm].map(make=>{const r=make({grain:0,fish:0,households:3});r.eval(`storageInit(s);const K=s.storage;K.create('grain',8,null,'yard');addHeld(s,H[0],'grain',8);K.create('fish',3,null,'yard');addHeld(s,H[1],'fish',3);K.create('timber',2,null,'yard');addHeld(s,H[0],'char',2);storageTitles(s);globalThis.randomState=123;globalThis.randomCalls=0;randi=()=>{randomCalls++;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState};`);return r;});}
function snapshot(r){return canonical(r.eval(`({revision:K.revision,next:K.next,sequence:K.sequence,events:K.events,roundoff:[...K.roundoff],lots:[...K.lots.values()].map(l=>Object.fromEntries(Reflect.ownKeys(l).map(k=>[k,k==='owner'?storageOwnerId(l[k]):l[k]]))),locations:[...K.locations.values()].map(l=>Object.fromEntries(Reflect.ownKeys(l).map(k=>[k,k==='owner'?storageOwnerId(l[k]):l[k]]))),byOwner:[...K.byOwner].map(([o,ids])=>[storageOwnerId(o),[...ids]]),totals:[...K.totals],titleRevision:[...K.titleRevision||[]],titleMatched:[...K.titleMatched||[]],claims:[...s._owners].map(([o,x])=>[storageOwnerId(o),x.held,x.sale,x.reserve,x.animals]),households:[...W.households?.values()||[]].map(h=>({id:h.id,head:h.head?.id,members:[...h.members].map(p=>p.id),assets:h.assets})),people:H.map(p=>({id:p.id,household:p._hh?.id,w:p.w})),randomState,randomCalls})`));}
function compare(P,expression){const values=P.map(r=>canonical(r.eval(expression)));assert.deepEqual(values[1],values[0]);assert.deepEqual(snapshot(P[1]),snapshot(P[0]));}
for(const [name,expression]of [
 ['zero demand',"consumeOwned(s,H[0],'grain',0)"],
 ['negative zero',"consumeOwned(s,H[0],'grain',-0)"],
 ['negative demand',"consumeOwned(s,H[0],'grain',-4)"],
 ['NaN demand',"consumeOwned(s,H[0],'grain',NaN)"],
 ['tiny positive demand',"consumeOwned(s,H[0],'grain',1e-300)"],
 ['ordinary and excess demand',"[consumeOwned(s,H[0],'grain',2),consumeOwned(s,H[0],'grain',100)]"],
 ['empty pantry with other goods',"consumeOwned(s,H[1],'grain',4)"],
 ['char maps to physical timber',"consumeOwned(s,H[0],'char',.5)"],
 ['synchronized dirty zero claim',"pantry(s,H[0]).grain=0;storageTitleDirty(s,'grain');consumeOwned(s,H[0],'grain',0)"],
 ['live household formation and member ownership',"const child={id:9,gn:'child',age:8,si:0,ma:H[0],w:0};H.push(child);s.folk.push(child);[consumeOwned(s,child,'grain',0),consumeOwned(s,child,'grain',.125)]"],
 ['household split before consumption',"const split=householdPortion(H[0],.15);[consumeOwned(s,H[0],'grain',0),consumeOwned(s,split,'grain',.01)]"]
])test('consumeOwned matches frozen405fed3: '+name,()=>{const P=pair();compare(P,expression);compare(P,'Array.from({length:5},()=>randi())');});
test('zero demand avoids the owner iteration while retaining synchronization, claims and fault guard',()=>{
 const P=pair();for(const r of P)r.eval(`globalThis.ownerReads=0;globalThis.guards=0;const get=K.byOwner.get.bind(K.byOwner);K.byOwner.get=k=>{ownerReads++;return get(k)};storageOutcomeAssert=()=>{guards++};`);
 compare(P,"consumeOwned(s,H[0],'grain',0)");assert.equal(P[0].eval('ownerReads'),1);assert.equal(P[1].eval('ownerReads'),0);assert.ok(P[0].eval('guards')>0);assert.equal(P[1].eval('guards'),P[0].eval('guards'));
});
