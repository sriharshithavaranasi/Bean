// Talk with Bean on the Talk tab (spec, section 15): its settings, progress and the turn-by-turn game.
// main.ts starts it with playTalk and ends it with stopTalk.
import { KEEP_GOING, SCRIPTS, fixTalk, goodbye, nextLine, replyTo, turnsFor, type Said, type TalkSettings } from './game/talk.ts';
import { listenAny } from './speech.ts';
import { load, save } from './store.ts';

type Rgb = [number, number, number];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const GREEN: Rgb = [0, 255, 0]; // Bean is talking
const BLUE: Rgb = [0, 0, 255]; // Bean is listening: the kid's turn
const YELLOW: Rgb = [255, 200, 0]; // Bean is thinking (AI chat)
const WHITE: Rgb = [255, 255, 255];
const YOUR_TURN = 'Your turn! Say it out loud, or press Good try.';

$('talk').innerHTML = `
  <section class="card" aria-labelledby="talk-progress-h">
    <div class="head"><h2 id="talk-progress-h">Talk progress</h2><button id="talk-reset">Reset</button></div>
    <dl id="talk-totals">
      <div><dt>Talks</dt><dd id="tt-talks">0</dd></div>
      <div><dt>Turns taken</dt><dd id="tt-turns">0</dd></div>
      <div><dt>Heard by the mic</dt><dd id="tt-heard">0</dd></div>
    </dl>
  </section>
  <details id="talk-settings" class="card" open>
    <summary>Grown-up settings</summary>
    <fieldset class="choice"><legend>Practice</legend>
      ${Object.entries(SCRIPTS).map(([key, s]) => `<label><input type="radio" name="t-script" value="${key}"> ${s.label}</label>`).join('')}
    </fieldset>
    <div class="words"><label for="t-name">Kid's first name</label>
      <input id="t-name" type="text" autocomplete="off" spellcheck="false" maxlength="20" aria-describedby="t-name-help">
      <p id="t-name-help">Bean says it when it says hello. Empty: Bean says "friend".</p></div>
    <div class="words"><label for="t-wait">Wait for an answer <span class="vh">(seconds)</span></label>
      <input id="t-wait" type="number" inputmode="numeric" min="3" max="20" step="1" aria-describedby="t-wait-help">
      <p id="t-wait-help">Seconds, from 3 to 20. Bean then says the answer for the kid and waits again.</p></div>
    <div class="words"><label class="check"><input id="t-ai" type="checkbox" aria-describedby="t-ai-help"> AI chat with Gemini</label>
      <p id="t-ai-help">Bean makes up its own replies. What the kid says is sent to Google. Needs the Gemini key on this laptop and the internet; without them Bean uses its script.</p>
      <p id="t-ai-note"></p></div>
  </details>`;

// ---------- settings ----------
function readForm() {
  const picked = document.querySelector<HTMLInputElement>('input[name="t-script"]:checked');
  return fixTalk({ script: picked?.value, name: $<HTMLInputElement>('t-name').value, waitMs: Number($<HTMLInputElement>('t-wait').value) * 1000, ai: $<HTMLInputElement>('t-ai').checked });
}
function showForm(s: TalkSettings) {
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="t-script"]')) r.checked = r.value === s.script;
  $<HTMLInputElement>('t-name').value = s.name;
  $<HTMLInputElement>('t-wait').value = String(s.waitMs / 1000);
  $<HTMLInputElement>('t-ai').checked = s.ai;
}
const changed = () => {
  const s = readForm();
  save('bean-talk', s);
  showForm(s); // a bad value is fixed where the grown-up typed it
};
$('talk-settings').addEventListener('change', changed);
showForm(fixTalk(load('bean-talk', {})));

// ---------- progress ----------
const ZERO = { talks: 0, turns: 0, heard: 0 };
let totals = load('bean-talk-progress', ZERO);
type TalkTotal = keyof typeof ZERO;
const draw = () => (Object.keys(ZERO) as TalkTotal[]).forEach((k) => ($(`tt-${k}`).textContent = String(totals[k])));
const bump = (key: TalkTotal) => {
  totals[key]++;
  save('bean-talk-progress', totals);
  draw();
};
let resetArmed: ReturnType<typeof setTimeout> | undefined;
$('talk-reset').addEventListener('click', () => {
  clearTimeout(resetArmed);
  if ($('talk-reset').textContent === 'Reset') {
    $('talk-reset').textContent = 'Press again to clear'; // like Progress on Move: ask first
    resetArmed = setTimeout(() => ($('talk-reset').textContent = 'Reset'), 4000);
  } else {
    totals = { ...ZERO };
    save('bean-talk-progress', totals);
    draw();
    $('talk-reset').textContent = 'Reset';
  }
});
draw();

