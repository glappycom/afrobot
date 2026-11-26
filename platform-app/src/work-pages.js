import { readableSchools } from './access.js';
import { all, get } from './db.js';
import { learnersForSchool } from './experience.js';
import { esc } from './format.js';
import { meetingsFor, sessionBoard, sessionTotals } from './operations.js';

function page(title, home, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body><main id="main"><p><a href="${home}">Home</a></p>${body}<p>Preview v0.4</p></main></body></html>`;
}

function hidden(session) {
  return `<input type="hidden" name="csrf" value="${esc(session.csrf)}">`;
}

export function capturePage(db, user, now, session, extras = {}) {
  const meetings = meetingsFor(db, user, now);
  const membership = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const learners = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const error = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const options = meetings.map((meeting) => `<option value="${esc(meeting.id)}">${esc(meeting.label)} · ${esc(meeting.meets_on)}</option>`).join('');
  const marks = learners.map((row) => `<fieldset><legend>Student ${esc(row.letter)}</legend>
    <label><input type="radio" name="mark-${esc(row.id)}" value="present" required> Present</label>
    <label><input type="radio" name="mark-${esc(row.id)}" value="absent"> Absent</label>
    </fieldset>`).join('');
  const body = `${error}<h1>Capture a session</h1>
    <p>No photo. Mark each student, then enter starters, completions, the project result, and a short note.</p>
    <p id="sync-status" role="status">Saved on this device</p>
    <p id="sync-detail"></p>
    <form id="capture-form" method="post" action="/coach/captures">${hidden(session)}
      <label for="meetingId">Session</label>
      <select id="meetingId" name="meetingId" required>${options || '<option value="">No session scheduled</option>'}</select>
      ${marks || '<p>No student with consent is on this club yet.</p>'}
      <label for="denominator">Starters</label><input id="denominator" name="denominator" inputmode="numeric" required>
      <label for="numerator">Completions</label><input id="numerator" name="numerator" inputmode="numeric" required>
      <label for="projectResult">Project result</label><input id="projectResult" name="projectResult" required>
      <label for="note">Note</label><input id="note" name="note" required>
      <input type="hidden" id="idempotencyKey" name="idempotencyKey" value="">
      <p><button id="submit-capture" type="submit">Send</button></p>
      <p><button id="retry-capture" type="button">Retry</button></p>
      <div id="paper-fallback" hidden><p>This browser cannot store the draft. Keep this tab open, or print this page and enter the same counts when you are back online.</p></div>
    </form>
    <script src="/capture.js"></script>`;
  return page('Capture a session', '/coach', body);
}

export function fixPage(db, user, session, claim, extras = {}) {
  const error = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const membership = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const learners = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const marks = learners.map((row) => `<fieldset><legend>Student ${esc(row.letter)}</legend>
    <label><input type="radio" name="mark-${esc(row.id)}" value="present" required> Present</label>
    <label><input type="radio" name="mark-${esc(row.id)}" value="absent"> Absent</label>
    </fieldset>`).join('');
  const body = `${error}<h1>Fix and resubmit</h1>
    <p>Needs attention. ${esc(claim.return_note || '')}</p>
    <p>Version ${esc(claim.version)} stays as ${esc(claim.numerator)} of ${esc(claim.denominator)}. This sends a new version.</p>
    <form method="post" action="/coach/claims/${esc(claim.id)}/resubmit">${hidden(session)}
      ${marks}
      <label for="denominator">Starters</label><input id="denominator" name="denominator" inputmode="numeric" value="${esc(claim.denominator)}" required>
      <label for="numerator">Completions</label><input id="numerator" name="numerator" inputmode="numeric" value="${esc(claim.numerator)}" required>
      <label for="projectResult">Project result</label><input id="projectResult" name="projectResult" value="${esc(claim.project_result || '')}" required>
      <label for="note">Note</label><input id="note" name="note" value="${esc(claim.coach_note || '')}" required>
      <p><button type="submit">Resubmit</button></p>
    </form>`;
  return page('Fix a session', '/coach/logs', body);
}

export function trackingPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p role="status">${esc(extras.notice)}</p>` : '';
  const rows = sessionBoard(db, user, now);
  const totals = sessionTotals(db, user, now);
  const totalText = totals.map((row) => `${esc(row.displayName)}: ${row.sessions ? esc(row.label) : 'no approved sessions yet'} from ${esc(row.sessions)} approved session${row.sessions === 1 ? '' : 's'}`).join('<br>');
  const bodyRows = rows.map((row) => {
    const action = row.status === 'Pending review'
      ? `<form method="post" action="/organiser/claims/${esc(row.claimId)}/approve">${hidden(session)}<button type="submit">Approve</button></form>
         <form method="post" action="/organiser/claims/${esc(row.claimId)}/return">${hidden(session)}<label>Reason <input name="note" required></label><button type="submit">Send back</button></form>`
      : '';
    return `<tr><td>${esc(row.schoolName)}</td><td>${esc(row.coachName)}</td><td>${esc(row.week)}</td><td>${esc(row.label)} · ${esc(row.meetsOn)}</td><td>${esc(row.status)}</td><td>${esc(row.figure || '')}</td><td>${esc(row.why || '')}</td><td>${action}</td></tr>`;
  }).join('');
  const body = `${error}${notice}<h1>Session tracking</h1>
    <p>Completion rate is the sum of the latest approved version of each session.</p>
    <p>${totalText}</p>
    <table><thead><tr><th>Club</th><th>Coach</th><th>Week</th><th>Session</th><th>Status</th><th>Figure</th><th>Why</th><th></th></tr></thead><tbody>${bodyRows}</tbody></table>
    <p><a href="/audit">Audit log</a> · <a href="/organiser/admin">Add a club or session</a></p>`;
  return page('Session tracking', '/organiser', body);
}

