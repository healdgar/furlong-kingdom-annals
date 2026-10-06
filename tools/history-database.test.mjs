import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const helper = html.slice(html.indexOf('class HistoryDatabase{'), html.indexOf('\nclass HistoryStore{'));

class FakeRequest {
  constructor() { this.result = undefined; this.error = null; }
  succeed(value) { this.result = value; this.onsuccess?.({ target: this }); }
  block() { this.onblocked?.({ target: this }); }
}

class FakeTransaction {
  constructor({ autoComplete = false, autoAbort = false, error = null } = {}) {
    this.error = error;
    this.aborted = false;
    this.autoComplete = autoComplete;
    this.autoAbort = autoAbort;
  }
  objectStore() {
    return { put: value => {
      const request = new FakeRequest(); request.result = value;
      queueMicrotask(() => request.onsuccess?.({ target: request }));
      return request;
    }};
  }
  abort() {
    this.aborted = true;
    if (this.autoAbort) queueMicrotask(() => this.onabort?.({ target: this }));
  }
  complete() { this.oncomplete?.({ target: this }); }
}

class FakeDatabase {
  constructor(transactionResults = []) {
    this.objectStoreNames = { contains: () => true };
    this.transactionResults = [...transactionResults];
    this.transactions = [];
    this.closeCount = 0;
  }
  transaction(stores, mode) {
    const next = this.transactionResults.shift();
    if (next instanceof Error) throw next;
    const tx = next || new FakeTransaction();
    tx.stores = stores; tx.mode = mode; this.transactions.push(tx);
    if (tx.autoComplete) queueMicrotask(() => tx.complete());
    return tx;
  }
  close() { this.closeCount++; this.onclose?.({ target: this }); }
}

function invalidState() { const error = new Error('connection is closing'); error.name = 'InvalidStateError'; return error; }
function fixture(openPlan = []) {
  const state = { opens: 0, openPlan: [...openPlan] };
  const indexedDB = { open(name, version) {
    state.opens++; state.lastOpen = { name, version };
    const plan = state.openPlan.shift() || {};
    const request = new FakeRequest();
    if (plan.blocked) {
      setTimeout(() => request.block(), 0);
      if (plan.db) setTimeout(() => request.succeed(plan.db), plan.lateSuccess ?? 10);
    } else setTimeout(() => request.succeed(plan.db), plan.delay ?? 0);
    return request;
  }};
  const context = vm.createContext({ indexedDB, setTimeout, clearTimeout, Promise, Error });
  vm.runInContext(`${helper}\n;globalThis.HistoryDatabase=HistoryDatabase`, context);
  return { state, HistoryDatabase: context.HistoryDatabase };
}

test('opens once and returns the cached healthy connection', async () => {
  const db = new FakeDatabase(), { state, HistoryDatabase } = fixture([{ db }]);
  const database = new HistoryDatabase('test-history');
  assert.equal(await database.open(), db);
  assert.equal(await database.open(), db);
  assert.equal(state.opens, 1);
  assert.deepEqual(state.lastOpen, { name: 'test-history', version: 1 });
});

test('coalesces concurrent opens onto the same pending request', async () => {
  const db = new FakeDatabase(), { state, HistoryDatabase } = fixture([{ db, delay: 5 }]);
  const database = new HistoryDatabase('test-history');
  const first = database.open(), second = database.open();
  assert.strictEqual(first, second);
  assert.equal(await first, db);
  assert.equal(state.opens, 1);
});

test('retries one synchronous InvalidStateError with a fresh connection', async () => {
  const stale = new FakeDatabase([invalidState()]), fresh = new FakeDatabase([new FakeTransaction({ autoComplete: true })]);
  const { state, HistoryDatabase } = fixture([{ db: stale }, { db: fresh }]);
  const database = new HistoryDatabase('test-history');
  const result = await database.transaction('games', 'readwrite', tx => tx.objectStore('games').put('ok'));
  assert.equal(result, 'ok');
  assert.equal(state.opens, 2);
  assert.equal(stale.closeCount, 1);
  assert.equal(fresh.transactions.length, 1);
});

test('does not retry after both synchronous closing-connection attempts fail', async () => {
  const first = new FakeDatabase([invalidState()]), second = new FakeDatabase([invalidState()]);
  const { state, HistoryDatabase } = fixture([{ db: first }, { db: second }]);
  const database = new HistoryDatabase('test-history');
  await assert.rejects(database.transaction('games', 'readwrite', () => assert.fail('callback must not run')), { name: 'InvalidStateError' });
  assert.equal(state.opens, 2);
  assert.equal(first.closeCount, 1);
  assert.equal(second.closeCount, 1);
  assert.equal(database.db, null, 'the exhausted closing connection must be invalidated');
});

test('does not retry an abort after transaction creation', async () => {
  const tx = new FakeTransaction({ autoAbort: true, error: Error('aborted') }), db = new FakeDatabase([tx]);
  const { state, HistoryDatabase } = fixture([{ db }, { db: new FakeDatabase() }]);
  const database = new HistoryDatabase('test-history');
  await assert.rejects(database.transaction('games', 'readwrite', () => { throw Error('callback failed'); }), /callback failed/);
  assert.equal(tx.aborted, true);
  assert.equal(state.opens, 1);
  assert.equal(db.transactions.length, 1);
});

test('callback failure aborts and rejects with the original callback error', async () => {
  const tx = new FakeTransaction({ autoAbort: true, error: Error('transaction aborted') }), db = new FakeDatabase([tx]);
  const { HistoryDatabase } = fixture([{ db }]);
  const database = new HistoryDatabase('test-history'), original = Error('bad callback');
  await assert.rejects(database.transaction('games', 'readwrite', () => { throw original; }), error => error === original);
  assert.equal(tx.aborted, true);
});

test('readonly request result resolves only when its transaction commits', async () => {
  const tx = new FakeTransaction(), db = new FakeDatabase([tx]);
  const { HistoryDatabase } = fixture([{ db }]);
  const database = new HistoryDatabase('test-history');
  let settled = false;
  const pending = database.transaction('games', 'readonly', current => {
    const request = new FakeRequest(); request.result = 'record'; current.request = request; return request;
  }).then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, false);
  tx.complete();
  assert.equal(await pending, 'record');
});

test('onclose and versionchange invalidate the cached connection', async () => {
  const first = new FakeDatabase(), second = new FakeDatabase();
  const { state, HistoryDatabase } = fixture([{ db: first }, { db: second }, { db: first }]);
  const database = new HistoryDatabase('test-history');
  assert.equal(await database.open(), first);
  first.onclose();
  assert.equal(await database.open(), second);
  second.onversionchange();
  assert.equal(second.closeCount, 1);
  assert.equal(await database.open(), first);
  assert.equal(state.opens, 3);
});

test('a blocked late success closes the leaked connection', async () => {
  const leaked = new FakeDatabase(), { state, HistoryDatabase } = fixture([{ blocked: true, db: leaked, lateSuccess: 5 }]);
  const database = new HistoryDatabase('test-history');
  await assert.rejects(database.open(), /blocked/);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(state.opens, 1);
  assert.equal(leaked.closeCount, 1);
  assert.equal(database.db, null);
});
