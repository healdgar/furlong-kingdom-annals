// Exact routing against the previous per-destination search, including equal-cost queue order.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const kernel=fn('routingTree');
const code=source.slice(source.indexOf('function routingGraph('),source.indexOf('function timedPos('));

function world(seed,n=20){let state=seed;const roll=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
  const W={settlements:Array.from({length:n},()=>({})),roads:[],seaLanes:[],adj:{},routes:{}};for(let i=0;i<n;i++)W.adj[i]=[];
  const road=(a,b,len)=>{const ri=W.roads.length;W.roads.push({a,b,len,grade:roll()<.5?0:1,cond:roll()<.5?1:.25,path:[{x:a*20,z:0},{x:b*20,z:ri+1}]});W.adj[a].push({to:b,ri});W.adj[b].push({to:a,ri});};
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(roll()<.15)road(i,j,1+Math.floor(roll()*5));
  // Parallel roads exercise the original distinction between the chosen edge and displayed polyline.
  road(0,1,10);road(0,1,2);
  for(let i=0;i<3;i++){const a=Math.floor(roll()*n),b=Math.floor(roll()*n);if(a!==b)W.seaLanes.push({a,b,len:10,poly:[{x:a*20,z:0},{x:b*20,z:0}]});}
  return W;
}
function realm(W,WorkerType,hash=''){const c=vm.createContext({MODEL_ONLY:false,WORLD_PARAMS:typeof hash==='string'?hash:'',W,Math,console,Worker:WorkerType,Blob,URL,location:{hash},MARCH_MPD:420,COG_MPD:1000,PORT_DELAY:1200,dist2d:(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz)});vm.runInContext(code,c);return{c,eval:s=>vm.runInContext(s,c)};}
function previous(W,ai,bi,sea){ // frozen pre-optimization queue semantics
  const adj=c=>{const E=W.adj[c]||[];if(!sea||!W.seaLanes.length)return E;const o=E.slice();W.seaLanes.forEach((L,li)=>{if(L.a===c)o.push({to:L.b,li});else if(L.b===c)o.push({to:L.a,li});});return o;};
  const prev={},via={},g={},open=[ai],done=new Set();prev[ai]=null;g[ai]=0;
  while(open.length){let mi=0;for(let k=1;k<open.length;k++)if(g[open[k]]<g[open[mi]])mi=k;const c=open.splice(mi,1)[0];if(done.has(c))continue;done.add(c);if(c===bi)break;
    for(const e of adj(c)){const w=e.li!==undefined?W.seaLanes[e.li].len*420/1000+1200:(r=>(r.len||1)/(1+.5*(r.grade||0))/(.6+.4*(r.cond??1)))(W.roads[e.ri]),nd=g[c]+w;
      if(!(e.to in g)||nd<g[e.to]){g[e.to]=nd;prev[e.to]=c;via[e.to]=e;open.push(e.to);}}}
  if(!(bi in prev))return null;const hops=[];for(let c=bi;prev[c]!==null;c=prev[c])hops.push([prev[c],c,via[c]]);hops.reverse();let poly=[],seaLen=0;
  for(const[f,t,e]of hops){let seg;if(e.li!==undefined){const L=W.seaLanes[e.li];seg=(L.a===f?L.poly:[...L.poly].reverse()).map(q=>({x:q.x,z:q.z,sea:true}));seaLen+=L.len;}
    else{const r=W.roads.find(r=>r.a===f&&r.b===t||r.a===t&&r.b===f);seg=r.path.slice();if(r.a!==f)seg.reverse();}if(poly.length)seg=seg.slice(1);poly=poly.concat(seg);}
  let len=0;for(let k=1;k<poly.length;k++)len+=Math.hypot(poly[k-1].x-poly[k].x,poly[k-1].z-poly[k].z);const res={poly,len,time:g[bi]};
  if(seaLen){const tf=[0];let T=0;for(let k=1;k<poly.length;k++){const d=Math.hypot(poly[k-1].x-poly[k].x,poly[k-1].z-poly[k].z),s=poly[k].sea&&poly[k-1].sea;T+=s?d*420/1000:d;if(poly[k].sea!==poly[k-1].sea)T+=600;tf.push(T);}Object.assign(res,{tf:tf.map(v=>v/Math.max(1,T)),tlen:T,sea:true,seaLen});}
  return res;
}

