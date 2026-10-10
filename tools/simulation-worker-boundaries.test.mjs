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
const fortSeams=extract('function fortCircuitKey(s,c){','function objectiveBuilding(')+'\n'+extract('function casRing(s){','function casR(s,R){');
const fortReads=extract('function wallKindAt(s,a){','/* Circuits own their shape');
const foregroundAdapters=extract('function workerQuery(key,payload,install){','function workerRefreshCourt(');
const hud=extract('function hudFigures(){','/* =========================================================================\n   PER-FRAME WORLD ANIMATION');
const chronicle=extract('function chronicleAdd(evs){','function reignHeader(n){');
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
    var SPEEDS=[0,0.5,2,8,30,360,1/1800];const p={id:4,si:0,sx:'f',tr:'weaver'},s={folk:[p],pos:{x:1,z:2}};W.settlements=[s];
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
  assert.deepEqual([...second.times],[7.3]);assert.equal(second.day,7.3);assert.deepEqual([...second.people[0].track],[1,2,0,3],'paused: one place, out of doors and walking');auditDTO(second);
  for(const [start,end]of [['function townsfolkFor(','function planWalk('],['function stepWalker(','function rockNear(']]){
    const semantic=extract(start,end);assert.doesNotMatch(semantic,/\brand\s*\(|Math\.random\s*\(/,'canonical visual semantics must remain deterministic');
  }
});

test('the citizen plan walks the folk a frame of the pace at a time, ahead of the reading, and carries their steps over the turn of the day',()=>{
  const c=context();
  vm.runInContext(`
    var SPEEDS=[0,0.5,2,8,30,360,1/1800];speedIdx=1;const s={folk:[{id:4,si:0,sx:'f',tr:'weaver'},{id:5,si:0,sx:'m',tr:'smith'}],pos:{x:1,z:2}};W.settlements=[s];G._calls=[];
    const folkName=()=>"Ada",famName=()=>"Weaver",ageYrs=()=>24;
    function townsfolkFor(){G._planned=(G._planned||0)+1;return s.folk.filter(p=>p.id!==5||G._planned>1).map(p=>({s,p,g:null,fw:p.id===4?{A:{x:0,z:0},B:{x:0,z:9},flip:false}:null,pace:2,sc:1,col:new THREE.Color(0x123456),x:1,z:2,ry:0,t:0,state:'work',until:0,route:null,ri:0,out:true,walking:true,goal:'work',doing:'weaving'}))}
    function warmWalkers(L){for(const w of L)w.x=50}
    function stepWalker(w,dt,fr,D){G._calls.push({dt,fr,D});w.t+=dt;w.x+=1;if(w.fw)w.fw.flip=!w.fw.flip}
  `,c);
  const h=0.5/60,first=vm.runInContext('workerRenderCitizens(0,{frac:.9})',c),calls=vm.runInContext('G._calls',c);
  assert.ok(calls.length>=24&&calls.every(k=>Math.abs(k.dt-100*h)<1e-9),'a frame of the pace at a time');
  assert.ok(first.times.length===calls.length+1&&first.times.at(-1)>=7.9+0.4*0.5-1e-9,'ahead of the reading');
  const steps1=calls.length;assert.deepEqual([first.people[0].track[0],first.people[0].track.at(-4)],[50,50+steps1],'warmed to the hour, then walked on');
  assert.ok(calls.filter(k=>k.D===8).length>0&&calls.every(k=>k.D===Math.floor(7.9+(calls.indexOf(k)+1)*h+1e-12)&&k.fr>=0&&k.fr<1),'past midnight, the next day\'s hours');
  vm.runInContext('W.clock.day=8;G._calls.length=0',c);
  const next=vm.runInContext('workerRenderCitizens(0,{frac:.05})',c),A=next.people.find(p=>p.id===4),B=next.people.find(p=>p.id===5);
  assert.equal(vm.runInContext('G._planned',c),2,'the day turns: a new plan');
  assert.ok(next.times[0]<=8.05&&next.times[0]>=8.05-0.15*0.5-h,'steps kept a little behind the reading');
  for(let i=1;i<next.times.length;i++)assert.ok(Math.abs(next.times[i]-next.times[i-1]-h)<1e-9,'one walk, unbroken by the new plan');
  const steps2=vm.runInContext('G._calls.length',c)/2;assert.equal(A.track.length,4*next.times.length);assert.equal(B.track.length,4*next.times.length);
  assert.equal(A.track.at(-4),50+steps1+steps2,'the old hand goes on where his steps had brought him');assert.deepEqual([B.track[0],B.track.at(-4)],[50,50+steps2],'the new hand starts where the plan puts him');
  assert.equal(vm.runInContext('G._workerCitizenPlans.get(0).people.find(w=>w.p.id===4).fw.flip',c),(steps1+steps2)%2===1,'the furrow turned as it was walked');
  auditDTO(next);
  const ahead=vm.runInContext('workerRenderCitizens(0,{frac:.06,view:8.3})',c);
  assert.ok(ahead.times.at(-1)>=8.3+0.4*0.5-1e-9&&ahead.times[0]<=8.06,'the walk keeps to the screen\'s clock where it runs ahead of the reading');
  const far=vm.runInContext('workerRenderCitizens(0,{frac:.07,view:60})',c);assert.ok(far.times.at(-1)<=8.07+1+0.4*0.5+h,'a screen clock days astray is held to a day of the reading');
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

  const same=vm.runInContext(`(()=>{G.buildingDirty.add(W.bldList[1]);return workerPresentation(false)})()`,c);
  assert.equal(same.buildings,undefined,'a body marked dirty that is as the screen has it is not sent');assert.equal(same.dirty.details,false);
  const dirty=vm.runInContext(`(()=>{W.bldList[1].state='ruin';G.buildingDirty.add(W.bldList[1]);return workerPresentation(false)})()`,c);
  assert.equal(dirty.dirty.structures,false);assert.equal(dirty.dirty.buildings,false);
  assert.deepEqual(Array.from(dirty.buildings,b=>b.idx),[1],'only the changed body is sent');
  assert.equal(dirty.roads,undefined);assert.equal(dirty.settlements[0].buildings,undefined);
});

