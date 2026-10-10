import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const begin=source.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */');
const end=source.indexOf('/* Runtime adapters for numeric commodity custody. */',begin);
assert.ok(begin>=0&&end>begin,'embedded commodity engine exists');
const core=source.slice(begin,end);
const engine=core.includes('const COMMODITY_NATIVE_ENTRIES=')?core:core+'\nconst COMMODITY_NATIVE_ENTRIES=CommodityBalanceLedger.prototype.entries;';

function ledger(){
  const context=vm.createContext({});
  vm.runInContext(engine,context,{filename:'index.html#commodity-singleton-plan'});
  return {context,run:code=>vm.runInContext(code,context)};
}
function pair(setup){
  const P=[ledger(),ledger()];
  for(const r of P)r.run(setup);
  P[1].run(`{
    const native=COMMODITY_NATIVE_ENTRIES;
    globalThis.entryCalls=0;
    K.entries=function(...args){entryCalls++;return native.apply(this,args)};
  }`);
  return P;
}
function state(r){return JSON.parse(r.run(`JSON.stringify((()=>{
  const K=globalThis.K;
  const entries=COMMODITY_NATIVE_ENTRIES;
  return {revision:K.revision,next:K.next,settlementRevision:K.settlementRevision,
    rows:[...entries.call(K,{includeTransit:true})].map(x=>[x.location,x.good,x.owner,x.availability,x.qty]),
    facilities:[...K.facilities].map(([id,f])=>[id,f.transit,f.exposed,[...f.balances].map(([g,owners])=>[g,[...owners].map(([o,avail])=>[o,[...avail]])])]),
    settlement:K.settle(17)};
})())`));}
function runBoth(P,script){
  const results=P.map(r=>{
    try{return {value:r.run(script),error:null};}
    catch(e){return {value:null,error:String(e?.message||e)};}
  });
  assert.deepEqual(results[1],results[0]);
  const snapshots=P.map(r=>state(r));
  assert.deepEqual(snapshots[1],snapshots[0]);
  return results[0];
}
const one=`globalThis.K=new CommodityBalanceLedger({crumbs:{grain:1}});
K.location('yard',{capacity:Infinity,exposed:true,protection:4});
K.adjust('yard','grain','house','held',6,'seed');`;

test('singleton plan matches canonical consume and transfer, then sees each intervening balance',()=>{
  const P=pair(one);
  const r=runBoth(P,`JSON.stringify([
    K.consume({owner:'house',good:'grain',availability:'held'},2.5,'meal'),
    K.transfer({owner:'house',good:'grain',availability:'held'},1,'heir',{availability:'held',cause:'gift'}),
    K.consume({owner:'house',good:'grain',availability:'held'},1.25,'next-meal'),
    K.quantity('house','grain','held'),
    K.quantity('heir','grain','held')])`);
  assert.deepEqual(JSON.parse(r.value),[2.5,1,1.25,1.25,1]);
  assert.equal(P[0].run("COMMODITY_NATIVE_ENTRIES.call(K,{owner:'house',good:'grain',availability:'held'}).next().done"),false);
  assert.equal(P[1].run('entryCalls'),3,'the wrapped canonical path is used for every plan');
});

test('multi-facility withdrawal follows live row ranks after remove and re-add',()=>{
  const P=pair(`globalThis.K=new CommodityBalanceLedger();
    K.location('first',{capacity:Infinity});K.location('second',{capacity:Infinity});
    K.adjust('first','grain','house','held',2,'seed-first');
    K.adjust('second','grain','house','held',3,'seed-second');
    K.adjust('first','grain','house','sale',1,'keep-owner-location-indexed');`);
  runBoth(P,`K.consume({location:'first',good:'grain',owner:'house',availability:'held'},2,'remove-first-cell');
    K.adjust('first','grain','house','held',1,'re-add-first-cell');
    K.consume({owner:'house',good:'grain',availability:'held'},1.5,'ranked-withdrawal');
    JSON.stringify([...COMMODITY_NATIVE_ENTRIES.call(K,{owner:'house',good:'grain',availability:'held'})].map(r=>[r.location,r.qty]))`);
  assert.equal(P[0].run("JSON.stringify([...COMMODITY_NATIVE_ENTRIES.call(K,{owner:'house',good:'grain',availability:'held'})].map(r=>[r.location,r.qty]))"),'[["second",1.5],["first",1]]');
  assert.equal(P[1].run('entryCalls'),1,'only the multi-cell plan needs generic enumeration');
});

