import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

function fixture(options={}){
  const r=realm({commodity:true,...options});
  r.eval('ownershipTick();if(FURLONG_COMMODITY_BALANCES)storageInit(s)');
  assert.equal(r.eval('FURLONG_COMMODITY_BALANCES'),true);
  return r;
}
const held=(r,i,g)=>r.eval(`pantry(s,H[${i}]).${g}||0`);
const sale=(r,i,g)=>r.eval(`mkt(s,'${g}').get(H[${i}])||0`);
function nextUp(value){const f=new Float64Array([value]),b=new BigUint64Array(f.buffer);b[0]+=value>=0?1n:-1n;return f[0];}
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const productionFunction=name=>source.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0]||'';
function injectProduction(r,...names){const functions=names.map(productionFunction);assert.ok(functions.every(Boolean),'requested production functions found');r.eval(functions.join('\n'));}

test('native storage defaults to numeric balances without duplicating town stock',()=>{
  const r=realm({grain:8,fish:0,households:1});
  r.eval('delete globalThis.FURLONG_COMMODITY_BALANCES;storageInit(s)');
  assert.equal(r.eval('s.storage.version'),3);assert.equal(r.eval('s.storage.facilities instanceof Map'),true);
  assert.equal(r.eval("s.storage.lots"),undefined);
  r.eval("mkt(s,'grain').clear();addHeld(s,H[0],'grain',4)");
  near(held(r,0,'grain'),4);near(r.s.stores.grain,8);near(r.eval("s.storage.total('grain')"),8);
});

test('explicit legacy storage opt-out still constructs the lot ledger',()=>{
  const r=realm({grain:8,fish:0,households:1,commodity:false});
  r.eval('storageInit(s)');
  assert.equal(r.eval('FURLONG_COMMODITY_BALANCES'),false);assert.equal(r.eval('s.storage.version'),2);assert.equal(r.eval('s.storage.lots instanceof Map'),true);
});

test('a purchase transfers seller sale balance directly into buyer pantry',()=>{
  const r=fixture({households:2,grain:10,fish:0});
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],10,1);purchase(s,'grain',H[1],4,1)");
  near(r.eval('purchase.got'),4);near(held(r,1,'grain'),4);near(sale(r,0,'grain'),6);
  near(r.eval("rsv(s,'grain').get(H[0])"),1);
  near(r.s.stores.grain,10);
});

test('purchase preserves money, grain keepback, and bread-credit debt',()=>{
  const r=fixture({households:2,cash:0,grain:12,fish:0});
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],12);householdAccount(H[0]).assets._keep=4;householdAccount(H[0]).assets.w=100;herdOf(H[1],s).cattle=4;var credit0=creditOf(s,H[1]);const coins0=W.treasury+[...W.households.values()].reduce((n,h)=>n+(h.assets.w||0),0);purchase(s,'grain',H[1],12,1)");
  const credit=r.eval('credit0');assert.ok(credit>0&&credit<8,'a beast-backed loan smaller than the offer'); // what a lender advances on two beasts' worth (creditOf)
  near(r.eval('purchase.got'),credit);near(held(r,1,'grain'),credit);near(sale(r,0,'grain'),12-credit);
  near(r.eval('H[1]._debt'),credit);assert.ok(r.eval('H[1]._owe.length>0'));
  near(r.eval("W.treasury+[...W.households.values()].reduce((n,h)=>n+(h.assets.w||0),0)"),r.eval('coins0'));
});

test('bulk market fill transfers pro rata without a second pantry credit',()=>{
  const r=fixture({households:3,cash:50,grain:12,fish:0});
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],6);offer(s,'grain',H[1],6);clearMarket(s,'grain',[[H[2],6]],1)");
  near(held(r,2,'grain'),6);near(sale(r,0,'grain'),3);near(sale(r,1,'grain'),3);
  near(r.s.stores.grain,12);
});

test('food allocation credits the hunger-weighted household shares exactly once',()=>{
  const r=fixture({households:2,grain:0,fish:0});
  r.eval("s.stores.grain=12;householdAccount(H[0]).hunger=0;householdAccount(H[1]).hunger=1;giveFood(s,'grain',12)");
  near(held(r,0,'grain')+held(r,1,'grain'),12);
  assert.ok(held(r,1,'grain')>held(r,0,'grain'));
  near(r.s.stores.grain,12);
});

