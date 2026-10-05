import test from 'node:test';
import assert from 'node:assert/strict';
import {realm} from './ownership-fixture.mjs';

function fixture(){
  const r=realm({grain:0,fish:0,cash:100});
  r.eval("storageInit(s);mkt(s,'ore').clear()");
  return r;
}
function market(r,g='ore'){
  return JSON.parse(r.eval(`JSON.stringify([...mkt(s,'${g}')].map(([o,q])=>[o,q]))`));
}
function originalScan(r,g='ore'){
  return JSON.parse(r.eval(`JSON.stringify([...s._owners].filter(([,x])=>x.sale['${g}']!==undefined).map(([o,x])=>[o,x.sale['${g}']]))`));
}
function countSaleReads(r,owner){
  r.C.__offerReadCount=0;
  r.eval(`{
    const x=stockOf(s,${JSON.stringify(owner)}),d=Object.getOwnPropertyDescriptor(x,'sale');
    Object.defineProperty(x,'sale',{configurable:true,enumerable:true,get(){__offerReadCount++;return d.get.call(this)},set(v){d.set.call(this,v)}});
  }`);
}

test('sparse sale index preserves zero and NaN entries, canonical order, cleanup, and skips unrelated owners',()=>{
  const r=fixture();
  r.eval("for(let i=0;i<200;i++)stockOf(s,'empty:'+i);const M=mkt(s,'ore');M.set('first',0);M.set('second',NaN);M.set('third',3);stockOf(s,'fourth').sale.ore=undefined");
  const initial=originalScan(r);
  countSaleReads(r,'empty:100');
  assert.deepEqual(market(r),initial);
  assert.deepEqual(market(r),[['first',0],['second',null],['third',3]]);
  assert.equal(r.C.__offerReadCount,0,'irrelevant owner sale table was read');
  r.eval("mkt(s,'ore').delete('first');mkt(s,'ore').delete('second')");
  const afterCleanup=originalScan(r);r.C.__offerReadCount=0;
  assert.deepEqual(market(r),afterCleanup);
  assert.deepEqual(market(r),[['third',3]]);
  assert.equal(r.C.__offerReadCount,0,'cleanup inspected an unrelated owner');
});

test('sale iterator sees live appends and skips deleted owners like the original Map scan',()=>{
  const [candidate,reference]=[fixture(),fixture()];
  for(const r of [candidate,reference])r.eval("const M=mkt(s,'ore');M.set('a',1);M.set('b',2);M.set('c',3)");
  const actual=candidate.eval("(()=>{const it=mkt(s,'ore').entries(),out=[it.next().value];mkt(s,'ore').delete('b');mkt(s,'ore').set('d',4);for(let n=it.next();!n.done;n=it.next())out.push(n.value);return JSON.stringify(out)})()");
  const baseline=reference.eval("(()=>{const it=(function*(){for(const[o,x]of s._owners)if(x.sale.ore!==undefined)yield[o,x.sale.ore]})(),out=[it.next().value];mkt(s,'ore').delete('b');mkt(s,'ore').set('d',4);for(let n=it.next();!n.done;n=it.next())out.push(n.value);return JSON.stringify(out)})()");
  assert.equal(actual,baseline);
  assert.deepEqual(JSON.parse(actual),[['a',1],['c',3],['d',4]]);
});

test('public dirty notification falls back to whole-table iteration',()=>{
  const r=fixture();
  r.eval("for(let i=0;i<20;i++)stockOf(s,'empty:'+i);mkt(s,'ore').set('seller',2);storageTitleDirty(s,'ore')");
  countSaleReads(r,'empty:10');
  assert.equal(r.eval('STORAGE_ACTIVE_CLAIMS.get(s).fallback'),true);
  const expected=originalScan(r);r.C.__offerReadCount=0;
  assert.deepEqual(market(r),expected);
  assert.equal(r.C.__offerReadCount,1,'fallback did not inspect the unrelated owner');
});

test('same-size raw owner-map replacement plus public dirty matches original scan',()=>{
  const r=fixture();
  r.eval("for(let i=0;i<8;i++)mkt(s,'ore').set('seller:'+i,i+1);s._owners=new Map([...s._owners].reverse());storageTitleDirty(s,'ore')");
  const expected=originalScan(r);
  assert.equal(r.eval('STORAGE_ACTIVE_CLAIMS.get(s).fallback'),true);
  assert.deepEqual(market(r),expected);
  assert.deepEqual(market(r).map(([owner])=>owner),expected.map(([owner])=>owner));
});

