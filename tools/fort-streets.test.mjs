import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(){
  const s={pos:{x:0,z:0},pop:1000,buildings:[],streets:[],bailey:{x:0,z:0,r:30,wallR:30,wallRad:new Float32Array(32).fill(30),gateA:0}};
  const C=vm.createContext({s,W:{settlements:[s],roads:[]},G:{},Math,SEA_SURFACE:0,
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    wallBuilt:(c)=>!c.unbuilt,wallProg:c=>c.unbuilt?0:1,wallDmgAt:c=>c.damage||0,wallDamage:c=>c.damage||0,
    hAt:()=>3,lakeAt:()=>false,riverAt:()=>false,paidRoadAt:()=>false});
  vm.runInContext(['lerpPt','resample','casRing','wallRadAt','wallKindAt','fortCenter','fortCircuits','fortGateAngles','fortRoadBlocked','fortStreetRuns','wallGates','roadAccessClear','streetGraph','streetPath','storageAccess'].map(fn).join('\n'),C);
  return C;
}
test('a minor lane forms two dead ends at a closed bailey wall, without inventing a gate',()=>{
  const C=fixture(),st={kind:'lane',hw:2,pts:[{x:0,z:10},{x:0,z:50}]};
  const runs=C.fortStreetRuns(C.s,st);assert.equal(runs.length,2);
  assert.ok(runs[0].at(-1).z<26);assert.ok(runs[1][0].z>34);
  assert.equal(C.roadAccessClear(C.s,st.pts[0],st.pts[1]),false);
  assert.deepEqual(Array.from(C.fortGateAngles(C.s,C.s.bailey)),[0]);
});
test('an authorised gate carries the access road; the opposite curtain stays closed',()=>{
  const C=fixture();assert.equal(C.roadAccessClear(C.s,{x:10,z:0},{x:50,z:0}),true);
  assert.equal(C.fortStreetRuns(C.s,{hw:2,pts:[{x:10,z:0},{x:50,z:0}]}).length,1);
  assert.equal(C.roadAccessClear(C.s,{x:-10,z:0},{x:-50,z:0}),false);
});
test('the street graph cannot reconnect cul-de-sacs through a closed curtain',()=>{
  const C=fixture();C.s.streets=[{kind:'lane',hw:2,pts:[{x:0,z:10},{x:0,z:50}]}];
  let g=C.streetGraph(C.s);const a=0,b=g.N.length-1;assert.equal(C.streetPath(g,a,b),null);
  C.s.bailey.unbuilt=true;g=C.streetGraph(C.s);assert.notEqual(C.streetPath(g,0,g.N.length-1),null);
});
test('a low-demand grid lane gains no gate; substantial traffic can justify an additional town entrance',()=>{
  const C=fixture();delete C.s.bailey;C.s.wallR=30;C.s.wallRad=new Float32Array(32).fill(30);
  const main={kind:'road',hw:3,pts:[{x:0,z:0},{x:50,z:0}]},minor={kind:'mstreet',hw:3,traffic:12,pts:[{x:0,z:0},{x:0,z:50}]};
  C.s.streets=[main,minor];assert.equal(C.fortGateAngles(C.s,C.s).length,1);
  assert.equal(C.roadAccessClear(C.s,{x:0,z:10},{x:0,z:50}),false);
  minor.traffic=120;C.s._gateTrafficVersion=1;assert.equal(C.fortGateAngles(C.s,C.s).length,2);
  assert.equal(C.roadAccessClear(C.s,{x:0,z:10},{x:0,z:50}),true);
  minor.gone=true;C.s._gateTrafficVersion=2;assert.equal(C.fortGateAngles(C.s,C.s).length,1);
});
test('irregular walls use their local radius and genuine breaches remain passable',()=>{
  const C=fixture();C.s.bailey.wallRad[8]=45;C.s.bailey.wallR=45;
  assert.equal(C.fortRoadBlocked(C.s,0,30),false);assert.equal(C.fortRoadBlocked(C.s,0,45),true);
  C.s.bailey.damage=1;assert.equal(C.roadAccessClear(C.s,{x:0,z:30},{x:0,z:55}),true);
});

test('carriage cannot attach a building to a street on the far side of a closed castle wall',()=>{
  const C=fixture();assert.equal(C.storageAccess(C.s,{x:0,z:10},{x:0,z:50}),false);
  assert.equal(C.storageAccess(C.s,{x:10,z:0},{x:50,z:0}),true);
});
