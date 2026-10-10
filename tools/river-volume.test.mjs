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

const riverOutletContext=()=>{
  const GRID=64,CELL=10,SIZE=CELL*(GRID-1),W={coastal:true,water:new Uint8Array(GRID*GRID),h:new Float32Array(GRID*GRID)};
  const ctx=vm.createContext({GRID,CELL,SIZE,SEA:0,SEA_SURFACE:.5,W,
    cIdx:(x,z)=>z*GRID+x,cellX:x=>x*CELL-SIZE/2,cellZ:z=>z*CELL-SIZE/2,
    toCell:x=>Math.max(0,Math.min(GRID-1,Math.round((x+SIZE/2)/CELL))),
    hAt:(x,z)=>{const cx=Math.max(0,Math.min(GRID-1,Math.round((x+SIZE/2)/CELL))),cz=Math.max(0,Math.min(GRID-1,Math.round((z+SIZE/2)/CELL)));return W.h[cz*GRID+cx];},
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b)});
  vm.runInContext(source.slice(source.indexOf('function riverSeaAt('),source.indexOf('function buildTerrain(')),ctx);
  return {ctx,W,cellX:x=>x*CELL-SIZE/2,cellZ:z=>z*CELL-SIZE/2,at(x,z,value=1,height=-1){W.water[z*GRID+x]=value;W.h[z*GRID+x]=height;}};
};
const outlet=(x,z,prevX=x-10,prevZ=z,hw=2)=>({pts:[{x:prevX,z:prevZ},{x,z}],ys:[4,3],hw:[hw,hw],mouth:false});
const outletState=o=>JSON.parse(JSON.stringify(o));

test('river beds below sea height are not sea unless the coastal water mask marks sea',()=>{
  const t=riverOutletContext();t.at(30,30,2,-4);const p={x:t.cellX(30),z:t.cellZ(30)};
  assert.equal(vm.runInContext(`riverSeaAt(${p.x},${p.z})`,t.ctx),false);
  t.W.water[30*64+30]=1;t.W.coastal=false;
  assert.equal(vm.runInContext(`riverSeaAt(${p.x},${p.z})`,t.ctx),false);
  t.W.coastal=true;t.W.h[30*64+30]=0.3;
  assert.equal(vm.runInContext(`riverSeaAt(${p.x},${p.z})`,t.ctx),false);
});

test('outlet extension stops at dry centerline or side-bank cells without carving terrain',()=>{
  for(const dry of [[32,30],[32,29]]){
    const t=riverOutletContext();for(let x=28;x<=35;x++)for(let z=27;z<=33;z++)t.at(x,z,1,-1);t.at(...dry,0,5);
    // a channel wide enough that its banks reach the neighbouring 10 m cells: the side check samples at the channel's own half-width
    const o=outlet(t.cellX(30),t.cellZ(30),t.cellX(30)-10,t.cellZ(30),10),h=t.W.h.slice(),water=t.W.water.slice(),before=outletState(o);
    vm.runInContext('extendRiverSeaOutlet(outlet)',Object.assign(t.ctx,{outlet:o}));
    assert.equal(o.pts.length,before.pts.length+1);assert.equal(o.ys.at(-1),.5);assert.ok(o.hw.at(-1)>before.hw.at(-1));
    assert.deepEqual(t.W.h,h);assert.deepEqual(t.W.water,water);
  }
});

