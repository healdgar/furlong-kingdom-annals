// Tolls, road upkeep and assarts (#36). Pontage and pavage are taken at each toll house on a load's way from whoever owns the load, for
// whoever owns the house, and the dealer reckons them with his carriage; a road with toll houses is mended by their owners from the year's
// tolls first and their purses after, one with none by the lords at either end while the market dues of its loads pay for it; a toll house
// is set up where its tolls would pay its keeper, its part of the road and its house, and given up where they do not; a household that
// clears its lord's wood pays him a fine grounded in the wood's pannage, and only where the strip repays it. The game's own routines run
// against small realms, every purse counted before and after.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {realm,near} from './ownership-fixture.mjs';
import {moneyFlowGap} from './money-flow.mjs';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=inlineGameScript(fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8'));
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^let |^/\\*|$(?![\\s\\S]))','m'))?.[0]||assert.fail('no function '+n);
const line=n=>source.match(new RegExp('^const '+n+'=.*$','m'))?.[0]||assert.fail('no const '+n);
const CUSTOMS=source.slice(source.indexOf('const CUSTOMS='),source.indexOf('};',source.indexOf('const CUSTOMS='))+2);
const TOLLS=[CUSTOMS,line('TOLL_HOMES'),line('dueOn'), // TEN_SHARE comes with the fixture (#36's manor)
  ...['customOf','acctLabel','hostTarget','chestReserve','tollStands','tollKeeper','tollWage','roadTolls','wayToll','payTolls','tollSite','roadSpare','tollGiveUp','tollReview','tickWays',
  'assartFine','stripYield','assartSpare','assarter','assartPays','assart'].map(fn)].join('\n');
const PAY=(source.match(/^const HUNGRY_HANDS=.*$/m)?.[0]||'')+'\n'+['book','dayHands','hungryHands','payAmong','buildWorks','workers_','lordTake'].map(fn).join('\n');

// A realm of two places (0, held by House A; 1, the crown's), purses counted: the crown, the houses, the households and the town chests.
function world({cash=100,crown=1000,gold=1000,households=8}={}){
  const r=realm({cash,crown,households});
  const t={name:'Crownton',owner:0,pop:100,kind:'town',stores:{grain:0,fish:0},_lard:{grain:0,fish:0},folk:[],buildings:[],pos:{x:5000,z:0},prosperity:50,unrest:0,infected:0,px:{grain:1,fish:2},_made:{},res:{},works:{}};
  Object.assign(r.s,{name:'Housham',owner:1,works:{}});r.W.settlements.push(t);r.W.houses=[{crown:true},{name:'House A',gold,led:{}}];r.W.roads=[];r.W.bldList=[];
  Object.assign(r.C,{t,ARCH:{house:[8,7,5,0,'house'],toll:[6,6,5,0,'toll house']},CELL:27,riverAt:()=>null,propValue:()=>2,updateBuildingInstance:()=>{},vacantResidentialChanged:()=>{}});
  r.eval(PAY+'\n'+TOLLS);
  const purses=()=>r.W.treasury+r.W.houses.reduce((n,h)=>n+(h.gold||0),0)+r.H.reduce((n,h)=>n+h.w,0)+r.W.settlements.reduce((n,s)=>n+(s.murage||0),0);
  let start=purses(),f0={...(r.W._flow||{})};
  const audit=()=>{const g=moneyFlowGap(f0,r.W._flow||{});near(purses()-start-g.expect,0);assert.equal(g.mintT,0,'minted from nobody');assert.ok(!('<>lost' in(r.W._flow||{})),'paid to nobody');};
  const snap=()=>{start=purses();f0={...(r.W._flow||{})};};
  return {...r,t,purses,audit,snap};
}
test('annual upkeep presents the actual unfunded duty against its payer, and full upkeep presents nothing',()=>{
  const r=world({gold:0}),{W,s}=r;W.roads=[{a:0,b:1,len:2000,cond:1}];r.eval('day=()=>360;tickWays()');r.audit();assert.equal(s.royalPleas.rows.length,1);assert.equal(s.royalPleas.rows[0].kind,'neglect');assert.equal(s.royalPleas.rows[0].against,W.houses[1]);near(s.royalPleas.rows[0].v,W.roads[0]._upW/2);assert.equal(r.t.royalPleas,undefined,'the Crown cannot pay a fine to itself');
  r.eval('day=()=>720;tickWays()');assert.equal(s.royalPleas.rows.length,1);assert.equal(s.royalPleas.rows[0].incidents,2);near(s.royalPleas.rows[0].v,W.roads[0]._upW);r.audit();
  const q=world({gold:1000});q.W.roads=[{a:0,b:1,len:2000,cond:1}];q.eval('day=()=>360;tickWays()');q.audit();assert.equal(q.s.royalPleas,undefined);
});

