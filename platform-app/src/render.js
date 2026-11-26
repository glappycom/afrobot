import { comparisonPhrase, uncertaintyNote } from './compare.js';
import { DEMO_USERS, IDS } from './constants.js';
import { all, get } from './db.js';
import { comparisonViews, followupsFor, goalRollup, listClaims, listProjects, projectReport, traceClaim } from './domain.js';
import { esc, rateLabel, sdgLabel, show } from './format.js';

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #f4f6f4; color: #142033; font: 16px/1.45 system-ui, sans-serif; }
a { color: #0f3d32; }
a:hover, a:focus { text-decoration-thickness: 3px; }
:focus { outline: 3px solid #0f3d32; outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 0; background: #fff; padding: .5rem; }
.skip:focus { left: .5rem; z-index: 2; }
header, main, footer { width: min(52rem, calc(100% - 1.5rem)); margin: 0 auto; }
header { padding: 1rem 0 .25rem; }
main { padding-bottom: 2rem; }
footer { padding: 1rem 0 2rem; color: #3e4c5e; font-size: .95rem; }
h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 .5rem; }
h2 { font-size: 1.2rem; margin: 1.4rem 0 .4rem; }
h3 { font-size: 1.05rem; margin: 1rem 0 .3rem; }
.banner, .notice, .error { padding: .7rem .8rem; border: 1px solid #c5d0c8; background: #fff; }
.banner { background: #e7f0ea; }
.error { border-color: #8c2a0a; }
nav { display: flex; flex-wrap: wrap; gap: .75rem; margin: .6rem 0; }
table { width: 100%; border-collapse: collapse; background: #fff; }
th, td { border: 1px solid #c5d0c8; padding: .45rem .5rem; text-align: left; vertical-align: top; }
th { background: #e7eee9; }
.wrap { overflow-x: auto; }
code, .mono { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
form.stack { display: grid; gap: .55rem; margin: .6rem 0 1rem; padding: .8rem; background: #fff; border: 1px solid #c5d0c8; }
label { font-weight: 650; }
input, textarea, button, select { font: inherit; color: inherit; }
input, textarea, select { width: 100%; padding: .45rem; border: 1px solid #142033; background: #fff; }
button { padding: .5rem .8rem; background: #0f3d32; color: #fff; border: 2px solid #0f3d32; cursor: pointer; }
button.secondary { background: #fff; color: #0f3d32; }
.row { display: flex; flex-wrap: wrap; gap: .5rem; }
dl { display: grid; grid-template-columns: 12rem 1fr; gap: .25rem .75rem; margin: .4rem 0; }
dt { font-weight: 650; }
@media (max-width: 40rem) {
  dl { grid-template-columns: 1fr; }
  h1 { font-size: 1.35rem; }
  button { width: 100%; }
}
@media print {
  header nav, form, footer, .noprint { display: none; }
  body { background: #fff; }
}
`;

function layout({ title, user, body, notice, error }) {
  const home = user ? homeFor(user.role) : '/login';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header>
<p class="banner">Synthetic demo. Mocked sign-in. Fictional schools and counts only. No AI recommendations. Not for real learner records.</p>
${user ? `<nav aria-label="Demo"><a href="${home}">Workspace</a><a href="/print">Printable capture sheet</a>
<form method="post" action="/logout" style="display:inline"><input type="hidden" name="_csrf" value="${esc(user.csrf)}"><button class="secondary" type="submit">Sign out</button></form></nav>
<p>Signed in as ${esc(user.display_name)} <span class="mono">(${esc(user.role)}, mocked)</span>.</p>` : ''}
</header>
<main id="main">
${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
${body}
</main>
<footer>AfroBot evidence pilot, local only. Digests detect a change after a snapshot. They do not prove a count was true when it was typed in.</footer>
</body>
</html>`;
}

function homeFor(role) {
  if (role === 'organiser') return '/organiser';
  if (role === 'auditor') return '/auditor';
  if (role === 'student') return '/student';
  return '/coach';
}

function hidden(session) {
  return `<input type="hidden" name="_csrf" value="${esc(session.csrf)}">`;
}

function claimTable(claims) {
  if (!claims.length) return '<p>No claim in this workspace yet.</p>';
  const rows = claims.map((claim) => `<tr>
    <td>${claim.version}</td>
    <td>${esc(claim.status)}</td>
    <td>${show(claim.numerator)}</td>
    <td>${show(claim.denominator)}</td>
    <td>${esc(rateLabel(claim.numerator, claim.denominator) || '—')}</td>
    <td>${esc(claim.activity_date)}</td>
    <td>${esc(show(claim.correction_reason))}</td>
  </tr>`).join('');
  return `<div class="wrap"><table>
    <caption>Versions of this claim. An approved row is not overwritten.</caption>
    <thead><tr><th>Version</th><th>Status</th><th>Numerator</th><th>Denominator</th><th>Calculation</th><th>Activity date</th><th>Correction reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function loginPage({ error } = {}) {
  const rows = DEMO_USERS.map((row) => `<tr><td>${esc(row.displayName)}</td><td>${esc(row.role)}</td><td><code>${esc(row.username)}</code></td><td><code>${esc(row.password)}</code></td></tr>`).join('');
  return layout({
    title: 'Sign in · AfroBot evidence demo',
    body: `<h1>Evidence demo sign-in</h1>
    <p>These accounts are mocked. The passwords are fictional and ship with the demo. There is no external login service.</p>
    <form class="stack" method="post" action="/login">
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
    <h2>Demo roles</h2>
    <div class="wrap"><table>
      <caption>Mocked accounts. Do not reuse these passwords anywhere else.</caption>
      <thead><tr><th>Who</th><th>Role</th><th>Username</th><th>Password</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    error,
  });
}

export function unavailablePage() {
  return layout({
    title: 'Not available · AfroBot evidence demo',
    body: '<h1>That record is not available</h1><p>It is not in this account, or it is no longer there.</p>',
  });
}

export function coachPage(db, user, now, session, extras = {}) {
  const claims = listClaims(db, user, now);
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const school = get(db, 'SELECT * FROM schools WHERE id = ?', [projects[0]?.school_id || claims[0]?.school_id]);
  const membership = get(db, 'SELECT * FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const cohort = membership ? get(db, 'SELECT * FROM cohorts WHERE id = ?', [membership.cohort_id]) : null;
  const latestApproved = [...claims].reverse().find((claim) => claim.status === 'approved');
  const lesson = get(db, 'SELECT * FROM lessons WHERE id = ?', [IDS.lessonSorter]);
  const followups = cohort ? followupsFor(db, cohort.id) : [];
  const projectBlocks = projects.map((project) => projectBlock(db, project)).join('');
  return layout({
    title: 'Coach workspace · AfroBot evidence demo',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<h1>Coach workspace</h1>
    <p>School: ${esc(school ? `${school.display_name}, ${school.country_name}` : '—')}. Cohort: ${esc(cohort ? cohort.label : '—')}.</p>
    <h2>Rubric completions</h2>
    <p>Starters are the denominator. Finishers must meet the season rubric. ${esc(lesson.title)} is practice only. The table is the record already on file. The form below starts another submission. It does not overwrite an approved row.</p>
    ${claimTable(claims)}
    <h3>Submit a session total</h3>
    <form class="stack" method="post" action="/coach/claims">
      ${hidden(session)}
      <label for="numerator">Finishers (numerator)</label>
      <input id="numerator" name="numerator" inputmode="numeric" required>
      <label for="denominator">Starters (denominator)</label>
      <input id="denominator" name="denominator" inputmode="numeric" required>
      <label for="activityDate">Activity date</label>
      <input id="activityDate" name="activityDate" type="date" required>
      <button type="submit">Submit for organiser review</button>
    </form>
    <h3>Save a draft with a blank denominator</h3>
    <p>If the denominator is unknown, leave it blank. The rate stays blank. It is not stored as zero.</p>
    <form class="stack" method="post" action="/coach/drafts">
      ${hidden(session)}
      <label for="draftNumerator">Numerator, if you have it</label>
      <input id="draftNumerator" name="numerator" inputmode="numeric">
      <label for="draftDenominator">Denominator</label>
      <input id="draftDenominator" name="denominator" inputmode="numeric" aria-describedby="blank-help">
      <p id="blank-help">Leave this empty when you do not have the count.</p>
      <button class="secondary" type="submit">Save draft</button>
    </form>
    ${latestApproved ? `<h3>File a dated correction</h3>
    <p>This adds a new version. Version ${latestApproved.version} stays approved with its own digest.</p>
    <form class="stack" method="post" action="/coach/claims/${esc(latestApproved.id)}/corrections">
      ${hidden(session)}
      <label for="corrNumerator">Corrected numerator</label>
      <input id="corrNumerator" name="numerator" inputmode="numeric" required>
      <label for="corrDenominator">Denominator</label>
      <input id="corrDenominator" name="denominator" inputmode="numeric" required>
      <label for="corrDate">Correction date</label>
      <input id="corrDate" name="activityDate" type="date" required>
      <label for="reason">Reason</label>
      <textarea id="reason" name="reason" required minlength="8"></textarea>
      <p>Do not type a learner's name.</p>
      <button type="submit">Submit correction</button>
    </form>` : ''}
    <h3>Add a redacted note</h3>
    <form class="stack" method="post" action="/coach/evidence">
      ${hidden(session)}
      <label for="evidenceBody">Redacted note</label>
      <textarea id="evidenceBody" name="body" required></textarea>
      <label for="evidenceDate">Activity date</label>
      <input id="evidenceDate" name="activityDate" type="date" required>
      <label for="claimId">Claim id this note supports, if it already has one</label>
      <input id="claimId" name="claimId" value="${esc(latestApproved?.series_id || '')}">
      <button class="secondary" type="submit">Attach redacted note</button>
    </form>
    ${withdrawnLine(db, membership?.school_id)}
    <h2>Practice lesson</h2>
    <p><strong>${esc(lesson.title)}</strong> is a training milestone. ${esc(lesson.body)}</p>
    <form class="stack" method="post" action="/coach/practice-complete">
      ${hidden(session)}
      <input type="hidden" name="lessonId" value="${esc(lesson.id)}">
      <button class="secondary" type="submit">Try to mark the season project complete from this lesson</button>
    </form>
    <h2>Season project</h2>
    ${projectBlocks || '<p>No season project yet.</p>'}
    <h2>Follow-up outcomes</h2>
    ${followupTable(followups)}
    <p><a href="/print">Open the printable capture sheet</a> for later entry. This demo does not save that sheet in the browser.</p>`,
  });
}

function withdrawnLine(db, schoolId) {
  if (!schoolId) return '';
  const rows = all(db, `SELECT id FROM evidence_items WHERE school_id = ? AND permission_state = 'withdrawn'`, [schoolId]);
  if (!rows.length) return '';
  return `<p>${rows.length} removable file withdrawn. The text and the file are gone. The event keeps only the evidence id.</p>`;
}

function followupTable(rows) {
  if (!rows.length) return '<p>No follow-up row for this cohort. Missing counts stay blank.</p>';
  const labels = {
    independent_rerun: 'Independent school rerun',
    stem_6m: 'Further STEM participation at 6 months',
    stem_12m: 'Further STEM participation at 12 months',
    second_joint_project: 'Second locally led joint project within 12 months',
  };
  const body = rows.map((row) => `<tr>
    <td>${esc(labels[row.kind] || row.kind)}</td>
    <td>${show(row.count)}</td>
    <td>${show(row.eligible_denominator)}</td>
    <td>${show(row.response_coverage)}</td>
    <td>${esc(show(row.verifier_role))}</td>
  </tr>`).join('');
  return `<div class="wrap"><table>
    <caption>Stronger outcomes, kept separate from activity counts. A blank cell was not measured.</caption>
    <thead><tr><th>Outcome</th><th>Count</th><th>Eligible denominator</th><th>Response coverage</th><th>Verifier role</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function sourceLink(db, report) {
  if (!report.result?.evidence_id) return '';
  const source = get(db, 'SELECT id, source_type, permission_state, redaction_state FROM evidence_items WHERE id = ?', [report.result.evidence_id]);
  if (!source || source.permission_state !== 'active' || source.redaction_state !== 'redacted') return '';
  return ` Source: <a href="/evidence/${esc(source.id)}/download">${esc(source.source_type)}</a>.`;
}

function projectBlock(db, project) {
  const report = projectReport(db, project);
  const peer = project.peer_review_json ? JSON.parse(project.peer_review_json) : null;
  const verified = report.stages.find((stage) => stage.stage === 'verified_outcome');
  return `<article>
    <h3>${esc(project.stable_code)}</h3>
    <dl>
      <dt>Local problem</dt><dd>${esc(project.local_problem)}</dd>
      <dt>Primary goal</dt><dd>${esc(sdgLabel(project.primary_sdg) || '—')}</dd>
      <dt>Target reference</dt><dd>${esc(show(project.sdg_target_ref))}. Reference only. Not a UN indicator result and not an endorsement.</dd>
      <dt>Confirmed</dt><dd>${esc(show(project.confirmation_date))} by ${esc(show(project.verifier_role))}</dd>
      <dt>Baseline</dt><dd>${report.baselineMissing ? '—' : `${report.baseline.value} ${esc(report.baseline.units)} (${esc(report.baseline.period_label)})`}</dd>
      <dt>Result</dt><dd>${report.result ? `${report.result.value} ${esc(report.result.units)} (${esc(report.result.period_label)})` : (report.resultWithdrawn ? '— (supporting evidence withdrawn)' : '—')}${sourceLink(db, report)}</dd>
      <dt>Output</dt><dd>${report.output ? 'Shown. Prototype is attested.' : '—'}</dd>
      <dt>Confirmed use</dt><dd>${report.confirmedUse ? 'Shown. Use is attested.' : '—'}</dd>
      <dt>Verified outcome</dt><dd>${report.verified ? 'Approved.' : 'Not verified. ' + esc(verified?.status || 'missing')}</dd>
      <dt>Revision</dt><dd>${esc(show(project.revision_note))}</dd>
      <dt>Remote fallback</dt><dd>${esc(show(project.remote_fallback))}</dd>
      <dt>Event readiness</dt><dd>${esc(show(project.event_readiness))}. Travel is not required.</dd>
      <dt>Dream Prize</dt><dd>${esc(project.dream_prize_status)}. Planning status only. No award and no payment.</dd>
    </dl>
    ${peer ? `<h4>Peer review from another country</h4>
      <p>From a ${esc(peer.from_team)} in ${esc(peer.from_country)}. Note: ${esc(peer.note)}</p>
      <p>Response: ${esc(peer.response)} Change: ${esc(peer.change)}</p>` : ''}
  </article>`;
}

export function organiserPage(db, user, now, session, extras = {}) {
  const claims = listClaims(db, user, now);
  const submitted = claims.filter((claim) => claim.status === 'submitted');
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const rollup = goalRollup(db, user, now);
  const comparisons = comparisonViews(db);
  const order = ['cmp-like-for-like', 'cmp-scope', 'cmp-rubric', 'cmp-baseline', 'cmp-coverage', 'cmp-guardrail'];
  comparisons.sort((a, b) => order.indexOf(a.row.id) - order.indexOf(b.row.id));
  const usRubrics = all(db, 'SELECT * FROM rubric_versions WHERE season_id = ?', [IDS.seasonUs]);
  const usLessons = all(db, 'SELECT * FROM lessons WHERE season_id = ?', [IDS.seasonUs]);
  const usProjects = all(db, 'SELECT id FROM projects WHERE season_id = ?', [IDS.seasonUs]);
  const milestones = all(db, 'SELECT * FROM milestones WHERE season_id = ?', [IDS.seasonAfrica]);
  const experiment = get(db, 'SELECT * FROM experiment_log WHERE season_id = ?', [IDS.seasonAfrica]);
  const followups = followupsFor(db, IDS.cohortCm);
  const comparisonRows = comparisons.map((item) => `<tr>
    <td>${esc(item.row.label)}</td>
    <td>${item.baseline.completions}/${item.baseline.coachHours} coach-hours</td>
    <td>${item.candidate.completions}/${item.candidate.coachHours} coach-hours</td>
    <td>${esc(comparisonPhrase(item.result))}</td>
    <td>${esc(item.result.decision)}</td>
    <td>${esc(item.row.source_note)} ${esc(uncertaintyNote(item.candidate.coverage))}</td>
  </tr>`).join('');
  const queue = submitted.map((claim) => `<li>
    <span class="mono">${esc(claim.id)}</span> version ${claim.version}: ${esc(show(claim.numerator))}/${esc(show(claim.denominator))}.
    <form method="post" action="/organiser/claims/${esc(claim.id)}/approve">${hidden(session)}<button type="submit">Approve</button></form>
    <form class="stack" method="post" action="/organiser/claims/${esc(claim.id)}/return">${hidden(session)}
      <label for="note-${esc(claim.id)}">What needs to change</label>
      <input id="note-${esc(claim.id)}" name="note" required minlength="8">
      <button class="secondary" type="submit">Send back</button>
    </form>
  </li>`).join('');
  const projectCards = projects.map((project) => {
    const report = projectReport(db, project);
    const verify = project.school_id && !report.verified && project.visibility === 'school'
      ? `<form method="post" action="/organiser/projects/${esc(project.id)}/verify">${hidden(session)}<button type="submit">Approve verified outcome</button></form>`
      : '';
    return `<article>${projectBlock(db, project)}${verify}
      <p>Next resource ask: ${esc(show(project.next_resource_ask))}. Methodology: ${esc(show(project.methodology))}</p>
    </article>`;
  }).join('');
  return layout({
    title: 'Organiser review · AfroBot evidence demo',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<h1>Organiser review</h1>
    <p>You are a different person from the coach who submits. Approving does not replace an earlier approved snapshot.</p>
    <p>AfroBot's programme aligns with SDG 4 Quality Education. That is separate from a project's own primary goal.</p>
    <h2>Waiting for review</h2>
    ${queue ? `<ul>${queue}</ul>` : '<p>Nothing is waiting.</p>'}
    <h2>Claim history you can review</h2>
    ${claimTable(claims)}
    <h2>Season comparison</h2>
    <p>One lever at a time: coach-hours on the same rubric. 10× is a stretch hypothesis for a bottleneck, not a score and not a goal. No AI recommendation is made. A person decides.</p>
    <div class="wrap"><table>
      <caption>Illustrative season comparisons. These fixtures are not the school claim above.</caption>
      <thead><tr><th>Case</th><th>Baseline</th><th>Candidate</th><th>What it shows</th><th>Decision</th><th>Source and uncertainty</th></tr></thead>
      <tbody>${comparisonRows}</tbody>
    </table></div>
    <h2>Education gains and community outcomes</h2>
    <p>Rubric completions are an education count. Sorting error and water mapping are community records. A water mapping prototype does not prove access or safety.</p>
    ${followupTable(followups)}
    <h2>Goal rollup</h2>
    <p>Each season project is counted once under its primary goal. Stages do not add a second project.</p>
    <div class="wrap"><table>
      <caption>Approved view of fictional projects in your schools.</caption>
      <thead><tr><th>Primary goal</th><th>Projects</th><th>Output</th><th>Confirmed use</th><th>Verified outcome</th></tr></thead>
      <tbody>${rollupRows(rollup)}</tbody>
    </table></div>
    <h2>Projects</h2>
    ${projectCards}
    <h2>Copy approved materials into the U.S. draft season</h2>
    <p>This copies the approved rubric, the practice lesson, and the coach card. It does not copy learners, school permissions, grants, or project records. The U.S. season stays unpublished.</p>
    <p>Copied rubrics: ${usRubrics.length}. Copied lessons: ${usLessons.length}. Projects in that season: ${usProjects.length}.</p>
    <form method="post" action="/organiser/clone">${hidden(session)}<button class="secondary" type="submit">Copy approved coach materials</button></form>
    <h2>Experiment log</h2>
    <dl>
      <dt>Bottleneck</dt><dd>${esc(experiment.bottleneck)}</dd>
      <dt>Lever</dt><dd>${esc(experiment.proposed_lever)}</dd>
      <dt>Owner</dt><dd>${esc(experiment.owner_role)}</dd>
      <dt>Test</dt><dd>${esc(experiment.test_plan)}</dd>
      <dt>Evidence</dt><dd>${esc(experiment.evidence_note)}</dd>
      <dt>Cost</dt><dd>${esc(experiment.cost_note)}</dd>
      <dt>Guardrail</dt><dd>${esc(experiment.guardrail_note)}</dd>
      <dt>Decision</dt><dd>${esc(experiment.decision)}</dd>
    </dl>
    <h2>Milestones</h2>
    <ul>${milestones.map((row) => `<li>${esc(row.label)}: ${esc(row.state)}, ${row.published ? 'published' : 'unpublished'}. ${esc(row.venue_note)}</li>`).join('')}</ul>`,
  });
}

function rollupRows(rollup) {
  const keys = [...new Set([...Object.keys(rollup.projectsByGoal), ...Object.keys(rollup.outputByGoal)])];
  if (!keys.length) return '<tr><td colspan="5">—</td></tr>';
  return keys.map((key) => `<tr>
    <td>${esc(sdgLabel(Number(key)) || key)}</td>
    <td>${rollup.projectsByGoal[key] || 0}</td>
    <td>${rollup.outputByGoal[key] || 0}</td>
    <td>${rollup.confirmedUseByGoal[key] || 0}</td>
    <td>${rollup.verifiedByGoal[key] || 0}</td>
  </tr>`).join('');
}

export function auditorPage(db, user, now, session, extras = {}) {
  const grant = get(db, 'SELECT * FROM access_grants WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1', [user.id]);
  const claims = listClaims(db, user, now);
  const current = [...claims].reverse().find((claim) => claim.status === 'approved');
  let trace = null;
  if (current) trace = traceClaim(db, user, current.id, now);
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const followups = followupsFor(db, IDS.cohortCm);
  const history = trace ? trace.versions.map((claim) => {
    const snap = trace.snapshots.find((row) => row.subject_id === claim.id);
    return `<tr>
      <td>${claim.version}</td>
      <td>${esc(claim.status)}</td>
      <td>${esc(rateLabel(claim.numerator, claim.denominator) || '—')}</td>
      <td>${esc(claim.activity_date)}</td>
      <td>${snap ? `<code>${esc(snap.digest_sha256)}</code>` : '—'}</td>
      <td>${snap && claim.id !== trace.current.id ? 'Superseded snapshot, still stored' : (claim.id === trace.current?.id ? 'Current approved snapshot' : '—')}</td>
    </tr>`;
  }).join('') : '';
  const sources = trace ? trace.evidence.map((row) => `<li><a href="/evidence/${esc(row.id)}/download">${esc(row.source_type)}</a> dated ${esc(row.activity_date)}. Redacted text is in the file.</li>`).join('') : '';
  return layout({
    title: 'Auditor trace · AfroBot evidence demo',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<h1>Auditor trace</h1>
    <p>This grant is read-only. It covers one fictional school and ends at ${esc(grant ? grant.expires_at : '—')}. It started at ${esc(grant ? grant.starts_at : '—')}.</p>
    ${trace ? `<h2>Qualifying rubric completions</h2>
      <p>Current approved calculation: <strong>${esc(rateLabel(trace.current.numerator, trace.current.denominator) || '—')}</strong>.</p>
      <dl>
        <dt>Numerator</dt><dd>${show(trace.current.numerator)}</dd>
        <dt>Denominator</dt><dd>${show(trace.current.denominator)}</dd>
        <dt>Period</dt><dd>${esc(trace.current.window_start)} to ${esc(trace.current.window_end)}</dd>
        <dt>Inclusion</dt><dd>${esc(trace.current.inclusion_rules)}</dd>
        <dt>Rubric</dt><dd>${esc(trace.current.rubric_version_id)}: ${esc(trace.rubric.join(', '))}</dd>
        <dt>Metric</dt><dd>${esc(trace.current.metric_version)}</dd>
        <dt>Activity date</dt><dd>${esc(trace.current.activity_date)}</dd>
        <dt>Correction</dt><dd>${esc(show(trace.current.correction_reason))}</dd>
      </dl>
      <div class="wrap"><table>
        <caption>Authorised versions. Each approved version has its own SHA-256 digest.</caption>
        <thead><tr><th>Version</th><th>Status</th><th>Calculation</th><th>Activity date</th><th>SHA-256</th><th>Snapshot</th></tr></thead>
        <tbody>${history}</tbody>
      </table></div>
      <h3>Redacted sources</h3>
      <ul>${sources || '<li>None.</li>'}</ul>
      <form method="post" action="/auditor/exports/${esc(trace.current.id)}/export">${hidden(session)}
        <button type="submit">Export redacted pack</button>
      </form>` : '<p>No assigned approved claim is available.</p>'}
    <h2>Assigned project</h2>
    ${projects.map((project) => projectBlock(db, project)).join('') || '<p>None.</p>'}
    <h2>Follow-up outcomes</h2>
    ${followupTable(followups)}
    <p>There is no edit control on this page. Other schools, rosters, and private drafts are not listed.</p>`,
  });
}

export function studentPage(db, user, now, session, extras = {}) {
  const projects = listProjects(db, user, now);
  const cards = projects.map((project) => `<article>
    <h2>Your draft</h2>
    <p>${esc(project.local_problem)}</p>
    <form class="stack" method="post" action="/student/projects/${esc(project.id)}">
      ${hidden(session)}
      <label for="localProblem">Update your note</label>
      <textarea id="localProblem" name="localProblem" required minlength="8">${esc(project.local_problem)}</textarea>
      <button type="submit">Save draft</button>
    </form>
  </article>`).join('');
  return layout({
    title: 'Student workspace · AfroBot evidence demo',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<h1>Student workspace</h1>
    <p>This login is mocked and optional. The pilot can run with coach records and no learner account. You only see your own draft.</p>
    ${cards || '<p>No draft is assigned to this login.</p>'}
    <p>The season project is recorded by the coach. This page does not list other learners.</p>`,
  });
}

export function printPage(user, session) {
  return layout({
    title: 'Printable capture sheet · AfroBot evidence demo',
    user: user ? { ...user, csrf: session.csrf } : null,
    body: `<h1>Capture sheet for later entry</h1>
    <p>Print this empty sheet. Do not write a learner's name on it. Do not save filled copies in the browser. Type the totals into the coach workspace later.</p>
    <table>
      <caption>Blank session capture. Nothing here is stored.</caption>
      <thead><tr><th>Field</th><th>Write in</th></tr></thead>
      <tbody>
        <tr><td>School code you were given</td><td></td></tr>
        <tr><td>Activity date</td><td></td></tr>
        <tr><td>Starters (denominator)</td><td></td></tr>
        <tr><td>Finishers on the season rubric (numerator)</td><td></td></tr>
        <tr><td>Practice sorter done? It does not complete the project.</td><td></td></tr>
        <tr><td>Local problem, one sentence</td><td></td></tr>
        <tr><td>Primary goal: 4, 6, 12, or other</td><td></td></tr>
        <tr><td>Baseline, units, and denominator, or "not measured"</td><td></td></tr>
        <tr><td>Result and count window</td><td></td></tr>
      </tbody>
    </table>`,
  });
}

export function exportPage(user, session, pack) {
  const files = Object.keys(pack.files).map((name) => `<li><a href="/exports/${esc(pack.manifest.pack_id)}/files/${esc(name)}">${esc(name)}</a> <code>${esc(pack.manifest.files.find((file) => file.name === name)?.sha256 || '')}</code></li>`).join('');
  return layout({
    title: 'Export pack · AfroBot evidence demo',
    user: { ...user, csrf: session.csrf },
    body: `<h1>Redacted export pack</h1>
    <p>Pack <code>${esc(pack.manifest.pack_id)}</code> generated at ${esc(pack.manifest.generated_at)}.</p>
    <p>${esc(pack.manifest.redaction)}</p>
    <p>Current calculation: ${esc(pack.manifest.calculation.current.label || '—')}.</p>
    <p>Superseded calculation: ${esc(pack.manifest.calculation.superseded?.label || '—')}.</p>
    <ul>${files}</ul>`,
  });
}

export { homeFor };