test('one tree matches every prior destination search across tied, disconnected and mixed graphs',()=>{
  for(let seed=1;seed<=50;seed++){const W=world(seed),r=realm(W);for(const sea of [false,true])for(let a=0;a<W.settlements.length;a++)for(let b=0;b<W.settlements.length;b++)
    assert.equal(JSON.stringify(r.eval(`route(${a},${b},${sea})`)),JSON.stringify(previous(W,a,b,sea)),`seed ${seed}, ${a} → ${b}, sea ${sea}`);}
});
test('roads, condition, paving and world replacement invalidate route trees',()=>{const W=world(71),r=realm(W);r.eval('route(0,1);');const before=r.eval('ROUTING.version');W.roads[0].cond=.15;W.roads[0].grade=1;W.routes={};
  assert.equal(JSON.stringify(r.eval('route(0,1)')),JSON.stringify(previous(W,0,1)));assert.ok(r.eval('ROUTING.version')>before);
  r.c.W=world(72);assert.equal(JSON.stringify(r.eval('route(0,1,true)')),JSON.stringify(previous(r.c.W,0,1,true)));assert.equal(r.eval('route(-1,1)'),null);assert.equal(r.eval('route(0,99)'),null);});
test('unreachable pairs stay cached until the graph changes',()=>{const W=world(1,8);W.adj=Object.fromEntries(W.settlements.map((_,i)=>[i,[]]));const r=realm(W);
  assert.equal(r.eval('route(0,7)'),null);const n=r.eval('ROUTING.stats.syncTrees');assert.equal(r.eval('route(0,7)'),null);assert.equal(r.eval('ROUTING.stats.syncTrees'),n);
  W.adj[0]=[{to:1,ri:W.roads.length-1}];W.routes={};assert.ok(r.eval('route(0,1)'));});
test('worker scheduling retains one in-flight graph and the latest pending graph; stale replies cannot install',()=>{
  const workers=[];class FakeWorker{constructor(){workers.push(this);this.sent=[];}postMessage(x){this.sent.push(structuredClone(x));}terminate(){this.dead=true;}}
  const W=world(4),r=realm(W,FakeWorker);r.eval('routingPrepare()');const worker=workers[0],old=worker.sent[0];for(let i=0;i<5;i++){W.routes={};r.eval('routingPrepare()');}
  assert.equal(worker.sent.length,1);const newest=r.eval('ROUTING.version');worker.onmessage({data:{version:old.version,trees:[]}});assert.equal(worker.sent.length,2);assert.equal(worker.sent[1].version,newest);assert.equal(r.eval('ROUTING.stats.stale'),1);
  worker.onerror({preventDefault(){}});assert.ok(worker.dead);assert.equal(r.eval('ROUTING.disabled'),true);assert.ok(r.eval('route(0,1)'));});
test('the canonical tree kernel runs in a real background thread and returns identical numeric buffers',async()=>{const W=world(81),r=realm(W),graph=r.eval('routingGraph()'),expected=r.eval('routingTree(routingGraph(),0,true)');
  const worker=new Worker(`const{parentPort}=require('node:worker_threads');const routingTree=${kernel};parentPort.on('message',graph=>{const t=routingTree(graph,0,true);parentPort.postMessage(t,[t.g.buffer,t.prev.buffer,t.via.buffer]);});`,{eval:true});
  try{const reply=new Promise((res,rej)=>{worker.once('message',res);worker.once('error',rej);});worker.postMessage(graph);const actual=await reply;for(const k of ['g','prev','via'])assert.deepEqual(Array.from(actual[k]),Array.from(expected[k]));}finally{await worker.terminate();}
});
test('worker construction and posting failures preserve the synchronous route',()=>{for(const failure of ['construction','posting']){class FailedWorker{constructor(){if(failure==='construction')throw new Error('blocked');}postMessage(){throw new Error('cannot clone');}terminate(){}}
  const W=world(2),r=realm(W,FailedWorker);assert.equal(JSON.stringify(r.eval('route(0,1)')),JSON.stringify(previous(W,0,1)));assert.equal(r.eval('ROUTING.stats.failures'),1);assert.equal(r.eval('ROUTING.disabled'),true);}});
test('worker=off is captured before boot normalizes the world link',()=>{class UnwantedWorker{constructor(){assert.fail('worker must remain disabled');}}
  const r=realm(world(3),UnwantedWorker,'#s=3&worker=off');r.c.location.hash='#s=3';assert.ok(r.eval('route(0,1)'));assert.equal(r.eval('ROUTING.disabled'),true);assert.equal(r.eval('ROUTING.worker'),null);});
