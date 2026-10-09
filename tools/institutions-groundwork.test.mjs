// The institutions' groundwork (#35-#43): abbeys and guilds as owners of their own, offices on household heads, the 'inst'
// dice, lords' whereabouts and a place's rolls. Nothing in the game founds, appoints, throws or moves with them yet; these run
// the game's own functions in a small realm and hold each piece to its contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {moneyFlowGap} from './money-flow.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^let |^/\\*|$(?![\\s\\S]))','m'))?.[0]||assert.fail('no function '+n);
const line=n=>source.match(new RegExp('^const '+n+'=.*$','m'))?.[0]||assert.fail('no const '+n);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const PROGRAM=[fn('sfc32'),fn('seedStreams'),line('isCorp'),line('isHouse'),line('OFFICES'),line('ROLL_N'),
  ...['lordAcct','houseAcct','corpFound','corpOf','cashRecord','acct','flow','transfer','unearned','means','book','ownerOf','ownerAcct','storageOwnerId',
    'houseName','lordSeat','lordAt','officeHeld','officeTitle','rollOf','rollAdd','rollTake','accountBalances'].map(fn)].join('\n');

// a realm of three places: the capital (the crown's), a lord's seat and a village of his; one household with a purse
function realm(){
  const places=[{name:'Rougecastel',owner:0,buildings:[],pos:{x:0,z:0}},{name:'Gamsburg',owner:1,buildings:[],pos:{x:1,z:0}},{name:'Ashby',owner:1,buildings:[],pos:{x:2,z:0}}];
  const W={treasury:1000,houses:[{crown:true,name:'House Rougemont'},{name:'House Gamsburg',gold:500,seat:1}],settlements:places,capital:places[0]};
  const C=vm.createContext({W,D:100,BEASTS:['sheep','cattle','horses','swine'],householdAccount:p=>p._hh||null,folkIndex:()=>new Map(),parishOf:()=>null,chOf:()=>null});
  vm.runInContext('"use strict";\nconst day=()=>D,year=()=>Math.floor(D/360)+1;\n'+PROGRAM,C);
  const household={household:true,id:7,assets:{w:50}};C.household=household;W.households=new Map([[7,household]]);
  const run=s=>vm.runInContext(s,C);
  const purses=()=>W.treasury+W.houses.reduce((t,h)=>t+(h.gold||0),0)+household.assets.w+[...(W.abbeys||[]),...(W.guilds||[])].reduce((t,c)=>t+c.gold,0);
  return {W,C,run,household,purses};
}

test('nothing is founded or kept on the world until a first abbey or guild is',()=>{
  const r=realm(),before=JSON.stringify(r.W);
  r.run(`lordAt(1);lordAt(0);officeTitle({gn:'Wat',office:'steward',officeFor:1,si:1});isHouse(W.houses[1]);isHouse(household);corpOf('lord');
    ownerAcct({ownerId:'lord',s:W.settlements[2]},W.settlements[2]);accountBalances();accountBalances(W.settlements[1])`);
  assert.equal(JSON.stringify(r.W),before);assert.ok(!('abbeys' in r.W)&&!('guilds' in r.W));
  assert.ok(!('abbeys' in r.run('accountBalances().by'))&&!('guilds' in r.run('accountBalances().by')));
});

test('an abbey and a guild are records with chests of their own, which start empty',()=>{
  const r=realm(),a=r.run("globalThis.a=corpFound('abbey',{name:'Rievaulx',si:2,order:'cistercian',gold:9999})"),g=r.run("globalThis.g=corpFound('guild',{name:'the weavers of Rougecastel',si:0,trade:'weaver'})");
  assert.equal(a.gold,0);assert.equal(g.gold,0);assert.equal(a.kind,'abbey');assert.equal(a.id,0);assert.equal(g.id,0);assert.equal(r.W.abbeys[0],a);assert.equal(r.W.guilds[0],g);
  assert.equal(r.run("corpFound('abbey',{name:'Fountains',si:1}).id"),1);
  assert.equal(r.run('storageOwnerId(a)'),'abbey:0');assert.equal(r.run('storageOwnerId(g)'),'guild:0');assert.equal(r.run('storageOwnerId(W.abbeys[1])'),'abbey:1');
  assert.equal(r.run("corpOf('abbey:0')"),a);assert.equal(r.run("corpOf('guild:0')"),g);for(const k of ["'abbey:9'","'lord'","'church'","5","null"])assert.equal(r.run(`corpOf(${k})`),null);
  assert.throws(()=>r.run("corpFound('priory',{})"));
  // a record keeps a book as a house does; a stray object shaped like one does not
  assert.equal(r.run('isHouse(a)&&isHouse(g)&&isHouse(W.houses[1])'),true);assert.equal(r.run("isHouse({kind:'abbey',id:0})||isHouse(household)||isHouse('crown')"),false);
});

