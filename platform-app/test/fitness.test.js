import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureDemoMeetings } from '../src/operations.js';
import { api, demo, login, page } from './helpers.js';

test('demo meetings are not seeded unless demo mode is on, and seeding twice does not duplicate them', async () => {
  const empty = await demo({ demoSeed: false });
  try {
    const meetings = empty.app.db.prepare('SELECT COUNT(*) AS n FROM meetings').get();
    const users = empty.app.db.prepare('SELECT COUNT(*) AS n FROM users').get();
    assert.equal(Number(meetings.n), 0);
    assert.equal(Number(users.n), 0);
  } finally {
    await empty.stop();
  }
  const app = await demo();
  try {
    ensureDemoMeetings(app.app.db);
    ensureDemoMeetings(app.app.db);
    const meetings = app.app.db.prepare(`SELECT COUNT(*) AS n FROM meetings WHERE id LIKE 'mtg-%'`).get();
    assert.equal(Number(meetings.n), 4);
  } finally {
    await app.stop();
  }
});

test('two clubs and two coaches can log sessions across weeks, return one, and roll up the approved figures', async () => {
  const app = await demo();
  try {
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const coachA = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const captureA = await page(app.url, coachA, '/coach/capture');
    assert.equal(captureA.status, 200);
    assert.equal(captureA.text.includes('type="file"'), true);
    assert.equal(captureA.text.includes('value="6"'), false);
    assert.match(captureA.text, /Week 1/);
    const captureB = await page(app.url, coachB, '/coach/capture');
    assert.equal(captureB.text.includes('North Ridge'), false);
    assert.equal((await page(app.url, coachA, '/organiser/tracking')).status, 403);
    assert.equal((await api(app.url, coachA, 'POST', '/api/admin/clubs', {})).status, 403);

    const club = await api(app.url, organiser, 'POST', '/api/admin/clubs', {
      displayName: 'Harbour Workshop (fictional)',
      countryName: 'Ghana',
      label: 'Team Harbour',
      windowStart: '2026-09-01',
      windowEnd: '2026-10-01',
    });
    assert.equal(club.status, 201, await club.clone().text());
    const clubBody = await club.json();
    const period = await api(app.url, organiser, 'POST', '/api/admin/period', {
      schoolId: clubBody.schoolId,
      windowStart: '2026-09-01',
      windowEnd: '2026-11-30',
    });
    assert.equal(period.status, 200);
    const coach = await api(app.url, organiser, 'POST', '/api/admin/coaches', {
      schoolId: clubBody.schoolId,
      displayName: 'Coach H',
      username: 'harbour-coach',
      password: 'harbour-pass-1',
    });
    assert.equal(coach.status, 201, await coach.clone().text());
    const coachBody = await coach.json();
    assert.equal(coachBody.password, undefined);
    const learner = await api(app.url, organiser, 'POST', '/api/admin/learners', {
      schoolId: clubBody.schoolId,
      letter: 'D',
      consent: 'active',
    });
    const learnerBody = await learner.json();
    assert.equal(learner.status, 201);
    const firstMeeting = await api(app.url, organiser, 'POST', '/api/admin/meetings', {
      schoolId: clubBody.schoolId,
      coachId: coachBody.id,
      meetsOn: '2026-10-06',
      label: 'Harbour week one',
    });
    const secondMeeting = await api(app.url, organiser, 'POST', '/api/admin/meetings', {
      schoolId: clubBody.schoolId,
      coachId: coachBody.id,
      meetsOn: '2026-10-20',
      label: 'Harbour week three',
    });
    assert.equal(firstMeeting.status, 201, await firstMeeting.clone().text());
    assert.equal(secondMeeting.status, 201, await secondMeeting.clone().text());
    const weekOne = await firstMeeting.json();
    const weekThree = await secondMeeting.json();
    const cameroon = await api(app.url, organiser, 'POST', '/api/admin/meetings', {
      schoolId: 'sch-cm-north',
      coachId: 'user-coach-a',
      meetsOn: '2026-03-23',
      label: 'Cameroon extra',
    });
    const tanzania = await api(app.url, organiser, 'POST', '/api/admin/meetings', {
      schoolId: 'sch-tz-lakeside',
      coachId: 'user-coach-b',
      meetsOn: '2026-03-24',
      label: 'Tanzania extra',
    });
    assert.equal(cameroon.status, 201, await cameroon.clone().text());
    assert.equal(tanzania.status, 201, await tanzania.clone().text());
    const cameroonMeeting = await cameroon.json();
    const tanzaniaMeeting = await tanzania.json();

    const harbour = await login(app.url, 'harbour-coach', 'harbour-pass-1');
    const outside = await api(app.url, harbour, 'POST', '/api/captures', {
      meetingId: cameroonMeeting.id,
      idempotencyKey: 'harbour-cannot-see-cm',
      numerator: 1,
      denominator: 1,
      projectResult: 'Should not save',
      note: 'This note should not be stored.',
      attendance: [{ learnerId: learnerBody.id, present: true }],
    });
    assert.equal(outside.status, 404);

    const sent = await api(app.url, harbour, 'POST', '/api/captures', {
      meetingId: weekOne.id,
      idempotencyKey: 'harbour-week-one-0001',
      numerator: 3,
      denominator: 4,
      projectResult: 'Robot crossed the line',
      note: 'No names. Counted the season task only.',
      attendance: [{ learnerId: learnerBody.id, present: true }],
    });
    assert.equal(sent.status, 201, await sent.clone().text());
    const sentBody = await sent.json();
    const again = await api(app.url, harbour, 'POST', '/api/captures', {
      meetingId: weekOne.id,
      idempotencyKey: 'harbour-week-one-0001',
      numerator: 3,
      denominator: 4,
      projectResult: 'Robot crossed the line',
      note: 'No names. Counted the season task only.',
      attendance: [{ learnerId: learnerBody.id, present: true }],
    });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).id, sentBody.id);
    const weekTwo = await api(app.url, harbour, 'POST', '/api/captures', {
      meetingId: weekThree.id,
      idempotencyKey: 'harbour-week-three-0001',
      numerator: 1,
      denominator: 4,
      projectResult: 'Short run only',
      note: 'No names. One completion this week.',
      attendance: [{ learnerId: learnerBody.id, present: true }],
    });
    assert.equal(weekTwo.status, 201, await weekTwo.clone().text());
    const weekTwoBody = await weekTwo.json();
    const storedWeek = await (await api(app.url, harbour, 'GET', `/api/claims/${weekTwoBody.id}`)).json();
    assert.equal(storedWeek.versions[0].windowEnd, '2026-11-30');
    assert.equal(storedWeek.versions[0].windowStart, '2026-09-01');

    const cmSent = await api(app.url, coachA, 'POST', '/api/captures', {
      meetingId: cameroonMeeting.id,
      idempotencyKey: 'cameroon-extra-0001',
      numerator: 7,
      denominator: 9,
      projectResult: 'Sensor run finished',
      note: 'No names. Seven completions of nine starters.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(cmSent.status, 201, await cmSent.clone().text());
    const cmBody = await cmSent.json();
    const tzSent = await api(app.url, coachB, 'POST', '/api/captures', {
      meetingId: tanzaniaMeeting.id,
      idempotencyKey: 'tanzania-extra-0001',
      numerator: 2,
      denominator: 5,
      projectResult: 'Short challenge',
      note: 'No names. Two completions of five starters.',
      attendance: [{ learnerId: 'lrn-tz-a', present: true }],
    });
    assert.equal(tzSent.status, 201, await tzSent.clone().text());
    const tzBody = await tzSent.json();
    const boardB = await api(app.url, coachB, 'GET', '/api/session-board');
    const boardBRows = await boardB.json();
    assert.equal(JSON.stringify(boardBRows).includes('Harbour'), false);
    assert.equal(JSON.stringify(boardBRows).includes('Cameroon extra'), false);
    assert.equal(JSON.stringify(boardBRows).includes('Tanzania extra'), true);

    const returned = await api(app.url, organiser, 'POST', `/api/claims/${sentBody.id}/return`, {
      note: 'Count only the season task.',
    });
    assert.equal(returned.status, 200, await returned.clone().text());
    const history = await page(app.url, harbour, '/coach/logs');
    assert.equal(history.status, 200);
    assert.match(history.text, /Needs attention/);
    assert.match(history.text, /Count only the season task/);
    assert.match(history.text, /Fix and resubmit/);
    const fixed = await api(app.url, harbour, 'POST', `/api/claims/${sentBody.id}/resubmit`, {
      numerator: 2,
      denominator: 4,
      projectResult: 'Robot crossed the line',
      note: 'No names. Recounted after the return.',
      attendance: [{ learnerId: learnerBody.id, present: true }],
    });
    assert.equal(fixed.status, 200, await fixed.clone().text());
    const fixedBody = await fixed.json();
    assert.equal(fixedBody.version, 2);
    assert.notEqual(fixedBody.id, sentBody.id);
    const versions = await api(app.url, organiser, 'GET', `/api/claims/${sentBody.id}`);
    const versionBody = await versions.json();
    const first = versionBody.versions.find((row) => row.version === 1);
    const second = versionBody.versions.find((row) => row.version === 2);
    assert.equal(first.status, 'returned');
    assert.equal(first.numerator, 3);
    assert.equal(first.returnNote, 'Count only the season task.');
    assert.equal(second.numerator, 2);
    assert.equal(second.status, 'submitted');

    for (const id of [fixedBody.id, weekTwoBody.id, cmBody.id, tzBody.id]) {
      const approved = await api(app.url, organiser, 'POST', `/api/claims/${id}/approve`, {});
      assert.equal(approved.status, 200, await approved.clone().text());
    }
    const totals = await (await api(app.url, organiser, 'GET', '/api/session-totals')).json();
    const harbourTotal = totals.find((row) => row.schoolId === clubBody.schoolId);
    const cmTotal = totals.find((row) => row.schoolId === 'sch-cm-north');
    const tzTotal = totals.find((row) => row.schoolId === 'sch-tz-lakeside');
    assert.equal(harbourTotal.label, '3/8 = 37.5%');
    assert.equal(harbourTotal.sessions, 2);
    assert.equal(cmTotal.label, '7/9 = 77.8%');
    assert.equal(tzTotal.label, '2/5 = 40%');
    const tracking = await page(app.url, organiser, '/organiser/tracking');
    assert.match(tracking.text, /3\/8 = 37\.5%/);
    assert.match(tracking.text, /Pending review|Sent|Missing/);
    const student = await page(app.url, await login(app.url, 'student-a', 'demo-student-a'), '/student/family');
    assert.match(student.text, /1 of 1/);
    const events = await (await api(app.url, organiser, 'GET', '/api/events')).json();
    assert.ok(events.some((row) => row.action === 'returned' && row.detail.note === 'Count only the season task.'));
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const trace = await page(app.url, auditor, `/auditor/trace/${cmBody.id}`);
    assert.equal(trace.status, 200);
    assert.match(trace.text, /7\/9 = 77\.8%/);
    assert.match(trace.text, /2026-03-02/);
    assert.match(trace.text, /2026-04-24/);
    assert.match(trace.text, /No photo/);
    assert.equal((await page(app.url, auditor, `/auditor/trace/${fixedBody.id}`)).status, 404);
    const bad = await api(app.url, coachA, 'POST', '/api/captures', {
      meetingId: 'mtg-cm-w1',
      idempotencyKey: 'cameroon-missing-note',
      numerator: 1,
      denominator: 2,
      projectResult: 'Done',
      note: 'short',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: true },
      ],
    });
    assert.equal(bad.status, 422);
    assert.match((await bad.json()).error, /Note/);
  } finally {
    await app.stop();
  }
});
