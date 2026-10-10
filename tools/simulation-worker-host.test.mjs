import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('// SIMULATION WORKER HOST BEGIN');
const end=html.indexOf('// SIMULATION WORKER HOST END',start);
assert.ok(start>=0&&end>start,'embedded simulation worker host markers exist');
const source=html.slice(start,end)+'\nglobalThis.Host=SimulationWorkerHost;globalThis.Client=SimulationWorkerClient;';

function clock(){
  let id=0,now=0;const jobs=new Map();
  return {jobs,now:()=>now,setNow:n=>{now=n;},schedule(fn,ms){const key=++id;jobs.set(key,{fn,at:now+ms});return key;},cancel:key=>jobs.delete(key),
    async runNext(){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next)return false;jobs.delete(next[0]);now=Math.max(now,next[1].at);next[1].fn();return true;}};
}
function hostFixture(overrides={},options={}){
  const c=clock(),out=[],model={d:0,r:0,idx:0,log:[],
    async init(p,progress){this.log.push(['init',p]);await overrides.init?.(this,p,progress);},
    day(){return this.d;},rate(){return this.r;},reeling(){return this.idx===5;},speed(i){this.idx=i;this.r=[0,0.5,2,8,30,360,1/1800][i]||0;this.log.push(['speed',i]);},
    async wait(){this.log.push(['wait',this.d]);await overrides.wait?.(this);},
    tick(){if(overrides.tick)return overrides.tick(this);this.log.push(['tick',this.d+1]);this.d++;c.setNow(c.now()+10);return true;},
    validate(x){if(x?.bad)throw Error('invalid command');},command(x){this.log.push(['command',x.name]);overrides.command?.(this,x);},
    view(kind,payload){if(overrides.view) return overrides.view(this,kind,payload);return{day:this.d,kind};},
    async save(name){this.log.push(['save',this.d,name]);return{day:this.d,name};},async flush(){this.log.push(['flush',this.d]);return{day:this.d};}};
  if(overrides.urgent)model.urgent=()=>overrides.urgent(model);if(overrides.clock)model.clock=()=>overrides.clock(model);
  let h;const send=m=>{out.push(m);options.onSend?.(m,x=>h.receive(x));};
  h=vm.runInNewContext(source+';new Host(model,send,{now:clockNow,schedule:clockSchedule,cancel:clockCancel,budget:budgetValue})',{
    model,out,send,clockNow:c.now,clockSchedule:c.schedule,clockCancel:c.cancel,budgetValue:options.budget??5,Error,Map,Number,String,Promise,performance:{now:c.now},setTimeout,clearTimeout});
  return{h,model,out,c};
}
async function settle(f,{limit=1000}={}){
  for(let i=0;i<limit;i++){
    await Promise.resolve();
    if(f.h.busy){await new Promise(r=>setImmediate(r));continue;}
    if(!f.c.jobs.size)return;
    await f.c.runNext();
  }
  throw Error('host did not settle');
}
async function runOne(f){assert.ok(await f.c.runNext(),'scheduled host pump exists');while(f.h.busy)await new Promise(r=>setImmediate(r));}
const msg=(id,type,payload={})=>({protocol:1,id,type,payload});
async function initialize(f){f.h.receive(msg(1,'init',{seed:1}));await settle(f);assert.equal(f.h.ready,true);}
const reply=(f,id)=>f.out.find(x=>x.replyTo===id);

test('commands preserve FIFO admission and apply exactly once',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'command',{name:'a'}));f.h.receive(msg(3,'command',{name:'b'}));await settle(f);
  assert.deepEqual(f.model.log.filter(x=>x[0]==='command'),[['command','a'],['command','b']]);
  assert.equal(reply(f,2).value.day,0);assert.equal(reply(f,3).value.day,0);
});

test('init forwards worker-owned save resume options to the model',async()=>{
  const f=hostFixture();f.h.receive(msg(1,'init',{seed:1,resume:'F1saved-state'}));await settle(f);
  assert.equal(f.model.log.find(x=>x[0]==='init')[1].resume,'F1saved-state');
});

