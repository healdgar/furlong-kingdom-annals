// A street never runs through a standing building. Grow real towns with the game's own layout (model only, small
// realms), live a season of growth on them, and hold every visible street's surface to every standing footprint.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=inlineGameScript(fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8'));
const WORLDS=[{seed:1001,fate:42,coast:'sea'},{seed:2002,fate:42,coast:'land'},{seed:287970763,fate:370450810,coast:'sea'}];
const DAYS=120,TOL=0.25; // a street may come up to a wall; its surface may not lie more than a quarter metre over a footprint

const globals={FURLONG_HEADLESS:true,addEventListener(){},removeEventListener(){},requestAnimationFrame(){},setTimeout,clearTimeout,
  performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,Date,Math,Number,Intl,Promise,
  Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,
  Error,TypeError,RangeError,JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,structuredClone,
  ...(typeof CompressionStream==='undefined'?{}:{CompressionStream,DecompressionStream,Response})};

// distance from a polyline to a rotated footprint rectangle (0 when the line enters it), in the footprint's own frame
function lineToFootprint(P,b){
  const c=Math.cos(b.rot||0),sn=Math.sin(b.rot||0),hx=b.w/2,hz=b.d/2,L=P.map(p=>{const x=p.x-b.x,z=p.z-b.z;return{x:x*c-z*sn,z:x*sn+z*c};});
  const box=p=>Math.hypot(Math.max(Math.abs(p.x)-hx,0),Math.max(Math.abs(p.z)-hz,0));
  const seg=(p,a,q)=>{const dx=q.x-a.x,dz=q.z-a.z,l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l2));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
  const K=[{x:-hx,z:-hz},{x:hx,z:-hz},{x:hx,z:hz},{x:-hx,z:hz}];let best=1e9;
  for(let i=0;i<L.length;i++){
    if(Math.abs(L[i].x)<=hx&&Math.abs(L[i].z)<=hz)return 0;best=Math.min(best,box(L[i]));if(!i)continue;
    const a=L[i-1],q=L[i];if(Math.abs(q.x-a.x)>1e-12){for(const X of[-hx,hx]){const t=(X-a.x)/(q.x-a.x);if(t>=0&&t<=1&&Math.abs(a.z+(q.z-a.z)*t)<=hz)return 0;}}
    if(Math.abs(q.z-a.z)>1e-12){for(const Z of[-hz,hz]){const t=(Z-a.z)/(q.z-a.z);if(t>=0&&t<=1&&Math.abs(a.x+(q.x-a.x)*t)<=hx)return 0;}}
    for(const k of K)best=Math.min(best,seg(k,a,q));
  }
  return best;
}
test('the footprint distance sees a crossing, a graze and a clear pass',()=>{
  const b={x:0,z:0,w:4,d:2,rot:0.4};
  assert.equal(lineToFootprint([{x:-10,z:0},{x:10,z:0}],b),0);
  const c=Math.cos(b.rot),sn=Math.sin(b.rot),off=(d)=>[{x:-10*c+sn*d,z:10*sn+c*d},{x:10*c+sn*d,z:-10*sn+c*d}]; // lines along the footprint's length, d off its axis
  assert.ok(Math.abs(lineToFootprint(off(1.5),b)-0.5)<1e-9);assert.ok(Math.abs(lineToFootprint(off(-3),b)-2)<1e-9);
});

// The streets the layout lays at a building's own door (a church's path, a mill's or granary's cart lane, a quay's link)
// start at that footprint by design; those links still route round everything else, with a looser margin (see the access
// planners), so here they are held only to keep their centre line out of other footprints.
const ACCESS=st=>!!(st.serviceAccess||st.churchAccess||st.churchyardAccess||st.castlePath);
function offenders(W){
  const out=[];
  for(const s of W.settlements){
    const B=s.buildings.filter(b=>!b.removed&&b.state!=='gone');
    for(const st of s.streets||[]){
      if(st.hidden||st.gone||st.kind==='edge'||!st.pts||st.pts.length<2)continue;
      let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of st.pts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}
      for(const b of B){
        const r=Math.hypot(b.w,b.d)/2+st.hw+1;if(b.x<x0-r||b.x>x1+r||b.z<z0-r||b.z>z1+r)continue;
        const d=lineToFootprint(st.pts,b),pen=st.hw-d;if(pen<=TOL)continue;
        if(ACCESS(st)){const door=lineToFootprint([st.pts[0]],b)<0.8||lineToFootprint([st.pts.at(-1)],b)<0.8;if(door||d>0)continue;}
        out.push(`${s.name}: ${st.kind}${st.name?' '+st.name:''} (hw ${st.hw.toFixed(2)}) over ${b.arch} at ${b.x.toFixed(1)},${b.z.toFixed(1)} by ${pen.toFixed(2)} m`);
      }
    }
  }
  return out;
}

for(const w of WORLDS)test(`no visible street crosses a standing building: seed ${w.seed} ${w.coast}, laid out and after ${DAYS} days`,{timeout:1_800_000},async()=>{
  const hash=`#s=${w.seed}&f=${w.fate}&c=${w.coast}&y=850&km=6`;
  const c=vm.createContext({...globals,FURLONG_OPTIONS:{hash}});new vm.Script(source,{filename:'index.html'}).runInContext(c,{timeout:120_000});
  const run=code=>vm.runInContext(code,c,{timeout:600_000});
  await run(`startSimulation({seed:${w.seed},fate:${w.fate},coast:'${w.coast}',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})`);
  const W=run('W'),lanes=()=>W.settlements.reduce((n,s)=>n+(s.streets||[]).filter(t=>t.kind==='lane'&&!t.hidden&&!t.gone).length,0);
  assert.ok(W.settlements.length>=4&&lanes()>0,'the realm has towns with lanes to hold to the rule');
  assert.deepEqual(offenders(W),[],'as laid out');
  for(let i=1;i<=DAYS;i++){await run('STORAGE_OUTCOMES.wait()');run('simTick()');if(i%8===0)await run('STORAGE_OUTCOMES.journal.flush()');}
  assert.deepEqual(offenders(W),[],`after ${DAYS} days of growth`);
});
