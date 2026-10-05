import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cut=vm.runInNewContext(source.slice(source.indexOf('function riverPolygonDifference('),source.indexOf('function cutRiverTerrain('))+'\nriverPolygonDifference',{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))});
const area=P=>Math.abs(P.reduce((n,p,i)=>{const q=P[(i+1)%P.length];return n+p.x*q.z-q.x*p.z;},0)/2);
const P=[{x:-5,z:-5,y:8,w:[1,0,0]},{x:5,z:-5,y:8,w:[0,1,0]},{x:0,z:5,y:8,w:[0,0,1]}];
for(const orientation of[1,-1])test('channel subtraction preserves dry land and preserves bank heights and records the flat water level '+orientation,()=>{
  const F=[{x:-1,z:-20,y:3},{x:1,z:-20,y:3},{x:1,z:20,y:3},{x:-1,z:20,y:3}];if(orientation<0)F.reverse();const Q=cut(P,F);
  assert.ok(Math.abs(Q.reduce((n,p)=>n+area(p),0)-32)<1e-8);
  const banks=Q.flat().filter(p=>p.water!==undefined);assert.ok(banks.length);assert.ok(Q.flat().every(p=>Math.abs(p.y-8)<1e-8));assert.ok(banks.every(p=>p.water===3&&Math.abs(p.w.reduce((a,b)=>a+b,0)-1)<1e-8));
  assert.ok(Q.every(poly=>{const x=poly.reduce((n,p)=>n+p.x,0)/poly.length;return Math.abs(x)>=1;}));
});
test('nonintersecting channels retain the complete original ground',()=>{
  const F=[{x:20,z:20,y:3},{x:25,z:20,y:3},{x:25,z:25,y:3},{x:20,z:25,y:3}];assert.equal(cut(P,F).reduce((n,p)=>n+area(p),0),area(P));
});
test('ground wholly beneath a channel is removed, allowing a separate recessed bed',()=>{
  const F=[{x:-20,z:-20,y:3},{x:20,z:-20,y:3},{x:20,z:20,y:3},{x:-20,z:20,y:3}];assert.equal(cut(P,F).length,0);
});

const join=vm.runInNewContext(source.slice(source.indexOf('function riverFootprintDepth('),source.indexOf('function renderedWaterNear('))+'\n({riverFootprintDepth,riverBankIntervals})');
test('confluences omit submerged bank walls while retaining both exposed ends',()=>{
  const F=[{x:-2,z:-3},{x:2,z:-3},{x:2,z:3},{x:-2,z:3}],a={x:-5,z:0},b={x:5,z:0};
  const Q=join.riverBankIntervals(a,b,[F]);assert.equal(Q.length,2);assert.ok(Math.abs(Q[0][1]-.3)<1e-6);assert.ok(Math.abs(Q[1][0]-.7)<1e-6);
  assert.ok(join.riverFootprintDepth(F,0,0)>0);assert.ok(join.riverFootprintDepth(F,4,0)<0);
});
test('adjacent channel sections retain their exterior bank without an artificial crack',()=>{
  const F=[{x:0,z:0},{x:2,z:0},{x:2,z:3},{x:0,z:3}];assert.deepEqual(JSON.parse(JSON.stringify(join.riverBankIntervals({x:0,z:0},{x:0,z:3},[F]))),[[0,1]]);
});

