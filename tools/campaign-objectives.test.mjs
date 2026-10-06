import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=name=>{
  const m=html.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));
  assert.ok(m,`missing ${name}`);return m[0];
};
function fixture(){
  const W={settlements:[],houses:[]},events=[];
  const c=vm.createContext({BACKGROUND:null,backgroundUserRequest:()=>false,W,events,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    emit:(...x)=>events.push(x),inRebellion:()=>false,fortCircuits:s=>s.circuits||[],casRing:s=>s.bailey||s.hillCastle||s.ward||null,
    fortCenter:x=>x.pos||x,activeFort:s=>s.active||null,siegeRadius:()=>80,
    hash01:()=>0.5,fortPoint:(s,c,a)=>({x:c.x+Math.cos(a)*(c.wallR||c.r||20),z:c.z+Math.sin(a)*(c.wallR||c.r||20)}),
    wallDmgAt:(c,a)=>c.wallDmg?.[0]||0,damageWalls:(c,a,w,amt)=>{c.wallDmg||=new Float32Array(c.wallRad.length);for(let i=0;i<c.wallDmg.length;i++)if(Math.abs(i/c.wallDmg.length*Math.PI*2-a)<w+Math.PI/c.wallDmg.length)c.wallDmg[i]=Math.min(1,c.wallDmg[i]+amt);},
    razeWall:(s,ks,c)=>{c.wallKind||=new Uint8Array(c.wallRad.length);for(const k of ks)c.wallKind[k]=1;},
    vacantResidentialChanged:()=>{},updateBuildingInstance:()=>{},igniteFire:(s,n)=>{s.ignited=n;},
    Math,Float32Array,Uint8Array});
  vm.runInContext(['fortCircuitKey','fortCircuitFor','objectiveBuilding','armyObjectivePick','armyObjectiveRaid','finishArmyObjective','campaignWallProgress','siegeArc'].map(extract).join('\n')+
    '\nglobalThis.F={armyObjectivePick,armyObjectiveRaid,finishArmyObjective,campaignWallProgress,siegeArc};',c);
  return {c,run:src=>vm.runInContext(src,c)};
}

test('campaign objective selection records stable target keys and normalizes settlement clicks',()=>{
  const {c,run}=fixture(),wall={x:0,z:0,wallRad:new Float32Array(32).fill(20)},b={arch:'hall',x:4,z:6},s={circuits:[wall],bailey:wall,buildings:[b]};
  c.W.settlements=[s];c.s=s;
  assert.deepEqual(JSON.parse(JSON.stringify(run('armyObjectivePick({type:"wall",s,circuit:W.settlements[0].bailey},{x:0,z:20})'))),{type:'wall',si:0,circuit:'bailey',angle:Math.PI/2});
  assert.deepEqual(JSON.parse(JSON.stringify(run('armyObjectivePick({type:"building",s,b:W.settlements[0].buildings[0]})'))),{type:'building',si:0,arch:'hall',x:4,z:6});
  assert.deepEqual(JSON.parse(JSON.stringify(run('armyObjectivePick({type:"building",b:W.settlements[0].buildings[0]},null,"capture")'))),{type:'settlement',si:0});
  assert.deepEqual(JSON.parse(JSON.stringify(run('armyObjectivePick({type:"wall",s,circuit:W.settlements[0].bailey},{x:0,z:20},"pillage")'))),{type:'settlement',si:0});
});

test('placing a campaign objective at peace declares the existing feud before marching',()=>{
  const src=extract('doPlace'),s={owner:2,name:'Fordham',pos:{x:10,z:20}},a={id:5,house:1,at:0,name:'Host'};let war=false,orders=0;
  const c=vm.createContext({BACKGROUND:null,backgroundUserRequest:()=>false,W:{armies:[a],settlements:[s],houses:[{},{},{seat:0}],war:null},plyH:()=>1,atWar:()=>war,
    startFeud:(x,y,by)=>{assert.deepEqual([x,y,by],[1,2,1]);war=true;},startWar:()=>{throw Error('private lords use the existing feud lifecycle');},
    orderArmy:()=>{orders++;return true;},emit:()=>{}});
  vm.runInContext(src+';globalThis.place=doPlace;',c);
  c.place('objective',{id:5,kind:'capture'},{x:10,z:20},{type:'settlement',si:0});
  assert.equal(war,true);assert.equal(orders,1);assert.equal(a.objective.kind,'capture');assert.equal(s.owner,2,'ordering declares war but does not capture the target');
});

