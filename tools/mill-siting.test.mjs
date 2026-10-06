import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(angle=0,{cliff=false,shallow=false,pond=false}={}){
  const x=Math.cos(angle),z=Math.sin(angle),across=(px,pz)=>px*z-pz*x;
  const wet=(px,pz)=>pond?Math.abs(px)<20&&Math.abs(pz)<20:Math.abs(across(px,pz))<5;
  const C=vm.createContext({SEA:0,W:{rivStrips:pond?[]:[{pts:[-24,-12,0,12,24].map(t=>({x:x*t,z:z*t})),hw:[5,5,5,5,5],ys:[3,3,3,3,3]}]},
    lerp:(a,b,t)=>a+(b-a)*t,dist2d:(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz),riverAt:(px,pz)=>!pond&&wet(px,pz),lakeAt:(s,px,pz)=>pond&&wet(px,pz),
    inPoly:(p,px,pz)=>wet(px,pz),hAt:(px,pz)=>wet(px,pz)?(shallow?2.6:1):(cliff?14:4),
    rng:()=>assert.fail('siting must not consume simulation RNG')});
  vm.runInContext(extract('obbCorners')+'\n'+extract('millBankSites')+'\n'+extract('millDrive'),C);
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
test('a stagnant pond without a river outlet cannot drive a river mill',()=>{
  assert.equal(fixture(0,{pond:true}).sites().length,0);
});
test('pond towns site the wheel in flowing water outside the pond, nearest the dam',()=>{
  const f=fixture();f.s.lake={poly:[],y:6,dam:{x:-12,z:0,a:Math.PI}};
  f.C.lakeAt=(s,x,z)=>x<0;const sites=f.sites();assert.ok(sites.length);
  for(const site of sites){assert.equal(site.millWater.kind,'river');assert.ok(site.millWater.x>=0);assert.ok(site.millWater.intake.x<0);assert.ok(Math.hypot(site.millWater.x+12,site.millWater.z)<60);const drive=f.C.millDrive(f.s,site);assert.ok(drive.feed.a.y>drive.feed.b.y);if(drive.mode==='underfed'){assert.ok(drive.feed.b.y<drive.axleY);assert.ok(drive.axleY-drive.radius<site.millWater.y);}else assert.ok(drive.feed.b.y>drive.axleY+drive.radius);assert.ok(drive.radius<4);}
  assert.ok(sites[0].x<=sites.at(-1).x);
});
test('reject cliffs too high for the axle and water too shallow for buckets',()=>{
  assert.equal(fixture(0,{cliff:true}).sites().length,0);
  assert.equal(fixture(0,{shallow:true}).sites().length,0);
});

test('pond-fed mills reject non-flowing head and distant outlets',()=>{
  const f=fixture();f.s.lake={poly:[],y:3.2,dam:{x:-12,z:0,a:Math.PI}};f.C.lakeAt=(s,x,z)=>x<0;
  assert.equal(f.sites().length,0);f.s.lake.y=6;f.s.lake.dam.x=-100;assert.equal(f.sites().length,0);
});

test('sufficient head feeds the upper rim; lower head feeds below the axle and reverses rotation',()=>{
  const f=fixture(),b={x:10,z:10,y:4,h:8.4,d:9,rot:0,millWater:{x:0,z:0,y:3,side:0,intake:{x:0,z:-10}}};
  const s={lake:{y:7.5,dam:{a:-Math.PI/2}}},upper=f.C.millDrive(s,b);assert.equal(upper.mode,'overshot');assert.ok(upper.feed.a.y>upper.feed.b.y);assert.ok(upper.feed.b.y>upper.axleY+upper.radius);
  s.lake.y=5;const lower=f.C.millDrive(s,b);assert.equal(lower.mode,'underfed');assert.ok(lower.feed.b.y<lower.axleY);assert.equal(upper.direction,-lower.direction);
});
test('ordinary river wheels change size with bank context and follow the actual current',()=>{
  const f=fixture(),b={x:10,z:10,y:4,h:8.4,d:9,rot:0,millWater:{x:0,z:0,y:3,side:0}};
  f.C.riverAt=()=>({a:{x:0,z:-1},b:{x:0,z:1}});const a=f.C.millDrive({},b);assert.equal(a.direction,-1);
  b.y=6;const taller=f.C.millDrive({},b);assert.ok(taller.radius>a.radius);
  f.C.riverAt=()=>({a:{x:0,z:1},b:{x:0,z:-1}});assert.equal(f.C.millDrive({},b).direction,1);
});

test('raised millpond dams span to both terrain banks at the proposed water level',()=>{
  const C=vm.createContext({hAt:(x,z)=>z< -31?9:z>47?11:4});
  vm.runInContext(extract('millDamSpan'),C);
  const span=C.millDamSpan(0,0,0,1,8);
  assert.ok(span);assert.ok(span.min< -31&&span.max>47);
  assert.ok(span.width>80);assert.ok(C.hAt(0,span.min)>8);assert.ok(C.hAt(0,span.max)>8);
  assert.ok(C.hAt(0,(span.min+span.max)/2)<=8);
});
