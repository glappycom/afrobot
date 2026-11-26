import assert from 'node:assert/strict';
import test from 'node:test';
import { IDS, OTHER_DRAFT_TOKEN, PRIVATE_NOTE } from '../src/constants.js';
import { api, demo, login, page } from './helpers.js';

const DENIAL = '{"error":"Not found"}\n';

test('server-side access boundaries hide other schools, drafts, and metadata', async () => {
  const app = await demo();
  try {
    const coachA = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const studentA = await login(app.url, 'student-a', 'demo-student-a');
    const studentB = await login(app.url, 'student-b', 'demo-student-b');
    assert.equal(coachA.status, 200);
    assert.equal(coachA.body.role, 'coach');

    const listB = await api(app.url, coachB, 'GET', '/api/claims');
    const claimsB = await listB.json();
    assert.equal(listB.status, 200);
    assert.deepEqual(claimsB.map((row) => row.id), [IDS.claimTz]);
    assert.equal(JSON.stringify(claimsB).includes(IDS.schoolCm), false);
    assert.equal(JSON.stringify(claimsB).includes(IDS.claimV2), false);

    const reads = [
      [coachB, 'GET', `/api/claims/${IDS.claimV2}`],
      [coachB, 'GET', `/api/projects/${IDS.projectCm}`],
      [coachB, 'GET', `/evidence/${IDS.evidenceLog}/download`],
      [coachB, 'POST', `/api/claims/${IDS.claimV2}/export`],
      [auditor, 'GET', `/api/claims/${IDS.claimTz}`],
      [auditor, 'GET', `/api/projects/${IDS.projectTz}`],
      [auditor, 'GET', `/api/projects/${IDS.projectStudentB}`],
      [auditor, 'POST', `/api/claims/${IDS.claimTz}/export`],
      [studentA, 'GET', `/api/projects/${IDS.projectStudentB}`],
      [studentA, 'GET', `/api/claims/${IDS.claimV2}`],
      [studentA, 'GET', `/evidence/${IDS.evidenceLog}/download`],
      [studentB, 'GET', `/api/projects/${IDS.projectStudentA}`],
      [organiser, 'GET', `/api/projects/${IDS.projectStudentB}`],
      [coachA, 'GET', `/api/projects/${IDS.projectStudentB}`],
    ];
    for (const [session, method, urlPath] of reads) {
      const response = await api(app.url, session, method, urlPath, method === 'POST' ? {} : undefined);
      const text = await response.text();
      assert.equal(response.status, 404, `${session.body.role} ${method} ${urlPath}`);
      assert.equal(text, DENIAL, text);
      assert.equal(text.includes(OTHER_DRAFT_TOKEN), false);
      assert.equal(text.includes(PRIVATE_NOTE), false);
      assert.equal(text.includes('North Ridge'), false);
      assert.equal(text.includes('Lakeside'), false);
    }

    const auditorEdit = await api(app.url, auditor, 'POST', `/api/claims/${IDS.claimV2}/corrections`, {
      numerator: 1,
      denominator: 8,
      activityDate: '2026-05-06',
      reason: 'Auditor must not edit.',
    });
    assert.equal(auditorEdit.status, 403);
    const auditorEditBody = await auditorEdit.text();
    assert.equal(auditorEditBody, '{"error":"Not available"}\n');
    assert.equal(auditorEditBody.includes('North Ridge'), false);

    const auditorDownload = await api(app.url, auditor, 'GET', `/evidence/${IDS.evidenceLog}/download`);
    assert.equal(auditorDownload.status, 200);
    const source = await auditorDownload.text();
    assert.match(source, /No learner names/);
    const withdrawn = await api(app.url, auditor, 'GET', `/evidence/${IDS.evidencePrivate}/download`);
    assert.equal(withdrawn.status, 404);
    assert.equal(await withdrawn.text(), DENIAL);

    const coachPageA = await page(app.url, coachA, '/coach');
    const coachPageB = await page(app.url, coachB, '/coach');
    assert.equal(coachPageA.status, 200);
    assert.match(coachPageA.text, /North Ridge Learning Circle/);
    assert.equal(coachPageA.text.includes('Lakeside'), false);
    assert.equal(coachPageA.text.includes(OTHER_DRAFT_TOKEN), false);
    assert.equal(coachPageA.text.includes('scratch-token-should-vanish'), false);
    assert.match(coachPageB.text, /Lakeside Makers Circle/);
    assert.equal(coachPageB.text.includes('North Ridge'), false);
    assert.equal(coachPageB.text.includes(IDS.claimV1), false);
    assert.equal(coachPageB.text.includes(IDS.claimV2), false);

    const studentPageA = await page(app.url, studentA, '/student');
    assert.match(studentPageA.text, /Learner CM-1/);
    assert.equal(studentPageA.text.includes(OTHER_DRAFT_TOKEN), false);
    assert.equal(studentPageA.text.includes(IDS.projectStudentB), false);

    const eventsB = await api(app.url, coachB, 'GET', '/api/events');
    const eventsText = await eventsB.text();
    assert.equal(eventsB.status, 200);
    assert.equal(eventsText.includes(IDS.claimV2), false);
    assert.equal(eventsText.includes(IDS.schoolCm), false);
    assert.equal(eventsText.includes(PRIVATE_NOTE), false);

    const poked = await api(app.url, studentA, 'GET', `/api/projects/${IDS.projectStudentB}`);
    assert.equal(await poked.text(), DENIAL);
    const eventsA = await (await api(app.url, studentA, 'GET', '/api/events')).text();
    assert.equal(eventsA.includes(OTHER_DRAFT_TOKEN), false);
    assert.equal(eventsA.includes(IDS.projectStudentB), false);
  } finally {
    await app.stop();
  }
});

test('an expired or revoked auditor grant cannot read the assigned school', async () => {
  const expired = await demo({ now: () => '2027-06-02T00:00:00.000Z' });
  try {
    const auditor = await login(expired.url, 'auditor', 'demo-auditor');
    const response = await api(expired.url, auditor, 'GET', `/api/claims/${IDS.claimV2}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), DENIAL);
    const list = await (await api(expired.url, auditor, 'GET', '/api/claims')).json();
    assert.deepEqual(list, []);
  } finally {
    await expired.stop();
  }

  const live = await demo();
  try {
    const organiser = await login(live.url, 'organiser', 'demo-organiser');
    const auditor = await login(live.url, 'auditor', 'demo-auditor');
    const before = await api(live.url, auditor, 'GET', `/api/claims/${IDS.claimV2}`);
    assert.equal(before.status, 200);
    const revoked = await api(live.url, organiser, 'POST', `/api/grants/${IDS.grantAuditor}/revoke`, {});
    assert.equal(revoked.status, 200);
    const after = await api(live.url, auditor, 'GET', `/api/claims/${IDS.claimV2}`);
    assert.equal(after.status, 404);
    assert.equal(await after.text(), DENIAL);
    const edit = await api(live.url, auditor, 'POST', `/api/claims/${IDS.claimV2}/corrections`, {
      numerator: 1, denominator: 8, activityDate: '2026-06-01', reason: 'Should not be accepted.',
    });
    assert.equal(edit.status, 404);
  } finally {
    await live.stop();
  }
});