test('gift relief transfers a purchased balance to each intended household once',()=>{
  const r=fixture({households:2,cash:20,crown:100,grain:12,fish:0});
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],12);purchase(s,'grain','crown',6,1);giveFood(s,'grain',6,'crown')");
  near(held(r,0,'grain')+held(r,1,'grain'),6);near(r.eval("pantry(s,'crown').grain||0"),0);
  near(sale(r,0,'grain'),6);near(r.s.stores.grain,12);
});

test('gift relief preflights the source so a shortage cannot partially credit households',()=>{
  const r=fixture({households:2,grain:5,fish:0});
  r.eval("mkt(s,'grain').clear();addHeld(s,'crown','grain',5);try{giveFood(s,'grain',6,'crown')}catch(e){globalThis.reliefError=e.message}");
  assert.match(r.eval('reliefError'),/Unbacked relief distribution.*requested 6 grain, available 5.*cause relief/);
  near(r.eval("pantry(s,'crown').grain"),5);near(held(r,0,'grain'),0);near(held(r,1,'grain'),0);
  near(r.s.stores.grain,5);
});

test('gift relief bounds sub-ulp excess to available stock across weighted shares',()=>{
  const r=fixture({households:2,grain:0,fish:0});
  r.eval("s.stores.grain=.3;addHeld(s,'crown','grain',.3);householdAccount(H[0]).hunger=householdAccount(H[1]).hunger=0;giveFood(s,'grain',.1+.2,'crown')");
  near(held(r,0,'grain')+held(r,1,'grain'),0.3);
  near(r.eval("pantry(s,'crown').grain||0"),0);
  near(r.s.stores.grain,0.3);
});

test('gift relief retains purchased stock in its source account when there are no recipients',()=>{
  const r=fixture({households:1,grain:6,fish:0});
  r.eval("mkt(s,'grain').clear();addHeld(s,'crown','grain',6);householdsOf=()=>[];giveFood(s,'grain',6,'crown')");
  near(r.eval("pantry(s,'crown').grain"),6);near(r.s.stores.grain,6);
});

test('source-less relief remains unassigned when there are no households',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("householdsOf=()=>[];s.stores.grain=6;giveFood(s,'grain',6)");
  near(r.eval("s.storage.quantity(null,'grain','unassigned')"),6);
  near(r.eval("s.storage.quantity(accountOwner(lordAcct(s)),'grain','held')"),0);
  near(r.eval("s.storage.total('grain')"),6);
});

test('consuming the last offered unit clears its obsolete reserve price',()=>{
  const r=fixture({households:1,grain:6,fish:0});
  r.eval("mkt(s,'grain').clear();offer(s,'grain',H[0],6,2);const consumed=consumeOwnStock(s,H[0],'grain',6)");
  near(r.eval('consumed'),6);near(r.eval("mkt(s,'grain').get(H[0])||0"),0);near(r.eval("rsv(s,'grain').get(H[0])||0"),0);
  near(r.s.stores.grain,0);
});

test('many weighted relief shares clip only final floating residue to live source stock',()=>{
  const r=fixture({households:20,grain:0,fish:0});
  r.eval("s.stores.grain=1;addHeld(s,'crown','grain',1);const K=s.storage;K.location('split-a',{capacity:Infinity});K.location('split-b',{capacity:Infinity});K.transfer({owner:'crown',good:'grain',availability:'held',location:'yard'},.5,'crown',{location:'split-a'});K.transfer({owner:'crown',good:'grain',availability:'held',location:'yard'},.5,'crown',{location:'split-b'});for(let i=0;i<H.length;i++)householdAccount(H[i]).population.set(s,i===H.length-1?1e-18:1);giveFood(s,'grain',1,'crown')");
  near(r.eval("H.reduce((n,p)=>n+(pantry(s,p).grain||0),0)"),1);
  near(r.eval("pantry(s,'crown').grain||0"),0);near(r.s.stores.grain,1);
});

