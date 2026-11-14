// Types for the parts of tasks-vision.js that camera.ts uses. Written for Bean, not part of the vendored package.
export type NormalizedLandmark = { x: number; y: number; z: number; visibility: number };
export type WasmFileset = object;

export declare class FilesetResolver {
  static forVisionTasks(basePath: string): Promise<WasmFileset>;
}

export declare class PoseLandmarker {
  static createFromOptions(
    fileset: WasmFileset,
    options: { baseOptions: { modelAssetPath: string; delegate: 'GPU' | 'CPU' }; runningMode: 'IMAGE' | 'VIDEO'; numPoses: number },
  ): Promise<PoseLandmarker>;
  detectForVideo(video: HTMLVideoElement, timestamp: number): { landmarks: NormalizedLandmark[][] };
  close(): void;
}
