import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const names=['onRoad','paidRoadAt','armyRaftAt','buildArmyRaft','armyBridgeAt','armyObstacle','armySegmentClear','armyDetour','armyLandPath','armyDestination','armyRouteBlocked','armyMarchPath','armyShore','armyCauseway','walkedRoadAt','roadWalkedBounds','roadBounds'];
const extract=name=>html.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(){const W={settlements:[],rivHash:{},roads:[],dom:new Int16Array(400).fill(0)},G={rivHash:{},bridgeSpans:[]};
 const c=vm.createContext({W,G,ARMY_ROUTES:{on:false},SIZE:2000,CELL:10,SEA_SURFACE:.5, // stub ground: the route memory (army-route-memory.test) needs the real raster
 COG_MPD:100,PORT_DELAY:2,MARCH_MPD:40,
 hAt:()=>10,fortGround:()=>10,riverAt:()=>null,day:()=>5,
 toCell:x=>Math.max(0,Math.min(19,Math.floor((x+100)/10))),inB:(i,j)=>i>=0&&j>=0&&i<20&&j<20,cIdx:(i,j)=>j*20+i,
 dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),emit:()=>{},houseAcct:id=>id,buyBuildingMaterial:()=>0,
 segDist:(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);},
 fortCircuits:s=>s.circuits||[],fortCenter:c=>c,wallRadAt:c=>c.r,wallKindAt:()=>0,wallBuilt:()=>true,wallDmgAt:c=>c.damage||0,
 fortGateAngles:()=>[0],hostileTo:(a,s)=>a.house!==s.owner,activeFort:s=>s.circuits?.[0],inPoly:()=>false,
 armySimPos:()=>({x:7,z:9})});vm.runInContext(names.map(extract).join('\n'),c);return{c,W,G};}
test('a host detours around a rotated building using the existing footprint hash',()=>{const{c,W}=fixture();const b={x:0,z:0,w:8,d:8,rot:Math.PI/4,state:'sound'};
 W.settlements=[{owner:0,_lay:{placed:{near:()=>[b]}}}];c.a={house:0};c.P=[{x:-15,z:0},{x:15,z:0}];
 assert.equal(vm.runInContext('armySegmentClear(a,P[0],P[1])',c),false);const path=vm.runInContext('armyLandPath(a,P)',c);assert.ok(path?.length>2);c.path=path;
 assert.equal(vm.runInContext('path.slice(1).every((q,k)=>armySegmentClear(a,path[k],q))',c),true);
 b.removed=true;assert.equal(vm.runInContext('armySegmentClear(a,P[0],P[1])',c),true);});
test('friendly gates and actual breaches pass; hostile intact gates and wall spans block',()=>{const{c,W}=fixture();const wall={x:0,z:0,r:10,wallRad:new Float32Array(32).fill(10)};W.settlements=[{owner:0,circuits:[wall]}];c.a={house:0};
 assert.equal(vm.runInContext('armyObstacle(a,10,0)',c),null);assert.equal(vm.runInContext('armyObstacle(a,0,10)',c),'wall');c.a.house=1;
 assert.equal(vm.runInContext('armyObstacle(a,10,0)',c),'wall');wall.damage=.8;assert.equal(vm.runInContext('armyObstacle(a,0,10)',c),null);
 wall.damage=0;c.s=W.settlements[0];const goal=vm.runInContext('armyDestination(a,s,{x:30,z:0})',c);assert.equal(goal.x,38);});
test('deep or broad rivers require an existing bridge; narrow shallow water can be forded',()=>{const{c,G}=fixture();let river={a:{x:0,z:-50},b:{x:0,z:50},hw:10,y:12};c.riverAt=()=>river;c.a={house:0};
 assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'river');river.hw=5;river.y=10.9;assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),null);
 river.y=13;assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'river');G.bridgeSpans.push({a:{x:-15,z:0},b:{x:15,z:0},hw:3});
 assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'river','a drawn span cannot authorize travel');c.W.roads.push({path:[{x:-15,z:0},{x:15,z:0}]});
 assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),null);assert.equal(vm.runInContext('armyObstacle(a,0,8)',c),'river');});
test('a failed order preserves current field position and cannot teleport to its old town',()=>{const{c}=fixture();c.a={house:0,state:'march',chase:8,fieldTo:{x:50,z:50}};
 assert.equal(vm.runInContext('armyRouteBlocked(a)',c),false);assert.equal(c.a.state,'idle');assert.deepEqual({...c.a.field},{x:7,z:9});assert.equal(c.a.fieldTo,null);assert.equal(c.a.chase,null);});
test('bounded search cannot cut a thin obstacle or steep bank diagonally',()=>{const{c}=fixture();c.a={house:0};c.fortGround=(x,z)=>x>=0?20:10;
 assert.equal(vm.runInContext('armySegmentClear(a,{x:-2,z:0},{x:2,z:0})',c),false);
 assert.equal(vm.runInContext('armyDetour(a,{x:-900,z:-900},{x:900,z:900},144)',c),null);});
