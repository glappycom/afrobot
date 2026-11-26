import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sha256 } from '../src/canonical.js';
import { IDS, PRIVATE_NOTE } from '../src/constants.js';
import { goalRollup, projectReport } from '../src/domain.js';
import { userById } from '../src/access.js';
import { api, demo, login, page } from './helpers.js';

test('coach submit, organiser approval, correction, and auditor export', async () => {
  const app = await demo({ story: false });
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');

    const evidence = await api(app.url, coach, 'POST', '/api/evidence', {
      id: 'ev-workflow-log',
      claimId: 'claim-workflow-v1',
      activityDate: '2026-04-20',
      body: 'Redacted workflow log. No learner names.',
      sourceType: 'test_log',
    });
    assert.equal(evidence.status, 201, await evidence.clone().text());

    const submitted = await api(app.url, coach, 'POST', '/api/claims', {
      id: 'claim-workflow-v1',
      numerator: 6,
      denominator: 8,
      activityDate: '2026-04-24',
    });
    assert.equal(submitted.status, 201);
    const submittedBody = await submitted.json();
    assert.equal(submittedBody.submittedBy, 'user-coach-a');
    assert.equal(submittedBody.status, 'submitted');

    const coachApprove = await api(app.url, coach, 'POST', '/api/claims/claim-workflow-v1/approve', {});
    assert.equal(coachApprove.status, 403);

    const approved = await api(app.url, organiser, 'POST', '/api/claims/claim-workflow-v1/approve', {});
    assert.equal(approved.status, 200);
    const approvedBody = await approved.json();
    assert.equal(approvedBody.version, 1);
    assert.match(approvedBody.digest, /^[a-f0-9]{64}$/);

    const traceV1 = await (await api(app.url, auditor, 'GET', '/api/claims/claim-workflow-v1')).json();
    assert.equal(traceV1.current.numerator, 6);
    assert.equal(traceV1.current.denominator, 8);
    assert.equal(traceV1.snapshots[0].digest_sha256, approvedBody.digest);
    assert.equal(sha256(traceV1.snapshots[0].canonical_json), approvedBody.digest);

    const samePerson = app.app.db.prepare(`UPDATE claims SET submitted_by = 'user-organiser' WHERE id = 'claim-workflow-v1'`);
    assert.throws(() => samePerson.run(), /frozen|approved/i);

    const correction = await api(app.url, coach, 'POST', '/api/claims/claim-workflow-v1/corrections', {
      id: 'claim-workflow-v2',
      numerator: 5,
      denominator: 8,
      activityDate: '2026-05-02',
      reason: 'One finisher had only completed the practice lesson.',
    });
    assert.equal(correction.status, 201, await correction.clone().text());
    const still = await (await api(app.url, auditor, 'GET', '/api/claims/claim-workflow-v1')).json();
    assert.equal(still.current.numerator, 6);

    const approvedV2 = await api(app.url, organiser, 'POST', '/api/claims/claim-workflow-v2/approve', {});
    assert.equal(approvedV2.status, 200);
    const approvedV2Body = await approvedV2.json();
    assert.notEqual(approvedV2Body.digest, approvedBody.digest);

    const traceV2 = await (await api(app.url, auditor, 'GET', '/api/claims/claim-workflow-v2')).json();
    assert.equal(traceV2.current.numerator, 5);
    assert.equal(traceV2.current.denominator, 8);
    assert.equal(traceV2.versions.find((row) => row.version === 1).numerator, 6);
    assert.equal(traceV2.versions.find((row) => row.version === 1).status, 'approved');
    const digests = traceV2.snapshots.map((row) => row.digest_sha256);
    assert.equal(digests.length, 2);
    assert.equal(new Set(digests).size, 2);
    assert.ok(digests.includes(approvedBody.digest));

    const packResponse = await api(app.url, auditor, 'POST', '/api/claims/claim-workflow-v2/export', {});
    assert.equal(packResponse.status, 201);
    const pack = await packResponse.json();
    assert.equal(pack.manifest.calculation.current.label, '5/8 = 62.5%');
    assert.equal(pack.manifest.calculation.superseded.label, '6/8 = 75%');
    for (const file of pack.manifest.files) {
      assert.equal(sha256(pack.files[file.name]), file.sha256);
      assert.equal(Buffer.byteLength(pack.files[file.name]), file.bytes);
    }
    const packed = JSON.stringify(pack);
    assert.equal(packed.includes(IDS.schoolTz), false);
    assert.equal(packed.includes(PRIVATE_NOTE), false);
    assert.equal(packed.includes('demo-coach'), false);

    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const leaked = await api(app.url, coachB, 'POST', `/api/claims/${pack.packId.replace('pack-', '')}/export`, {});
    assert.equal(leaked.status, 404);
    const download = await api(app.url, coachB, 'GET', `/exports/${pack.packId}`);
    assert.equal(download.status, 404);
    assert.equal(await download.text(), '{"error":"Not found"}\n');
  } finally {
    await app.stop();
  }
});

