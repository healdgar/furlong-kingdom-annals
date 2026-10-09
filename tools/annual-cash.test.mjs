import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>src.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(){
  const town={name:'Town',pos:{x:0,z:0},buildings:[],murage:20},other={name:'Other',pos:{x:2,z:0},buildings:[],murage:0},lord={name:'House A',gold:100},person={household:true,assets:{w:50}},W={startAD:850,clock:{day:0},treasury:200,houses:[{},lord],settlements:[town,other]};
  const C=vm.createContext({W,town,other,lord,person,day:()=>W.clock.day,year:()=>Math.floor(W.clock.day/360)+1,householdAccount:p=>p,esc:s=>String(s).replaceAll('<','&lt;'),dateStr:d=>'Day '+d,isHouse:x=>W.houses.includes(x),means:x=>x==='crown'?W.treasury:x?.household?x.assets.w:x?.pos?x.murage:x?.gold||0});
  vm.runInContext(['cashRecord','acct','flow','transfer','book','cashStatementHTML','townCashHTML','detailTable','detailNumber','ledgerHTML'].map(fn).join('\n'),C);
  return {C,W,town,other,lord,person,run:x=>vm.runInContext(x,C)};
}
test('gross receipts and payments under the same cause are retained, without moving an extra coin',()=>{
  const r=fixture();r.run("transfer(person,lord,12,'rents',town);transfer(lord,person,7,'rents',town)");
  assert.equal(r.lord.gold,105);assert.equal(r.person.assets.w,45);assert.equal(r.lord.ledY.rents,5);
  assert.equal(r.lord.cashY.receipts.rents,12);assert.equal(r.lord.cashY.payments.rents,7);assert.equal(r.lord.cashY.opening,100);assert.equal(r.lord.cashY.closing,105);
  assert.equal(r.lord.cashY.towns.get(r.town).receipts.rents,12);assert.equal(r.person.cashY,undefined);
});
test('annual periods follow the calendar, retain only this and last year, and preserve fractions',()=>{
  const r=fixture();r.W.clock.day=359;r.run("transfer('crown',lord,.125,'grant',town)");const first=r.lord.cashY;
  r.W.clock.day=360;r.run("transfer(lord,'crown',.0625,'grant',town)");assert.equal(r.lord.cashPrev,first);assert.equal(r.lord.cashY.y,2);assert.equal(r.lord.cashY.start,360);assert.equal(r.lord.cashY.opening,100.125);
  r.W.clock.day=720;r.run("transfer(lord,'crown',.03125,'grant',other)");assert.equal(r.lord.cashPrev.y,2);assert.equal(r.lord.cashY.y,3);assert.equal(r.lord.cashY.payments.grant,.03125);assert.equal(r.lord.cashY.towns.size,1);
});
test('town public funds, local lord costs, and other towns remain distinct',()=>{
  const r=fixture();r.run("transfer(person,town,8,'murage',town);transfer(town,person,3,'wall works',town);transfer(lord,person,4,'garrisons',other)");
  assert.equal(r.town.cashY.receipts.murage,8);assert.equal(r.town.cashY.payments['wall works'],3);assert.equal(r.town.cashY.towns.size,0);assert.equal(r.lord.cashY.towns.has(r.town),false);
  const html=r.run("townCashHTML(town,'town')");assert.ok(html.includes('Town chest'));assert.ok(!html.includes('garrisons'));assert.ok(html.includes('separate'));
});
test('the statement includes every cause, gross totals, net, opening and closing coin, and a partial-year label',()=>{
  const r=fixture();r.W.clock.day=80;r.run("transfer(person,lord,8,'<rents>',town);transfer(lord,person,3,'<rents>',town)");const before=JSON.stringify(r.lord.cashY);
  const html=r.run("cashStatementHTML(lord,'Domain treasury','domain',true,null,lord.gold)");
  for(const label of ['Income','Expenses','Surplus / deficit','Opening coin','Closing coin','&lt;rents>','year to date','partial year'])assert.ok(html.includes(label),label);
  assert.ok(!html.includes('Unclassified balance change'));assert.equal(JSON.stringify(r.lord.cashY),before);
});
test('unrecorded balance changes are exposed rather than fabricated as earned income',()=>{
  const r=fixture();r.run("transfer(person,lord,1,'rents',town)");r.lord.gold+=11;
  assert.ok(r.run("cashStatementHTML(lord,'Domain','domain',true,null,lord.gold)").includes('Unclassified balance change'));assert.equal(r.lord.cashY.receipts.rents,1);
});
test('reports have no simulation writes and repeated payments keep bounded totals, not transaction rows',()=>{
  const r=fixture();for(let k=0;k<1000;k++)r.run("transfer('out',lord,.01,'rents',town)");assert.equal(Object.keys(r.lord.cashY.receipts).length,1);assert.equal(r.lord.cashY.towns.size,1);
  const B=r.lord.cashY;Object.freeze(B.receipts);Object.freeze(B.payments);Object.freeze(B);Object.freeze(r.lord);Object.freeze(r.W);
  assert.doesNotThrow(()=>r.run("cashStatementHTML(lord,'Domain','domain',true,town,lord.gold)"));
  assert.doesNotThrow(()=>r.run("ledgerHTML(lord,true,'Domain treasury')"));
});
test('self-funded goods do not create cash revenue, and overspending records only the actual payment',()=>{
  const r=fixture();r.run("transfer(lord,person,1000,'works',town)");assert.equal(r.lord.cashY.payments.works,100);assert.equal(r.lord.gold,0);
  r.run("acct(lord,0,'own grain',town)");assert.equal(r.lord.cashY.receipts['own grain'],undefined);
});
test('the new statements survive save-shaped map data and render both years without mutating either',()=>{
  const r=fixture();r.run("transfer('out',lord,2,'sales',town)");r.W.clock.day=360;r.run("transfer(lord,'out',1,'hosts',town)");
  const html=r.run("cashStatementHTML(lord,'Domain','domain',true,null,lord.gold)");assert.ok(html.includes('AD 850')&&html.includes('AD 851')&&html.includes('last year'));
  const keys=Object.keys(r.lord.cashY);r.run("townCashHTML(town,'local')");assert.deepEqual(Object.keys(r.lord.cashY),keys);
});
test('self-transfers and refunded relief holds are not gross income or expense',()=>{
  const r=fixture();r.run("transfer(lord,lord,10,'own funds',town);acct('crown',-250,false,town);acct('crown',250,false,town)");
  assert.equal(r.lord.gold,100);assert.equal(r.W.treasury,200);assert.equal(r.lord.cashY,undefined);assert.equal(r.W.crownBook,undefined);
  r.run("transfer('crown',person,8,'grain',town)");assert.equal(r.W.crownBook.cashY.payments.grain,8);assert.equal(r.W.crownBook.cashY.opening,200);
  assert.ok(src.includes("cmd==='relief'?false:cmd"));assert.ok(src.includes('acct(houseAcct(me),250,false,s)'));
});
test('a known quiet year displays zero flows without opening a book; headings escape names',()=>{
  const r=fixture();r.run("transfer(person,lord,2,'rents',town)");r.W.clock.day=360;const B=r.lord.cashY;
  const html=r.run("cashStatementHTML(lord,'<Domain>','quiet',true,null,lord.gold)");
  assert.ok(html.includes('&lt;Domain> · AD 851'));assert.ok(!html.includes('<Domain>'));assert.ok(html.includes('year to date'));assert.ok(!html.includes('Unclassified balance change'));assert.equal(r.lord.cashY,B);assert.equal(r.lord.cashPrev,undefined);
});
