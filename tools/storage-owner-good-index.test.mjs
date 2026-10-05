import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const shipped=execFileSync('git',['show','3067ee5:index.html'],{encoding:'utf8',maxBuffer:20e6});
const section=s=>s.slice(s.indexOf('function oldHouseholdHead('),s.indexOf('function houseFolk(s)'));
const currentSection=section(source),shippedSection=section(shipped);
function pair(options={}){return [realm({...options,transformSource:p=>p.replace(currentSection,shippedSection)}),realm(options)];}
function snapshot(r){return JSON.parse(r.eval(`JSON.stringify({lots:[...s.storage.lots.values()].map(l=>s.storage.lotState(l)),events:s.storage.events,byOwner:[...s.storage.byOwner].map(([o,ids])=>[storageOwnerId(o),[...ids]])})`));}
function sameRun(P,script){for(const r of P)r.eval(script);assert.deepEqual(snapshot(P[1]),snapshot(P[0]));}

test('owner and good queries retain canonical custody order after same-owner reinsertion',()=>{
 const P=pair({grain:0,fish:0,households:3});
 sameRun(P,"storageInit(s);const K=s.storage;const a=accountOwner(H[0]),b=accountOwner(H[1]);const x=K.create('grain',1,a,'yard','held'),y=K.create('fish',1,a,'yard','held'),z=K.create('grain',1,b,'yard','held'),w=K.create('grain',1,a,'yard','held');K.transfer(x,a,1,'sale');K.transfer(x,a,1,'held');globalThis.expected=K.orderedLots([...K.byOwner.get(a)].filter(id=>K.lots.get(id).good==='grain')).map(l=>l.id);globalThis.actual=K.matching({owner:a,good:'grain'}).map(l=>l.id);");
 assert.deepEqual(P[1].eval('actual'),P[1].eval('expected'));
});

test('split, removal, transfers, cargo and inheritance keep the composite membership exact',()=>{
 const P=pair({grain:30,fish:0,households:3,cash:100});
 sameRun(P,"storageInit(s);const K=s.storage;K.location('store',{capacity:100});const a=accountOwner(H[0]),l=K.create('grain',12,a,'yard','held');const part=K.split(l,3);K.transfer(part,a,3,'sale');K.move(l,'store',2);K.remove(part,1,'test');addHeld(s,H[0],'grain',8);storageTitles(s,'grain');transferOwnership(a,[['heir-a',.4],['heir-b',.6]]);K.create('grain',2,a,'yard','held');addHeld(s,H[0],'grain',2);const c={good:'grain',qty:2,m:H[0],dest:1};storageCargoOut(c,s);");
 P[1].eval("const ledger=s.storage;for(const [owner,goods] of STORAGE_OWNER_GOODS.get(ledger).groups)for(const [good,ids] of goods)for(const id of ids){const x=ledger.lots.get(id);if(!x||x.owner!==owner||x.good!==good)throw Error('stale owner-good member')}for(const [owner,ids] of ledger.byOwner)for(const good of new Set([...ids].map(id=>ledger.lots.get(id)?.good))){const expected=[...ids].filter(id=>ledger.lots.get(id)?.good===good);if(JSON.stringify([...storageOwnerGoodIds(ledger,owner,good)])!==JSON.stringify(expected))throw Error('owner-good order mismatch')}if(Object.keys(ledger).some(k=>/owner.?good/i.test(k)))throw Error('derived owner-good state leaked into ledger')");
});

test('timber and charcoal share physical timber membership through title completion',()=>{
 const P=pair({grain:0,fish:0,households:2});
 sameRun(P,"s.stores.timber=8;storageInit(s);const K=s.storage;offer(s,'timber','crown',8);purchase(s,'timber',H[0],5);addHeld(s,H[0],'timber',purchase.got);purchase(s,'timber',H[1],3);addHeld(s,H[1],'char',purchase.got);storageTitles(s,'timber');");
 const r=P[1];r.eval("const ledger=s.storage,a=accountOwner(H[0]),b=accountOwner(H[1]),aIds=storageOwnerGoodIds(ledger,a,'timber'),bIds=storageOwnerGoodIds(ledger,b,'timber');if([...aIds].some(id=>ledger.lots.get(id).owner!==a||ledger.lots.get(id).good!=='timber'))throw Error('bad timber group');if([...bIds].some(id=>ledger.lots.get(id).owner!==b||ledger.lots.get(id).claimGood!=='char'))throw Error('bad charcoal custody group');if(storageOwnerGoodIds(ledger,a,'char').size||storageOwnerGoodIds(ledger,b,'char').size)throw Error('charcoal indexed as physical good');if([...ledger.lots.values()].some(l=>l.pendingPurchase))throw Error('purchase not completed')");
});

test('replaced or instrumented backing maps decline the index and explicit adoption rebuilds it',()=>{
 const P=pair({grain:0,fish:0});
 const r=P[1];r.eval("storageInit(s);const K=s.storage,a=accountOwner(H[0]);K.create('grain',2,a,'yard','held');const original=K.byOwner;K.byOwner=new Map(original);");
 assert.equal(r.eval('storageOwnerGoodsIndex(K)'),null);
 r.eval('storageOwnerGoodsAdopt(K)');
 assert.equal(r.eval('storageOwnerGoodIds(K,accountOwner(H[0]),"grain").size'),1);
 r.eval("K.byOwner.get=function(k){return Map.prototype.get.call(this,k)}");
 assert.equal(r.eval('storageOwnerGoodsIndex(K)'),null);
});