test('a day on which nothing a structure is drawn from changed publishes no streets, roads or structure flags; a change publishes only itself',()=>{
  const c=context();
  vm.runInContext(`
    const b0={idx:0,arch:'house',state:'sound',x:1,z:2,w:4,d:5,rot:0,lot:[{x:0,z:0},{x:4,z:0},{x:4,z:4}]};
    const st=(n,x)=>({pts:[{x,z:0},{x:x+5,z:5},{x:x+9,z:9}],hw:2,kind:'lane',name:n,hidden:false});
    const s={name:'Test',kind:'town',owner:0,pos:{x:0,y:0,z:0},radius:10,extentR:20,hm:true,buildings:[b0],fires:[],furl:[],streets:[st('High',0),st('Low',30)],places:[{x:3,z:3,r:5}],folk:[]};
    b0.s=s;W.bldList=[b0];W.settlements=[s];W.capital=s;W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];
    W.roads=[{a:0,b:1,path:[{x:0,z:0},{x:9,z:9}],drawn:[{x:0,z:0},{x:9,z:9}],bridges:[],cond:1}];W.bridges=[];W.memorials=[];
    W.caravans=[{origin:0,dest:1,good:'grain',qty:3,departDay:2,poly:[{x:0,z:0},{x:50,z:50}],sea:false}];
    globalThis.flag=()=>{G.structuresDirty=G.roadsDirty=G.detDirty=true;};
  `,c);
  const boot=vm.runInContext('workerPresentation(true)',c);
  assert.equal(boot.settlements[0].streets.length,2);assert.equal(boot.roads.length,1);assert.equal(boot.caravans[0].poly.length,2);
  const quiet=vm.runInContext('(()=>{flag();return workerPresentation(false)})()',c);
  assert.equal(quiet.settlements[0].streets,undefined,'streets as the screen has them stay home');assert.equal(quiet.settlements[0].places,undefined);assert.equal(quiet.roads,undefined);
  assert.equal(quiet.caravans[0].poly,undefined,'a caravan crosses once with its road');assert.equal(quiet.caravans[0].qty,3);assert.equal(quiet.memorials,undefined);
  assert.deepEqual({...quiet.dirty,orders:undefined,armies:undefined,herds:undefined},{structures:false,buildings:false,walls:false,details:false,roads:false,labels:false,herds:undefined,orders:undefined,armies:undefined});
  const moved=vm.runInContext('(()=>{W.settlements[0].streets.push({pts:[{x:60,z:0},{x:70,z:9}],hw:2,kind:"lane",name:"New",hidden:false});flag();return workerPresentation(false)})()',c);
  assert.equal(moved.settlements[0].streets.length,3,'a changed list crosses whole');assert.equal(moved.settlements[0].places,undefined);assert.equal(moved.dirty.structures,true);assert.equal(moved.dirty.roads,true);assert.equal(moved.roads,undefined);
  const road=vm.runInContext('(()=>{W.roads[0].cond=.5;flag();return workerPresentation(false)})()',c);
  assert.equal(road.roads.length,1);assert.equal(road.roads[0].cond,.5);assert.equal(road.roads[0].path,undefined,'a road whose condition changed does not resend its path');assert.equal(road.dirty.roads,true);
  const after=vm.runInContext('(()=>{flag();return workerPresentation(false)})()',c);
  assert.equal(after.settlements[0].streets,undefined);assert.equal(after.roads,undefined);assert.equal(after.dirty.structures,false);
  const again=vm.runInContext('(()=>{W.caravans.length=0;flag();return workerPresentation(false)})()',c);
  const back=vm.runInContext('(()=>{W.caravans.push({origin:0,dest:1,good:"grain",qty:3,departDay:2,poly:[{x:0,z:0},{x:50,z:50}],sea:false});return workerPresentation(false)})()',c);
  assert.equal(again.caravans.length,0);assert.equal(back.caravans[0].poly.length,2,'what the screen let go of crosses whole when it returns');
});

