// Trade answers a price (#51): carts, barges and cogs go where the margin pays, net of their own freight and tolls; a place's
// dealers send load after load while one pays and a dealer and a driver are free; what is already on the way to a market counts
// against what it will take; and the screen's drawing cap does not cap the trade. The game's own tickTrade runs in a small realm
// with its dealers and drivers stood in by counts; the last test plays a real world a few weeks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inlineGameScript} from './simulation-boundary.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8'),source=inlineGameScript(html);
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^let |^/\\*|$(?![\\s\\S]))','m'))?.[0]||assert.fail('no function '+n);
const line=n=>source.match(new RegExp('^const '+n+'=.*$','m'))?.[0]||assert.fail('no const '+n);
const PROGRAM=[line('GOODS'),line('GOODBASE'),line('LU'),line('NEED'),line('TRADE_LOAD'),...['frtRate','freight','wayToll','tradeOnTheWay','tradeWant','tradeSpare','tradeRoom','tickTrade'].map(fn)].join('\n');

// A place: what it has to spare and on sale, its prices, what its buyers sought last month, and its carters, boatmen and dealers.
function place(o={}){return {name:o.name||'P',pop:0,infected:0,storage:{},stores:{...o.stores},px:{grain:2,timber:3,wine:8,cloth:7,...o.px},_dAvg:{...o.dAvg},
  carters:o.carters??0,boatmen:o.boatmen??0,dealers:o.dealers??1,pos:o.pos||{x:0,z:0},river:!!o.river,harbor:!!o.harbor};}
// The realm: places, roads (route), river pairs and sea routes; ladeOut stood in by a dealer and a driver of the place or the market the
// load goes to, each driver away once he goes; every load that goes is what was asked of the dealer.
function realm(places,{roads={},rivers=[],seas={},day=4,inbound=[]}={}){
  const W={settlements:places,caravans:inbound.slice(),ships:[],roads:[],riverPairs:rivers};
  const C=vm.createContext({W,D:day,MOD:{tax:12},PL:()=>1,CART_MPD:500,BARGE_MPD:700,COG_MPD:2800,
    day:()=>C.D,price:(s,g)=>s.px[g]??1,avail:(s,g)=>s.stores[g]||0,spareOf:(s,g)=>s.stores[g]||0,closedToTrade:()=>false,metroOf:s=>s,
    caravanPriceIndex:()=>null,caravanPriceCandidates:()=>null,dist2d:(a,b,c,d)=>Math.hypot(a-c,b-d),
    route:(a,b)=>roads[a+'_'+b]||roads[b+'_'+a]||null,seaRoute:(a,b)=>seas[a+'_'+b]||null});
  vm.runInContext('"use strict";\n'+PROGRAM+`
    function ladeOut(c,o){ladeOut.why=null;const d=W.settlements[c.dest],k=c.sea||c.river?'boatmen':'carters';
      if(!(o.dealers>0)&&!(d.dealers>0)){ladeOut.why='merchant';return null;}
      const from=o[k]>0?o:d[k]>0?d:null;if(!from){ladeOut.why='driver';return null;}from[k]--;o.stores[c.good]-=c.qty;return c;}`,C);
  return {W,C,run:s=>vm.runInContext(s,C),tick(){vm.runInContext('tickTrade()',C);return W.caravans.slice(inbound.length);}};
}
const line2=(a,b)=>({poly:[a,b],len:Math.hypot(a.x-b.x,a.z-b.z),time:Math.hypot(a.x-b.x,a.z-b.z)});
const busy={grain:100,timber:100,wine:100,cloth:100}; // buyers enough that no market is full

