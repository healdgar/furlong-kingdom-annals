// No building stands on a highway: not on its own town's road, and not on another town's road that passes through it.
// Grow real realms with the game's own layout (model only) and hold every standing footprint to every road's surface (the
// line route() walks, r.path, half the width a village lays its roads). A house on a road blocks every host that would
// pass (armyObstacle), so towns beyond it cannot be reached by road.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=inlineGameScript(fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8'));
const ROAD_HW=3.2,TOL=0.05; // a village's road half-width; a footprint may come up to the road's edge
const WORLDS=[{seed:1001,fate:42,coast:'sea',km:15,days:0},{seed:1001,fate:42,coast:'sea',km:9,days:60},{seed:2002,fate:42,coast:'land',km:9,days:0}];

const globals={FURLONG_HEADLESS:true,addEventListener(){},removeEventListener(){},requestAnimationFrame(){},setTimeout,clearTimeout,
  performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,Date,Math,Number,Intl,Promise,
  Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,
  Error,TypeError,RangeError,JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,structuredClone,
  ...(typeof CompressionStream==='undefined'?{}:{CompressionStream,DecompressionStream,Response})};

// distance from a segment to a rotated footprint rectangle (0 when the segment enters it), in the footprint's own frame
function segToFootprint(p,q,b){
  const c=Math.cos(b.rot||0),sn=Math.sin(b.rot||0),hx=b.w/2,hz=b.d/2,f=v=>{const x=v.x-b.x,z=v.z-b.z;return{x:x*c-z*sn,z:x*sn+z*c};},a=f(p),e=f(q);
  const inBox=v=>Math.abs(v.x)<=hx&&Math.abs(v.z)<=hz;if(inBox(a)||inBox(e))return 0;
  for(const [u,v,h,w] of [['x','z',hx,hz],['z','x',hz,hx]])if(Math.abs(e[u]-a[u])>1e-12)for(const U of[-h,h]){const t=(U-a[u])/(e[u]-a[u]);if(t>=0&&t<=1&&Math.abs(a[v]+(e[v]-a[v])*t)<=w)return 0;}
  const seg=(k)=>{const dx=e.x-a.x,dz=e.z-a.z,l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((k.x-a.x)*dx+(k.z-a.z)*dz)/l2));return Math.hypot(k.x-a.x-dx*t,k.z-a.z-dz*t);};
  const box=v=>Math.hypot(Math.max(Math.abs(v.x)-hx,0),Math.max(Math.abs(v.z)-hz,0));
  return Math.min(box(a),box(e),...[{x:-hx,z:-hz},{x:hx,z:-hz},{x:hx,z:hz},{x:-hx,z:hz}].map(seg));
}
test('the segment distance sees a crossing, an end inside and a clear pass',()=>{
  const b={x:0,z:0,w:4,d:2,rot:0};
  assert.equal(segToFootprint({x:-10,z:0},{x:10,z:0},b),0);assert.equal(segToFootprint({x:0,z:0},{x:0,z:9},b),0);
  assert.ok(Math.abs(segToFootprint({x:-10,z:3},{x:10,z:3},b)-2)<1e-9);assert.ok(Math.abs(segToFootprint({x:5,z:-9},{x:5,z:9},b)-3)<1e-9);
});

function offenders(W){
  const out=[];
  for(const s of W.settlements)for(const b of s.buildings){if(b.removed||b.state==='gone'||b.arch==='churchyard')continue;const R=Math.hypot(b.w,b.d)/2+ROAD_HW+1;
    for(const [ri,r] of W.roads.entries()){const P=r.path;if(!P||P.length<2)continue;
      for(let k=1;k<P.length;k++){const p=P[k-1],q=P[k];if(Math.min(p.x,q.x)>b.x+R||Math.max(p.x,q.x)<b.x-R||Math.min(p.z,q.z)>b.z+R||Math.max(p.z,q.z)<b.z-R)continue;
        const pen=ROAD_HW-segToFootprint(p,q,b);if(pen>TOL){out.push(`${s.name}: ${b.arch} at ${b.x.toFixed(1)},${b.z.toFixed(1)} on road ${ri} (${W.settlements[r.a]?.name} to ${W.settlements[r.b]?.name}) by ${pen.toFixed(2)} m`);break;}}}}
  return out;
}

for(const w of WORLDS)test(`no standing building lies on a road: seed ${w.seed} ${w.coast} at ${w.km} km, laid out${w.days?` and after ${w.days} days`:''}`,{timeout:1_800_000},async()=>{
  const c=vm.createContext({...globals,FURLONG_OPTIONS:{hash:`#s=${w.seed}&f=${w.fate}&c=${w.coast}&y=850&km=${w.km}`}});new vm.Script(source,{filename:'index.html'}).runInContext(c,{timeout:120_000});
  const run=code=>vm.runInContext(code,c,{timeout:600_000});
  await run(`startSimulation({seed:${w.seed},fate:${w.fate},coast:'${w.coast}',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})`);
  const W=run('W');assert.ok(W.settlements.length>=6&&W.roads.length>=5,'the realm has towns and roads to hold to the rule');
  assert.deepEqual(offenders(W),[],'as laid out');
  for(let i=1;i<=w.days;i++){await run('STORAGE_OUTCOMES.wait()');run('simTick()');if(i%8===0)await run('STORAGE_OUTCOMES.journal.flush()');}
  if(w.days)assert.deepEqual(offenders(W),[],`after ${w.days} days of growth`);
});
