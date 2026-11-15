import { moved } from './movement.ts';
import { bodyFrames, poseMoved, type Frame } from './pose-moved.ts';

export type Gate = 'off' | 'every';
export type Watch = 'sensor' | 'camera';
export type Phase = 'idle' | 'green' | 'red' | 'caught' | 'word' | 'win';

export const DEFAULTS = {
  greenMinMs: 3000,
  greenMaxMs: 7000,
  lookMs: 2500,
  settleMs: 1000, // head is still turning and the kid is still stopping
  leewayCm: 15, // still car readings: 0 false catches in 43 Red lights; the old 6 with 150s kept caught 9 (issue #3)
  winCm: 12,
  laneCm: 150, // the sensor reads up to 150 cm
  caughtMs: 8000, // the round never gets stuck waiting for the kid to go back
  gate: 'off' as Gate, // practice word before Green: 'off' or 'every' (Say It to Sneak: every Green)
  watch: 'sensor' as Watch, // what decides "moved" during Red (spec, section 16); the win always comes from the sensor
  poseWigglePct: 15, // webcam wiggle room, in % of torso length: still drifted up to 11, real moves from 20 (watch.html)
};
export type GameSettings = typeof DEFAULTS;

export type Game = {
  phase: Phase;
  startCm: number;
  until: number;
  redStart: number;
  readings: number[];
  frames: Frame[]; // webcam frames during this Red
  start(now: number, startCm: number): void;
  tick(now: number, cm: number | null, body?: Frame): Phase;
  caught(now: number): void;
  stop(): void;
  ready(now: number): void;
  accept(now: number): void;
};

// Phases: idle, green, red, caught, word (waiting for the practice word), win. Time and random are passed in so tests control them.
export function createGame(settings: Partial<GameSettings> = DEFAULTS, random = Math.random) {
  const s = { ...DEFAULTS, ...settings };
  const game = { phase: 'idle', startCm: 0, until: 0, redStart: 0, readings: [], frames: [] } as unknown as Game; // the methods are added below

  // The webcam decides when it saw the kid in enough frames; otherwise the distance sensor does,
  // so stepping out of the picture never escapes being caught.
  const kidMoved = () =>
    s.watch === 'camera' && bodyFrames(game.frames) >= 6
      ? poseMoved(game.frames, { wiggle: s.poseWigglePct / 100 })
      : moved(game.readings, s);

  const green = (now: number) => {
    game.phase = 'green';
    game.until = now + s.greenMinMs + random() * (s.greenMaxMs - s.greenMinMs);
  };

  // The next Green light, or the wait for a practice word that earns it.
  const next = (now: number) => {
    if (s.gate === 'every') game.phase = 'word';
    else green(now);
  };

  game.start = (now, startCm) => {
    game.startCm = startCm;
    next(now);
  };

  // Call about every 100 ms with the latest distance, or null when there is none,
  // and during Red the latest webcam frame (null when nobody was found) when the webcam watches.
  game.tick = (now, cm, body) => {
    if (game.phase === 'green' && now >= game.until) {
      game.phase = 'red';
      game.redStart = now;
      game.readings = [];
      game.frames = [];
    } else if (game.phase === 'red' && now - game.redStart >= s.settleMs) {
      if (cm != null && cm > 0 && cm < s.winCm) game.phase = 'win';
      else {
        if (cm != null) game.readings.push(cm);
        if (body !== undefined) game.frames.push(body);
        if (now - game.redStart >= s.lookMs) {
          if (kidMoved()) game.caught(now);
          else next(now);
        }
      }
    } else if (game.phase === 'caught' && ((cm != null && cm >= game.startCm - s.leewayCm) || now >= game.until)) {
      next(now);
    }
    return game.phase;
  };

  game.caught = (now) => {
    game.phase = 'caught';
    game.until = now + s.caughtMs;
  };

  game.stop = () => {
    game.phase = 'idle';
  };

  // Parent or kid says they are back at the start line.
  game.ready = (now) => {
    if (game.phase === 'caught') next(now);
  };

  // The practice word was heard, or a grown-up pressed Good try.
  game.accept = (now) => {
    if (game.phase === 'word') green(now);
  };

  return game;
}