// ---------- AI chat ----------
// Asks the laptop's /talk (scripts/talk.ts) for Bean's next line. null when Gemini cannot answer within 3 seconds.
async function askBean(turns: Said[], name: string): Promise<string | null> {
  try {
    const res = await fetch('/talk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, turns: turns.slice(-8) }), signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return (await res.json()).reply ?? null;
    $('t-ai-note').textContent = res.status === 503
      ? 'No Gemini key on this laptop, so Bean used its script. Set GEMINI_API_KEY before npm start.'
      : 'Gemini did not answer, so Bean used its script.';
  } catch {
    $('t-ai-note').textContent = 'Gemini took too long or the internet is off, so Bean used its script.';
  }
  return null;
}

// ---------- the game ----------
let run = 0; // Stop and Start end the running talk by changing this
export const stopTalk = () => run++;

// show, say and light come from main.ts: the stage, the speaker and the robot's LED.
export async function playTalk({ show, say, light, goodtry }: {
  show: (phase: string, hint?: string, status?: string) => void;
  say: (text: string) => Promise<unknown>;
  light: (rgb: Rgb) => void;
  goodtry: HTMLElement;
}) {
  const mine = ++run;
  const alive = () => mine === run;
  const s = readForm();
  const beanSays = async (line: string, hint: string) => {
    light(GREEN);
    show('word', hint, line);
    await say(line);
  };
  // The kid's turn: Bean listens with its light blue. Resolves what was heard, '' for Good try, null for silence.
  const kidsTurn = async (line: string) => {
    light(BLUE);
    show('word', YOUR_TURN, line);
    return listenAny(goodtry, Promise.resolve(), s.waitMs);
  };

  const turns = turnsFor(s.script, s.name);
  if (s.ai) {
    if (await playAi()) end();
    return;
  }
  for (const [i, turn] of turns.entries()) {
    await beanSays(turn.bean, 'Listen to Bean.');
    if (!alive()) return;
    let heard = await kidsTurn(turn.bean);
    if (!alive()) return;
    if (heard === null) {
      await beanSays(turn.model, 'Bean shows an answer.'); // silence: model the answer, then listen once more
      if (!alive()) return;
      heard = await kidsTurn(turn.model);
      if (!alive()) return;
    }
    if (heard === null) {
      await beanSays(KEEP_GOING, 'That is okay.');
    } else {
      bump('turns');
      if (heard) bump('heard');
      await beanSays(replyTo(turn, heard, i), 'Bean answers.');
    }
    if (!alive()) return;
  }
  end();

  // AI chat: Gemini writes Bean's next line from the talk so far. Returns false when the talk was stopped.
  async function playAi() {
    $('t-ai-note').textContent = '';
    const history: Said[] = [];
    let line = turns[0].bean; // the chosen script still opens the talk
    for (const [i, turn] of turns.entries()) {
      history.push({ from: 'bean', text: line });
      await beanSays(line, 'Listen to Bean.');
      if (!alive()) return false;
      let heard = await kidsTurn(line);
      if (!alive()) return false;
      if (heard === null) {
        await beanSays('Take your time. You can say anything you like!', 'Bean waits for you.');
        if (!alive()) return false;
        heard = await kidsTurn(line);
        if (!alive()) return false;
      }
      const next = turns[i + 1];
      if (heard === null) {
        line = next ? `${KEEP_GOING} ${next.bean}` : KEEP_GOING;
        if (!next) await beanSays(line, 'That is okay.');
        continue;
      }
      bump('turns');
      if (heard) bump('heard');
      history.push({ from: 'kid', text: heard });
      if (!next) {
        await beanSays(replyTo(turn, heard, i), 'Bean answers.'); // the last turn ends with goodbye, not a new question
        return alive();
      }
      light(YELLOW);
      show('word', 'Bean is thinking.', line);
      ({ line } = await nextLine({ ask: (h) => askBean(h, s.name), history, turn, next, heard, i }));
      if (!alive()) return false;
    }
    return true;
  }

  function end() {
    bump('talks');
    light(WHITE);
    const bye = goodbye(s.name);
    show('win', 'Press Play again to talk some more.', bye);
    say(bye);
  }
}
