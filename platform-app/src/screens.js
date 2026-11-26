import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readableSchools } from './access.js';
import { traceClaim } from './domain.js';
import { displayId } from './records.js';
import { get } from './db.js';
import { consentGaps, fallingBehind, joinCodeFor, learnersForSchool, needsQueue } from './experience.js';
import { approvedSessions, coachHistory, learnerProgress } from './operations.js';
import { IDS } from './constants.js';
import { esc, rateLabel } from './format.js';

const ICONS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/icons.html'), 'utf8');

function icon(name, size = '') {
  return `<svg class="i ${size}"><use href="#i-${name}"/></svg>`;
}

function hidden(session) {
  return `<input type="hidden" name="csrf" value="${esc(session.csrf)}">`;
}

function teamFor(schoolId) {
  return schoolId === 'sch-tz-lakeside'
    ? { name: 'Team Kilima', short: 'KL', stage: 'Build', chip: 'c-bui' }
    : { name: 'Team Sunbird', short: 'SB', stage: 'Build', chip: 'c-bui' };
}

function shell({ title, user, session, roleLabel, device, home, body, phone = false, bell = 0 }) {
  const initials = String(user.display_name || 'A').split(' ').map((part) => part[0]).join('').slice(0, 2);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/home.css"><style>body{font-family:PS,"Public Sans",sans-serif}</style></head><body class="${phone ? 'phone-app' : ''}">${ICONS}<a class="skip" href="#main">Skip to content</a><header class="shell"><div class="shell-in"><a href="${home}" aria-label="AfroBot platform home"><img class="mark" src="/logo-afrobot-navy.svg" alt="afrobot"></a><span class="prod">Platform</span><span class="viewas">View as</span><nav class="roles" aria-label="Signed-in role"><a class="on" href="${home}" aria-current="page">${esc(roleLabel)} <span class="dev">${esc(device)}</span></a></nav><span class="mocktag">Fictional data</span><div class="hbtns"><button class="ibtn" type="button" aria-label="Notifications, ${bell} unread">${icon('bell')}<span class="dot">${bell}</span></button><details class="menuwrap"><summary class="ibtn" aria-label="Profile and settings"><span class="me">${esc(initials)}</span></summary><div class="menu" role="menu"><b>${esc(user.display_name)}</b><a href="/settings">Settings</a><a href="/demo">Demo controls</a><form method="post" action="/logout">${hidden(session)}<button type="submit">Sign out</button></form></div></details></div></div></header><main id="main" tabindex="-1">${body}</main><footer class="appfoot">Preview v0.4</footer><div id="toasts" aria-live="polite"></div><script src="/home.js"></script></body></html>`;
}

