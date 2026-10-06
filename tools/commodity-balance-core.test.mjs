import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(process.env.FURLONG_TEST_SOURCE || new URL('../index.html', import.meta.url), 'utf8');
const coreStart = source.indexOf('/* BEGIN COMMODITY BALANCE ENGINE */');
const coreEnd = source.indexOf('/* Runtime adapters for numeric commodity custody. */', coreStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart, 'embedded production commodity engine markers exist');
const coreSource = source.slice(coreStart, coreEnd);
const context = vm.createContext({});
vm.runInContext(coreSource, context, { filename: process.env.FURLONG_TEST_SOURCE || 'index.html#commodity-engine' });
const CommodityBalanceLedger = context.CommodityBalanceLedger;
const make = options => new CommodityBalanceLedger(options);
const rows = ledger => [...ledger.entries({ includeTransit: true })];

test('consumption removes a balance once and rejects a repeated overdraw atomically', () => {
  const ledger = make(); ledger.location('yard', { capacity: 20 });
  const owner = { id: 'house-a' };
  ledger.adjust('yard', 'grain', owner, 'held', 7, 'harvest');
  assert.equal(ledger.consume({ owner, good: 'grain', availability: 'held' }, 4), 4);
  assert.equal(ledger.consume({ owner, good: 'grain', availability: 'held' }, 3), 3);
  assert.equal(ledger.quantity(owner, 'grain', 'held'), 0);
  assert.deepEqual(rows(ledger), []);
  ledger.adjust('yard', 'grain', owner, 'held', 2, 'harvest');
  assert.throws(() => ledger.consume({ owner, good: 'grain', availability: 'held' }, 3), /insufficient balance/);
  assert.equal(ledger.quantity(owner, 'grain', 'held'), 2);
});

