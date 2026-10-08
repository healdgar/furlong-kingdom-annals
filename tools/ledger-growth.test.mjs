// The ledger grows with the living world, not with its history (#55): crumbs are lost as spoiled; a family's goods follow it home;
// spoilage is reckoned in closed form when a store is settled, not store by store each day.
import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

function fixture(options={}){const r=realm({commodity:true,...options});r.eval('ownershipTick();storageInit(s)');return r;}
const held=(r,i,g)=>r.eval(`pantry(s,H[${i}]).${g}||0`);
const rows=(r,g)=>r.eval(`[...s.storage.entries({good:'${g}'})].length`);

test('the crumb is a soul\'s day of food, or its worth at base prices',()=>{
  const r=fixture({households:1});
  near(r.eval('CRUMB.grain'),r.eval('FOOD'));near(r.eval('CRUMB.fish'),.01);near(r.eval('CRUMB.meat'),.01);
  near(r.eval('CRUMB.tools'),.01*2/9);near(r.eval('CRUMB.spice'),.01*2/40);near(r.eval('CRUMB.hay'),.01*2/1.2);
  near(r.eval('CRUMB.char'),r.eval('CRUMB.timber'));assert.equal(r.eval("'cattle' in CRUMB"),false);
});

test('a store spoiled below the crumb is lost whole, journaled as spoilage, and counted where spoilage is counted',()=>{
  const r=fixture({households:2,grain:0,fish:0});
  r.eval("s.stores.grain=4.0208;addHeld(s,H[0],'grain',.0104);offer(s,'grain',H[1],.0104,3);addHeld(s,H[1],'grain',4);s.storage.settle(0)");
  near(r.eval("rsv(s,'grain').get(H[1])"),3);
  const before=r.eval("s.stores.grain");
  r.eval("spoilOwned(s,'grain',.01)"); // in the open yard a day's loss is 4%: .0104 falls to .00998, below a day's bread
  near(held(r,0,'grain'),0);near(r.eval("mkt(s,'grain').get(H[1])||0"),0);near(held(r,1,'grain'),4*.96);near(r.s.stores.grain,before-.0104*2-4*.04);
  r.eval("s.storage.settleStores()"); // the month's reckoning settles every store
  assert.equal(r.eval("rsv(s,'grain').get(H[1])"),undefined,'nothing on sale, no reserve');
  near(r.eval('s._lostM.grain'),.0104*2+4*.04);
  const e=r.eval("s.storage.settle(1)");
  near(e.flows['exposure-loss'].grain,-(.0104*2+4*.04));
  assert.ok(e.deltas.some(d=>d.owner===r.eval('storageOwnerId(householdAccount(H[0]))')&&d.after===0));
});

test('a store above the crumb keeps its share, as before',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.stores.grain=.0105;addHeld(s,H[0],'grain',.0105);spoilOwned(s,'grain',.01)");
  near(held(r,0,'grain'),.0105*.96);
});

test('the crumbs of goods that never rot are swept out, the rest untouched',()=>{
  const r=fixture({households:2,grain:0,fish:0});
  r.eval("s.stores.ore=10;addHeld(s,H[0],'ore',.003);addHeld(s,H[1],'ore',2)");
  assert.equal(rows(r,'ore'),3);
  r.eval("spoilOwned(s,'ore',SPOIL.ore);s.storage.settleStores()");
  near(held(r,0,'ore'),0);near(held(r,1,'ore'),2);near(r.s.stores.ore,10-.003);near(r.eval('s._lostM.ore'),.003);
  assert.equal(rows(r,'ore'),2);
});

test('a crumb of the place\'s unsold output leaves its pending output too',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("mkt(s,'grain').clear();s.stores.grain=.005;s._made.grain=.005;spoilOwned(s,'grain',.0003)");
  near(r.s.stores.grain,0);near(r.s._made.grain,0);assert.equal(rows(r,'grain'),0);
});

test('a lord\'s grain swept out as crumbs is tallied as his rot',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("W.houses.push({name:'lord'});s.owner=0;lordAcct=()=>W.houses[0];s.stores.grain=.006;addHeld(s,W.houses[0],'grain',.006);spoilOwned(s,'grain',.0003);s.storage.settleStores()");
  near(r.eval('s._lg.get(W.houses[0]).rot'),.006);
});

