import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const source=inlineGameScript(html);
const extract=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`missing source seam: ${from}`);return source.slice(a,b);};
const extractHTML=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a);assert.ok(a>=0&&b>a,`missing HTML source seam: ${from}`);return html.slice(a,b);};
const presentation=extract('function visualScalars(', 'function installPresentation(packet){');
const installProjection=extract('function installPresentation(packet){', '/*\n * Ephemeral renderer DTO builders');
const renderPlans=extract('/*\n * Ephemeral renderer DTO builders', '/* Foreground adapters submit intent');
const tick=extract('function simTick(){', '/* =========================================================================\n   CHRONICLE');
const workerNotice=extract('function workerNotice(error){','function workerHTML(');
const workerHost=extract('class SimulationWorkerHost{','class SimulationWorkerClient{');
const workerClient=extract('class SimulationWorkerClient{','function createSimulationWorker(');
const endGame=extract('function endGame(kind,hi,P,L){','function presentEndgame(');
const profileFns=extractHTML('function bestLegacy(){','function petition(');
const achievement=extract('function achGet(id){','function achYear()');
const reignHeader=extract('function reignHeader(n){','function presentReign(');
const projectEvent=extract('function projectEvent(ev){','function referenceRegex(');
const storageArchive=extractHTML('const STORAGE_ARCHIVE_DB = (() => {','\nif(!MODEL_ONLY)window.FURLONG_STORAGE_LOG=backgroundStorageLog();');
const forbidden=new Set(['_owners','_hh','household','households','account','ownerAccount','beneficiary','storage','ledger','holdings','rng','simulationRNG']);

function context(extra={}){
  const c=vm.createContext({console,performance,Map,Set,WeakMap,WeakSet,ArrayBuffer,DataView,Uint8Array,Uint16Array,
    Uint8ClampedArray,Float32Array,Float64Array,structuredClone,Number,Math,JSON,Object,Array,RegExp,Error,TypeError,Infinity,NaN,...extra});
  new vm.Script(`
    let W={seed:33,clock:{day:7,frac:.2},weather:{state:'clear'},settlements:[],bldList:[],houses:[],monarch:{},petitions:[],armies:[],caravans:[],envoys:[],travellers:[],ships:[],banditCamps:[],dragon:null,memorials:[],roads:[],bridges:[],projects:[],trackSet:new Set(),treeSpots:[],land:{F:[],mask:new Uint8Array(8),flood:new Uint8Array(4)}};
    const G={structuresDirty:true,roadsDirty:true,wallsDirty:true,detDirty:true,herdsDirty:false,armyFlagsDirty:false,landDirty:new Set(),treesDirty:new Set(),buildingDirty:new Set()};
    let BACKGROUND=null,backgroundApplying=false;const WORKER_PRESENTATION={events:[],camera:null,started:false,revision:0,buildingCount:0,towns:0,storageStatus:{id:'fixture',records:0,processingMode:'worker'}},JOURNAL=[];
    const STORAGE_OUTCOMES={status:()=>({id:'fixture',records:0,processingMode:'worker'}),flush:async()=>{throw Error('foreground journal must not flush in worker mode')},saved:async()=>[],open:async()=>null,records:async function*(){},storageRecords:async function*(){},stream:()=>new ReadableStream()};
    let MOD={speed:0};let speedIdx=0,speedChanges=[];const day=()=>W.clock.day,seasonIdx=()=>0,fenceWorked=()=>false,fenceStoneView=()=>false,graveyardBurials=()=>[],fortGateAngles=()=>[];function setSpeed(i){speedChanges.push(i)}
    const cam={cur:{focus:{x:0,z:0}}};const DAYSEC=100;
    function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function dist2d(x,z,a,b){return Math.hypot(x-a,z-b)}
    function detailPopulation(s){return s._fixturePopulation||0}
    function computeFurlongPoly(f){return f.poly||[]}function workerTrackSegments(){return []}function workerFenceSegments(){return []}
    let allLines=[],entryCount=0,scene=null;const dateStr=()=>'';let MODEL_ONLY=false,SEED=33,FATE=44,START_AD=850;function storageOutcomeReady(){return true}
    function workerHTML(value){return value}function presentEndgame(){}
  `).runInContext(c);
  new vm.Script(presentation+'\n'+installProjection+'\n'+renderPlans,{filename:'index.html production projection'}).runInContext(c);
  vm.runInContext('workerTrackSegments=()=>[];workerFenceSegments=()=>[]',c);
  return c;
}
function auditDTO(root){
  const seen=new Set(),visit=(v,p='$')=>{
    if(v===null||typeof v!=='object'){assert.notEqual(typeof v,'function',`${p} leaks executable value`);return;}
    if(seen.has(v))return;seen.add(v);assert.ok(!(v instanceof Map),`${p} leaks Map`);assert.ok(!(v instanceof Set),`${p} leaks Set`);
    if(ArrayBuffer.isView(v))return;
    for(const [k,x]of Object.entries(v)){
      assert.ok(!forbidden.has(k),`${p}.${k} leaks private/canonical state`);
      if(k==='owner')assert.notEqual(typeof x,'object',`${p}.owner leaks an owner reference`);
      visit(x,`${p}.${k}`);
    }
  };visit(root);
}