test('coin moves to and from an abbey and a guild through the flow book, with nothing minted or lost',()=>{
  const r=realm(),{W}=r;r.run("globalThis.a=corpFound('abbey',{name:'Rievaulx',si:2});globalThis.g=corpFound('guild',{name:'the weavers of Rougecastel',si:0})");
  const p0=r.purses(),f0={...(W._flow||{})},paid=r.run(`[transfer(W.houses[1],a,120,'endowment'),transfer('crown',a,30,'alms'),transfer(a,g,20,'wool'),transfer(household,g,5,'entry fine'),
    transfer(g,'out',4,'feast wine'),transfer('out',a,60,'wool'),transfer(a,household,1000,'wages'),transfer(g,a,0,'nothing')]`);
  assert.deepEqual([...paid],[120,30,20,5,4,60,190,0]); // the abbey pays its servants only what its chest holds: 120+30-20+60
  const gap=moneyFlowGap(f0,W._flow);near(r.purses()-p0-gap.expect,0);assert.equal(gap.mintT,0);assert.ok(!('<>lost' in W._flow));
  assert.equal(W._flow['>feast wine'],4);assert.equal(W._flow['<wool'],60);
  near(r.run('means(a)'),0);near(r.run('means(g)'),21);near(W.houses[1].gold,380);near(W.treasury,970);near(r.household.assets.w,235);
  assert.deepEqual(JSON.parse(JSON.stringify(r.run('a.led'))),{endowment:120,alms:30,wool:40,wages:-190});assert.deepEqual(JSON.parse(JSON.stringify(r.run('g.ledY'))),{wool:20,'entry fine':5,'feast wine':-4});
  assert.equal(W.houses[1].led.endowment,-120);
  near(r.run('a._inc'),210);r.run('unearned(a,10)');near(r.run('a._inc'),200); // a loan to it is no earning, as for a house
});

test('the money census holds each chest once, and a town sheet only its own',()=>{
  const r=realm();r.run("globalThis.a=corpFound('abbey',{name:'Rievaulx',si:2});globalThis.g=corpFound('guild',{name:'the weavers',si:0});transfer('crown',a,40,'alms');transfer('crown',g,15,'charter')");
  const B=r.run('accountBalances()');near(B.by.abbeys,40);near(B.by.guilds,15);near(B.total,r.purses());
  const T=r.run('accountBalances(W.settlements[2])');near(T.by.abbeys,40);near(T.by.guilds,0);
});

test('a building an abbey or guild owns pays it; once it is gone the lord takes the place',()=>{
  const r=realm(),{W}=r;r.run("globalThis.a=corpFound('abbey',{name:'Rievaulx',si:2})");
  const b={ownerId:'abbey:0',s:W.settlements[2]};r.C.b=b;
  assert.equal(r.run('ownerOf(b)'),'abbey:0');assert.equal(r.run('ownerAcct(b,b.s)'),r.run('a'));
  r.run('a.gone=true');assert.equal(r.run('ownerAcct(b,b.s)'),W.houses[1]);
  b.ownerId='lord';assert.equal(r.run('ownerAcct(b,b.s)'),W.houses[1]);
});

test("the 'inst' dice leave the other streams as they were",()=>{
  const r=realm(),S=(seed,fate)=>r.run(`seedStreams(${seed},${fate})`),draws=(f,n)=>Array.from({length:n},()=>Math.round(f()*4294967296));
  // the first throws of each stream for seed 1001, fate 42 (and no fate), as the build before the 'inst' stream threw them
  const R=S(1001,42),L=S(1001,0);assert.deepEqual(Object.keys(R),['gen','sim','folk']);
  assert.deepEqual(draws(R.gen,3),[915658401,496732802,2173431817]);assert.deepEqual(draws(R.sim,3),[3211277987,542677763,1724584325]);assert.deepEqual(draws(R.folk,3),[2237416583,617335040,1941257057]);
  assert.deepEqual(draws(L.sim,3),[3822183677,4193204706,4242719957]);assert.deepEqual(draws(L.folk,3),[457697201,3138293128,1232118818]);
  // throwing from 'inst' between the others' throws changes none of theirs
  const A=S(1001,42),B=S(1001,42),fresh=JSON.stringify(A.inst.state());
  for(let i=0;i<200;i++)for(const k of ['gen','sim','folk']){A.inst();assert.equal(A[k](),B[k]());}
  assert.notEqual(JSON.stringify(A.inst.state()),fresh);assert.equal(JSON.stringify(B.inst.state()),fresh);
  // it joins the reckoning (Object.entries(RS): digests, the history archive) at its first throw, and not before
  assert.deepEqual(Object.keys(A),['gen','sim','folk','inst']);assert.deepEqual(Object.keys(B),['gen','sim','folk']);
  // its own throws are its own: unlike the others', and unlike another fate's
  const I=draws(S(1001,42).inst,8),O=S(1001,42);for(const k of ['gen','sim','folk'])assert.notDeepEqual(draws(O[k],8),I);
  assert.notDeepEqual(draws(S(1001,43).inst,8),I);assert.deepEqual(draws(S(1001,42).inst,8),I);
  // a saved state put back through restore() joins it too, and goes on as the stream it was saved from
  const C=S(1001,42);C.inst.restore(A.inst.state());assert.deepEqual(Object.keys(C),['gen','sim','folk','inst']);assert.deepEqual(draws(C.inst,5),draws(A.inst,5));
});

