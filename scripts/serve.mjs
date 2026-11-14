// Serves app/ on localhost. Web Serial and the microphone need localhost or HTTPS.
// With --lan (or HOST set) it also listens on the local network and relays a phone remote to the laptop tab (spec, section 13).
import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';

const root = join(import.meta.dirname, '..', 'app');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const port = process.env.PORT || 8000;
const host = process.env.HOST || (process.argv.includes('--lan') ? '0.0.0.0' : '');

// ---------- phone relay ----------
// The laptop tab posts its stage here and hears the phone's presses; a phone must send the code shown on the laptop.
const code = String(randomInt(0, 1e6)).padStart(6, '0');
let wrong = 0; // after 20 wrong codes no phone may connect until the server restarts
let stage = '{}';
const phones = new Set(); // open event streams: the stage goes out to these
const laptops = new Set(); // the phone's presses go out to these
const send = (streams, data) => streams.forEach((res) => res.write(`data: ${data}\n\n`));
function stream(req, res, set) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }).flushHeaders(); // headers go out now, before any event
  set.add(res);
  req.on('close', () => set.delete(res));
}
const loopback = (req) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
  /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host); // the Host check stops DNS rebinding
const codeOk = (url) => {
  if (wrong >= 20) return false;
  if (url.searchParams.get('code') === code) return true;
  wrong++;
  return false;
};
async function body(req) {
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
async function relay(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  if (route === 'GET /relay/code' && loopback(req)) {
    const ips = Object.values(networkInterfaces()).flat().filter((a) => a.family === 'IPv4' && !a.internal);
    return res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({ code, urls: ips.map((a) => `http://${a.address}:${server.address().port}/?code=${code}`) }),
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

// ---------- car over WiFi ----------
// The camera board on the car makes its own WiFi and passes JSON commands on TCP port 100 to the main board.
// It drops a client that does not send {Heartbeat} for about 4 seconds. Only the laptop tab may use this.
const [carHost, carPort = 100] = (process.env.CAR || '192.168.4.1').split(':');
let car = null; // the one open connection to the car
function openCar(req, res) {
  car?.destroy(); // a new tab takes over the car
  const socket = (car = connect({ host: carHost, port: Number(carPort), timeout: 4000 }));
  let heard = Date.now();
  // Our heartbeat keeps the car's side open; the car beats every second, so 4 quiet seconds mean it is gone.
  const beat = setInterval(() => (Date.now() - heard > 4000 ? socket.destroy() : socket.write('{Heartbeat}')), 1000);
  socket.on('connect', () => {
    socket.setTimeout(0);
    heard = Date.now();
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }).flushHeaders();
  });
  socket.on('data', (d) => {
    heard = Date.now();
    res.write(`data: ${JSON.stringify(String(d))}\n\n`);
  });
  socket.on('timeout', () => socket.destroy()); // could not connect in 4 seconds
  socket.on('error', () => {}); // close follows
  socket.on('close', () => {
    clearInterval(beat);
    if (car === socket) car = null;
    res.headersSent ? res.end() : res.writeHead(502).end();
  });
  req.on('close', () => socket.destroy());
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/relay/')) return host ? relay(req, res, url) : res.writeHead(404).end();
  if (url.pathname === '/car' || url.pathname === '/car/send') {
    if (!loopback(req)) return res.writeHead(403).end();
    if (req.method === 'GET' && url.pathname === '/car') return openCar(req, res);
    const data = req.method === 'POST' && url.pathname === '/car/send' && (await body(req));
    if (!data || !car) return res.writeHead(data ? 409 : 400).end();
    car.write(data);
    return res.writeHead(204).end();
  }
  const path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const file = path.endsWith(sep) ? join(path, 'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, host || '127.0.0.1', () => {
  console.log(`Bean: http://localhost:${server.address().port}`);
  if (host) console.log(`Phone remote is on. The laptop tab shows the address and code ${code}.`);
});
