// The manor's dues (#36): the mill's farm and the suit of mill, commuted services and their arrears, entry fines, merchet,
// liveries, and the crown's book, run as the game runs them on the ownership fixture's small realm.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const fn=n=>{const m=source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));assert.ok(m,'function '+n);return m[0];};
const cst=n=>{const m=source.match(new RegExp('^const '+n+'=.*$','m'));assert.ok(m,'const '+n);return m[0];};
const CUSTOMS=source.slice(source.indexOf('const CUSTOMS='),source.indexOf('function customOf('));

// A town of three households under House Ash (W.houses[1]); strips and buildings are bound to their holders as in the game.
function manor({households=3,cash=0,strips=[],buildings=[],commodity=false}={}){
  const r=realm({households,cash,grain:0,fish:0,commodity});
  r.eval(CUSTOMS+[fn('book'),fn('nearestOther'),fn('sovOn'),fn('plyH')].join('\n'));
  r.eval('W.houses=[{name:"the Crown"},{name:"House Ash",gold:0}];s.owner=1;W.player={on:true,house:1};tilledOf=t=>t.furl||[];for(const h of H)h.tr="ploughman"');
  r.s.furl=strips;r.s.buildings=buildings.map(b=>({state:'sound',ownerId:'lord',s:r.s,...b}));
  r.eval('ownershipTick();for(const h of H)householdAccount(h).population.set(s,1)'+(commodity?';storageInit(s)':''));
  return r;}
const house=r=>r.W.houses[1];
const gold=r=>r.coins()+(house(r).gold||0); // every purse in the realm: the households, the crafts' pools, the treasury and the house
const strip=(id,o={})=>({k:0,ten:'villein',own:id,wk:id,area:1e4,dom:0,lord:-1,...o});

test('the mill is let to the miller who offers most, whatever his purse; its multure is then his, and the farm is paid the lord at the quarter days',()=>{
  const r=manor({strips:[strip(2)],buildings:[{arch:'mill'}]});
  r.eval("H[0].tr='miller';H[0].w=0;H[2].tr='miller';H[2].w=500;H[1].w=0;householdAccount(H[0]).population.set(s,4);householdAccount(H[2]).population.set(s,6);s.buildings[0]._tk={mult:100,suit:2};s._lgL=new Map([[W.houses[1],{got:200,out:150,rot:50,coin:100}]])");
  const before=gold(r),fy=r.eval('foodYr()');
  r.eval('farmMills(s,0)');const F=r.s.buildings[0].farm;
  assert.ok(F,'let: the best offer beats what the mill brought the lord kept in hand (100 multure at half its price, and 2 of grinding)');
  assert.equal(F.who,1,'the smaller household offers more: an empty purse does not stop him');near(F.rent,102-4*fy);near(house(r).gold,0,'nothing is paid at the letting');
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s))");
  near(r.eval("mkt(s,'grain').get(H[0])"),6);near(r.s.buildings[0]._tk.mult,6); // the multure, a sixteenth and more, is the farmer's to sell
  near(r.eval("mkt(s,'grain').get(W.houses[1])"),94*0.38);near(r.eval('s._lg.get(W.houses[1]).got'),94*0.38); // the lord's grain here: his villein's rent in kind, not the multure
  r.eval('H[0].w=200');for(const d of [91,181,271]){r.eval(`day=()=>${d};farmQuarters(s)`);}
  near(house(r).led['mill farm'],F.rent*3/4);assert.equal(F.q,3);near(F.arr,0);
  r.eval('day=()=>361;farmMills(s,0)');near(house(r).led['mill farm'],F.rent);near(house(r).gold,F.rent);near(r.H[0].w,200-F.rent);near(F.paid,F.rent);near(gold(r),before+200);
});

