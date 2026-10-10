import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {dailyDispatch,validateDailyOrder} from './simulation-order.mjs';
import {DAY_PARTS} from './cpu-score.mjs';
import {realm,near} from './ownership-fixture.mjs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const contract=JSON.parse(fs.readFileSync(new URL('../docs/SIMULATION-ORDER.json',import.meta.url),'utf8'));
const dispatch=dailyDispatch(html),names=dispatch.phases.map(p=>p.name);
const fn=name=>{const n=dispatch.functions.get(name);assert.ok(n,name);return dispatch.source.slice(n.start,n.end);};

test('the actual daily dispatcher covers the survey and obeys its acyclic dependencies',()=>{
  assert.deepEqual(validateDailyOrder(dispatch,contract),[]);
  assert.equal(new Set(contract.survey.map(p=>p.name)).size,42);
  for(const p of contract.survey)assert.ok(names.includes(p.name),'missing surveyed phase '+p.name);
  assert.deepEqual(DAY_PARTS,names.filter(n=>n!=='dragonWake'),'profiler names the real source phases');
});
test('dependency review detects a misplaced consumer and a repeated or omitted phase',()=>{
  const phases=dispatch.phases.slice(),a=names.indexOf('tickPopulation'),b=names.indexOf('tickMarket');
  [phases[a],phases[b]]=[phases[b],phases[a]];
  assert.ok(validateDailyOrder({...dispatch,phases},contract).some(e=>e.includes('tickMarket must precede tickPopulation')));
  assert.ok(validateDailyOrder({...dispatch,phases:dispatch.phases.slice(1)},contract).some(e=>e.includes('Missing phase: ownershipTick')));
  assert.ok(validateDailyOrder({...dispatch,phases:[...dispatch.phases,dispatch.phases[0]]},contract).some(e=>e.includes('repeated')));
  const wrong=dispatch.phases.map(p=>p.name==='tickMilitary'?{...p,callee:'tickEconomy'}:p);
  assert.ok(validateDailyOrder({...dispatch,phases:wrong},contract).some(e=>e.includes('Wrong phase callback: tickMilitary')));
});

for(const commodity of [false,true])test(`delivery pays the real driver and supplies meals before new loads (${commodity?'balances':'lots'})`,()=>{
  const r=realm({commodity,households:2,grain:10,fish:0,cash:20,crown:100});
  r.eval(`W.clock={day:36};day=()=>W.clock.day;W.roads=[];W.caravans=[];W.armies=[];
    const d={name:'destination',owner:0,pop:0,infected:0,stores:{grain:0,fish:0},folk:[],buildings:[],pos:{x:100,z:0},px:{grain:3,fish:2}};W.settlements.push(d);
    storageInit(s);purchase(s,'grain',H[0],3);
    const c={origin:0,dest:1,good:'grain',qty:purchase.got,m:H[0],drv:H[1],fee:2,cost:3,value:3,departDay:35,arriveDay:37,_staffed:true};storageCargoOut(c,s,true);W.caravans.push(c);
    payTolls=()=>0;MOD.vir=1;MODEL_ONLY=true;BACKGROUND=null;REPLAYING=false;
    simPart=(name,f)=>f();storageOutcomeReady=()=>true;const observed=[];`);
  // Keep the actual arrival/custody/transfer functions. Other phase bodies stand in for consumers.
  for(const name of names)if(!['tickCaravans','storagePrepare'].includes(name))r.eval(`function ${name}(){}`);
  r.eval(fn('storagePrepare')+'\n'+fn('tickCaravans')+'\n'+fn('ladeIn')+'\n'+fn('simTick'));
  r.eval(`tickMarket=()=>{observed.push(['market',d.stores.grain,H[1].w]);purchase(d,'grain',H[1],1);commodityCreditPurchase(d,H[1],'grain',purchase.got);};
    tickPopulation=()=>{consumeOwned(d,H[1],'grain',1);observed.push(['meal',d.stores.grain]);};
    tickTrade=()=>observed.push(['depart',d.stores.grain]);simTick();`);
  const seen=JSON.parse(r.eval('JSON.stringify(observed)'));
  near(seen[0][1],3);near(seen[0][2],22); // existing transfer paid the driver before provisioning
  near(seen[1][1],2);near(seen[2][1],2);
  assert.equal(r.W.caravans.length,0);near(r.s.stores.grain,7);near(r.eval('d.stores.grain'),2);
  near(r.coins(),140);assert.equal(r.W.clock.day,37);
  r.eval('tickCaravans()');near(r.H[1].w,19); // retired delivery cannot pay again
});

