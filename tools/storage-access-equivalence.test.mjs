import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// storageAccess remembers, per place, the step that last blocked each walk and tries it first (#15). It must answer
// every call as the original walk (frozen from cfa6993) does, through random changes to water, slope, rivers, lakes,
// walls and gates between calls, so that a remembered step that no longer blocks is never trusted.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const frozen="function storageAccess(s,a,b){const d=dist2d(a.x,a.z,b.x,b.z),fortified=typeof fortCircuits==='function'&&fortCircuits(s).length,steps=Math.max(1,Math.ceil(d/(fortified?1:5)));if(typeof wallRadAt==='function'&&s.wallRad){const side=p=>dist2d(p.x,p.z,s.pos.x,s.pos.z)-wallRadAt(s,Math.atan2(p.z-s.pos.z,p.x-s.pos.x));if(side(a)*side(b)<0)return false;}for(let i=0;i<=steps;i++){const f=i/steps,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;if(typeof toCell==='function'&&W.water){const ci=toCell(x),cj=toCell(z);if(!inB(ci,cj)||W.water[cIdx(ci,cj)]||slopeAt(ci,cj)>0.35)return false;}if(typeof riverAt==='function'&&riverAt(x,z,0.5)||typeof lakeAt==='function'&&lakeAt(s,x,z,0.5)||fortified&&fortRoadBlocked(s,x,z))return false;}return true;}";
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}

function realm(){
  const ctx=vm.createContext({Math,Map,Set,WeakMap,Number,Uint8Array,Float64Array,Infinity,NaN});
  vm.runInContext(`const GRID=40,CELL=10,SIZE=400;const W={water:new Uint8Array(GRID*GRID),h:new Float64Array(GRID*GRID)};let HASH_STAMP=0;
    const toCell=x=>Math.floor((x+SIZE/2)/CELL),cIdx=(cx,cz)=>cz*GRID+cx,inB=(cx,cz)=>cx>=0&&cz>=0&&cx<GRID&&cz<GRID;
    let READS=0;const lakeAt=(s,x,z,pad)=>{READS++;const L=s.lake;return !!L&&Math.abs(x-L.x)<L.r+(pad||0)&&Math.abs(z-L.z)<L.r+(pad||0);};
    const fortCircuits=s=>s.forts.slice();const fortRoadBlocked=(s,x,z)=>{READS++;for(const c of s.forts)if(Math.abs(Math.hypot(x-c.x,z-c.z)-c.r)<1.3&&!c.gates.some(g=>Math.abs(Math.atan2(z-c.z,x-c.x)-g)<0.2))return true;return false;};
    const wallRadAt=(s,a)=>s.wallR;`,ctx);
  vm.runInContext([line('const clamp='),line('const dist2d='),line('function segDist('),block('function slopeAt(cx,cz){','\n}\n')+'\n}',block('function makeHash(','\nfunction groundBuilding'),block('function riverAt(x,z,pad){','\n}\n')+'\n}'].join('\n'),ctx);
  vm.runInContext('W.rivHash=makeHash(40);'+frozen.replace('function storageAccess(','function storageAccessOld('),ctx);
  vm.runInContext(block('const STORAGE_ACCESS_BLOCKED=','\n// Reuse only within one synchronous'),ctx);
  return ctx;
}

