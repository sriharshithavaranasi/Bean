// Bean's page shell: the tabs, the stage, Start / Stop / Restart, the robot link, the screen lock and the phone remote.
// Each activity is its own mode (mode.ts) with its own settings, progress and game: Play with Bean (play.ts) on the
// Play tab and Talk with Bean (talk-play.ts) on the Talk tab. The shell never looks inside a mode.
import type { Mode, ModeContext } from './mode.ts';
import { createPlay } from './play.ts';
import { makeMockRobot } from './robot-mock.ts';
import { connectSerial } from './robot-serial.ts';
import { silence, unlockAudio } from './signals.ts';
import { stopListening } from './speech.ts';
import { load, save } from './store.ts';
import { createTalk } from './talk-play.ts';
import type { Robot } from './robot.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// A phone opens the laptop's address with ?code=: it is then only a remote for the game running on the laptop.
const remote = new URLSearchParams(location.search).get('code');
const send = (message: object) =>
  fetch(`/relay/press?code=${encodeURIComponent(remote!)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message),
  }).catch(() => {});

// ---------- robot ----------
const mock = makeMockRobot(
  () => Number($<HTMLInputElement>('distance').value),
  ({ head, light }) => {
    if (head != null) $('mock-head').textContent = head === 90 ? 'Bean is facing the kid' : 'Bean is looking away';
    if (light) $('mock-light').style.background = light;
  },
);
let robot: Robot = mock;

// Start, Stop and the game tick all talk to the robot: run them one after another.
let chain: Promise<unknown> = Promise.resolve();
const queued = <T>(job: () => T) => (chain = chain.then(job).catch((e) => void console.error(e)));

// ---------- modes ----------
let shown = 'idle';
const ctx: ModeContext = { show, shown: () => shown, queued, robot: () => robot, remote, send };
const modes: Record<'move' | 'talk', Mode> = { move: createPlay(ctx), talk: createTalk(ctx) };
type Tab = keyof typeof modes;
let tab: Tab = load('bean-tab', { tab: 'move' }).tab === 'talk' ? 'talk' : 'move';
const mode = () => modes[tab];

// ---------- stage ----------
let restartUntil = 0; // Restart was pressed once: a second press before this time restarts
const over = (phase: string) => ['idle', 'win', 'caught', 'ended'].includes(phase); // no round running
const startLabel = () =>
  ($('start').textContent =
    over(shown) && shown !== 'idle' ? 'Play again' : shown === 'idle' ? 'Start' : performance.now() < restartUntil ? 'Press again to restart' : 'Restart');
let tabUntil = 0; // a tab was pressed once during a round: a second press before this time stops the round and switches
const tabWarn = (t: string, label = '') => {
  $(`warn-${t}`).textContent = label && 'Press again to stop';
  $('tab-note').textContent = label && `Press ${label} again to stop the round.`;
};
// The active mode says what each phase shows; a hint or status passed in wins.
function show(phase: string, hint?: string, status?: string) {
  const screen = mode().screen[phase] ?? mode().screen.idle;
  shown = phase;
  document.body.dataset.phase = phase;
  $('status').textContent = status ?? screen.status ?? '';
  $('hint').textContent = hint ?? screen.hint;
  $('readout').hidden = !mode().showsDistance;
  $('glyph-path').setAttribute('d', screen.glyph);
  if (over(phase)) {
    restartUntil = tabUntil = 0;
    tabWarn('move');
    tabWarn('talk');
  }
  startLabel();
  $('goodtry').hidden = phase !== 'word'; // on screen whenever the app waits for the kid to speak
  $('parent').hidden = phase !== 'word';
  keepAwake();
}

// Nobody touches the laptop while the kid plays, so its screen stays on during a round.
// The browser drops the lock when the tab is hidden; coming back asks again.
let wake: Promise<WakeLockSentinel | null> | null = null; // promise of the screen lock (null inside it if the browser refused)
function keepAwake() {
  if (over(shown)) {
    wake?.then((lock) => lock?.release());
    wake = null;
  } else if (!wake && document.visibilityState === 'visible' && navigator.wakeLock) {
    const ask = (wake = navigator.wakeLock.request('screen').catch(() => null));
    ask.then((lock) => lock?.addEventListener('release', () => wake === ask && (wake = null)));
  }
}
document.addEventListener('visibilitychange', keepAwake);

// ---------- Start, Stop, Restart ----------
async function stopRound(hint?: string) {
  mode().stop();
  stopListening();
  silence();
  show('idle', hint);
  await robot.lookAtKid();
  await robot.stop();
}

$('stop').addEventListener('click', () => queued(() => stopRound()));

function start() {
  unlockAudio();
  queued(async () => {
    await stopRound(); // Start during a round ends it first
    await mode().start();
  });
}
// Restart throws the round away, so it asks first: a second press within 4 seconds restarts.
$('start').addEventListener('click', () => {
  if (over(shown) || performance.now() < restartUntil) return start();
  restartUntil = performance.now() + 4000;
  startLabel();
  setTimeout(startLabel, 4000);
});

// ---------- tabs ----------
function showTab() {
  for (const t of ['move', 'talk']) {
    $(`tab-${t}`).setAttribute('aria-selected', String(tab === t));
    $(`tab-${t}`).tabIndex = tab === t ? 0 : -1;
    $(`panel-${t}`).hidden = tab !== t;
  }
}
// Like Restart, a press during a round only warns: a second press within 4 seconds stops it and switches.
for (const t of ['move', 'talk'] as const) {
  $(`tab-${t}`).addEventListener('click', () => {
    if (t === tab) return;
    if (!over(shown) && performance.now() >= tabUntil) {
      tabUntil = performance.now() + 4000;
      tabWarn(t, $(`tab-${t}`).querySelector('.label')!.textContent ?? '');
      setTimeout(() => performance.now() >= tabUntil && tabWarn(t), 4000);
      return;
    }
    tabUntil = 0;
    // Queued behind a Start that is still measuring, so that round is stopped too. A won round is cleared like a stopped one.
    queued(async () => {
      if (shown !== 'idle') await stopRound();
      tab = t;
      save('bean-tab', { tab });
      showTab();
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

// ---------- robot link ----------
$('distance').addEventListener('input', () => {
  $('distance-out').textContent = `${$<HTMLInputElement>('distance').value} cm`;
});

if (!('serial' in navigator)) {
  $('connect').hidden = true;
  $('link').textContent = 'Playing with the pretend robot. The cable needs Chrome or Edge on a laptop.';
}

// The car is reached over the USB cable.
// The button stays off while connecting and connected: a second open fails on the open port and would report "Could not connect".
async function connectRobot(open: (onLost: () => void) => Promise<Robot>, check: string) {
  const button = $<HTMLButtonElement>('connect');
  button.disabled = true;
  try {
    $('link').textContent = 'Connecting…';
    robot = await open(() => {
      robot = mock;
      $('mock').hidden = false;
      button.disabled = false;
      $('link').textContent = `Lost the robot. ${check}, then connect again. Playing with the pretend robot for now.`;
    });
    $('mock').hidden = true;
    $('link').textContent = 'Robot connected.';
  } catch {
    button.disabled = false;
    $('link').textContent = `Could not connect. ${check} and try again.`;
  }
}
$('connect').addEventListener('click', () => connectRobot(connectSerial, 'Check the cable'));

showTab();
show('idle');

// ---------- phone remote (spec, section 13) ----------
// The laptop sends what its screen shows; the phone copies it and sends its presses back through scripts/serve.ts.
const CLICKS = ['start', 'stop', 'goodtry', 'reset', 'tab-move', 'tab-talk'];
const TEXTS = ['status', 'hint', 'reading', 'cam-status', 'start', 'reset', 'warn-move', 'warn-talk', 'tab-note'];
const HIDDEN = ['readout', 'cam-status', 'controls', 'parent', 'goodtry'];
const snapshot = () => ({
  phase: document.body.dataset.phase,
  glyph: $('glyph-path').getAttribute('d')!,
  text: Object.fromEntries(TEXTS.map((id) => [id, $(id).textContent] as const)),
  hidden: Object.fromEntries(HIDDEN.map((id) => [id, $(id).hidden] as const)),
  tab,
  modes: Object.fromEntries(Object.entries(modes).map(([t, m]) => [t, m.sync?.state()] as const)),
});
function mirror(s: ReturnType<typeof snapshot>) {
  if (!s.text) return; // the laptop tab has not sent anything yet
  document.body.dataset.phase = s.phase;
  $('glyph-path').setAttribute('d', s.glyph);
  for (const [id, text] of Object.entries(s.text)) if ($(id).textContent !== text) $(id).textContent = text; // no repeat announcements
  for (const [id, hidden] of Object.entries(s.hidden)) $(id).hidden = hidden;
  if (s.tab !== tab) (tab = s.tab), showTab();
  for (const [t, m] of Object.entries(modes)) if (s.modes[t] !== undefined) m.sync?.mirror(s.modes[t]);
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
    // Play's settings typed on the phone come as settings; tabs come as clicks, so a round is never left running.
    new EventSource('/relay/commands').onmessage = (e) => {
      const { click, settings: s } = JSON.parse(e.data);
      if (CLICKS.includes(click) && !$(click).closest('[hidden]')) $(click).click();
      else if (s) modes.move.sync?.apply(s);
    };
  }).catch(() => {});
}
