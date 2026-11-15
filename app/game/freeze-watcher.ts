import { poseMoved, type Frame } from './pose-moved.ts';

export type Gate = 'off' | 'every';
export type Phase = 'idle' | 'green' | 'red' | 'caught' | 'word' | 'win';

export const DEFAULTS = {
  greenMinMs: 3000,
  greenMaxMs: 7000,
  redMinMs: 2500, // each Red lasts a random time between these, so the kid cannot count it
  redMaxMs: 5000,
  settleMs: 1000, // head is still turning and the kid is still stopping
  winCm: 12,
  gate: 'off' as Gate, // practice word before Green: 'off' or 'every' (Say It to Sneak: every Green)
  poseWigglePct: 20, // webcam wiggle room, in % of shoulder width; retune on watch.html (was 15 % of torso length)
};
export type GameSettings = typeof DEFAULTS;

export type Game = {
  phase: Phase;
  startCm: number;
  until: number;
  redStart: number;
  frames: Frame[]; // webcam frames during this Red
  start(now: number, startCm: number): void;
  tick(now: number, cm: number | null, body?: Frame): Phase;
  caught(): void;
  stop(): void;
  accept(now: number): void;
};

// Phases: idle, green, red, word (waiting for the practice word), then caught or win, which end the game. Time and random are passed in so tests control them.
export function createGame(settings: Partial<GameSettings> = DEFAULTS, random = Math.random) {
  const s = { ...DEFAULTS, ...settings };
  const game = { phase: 'idle', startCm: 0, until: 0, redStart: 0, frames: [] } as unknown as Game; // the methods are added below

  // Only the webcam decides "moved": the distance sensor gave too many false catches.
  const kidMoved = () => poseMoved(game.frames, { wiggle: s.poseWigglePct / 100 });

  const between = (now: number, min: number, max: number) => now + min + random() * (max - min);
  const green = (now: number) => {
    game.phase = 'green';
    game.until = between(now, s.greenMinMs, s.greenMaxMs);
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

  // Call about every 100 ms with the latest distance (for the win), or null when there is none,
  // and during Red the latest webcam frame (null when nobody was found).
  game.tick = (now, cm, body) => {
    if (game.phase === 'green' && now >= game.until) {
      game.phase = 'red';
      game.redStart = now;
      game.until = between(now, s.redMinMs, s.redMaxMs);
      game.frames = [];
    } else if (game.phase === 'red' && now - game.redStart >= s.settleMs) {
      if (cm != null && cm > 0 && cm < s.winCm) game.phase = 'win';
      else {
        if (body !== undefined) game.frames.push(body);
        if (now >= game.until) {
          if (kidMoved()) game.caught();
          else next(now);
        }
      }
    }
    return game.phase;
  };

  // Moving on Red ends the game.
  game.caught = () => {
    game.phase = 'caught';
  };

  game.stop = () => {
    game.phase = 'idle';
  };

  // The practice word was heard, or a grown-up pressed Good try.
  game.accept = (now) => {
    if (game.phase === 'word') green(now);
  };

  return game;
}
