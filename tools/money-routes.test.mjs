import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {realm,near} from './ownership-fixture.mjs';
import {moneyFlowGap} from './money-flow.mjs';
import {parse} from './vendor/acorn/acorn.mjs';
import {inlineGameScript} from './simulation-boundary.mjs';

// Every coin moves from a named payer to a named recipient (issue #19). These run the production routines against a
// small realm: the purses (crown, great houses, households, church fund, town chest, wyrm's hoard) are counted before
// and after, and the flow book must explain the difference with no coin minted from nobody or paid to nobody.
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0]||assert.fail('no function '+n);
const between=(a,b,from=0)=>{const i=source.indexOf(a,from);assert.ok(i>=0,'missing '+a);const j=source.indexOf(b,i);assert.ok(j>i,'missing '+b);return source.slice(i,j+b.length);};
const PAY=['book','payAmong','buildWorks','workers_','purseAcct','purse','spend','escheat','compensate','levy','rollLiving','soldiersPay','householdHead','wallPurse'].filter(n=>source.includes('function '+n+'(')).map(fn).join('\n');

// a realm with `households` purses of `cash`, a crown holding `crown`, and (optionally) great houses with gold
function world({cash=100,crown=1000,households=6,gold=[]}={}){
  const r=realm({cash,crown,households});
  r.W.houses=[{crown:true},...gold.map((g,i)=>({name:'House '+(i+1),gold:g,led:{}}))];r.W.capital=r.s;r.W.banditCamps=[];
  r.eval(PAY);
  const purses=()=>r.W.treasury+r.W.houses.reduce((t,h)=>t+(h.gold||0),0)+r.H.reduce((t,h)=>t+h.w,0)+(r.s.murage||0)+(r.s._poolCash||0)+(r.W.dragon?.hoard||0)+r.s.buildings.reduce((t,b)=>t+(b.ch?.fund||0),0);
  let start=purses(),f0={...(r.W._flow||{})};
  const snap=()=>{start=purses();f0={...(r.W._flow||{})};};
  // the money in every purse changed only as the flow book says it did, and nothing was minted or lost
  const audit=(label='')=>{const g=moneyFlowGap(f0,r.W._flow||{});near(purses()-start-g.expect,0);assert.equal(g.mintT,0,label+' minted from nobody');assert.equal(g.prepaid,0,label+' prepaid');assert.ok(!('<>lost' in(r.W._flow||{})),label+' paid to nobody');return g;};
  return {...r,purses,audit,snap};
}
const trades=(r,...t)=>t.forEach((x,i)=>r.H[i].tr=x);

