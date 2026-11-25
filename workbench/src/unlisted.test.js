import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('the site nav and sitemap do not link to the workbench', () => {
  const files = [
    'src/partials/header.html',
    'src/partials/footer.html',
    'src/layout.html',
    'src/home-standalone.html',
    'sitemap.xml',
    'index.html',
  ];
  const pages = fs.readdirSync(path.join(root, 'src/pages')).filter((name) => name.endsWith('.html'));
  for (const name of pages) files.push(path.join('src/pages', name));
  for (const rel of files) {
    const html = read(rel);
    assert.equal(/workbench/i.test(html), false, rel);
  }
});
