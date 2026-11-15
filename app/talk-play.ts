// Talk with Bean on the Talk tab (spec, section 15): a typed chat with Bean (Gemini, through POST /talk).
// Start needs the kid's first name, and the session ends when the play time limit runs out.
// Speaking style and Play Mad Libs are on the page (index.html) but nothing reads them yet.
import type { Mode, ModeContext } from './mode.ts';
import { say } from './signals.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Said = { from: 'bean' | 'kid'; text: string };
const MAX_TURNS = 12; // what scripts/talk.ts accepts

export function createTalk(ctx: ModeContext): Mode {
  const bubble = $('tab-talk').querySelector('path')!.getAttribute('d')!; // the Talk tab's speech bubble
  const time = $<HTMLInputElement>('t-time');
  const nameBox = $<HTMLInputElement>('t-name');
  const nameError = (show: boolean) => {
    $('t-name-error').hidden = !show;
    nameBox.setAttribute('aria-invalid', String(show));
  };
  nameBox.addEventListener('input', () => nameError(false));
  time.addEventListener('input', () => ($('t-time-out').textContent = `${time.value} min`)); // the label follows the slider

  let timer: ReturnType<typeof setInterval> | undefined;

  // ---------- chat ----------
  const log = $('chat-log');
  const input = $<HTMLInputElement>('chat-input');
  let name = '';
  let turns: Said[] = [];
  let session = 0; // Stop and Start change it, so a late reply never lands in the next session
  const add = (from: string, text: string) => {
    const line = Object.assign(document.createElement('li'), { className: from, textContent: text });
    log.append(line);
    log.scrollTop = log.scrollHeight;
    return line;
  };
  // Bean's reply from Gemini, or why there is none (no key, no internet, blocked).
  async function askBean(): Promise<{ reply?: string; error?: string }> {
    try {
      const res = await fetch('/talk', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, turns: turns.slice(-MAX_TURNS) }), signal: AbortSignal.timeout(15_000),
      });
      return await res.json();
    } catch {
      return { error: 'Bean could not be reached. Check the internet.' };
    }
  }
  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || ctx.shown() !== 'talk' || input.disabled) return;
    const mine = session;
    input.value = '';
    add('kid', text);
    turns.push({ from: 'kid', text });
    const wait = add('bean wait', 'Bean is thinking…');
    input.disabled = true;
    const { reply, error } = await askBean();
    if (mine !== session) return; // the session was stopped while Bean was thinking
    wait.remove();
    input.disabled = false;
    input.focus();
    if (reply) {
      add('bean', reply);
      turns.push({ from: 'bean', text: reply });
    } else add('bean wait', error === 'AI chat needs GEMINI_API_KEY set before npm start' ? 'Bean has no Gemini key on this laptop yet.' : `Bean could not answer (${error ?? 'no reply'}).`);
  });

  return {
    screen: {
      idle: { status: 'Talk with Bean', hint: 'Set the first name and the play time limit, then press Start.', glyph: bubble },
      talk: { status: 'Talking with Bean', hint: '', glyph: bubble },
      ended: { status: 'Time’s up!', hint: 'That is enough talking for now. Press Play again for a new session.', glyph: 'M7 5h10v14H7z' },
    },
    showsDistance: false,
    async start() {
      name = nameBox.value.trim();
      nameError(!name);
      if (!name) {
        nameBox.focus();
        return;
      }
      await ctx.robot().lookAtKid();
      session++;
      turns = [];
      log.replaceChildren();
      const hello = `Hi ${name}! I'm Bean. What do you want to talk about?`;
      add('bean', hello);
      turns.push({ from: 'bean', text: hello });
      input.disabled = false;
      // The play time limit: the session ends on its own, so a kid cannot keep going.
      const end = Date.now() + Number(time.value) * 60_000;
      let shownMinutes = -1;
      const tick = () => {
        const minutes = Math.ceil((end - Date.now()) / 60_000);
        if (minutes <= 0) {
          clearInterval(timer);
          ctx.show('ended');
          say(`Time's up! Bye ${name}, see you next time!`);
        } else if (minutes !== shownMinutes) {
          shownMinutes = minutes; // once a minute, so the spoken hint is not repeated every second
          ctx.show('talk', `${minutes} min left`, `Talking with ${name}`);
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      input.focus();
    },
    stop() {
      clearInterval(timer);
      session++;
    },
  };
}