test('watch publishes each exact thirty-day boundary across sixty ticks when each view is acknowledged',async()=>{
  let nextId=3;const f=hostFixture({},{onSend:(packet,receive)=>{if(packet.type==='view')receive(msg(++nextId,'view-ack',{sequence:packet.sequence}));}});await initialize(f);
  f.h.receive(msg(2,'watch',{enabled:true,everyDays:30}));await settle(f);f.h.receive(msg(3,'advance',{days:60}));await settle(f);
  const views=f.out.filter(x=>x.type==='view');assert.deepEqual(views.map(x=>x.value.day),[30,60],JSON.stringify({day:f.model.d,out:f.out}));assert.deepEqual(views.map(x=>x.sequence),[1,2]);assert.equal(f.model.d,60);
});

test('unacknowledged views stop publication and exact acknowledgement coalesces to latest day',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'watch',{enabled:true,everyDays:30}));await settle(f);
  f.h.receive(msg(3,'advance',{days:60}));await settle(f);const views=f.out.filter(x=>x.type==='view');
  assert.deepEqual(views.map(x=>x.value.day),[30]);assert.equal(f.model.d,60);
  f.h.receive(msg(4,'view-ack',{sequence:99}));await settle(f);assert.match(reply(f,4).error,/acknowledgement differs/);assert.equal(f.out.filter(x=>x.type==='view').length,1);
  f.h.receive(msg(5,'view-ack',{sequence:views[0].sequence}));await settle(f);
  const updated=f.out.filter(x=>x.type==='view');assert.deepEqual(updated.map(x=>x.value.day),[30,60]);assert.deepEqual(updated.map(x=>x.sequence),[1,2]);
});

test('command and pause controls keep immediate request replies while watch is enabled',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'watch',{enabled:true,everyDays:30}));await settle(f);
  f.h.receive(msg(3,'command',{name:'choice'}));f.h.receive(msg(4,'speed',{index:1}));f.h.receive(msg(5,'pause'));await settle(f);
  assert.deepEqual(JSON.parse(JSON.stringify(reply(f,3).value)),{day:0});assert.equal(reply(f,4).value.day,0);assert.equal(reply(f,5).value.day,0);
  assert.equal(f.out.filter(x=>x.type==='view').length,0);
});

test('changing publication cadence preserves the view awaiting acknowledgement',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'watch',{kind:'landscape',everyDays:1}));await settle(f);
  f.h.receive(msg(3,'advance',{days:2}));await settle(f);const view=f.out.find(x=>x.type==='view');assert.equal(view.value.day,1);
  f.h.receive(msg(4,'watch',{kind:'landscape',everyDays:30}));await settle(f);
  assert.equal(f.h.publication.inflight,view.sequence);
  f.h.receive(msg(5,'view-ack',{sequence:view.sequence}));await settle(f);
  assert.equal(reply(f,5).error,undefined);assert.equal(f.h.publication.inflight,null);
  f.h.receive(msg(6,'advance',{days:30}));await settle(f);
  assert.deepEqual(f.out.filter(x=>x.type==='view').map(x=>x.value.day),[1,32]);
});

test('asynchronous daily work completes before the next command or save barrier',async()=>{
  let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const f=hostFixture({async tick(m){entered();await gate;m.d++;m.log.push(['tick',m.d]);return true;}},{budget:0});await initialize(f);
  f.h.receive(msg(2,'advance',{days:1}));await runOne(f);await f.c.runNext();await started;
  f.h.receive(msg(3,'command',{name:'after-gpu'}));f.h.receive(msg(4,'save',{name:'after-gpu'}));
  assert.equal(f.model.d,0);release();await settle(f);
  assert.deepEqual(f.model.log.filter(x=>['tick','command','save'].includes(x[0])),[['tick',1],['command','after-gpu'],['save',1,'after-gpu']]);
});

