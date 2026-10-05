import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(angle=0){const cs=Math.cos(angle),sn=Math.sin(angle),world=(x,z)=>({x:x*cs-z*sn,z:x*sn+z*cs}),local=(x,z)=>({x:x*cs+z*sn,z:-x*sn+z*cs});
  const b={...world(-3,15),rot:Math.PI/2-angle,w:10.4,d:12,arch:'mill',state:'sound',millWater:{side:0,offset:7,y:6}},L={poly:[world(-30,-10),world(0,-10),world(0,10),world(-30,10)],y:6,dam:{...world(0,0),a:Math.PI+angle,w:20}},s={buildings:[b],lake:L};
  const wet=(x,z)=>{const p=local(x,z);return p.x>=-30&&p.x<=0&&Math.abs(p.z)<=10;};
  const C=vm.createContext({Math,dist2d:(x,z,a,c)=>Math.hypot(x-a,z-c),hAt:(x,z)=>local(x,z).x<=0?4:2,inPoly:(_,x,z)=>wet(x,z),
    riverDrawAt:(x,z)=>local(x,z).x<=0?4.22:2.22,riverAt:()=>({a:world(-30,0),b:world(30,0),hw:10,y:20}),rng:()=>assert.fail('render hydraulics cannot consume simulation RNG')});
  vm.runInContext(['millOutletPlan','millWheelCentre','millInlet','millSluiceSlots'].map(extract).join('\n'),C);return{C,s,b,wet,local};}
for(const angle of[0,Math.PI/4,Math.PI/2])test('wheel and falling inlet occupy the downstream drop at angle '+angle,()=>{
  const {C,s,b,wet,local}=fixture(angle),before=JSON.stringify(s),p=C.millOutletPlan(s,b,b.millWater,7),inlet=C.millInlet(p);
  assert.equal(wet(p.x,p.z),false);assert.equal(wet(p.source.x,p.source.z),true);assert.ok(local(p.tail.x,p.tail.z).x>local(p.x,p.z).x);
  assert.ok(p.head>0.65);assert.ok(Math.abs(inlet.y-C.millWheelCentre(p))<4);assert.ok(Math.abs(Math.hypot(inlet.x-p.x,inlet.z-p.z)**2+(inlet.y-C.millWheelCentre(p))**2-16)<1e-8);
  assert.ok(C.millSluiceSlots(s).length);assert.equal(JSON.stringify(s),before);
});
