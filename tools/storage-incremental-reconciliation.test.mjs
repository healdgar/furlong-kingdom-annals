import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const shipped=execFileSync('git',['show','3067ee5:index.html'],{encoding:'utf8',maxBuffer:20e6});
const section=s=>s.slice(s.indexOf('function oldHouseholdHead('),s.indexOf('function houseFolk(s)'));
const currentSection=section(source),shippedSection=section(shipped);
function pair(options={}){return [realm({...options,transformSource:p=>p.replace(currentSection,shippedSection)}),realm(options)];}
function state(r){return JSON.parse(r.eval(`JSON.stringify({lots:[...s.storage.lots.values()].map(l=>s.storage.lotState(l)),events:s.storage.events,claims:[...s._owners].map(([o,x])=>[storageOwnerId(o),{held:{...x.held},sale:{...x.sale}}]),revision:s.storage.revision,sequence:s.storage.sequence,totals:[...s.storage.totals],matched:[...s.storage.titleMatched||[]]})`));}
function sameRun(P,script){for(const r of P)r.eval(script);assert.deepEqual(state(P[1]),state(P[0]));}

test('reconciling one changed owner selects only its lots among certified peers and other goods',()=>{
 const r=realm({grain:0,fish:0,households:2});
 r.eval("storageInit(s);const K=s.storage;globalThis.owners=[];for(let i=0;i<80;i++){const o={storageOwnerId:'owner-'+i};owners.push(o);K.create('grain',1,o,'yard','held');stockOf(s,o).held.grain=1;}for(let i=0;i<40;i++){const o={storageOwnerId:'fish-'+i};K.create('fish',1,o,'yard','held');stockOf(s,o).held.fish=1;}storageTitles(s);stockOf(s,owners[0]).held.grain=.5;const claims=storageClaimOwners(s,'grain').flatMap(([o,x])=>['held','sale'].flatMap(kind=>Object.keys(x[kind]||{}).map(g=>({o,kind,claimGood:g,q:x[kind][g]}))));const context=storageTitleGroups(K,'grain',claims),selected=storageTitleLotIds(K,'grain',context.skip);globalThis.candidates=selected.length;globalThis.candidateGoods=selected.every(id=>K.lots.get(id)?.good==='grain');globalThis.allGrain=K.byGood.get('grain').size;storageTitles(s,'grain');");
 assert.ok(r.eval('candidates')<r.eval('allGrain'));
 assert.ok(r.eval('candidates')<=2);
 assert.equal(r.eval('candidateGoods'),true);
});

test('reconciliation remains exact across changed claims, pending custody, metadata and unassigned lots',()=>{
 const P=pair({grain:0,fish:0,households:3});
 sameRun(P,"storageInit(s);const K=s.storage;const a=accountOwner(H[0]),b=accountOwner(H[1]),c=accountOwner(H[2]);K.location('pending',{capacity:10});for(const [o,q]of [[a,4],[b,3],[c,2]]){const l=K.create('grain',q,o,'yard','held');stockOf(s,o).held.grain=q;}K.create('grain',1,null,'yard','unassigned');storageTitles(s,'grain');stockOf(s,b).held.grain=2;const pending=K.create('grain',.5,a,'pending','held');K.annotate(pending,{pendingPurchase:true});K.annotate(K.matching({owner:c,good:'grain'})[0],{future:{grade:'old'}});K.transfer(K.matching({owner:a,good:'grain'})[0],null,.25,'unassigned');storageTitleKnownDirty(s,'grain');storageTitles(s,'grain');");
});

test('B merge that changes A2 metadata forces the full canonical coalesce order',()=>{
 const P=pair({grain:0,fish:0,households:2});
 sameRun(P,"storageInit(s);const K=s.storage,a={storageOwnerId:'A'},b={storageOwnerId:'B'},c={storageOwnerId:'C'},d={storageOwnerId:'D'};const a1=K.create('grain',1,a,'yard','held'),b1=K.create('grain',1,b,'yard','held'),b2=K.create('grain',1,c,'yard','held'),a2=K.create('grain',1,d,'yard','held');K.annotate(a1,{condition:'dry'});K.annotate(a2,{condition:'wet'});K.annotate(b1,{condition:'dry'});K.annotate(b2,{condition:'wet'});K.transfer(b2,b);K.annotate(b2,{condition:'dry'});K.transfer(a2,a);stockOf(s,a).held.grain=2;stockOf(s,b).held.grain=2;const claims=[{o:a,kind:'held',claimGood:'grain',q:2},{o:b,kind:'held',claimGood:'grain',q:2}],context=storageTitleGroups(K,'grain',claims),group=context.groups.get(a);group.state.certificate={epoch:group.epoch,generation:context.C.generation,entries:group.entries};storageTitleKnownDirty(s,'grain');storageOutcome=e=>{K.events.push(e);if(e.cause==='lot-merged'&&e.owner==='B')K.annotate(a2,{condition:'dry'});};storageTitles(s,'grain');");
 assert.equal(P[1].eval("s.storage.events.filter(e=>e.cause==='lot-merged').length"),2);
});

test('untrusted observers and overridden native methods preserve the original reconciliation path',()=>{
 for(const setup of [
  "globalThis.FURLONG_STORAGE_AUDIT_OBSERVER=()=>{}",
  "const native=K.coalesce;K.coalesce=function(...args){return native.apply(this,args)}",
  "K.byGood=new Map(K.byGood)",
 ]){
  const P=pair({grain:0,fish:0,households:2});
  sameRun(P,`storageInit(s);const K=s.storage;const a=accountOwner(H[0]),b=accountOwner(H[1]);for(const [o,q]of [[a,3],[b,2]]){K.create('grain',q,o,'yard','held');stockOf(s,o).held.grain=q;}storageTitles(s,'grain');stockOf(s,a).held.grain=2;${setup};storageTitles(s,'grain');`);
 }
});
