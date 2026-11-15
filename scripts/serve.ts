// Serves app/ on localhost only. Web Serial and the microphone need localhost or HTTPS.
import { createServer, type IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { liveToken } from './live.ts';
import { speak } from './voice.ts';

// Each laptop keeps its keys in a .env file in the repo folder, which git ignores (.env.example lists them).
try {
  process.loadEnvFile(new URL('../.env', import.meta.url)); // does not replace a variable that is already set
} catch {
  // no .env: /live-token and /voice answer 503, and Bean speaks in the browser voice
}

const root = join(import.meta.dirname, '..', 'app');
// A .ts file goes out as JavaScript: its types are stripped as it is served, so there is no build step.
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.ts': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const port = process.env.PORT ? Number(process.env.PORT) : 8000; // PORT=0 (tests) means any free port, not 8000

// /live-token and /voice spend API keys, so they answer only this laptop's own tab.
const loopback = (req: IncomingMessage) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') &&
  /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? ''); // the Host check stops DNS rebinding
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
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/live-token') {
    // Talk with Bean's voice: a one-use token, so the browser talks to Google without the key (scripts/live.ts).
    if (!loopback(req) || req.method !== 'POST') return res.writeHead(403).end();
    const { status, body: out } = await liveToken();
    return res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(out));
  }
  if (url.pathname === '/voice') {
    // Bean's ElevenLabs voice (scripts/voice.ts): this laptop only.
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
}).listen(port, '127.0.0.1', () => {
  console.log(`Bean: http://localhost:${(server.address() as AddressInfo).port}`);
});