test('a content key reads what a copy would carry: scratch, links and accounts do not move it, a point or a name does',()=>{
  const c=context();
  const k=JSON.parse(JSON.stringify(vm.runInContext(`(()=>{
    const a={pts:[{x:1,z:2},{x:3,z:4}],name:'High',hw:2,_scratch:{big:[1,2,3]},cands:[{mx:1,done:false}],s:{link:1},storage:{x:1}};
    const k0=visualKey(a);a._scratch.big.push(9);a.cands[0].done=true;a.s.link=2;a.storage.x=9;const k1=visualKey(a);
    a.pts[1].z=5;const k2=visualKey(a);a.pts[1].z=4;const k3=visualKey(a);a.name='Hig';const k4=visualKey(a);a.name='High';a.extra=true;const k5=visualKey(a);
    const cyc={a:1};cyc.self=cyc;const k6=visualKey(cyc),k7=visualKey(new Float64Array([1,2,3])),k8=visualKey(new Float64Array([1,2,4]));
    return [k0,k1,k2,k3,k4,k5,k6,k7,k8];})()`,c)));
  assert.equal(k[0],k[1],'the planner\'s scratch (cands, _names), links and accounts are not part of what crosses');assert.notEqual(k[1],k[2],'a moved point');assert.equal(k[1],k[3],'and the same again when it is put back');
  assert.notEqual(k[3],k[4],'a changed name');assert.notEqual(k[3],k[5],'a new name');assert.ok(Number.isFinite(k[6]),'a cycle ends');assert.notEqual(k[7],k[8],'typed arrays count');
  const copy=vm.runInContext(`JSON.stringify([visualGeometry(Array.from({length:12},(_,i)=>({x:i,z:i*2}))),visualGeometry(Array.from({length:12},(_,i)=>({x:i,z:i*2,nb:-1}))).slice(0,2),visualGeometry([{x:1,z:2,_t:5,s:{a:1},c:{d:2}}])])`,c);
  const [line,withNb,one]=JSON.parse(copy);assert.equal(line.length,12);assert.deepEqual(line[3],{x:3,z:6});assert.deepEqual(withNb[1],{x:1,z:2,nb:-1},'a point with more than x and z keeps what it has');assert.deepEqual(one,[{x:1,z:2,c:{d:2}}],'cut names stay cut');
});