test('what a farmer cannot pay at a quarter day is an arrear on the farm, rolled for the manor court; behind at the year\'s end, he is not let it again',()=>{
  const setup=(other)=>{const r=manor({buildings:[{arch:'mill'}]});
    r.eval(`H[0].tr='miller';H[0].w=0;householdAccount(H[0]).population.set(s,4);${other?"H[2].tr='miller';householdAccount(H[2]).population.set(s,6);":''}s.buildings[0]._tk={mult:100,suit:2};s._lgL=new Map([[W.houses[1],{got:200,out:150,rot:50,coin:100}]]);farmMills(s,0)`);return r;};
  const r=setup(true),F=r.s.buildings[0].farm;assert.equal(F.who,1);
  r.eval('day=()=>91;farmQuarters(s);H[0].w=s.buildings[0].farm.rent/8;day=()=>181;farmQuarters(s)');near(F.arr,F.rent/4+F.rent/4-F.rent/8);
  assert.deepEqual(JSON.parse(r.eval("JSON.stringify(s.pleas.rows.map(x=>[x.kind,x.who]))")),[['farm',1],['farm',1]]);near(house(r).led['mill farm'],F.rent/8);
  r.eval('day=()=>361;s.buildings[0]._tk={mult:100,suit:2};farmMills(s,0)');assert.equal(r.s.buildings[0].farm.who,3,'let to the next bidder, whose offer still beats the keeping');
  const alone=setup(false);alone.eval('day=()=>361;s.buildings[0]._tk={mult:100,suit:2};farmMills(s,0)');assert.equal(alone.s.buildings[0].farm,undefined,'no one else: the lord takes it in hand');
});

test('the lord keeps his mill in hand when its multure sells at its price',()=>{
  const r=manor({buildings:[{arch:'mill'}]});
  r.eval("H[0].tr='miller';H[0].w=500;s.buildings[0]._tk={mult:100,suit:2};s._lgL=new Map([[W.houses[1],{got:200,out:200,rot:0,coin:200}]])");
  const before=gold(r);r.eval('farmMills(s,0)');
  assert.equal(r.s.buildings[0].farm,undefined);near(house(r).gold,0);near(gold(r),before);
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s))");near(r.eval("mkt(s,'grain').get(W.houses[1])"),100); // no strips: all of it the lord's, multure and all
});

test('a place with no miller owes suit to the lord\'s mill: the grinding is paid to its holder, the lord or his farmer',()=>{
  const r=manor({buildings:[{arch:'mill'}]});r.eval('H[1].w=30;H[2].w=0');const before=gold(r);
  near(r.eval("craftWork(s,H[1],['miller'],10)"),10);near(r.H[1].w,20);near(house(r).gold,10);near(house(r).led['suit of mill'],10);near(r.s.buildings[0]._tk.suit,10);near(gold(r),before);
  assert.ok(r.eval("s._unmet.miller")>0,'the place still wants a miller of its own');
  r.eval("s.buildings[0].farm={who:H[2].id,rent:0,until:day()+360,last:{}}");
  near(r.eval("craftWork(s,H[1],['miller'],10)"),10);near(r.H[2].w,10);near(house(r).gold,10);near(gold(r),before);
  r.eval("H[0].tr='miller'");const pool=()=>r.eval("s._poolBy.miller||0");near(r.eval("craftWork(s,H[1],['miller'],5)"),5);near(pool(),5); // a miller of its own: he has the work
});

test('commuting removes the villein\'s extra share in kind and puts a money rent no larger than it in its place',()=>{
  const r=manor({strips:[strip(2)]});const f=r.s.furl[0];r.eval('H[1].w=30');
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s))");near(r.eval('s._lg.get(W.houses[1]).got'),38);
  r.eval('s._lg.get(W.houses[1]).rot=38;s._lg0=day()-360;manorYear(s,s.furl)');assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),1,'the rent grain rotted unsold: he commutes');
  assert.equal(f.svc,'money');near(f.qrent,(0.85-0.62)*100);
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s))");const kind=r.eval('s._lg.get(W.houses[1]).got');near(kind,15);
  assert.ok(f.qrent<=(38-kind)*1+1e-9,'the money rent is no more than the share in kind it replaces, at the price');
  r.eval('H[1].w=50;s._lg0=day()-360;manorYear(s,s.furl);manorRents(s,0,s.furl,folkIndex(),1)');near(r.H[1].w,50-f.qrent);near(house(r).led.rents,f.qrent);near(f._arr,0);
});

test('a lord\'s grain at a place is reckoned as it goes: sold or eaten for its price, spoiled for nothing',()=>{
  const r=manor({commodity:true});r.eval("s.stores.grain=100;offer(s,'grain',W.houses[1],100);lordGot(s,W.houses[1],100);H[0].w=50;purchase(s,'grain',H[0],20)");
  const before=r.eval("mkt(s,'grain').get(W.houses[1])");r.eval("spoilOwned(s,'grain',0.05)");const T=r.eval('s._lg.get(W.houses[1])');
  near(T.out,20);near(T.coin,20);near(T.rot,before-r.eval("mkt(s,'grain').get(W.houses[1])"));assert.ok(T.rot>0);
  r.eval('s._lg0=day()-360;manorYear(s,[])');near(r.eval('lordYield(s,W.houses[1])'),20/(20+T.rot));
});

