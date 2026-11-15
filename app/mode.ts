// The contract between the page shell (main.ts) and each activity: Play with Bean (play.ts) and Talk with Bean (talk-play.ts).
// A mode owns its settings, progress and game; the shell owns the tabs, the stage, Start / Stop, the robot link and the phone remote.
import type { Robot } from './robot.ts';

// What the stage shows for one phase: status words, hint and glyph (a second cue beside colour).
export type Screen = { status?: string; hint: string; glyph: string };

// What the shell gives a mode.
export type ModeContext = {
  show: (phase: string, hint?: string, status?: string) => void; // set the stage: phase colour, words, glyph
  shown: () => string; // the phase on the stage now
  queued: <T>(job: () => T) => Promise<unknown>; // robot commands run one after another
  robot: () => Robot; // the car, or the pretend robot
  remote: string | null; // set on a phone remote: the mode only asks the laptop
  send: (message: object) => void; // phone to laptop
};

// What a mode gives the shell.
export type Mode = {
  screen: Record<string, Screen>; // must have idle
  showsDistance: boolean;
  start(): Promise<void>; // runs in the robot queue, after the previous round has stopped
  stop(): void; // end whatever this mode runs; the shell then shows idle and turns Bean to the kid
  sync?: { state(): unknown; mirror(state: unknown): void; apply(settings: unknown): void }; // phone remote
};
