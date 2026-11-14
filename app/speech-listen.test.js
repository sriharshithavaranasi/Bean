import { test } from 'node:test';
import assert from 'node:assert/strict';

// A fake microphone: tests make it "hear" by calling say().
let mic;
globalThis.SpeechRecognition = class {
  constructor() { mic = this; }
  start() {}
  abort() { this.aborted = true; }
  say(text, isFinal = true) { this.onresult({ results: [Object.assign([{ transcript: text }], { isFinal })] }); }
};
const { listenAny, stopListening } = await import('./speech.js');
const button = () => new EventTarget();
const tick = () => new Promise((r) => setTimeout(r, 0));

test('resolves what the kid said', async () => {
  const heard = listenAny(button(), Promise.resolve(), 1000);
  await tick();
  mic.say('I like blue');
  assert.equal(await heard, 'I like blue');
  assert.equal(mic.aborted, true); // the microphone is closed after the turn
});

test('Good try ends the turn with an empty answer', async () => {
  const b = button();
  const heard = listenAny(b, Promise.resolve(), 1000);
  b.dispatchEvent(new Event('click'));
  assert.equal(await heard, '');
});

test('silence for the whole wait resolves null', async () => {
  assert.equal(await listenAny(button(), Promise.resolve(), 30), null);
});

test('the wait starts only when Bean has finished talking', async () => {
  let beanDone;
  const ready = new Promise((r) => (beanDone = r));
  let result = 'pending';
  listenAny(button(), ready, 30).then((v) => (result = v));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(result, 'pending');
  beanDone();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(result, null);
});

test('starting to talk restarts the wait, so a slow answer is not cut off', async () => {
  const heard = listenAny(button(), Promise.resolve(), 50);
  await new Promise((r) => setTimeout(r, 35));
  mic.onspeechstart();
  await new Promise((r) => setTimeout(r, 35));
  mic.say('pizza');
  assert.equal(await heard, 'pizza');
});

test('Stop ends the turn with null', async () => {
  const heard = listenAny(button(), Promise.resolve(), 1000);
  stopListening();
  assert.equal(await heard, null);
});