test('queued commands enter between whole ticks during bounded advance',async()=>{
  let host,admitted=false;const f=hostFixture({tick(m){m.d++;m.log.push(['tick',m.d]);f.c.setNow(f.c.now()+8);if(m.d===1&&!admitted){admitted=true;host.receive(msg(3,'command',{name:'between'}));}return true;}},{budget:1});host=f.h;await initialize(f);
  f.h.receive(msg(2,'advance',{days:3}));await settle(f);
  const events=f.model.log.filter(x=>x[0]==='tick'||x[0]==='command').map(x=>x.join(':'));
  assert.deepEqual(events,['tick:1','command:between','tick:2','tick:3']);
  assert.deepEqual(JSON.parse(JSON.stringify(reply(f,2).value)),{day:3,complete:true});assert.equal(reply(f,3).value.day,1);
});

test('bounded advance stops at its target even when a petition restores paced or Reel speed',async()=>{
  for(const index of [1,5]){
    const f=hostFixture({tick(m){m.d++;f.c.setNow(f.c.now()+8);if(m.d===1)m.speed(index);return true;}},{budget:1});await initialize(f);
    f.h.receive(msg(2,'advance',{days:3}));await settle(f);
    assert.equal(f.model.d,3);assert.equal(f.model.idx,0);assert.equal(f.h.accum,0);assert.equal(f.c.jobs.size,0);
    assert.deepEqual(JSON.parse(JSON.stringify(reply(f,2).value)),{day:3,complete:true});
    f.c.setNow(f.c.now()+20000);f.h.wake(0);await settle(f);assert.equal(f.model.d,3,'no later wall time earns an extra day');
    f.h.receive(msg(3,'advance',{days:2}));await settle(f);assert.equal(f.model.d,5);
  }
});

test('control arriving during storage wait prevents the waiting tick',async()=>{
  let host,release,markWait;const waitStarted=new Promise(r=>markWait=r),gate=new Promise(r=>release=r),f=hostFixture({wait:async()=>{markWait();await gate;}});host=f.h;await initialize(f);
  f.h.receive(msg(2,'speed',{index:1}));await f.c.runNext();while(f.h.busy)await new Promise(r=>setImmediate(r));f.c.setNow(2000);f.h.wake(0);await f.c.runNext();await waitStarted;
  f.h.receive(msg(3,'pause'));release();await settle(f);
  assert.equal(f.model.d,0);assert.equal(reply(f,3).value.day,0);assert.equal(f.model.r,0);
});

test('pause aborts bounded advance with partial result and prevents later days',async()=>{
  let host,queued=false;const f=hostFixture({tick(m){m.d++;f.c.setNow(f.c.now()+8);if(!queued){queued=true;host.receive(msg(3,'pause'));}return true;}},{budget:1});host=f.h;await initialize(f);
  f.h.receive(msg(2,'advance',{days:5}));await settle(f);
  assert.deepEqual(JSON.parse(JSON.stringify(reply(f,2).value)),{day:1,complete:false});assert.equal(reply(f,3).value.day,1);assert.equal(f.model.d,1);
});

test('speed indices are validated and invalid speeds do not mutate rate',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'speed',{index:7}));await settle(f);
  assert.equal(reply(f,2).error,'Invalid simulation speed');assert.equal(f.model.log.some(x=>x[0]==='speed'&&x[1]===7),false);assert.equal(f.model.r,0);
  f.h.receive(msg(3,'speed',{index:6}));f.h.receive(msg(4,'pause'));await settle(f);assert.equal(f.model.r,0);assert.equal(reply(f,3).value.day,0);assert.ok(f.model.log.some(x=>x[0]==='speed'&&x[1]===6));
});

