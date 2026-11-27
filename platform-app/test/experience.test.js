import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import test from 'node:test';
import { api, demo, login, page } from './helpers.js';

test('consent hides a student, one join code, and falling behind', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const student = await login(app.url, 'student-a', 'demo-student-a');
    const log = await page(app.url, coach, '/coach/log');
    assert.match(log.text, /Student A/);
    assert.match(log.text, /Student B/);
    assert.equal(log.text.includes('Student C'), false);
    const home = await page(app.url, coach, '/coach');
    assert.match(home.text, /hidden from logging until consent is in/);
    assert.match(home.text, /NRLC-4821/);
    const family = await page(app.url, student, '/student/family');
    assert.match(family.text, /This week/);
    assert.match(family.text, /NRLC-4821/);
    const blocked = await api(app.url, coach, 'POST', '/api/session-logs', { letters: 'C', skills: 'fair-test', id: 'slog-c' });
    assert.equal(blocked.status, 422);
    const saved = await api(app.url, coach, 'POST', '/api/session-logs', { letters: 'A', skills: 'fair-test', id: 'slog-a' });
    assert.equal(saved.status, 201);
    const needs = await page(app.url, organiser, '/organiser/needs');
    assert.match(needs.text, /What needs me/);
    assert.match(needs.text, /Consent missing for Student C/);
    assert.match(needs.text, /falling behind/);
    const tz = await page(app.url, coachB, '/coach');
    assert.match(tz.text, /falling behind/);
    assert.equal(tz.text.includes('NRLC-4821'), false);
    const lite = await page(app.url, coach, '/lite');
    const gzip = zlib.gzipSync(Buffer.from(lite.text)).length;
    assert.ok(gzip < 30 * 1024, `lite gzip ${gzip}`);
    assert.equal(lite.text.includes('<img'), false);
    assert.match(lite.text, /40 KB/);
  } finally {
    await app.stop();
  }
});
