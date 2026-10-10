import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const region=(html,from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert.ok(a>=0&&b>a,`missing source region ${from}`);return html.slice(a,b);};
const declaration=(html,name)=>{const re=new RegExp(`^function ${name}\\([\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'),m=html.match(re);assert.ok(m,`missing function ${name}`);return m[0];};

// Frozen c479429 grid with only its annual early return removed; no git-history dependency.
const frozenField=String.raw`let QUERY_LAND_VALUES=null; // disposable memo for one read request; model valuation remains simulation-owned
const LVC=16;
function lvBin(P,sz){const M=new Map();for(const q of P){const k=Math.floor(q[0]/sz)+','+Math.floor(q[1]/sz),o=M.get(k);if(o){o[0]+=q[0]*q[2];o[1]+=q[1]*q[2];o[2]+=q[2];}else M.set(k,[q[0]*q[2],q[1]*q[2],q[2]]);}return [...M.values()].map(o=>[o[0]/o[2],o[1]/o[2],o[2]]);} // nearby places of work, or homes, taken together
function lvJobs(s){ // where the town's work is, and how many hands each place employs
  const J=[];
  for(const b of s.buildings){if(b.removed||b.state!=='sound')continue;const a=b.arch;
    const w=a==='keep'?6:a==='hall'||a==='guildhall'?4:a==='temple'?(b.cathedral?4:1.5):a==='wharf'?5:a==='warehouse'||a==='granary'?3:a==='mill'||a==='windmill'?2:
      a==='shop'||a==='smithy'||a==='bakery'||a==='tavern'||a==='inn'||a==='tannery'||a==='dyer'||a==='bath'||a==='hospital'||a==='court'?2+b.tier*0.5:a==='burgher'?1:a==='quarry'?3:0;
    if(w)J.push([b.x,b.z,w]);}
  for(const p of s.places||[])if(p.kind==='market')J.push([p.x,p.z,10]);
  return J;}
function lvField(s){
  const query=typeof QUERY_LAND_VALUES==='undefined'?null:QUERY_LAND_VALUES,cached=query?.get(s)||s._lvf;
  
  const R=Math.max(s.wallR||0,(s.extentR||s.radius||100))+90,x0=s.pos.x-R,z0=s.pos.z-R,n=Math.ceil(2*R/LVC),N=n*n;
  const job=new Float32Array(N),hh=new Float32Array(N),mk=new Float32Array(N),ft=new Float32Array(N),nu=new Float32Array(N);
  const J=lvBin(lvJobs(s),32),H0=[];for(const b of s.buildings)if(!b.removed&&b.state==='sound'&&RESID.has(b.arch))H0.push([b.x,b.z,1]);const H=lvBin(H0,32);
  const M=(s.places||[]).filter(p=>p.kind==='market'),NU=s.buildings.filter(b=>!b.removed&&(b.arch==='tannery'||b.arch==='dyer'));
  const cx=i=>x0+(i+0.5)*LVC,cz=j=>z0+(j+0.5)*LVC;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=cx(i),z=cz(j),k=j*n+i;let a=0,b=0,c=0,d=0;
    for(const q of J){const dd=Math.abs(q[0]-x)+Math.abs(q[1]-z);if(dd<700)a+=q[2]*Math.exp(-Math.hypot(q[0]-x,q[1]-z)/100);} // a walk to work: a quarter mile is far
    for(const q of H){if(Math.abs(q[0]-x)>200||Math.abs(q[1]-z)>200)continue;b+=q[2]*Math.exp(-Math.hypot(q[0]-x,q[1]-z)/70);}
    for(const p of M)c+=Math.exp(-dist2d(p.x,p.z,x,z)/90);
    for(const o of NU)d+=Math.exp(-dist2d(o.x,o.z,x,z)/35);
    job[k]=a;hh[k]=b;mk[k]=c;nu[k]=d;}
  for(const st of s.streets||[]){if(st.hidden||st.gone||st.kind==='edge')continue;const w=st.kind==='road'||st.kind==='mstreet'||st.market?1:st.kind==='quay'?0.9:0.55; // the street at the door: its passing trade
    for(const p of resample(st.pts,5)){const i0=Math.floor((p.x-x0)/LVC),j0=Math.floor((p.z-z0)/LVC);
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=i0+di,j=j0+dj;if(i<0||j<0||i>=n||j>=n)continue;const dd=Math.hypot(cx(i)-p.x,cz(j)-p.z)-st.hw;const v=w*Math.exp(-Math.max(0,dd)/10);const k=j*n+i;if(v>ft[k])ft[k]=v;}}}
  const mx=A=>{let m=1e-6;for(const v of A)if(v>m)m=v;return m;},mj=mx(job),mh=mx(hh),mm=mx(mk);
  const fear=(s.raidedUntil>day()?1:0)+(s.siegeBy?1:0)+(W.war?0.4:0),res=new Float32Array(N),biz=new Float32Array(N);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,x=cx(i),z=cz(j),safe=inWalls(s,x,z)?0.3+0.25*fear:0,stink=Math.min(1,nu[k]);
    res[k]=Math.max(0.03,0.06+0.85*job[k]/mj+0.3*mk[k]/mm+safe-0.35*stink);
    biz[k]=Math.max(0.02,0.05+0.9*ft[k]*(0.4+0.6*hh[k]/mh)+0.45*mk[k]/mm+0.25*hh[k]/mh+safe*0.5-0.15*stink);}
  const value={y:year(),n:s.buildings.length,x0,z0,cells:n,res,biz,scale:Math.pow(Math.max(20,s.pop),0.3)};if(query)query.set(s,value);else s._lvf=value;return value;}
