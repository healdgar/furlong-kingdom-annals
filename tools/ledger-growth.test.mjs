// The ledger grows with the living world, not with its history (#55): crumbs are lost as spoiled.
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
  near(held(r,0,'grain'),0);near(r.eval("mkt(s,'grain').get(H[1])||0"),0);near(held(r,1,'grain'),4*.96);
  assert.equal(r.eval("rsv(s,'grain').get(H[1])"),undefined,'nothing on sale, no reserve');
  near(r.s.stores.grain,before-.0104*2-4*.04);near(r.eval('s._lostM.grain'),.0104*2+4*.04);
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
  r.eval("spoilOwned(s,'ore',SPOIL.ore)");
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
  r.eval("W.houses.push({name:'lord'});s.owner=0;lordAcct=()=>W.houses[0];s.stores.grain=.006;addHeld(s,W.houses[0],'grain',.006);spoilOwned(s,'grain',.0003)");
  near(r.eval('s._lg.get(W.houses[0]).rot'),.006);
});
