import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const sourceRegion=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`missing source region ${from}`);return source.slice(a,b);};
const declaration=(html,name)=>{
  const re=new RegExp(`^function ${name}\\([\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m');
  const match=html.match(re);assert.ok(match,`missing function ${name}`);return match[0];
};

function fixture(hAt){
  let randomCalls=0;
  const math=Object.create(Math);math.random=()=>{randomCalls++;return 0.5;};
  const context={Math:math,MOTTEH:9,hAt,
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    lerp:(a,b,t)=>a+(b-a)*t,
    sstep:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}};
  vm.createContext(context);
  vm.runInContext(`${declaration(source,'motteSurface')}\n${declaration(source,'motteAccess')}`,context);
  return {access:context.motteAccess,randomCalls:()=>randomCalls};
}

const motte=()=>Object.freeze({x:0,z:0,r:20,summitR:4,topY:10,height:10,gateA:0});
const flat=()=>0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('motte access is deterministic, feasible, and returns the complete graded path',()=>{
  const m=motte(),{access,randomCalls}=fixture(flat),before=JSON.stringify(m);
  const path=access(m),again=access(m);
  assert.ok(path,'the controlled mound has a feasible approach');
  assert.deepEqual(JSON.parse(JSON.stringify(path)),JSON.parse(JSON.stringify(again)));
  assert.equal(randomCalls(),0,'access selection does not consume randomness');
  assert.equal(JSON.stringify(m),before,'access selection does not mutate the motte');
  assert.equal(path.path.length,50,'the saved line has the approach plus 49 fixed samples');
  assert.ok(path.maxGrade<=0.30,`reported grade ${path.maxGrade} exceeds the limit`);
  assert.ok(path.length>0);
  const measured=path.path.slice(1).reduce((sum,p,i)=>sum+distance(path.path[i],p),0);
  assert.ok(Math.abs(measured-path.length)<1e-9,'reported length matches the returned path');
  assert.equal(path.path[0].x,27);assert.equal(path.path[0].z,0);
  assert.ok(Math.abs(Math.hypot(path.path.at(-1).x,path.path.at(-1).z)-m.summitR)<1e-9);
});

test('natural high ground permits a shorter direct climb; either winding direction can win',()=>{
  const m=motte();
  const low=fixture(flat).access(m);
  const high=fixture((x,z)=>Math.max(0,9-0.1*Math.hypot(x,z))).access(m);
  assert.ok(low&&high);
  assert.ok(high.length<low.length,`raised natural ground should shorten access (${high.length} vs ${low.length})`);
  assert.equal(high.turns,0,'the high natural base makes the straight climb feasible');

  const east=fixture((_x,z)=>0.05*z).access(m);
  const west=fixture((_x,z)=>-0.05*z).access(m);
  assert.ok(east&&west);
  assert.equal(east.direction,1);
  assert.equal(west.direction,-1);
  assert.ok(east.maxGrade<=0.30&&west.maxGrade<=0.30);
});

test('a steep surrounding barrier rejects every candidate approach',()=>{
  const blocked=fixture((x,z)=>{
    const r=Math.hypot(x,z);
    return r>=19.9&&r<=27.1?30:0;
  }).access(motte());
  assert.equal(blocked,null,'the height wall makes each sampled connection too steep');
});

test('the selected access path becomes the motte street consumed by rendering and walking',()=>{
  const site=sourceRegion('const grade=slopeAt(toCell(x),toCell(z)),profile=','if(!foundLine)foundLine=');
  assert.match(site,/access=motteAccess\(profile\)/,'founding surveys the actual mound profile');
  assert.match(site,/if\(!access\)continue/,'infeasible climbs reject the candidate');
  assert.match(site,/best=\{[^}]*access,/,'the selected path is retained with its chosen site');
  assert.match(site,/addStreet\(resample\(best\.access\.path,3,true\),2\.2,'lane',\{straight:true,castlePath:true,earthwork:'motte'\}\)/,
    'the selected samples, not a separately generated spiral, are saved as the earthwork street');

  const renderer=sourceRegion('for(const s of W.settlements){\n    const pr=s.paveR||0;', '  { /* junctions:');
  assert.match(renderer,/for\(const st of s\.streets\|\|\[\]\)/);
  assert.match(renderer,/st\.earthwork==='bailey'\?s\.bailey:s\.motte/,'rendering drapes the saved motte street on the motte surface');
  const walker=declaration(source,'streetGraph');
  assert.match(walker,/for\(const st of s\.streets\|\|\[\]\)/);
  assert.match(walker,/for\(const run of fortStreetRuns\(s,st\)\)/,'the walking graph consumes the same canonical saved street');
});