test('pillage uses the raid lifecycle, while destructive objectives wait for intact fortifications',()=>{
  const {c,run}=fixture(),army={objective:{kind:'pillage',si:2}};c.a=army;
  const defended={active:{wallRad:new Float32Array(32)}};c.W.settlements[2]=defended;
  assert.equal(run('armyObjectiveRaid(a,2,1,0)'),true);c.a.objective.kind='devastate';assert.equal(run('armyObjectiveRaid(a,2,1,0)'),false);
  c.a.objective.kind='destroy';assert.equal(run('armyObjectiveRaid(a,2,1,0)'),false);defended.active=null;
  assert.equal(run('armyObjectiveRaid(a,2,1,0)'),true);
  for(const kind of ['capture','depose','demolish']){c.a.objective={kind,si:2};assert.equal(run('armyObjectiveRaid(a,2,1,0)'),false,kind);}
  c.a.objective=null;assert.equal(run('armyObjectiveRaid(a,2,1,0)'),false);assert.equal(run('armyObjectiveRaid(a,2,0,1)'),true);
});

test('inner-wall demolition keeps storming the outer circuit instead of extending the siege timer',()=>{
  const src=extract('tickMilitary');
  const wall=(x,r)=>({x,z:0,r,wallRad:new Float32Array(32).fill(r),walls:1,wallDmg:new Float32Array(32)});
  const outer=wall(0,50),inner=wall(1,22),s={pos:{x:0,z:0},owner:2,active:outer,circuits:[outer,inner],bailey:inner,walls:1,garrison:0,militia:0,pop:30,stores:{grain:0}};
  const a={id:1,house:1,at:0,home:0,state:'siege',hold:true,strength:100,morale:70,supply:30,siegeUntil:0,name:'Host',objective:{kind:'demolish',si:0,circuit:'bailey',angle:Math.PI/2}};
  const c=vm.createContext({BACKGROUND:null,backgroundUserRequest:()=>false,W:{armies:[a],settlements:[s],houses:[{},{}],war:null},G:{},MOD:{},Math,Float32Array,
    day:()=>0,armySimPos:()=>({x:0,z:0}),armyLand:()=>{},musterSync:()=>{},activeFort:x=>x.active,fortCircuitFor:(x,key)=>key==='bailey'?x.bailey:x,
    siegeArc:(army)=>{army.siegeArc={c:0,w:0.3,circuit:outer,R:80};},siegeEngines:()=>1,clamp:(x,l,h)=>Math.max(l,Math.min(h,x)),damageWalls:()=>{},siegeGate:()=>null,
    chance:()=>true,notableById:()=>null,generalship:()=>1,defenceOf:()=>1,fortCenter:x=>x.pos,emit:()=>{},
    seasonIdx:()=>0,hostileTo:()=>false,houseAtWar:()=>false,atWar:()=>false,fortCircuits:()=>[outer,inner],
    armySettlementIndex:()=>({bySettlement:new Map()}),dist2d:()=>0,refreshOverlay:()=>{},
    wallDamage:()=>0,fortOf:()=>({mult:1}),takeSettlement:()=>{throw Error('inner-wall objective must not capture the town');},
    siegeRadius:()=>80,hash01:()=>0.4});
  // Stubs for the bounded late-tick paths; the test exercises the real siege decision branch.
  vm.runInContext(src,c);
  assert.doesNotThrow(()=>c.tickMilitary());
  assert.equal(a.siegeUntil,6,'the siege proceeds to the breach resolution, rather than waiting another 30 days');
  assert.equal(s.owner,2);assert.equal(a.objective.kind,'demolish');
});

test('destroying a selected building after the final defence burns it, then withdraws without capture',()=>{
  const src=['objectiveBuilding','finishArmyObjective','withdrawObjectiveArmy','tickMilitary'].map(extract).join('\n');
  const b={arch:'hall',x:3,z:4,state:'sound'},s={pos:{x:0,z:0},owner:2,name:'Fordham',buildings:[b],fires:[],stores:{grain:0},pop:40,prosperity:60,walls:0,garrison:0,militia:0};
  const a={id:1,house:1,at:0,home:0,state:'siege',hold:true,strength:100,morale:70,supply:30,siegeUntil:0,name:'Host',objective:{kind:'destroy',si:0,arch:'hall',x:3,z:4}};
  let captures=0;
  const c=vm.createContext({BACKGROUND:null,backgroundUserRequest:()=>false,W:{armies:[a],settlements:[s],houses:[{},{}],war:null},G:{},MOD:{},Math,Float32Array,
    day:()=>0,armySimPos:()=>({x:0,z:0}),armyLand:()=>{},activeFort:()=>null,siegeArc:()=>{},siegeEngines:()=>1,
    clamp:(x,l,h)=>Math.max(l,Math.min(h,x)),chance:()=>true,notableById:()=>null,generalship:()=>1,defenceOf:()=>1,
    hostileTo:()=>false,houseAtWar:()=>false,atWar:()=>false,emit:()=>{},takeSettlement:()=>captures++,
    liftSiege:()=>{},marchArmy:()=>{},vacantResidentialChanged:()=>{},updateBuildingInstance:()=>{},igniteFire:()=>{},
    seasonIdx:()=>0,fortCenter:x=>x.pos,fortCircuits:()=>[],armySettlementIndex:()=>({bySettlement:new Map()}),
    dist2d:()=>0,refreshOverlay:()=>{},siegeRadius:()=>80,hash01:()=>0.4});
  vm.runInContext(src,c);c.tickMilitary();
  assert.equal(b.state,'burning');assert.equal(s.owner,2);assert.equal(captures,0);
  assert.equal(a.state,'idle');assert.equal(a.objective,null);assert.equal(s.siegeBy,null);
});

