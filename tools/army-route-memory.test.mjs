import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
// The route memory (armyRouteRecall) gives a host's land search again only while everything the search read is
// unchanged. These tests run the game's own search and memory, with the memory checking every recall against a
// fresh search (ARMY_ROUTES.verify), over a small world changed at random in every way the search can see.
const html=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const m=html.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^/\\*|$(?![\\s\\S]))','m'));assert.ok(m,name);
  return m[0].replace(/(?:\n(?:\s*\/\/[^\n]*)?)+$/,'');}; // the function, without the comment lines that follow it
const line=prefix=>{const i=html.indexOf('\n'+prefix);assert.ok(i>=0,prefix);return html.slice(i+1,html.indexOf('\n',i+1));};
const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,16);

// Everything a host's land search reads goes through these. armyRouteRead copies what they read; a change to any of
// them must be matched there (and its purity kept: the copy calls fortGateAngles, wallGates, hostileTo and wallProg).
const READS=['armyLandPath','armySegmentClear','armyDetour','armyObstacle','armyCauseway','armyRaftAt','armyBridgeAt','paidRoadAt','onRoad','riverAt','makeHash','hAt',
  'fortGround','fortSurface','motteSurface','fortCircuits','casRing','fortCenter','wallRadAt','wallKindAt','wallBuilt','wallProg','wallDmgAt','fortGateAngles','wallGates',
  'hostileTo','atWar','inRevolt','inPoly','segDist'];
const HELPERS=['const lerp=','const clamp=','const dist2d=','const cIdx=','const inB=','const toCell=','const sstep='];
// Repinned 6 October 2026: armyLandPath hands the log's list to armyDetour, which notes the nodes it expanded (the route memory's
// buildings test). Neither reads anything new; their search is unchanged.
// makeHash repinned (#15): its body is unchanged; the pinned text now reaches HASH_BOUNDS, declared after it for lot settlement.
// armyObstacle repinned (#29): a `ghost` footprint (a mill site being surveyed) blocks like a building. Only service walkers carry one,
// and they carry a settlement, `placed` and `_em`, so armyLandPath never hands them to the memory; a host's search reads nothing new.
// Repinned again: a host's bridge test (armyBridgeAt, paidRoadAt, onRoad's riverPad) reaches its fording clearance past the water's edge,
// as its water test does (armyObstacle, armySegmentClear). It reads the same river and road lines, within the cells the copy holds.
// onRoad's segment skip is untouched by riverPad: riverPad widens only the river test at the road's nearest point, not the 5 m reach.
// Repinned again: armyObstacle asks armyCauseway (new, onRoad) before calling low ground by the sea water: a road the
// realm built carries a host where it runs. The copy already holds the roads' bounds and lines it reads.
const PINNED={"armyLandPath":"7a2da4e68f08e3f5","armySegmentClear":"063c5c5b0ab4fa9c","armyDetour":"8d6cba39d5afdd97","armyObstacle":"a3cc45a2978fe7c8","armyCauseway":"a62d18760d6f09bc","armyRaftAt":"f314e81a2aca7bd3","armyBridgeAt":"178b48fe1967e31a","paidRoadAt":"e0fdaec86dbbd2fe","onRoad":"ea3162c62b7bd93a","riverAt":"c4bda44c2b489b2e","makeHash":"df390d3239378d38","hAt":"f459c5ff2804ca09","fortGround":"3536cbafb7ccdc5a","fortSurface":"6277e0cf9adcbe38","motteSurface":"90120ef2ced40e8e","fortCircuits":"e77dd39eccb4abc1","casRing":"a6921fd1103e167c","fortCenter":"70fbd07bf1bf54a1","wallRadAt":"fbbec3db03bd0ce6","wallKindAt":"fb3d95f598b7b8e5","wallBuilt":"c8fd76feaf0dac34","wallProg":"67b50b3b042c425b","wallDmgAt":"0ec2325c7d2a1ce4","fortGateAngles":"e054c476fb7e3624","wallGates":"66ae4de110791e54","hostileTo":"dac2f7053f0303fb","atWar":"f7f1457aa7b9b2a2","inRevolt":"4b1beb090e61d7d1","inPoly":"abebffb4a9abafff","segDist":"01b34b3baef31aff","helpers":"005d5b927de2876f"};
test('the search the route memory copies is the one reviewed with it',()=>{
  const now=Object.fromEntries([...READS.map(n=>[n,sha(fn(n))]),['helpers',sha(HELPERS.map(line).join('\n'))]]);
  assert.deepEqual(now,PINNED,'A function the host search reads has changed: make armyRouteRead read what it now reads, then repin.');
});

