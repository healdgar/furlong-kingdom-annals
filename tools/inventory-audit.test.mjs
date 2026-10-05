import test from 'node:test';import assert from 'node:assert/strict';import {inventoryAudit} from './inventory-audit.mjs';
function fixture(){const owner={},lot={id:'lot:0:1',good:'grain',qty:1e-12,owner,location:'yard',availability:'held'},K={lots:new Map([[lot.id,lot]]),locations:new Map([['yard',{id:'yard',capacity:1,active:true}]]),byGood:new Map([['grain',new Set([lot.id])]]),byLocation:new Map([['yard',new Set([lot.id])]]),byOwner:new Map([[owner,new Set([lot.id])]]),byAvailability:new Map([['held',new Set([lot.id])]]),totals:new Map([['grain',1e-12]]),occupancy:new Map([['yard',1e-12]])};const s={name:'fixture',stores:{grain:1e-12,sheep:1},_owners:new Map([[owner,{held:{},sale:{sheep:.25},animals:{sheep:.75}}]]),storage:K};return {s,K,lot,owner};}
const audit=(f,state={})=>inventoryAudit([f.s],state,['sheep'],{grain:{volume:1}});
test('positive tiny quantity remains intact and matching',()=>{const f=fixture();assert.equal(audit(f),null);assert.equal(f.lot.qty,1e-12);});
for(const [name,edit,kind]of [
['nonfinite store',f=>f.s.stores.grain=NaN,'invalid-store'],['negative store',f=>f.s.stores.grain=-1,'invalid-store'],['past muster title overclaim',f=>f.s.stores.sheep=0,'animal-overclaim'],['NaN animal claim',f=>f.s._owners.get(f.owner).animals.sheep=NaN,'invalid-animal-claim'],['negative animal claim',f=>f.s._owners.get(f.owner).held.sheep=-1,'invalid-animal-claim'],['nonfinite lot',f=>f.lot.qty=Infinity,'invalid-lot-quantity'],['zero live lot',f=>f.lot.qty=0,'invalid-lot-quantity'],['missing forward index',f=>f.K.byOwner.clear(),'missing-index'],['stale reverse index',f=>f.K.byGood.get('grain').add('retired'),'stale-index'],['missing location',f=>f.K.locations.clear(),'missing-location'],['wrong store total',f=>f.s.stores.grain=2,'lot-store-mismatch'],['capacity breach',f=>f.K.locations.get('yard').capacity=0,'capacity-exceeded'],['occupancy cache drift',f=>f.K.occupancy.set('yard',1),'occupancy-cache-mismatch'],['total cache drift',f=>f.K.totals.set('grain',1),'total-cache-mismatch'],['incompatible good',f=>f.K.locations.get('yard').goods=['stone'],'incompatible-location'],['inactive location',f=>f.K.locations.get('yard').active=false,'incompatible-location'],
])test(name+' fails',()=>{const f=fixture();edit(f);assert.equal(audit(f).kind,kind);});
test('intended unoffered lord remainder is reported',()=>{const f=fixture(),state={};f.s.stores.sheep=2;assert.equal(audit(f,state),null);assert.equal(state.unclaimed.sheep,1);});
test('subtractive cancellation bound uses observed input without trimming residual',()=>{const f=fixture(),state={};audit(f,state);f.s.stores.sheep=0;f.s._owners.get(f.owner).animals.sheep=Number.EPSILON;f.s._owners.get(f.owner).sale.sheep=0;assert.equal(audit(f,state),null);assert.equal(f.s._owners.get(f.owner).animals.sheep,Number.EPSILON);});
test('nonfinite occupancy cache fails',()=>{const f=fixture();f.K.occupancy.set('yard',NaN);assert.equal(audit(f).kind,'occupancy-cache-mismatch');});
test('duplicate live lot identity across settlements fails',()=>{const a=fixture(),b=fixture();assert.equal(inventoryAudit([a.s,b.s],{},['sheep'],{grain:{volume:1}}).kind,'lot-identity');});
test('transit quantity is excluded from settlement stores, retained in indices and capacity',()=>{const f=fixture();f.K.locations.get('yard').transit=true;f.s.stores.grain=0;f.K.totals.set('grain',0);assert.equal(audit(f),null);assert.equal(f.lot.qty,1e-12);});
import vm from 'node:vm';
test('browser-injected oracle has no module dependencies',()=>{const standalone=vm.runInNewContext('('+inventoryAudit.toString()+')');const f=fixture();assert.equal(standalone([f.s],{},['sheep'],{grain:{volume:1}}),null);});
for(const index of ['byGood','byLocation','byOwner','byAvailability'])test(index+' forward corruption fails',()=>{const f=fixture();f.K[index].clear();assert.equal(audit(f).kind,'missing-index');});
test('migration baseline reset cannot conceal stranded animal title',()=>{const f=fixture();f.s.stores.sheep=.2;f.s._herdLast={sheep:.2};assert.equal(audit(f).kind,'animal-overclaim');});