// a building of place s on road ri's street, lived in by household head h (its keeper), owned as given
function bldg(r,s,{arch='toll',ri=0,keeper=null,owner,x=40,state='sound'}={}){const b={arch,tier:0,state,s,x,z:0,w:8,d:7,st:{kind:'road',ri},hh:keeper?[keeper]:[]};if(keeper)keeper.bh=b;if(owner!==undefined)b.ownerId=owner;
  s.buildings.push(b);b.idx=r.W.bldList.length;r.W.bldList.push(b);return b;}

test('a load pays at every toll house on its way, the custom of each place on its worth, to each house\'s owner; none where no one keeps it',()=>{
  const r=world(),{H,s,t,W}=r;s.custom={toll:0.02};
  const lordsHouse=bldg(r,s,{keeper:H[1],owner:'lord'}),burghersHouse=bldg(r,t,{keeper:H[3],owner:H[2].id}),empty=bldg(r,t,{owner:'lord'}),burnt=bldg(r,t,{keeper:H[4],owner:'lord',state:'ruin'});
  W.roads=[{a:0,b:1,len:5000},{a:1,b:0,len:100}];r.eval('W._tollsDirty=true;W.bldList.forEach((b,i)=>b.st.ri=i<1?0:1);roadTolls()');
  // the dealer's reckoning: the share of the load's worth taken on the way, priced once for each version of the tolls
  r.C.leg={ris:[0,1],poly:[]};near(r.eval('wayToll(leg)'),0.02+0.01);assert.deepEqual([...r.eval('leg._tl')],[lordsHouse,burghersHouse],'the empty and the burnt house take nothing');
  s.custom.toll=0.5;near(r.eval('wayToll(leg)'),0.03,'priced once a version');r.eval('W._tollV++');near(r.eval('wayToll(leg)'),0.51);s.custom.toll=0.02;r.eval('W._tollV++');
  near(r.eval('wayToll({poly:[],len:9})'),0,'the sea pays no pontage');
  // the load comes in at the crown's town: the tolls on the way, then the market's dues
  r.eval(fn('ladeIn'));r.snap();const m=H[0],w0=m.w,tr0=W.treasury,g0=W.houses[1].gold,b0=H[2].w;
  r.C.c={origin:0,dest:1,good:'grain',qty:10,cost:100,m,_tl:r.eval('leg._tl'),_ris:[0,1]};r.eval('ladeIn(c,t)');
  near(W.houses[1].gold-g0,2,'two in the hundred to House A, at its gate');near(W.houses[1].led.tolls,2);near(H[2].w-b0,1,'the realm\'s custom to the burgher who owns the other');
  near(lordsHouse._tk,2);near(burghersHouse._tk,1);
  const aid=100*12/100*0.35;near(W.treasury-tr0,aid,'the crown has its market dues, and no toll');near(w0-m.w,3+aid,'the dealer paid both');
  r.audit();
  // a man pays no toll to himself
  r.C.c={origin:0,dest:1,good:'grain',qty:10,cost:100,m:H[2],_tl:[lordsHouse,burghersHouse]};const h2=H[2].w;r.eval('ladeIn(c,t)');near(h2-H[2].w,2+aid);r.audit();
});

