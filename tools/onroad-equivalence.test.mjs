import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// onRoad passes over a road segment whose two ends both lie beyond reach on one side of the point (#15). Against the
// original (frozen from cfa6993) it must answer every ask the same, leave onRoad.reach the same and ask riverAt the same
// questions, for any roads, pads, waterOnly and points, NaN and huge coordinates included.
const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const frozen="function onRoad(x,z,pad,waterOnly=false){ // on a built highway; crossings require its centreline to enter water\n  // onRoad.reach: the furthest road looked at (each look may store that road's bounds), for the route memory\n  const R=W.roads||[];for(let i=0;i<R.length;i++){const r=R[i],P=r.open||r.path;if(!P||P.length<2)continue;const bb=r._bb||(r._bb=P.reduce((q,p)=>[Math.min(q[0],p.x),Math.min(q[1],p.z),Math.max(q[2],p.x),Math.max(q[3],p.z)],[1e9,1e9,-1e9,-1e9]));\n    const m=pad+6;if(x<bb[0]-m||x>bb[2]+m||z<bb[1]-m||z>bb[3]+m)continue;for(let k=1;k<P.length;k++)if(segDist(x,z,P[k-1],P[k])<pad+5){if(!waterOnly){if(i>onRoad.reach)onRoad.reach=i;return true;}const a=P[k-1],b=P[k],dx=b.x-a.x,dz=b.z-a.z,L=dx*dx+dz*dz||1,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/L,0,1);if(riverAt(a.x+dx*t,a.z+dz*t,0)){if(i>onRoad.reach)onRoad.reach=i;return true;}}}\n  if(R.length-1>onRoad.reach)onRoad.reach=R.length-1;return false;}";
const line=prefix=>{const i=source.indexOf(prefix);assert.ok(i>=0,prefix);return source.slice(i,source.indexOf('\n',i));};
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
function rng(seed){let x=seed>>>0;return()=>((x=Math.imul(x^x>>>15,0x2c1b3c6d)+0x297a2d39|0,x^=x>>>12,x=Math.imul(x,0x297a2d39),(x^x>>>15)>>>0)/4294967296);}
function realm(text,name){const ctx=vm.createContext({Math,Infinity,NaN});
  vm.runInContext(`${line('const clamp=')}\n${line('function segDist(')}\nvar W={roads:[]},ASKS=[],WET=new Set();function riverAt(x,z,pad){ASKS.push(x,z,pad);return WET.has(Math.round(x/7)*31+Math.round(z/7));}\n${text}\nonRoad.reach=-1;`,ctx);return ctx;}
