import { readableSchools } from './access.js';
import { all, get } from './db.js';
import { learnersForSchool } from './experience.js';
import { esc } from './format.js';
import { listGrants, meetingsFor, sessionBoard, sessionTotals } from './operations.js';

function page(title, home, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body><main id="main"><p><a href="${home}">Home</a></p>${body}<p>Preview v0.5</p></main></body></html>`;
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
      WHERE users.role = 'coach' AND (users.active IS NULL OR users.active = 1) AND schools.id IN (${allowed.map(() => '?').join(',')})
      ORDER BY schools.display_name, users.display_name`, allowed)
    : [];
  const coachOptions = coaches.map((row) => `<option value="${esc(row.id)}">${esc(row.display_name)} · ${esc(row.school_name)}</option>`).join('');
  const learners = allowed.length
    ? all(db, `SELECT id, letter, school_id FROM learners WHERE (active IS NULL OR active = 1) AND school_id IN (${allowed.map(() => '?').join(',')}) ORDER BY letter`, allowed)
    : [];
  const learnerOptions = learners.map((row) => `<option value="${esc(row.id)}">Student ${esc(row.letter)}</option>`).join('');
  const meetingOptions = meetingsFor(db, user, now).map((row) => `<option value="${esc(row.id)}">${esc(row.label)} · ${esc(row.meets_on)}</option>`).join('');
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
    </form>
    <form method="post" action="/organiser/admin/meetings/edit">${hidden(session)}
      <h2>Change a session</h2>
      <label>Session <select name="meetingId">${meetingOptions}</select></label>
      <label>New date <input name="meetsOn" placeholder="YYYY-MM-DD"></label>
      <label>New name <input name="label"></label>
      <button type="submit">Save session</button>
      <button type="submit" name="cancel" value="1">Cancel session</button>
    </form>
    <form method="post" action="/organiser/admin/deactivate">${hidden(session)}
      <h2>Deactivate</h2>
      <label>Coach <select name="coachId"><option value="">—</option>${coachOptions}</select></label>
      <label>Student <select name="learnerId"><option value="">—</option>${learnerOptions}</select></label>
      <button type="submit">Deactivate</button>
    </form>
    <p><a href="/organiser/grants">Auditor access</a> · <a href="/organiser/export.csv">Export CSV</a> · <a href="/help">How it works</a></p>`;
  return page('Add a club', '/organiser', body);
}

export function grantsPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p role="status">${esc(extras.notice)}</p>` : '';
  const schools = sessionTotals(db, user, now);
  const schoolOptions = schools.map((row) => `<option value="${esc(row.schoolId)}">${esc(row.displayName)}</option>`).join('');
  const auditors = all(db, `SELECT id, display_name, username FROM users WHERE role = 'auditor' AND (active IS NULL OR active = 1) ORDER BY display_name`);
  const auditorOptions = auditors.map((row) => `<option value="${esc(row.id)}">${esc(row.display_name)} · ${esc(row.username)}</option>`).join('');
  const grants = listGrants(db, user, now);
  const rows = grants.map((row) => `<tr><td>${esc(row.school_name)}</td><td>${esc(row.auditor_name)}</td><td>${esc(String(row.starts_at).slice(0, 10))} to ${esc(String(row.expires_at).slice(0, 10))}</td><td>${row.revoked_at ? 'Revoked' : 'Active'}</td><td>${row.revoked_at ? '' : `<form method="post" action="/organiser/grants/${esc(row.id)}/revoke">${hidden(session)}<button type="submit">Revoke</button></form>`}</td></tr>`).join('');
  const body = `${error}${notice}<h1>Auditor access</h1>
    <p>A grant lets that auditor read one club between two dates. Revoking hides the club again. Earlier records stay in the audit log.</p>
    <form method="post" action="/organiser/grants">${hidden(session)}
      <label>Auditor <select name="auditorId">${auditorOptions}</select></label>
      <label>Club <select name="schoolId">${schoolOptions}</select></label>
      <label>From <input name="startsOn" required placeholder="YYYY-MM-DD"></label>
      <label>Until <input name="expiresOn" required placeholder="YYYY-MM-DD"></label>
      <button type="submit">Grant read access</button>
    </form>
    <table><thead><tr><th>Club</th><th>Auditor</th><th>Period</th><th>State</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  return page('Auditor access', '/organiser', body);
}

export function helpPage(user) {
  const blocks = {
    coach: `<h1>How it works for a coach</h1>
      <ol>
        <li>Sign in.</li>
        <li>Open Capture a session and pick the session for your club.</li>
        <li>Mark each student present or absent. Students without consent, and deactivated students, are not on the list.</li>
        <li>Enter starters, completions, the project result, and a short note. Do not add names or photos.</li>
        <li>Send. Sent means the server stored one record. If you are offline, it stays Pending sync until you retry.</li>
        <li>If the organiser sends it back, Session history says Needs attention and shows the reason. Fix and resubmit. That makes a new version and keeps the old one.</li>
        <li>Overdue means the date passed and nothing was sent. Falling behind means fewer captured sessions than the season plan calls for by today.</li>
      </ol>`,
    organiser: `<h1>How it works for an organiser</h1>
      <ol>
        <li>Add a club, its reporting period, a coach, a student, and a session. You can change or cancel a session later. Cancelling keeps any record already sent.</li>
        <li>Deactivate a coach or student when they leave. They cannot sign in or be marked. Their old records stay.</li>
        <li>What needs me and Session tracking use the same approve and send-back actions. Send back needs a reason.</li>
        <li>Overdue sessions and falling behind are calculated from the schedule and the captured sessions.</li>
        <li>Grant an auditor read access to a club and a period, including a club you just added. Revoke ends that access.</li>
        <li>Export CSV downloads sessions, attendance, and approved figures for one club.</li>
      </ol>`,
    auditor: `<h1>How it works for an auditor</h1>
      <ol>
        <li>You can read only the clubs an organiser granted, and only during that period.</li>
        <li>Open a trace to see the figure, the reporting period, the approved version, and the redacted note.</li>
        <li>File integrity checks are separate from the evidence note.</li>
        <li>You cannot submit, approve, or change a record.</li>
      </ol>`,
    student: `<h1>How it works for a student or family</h1>
      <ol>
        <li>Sign in with the family join code account your organiser gave you.</li>
        <li>This week shows how many captured sessions you were marked present for.</li>
        <li>You cannot open another club's records.</li>
      </ol>`,
  };
  return page('How it works', user.role === 'organiser' ? '/organiser' : user.role === 'auditor' ? '/auditor' : user.role === 'student' ? '/student' : '/coach', blocks[user.role] || blocks.coach);
}
