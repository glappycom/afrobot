import { comparisonPhrase, uncertaintyNote } from './compare.js';
import { DEMO_USERS, IDS } from './constants.js';
import { all, get } from './db.js';
import { comparisonViews, followupsFor, goalRollup, listClaims, listProjects, projectReport, traceClaim, visibleEvents } from './domain.js';
import { esc, rateLabel, sdgLabel, show } from './format.js';
import { accessReviewRows, custodyChain, displayId, filterEvents, formatStamps, gridClaims, integrityReport, provenanceDocument, retentionFor } from './records.js';

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
@media print{nav,form,details,footer,.appbar,.sidenav{display:none}body{background:#fff}}
body{background:#f5f5f5;color:#242424}
.app{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh}
.app>*{min-width:0}
.appbar{grid-column:1 / -1;display:flex;align-items:center;gap:12px;height:48px;padding:0 12px;background:#fff;border-bottom:1px solid #e0e0e0;position:sticky;top:0;z-index:5}
.sidenav{background:#fafafa;border-right:1px solid #e0e0e0;padding:8px;align-self:start;position:sticky;top:48px}
.sidenav a{display:block;padding:8px 10px;border-radius:4px;color:#242424;text-decoration:none}
.sidenav a[aria-current="page"]{background:#0E2747;color:#fff}
.workspace{padding:12px 16px 32px;overflow-x:auto}
table.grid{min-width:36rem}
.crumbs{font-size:13px;color:#242424;margin:0 0 8px}
.command{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}
.command a,.command button{font-size:14px;padding:6px 12px;min-height:32px}
table.grid{width:100%;border-collapse:collapse;background:#fff;font-size:14px}
table.grid th,table.grid td{border-bottom:1px solid #e0e0e0;padding:6px 8px;text-align:left;vertical-align:top}
table.grid td:first-child,table.grid th:first-child{white-space:nowrap}
table.grid th a{color:#0E2747}
.tabs{display:flex;gap:0;border-bottom:1px solid #e0e0e0;margin:8px 0}
.tabs a{padding:8px 12px;text-decoration:none;color:#242424}
.tabs a[aria-current="page"]{border-bottom:2px solid #0E2747;font-weight:500}
.rail{border:1px solid #e0e0e0;background:#fff;border-radius:4px;padding:12px}
.split{display:grid;grid-template-columns:minmax(0,1fr) 16rem;gap:16px;align-items:start}
@media (max-width:40rem){.split{grid-template-columns:1fr}}
.prov{background:#fff;border:1px solid #e0e0e0;border-radius:4px;overflow:auto}
.state{padding:16px;background:#fff;border:1px solid #e0e0e0}
.search{flex:1;display:flex;gap:6px}
.search input{max-width:28rem;border-color:#8a8886;border-radius:2px;padding:6px 8px;min-height:32px}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.badge{font-size:12px;border:1px solid #0E2747;border-radius:2px;padding:2px 6px;color:#0E2747}
details.menu{position:relative}
details.menu summary{list-style:none}
.menu-pop{position:absolute;right:0;background:#fff;border:1px solid #e0e0e0;padding:8px;min-width:14rem;z-index:6}
@media (max-width:40rem){
  .app{grid-template-columns:1fr}
  .sidenav{display:flex;gap:4px;overflow:auto;border-right:0;border-bottom:1px solid #e0e0e0}
  .sidenav a{white-space:nowrap}
}
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

function layout({ title, user, body, notice, error, db, now, crumb = 'Home', section = 'home', command = '' }) {
  const home = user ? homeFor(user.role) : '/login';
  const shell = user && db ? shellParts(db, user, now, section) : '';
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
${user && db ? `<div class="app">
<header class="appbar">
<a class="mark" href="${home}">afrobot</a>
<form method="get" action="${home}"><label class="sr" for="tenant">Organisation</label>
<select id="tenant" name="tenant"><option selected>AfroBot fictional pilot</option></select></form>
<form class="search" method="get" action="/search" role="search">
<label class="sr" for="q">Search records</label>
<input id="q" name="q" type="search" placeholder="Search">
<button type="submit">Search</button>
</form>
${shell}
</header>
<nav class="sidenav" aria-label="Sections">
<a href="${home}" ${section === 'home' ? 'aria-current="page"' : ''}>Home</a>
<a href="/records" ${section === 'records' ? 'aria-current="page"' : ''}>Records</a>
<a href="/audit" ${section === 'audit' ? 'aria-current="page"' : ''}>Audit log</a>
<a href="/integrity" ${section === 'integrity' ? 'aria-current="page"' : ''}>Integrity</a>
<a href="/access" ${section === 'access' ? 'aria-current="page"' : ''}>Access review</a>
<a href="/verify" ${section === 'verify' ? 'aria-current="page"' : ''}>Verify pack</a>
</nav>
<div class="workspace">
<p class="crumbs">afrobot / ${esc(crumb)}</p>
${command ? `<div class="command">${command}</div>` : ''}
<p id="loading" class="state" hidden role="status">Working…</p>
<main id="main">
<p class="banner">Synthetic demo. Mocked sign-in. No AI recommendations.</p>
${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
${body}
</main>
</div></div>` : `<header><a class="mark" href="${home}">afrobot</a></header><main id="main">
<p class="banner">Synthetic demo. Mocked sign-in. No AI recommendations.</p>
${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
${body}
</main>`}
<footer>Demo records controls. Not a certification. A digest shows a later change. It does not prove the first number was true.</footer>
<script src="/app.js"></script>
</body>
</html>`;
}

function shellParts(db, user, now, section) {
  const events = visibleEvents(db, user, now).slice(-3).reverse();
  const grant = get(db, 'SELECT expires_at, revoked_at FROM access_grants WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1', [user.id]);
  const expiry = grant && !grant.revoked_at ? grant.expires_at.slice(0, 10) : 'standing';
  const notes = events.map((event) => `<li>${esc(formatStamps(event.at).utc)} ${esc(event.action)}</li>`).join('') || '<li>No notices</li>';
  return `<details class="menu"><summary aria-label="Notifications">Bell ${events.length}</summary><div class="menu-pop"><ul>${notes}</ul></div></details>
<details class="menu"><summary>${esc(user.display_name)}</summary><div class="menu-pop">
<p><span class="badge">${esc(user.role)}</span></p>
<p>Access until ${esc(expiry)}</p>
<form method="post" action="/logout"><input type="hidden" name="_csrf" value="${esc(user.csrf)}"><button class="quiet" type="submit">Sign out</button></form>
</div></details>`;
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
    db, now, crumb: 'Home', section: 'home',
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
    db, now, crumb: 'Home', section: 'home',
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
    db, now, crumb: 'Home', section: 'home',
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
    db, now, crumb: 'Home', section: 'home',
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

export function printPage(db, user, now, session) {
  return layout({
    title: 'Print sheet · afrobot evidence',
    user: user ? { ...user, csrf: session.csrf } : null,
    db, now, crumb: 'Print sheet',
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

export function exportPage(db, user, now, session, pack) {
  const files = Object.keys(pack.files).map((name) => `<li><a href="/exports/${esc(pack.manifest.pack_id)}/files/${esc(name)}">${esc(name)}</a></li>`).join('');
  return layout({
    title: 'Export · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Export',
    body: `<h1>Pack ready</h1>
    <p class="figure">${esc(pack.manifest.calculation.current.label || '—')}</p>
    <p>Earlier ${esc(pack.manifest.calculation.superseded?.label || '—')}</p>
    <ul>${files}</ul>`,
  });
}

function commandLinks(base, view) {
  const views = [['all', 'All'], ['approved', 'Approved'], ['waiting', 'Waiting']];
  return views.map(([id, label]) => `<a href="${base}?view=${id}" ${view === id ? 'aria-current="page"' : ''}>${label}</a>`).join('');
}

export function recordsPage(db, user, now, session, query) {
  const grid = gridClaims(db, user, now, query);
  const cols = new Set((query.cols || 'record,status,total,date,school').split(','));
  const dir = grid.dir === 'asc' ? 'desc' : 'asc';
  const head = (key, label) => cols.has(key) ? `<th aria-sort="${query.sort === key ? grid.dir + 'ending' : 'none'}"><a href="/records?sort=${key}&dir=${query.sort === key ? dir : 'asc'}&view=${esc(query.view || 'all')}">${label}</a></th>` : '';
  const rows = grid.rows.map((row) => `<tr>
    ${cols.has('record') ? `<td><a href="/records/${esc(row.id)}">${esc(row.displayId)}</a></td>` : ''}
    ${cols.has('status') ? `<td>${statusChip(row.status)}</td>` : ''}
    ${cols.has('total') ? `<td>${esc(rateLabel(row.numerator, row.denominator) || '—')}</td>` : ''}
    ${cols.has('date') ? `<td>${esc(formatStamps(row.submitted_at || row.created_at, row.country).utc)}<br>${esc(formatStamps(row.submitted_at || row.created_at, row.country).local)}</td>` : ''}
    ${cols.has('school') ? `<td>${esc(row.schoolName)}</td>` : ''}
  </tr>`).join('');
  const empty = grid.total === 0 ? '<p class="state">No records in this view.</p>' : '';
  return layout({
    title: 'Records · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Records', section: 'records',
    command: `${commandLinks('/records', query.view || 'all')}<a href="/records?cols=record,status,total">Fewer columns</a><a href="/records?cols=record,status,total,date,school">All columns</a>`,
    body: `<h1>Records</h1>
    <form method="get" action="/records" class="command">
      <label for="status">Status</label>
      <select id="status" name="status"><option value="">Any</option><option>draft</option><option>submitted</option><option>returned</option><option>approved</option></select>
      <button type="submit">Filter</button>
    </form>
    ${empty || `<table class="grid" aria-label="Records" aria-rowcount="${grid.total}" aria-colcount="${cols.size}">
      <caption>Showing ${grid.rows.length ? `${(grid.page - 1) * grid.size + 1}–${(grid.page - 1) * grid.size + grid.rows.length}` : '0'} of ${grid.total}</caption>
      <thead><tr>${head('record', 'Record')}${head('status', 'Status')}${head('total', 'Total')}${head('date', 'When')}${head('school', 'School')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
    <p class="command"><span>Page ${grid.page}</span>${grid.page > 1 ? `<a href="/records?page=${grid.page - 1}">Previous</a>` : ''}${grid.page * grid.size < grid.total ? `<a href="/records?page=${grid.page + 1}">Next</a>` : ''}</p>`,
  });
}

export function recordPage(db, user, now, session, claimId, tab = 'overview') {
  const trace = traceClaim(db, user, claimId, now);
  const claim = trace.current || trace.requested;
  const school = get(db, 'SELECT country_name, display_name FROM schools WHERE id = ?', [claim.school_id]);
  const tabs = ['overview', 'evidence', 'calculation', 'versions', 'audit', 'access'];
  const tabNav = `<nav class="tabs" aria-label="Record sections">${tabs.map((name) => `<a href="/records/${esc(claim.id)}?tab=${name}" ${tab === name ? 'aria-current="page"' : ''}>${name[0].toUpperCase()}${name.slice(1)}</a>`).join('')}</nav>`;
  const prov = provenanceDocument(db, user, claim.id, now);
  const chain = custodyChain(db, user, claim.id, now);
  const schedule = retentionFor(db, 'claim');
  const when = formatStamps(claim.approved_at || claim.submitted_at || claim.created_at, school?.country_name);
  let panel = '';
  if (tab === 'evidence') {
    panel = trace.evidence.length ? `<ul>${trace.evidence.map((row) => `<li><a href="/evidence/${esc(row.id)}/download">${esc(displayId(row.id))}</a> ${esc(row.source_type)}</li>`).join('')}</ul>` : '<p class="state">No evidence in this view.</p>';
  } else if (tab === 'calculation') {
    panel = showHow(claim);
  } else if (tab === 'versions') {
    panel = timeline(trace.versions, trace.snapshots);
  } else if (tab === 'audit') {
    panel = chain.length ? `<ol>${chain.map((row) => `<li>${esc(formatStamps(row.at, school?.country_name).utc)} ${esc(row.actorRole)} ${esc(row.action)} ${esc(row.displayId)}</li>`).join('')}</ol>` : '<p class="state">No audit rows.</p>';
  } else if (tab === 'access') {
    panel = `<p>Scope ${esc(school?.display_name || '—')}. Dual control: a different person approves.</p>`;
  } else {
    const nodes = ['Claim', 'Calculation', 'Version', 'Evidence', 'Attestation'];
    panel = `<p class="figure">${esc(rateLabel(claim.numerator, claim.denominator) || '—')}</p>
    <div class="row">${statusChip(claim.status)} <span>${esc(displayId(claim.id))}</span></div>
    ${showHow(claim)}
    <svg class="prov" viewBox="0 0 760 90" role="img" aria-label="Provenance from claim to attestation">
      ${nodes.map((name, i) => `<g><rect x="${20 + i * 150}" y="20" width="120" height="48" rx="4" fill="#fff" stroke="#0E2747"/><text x="${80 + i * 150}" y="48" text-anchor="middle" font-size="13" fill="#0E2747">${name}</text>${i < nodes.length - 1 ? `<path d="M${140 + i * 150} 44h30" stroke="#0E2747" marker-end=""/>` : ''}</g>`).join('')}
    </svg>
    <p>${esc(when.utc)} · ${esc(when.local)}</p>`;
  }
  return layout({
    title: `${displayId(claim.id)} · afrobot evidence`,
    user: { ...user, csrf: session.csrf },
    db, now, crumb: `Records / ${displayId(claim.id)}`, section: 'records',
    command: `<a href="/records">Back to records</a>`,
    body: `<h1>${esc(displayId(claim.id))}</h1>
    ${tabNav}
    <div class="split">
      <div>${panel}</div>
      <aside class="rail">
        <p>Classification ${esc(schedule?.classification || 'internal')}</p>
        <p>Retention ${esc(schedule?.retention_label || '—')}</p>
        <p>${schedule?.retain_years ? `${schedule.retain_years} years, then ${esc(schedule.disposition)}` : esc(schedule?.disposition || 'keep')}</p>
        <p>${esc(school?.display_name || '')}</p>
        <p>Entities in provenance: ${Object.keys(prov.entity).length}</p>
      </aside>
    </div>`,
  });
}

export function auditPage(db, user, now, session, query) {
  const rows = filterEvents(db, user, now, query);
  const bodyRows = rows.slice(0, 50).map((event) => `<tr>
    <td>${esc(formatStamps(event.at).utc)}<br>${esc(formatStamps(event.at).local)}</td>
    <td>${esc(event.action)}</td>
    <td>${esc(event.actor_role)}</td>
    <td>${esc(displayId(event.subject_id))}</td>
  </tr>`).join('');
  return layout({
    title: 'Audit log · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Audit log', section: 'audit',
    command: `<a href="/audit.csv">Export CSV</a>`,
    body: `<h1>Audit log</h1>
    <form class="command" method="get" action="/audit">
      <label for="action">Action</label>
      <input id="action" name="action" value="${esc(query.action || '')}">
      <label for="from">From UTC</label>
      <input id="from" name="from" value="${esc(query.from || '')}">
      <label for="to">To UTC</label>
      <input id="to" name="to" value="${esc(query.to || '')}">
      <button type="submit">Filter</button>
    </form>
    ${rows.length ? `<table class="grid" aria-label="Audit log"><caption>${rows.length} events you can read</caption><thead><tr><th>When</th><th>Action</th><th>Role</th><th>Record</th></tr></thead><tbody>${bodyRows}</tbody></table>` : '<p class="state">No audit rows in this view.</p>'}`,
  });
}

export function integrityPage(db, user, now, session) {
  const rows = integrityReport(db, user, now);
  const bodyRows = rows.map((row) => `<tr>
    <td>${esc(row.displayId)}</td>
    <td>v${row.version}</td>
    <td><code title="${esc(row.stored)}">${esc(row.stored.slice(0, 16))}…</code></td>
    <td>${row.pass ? 'Pass' : 'Fail'}</td>
  </tr>`).join('');
  return layout({
    title: 'Integrity · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Integrity', section: 'integrity',
    body: `<h1>Integrity check</h1>
    <p>Each snapshot digest is recomputed and compared with the separate ledger.</p>
    ${rows.length ? `<table class="grid" aria-label="Integrity"><caption>${rows.filter((row) => row.pass).length} pass, ${rows.filter((row) => !row.pass).length} fail</caption><thead><tr><th>Snapshot</th><th>Version</th><th>SHA-256</th><th>Result</th></tr></thead><tbody>${bodyRows}</tbody></table>` : '<p class="state">No snapshots in your scope.</p>'}`,
  });
}

export function accessPage(db, user, now, session) {
  const rows = accessReviewRows(db, user, now);
  const bodyRows = rows.map((row) => `<tr>
    <td>${esc(row.user_id)}</td>
    <td>${esc(row.scope_id)}</td>
    <td>${esc(formatStamps(row.starts_at).utc)}</td>
    <td>${esc(formatStamps(row.expires_at).utc)}<br>${esc(formatStamps(row.expires_at).local)}</td>
    <td>${esc(row.displayState)}</td>
    <td>${user.role === 'organiser' && row.displayState === 'Active' ? `<form method="post" action="/api/grants/${esc(row.id)}/revoke">${hidden(session)}<button class="quiet" type="submit">Revoke</button></form>` : '—'}</td>
  </tr>`).join('');
  return layout({
    title: 'Access review · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Access review', section: 'access',
    body: `<h1>Access review</h1>
    <p>Time-boxed grants. Review them before they expire.</p>
    ${rows.length ? `<table class="grid" aria-label="Access grants"><thead><tr><th>Person</th><th>Scope</th><th>Starts UTC</th><th>Ends</th><th>State</th><th></th></tr></thead><tbody>${bodyRows}</tbody></table>` : '<p class="state">No grants in your scope.</p>'}`,
  });
}

export function verifyPage(user, session, result, db, now) {
  const table = result ? `<table class="grid" aria-label="Verify result"><caption>${result.pass ? 'Pass' : 'Fail'}</caption><thead><tr><th>Item</th><th>Kind</th><th>Result</th></tr></thead><tbody>${result.results.map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.kind)}</td><td>${row.pass ? 'Pass' : 'Fail'}</td></tr>`).join('')}</tbody></table>` : '<p class="state">Paste an export pack to check it.</p>';
  return layout({
    title: 'Verify · afrobot evidence',
    user: user ? { ...user, csrf: session.csrf } : null,
    db, now, crumb: 'Verify pack', section: 'verify',
    body: `<h1>Verify a pack</h1>
    <p>Paste the export JSON. The check uses only what you paste.</p>
    <form method="post" action="/verify">
      ${session ? hidden(session) : ''}
      <label for="pack">Pack JSON</label>
      <textarea id="pack" name="pack" required></textarea>
      <p><button type="submit">Check integrity</button></p>
    </form>
    ${table}`,
  });
}

export function searchPage(db, user, now, session, query, results) {
  return layout({
    title: 'Search · afrobot evidence',
    user: { ...user, csrf: session.csrf },
    db, now, crumb: 'Search',
    body: `<h1>Search</h1>
    ${results.length ? `<ul>${results.map((row) => `<li><a href="${row.type === 'claim' ? `/records/${esc(row.id)}` : '/records'}">${esc(row.displayId)}</a> ${esc(row.label)} ${statusChip(row.status)}</li>`).join('')}</ul>` : '<p class="state">No records in this view.</p>'}`,
  });
}

export { homeFor };
