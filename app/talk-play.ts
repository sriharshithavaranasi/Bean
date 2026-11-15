// Talk with Bean on the Talk tab (spec, section 15): a spoken conversation with Gemini Live.
// Start asks the laptop's server for a one-use token (POST /live-token, scripts/live.ts) and opens the Live WebSocket
// straight to Google: the mic streams in and Bean's voice streams back. Bean is a voice orb on the stage that swells
// and glows with its voice; below it, the kid's avatar and name sit beside only what the kid said last.
// Gemini decides when the kid has finished and lets the kid talk over Bean. Needs the first name; ends when the
// play time limit runs out. With mini games allowed, the kid can start Mad Libs or Guess the Animal by asking; Gemini runs the games from
// its instructions, and the app only nudges Bean when the kid goes quiet. Speaking style is not used yet.
// While they talk, Bean's head follows the kid: the webcam rides on the head and the pose model finds the kid's nose.
import { openCamera } from './camera.ts';
import { headSeen } from './game/pose-moved.ts';
import type { Mode, ModeContext } from './mode.ts';
import { HEAD_KID, headToward } from './robot.ts';
import { load } from './store.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODEL = 'models/gemini-3.1-flash-live-preview';
const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const MIC_RATE = 16_000; // what the Live API takes in
const BEAN_RATE = 24_000; // what it sends back
const FACE = 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z'; // a smile, as on Play's start screen

const BASE = (name: string) => `You are Bean, a small friendly robot car helping a young child practise talking and taking turns.
The child's name is ${name}. A grown-up is with them.
Reply in one or two short sentences with simple words a young child knows, then end with one easy question or an invitation to talk.
Be warm and encouraging. Never say an answer is wrong. If you did not understand, praise the try and ask something easy.
Talk only about animals, colours, food, toys, games, feelings, the weather, and the game you are playing.
Never ask for personal information such as where they live, their school, or their family's names.
If the child says something scary, unsafe or grown-up, do not discuss it: say something kind and steer back to an easy topic.
You are a robot, not a person, and you never pretend otherwise.`;

const MAD_LIBS = `Mini-game: Mad Libs. If the child asks to play Mad Libs (they may say it many ways, like "mad libs", "mad lips" or "the silly story game"), play it:
- Ask exactly five questions, one at a time, and wait for each answer. Ask for things a young child knows, never grammar words. Pick five of these and ask in your own short words:
  an animal ("Tell me an animal!"), a colour ("What's a colour?"), a food ("Name a yummy food!"), a silly sound ("Make a silly sound!"), a way to move ("How can you move?"), a place ("Where should we go?"), a describing word ("What's a funny word for how something looks?"), a number ("Say a number!"), a friend's first name ("Who's your friend?", first name only), a body part ("Name a body part!"), a feeling ("How do you feel?"), something in the room ("What can you see near you?").
- Every answer is great: say it back happily and move on. Never correct it.
- If the child is quiet, model an easy answer, for example "You can say: a dog!", "red", "pizza", "boing!", "jump", "the beach", "fuzzy", "five", "Grandma", "nose", "happy" or "a chair".
- After the fifth answer, tell one short silly story of three or four sentences that uses all five answers, then ask if they want to play again. For example: "One day, a purple dog went to the beach. It wanted to eat pizza, so it said 'boing!' and everyone felt happy!"`;
const GUESS_ANIMAL = `Mini-game: Guess the Animal. If the child asks to play Guess the Animal (or "guess the animal", "animal guessing", "guess what animal"), play it:
- Think of an animal a young child knows. Give one easy clue at a time ("I have long ears." "I hop." "I love carrots."), and after each clue let the child guess. Give at most four clues, then tell the answer happily.
- A wrong guess is a great try: say so warmly and give the next clue. Never make the child feel wrong.
- When the child guesses it, cheer, then swap: the child thinks of an animal and you ask simple yes or no questions ("Does it have fur?" "Can it fly?") until you guess it, at most five questions.
- If the child is quiet, give an easier clue, or model a guess: "You can say: is it a bunny?"
- After both turns, ask if they want to play again.`;
const GAMES = `${MAD_LIBS}
${GUESS_ANIMAL}
Play only one game at a time. If the child wants to stop or talk about something else, stop the game happily.
When a game starts, call set_game with its name before you speak. When it ends or the child stops it, call set_game with none.`;

