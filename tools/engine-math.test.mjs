// One seed, one history, in every engine. ECMAScript leaves two things to each engine that the game had let decide its history:
// how Math.sin, exp, log, pow, hypot and their kin round (Chrome 154 and Node 25 differ in the last bit), and how often and in
// what order a sort consults its comparator (which matters when the comparator throws dice). The game puts its own math (DM,
// in plain double arithmetic) on its realm's Math, and no sort asks the dice. These tests keep it so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
import {inlineGameScript,contextFor} from './simulation-boundary.mjs';

const SOURCE=inlineGameScript(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
const ROUNDED=['sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh','asinh','acosh','atanh','exp','expm1','log','log1p','log2','log10','pow','hypot','cbrt'];
const F=new Float64Array(1),B=new BigUint64Array(F.buffer),bits=v=>{F[0]=v;return B[0].toString(16).padStart(16,'0');};
const game=()=>{const math=Object.create(null);for(const k of Object.getOwnPropertyNames(Math))math[k]=Math[k];const c=contextFor(SOURCE,'#s=1&f=1&c=sea&y=850',math);return {DM:vm.runInContext('DM',c),math:vm.runInContext('Math',c)};};

test('the game takes the place of every engine-rounded Math function it uses, and squares are its only powers',()=>{
  const {DM,math}=game();
  for(const k of Object.keys(DM))assert.equal(math[k],DM[k],'Math.'+k+' in the game\'s realm is its own');
  const missing=ROUNDED.filter(k=>!(k in DM)),calls=[...SOURCE.matchAll(new RegExp(String.raw`Math\.(${missing.join('|')})\s*\(`,'g'))].map(m=>m[0]);
  assert.deepEqual(calls,[],'an engine-rounded function without its own in DM');
  const powers=[...SOURCE.matchAll(/\*\*\s*(?!2(?![\d.]))\S{0,12}/g)].map(m=>m[0]);
  assert.deepEqual(powers,[],'** squares only (exact in every engine); other powers are Math.pow, which is the game\'s own');
});

test('no sort asks the dice: how often, and in what order, a comparator is asked is each engine\'s own',()=>{
  const dice=[];for(const m of SOURCE.matchAll(/\.sort\(/g)){let i=m.index+6,d=1;while(d>0&&i<SOURCE.length){const c=SOURCE[i++];if('([{'.includes(c))d++;else if(')]}'.includes(c))d--;}
    const cmp=SOURCE.slice(m.index+6,i-1);if(/\b(rr|rand|randi|frand|fgauss|pick|chance|nameRng|tenureNew)\s*\(|\bRS\s*[[.]|Math\.random/.test(cmp))dice.push(cmp.slice(0,80));}
  assert.deepEqual(dice,[],'draw each item\'s lot once, then sort by it; or shuffle by Fisher and Yates');
});

test('DM gives the values it always has (fdlibm, and V8 hypot, in plain double arithmetic)',()=>{
  const {DM}=game();
  for(const [f,args,want] of [["sin",[0.5],"3fdeaee8744b05f0"],["sin",[1e-9],"3e112e0be826d695"],["sin",[2.5],"3fe326af0dcfcab0"],["sin",[-4.188790204786392],"3febb67ae8584cb0"],["sin",[208829.9264],"3fed5d2e5241f9ce"],["sin",[4280656.366400001],"bfe5f67085584476"],["sin",[71000000],"bfd019ec00a15101"],["sin",[1e+300],"bfea2c16b010e385"],["cos",[0.1],"3fefd712f9a817c0"],["cos",[0.7],"3fe87996529f9d93"],["cos",[3.7699111843077517],"bfe9e3779b97f4a8"],["cos",[-34128355260.59921],"bfdb7cd10b8459a0"],["cos",[1e+22],"3fe0be2cef01c8f4"],["atan2",[0.9023837869817363,-0.43093329065239383],"4000216e013ead02"],["atan2",[1,-6.73105660098372e-9],"3ff921fb5612bb19"],["atan2",[-3,-4],"c003fc176b7a8560"],["atan2",[1e-300,10000000000],"000012688b70e62b"],["atan2",[3.725290298461914e-9,1e-8],"3fd6d293a33c849c"],["exp",[-0.36645517870783806],"3fe62e96ef1d1551"],["exp",[-103.49594103103072],"3699c1e9b60637a8"],["exp",[1],"4005bf0a8b145769"],["exp",[700],"7f0d945df4f8ec8e"],["exp",[-740],"0000000000000055"],["log",[0.1523888169322163],"bffe19e304f2fc20"],["log",[1.5319310169874896],"3fdb4c4077ca9d2b"],["log",[9.68211042507376e-74],"c06503df5f030ef9"],["log",[1e-310],"c0864e69394d9508"],["log1p",[0.5064502212699624],"3fda397161ed3ba4"],["log1p",[-0.44812219382363977],"bfe3058f2cdbe8e3"],["log2",[3],"3ff95c01a39fbd68"],["log2",[0.8763030129484832],"bfc8623f5beb71e4"],["log10",[12.993476086699845],"3ff1d1d1ac958010"],["log10",[8.214866597536593e-20],"c03315dcbd9a13d0"],["tanh",[0.10908737732097507],"3fbbd0ed200adbfb"],["tanh",[-0.9],"bfe6ebe982d6605d"],["tanh",[3],"3fefd77d111a0b00"],["pow",[0.73,1.35],"3fe4ec6f40651ced"],["pow",[2.5,0.3],"3ff50fe6c94a6e58"],["pow",[0.7,7],"3fb5152be12f5a5e"],["pow",[-2,3],"c020000000000000"],["pow",[0.001,2.2],"3e90db6355ec704a"],["pow",[1.0000001,1000000000],"48f349445c228792"],["pow",[3,-1074],"0000000000000000"],["hypot",[3,4],"4014000000000000"],["hypot",[1e-200,3e-200],"16835d5244b69495"],["hypot",[0.1,0.2],"3fcc9f25c5bfedda"],["hypot",[1.5,2.5,3.5],"4012388ac0059c28"]])assert.equal(bits(DM[f](...args)),want,`DM.${f}(${args})`);
  let s=0x9e3779b9;const r=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};
  for(const f of ['sin','cos','exp','log','log1p','log2','log10','tanh','pow','atan2','hypot'])for(let i=0;i<4000;i++){
    const x=(r()*2-1)*10**(i%7-2),y=(r()*2-1)*4,a=f.startsWith('log')?[Math.abs(x)]:f==='pow'?[Math.abs(x),y]:['atan2','hypot'].includes(f)?[x,y]:[x];
    const d=DM[f](...a),e=Math[f](...a);F[0]=d;const u=B[0];F[0]=e;const ulps=Number(u>B[0]?u-B[0]:B[0]-u);
    assert.ok(Object.is(d,e)||ulps<=4,`DM.${f}(${a}) = ${d}, this engine says ${e}`);}
});

// The world after a few days, played in a worker thread's own realm (a vm context is several times slower to grow a world in).
const RUN=`const {parentPort,workerData:{source,rounded,nudged,seed,fate,coast,days}}=require('node:worker_threads'),vm=require('node:vm'),{createHash}=require('node:crypto');
  if(nudged){const F=new Float64Array(1),B=new BigUint64Array(F.buffer),nudge=v=>{if(!Number.isFinite(v)||v===0)return v;F[0]=v;B[0]+=1n;return F[0];};
    for(const k of rounded){const f=Math[k];Math[k]=(...a)=>nudge(f(...a));} // another engine's Math: every rounded function a last bit off
    const sort0=Array.prototype.sort;Array.prototype.sort=function(cmp){if(cmp===undefined)return sort0.call(this); // and another engine's sort: a top-down merge, stable as the standard asks
      const v=[],u=[];for(let i=0;i<this.length;i++)(this[i]===undefined?u:v).push(this[i]);const c=(x,y)=>{const r=+cmp(x,y);return r!==r?0:r;};
      const ms=a=>{if(a.length<2)return a;const h=a.length>>1,l=ms(a.slice(0,h)),r=ms(a.slice(h)),o=[];let i=0,j=0;while(i<l.length&&j<r.length)o.push(c(l[i],r[j])<=0?l[i++]:r[j++]);return o.concat(l.slice(i),r.slice(j));};
      const s=ms(v).concat(u);for(let i=0;i<s.length;i++)this[i]=s[i];return this;};}
  for(const k of ['localStorage','sessionStorage','navigator'])Object.defineProperty(globalThis,k,{value:undefined,writable:true,configurable:true});
  Object.assign(globalThis,{FURLONG_HEADLESS:true,FURLONG_OPTIONS:{hash:'#s='+seed+'&f='+fate+'&c='+coast+'&y=850'},addEventListener(){},removeEventListener(){},requestAnimationFrame(){}});
  vm.runInThisContext(source,{filename:'index.html'});const R=c=>vm.runInThisContext(c);
  (async()=>{await R('startSimulation({seed:'+seed+',fate:'+fate+',coast:'+JSON.stringify(coast)+',startAD:850,outcomeJournal:new OutcomeJournal(async e=>({chunk:e.chunk,first:e.first,last:e.last}),{maxPendingBytes:64*1024*1024})})');
    for(let i=0;i<days;i++){await R('STORAGE_OUTCOMES.wait()');R('simTick()');}
    const g=R('(()=>{const g=new HistoryGraph(),f=g.capture(W,{skipQueryScratch:true});return JSON.stringify([f.root,[...g.state].sort(([a],[b])=>a-b),g.code]);})()');
    parentPort.postMessage({world:createHash('sha256').update(g).digest('hex'),rng:R('JSON.stringify(Object.entries(RS).map(([k,r])=>[k,r.state()]))'),annals:R('JSON.stringify(allLines)'),treasury:R('W.treasury')});})();`;
export const engineRun=(source,nudged,{seed=42,fate=42,coast='sea',days=8}={})=>new Promise((resolve,reject)=>{
  const w=new Worker(RUN,{eval:true,workerData:{source,rounded:ROUNDED,nudged,seed,fate,coast,days}});w.once('message',m=>{resolve(m);w.terminate();});w.once('error',reject);});

test('a realm and its history do not depend on the engine: its Math rounding, or its sort',async()=>{
  const here=await engineRun(SOURCE,false),elsewhere=await engineRun(SOURCE,true);
  assert.equal(elsewhere.world,here.world,'the world after eight days');
  assert.equal(elsewhere.rng,here.rng,'every RNG stream');
  assert.equal(elsewhere.annals,here.annals,'the annals');
});
