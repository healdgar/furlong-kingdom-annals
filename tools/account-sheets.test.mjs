import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
function fixture(){
  const family=freeze({assets:{w:20.25,_debt:3.5}}),away=freeze({assets:{w:7,_debt:1}}),parish=freeze({fund:5});
  const legacy=freeze({w:2,_debt:0.25}),resident=freeze({_hh:family}),dead=freeze({dead:true,w:4});
  const rows=freeze([{location:'yard',good:'grain',availability:'sale',qty:2.25},{location:'yard',good:'grain',availability:'held',qty:6},{location:'cart',good:'grain',availability:'sale',qty:3},{location:'yard',good:'ore',availability:'transit',qty:1.5}]);
  const storage=freeze({version:3,locations:new Map([['yard',{}],['cart',{transit:true}]]),*entries(fields){assert.equal(fields.includeTransit,true);yield*rows;}});
  const a=freeze({name:'A',folk:[resident,legacy,dead],murage:6,_poolCash:3,_poolBy:{smith:4},buildings:[{ch:parish},{ch:parish}],stores:{grain:10,sheep:2},storage});
  const b=freeze({name:'B',folk:[resident],murage:1,buildings:[{ch:parish}],stores:{grain:5}});
  const W=freeze({treasury:100,houses:[{gold:999},{gold:30}],households:new Map([['family',family],['away',away]]),settlements:[a,b],dragon:{hoard:9},armies:[{men:[legacy,resident,{merc:true,w:1000}]}],travellers:[{p:legacy}],levies:[{p:legacy}],projects:[{type:'persuade',lever:'gold',pay:8},{type:'persuade',lever:'honour',pay:99}]});
  return {W,a,b};
}
function context(f=fixture(),extra={}){const C=vm.createContext({BEASTS:['sheep','cattle','horses','swine'],year:()=>1,...f,...extra});vm.runInContext('"use strict";\n'+['accountBalances','cashStatementHTML','townCashHTML'].map(fn).join('\n'),C);return C;}

test('kingdom census counts shared purses and church funds once, including absent families and project escrow',()=>{
  const f=fixture(),C=context(f),before=JSON.stringify(f.W),B=vm.runInContext('accountBalances()',C);
  assert.deepEqual(JSON.parse(JSON.stringify(B.by)),{crown:100,houses:30,households:33.25,church:5,townFunds:7,craftFunds:7,hoard:9,escrow:8});
  assert.equal(B.total,199.25);assert.equal(B.debt,4.75);assert.equal(JSON.stringify(f.W),before);
});
test('town accounts exclude other institutions and dead residents without multiplying shared purses',()=>{
  const C=context(),B=vm.runInContext('accountBalances(a)',C);
  assert.equal(B.by.households,22.25);assert.equal(B.by.crown,0);assert.equal(B.by.houses,0);assert.equal(B.by.hoard,0);assert.equal(B.by.escrow,0);assert.equal(B.total,40.25);assert.equal(B.debt,3.75);
});
test('physical stores, sale subsets and transit quantities remain separate with fractional precision',()=>{
  const C=context(),B=vm.runInContext('accountBalances()',C);
  assert.deepEqual({...B.goods.get('grain')},{stored:15,sale:2.25,transit:3});
  assert.deepEqual({...B.goods.get('ore')},{stored:0,sale:0,transit:1.5});
  assert.deepEqual({...B.goods.get('sheep')},{stored:2,sale:0,transit:0});
});
test('legacy storage is read without creating household or commodity accounts',()=>{
  const person=freeze({w:1.25}),s=freeze({folk:[person],stores:{cloth:4},storage:{version:2,locations:new Map([['yard',{}]]),lots:new Map([['lot',{location:'yard',good:'cloth',availability:'sale',qty:0.5}]])}});
  const C=context({W:freeze({houses:[],settlements:[s]}),s}),B=vm.runInContext('accountBalances(s)',C);
  assert.equal(B.total,1.25);assert.equal(B.goods.get('cloth').sale,0.5);assert.equal(person._hh,undefined);
});
test('livestock offers are included without counting owned herds as sale stock',()=>{
  const s=freeze({stores:{sheep:8},_owners:new Map([['a',freeze({sale:{sheep:1.5},animals:{sheep:6.5}})]]),folk:[]});
  const B=vm.runInContext('accountBalances(s)',context({W:{houses:[],settlements:[s]},s}));
  assert.deepEqual({...B.goods.get('sheep')},{stored:8,sale:1.5,transit:0});
});
test('rendered sheets escape labels, distinguish gold from quantities and use distinct inspector IDs',()=>{
  const C=context(fixture(),{esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),dateStr:()=>'<date>'});
  vm.runInContext(fn('detailNumber')+'\n'+fn('detailTable')+'\n'+fn('accountSheetHTML'),C);
  const h=vm.runInContext('accountSheetHTML(a,"detail")',C);
  assert.ok(h.includes('id="detail-accounts"')&&h.includes('id="detail-goods"'));assert.ok(h.includes('&lt;date>'));assert.ok(h.includes('not gold values'));assert.ok(h.includes('Resident household purses'));assert.ok(!h.includes('Royal treasury</th>'));
});
test('timeline uses recorded history, dates and monarch; recent text is escaped',()=>{
  const infoUI={kind:'timeline'},tables=[];
  const C=context(fixture(),{infoUI,START_AD:850,AD:()=>862,dateStr:d=>d===undefined?'Today':'Day '+d,entryCount:55,allLines:Array.from({length:15},(_,i)=>'<event '+i+'>'),fullTitle:()=>'<Queen>',esc:s=>String(s).replaceAll('<','&lt;'),detailTable:(id,title,heads,rows)=>{tables.push(rows);return '';}});
  C.W={...C.W,startAD:800,reignStart:123,monarch:{}};
  vm.runInContext(fn('detailNumber')+'\n'+fn('infoHTML'),C);const h=vm.runInContext('infoHTML()',C),rows=tables[0];
  assert.equal(rows.find(r=>r[0]==='History begins')[1],'AD 800');assert.equal(rows.find(r=>r[0]==='Years since the annals began')[1],'12');assert.equal(rows.find(r=>r[0]==='Current reign began')[1],'Day 123');
  assert.ok(h.includes('data-info-annals')&&h.includes('&lt;event 14>'));assert.ok(!h.includes('&lt;event 2>')&&!h.includes('<event'));
});
test('kingdom flow view distinguishes external flows from internal minting and diagnostics',()=>{
  const f=fixture(),tables=[],C=context({...f,W:{...f.W,_flow:{'<exports':1.25,'>imports':2.5,'<works*':99,'<>lost':4,'!nan':5}}},{infoUI:{kind:'accounts',town:null},esc:String,dateStr:()=>'',detailNumber:String,accountSheetHTML:()=>'',houseDetailHTML:()=>'',detailTable:(id,title,heads,rows)=>{tables.push({id,rows});return '';}});
  vm.runInContext(fn('infoHTML'),C);const h=vm.runInContext('infoHTML()',C),rows=tables.find(t=>t.id==='realm-flows').rows;
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),[['exports','Inflow','1.25'],['imports','Outflow','2.5']]);assert.ok(h.includes('rather than just the royal treasury'));assert.ok(h.includes('data-account-town="1"'));
});
