import assert from 'node:assert/strict';
import test from 'node:test';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { hashPassword } from '../src/passwords.js';
import { api, demo, login, page } from './helpers.js';

test('the old demo cookie is ignored, invites and resets are single use, and MFA is required outside demo mode', async () => {
  const app = await demo();
  try {
    const bare = await fetch(`${app.url}/coach`, { headers: { cookie: 'afrobot_demo=not-a-session' } });
    assert.equal(bare.status, 401);
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    assert.equal(organiser.status, 200);
    assert.equal(organiser.cookie.includes('afrobot_session='), true);
    const invite = await api(app.url, organiser, 'POST', '/api/invites', {
      username: 'coach-new',
      displayName: 'Coach New',
      role: 'coach',
      schoolId: 'sch-cm-north',
    });
    assert.equal(invite.status, 201, await invite.clone().text());
    const inviteBody = await invite.json();
    const token = inviteBody.path.split('/').pop();
    const accepted = await fetch(`${app.url}/api/invites/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token, password: 'coach-new-pass' }),
    });
    assert.equal(accepted.status, 201);
    const acceptedBody = await accepted.json();
    const again = await fetch(`${app.url}/api/invites/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token, password: 'coach-new-pass' }),
    });
    assert.equal(again.status, 422);
    const expired = await api(app.url, organiser, 'POST', '/api/invites', {
      username: 'coach-late',
      displayName: 'Coach Late',
      role: 'coach',
      schoolId: 'sch-cm-north',
    });
    const expiredBody = await expired.json();
    const lateToken = expiredBody.path.split('/').pop();
    app.app.db.prepare(`UPDATE invites SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`).run(expiredBody.id);
    const late = await fetch(`${app.url}/api/invites/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token: lateToken, password: 'coach-late-pass' }),
    });
    assert.equal(late.status, 422);

    const coach = await login(app.url, 'coach-new', 'coach-new-pass');
    assert.equal(coach.status, 200);
    const reset = await api(app.url, organiser, 'POST', '/api/resets', { userId: acceptedBody.id });
    assert.equal(reset.status, 201);
    const resetBody = await reset.json();
    const resetToken = resetBody.path.split('/').pop();
    const changed = await fetch(`${app.url}/api/resets/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token: resetToken, password: 'coach-reset-pass' }),
    });
    assert.equal(changed.status, 200);
    assert.equal((await login(app.url, 'coach-new', 'coach-new-pass')).status, 401);
    const fresh = await login(app.url, 'coach-new', 'coach-reset-pass');
    assert.equal(fresh.status, 200);
    const reused = await fetch(`${app.url}/api/resets/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token: resetToken, password: 'coach-reset-pass-2' }),
    });
    assert.equal(reused.status, 422);

    const events = await (await api(app.url, organiser, 'GET', '/api/events')).json();
    assert.ok(events.some((row) => row.action === 'signed-in'));
    assert.ok(events.some((row) => row.action === 'invite-created'));
    assert.ok(events.some((row) => row.action === 'invite-used'));
    assert.ok(events.some((row) => row.action === 'reset-issued'));
    assert.ok(events.some((row) => row.action === 'reset-used'));
    const ended = await api(app.url, fresh, 'POST', '/api/sessions/end-all', {});
    assert.equal(ended.status, 200);
    const gone = await fetch(`${app.url}/coach`, { headers: { cookie: fresh.cookie } });
    assert.equal(gone.status, 401);
  } finally {
    await app.stop();
  }
});

test('a non-demo organiser must use an authenticator, and a guardian sees only their child', async () => {
  const closed = await demo({ demoSeed: false });
  try {
    closed.app.db.prepare(`INSERT INTO users (id, username, display_name, role, password, mocked, active, mfa_enabled, mfa_exempt)
      VALUES (?, ?, ?, ?, ?, 0, 1, 0, 0)`).run('user-real-org', 'real-organiser', 'Real Organiser', 'organiser', hashPassword('real-pass-1'));
    const first = await login(closed.url, 'real-organiser', 'real-pass-1');
    assert.equal(first.body.mfaSetup, true);
    assert.equal(first.cookie.includes('afrobot_session='), false);
    const setup = await fetch(`${closed.url}/api/mfa/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ challenge: first.body.challenge }),
    });
    const secret = await setup.json();
    assert.equal(setup.status, 200);
    assert.equal(secret.recoveryCodes.length, 8);
    const code = await createOTP(base32.decode(secret.secret)).totp();
    const confirmed = await fetch(`${closed.url}/api/mfa/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ challenge: first.body.challenge, code }),
    });
    assert.equal(confirmed.status, 200);
    const noCode = await login(closed.url, 'real-organiser', 'real-pass-1');
    assert.equal(noCode.status, 401);
    assert.equal(noCode.body.mfa, true);
    const next = await createOTP(base32.decode(secret.secret)).totp();
    const authed = await fetch(`${closed.url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ username: 'real-organiser', password: 'real-pass-1', code: next }),
    });
    assert.equal(authed.status, 200);
  } finally {
    await closed.stop();
  }

  const app = await demo();
  try {
    const joined = await fetch(`${app.url}/api/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        code: 'NRLC-4821',
        username: 'guardian-c',
        displayName: 'Guardian C',
        password: 'guardian-c-pass',
        letter: 'A',
      }),
    });
    assert.equal(joined.status, 201, await joined.clone().text());
    const waiting = await login(app.url, 'guardian-c', 'guardian-c-pass');
    const before = await page(app.url, waiting, '/student/family');
    assert.equal(before.text.includes('Student A'), false);
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const link = app.app.db.prepare(`SELECT id FROM guardian_links WHERE status = 'pending'`).get();
    const confirmed = await api(app.url, organiser, 'POST', `/organiser/guardians/${link.id}/confirm`, {});
    assert.equal(confirmed.status, 200);
    const after = await page(app.url, waiting, '/student/family');
    assert.match(after.text, /Student A/);
    assert.equal(after.text.includes('Student B'), false);
    const other = await page(app.url, await login(app.url, 'student-b', 'demo-student-b'), '/student/family');
    assert.match(other.text, /Student B/);
    assert.equal(other.text.includes('>Student A<'), false);
  } finally {
    await app.stop();
  }
});
