// Fake robot for working without the car. The page's slider sets the distance;
// onChange lets the page draw the head direction and light colour.
import { makeRobot } from './robot.js';

export function makeMockRobot(getDistanceCm, onChange) {
  return makeRobot(async (c) => {
    if (c.N === 21) return String(getDistanceCm());
    if (c.N === 5) onChange({ head: c.D2 });
    if (c.N === 8) onChange({ light: `rgb(${c.D2}, ${c.D3}, ${c.D4})` });
    return 'ok';
  });
}
