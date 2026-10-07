import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {realm} from './ownership-fixture.mjs';

// HEAD may still be the committed parent while index.html contains the active patch.
import fs from 'node:fs';
const live=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const baseline=execFileSync('git',['show','6bccf4a:index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
function fn(source,name){return source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'))?.[0]||assert.fail(`missing ${name}`);}
function injected(source,names){return program=>names.reduce((p,n)=>p.replace(fn(p,n),fn(source,n)),program);}
function counters(program){return program+`\nglobalThis.fastCounts={share:0,reconcile:0};
const originalShareOutput=shareOutput, originalReconcile=reconcile;
shareOutput=(...a)=>{fastCounts.share++;return originalShareOutput(...a)};
reconcile=(...a)=>{fastCounts.reconcile++;return originalReconcile(...a)};`}
function foodState(r){return r.eval(`JSON.stringify({food:s.households.map(h=>pantry(s,h)),debt:s.households.map(h=>h._debt||0),cash:s.households.map(h=>h.w),town:s.stores,hunger:s.households.map(h=>h.hunger||0)})`);}

test('daily household feeding removes duplicate share and reconciliation while preserving outcomes',()=>{
  const old=realm({grain:0.5,fish:1,households:4,cash:15,transformSource:p=>counters(injected(baseline,['topUpFood','eatHouseholds'])(p))});
  const now=realm({grain:0.5,fish:1,households:4,cash:15,transformSource:counters});
  for(const r of [old,now])r.eval("ownershipTick();H[0]._debt=foodYr()*.1;H[1]._debt=foodYr()*.2");
  old.run();now.run();
  assert.deepEqual(JSON.parse(foodState(now)),JSON.parse(foodState(old)));
  assert.ok(old.eval('fastCounts.share')>now.eval('fastCounts.share'));
  assert.ok(old.eval('fastCounts.reconcile')>now.eval('fastCounts.reconcile'));
});

test('standalone food top-up still shares output and reconciles spoilage',()=>{
  const r=realm({grain:0,fish:0,households:2,cash:0,transformSource:counters});
  r.eval("ownershipTick();s.stores.grain=5;addHeld(s,H[0],'grain',10);topUpFood(s,0,folkIndex())");
  assert.ok(r.eval('fastCounts.share')>0);
  assert.ok(r.eval('fastCounts.reconcile')>0);
  assert.equal(r.eval('heldTotal(s,\'grain\')'),5);
});

test('provision wage recipients preserve ties, self exclusion and per-payment mutation',()=>{
  const block=source=>{
    const p=fn(source,'provision');
    return p.match(/if\(pay2\.length\)\{const poor=[\s\S]*?payAmong\(L,v,h,'wages'\);\}\}/)?.[0]||assert.fail('missing wage recipient block');
  };
  const exercise=code=>{
    const c={foodYr:()=>10,heads:[{id:1,w:0},{id:2,w:0},{id:3,w:0},{id:4,w:0},{id:5,w:0},{id:6,w:0},{id:7,w:0}],pay2:[],calls:[],payAmong(L,v,h){this.calls.push([h.id,L.map(x=>x.id)]);L[0].w+=1;}};
    const instrument=code.replace('poor.filter(q=>q!==h)','poor.filter(q=>{visits++;return q!==h})');
    c.payAmong=c.payAmong.bind(c);
    // Equal wealth verifies stable sort ties; payer 1 is self-excluded and recipient mutation cannot reorder candidates.
    c.pay2=[[c.heads[0],1],[c.heads[6],1]];
    vm.runInNewContext(`let visits=0;${instrument};globalThis.result={calls,visits};`,c);return c.result;
  };
  const a=exercise(block(baseline)),b=exercise(block(live));
  assert.deepEqual(b.calls,a.calls);
  assert.ok(b.visits<a.visits,`${b.visits} should be below ${a.visits}`);
});

test('migration roots retain value while farmland is scanned once for all destinations',()=>{
  const rootsExpr=source=>{
    const body=/^function familyMove\b/m.test(source)?fn(source,'familyMove'):fn(source,'tickHouseholds'); // a family's move is weighed in familyMove since #23 (783448c); the baseline still has it in tickHouseholds
    const m=body.match(/(?:const roots=|if\(roots===undefined\)roots=)(foodYr\(\)\*[\s\S]*?\))(?=; \/\/)/);
    return m?.[1]||assert.fail('missing roots expression');
  };
  const make=(expr,lazy)=>{
    let visits=0;const s={furl:new Proxy([{own:7},{own:7},{own:8}],{get(t,k,r){if(k==='filter')return (...a)=>{visits++;return t.filter(...a)};return Reflect.get(t,k,r);}})};
    const h={id:7,herd:{sheep:2},bh:{ownerId:7}};const BEASTS=['sheep','cattle'];const LU={sheep:1,cattle:2},foodYr=()=>10;
    let roots;const values=[];for(let j=0;j<6;j++){if(!lazy)values.push(vm.runInNewContext(expr,{s,h,BEASTS,LU,foodYr}));else{if(roots===undefined)roots=vm.runInNewContext(expr,{s,h,BEASTS,LU,foodYr});values.push(roots);}}
    return {values,visits};
  };
  const old=make(rootsExpr(baseline),false),now=make(rootsExpr(live),true);
  assert.deepEqual(now.values,old.values);assert.equal(old.visits,6);assert.equal(now.visits,1);
});
