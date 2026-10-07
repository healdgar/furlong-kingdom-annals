import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

const currentHTML=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const baselineHTML=execFileSync('git',['show','b264e07:index.html'],{encoding:'utf8',maxBuffer:16*1024*1024});
function productionFunction(html,name){
  const match=html.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'));
  assert.ok(match,`production ${name} exists`);return match[0];
}
const currentMarket=productionFunction(currentHTML,'commodityClearMarket');
// The batching is held to the baseline's market with today's bread credit (#23: a lender's judgement, creditOf, replaced the
// quarter-year limit); credit is not what this test checks.
const baselineMarket=productionFunction(baselineHTML,'commodityClearMarket').replace('borrow(s,b,Math.min(short,foodYr()*.25-(b._debt||0)))','borrow(s,b,Math.min(short,creditOf(s,b)))');
assert.ok(baselineMarket.includes('creditOf(s,b)'),'the baseline market borrows by today\'s credit');

function runMarket(fn,scenario){
  const r=realm({commodity:true,grain:0,fish:0,households:scenario.buyerCount,cash:0,crown:0});
  r.eval('ownershipTick();storageInit(s)');r.eval(fn);
  const setup={...scenario};delete setup.buyerCount;
  r.C.__marketScenario=setup;
  r.eval(`{
    const cfg=__marketScenario,K=s.storage;storageBindGood(s,'grain');mkt(s,'grain').clear();rsv(s,'grain').clear();
    globalThis.marketSellerIds=[];for(let i=0;i<cfg.sellers.length;i++){
      const row=cfg.sellers[i],owner=row.owner==='buyer0'?householdAccount(H[0]):{id:'seller-'+i,gold:0},location='store-'+i;
      storageRegisterOwner(owner);globalThis.marketSellerIds.push(storageOwnerId(owner));stockOf(s,owner);K.location(location,{capacity:Infinity});K.adjust(location,'grain',owner,'sale',row.qty,'fixture-stock');mkt(s,'grain').set(owner,row.qty);
      if(row.reserve>0)rsv(s,'grain').set(owner,row.reserve);
    }
    for(let i=0;i<H.length;i++)householdAccount(H[i]).assets.w=cfg.cash[i]??20;
    for(let i=0;i<H.length;i++)if(i%3===0)herdOf(H[i],s).cattle=1; // a beast to borrow on: a lender advances half its price (creditOf)
    globalThis.marketOrders=cfg.orders.map(([i,q])=>[H[i],q]);
    globalThis.marketCounts={poolEntryQueries:0,poolTransferQueries:0,poolQuantityQueries:0};
    const E=K.entries,Q=K.quantity,T=K.transfer;
    K.entries=function(fields={}){if(fields.owner===null&&fields.good==='grain'&&fields.availability==='market-cleared'&&fields.location===undefined)marketCounts.poolEntryQueries++;return E.call(this,fields);};
    K.quantity=function(owner,good,availability,...rest){if(owner===null&&good==='grain'&&availability==='market-cleared')marketCounts.poolQuantityQueries++;return Q.call(this,owner,good,availability,...rest);};
    K.transfer=function(fields,...rest){if(fields.owner===null&&fields.good==='grain'&&fields.availability==='market-cleared'&&fields.location===undefined)marketCounts.poolTransferQueries++;return T.call(this,fields,...rest);};
  }
  globalThis.marketGot=commodityClearMarket(s,'grain',marketOrders,1);
  globalThis.marketSettlement=s.storage.settle(2);
  globalThis.marketResult=JSON.stringify({
    got:marketGot,
    sellerIds:marketSellerIds,
    rows:[...s.storage.entries({includeTransit:true})].map(x=>[x.location,storageOwnerId(x.owner),x.good,x.availability,x.qty]),
    market:[...mkt(s,'grain').ownedEntries()].map(([w,q])=>[storageOwnerId(w),q]),
    reserves:[...rsv(s,'grain').ownedEntries()].map(([w,q])=>[storageOwnerId(w),q]),
    cash:{treasury:W.treasury,buyers:H.map(h=>householdAccount(h).assets.w),debts:H.map(h=>h._debt||0),sellers:[...s._owners].filter(([o])=>o&&o.id?.startsWith('seller-')).map(([o])=>[o.id,o.gold||0])},
    available:s.storage.quantity(null,'grain','market-cleared'),
    settlement:marketSettlement,
    counts:marketCounts,
  });`);
  return JSON.parse(r.eval('marketResult'));
}