test('eating debits the household pantry and town balance once and retains understock hunger',()=>{
  const r=fixture({households:2,grain:0.375,fish:0});
  r.eval("mkt(s,'grain').clear();addHeld(s,H[0],'grain',0.375);const town0=s.stores.grain;const eaten=eatHouseholds(s,new Map())");
  near(r.eval('eaten'),0.75);near(r.eval('householdAccount(H[0]).hunger'),0.5);near(r.eval('householdAccount(H[1]).hunger'),1);
  near(r.s.stores.grain,0);near(held(r,0,'grain'),0);
});

test('construction material purchase is consumed from the same balance once',()=>{
  const r=fixture({households:2,grain:0,fish:0,bootstrap:'s.stores.timber=8;'});
  r.eval("offer(s,'timber',H[0],8);const used=buyBuildingMaterial(s,'timber',H[1],3)");
  near(r.eval('used'),3);near(r.s.stores.timber,5);near(sale(r,0,'timber'),5);
  near(held(r,1,'timber'),0);
});

test('migration moves held stock only and leaves the household sale offer at origin',()=>{
  const r=fixture({households:1,grain:10,fish:0});
  const d={name:'remote',owner:0,pos:{x:1,z:1},stores:{grain:0,fish:0},folk:[],buildings:[],pop:0};
  r.W.settlements.push(d);
  r.eval("mkt(s,'grain').clear();addHeld(s,H[0],'grain',4);offer(s,'grain',H[0],6);moveHouseholdGoods(householdAccount(H[0]),s,W.settlements[1])");
  near(r.s.stores.grain,6);near(d.stores.grain,4);near(held(r,0,'grain'),0);near(sale(r,0,'grain'),6);
  near(r.eval("pantry(W.settlements[1],H[0]).grain"),4);
});

test('settlement transfer clips a one-ulp caller excess but rejects material excess atomically',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  const d={name:'rounding destination',owner:0,pos:{x:1,z:1},stores:{grain:0,fish:0},folk:[],buildings:[],pop:0};
  r.W.settlements.push(d);
  r.eval(`
    const K=s.storage,o=accountOwner(H[0]);
    for(const [id,q] of [['split-a',.1],['split-b',.1],['split-c',.4]]){K.location(id,{capacity:Infinity});K.adjust(id,'grain',o,'held',q,'fixture');}
    const fs=[...K.facilities.entries()],order=['split-c','split-a','split-b'];K.facilities.clear();for(const id of order)K.facilities.set(id,fs.find(x=>x[0]===id)[1]);
    globalThis.transferOwner=o;globalThis.transferRequest=K.quantity(o,'grain','held');
    globalThis.entryAvailable=[...K.entries({owner:o,good:'grain',availability:'held'})].reduce((n,x)=>n+x.qty,0);
  `);
  const requested=r.eval('transferRequest'),available=r.eval('entryAvailable'),roundedRequest=nextUp(available);
  assert.equal(requested,available);assert.ok(roundedRequest>available);
  r.eval(`try{commodityMove(s,W.settlements[1],{owner:transferOwner,good:'grain',availability:'held'},${roundedRequest+1e-6},'test-overrequest')}catch(e){globalThis.overrequest=e.message}`);
  assert.match(r.eval('overrequest'),/Unbacked commodity transfer/);
  near(r.eval("s.storage.quantity(transferOwner,'grain','held')"),requested);
  near(r.eval("W.settlements[1].storage.total('grain')"),0);
  near(r.eval(`commodityMove(s,W.settlements[1],{owner:transferOwner,good:'grain',availability:'held'},${roundedRequest},'test-roundoff')`),available);
  near(r.eval("s.storage.quantity(transferOwner,'grain','held')"),0);
  near(r.eval("W.settlements[1].storage.quantity(transferOwner,'grain','held')"),available);
});

