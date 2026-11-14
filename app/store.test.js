import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixSettings, load } from './store.js';
import { DEFAULTS } from './game/freeze-watcher.js';

const spec = { greenMinMs: 3000, greenMaxMs: 7000, settleMs: 1000, lookMs: 2500, leewayCm: 6, winCm: 12 };

test('nothing saved reads as the spec defaults', () => {
  assert.deepEqual(fixSettings(load('bean-settings', {})), spec);
  assert.deepEqual(fixSettings(), spec);
});

test('saved values are read back', () => {
  assert.deepEqual(fixSettings({ ...spec, lookMs: 4000, winCm: 20 }), { ...spec, lookMs: 4000, winCm: 20 });
});

test('numbers stay inside their limits', () => {
  const s = fixSettings({ settleMs: 1, lookMs: 99999, leewayCm: -4, winCm: 500 });
  assert.deepEqual([s.settleMs, s.lookMs, s.leewayCm, s.winCm], [200, 10000, 2, 50]);
});

test('a longest green below the shortest is raised to match', () => {
  const s = fixSettings({ greenMinMs: 6000, greenMaxMs: 2000 });
  assert.equal(s.greenMaxMs, 6000);
});

test('empty, missing and non-numeric values become the default', () => {
  const s = fixSettings({ lookMs: '', leewayCm: null, winCm: 'lots', settleMs: NaN });
  for (const key of ['lookMs', 'leewayCm', 'winCm', 'settleMs']) assert.equal(s[key], DEFAULTS[key]);
});
