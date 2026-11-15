import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headToward, makeLink, makeRobot, parseReplies } from './robot.ts';

test('parses replies and keeps a partial one', () => {
  assert.deepEqual(parseReplies('{1_ok}{2_137}{3_1'), {
    replies: [{ id: '1', value: 'ok' }, { id: '2', value: '137' }],
    rest: '{3_1',
  });
});

test('drops firmware noise between replies', () => {
  assert.deepEqual(parseReplies('error:deserializeJson\r\n{7_42}\r\n'), {
    replies: [{ id: '7', value: '42' }],
    rest: '',
  });
});

test('distanceCm is a number, or null when there is no usable reply', async () => {
  assert.equal(await makeRobot(async () => '137').distanceCm(), 137);
  assert.equal(await makeRobot(async () => null).distanceCm(), null);
  assert.equal(await makeRobot(async () => 'ok').distanceCm(), null);
});

test('sends the stock firmware commands', async () => {
  const sent: unknown[] = [];
  const robot = makeRobot(async (c) => (sent.push(c), 'ok'));
  await robot.lookAway();
  await robot.lookAtKid();
  await robot.setLight(255, 0, 0);
  assert.deepEqual(sent, [
    { N: 5, D1: 1, D2: 180 },
    { N: 5, D1: 1, D2: 90 },
    { N: 8, D1: 0, D2: 255, D3: 0, D4: 0 },
  ]);
});

test('a link matches each reply to its command, and a missing reply is null', async () => {
  const sent: unknown[] = [];
  const link = makeLink(async (text) => sent.push(JSON.parse(text)), 20);
  const cm = link.robot.distanceCm();
  link.receive('{Heartbeat}{1_');
  link.receive('42}');
  assert.equal(await cm, 42);
  assert.deepEqual(sent[0], { H: '1', N: 21, D1: 2 });
  assert.equal(await link.robot.lookAway(), null); // no reply within 20 ms
});

// Talk: the webcam rides on the head. x is where the kid's nose is across the picture (0 left, 1 right).
test('the head stays put while the kid is near the middle of the picture', () => {
  for (const x of [0.5, 0.42, 0.58]) assert.equal(headToward(90, x), 90);
});

test('the head turns toward the kid, part of the way, so it settles instead of swinging past', () => {
  const right = headToward(90, 0.9); // the kid is at the right of the picture: a smaller angle turns the head right
  assert.ok(right < 90 && right > 90 - 0.4 * 45, String(right)); // less than the whole way for a 45 degree view
  assert.equal(headToward(90, 0.1), 180 - right); // the same turn the other way
  assert.equal(headToward(60, 0.9), right - 30); // from wherever the head is now
});

test('the head never turns past its limits', () => {
  let angle = 90;
  for (let i = 0; i < 20; i++) angle = headToward(angle, 1);
  assert.equal(angle, 30);
  for (let i = 0; i < 20; i++) angle = headToward(angle, 0);
  assert.equal(angle, 150);
});

test('lookAt turns the head to an angle', async () => {
  const sent: object[] = [];
  await makeRobot(async (c) => (sent.push(c), 'ok')).lookAt(75);
  assert.deepEqual(sent, [{ N: 5, D1: 1, D2: 75 }]);
});
