import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Hosts sent home, hosts given orders, and what the annals say of them.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const s=html.indexOf(`function ${name}(`);assert.notEqual(s,-1,`missing ${name}`);const e=html.indexOf('\nfunction ',s+1);return html.slice(s,e<0?html.length:e);};
const dist2d=(x,z,a,b)=>Math.hypot(x-a,z-b);

function homeRealm(position){
  const settlements=[{owner:0,pos:{x:0,z:0}},{owner:0,pos:{x:1000,z:0}}];
  const c=vm.createContext({W:{settlements,armies:[],roads:[]},Math,dist2d,clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),day:()=>50,plyH:()=>-1,emit:()=>{},
    MARCH_MPD:400,COG_MPD:2800,PORT_DELAY:1200,armySimPos:()=>({...position}),armySetSettlement:(a,si)=>{a.at=si;},disbandArmy:a=>{a.gone=true;},
    route:()=>({poly:[{x:1000,z:0},{x:500,z:0},{x:0,z:0}],len:1000})});
  vm.runInContext(['armyLegs','armyRoadDeparture','routHome','goHome'].map(fn).join('\n'),c);return c;}

test('a host sent home from a camp in the field sets out from the camp, and leaves it behind',()=>{
  const c=homeRealm({x:700,z:300}),a={id:1,house:0,at:1,home:0,state:'idle',field:{x:700,z:300},name:'Host'};c.a=a;
  vm.runInContext('goHome(a,"the war is over")',c);
  assert.equal(a.state,'march');assert.deepEqual([a.poly[0].x,a.poly[0].z],[700,300],'from the camp');
  assert.deepEqual([a.poly[1].x,a.poly[1].z],[700,0],'onto the road');assert.equal(a.field,null,'the camp is struck');
  assert.ok(Math.abs(a.arriveDay-50-(300+700)/900)<1e-9,'as long as that way is');
});
test('a host at its town goes home by the road as before',()=>{
  const c=homeRealm({x:1000,z:0}),a={id:1,house:0,at:1,home:0,state:'idle',field:null,name:'Host'};c.a=a;
  vm.runInContext('routHome(a,"beaten")',c);
  assert.equal(a.state,'rout');assert.equal(a.poly.length,3);assert.equal(a.poly[0].x,1000);assert.equal(a.tf,null);assert.ok(Math.abs(a.arriveDay-50-1000/900)<1e-9);
});
