import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPTS, fixTalk, goodbye, nextLine, replyTo, turnsFor, type Said, type Turn } from './talk.ts';

test('every script has 6 turns, each with a line, a model answer, expected words and a reply', () => {
  for (const [key, script] of Object.entries(SCRIPTS)) {
    assert.equal(script.turns.length, 6, key);
    for (const t of script.turns) {
      assert.ok(t.bean && t.model && t.options.length && t.echo, `${key}: ${t.bean}`);
    }
  }
});

test("the kid's name goes into Bean's lines, or friend when there is none", () => {
  assert.match(turnsFor('hello', 'Maya')[0].bean, /Maya/);
  assert.match(turnsFor('hello', '')[0].bean, /friend/);
  assert.doesNotMatch(turnsFor('hello', 'Maya').map((t) => t.bean).join(' '), /\{name\}/);
  assert.match(goodbye('Maya'), /Maya/);
});

test('Bean echoes a word it heard from the expected answers', () => {
  const colour = turnsFor('questions', 'Maya').find((t) => t.options.includes('blue'))!;
  assert.match(replyTo(colour, 'um I like Blue', 0), /blue/i);
});

test('any other answer, or Good try, still gets kind praise', () => {
  const colour = turnsFor('questions', 'Maya').find((t) => t.options.includes('blue'))!;
  const odd = replyTo(colour, 'banana', 0);
  const pressed = replyTo(colour, null, 1);
  assert.ok(odd && pressed);
  assert.doesNotMatch(odd + pressed, /\{word\}|wrong|no\b/i);
});

test('part of a longer word is not echoed', () => {
  const t: Turn = { bean: 'Say hi', model: 'You can say: hi', options: ['hi'], echo: '{word} to you too!' };
  assert.doesNotMatch(replyTo(t, 'this is fun', 0), /hi to you/i);
});

test('fixTalk keeps settings safe: known script, short plain name, wait inside 3 to 20 seconds', () => {
  assert.deepEqual(fixTalk({}), { script: 'hello', name: '', waitMs: 6000, ai: false });
  assert.deepEqual(fixTalk({ script: 'asking', name: '  Maya  ', waitMs: 9000, ai: true }), { script: 'asking', name: 'Maya', waitMs: 9000, ai: true });
  assert.equal(fixTalk({ ai: 'yes' }).ai, false); // only a real true turns AI chat on
  assert.equal(fixTalk({ script: 'nope' }).script, 'hello');
  assert.equal(fixTalk({ waitMs: 500 }).waitMs, 3000);
  assert.equal(fixTalk({ waitMs: 99999 }).waitMs, 20000);
  assert.equal(fixTalk({ waitMs: 'abc' }).waitMs, 6000);
  assert.equal(fixTalk({ name: '<b>Maya</b> the great and wonderful explorer' }).name.length <= 20, true);
  assert.doesNotMatch(fixTalk({ name: '<b>Maya</b>' }).name, /[<>]/);
});

test('AI chat: Bean says what Gemini answered', async () => {
  const [turn, next] = turnsFor('questions', 'Maya');
  const seen: Said[][] = [];
  const ask = async (history: Said[]) => (seen.push(history), 'Blue like the sky! What animal do you like?');
  const history: Said[] = [{ from: 'bean', text: turn.bean }, { from: 'kid', text: 'blue' }];
  assert.deepEqual(await nextLine({ ask, history, turn, next, heard: 'blue', i: 0 }), { line: 'Blue like the sky! What animal do you like?', fromAi: true });
  assert.deepEqual(seen, [history]);
});

test('AI chat: with no answer from Gemini, Bean replies from its script and asks the next scripted question', async () => {
  const [turn, next] = turnsFor('questions', 'Maya');
  const { line, fromAi } = await nextLine({ ask: async () => null, history: [], turn, next, heard: 'blue', i: 0 });
  assert.equal(fromAi, false);
  assert.match(line, /blue/i);
  assert.ok(line.endsWith(next.bean));
});
