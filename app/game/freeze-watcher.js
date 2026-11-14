import { moved } from './movement.js';

export const DEFAULTS = {
  greenMinMs: 3000,
  greenMaxMs: 7000,
  lookMs: 2500,
  settleMs: 1000, // head is still turning and the kid is still stopping
  leewayCm: 6,
  winCm: 12,
  laneCm: 200,
  caughtMs: 8000, // the round never gets stuck waiting for the kid to go back
};

// Phases: idle, green, red, caught, win. Time and random are passed in so tests control them.
export function createGame(settings = DEFAULTS, random = Math.random) {
  const s = { ...DEFAULTS, ...settings };
  const game = { phase: 'idle', startCm: 0, until: 0, redStart: 0, readings: [] };

  const green = (now) => {
    game.phase = 'green';
    game.until = now + s.greenMinMs + random() * (s.greenMaxMs - s.greenMinMs);
  };

  game.start = (now, startCm) => {
    game.startCm = startCm;
    green(now);
  };

  // Call about every 100 ms with the latest distance, or null when there is none.
  game.tick = (now, cm) => {
    if (game.phase === 'green' && now >= game.until) {
      game.phase = 'red';
      game.redStart = now;
      game.readings = [];
    } else if (game.phase === 'red' && now - game.redStart >= s.settleMs) {
      if (cm > 0 && cm < s.winCm) game.phase = 'win';
      else {
        if (cm != null) game.readings.push(cm);
        if (now - game.redStart >= s.lookMs) {
          if (moved(game.readings, s)) {
            game.phase = 'caught';
            game.until = now + s.caughtMs;
          } else green(now);
        }
      }
    } else if (game.phase === 'caught' && (cm >= game.startCm - s.leewayCm || now >= game.until)) {
      green(now);
    }
    return game.phase;
  };

  game.stop = () => {
    game.phase = 'idle';
  };

  // Parent or kid says they are back at the start line.
  game.ready = (now) => {
    if (game.phase === 'caught') green(now);
  };

  return game;
}
