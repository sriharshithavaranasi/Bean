// The /voice endpoint for Bean's ElevenLabs voice (scripts/voice.ts). ElevenLabs is faked: no network, no key needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speak } from './voice.ts';

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };
function elevenlabs(status = 200) {
  const calls: Call[] = [];
  const fake = (async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    return { ok: status === 200, status, arrayBuffer: async () => new Uint8Array([0xff, 0xf3]).buffer };
  }) as unknown as typeof fetch;
  return { fake, calls };
}
const line = (text: unknown = 'Red light!') => JSON.stringify({ text });

test('without a key it answers 503, so the app uses the browser voice', async () => {
  const { fake, calls } = elevenlabs();
  assert.equal((await speak(line(), { key: '', fetch: fake })).status, 503);
  assert.equal(calls.length, 0);
});

test('a bad body answers 400 and never reaches ElevenLabs', async () => {
  const { fake, calls } = elevenlabs();
  for (const bad of [null, 'nope', line(''), line('  '), line(5), line('x'.repeat(301))]) {
    assert.equal((await speak(bad, { key: 'k', fetch: fake })).status, 400, String(bad).slice(0, 40));
  }
  assert.equal(calls.length, 0);
});

test('it asks for the line in the chosen voice, with the key in a header, never in the URL, and returns MP3', async () => {
  const { fake, calls } = elevenlabs();
  const res = await speak(line(), { key: 'secret-key', voice: 'v1', model: 'm1', fetch: fake });
  assert.equal(res.status, 200);
  assert.equal(res.type, 'audio/mpeg');
  assert.deepEqual([...(res.body as Uint8Array)], [0xff, 0xf3]);
  const [{ url, init }] = calls;
  assert.match(url, /\/v1\/text-to-speech\/v1\?/);
  assert.doesNotMatch(url, /secret-key/);
  assert.equal(init.headers['xi-api-key'], 'secret-key');
  assert.deepEqual(JSON.parse(String(init.body)), { text: 'Red light!', model_id: 'm1' });
});

test('the default voice is Bean’s', async () => {
  const { fake, calls } = elevenlabs();
  await speak(line(), { key: 'k', fetch: fake, voice: undefined });
  assert.match(calls[0].url, new RegExp(`/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || 'PKtsQbgKDa44YlyHnywy'}\\?`));
});

test('an ElevenLabs error or no answer gives 502', async () => {
  assert.equal((await speak(line(), { key: 'k', fetch: elevenlabs(401).fake })).status, 502);
  const down = (async () => {
    throw new Error('timeout');
  }) as unknown as typeof fetch;
  assert.equal((await speak(line(), { key: 'k', fetch: down })).status, 502);
});

test('the server routes POST /voice to it, from the laptop only', async (t) => {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const { fileURLToPath } = await import('node:url');
  const server = spawn(process.execPath, [fileURLToPath(new URL('serve.ts', import.meta.url))], {
    env: { ...process.env, PORT: '0', ELEVENLABS_API_KEY: '' },
  });
  t.after(() => server.kill());
  const [out] = await once(server.stdout, 'data');
  const base = `http://localhost:${String(out).match(/localhost:(\d+)/)![1]}`;
  const res = await fetch(`${base}/voice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: line() });
  assert.equal(res.status, 503); // no key in this test: the app uses the browser voice
  assert.equal((await fetch(`${base}/voice`)).status, 403); // only POST
});

test('with a cache folder each line calls ElevenLabs once, then plays from disk even without a key', async (t) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'bean-voice-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { fake, calls } = elevenlabs();
  assert.equal((await speak(line(), { key: 'k', fetch: fake, dir })).status, 200);
  const again = await speak(line(), { key: '', fetch: fake, dir });
  assert.equal(again.status, 200);
  assert.deepEqual([...(again.body as Uint8Array)], [0xff, 0xf3]);
  assert.equal(calls.length, 1);
  assert.equal((await speak(line('You moved!!'), { key: 'k', fetch: fake, dir })).status, 200);
  assert.equal(calls.length, 2);
});
