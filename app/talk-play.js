// Talk with Bean on the Talk tab (spec, section 15): its settings, progress and the turn-by-turn game.
// main.js starts it with playTalk and ends it with stopTalk, like a Robot Says round.
import { KEEP_GOING, SCRIPTS, fixTalk, goodbye, replyTo, turnsFor } from './game/talk.js';
import { listenAny } from './speech.js';
import { load, save } from './store.js';

const $ = (id) => document.getElementById(id);
const GREEN = [0, 255, 0]; // Bean is talking
const BLUE = [0, 0, 255]; // Bean is listening: the kid's turn
const WHITE = [255, 255, 255];
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
  </details>`;

// ---------- settings ----------
function readForm() {
  const picked = document.querySelector('input[name="t-script"]:checked');
  return fixTalk({ script: picked?.value, name: $('t-name').value, waitMs: $('t-wait').value * 1000 });
}
function showForm(s) {
  for (const r of document.querySelectorAll('input[name="t-script"]')) r.checked = r.value === s.script;
  $('t-name').value = s.name;
  $('t-wait').value = s.waitMs / 1000;
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
const draw = () => Object.keys(ZERO).forEach((k) => ($(`tt-${k}`).textContent = totals[k]));
const bump = (key) => {
  totals[key]++;
  save('bean-talk-progress', totals);
  draw();
};
let resetArmed;
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

// ---------- the game ----------
let run = 0; // Stop and Start end the running talk by changing this
export const stopTalk = () => run++;

// show, say and light come from main.js: the stage, the speaker and the robot's LED.
export async function playTalk({ show, say, light, goodtry }) {
  const mine = ++run;
  const alive = () => mine === run;
  const s = readForm();
  const beanSays = async (line, hint) => {
    light(GREEN);
    show('word', hint, line);
    await say(line);
  };
  // The kid's turn: Bean listens with its light blue. Resolves what was heard, '' for Good try, null for silence.
  const kidsTurn = async (line) => {
    light(BLUE);
    show('word', YOUR_TURN, line);
    return listenAny(goodtry, Promise.resolve(), s.waitMs);
  };

  for (const [i, turn] of turnsFor(s.script, s.name).entries()) {
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
  bump('talks');
  light(WHITE);
  const bye = goodbye(s.name);
  show('win', 'Press Play again to talk some more.', bye);
  say(bye);
}
