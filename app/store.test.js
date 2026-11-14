import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixSettings, load, roundSettings } from './store.js';
import { DEFAULTS } from './game/freeze-watcher.js';

const spec = { greenMinMs: 3000, greenMaxMs: 7000, settleMs: 1000, lookMs: 2500, leewayCm: 6, winCm: 12, steps: 10, input: 'body', game: 'freeze', wordGate: false, words: ['rabbit', 'red', 'robot', 'run'] };

test('how the kid moves is body unless switch is saved', () => {
  assert.equal(fixSettings({ input: 'switch' }).input, 'switch');
  assert.equal(fixSettings({ input: 'jetpack' }).input, 'body');
  assert.equal(fixSettings({ steps: 4.6 }).steps, 5);
});

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

test('practice words: a comma list is tidied, nothing saved gives the spec words', () => {
  assert.deepEqual(fixSettings().words, ['rabbit', 'red', 'robot', 'run']);
  assert.deepEqual(fixSettings({ words: ' Ball ,, red car,  ' }).words, ['ball', 'red car']);
  assert.deepEqual(fixSettings({ words: ['sun'] }).words, ['sun']);
  assert.deepEqual(fixSettings({ words: '' }).words, []);
  assert.equal(fixSettings().wordGate, false);
  assert.equal(fixSettings({ game: 'sneak' }).game, 'sneak');
  assert.equal(fixSettings({ game: 'chess' }).game, 'freeze');
});

test('round settings: the gate follows the setting, the game and the word list', () => {
  const base = fixSettings();
  assert.equal(roundSettings(base).gate, 'off');
  assert.equal(roundSettings({ ...base, wordGate: true }).gate, 'held');
  assert.equal(roundSettings({ ...base, wordGate: true, words: [] }).gate, 'off');
  const sneak = roundSettings({ ...base, game: 'sneak' }); // gate setting is off
  assert.deepEqual([sneak.gate, sneak.greenMinMs, sneak.greenMaxMs], ['every', 3000, 3000]);
  assert.equal(roundSettings({ ...base, game: 'sneak', words: [] }).gate, 'off');
});
