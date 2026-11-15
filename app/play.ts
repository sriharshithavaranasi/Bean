// Play with Bean: Red Light, Green Light with the webcam watching (spec, sections 5 and 16).
// Its grown-up settings, progress, webcam and game loop. The shell (main.ts) starts and stops it.
import { cameras, openCamera } from './camera.ts';
import { createGame } from './game/freeze-watcher.ts';
import type { Frame } from './game/pose-moved.ts';
import type { Mode, ModeContext, Screen } from './mode.ts';
import { playCue, praise } from './signals.ts';
import { fixSettings, LIMITS, load, save, type Limited, type Settings } from './store.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Glyphs are a second cue beside colour: face = ready, arrow = go, bars = freeze, eye = seen, square = stopped, star = win.
const SCREEN: Record<string, Screen> = {
  idle: { status: 'Let’s play Red Light, Green Light', hint: 'Stand on the start line, then press Start.', glyph: 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z' },
  green: { status: 'Green light!', hint: 'Bean is not looking. Sneak closer!', glyph: 'M12 4l7 8h-4v8H9v-8H5z' },
  red: { status: 'Red light!', hint: 'Bean is looking. Freeze!', glyph: 'M7 5h4v14H7zM13 5h4v14h-4z' },
  caught: { status: 'I saw you!', hint: 'Game over. Press Play again to try again.', glyph: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  ended: { status: 'Bean stopped', hint: 'Nobody played for 12 rounds, so the game ended. Press Play again to start.', glyph: 'M7 5h10v14H7z' },
  win: { status: 'You got me!', hint: 'You reached Bean!', glyph: 'M12 2l3 7 7 .6-5.3 4.7 1.7 7.2L12 17.8 5.6 21.5l1.7-7.2L2 9.6 9 9z' },
};
const LIGHT: Record<string, [number, number, number]> = { green: [0, 255, 0], red: [255, 0, 0], caught: [255, 80, 0], ended: [0, 0, 0], win: [255, 255, 255] };
const gameOver = (phase: string) => ['idle', 'win', 'caught', 'ended'].includes(phase);

export function createPlay(ctx: ModeContext): Mode {
  // ---------- grown-up settings ----------
  // field id -> [game setting, how many of the game's units one of the field's units is]
  const FIELDS: Record<string, [Limited, number]> = {
    greenMin: ['greenMinMs', 1000], greenMax: ['greenMaxMs', 1000], settle: ['settleMs', 1000],
    redMin: ['redMinMs', 1000], redMax: ['redMaxMs', 1000], winCm: ['winCm', 1], poseWigglePct: ['poseWigglePct', 1],
  };
  let camerasFound = false; // the camera picker shows only when the laptop has a camera
  const rulers: Record<string, HTMLInputElement> = {};
  function settings() {
    const raw: Record<string, unknown> = { cameraId: $<HTMLSelectElement>('s-cameraId').value };
    for (const [id, [key, unit]] of Object.entries(FIELDS)) {
      const v = $<HTMLInputElement>(`s-${id}`).value;
      raw[key] = v === '' ? null : Math.round(Number(v) * unit);
    }
    return fixSettings(raw);
  }
  // The boxes show what the next round will really use: a bad value is fixed where the grown-up typed it.
  function showSettings(s: Settings) {
    for (const [id, [key, unit]] of Object.entries(FIELDS)) $<HTMLInputElement>(`s-${id}`).value = rulers[id].value = String(s[key] / unit);
    // Webcam: the camera picker shows when a camera is found.
    const box = $<HTMLSelectElement>('s-cameraId');
    if (![...box.options].some((o) => o.value === s.cameraId)) box.append(new Option('Saved camera', s.cameraId)); // before the list is read
    box.value = s.cameraId;
    $('camera-row').hidden = !camerasFound;
  }
  function settingChanged(s = settings()) {
    if (ctx.remote) ctx.send({ settings: s });
    showSettings(s);
    save('bean-settings', s);
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
  $('s-cameraId').addEventListener('change', () => settingChanged());
  showSettings(fixSettings(load('bean-settings', {})));

  // Lists the cameras so a grown-up can pick the Logitech. Names show once the browser has been allowed a camera.
  async function fillCameras() {
    const list = await cameras().catch(() => []);
    camerasFound = list.length > 0;
    $<HTMLSelectElement>('s-cameraId').replaceChildren(
      new Option('Default camera', ''),
      ...list.filter((d) => d.deviceId).map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId)),
    );
    showSettings(fixSettings(load('bean-settings', {})));
  }
  if (!ctx.remote && navigator.mediaDevices) {
    fillCameras();
    navigator.mediaDevices.addEventListener('devicechange', fillCameras);
  }
  if (matchMedia('(min-width: 860px)').matches) $<HTMLDetailsElement>('settings').open = true;

  // ---------- progress ----------
  // caught is counted but never shown (spec, section 10).
  const ZERO = { rounds: 0, wins: 0, caught: 0 };
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

  // ---------- the game ----------
  let game = createGame();
  // The webcam watches every round: opened by Start, closed by Stop or the end of the game.
  let cam: Awaited<ReturnType<typeof openCamera>> | null = null;
  const closeCam = () => {
    cam?.close();
    cam = null;
    $('cam-status').hidden = true;
  };

  async function enter(phase: string) {
    const robot = ctx.robot();
    const held = ctx.shown() === 'red' && phase === 'green';
    if (phase === 'win') bump('wins');
    if (phase === 'caught') bump('caught');
    if (gameOver(phase)) closeCam();
    if (phase === 'red') lastCm = null; // only this Red light's readings say how close the kid is
    if (held) praise(lastCm);
    ctx.show(phase);
    playCue(phase);
    // Head first, then light: the firmware clears the LED on any other command.
    if (phase === 'green') await robot.lookAway();
    else await robot.lookAtKid();
    await robot.setLight(...LIGHT[phase]);
  }

  let ticking = false;
  let lastCm: number | null = null; // the last good reading this Red light (0 and 150 mean no echo)
  setInterval(() => {
    if (ticking || gameOver(game.phase)) return;
    ticking = true;
    ctx.queued(async () => {
      // The head points away during Green, so there is nothing to measure.
      const cm = game.phase === 'green' ? null : await ctx.robot().distanceCm();
      if (cm != null) $('reading').textContent = `${cm} cm`;
      if (cm != null && cm > 0 && cm < 150) lastCm = cm;
      // During Red the webcam adds a frame: the kid's body, or null when nobody was found.
      let body: Frame | undefined;
      if (game.phase === 'red' && cam) {
        try {
          body = cam.frame();
        } catch {
          body = null;
        }
        $('cam-status').textContent = body ? 'Webcam: sees you' : 'Webcam: cannot see you';
      }
      const phase = game.tick(performance.now(), cm, body);
      if (phase !== ctx.shown() && phase !== 'idle') await enter(phase);
    }).finally(() => (ticking = false));
  }, 100);

  async function start() {
    const round = settings();
    const startCm = await ctx.robot().distanceCm();
    if (!startCm) {
      ctx.show('idle', 'Bean cannot see you. Stand in the lane, facing Bean, and press Start again.');
      return;
    }
    ctx.show('idle', 'Starting the webcam…');
    try {
      cam = await openCamera($<HTMLVideoElement>('cam-video'), round.cameraId || undefined);
    } catch {
      ctx.show('idle', 'Bean needs the webcam to watch. Plug it in, allow the camera, and press Start again.');
      return;
    }
    $('cam-status').textContent = 'Webcam: on';
    $('cam-status').hidden = false;
    fillCameras(); // the camera names show now that it is allowed
    $('reading').textContent = `${startCm} cm`;
    bump('rounds');
    game = createGame(round);
    game.start(performance.now(), startCm);
    await enter(game.phase);
  }

  // ---------- phone remote ----------
  let mirrored = '';
  return {
    screen: SCREEN,
    showsDistance: true,
    start,
    stop() {
      game.stop();
      closeCam();
    },
    sync: {
      state: () => ({ settings: settings(), totals }),
      mirror(state) {
        const s = state as { settings: Settings; totals: typeof ZERO };
        totals = s.totals;
        drawTotals();
        // Settings are copied only when the laptop's change, so a box being typed in on the phone is left alone.
        if (JSON.stringify(s.settings) !== mirrored) showSettings(s.settings);
        mirrored = JSON.stringify(s.settings);
      },
      apply: (s) => settingChanged(fixSettings(s as Record<string, unknown>)),
    },
  };
}