test('building work is paid by its named payer to the masons and carters',()=>{
  const r=world();trades(r,'mason','carter');
  r.eval("buildWorks(s,60,'crown','works')");
  near(r.W.treasury,940);near(r.H[0].w,145);near(r.H[1].w,115);near(r.H[2].w,100);r.audit();
});
test('a house that pays the builders is debited and books it; it cannot pay what it has not got',()=>{
  const r=world({gold:[500,10]});trades(r,'mason');
  r.eval("buildWorks(s,40,W.houses[1],'works');buildWorks(s,40,W.houses[2],'works')");
  near(r.W.houses[1].gold,460);near(r.W.houses[1].led.works,-40);near(r.W.houses[2].gold,0);near(r.W.houses[2].led.works,-10);
  near(r.H.reduce((t,h)=>t+h.w,0),600+50);r.audit();
});
test('the town chest pays for its walls and repairs',()=>{
  const r=world();trades(r,'mason');r.s.murage=50;r.snap();
  r.eval("buildWorks(s,20,s,'walls');buildWorks(s,100,s,'repairs')");
  near(r.s.murage,0);near(r.H[0].w,100+50);r.audit();
});
test('a house pulled down for a work: the owner has the price, the tenants a share, the whole of it with no tenants',()=>{
  const r=world({gold:[0]});r.eval("function ownerAcct(b){return b.own;}");
  r.C.b={own:r.H[0],hh:[r.H[1],r.H[2]]};r.eval("compensate('crown',b,s,100)");
  near(r.H[0].w,185);near(r.H[1].w,107.5);near(r.H[2].w,107.5);near(r.W.treasury,900);
  r.C.b={own:r.H[3],hh:[]};r.eval("compensate(W.houses[0].crown?'crown':'crown',b,s,40)");near(r.H[3].w,140);near(r.W.treasury,860);r.audit();
});
test('plunder is paid by the victims into the host\'s chest and shared by thirds: the men, the lord, the crown',()=>{
  const r=world({gold:[50]});r.s.buildings=[{ch:{fund:60}}];r.s.murage=30;r.snap();
  r.eval(fn('lootTo')+fn('spoils'));
  r.C.a={house:1,home:0,at:0,name:'Host',men:[r.H[5]]};
  const taken=r.eval('spoils(a,s,false)');
  near(taken,6*20+12+6);near(r.s.buildings[0].ch.fund,48);near(r.s.murage,24);
  const coin=6*20,chest=18,men=coin*2/3,lordC=coin-men+chest,crownC=lordC/3;
  near(r.H[5].w,100-20+men);near(r.W.treasury,1000+crownC);near(r.W.houses[1].gold,50+lordC-crownC);r.audit();
  assert.equal(r.W.houses[1].led.spoils,lordC-crownC);
});
test('with no host men named the young households of its home country have the shares of the men, and the crown (as lord) the rest',()=>{
  const r=world({gold:[]});r.eval(fn('lootTo')+fn('spoils'));
  r.C.a={house:0,home:0,at:0,name:'Royal host',men:[]};
  r.eval('spoils(a,s,true)');
  near(r.W.treasury,1000+6*50/3);near(r.H[0].w,50+6*50*2/3/6);r.audit();
});
test('a name struck out or a place given to another passes the house\'s balance (or debt) to the crown',()=>{
  const r=world({gold:[120,-30,0]});
  assert.equal(r.eval('escheat(W.houses[1])'),120);assert.equal(r.eval('escheat(W.houses[2])'),-30);assert.equal(r.eval('escheat(W.houses[3])'),0);
  near(r.W.treasury,1090);assert.deepEqual(r.W.houses.slice(1).map(h=>h.gold),[0,0,0]);r.audit();
});

test('the last of a line dying strikes the house out: its balance (10.867 here) passes to the crown, not into thin air',()=>{
  const r=world({gold:[10.867]});const S=r.W.settlements;S.push({name:'Fief',pos:{x:100,z:0},owner:1});S[0].owner=0;
  const n={id:1,alive:true,role:'head',house:1,heirs:[],name:'Last Head',epithet:null};r.W.notables=[n];r.W.monarch={};
  Object.assign(r.C,{notableSetAlive:(m,a)=>{m.alive=a;},nameUse:()=>{},houseOf:m=>r.W.houses[m.house],notableById:()=>null,ageOf:()=>40,syncOwner:()=>{},refreshOverlay:()=>{},emit:()=>{},dropPerson:()=>{},removeAt:()=>{}});
  r.eval(fn('killNotable'));r.eval("killNotable(W.notables[0],'of a sudden fever',true)");
  const h=r.W.houses[1];assert.equal(h.extinct,true);assert.equal(h.gold,0);near(r.W.treasury,1000+10.867);assert.equal(S[1].owner,0);r.audit();
});

// the cadet branch of a great house takes a share of its strongroom
function partitionWorld(houses,fill=false){
  const r=world({gold:houses});
  const S=r.W.settlements;for(let i=1;i<4;i++)S.push({name:'Place'+i,pos:{x:i*100,z:0},owner:1,cult:'anglo'});S[0].owner=0;if(fill)for(let i=2;i<=houses.length;i++)S.push({name:'Holding'+i,pos:{x:i*100,z:50},owner:i,cult:'anglo'});
  r.W.houses[1].seat=1;r.W.houses[1].might=1;r.W.houses[1].wealth=1;r.W.houses[1].cult='anglo';r.W.notables=[];
  Object.assign(r.C,{pick:(k,l)=>l[0],CULT:{anglo:{}},nameRng:()=>0,uniqueHouseName:()=>'Cadet',HOUSEHUES:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],CHARGES:['x'],houseAtWar:()=>false,
    markSigilDirty:()=>{},syncOwner:()=>{},refreshOverlay:()=>{},emit:()=>{},dist2d:(a,b,c,d)=>Math.hypot(a-c,b-d)});
  r.eval(fn('partition'));return r;
}
test('a cadet branch takes its share of the strongroom, and with no room for it nothing is lost',()=>{
  const full=Array.from({length:10},(_,i)=>i===0?900:10);const r=partitionWorld(full,true);
  assert.equal(r.W.houses.length,11);r.C.son={};r.eval('partition(1,son)');
  assert.equal(r.W.houses.length,11);near(r.W.houses[1].gold,900);r.audit();
  const r2=partitionWorld([900]);r2.C.son={};r2.eval('partition(1,son)');
  assert.equal(r2.W.houses.length,3);near(r2.W.houses[1].gold,630);near(r2.W.houses[2].gold,270);r2.audit();
});
test('a cadet that takes over a lapsed house\'s place passes that house\'s old balance to the crown',()=>{
  const r=partitionWorld([900,40]);r.W.houses[2].exiled=true;r.W.houses[2].exiledDay=-9999;r.W.houses[2].grudges={};
  r.C.son={};r.eval('partition(1,son)');
  near(r.W.houses[2].gold,270);near(r.W.houses[1].gold,630);near(r.W.treasury,1040);r.audit();
});

