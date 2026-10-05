import test from 'node:test';
import assert from 'node:assert/strict';
import {realm,near} from './ownership-fixture.mjs';

test('market clearing moves every residual row from mixed-scale facilities back to unassigned stock',()=>{
  const r=realm({commodity:true,grain:0,fish:0,households:3,cash:1e12});
  r.eval('ownershipTick();storageInit(s)');
  const coinsBefore=r.coins();
  r.eval(`
    const K=s.storage,largeSeller=accountOwner(H[0]),tinySeller=accountOwner(H[1]);
    K.location('market-large',{capacity:Infinity});
    K.location('market-tiny',{capacity:Infinity});
    K.adjust('market-large','grain',largeSeller,'sale',1e16,'test-stock');
    K.adjust('market-tiny','grain',tinySeller,'sale',1e-33,'test-stock');
    mkt(s,'grain').clear();
    mkt(s,'grain').set(H[0],1e16);
    mkt(s,'grain').set(H[1],1e-33);
    globalThis.townStockBefore=K.total('grain');
    globalThis.got=commodityClearMarket(s,'grain',[[H[2],.1],[H[2],.2]],1);
    globalThis.clearedRows=[...K.entries({owner:null,good:'grain',availability:'market-cleared'})];
    globalThis.roundoffRows=[...K.entries({owner:null,good:'grain',availability:'unassigned'})];
    globalThis.townStockAfter=K.total('grain');
  `);

  assert.deepEqual(Array.from(r.eval('got')),[0.1,0.2]);
  assert.equal(Array.from(r.eval('clearedRows')).length,0,'no positive market-cleared cell survives');
  assert.ok(r.eval('roundoffRows.reduce((n,row)=>n+row.qty,0)')>0,
    'the swallowed sub-ULP remainder is retained as unassigned stock');
  assert.equal(r.eval('townStockAfter'),r.eval('townStockBefore'),'clearing and cleanup preserve physical total');
  near(r.eval('pantry(s,H[2]).grain'),0.30000000000000004);
  near(r.coins(),coinsBefore);
});
