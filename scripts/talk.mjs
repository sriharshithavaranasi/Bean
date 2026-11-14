// POST /talk for Talk with Bean's AI chat (spec, section 15). The laptop tab sends the last few turns as text;
// this adds Bean's rules and the key from GEMINI_API_KEY, asks Gemini, and returns one short reply to speak.
// The key stays on the laptop: it is never sent to the browser.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'; // a fast Flash-Lite model: a kid is waiting
const MAX_TURNS = 12;
const MAX_TEXT = 300;

const rules = (name) => `You are Bean, a small friendly robot car helping a young child practise talking and taking turns.
The child's name is ${name || 'not given; call them friend'}. A grown-up is with them.
Reply in one or two short sentences with simple words a young child knows, then end with one easy question or an invitation to talk.
Be warm and encouraging. Never say an answer is wrong. If you did not understand, praise the try and ask something easy.
Talk only about animals, colours, food, toys, games, feelings, the weather, and the game you are playing.
Never ask for personal information such as where they live, their school, or their family's names.
If the child says something scary, unsafe or grown-up, do not discuss it: say something kind and steer back to an easy topic.
You are a robot, not a person, and you never pretend otherwise. No emoji, lists or special characters: your words are spoken aloud.`;

const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

// Only well-formed turns get through, ending with the kid's turn: Gemini must answer the kid, not continue Bean.
function parse(text) {
  let req;
  try {
    req = JSON.parse(text);
  } catch {
    return null;
  }
  const turns = req?.turns;
  const ok = Array.isArray(turns) && turns.length >= 1 && turns.length <= MAX_TURNS && turns.at(-1)?.from === 'kid' &&
    turns.every((t) => ['bean', 'kid'].includes(t?.from) && typeof t.text === 'string' && t.text.length <= MAX_TEXT);
  if (!ok) return null;
  return { name: String(req.name ?? '').replace(/[^\p{L} '-]/gu, '').trim().slice(0, 20), turns };
}

const geminiBody = ({ name, turns }) => ({
  systemInstruction: { parts: [{ text: rules(name) }] },
  contents: turns.map((t) => ({
    role: t.from === 'bean' ? 'model' : 'user',
    parts: [{ text: t.text || '(The child tried to answer, but the microphone did not catch the words.)' }], // Good try
  })),
  generationConfig: { maxOutputTokens: 120 },
  safetySettings: SAFETY,
});

// Plain speakable text: no markdown or emoji, up to the first question (at most three sentences), at most 200 characters.
export function cleanReply(text) {
  const plain = String(text ?? '').replace(/[^\p{L}\p{N}\s.,!?'’-]/gu, '').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  const sentences = plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g).map((s) => s.trim());
  const q = sentences.findIndex((s) => s.endsWith('?'));
  const out = (q >= 0 && q < 3 ? sentences.slice(0, q + 1) : sentences.slice(0, 2)).join(' ');
  return out.length > 200 ? `${out.slice(0, 199).replace(/\s+\S*$/, '')}.` : out;
}

// text: the request body (or null when it was not JSON). Returns { status, body } for the server to send.
export async function answer(text, { key = process.env.GEMINI_API_KEY, model = MODEL, fetch = globalThis.fetch } = {}) {
  if (!key) return { status: 503, body: { error: 'AI chat needs GEMINI_API_KEY set before npm start' } };
  const req = parse(text);
  if (!req) return { status: 400, body: { error: 'bad turns' } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiBody(req)),
      signal: AbortSignal.timeout(4000), // the app falls back to its script after 3 s anyway
    });
    if (!res.ok) return { status: 502, body: { error: `Gemini answered ${res.status}` } };
    const data = await res.json();
    const reply = cleanReply(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join(''));
    return reply ? { status: 200, body: { reply } } : { status: 502, body: { error: 'no reply (blocked or empty)' } };
  } catch {
    return { status: 502, body: { error: 'could not reach Gemini' } };
  }
}
