// The generated place boundary must follow clear, usable ground rather than
// merely preserving the same smooth radial stamp in every direction.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||path.join(ROOT,'index.html'),'utf8');
const start=source.indexOf('function placeFitRadii(');
assert.notEqual(start,-1,'index.html defines the pure placeFitRadii helper');
const end=source.indexOf('\nfunction ',start+1);
assert.notEqual(end,-1,'placeFitRadii is followed by another function');
const helper=source.slice(start,end);

const dist2d=(x,z,a,b)=>Math.hypot(x-a,z-b);
const makeFitter=()=>{
  const safeMath=Object.create(Math);
  safeMath.random=()=>{throw new Error('placeFitRadii must not consume RNG');};
  const context=vm.createContext({PLN:20,Math:safeMath,dist2d,
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x))});
  vm.runInContext(helper,context,{filename:'placeFitRadii.js'});
  return context;
};

// A finite rectangular terrain survey, with an oriented building footprint, a diagonal road
// corridor and a water pocket. clear() is the same kind of combined mask the
// layout pass supplies: every returned contour/subray must be usable.
const domain={x0:-34,x1:51,z0:-23,z1:29};
const building={x:22,z:12,w:11,d:7,rot:0.43};
const water={x0:-30,x1:-26,z0:-21,z1:-17};
const roadA={x:7,z:26},roadB={x:42,z:4},roadHalfWidth=2.4;
const pointSegDistance=(x,z,a,b)=>{
  const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2));
  return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
};
const inRect=(x,z,r)=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
const inObb=(x,z,b)=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rot),s=Math.sin(b.rot),lx=dx*c+dz*s,lz=-dx*s+dz*c;return Math.abs(lx)<=b.w/2&&Math.abs(lz)<=b.d/2;};
const clear=(x,z)=>x>=domain.x0&&x<=domain.x1&&z>=domain.z0&&z<=domain.z1&&
  !inObb(x,z,building)&&!inRect(x,z,water)&&pointSegDistance(x,z,roadA,roadB)>roadHalfWidth;
const point=(p,r,a)=>({x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r});
const radial=(r,a)=>{const f=((a/(Math.PI*2))%1+1)%1*r.length,i=Math.floor(f)%r.length,t=f-Math.floor(f);return r[i]*(1-t)+r[(i+1)%r.length]*t;};

test('boundary fitting is deterministic and does not draw outside clear ground',()=>{
  const c=makeFitter();
  const p={x:0,z:0,r:Array(20).fill(80)};
  const original={x:p.x,z:p.z,r:[...p.r]};
  c.p=p;c.clear=clear;
  const a=vm.runInContext('placeFitRadii(p,clear,1)',c,{timeout:2000});
  const b=vm.runInContext('placeFitRadii(p,clear,1)',c,{timeout:2000});
  assert.ok(Array.isArray(a),'a fitting centre in available ground returns radii');
  assert.equal(a.length,p.r.length);
  assert.deepEqual(Array.from(a),Array.from(b),'same inputs produce the same shape');
  assert.deepEqual(p,original,'fitting does not mutate the candidate');

  for(let k=0;k<a.length;k++){
    const angle=k/a.length*Math.PI*2,q=point(p,a[k],angle);
    assert.ok(clear(q.x,q.z),`radial boundary sample ${k} clears road, buildings, water and survey edge`);
  }
  // Check interpolated rays too: a polygon edge may not bridge a narrow
  // obstruction between the helper's stored radial samples.
  for(let k=0;k<a.length;k++)for(let j=1;j<8;j++){
    const angle=(k+j/8)/a.length*Math.PI*2,q=point(p,radial(a,angle),angle);
    assert.ok(clear(q.x,q.z),`subray ${k}:${j} remains on available ground`);
  }
  assert.ok(Math.max(...a.map((r,k)=>Math.abs(r-a[(k+10)%a.length])))>8,'obstacles and available ground produce an asymmetric contour');
  assert.ok(Math.max(...a)-Math.min(...a)>20,'the fitted footprint is elongated rather than a circular stamp');
});

test('rectangular available ground yields directional radii instead of a round stamp',()=>{
  const c=makeFitter(),p={x:0,z:0,r:Array(20).fill(80)};
  const rectangular=(x,z)=>x>=domain.x0&&x<=domain.x1&&z>=domain.z0&&z<=domain.z1;
  c.p=p;c.rectangular=rectangular;
  const r=vm.runInContext('placeFitRadii(p,rectangular,1)',c,{timeout:2000});
  assert.ok(Array.isArray(r));
  assert.ok(r[0]>r[10]+8,'wider east side is reflected in the radii');
  assert.ok(r[5]>r[15]+4,'deeper northern side is reflected in the radii');
});

test('a blocked centre has no feasible place footprint',()=>{
  const c=makeFitter();
  const blocked=()=>false,p={x:0,z:0,r:Array(20).fill(24)};
  c.p=p;c.blocked=blocked;
  const result=vm.runInContext('placeFitRadii(p,blocked,1)',c,{timeout:2000});
  assert.equal(result,null);
});

test('nearby road and water retain a feasible footprint when more than 3 m remains',()=>{
  const c=makeFitter(),p={x:0,z:0,r:Array(20).fill(80)};
  const nearWater={x0:-13,x1:-5,z0:-10,z1:-4};
  const nearRoadA={x:-30,z:31},nearRoadB={x:44,z:-4};
  const nearbyClear=(x,z)=>x>=domain.x0&&x<=domain.x1&&z>=domain.z0&&z<=domain.z1&&
    !inObb(x,z,building)&&!inRect(x,z,nearWater)&&pointSegDistance(x,z,nearRoadA,nearRoadB)>roadHalfWidth;
  const waterClearance=Math.hypot(5,4);
  const roadClearance=pointSegDistance(0,0,nearRoadA,nearRoadB)-roadHalfWidth;
  assert.ok(waterClearance>3&&roadClearance>3,'both nearby obstructions leave more than the minimum radius');
  c.p=p;c.nearbyClear=nearbyClear;
  const fitted=vm.runInContext('placeFitRadii(p,nearbyClear,1)',c,{timeout:2000});
  assert.ok(Array.isArray(fitted),'the conservative sweep retains a feasible place around the blockers');
  assert.equal(fitted.length,p.r.length);
  assert.ok(Math.min(...fitted)>=3);
  for(let k=0;k<fitted.length;k++)for(let j=0;j<8;j++){
    const angle=(k+j/8)/fitted.length*Math.PI*2,q=point(p,radial(fitted,angle),angle);
    assert.ok(nearbyClear(q.x,q.z),`nearby-obstacle subray ${k}:${j} remains clear`);
  }
});
