import assert from 'node:assert/strict';
import test from 'node:test';
import jpegJs from 'jpeg-js';
import { logUiState } from '../src/log-status.js';
import { localDate } from '../src/time.js';
import { api, demo, login, page } from './helpers.js';

test('log status shows Sent only after the server confirms, Pending sync while offline, and Retry only after a failure', () => {
  assert.deepEqual(logUiState({}), { status: 'Not sent yet.', send: true, retry: false });
  assert.deepEqual(logUiState({ online: false }), { status: 'Pending sync', send: true, retry: false });
  assert.equal(logUiState({ failed: true }).retry, true);
  assert.equal(logUiState({ failed: true }).send, false);
  assert.deepEqual(logUiState({ confirmed: true }), { status: 'Sent', send: false, retry: false });
  assert.equal(logUiState({ confirmed: true, failed: true, online: false }).status, 'Sent');
});

test('an evening timestamp uses the preview time zone, not the next UTC day', () => {
  assert.equal(localDate('2026-11-27T03:00:00.000Z'), '2026-11-26');
  assert.equal(localDate('2026-11-27T18:00:00.000Z'), '2026-11-27');
});

test('the phone log stores a real session and blocks a photo without consent', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const screen = await page(app.url, coach, '/coach/log');
    assert.equal(screen.status, 200);
    assert.match(screen.text, /type="file"/);
    assert.match(screen.text, /No photo for this session/);
    assert.match(screen.text, />Send</);
    const logged = await api(app.url, coach, 'POST', '/api/phone-log', {
      letters: 'A,B',
      skills: 'line-following',
    });
    assert.equal(logged.status, 201, await logged.clone().text());
    const body = await logged.json();
    assert.match(body.id, /^clm-/);
    const claim = await (await api(app.url, coach, 'GET', `/api/claims/${body.id}`)).json();
    assert.equal(claim.versions[0].status, 'submitted');
    const data = Buffer.alloc(8 * 8 * 4, 255);
    const jpeg = Buffer.from(jpegJs.encode({ data, width: 8, height: 8 }, 80).data);
    const blocked = await api(app.url, coach, 'POST', '/api/phone-log', {
      letters: 'A,B',
      skills: 'testing',
      image: jpeg.toString('base64'),
      learnerIds: ['lrn-cm-a'],
      noStudents: false,
    });
    assert.equal(blocked.status, 422);
    assert.match((await blocked.json()).error, /no photo consent/);
    const capture = await page(app.url, coach, '/coach/capture');
    assert.match(capture.text, /Preview v0\.8/);
    assert.match(capture.text, /class="shell"/);
  } finally {
    await app.stop();
  }
});
