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

// The drawn wheel. Rivers are drawn at the bed + 0.35 (riverDrawLevel), while millDrive's wheel dips 0.4 below the simulation's level,
// which stands at least 0.9 above the bed: that wheel always hangs clear of the water on screen. The fit sizes it to the drawn stream.
function wheelWorld({bed=2,simY=3,bank=4,found=null,mesh=null,inset=1.25}={}){
  const pts=[-24,-12,0,12,24].map(x=>({x,z:0}));
  const C=vm.createContext({SEA:0,Math,G:mesh?{rivers:{geometry:{attributes:{position:{getY:i=>mesh(i)}}}},drawRivRuns:[{pts,hw:[5,5,5,5,5],renderBase:0}]}:{},
    W:{rivStrips:[{pts,hw:[5,5,5,5,5],ys:pts.map(()=>simY)}],settlements:[]},
    lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist2d:(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz),
    segDist:(px,pz,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,L2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/L2));return Math.hypot(px-(a.x+dx*t),pz-(a.z+dz*t));},
    inPoly:()=>false,riverAt:(x,z)=>Math.abs(z)<5?{a:{x:-1,z:0},b:{x:1,z:0},y:simY,hw:5}:null,hAt:(x,z)=>Math.abs(z)<5?bed:bank});
  vm.runInContext(source.match(/^const MILL_DIP=.*$/m)[0]+'\n'+['riverDrawLevel','riverDrawProfile','riverSurfaceAt','millDrive','millWheelFit','millWheelPose','millPaddleToWater'].map(extract).join('\n'),C);
  // a 9 m mill on the north bank, its wheel 1.25 m inside the water's edge and 6.8 m from its centre, as millBankSites lays it
  const b={x:-6,z:5-inset+6.8,w:9,d:9,rot:Math.PI/2,y:bank,y0:found??bank-0.8,h:7.35,millWater:{x:-6,z:5-inset,y:simY,side:0,offset:6.8,kind:'river'}};
  return{C,b,s:{}};
}
test('the drawn wheel dips a fixed depth into the stream as drawn, below the simulation level the old wheel hung from',()=>{
  for(const [bed,simY,bank] of [[2,3,4],[2,4.5,4.2],[2,3,9],[2,3.2,2.5],[30,31.5,33]]){
    const {C,b,s}=wheelWorld({bed,simY,bank}),P=C.millWheelPose(s,b),old=C.millDrive(s,b),drawn=bed+0.35;
    assert.ok(Math.abs(P.water-drawn)<1e-9,'the drawn level is the bed + 0.35');
    assert.ok(old.axleY-old.radius>drawn,'millDrive alone leaves the buckets above the drawn water');
    assert.ok(Math.abs(P.axleY-P.radius-(drawn-0.3))<1e-9,'the lowest buckets run 0.3 deep');
    assert.ok(P.radius>=1.2-1e-9&&P.radius<=2.7+1e-9,`a wheel for a 9 m mill (${P.radius})`);
    assert.ok(P.axleY<=bank+0.5+1e-9||P.radius<=1.2+1e-9,'the axle comes no higher than the floor unless the wheel is already at its least');
    assert.ok(P.axleY>=b.y0+0.3-1e-9||P.radius>=2.7-1e-9,'the shaft meets the wall, not the bank beneath it');
    assert.ok(Math.abs(P.gap-2.3)<1e-9,'the shaft runs 2.3 m from the wheel to the wall face');
    assert.equal(P.mode,old.mode);assert.equal(P.direction,old.direction);
  }
});
test('a high bank takes the largest wheel the wall carries; an overshot rim rises to its race',()=>{
  const high=wheelWorld({bed:2,simY:3,bank:12,found:6}),H=high.C.millWheelPose(high.s,high.b);
  assert.ok(Math.abs(H.radius-2.7)<1e-9);assert.ok(Math.abs(H.axleY-(2.05+2.7))<1e-9);
  const {C}=wheelWorld(),race=b=>({mode:'overshot',feed:{a:{x:0,z:0,y:9},b:{x:0,z:0,y:b}}});
  const fit=C.millWheelFit(race(6.5),3,5,4,9);assert.ok(Math.abs(fit.axleY+fit.radius-(6.5-0.12))<1e-9,'the rim meets the race end');assert.ok(Math.abs(fit.bottom-2.7)<1e-9);
  const tall=C.millWheelFit(race(12),3,5,4,9);assert.ok(Math.abs(tall.radius-2.7)<1e-9,'a race far above falls onto the largest wheel');assert.ok(Math.abs(tall.bottom-2.7)<1e-9);
});
test('the drawn level is read from the built river mesh where it stands (a junction pool raises it)',()=>{
  const {C,b,s}=wheelWorld({mesh:i=>i%5===2?(i<12?2.6:3.1):0}),P=C.millWheelPose(s,b);
  assert.ok(Math.abs(P.water-2.85)<1e-9,'halfway between centre-line vertices 2.6 and 3.1');assert.ok(Math.abs(P.axleY-P.radius-2.55)<1e-9);
});