test('metro rebalance moves pending output with unassigned stock and keeps pantry custody',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  const d={name:'ward market',owner:0,pos:{x:1,z:1},stores:{grain:0,fish:0},folk:[],buildings:[],pop:0,px:{grain:1,fish:1,ore:1}};r.W.settlements.push(d);
  injectProduction(r,'made','shareOutput');
  r.eval("globalThis.d=W.settlements[1];storageBindGood(s,'ore');s.stores.ore=130;addHeld(s,H[0],'ore',30);made(s,'ore',20);moveStock(s,d,'ore',65)");
  near(r.eval("s.storage.quantity(null,'ore','unassigned')"),50);
  near(r.eval("d.storage.quantity(null,'ore','unassigned')"),50);
  near(r.eval('s._made.ore'),10);near(r.eval('d._made.ore'),10);
  near(r.eval("pantry(s,H[0]).ore"),15);near(r.eval("pantry(d,H[0]).ore"),15);
  r.eval("shareOutput(s,0,new Map(),heads_(s,()=>true));shareOutput(d,1,new Map(),heads_(d,()=>true))");
  near(r.eval("mkt(s,'ore').get(lordAcct(s))"),10);near(r.eval("mkt(d,'ore').get(lordAcct(d))"),10);
  near(r.eval("s._made.ore||0"),0);near(r.eval("d._made.ore||0"),0);
  near(r.eval("s.storage.total('ore')+d.storage.total('ore')"),130);
});

test('physical loss debits only its unassigned pending-output amount before shareOutput',()=>{
  const r=fixture({households:1,grain:0,fish:0});injectProduction(r,'made','shareOutput');
  r.eval("storageBindGood(s,'ore');s.stores.ore=130;addHeld(s,H[0],'ore',30);made(s,'ore',20);s.stores.ore=120");
  near(r.eval('s._made.ore'),10);near(r.eval("s.storage.quantity(null,'ore','unassigned')"),90);
  near(r.eval("pantry(s,H[0]).ore"),30);
  r.eval("shareOutput(s,0,new Map(),heads_(s,()=>true))");
  near(r.eval("mkt(s,'ore').get(lordAcct(s))"),10);
  near(r.eval("s.storage.total('ore')"),120);near(r.eval('s._made.ore||0'),0);
});

test('departure divides held custody while the remaining household keeps the sale offer',()=>{
  const r=fixture({households:2,grain:10,fish:0});
  r.eval("mkt(s,'grain').clear();const old=householdAccount(H[0]);bindHousehold(H[1],old);old.head=H[0];offer(s,'grain',old,6);addHeld(s,old,'grain',4);H[0].si=1;departHousehold(H[0],0,1,'migration')");
  near(r.eval('pantry(s,H[0]).grain'),2);near(r.eval('pantry(s,H[1]).grain'),2);
  near(r.eval("mkt(s,'grain').get(H[0])||0"),0);near(r.eval("mkt(s,'grain').get(H[1])||0"),6);
  near(r.s.stores.grain,10);near(r.eval("s.storage.total('grain')"),10);
});

test('inheritance reallocates numeric balances once without replacing facility state',()=>{
  const r=fixture({households:3,grain:0,fish:0,cash:0});
  r.eval("H[0].kids=[H[1],H[2]];H[1].pa=H[0];H[2].pa=H[0];H[1].own=H[2].own=true;ownershipTick();s.stores.grain=8;addHeld(s,H[0],'grain',8);const facility=s.storage;inherit(H[0])");
  assert.equal(r.eval('s.storage===facility'),true);near(r.s.stores.grain,8);
  near(r.eval('[...s._owners.values()].reduce((n,x)=>n+(x.held.grain||0)+(x.sale.grain||0),0)'),8);
  assert.ok(held(r,1,'grain')>0);assert.ok(held(r,2,'grain')>0);
});

test('estate creditors receive chattels first without losing household debt semantics',()=>{
  const r=fixture({households:3,grain:0,fish:0,cash:0});
  r.eval("H[0].kids=[H[1],H[2]];H[1].pa=H[0];H[2].pa=H[0];H[1].own=H[2].own=true;ownershipTick();s.stores.grain=8;addHeld(s,H[0],'grain',8);H[0]._debt=4;H[0]._owe=[['crown',4]];inherit(H[0])");
  near(r.s.stores.grain,8);near(held(r,0,'grain'),0);
  near(r.eval("pantry(s,'crown').grain"),4);
  near(r.eval("pantry(s,H[1]).grain+pantry(s,H[2]).grain"),4);
  near(r.eval('H[0]._debt'),0);assert.equal(r.eval('householdAccount(H[0]).assets._owe.length'),0);
});

test('charcoal reclassifies timber custody without adding town stock',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.stores.timber=10;addHeld(s,H[0],'char',4)");
  near(r.s.stores.timber,10);
  near(r.eval("s.storage.total('timber')+s.storage.total('char')"),10);
  near(r.eval("pantry(s,H[0]).char"),4);
});
