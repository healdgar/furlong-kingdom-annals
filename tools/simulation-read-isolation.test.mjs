import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const region=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`missing source region ${from}`);return source.slice(a,b);};

test('valuation read queries memoize derived land values without priming the simulation cache',()=>{
  const s={pos:{x:0,z:0},radius:64,pop:100,buildings:[],places:[],streets:[]};
  const b={s,x:3,z:4,w:8,d:6,tier:0,arch:'house',state:'sound'};s.buildings.push(b);
  const code=[
    'let QUERY_LAND_VALUES=null;',
    "const LVC=16,RESID=new Set(['house']);",
    source.match(/^const BIZ=.*$/m)?.[0],
    source.match(/^const TRADEISH=.*$/m)?.[0],
    source.match(/^function useOf\([\s\S]*?(?=^function |^const |^\/\*|$(?![\s\S]))/m)?.[0],
    region('function lvBin(', 'function lvAt('),
    source.match(/^function lvAt\([\s\S]*?(?=^function |^const |^\/\*|$(?![\s\S]))/m)?.[0],
    source.match(/^function propValue\([\s\S]*?(?=^function |^const |^\/\*|$(?![\s\S]))/m)?.[0],
    region('function workerOverlayQuery(mode){', 'function reconcileVisualList('),
    region('function simulationWorkerModel(){', 'function simulationWorkerRuntime(){'),
    '\n;globalThis.model=simulationWorkerModel();'
  ].join('\n');
  const c=vm.createContext({W:{bldList:[b],land:{F:[]},settlements:[s],war:null},s,b,landValue:()=>0,year:()=>1,day:()=>1,
    clamp:(v,a,z)=>Math.max(a,Math.min(z,v)),dist2d:(x,z,X,Z)=>Math.hypot(X-x,Z-z),inWalls:()=>false,
    worldHash:()=>'',MOD:{},STORAGE_OUTCOMES:{status:()=>({})}});
  vm.runInContext(code,c);

  const view=vm.runInContext("model.view('overlay',{mode:'value'})",c);
  assert.equal(view.buildings.length,1);
  assert.equal(s._lvf,undefined,'a read view must not prime the canonical annual cache');
  assert.equal(vm.runInContext('QUERY_LAND_VALUES',c),null,'the query-local memo must be restored after the view');

  const queryMemo=vm.runInContext('(()=>{QUERY_LAND_VALUES=new Map();const value=lvField(s);return [value,QUERY_LAND_VALUES.get(s)];})()',c);
  assert.equal(queryMemo[0],queryMemo[1],'repeated valuation reads share the request-local memo');
  assert.equal(s._lvf,undefined);
  vm.runInContext('QUERY_LAND_VALUES=null;lvField(s)',c);
  assert.ok(s._lvf,'the simulation retains its own canonical cache on a simulation read');
  assert.notEqual(s._lvf,queryMemo[0]);
});