test('a host that is behind its speed goes straight on to the next day; one that has caught up waits for it to fall due',async()=>{
  const behind=hostFixture({},{budget:1});await initialize(behind);
  behind.h.receive(msg(2,'speed',{index:4}));await runOne(behind);behind.c.setNow(behind.c.now()+2000);behind.h.wake(0);await runOne(behind);
  assert.deepEqual([...behind.c.jobs.values()].map(j=>j.at-behind.c.now()),[0],'days are owed: no pause between them');
  const ahead=hostFixture({},{budget:1});await initialize(ahead);
  ahead.h.receive(msg(2,'speed',{index:4}));await runOne(ahead);ahead.c.setNow(ahead.c.now()+40);ahead.h.wake(0);await runOne(ahead);
  assert.deepEqual([...ahead.c.jobs.values()].map(j=>j.at-ahead.c.now()),[8],'caught up: wait for the next day');
});

test('Reel advances at a fixed clock without accumulating paced time',async()=>{
  const f=hostFixture({tick(m){m.d++;return true;}}, {budget:0});await initialize(f);f.h.receive(msg(2,'speed',{index:5}));await runOne(f);
  assert.equal(f.model.d,0); // the speed command itself does not depend on elapsed wall time
  for(let i=0;i<3;i++)await runOne(f);
  assert.equal(f.c.now(),0);assert.equal(f.model.d,3);assert.equal(f.h.accum,0);
  f.h.receive(msg(3,'pause'));await settle(f);assert.equal(reply(f,3).value.day,3);
});

test('pause queued from inside a Reel tick bounds progress',async()=>{
  let host,requested=false;const f=hostFixture({tick(m){m.d++;if(!requested){requested=true;host.receive(msg(3,'pause'));}return true;}},{budget:0});host=f.h;await initialize(f);
  f.h.receive(msg(2,'speed',{index:5}));await settle(f);
  assert.equal(f.model.d,1);assert.equal(reply(f,3).value.day,1);assert.equal(f.model.r,0);assert.equal(f.c.jobs.size,0);
});

test('ordinary thirty-day speed remains wall-clock paced',async()=>{
  const f=hostFixture({}, {budget:0});await initialize(f);f.h.receive(msg(2,'speed',{index:4}));await runOne(f);
  await runOne(f);assert.equal(f.model.d,0); // zero elapsed time cannot earn a day
  f.c.setNow(34);await runOne(f);assert.equal(f.model.d,1);
  f.h.receive(msg(3,'pause'));await settle(f);assert.equal(reply(f,3).value.day,1);
});

test('leaving Reel does not carry elapsed-time backlog into ordinary speed',async()=>{
  const f=hostFixture({tick(m){m.d++;return true;}},{budget:0});await initialize(f);f.h.receive(msg(2,'speed',{index:5}));await runOne(f);
  for(let i=0;i<3;i++)await runOne(f);assert.equal(f.model.d,3);assert.equal(f.h.accum,0);
  f.h.receive(msg(3,'speed',{index:4}));await runOne(f);assert.equal(f.h.accum,0);
  await runOne(f);assert.equal(f.model.d,3); // the Reel ticks did not bank 30-days/sec time
  f.h.receive(msg(4,'pause'));await settle(f);assert.equal(reply(f,4).value.day,3);
});