// A family's goods follow it home, or are sold where they lie (#55).
function homeAway(r,px={}){ // a second place 1,000 paces off, its prices given: the carters' freight there is .1512 a unit
  r.W.settlements.push({name:'home',owner:0,pos:{x:1000,z:0},stores:{grain:0,fish:0},folk:[],buildings:[],pop:10,px:{grain:2,fish:2.5,cloth:7,wool:4,...px}});
  r.eval("globalThis.bills=[];buildWorks=(s,c,p,why)=>{bills.push([s.name,c,why]);transfer(p,'crown',c,why);}");
}
const unit=(.12+1.2*.08)*.7;
const at=(r,si,o,g,kind)=>r.eval(`W.settlements[${si}].storage?W.settlements[${si}].storage.quantity(accountOwner(${o}),'${g}','${kind}'):0`);

test('a household that moves carries what is worth its carriage, pays the carters, and leaves the rest',()=>{
  const r=fixture({households:1,grain:0,fish:0,cash:20});homeAway(r,{grain:.1});
  r.eval("s.stores.grain=5;s.stores.cloth=2;addHeld(s,H[0],'grain',5);offer(s,'cloth',H[0],2,6);moveHouseholdGoods(householdAccount(H[0]),s,W.settlements[1])");
  near(at(r,1,'H[0]','cloth','sale'),2);near(at(r,0,'H[0]','cloth','sale'),0);near(at(r,0,'H[0]','grain','held'),5);near(at(r,1,'H[0]','grain','held'),0);
  near(r.eval("rsv(W.settlements[1],'cloth').get(householdAccount(H[0]))"),6+unit);assert.equal(r.eval("stockOf(s,householdAccount(H[0])).reserve.cloth"),undefined);
  assert.equal(r.eval('bills.map(b=>b[0]+":"+b[2]).join()'),'fixture:carriage');near(r.eval('bills[0][1]'),2*unit);near(r.H[0].w,20-2*unit);
  near(r.eval("s.stores.cloth+W.settlements[1].stores.cloth"),2);
});

test('a short purse carries the dearest goods first, as far as it pays',()=>{
  const r=fixture({households:1,grain:0,fish:0,cash:.2});homeAway(r);
  r.eval("s.stores.wool=3;s.stores.cloth=2;addHeld(s,H[0],'wool',3);addHeld(s,H[0],'cloth',2);moveHouseholdGoods(householdAccount(H[0]),s,W.settlements[1])");
  near(at(r,1,'H[0]','cloth','held'),.2/unit);near(at(r,0,'H[0]','cloth','held'),2-.2/unit);near(at(r,0,'H[0]','wool','held'),3);near(r.H[0].w,0);
});

test('at the market, goods of a family living elsewhere go home or are offered, and the unsold are the lord\'s waif',()=>{
  const r=fixture({households:1,grain:0,fish:0,cash:20});homeAway(r,{fish:.1});
  r.eval("s.stores.grain=5;s.stores.fish=1;addHeld(s,H[0],'grain',5);offer(s,'fish',H[0],1,3);s.folk=[];H[0].si=1;W.settlements[1].folk=[H[0]];globalThis.left=homeward(s)");
  near(at(r,1,'H[0]','grain','held'),5);near(at(r,0,'H[0]','grain','held'),0);near(at(r,0,'H[0]','fish','sale'),1);
  assert.equal(r.eval("stockOf(s,householdAccount(H[0])).reserve.fish"),undefined,'offered at the price');
  r.eval('waifs(s,left)');near(at(r,0,'H[0]','fish','sale'),0);near(r.eval("mkt(s,'fish').get('crown')"),1);
  near(r.eval("s.stores.fish+s.stores.grain+W.settlements[1].stores.grain"),6);
});

test('a family with folk living here keeps its goods here; a dealer keeps his stock on sale where he sells',()=>{
  const r=fixture({households:2,grain:0,fish:0,cash:20});homeAway(r);
  r.eval("H[1].tr='merchant';s.stores.grain=7;addHeld(s,H[0],'grain',3);offer(s,'grain',H[1],4,1);s.folk=[H[0]];H[1].si=1;W.settlements[1].folk=[H[1]];globalThis.left=homeward(s)");
  near(at(r,0,'H[0]','grain','held'),3);near(at(r,0,'H[1]','grain','sale'),4);assert.equal(r.eval('left'),null);assert.equal(r.eval('bills.length'),0);
});

