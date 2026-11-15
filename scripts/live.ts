// POST /live-token: a one-use ephemeral token for Talk with Bean's voice session (spec, section 15).
// The browser opens the Gemini Live WebSocket straight to Google with it, so the audio never passes through this
// server and the API key (GEMINI_API_KEY, loaded from .env by serve.ts) never reaches the browser.
// The token is good for one session, which must start within a minute; it expires after 30 minutes.
// shortcut: the token is not locked to Bean's model and settings (liveConnectConstraints); lock it if the app is ever served beyond localhost.
export async function liveToken(
  { key = process.env.GEMINI_API_KEY, fetch = globalThis.fetch }: { key?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<{ status: number; body: { token?: string; error?: string } }> {
  if (!key) return { status: 503, body: { error: 'Talk with Bean needs GEMINI_API_KEY in .env' } };
  const now = Date.now();
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, // the key in a header, never in a URL
      body: JSON.stringify({ uses: 1, expireTime: new Date(now + 30 * 60_000).toISOString(), newSessionExpireTime: new Date(now + 60_000).toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { name?: string };
    return res.ok && data.name ? { status: 200, body: { token: data.name } } : { status: 502, body: { error: `Google answered ${res.status}` } };
  } catch {
    return { status: 502, body: { error: 'could not reach Google' } };
  }
}
