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

// Speech recognition (Chrome names it webkitSpeechRecognition): speech.ts.
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: Iterable<Iterable<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  abort(): void;
}
declare var SpeechRecognition: (new () => Recognizer) | undefined;
declare var webkitSpeechRecognition: (new () => Recognizer) | undefined;
