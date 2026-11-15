// Decides whether the kid moved during one Red light from webcam pose landmarks (MediaPipe's 33-point layout).
// Only the torso and legs count: hands and heads move without meaning to, and some kids cannot hold them still.
const TRACKED = [11, 12, 23, 24, 25, 26, 27, 28]; // shoulders, hips, knees, ankles
const SEEN = 0.5;

export type Landmark = { x: number; y: number; visibility?: number };
export type Frame = Landmark[] | null; // null when nobody was found

const EDGE = 0.05; // points this close to the picture's edge are the model's guesses (a close kid's knees and feet), so they do not count
const inside = (v: number) => v >= EDGE && v <= 1 - EDGE;
const seen = (p?: Landmark): p is Landmark => !!p && (p.visibility ?? 0) >= SEEN && inside(p.x) && inside(p.y);
// The pose is trusted only while the head (the nose) is in the picture. Closer than that the model finds nobody or guesses,
// and the picture itself is watched instead (picture-moved.ts).
export const headSeen = (f?: Frame): f is Landmark[] => !!f && seen(f[0]);

// shortcut: every tracked point is compared one frame at a time, so a lean toward the camera (the shoulders spread)
// or one glitchy frame can catch a still kid, mostly when the kid is close. Next steps if it is still too twitchy,
// best first, once tuned on watch.html with a real kid:
//   1. Track the torso's centre (midpoint of shoulders and hips) instead of each point: a lean or a size change
//      leaves it in place, a real step moves it.
//   2. Smooth over 3 frames (median position) for the start and for each check, so one bad frame cannot catch.
//   3. Allow more wiggle room when the distance sensor says the kid is close (for example x1.5 under 50 cm).
//   4. Raise the default wiggle room (poseWigglePct in freeze-watcher.ts) from 20 to 30-35 %.
//   5. Keep the camera 1 to 1.5 m behind the car, raised (spec, section 16): close up, the kid then stays in frame.
// frames: one landmark array per camera frame (null when nobody was found).
// Returns how far the body drifted, as a share of the kid's shoulder width, so it means the same whether
// the kid stands near the camera or far from it: the farthest any tracked point got from where it was in the
// first frame that saw both shoulders. Points out of the picture are skipped, so the shoulders alone are enough.
// No frame with both shoulders is 0: there is nothing to measure.
export function poseDrift(frames: Frame[]) {
  const first = frames.find((f) => !!f && seen(f[11]) && seen(f[12]));
  if (!first) return 0;
  const width = Math.hypot(first[11].x - first[12].x, first[11].y - first[12].y);
  if (width < 0.02) return 0;
  let worst = 0;
  for (const f of frames) {
    if (!f) continue;
    for (const i of TRACKED) {
      if (seen(first[i]) && seen(f[i])) worst = Math.max(worst, Math.hypot(f[i].x - first[i].x, f[i].y - first[i].y) / width);
    }
  }
  return worst;
}

// wiggle: how far the body may drift before it counts as moving, as a share of shoulder width.
export const poseMoved = (frames: Frame[], { wiggle }: { wiggle: number }) => poseDrift(frames) > wiggle;