test('freight\'s reckoning includes the tolls on the way: a thin margin the tolls eat is not sent',()=>{
  const PROGRAM=[line('GOODS'),line('GOODBASE'),line('LU'),line('NEED'),line('TRADE_LOAD'),CUSTOMS,line('TOLL_HOMES'),
    ...['customOf','tollStands','tollKeeper','wayToll','frtRate','freight','tradeOnTheWay','tradeWant','tradeSpare','tradeRoom','tickTrade'].map(fn)].join('\n');
  const send=toll=>{
    const place=o=>({name:o.name,pop:0,infected:0,storage:{},stores:{...o.stores},px:{grain:2,...o.px},_dAvg:{grain:100},carters:1,dealers:1,pos:o.pos||{x:0,z:0},custom:{toll}});
    const S=[place({name:'Market',stores:{grain:200}}),place({name:'Town',px:{grain:2.5},pos:{x:1000,z:0}})],keeper={},keeper2={},b={arch:'toll',state:'sound',s:S[1],x:0,z:0,hh:[keeper]};keeper.bh=b;
    const b2={...b,s:S[0],hh:[keeper2]};keeper2.bh=b2;const leg={poly:[{x:0,z:0},{x:1000,z:0}],len:1000,time:1000,ris:[0]};
    const W={settlements:S,caravans:[],ships:[],roads:[{a:0,b:1,len:1000,_tolls:[b,b2]}],riverPairs:[],_tollV:1};
    const C=vm.createContext({W,D:4,MOD:{tax:12},PL:()=>1,CART_MPD:500,BARGE_MPD:700,COG_MPD:2800,CELL:27,riverAt:()=>null,
      day:()=>C.D,price:(s,g)=>s.px[g]??1,avail:(s,g)=>s.stores[g]||0,spareOf:(s,g)=>s.stores[g]||0,closedToTrade:()=>false,metroOf:s=>s,
      caravanPriceIndex:()=>null,caravanPriceCandidates:()=>null,dist2d:(a,b,c,d)=>Math.hypot(a-c,b-d),route:()=>leg,seaRoute:()=>null});
    vm.runInContext('"use strict";\n'+PROGRAM+`
      function ladeOut(c,o){ladeOut.why=null;if(!(o.carters>0)){ladeOut.why='driver';return null;}o.carters--;o.stores[c.good]-=c.qty;c.cost=c.qty*2;return c;}`,C);
    vm.runInContext('tickTrade()',C);return W.caravans;};
  // the margin without tolls: 2.5 there against 2 here, less the freight, the market's dues there and a little lost on the way
  const net=2.5-2-(0.12+0.08)*0.7-2.5*(0.05+12/100*0.14)-0.04;assert.ok(net>0&&net<2*0.1,'a thin margin: '+net);
  const cheap=send(0.01);assert.equal(cheap.length,1,'two tolls of one in the hundred leave it worth sending');
  near(cheap[0]._wt,0.02);assert.equal(cheap[0]._tl.length,2,'the load knows the toll houses it will pass');assert.deepEqual(cheap[0]._ris,[0]);
  assert.equal(send(0.05).length,0,'two of five in the hundred eat the margin: not sent');
});

test('a road with toll houses is mended by their owners, from the year\'s tolls first and their purses after; the keepers are paid',()=>{
  const r=world(),{H,s,W}=r;H[5].tr=H[6].tr='mason';r.C.day=()=>360;
  const b=bldg(r,s,{keeper:H[1],owner:'lord'});b._tk=30;W.roads=[{a:0,b:1,len:5000,cond:0.5}];W._tollsDirty=true;r.snap();
  const g0=W.houses[1].gold,k0=H[1].w,m0=H[5].w+H[6].w;r.eval('tickWays()');
  const wage=0.2*12,up=5*2;near(H[1].w-k0,wage,'the keeper\'s year');near(H[5].w+H[6].w-m0,up,'the masons mend it');near(g0-W.houses[1].gold,wage+up,'from House A, whose toll it is');
  near(W.houses[1].led['road upkeep'],-up);near(W.houses[1].led.tolls,-wage);
  const R=W.roads[0];near(R.cond,0.7);near(R._upY,up);near(R._upT,up,'thirty taken: the mending is all from the tolls');near(b._tkY,30);near(b._tk,0);assert.equal(b.arch,'toll','it pays: it stands');r.audit();
  // a thin year: what the tolls do not cover comes from the purse; and a toll that does not pay its keeper and its road is given up
  r.C.day=()=>720;b._tk=4;r.snap();r.eval('tickWays()');near(R._upY,up);near(R._upT,4-wage,'the takings less the keeper\'s pay, the rest from the purse');
  assert.equal(b.arch,'house','four taken against a keeper and a road wanting twelve: the toll is given up');r.audit();
});

