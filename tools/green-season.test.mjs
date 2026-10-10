import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(process.env.FURLONG_TEST_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const declaration=(html,name)=>{
  const re=new RegExp(`^function ${name}\\([\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m');
  const match=html.match(re);assert.ok(match,`missing function ${name}`);return match[0];
};
const region=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`missing source region ${from}`);return source.slice(a,b);};

function makePlaces(){
  const colors={r:0,g:0,b:0},context={PLN:8,C1:{setHex(hex){colors.r=((hex>>16)&255)/255;colors.g=((hex>>8)&255)/255;colors.b=(hex&255)/255;},...colors},
    hAt:(x,z)=>0.1*x-0.05*z,terrNormal:()=>[0,1,0]};
  vm.createContext(context);
  vm.runInContext(`${declaration(source,'newAcc')}\n${declaration(source,'placeMesh')}`,context);
  const place=kind=>({x:3,z:-4,kind,r:Array(8).fill(5)});
  const green=place('green'),market=place('market'),greenBefore=JSON.stringify(green),marketBefore=JSON.stringify(market);
  const a=context.newAcc(),b=context.newAcc();
  context.placeMesh(a,green,0.32,()=>0x778866);context.placeMesh(b,market,0.32,()=>0x998877);
  return {a,b,green,market,greenBefore,marketBefore};
}

test('only common-green vertices receive the grass tag; place projection does not alter canonical records',()=>{
  const {a,b,green,market,greenBefore,marketBefore}=makePlaces();
  assert.equal(a.grass.length,a.p.length/3);
  assert.equal(b.grass.length,b.p.length/3);
  assert.ok(a.grass.every(v=>v===1),'every green center and boundary vertex carries the green tag');
  assert.ok(b.grass.every(v=>v===0),'market vertices remain on the paved/material path');
  assert.equal(JSON.stringify(green),greenBefore);
  assert.equal(JSON.stringify(market),marketBefore);
});

test('the green tag reaches the seasonal road material with an untagged-road fallback',()=>{
  const mesh=declaration(source,'accMesh'),shader=declaration(source,'roadMaterial'),surface=region('const SURFACE_GLSL=`','function surfaceDetail');
  assert.match(mesh,/acc\.grass\[i\]===undefined\)acc\.grass\[i\]=0/,'ordinary roads default to non-grass');
  assert.match(mesh,/setAttribute\('aGrass',new THREE\.Float32BufferAttribute\(acc\.grass,1\)\)/);
  assert.match(shader,/attribute float aGrass/);
  assert.match(shader,/vGrass=aGrass/);
  assert.match(shader,/float grass=step\(0\.5,vGrass\)/);
  assert.match(shader,/mix\(diffuseColor\.rgb\*mix\(miniatureDetail\(7\.,vRoadUV\/3\.\),miniatureDetail\(2\.,vRoadUV\/3\.\),pave\),green,grass\)/,
    'the tag limits seasonal grass coloring to green vertices');
  assert.match(shader,/uGroundSnow/,'green surfaces receive the existing snow tint');
  assert.match(shader,/seasonalVegetation\(miniatureDetail/);
  assert.match(surface,/uniform vec3 uSeasonGrass/);
  assert.match(surface,/uniform float uDormancy/);
  assert.match(surface,/seasonalVegetation\(vec3 detail\).*uDormancy/);
});
