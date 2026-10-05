import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,`missing ${name}`);let p=source.indexOf('{',start),depth=1;for(p++;depth;p++){if(source[p]==='{')depth++;else if(source[p]==='}')depth--;}return source.slice(start,p);}
function fixture(){
  const c=vm.createContext({});
  vm.runInContext(`let routeCalls=[];let facilities=[];let index={valid:true};
    function storageFacilityIndex(){return index;}
    function storageFacilityLocations(){return facilities.values();}
    function storageRoute(s,a,n){routeCalls.push([a.id,n.id]);return n.distance;}
    const K={revision:0,occupancy:new Map(),free(id,g){const n=facilities.find(n=>n.id===id);if(!n||!n.active||n.goods&&!n.goods.includes(g))return 0;this.occupancy.set(id,n.free);return n.free;}};
    const s={},yard={id:'yard'};const ownerA={id:'a'},ownerB={id:'b'};`,c);
  for(const name of ['storageCarriagePlan','storageCarriagePlanCurrent','storageCarriageNested','storageCarriageCandidates','storageCarriagePlanAfterMove'])vm.runInContext(fn(name),c);
  return c;
}
function evalJSON(c,expr){return JSON.parse(vm.runInContext(`JSON.stringify(${expr})`,c));}

test('candidate groups preserve finite route order, stable ties, and exact ownership/good/free admission',()=>{
  const c=fixture();vm.runInContext(`facilities=[
    {id:'tie-first',building:{},active:true,public:true,free:4,distance:40},
    {id:'private-a',building:{},active:true,public:false,owner:ownerA,free:4,distance:3},
    {id:'tie-second',building:{},active:true,public:true,free:4,distance:40},
    {id:'wrong-owner',building:{},active:true,public:false,owner:ownerB,free:4,distance:1},
    {id:'wrong-good',building:{},active:true,public:true,goods:['ore'],free:4,distance:2},
    {id:'full',building:{},active:true,public:true,free:0,distance:0},
    {id:'inactive',building:{},active:false,public:true,free:4,distance:0},
    {id:'not-building',active:true,public:true,free:4,distance:0},
    {id:'unreachable',building:{},active:true,public:true,free:4,distance:Infinity}
  ];const P=storageCarriagePlan(K),lot={owner:ownerA,good:'grain'};const out=storageCarriageCandidates(s,K,yard,lot,P);`,c);
  assert.deepEqual(evalJSON(c,"out.map(x=>[x.n.id,x.d])"),[['private-a',3],['tie-first',40],['tie-second',40]]);
  assert.equal(vm.runInContext('routeCalls.length',c),4);
  assert.deepEqual(evalJSON(c,"[...K.occupancy.keys()]"),['tie-first','private-a','tie-second','full','unreachable']);
});

test('source, good, and strict private-owner groups reuse routes and separate incompatible cargo',()=>{
  const c=fixture();vm.runInContext(`facilities=[{id:'f',building:{},active:true,public:false,owner:ownerA,free:10,distance:17},{id:'pub',building:{},active:true,public:true,free:10,distance:8}];const P=storageCarriagePlan(K),a={id:'yard'},one={owner:ownerA,good:'grain'};const first=storageCarriageCandidates(s,K,a,one,P);const again=storageCarriageCandidates(s,K,a,{owner:ownerA,good:'grain'},P);const otherOwner=storageCarriageCandidates(s,K,a,{owner:ownerB,good:'grain'},P);const otherGood=storageCarriageCandidates(s,K,a,{owner:ownerA,good:'ore'},P);const otherSource=storageCarriageCandidates(s,K,{id:'exposed:2'},one,P);`,c);
  assert.equal(vm.runInContext('first===again',c),true);
  assert.equal(vm.runInContext('first===otherOwner',c),false);
  assert.equal(vm.runInContext('first===otherGood',c),false);
  assert.equal(vm.runInContext('first===otherSource',c),false);
  assert.equal(vm.runInContext('routeCalls.length',c),4);
});

test('revision changes rebuild candidates and managed-index failure declines indexed selection',()=>{
  const c=fixture();vm.runInContext(`facilities=[{id:'first',building:{},active:true,public:true,free:5,distance:5}];const P=storageCarriagePlan(K),a={id:'yard'},l={owner:ownerA,good:'grain'};const first=storageCarriageCandidates(s,K,a,l,P);facilities.push({id:'late',building:{},active:true,public:true,free:5,distance:1});K.revision++;const rebuilt=storageCarriageCandidates(s,K,a,l,P);`,c);
  assert.deepEqual(evalJSON(c,"rebuilt.map(x=>x.n.id)"),['late','first']);
  vm.runInContext('index.valid=false',c);
  assert.equal(vm.runInContext('storageCarriageCandidates(s,K,a,l,P)',c),null);
});

test('finite long routes remain legal; no distance cutoff hides a viable facility',()=>{
  const c=fixture();vm.runInContext(`facilities=[{id:'far',building:{},active:true,public:true,free:1,distance:1e9}];const P=storageCarriagePlan(K),out=storageCarriageCandidates(s,K,yard,{owner:ownerA,good:'grain'},P);`,c);
  assert.deepEqual(evalJSON(c,"out.map(x=>[x.n.id,x.d])"),[['far',1e9]]);
});

test('NaN private owners retain strict equality exclusion and route keys retain baseline coercion',()=>{
  const c=fixture();vm.runInContext(`facilities=[{id:'private',building:{},active:true,public:false,owner:NaN,free:1,distance:1},{id:'public',building:{},active:true,public:true,free:1,distance:2}];const P=storageCarriagePlan(K),out=storageCarriageCandidates(s,K,yard,{owner:NaN,good:'grain'},P);`,c);
  assert.deepEqual(evalJSON(c,'out.map(x=>x.n.id)'),['public']);
  const d=fixture();vm.runInContext(`const id1={toString(){return 'shared'}},id2={toString(){return 'shared'}};facilities=[{id:id1,building:{},active:true,public:true,free:1,distance:3},{id:id2,building:{},active:true,public:true,free:1,distance:9}];const P=storageCarriagePlan(K),out=storageCarriageCandidates(s,K,yard,{owner:ownerA,good:'grain'},P);`,d);
  assert.deepEqual(evalJSON(d,'out.map(x=>x.d)'),[3,3]);
  assert.equal(vm.runInContext('routeCalls.length',d),1);
});