test('settlement deltas replay initial balances and owner transfers without town-stock change', () => {
  const ledger = make({ realmId: 4 }); ledger.location('yard', { capacity: 100 });
  const owner = { id: 'merchant-1' };
  ledger.adjust('yard', 'grain', null, 'unassigned', 8, 'production');
  assert.equal(ledger.transfer({ location: 'yard', good: 'grain', owner: null, availability: 'unassigned', qty: 8 }, 3, owner,
    { availability: 'held', cause: 'purchase' }), 3);
  assert.equal(ledger.total('grain'), 8);
  const event = ledger.settle(30);
  assert.equal(event.version, 3);
  assert.equal(event.revision, 1);
  assert.equal(event.settlement, 4);
  const ids = event.deltas.map(d => `${d.location}/${d.good}/${d.owner}/${d.availability}`);
  assert.equal(new Set(ids).size, ids.length, 'one net record per balance key');
  const replay = new Map();
  for (const d of event.deltas) replay.set(`${d.location}/${d.good}/${d.owner}/${d.availability}`, d.before + d.delta);
  assert.deepEqual([...replay.values()].sort((a, b) => a - b), [3, 5]);
  assert.deepEqual(rows(ledger).map(r => [r.owner?.id || (r.owner == null ? 'unassigned' : r.owner), r.qty]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    [['merchant-1', 3], ['unassigned', 5]]);
});

test('custody transfer preserves quantity and enforces per-facility volume', () => {
  const ledger = make({ volumes: { timber: 2 } });
  ledger.location('yard', { capacity: 10, goods: ['timber'] });
  ledger.location('warehouse', { capacity: 4, goods: ['timber'] });
  const owner = 'parish';
  ledger.adjust('yard', 'timber', owner, 'sale', 3, 'production');
  assert.equal(ledger.used('yard'), 6);
  assert.equal(ledger.free('yard', 'timber'), 2);
  ledger.transfer({ location: 'yard', owner, good: 'timber', availability: 'sale' }, 2, owner,
    { location: 'warehouse', cause: 'carriage' });
  assert.equal(ledger.used('yard'), 2);
  assert.equal(ledger.used('warehouse'), 4);
  assert.equal(ledger.free('warehouse', 'timber'), 0);
  assert.equal(ledger.quantity(owner, 'timber', 'sale'), 3);
});

test('capacity rejection leaves both facilities and buffered balance deltas unchanged', () => {
  const ledger = make(); ledger.location('origin', { capacity: 10 }); ledger.location('full', { capacity: 2 });
  ledger.adjust('origin', 'grain', 'house', 'held', 5, 'production');
  assert.throws(() => ledger.transfer({ location: 'origin', owner: 'house', good: 'grain', availability: 'held' }, 3, 'house',
    { location: 'full' }), /capacity/);
  assert.equal(ledger.quantity('house', 'grain', 'held'), 5);
  assert.equal(ledger.used('full'), 0);
  assert.equal(ledger.settle(1).deltas.length, 1);
});

test('daily balances net from first before to latest after and revisions advance only on emitted settlements', () => {
  const ledger = make(); ledger.location('yard', { capacity: 20, x: 0 });
  assert.equal(ledger.settle(1).revision, 1, 'location creation is recorded');
  const owner = { id: 'h1' };
  ledger.adjust('yard', 'grain', owner, 'held', 10, 'harvest');
  ledger.adjust('yard', 'grain', owner, 'held', -2, 'spoilage');
  ledger.location('yard', { x: 5 });
  ledger.location('yard', { x: 9 });
  const event = ledger.settle(2);
  assert.equal(event.revision, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(event.deltas)), [{ location: 'yard', good: 'grain', owner: 'h1', availability: 'held', before: 0, after: 8, delta: 8 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(event.locations)), [{ id: 'yard', after: { capacity: 20, active: true, transit: false, volume: 1, volumes: {}, goods: null, x: 9 } }]);
  assert.deepEqual(JSON.parse(JSON.stringify(event.flows)), { harvest: { grain: 10 }, spoilage: { grain: -2 } });
  assert.ok(Object.isFrozen(event) && Object.isFrozen(event.deltas[0]));
  assert.equal(ledger.settle(3), null);
  assert.equal(ledger.settlementRevision, 2);
});

test('transit is excluded by default and explicit transit selectors can consume it', () => {
  const ledger = make(); ledger.location('cart', { capacity: Infinity, transit: true });
  ledger.location('yard', { capacity: 10 });
  ledger.adjust('cart', 'grain', 'house', 'held', 4, 'dispatch');
  ledger.adjust('yard', 'grain', 'house', 'transit', 2, 'dispatch');
  assert.equal(ledger.quantity('house', 'grain', 'held'), 0);
  assert.equal(ledger.quantity('house', 'grain', 'held', true), 4);
  assert.equal(ledger.total('grain'), 0);
  assert.equal(ledger.total('grain', true), 6);
  assert.equal([...ledger.entries({ location: 'cart' })].reduce((n, r) => n + r.qty, 0), 4);
  assert.equal(ledger.consume({ availability: 'transit', good: 'grain', owner: 'house' }, 1), 1);
  assert.equal(ledger.quantity('house', 'grain', 'transit', true), 1);
});

test('negative and non-finite quantities are rejected without balance changes', () => {
  const ledger = make(); ledger.location('yard', { capacity: 10 });
  assert.throws(() => ledger.adjust('yard', 'grain', 'house', 'held', -1), /insufficient balance/);
  assert.throws(() => ledger.adjust('yard', 'grain', 'house', 'held', NaN), /finite/);
  assert.throws(() => ledger.adjust('yard', 'grain', 'house', 'held', Infinity), /finite/);
  assert.throws(() => ledger.consume({ owner: 'house', good: 'grain' }, -1), /nonnegative/);
  assert.throws(() => ledger.transfer({ owner: 'house', good: 'grain' }, NaN, null), /nonnegative/);
  assert.deepEqual(rows(ledger), []);
});

test('char uses timber volume and an opaque location owner is rendered as a stable id', () => {
  const ledger = make({ volumes: { timber: 2, char: 2 } });
  const owner = { id: 'lord-2' }, building = { storageId: 'b-7' };
  const facility = ledger.location('yard', { capacity: 6, goods: ['timber'], owner, building, x: 12, exposed: true, protection: 4 });
  ledger.adjust('yard', 'timber', owner, 'held', 2, 'harvest');
  ledger.adjust('yard', 'char', owner, 'held', 1, 'conversion');
  assert.equal(ledger.used('yard'), 6);
  assert.equal(ledger.free('yard', 'char'), 0);
  assert.equal(ledger.total('timber'), 2);
  const event = ledger.settle(1);
  const location = event.locations.find(x => x.id === 'yard').after;
  assert.equal(location.ownerId, 'lord-2');
  assert.equal(location.storageId, 'b-7');
  assert.equal(facility.owner, owner);
  assert.equal(facility.building, building);
  assert.equal(facility.x, 12);
  assert.equal(facility.exposed, true);
  assert.equal(Object.keys(ledger).includes('ownerId'), false, 'owner callback remains outside enumerable authority');
});

test('intraday market clearing availability and event notes settle without per-operation journal rows', () => {
  const ledger = make(); ledger.location('yard', { capacity: 10 });
  ledger.adjust('yard', 'grain', 'seller', 'sale', 2, 'offer');
  ledger.transfer({ location: 'yard', owner: 'seller', good: 'grain', availability: 'sale' }, 2, null,
    { availability: 'market-cleared', cause: 'market' });
  ledger.transfer({ location: 'yard', owner: null, good: 'grain', availability: 'market-cleared' }, 2, 'buyer',
    { availability: 'held', cause: 'market' });
  ledger.event('construction-progress', null, 2, { owner: 'house-1', work: 'grange' });
  ledger.event('construction-progress', null, 3, { owner: 'house-1', work: 'grange' });
  const event = ledger.settle(7);
  assert.equal(event.revision, 1);
  assert.equal(event.deltas.length, 1, 'zero-net seller and clearing-pool rows are filtered');
  assert.deepEqual(JSON.parse(JSON.stringify(event.notes)), {
    'construction-progress': { count: 2, qty: 5, metadata: { owner: 'house-1', work: 'grange' } },
  });
  assert.equal(ledger.quantity('buyer', 'grain', 'held'), 2);
  assert.equal(ledger.quantity(null, 'grain', 'market-cleared'), 0);
});

test('durable assertion hook blocks every authority mutation before a partial write', () => {
  let blocked = false;
  const ledger = make({ assert: () => { if (blocked) throw new Error('journal fault'); } });
  ledger.location('yard', { capacity: 10 });
  ledger.adjust('yard', 'grain', 'house', 'held', 2);
  blocked = true;
  assert.throws(() => ledger.adjust('yard', 'grain', 'house', 'held', 1), /journal fault/);
  assert.throws(() => ledger.transfer({ owner: 'house', good: 'grain', availability: 'held' }, 1, 'other'), /journal fault/);
  assert.throws(() => ledger.consume({ owner: 'house', good: 'grain', availability: 'held' }, 1), /journal fault/);
  assert.throws(() => ledger.location('yard', { x: 10 }), /journal fault/);
  assert.throws(() => ledger.event('memo', null, 0, { note: 'x' }), /journal fault/);
  assert.throws(() => ledger.settle(1), /journal fault/);
  assert.equal(ledger.quantity('house', 'grain', 'held'), 2);
  assert.equal(ledger.facilities.get('yard').x, undefined);
});

test('failed settlement append retains pending deltas and does not consume a revision', () => {
  const ledger = make(); ledger.location('yard', { capacity: 5 });
  ledger.adjust('yard', 'grain', 'house', 'held', 2, 'production');
  assert.throws(() => ledger.settle(1, () => { throw new Error('append fault'); }), /append fault/);
  assert.equal(ledger.settlementRevision, 0);
  const event = ledger.settle(1);
  assert.equal(event.revision, 1);
  assert.equal(event.deltas.find(d => d.owner === 'house').after, 2);
});

test('derived capacity and quantity caches invalidate on balance and metadata changes', () => {
  const ledger = make({ volumes: { grain: 1 } });
  ledger.location('a', { capacity: 20, volumes: { grain: 1 } });
  ledger.location('b', { capacity: 20, volumes: { grain: 1 }, transit: true });
  const owner = 'house';
  ledger.adjust('a', 'grain', owner, 'held', 3, 'start');
  ledger.adjust('b', 'grain', owner, 'held', 2, 'start');
  assert.equal(ledger.used('a'), 3);
  assert.equal(ledger.quantity(owner, 'grain'), 3);
  assert.equal(ledger.total('grain'), 3);
  assert.equal(ledger.total('grain', true), 5);

  ledger.adjust('a', 'grain', owner, 'held', 4, 'add');
  assert.equal(ledger.used('a'), 7);
  assert.equal(ledger.quantity(owner, 'grain'), 7);
  ledger.location('a', { volumes: { grain: 2 } });
  assert.equal(ledger.used('a'), 14);
  ledger.location('b', { transit: false });
  assert.equal(ledger.quantity(owner, 'grain'), 9);
  assert.equal(ledger.total('grain'), 9);
  ledger.location('a', { transit: true });
  assert.equal(ledger.quantity(owner, 'grain'), 2);
  assert.equal(ledger.total('grain'), 2);
});

test('owner facility index restores canonical facility ordering after row deletion and re-addition', () => {
  const ledger = make();
  ledger.location('first', { capacity: Infinity });
  ledger.location('second', { capacity: Infinity });
  ledger.adjust('first', 'grain', 'house', 'held', 1e16, 'seed');
  ledger.adjust('second', 'grain', 'house', 'held', 1, 'seed');
  ledger.adjust('first', 'grain', 'house', 'sale', 1, 'seed');
  assert.equal(ledger.quantity('house', 'grain'), 1e16, 'canonical order rounds away the final unit');
  ledger.adjust('first', 'grain', 'house', 'held', -1e16, 'remove');
  ledger.adjust('first', 'grain', 'house', 'sale', -1, 'remove');
  assert.equal(ledger.quantity('house', 'grain'), 1);
  ledger.adjust('first', 'grain', 'house', 'held', 1e16, 'restore');
  assert.equal(ledger.quantity('house', 'grain'), 1e16, 're-added location retains insertion-order summation');
});

test('balance selection follows first-positive cell order and keeps ranks outside saved authority', () => {
  const ledger = make();
  ledger.location('first', { capacity: Infinity });
  ledger.location('second', { capacity: Infinity });
  ledger.adjust('first', 'grain', 'house-a', 'held', 1e16, 'initial');
  ledger.adjust('second', 'grain', 'house-a', 'sale', 5, 'initial');
  ledger.adjust('first', 'grain', 'house-a', 'unassigned', 1, 'initial');
  ledger.adjust('first', 'timber', 'house-b', 'held', 2, 'initial');
  ledger.adjust('first', 'gold', null, 'unassigned', 7, 'initial');
  ledger.adjust('second', 'gold', 'house-b', 'held', 5, 'initial');

  const key = r => `${r.location}/${r.good}/${r.owner ?? '-'}/${r.availability}`;
  assert.deepEqual(rows(ledger).map(key), [
    'first/grain/house-a/held', 'second/grain/house-a/sale', 'first/grain/house-a/unassigned',
    'first/timber/house-b/held', 'first/gold/-/unassigned', 'second/gold/house-b/held',
  ]);
  ledger.adjust('second', 'grain', 'house-a', 'sale', 4, 'inflow');
  assert.deepEqual(rows(ledger).slice(0, 3).map(key), [
    'first/grain/house-a/held', 'second/grain/house-a/sale', 'first/grain/house-a/unassigned',
  ], 'positive inflow preserves the cell rank');
  assert.equal(ledger.quantity('house-a', 'grain'), 10000000000000008,
    'quantity sums in first-positive order');
  assert.equal(ledger.total('gold'), 12);

  ledger.adjust('first', 'grain', 'house-a', 'held', -1e16, 'consume');
  assert.deepEqual([...ledger.entries({ owner: 'house-a', good: 'grain' })].map(key), [
    'second/grain/house-a/sale', 'first/grain/house-a/unassigned',
  ]);
  ledger.adjust('first', 'grain', 'house-a', 'held', 1e16, 'restock');
  assert.deepEqual([...ledger.entries({ owner: 'house-a', good: 'grain' })].map(key), [
    'second/grain/house-a/sale', 'first/grain/house-a/unassigned', 'first/grain/house-a/held',
  ], 'a zeroed and reinserted cell receives a later rank');
  assert.equal(ledger.quantity('house-a', 'grain'), 10000000000000010,
    'query accumulation follows the newly assigned rank');
  assert.equal(ledger.total('gold'), 12, 'rank changes do not alter total quantities');

  const event = ledger.settle(1);
  assert.deepEqual(Object.keys(event.deltas[0]).sort(), ['after', 'availability', 'before', 'delta', 'good', 'location', 'owner']);
  assert.equal(event.deltas.filter(d => d.good === 'gold').reduce((n, d) => n + d.after, 0), 12);
  assert.equal(Object.hasOwn(ledger, 'orderRanks'), false);
  assert.equal(Object.hasOwn(ledger.facilities.get('first'), 'orderRanks'), false);
  assert.equal(Object.hasOwn(ledger.facilities.get('first').balances, 'orderRanks'), false);
});

test('capacity validation tolerates scale-relative summation roundoff but rejects real reductions', () => {
  const ledger = make(); ledger.location('full', { capacity: 0.3 });
  ledger.adjust('full', 'grain', 'owner-a', 'held', 0.1, 'load');
  ledger.adjust('full', 'grain', 'owner-b', 'held', 0.2, 'load');
  for (let i = 0; i < 20; i++) {
    ledger.transfer({ location: 'full', good: 'grain', owner: 'owner-a', availability: 'held' }, 0.01, 'owner-b');
    ledger.transfer({ location: 'full', good: 'grain', owner: 'owner-b', availability: 'held' }, 0.01, 'owner-a');
  }
  const exactQuantity = ledger.total('grain');
  ledger.location('full', { capacity: 0.3, public: true });
  assert.equal(ledger.total('grain'), exactQuantity, 'metadata refresh does not alter balances');
  assert.throws(() => ledger.location('full', { capacity: 0.29 }), /location full .*prior=0.3, new=0.29/);
  assert.equal(ledger.total('grain'), exactQuantity);
});

test('save construction flushes active commodity settlements before returning the save', () => {
  const production = readFileSync(process.env.FURLONG_TEST_SOURCE || new URL('../index.html', import.meta.url), 'utf8');
  const fn = name => {
    const match = production.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`, 'm'));
    assert.ok(match, `production ${name} function exists`);
    return match[0];
  };
  const context = vm.createContext({
    MODEL_ONLY: false,
    W: { settlements: [], houses: [], name: 'fixture' },
    day: () => 7, AD: () => 850, storageOwnerId: owner => owner ?? 'unassigned',
    storageOutcome: event => context.events.push(event), events: [], JOURNAL: [],
    worldHash: () => 'world', buildId: () => 'test', sovOn: () => false, plyH: () => 0,
    cam: { focus: { x: 0, z: 0 }, dist: 1, yaw: 0 }, Date,
  });
  vm.runInContext(coreSource, context);
  vm.runInContext(fn('commodityActive') + '\n' + fn('commoditySettleAll') + '\n' + fn('workerSaveNameValid') + '\n' + fn('makeSave'), context);
  vm.runInContext("const s={storage:new CommodityBalanceLedger({realmId:0,day:7}),pos:{x:0,z:0}};s.storage.location('yard',{capacity:Infinity});s.storage.adjust('yard','grain','house','held',3,'harvest');W.settlements.push(s);globalThis.saved=makeSave('checkpoint')", context);
  assert.equal(context.saved.name, 'checkpoint');
  assert.equal(context.events.length, 1);
  assert.equal(context.events[0].day, 7);
  assert.equal(context.events[0].deltas[0].after, 3);
});
