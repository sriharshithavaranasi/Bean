// Talk with Bean on the Talk tab (spec, section 15): a spoken conversation with Gemini Live.
// Start asks the laptop's server for a one-use token (POST /live-token, scripts/live.ts) and opens the Live WebSocket
// straight to Google: the mic streams in and Bean's voice streams back. Bean is a voice orb on the stage that swells
// and glows with its voice; below it, the kid's avatar and name sit beside only what the kid said last.
// Gemini decides when the kid has finished and lets the kid talk over Bean. Needs the first name; ends when the
// play time limit runs out. Speaking style and Play Mad Libs are on the page but nothing reads them yet.
import type { Mode, ModeContext } from './mode.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODEL = 'models/gemini-3.1-flash-live-preview';
const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
const MIC_RATE = 16_000; // what the Live API takes in
const BEAN_RATE = 24_000; // what it sends back
const FACE = 'M8 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM7 14h10a5 5 0 01-10 0z'; // a smile, as on Play's start screen

const rules = (name: string) => `You are Bean, a small friendly robot car helping a young child practise talking and taking turns.
The child's name is ${name}. A grown-up is with them.
Reply in one or two short sentences with simple words a young child knows, then end with one easy question or an invitation to talk.
Be warm and encouraging. Never say an answer is wrong. If you did not understand, praise the try and ask something easy.
Talk only about animals, colours, food, toys, games, feelings, the weather, and the game you are playing.
Never ask for personal information such as where they live, their school, or their family's names.
If the child says something scary, unsafe or grown-up, do not discuss it: say something kind and steer back to an easy topic.
You are a robot, not a person, and you never pretend otherwise.`;

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
  const nameError = (show: boolean) => {
    $('t-name-error').hidden = !show;
    nameBox.setAttribute('aria-invalid', String(show));
  };
  nameBox.addEventListener('input', () => nameError(false));

  let timer: ReturnType<typeof setInterval> | undefined;
  let session = 0; // Stop and Start change it, so nothing from an old session lands in the next one
  let live: Live | null = null;

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

  // ---------- the live session ----------
  function endLive() {
    const me = live;
    live = null;
    if (!me) return;
    me.ws.close();
    me.mic?.getTracks().forEach((t) => t.stop());
    me.inCtx?.close();
    me.out.close();
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

  async function connect(name: string, mine: number) {
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
    me.ws.onopen = () => me.ws.send(JSON.stringify({ setup: {
      model: MODEL,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: rules(name) }] },
      inputAudioTranscription: {}, // the kid's words, shown under the orb
      // Kids pause mid-sentence: wait a full second of quiet before Bean answers.
      realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 1000 } },
    } }));
    me.ws.onmessage = async (e) => {
      if (live !== me) return;
      const m = JSON.parse(typeof e.data === 'string' ? e.data : await (e.data as Blob).text());
      if (m.setupComplete) {
        me.ws.send(JSON.stringify({ realtimeInput: { text: `Say hello to ${name} and ask what they would like to talk about.` } }));
        startMic(me).catch(() => note('Bean cannot hear. Allow the microphone, then press Start again.'));
        return;
      }
      const sc = m.serverContent;
      if (!sc) return;
      if (sc.interrupted) stopVoice(me); // the kid talked over Bean: Bean stops at once
      if (sc.inputTranscription?.text) {
        kidSays((newTurn ? '' : $('kid-text').textContent) + sc.inputTranscription.text);
        newTurn = false;
      }
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) (newTurn = true), play(me, p.inlineData.data);
      if (sc.turnComplete) {
        newTurn = true;
        if (me.ending) setTimeout(() => live === me && endLive(), (me.nextAt - me.out.currentTime) * 1000 + 300); // after the goodbye plays
      }
    };
    me.ws.onclose = (e) => {
      if (live !== me) return;
      note(`Bean stopped listening${e.reason ? ` (${e.reason})` : ''}. Press Start to talk again.`);
      endLive();
    };
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
      talk: { status: 'Talking with Bean', hint: '', glyph: FACE },
      ended: { status: 'Time’s up!', hint: 'That is enough talking for now. Press Play again for a new session.', glyph: 'M7 5h10v14H7z' },
    },
    showsDistance: false,
    async start() {
      const name = nameBox.value.replace(/[^\p{L} '-]/gu, '').trim().slice(0, 20); // it goes into Bean's instructions
      nameError(!name);
      if (!name) {
        nameBox.focus();
        return;
      }
      await ctx.robot().lookAtKid();
      const mine = ++session;
      $('kid-name').textContent = name;
      kidSays('');
      const end = Date.now() + Number(time.value) * 60_000;
      let shownMinutes = -1;
      const tick = () => {
        const minutes = Math.ceil((end - Date.now()) / 60_000);
        if (minutes <= 0) timesUp(name);
        else if (minutes !== shownMinutes) {
          shownMinutes = minutes; // once a minute, so the spoken hint is not repeated every second
          ctx.show('talk', `${minutes} min left`, `Talking with ${name}`);
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      connect(name, mine); // not awaited: Stop must work while Bean is waking up
    },
    stop() {
      clearInterval(timer);
      session++;
      endLive();
    },
  };
}
