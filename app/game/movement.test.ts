import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moved } from './movement.ts';

const opts = { leewayCm: 5, laneCm: 200 };

test('still, with noise inside the leeway, is not caught', () => {
  assert.equal(moved([150, 152, 149, 151, 148, 150, 152, 149], opts), false);
});

test('steady approach is caught', () => {
  assert.equal(moved([150, 147, 144, 141, 138, 135, 132, 129], opts), true);
});

test('one wild outlier is not caught', () => {
  assert.equal(moved([150, 151, 150, 149, 150, 151, 40, 150], opts), false);
});

test('moving away is not caught', () => {
  assert.equal(moved([100, 110, 120, 130, 140, 150], opts), false);
});

test('too few good readings is not caught', () => {
  assert.equal(moved([150, 100, 50], opts), false);
  assert.equal(moved([0, 0, 150, 0, 999, 100, 50], opts), false);
});
