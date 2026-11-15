# MediaPipe Tasks Vision (vendored)

`@mediapipe/tasks-vision` 1.2.3, Apache-2.0, by Google. Kept here so the webcam watcher works without WiFi.

- `tasks-vision.js` is the package's `vision_bundle.mjs`, renamed so `scripts/serve.ts` serves it as JavaScript.
- `tasks-vision.d.ts` is ours: types for the few parts the app uses (`FilesetResolver`, `PoseLandmarker`).
- `vision_wasm_internal.js` and `.wasm` are from the package's `wasm/` folder.
- `pose_landmarker_full.task` is the pose model from
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
  (the lite model made up a jumping skeleton when the kid stood too close; see `app/camera.ts`)

Frames are processed on the laptop. Nothing is sent to Google.
