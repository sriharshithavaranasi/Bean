// Talk with Bean (spec, section 15): short scripted conversations for practising talking.
// Any answer moves on: recognition is weak on kids' voices, so Bean never says an answer was wrong.
import { matches } from '../speech.ts';

export type Turn = { bean: string; model: string; options: string[]; echo: string };
export type Said = { from: 'bean' | 'kid'; text: string };
export type TalkSettings = { script: ScriptKey; name: string; waitMs: number; ai: boolean };

// Each turn: what Bean says, the answer it models after a silence, words it listens for, and its reply
// when it hears one of them ({word} is the word it heard).
export const SCRIPTS: Record<'hello' | 'questions' | 'asking', { label: string; turns: Turn[] }> = {
  hello: {
    label: 'Hello',
    turns: [
      { bean: 'Hi {name}! I am Bean. Can you say hello?', model: 'You can say: hello Bean!', options: ['hello', 'hi', 'hey'], echo: '{word}! I am so happy to see you!' },
      { bean: 'How do you feel today?', model: 'You can say: I feel happy!', options: ['happy', 'good', 'great', 'okay', 'ok', 'sad', 'tired', 'silly', 'excited'], echo: 'You feel {word}. Thank you for telling me!' },
      { bean: 'Do you like to play games? Say yes or no.', model: 'You can say: yes!', options: ['yes', 'yeah', 'no', 'nope'], echo: '{word}! Thank you for telling me.' },
      { bean: 'Can you say my name? My name is Bean.', model: 'You can say: Bean!', options: ['bean'], echo: 'Bean! That is me!' },
      { bean: 'Can you say thank you?', model: 'You can say: thank you!', options: ['thank you', 'thanks'], echo: 'You are welcome!' },
      { bean: 'Time to go soon. Can you say bye bye?', model: 'You can say: bye bye Bean!', options: ['bye', 'goodbye', 'see you'], echo: '{word}! See you next time!' },
    ],
  },
  questions: {
    label: 'Questions',
    turns: [
      { bean: 'Hi {name}! What is your favourite colour?', model: 'You can say: blue!', options: ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white', 'brown'], echo: '{word}! I love {word} too!' },
      { bean: 'What animal do you like?', model: 'You can say: a dog!', options: ['dog', 'cat', 'fish', 'bird', 'horse', 'lion', 'tiger', 'bunny', 'rabbit', 'bear', 'elephant', 'dinosaur', 'unicorn'], echo: 'A {word}! What a great animal!' },
      { bean: 'What food do you like to eat?', model: 'You can say: pizza!', options: ['pizza', 'apple', 'apples', 'banana', 'pasta', 'rice', 'cookie', 'cookies', 'ice cream', 'chicken', 'noodles'], echo: 'Yum, {word}!' },
      { bean: 'What toy do you like to play with?', model: 'You can say: my ball!', options: ['ball', 'blocks', 'car', 'cars', 'doll', 'train', 'lego', 'bike', 'teddy'], echo: 'A {word} is so fun!' },
      { bean: 'What do you like to do outside?', model: 'You can say: run!', options: ['run', 'jump', 'swing', 'slide', 'play', 'walk', 'climb', 'dance'], echo: 'I like to {word} too!' },
      { bean: 'Is it day or night now?', model: 'You can say: day!', options: ['day', 'night', 'morning', 'afternoon'], echo: '{word}! Thank you for telling me!' },
    ],
  },
  asking: {
    label: 'Asking',
    turns: [
      { bean: 'Hi {name}! If you want a turn, ask me. Say: my turn please.', model: 'You can say: my turn please!', options: ['turn', 'please'], echo: 'Great asking! Here is your turn!' },
      { bean: 'Ask me to dance. Say: dance please!', model: 'You can say: dance please!', options: ['dance'], echo: 'Okay! Watch me dance!' },
      { bean: 'Ask me for a song. Say: sing please!', model: 'You can say: sing please!', options: ['sing', 'song'], echo: 'La la la! Thank you for asking!' },
      { bean: 'Ask me for help. Say: help please!', model: 'You can say: help please!', options: ['help'], echo: 'I can help! Thank you for asking.' },
      { bean: 'Ask me for more. Say: more please!', model: 'You can say: more please!', options: ['more'], echo: 'More it is! Great asking!' },
      { bean: 'Ask me to stop. Say: stop please!', model: 'You can say: stop please!', options: ['stop'], echo: 'Okay, I stopped. Thank you for telling me!' },
    ],
  },
};

const PRAISE = ['Great talking!', 'I love hearing your voice!', 'Thank you for telling me!', 'Nice try! You are doing great.'];
export const KEEP_GOING = 'That is okay! Let us keep going.'; // after the model answer is met with silence too
export type ScriptKey = keyof typeof SCRIPTS;
const friend = (name: string) => name || 'friend';
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const turnsFor = (script: ScriptKey, name: string): Turn[] => SCRIPTS[script].turns.map((t) => ({ ...t, bean: t.bean.replaceAll('{name}', friend(name)) }));
export const goodbye = (name: string) => `Bye ${friend(name)}! Great talking with you!`;

// heard: what the microphone heard, or null when a grown-up pressed Good try. i picks the praise, so it varies by turn.
export function replyTo(turn: Turn, heard: string | null, i: number) {
  const word = heard && turn.options.find((o) => matches(heard, [o]));
  return capital(word ? turn.echo.replaceAll('{word}', word) : PRAISE[i % PRAISE.length]);
}

// AI chat: Bean's next line. ask(history) resolves Gemini's reply, or null (no key, no internet, too slow);
// then Bean answers from its script and asks the next scripted question, so the talk never stalls.
export async function nextLine({ ask, history, turn, next, heard, i }: {
  ask: (history: Said[]) => Promise<string | null>; history: Said[]; turn: Turn; next: Turn | undefined; heard: string | null; i: number;
}) {
  const ai = await ask(history);
  if (ai) return { line: ai, fromAi: true };
  return { line: next ? `${replyTo(turn, heard, i)} ${next.bean}` : replyTo(turn, heard, i), fromAi: false };
}

// Saved settings are fixed, never trusted: a known script, a short plain first name, a wait of 3 to 20 seconds,
// and AI chat only when it was really switched on (it sends the kid's words to Google).
export function fixTalk(raw: Record<string, unknown> = {}): TalkSettings {
  const wait = raw.waitMs == null || raw.waitMs === '' ? NaN : Number(raw.waitMs);
  return {
    script: typeof raw.script === 'string' && Object.hasOwn(SCRIPTS, raw.script) ? (raw.script as ScriptKey) : 'hello',
    name: String(raw.name ?? '').replace(/[^\p{L} '-]/gu, '').trim().slice(0, 20),
    waitMs: Number.isFinite(wait) ? Math.min(20000, Math.max(3000, wait)) : 6000,
    ai: raw.ai === true,
  };
}
