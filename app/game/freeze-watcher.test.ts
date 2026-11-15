import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, DEFAULTS, type Game } from './freeze-watcher.ts';
import type { Frame } from './pose-moved.ts';

// random() = 0, so every Green lasts exactly greenMinMs (3000).
const newGame = () => createGame({}, () => 0);

// A standing body in MediaPipe's 33-point layout; dx moves it sideways. Torso 0.3 tall.
function body(dx = 0): Frame {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5 + dx, y: 0.5, visibility: 1 }));
  const at = (i: number, x: number, y: number) => (p[i] = { x: x + dx, y, visibility: 1 });
  at(11, 0.45, 0.3); at(12, 0.55, 0.3); at(23, 0.47, 0.6); at(24, 0.53, 0.6); // shoulders, hips
  at(25, 0.47, 0.75); at(26, 0.53, 0.75); at(27, 0.47, 0.9); at(28, 0.53, 0.9); // knees, ankles
  return p;
}
const still = () => body();
const sidestep = (from: number, dx = 0.1) => (t: number) => body(t < from ? 0 : dx); // shoulders are 0.1 apart: 0.1 = 100%

// Ticks every 100 ms from `from` until `to`, feeding a distance and a webcam frame.
function run(game: Game, from: number, to: number, cmAt: (t: number) => number | null, bodyAt: (t: number) => Frame = still) {
  for (let t = from; t <= to; t += 100) game.tick(t, cmAt(t), bodyAt(t));
  return game.phase;
}
// One Red light (3000 to 5500): caught or back to green.
function red(bodyAt: (t: number) => Frame, settings = {}, cmAt: (t: number) => number | null = () => 120) {
  const g = createGame(settings, () => 0);
  g.start(0, 180);
  g.tick(3000, null);
  return run(g, 3100, 5500, cmAt, bodyAt);
}

test('full round: held still, then a win', () => {
  const g = newGame();
  assert.equal(g.phase, 'idle');
  g.start(0, 180);
  assert.equal(run(g, 0, 2900, () => null), 'green');
  assert.equal(g.tick(3000, null), 'red');

  // Red, kid holds still: back to Green at 5500.
  assert.equal(run(g, 3100, 5400, () => 120), 'red');
  assert.equal(g.tick(5500, 120, body()), 'green');

  // Next Red at 8500, kid is touching the robot: win once the freeze time is over.
  assert.equal(g.tick(8500, null), 'red');
  assert.equal(run(g, 8600, 9500, () => 6), 'win');
});

test('stepping sideways on Red is caught', () => {
  assert.equal(red(sidestep(4500)), 'caught');
});

test('a still body is not caught, whatever the distance sensor reads', () => {
  assert.equal(red(still, {}, (t) => 120 - (t - 3100) / 50), 'green'); // sensor says "walking"
  assert.equal(red(still, {}, (t) => (t % 200 ? 60 : 140)), 'green'); // sensor jumps around
});

test('movement during the time to freeze is forgiven', () => {
  assert.equal(red((t) => body(t < 4000 ? (t - 3000) / 5000 : 0.2)), 'green');
});

test('nobody in the picture is not caught', () => {
  assert.equal(red(() => null), 'green');
});

test('webcam wiggle room is in percent of shoulder width', () => {
  assert.equal(red(sidestep(4500, 0.03), { poseWigglePct: 40 }), 'green'); // 30% of shoulder width
  assert.equal(red(sidestep(4500, 0.03), { poseWigglePct: 20 }), 'caught');
});

test('a 0 reading (sensor saw nothing) does not win', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5400, () => 0), 'red');
});

test('defaults match the spec, section 9', () => {
  assert.deepEqual(
    { settleMs: DEFAULTS.settleMs, redMinMs: DEFAULTS.redMinMs, redMaxMs: DEFAULTS.redMaxMs, winCm: DEFAULTS.winCm, poseWigglePct: DEFAULTS.poseWigglePct },
    { settleMs: 1000, redMinMs: 2500, redMaxMs: 5000, winCm: 12, poseWigglePct: 20 },
  );
});

// Green, then a Red where the kid steps sideways: caught at 5500.
function caughtGame() {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  run(g, 3100, 5500, () => 120, sidestep(4500));
  assert.equal(g.phase, 'caught');
  return g;
}

test('caught ends the game: no Green, Red or win follows', () => {
  const g = caughtGame();
  for (const [t, cm] of [[6000, 180], [20000, 5], [99000, null]] as const) assert.equal(g.tick(t, cm, body()), 'caught');
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

test('Green follows a held Red', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5500, () => 120), 'green');
});

test('each Red lasts a random time between the shortest and longest red light', () => {
  const redLength = (r: number) => {
    const g = createGame({ redMinMs: 2000, redMaxMs: 6000 }, () => r);
    g.start(0, 180); // Green ends at greenMinMs + r * (greenMaxMs - greenMinMs)
    let t = 0;
    while (g.tick(t, null) !== 'red') t += 100;
    const redAt = t;
    while (g.tick(t, 120, body()) === 'red') t += 100;
    return t - redAt;
  };
  assert.equal(redLength(0), 2000);
  assert.equal(redLength(0.5), 4000);
  assert.equal(redLength(0.99), 6000); // rounds up to the next 100 ms tick
});

test('12 Red lights with no catch and no win end the game: nobody is playing', () => {
  const g = newGame();
  g.start(0, 180);
  let t = 0;
  let reds = 0;
  let last = g.phase;
  while (t < 200000 && g.phase !== 'ended') {
    t += 100;
    g.tick(t, 120, body()); // a still body, never close enough to win
    if (g.phase === 'red' && last !== 'red') reds++;
    last = g.phase;
  }
  assert.equal(g.phase, 'ended');
  assert.equal(reds, 12);
  assert.equal(g.tick(t + 100000, 5, body()), 'ended'); // stays ended: no Green, Red or win follows
});

test('the limit counts Red lights, so a catch or a win before it still ends the game as before', () => {
  const g = createGame({ maxRedLights: 1 }, () => 0);
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5500, () => 120, sidestep(4500)), 'caught');
});
