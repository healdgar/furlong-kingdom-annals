import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))?.[0];
const church=(x)=>({arch:'temple',state:'sound',x,z:0,ch:{}});
function fixture(){
  const near=church(0),far=church(100),s={name:'Ashcombe',pos:{x:0,z:0},buildings:[near,far],folk:[],dead:[]};
  const p={id:7,si:0,bh:{x:91,z:0},sp:null},migrant={id:8,si:0,bh:{x:2,z:0},sp:null};
  const C=vm.createContext({p,migrant,W:{settlements:[s],travellers:[]},day:()=>20,ageYrs:()=>40,
    life:(p,t)=>(p.ev||(p.ev=[])).push([20,t]),dist2d:(x,z,a,b)=>Math.hypot(x-a,z-b),chOf:b=>b.ch,
    inherit:()=>{},nameUse:()=>{},invalidateFolkIndex:()=>{},archivePerson:p=>{p.dd=20;}});
  vm.runInContext(fn('dropPerson')+'\n'+fn('findPerson'),C);return {C,s,near,far,p,migrant};
}

test('deaths bind once to the nearest parish, while emigration leaves no town burial',()=>{
  const {C,s,near,far,p,migrant}=fixture();
  vm.runInContext("dropPerson(p,'Died');dropPerson(p,'Died again');dropPerson(migrant,'Left the realm, to seek a living abroad')",C);
  assert.equal(s.dead.length,1);assert.equal(s.dead[0],p);assert.equal(p.burial,far);
  assert.equal(far.ch.burials,1);assert.equal(near.ch.burials,undefined);
  const found=vm.runInContext('findPerson(7)',C);assert.equal(found.p,p);assert.equal(found.s,s);
  assert.equal(vm.runInContext('findPerson(8)',C),null);
});
