import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
function fn(name){
  const re=new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m');
  const hit=source.match(re);assert.ok(hit,`missing ${name}`);return hit[0];
}
const distance=(x,z,a,b)=>Math.hypot(x-a,z-b);
function runtime(){
  const C=vm.createContext({Math,dist2d:distance,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    locW:(b,x,z)=>{const c=Math.cos(b.rot||0),sn=Math.sin(b.rot||0);return[b.x+x*c+z*sn,b.z-x*sn+z*c];},
    streetAccessAt:()=>true,armyObstacle:()=>null,armySegmentClear:()=>true});
  vm.runInContext([fn('locW'),fn('serviceDoor'),fn('streetFootprintOverlap'),fn('storageRoadNear'),fn('storageRoadPlan')].join('\n'),C);
  return C;
}
const street=(kind='road',extra={})=>({kind,hidden:false,gone:false,planQ:false,castlePath:false,serviceLinked:false,...extra});
const segment=(a,b,st)=>({a,b,st,hw:0});
function roadBesideDoor(C,f,gap=2){
  const door=C.serviceDoor(f),dx=door.x-f.x,dz=door.z-f.z,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,
    mx=door.x+ux*gap,mz=door.z+uz*gap,st=street();
  return {st,edge:segment({x:mx-uz*20,z:mz+ux*20},{x:mx+uz*20,z:mz-ux*20},st)};
}
function compare(C,f,edges){
  const segments={near:()=>edges};
  return {near:C.storageRoadNear(f,segments),plan:C.storageRoadPlan({owner:1},f,{},segments)};
}
const grange=(x=0,z=0,rot=0)=>({arch:'grange',x,z,w:12,d:10,rot});

test('no nearby road yields neither a prefilter hit nor a full connector',()=>{
  const C=runtime(),f=grange(),result=compare(C,f,[]);
  assert.equal(result.near,false);assert.equal(result.plan,null);
});

test('the 32 metre road radius is strict for both prefilter and full plan',()=>{
  const C=runtime(),f=grange(),door=C.serviceDoor(f),st=street();
  const edge=segment({x:door.x-20,z:door.z+32},{x:door.x+20,z:door.z+32},st),result=compare(C,f,[edge]);
  assert.equal(distance(door.x,door.z,door.x,door.z+32),32);
  assert.equal(result.near,false);assert.equal(result.plan,null);
});

test('road flags admit ordinary roads and linked quays, and reject unusable or castle paths',()=>{
  const C=runtime(),f=grange(),eligible=[street('road'),street('quay',{serviceLinked:true})],excluded=[
    street('road',{hidden:true}),street('road',{gone:true}),street('road',{planQ:true}),street('edge'),
    street('road',{castlePath:true}),street('quay')
  ];
  for(const st of eligible){const edge={...roadBesideDoor(C,f).edge,st},result=compare(C,f,[edge]);assert.ok(result.near);assert.ok(result.plan,st.kind+' '+JSON.stringify(st));assert.equal(result.plan.street,st);}
  for(const st of excluded){const edge={...roadBesideDoor(C,f).edge,st},result=compare(C,f,[edge]);assert.equal(result.near,false,JSON.stringify(st));assert.equal(result.plan,null,JSON.stringify(st));}
});

test('rotated granges and mills use the real outward service door for both tests',()=>{
  const C=runtime(),fixtures=[...[-2.1,-0.4,0,1.3,2.6].map(rot=>grange(8,-3,rot)),
    ...[-1,0,1,2,3].map((side,i)=>({arch:'mill',x:-8+i*3,z:5,w:9,d:7,rot:0.31*i-0.7,millWater:{side}}))];
  for(const f of fixtures){const {edge,st}=roadBesideDoor(C,f),result=compare(C,f,[edge]);assert.ok(result.near,f.arch+' prefilter');assert.ok(result.plan,f.arch+' full plan');assert.equal(result.plan.street,st);}
});

test('the nearby-road prefilter never rejects a positive full plan across deterministic geometry samples',()=>{
  const C=runtime();let seed=0x51f15e,positive=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
  for(let i=0;i<600;i++){
    const f={arch:i%3?'grange':'warehouse',x:random()*200-100,z:random()*200-100,w:7+random()*12,d:7+random()*12,rot:random()*Math.PI*2};
    const door=C.serviceDoor(f),offset=4+random()*27,angle=random()*Math.PI*2,len=8+random()*50;
    const ux=Math.cos(angle),uz=Math.sin(angle),mx=door.x+ux*offset,mz=door.z+uz*offset;
    const st=street(i%11===0?'quay':i%13===0?'edge':'road',{serviceLinked:i%11===0,castlePath:i%17===0});
    const edge=segment({x:mx-ux*len,z:mz-uz*len},{x:mx+ux*len,z:mz+uz*len},st);
    const result=compare(C,f,[edge]);
    if(result.plan){positive++;assert.equal(result.near,true,`sample ${i} arch=${f.arch} f=${JSON.stringify(f)} edge=${JSON.stringify(edge)}`);}
  }
  assert.ok(positive>100,`${positive} positive full plans exercised`);
});
