// Browser APIs that TypeScript's DOM types leave out. Only what Bean uses.

// Web Serial (Chrome and Edge): robot-serial.ts.
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>; // null only before open() and after close()
  readonly writable: WritableStream<Uint8Array>;
}
interface Navigator {
  readonly serial: { requestPort(): Promise<SerialPort> };
}
