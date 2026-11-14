import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSteps } from './steps.js';
import { createGame } from './freeze-watcher.js';

// One full press: down, then up.
const tap = (s, phase, checking) => {
  const what = s.press(phase, checking);
  s.release();
  return what;
};

test('a press during Green moves one step', () => {
  const s = createSteps(10);
  assert.equal(tap(s, 'green'), 'step');
  assert.equal(tap(s, 'green'), 'step');
  assert.equal(s.at, 2);
});

test('a press while Bean is checking is caught and goes back to the start', () => {
  const s = createSteps(10);
  tap(s, 'green');
  tap(s, 'green');
  assert.equal(tap(s, 'red', true), 'caught');
  assert.equal(s.at, 0);
});

test('a press during the time to freeze is forgiven', () => {
  const s = createSteps(10);
  tap(s, 'green');
  assert.equal(tap(s, 'red', false), null);
  assert.equal(s.at, 1);
});

test('the last step wins', () => {
  const s = createSteps(3);
  assert.deepEqual([tap(s, 'green'), tap(s, 'green'), tap(s, 'green')], ['step', 'step', 'win']);
  assert.equal(s.at, 3);
});

test('holding the key counts as one press', () => {
  const s = createSteps(10);
  assert.equal(s.press('green'), 'step');
  assert.equal(s.press('green'), null); // key repeat
  assert.equal(s.press('green'), null);
  assert.equal(s.at, 1);
  s.release();
  assert.equal(s.press('green'), 'step');
});

test('presses outside Green, Red and caught do nothing', () => {
  const s = createSteps(10);
  for (const phase of ['idle', 'win']) assert.equal(tap(s, phase, true), null);
  assert.equal(s.at, 0);
});

test('after a catch the next press says the kid is ready, but not the press still held from the catch', () => {
  const s = createSteps(10);
  tap(s, 'green');
  assert.equal(s.press('red', true), 'caught');
  assert.equal(s.press('caught'), null); // the same press, still held
  s.release();
  assert.equal(tap(s, 'caught'), 'ready');
  assert.equal(s.at, 0);
});

test('the game takes caught and win from a switch, and no distance is not "back at start"', () => {
  const g = createGame({}, () => 0);
  g.start(0, 0);
  g.tick(3000, null); // red
  assert.equal(g.checking(3500), false);
  assert.equal(g.checking(4000), true);
  g.caught(4000);
  assert.equal(g.tick(4100, null), 'caught');
  assert.equal(g.tick(12000, null), 'green'); // 8 seconds
  g.win();
  assert.equal(g.phase, 'win');
});
