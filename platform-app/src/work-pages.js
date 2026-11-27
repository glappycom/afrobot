import { readableSchools } from './access.js';
import { all, get } from './db.js';
import { learnersForSchool } from './experience.js';
import { esc } from './format.js';
import { listGrants, meetingsFor, sessionBoard, sessionTotals } from './operations.js';
import { consentLabel, listClaimPhotos, photoCapacity } from './photos.js';
import { productShell } from './screens.js';

function page(title, user, session, section, body) {
  return productShell({ title, user, session, section, body });
}

function chip(status) {
  const kind = status === 'Pending review' ? 'p-sent'
    : status === 'Needs attention' ? 'p-fix'
      : status === 'Sent' || status === 'Approved' ? 'p-ok'
        : status === 'Cancelled' ? 'p-sup'
          : 'p-draft';
  return `<span class="pill ${kind}">${esc(status)}</span>`;
}

function hidden(session) {
  return `<input type="hidden" name="csrf" value="${esc(session.csrf)}">`;
}

function fold(title, hint, inner) {
  return `<details class="fold"><summary><span><b>${title}</b><small>${hint}</small></span><svg class="i sm chev" aria-hidden="true"><use href="#i-chev"/></svg></summary><div class="foldbody">${inner}</div></details>`;
}

function statusChip(label = 'Draft') {
  const kind = String(label).toLowerCase().replace(/\s+/g, '-');
  const icon = label === 'Sent' ? 'check' : label === 'Failed' ? 'alert' : label === 'Pending sync' ? 'clock' : label === 'Sending' ? 'hist' : 'file';
  return `<p id="sync-status" class="statuschip s-${kind}" role="status"><svg class="i sm" aria-hidden="true"><use href="#i-${icon}"/></svg><span>${esc(label)}</span></p>`;
}

export function capturePage(db, user, now, session, extras = {}) {
  const meetings = meetingsFor(db, user, now);
  const membership = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const learners = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const room = photoCapacity();
  const options = meetings.map((meeting) => `<option value="${esc(meeting.id)}">${esc(meeting.label)} · ${esc(meeting.meets_on)}</option>`).join('');
  const marks = roster(learners);
  const body = `${error}<div class="ph"><div><h1>Log a session</h1><p>Record what happened. A photo is optional.</p>${statusChip('Draft')}</div></div>
    <p id="sync-detail" class="statusline"></p>
    <form id="capture-form" class="stack" method="post" action="/coach/captures">${hidden(session)}
      <div class="pair">
        <label for="denominator">Starters <span>Who began the session</span><span class="stepper"><button type="button" data-step="denominator" data-dir="-1" aria-label="Fewer starters">−</button><input id="denominator" name="denominator" inputmode="numeric" size="3" value="0" required><button type="button" data-step="denominator" data-dir="1" aria-label="More starters">+</button></span></label>
        <label for="numerator">Completions <span>Who finished the task</span><span class="stepper"><button type="button" data-step="numerator" data-dir="-1" aria-label="Fewer completions">−</button><input id="numerator" name="numerator" inputmode="numeric" size="3" value="0" required><button type="button" data-step="numerator" data-dir="1" aria-label="More completions">+</button></span></label>
      </div>
      <label for="projectResult">Project result <span>What the team finished</span><input id="projectResult" class="field" name="projectResult" required></label>
      <h2>Attendance</h2>
      <p>Mark each student who can be included in the count.</p>
      ${marks || '<p class="empty">No student with consent is on this club yet.</p>'}
      <label class="checkrow" for="no-photo"><input id="no-photo" name="noPhoto" type="checkbox" checked><span>No photo for this session</span></label>
      ${fold('Notes', 'Optional', '<label for="note">Note <span>No student names</span><textarea id="note" class="field" name="note" rows="3">Session log.</textarea></label>')}
      ${fold('Photos', 'Optional', photoFields(learners, room))}
      ${fold('More details', 'Optional', `<label for="meetingId">Session</label><select id="meetingId" class="field" name="meetingId" required>${options || '<option value="">No session scheduled</option>'}</select>`)}
      <input type="hidden" id="idempotencyKey" name="idempotencyKey" value="">
      <div class="actions sendbar"><button id="submit-capture" class="btn p" type="submit">Send</button><button id="retry-capture" class="btn g" type="button" hidden>Retry</button></div>
      <div id="paper-fallback" hidden><p>This browser cannot store the draft. Keep this tab open, or print this page and enter the same counts when you are back online.</p></div>
    </form>
    <script type="module" src="/capture.js"></script>`;
  return page('Log a session', user, session, 'log', body);
}

