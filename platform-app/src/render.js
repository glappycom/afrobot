import { comparisonPhrase, uncertaintyNote } from './compare.js';
import { DEMO_USERS, IDS } from './constants.js';
import { all, get } from './db.js';
import { comparisonViews, followupsFor, goalRollup, listClaims, listProjects, projectReport, traceClaim } from './domain.js';
import { esc, rateLabel, sdgLabel, show } from './format.js';

const CSS = `
@font-face{font-family:Fredoka;src:url(/fonts/fredoka-700.woff2) format('woff2');font-weight:700;font-display:swap}
@font-face{font-family:Rubik;src:url(/fonts/rubik-400.woff2) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Rubik;src:url(/fonts/rubik-500.woff2) format('woff2');font-weight:500;font-display:swap}
:root{--navy:#0E2747;--navy2:#163A66;--sun:#FFC531;--coral:#FF5B3A;--leaf:#16A35A;--sky:#3FA9F5;--cream:#FFF4DF;--ink:#0B1626;--line:#E3E7EC;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:18px/1.45 Rubik,system-ui,sans-serif}
a{color:var(--navy)}
:focus-visible{outline:3px solid var(--navy);outline-offset:3px}
.skip{position:absolute;left:12px;top:-48px;background:#fff;color:var(--navy);padding:8px 12px;z-index:3}
.skip:focus{top:12px}
header,main,footer{width:min(46rem,calc(100% - 1.5rem));margin:0 auto}
header{display:flex;align-items:center;gap:12px;padding:16px 0 8px}
.mark{font-family:Fredoka,sans-serif;font-weight:700;font-size:28px;letter-spacing:-.03em;color:var(--navy);text-decoration:none;text-transform:lowercase}
nav{margin-left:auto;display:flex;gap:8px;align-items:center}
h1,h2,h3,button,.chip,.kicker{font-family:Fredoka,sans-serif;font-weight:700}
h1{font-size:clamp(2rem,6vw,2.6rem);line-height:1;letter-spacing:-.03em;color:var(--navy);margin:8px 0}
h2{font-size:1.35rem;color:var(--navy);margin:0 0 8px}
.kicker{display:inline-block;background:var(--sun);color:var(--navy);border-radius:99px;padding:4px 12px;font-size:16px}
.banner,.notice,.error{border-radius:16px;padding:10px 14px;margin:8px 0}
.banner{background:var(--cream);color:var(--navy)}
.notice{background:#E8F7EE}
.error{background:#fff;border:2px solid var(--coral);color:var(--navy)}
.card{border:1px solid var(--line);border-radius:24px;padding:18px;margin:12px 0;background:#fff;box-shadow:0 8px 24px rgba(14,39,71,.06)}
.figure{font-family:Fredoka,sans-serif;font-weight:700;font-size:clamp(3rem,12vw,4.5rem);line-height:.9;letter-spacing:-.04em;color:var(--navy);margin:8px 0}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:4px 10px;font-size:15px;background:var(--cream);color:var(--navy)}
.chip-approved{background:var(--navy);color:#fff}
.chip-submitted{background:var(--sun);color:var(--navy)}
.chip-returned{background:#fff;color:var(--navy);box-shadow:inset 0 0 0 2px var(--coral)}
.chip-draft,.chip-missing,.chip-attested{background:var(--cream);color:var(--navy)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button,.btn{font-family:Fredoka,sans-serif;font-weight:700;font-size:20px;background:var(--sun);color:var(--navy);border:0;border-radius:99px;padding:12px 22px;cursor:pointer}
button.quiet{background:#fff;box-shadow:inset 0 0 0 2px var(--navy)}
.ico{width:22px;height:22px;vertical-align:-4px}
.timeline{list-style:none;margin:12px 0 0;padding:0 0 0 8px;border-left:4px solid var(--sun)}
.timeline li{position:relative;padding:0 0 14px 16px}
.timeline li::before{content:"";position:absolute;left:-14px;top:4px;width:16px;height:16px;border-radius:50%;background:var(--navy)}
.timeline .now::before{background:var(--sun);box-shadow:0 0 0 3px var(--navy)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:10px}
.mini{border-radius:18px;padding:12px;background:var(--cream);color:var(--navy)}
.mini b{display:block;font-family:Fredoka,sans-serif;font-size:1.4rem}
.wizard{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.wizard li{display:grid;grid-template-columns:2rem 1fr;gap:8px;align-items:center}
.step{width:2rem;height:2rem;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-family:Fredoka,sans-serif}
label{font-weight:500}
input,textarea{width:100%;font:inherit;padding:10px 12px;border:2px solid var(--navy);border-radius:12px;background:#fff;color:var(--ink)}
details{margin:10px 0}
summary{cursor:pointer;font-family:Fredoka,sans-serif;color:var(--navy)}
code{font-family:ui-monospace,monospace;font-size:13px;overflow-wrap:anywhere}
.roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:8px}
.role{border:1px solid var(--line);border-radius:16px;padding:10px;background:#fff}
.role b,.role code{display:block}
footer{color:var(--navy);padding:18px 0 32px;font-size:15px}
@media (max-width:40rem){
  button,.btn{width:100%}
  .wizard li{grid-template-columns:1fr}
  header{align-items:flex-start;flex-direction:column}
  nav{margin-left:0}
}
@media print{nav,form,details,footer{display:none}body{background:#fff}}
`;