export function adminPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p role="status">${esc(extras.notice)}</p>` : '';
  const schools = sessionTotals(db, user, now);
  const schoolOptions = schools.map((row) => `<option value="${esc(row.schoolId)}">${esc(row.displayName)}</option>`).join('');
  const allowed = readableSchools(db, user, typeof now === 'function' ? now() : now);
  const coaches = allowed.length
    ? all(db, `SELECT users.id, users.display_name, schools.display_name AS school_name FROM users
      JOIN memberships ON memberships.user_id = users.id AND memberships.role = 'coach'
      JOIN schools ON schools.id = memberships.school_id
      WHERE users.role = 'coach' AND schools.id IN (${allowed.map(() => '?').join(',')})
      ORDER BY schools.display_name, users.display_name`, allowed)
    : [];
  const coachOptions = coaches.map((row) => `<option value="${esc(row.id)}">${esc(row.display_name)} · ${esc(row.school_name)}</option>`).join('');
  const body = `${error}${notice}<h1>Add a club, coach, student, or session</h1>
    <form method="post" action="/organiser/admin/clubs">${hidden(session)}
      <h2>Club</h2>
      <label>Name <input name="displayName" required></label>
      <label>Country <input name="countryName" required></label>
      <label>Team <input name="label" required></label>
      <label>Period start <input name="windowStart" required placeholder="YYYY-MM-DD"></label>
      <label>Period end <input name="windowEnd" required placeholder="YYYY-MM-DD"></label>
      <button type="submit">Add club</button>
    </form>
    <form method="post" action="/organiser/admin/period">${hidden(session)}
      <h2>Reporting period</h2>
      <label>Club <select name="schoolId">${schoolOptions}</select></label>
      <label>Start <input name="windowStart" required></label>
      <label>End <input name="windowEnd" required></label>
      <button type="submit">Save period</button>
    </form>
    <form method="post" action="/organiser/admin/coaches">${hidden(session)}
      <h2>Coach</h2>
      <label>Club <select name="schoolId">${schoolOptions}</select></label>
      <label>Name <input name="displayName" required></label>
      <label>Username <input name="username" required></label>
      <label>Password <input name="password" type="password" required></label>
      <button type="submit">Add coach</button>
    </form>
    <form method="post" action="/organiser/admin/learners">${hidden(session)}
      <h2>Student</h2>
      <label>Club <select name="schoolId">${schoolOptions}</select></label>
      <label>Letter <input name="letter" maxlength="1" required></label>
      <label>Consent <select name="consent"><option value="active">active</option><option value="missing">missing</option></select></label>
      <button type="submit">Add student</button>
    </form>
    <form method="post" action="/organiser/admin/meetings">${hidden(session)}
      <h2>Session</h2>
      <label>Club <select name="schoolId">${schoolOptions}</select></label>
      <label>Coach <select name="coachId">${coachOptions}</select></label>
      <label>Date <input name="meetsOn" required placeholder="YYYY-MM-DD"></label>
      <label>Name <input name="label" required></label>
      <button type="submit">Add session</button>
    </form>`;
  return page('Add a club', '/organiser', body);
}
