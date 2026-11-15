import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseMoved } from './pose-moved.ts';

// A standing body in MediaPipe's 33-point layout, in image coordinates (0 to 1).
// Torso: shoulders at y 0.3, hips at y 0.6, so the torso is 0.3 tall.
function body({ dx = 0, dy = 0, leftFoot = 0, wrist = 0, seen = 1, legs = true } = {}) {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5 + dx, y: 0.5 + dy, visibility: seen }));
  const at = (i: number, x: number, y: number) => (p[i] = { x: x + dx, y: y + dy, visibility: seen });
  at(11, 0.45, 0.3); at(12, 0.55, 0.3); // shoulders
  at(23, 0.47, 0.6); at(24, 0.53, 0.6); // hips
  at(25, 0.47 + leftFoot / 2, 0.75); at(26, 0.53, 0.75); // knees
  at(27, 0.47 + leftFoot, 0.9); at(28, 0.53, 0.9); // ankles
  if (!legs) for (const i of [25, 26, 27, 28]) p[i].visibility = 0.05; // feet out of the picture
  at(15, 0.4 + wrist, 0.6); at(16, 0.6 - wrist, 0.6); // wrists
  return p;
}
const opts = { wiggle: 0.2 };
const jitter = (n: number) => Array.from({ length: n }, (_, i) => body({ dx: (i % 3 - 1) * 0.005 }));

test('standing still with camera jitter is not caught', () => {
  assert.equal(poseMoved(jitter(12), opts), false);
});

test('stepping sideways is caught', () => {
  const frames = [...jitter(4), ...Array.from({ length: 6 }, () => body({ dx: 0.1 }))];
  assert.equal(poseMoved(frames, opts), true);
});

test('one foot stepping out is caught', () => {
  const frames = [...jitter(4), ...Array.from({ length: 6 }, () => body({ leftFoot: 0.15 }))];
  assert.equal(poseMoved(frames, opts), true);
});

test('moving and coming back is still caught', () => {
  const frames = [...jitter(4), ...Array.from({ length: 4 }, () => body({ dx: 0.1 })), ...jitter(4)];
  assert.equal(poseMoved(frames, opts), true);
});

test('waving both hands is not caught: hands are ignored', () => {
  const frames = [...jitter(4), ...Array.from({ length: 6 }, (_, i) => body({ wrist: i % 2 ? 0.2 : -0.2 }))];
  assert.equal(poseMoved(frames, opts), false);
});

test('one frame that moved is enough to be caught', () => {
  const frames = jitter(10);
  frames[6] = body({ dx: 0.3 });
  assert.equal(poseMoved(frames, opts), true);
});

test('more wiggle room forgives a small sway', () => {
  const frames = [...jitter(4), ...Array.from({ length: 6 }, () => body({ dx: 0.03 }))]; // 30% of shoulder width
  assert.equal(poseMoved(frames, { wiggle: 0.2 }), true);
  assert.equal(poseMoved(frames, { wiggle: 0.4 }), false);
});

test('two frames are enough; nobody seen, or shoulders never seen, is not caught', () => {
  assert.equal(poseMoved([body(), body({ dx: 0.3 })], opts), true);
  assert.equal(poseMoved([...jitter(4), ...Array.from({ length: 6 }, () => null)], opts), false);
  assert.equal(poseMoved(Array.from({ length: 10 }, (_, i) => body({ dx: i * 0.05, seen: 0.1 })), opts), false);
});

test('one point that moved is enough: an ankle stepping out is caught', () => {
  const frames = jitter(10);
  for (const f of frames.slice(4)) f[27] = { ...f[27], x: f[27].x + 0.2 };
  assert.equal(poseMoved(frames, opts), true);
});

test('shoulders alone are enough: hips and legs out of the picture', () => {
  const shouldersOnly = (dx = 0) => {
    const f = body({ dx });
    for (const i of [23, 24, 25, 26, 27, 28]) f[i].visibility = 0.05;
    return f;
  };
  assert.equal(poseMoved(Array.from({ length: 10 }, () => shouldersOnly()), opts), false);
  assert.equal(poseMoved([shouldersOnly(), shouldersOnly(), shouldersOnly(0.1)], opts), true);
});

test('feet out of the picture is fine', () => {
  const still = Array.from({ length: 10 }, (_, i) => body({ legs: false, dx: (i % 3 - 1) * 0.005 }));
  assert.equal(poseMoved(still, opts), false);
  const step = [...still.slice(0, 4), ...Array.from({ length: 6 }, () => body({ legs: false, dx: 0.1 }))];
  assert.equal(poseMoved(step, opts), true);
});


test("points near the edge of the picture do not count: a close kid's guessed ankles jumping is not a catch", () => {
  const close = (ankleY: number, dx = 0) => {
    const f = body({ dx });
    f[27] = { ...f[27], y: ankleY }; // the model guesses an ankle at the bottom edge
    f[28] = { ...f[28], y: ankleY };
    return f;
  };
  assert.equal(poseMoved([close(0.97), close(0.99), close(0.96)], opts), false); // edge guesses jump: ignored
  assert.equal(poseMoved([close(0.97), close(0.99), close(0.97, 0.1)], opts), true); // a real sidestep still shows in the shoulders
});
