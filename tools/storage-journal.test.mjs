import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const core=html.split('// STORAGE OUTCOME JOURNAL BEGIN')[1].split('// STORAGE OUTCOME JOURNAL END')[0];
function fixture(){const c=vm.createContext({});vm.runInContext(core+';globalThis.J=OutcomeJournal;globalThis.encode=outcomeJSON;globalThis.decode=outcomeParse;globalThis.rows=outcomeRecords',c);return c;}
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
  const rows=chunks.flatMap(x=>[...c.rows(x.text)]);assert.deepEqual(rows.map(r=>[r.seq,r.event.before,r.event.after]),[[0,0,1],[1,1,0]]);assert.equal(c.j.committed,1);assert.equal(c.j.bytes,0);assert.equal(c.j.pending.size,0);
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
test('compact deltas preserve exact primitive and transaction records, future metadata and property order',async()=>{
  const c=fixture(),chunks=[];c.write=async x=>chunks.push(x);
  vm.runInContext(`globalThis.j=new OutcomeJournal(write,{chunkBytes:1400});globalThis.expected=[];
    const lot={id:'lot:realm:1',good:'grain',qty:1e-300,owner:'household:1',location:'field:1',availability:'sale',meta:{missing:undefined,n:-0,nan:NaN,a:[,undefined]}};
    function add(event){expected.push(outcomeJSON({seq:expected.length,event}));j.append(event);}
    for(let i=0;i<30;i++){
      const before=outcomeParse(outcomeJSON(lot));lot.qty=i%3?1e-300:-0;
      if(i%2)lot.extra={id:'metadata',before:{id:'nested',x:i}};else delete lot.extra;
      const after=outcomeParse(outcomeJSON(lot));
      const event={seq:i,settlement:0,day:i,kind:'storage',cause:'title-transfer',lot:lot.id,owner:lot.owner,location:lot.location,good:lot.good,availability:lot.availability,qty:i,qtyAfter:lot.qty,lotAfter:after,before};
      if(i%3)add({kind:'transaction',version:1,id:'tx:'+i,effects:[{kind:'storage',event}],result:{ok:true}});else add(event);
      after.meta.n=99;before.meta.n=100;
    }`,c);
  await c.j.flush();const actual=chunks.flatMap(x=>[...c.rows(x.text)]).map(x=>c.encode(x));assert.deepEqual(actual,Array.from(c.expected));assert.ok(chunks.length>1);
});
test('rejected compact append rolls back dictionary and delta changes',async()=>{
  const c=fixture(),chunks=[];c.write=async x=>chunks.push(x);vm.runInContext(`globalThis.j=new OutcomeJournal(write);j.append({lotAfter:{id:'lot:1',qty:1}});globalThis.bad={lotAfter:{id:'lot:1',qty:2},newString:'a never accepted string',fail:()=>{}}`,c);
  assert.throws(()=>c.j.append(c.bad),/Unsupported/);c.j.append(vm.runInContext("({lotAfter:{id:'lot:1',qty:3}})",c));await c.j.flush();assert.deepEqual(chunks.flatMap(x=>[...c.rows(x.text)]).map(x=>x.event.lotAfter.qty),[1,3]);
});
test('legacy chunks remain readable and compact readers do not share mutable snapshot fields',async()=>{
  const c=fixture();vm.runInContext(`globalThis.j=new OutcomeJournal(async()=>{}, {mode:'legacy'});j.append({n:-0});globalThis.legacy=[...j.uncommitted()];globalThis.k=new OutcomeJournal(async()=>{});k.append({lotAfter:{id:'lot:1',meta:{a:1}}});k.append({lotAfter:{id:'lot:1',meta:{a:1}}});globalThis.it=k.uncommitted()`,c);
  assert.ok(Object.is(c.legacy[0].event.n,-0));const first=c.it.next().value;first.event.lotAfter.meta.a=99;assert.equal(c.it.next().value.event.lotAfter.meta.a,1);
});
test('compact repeated storage outcomes substantially reduce encoded bytes without losing a record',async()=>{
  const c=fixture();vm.runInContext(`globalThis.compact=new OutcomeJournal(async()=>{}, {chunkBytes:1e9});globalThis.legacy=new OutcomeJournal(async()=>{}, {mode:'legacy',chunkBytes:1e9});
    for(let i=0;i<1000;i++){const lot={id:'lot:0:1',good:'grain',qty:i/1000,owner:'household:1',location:'field:0:1',availability:'sale',price:2};const e={seq:i,settlement:0,day:250,kind:'storage',cause:'title-transfer',lot:lot.id,owner:lot.owner,location:lot.location,good:lot.good,availability:lot.availability,qty:1e-20,qtyAfter:lot.qty,lotAfter:lot,before:{...lot,qty:lot.qty+1e-20},from:'household:2'};compact.append(e);legacy.append(e);}`,c);
  assert.ok(c.compact.encodedCharacters<c.legacy.encodedCharacters*.3,`${c.compact.encodedCharacters}/${c.legacy.encodedCharacters}`);
  const actual=[...c.compact.uncommitted()].map(x=>c.encode(x)),expected=[...c.legacy.uncommitted()].map(x=>c.encode(x));assert.deepEqual(actual,expected);
});
test('compact optimization never invokes accessors and survives identical nested storage schemas',async()=>{
 const c=fixture();vm.runInContext(`globalThis.j=new OutcomeJournal(async()=>{});globalThis.e={lotAfter:{}};Object.defineProperty(e.lotAfter,'id',{get(){throw Error('getter invoked')}})`,c);assert.throws(()=>c.j.append(c.e),/accessor/);assert.equal(c.j.seq,0);
 vm.runInContext(`globalThis.expected=[];const shape=(seq,extra)=>({seq,kind:'storage',lotAfter:null,extra});for(let i=0;i<5;i++){const event=shape(i,shape(i+1,null));expected.push(outcomeJSON({seq:i,event}));j.append(event)}`,c);assert.deepEqual([...c.j.uncommitted()].map(x=>c.encode(x)),Array.from(c.expected));
});
test('owned capture handles expand canonical events and survive later mutation, transactions and observer mutation',async()=>{
 const c=fixture();const capture=html.slice(html.indexOf('const STORAGE_CAPTURE_DATA='),html.indexOf('class StorageLedger {'));vm.runInContext("function storageOwnerId(o){return o??'unassigned'};const STORAGE_OUTCOMES={journal:{mode:'compact'}};"+capture,c);
 vm.runInContext(`globalThis.j=new OutcomeJournal(async()=>{});globalThis.expected=[];globalThis.observed=[];globalThis.FURLONG_STORAGE_AUDIT_OBSERVER=e=>{observed.push(outcomeJSON(e));if(e.lotAfter?.nested)e.lotAfter.nested.x=1000};
 const lot={id:'lot:0:1',owner:'household:1',qty:1e-300,good:'grain',location:'yard',availability:'held'};
 for(let i=0;i<12;i++){const before=storageLotHandle(lot);lot.qty=i%2?-0:1e-300;if(i===3)lot.nested={x:1};if(i>3)lot.nested.x++;const event={seq:i,kind:'storage',lot:lot.id,owner:lot.owner,qtyAfter:lot.qty,lotAfter:storageLotHandle(lot),before};const expanded=storageExpandOutcome(event);expected.push(outcomeJSON({seq:i,event:i%2?{kind:'transaction',effects:[{kind:'storage',event:expanded}]}:expanded}));storageObserveOutcome(event);j.append(i%2?{kind:'transaction',effects:[{kind:'storage',event}]}:event);}
 lot.qty=99;lot.nested.x=99;`,c);
 assert.deepEqual([...c.j.uncommitted()].map(x=>c.encode(x)),Array.from(c.expected));assert.equal(c.observed.length,12);assert.equal(c.FURLONG_STORAGE_AUDIT_SUPPORTED,true);
});
