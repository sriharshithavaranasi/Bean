import { createGame } from './game/freeze-watcher.ts';
import { makeMockRobot } from './robot-mock.ts';
import { connectSerial } from './robot-serial.ts';
import { playCue, praise, say, silence, unlockAudio } from './signals.ts';
import { canHear, listenFor, stopListening } from './speech.ts';
import { fixSettings, LIMITS, load, roundSettings, save, type Limited, type Settings } from './store.ts';
import type { Robot } from './robot.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// A phone opens the laptop's address with ?code=: it is then only a remote for the game running on the laptop.
const remote = new URLSearchParams(location.search).get('code');
const send = (press: object) =>
  fetch(`/relay/press?code=${encodeURIComponent(remote!)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(press),
  }).catch(() => {});

// Glyphs are a second cue beside colour: face = ready, arrow = go, bars = freeze, eye = seen, speech bubble = say the word, star = win.
const SCREEN: Record<string, { status?: string; hint: string; glyph: string }> = {
  // The idle status names the chosen game (show).
  idle: { hint: 'Stand on the start line, then press Start.', glyph: 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z' },
  green: { status: 'Green light!', hint: 'Bean is not looking. Sneak closer!', glyph: 'M12 4l7 8h-4v8H9v-8H5z' },
  red: { status: 'Red light!', hint: 'Bean is looking. Freeze!', glyph: 'M7 5h4v14H7zM13 5h4v14h-4z' },
  caught: { status: 'I saw you!', hint: 'Go back to the start line.', glyph: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  word: { status: 'Say your word', hint: 'Say it out loud, or press Good try.', glyph: 'M4 4h16v12h-9l-5 4v-4H4z' },
  win: { status: 'You got me!', hint: 'You reached Bean!', glyph: 'M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z' },
};
const LIGHT: Record<string, [number, number, number]> = { green: [0, 255, 0], red: [255, 0, 0], caught: [255, 80, 0], word: [0, 0, 255], win: [255, 255, 255] };

// ---------- grown-up settings ----------
// field id -> [game setting, how many of the game's units one of the field's units is]
const FIELDS: Record<string, [Limited, number]> = {
  greenMin: ['greenMinMs', 1000], greenMax: ['greenMaxMs', 1000], settle: ['settleMs', 1000],
  look: ['lookMs', 1000], leewayCm: ['leewayCm', 1], winCm: ['winCm', 1],
};
const rulers: Record<string, HTMLInputElement> = {};
const talking = () => $('tab-talk').getAttribute('aria-selected') === 'true';
function settings() {
  const raw: Record<string, unknown> = {
    game: $<HTMLInputElement>('s-sneak').checked ? 'sneak' : 'freeze',
    words: $<HTMLInputElement>('s-words').value, tab: talking() ? 'talk' : 'move',
  };
  for (const [id, [key, unit]] of Object.entries(FIELDS)) {
    const v = $<HTMLInputElement>(`s-${id}`).value;
    raw[key] = v === '' ? null : Math.round(Number(v) * unit);
  }
  return fixSettings(raw);
}
// The boxes show what the next round will really use: a bad value is fixed where the grown-up typed it.
function showSettings(s: Settings) {
  for (const [id, [key, unit]] of Object.entries(FIELDS)) $<HTMLInputElement>(`s-${id}`).value = rulers[id].value = String(s[key] / unit);
  // Say It to Sneak has a fixed Green (store.ts roundSettings), so its Green boxes are hidden; they keep their values.
  for (const id of ['greenMin', 'greenMax']) $(`s-${id}`).closest<HTMLElement>('.field')!.hidden = s.game === 'sneak';
  // Only Say It to Sneak asks for practice words.
  $('s-words').closest<HTMLElement>('.words')!.hidden = $('t-words').parentElement!.hidden = s.game !== 'sneak';
  $<HTMLInputElement>(`s-${s.game}`).checked = true;
  $<HTMLInputElement>('s-words').value = s.words.join(', ');
  for (const tab of ['move', 'talk']) {
    $(`tab-${tab}`).setAttribute('aria-selected', String(s.tab === tab));
    $(`tab-${tab}`).tabIndex = s.tab === tab ? 0 : -1;
    $(`panel-${tab}`).hidden = s.tab !== tab;
  }
}
function settingChanged(s = settings()) {
  if (remote) send({ settings: s });
  showSettings(s);
  save('bean-settings', s);
  if (shown === 'idle') show('idle');
}
for (const [id, [key, unit]] of Object.entries(FIELDS)) {
  const input = $<HTMLInputElement>(`s-${id}`);
  [input.min, input.max] = LIMITS[key].map((n) => String(n / unit));
  // The − and + buttons and the drag ruler all drive this one number box.
  const name = input.labels![0].firstChild!.textContent!.trim();
  const ruler = (rulers[id] = Object.assign(document.createElement('input'), {
    type: 'range', className: 'ruler', min: input.min, max: input.max, step: input.step || 1, tabIndex: -1,
  }));
  ruler.setAttribute('aria-hidden', 'true'); // same value as the number box, for pointers only
  const changed = () => input.dispatchEvent(new Event('change'));
  const stepper = (text: string, label: string, step: () => void) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text });
    b.setAttribute('aria-label', `${label}: ${name}`);
    b.addEventListener('click', () => (step(), changed()));
    return b;
  };
  const num = input.closest('.num')!;
  num.prepend(stepper('−', 'Less', () => input.stepDown()));
  num.append(stepper('+', 'More', () => input.stepUp()), ruler);
  ruler.addEventListener('input', () => ((input.value = ruler.value), changed()));
  input.addEventListener('change', () => settingChanged());
}
for (const id of ['s-freeze', 's-sneak', 's-words']) $(id).addEventListener('change', () => settingChanged());
showSettings(fixSettings(load('bean-settings', {})));
if (matchMedia('(min-width: 860px)').matches) $<HTMLDetailsElement>('settings').open = true;

// ---------- progress ----------
// caught is counted but never shown (spec, section 10). words = every try, heard = the tries the microphone caught itself.
const ZERO = { rounds: 0, wins: 0, words: 0, heard: 0, caught: 0 };
let totals = load('bean-progress', ZERO);
function drawTotals() {
  for (const dd of document.querySelectorAll('#totals dd')) dd.textContent = String(totals[dd.id.slice(2) as keyof typeof ZERO]);
}
function bump(key: keyof typeof ZERO) {
  totals[key]++;
  save('bean-progress', totals);
  drawTotals();
}
let resetArmed: ReturnType<typeof setTimeout> | undefined;
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
  () => Number($<HTMLInputElement>('distance').value),
  ({ head, light }) => {
    if (head != null) $('mock-head').textContent = head === 90 ? 'Bean is facing the kid' : 'Bean is looking away';
    if (light) $('mock-light').style.background = light;
  },
);
let robot: Robot = mock;
let game = createGame();
let shown = 'idle';

// Start, Stop and the game tick all talk to the robot: run them one after another.
let chain: Promise<unknown> = Promise.resolve();
const queued = <T>(job: () => T) => (chain = chain.then(job).catch((e) => void console.error(e)));

const chosenGame = () => document.querySelector<HTMLInputElement>('[name="s-game"]:checked')!.labels![0].textContent!.trim();
let restartUntil = 0; // Restart was pressed once: a second press before this time restarts
const startLabel = () =>
  ($('start').textContent =
    shown === 'win' ? 'Play again' : shown === 'idle' ? 'Start' : performance.now() < restartUntil ? 'Press again to restart' : 'Restart');
let tabUntil = 0; // a tab was pressed once during a round: a second press before this time stops the round and switches
const tabWarn = (tab: string, label = '') => {
  $(`warn-${tab}`).textContent = label && 'Press again to stop';
  $('tab-note').textContent = label && `Press ${label} again to stop the round.`;
};
const TALK_GLYPH = $('tab-talk').querySelector('path')!.getAttribute('d')!; // the speech bubble on the Talk tab
const idleStatus = () => (talking() ? 'Talk with Bean' : `Let’s play ${chosenGame()}`);
function show(phase: string, hint = talking() ? 'Coming soon: Bean takes turns talking with your kid.' : SCREEN[phase].hint, status = phase === 'idle' ? idleStatus() : (SCREEN[phase].status ?? '')) {
  shown = phase;
  document.body.dataset.phase = phase;
  $('status').textContent = status;
  $('hint').textContent = hint;
  // shortcut: Talk with Bean is not built yet, the speech area fills it in and shows Start and Stop again.
  $('controls').hidden = $('readout').hidden = talking(); // Talk has no distance to show
  $('glyph-path').setAttribute('d', phase === 'idle' && talking() ? TALK_GLYPH : SCREEN[phase].glyph);
  if (phase === 'idle' || phase === 'win') {
    restartUntil = tabUntil = 0;
    tabWarn('move');
    tabWarn('talk');
  }
  startLabel();
  $('ready').hidden = phase !== 'caught';
  $('goodtry').hidden = phase !== 'word'; // on screen whenever the app waits for the word
  $('parent').hidden = !['caught', 'word'].includes(phase);
  keepAwake();
}

// Nobody touches the laptop while the kid plays, so its screen stays on during a round.
// The browser drops the lock when the tab is hidden; coming back asks again.
let wake: Promise<WakeLockSentinel | null> | null = null; // promise of the screen lock (null inside it if the browser refused)
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

// ---------- practice word ----------
let round = roundSettings(fixSettings()); // the settings this round was started with
let toldNoMic = false;
function askWord(lead: string) {
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

async function enter(phase: string) {
  const held = shown === 'red' && (phase === 'green' || phase === 'word');
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
    const cm = game.phase === 'green' ? null : await robot.distanceCm();
    if (cm != null) $('reading').textContent = `${cm} cm`;
    const phase = game.tick(performance.now(), cm);
    if (phase !== shown && phase !== 'idle') await enter(phase);
  }).finally(() => (ticking = false));
}, 100);

async function stopRound(hint?: string) {
  game.stop();
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
    const startCm = await robot.distanceCm();
    if (!startCm) {
      show('idle', 'Bean cannot see you. Stand in the lane, facing Bean, and press Start again.');
      return;
    }
    $('reading').textContent = `${startCm} cm`;
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
    if (shown !== 'idle' && shown !== 'win' && performance.now() >= tabUntil) {
      tabUntil = performance.now() + 4000;
      tabWarn(tab, $(`tab-${tab}`).querySelector('.label')!.textContent ?? '');
      setTimeout(() => performance.now() >= tabUntil && tabWarn(tab), 4000);
      return;
    }
    tabUntil = 0;
    // Queued behind a Start that is still measuring, so that round is stopped too. A won round is cleared like a stopped one.
    queued(async () => {
      if (shown !== 'idle') await stopRound();
      settingChanged(fixSettings({ ...settings(), tab }));
      show('idle');
    });
  });
}
// Arrow keys, Home and End move between the tabs (ARIA tabs pattern). click() so a phone sends it to the laptop.
$('tabs').addEventListener('keydown', (e) => {
  const other = (e.target as Element).id === 'tab-talk' ? 'move' : 'talk';
  const to = { ArrowLeft: other, ArrowRight: other, Home: 'move', End: 'talk' }[e.key];
  if (!to) return;
  e.preventDefault();
  $(`tab-${to}`).focus();
  $(`tab-${to}`).click();
});

$('ready').addEventListener('click', () => game.ready(performance.now()));

$('distance').addEventListener('input', () => {
  $('distance-out').textContent = `${$<HTMLInputElement>('distance').value} cm`;
});

if (!('serial' in navigator)) {
  $('connect').hidden = true;
  $('link').textContent = 'Playing with the pretend robot. The cable needs Chrome or Edge on a laptop.';
}

// The car is reached over the USB cable.
async function connectRobot(open: (onLost: () => void) => Promise<Robot>, check: string) {
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

show('idle');

// ---------- phone remote (spec, section 13) ----------
// The laptop sends what its screen shows; the phone copies it and sends its presses back through scripts/serve.ts.
const CLICKS = ['start', 'stop', 'ready', 'goodtry', 'reset', 'tab-move', 'tab-talk'];
const TEXTS = ['status', 'hint', 'reading', 'start', 'reset', 'warn-move', 'warn-talk', 'tab-note'];
const HIDDEN = ['readout', 'controls', 'parent', 'ready', 'goodtry'];
const snapshot = () => ({
  phase: document.body.dataset.phase,
  glyph: $('glyph-path').getAttribute('d')!,
  text: Object.fromEntries(TEXTS.map((id) => [id, $(id).textContent] as const)),
  hidden: Object.fromEntries(HIDDEN.map((id) => [id, $(id).hidden] as const)),
  settings: settings(),
  totals,
});
let mirrored = '';
function mirror(s: ReturnType<typeof snapshot>) {
  if (!s.text) return; // the laptop tab has not sent anything yet
  document.body.dataset.phase = s.phase;
  $('glyph-path').setAttribute('d', s.glyph);
  for (const [id, text] of Object.entries(s.text)) if ($(id).textContent !== text) $(id).textContent = text; // no repeat announcements
  for (const [id, hidden] of Object.entries(s.hidden)) $(id).hidden = hidden;
  totals = s.totals;
  drawTotals();
  // Settings are copied only when the laptop's change, so a box being typed in on the phone is left alone.
  if (JSON.stringify(s.settings) !== mirrored) showSettings(s.settings);
  mirrored = JSON.stringify(s.settings);
}

if (remote) {
  $('connect').hidden = $('mock').hidden = true;
  $('link').textContent = 'Connecting to the laptop…';
  // Capture phase: these buttons only ask the laptop.
  addEventListener('click', (e) => {
    const id = (e.target as Element).closest('button')?.id;
    if (!id || !CLICKS.includes(id)) return;
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
      if (CLICKS.includes(click) && !$(click).closest('[hidden]')) $(click).click();
      else if (s) settingChanged(fixSettings({ ...s, tab: settings().tab })); // tabs come as clicks, so a round is never left running on Talk
    };
  }).catch(() => {});
}
