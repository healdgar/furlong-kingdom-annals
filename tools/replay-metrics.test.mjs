import test from 'node:test';import assert from 'node:assert/strict';import {summarize} from './replay-metrics.mjs';
test('nearest-rank tails preserve isolated stalls',()=>{assert.deepEqual(summarize(Array.from({length:100},(_,i)=>i+1)),{count:100,p95:95,p99:99,max:100});assert.equal(summarize([2,1,900]).p99,900);});
test('empty and invalid samples cannot fabricate latency',()=>{assert.deepEqual(summarize([]),{count:0,p95:null,p99:null,max:null});assert.throws(()=>summarize([NaN]));assert.throws(()=>summarize([-1]));});
import {performanceGate} from './replay-metrics.mjs';
test('predeclared gates require actual RAF and both thresholds',()=>{const b={journal:{encodedBytes:100},daysPerSecond:2},c={journal:{encodedBytes:30},daysPerSecond:4};assert.equal(performanceGate(b,c,{driver:'raf'}).pass,true);assert.equal(performanceGate(b,c,{driver:'tick'}).pass,false);assert.equal(performanceGate(b,{...c,journal:{encodedBytes:31}},{driver:'raf'}).pass,false);});