test('install keeps the geometry a packet leaves out, and maps a town\'s buildings only when its list crossed',()=>{
  const classes=new Set(),document={body:{classList:{toggle:(k,on)=>{if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)}},getElementById:()=>({classList:{contains:()=>false}})};
  const c=context({document});
  vm.runInContext(`
    W.settlements=[{buildings:[],streets:[],places:[],furl:[],folk:[],fires:[]}];W.bldList=[];W.treeSpots=[];
    const base={protocol:1,day:7,speed:0,mod:{},world:{clock:{frac:0}},monarch:{},player:null,houses:[],petitions:[],commands:0,capital:0,armies:[],caravans:[],envoys:[],travellers:[],ships:[],banditCamps:[],projects:[],events:[],dirty:{}};
    base.world.player={on:true};
    let packet={...base,revision:1,settlements:[{si:0,name:'T',buildings:[0,1],fires:[],furl:[],millId:null,streets:[{pts:[{x:1,z:2}]}]}],
      buildings:[{idx:0,si:0,arch:'house',state:'sound',lot:[{x:1,z:1}]},{idx:1,si:0,arch:'hall',state:'sound'}],caravans:[{renderKey:'a',poly:[{x:1,z:1}],qty:3,renderIndex:0}],memorials:[{x:1,z:1}]};
  `,c);
  vm.runInContext('installPresentation(packet)',c);
  const held=vm.runInContext('[W.settlements[0].buildings[0],W.settlements[0].buildings[1],W.caravans[0]]',c);
  assert.equal(vm.runInContext('W.settlements[0].buildings.length',c),2);assert.equal(vm.runInContext('W.caravans[0].poly.length',c),1);
  vm.runInContext(`packet={...base,revision:2,settlements:[{si:0,name:'T2',fires:[],millId:null}],buildings:[{idx:1,si:0,arch:'hall',state:'ruin'}],caravans:[{renderKey:'a',qty:2,renderIndex:0}]};installPresentation(packet)`,c);
  const after=vm.runInContext('[W.settlements[0].buildings[0],W.settlements[0].buildings[1],W.caravans[0]]',c);
  assert.equal(vm.runInContext('W.settlements[0].name',c),'T2');assert.equal(after[0],held[0]);assert.equal(after[1],held[1],'the same displayed bodies');assert.equal(after[2],held[2],'the same displayed caravan');
  assert.equal(vm.runInContext('W.settlements[0].streets.length',c),1,'streets the packet did not carry are as they were');assert.equal(vm.runInContext('W.bldList[0].lot.length',c),1);
  assert.equal(vm.runInContext('W.bldList[1].state',c),'ruin');assert.equal(vm.runInContext('W.caravans[0].poly.length',c),1);assert.equal(vm.runInContext('W.caravans[0].qty',c),2);assert.equal(vm.runInContext('W.memorials.length',c),1);
  vm.runInContext(`packet={...base,revision:3,settlements:[{si:0,name:'T2',buildings:[0],fires:[],millId:null}]};installPresentation(packet)`,c);
  assert.equal(vm.runInContext('W.settlements[0].buildings.length',c),1,'a list that crossed is mapped');assert.equal(vm.runInContext('W.bldList[1].state',c),'ruin');
});

test('a long route crosses as one buffer of x,z pairs and is laid out again as points in the display',()=>{
  const classes=new Set(),document={body:{classList:{toggle:(k,on)=>{if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)}},getElementById:()=>({classList:{contains:()=>false}})};
  const worker=context(),main=context({document});
  vm.runInContext(`
    W.settlements=[];W.bldList=[];W.houses=[];W.petitions=[];W.projects=[];W.capital=null;
    const route=Array.from({length:50},(_,i)=>({x:i*1.5,z:i*-2.25})),shortRoute=[{x:1,z:2},{x:3,z:4}];
    W.caravans=[{origin:0,dest:1,good:'grain',qty:3,departDay:2,poly:route,sea:false},{origin:1,dest:2,good:'wool',qty:1,departDay:2,poly:shortRoute,sea:false}];
    W.travellers=[{p:{id:5,si:0,sx:1},depart:3,poly:[...route.slice(0,10),{x:1,z:1,nb:7},...route.slice(10)]}];
  `,worker);
  const packet=vm.runInContext('(()=>{workerPresentation(true);return workerPresentation(false)})()',worker),boot=vm.runInContext('(()=>{WORKER_PRESENTATION.sent=null;return workerPresentation(false)})()',worker);
  assert.ok(ArrayBuffer.isView(boot.caravans[0].poly)&&boot.caravans[0].poly.length===100,'fifty points as a hundred numbers');assert.equal(Array.isArray(boot.caravans[1].poly),true,'a short route is a short list');
  assert.equal(Array.isArray(boot.travellers[0].poly),true,'a route whose points are more than x and z crosses as it is');assert.equal(packet.caravans[0].poly,undefined,'and once');
  assert.equal(vm.runInContext('(()=>{const p=workerPresentation(true);return presentationTransfers(p).includes(p.caravans[0].poly.buffer)})()',worker),true,'the route buffer travels by transfer');
  main.wire=boot;vm.runInContext(`W.settlements=[];W.armies=[];W.land.F=[];const base={protocol:1,revision:1,day:7,speed:0,mod:{},world:{clock:{frac:0}},monarch:{},player:null,houses:[],petitions:[],commands:0,capital:0,settlements:[],armies:[],envoys:[],ships:[],banditCamps:[],projects:[],events:[],dirty:{}};
    installPresentation({...base,caravans:wire.caravans,travellers:wire.travellers})`,main);
  const poly=JSON.parse(JSON.stringify(vm.runInContext('W.caravans[0].poly',main)));assert.equal(poly.length,50);assert.deepEqual(poly[3],{x:4.5,z:-6.75});assert.deepEqual(poly[49],{x:73.5,z:-110.25});
  vm.runInContext(`{const c={...wire.caravans[0],qty:2};delete c.poly;installPresentation({...base,revision:2,caravans:[c],travellers:[]});}`,main);
  assert.equal(vm.runInContext('W.caravans[0].poly.length',main),50,'the route the screen holds stays when a packet leaves it out');assert.equal(vm.runInContext('W.caravans[0].qty',main),2);
});

