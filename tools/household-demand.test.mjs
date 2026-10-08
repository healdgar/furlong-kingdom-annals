// A household buys need × (price/worth)^-ε of each good and never more than its need, where a good's worth is what it costs to make
// here or to bring here; a short purse pays for its bread, then keeps back its rent and the next month's bread, then buys fuel, tools,
// cloth and last the rich man's table (#51, the user's decision of 2026-10-08). Before, every household bought its full need at any
// price, out of a fixed share of its purse for each good, and kept nothing back for its rent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

const town=({cash=1000,px={}}={})=>{const r=realm({grain:100,fish:100,cash,pop:5});
  r.eval("ownershipTick();trait=()=>0;TRADE_W={};SUNDRY={};SUNDRY_W=1");
  r.eval(`Object.assign(s.px,{wool:1,cloth:7,timber:3,tools:9,spice:40,silk:30},${JSON.stringify(px)});for(const g of ['cloth','timber','tools','spice','silk']){s.stores[g]=100;offer(s,g,'crown',100);}`);
  return r;};
const held=(r,g)=>r.eval(`pantry(s,H[0]).${g}||0`);
const month=(r,g)=>r.eval(`householdSize(s,H[0])*NEED.${g}*30`);
const provision=r=>r.eval('provision(s,H,new Map())');

test('cloth at fifty times its worth is hardly bought, and the bread is bought in full',()=>{
  const r=town({px:{cloth:62.5}});provision(r); // wool at 1: a piece of cloth takes 1.25 of it
  near(r.s._goodsWorth.cloth,1.25);
  near(held(r,'cloth'),month(r,'cloth')*Math.pow(50,-1.2));assert.ok(held(r,'cloth')<month(r,'cloth')*0.01);
  near(held(r,'grain')+held(r,'fish'),r.eval('householdSize(s,H[0])*(NEED.grain+NEED.fish)*30'));
});

test('at its worth or below a good is bought to the month\'s need and no further',()=>{
  const r=town({px:{cloth:1}});provision(r);
  near(held(r,'cloth'),month(r,'cloth'));near(held(r,'tools'),month(r,'tools'));near(held(r,'timber'),month(r,'timber'));
});

test('bread at twice its worth is bought in full (food is inelastic), and the family eats its need from what it has',()=>{
  const r=town();r.s._pxY={grain:0.5};provision(r); // no market near has grain to spare: its worth is its price here one year with another
  const need=r.eval('householdSize(s,H[0])*(NEED.grain+NEED.fish)*30');
  near(r.s._ration,1);near(held(r,'grain')+held(r,'fish'),need);
  const before=held(r,'grain')+held(r,'fish');r.eval('eatHouseholds(s,folkIndex())');
  near(before-held(r,'grain')-held(r,'fish'),need/30);near(r.eval('householdAccount(H[0]).hunger'),0); // it bought less, and goes short only when that runs out
});

test('a small purse buys its bread, then keeps back its rent and the next bread before fuel, tools or cloth',()=>{
  const bread=1.5/0.7,rent=5; // a month's grain for five at 1, with the miller's and the baker's part; the year's rent of the house
  const r=town({cash:2*bread+rent,px:{cloth:1}});r.eval(`H[0].bh={arch:'house',ownerId:'lord',_rent:${rent},hh:[H[0]]}`);
  near(r.eval('rentDue(s,H[0])'),rent);provision(r);
  near(held(r,'grain')+held(r,'fish'),7.5*0.2);
  for(const g of ['timber','tools','cloth'])near(held(r,g),0);
  assert.ok(r.H[0].w>=rent+bread,`${r.H[0].w} kept for a rent of ${rent}`); // the rent is there on the tenure day, and the bread at the next market (and the miller's part, for here they grind their own)
  const free=town({cash:2*bread+rent,px:{cloth:1}});provision(free); // its own roof: the same purse buys the rest
  for(const g of ['timber','tools','cloth'])near(held(free,g),month(free,g));
});

test('what is left after the bread and what is kept back goes to fuel first, then tools, then cloth',()=>{
  const fuel=0.09*3/0.8,r=town({cash:2*1.5/0.7+fuel+0.27});provision(r); // the carter's part on the fuel; half the month's tools
  near(held(r,'timber'),month(r,'timber'));near(held(r,'tools'),month(r,'tools')/2);near(held(r,'cloth'),0);
});

test('the rich man\'s table is a month\'s need, and not bought again while it lasts',()=>{
  const r=town();provision(r);near(held(r,'spice'),month(r,'spice'));near(held(r,'silk'),month(r,'silk'));
  provision(r);near(held(r,'spice'),month(r,'spice')); // it took three months' need every month before
});

test('a good\'s worth follows the cost of its stuff, and what it costs to bring from a market that has it to spare',()=>{
  const r=town();r.eval('s._smiths=1;s.px.ore=5');
  let V=r.eval('goodWorth(s)');near(V.cloth,1/0.8);near(V.tools,0.75*(5+3));
  r.eval('s.px.wool=4');V=r.eval('goodWorth(s)');near(V.cloth,4/0.8);
  r.eval("W.settlements.push({name:'mart',pos:{x:1000,z:0},pop:10,stores:{cloth:200,grain:5},px:{cloth:2,grain:0.1},infected:0})");
  const carry=r.eval("freight(W.settlements[1],1,1200,'cart')"),toll=12/100*0.35; // a crown town's aid on what is brought in (ladeIn)
  const keep=Math.pow(1-r.eval('SPOIL.cloth'),1200/r.eval('CART_MPD')); // what is still fit to sell when it arrives
  V=r.eval('goodWorth(s)');near(V.cloth,(2*(1+toll)+carry)/keep);
  near(V.grain,0); // five grain is no more than a month's need of its own and five over: none to spare, and no worth known here
  r.eval("W.settlements[1].px.cloth=6");near(r.eval('goodWorth(s)').cloth,5); // dearer to bring than to weave
});

test('a good\'s worth is the cost of bringing a month\'s need, not of the cheapest sliver: a glut that cannot fill the month sets nothing',()=>{
  const r=town();r.eval("s.pop=1000;W.settlements.push({name:'glut',pos:{x:500,z:0},pop:10,stores:{fish:40},px:{fish:0.01},infected:0},{name:'port',pos:{x:2000,z:0},pop:10,stores:{fish:5000},px:{fish:1},infected:0})");
  const V=r.eval('goodWorth(s)'),fr=r.eval("freight(W.settlements[2],1,2400,'cart')"),toll=12/100*0.35,keep=Math.pow(1-r.eval('SPOIL.fish'),2400/r.eval('CART_MPD'));
  near(V.fish,(1*(1+toll)+fr)/keep); // the glut's thirty-odd fish are not a month for a thousand souls: the port's price sets it
});
