// The token route for Talk with Bean's voice (scripts/live.ts). Google is faked: no network, no key needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveToken } from './live.ts';

type Init = RequestInit & { headers: Record<string, string> };
const google = (status: number, json: object) => {
  const calls: { url: string; init: Init }[] = [];
  const fetch = (async (url: string, init: Init) => (calls.push({ url, init }), { ok: status === 200, status, json: async () => json })) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
};

test('without a key it answers 503 and never calls Google', async () => {
  const { fetch, calls } = google(200, { name: 'auth_tokens/x' });
  assert.equal((await liveToken({ key: '', fetch })).status, 503);
  assert.equal(calls.length, 0);
});

test('it returns a one-use token, with the key in a header and never in the URL or the answer', async () => {
  const { fetch, calls } = google(200, { name: 'auth_tokens/abc' });
  const res = await liveToken({ key: 'secret-key', fetch });
  assert.deepEqual(res, { status: 200, body: { token: 'auth_tokens/abc' } });
  const [{ url, init }] = calls;
  assert.doesNotMatch(url, /secret-key/);
  assert.equal(init.headers['x-goog-api-key'], 'secret-key');
  assert.equal(JSON.parse(String(init.body)).uses, 1);
  assert.equal(JSON.stringify(res).includes('secret-key'), false);
});

test('a Google error or no answer gives 502', async () => {
  assert.equal((await liveToken({ key: 'k', fetch: google(403, { error: {} }).fetch })).status, 502);
  const down = (async () => {
    throw new Error('offline');
  }) as unknown as typeof globalThis.fetch;
  assert.equal((await liveToken({ key: 'k', fetch: down })).status, 502);
});