// The game signal: Bean calls set_game when a game starts and ends, so the stage can show which game is on.
const SET_GAME = { functionDeclarations: [{
  name: 'set_game',
  description: 'Call when a mini game starts (with its name) and when it ends or the child stops it (with none).',
  parameters: { type: 'OBJECT', properties: { game: { type: 'STRING', enum: ['mad_libs', 'guess_the_animal', 'none'] } }, required: ['game'] },
}] };
const GAME_NAMES: Record<string, string> = { mad_libs: '🤪 Mad Libs', guess_the_animal: '🦁 Guess the Animal' };
// Bean's face during each game: a silly wink and grin, and a curious raised brow with an "o" mouth.
const GAME_FACES: Record<string, string> = {
  mad_libs: 'M6 8.4h4v1.8H6zM16 7a2 2 0 100 4 2 2 0 000-4zM6 13h12a6 6 0 01-12 0z',
  guess_the_animal: 'M8 8a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM15 4.6l3.8-1.2.5 1.5-3.8 1.2zM12 14.5a2.3 2.3 0 100 4.6 2.3 2.3 0 000-4.6z',
};
const NO_GAMES = 'Mini games are switched off today. If the child asks to play a game such as Mad Libs or Guess the Animal, say kindly that games are off today and keep chatting.';
const rules = (name: string, games: boolean) => `${BASE(name)}
${games ? GAMES : NO_GAMES}`;

// Gemini only answers when the child speaks, so after this much quiet the app asks Bean to help (at most twice in a row).
const QUIET_MS = 7000;
const NUDGE = 'The child has been quiet for a while. Gently help them: in Mad Libs, give an easy example answer such as "You can say: a dog!"; in Guess the Animal, give an easier clue or model a guess. Otherwise ask something easier.';

// Copies each block of mic samples out of the audio thread.
const WORKLET = URL.createObjectURL(new Blob([`registerProcessor('mic', class extends AudioWorkletProcessor {
  process([input]) { if (input[0]) this.port.postMessage(input[0].slice(0)); return true; }
});`], { type: 'text/javascript' }));

// Float samples to 16-bit PCM, base64, as the Live API wants them.
function toPcm64(samples: Float32Array) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  let s = '';
  for (const b of new Uint8Array(pcm.buffer)) s += String.fromCharCode(b);
  return btoa(s);
}

type Live = {
  ws: WebSocket; out: AudioContext; level: AnalyserNode; mic?: MediaStream; inCtx?: AudioContext;
  playing: AudioBufferSourceNode[]; nextAt: number; ending: boolean;
};

