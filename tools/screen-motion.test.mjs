// The screen's own clock in worker mode (presStep): it runs on between the worker's readings at the chosen pace, eases
// toward each, never runs back, freezes on pause, and never runs far past the last day reported. Walkers and flocks
// carry on between replies (walkerAt, reconcileFlocks).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`markers ${from}`);return source.slice(a,b);};
const block=slice('// SCREEN MOTION BEGIN','// SCREEN MOTION END');
const readers=['displayFrac','displayDay'].map(n=>source.match(new RegExp('^function '+n+'\\(\\).*$','m'))[0]).join('\n');
const SPEEDS=[0,0.5,2,8,30,360,1/1800];

// A screen at 60 frames a second over a worker whose calendar runs at the pace set; readings come as the tests send them.
function screen({speed=1,day=100,frac=0}={}){
  const c=vm.createContext({G:{},W:{clock:{day}},BACKGROUND:{},SPEEDS,speedIdx:speed,clamp:(v,a,b)=>v<a?a:(v>b?b:v),Math,Number,Object,Map,
    performance:{timeOrigin:5000,now:()=>c.t},t:0});
  vm.runInContext(block+readers+'\nvar day=()=>W.clock.day;',c);
  const s={c,frames:[],
    get v(){return c.displayDay();},
    set speed(i){c.speedIdx=i;},
    set day(d){c.W.clock.day=d;},
    read(v,lateMs=0){c.presAnchor(v,c.performance.timeOrigin+c.t-lateMs);}, // a reading taken lateMs before it arrives
    frame(ms=1000/60){c.t+=ms;c.presStep();s.frames.push(c.displayDay());return c.displayDay();},
    run(ms,each){for(let t=0;t<ms;t+=1000/60){each?.(c.t);s.frame();}}};
  s.read(day+frac);s.frame();return s;
}
const steps=f=>f.slice(1).map((v,i)=>v-f[i]);

test('the screen clock runs at the chosen pace between readings and never runs back',()=>{
  const s=screen({speed:1,day:100,frac:0.2});let truth=100.2;
  // readings every 150 ms, each 0-40 ms late and jittered, with the day turning as the worker reports it
  s.run(6000,t=>{truth+=0.5/60;if(Math.round(t/(1000/60))%9===0){const late=(t*7919%40);s.read(truth-late/1000*0.5,late);s.day=Math.floor(truth);}});
  assert.ok(steps(s.frames).every(d=>d>=0),'never backwards');
  assert.ok(Math.abs(s.v-truth)<0.01,`keeps to the worker's calendar: ${s.v} against ${truth}`);
  const st=steps(s.frames.slice(60));assert.ok(Math.min(...st)>=0.5*0.5/60-1e-9&&Math.max(...st)<=2*0.5/60+1e-9,'within half and twice the pace');
  assert.ok(st.every(d=>d>0),'moves every frame');
});

test('a pause freezes the screen at once; a reading further on (a bounded advance) is taken forward',()=>{
  const s=screen({speed:1,day:100,frac:0.4});s.run(500);const at=s.v;
  s.speed=0;s.read(at-0.1);s.run(2000);assert.equal(s.v,at,'paused, a stale reading moves nothing');
  s.read(at);s.run(1000);assert.equal(s.v,at,'paused, the same reading moves nothing');
  s.day=110;s.read(110);s.frame();assert.equal(s.v,110,'a bounded advance is shown');
  s.run(1000);assert.equal(s.v,110);
});

test('without readings it runs at most a day and a little past the reported day',()=>{
  for(const speed of [1,2,4]){const s=screen({speed,day:100,frac:0.9});s.run(20000);
    assert.ok(s.v<=100+1+0.25*SPEEDS[speed]+1e-9,`speed ${speed}: ${s.v}`);assert.ok(s.v>100.9);}
  const s=screen({speed:5,day:100,frac:0});s.run(2000);assert.equal(s.v,100,'Reel holds to the reported day');s.day=130;s.frame();assert.equal(s.v,130);
});

test('a late reading is made up smoothly; one far ahead by a single jump forward',()=>{
  const s=screen({speed:1,day:100,frac:0.05}),rate=0.5;let truth=100.05;const tick=()=>{truth+=rate/60;s.day=Math.floor(truth);};
  s.run(300,tick);truth+=0.15*rate;s.read(truth); // the worker is found 0.15 s of pace further on than the screen
  s.frames.length=0;s.run(1200,tick);const st=steps(s.frames);
  assert.ok(Math.max(...st)<=2*rate/60+1e-9,'catches up at no more than twice the pace');
  assert.ok(Math.abs(s.v-truth)<0.02*rate,`converged: ${s.v} against ${truth}`);
  truth+=3*rate;s.day=Math.floor(truth);s.read(truth);s.frame();assert.ok(Math.abs(s.v-truth)<=rate/60*1.01,'three seconds behind: jumps to the reading');
});

