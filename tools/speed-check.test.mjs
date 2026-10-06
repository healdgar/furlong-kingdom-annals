import test from 'node:test';
import assert from 'node:assert/strict';
import {linFit,hudDayAt,lagStats,jumpStats,parseList,parseArgs,mean} from './speed-check.mjs';

test('linFit recovers slope and intercept exactly on a line, and degrades to NaN without spread', () => {
  const fit = linFit([0, 1, 2, 3, 4].map(x => ({x, y: 5 + 30 * x})));
  assert.ok(Math.abs(fit.slope - 30) < 1e-9 && Math.abs(fit.intercept - 5) < 1e-9 && Math.abs(fit.r2 - 1) < 1e-12);
  assert.ok(Number.isNaN(linFit([{x: 1, y: 1}]).slope));
  assert.ok(Number.isNaN(linFit([{x: 2, y: 1}, {x: 2, y: 9}]).slope));
  assert.equal(linFit([{x: 0, y: 7}, {x: 1, y: 7}, {x: 2, y: 7}]).slope, 0);
});

test('linFit averages noise: a sawtooth of 30-day steps fits close to its mean rate', () => {
  const pts = Array.from({length: 40}, (_, i) => ({x: i / 2, y: 30 * Math.floor(i / 2 * 0.97)}));
  const {slope} = linFit(pts);
  assert.ok(slope > 28 && slope < 31, String(slope));
});

test('hudDayAt is a step function of the install log', () => {
  const installs = [{t: 100, day: 30}, {t: 200, day: 60}];
  assert.equal(hudDayAt(installs, 50, 0), 0);
  assert.equal(hudDayAt(installs, 100, 0), 30);
  assert.equal(hudDayAt(installs, 199, 0), 30);
  assert.equal(hudDayAt(installs, 5000, 0), 60);
  assert.equal(hudDayAt([], 10, 7), 7);
});

test('lagStats reports worker minus foreground day', () => {
  const s = lagStats([{wd: 40, hd: 30}, {wd: 59, hd: 30}, {wd: 61, hd: 60}]);
  assert.equal(s.n, 3);
  assert.equal(s.max, 29);
  assert.equal(s.min, 1);
  assert.ok(Math.abs(s.mean - 40 / 3) < 1e-12);
  assert.ok(Number.isNaN(lagStats([]).mean));
});

test('jumpStats finds the largest step, gaps and rate; unchanged installs count as packets only', () => {
  const s = jumpStats([{t: 0, from: 0, day: 30, ms: 1}, {t: 1000, from: 30, day: 60, ms: 3}, {t: 1500, from: 60, day: 60, ms: 2}, {t: 3000, from: 60, day: 75, ms: 2}], 3);
  assert.equal(s.packets, 4);
  assert.equal(s.changes, 3);
  assert.equal(s.maxJump, 30);
  assert.equal(s.maxGapMs, 2000);
  assert.equal(s.meanGapMs, 1500);
  assert.equal(s.meanJump, 25);
  assert.equal(s.maxInstallMs, 3);
  assert.ok(Math.abs(s.perSec - 4 / 3) < 1e-12);
  assert.equal(jumpStats([], 1).maxJump, 0);
});

test('parseList and parseArgs', () => {
  assert.deepEqual(parseList('4,5', 1, 6), [4, 5]);
  assert.deepEqual(parseList('none', 1, 6), []);
  assert.throws(() => parseList('4,4', 1, 6));
  assert.throws(() => parseList('0', 1, 6));
  assert.throws(() => parseList('x', 1, 6));
  assert.deepEqual(parseArgs(['--speeds', '4,5', '--help', '--out', '/x']), {speeds: '4,5', help: '1', out: '/x'});
  assert.equal(mean([1, 2, 3]), 2);
});
