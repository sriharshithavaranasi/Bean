import { createGame } from './game/freeze-watcher.js';
import { COMMANDS, did, makeCommands, outcome, total } from './game/robot-says.js';
import { createSteps } from './game/steps.js';
import { makeMockRobot } from './robot-mock.js';
import { connectSerial } from './robot-serial.js';
import { connectWifi } from './robot-wifi.js';
import { playCue, praise, say, silence, unlockAudio } from './signals.js';
import { canHear, listenFor, stopListening } from './speech.js';
import { fixSettings, LIMITS, load, roundSettings, save } from './store.js';

const $ = (id) => document.getElementById(id);
// A phone opens the laptop's address with ?code=: it is then only a remote for the game running on the laptop.
const remote = new URLSearchParams(location.search).get('code');
const send = (press) =>
  fetch(`/relay/press?code=${encodeURIComponent(remote)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(press),
  }).catch(() => {});

// Glyphs are a second cue beside colour: face = ready, arrow = go, bars = freeze, eye = seen, speech bubble = say the word, star = win.
const SCREEN = {
  // The idle status names the chosen game (show).
  idle: { hint: 'Stand on the start line, then press Start.', glyph: 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z' },
  green: { status: 'Green light!', hint: 'Bean is not looking. Sneak closer!', glyph: 'M12 4l7 8h-4v8H9v-8H5z' },
  red: { status: 'Red light!', hint: 'Bean is looking. Freeze!', glyph: 'M7 5h4v14H7zM13 5h4v14h-4z' },
  caught: { status: 'I saw you!', hint: 'Go back to the start line.', glyph: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  word: { status: 'Say your word', hint: 'Say it out loud, or press Good try.', glyph: 'M4 4h16v12h-9l-5 4v-4H4z' },
  // Robot Says: the command itself is the status line.
  says: { hint: 'Listen for “Robot says”.', glyph: 'M4 4h16v12h-9l-5 4v-4H4z' },
  wave: { hint: 'Grown-up: press They did it or Not yet.', glyph: 'M4 4h16v12h-9l-5 4v-4H4z' },
  point: { status: 'Yes!', hint: 'You did what Bean said.', glyph: 'M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z' },
  gotcha: { status: 'Gotcha!', hint: 'Bean did not say “Robot says”.', glyph: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  miss: { status: 'Not this time', hint: 'Bean said “Robot says”. Try the next one!', glyph: 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 15h10v2H7z' },
  win: { status: 'You got me!', hint: 'You reached Bean!', glyph: 'M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z' },
};
const LIGHT = { green: [0, 255, 0], red: [255, 0, 0], caught: [255, 80, 0], word: [0, 0, 255], win: [255, 255, 255], point: [0, 255, 0], gotcha: [255, 80, 0], miss: [0, 0, 255] };

// ---------- grown-up settings ----------
// field id -> [game setting, how many of the game's units one of the field's units is]
const FIELDS = {
  greenMin: ['greenMinMs', 1000], greenMax: ['greenMaxMs', 1000], settle: ['settleMs', 1000],
  look: ['lookMs', 1000], leewayCm: ['leewayCm', 1], winCm: ['winCm', 1], steps: ['steps', 1], doIt: ['doMs', 1000],
};
const rulers = {};
const talking = () => $('tab-talk').getAttribute('aria-selected') === 'true';
function settings() {
  const raw = {
    input: $('s-switch').checked ? 'switch' : 'body', game: $('s-says').checked ? 'says' : $('s-sneak').checked ? 'sneak' : 'freeze',
    words: $('s-words').value, tab: talking() ? 'talk' : 'move',
  };
  for (const [id, [key, unit]] of Object.entries(FIELDS)) {
    const v = $(`s-${id}`).value;
    raw[key] = v === '' ? null : Math.round(v * unit);
  }
  return fixSettings(raw);
}
// The boxes show what the next round will really use: a bad value is fixed where the grown-up typed it.
function showSettings(s) {
  for (const [id, [key, unit]] of Object.entries(FIELDS)) $(`s-${id}`).value = rulers[id].value = s[key] / unit;
  $('s-switch').checked = s.input === 'switch';
  $('s-body').checked = s.input !== 'switch';
  // Only the settings the chosen game uses are shown; the hidden ones keep their values.
  const unused = { freeze: ['doIt'], sneak: ['greenMin', 'greenMax', 'doIt'], says: ['greenMin', 'greenMax', 'settle', 'look', 'winCm', 'steps'] }[s.game];
  for (const id of Object.keys(FIELDS)) $(`s-${id}`).closest('.field').hidden = unused.includes(id) || (id === 'steps' && s.input !== 'switch');
  // Only Say It to Sneak asks for practice words.
  $('s-words').closest('.words').hidden = $('t-words').parentElement.hidden = s.game !== 'sneak';
  $(`s-${s.game}`).checked = true;
  $('s-words').value = s.words.join(', ');
  for (const tab of ['move', 'talk']) {
    $(`tab-${tab}`).setAttribute('aria-selected', s.tab === tab);
    $(`tab-${tab}`).tabIndex = s.tab === tab ? 0 : -1;
    $(`panel-${tab}`).hidden = s.tab !== tab;
  }
}
function settingChanged(s = settings()) {
  if (remote) send({ settings: s });
  showSettings(s);
  save('bean-settings', s);
  drawTrack();
  if (shown === 'idle') show('idle');
}
for (const [id, [key, unit]] of Object.entries(FIELDS)) {
  const input = $(`s-${id}`);
  [input.min, input.max] = LIMITS[key].map((n) => n / unit);
  // The − and + buttons and the drag ruler all drive this one number box.
  const name = input.labels[0].firstChild.textContent.trim();
  const ruler = (rulers[id] = Object.assign(document.createElement('input'), {
    type: 'range', className: 'ruler', min: input.min, max: input.max, step: input.step || 1, tabIndex: -1,
  }));
  ruler.setAttribute('aria-hidden', 'true'); // same value as the number box, for pointers only
  const changed = () => input.dispatchEvent(new Event('change'));
  const stepper = (text, label, step) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text });
    b.setAttribute('aria-label', `${label}: ${name}`);
    b.addEventListener('click', () => (step(), changed()));
    return b;
  };
  const num = input.closest('.num');
  num.prepend(stepper('−', 'Less', () => input.stepDown()));
  num.append(stepper('+', 'More', () => input.stepUp()), ruler);
  ruler.addEventListener('input', () => ((input.value = ruler.value), changed()));
  input.addEventListener('change', () => settingChanged());
}
for (const id of ['s-body', 's-switch', 's-freeze', 's-sneak', 's-says', 's-words']) $(id).addEventListener('change', () => settingChanged());
showSettings(fixSettings(load('bean-settings', {})));
if (matchMedia('(min-width: 860px)').matches) $('settings').open = true;

// ---------- progress ----------
// caught is counted but never shown (spec, section 10). words = every try, heard = the tries the microphone caught itself.
const ZERO = { rounds: 0, wins: 0, freezes: 0, words: 0, heard: 0, caught: 0 };
let totals = load('bean-progress', ZERO);
function drawTotals() {
  for (const dd of document.querySelectorAll('#totals dd')) dd.textContent = totals[dd.id.slice(2)];
}
function bump(key) {
  totals[key]++;
  save('bean-progress', totals);
  drawTotals();
}
let resetArmed;
$('reset').addEventListener('click', () => {
  clearTimeout(resetArmed);
  if ($('reset').textContent === 'Reset') {
    // Ask first: a second press within 4 seconds clears the totals.
    $('reset').textContent = 'Press again to clear';
    resetArmed = setTimeout(() => ($('reset').textContent = 'Reset'), 4000);
  } else {
    totals = { ...ZERO };
    save('bean-progress', totals);
    drawTotals();
    $('reset').textContent = 'Reset';
  }
});
drawTotals();

// ---------- robot ----------
const mock = makeMockRobot(
  () => Number($('distance').value),
  ({ head, light }) => {
    if (head != null) $('mock-head').textContent = head === 90 ? 'Bean is facing the kid' : 'Bean is looking away';
    if (light) $('mock-light').style.background = light;
  },
);
let robot = mock;
let game = createGame();
let shown = 'idle';

// Start, Stop and the game tick all talk to the robot: run them one after another.
let chain = Promise.resolve();
const queued = (job) => (chain = chain.then(job).catch((e) => console.error(e)));

// ---------- switch input ----------
let wonAt = 0;
let saysOn = false; // a Robot Says round is being played
let pressed = false;
let steps = null; // the kid's piece on the track, while a round is played from a switch
// During a round the round's own way of moving counts; the setting only applies to the next round.
const switchOn = () => !!steps || (!saysOn && !talking() && ['idle', 'win'].includes(game.phase) && $('s-switch').checked);
const SWITCH_HINT = {
  idle: 'Press the switch to start.', green: 'Bean is not looking. Press to step closer!',
  caught: 'Your piece is back at the start. Press the switch to go again.',
};
function drawCells(at, count, text) {
  $('track-cells').replaceChildren(
    ...Array.from({ length: count }, (_, i) => Object.assign(document.createElement('span'), { className: i < at ? 'on' : '' })),
  );
  $('track-text').textContent = text;
}
function drawTrack() {
  if (saysOn) return; // Robot Says counts its commands on the track
  const on = switchOn();
  $('track').hidden = $('step').hidden = !on;
  $('readout').hidden = on || talking(); // Talk has no distance to show
  const at = steps ? steps.at : 0;
  const count = steps ? steps.total : Number($('s-steps').value);
  drawCells(at, count, `Step ${at} of ${count}`);
}
function press() {
  if (remote) return send({ click: 'step' });
  const now = performance.now();
  // The switch starts the round itself: from idle, and once the win has been up for 2 seconds.
  if (shown === 'idle' || (shown === 'win' && now - wonAt >= 2000)) return start();
  if (!steps) return;
  if (saysOn) {
    pressed = true; // Robot Says only asks: was the switch pressed during this command?
    return;
  }
  const what = steps.press(game.phase, game.checking(now));
  if (what === 'caught') game.caught(now);
  if (what === 'ready') game.ready(now);
  if (what === 'win') {
    game.win();
    wonAt = now;
  }
  if (!what) return;
  drawTrack();
  // The tick may already have shown this phase; it never shows a win it did not decide.
  queued(async () => {
    if (game.phase !== shown && game.phase !== 'idle') await enter(game.phase);
  });
}
// The switch is Space, Enter or the Step button. In switch mode those keys start and step instead of pressing Start;
// they still work as usual in a form field and on the other buttons, so Stop stays reachable by keyboard.
// For 2 seconds after a win they do nothing (press), so a kid still pressing does not skip the win by starting again.
const isSwitchKey = (e) =>
  switchOn() && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('input, select, textarea, summary, button:not(#start, #step)');
addEventListener('keydown', (e) => {
  if (!isSwitchKey(e)) return;
  e.preventDefault();
  if (!e.repeat) press(); // a held key is one press, also the one that started the round
});
addEventListener('keyup', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  if (isSwitchKey(e)) e.preventDefault(); // Space clicks a focused button on key up
  steps?.release();
});
$('step').addEventListener('click', (e) => {
  if (e.detail === 0) return; // keyboard click: the key handlers above already counted it
  press();
  steps?.release();
});

const chosenGame = () => document.querySelector('[name="s-game"]:checked').labels[0].textContent.trim();
let restartUntil = 0; // Restart was pressed once: a second press before this time restarts
const startLabel = () =>
  ($('start').textContent =
    shown === 'win' ? 'Play again' : shown === 'idle' ? 'Start' : performance.now() < restartUntil ? 'Press again to restart' : 'Restart');
let tabUntil = 0; // a tab was pressed once during a round: a second press before this time stops the round and switches
let tabWarn = '';
let shownHint = '';
const idleStatus = () => (talking() ? 'Talk with Bean' : `Let’s play ${chosenGame()}`);
function show(phase, hint = talking() ? 'Coming soon.' : (switchOn() && SWITCH_HINT[phase]) || SCREEN[phase].hint, status = phase === 'idle' ? idleStatus() : SCREEN[phase].status) {
  shown = phase;
  document.body.dataset.phase = phase;
  $('status').textContent = status;
  shownHint = hint;
  $('hint').textContent = performance.now() < tabUntil && !['idle', 'win'].includes(phase) ? tabWarn : hint;
  // shortcut: Talk with Bean is not built yet, the speech area fills it in and shows Start and Stop again.
  $('controls').hidden = talking();
  $('glyph-path').setAttribute('d', SCREEN[phase].glyph);
  if (phase === 'idle' || phase === 'win') restartUntil = 0;
  startLabel();
  $('step').textContent = phase === 'idle' ? 'Start' : phase === 'win' ? 'Play again' : 'Step';
  $('ready').hidden = phase !== 'caught';
  $('goodtry').hidden = phase !== 'word'; // on screen whenever the app waits for the word
  $('yes').hidden = $('no').hidden = phase !== 'wave';
  $('parent').hidden = !['caught', 'word', 'wave'].includes(phase);
  keepAwake();
}

// Nobody touches the laptop while the kid plays, so its screen stays on during a round.
// The browser drops the lock when the tab is hidden; coming back asks again.
let wake = null; // promise of the screen lock (null inside it if the browser refused)
function keepAwake() {
  if (shown === 'idle' || shown === 'win') {
    wake?.then((lock) => lock?.release());
    wake = null;
  } else if (!wake && document.visibilityState === 'visible' && navigator.wakeLock) {
    const ask = (wake = navigator.wakeLock.request('screen').catch(() => null));
    ask.then((lock) => lock?.addEventListener('release', () => wake === ask && (wake = null)));
  }
}
document.addEventListener('visibilitychange', keepAwake);

// ---------- Robot Says ----------
const SHOW_MS = 1800; // how long the result stays up
// The bar along the bottom of the stage shrinks while the kid has time to do the command.
function drain(ms) {
  $('timer').hidden = false;
  $('timer').animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards' });
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let saysRun = 0; // Stop and Restart end the running round by changing this
let answer = () => {};
$('yes').addEventListener('click', () => answer(true));
$('no').addEventListener('click', () => answer(false));

async function playSays() {
  const mine = ++saysRun;
  const alive = () => mine === saysRun;
  const commands = makeCommands();
  const outcomes = [];
  saysOn = true;
  $('track').hidden = false;
  $('readout').hidden = true;
  for (const [i, { kind, real }] of commands.entries()) {
    const line = real ? `Robot says: ${COMMANDS[kind].toLowerCase()}` : COMMANDS[kind];
    const hint = kind !== 'wave' && steps ? 'Press the switch for a step. Do not press for freeze.' : undefined;
    show(kind === 'wave' ? 'wave' : 'says', hint, line);
    drawCells(i, commands.length, `Command ${i + 1} of ${commands.length}. Score ${total(outcomes)}.`);
    queued(() => robot.setLight(0, 0, 255));
    // The buttons are up while Bean is still talking: a press then counts too.
    const parent = new Promise((resolve) => (answer = resolve));
    await say(line);
    if (!alive()) return;
    const s = settings(); // read per command: a grown-up may give more time in the middle of the round
    let seen;
    if (kind === 'wave') {
      seen = { parent: await parent };
    } else if (steps) {
      pressed = false;
      drain(s.doMs);
      await wait(s.doMs);
      seen = { pressed };
    } else {
      const startCm = await queued(() => robot.distanceCm());
      drain(s.doMs);
      await wait(s.doMs);
      seen = { startCm, endCm: await queued(() => robot.distanceCm()), leewayCm: s.leewayCm };
    }
    if (!alive()) return;
    $('timer').hidden = true; // only this round's own timer: Stop hides it otherwise
    const result = outcome(real, did(kind, seen));
    outcomes.push(result);
    show(result, result === 'point' && !real ? 'Bean did not say “Robot says”. Good listening!' : undefined);
    drawCells(i + 1, commands.length, `Command ${i + 1} of ${commands.length}. Score ${total(outcomes)}.`);
    queued(() => robot.setLight(...LIGHT[result]));
    say(SCREEN[result].status);
    await wait(SHOW_MS);
    if (!alive()) return;
  }
  bump('wins'); // finishing all eight commands is a win, whatever the score
  const score = `${total(outcomes)} out of ${commands.length}`;
  wonAt = performance.now(); // a kid still pressing the switch does not skip the score
  show('win', 'Press Play again for eight more.', `${score}!`);
  queued(() => robot.setLight(...LIGHT.win));
  say(`You scored ${score}!`);
}

// ---------- practice word ----------
let round = {}; // the settings this round was started with
let toldNoMic = false;
function askWord(lead) {
  const word = round.words[Math.floor(Math.random() * round.words.length)];
  // Without speech recognition only the button is used: say so once.
  const hint = canHear ? undefined : toldNoMic ? 'Press Good try when they say it.' : 'This browser cannot listen for words. Press Good try when they say it.';
  toldNoMic = true;
  show('word', hint, `Say “${word}”`);
  listenFor([word], $('goodtry'), say(`${lead}Say ${word}`)).then((how) => {
    if (!how) return; // the round was stopped
    bump('words');
    if (how === 'heard') bump('heard');
    game.accept(performance.now());
  });
}

async function enter(phase) {
  const held = shown === 'red' && (phase === 'green' || phase === 'word');
  if (held) bump('freezes');
  if (phase === 'win') bump('wins');
  if (phase === 'caught') bump('caught');
  if (phase === 'word') askWord(held ? 'Great freezing! ' : shown === 'idle' ? 'Say your word to sneak closer! ' : '');
  else {
    if (held) praise();
    show(phase);
  }
  playCue(phase);
  // Head first, then light: the firmware clears the LED on any other command.
  if (phase === 'green') await robot.lookAway();
  else await robot.lookAtKid();
  await robot.setLight(...LIGHT[phase]);
}

let ticking = false;
setInterval(() => {
  if (ticking || game.phase === 'idle' || game.phase === 'win') return;
  ticking = true;
  queued(async () => {
    // The head points away during Green, so there is nothing to measure.
    const cm = steps || game.phase === 'green' ? null : await robot.distanceCm();
    if (cm != null) $('reading').textContent = `${cm} cm`;
    const phase = game.tick(performance.now(), cm);
    if (phase !== shown && phase !== 'idle') await enter(phase);
  }).finally(() => (ticking = false));
}, 100);

async function stopRound(hint) {
  game.stop();
  steps = null;
  saysRun++;
  saysOn = false;
  $('timer').hidden = true;
  answer(null);
  drawTrack();
  stopListening();
  silence();
  show('idle', hint);
  await robot.lookAtKid();
  await robot.stop();
}

$('stop').addEventListener('click', () => queued(() => stopRound()));

function start() {
  if (talking()) return; // shortcut: Talk with Bean is not built yet, the speech area fills it in
  unlockAudio();
  queued(async () => {
    await stopRound(); // Start during a round ends it first
    const s = (round = roundSettings(settings()));
    if (s.game === 'says') {
      if (s.input === 'switch') steps = createSteps(1); // only so the switch keys and the Step button are live
      drawTrack();
      bump('rounds');
      await robot.lookAtKid(); // Bean faces the kid the whole game
      playSays(); // not awaited: Stop must be able to run while it plays
      return;
    }
    // A switch round needs no distance: the piece on the track is the kid.
    const startCm = s.input === 'switch' ? 0 : await robot.distanceCm();
    if (s.input !== 'switch' && !startCm) {
      show('idle', 'Bean cannot see you. Stand in the lane, facing Bean, and press Start again.');
      return;
    }
    if (s.input === 'switch') steps = createSteps(s.steps);
    else $('reading').textContent = `${startCm} cm`;
    drawTrack();
    bump('rounds');
    game = createGame(s);
    game.start(performance.now(), startCm);
    await enter(game.phase);
  });
}
// Restart throws the round away, so it asks first: a second press within 4 seconds restarts.
$('start').addEventListener('click', () => {
  if (shown === 'idle' || shown === 'win' || performance.now() < restartUntil) return start();
  restartUntil = performance.now() + 4000;
  startLabel();
  setTimeout(startLabel, 4000);
});

// Move and Talk tabs. Like Restart, a press during a round only warns: a second press within 4 seconds stops it and switches.
for (const tab of ['move', 'talk']) {
  $(`tab-${tab}`).addEventListener('click', () => {
    if (tab === settings().tab) return;
    const go = () => {
      settingChanged(fixSettings({ ...settings(), tab }));
      show('idle');
    };
    if (shown === 'idle' || shown === 'win') return go();
    if (performance.now() < tabUntil) {
      tabUntil = 0;
      return queued(async () => {
        await stopRound();
        go();
      });
    }
    tabUntil = performance.now() + 4000;
    $('hint').textContent = tabWarn = `Press ${$(`tab-${tab}`).textContent.trim()} again to stop the round.`;
    setTimeout(() => performance.now() >= tabUntil && $('hint').textContent === tabWarn && ($('hint').textContent = shownHint), 4000);
  });
}
// Arrow keys, Home and End move between the tabs (ARIA tabs pattern). click() so a phone sends it to the laptop.
$('tabs').addEventListener('keydown', (e) => {
  const other = e.target.id === 'tab-talk' ? 'move' : 'talk';
  const to = { ArrowLeft: other, ArrowRight: other, Home: 'move', End: 'talk' }[e.key];
  if (!to) return;
  e.preventDefault();
  $(`tab-${to}`).focus();
  $(`tab-${to}`).click();
});

$('ready').addEventListener('click', () => game.ready(performance.now()));

$('distance').addEventListener('input', () => {
  $('distance-out').textContent = `${$('distance').value} cm`;
});

if (!('serial' in navigator)) {
  $('connect').hidden = true;
  $('link').textContent = 'Playing with the pretend robot. The cable needs Chrome or Edge on a laptop; WiFi works in any browser.';
}

// The car is reached over the USB cable or over its own WiFi (the kit's camera board).
async function connectRobot(open, check) {
  try {
    $('link').textContent = 'Connecting…';
    robot = await open(() => {
      robot = mock;
      $('mock').hidden = false;
      $('link').textContent = `Lost the robot. ${check}, then connect again. Playing with the pretend robot for now.`;
    });
    $('mock').hidden = true;
    $('link').textContent = 'Robot connected.';
  } catch {
    $('link').textContent = `Could not connect. ${check} and try again.`;
  }
}
$('connect').addEventListener('click', () => connectRobot(connectSerial, 'Check the cable'));
$('connect-wifi').addEventListener('click', () =>
  connectRobot(connectWifi, 'Check that the car is on and this laptop is on its ELEGOO WiFi'),
);

drawTrack();
show('idle');

// ---------- phone remote (spec, section 13) ----------
// The laptop sends what its screen shows; the phone copies it and sends its presses back through scripts/serve.mjs.
const CLICKS = ['start', 'stop', 'ready', 'goodtry', 'yes', 'no', 'reset', 'tab-move', 'tab-talk'];
const TEXTS = ['status', 'hint', 'reading', 'track-text', 'start', 'step', 'reset'];
const HIDDEN = ['readout', 'track', 'timer', 'controls', 'step', 'parent', 'ready', 'goodtry', 'yes', 'no'];
const snapshot = () => ({
  phase: document.body.dataset.phase,
  glyph: $('glyph-path').getAttribute('d'),
  text: Object.fromEntries(TEXTS.map((id) => [id, $(id).textContent])),
  hidden: Object.fromEntries(HIDDEN.map((id) => [id, $(id).hidden])),
  cells: [$('track-cells').querySelectorAll('.on').length, $('track-cells').children.length],
  settings: settings(),
  totals,
});
let mirrored = '';
function mirror(s) {
  if (!s.text) return; // the laptop tab has not sent anything yet
  document.body.dataset.phase = s.phase;
  $('glyph-path').setAttribute('d', s.glyph);
  drawCells(...s.cells, s.text['track-text']);
  for (const [id, text] of Object.entries(s.text)) if ($(id).textContent !== text) $(id).textContent = text; // no repeat announcements
  if (!s.hidden.timer && $('timer').hidden) drain(s.settings.doMs); // the laptop's bar started draining
  for (const [id, hidden] of Object.entries(s.hidden)) $(id).hidden = hidden;
  totals = s.totals;
  drawTotals();
  // Settings are copied only when the laptop's change, so a box being typed in on the phone is left alone.
  if (JSON.stringify(s.settings) !== mirrored) showSettings(s.settings);
  mirrored = JSON.stringify(s.settings);
}

if (remote) {
  $('connect').hidden = $('connect-wifi').hidden = $('mock').hidden = true;
  $('link').textContent = 'Connecting to the laptop…';
  // Capture phase: these buttons only ask the laptop. The Step button already goes through press().
  addEventListener('click', (e) => {
    const id = e.target.closest('button')?.id;
    if (!CLICKS.includes(id)) return;
    e.stopImmediatePropagation();
    send({ click: id });
  }, true);
  const stage = new EventSource(`/relay/state?code=${encodeURIComponent(remote)}`);
  stage.onopen = () => ($('link').textContent = 'Phone remote. Bean plays the sound and listens on the laptop.');
  stage.onmessage = (e) => mirror(JSON.parse(e.data));
  stage.onerror = () => ($('link').textContent = 'Cannot reach the laptop. Check that both are on the same WiFi and the code is right.');
} else {
  fetch('/relay/code').then((r) => r.ok && r.json()).then((relay) => {
    if (!relay) return; // the server was started without --lan
    $('phone').hidden = false;
    $('phone').textContent = relay.urls.length
      ? `Phone remote: on a phone on the same WiFi, open ${relay.urls.join(' or ')}`
      : 'Phone remote: this laptop is not on a network yet.';
    let last = '';
    setInterval(() => {
      const now = JSON.stringify(snapshot());
      if (now === last) return;
      last = now;
      fetch('/relay/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: now }).catch(() => {});
    }, 150);
    // A phone press does what the same press on the laptop does, and only while that button is on screen.
    new EventSource('/relay/commands').onmessage = (e) => {
      const { click, settings: s } = JSON.parse(e.data);
      if (click === 'step') {
        press();
        steps?.release();
      } else if (CLICKS.includes(click) && !$(click).closest('[hidden]')) $(click).click();
      else if (s) settingChanged(fixSettings({ ...s, tab: settings().tab })); // tabs come as clicks, so a round is never left running on Talk
    };
  }).catch(() => {});
}
