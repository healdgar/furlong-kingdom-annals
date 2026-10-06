import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

// Compare the current public release scans while retaining its custody, metadata and arithmetic repairs.
const baseline=execFileSync('git',['show','f2e4b93:index.html'],{encoding:'utf8',maxBuffer:20e6});
const names=['storageBindGood','storageTick','storageSpoil','storageBuildingReport','storageInvestment','storageTitleTake','storageCargoOut','storageConsumeSale','transferOwnership'];
const oldFunctions=names.map(n=>baseline.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0]).join('\n');
const oldDestroy=baseline.match(/^  destroy\(id\)\{.*$/m)[0].trim().replace(/^destroy/,'function');
function pair(){return [true,false].map(old=>{
  const r=realm({grain:0,fish:0,households:3,cash:100,crown:1000});
  if(old)r.eval(oldFunctions+'\nStorageLedger.prototype.destroy='+oldDestroy);
  r.eval("storageInit(s);const K=s.storage;K.location('a',{capacity:100,protection:.4,x:10,z:0});K.location('b',{capacity:100,protection:.7,x:20,z:0});K.create('grain',4,null,'a');K.create('grain',6,null,'b');K.create('wool',3,null,'yard');offer(s,'grain','crown',10);offer(s,'wool','crown',3);storageTitles(s);const first=[...K.lots.values()][0];K.transfer(first,'visitor',first.qty,'sale');K.transfer(first,'crown',first.qty,'sale');");
  return r;
});}
function state(r){return structuredClone(r.eval(`({next:K.next,revision:K.revision,sequence:K.sequence,roundoff:[...K.roundoff],lots:[...K.lots.values()].map(l=>K.lotState(l)),locations:[...K.locations.values()].map(n=>K.locationState(n)),events:K.events,indices:['byGood','byLocation','byOwner','byAvailability'].map(k=>[k,[...K[k]].map(([v,ids])=>[k==='byOwner'?storageOwnerId(v):v,[...ids]])]),claims:[...s._owners].map(([o,x])=>[storageOwnerId(o),{...x.held},{...x.sale}]),cash:W.treasury,householdCash:H.map(h=>h.w),report:s.storageReport})`));}
function run(P,script){for(const r of P)r.eval(script);assert.deepEqual(state(P[1]),state(P[0]));}

test('indexed selection retains canonical order after title and location reinsertion',()=>{
  const r=pair()[1];
  for(const fields of ["{good:'grain'}","{owner:'crown',good:'grain',availability:'sale'}","{location:'a'}"])
    assert.equal(r.eval(`JSON.stringify(K.matching(${fields}).map(l=>l.id))`),r.eval(`JSON.stringify([...K.lots.values()].filter(l=>Object.entries(${fields}).every(([k,v])=>l[k]===v)).map(l=>l.id))`));
  r.eval("K.relocate(first,'b');K.relocate(first,'a');K.matching({location:'a'});K.split(first,1)");
  assert.equal(r.eval("JSON.stringify(K.matching({owner:'crown'}).map(l=>l.id))"),r.eval("JSON.stringify([...K.lots.values()].filter(l=>l.owner==='crown').map(l=>l.id))"));
});
test('purchases, sale consumption and prioritized physical outflow match former scans exactly',()=>{
  const P=pair();run(P,"purchase(s,'grain',H[0],5,1);addHeld(s,H[0],'grain',purchase.got);storageTitles(s)");
  run(P,"storageConsumeSale(s,'crown','grain',.25);mkt(s,'grain').set('crown',mkt(s,'grain').get('crown')-.25)");
  run(P,"purchase(s,'grain',H[1],1,1);s.stores.grain-=purchase.got;storageTitles(s);s.stores.grain-=.125;storageTitles(s)");
});
test('spoilage, facility reports and destruction retain exact outcome order and rounding',()=>{
  const P=pair();run(P,"storageSpoil(s,'grain',.003);K.destroy('a');storageTitles(s)");
  for(const r of P)r.eval("storageRoute=()=>25;b={storageId:'b'}");
  assert.deepEqual(structuredClone(P[1].eval('storageBuildingReport(s,b)')),structuredClone(P[0].eval('storageBuildingReport(s,b)')));
});
test('inheritance visits the same original lots even while transfers split them',()=>{
  const P=pair();run(P,"transferOwnership('crown',[[accountOwner(H[0]),.4],[accountOwner(H[1]),.6]]);storageTitles(s)");
});
test('exposed hauling and reporting preserve lot order across custody changes',()=>{
  const P=pair();run(P,"K.destroy('a');K.destroy('b');s.buildings.push({arch:'grange',storageId:'store',state:'sound',x:30,z:0,tier:0,ownerId:'crown'});storageRoute=()=>10;wages=()=>{};buildWorks=(s,q,payer)=>{acct(payer,-q)};dist2d=(a,b,c,d)=>Math.hypot(a-c,b-d);storageTick(s)");
});
test('indexed reads avoid full lot iteration and remain derived, including incoming cargo',()=>{
  const r=pair()[1];r.eval("K.matching({good:'grain'});const keys=Object.keys(K).join(',');const values=K.lots.values;K.lots.values=()=>{throw Error('full scan')};storageSpoil(s,'grain',.001);storageConsumeSale(s,'crown','grain',.25);K.destroy('a');K.lots.values=values;");
  assert.equal(r.eval("Object.keys(K).join(',')"),r.eval('keys'));
  r.eval("purchase(s,'grain',H[0],1,1);const c={good:'grain',qty:purchase.got,m:H[0],dest:1};storageCargoOut(c,s);const d={name:'destination',owner:0,pos:{x:100,z:0},stores:{grain:0},buildings:[],_owners:new Map()};W.settlements.push(d);storageInit(d);d.storage.create('grain',2,null,'yard');d.storage.matching({good:'grain'});offer(d,'grain',H[0],c.qty);storageCargoArrive(c,d)");
  assert.equal(r.eval("JSON.stringify(d.storage.matching({good:'grain'}).map(l=>l.id))"),r.eval("JSON.stringify([...d.storage.lots.values()].filter(l=>l.good==='grain').map(l=>l.id))"));
});
test('multi-field queries visit the smallest index instead of unrelated lots',()=>{
  const r=pair()[1];r.eval("for(let i=0;i<1000;i++)K.create('ore',1,'other:'+i,'yard','held');K.matching({good:'grain'});let reads=0;const get=K.lots.get;K.lots.get=function(id){reads++;return get.call(this,id)};const selected=K.matching({owner:'crown',good:'grain',availability:'sale'});");
  assert.equal(r.eval('selected.length'),2);
  assert.equal(r.eval('reads'),4);
});