test('the practice sorter cannot complete a season project, and the SDG 12 record is separate', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const blocked = await api(app.url, coach, 'POST', '/api/practice-complete', { lessonId: IDS.lessonSorter });
    assert.equal(blocked.status, 422);
    const message = await blocked.json();
    assert.match(message.error, /cannot complete a season project/);

    const coachPage = await page(app.url, coach, '/coach');
    assert.match(coachPage.text, /Paper and plastic sorter/);
    assert.match(coachPage.text, /CM-SDG12-STATION/);
    assert.match(coachPage.text, /second-day recount/);
    assert.match(coachPage.text, /Not verified/);

    const before = goalRollup(app.app.db, userById(app.app.db, 'user-organiser'), '2026-11-26T12:00:00.000Z');
    assert.equal(before.projectsByGoal['12'], 1);
    assert.equal(before.verifiedByGoal['12'] || 0, 0);
    assert.equal(before.outputByGoal['12'], 1);
    assert.equal(before.confirmedUseByGoal['12'], 1);
    assert.equal(before.projectsByGoal['6'], 1);
    assert.equal(before.verifiedByGoal['6'] || 0, 0);

    const verified = await api(app.url, organiser, 'POST', `/api/projects/${IDS.projectCm}/verify`, {});
    assert.equal(verified.status, 200, await verified.clone().text());
    const after = goalRollup(app.app.db, userById(app.app.db, 'user-organiser'), '2026-11-26T12:00:00.000Z');
    assert.equal(after.projectsByGoal['12'], 1);
    assert.equal(after.verifiedByGoal['12'], 1);

    const correction = await api(app.url, coach, 'POST', `/api/projects/${IDS.projectCm}/result-corrections`, {
      id: 'meas-cm-result-v2',
      value: 28,
      denominator: 100,
      reason: 'Recount found three more mis-sorts.',
    });
    assert.equal(correction.status, 201);
    const report = projectReport(app.app.db, { id: IDS.projectCm });
    assert.equal(report.result.value, 28);
    assert.equal(report.result.version, 2);

    const removed = await api(app.url, coach, 'POST', `/api/evidence/${IDS.evidenceResult}/withdraw`, {});
    assert.equal(removed.status, 422);
    const privateNote = await api(app.url, coach, 'POST', '/api/evidence', {
      id: 'ev-temp-private',
      activityDate: '2026-05-06',
      redactionState: 'private_removable',
      body: PRIVATE_NOTE,
    });
    assert.equal(privateNote.status, 201);
    const file = `${app.app.filesDir}/ev-temp-private.txt`;
    assert.equal(fs.existsSync(file), true);
    const gone = await api(app.url, coach, 'POST', '/api/evidence/ev-temp-private/withdraw', {});
    assert.equal(gone.status, 200);
    assert.equal(fs.existsSync(file), false);
    const row = app.app.db.prepare('SELECT body_redacted, filename FROM evidence_items WHERE id = ?').get('ev-temp-private');
    assert.equal(row.body_redacted, null);
    assert.equal(row.filename, null);
    const tombstone = app.app.db.prepare(`SELECT detail_json FROM events WHERE subject_id = 'ev-temp-private' AND action = 'revoked'`).get();
    assert.equal(tombstone.detail_json.includes('scratch-token'), false);
    const download = await api(app.url, coach, 'GET', '/evidence/ev-temp-private/download');
    assert.equal(download.status, 404);

    const blank = await api(app.url, coach, 'POST', '/api/claims/draft', { numerator: '', denominator: '' });
    assert.equal(blank.status, 201);
    const draft = await blank.json();
    assert.equal(draft.numerator, null);
    assert.equal(draft.denominator, null);
  } finally {
    await app.stop();
  }
});

