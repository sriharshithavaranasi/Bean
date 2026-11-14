// Switch input (spec, section 6): the kid's piece moves one step along a track for each press.
export function createSteps(total = 10) {
  const steps = { at: 0, total, held: false };

  // The switch went down. `checking` is true once Bean is really looking (the time to freeze is over).
  // Returns 'step', 'win', 'caught', 'ready' (after a catch: the piece is already back at the start), or null when nothing happens.
  steps.press = (phase, checking = true) => {
    if (steps.held) return null; // holding the key counts as one press
    steps.held = true;
    if (phase === 'caught') return 'ready';
    if (phase === 'green') return ++steps.at >= total ? 'win' : 'step';
    if (phase === 'red' && checking) {
      steps.at = 0;
      return 'caught';
    }
    return null;
  };

  steps.release = () => {
    steps.held = false;
  };

  return steps;
}
