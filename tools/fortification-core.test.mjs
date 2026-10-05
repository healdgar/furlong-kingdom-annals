import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=name=>{
  const m=html.match(new RegExp('^function '+name+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'));
  assert.ok(m,`missing function ${name}`);return m[0];
};
const core=['wallRadAt','wallKindAt','casRing','casStone','motteSurface','fortCenter','fortPoint','fortCircuits',
  'fortGateAngles','fortPrepare','fortContains','activeFort','castleDamage','fortSurface','fortWalkY',
  'fortGround','fortTerrainBounds','maskFortTerrain','wallDmgAt','wallDamage','damageWalls','wallWorks','wallProg','wallBuilt',
  'siegeGate','entryPath','casRing','casKeep','fortOf','defenceOf','planWallCuts','razeWall','rayPolyR','fortBaileyShape',
  'notableResidence','notableResidents','notableWhere'];

function fixture(){
  let now=0;
  const c=vm.createContext({
    WALLN:32,CELL:27,SIZE:108,GRID:5,MOTTEH:11,
    RESID:new Set(['house','store']),
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),hash01:n=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);},
    hAt:()=>0,day:()=>now,W:{settlements:[],houses:[],notables:[],armies:[]},G:{wallsDirty:false},
    wallGates:s=>[s.gateA??0],circuitLen:()=>200,prominence:()=>0,sheltered:()=>0,
    rebuildWalls:()=>{},featWalls:()=>{},
    streetGraph:()=>({N:[{x:0,z:0},{x:1,z:0}]}),nearestNode:()=>0,streetPath:()=>[0,1],polyLen:()=>1,
    toCell:x=>Math.max(0,Math.min(4,Math.round((x+54)/27))),
    cellX:i=>i*27-54,cIdx:(i,j)=>j*5+i,inB:(i,j)=>i>=0&&j>=0&&i<5&&j<5,
    sstep:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},
  });
  c.houseOf=n=>c.W.houses[n.house];c.casKeep=s=>s.buildings.find(b=>b.arch==='keep'&&!b.removed&&b.state!=='gone')||null;
  c.notableById=id=>c.W.notables.find(n=>n.id===id);c.livingNotableCandidates=fn=>c.W.notables.filter(fn);
  vm.runInContext(core.map(extract).join('\n')+'\n'+
    'globalThis.F={fortCenter,fortPoint,fortCircuits,fortGateAngles,fortPrepare,fortContains,activeFort,castleDamage,fortSurface,fortWalkY,fortGround,fortTerrainBounds,maskFortTerrain,wallDmgAt,wallDamage,damageWalls,wallWorks,wallProg,wallBuilt,siegeGate,entryPath,fortOf,defenceOf,planWallCuts,razeWall,fortBaileyShape,notableResidence,notableResidents,notableWhere};',c);
  const run=js=>vm.runInContext(js,c);
  return {c,run,setDay:n=>{now=n;}};
}

function castle(){
  const town={pos:{x:-50,z:0},buildings:[],walls:0};
  const keep={arch:'keep',x:20,z:0,ownerId:'lord',state:'sound',inventory:{grain:8}};
  const hall={arch:'hall',x:-9,z:1,ownerId:'lord',state:'sound',inventory:{grain:13}};
  const store={arch:'store',x:-8,z:2,ownerId:'town',state:'sound',inventory:{grain:27}};
  town.buildings=[keep,hall,store];
  town.bailey={x:-10,z:0,r:12,gateA:0};
  town.motte={x:25,z:0,r:10,summitR:4,topY:12,gateA:0};
  town.cas={outer:24,dmg:0.35};
  return {town,keep,hall,store};
}

