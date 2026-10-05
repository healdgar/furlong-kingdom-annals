import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){
  const re=new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m');
  const hit=source.match(re);assert.ok(hit,`missing ${name}`);return hit[0];
}
const distance=(x,z,a,b)=>Math.hypot(x-a,z-b);
function context(extra={}){
  return vm.createContext({Math,dist2d:distance,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    locW:(b,x,z)=>{const c=Math.cos(b.rot),s=Math.sin(b.rot);return[b.x+x*c+z*s,b.z-x*s+z*c];},
    streetAccessAt:()=>true,armyObstacle:()=>null,armyBridgeAt:()=>false,armyRaftAt:()=>false,fortGround:()=>0,
    lerp:(a,b,t)=>a+(b-a)*t,...extra});
}
function planRuntime(extra={}){const C=context(extra);vm.runInContext(fn('armySegmentClear')+'\n'+fn('armyDetour')+'\n'+fn('armyLandPath')+'\n'+fn('serviceRoadPlan')+'\n'+fn('serviceDoor'),C);if(extra.armyLandPath)C.armyLandPath=extra.armyLandPath;return C;}
function footprintRuntime(){const C=context();vm.runInContext(fn('streetFootprintOverlap'),C);return C.streetFootprintOverlap;}
const street=(kind,pts,extra={})=>({kind,pts,hw:2,...extra});
const segment=(ax,az,bx,bz,hw=0)=>({a:{x:ax,z:az},b:{x:bx,z:bz},hw});

test('mill access door lies opposite the wheel for each heading and wheel side',()=>{
  const C=planRuntime();
  for(const rot of[-2.4,-0.6,0,0.9,2.7])for(const side of[-1,0,1,2,3]){
    const b={arch:'mill',x:17,z:-9,rot,w:9,d:7,millWater:{side}},pad=1.2;
    const q=C.serviceDoor(b,pad),th=rot+side*Math.PI/2;
    const dx=q.x-b.x,dz=q.z-b.z;
    assert.ok(dx*Math.cos(th)-dz*Math.sin(th)<0,'door must face away from wheel');
    assert.ok(Math.abs(dx*Math.sin(th)+dz*Math.cos(th))<1e-9,'door must remain on the wheel axis');
    const half=(Math.abs(Math.cos(side*Math.PI/2))*b.w+Math.abs(Math.sin(side*Math.PI/2))*b.d)/2;
    assert.ok(Math.abs(Math.hypot(dx,dz)-(half+pad))<1e-9,'door must clear the mill footprint');
  }
});

test('ordinary service door is outside the building footprint after rotation',()=>{
  const C=planRuntime();
  for(const rot of[-1.8,-0.3,0,1.4]){
    const b={arch:'grange',x:3,z:8,rot,w:12,d:10},q=C.serviceDoor(b,1.2);
    const localX=(q.x-b.x)*Math.cos(rot)-(q.z-b.z)*Math.sin(rot);
    const localZ=(q.x-b.x)*Math.sin(rot)+(q.z-b.z)*Math.cos(rot);
    assert.ok(Math.abs(localX)<1e-9);assert.ok(localZ>5+1.2-1e-9);
  }
});

test('a blocked nearest street is skipped for the next reachable street',()=>{
  let visits=0;
  const C=planRuntime({armyLandPath:(walker,path)=>{visits++;return path[1].z===0?null:path;}});
  const near=street('road',[{x:0,z:0},{x:10,z:0}]),far=street('lane',[{x:0,z:8},{x:10,z:8}]);
  const s={owner:1,streets:[near,far]},placed={};
  const result=C.serviceRoadPlan(s,{x:3,z:1},placed);
  assert.equal(result.street,far);assert.equal(result.path.at(-1).z,8);assert.equal(visits,2);
});

test('real land-path validation rejects an obstructed endpoint and admits a clear route',()=>{
  const blocked={x:0,z:0},C=planRuntime({armyObstacle:(a,x,z)=>distance(x,z,blocked.x,blocked.z)<0.45?'building':null});
  const walker={settlement:{},placed:{}};
  assert.equal(C.armyLandPath(walker,[{x:4,z:0},blocked]),null);
  const clear=C.armyLandPath(walker,[{x:4,z:4},{x:0,z:4}]);
  assert.ok(clear);assert.deepEqual(Array.from(clear,p=>[p.x,p.z]),[[4,4],[0,4]]);
});

