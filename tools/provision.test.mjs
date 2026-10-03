// Production market and population functions, exercised without the renderer or unrelated realm systems.
// node --test tools/provision.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

test('growth exhausts a month-sized larder: buy the shortfall before hunger',()=>{
  const r=realm({grainLard:1,pop:150}),before=r.coins();r.run();
  near(r.s.hunger,0);near(r.s.stores.grain,18.5);near(r.coins(),before);
  assert.ok(r.H[0].w<20,'the extra food was paid for');
});
test('fish substitutes for unavailable grain',()=>{
  const r=realm({grain:0}),before=r.coins();r.run();
  near(r.s.hunger,0);near(r.s.stores.fish,18.5);near(r.coins(),before);
});
test('grain and fish together cover a shortage in either preferred good',()=>{
  const r=realm({grain:0.5,fish:1}),before=r.coins();r.run();
  near(r.s.hunger,0);near(r.s.stores.grain,0);near(r.s.stores.fish,0);near(r.coins(),before);
});
test('a penniless fisher eats his own stock without a loan',()=>{
  const r=realm({grain:0,cash:0});r.eval("s.mkt.fish.clear();offer(s,'fish',H[0],20)");r.run();
  near(r.s.hunger,0);near(r.coins(),0);near(r.H[0]._debt||0,0);
});
test('physical food is not free when a household cannot pay or borrow',()=>{
  const r=realm({cash:0});r.run();
  near(r.s.hunger,1);near(r.s.stores.grain,20);near(r.s.stores.fish,20);near(r.H[0]._debt||0,0);
});
test('loans fund food without minting coin',()=>{
  const r=realm({cash:0,crown:100}),before=r.coins();r.run();
  near(r.s.hunger,0);assert.ok(r.H[0]._debt>0);near(r.coins(),before);
  assert.ok(!Object.keys(r.W._flow||{}).some(k=>k.endsWith('*')));
});
test('food processing fees enter the craft pool without overdrawing buyers',()=>{
  const r=realm({grain:0,cash:5});r.H[0].tr='salter';const before=r.coins();r.run();
  near(r.s.hunger,0);near(r.s._poolBy.salter,1);near(r.H[0].w,1);near(r.coins(),before);
});
test('a place without named households cannot overdraw its lord for processing',()=>{
  const r=realm({households:0,crown:0});r.eval("W.settlements.push({...s,pop:0,stores:{grain:0,fish:0},_lard:{grain:0,fish:0},_poolBy:{}});marketFor=()=>[1,1]");r.run();
  near(r.s.hunger,0);near(r.W.treasury,0);
  near(Object.values(r.W.settlements[1]._poolBy).reduce((t,v)=>t+v,0),0);
});
test('the existing quarter-year bread-credit limit still applies',()=>{
  const r=realm({cash:0,crown:100});r.eval('H[0]._debt=foodYr()*0.25');const debt=r.H[0]._debt;r.run();
  near(r.s.hunger,1);near(r.H[0]._debt,debt);near(r.coins(),100);
});
test('another farmer retains reserved grain; buyers can take fish instead',()=>{
  const r=realm({grain:100});r.eval("s.mkt.grain.clear();offer(s,'grain',{gn:'seller',w:0,_keep:100},100)");r.run();
  near(r.s.hunger,0);near(r.s.stores.grain,100);near(r.s.stores.fish,18.5);
});
test('new catches belong to fishers and are not offered again next market',()=>{
  const r=realm({grain:0,cash:0});r.eval("H[0].tr='fisher';s.mkt.fish.clear();s._made={fish:20,tools:5,timber:4}");r.run();
  near(r.s.hunger,0);near(r.s._made.fish,0);near(r.s._made.tools,5);near(r.s._made.timber,4);
  const left=r.eval("mkt(s,'fish').get(H[0])");r.eval('shareOutput(s,0,folkIndex(),H)');
  near(r.eval("mkt(s,'fish').get(H[0])"),left);near(r.coins(),0);
});
test('spoilage reconciles ownership before an extra purchase',()=>{
  const r=realm({grain:0,fish:2,cash:0});r.eval("s.mkt.fish.clear();offer(s,'fish',H[0],10)");r.run();
  near(r.s.hunger,0);near(r.s.stores.fish,0.5);near(r.eval("mkt(s,'fish').get(H[0])"),0.5);
});
test('scarce food is shared across simultaneous buyers',()=>{
  const r=realm({grain:0,fish:0.75,households:2}),before=r.coins();r.run();
  near(r.s.hunger,0.5);near(r.H[0].w,r.H[1].w);near(r.s.stores.fish,0);near(r.coins(),before);
});
test('adequate purchased food does not trigger an extra market visit',()=>{
  const r=realm({grainLard:2}),before=r.coins();r.s._made.fish=3;r.run();
  near(r.s.hunger,0);near(r.coins(),before);near(r.s._made.fish,0); // fresh production is assigned even when no purchase is needed
});
