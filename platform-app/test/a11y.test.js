import assert from 'node:assert/strict';
import test from 'node:test';
import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { demo, login, page } from './helpers.js';

async function violations(html) {
  const dom = new JSDOM(`<!doctype html>${html.replace(/^<!doctype html>/i, '')}`, {
    pretendToBeVisual: true,
    url: 'http://127.0.0.1/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.DocumentFragment = dom.window.DocumentFragment;
  globalThis.NodeFilter = dom.window.NodeFilter;
  const result = await axe.run(dom.window.document.documentElement, {
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
}

test('main screens have no serious or critical accessibility violations', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const guardian = await login(app.url, 'student-a', 'demo-student-a');
    const screens = [
      ['sign-in', await page(app.url, { cookie: '' }, '/login')],
      ['coach home', await page(app.url, coach, '/coach')],
      ['phone log', await page(app.url, coach, '/coach/log')],
      ['capture', await page(app.url, coach, '/coach/capture')],
      ['tracking', await page(app.url, organiser, '/organiser/tracking')],
      ['admin', await page(app.url, organiser, '/organiser/admin')],
      ['auditor', await page(app.url, auditor, '/auditor')],
      ['guardian', await page(app.url, guardian, '/student/family')],
      ['help', await page(app.url, coach, '/help')],
      ['audit', await page(app.url, organiser, '/audit')],
    ];
    const problems = [];
    for (const [name, response] of screens) {
      assert.equal(response.status, 200, name);
      const found = await violations(response.text);
      for (const item of found) problems.push(`${name}: ${item.id} (${item.impact})`);
    }
    assert.deepEqual(problems, []);
  } finally {
    await app.stop();
  }
});
