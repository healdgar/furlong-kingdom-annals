// Source-extracted differential test for operation-local street-graph fort reuse.
// This loads only the graph/fort functions and controlled geometry, not the world boot.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=(text,name)=>{const hit=text.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'));assert.ok(hit,`missing ${name}`);return hit[0];};
const COMMON=['resample','wallRadAt','wallKindAt','fortCenter','casRing','fortCircuits','fortGateAngles','wallProg','wallBuilt','wallDmgAt','wallDamage','wallGates'];
const CURRENT=['roadAccessClear','fortRoadBlocked','fortStreetRuns','streetGraph'];
const nativeContext=source.match(/^const STREET_GRAPH_FORT_CONTEXTS=new WeakMap\(\);\nconst STREET_GRAPH_FORT_NATIVE=.*?;\nfunction streetGraphFortContext\(s,circuits\)\{[\s\S]*?^\}/m);
assert.ok(nativeContext,'missing native street graph fort context');

// The prior implementation is kept here as the behavior oracle. It intentionally has
// no local circuit/gate context and preserves the original helper call shapes.
const LEGACY=`
function roadAccessClear(s,a,b){
  const n=Math.max(1,Math.ceil(dist2d(a.x,a.z,b.x,b.z)));for(let k=0;k<=n;k++){
    const x=lerp(a.x,b.x,k/n),z=lerp(a.z,b.z,k/n);
    if(hAt(x,z)<=SEA_SURFACE||lakeAt(s,x,z,0)||riverAt(x,z,0.4)&&!paidRoadAt(x,z,0.4)||fortRoadBlocked(s,x,z))return false;
  }return true;
}
function fortRoadBlocked(s,x,z,pad=0){
  for(const c of fortCircuits(s)){if(c.razed||!c.wallRad)continue;const C=fortCenter(c),d=dist2d(x,z,C.x,C.z);if(d>(c.wallR||Math.max(...c.wallRad))+1.3+pad)continue;
    const a=Math.atan2(z-C.z,x-C.x),r=wallRadAt(c,a);if(Math.abs(d-r)>1.3+pad||wallKindAt(c,a)===1||!wallBuilt(c,a)||wallDmgAt(c,a)>=0.98)continue;
    const half=c===s?7.5:c===s.motte?1.2:2.1;
    if(fortGateAngles(s,c).some(g=>Math.abs(Math.atan2(Math.sin(a-g),Math.cos(a-g)))*r<half))continue;return true;}
  return false;
}
function fortStreetRuns(s,st){
  if(!fortCircuits(s).length)return [st.pts];const runs=[],P=resample(st.pts,1.5,st.kind==='quay'||!!st.serviceAccess);let run=[];
  for(const p of P){if(fortRoadBlocked(s,p.x,p.z,(st.hw||2)+0.75)){if(run.length>1)runs.push(run);run=[];}else run.push(p);}
  if(run.length>1)runs.push(run);return runs;
}
function streetGraph(s){
  const fortKey=fortCircuits(s).map(c=>[c.wallR,c.razed?1:0,Math.floor(wallProg(c)*100),c.wallDmg?wallDamage(c):0].join(',')).join(';');
  const key=(W.roads||[]).length+':'+(s.lake?1:0)+':'+(s.streets||[]).length+':'+(s.streets||[]).reduce((t,st)=>t+(st.pts?st.pts.length:0)*4+(st.hidden?1:0)+(st.gone?2:0),0)+':'+fortKey+':'+(s._gateTrafficVersion||0);
  if(s._sg&&s._sg.key===key)return s._sg;
  const N=[],adj=[],H=new Map(),cell=6,hk=(x,z)=>Math.floor(x/cell)+','+Math.floor(z/cell);
  const node=(x,z,st)=>{const k0=Math.floor(x/cell),k1=Math.floor(z/cell);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=H.get((k0+a)+','+(k1+b));if(L)for(const i of L)if(dist2d(N[i].x,N[i].z,x,z)<4&&roadAccessClear(s,N[i],{x,z}))return i;}
    const i=N.length;N.push({x,z,st});adj.push([]);const h=hk(x,z);(H.get(h)||H.set(h,[]).get(h)).push(i);return i;};
  const link=(a,b)=>{if(a===b||!roadAccessClear(s,N[a],N[b]))return;const d=dist2d(N[a].x,N[a].z,N[b].x,N[b].z);adj[a].push([b,d]);adj[b].push([a,d]);};
  const ends=[];
  for(const st of s.streets||[]){if(st.hidden||st.gone||st.planQ||st.kind==='edge'||!st.pts||st.pts.length<2)continue;for(const run of fortStreetRuns(s,st)){const P=resample(run,7,st.kind==='quay'||!!st.serviceAccess);let prev=-1;
    for(const q of P){const i=node(q.x,q.z,st);if(prev>=0)link(prev,i);prev=i;}ends.push(node(P[0].x,P[0].z,st),prev);}}
  for(const e of ends){let b=-1,bd=10;for(let i=0;i<N.length;i++){if(N[i].st===N[e].st)continue;const d=dist2d(N[i].x,N[i].z,N[e].x,N[e].z);if(d<bd&&roadAccessClear(s,N[e],N[i])){bd=d;b=i;}}if(b>=0)link(e,b);}
  let root=-1,bd=90;for(let i=0;i<N.length;i++)if(!N[i].st.castlePath){const d=dist2d(N[i].x,N[i].z,s.pos.x,s.pos.z);if(d<bd&&roadAccessClear(s,s.pos,N[i])){root=i;bd=d;}}
  const todo=root<0?[]:[root];if(root>=0)N[root].access=true;for(let k=0;k<todo.length;k++)for(const [j]of adj[todo[k]])if(!N[j].access){N[j].access=true;todo.push(j);}
  return s._sg={key,N,adj,H};}
`;

