// Web Serial transport (Chrome or Edge on a laptop). Untested on the real car: see issue #6.
import { makeLink } from './robot.js';

export async function connectSerial(onLost) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  // Opening the port resets the UNO; it needs about 2 s to boot.
  await new Promise((r) => setTimeout(r, 2000));

  const writer = port.writable.getWriter();
  const link = makeLink((text) => writer.write(new TextEncoder().encode(text)));

  (async () => {
    const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        link.receive(value);
      }
    } catch {
      // cable pulled: fall through
    }
    onLost();
  })();

  return link.robot;
}