test('a new pace or a pause keeps the part-day already run, and every reading carries it to its instant',async()=>{
  const f=hostFixture({view(m,kind,payload){return{day:m.d,kind,fraction:payload?.fraction};},clock(m){return{day:m.d};}},{budget:0});await initialize(f);
  f.h.receive(msg(2,'watch',{everyDays:1}));await settle(f);
  f.h.receive(msg(3,'speed',{index:1}));await runOne(f);f.c.setNow(f.c.now()+1000); // half a day earned at Normal, not yet banked
  assert.equal(f.h.part(),0.5);
  f.h.receive(msg(4,'speed',{index:2}));await runOne(f);assert.equal(f.h.accum,0.5,'a new pace keeps it');assert.equal(f.model.d,0);
  f.c.setNow(f.c.now()+100);f.h.receive(msg(5,'pause'));await runOne(f);assert.ok(Math.abs(f.h.accum-0.7)<1e-9,'so does a pause');
  assert.deepEqual([reply(f,4).value.reading.day,reply(f,4).value.reading.frac],[0,0.5],'the reply to a new pace reads the calendar at its instant');assert.ok(Math.abs(reply(f,5).value.reading.frac-0.7)<1e-9,'and so does the reply to a pause');
  f.c.setNow(f.c.now()+5000);f.h.receive(msg(6,'view',{kind:'actors'}));await runOne(f);assert.ok(Math.abs(reply(f,6).value.fraction-0.7)<1e-9,'paused, the reading stands still');
  f.h.receive(msg(7,'speed',{index:1}));await runOne(f);f.c.setNow(f.c.now()+200);f.h.receive(msg(8,'view',{kind:'actors'}));await runOne(f);
  assert.ok(Math.abs(reply(f,8).value.fraction-0.8)<1e-9,'a reading counts the time since the pump last banked it');
  f.c.setNow(f.c.now()+400);await runOne(f);assert.equal(f.model.d,1,'the resumed day ends 0.6 s after the resume, not 2 s');
  const clock=f.out.filter(x=>x.type==='clock').at(-1);assert.equal(clock.value.day,1);assert.ok(Math.abs(clock.value.frac-0.005)<1e-9,'the clock message counts the tick it waited on');
  f.h.receive(msg(9,'speed',{index:5}));await runOne(f);f.h.receive(msg(10,'speed',{index:1}));await runOne(f);assert.equal(f.h.accum,0,'Reel banks no part-day');
  f.h.receive(msg(11,'pause'));await settle(f);
});

test('init, command and tick faults stop progress while reads remain available',async t=>{
  await t.test('init failure is reported and host remains stopped',async()=>{const f=hostFixture({init(){throw Error('init failed');}});f.h.receive(msg(1,'init'));await settle(f);assert.equal(f.h.fault.message,'init failed');assert.match(reply(f,1).error,/init failed/);assert.equal(f.model.r,0);});
  await t.test('command failure',async()=>{const f=hostFixture({command(){throw Error('journal failed');}});await initialize(f);f.h.receive(msg(2,'command',{name:'break'}));await settle(f);assert.equal(f.h.fault.message,'journal failed');assert.equal(f.model.r,0);assert.match(reply(f,2).error,/journal failed/);f.h.receive(msg(3,'view'));await settle(f);assert.equal(reply(f,3).value.day,0);});
  await t.test('tick failure',async()=>{const f=hostFixture({tick(){throw Error('tick failed');}});await initialize(f);f.h.receive(msg(2,'advance',{days:2}));await settle(f);assert.equal(f.h.fault.message,'tick failed');assert.equal(f.model.r,0);assert.match(reply(f,2).error,/tick failed/);f.h.receive(msg(3,'view'));await settle(f);assert.equal(reply(f,3).value.day,0);});
});

test('save request is a FIFO day barrier',async()=>{
  let host,saved=false;const f=hostFixture({tick(m){m.log.push(['tick',m.d+1]);m.d++;f.c.setNow(f.c.now()+8);if(m.d===1&&!saved){saved=true;host.receive(msg(3,'save',{name:'barrier'}));}return true;}},{budget:1});host=f.h;await initialize(f);f.h.receive(msg(2,'advance',{days:2}));await settle(f);
  assert.deepEqual(f.model.log.filter(x=>['tick','save'].includes(x[0])),[['tick',1],['save',1,'barrier'],['tick',2]]);
  assert.equal(reply(f,3).value.day,1);
});

test('bounded advance limits, unknown requests, duplicate IDs and host queue cap',async()=>{
  const f=hostFixture();await initialize(f);f.h.receive(msg(2,'advance',{days:360001}));await settle(f);assert.match(reply(f,2).error,/Invalid day count/);
  f.h.receive(msg(3,'mystery'));await settle(f);assert.match(reply(f,3).error,/Unknown simulation request/);
  f.h.receive(msg(3,'view'));assert.match(f.out.at(-1).error,/sequence differs/);
  for(let id=4;id<69;id++)f.h.receive(msg(id,'view'));
  assert.equal(f.h.queue.length,64);assert.match(reply(f,68).error,/queue is full/);await settle(f);
});

