import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const current = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const baseline = execFileSync('git', ['show', '450d2b6:index.html'], { encoding: 'utf8', maxBuffer: 20e6 });
const core = source => {
  const a = source.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */');
  const b = source.indexOf('/* Runtime adapters for numeric commodity custody. */', a);
  assert.ok(a >= 0 && b > a, 'commodity engine markers exist');
  return source.slice(a, b);
};
const fn = (source, name) => {
  const match = source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`, 'm'));
  assert.ok(match, `${name} source exists`);
  return match[0];
};
function engine(source, extra = {}) {
  const context = vm.createContext({ ...extra });
  vm.runInContext(core(source), context);
  return context;
}
function runPlan(source) {
  const c = engine(source);
  return JSON.parse(vm.runInContext(`(()=>{
    const ownerId=o=>o==null?'unassigned':String(typeof o==='object'?o.id:o);
    const K=new CommodityBalanceLedger({realmId:3,day:0,ownerId});
    K.location('yard',{capacity:Infinity});K.location('store',{capacity:Infinity});K.location('cart',{capacity:Infinity,transit:true});
    K.adjust('yard','grain','house','held',0.3,'seed');
    K.adjust('store','grain','house','sale',0.2,'getter-seed');
    const entries=K.entries;let selectionCalls=0;K.entries=function(...args){selectionCalls++;return entries.apply(this,args);};
    const first=K.consume({location:'yard',good:'grain',owner:'house',availability:'held'},0.1,'bite');
    const optimizedSelectionCalls=selectionCalls;K.entries=entries;
    K.adjust('yard','grain','house','sale',1,'seed');K.adjust('store','grain','house','held',1e16,'seed');
    K.adjust('cart','grain','house','held',2,'dispatch');
    let overdraw='';try{K.consume({location:'yard',good:'grain',owner:'house',availability:'held'},5,'bad');}catch(e){overdraw=e.message;}
    const afterOverdraw=K.quantity('house','grain','held');
    const near=K.consume({location:'yard',good:'grain',owner:'house',availability:'held'},0.20000000000000004,'roundoff');
    const zero=K.consume({location:'yard',good:'missing',owner:'house',availability:'held'},0,'zero');
    let invalid='';try{K.consume({location:'yard',good:'grain',owner:'house',availability:'invalid'},0.1,'invalid');}catch(e){invalid=e.message;}
    let destination='';try{K.transfer({location:'yard',good:'grain',owner:'house',availability:'sale'},0.5,'other',{availability:'bad'});}catch(e){destination=e.message;}
    const afterInvalid=K.quantity('house','grain','sale');
    const arraySelector=[];arraySelector.location='yard';arraySelector.good='grain';arraySelector.owner='house';arraySelector.availability='sale';
    const arrayResult=K.consume(arraySelector,0.1,'array-selector');
    const hiddenSelector={};Object.defineProperty(hiddenSelector,'location',{value:'yard'});Object.defineProperty(hiddenSelector,'good',{value:'grain'});Object.defineProperty(hiddenSelector,'owner',{value:'house'});Object.defineProperty(hiddenSelector,'availability',{value:'sale'});
    const hiddenResult=K.consume(hiddenSelector,0.1,'hidden-selector');
    let getterReads=0;const getterSelector={good:'grain',owner:'house',availability:'sale'};Object.defineProperty(getterSelector,'location',{enumerable:true,get(){return ++getterReads===2?'store':'yard';}});
    const getterResult=K.consume(getterSelector,0.1,'getter-selector');
    const transit=K.consume({location:'cart',good:'grain',owner:'house',availability:'held'},1,'transit-eat');
    K.adjust('yard','grain','house','held',2,'reinsert');
    const order=[...K.entries({owner:'house',good:'grain'})].map(r=>r.location+'/'+r.availability);
    const held=K.quantity('house','grain','held');
    const event=K.settle(1);
    return JSON.stringify({first,optimizedSelectionCalls,overdraw,afterOverdraw,near,zero,invalid,destination,afterInvalid,arrayResult,hiddenResult,getterResult,getterReads,transit,order,held,event});
  })()`, c));
}

test('full-address plan keeps exact outcomes, rank order and preflight while skipping row selection', () => {
  const old = runPlan(baseline), next = runPlan(current);
  const { optimizedSelectionCalls: oldCalls, ...oldOutcome } = old;
  const { optimizedSelectionCalls: newCalls, ...newOutcome } = next;
  assert.deepEqual(newOutcome, oldOutcome);
  assert.ok(oldCalls > 0, 'baseline selects the row');
  assert.equal(next.optimizedSelectionCalls, 0, 'a complete row address bypasses entries()');
  assert.match(next.overdraw, /insufficient balance/);
  assert.match(next.invalid, /insufficient balance/);
  assert.match(next.destination, /invalid availability/);
  assert.equal(next.afterInvalid, old.afterInvalid, 'failed destination validation leaves source unchanged');
  assert.equal(next.arrayResult, old.arrayResult, 'enumerable array selector properties retain spread semantics');
  assert.equal(next.hiddenResult, old.hiddenResult, 'non-enumerable selector properties remain absent after snapshot');
  assert.equal(next.getterResult, old.getterResult, 'address getters use the same spread snapshot on both paths');
  assert.equal(next.getterReads, old.getterReads);
  assert.equal(next.zero, 0);
  assert.ok(next.near > 0 && next.near < 0.3);
  assert.ok(next.event && next.event.deltas.length > 0);
});

function runtimeContext(source, { volumeType = false } = {}) {
  const type = { capacity: 100, goods: ['grain'], protection: 0.65 };
  if (volumeType) type.volume = 2;
  const c = engine(source, {
    STORAGE_TYPES: { warehouse: type },
    W: { settlements: [] },
    storageRegisterOwner: o => o == null ? 'unassigned' : String(typeof o === 'object' ? o.id : o),
    storageOutcomeAssert: () => {},
    storageRoute: () => 1,
    day: () => 7,
    means: () => 1e9,
    acct: () => {},
    wages: () => {},
    buildWorks: () => {},
    lordAcct: () => 'crown',
  });
  vm.runInContext(fn(source, 'commodityFacilities') + '\n' + fn(source, 'commodityDestroy'), c);
  return c;
}
function runFacility(source, scenario = 'stable') {
  const c = runtimeContext(source, { volumeType: scenario === 'custom-volume' });
  return JSON.parse(vm.runInContext(`(()=>{
    const ownerId=o=>o==null?'unassigned':String(typeof o==='object'?o.id:o);
    const K=new CommodityBalanceLedger({realmId:0,ownerId});K.next=1;
    const b={arch:'warehouse',storageId:'store',x:10,z:20,state:'sound',tier:${scenario === 'shrink' ? 2 : 0},ownerId:'lord'};
    const s={storage:K,buildings:[b]};
    let locations=0,stats=0;const loc=K.location,used=K._usedStats;
    K.location=function(...a){locations++;return loc.apply(this,a);};
    K._usedStats=function(...a){stats++;return used.apply(this,a);};
    commodityFacilities(s);locations=0;stats=0;
    if(${JSON.stringify(scenario)}==='shrink')K.adjust('store','grain','house','held',150,'seed');
    commodityFacilities(s);
    const stable={locations,stats,used:K.used('store')};
    if(${JSON.stringify(scenario)}==='stable'){
      locations=0;stats=0;b.x=11;commodityFacilities(s);
    }
    if(${JSON.stringify(scenario)}==='shrink'){
      b.tier=0;locations=0;commodityFacilities(s);
    }
    if(${JSON.stringify(scenario)}==='custom-volume'){
      locations=0;stats=0;commodityFacilities(s);
    }
    const changed={locations,stats,used:K.used('store'),yard:K.total('grain')-K._quantityAt(K._facility('store'),'grain','house','held')};
    const event=K.settle(1);
    return JSON.stringify({stable,changed,event});
  })()`, c));
}

test('managed facility refresh skips unchanged default metadata but refit and changed metadata still settle exactly', () => {
  const old = runFacility(baseline), next = runFacility(current);
  assert.deepEqual({ stable: { used: next.stable.used }, changed: next.changed, event: next.event },
    { stable: { used: old.stable.used }, changed: old.changed, event: old.event });
  assert.equal(next.stable.used, 0);
  assert.equal(next.changed.locations, 1, 'position change still refreshes the facility record');
  const optimized = runFacility(current);
  assert.equal(optimized.stable.locations, 0, 'unchanged managed facility avoids K.location');
  assert.equal(optimized.stable.stats, 0, 'unchanged managed facility avoids occupancy recount');
  const oldShrink = runFacility(baseline, 'shrink'), newShrink = runFacility(current, 'shrink');
  assert.deepEqual({ changed: { locations: newShrink.changed.locations, used: newShrink.changed.used, yard: newShrink.changed.yard }, event: newShrink.event },
    { changed: { locations: oldShrink.changed.locations, used: oldShrink.changed.used, yard: oldShrink.changed.yard }, event: oldShrink.event });
  assert.equal(newShrink.changed.used, 100);
  assert.equal(newShrink.changed.yard, 50);
});

test('facility shrink and custom-volume refresh retain public capacity validation', () => {
  for (const source of [baseline, current]) {
    const c = engine(source);
    const result = JSON.parse(vm.runInContext(`(()=>{
      const K=new CommodityBalanceLedger();K.location('f',{capacity:10});K.adjust('f','grain','h','held',6,'seed');
      let shrink='';try{K.location('f',{capacity:5});}catch(e){shrink=e.message;}
      const V=new CommodityBalanceLedger();V.location('v',{capacity:10,volume:1});V.adjust('v','grain','h','held',6,'seed');
      V.location('v',{volume:2});let over='';try{V.location('v',{capacity:10,volume:2});}catch(e){over=e.message;}
      return JSON.stringify({shrink,over,used:V.used('v')});
    })()`, c));
    assert.match(result.shrink, /capacity reduction would overfill/);
    assert.match(result.over, /capacity reduction would overfill/);
    assert.equal(result.used, 12);
  }
  const old = runFacility(baseline, 'custom-volume'), next = runFacility(current, 'custom-volume');
  assert.deepEqual(next, old);
  assert.equal(next.changed.locations, 1, 'custom volume does not qualify for the unchanged fast path');
});

function runStorageTick(source, exposedDestination) {
  const c = runtimeContext(source);
  vm.runInContext(fn(source, 'commodityExposed') + '\n' + fn(source, 'commodityStorageTick'), c);
  const input = JSON.stringify({ exposedDestination });
  return JSON.parse(vm.runInContext(`(()=>{
    const ownerId=o=>o==null?'unassigned':String(typeof o==='object'?o.id:o);
    const K=new CommodityBalanceLedger({realmId:0,day:0,ownerId});K.next=1;
    const b={arch:'warehouse',storageId:'store',x:10,z:0,state:'sound',tier:0,ownerId:'lord',storagePublic:true};
    const s={pop:100,buildings:[b],storage:K,owner:0};W.settlements=[s];
    K.location('yard',{x:0,z:0,capacity:Infinity,exposed:true,protection:4});
    K.location('store',{building:b,x:10,z:0,...STORAGE_TYPES.warehouse,capacity:100,owner:'lord',public:true,active:true,exposed:${input}.exposedDestination});
    K.adjust('yard','grain',null,'unassigned',60,'produce');
    K.adjust('yard','grain','house','held',12,'harvest');
    commodityStorageTick(s);
    const event=K.settle(7);
    return JSON.stringify({report:s.storageReport,event,rows:[...K.entries({includeTransit:true})]});
  })()`, c));
}

test('reused exposed-row snapshot preserves report sum and settlement, including exposed destinations', () => {
  for (const exposedDestination of [false, true]) {
    assert.deepEqual(runStorageTick(current, exposedDestination), runStorageTick(baseline, exposedDestination));
  }
});
