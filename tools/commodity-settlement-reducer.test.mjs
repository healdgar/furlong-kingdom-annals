import test from 'node:test';
import assert from 'node:assert/strict';
import {CommoditySettlementReducer} from './commodity-settlement-reducer.mjs';

const event=(settlement,day,revision,extra={})=>({kind:'storage',cause:'daily-settlement',version:3,settlement,day,revision,deltas:[],locations:[],flows:{},...extra});
const row=(location,good,owner,availability,before,after)=>({location,good,owner,availability,before,after,delta:after-before});
const seed=()=>{
  const reducer=new CommoditySettlementReducer();
  reducer.apply(event(0,10,1,{locations:[{id:'granary',after:{kind:'granary',x:2}}],deltas:[row('granary','grain','household:1','held',0,10)]}));
  return reducer;
};

test('initial event establishes location metadata and balances from zero',()=>{
  const r=seed();
  assert.deepEqual(r.snapshot(),[{settlement:0,day:10,revision:1,locations:[{id:'granary',metadata:{kind:'granary',x:2}}],balances:[{location:'granary',good:'grain',owner:'household:1',availability:'held',quantity:10}],flows:{}}]);
});

test('owner transfer preserves the settlement total while changing ownership',()=>{
  const r=seed();r.apply(event(0,11,2,{deltas:[row('granary','grain','household:1','held',10,0),row('granary','grain','household:2','held',0,10)]}));
  const balances=r.snapshot()[0].balances;
  assert.deepEqual(balances,[{location:'granary',good:'grain',owner:'household:2',availability:'held',quantity:10}]);
  assert.equal(balances.reduce((sum,b)=>sum+b.quantity,0),10);
});

test('daily consumption applies a negative balance delta and signed flow',()=>{
  const r=seed();r.apply(event(0,11,2,{deltas:[row('granary','grain','household:1','held',10,8)],flows:{consumption:{grain:-2}}}));
  assert.equal(r.snapshot()[0].balances[0].quantity,8);
  assert.deepEqual(r.snapshot()[0].flows,{consumption:{grain:-2}});
});

test('roundoff is tolerated only in delta arithmetic; before remains exact',()=>{
  const r=new CommoditySettlementReducer();
  r.apply(event(0,1,1,{locations:[{id:'bin',after:{}}],deltas:[row('bin','grain','household','held',0,0.1)]}));
  r.apply(event(0,1,2,{deltas:[{location:'bin',good:'grain',owner:'household',availability:'held',before:0.1,after:0.3,delta:0.2}]}));
  assert.equal(r.snapshot()[0].balances[0].quantity,0.3);
  assert.throws(()=>r.apply(event(0,1,3,{deltas:[{location:'bin',good:'grain',owner:'household',availability:'held',before:0.30000000000000004,after:0.2,delta:-0.10000000000000003}]})),/before mismatch/);
});

test('cargo moves between independently sequenced settlement realms',()=>{
  const r=seed();
  r.apply(event(0,11,2,{deltas:[row('granary','grain','household:1','held',10,6)]}));
  r.apply(event(1,11,1,{locations:[{id:'dock',after:{kind:'dock'}}],deltas:[row('dock','grain','household:1','held',0,4)]}));
  const [from,to]=r.snapshot();
  assert.deepEqual(from.balances,[{location:'granary',good:'grain',owner:'household:1',availability:'held',quantity:6}]);
  assert.deepEqual(to.balances,[{location:'dock',good:'grain',owner:'household:1',availability:'held',quantity:4}]);
  assert.equal(from.balances[0].quantity+to.balances[0].quantity,10);
});

test('same-day revisions are contiguous and flows accumulate within the day',()=>{
  const r=seed();
  r.apply(event(0,10,2,{deltas:[row('granary','grain','household:1','held',10,9)],flows:{consumption:{grain:-1}}}));
  r.apply(event(0,10,3,{deltas:[row('granary','grain','household:1','held',9,7)],flows:{consumption:{grain:-2},trade:{grain:0.5}}}));
  assert.deepEqual(r.snapshot()[0],{settlement:0,day:10,revision:3,locations:[{id:'granary',metadata:{kind:'granary',x:2}}],balances:[{location:'granary',good:'grain',owner:'household:1',availability:'held',quantity:7}],flows:{consumption:{grain:-3},trade:{grain:0.5}}});
});

