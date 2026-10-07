// Map badges (placeMarker): in worker mode a host disbanded, a camp broken or an envoy home leaves W.armies/banditCamps/
// envoys without the screen ever calling dropMarker, so the badge it was drawn with must go when it is no longer placed.
// A stale badge kept its map-altitude size and stood, enormous, over the town where it was left (2026-10-07).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,`markers ${from}`);return source.slice(a,b);};
const block=slice('function placeMarker(','function buildAgents(');

function screen(dist=2000){
  const scene=new Set();
  class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}}
  class SpriteMaterial{constructor(o){Object.assign(this,o);this.disposed=false;}dispose(){this.disposed=true;}}
  class Sprite{constructor(material){this.material=material;this.position=new Vector3();this.scale=new Vector3(1,1,1);this.userData={};this.visible=true;}}
  const c=vm.createContext({G:{},THREE:{Sprite,SpriteMaterial,Vector3},scene:{add:o=>scene.add(o),remove:o=>scene.delete(o)},
    cam:{cur:{dist}},camera:{position:new Vector3(0,dist,0)},innerHeight:900,Math,Map});
  vm.runInContext(block,c);
  return {c,scene,frame(objs){for(const o of objs)c.placeMarker(o,'tex',o.x,0,o.z,26);c.sweepMarkers();}};
}

test('a badge no longer placed is taken off the map and its material freed',()=>{
  const s=screen(),host={x:10,z:10},camp={x:-40,z:5};
  s.frame([host,camp]);
  assert.equal(s.scene.size,2);
  const left=s.c.G.markers.get(camp);
  s.frame([host]); // the camp broke up in the worker; the screen only sees it gone from the list
  assert.equal(s.scene.size,1);
  assert.ok(!s.scene.has(left)&&left.material.disposed);
  assert.equal(s.c.G.markers.has(camp),false);
  s.frame([]);
  assert.equal(s.scene.size,0);
});

test('badges still placed persist, hidden up close, and keep their sprite between frames',()=>{
  const s=screen(),host={x:0,z:0};
  s.frame([host]);const sp=s.c.G.markers.get(host);
  assert.equal(sp.visible,true);
  s.c.cam.cur.dist=400;s.frame([host]); // zoomed in: hidden, not dropped
  assert.equal(s.c.G.markers.get(host),sp);
  assert.equal(sp.visible,false);
  assert.ok(s.scene.has(sp));
});
