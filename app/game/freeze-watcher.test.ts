import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, DEFAULTS, type Game } from './freeze-watcher.ts';
import type { Frame } from './pose-moved.ts';

// random() = 0, so every Green lasts exactly greenMinMs (3000). No countdown, so the first Green starts at 0.
const newGame = () => createGame({ countdownMs: 0 }, () => 0);

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
  const g = createGame({ countdownMs: 0, ...settings }, () => 0);
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

  // Next Red at 8500, kid is touching the robot: win once the freeze time is over and the reading has held for a second.
  assert.equal(g.tick(8500, null), 'red');
  assert.equal(run(g, 8600, 10400, () => 6), 'red');
  assert.equal(g.tick(10500, 6), 'win');
});

test('the game starts with a 3 second countdown, then the first Green', () => {
  const g = createGame({}, () => 0);
  g.start(0, 180);
  assert.equal(g.phase, 'countdown');
  assert.equal(run(g, 0, 2900, () => null), 'countdown');
  assert.equal(g.tick(3050, null), 'green'); // a late tick: Green still runs from 3000
  assert.equal(g.tick(5900, null), 'green');
  assert.equal(g.tick(6000, null), 'red');
});

test('stop during the countdown ends the round', () => {
  const g = createGame({}, () => 0);
  g.start(0, 180);
  g.stop();
  assert.equal(g.tick(5000, null), 'idle');
});

test('stepping sideways on Red is caught', () => {
  assert.equal(red(sidestep(4500)), 'caught');
});

test('a move on Red is caught on the tick that sees it, not when the Red light ends', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null); // Red from 3000 to 5500
  assert.equal(run(g, 3100, 4400, () => 120), 'red');
  assert.equal(g.tick(4500, 120, body(0.1)), 'caught');
});

// Too close: the head is out of the picture, so the pose is not trusted and the picture itself is watched.
const headOut = (dx = 0): Frame => body(dx)!.map((p, i) => (i === 0 ? { ...p, y: -0.1 } : p));
const grey = (lit = 0) => new Uint8Array(100).fill(100).fill(250, 0, lit); // a small picture with `lit` bright pixels

test('head out of the picture: a made-up skeleton that jumps about does not catch a still kid', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  for (let t = 3100; t < 5500; t += 100) assert.equal(g.tick(t, 120, headOut(t % 200 ? 0.3 : 0), grey()), 'red');
  assert.equal(g.tick(5500, 120, headOut(), grey()), 'green');
});

test('head out of the picture: a change in the picture is caught on the tick that sees it', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  for (let t = 3100; t < 4500; t += 100) assert.equal(g.tick(t, 120, t % 200 ? headOut() : null, grey()), 'red');
  assert.equal(g.tick(4500, 120, null, grey(30)), 'caught'); // nobody found, and 30% of the picture changed
});

test('head in the picture: the pose decides, so waving hands that change the picture are not caught', () => {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  for (let t = 3100; t < 5500; t += 100) assert.equal(g.tick(t, 120, body(), grey(t % 200 ? 30 : 0)), 'red');
  assert.equal(g.tick(5500, 120, body(), grey()), 'green');
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

// One Red light from 3000 to 5500; the time to freeze ends at 4000.
function redLight() {
  const g = newGame();
  g.start(0, 180);
  g.tick(3000, null);
  return g;
}

test('one stray close reading is not a win', () => {
  const g = redLight();
  assert.equal(run(g, 3100, 4400, () => 120), 'red');
  assert.equal(g.tick(4500, 6, body()), 'red'); // a stray echo
  assert.equal(run(g, 4600, 5400, () => 120), 'red');
});

test('the win comes when every reading has been under the win distance for a second', () => {
  const g = redLight();
  assert.equal(run(g, 3100, 4900, () => 25), 'red'); // under 30 cm, but the second starts after the time to freeze
  assert.equal(g.tick(5000, 25, body()), 'win');
});

test('a far reading, or none, starts the second again', () => {
  for (const gap of [120, 0, null]) {
    const g = redLight();
    assert.equal(run(g, 4000, 4300, () => 25), 'red');
    assert.equal(g.tick(4400, gap, body()), 'red');
    assert.equal(run(g, 4500, 5400, () => 25), 'red');
    assert.equal(g.tick(5500, 25, body()), 'win'); // on the Red light's last tick: the win is checked before Green
  }
});

test('moving in during Red is caught before the second is up', () => {
  const g = redLight();
  assert.equal(g.tick(4000, 25, body()), 'red');
  assert.equal(g.tick(4100, 25, body(0.1)), 'caught');
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
    { settleMs: 1000, redMinMs: 2500, redMaxMs: 5000, winCm: 30, poseWigglePct: 20 },
  );
});

// Green, then a Red where the kid steps sideways: caught at 4500.
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
    const g = createGame({ countdownMs: 0, redMinMs: 2000, redMaxMs: 6000 }, () => r);
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
  const g = createGame({ countdownMs: 0, maxRedLights: 1 }, () => 0);
  g.start(0, 180);
  g.tick(3000, null);
  assert.equal(run(g, 3100, 5500, () => 120, sidestep(4500)), 'caught');
});
