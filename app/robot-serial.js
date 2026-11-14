// Web Serial transport (Chrome or Edge on a laptop). Untested on the real car: see issue #6.
import { makeRobot, parseReplies } from './robot.js';

const REPLY_MS = 500;

export async function connectSerial(onLost) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  // Opening the port resets the UNO; it needs about 2 s to boot.
  await new Promise((r) => setTimeout(r, 2000));

  const writer = port.writable.getWriter();
  const waiting = new Map(); // id -> resolve
  let nextId = 1;

  (async () => {
    const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseReplies(buffer + value);
        buffer = parsed.rest;
        for (const { id, value: v } of parsed.replies) {
          waiting.get(id)?.(v);
          waiting.delete(id);
        }
      }
    } catch {
      // cable pulled: fall through
    }
    onLost();
  })();

  // A missing reply resolves to null after REPLY_MS; it never throws or stalls the game.
  async function send(command, wantReply) {
    const id = String(nextId++);
    const reply = wantReply
      ? new Promise((resolve) => {
          waiting.set(id, resolve);
          setTimeout(() => {
            waiting.delete(id);
            resolve(null);
          }, REPLY_MS);
        })
      : null;
    try {
      await writer.write(new TextEncoder().encode(JSON.stringify({ H: id, ...command })));
    } catch {
      return null;
    }
    return reply;
  }

  return makeRobot(send);
}