function icon(name) {
  const paths = {
    check: '<path d="M5 12.5 9 16.5 19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
    pencil: '<path d="M4 16.5 15.5 5l3.5 3.5L7.5 20H4v-3.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function chip(text, kind) {
  return `<span class="chip chip-${esc(kind)}">${text}</span>`;
}

function statusChip(status) {
  const labels = { draft: 'Draft', submitted: 'Submitted', returned: 'Returned', approved: 'Approved', missing: 'Not verified', attested: 'Attested' };
  const kind = labels[status] ? status : 'draft';
  const glyph = status === 'approved' ? icon('check') : status === 'submitted' ? icon('clock') : status === 'returned' ? icon('pencil') : '';
  return `<span class="chip chip-${esc(kind)}">${glyph}${esc(labels[status] || status)}</span>`;
}

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
<a class="mark" href="${home}">afrobot</a>
${user ? `<nav aria-label="Demo"><a href="${home}">Home</a><a href="/print">Print sheet</a>
<form method="post" action="/logout"><input type="hidden" name="_csrf" value="${esc(user.csrf)}"><button class="quiet" type="submit">Sign out</button></form></nav>` : ''}
</header>
<main id="main">
<p class="banner">Synthetic demo. Mocked sign-in. No AI recommendations.</p>
${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
${body}
</main>
<footer>Local demo. A digest shows a later change. It does not prove the first number was true.</footer>
</body>
</html>`;
}

function hidden(session) {
  return `<input type="hidden" name="_csrf" value="${esc(session.csrf)}">`;
}

function homeFor(role) {
  if (role === 'organiser') return '/organiser';
  if (role === 'auditor') return '/auditor';
  if (role === 'student') return '/student';
  return '/coach';
}

function timeline(claims, snapshots = []) {
  if (!claims.length) return '';
  const current = [...claims].reverse().find((claim) => claim.status === 'approved');
  return `<ol class="timeline">${claims.map((claim) => {
    const snap = snapshots.find((row) => row.subject_id === claim.id);
    const here = current && claim.id === current.id;
    return `<li class="${here ? 'now' : ''}">
      <b>v${claim.version}</b> ${esc(rateLabel(claim.numerator, claim.denominator) || '—')}
      ${statusChip(claim.status)}
      <span>${here ? 'Current' : claim.status === 'approved' ? 'Superseded snapshot, still stored' : ''}</span>
      ${snap ? `<code class="mono">${esc(snap.digest_sha256)}</code>` : ''}
    </li>`;
  }).join('')}</ol>`;
}

function showHow(claim, extra = '') {
  if (!claim) return '';
  return `<details>
    <summary>show how</summary>
    <p>${esc(rateLabel(claim.numerator, claim.denominator) || '—')}</p>
    <p>Numerator ${show(claim.numerator)}. Denominator ${show(claim.denominator)}. ${esc(claim.activity_date || '')}</p>
    <p>${esc(claim.inclusion_rules || '')}</p>
    ${claim.correction_reason ? `<p>${esc(claim.correction_reason)}</p>` : ''}
    ${extra}
  </details>`;
}

export function loginPage({ error } = {}) {
  const cards = DEMO_USERS.map((row) => `<article class="role">
    <b>${esc(row.displayName)}</b>
    <span>${esc(row.role)}</span>
    <code>${esc(row.username)}</code>
    <code>${esc(row.password)}</code>
  </article>`).join('');
  return layout({
    title: 'Sign in · afrobot evidence',
    body: `<p class="kicker">demo</p>
    <h1>Sign in</h1>
    <form class="card" method="post" action="/login">
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <p><button type="submit">Sign in</button></p>
    </form>
    <div class="roles">${cards}</div>`,
    error,
  });
}

export function unavailablePage() {
  return layout({
    title: 'Not available · afrobot evidence',
    body: '<h1>Not available</h1><p>That record is not available.</p>',
  });
}

function projectCard(db, project) {
  const report = projectReport(db, project);
  const verified = report.stages.find((stage) => stage.stage === 'verified_outcome');
  const peer = project.peer_review_json ? JSON.parse(project.peer_review_json) : null;
  const resultText = report.result
    ? `${report.result.value} / ${report.result.denominator}`
    : (report.resultWithdrawn ? '—' : '—');
  return `<article class="card">
    <div class="row"><b>${esc(project.stable_code)}</b> ${statusChip(verified?.status || 'missing')}</div>
    <p>${esc(sdgLabel(project.primary_sdg) || 'Project')}</p>
    <p class="row"><span>Baseline ${report.baselineMissing ? '—' : report.baseline.value}</span><span>Result ${resultText}</span></p>
    <p>${report.output ? 'Output' : '—'} · ${report.confirmedUse ? 'Confirmed use' : '—'} · ${report.verified ? 'Verified' : 'Not verified'}</p>
    ${peer ? `<p>Peer note: second-day recount. ${esc(peer.change)}</p>` : ''}
    ${project.remote_fallback ? `<p>${icon('eye')} Remote. Travel is not required.</p>` : ''}
  </article>`;
}

export function coachPage(db, user, now, session, extras = {}) {
  const claims = listClaims(db, user, now);
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const school = get(db, 'SELECT * FROM schools WHERE id = ?', [projects[0]?.school_id || claims[0]?.school_id]);
  const membership = get(db, 'SELECT * FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const latestApproved = [...claims].reverse().find((claim) => claim.status === 'approved');
  const waiting = [...claims].reverse().find((claim) => claim.status === 'submitted');
  const focus = latestApproved || waiting || claims.at(-1);
  const lesson = get(db, 'SELECT * FROM lessons WHERE id = ?', [IDS.lessonSorter]);
  const heading = waiting ? 'Waiting for approval' : focus ? 'Approved total' : 'New total';
  const withdrawn = membership ? all(db, `SELECT id FROM evidence_items WHERE school_id = ? AND permission_state = 'withdrawn'`, [membership.school_id]) : [];
  return layout({
    title: 'Coach · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<p class="kicker">${icon('pencil')} coach</p>
    <h1>${heading}</h1>
    <p>${esc(school ? `${school.display_name}, ${school.country_name}` : '—')}</p>
    <section class="card">
      <p class="figure">${esc(rateLabel(focus?.numerator, focus?.denominator) || '—')}</p>
      <div class="row">${focus ? statusChip(focus.status) : chip('Draft', 'draft')}</div>
      ${showHow(focus)}
      ${timeline(claims)}
    </section>
    <section class="card">
      <h2>${icon('clock')} ${esc(lesson.title)}</h2>
      <p>Practice only. It cannot complete a season project.</p>
      <form method="post" action="/coach/practice-complete">
        ${hidden(session)}
        <input type="hidden" name="lessonId" value="${esc(lesson.id)}">
        <button class="quiet" type="submit">Try to mark the season project complete from this lesson</button>
      </form>
    </section>
    ${projects.map((project) => projectCard(db, project)).join('')}
    <details>
      <summary>New total</summary>
      <form method="post" action="/coach/claims">
        ${hidden(session)}
        <ol class="wizard">
          <li><span class="step">1</span><span><label for="numerator">Finishers</label><input id="numerator" name="numerator" inputmode="numeric" required></span></li>
          <li><span class="step">2</span><span><label for="denominator">Starters</label><input id="denominator" name="denominator" inputmode="numeric" required></span></li>
          <li><span class="step">3</span><span><label for="activityDate">Date</label><input id="activityDate" name="activityDate" type="date" required></span></li>
        </ol>
        <p><button type="submit">Submit for review</button></p>
      </form>
    </details>
    <details>
      <summary>Blank draft</summary>
      <form method="post" action="/coach/drafts">
        ${hidden(session)}
        <label for="draftNumerator">Numerator</label>
        <input id="draftNumerator" name="numerator" inputmode="numeric">
        <label for="draftDenominator">Denominator</label>
        <input id="draftDenominator" name="denominator" inputmode="numeric" aria-describedby="blank-help">
        <p id="blank-help">Leave this empty when you do not have the count. It stays blank.</p>
        <button class="quiet" type="submit">Save draft</button>
      </form>
    </details>
    ${latestApproved ? `<details>
      <summary>Correct ${latestApproved.version}</summary>
      <form method="post" action="/coach/claims/${esc(latestApproved.id)}/corrections">
        ${hidden(session)}
        <label for="corrNumerator">New numerator</label>
        <input id="corrNumerator" name="numerator" inputmode="numeric" required>
        <label for="corrDenominator">Denominator</label>
        <input id="corrDenominator" name="denominator" inputmode="numeric" required>
        <label for="corrDate">Date</label>
        <input id="corrDate" name="activityDate" type="date" required>
        <label for="reason">Reason</label>
        <textarea id="reason" name="reason" required minlength="8"></textarea>
        <p>No learner names.</p>
        <button type="submit">Submit correction</button>
      </form>
    </details>` : ''}
    <details>
      <summary>Add a note</summary>
      <form method="post" action="/coach/evidence">
        ${hidden(session)}
        <label for="evidenceBody">Redacted note</label>
        <textarea id="evidenceBody" name="body" required></textarea>
        <label for="evidenceDate">Date</label>
        <input id="evidenceDate" name="activityDate" type="date" required>
        <label for="claimId">Claim id</label>
        <input id="claimId" name="claimId" value="${esc(latestApproved?.series_id || '')}">
        <button class="quiet" type="submit">Attach</button>
      </form>
      ${withdrawn.length ? `<p>${withdrawn.length} file withdrawn. The text is gone.</p>` : ''}
    </details>`,
  });
}

