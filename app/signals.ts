// Sound cues. Everything is synthesised in the browser, so there are no audio files to license.
let ctx: AudioContext | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;

// Browsers block sound until a tap: call this from the Start button.
export function unlockAudio() {
  const first = !ctx;
  ctx ??= new AudioContext();
  ctx.resume();
  if (first) CUES.forEach(clip); // fetch the game's cues now, so "Red light!" is not late the first time
}

function tone(freq: number, startIn: number, length: number, type: OscillatorType = 'triangle', volume = 0.15) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime + startIn;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length);
}

const TUNE = [392, 440, 494, 587, 494, 440, 392, 330]; // sneaky little loop

export function startMusic() {
  stopMusic();
  let i = 0;
  const step = () => tone(TUNE[i++ % TUNE.length], 0, 0.22);
  step();
  musicTimer = setInterval(step, 250);
}

export function stopMusic() {
  clearInterval(musicTimer);
}

// Bean's ElevenLabs voice from the laptop's server (POST /voice, scripts/voice.ts). Each line is fetched once and kept.
// No key, no internet or no answer in 1.5 s: the browser's voice says the line, and /voice rests for a minute.
const clips = new Map<string, Promise<AudioBuffer | null>>();
let voiceRestsUntil = 0;
let playing: AudioBufferSourceNode | undefined;
let line = 0; // the newest say() or silence(): an older line that is still loading never plays

function clip(text: string) {
  if (!ctx || Date.now() < voiceRestsUntil) return Promise.resolve(null);
  let c = clips.get(text);
  if (!c) {
    c = fetch('/voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(1500) })
      .then(async (r) => (r.ok ? ctx!.decodeAudioData(await r.arrayBuffer()) : null))
      .catch(() => null)
      .then((buffer) => {
        if (!buffer) {
          clips.delete(text);
          voiceRestsUntil = Date.now() + 60_000;
        }
        return buffer;
      });
    clips.set(text, c);
  }
  return c;
}

function quiet() {
  line++;
  playing?.stop();
  playing = undefined;
  speechSynthesis.cancel();
}

// Resolves when the voice is done, or after 5 seconds: some browsers never report the end.
export async function say(text: string) {
  quiet();
  const mine = line;
  const buffer = await clip(text);
  if (mine !== line) return; // Stop or a newer line came first
  return new Promise<void>((resolve) => {
    setTimeout(resolve, buffer ? buffer.duration * 1000 + 500 : 5000);
    if (buffer) {
      const source = (playing = ctx!.createBufferSource());
      source.buffer = buffer;
      source.onended = () => resolve();
      source.connect(ctx!.destination);
      source.start();
      return;
    }
    const words = new SpeechSynthesisUtterance(text);
    words.onend = words.onerror = () => resolve();
    speechSynthesis.speak(words);
  });
}

// Stop pressed: nothing may keep playing or talking.
export function silence() {
  stopMusic();
  quiet();
}

// Bean's Red Light, Green Light lines. After a Red light held still it teases, or says the kid is close (last reading under 30 cm).
const RED = "Red light! Hmm... I'm watchinggg...";
const CAUGHT = 'You moved!!';
const WIN = 'You got me! You win!';
const ALMOST = "You're almost here!";
const TEASE = ['Heyy... Did you just move?', "You're sneaky!"];
const CUES = [RED, CAUGHT, WIN, ALMOST, ...TEASE];
export const praise = (cm: number | null) => say(cm != null && cm < 30 ? ALMOST : TEASE[Math.floor(Math.random() * TEASE.length)]);

const buzz = (pattern: VibratePattern) => navigator.vibrate?.(pattern); // phones only
const BUZZ: Record<string, VibratePattern> = { green: 80, red: [300, 100, 300], win: [100, 60, 100, 60, 300] };

export function playCue(phase: string) {
  stopMusic();
  if (BUZZ[phase]) buzz(BUZZ[phase]);
  if (phase === 'green') {
    startMusic();
  } else if (phase === 'red') {
    tone(220, 0, 0.4, 'square');
    say(RED);
  } else if (phase === 'caught') {
    tone(196, 0, 0.25, 'sawtooth');
    tone(147, 0.25, 0.5, 'sawtooth');
<<<<<<< Updated upstream
    say('I saw you move! Game over.');
=======
    say(CAUGHT);
>>>>>>> Stashed changes
  } else if (phase === 'win') {
    [523, 659, 784, 1047].forEach((f, n) => tone(f, n * 0.15, 0.3));
    say(WIN);
  }
}