test('the land mask crosses only when a cell of it is not as the screen has it',()=>{
  const c=context();
  vm.runInContext(`W.houses=[];W.petitions=[];W.armies=[];W.caravans=[];W.envoys=[];W.travellers=[];W.ships=[];W.banditCamps=[];W.projects=[];W.bldList=[];W.settlements=[];W.capital=null;`,c);
  vm.runInContext('workerPresentation(true)',c);
  const same=vm.runInContext('(()=>{G.landMaskDirty=true;return workerPresentation(false)})()',c);
  assert.equal(same.mask,undefined,'marked dirty with every cell as sent');
  const changed=vm.runInContext('(()=>{G.landMaskDirty=true;W.land.mask[5]=9;return workerPresentation(false)})()',c);assert.equal(changed.mask[5],9);
  const settled=vm.runInContext('(()=>{G.landMaskDirty=true;return workerPresentation(false)})()',c);assert.equal(settled.mask,undefined);
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

test('geometry copies keep primitive names (a tree\'s size s) and cut only links back into the world',()=>{
  const c=context();
  const r=vm.runInContext(`(()=>{const town={name:'Town',buildings:[]},tree={x:1,z:2,s:1.4,v:.2,k:'dec',i:3},sap={i:1,x:1,z:2,s:.3,k:'dec'};
    const b={idx:0,s:town,p:{id:4},head:{id:5},title:{owner:{id:6}},men:[{id:1}],crew:[{id:2}],riders:[{id:3}],churchyardOf:{arch:'temple'},geometry:{s:2,p:.5,title:'Sign',head:3,men:0}};
    return {tree:visualGeometry(tree),saplings:visualGeometry([sap]),b:visualGeometry(b),private:visualGeometry({storage:'yard',ledger:3,account:1,holdings:'x',beneficiary:2,ownerAccount:0})};})()`,c);
  assert.equal(r.tree.s,1.4,'tree size');assert.equal(r.saplings[0].s,.3,'sapling size');
  for(const k of ['s','p','head','title','men','crew','riders','churchyardOf'])assert.equal(r.b[k],undefined,`${k} link is cut`);
  assert.deepEqual(JSON.parse(JSON.stringify(r.b.geometry)),{s:2,p:.5,title:'Sign',head:3,men:0},'the same names holding numbers or words cross');
  assert.deepEqual(Object.keys(r.private),[],'private account names never cross, whatever they hold');auditDTO(r);
});

test('walls, castle rings, sieges and castle lots cross; circuits and hosts relink to what was installed beside them',()=>{
  const c=context();new vm.Script(fortSeams+'\nfunction musterPos(){return{x:0,z:0,dir:0}}').runInContext(c);
  vm.runInContext(`
    const N=8,ring=r=>({x:5,z:6,r,wallRad:new Float32Array(N).fill(r),wallKind:new Uint8Array(N),gateA:1.5});
    const s={name:'Fort',kind:'town',owner:1,pos:{x:0,y:0,z:0},radius:10,extentR:20,buildings:[],fires:[],furl:[],streets:[],places:[],folk:[],
      wallRad:new Float32Array(N).fill(60),wallKind:Uint8Array.from([0,1,1,0,2,0,3,0]),hillCastle:{...ring(30),timber:true},burgRing:{x:1,z:2,r:38},relicWalls:[[{x:1,z:1},{x:2,z:2}]],_gateTrafficVersion:4};
    const keep={idx:0,arch:'keep',state:'sound',x:5,z:6,w:8,d:8,rot:0,s,_inCastle:true,lot:[{x:1,z:1},{x:2,z:1},{x:2,z:2}]};s.buildings.push(keep);
    const host={id:7,house:2,state:'siege',at:0,strength:900,men:[]},column={id:8,house:2,state:'battle',at:0,strength:300,men:[],joined:host,foe:null},rams={id:9,house:2,state:'siege',at:0,strength:200,men:[]};
    host.siegeArc={c:.4,w:.9,R:70,circuit:s.hillCastle};rams.siegeArc={c:2,w:.5,R:60,circuit:s};s.siegeBy={houseName:'House Black',army:host};s.takenCircuit=s.hillCastle;
    W.settlements=[s];W.capital=s;W.bldList=[keep];W.armies=[host,column,rams];W.houses=[{name:'Crown'},{name:'A'},{name:'House Black'}];W.petitions=[];W.projects=[];
    globalThis.fort=s;globalThis.keep=keep;
  `,c);
  const packet=vm.runInContext('workerPresentation(true)',c);auditDTO(packet);
  const r=packet.settlements[0],arc=id=>JSON.parse(JSON.stringify(packet.armies.find(x=>x.id===id).siegeArc));
  assert.deepEqual(Array.from(r.wallKind),[0,1,1,0,2,0,3,0]);assert.notEqual(r.wallKind,vm.runInContext('fort.wallKind',c),'a packet-owned copy');
  assert.deepEqual(JSON.parse(JSON.stringify(r.siegeBy)),{houseName:'House Black',army:{id:7}});
  assert.equal(r.takenCircuit,'hill');assert.deepEqual(arc(7),{c:.4,w:.9,R:70,circuit:{si:0,key:'hill'}});assert.deepEqual(arc(9).circuit,{si:0,key:'town'});
  assert.ok(JSON.stringify(packet.armies).length<1500,'the besiegers carry circuit names, not copies of the town');
  assert.equal(r.hillCastle.timber,true);assert.equal(r.hillCastle.wallRad.length,8);assert.deepEqual(JSON.parse(JSON.stringify(r.burgRing)),{x:1,z:2,r:38});
  assert.deepEqual(JSON.parse(JSON.stringify(r.relicWalls)),[[{x:1,z:1},{x:2,z:2}]]);assert.equal(r._gateTrafficVersion,4);
  assert.equal(packet.buildings[0]._inCastle,true);assert.equal(packet.armies.find(x=>x.id===8).joined.strength,900);
  for(const k of ['roofPlan','wheel','waterwheel'])assert.ok(!(k in packet.buildings[0]));for(const k of ['gateAngles','wallGates','ramparts','breaches'])assert.ok(!(k in r));

  const main=context();new vm.Script(fortSeams+'\n'+fortReads).runInContext(main);
  const day=n=>{vm.runInContext(`W.clock.day=${n};G.buildingDirty.add(keep);G.structuresDirty=true;WORKER_PRESENTATION.sent=null`,c); /* no memory of the screen (a restart): every packet crosses whole, as a bootstrap does */main.wire=structuredClone(vm.runInContext('workerPresentation(false)',c));vm.runInContext('installPresentation(wire)',main);
    return vm.runInContext(`(()=>{const s=W.settlements[0],host=W.armies.find(a=>a.id===7),col=W.armies.find(a=>a.id===8),rams=W.armies.find(a=>a.id===9);globalThis.lastRing=globalThis.ring;globalThis.ring=s.hillCastle;
      return {ring:host.siegeArc?.circuit===s.hillCastle,town:rams.siegeArc?.circuit===s,taken:s.takenCircuit===s.hillCastle,army:s.siegeBy?.army===host,joined:col.joined===host,strength:col.joined.strength,
        fresh:globalThis.lastRing!==globalThis.ring,kinds:[0,1,2,3,4,5,6,7].map(k=>wallKindAt(s,k/8*Math.PI*2)),inCastle:W.bldList[0]._inCastle,bldS:W.bldList[0].s===s,gates:s._gateTrafficVersion}})()`,main);};
  const dayOf=n=>JSON.parse(JSON.stringify(day(n)));
  for(const n of [8,9]){const got=dayOf(n);
    assert.deepEqual({...got,fresh:undefined},{ring:true,town:true,taken:true,army:true,joined:true,strength:900,fresh:undefined,kinds:[0,1,1,0,2,0,3,0],inCastle:true,bldS:true,gates:4},`day ${n}`);
    if(n===9)assert.equal(got.fresh,true,'each packet brings a new ring and the circuits follow it');}
  vm.runInContext('fort.siegeBy=null;fort.takenCircuit=null',c);day(10);
  assert.deepEqual(Array.from(vm.runInContext('[W.settlements[0].siegeBy,W.settlements[0].takenCircuit]',main)),[null,null],'a lifted siege clears');
});

test('the worker\'s speed reply is authoritative: a stale pull cannot put back the speed it replaced',async()=>{
  const c=context();new vm.Script(workerNotice+'\n'+foregroundAdapters).runInContext(c);
  vm.runInContext(`const SPEEDS=[0,.5,2,8,30,360,1/1800];let hudCalls=0;function updateHUD(){hudCalls++}function storageFaultNotice(){}
    const calls=[],pulls=[];BACKGROUND={closed:false,request(type,payload){calls.push(type);if(type==='view'){let resolve;const p=new Promise(r=>resolve=r);pulls.push(resolve);return p;}
      if(type==='pause'||type==='speed')return Promise.resolve({day:7,speed:type==='pause'?0:payload.index,revision:4});return Promise.resolve({day:7});}};
    const packet=(revision,speed,day)=>({protocol:1,revision,day,speed,mod:{},world:{clock:{day}},monarch:{},houses:[],petitions:[],commands:0,settlements:[],capital:0,
      armies:[],caravans:[],envoys:[],travellers:[],ships:[],banditCamps:[],dragon:null,memorials:[],projects:[],events:[],dirty:{}});
    G.workerRevision=3;globalThis.first=workerRefreshLandscape();globalThis.paused=workerSetSpeed(0);`,c);
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(Array.from(vm.runInContext('speedChanges',c)),[0],'the pause reply sets the speed at once');
  assert.equal(vm.runInContext('pulls.length',c),1,'the refresh waits behind the pull already on the wire');
  vm.runInContext('pulls[0](packet(4,5,6))',c);await new Promise(r=>setImmediate(r));
  assert.deepEqual(Array.from(vm.runInContext('speedChanges',c)),[0],'a packet cut before the pause keeps its geometry but not its speed');
  assert.equal(vm.runInContext('W.clock.day',c),6);assert.equal(vm.runInContext('pulls.length',c),2,'a fresh pull follows');
  vm.runInContext('pulls[1](packet(5,0,7))',c);await vm.runInContext('paused',c);
  assert.deepEqual(Array.from(vm.runInContext('speedChanges',c)),[0,0]);assert.equal(vm.runInContext('W.clock.day',c),7);
  vm.runInContext('installPresentation(packet(6,2,8))',c);assert.deepEqual(Array.from(vm.runInContext('speedChanges',c)),[0,0,2],'a later revision speaks for a speed the worker chose itself');
  assert.deepEqual(Array.from(vm.runInContext('calls',c)),['view','pause','watch','view']);
});

test('a worker clock moves the HUD\'s date, treasury and people between landscape packets, never backwards',()=>{
  const els=new Map(),document={getElementById:id=>els.get(id)||els.set(id,{textContent:'',setAttribute(){}}).get(id)};
  let now=1000;const c=context({document,performance:{now:()=>now,timeOrigin:0}});new vm.Script(foregroundAdapters+'\n'+hud).runInContext(c);
  vm.runInContext(`const SEASONGLYPH=['❀','☀','❦','❄'];
    W.clock={day:30};W.treasury=100;W.legitimacy=50;W.weather={state:'clear'};W.monarch=null;W.player=null;W.settlements=[{pop:40},{pop:60}];`,c);
  vm.runInContext(`installClock({day:34,frac:.25,speed:5,at:1e12,treasury:180.4,legitimacy:52,pop:123,weather:'rain',drought:0,plagueActive:false})`,c);
  assert.equal(els.get('treasury').textContent,'180');assert.equal(els.get('realmpop').textContent,'123');assert.equal(String(els.get('legit').textContent),'52');
  assert.equal(vm.runInContext('W.clock.day',c),34);assert.equal(els.get('wxchip').textContent,'🌧');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('[G.workerClock.day,G.workerClock.frac,G.workerClock.speed,G.workerClock.at]',c))),[34,.25,5,1e12],'the latest worker clock is kept for a screen clock');
  vm.runInContext(`installClock({day:35,treasury:190,legitimacy:52,pop:124,weather:'rain'})`,c);
  assert.equal(vm.runInContext('W.clock.day',c),35);assert.equal(els.get('treasury').textContent,'180','repaints at most ten times a second; the frame loop paints the rest');
  vm.runInContext('updateHUD()',c);assert.equal(els.get('treasury').textContent,'190');assert.equal(els.get('realmpop').textContent,'124');
  now+=101;vm.runInContext(`installClock({day:36,treasury:200,legitimacy:52,pop:125,weather:'rain'})`,c);assert.equal(els.get('treasury').textContent,'200','a later clock repaints after the interval');assert.equal(els.get('realmpop').textContent,'125');
  vm.runInContext(`installClock({day:33,treasury:1,legitimacy:1,pop:1,weather:'snow'})`,c);vm.runInContext('updateHUD()',c);
  assert.equal(els.get('treasury').textContent,'200','an older clock is ignored');assert.equal(vm.runInContext('W.clock.day',c),36);
  vm.runInContext('W.clock={day:37};updateHUD()',c);assert.equal(els.get('realmpop').textContent,'100','a newer packet\'s own towns count again');
});

