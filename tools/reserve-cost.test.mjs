// A seller's reserve is what his stock on sale cost him laid down, one lot with another; what he grew, made or was paid in
// cost him nothing. It used to take the dearest load he ever laid down and keep it till he sold out, so one load bought in a
// famine year held all his stock (the crown's rent grain at the capital too) off the market for years.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fixture=commodity=>{const r=realm({commodity,grain:100,fish:0,cash:1000});if(commodity)r.eval('ownershipTick();storageInit(s)');r.eval("mkt(s,'grain').clear()");return r;};

for(const commodity of [false,true]){
  const how=commodity?'commodity ledger':'place stores';
  test(`loads laid down at different costs give their average (${how})`,()=>{
    const r=fixture(commodity);r.eval("offer(s,'grain','dealer',10,2);offer(s,'grain','dealer',30,6)");
    near(r.eval("rsv(s,'grain').get('dealer')"),5);
  });
  test(`a dear load does not keep the rest of a seller's stock off the market (${how})`,()=>{
    const r=fixture(commodity);r.eval("offer(s,'grain','crown',90);offer(s,'grain','crown',10,8.4);s.px.grain=3");
    near(r.eval("rsv(s,'grain').get('crown')"),0.84);
    const got=r.eval("clearMarket(s,'grain',[[H[0],20]],3)[0]");
    assert.ok(got>19.99,`the crown sells its grain at 3 though one load cost 8.4: got ${got}`);
  });
  test(`an heir's reserve is the cost of his stock and what he inherits together (${how})`,()=>{
    const r=fixture(commodity);r.eval("offer(s,'grain','dead',10,6);offer(s,'grain','heir',30);transferOwnership('dead',[['heir',1]])");
    near(r.eval("rsv(s,'grain').get('heir')"),1.5);
  });
}

test('no reserve is raised to the dearest of two costs any more',()=>{
  assert.ok(!/reserve\[g\]\s*=\s*Math\.max|R\.set\([^;]*Math\.max\(R\.get/.test(source));
  const ladeIn=source.slice(source.indexOf('function ladeIn('),source.indexOf('\nfunction ',source.indexOf('function ladeIn(')+1));
  assert.ok(ladeIn.includes("const who=c.m||'out';reserveAt(d,c.good,who,"),'an arrived load sets the reserve of whoever holds it, not of the lord who paid a dead dealer\'s tolls');
});

// The crafts buy their stuff for the work the market will take (#51), not a month's full work whenever the margin is good.
const smithy=(onSale=0)=>{const r=realm({grain:0,fish:0,crown:100000,cash:0,households:0});
  r.eval(`s._smiths=4;Object.assign(s.px,{tools:300,ore:10,timber:3});s._dAvg={tools:2};s.stores.ore=1000;s.stores.timber=1000;s.stores.tools=${onSale};
    offer(s,'ore','miner',1000);offer(s,'timber','woodcutter',1000);${onSale?`offer(s,'tools','smith',${onSale});`:''}provision(s,[],new Map())`);return r;};
test('a lord with smithies and no smith buys ore for the tools the town wants',()=>{
  near(smithy().eval("pantry(s,'crown').ore||0"),2/0.8*0.6); // a month's full work would be 4 smithies × 0.45 × 30 × 0.6 = 32.4
});
test('no ore is bought while the tools the town wants already lie unsold',()=>{
  assert.equal(smithy(5).eval("pantry(s,'crown').ore||0"),0);
});