test('raft construction retains partial timber receipts and permits crossing only after completion',()=>{const{c,W}=fixture();let stock=10,total=0,now=5;
 W.settlements=[{owner:0,pos:{x:10,z:10}}];c.a={house:0,at:0,state:'idle',strength:100,supply:40,horses:0};c.day=()=>now;
 c.riverAt=()=>({a:{x:0,z:-50},b:{x:0,z:50},hw:5,y:13});c.buyBuildingMaterial=(s,g,who,q)=>{assert.equal(g,'timber');const got=Math.min(stock,q);stock-=got;total+=got;return got;};
 assert.equal(vm.runInContext('buildArmyRaft(a,0,0)',c),false);assert.equal(c.a.raftWork.used,10);assert.equal(c.a.raft,undefined);
 stock=16;assert.equal(vm.runInContext('buildArmyRaft(a,0,6)',c),true);assert.equal(total,26);assert.equal(stock,0);assert.equal(c.a.raft.timber,26);assert.equal(c.a.raft.a.z,0);assert.equal(c.a.raft.b.z,0);assert.equal(c.a.raftWork,null);
 assert.equal(vm.runInContext('armyRaftAt(a,0,0)',c),false);assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'river');
 now=c.a.raft.readyDay;assert.equal(vm.runInContext('armyRaftAt(a,0,0)',c),true);assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),null);assert.equal(c.a.supply,37);
 c.riverAt=()=>({a:{x:0,z:-50},b:{x:0,z:50},hw:20,y:13});assert.equal(vm.runInContext('buildArmyRaft(a,0,0)',c),false);assert.equal(total,26);});
test('a paid road bridge carries a host over the fording fringe of a broad river, as its water test reaches',()=>{const{c}=fixture();const river={a:{x:0,z:-50},b:{x:0,z:50},hw:10,y:12};
 c.riverAt=(x,z,pad)=>c.segDist(x,z,river.a,river.b)<river.hw+pad?river:null;c.a={house:0};c.W.roads.push({path:[{x:-15,z:0},{x:15,z:0}]});
 assert.equal(vm.runInContext('armyObstacle(a,10.2,0)',c),null,'on the road, within 0.4 m of the water: on the bridge');
 assert.equal(vm.runInContext('armyObstacle(a,5,0)',c),null,'over the water');
 assert.equal(vm.runInContext('armyObstacle(a,10.2,8)',c),'river','off the road, the fringe is still water');
 assert.equal(vm.runInContext('armyBridgeAt(10.2,0)',c),false,'with no clearance asked, the bridge test is the water itself (walkers, the old rule)');
 assert.equal(vm.runInContext('armySegmentClear(a,{x:-14,z:0},{x:14,z:0})',c),true,'the march over the bridge, probed every metre');
 c.a.waterClearance=3;assert.equal(vm.runInContext('armyObstacle(a,12.5,0)',c),null,'a host that keeps further from the water: its bridge reaches as far');});
test('a host takes ship at the water\'s edge and lands at the far shore, not out where the boat lies',()=>{const{c}=fixture();c.a={house:0};
 c.hAt=(x,z)=>x<0||x>=250?10:0; // land, a strait from x 0 to 250, land
 c.P=[{x:-50,z:0},{x:30,z:0,sea:true},{x:200,z:0,sea:true},{x:280,z:0}];
 assert.equal(vm.runInContext('armyLandPath(a,P)',c),null,'from the town straight to the mooring: into the sea');
 const Q=vm.runInContext('armyShore(a,P)',c);assert.equal(Q.length,6,'a shore point beside each landing');
 assert.deepEqual([Q[1].x,Q[1].sea,Q[4].x,Q[4].sea],[-1,true,250,true],'on the last dry ground and the first, counted aboard from there');
 c.Q=Q;const path=vm.runInContext('armyLandPath(a,Q)',c);assert.ok(path,'the march by ship is open');
 assert.deepEqual(vm.runInContext('armyShore(a,[{x:-50,z:0},{x:-10,z:0}])',c).length,2,'a route on land is left as it is');});
test('a road the realm built carries a host where its line dips under the sea\'s surface at the shore',()=>{const{c}=fixture();c.a={house:0};
 c.hAt=()=>0.3;c.W.roads.push({path:[{x:-15,z:0},{x:15,z:0}]}); // low ground, under the drawn sea surface (0.5)
 assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),null,'on the road: a causeway');
 assert.equal(vm.runInContext('armyObstacle(a,0,20)',c),'water','off the road: the shore is water');
 assert.equal(vm.runInContext('armySegmentClear(a,{x:-14,z:0},{x:14,z:0})',c),true,'the march along it');
 c.a.requireRoadCrossing=true;assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'water','walkers keep the old rule');});
test('a host crosses by the road it walks, the town\'s spoke street included, not only by the open road',()=>{const{c}=fixture();const river={a:{x:0,z:-50},b:{x:0,z:50},hw:10,y:12};
 c.riverAt=(x,z,pad)=>c.segDist(x,z,river.a,river.b)<river.hw+pad?river:null;c.a={house:0};
 const open=[{x:-15,z:30},{x:15,z:30}],path=[{x:-15,z:0},{x:15,z:0}];c.W.roads.push({open,path}); // the spoke street bridges the river at z 0; the open road at z 30
 assert.equal(vm.runInContext('armyObstacle(a,0,30)',c),null,'on the open road\'s bridge');
 assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),null,'on the spoke street\'s bridge, the way route() leads');
 assert.equal(vm.runInContext('armyObstacle(a,0,15)',c),'river','between them, the river');
 c.a.requireRoadCrossing=true;assert.equal(vm.runInContext('armyObstacle(a,0,0)',c),'river','walkers keep the open road alone');
 c.a.requireRoadCrossing=false;c.hAt=()=>0.3;assert.equal(vm.runInContext('armyObstacle(a,-12,0)',c),null,'and the walked line is a causeway too');});