function roster(learners) {
  return `<div class="roster">${learners.map((row) => `<div class="roster-row"><b>Student ${esc(row.letter)}</b><div class="seg" role="radiogroup" aria-label="Student ${esc(row.letter)}"><label><input type="radio" name="mark-${esc(row.id)}" value="present" required> Present</label><label><input type="radio" name="mark-${esc(row.id)}" value="absent"> Absent</label></div></div>`).join('')}</div>`;
}

export function fixPage(db, user, session, claim, extras = {}) {
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const membership = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const learners = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const body = `${error}<div class="ph"><div><h1>Fix and resubmit</h1><p class="statuschip s-failed"><svg class="i sm" aria-hidden="true"><use href="#i-alert"/></svg><span>Needs attention</span></p><p>${esc(claim.return_note || '')}</p></div></div>
    <p>Version ${esc(claim.version)} stays as ${esc(claim.numerator)} of ${esc(claim.denominator)}. This sends a new version. Photos already on this version stay with it.</p>
    <p id="photo-status" class="statusline" role="status"></p>
    <form id="fix-form" class="stack" method="post" action="/coach/claims/${esc(claim.id)}/resubmit">${hidden(session)}
      <div class="pair">
        <label for="denominator">Starters<span class="stepper"><button type="button" data-step="denominator" data-dir="-1" aria-label="Fewer starters">−</button><input id="denominator" name="denominator" inputmode="numeric" value="${esc(claim.denominator)}" required><button type="button" data-step="denominator" data-dir="1" aria-label="More starters">+</button></span></label>
        <label for="numerator">Completions<span class="stepper"><button type="button" data-step="numerator" data-dir="-1" aria-label="Fewer completions">−</button><input id="numerator" name="numerator" inputmode="numeric" value="${esc(claim.numerator)}" required><button type="button" data-step="numerator" data-dir="1" aria-label="More completions">+</button></span></label>
      </div>
      <label for="projectResult">Project result<input id="projectResult" class="field" name="projectResult" value="${esc(claim.project_result || '')}" required></label>
      <h2>Attendance</h2>
      ${roster(learners)}
      ${fold('Notes', 'Optional', `<label for="note">Note <span>No student names</span><textarea id="note" class="field" name="note" rows="3" required>${esc(claim.coach_note || '')}</textarea></label>`)}
      ${fold('Photos', 'Optional', photoFields(learners, photoCapacity()))}
      <div class="actions sendbar"><button class="btn p" type="submit">Send</button></div>
    </form>
    <script type="module" src="/capture.js"></script>`;
  return page('Fix a session', user, session, 'logs', body);
}

function photoFields(learners, room) {
  const tags = learners.map((row) => `<label class="tag"><input type="checkbox" name="photoLearner" value="${esc(row.id)}"><span>Student ${esc(row.letter)}</span></label>`).join('');
  return `<fieldset class="photo-box"><legend>Private photo</legend>
    <p>JPEG, PNG, or WebP, up to 5 MB. About ${esc(room.photosPerClub)} photos fit in this club. The picture is never on a public link.</p>
    <label class="drop" for="photo-file"><input id="photo-file" name="photo" type="file" accept="image/jpeg,image/png,image/webp"><span>Drop a photo here, or click to choose</span><img id="photo-preview" alt="" hidden></label>
    <label class="tag on"><input id="photo-none" name="noStudents" type="checkbox" checked><span>No students shown</span></label>
    <div class="tags">${tags}</div>
  </fieldset>`;
}

export function sessionPhotoPage(db, user, session, claim, extras = {}) {
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const photos = listClaimPhotos(db, user, claim.id, new Date().toISOString());
  const learners = learnersForSchool(db, claim.school_id, { logging: true });
  const items = photos.map((row) => `<li class="logcard"><img src="/photos/${esc(row.id)}" alt="Private photo" width="160"><span>${row.noStudents ? 'No students shown' : row.letters.map((letter) => `Student ${esc(letter)}`).join(', ')}</span>${user.role === 'coach' && claim.status !== 'approved' ? `<form method="post" action="/coach/photos/${esc(row.id)}/remove">${hidden(session)}<button class="btn o" type="submit">Remove</button></form>` : ''}${user.role === 'organiser' && claim.status === 'approved' ? `<form method="post" action="/organiser/photos/${esc(row.id)}/remove">${hidden(session)}<label>Reason <input class="field" name="reason" required></label><button class="btn o" type="submit">Remove</button></form>` : ''}</li>`).join('');
  const upload = user.role === 'coach' && claim.status === 'submitted'
    ? `<form id="session-photo-form" method="post" action="/coach/claims/${esc(claim.id)}/photos">${hidden(session)}
      ${photoFields(learners, photoCapacity())}
      <p><button type="submit">Add photo</button></p>
    </form><script type="module" src="/capture.js"></script>`
    : '';
  const body = `${error}<div class="ph"><div><h1>Session detail</h1><p>Photos on version ${esc(claim.version)}. Sending a new version keeps them here.</p></div></div>
    <ul class="loglist">${items || '<li class="empty">No photo on this version.</li>'}</ul>
    ${upload}`;
  return page('Session photos', user, session, user.role === 'organiser' ? 'tracking' : 'logs', body);
}

