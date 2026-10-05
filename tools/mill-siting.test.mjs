import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(angle=0,{cliff=false,shallow=false,pond=false}={}){
  const x=Math.cos(angle),z=Math.sin(angle),across=(px,pz)=>px*z-pz*x;
  const wet=(px,pz)=>pond?Math.abs(px)<20&&Math.abs(pz)<20:Math.abs(across(px,pz))<5;
  const C=vm.createContext({SEA:0,G:{rivStrips:pond?[]:[{pts:[-24,-12,0,12,24].map(t=>({x:x*t,z:z*t})),hw:[5,5,5,5,5],ys:[3,3,3,3,3]}]},
    dist2d:(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz),riverAt:(px,pz)=>!pond&&wet(px,pz),lakeAt:(s,px,pz)=>pond&&wet(px,pz),
    inPoly:(p,px,pz)=>wet(px,pz),hAt:(px,pz)=>wet(px,pz)?(shallow?2.6:1):(cliff?14:4),
    rng:()=>assert.fail('siting must not consume simulation RNG')});
  vm.runInContext(extract('obbCorners')+'\n'+extract('millBankSites'),C);
  const s={pos:{x:18,z:10},lake:pond?{poly:[{x:-20,z:-20},{x:20,z:-20},{x:20,z:20},{x:-20,z:20}],y:3,dam:{x:20,z:0}}:null};
  C.s=s;return{C,s,wet,sites:()=>vm.runInContext('millBankSites(s,200)',C)};
}
for(const angle of[0,Math.PI/4,Math.PI/2])test(`river mill footprint is dry and wheel is wet at heading ${angle}`,()=>{
  const f=fixture(angle),sites=f.sites();assert.ok(sites.length);
  for(const site of sites){const w=site.millWater;assert.ok(f.wet(w.x,w.z));
    assert.ok(Math.abs(site.x+Math.cos(site.rot)*6.8-w.x)<1e-8);
    assert.ok(Math.abs(site.z-Math.sin(site.rot)*6.8-w.z)<1e-8);
    f.C.site=site;for(const p of vm.runInContext('obbCorners(site.x,site.z,site.w,site.d,site.rot)',f.C))assert.equal(f.wet(p.x,p.z),false);}
  assert.equal(JSON.stringify(sites),JSON.stringify(f.sites()));
});
test('pond mill keeps the building outside and wheel inside the pond',()=>{
  const f=fixture(0,{pond:true}),sites=f.sites();assert.ok(sites.length);
  for(const site of sites){assert.equal(site.millWater.kind,'pond');assert.ok(f.wet(site.millWater.x,site.millWater.z));assert.equal(f.wet(site.x,site.z),false);}
});
test('reject cliffs too high for the axle and water too shallow for buckets',()=>{
  assert.equal(fixture(0,{cliff:true}).sites().length,0);
  assert.equal(fixture(0,{shallow:true}).sites().length,0);
});
