import assert from 'node:assert/strict';
import test from 'node:test';
import { start } from '../src/server.js';
import { hashPassword, passwordIsHashed, verifyPassword } from '../src/passwords.js';
import { api, demo, login, page } from './helpers.js';

test('demo seed stays off unless AFROBOT_DEMO_SEED is set, and passwords are hashed', async () => {
  const quiet = await start({ port: 0, dbPath: ':memory:', demoSeed: false, story: false });
  try {
    const count = quiet.app.db.prepare('SELECT COUNT(*) AS n FROM users').get();
    assert.equal(Number(count.n), 0);
    const signIn = await fetch(`${quiet.url}/login`);
    const html = await signIn.text();
    assert.equal(html.includes('demo-coach-a'), false);
    assert.equal(html.includes('Demo sign-ins are in the PR description'), false);
  } finally {
    quiet.close();
  }

  const app = await demo();
  try {
    const stored = app.app.db.prepare('SELECT password FROM users WHERE username = ?').get('coach-a');
    assert.equal(passwordIsHashed(stored.password), true);
    assert.equal(verifyPassword('demo-coach-a', stored.password), true);
    assert.equal(verifyPassword('wrong-password', stored.password), false);
    const signIn = await page(app.url, { cookie: '' }, '/login');
    assert.equal(signIn.text.includes('demo-coach-a'), false);
    assert.match(signIn.text, /Demo sign-ins are in the PR description/);
    assert.match(signIn.text, /Preview v0\.4/);
  } finally {
    await app.stop();
  }
});

test('repeated sign-in failures lock the account', async () => {
  const app = await demo();
  try {
    for (let i = 0; i < 5; i += 1) {
      const failed = await login(app.url, 'coach-a', 'wrong-password');
      assert.equal(failed.status, 401);
    }
    const locked = await login(app.url, 'coach-a', 'demo-coach-a');
    assert.equal(locked.status, 429);
  } finally {
    await app.stop();
  }
});

test('role matrix denies the wrong role and keeps auditors from writing', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const student = await login(app.url, 'student-a', 'demo-student-a');
    const pages = [
      ['/coach', { coach: 200, organiser: 403, auditor: 403, student: 403 }],
      ['/organiser', { coach: 403, organiser: 200, auditor: 403, student: 403 }],
      ['/auditor', { coach: 403, organiser: 403, auditor: 200, student: 403 }],
      ['/student', { coach: 403, organiser: 403, auditor: 403, student: 200 }],
      ['/records', { coach: 200, organiser: 200, auditor: 200, student: 403 }],
      ['/audit', { coach: 403, organiser: 200, auditor: 200, student: 403 }],
      ['/audit.csv', { coach: 403, organiser: 200, auditor: 200, student: 403 }],
      ['/access', { coach: 403, organiser: 200, auditor: 200, student: 403 }],
    ];
    const sessions = { coach, organiser, auditor, student };
    for (const [path, expect] of pages) {
      for (const [role, status] of Object.entries(expect)) {
        const response = await page(app.url, sessions[role], path);
        assert.equal(response.status, status, `${role} GET ${path}`);
      }
    }
    const studentWrite = await api(app.url, student, 'POST', '/organiser/needs/act', { id: 'need-lrn-cm-c' });
    assert.equal(studentWrite.status, 403);
    const coachWrite = await api(app.url, coach, 'POST', '/organiser/needs/act', { id: 'need-lrn-cm-c' });
    assert.equal(coachWrite.status, 403);
    const auditorWrite = await api(app.url, auditor, 'POST', '/api/claims', { numerator: 1, denominator: 2, activityDate: '2026-11-26' });
    assert.equal(auditorWrite.status, 403);
    const hashed = hashPassword('x');
    assert.equal(hashed.startsWith('scrypt:'), true);
  } finally {
    await app.stop();
  }
});

test('one idempotency key creates one attendance record', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const body = { idempotencyKey: 'accept-6of8-0001', numerator: 6, denominator: 8, activityDate: '2026-11-26' };
    const first = await api(app.url, coach, 'POST', '/api/results', body);
    const created = await first.json();
    assert.equal(first.status, 201);
    assert.equal(created.already, false);
    const second = await api(app.url, coach, 'POST', '/api/results', body);
    const again = await second.json();
    assert.equal(second.status, 200);
    assert.equal(again.already, true);
    assert.equal(again.id, created.id);
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const list = await (await api(app.url, organiser, 'GET', '/api/claims')).json();
    const matches = list.filter((row) => row.numerator === 6 && row.denominator === 8 && row.id === created.id);
    assert.equal(matches.length, 1);
    const approved = await api(app.url, organiser, 'POST', `/api/claims/${created.id}/approve`, {});
    assert.equal(approved.status, 200);
    const trace = await page(app.url, await login(app.url, 'auditor', 'demo-auditor'), `/auditor/trace/${created.id}`);
    assert.equal(trace.status, 200);
    assert.match(trace.text, /6\/8 = 75%/);
    assert.match(trace.text, /File integrity checks/);
    assert.match(trace.text, /Evidence supporting the claim/);
    assert.match(trace.text, /No photo/);
  } finally {
    await app.stop();
  }
});
