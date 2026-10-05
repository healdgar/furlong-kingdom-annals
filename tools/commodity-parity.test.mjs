import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compareCommodityGraphs,summarizeCommodityGraphs} from './commodity-parity.mjs';

function encode(root){
  const seen=new Map(),pending=[],nodes=[];
  const walk=v=>{
    if(v===undefined)return ['undefined'];
    if(v===null||typeof v!=='object')return v;
    if(!seen.has(v)){seen.set(v,pending.length);pending.push(v);}return ['ref',seen.get(v)];
  };
  const encoded=walk(root);
  for(let i=0;i<pending.length;i++){
    const v=pending[i];
    if(v instanceof Map)nodes[i]=['map',[...v].map(([k,x])=>[walk(k),walk(x)])];
    else if(v instanceof Set)nodes[i]=['set',[...v].map(walk)];
    else if(Array.isArray(v))nodes[i]=['array',v.map(walk)];
    else nodes[i]=['object',Object.keys(v).sort().map(k=>[k,walk(v[k])])];
  }
  return JSON.stringify({root:encoded,nodes});
}
function fixture(change={},reverseOwners=false){
  const town={name:'Mere',pop:12,_fill:3,stores:{grain:8},_owners:new Map()};
  const lord={id:'lord'};
  const person={id:7};
  const household={household:true,id:'hh1',head:person,members:new Set([person]),hunger:2,assets:{w:11,_debt:3,_owe:[[lord,3]],herd:{ox:2}},population:new Map([[town,12]]),estate:{person:7,day:5,shares:[['crown',1]]},successors:[[lord,1]],guardian:lord};
  const ownerRows=[[lord,{held:{grain:2},sale:{},animals:{},reserve:{}}],[household,{held:{fish:1},sale:{},animals:{},reserve:{}}]];
  town._owners=new Map(reverseOwners?ownerRows.reverse():ownerRows);
  const world={clock:{day:5},treasury:20,houses:[{w:25}],settlements:[town],households:new Map([['hh1',household]])};
  const land=[{k:0,dom:0,lord:0,core:0,held:false,kind:2,state:1,af:3,ar:4,fo:1,fl:0,vi:1,fa:2,area:675,ten:lord,own:household,wk:7}];
  Object.assign(household,change.household||{});Object.assign(land[0],change.land||{});
  return {world,land:{F:land}};
}
function compare(a,b){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commodity-parity-'));
  try{const x=path.join(dir,'a.json'),y=path.join(dir,'b.json');fs.writeFileSync(x,encode(a));fs.writeFileSync(y,encode(b));return compareCommodityGraphs(x,y);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('semantic projection tolerates graph id/property order while covering land and succession',()=>{
  const a=fixture(),b=fixture({},true);
  assert.equal(compare(a,b).pass,true);
  assert.match(compare(a,b).scope,/furlong land/);
  assert.match(compare(a,b).scope,/successors/);
});

test('land and inheritance changes are material parity failures',()=>{
  assert.equal(compare(fixture(),fixture({land:{dom:1}})).pass,false);
  assert.equal(compare(fixture(),fixture({land:{ten:null}})).pass,false);
  assert.equal(compare(fixture(),fixture({household:{successors:[]}})).pass,false);
  assert.equal(compare(fixture(),fixture({household:{guardian:null}})).pass,false);
  assert.equal(compare(fixture(),fixture({household:{members:new Set()}})).pass,false);
});

test('missing captured land graph cannot silently pass',()=>{
  const withoutLand={world:fixture().world};
  assert.equal(compare(fixture(),withoutLand).pass,false);
});

test('statistical summary keeps population-weighted hunger and shared-ID counts separate',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commodity-stats-'));
  try{
    const a=path.join(dir,'a.json'),b=path.join(dir,'b.json');
    fs.writeFileSync(a,encode(fixture()));fs.writeFileSync(b,encode(fixture({household:{hunger:.5}})));
    const result=summarizeCommodityGraphs(a,b);
    assert.equal(result.householdIds.shared,1);assert.equal(result.householdIds.baselineOnly,0);assert.equal(result.householdIds.candidateOnly,0);
    assert.equal(result.baseline.weightedHunger,2);assert.equal(result.candidate.weightedHunger,.5);
    assert.equal(result.pairedDifferences.hunger.mean,-1.5);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
