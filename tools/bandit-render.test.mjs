import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  /* --- the townsfolk: real people'),end=html.indexOf('  /* --- birds ---',start);
assert.ok(start>0&&end>start);
const draw=html.slice(start,end);

test('camp rendering keeps one instance per live member across frames and preserves person picking',()=>{
  const s={pos:{x:2000,z:2000},radius:80,folk:[]},men=[{id:12,si:0,sx:'m'},{id:13,si:0,sx:'f'}],camp={id:4,x:0,z:0,men};
  const mesh=()=>({count:0,instanceMatrix:{count:160},instanceColor:{},setColorAt(){}});
  const G={citList:[],citIdx:[],citizens:mesh(),citKit:mesh(),campMeshes:new Map([[camp,{}]])};
  const c=vm.createContext({BACKGROUND:null,W:{clock:{day:0},settlements:[s],banditCamps:[camp]},G,cam:{cur:{dist:300,focus:{x:0,z:0}}},camera:{position:{x:0,z:0}},
    dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),hash01:()=>0.4,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),surfY:()=>10,setInst(){},
    THREE:{Color:class{multiplyScalar(){return this;}}}});
  vm.runInContext("const day=()=>W.clock.day;"+html.match(/^function displayFrac\([^\n]+/m)[0]+html.match(/^function displayDay\([^\n]+/m)[0],c);
  vm.runInContext(draw,c);assert.equal(G.citizens.count,2);
  vm.runInContext(draw,c);assert.equal(G.citizens.count,2);assert.equal(G.citKit.count,2);
  assert.ok(G.citIdx.every((x,i)=>x.p===men[i]&&x.s===s));
  men[0].dead=true;vm.runInContext(draw,c);assert.equal(G.citizens.count,1);assert.equal(G.citIdx[0].p,men[1]);
  camp.men=[];vm.runInContext(draw,c);assert.equal(G.citizens.count,0);assert.equal(G.citIdx.length,0);
});
