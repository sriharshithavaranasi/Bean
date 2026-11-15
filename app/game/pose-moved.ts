// Decides whether the kid moved during one Red light from webcam pose landmarks (MediaPipe's 33-point layout).
// Only the torso and legs count: hands and heads move without meaning to, and some kids cannot hold them still.
const TRACKED = [11, 12, 23, 24, 25, 26, 27, 28]; // shoulders, hips, knees, ankles
const SEEN = 0.5;

export type Landmark = { x: number; y: number; visibility?: number };
export type Frame = Landmark[] | null; // null when nobody was found

const seen = (p?: Landmark): p is Landmark => !!p && (p.visibility ?? 0) >= SEEN;

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
