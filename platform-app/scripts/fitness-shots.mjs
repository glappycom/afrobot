import { createRequire } from 'node:module';
const { chromium } = createRequire('/tmp/pw/package.json')('playwright-core');
import { start } from '../src/server.js';

const out = '/opt/cursor/artifacts';
const local = await start({ port: 0, dbPath: ':memory:', demoSeed: true });
const origin = local.url;

async function signIn(page, username, password) {
  await page.goto(`${origin}/login`);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(coach|organiser|auditor|student)/);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const coach = await browser.newContext({ viewport: { width: 390, height: 900 } });
const coachPage = await coach.newPage();
await signIn(coachPage, 'coach-a', 'demo-coach-a');
await coachPage.goto(`${origin}/coach/capture`);
await coachPage.selectOption('#meetingId', 'mtg-cm-w2');
await coachPage.locator('input[name="mark-lrn-cm-a"][value="present"]').check();
await coachPage.locator('input[name="mark-lrn-cm-b"][value="absent"]').check();
await coachPage.fill('#denominator', '9');
await coachPage.fill('#numerator', '4');
await coachPage.fill('#projectResult', 'Line follow');
await coachPage.fill('#note', 'No names. Four completions today.');
await coachPage.click('#submit-capture');
await coachPage.waitForFunction(() => document.getElementById('sync-status').textContent === 'Sent');
await coachPage.screenshot({ path: `${out}/fitness-1-coach-capture.png`, fullPage: true });

const organiser = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const orgPage = await organiser.newPage();
await signIn(orgPage, 'organiser', 'demo-organiser');
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
  const extra = await (await fetch('/api/admin/meetings', { method: 'POST', headers, body: JSON.stringify({
    schoolId: 'sch-cm-north', coachId: 'user-coach-a', meetsOn: '2026-03-23', label: 'Cameroon extra',
  }) })).json();
  return { learnerId: learner.id, meetingId: meeting.id, extraId: extra.id };
});

const harbour = await browser.newContext({ viewport: { width: 390, height: 900 } });
const harbourPage = await harbour.newPage();
await signIn(harbourPage, 'harbour-coach', 'harbour-pass-1');
const claim = await harbourPage.evaluate(async (setup) => {
  const token = document.querySelector('input[name="csrf"]')?.value;
  const home = await fetch('/coach/capture');
  const html = await home.text();
  const match = html.match(/name="csrf" value="([^"]+)"/);
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': match[1] };
  const sent = await (await fetch('/api/captures', { method: 'POST', headers, body: JSON.stringify({
    meetingId: setup.meetingId,
    idempotencyKey: 'harbour-shot-0001',
    numerator: 3,
    denominator: 4,
    projectResult: 'Robot crossed the line',
    note: 'No names. Counted the season task only.',
    attendance: [{ learnerId: setup.learnerId, present: true }],
  }) })).json();
  return sent.id;
}, setup);
await orgPage.evaluate(async (id) => {
  const token = document.querySelector('input[name="csrf"]').value;
  await fetch(`/api/claims/${id}/return`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ note: 'Count only the season task.' }),
  });
}, claim);
await harbourPage.goto(`${origin}/coach/logs`);
await harbourPage.screenshot({ path: `${out}/fitness-2-coach-history.png`, fullPage: true });
await orgPage.goto(`${origin}/organiser/tracking`);
await orgPage.screenshot({ path: `${out}/fitness-3-organiser-tracking.png`, fullPage: true });
await orgPage.goto(`${origin}/organiser/admin`);
await orgPage.screenshot({ path: `${out}/fitness-4-admin.png`, fullPage: true });

const traced = await coachPage.evaluate(async (setup) => {
  const html = await (await fetch('/coach/capture')).text();
  const token = html.match(/name="csrf" value="([^"]+)"/)[1];
  const headers = { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': token };
  const sent = await (await fetch('/api/captures', { method: 'POST', headers, body: JSON.stringify({
    meetingId: setup.extraId,
    idempotencyKey: 'cameroon-shot-0001',
    numerator: 7,
    denominator: 9,
    projectResult: 'Sensor run finished',
    note: 'No names. Seven completions of nine starters.',
    attendance: [
      { learnerId: 'lrn-cm-a', present: true },
      { learnerId: 'lrn-cm-b', present: false },
    ],
  }) })).json();
  return sent.id;
}, setup);
await orgPage.evaluate(async (id) => {
  const token = document.querySelector('input[name="csrf"]').value;
  const response = await fetch(`/api/claims/${id}/approve`, {
    method: 'POST',
    headers: { accept: 'application/json', 'x-csrf-token': token },
  });
  if (!response.ok) throw new Error(`approve ${response.status}`);
}, traced);
const auditor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const auditorPage = await auditor.newPage();
await signIn(auditorPage, 'auditor', 'demo-auditor');
await auditorPage.goto(`${origin}/auditor/trace/${traced}`);
await auditorPage.screenshot({ path: `${out}/fitness-5-auditor-trace.png`, fullPage: true });
console.log('fitness shots ready');
await browser.close();
local.close();