test('circuit points, gates and damage use the circuit centre and independent segment arrays',()=>{
  const {c,run}=fixture(),{town}=castle();
  c.s=town;run('fortPrepare(s)');
  const bailey=town.bailey,motte=town.motte,outer=town.cas.outerWall;
  c.bailey=bailey;
  const center=run('fortCenter(bailey)');assert.deepEqual({x:center.x,z:center.z},{x:-10,z:0});
  const gate=run('fortPoint(s,bailey,0)');
  assert.ok(Math.abs(gate.x-2)<1e-6);assert.ok(Math.abs(gate.z)<1e-6);
  assert.deepEqual(Array.from(run('fortGateAngles(s,bailey)')),[0]);
  assert.deepEqual(Array.from(run('fortCircuits(s)')), [outer,bailey,motte]);
  const siegeGate=run('siegeGate(s,{circuit:bailey,c:Math.PI/2})');
  assert.equal(siegeGate.circuit,bailey);assert.ok(Math.abs(siegeGate.x-2)<1e-6);assert.ok(Math.abs(siegeGate.z)<1e-6);
  town.takenCircuit=bailey;bailey.breachA=0;
  const path=run('entryPath(s)');assert.ok(Math.abs(path[0].x-14)<1e-6);assert.ok(Math.abs(path[0].z)<1e-6);
  assert.equal(bailey.wallRad.length,32);assert.equal(motte.wallRad.length,32);
  run('damageWalls(bailey,Math.PI,0.2,0.8)');
  assert.ok(bailey.wallDmg.some(x=>x>0));
  assert.equal(town.wallDmg,undefined);assert.notEqual(outer.wallDmg,bailey.wallDmg);assert.notEqual(motte.wallDmg,bailey.wallDmg);
  assert.ok(Array.from(outer.wallDmg).every(x=>Math.abs(x-0.35)<1e-6));assert.ok(Array.from(motte.wallDmg).every(x=>Math.abs(x-0.35)<1e-6));
  assert.equal(run('wallDmgAt(bailey,Math.PI)'),Math.max(bailey.wallDmg[16],bailey.wallDmg[17]));
});

test('bailey breach leaves the intact summit as the active defensive circuit',()=>{
  const {c,run,setDay}=fixture(),{town}=castle();town.cas.outer=0;town.cas.dmg=0;c.s=town;run('fortPrepare(s)');
  setDay(100);town.bailey.breachUntil=Infinity;
  assert.equal(run('activeFort(s)'),town.motte);
  assert.equal(run('castleDamage(s)'),0);
  run('damageWalls(s.motte,Math.PI/2,0.25,0.6)');
  assert.ok(run('castleDamage(s)')>0);
  town.motte.breachUntil=Infinity;
  assert.equal(run('activeFort(s)'),null);
});

test('legacy castle damage migrates once; stone progression preserves circuit geometry and functional buildings',()=>{
  const {c,run}=fixture(),{town,keep,hall,store}=castle();c.s=town;
  const inventory=town.inventory={lots:new Map([['grain',8]])},journal=town.journal=[{text:'existing'}];
  const baileyRad=new Float32Array(32).fill(39),baileyDmg=new Float32Array(32).fill(0.12),baileyKind=new Uint8Array(32);
  town.bailey.wallRad=baileyRad;town.bailey.wallDmg=baileyDmg;town.bailey.wallKind=baileyKind;town.cas.outer=24;
  run('fortPrepare(s)');
  assert.equal(town.cas.dmg,undefined);
  assert.equal(town.bailey.wallRad,baileyRad);assert.equal(town.bailey.wallDmg,baileyDmg);
  assert.ok(ArrayBuffer.isView(town.motte.wallDmg));
  const wallArrays=[town.bailey.wallRad,town.bailey.wallDmg,town.motte.wallRad,town.cas.outerWall.wallRad];
  const center=[town.bailey.x,town.bailey.z],r=town.bailey.r;
  town.baileyStone=true;run('fortPrepare(s)');
  assert.equal(town.bailey.walls,2);assert.equal(town.bailey.wallHeight,6);
  assert.deepEqual([town.bailey.x,town.bailey.z],center);assert.equal(town.bailey.r,r);
  assert.equal(town.bailey.wallRad,wallArrays[0]);assert.equal(town.bailey.wallDmg,wallArrays[1]);
  assert.equal(town.motte.wallRad,wallArrays[2]);assert.equal(town.cas.outerWall.wallRad,wallArrays[3]);
  assert.deepEqual(town.buildings,[keep,hall,store]);
  assert.deepEqual([keep.inventory.grain,hall.inventory.grain,store.inventory.grain],[8,13,27]);
  assert.deepEqual([keep.ownerId,hall.ownerId,store.ownerId],['lord','lord','town']);
  assert.equal(town.inventory,inventory);assert.equal(town.journal,journal);
  assert.ok(run('fortCircuits(s).every(c=>!Object.hasOwn(c,"inventory")&&!Object.hasOwn(c,"journal"))'));
  assert.equal(run('fortCircuits(s).length'),3);
});

