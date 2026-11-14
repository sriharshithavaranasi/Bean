import { moved } from './movement.ts';

export type Gate = 'off' | 'every';
export type Phase = 'idle' | 'green' | 'red' | 'caught' | 'word' | 'win';

export const DEFAULTS = {
  greenMinMs: 3000,
  greenMaxMs: 7000,
  lookMs: 2500,
  settleMs: 1000, // head is still turning and the kid is still stopping
  leewayCm: 6,
  winCm: 12,
  laneCm: 200,
  caughtMs: 8000, // the round never gets stuck waiting for the kid to go back
  steps: 10, // switch presses to win
  doMs: 3000, // Robot Says: time to do each command (or to ignore a fake one)
  gate: 'off' as Gate, // practice word before Green: 'off' or 'every' (Say It to Sneak: every Green)
};
export type GameSettings = typeof DEFAULTS;

export type Game = {
  phase: Phase;
  startCm: number;
  until: number;
  redStart: number;
  readings: number[];
  start(now: number, startCm: number): void;
  tick(now: number, cm: number | null): Phase;
  caught(now: number): void;
  checking(now: number): boolean;
  win(): void;
  stop(): void;
  ready(now: number): void;
  accept(now: number): void;
};

// Phases: idle, green, red, caught, word (waiting for the practice word), win. Time and random are passed in so tests control them.
export function createGame(settings: Partial<GameSettings> = DEFAULTS, random = Math.random) {
  const s = { ...DEFAULTS, ...settings };
  const game = { phase: 'idle', startCm: 0, until: 0, redStart: 0, readings: [] } as unknown as Game; // the methods are added below

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

  // Call about every 100 ms with the latest distance, or null when there is none.
  game.tick = (now, cm) => {
    if (game.phase === 'green' && now >= game.until) {
      game.phase = 'red';
      game.redStart = now;
      game.readings = [];
    } else if (game.phase === 'red' && now - game.redStart >= s.settleMs) {
      if (cm != null && cm > 0 && cm < s.winCm) game.phase = 'win';
      else {
        if (cm != null) game.readings.push(cm);
        if (now - game.redStart >= s.lookMs) {
          if (moved(game.readings, s)) game.caught(now);
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

  // Switch input (steps.ts) decides caught and win with a press instead of a distance.
  game.checking = (now) => game.phase === 'red' && now - game.redStart >= s.settleMs;
  game.win = () => {
    game.phase = 'win';
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