test('the first reckoning, with only part of a year behind it, neither commutes nor fixes a rent',()=>{
  const r=manor({strips:[strip(2)]});const f=r.s.furl[0];
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s));manorYear(s,s.furl)");assert.equal(r.s._lgL,null);
  assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),0);assert.equal(f.svc,undefined);near(r.eval('stripRent(s,s.furl[0],1)'),0);
});

test('a lord whose rent grain sells at its price keeps the week-work; the ruler may order it either way',()=>{
  const r=manor({strips:[strip(2)]});const f=r.s.furl[0];r.eval('H[1].w=30');
  r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s));Object.assign(s._lg.get(W.houses[1]),{out:38,coin:38});s._lg0=day()-360;manorYear(s,s.furl)");
  assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),0);assert.equal(f.svc,undefined);
  r.eval("Object.assign(s._lgL.get(W.houses[1]),{coin:0,out:0,rot:38});H[1].w=10");assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),0,'the villein has not the coin to pay it');
  r.eval("H[1].w=30;manorCmd('s-svc','0:works')");assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),0,'kept in hand by order');
  r.eval("manorCmd('s-svc','0:money');Object.assign(s._lgL.get(W.houses[1]),{coin:38,out:38,rot:0});H[1].w=0");assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),1,'commuted by order');
  r.eval("W.player.house=0;manorCmd('s-svc','0:auto')");assert.equal(r.s.svc,'money','only the lord of the place, or the crown in its own, gives the order');
});

test('arrears two years running return the holding to the lord, and each year\'s arrear is rolled for the manor court',()=>{
  const r=manor({strips:[strip(2,{svc:'money',qrent:20})]});const f=r.s.furl[0];r.eval('H[1].w=5');
  r.eval('manorRents(s,0,s.furl,folkIndex(),1)');near(house(r).gold,5);near(f._arr,15);assert.equal(f._arrN,1);assert.equal(f.wk,2);
  r.eval('manorRents(s,0,s.furl,folkIndex(),1)');assert.equal(f.wk,-1);assert.equal(f.own,-1);near(house(r).gold,5);
  assert.deepEqual(JSON.parse(r.eval("JSON.stringify(s.pleas.rows.map(x=>[x.kind,x.who,Math.round(x.v)]))")),[['arrears',2,15],['arrears',2,35]]);
});

// tickTenure itself, with the year's land-use choice left out
function tenure(r){r.eval([fn('tickTenure'),fn('heirOf'),fn('settleTenure'),fn('tenureNew'),cst('TILLERS'),cst('TRADE_ARCH'),cst('RESID'),cst('dueOn'),cst('tills')].join('\n')+
  ';W.land={};day=()=>360;frand=()=>0.5;chooseLandUse=()=>{};landValue=()=>1;propValue=()=>1;');}

test('an heir pays his entry fine once, when the holding has passed to him; no fine where the holder has not changed',()=>{
  const r=manor({strips:[strip(1,{_lq:38}),strip(2,{k:1,_lq:38})]});tenure(r);r.eval('for(const h of H)h.w=100');
  r.s.furl[0].own=3;r.s.furl[0]._ent=3; // as inherit leaves it: the holding passed to the heir (H[2]), his entry due
  r.s.furl[1]._ent=3; // a stale mark: the holder is still H[1]
  r.eval('s._lg0=0;tickTenure()');near(house(r).led['entry fines'],38);assert.equal(r.s.furl[0]._ent,-1);assert.equal(r.s.furl[1]._ent,-1);
  r.eval('for(const f of s.furl)f._lq=38;s._lg0=0;tickTenure()');near(house(r).led['entry fines'],38); // a year on, no one new: no fine
});

test('a strip with no crop behind it (cleared this year: its assart fine was its entry) owes no entry fine, to an heir or a new holder',()=>{
  const r=manor({strips:[strip(1,{ten:'free'}),strip(-1,{k:1,ten:'free'})]});tenure(r);r.eval('for(const h of H)h.w=100');
  r.s.furl[0].own=3;r.s.furl[0]._ent=3;r.eval('s._lg0=0;tickTenure()');assert.equal(r.s.furl[1].wk>0,true,'the empty strip is taken up');
  assert.equal(house(r).led?.['entry fines'],undefined);
});