test('castle defence protects enclosed households and retreats to the summit when the bailey is breached',()=>{
  const {c,run,setDay}=fixture(),{town}=castle();town.cas.outer=0;town.cas.dmg=0;
  town.buildings.push({arch:'house',x:-10,z:24,state:'sound'});town.pop=100;town.militia=10;town.garrison=0;
  c.s=town;run('fortPrepare(s)');setDay(100);
  assert.ok(Math.abs(town.bailey.protectedShare-0.5)<1e-6);
  const enclosed=run('defenceOf(s)');assert.ok(Math.abs(enclosed-15.6)<1e-6);
  town.bailey.breachUntil=Infinity;
  assert.equal(run('fortOf(s).circuit'),town.motte);
  assert.equal(run('defenceOf(s)'),12);
});

test('construction progress advances independently on the displaced bailey circuit',()=>{
  const {c,run,setDay}=fixture(),{town}=castle();c.s=town;run('fortPrepare(s)');
  const bailey=town.bailey,rad=bailey.wallRad;
  c.bailey=bailey;
  setDay(20);run('wallWorks(bailey,false,40)');
  assert.equal(bailey.wallBuild.a0,0);
  assert.equal(run('wallProg(bailey)'),0);
  assert.equal(run('wallBuilt(bailey,Math.PI)'),false);
  setDay(30);assert.equal(run('wallProg(bailey)'),0.25);
  assert.equal(run('wallBuilt(bailey,0)'),true);
  assert.equal(run('wallBuilt(bailey,Math.PI)'),false);
  assert.equal(bailey.wallRad,rad);
});

test('motte surface forms a raised summit and bailey ditch with a gate causeway',()=>{
  const {c,run}=fixture(),{town}=castle();c.s=town;run('fortPrepare(s)');
  assert.equal(run('fortSurface(s,s.motte,25,0)'),12);
  assert.ok(run('fortSurface(s,s.motte,31,0)')>0);
  assert.equal(run('fortSurface(s,s.motte,2,0)'),0); // bailey gate causeway
  assert.ok(run('fortSurface(s,s.motte,-10,15)')<0); // bailey outer ditch
  assert.ok(run('fortWalkY(s,s.motte,25,0)')>12);
});

test('both bailey gate causeways stay dry across the ditch',()=>{
  const {c,run}=fixture(),{town}=castle();c.s=town;run('fortPrepare(s)');town.bailey.gates=[0,Math.PI];
  assert.equal(run('fortSurface(s,s.bailey,6,0)'),0);
  assert.equal(run('fortSurface(s,s.bailey,-26,0)'),0);
  assert.ok(run('fortSurface(s,s.bailey,-10,16)')<0);
});

