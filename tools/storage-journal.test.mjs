import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=html.split('// STORAGE OUTCOME JOURNAL BEGIN')[1].split('// STORAGE OUTCOME JOURNAL END')[0];
function fixture(){const c=vm.createContext({});vm.runInContext(core+';globalThis.J=OutcomeJournal;globalThis.encode=outcomeJSON;globalThis.decode=outcomeParse',c);return c;}
test('outcomes retain property presence, unusual numbers, array holes and reserved-looking keys',()=>{
  const c=fixture();vm.runInContext("globalThis.e={day:2,n:-0,missing:undefined,nan:NaN,inf:Infinity,large:123n,a:[,undefined],reserved:{$number:'NaN'},__proto__:null};globalThis.result=outcomeParse(outcomeJSON(e))",c);
  const r=c.result;assert.ok(Object.is(r.n,-0));assert.ok(Object.hasOwn(r,'missing'));assert.equal(r.missing,undefined);assert.ok(Number.isNaN(r.nan));assert.equal(r.inf,Infinity);assert.equal(r.large,123n);assert.equal(0 in r.a,false);assert.equal(1 in r.a,true);assert.equal(r.reserved.$number,'NaN');
});
test('unsupported or accessor data rejects before advancing sequence',()=>{
  const c=fixture();vm.runInContext("globalThis.j=new OutcomeJournal(async()=>{});globalThis.e={};Object.defineProperty(e,'x',{get(){throw Error('getter ran')}})",c);
  assert.throws(()=>c.j.append(c.e),/accessor/);assert.equal(c.j.seq,0);assert.equal(c.j.bytes,0);assert.throws(()=>c.j.append(()=>{}),/Unsupported/);assert.equal(c.j.seq,0);
});
test('append detaches data and commits every transient outcome in order',async()=>{
  const c=fixture(),chunks=[];c.write=async e=>chunks.push({...e});vm.runInContext("globalThis.j=new OutcomeJournal(write,{chunkBytes:1});const e={kind:'change',before:0,after:1};j.append(e);e.before=1;e.after=0;j.append(e);e.after=99",c);await c.j.flush();
  const rows=chunks.flatMap(x=>x.text.trimEnd().split('\n').map(t=>c.decode(t)));assert.deepEqual(rows.map(r=>[r.seq,r.event.before,r.event.after]),[[0,0,1],[1,1,0]]);assert.equal(c.j.committed,1);assert.equal(c.j.bytes,0);assert.equal(c.j.pending.size,0);
});
test('backpressure keeps all accepted records until the writer acknowledges them',async()=>{
  const c=fixture(),gates=[];c.write=e=>new Promise(resolve=>gates.push({e,resolve}));vm.runInContext("globalThis.j=new OutcomeJournal(write,{chunkBytes:1,maxPendingBytes:1});j.append({n:1});j.append({n:2})",c);assert.equal(c.j.ready,false);await Promise.resolve();
  assert.equal(gates.length,1);assert.equal(c.j.pending.size,2);assert.equal(c.j.committed,-1);gates[0].resolve();await new Promise(setImmediate);
  assert.equal(gates.length,2);assert.equal(c.j.committed,0);assert.equal(c.j.pending.size,1);gates[1].resolve();await c.j.flush();assert.equal(c.j.ready,true);assert.equal(c.j.bytes,0);
});
test('failed persistence retains the complete tail and blocks later appends',async()=>{
  const c=fixture();c.write=async()=>{throw Error('quota')};vm.runInContext("globalThis.j=new OutcomeJournal(write,{chunkBytes:1});j.append({n:1});j.append({n:2})",c);await assert.rejects(c.j.flush(),/quota/);
  assert.equal(c.j.committed,-1);assert.equal(c.j.ready,false);assert.equal(c.j.pending.size,2);assert.deepEqual([...c.j.uncommitted()].map(r=>[r.seq,r.event.n]),[[0,1],[1,2]]);assert.throws(()=>c.j.append({n:3}),/quota/);assert.equal(c.j.seq,2);
});
