import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {realm} from './ownership-fixture.mjs';
const baseline=execFileSync('git',['show','405fed3:index.html'],{encoding:'utf8',maxBuffer:20e6});
const oldRoute=baseline.match(/^function storageRoute\b.*$/m)[0].replace('function storageRoute','function baselineStorageRoute');
function fixture(){const r=realm({grain:0,fish:0});r.eval(oldRoute);r.eval(`
  let accessCalls=0,pathCalls=0,blocked=false,disconnected=false;
  const graph={N:[{x:50,z:0},{x:0,z:0},{x:100,z:0},{x:0,z:100}]};
  s.streets=[{pts:[{x:0,z:0},{x:100,z:0}]}];
  streetGraph=()=>graph;dist2d=(x,z,a,b)=>Math.sqrt((x-a)**2+(z-b)**2);
  storageAccess=(s,p,n)=>{accessCalls++;return !blocked||n.x===100};
  streetPath=(g,a,b)=>{pathCalls++;return disconnected?null:a===b?[a]:[a,b]};
  const a={x:3,z:2},b={x:98,z:4};
  `);return r;}
test('batched routes exactly match the original distances, ties and blocked endpoints',()=>{
  const r=fixture();r.eval(`let identical=true;
    for(const blockedValue of [false,true]){blocked=blockedValue;storageRouteBatch(s,()=>{
      for(let x=-30;x<120;x+=5)for(let z=-10;z<110;z+=7){const p={x,z};if(!Object.is(storageRoute(s,p,b),baselineStorageRoute(s,p,b)))identical=false;}
    });}`);assert.ok(r.eval('identical'));
});
test('repeated coordinates and paths are searched once within a batch',()=>{
  const r=fixture();r.eval('storageRoute(s,a,b);const once=accessCalls;accessCalls=0;pathCalls=0;storageRouteBatch(s,()=>{for(let i=0;i<20;i++)storageRoute(s,{...a},{...b});});');
  assert.equal(r.eval('accessCalls'),r.eval('once'));assert.equal(r.eval('pathCalls'),1);
  r.eval('storageRoute(s,a,b)');assert.equal(r.eval('accessCalls'),2*r.eval('once'));assert.equal(r.eval('pathCalls'),2);
});
test('unreachable paths are cached without crossing subsequent terrain or gate changes',()=>{
  const r=fixture();r.eval('disconnected=true;storageRouteBatch(s,()=>{for(let i=0;i<10;i++)storageRoute(s,a,b);});');assert.equal(r.eval('pathCalls'),1);
  assert.equal(r.eval('storageRoute(s,a,b)'),Infinity);
  r.eval('disconnected=false;blocked=true;');assert.equal(r.eval('storageRoute(s,a,b)'),r.eval('baselineStorageRoute(s,a,b)'));
  r.eval('s.siegeBy={};');assert.equal(r.eval('storageRouteBatch(s,()=>storageRoute(s,a,b))'),Infinity);
  r.eval('delete s.siegeBy;s.quarantineUntil=2;');assert.equal(r.eval('storageRoute(s,a,b)'),Infinity);
  r.eval('s.quarantineUntil=0;');assert.equal(r.eval('storageRoute(s,a,b)'),r.eval('baselineStorageRoute(s,a,b)'));
});
test('graph replacement invalidates batch results and exceptional exits release them',()=>{
  const r=fixture();r.eval('let replaced;storageRouteBatch(s,()=>{storageRoute(s,a,b);s.streets[0].pts.push({x:200,z:0});streetGraph=()=>({N:[{x:200,z:0}]});replaced=storageRoute(s,a,b);});');
  assert.equal(r.eval('replaced'),r.eval('baselineStorageRoute(s,a,b)'));
  assert.throws(()=>r.eval("storageRouteBatch(s,()=>{storageRoute(s,a,b);throw Error('survey failed')})"),/survey failed/);
  assert.equal(r.eval('STORAGE_ROUTE_BATCHES.has(s)'),false);
});
test('nested surveys share a cache and all routing caches remain outside settlement state',()=>{
  const r=fixture();r.eval('storageRoute(s,a,b);const keys=Object.keys(s).join();accessCalls=0;pathCalls=0;storageRouteBatch(s,()=>{storageRoute(s,a,b);storageRouteBatch(s,()=>storageRoute(s,a,b));});');
  assert.equal(r.eval('pathCalls'),1);assert.equal(r.eval('Object.keys(s).join()'),r.eval('keys'));
  assert.equal(r.eval('STORAGE_ROUTE_BATCHES.has(s)'),false);
});
test('large synchronous surveys bound cache memory and preserve uncached results',()=>{
  const r=fixture();r.eval(`let cacheSizes,uncached;
    storageRouteBatch(s,()=>{for(let x=0;x<5000;x++)storageRoute(s,{x,z:0},b);
      const C=STORAGE_ROUTE_BATCHES.get(s);cacheSizes=[C.points.size,C.paths.size];
      uncached=storageRoute(s,{x:10000,z:4},b);});`);
  assert.equal(r.eval('cacheSizes[0]'),4096);assert.ok(r.eval('cacheSizes[1]')<=4096);
  assert.equal(r.eval('uncached'),r.eval('baselineStorageRoute(s,{x:10000,z:4},b)'));
});
