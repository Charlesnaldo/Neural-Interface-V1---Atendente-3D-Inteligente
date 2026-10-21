/* global Vision */
let detector = null
self.onmessage = async event => {
  const message = event.data
  try {
    if (message.type === 'init') {
      importScripts('/mediapipe/vision_bundle.js')
      const files = await Vision.FilesetResolver.forVisionTasks('/mediapipe/wasm')
      detector = await Vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 2, minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6, minTrackingConfidence: 0.6 })
      self.postMessage({ type: 'ready' })
    } else if (message.type === 'frame') {
      try {
        const faces = detector?.detectForVideo(message.bitmap, message.timestamp)?.faceLandmarks
        self.postMessage({ type: 'gaze', landmarks: faces?.length === 1 ? faces[0] : null })
      } finally { message.bitmap.close() }
    }
  } catch { self.postMessage({ type: 'error' }) }
}
