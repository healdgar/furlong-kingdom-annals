// Real production transaction paths; slow independent graph comparison stays in tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm} from './ownership-fixture.mjs';
import {transformWrites} from './game-write-transform.mjs';

const runtime=fs.readFileSync(new URL('./game-write-log.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const contracts=Object.fromEntries(['push','pop','shift','unshift','splice','sort','reverse','fill','copyWithin','set','add','delete','clear','defineProperty','defineProperties','assign','setPrototypeOf'].map(n=>[n,'fixture: production data/native paths']));
const compile=source=>transformWrites(source,{nativeContracts:contracts}).code;
function pair(options={},setup=''){
  const a=realm(options),b=realm({...options,bootstrap:runtime+'\nconst GLOG=new GameWriteLog({retainRecords:true});',transformSource:compile});
  if(setup){a.eval(setup);b.eval(setup);}
  b.eval('for(const p of [OwnedMarket.prototype,HouseholdPopulation.prototype])for(const k of ["set","delete","clear"])GLOG.allow(p[k]);');
  b.eval('GLOG.snapshot({W,s,H,MOD});const REDUCER=new GameWriteReducer();let REDUCED=0;');
  return {a,b,step(code){a.eval(code);b.eval(compile(code));const actual=b.eval('({W,s,H,MOD})'),replayed=b.eval('while(REDUCED<GLOG.records.length)REDUCER.apply(GLOG.records[REDUCED++]);REDUCER.root');sameGraph(actual,replayed);sameGraph(a.eval('({W,s,H,MOD})'),actual);return b.eval('GLOG.records.length');}};
}
function sameGraph(a,b){
  const left=new Map(),right=new Map();
  function walk(a,b,path){
    // Existing pantry Proxy exposes a computed key set from _owners. Its backing
    // ledgers below are canonical; rebuilding this facade is a separate contract.
    if(path.endsWith('._lard'))return;
    assert.equal(typeof b,typeof a,path+' type');
    if(a===null||typeof a!=='object'&&typeof a!=='function'){assert.ok(Object.is(a,b),path+' value');return;}
    if(typeof a==='function')return; // analysis keeps callable references inert; executable hydration is separate.
    if(left.has(a)){assert.equal(left.get(a),b,path+' shared identity');return;}
    assert.ok(!right.has(b),path+' distinct identity');left.set(a,b);right.set(b,a);
    const tag=Object.prototype.toString.call(a);assert.equal(Object.prototype.toString.call(b),tag,path+' native kind');
    if(ArrayBuffer.isView(a)){assert.equal(b.byteOffset,a.byteOffset,path+' offset');assert.equal(b.byteLength,a.byteLength,path+' length');walk(a.buffer,b.buffer,path+'.buffer');}
    else if(tag==='[object ArrayBuffer]')assert.deepEqual([...new Uint8Array(b)],[...new Uint8Array(a)],path+' bytes');
    else if(tag==='[object Map]'){const av=[...Map.prototype.entries.call(a)],bv=[...Map.prototype.entries.call(b)];assert.equal(bv.length,av.length,path+' map size');av.forEach(([k,v],i)=>{walk(k,bv[i][0],path+'.key'+i);walk(v,bv[i][1],path+'.value'+i);});}
    else if(tag==='[object Set]'){const av=[...Set.prototype.values.call(a)],bv=[...Set.prototype.values.call(b)];assert.equal(bv.length,av.length,path+' set size');av.forEach((v,i)=>walk(v,bv[i],path+'.set'+i));}
    const ak=Reflect.ownKeys(a),bk=Reflect.ownKeys(b);assert.deepEqual(bk,ak,path+' own keys/order');
    for(const k of ak){const ad=Object.getOwnPropertyDescriptor(a,k),bd=Object.getOwnPropertyDescriptor(b,k);assert.equal(bd.enumerable,ad.enumerable,path+'.'+String(k)+' enumerable');assert.equal(bd.configurable,ad.configurable,path+'.'+String(k)+' configurable');assert.equal('value'in bd,'value'in ad,path+'.'+String(k)+' descriptor');if('value'in ad){assert.equal(bd.writable,ad.writable,path+'.'+String(k)+' writable');walk(ad.value,bd.value,path+'.'+String(k));}else{assert.equal(typeof bd.get,typeof ad.get,path+'.'+String(k)+' get');assert.equal(typeof bd.set,typeof ad.set,path+'.'+String(k)+' set');}}
  }
  walk(a,b,'root');
}
test('actual household population writes and provisioned hunger replay exactly',()=>{
  const p=pair({households:2,cash:0,grain:10,fish:0},'ownershipTick();H[0]._debt=foodYr()*.25;H[1]._debt=foodYr()*.25;MOD.mort=1;');
  p.step("mkt(s,'grain').set('crown',0);addHeld(s,H[0],'grain',10);tickPopulation();");
  assert.ok(p.b.eval('householdAccount(H[0]).population.get(s)>householdAccount(H[1]).population.get(s)'));
});
test('child household formation, marriage and inherited title retain exact identities',()=>{
  const setup="H[0].sx='f';H[1].sx='m';H[1].ma=H[0];H[1].age=20;H[2].sx='f';H[3].sx='f';H[3].ma=H[2];H[3].age=20;H[0].w=100;H[2].w=200;ownershipTick();s.furl=[{k:0,own:1,wk:1,ten:'free'}];bindPropertyRights(s);";
  const p=pair({households:4,cash:0},setup);p.step('marryHouseholds(H[1],H[3]);');p.step('inherit(H[0]);H[0].dead=true;');
  assert.equal(p.b.coins(),300);
});
test('borrowing, creditor repayment and movable estate division replay exact ordered effects',()=>{
  const p=pair({households:3,cash:0},'H[0].kids=[H[1],H[2]];H[1].pa=H[0];H[2].pa=H[0];H[1].own=H[2].own=true;H[0].w=80;W.treasury=100;ownershipTick();');
  p.step('borrow(s,H[0],10);');p.step('inherit(H[0]);H[0].dead=true;');assert.equal(p.b.coins(),180);
});
test('tracked raw alias writes after unlink and reattach are retained',()=>{
  const p=pair({households:2},'ownershipTick();');p.step('const detached=W.households;W.households=null;detached.set("detached",{population:new Map([[s,3]])});W.households=detached;');
});