const MEMORY=['armyRouteRecall','armyRouteBounds','armyRouteVerify','armyRouteReplay','armyRouteKey','armyRouteSameKey','armyRouteSameRead','armyRouteSameBuildings','routeCellTouch','routeTouch','routeShutPack','armyRouteRead','roadBounds','routeSettlement','routeHas','routeMark','routeCell','routeList','routeW'];
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
// A 1.2 km square: two places, the west one (where lakes and mottes come and go) and a small walled town east of
// a broad river that only a road bridge or a raft can cross; a host on the west bank.
function realm(mode){ // 'off', 'on', or 'verify' (each recall checked against a fresh search)
  const c=vm.createContext({console});
  vm.runInContext(`const SIZE=1200,GRID=44,CELL=SIZE/GRID,SEA_SURFACE=0.5,MOTTEH=9,BACKGROUND=null;let W=null;const day=()=>W.clock.day;`,c);
  vm.runInContext([...HELPERS.map(line),line('let HASH_STAMP='),...READS.map(fn),line('const ARMY_ROUTES='),line('let ROUTE_READ='),...MEMORY.map(fn)].join('\n'),c);
  vm.runInContext(`ARMY_ROUTES.on=${mode!=='off'};ARMY_ROUTES.verify=${mode==='verify'};
    W={clock:{day:100},war:null,feuds:[],h:new Float32Array(GRID*GRID).fill(10),dom:new Int16Array(GRID*GRID),rivHash:makeHash(40),roads:[],settlements:[],armies:[]};
    for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++)W.dom[j*GRID+i]=i<GRID/2?0:1;
    const town=(x,z,owner)=>({pos:{x,z},owner,pop:300,streets:[],buildings:[],_lay:{placed:makeHash(16)}});
    W.settlements.push(town(-300,0,0),Object.assign(town(120,60,1),{wallRad:new Float32Array(144).fill(25),wallR:25,wallKind:new Uint8Array(144),_gates:[0,Math.PI],_gatesK:'0:25:0'}));
    for(let z=-700;z<700;z+=40){const o={a:{x:0,z},b:{x:0,z:z+40},hw:9.5,y:9,x:0,z};W.rivHash.add(o,40+10);}
    W.roads.push({a:0,b:1,path:[{x:-120,z:200},{x:120,z:200}]});
    globalThis.host={id:1,name:'Host of Test',house:0,side:'crown'};W.armies.push(host);
    globalThis.addBuilding=(si,x,z,w,d,rot)=>{const s=W.settlements[si],b={x,z,w,d,rot,state:'sound',arch:'house'};s.buildings.push(b);s._lay.placed.add(b,Math.hypot(w,d)/2);return b;};
    globalThis.march=(P,fresh)=>{const Q=fresh?P.map(p=>({...p})):P,out=armyLandPath(host,Q);
      return JSON.stringify(out&&out.map(q=>[q.x,q.z,Q.indexOf(q)]));};
    globalThis.bounds=()=>JSON.stringify(W.roads.map(r=>r._bb||null));`,c);
  return c;
}
const ROUTES=[[{x:-60,z:150},{x:60,z:150}],[{x:-200,z:-20},{x:-60,z:150},{x:60,z:150},{x:220,z:140}],[{x:-90,z:240},{x:-20,z:200},{x:40,z:180}],[{x:-150,z:-200},{x:-30,z:-150}],[{x:60,z:60},{x:180,z:60}]]; // the last goes through the walled town by its gates
// Each change is code run alike in both realms, with the random choices made here.
const CHANGES=[
  r=>`addBuilding(0,${-40+r()*30|0},${150+r()*80|0},${4+r()*6|0},${4+r()*6|0},${r().toFixed(2)})`,
  r=>`{const B=W.settlements[0].buildings;if(B.length){const b=B[${r()*1e6|0}%B.length];${['b.removed=true','b.state="gone"','b.arch="churchyard"','b.rot+=0.5','b.state="ruin"'][r()*5|0]};}}`,
  r=>`W.h[${r()*44*44|0}]+=${r()<.5?-3:4}`,
  r=>`W.h[${(27+(r()*5|0))*44+19+(r()*5|0)}]=${r()<.5?14:10}`, // the ground by the bridge
  r=>`W.dom[${(10+(r()*20|0))*44+18+(r()*8|0)}]=${r()<.5?0:1}`,
  r=>`W.feuds=${r()<.5?'[]':'[{a:0,b:1}]'}`,
  r=>`{const s=W.settlements[1];s.wallDmg=s.wallDmg||new Float32Array(144);s.wallDmg[${r()*144|0}]=${r().toFixed(2)};}`,
  r=>`W.settlements[1].wallBuild=${r()<.3?'null':`{start:${90+(r()*20|0)},days:30,a0:${(r()*6).toFixed(2)}}`}`,
  r=>`W.clock.day+=${1+(r()*20|0)}`,
  r=>`host.raft=${r()<.4?'null':`{a:{x:-15,z:${150+(r()*20|0)}},b:{x:15,z:${150+(r()*20|0)}},hw:1.8,y:9.25,readyDay:${100+(r()*30|0)}}`}`,
  r=>`host.waterClearance=${[0.4,0.2,1,undefined][r()*4|0]}`,
  r=>`W.roads.push({a:0,b:1,path:[{x:-120,z:${100+(r()*120|0)}},{x:120,z:${100+(r()*120|0)}}]})`,
  r=>`if(W.roads.length)W.roads.splice(${r()*1e6|0}%W.roads.length,1)`,
  r=>`if(W.roads.length)W.roads[${r()*1e6|0}%W.roads.length]._bb=null`,
  r=>`if(W.roads.length){const R=W.roads[${r()*1e6|0}%W.roads.length];R.open=[{x:-120,z:${120+(r()*100|0)}},{x:120,z:${120+(r()*100|0)}}];${r()<.5?'R._bb=null;':''}}`, // left stale, as the game may leave it
  r=>`W.settlements[0].lake=${r()<.4?'null':`{y:12,poly:[{x:-60,z:${120+(r()*40|0)}},{x:-20,z:${120+(r()*40|0)}},{x:-20,z:250},{x:-60,z:250}]}`}`,
  r=>`W.settlements[0].motte=${r()<.4?'null':`{x:${-60+(r()*30|0)},z:${160+(r()*60|0)},r:${12+(r()*8|0)},gateA:${(r()*6).toFixed(2)}}`}`,
  r=>`W.settlements[1].owner=${[1,0,2][r()*3|0]}`,
  r=>`{const o={a:{x:${-60+(r()*40|0)},z:${100+(r()*60|0)}},b:{x:${-60+(r()*40|0)},z:${200+(r()*60|0)}},hw:4,y:12,x:0,z:0};o.x=o.a.x;o.z=o.a.z;W.rivHash.add(o,140);}`, // a deep canal dug
  r=>`W.war=${r()<.5?'null':'{rebel:1}'};host.house=${r()<.8?0:1}`,
  r=>`host.requireRoadCrossing=${r()<.15}`,
];
test('the memory gives the same paths and road bounds as fresh searches, through every kind of change',()=>{
  const off=realm('off'),on=realm('on'),r=rng(20261006);
  for(let step=0;step<42;step++){
    if(step%3===0){const code=CHANGES[r()*CHANGES.length|0](r);for(const c of[off,on])vm.runInContext(code,c);}
    const k=r()*ROUTES.length|0,fresh=r()<.5,P=JSON.stringify(ROUTES[k]);
    assert.equal(vm.runInContext(`march(${P},${fresh})`,on),vm.runInContext(`march(${P},${fresh})`,off),`step ${step}, route ${k}`);
    assert.equal(vm.runInContext('bounds()',on),vm.runInContext('bounds()',off),`road bounds at step ${step}`);
  }
  const stats=JSON.parse(vm.runInContext('JSON.stringify({hits:ARMY_ROUTES.hits,misses:ARMY_ROUTES.misses,kept:ARMY_ROUTES.kept})',on));
  assert.ok(stats.hits>=10&&stats.misses>=10,'the memory was both used and refreshed: '+JSON.stringify(stats));
});
// One change of each kind the search can see, made after an answer is remembered: the next answer must be the fresh one.
const S0=JSON.stringify(ROUTES[0]),S1=JSON.stringify(ROUTES[1]),S4=JSON.stringify(ROUTES[4]),FAR=JSON.stringify([{x:-60,z:60},{x:60,z:60}]),HOSTILE='W.feuds=[{a:0,b:1}]',NOBRIDGE='W.roads.length=0',BLOCK='globalThis.B=addBuilding(0,-15,190,8,8,0)';
const SCENES=[ // what, setup, route, change, whether the answer must change ('kept': the memory still answers)
  ['a building on the way','',S0,'addBuilding(0,-15,190,8,8,0)',true],
  ['a building pulled down',BLOCK,S0,'B.state="gone"',true],
  ['a building on a straight stretch, away from the search boxes','',S1,'addBuilding(0,-193,-12,6,6,0)',true],
  ['a building far from the straight line, in the search box','',FAR,'addBuilding(0,-10,188,6,6,0)',true],
  ['a building taken down',BLOCK,S0,'B.removed=true',true],
  ['a building made a churchyard',BLOCK,S0,'B.arch="churchyard"',true],
  ['a building turned',BLOCK,S0,'B.rot=0.7',false],
  ['a building raised in the search box, clear of every point the search tested','',S0,'addBuilding(0,-150,100,6,6,0.3)','kept'],
  ['a building raised beside the way the search went, the way unchanged','',FAR,'addBuilding(0,-40,100,6,6,0.3)',false],
  ['the ground under a building passing to another place',BLOCK,S0,'for(let j=26;j<=31;j++)for(let i=19;i<=23;i++)W.dom[j*44+i]=1',true],
  ['ground sunk below the sea','',S0,'for(let j=28;j<=30;j++)for(let i=20;i<=21;i++)W.h[j*44+i]=0',true],
  ['ground raised to a bank','',S0,'W.h[29*44+21]=16',false],
  ['the domain line moves',HOSTILE,S4,'for(let j=0;j<44;j++)for(let i=22;i<44;i++)W.dom[j*44+i]=0',true],
  ['peace made',HOSTILE,S4,'W.feuds=[]',true],
  ['the town changes hands',HOSTILE,S4,'W.settlements[1].owner=0',true],
  ['a rising ends','W.war={rebel:1}',S4,'W.war=null',true],
  ['the host changes sides','W.war={rebel:1}',S4,'host.house=1',true],
  ['a breach',HOSTILE,S4,'W.settlements[1].wallDmg=new Float32Array(144).fill(0.7)',true],
  ['a breach mended',HOSTILE+';W.settlements[1].wallDmg=new Float32Array(144).fill(0.7);W.settlements[1].wallDmg.fill(0.6,0,72)',S4,'W.settlements[1].wallDmg.fill(0.6)',true],
  ['walls half built',HOSTILE,S4,'W.settlements[1].wallBuild={start:95,days:30,a0:Math.PI/2}',true],
  ['walls rising day by day',HOSTILE+';W.settlements[1].wallBuild={start:100,days:30,a0:0}',S4,'W.clock.day+=40',true],
  ['the gates moved','W.settlements[1]._gates=[Math.PI/2]',S4,'W.settlements[1]._gates=[0,Math.PI]',true],
  ['a water front without wall',HOSTILE,S4,'W.settlements[1].wallKind.fill(1)',true],
  ['a raft made ready',NOBRIDGE+';host.raft={a:{x:-15,z:150},b:{x:15,z:150},hw:1.8,y:9.25,readyDay:130}',S0,'W.clock.day=130',true],
  ['a raft lashed',NOBRIDGE,S0,'host.raft={a:{x:-15,z:150},b:{x:15,z:150},hw:1.8,y:9.25,readyDay:100}',true],
  ['a deeper ford kept from',  '',S0,'host.waterClearance=3',true],
  ['road crossings only','',S0,'host.requireRoadCrossing=true',false],
  ['a bridge built',NOBRIDGE,S0,'W.roads.push({a:0,b:1,path:[{x:-120,z:120},{x:120,z:120}]})',true],
  ['a bridge gone','',S0,'W.roads.length=0',true],
  ['the bounds of a road cleared','',S0,'W.roads[0]._bb=null','kept'], // nothing the search reads has changed: the memory answers, and stores the bounds again as the search does
  ['the stored bounds of a road gone stale','',S0,'W.roads[0]._bb=[-120,100,120,100]',true],
  ['a road rerouted, its bounds cleared','',S0,'W.roads[0].open=[{x:-120,z:100},{x:120,z:100}];W.roads[0]._bb=null',true],
  ['a road rerouted, its bounds left stale','',S0,'W.roads[0].open=[{x:-120,z:100},{x:120,z:100}]',true],
  ['a lake rising','W.settlements[0].lake={y:8,poly:[{x:-40,z:170},{x:-12,z:170},{x:-12,z:230},{x:-40,z:230}]}',S0,'W.settlements[0].lake.y=12',true],
  ['a lake','',S0,'W.settlements[0].lake={y:12,poly:[{x:-40,z:170},{x:-12,z:170},{x:-12,z:230},{x:-40,z:230}]}',true],
  ['a motte moved','W.settlements[0].motte={x:-24,z:300,r:12,gateA:0}',S0,'W.settlements[0].motte.z=200',true],
  ['a motte','',S0,'W.settlements[0].motte={x:-24,z:200,r:12,gateA:0}',true],
  ['a ford deepened','{globalThis.F={a:{x:-40,z:170},b:{x:-40,z:230},hw:4,y:9,x:-40,z:170};W.rivHash.add(F,70);}',S0,'F.y=12',true],
  ['a canal','',S0,'{const o={a:{x:-40,z:170},b:{x:-40,z:230},hw:4,y:12,x:-40,z:170};W.rivHash.add(o,70);}',true],
];
for(const [what,setup,P,change,differs] of SCENES)test('the memory sees '+what,()=>{
  const off=realm('off'),on=realm('on'),check=realm('verify'),ask=c=>vm.runInContext(`march(${P},true)`,c),count=c=>JSON.parse(vm.runInContext('JSON.stringify([ARMY_ROUTES.hits,ARMY_ROUTES.kept])',c));
  for(const c of[off,on,check])vm.runInContext(setup,c);
  const first=ask(off);for(const c of[on,check]){assert.equal(ask(c),first);assert.deepEqual(count(c),[0,1],'the answer needed a detour search, so it is kept');}
  for(const c of[on,check]){assert.equal(ask(c),first);assert.deepEqual(count(c),[1,1],'and given again');}
  for(const c of[off,on,check])vm.runInContext(change,c);
  const after=ask(off);for(const c of[on,check]){assert.equal(ask(c),after);assert.equal(count(c)[0],differs==='kept'?2:1,differs==='kept'?'the memory answers':'a fresh search');}
  if(differs===true)assert.notEqual(after,first,'the change alters the way');
  for(const c of[on,check])assert.equal(vm.runInContext('bounds()',c),vm.runInContext('bounds()',off));
});
test('a route opens at once when a bridge is built, and far changes keep the memory',()=>{
  const c=realm('verify'),P=JSON.stringify([{x:-60,z:-150},{x:60,z:-150}]),stats=()=>JSON.parse(vm.runInContext('JSON.stringify([ARMY_ROUTES.hits,ARMY_ROUTES.misses])',c));
  assert.equal(vm.runInContext(`march(${P},true)`,c),'null','no crossing near');
  assert.equal(vm.runInContext(`march(${P},true)`,c),'null');assert.deepEqual(stats(),[1,1],'the second asking is remembered');
  vm.runInContext('W.h[40*44+40]+=5;addBuilding(0,-400,-500,6,6,0)',c); // far off
  assert.equal(vm.runInContext(`march(${P},true)`,c),'null');assert.deepEqual(stats(),[2,1],'far changes keep the memory');
  vm.runInContext('W.roads.push({a:0,b:1,path:[{x:-120,z:-120},{x:120,z:-120}]})',c);
  const path=JSON.parse(vm.runInContext(`march(${P},true)`,c));assert.deepEqual(stats(),[2,2],'the new bridge is seen at once');
  assert.ok(path&&path.some(([x,z])=>Math.abs(z+120)<6),'the host goes round by the new bridge');
});