test('outlet extension stops at the map bound and appends only safe existing sea within 320 m',()=>{
  const edge=riverOutletContext();for(let x=60;x<64;x++)for(let z=28;z<=32;z++)edge.at(x,z,1,-1);
  const nearEdge=outlet(edge.cellX(61),edge.cellZ(30)),boundH=edge.W.h.slice(),boundWater=edge.W.water.slice();
  vm.runInContext('extendRiverSeaOutlet(outlet)',Object.assign(edge.ctx,{outlet:nearEdge}));
  assert.ok(nearEdge.pts.length>2&&nearEdge.pts.length<=42);
  assert.ok(nearEdge.pts.slice(2).every(p=>vm.runInContext(`riverSeaAt(${p.x},${p.z})`,edge.ctx)));
  assert.deepEqual(edge.W.h,boundH);assert.deepEqual(edge.W.water,boundWater);

  const sea=riverOutletContext();for(let x=10;x<50;x++)for(let z=28;z<=32;z++)sea.at(x,z,1,-1);
  const o=outlet(sea.cellX(20),sea.cellZ(30)),h=sea.W.h.slice(),water=sea.W.water.slice(),start=o.pts.length;
  vm.runInContext('extendRiverSeaOutlet(outlet)',Object.assign(sea.ctx,{outlet:o}));
  const appended=o.pts.length-start;assert.ok(appended>0&&appended<=40);assert.ok(appended*8<=320);
  assert.ok(o.pts.slice(start).every(p=>vm.runInContext(`riverSeaAt(${p.x},${p.z})`,sea.ctx)));
  assert.ok(o.ys.slice(start).every(y=>y===.5));assert.deepEqual(sea.W.h,h);assert.deepEqual(sea.W.water,water);
});

test('mouths, zero-length endpoints, and short paths remain unchanged',()=>{
  for(const make of [()=>({...outlet(0,0),mouth:true}),()=>({pts:[{x:0,z:0}],ys:[4],hw:[2],mouth:false}),()=>outlet(0,0,0,0)]){
    const t=riverOutletContext();for(let x=0;x<5;x++)for(let z=0;z<5;z++)t.at(x,z,1,-1);
    const o=make(),before=outletState(o);vm.runInContext('extendRiverSeaOutlet(outlet)',Object.assign(t.ctx,{outlet:o}));assert.deepEqual(outletState(o),before);
  }
});

const profileWorld=bed=>{
  const ctx=vm.createContext({hAt:x=>bed[x]});
  vm.runInContext(source.slice(source.indexOf('function riverDrawLevel('),source.indexOf('const ROADCOL=')),ctx);
  return st=>Array.from(ctx.riverDrawProfile(st));
};
const channel=(bed,ys=bed.map(y=>y+2))=>({pts:bed.map((_,x)=>({x,z:0})),ys,hw:bed.map(()=>4)});
test('river water pools over repeated bed bumps rather than rising uphill in each terrain cell',()=>{
  const bed=[9,4,8,4,8,2],st=channel(bed),before=JSON.stringify(st),ys=profileWorld(bed)(st);
  assert.deepEqual(ys,[9.35,6.35,6.35,6.35,6.35,2.35]);
  assert.ok(ys.every((y,k)=>!k||y<=ys[k-1]));assert.equal(JSON.stringify(st),before);
});
test('a descending river retains its drops, and a level canal retains its surveyed height without reading its bed',()=>{
  const bed=[12,9,7,3],st=channel(bed);
  assert.deepEqual(profileWorld(bed)(st),bed.map(y=>y+.35));
  assert.deepEqual(profileWorld([])({...st,ys:[5,5,5,5],canal:true}),[5,5,5,5]);
  assert.deepEqual(profileWorld([])({pts:[],ys:[],hw:[]}),[]);
});

test('junction backwater extends upstream without making a hump, and leaves canal levels and bank coordinates alone',()=>{
  const level=vm.runInNewContext(source.slice(source.indexOf('function levelRiverRuns('),source.indexOf('function appendRiverJoin('))+'\nlevelRiverRuns');
  const riv={p:[]};for(const y of [8,6,7,4,2,3])for(let j=0;j<5;j++)riv.p.push(j,y,riv.p.length/15);
  const before=riv.p.slice(),runs=[{renderBase:0,pts:[0,1,2,3]},{renderBase:20,pts:[0,1],canal:true}];level(riv,runs);
  assert.deepEqual([0,1,2,3,4,5].map(k=>riv.p[k*15+1]),[8,7,7,4,2,3]);
  for(let i=0;i<riv.p.length;i++)if(i%3!==1)assert.equal(riv.p[i],before[i]);
  for(let k=0;k<4;k++)for(let j=1;j<5;j++)assert.equal(riv.p[(k*5+j)*3+1],riv.p[k*15+1]);
});
