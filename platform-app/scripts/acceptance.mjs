import { createRequire } from 'node:module';
const { chromium } = createRequire('/tmp/pw/package.json')('playwright-core');
import { start } from '../src/server.js';

const base = process.env.ACCEPTANCE_BASE || '';
const share = process.env.ACCEPTANCE_SHARE || '';
const out = '/opt/cursor/artifacts';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let local = null;
const origin = base || (local = await start({ port: 0, dbPath: ':memory:', demoSeed: true })).url;

async function role(user, password) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  if (share) await page.goto(share, { waitUntil: 'domcontentloaded' });
  await page.goto(`${origin}/login`);
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(coach|organiser|auditor|student)/);
  return { context, page };
}

const coach = await role('coach-a', 'demo-coach-a');
await coach.page.goto(`${origin}/coach/result`);
await coach.page.screenshot({ path: `${out}/acceptance-1-enter.png` });
await coach.context.setOffline(true);
await coach.page.click('#submit-result');
await coach.page.waitForFunction(() => document.getElementById('sync-status').textContent.includes('Pending sync'));
await coach.page.screenshot({ path: `${out}/acceptance-2-offline-pending.png` });
await coach.context.setOffline(false);
await coach.page.click('#retry-result');
await coach.page.waitForFunction(() => document.getElementById('sync-status').textContent === 'Sent');
const firstId = await coach.page.locator('#sync-detail').innerText();
await coach.page.screenshot({ path: `${out}/acceptance-3-sent.png` });
await coach.page.click('#retry-result');
await coach.page.waitForTimeout(500);
const secondId = await coach.page.locator('#sync-detail').innerText();
if (firstId !== secondId) throw new Error('retry changed the record');
await coach.page.screenshot({ path: `${out}/acceptance-4-second-retry.png` });

const organiser = await role('organiser', 'demo-organiser');
await organiser.page.setViewportSize({ width: 1280, height: 900 });
await organiser.page.goto(`${origin}/organiser`);
const queue = await organiser.page.content();
if (!queue.includes('6 of 8') && !queue.includes('6/8')) {
  const apiText = await organiser.page.evaluate(async () => {
    const response = await fetch('/api/claims', { headers: { accept: 'application/json' } });
    return response.text();
  });
  const rows = JSON.parse(apiText).filter((row) => String(row.id).startsWith('clm-') && row.numerator === 6 && row.denominator === 8);
  if (rows.length !== 1) throw new Error(`expected one 6/8 record, got ${rows.length}`);
}
await organiser.page.screenshot({ path: `${out}/acceptance-5-organiser.png`, fullPage: true });
const claimId = await organiser.page.evaluate(async () => {
  const response = await fetch('/api/claims', { headers: { accept: 'application/json' } });
  const rows = await response.json();
  return rows.filter((row) => String(row.id).startsWith('clm-') && row.numerator === 6 && row.denominator === 8).map((row) => row.id);
});
if (claimId.length !== 1) throw new Error(`expected one record, got ${claimId.length}`);
const csrf = await organiser.page.locator('input[name="csrf"]').first().inputValue();
const approved = await organiser.page.evaluate(async ({ id, token }) => {
  const response = await fetch(`/api/claims/${id}/approve`, { method: 'POST', headers: { accept: 'application/json', 'x-csrf-token': token } });
  return response.status;
}, { id: claimId[0], token: csrf });
if (approved !== 200) throw new Error(`approve ${approved}`);

const auditor = await role('auditor', 'demo-auditor');
await auditor.page.setViewportSize({ width: 1280, height: 900 });
await auditor.page.goto(`${origin}/auditor/trace/${claimId[0]}`);
const trace = await auditor.page.content();
if (!trace.includes('6/8 = 75%')) throw new Error('missing 75%');
if (!trace.includes('File integrity checks')) throw new Error('missing integrity section');
if (!trace.includes('Evidence supporting the claim')) throw new Error('missing evidence section');
await auditor.page.screenshot({ path: `${out}/acceptance-6-auditor-trace.png`, fullPage: true });
console.log('acceptance passed', claimId[0]);
await browser.close();
if (local) local.close();
