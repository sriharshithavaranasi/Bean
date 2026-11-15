// POST /voice: Bean's lines spoken in the ElevenLabs voice. The laptop tab sends one line as text; this adds the key
// from ELEVENLABS_API_KEY and returns the line as MP3. The key stays on the laptop, as with /talk.
// talk.ts loads the .env file (ELEVENLABS_API_KEY=...) before the first request. Without a key /voice answers 503
// and the app uses the browser's own voice.
const MAX_TEXT = 300;

// text: the request body (or null when it was not JSON). Returns { status, type, body } for the server to send.
export async function speak(
  text: string | null,
  {
    key = process.env.ELEVENLABS_API_KEY,
    voice = process.env.ELEVENLABS_VOICE_ID || 'PKtsQbgKDa44YlyHnywy', // Bean's voice
    model = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5', // the low-latency model: cues like "Red light!" must land on time
    fetch = globalThis.fetch,
  }: { key?: string; voice?: string; model?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<{ status: number; type: string; body: Uint8Array | string }> {
  const fail = (status: number, error: string) => ({ status, type: 'application/json', body: JSON.stringify({ error }) });
  if (!key) return fail(503, 'Bean’s voice needs ELEVENLABS_API_KEY set before npm start');
  let line: unknown;
  try {
    line = JSON.parse(text ?? '')?.text;
  } catch {
    // not JSON: answered below
  }
  if (typeof line !== 'string' || !line.trim() || line.length > MAX_TEXT) return fail(400, 'bad text');
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({ text: line, model_id: model }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return fail(502, `ElevenLabs answered ${res.status}`);
    return { status: 200, type: 'audio/mpeg', body: new Uint8Array(await res.arrayBuffer()) };
  } catch {
    return fail(502, 'could not reach ElevenLabs');
  }
}