export function trackingPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p class="status" role="status">${esc(extras.notice)}</p>` : '';
  const rows = sessionBoard(db, user, now);
  const totals = sessionTotals(db, user, now);
  const filtered = rows.filter((row) => (!extras.status || row.status === extras.status) && (!extras.school || row.schoolId === extras.school));
  const cards = totals.map((row) => {
    const mine = rows.filter((item) => item.schoolId === row.schoolId);
    const count = (status) => mine.filter((item) => item.status === status).length;
    const rate = row.sessions ? esc(row.label) : 'No approved rate yet';
    return `<article class="statcard"><h2>${esc(row.displayName)}</h2><p class="bigline">${rate}</p><p>${esc(row.sessions)} approved session${row.sessions === 1 ? '' : 's'}</p><p>Missing ${count('Missing')} · Pending ${count('Pending review')} · Needs attention ${count('Needs attention')} · Sent ${count('Sent')}</p></article>`;
  }).join('');
  const filters = ['', 'Missing', 'Pending review', 'Needs attention', 'Sent', 'Cancelled'].map((status) => {
    const label = status || 'All';
    const on = (extras.status || '') === status;
    const href = status ? `/organiser/tracking?status=${encodeURIComponent(status)}` : '/organiser/tracking';
    return `<a class="fchip ${on ? 'on' : ''}" href="${href}">${esc(label)}</a>`;
  }).join('');
  const bodyRows = filtered.map((row) => {
    const open = row.claimId ? `<a class="btn g sm" href="/organiser/sessions/${esc(row.claimId)}">Open</a>` : '';
    const action = row.status === 'Pending review'
      ? `<form method="post" action="/organiser/claims/${esc(row.claimId)}/approve">${hidden(session)}<button class="btn p sm" type="submit">Approve</button></form>
         <details><summary>Return</summary><form method="post" action="/organiser/claims/${esc(row.claimId)}/return">${hidden(session)}<label>Reason <input name="note" required></label><button class="btn o sm" type="submit">Return with this reason</button></form></details>`
      : open;
    return `<tr><td>${esc(row.schoolName)}</td><td>${esc(row.coachName)}</td><td>${esc(row.week)}</td><td>${esc(row.label)} · ${esc(row.meetsOn)}</td><td>${chip(row.status)}</td><td>${esc(row.figure || '—')}</td><td>${esc(row.why || '—')}</td><td class="rowacts">${action}</td></tr>`;
  }).join('');
  const body = `${error}${notice}<div class="ph"><div><h1>Session tracking</h1><p>Completion rate is the sum of the latest approved version of each session.</p></div></div>
    <div class="statgrid">${cards}</div>
    <div class="filters" role="toolbar" aria-label="Filter sessions">${filters}</div>
    ${filtered.length ? `<table><thead><tr><th>Club</th><th>Coach</th><th>Week</th><th>Session</th><th>Status</th><th>Figure</th><th>Why</th><th>Action</th></tr></thead><tbody>${bodyRows}</tbody></table>` : '<p class="empty">Nothing matches this filter.</p>'}`;
  return page('Session tracking', user, session, 'tracking', body);
}

export function adminPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p class="status" role="status">${esc(extras.notice)}</p>` : '';
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
  const tab = extras.tab || 'clubs';
  const tabLink = (id, label) => `<a class="fchip ${tab === id ? 'on' : ''}" href="/organiser/admin?tab=${id}">${label}</a>`;
  const clubRows = schools.map((row) => `<tr><td>${esc(row.displayName)}</td><td>${esc(row.sessions)} approved</td><td>${row.label ? esc(row.label) : '—'}</td></tr>`).join('');
  const coachRows = coaches.map((row) => `<tr><td>${esc(row.display_name)}</td><td>${esc(row.school_name)}</td></tr>`).join('');
  const learnerRows = learners.map((row) => `<tr><td>Student ${esc(row.letter)}</td><td>${esc(consentLabel(db, row.id).status)}</td><td>${esc(consentLabel(db, row.id).text)}</td></tr>`).join('');
  const body = `${error}${notice}<div class="ph"><div><h1>Admin</h1><p>Add a club, a period, a person, or a session.</p></div></div>
    <nav class="filters" aria-label="Admin sections">${tabLink('clubs', 'Clubs')}${tabLink('periods', 'Periods')}${tabLink('people', 'People')}${tabLink('sessions', 'Sessions')}${tabLink('consent', 'Photo permission')}${tabLink('deactivate', 'Deactivate')}</nav>
    <section class="${tab === 'clubs' ? '' : 'off'}"><h2>Clubs</h2><table><thead><tr><th>Club</th><th>Approved sessions</th><th>Rate</th></tr></thead><tbody>${clubRows || '<tr><td colspan="3">No club yet.</td></tr>'}</tbody></table>
      <details><summary>Add a club</summary><form method="post" action="/organiser/admin/clubs">${hidden(session)}
        <label>Name <input class="field" name="displayName" required></label>
        <label>Country <input class="field" name="countryName" required></label>
        <label>Team <input class="field" name="label" required></label>
        <label>Period start <input class="field" name="windowStart" type="date" required></label>
        <label>Period end <input class="field" name="windowEnd" type="date" required></label>
        <button class="btn p" type="submit">Add club</button>
      </form></details></section>
    <section class="${tab === 'periods' ? '' : 'off'}"><h2>Periods</h2>
      <details open><summary>Save a reporting period</summary><form method="post" action="/organiser/admin/period">${hidden(session)}
        <label>Club <select class="field" name="schoolId">${schoolOptions}</select></label>
        <label>Start <input class="field" name="windowStart" type="date" required></label>
        <label>End <input class="field" name="windowEnd" type="date" required></label>
        <button class="btn p" type="submit">Save period</button>
      </form></details></section>
    <section class="${tab === 'people' ? '' : 'off'}"><h2>People</h2><table><thead><tr><th>Coach</th><th>Club</th></tr></thead><tbody>${coachRows}</tbody></table>
      <details><summary>Create invite link</summary><form method="post" action="/organiser/invites">${hidden(session)}
        <input type="hidden" name="role" value="coach">
        <label>Club <select class="field" name="schoolId">${schoolOptions}</select></label>
        <label>Name <input class="field" name="displayName" required></label>
        <label>Username <input class="field" name="username" required></label>
        <button class="btn p" type="submit">Create invite link</button>
      </form></details>
      <details><summary>Add a student</summary><form method="post" action="/organiser/admin/learners">${hidden(session)}
        <label>Club <select class="field" name="schoolId">${schoolOptions}</select></label>
        <label>Letter <input class="field" name="letter" maxlength="1" required></label>
        <label>Logging consent <select class="field" name="consent"><option value="active">active</option><option value="missing">missing</option></select></label>
        <button class="btn p" type="submit">Add student</button>
      </form></details></section>
    <section class="${tab === 'sessions' ? '' : 'off'}"><h2>Sessions</h2>
      <details open><summary>Add a session</summary><form method="post" action="/organiser/admin/meetings">${hidden(session)}
        <label>Club <select class="field" name="schoolId">${schoolOptions}</select></label>
        <label>Coach <select class="field" name="coachId">${coachOptions}</select></label>
        <label>Date <input class="field" name="meetsOn" type="date" required></label>
        <label>Name <input class="field" name="label" required></label>
        <button class="btn p" type="submit">Add session</button>
      </form></details>
      <details><summary>Change a session</summary><form method="post" action="/organiser/admin/meetings/edit">${hidden(session)}
        <label>Session <select class="field" name="meetingId">${meetingOptions}</select></label>
        <label>New date <input class="field" name="meetsOn" type="date"></label>
        <label>New name <input class="field" name="label"></label>
        <button class="btn p" type="submit">Save session</button>
        <button class="btn o" type="submit" name="cancel" value="1">Cancel session</button>
      </form></details></section>
    <section class="${tab === 'consent' ? '' : 'off'}"><h2>Photo permission</h2>
      <table><thead><tr><th>Student</th><th>Status</th><th>Record</th></tr></thead><tbody>${learnerRows}</tbody></table>
      <details><summary>Record photo consent</summary><form method="post" action="/organiser/photo-consent">${hidden(session)}
        <label>Student <select class="field" name="learnerId">${learnerOptions}</select></label>
        <button class="btn p" type="submit">Record photo consent</button>
      </form></details></section>
    <section class="${tab === 'deactivate' ? '' : 'off'}"><h2>Deactivate</h2>
      <form method="post" action="/organiser/admin/deactivate">${hidden(session)}
        <label>Coach <select class="field" name="coachId"><option value="">—</option>${coachOptions}</select></label>
        <label>Student <select class="field" name="learnerId"><option value="">—</option>${learnerOptions}</select></label>
        <button class="btn p" type="submit">Deactivate</button>
      </form></section>`;
  return page('Admin', user, session, 'admin', body);
}

