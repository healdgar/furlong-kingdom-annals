import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=html.split('// HISTORY CORE BEGIN')[1].split('\n').slice(1).join('\n').split('// HISTORY CORE END')[0];
function fixture(){const c=vm.createContext({btoa,atob});vm.runInContext(core+';globalThis.G=HistoryGraph;globalThis.A=HistoryArchive',c);return c;}
function frame(g,r,seq){return {seq,day:seq,...g.capture(r)};}
test('snapshot plus changes reconstructs cycles, identity, deletions, Map/Set order and every previous state',()=>{
  const c=fixture();vm.runInContext(`
    const g=new G(),s={name:'town'},p={id:1,home:s};s.folk=[p];const root={s,p,map:new Map([[p,7],[s,8]]),set:new Set([s,p])};
    const steps=[{seq:0,...g.capture(root)}];p.cash=5;s.folk.push(p);root.map.delete(p);root.map.set(p,9);delete s.name;
    steps.push({seq:1,...g.capture(root)});p.dead=true;root.s=null;steps.push({seq:2,...g.capture(root)});
    globalThis.archive=new A(JSON.parse(JSON.stringify({format:'furlong-history',version:1,steps})));`,c);
  for(const i of [0,1,2,0,2,1,0]){
    const r=c.archive.seek(i);assert.equal(r.p.home,r.s||r.p.home);assert.equal(r.p.home.folk[0],r.p);assert.equal(r.p.dead,i===2?true:undefined);
    assert.equal(r.p.cash,i>0?5:undefined);assert.equal(r.p.home.name,i===0?'town':undefined);
    assert.equal(r.map.get(r.p),i===0?7:9);assert.equal([...r.map.keys()][i===0?0:1],r.p);
    assert.equal([...r.set][1],r.p);if(i>0)assert.equal(r.p.home.folk[1],r.p);
  }
});
test('numbers retain negative zero, infinities, NaN, bigint and missing array entries',()=>{
  const c=fixture();vm.runInContext(`const g=new G(),root={a:[NaN,Infinity,-Infinity,-0,undefined,123n,,8]};globalThis.a=new A({format:'furlong-history',version:1,steps:[{seq:0,...g.capture(root)}]})`,c);
  const r=c.a.seek(0);assert.ok(Number.isNaN(r.a[0]));assert.equal(r.a[1],Infinity);assert.equal(r.a[2],-Infinity);assert.ok(Object.is(r.a[3],-0));assert.equal(r.a[5],123n);assert.equal(6 in r.a,false);
});
test('binary snapshots retain exact bytes and shared typed-array buffers across rewinds',()=>{
  const c=fixture();vm.runInContext(`const g=new G(),buffer=new ArrayBuffer(16),a=new Float32Array(buffer),b=new Uint8Array(buffer,4,8),root={a,b};a[0]=NaN;a[1]=-0;const steps=[{seq:0,...g.capture(root)}];b[0]=17;steps.push({seq:1,...g.capture(root)});globalThis.a=new A({format:'furlong-history',version:1,steps});`,c);
  const r=c.a.seek(0);assert.equal(r.a.buffer,r.b.buffer);assert.ok(Object.is(r.a[1],-0));assert.ok(Number.isNaN(r.a[0]));assert.equal(r.b[0],0);assert.equal(c.a.seek(1).b[0],17);assert.equal(c.a.seek(0).b[0],0);
});
test('capture never invokes accessors; executable behavior is inert after import',()=>{
  const c=fixture();vm.runInContext(`const g=new G(),root={};Object.defineProperty(root,'x',{enumerable:true,get(){throw Error('capture read an accessor')}});globalThis.a=new A({format:'furlong-history',version:1,steps:[{seq:0,...g.capture(root)}]});`,c);
  const r=c.a.seek(0);assert.equal(r.x.historyAccessor,true);assert.equal(r.x.get.historyBehavior,true);assert.notEqual(typeof r.x.get,'function');
});
test('unsupported values fail before committing any node changes',()=>{
  const c=fixture();vm.runInContext(`globalThis.g=new G();globalThis.root={a:1}`,c);frame(c.g,c.root,0);const before=[...c.g.state];c.root.a=2;c.root.bad=Symbol('unsupported');
  assert.throws(()=>c.g.capture(c.root),/symbol/);assert.deepEqual([...c.g.state],before);
});
test('divergence and a missing transaction fail before changing the reader cursor',()=>{
  const c=fixture();vm.runInContext(`const g=new G(),r={n:0},steps=[{seq:0,...g.capture(r)}];r.n=1;steps.push({seq:1,...g.capture(r)});globalThis.data={format:'furlong-history',version:1,steps};globalThis.a=new A(data)`,c);c.a.seek(0);c.data.steps[1].changes[0][1]='corrupt';
  assert.throws(()=>c.a.seek(1),/diverged/);assert.equal(c.a.cursor,0);assert.equal(c.a.read().n,0);c.data.steps[1].seq=2;assert.throws(()=>c.a.seek(1),/gap/);
});
test('random-stream observation and restoration preserve continuation without drawing',()=>{
  const c=vm.createContext({});vm.runInContext(html.slice(html.indexOf('function sfc32('),html.indexOf('function seedStreams('))+';globalThis.a=sfc32(1,2,3,4);globalThis.b=sfc32(1,2,3,4)',c);
  c.a();c.b();const state=c.a.state();assert.deepEqual(Array.from(state),Array.from(c.a.state()));
  const expected=Array.from({length:40},()=>c.b());assert.deepEqual(Array.from({length:40},()=>c.a()),expected);c.a.restore(state);assert.deepEqual(Array.from({length:40},()=>c.a()),expected);
});
test('changing one binary page records only that page, retaining the shared buffer',()=>{
  const c=fixture();vm.runInContext(`const g=new G(),r={a:new Uint8Array(16384)};g.capture(r);r.a[9000]=7;globalThis.frame=g.capture(r)`,c);
  assert.equal(c.frame.changes.length,1);assert.equal(JSON.parse(c.frame.changes[0][2])[0],'bytes');
});
test('a failed capture cannot advance byte caches or lose newly interned behavior code',()=>{
  const c=fixture();vm.runInContext(`globalThis.g=new G();globalThis.r={a:new Uint8Array(16)};globalThis.steps=[{seq:0,...g.capture(r)}];r.a[0]=7;r.f=()=>1;r.bad=Symbol('bad')`,c);
  assert.throws(()=>c.g.capture(c.r),/symbol/);delete c.r.bad;
  c.steps.push({seq:1,...c.g.capture(c.r)});const a=new c.A({format:'furlong-history',version:1,steps:c.steps}),r=a.seek(1);assert.equal(r.a[0],7);assert.equal(r.f.source,'()=>1');assert.equal(a.seek(0).a[0],0);
});
