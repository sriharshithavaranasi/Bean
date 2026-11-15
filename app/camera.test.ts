import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFound } from './camera.ts';

const cam = (deviceId: string) => ({ deviceId });

test('no camera plugged in: not found', () => {
  assert.equal(cameraFound([]), false);
  assert.equal(cameraFound([], 'brio'), false);
});

test('with the default camera chosen, any camera will do', () => {
  assert.equal(cameraFound([cam('laptop')]), true);
});

test('with a camera picked in the settings, that camera must be plugged in', () => {
  assert.equal(cameraFound([cam('laptop'), cam('brio')], 'brio'), true);
  assert.equal(cameraFound([cam('laptop')], 'brio'), false); // the picked webcam was unplugged
});

test('before the browser has been allowed a camera it hides their ids: any camera counts, and opening it decides', () => {
  assert.equal(cameraFound([cam('')], 'brio'), true);
});