test('daily quarry production keeps the former monthly physical rate and respects closure',()=>{
  const s={stores:{},quarry:{state:'sound'},res:{stone:5},pop:99,plagueDead:0},offers=[];
  const c=vm.createContext({W:{settlements:[s]},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),ownerAcct:()=>7,offer:(s,g,o,q)=>offers.push({g,o,q})});
  vm.runInContext(fn('tickQuarries'),c);for(let i=0;i<30;i++)vm.runInContext('tickQuarries()',c);
  near(s.stores.stone,5*2.2*.99);assert.equal(offers.length,30);assert.ok(offers.every(x=>x.o===7&&x.g==='stone'));
  s.siegeBy={};vm.runInContext('tickQuarries()',c);assert.equal(offers.length,30);
  s.siegeBy=null;s.quarry.state='ruin';vm.runInContext('tickQuarries()',c);assert.equal(offers.length,30);
});
test('remaining stone demand is refreshed daily without producing another stone batch',()=>{
  const s={stores:{stone:8},buildings:[],res:{},kind:'village',pop:100},q={type:'pave',r:{a:0,len:100},done:.25};
  const c=vm.createContext({W:{settlements:[s],projects:[q]},AD:()=>850,storageMaterialDemand:()=>2});
  vm.runInContext(fn('tickStone'),c);vm.runInContext('tickStone()',c);near(s._stoneWant,11);
  q.done=.75;vm.runInContext('tickStone()',c);near(s._stoneWant,5);near(s.stores.stone,8);
});
test('ward incorporation hands its fields over before later allocation',()=>{
  const a={name:'Ward',owner:1,furl:[{lord:1}],kind:'village'},b={name:'Town',owner:2},W={settlements:[a,b]},handovers=[];
  const c=vm.createContext({W,G:{},AD:()=>900,setLord:(f,lord)=>{f.lord=lord;handovers.push(lord);},refreshOverlay(){},emit(){},vary:()=>''});
  vm.runInContext(fn('syncOwner')+'\n'+fn('incorporate'),c);vm.runInContext("incorporate(0,1,'')",c);
  assert.equal(a.owner,2);assert.equal(a._lord,2);assert.equal(a.furl[0].lord,2);assert.deepEqual(handovers,[2]);
});
test('person preparation replaces an invalidated opening roll without a second census',()=>{
  const fresh=new Map([[9,{id:9}]]),W={_pm:new Map([[1,{id:1}]])};let calls=0;
  const c=vm.createContext({W,folkIndex:()=>{calls++;return fresh;}});vm.runInContext(fn('peoplePrepare'),c);vm.runInContext('peoplePrepare()',c);
  assert.equal(W._pm,fresh);assert.equal(calls,1);assert.equal(W._pm.has(1),false);
});
test('a funded ward purchase posts its named accounts at the ward and hands over the fields',()=>{
  const a={name:'Ward',owner:1,pop:100,kind:'village',furl:[{lord:1}],pos:{x:0,z:0}},b={name:'Town',owner:2,pop:200,kind:'town',pos:{x:10,z:0}};
  const W={settlements:[a,b],houses:[{}, {name:'Seller',gold:100,seat:0},{name:'Buyer',gold:1000,seat:1}]},records=[];
  const c=vm.createContext({W,G:{},day:()=>200,year:()=>0,AD:()=>900,tickTongues(){},builtReach:()=>10,houseAtWar:()=>false,plyH:()=>-1,
    dist2d:(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz),wardPrice:()=>50,purse:hi=>W.houses[hi].gold,chestReserve:()=>0,
    spend:(hi,v,why,town)=>{W.houses[hi].gold-=v;records.push({hi,v:-v,town});},book(){},purseAcct:hi=>hi,
    cashRecord:(hi,v,why,town)=>records.push({hi,v,town}),setLord:(f,lord)=>{f.lord=lord;},refreshOverlay(){},emit(){},vary:()=>'',houseName:hi=>W.houses[hi].name});
  vm.runInContext(fn('syncOwner')+'\n'+fn('incorporate')+'\n'+fn('tickMetro'),c);vm.runInContext('tickMetro()',c);
  assert.equal(a.wardOf,1);assert.equal(a.owner,2);assert.equal(a.furl[0].lord,2);
  assert.equal(W.houses[1].gold,150);assert.equal(W.houses[2].gold,950);
  assert.equal(records.length,2);assert.ok(records.every(r=>r.town===a));assert.deepEqual(records.map(r=>[r.hi,r.v]),[[2,-50],[1,50]]);
});
