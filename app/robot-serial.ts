// Web Serial transport (Chrome or Edge on a laptop). The shield's switch must be on "upload", or the car hears nothing.
import { makeLink } from './robot.ts';

export async function connectSerial(onLost: () => void) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  // Opening the port resets the UNO; it needs about 2 s to boot.
  await new Promise((r) => setTimeout(r, 2000));

  const writer = port.writable.getWriter();
  // The real car answers an LED command in up to 600 ms (measured over the cable), so wait 800.
  const link = makeLink((text) => writer.write(new TextEncoder().encode(text)), 800);

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
