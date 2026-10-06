import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
for(const angle of[0,Math.PI/4,Math.PI/2])test('sluice follows the fitted mill feeder through the dam at angle '+angle,()=>{
  const cs=Math.cos(angle),sn=Math.sin(angle),world=(x,z)=>({x:x*cs-z*sn,z:x*sn+z*cs});
  const b={arch:'mill',state:'sound',millWater:{}},s={buildings:[b],lake:{dam:{...world(0,0),a:Math.PI+angle,w:20}}};
  let feed={a:world(-5,3),b:world(8,3)};
  const C=vm.createContext({Math,millWheelPose:()=>({feed})});vm.runInContext(extract('millSluiceSlots'),C);
  const before=JSON.stringify(s),slots=C.millSluiceSlots(s);assert.equal(slots.length,1);
  assert.ok(Math.abs(slots[0][0]-2.4)<1e-8);assert.ok(Math.abs(slots[0][1]-3.6)<1e-8);
  assert.equal(JSON.stringify(s),before);
  feed=null;assert.equal(C.millSluiceSlots(s).length,0);
  feed={a:world(-5,13),b:world(8,13)};assert.equal(C.millSluiceSlots(s).length,0);
  b.removed=true;feed={a:world(-5,3),b:world(8,3)};assert.equal(C.millSluiceSlots(s).length,0);
});