test('production presentation packet keeps render references and transfers packet-owned copies',()=>{
  const c=context();
  vm.runInContext(`
    const tree={k:0,i:0,x:4,z:5,v:.2};W.treeSpots=[[tree]];
    const field={k:0,dom:0,lord:0,x:2,z:3,state:0,kind:0,area:25,poly:[{x:0,z:0},{x:4,z:0},{x:0,z:4}],sap:new Float32Array([1,2]),trees:[tree]};W.land.F=[field];
    const building={idx:0,arch:'keep',state:'sound',x:1,z:2,w:4,d:5,rot:0,s:{},lot:[{x:1,z:1},{x:2,z:2}]};
    const settlement={name:'Test',kind:'town',owner:0,pos:{x:0,y:0,z:0},radius:10,extentR:20,hm:true,buildings:[building],fires:[],furl:[field],streets:[],places:[],folk:[],stores:{grain:2}};building.s=settlement;W.bldList=[building];W.settlements=[settlement];W.capital=settlement;
    W.houses=[{name:'House',sigilHue:[1,2],charge:0}];W.h=new Uint8Array([1,2]);W.water=new Uint8Array([0,0]);W.biome=new Uint8Array([1,1]);W.moist=new Uint8Array([2,2]);W.dom=new Int16Array([0,0]);W.roadCells=new Uint8Array([0,0]);W.rivStrips=[];W.riverPaths=[];W.trackBridgePlan=[];
  `,c);
  const packet=vm.runInContext('workerPresentation(true)',c);auditDTO(packet);
  assert.equal(packet.protocol,1);assert.deepEqual(JSON.parse(JSON.stringify(packet.storageStatus)),{id:'fixture',records:0,processingMode:'worker'});assert.ok(ArrayBuffer.isView(packet.static.h));assert.ok(packet.mask.byteLength>0);
  for(const [i,b]of packet.buildings.entries())assert.equal(b.idx,i);
  for(const s of packet.settlements){for(const id of s.buildings||[])assert.ok(packet.buildings[id]);for(const id of s.furl||[])assert.ok(packet.fields.some(f=>f.k===id));}
  for(const f of packet.fields){assert.ok(Array.isArray(f.treeRefs));for(const t of f.treeRefs)assert.ok(packet.static.treeSpots[t.kind]?.[t.index]);}
  const transfers=vm.runInContext('presentationTransfers',c)(packet),transferSet=new Set(transfers);
  const canonical=vm.runInContext('[W.h,W.water,W.land.mask,W.land.flood,...W.land.F.map(f=>f.sap)].filter(ArrayBuffer.isView).map(v=>v.buffer)',c);
  for(const b of canonical)assert.ok(!transferSet.has(b),'packet must not transfer canonical world buffers');
  const packetViews=[packet.static.h,packet.static.water,packet.mask,packet.flood,packet.fields[0].sap];
  for(const v of packetViews)assert.ok(transfers.includes(v.buffer));
  const lengths=canonical.map(b=>b.byteLength),copy=structuredClone(packet,{transfer:transfers});
  assert.ok(copy.static.h.byteLength>0);assert.ok(packetViews.every(v=>v.byteLength===0));
  assert.deepEqual(canonical.map(b=>b.byteLength),lengths,'canonical source buffers remain attached');
});

