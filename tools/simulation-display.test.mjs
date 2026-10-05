import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function region(from,to){const a=source.indexOf(from),b=source.indexOf(to,a);assert.notEqual(a,-1,`missing ${from}`);assert.ok(b>a,`missing ${to}`);return source.slice(a,b);}
function run(code,globals={}){const c=vm.createContext(globals);vm.runInContext(code,c);return c;}

test('display clock clamps queued backlog, rejects nonfinite interpolation, and never writes W.clock',()=>{
  const c=run(region('const day=()=>W.clock.day;','const year=()=>'),{W:{clock:{day:42,frac:0.7}},G:{clockFrac:7},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  const before=JSON.stringify(c.W.clock);assert.equal(c.displayFrac(),0.999);assert.equal(c.displayDay(),42.999);assert.equal(JSON.stringify(c.W.clock),before);
  c.G.clockFrac=Infinity;assert.equal(c.displayFrac(),0);assert.equal(c.displayDay(),42);assert.equal(JSON.stringify(c.W.clock),before);
  delete c.G.clockFrac;assert.equal(c.displayFrac(),0.7);assert.equal(c.displayDay(),42.7);assert.equal(JSON.stringify(c.W.clock),before);
});

test('envoy expiry belongs to the tick and removes only dates at or before today, preserving survivors',()=>{
  const c=run(source.slice(source.indexOf('function tickEnvoys()'),source.indexOf('\nfunction royalHost()',source.indexOf('function tickEnvoys()'))),{W:{envoys:[{id:'later',back:21},{id:'equal',back:20},{id:'earlier',back:19},{id:'later2',back:30}]},today:20,day:()=>c.today});
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
