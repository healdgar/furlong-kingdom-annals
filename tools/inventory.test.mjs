import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

function herd(){const r=realm();r.eval("householdsOf(s);s.stores.sheep=11.179889427201612;stockOf(s,H[0]).animals.sheep=7.228924178825603;s._herdLast={sheep:s.stores.sheep};");return r;}
test('pending export loss survives a household move and subsequent births',()=>{
  const r=herd();r.eval("const dest={...s,stores:{grain:0,fish:0,sheep:0},folk:[],_owners:new Map(),_ownershipReady:true,_herdLast:{sheep:0}};W.settlements.push(dest);s.stores.sheep=4.0261877627808325;const empty=newHousehold(null);moveHouseholdGoods(empty,s,dest)");
  near(r.eval('stockOf(s,H[0]).animals.sheep'),r.s.stores.sheep);
  r.eval("herdBirth(s,'sheep',s.stores.sheep*0.1);herdSync(s)");near(r.eval('stockOf(s,H[0]).animals.sheep'),r.s.stores.sheep);
});
test('household movement transfers physical animals and title exactly once',()=>{
  const r=herd();r.eval("const dest={...s,stores:{grain:0,fish:0,sheep:0},folk:[],_owners:new Map(),_ownershipReady:true,_herdLast:{sheep:0}};W.settlements.push(dest);moveHouseholdGoods(householdAccount(H[0]),s,dest);herdSync(dest)");
  near(r.eval('stockOf(W.settlements[1],H[0]).animals.sheep'),7.228924178825603);near(r.s.stores.sheep+r.W.settlements[1].stores.sheep,11.179889427201612);
});
test('pooled stock moves animal title, including tiny balances, with custody',()=>{
  const r=herd();r.eval("stockOf(s,H[0]).animals.sheep=1e-12;s.stores.sheep=2;s._herdLast={sheep:2};const dest={...s,stores:{grain:0,fish:0,sheep:0},folk:[],_owners:new Map(),_ownershipReady:true,_herdLast:{sheep:0}};W.settlements.push(dest);moveStock(s,dest,'sheep',1);herdSync(s);herdSync(dest)");
  assert.equal(r.eval('stockOf(s,H[0]).animals.sheep'),5e-13);assert.equal(r.eval('stockOf(W.settlements[1],H[0]).animals.sheep'),5e-13);near(r.s.stores.sheep+r.W.settlements[1].stores.sheep,2);
});
test('winter fodder shortage does not subtract from absent animal fields',()=>{
  const r=herd();r.eval("s.stores.hay=0;winterFeed(s,false)");for(const x of r.s._owners.values())for(const v of Object.values(x.animals))assert.ok(Number.isFinite(v));
});
test('inheritance changes title without moving remote beasts',()=>{
  const r=herd();r.eval("const heir=newHousehold(null);transferOwnership(householdAccount(H[0]),[[heir,1]])");near(r.s.stores.sheep,11.179889427201612);near(r.eval('[...s._owners.values()].reduce((n,x)=>n+(x.animals.sheep||0),0)'),7.228924178825603);
});

test('imported physical and purchased title are not mistaken for births',()=>{const r=herd();r.eval("s.stores.sheep+=18;stockOf(s,H[0]).animals.sheep+=18;herdSync(s)");near(r.eval('stockOf(s,H[0]).animals.sheep'),25.228924178825603);});
test('actual births belong to the existing owners proportionally',()=>{const r=herd();r.eval("herdBirth(s,'sheep',s.stores.sheep);herdSync(s)");near(r.eval('stockOf(s,H[0]).animals.sheep'),14.457848357651206);near(r.s.stores.sheep,22.359778854403224);});
test('a raid transfers surviving beasts once and does not double the household award',()=>{
  const r=herd();r.eval("s.hm={};s.stores.sheep=100;stockOf(s,H[0]).animals.sheep=75;s._herdLast={sheep:100};H[0].si=1;const dest={...s,stores:{grain:0,fish:0,sheep:20},folk:[],_owners:new Map(),_ownershipReady:true,_herdLast:{sheep:20}};W.settlements.push(dest);stockOf(dest,H[0]).animals.sheep=10;lootTo=()=>H;driveOffHerds(s,{home:1});herdSync(s);herdSync(dest)");
  near(r.s.stores.sheep,65);near(r.W.settlements[1].stores.sheep,55);near(r.eval('stockOf(W.settlements[1],H[0]).animals.sheep'),10+35*2/3);near(r.eval('stockOf(s,H[0]).animals.sheep'),48.75);
});
test('culling removes offered, privately owned and tiny title balances with physical beasts',()=>{
  const r=herd();r.eval("s.stores.sheep=100;stockOf(s,H[0]).animals.sheep=75;stockOf(s,'crown').sale.sheep=25;stockOf(s,H[0]).held.sheep=1e-12;s._herdLast={sheep:100};herdLoss(s,'sheep',20)");near(r.s.stores.sheep,80);near(r.eval("stockOf(s,'crown').sale.sheep"),20);assert.equal(r.eval('stockOf(s,H[0]).held.sheep'),8e-13);
});

