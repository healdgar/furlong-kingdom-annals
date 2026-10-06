import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const baseline=execFileSync('git',['show','e3636c6:index.html'],{encoding:'utf8',maxBuffer:20e6});
function fn(s,n){const m=s.match(new RegExp('^function '+n+'\\b[\\s\\S]*?^\\}','m'));assert.ok(m,`missing ${n}`);return m[0];}
const hashSource=fn(source,'makeHash');
const baseTrack=fn(baseline,'buildTracks'),newTrack=fn(source,'settleTracks');

function fixture(spec={}){
  const points=spec.points||Array.from({length:12},(_,i)=>({x:i*24,z:0}));
  const settlements=spec.settlements||[{pos:{x:-25,z:0},radius:10,extentR:10,buildings:[],streets:[]}];
  const fields=spec.fields||settlements.map((_,dom)=>({dom,state:'tilled',kind:'field',poly:[points.at(-1)]}));
  return {points,settlements,fields};
}
function run(which,spec={}){
  const {points,settlements,fields}=fixture(spec),edges=(spec.edges||points.slice(1).map((_,i)=>[i,i+1,points[i+1].x-points[i].x])).map(([a,b,c])=>({a,b,k:a<b?`${a}_${b}`:`${b}_${a}`,L:c,c}));
  const T={V:new Map(points.map((p,i)=>[`${Math.round(p.x)},${Math.round(p.z)}`,i])),pts:points,adj:points.map(()=>[]),E:new Map()};
  for(const e of edges){T.adj[e.a].push(e);T.adj[e.b].push(e);T.E.set(e.k,e);}
  const W={settlements,land:{F:fields},tg:T,trackSet:null};const G={land:W.land,tg:T,trackSet:null};let distanceCalls=0,bridgeCalls=0,projectCalls=0;
  const context={W,G,trackGraph:()=>T,LS:{TILLED:'tilled',PASTURE:'pasture'},LK:{NONE:'none'},HASH_STAMP:0,
    dist2d:(x,z,a,b)=>{distanceCalls++;return Math.hypot(x-a,z-b);},
    segDist:(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/L));return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);},
    furlongPoly:f=>f.poly||[],tgKey:p=>`${Math.round(p.x)},${Math.round(p.z)}`,
    prepareTrackBridges(){bridgeCalls++;G.trackBridgeAt=[];G.trackBridgePlan=[];},
    VISUAL:{defer(){return true;}},projectTracks(){projectCalls++;},console,
  };
  vm.createContext(context);vm.runInContext(hashSource,context);vm.runInContext(which==='base'?baseTrack:newTrack,context);vm.runInContext(which==='base'?'buildTracks()':'settleTracks()',context);
  const graph=JSON.stringify({points:T.pts,edges:[...T.E.values()],adj:T.adj.map(a=>a.map(e=>e.k))});
  const originals=[...settlements,...settlements.flatMap(s=>[s.pos,...(s.buildings||[]),...(s.streets||[]).flatMap(st=>[st,...(st.pts||[])])]),...fields,...fields.flatMap(f=>f.poly||[]),...T.pts,...edges];
  return {trackSet:[...(which==='base'?context.G.trackSet:context.W.trackSet)],distanceCalls,bridgeCalls,projectCalls,originalsClean:originals.every(o=>!Object.hasOwn(o,'__hs')),
    world:JSON.stringify(context.W.settlements),fields:JSON.stringify(context.G.land.F),graph};
}
function equivalent(spec){const a=run('base',spec),b=run('new',spec);assert.deepEqual(b.trackSet,a.trackSet);assert.equal(b.bridgeCalls,a.bridgeCalls);assert.equal(b.projectCalls,0);assert.equal(a.projectCalls,0);assert.equal(b.world,a.world);assert.equal(b.fields,a.fields);assert.equal(b.graph,a.graph);assert.equal(b.originalsClean,true);}

test('spatial candidates preserve routes for urban, rural, overlapping, edge, and root cases',()=>{
  const points=Array.from({length:14},(_,i)=>({x:i*24,z:0}));
  const settlements=[
    {pos:{x:-25,z:0},radius:10,extentR:10,buildings:[],streets:[]},
    {pos:{x:120,z:36},radius:60,extentR:5,buildings:[],streets:[]},
    {pos:{x:120,z:-36},radius:60,extentR:5,buildings:[],streets:[]},
    {pos:{x:5000,z:0},radius:60,extentR:60,buildings:[],streets:[]},
  ];
  settlements[0].buildings=[{x:120,z:0,rural:true,state:'sound'}];
  settlements[0].streets=[{kind:'lane',hidden:true,pts:[{x:192,z:0},{x:216,z:0}]}];
  const fields=[
    {dom:0,state:'tilled',kind:'field',poly:[points.at(-1)]},
    {dom:1,state:'pasture',kind:'field',poly:[points.at(-2)]},
    {dom:2,state:'tilled',kind:'field',poly:[points.at(-3)]},
    {dom:3,state:'waste',kind:'field',poly:[points[1]]},
    {dom:3,state:'tilled',kind:'none',poly:[points[2]]},
    {dom:99,state:'tilled',kind:'field',poly:[points[3]]},
  ];
  equivalent({points,settlements,fields});
  for(const f of fields.slice(0,3))equivalent({points,settlements,fields:[f]});
});

