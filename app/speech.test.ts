import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from './speech.ts';

test('a practice word is found inside what was heard', () => {
  assert.equal(matches('a Red robot!', ['red']), true);
  assert.equal(matches('I said rabbit', ['run', 'rabbit']), true);
  assert.equal(matches('the red car', ['red car']), true);
});

test('part of a longer word is not a match', () => {
  assert.equal(matches('running', ['run']), false);
  assert.equal(matches('', ['run']), false);
  assert.equal(matches('hello', []), false);
});
