import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const context=vm.createContext({clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
vm.runInContext(source.slice(source.indexOf('function stepGrazingFlock('),source.indexOf('function animateHerds(')),context);
const flock=()=>({k:'sheep',seed:4,c0:{x:0,z:0},cx:0,cz:0,mem:Array.from({length:12},(_,i)=>({x:i%4*3-4.5,z:(i/4|0)*3-3,ox:i%4*3-4.5,oz:(i/4|0)*3-3,ph:i*0.53,rot:i*0.4,coat:i/12,walk:0,graze:0}))});
test('paused flocks do not drift, turn or graze',()=>{
  const fl=flock(),before=JSON.stringify(fl);for(let i=0;i<100;i++)context.stepGrazingFlock(fl,0,()=>true);assert.equal(JSON.stringify(fl),before);
});
test('animals have distinct movement and grazing pauses rather than translated fixed offsets',()=>{
  const fl=flock(),start=structuredClone(fl.mem);for(let i=0;i<200;i++)context.stepGrazingFlock(fl,0.1,()=>true);
  const moves=fl.mem.map((a,i)=>Math.hypot(a.x-start[i].x,a.z-start[i].z));assert.ok(Math.max(...moves)-Math.min(...moves)>1);
  assert.ok(fl.mem.some(a=>a.graze>0.7));assert.ok(fl.mem.some(a=>a.walk>0.7));
});
test('flocks respect both field fences and excluded wet ground',()=>{
  const fl=flock(),valid=(x,z)=>Math.abs(x)<9&&Math.abs(z)<8&&x*x+z*z>1;
  for(let i=0;i<1800;i++)context.stepGrazingFlock(fl,0.1,valid);
  for(const a of fl.mem){assert.ok(valid(a.x,a.z));assert.ok(Number.isFinite(a.rot));}
});
test('crowded animals separate and turn at a bounded rate',()=>{
  const fl=flock();for(const a of fl.mem){a.x=0;a.z=0;}let maxTurn=0;
  for(let i=0;i<300;i++){const before=fl.mem.map(a=>a.rot);context.stepGrazingFlock(fl,0.1,()=>true);fl.mem.forEach((a,j)=>maxTurn=Math.max(maxTurn,Math.abs(a.rot-before[j])));}
  assert.ok(maxTurn<=0.140001);assert.ok(fl.mem.some(a=>Math.hypot(a.x,a.z)>2));
});
const growthContext=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('const HERD_MATURE_DAYS='),source.indexOf('function herdVisualBirth(')),growthContext);
test('newborns grow with simulation age, reaching species-specific adult sizes without overshoot',()=>{
  for(const [k,maturity]of Object.entries({sheep:300,cattle:540,horses:720,swine:180})){
    const size=age=>growthContext.animalGrowth(k,100,100+age);
    assert.equal(size(-20),0.45);assert.equal(size(0),0.45);assert.equal(size(maturity),1);assert.equal(size(maturity*2),1);
    assert.ok(size(maturity*0.5)>size(maturity*0.25));assert.ok(size(maturity*0.5)<1);
  }
  assert.ok(growthContext.animalGrowth('swine',0,180)>growthContext.animalGrowth('horses',0,180));
});

test('grazing checks the rendered channel with room for the whole animal, even on dry survey cells',()=>{
  const wet=[],c=vm.createContext({W:{water:[0]},G:{land:{mask:[0,0,0,0]}},cIdx:()=>0,toCell:()=>0,renderedWaterNear:(x,z,pad)=>{wet.push(pad);return Math.abs(x)<4+pad;}});
  vm.runInContext(source.slice(source.indexOf('function grazeOK('),source.indexOf('/* the herds on the map: each town',source.indexOf('function grazeOK('))),c);
  assert.equal(c.grazeOK(0,0),false);assert.equal(c.grazeOK(5,0),false);assert.equal(c.grazeOK(8,0),true);assert.ok(wet.every(p=>p===2.5));
});