test('partial bailey cuts leave the summit, earthworks, buildings and inventories intact',()=>{
  const {c,run}=fixture(),{town,keep,hall,store}=castle();c.s=town;run('fortPrepare(s)');
  const keepState=[keep.x,keep.z,keep.ownerId,keep.inventory.grain],hallState=[hall.x,hall.z,hall.ownerId,hall.inventory.grain],storeState=[store.x,store.z,store.ownerId,store.inventory.grain];
  const cuts=run('planWallCuts(s,[{x:2,z:0},{x:2,z:1}],false)');
  assert.equal(cuts.length,1);assert.equal(cuts[0].circuit,town.bailey);
  const summitRad=town.motte.wallRad,summitKind=town.motte.wallKind,bailey=town.bailey,motte=town.motte;
  c.cuts=cuts;
  run('razeWall(s,cuts[0].ks,cuts[0].circuit)');
  assert.equal(town.bailey,bailey);assert.equal(town.motte,motte);
  assert.ok(town.bailey.wallKind.some(k=>k===1));assert.equal(town.motte.wallRad,summitRad);assert.equal(town.motte.wallKind,summitKind);
  assert.deepEqual([keep.x,keep.z,keep.ownerId,keep.inventory.grain],keepState);
  assert.deepEqual([hall.x,hall.z,hall.ownerId,hall.inventory.grain],hallState);
  assert.deepEqual([store.x,store.z,store.ownerId,store.inventory.grain],storeState);
  assert.equal(run('fortSurface(s,s.motte,25,0)'),12);
});

test('total bailey razing retains the earthwork and fortPrepare does not recreate its walls',()=>{
  const {c,run}=fixture(),{town}=castle();c.s=town;run('fortPrepare(s)');
  const bailey=town.bailey,motte=town.motte,buildingRecords=town.buildings,wallRad=bailey.wallRad;
  c.bailey=bailey;
  run('razeWall(s,Array.from({length:bailey.wallRad.length},(_,k)=>k),bailey)');
  assert.equal(bailey.razed,true);assert.equal(bailey.wallRad,null);assert.equal(bailey.wallKind,null);assert.equal(bailey.walls,0);
  assert.equal(town.bailey,bailey);assert.equal(town.motte,motte);assert.equal(town.buildings,buildingRecords);
  assert.equal(town.bailey.r,12);assert.equal(motte.wallRad.length,32);
  run('fortPrepare(s)');
  assert.equal(bailey.wallRad,null);assert.equal(bailey.wallKind,null);assert.equal(bailey.walls,0);
  assert.notEqual(bailey.wallRad,wallRad);assert.equal(town.bailey,bailey);
});

test('terrain bounds align to the terrain lattice and the transient mask removes covered faces deterministically',()=>{
  const {c,run}=fixture(),{town}=castle();c.s=town;
  const bounds=run('fortTerrainBounds(s)');
  for(const v of [bounds.x0,bounds.x1,bounds.z0,bounds.z1])assert.equal((v+54)%27,0);
  assert.ok(bounds.x0<town.motte.x-town.motte.r&&bounds.x1>town.bailey.x+town.bailey.r);
  const src=Array.from({length:4*4*6},(_,i)=>i),geometry={userData:{baseIndex:src},setIndex(v){this.index=Array.from(v);}};
  c.G.terrain={geometry};c.W.settlements=[town];
  run('maskFortTerrain()');const first=geometry.index.slice();
  assert.ok(first.length<src.length);assert.equal(first.length%6,0);
  run('maskFortTerrain()');assert.deepEqual(geometry.index,first);
  assert.deepEqual(geometry.userData.baseIndex,src);
});

test('fortGround resolves a ditch across a neighbouring domain boundary',()=>{
  const {c,run}=fixture(),{town}=castle(),plain={pos:{x:45,z:40},buildings:[]};
  c.s=town;c.W.settlements=[plain,town];c.W.dom=new Int16Array(25).fill(-1);c.W.dom[17]=0;c.W.dom[12]=1;
  assert.equal(run('fortGround(-10,16)'),-1.6);
  assert.equal(run('fortGround(-10,16,s)'),-1.6);
});