test('client correlates replies, rejects pending work on close and blocks later requests',async()=>{
  const state={sent:[],terminated:false},context={state,worker:{postMessage:m=>state.sent.push(m),terminate(){state.terminated=true;}},Map,Error,Promise};
  const c=vm.runInNewContext(source+';new Client(worker)',context),sent=state.sent;
  const a=c.request('view',{kind:'a'}),b=c.request('view',{kind:'b'});const [ma,mb]=sent;
  context.worker.onmessage({data:{protocol:1,replyTo:mb.id,value:'B'}});
  context.worker.onmessage({data:{protocol:1,replyTo:ma.id,value:'A'}});
  assert.deepEqual(await Promise.all([a,b]),['A','B']);
  const pending=c.request('view');const closing=c.close();const closeMsg=sent.at(-1);
  context.worker.onmessage({data:{protocol:1,replyTo:closeMsg.id,value:{day:0}}});
  await closing;await assert.rejects(pending,/Simulation worker closed/);await assert.rejects(c.request('view'),/Simulation worker is closed/);
});

test('client applies a pushed view before acknowledging it, and callback failure leaves it unacknowledged',async()=>{
  const state={sent:[],terminated:false},context={state,worker:{postMessage:m=>state.sent.push(m),terminate(){state.terminated=true;}},Map,Error,Promise};
  const c=vm.runInNewContext(source+';new Client(worker)',context),events=[];c.onview=value=>events.push(['apply',value.day]);
  context.worker.onmessage({data:{protocol:1,type:'view',sequence:7,value:{day:30}}});await new Promise(r=>setImmediate(r));
  assert.deepEqual(events,[['apply',30]]);assert.deepEqual(state.sent.map(x=>[x.type,x.payload.sequence]),[['view-ack',7]]);
  state.sent.length=0;const errors=[];c.onfault=error=>errors.push(error.message);c.onview=()=>{throw Error('render apply failed');};
  context.worker.onmessage({data:{protocol:1,type:'view',sequence:8,value:{day:60}}});await new Promise(r=>setImmediate(r));
  assert.deepEqual(state.sent,[]);assert.deepEqual(errors,['render apply failed']);
});

