// The hallmote reads the live debts of #36. Its receipts pay real officers; no household's bread is seized.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const fn=n=>{const m=source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));assert.ok(m,n);return m[0];};
const cst=n=>source.match(new RegExp('^const '+n+'=.*$','m'))[0];
function court(){const r=realm({households:5,cash:0,grain:0,fish:0});
  r.eval(['courtDebtor','courtOfficials','courtSession','tickJustice','courtCard','book','lordSeat','sovOn','plyH','workerCommandTarget','workerCommandIndexText','workerCommandString','runCmd','replayEntry','manorLines'].map(fn).join('\n')+'\n'+cst('dueOn'));
  Object.assign(r.C,{KL:0,KLaw:3,MODEL_ONLY:true,backgroundUserRequest:()=>false,workerCommandIsLocal:()=>false,esc:x=>String(x),dateStr:d=>'day '+d});
  r.eval('W.houses=[{name:"the Crown"},{name:"House Ash",seat:0,gold:0}];W.capital=s;s.owner=1;W.player={on:true,house:1};s.furl=[];tilledOf=s=>s.furl;for(const h of H)h.sk=[1,0,0,1];ownershipTick();for(const h of H)householdAccount(h).population.set(s,1);W._pm=folkIndex();');
  return r;}
const total=r=>r.coins()+(r.W.houses[1].gold||0);
const plead=(r,id,v,kind='entry')=>r.eval(`courtPlead(s,'${kind}',${id},${v},{},W.houses[1])`);

test('a profitable session recovers dues and pays two named officers, conserving all coin',()=>{
  const r=court();r.eval('H[2].w=100');plead(r,3,20);const before=total(r),bread=r.eval('foodYr()/12');r.eval('courtSession(s,0)');
  near(total(r),before);near(r.s.court.recovered,20);near(r.s.court.fines,1);assert.ok(r.s.court.fees>0);near(r.W.houses[1].gold,21-r.s.court.fees);near(r.H[2].w,79);
  assert.ok(r.H[2].w>=bread);assert.equal(r.s.pleas.rows.length,0);assert.equal(r.H[0].office,'steward');assert.equal(r.H[1].office,'clerk');assert.equal(r.H[0].officeFor,1);
  assert.equal(r.s.court.sessions,1);r.eval('courtSession(s,0)');assert.equal(r.s.court.sessions,1,'paid pleas cannot be heard or charged again');
});

test('a quiet or unprofitable court adjourns without appointing, charging, or paying anyone',()=>{
  const r=court();r.eval('H[2].w=100');plead(r,3,0.0001);const before=total(r);r.eval('courtSession(s,0)');
  near(total(r),before);near(r.H[2].w,100);near(r.W.houses[1].gold,0);assert.equal(r.s.court.sessions,0);assert.equal(r.s.court.adjourned,1);assert.equal(r.H[0].office,undefined);
  r.eval('for(const h of H)h.sk=[0,0,0,0];s.pleas.rows[0].v=20;courtSession(s,0)');assert.equal(r.s.court.sessions,0,'no lettered officers: business waits');
});

test('several claims on one purse cannot promise the same coin to fund a sitting',()=>{
  const r=court(),cost=r.eval('courtOfficials(0).cost'),bread=r.eval('foodYr()/12');r.eval(`H[2].w=${bread+cost*0.6}`);plead(r,3,1);plead(r,3,1);
  r.eval('courtSession(s,0)');assert.equal(r.s.court.sessions,0);near(r.H[2].w,bread+cost*0.6);near(r.W.houses[1].gold,0);
});

test('amercements respect the ruler’s cap and the spare purse; coinless defendants are pardoned',()=>{
  const r=court(),bread=r.eval('foodYr()/12');r.eval(`H[2].w=100;H[3].w=${bread+20.1};H[4].w=0`);plead(r,3,20);plead(r,4,20);plead(r,5,20);
  r.eval("justiceCmd('0:cap:0.02');courtSession(s,0)");const rows=r.s.court.roll.rows;
  near(rows[1].fine,0.1*0.02);near(r.H[3].w,bread+0.098);near(rows[2].fine,0);assert.equal(rows[2].pardoned,true);near(rows[2].left,20);near(r.H[4].w,0);
  r.eval('H[4].w=100;courtSession(s,0)');near(r.s.court.recovered,60);near(r.H[4].w,80,'a continued unpaid plea is not amerced twice');
});