function v3Fixture({quantity=4,store=quantity,claim=quantity,capacity=12}={}){
  const owner={household:true,id:'household-1'},account={held:{grain:claim},sale:{},animals:{}};
  const balances=new Map([['grain',new Map([[owner,new Map([['held',quantity]])]])]]);
  const facility={id:'yard',capacity,active:true,transit:false,volume:1,volumes:{grain:2},balances,metadata:{}};
  const settlement={name:'Test',stores:{grain:store},storage:{version:3,facilities:new Map([['yard',facility]])},_owners:new Map([[owner,account]])};
  return {settlement,owner};
}
function auditV3(settlement){return inventoryAudit([settlement],{},[],{grain:{volume:2}});}

test('v3 inventory audit independently accepts balances, owner claims, physical total, and capacity',()=>{
  const {settlement}=v3Fixture();
  assert.equal(auditV3(settlement),null);
});

test('v3 audit rejects title divergence and town-total divergence',()=>{
  const title=v3Fixture({claim:3});
  assert.equal(auditV3(title.settlement)?.kind,'commodity-title-mismatch');
  const total=v3Fixture({store:5});
  assert.equal(auditV3(total.settlement)?.kind,'commodity-store-mismatch');
});

test('v3 audit derives facility volume and rejects overcapacity and malformed balances',()=>{
  const full=v3Fixture({quantity:7,store:7,claim:7,capacity:12});
  assert.equal(auditV3(full.settlement)?.kind,'capacity-exceeded');
  const malformed=v3Fixture();
  malformed.settlement.storage.facilities.get('yard').balances.get('grain').get(malformed.owner).set('held',NaN);
  assert.equal(auditV3(malformed.settlement)?.kind,'invalid-balance');
});

test('v3 audit rejects positive balances in inactive or commodity-incompatible facilities',()=>{
  const inactive=v3Fixture();
  inactive.settlement.storage.facilities.get('yard').active=false;
  assert.equal(auditV3(inactive.settlement)?.kind,'incompatible-location');
  assert.equal(auditV3(inactive.settlement)?.reason,'inactive');
  const forbidden=v3Fixture();
  forbidden.settlement.storage.facilities.get('yard').goods=['stone'];
  assert.equal(auditV3(forbidden.settlement)?.kind,'incompatible-location');
  assert.equal(auditV3(forbidden.settlement)?.reason,'forbidden-good');
});

test('v3 audit allows charcoal in timber-compatible transit custody',()=>{
  const owner={household:true,id:'char-owner'},balances=new Map([['char',new Map([[owner,new Map([['transit',2]])]])]]);
  const facility={id:'cart',capacity:Infinity,active:true,transit:true,goods:['timber'],volume:1,balances,metadata:{}};
  const settlement={name:'Cart town',stores:{timber:0},storage:{version:3,facilities:new Map([['cart',facility]])},_owners:new Map()};
  assert.equal(auditV3(settlement),null);
  facility.active=false;
  assert.equal(auditV3(settlement)?.kind,'incompatible-location');
});

test('browser-injected inventory oracle includes its v3 audit helper',()=>{
  const standalone=vm.runInNewContext('('+inventoryAudit.toString()+')',{Map,Set,WeakMap,Number});
  const {settlement}=v3Fixture();
  assert.equal(standalone([settlement],{},[],{grain:{volume:2}}),null);
});