`;
const frozen=source.replace(region(source,'let QUERY_LAND_VALUES=', 'function lvAt('),frozenField);

function world(){
  const s={name:'Test town',pos:{x:11,z:-7},radius:80,extentR:88,wallR:73,pop:420,raidedUntil:0,siegeBy:null,
    buildings:[
      {x:7,z:5,arch:'house',tier:0,cathedral:false,state:'sound',removed:false},
      {x:25,z:-6,arch:'burgher',district:'market',tier:1,cathedral:false,state:'sound',removed:false},
      {x:-27,z:18,arch:'tannery',tier:0,cathedral:false,state:'ruined',removed:false},
      {x:42,z:30,arch:'shop',tier:2,cathedral:false,state:'sound',removed:false},
      {x:-34,z:-31,arch:'mill',tier:1,cathedral:false,state:'sound',removed:false}
    ],
    places:[{kind:'market',x:16,z:12},{kind:'well',x:-50,z:20}],
    streets:[
      {kind:'road',market:false,hw:3,hidden:false,gone:false,pts:[{x:-80,z:1},{x:-20,z:3},{x:30,z:1},{x:90,z:8}]},
      {kind:'lane',market:true,hw:2,hidden:false,gone:false,pts:[{x:-3,z:-70},{x:1,z:-20},{x:3,z:40}]},
      {kind:'quay',market:false,hw:4,hidden:false,gone:false,pts:[{x:70,z:-50},{x:45,z:-44}]},
      {kind:'edge',market:false,hw:2,hidden:false,gone:false,pts:[{x:-60,z:60},{x:65,z:65}]}
    ],
    wallRad:new Float32Array(16).fill(66),_lvf:null};
  return s;
}

function makeRealm(html,{instrument=false}={}){
  const start=region(html,'let QUERY_LAND_VALUES=', 'function lvAt(');
  let field=start;
  if(instrument){const needle='function lvBin(P,sz){';assert.ok(field.includes(needle),'lvBin declaration must remain extractable for instrumentation');field=field.replace(needle,needle+'globalThis.__lvBinCalls=(globalThis.__lvBinCalls||0)+1;');}
  const helpers=[declaration(html,'wallRadAt'),declaration(html,'inWalls'),region(html,'function lerpPt(', 'function smoothPath(')];
  // The polyline helper slice above includes lerpPt and resample, matching the game implementation.
  const prelude=`const RESID=new Set(['house','burgher','keep','hall','guildhall','temple','wharf','warehouse','granary','mill','windmill']);
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
    const dist2d=(x,z,X,Z)=>Math.hypot(X-x,Z-z);`;
  const native=field.includes('function lvInputs(')?`const LV_NATIVE={inputs:lvInputs,kernel:lvKernel,compose:lvCompose,same:lvSame,fear:lvFear,wallKey:lvWalls,jobs:lvJobs,bin:lvBin,resample,point:lerpPt,lerp,dist:dist2d,walls:inWalls,rad:wallRadAt,resid:RESID,has:RESID.has,roles:[...RESID]};`:'';
  const code=[prelude,...helpers,field,native,';globalThis.api={lvField,lvBin,lvJobs};'].join('\n');
  const s=world(),W={war:null,rng:{sim:117,build:33,trade:89},settlements:[s]};
  const c=vm.createContext({s,W,year:()=>4,day:()=>125,__lvBinCalls:0});
  vm.runInContext(code,c,{filename:'live-property-field-fixture.js'});
  return {s,W,c,api:c.api};
}

function arrays(field){return {res:Array.from(field.res),biz:Array.from(field.biz)};}
function closeToOriginal(current,reference,label){
  assert.deepEqual(arrays(current),arrays(reference),`${label}: Float32 land-value cells must match the original cold calculation`);
  assert.equal(current.x0,reference.x0,`${label}: x origin`);assert.equal(current.z0,reference.z0,`${label}: z origin`);
  assert.equal(current.cells,reference.cells,`${label}: grid dimensions`);
}
function scenario(label,mutate=()=>{}){
  const expected=makeRealm(frozen),actual=makeRealm(source,{instrument:true});
  mutate(expected.s,expected);mutate(actual.s,actual);
  closeToOriginal(actual.api.lvField(actual.s),expected.api.lvField(expected.s),label);
  return {expected,actual};
}

test('current property field stays byte-equal to the original cold grid for all ordered geometry inputs',()=>{
  scenario('initial cold field');
  const edits=[
    ['settlement position and grid bounds',s=>{s.pos.x+=9;s.pos.z-=13;s.extentR+=16;s.wallR-=4;}],
    ['fallback radius bound',s=>{s.extentR=0;s.wallR=0;s.radius+=29;}],
    ['same-count building position',s=>{s.buildings[1].x+=19;s.buildings[1].z-=11;}],
    ['same-count working tier',s=>{s.buildings[3].tier+=2;}],
    ['same-count building use and status',s=>{s.buildings[0].arch='temple';s.buildings[0].cathedral=true;s.buildings[0].state='ruined';}],
    ['building removal and order',s=>{s.buildings[2].removed=true;s.buildings.reverse();}],
    ['same-count market coordinate, kind and order',s=>{s.places[0].x-=21;s.places[0].z+=17;s.places[1].kind='market';s.places.reverse();}],
    ['same-count nuisance position',s=>{s.buildings[2].x+=18;s.buildings[2].z-=20;}],
    ['same-count street geometry, flags, order and width',s=>{s.streets[0].pts[1].x+=23;s.streets[0].kind='lane';s.streets[0].market=true;s.streets[0].hw+=2;s.streets[2].hidden=true;s.streets[1].gone=true;s.streets.reverse();}],
    ['wall radial samples',s=>{s.wallRad[3]-=19;s.wallRad[11]+=12;}]
  ];
  for(const [label,edit] of edits)scenario(label,s=>edit(s));
});

test('same-count geometry edits invalidate a warmed certificate and preserve the cold result',()=>{
  const edits=[
    ['town position and bounds',s=>{s.pos.x+=9;s.pos.z-=13;s.extentR+=16;s.wallR-=4;}],
    ['fallback radius bound',s=>{s.extentR=0;s.wallR=0;s.radius+=29;}],
    ['building coordinates',s=>{s.buildings[1].x+=19;s.buildings[1].z-=11;}],
    ['working tier',s=>{s.buildings[3].tier+=2;}],
    ['building type and state',s=>{s.buildings[0].arch='temple';s.buildings[0].cathedral=true;s.buildings[0].state='ruined';}],
    ['building removal and order',s=>{s.buildings[2].removed=true;s.buildings.reverse();}],
    ['market coordinates, kind and order',s=>{s.places[0].x-=21;s.places[0].z+=17;s.places[1].kind='market';s.places.reverse();}],
    ['nuisance coordinates',s=>{s.buildings[2].x+=18;s.buildings[2].z-=20;}],
    ['street points, kind, width, order and flags',s=>{s.streets[0].pts[1].x+=23;s.streets[0].kind='lane';s.streets[0].market=true;s.streets[0].hw+=2;s.streets[2].hidden=true;s.streets[1].gone=true;s.streets.reverse();}]
  ];
  for(const [label,edit] of edits){
    const expected=makeRealm(frozen),actual=makeRealm(source,{instrument:true});actual.api.lvField(actual.s);const prior=actual.c.__lvBinCalls;
    edit(expected.s);edit(actual.s);
    closeToOriginal(actual.api.lvField(actual.s),expected.api.lvField(expected.s),label);
    assert.ok(actual.c.__lvBinCalls>prior,`${label}: changed ordered source inputs must rebuild the base`);
  }
});

test('population, current fear, walls, and residential membership are composed from live values',()=>{
  for(const [label,edit] of [
    ['population',s=>{s.pop=1500;}],
    ['expired raid becomes current raid',s=>{s.raidedUntil=126;}],
    ['siege',s=>{s.siegeBy='besieger';}],
    ['realm war',(_s,r)=>{r.W.war={active:true};}],
    ['RESID membership',(_s,r)=>vm.runInContext("RESID.delete('house');RESID.add('shop')",r.c)]
  ])scenario(label,(s,r)=>edit(s,r));
});

test('native base is built cold once, reused unchanged, and rebuilt for same-count edits',()=>{
  const {s,c,api}=makeRealm(source,{instrument:true});
  const first=api.lvField(s);assert.equal(c.__lvBinCalls,2,'cold base bins work and home sources once each');
  const second=api.lvField(s);assert.equal(c.__lvBinCalls,2,'an unchanged certified grid reuses its expensive base');assert.equal(first,second);
  s.streets[0].pts[1].z+=7;
  api.lvField(s);assert.equal(c.__lvBinCalls,4,'a same-count point edit invalidates the complete ordered certificate');
  api.lvField(s);assert.equal(c.__lvBinCalls,4,'the edited certificate then reuses its base');
  assert.equal(JSON.stringify(c.W.rng),JSON.stringify({sim:117,build:33,trade:89}),'field reads consume no RNG');
});

test('fear and population refresh without rebuilding geometric bins; query misses stay request-local',()=>{
  const {s,c,api}=makeRealm(source,{instrument:true}),reference=makeRealm(frozen);
  const canonical=api.lvField(s);reference.api.lvField(reference.s);const calls=c.__lvBinCalls;
  s.raidedUntil=reference.s.raidedUntil=126;const feared=api.lvField(s),expectedFear=reference.api.lvField(reference.s);
  assert.notEqual(feared,canonical,'fear produces current final values');closeToOriginal(feared,expectedFear,'live raid fear');
  assert.equal(c.__lvBinCalls,calls,'fear only recomposes the saved geometric kernel');
  const scale=feared.scale;s.pop=reference.s.pop=900;const populous=api.lvField(s),expectedPopulation=reference.api.lvField(reference.s);
  closeToOriginal(populous,expectedPopulation,'live population');assert.equal(populous.scale,Math.pow(900,0.3));assert.notEqual(populous.scale,scale);assert.equal(c.__lvBinCalls,calls);
  const q=makeRealm(source,{instrument:true}),worldBefore=JSON.stringify(q.W);
  const query=vm.runInContext('QUERY_LAND_VALUES=new Map();lvField(s)',q.c);
  assert.equal(q.s._lvf,null,'a query miss must not install a settlement cache');assert.equal(vm.runInContext('LV_BASES.has(s)',q.c),false,'a query miss must not populate the canonical private WeakMap');
  const queryCalls=q.c.__lvBinCalls;assert.equal(vm.runInContext('lvField(s)',q.c),query);assert.equal(q.c.__lvBinCalls,queryCalls,'repeated query-local reads reuse the request entry');
  assert.equal(JSON.stringify(q.W),worldBefore,'query-local misses leave W unchanged');assert.equal(JSON.stringify(q.W.rng),JSON.stringify({sim:117,build:33,trade:89}));
});

test('wall samples and RESID membership invalidate a warmed field without changing array lengths',()=>{
  for(const [label,edit] of [
    ['wall radial samples',(s)=>{s.wallRad[3]-=19;s.wallRad[11]+=12;}],
    ['RESID membership',(_s,r)=>vm.runInContext("RESID.delete('house');RESID.add('shop')",r.c)]
  ]){
    const expected=makeRealm(frozen),actual=makeRealm(source,{instrument:true});actual.api.lvField(actual.s);const prior=actual.c.__lvBinCalls;
    edit(expected.s,expected);edit(actual.s,actual);
    closeToOriginal(actual.api.lvField(actual.s),expected.api.lvField(expected.s),label);
    if(label==='RESID membership')assert.ok(actual.c.__lvBinCalls>prior,'RESID content participates in the certificate');
    else assert.equal(actual.c.__lvBinCalls,prior,'wall changes recompose from the retained base kernel');
  }
});

test('changed native helper identities bypass reuse and read through the override',()=>{
  for(const [label,override] of [
    ['lvJobs',"const originalJobs=lvJobs;lvJobs=x=>originalJobs(x).concat([[90,-20,9]])"],
    ['resample',"const originalResample=resample;resample=(p,step)=>originalResample(p,step).map(q=>({...q,x:q.x+13}))"]
  ]){
    const {s,c,api}=makeRealm(source,{instrument:true});api.lvField(s);const calls=c.__lvBinCalls;
    vm.runInContext(override,c);const changed=api.lvField(s);
    assert.ok(c.__lvBinCalls>calls,`${label} override must bypass the certified base`);
    const expected=makeRealm(frozen);vm.runInContext(override,expected.c);
    closeToOriginal(changed,expected.api.lvField(expected.s),`${label} override`);
  }
});