test('rent and farm cases read their live balances, including payment outside court and surrender',()=>{
  const r=court();r.eval("globalThis.f={k:0,ten:'villein',wk:3,own:3,lord:-1,svc:'money',qrent:20,_arr:20,_arrN:1};s.furl=[f];globalThis.F={who:4,arr:20,paid:0};courtPlead(s,'arrears',3,20,f,W.houses[1]);courtPlead(s,'farm',4,20,F,W.houses[1]);H[2].w=100;H[3].w=100");
  r.eval('f._arr=0;F.arr=0;courtSession(s,0)');near(r.H[2].w,100);near(r.H[3].w,100);assert.equal(r.s.pleas.rows.length,0);
  r.eval("f._arr=30;f.wk=-1;courtPlead(s,'arrears',3,30,f,W.houses[1]);courtSession(s,0)");assert.equal(r.s.pleas.rows.length,0,'surrender cancels the rent claim');near(r.H[2].w,100);
});

test('court collection clears the actual rent and a retired mill farm, not copies of them',()=>{
  const r=court();r.eval("globalThis.f={k:0,wk:3,_arr:20,_arrN:1};globalThis.F={who:4,arr:20,paid:3};courtPlead(s,'arrears',3,20,f,W.houses[1]);courtPlead(s,'farm',4,20,F,W.houses[1]);H[2].w=100;H[3].w=100;courtSession(s,0)");
  near(r.eval('f._arr'),0);near(r.eval('f._arrN'),0);near(r.eval('F.arr'),0);near(r.eval('F.paid'),23);near(r.s.court.recovered,40);
});

test('pending pleas and the recent rulings stay bounded; repeated defaults update one obligation',()=>{
  const r=court();r.eval("globalThis.f={wk:3,_arr:10};for(let i=0;i<100;i++)courtPlead(s,'arrears',3,i+1,f,W.houses[1])");assert.equal(r.s.pleas.rows.length,1);near(r.s.pleas.rows[0].v,100);
  r.eval("for(let i=0;i<100;i++)courtPlead(s,'entry',3,0.1,{},W.houses[1])");assert.equal(r.s.pleas.rows.length,64);assert.equal(r.s.pleas.over.entry,36);assert.equal(r.s.pleas.over.arrears,1);
  r.eval('H[2].w=100;courtSession(s,0)');assert.equal(r.s.court.roll.rows.length,12);assert.equal(r.s.court.roll.over.entry,52);
});

test('only quarter days read pending pleas; no daily household scan',()=>{
  const r=court();r.eval('H[2].w=100');plead(r,3,20);r.eval('day=()=>89;tickJustice()');assert.equal(r.s.court,undefined);
  r.eval('day=()=>90;tickJustice()');assert.equal(r.s.court.sessions,1);near(r.s.court.last,90);near(r.s.court.next,180);
  r.eval('headsOf=()=>{throw Error("unexpected scan")};day=()=>91;tickJustice()');
});

test('royal manors use the treasury as the named creditor and payer of their officials',()=>{
  const r=court();r.eval("s.owner=0;H[2].w=100;courtPlead(s,'entry',3,20,{},'crown')");const before=total(r);r.eval('courtSession(s,0)');near(total(r),before);near(r.W.treasury,21-r.s.court.fees);assert.equal(r.H[0].officeFor,0);
});

test('the cap order validates, respects ownership and replays with the same accounts and rulings',()=>{
  const play=r=>{r.eval('H[2].w=100');plead(r,3,20);const e={k:'c',c:'s-justice',a:'0:cap:0.01'};assert.equal(r.eval(`workerCommandTarget(${JSON.stringify(e)})`),'worker');r.eval(`replayEntry(${JSON.stringify(e)});courtSession(s,0)`);return JSON.parse(r.eval('JSON.stringify([s.court,H.map(h=>h.w),W.houses[1].gold])'));};
  const a=court(),b=court();assert.deepEqual(play(a),play(b));
  for(const arg of ['0:cap:-1','0:cap:2','0:cap:NaN','0:cap:','0:cap:0.1:bad','9:cap:0.1'])assert.throws(()=>a.eval(`workerCommandTarget({k:'c',c:'s-justice',a:${JSON.stringify(arg)}})`),/Invalid justice command/);
  a.eval("W.player.house=0;justiceCmd('0:cap:0.5')");near(a.W.houses[1].justice.cap,0.01);
});