export function organiserPage(db, user, now, session, extras = {}) {
  const claims = listClaims(db, user, now);
  const submitted = claims.filter((claim) => claim.status === 'submitted');
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const rollup = goalRollup(db, user, now);
  const comparisons = comparisonViews(db);
  const order = ['cmp-like-for-like', 'cmp-scope', 'cmp-rubric', 'cmp-baseline', 'cmp-coverage', 'cmp-guardrail'];
  comparisons.sort((a, b) => order.indexOf(a.row.id) - order.indexOf(b.row.id));
  const usRubrics = all(db, 'SELECT id FROM rubric_versions WHERE season_id = ?', [IDS.seasonUs]);
  const usProjects = all(db, 'SELECT id FROM projects WHERE season_id = ?', [IDS.seasonUs]);
  const first = submitted[0];
  const cards = comparisons.map((item) => `<article class="mini">
    <b>${esc(item.row.label)}</b>
    <span>${item.baseline.completions}/${item.baseline.coachHours} vs ${item.candidate.completions}/${item.candidate.coachHours}</span>
    <span>${esc(comparisonPhrase(item.result))}</span>
    <details><summary>source</summary><p>${esc(item.row.source_note)} ${esc(uncertaintyNote(item.candidate.coverage))}</p></details>
  </article>`).join('');
  const queue = submitted.map((claim) => `<form method="post" action="/organiser/claims/${esc(claim.id)}/approve">${hidden(session)}<button type="submit">Approve</button></form>
    <details><summary>Send back</summary>
      <form method="post" action="/organiser/claims/${esc(claim.id)}/return">${hidden(session)}
        <label for="note-${esc(claim.id)}">What to change</label>
        <input id="note-${esc(claim.id)}" name="note" required minlength="8">
        <button class="quiet" type="submit">Return</button>
      </form>
    </details>`).join('');
  return layout({
    title: 'Organiser · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<p class="kicker">${icon('check')} organiser</p>
    <h1>${first ? 'Approve this total' : 'Review'}</h1>
    <p>A different person from the coach.</p>
    <section class="card">
      <p class="figure">${esc(rateLabel(first?.numerator, first?.denominator) || '—')}</p>
      <div class="row">${first ? statusChip(first.status) : ''}</div>
      ${queue || '<p>Nothing is waiting.</p>'}
    </section>
    ${timeline(claims)}
    <h2>Compare seasons</h2>
    <p class="row">${chip('No AI recommendation', 'draft')}</p>
    <div class="grid">${cards}</div>
    <h2>Projects</h2>
    <div class="grid">${rollupCards(rollup)}</div>
    ${projects.map((project) => {
      const report = projectReport(db, project);
      const verify = project.school_id && !report.verified
        ? `<form method="post" action="/organiser/projects/${esc(project.id)}/verify">${hidden(session)}<button class="quiet" type="submit">Approve verified outcome</button></form>`
        : '';
      return projectCard(db, project) + verify;
    }).join('')}
    <section class="card">
      <h2>U.S. draft</h2>
      <p class="row"><span class="mini"><b>${usRubrics.length}</b>Copied rubrics: ${usRubrics.length}</span><span class="mini"><b>${usProjects.length}</b>Projects in that season: ${usProjects.length}</span></p>
      <form method="post" action="/organiser/clone">${hidden(session)}<button class="quiet" type="submit">Copy coach pack</button></form>
    </section>`,
  });
}

function rollupCards(rollup) {
  const keys = [...new Set([...Object.keys(rollup.projectsByGoal), ...Object.keys(rollup.outputByGoal)])];
  if (!keys.length) return '<p>—</p>';
  return keys.map((key) => `<article class="mini"><b>${rollup.projectsByGoal[key] || 0}</b>${esc(sdgLabel(Number(key)) || key)} · verified ${rollup.verifiedByGoal[key] || 0}</article>`).join('');
}

export function auditorPage(db, user, now, session, extras = {}) {
  const grant = get(db, 'SELECT * FROM access_grants WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1', [user.id]);
  const claims = listClaims(db, user, now);
  const current = [...claims].reverse().find((claim) => claim.status === 'approved');
  const trace = current ? traceClaim(db, user, current.id, now) : null;
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const followups = followupsFor(db, IDS.cohortCm);
  return layout({
    title: 'Auditor · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<p class="kicker">${icon('eye')} read only</p>
    <h1>Export the pack</h1>
    <p>Ends ${esc(grant ? grant.expires_at.slice(0, 10) : '—')}</p>
    ${trace ? `<section class="card">
      <p class="figure">${esc(rateLabel(trace.current.numerator, trace.current.denominator) || '—')}</p>
      <div class="row">${statusChip(trace.current.status)}</div>
      ${showHow(trace.current, `<p>Rubric ${esc(trace.current.rubric_version_id)}. ${esc(trace.rubric.join(', '))}.</p>`)}
      ${timeline(trace.versions, trace.snapshots)}
      <p>${trace.evidence.map((row) => `<a href="/evidence/${esc(row.id)}/download">${esc(row.source_type)}</a>`).join(' · ') || 'No source'}</p>
      <form method="post" action="/auditor/exports/${esc(trace.current.id)}/export">${hidden(session)}
        <button type="submit">Export pack</button>
      </form>
    </section>` : '<p>No assigned claim.</p>'}
    ${projects.map((project) => projectCard(db, project)).join('')}
    ${trace ? `<div class="row">${followups.map((row) => `<span class="chip">${esc(row.kind.replaceAll('_', ' '))} —</span>`).join('')}</div>` : ''}`,
  });
}