test('every ask answers as the original, with the same reach and the same river questions',()=>{
  const cur=block('function onRoad(','\nonRoad.reach=-1;');assert.notEqual(cur,frozen,'onRoad has changed from the frozen text');
  let asks=0,hits=0,skippedRoads=0;
  for(let seed=1;seed<=40;seed++){const r=rng(seed*313),a=realm(frozen),b=realm(cur);
    const roads=[];for(let n=0;n<1+Math.floor(r()*8);n++){let x=(r()-.5)*4000,z=(r()-.5)*4000;const P=[];for(let k=0;k<2+Math.floor(r()*120);k++){x+=(r()-.5)*60;z+=(r()-.5)*60;const p={x,z};if(r()<.01)p.x=NaN;if(r()<.005)p.z=1e300;P.push(p);}
      roads.push(r()<.1?{open:P}:r()<.05?{path:[P[0]]}:{path:P});}
    for(const c of [a,b]){c.R=JSON.parse(JSON.stringify(roads,(k,v)=>Number.isNaN(v)?'NaN':v),(k,v)=>v==='NaN'?NaN:v);c.W.roads=c.R;}
    const wet=[];for(let i=0;i<300;i++)wet.push(Math.floor(r()*2000)-1000);for(const c of [a,b])for(const k of wet)c.WET.add(k);
    for(let q=0;q<400;q++){const R=roads[Math.floor(r()*roads.length)].path||roads[0].path||[{x:0,z:0}],p=R[Math.floor(r()*R.length)]||{x:0,z:0};
      const x=r()<.03?NaN:p.x+(r()-.5)*(r()<.5?20:400),z=p.z+(r()-.5)*(r()<.5?20:400),pad=[0,0.5,2,4,12][Math.floor(r()*5)],water=r()<.5;
      if(r()<.05)for(const c of [a,b])c.onRoad.reach=-1;
      for(const c of [a,b]){c.ASKS.length=0;Object.assign(c,{x,z,pad,water});}
      const oa=vm.runInContext('onRoad(x,z,pad,water)',a),ob=vm.runInContext('onRoad(x,z,pad,water)',b);asks++;if(oa)hits++;
      assert.equal(ob,oa,`seed ${seed} ask ${q}`);assert.equal(b.onRoad.reach,a.onRoad.reach,'reach');assert.deepEqual([...b.ASKS],[...a.ASKS],'river questions');
      // roads cached their bounds the same way
      assert.equal(JSON.stringify(b.R.map(r=>r._bb||null)),JSON.stringify(a.R.map(r=>r._bb||null)));}}
  assert.ok(asks>10000&&hits>asks/10&&hits<asks*0.9,`asks ${asks}, on a road ${hits}`);
});

// A host's bridge test passes riverPad (its fording clearance): only the river question at the road's nearest point
// widens; the 5 m reach and so the skip are unchanged. Against the original with that one question widened alike.
test('with riverPad, every ask answers as the original asking the river with the same pad',()=>{
  const cur=block('function onRoad(','\nonRoad.reach=-1;');
  const frozenPad=frozen.replace('function onRoad(x,z,pad,waterOnly=false){','function onRoad(x,z,pad,waterOnly=false,riverPad=0){').replace('riverAt(a.x+dx*t,a.z+dz*t,0)','riverAt(a.x+dx*t,a.z+dz*t,riverPad)');
  assert.notEqual(frozenPad,frozen,'the frozen text takes riverPad');
  let asks=0,hits=0;
  for(let seed=1;seed<=20;seed++){const r=rng(seed*977),a=realm(frozenPad),b=realm(cur);
    const roads=[];for(let n=0;n<1+Math.floor(r()*8);n++){let x=(r()-.5)*4000,z=(r()-.5)*4000;const P=[];for(let k=0;k<2+Math.floor(r()*120);k++){x+=(r()-.5)*60;z+=(r()-.5)*60;P.push({x,z});}roads.push({path:P});}
    for(const c of [a,b]){c.R=JSON.parse(JSON.stringify(roads));c.W.roads=c.R;}
    const wet=[];for(let i=0;i<300;i++)wet.push(Math.floor(r()*2000)-1000);for(const c of [a,b])for(const k of wet)c.WET.add(k);
    for(let q=0;q<400;q++){const R=roads[Math.floor(r()*roads.length)].path,p=R[Math.floor(r()*R.length)];
      const x=p.x+(r()-.5)*(r()<.5?20:400),z=p.z+(r()-.5)*(r()<.5?20:400),pad=[0,0.5,2][Math.floor(r()*3)],rp=[0,0.4,1,3][Math.floor(r()*4)];
      for(const c of [a,b]){c.ASKS.length=0;Object.assign(c,{x,z,pad,rp});}
      const oa=vm.runInContext('onRoad(x,z,pad,true,rp)',a),ob=vm.runInContext('onRoad(x,z,pad,true,rp)',b);asks++;if(oa)hits++;
      assert.equal(ob,oa,`seed ${seed} ask ${q}`);assert.equal(b.onRoad.reach,a.onRoad.reach,'reach');assert.deepEqual([...b.ASKS],[...a.ASKS],'river questions');}}
  assert.ok(asks>5000&&hits>0,`asks ${asks}, crossings ${hits}`);
});
