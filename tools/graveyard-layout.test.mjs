import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0];
function fixture(){
  const F={k:1,kind:1,state:0,crofts:0},C=vm.createContext({
    hash01:n=>((Math.sin(n*12.9898)*43758.5453)%1+1)%1,Math,Set,Infinity,
    G:{},W:{land:{F:[F],mask:new Uint8Array(1000000)},water:new Uint8Array(1000000)},SEA:-100,
    LS:{TILLED:2,PASTURE:3,BURNT:5,SCRUB:4,WOOD:1},LK:{NONE:0},ARABLE:new Set([1]),
    toCell:n=>Math.floor(n/15)+50,inB:(x,z)=>x>=0&&x<100&&z>=0&&z<100,cIdx:(x,z)=>z*1000+x,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    hAt:()=>10,riverAt:()=>false,lakeAt:()=>false,furlongAt:()=>F,
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,day:()=>10000,
  });
  const history=source.match(/^class HistoryGraph\{[\s\S]*?(?=^class |^function |^const |^\/\*|$(?![\s\S]))/m)?.[0];
  vm.runInContext([fn('polyArea'),fn('inPolyXZ'),fn('segDist'),fn('segSegDist'),fn('graveyardShape'),fn('graveyardClipToParcel'),fn('graveyardSetShape'),fn('placeChurchyardInHash'),fn('graveyardLotClip'),fn('rejectChurchyardCandidate'),fn('bestChurchyardFallback'),fn('chooseChurchyardSite'),fn('finishChurchyard'),fn('graveyardLandClear'),fn('graveyardSampleClear'),fn('graveyardFootprintInside'),fn('graveyardInsideParcel'),fn('graveyardPolygonsOverlap'),fn('graveyardMarkers'),fn('graveyardBurials'),history].join('\n'),C);
  return{C,F};
}

test('graveyard is irregular, bounded, and monuments remain inside its parcel shape',()=>{
  const{C}=fixture(),yard=vm.runInContext("({x:50,z:50,w:14,d:17,rot:.4,poly:graveyardShape(50,50,.4,6.55,8.05,19)})",C);
  assert.equal(yard.poly.length,14);
  assert.ok(new Set(yard.poly.map(p=>p.x.toFixed(3)+','+p.z.toFixed(3))).size>12);
  const markers=vm.runInContext('graveyardMarkers(yard,24)',Object.assign(C,{yard}));
  assert.ok(markers.length<=24&&markers.length>0);
  assert.ok(markers.every(p=>vm.runInContext(`graveyardFootprintInside(yard,${p.x},${p.z},${p.kind==='tomb'?1.05:0.76},${p.kind==='tomb'?0.68:0.22})`,Object.assign(C,{yard}))));
});

test('graveyard land rejects worked, grazed, burnt, scrubbed, and cropped ground',()=>{
  const{C,F}=fixture(),yard=vm.runInContext("graveyardShape(50,50,0,6,7,1)",C);
  assert.equal(vm.runInContext('graveyardLandClear(s,yard,1)',Object.assign(C,{yard,s:{}})),true);
  for(const state of[2,3,5,4]){F.state=state;assert.equal(vm.runInContext('graveyardLandClear(s,yard,1)',Object.assign(C,{yard,s:{}})),false);}
  F.state=0;F.crofts=1;assert.equal(vm.runInContext('graveyardLandClear(s,yard,1)',Object.assign(C,{yard,s:{}})),false);
});

test('pre-survey church layout can site against terrain before furlongs are initialized',()=>{
  const{C}=fixture(),yard=vm.runInContext("graveyardShape(50,50,0,6,7,1)",C);C.G={};
  assert.equal(vm.runInContext('graveyardLandClear(s,yard,undefined)',Object.assign(C,{yard,s:{}})),true);
  C.W.water[53053]=1;
  assert.equal(vm.runInContext('graveyardLandClear(s,yard,undefined)',Object.assign(C,{yard,s:{}})),false);
});

test('only recent burials assigned to this church consume its bounded capacity',()=>{
  const{C}=fixture(),church={id:1},other={id:2},s={dead:[
    {burial:church,dd:9999},{burial:church,dd:9998},{burial:other,dd:9999},{burial:church,dd:2799},
  ]};
  const out=vm.runInContext('graveyardBurials(s,church,1)',Object.assign(C,{s,church}));
  assert.equal(out.length,1);assert.equal(out[0].dd,9999);assert.equal(s.dead.length,4);
});

test('on-site yard takes precedence; fallback chooses the least costly accessible parcel',()=>{
  const{C}=fixture(),yard={id:'yard'},other={id:'other'};
  const preferred=vm.runInContext('chooseChurchyardSite(onSite,options)',Object.assign(C,{onSite:[yard],options:[{yard:other,cost:0,r:30,a:2}]}));
  assert.equal(preferred,yard); // the caller only invokes fallback after both church-property sides fail
  const fallback=vm.runInContext('chooseChurchyardSite([],options)',Object.assign(C,{onSite:[],options:[{yard:other,cost:3,r:20,a:0},{yard,cost:1,r:40,a:2}]}));
  assert.equal(fallback,yard);
});

test('churchyard street and mask commit wait for surveyed land and happen only once',()=>{
  const{C}=fixture(),yard={adjunct:true,access:[{x:1,z:1},{x:2,z:2}]},b={_graveyard:yard},s={};let streets=0,marks=0,clears=0;
  Object.assign(C,{G:{land:{F:[],mask:new Uint8Array(1000000)},roadsDirty:false},addStreet:()=>{streets++;return{kind:'lane'};},
    markChurchyardBuilt:()=>{marks++;},clearLandAt:()=>{clears++;}});
  vm.runInContext("finishChurchyard(s,b,addStreet)",Object.assign(C,{s,b}));
  assert.equal(streets,0);assert.equal(marks,0);
  C.W.land._surveyed=true;
  vm.runInContext("finishChurchyard(s,b,addStreet)",Object.assign(C,{s,b}));
  assert.equal(streets,0);assert.equal(marks,0); // survey alone is insufficient before the authoritative church parcel exists
  b.lot=[{x:-10,z:-10},{x:10,z:-10},{x:10,z:10},{x:-10,z:10}];
  vm.runInContext("finishChurchyard(s,b,addStreet)",Object.assign(C,{s,b}));
  vm.runInContext("finishChurchyard(s,b,addStreet)",Object.assign(C,{s,b}));
  assert.equal(streets,1);assert.equal(marks,2);assert.equal(clears,2);assert.equal(C.G.roadsDirty,true);
});

test('yard registration is idempotent in a placement hash without adding symbol state',()=>{
  const{C}=fixture(),yard={x:1,z:2,w:14,d:17};let adds=0;const items=[];const hash={near:()=>items,add:o=>{adds++;items.push(o);}};
  Object.assign(C,{yard,hash});vm.runInContext('placeChurchyardInHash(hash,yard);placeChurchyardInHash(hash,yard)',C);
  assert.equal(adds,1);assert.deepEqual(Reflect.ownKeys(yard).filter(k=>typeof k==='symbol'),[]);
  const graph=vm.runInContext('new HistoryGraph()',C);assert.doesNotThrow(()=>graph.capture(yard));
  const nextItems=[],next={near:()=>nextItems,add:o=>{adds++;nextItems.push(o);}};Object.assign(C,{next});vm.runInContext('placeChurchyardInHash(next,yard)',C);
  assert.equal(adds,2);
});

test('rejected placements release their old footprint, and other house lots clip outside the yard',()=>{
  const{C}=fixture(),old={removed:false},b={_graveyard:old},yard=vm.runInContext("({x:0,z:0,w:14,d:17,rot:0,poly:graveyardShape(0,0,0,6,7,1)})",C);
  assert.equal(vm.runInContext('rejectChurchyardCandidate(b)',Object.assign(C,{b})),true);
  assert.equal(b._graveyard,null);assert.equal(old.removed,true);
  const plane=vm.runInContext('graveyardLotClip(yard,home)',Object.assign(C,{yard,home:{x:20,z:0}}));
  assert.ok(plane);
  assert.ok(yard.poly.every(p=>plane.nx*p.x+plane.nz*p.z>plane.c));
});

test('on-site yard clips to the church parcel and retains only full monument slots',()=>{
  const{C}=fixture(),yard=vm.runInContext("({x:0,z:0,w:14,d:17,rot:0,poly:graveyardShape(0,0,0,6.55,8.05,1)})",C),wide=[{x:-10,z:-10},{x:10,z:-10},{x:10,z:10},{x:-10,z:10}],narrow=[{x:-7,z:-6},{x:7,z:-6},{x:7,z:6},{x:-7,z:6}],tooSmall=[{x:-2,z:-2},{x:2,z:-2},{x:2,z:2},{x:-2,z:2}];
  assert.equal(vm.runInContext('graveyardInsideParcel(wide,yard.poly)',Object.assign(C,{wide,yard})),true);
  const clipped=vm.runInContext('graveyardClipToParcel(yard.poly,narrow)',Object.assign(C,{narrow,yard}));
  assert.ok(clipped?.length>=3);assert.ok(vm.runInContext('graveyardInsideParcel(narrow,clipped)',Object.assign(C,{narrow,clipped})));assert.ok(vm.runInContext('graveyardSetShape(yard,clipped)',Object.assign(C,{yard,clipped})));
  assert.ok(yard.area>=25);assert.ok(yard.capacity>=4);assert.equal(vm.runInContext('graveyardInsideParcel(narrow,yard.poly)',Object.assign(C,{narrow,yard})),true);
  assert.notEqual(yard.w.toFixed(2),yard.d.toFixed(2));
  const markers=vm.runInContext('graveyardMarkers(yard,24)',Object.assign(C,{yard}));assert.ok(markers.length>=4);
  assert.ok(markers.every(p=>vm.runInContext(`graveyardFootprintInside(yard,${p.x},${p.z},${p.kind==='tomb'?1.05:0.76},${p.kind==='tomb'?0.68:0.22})`,Object.assign(C,{yard}))));
  assert.equal(vm.runInContext('graveyardInsideParcel(narrow,yard.poly)',Object.assign(C,{narrow,yard})),true);
  const tiny=vm.runInContext('graveyardClipToParcel(subject,tooSmall)',Object.assign(C,{subject:yard.poly,tooSmall})),candidate={...yard};
  assert.equal(vm.runInContext('graveyardSetShape(candidate,tiny)',Object.assign(C,{candidate,tiny})),false);
});

test('on-site graves may use masked church land, while active or adjunct land remains protected',()=>{
  const{C,F}=fixture(),P=vm.runInContext('graveyardShape(50,50,0,2,2,1)',C),ci=C.toCell(50),cj=C.toCell(50),maskIndex=C.cIdx(ci,cj)*4+2;
  F.state=2;F.crofts=1;C.W.land.mask[maskIndex]=255;
  assert.equal(vm.runInContext('graveyardLandClear(s,P,1)',Object.assign(C,{P,s:{}})),true);
  assert.equal(vm.runInContext('graveyardLandClear(s,P,null)',Object.assign(C,{P,s:{}})),false);
  C.W.land.mask[maskIndex]=0;
  assert.equal(vm.runInContext('graveyardLandClear(s,P,1)',Object.assign(C,{P,s:{}})),false);
});

test('adjunct candidates overlapping any residential parcel are rejected geometrically',()=>{
  const{C}=fixture(),a=[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:0,z:4}],overlap=[{x:3,z:1},{x:5,z:1},{x:5,z:3},{x:3,z:3}],clear=[{x:6,z:1},{x:8,z:1},{x:8,z:3},{x:6,z:3}];
  assert.equal(vm.runInContext('graveyardPolygonsOverlap(a,overlap)',Object.assign(C,{a,overlap})),true);
  assert.equal(vm.runInContext('graveyardPolygonsOverlap(a,clear)',Object.assign(C,{a,clear})),false);
});