function tabs(on) {
  const items = [['today', 'home', 'Today', '/coach'], ['team', 'users', 'Teams', '/coach/team'], ['log', 'plus', 'Log', '/coach/log'], ['subs', 'inbox', 'My logs', '/coach/logs']];
  return `<nav class="tabs" aria-label="Coach">${items.map(([key, ic, label, href]) => `<a href="${href}" class="${key === on ? 'on' : ''}" ${key === on ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
}

function phone(inner, tab) {
  return `<div class="stage-phone"><div class="phone"><div class="sbar" aria-hidden="true"><span>9:41</span></div><div class="scr">${inner}</div>${tabs(tab)}</div></div>`;
}

export function coachScreen(db, user, now, session, extras = {}) {
  const membership = get(db, 'SELECT * FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const school = membership ? get(db, 'SELECT * FROM schools WHERE id = ?', [membership.school_id]) : null;
  const team = teamFor(school?.id);
  const gaps = membership ? consentGaps(db, [membership.school_id]) : [];
  const code = membership ? joinCodeFor(db, membership.cohort_id) : null;
  const pace = membership ? fallingBehind(db, membership.cohort_id) : null;
  const gapNote = gaps.length
    ? `<div class="banner warn" role="status" style="margin:16px 20px 0">${icon('alert')}<div><b>Student ${esc(gaps.map((row) => row.letter).join(', '))} ${gaps.length === 1 ? 'is' : 'are'} hidden from logging until consent is in.</b><span>Ask the organiser. ${esc(school?.display_name || '')}.</span></div></div>`
    : '';
  const behind = pace?.behind
    ? `<a href="/coach/logs"><span class="ic" style="background:#FBECE6;color:#8C2A0A">${icon('chart')}</span><span class="tx"><b>This team is falling behind</b><span>${pace.done} of ${pace.planned} challenges, ${pace.weeks_left} weeks left</span></span><span class="chev">${icon('chev', 'sm')}</span></a>`
    : '';
  const body = phone(`<div class="greet"><div class="d">Thursday 26 Nov <span class="mtag">Fictional</span></div><h1>Good morning,<br>${esc(user.display_name)}</h1></div>
    <div class="cta"><a class="btn p big xl" href="/coach/log">${icon('plus', 'lg')} Log a session<span class="sub3">Photo, skills, save. About 20 seconds.</span></a>
    <a class="btn o big" href="/coach/capture">Capture a session</a>
    <a class="btn o big" href="/coach/result">Send a result without a photo</a></div>
    ${extras.error ? `<p role="alert">${esc(extras.error)}</p>` : ''}
    ${gapNote}
    <div class="sect"><h3>This week</h3><span>3 sessions</span></div>
    <div class="week">
      <div class="day"><div class="w">Mon</div><div class="n">23</div><div class="dt"></div></div>
      <div class="day"><div class="w">Tue</div><div class="n">24</div><div class="dt"><i class="done"></i></div></div>
      <div class="day"><div class="w">Wed</div><div class="n">25</div><div class="dt"></div></div>
      <div class="day today"><div class="w">Thu</div><div class="n">26</div><div class="dt"><i></i></div></div>
      <div class="day"><div class="w">Fri</div><div class="n">27</div><div class="dt"></div></div>
      <div class="day"><div class="w">Sat</div><div class="n">28</div><div class="dt"><i></i></div></div>
    </div>
    <div class="sect"><h3>Needs you</h3><a href="/coach/logs">See all</a></div>
    <div class="due">
      ${behind}
      <a href="/coach/logs"><span class="ic" style="background:#EEF1F4;color:#4E5D73">${icon('file')}</span><span class="tx"><b>Sessions not sent yet</b><span>Only you can see these</span></span><span class="chev">${icon('chev', 'sm')}</span></a>
      <a href="/coach/logs"><span class="ic" style="background:#E9EFF7;color:#163A66">${icon('clock')}</span><span class="tx"><b>Today, 15:30</b><span>${esc(team.name)} · ${esc(school?.display_name || '')}</span></span><span class="chev">${icon('chev', 'sm')}</span></a>
    </div>
    <div class="sect"><h3>Your teams</h3><a href="/coach/team">Open</a></div>
    <div class="teams"><a class="card hov team" href="/coach/team"><div class="top"><div><h4>${esc(team.name)}</h4><div class="sub">${esc(school?.display_name || '')} · fictional</div></div></div><div class="stack">${['A', 'B'].map((letter) => `<span class="av xs">${letter}</span>`).join('')}</div><div class="foot"><span class="chip ${team.chip}">${team.stage}</span><span>Next: today</span></div></a></div>
    <div class="codebox"><span>Family join code</span><b class="mono">${esc(code?.code || '')}</b><button class="copy" type="button" data-copy="${esc(code?.code || '')}" aria-label="Copy join code">${icon('copy')}</button><small>One code for students and families. Share it at the next session.</small></div>
    <div class="sect"><h3>Recent logs</h3></div>
    <div class="due"><div class="rl"><span class="ic" style="background:#E8F3EC;color:#1B6B3A">${icon('check')}</span><span class="tx"><b>${esc(team.name)}</b><span>Sent by you · Approved by your organiser</span></span></div></div>`, 'today');
  return shell({ title: 'Today · afrobot', user, session, roleLabel: 'Coach', device: 'Phone', home: '/coach', body, phone: true, bell: gaps.length || 1 });
}

export function resultScreen(db, user, session) {
  const body = phone(`<div class="appbar"><a class="back" href="/coach" aria-label="Back to Today">${icon('back')}</a><div><div class="t">Result</div><h1 style="font-size:20px">Attendance and result</h1></div></div>
    <p class="qs">A photo is optional. Starters, completions, and your confirmation are enough. Do not include student names or faces.</p>
    <form id="result-form" class="pad">${hidden(session)}
      <label for="numerator">Completions</label><input id="numerator" name="numerator" inputmode="numeric">
      <label for="denominator">Starters</label><input id="denominator" name="denominator" inputmode="numeric">
      <p id="sync-status" role="status">Saved on this device</p>
      <p id="sync-detail"></p>
      <p><button class="btn p big" id="submit-result" type="submit">Send</button></p>
      <p><button class="btn o big" id="retry-result" type="button">Retry</button></p>
      <div id="paper-fallback" hidden><p>This browser cannot store the draft. Keep this tab open, or print this page and enter the same counts when you are back online.</p><button class="btn g" type="button" id="print-result">Print a paper copy</button></div>
    </form>`, 'log');
  return shell({ title: 'Result · afrobot', user, session, roleLabel: 'Coach', device: 'Phone', home: '/coach', body: body.replace('</body>', '<script src="/result.js"></script></body>'), phone: true, bell: 1 }).replace('</body>', '<script src="/result.js"></script></body>');
}

export function logScreen(db, user, session, step = '1') {
  const membership = get(db, 'SELECT * FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const school = membership ? get(db, 'SELECT * FROM schools WHERE id = ?', [membership.school_id]) : null;
  const team = teamFor(school?.id);
  const kids = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const names = kids.map((row) => `Student ${row.letter}`).join(' and ');
  const marks = [['1', 'Photo'], ['2', 'Skills'], ['3', 'Save']].map(([n, label], index) => {
    const current = step === 'saved' ? 3 : Number(step);
    const cls = current === index + 1 ? 'on' : current > index + 1 ? 'done' : '';
    return `<li class="${cls}"><span>${n}</span>${label}</li>`;
  }).join('');
  let inner = '';
  if (step === '2') {
    inner = `<h2 class="q">What did you work on?</h2><p class="qs">${esc(names)} are here. Today's plan is ticked.</p>
      <form method="post" action="/coach/log/save">${hidden(session)}<input type="hidden" name="letters" value="${esc(kids.map((row) => row.letter).join(','))}">
      <div class="acts skills"><label class="act sel"><input type="checkbox" name="skills" value="line-following" checked> Line-following</label><label class="act sel"><input type="checkbox" name="skills" value="testing" checked> Testing and fixing</label></div>
      <div class="dock"><button class="btn p big" type="submit">${icon('check', 'sm')} Save session</button></div></form>`;
  } else if (step === 'saved') {
    inner = `<div class="saved"><div class="big pop">${icon('check')}</div><h2>Saved and sent</h2><p>Your organiser usually looks within 2 days.</p>
      <ol class="ptl" aria-label="What happens to this session"><li class="done"><b>Saved</b><span>Just now · by you</span></li><li class="done"><b>Sent to your organiser</b><span>Just now</span></li><li class="next"><b>Approved by your organiser</b><span>Usually within 2 days</span></li></ol>
      <a class="btn p big" href="/coach">Done</a></div>`;
  } else {
    inner = `<h2 class="q">Add a photo of the build</h2><p class="qs">Point the camera at the robot, not at people. ${esc(names)}.</p>
      <div class="camgrid"><a class="camtile" href="/coach/log/2">${icon('cam', 'lg')}<b>Take photo</b><span>Stays on this phone</span></a><a class="camtile g" href="/coach/log/2">${icon('file', 'lg')}<b>Choose a photo</b><span>From this phone</span></a></div>
      <p class="facenote">${icon('eye', 'sm')} Photos stay on this phone until you choose to send one. A picture is about 40 KB.</p>
      <a class="skiplink" href="/coach/log/2">No photo today</a>`;
  }
  const body = phone(`<div class="appbar"><a class="back" href="/coach" aria-label="Back to Today">${icon('back')}</a><div><div class="t">Log a session</div></div><span class="mtag" style="margin-left:auto">Fictional</span></div>
    <div class="qctx"><span class="av sm" aria-hidden="true">${esc(team.short)}</span><span><b>${esc(team.name)} · today 15:30</b><span>${esc(names || 'No one to log')}</span></span></div>
    <ol class="tapdots" aria-label="Progress">${marks}</ol>${inner}`, 'log');
  return shell({ title: 'Log · afrobot', user, session, roleLabel: 'Coach', device: 'Phone', home: '/coach', body, phone: true, bell: 1 });
}

export function coachLogsScreen(db, user, now, session, extras = {}) {
  const rows = coachHistory(db, user, now).filter((row) => row.meetingId);
  const notice = extras.notice ? `<p role="status">${esc(extras.notice)}</p>` : '';
  const list = rows.length
    ? `<ul>${rows.map((row) => `<li><b>${esc(row.label)}</b> v${esc(row.version)} ${esc(row.statusLabel)} ${esc(row.figure || '')}${row.why ? ` Why: ${esc(row.why)}` : ''}${row.canFix ? ` <a href="/coach/fix/${esc(row.id)}">Fix and resubmit</a>` : ''}</li>`).join('')}</ul>`
    : '<p>No session has been sent yet.</p>';
  const body = phone(`<div class="appbar"><a class="back" href="/coach" aria-label="Back">${icon('back')}</a><div><div class="t">My logs</div><h1 style="font-size:20px">Session history</h1></div></div>
    ${notice}${list}
    <p class="pad" style="padding:16px 20px">Pending sync stays on this device until Send succeeds. Sent means the server returned a record id.</p>`, 'subs');
  return shell({ title: 'My logs · afrobot', user, session, roleLabel: 'Coach', device: 'Phone', home: '/coach', body, phone: true, bell: 1 });
}

export function coachTeamScreen(db, user, session) {
  const membership = get(db, 'SELECT * FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
  const school = membership ? get(db, 'SELECT * FROM schools WHERE id = ?', [membership.school_id]) : null;
  const team = teamFor(school?.id);
  const code = membership ? joinCodeFor(db, membership.cohort_id) : null;
  const kids = membership ? learnersForSchool(db, membership.school_id, { logging: true }) : [];
  const body = phone(`<div class="appbar"><a class="back" href="/coach" aria-label="Back">${icon('back')}</a><div><div class="t">Your teams</div><h1 style="font-size:20px">${esc(team.name)}</h1></div></div>
    <p class="qs">${esc(school?.display_name || '')}</p>
    <ul class="due">${kids.map((row) => `<li class="rl"><span class="av xs">${esc(row.letter)}</span><span class="tx"><b>Student ${esc(row.letter)}</b><span>Can be logged</span></span></li>`).join('')}</ul>
    <div class="codebox"><span>Family join code</span><b class="mono">${esc(code?.code || '')}</b><button class="copy" type="button" data-copy="${esc(code?.code || '')}" aria-label="Copy join code">${icon('copy')}</button><small>One code for students and families.</small></div>`, 'team');
  return shell({ title: 'Teams · afrobot', user, session, roleLabel: 'Coach', device: 'Phone', home: '/coach', body, phone: true, bell: 1 });
}

function studentTabs(on, family = false) {
  const items = family
    ? [['home', 'home', 'Home', '/student/family'], ['journey', 'compass', 'Journey', '/student/journey'], ['details', 'file', 'Details', '/student/family'], ['settings', 'gear', 'Settings', '/settings']]
    : [['home', 'home', 'Home', '/student'], ['journey', 'compass', 'Journey', '/student/journey'], ['badges', 'star', 'Badges', '/student'], ['family', 'user', 'Family', '/student/family']];
  return `<nav class="tabs" aria-label="${family ? 'Family' : 'Student'}">${items.map(([key, ic, label, href]) => `<a href="${href}" class="${key === on ? 'on' : ''}">${icon(ic)}${label}</a>`).join('')}</nav>`;
}

export function journeyScreen(db, user, session) {
  const body = `<div class="stage-phone"><div class="phone"><div class="sbar" aria-hidden="true"><span>9:41</span></div><div class="scr">
    <div class="appbar"><span class="av" aria-hidden="true">A</span><div><div class="t">Team Sunbird</div><h1 style="font-size:20px">Your journey</h1></div><span class="mtag" style="margin-left:auto">Fictional</span></div>
    <div class="jhead"><span>You're in <b>Build</b></span><span class="num">6 of 9 challenges</span><div class="xp2"><i style="width:66%"></i></div></div>
    <div class="jmap" role="list" aria-label="Stages of the journey">
      <svg class="jpath" viewBox="0 0 350 700" aria-hidden="true" preserveAspectRatio="none"><path d="M46 44 V124 Q46 140 62 140 H288 Q304 140 304 156 V274 Q304 290 288 290 H62 Q46 290 46 306 V424 Q46 440 62 440 H288 Q304 440 304 456 V574 Q304 590 288 590 H62 Q46 590 46 606 V644" fill="none" stroke="#C9D1DB" stroke-width="4" stroke-dasharray="1 9" stroke-linecap="round"/><path d="M46 44 V124 Q46 140 62 140 H288 Q304 140 304 156 V194" fill="none" stroke="#0E6E62" stroke-width="4" stroke-linecap="round"/><path d="M304 194 V274 Q304 290 288 290 H190" fill="none" stroke="#3A3F8C" stroke-width="4" stroke-linecap="round"/></svg>
      <div class="jn done l" role="listitem" style="top:16px"><span class="dot" style="background:#0E6E62">${icon('compass')}</span><div class="jt"><span class="chip c-dis">Discover</span><b>Finished in October</b><div class="mb"><span class="ml">2 badges</span></div></div></div>
      <div class="jn cur r" role="listitem" style="top:166px"><span class="dot" style="background:#3A3F8C">${icon('wrench')}</span><div class="jt"><span class="cr"><span class="here">${icon('pin', 'sm')} You are here</span><span class="chip c-bui">Build</span></span><b>Make robots move and sense</b><div class="mb"><span class="ml">Next: Sensor scout</span></div></div></div>
      <div class="jn l lock" role="listitem" style="top:316px"><span class="dot">${icon('bulb')}</span><div class="jt"><span class="chip c-inn">Innovate</span><b>Solve a problem near you</b></div></div>
      <div class="jn r lock" role="listitem" style="top:466px"><span class="dot">${icon('trophy')}</span><div class="jt"><span class="chip c-com">Compete</span><b>Show your robot at a meet-up</b></div></div>
      <div class="jn l lock" role="listitem" style="top:616px"><span class="dot">${icon('rocket')}</span><div class="jt"><span class="chip c-adv">Advance</span><b>Help younger students</b></div></div>
    </div>
    <p class="sr">Signed in as ${esc(user.display_name)}.</p>
  </div>${studentTabs('journey')}</div></div>`;
  return shell({ title: 'Journey · afrobot', user, session, roleLabel: 'Student & parent', device: 'Phone', home: '/student', body, phone: true, bell: 0 });
}

export function familyScreen(db, user, session) {
  const code = joinCodeFor(db, IDS.cohortCm);
  const progress = learnerProgress(db, user);
  const body = `<div class="stage-phone"><div class="phone"><div class="sbar" aria-hidden="true"><span>9:41</span></div><div class="scr">
    <div class="appbar"><div><div class="t">Family</div><h1 style="font-size:20px">Good afternoon</h1></div><span class="mtag" style="margin-left:auto">Fictional</span></div>
    <div class="kidcard card"><span class="kav" aria-hidden="true">A</span><div><b>Student A</b><span>Team Sunbird · Coach A</span><span class="lk">${icon('link', 'sm')} Linked with ${esc(code?.code || '')}</span></div><span class="chip c-bui" style="margin-left:auto">Build</span></div>
    <div class="week2 card"><div class="wk"><span>${icon('sparkle', 'sm')}</span><h3>This week</h3><span>23–26 Nov</span></div><ul><li>Came to <b>${progress ? `${progress.came} of ${progress.total}` : '0 of 0'}</b> sessions.</li><li>Session counts come from records sent by the coach.</li></ul></div>
    <div class="sect"><h3>Student A's journey</h3><a href="/student/journey">Open</a></div>
    <ol class="hjour" aria-label="Journey"><li class="done"><i style="background:#0E6E62">${icon('check', 'sm')}</i>Discover</li><li class="cur"><i style="background:#3A3F8C">${icon('wrench', 'sm')}</i>Build<em>Now</em></li><li><i>${icon('bulb', 'sm')}</i>Innovate</li><li><i>${icon('trophy', 'sm')}</i>Compete</li><li><i>${icon('rocket', 'sm')}</i>Advance</li></ol>
    <div class="sect"><h3>Latest from the team</h3></div>
    <div class="due"><div class="rl"><span class="ic" style="background:#E8F3EC;color:#1B6B3A">${icon('check')}</span><span class="tx"><b>Tuesday's session</b><span>Sent Tue by Coach A · Approved Thu by the organiser</span></span></div></div>
  </div>${studentTabs('home', true)}</div></div>`;
  return shell({ title: 'This week · afrobot', user, session, roleLabel: 'Student & parent', device: 'Phone', home: '/student/family', body, phone: true, bell: 0 });
}

function needList(db, user, now, session) {
  const items = needsQueue(db, user, now);
  let html = '';
  let last = '';
  let n = 0;
  for (const item of items) {
    if (item.group !== last) {
      html += `<li class="ngrp">${esc(item.group)}</li>`;
      last = item.group;
    }
    n += 1;
    html += `<li class="need${n === 1 ? ' top' : ''}"><span class="rk">${n}</span><span class="nic" style="background:#EEF1F4;color:#4E5D73">${icon('flag')}</span><div class="nb"><b>${esc(item.title)}</b><p><span class="why">${esc(item.why.split(':')[0])}:</span> ${esc(item.why.slice(item.why.indexOf(':') + 1).trim())}</p><div class="nm"><span>${esc(item.meta || '')}</span></div></div><form method="post" action="/organiser/needs/act">${hidden(session)}<input type="hidden" name="id" value="${esc(item.id)}"><button class="btn ${n === 1 ? 'p' : 'o'}" type="submit">${esc(item.action)}</button><button class="btn g" type="submit" name="undo" value="1">Undo</button></form></li>`;
  }
  return { html, count: n };
}

export function organiserScreen(db, user, now, session, extras = {}) {
  const { html, count } = needList(db, user, now, session);
  const toast = extras.notice ? `<div class="toast" role="status">${esc(extras.notice)} <a href="/organiser/needs">Undo</a></div>` : '';
  const problem = extras.error ? `<p role="alert">${esc(extras.error)}</p>` : '';
  const body = `<div class="desk"><aside class="rail"><div class="org"><span class="av sm">OA</span><div><b>${esc(user.display_name)}</b><span>Season 2026 · 2 schools</span></div></div>
    <a class="on" href="/organiser/needs" aria-current="page">${icon('flag')} What needs me <span class="ct">${count}</span></a>
    <a href="/organiser/tracking">${icon('grid')} Session tracking</a>
    <a href="/organiser/admin">${icon('cal')} Add a club</a>
    <a href="/demo">${icon('inbox')} Approvals</a>
    <a href="/organiser/setup">${icon('cal')} Season setup</a>
    <a href="/settings">${icon('gear')} Settings</a>
    <div class="bottom">North Ridge and Lakeside are fictional schools.</div></aside>
    <div class="main"><div class="ph"><div><nav class="crumbs" aria-label="Breadcrumb"><a href="/organiser">Season 2026</a>${icon('chev')}<span aria-current="page">What needs me</span></nav><h1>What needs me</h1><span class="chip c-bui">Build</span></div><div class="r"><span style="font-size:14px;color:var(--mute)">${count} things · ranked by what blocks teams</span></div></div>
    <ol class="needs">${html}</ol>${problem}${toast}</div></div>`;
  return shell({ title: 'What needs me · afrobot', user, session, roleLabel: 'Organiser', device: 'Desktop', home: '/organiser', body, phone: false, bell: count });
}

export function auditorScreen(db, user, session) {
  const schools = readableSchools(db, user, new Date().toISOString()).map((id) => get(db, 'SELECT display_name FROM schools WHERE id = ?', [id])?.display_name).filter(Boolean);
  const scope = schools.length ? schools.join(', ') : 'Assigned schools';
  const body = `<div class="desk aud"><aside class="rail"><div class="org"><span class="av sm" style="background:#fff;color:#0E2747">AU</span><div><b>${esc(user.display_name)}</b><span>Read-only access</span></div></div>
    <a class="on" href="/auditor" aria-current="page">${icon('file')} Records</a>
    <a href="/records/${IDS.claimV2}">${icon('link')} Trace</a>
    <a href="/audit">${icon('hist')} Version history</a>
    <a href="/integrity">${icon('shield')} Integrity check</a>
    <a href="/auditor">${icon('box')} Audit pack</a>
    <a href="/access">${icon('lock')} Access review</a>
    <a href="/verify">${icon('check')} Verify pack</a>
    <div class="bottom">This workspace can't change records.</div></aside>
    <div class="main"><div class="trust" role="region" aria-label="Workspace status">${icon('lock', 'sm')}<span><b>Read-only</b> · view, trace, export</span></div>
    <div class="ph"><div><nav class="crumbs" aria-label="Breadcrumb"><span>Season 2026</span>${icon('chev')}<span>${esc(scope)}</span></nav><h1>Assigned records</h1><span class="chip c-bui">Build</span></div>
    <div class="r"><form method="post" action="/auditor/exports/${IDS.claimV2}/export">${hidden(session)}<button class="btn p" type="submit">${icon('down', 'sm')} Export pack</button></form></div></div>
    <p><a href="/records/${IDS.claimV2}">Open the trace</a> · <a href="/demo">Show how</a></p>
    ${approvedSessions(db, user, new Date().toISOString()).map((row) => `<p><a href="/auditor/trace/${esc(row.id)}">${esc(row.label)} · ${esc(row.figure || '')}</a></p>`).join('') || '<p>No approved session records yet.</p>'}
    <p class="note">A digest shows a later change. It does not delete the earlier record.</p></div></div>`;
  return shell({ title: 'Records · afrobot', user, session, roleLabel: 'Auditor', device: 'Read-only', home: '/auditor', body, phone: false, bell: 0 });
}

export function traceResultScreen(db, user, now, session, claimId) {
  const trace = traceClaim(db, user, claimId, now);
  const claim = trace.current || trace.requested;
  const snapshot = trace.snapshots.find((row) => row.subject_id === claim.id) || trace.snapshots.at(-1);
  const source = trace.evidence.map((row) => row.body_redacted).filter(Boolean).join(' ') || 'No redacted note yet.';
  const figure = rateLabel(claim.numerator, claim.denominator) || '—';
  const body = `<div class="desk aud"><aside class="rail"><div class="org"><span class="av sm" style="background:#fff;color:#0E2747">AU</span><div><b>${esc(user.display_name)}</b><span>Read-only</span></div></div>
    <a href="/auditor">${icon('file')} Records</a>
    <a class="on" href="/auditor/trace/${esc(claim.id)}" aria-current="page">${icon('link')} Trace</a></aside>
    <div class="main"><div class="ph"><div><nav class="crumbs" aria-label="Breadcrumb"><a href="/auditor">Records</a>${icon('chev')}<span>${esc(displayId(claim.id))}</span></nav>
    <h1>${esc(figure)}</h1></div></div>
    <p>Numerator ${esc(claim.numerator)}. Denominator ${esc(claim.denominator)}. Reporting period ${esc(claim.window_start)} to ${esc(claim.window_end)}. Approved version ${esc(claim.version)} · ${esc(displayId(claim.id))}.</p>
    <section class="card"><h2>File integrity checks</h2><p>These checks only say whether the file is unchanged since approval. SHA-256 ${esc(snapshot?.digest_sha256 || 'not approved yet')}.</p></section>
    <section class="card"><h2>Evidence supporting the claim</h2><p>Redacted source: ${esc(source)}</p><p>Attendance list and project result: ${esc(claim.numerator)} completions of ${esc(claim.denominator)} starters. Coach attestation is the redacted note. Organiser approval is version ${esc(claim.version)}.</p></section>
    </div></div>`;
  return shell({ title: 'Trace · afrobot', user, session, roleLabel: 'Auditor', device: 'Read-only', home: '/auditor', body, phone: false, bell: 0 });
}
