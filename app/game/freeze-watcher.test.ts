import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, DEFAULTS, type Game } from './freeze-watcher.ts';

// random() = 0, so every Green lasts exactly greenMinMs (3000).
const newGame = () => createGame({}, () => 0);

// Ticks every 100 ms from `from` until `to`, feeding distances from cmAt(t).
function run(game: Game, from: number, to: number, cmAt: (t: number) => number | null) {
  for (let t = from; t <= to; t += 100) game.tick(t, cmAt(t));
  return game.phase;
}

test('full round: held still, caught, back to start, win', () => {
  const g = newGame();
  assert.equal(g.phase, 'idle');
  g.start(0, 180);
  assert.equal(run(g, 0, 2900, () => null), 'green');
  assert.equal(g.tick(3000, null), 'red');

  // Red, kid holds still at 120: back to Green at 5500.
  assert.equal(run(g, 3100, 5400, () => 120), 'red');
  assert.equal(g.tick(5500, 120), 'green');

  // Green until 8500, then Red while the kid keeps walking: caught.
  assert.equal(g.tick(8500, null), 'red');
  assert.equal(run(g, 8600, 11000, (t) => 120 - (t - 8600) / 50), 'caught');

  // Stays caught until back near the start line.
  assert.equal(g.tick(11100, 100), 'caught');
  assert.equal(g.tick(11200, 178), 'green');

  // Next Red at 14200, kid is touching the robot: win once the freeze time is over.
  assert.equal(g.tick(14200, null), 'red');
  assert.equal(run(g, 14300, 15200, () => 6), 'win');
});

test('movement during the time to freeze is forgiven', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3000, 5500, (t) => (t < 4000 ? 150 - (t - 3000) / 10 : 50)), 'green');
});

test('no readings during Red is not caught', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5500, () => null), 'green');
});

test('Ready ends caught', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  run(g, 3100, 5500, (t) => 150 - (t - 3100) / 20);
  assert.equal(g.phase, 'caught');
  g.ready(6000);
  assert.equal(g.phase, 'green');
});

test('a 0 reading (sensor saw nothing) does not win', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5400, () => 0), 'red');
});

test('defaults match the spec, section 9', () => {
  assert.deepEqual(
    { settleMs: DEFAULTS.settleMs, lookMs: DEFAULTS.lookMs, leewayCm: DEFAULTS.leewayCm, winCm: DEFAULTS.winCm },
    { settleMs: 1000, lookMs: 2500, leewayCm: 15, winCm: 12 },
  );
});

// Green, then a Red where the kid keeps walking: caught at 5500.
function caughtGame() {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  run(g, 3100, 5500, (t) => 150 - (t - 3100) / 20);
  assert.equal(g.phase, 'caught');
  return g;
}

test('caught ends after 8 seconds even if the kid never goes back', () => {
  const g = caughtGame();
  assert.equal(g.tick(13400, 30), 'caught');
  assert.equal(g.tick(13500, 30), 'green');
});

test('stop ends the round from Green, Red and Caught', () => {
  const green = newGame();
  green.start(0, 180);
  const red = newGame();
  red.start(0, 180);
  red.tick(3000, null);
  assert.equal(red.phase, 'red');
  for (const g of [green, red, caughtGame()]) {
    g.stop();
    assert.equal(g.phase, 'idle');
    assert.equal(g.tick(99000, 5), 'idle');
  }
});

test('Freeze Watcher (no gate): accept does nothing and Green follows a held Red', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5500, () => 120), 'green');
  g.accept(5600);
  assert.equal(g.phase, 'green');
});

test('gate "every" (Say It to Sneak): a word before every Green, also at the start and after caught', () => {
  const g = createGame({ gate: 'every' }, () => 0);
  g.start(0, 180);
  assert.equal(g.phase, 'word');
  g.accept(0);
  g.tick(3000, null); // red
  run(g, 3100, 5500, (t) => 120 - (t - 3100) / 50); // walks: caught
  assert.equal(g.phase, 'caught');
  g.ready(6000);
  assert.equal(g.phase, 'word');
});
