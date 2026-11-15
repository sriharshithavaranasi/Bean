// Settings and progress, saved on this device only (spec, section 3).
import { DEFAULTS, type Gate } from './game/freeze-watcher.ts';

// Private browsing may refuse storage: the game keeps playing without saving.
export function load<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? 'null') };
  } catch {
    return { ...fallback };
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // keep playing without saving
  }
}

// Lowest and highest value a grown-up may set, in the game's own units.
export const LIMITS = {
  greenMinMs: [1000, 30000], greenMaxMs: [1000, 30000], settleMs: [200, 5000],
  redMinMs: [1000, 30000], redMaxMs: [1000, 30000], winCm: [5, 50], poseWigglePct: [5, 60],
} satisfies Record<string, [number, number]>;
export type Limited = keyof typeof LIMITS;

export type Settings = Record<Limited, number> & {
  game: 'freeze' | 'sneak';
  tab: 'move' | 'talk';
  words: string[];
  cameraId: string; // '' = the default camera
};

const WORDS = ['rabbit', 'red', 'robot', 'run'];

// Fixes bad values instead of breaking the round: a missing or non-numeric value becomes the default,
// a number outside its limits is pulled inside, and a longest green below the shortest is raised to match.
export function fixSettings(raw: Record<string, unknown> = {}): Settings {
  const s = {} as Settings; // every field is set below
  for (const [key, [min, max]] of Object.entries(LIMITS) as [Limited, [number, number]][]) {
    const n = raw[key] == null || raw[key] === '' ? NaN : Number(raw[key]);
    s[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULTS[key];
  }
  s.greenMaxMs = Math.max(s.greenMaxMs, s.greenMinMs);
  s.redMaxMs = Math.max(s.redMaxMs, s.redMinMs);
  s.game = raw.game === 'sneak' ? 'sneak' : 'freeze'; // a saved Robot Says from before falls back
  s.tab = raw.tab === 'talk' ? 'talk' : 'move'; // Move or Talk tab (spec, section 15)
  s.cameraId = typeof raw.cameraId === 'string' ? raw.cameraId.slice(0, 200) : '';
  // Typed as a comma list. Nothing saved gives the spec's words; an emptied list stays empty and switches the gate off.
  const words = raw.words == null ? WORDS : Array.isArray(raw.words) ? raw.words : String(raw.words).split(',');
  s.words = words.map((w) => String(w).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 20);
  return s;
}

// What one round plays with. Say It to Sneak is Freeze Watcher with a word before every Green and a fixed
// 3 second Green (spec, section 6). With no practice words there is nothing to ask for.
export function roundSettings(s: Settings) {
  const sneak = s.game === 'sneak';
  const gate: Gate = sneak && s.words.length ? 'every' : 'off';
  return { ...s, ...(sneak && { greenMinMs: 3000, greenMaxMs: 3000 }), gate };
}
