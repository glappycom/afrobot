import { CLASS_IDS, CLASS_LABELS, MAX_EXAMPLES_PER_CLASS, MIN_EXAMPLES_PER_CLASS } from './classes.js';
import { createClassifier, runtimeBackend } from './classifier.js';
import { cameraErrorMessage, imageFileError, sampleCountLabel, stopStream } from './media.js';
import { scenePixels } from './scenes.js';
import { createSorterState, stepSorter } from './sorter.js';

const MODEL_URL = '/workbench/models/mobilenet-v1-0.25-224/model.json';
const IMAGE_EDGE = 224;

const classes = {
  paper: [],
  plastic: [],
  'no-item': [],
};
let nextId = 1;
let version = 0;
let trainedVersion = -1;
let classifier = null;
let busy = false;
let abortTraining = null;
let sorterState = createSorterState();
let commandCount = 0;
let cachedScores = null;
let feed = 'stopped';
let tested = false;
let cameraMode = null;
let cameraToken = 0;
let stream = null;
let holdTimer = 0;
let feedTimer = 0;
let testToken = 0;
let announced = '';
let sampleClass = 'paper';
let lastVideoTime = -1;
let lastAdvance = 0;
let predicting = false;

const $ = (id) => document.getElementById(id);

function paint(canvas, pixels) {
  canvas.width = IMAGE_EDGE;
  canvas.height = IMAGE_EDGE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.createImageData(IMAGE_EDGE, IMAGE_EDGE);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    image.data[j] = pixels[i];
    image.data[j + 1] = pixels[i + 1];
    image.data[j + 2] = pixels[i + 2];
    image.data[j + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function thumbURL(pixels) {
  const full = document.createElement('canvas');
  paint(full, pixels);
  const thumb = document.createElement('canvas');
  thumb.width = 72;
  thumb.height = 72;
  thumb.getContext('2d').drawImage(full, 0, 0, 72, 72);
  return thumb.toDataURL('image/jpeg', 0.82);
}

function pixelsFromCanvas(canvas) {
  const image = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, IMAGE_EDGE, IMAGE_EDGE);
  const pixels = new Uint8Array(IMAGE_EDGE * IMAGE_EDGE * 3);
  for (let i = 0, j = 0; i < image.data.length; i += 4, j += 3) {
    pixels[j] = image.data[i];
    pixels[j + 1] = image.data[i + 1];
    pixels[j + 2] = image.data[i + 2];
  }
  return pixels;
}

function cropSource(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_EDGE;
  canvas.height = IMAGE_EDGE;
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, sx, sy, side, side, 0, 0, IMAGE_EDGE, IMAGE_EDGE);
  return pixelsFromCanvas(canvas);
}

