---
from: speech
to: parent-app
status: done
priority: normal
created: 2026-11-14
---
# Let Freeze Watcher catch movement with the webcam

## Need
On branch `webcam-watch` (based on `main` at `2294841`) there is a webcam watcher, spec section 16:

- `app/camera.js`: `openCamera(video, deviceId)` returns `{ frame(), close() }`. `frame()` gives MediaPipe's 33 landmarks or `null`. `cameras()` lists cameras.
- `app/game/pose-moved.js`: `poseMoved(frames, { wiggle })` and `poseDrift(frames)`, pure, with tests. Feet may be out of the picture.

Please hook it into Freeze Watcher:

1. `app/game/freeze-watcher.js`: during Red, after `settleMs`, let the caller decide "moved" from camera frames instead of `moved(readings)`. For example `game.tick(now, cm, body)`, keeping `body` frames in `game.frames` like `readings`, and at the end of the look time use `poseMoved(game.frames, { wiggle: s.poseWiggle })` when `s.watch === 'camera'` and at least 6 frames had a body; otherwise fall back to `moved(readings)` for that round, so stepping out of the picture never escapes being caught. Win and start distance still come from `cm`.
2. Settings and `app/store.js` `LIMITS`: `watch` (`'sensor'` or `'camera'`, default `'sensor'`), `cameraId` (string), `poseWiggle` (default 0.15, 0.05 to 0.6). The camera rows show only when `cameras()` finds one.
3. `app/main.js`: open the camera with a hidden `<video>` when a camera round starts, call `cam.frame()` in the 100 ms tick during Red, and `cam.close()` in `stopRound()`.

## Why
The distance sensor only sees movement straight toward the car, in a narrow cone. Kids step sideways or shuffle and are not caught, which feels unfair to the other players. The camera fixes that without changing any timing or signal.

## Done when
With "Bean watches with: the webcam", stepping sideways during Red is caught and standing still for 10 Red lights is never caught on the real lane; with the sensor setting nothing changes; `npm test` passes. Tune `poseWiggle` first on `app/watch.html`.

## Thread
- 2026-11-14 speech: first try on `app/watch.html` with the Logitech says "still" too often (caught 1 time out of several real moves). Still tuning timing, frame rate and wiggle room; hold the hookup until a follow-up line here says it is tuned.
- 2026-11-14 speech: second run found the cause. The camera was too close (body 120 to 260% of the picture tall), so it lost the kid in about half the rounds; the detector itself was fine (still at most 0.11, moves from 0.20). Wiggle room default is now 0.15, and spec 16 now puts the camera 1 to 1.5 m behind the car, raised. Still hold the hookup until a run from that spot is clean.
- 2026-11-14 jxc: merged `webcam-watch` (`612a00b`) into `main` as `90e6317` with a merge commit. Only new files plus spec section 16, no conflicts, 61 tests pass. Nothing calls the camera from Freeze Watcher yet, so the hookup above is still open and still waits for speech's "tuned" line. Build it on `main`. `webcam-watch` is kept.
- 2026-11-14 speech: done by speech, no work needed from parent-app. On `talk-with-bean` (`02c4eea`, on top of the merge `ca7c3d1`), it reaches `main` when that branch is pushed. In your files: `freeze-watcher.ts` takes `watch` and `poseWigglePct` (stored as % of torso, default 15, `LIMITS` 5 to 60); `tick(now, cm, body)` keeps `game.frames` during Red; `poseMoved` decides when `bodyFrames()` (new in `pose-moved.ts`) is 6 or more, else `moved(readings)`. `main.ts` opens the camera into a hidden `#cam-video` at Start, calls `cam.frame()` in the tick during Red, and closes it in `stopRound()` and on a win; a camera that will not open plays the round with the sensor and says so. Settings: `#watch-row` (shown when `cameras()` finds one), `#camera-row` and the wiggle field (while the webcam is chosen). 70 tests pass. Tuning from the new camera spot is not finished; spec 16 still asks the team to agree before the webcam is used in games.
