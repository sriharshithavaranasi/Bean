// Serves app/ on localhost. Web Serial and the microphone need localhost or HTTPS.
// With --lan (or HOST set) it also listens on the local network and relays a phone remote to the laptop tab (spec, section 13).
import { randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { answer } from './talk.ts';
import { speak } from './voice.ts';

const root = join(import.meta.dirname, '..', 'app');
// A .ts file goes out as JavaScript: its types are stripped as it is served, so there is no build step.
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.ts': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const port = process.env.PORT ? Number(process.env.PORT) : 8000; // PORT=0 (tests) means any free port, not 8000
const host = process.env.HOST || (process.argv.includes('--lan') ? '0.0.0.0' : '');

// ---------- phone relay ----------
// The laptop tab posts its stage here and hears the phone's presses; a phone must send the code shown on the laptop.
const code = String(randomInt(0, 1e6)).padStart(6, '0');
let wrong = 0; // after 20 wrong codes no phone may connect until the server restarts
let stage = '{}';
const phones = new Set<ServerResponse>(); // open event streams: the stage goes out to these
const laptops = new Set<ServerResponse>(); // the phone's presses go out to these
const send = (streams: Set<ServerResponse>, data: string) => streams.forEach((res) => res.write(`data: ${data}\n\n`));
function stream(req: IncomingMessage, res: ServerResponse, set: Set<ServerResponse>) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }).flushHeaders(); // headers go out now, before any event
  set.add(res);
  req.on('close', () => set.delete(res));
}
const loopback = (req: IncomingMessage) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') &&
  /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? ''); // the Host check stops DNS rebinding
const codeOk = (url: URL) => {
  if (wrong >= 20) return false;
  if (url.searchParams.get('code') === code) return true;
  wrong++;
  return false;
};
async function body(req: IncomingMessage) {
  // A JSON content type keeps other sites' pages from posting here without a CORS preflight, which is never answered.
  if (!req.headers['content-type']?.startsWith('application/json')) return null;
  let text = '';
  for await (const chunk of req) if ((text += chunk).length > 8000) return null;
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}
async function relay(req: IncomingMessage, res: ServerResponse, url: URL) {
  const route = `${req.method} ${url.pathname}`;
  if (route === 'GET /relay/code' && loopback(req)) {
    const ips = Object.values(networkInterfaces()).flatMap((list) => list ?? []).filter((a) => a.family === 'IPv4' && !a.internal);
    return res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({ code, urls: ips.map((a) => `http://${a.address}:${(server.address() as AddressInfo).port}/?code=${code}`) }),
    );
  }
  if (route === 'GET /relay/commands' && loopback(req)) return stream(req, res, laptops);
  if (route === 'POST /relay/state' && loopback(req)) {
    const data = await body(req);
    if (!data) return res.writeHead(400).end();
    send(phones, (stage = data));
    return res.writeHead(204).end();
  }
  if (!codeOk(url)) return res.writeHead(403).end();
  if (route === 'GET /relay/state') {
    stream(req, res, phones);
    return res.write(`data: ${stage}\n\n`);
  }
  if (route === 'POST /relay/press') {
    const data = await body(req);
    if (!data) return res.writeHead(400).end();
    send(laptops, data); // the laptop tab checks what the press may do
    return res.writeHead(204).end();
  }
  res.writeHead(404).end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/relay/')) return host ? relay(req, res, url) : res.writeHead(404).end();
  if (url.pathname === '/talk') {
    // Talk with Bean's AI chat (scripts/talk.ts): only the laptop tab may use it, so the key is never used for a phone.
    if (!loopback(req) || req.method !== 'POST') return res.writeHead(403).end();
    const { status, body: out } = await answer(await body(req));
    return res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(out));
  }
  if (url.pathname === '/voice') {
    // Bean's ElevenLabs voice (scripts/voice.ts): laptop only, like /talk, so the key is never used for a phone.
    if (!loopback(req) || req.method !== 'POST') return res.writeHead(403).end();
    const { status, type, body: out } = await speak(await body(req), { dir: join(import.meta.dirname, '..', '.voice-cache') });
    return res.writeHead(status, { 'content-type': type }).end(out);
  }
  const path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const file = path.endsWith(sep) ? join(path, 'index.html') : path;
    const body = await readFile(file);
    const ts = extname(file) === '.ts';
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(ts ? stripTypeScriptTypes(String(body)) : body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, host || '127.0.0.1', () => {
  console.log(`Bean: http://localhost:${(server.address() as AddressInfo).port}`);
  if (host) console.log(`Phone remote is on. The laptop tab shows the address and code ${code}.`);
});