const hull=vm.runInNewContext(source.slice(source.indexOf('function riverJoinPolygon('),source.indexOf('function riverFootprintDepth('))+'\nriverJoinPolygon');
test('channel joins fill the wedge between arms with a convex street-like outline',()=>{
  const P=[{x:-4,z:0},{x:4,z:0},{x:4,z:10},{x:-4,z:10},{x:0,z:6},{x:0,z:14},{x:14,z:14},{x:14,z:6}],F=hull(P);
  assert.ok(F.length>=5);assert.ok(area(F)>=area(P.slice(0,4)));for(const p of P)assert.ok(join.riverFootprintDepth(F,p.x,p.z)>=-1e-8);
});
const trimContext=vm.createContext({CELL:10,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),makeHash:()=>({add(){},near:()=>[]})});
vm.runInContext(source.slice(source.indexOf('function riverPolygonDifference('),source.indexOf('function riverFootprintDepth(')),trimContext);
test('outer terrain is cut by its actual footprint even when a long triangle centroid lies beyond the channel hash',()=>{
  const A={p:[-5,8,-5,5,8,-5,0,8,5],n:[0,1,0,0,1,0,0,1,0],c:[1,1,1,1,1,1,1,1,1],i:[0,1,2],uv:[],tangent:[],bank:[]};
  const F=[{x:-1,z:-20,y:3},{x:1,z:-20,y:3},{x:1,z:20,y:3},{x:-1,z:20,y:3}];trimContext.clipGroundFootprints(A,[F]);
  let retained=0;for(let j=0;j<A.i.length;j+=3)retained+=area(A.i.slice(j,j+3).map(i=>({x:A.p[i*3],z:A.p[i*3+2]})));assert.ok(Math.abs(retained-32)<1e-8);
  for(const [k,size]of[['p',3],['n',3],['c',3],['uv',2],['tangent',2],['bank',1]])assert.equal(A[k].length/size,A.p.length/3);assert.ok(A.p.every((v,i)=>i%3!==1||Math.abs(v-8)<1e-8));
});

test('junction overlays are flat above their highest adjoining arm and retain that level when their bed is built',()=>{
  trimContext.riverFootprintDepth=join.riverFootprintDepth;trimContext.lerp=(a,b,t)=>a+(b-a)*t;trimContext.makeHash=()=>{const entries=[];return {add:q=>entries.push(q),near:()=>entries}};
  const F=[{x:-3,z:-3,y:2},{x:3,z:-3,y:2},{x:3,z:3,y:3},{x:-3,z:3,y:3}];F.flow=[0,1];const A={p:[],n:[],c:[],uv:[],tangent:[],bank:[],i:[]};
  for(const [z,y]of[[-10,8],[0,5],[10,2]])for(const x of[-2,-1,0,1,2])A.p.push(x,y,z);trimContext.levelRiverJoins(A,[F]);
  assert.ok(F.level>5);const before=A.p.length/3;trimContext.appendRiverJoin(A,F,0,true);assert.ok(A.p.slice(before*3).every((v,i)=>i%3!==1||v===F.level));assert.equal(F.overlayBase,before);
  trimContext.appendRiverJoin({p:[],n:[],c:[],uv:[],tangent:[],bank:[],i:[]},F,-1.5);assert.equal(F.overlayBase,before);assert.ok(A.p.slice(5*3,10*3).every((v,i)=>i%3!==1||v===F.level));
});
const slopes=vm.runInNewContext(source.slice(source.indexOf('function riverFacetCuts('),source.indexOf('function riverGroundColorRef('))+'\nriverEmbankments',{CELL:10,SIZE:100,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),lerp:(a,b,t)=>a+(b-a)*t,hAt:(x,z)=>8+x*.02,riverBankIntervals:()=>[[0,1]]});
test('exposed banks have inclined faces and crests matching the original terrain',()=>{
  const F=[{x:-2,y:3,z:0},{x:2,y:3,z:0},{x:2,y:3,z:20},{x:-2,y:3,z:20}],Q=slopes([F],{near:()=>[]});assert.ok(Q.length>=4);
  for(const [a,b,c,d]of Q){assert.ok(Math.hypot(a.x-d.x,a.z-d.z)>1);assert.ok(d.y>a.y);assert.ok(Math.abs(d.y-(8+d.x*.02))<1e-8);assert.ok(Math.abs(c.y-(8+c.x*.02))<1e-8);}
});
