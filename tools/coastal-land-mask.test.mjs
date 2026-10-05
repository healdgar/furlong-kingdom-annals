import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`\nfunction ${next}(`));
const landFns = [extract('computeMask', 'markBuilt'), extract('refreshArea', 'writeFurlong'), extract('grazeOK', 'renderHerds'), extract('grazeOf', 'herdWant')].join('\n');
const SIZE = 60, GRID = 4, CELL = SIZE / GRID, FG = 15;
const cIdx = (x, z) => z * GRID + x;
const cellX = x => -SIZE / 2 + x * CELL, cellZ = z => -SIZE / 2 + z * CELL;
const toCell = x => Math.floor((x + SIZE / 2) / CELL);

function landContext({ coastal = true, water = Array(GRID * GRID).fill(0), heights = Array(GRID * GRID).fill(10), lakes = [] } = {}) {
  const furlong = { x: 0, z: 0, af: -1, area: -1, kind: 3, state: 2, lord: 0 };
  const context = vm.createContext({
    G: { land: { mask: null, flood: null }, trackSet: null },
    W: { coastal, water, h: heights, biome: Array(GRID * GRID).fill(0), settlements: lakes },
    GRID, SIZE, CELL, FG, SEA: 0, SEA_SURFACE: 0.5,
    B: { ROCK: 1, SNOW: 2, MARSH: 3 },
    LK: { MEADOW: 3 }, LS: { TILLED: 2 },
    cIdx, cellX, cellZ, toCell,
    slopeAt: () => 0.1,
    inB: (x, z) => x >= 0 && z >= 0 && x < GRID && z < GRID,
    dist2d: (x, z, a, b) => Math.hypot(x - a, z - b),
    lakeAt: (_s, x, z) => x === cellX(0) && z === cellZ(0),
    markSettlementBuilt: () => {},
    furlongAt: () => furlong,
    trackAt: () => false,
  });
  vm.runInContext(landFns, context, { filename: 'coastal-land-functions.js' });
  return { context, furlong };
}

test('classified sea, river, lake and shallow coastal cells suppress field masks', () => {
  const water = Array(GRID * GRID).fill(0), heights = Array(GRID * GRID).fill(10);
  water[cIdx(1, 1)] = 1; // sea-classified
  water[cIdx(2, 1)] = 2; // river-classified
  heights[cIdx(1, 2)] = 0.25; // above SEA, below the visible sea surface
  heights[cIdx(2, 2)] = 0.75; // dry control above the visible surface
  heights[cIdx(2, 3)] = 0;
  const lake = { lake: { dam: { x: cellX(0), z: cellZ(0) } } };
  const { context, furlong } = landContext({ water, heights, lakes: [lake] });
  vm.runInContext('computeMask()', context);
  const mask = context.G.land.mask;
  for (const c of [cIdx(1, 1), cIdx(2, 1), cIdx(0, 0), cIdx(1, 2)]) {
    assert.equal(mask[c * 4], 0, `arable channel wet at cell ${c}`);
    assert.equal(mask[c * 4 + 1], 0, `vine channel wet at cell ${c}`);
    assert.equal(mask[c * 4 + 3], 0, `wet alpha at cell ${c}`);
  }
  assert.equal(mask[cIdx(2, 2) * 4], 255, 'dry arable cell remains available');
  assert.equal(mask[cIdx(2, 2) * 4 + 1], 255, 'dry sloping vine cell remains available');
  assert.equal(mask[cIdx(2, 2) * 4 + 3], 255);
  vm.runInContext('refreshArea(furlongAt(0,0))', context);
  assert.equal(furlong.area, 225, 'only the one dry 15 m survey cell remains arable');
  assert.equal(vm.runInContext('grazeOf({owner:0,furl:[furlongAt(0,0)]}).hay', context), 0.0225);

  water[cIdx(2, 2)] = 2;
  vm.runInContext('computeMask();refreshArea(furlongAt(0,0))', context);
  assert.equal(furlong.area, 0, 'fully wet meadow furlong has no hay-bearing area');
  assert.equal(vm.runInContext('grazeOf({owner:0,furl:[furlongAt(0,0)]}).hay', context), 0);
});

test('an inland quarter-metre cell is not treated as coastal water', () => {
  const heights = Array(GRID * GRID).fill(10); heights[cIdx(2, 2)] = 0.25;
  const { context } = landContext({ coastal: false, heights });
  vm.runInContext('computeMask()', context);
  const mask = context.G.land.mask, c = cIdx(2, 2);
  assert.equal(mask[c * 4], 255);
  assert.equal(mask[c * 4 + 3], 255);
});

test('parchment land overlay leaves wet pixels untouched but paints dry parcel boundaries', () => {
  const draw = extract('drawLandMap', 'buildMapCanvas');
  const F = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) F.push({
    i, j, k: j * GRID + i, jx: 0.5, jz: 0.5, lord: i, dom: 0,
    held: false, kind: 0, state: 0,
  });
  const mask = new Uint8Array(GRID * GRID * 4); for (let c = 0; c < GRID * GRID; c++) mask[c * 4 + 3] = 255;
  mask[cIdx(1, 1) * 4 + 3] = 0;
  const data = new Uint8ClampedArray(2 * 2 * 4);
  for (let o = 0; o < data.length; o += 4) { data[o] = 100; data[o + 1] = 100; data[o + 2] = 100; data[o + 3] = 255; }
  const image = { data };
  const g = { getImageData: () => image, putImageData: value => { image.data.set(value.data); } };
  const context = vm.createContext({
    G: { land: { F, mask } }, SIZE, GRID, FG, FN: GRID, LK: { NONE: 0, VINE: 5, MEADOW: 3 }, LS: { TILLED: 2 },
    cIdx, toCell, g, clamp: (x, a, b) => Math.max(a, Math.min(b, x)), lordColor: lord => lord & 1 ? 0xff0000 : 0x00ff00,
  });
  vm.runInContext(draw, context, { filename: 'drawLandMap.js' });
  vm.runInContext('drawLandMap(g,2)', context);
  assert.deepEqual([...image.data.slice(0, 3)], [100, 100, 100], 'water cell retains its base map color');
  assert.notDeepEqual([...image.data.slice(4, 7)], [100, 100, 100], 'dry pixel receives the parcel-boundary ink');
});

test('terrain shader gates territorial ink by wet mask and sea-surface height', () => {
  assert.match(source, /if\(vWP\.y>uSea\+0\.5&&texture2D\(uMask,\(wp\+uSize\*0\.5\)\/uSize\+0\.5\/uGrid\)\.a>0\.5\)/);
});
