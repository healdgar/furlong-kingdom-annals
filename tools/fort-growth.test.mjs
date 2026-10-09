import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>src.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
function fixture(){const C=vm.createContext({Math,Float32Array,lerp:(a,b,t)=>a+(b-a)*t,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b)});
  vm.runInContext(['rayPolyR','fortBaileyShape','wallRadAt','casRing','casR','castleKeepOut','castleRadius','castleContains','castleLotEdge','skirtCastles'].map(fn).join('\n')+`;const m={x:0,z:58,r:25},b={x:0,z:0,courtR:30};b.wallRad=fortBaileyShape(m,b);b.r=Math.max(...b.wallRad);const s={motte:m,bailey:b};W={settlements:[s]};C=castleKeepOut(s)[1];`,C);return C;}
test('land outside the short end of an elongated bailey is available despite lying inside its bounding circle',()=>{
  const C=fixture();assert.ok(C.C.r>90);assert.ok(C.castleRadius(C.C,-Math.PI/2)<32);assert.equal(C.castleContains(C.C,0,-45,4),false);assert.equal(C.castleContains(C.C,0,75,4),true);
});
test('an existing road beyond the real enclosure is not displaced to the bounding circle',()=>{
  const C=fixture(),p={x:0,z:-45};assert.deepEqual({...C.skirtCastles([p])[0]},p);
  const inside={x:0,z:-25},out=C.skirtCastles([inside])[0];assert.ok(out.z<-37&&out.z>-40);assert.equal(C.castleContains(C.C,out.x,out.z,6.9),false);
});
test('parcel clipping follows the actual short wall, and never clips a plot back to the far-end radius',()=>{
  const C=fixture(),E=C.castleLotEdge(C.C,0,-45,.9);assert.ok(E);assert.ok(E.nx*0+E.nz*-45>=E.c);assert.ok(E.c<33);assert.ok(E.c>30);
  assert.ok(E.nx*0+E.nz*0<E.c,'the protected yard lies on the excluded side');
});
test('outer curtains retain their true shape and add their actual offset',()=>{
  const C=fixture();vm.runInContext('s.cas={outer:16};C=castleKeepOut(s)[1]',C);assert.ok(C.castleRadius(C.C,-Math.PI/2)>46&&C.castleRadius(C.C,-Math.PI/2)<48);assert.equal(C.castleContains(C.C,0,-45),true);assert.equal(C.castleContains(C.C,0,-60),false);
});
test('round works keep the old radius and a road at the centre is moved to a finite point',()=>{
  const C=fixture();vm.runInContext('W={settlements:[{ward:{x:0,z:0,r:30}}]}',C);const q=C.skirtCastles([{x:0,z:0}])[0];assert.equal(Math.hypot(q.x,q.z),37);
  assert.equal(C.castleRadius({r:30},2),30);assert.equal(C.castleContains({x:0,z:0,r:30},31,0),false);
});
