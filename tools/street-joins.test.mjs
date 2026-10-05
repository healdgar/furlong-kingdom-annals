import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function streetJoinArms('),source.indexOf('function rebuildRoadMesh(')),context);
const arm=(dx,dz,hw=3)=>({dx,dz,hw}),origin={x:0,z:0};
test('duplicate and subdivided street hits count as one branch',()=>{
  const two=context.streetJoinArms([arm(1,0),arm(2,0,4),arm(1,.04),arm(-1,0),arm(0,0)]);
  assert.equal(two.length,2);assert.equal(two[0].hw,4);
  assert.equal(context.streetJoinArms([...two,arm(0,1)]).length,3);
});
test('straight joins preserve both street widths without a bulb',()=>{
  const path=context.streetJoinPath(origin,[arm(1,0,3),arm(-1,0,5)]);
  for(const p of path){assert.equal(p.z,0);assert.equal(Math.abs(p.offset.x),0);assert.ok(Math.abs(p.offset.z)<=5);}
  assert.equal(Math.abs(path[0].offset.z),3);assert.equal(Math.abs(path[2].offset.z),5);
});
test('right-angle joins meet the actual street edges and leave the inner corner open',()=>{
  const path=context.streetJoinPath(origin,[arm(1,0),arm(0,1)]),middle=path[1];
  assert.equal(middle.offset.x,-3);assert.equal(middle.offset.z,-3);
  for(const p of path)for(const sign of [-1,1]){const x=p.x+p.offset.x*sign,z=p.z+p.offset.z*sign;
    assert.ok(x>=-3&&z>=-3);assert.ok(x<=3||z<=3,'paving must not fill the inner garden corner');}
});
test('join geometry rotates with streets; sharp turns have bounded mitres',()=>{
  const a=.71,c=Math.cos(a),s=Math.sin(a),rotate=p=>({x:p.x*c-p.z*s,z:p.x*s+p.z*c});
  const plain=context.streetJoinPath(origin,[arm(1,0),arm(0,1)]),turned=context.streetJoinPath(origin,[arm(c,s),arm(-s,c)]);
  for(let i=0;i<3;i++){const p=rotate(plain[i]),o=rotate(plain[i].offset);assert.ok(Math.hypot(p.x-turned[i].x,p.z-turned[i].z)<1e-9);assert.ok(Math.hypot(o.x-turned[i].offset.x,o.z-turned[i].offset.z)<1e-9);}
  const tight=context.streetJoinPath(origin,[arm(1,0),arm(Math.cos(.2),Math.sin(.2))]);
  assert.ok(Math.hypot(tight[1].offset.x,tight[1].offset.z)<=7.5+1e-9);
  for(const p of tight)assert.ok([p.x,p.z,p.offset.x,p.offset.z].every(Number.isFinite));
});
