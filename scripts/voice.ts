// POST /voice: Bean's lines spoken in the ElevenLabs voice. The laptop tab sends one line as text; this adds the key
// from ELEVENLABS_API_KEY and returns the line as MP3. The key stays on the laptop.
// serve.ts loads the .env file (ELEVENLABS_API_KEY=...) at start. Without a key /voice answers 503
// and the app uses the browser's own voice.
// With dir set (serve.ts sets .voice-cache/), each line is saved as an MP3 the first time, so a repeated line
// ("Red light!") never calls ElevenLabs again and plays even without a key.
// shortcut: every line is kept and nothing is ever deleted; prune when the folder grows large.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_TEXT = 300;

// text: the request body (or null when it was not JSON). Returns { status, type, body } for the server to send.
export async function speak(
  text: string | null,
  {
    key = process.env.ELEVENLABS_API_KEY,
    voice = process.env.ELEVENLABS_VOICE_ID || 'PKtsQbgKDa44YlyHnywy', // Bean's voice
    model = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5', // the low-latency model: cues like "Red light!" must land on time
    fetch = globalThis.fetch,
    dir,
  }: { key?: string; voice?: string; model?: string; fetch?: typeof globalThis.fetch; dir?: string } = {},
): Promise<{ status: number; type: string; body: Uint8Array | string }> {
  const fail = (status: number, error: string) => ({ status, type: 'application/json', body: JSON.stringify({ error }) });
  let line: unknown;
  try {
    line = JSON.parse(text ?? '')?.text;
  } catch {
    // not JSON: answered below
  }
  if (typeof line !== 'string' || !line.trim() || line.length > MAX_TEXT) return fail(400, 'bad text');
  const name = createHash('sha256').update(`${voice}
${model}
${line}`).digest('hex').slice(0, 20);
  const file = dir && join(dir, `${name}.mp3`);
  if (file) {
    try {
      return { status: 200, type: 'audio/mpeg', body: new Uint8Array(await readFile(file)) };
    } catch {
      // not saved yet: ask ElevenLabs below
    }
  }
  if (!key) return fail(503, 'Bean’s voice needs ELEVENLABS_API_KEY set before npm start');
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({ text: line, model_id: model }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return fail(502, `ElevenLabs answered ${res.status}`);
    const mp3 = new Uint8Array(await res.arrayBuffer());
    if (dir && file) await mkdir(dir, { recursive: true }).then(() => writeFile(file, mp3)).catch(() => {}); // not saved: the line is fetched again next time
    return { status: 200, type: 'audio/mpeg', body: mp3 };
  } catch {
    return fail(502, 'could not reach ElevenLabs');
  }
}