test('no blip after a speed change or a command: the packet\'s missing fraction and a new pace leave the clock running on',()=>{
  const s=screen({speed:1,day:100,frac:0.6});let truth=100.6,rate=0.5;const tick=()=>{truth+=rate/60;s.day=Math.floor(truth);};
  s.run(800,tick);const before=s.v;
  s.c.G.clockFrac=0; // what installPresentation sets from a packet's clock, which carries no fraction
  assert.equal(s.v,before,'a packet cannot pull the screen back');
  s.speed=2;rate=2;s.frames.length=0;s.run(500,tick);const st=steps(s.frames);
  assert.ok(st.every(d=>d>=0&&d<=2*rate/60+1e-9),'runs on at the new pace');assert.ok(Math.abs(s.v-truth)<rate/60,`on the worker's calendar: ${s.v} against ${truth}`);
  s.read(truth); // the worker, having kept its part-day across the change, reports where the new pace has brought it
  s.frames.length=0;s.run(400,tick);assert.ok(steps(s.frames).every(d=>Math.abs(d-rate/60)<0.05*rate/60),'steady, no jump either way');
  const was=s.v;s.read(was-0.5,3000);s.frame();assert.ok(Math.abs(s.v-was-rate/60)<0.05*rate/60,'a reading older than the one in hand is no news');
  s.day=0;s.frame();assert.ok(s.v<1,'a new realm starts the clock afresh');
});

test('walkers go on along their route by their pace, back along it for a reading still to come, and stop at its end',()=>{
  const c=vm.createContext({Math,Number});vm.runInContext(block.replace(/const SCREEN_CLOCK[\s\S]*?(?=\/\/ Where a townsman)/,''),c);
  const route=[{x:0,z:0},{x:10,z:0},{x:10,z:10}],w={x:5,z:0,yaw:0,walking:true,state:'walk',route,routeIndex:0};
  assert.deepEqual([c.walkerAt(w,3).x,c.walkerAt(w,3).z],[8,0]);
  const turn=c.walkerAt(w,8);assert.ok(Math.abs(turn.x-10)<1e-9&&Math.abs(turn.z-3)<1e-9);
  const back=c.walkerAt(w,-2);assert.deepEqual([back.x,back.z],[3,0]);assert.deepEqual([c.walkerAt(w,-50).x,c.walkerAt(w,-50).z],[0,0]);
  assert.deepEqual([c.walkerAt(w,99).x,c.walkerAt(w,99).z],[10,10],'the end of the route');
  const still={...w,walking:false};assert.deepEqual({...c.walkerAt(still,5)},{x:5,z:0,yaw:0});
  const plough={x:0,z:0,yaw:0,walking:true,state:'work',furrow:{A:{x:0,z:0},B:{x:0,z:20},flip:false,run:false}};
  assert.ok(Math.abs(c.walkerAt(plough,10).z-3)<1e-9,'up the furrow at the plough\'s pace');assert.equal(c.walkerAt(plough,1000).z,20,'to its end');
});

test('a new herd plan keeps each flock in its field where it has wandered, and replaces one moved to another field',()=>{
  const c=vm.createContext({Math,Number,Map});vm.runInContext(block.replace(/const SCREEN_CLOCK[\s\S]*?(?=\/\/ A new plan of the herds)/,''),c);
  const field=[{x:0,z:0},{x:50,z:0},{x:50,z:50}],plan=(P,n=3)=>({kind:'sheep',si:2,boundary:P,center:{x:20,z:10},seed:7,
    members:Array.from({length:n},(_,i)=>({x:20+i,z:10,ox:i,oz:0,phase:i,yaw:0,coat:i/3,born:-400,walk:0,graze:0}))});
  const A=c.reconcileFlocks([],[plan(field),plan(field)]);assert.equal(A.length,2);assert.notEqual(A[0].key,A[1].key);
  A[0].cx=33;A[0].time=12;A[0].mem[1].x=41;
  const B=c.reconcileFlocks(A,[plan(field.map(q=>({...q}))),plan(field)].map((f,i)=>i?f:{...f,members:[...f.members,{...f.members[0],x:0}]}));
  assert.equal(B[0],A[0],'the same flock');assert.equal(B[0].cx,33);assert.equal(B[0].time,12);assert.equal(B[0].mem[1].x,41,'the beast where it wandered');assert.equal(B[0].mem.length,4);
  const C=c.reconcileFlocks(B,[plan([{x:100,z:0},{x:150,z:0},{x:150,z:50}])]);assert.notEqual(C[0],B[0],'another field: a new flock');assert.equal(C[0].mem[1].x,21);
  assert.equal(c.reconcileFlocks([],[plan([])])[0].P,null,'no field: unfenced, not fenced out of everywhere');
});