test('new blood raised to a lapsed house is endowed by the crown, whose treasury also takes the old balance',()=>{
  const block=source.slice(source.indexOf('if(day()%97===0){'),source.indexOf('  // succession crisis / civil war spark'));
  assert.ok(block.includes('transfer(\'crown\',h,400,\'endowment\')'));
  for(const [treasury,old] of [[1000,55],[100,-30]]){const endowed=Math.min(400,treasury+old); // (the crown cannot endow what it has not got)
    const r=world({crown:treasury,gold:[0,old]});const h=r.W.houses[2];Object.assign(h,{exiled:true,exiledDay:0,seat:0,grudges:{}});
    r.W.settlements[0].owner=0;r.W.settlements[0].cult='anglo';r.W.settlements[0].name='Seat';r.snap();
    Object.assign(r.C,{day:()=>2910,chance:()=>true,pick:(k,l)=>l[0],NAMEB:{pfx:['A'],sfx:['b']},CULT:{anglo:{}},nameRng:()=>0,uniqueHouseName:()=>'House New',CHARGES:['x'],rand:()=>0.5,randi:()=>0,markSigilDirty:()=>{},syncOwner:()=>{},
      promoteFrom:()=>null,mkNotable:o=>({id:7,birthDay:0,...o}),personName:()=>'Nobody',twoTraits:()=>{},fullTitle:()=>'Lord Nobody',emit:()=>{},refreshHousePanel:()=>{},KA:0,KC:1,KR:2,GW:0,GB:1,trait:()=>0});
    r.eval(`(function(){${block}})()`);
    assert.equal(h.exiled,false);near(h.gold,endowed);near(r.W.treasury,treasury+old-endowed);r.audit();
  }
});
test('a slain wyrm\'s hoard passes to the crown and a new wyrm brings its own from beyond the realm',()=>{
  const r=world();r.W.dragon={name:'Fafnir',state:'sleeping',hoard:800,lair:{x:0,z:0},slayAt:5,slayer:1};
  const m={alive:true,traits:['bold']};
  Object.assign(r.C,{day:()=>10,notableById:()=>m,chance:()=>true,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),MOD:{myth:0},fullTitle:()=>'The king',sovAmbition:()=>{},emit:()=>{},killNotable:()=>{},pick:()=>'Smaug',NAMEB:{dragon:['Smaug']},randi:()=>0});
  r.W.legitimacy=50;r.snap();r.eval(fn('tickDragon')+'tickDragon()');
  assert.equal(r.W.dragon.dead,true);near(r.W.dragon.hoard,0);near(r.W.treasury,1800);r.audit();
  assert.equal((r.eval('W._flow')||{})['<wyrm hoard'],undefined);
  r.W.dragon.rebornAt=3;r.eval('tickDragon()');
  assert.equal(r.W.dragon.dead,undefined);near(r.W.dragon.hoard,500);near(r.eval("W._flow['<wyrm hoard']"),500);r.audit();
});

