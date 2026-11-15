// The /talk endpoint for Talk with Bean's AI chat (scripts/talk.ts). Gemini is faked: no network, no key needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answer, cleanReply } from './talk.ts';

const turns = [{ from: 'bean', text: 'Hi Maya! What is your favourite colour?' }, { from: 'kid', text: 'blue' }];
const body = (b: object = { name: 'Maya', turns }) => JSON.stringify(b);
type Call = { url: string; init: RequestInit & { headers: Record<string, string> }; sent: any };
const asFetch = (f: (url: string, init: Call['init']) => Promise<unknown>) => f as unknown as typeof fetch;
function gemini(reply: string, status = 200) {
  const calls: Call[] = [];
  const fake = asFetch(async (url, init) => {
    calls.push({ url, init, sent: JSON.parse(String(init.body)) });
    return { ok: status === 200, status, json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
  });
  return { fake, calls };
}

test('without a key it answers 503, so the app stays on its script', async () => {
  const { fake, calls } = gemini('hi');
  assert.equal((await answer(body(), { key: '', fetch: fake })).status, 503);
  assert.equal(calls.length, 0);
});

test('a bad body answers 400 and never reaches Gemini', async () => {
  const { fake, calls } = gemini('hi');
  for (const bad of [null, 'nope', body({ turns: [] }), body({ turns: [{ from: 'kid', text: 5 }] }), body({ turns: [{ from: 'bean', text: 'Hi' }] }),
    body({ turns: Array.from({ length: 13 }, () => ({ from: 'kid', text: 'hi' })) }), body({ turns: [{ from: 'kid', text: 'x'.repeat(301) }] })]) {
    assert.equal((await answer(bad, { key: 'k', fetch: fake })).status, 400, String(bad).slice(0, 40));
  }
  assert.equal(calls.length, 0);
});

test('it sends Bean its rules, the turns as model and user, and the key in a header, never in the URL', async () => {
  const { fake, calls } = gemini('Blue is great! What animal do you like?');
  const res = await answer(body(), { key: 'secret-key', fetch: fake, model: 'm1' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { reply: 'Blue is great! What animal do you like?' });
  const [{ url, init, sent }] = calls;
  assert.match(url, /\/models\/m1:generateContent$/);
  assert.doesNotMatch(url, /secret-key/);
  assert.equal(init.headers['x-goog-api-key'], 'secret-key');
  assert.match(sent.systemInstruction.parts[0].text, /young child/i);
  assert.match(sent.systemInstruction.parts[0].text, /Maya/);
  assert.deepEqual(sent.contents.map((c: { role: string }) => c.role), ['model', 'user']);
  assert.equal(sent.contents.at(-1).parts[0].text, 'blue');
  assert.ok(sent.safetySettings.length >= 4);
  assert.equal(JSON.stringify(res).includes('secret-key'), false);
});

test('Good try reaches Gemini as a plain note, not an empty turn', async () => {
  const { fake, calls } = gemini('Nice try! What is your favourite food?');
  await answer(body({ name: '', turns: [{ from: 'bean', text: 'Hi!' }, { from: 'kid', text: '' }] }), { key: 'k', fetch: fake });
  assert.match(calls[0].sent.contents.at(-1).parts[0].text, /tried/i);
});

test('a Gemini error, a blocked reply or a timeout answers 502', async () => {
  assert.equal((await answer(body(), { key: 'k', fetch: gemini('x', 500).fake })).status, 502);
  const blocked = asFetch(async () => ({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }));
  assert.equal((await answer(body(), { key: 'k', fetch: blocked })).status, 502);
  const down = asFetch(async () => {
    throw new Error('timeout');
  });
  assert.equal((await answer(body(), { key: 'k', fetch: down })).status, 502);
});

test('replies are cleaned for speaking: no markdown or emoji, and they stop at the first question', () => {
  assert.equal(cleanReply('**Wow!** 🎉 Blue is *great*. Do you like the sky? I do. Do you like the sea?'), 'Wow! Blue is great. Do you like the sky?');
  assert.equal(cleanReply('   '), null);
  assert.ok(cleanReply('a'.repeat(500))!.length <= 200);
});

test('the server routes POST /talk to it, from the laptop only', async (t) => {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const { fileURLToPath } = await import('node:url');
  const server = spawn(process.execPath, [fileURLToPath(new URL('serve.ts', import.meta.url))], {
    env: { ...process.env, PORT: '0', GEMINI_API_KEY: '' },
  });
  t.after(() => server.kill());
  const [line] = await once(server.stdout, 'data');
  const base = `http://localhost:${String(line).match(/localhost:(\d+)/)![1]}`;
  const res = await fetch(`${base}/talk`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body() });
  assert.equal(res.status, 503); // no key in this test: the app keeps its script
  assert.equal((await fetch(`${base}/talk`)).status, 403); // only POST
});
