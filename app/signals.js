// Sound cues. Everything is synthesised in the browser, so there are no audio files to license.
let ctx;
let musicTimer;

// Browsers block sound until a tap: call this from the Start button.
export function unlockAudio() {
  ctx ??= new AudioContext();
  ctx.resume();
}

function tone(freq, startIn, length, type = 'triangle', volume = 0.15) {
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

// Resolves when the voice is done, or after 5 seconds: some browsers never report the end.
export function say(text) {
  speechSynthesis.cancel();
  const words = new SpeechSynthesisUtterance(text);
  return new Promise((resolve) => {
    words.onend = words.onerror = resolve;
    setTimeout(resolve, 5000);
    speechSynthesis.speak(words);
  });
}

// Stop pressed: nothing may keep playing or talking.
export function silence() {
  stopMusic();
  speechSynthesis.cancel();
}

const PRAISE = ['Great freezing!', 'So still!', 'I did not see a thing!'];
export const praise = () => say(PRAISE[Math.floor(Math.random() * PRAISE.length)]);

const buzz = (pattern) => navigator.vibrate?.(pattern); // phones only
const BUZZ = { green: 80, red: [300, 100, 300], win: [100, 60, 100, 60, 300] };

export function playCue(phase) {
  stopMusic();
  if (BUZZ[phase]) buzz(BUZZ[phase]);
  if (phase === 'green') {
    startMusic();
  } else if (phase === 'red') {
    tone(220, 0, 0.4, 'square');
    say('Red light!');
  } else if (phase === 'caught') {
    tone(196, 0, 0.25, 'sawtooth');
    tone(147, 0.25, 0.5, 'sawtooth');
    say('I saw you! Go back.');
  } else if (phase === 'win') {
    [523, 659, 784, 1047].forEach((f, n) => tone(f, n * 0.15, 0.3));
    say('You got me! You win!');
  }
}