test('singleton path uses current ripened quantity',()=>{
  const P=pair(`globalThis.K=new CommodityBalanceLedger({crumbs:{grain:1}});
    K.location('store',{capacity:Infinity,protection:4});
    K.adjust('store','grain','house','held',5,'seed');K.ripen('grain',0.125);`);
  const r=runBoth(P,`JSON.stringify([K.quantity('house','grain','held'),K.consume({owner:'house',good:'grain',availability:'held'},1.5,'meal')])`);
  assert.deepEqual(JSON.parse(r.value),[2.5,1.5]);
});

test('singleton path excludes a ripened balance below its crumb',()=>{
  const P=pair(`globalThis.K=new CommodityBalanceLedger({crumbs:{grain:1}});
    K.location('store',{capacity:Infinity,protection:4});
    K.adjust('store','grain','house','held',5,'seed');K.ripen('grain',0.9);`);
  const r=runBoth(P,`JSON.stringify([K.quantity('house','grain','held'),(()=>{try{K.consume({owner:'house',good:'grain',availability:'held'},1,'meal')}catch(e){return e.message}})()])`);
  assert.deepEqual(JSON.parse(r.value),[0,'insufficient balance']);
});

test('singleton path honors transit and exposed-only filters',()=>{
  const transit=pair(`globalThis.K=new CommodityBalanceLedger();K.location('cart',{capacity:Infinity,transit:true});K.adjust('cart','grain','house','held',4,'dispatch');`);
  const r=runBoth(transit,`JSON.stringify([K.quantity('house','grain','held'),K.consume({owner:'house',good:'grain',availability:'held',includeTransit:true},1,'aboard')])`);
  assert.deepEqual(JSON.parse(r.value),[0,1]);
  const exposed=pair(`globalThis.K=new CommodityBalanceLedger();K.location('covered',{capacity:Infinity,exposed:false});K.adjust('covered','grain','house','held',4,'seed');`);
  runBoth(exposed,`try{K.consume({owner:'house',good:'grain',availability:'held',exposedOnly:true},1,'exposed-only')}catch(e){String(e.message)}`);
  assert.equal(exposed[0].run("K.quantity('house','grain','held')"),4);
});

test('singleton tolerance accepts the same near-total request and rejects larger overdraw atomically',()=>{
  const P=pair(`globalThis.K=new CommodityBalanceLedger();K.location('yard',{capacity:Infinity});K.adjust('yard','grain','house','held',1,'seed');`);
  const r=runBoth(P,`JSON.stringify([K.consume({owner:'house',good:'grain',availability:'held'},1+Number.EPSILON*4,'roundoff')])`);
  assert.deepEqual(JSON.parse(r.value),[1]);
  const Q=pair(`globalThis.K=new CommodityBalanceLedger();K.location('yard',{capacity:Infinity});K.adjust('yard','grain','house','held',1,'seed');`);
  for(const x of Q)x.run('K.settle(17)');
  const before=Q.map(x=>JSON.stringify(state(x)));
  const failed=Q.map(x=>{try{x.run("K.consume({owner:'house',good:'grain',availability:'held'},1+Number.EPSILON*32,'reject')");return null}catch(e){return String(e.message)}});
  assert.deepEqual(failed,['insufficient balance','insufficient balance']);
  assert.deepEqual(Q.map(x=>JSON.stringify(state(x))),before,'a rejected overdraw writes no balances or journal rows');
});

test('singleton plan matches entries when _quantityAt is overridden',()=>{
  const P=pair(one);
  for(const r of P)r.run('K._quantityAt=function(){return 0};');
  const results=P.map(r=>JSON.stringify(r.run("K._plan({owner:'house',good:'grain',availability:'held'},2)")));
  assert.equal(results[1],results[0]);
  assert.deepEqual(JSON.parse(results[0]),{plan:[{location:'yard',good:'grain',owner:'house',availability:'held',qty:2}],quantity:2,available:6});
});

test('instance and prototype entries overrides retain canonical callback behavior',()=>{
  const P=pair(one);
  P[0].run(`const native=COMMODITY_NATIVE_ENTRIES;let calls=0;
    K.entries=function(...args){calls++;return native.apply(this,args)};`);
  assert.equal(P[0].run("K.consume({owner:'house',good:'grain',availability:'held'},1,'wrapped')"),1);
  assert.equal(P[0].run('calls'),1);
  const Q=pair(one);
  Q[0].run(`const proto=Object.getPrototypeOf(K),native=COMMODITY_NATIVE_ENTRIES;let calls=0;
    proto.entries=function*(...args){calls++;yield*native.apply(this,args)};`);
  assert.equal(Q[0].run("K.consume({owner:'house',good:'grain',availability:'held'},1,'prototype-wrapped')"),1);
  assert.equal(Q[0].run('calls'),1);
  assert.equal(Q[1].run("K.consume({owner:'house',good:'grain',availability:'held'},1,'wrapped-generic')"),1);
  assert.equal(Q[1].run('entryCalls'),1,'wrapped instance method forces the same fallback');
});
