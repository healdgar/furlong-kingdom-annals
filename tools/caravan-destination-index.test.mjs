import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const begin = '/* CARAVAN_PRICE_INDEX_HELPERS_BEGIN */';
const end = '/* CARAVAN_PRICE_INDEX_HELPERS_END */';
const start = source.indexOf(begin), finish = source.indexOf(end, start + begin.length);
assert.ok(start >= 0 && finish > start, 'index.html must contain the inline caravan price-index helpers');
const inline = source.slice(start + begin.length, finish);
const { buildCaravanDestinationPriceIndex, caravanDestinationCandidates } = new Function(
  `${inline}\nreturn {buildCaravanDestinationPriceIndex, caravanDestinationCandidates};`,
)();

test('quote index keeps every destination that can pass the zero-distance profit bound', () => {
  const goods = ['grain', 'silk'];
  const quotes = [[2, 30], [18, 40], [12, 55], [8, 39]];
  const index = buildCaravanDestinationPriceIndex(quotes, goods, 0.08);
  const found = caravanDestinationCandidates(index, { grain: 9, silk: 35 }, goods, 0.084);
  assert.deepEqual(found, [
    { di: 1, goods: ['grain', 'silk'] },
    { di: 2, goods: ['grain', 'silk'] },
    { di: 3, goods: ['silk'] },
  ]);
});

test('candidate order is destination order then original sell-good order', () => {
  const goods = ['stone', 'grain', 'silk'];
  const index = buildCaravanDestinationPriceIndex([[12, 12, 12], [30, 30, 30], [20, 20, 20]], goods, 0);
  const found = caravanDestinationCandidates(index,
    { stone: 10, grain: 10, silk: 10 }, ['silk', 'stone', 'grain'], 0);
  assert.deepEqual(found, [
    { di: 0, goods: ['silk', 'stone', 'grain'] },
    { di: 1, goods: ['silk', 'stone', 'grain'] },
    { di: 2, goods: ['silk', 'stone', 'grain'] },
  ]);
});

test('long-distance and unroaded opportunities remain candidates', () => {
  const index = buildCaravanDestinationPriceIndex([[100], [10]], ['grain'], 0.05);
  const found = caravanDestinationCandidates(index, { grain: 20 }, ['grain'], 0.084);
  assert.deepEqual(found, [{ di: 0, goods: ['grain'] }]);
});

test('clear losses are omitted while near-bound pairs remain for exact evaluation', () => {
  const index = buildCaravanDestinationPriceIndex([[9.9], [10.084], [10.085]], ['grain'], 0);
  const found = caravanDestinationCandidates(index, { grain: 10 }, ['grain'], 0.084);
  assert.deepEqual(found, [{ di: 1, goods: ['grain'] }, { di: 2, goods: ['grain'] }]);
});

test('near-ULP original arithmetic cannot be filtered by regrouped algebra', () => {
  const quote = 1.1410526315789475, originPrice = 1, feeRate = 0.05, minimumFreight = 0.084;
  assert.ok(quote - originPrice > minimumFreight + quote * feeRate);
  assert.equal(quote * (1 - feeRate), originPrice + minimumFreight);
  const index = buildCaravanDestinationPriceIndex([[quote]], ['grain'], feeRate);
  const found = caravanDestinationCandidates(index, { grain: originPrice }, ['grain'], minimumFreight);
  assert.deepEqual(found, [{ di: 0, goods: ['grain'] }]);
});

test('unsupported numeric inputs request the original-loop fallback', () => {
  assert.equal(buildCaravanDestinationPriceIndex([[NaN]], ['grain'], 0), null);
  const index = buildCaravanDestinationPriceIndex([[20]], ['grain'], 0);
  assert.equal(caravanDestinationCandidates(index, { grain: Infinity }, ['grain'], 0.084), null);
  assert.equal(caravanDestinationCandidates(index, { grain: 1 }, ['grain'], -0.1), null);
});

test('indexed set is a superset of exact profitable pairs for varied distances', () => {
  const goods = ['grain', 'timber', 'silk'];
  const quotes = Array.from({ length: 80 }, (_, di) => goods.map((_, gi) =>
    1 + ((di * 37 + gi * 53 + di * gi * 7) % 170)));
  const feeRate = 0.05 + 12 / 100 * 0.14;
  const originPrices = { grain: 8, timber: 26, silk: 45 };
  const minimumFreight = 0.084 * 1.4 * 1.15;
  const index = buildCaravanDestinationPriceIndex(quotes, goods, feeRate);
  const candidates = caravanDestinationCandidates(index, originPrices, goods, minimumFreight);
  const indexed = new Set(candidates.flatMap(x => x.goods.map(g => `${x.di}:${g}`)));
  for (let di = 0; di < quotes.length; di++) {
    const distance = (di * 191) % 2600;
    const freight = (0.12 + distance * 1.2 / 1000 * 0.08) * 0.7 * 1.4 * 1.15;
    for (let gi = 0; gi < goods.length; gi++) {
      const good = goods[gi], quote = quotes[di][gi];
      if (quote - originPrices[good] > freight + quote * feeRate) {
        assert.ok(indexed.has(`${di}:${good}`), `${di}:${good}`);
      }
    }
  }
});
