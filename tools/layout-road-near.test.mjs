// The indexed founding-road test must be indistinguishable from the original
// full scan, including long segments and the same construction exclusions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8');
const block=(start,end)=>{
  const i=source.indexOf(start);assert.ok(i>=0,`source contains ${start}`);
  const j=source.indexOf(end,i);assert.ok(j>i,`source contains ${end} after ${start}`);
  return source.slice(i,j);
};
const hashSource=block('function makeHash(','\n// The cells a makeHash holds');
const segSource=block('function segDist(','\nfunction ');
const roadSource=block('function layoutRoadNear(','\nfunction ');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const makeContext=()=>{
  const c=vm.createContext({Math,Map,WeakMap,clamp});
  vm.runInContext(`let HASH_STAMP=0;${hashSource}\n${segSource}\n${roadSource}`,c,{filename:'layout-road-near.js'});
  return c;
};
const rng=seed=>()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
const makeSegment=(a,b,flags={},hw=2)=>{
  const st={hidden:false,gone:false,kind:'lane',castlePath:false,...flags};
  return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,a:{...a},b:{...b},hw,st};
};
const segDist=(px,pz,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,L2=dx*dx+dz*dz||1,t=clamp(((px-a.x)*dx+(pz-a.z)*dz)/L2,0,1);return Math.hypot(px-(a.x+dx*t),pz-(a.z+dz*t));};
const addSegments=(c,segments,cell=24)=>{
  c.segments=segments;c.cell=cell;
  vm.runInContext('H=makeHash(cell)',c);
  for(const g of segments){const reach=Math.hypot(g.b.x-g.a.x,g.b.z-g.a.z)/2+g.hw+2;c.g=g;c.reach=reach;vm.runInContext('H.add(g,reach)',c);}
};
const oracle=(segments,x,z,r)=>segments.some(g=>!g.st.hidden&&!g.st.gone&&g.st.kind!=='edge'&&!g.st.castlePath&&segDist(x,z,g.a,g.b)<r);
const snapshot=segments=>segments.map(g=>JSON.stringify({x:g.x,z:g.z,a:g.a,b:g.b,hw:g.hw,st:g.st}));

test('layoutRoadNear matches the full scan for random and long indexed segments',()=>{
  const c=makeContext(),random=rng(0x61a5cafe),segments=[];
  for(let i=0;i<180;i++){
    const a={x:(random()-.5)*900,z:(random()-.5)*900},angle=random()*Math.PI*2,len=4+random()*170;
    const b={x:a.x+Math.cos(angle)*len,z:a.z+Math.sin(angle)*len};
    const flags=i%9===0?{hidden:true}:i%9===1?{gone:true}:i%9===2?{kind:'edge'}:i%9===3?{castlePath:true}:{};
    segments.push(makeSegment(a,b,flags,0.5+random()*5));
  }
  // These exceed many hash cells and exercise the query expansion around a long road.
  segments.push(makeSegment({x:-1100,z:-8},{x:900,z:-8},{},3));
  segments.push(makeSegment({x:750,z:-900},{x:750,z:1100},{},3));
  segments.push(makeSegment({x:-850,z:540},{x:900,z:540},{hidden:true},3));
  addSegments(c,segments);
  const before=snapshot(segments),queries=[];
  for(let i=0;i<360;i++)queries.push({x:(random()-.5)*1200,z:(random()-.5)*1200,r:[0,1,2,5,12,24,50,110][Math.floor(random()*8)]});
  for(const g of segments.slice(-3))for(const r of[0.5,3,18,80])queries.push({x:(g.a.x+g.b.x)/2,z:(g.a.z+g.b.z)/2,r});
  for(const q of queries){c.x=q.x;c.z=q.z;c.r=q.r;
    const actual=vm.runInContext('layoutRoadNear(H,x,z,r)',c,{timeout:2000});
    assert.equal(actual,oracle(segments,q.x,q.z,q.r),`(${q.x.toFixed(2)}, ${q.z.toFixed(2)}) radius ${q.r}`);
  }
  assert.deepEqual(snapshot(segments),before,'the query leaves road geometry and flags unchanged');
  assert.ok(segments.some(g=>Object.hasOwn(g,'__hs')),'actual hash stamps remain its private deduplication mechanism');
});

test('clearance uses strict radius thresholds and ignores each excluded road class',()=>{
  const c=makeContext(),threshold=makeSegment({x:-100,z:0},{x:100,z:0}),
    hidden=makeSegment({x:-20,z:20},{x:20,z:20},{hidden:true}),
    gone=makeSegment({x:-20,z:30},{x:20,z:30},{gone:true}),
    edge=makeSegment({x:-20,z:40},{x:20,z:40},{kind:'edge'}),
    castle=makeSegment({x:-20,z:50},{x:20,z:50},{castlePath:true}),segments=[threshold,hidden,gone,edge,castle];
  addSegments(c,segments,16);
  const ask=(x,z,r)=>{c.x=x;c.z=z;c.r=r;return vm.runInContext('layoutRoadNear(H,x,z,r)',c);};
  assert.equal(ask(0,4.999,5),true,'less than r is blocked');
  assert.equal(ask(0,5,5),false,'exactly r remains clear');
  assert.equal(ask(0,5.001,5),false,'greater than r remains clear');
  for(const z of[20,30,40,50])assert.equal(ask(0,z,1),false,`excluded segment at z=${z} does not block`);
});