export function studentPage(db, user, now, session, extras = {}) {
  const projects = listProjects(db, user, now);
  const project = projects[0];
  return layout({
    title: 'Student · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    notice: extras.notice,
    error: extras.error,
    body: `<p class="kicker">learner</p>
    <h1>Your note</h1>
    <p class="row">${chip('Draft', 'draft')}<span>Signed in as ${esc(user.display_name)}. Only your draft.</span></p>
    ${project ? `<form class="card" method="post" action="/student/projects/${esc(project.id)}">
      ${hidden(session)}
      <label for="localProblem">Note</label>
      <textarea id="localProblem" name="localProblem" required minlength="8">${esc(project.local_problem)}</textarea>
      <p><button type="submit">Save draft</button></p>
    </form>` : '<p>No draft.</p>'}`,
  });
}

export function printPage(user, session) {
  return layout({
    title: 'Print sheet · afrobot evidence',
    user: user ? { ...user, csrf: session.csrf } : null,
    body: `<h1>Capture sheet</h1>
    <p>Empty on purpose. Write later. No learner names.</p>
    <table>
      <caption>Blank sheet. Nothing here is stored.</caption>
      <tbody>
        <tr><th>Date</th><td></td></tr>
        <tr><th>Starters</th><td></td></tr>
        <tr><th>Finishers</th><td></td></tr>
        <tr><th>Goal 4, 6, 12, or other</th><td></td></tr>
        <tr><th>Baseline or not measured</th><td></td></tr>
      </tbody>
    </table>`,
  });
}

export function exportPage(user, session, pack) {
  const files = Object.keys(pack.files).map((name) => `<li><a href="/exports/${esc(pack.manifest.pack_id)}/files/${esc(name)}">${esc(name)}</a></li>`).join('');
  return layout({
    title: 'Export · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    body: `<h1>Pack ready</h1>
    <p class="figure">${esc(pack.manifest.calculation.current.label || '—')}</p>
    <p>Earlier ${esc(pack.manifest.calculation.superseded?.label || '—')}</p>
    <ul>${files}</ul>`,
  });
}

export { homeFor };
