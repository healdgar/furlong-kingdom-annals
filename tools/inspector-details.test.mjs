import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const ctx=extra=>vm.createContext({esc:s=>String(s).replaceAll('<','&lt;'),famName:p=>p.family,detailHead:p=>p.head,detailPerson:p=>p?.id??'—',...extra});

test('full family census includes every family, counts living people, and leaves source untouched',()=>{
  const folk=Array.from({length:18},(_,i)=>Object.freeze({id:i,family:'Family '+i}));
  folk.push(Object.freeze({id:100,family:'Family 0'}),Object.freeze({id:101,family:'Dead family',dead:true}));
  const C=ctx({s:Object.freeze({folk:Object.freeze(folk)})});vm.runInContext(fn('detailFamilies'),C);
  const rows=vm.runInContext('detailFamilies(s)',C);assert.equal(rows.length,18);assert.equal(rows[0][1],2);assert.equal(rows.reduce((n,r)=>n+r[1],0),19);
});
test('a shared building lists all households and every resident, excluding dead and other homes',()=>{
  const b={s:{folk:[]}},other={};const heads=Array.from({length:7},(_,id)=>({id,bh:b}));
  for(const head of heads)for(let i=0;i<8;i++)b.s.folk.push(Object.freeze({id:head.id*10+i,head}));
  b.s.folk.push({id:100,head:heads[0],dead:true},{id:101,head:{bh:other}});
  const C=ctx({b});vm.runInContext(fn('detailResidents'),C);const rows=vm.runInContext('detailResidents(b)',C);
  assert.equal(rows.length,7);assert.equal(rows.reduce((n,r)=>n+r.members.length,0),56);assert.equal(rows.at(-1).members.length,8);
});
test('the stock register preserves fractional quantities and reads quotes without creating prices or stock',()=>{
  const s=Object.freeze({stores:Object.freeze({grain:0.25,ore:8,unknown:2}),px:Object.freeze({grain:3.15,wine:9.25})});
  const C=ctx({s,GOODBASE:{grain:2,ore:5},price0:(s,g)=>{assert.equal(g,'ore');return 4.75;}});
  vm.runInContext(fn('detailNumber')+'\n'+fn('detailGoods'),C);const rows=vm.runInContext('detailGoods(s)',C);
  assert.equal(rows.length,4);assert.deepEqual(Array.from(rows.find(r=>r[0]==='Grain')),['Grain','0.25','3.15']);
  assert.deepEqual(Array.from(rows.find(r=>r[0]==='Wine')),['Wine','0','9.25']);assert.equal(rows.find(r=>r[0]==='Unknown')[2],'—');
  assert.deepEqual(Object.keys(s.stores),['grain','ore','unknown']);
});
test('household details use the enduring owner, include property in other places, and do not create holdings',()=>{
  const a={head:{id:4},members:new Set()},p={id:4,_hh:a};a.members.add(p);
  const stock=Object.freeze({held:{grain:0.25},sale:{cloth:0.5},animals:{sheep:2},reserve:{grain:1.75}});
  const s={name:'Home',furl:[],buildings:[],_owners:new Map([[a,stock]])},remote={name:'Away',furl:[{kind:1,state:1,area:12000,title:{own:{owner:a,beneficiary:{id:99}},work:{owner:a}}}],buildings:[{state:'sound',title:{owner:a},name:'Inherited house'}]};
  const tables=[];const C=ctx({s,p,W:{settlements:[s,remote]},LS:{WILD:0,WOOD:1,TILLED:2,PASTURE:3,SCRUB:4,BURNT:5},KIND_NAME:['','open field'],ageYrs:()=>20,detailNaming:()=>b=>b.name,detailBuilding:b=>b.name,detailTable:(id,title,heads,rows)=>{tables.push({id,rows});return '';}});
  vm.runInContext(fn('landName')+'\n'+fn('detailNumber')+'\n'+fn('detailHousehold'),C);vm.runInContext('detailHousehold(s,p)',C);
  assert.equal(tables.find(t=>t.id==='detail-pantry').rows.length,3);const rights=tables.find(t=>t.id==='detail-property').rows;
  assert.equal(rights.length,2);assert.equal(rights[0][2],'Owned and worked');assert.equal(rights[1][2],'Owned');assert.equal(rights[0][0],'Away');
  assert.match(rights[0][1],/^<a class="nm" data-nm="land:1:0">woodland<\/a> · /);
  assert.equal(s._owners.size,1);assert.equal(remote._owners,undefined);
});
test('expanded court detail retains every memo, full explanations, both ledgers and fractional entries',()=>{
  const why='A long explanation '.repeat(15)+'FINAL WORDS';const house={loyalty:50,memo:Array.from({length:6},(_,d)=>({d,v:1,why})),ledY:{tax:0.25},ledPrev:{rent:9}};
  const C=ctx({W:{houses:[house]},loyaltyFactors:()=>[['minor factor',0.001]],dateStr:d=>'Day '+d});
  vm.runInContext(fn('detailNumber')+'\n'+fn('houseDetailHTML')+'\n'+fn('ledgerHTML'),C);const h=vm.runInContext('houseDetailHTML(0,true)',C);
  assert.equal(h.match(/FINAL WORDS/g).length,6);assert.ok(h.includes('this year so far')&&h.includes('last year'));assert.ok(h.includes('0.25')&&h.includes('minor factor'));
});
test('day-zero household listing groups unbound people without creating accounts',()=>{
  const head={id:1,w:25},child={id:2},second={id:3,w:5};head.head=head;child.head=head;second.head=second;
  for(const p of [head,child,second])Object.freeze(p);const s=Object.freeze({folk:Object.freeze([head,child,second])});
  const C=ctx({s});vm.runInContext(fn('detailHouseholds'),C);const H=vm.runInContext('detailHouseholds(s)',C);
  assert.equal(H.length,2);assert.equal(H[0].members.length,2);assert.equal(H[0].head,head);assert.equal(head._hh,undefined);assert.equal(child._hh,undefined);
});
test('family detail traverses all recorded generations and succession candidates while stopping cycles',()=>{
  const root={id:0,parents:[],children:[]};let up=root,down=root;
  for(let i=1;i<=7;i++){const u={id:'up'+i,parents:[],children:[]},d={id:'down'+i,parents:[],children:[]};up.parents=[u];down.children=[d];up=u;down=d;}up.parents=[root];
  const C=ctx({root,isN:()=>false,tParents:p=>p.parents,tChildren:p=>p.children,tSpouse:()=>null,tLink:p=>String(p.id),tTitles:()=>[],lineOf:()=>({line:Array.from({length:12},(_,id)=>({id:'heir'+id})),seat:'Seat',hold:root,claims:[]})});
  vm.runInContext(fn('treeHTML'),C);const h=vm.runInContext('treeHTML(root)',C);assert.ok(h.includes('up7')&&h.includes('down7')&&h.includes('heir11'));assert.ok(h.length<10000);
});
