import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

function fixture(options={}){
  const r=realm({commodity:true,...options});
  r.eval('ownershipTick();storageInit(s)');
  return r;
}

for(const initialHeld of [0,.25])test(`partial multi-seller purchase reports its credited quantity with ${initialHeld} existing pantry`,()=>{
  const r=fixture({households:2,grain:100,fish:0,cash:1000});
  r.eval(`mkt(s,'grain').clear();addHeld(s,H[0],'grain',${initialHeld})`);
  r.eval(`{
    const n=500;let values=[],sum=0;
    for(let i=0;i<n;i++){const v=Math.pow(i+1,-.37)*(1+((i*7919)%997)/997);values.push(v);sum+=v;}
    for(let i=0;i<n;i++)offer(s,'grain','seller'+i,${100-initialHeld}*values[i]/sum);
    globalThis.heldBefore=pantry(s,H[0]).grain||0;
    purchase(s,'grain',H[0],.501,1);
    globalThis.purchaseDelta=(pantry(s,H[0]).grain||0)-heldBefore;
    globalThis.cargo={good:'grain',qty:purchase.got,m:H[0],dest:1};
    storageCargoOut(cargo,s,true);
  }`);
  assert.equal(r.eval('purchase.got'),r.eval('purchaseDelta'));
  assert.ok(r.eval('purchase.got')<.501,'reported acquisition is the sum actually credited');
  near(r.eval('cargo.qty'),purchaseQty(r));
  near(r.eval('pantry(s,H[0]).grain||0'),initialHeld);
  near(r.s.stores.grain+purchaseQty(r),100);
});

test('material cargo over-request still throws without reducing held stock',()=>{
  const r=fixture({grain:.5,fish:0});
  r.eval("mkt(s,'grain').clear();addHeld(s,H[0],'grain',.5)");
  assert.throws(()=>r.eval("storageCargoOut({good:'grain',qty:.500001,m:H[0]},s,true)"),/insufficient balance/);
  near(r.eval('pantry(s,H[0]).grain'),.5);
  near(r.s.stores.grain,.5);
});

function purchaseQty(r){return r.eval("[...s.storage.entries({owner:accountOwner(H[0]),good:'grain',availability:'transit'})].reduce((n,row)=>n+row.qty,0)");}

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const madeFunction=source.match(/^function made\b[\s\S]*?(?=^function |^const |^\/\*|$(?![\s\S]))/m)[0];

test('pending production records the credited balance before migration',()=>{
  const r=fixture({grain:0,fish:0});r.eval(madeFunction);
  r.W.settlements.push({name:'destination',pos:{x:1,z:1},stores:{grain:0,fish:0},folk:[],buildings:[]});
  r.eval("storageBindGood(s,'timber');s.stores.timber=359.8150617063651;addHeld(s,H[0],'timber',358.0995795869319);s._made.timber=1.6465319836370607;globalThis.unassigned=s.storage.quantity(null,'timber','unassigned');made(s,'timber',.06895013579617171);globalThis.recorded=s._made.timber;moveStock(s,W.settlements[1],'timber',s.stores.timber/2)");
  assert.equal(r.eval('recorded'),r.eval('unassigned'));
  near(r.eval("s._made.timber"),r.eval("s.storage.quantity(null,'timber','unassigned')"));
  near(r.eval("W.settlements[1]._made.timber"),r.eval("W.settlements[1].storage.quantity(null,'timber','unassigned')"));
  near(r.eval("s.stores.timber+W.settlements[1].stores.timber"),359.8150617063651);
});

test('materially unbacked production still fails without creating stock or pending output',()=>{
  const r=fixture({grain:0,fish:0});r.eval(madeFunction);
  r.eval("storageBindGood(s,'timber');s.stores.timber=360;addHeld(s,H[0],'timber',358);s._made.timber=1.9");
  assert.throws(()=>r.eval("made(s,'timber',.100001)"),/Unbacked pending commodity output/);
  assert.equal(r.eval('s._made.timber'),1.9);
  assert.equal(r.eval('s.stores.timber'),360);
  assert.equal(r.eval("s.storage.quantity(null,'timber','unassigned')"),2);
});