test('the remembered blocking step gives the original answer through every kind of change',()=>{
  let calls=0,remembered=0,stale=0;
  for(let seed=1;seed<=20;seed++){
    const r=rng(seed*7919),ctx=realm(),run=x=>vm.runInContext(x,ctx);
    run(`var s={pos:{x:0,z:0},wallRad:null,wallR:90,forts:[],lake:null};`);
    const pt=()=>({x:Math.round((r()-.5)*360*4)/4,z:Math.round((r()-.5)*360*4)/4});
    const yards=Array.from({length:4},pt),nodes=Array.from({length:14},pt); // a few yards, each walked to every node, again and again
    const change=()=>{const k=Math.floor(r()*9),cx=Math.floor(r()*40),cz=Math.floor(r()*40);
      if(k===0)run(`W.water[cIdx(${cx},${cz})]^=1`);else if(k===1)run(`W.h[cIdx(${cx},${cz})]=${r()<.5?0:9}`);
      else if(k===2){const a=pt(),b=pt();run(`W.rivHash.add({x:${a.x},z:${a.z},a:{x:${a.x},z:${a.z}},b:{x:${b.x},z:${b.z}},hw:${2+r()*6}},${Math.hypot(a.x-b.x,a.z-b.z)+8})`);}
      else if(k===3)run(`W.rivHash=makeHash(40)`);else if(k===4)run(`s.lake=${r()<.5?'null':JSON.stringify({x:pt().x,z:pt().z,r:10+r()*40})}`);
      else if(k===5)run(`s.forts=${r()<.4?'[]':JSON.stringify([{x:pt().x,z:pt().z,r:20+r()*80,gates:[r()*6-3]}])}`);
      else if(k===6)run(`if(s.forts[0])s.forts[0].gates.push(${r()*6-3})`);
      else if(k===7)run(`s.wallRad=${r()<.5?'null':'[1]'};s.wallR=${40+r()*120}`);
      else {const y=yards[Math.floor(r()*yards.length)];Object.assign(y,pt());}}; // a collection point moves with its fields
    for(let i=0;i<20;i++)if(r()<.3)run(`W.water[cIdx(${Math.floor(r()*40)},${Math.floor(r()*40)})]=1`);
    for(let round=0;round<30;round++){
      if(r()<.6)change();
      for(const a of yards)for(const b of nodes){ctx.a=a;ctx.b=b;
        const had=run(`(()=>{const M=STORAGE_ACCESS_BLOCKED.get(s),p=a.x+','+a.z+'>'+b.x+','+b.z+':';if(M)for(const k of M.keys())if(k.startsWith(p))return true;return false;})()`);
        const before=run('READS'),o=run('storageAccessOld(s,a,b)'),mid=run('READS'),n=run('storageAccess(s,a,b)'),after=run('READS');
        assert.equal(n,o,`seed ${seed} round ${round} ${JSON.stringify(a)}→${JSON.stringify(b)}`);calls++;
        if(!o&&after-mid<mid-before)remembered++; // blocked, answered from the remembered step
        else if(had&&after-mid>=mid-before)stale++;}} // a remembered step that no longer blocked: the full walk ran
  }
  assert.ok(calls>30000,'calls '+calls);assert.ok(remembered>calls/10,'a remembered step answered many blocked walks: '+remembered);
  assert.ok(stale>200,'remembered steps that no longer blocked were walked afresh: '+stale);
});

test('the memory lives outside the place and the world, and a fresh memory answers the same',()=>{
  const ctx=realm(),run=x=>vm.runInContext(x,ctx);
  run(`var s={pos:{x:0,z:0},wallRad:null,wallR:90,forts:[{x:0,z:0,r:50,gates:[0]}],lake:null};for(let i=0;i<40;i++)W.water[cIdx(20,i)]=1;`);
  const pairs=[[{x:-150,z:5},{x:150,z:-30}],[{x:10,z:10},{x:-30,z:120}],[{x:-60,z:0},{x:60,z:0}]];
  const first=pairs.map(([a,b])=>{ctx.a=a;ctx.b=b;return run('storageAccess(s,a,b)');});
  assert.deepEqual(Object.keys(run('s')).sort(),['forts','lake','pos','wallR','wallRad']);
  run('STORAGE_ACCESS_BLOCKED.delete(s)');
  assert.deepEqual(pairs.map(([a,b])=>{ctx.a=a;ctx.b=b;return run('storageAccess(s,a,b)');}),first);
  assert.deepEqual(pairs.map(([a,b])=>{ctx.a=a;ctx.b=b;return run('storageAccessOld(s,a,b)');}),first);
});