test('a road with no toll house is mended by the lords at either end, each his half, by custom, and each only from his chest beyond its reserve',()=>{
  const r=world(),{H,W}=r;H[5].tr='mason';r.C.day=()=>360;r.t.folk=[];
  W.roads=[{a:0,b:1,len:5000,cond:0.5}];r.snap();const g0=W.houses[1].gold,tr0=W.treasury;r.eval('tickWays()');
  near(g0-W.houses[1].gold,5,'House A its half, though the road brings its market nothing');
  near(W.treasury,tr0,'the crown holds no more than its war chest (a host of sixty for twenty-five months): nothing from it');
  near(W.roads[0]._upY,5);near(W.roads[0].cond,0.5+0.35*0.5-0.15,'half mended: it wears a little');assert.equal(W.roads[0]._mkA,undefined,'no market dues are kept for it');r.audit();
  r.C.day=()=>720;W.treasury=2000;W.houses[1]._incA=(W.houses[1].gold-2)/3;r.snap();const g1=W.houses[1].gold,tr1=W.treasury;r.eval('tickWays()');
  near(g1-W.houses[1].gold,2,'House A only what lies beyond a quarter\'s revenue');near(tr1-W.treasury,5,'the crown, with five hundred beyond its reserve, its half');
  near(W.roads[0]._upY,7);near(W.roads[0].cond,0.525+0.35*0.7-0.15);r.audit();
  r.C.day=()=>1080;W.houses[1]._incA=W.houses[1].gold/3;W.treasury=1500;r.snap();const g2=W.houses[1].gold;r.eval('tickWays()');
  near(W.houses[1].gold,g2,'a lord at his reserve pays nothing');near(W.treasury,1500);near(W.roads[0]._upY,0);r.audit();
});

test('a toll house\'s owner at his reserve mends from the year\'s tolls only',()=>{
  const r=world(),{H,s,W}=r;H[5].tr='mason';r.C.day=()=>360;
  const b=bldg(r,s,{keeper:H[1],owner:'lord'});b._tk=8;W.roads=[{a:0,b:1,len:5000,cond:0.5}];W._tollsDirty=true;W.houses[1]._incA=W.houses[1].gold/3;r.snap();
  r.eval('tickWays()');near(W.roads[0]._upY,8-0.2*12,'the takings less the keeper\'s pay, and nothing from a chest at its reserve');near(W.roads[0]._upT,8-0.2*12);r.audit();
});

test('a toll house is set up only where the custom on last year\'s loads would pay a keeper, a part of the road and the house over a dozen years',()=>{
  const r=world(),{H,s,W}=r;H[5].tr='mason';r.C.day=()=>360;
  const home=bldg(r,s,{arch:'house',keeper:H[4],owner:H[4].id,x:60}),inner=bldg(r,s,{arch:'house',keeper:H[3],owner:H[3].id,x:20});
  const R={a:0,b:1,len:5000,cond:1,_tolls:[]};W.roads=[R];
  const wage=0.2*12,up=10,fit=8*7*0.12,buy=2*0.12*12,need=(wage+up+(fit+buy)/12)/0.01; // in worth carried over the road in a year
  R._wvY=need*0.95;r.snap();r.eval('tollReview(W.roads[0],0,[],10)');assert.equal(home.arch,'house','short of what it would cost: none');r.audit();
  R._wvY=need*1.05;const g0=W.houses[1].gold,k0=H[4].w;r.eval('tollReview(W.roads[0],0,[],10)');
  assert.equal(home.arch,'toll','the house furthest out on the road, where it leaves the place, is fitted out');assert.equal(inner.arch,'house');
  assert.equal(home.ownerId,'lord');assert.equal(home.home0,'house');assert.equal(home._tollSince,360);assert.equal(W._tollsDirty,true);
  near(g0-W.houses[1].gold,fit+buy,'House A bought it at a dozen years\' rent and fitted it out');near(H[4].w-k0,buy,'its household sold it, and keeps the toll');r.audit();
  assert.equal(r.t.buildings.length,0,'the crown\'s town has no house on the road: no toll there');
});

