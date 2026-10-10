// The hallmote reads live debts and presentments. Its receipts pay real officers; no household's bread is seized.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const fn=n=>{const m=source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));assert.ok(m,n);return m[0];};
const cst=n=>source.match(new RegExp('^const '+n+'=.*$','m'))[0];
function court(){const r=realm({households:5,cash:0,grain:0,fish:0});
  r.eval(['courtGrazing','courtDebtor','courtOfficials','courtSession','tickJustice','courtCard','book','lordSeat','sovOn','plyH','workerCommandTarget','workerCommandIndexText','workerCommandString','runCmd','replayEntry','manorLines'].map(fn).join('\n')+'\n'+['dueOn','LK','LS'].map(cst).join('\n'));
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

test('the bread and ale assize records actual named craft payments, not a trade estimate or the sundry pool',()=>{
  const r=court();r.eval(fn('payCrafts')+'\n'+source.match(/^const TRADE_W=[\s\S]*?;/m)[0]);Object.assign(r.C,{KCr:0,tills:()=>false});
  r.eval('H[2].tr="baker";H[3].tr="brewer";H[4].tr="smith";s._poolBy={baker:40,brewer:20,smith:10};s._poolCash=100;payCrafts(s,H)');
  const rows=r.s.pleas.rows;assert.equal(rows.length,2);near(rows[0].v,40);near(rows[1].v,20);assert.equal(rows[0].kind,'assize');assert.equal(rows[0].against,r.eval('householdAccount(H[2])'));
  assert.ok(r.H[2].w>40,'sundry craft payments are paid but not called bread receipts');near(r.s._poolCash,0);assert.equal(Object.keys(r.s._poolBy).length,0);
  r.eval('s._poolBy={baker:15};payCrafts(s,H)');near(rows[0].v,55);assert.equal(r.s.pleas.rows.length,2);
});

test('bread receipts wait for the twice-yearly great court while other dues are heard at the quarter day',()=>{
  const r=court();r.eval('H[2].w=100;H[3].w=100;courtAssize(s,H[2],40)');plead(r,4,20);
  r.eval('day=()=>90;tickJustice()');near(r.s.court.recovered,20);near(r.s.court.fines,1);assert.equal(r.s.pleas.rows.length,1);near(r.s.pleas.rows[0].v,40);near(r.H[2].w,100);
  const before=total(r);r.eval('day=()=>180;tickJustice()');near(total(r),before);near(r.s.court.recovered,20);near(r.s.court.byKind.assize.fines,2);near(r.H[2].w,98);assert.equal(r.s.pleas.rows.length,0);
  assert.equal(r.s.court.roll.rows.at(-1).ruling,'amerced');near(r.s.court.roll.rows.at(-1).left,0);r.eval('day=()=>360;tickJustice()');near(r.H[2].w,98,'the same licence receipts cannot be charged twice');
});

test('the assize uses each place’s own great court day, not the realm’s half-year',()=>{
  const r=court();r.eval('W.settlements.unshift({...s,pleas:null});W.houses[1].seat=1;H.forEach(h=>h.si=1);H[2].w=100;courtAssize(s,H[2],40);day=()=>53;tickJustice()');
  near(r.H[2].w,100);assert.equal(r.s.court.sessions,0);r.eval('day=()=>143;tickJustice()');near(r.H[2].w,98);assert.equal(r.s.court.sessions,1);
});

test('a fine-only case never recovers invented principal or forces a beast sale',()=>{
  const r=court(),bread=r.eval('foodYr()/12');r.eval(`H[2].w=100;H[3].w=${bread};H[3].herd={swine:5};s.stores.swine=5;W.houses[1].gold=100;courtAssize(s,H[2],40);courtAssize(s,H[3],100);day=()=>180`);
  const before=total(r);r.eval('chestReserve=()=>{throw Error("a fine cannot sell beasts")};courtSession(s,0)');
  near(total(r),before);near(r.s.court.recovered,0);near(r.s.court.distraints,0);near(r.eval('herdOf(H[3],s).swine'),5);near(r.H[3].w,bread);near(r.s.court.byKind.assize.pardoned,1);assert.equal(r.s.pleas.rows.length,0);
});

test('all a family’s fines share its spare purse and respect the journaled cap',()=>{
  const r=court(),bread=r.eval('foodYr()/12');r.eval(`H[2].w=${bread+10};courtAssize(s,H[2],1000);globalThis.A=householdAccount(H[2]);globalThis.P=courtPlead(s,'trespass',3,1000,A,W.houses[1]);P.against=A;justiceCmd('0:cap:0.1');day=()=>180`);
  const before=total(r);r.eval('courtSession(s,0)');near(total(r),before);near(r.s.court.byKind.assize.fines,1);near(r.s.court.byKind.trespass.fines,0.9);near(r.H[2].w,bread+8.1);
});

test('grazing presentments value only the shortage, apportioned to beasts beyond the worked holding’s share',()=>{
  const r=court();r.eval('s.furl=[{area:10000,state:LS.TILLED,ten:"free",wk:3,own:3},{area:10000,state:LS.TILLED,ten:"free",wk:4,own:4}];herdOf(H[2],s).cattle=8;herdOf(H[3],s).cattle=4;s.px.hay=10;headsOf=()=>{throw Error("no extra household census")};courtGrazing(s,{cap:10},12)');
  const rows=r.s.pleas.rows;assert.equal(rows.length,1);assert.equal(rows[0].who,3);assert.equal(rows[0].kind,'trespass');near(rows[0].v,7);assert.equal(rows[0].against,r.eval('householdAccount(H[2])'));
  r.eval('courtGrazing(s,{cap:10},12)');assert.equal(rows.length,1);near(rows[0].v,14,'another month’s harm joins the same pending case');
});

test('the lord’s excess beasts are not charged to an innocent family; another lord’s land grants no share',()=>{
  const r=court();r.eval('s.furl=[{area:10000,state:LS.TILLED,ten:"free",wk:3,own:3},{area:10000,state:LS.TILLED,ten:"demesne"},{area:1000000,state:LS.TILLED,lord:2,wk:3,own:3}];herdOf(H[2],s).cattle=4;s.px.hay=10;courtGrazing(s,{cap:10},20)');
  assert.equal(r.s.pleas,undefined);r.eval('herdOf(H[2],s).cattle=8;courtGrazing(s,{cap:10},20)');near(r.s.pleas.rows[0].v,10.5,'three of the ten excess livestock units belong to this household');
});

test('a fieldless common follows resident mouths, not dealers’ ownership rows or beasts on pannage',()=>{
  const r=court();r.eval('herdOf(H[2],s).cattle=5;herdOf(H[3],s).swine=1000;s.px.hay=10;courtGrazing(s,{cap:10},5)');assert.equal(r.s.pleas,undefined,'ample grass creates no case');
  r.eval('globalThis.A=householdAccount(H[2]);A.population.set(s,2);herdOf(H[2],s).cattle=8;herdOf(H[3],s).cattle=4;courtGrazing(s,{cap:12},12)');assert.equal(r.s.pleas,undefined,'at capacity creates no case');
  r.eval('courtGrazing(s,{cap:10},12)');assert.equal(r.s.pleas.rows.length,2);near(r.s.pleas.rows.reduce((n,p)=>n+p.v,0),7);assert.ok(r.s.pleas.rows.every(p=>p.who===3||p.who===4));
});

test('a family merger keeps one real assize obligation and finds the surviving head',()=>{
  const r=court();r.eval('H[2].w=100;courtAssize(s,H[2],40);marryHouseholds(H[3],H[2]);day=()=>180;courtSession(s,0)');
  near(r.s.court.byKind.assize.fines,2);assert.equal(r.s.court.roll.rows[0].who,4);assert.equal(r.s.pleas.rows.length,0);
});

test('a resident family without an inventory row still holds its share of a fieldless common',()=>{
  const r=court();r.eval('herdOf(H[2],s).cattle=8;s.px.hay=10;for(const h of [H[0],H[1],H[3],H[4]])s._owners.delete(householdAccount(h));courtGrazing(s,{cap:10},12)');
  assert.equal(r.s.pleas.rows.length,1);near(r.s.pleas.rows[0].v,7*6/10,'six excess family units and four lord/drover units share the two-unit shortage');
});

test('an extinct account leaves no personal presentment for an heir, lord, crown or another institution',()=>{
  for(const to of ['householdAccount(H[3])','W.houses[1]','"crown"','{kind:"abbey",head:9,gold:100}']){const r=court();r.eval(`H[2].w=100;courtAssize(s,H[2],40);globalThis.A=householdAccount(H[2]);globalThis.P=courtPlead(s,'trespass',3,20,A,W.houses[1]);P.against=A;H[2].dead=true;A.head=null;A.estate={person:3};W.houses[1].head=9;A.successors=[[${to},1]];day=()=>180`);
    const before=total(r);r.eval('courtSession(s,0)');near(total(r),before);assert.equal(r.s.pleas.rows.length,0);assert.equal(r.s.court.sessions,0);near(r.s.court.fines,0);}
});

test('unprofitable presentments wait without a payment, and later real receipts fund the sitting',()=>{
  const r=court();r.eval('H[2].w=100;courtAssize(s,H[2],0.0001);day=()=>180;courtSession(s,0)');near(r.H[2].w,100);assert.equal(r.s.court.sessions,0);assert.equal(r.H[0].office,undefined);
  r.eval('courtAssize(s,H[2],40);day=()=>360;courtSession(s,0)');assert.equal(r.s.court.sessions,1);near(r.s.court.byKind.assize.fines,40.0001*0.05);assert.equal(r.s.pleas.rows.length,0);
});

test('new presentments use the same bounded pending and ruling rolls',()=>{
  const r=court();r.eval('H[2].w=100;for(let i=0;i<100;i++)courtAssize(s,H[2],1)');assert.equal(r.s.pleas.rows.length,1);near(r.s.pleas.rows[0].v,100);
  r.eval('for(let i=0;i<100;i++){const p=courtPlead(s,"trespass",3,1,{},W.houses[1]);p.against=householdAccount(H[2]);}day=()=>180;courtSession(s,0)');assert.equal(r.s.court.roll.rows.length,12);assert.equal(r.s.court.byKind.trespass.heard,64);assert.equal(r.s.pleas.rows.length,0);
});

test('presentment reports distinguish receipts and grazing harm from money owing, and do not write state',()=>{
  const r=court();r.eval('H[2].w=100;courtAssize(s,H[2],40);day=()=>180;courtSession(s,0)');const before=r.eval('JSON.stringify([s.court,s.pleas])'),html=r.eval('courtCard(s,0)');
  assert.ok(html.includes('Next great court'));assert.ok(html.includes('assize of bread and ale'));assert.ok(html.includes('40 in recorded receipts'));assert.ok(!html.includes('owing'));assert.ok(html.includes('2 amerced'));assert.equal(r.eval('JSON.stringify([s.court,s.pleas])'),before);
});

test('entry enrolment records the real payment and its original shortfall without another charge',()=>{
  const r=court();r.eval('s.furl=[{k:7,area:10000,own:3,wk:3,ten:"villein"}];H[2].w=5;entryFine(s,s.furl[0],H[2],20)');
  const p=r.s.enrolments.rows[0];assert.equal(p.kind,'entry');assert.equal(p.who,3);assert.equal(p.field,7);near(p.paid,5);near(p.assessed,20);near(p.left,15);assert.equal(p.lord,'h1');
  near(total(r),5);near(r.H[2]._debt||0,0);assert.equal(r.s.pleas.rows.length,1);near(r.s.pleas.rows[0].v,15);assert.equal(r.s.court,undefined);
  r.eval('H[2].w=100;courtSession(s,0)');near(p.left,15,'the enrolment is a snapshot; the plea owns the live debt');
  assert.ok(r.eval('courtCard(s,0)').includes('15 unpaid at entry'));
});

test('a marriage enrols one changed holding with both rights and keeps the former holder’s name',()=>{
  const r=court();r.eval('H[2].gn="Bride";H[3].gn="Groom";s.furl=[{k:0,area:20000,own:3,wk:3,ten:"free"},{k:1,own:5,wk:5,ten:"free"}];bindPropertyRights(s);marryHouseholds(H[3],H[2]);H[2].gn="Changed"');
  const p=r.s.enrolments.rows[0];assert.equal(r.s.enrolments.rows.length,1);assert.equal(p.action,'marriage');assert.equal(p.before.own,3);assert.equal(p.before.wk,3);assert.equal(p.before.ownName,'Bride');assert.equal(p.after.own,4);assert.equal(p.after.wk,4);assert.equal(p.ha,2);
  assert.ok(r.eval('courtCard(s,0)').includes('Bride'));assert.equal(r.s.court,undefined);assert.equal(r.s.pleas,undefined);
});

test('land witnesses use existing rights and names without refreshing the world’s person census',()=>{
  const r=court();r.eval('s.furl=[{k:0,area:10000,own:3,wk:3,ten:"free"}];folkIndex=()=>{throw Error("no new census")};globalThis.was=courtHolding(s.furl[0]);s.furl[0].wk=4;courtLand(s,s.furl[0],was,"letting");courtLand(s,s.furl[0],courtHolding(s.furl[0]),"letting")');
  assert.equal(r.s.enrolments.rows.length,1);assert.equal(r.s.enrolments.rows[0].before.own,3);assert.equal(r.s.enrolments.rows[0].after.own,3);assert.equal(r.s.enrolments.rows[0].after.wk,4);
});

test('enrolments keep twelve scalar snapshots and four bounded earlier counts, retaining no former actors',()=>{
  const r=court();r.eval('for(let i=0;i<100;i++)for(const kind of ["land","entry","merchet","heriot"])courtEnrol(s,kind,H[2],{paid:i})');
  assert.equal(r.s.enrolments.rows.length,12);assert.equal(Object.keys(r.s.enrolments.over).length,4);assert.equal(Object.values(r.s.enrolments.over).reduce((a,b)=>a+b,0),388);
  assert.ok(r.s.enrolments.rows.every(p=>Object.values(p).every(v=>v===null||typeof v!=='object')));assert.equal(r.s.court,undefined);near(total(r),0);
});

test('a register without a sitting is discoverable, distinguishes kind from coin, and both reports only read',()=>{
  const r=court();r.eval('courtEnrol(s,"heriot",H[2],{beast:"horses",qty:1,...courtLord(s,null,W.houses[1])});courtEnrol(s,"merchet",H[3],{payer:4,payerName:"Bride",partner:3,partnerName:"Groom",paid:0,assessed:20,...courtLord(s,null,W.houses[1])})');
  const before=r.eval('JSON.stringify([s.enrolments,s.court,s.pleas])'),html=r.eval('courtCard(s,0)'),lines=r.eval('manorLines(s)');
  assert.ok(html.includes('1 horses delivered in kind'));assert.ok(html.includes('paid 0'));assert.ok(html.includes('custom 20'));assert.ok(!html.includes('owing'));assert.ok(lines.some(([k,v])=>k==='Court'&&v.includes('2 land and customary entries')));
  assert.equal(r.eval('JSON.stringify([s.enrolments,s.court,s.pleas])'),before);
});

test('an initial court inspection leaves an absent person index absent and can show saved names',()=>{
  const r=court();r.eval('courtEnrol(s,"heriot",H[2],{beast:"horses",qty:1,...courtLord(s,null,W.houses[1])});delete W._pm;delete W._folkIndex;folkIndex=()=>{throw Error("a report cannot populate the index")};W.houses[1].justice={steward:1,clerk:2}');
  const html=r.eval('courtCard(s,0)');assert.ok(html.includes('household'));assert.ok(html.includes('p1'));assert.ok(html.includes('p2'));assert.equal(r.W._pm,undefined);assert.equal(r.W._folkIndex,undefined);
});
