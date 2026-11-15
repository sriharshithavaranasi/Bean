import { pictureDrift, type Picture } from './picture-moved.ts';
import { headSeen, poseMoved, type Frame } from './pose-moved.ts';

export type Phase = 'idle' | 'countdown' | 'green' | 'red' | 'caught' | 'win' | 'ended';

export const DEFAULTS = {
  countdownMs: 3000, // "3, 2, 1" before the first Green
  greenMinMs: 3000,
  greenMaxMs: 7000,
  redMinMs: 2500, // each Red lasts a random time between these, so the kid cannot count it
  redMaxMs: 5000,
  settleMs: 1000, // head is still turning and the kid is still stopping
  winCm: 30,
  winHoldMs: 1000, // every reading must stay under the win distance this long: one stray echo from the sensor is not a win
  maxRedLights: 12, // after this many Red lights with no catch and no win, nobody is playing: the game ends
  poseWigglePct: 20, // webcam wiggle room, in % of shoulder width; retune on watch.html (was 15 % of torso length)
  pictureChangePct: 10, // head out of the picture: % of the picture that may change. shortcut: arbitrary, never measured (spec, section 16); tune it on watch.html if it catches wrongly
};
export type GameSettings = typeof DEFAULTS;

export type Game = {
  phase: Phase;
  startCm: number;
  until: number;
  redStart: number;
  redLights: number; // Red lights finished this game
  frames: Frame[]; // webcam frames during this Red: the pose when the head is in the picture, else null
  pictures: (Picture | undefined)[]; // the same frames as small grey pictures
  start(now: number, startCm: number): void;
  tick(now: number, cm: number | null, body?: Frame, picture?: Picture): Phase;
  caught(): void;
  stop(): void;
};

// Phases: idle, countdown, green, red, then caught, win or ended (nobody played), which end the game. Time and random are passed in so tests control them.
export function createGame(settings: Partial<GameSettings> = DEFAULTS, random = Math.random) {
  const s = { ...DEFAULTS, ...settings };
  const game = { phase: 'idle', startCm: 0, until: 0, redStart: 0, redLights: 0, frames: [], pictures: [] } as unknown as Game; // the methods are added below

  // Only the webcam decides "moved": the distance sensor gave too many false catches.
  // The pose decides while the head is in the picture; closer than that, a change in the picture does.
  const kidMoved = () =>
    poseMoved(game.frames, { wiggle: s.poseWigglePct / 100 }) || pictureDrift(game.frames, game.pictures) > s.pictureChangePct / 100;

  let nearSince: number | null = null; // when the unbroken run of readings under the win distance began, this Red
  const between = (now: number, min: number, max: number) => now + min + random() * (max - min);
  const green = (now: number) => {
    game.phase = 'green';
    game.until = between(now, s.greenMinMs, s.greenMaxMs);
  };

  game.start = (now, startCm) => {
    game.startCm = startCm;
    game.phase = 'countdown';
    game.until = now + s.countdownMs;
  };

  // Call about every 100 ms with the latest distance (for the win), or null when there is none,
  // and during Red the latest webcam frame (null when nobody was found) with its small grey picture.
  game.tick = (now, cm, body, picture) => {
    if (game.phase === 'countdown' && now >= game.until) green(game.until); // timed from the end of the count, not from a late tick
    if (game.phase === 'green' && now >= game.until) {
      game.phase = 'red';
      game.redStart = now;
      game.until = between(now, s.redMinMs, s.redMaxMs);
      game.frames = [];
      game.pictures = [];
      nearSince = null;
    } else if (game.phase === 'red' && now - game.redStart >= s.settleMs) {
      // A far reading, a 0 (no echo) or no reading at all breaks the run, and it starts again.
      if (cm != null && cm > 0 && cm < s.winCm) nearSince ??= now;
      else nearSince = null;
      if (nearSince != null && now - nearSince >= s.winHoldMs) game.phase = 'win';
      else {
        if (body !== undefined) {
          game.frames.push(headSeen(body) ? body : null);
          game.pictures.push(picture);
        }
        // Checked on every tick, so the catch lands when the kid moves, not when the Red light ends (up to 4 s later).
        if (kidMoved()) game.caught();
        else if (now >= game.until) {
          if (++game.redLights >= s.maxRedLights) game.phase = 'ended';
          else green(now);
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

  return game;
}