test('an assart pays the wood\'s lord a fine grounded in its pannage, only where the strip repays it and the clearer has it to spare',()=>{
  const r=world({cash:10}),{H,s,W}=r,FY=r.eval('foodYr()');r.C.householdSize=()=>2;s.px.swine=4;s.stores.swine=12;s._graze={pann:12};s._gYield=1e-4;
  const f={area:20000,lord:1};const fine=12*(2*1.2/0.25)*(12*0.25/12)*0.1*4;near(r.eval('assartFine(s,f)',r.C.f=f),fine);
  s.stores.swine=0;near(r.eval('assartFine(s,f)'),0,'no swine eat the mast: the wood brings its lord nothing');s.stores.swine=12;
  s.custom={pannage:0};near(r.eval('assartFine(s,f)'),0,'no pannage by custom: nothing');delete s.custom;
  H[0].w=fine+2*FY-0.01;assert.equal(r.eval('assartPays(s,f,H[0])'),false,'he must keep his household\'s year of bread');H[0].w=fine+2*FY;assert.equal(r.eval('assartPays(s,f,H[0])'),true);
  s._gYield=fine/12/(20000*0.87*360*0.84*0.85*1)*0.99;assert.equal(r.eval('assartPays(s,f,H[0])'),false,'a strip whose dozen years would not repay the fine is left wood');s._gYield=1e-4;
  r.snap();const g0=W.houses[1].gold;r.eval('assart(s,f,H[0])');near(W.houses[1].gold-g0,fine);near(W.houses[1].led.assarts,fine);
  assert.deepEqual([f.ten,f.own,f.wk],['free',H[0].id,H[0].id],'the clearer holds it freely, and owes its rent as other strips do');r.audit();
  f.lord=0;r.snap();const t0=W.treasury;r.eval('assart(s,f,H[0])');assert.ok(W.treasury>t0,'the crown where the crown is lord');r.audit();
});

test('in the month\'s reckoning of the land, the wood is taken only by a household that pays its lord, or by his own hired hands for nothing',()=>{
  const LAND=[line('LK'),line('LS'),line('ARABLE')].join('\n');
  const play=({cash,clearing=false})=>{const r=world({cash,households:3});const {s,H,W}=r;H.forEach(h=>h.tr='ploughman');
    Object.assign(r.C,{refreshArea:()=>{},settleTracks:()=>{},prepareFences:()=>{},landWt:()=>1,
      soilYield:()=>1e-4,domReach:()=>5000,shapeFurlong:()=>{},claimFurlong:()=>assert.fail('no claim'),setFurlong:(f,st)=>{f.state=st;},emit:()=>{},pick:(k,L)=>L[0],vary:(k,L)=>L[0](),
      tills:h=>h.tr==='ploughman',rand:()=>0.5,chance:()=>false,foundDaughter:()=>{},carryingCap:()=>{},day:()=>15,householdSize:()=>1});
    r.eval(LAND+'\n'+['wpick','sheepLand','sheepHolder','pasturePays','tickLand'].map(fn).join('\n'));
    s.px.swine=4;s.stores.swine=12;s._graze={pann:12};s._haHH=1e6;s.clearUntil=clearing?100:0;
    const wood={k:0,kind:r.eval('LK.FIELD'),state:r.eval('LS.WOOD'),lord:1,area:20000,dom:0,x:100,z:0,n:10,fa:0,ar:10,fo:10};s.furl=[wood];W.land={F:[wood],perHead:1};
    r.snap();const g0=W.houses[1].gold;r.eval('tickLand()');r.audit();return {wood,paid:W.houses[1].gold-g0,r};};
  const fine=12*(2*1.2/0.25)*(12*0.25/12)*0.1*4;
  const poor=play({cash:0.5});assert.equal(poor.wood.state,poor.r.eval('LS.WOOD'),'no household can pay the fine: the wood stands');near(poor.paid,0);
  const able=play({cash:fine+8});assert.equal(able.wood.state,able.r.eval('LS.TILLED'),'a household with the fine clears it');near(able.paid,fine);assert.equal(able.wood.ten,'free');
  const hired=play({cash:0.5,clearing:true});assert.equal(hired.wood.state,hired.r.eval('LS.TILLED'),'the lord\'s clearing takes it');near(hired.paid,0,'his own hands pay him nothing');
});
