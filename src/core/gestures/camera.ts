// The webcam itself. Kept apart from the hand-tracking model so asking for the
// camera does not wait on (or download) MediaPipe.

/** Starts the webcam. Requires HTTPS or localhost (spec 2). */
export async function startCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser exposes no camera API. Camera access needs HTTPS.')
  }
  return navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  })
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