test('location removal is allowed only after its balances are cleared',()=>{
  const r=seed();
  assert.throws(()=>r.apply(event(0,11,2,{locations:[{id:'granary',after:null}]})),/occupied location/);
  assert.equal(r.snapshot()[0].revision,1,'rejection leaves the event unapplied');
  r.apply(event(0,11,2,{deltas:[row('granary','grain','household:1','held',10,0)],locations:[{id:'granary',after:null}]}));
  assert.deepEqual(r.snapshot()[0].locations,[]);
});

test('bad order, unknown locations, duplicate rows, and invalid quantities reject atomically',async t=>{
  const cases=[
    ['before mismatch',{deltas:[{...row('granary','grain','household:1','held',9,8)}]},/before mismatch/],
    ['delta arithmetic',{deltas:[{...row('granary','grain','household:1','held',10,8),delta:-1}]},/arithmetic/],
    ['duplicate row',{deltas:[row('granary','grain','household:1','held',10,9),row('granary','grain','household:1','held',10,8)]},/Duplicate/],
    ['unknown location',{deltas:[row('missing','grain','household:1','held',0,1)]},/Unknown location/],
    ['late failure after staged location, balance and flow changes',{locations:[{id:'new-bin',after:{kind:'new'}}],deltas:[row('new-bin','fish','household:1','held',0,2),{...row('granary','grain','household:1','held',9,8)}],flows:{production:{fish:2}}},/before mismatch/],
    ['negative quantity',{deltas:[{...row('granary','grain','household:1','held',10,-1)}]},/Invalid balance quantity/],
    ['revision gap',{revision:3},/revision/],
    ['revision duplicate',{revision:1},/revision/],
    ['day reversal',{day:9,revision:2},/backward/],
  ];
  for(const[name,extra,pattern]of cases)await t.test(name,()=>{ // awaited: Node 22 cancels a subtest its parent outlives
    const r=seed(),before=structuredClone(r.snapshot());
    assert.throws(()=>r.apply(event(0,11,2,extra)),pattern);
    assert.deepEqual(r.snapshot(),before,'failed event must leave all balances, metadata, flows, and ordering unchanged');
  });
});

test('snapshot sorts realms, locations, balance rows and flow keys',()=>{
  const r=new CommoditySettlementReducer();
  r.apply(event(4,0,1,{locations:[{id:'z',after:{}},{id:'a',after:{}}],deltas:[row('z','wool','owner-z','held',0,1),row('a','grain','owner-a','sale',0,2)],flows:{z:{wool:1},a:{grain:2}}}));
  r.apply(event(1,0,1,{locations:[{id:'home',after:{}}]}));
  const snapshot=r.snapshot();
  assert.deepEqual(snapshot.map(x=>x.settlement),[1,4]);
  assert.deepEqual(snapshot[1].locations.map(x=>x.id),['a','z']);
  assert.deepEqual(snapshot[1].balances.map(x=>x.location),['a','z']);
  assert.deepEqual(Object.keys(snapshot[1].flows),['a','z']);
});

test('hierarchical keys and plain metadata safely retain delimiters and prototype-like names',()=>{
  const r=new CommoditySettlementReducer(),metadata=JSON.parse('{"__proto__":{"safe":true},"owner|good":"kept"}');
  const flows=JSON.parse('{"__proto__":{"constructor":1}}');
  r.apply(event(0,0,1,{locations:[{id:'place|one',after:metadata}],deltas:[row('place|one','grain|fish','owner|x','held|sale',0,2)],flows}));
  const snapshot=r.snapshot()[0];
  assert.deepEqual(snapshot.locations[0].metadata,metadata);
  assert.equal(Object.hasOwn(snapshot.flows,'__proto__'),true);
  assert.equal(Object.hasOwn(snapshot.flows.__proto__,'constructor'),true);
  assert.deepEqual(snapshot.balances,[{location:'place|one',good:'grain|fish',owner:'owner|x',availability:'held|sale',quantity:2}]);
});
