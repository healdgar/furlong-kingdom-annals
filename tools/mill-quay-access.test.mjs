// Mills and quays are sited only where a lane from their door can reach a street (#29): each site is surveyed before
// anything is built, so no mill is raised and pulled down again and no quay is laid and abandoned. Real generator, model-only VM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {inlineGameScript} from './simulation-boundary.mjs';

const source=inlineGameScript(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
async function world(seed,fate,coast){
  const hash=`#s=${seed}&f=${fate}${coast?'&c='+coast:''}&y=850`;
  const ctx=vm.createContext({FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash},__hashWorldGraph:()=>({}),addEventListener(){},removeEventListener(){},requestAnimationFrame(){},
    setTimeout,clearTimeout,performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,Date,Math,Number,Intl,Promise,
    Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,Error,TypeError,RangeError,
    JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,
    ...(typeof CompressionStream==='undefined'?{}:{CompressionStream}),...(typeof DecompressionStream==='undefined'?{}:{DecompressionStream}),...(typeof Response==='undefined'?{}:{Response})});
  new vm.Script(source,{filename:'index.html'}).runInContext(ctx,{timeout:60_000});
  await vm.runInContext(`startSimulation({seed:${seed},fate:${fate},coast:${JSON.stringify(coast)},startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})`,ctx,{timeout:600_000});
  return ctx;
}
// From each door, a walker who crosses rivers only on paid roads searches the 2 m lattice, unboxed, for a live street other than the door's own;
// a straight run through a gap the lattice cannot enter counts too, so where the lattice fails the game's own planner is asked again on the finished world.
const CENSUS=`(()=>{
  const reach=(s,p,skip)=>{const walker={house:s.owner,settlement:s,placed:s._lay.placed,requireRoadCrossing:true,waterClearance:2.3};if(armyObstacle(walker,p.x,p.z))return false;
    const segs=[];for(const st of s.streets)if(!skip.has(st)&&!st.hidden&&!st.gone&&!st.planQ&&!st.planned&&st.kind!=='edge'&&(st.kind!=='quay'||st.serviceLinked)&&!st.castlePath)for(let k=1;k<st.pts.length;k++)segs.push([st.pts[k-1],st.pts[k]]);
    const near=(x,z)=>segs.some(([a,b])=>segDist(x,z,a,b)<2.5),start={x:Math.round(p.x/2)*2,z:Math.round(p.z/2)*2},seen=new Set([start.x*100003+start.z]),q=[start];
    if(!armySegmentClear(walker,p,start))return false;
    for(let h=0;h<q.length&&h<150000;h++){const c=q[h];if(near(c.x,c.z))return true;
      for(let dz=-2;dz<=2;dz+=2)for(let dx=-2;dx<=2;dx+=2){const x=c.x+dx,z=c.z+dz,k=x*100003+z;if((dx||dz)&&!seen.has(k)&&armySegmentClear(walker,c,{x,z})){seen.add(k);q.push({x,z});}}}
    return false;};
  const out={mills:[],quays:[],raisedAndRazed:0,deadQuays:0};
  for(const s of W.settlements){
    for(const cell of s._lay?.placed.historyCells.values()||[])for(const o of cell)if(o.arch==='mill'&&o.removed)out.raisedAndRazed++;
    for(const b of s.buildings)if(b.arch==='mill'&&!b.removed){const door=serviceDoor(b),own=new Set(s.streets.filter(st=>st===b.st||st.serviceAccess==='mill'&&dist2d(st.pts[0].x,st.pts[0].z,door.x,door.z)<3));
      const direct=!b.st?.serviceAccess&&b.st?.pts.some((q,k)=>k&&segDist(door.x,door.z,b.st.pts[k-1],q)<1+b.st.hw);
      out.mills.push({town:s.name,lane:!!b.st&&!b.st.hidden&&!b.st.gone,reach:direct||reach(s,door,own)||!!serviceRoadPlan(s,door,s._lay.placed,b.st,1.3)});}
    for(const st of s.streets)if(st.kind==='quay'){if(st.gone||st.hidden){out.deadQuays++;continue;}const p=st.pts[Math.floor(st.pts.length/2)];
      out.quays.push({town:s.name,linked:!!st.serviceLinked,reach:reach(s,p,new Set([st]))||st.pts.some(q=>!!serviceRoadPlan(s,q,s._lay.placed,st,1.6))});}
  }
  return JSON.stringify(out);})()`;

for(const [seed,fate,coast] of [[1001,42,'sea'],[2002,42,'land']])test(`seed ${seed}: every mill and quay door reaches a street, and none was built and abandoned`,async()=>{
  const c=JSON.parse(vm.runInContext(CENSUS,await world(seed,fate,coast),{timeout:600_000}));
  assert.ok(c.mills.length>0,'the world has mills to check');
  assert.equal(c.raisedAndRazed,0,'a mill site is surveyed before it is built, never built and pulled down');
  assert.equal(c.deadQuays,0,'a quay is surveyed before it is laid, never laid and abandoned');
  for(const m of c.mills){assert.ok(m.lane,`${m.town}: the mill has its lane`);assert.ok(m.reach,`${m.town}: the mill door reaches a street`);}
  for(const q of c.quays){assert.ok(q.linked,`${q.town}: the quay is linked`);assert.ok(q.reach,`${q.town}: the quay reaches a street`);}
});
