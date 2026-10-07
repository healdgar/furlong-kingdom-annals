// A fault in one part of the day (#34): played, it throws as it always has; in a fault-hunting test run the part is recorded,
// the rest of the day still runs, and the first fault marks where the run stops being a baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=(start,end)=>{const i=source.indexOf(start);assert.ok(i>=0,start);const j=source.indexOf(end,i);assert.ok(j>i,end);return source.slice(i,j);};
const realm=()=>{const c=vm.createContext({errors:0,today:7});vm.runInContext('const day=()=>today,simErr=()=>{errors++};'+block('const SIM_FAULTS=','function simTick('),c);return c;};

test('played, a fault in a part throws and nothing is recorded',()=>{
  const c=realm();
  assert.throws(()=>vm.runInContext("simPart('tickMilitary',()=>{throw new TypeError('no sk')})",c),/no sk/);
  assert.equal(vm.runInContext('SIM_FAULTS.n',c),0);assert.equal(vm.runInContext('SIM_FAULTS.first',c),null);
});

test('in a test run the day goes on after a fault, and the first fault is kept',()=>{
  const c=realm();vm.runInContext('SIM_FAULTS.carry=true;globalThis.ran=[];',c);
  vm.runInContext("simPart('tickMilitary',()=>{throw new TypeError('no sk')});simPart('tickEconomy',()=>ran.push('economy'));today=8;simPart('tickMilitary',()=>{throw new TypeError('no sk')})",c);
  assert.deepEqual([...vm.runInContext('ran',c)],['economy'],'the parts after the fault still run');
  assert.equal(vm.runInContext('SIM_FAULTS.n',c),2);assert.equal(c.errors,2);
  assert.deepEqual({...vm.runInContext('SIM_FAULTS.first',c)},{day:7,part:'tickMilitary',error:'no sk'});
  assert.equal(vm.runInContext('SIM_FAULTS.list.length',c),1,'a repeated fault is listed once');
});

test('every part of the day runs under the guard, in the same order',()=>{
  const tick=block('function simTick(){','\n}\n');
  const bare=tick.split('\n').slice(4).join('\n').replace(/simPart\('[^']+',\(\)=>(?:\{[\s\S]*?\}\}\)|[^;]*?\)\));/g,'');
  assert.doesNotMatch(bare,/\btick[A-Z]\w*\(\)|ownershipTick\(\)|commoditySettleAll\(/,'no part of the day outside simPart');
});
