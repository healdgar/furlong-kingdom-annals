import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scoreProfile,compactScore,formatScore,updateHotlist,readHotlist,hotlistReport} from './cpu-score.mjs';
// CPU scoring of sampled profiles (own time, total time once per stack, the outermost part of the day, idle and the
// harness kept apart) and the running hot list (previous run per world, trimming, the change since the last run).

const G='file:///x/index.snapshot.html',H='harness.cjs';
const fr=(functionName,url,lineNumber=0,columnNumber=0)=>({functionName,url,lineNumber,columnNumber});
function profile(){ // root ─ (program) | (idle) | (garbage collector) | play[harness] ─ simTick ─ simPart ─ tickEconomy ─ near@10, rec ─ rec
  //                                                                     └ flush (outside the day)          └ tickPopulation ─ near@20
  const N=[[1,fr('(root)','')],[2,fr('(program)','')],[3,fr('(idle)','')],[4,fr('(garbage collector)','')],[5,fr('play',H)],[6,fr('simTick',G,100)],
    [7,fr('simPart',G,101)],[8,fr('tickEconomy',G,200)],[9,fr('near',G,10)],[10,fr('rec',G,300)],[11,fr('rec',G,300)],[12,fr('tickPopulation',G,400)],[13,fr('near',G,20)],
    [14,fr('flush',G,500)],[15,fr('',G,600)],[16,fr('tickEconomy',G,200)]];
  const kids={1:[2,3,4,5],5:[6,14],6:[7,15],7:[8,12],8:[9,10],10:[11],12:[13],15:[16]};
  const nodes=N.map(([id,callFrame])=>({id,callFrame,children:kids[id]||[]}));
  // ms per sample: (program) 1, idle 50, gc 2, near@10 4, rec inner 3, rec outer 1, near@20 5, tickPopulation 1, flush 2, simTick self 1, harness 1, tickEconomy via an anonymous frame 2
  const S=[[2,1],[3,50],[4,2],[9,4],[11,3],[10,1],[13,5],[12,1],[14,2],[6,1],[5,1],[16,2]];
  return {nodes,samples:S.map(s=>s[0]),timeDeltas:S.map(s=>s[1]*1000),startTime:0,endTime:0};
}
const obj=L=>Object.fromEntries(L.map(([k,v])=>[k,+v.toFixed(6)]));

test('own time, total time and parts of the day, per day',()=>{
  const s=scoreProfile(profile(),{days:2});
  assert.equal(s.idleMs,50);assert.equal(s.busyMs,23);assert.equal(s.msDay,11.5);
  assert.deepEqual(obj(s.self),{'(program)':0.5,'(garbage collector)':1,'near@11':2,'rec':2,'near@21':2.5,'tickPopulation':0.5,'flush':1,'simTick':0.5,'(harness)':0.5,'tickEconomy':1});
  const total=obj(s.total);
  assert.equal(total.rec,2,'a recursive function counts once per sample');
  assert.equal(total.tickEconomy,(4+3+1+2)/2,'both tickEconomy frames are one function');
  assert.equal(total.simTick,(4+3+1+5+1+1+2)/2);assert.equal(total.play,undefined,'harness frames are left out of total time');
  assert.equal(total['(anonymous)@601'],1);
  assert.deepEqual(obj(s.parts),{'(program)':0.5,'(garbage collector)':1,tickEconomy:5,tickPopulation:3,'(outside the day)':1.5,'(simTick)':0.5});
  assert.equal(s.where.tickEconomy,'index.snapshot.html:201');
  const c=compactScore(s,{top:3});assert.deepEqual(Object.keys(c.self),['near@21','near@11','rec']);assert.equal(Object.keys(c.parts).length,6);
  const md=formatScore(s,{top:4,title:'t'});assert.match(md,/\| tickEconomy \| 5\.00 \| 43\.5% \|/);assert.match(md,/By function, total time/);
});

test('the hot list keeps a run per world, finds the previous one and reports the change',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hotlist-')),file=path.join(dir,'hot.json');
  try{
    const age=(year,f)=>({year,days:360,msDay:10*f,parts:{tickEconomy:6*f,tickPopulation:3},self:{near:4*f,rec:2,tail:0.5},total:{tickEconomy:6*f},where:{near:'index.html:10'}});
    const rec=(f,at,world='s1')=>({at,tool:'soak',world,build:'b'+f,commit:null,load:[1,2],fault:null,ages:[age(1,1),age(20,f)]});
    assert.equal(updateHotlist(file,rec(1,'2026-10-06T10:00:00Z')),null);
    assert.equal(updateHotlist(file,rec(1,'2026-10-06T10:30:00Z','s2')),null,'another world has its own history');
    const prev=updateHotlist(file,rec(2,'2026-10-06T11:00:00Z'));assert.equal(prev.build,'b1');
    const cur=rec(0.5,'2026-10-06T12:00:00Z');cur.ages[1].self={rec:2,tail:0.5,fresh:3};
    const md=hotlistReport(cur,updateHotlist(file,cur,{keep:2}),{top:2});
    assert.match(md,/\| fresh \| – \| 3\.00 \| new \|/);assert.match(md,/\| rec \| 2\.00 \| 2\.00 \| \+0\.00 \(\+0%\) \|/);
    assert.match(md,/Left the top 2: near \(index.html:10\)|Left the top 2: near 8\.00 → below the list/);
    assert.match(md,/\| tickEconomy \| 6\.00 \| 3\.00 \| −9\.00 \(−75%\) \|/);
    const h=readHotlist(file);assert.deepEqual(h.runs.map(r=>r.world+r.build),['s2b1','s1b2','s1b0.5'],'keep trims only the same world');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
