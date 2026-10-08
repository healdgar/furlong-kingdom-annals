import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

function fixture(options={}){
  const r=realm({commodity:true,...options});
  r.eval('ownershipTick();storageInit(s)');
  return r;
}
const held=(r,i,g)=>r.eval(`pantry(s,H[${i}]).${g}||0`);

test('cargo remains in transit once, then arrives under the same owner',()=>{
  const r=fixture({households:2,grain:10,fish:0});
  const destination={name:'port',owner:0,pos:{x:1,z:1},stores:{grain:0,fish:0},folk:[],buildings:[],pop:0};
  r.W.settlements.push(destination);
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],10);purchase(s,'grain',H[1],4,1);const cargo={good:'grain',qty:4,m:H[1],dest:1};storageCargoOut(cargo,s,true);globalThis.cargo=cargo");
  near(r.s.stores.grain,6);near(r.eval('cargo.qty'),4);near(held(r,1,'grain'),0);
  near(r.eval("s.stores.grain+[...s.storage.entries({location:cargo.storageCargo.id})].reduce((n,x)=>n+x.qty,0)"),10);
  r.eval('storageCargoArrive(cargo,W.settlements[1])');
  near(r.s.stores.grain,6);near(destination.stores.grain,4);
  near(r.eval("mkt(W.settlements[1],'grain').get(H[1])"),4);
  near(r.eval("[...s.storage.entries({location:cargo.storageCargo.id})].reduce((n,x)=>n+x.qty,0)"),0);
});

test('spoilage debits held and sale commodity balances without changing livestock',()=>{
  const r=fixture({households:2,grain:10,fish:0});
  r.eval("mkt(s,'grain').clear();addHeld(s,H[0],'grain',4);offer(s,'grain',H[1],6);s.stores.cattle=2;stockOf(s,H[0]).animals.cattle=2;storageSpoil(s,'grain',.1)");
  near(held(r,0,'grain'),2.4);near(r.eval("mkt(s,'grain').get(H[1])"),3.6);near(r.s.stores.grain,6);
  near(r.s.stores.cattle,2);near(r.eval('stockOf(s,H[0]).animals.cattle'),2);
});

test('household migration moves charcoal custody as charcoal, not as timber',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  const destination={name:'remote',owner:0,pos:{x:1,z:1},stores:{grain:0,fish:0,timber:0},folk:[],buildings:[],pop:0,px:{timber:3}};
  r.W.settlements.push(destination);
  // Charcoal is worth its timber at the new home, more than its carriage (#55): the carters' wages are paid by the household.
  r.eval("buildWorks=(s,c,p,why)=>transfer(p,'crown',c,why);s.stores.timber=10;addHeld(s,H[0],'char',4);moveHouseholdGoods(householdAccount(H[0]),s,W.settlements[1])");
  near(r.s.stores.timber,6);near(destination.stores.timber,4);
  near(r.eval("pantry(s,H[0]).char||0"),0);near(r.eval("pantry(W.settlements[1],H[0]).char||0"),4);
  near(r.eval("W.settlements[1].storage.total('timber')+W.settlements[1].storage.total('char')"),4);
});

test('warehouse tier shrink exposes overflow without changing household custody',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("const h=householdAccount(H[0]);stockOf(s,h);const b={arch:'warehouse',state:'sound',tier:1,x:0,z:0,storageId:'shrink-test',ownerId:0};s.buildings.push(b);commodityFacilities(s);s.storage.adjust(b.storageId,'grain',h,'held',1200,'test-load');b.tier=0;commodityFacilities(s)");
  near(r.eval("s.storage.quantity(householdAccount(H[0]),'grain','held')"),1200);
  near(r.eval("s.storage.used('shrink-test')"),1000);
  near(r.eval("s.storage.quantity(householdAccount(H[0]),'grain','held',true)"),1200);
  near(r.eval("[...s.storage.entries({location:'exposed:shrink-test'})].reduce((n,x)=>n+x.qty,0)"),200);
});

test('warehouse to grange refit exposes forbidden timber and preserves its owner',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("const h=householdAccount(H[0]);stockOf(s,h);storageBindGood(s,'timber');const b={arch:'warehouse',state:'sound',tier:0,x:0,z:0,storageId:'refit-test',ownerId:0};s.buildings.push(b);commodityFacilities(s);s.storage.adjust(b.storageId,'timber',h,'held',100,'test-load');b.arch='grange';commodityFacilities(s)");
  near(r.eval("s.storage.quantity(householdAccount(H[0]),'timber','held')"),100);
  near(r.eval("s.storage.used('refit-test')"),0);
  near(r.eval("s.storage.quantity(householdAccount(H[0]),'timber','held',true)"),100);
  near(r.eval("[...s.storage.entries({location:'exposed:refit-test'})].reduce((n,x)=>n+x.qty,0)"),100);
});

test('bandit raid credits v3 cargo proceeds once at the fence and leaves money untouched',()=>{
  const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
  const tick=source.match(/^function tickBandits\(dis\)[\s\S]*?(?=^function |^const |^\/\*|$(?![\s\S]))/m)?.[0];
  assert.ok(tick,'production tickBandits function found');
  const r=fixture({households:2,grain:10,fish:0});
  const fence={name:'fence',owner:0,pos:{x:0,z:0},stores:{grain:0,fish:0},folk:[],buildings:[],pop:0,prosperity:50,unrest:0};
  r.W.settlements.push(fence);
  r.eval(`
    day=()=>30; chance=()=>true; nearestSettlementIdx=()=>1; polyPos=()=>({x:0,z:0}); dist2d=()=>0; globalThis.OUTLAW_MAX=12; recruitBandit=()=>false; outlawCampEnds=()=>{};
    s.stores.grain=10; mkt(s,'grain').clear(); addHeld(s,H[0],'grain',4);
    const cargo={good:'grain',qty:4,m:H[0],dest:1,origin:0,value:4,departDay:0,arriveDay:30,poly:[{x:0,z:0}],sea:false,river:false,robbed:false};
    storageCargoOut(cargo,s); W.caravans=[cargo];
    W.banditCamps=[0,1,2].map(id=>({id,x:0,z:0,raids:0,born:0,king:null,men:[{id:'member'}],nextRecruit:37}));
    W.treasury=0; globalThis.cargo=cargo; globalThis.fence=W.settlements[1];
  `);
  const moneyBefore=r.coins();
  r.eval(`${tick}\ntickBandits(0)`);
  near(r.eval("fence.storage.total('grain')"),2.4);
  near(r.eval("fence.stores.grain"),2.4);
  near(r.eval("s.stores.grain"),6);
  near(r.eval("cargo.qty"),0);
  near(r.eval("s.storage.total('grain')"),6);
  near(r.coins(),moneyBefore);
  assert.ok(r.eval("[...fence.storage.entries({good:'grain'})].every(e=>e.owner&&e.owner!=='out'&&e.owner._hh)"),'the stolen goods belong to one of the camp\'s men, not to a dealer beyond the realm');
});
