import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraErrorMessage, imageFileError, sampleCountLabel, stopStream } from './media.js';

test('sample counts read naturally', () => {
  assert.equal(sampleCountLabel(0), '0 samples');
  assert.equal(sampleCountLabel(1), '1 sample');
  assert.equal(sampleCountLabel(4), '4 samples');
});

test('upload rejects non-images and huge files', () => {
  assert.equal(imageFileError({ name: 'notes.txt', type: 'text/plain', size: 20 }), 'notes.txt is not an image.');
  assert.equal(imageFileError({ name: 'big.png', type: 'image/png', size: 13 * 1024 * 1024 }).includes('12 MB'), true);
  assert.equal(imageFileError({ name: 'paper.png', type: 'image/png', size: 2000 }), '');
  assert.equal(imageFileError({ name: 'camera.jpg', type: '', size: 2000 }), '');
});

test('camera errors point students to upload', () => {
  assert.equal(
    cameraErrorMessage({ name: 'NotAllowedError' }),
    'Camera permission was denied. Upload images from this computer instead. Images stay on this device.',
  );
  assert.equal(cameraErrorMessage({ name: 'NotFoundError' }), 'No camera was found. Upload images instead.');
  assert.equal(cameraErrorMessage({ name: 'NotReadableError' }).includes('already in use'), true);
  assert.equal(cameraErrorMessage({ name: 'AbortError' }), 'The camera could not start. Upload images instead.');
});

test('stopStream stops every track and ignores an empty value', () => {
  const stopped = [];
  stopStream({
    getTracks() {
      return [{ stop() { stopped.push('a'); } }, { stop() { stopped.push('b'); } }];
    },
  });
  assert.deepEqual(stopped, ['a', 'b']);
  stopStream(null);
});