test('barges and cogs take the load with the best margin for the boatman\'s days, by river or by sea, and throw no dice',()=>{
  // a river port on the coast with timber, grain and wine to spare; a river town upstream and a harbour along the coast
  const P=()=>[place({name:'Port',river:true,harbor:true,boatmen:1,stores:{grain:200,timber:90,wine:200}}),
    place({name:'Upriver',river:true,px:{grain:3,timber:3.2,wine:9},dAvg:busy}),
    place({name:'Haven',harbor:true,px:{grain:2.5,timber:6,wine:8.5},dAvg:busy,pos:{x:5000,z:0}})];
  const rivers=[{a:0,b:1,route:line2({x:0,z:0},{x:2000,z:0})}],seas={'0_2':line2({x:0,z:0},{x:6000,z:0})};
  const r=realm(P(),{rivers,seas}),sent=r.tick();
  assert.equal(sent.length,1,'one boatman, one load');
  assert.deepEqual([sent[0].good,sent[0].dest,!!sent[0].sea],['timber',2,true],'timber by cog: three a unit dearer along the coast');
  assert.equal(sent[0].qty,90,'a cog\'s load');
  // the next best when there is a second boat (a load's margin net of its carriage, tolls and loss, for each day the boatman is gone):
  // grain up the river 0.73 a unit over 2.9 days, 70 to a barge; grain along the coast 0.19 over 2.1 days; wine up the river 0.33
  const r2=realm(P().map((s,i)=>i?s:{...s,boatmen:2}),{rivers,seas}),two=r2.tick();
  assert.deepEqual(two.map(c=>[c.good,c.dest,c.qty]),[['timber',2,90],['grain',1,70]],'the two best loads, best first');
  assert.ok(two[1].river&&two[1].poly[0].x===0,'the barge goes up the river from the port');
  assert.doesNotMatch(fn('tickTrade'),/\b(chance|pick|rand|frand|Math\.random)\(/,'no load is chosen by the dice');
});

test('a place\'s dealers send a second load while a second profitable one remains and a carter is free',()=>{
  const roads={'0_1':line2({x:0,z:0},{x:1000,z:0})};
  const P=(carters,stores)=>[place({name:'Market',carters,stores}),place({name:'Town',px:{grain:4,cloth:12},dAvg:busy,pos:{x:1000,z:0}})];
  const one=realm(P(1,{grain:150,cloth:150}),{roads}).tick();
  assert.equal(one.length,1);assert.equal(one[0].good,'cloth','the best load first');
  const three=realm(P(3,{grain:150,cloth:150}),{roads}).tick();
  assert.deepEqual(three.map(c=>[c.good,c.qty]),[['cloth',60],['cloth',60],['cloth',30]],'a second load of the same good while it pays best (30 of cloth earn more than 60 of grain)');
  const four=realm(P(4,{grain:150,cloth:150}),{roads}).tick();
  assert.deepEqual(four.map(c=>c.good),['cloth','cloth','cloth','grain'],'then the next good');
  const more=realm(P(9,{grain:150,cloth:150}),{roads}).tick();
  assert.equal(more.length,6);assert.equal(more.reduce((t,c)=>t+c.qty,0),300,'loads go until all that can be spared has gone');
  // no carter here, but one of the town's comes out for it
  const fetched=realm(P(0,{grain:150}).map((s,i)=>i?{...s,carters:1}:s),{roads}).tick();
  assert.equal(fetched.length,1);
  // no dealer here or there with the silver: nothing goes, and nothing is tried twice
  const poor=realm(P(4,{grain:150,cloth:150}).map(s=>({...s,dealers:0})),{roads});let tries=0;poor.run('const L0=ladeOut;ladeOut=function(c,o){tries++;return L0(c,o);};var tries=0;');
  assert.equal(poor.tick().length,0);assert.equal(poor.run('tries'),2,'no dealer with the silver for cloth; grain, cheaper, is tried once; nothing is tried twice');
});

test('loads already on the road to a market reduce what is sent after them',()=>{
  const roads={'0_1':line2({x:0,z:0},{x:1000,z:0}),'2_1':line2({x:2000,z:0},{x:1000,z:0})};
  const P=()=>[place({name:'A',carters:9,stores:{grain:1000}}),place({name:'B',px:{grain:4},dAvg:{grain:10},pos:{x:1000,z:0}}),place({name:'C',carters:9,stores:{grain:1000},pos:{x:2000,z:0}})];
  const free=realm(P(),{roads}).tick(),sum=L=>L.reduce((t,c)=>t+c.qty,0);
  const cover=10*6,net=4-2-(0.12+0.08)*0.7-4*(0.05+12/100*0.14)-0.04,room=cover*4/(4-net); // half a year of what its buyers seek, as far as the price stands above the cost laid down
  assert.ok(Math.abs(sum(free)-room)<1e-9,`the gap draws loads enough to close it: ${sum(free)} against ${room}`);
  assert.ok(free.every(c=>c.origin===0),'and the second market, coming after, finds it closed');
  const behind=realm(P(),{roads,inbound:[{origin:2,dest:1,good:'grain',qty:50,robbed:false}]}).tick();
  assert.ok(Math.abs(sum(behind)-(room-50))<1e-9,'fifty on the road already: fifty fewer sent');
  const robbed=realm(P(),{roads,inbound:[{origin:2,dest:1,good:'grain',qty:50,robbed:true}]}).tick();
  assert.ok(Math.abs(sum(robbed)-room)<1e-9,'a load the outlaws took is not coming');
  const full=realm(P().map((s,i)=>i===1?{...s,stores:{grain:200}}:s),{roads}).tick();
  assert.equal(full.length,0,'a market with its cover and more on sale draws nothing');
});

test('the realm\'s trade is not capped by what the screen can draw; the screen draws the nearest loads',()=>{
  const N=120,places=[place({name:'Capital',px:{grain:9},dAvg:{grain:4000},pos:{x:0,z:0}})],roads={};
  for(let i=1;i<=N;i++){places.push(place({name:'V'+i,carters:2,stores:{grain:200},pos:{x:400+i*10,z:0}}));roads['0_'+i]=line2({x:0,z:0},{x:400+i*10,z:0});}
  const r=realm(places,{roads});r.tick();r.C.D=6;const sent=r.tick(); // a day for the even places and the next for the odd
  const TRAFFIC_CAP=+source.match(/const TRAFFIC_CAP=(\d+)/)[1];
  assert.equal(sent.length,2*N,'every village sends its two carters');assert.ok(sent.length>TRAFFIC_CAP);
  for(const n of ['tickTrade','tickEconomy','ladeOut','tradeRoom'])assert.doesNotMatch(fn(n),/TRAFFIC_CAP/,n+' knows nothing of the drawing');
  // the drawing: the nearest loads, as many carts as the cap and a hull to each boat
  const drawn=fn('trafficDrawn'),G={cogs:new Array(8),barges:new Array(8)},L=[];
  for(let i=0;i<300;i++)L.push({qty:36,poly:[{x:i*10,z:0},{x:i*10+1,z:0}],departDay:0,arriveDay:10,sea:i%3===0,river:i%3===1});
  const D=vm.runInContext(drawn+';trafficDrawn(L,0)',vm.createContext({L,G,TRAFFIC_CAP,CART_UNIT:18,performance:{now:()=>0},cam:{cur:{focus:{x:0,z:0}}},
    polyPos:p=>p[0],clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist2d:(a,b,c,d)=>Math.hypot(a-c,b-d)}));
  const sea=L.filter(c=>D.has(c)&&c.sea),river=L.filter(c=>D.has(c)&&c.river),carts=L.filter(c=>D.has(c)&&!c.sea&&!c.river);
  assert.equal(sea.length,8);assert.equal(river.length,8);assert.equal(carts.length*2+16,TRAFFIC_CAP,'two carts to each load of 36');
  assert.deepEqual(sea.map(c=>L.indexOf(c)),[0,3,6,9,12,15,18,21],'the nearest cogs');
  assert.deepEqual(carts.map(c=>L.indexOf(c)),Array.from({length:carts.length},(_,k)=>2+3*k),'and the nearest carts');
});

test('in a real realm, barges and cogs carry by margin with a dealer and a driver to each load',{timeout:300_000},async()=>{
  const globals={FURLONG_HEADLESS:true,addEventListener(){},removeEventListener(){},requestAnimationFrame(){},setTimeout,clearTimeout,
    performance,console,URL,Blob,TextEncoder,TextDecoder,ReadableStream,btoa,atob,Map,Set,WeakMap,WeakSet,Date,Math,Number,Intl,Promise,
    Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint16Array,Uint32Array,ArrayBuffer,DataView,
    Error,TypeError,RangeError,JSON,RegExp,parseInt,parseFloat,isFinite,NaN,Infinity,structuredClone,
    ...(typeof CompressionStream==='undefined'?{}:{CompressionStream,DecompressionStream,Response})};
  const c=vm.createContext({...globals,FURLONG_OPTIONS:{hash:'#s=42&f=42&c=sea&y=850'}});new vm.Script(source,{filename:'index.html'}).runInContext(c,{timeout:120_000});
  const run=code=>vm.runInContext(code,c,{timeout:600_000});
  await run(`startSimulation({seed:42,fate:42,coast:'sea',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})`);
  run('globalThis.__sent=[];const T0=tickTrade;tickTrade=function(){const n=W.caravans.length;T0();for(const c of W.caravans.slice(n))__sent.push({sea:!!c.sea,river:!!c.river,m:!!c.m,drv:!!c.drv,qty:c.qty,unit:c.unit,cost:c.cost,len:c.len});}');
  for(let i=1;i<=40;i++){await run('STORAGE_OUTCOMES.wait()');run('simTick()');if(i%8===0)await run('STORAGE_OUTCOMES.journal.flush()');}
  const sent=run('__sent');
  assert.ok(sent.some(x=>x.river),'barges go');assert.ok(sent.some(x=>x.sea),'cogs go');
  for(const x of sent){assert.ok(x.m&&x.drv,'a dealer who pays and a driver who is paid');assert.ok(x.unit>0,'and a margin over the carriage');assert.ok(x.qty>0.5);}
});
