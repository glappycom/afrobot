import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { chromium } from 'playwright';
import { scenePixels } from '../src/scenes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = '/opt/cursor/artifacts';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 3 + 1);
    raw[start] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, start + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function writeScenes(dir, kind, variants) {
  const files = [];
  for (const variant of variants) {
    const file = path.join(dir, `${kind}-${variant}.png`);
    await writeFile(file, encodePng(224, 224, scenePixels(kind, variant)));
    files.push(file);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function statusText(page) {
  return page.locator('#wb-train-status').innerText();
}

async function decisionText(page) {
  return page.locator('#wb-decision').innerText();
}

async function commandCount(page) {
  const text = await page.locator('#wb-commands').innerText();
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : -1;
}

const server = await serve();
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const dir = await mkdtemp(path.join(tmpdir(), 'wb-'));
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});
const pageErrors = [];
let failed = false;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(`${origin}/workbench/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'New project' }).waitFor();
  await page.screenshot({ path: path.join(shots, 'workbench-new-project.png'), fullPage: true });
  await page.getByRole('button', { name: /Image project/ }).click();
  await page.getByRole('heading', { name: 'New image project' }).waitFor();
  await page.getByRole('button', { name: /Standard image model/ }).click();
  await page.getByRole('heading', { name: 'Smart Sorter' }).waitFor();

  const uploads = {
    paper: await writeScenes(dir, 'paper', [0, 1, 2, 3]),
    plastic: await writeScenes(dir, 'plastic', [0, 1, 2, 3]),
    'no-item': await writeScenes(dir, 'no-item', [0, 1, 2, 3]),
  };
  for (const [classId, files] of Object.entries(uploads)) {
    await page.locator(`.wb-class[data-class="${classId}"] input[type="file"]`).setInputFiles(files);
    await page.locator(`.wb-class[data-class="${classId}"] [data-count]`).getByText('4 samples').waitFor();
    const thumbs = await page.locator(`.wb-class[data-class="${classId}"] img`).count();
    assert(thumbs === 4, `${classId} should show 4 thumbnails, saw ${thumbs}`);
  }
  await page.screenshot({ path: path.join(shots, 'workbench-samples.png'), fullPage: true });

  await page.getByRole('button', { name: 'Remove Paper sample 1' }).click();
  await page.locator('.wb-class[data-class="paper"] [data-count]').getByText('3 samples').waitFor();
  const paperAgain = await writeScenes(dir, 'paper', [0]);
  await page.locator('.wb-class[data-class="paper"] input[type="file"]').setInputFiles(paperAgain);
  await page.locator('.wb-class[data-class="paper"] [data-count]').getByText('4 samples').waitFor();

  await page.getByRole('button', { name: 'Train model' }).click();
  const cancel = page.getByRole('button', { name: 'Cancel training' });
  try {
    await cancel.waitFor({ state: 'visible', timeout: 1500 });
    await cancel.click();
  } catch {
    /* Training can finish before the cancel button is clicked. */
  }
  await page.waitForFunction(() => {
    const text = document.getElementById('wb-train-status').textContent || '';
    return /Model ready|Training was canceled|Training did not finish|could not be loaded/.test(text);
  }, null, { timeout: 120000 });
  if (!/Model ready/.test(await statusText(page))) {
    assert((await statusText(page)).includes('canceled') || (await statusText(page)).includes('did not finish') === false, await statusText(page));
    await page.getByRole('button', { name: 'Train model' }).click();
    await page.waitForFunction(() => (document.getElementById('wb-train-status').textContent || '').includes('Model ready'), null, { timeout: 120000 });
  }

  const savedPaper = await writeScenes(dir, 'paper', [9]);
  await page.locator('#wb-test-file').setInputFiles(savedPaper);
  await page.waitForFunction(() => /paper bin/i.test(document.getElementById('wb-decision').textContent || ''), null, { timeout: 30000 });
  await page.waitForFunction(() => /still in view/i.test(document.getElementById('wb-decision').textContent || ''), null, { timeout: 3000 });
  assert(await commandCount(page) === 1, `expected 1 command after held paper, saw ${await commandCount(page)} / ${await decisionText(page)}`);
  await page.screenshot({ path: path.join(shots, 'workbench-paper-bin.png'), fullPage: true });

  await page.getByRole('button', { name: 'Unseen plastic drawing' }).click();
  await page.waitForFunction(() => /plastic bin/i.test(document.getElementById('wb-decision').textContent || ''), null, { timeout: 30000 });
  assert(await commandCount(page) === 2, `expected 2 commands after plastic, saw ${await commandCount(page)} / ${await decisionText(page)}`);

  await page.getByRole('button', { name: 'Empty scene drawing' }).click();
  await page.waitForFunction(() => {
    const text = document.getElementById('wb-decision').textContent || '';
    return /No item/i.test(text) && /Hold/i.test(text);
  }, null, { timeout: 30000 });
  assert(await commandCount(page) === 2, `empty scene should not send a command: ${await decisionText(page)}`);

  await page.getByRole('button', { name: 'Mixed object drawing' }).click();
  await page.waitForFunction(() => /below 70%/i.test(document.getElementById('wb-decision').textContent || ''), null, { timeout: 30000 });
  assert(await commandCount(page) === 2, `low confidence should not send a command: ${await decisionText(page)} ${await page.locator('#wb-scores').innerText()}`);
  await page.screenshot({ path: path.join(shots, 'workbench-hold-low-confidence.png'), fullPage: true });

  await page.getByRole('button', { name: 'Stop this test' }).click();
  await page.waitForFunction(() => /The feed is stopped/i.test(document.getElementById('wb-decision').textContent || ''), null, { timeout: 3000 });
  assert(await commandCount(page) === 2, 'stopping the feed repeated a command');
  assert(await page.locator('#wb-machine').getAttribute('data-flap') === 'hold', 'flap should return to hold');
  await page.screenshot({ path: path.join(shots, 'workbench-hold-stopped.png'), fullPage: true });

  await page.getByRole('button', { name: 'Test with webcam' }).click();
  await page.locator('#wb-preview-video').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Stop camera' }).click();
  await page.waitForFunction(() => /The feed is stopped/i.test(document.getElementById('wb-decision').textContent || ''));
  const previewLive = await page.evaluate(() => {
    const video = document.getElementById('wb-preview-video');
    return Boolean(video.srcObject && video.srcObject.getTracks().some((track) => track.readyState === 'live'));
  });
  assert(previewLive === false, 'preview camera was still running after stop');

  const paperCount = page.locator('.wb-class[data-class="paper"] [data-count]');
  await page.locator('.wb-class[data-class="paper"] [data-webcam]').click();
  await page.locator('#wb-sample-dialog').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const video = document.getElementById('wb-sample-video');
    return video && video.videoWidth > 0;
  }, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(shots, 'workbench-webcam.png') });
  await page.getByRole('button', { name: 'Capture' }).click();
  await paperCount.getByText('5 samples').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForFunction(() => {
    const video = document.getElementById('wb-sample-video');
    return !video.srcObject;
  });

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `page overflows by ${overflow}px at ${width}`);
  }
  assert(pageErrors.length === 0, pageErrors.join('\n'));
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await denied.addInitScript(() => {
    const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    const media = navigator.mediaDevices || {};
    media.getUserMedia = deny;
    navigator.mediaDevices = media;
  });
  const deniedPage = await denied.newPage();
  await deniedPage.goto(`${origin}/workbench/`, { waitUntil: 'networkidle' });
  await deniedPage.getByRole('button', { name: /Image project/ }).click();
  await deniedPage.getByRole('button', { name: /Standard image model/ }).click();
  await deniedPage.locator('.wb-class[data-class="paper"] [data-webcam]').click();
  await deniedPage.locator('#wb-sample-error').getByText(/Camera permission was denied/).waitFor();
  const one = await writeScenes(dir, 'paper', [5]);
  await deniedPage.locator('.wb-class[data-class="paper"] input[type="file"]').setInputFiles(one);
  await deniedPage.locator('.wb-class[data-class="paper"] [data-count]').getByText('1 sample').waitFor();
  await deniedPage.screenshot({ path: path.join(shots, 'workbench-camera-denied.png'), fullPage: true });
  await denied.close();

  const home = await (await fetch(`${origin}/`)).text();
  assert(!/workbench/i.test(home), 'homepage links to the workbench');
  console.log('e2e ok');
} catch (error) {
  failed = true;
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
  await rm(dir, { recursive: true, force: true });
  if (failed) process.exitCode = 1;
}
