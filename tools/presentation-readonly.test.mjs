import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const line=name=>source.match(new RegExp(`^function ${name}\\([^\\n]+`,'m'))?.[0];
const priceStart=source.indexOf('function price0(s,g){');
const priceEnd=source.indexOf('\n}',priceStart)+2;

test('presentation population and beast quote read invalid ledgers without warming or mutating them',()=>{
  const ctx=vm.createContext({GOODBASE:{sheep:4},NEED:{sheep:0.01},LU:{sheep:1},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),W:{settlements:[]}});
  vm.runInContext([line('detailPopulation'),line('detailPrice'),line('realmPop'),source.slice(priceStart,priceEnd)].join('\n'),ctx);
  const s={_populationReady:true,_popValid:false,_popTotal:999,_want:Object.freeze({sheep:2}),stores:Object.freeze({sheep:0})};
  const population=new Map([[s,31]]),households=Object.freeze([{population}]);s.households=households;Object.defineProperty(s,'pop',{get(){throw Error('presentation read warmed canonical population');}});Object.freeze(s);
  assert.equal(ctx.detailPopulation(s),31);
  assert.ok(ctx.detailPrice(s,'sheep')>0);
  assert.equal(s._popValid,false);assert.equal(s._popTotal,999);assert.equal(Object.hasOwn(s,'px'),false);
  const empty={_populationReady:true,_popValid:false};Object.defineProperty(empty,'pop',{get(){throw Error('initialized empty ledger fell back to pop');}});Object.freeze(empty);
  assert.equal(ctx.detailPopulation(empty),0);assert.equal(empty._popValid,false);
  assert.equal(ctx.detailPopulation({pop:17}),17);
  const legacy=Object.freeze([{pop:17},{pop:23}].map(Object.freeze));ctx.W.settlements=legacy;
  assert.equal(ctx.realmPop(),40);assert.equal(ctx.realmPop(s=>s.pop*2),80);
  assert.deepEqual(legacy.map(s=>Object.keys(s)),[['pop'],['pop']]);
});
