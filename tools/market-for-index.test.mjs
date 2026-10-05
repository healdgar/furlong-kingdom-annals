import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function between(start,end){const a=html.indexOf(start);assert.notEqual(a,-1,`missing ${start}`);const b=html.indexOf(end,a);assert.notEqual(b,-1,`missing ${end}`);return html.slice(a,b);}
// Execute the production helpers/functions verbatim. These tests become runnable once
// the parent integrates the inline fragment; no second index implementation lives here.
const source=[
  between('const MARKET_TRADE_INDEXES', 'function marketFor('),
  between('function marketFor(', 'function craftWork('),
  between('function tradeCounts(', 'function jobYear('),
  between('function householdHeadsChanged(', 'function householdsOf(')
].join('\n');

function fixture(n=40){
  let Y=1,reads=0,distCalls=0;
  const context={MAPK:1,year:()=>Y,dist2d:(x,z,a,b)=>{distCalls++;return Math.hypot(x-a,z-b);},
    headsOf(s){reads++;return Object.entries(s.heads).map(([tr,n])=>({tr,n})).flatMap(x=>Array.from({length:x.n},()=>({tr:x.tr})));},
    __setYear(y){Y=y;},__reads(){return reads;},__clearReads(){reads=0;},__distCalls(){return distCalls;},__clearDistCalls(){distCalls=0;}};
  runInNewContext(source+'\nglobalThis.__marketIndex=()=>MARKET_TRADE_INDEXES.get(W);',context);
  // Construct W and its settlement array in the VM realm so production native-array
  // admission checks see the same intrinsics as index.html.
  runInNewContext(`globalThis.W={settlements:[]};for(let i=0;i<${n};i++){const heads=i===4?{smith:1}:i===8?{smith:1}:i===20?{miller:1}:{};W.settlements.push({pos:{x:i*10,z:0},heads,_tcY:-1});}`,context);
  return {W:context.W,c:context};
}

test('production market index narrows candidates and retains settlement tie order',()=>{
  const {W,c}=fixture();c.tradeCounts(W.settlements[6]);c.__clearReads();
  assert.deepEqual(Array.from(c.marketFor(W.settlements[6],'smith')),[4,Math.exp(-20/1200)]);
  assert.equal(c.__reads(),W.settlements.length-1,'the first index build counts other settlements once');
  assert.deepEqual(Array.from(c.__marketIndex().byTrade.get('smith')),[W.settlements[4],W.settlements[8]]);
  c.__clearReads();
  c.__clearDistCalls();
  assert.deepEqual(Array.from(c.marketFor(W.settlements[39],'smith')),[8,Math.exp(-310/1200)]);
  assert.equal(c.__reads(),0,'a warm query does not recalculate settlements');
  assert.equal(c.__distCalls(),2,'the lookup measures only the indexed smith candidates');
  c.__clearReads();c.__clearDistCalls();c.marketFor(W.settlements[10],'miller');
  assert.equal(c.__reads(),0,'a different trade reuses the year index');
  assert.equal(c.__distCalls(),1,'the miller query measures only its indexed candidate');
});

test('head changes rebuild membership while existing year-cached quotes remain stable',()=>{
  const {W,c}=fixture(),s=W.settlements[0];c.tradeCounts(s);
  const old=Array.from(c.marketFor(s,'smith'));
  W.settlements[4].heads={};W.settlements[8].heads={};W.settlements[20].heads={smith:1};
  c.householdHeadsChanged(W.settlements[4]);c.householdHeadsChanged(W.settlements[8]);c.householdHeadsChanged(W.settlements[20]);
  assert.deepEqual(Array.from(c.marketFor(s,'smith')),old,'the year-scoped quote cache is preserved');
  c.tradeCounts(W.settlements[1]);
  assert.deepEqual(Array.from(c.marketFor(W.settlements[1],'smith')),[20,Math.exp(-190/1200)],'an uncached pair sees changed trades');
});

test('year rollover rebuilds both the trade index and quote cache',()=>{
  const {W,c}=fixture(),s=W.settlements[0];c.tradeCounts(s);c.marketFor(s,'smith');
  W.settlements[4].heads={};W.settlements[20].heads={smith:1};c.__setYear(2);c.tradeCounts(s);
  assert.deepEqual(Array.from(c.marketFor(s,'smith')),[8,Math.exp(-80/1200)]);
});

test('settlement reordering falls back to the production scan',()=>{
  const {W,c}=fixture();c.tradeCounts(W.settlements[0]);c.marketFor(W.settlements[0],'smith');
  W.settlements.reverse();
  const sourceTown=W.settlements[0];c.tradeCounts(sourceTown);
  const quote=c.marketFor(sourceTown,'smith');
  assert.deepEqual(Array.from(quote),[W.settlements.indexOf(W.settlements.find(o=>o.heads.smith&&o.pos.x===80)),Math.exp(-310/1200)]);
});

test('a cold origin takes the original scan without warming its trade cache',()=>{
  const {W,c}=fixture(),origin=W.settlements[0];
  const quote=c.marketFor(origin,'smith');
  assert.equal(quote[0],4);
  assert.equal(origin._tc,undefined);
  assert.equal(origin._tcY,-1);
  assert.equal(c.__reads(),W.settlements.length-1,'the original scan skips tradeCounts(origin)');
});

test('production count writes and annual head changes notify the index',()=>{
  const tradeCounts=between('function tradeCounts(', 'function jobYear(');
  const seed=between('function seedHousehold(', 'function pickK(');
  const tick=between('function tickHouseholds(', 'function workOf(');
  assert.match(tradeCounts,/marketTradeIndexRecord\(W,s,c\)/);
  assert.match(seed,/marketTradeIndexRecord\(W,s,s\._tc\)/);
  assert.match(tick,/s\._tcY=-1;marketTradeIndexInvalidate\(\);/);
});
