import assert from 'node:assert/strict';
import test from 'node:test';
import { api, demo, login, page } from './helpers.js';

test('each role home is a short visual page with one next step', async () => {
  const app = await demo();
  try {
    const coach = await login(app.url, 'coach-a', 'demo-coach-a');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const student = await login(app.url, 'student-a', 'demo-student-a');
    const coachHtml = await page(app.url, coach, '/coach');
    const organiserHtml = await page(app.url, organiser, '/organiser');
    const auditorHtml = await page(app.url, auditor, '/auditor');
    const studentHtml = await page(app.url, student, '/student');
    for (const html of [coachHtml, organiserHtml, auditorHtml, studentHtml]) {
      assert.equal(html.status, 200);
      assert.match(html.text, /class="mark"/);
      assert.match(html.text, /alt="afrobot"/);
      assert.match(html.text, /Public Sans|font-family:PS/);
      assert.doesNotMatch(html.text, /Fredoka|#FFC531/);
      assert.match(html.text, /class="chip/);
      assert.equal((html.text.match(/<h1\b/g) || []).length, 1);
    }
    assert.match(coachHtml.text, /Log a session/);
    assert.match(coachHtml.text, /NRLC-4821/);
    assert.equal(coachHtml.text.includes('Audit log'), false);
    assert.match(studentHtml.text, /Your journey/);
    assert.match(studentHtml.text, /You are here/);
    assert.equal(studentHtml.text.includes('Audit log'), false);
    assert.match(organiserHtml.text, /What needs me/);
    assert.equal(organiserHtml.text.includes('Audit log'), false);
    assert.match(auditorHtml.text, /Export pack/);
    const demoCoach = await page(app.url, coach, '/demo');
    const demoOrg = await page(app.url, organiser, '/demo');
    const demoStudent = await page(app.url, student, '/demo');
    assert.match(demoCoach.text, /show how/);
    assert.match(demoCoach.text, /class="wizard"/);
    assert.match(demoCoach.text, /class="timeline"/);
    assert.match(demoCoach.text, /5\/8 = 62\.5%/);
    assert.match(demoOrg.text, /Approve/);
    assert.match(demoStudent.text, /Save draft/);
    const font = await api(app.url, coach, 'GET', '/fonts/PublicSans-VF.woff2');
    assert.equal(font.status, 200);
    assert.match(font.headers.get('content-type'), /font\/woff2/);
  } finally {
    await app.stop();
  }
});