test('the same canonical settlement reconstructs identical circuit geometry and condition',()=>{
  const snapshot=()=>{
    const {c,run}=fixture(),{town}=castle();c.s=town;run('fortPrepare(s)');
    run('damageWalls(s.bailey,Math.PI/2,0.3,0.4)');
    return JSON.stringify(run('fortCircuits(s).map(c=>({x:c.x,z:c.z,r:c.r,wallR:c.wallR,walls:c.walls,wallHeight:c.wallHeight,wallRad:[...c.wallRad],wallDmg:c.wallDmg&&[...c.wallDmg],gateA:c.gateA}))'));
  };
  assert.equal(snapshot(),snapshot());
});

test('surveyed outer enceinte encloses the courtyard and mound toe with one controlled gate',()=>{
  const {c,run}=fixture(),m={x:24,z:3,r:11},b={x:0,z:0,courtR:15,gateA:Math.atan2(m.z,m.x)};
  c.m=m;c.b=b;b.wallRad=run('fortBaileyShape(m,b)');b.r=Math.max(...b.wallRad);c.s={pos:{x:-45,z:0},bailey:b,motte:m,buildings:[],cas:{outer:0}};
  for(let k=0;k<64;k++){
    const a=k/64*Math.PI*2;
    assert.ok(run(`fortContains(s.bailey,m.x+Math.cos(${a})*(m.r+8),m.z+Math.sin(${a})*(m.r+8))`),`mound toe escapes at angle ${k}`);
  }
  for(let k=0;k<64;k++){
    const a=k/64*Math.PI*2;
    assert.ok(run(`fortContains(s.bailey,Math.cos(${a})*10,Math.sin(${a})*10)`),`courtyard escapes at angle ${k}`);
  }
  assert.deepEqual(Array.from(run('fortGateAngles(s,s.bailey)')),[b.gateA]);
});

test('notables lodge in their seat keep without creating household or purse records',()=>{
  const {c,run}=fixture(),{town,keep,hall}=castle();town.owner=1;town.bailey.wallRad=new Float32Array(32).fill(42);town.motte.wallRad=new Float32Array(32).fill(9);keep.s=hall.s=town;c.keep=keep;c.hall=hall;
  const lord={id:11,house:1,alive:true,name:'Lord'},family=[lord,{id:12,house:1,alive:true,name:'Heir'}];
  c.W.settlements=[town];c.W.houses=[{}, {seat:0,head:11}];c.W.notables=family;
  const before=JSON.stringify(family), purse=JSON.stringify(c.W.houses[1]);
  const residence=run('notableResidence(W.notables[0])');
  assert.equal(residence.s,town);assert.equal(residence.b,keep);assert.equal(residence.secure,true);assert.equal(residence.lines,2);
  const where=run('notableWhere(W.notables[0])');assert.equal(where.b,keep);assert.equal(where.x,keep.x);assert.equal(where.secure,true);
  assert.deepEqual(Array.from(run('notableResidents(keep)'),n=>n.id),[11,12]);
  assert.deepEqual(Array.from(run('notableResidents(hall)')),[]);
  assert.equal(JSON.stringify(family),before);assert.equal(JSON.stringify(c.W.houses[1]),purse);
  c.W.armies.push({commander:11,gone:false,_rpos:{x:99,z:88}});
  assert.equal(run('notableWhere(W.notables[0]).army'),c.W.armies[0]);
});

test('removed keep falls back to the seat hall and loss of seat ownership clears lodging',()=>{
  const {c,run}=fixture(),{town,keep,hall}=castle();town.owner=1;hall.inst=true;c.keep=keep;c.hall=hall;c.W.settlements=[town];c.W.houses=[{}, {seat:0,head:21}];c.W.notables=[{id:21,house:1,alive:true}];
  keep.removed=true;
  let residence=run('notableResidence(W.notables[0])');assert.equal(residence.b,hall);assert.equal(residence.secure,false);
  assert.equal(run('notableWhere(W.notables[0]).b'),hall);
  town.owner=0;
  assert.equal(run('notableResidence(W.notables[0])'),null);
  assert.equal(run('notableWhere(W.notables[0])'),null);
});
