/** Small helpers for uploads and the camera. No network and no model. */

export function sampleCountLabel(count) {
  return count === 1 ? '1 sample' : `${count} samples`;
}

export function imageFileError(file) {
  if (!file) return 'Choose an image file.';
  const type = typeof file.type === 'string' ? file.type : '';
  if (type && !type.startsWith('image/')) return `${file.name || 'That file'} is not an image.`;
  if (file.size > 12 * 1024 * 1024) return `${file.name || 'That image'} is larger than 12 MB. Choose a smaller one.`;
  return '';
}

export function cameraErrorMessage(error) {
  const name = error && error.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Upload images from this computer instead. Images stay on this device.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found. Upload images instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use. Upload images instead, or close the other app using the camera.';
  }
  return 'The camera could not start. Upload images instead.';
}

export function stopStream(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return;
  for (const track of stream.getTracks()) {
    if (typeof track.stop === 'function') track.stop();
  }
}
