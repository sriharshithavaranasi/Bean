import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureChange, pictureDrift, type Picture } from './picture-moved.ts';

// A 10 by 10 grey picture: mid grey, with a bright block of `size` pixels starting at pixel `at`.
function picture(at = 0, size = 0): Picture {
  const p = new Uint8Array(100).fill(100);
  p.fill(200, at, at + size);
  return p;
}

test('the same picture has not changed', () => {
  assert.equal(pictureChange(picture(20, 10), picture(20, 10)), 0);
});

test('the share of pixels that changed is the result', () => {
  assert.equal(pictureChange(picture(), picture(0, 10)), 0.1); // 10 of 100 pixels lit up
  assert.equal(pictureChange(picture(20, 10), picture(25, 10)), 0.1); // a block moved half its width: 5 pixels left, 5 arrived
});

test('camera noise and the camera changing its exposure are not movement', () => {
  const noisy = picture(20, 10).map((v, i) => v + (i % 3) * 5 - 5);
  assert.equal(pictureChange(picture(20, 10), noisy), 0);
  assert.equal(pictureChange(picture(20, 10), picture(20, 10).map((v) => v + 40)), 0); // the whole picture brighter
});

test('only frames without a trusted pose are judged, against the first picture', () => {
  const pose = [{ x: 0.5, y: 0.5, visibility: 1 }];
  const moved = picture(0, 30);
  assert.equal(pictureDrift([pose, pose], [picture(), moved]), 0); // the pose watched both frames
  assert.equal(pictureDrift([pose, null], [picture(), moved]), 0.3); // first picture is the reference, even with a pose
  assert.equal(pictureDrift([null, null, null], [picture(), moved, picture()]), 0.3); // the worst frame counts
  assert.equal(pictureDrift([null, null], [undefined, undefined]), 0); // no pictures: nothing to judge
});