test('season comparison, guardrail hold, and the U.S. copy stay on the organiser screen', async () => {
  const app = await demo();
  try {
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const screen = await page(app.url, organiser, '/organiser');
    assert.equal(screen.status, 200);
    assert.match(screen.text, /1 versus 2 per hour and 2×/);
    assert.match(screen.text, /Multiplier suppressed: scope differs/);
    assert.match(screen.text, /Multiplier suppressed: rubric differs/);
    assert.match(screen.text, /baseline is missing/);
    assert.match(screen.text, /coverage is missing/);
    assert.match(screen.text, /Human decision: hold/);
    assert.match(screen.text, /No AI recommendation/);
    assert.match(screen.text, /Projects in that season: 0/);
    assert.match(screen.text, /Copied rubrics: 1/);
    assert.doesNotMatch(screen.text, /10× is this comparison|multiplier is 10/);

    const users = app.app.db.prepare('SELECT COUNT(*) AS n FROM users').get();
    const grants = app.app.db.prepare('SELECT COUNT(*) AS n FROM access_grants').get();
    const again = await api(app.url, organiser, 'POST', '/api/seasons/clone', {});
    assert.equal(again.status, 200);
    const body = await again.json();
    assert.equal(body.already, true);
    assert.equal(body.studentsCopied, 0);
    assert.equal(Number(users.n), Number(app.app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n));
    assert.equal(Number(grants.n), Number(app.app.db.prepare('SELECT COUNT(*) AS n FROM access_grants').get().n));
    const copiedLesson = app.app.db.prepare(`SELECT can_complete_season_project AS n FROM lessons WHERE id = 'lesson-sorter-us'`).get();
    assert.equal(Number(copiedLesson.n), 0);
    const usProjects = app.app.db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE season_id = ?`).get(IDS.seasonUs);
    assert.equal(Number(usProjects.n), 0);
  } finally {
    await app.stop();
  }
});

test('approved rows, events, and snapshots cannot be rewritten in place', async () => {
  const app = await demo();
  try {
    const db = app.app.db;
    assert.throws(() => db.prepare(`UPDATE events SET action = 'approved' WHERE id = 1`).run());
    assert.throws(() => db.prepare(`DELETE FROM events WHERE id = 1`).run());
    assert.throws(() => db.prepare(`UPDATE snapshots SET digest_sha256 = 'abc' WHERE subject_id = ?`).run(IDS.claimV1));
    assert.throws(() => db.prepare(`UPDATE digest_ledger SET digest_sha256 = 'abc' WHERE id = 1`).run());
    assert.throws(() => db.prepare(`UPDATE claims SET numerator = 9 WHERE id = ?`).run(IDS.claimV1));
    const stored = db.prepare('SELECT numerator, canonical_json FROM claims c JOIN snapshots s ON s.subject_id = c.id WHERE c.id = ?').get(IDS.claimV1);
    assert.equal(stored.numerator, 6);
    assert.match(stored.canonical_json, /"numerator":6/);
  } finally {
    await app.stop();
  }
});
