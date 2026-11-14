// The phone relay: a press reaches the laptop tab only with the code the laptop shows.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

test('a phone press needs the code shown on the laptop', async (t) => {
  const server = spawn(process.execPath, [new URL('serve.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
  });
  t.after(() => server.kill());
  const [line] = await once(server.stdout, 'data');
  const base = `http://localhost:${String(line).match(/localhost:(\d+)/)[1]}`;

  const { code } = await (await fetch(`${base}/relay/code`)).json();
  assert.match(code, /^\d{6}$/);

  // The laptop tab listens for presses.
  const laptop = await fetch(`${base}/relay/commands`);
  const reader = laptop.body.getReader();
  const pressWith = (c) =>
    fetch(`${base}/relay/press?code=${c}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"click":"start"}' });

  assert.equal((await pressWith('000000' === code ? '111111' : '000000')).status, 403);
  assert.equal((await pressWith('')).status, 403);
  assert.equal((await fetch(`${base}/relay/state?code=nope`)).status, 403);
  assert.equal((await pressWith(code)).status, 204);
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {"click":"start"}\n\n');
  await reader.cancel();
});
