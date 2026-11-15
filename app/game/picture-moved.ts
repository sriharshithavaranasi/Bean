// Watches by picture change when the pose cannot be trusted: the kid is so close that their head is out of the picture,
// where the pose model finds nobody or guesses (pose-moved.ts, headSeen). Never the distance sensor.
// A picture is a small grey copy of a camera frame (camera.ts): one number, 0 to 255, per pixel.
import type { Frame } from './pose-moved.ts';

export type Picture = Uint8Array;

// shortcut: this limit and pictureChangePct (freeze-watcher.ts) are arbitrary, never measured (spec, section 16). If they
// catch wrongly, tune them on watch.html: its log lists the picture change of each practice Red light, still or moving.
const LEVEL = 25; // a pixel changed when its grey level moved more than this: above camera noise and flicker from the lights

// Share of the picture that changed from a to b, 0 to 1. The middle (median) change is taken out first: the camera
// adjusting its exposure shifts every pixel alike, and that is not movement.
export function pictureChange(a: Picture, b: Picture) {
  const counts = new Uint16Array(511); // how many pixels changed by -255 .. 255
  for (let i = 0; i < a.length; i++) counts[b[i] - a[i] + 255]++;
  let middle = 0;
  for (let below = counts[0]; below * 2 < a.length; below += counts[++middle]);
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(b[i] - a[i] + 255 - middle) > LEVEL) changed++;
  return changed / a.length;
}

// frames[i]: the trusted pose of camera frame i, or null when there is none. pictures[i]: that frame's picture.
// Returns the most the picture changed from the Red light's first picture, over the frames with no trusted pose.
export function pictureDrift(frames: Frame[], pictures: (Picture | undefined)[]) {
  const first = pictures.find((p) => !!p);
  let worst = 0;
  pictures.forEach((p, i) => {
    if (first && p && !frames[i]) worst = Math.max(worst, pictureChange(first, p));
  });
  return worst;
}
