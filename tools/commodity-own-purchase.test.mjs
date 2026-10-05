import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

test('a fully self-funded own-offer purchase skips the seller scan',()=>{
  const r=realm({commodity:true,households:2,grain:10,fish:0});
  r.eval('ownershipTick();storageInit(s)');
  r.eval(`
    mkt(s,'grain').clear();
    addHeld(s,H[0],'grain',2);
    offer(s,'grain',H[0],5,3);
    const L=mkt(s,'grain'),base=Object.getPrototypeOf(L).ownedEntries;
    globalThis.sellerScans=0;
    L.ownedEntries=function*(){sellerScans++;yield*base.call(this);};
    globalThis.cash0=H[0].w;
    globalThis.paid=purchase(s,'grain',H[0],4,2);
  `);
  assert.equal(r.eval('sellerScans'),0);
  near(r.eval('purchase.got'),4);
  near(r.eval('paid'),0);
  near(r.eval('H[0].w'),r.eval('cash0'));
  near(r.eval("pantry(s,H[0]).grain"),6);
  near(r.eval("mkt(s,'grain').get(H[0])"),1);
  near(r.eval("rsv(s,'grain').get(H[0])"),3);
  near(r.s.stores.grain,10);
});

test('a partial own offer still scans and buys the remaining seller supply',()=>{
  const r=realm({commodity:true,households:2,grain:10,fish:0});
  r.eval('ownershipTick();storageInit(s)');
  r.eval(`
    mkt(s,'grain').clear();
    offer(s,'grain',H[0],2,5);
    offer(s,'grain',H[1],5,1);
    const L=mkt(s,'grain'),base=Object.getPrototypeOf(L).ownedEntries;
    globalThis.sellerScans=0;
    L.ownedEntries=function*(){sellerScans++;yield*base.call(this);};
    globalThis.paid=purchase(s,'grain',H[0],4,2);
  `);
  assert.ok(r.eval('sellerScans')>0);
  near(r.eval('purchase.got'),4);
  near(r.eval('paid'),4);
  near(r.eval("pantry(s,H[0]).grain"),4);
  near(r.eval("mkt(s,'grain').get(H[1])"),3);
  near(r.s.stores.grain,10);
});

test('native seller iteration skips nonsellers and preserves account order',()=>{
  const r=realm({commodity:true,households:5,grain:10,fish:0});
  r.eval(`
    ownershipTick();storageInit(s);mkt(s,'grain').clear();
    for(const h of H)addHeld(s,h,'grain',1);
    for(let i=0;i<1000;i++)stockOf(s,'empty:'+i);
    offer(s,'grain',H[3],1);offer(s,'grain',H[1],1);offer(s,'grain',H[4],1);
    const K=s.storage,owners=K.owners,quantity=K.quantity;
    globalThis.activeOwnerQueries=0;globalThis.emptyOwnerQueries=0;
    K.owners=function*(...args){activeOwnerQueries++;yield*owners.apply(this,args);};
    K.quantity=function(o,...args){if(typeof o==='string'&&o.startsWith('empty:'))emptyOwnerQueries++;return quantity.call(this,o,...args);};
    STORAGE_ACTIVE_CLAIMS.get(s).ready=false;
    globalThis.sellers=[...mkt(s,'grain').ownedEntries()].map(([o])=>H.findIndex(h=>accountOwner(h)===o));
  `);
  assert.deepEqual([...r.eval('sellers')],[1,3,4]);
  assert.equal(r.eval('activeOwnerQueries'),1);
  assert.equal(r.eval('emptyOwnerQueries'),0);
});

test('livestock seller enumeration keeps legacy owners and clear behavior',()=>{
  const r=realm({commodity:true,households:2,grain:10,fish:0});
  r.eval(`
    ownershipTick();storageInit(s);mkt(s,'sheep').clear();
    offer(s,'sheep',H[0],5);
    const K=s.storage;globalThis.ownerQueries=0;const owners=K.owners;
    K.owners=function*(...args){ownerQueries++;yield*owners.apply(this,args);};
    globalThis.sellers=[...mkt(s,'sheep').ownedEntries()].map(([o])=>o===accountOwner(H[0]));
    globalThis.filled=clearMarket(s,'sheep',[[H[1],2]],1);
  `);
  assert.deepEqual([...r.eval('sellers')],[true]);
  assert.equal(r.eval('ownerQueries'),0);
  assert.deepEqual([...r.eval('filled')],[2]);
  near(r.eval("mkt(s,'sheep').get(H[0])"),3);
});