// The worker's own speed changes (a petition with pause-on-petition, the campaign's end, a journal fault) and the date.
const speedWatch={urgent:m=>m.idx!==m.shown,view(m,kind){m.shown=m.idx;return{day:m.d,kind,speed:m.idx};}};
test('a pause the worker sets itself is published at once at the thirty-day Reel cadence',async()=>{
  const f=hostFixture({...speedWatch,tick(m){m.d++;if(m.d===7)m.speed(0);return true;}},{budget:0});await initialize(f);
  f.h.receive(msg(2,'watch',{kind:'landscape',everyDays:30}));f.h.receive(msg(3,'speed',{index:5}));f.h.receive(msg(4,'view',{kind:'landscape'}));await settle(f);
  const views=f.out.filter(x=>x.type==='view');
  assert.deepEqual(views.map(x=>[x.value.day,x.value.speed]),[[7,0]],'the paused day is shown, not day 30');assert.equal(f.model.d,7,'and no day runs after it');
});
test('an urgent publication waits for the view in flight, then goes out before the cadence',async()=>{
  const f=hostFixture({...speedWatch,tick(m){m.d++;if(m.d===33)m.speed(0);return true;}},{budget:0});await initialize(f);
  f.h.receive(msg(2,'watch',{kind:'landscape',everyDays:30}));f.h.receive(msg(3,'speed',{index:5}));f.h.receive(msg(4,'view',{kind:'landscape'}));await settle(f);
  const first=f.out.filter(x=>x.type==='view');assert.deepEqual(first.map(x=>x.value.day),[30],'day 30 is in flight, unacknowledged');assert.equal(f.model.d,33);
  f.h.receive(msg(5,'view-ack',{sequence:first[0].sequence}));await settle(f);
  assert.deepEqual(f.out.filter(x=>x.type==='view').map(x=>[x.value.day,x.value.speed]),[[30,5],[33,0]],'the pause follows the acknowledgement, thirty days early');
  f.h.receive(msg(6,'view-ack',{sequence:f.out.filter(x=>x.type==='view')[1].sequence}));await settle(f);
  assert.equal(f.out.filter(x=>x.type==='view').length,2,'nothing urgent remains');
});
test('every simulated day sends a small clock message, at every speed, with its fraction and speed',async()=>{
  let nextId=3;const f=hostFixture({...speedWatch,clock:m=>({day:m.d,speed:m.idx,treasury:m.d*10}),tick(m){m.d++;f.c.setNow(f.c.now()+25);return true;}},
    {budget:0,onSend:(packet,receive)=>{if(packet.type==='view')receive(msg(++nextId,'view-ack',{sequence:packet.sequence}));}});await initialize(f);
  f.h.receive(msg(2,'watch',{kind:'landscape',everyDays:30}));await settle(f);f.model.shown=0;f.h.receive(msg(3,'advance',{days:60}));await settle(f);
  const clocks=f.out.filter(x=>x.type==='clock'),views=f.out.filter(x=>x.type==='view');
  assert.deepEqual(views.map(x=>x.value.day),[30,60]);assert.deepEqual(clocks.map(c=>c.value.day),Array.from({length:60},(_,i)=>i+1),'one per day, packet days included');
  assert.ok(clocks.every(c=>c.value.frac===0&&c.value.speed===0&&c.value.treasury===c.value.day*10));
  const paced=hostFixture({clock:m=>({day:m.d,speed:m.idx})},{budget:0});await initialize(paced);paced.h.receive(msg(2,'watch',{kind:'landscape',everyDays:1}));await runOne(paced);
  paced.h.receive(msg(3,'speed',{index:4}));await runOne(paced);paced.c.setNow(50);await runOne(paced);const c=paced.out.filter(x=>x.type==='clock');
  assert.equal(c.length,1);assert.equal(c[0].value.speed,4);assert.ok(c[0].value.frac>0&&c[0].value.frac<1,'the part of the next day already run: '+c[0].value.frac);
  paced.h.receive(msg(4,'pause'));await settle(paced);
  const quiet=hostFixture({clock:m=>({day:m.d})},{budget:0});await initialize(quiet);quiet.h.receive(msg(2,'advance',{days:5}));await settle(quiet);
  assert.equal(quiet.out.filter(x=>x.type==='clock').length,0,'no watcher, no clock');
});
test('the client lays a clock message out in wire order behind a view still being installed',async()=>{
  const state={sent:[]},context={state,worker:{postMessage:m=>state.sent.push(m),terminate(){}},Map,Error,Promise};
  const c=vm.runInNewContext(source+';new Client(worker)',context),order=[];let release;const gate=new Promise(r=>release=r);
  c.onview=async v=>{order.push('view:'+v.day);await gate;order.push('view-done');};c.onclock=v=>order.push('clock:'+v.day);
  context.worker.onmessage({data:{protocol:1,type:'view',sequence:1,value:{day:30}}});context.worker.onmessage({data:{protocol:1,type:'clock',value:{day:34}}});
  await new Promise(r=>setImmediate(r));assert.deepEqual(order,['view:30'],'the clock does not overtake the packet');
  release();await new Promise(r=>setImmediate(r));assert.deepEqual(order,['view:30','view-done','clock:34']);
  assert.deepEqual(state.sent.filter(m=>m.type==='view-ack').map(m=>m.payload.sequence),[1],'clocks are not acknowledged');
});