test('service anchors exclude edge, quay, castle, planned, hidden, gone and the quay being joined',()=>{
  const C=planRuntime({armyLandPath:(walker,path)=>path});
  const excluded=[
    street('road',[{x:0,z:0},{x:10,z:0}],{planned:true}),
    street('lane',[{x:0,z:1},{x:10,z:1}],{castlePath:true}),
    street('road',[{x:0,z:2},{x:10,z:2}],{hidden:true}),
    street('road',[{x:0,z:3},{x:10,z:3}],{gone:true}),
    street('edge',[{x:0,z:4},{x:10,z:4}]),
    street('quay',[{x:0,z:5},{x:10,z:5}]),
    street('road',[{x:0,z:6},{x:10,z:6}],{planQ:true}),
  ];
  const allowed=street('road',[{x:0,z:12},{x:10,z:12}]);
  const s={owner:1,streets:[...excluded,allowed]},p={x:3,z:0};
  const result=C.serviceRoadPlan(s,p,{},excluded[5]);
  assert.equal(result.street,allowed);
});

test('candidate path attempts are bounded and planning does not mutate world, hash, or RNG',()=>{
  let calls=0,random=0;
  const M=Object.create(Math);M.random=()=>{random++;return 0.25;};
  const C=planRuntime({Math:M,armyLandPath:(walker,path)=>{calls++;return null;}});
  const streets=Array.from({length:40},(_,i)=>street('road',[{x:0,z:i+1},{x:10,z:i+1}]));
  const s={owner:4,streets},placed={near(){throw Error('planning must not query or mutate placement hash');}};
  const before=JSON.stringify(s);
  assert.equal(C.serviceRoadPlan(s,{x:1,z:0},placed),null);
  assert.equal(calls,12);assert.equal(random,0);assert.equal(JSON.stringify(s),before);
});

test('street footprint test catches a centerline crossing missed by corner samples',()=>{
  const overlap=footprintRuntime(),building={x:0,z:0,w:4,d:2,rot:0};
  assert.equal(overlap(building,segment(-10,0,10,0),0),true);
  assert.equal(overlap(building,segment(-10,1.01,10,1.01),0),false);
});

test('rotated footprints use their local rectangle axes against world segments',()=>{
  const overlap=footprintRuntime(),rot=Math.PI/4,building={x:3,z:-2,w:6,d:2,rot};
  const ux=Math.cos(rot),uz=-Math.sin(rot),vx=Math.sin(rot),vz=Math.cos(rot);
  const through=[{x:building.x-ux*10,z:building.z-uz*10},{x:building.x+ux*10,z:building.z+uz*10}];
  const beside=[{x:building.x-vx*10,z:building.z-vz*10},{x:building.x+vx*10,z:building.z+vz*10}];
  assert.equal(overlap(building,{a:through[0],b:through[1],hw:0},0),true);
  assert.equal(overlap(building,{a:beside[0],b:beside[1],hw:0},0),true);
  const clear={a:{x:building.x+vx*4,z:building.z+vz*4},b:{x:building.x+vx*8,z:building.z+vz*8},hw:0};
  assert.equal(overlap(building,clear,0),false);
});

test('street half-width and pad count toward overlap, including exact tangency',()=>{
  const overlap=footprintRuntime(),building={x:0,z:0,w:4,d:2,rot:0};
  assert.equal(overlap(building,segment(-5,1.35,5,1.35,0.25),0.1),true);
  assert.equal(overlap(building,segment(-5,1.351,5,1.351,0.25),0.1),false);
  assert.equal(overlap(building,segment(-5,1.5,5,1.5,0.5),0),true);
  assert.equal(overlap(building,segment(-5,1.5001,5,1.5001,0.5),0),false);
});

test('zero-length street segments are treated as points',()=>{
  const overlap=footprintRuntime(),building={x:4,z:7,w:6,d:2,rot:0.37};
  assert.equal(overlap(building,segment(4,7,4,7),0),true);
  const c=Math.cos(building.rot),sn=Math.sin(building.rot),x=building.x+sn*1.3,z=building.z+c*1.3;
  assert.equal(overlap(building,segment(x,z,x,z),0),false);
  assert.equal(overlap(building,segment(x,z,x,z,0.41),0.1),true);
});