test('inherit marks the heir\'s entry, due at the place\'s next reckoning',()=>{
  const r=realm({households:4,cash:0});r.eval("H[0].sx='m';H[0].b=-40;H[1].sx='f';H[1].b=-38;H[2].sx='m';H[2].b=-12;H[2].age=12;H[0].sp=H[1];H[1].sp=H[0];H[2].ma=H[1];H[2].pa=H[0];H[0].kids=[H[2]];H[1].kids=[H[2]];ownershipTick()");
  r.s.furl=[{k:0,own:1,wk:1,ten:'villein'}];r.eval('bindPropertyRights(s);inherit(H[0]);H[0].dead=true');assert.equal(r.s.furl[0].own,3);assert.equal(r.s.furl[0]._ent,3);});

test('a vacant holding goes to the tiller who offers the lord most for it, and his offer is the fine',()=>{
  const r=manor({strips:[strip(-1,{_cy:1000,_lq:380})]});tenure(r);r.eval('H[0].w=10;H[1].w=500;H[2].w=200');const fy=r.eval('foodYr()');
  r.eval('s._lg0=0;tickTenure()');const f=r.s.furl[0];assert.equal(f.wk,2);assert.equal(f.own,2);
  near(house(r).led['entry fines'],500-fy);
  const poor=manor({strips:[strip(-1,{_cy:1000,_lq:380})]});tenure(poor);poor.eval('H[0].w=10;H[1].w=20;H[2].w=30');poor.eval('s._lg0=0;tickTenure()');
  assert.ok(poor.W.houses[1].led['entry fines']<house(r).led['entry fines'],'fewer coins among the landless, a smaller fine');
});

test('merchet is paid by a bride\'s household that holds villein land, to that land\'s lord, and by no other',()=>{
  const r=manor({strips:[strip(2),strip(3,{k:1,ten:'free'})]});r.eval('for(const h of H)h.w=20');const v=r.eval("customOf(s,'merchet')*foodYr()");
  near(r.eval('merchet(s,H[1])'),v);near(house(r).led.merchet,v);near(r.H[1].w,20-v);
  near(r.eval('merchet(s,H[2])'),0);near(r.eval('merchet(s,H[0])'),0);near(r.H[2].w,20);
  r.eval("s.custom={merchet:1}");near(r.eval('merchet(s,H[1])'),Math.min(20-v,r.eval('foodYr()')));
  assert.match(fn('yearOfFolk'),/merchet\(s,w\);marryHouseholds\(best,w\)/,'paid at the wedding, before the households are joined');
});

for(const commodity of [false,true])test(`liveries pay servants in food the lord would lose to rot, and in coin where it would sell sound (${commodity?'commodity ledger':'claims'})`,()=>{
  const r=manor({commodity});r.eval("W.houses[1].gold=100;s.stores.grain=100;offer(s,'grain',W.houses[1],100);s._rot={grain:0.001};s._dAvg={grain:10};for(const h of H)householdAccount(h).population.set(s,2)");
  const before=gold(r);r.eval('liveries(s,[H[0],H[1]],40,W.houses[1])');const q=2*0.007*30;
  near(r.eval("pantry(s,H[0]).grain"),q);near(r.eval("pantry(s,H[1]).grain"),q);near(r.eval("mkt(s,'grain').get(W.houses[1])"),100-2*q);
  near(r.H[0].w,20-q);near(house(r).gold,100-40+2*q);near(house(r).ledKY.liveries,-2*q);near(house(r).led.household,-(40-2*q));near(gold(r),before);
  const sound=manor({commodity});sound.eval("W.houses[1].gold=100;s.stores.grain=100;offer(s,'grain',W.houses[1],100);s._rot={grain:0};s._dAvg={grain:10}");
  sound.eval('liveries(s,[H[0],H[1]],40,W.houses[1])');near(sound.H[0].w,20);near(sound.eval("mkt(s,'grain').get(W.houses[1])"),100);assert.equal(sound.W.houses[1].ledKY,undefined);
});

