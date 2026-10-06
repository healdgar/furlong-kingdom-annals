// The screen's own clock in worker mode (presStep): it runs on between the worker's readings at the chosen pace, eases
// toward each, never runs back, freezes on pause, and never runs far past the last day reported. Walkers and flocks
// carry on between replies (trackAt over the steps the worker keeps, workerWalkOn; reconcileFlocks).
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

test('a walker between the steps the worker kept: in between them, at the first before it, at the last past it',()=>{
  const c=vm.createContext({Math,Number});vm.runInContext(block.replace(/const SCREEN_CLOCK[\s\S]*?(?=\/\/ Where a townsman)/,''),c);
  const T=Float64Array.from([10,10.5,11]),R=Float32Array.from([0,0,0,0, 4,0,1,3, 4,8,2,1]);
  const at=v=>{const w=c.trackAt(T,R,v);return [w.x,w.z,w.yaw,w.out,w.walking];};
  assert.deepEqual(at(9),[0,0,0,false,false],'before the first step');
  assert.deepEqual(at(10.2).map(v=>typeof v==='number'?+v.toFixed(9):v),[1.6,0,1,false,false],'between: the way he faces is the next step\'s; indoors or out as the nearer step');
  assert.deepEqual(at(10.3).map(v=>typeof v==='number'?+v.toFixed(9):v),[2.4,0,1,true,true]);
  assert.deepEqual(at(10.5),[4,0,1,true,true],'on a step');
  assert.deepEqual(at(10.75),[4,4,2,true,false]);
  assert.deepEqual(at(12),[4,8,2,true,false],'past the last, where it left him');
  assert.deepEqual([c.trackAt(T,Float32Array.from([7,8,9,1]),10.7)].map(w=>[w.x,w.z,w.out]),[[7,8,true]],'one place for one who stands');
  assert.equal(c.trackAt(T,null,10),null);
});

