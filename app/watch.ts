// The webcam tuning page (watch.html): try Freeze Watcher's body check and set the wiggle room.
import { cameras, openCamera } from './camera.ts';
import { DEFAULTS } from './game/freeze-watcher.ts';
import { pictureDrift, type Picture } from './game/picture-moved.ts';
import { headSeen, poseDrift, type Frame } from './game/pose-moved.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const wiggleBox = $<HTMLInputElement>('wiggle');
const camBox = $<HTMLSelectElement>('cam');
const tryButton = $<HTMLButtonElement>('try');
const stopButton = $<HTMLButtonElement>('stop');
const SETTLE_MS = 1000; // same as Freeze Watcher: time to freeze before Bean checks
const CHECK_MS = 1500; // Bean stares 2.5 s, so it checks for the last 1.5 s
const TRACKED = [11, 12, 23, 24, 25, 26, 27, 28];
let cam: Awaited<ReturnType<typeof openCamera>> | null = null;
let collecting: Frame[] | null = null; // frames of the current check (the pose when the head is in the picture, else null), or null
let shots: Picture[] = []; // the same frames as small grey pictures

const note = (text: string) => $('log').append(Object.assign(document.createElement('li'), { textContent: text }));
wiggleBox.oninput = () => ($<HTMLOutputElement>('wiggle-out').value = Number(wiggleBox.value).toFixed(2));
wiggleBox.onchange = () => note(`Wiggle room set to ${$<HTMLOutputElement>('wiggle-out').value}`);

async function fillCameras() {
  const pick = camBox.value;
  camBox.replaceChildren(new Option('Default camera', ''), ...(await cameras()).map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId)));
  camBox.value = pick;
}
fillCameras();

$('on').onclick = async () => {
  cam?.close();
  $('seen').textContent = 'Loading the body model…';
  try {
    cam = await openCamera($<HTMLVideoElement>('video'), camBox.value);
  } catch (e) {
    $('seen').textContent = `Could not open the camera: ${(e as Error).message}`;
    return;
  }
  await fillCameras(); // names appear once the camera is allowed
  tryButton.disabled = false;
  loop();
};
camBox.onchange = () => {
  note(`Camera switched to ${camBox.selectedOptions[0].text}`);
  if (cam) $('on').click();
};

const ctx = $<HTMLCanvasElement>('dots').getContext('2d')!;
let lastSeen = '';
function loop() {
  if (!cam) return;
  const body = cam.frame();
  const picture = cam.picture();
  if (collecting) {
    collecting.push(headSeen(body) ? body : null);
    shots.push(picture);
  }
  ctx.clearRect(0, 0, 640, 480);
  for (const [i, p] of (body ?? []).entries()) {
    if ((p.visibility ?? 0) < 0.5) continue;
    ctx.fillStyle = TRACKED.includes(i) ? '#2fbf71' : 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.arc(p.x * 640, p.y * 480, TRACKED.includes(i) ? 7 : 4, 0, 7);
    ctx.fill();
  }
  const now = headSeen(body) ? 'Body found: green dots are the points Bean watches.' : 'No head in the picture: Bean watches the whole picture for change.';
  if (now !== lastSeen) $('seen').textContent = lastSeen = now;
  setTimeout(() => requestAnimationFrame(loop), 100); // about 10 frames a second, like the distance sensor
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const say = (text: string) => {
  $('result').textContent = text;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
};
let running = false;
stopButton.onclick = () => (running = false);
$('copy').onclick = () => navigator.clipboard.writeText([...$('log').children].map((li) => li.textContent).join('\n'));

tryButton.onclick = async () => {
  running = true;
  tryButton.disabled = true;
  stopButton.disabled = false;
  for (let n = 5; n > 0 && running; n--) {
    say(n === 5 ? 'Get into place. 5' : String(n));
    await wait(1000);
  }
  for (let round = 1; running; round++) {
    document.body.dataset.phase = 'green';
    say('Green light!');
    await wait(3000);
    if (!running) break;
    document.body.dataset.phase = 'red';
    say('Red light!');
    await wait(SETTLE_MS);
    collecting = [];
    shots = [];
    await wait(CHECK_MS);
    const frames: Frame[] = collecting;
    collecting = null;
    const drift = poseDrift(frames);
    const change = pictureDrift(frames, shots);
    const limit = DEFAULTS.pictureChangePct / 100;
    const wiggle = Number(wiggleBox.value);
    const seen = frames.filter(Boolean).length;
    const verdict = drift > wiggle || change > limit ? 'I saw you move' : 'So still';
    say(verdict);
    $('log').append(Object.assign(document.createElement('li'), {
      textContent: `${verdict}: drift ${drift.toFixed(2)}, wiggle room ${wiggle.toFixed(2)}, picture change ${change.toFixed(2)}, limit ${limit.toFixed(2)}, ${seen} of ${frames.length} frames with the head in the picture, ${camBox.selectedOptions[0].text}`,
    }));
    await wait(1500);
  }
  document.body.dataset.phase = 'idle';
  say('Stopped.');
  tryButton.disabled = false;
  stopButton.disabled = true;
};
