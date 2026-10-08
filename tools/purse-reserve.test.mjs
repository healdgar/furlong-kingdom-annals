// A ward, and the beasts a reeve buys from the families, are paid out of what lies beyond the buyer's own reserve (#52): a quarter's revenue, and for the crown a war chest
// besides, as their monthly spending keeps. It was bought whenever the purse held 1.3 times its price, and once took the crown's
// whole chest in a month.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b.*$','m'))[0];
const realm=W=>{const c=vm.createContext({W,Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});vm.runInContext([fn('purse'),fn('hostTarget'),fn('chestReserve')].join('\n'),c);return c;};

test('a house keeps back a quarter of its revenue, the crown its war chest as well',()=>{
  const c=realm({treasury:2000,_crIncA:400,houses:[{might:1},{gold:900,_incA:200,might:1}],settlements:[{owner:0,pop:5000},{owner:1,pop:800}]});
  assert.equal(c.chestReserve(1),600);
  assert.equal(c.chestReserve(0),Math.max(1200,5000*0.03*25));
});
test('the ward test asks what is left after the price, not 1.3 times it',()=>{
  const metro=source.slice(source.indexOf('function tickMetro('),source.indexOf('\nfunction ',source.indexOf('function tickMetro(')+1));
  assert.ok(metro.includes('purse(buyer)-price>=chestReserve(buyer)'));
  assert.ok(!metro.includes('price*1.3'));
});
test('the reeve buys the families\' beasts out of what lies beyond his chest\'s reserve',()=>{
  const live=source.slice(source.indexOf('function tickHouseholds('),source.indexOf('\nfunction ',source.indexOf('function tickHouseholds(')+1));
  assert.ok(live.includes('Math.max(0,purse(reeve)-chestReserve(reeve))'));
});