test('the roll is a read-only linked card, and governance exposes the shared lord’s cap',()=>{
  const r=court();r.eval('H[2].w=100');plead(r,3,20);r.eval('courtSession(s,0)');const before=r.eval('JSON.stringify(s.court)'),html=r.eval('courtCard(s,0)+justiceOrdersHTML(s,0)');
  for(const code of ['s0','p1','p2','p3','court:0'])assert.ok(html.includes(`data-nm="${code}"`),code);
  assert.ok(html.includes('data-cmd="s-justice"'));assert.equal(r.eval('JSON.stringify(s.court)'),before);
  r.eval([fn('referenceTarget'),fn('workerInspectionCode'),fn('workerInspectionTarget'),fn('inspectorPickCode')].join('\n'));
  assert.equal(r.eval("workerInspectionTarget('court:0').type"),'court');assert.equal(r.eval("inspectorPickCode(workerInspectionTarget('court:0'))"),'court:0');assert.throws(()=>r.eval("workerInspectionTarget('court:99')"));
});

test('appointed officers are reused without another household search, and a dead officer is replaced',()=>{
  const r=court();r.eval('H[2].w=100');plead(r,3,20);r.eval('courtSession(s,0);globalThis.oldHeads=headsOf;headsOf=()=>{throw Error("unexpected household search")};H[2].w=100');plead(r,3,20);r.eval('courtSession(s,0)');assert.equal(r.s.court.sessions,2);
  r.eval('headsOf=oldHeads;H[0].dead=true;H[2].w=100');plead(r,3,20);r.eval('courtSession(s,0)');assert.notEqual(r.W.houses[1].justice.steward,1);assert.equal(r.s.court.sessions,3);
});

test('a nonresident mill tenant keeps bread for every living member, even away from the court town',()=>{
  const r=court();r.eval('globalThis.A=householdAccount(H[2]);A.members.add({id:90,gn:"child",si:1});A.members.add({id:91,gn:"dead child",si:1,dead:true});H[2].si=1;W.settlements.push({...s,folk:[H[2]],furl:[]});H[2].w=100');
  near(r.eval('courtSpare(s,H[2])'),100-r.eval('2*foodYr()/12'));
});

const loan=(r,{debtor=2,creditor=4,v=20,from=1}={})=>r.eval(`day=()=>361;globalThis.E=[H[${creditor}],${v},${from}];H[${debtor}]._owe=[E];H[${debtor}]._debt=${v};repay(H[${debtor}],0)`);

test('advances are dated and only the same day’s same lender coalesces; a loan ages for a full year',()=>{
  const r=court();r.eval('H[4].w=1000;day=()=>10;borrow(s,H[2],10);borrow(s,H[2],5);day=()=>11;borrow(s,H[2],2)');
  assert.deepEqual(JSON.parse(r.eval('JSON.stringify(H[2]._owe.map(e=>[e[1],e[2]]))')),[[15,10],[2,11]]);
  r.eval('day=()=>369;repay(H[2],0)');assert.equal(r.s.pleas,undefined);
  r.eval('day=()=>370;repay(H[2],0)');assert.equal(r.s.pleas.rows.length,1);assert.equal(r.s.pleas.rows[0].ref,r.H[2]._owe[0]);
  r.eval('repay(H[2],0)');assert.equal(r.s.pleas.rows.length,1);
});

test('a loan judgement clears the original debt, pays the creditor and records only real court receipts',()=>{
  const r=court();r.eval('H[2].w=100');loan(r);const before=total(r);r.eval('courtSession(s,0)');
  near(total(r),before);near(r.eval('E[1]'),0);near(r.H[2]._debt,0);assert.equal(r.H[2]._owe.length,0);near(r.s.court.loanRecovered,20);
  const fee=r.eval('JUSTICE_CUSTOM.pleaDays*foodYr()/360');near(r.H[4].w,20-fee);near(r.H[4]._inc,0);near(r.W.houses[1].gold,1+fee-r.s.court.fees);
  assert.equal(r.eval('E[3]'),true);const html=r.eval('courtCard(s,0)');assert.ok(html.includes('data-nm="p5"'));assert.ok(html.includes('plea fee from the recovery'));
});

test('voluntary repayment retires a pending loan, including the already-written-off penny',()=>{
  const r=court();r.eval('H[2].w=100');loan(r);r.eval('repay(H[2],19.995);courtSession(s,0)');
  near(r.eval('E[1]'),0);near(r.H[2]._debt,0);near(r.H[4].w,19.995);assert.equal(r.s.pleas.rows.length,0);assert.equal(r.s.court.sessions,0);
});

