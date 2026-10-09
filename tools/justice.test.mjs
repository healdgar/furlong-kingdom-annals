// The hallmote reads the live debts of #36. Its receipts pay real officers; no household's bread is seized.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const fn=n=>{const m=source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));assert.ok(m,n);return m[0];};
const cst=n=>source.match(new RegExp('^const '+n+'=.*$','m'))[0];
function court(){const r=realm({households:5,cash:0,grain:0,fish:0});
  r.eval(['courtOwed','courtSpare','courtQuote','courtOfficials','courtSession','tickJustice','courtCard','book','lordSeat','sovOn','plyH','workerCommandTarget','workerCommandIndexText','workerCommandString','runCmd','replayEntry','manorLines'].map(fn).join('\n')+'\n'+cst('dueOn'));
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