// The worker's walk of a little town against the main-thread screen's, frame by frame: the canonical stepWalker and
// planWalk on a grid of streets, the worker's walkOn/track and the screen's trackAt.
const WALK_MOST=+source.match(/const WALK_TRACK=\{[^}]*most:(\d+)/)[1];
const walkSource=slice('function nearestNode(','function rockNear(')+slice('function workerRenderFinite(','function workerRenderCitizens(')+slice('// Where a townsman','// A new plan of the herds');
function town(speed=1){
  const c=vm.createContext({Math,Number,Object,Array,Float32Array,Float64Array,Map,SPEEDS,LIFE:6,speedIdx:speed,
    dist2d:(a,b,x,z)=>Math.hypot(a-x,b-z),clamp:(v,a,b)=>v<a?a:(v>b?b:v),ageYrs:()=>30,detailHead:()=>({w:0}),foodYr:()=>1,trait:()=>0,GB:0,GD:1,
    folkName:()=>'Ada',STREET_NAME:{},ARCH:{bakery:[0,0,0,0,'bakery'],shop:[0,0,0,0,'shop']},clock:{day:100}});
  vm.runInContext(walkSource+'\nvar day=()=>clock.day;',c);c.DAYSEC=vm.runInContext('DAYSEC',c);
  const N=[],adj=[],st={name:'High Street'};for(let i=0;i<6;i++)for(let j=0;j<6;j++){N.push({x:i*40,z:j*40,st});adj.push([]);}
  for(let i=0;i<6;i++)for(let j=0;j<6;j++){const k=i*6+j;if(i<5){adj[k].push([k+6,40]);adj[k+6].push([k,40]);}if(j<5){adj[k].push([k+1,40]);adj[k+1].push([k,40]);}}
  const g={N,adj},s={_weds:[]},mk={x:84,z:78};
  const folk=(id,o)=>({s,p:{id,sx:id%2?'m':'f',si:0},g,workIn:false,what:'at work',fw:null,chores:false,door:null,shops:null,mk,church:null,tavern:null,pace:2.3,sc:1,
    ry:0,t:0,state:'home',until:0,route:null,ri:0,out:false,walking:false,goal:'home',doing:'at home',...o,x:o.home.x,z:o.home.z});
  const home2={x:42,z:118};
  const people=[folk(3,{home:{x:3,z:2},work:{x:162,z:158}}), // to work, to market at midday, home at dusk
    folk(7,{home:home2,work:home2,workIn:true,chores:true,shops:[{x:122,z:41,arch:'bakery'},{x:158,z:3,arch:'shop'}]}), // the round of errands
    folk(10,{home:{x:160,z:40},work:{x:181,z:150},fw:{A:{x:181,z:150},B:{x:215,z:150},flip:false}}), // up the furrow and back
    folk(11,{home:{x:198,z:202},work:{x:190,z:190},fw:{A:{x:190,z:190},B:{x:202,z:190},flip:false,run:true}})]; // a child's run
  return {c,people,clone:()=>people.map(w=>({...w,fw:w.fw&&{...w.fw},route:w.route&&w.route.slice()}))};
}
// The main-thread screen: each frame walks each townsman by the frame's share of the calendar, at the frame's hour.
function reference(c,people,t0,h,frames){
  const out=[];let t=t0;for(let k=0;k<frames;k++){t+=h;const D=Math.floor(t);for(const w of people)vm.runInContext('stepWalker',c)(w,h*c.DAYSEC,t-D,D);out.push({t,at:people.map(w=>({x:w.x,z:w.z,out:w.out,goal:w.goal}))});}
  return out;
}
// The worker build: the worker walks its own copy on each request; the screen draws each frame from the latest reply.
function workerBuild(c,people,t0,frames,{every=()=>9,late=()=>0,lead=()=>0}={}){
  const rate=SPEEDS[c.speedIdx],h=rate/60,entry={people,day:t0,times:[t0]};for(const w of people)c.workerWalkSample(w);
  const reply=now=>{c.clock.day=Math.floor(now);c.workerWalkOn(entry,now,now-Math.floor(now));return{times:Float64Array.from(entry.times),day:entry.day,tracks:people.map(w=>c.workerWalkTrack(w))};};
  let packet=reply(t0),pending=null,next=every(),t=t0;const out=[],switches=[];
  for(let k=0;k<frames;k++){t+=h;
    if(pending){const v=t+lead(k),was=packet.tracks.map(R=>c.trackAt(packet.times,R,v));packet=pending;pending=null;switches.push(was.map((w,i)=>[w,c.trackAt(packet.times,packet.tracks[i],v)]));}
    if(--next<=0){pending=reply(t-late(k)*h);next=every();} // the reply comes the next frame
    const v=t+lead(k);out.push({t,v,at:packet.tracks.map(R=>c.trackAt(packet.times,R,v)),ahead:packet.times.at(-1)-t});}
  return{out,switches,entry};
}

test('the worker\'s walk is the main-thread screen\'s, frame for frame, over a day and its turning, across replies',()=>{
  for(const speed of [1,2,3]){
    const {c,clone}=town(speed),h=SPEEDS[speed]/60,frames=Math.round((speed===1?1.7:speed===2?2.6:4.2)/h),t0=100.2;
    const ref=reference(c,clone(),t0,h,frames),{out,switches}=workerBuild(c,clone(),t0,frames);
    let moving=0,legs=0;
    for(let k=0;k<frames;k++){const R=ref[k].at,S=out[k].at;assert.equal(out[k].t,ref[k].t);
      for(let i=0;i<R.length;i++){assert.equal(S[i].out,R[i].out,`speed ${speed} frame ${k} walker ${i}: indoors or out as the screen had him`);
        if(R[i].out)assert.ok(Math.hypot(S[i].x-R[i].x,S[i].z-R[i].z)<1e-3,`speed ${speed} frame ${k} walker ${i}: ${S[i].x},${S[i].z} against ${R[i].x},${R[i].z}`);
        if(k&&R[i].goal!==ref[k-1].at[i].goal)legs++;}
      if(k&&R.some((w,i)=>w.out&&Math.hypot(w.x-ref[k-1].at[i].x,w.z-ref[k-1].at[i].z)>0.01))moving++;
      assert.ok(out[k].ahead>=0.2*SPEEDS[speed]-1e-9,`speed ${speed} frame ${k}: the reply in hand runs more than another reply past the screen (${out[k].ahead/SPEEDS[speed]} s)`);}
    assert.ok(legs>=8&&moving>frames*0.3,`speed ${speed}: a day's walking to compare (${legs} legs, ${moving} of ${frames} frames moving)`);
    for(const sw of switches)for(const [a,b]of sw)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-3&&a.out===b.out,'a new reply takes up where the last left off');
  }
});