test('beasts under judgement have a funded buyer; the family retains breeders, its team and food reserve',()=>{
  const r=court();r.eval('W.houses[1].gold=100;s.px.swine=10;s.px.cattle=12;s.px.horses=20;H[2].tr="carter";H[2]._strips=8;H[2].herd={swine:5,cattle:4,horses:4};s.stores.swine=5;s.stores.cattle=4;s.stores.horses=4;chestReserve=()=>50');loan(r);
  const before=total(r),stores=JSON.stringify(r.s.stores),bread=r.eval('courtKeep(s,H[2])');r.eval('courtSession(s,0)');
  near(total(r),before);assert.equal(JSON.stringify(r.s.stores),stores);near(r.eval('herdOf(H[2],s).swine'),2);near(r.eval('herdOf(H[2],s).cattle'),4);near(r.eval('herdOf(H[2],s).horses'),4);
  near(r.s.court.distraints,3);near(r.s.court.loanRecovered,20);near(r.H[2]._inc,0);assert.ok(r.H[2].w>=bread);assert.ok(r.W.houses[1].gold>=50);assert.ok(r.eval('courtCard(s,0)').includes('sold 3 swine'));
});

test('no surplus or no buyer’s spare coin means no distraint, no fabricated repayment and no extra stock records',()=>{
  for(const cash of [0,50]){const r=court();r.eval(`W.houses[1].gold=${cash};chestReserve=()=>50;H[2].herd={swine:1,cattle:1,horses:2};H[2].tr='carter';s.stores.swine=1;s.stores.cattle=1;s.stores.horses=2`);loan(r);
    assert.equal(r.s.pleas,undefined);const n=r.s._owners.size,before=total(r);r.eval("courtPlead(s,'entry',3,20,{},W.houses[1]);courtSession(s,0)");near(total(r),before);near(r.s.court.recovered,0);near(r.s.court.distraints||0,0);assert.equal(r.s._owners.size,n);}
});

test('a sitting shares the actual livestock buyer’s purse across debtors and several debts',()=>{
  const r=court();r.eval('W.houses[1].gold=28;chestReserve=()=>20;s.px.swine=10;H[2].herd={swine:5};H[3].herd={swine:5};s.stores.swine=10');loan(r,{v:100});
  r.eval('H[3]._owe=[[H[4],100,1]];H[3]._debt=100;repay(H[3],0);courtSession(s,0)');near(r.s.court.distraints,1);near(r.eval('herdOf(H[2],s).swine+herdOf(H[3],s).swine'),9);near(r.s.stores.swine,10);
  near(r.s.court.loanRecovered,8-r.eval('courtKeep(s,H[2])'));assert.equal(r.s.pleas.rows.length,2);assert.ok(r.W.houses[1].gold>=0);
});

test('old loan pleading uses the existing repayment pass and attempts only its oldest aged loan',()=>{
  const r=court();r.eval('H[2].w=100;day=()=>361;H[2]._owe=Array.from({length:100},()=>[H[4],1,1]);H[2]._debt=100;headsOf=()=>{throw Error("unexpected census")};repay(H[2],0)');
  assert.equal(r.s.pleas.rows.length,1);assert.equal(r.s.pleas.rows[0].ref,r.H[2]._owe[0]);
});

test('a merged household carries the same loan entry and a pending case finds its new head',()=>{
  const r=court();r.eval('H[2].w=100');loan(r);const ref=r.H[2]._owe[0];r.eval('marryHouseholds(H[3],H[2]);courtSession(s,0)');
  near(ref[1],0);near(r.H[3]._debt,0);assert.equal(r.s.court.roll.rows[0].who,4);assert.equal(r.s.pleas.rows.length,0);
});

test('a household split preserves loan age and the prior amercement; both portions remain real debts',()=>{
  const r=court();r.eval('bindHousehold(H[3],householdAccount(H[2]));H[2]._owe=[[H[4],20,1,true]];H[2]._debt=20;departHousehold(H[3],0,1,"migrant")');
  near(r.H[2]._debt,10);near(r.H[3]._debt,10);assert.deepEqual(JSON.parse(r.eval('JSON.stringify([H[2]._owe[0].slice(1),H[3]._owe[0].slice(1)])')),[[10,1,true],[10,1,true]]);
});

test('death settles the borrower’s estate and retires queued loans without burdening the surviving family',()=>{
  const r=court();r.eval('H[2].w=100');loan(r);r.eval('H[2].w=0;bindHousehold(H[3],householdAccount(H[2]));H[3].age=10;H[3].pa=H[2];H[2].kids=[H[3]];inherit(H[2]);H[2].dead=true;courtSession(s,0)');
  near(r.eval('E[1]'),0);near(r.H[3]._debt,0);near(r.H[4].w,0);assert.equal(r.s.pleas.rows.length,0);assert.equal(r.s.court.sessions,0);
});

