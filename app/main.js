import { createGame, DEFAULTS } from './game/freeze-watcher.js';
import { makeMockRobot } from './robot-mock.js';
import { connectSerial } from './robot-serial.js';
import { playCue, praise, silence, unlockAudio } from './signals.js';
import { fixSettings, LIMITS, load, save } from './store.js';

const $ = (id) => document.getElementById(id);

// Glyphs are a second cue beside colour: face = ready, arrow = go, bars = freeze, eye = seen, star = win.
const SCREEN = {
  idle: { status: 'Bean is ready', hint: 'Stand on the start line, then press Start.', glyph: 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z' },
  green: { status: 'Green light!', hint: 'Bean is not looking. Sneak closer!', glyph: 'M12 4l7 8h-4v8H9v-8H5z' },
  red: { status: 'Red light!', hint: 'Bean is looking. Freeze!', glyph: 'M7 5h4v14H7zM13 5h4v14h-4z' },
  caught: { status: 'I saw you!', hint: 'Go back to the start line.', glyph: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  win: { status: 'You got me!', hint: 'You reached Bean!', glyph: 'M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z' },
};
const LIGHT = { green: [0, 255, 0], red: [255, 0, 0], caught: [255, 80, 0], win: [255, 255, 255] };

// ---------- grown-up settings ----------
// field id -> [game setting, how many of the game's units one of the field's units is]
const FIELDS = {
  greenMin: ['greenMinMs', 1000], greenMax: ['greenMaxMs', 1000], settle: ['settleMs', 1000],
  look: ['lookMs', 1000], leewayCm: ['leewayCm', 1], winCm: ['winCm', 1],
};
const rulers = {};
function settings() {
  const raw = {};
  for (const [id, [key, unit]] of Object.entries(FIELDS)) {
    const v = $(`s-${id}`).value;
    raw[key] = v === '' ? null : Math.round(v * unit);
  }
  return fixSettings(raw);
}
// The boxes show what the next round will really use: a bad value is fixed where the grown-up typed it.
function showSettings(s) {
  for (const [id, [key, unit]] of Object.entries(FIELDS)) $(`s-${id}`).value = rulers[id].value = s[key] / unit;
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
  input.addEventListener('change', () => {
    const s = settings();
    showSettings(s);
    save('bean-settings', s);
  });
}
showSettings(fixSettings(load('bean-settings', {})));
if (matchMedia('(min-width: 860px)').matches) $('settings').open = true;

// ---------- progress ----------
const ZERO = { rounds: 0, wins: 0, freezes: 0, words: 0, caught: 0 }; // caught is counted but never shown (spec, section 10)
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

function show(phase, hint = SCREEN[phase].hint) {
  shown = phase;
  document.body.dataset.phase = phase;
  $('status').textContent = SCREEN[phase].status;
  $('hint').textContent = hint;
  $('glyph-path').setAttribute('d', SCREEN[phase].glyph);
  $('start').textContent = phase === 'win' ? 'Play again' : phase === 'idle' ? 'Start' : 'Restart';
  $('parent').hidden = phase !== 'caught'; // word-gate buttons inside stay hidden until their tickets
}

async function enter(phase) {
  if (shown === 'red' && phase === 'green') {
    praise();
    bump('freezes');
  }
  if (phase === 'win') bump('wins');
  if (phase === 'caught') bump('caught');
  show(phase);
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
    const cm = game.phase === 'green' ? null : await robot.distanceCm();
    if (cm != null) $('reading').textContent = `${cm} cm`;
    const phase = game.tick(performance.now(), cm);
    if (phase !== shown && phase !== 'idle') await enter(phase);
  }).finally(() => (ticking = false));
}, 100);

async function stopRound(hint) {
  game.stop();
  silence();
  show('idle', hint);
  await robot.lookAtKid();
  await robot.stop();
}

$('stop').addEventListener('click', () => queued(() => stopRound()));

$('start').addEventListener('click', () => {
  unlockAudio();
  queued(async () => {
    await stopRound(); // Start during a round ends it first
    const startCm = await robot.distanceCm();
    if (!startCm) {
      show('idle', 'Bean cannot see you. Stand in the lane, facing Bean, and press Start again.');
      return;
    }
    $('reading').textContent = `${startCm} cm`;
    bump('rounds');
    game = createGame(settings());
    game.start(performance.now(), startCm);
    await enter('green');
  });
});

$('ready').addEventListener('click', () => game.ready(performance.now()));

$('distance').addEventListener('input', () => {
  $('distance-out').textContent = `${$('distance').value} cm`;
});

if (!('serial' in navigator)) {
  $('connect').disabled = true;
  $('link').textContent = 'Playing with the pretend robot. The real car needs Chrome or Edge on a laptop.';
}

$('connect').addEventListener('click', async () => {
  try {
    $('link').textContent = 'Connecting…';
    robot = await connectSerial(() => {
      robot = mock;
      $('mock').hidden = false;
      $('link').textContent = 'Lost the robot. Check the cable, then connect again. Playing with the pretend robot for now.';
    });
    $('mock').hidden = true;
    $('link').textContent = 'Robot connected.';
  } catch {
    $('link').textContent = 'Could not connect. Check the cable and try again.';
  }
});

show('idle');
