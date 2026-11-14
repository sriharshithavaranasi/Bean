---
from: speech
to: parent-app
status: open
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
