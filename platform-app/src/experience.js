import { readableSchools } from './access.js';
import { esc } from './format.js';
import { all, get, insert } from './db.js';
import { listClaims } from './domain.js';
import { HttpError, notAvailable, notFound } from './http-error.js';

export function learnersForSchool(db, schoolId, { logging = false } = {}) {
  const rows = all(db, 'SELECT * FROM learners WHERE school_id = ? ORDER BY letter', [schoolId]);
  if (!logging) return rows;
  return rows.filter((row) => row.consent === 'active');
}

export function consentGaps(db, schoolIds) {
  if (!schoolIds.length) return [];
  return all(db, `SELECT * FROM learners WHERE school_id IN (${schoolIds.map(() => '?').join(',')}) AND consent != 'active' ORDER BY letter`, schoolIds);
}

export function joinCodeFor(db, cohortId) {
  return get(db, 'SELECT * FROM join_codes WHERE cohort_id = ?', [cohortId]);
}

export function fallingBehind(db, cohortId) {
  const row = get(db, 'SELECT * FROM season_progress WHERE cohort_id = ?', [cohortId]);
  if (!row) return null;
  return { ...row, behind: row.done < row.planned };
}

export function needsQueue(db, user, now) {
  const schools = readableSchools(db, user, typeof now === 'function' ? now() : now);
  const schoolName = (id) => get(db, 'SELECT display_name, country_name FROM schools WHERE id = ?', [id]);
  const teamName = (id) => (id === 'sch-tz-lakeside' ? 'Team Kilima' : 'Team Sunbird');
  const items = [];
  const waiting = listClaims(db, user, now).filter((row) => row.status === 'submitted')
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  for (const [index, claim] of waiting.entries()) {
    const school = schoolName(claim.school_id);
    const when = new Date(`${String(claim.activity_date || claim.submitted_at).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    items.push({
      id: `need-${claim.id}`,
      group: 'Blocking a team now',
      title: `Review ${claim.numerator} of ${claim.denominator} · ${teamName(claim.school_id)} · ${when}`,
      why: index === 0
        ? "Why first: it's the oldest waiting record. The team's season record can't be finished until it's reviewed."
        : `Why: ${claim.numerator} of ${claim.denominator} was sent without a photo and is waiting for approval.`,
      action: 'Approve',
      meta: `${teamName(claim.school_id)} · ${school?.country_name || ''} · Coach`,
    });
  }
  for (const schoolId of schools) {
    const cohort = get(db, 'SELECT id FROM cohorts WHERE school_id = ?', [schoolId]);
    if (!cohort) continue;
    const pace = fallingBehind(db, cohort.id);
    if (pace?.behind) {
      items.push({
        id: `need-pace-${cohort.id}`,
        group: 'Blocking a team now',
        title: `${teamName(schoolId)} is falling behind`,
        why: `Why: ${pace.done} of ${pace.planned} challenges are done, with ${pace.weeks_left} weeks left. Falling behind means fewer challenges than the season plan at this point.`,
        action: 'Message the coach',
        meta: `${teamName(schoolId)} · ${pace.done} of ${pace.planned}`,
      });
    }
  }
  for (const learner of consentGaps(db, schools)) {
    const missing = learner.consent !== 'expired';
    items.push({
      id: `need-${learner.id}`,
      group: 'Blocking a team now',
      title: missing ? `Consent missing for Student ${learner.letter}` : `Consent expired for Student ${learner.letter}`,
      why: `Why: Student ${learner.letter} is hidden from logging until consent is in.`,
      action: 'Ask the family',
      meta: `${teamName(learner.school_id)} · ${learner.consent}`,
    });
  }
  const renewing = schools.length
    ? all(db, `SELECT * FROM learners WHERE school_id IN (${schools.map(() => '?').join(',')}) AND consent = 'active' AND consent_until IS NOT NULL ORDER BY consent_until`, schools)
    : [];
  if (renewing[0]) {
    items.push({
      id: `need-renew-${renewing[0].id}`,
      group: 'Will block soon',
      title: `Family consent renews on ${renewing[0].consent_until}`,
      why: 'Why: if it lapses, that student is hidden from logging.',
      action: 'Send reminders',
      meta: teamName(renewing[0].school_id),
    });
  }
  for (const schoolId of schools) {
    const cohort = get(db, 'SELECT id FROM cohorts WHERE school_id = ?', [schoolId]);
    if (!cohort) continue;
    const pace = fallingBehind(db, cohort.id);
    if (pace && !pace.behind) {
      items.push({
        id: `need-ok-${cohort.id}`,
        group: 'Good to know',
        title: `${teamName(schoolId)} is on the season plan`,
        why: `Why: ${pace.done} of ${pace.planned} challenges are done. Moving them on is your call.`,
        action: 'Leave on Build',
        meta: teamName(schoolId),
      });
    }
  }
  return items;
}

export function saveSessionLog(db, user, input, now) {
  if (user.role !== 'coach') throw notAvailable();
  const membership = get(db, 'SELECT school_id, cohort_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  if (!membership) throw notFound();
  const letters = String(input.letters || '').split(',').map((part) => part.trim()).filter(Boolean);
  const allowed = new Set(learnersForSchool(db, membership.school_id, { logging: true }).map((row) => row.letter));
  for (const letter of letters) {
    if (!allowed.has(letter)) throw new HttpError(422, `Student ${letter} is hidden until consent is in.`);
  }
  const id = input.id || `slog-${Date.now()}`;
  const stamp = typeof now === 'function' ? now() : now;
  insert(db, 'session_logs', {
    id,
    school_id: membership.school_id,
    cohort_id: membership.cohort_id,
    coach_id: user.id,
    skills_json: JSON.stringify({ letters, skills: String(input.skills || '').split(',').filter(Boolean) }),
    created_at: stamp,
  });
  return get(db, 'SELECT * FROM session_logs WHERE id = ?', [id]);
}

export function liteHome(coachName, gaps) {
  const hidden = gaps.length ? `<p class="lm">${gaps.length} student${gaps.length === 1 ? '' : 's'} hidden until consent is in.</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AfroBot Lite</title><style>
body{margin:0;font-family:system-ui,sans-serif;color:#1A2230;font-size:16px;line-height:1.45}
a{color:#163A66}h1{font-size:20px;color:#0E2747;margin:0 0 8px}
.bar{display:flex;gap:8px;align-items:center;padding:8px 16px;border-bottom:1px solid #E3E7EC}
.tag{margin-left:auto;font-size:12px;font-weight:700;border:1px solid #6E7E94;padding:2px 8px}
.pad{padding:16px}.btn{display:flex;align-items:center;justify-content:center;min-height:56px;background:#0E2747;color:#fff;text-decoration:none;font-weight:700;border-radius:4px}
.note{margin-top:12px;padding:8px 12px;background:#FBF3E2;border-left:4px solid #8A5A00}
:focus-visible{outline:2px solid #0E2747;outline-offset:2px}
</style></head><body><div class="bar"><b>afrobot</b><span class="tag">Lite · data saver</span></div><div class="pad"><p>Coach ${esc(coachName)}. Fictional.</p><h1>Good afternoon</h1><a class="btn" href="/lite/log">Log a session</a>${hidden}<p class="note">You can send starters and completions without a photo. Pictures stay off until you tap them. A picture is about 40 KB. If this phone cannot keep a draft, keep this tab open or print the counts.</p><p>Preview v0.3</p></div></body></html>`;
}
