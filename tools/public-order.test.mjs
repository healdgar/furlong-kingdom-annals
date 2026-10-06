import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const ix=source.slice(source.indexOf('/* ARMY_SETTLEMENT_INDEX_HELPERS_BEGIN */'),source.indexOf('/* ARMY_SETTLEMENT_INDEX_HELPERS_END */'));
function realm(){
  const s={name:'Town',owner:1,pop:1000,unrest:80,garrison:0,militia:0,prosperity:50,buildings:[],_room:1000,infected:0,recovered:0,res:{},revolted:true,pos:{x:0,z:0}};
  const W={settlements:[s,{owner:1}],houses:[{}, {name:'Lord',seat:1}],armies:[],_pm:{}};
  const payments=[],events=[],cooldowns=new Map();let gold=1000,hunger=0;
  const C=vm.createContext({W,MOD:{tax:12},BIRTH0:0,HOUSEHOLD:4,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),day:()=>1,
    eatHouseholds:()=>hunger,householdsOf:()=>[],carryingCap:()=>1000,foodYr:()=>100,plyH:()=>1,inRevolt:()=>false,
    spend:(_hi,c)=>{if(gold<c)return false;gold-=c;return true;},cdLeft:k=>cooldowns.get(k)||0,setCd:(k,n)=>cooldowns.set(k,n),
    heads_:()=>[],payAmong:(_heads,c)=>payments.push(c),emit:(...e)=>events.push(e),chance:()=>false,
    atWar:()=>false,cbtn:(cmd,arg,label,cost,disabled='',description='')=>JSON.stringify({cmd,arg,label,cost,disabled,description}),worksHTML:()=>'',esc:String});
  vm.runInContext(ix+['detailPopulation','friendlyTown','sheltered','publicOrderMen','publicOrderSuppression','watchRecruitment','suppressUnrestAmount','tickPopulation','settlementCmd','settlementActsHTML'].map(fn).join('\n'),C);
  return {C,W,s,payments,events,cooldowns,get gold(){return gold;},set gold(v){gold=v;},set hunger(v){hunger=v;}};
}
test('only the owner’s troops actually in town count; movement and casualties update immediately',()=>{
  const f=realm(),{C,W,s}=f;
  W.armies.push({at:0,house:1,state:'idle',strength:50},{at:0,house:1,state:'arrived',strength:30},
    {at:0,house:2,state:'idle',strength:100},{at:0,house:1,state:'march',strength:100},
    {at:0,house:1,state:'rout',strength:100},{at:0,house:1,state:'idle',field:{x:0,z:0},strength:100},
    {at:0,house:1,state:'idle',gone:true,strength:100});
  s.garrison=10;s.militia=20;assert.equal(C.publicOrderMen(s),100);
  W.armies[0].state='march';assert.equal(C.publicOrderMen(s),50);
  C.armySetSettlement(W.armies[1],1);assert.equal(C.publicOrderMen(s),20);
  W.armies[0].state='idle';W.armies[0].strength=25;assert.equal(C.publicOrderMen(s),45);
});
test('the Crown can keep order in peaceful vassal towns, but hostile and rebellious towns reject that support',()=>{
  const {C,W,s}=realm();s.revolted=false;W.armies.push({at:0,house:0,state:'idle',strength:100});
  assert.equal(C.publicOrderMen(s),100);assert.equal(C.sheltered(s),0);
  C.atWar=()=>true;assert.equal(C.publicOrderMen(s),0);
  C.atWar=()=>false;s.revolted=true;assert.equal(C.publicOrderMen(s),0);
  s.revolted=false;s.owner=0;W.armies[0].house=1;assert.equal(C.publicOrderMen(s),100);
});
test('presence reduces actual daily unrest, is capped, and cannot cancel serious hunger',()=>{
  const unguarded=realm(),guarded=realm();guarded.s.garrison=150;
  unguarded.W.settlements.length=guarded.W.settlements.length=1;
  unguarded.C.tickPopulation();guarded.C.tickPopulation();
  assert.ok(Math.abs(unguarded.s.unrest-guarded.s.unrest-0.35)<1e-9);
  guarded.s.garrison=15000;assert.equal(guarded.C.publicOrderSuppression(guarded.s),0.35);
  guarded.hunger=0.4;const before=guarded.s.unrest;guarded.C.tickPopulation();assert.ok(guarded.s.unrest>before);
  guarded.s.unrest=10;assert.equal(guarded.C.publicOrderSuppression(guarded.s),0);
  guarded.s.unrest=25;assert.equal(guarded.C.publicOrderSuppression(guarded.s),0.175);
});
test('public order queries are read-only once the existing army index is warm',()=>{
  const {C,W,s}=realm();C.armySettlementIndex();const before=structuredClone(W);
  C.publicOrderMen(s);C.publicOrderSuppression(s);C.watchRecruitment(s);C.suppressUnrestAmount(s);assert.deepEqual(W,before);
});
test('local watch recruitment is population bounded, paid, cooled down and ownership restricted',()=>{
  const f=realm();f.s.pop=50;f.C.settlementCmd('garrison',0);
  assert.equal(f.s.garrison,6);assert.equal(f.gold,940);assert.deepEqual(f.payments,[60]);assert.equal(f.cooldowns.get('s_gar0'),60);
  assert.equal(f.C.watchRecruitment(f.s),0);f.C.settlementCmd('garrison',0);assert.equal(f.gold,940);
  const other=realm();other.s.owner=2;other.C.settlementCmd('garrison',0);assert.equal(other.gold,1000);assert.equal(other.s.garrison,0);
  const broke=realm();broke.gold=0;broke.C.settlementCmd('garrison',0);assert.equal(broke.s.garrison,0);assert.equal(broke.cooldowns.size,0);
});
test('forceful suppression requires troops, scales by population, and retains costs and consequences',()=>{
  const f=realm();f.C.settlementCmd('suppress',0);assert.equal(f.gold,1000);assert.equal(f.s.unrest,80);assert.equal(f.cooldowns.size,0);
  f.s.garrison=50;f.C.settlementCmd('suppress',0);assert.equal(f.s.unrest,70);assert.equal(f.s.prosperity,45);assert.equal(f.gold,850);assert.equal(f.cooldowns.get('s_sup0'),30);
  f.C.settlementCmd('suppress',0);assert.equal(f.s.unrest,70);assert.equal(f.gold,850);
  const strong=realm();strong.s.garrison=200;assert.equal(strong.C.suppressUnrestAmount(strong.s),20);
});
test('riot deterrence uses the same forces and leaves a residual risk',()=>{
  const f=realm();f.W.settlements.length=1;
  const start=source.indexOf('  // riots & revolts'),end=source.indexOf('\nfunction ',start),block=source.slice(start,end);
  // Execute the real settlement loop, outside the unrelated diplomacy preceding it.
  const loop=block.slice(block.indexOf('  for(const s of W.settlements){'),block.indexOf('\n  }',block.indexOf('const prRev='))+4);
  const probabilities=[];f.C.chance=(_stream,p)=>{probabilities.push(p);return false;};
  vm.runInContext(loop,f.C);assert.equal(probabilities[0],0.02);
  f.s.garrison=50;probabilities.length=0;vm.runInContext(loop,f.C);assert.ok(Math.abs(probabilities[0]-0.012)<1e-9);
  f.s.garrison=1000;probabilities.length=0;vm.runInContext(loop,f.C);assert.ok(Math.abs(probabilities[0]-0.002)<1e-9);
});
test('town orders explain local watch limits and disable suppression without troops',()=>{
  const f=realm(),html=f.C.settlementActsHTML(f.s);assert.ok(html.includes('Muster local watch (+40)'));assert.ok(html.includes('needs troops and unrest'));
  f.s.garrison=50;assert.ok(f.C.settlementActsHTML(f.s).includes('Suppress unrest (−10.0)'));
});