export function grantsPage(db, user, now, session, extras = {}) {
  const error = extras.error ? `<p class="alert" role="alert">${esc(extras.error)}</p>` : '';
  const notice = extras.notice ? `<p class="status" role="status">${esc(extras.notice)}</p>` : '';
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
  return page('Auditor access', user, session, 'grants', body);
}

export function helpPage(user, session = { csrf: '' }) {
  const blocks = {
    coach: `<h1>How it works for a coach</h1>
      <ol>
        <li>Sign in.</li>
        <li>Open Log a session. Enter starters, completions, and the project result, then mark attendance. Notes and photos are optional. Choose "No photo for this session" to send without opening the photo controls.</li>
        <li>Mark each student present or absent. Students without consent, and deactivated students, are not on the list.</li>
        <li>Enter starters, completions, the project result, and a short note. Do not add names.</li>
        <li>A photo is optional. Use JPEG, PNG, or WebP. Tag the students in the picture, or mark that no students are shown. The server checks the real file type, shrinks it, and removes location data. If a tagged student has no photo consent, the upload is blocked and the reason is shown.</li>
        <li>Send. Sent means the server stored one record. If you are offline, it stays Pending sync until you retry. Photos stay on the version you sent them with.</li>
        <li>You can remove your own photo before approval. After approval, only the organiser can remove it, and they record a reason.</li>
        <li>If the organiser sends it back, Session history says Needs attention and shows the reason. Fix and resubmit. That makes a new version and keeps the old one, including its photos.</li>
        <li>Overdue means the date passed and nothing was sent. Falling behind means fewer captured sessions than the season plan calls for by today.</li>
      </ol>`,
    organiser: `<h1>How it works for an organiser</h1>
      <ol>
        <li>Add a club, its reporting period, a coach, a student, and a session. You can change or cancel a session later. Cancelling keeps any record already sent.</li>
        <li>Deactivate a coach or student when they leave. They cannot sign in or be marked. Their old records stay.</li>
        <li>What needs me and Session tracking use the same approve and send-back actions. Send back needs a reason. Photos stay on the version that was sent back.</li>
        <li>Record photo consent for a student. The date and your name are stored. A guardian can record it too, and can withdraw it. Withdrawal hides that child's photos immediately.</li>
        <li>After you approve a session, you can remove a photo if you give a reason. The coach cannot remove it after approval.</li>
        <li>Overdue sessions and falling behind are calculated from the schedule and the captured sessions.</li>
        <li>Grant an auditor read access to a club and a period, including a club you just added. Revoke ends that access.</li>
        <li>Export CSV downloads sessions, attendance, and approved figures for one club.</li>
      </ol>`,
    auditor: `<h1>How it works for an auditor</h1>
      <ol>
        <li>You can read only the clubs an organiser granted, and only during that period.</li>
        <li>Open a trace to see the figure, the reporting period, the approved version, the redacted note, and the private photos for each version. The photo count and small copies are loaded through a signed-in route. You only see photos for clubs in your grant. Every view is written to the audit log.</li>
        <li>File integrity checks are separate from the evidence note.</li>
        <li>You cannot submit, approve, or change a record.</li>
      </ol>`,
    student: `<h1>How it works for a student or family</h1>
      <ol>
        <li>Sign in with the family join code account your organiser gave you.</li>
        <li>This week shows how many captured sessions you were marked present for.</li>
        <li>You cannot open another club's records.</li>
      </ol>`,
    guardian: `<h1>How it works for a guardian</h1>
      <ol>
        <li>Sign in with the family account the organiser confirmed for your child.</li>
        <li>This week shows how many captured sessions your child was marked present for.</li>
        <li>You can record photo consent for your own child. The date and your name are stored. You can withdraw that consent. Withdrawal hides your child's photos immediately and queues them for deletion. That is written to the audit log.</li>
        <li>You only see a photo when it is tagged with your child and nobody else. A robot or kit photo, or a photo that also shows another child, is not shown to you.</li>
      </ol>`,
  };
  const home = user.role === 'organiser' ? '/organiser' : user.role === 'auditor' ? '/auditor' : user.role === 'student' || user.role === 'guardian' ? '/student' : '/coach';
  const body = blocks[user.role] || blocks.coach;
  return page('How it works', user, session, 'help', body);
}
