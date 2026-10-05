import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const begin = '/* SETTLEMENT_DISTANCE_WEIGHTS_BEGIN */';
const end = '/* SETTLEMENT_DISTANCE_WEIGHTS_END */';
const start = html.indexOf(begin), finish = html.indexOf(end, start + begin.length);
assert.ok(start >= 0 && finish > start, 'index.html must contain the distance weight helpers');
const source = html.slice(start + begin.length, finish);

function fixture() {
  const W = { settlements: [
    { pos: { x: 0, z: 0 } },
    { pos: { x: 300, z: 400 } },
    { pos: { x: 1200, z: 0 } },
  ] };
  let calls = 0;
  const dist2d = (x, z, a, b) => { calls++; return Math.hypot(x - a, z - b); };
  const api = new Function('W', 'MAPK', 'dist2d', `${source}\nreturn {settlementDistanceWeights,settlementDistanceWeight};`)(W, 1, dist2d);
  return { W, api, calls: () => calls };
}

test('builds triangular pair weights once and reuses them symmetrically', () => {
  const { W, api, calls } = fixture(), weights = api.settlementDistanceWeights();
  assert.equal(calls(), 3);
  assert.equal(api.settlementDistanceWeight(weights, 3, 0, 1), Math.exp(-500 / 1200));
  assert.equal(api.settlementDistanceWeight(weights, 3, 1, 0), Math.exp(-500 / 1200));
  assert.equal(api.settlementDistanceWeight(weights, 3, 2, 2), 1);
  assert.equal(api.settlementDistanceWeights(), weights);
  assert.equal(calls(), 3);
  assert.equal(W.settlements.length, 3);
});

test('rebuilds after settlement additions and coordinate moves', () => {
  const { W, api, calls } = fixture();
  api.settlementDistanceWeights();
  W.settlements.push({ pos: { x: 0, z: 1200 } });
  let weights = api.settlementDistanceWeights();
  assert.equal(calls(), 9, 'four settlements require six recalculated pairs');
  assert.equal(api.settlementDistanceWeight(weights, 4, 0, 3), Math.exp(-1));
  W.settlements[1].pos.x = 0;
  weights = api.settlementDistanceWeights();
  assert.equal(calls(), 15, 'a coordinate move rebuilds every pair');
  assert.equal(api.settlementDistanceWeight(weights, 4, 0, 1), Math.exp(-400 / 1200));
});

test('marketHeads consumes cached weights while carryingCap still routes through marketHeads', () => {
  const market = html.slice(html.indexOf('function marketHeads('), html.indexOf('function tickPopulation(', html.indexOf('function marketHeads(')));
  assert.match(market, /settlementDistanceWeights\(\)/);
  assert.match(market, /settlementDistanceWeight\(/);
  assert.match(html.slice(html.indexOf('function carryingCap('), html.indexOf('function tickPopulation(')), /marketHeads\(s\)/);
});

test('marketHeads retains the baseline distance scan for an external settlement', () => {
  const marketStart = html.indexOf('function marketHeads('), marketEnd = html.indexOf('function carryingCap(', marketStart);
  const W = {
    settlements: [
      { pos: { x: -1200, z: 40 }, pop: 120, kind: 'village' },
      { pos: { x: 80, z: 200 }, pop: 75, kind: 'town' },
    ],
    houses: [],
  };
  W.capital = W.settlements[0];
  const MAPK = 1.17, NEED = { grain: 1, fish: 1 }, GOODBASE = { grain: 1, fish: 1 };
  const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const market = new Function('W', 'MAPK', 'dist2d', 'day', 'NEED', 'GOODBASE', 'lvJobs', 'clamp',
    `${source}\n${html.slice(marketStart, marketEnd)}\nreturn marketHeads;`)(
      W, MAPK, dist2d, () => 0, NEED, GOODBASE, () => [], clamp);
  const external = { pos: { x: 130, z: -95 }, pop: 40, kind: 'town', prosperity: 67 };
  let hinter = 0;
  for (const o of W.settlements) {
    if (o === external) continue;
    const dd = dist2d(o.pos.x, o.pos.z, external.pos.x, external.pos.z);
    hinter += o.pop * 0.15 * Math.exp(-dd / (1200 * MAPK)) * (o.kind === 'village' ? 1 : 0.4);
  }
  const expected = hinter * clamp(external.prosperity / 50, 0.5, 1.5);
  const actual = market(external);
  assert.ok(Number.isFinite(actual), 'external settlements must not produce NaN hinterland');
  assert.equal(actual, expected, 'external settlement result must equal the original distance expression');
});
