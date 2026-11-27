import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { IDS } from '../src/constants.js';
import { verifyPastedPack } from '../src/records.js';
import { api, demo, login, page } from './helpers.js';

test('legal hold blocks removal and retention labels are available', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const created = await api(app.url, coach, 'POST', '/api/evidence', {
      id: 'ev-hold-me',
      activityDate: '2026-05-06',
      redactionState: 'private_removable',
      body: 'Synthetic removable note for a hold test.',
    });
    assert.equal(created.status, 201);
    const held = await api(app.url, organiser, 'POST', '/api/evidence/ev-hold-me/hold', { reason: 'Demo legal hold for the pilot.' });
    assert.equal(held.status, 200, await held.clone().text());
    const blocked = await api(app.url, coach, 'POST', '/api/evidence/ev-hold-me/withdraw', {});
    assert.equal(blocked.status, 422);
    assert.match(await blocked.json().then((body) => body.error), /Legal hold blocks removal/);
    assert.equal(fs.existsSync(`${app.app.filesDir}/ev-hold-me.txt`), true);
    const released = await api(app.url, organiser, 'POST', '/api/evidence/ev-hold-me/release-hold', {});
    assert.equal(released.status, 200);
    const gone = await api(app.url, coach, 'POST', '/api/evidence/ev-hold-me/withdraw', {});
    assert.equal(gone.status, 200);
    const schedule = await (await api(app.url, organiser, 'GET', '/api/retention')).json();
    assert.ok(schedule.some((row) => row.record_type === 'evidence_removable' && row.disposition === 'delete-when-eligible'));
    assert.ok(schedule.some((row) => row.record_type === 'snapshot' && row.disposition === 'keep'));
  } finally {
    await app.stop();
  }
});

test('integrity, provenance, and search stay inside the caller scope', async () => {
  const app = await demo();
  try {
    const coachA = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const integrity = await (await api(app.url, auditor, 'GET', '/api/integrity')).json();
    assert.ok(integrity.length >= 2);
    assert.ok(integrity.every((row) => row.pass === true));
    const pageHtml = await page(app.url, auditor, '/integrity');
    assert.match(pageHtml.text, />Pass</);
    const prov = await (await api(app.url, auditor, 'GET', `/api/claims/${IDS.claimV2}`)).json();
    assert.equal(prov.current.numerator, 5);
    const graph = await page(app.url, auditor, `/records/${IDS.claimV2}`);
    assert.equal(graph.status, 200);
    assert.match(graph.text, /AFB-CLM-000002/);
    assert.match(graph.text, /Provenance from claim to attestation/);
    assert.equal(graph.text.includes('Lakeside'), false);
    const hidden = await page(app.url, coachB, `/records/${IDS.claimV2}`);
    assert.equal(hidden.status, 404);
    assert.equal(hidden.text.includes(IDS.claimV2), false);
    assert.equal(hidden.text.includes('North Ridge'), false);
    const searchB = await api(app.url, coachB, 'GET', '/api/search?q=North%20Ridge');
    const bodyB = await searchB.text();
    assert.equal(searchB.status, 200);
    assert.equal(bodyB, '[]\n');
    assert.equal(bodyB.includes('North Ridge'), false);
    assert.equal(bodyB.includes(IDS.claimV2), false);
    const searchA = await (await api(app.url, coachA, 'GET', '/api/search?q=North%20Ridge')).json();
    assert.ok(searchA.some((row) => row.id === IDS.claimV2));
    const pack = await (await api(app.url, auditor, 'POST', `/api/claims/${IDS.claimV2}/export`, {})).json();
    const verified = await (await api(app.url, auditor, 'POST', '/api/verify', pack)).json();
    assert.equal(verified.pass, true);
    const tampered = structuredClone(pack);
    tampered.files['snapshots.json'] = tampered.files['snapshots.json'].replace(pack.manifest.calculation.current.digest_sha256, '0'.repeat(64));
    const failed = verifyPastedPack(tampered);
    assert.equal(failed.pass, false);
    const zip = await api(app.url, auditor, 'POST', `/api/claims/${IDS.claimV2}/audit-pack`, {});
    assert.equal(zip.status, 201);
    const bytes = Buffer.from(await zip.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  } finally {
    await app.stop();
  }
});
