import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixSettings, load, roundSettings, type Settings } from './store.ts';
import { DEFAULTS } from './game/freeze-watcher.ts';

const spec = { greenMinMs: 3000, greenMaxMs: 7000, settleMs: 1000, lookMs: 2500, leewayCm: 15, winCm: 12, game: 'freeze', tab: 'move', words: ['rabbit', 'red', 'robot', 'run'] };

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
  for (const key of ['lookMs', 'leewayCm', 'winCm', 'settleMs'] as const) assert.equal(s[key], DEFAULTS[key]);
});

test('practice words: a comma list is tidied, nothing saved gives the spec words', () => {
  assert.deepEqual(fixSettings().words, ['rabbit', 'red', 'robot', 'run']);
  assert.deepEqual(fixSettings({ words: ' Ball ,, red car,  ' }).words, ['ball', 'red car']);
  assert.deepEqual(fixSettings({ words: ['sun'] }).words, ['sun']);
  assert.deepEqual(fixSettings({ words: '' }).words, []);
  assert.equal(fixSettings({ game: 'sneak' }).game, 'sneak');
  assert.equal(fixSettings({ game: 'says' }).game, 'freeze'); // Robot Says was removed
  assert.equal(fixSettings({ game: 'chess' }).game, 'freeze');
});

test('the tab is Move unless Talk is saved', () => {
  assert.equal(fixSettings({ tab: 'talk' }).tab, 'talk');
  assert.equal(fixSettings({ tab: 'dance' }).tab, 'move');
});

test('round settings: only Say It to Sneak asks for words, and only with a word list', () => {
  const base = fixSettings();
  assert.equal(roundSettings(base).gate, 'off'); // Red Light, Green Light never asks for a word
  assert.equal(roundSettings({ ...base, wordGate: true } as Settings).gate, 'off'); // an old saved setting is ignored
  const sneak = roundSettings({ ...base, game: 'sneak' });
  assert.deepEqual([sneak.gate, sneak.greenMinMs, sneak.greenMaxMs], ['every', 3000, 3000]);
  assert.equal(roundSettings({ ...base, game: 'sneak', words: [] }).gate, 'off');
});