test('corrupt animal claims are reported without silently erasing history',()=>{const r=herd();r.eval('stockOf(s,H[0]).animals.sheep=NaN');assert.throws(()=>r.eval('herdSync(s)'),/Non-finite sheep/);assert.ok(Number.isNaN(r.eval('stockOf(s,H[0]).animals.sheep')));});

test('mustered horses leave sale and byre claims while remaining in the host',()=>{const r=herd();r.eval("s.stores.horses=10;s._herdLast.horses=10;stockOf(s,H[0]).animals.horses=5;stockOf(s,'crown').sale.horses=5;KRi=0;const host={};takeHorses(host,s,[{sk:[1]}]);musterResult=host");near(r.s.stores.horses+r.eval('musterResult.horses'),10);near(r.eval('stockOf(s,H[0]).animals.horses'),4.5);near(r.eval("stockOf(s,'crown').sale.horses"),4.5);});

test('initial household allotment transfers existing animal title rather than duplicating sale stock',()=>{const r=herd();r.eval("delete s._herdLast;s.stores.sheep=100;stockOf(s,H[0]).animals={};stockOf(s,'crown').sale.sheep=100;TILLERS=new Set();tills=()=>false;herdInit(s,H)");near(r.eval("[...s._owners.values()].reduce((n,x)=>n+(x.animals.sheep||0)+(x.sale.sheep||0),0)"),100);});

test('a cancelled small drove remains physically present and owned by its purchaser',()=>{const r=realm();const before=r.coins();r.eval("s.stores.sheep=0.25;stockOf(s,'crown').sale.sheep=0.25;merchantFor=()=>H[0];driverFor=()=>H[0];freight=()=>0;s.stores.sheep-=0.25;ladeOut({good:'sheep',qty:0.25,len:1,dest:0,value:0.25},s,true)");near(r.s.stores.sheep,0.25);near(r.eval('stockOf(s,H[0]).sale.sheep'),0.25);near(r.coins(),before);});
test('aliased seller labels preserve title and payment conservation for individual and bulk purchases',()=>{
  for(const bulk of [false,true]){const r=realm({households:3,cash:100});r.eval("householdsOf(s);s.stores.sheep=30;const old=householdAccount(H[0]);bindHousehold(H[1],old);offer(s,'sheep',old,10);householdPortion(H[0]);offer(s,'sheep',H[0],20);moneyBefore=W.treasury+[...W.households.values()].reduce((n,h)=>n+(h.assets.w||0),0)");
    r.eval(bulk?"const bought=clearMarket(s,'sheep',[[H[2],15]],1);stockOf(s,H[2]).animals.sheep=bought[0]":"purchase(s,'sheep',H[2],15,1);stockOf(s,H[2]).animals.sheep=purchase.got");
    near(r.eval("[...s._owners.values()].reduce((n,x)=>n+(x.animals.sheep||0)+(x.sale.sheep||0),0)"),30);near(r.eval("W.treasury+[...W.households.values()].reduce((n,h)=>n+(h.assets.w||0),0)-moneyBefore"),0);
  }
});

test('local byre transactions use custody site even when the household head resides elsewhere',()=>{const r=herd();r.eval("const remote={...s,stores:{grain:0,fish:0,sheep:10},folk:[],_owners:new Map(),_ownershipReady:true,_herdLast:{sheep:10}};W.settlements.push(remote);offer(remote,'sheep','crown',10);purchase(remote,'sheep',H[0],10,1);const local=herdOf(H[0],remote);local.sheep=(local.sheep||0)+purchase.got");near(r.eval('stockOf(s,H[0]).animals.sheep'),7.228924178825603);near(r.eval('stockOf(W.settlements[1],H[0]).animals.sheep'),10);});

test('sale, consumption and reconciliation retain positive sub-micro-unit residuals',()=>{for(const bulk of [false,true]){const r=realm();r.eval("s.stores.sheep=1e-12;offer(s,'sheep','crown',1e-12)");r.eval(bulk?"clearMarket(s,'sheep',[[H[0],5e-13]],1)":"purchase(s,'sheep',H[0],5e-13,1)");assert.equal(r.eval("stockOf(s,'crown').sale.sheep"),5e-13);r.eval("reconcile(s,H,['sheep'])");assert.ok(r.eval("stockOf(s,'crown').sale.sheep")>0);}const r=realm();r.eval("s.stores.hay=1e-12;offer(s,'hay',H[0],1e-12);consumeOwnStock(s,H[0],'hay',5e-13)");assert.equal(r.eval('stockOf(s,H[0]).sale.hay'),5e-13);});

test('availability respects each canonical seller reservation despite an aliased display head',()=>{const r=realm({households:3,cash:100});r.eval("householdsOf(s);mkt(s,'grain').clear();const old=householdAccount(H[0]);bindHousehold(H[1],old);offer(s,'grain',old,10,2);householdPortion(H[0]);offer(s,'grain',H[0],20,0.5)");near(r.eval("avail(s,'grain',1)"),20);r.eval("purchase(s,'grain',H[2],30,1)");near(r.eval('purchase.got'),20);});