test('cell boundaries, strict town radius, and root exemption match the scan',()=>{
  const points=[{x:231,z:0},{x:256,z:0},{x:266,z:0},{x:267,z:0},{x:300,z:0}];
  const settlements=[{pos:{x:256,z:0},radius:60,extentR:10,buildings:[],streets:[]}];
  const fields=[{dom:0,state:'tilled',kind:'field',poly:[points.at(-1)]}];
  equivalent({points,settlements,fields});
  for(let i=0;i<settlements.length;i++)equivalent({points,settlements:[settlements[i]],fields:fields.filter(f=>f.dom===i)});
});

test('open chains stay nonempty and hidden streets keep blocking tracks',()=>{
  const points=[{x:0,z:0},{x:24,z:0},{x:48,z:0},{x:72,z:0}],settlements=[{pos:{x:-25,z:0},radius:10,extentR:10,buildings:[],streets:[]}],fields=[{dom:0,state:'tilled',kind:'field',poly:[points.at(-1)]}];
  const open=run('base',{points,settlements,fields}),indexed=run('new',{points,settlements,fields});
  assert.deepEqual(open.trackSet,['2_3','1_2','0_1']);assert.deepEqual(indexed.trackSet,open.trackSet);
  const hidden=run('base',{points,settlements:[{...settlements[0],streets:[{kind:'lane',hidden:true,pts:[points[1],points[2]]}]}],fields});
  const hiddenIndexed=run('new',{points,settlements:[{...settlements[0],streets:[{kind:'lane',hidden:true,pts:[points[1],points[2]]}]}],fields});
  assert.deepEqual(hidden.trackSet,[]);assert.deepEqual(hiddenIndexed.trackSet,hidden.trackSet);
});

test('equal competing paths under overlapping village penalties preserve tie order',()=>{
  const points=[{x:0,z:0},{x:24,z:0},{x:48,z:0},{x:72,z:0},{x:48,z:24},{x:48,z:-24}],edges=[[0,1,24],[1,2,24],[2,3,24],[1,4,24],[4,3,24],[1,5,24],[5,3,24]];
  const settlements=[
    {pos:{x:-25,z:0},radius:10,extentR:10,buildings:[],streets:[]},
    {pos:{x:48,z:0},radius:60,extentR:6,buildings:[],streets:[]},
    {pos:{x:48,z:1},radius:60,extentR:6,buildings:[],streets:[]},
  ],fields=[{dom:0,state:'tilled',kind:'field',poly:[points[3]]}];
  const base=run('base',{points,edges,settlements,fields}),indexed=run('new',{points,edges,settlements,fields});
  assert.deepEqual(base.trackSet,['3_4','1_4','0_1']);assert.deepEqual(indexed.trackSet,base.trackSet);
});

test('unsafe spatial-hash inputs fall back to complete candidates',()=>{
  const points=[{x:0,z:0},{x:24,z:0},{x:48,z:0},{x:72,z:0}];
  for(const extentR of [Infinity,5000]){
    equivalent({points,settlements:[{pos:{x:-25,z:0},radius:10,extentR,buildings:[],streets:[]}],fields:[{dom:0,state:'tilled',kind:'field',poly:[points.at(-1)]}]});
  }
  const nonfinite=[{x:0,z:0},{x:24,z:0},{x:48,z:Infinity},{x:72,z:0}];
  equivalent({points:nonfinite,settlements:[{pos:{x:-25,z:0},radius:10,extentR:10,buildings:[{x:Infinity,z:0,rural:true,state:'sound'}],streets:[]}],fields:[{dom:0,state:'tilled',kind:'field',poly:[nonfinite.at(-1)]}]});
});

test('isolated settlements do not add per-edge full-world distance scans',()=>{
  const points=Array.from({length:40},(_,i)=>({x:i*24,z:0}));
  const settlements=[{pos:{x:-25,z:0},radius:10,extentR:10,buildings:[],streets:[]}];
  for(let i=0;i<80;i++)settlements.push({pos:{x:100000+i*400,z:50000},radius:60,extentR:60,buildings:[],streets:[]});
  const fields=[{dom:0,state:'tilled',kind:'field',poly:[points.at(-1)]}];
  const base=run('base',{points,settlements,fields}),indexed=run('new',{points,settlements,fields});
  assert.deepEqual(indexed.trackSet,base.trackSet);assert.equal(indexed.originalsClean,true);
  assert.ok(indexed.distanceCalls<base.distanceCalls/4,`candidate ${indexed.distanceCalls}; baseline ${base.distanceCalls}`);
});
