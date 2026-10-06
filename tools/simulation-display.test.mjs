import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('land projection requests coalesce without writing shader buffers during settlement',()=>{
  const extract=name=>source.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
  const f={k:0,jx:0.2,jz:0.7,th:0.3,w:11,dom:2,kind:1,state:3,gf:2,lord:4,held:true},before=JSON.stringify(f);
  const tex=()=>({image:{data:new Uint8Array(4)},needsUpdate:false});
  const G={landView:{seedTex:tex(),dataTex:tex(),lordTex:tex(),maskTex:tex()}},W={land:{F:[f]}};
  const c=vm.createContext({MODEL_ONLY:false,BACKGROUND:null,G,W,f,overlayMode:null,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  vm.runInContext(['writeFurlong','projectFurlong','writeLord','projectLord','projectLandscape'].map(extract).join('\n'),c);
  c.writeFurlong(f);c.writeLord(f);c.writeFurlong(f);G.landMaskDirty=true;
  assert.equal(G.landDirty.size,1);
  assert.ok(G.landView.dataTex.image.data.every(v=>v===0));
  assert.equal(G.landView.maskTex.needsUpdate,false);
  c.projectLandscape();
  assert.deepEqual(Array.from(G.landView.dataTex.image.data),[3,1,3,2]);
  assert.deepEqual(Array.from(G.landView.lordTex.image.data),[5,255,0,0]);
  assert.equal(G.landDirty.size,0);assert.equal(G.landMaskDirty,false);
  assert.equal(JSON.stringify(f),before);
});
function region(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.notEqual(a,-1,`missing ${from}`);assert.ok(b>a,`missing ${to}`);return source.slice(a,b);}
function declaration(name){const a=source.indexOf(`function ${name}(`);assert.notEqual(a,-1,`missing ${name}`);const b=source.indexOf('\n',a);return source.slice(a,b<0?source.length:b);}
function run(code,globals={}){
  // Fixtures supply the single model records under their new simulation owner.
  if(globals.G){globals.W??={};for(const k of ['land','bldList','rivStrips','tg','trackSet'])if(globals.G[k]!==undefined)globals.W[k]??=globals.G[k];}
  globals.MODEL_ONLY??=false;
  globals.BACKGROUND??=null;const c=vm.createContext(globals);vm.runInContext(code,c);return c;}

test('display clock clamps queued backlog, rejects nonfinite interpolation, and never writes W.clock',()=>{
  const c=run('const day=()=>W.clock.day;\n'+region('function displayFrac(', 'function entityView('),{W:{clock:{day:42,frac:0.7}},G:{clockFrac:7},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  const before=JSON.stringify(c.W.clock);assert.equal(c.displayFrac(),0.999);assert.equal(c.displayDay(),42.999);assert.equal(JSON.stringify(c.W.clock),before);
  c.G.clockFrac=Infinity;assert.equal(c.displayFrac(),0);assert.equal(c.displayDay(),42);assert.equal(JSON.stringify(c.W.clock),before);
  delete c.G.clockFrac;assert.equal(c.displayFrac(),0.7);assert.equal(c.displayDay(),42.7);assert.equal(JSON.stringify(c.W.clock),before);
});

test('envoy expiry belongs to the tick and removes only dates at or before today, preserving survivors',()=>{
  const c=run(declaration('tickEnvoys'),{W:{envoys:[{id:'later',back:21},{id:'equal',back:20},{id:'earlier',back:19},{id:'later2',back:30}]},today:20,day:()=>c.today});
  c.tickEnvoys();assert.deepEqual(Array.from(c.W.envoys,e=>e.id),['later','later2']);
  c.today=21;c.tickEnvoys();assert.deepEqual(Array.from(c.W.envoys,e=>e.id),['later2']);
  c.tickEnvoys();assert.deepEqual(Array.from(c.W.envoys,e=>e.id),['later2']);
});

test('errand dates ignore display interpolation and use the same simulation-day RNG input',()=>{
  const c=run(source.slice(source.indexOf('function errand('),source.indexOf('\nfunction tickErrands()',source.indexOf('function errand('))),{
    W:{clock:{day:100,frac:0.9},travellers:[]},G:{clockFrac:0.8},simDay:100,WALK_MPD:750,
    day:()=>c.simDay,awayNow:()=>null,route:()=>({poly:[{x:0,z:0},{x:600,z:0}],len:600}),frand:()=>0.25
  });
  const p={id:1};assert.equal(c.errand(p,0,1,'market',1),true);const first=c.W.travellers.map(t=>({...t}));
  c.W.travellers=[];c.W.clock.frac=0.01;c.G.clockFrac=0.02;const q={id:2};assert.equal(c.errand(q,0,1,'market',1),true);
  assert.equal(c.W.travellers[0].depart,first[0].depart);assert.equal(c.W.travellers[0].arrive,first[0].arrive);
  assert.equal(c.W.travellers[1].depart,first[1].depart);assert.equal(c.W.travellers[1].arrive,first[1].arrive);
});

test('traffic interpolation follows calendar time, ignores selected speed, freezes while halted, and honors shifted siege dates',()=>{
  const c=run(source.slice(source.indexOf('function trafficDistance('),source.indexOf('\n/* map markers:',source.indexOf('function trafficDistance('))),{
    W:{clock:{day:15}},G:{clockFrac:0.5},speedIdx:1,day:()=>c.W.clock.day,displayDay:()=>c.W.clock.day+c.G.clockFrac,Math
  });
  const t={len:100,offset:0,spd:4,cons:{departDay:10,halted:false}};
  c.speedIdx=1;const walking=c.trafficDistance(t,15.5);c.speedIdx=5;assert.equal(c.trafficDistance(t,15.5),walking);assert.equal(walking,22);
  t.cons.halted=true;assert.equal(c.trafficDistance(t,99),20); // interpolation stops at canonical day 15
  t.cons.departDay=11; // sim tick shifts dates one day for each day held at a siege
  assert.equal(c.trafficDistance(t,99),16);
});

test('fast projection accumulates skipped frame time and runs immediately at pause, slower pace, or new world',()=>{
  const c=run(source.slice(source.indexOf('function projectWorld('),source.indexOf('\nfunction animate(',source.indexOf('function projectWorld('))),{G:{},speedIdx:5,VISUAL:{fast:()=>true},animateWorld:(dt,now)=>(c.calls.push([dt,now])),calls:[]});
  assert.equal(c.projectWorld(0.02,1),true);assert.equal(c.projectWorld(0.03,1.03),false);assert.equal(c.projectWorld(0.04,1.07),false);
  assert.deepEqual(c.calls,[[0.02,1]]);assert.equal(c.G.viewElapsed,0.07);
  assert.equal(c.projectWorld(0.01,1.11),true);assert.deepEqual(c.calls[1],[0.08,1.11]);
  c.speedIdx=4;assert.equal(c.projectWorld(0.02,1.12),true);assert.deepEqual(c.calls[2],[0.02,1.12]);
  c.speedIdx=0;assert.equal(c.projectWorld(0.01,1.13),true);assert.deepEqual(c.calls[3],[0.01,1.13]);
  c.speedIdx=5;c.G={};assert.equal(c.projectWorld(0.01,1.14),true);assert.deepEqual(c.calls[4],[0.01,1.14]);
  c.VISUAL.fast=()=>false;assert.equal(c.projectWorld(0.01,1.15),true);assert.deepEqual(c.calls[5],[0.01,1.15]);
});

function animationFixture(){
  let perf=0;const calls={sim:0,project:[],errors:0},c=run(source.slice(source.indexOf('function advanceSimulation('),source.indexOf('\n/* ---- performance monitor',source.indexOf('function animate(t){'))),{
    W:{clock:{day:10},settlements:[],armies:[],caravans:[]},G:{},SPEEDS:[0,1,2,3,4,30],speedIdx:5,simAccum:0,lastT:0,hudT:10,overlayT:10,uiT:0,
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),requestAnimationFrame(){},performance:{now:()=>perf},director:{update(){}},perfNow:()=>perf,updateCamera(){calls.cameraDay=c.W.clock.day;},
    projectWorld(dt,now){calls.project.push({dt,now,day:c.W.clock.day,frac:c.G.clockFrac});return false;},simTick(){calls.sim++;assert.equal(Number.isInteger(c.W.clock.day),true);c.W.clock.day++;perf+=29;return true;},
    simErr(){calls.errors++;},featFlush(){},refreshOrders(){},refreshOverlayNow(){},renderer:{render(){}},scene:{},camera:{},contextPosition(){},PERF:{on:false},HISTORY:{active:false},
    SPEEDS:null,perfGpuBegin(){},perfGpuEnd(){},perfFrame(){},console,Math,Number,Date
  });
  c.SPEEDS=[0,1,2,3,4,30];c.calls=calls;c.setPerf=v=>{perf=v;};c.lastT=0;return c;
}

test('animate keeps the simulation clock integral through camera/projection and exceptions, while throttled projection loses no ticks',()=>{
  const c=animationFixture();c.animate(100);assert.equal(c.calls.sim,1);assert.equal(c.W.clock.day,11);
  assert.equal(c.calls.cameraDay,11);assert.equal(c.calls.project[0].day,11);assert.equal(c.calls.project[0].frac,0.999);
  // A projection failure is caught after simulation advancement; no fractional display date is left behind.
  c.projectWorld=()=>{throw new Error('projection failed');};c.lastT=0.1;c.setPerf(1000);c.animate(200);
  assert.equal(c.W.clock.day,12);assert.equal(Number.isInteger(c.W.clock.day),true);assert.equal(c.calls.errors,1);
  // Rendering can be throttled independently; simulation still consumes the full accumulated day budget.
  c.projectWorld=()=>false;c.simTick=()=>{c.calls.sim++;c.W.clock.day++;return true;};c.lastT=0.2;c.setPerf(2000);for(const t of[300,400,500])c.animate(t);
  assert.equal(c.W.clock.day,24);assert.equal(c.calls.sim,14);assert.equal(Number.isInteger(c.W.clock.day),true);
});

test('settleParcels computes b.lot and b._inCastle independently of rendering context',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const s={kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[]};
  const b1={x:10,z:10,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const b2={x:50,z:50,w:10,d:10,rot:0,s,state:'sound',arch:'keep'};
  s.buildings.push(b1,b2);
  const marked=[];

  const c=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[s],roads:[],land:{mask:new Uint8Array(4)}},
    G:{rivStrips:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    castleKeepOut:()=>[{x:50,z:50,r:15,motte:false}],
    markLot:P=>marked.push(P),
    Math,Set,Map
  });

  assert.equal(b1.lot,undefined);
  c.settleParcels();
  assert.ok(Array.isArray(b1.lot)&&b1.lot.length>=3);
  assert.equal(b1._inCastle,false);
  assert.ok(Array.isArray(b2.lot)&&b2.lot.length>=3);
  assert.equal(b2._inCastle,true);
  assert.equal(c.G.detDirty,true);
  assert.deepEqual(marked,[b1.lot],'castle courtyards must not exclude household farmland');

  // Batched settlement recalculates only targeted buildings and their spatial neighborhood
  const origLot=b1.lot;
  c.settleParcels([b1]);
  assert.notEqual(b1.lot,origLot);
  assert.ok(b1.lot.length>=3);
  assert.equal(marked.length,1,'unchanged neighboring parcels must not rescan the land mask');
});

test('rebuildDetails runs real featLots without stubbing and never mutates authoritative land mask',()=>{
  const rebuildDetailsSrc=region('function rebuildDetails(){','/* ---------------- town walls:');
  const featLotsSrc=region('function featLots(){','function featBuilding(b){');
  assert.equal(rebuildDetailsSrc.includes('finishYards'),false);
  assert.equal(featLotsSrc.includes('markLot'),false);

  const s={
    buildings:[],
    _lay:{
      finishYards(){throw new Error('finishYards must not be called during rebuildDetails');}
    }
  };
  const b={
    x:0,z:0,w:6,d:6,rot:0,state:'sound',arch:'house',h:4,y:0,s,idx:0,
    lot:[{x:-3,z:-3,e:0},{x:3,z:-3,e:0},{x:3,z:3,e:0},{x:-3,z:3,e:0}]
  };
  s.buildings.push(b);

  const mockMesh=()=>({
    instanceMatrix:{count:100,needsUpdate:false},
    setColorAt(){},
    geometry:{attributes:{}}
  });
  const fencesPlaced=[];
  const mask=new Uint8Array(256);
  const c=run(featLotsSrc+'\n'+rebuildDetailsSrc,{
    W:{settlements:[s],armies:[]},
    G:{
      bldList:[b],
      detDirty:true,
      det:{box:mockMesh(),fence:mockMesh(),cyl:mockMesh(),cone:mockMesh(),pyr:mockMesh(),gab:mockMesh()},
      lotMs:0,
      land:{mask},
      feat:{src:[null,null,null,null,null,new Uint8Array(256)],d2:new Uint8Array(1024),tex2:{needsUpdate:false}}
    },
    makeHash:()=>({add(){},near:()=>[]}),
    setInstTilt(m,idx,x,y,z,ry,px,pz,sx,sy,sz){fencesPlaced.push({x,z});},
    setInst(){},
    C1:{setHex(){}},
    STREETFRONT:{},
    roofRise:()=>2,
    hAt:()=>0,
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    markLot(){throw new Error('markLot must not be called during rendering!');},
    featRect(x0,z0,x1,z1,fn){fn(0,0,0);},
    featDirty(){},
    hash01:()=>0.5,
    inPoly:()=>true,
    VISUAL:{},
    performance:{now:()=>1},
    Math,Map,Set
  });

  c.rebuildDetails();
  assert.equal(c.G.detDirty,false);
  assert.ok(fencesPlaced.length>0);
  assert.equal(mask.reduce((a,v)=>a+v,0),0,'land mask must remain completely untouched by rendering');
});

test('footprint radii refresh on widening and update parcel bisectors before indexing',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const s={kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[]};
  const b={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house',_r:5};
  const o={x:20,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house',_r:5};
  s.buildings.push(b,o);

  const c=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[s],roads:[]},
    G:{rivStrips:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  // Widen b to 20m width, leaving _r intentionally stale at 5
  b.w=20;
  assert.equal(b._r,5);

  c.settleParcels([b]);
  // Radius must be refreshed: Math.hypot(20, 6) / 2 = 10.4403...
  assert.ok(Math.abs(b._r-10.4403)<0.01,`b._r should be refreshed to ~10.44, got ${b._r}`);
  const maxX=Math.max(...b.lot.map(p=>p.x));
  // Bisector cut against o at (20, 0) with refreshed radius 10.44 places boundary at x = 12.1 instead of 10.0
  assert.ok(maxX>11.5,`b.lot should extend beyond 11.5 towards o, got ${maxX}`);
});

test('affected neighbor coverage includes footprint-dependent range beyond 90m',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const s={kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[]};
  const m={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const o={x:128,z:0,w:40,d:40,rot:0,s,state:'sound',arch:'keep'};
  s.buildings.push(m,o);

  const c=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[s],roads:[]},
    G:{rivStrips:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  c.settleParcels();
  const initialOLot=JSON.stringify(o.lot);

  // Modify m: local settlement of [m] must find o at 128m because o._r = 28.28 gives range (58 + 28.28) * 1.5 = 129.4m > 128m
  m.w=16;
  m.d=16;
  c.settleParcels([m]);

  assert.notEqual(JSON.stringify(o.lot),initialOLot,'o.lot must update during local settlement of m');
  const localOLot=JSON.stringify(o.lot);
  c.settleParcels();
  const fullOLot=JSON.stringify(o.lot);
  assert.equal(localOLot,fullOLot,'Local settlement of [m] must match full solve for neighbor o at 128m');
});

test('settleParcels reuses existing settlement layout indexes and tickGrowth batches changes',()=>{
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  let makeHashCalls=0;
  const s={
    kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[],
    _lay:{
      placed:{near(x,z,r){return s.buildings.filter(b=>Math.hypot(b.x-x,b.z-z)<=r);}},
      segH:{near(x,z,r){return [];}}
    }
  };
  const b={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  s.buildings.push(b);

  const c=run(parcelsSrc,{
    W:{settlements:[s],roads:[]},
    G:{rivStrips:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    makeHash(){makeHashCalls++;return {add(){},near(){return [];}};},
    Math,Set,Map
  });

  c.settleParcels([b]);
  assert.equal(makeHashCalls,0,'settleParcels must reuse s._lay.placed and s._lay.segH without calling makeHash');

  // Verify tickGrowth batches structural updates without calling settleParcels per building inside loops
  const growthSrc=region('function tickGrowth(){','/* ============================ ACTS (triggers) ============================ */');
  assert.ok(growthSrc.includes('const newBlds=[];'));
  assert.ok(growthSrc.includes('if(newBlds.length)settleParcels(newBlds);'));
  assert.ok(growthSrc.includes('const widened=[];'));
  assert.ok(growthSrc.includes('if(widened.length)settleParcels(widened);'));
  assert.ok(!growthSrc.includes('settleParcels([b]);'),'tickGrowth must not settle individual parcels in loops');
});

test('new village creation and demolition settle affected parcels without renderer fallback',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const rebuildDetailsSrc=region('function rebuildDetails(){','/* ---------------- town walls:');

  // Demolition test: surviving neighbor expands when building removed
  const s={kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[]};
  const m={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const b={x:20,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  s.buildings.push(m,b);

  const c=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[s],roads:[]},
    G:{rivStrips:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  c.settleParcels();
  const mMaxXBefore=Math.max(...m.lot.map(p=>p.x));

  b.removed=true;
  b.state='gone';
  c.settleParcels([b]);
  assert.equal(b.lot,null,'demolished building lot must be cleared');
  const mMaxXAfter=Math.max(...m.lot.map(p=>p.x));
  assert.ok(mMaxXAfter>mMaxXBefore,`surviving neighbor parcel must expand into vacated space: ${mMaxXAfter} vs ${mMaxXBefore}`);

  // New village creation settles parcels
  const doActVillage=region("case 'village':{const ci=toCell(p.x),cj=toCell(p.z);","case 'gold':");
  assert.ok(doActVillage.includes('settleParcels(s.buildings)'),'new village creation must settle parcels for all new buildings');
  assert.ok(doActVillage.includes('s._lay?.finishYards?.()'),'new village creation must finish churchyard plots');

  // Removal of renderer fallback: rebuildDetails must not settle missing parcels
  assert.ok(!rebuildDetailsSrc.includes('settleParcels'),'rebuildDetails must not contain a fallback call to settleParcels');
  const unsetB={x:10,z:10,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const mockMesh=()=>({instanceMatrix:{count:100,needsUpdate:false},setColorAt(){},geometry:{attributes:{}}});
  const c2=run(rebuildDetailsSrc,{
    W:{settlements:[s],armies:[]},
    G:{
      bldList:[unsetB],
      detDirty:true,
      det:{box:mockMesh(),fence:mockMesh(),cyl:mockMesh(),cone:mockMesh(),pyr:mockMesh(),gab:mockMesh()},
      lotMs:0
    },
    makeHash:()=>({add(){},near:()=>[]}),
    setInstTilt(){},
    setInst(){},
    C1:{setHex(){}},
    STREETFRONT:{},
    roofRise:()=>2,
    hAt:()=>0,
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    featLots(){},
    VISUAL:{},
    performance:{now:()=>1},
    Math,Map,Set
  });
  c2.rebuildDetails();
  assert.equal(unsetB.lot,undefined,'rebuildDetails must not synthesize parcels for unsettled buildings');
});

test('caravan staffing runs once per departure and does not retry daily upon failed crew selection',()=>{
  const staffingSection=region('for(const c of W.caravans)if(!c._staffed)','// arrivals');
  let draws=0;
  const c={origin:0,dest:1,crew:null};
  const W={caravans:[c],prehistory:false};
  const ctx=run(`function tickStaffing(){ ${staffingSection} }`,{
    W,
    crewFor(caravan){
      for(let i=0;i<24;i++)draws++;
      // failed crew selection: caravan remains unstaffed
      caravan.crew=null;
    }
  });

  // Advance simulation for 5 days of unstaffable caravan
  for(let d=0;d<5;d++)ctx.tickStaffing();
  assert.equal(draws,24,'Caravan staffing must run exactly once (24 draws) and never retry daily (which would take 120 draws)');
  assert.equal(c._staffed,true);

  // Animation presentation pass never touches staffing
  const trafficSection=source.match(/^function ensureCaravanDisplay\b[^\n]+/m)[0]+'\n'+region('/* --- traffic: carts, barges and cogs on their own clock --- */','let ci=0,cogI=0,bargeI=0,dotI=0;');
  run(trafficSection,{W,G:{},spawnCarts(){}});
  assert.equal(draws,24,'Rendering traffic pass must not consume RNG draws or re-staff');
});

test('tickEconomy does not create presentation traffic entries or touch scene',()=>{
  const tickEconomySrc=region('function tickEconomy(){','/* ============================ POPULATION ================================= */');
  assert.equal(tickEconomySrc.includes('spawnCarts'),false);
  assert.equal(tickEconomySrc.includes('G.traffic'),false);
  assert.equal(tickEconomySrc.includes('scene'),false);
  assert.equal(tickEconomySrc.includes('proxy'),false);

  // Presentation traffic spawn inside animateWorld lazily provisions traffic
  const trafficSection=source.match(/^function ensureCaravanDisplay\b[^\n]+/m)[0]+'\n'+region('/* --- traffic: carts, barges and cogs on their own clock --- */','let ci=0,cogI=0,bargeI=0,dotI=0;');
  const spawnCalls=[];
  const c1={origin:0,dest:1,good:'wool',qty:20,poly:[{x:0,z:0},{x:100,z:0}],arriveDay:10,departDay:0};
  const animCtx=run(trafficSection,{
    W:{caravans:[c1]},G:{},
    spawnCarts(c){spawnCalls.push(c);}
  });
  assert.equal(animCtx.G.cartSpawned.has(c1),true);
  assert.equal(Object.hasOwn(c1,'_carts'),false);
  assert.equal(spawnCalls.length,1);
  assert.equal(spawnCalls[0],c1);

  // Subsequent animation frames do not re-spawn existing caravans
  spawnCalls.length=0;
  run(trafficSection,animCtx);
  assert.equal(spawnCalls.length,0);
});

test('local settlement with real layout hashes scopes road candidates once across structural batch',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const env=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[],roads:[]},
    G:{rivStrips:[],bldList:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  const s={
    kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const blds=Array.from({length:20},(_,i)=>{
    const b={x:i*6,z:0,w:5,d:5,rot:0,s,state:'sound',arch:'house'};
    s.buildings.push(b);
    s._lay.placed.add(b,Math.hypot(b.w,b.d)/2+1);
    return b;
  });
  env.W.settlements.push(s);
  env.G.bldList.push(...blds);

  let roadReads=0;
  env.W.roads=Array.from({length:100},(_,i)=>({
    get drawn(){
      roadReads++;
      return [{x:-5000+i*20,z:0},{x:-4900+i*20,z:0}];
    }
  }));

  env.settleParcels(blds);
  assert.equal(roadReads,100,`20-building batch should read 100 roads exactly 100 times, got ${roadReads}`);
});

test('churchyards in real placed hash are excluded from building bisectors and match full solve',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const env=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[],roads:[]},
    G:{rivStrips:[],bldList:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  const s={
    kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const church={x:0,z:0,w:16,d:10,rot:0,s,state:'sound',arch:'temple'};
  const yard={x:12,z:0,w:14,d:10,rot:0,s,state:'sound',arch:'churchyard',churchyardOf:church};
  s.buildings.push(church);
  s._lay.placed.add(church,Math.hypot(church.w,church.d)/2+1);
  s._lay.placed.add(yard,Math.hypot(yard.w,yard.d)/2+1);
  env.W.settlements.push(s);
  env.G.bldList.push(church);

  // Full solve
  env.settleParcels();
  const fullMaxX=Math.max(...church.lot.map(p=>p.x));

  // Local solve with real layout hash
  church.lot=null;
  env.settleParcels([church]);
  const localMaxX=Math.max(...church.lot.map(p=>p.x));

  assert.equal(localMaxX,fullMaxX,'Churchyard must not act as building bisector; local solve must match full solve exactly');
});

test('settleParcels envelope and candidate selection match full solve on road and street distances through Rx*1.3',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const env=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[],roads:[]},
    G:{rivStrips:[],bldList:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  const s={
    kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const b={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const road={path:[{x:70,z:-100},{x:70,z:100}]};
  s.buildings.push(b);
  s._lay.placed.add(b,Math.hypot(b.w,b.d)/2+1);
  env.W.settlements.push(s);
  env.W.roads.push(road);
  env.G.bldList.push(b);

  // Full solve
  env.settleParcels();
  const fullMaxX=Math.max(...b.lot.map(p=>p.x));
  assert.equal(Math.round(fullMaxX),63,'Full solver produces max lot x = 63');

  // Targeted solve
  b.lot=null;
  env.settleParcels([b]);
  const targetedMaxX=Math.max(...b.lot.map(p=>p.x));
  assert.equal(Math.round(targetedMaxX),63,'Targeted solver must produce max lot x = 63 matching full solver');
  assert.equal(targetedMaxX,fullMaxX);
});

test('removed streets are ignored and active edge streets clip parcels identically in real hashes',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const env=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[],roads:[]},
    G:{rivStrips:[],bldList:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  const s={
    kind:'town',pos:{x:0,z:0},streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const b1={x:0,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const b2={x:100,z:0,w:8,d:6,rot:0,s,state:'sound',arch:'house'};
  const goneSt={pts:[{x:12,z:-10},{x:12,z:10}],hw:1.5,kind:'lane',gone:true};
  const edgeSt={pts:[{x:112,z:-10},{x:112,z:10}],hw:0.5,kind:'edge'};
  s.buildings.push(b1,b2);
  s.streets.push(goneSt,edgeSt);
  s._lay.placed.add(b1,Math.hypot(b1.w,b1.d)/2+1);
  s._lay.placed.add(b2,Math.hypot(b2.w,b2.d)/2+1);
  s._lay.segH.add({a:goneSt.pts[0],b:goneSt.pts[1],hw:1.5,st:goneSt,x:12,z:0},10);
  env.W.settlements.push(s);
  env.G.bldList.push(b1,b2);

  // Full solve
  env.settleParcels();
  const fullB1X=Math.max(...b1.lot.map(p=>p.x));
  const fullB2X=Math.max(...b2.lot.map(p=>p.x));

  // Local solve
  b1.lot=null;
  b2.lot=null;
  env.settleParcels([b1,b2]);
  const localB1X=Math.max(...b1.lot.map(p=>p.x));
  const localB2X=Math.max(...b2.lot.map(p=>p.x));

  assert.equal(localB1X,fullB1X,'Gone street must be filtered in local solve, matching full solve without clipping');
  assert.equal(localB2X,fullB2X,'Edge street omitted from segH must be included in local solve, matching full solve clipping');
});

test('rural neighbor near adjacent town is scoped by geometry and matches full solve',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const env=run(makeHashSrc+'\n'+parcelsSrc,{
    W:{settlements:[],roads:[]},
    G:{rivStrips:[],bldList:[]},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
    Math,Set,Map
  });

  const townA={
    kind:'town',pos:{x:0,z:0},radius:90,streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const townB={
    kind:'town',pos:{x:1200,z:0},radius:90,streets:[],places:[],buildings:[],
    _lay:{placed:env.makeHash(16),segH:env.makeHash(24)}
  };
  const bA={x:980,z:0,w:8,d:6,rot:0,s:townA,state:'sound',arch:'house'};
  const bB={x:1000,z:0,w:8,d:6,rot:0,s:townB,state:'sound',arch:'house'};
  townA.buildings.push(bA);
  townB.buildings.push(bB);
  townA._lay.placed.add(bA,Math.hypot(bA.w,bA.d)/2+1);
  townB._lay.placed.add(bB,Math.hypot(bB.w,bB.d)/2+1);
  env.W.settlements.push(townA,townB);
  env.G.bldList.push(bA,bB);

  // Full solve
  env.settleParcels();
  const fullMaxX=Math.max(...bA.lot.map(p=>p.x));

  // Local solve
  bA.lot=null;
  bB.lot=null;
  env.settleParcels([bA]);
  const localMaxX=Math.max(...bA.lot.map(p=>p.x));

  assert.equal(localMaxX,990,'Local settlement of rural house must stop at x=990 bisector with town B neighbor');
  assert.equal(localMaxX,fullMaxX,'Local settlement of rural house must match full solve exactly');
});

test('multi-cadence equivalence: simulation produces identical outcomes headless (0 FPS), throttled, or continuous (60 FPS)',()=>{
  const makeHashSrc=source.slice(source.indexOf('let HASH_STAMP=0;'),source.indexOf('\nfunction groundBuilding(b){'));
  const parcelsSrc=source.slice(source.indexOf('function ensureBldList(){'),source.indexOf('\n/* ---------------- end parcel settlement',source.indexOf('function ensureBldList(){')));
  const bridgeSrc=source.slice(source.indexOf('function updateBuildingInstance(b){'),source.indexOf('\nconst STREETFRONT='));
  const animSrc=source.slice(source.indexOf('function advanceSimulation('),source.indexOf('\n/* ---- performance monitor',source.indexOf('function animate(t){')));

  function createProfile(cadence){
    let perf=0;
    const s={kind:'town',pos:{x:0,z:0},radius:90,streets:[],places:[],buildings:[],stores:{grain:100}};
    const b1={x:10,z:10,w:8,d:6,rot:0,s,state:'sound',arch:'house',idx:0,tier:0};
    const b2={x:30,z:10,w:8,d:6,rot:0,s,state:'sound',arch:'house',idx:1,tier:0};
    s.buildings.push(b1,b2);

    const bodiesMock={
      count:2,
      geometry:{attributes:{aKind:{setX(){},getX(){return 0;},needsUpdate:false},aFront:{setXY(){},needsUpdate:false},aBase:{setX(){},needsUpdate:false}}},
      setColorAt(){},
      instanceMatrix:{needsUpdate:false},
      instanceColor:{needsUpdate:false}
    };
    const roofsMock={
      count:2,
      geometry:{attributes:{aGableColor:{setXYZ(){},needsUpdate:false},aKind:{setX(){},needsUpdate:false},aRoofKind:{setX(){},needsUpdate:false}}},
      setColorAt(){},
      instanceMatrix:{needsUpdate:false},
      instanceColor:{needsUpdate:false}
    };

    const hasGfx = cadence!=='headless';
    const G = hasGfx ? {
      bldList:[b1,b2],
      bodies:bodiesMock,
      roofs:roofsMock,
      detDirty:false
    } : {
      bldList:[b1,b2],
      detDirty:false
    };

    const context = run(makeHashSrc+'\n'+bridgeSrc+'\n'+parcelsSrc+'\n'+animSrc,{
      W:{clock:{day:1},settlements:[s],roads:[]},
      G,
      PAL:{tierWall:[0xffffff,0xeeeeee,0xdddddd]},
      ARCH:{temple:[0,0,10],hall:[0,0,8]},
      ROOFS:[[0xa88f58,0x967c4a,0xb0955e],[0xa44c30,0x93583a,0xad5a3a],[0xa9502f,0x984630,0x606876]],
      C1:{setHex(){},offsetHSL(){},r:1,g:1,b:1},
      setInst(){},
      hash01:()=>0.5,
      roofRise:()=>2,
      clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
      dist2d:(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2),
      SPEEDS:[0,1,2,3,4,30],
      speedIdx:1,
      simAccum:0,
      lastT:0,
      hudT:10,overlayT:10,uiT:0,
      requestAnimationFrame(){},
      performance:{now:()=>perf},
      perfNow:()=>perf,
      director:{update(){}},
      updateCamera(){},
      projectWorld(){return false;},
      featFlush(){},refreshOrders(){},refreshOverlayNow(){},
      rebuildDetails(){G.detDirty=false;},
      rebuildRoadMesh(){G.roadsDirty=false;},
      simErr(e){throw e;},
      overlayMode:null,
      renderer:{render(){}},scene:{},camera:{},contextPosition(){},HISTORY:{active:false},perfGpuBegin(){},perfGpuEnd(){},perfFrame(){},
      updateHUD(){},refreshInspect(){},renderPetition(){},refreshCrownPanel(){},
      PERF:{on:false},
      Math,Number,Date
    });

    context.simTick = () => {
      context.W.clock.day++;
      s.stores.grain += 2;
      if(context.W.clock.day === 15){
        b1.w += 2;
        context.updateBuildingInstance(b1);
        context.settleParcels([b1]);
      }
      return true;
    };

    context.settleParcels();

    return {context,s,b1,b2,G};
  }

  // Profile A: Headless (0 FPS: advanceSimulation directly without presentation frames)
  const pA=createProfile('headless');
  while(pA.context.W.clock.day < 31){
    pA.context.advanceSimulation(1.0);
  }

  // Profile B: Throttled (10 FPS: animate called at 10 FPS with presentation frames)
  const pB=createProfile('throttled');
  let tB=0;
  while(pB.context.W.clock.day < 31){
    tB+=100;
    pB.context.animate(tB);
  }

  // Profile C: Continuous (60 FPS: animate called at 60 FPS with presentation frames)
  const pC=createProfile('continuous');
  const dtMs=1000/60;
  let tC=0;
  while(pC.context.W.clock.day < 31){
    tC+=dtMs;
    pC.context.animate(tC);
  }

  // Verify all 3 profiles reached day 31
  assert.equal(pA.context.W.clock.day,31,'Profile A day');
  assert.equal(pB.context.W.clock.day,31,'Profile B day');
  assert.equal(pC.context.W.clock.day,31,'Profile C day');

  assert.equal(pA.s.stores.grain, pB.s.stores.grain);
  assert.equal(pB.s.stores.grain, pC.s.stores.grain);
  assert.equal(pA.b1.w, pB.b1.w);
  assert.equal(pB.b1.w, pC.b1.w);

  assert.equal(JSON.stringify(pA.b1.lot), JSON.stringify(pB.b1.lot),'b1 lot identical between headless and throttled');
  assert.equal(JSON.stringify(pB.b1.lot), JSON.stringify(pC.b1.lot),'b1 lot identical between throttled and continuous');
  assert.equal(JSON.stringify(pA.b2.lot), JSON.stringify(pB.b2.lot),'b2 lot identical between headless and throttled');
  assert.equal(JSON.stringify(pB.b2.lot), JSON.stringify(pC.b2.lot),'b2 lot identical between throttled and continuous');
});