test('production citizen-plan adapter calls canonical walker helpers, scales elapsed days, and leaves RNG alone',()=>{
  const c=context();
  vm.runInContext(`
    const p={id:4,si:0,sx:'f',tr:'weaver'},s={folk:[p],pos:{x:1,z:2}};W.settlements=[s];
    let draws=0;const RS={test:{state:()=>draws}};G._walkerCalls=[];
    const folkName=()=>"Ada Weaver",famName=()=>"Weaver",ageYrs=()=>24;
    function townsfolkFor(){G._planned=(G._planned||0)+1;return [{s,p,g:null,home:{x:1,z:2},work:{x:3,z:4},workIn:false,what:'weaving',fw:null,chores:false,door:null,mk:{x:1,z:2},church:null,tavern:null,pace:2,sc:1,col:new THREE.Color(0x123456).multiplyScalar(.9),x:1,z:2,ry:0,t:0,state:'work',until:0,route:[{x:1,z:2},{x:3,z:4}],ri:0,out:true,walking:true,goal:'work',doing:'weaving'}]}
    function warmWalkers(L){G._warmed=L.length}
    function stepWalker(person,dt,frac){G._walkerCalls.push({dt,frac});person.t+=dt}
  `,c);
  const before=vm.runInContext('RS.test.state()',c),first=vm.runInContext('workerRenderCitizens(0,{frac:.2})',c);
  const second=vm.runInContext('workerRenderCitizens(0,{frac:.3})',c),after=vm.runInContext('RS.test.state()',c);
  assert.equal(vm.runInContext('G._planned',c),1);assert.equal(vm.runInContext('G._warmed',c),1);
  assert.equal(after,before,'actor planning and stepping must not draw simulation RNG');
  const call=vm.runInContext('G._walkerCalls[0]',c),expected=vm.runInContext('DAYSEC*.1',c);assert.ok(Math.abs(call.dt-expected)<1e-10);assert.equal(call.frac,.3);
  assert.ok(Math.abs(second.people[0].time-first.people[0].time-expected)<1e-10);
  assert.equal(second.people[0].colour.hex,0x123456);assert.equal(second.people[0].surname,'Weaver');
  assert.deepEqual(Array.from(second.people[0].route,p=>[p.x,p.z]),[[1,2],[3,4]]);auditDTO(second);
  for(const [start,end]of [['function townsfolkFor(','function planWalk('],['function stepWalker(','function rockNear(']]){
    const semantic=extract(start,end);assert.doesNotMatch(semantic,/\brand\s*\(|Math\.random\s*\(/,'canonical visual semantics must remain deterministic');
  }
});

test('landscape packets omit unchanged structure bodies and publish one dirty building',()=>{
  const c=context();
  vm.runInContext(`
    const b0={idx:0,arch:'house',state:'sound',x:1,z:2,w:4,d:5,rot:0},b1={idx:1,arch:'hall',state:'sound',x:8,z:9,w:6,d:7,rot:0};
    const s={name:'Test',kind:'town',owner:0,pos:{x:0,y:0,z:0},radius:10,extentR:20,hm:true,buildings:[b0,b1],fires:[],furl:[],streets:[],places:[],folk:[]};
    b0.s=b1.s=s;W.bldList=[b0,b1];W.settlements=[s];W.capital=s;W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];
  `,c);
  vm.runInContext('workerPresentation(true)',c);
  const stable=vm.runInContext(`(()=>{G.structuresDirty=false;G.roadsDirty=false;G.wallsDirty=false;G.detDirty=false;G.buildingDirty.clear();return workerPresentation(false)})()`,c);
  assert.equal(stable.dirty.structures,false);assert.equal(stable.buildings,undefined);assert.equal(stable.roads,undefined);assert.equal(stable.mask,undefined);

  const dirty=vm.runInContext(`(()=>{G.buildingDirty.add(W.bldList[1]);return workerPresentation(false)})()`,c);
  assert.equal(dirty.dirty.structures,false);assert.equal(dirty.dirty.buildings,false);
  assert.deepEqual(Array.from(dirty.buildings,b=>b.idx),[1],'only the changed body is sent');
  assert.equal(dirty.roads,undefined);assert.equal(dirty.settlements[0].buildings,undefined);
});

test('presentation DTOs explicitly materialize accessor-backed population and title ownership',()=>{
  const c=context();
  vm.runInContext(`
    let populationReads=0,populationDetailReads=0,ownReads=0,workReads=0,ownerReads=0;
    function detailPopulation(){populationDetailReads++;return 123;}
    const field={k:0,dom:0,lord:0,x:2,z:3,state:0,kind:0,area:25,poly:[],sap:null,trees:[],title:{own:{beneficiary:{id:31}},work:{owner:{household:true,head:{id:42}}}}};
    Object.defineProperties(field,{own:{enumerable:true,get(){ownReads++;return this.title.own.beneficiary.id;}},wk:{enumerable:true,get(){workReads++;const o=this.title.work.owner;return o&&o.household?o.head?o.head.id:-1:o;}}});
    const building={idx:0,arch:'house',state:'sound',x:1,z:2,w:4,d:5,rot:0,title:{owner:{id:57}}};
    Object.defineProperty(building,'ownerId',{enumerable:true,get(){ownerReads++;return this.title.beneficiary?this.title.beneficiary.id:this.title.owner.id;}});
    const s={name:'Test',kind:'town',owner:0,pos:{x:0,y:0,z:0},radius:10,extentR:20,hm:true,buildings:[building],fires:[],furl:[field],streets:[],places:[],folk:[]};
    Object.defineProperty(s,'pop',{enumerable:true,get(){populationReads++;return 999;}});building.s=s;
    W.land.F=[field];W.bldList=[building];W.settlements=[s];W.capital=s;W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];
  `,c);
  const packet=vm.runInContext('workerPresentation(true)',c);
  assert.equal(packet.settlements[0].pop,123,'population DTO uses detailPopulation, not enumerable scalar scan');
  assert.equal(packet.fields[0].own,31);assert.equal(packet.fields[0].wk,42);
  assert.equal(packet.buildings[0].ownerId,57);
  assert.equal(vm.runInContext('populationReads',c),0,'canonical settlement population getter is not read');
  assert.equal(vm.runInContext('populationDetailReads',c),1);
  assert.ok(vm.runInContext('ownReads+workReads+ownerReads',c)>=3);
  assert.deepEqual(Array.from(vm.runInContext('[W.land.F[0].title.own.beneficiary.id,W.land.F[0].title.work.owner.head.id,W.bldList[0].title.owner.id]',c)),[31,42,57]);
});

test('mask-only publication copies the mask without implying structural dirtiness',()=>{
  const c=context();
  vm.runInContext(`
    W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];W.bldList=[];W.settlements=[];W.capital=null;
  `,c);
  vm.runInContext('workerPresentation(true)',c);
  const packet=vm.runInContext(`(()=>{G.structuresDirty=false;G.roadsDirty=false;G.wallsDirty=false;G.detDirty=false;G.landMaskDirty=true;W.land.mask[2]=73;return workerPresentation(false)})()`,c);
  assert.equal(packet.dirty.structures,false);assert.equal(packet.dirty.roads,false);
  assert.equal(packet.mask[2],73);assert.notEqual(packet.mask.buffer,vm.runInContext('W.land.mask.buffer',c));
});

test('presentation install preserves dragon identity and reconciles sapling creation and removal',()=>{
  const classes=new Set(),document={body:{classList:{toggle:(k,on)=>{if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)}},getElementById:()=>({classList:{contains:()=>false}})};
  const c=context({document});
  vm.runInContext(`
    W.settlements=[{buildings:[],streets:[],places:[],furl:[],folk:[],fires:[]}];W.land.F=[{k:0,sap:[],trees:[]}];W.treeSpots=[];
    const base={protocol:1,day:7,speed:0,mod:{},world:{clock:{frac:0}},monarch:{},player:null,houses:[],petitions:[],commands:0,
      settlements:[{si:0,name:'Test',buildings:[],fires:[],furl:[],millId:null}],capital:0,buildings:undefined,
      armies:[],caravans:[],envoys:[],travellers:[],ships:[],banditCamps:[],memorials:[],projects:[],dirty:{armies:true},events:[]};
    base.world.player={on:true};
    let packet={...base,revision:1,dragon:{name:'Ashwing',state:'raiding',pos:{x:4,z:5}},fields:[{k:0,sap:[{i:2,x:3,z:4,s:1,k:'dec'}],treeRefs:[]}]};
  `,c);
  vm.runInContext('installPresentation(packet)',c);
  const first=vm.runInContext('W.dragon',c),field=vm.runInContext('W.land.F[0]',c);
  assert.equal(vm.runInContext('G.sapDirty.has(W.land.F[0])',c),true);assert.equal(field.sap.length,1);
  assert.equal(vm.runInContext('G.armyFlagsDirty',c),true,'army membership dirty bit reaches foreground flag projector');
  assert.equal(classes.has('sov'),true,'worker player state updates the sovereign body class');
  vm.runInContext(`packet={...base,revision:2,dragon:{name:'Ashwing',state:'returning',pos:{x:8,z:9}},fields:[{k:0,sap:null,treeRefs:[]}]};installPresentation(packet)`,c);
  assert.equal(vm.runInContext('W.dragon',c),first,'same dragon record is merged to retain camera-follow identity');
  assert.deepEqual(Array.from(vm.runInContext('[W.dragon.pos.x,W.dragon.pos.z]',c)),[8,9]);
  assert.equal(vm.runInContext('W.land.F[0].sap',c),null);assert.equal(vm.runInContext('G.sapRemoved.length',c),1);
  assert.equal(vm.runInContext('G.sapRemoved[0].i',c),2);
});

test('mill projection preserves detached intake geometry and relinks the canonical mill across sparse packets',()=>{
  const c=context();
  vm.runInContext(`
    const mill={idx:0,arch:'mill',state:'sound',x:127.25,z:-84.5,rot:.731,w:9,d:9,h:8.75,
      millWater:{x:121.1,z:-80.2,y:4.25,side:0,offset:6.8,kind:'river',intake:{x:100.5,z:-63.75}}};
    const other={idx:1,arch:'mill',state:'sound',x:130,z:-90,rot:1.1,w:9,d:9,h:8.75,millWater:{x:124,z:-86,y:4,side:0,offset:6.8,kind:'river'}};
    const s={idx:0,name:'Mill town',kind:'town',owner:0,pos:{x:0,y:0,z:0},radius:10,extentR:20,hm:true,
      buildings:[mill,other],mill,stores:{grain:2},fires:[],furl:[],streets:[],places:[],folk:[]};
    mill.s=other.s=s;W.bldList=[mill,other];W.settlements=[s];W.capital=s;W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];
    globalThis.mill=mill;globalThis.other=other;globalThis.town=s;
  `,c);
  const before=vm.runInContext('JSON.stringify([mill.millWater,mill.rot,mill.x,mill.z,mill.w,mill.d])',c);
  const millDTO=vm.runInContext('visualBuilding(mill)',c),settlementDTO=vm.runInContext('visualSettlement(town,true)',c);
  assert.deepEqual(JSON.parse(JSON.stringify(millDTO.millWater)),{x:121.1,z:-80.2,y:4.25,side:0,offset:6.8,kind:'river',intake:{x:100.5,z:-63.75}});
  assert.notEqual(millDTO.millWater,vm.runInContext('mill.millWater',c));
  assert.notEqual(millDTO.millWater.intake,vm.runInContext('mill.millWater.intake',c));
  assert.equal(settlementDTO.millId,0,'index zero is a valid mill id');
  auditDTO(millDTO);auditDTO(settlementDTO);
  assert.equal(vm.runInContext('JSON.stringify([mill.millWater,mill.rot,mill.x,mill.z,mill.w,mill.d])',c),before,'DTO creation leaves source building untouched');

  const packetBase={protocol:1,revision:1,day:7,speed:0,mod:{},world:{clock:{frac:0},player:null},monarch:{},houses:[],petitions:[],commands:0,entries:0,
    settlements:[settlementDTO],capital:0,buildings:[millDTO,vm.runInContext('visualBuilding(other)',c)],armies:[],caravans:[],envoys:[],travellers:[],ships:[],banditCamps:[],dragon:null,memorials:[],projects:[],events:[],dirty:{}};
  c.packetBase=packetBase;c.settlementDTO=settlementDTO;
  vm.runInContext('installPresentation(packetBase)',c);
  assert.equal(vm.runInContext('W.settlements[0].mill',c),vm.runInContext('W.bldList[0]',c));
  assert.equal(vm.runInContext('W.settlements[0].mill.millWater.intake.x',c),100.5);
  assert.deepEqual(Array.from(vm.runInContext('[W.bldList[0].x,W.bldList[0].z,W.bldList[0].rot,W.bldList[0].w,W.bldList[0].d]',c)),[127.25,-84.5,.731,9,9]);

  vm.runInContext(`packetBase={...packetBase,revision:2,day:8,buildings:undefined,settlements:[{...settlementDTO,millId:0,buildings:undefined}]};installPresentation(packetBase)`,c);
  assert.equal(vm.runInContext('W.settlements[0].mill',c),vm.runInContext('W.bldList[0]',c),'a day packet without structure records retains the same mill target');
  vm.runInContext(`packetBase={...packetBase,revision:3,day:9,buildings:[visualBuilding(other)],settlements:[{...settlementDTO,millId:1,buildings:undefined}]};installPresentation(packetBase)`,c);
  assert.equal(vm.runInContext('W.settlements[0].mill',c),vm.runInContext('W.bldList[1]',c),'explicit id selects the same canonical proxy among multiple mills');
  vm.runInContext(`packetBase={...packetBase,revision:4,day:10,buildings:undefined,settlements:[{...settlementDTO,millId:null,buildings:undefined}]};installPresentation(packetBase)`,c);
  assert.equal(vm.runInContext('W.settlements[0].mill',c),null,'null mill id clears a removed target');
  assert.equal(vm.runInContext('JSON.stringify([mill.millWater,mill.rot,mill.x,mill.z,mill.w,mill.d])',c),before,'installing returned DTOs does not alter mill placement geometry');
});

test('main-thread simTick rejects worker-owned simulation before storage checks or writes',()=>{
  const c=vm.createContext({Error});
  new vm.Script(`let MODEL_ONLY=false,BACKGROUND={},W={clock:{day:9}},checked=0,writes=0;
    function storageOutcomeReady(){checked++;return true}function ownershipTick(){writes++}
  `+tick,{filename:'index.html simulation tick guard'}).runInContext(c);
  assert.throws(()=>vm.runInContext('simTick()',c),/owned by the background worker/);
  assert.equal(vm.runInContext('W.clock.day',c),9);assert.equal(vm.runInContext('checked',c),0);assert.equal(vm.runInContext('writes',c),0);
});

test('renderer failure queues pause, absorbs a host-fault pause rejection, and preserves read/save authority',async()=>{
  const c=vm.createContext({console:{error(){}},Error,Map,Number,String,Promise,performance:{now:()=>0},setTimeout,clearTimeout});
  new vm.Script(workerHost+`\nlet BACKGROUND,backgroundApplying=false,localSpeed=4;const requested=[],notices=[],sent=[];
    const model={day:()=>42,rate:()=>0,speed:i=>{localSpeed=i},view:k=>({kind:k,day:42}),save:n=>({name:n,day:42}),flush:()=>({day:42})};
    const host=new SimulationWorkerHost(model,m=>sent.push(m),{now:()=>0,schedule:()=>0,cancel:()=>{},budget:1});
    host.ready=true;host.fault=Error('host already faulted');globalThis.host=host;globalThis.sent=sent;
    BACKGROUND={closed:false,request:(type,payload={})=>{requested.push(type);return host.control({protocol:1,id:requested.length,payload,type});}};
    function setSpeed(i){localSpeed=i}function storageFaultNotice(m){notices.push(m)}
  `+workerNotice,{filename:'index.html worker failure/pause adapters'}).runInContext(c);
  const unhandled=[];const onUnhandled=reason=>unhandled.push(reason);process.on('unhandledRejection',onUnhandled);
  try{
    vm.runInContext("workerNotice(Error('renderer apply failed'))",c);
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(Array.from(vm.runInContext('requested',c)),['pause']);
    assert.equal(vm.runInContext('localSpeed',c),0,'renderer failure also pauses local controls immediately');
    assert.equal(vm.runInContext('backgroundApplying',c),false);
    await vm.runInContext("host.control({protocol:1,id:2,type:'view',payload:{kind:'summary'}})",c);
    await vm.runInContext("host.control({protocol:1,id:3,type:'save',payload:{name:'last-good'}})",c);
    const replies=JSON.parse(JSON.stringify(vm.runInContext('sent',c)));
    assert.deepEqual(replies.map(x=>x.value),[{kind:'summary',day:42},{name:'last-good',day:42}]);
    assert.deepEqual(unhandled,[],'a fault-rejected pause request is consumed');
  }finally{process.off('unhandledRejection',onUnhandled);}
});

test('simulation reply decode failure rejects pending requests and terminates the worker',async()=>{
  const c=vm.createContext({Error,Map,Promise,setTimeout,clearTimeout});
  new vm.Script(workerClient,{filename:'index.html simulation worker client'}).runInContext(c);
  const adapter={terminated:false,postMessage(){},terminate(){this.terminated=true;}};
  const client=vm.runInContext('new SimulationWorkerClient(globalThis.adapter)',Object.assign(c,{adapter}));
  const first=client.request('view',{kind:'summary'}),second=client.request('save',{name:'one'});
  adapter.onmessageerror();
  await assert.rejects(first,/Simulation worker reply could not be read/);
  await assert.rejects(second,/Simulation worker reply could not be read/);
  assert.equal(client.closed,true);assert.equal(client.pending.size,0);
  assert.equal(adapter.terminated,true,'a worker with unreadable replies must not continue computationally');
  await assert.rejects(client.request('view'),/Simulation worker is closed/);
});

test('worker display delivery preserves pushed-view and explicit-landscape wire order',async()=>{
  const c=vm.createContext({Error,Map,Promise,setTimeout,clearTimeout});
  new vm.Script(workerClient,{filename:'index.html simulation worker client'}).runInContext(c);
  const adapter={sent:[],postMessage(message){this.sent.push(message);},terminate(){}};
  c.adapter=adapter;
  const client=vm.runInContext('new SimulationWorkerClient(adapter)',c),order=[];
  let releaseFirst,releaseSecond;
  const firstGate=new Promise(resolve=>{releaseFirst=resolve;}),secondGate=new Promise(resolve=>{releaseSecond=resolve;});
  client.onview=async value=>{order.push(`start:${value.day}`);await(value.day===1?firstGate:secondGate);order.push(`end:${value.day}`);};
  const reply=client.request('landscape'),replyMessage=adapter.sent[0];
  adapter.onmessage({data:{protocol:1,type:'view',sequence:10,value:{day:1}}});
  await Promise.resolve();
  adapter.onmessage({data:{protocol:1,type:'reply',replyTo:replyMessage.id,value:{revision:4,settlements:[{name:'explicit'}]}}});
  adapter.onmessage({data:{protocol:1,type:'view',sequence:11,value:{day:2}}});
  let resolved=false;reply.then(()=>{resolved=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['start:1'],'later display work cannot overtake the pending first install');
  assert.equal(resolved,false,'explicit landscape request remains pending until earlier pushed view installation finishes');
  releaseFirst();
  const explicit=await reply;
  assert.equal(explicit.revision,4);assert.deepEqual(order,['start:1','end:1']);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['start:1','end:1','start:2'],'the later pushed view follows the explicit reply in wire order');
  releaseSecond();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(order,['start:1','end:1','start:2','end:2']);
  assert.deepEqual(adapter.sent.filter(message=>message.type==='view-ack').map(message=>message.payload.sequence),[10,11]);
});

test('endgame and profile cross the worker boundary once, without journalling profile writes',()=>{
  const presented=[],stored=new Map(),storageWrites=[];
  const localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>{storageWrites.push(k);stored.set(k,String(v));}};
  const c=context({localStorage,presented});
  vm.runInContext(`
    MODEL_ONLY=true;W.bldList=[];W.settlements=[];W.houses=[{name:'Crown'},{name:'House Black'}];W.capital={pos:{x:0,z:0}};
    W.player={on:true,ach:{},house:1};W.camp={over:false};WORKER_PRESENTATION.profile={best:5,achievements:{}};JOURNAL.length=0;
    const events=[];let presentCount=0;
    function year(){return 12}function AD(){return 862}function campHouse(){return 1}function liveHouses(){return[1,0]}
    function legacyOf(h){return h===1?40:20}function esc(s){return String(s)}function emit(...e){events.push(e)}
    function achList(){return[{id:'test-deed',n:'Test deed',d:'did a thing',pts:5,t:null}]}
    function seatOf(){return null}function presentEndgame(html){presented.push(html);presentCount++}
    globalThis.events=events;globalThis.speedChanges=speedChanges;
  `,c);
  new vm.Script(endGame+'\n'+profileFns+'\n'+achievement,{filename:'index.html endgame/profile production seams'}).runInContext(c);

  vm.runInContext(`saveBest(10);achGet('test-deed');achGet('test-deed')`,c);
  assert.equal(vm.runInContext('bestLegacy()',c),10);assert.equal(vm.runInContext('WORKER_PRESENTATION.profileDirty',c),true);
  assert.equal(vm.runInContext('JOURNAL.length',c),0,'profile and achievement writes do not append storage outcomes');
  vm.runInContext("endGame('win',1,{n:'prosperity',k:'rich'},[[1,40],[0,20]])",c);
  assert.equal(vm.runInContext('W.camp.over',c),true);assert.deepEqual(Array.from(vm.runInContext('speedChanges',c)),[0]);
  assert.equal(vm.runInContext('WORKER_PRESENTATION.endgame.includes("Victory")',c),true);
  assert.equal(presented.length,0,'worker queues endgame HTML instead of touching DOM');
  assert.equal(vm.runInContext('events.length',c),2);
  const packet=vm.runInContext('workerPresentation(false)',c);
  assert.equal(packet.endgame.includes('Victory'),true);assert.equal(packet.profile.best,10);
  assert.ok(packet.profile.achievements['test-deed']);
  assert.equal(vm.runInContext('WORKER_PRESENTATION.endgame',c),null);assert.equal(vm.runInContext('WORKER_PRESENTATION.profileDirty',c),false);
  assert.equal(vm.runInContext('workerPresentation(false).endgame',c),undefined,'endgame HTML is consumed by one presentation packet');
  assert.equal(vm.runInContext('workerPresentation(false).profile',c),undefined,'unchanged profile is not republished');

  vm.runInContext('installPresentation('+JSON.stringify(packet)+')',c);
  assert.equal(stored.get('annals-best-33'),'10');
  assert.deepEqual(JSON.parse(stored.get('furlong-ach')),{'test-deed':862});
  assert.deepEqual(storageWrites,['annals-best-33','furlong-ach']);
  assert.equal(presented.length,1,'main thread presents the queued endgame exactly once');
});

test('reign headings cross the worker packet as headings and preserve the canonical entry count',()=>{
  const worker=context();
  new vm.Script(reignHeader+'\n'+projectEvent,{filename:'index.html reign projection'}).runInContext(worker);
  vm.runInContext(`MODEL_ONLY=true;WORKER_PRESENTATION.started=true;W.reignNum={Aethelred:1};W.bldList=[];W.settlements=[];W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];W.capital=null;entryCount=17;
    reignHeader({name:'Aethelred',sex:'m'});`,worker);
  const packet=vm.runInContext('workerPresentation(false)',worker);
  assert.equal(packet.entries,17);assert.equal(packet.events.length,1);assert.equal(packet.events[0].reign,true);
  assert.equal(packet.events[0].text,'Here begin the years of King Aethelred.');
  assert.match(vm.runInContext('allLines[0]',worker),/^\n=== Here begin the years of King Aethelred\. ===\n$/);

  const rendered=[],document={body:{classList:{toggle(){},contains(){return false}}},getElementById:()=>({classList:{contains:()=>false}})};
  const main=context({document,rendered});
  new vm.Script(projectEvent+`\nfunction presentReign(text){rendered.push(text)}`,{filename:'index.html main reign renderer'}).runInContext(main);
  vm.runInContext('scene={}',main);
  const wire=JSON.parse(JSON.stringify(packet));
  vm.runInContext(`installPresentation(${JSON.stringify(wire)})`,main);
  assert.equal(vm.runInContext('entryCount',main),17);
  assert.match(vm.runInContext('allLines[0]',main),/^\n=== Here begin the years of King Aethelred\. ===\n$/);
  assert.deepEqual(rendered,['Here begin the years of King Aethelred.']);
});

test('background storage-log facade flushes once for active reads, freezes the boundary, and never mutates the journal',async()=>{
  const {webcrypto}=await import('node:crypto');
  const rows=[0,1,2].map(seq=>({seq,event:{kind:'fixture',value:seq}}));
  const raw=new TextEncoder().encode(rows.map(JSON.stringify).join('\n')+'\n');
  const zipped=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const digest=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',raw)),n=>n.toString(16).padStart(2,'0')).join('');
  const meta={id:'g1',lastSeq:2,lastChunk:0};
  const stores={games:new Map([['g1',meta]]),chunks:new Map([[JSON.stringify(['g1',0]),{first:0,last:2,previous:null,hash:digest,encoding:'jsonl',blob:new Blob([zipped])}]])};
  const reads=[];
  const db={objectStoreNames:{contains:n=>n==='games'||n==='chunks'},close(){},transaction(name,mode){assert.equal(mode,'readonly','archive facade transactions must remain read-only');reads.push(name);return{objectStore(store){return{get(key){const r={};queueMicrotask(()=>{r.result=stores[store].get(Array.isArray(key)?JSON.stringify(key):key);r.onsuccess?.();});return r;},getAll(){const r={};queueMicrotask(()=>{r.result=[...stores[store].values()];r.onsuccess?.();});return r;}};}};}};
  const indexedDB={databases:async()=>[{name:'furlong-storage-outcomes'}],open(name){assert.equal(name,'furlong-storage-outcomes');const r={result:db};queueMicrotask(()=>r.onsuccess?.());return r;}};
  const c=context({indexedDB,crypto:webcrypto,Response,Blob,CompressionStream,DecompressionStream,ReadableStream,TextEncoder,TextDecoder});
  new vm.Script(storageArchive+`\nfunction outcomeRecords(text){return text.trim().split('\\n').filter(Boolean).map(JSON.parse)}function outcomeJSON(value){return JSON.stringify(value)}function outcomeTransportRestore(value){return value}` ,{filename:'index.html storage archive facade'}).runInContext(c);
  vm.runInContext(`let flushCalls=0;BACKGROUND={request:async type=>{if(type!=='flush')throw Error('unexpected host request '+type);flushCalls++;return{id:'g1',records:2,processingMode:'worker'}}};const archiveLog=backgroundStorageLog();`,c);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('archiveLog.status()',c))),{id:'fixture',records:0,processingMode:'worker'});
  assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext('archiveLog.saved()',c))),[meta]);
  const opened=await vm.runInContext("archiveLog.open('g1')",c);
  const openRows=[];for await(const row of opened.records())openRows.push(JSON.parse(JSON.stringify(row)));
  assert.deepEqual(openRows,rows,'opening a saved archive reads its complete immutable extent');
  assert.equal(vm.runInContext('flushCalls',c),0,'status, saved, and open are observational reads');
  assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext('archiveLog.flush()',c))),{id:'g1',records:2,processingMode:'worker'});
  vm.runInContext('archiveLog.status().records=999',c);
  assert.equal(vm.runInContext('WORKER_PRESENTATION.storageStatus.records',c),2,'status returns a defensive copy');
  assert.equal(vm.runInContext('flushCalls',c),1,'explicit flush forwards exactly once to the worker');
  const active=await vm.runInContext('(async()=>{const out=[];for await(const r of archiveLog.records())out.push(r);return out})()',c);
  assert.deepEqual(JSON.parse(JSON.stringify(active)),rows.slice(0,2),'records stop at the post-flush record boundary');
  assert.equal(vm.runInContext('flushCalls',c),2);
  const streamed=await vm.runInContext(`(async()=>{const reader=archiveLog.stream().getReader();let text='';for(;;){const n=await reader.read();if(n.done)break;text+=new TextDecoder().decode(n.value)}return text})()`,c);
  const lines=streamed.trim().split('\n').map(JSON.parse);
  assert.equal(lines[0].endSeq,1);assert.deepEqual(lines.slice(1),rows.slice(0,2));
  assert.equal(vm.runInContext('flushCalls',c),3,'each active stream establishes one new frozen boundary');
  assert.equal(vm.runInContext('W.clock.day',c),7);assert.equal(vm.runInContext('JOURNAL.length',c),0);
  assert.ok(reads.every(name=>name==='games'||name==='chunks'));
  assert.equal(vm.runInContext('STORAGE_OUTCOMES.status().records',c),0);
});