// Spoilage in closed form (#55): a store holds what it held when last settled, compounded by the days of spoilage since.
const yard=1-.01*4; // a day's share kept in the open yard at a rate of .01
test('an untouched store ripens in closed form, and nothing is written until it is settled',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.stores.grain=5;addHeld(s,H[0],'grain',5);s.storage.settle(0);for(let i=0;i<10;i++)spoilOwned(s,'grain',.01)");
  near(held(r,0,'grain'),5*yard**10);near(r.s.stores.grain,5*yard**10);
  assert.equal(r.eval("s.storage.settle(1)"),null,'ten days of spoilage write nothing');
  const raw=r.eval("[...s.storage.facilities.get('yard').balances.get('grain').values()][0].get('held')");near(raw,5);
  r.eval("consumeOwned(s,H[0],'grain',1)"); // eaten: settled first, the ten days' loss lands today
  near(held(r,0,'grain'),5*yard**10-1);near(r.eval('s._lostM.grain'),5-5*yard**10);
  const e=r.eval("s.storage.settle(2)");near(e.flows['exposure-loss'].grain,-(5-5*yard**10));near(e.flows.consumption.grain,-1);
  assert.equal(e.deltas.length,1);near(e.deltas[0].before,5);near(e.deltas[0].after,5*yard**10-1);
});

test('the closed form gives what a store loses day by day, within rounding, and a crumb falls out when it is settled',()=>{
  const r=fixture({households:2,grain:0,fish:0});
  r.eval("s.stores.grain=3.0102;addHeld(s,H[0],'grain',3);addHeld(s,H[1],'grain',.0102);for(let i=0;i<30;i++)spoilOwned(s,'grain',.0003)"); // .0102 keeps .00984 after a month
  let daily=3;for(let i=0;i<30;i++)daily-=daily*.0012;
  assert.ok(Math.abs(held(r,0,'grain')-daily)<1e-12);
  near(held(r,1,'grain'),0);assert.equal(rows(r,'grain'),1,'a crumb reads as gone');
  assert.equal(r.eval("[...s.storage.facilities.get('yard').balances.get('grain').keys()].length"),2,'and stays until it is settled');
  r.eval('s.storage.settleStores()');assert.equal(r.eval("[...s.storage.facilities.get('yard').balances.get('grain').keys()].length"),1);
});

test('the place\'s unsold output is settled each day, so its pending output keeps step',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("mkt(s,'grain').clear();s.stores.grain=2;s._made.grain=2;spoilOwned(s,'grain',.01);spoilOwned(s,'grain',.01)");
  near(r.s._made.grain,2*yard**2);near(r.eval("s.storage.quantity(null,'grain','unassigned')"),2*yard**2);
  near(r.eval("[...s.storage.facilities.get('yard').balances.get('grain').get(null).values()][0]"),2*yard**2);
});

test('a new rate first settles every store of the good at the old one',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.stores.fish=4;addHeld(s,H[0],'fish',4);spoilOwned(s,'fish',.01);spoilOwned(s,'fish',.01);spoilOwned(s,'fish',.001)");
  near(held(r,0,'fish'),4*yard**2*(1-.004));
  near(r.eval("[...s.storage.facilities.get('yard').balances.get('fish').values()][0].get('held')"),4*yard**2);
});

test('a store carried to a granary is settled at the yard\'s rate, and ripens at the granary\'s after',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.storage.location('granary',{capacity:100,protection:.4});s.stores.grain=5;addHeld(s,H[0],'grain',5);spoilOwned(s,'grain',.01);s.storage.transfer({owner:householdAccount(H[0]),good:'grain',availability:'held',location:'yard'},5*.96,householdAccount(H[0]),{location:'granary',cause:'local-carriage'});spoilOwned(s,'grain',.01)");
  near(held(r,0,'grain'),5*yard*(1-.004));
});

test('the count a store was last settled at is kept on it, out of its balances, for a saved world',()=>{
  const r=fixture({households:1,grain:0,fish:0});
  r.eval("s.stores.grain=5;addHeld(s,H[0],'grain',5);spoilOwned(s,'grain',.01);spoilOwned(s,'grain',.01);consumeOwned(s,H[0],'grain',1)");
  const A="[...s.storage.facilities.get('yard').balances.get('grain').values()][0]";
  assert.equal(r.eval(A+'.since'),2);assert.equal(r.eval('Object.keys('+A+').length'),0);assert.equal(r.eval("s.storage.spoilage.get('grain').n"),2);
});
