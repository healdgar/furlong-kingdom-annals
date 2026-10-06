// A door that no street can reach (a quay, mill or church across an uncrossable river) used to cost twelve full
// searches of three boxes each. The planners now flood the lattice once, after the first full failure, and skip
// targets that are blocked straight on and outside the flood. These tests load the real routing code and hold the
// outcome exactly equal to the plain planner (a frozen copy of the original) on hand-built and random worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const hit=source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'));assert.ok(hit,`missing ${name}`);return hit[0];};
const REAL=['armyRaftAt','armyBridgeAt','armyObstacle','armySegmentClear','armyDetour','armyLandPath','armyReach','armyReaches','serviceRoadPlan'];
// serviceRoadPlan exactly as released before the flood: every target gets its full search.
const LEGACY=`function legacyServiceRoadPlan(s,p,placed,skip,hw=1.3){
  const candidates=[];
  for(const st of s.streets||[])if(st!==skip&&!st.hidden&&!st.gone&&!st.planQ&&!st.planned&&st.kind!=='edge'&&(st.kind!=='quay'||st.serviceLinked)&&!st.castlePath)for(let k=1;k<st.pts.length;k++){
    const a=st.pts[k-1],b=st.pts[k],dx=b.x-a.x,dz=b.z-a.z,L=dx*dx+dz*dz||1,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/L,0,1),x=a.x+dx*t,z=a.z+dz*t;
    if(streetAccessAt(s,{x,z}))candidates.push({x,z,d:dist2d(p.x,p.z,x,z),st});}
  candidates.sort((a,b)=>a.d-b.d);const walker={house:s.owner,settlement:s,placed,requireRoadCrossing:true,waterClearance:hw+1};
  if(armyObstacle(walker,p.x,p.z))return null;
  const attempted=[];for(const q of candidates){if(armyObstacle(walker,q.x,q.z)||attempted.some(a=>a.st===q.st))continue;attempted.push(q);const path=armyLandPath(walker,[p,{x:q.x,z:q.z}]);if(path)return{path,street:q.st};if(attempted.length===12)break;}
  return null;
}`;

