// Webcam pose watcher. Frames are processed on the laptop with MediaPipe; nothing is recorded or sent anywhere.
import { FilesetResolver, PoseLandmarker } from './vendor/mediapipe/tasks-vision.js';
import type { Frame } from './game/pose-moved.ts';

const FILES = new URL('./vendor/mediapipe', import.meta.url).href;

// Lists the cameras, so a grown-up can pick the Logitech instead of the laptop's own camera.
// Names show only after the browser has been allowed to use a camera once.
export async function cameras() {
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
}

// Opens the camera into `video` and loads the pose model. frame() returns the body's 33 landmarks, or null.
export async function openCamera(video: HTMLVideoElement, deviceId?: string) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: 640, height: 480 },
    audio: false, // the microphone belongs to the speech games
  });
  video.srcObject = stream;
  await video.play();
  const vision = await FilesetResolver.forVisionTasks(FILES);
  // The full model, not lite: with the kid too close (head out of the picture) lite kept tracking a made-up skeleton that
  // jumped about, so a still kid was caught on every Red light. Full reports nobody there instead (recorded side by side, 2026-11-15).
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${FILES}/pose_landmarker_full.task`, delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  });
  let pose: PoseLandmarker;
  try {
    pose = await PoseLandmarker.createFromOptions(vision, options('GPU'));
  } catch {
    pose = await PoseLandmarker.createFromOptions(vision, options('CPU')); // some laptops have no usable WebGL
  }
  let last = 0;
  return {
    frame(): Frame {
      const now = Math.max(performance.now(), last + 1); // the model needs timestamps that always go up
      last = now;
      return pose.detectForVideo(video, now).landmarks[0] ?? null;
    },
    close() {
      pose.close();
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