test('a dead lender’s repayments and court fee divide among the actual heirs; returned capital is not income',()=>{
  const r=court();r.eval('H[2].w=100;H[4].dead=true;H[4]._estateShares=[[householdAccount(H[3]),0.5],["crown",0.5]]');loan(r);const before=total(r);r.eval('courtSession(s,0)');
  const fee=r.eval('JUSTICE_CUSTOM.pleaDays*foodYr()/360');near(total(r),before);near(r.H[3].w,(20-fee)/2);near(r.W.treasury,(20-fee)/2);near(r.H[3]._inc,0);near(r.W._crInc,0);
  r.eval('H[2]._owe=[[H[4],10,361]];H[2]._debt=10;repay(H[2],10)');near(r.H[3]._inc,0);near(r.W._crInc,0);
});

test('the lord’s returned loan capital is not earnings and carries no fee paid to himself',()=>{
  const r=court();r.eval('H[2].w=100;day=()=>361;globalThis.E=[W.houses[1],20,1];H[2]._owe=[E];H[2]._debt=20;repay(H[2],0);courtSession(s,0)');
  near(r.s.court.loanRecovered,20);near(r.s.court.pleaFees,0);near(r.W.houses[1]._inc,1);near(r.W.houses[1].gold,21-r.s.court.fees);
});

test('an unpaid loan is not amerced or charged a plea fee again after more coin becomes available',()=>{
  const r=court();r.eval('W.houses[1].gold=100;s.px.swine=10;H[2].herd={swine:2};s.stores.swine=2');loan(r,{v:20});r.eval('courtSession(s,0)');
  const fee=r.s.court.pleaFees;assert.ok(r.H[2]._debt>0);r.eval('H[2].w=100;H[3].w=100;repay(H[2],0)');plead(r,4,20);r.eval('courtSession(s,0)');near(r.H[2]._debt,0);near(r.s.court.pleaFees,fee);near(r.s.court.roll.rows.filter(p=>p.kind==='loan')[1].fine,0);
});

test('waiting for officers changes neither the herd nor the purses promised by the quote',()=>{
  const r=court();r.eval('W.houses[1].gold=100;s.px.swine=10;H[2].herd={swine:5};s.stores.swine=5;for(const h of H)h.sk=[0,0,0,0]');loan(r);const before=total(r);r.eval('courtSession(s,0)');
  near(total(r),before);near(r.eval('herdOf(H[2],s).swine'),5);near(r.eval('E[1]'),20);assert.equal(r.eval('E[3]'),undefined);assert.equal(r.s.court.sessions,0);
});

test('marriage to the creditor cancels the court dispute instead of charging a family over its own loan',()=>{
  const r=court();r.eval('H[2].w=100');loan(r);const before=total(r);r.eval('marryHouseholds(H[2],H[4]);courtSession(s,0)');near(total(r),before);assert.equal(r.s.pleas.rows.length,0);assert.equal(r.s.court.sessions,0);
});

test('a parish creditor is linked to its actual church and receives only the judgement less its fee',()=>{
  const r=court();r.eval('globalThis.church={nm:"Parish church",arch:"temple",state:"sound",x:10,z:20,s,ch:{fund:0}};s.buildings.push(church);H[2].w=100;day=()=>361;globalThis.E=[church,20,1];H[2]._owe=[E];H[2]._debt=20;repay(H[2],0);courtSession(s,0)');
  near(r.eval('church.ch.fund'),20-r.s.court.pleaFees);const code='building:0:10:20:temple';assert.ok(r.eval('courtCard(s,0)').includes(`data-nm="${code}"`));r.eval(fn('referenceTarget'));assert.equal(r.eval(`referenceTarget('${code}').pick.b`),r.eval('church'));
});

test('loan requests reuse the month’s buyer reserve and a family without surplus needs no reserve census',()=>{
  const r=court();r.eval('day=()=>361;globalThis.scans=0;chestReserve=()=>{scans++;return 0};globalThis.R={who:W.houses[1]};W.houses[1].gold=100;H[2].herd={swine:1};H[3].herd={swine:3};s.stores.swine=4;H[2]._owe=[[H[4],20,1]];H[2]._debt=20;H[3]._owe=[[H[4],20,1]];H[3]._debt=20;repay(H[2],0,R)');near(r.eval('scans'),0);
  r.eval('repay(H[3],0,R);repay(H[3],0,R)');near(r.eval('scans'),1);assert.equal(r.s.pleas.rows.length,1);
});

test('an exiled owner’s manor uses the actual buyer’s royal reserve, rather than the absent lord’s chest',()=>{
  const r=court();r.eval('W.houses[1].exiled=true;W.treasury=100;H[2].herd={swine:5};s.stores.swine=5;chestReserve=hi=>{if(hi!==0)throw Error("wrong buyer reserve");return 10}');loan(r);assert.equal(r.s.pleas.rows.length,1);
});