test('late replies and a screen a little ahead or behind: smooth, never back, never a stride longer than a frame\'s walk',()=>{
  const speed=1,{c,clone}=town(speed),h=SPEEDS[speed]/60,frames=Math.round(1.7/h),t0=100.2,rnd=(k,m)=>((k*7919+m*104729)%1000)/1000;
  const ref=reference(c,clone(),t0,h,frames),{out}=workerBuild(c,clone(),t0,frames,{every:(()=>{let n=0;return()=>6+Math.floor(rnd(n++,1)*8);})(),late:k=>rnd(k,2)*3,lead:k=>(rnd(k,3)-0.5)*0.8*h});
  const walk=2.3*h*c.DAYSEC;let still=0,moved=0;
  for(let k=1;k<frames;k++)for(let i=0;i<out[k].at.length;i++){const a=out[k-1].at[i],b=out[k].at[i],r0=ref[k-1].at[i],r1=ref[k].at[i];if(!a.out||!b.out||!r0.out||!r1.out)continue;
    const d=Math.hypot(b.x-a.x,b.z-a.z);assert.ok(d<=walk*1.8+1e-6,`frame ${k} walker ${i}: a stride of ${d} m`);
    // between the two frames of the screen's own walk on either side of it
    const lo=out[k].v<ref[k].t?ref[k-1]:ref[k],hi=out[k].v<ref[k].t?ref[k]:ref[Math.min(frames-1,k+1)],f=(out[k].v-lo.t)/(hi.t-lo.t||1),L=lo.at[i],H=hi.at[i];
    if(L.out&&H.out)assert.ok(Math.hypot(b.x-(L.x+(H.x-L.x)*f),b.z-(L.z+(H.z-L.z)*f))<1e-3,`frame ${k} walker ${i} on the screen's own path`);
    if(Math.hypot(r1.x-r0.x,r1.z-r0.z)>0.01){moved++;if(d<1e-4)still++;}}
  assert.ok(moved>100&&still/moved<0.05,`moves whenever the screen's walker moves (${still} still of ${moved})`);
});

