// Cost/coverage contracts, measured by independent counters, never timing thresholds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {GameWriteLog,GameWriteReducer} from './game-write-log.mjs';
import {transformWrites} from './game-write-transform.mjs';
import {buildGameConfig} from './game-write-game-config.mjs';
import {createWriteArtifact,verifyWriteArtifact,buildGameWriteArtifact} from './game-write-build.mjs';
const html=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const sha=v=>createHash('sha256').update(v).digest('hex');

test('post-founding writes never enumerate or read untouched model branches',()=>{
  let enumerations=0,descriptors=0,gets=0;
  const dormant=new Proxy({people:Array.from({length:10000},(_,id)=>({id,balance:id/7}))},{ownKeys(t){enumerations++;return Reflect.ownKeys(t);},getOwnPropertyDescriptor(t,k){descriptors++;return Reflect.getOwnPropertyDescriptor(t,k);},get(t,k,r){gets++;return Reflect.get(t,k,r);}});
  const root={dormant,live:{balance:1}},records=[],log=new GameWriteLog({emit:r=>records.push(r)});log.snapshot(root);enumerations=descriptors=gets=0;
  for(let i=0;i<100;i++)log.set(root.live,'balance',i/3);
  assert.equal(enumerations,0);assert.equal(descriptors,0);assert.equal(gets,0);
  assert.ok(records.slice(1).every(r=>r.definitions.length===0));assert.equal(log.records.length,0,'sink owns accepted history; producer does not retain a second history');
});
test('uncapped life/annal append cost stays bounded as existing history grows',()=>{
  for(const length of [100,100000]){
    const events=Array.from({length},(_,i)=>i),log=new GameWriteLog({retainRecords:true});log.snapshot({events});log.call(events,Array.prototype.push,['new event']);
    const r=log.records.at(-1);assert.equal(r.entries.length,1);assert.equal(r.entries[0][0],length);assert.equal(r.length.value,length+1);assert.equal(r.definitions.length,0);
    assert.ok(JSON.stringify(r).length<350,'one append must not capture the existing uncapped ledger');
  }
});
test('one terrain element captures only its actual bytes, including shared-view offset',()=>{
  for(const length of [100,100000]){
    const buffer=new ArrayBuffer(length*4),terrain=new Float32Array(buffer,20,10),log=new GameWriteLog({retainRecords:true});log.snapshot({buffer});
    log.set(terrain,'3',1/3);const r=log.records.at(-1);assert.equal(r.offset,32);assert.equal(r.bytes.length,4);assert.equal(r.definitions.length,0);
    const reducer=new GameWriteReducer();for(const row of log.records)reducer.apply(row);assert.deepEqual([...new Uint8Array(reducer.root.buffer)],[...new Uint8Array(buffer)]);
  }
});
test('failed history admission retains its exact outcome and stops later canonical writes',()=>{
  const root={wallet:4},accepted=[],log=new GameWriteLog({emit:r=>{if(r.seq===2)throw Error('sink full');accepted.push(r);}});log.snapshot(root);log.set(root,'wallet',3);
  assert.throws(()=>log.set(root,'wallet',2),/sink full/);assert.equal(log.rejectedRecord.descriptor.value,2);assert.equal(log.rejectedRecord.seq,2);assert.equal(accepted.length,2);
  assert.throws(()=>log.set(root,'wallet',1),/sink full/);assert.equal(root.wallet,2);assert.ok(Object.isFrozen(log.rejectedRecord));
});
test('source evolution cannot silently certify unresolved model writes or native calls',()=>{
  const config=buildGameConfig(html);assert.equal(config.htmlSHA256,sha(html));assert.equal(config.complete,false,'prototype bootstrap/closure/facade gaps must remain visible');assert.ok(config.gaps.length>0);
  for(const source of ['world.cell=2;world.mysteryNative();','[world.cell]=values;','class X extends Y{f(){super.cell=2;}}']){
    assert.throws(()=>transformWrites(source,{failUnsupported:true}),e=>e.manifest.complete===false&&e.manifest.sites.some(s=>s.status==='unsupported'));
  }
});
test('build admission rejects unresolved game coverage and stale source/runtime artifacts',()=>{
  assert.throws(()=>buildGameWriteArtifact(html),e=>e.coverage.gaps.length>0&&e.coverage.unsupported.length>0);
  const source='const world={wallet:3};world.wallet-=1;',options={},runtimeSource='fixture runtime',artifact=createWriteArtifact(source,options,{runtimeSource,scope:'fixture member writes'});
  assert.equal(verifyWriteArtifact(artifact,source,options,{runtimeSource}),true);
  assert.throws(()=>verifyWriteArtifact(artifact,source+'world.wallet=0;',options,{runtimeSource}),/Stale/);
  assert.throws(()=>verifyWriteArtifact(artifact,source,options,{runtimeSource:'changed runtime'}),/runtimeSHA256/);
  assert.throws(()=>verifyWriteArtifact({...artifact,code:artifact.code+'world.wallet=0;'},source,options,{runtimeSource}),/generated mutation sites/);
});
test('default durable append and binary sealing never call the canonical codec',async()=>{
  const journal=html.split('// STORAGE OUTCOME JOURNAL BEGIN')[1]?.split('// STORAGE OUTCOME JOURNAL END')[0];assert.ok(journal);
  const c=vm.createContext({setTimeout,clearTimeout});vm.runInContext(journal+`
    let canonicalCalls=0;const poison=()=>{canonicalCalls++;throw Error('canonical processing on producer');};
    OutcomeCodec.prototype.encode=poison;OutcomeCodec.prototype.decode=poison;outcomeJSON=poison;outcomeParse=poison;
    const batches=[],journal=new RawOutcomeJournal(async entry=>{batches.push(entry);return {chunk:entry.chunk,first:entry.first,last:entry.last};},{chunkBytes:1});
    for(let i=0;i<30;i++)journal.append({kind:'storage',order:i,value:i/7});
    globalThis.result=journal.flush().then(()=>({canonicalCalls,status:journal.status(),batches:batches.map(b=>({first:b.first,last:b.last,rows:outcomeBinaryDecode(b.binary)}))}));
  `,c);
  const result=await c.result;assert.equal(result.canonicalCalls,0);assert.equal(result.status.committed,29);assert.equal(result.status.pendingBytes,0);
  const rows=result.batches.flatMap(b=>b.rows);assert.equal(rows.length,30);rows.forEach((r,i)=>{assert.equal(r.seq,i);assert.equal(r.event.values[r.event.keys.indexOf('order')],i);assert.ok(Object.is(r.event.values[r.event.keys.indexOf('value')],i/7));});
});