test('a wheel in the river\'s pale shallows stands in a tail race of drawn water reaching clear water, short of its wall',()=>{
  for(const inset of[1.25,1.6]){const {C,b,s}=wheelWorld({inset}),P=C.millWheelPose(s,b),bare={...P,race:null};
    assert.ok(Math.abs(P.bank-inset)<1e-9,'the wheel stands this far inside the drawn edge');
    assert.ok(C.millPaddleToWater(bare)>0.2,'without its race the lowest paddle hangs over the shallows the shader draws as gravel');
    assert.equal(C.millPaddleToWater(P),0,'its race puts the lowest paddle in drawn water');
    assert.ok(P.race.u0<-0.675&&P.race.u0>-P.gap,'the race runs under the whole paddle and stops short of the wall');
    assert.ok(P.bank+P.race.u1>=1.9,'and out to clear water');assert.ok(P.race.half*2>2*Math.sqrt(P.radius**2-(P.radius-0.3)**2),'as wide as the wheel stands in it');}
  const deep=wheelWorld({inset:3.2}),D=deep.C.millWheelPose(deep.s,deep.b);assert.equal(D.race,null,'a wheel already in clear water needs none');assert.equal(deep.C.millPaddleToWater(D),0);
});
test('a pond race ends on the drawn wheel: over an overshot rim, or beside an underfed one just above the drawn stream',()=>{
  const {C,b}=wheelWorld({bed:2,simY:3,bank:4}),plane=(q,P)=>(q.x-P.x)*Math.sin(P.th)+(q.z-P.z)*Math.cos(P.th);
  b.millWater.intake={x:-6,z:-30};const modes=new Set();
  for(const lake of[{y:9,poly:[],dam:{x:-6,z:-25,a:Math.PI/2}},{y:4.6,poly:[],dam:{x:-6,z:-25,a:Math.PI/2}}]){const P=C.millWheelPose({lake},b),sim=C.millDrive({lake},b);
    assert.ok(P.feed&&sim.feed);assert.deepEqual(P.feed.a,sim.feed.a,'the race leaves the pond where it did');
    const u=plane(P.feed.b,P),v=P.feed.b.y-P.axleY;
    if(P.mode==='overshot'){assert.ok(Math.abs(Math.hypot(u,v-0.12)-P.radius)<1e-9,'it spills onto the top of the rim');assert.ok(v>0);}
    else{assert.ok(Math.abs(P.feed.b.y-(P.water+0.16))<1e-9,'it runs in just above the drawn stream');assert.ok(Math.abs(Math.hypot(u,v)-P.radius)<1e-9,'at the rim');}
    modes.add(P.mode);
  }
  assert.equal(modes.size,2,'both an overshot and an underfed race');
});
