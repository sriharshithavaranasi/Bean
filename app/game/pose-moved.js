// Decides whether the kid moved during one Red light from webcam pose landmarks (MediaPipe's 33-point layout).
// Only the torso and legs count: hands and heads move without meaning to, and some kids cannot hold them still.
const TRACKED = [11, 12, 23, 24, 25, 26, 27, 28]; // shoulders, hips, knees, ankles
const SEEN = 0.5;

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const seen = (p) => p && p.visibility >= SEEN;
const torsoSeen = (f) => f && [11, 12, 23, 24].every((i) => seen(f[i]));

// Median position of point i across frames, or null when it was seen in fewer than 2 of them.
function where(frames, i) {
  const pts = frames.map((f) => f[i]).filter(seen);
  return pts.length < 2 ? null : { x: median(pts.map((p) => p.x)), y: median(pts.map((p) => p.y)) };
}

// frames: one landmark array per camera frame (null when nobody was found).
// Returns how far the body drifted, as a share of the kid's torso length, so it means the same whether
// the kid stands near the camera or far from it: in the worst 3 frames in a row, the second-farthest tracked
// point from where it started (two points must agree, so one jumpy landmark is not enough).
// Too few frames, or nobody seen, is 0: standing still must not be caught.
export function poseDrift(frames) {
  const good = frames.filter(torsoSeen);
  if (good.length < 6) return 0;
  const start = TRACKED.map((i) => where(good.slice(0, 3), i));
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const [ls, rs, lh, rh] = start;
  const torso = Math.hypot(mid(ls, rs).x - mid(lh, rh).x, mid(ls, rs).y - mid(lh, rh).y);
  if (torso < 0.02) return 0;
  let worst = 0;
  for (let n = 3; n + 3 <= good.length; n++) {
    const now = TRACKED.map((i) => where(good.slice(n, n + 3), i));
    const drift = now.flatMap((p, k) => (p && start[k] ? [Math.hypot(p.x - start[k].x, p.y - start[k].y) / torso] : []));
    drift.sort((a, b) => b - a);
    worst = Math.max(worst, drift[1] ?? 0);
  }
  return worst;
}

// wiggle: how far the body may drift before it counts as moving, as a share of torso length.
export const poseMoved = (frames, { wiggle }) => poseDrift(frames) > wiggle;