test('the crown keeps a book by the same labels as the houses, its sales among them',()=>{
  const r=manor();r.eval("H[0].w=50;transfer(H[0],'crown',5,'merchet');transfer('crown',H[1],2,'household');offer(s,'grain','crown',10);s.stores.grain=10;purchase(s,'grain',H[0],4)");
  const B=r.eval('W.crownBook');near(B.ledY.merchet,5);near(B.ledY.household,-2);near(B.ledY.sales,4);near(B.led.merchet,5);
  r.eval(fn('ledgerHTML')+'\n'+fn('detailNumber')+';esc=x=>String(x);bookKind(W.houses[1],"liveries",-3)');const html=r.eval("ledgerHTML(W.crownBook,true,'The treasury')+ledgerHTML(W.houses[1],true)");
  assert.ok(html.includes('The treasury, this year so far')&&html.includes('merchet')&&html.includes('sales'));assert.ok(html.includes('In kind, this year so far')&&html.includes('liveries'));
});

test('a journaled order sets a custom or commutes services the same way in a fresh realm, and the worker refuses a bad one',()=>{
  const extra=['runCmd','replayEntry','workerCommandTarget','workerCommandIndexText','workerCommandString'].map(fn).join('\n');
  const setup=()=>{const r=manor({strips:[strip(2)]});Object.assign(r.C,{MODEL_ONLY:true,backgroundUserRequest:()=>false,workerCommandIsLocal:()=>false});r.eval(extra);return r;};
  const orders=[{k:'c',c:'s-custom',a:'0:merchet:1.25'},{k:'c',c:'s-svc',a:'0:money'}];
  const [a,b]=[setup(),setup()];for(const r of [a,b]){for(const e of orders){assert.equal(r.eval(`workerCommandTarget(${JSON.stringify(e)})`),'worker');r.eval(`replayEntry(${JSON.stringify(e)})`);}
    assert.equal(r.eval("customOf(s,'merchet')"),1.25);assert.equal(r.s.svc,'money');
    r.eval("s._made={grain:100};shareOutput(s,0,folkIndex(),headsOf(s));Object.assign(s._lg.get(W.houses[1]),{out:38,coin:38});s._lg0=day()-360;manorYear(s,s.furl)");assert.equal(r.eval('manorRents(s,0,s.furl,folkIndex(),1)'),1);}
  assert.deepEqual(JSON.parse(a.eval('JSON.stringify([s.custom,s.svc,s.furl[0].qrent])')),JSON.parse(b.eval('JSON.stringify([s.custom,s.svc,s.furl[0].qrent])')));
  for(const e of [{k:'c',c:'s-custom',a:'0:land:1'},{k:'c',c:'s-custom',a:'0:merchet:-1'},{k:'c',c:'s-custom',a:'0:merchet:99'},{k:'c',c:'s-svc',a:'0:sell'},{k:'c',c:'s-svc',a:'9:money'}])
    assert.throws(()=>a.eval(`workerCommandTarget(${JSON.stringify(e)})`),/Invalid manor command/);
});

test('the governance view has a row and two orders for every custom, and the service orders; the town card names the mill\'s farmer',()=>{
  const r=manor({strips:[strip(2,{svc:'money',qrent:5}),strip(3,{k:1})],buildings:[{arch:'mill'}]});
  r.eval(fn('manorOrdersHTML')+'\n'+fn('manorLines')+";esc=x=>String(x);W.startAD=850;s.custom={merchet:1}");
  const html=r.eval('manorOrdersHTML(s,0)'),keys=JSON.parse(r.eval('JSON.stringify(Object.keys(CUSTOMS))'));
  for(const k of keys){assert.ok(html.includes(`data-cmd="s-custom" data-arg="0:${k}:`),k);assert.equal(html.split(`data-arg="0:${k}:`).length-1,2,k);}
  assert.ok(html.includes('data-arg="0:merchet:0.875"')&&html.includes('data-arg="0:merchet:1.125"'),'a step is a quarter of the realm\'s custom');
  assert.ok(html.includes('1 of 2 commuted'));for(const o of ['money','works','auto'])assert.ok(html.includes(`data-cmd="s-svc" data-arg="0:${o}"`));
  r.eval("s.buildings[0].farm={who:H[0].id,rent:12.4,until:day()+360,last:{}}");const L=JSON.parse(r.eval('JSON.stringify(manorLines(s))'));
  assert.deepEqual(L.map(x=>x[0]),['Mill','Villein holdings','Customs']);assert.match(L[0][1],/let to .* for 12 a year, to 851/);assert.match(L[1][1],/^1 of 2 commuted/);
});