test('at life pace the walk keeps to the screen\'s clock, ahead of the reading as it may be after a change of pace',()=>{
  const speed=6,h=SPEEDS[speed]/60,t0=100.3,frames=180;
  for(const ahead of [30,2160]){ // half a second of pace ahead, as a reply's latency leaves it at worst; and as Fast left it, half a minute
    const {c,clone}=town(speed),ref=reference(c,clone(),t0,h,frames+ahead+1),people=clone(),entry={people,day:t0,times:[t0]};for(const w of people)c.workerWalkSample(w);
    let t=t0,packet=null;const drawn=[];
    const reply=(now,view)=>{c.clock.day=Math.floor(now);c.workerWalkOn(entry,now,now-Math.floor(now),view);return{times:Float64Array.from(entry.times),tracks:people.map(w=>c.workerWalkTrack(w))};};
    let v=t0;for(let i=0;i<ahead;i++)v+=h; // the screen's clock, on the same frames as the worker's
    for(let k=0;k<frames;k++){if(k%9===0)packet=reply(t,v);t+=h;v+=h;drawn.push(packet.tracks.map(R=>c.trackAt(packet.times,R,v)));}
    let still=0,moving=0;
    for(let k=1;k<frames;k++)for(let i=0;i<people.length;i++){const a=drawn[k-1][i],b=drawn[k][i];if(!a.out||!b.out||!b.walking)continue;moving++;const d=Math.hypot(b.x-a.x,b.z-a.z);if(d<1e-4)still++;
      assert.ok(d<=3*h*c.DAYSEC+1e-6,`${ahead} frames ahead, frame ${k} walker ${i}: a stride of ${d} m`);}
    assert.ok(moving>frames*2&&still===0,`${ahead} frames ahead: walks every frame between replies (${still} still of ${moving})`);
    if(ahead<WALK_MOST)for(let k=0;k<frames;k++)for(let i=0;i<people.length;i++){const R=ref[k+ahead].at[i],S=drawn[k][i];assert.equal(S.out,R.out);
      if(R.out)assert.ok(Math.hypot(S.x-R.x,S.z-R.z)<1e-3,`frame ${k} walker ${i}: where the screen's own walk has him at its own clock`);}
  }
});

test('the walk kept: ahead of the reading at every pace, one stride when paused or too fast to follow, afresh after a slower pace',()=>{
  for(const speed of [1,2,3,6]){const {c,clone}=town(speed),people=clone(),rate=SPEEDS[speed],entry={people,day:100.3,times:[100.3]};for(const w of people)c.workerWalkSample(w);
    c.workerWalkOn(entry,100.3,0.3);const T=entry.times;assert.ok(T.at(-1)>=100.3+0.4*rate-1e-9&&T.length>=25&&T.length<=26,`speed ${speed}: ${T.length} steps`);
    for(let i=1;i<T.length;i++)assert.ok(Math.abs(T[i]-T[i-1]-rate/60)<1e-12,'a frame of the pace apart');
    for(const w of people)assert.equal(w._tr.length,4*T.length,'a place for every step');
    c.workerWalkOn(entry,100.3+0.15*rate,0.3);assert.ok(entry.times[0]<=100.3+0.15*rate-0.15*rate+1e-12,'steps kept behind the reading for a screen a little late');}
  const {c,clone}=town(1),people=clone(),entry={people,day:100.3,times:[100.3]};for(const w of people)c.workerWalkSample(w);
  c.speedIdx=3;c.workerWalkOn(entry,100.3,0.3);assert.ok(entry.day>103);
  c.speedIdx=1;c.workerWalkOn(entry,100.31,0.31);assert.ok(Math.abs(entry.times[0]-100.31)<1e-12&&entry.day>=100.51-1e-9,'walked days ahead at the faster pace: they go on from there at the slower');
  {const {c,clone}=town(2),people=clone(),entry={people,day:100.3,times:[100.3]};for(const w of people)c.workerWalkSample(w);c.workerWalkOn(entry,100.3,0.3);const head=entry.day,n=entry.times.length;
    c.speedIdx=1;c.workerWalkOn(entry,100.31,0.31);assert.deepEqual([entry.day,entry.times.length],[head,n],'from Fast to Normal: the steps already taken are walked out, without a jump');}
  c.speedIdx=0;const day=entry.day,n=entry.times.length;c.workerWalkOn(entry,day-0.1,0.1);assert.equal(entry.day,day);assert.equal(entry.times.length,n,'paused, nothing moves');
  c.workerWalkOn(entry,day+5.5,0.5);assert.deepEqual([entry.day,entry.times.length],[day+5.5,1],'a bounded advance: one stride');
  c.speedIdx=4;c.workerWalkOn(entry,day+6.25,0.25);assert.deepEqual([entry.day,entry.times.length],[day+6.25,1],'too fast to follow: one stride a reply');
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