async function fileToPixels(file) {
  const bitmap = await createImageBitmap(file);
  try {
    return cropSource(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function showView(name) {
  $('wb-start').hidden = name !== 'start';
  $('wb-model').hidden = name !== 'model';
  $('wb-editor').hidden = name !== 'editor';
  const titles = {
    start: 'New project · AfroBot Workbench',
    model: 'New image project · AfroBot Workbench',
    editor: 'Smart Sorter · AfroBot Workbench',
  };
  document.title = titles[name];
  const heading = document.querySelector(`#wb-${name} h1`);
  if (heading) heading.focus();
}

function canPredict() {
  return Boolean(classifier && classifier.ready && trainedVersion === version && trainedVersion >= 0);
}

function readyToTrain() {
  return CLASS_IDS.every((id) => classes[id].length >= MIN_EXAMPLES_PER_CLASS);
}

function stopTimers() {
  if (holdTimer) clearInterval(holdTimer);
  if (feedTimer) clearInterval(feedTimer);
  holdTimer = 0;
  feedTimer = 0;
}

function releaseCamera() {
  cameraToken += 1;
  stopStream(stream);
  stream = null;
  const sampleVideo = $('wb-sample-video');
  const previewVideo = $('wb-preview-video');
  if (sampleVideo) sampleVideo.srcObject = null;
  if (previewVideo) previewVideo.srcObject = null;
}

async function attachCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const error = new Error('This browser does not offer a camera here.');
    error.name = 'NotFoundError';
    throw error;
  }
  const token = cameraToken;
  const next = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  if (token !== cameraToken) {
    stopStream(next);
    const error = new Error('The camera was closed.');
    error.name = 'AbortError';
    throw error;
  }
  stream = next;
  video.srcObject = next;
  await video.play();
  return next;
}

function renderSamples() {
  for (const id of CLASS_IDS) {
    const section = document.querySelector(`.wb-class[data-class="${id}"]`);
    const samples = classes[id];
    section.querySelector('[data-count]').textContent = sampleCountLabel(samples.length);
    const missing = MIN_EXAMPLES_PER_CLASS - samples.length;
    section.querySelector('[data-need]').textContent = missing > 0
      ? `Add at least ${missing} more to train.`
      : 'Enough examples to train.';
    const list = section.querySelector('[data-thumbs]');
    list.replaceChildren();
    samples.forEach((sample, index) => {
      const item = document.createElement('li');
      const image = document.createElement('img');
      const number = index + 1;
      image.src = sample.url;
      image.alt = `${CLASS_LABELS[id]} sample ${number}`;
      image.width = 72;
      image.height = 72;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.remove = 'true';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${CLASS_LABELS[id]} sample ${number}`);
      remove.addEventListener('click', () => removeSample(id, sample.id));
      item.append(image, remove);
      list.append(item);
    });
  }
}

function renderTrain() {
  const train = $('wb-train');
  train.disabled = busy || !readyToTrain();
  $('wb-cancel').hidden = !busy;
  $('wb-practice').disabled = busy;
  $('wb-reset').disabled = busy;
  for (const section of document.querySelectorAll('.wb-class')) {
    section.querySelector('[data-webcam]').disabled = busy;
    section.querySelector('[data-files]').disabled = busy;
    for (const button of section.querySelectorAll('[data-remove]')) button.disabled = busy;
  }
  const predictable = canPredict() && !busy;
  for (const button of document.querySelectorAll('[data-scene], #wb-preview-camera')) button.disabled = !predictable;
  $('wb-test-file').disabled = !predictable;
  const hint = $('wb-train-hint');
  if (busy) hint.textContent = 'Training is running. You can cancel and try again.';
  else if (!readyToTrain()) hint.textContent = 'Add at least 4 examples of Paper, Plastic, and No item.';
  else if (canPredict()) hint.textContent = 'The model matches the examples on screen.';
  else if (trainedVersion >= 0) hint.textContent = 'Examples changed. Train again before testing.';
  else hint.textContent = 'Ready to train on this computer.';
}

function renderScores(scores) {
  const list = $('wb-scores');
  list.hidden = false;
  list.replaceChildren();
  let best = CLASS_IDS[0];
  for (const id of CLASS_IDS) {
    if ((scores[id] || 0) > (scores[best] || 0)) best = id;
  }
  for (const id of CLASS_IDS) {
    const item = document.createElement('li');
    if (id === best) item.classList.add('is-top');
    const name = document.createElement('span');
    name.textContent = CLASS_LABELS[id];
    const track = document.createElement('span');
    track.className = 'wb-track';
    const fill = document.createElement('span');
    const shown = Math.max(0, Math.min(100, Math.floor((scores[id] || 0) * 100 + 1e-9)));
    fill.style.width = `${shown}%`;
    track.append(fill);
    const value = document.createElement('span');
    value.textContent = `${shown}%`;
    item.append(name, track, value);
    list.append(item);
  }
}

function renderDecision(step) {
  const machine = $('wb-machine');
  machine.dataset.flap = step.decision;
  const key = `${step.decision}|${step.reason}`;
  const decision = $('wb-decision');
  if (key !== announced) {
    decision.textContent = step.message;
    announced = key;
  } else if (!decision.textContent) {
    decision.textContent = step.message;
  }
  for (const bin of machine.querySelectorAll('.wb-bin')) {
    const on = (step.decision === 'paper-bin' && bin.dataset.bin === 'paper')
      || (step.decision === 'plastic-bin' && bin.dataset.bin === 'plastic')
      || (step.decision === 'hold' && bin.dataset.bin === 'hold');
    bin.classList.toggle('is-on', on);
    if (on) bin.setAttribute('aria-current', 'true');
    else bin.removeAttribute('aria-current');
  }
  $('wb-commands').textContent = `Sorter commands sent: ${commandCount}`;
}

function applyFeed() {
  const step = stepSorter({ scores: cachedScores, feed, state: sorterState });
  sorterState = step.state;
  if (step.command) {
    commandCount += 1;
    const item = document.createElement('li');
    item.textContent = step.command === 'paper-bin' ? 'Move to the paper bin' : 'Move to the plastic bin';
    const log = $('wb-command-log');
    log.append(item);
    while (log.children.length > 6) log.firstElementChild.remove();
  }
  renderDecision(step);
}

function touchSamples() {
  version += 1;
  if (trainedVersion >= 0 && trainedVersion !== version) {
    stopActiveFeed();
    $('wb-train-status').textContent = 'Examples changed. Train again before testing.';
  }
  renderSamples();
  renderTrain();
}

function addPixels(classId, pixels) {
  if (classes[classId].length >= MAX_EXAMPLES_PER_CLASS) {
    throw new Error('This class already has 40 samples. Remove one to add another.');
  }
  classes[classId].push({ id: nextId, url: thumbURL(pixels), pixels });
  nextId += 1;
  touchSamples();
}

function removeSample(classId, sampleId) {
  classes[classId] = classes[classId].filter((sample) => sample.id !== sampleId);
  touchSamples();
  const upload = document.querySelector(`.wb-class[data-class="${classId}"] [data-files]`);
  if (upload) upload.focus();
}

async function addFiles(classId, fileList) {
  const notes = [];
  let added = 0;
  for (const file of fileList) {
    const problem = imageFileError(file);
    if (problem) {
      notes.push(problem);
      continue;
    }
    if (classes[classId].length >= MAX_EXAMPLES_PER_CLASS) {
      notes.push('This class already has 40 samples.');
      break;
    }
    try {
      addPixels(classId, await fileToPixels(file));
      added += 1;
    } catch {
      notes.push(`${file.name || 'One file'} could not be read. Try a JPG or PNG.`);
    }
  }
  const status = document.querySelector(`.wb-class[data-class="${classId}"] [data-status]`);
  const lead = added === 1 ? 'Added 1 image.' : `Added ${added} images.`;
  status.textContent = [added ? lead : '', ...notes].filter(Boolean).join(' ');
}

function stopActiveFeed() {
  const wasRunning = cameraMode === 'preview' || holdTimer || feedTimer;
  stopTimers();
  releaseCamera();
  cameraMode = null;
  $('wb-preview-video').hidden = true;
  $('wb-preview-stop').hidden = true;
  if (wasRunning || tested) {
    feed = 'stopped';
    tested = true;
    applyFeed();
  }
}

function setProgress(percent) {
  const bar = $('wb-progress');
  const value = Math.max(0, Math.min(100, percent));
  bar.setAttribute('aria-valuenow', String(value));
  bar.style.setProperty('--wb-pct', `${value}%`);
}

function showProgress(update) {
  if (update.phase === 'features') {
    setProgress(Math.round((update.index / update.total) * 40));
    $('wb-train-status').textContent = `Reading example ${update.index} of ${update.total}.`;
    return;
  }
  setProgress(40 + Math.round((update.epoch / update.epochs) * 60));
  $('wb-train-status').textContent = `Training epoch ${update.epoch} of ${update.epochs}. Loss ${update.loss.toFixed(3)}.`;
}

async function onTrain() {
  if (busy || !readyToTrain()) return;
  busy = true;
  $('wb-train-error').textContent = '';
  setProgress(0);
  renderTrain();
  const versionAtStart = version;
  const examples = [];
  for (const id of CLASS_IDS) {
    for (const sample of classes[id]) examples.push({ label: id, pixels: sample.pixels });
  }
  abortTraining = new AbortController();
  try {
    if (!classifier) {
      $('wb-train-status').textContent = 'Downloading the image model for the first time. It comes from this website, about 1.9 MB.';
      classifier = await createClassifier(MODEL_URL);
    }
    if (abortTraining.signal.aborted) {
      const error = new Error('Training was canceled.');
      error.name = 'AbortError';
      throw error;
    }
    await classifier.train(examples, {
      signal: abortTraining.signal,
      onProgress: showProgress,
    });
    if (version !== versionAtStart) {
      trainedVersion = -1;
      $('wb-train-status').textContent = 'Examples changed during training. Train again before testing.';
    } else {
      trainedVersion = versionAtStart;
      setProgress(100);
      $('wb-train-status').textContent = `Model ready. It is running on ${runtimeBackend()}. Test an object you did not train on, and try an empty frame.`;
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      $('wb-train-status').textContent = 'Training was canceled. You can train again.';
    } else {
      $('wb-train-error').textContent = error && error.message ? error.message : 'Training did not finish. You can try again.';
      $('wb-train-status').textContent = 'Training did not finish.';
    }
  } finally {
    abortTraining = null;
    busy = false;
    renderTrain();
  }
}

async function openSampleCamera(classId) {
  if (busy) return;
  stopActiveFeed();
  sampleClass = classId;
  $('wb-sample-title').textContent = `Add a ${CLASS_LABELS[classId]} sample`;
  $('wb-sample-status').textContent = '';
  $('wb-sample-error').textContent = '';
  $('wb-sample-capture').disabled = true;
  cameraMode = 'sample';
  $('wb-sample-dialog').showModal();
  try {
    await attachCamera($('wb-sample-video'));
    if (cameraMode !== 'sample') return;
    $('wb-sample-capture').disabled = false;
    $('wb-sample-capture').focus();
  } catch (error) {
    if (cameraMode !== 'sample') return;
    $('wb-sample-status').textContent = '';
    $('wb-sample-error').textContent = cameraErrorMessage(error);
  }
}

async function startPreviewCamera() {
  if (!canPredict() || busy) return;
  testToken += 1;
  stopTimers();
  releaseCamera();
  tested = true;
  feed = 'stopped';
  applyFeed();
  cameraMode = 'preview';
  $('wb-preview-error').textContent = '';
  $('wb-still').hidden = true;
  try {
    await attachCamera($('wb-preview-video'));
  } catch (error) {
    cameraMode = null;
    $('wb-preview-error').textContent = cameraErrorMessage(error);
    return;
  }
  if (cameraMode !== 'preview') return;
  $('wb-preview-video').hidden = false;
  $('wb-preview-stop').hidden = false;
  $('wb-clear-test').hidden = true;
  lastAdvance = performance.now();
  lastVideoTime = -1;
  feedTimer = setInterval(previewTick, 250);
}

async function previewTick() {
  const video = $('wb-preview-video');
  if (cameraMode !== 'preview' || !stream || video.srcObject !== stream) return;
  const now = performance.now();
  if (video.readyState < 2 || !video.videoWidth || video.currentTime === lastVideoTime) {
    if (now - lastAdvance > 1200) {
      feed = 'stale';
      applyFeed();
    }
    return;
  }
  lastVideoTime = video.currentTime;
  lastAdvance = now;
  if (predicting || !canPredict()) return;
  predicting = true;
  try {
    const pixels = cropSource(video, video.videoWidth, video.videoHeight);
    const { scores } = await classifier.predict(pixels);
    if (cameraMode !== 'preview') return;
    cachedScores = scores;
    feed = 'live';
    renderScores(scores);
    applyFeed();
  } catch (error) {
    $('wb-preview-error').textContent = error.message || 'The camera frame could not be read.';
  } finally {
    predicting = false;
  }
}

async function testPixels(pixels, alt) {
  if (!canPredict() || busy) return;
  const token = ++testToken;
  stopTimers();
  releaseCamera();
  cameraMode = null;
  $('wb-preview-video').hidden = true;
  $('wb-preview-stop').hidden = true;
  $('wb-preview-error').textContent = '';
  const still = $('wb-still');
  paint(still, pixels);
  still.hidden = false;
  still.setAttribute('aria-label', alt);
  $('wb-clear-test').hidden = false;
  let scores;
  try {
    scores = (await classifier.predict(pixels)).scores;
  } catch (error) {
    $('wb-preview-error').textContent = error.message || 'The picture could not be tested.';
    return;
  }
  if (token !== testToken) return;
  cachedScores = scores;
  sorterState = createSorterState();
  tested = true;
  feed = 'live';
  renderScores(scores);
  applyFeed();
  holdTimer = setInterval(() => {
    if (token !== testToken) return;
    feed = 'live';
    applyFeed();
  }, 400);
}

function addPracticeDrawings() {
  if (busy) return;
  let added = 0;
  for (const id of CLASS_IDS) {
    for (let variant = 0; variant < 4; variant += 1) {
      if (classes[id].length >= MAX_EXAMPLES_PER_CLASS) break;
      addPixels(id, scenePixels(id, variant));
      added += 1;
    }
  }
  $('wb-train-status').textContent = added
    ? 'Illustrated practice drawings added. They are drawings, not photos.'
    : 'The classes are full, so no more drawings were added.';
}

function resetLesson() {
  if (busy) return;
  const sure = window.confirm('Clear every example and the trained model in this tab?');
  if (!sure) return;
  stopTimers();
  releaseCamera();
  cameraMode = null;
  if (classifier) classifier.dispose();
  classifier = null;
  for (const id of CLASS_IDS) classes[id] = [];
  version += 1;
  trainedVersion = -1;
  sorterState = createSorterState();
  commandCount = 0;
  cachedScores = null;
  feed = 'stopped';
  tested = false;
  announced = '';
  $('wb-command-log').replaceChildren();
  $('wb-scores').hidden = true;
  $('wb-scores').replaceChildren();
  $('wb-still').hidden = true;
  $('wb-preview-video').hidden = true;
  $('wb-preview-stop').hidden = true;
  $('wb-clear-test').hidden = true;
  $('wb-decision').textContent = 'Train a model to see a decision.';
  $('wb-commands').textContent = 'Sorter commands sent: 0';
  $('wb-machine').dataset.flap = 'hold';
  $('wb-train-status').textContent = 'Add examples, then train on this computer.';
  $('wb-train-error').textContent = '';
  setProgress(0);
  for (const section of document.querySelectorAll('.wb-class [data-status]')) section.textContent = '';
  renderSamples();
  renderTrain();
}

function bind() {
  $('wb-open-image').addEventListener('click', () => showView('model'));
  $('wb-model-back').addEventListener('click', () => showView('start'));
  $('wb-start-sorter').addEventListener('click', () => showView('editor'));
  $('wb-back').addEventListener('click', () => {
    stopActiveFeed();
    if ($('wb-sample-dialog').open) $('wb-sample-dialog').close();
    showView('start');
  });
  $('wb-train').addEventListener('click', onTrain);
  $('wb-cancel').addEventListener('click', () => {
    if (abortTraining) abortTraining.abort();
  });
  $('wb-practice').addEventListener('click', addPracticeDrawings);
  $('wb-reset').addEventListener('click', resetLesson);
  $('wb-preview-camera').addEventListener('click', startPreviewCamera);
  $('wb-preview-stop').addEventListener('click', stopActiveFeed);
  $('wb-clear-test').addEventListener('click', () => {
    testToken += 1;
    stopActiveFeed();
  });
  $('wb-test-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const problem = imageFileError(file);
    if (problem) {
      $('wb-preview-error').textContent = problem;
      return;
    }
    try {
      await testPixels(await fileToPixels(file), `Saved test image ${file.name}`);
    } catch {
      $('wb-preview-error').textContent = `${file.name} could not be read. Try a JPG or PNG.`;
    }
  });
  for (const button of document.querySelectorAll('[data-scene]')) {
    button.addEventListener('click', () => {
      const pixels = scenePixels(button.dataset.scene, Number(button.dataset.variant || 0));
      testPixels(pixels, button.textContent.trim());
    });
  }
  for (const section of document.querySelectorAll('.wb-class')) {
    const classId = section.dataset.class;
    section.querySelector('[data-webcam]').addEventListener('click', () => openSampleCamera(classId));
    const input = section.querySelector('[data-files]');
    input.addEventListener('change', async () => {
      await addFiles(classId, input.files);
      input.value = '';
    });
    section.addEventListener('dragover', (event) => {
      event.preventDefault();
      section.classList.add('is-drop');
    });
    section.addEventListener('dragleave', () => section.classList.remove('is-drop'));
    section.addEventListener('drop', (event) => {
      event.preventDefault();
      section.classList.remove('is-drop');
      addFiles(classId, event.dataTransfer.files);
    });
  }
  $('wb-sample-capture').addEventListener('click', () => {
    const video = $('wb-sample-video');
    if (!video.videoWidth) {
      $('wb-sample-status').textContent = '';
      $('wb-sample-error').textContent = 'The camera has no picture yet. Wait a moment, or upload an image instead.';
      return;
    }
    try {
      addPixels(sampleClass, cropSource(video, video.videoWidth, video.videoHeight));
      $('wb-sample-error').textContent = '';
      $('wb-sample-status').textContent = `${CLASS_LABELS[sampleClass]} sample added. You can capture another, or close the camera.`;
    } catch (error) {
      $('wb-sample-error').textContent = error.message;
    }
  });
  $('wb-sample-close').addEventListener('click', () => $('wb-sample-dialog').close());
  $('wb-sample-dialog').addEventListener('close', () => {
    if (cameraMode === 'sample') {
      releaseCamera();
      cameraMode = null;
    }
  });
  const tutorial = $('wb-tutorial');
  const frame = $('wb-tutorial-frame');
  $('wb-tutorial-play').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/DFBbSTvtpy4?rel=0';
    iframe.title = 'Gather samples tutorial';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.replaceChildren(iframe);
    frame.hidden = false;
  });
  tutorial.addEventListener('toggle', () => {
    if (!tutorial.open) {
      frame.replaceChildren();
      frame.hidden = true;
    }
  });
  window.addEventListener('pagehide', () => {
    stopTimers();
    releaseCamera();
  });
}

const boot = $('wb-boot-error');
try {
  bind();
  renderSamples();
  renderTrain();
} catch (error) {
  boot.hidden = false;
  boot.textContent = `The lesson could not start. Refresh the page. ${error.message || ''}`.trim();
}
