import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widths = [320, 375, 414, 768, 1024, 1280, 1440, 1920];
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
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

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const { readdir } = await import('node:fs/promises');
const pages = (await readdir(root)).filter((name) => name.endsWith('.html')).sort();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const failures = [];
const page = await browser.newPage();
for (const file of pages) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('http://127.0.0.1:' + port + '/' + file, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) failures.push(file + ' @' + width + ' failed to load');
    const overflow = await page.evaluate((viewport) => document.documentElement.scrollWidth - viewport, width);
    if (overflow > 1) failures.push(file + ' @' + width + ' overflows by ' + overflow + 'px');
  }
}
await browser.close();
server.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('responsive ok: ' + pages.length + ' pages at ' + widths.join(', '));
