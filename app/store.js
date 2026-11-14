// Settings and progress, saved on this device only (spec, section 3).
import { DEFAULTS } from './game/freeze-watcher.js';

// Private browsing may refuse storage: the game keeps playing without saving.
export function load(key, fallback) {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key)) };
  } catch {
    return { ...fallback };
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // keep playing without saving
  }
}

// Lowest and highest value a grown-up may set, in the game's own units.
export const LIMITS = {
  greenMinMs: [1000, 30000], greenMaxMs: [1000, 30000], settleMs: [200, 5000],
  lookMs: [1000, 10000], leewayCm: [2, 50], winCm: [5, 50], steps: [2, 30], doMs: [1000, 15000],
};

const WORDS = ['rabbit', 'red', 'robot', 'run'];

// Fixes bad values instead of breaking the round: a missing or non-numeric value becomes the default,
// a number outside its limits is pulled inside, and a longest green below the shortest is raised to match.
export function fixSettings(raw = {}) {
  const s = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = raw[key] == null || raw[key] === '' ? NaN : Number(raw[key]);
    s[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULTS[key];
  }
  s.greenMaxMs = Math.max(s.greenMaxMs, s.greenMinMs);
  s.steps = Math.round(s.steps);
  s.input = raw.input === 'switch' ? 'switch' : 'body'; // how the kid moves
  s.game = ['sneak', 'says'].includes(raw.game) ? raw.game : 'freeze';
  s.tab = raw.tab === 'talk' ? 'talk' : 'move'; // Move or Talk tab (spec, section 15)
  // Typed as a comma list. Nothing saved gives the spec's words; an emptied list stays empty and switches the gate off.
  const words = raw.words == null ? WORDS : Array.isArray(raw.words) ? raw.words : String(raw.words).split(',');
  s.words = words.map((w) => String(w).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 20);
  return s;
}

// What one round plays with. Say It to Sneak is Freeze Watcher with a word before every Green and a fixed
// 3 second Green (spec, section 6). With no practice words there is nothing to ask for.
export function roundSettings(s) {
  const sneak = s.game === 'sneak';
  const gate = sneak && s.words.length ? 'every' : 'off';
  return { ...s, ...(sneak && { greenMinMs: 3000, greenMaxMs: 3000 }), gate };
}
