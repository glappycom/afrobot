import assert from 'node:assert/strict';
import test from 'node:test';
import { api, demo, login, page } from './helpers.js';

const NOW = () => '2026-11-26T15:00:00.000Z';

test('home queue approves and sends back, and pace is calculated from sessions', async () => {
  const app = await demo({ now: NOW });
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const sent = await api(app.url, coach, 'POST', '/api/captures', {
      meetingId: 'mtg-cm-w2',
      idempotencyKey: 'home-queue-0001',
      numerator: 4,
      denominator: 9,
      projectResult: 'Line follow',
      note: 'No names. Four completions today.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(sent.status, 201, await sent.clone().text());
    const claim = await sent.json();
    const home = await page(app.url, organiser, '/organiser');
    assert.match(home.text, new RegExp(`/organiser/claims/${claim.id}/approve`));
    assert.match(home.text, new RegExp(`/organiser/claims/${claim.id}/return`));
    assert.match(home.text, /Overdue/);
    assert.match(home.text, /falling behind/);
    const coachHome = await page(app.url, coachB, '/coach');
    assert.match(coachHome.text, /Overdue/);
    assert.match(coachHome.text, /falling behind/);
    const returned = await api(app.url, organiser, 'POST', `/api/claims/${claim.id}/return`, { note: 'Count only the season task.' });
    assert.equal(returned.status, 200);
    const fixed = await api(app.url, coach, 'POST', `/api/claims/${claim.id}/resubmit`, {
      numerator: 3,
      denominator: 9,
      projectResult: 'Line follow',
      note: 'No names. Recounted after the return.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(fixed.status, 200, await fixed.clone().text());
    const fixedBody = await fixed.json();
    assert.equal(fixedBody.version, 2);
    const approved = await api(app.url, organiser, 'POST', `/api/claims/${fixedBody.id}/approve`, {});
    assert.equal(approved.status, 200);
    const pace = await page(app.url, coach, '/coach');
    assert.match(pace.text, /1 of /);
  } finally {
    await app.stop();
  }
});

test('an organiser can grant and revoke auditor access, edit or cancel a session, deactivate people, and export a summary', async () => {
  const app = await demo({ now: NOW });
  try {
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const club = await (await api(app.url, organiser, 'POST', '/api/admin/clubs', {
      displayName: 'Harbour Workshop (fictional)',
      countryName: 'Ghana',
      label: 'Team Harbour',
      windowStart: '2026-09-01',
      windowEnd: '2026-11-30',
    })).json();
    const coach = await (await api(app.url, organiser, 'POST', '/api/admin/coaches', {
      schoolId: club.schoolId,
      displayName: 'Coach H',
      username: 'harbour-coach',
      password: 'harbour-pass-1',
    })).json();
    const learner = await (await api(app.url, organiser, 'POST', '/api/admin/learners', {
      schoolId: club.schoolId,
      letter: 'D',
      consent: 'active',
    })).json();
    const meeting = await (await api(app.url, organiser, 'POST', '/api/admin/meetings', {
      schoolId: club.schoolId,
      coachId: coach.id,
      meetsOn: '2026-10-06',
      label: 'Harbour week one',
    })).json();
    const harbour = await login(app.url, 'harbour-coach', 'harbour-pass-1');
    const sent = await api(app.url, harbour, 'POST', '/api/captures', {
      meetingId: meeting.id,
      idempotencyKey: 'harbour-grant-0001',
      numerator: 2,
      denominator: 4,
      projectResult: 'Short run',
      note: 'No names. Two completions.',
      attendance: [{ learnerId: learner.id, present: true }],
    });
    assert.equal(sent.status, 201, await sent.clone().text());
    const claim = await sent.json();
    assert.equal((await api(app.url, organiser, 'POST', `/api/claims/${claim.id}/approve`, {})).status, 200);
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    assert.equal((await page(app.url, auditor, `/auditor/trace/${claim.id}`)).status, 404);
    const grant = await api(app.url, organiser, 'POST', '/api/admin/grants', {
      auditorId: 'user-auditor',
      schoolId: club.schoolId,
      startsOn: '2026-11-01',
      expiresOn: '2027-06-01',
    });
    assert.equal(grant.status, 201, await grant.clone().text());
    const grantBody = await grant.json();
    const grantsPage = await page(app.url, organiser, '/organiser/grants');
    assert.match(grantsPage.text, /Auditor access/);
    assert.match(grantsPage.text, /Harbour Workshop/);
    const trace = await page(app.url, await login(app.url, 'auditor', 'demo-auditor'), `/auditor/trace/${claim.id}`);
    assert.equal(trace.status, 200);
    assert.match(trace.text, /2\/4 = 50%/);
    assert.equal((await api(app.url, organiser, 'POST', `/organiser/grants/${grantBody.id}/revoke`, {})).status, 200);
    assert.equal((await page(app.url, await login(app.url, 'auditor', 'demo-auditor'), `/auditor/trace/${claim.id}`)).status, 404);
    const events = await (await api(app.url, organiser, 'GET', '/api/events')).json();
    assert.ok(events.some((row) => row.action === 'granted' && row.detail.auditor_id === 'user-auditor'));
    assert.ok(events.some((row) => row.action === 'revoked' && row.subject_type === 'access_grant'));

    const edited = await api(app.url, organiser, 'POST', '/api/admin/meetings/mtg-cm-w1', { label: 'Week 1 revised', meetsOn: '2026-03-11' });
    assert.equal(edited.status, 200, await edited.clone().text());
    assert.equal((await edited.json()).label, 'Week 1 revised');
    const cancelled = await api(app.url, organiser, 'POST', '/api/admin/meetings/mtg-tz-w2', { cancel: true });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).status, 'cancelled');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const blocked = await api(app.url, coachB, 'POST', '/api/captures', {
      meetingId: 'mtg-tz-w2',
      idempotencyKey: 'cancelled-session-01',
      numerator: 1,
      denominator: 1,
      projectResult: 'Should fail',
      note: 'This session was cancelled already.',
      attendance: [{ learnerId: 'lrn-tz-a', present: true }],
    });
    assert.equal(blocked.status, 422);
    assert.match((await blocked.json()).error, /cancelled/);

    const off = await api(app.url, organiser, 'POST', '/api/admin/deactivate', { learnerId: 'lrn-cm-b', coachId: coach.id });
    assert.equal(off.status, 200, await off.clone().text());
    const capture = await page(app.url, await login(app.url, 'coach-a', 'demo-coach-a'), '/coach/capture');
    assert.match(capture.text, /Student A/);
    assert.equal(capture.text.includes('Student B'), false);
    const marked = await api(app.url, await login(app.url, 'coach-a', 'demo-coach-a'), 'POST', '/api/captures', {
      meetingId: 'mtg-cm-w1',
      idempotencyKey: 'inactive-student-01',
      numerator: 1,
      denominator: 1,
      projectResult: 'Still here',
      note: 'No names. Student B is inactive.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: true },
      ],
    });
    assert.equal(marked.status, 422);
    assert.match((await marked.json()).error, /not active/);
    assert.equal((await login(app.url, 'harbour-coach', 'harbour-pass-1')).status, 403);
    const still = await (await api(app.url, organiser, 'GET', '/api/claims')).json();
    assert.ok(still.some((row) => row.id === claim.id));

    const csv = await page(app.url, organiser, `/organiser/export.csv?schoolId=${club.schoolId}&from=2026-09-01&to=2026-11-30`);
    assert.equal(csv.status, 200);
    assert.match(csv.text, /Harbour week one/);
    assert.match(csv.text, /2,4/);
    assert.equal((await page(app.url, coachB, `/organiser/export.csv?schoolId=${club.schoolId}`)).status, 403);

    const coachHelp = await page(app.url, await login(app.url, 'coach-a', 'demo-coach-a'), '/help');
    assert.match(coachHelp.text, /How it works for a coach/);
    assert.equal(coachHelp.text.includes('Grant an auditor'), false);
    const organiserHelp = await page(app.url, organiser, '/help');
    assert.match(organiserHelp.text, /Grant an auditor/);
    assert.match(organiserHelp.text, /Export CSV/);
    const auditorHelp = await page(app.url, await login(app.url, 'auditor', 'demo-auditor'), '/help');
    assert.match(auditorHelp.text, /How it works for an auditor/);
    const studentHelp = await page(app.url, await login(app.url, 'student-a', 'demo-student-a'), '/help');
    assert.match(studentHelp.text, /How it works for a guardian/);
  } finally {
    await app.stop();
  }
});
