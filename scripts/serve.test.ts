// The phone relay and the car's WiFi bridge in scripts/serve.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
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

test('the WiFi bridge passes commands to the car, replies back, and keeps the heartbeat', async (t) => {
  // A pretend camera board: answers a distance read and records what it got.
  let got = '';
  const car = createServer((socket) => {
    socket.on('error', () => {}); // the bridge is killed when the test ends
    socket.on('data', (d) => {
      got += d;
      if (String(d).includes('"N":21')) socket.write('{Heartbeat}{5_37}');
    });
  }).listen(0, '127.0.0.1');
  t.after(() => car.close());
  await once(car, 'listening');
  const base = await serve(t, { CAR: `127.0.0.1:${(car.address() as AddressInfo).port}` });

  assert.equal((await post(`${base}/car/send`, '{"N":100}')).status, 409); // not connected yet
  const stream = await fetch(`${base}/car`);
  assert.equal(stream.status, 200);
  const reader = stream.body!.getReader();
  assert.equal((await post(`${base}/car/send`, '{"H":"5","N":21,"D1":2}')).status, 204);
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: "{Heartbeat}{5_37}"\n\n');
  await new Promise((r) => setTimeout(r, 1100));
  assert.match(got, /^\{"H":"5","N":21,"D1":2\}.*\{Heartbeat\}/);
  await reader.cancel();
});

test('the WiFi bridge says so when the car cannot be reached', async (t) => {
  const base = await serve(t, { CAR: '127.0.0.1:1' });
  assert.equal((await fetch(`${base}/car`)).status, 502);
});