test('a forgotten vault is a recorded inflow from beyond the realm\'s reckoning',()=>{
  const r=world();const code=between("case 'gold':{","break;}");
  r.eval(`(function(){switch('gold'){${code}}})()`);
  near(r.W.treasury,6000);near(r.eval("W._flow['<forgotten vault']"),5000);r.audit();
});
test('debasing the coinage is gathered from those who hold the coin, not conjured',()=>{
  const r=world({cash:1000});Object.assign(r.C,{realmPop:()=>r.s.pop,inRevolt:()=>false});r.s.owner=0;
  r.eval(`(()=>{${between("{const tot=realmPop();for(const s of W.settlements)if(!inRevolt(s.owner))levy(s,1800*s.pop/Math.max(1,tot),'crown','debasement');}","}")}})()`);
  near(r.W.treasury,2800);near(r.H.reduce((t,h)=>t+h.w,0),6000-1800);r.audit();
});
test('the miller\'s fee to the lord is paid by the town\'s households in proportion to their means',()=>{
  const r=world({cash:100,gold:[0]});r.H[0].w=300;r.snap();
  r.eval("levy(s,150,W.houses[1],'justice')");
  near(r.W.houses[1].gold,150);near(r.H[0].w,300-150*300/800);r.audit();assert.equal(r.W.houses[1].led.justice,150);
});

// the crown's decrees pay their own cost to whoever it goes to
function decrees(extra={}){
  const r=world({gold:[0]});r.W.war={rebel:1};r.W.legitimacy=50;r.W.dragon={name:'Fafnir',state:'sleeping',hoard:100,lair:{x:0,z:0},dead:false};r.W.notables=[];r.snap();
  Object.assign(r.C,{clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),sendRiders:()=>{},endWar:()=>{r.W.war=null;},realmPop:()=>r.s.pop,inRevolt:()=>false,day:()=>1,chance:()=>false,emit:()=>{},killNotable:()=>{},
    raiseArmy:()=>({men:r.H.slice(0,2)}),...extra});
  r.eval(between('const DECREES=[','\n];').replace('const DECREES','globalThis.DECREES'));
  return {r,run:(k,c)=>r.eval(`DECREES.find(d=>d.k==='${k}').run(${c})`)};
}
test('decree: riders against the outlaws are paid from the treasury to the capital\'s households',()=>{
  const {r,run}=decrees();run('bounty',300);near(r.W.treasury,700);near(r.H.reduce((t,h)=>t+h.w,0),600+300);r.audit();
});
test('decree: the royal host\'s pay goes to the households its men come from',()=>{
  const {r,run}=decrees();run('host',1000);near(r.W.treasury,0);near(r.H[0].w,600);near(r.H[1].w,600);r.audit();
});
test('decree: a white peace is bought from the rebel house, tribute is carried to the wyrm, champions are paid as a host',()=>{
  const {r,run}=decrees();
  run('peace',400);near(r.W.treasury,600);near(r.W.houses[1].gold,400);assert.equal(r.W.war,null);r.audit();
  run('tribute',200);near(r.W.treasury,400);near(r.W.dragon.hoard,300);r.audit();
  run('hunt',250);near(r.W.treasury,150);near(r.H.reduce((t,h)=>t+h.w,0),600+250);r.audit();
});
test('decree: the royal feast is paid to the capital\'s crafts; the extraordinary tax is gathered, not conjured',()=>{
  const {r,run}=decrees();run('feast',200);near(r.W.treasury,800);near(r.s._poolCash,200);r.audit();
  const w=decrees();w.r.s.owner=0;w.run('levy',-300);near(w.r.W.treasury,1000+300);near(w.r.H.reduce((t,h)=>t+h.w,0),600-300);w.r.audit();
});

test('a petition\'s cost goes to the workmen where it was asked; a carried grant is held in escrow, not spent',()=>{
  const r=world({gold:[500]});trades(r,'mason');
  Object.assign(r.C,{nearestSettlementIdx:()=>0});r.eval(fn('runPetition'));
  r.C.p={to:1,pos:{x:0,z:0},opts:[{cost:100},{cost:60,escrow:true}]};
  r.eval('runPetition(p,0)');near(r.W.houses[1].gold,400);near(r.H[0].w,200);r.audit();
  r.eval('runPetition(p,1)');near(r.W.houses[1].gold,340);r.W._flow=r.W._flow||{};near(r.H[0].w,200); // (the 60 now rides with the envoys)
});

test('the monthly watch is paid by the lord to the households of its men, with the ledger entry',()=>{
  const r=world({gold:[900]});r.s.owner=1;r.s.garrison=0;r.s.pop=500;
  Object.assign(r.C,{day:()=>11,garrisonNeed:()=>100,PL:()=>1});r.eval(fn('tickGarrisons')+'tickGarrisons()');
  const k=Math.min(100*0.25,500*0.01),cost=k*1.5;near(r.W.houses[1].gold,900-cost);near(r.H.reduce((t,h)=>t+h.w,0),600+cost);near(r.W.houses[1].led.garrisons,-cost);r.audit();
});