test('a lord is at his seat until a stay elsewhere is set, and back there when it runs out',()=>{
  const r=realm(),{W}=r,at=hi=>r.run(`lordAt(${hi})`);
  assert.equal(at(0),0);assert.equal(at(1),1);assert.equal(r.run('lordSeat(1)'),1);
  W.houses[1].at={si:0,until:130,why:'court'};assert.equal(at(1),0);r.C.D=130;assert.equal(at(1),1);
  W.houses[1].at={si:0,why:'war'};assert.equal(at(1),0); // no end set: there till he leaves
  W.houses[1].at={si:9,until:999,why:'court'};assert.equal(at(1),1); // no such place
  delete W.houses[1].at;W.settlements[1].owner=0;assert.equal(at(1),2); // the seat lost: the first place it still holds
  W.settlements[2].owner=0;assert.equal(at(1),-1);assert.equal(at(5),-1);
  W.houses[0].at={si:2,until:200,why:'parliament'};assert.equal(at(0),2);
});

test('a head may hold an office; it lapses with him and names whom he serves',()=>{
  const r=realm(),t=p=>r.run(`officeTitle(${JSON.stringify(p)})`);r.run("corpFound('guild',{name:'the weavers of Rougecastel',si:0})");
  assert.equal(t({gn:'Wat',office:'steward',officeFor:1,si:1}),'steward of House Gamsburg');assert.equal(t({gn:'Hugh',office:'collector',officeFor:0,si:2}),'collector of the crown');
  assert.equal(t({gn:'Ralf',office:'warden',officeFor:'guild:0',si:0}),'warden of the weavers of Rougecastel');assert.equal(t({gn:'Odo',office:'moneyer',si:0}),'moneyer of Rougecastel');
  assert.equal(t({gn:'Ivo',office:'master',si:2}),'schoolmaster of Ashby');
  assert.equal(t({gn:'Wat',office:'steward',officeFor:1,si:1,dead:true}),null);assert.equal(t({gn:'Tom',office:'jester',si:1}),null);assert.equal(t({gn:'Tom',si:1}),null);
  assert.equal(r.run("officeHeld({office:'constructor'})"),null);
});

test('a roll keeps its last rows and counts by kind what it dropped',()=>{
  const r=realm(),s={name:'Ashby'};r.C.s=s;
  assert.equal(r.run("rollOf(s,'pleas')"),s.pleas);assert.deepEqual(JSON.parse(JSON.stringify(s.pleas)),{rows:[],over:{}});
  r.run("for(let i=0;i<70;i++)rollAdd(rollOf(s,'pleas'),{kind:i%3?'debt':'trespass',sum:i,day:i},64)");
  assert.equal(s.pleas.rows.length,64);assert.equal(s.pleas.rows[0].day,6);assert.equal(s.pleas.rows.at(-1).day,69);assert.deepEqual({...s.pleas.over},{trespass:2,debt:4});
  r.run("for(let i=0;i<20;i++)rollAdd(rollOf(s,'alms'),{day:i})");assert.equal(r.run('ROLL_N'),12);assert.equal(s.alms.rows.length,12);assert.equal(s.alms.over[''],8);
  const taken=r.run("rollTake(s.pleas)");assert.equal(taken.rows.length,64);assert.equal(s.pleas.rows.length,0);assert.deepEqual({...s.pleas.over},{});
  const court={next:0};r.C.court=court;r.run("rollAdd(rollOf(court,'pleas'),{kind:'debt'})");assert.equal(court.pleas.rows.length,1);
});

test("the identity capture names an abbey's and a guild's goods by their keys, apart from people and each other",async()=>{
  const {captureExpression}=await import('./simulation-boundary.mjs'),own=captureExpression().split('\n').find(l=>l.trim().startsWith('const own='))||assert.fail('no own()');
  const r=realm();r.run("globalThis.a=corpFound('abbey',{name:'Rievaulx',si:2});globalThis.g=corpFound('guild',{name:'the weavers',si:0})");
  assert.deepEqual([...r.run(own+';[own(a),own(g),own({gn:"Wat",id:0}),own(W.houses[1])]')],['abbey:0','guild:0','entity:0','house:1']);
});
