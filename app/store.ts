// Settings and progress, saved on this device only (spec, section 3).
import { DEFAULTS } from './game/freeze-watcher.ts';

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
  cameraId: string; // '' = the default camera
};

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
  s.cameraId = typeof raw.cameraId === 'string' ? raw.cameraId.slice(0, 200) : '';
  return s;
}