test('a robbed caravan\'s goods are sold for the outlaw household that took them, and the silver stays in the realm',()=>{
  const r=world({cash:100});r.eval("s.mkt.grain.clear();offer(s,'grain','one',10);storageInit(s);purchase(s,'grain',H[0],10);const c={good:'grain',qty:purchase.got,m:H[0],dest:1,origin:0};storageCargoOut(c,s);const d={name:'fence',owner:0,pos:{x:100,z:0},stores:{grain:0},buildings:[],_owners:new Map(),px:{grain:1}};W.settlements.push(d);storageTitles(s)");
  const stolen=r.C.stolen=r.eval('storageCargoRaid(c,d,H[2])');near(stolen,6);r.eval("offer(d,'grain',H[2],stolen)");
  assert.ok(r.eval("[...d.storage.lots.values()].every(l=>l.owner===accountOwner(H[2]))"));
  const before=r.purses();
  r.eval("purchase(d,'grain',H[3],4)");const paid=r.eval('purchase.got')*r.eval("price(d,'grain')");
  near(r.purses(),before);assert.ok(paid>0);near(r.H[2].w,100+paid);near(r.H[3].w,100-paid);assert.ok(!Object.keys(r.W._flow||{}).some(k=>k[0]==='>'),'no import flow: the thief is not abroad');
});
test('robbery by a camp with live men gives the goods to one of their households; with none abroad, to the fence beyond the realm',()=>{
  const tick=source.slice(source.indexOf('function tickBandits(dis)'),source.indexOf('function wakeDragon('));
  for(const [men,owner] of [[true,'thief'],[false,'out']]){
    const r=world({cash:100});const thief=r.H[1];thief.outlawCampId=7;
    const camp={id:7,x:0,z:0,raids:0,born:1,men:men?[thief]:[{dead:true}],nextRecruit:99};
    const caravan={sea:false,river:false,robbed:false,poly:[{x:0,z:0}],departDay:0,arriveDay:30,origin:0,dest:0,qty:10,good:'grain',value:20};
    r.W.banditCamps=[camp];r.W.caravans=[caravan];r.W.settlements[0].unrest=0;r.W.war=false;r.s.stores.grain=0;
    let n=0;Object.assign(r.C,{day:()=>10,chance:()=>++n===2,MOD:{bandit:1},G:{campMeshes:new Map()},markCampDisplaysDirty(){},scene:{remove(){}},nearestSettlementIdx:()=>0,dist2d:()=>0,polyPos:()=>({x:0,z:0}),OUTLAW_MAX:12,
      outlawCampEnds:()=>{},recruitBandit:()=>{},commodityActive:()=>false,storageCargoRaid:()=>0,householdHead:p=>p});
    r.eval(tick+'tickBandits(0)');
    assert.equal(camp.raids,men?1:0);
    if(men){near(r.eval("mkt(s,'grain').get(H[1])"),6);near(r.s.stores.grain,6);}
  }
});

// the guard: no routine pays out money it has not taken from someone
test('no routine pays households, builders or soldiers from nowhere',()=>{
  const ast=parse(inlineGameScript(source),{ecmaVersion:'latest',sourceType:'script',locations:true,allowHashBang:true}),bad=[],names=new Set(['wages','payAmong','buildWorks','soldiersPay','transfer']);
  const nobody=a=>!a||a.type==='Literal'&&a.value===null||a.type==='Identifier'&&a.name==='undefined'||a.type==='Literal'&&a.value===0;
  const walk=n=>{if(!n||typeof n.type!=='string')return;
    if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&names.has(n.callee.name)){const f=n.callee.name,A=n.arguments;
      if(f==='wages')bad.push(n.loc.start.line+': wages() debits nobody');
      else if(f==='transfer'){if(nobody(A[0]))bad.push(n.loc.start.line+': transfer from nobody');}
      else if(f==='payAmong'||f==='buildWorks'){if(nobody(A[2]))bad.push(n.loc.start.line+': '+f+' without a payer');}
      else if(f==='soldiersPay'&&nobody(A[2]))bad.push(n.loc.start.line+': soldiersPay without a payer');}
    for(const[k,v]of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v);}};
  walk(ast);
  assert.deepEqual(bad,[]);
});
