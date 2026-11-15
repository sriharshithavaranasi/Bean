import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixSettings, load } from './store.ts';
import { DEFAULTS } from './game/freeze-watcher.ts';

const spec = { greenMinMs: 3000, greenMaxMs: 7000, settleMs: 1000, redMinMs: 2500, redMaxMs: 5000, winCm: 12, tab: 'move', poseWigglePct: 20, cameraId: '' };

test('nothing saved reads as the spec defaults', () => {
  assert.deepEqual(fixSettings(load('bean-settings', {})), spec);
  assert.deepEqual(fixSettings(), spec);
});

test('saved values are read back', () => {
  assert.deepEqual(fixSettings({ ...spec, redMaxMs: 8000, winCm: 20 }), { ...spec, redMaxMs: 8000, winCm: 20 });
});

test('numbers stay inside their limits', () => {
  const s = fixSettings({ settleMs: 1, redMaxMs: 99999, winCm: 500 });
  assert.deepEqual([s.settleMs, s.redMaxMs, s.winCm], [200, 30000, 50]);
});

test('a longest green or red below the shortest is raised to match', () => {
  const s = fixSettings({ greenMinMs: 6000, greenMaxMs: 2000, redMinMs: 4000, redMaxMs: 1000 });
  assert.deepEqual([s.greenMaxMs, s.redMaxMs], [6000, 4000]);
});

test('empty, missing and non-numeric values become the default', () => {
  const s = fixSettings({ redMinMs: '', poseWigglePct: null, winCm: 'lots', settleMs: NaN });
  for (const key of ['redMinMs', 'poseWigglePct', 'winCm', 'settleMs'] as const) assert.equal(s[key], DEFAULTS[key]);
});

test('the tab is Move unless Talk is saved', () => {
  assert.equal(fixSettings({ tab: 'talk' }).tab, 'talk');
  assert.equal(fixSettings({ tab: 'dance' }).tab, 'move');
});

test('webcam settings: any camera id, wiggle room 5 to 60 %', () => {
  assert.equal(fixSettings({ cameraId: 'abc123' }).cameraId, 'abc123');
  assert.equal(fixSettings({ cameraId: 42 }).cameraId, '');
  assert.deepEqual([fixSettings({ poseWigglePct: 1 }).poseWigglePct, fixSettings({ poseWigglePct: 99 }).poseWigglePct], [5, 60]);
});