test('a packet\'s events are laid out once, and only fresh ones fly the camera or light the map',()=>{
  const c=context({document:{}});
  vm.runInContext(`const calls=[];function chronicleAdd(list){calls.push(['annals',list.map(e=>e.day)])}function presentReign(t){calls.push(['reign',t])}
    const director={push(ev){calls.push(['director',ev.day])}};function fxEvent(ev){calls.push(['fx',ev.day])}W.clock.day=60;`,c);
  new vm.Script(projectEvent).runInContext(c);
  vm.runInContext(`const evs=[];for(let d=31;d<=60;d++){evs.push({day:d,cat:'trade',pri:4,pos:{x:0,z:0},text:'e'+d});if(d===45)evs.push({day:45,reign:true,text:'R'});}projectEvents(evs)`,c);
  const calls=JSON.parse(JSON.stringify(vm.runInContext('calls',c))),range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
  assert.deepEqual(calls.slice(0,3),[['annals',range(31,45)],['reign','R'],['annals',range(46,60)]]);
  assert.deepEqual(calls.slice(3),range(57,60).flatMap(d=>[['director',d],['fx',d]]),'a month-old event is in the annals only');

  const counts={append:0,measure:0};const kid=()=>({dataset:{},style:{},setAttribute(){},addEventListener(){}});
  const list={children:[],get scrollTop(){counts.measure++;return 0},set scrollTop(v){},get clientHeight(){return 100},get scrollHeight(){counts.measure++;return 120},
    appendChild(f){counts.append++;this.children.push(...f.kids)},removeChild(){this.children.shift()},get firstChild(){return this.children[0]}};
  const dom={createElement:kid,createDocumentFragment:()=>({kids:[],appendChild(el){this.kids.push(el)}}),getElementById:()=>({classList:{contains:()=>true}})};
  const d=context({document:dom});
  vm.runInContext(`function chronList(){return list}const contextUI={kind:null};let chronFilter='all';const linkNames=x=>x,esc=x=>x;function decorateControls(){}`,Object.assign(d,{list}));
  new vm.Script(chronicle).runInContext(d);
  vm.runInContext(`chronicleAdd(Array.from({length:30},(_,i)=>({day:i,cat:'trade',text:'e'+i})))`,d);
  assert.equal(counts.append,1,'one append for the run');assert.ok(counts.measure<=3,`layout read ${counts.measure} times, not thirty`);assert.equal(list.children.length,30);
  vm.runInContext(`chronicleAdd({day:31,cat:'trade',text:'one'})`,d);assert.equal(list.children.length,31,'a single entry still works');
});
