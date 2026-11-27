import { createRequire } from 'node:module';
const { chromium } = createRequire('/tmp/pw/package.json')('playwright-core');
import { start } from '../src/server.js';

const out = '/opt/cursor/artifacts';
const local = await start({ port: 0, dbPath: ':memory:', demoSeed: true, now: () => '2026-11-26T15:00:00.000Z' });
const origin = local.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });

async function signIn(page, username, password) {
  await page.goto(`${origin}/login`);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(coach|organiser|auditor|student)/);
}

const org = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const orgPage = await org.newPage();
await signIn(orgPage, 'organiser', 'demo-organiser');
await orgPage.goto(`${origin}/organiser`);
await orgPage.screenshot({ path: `${out}/v05-2-overdue-falling-behind.png`, fullPage: true });

const setup = await orgPage.evaluate(async () => {
  const token = document.querySelector('input[name="csrf"]').value;
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token };
  const club = await (await fetch('/api/admin/clubs', { method: 'POST', headers, body: JSON.stringify({
    displayName: 'Harbour Workshop (fictional)', countryName: 'Ghana', label: 'Team Harbour', windowStart: '2026-09-01', windowEnd: '2026-11-30',
  }) })).json();
  const coach = await (await fetch('/api/admin/coaches', { method: 'POST', headers, body: JSON.stringify({
    schoolId: club.schoolId, displayName: 'Coach H', username: 'harbour-coach', password: 'harbour-pass-1',
  }) })).json();
  const learner = await (await fetch('/api/admin/learners', { method: 'POST', headers, body: JSON.stringify({
    schoolId: club.schoolId, letter: 'D', consent: 'active',
  }) })).json();
  const meeting = await (await fetch('/api/admin/meetings', { method: 'POST', headers, body: JSON.stringify({
    schoolId: club.schoolId, coachId: coach.id, meetsOn: '2026-10-06', label: 'Harbour week one',
  }) })).json();
  await fetch('/api/admin/grants', { method: 'POST', headers, body: JSON.stringify({
    auditorId: 'user-auditor', schoolId: club.schoolId, startsOn: '2026-11-01', expiresOn: '2027-06-01',
  }) });
  return { club, learnerId: learner.id, meetingId: meeting.id };
});
await orgPage.goto(`${origin}/organiser/grants`);
await orgPage.screenshot({ path: `${out}/v05-1-auditor-grant.png`, fullPage: true });

const harbour = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const harbourPage = await harbour.newPage();
await signIn(harbourPage, 'harbour-coach', 'harbour-pass-1');
const claimId = await harbourPage.evaluate(async (setup) => {
  const html = await (await fetch('/coach/capture')).text();
  const token = html.match(/name="csrf" value="([^"]+)"/)[1];
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token };
  const sent = await (await fetch('/api/captures', { method: 'POST', headers, body: JSON.stringify({
    meetingId: setup.meetingId, idempotencyKey: 'shot-harbour-0001', numerator: 3, denominator: 4,
    projectResult: 'Robot crossed the line', note: 'No names. Counted the season task only.',
    attendance: [{ learnerId: setup.learnerId, present: true }],
  }) })).json();
  return sent.id;
}, setup);
await orgPage.evaluate(async (id) => {
  const token = document.querySelector('input[name="csrf"]').value;
  await fetch(`/api/claims/${id}/return`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ note: 'Count only the season task.' }) });
}, claimId);
await harbourPage.goto(`${origin}/coach/logs`);
await harbourPage.screenshot({ path: `${out}/v05-3-return-resubmit.png`, fullPage: true });
const csv = await orgPage.evaluate(async (schoolId) => {
  const response = await fetch(`/organiser/export.csv?schoolId=${schoolId}&from=2026-09-01&to=2026-11-30`);
  return response.text();
}, setup.club.schoolId);
await orgPage.setContent(`<!doctype html><html><body><main><h1>Club summary export</h1><pre>${csv.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre><p>Preview v0.5</p></main></body></html>`);
await orgPage.screenshot({ path: `${out}/v05-4-export.png`, fullPage: true });
console.log('v05 shots ready');
await browser.close();
local.close();
