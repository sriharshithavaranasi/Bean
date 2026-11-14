// Robot Says (spec, section 6): eight commands, a score out of 8. Pure rules; main.ts runs the round.
export const COMMANDS = {
  closer: 'Take one step closer',
  back: 'Take one step back',
  freeze: 'Freeze like a statue',
  wave: 'Wave hello',
};
export type Kind = keyof typeof COMMANDS;
export type Outcome = 'point' | 'miss' | 'gotcha';
// What was seen while the kid had time to do the command: distances (body), a press (switch) or the grown-up's answer (wave).
export type Seen = { startCm?: number | null; endCm?: number | null; leewayCm?: number; pressed?: boolean; parent?: boolean | null };

// About 7 in 10 commands are real ("Robot says ..."). Freeze is always real.
export function makeCommands(random = Math.random, count = 8) {
  const kinds = Object.keys(COMMANDS) as Kind[];
  return Array.from({ length: count }, () => {
    const kind = kinds[Math.floor(random() * kinds.length)];
    const roll = random();
    return { kind, real: kind === 'freeze' || roll < 0.7 };
  });
}

// Did the kid do it? Body: the distance before and after. Switch: `pressed` is true or false. Wave: the grown-up says.
export function did(kind: Kind, { startCm, endCm, leewayCm = 0, pressed, parent }: Seen) {
  if (kind === 'wave') return parent === true;
  if (pressed != null) return kind === 'freeze' ? !pressed : pressed;
  const closer = startCm && endCm && startCm > 0 && endCm > 0 ? startCm - endCm : 0; // a missing reading counts as standing still
  if (kind === 'closer') return closer > leewayCm;
  if (kind === 'back') return -closer > leewayCm;
  return Math.abs(closer) <= leewayCm;
}

// A real command done scores. A fake command ignored scores. A fake command obeyed is a gotcha.
export const outcome = (real: boolean, done: boolean): Outcome => (real ? (done ? 'point' : 'miss') : done ? 'gotcha' : 'point');

export const total = (outcomes: Outcome[]) => outcomes.filter((o) => o === 'point').length;
