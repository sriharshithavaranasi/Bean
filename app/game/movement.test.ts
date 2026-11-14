import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moved } from './movement.ts';

const opts = { leewayCm: 5, laneCm: 150 };

test('still, with noise inside the leeway, is not caught', () => {
  assert.equal(moved([100, 102, 99, 101, 98, 100, 102, 99], opts), false);
});

test('steady approach is caught', () => {
  assert.equal(moved([100, 97, 94, 91, 88, 85, 82, 79], opts), true);
});

test('one wild outlier is not caught', () => {
  assert.equal(moved([100, 101, 100, 99, 100, 101, 40, 100], opts), false);
});

test('moving away is not caught', () => {
  assert.equal(moved([60, 70, 80, 90, 100, 110], opts), false);
});

test('too few good readings is not caught', () => {
  assert.equal(moved([100, 70, 50], opts), false);
  assert.equal(moved([0, 0, 100, 0, 999, 70, 50], opts), false);
});

test('150 is the firmware saying no echo, not a reading', () => {
  assert.equal(moved([150, 150, 150, 77, 76, 78, 77], opts), false);
});

test('still readings measured on the car are not caught at the default leeway', () => {
  const car = [41, 87, 76, 95, 72, 74, 75, 115, 150, 82, 79, 73, 77, 76, 88, 150, 97, 76, 78, 77, 79, 98, 49, 78, 75, 103, 90, 74, 81, 74, 84, 133, 86, 77, 75, 75, 82, 150, 150, 150, 82, 77, 79, 84, 150, 150, 106, 67, 77, 79];
  for (let i = 0; i + 8 <= car.length; i++) assert.equal(moved(car.slice(i, i + 8), { leewayCm: 15, laneCm: 150 }), false, `window at ${i}`);
});
