import { createRequire } from 'node:module';
const { chromium } = createRequire('/tmp/pw/package.json')('playwright-core');
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { start } from '../src/server.js';

const out = '/opt/cursor/artifacts';
const local = await start({ port: 0, dbPath: ':memory:', demoSeed: true });
const origin = local.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await context.newPage();
await page.goto(`${origin}/login`);
await page.screenshot({ path: `${out}/v06-1-sign-in.png`, fullPage: true });
await page.fill('#username', 'organiser');
await page.fill('#password', 'demo-organiser');
await page.click('button[type="submit"]');
await page.waitForURL(/\/organiser/);
await page.goto(`${origin}/organiser/invites`);
await page.fill('input[name="displayName"]', 'Coach New');
await page.fill('input[name="username"]', 'coach-shot');
await page.fill('input[name="schoolId"]', 'sch-cm-north');
await page.click('button[type="submit"]');
await page.screenshot({ path: `${out}/v06-2-invite.png`, fullPage: true });
const link = await page.locator('a').nth(0).getAttribute('href');
await page.goto(`${origin}${link}`);
await page.screenshot({ path: `${out}/v06-3-invite-accept.png`, fullPage: true });
await page.fill('input[name="password"]', 'coach-shot-pass');
await page.click('button[type="submit"]');
await context.clearCookies();
await page.goto(`${origin}/login`);
const setup = await page.evaluate(async () => {
  const dbNote = await fetch('/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ username: 'organiser', password: 'demo-organiser' }),
  });
  const body = await dbNote.json();
  const started = await fetch('/api/mfa/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': body.csrf },
  });
  return started.json();
});
await page.setContent(`<!doctype html><html><body><main><h1>Authenticator setup</h1><p>Scan this address in an authenticator app.</p><p>${setup.uri}</p><p>Secret ${setup.secret}</p><p>Recovery codes, shown once: ${setup.recoveryCodes.join(' ')}</p><p>Preview v0.6</p></main></body></html>`);
await page.screenshot({ path: `${out}/v06-4-mfa.png`, fullPage: true });
const code = await createOTP(base32.decode(setup.secret)).totp();
await page.goto(`${origin}/login`);
await page.evaluate(async (code) => {
  await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'organiser', password: 'demo-organiser', code }) });
}, code);
await context.clearCookies();
await page.goto(`${origin}/login`);
await page.fill('#username', 'student-a');
await page.fill('#password', 'demo-student-a');
await page.click('button[type="submit"]');
await page.waitForURL(/\/student/);
await page.goto(`${origin}/student/family`);
await page.screenshot({ path: `${out}/v06-5-guardian.png`, fullPage: true });
await context.clearCookies();
await page.goto(`${origin}/login`);
await page.fill('#username', 'organiser');
await page.fill('#password', 'demo-organiser');
await page.fill('#code', code);
await page.click('button[type="submit"]');
await page.waitForURL(/\/organiser/);
await page.goto(`${origin}/audit`);
await page.screenshot({ path: `${out}/v06-6-audit.png`, fullPage: true });
console.log('v06 shots ready');
await browser.close();
local.close();