export function createTalk(ctx: ModeContext): Mode {
  const bubble = $('tab-talk').querySelector('path')!.getAttribute('d')!; // the Talk tab's speech bubble
  const time = $<HTMLInputElement>('t-time');
  time.addEventListener('input', () => ($('t-time-out').textContent = `${time.value} min`)); // the label follows the slider
  const nameBox = $<HTMLInputElement>('t-name');
  const ageBox = $<HTMLInputElement>('t-age'); // required to start, but not used yet
  // A red message under a field that Start needs; typing in the field clears it.
  const fieldError = (box: HTMLInputElement, show: boolean) => {
    $(`${box.id}-error`).hidden = !show;
    box.setAttribute('aria-invalid', String(show));
  };
  for (const box of [nameBox, ageBox]) box.addEventListener('input', () => fieldError(box, false));

  let timer: ReturnType<typeof setInterval> | undefined;
  let session = 0; // Stop and Start change it, so nothing from an old session lands in the next one
  let live: Live | null = null;

  // ---------- which game is on ----------
  const talkScreen = { status: 'Talking with Bean', hint: '', glyph: FACE }; // its glyph follows the game
  const talking = { name: '', minutes: 0 };
  let game = '';
  const render = () => ctx.show('talk', `${talking.minutes} min left`, GAME_NAMES[game] ?? `Talking with ${talking.name}`);
  function setGame(next: string) {
    game = GAME_NAMES[next] ? next : '';
    talkScreen.glyph = GAME_FACES[game] ?? FACE;
    if (game) document.body.dataset.game = game; // the stage's tint (app.css)
    else delete document.body.dataset.game;
    if (ctx.shown() === 'talk') render();
  }

  // ---------- what the stage shows ----------
  const note = (text: string) => ($('talk-note').textContent = text); // status and errors
  const kidSays = (text: string) => {
    $('kid-text').textContent = text;
    $('kid-says').hidden = !text;
  };
  // The orb follows Bean's voice: louder swells it more and glows brighter, a pause lets it settle.
  const orb = $('light');
  const stillOrb = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function follow(me: Live) {
    const samples = new Float32Array(me.level.fftSize);
    let level = 0;
    const frame = () => {
      if (live !== me) return orb.style.setProperty('--level', '0');
      me.level.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      level = Math.max(Math.min(1, Math.sqrt(sum / samples.length) * 5), level * 0.88); // quick to swell, slow to settle
      orb.style.setProperty('--level', level.toFixed(3));
      requestAnimationFrame(frame);
    };
    if (!stillOrb) requestAnimationFrame(frame);
  }

  // ---------- push to mute ----------
  // A dev tool for demos: hold the button or the M key to cut the mic (to talk to people nearby). Nothing else changes.
  const muteBtn = $<HTMLButtonElement>('mute');
  let muted = false;
  function setMuted(on: boolean) {
    muted = on;
    live?.mic?.getAudioTracks().forEach((t) => (t.enabled = !on));
    muteBtn.setAttribute('aria-pressed', String(on));
    muteBtn.textContent = on ? '🔇 Mic muted' : 'Hold M to mute';
  }
  muteBtn.addEventListener('pointerdown', () => setMuted(true));
  for (const end of ['pointerup', 'pointerleave']) muteBtn.addEventListener(end, () => setMuted(false));
  addEventListener('keydown', (e) => e.key.toLowerCase() === 'm' && ctx.shown() === 'talk' && setMuted(true));
  addEventListener('keyup', (e) => e.key.toLowerCase() === 'm' && setMuted(false));

  // ---------- the live session ----------
  function endLive() {
    const me = live;
    live = null;
    if (!me) return;
    me.ws.close();
    me.mic?.getTracks().forEach((t) => t.stop());
    me.inCtx?.close();
    me.out.close();
    setGame('');
    setMuted(false);
  }
  function stopVoice(me: Live) {
    for (const s of me.playing) s.stop();
    me.playing = [];
    me.nextAt = 0;
  }
  // Bean's voice arrives in small pieces: play each right after the last, with no gaps.
  function play(me: Live, b64: string) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    const buf = me.out.createBuffer(1, pcm.length, BEAN_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = me.out.createBufferSource();
    src.buffer = buf;
    src.connect(me.level); // through the analyser, so the orb hears what plays
    me.nextAt = Math.max(me.nextAt, me.out.currentTime);
    src.start(me.nextAt);
    me.nextAt += buf.duration;
    me.playing.push(src);
    src.onended = () => me.playing.splice(me.playing.indexOf(src), 1);
  }
  async function startMic(me: Live) {
    // Echo cancellation keeps Bean from hearing its own voice from the speaker and talking over itself.
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    if (live !== me) return mic.getTracks().forEach((t) => t.stop());
    const inCtx = new AudioContext({ sampleRate: MIC_RATE });
    await inCtx.audioWorklet.addModule(WORKLET);
    const node = new AudioWorkletNode(inCtx, 'mic');
    inCtx.createMediaStreamSource(mic).connect(node);
    Object.assign(me, { mic, inCtx });
    mic.getAudioTracks().forEach((t) => (t.enabled = !muted)); // muted before the mic was ready
    let parts: Float32Array[] = [];
    let count = 0;
    node.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
      parts.push(data);
      count += data.length;
      if (count < MIC_RATE / 10 || me.ws.readyState !== WebSocket.OPEN) return; // about 0.1 s per message
      const all = new Float32Array(count);
      let at = 0;
      for (const p of parts) all.set(p, (at += p.length) - p.length);
      parts = [];
      count = 0;
      me.ws.send(JSON.stringify({ realtimeInput: { audio: { data: toPcm64(all), mimeType: `audio/pcm;rate=${MIC_RATE}` } } }));
    };
  }

  async function connect(name: string, games: boolean, mine: number) {
    note('Bean is waking up…');
    const res = await fetch('/live-token', { method: 'POST' }).catch(() => null);
    const { token, error } = (await res?.json().catch(() => ({}))) ?? { error: 'the laptop server did not answer' };
    if (mine !== session) return;
    if (!token) return note(`Bean cannot talk right now (${error ?? 'no token'}).`);
    note('');
    const out = new AudioContext({ sampleRate: BEAN_RATE });
    const level = out.createAnalyser();
    level.fftSize = 512;
    level.connect(out.destination);
    const me: Live = { ws: new WebSocket(`${LIVE_URL}?access_token=${encodeURIComponent(token)}`), out, level, playing: [], nextAt: 0, ending: false };
    live = me;
    follow(me);
    let newTurn = true; // the kid's next words replace what is shown
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let nudges = 0;
    // Counted from when Bean's voice finishes playing, not from when Google finished sending it.
    const waitForKid = () => {
      clearTimeout(quiet);
      if (me.ending || nudges >= 2) return;
      quiet = setTimeout(() => {
        if (live !== me || me.ending) return;
        nudges++;
        me.ws.send(JSON.stringify({ realtimeInput: { text: NUDGE } }));
      }, Math.max(0, me.nextAt - me.out.currentTime) * 1000 + QUIET_MS);
    };
    me.ws.onopen = () => me.ws.send(JSON.stringify({ setup: {
      model: MODEL,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: rules(name, games) }] },
      inputAudioTranscription: {}, // the kid's words, shown under the orb
      // Kids pause mid-sentence: wait a full second of quiet before Bean answers. Low start sensitivity, so room noise
      // (an expo, Bean's own voice from the speaker) does not count as the kid talking and cut Bean off.
      realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 1000, startOfSpeechSensitivity: 'START_SENSITIVITY_LOW' } },
      ...(games && { tools: [SET_GAME] }),
    } }));
    me.ws.onmessage = async (e) => {
      if (live !== me) return;
      const m = JSON.parse(typeof e.data === 'string' ? e.data : await (e.data as Blob).text());
      if (m.setupComplete) {
        me.ws.send(JSON.stringify({ realtimeInput: { text: `Say hello to ${name} and ask what they would like to talk about.` } }));
        startMic(me).catch(() => note('Bean cannot hear. Allow the microphone, then press Start again.'));
        return;
      }
      // Bean says a game started or ended: show it, and answer at once so Bean carries on talking.
      for (const call of m.toolCall?.functionCalls ?? []) {
        if (call.name === 'set_game') setGame(call.args?.game);
        me.ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { result: 'ok' } }] } }));
      }
      const sc = m.serverContent;
      if (!sc) return;
      if (sc.interrupted) stopVoice(me); // the kid talked over Bean: Bean stops at once
      if (sc.inputTranscription?.text) {
        clearTimeout(quiet); // the kid is talking
        nudges = 0;
        kidSays((newTurn ? '' : $('kid-text').textContent) + sc.inputTranscription.text);
        newTurn = false;
      }
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) (newTurn = true), clearTimeout(quiet), play(me, p.inlineData.data);
      if (sc.turnComplete) {
        newTurn = true;
        waitForKid();
        if (me.ending) setTimeout(() => live === me && endLive(), (me.nextAt - me.out.currentTime) * 1000 + 300); // after the goodbye plays
      }
    };
    me.ws.onclose = (e) => {
      if (live !== me) return;
      note(`Bean stopped listening${e.reason ? ` (${e.reason})` : ''}. Press Start to talk again.`);
      endLive();
    };
  }

  // ---------- Bean's head follows the kid ----------
  // About three looks a second: each turn waits for the car to finish it, so the next look is at a still picture.
  // No webcam, or it is not allowed: Bean talks without turning its head. Frames stay on the laptop (camera.ts).
  async function followKid(mine: number) {
    const on = () => mine === session && ctx.shown() === 'talk';
    const cam = await openCamera($<HTMLVideoElement>('cam-video'), load('bean-settings', { cameraId: '' }).cameraId || undefined).catch(() => null);
    let angle = HEAD_KID;
    let unseen = 0; // looks in a row with no head in the picture
    while (cam && on()) {
      const body = cam.frame();
      // After about 3 seconds with nobody in the picture, face the middle again, where the kid is most likely to come back.
      const next = headSeen(body) ? ((unseen = 0), headToward(angle, body[0].x)) : ++unseen === 10 ? HEAD_KID : angle;
      if (next !== angle) await ctx.queued(() => on() && ctx.robot().lookAt((angle = next)));
      await new Promise((r) => setTimeout(r, 300));
    }
    cam?.close();
  }

  // The play time limit: the mic closes, Bean says goodbye in its own voice, then the session ends.
  function timesUp(name: string) {
    clearInterval(timer);
    ctx.show('ended');
    const me = live;
    if (!me || me.ws.readyState !== WebSocket.OPEN) return endLive();
    me.ending = true;
    me.mic?.getTracks().forEach((t) => t.stop());
    me.ws.send(JSON.stringify({ realtimeInput: { text: `Our time is up. Say a short, warm goodbye to ${name}.` } }));
    setTimeout(() => live === me && endLive(), 10_000); // in case the goodbye never comes
  }

  return {
    screen: {
      idle: { status: 'Talk with Bean', hint: 'Set the first name and the play time limit, then press Start.', glyph: bubble },
      talk: talkScreen,
      ended: { status: 'Time’s up!', hint: 'That is enough talking for now. Press Play again for a new session.', glyph: 'M7 5h10v14H7z' },
    },
    showsDistance: false,
    async start() {
      const name = nameBox.value.replace(/[^\p{L} '-]/gu, '').trim().slice(0, 20); // it goes into Bean's instructions
      const ageOk = ageBox.value.trim() !== ''; // a number box: anything typed in it is a number
      fieldError(nameBox, !name);
      fieldError(ageBox, !ageOk);
      if (!name || !ageOk) {
        (name ? ageBox : nameBox).focus();
        return;
      }
      await ctx.robot().lookAtKid();
      const mine = ++session;
      $('kid-name').textContent = name;
      kidSays('');
      talking.name = name;
      talking.minutes = 0;
      setGame('');
      const end = Date.now() + Number(time.value) * 60_000;
      const tick = () => {
        const minutes = Math.ceil((end - Date.now()) / 60_000);
        if (minutes <= 0) timesUp(name);
        else if (minutes !== talking.minutes) {
          talking.minutes = minutes; // once a minute, so the spoken hint is not repeated every second
          render();
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      connect(name, $<HTMLInputElement>('t-minigames').checked, mine); // not awaited: Stop must work while Bean is waking up
      followKid(mine).catch((e) => console.error(e)); // not awaited either: the webcam and the body model take a moment to load
    },
    stop() {
      clearInterval(timer);
      session++;
      endLive();
    },
  };
}