test('char sale aliases retain whole-table owner traversal',()=>{
  const r=fixture();
  r.eval("for(let i=0;i<20;i++)stockOf(s,'empty:'+i);mkt(s,'char').set('char-seller',1)");
  countSaleReads(r,'empty:10');
  const expected=originalScan(r,'char');r.C.__offerReadCount=0;
  assert.deepEqual(market(r,'char'),expected);
  assert.equal(r.C.__offerReadCount,1,'char alias path did not traverse all owners');
  assert.equal(r.eval('STORAGE_ACTIVE_CLAIMS.get(s).fallback'),false,'char fallback should not poison the cache');
});

function midIteration(r,indexed,mutation){
  const source=indexed
    ? `mkt(s,'ore').entries()`
    : `(function*(){for(const[o,x]of s._owners)if(x.sale.ore!==undefined)yield[o,x.sale.ore]})()`;
  return r.eval(`(()=>{const it=${source},out=[it.next().value];${mutation}for(let n=it.next();!n.done;n=it.next())out.push(n.value);return JSON.stringify(out)})()`);
}
function pairedMidIteration(setup,mutation){
  const [candidate,reference]=[fixture(),fixture()];
  for(const r of [candidate,reference])r.eval(setup);
  return [midIteration(candidate,true,mutation),midIteration(reference,false,mutation),candidate];
}

test('public dirty after first yield falls back at the native iterator cursor',()=>{
  const [actual,expected]=pairedMidIteration(
    "mkt(s,'ore').set('a',1);mkt(s,'ore').set('b',2);mkt(s,'ore').set('c',3)",
    "storageTitleDirty(s,'ore');"
  );
  assert.equal(actual,expected);
  assert.deepEqual(JSON.parse(actual),[['a',1],['b',2],['c',3]]);
});

test('first seller sale getter may dirty during yield and fallback continues after that seller',()=>{
  const setup="mkt(s,'ore').set('a',1);mkt(s,'ore').set('b',2);mkt(s,'ore').set('c',3);{const x=stockOf(s,'a');let sale=x.sale;Object.defineProperty(x,'sale',{configurable:true,get(){storageTitleDirty(s,'ore');return sale},set(v){sale=v}})}";
  const [actual,expected,candidate]=pairedMidIteration(setup,'');
  assert.equal(actual,expected);
  assert.deepEqual(JSON.parse(actual),[['a',1],['b',2],['c',3]]);
  assert.equal(candidate.eval('STORAGE_ACTIVE_CLAIMS.get(s).fallback'),true);
});

test('delete and reinsert before dirty fallback preserves native Map order',()=>{
  const [actual,expected]=pairedMidIteration(
    "mkt(s,'ore').set('a',1);mkt(s,'ore').set('b',2);mkt(s,'ore').set('c',3)",
    "const x=s._owners.get('a');s._owners.delete('a');s._owners.set('a',x);storageTitleDirty(s,'ore');"
  );
  assert.equal(actual,expected);
  assert.deepEqual(JSON.parse(actual),[['a',1],['b',2],['c',3],['a',1]]);
});

test('same-size owner-map replacement plus dirty continues the captured old Map',()=>{
  const [actual,expected]=pairedMidIteration(
    "mkt(s,'ore').set('a',1);mkt(s,'ore').set('b',2);mkt(s,'ore').set('c',3)",
    "s._owners=new Map([...s._owners].reverse());storageTitleDirty(s,'ore');"
  );
  assert.equal(actual,expected);
  assert.deepEqual(JSON.parse(actual),[['a',1],['b',2],['c',3]]);
});

test('late accessor definition marks the good unsafe and falls back at cursor',()=>{
  const setup="mkt(s,'ore').set('a',1);mkt(s,'ore').set('b',2);mkt(s,'ore').set('c',3)";
  const mutation="Object.defineProperty(stockOf(s,'c').sale,'ore',{configurable:true,enumerable:true,get(){return 9}});";
  const [actual,expected,candidate]=pairedMidIteration(setup,mutation);
  assert.equal(actual,expected);
  assert.deepEqual(JSON.parse(actual),[['a',1],['b',2],['c',9]]);
  assert.equal(candidate.eval("STORAGE_ACTIVE_CLAIMS.get(s).unsafe.has('ore')"),true);
});