test('army logistics orders reuse the canonical paid road and raft actions',()=>{
  const src=extract('doPlace'),calls=[];
  const army={id:7,house:1,at:0},a={owner:1,pos:{x:0,z:0},radius:80},b={owner:1,pos:{x:500,z:0},radius:80};
  const c=vm.createContext({BACKGROUND:null,backgroundUserRequest:()=>false,W:{armies:[army],settlements:[a,b]},plyH:()=>1,nearestSettlementIdx:()=>1,dist2d:(x,z,X,Z)=>Math.hypot(x-X,z-Z),
    emit:(...x)=>calls.push(['emit',...x]),orderRoad:(...x)=>calls.push(['road',...x]),buildArmyRaft:(...x)=>{calls.push(['raft',...x]);return true;}});
  vm.runInContext(src+';globalThis.place=doPlace;',c);
  c.place('supplyroad',{id:7},{x:500,z:0},null);c.place('raft',{id:7},{x:250,z:0},null);
  assert.deepEqual(calls.map(x=>x[0]),['road','raft']);assert.deepEqual(calls[0].slice(1),[0,1,1]);
  assert.deepEqual(calls[1].slice(1),[army,250,0]);
});

test('selected wall objective directs siege arc to the chosen circuit segment',()=>{
  const {c,run}=fixture(),inner={x:12,z:-4,r:22,wallRad:new Float32Array(32)},outer={x:0,z:0,r:44,wallRad:new Float32Array(32)},s={circuits:[outer,inner],bailey:inner,active:outer};
  c.W.settlements=[s];c.army={strength:100,id:9,objective:{kind:'demolish',si:0,circuit:'bailey',angle:7/32*Math.PI*2}};c.s=s;
  run('siegeArc(army,s)');
  assert.equal(c.army.siegeArc.circuit,outer,'outer intact works block the selected inner circuit');
  s.active=inner;run('siegeArc(army,s)');assert.equal(c.army.siegeArc.circuit,inner);assert.ok(Math.abs(c.army.siegeArc.c-7/32*Math.PI*2)<1e-9);assert.equal(c.army.siegeArc.w,Math.PI/32);
});

test('wall objective razes only the selected canonical segment after sufficient battering',()=>{
  const {c,run}=fixture(),circuit={x:0,z:0,r:44,wallRad:new Float32Array(32),wallKind:new Uint8Array(32)},s={circuits:[circuit],bailey:circuit,owner:1},army={objective:{kind:'demolish',si:0,circuit:'bailey',angle:7/32*Math.PI*2}};
  c.W.settlements=[s];c.s=s;c.army=army;
  assert.equal(run('campaignWallProgress(army,s,0.2)'),false);
  assert.ok(Math.abs(run('campaignWallProgress(army,s,1)').x-Math.cos(7/32*Math.PI*2)*44)<1e-6);
  assert.equal(circuit.wallKind[7],1);assert.equal(circuit.wallKind.reduce((n,x)=>n+x,0),1);assert.equal(s.owner,1);assert.equal(army.objective,null);
});

test('destroy and devastate resolve through existing fire and prosperity hooks without duplicating stores',()=>{
  const {c,run}=fixture(),stores={grain:40},building={arch:'hall',x:4,z:6,state:'sound',inventory:{grain:6}},s={name:'Fordham',buildings:[building],fires:[],stores,pop:100,prosperity:60};
  c.W.settlements=[s];c.army={name:'The Host',objective:{kind:'destroy',si:0,arch:'hall',x:4,z:6}};c.s=s;
  assert.equal(run('finishArmyObjective(army,s)'),true);assert.equal(building.state,'burning');assert.equal(s.fires[0],building);assert.equal(building.inventory.grain,6);assert.equal(s.stores,stores);assert.equal(c.army.objective,null);
  c.army.objective={kind:'devastate',si:0};assert.equal(run('finishArmyObjective(army,s)'),true);assert.equal(s.pop,100);assert.equal(s.prosperity,35);assert.equal(s.ignited,2);assert.equal(s.stores,stores);assert.equal(c.army.objective,null);
});
