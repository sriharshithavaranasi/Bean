// The phone relay in scripts/serve.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

async function serve(t: TestContext, env: Record<string, string>) {
  const server = spawn(process.execPath, [fileURLToPath(new URL('serve.ts', import.meta.url))], {
    env: { ...process.env, PORT: '0', ...env },
  });
  t.after(() => server.kill());
  const [line] = await once(server.stdout, 'data');
  return `http://localhost:${String(line).match(/localhost:(\d+)/)![1]}`;
}
const post = (url: string, body: string) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('a phone press needs the code shown on the laptop', async (t) => {
  const base = await serve(t, { HOST: '127.0.0.1' });
  const { code } = await (await fetch(`${base}/relay/code`)).json();
  assert.match(code, /^\d{6}$/);

  // The laptop tab listens for presses.
  const reader = (await fetch(`${base}/relay/commands`)).body!.getReader();
  const pressWith = (c: string) => post(`${base}/relay/press?code=${c}`, '{"click":"start"}');

  assert.equal((await pressWith('000000' === code ? '111111' : '000000')).status, 403);
  assert.equal((await pressWith('')).status, 403);
  assert.equal((await fetch(`${base}/relay/state?code=nope`)).status, 403);
  assert.equal((await pressWith(code)).status, 204);
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {"click":"start"}\n\n');
  await reader.cancel();
});
