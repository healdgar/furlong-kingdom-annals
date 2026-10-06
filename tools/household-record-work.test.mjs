import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const fixture=path.join(here,'ownership-fixture.mjs');
const current=path.join(here,'..','index.html');
const baseline=path.join(os.tmpdir(),`furlong-baseline-${process.pid}.html`);
fs.writeFileSync(baseline,execFileSync('git',['show','450d2b6:index.html'],{cwd:path.dirname(here),encoding:'utf8',maxBuffer:16*1024*1024}));
const priorSource=process.env.FURLONG_TEST_SOURCE;
const load=async source=>{process.env.FURLONG_TEST_SOURCE=source;return import(`${pathToFileURL(fixture).href}?${encodeURIComponent(source)}`)};
const {pathToFileURL}=await import('node:url');
const old=await load(baseline),now=await load(current);
fs.unlinkSync(baseline);
if(priorSource===undefined)delete process.env.FURLONG_TEST_SOURCE;else process.env.FURLONG_TEST_SOURCE=priorSource;
const clean=x=>JSON.parse(JSON.stringify(x));

function accountState(r){return clean(r.eval(`({
  folk:s.folk.map(p=>({id:p.id,dead:!!p.dead,role:!!p.role,w:p.w||0,debt:p._debt||0,owe:p._owe||[]})),
  households:s.households.map(h=>({id:h.id,head:h.head?.id??null,pop:h.population.get(s)||0,hunger:h.hunger||0,wealth:h.assets.w||0,grain:pantry(s,h).grain||0,fish:pantry(s,h).fish||0,debt:h._debt||0,owe:h._owe||[]})),
  stores:{...s.stores},lard:{...s._lard},treasury:W.treasury,settlement:{pop:s.pop,hunger:s.hunger,fill:s._fill,wealth:s._wealth,homeDay:s._homeDay,unrest:s.unrest,prosperity:s.prosperity},
  market:Object.fromEntries(['grain','fish'].map(g=>[g,{d:s._dem?.[g]||0,s:s._sold?.[g]||0,pool:s._poolBy||{}}])),
  flows:{...W._flow},settlementEvent:s.storage?.version===3?s.storage.settle(1):null
})`));}
function setupFood(r){r.eval(`initOwnership(s);
  H[0].tr='fisher';H[1].role=true;H[2].dead=true;
  householdAccount(H[3]).head=null;
  s.stores.grain=24;s.stores.fish=18;s._lard={grain:3,fish:2};
  for(let i=0;i<H.length;i++){const a=householdAccount(H[i]);a.assets.w=[0,4,7,11][i]||0;a._debt=i===1?2:0;a._owe=i===1?[['fixture-creditor',2]]:[];}
  s._made={grain:5,fish:7};
  if(s.storage?.version===3){s.storage.adjust('yard','grain',null,'unassigned',5,'fixture-production');s.storage.adjust('yard','fish',null,'unassigned',7,'fixture-production');}
  s.px.grain=1;s.px.fish=2;`);}

test('daily household food preserves exact settlement and ledger outcomes in both fixture modes',()=>{
  for(const commodity of [false,true]){
    const a=old.realm({households:4,cash:12,grain:24,fish:18,pop:150,commodity});
    const b=now.realm({households:4,cash:12,grain:24,fish:18,pop:150,commodity});
    if(commodity){a.eval('ownershipTick();storageInit(s)');b.eval('ownershipTick();storageInit(s)');}
    setupFood(a);setupFood(b);
    a.run();b.run();
    assert.deepEqual(accountState(b),accountState(a),`commodity fixture mode ${commodity}`);
    assert.equal(b.coins(),a.coins(),`coin total in commodity fixture mode ${commodity}`);
  }
});

test('borrowing selects the first richest eligible neighbour and excludes self, role, and dead heads',()=>{
  let baselineResult;
  for(const lib of [old,now]){
    const r=lib.realm({households:5,cash:0,grain:0,fish:0});
    r.eval(`initOwnership(s);for(const h of H)householdAccount(h);
      H[0].w=0;H[1].w=400;H[2].w=400;H[3].w=900;H[3].role=true;H[4].w=1000;H[4].dead=true;
      const amount=5;const got=borrow(s,H[0],amount);globalThis.borrowResult={got,selected:H[0]._owe?.[0]?.[0]?.id??null,
        purses:H.map(h=>h.w),debts:H.map(h=>h._debt||0),owe:H.map(h=>(h._owe||[]).map(([l,v])=>[l?.head?.id??l?.id??String(l),v])),treasury:W.treasury};`);
    const result=clean(r.eval('borrowResult'));
    if(lib===old)baselineResult=result;else assert.deepEqual(result,baselineResult);
    if(lib===now){assert.equal(result.selected,2);assert.equal(result.got,5);}
  }
});

test('an unfunded borrower incurs no debt and mints no household or crown coins',()=>{
  const outcomes=[];
  for(const lib of [old,now]){
    const r=lib.realm({households:3,cash:0,grain:0,fish:0,crown:0});
    const result=r.eval(`initOwnership(s);for(const h of H)householdAccount(h);
      H[0].w=0;H[1].w=1;H[2].w=2;W.treasury=0;
      const before=[H.map(h=>h.w),W.treasury];const got=borrow(s,H[0],20);
      ({got,before,after:[H.map(h=>h.w),W.treasury],debt:H[0]._debt||0,owe:H[0]._owe||[]})`);
    outcomes.push(clean(result));
  }
  assert.deepEqual(outcomes[1],outcomes[0]);
  assert.equal(outcomes[1].got,0);assert.equal(outcomes[1].debt,0);assert.deepEqual(outcomes[1].owe,[]);
  assert.deepEqual(outcomes[1].after,outcomes[1].before);
});