function runtime({optimized=true}={}){
  const wall=(r,gates)=>({x:0,z:0,r,wallR:r,wallRad:new Float32Array(32).fill(r),wallKind:new Uint8Array(32),wallDmg:null,wallBuild:null,gates});
  const s={pos:{x:0,z:0},pop:500,streets:[],buildings:[],roads:[],wallR:24,wallRad:new Float32Array(32).fill(24),wallKind:new Uint8Array(32),wallDmg:null,wallBuild:null,_gateTrafficVersion:0,_gatesK:'stale',cas:{outerWall:wall(30,[Math.PI/2])},bailey:wall(15,[Math.PI]),motte:wall(8,[Math.PI/2])};
  s.streets=[
    {kind:'road',hw:3,traffic:100,pts:[{x:-55,z:0},{x:55,z:0}]},
    {kind:'lane',hw:2,traffic:0,pts:[{x:0,z:-55},{x:0,z:55}]},
    {kind:'lane',hw:2,traffic:0,pts:[{x:-50,z:-42},{x:50,z:42}]},
  ];
  const W={settlements:[s],roads:[{a:0,b:0,path:[{x:-60,z:0},{x:60,z:0}],drawn:[{x:-60,z:0},{x:60,z:0}]}]};
  const C=vm.createContext({W,Math,Float32Array,Uint8Array,Map,WeakMap,Object,Number,Array,Infinity,
    SEA_SURFACE:0,BACKGROUND:false,day:()=>100,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,lerpPt:(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}),hAt:()=>10,lakeAt:()=>false,riverAt:()=>null,paidRoadAt:()=>false,onRoad:()=>false,
    gateLookups:0,wallGateBuilds:0});
  C.s=s;
  vm.runInContext(COMMON.map(n=>fn(source,n)).join('\n'),C);
  vm.runInContext(`const realFortGateAngles=fortGateAngles;fortGateAngles=function(s,c,p){s._gateLookupCount=(s._gateLookupCount||0)+1;return realFortGateAngles(s,c,p);};const realWallGates=wallGates;wallGates=function(s,p){s._wallGateBuildCount=(s._wallGateBuildCount||0)+1;return realWallGates(s,p);};`,C);
  vm.runInContext(optimized?CURRENT.map(n=>fn(source,n)).join('\n')+'\n'+nativeContext[0]:LEGACY,C);
  return{C,s,W,graph(){return C.streetGraph(s);},shape(g){return JSON.stringify({key:g.key,N:g.N.map(n=>[n.x,n.z,s.streets.indexOf(n.st),!!n.access]),adj:g.adj,H:[...g.H].map(([k,v])=>[k,v.slice()])});}};
}

test('native street graph matches the pre-change graph with town, outer, ward, and motte circuits',()=>{
  const old=runtime({optimized:false}),now=runtime();
  const a=old.graph(),b=now.graph();
  assert.equal(now.shape(b),old.shape(a),'key, graph nodes, links, access, and hash cells are unchanged');
  assert.ok(now.s._gateLookupCount>0,'fixture reaches the live gate checks');
  assert.equal(now.s._gateLookupCount,new Set([now.s,now.s.cas.outerWall,now.s.bailey,now.s.motte]).size,'one gate-angle resolution per used circuit in a graph build');
  assert.equal(now.s._wallGateBuildCount,1,'town gates are derived once even with a stale persistent gate cache');
  assert.ok(old.s._gateLookupCount>now.s._gateLookupCount,'legacy path repeats gate resolution at multiple wall samples');
  assert.ok(old.s._wallGateBuildCount>1,'legacy path repeats wallGates while its persistent key is stale');
});

test('a graph cache hit does not resolve gates or build a local context',()=>{
  const R=runtime(),first=R.graph();R.s._gateLookupCount=0;R.s._wallGateBuildCount=0;
  assert.equal(R.graph(),first);assert.equal(R.s._gateLookupCount,0);assert.equal(R.s._wallGateBuildCount,0);
});

test('patched helpers take the old uncached calls and preserve legacy argument arity',()=>{
  const R=runtime(),original=R.C.fortRoadBlocked,lens=[];R.C.fortRoadBlocked=function(...args){lens.push(args.length);return original(...args);};
  R.s._sg=null;const g=R.graph();assert.ok(g.N.length>0);
  assert.ok(lens.includes(3),'roadAccessClear retains the original 3-argument blocker call');
  assert.ok(lens.includes(4),'fortStreetRuns retains the original 4-argument blocker call');
  assert.ok(R.s._wallGateBuildCount>1,'patched blocker disables local gate reuse');
});

test('an unbranded context argument cannot substitute circuit data',()=>{
  const R=runtime(),before=R.C.fortCircuits(R.s).length,fake={s:R.s,circuits:[],gates:new Map()};
  assert.equal(R.C.fortRoadBlocked(R.s,24,0,0,fake),R.C.fortRoadBlocked(R.s,24,0));
  assert.equal(before,4);
});

