import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const baseline=execFileSync('git',['show','b264e07:index.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
function core(text){const ctx=vm.createContext({});vm.runInContext(text.slice(text.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */'),text.indexOf('/* Runtime adapters for numeric commodity custody. */')),ctx);return ctx.CommodityBalanceLedger;}

test('live row queries retain exact original ordering and totals without visiting empty cargo',()=>{
  const Current=core(source),Old=core(baseline),a=new Current(),b=new Old();
  for(const K of [a,b]){
    K.location('early-empty',{capacity:Infinity});K.location('yard',{capacity:Infinity});
    K.adjust('yard','grain','one','held',1e16);K.location('late',{capacity:Infinity});
    K.adjust('late','grain','two','sale',.3);K.adjust('early-empty','grain','three','held',1);
    for(let i=0;i<1000;i++)K.location('cargo:'+i,{transit:true,capacity:Infinity});
    K.adjust('yard','fish','one','held',.2);
    K.consume({owner:'three',good:'grain',availability:'held'},1);
    K.adjust('early-empty','grain','three','held',2);
    K.transfer({owner:'one',good:'grain',availability:'held'},4,'four',{location:'late',availability:'sale'});
    K.location('late',{transit:true});
  }
  for(const fields of [{},{good:'grain'},{owner:'one'},{owner:'four',good:'grain'},{includeTransit:true}])
    assert.deepEqual(JSON.parse(JSON.stringify([...a.entries(fields)])),JSON.parse(JSON.stringify([...b.entries(fields)])));
  let scans=0,gets=0;const get=a.facilities.get.bind(a.facilities);
  a.facilities.get=id=>{gets++;return get(id);};
  a.facilities[Symbol.iterator]=function*(){scans++;yield* Map.prototype.entries.call(this);};
  for(const g of ['grain','fish'])for(const transit of [false,true])assert.equal(a.total(g,transit),b.total(g,transit));
  assert.equal(scans,0);assert.ok(gets<=8,'total visits live locations rather than 1000 retained cargo facilities');
  gets=0;assert.equal([...a.entries({owner:'one',good:'fish'})].length,1);assert.equal(gets,1);
  assert.deepEqual(JSON.parse(JSON.stringify(a.settle(1))),JSON.parse(JSON.stringify(b.settle(1))),'query changes add no daily settlement records');
});

test('ordinary crop allocations never recount town totals and retain the shortage preflight',()=>{
  const r=realm({commodity:true,households:8,grain:1000,fish:0});
  r.eval('ownershipTick();storageInit(s);mkt(s,"grain").clear();globalThis.recounts=0;const originalTotal=s.storage.total;s.storage.total=function(...args){recounts++;return originalTotal.apply(this,args)}');
  r.eval('for(const h of H)offer(s,"grain",h,1)');
  assert.equal(r.eval('recounts'),0);
  assert.equal(r.eval('H.reduce((n,h)=>n+(mkt(s,"grain").get(h)||0),0)'),8);
  assert.throws(()=>r.eval('offer(s,"grain",H[0],2000)'),/Unbacked grain commodity allocation/);
  assert.equal(r.eval('mkt(s,"grain").get(H[0])'),1,'failed allocation does not alter pantry or sale balances');
});