function ampleScenario(){
  const sellers=Array.from({length:72},(_,i)=>({qty:8+(i%11)*.13,reserve:i===4?2:i===5?.5:0,owner:i===0?'buyer0':undefined}));
  const orders=Array.from({length:40},(_,i)=>[i,.1+(i%7)*.037]);
  const cash=Array.from({length:40},(_,i)=>i===0?1000:i%9===0?.05:1000);
  return {buyerCount:40,sellers,orders,cash};
}
function mixedScenario(){
  const sellers=[{qty:1e16},{qty:.05,owner:'buyer0'},...Array.from({length:32},(_,i)=>({qty:[.1,.2,.3,1.7][i%4],reserve:i===2?2:0}))];
  const orders=Array.from({length:24},(_,i)=>[i,i===0?1e16:i===3?5:[.1,.2,.3,.45][i%4]]);
  const cash=Array.from({length:24},(_,i)=>i===0?1e16:i%3===0?.05:1.2);
  return {buyerCount:24,sellers,orders,cash};
}

for(const[name,scenario]of [['ample-many-buyers-sellers',ampleScenario()],['mixed-scale-scarce-credit',mixedScenario()]]){
  test(`market pool batching matches baseline balances, money, fills, reserves, and settlement: ${name}`,()=>{
    const old=runMarket(baselineMarket,scenario),current=runMarket(currentMarket,scenario);
    assert.deepEqual(current.got,old.got);
    assert.deepEqual(current.rows,old.rows);
    assert.deepEqual(current.market,old.market);
    assert.deepEqual(current.reserves,old.reserves);
    assert.deepEqual(current.cash,old.cash);
    assert.equal(current.available,old.available);
    assert.deepEqual(current.settlement,old.settlement);
    assert.equal(old.got.length,scenario.orders.length,'every submitted buyer order has a result');
    const heldBack=old.market.find(([owner])=>owner===old.sellerIds[4]);
    if(name==='ample-many-buyers-sellers'){
      assert.ok(heldBack&&heldBack[1]===8+4*.13,'seller above the clearing price keeps its reserve stock');
      const eligible=old.market.find(([owner])=>owner===old.sellerIds[5]);
      assert.ok(eligible&&eligible[1]<8+5*.13,'eligible seller at or below price sells a pro-rata share');
    }else{
      assert.ok(old.got[3]<scenario.orders.find(([i])=>i===3)[1],'scarce buyer credit caps the actual fill');
      assert.ok(old.cash.debts[3]>0,'the capped buyer retains its incurred debt');
      assert.ok(old.market.some(([owner])=>owner===old.sellerIds[4]),'reserve-protected stock remains listed');
    }
    if(name==='ample-many-buyers-sellers'){
      assert.ok(old.counts.poolTransferQueries>=scenario.orders.length-2,`baseline should repeat generic pool plans: ${old.counts.poolTransferQueries}`);
      assert.equal(current.counts.poolTransferQueries,0,'batched transfers should use explicit pool rows');
      assert.ok(current.counts.poolEntryQueries<=3,`current path should load/finalize pool once: ${current.counts.poolEntryQueries}`);
      assert.ok(current.counts.poolEntryQueries<old.counts.poolEntryQueries/4,`${old.counts.poolEntryQueries} baseline pool scans vs ${current.counts.poolEntryQueries} current`);
    }
  });
}