// A small square world (SIZE 100: ground beyond +-40 counts as sea) keeps every search cheap. `water(x,z,pad)` says where a river lies;
// `paid(x,z)` where a paid road carries travellers over it; `placed` lists building footprints.
function runtime({water=null,paid=null,buildings=[]}={}){
  const counts={detour:0,clear:0};
  const C=vm.createContext({COUNTS:counts,W:{rivHash:water?{}:undefined,settlements:[],roads:[]},G:{},SIZE:100,CELL:10,SEA_SURFACE:.5,
    hAt:()=>10,fortGround:()=>10,riverAt:water?(x,z,pad=0)=>water(x,z,pad)?{hw:3,y:9}:null:()=>null,paidRoadAt:(x,z)=>!!paid&&paid(x,z),
    toCell:()=>0,inB:()=>false,fortCircuits:()=>[],streetAccessAt:()=>true,
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  vm.runInContext(REAL.map(fn).join('\n')+'\n'+LEGACY,C);
  vm.runInContext(`{const d=armyDetour,c=armySegmentClear;globalThis.armyDetour=function(...a){COUNTS.detour++;return d.apply(this,a);};globalThis.armySegmentClear=function(...a){COUNTS.clear++;return c.apply(this,a);};}`,C);
  C.placed={near:()=>buildings};
  return{C,counts,call(expr,...args){C.args=args;return vm.runInContext(expr,C);},
    walker(extra={}){const s=extra.settlement||{owner:0,streets:[]};return{house:0,settlement:s,placed:C.placed,requireRoadCrossing:true,...extra};},
    measure(expr,...args){counts.detour=0;counts.clear=0;const result=this.call(expr,...args);return{result,detour:counts.detour,clear:counts.clear};}};
}
const lane=(x0,z0,x1,z1)=>({kind:'lane',pts:[{x:x0,z:z0},{x:x1,z:z1}]});
const shape=(plan,s)=>plan?{path:plan.path.map(q=>[q.x,q.z]),street:s.streets.indexOf(plan.street)}:null;
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

test('a door cut off by water is refused after one failed target, not twelve',()=>{
  const moat=(x,z,pad)=>Math.abs(Math.hypot(x,z)-8)<2+pad; // a ring of river around the door
  const R=runtime({water:moat}),s={owner:0,streets:Array.from({length:14},(_,i)=>lane(18+i*1.5,-10,18+i*1.5,10))};
  const fast=R.measure('serviceRoadPlan(...args)',s,{x:0,z:0},R.C.placed),slow=R.measure('legacyServiceRoadPlan(...args)',s,{x:0,z:0},R.C.placed);
  assert.equal(fast.result,null);assert.equal(slow.result,null);
  assert.equal(slow.detour,36,'the plain planner searches twelve targets in three boxes each');
  assert.equal(fast.detour,3,'only the first target is searched, in its three boxes');
  assert.ok(fast.clear<slow.clear,`edge tests ${fast.clear} against ${slow.clear}`);
});

test('a reachable door still gets exactly the path it always got',()=>{
  const moat=(x,z,pad)=>Math.abs(Math.hypot(x,z)-8)<2+pad,causeway=(x,z)=>Math.abs(z)<6&&x>2&&x<14;
  const R=runtime({water:moat,paid:causeway,buildings:[{x:22,z:0,w:8,d:8,rot:0,state:'sound'}]});
  const s={owner:0,streets:[lane(28,-20,28,20),lane(32,-20,32,20),lane(37,-20,37,20)]},p={x:0,z:0};
  const fast=R.measure('serviceRoadPlan(...args)',s,p,R.C.placed),slow=R.measure('legacyServiceRoadPlan(...args)',s,p,R.C.placed);
  assert.ok(fast.result,'the paid causeway lets the door reach the first street');
  assert.deepEqual(shape(fast.result,s),shape(slow.result,s));
  assert.ok(fast.result.path.some(q=>Math.abs(q.z)>4),'the route bends round the building after the causeway');
});

test('a street that cannot be reached is skipped but the next one is still found',()=>{
  const pond=(x,z,pad)=>Math.abs(Math.hypot(x-16,z)-7)<2+pad; // the nearest street stands inside its own moat
  const R=runtime({water:pond}),s={owner:0,streets:[lane(16,-1,16,1),lane(32,-20,32,20),lane(37,-20,37,20)]},p={x:0,z:0};
  const fast=R.measure('serviceRoadPlan(...args)',s,p,R.C.placed),slow=R.measure('legacyServiceRoadPlan(...args)',s,p,R.C.placed);
  assert.equal(slow.result.street,s.streets[1]);assert.deepEqual(shape(fast.result,s),shape(slow.result,s));
  assert.ok(fast.detour<=slow.detour);
});

test('a straight run through a gap the lattice cannot enter is still taken',()=>{
  // Two long buildings leave a corridor 0.8 wide that holds no lattice node, so no stepped route crosses it; the straight line down its middle is clear.
  const wall=(zc)=>({x:12,z:zc,w:34.4,d:38,rot:0,state:'sound'}),pond=(x,z,pad)=>Math.abs(Math.hypot(x+20,z-10)-5)<2+pad;
  const R=runtime({water:pond,buildings:[wall(20.9),wall(-19.1)]}),p={x:0,z:.9};
  const s={owner:0,streets:[lane(-20,9.7,-20,10.3),lane(30,-5,30,5)]}; // the near street is stranded in a ring of water; the far one lies beyond the corridor
  const fast=R.measure('serviceRoadPlan(...args)',s,p,R.C.placed),slow=R.measure('legacyServiceRoadPlan(...args)',s,p,R.C.placed);
  assert.equal(slow.result.street,s.streets[1]);assert.equal(slow.result.path.length,2,'a single straight run');
  assert.deepEqual(shape(fast.result,s),shape(slow.result,s));
});

test('the flood is only trusted when it completes, and a walker with no memo keeps none',()=>{
  const R=runtime(),w=R.walker({_em:new Map()}),far=[{x:30,z:30}];
  assert.equal(R.call('armyReach(...args)',w,{x:0,z:0},far,150,10),null,'too large to say: the planner falls back to full searches');
  const flood=R.call('armyReach(...args)',w,{x:0,z:0},far,150,60000);assert.ok(flood);
  R.C.flood=flood;assert.equal(R.call('armyReaches(flood,args[0])',{x:20,z:20}),true);assert.equal(R.call('armyReaches(flood,args[0])',{x:5000,z:5000}),true,'outside the box nothing is claimed');
  const plain=R.walker();R.call('armyLandPath(...args)',plain,[{x:-20,z:0},{x:20,z:0}]);assert.equal('_em' in plain,false);
});

// ---- the plain planner is the oracle on random worlds ---------------------------------------------------------------
function scenario(rnd){
  const U=(a,b)=>a+(b-a)*rnd(),buildings=[];
  for(let i=0,n=Math.floor(U(0,14));i<n;i++)buildings.push({x:U(-30,30),z:U(-30,30),w:U(3,8),d:U(3,8),rot:U(0,Math.PI),state:'sound'});
  const kind=[0,1,1,2,3,4,4,4,4,4][Math.floor(U(0,10))],cx=U(-20,20),cz=U(-20,20),r=U(7,18),edge=U(-18,18);let water=null,paid=null;
  if(kind===1)water=(x,z,pad)=>Math.abs(Math.hypot(x-cx,z-cz)-r)<2+pad;             // a moat round anywhere
  else if(kind===2){water=(x,z,pad)=>Math.abs(x-edge)<2+pad;if(rnd()<.5){const zc=U(-25,25);paid=(x,z)=>Math.abs(z-zc)<4;}} // a river across the map, sometimes bridged
  else if(kind===3){water=(x,z,pad)=>Math.hypot(x-cx,z-cz)<r*.6+pad;}                   // a pond
  else if(kind===4)water=(x,z,pad)=>Math.abs(Math.hypot(x,z)-r)<2+pad;                 // a moat round the origin
  const p=kind===4&&rnd()<.7?{x:U(-3,3),z:U(-3,3)}:{x:U(-28,28),z:U(-28,28)};
  const streets=Array.from({length:1+Math.floor(U(0,16))},()=>{const a={x:U(-36,36),z:U(-36,36)},b={x:a.x+U(-20,20),z:a.z+U(-20,20)};return{kind:'lane',pts:[a,b]};});
  return{R:runtime({water,paid,buildings}),s:{owner:0,streets},p,kind};
}

test('random worlds: the flood planner and the plain planner agree on every door',()=>{
  const rnd=mulberry(20261006);let found=0,none=0,saved=0,walls=0;
  for(let i=0;i<70;i++){
    const{R,s,p,kind}=scenario(rnd),hw=rnd()<.3?1.6:1.3;
    const fast=R.measure('serviceRoadPlan(...args)',s,p,R.C.placed,null,hw),slow=R.measure('legacyServiceRoadPlan(...args)',s,p,R.C.placed,null,hw);
    assert.deepEqual(shape(fast.result,s),shape(slow.result,s),`world ${i} (kind ${kind})`);
    assert.ok(fast.detour<=slow.detour,`world ${i}: skipping never adds a search`);
    if(slow.result)found++;else none++;if(fast.detour<slow.detour)saved++;if(kind)walls++;
  }
  assert.ok(found>10&&none>10,`${found} planned, ${none} refused: both outcomes are exercised`);assert.ok(saved>=5,`${saved} worlds skipped searches`);assert.ok(walls>30);
});

test('random worlds: quays share one memo across their doors and still match the plain planner',()=>{
  const rnd=mulberry(77);let planned=0;
  for(let i=0;i<30;i++){
    const{R,s,p}=scenario(rnd),doors=Array.from({length:6},(_,k)=>({x:p.x+k*2.3-6,z:p.z+(k%3)*1.7-2}));R.C.memo=new Map();
    const first=(expr,extra)=>{for(let k=0;k<doors.length;k++){const plan=R.call(expr,s,doors[k],R.C.placed,null,1.6,extra);if(plan)return[k,shape(plan,s)];}return null;};
    const fast=first('serviceRoadPlan(...args)',R.C.memo),slow=first('legacyServiceRoadPlan(...args)');
    assert.deepEqual(fast,slow,`quay ${i}`);if(slow)planned++;
  }
  assert.ok(planned>10,`${planned} quays found a road`);
});

test('random worlds: a lattice edge remembered by one search gives the same answer to the next',()=>{
  const rnd=mulberry(5150);let paths=0,nulls=0;
  for(let i=0;i<20;i++){
    const{R,s}=scenario(rnd),U=(a,b)=>a+(b-a)*rnd(),memo=new Map();
    for(let k=0;k<6;k++){const p={x:U(-30,30),z:U(-30,30)},q={x:p.x+U(-20,20),z:p.z+U(-20,20)},pad=[24,64,144][k%3];
      const warm=R.call('armyDetour(...args)',R.walker({settlement:s,_em:memo}),p,q,pad),cold=R.call('armyDetour(...args)',R.walker({settlement:s}),p,q,pad);
      assert.deepEqual(warm,cold,`world ${i} search ${k}`);if(cold)paths++;else nulls++;}
  }
  assert.ok(paths>30&&nulls>10,`${paths} routes, ${nulls} refusals`);
});

test('random worlds: the flood never rules out a target that a full search would reach',()=>{
  const rnd=mulberry(9001);let ruledOut=0,checked=0;
  for(let i=0;i<14;i++){
    const{R,s,p}=scenario(rnd),U=(a,b)=>a+(b-a)*rnd(),targets=Array.from({length:8},()=>({x:p.x+U(-30,30),z:p.z+U(-30,30)}));
    const memoWalker=R.walker({settlement:s,_em:new Map()}),plain=R.walker({settlement:s}),flood=R.call('armyReach(...args)',memoWalker,p,targets,150,60000);
    if(!flood)continue;R.C.flood=flood;
    for(const q of targets){checked++;if(R.call('armyReaches(flood,args[0])',q))continue;ruledOut++;
      if(R.call('armySegmentClear(...args)',plain,p,q))continue;
      assert.equal(R.call('armyLandPath(...args)',plain,[p,q]),null,`world ${i}: target (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) was ruled out but is reachable`);}
  }
  assert.ok(ruledOut>15,`${ruledOut} of ${checked} targets were ruled out and checked`);
});
