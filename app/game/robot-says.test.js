import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, did, makeCommands, outcome, total } from './robot-says.js';

const body = (startCm, endCm) => ({ startCm, endCm, leewayCm: 6 });

test('step closer: the distance shrank by more than the wiggle room', () => {
  assert.equal(did('closer', body(150, 130)), true);
  assert.equal(did('closer', body(150, 146)), false);
  assert.equal(did('closer', body(150, 170)), false);
});

test('step back: the distance grew by more than the wiggle room', () => {
  assert.equal(did('back', body(130, 150)), true);
  assert.equal(did('back', body(130, 133)), false);
  assert.equal(did('back', body(130, 110)), false);
});

test('freeze: the distance held still', () => {
  assert.equal(did('freeze', body(130, 133)), true);
  assert.equal(did('freeze', body(130, 110)), false);
  assert.equal(did('freeze', body(130, 150)), false);
});

test('a missing reading counts as standing still', () => {
  assert.equal(did('freeze', body(130, 0)), true);
  assert.equal(did('closer', body(0, 100)), false);
  assert.equal(did('back', body(130, null)), false);
});

test('wave: the grown-up decides', () => {
  assert.equal(did('wave', { parent: true }), true);
  assert.equal(did('wave', { parent: false }), false);
});

test('switch: a press answers the step commands and no press answers freeze', () => {
  assert.equal(did('closer', { pressed: true }), true);
  assert.equal(did('back', { pressed: false }), false);
  assert.equal(did('freeze', { pressed: false }), true);
  assert.equal(did('freeze', { pressed: true }), false);
});

test('real and fake commands', () => {
  assert.equal(outcome(true, true), 'point'); // real command done
  assert.equal(outcome(true, false), 'miss');
  assert.equal(outcome(false, false), 'point'); // fake command ignored
  assert.equal(outcome(false, true), 'gotcha'); // fake command obeyed
});

test('the final score counts the points', () => {
  assert.equal(total(['point', 'gotcha', 'point', 'miss', 'point', 'point', 'miss', 'point']), 5);
  assert.equal(total([]), 0);
});

test('eight commands, freeze is always real, about 7 in 10 of the others are', () => {
  const rolls = [0.99, 0.1, 0.6, 0.9, 0, 0.69, 0.3, 0.7]; // kind, real, kind, real, ...
  let i = 0;
  const some = makeCommands(() => rolls[i++ % rolls.length]);
  assert.equal(some.length, 8);
  assert.deepEqual(some.slice(0, 4), [
    { kind: 'wave', real: true },
    { kind: 'freeze', real: true }, // 0.9 would be fake for any other command
    { kind: 'closer', real: true },
    { kind: 'back', real: false },
  ]);
  for (const { kind } of some) assert.ok(COMMANDS[kind]);
  const many = makeCommands(Math.random, 2000);
  assert.ok(many.filter((c) => c.kind === 'freeze').every((c) => c.real));
  const others = many.filter((c) => c.kind !== 'freeze');
  const share = others.filter((c) => c.real).length / others.length;
  assert.ok(share > 0.6 && share < 0.8, `real share ${share}`);
});
