import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function realm(){
  const s={pos:{x:-20,z:0},streets:[{kind:'road',hw:2,pts:[{x:-20,z:0},{x:-5,z:0}]},{kind:'quay',hw:2,pts:[{x:5,z:-20},{x:5,z:20}]}]};
  const C=vm.createContext({Math,W:{roads:[],settlements:[s]},G:{},s,SEA_SURFACE:0,hAt:()=>4,lakeAt:()=>false,
    riverAt:(x,z)=>Math.abs(x)<3?{y:3,hw:3}:null,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,
    fortCircuits:()=>[],fortRoadBlocked:()=>false,fortStreetRuns:(s,st)=>[st.pts]}); // water fixtures have no fortifications
  vm.runInContext(['segDist','lerpPt','resample','onRoad','paidRoadAt','roadAccessClear','streetGraph','streetAccessAt','frontageAccess','ruralRoadAccess'].map(fn).join('\n'),C);
  return C;
}
test('nearby street ends cannot invent a crossing, even at a shallow ford',()=>{
  const C=realm();assert.equal(C.roadAccessClear(C.s,{x:-5,z:0},{x:5,z:0}),false);
  assert.equal(C.streetAccessAt(C.s,{x:5,z:0}),false);
  assert.equal(C.frontageAccess(C.s,{mx:5,mz:0,st:C.s.streets[1]}),false);
  assert.equal(C.ruralRoadAccess(C.s,{x:20,z:0}),false);
});
test('a built highway crossing opens the far bank; renderer-only spans do not',()=>{
  const C=realm();C.G.bridgeSpans=[{a:{x:-5,z:0},b:{x:5,z:0},hw:5}];
  assert.equal(C.roadAccessClear(C.s,{x:-5,z:0},{x:5,z:0}),false);
  const path=[{x:-20,z:0},{x:20,z:0}];C.W.roads.push({a:0,b:1,path});C.s.streets.push({kind:'road',pts:path});
  assert.equal(C.roadAccessClear(C.s,{x:-5,z:0},{x:5,z:0}),true);
  assert.equal(C.streetAccessAt(C.s,{x:5,z:0}),true);
  assert.equal(C.ruralRoadAccess(C.s,{x:30,z:0}),true);
});
test('hidden lanes can open on connected dry land but cannot cross water for free',()=>{
  const C=realm(),near={hidden:true,pts:[{x:-10,z:0},{x:-10,z:30}]},far={hidden:true,pts:[{x:-10,z:0},{x:10,z:30}]};
  assert.equal(C.frontageAccess(C.s,{mx:-10,mz:28,st:near}),true);
  assert.equal(C.frontageAccess(C.s,{mx:10,mz:30,st:far}),false);
});
test('rural placement traverses only built dry tracks connected to town',()=>{
  const C=realm(),pts=[{x:-15,z:0},{x:-15,z:90},{x:-15,z:180}],e0={a:0,b:1,k:'a'},e1={a:1,b:2,k:'b'};
  C.G.tg={pts,E:new Map([['a',e0],['b',e1]]),adj:[[e0],[e0,e1],[e1]]};C.G.trackSet=new Set(['a','b']);
  assert.equal(C.ruralRoadAccess(C.s,{x:-15,z:200}),true);
  C.G.trackSet.delete('a');assert.equal(C.ruralRoadAccess(C.s,{x:-15,z:200}),false);
  assert.equal(C.ruralRoadAccess(C.s,{x:15,z:200}),false);
});
test('local paving clips wet stretches; only paid road rendering produces bridge spans',()=>{
  const start=source.indexOf('  const FR=[',source.indexOf('function rebuildRoadMesh')),
    end=source.indexOf('  for(const r of W.roads)',start),runs=[];
  const C=vm.createContext({riverAt:(x,z,pad=0)=>Math.abs(x)<3+pad?{y:3}:null,
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),strip:P=>runs.push(P.map(p=>p.x)),segDist:realm().segDist});
  vm.runInContext('const acc={},spans=[];\n'+source.slice(start,end)+'\nthis.lay=lay;this.spans=spans;',C);
  const P=[-15,-10,-5,0,5,10,15].map(x=>({x,z:0}));
  C.lay(P,2,.3,()=>0);assert.equal(C.spans.length,0);assert.deepEqual(JSON.parse(JSON.stringify(runs)),[[-15,-10,-5],[5,10,15]]);
  C.lay(P,2,.3,()=>0,null,true);assert.equal(C.spans.length,1);
  C.lay(P,2,.3,()=>0);assert.equal(C.spans.length,1);
  const bank=[{x:-10,z:-20},{x:-4,z:-10},{x:-4,z:10},{x:-10,z:20}];
  C.lay(bank,2,.3,()=>0,null,true);assert.equal(C.spans.length,1,'a dry road beside water is not a bridge');
});

test('town road stitching cannot erase an already built highway crossing',()=>{
  const C=realm(),open=[{x:-20,z:0},{x:20,z:0}];C.W.roads.push({a:0,b:1,open,path:[{x:-20,z:0},{x:-20,z:30}],drawn:[{x:-20,z:10},{x:-20,z:30}]});
  assert.equal(C.roadAccessClear(C.s,{x:-5,z:0},{x:5,z:0}),true);
});

test('a paid road beside the bank does not authorize a river crossing',()=>{
  const C=realm();C.W.roads.push({a:0,b:1,path:[{x:-4,z:-30},{x:-4,z:30}]});
  assert.equal(C.onRoad(-1,0,0),true);assert.equal(C.paidRoadAt(-1,0),false);
  assert.equal(C.roadAccessClear(C.s,{x:-5,z:0},{x:5,z:0}),false);
});
