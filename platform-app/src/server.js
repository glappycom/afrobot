import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readableSchools, userById, userByUsername } from './access.js';
import { DEMO_USERS } from './constants.js';
import { get, insert, openDatabase, run } from './db.js';
import { openHostedDatabase } from './hosted-db.js';
import {
  addEvent,
  addEvidence,
  approveClaim,
  approveVerifiedOutcome,
  cloneSeasonMaterials,
  completeFromPracticeLesson,
  listClaims,
  listProjects,
  readEvidenceBody,
  resubmitClaim,
  returnClaim,
  revokeGrant,
  saveClaimDraft,
  submitClaim,
  submitIdempotentResult,
  submitCorrection,
  submitResultCorrection,
  traceClaim,
  updateStudentDraft,
  visibleEvents,
  withdrawEvidence,
} from './domain.js';
import { createExport, readExport } from './export-pack.js';
import {
  accessReviewRows,
  buildAuditZip,
  eventsCsv,
  filterEvents,
  integrityReport,
  placeLegalHold,
  provenanceDocument,
  releaseLegalHold,
  retentionSchedule,
  searchRecords,
  verifyPastedPack,
} from './records.js';
import { consentGaps, saveSessionLog } from './experience.js';
import { liteHome } from './experience.js';
import { HttpError, notFound } from './http-error.js';
import { hashPassword, passwordIsHashed, verifyPassword } from './passwords.js';
import { pageAllowed } from './routes.js';
import { IDS } from './constants.js';
import {
  accessPage,
  auditPage,
  auditorPage,
  traceResultScreen,
  resultScreen,
  coachPage,
  exportPage,
  familyPage,
  integrityPage,
  journeyPage,
  logPage,
  loginPage,
  logsPage,
  needsPage,
  organiserPage,
  settingsPage,
  setupPage,
  printPage,
  recordPage,
  recordsPage,
  searchPage,
  studentPage,
  teamPage,
  demoPage,
  unavailablePage,
  verifyPage,
} from './render.js';
import { seedAll } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COOKIE = 'afrobot_demo';

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function wantsJson(req) {
  return (req.url || '').startsWith('/api') || String(req.headers.accept || '').includes('application/json');
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, 'That upload is too large for this demo.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readInput(req) {
  const raw = await readBody(req);
  const type = String(req.headers['content-type'] || '');
  if (!raw) return {};
  if (type.includes('application/json')) {
    try { return JSON.parse(raw); } catch { throw new HttpError(400, 'The request was not valid JSON.'); }
  }
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, `${JSON.stringify(payload)}\n`, { 'content-type': 'application/json; charset=utf-8' });
}

function sendHtml(res, status, html) {
  send(res, status, html, { 'content-type': 'text/html; charset=utf-8' });
}

const NOTICES = {
  submitted: 'Submitted. A different person has to approve it.',
  approved: 'Approved. The earlier snapshot is still stored.',
  returned: 'Sent back to the coach.',
  corrected: 'Correction submitted. The previous approved version is unchanged.',
  exported: 'Export recorded.',
  drafted: 'Draft saved. The missing denominator stays blank.',
  withdrawn: 'The removable file is withdrawn.',
  cloned: 'Approved coach materials were copied. Learner records were not.',
  held: 'Hold recorded.',
  saved: 'Saved.',
  verified: 'Verified outcome approved. The project is still counted once.',
};

function coachSchool(db, user) {
  return get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach'])?.school_id;
}

function stamp(now) {
  return typeof now === 'function' ? now() : now;
}

const DUMMY_HASH = hashPassword('not-a-real-password');
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

function seedDemoOnce(db, filesDir, story) {
  if (db.driver === 'neon') db.exec('SELECT pg_advisory_lock(4815162342)');
  try {
    const count = Number(get(db, 'SELECT COUNT(*) AS n FROM users')?.n || 0);
    if (count === 0) {
      try {
        seedAll(db, { filesDir, story });
      } catch (error) {
        if (Number(get(db, 'SELECT COUNT(*) AS n FROM users')?.n || 0) === 0) throw error;
      }
    }
    for (const row of DEMO_USERS) {
      const existing = get(db, 'SELECT id, password FROM users WHERE username = ?', [row.username]);
      if (existing && !passwordIsHashed(existing.password)) {
        run(db, 'UPDATE users SET password = ? WHERE id = ?', [hashPassword(row.password), existing.id]);
      }
    }
  } finally {
    if (db.driver === 'neon') db.exec('SELECT pg_advisory_unlock(4815162342)');
  }
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'local';
}

function sessionCookie(id, req, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https';
  return `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function attemptRow(db, subject) {
  return get(db, 'SELECT * FROM login_attempts WHERE subject = ?', [subject]);
}

function loginLocked(db, username, ip, now) {
  for (const subject of [`user:${username}`, `ip:${ip}`]) {
    const row = attemptRow(db, subject);
    if (row?.locked_until && row.locked_until > now) return true;
  }
  return false;
}

function recordFailure(db, username, ip, now) {
  for (const subject of [`user:${username}`, `ip:${ip}`]) {
    const row = attemptRow(db, subject);
    const failures = (row?.failures || 0) + 1;
    const lockedUntil = failures >= LOCK_AFTER ? new Date(Date.parse(now) + LOCK_MS).toISOString() : null;
    if (!row) insert(db, 'login_attempts', { subject, failures, locked_until: lockedUntil, updated_at: now });
    else run(db, 'UPDATE login_attempts SET failures = ?, locked_until = ?, updated_at = ? WHERE subject = ?', [failures, lockedUntil, now, subject]);
  }
}

function clearFailures(db, username) {
  run(db, 'DELETE FROM login_attempts WHERE subject = ?', [`user:${username}`]);
}

function needSchool(db, needId) {
  if (needId.startsWith('need-pace-') || needId.startsWith('need-ok-')) {
    const cohortId = needId.replace(/^need-(?:pace|ok)-/, '');
    return get(db, 'SELECT school_id FROM cohorts WHERE id = ?', [cohortId])?.school_id || null;
  }
  if (needId.startsWith('need-renew-')) {
    return get(db, 'SELECT school_id FROM learners WHERE id = ?', [needId.slice('need-renew-'.length)])?.school_id || null;
  }
  if (needId.startsWith('need-')) {
    const rest = needId.slice('need-'.length);
    return get(db, 'SELECT school_id FROM learners WHERE id = ?', [rest])?.school_id
      || get(db, 'SELECT school_id FROM claims WHERE id = ?', [rest])?.school_id
      || null;
  }
  return null;
}

export function createApp(options = {}) {
  const hostedUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const hosted = Boolean(process.env.VERCEL && hostedUrl);
  const dbPath = options.dbPath || path.join(ROOT, 'data', 'demo.sqlite');
  const filesDir = options.filesDir || (hosted ? '/tmp/afrobot-files' : path.join(ROOT, 'data', 'files'));
  const now = options.now || (() => new Date().toISOString());
  fs.mkdirSync(filesDir, { recursive: true });
  const db = hosted ? openHostedDatabase(hostedUrl) : openDatabase(dbPath, options.ledgerPath);
  const demoSeed = options.demoSeed === true || process.env.AFROBOT_DEMO_SEED === 'true';
  if (demoSeed) seedDemoOnce(db, filesDir, options.story !== false);

  function sessionUser(req) {
    const id = cookies(req)[COOKIE];
    if (!id) return null;
    const row = get(db, 'SELECT * FROM sessions WHERE id = ?', [id]);
    if (!row || row.expires_at <= stamp(now)) return null;
    const user = userById(db, row.user_id);
    if (!user) return null;
    return { user, session: row };
  }

  function startSession(user) {
    const id = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    const created = stamp(now);
    const expires = new Date(Date.parse(created) + 8 * 60 * 60 * 1000).toISOString();
    insert(db, 'sessions', { id, user_id: user.id, csrf, created_at: created, expires_at: expires });
    return { id, csrf };
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const method = req.method || 'GET';
      if (pathname === '/home.css' && method === 'GET') {
        return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'home.css')), { 'content-type': 'text/css; charset=utf-8' });
      }
      if (pathname === '/result.js' && method === 'GET') {
        return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'result.js')), { 'content-type': 'text/javascript; charset=utf-8' });
      }
      if (pathname === '/home.js' && method === 'GET') {
        return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'home.js')), { 'content-type': 'text/javascript; charset=utf-8' });
      }
      if (pathname === '/app.js' && method === 'GET') {
      const file = path.join(ROOT, 'public', 'app.js');
      return send(res, 200, fs.readFileSync(file), { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' });
    }
    if (pathname === '/logo-afrobot-navy.svg' && method === 'GET') {
      return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'logo-afrobot-navy.svg')), {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=86400',
      });
    }
    if (pathname === '/fonts/PublicSans-VF.woff2' && method === 'GET') {
      return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'fonts', 'PublicSans-VF.woff2')), {
        'content-type': 'font/woff2',
        'cache-control': 'public, max-age=31536000',
      });
    }
    const json = wantsJson(req);
    const auth = sessionUser(req);
    const user = auth?.user || null;
    const session = auth?.session || null;
    let touched = null;
    try {
      if (method === 'POST' && pathname !== '/login' && pathname !== '/api/login') {
        if (!session) {
          if (json) return sendJson(res, 401, { error: 'Sign in required' });
          return sendHtml(res, 401, loginPage({ error: 'Sign in required.' }));
        }
        const inputPeek = await readInput(req);
        req.input = inputPeek;
        const token = req.headers['x-csrf-token'] || inputPeek._csrf || '';
        if (!safeEqual(token, session.csrf)) throw new HttpError(403, 'The form expired. Sign in again.');
      } else if (method === 'POST') {
        req.input = await readInput(req);
      } else {
        req.input = {};
      }

      if ((pathname === '/login' || pathname === '/api/login') && method === 'GET') {
        if (user) return redirect(res, home(user.role));
        return sendHtml(res, 200, loginPage({ demoMode: demoSeed }));
      }
      if ((pathname === '/login' || pathname === '/api/login') && method === 'POST') {
        const username = String(req.input.username || '').slice(0, 80);
        const ip = clientIp(req);
        const locked = loginLocked(db, username, ip, stamp(now));
        if (locked) {
          if (json) return sendJson(res, 429, { error: 'Too many sign-in attempts. Try again later.' });
          return sendHtml(res, 429, loginPage({ demoMode: demoSeed, error: 'Too many sign-in attempts. Try again later.' }));
        }
        const found = userByUsername(db, username);
        const passwordOk = found ? verifyPassword(req.input.password || '', found.password) : verifyPassword(req.input.password || '', DUMMY_HASH);
        if (!found || !passwordOk) {
          recordFailure(db, username, ip, stamp(now));
          if (json) return sendJson(res, 401, { error: 'Sign-in failed' });
          return sendHtml(res, 401, loginPage({ demoMode: demoSeed, error: 'Sign-in failed.' }));
        }
        clearFailures(db, username);
        const opened = startSession(found);
        res.setHeader('set-cookie', sessionCookie(opened.id, req, 28800));
        if (json) return sendJson(res, 200, { role: found.role, displayName: found.display_name, csrf: opened.csrf });
        return redirect(res, home(found.role));
      }
      if (pathname === '/logout' && method === 'POST') {
        if (session) run(db, 'DELETE FROM sessions WHERE id = ?', [session.id]);
        res.setHeader('set-cookie', sessionCookie('', req, 0));
        return redirect(res, '/login');
      }
      if (pathname === '/' && method === 'GET') return redirect(res, user ? home(user.role) : '/login');
      if (!user) {
        if (json) return sendJson(res, 401, { error: 'Sign in required' });
        return sendHtml(res, 401, loginPage({ demoMode: demoSeed, error: 'Sign in required.' }));
      }
      if (!pageAllowed(pathname, user.role)) {
        if (json) return sendJson(res, 403, { error: 'Not available' });
        return sendHtml(res, 403, unavailablePage());
      }
      if (method === 'POST' && user.role !== 'coach' && ['/api/claims', '/coach/claims', '/api/evidence', '/coach/evidence', '/api/claims/draft', '/coach/drafts', '/api/results', '/coach/results', '/api/practice-complete', '/coach/practice-complete'].includes(pathname)) {
        if (json) return sendJson(res, 403, { error: 'Not available' });
        return sendHtml(res, 403, unavailablePage());
      }

      const notice = NOTICES[url.searchParams.get('notice')] || '';
      const pageOpts = { notice };

      if (pathname === '/demo' && method === 'GET') return sendHtml(res, 200, demoPage(db, user, now, session, pageOpts));
      if (pathname === '/coach' && method === 'GET') return sendHtml(res, 200, coachPage(db, user, now, session, pageOpts));
      if (pathname === '/coach/result' && method === 'GET') return sendHtml(res, 200, resultScreen(db, user, session));
      if (pathname === '/coach/team' && method === 'GET') return sendHtml(res, 200, teamPage(db, user, session));
      if (pathname === '/coach/logs' && method === 'GET') return sendHtml(res, 200, logsPage(db, user, session));
      if (pathname === '/coach/log' && method === 'GET') return sendHtml(res, 200, logPage(db, user, session, '1'));
      if (pathname === '/coach/log/2' && method === 'GET') return sendHtml(res, 200, logPage(db, user, session, '2'));
      if (pathname === '/coach/log/saved' && method === 'GET') return sendHtml(res, 200, logPage(db, user, session, 'saved'));
      if ((pathname === '/coach/log/save' || pathname === '/api/session-logs') && method === 'POST') {
        const skills = Array.isArray(req.input.skills) ? req.input.skills.join(',') : req.input.skills;
        saveSessionLog(db, user, { ...req.input, skills }, now);
        if (json) return sendJson(res, 201, { ok: true });
        return redirect(res, '/coach/log/saved');
      }
      if (pathname === '/coach/setup' && method === 'GET') return sendHtml(res, 200, setupPage('coach', user, session, db));
      if (pathname === '/organiser/setup' && method === 'GET') return sendHtml(res, 200, setupPage('organiser', user, session, db));
      if (pathname === '/organiser/needs' && method === 'GET') return sendHtml(res, 200, needsPage(db, user, now, session, pageOpts));
      if (pathname === '/organiser/needs/act' && method === 'POST') {
        const schoolId = needSchool(db, String(req.input.id || ''));
        if (!schoolId || !readableSchools(db, user, stamp(now)).includes(schoolId)) throw notFound();
        addEvent(db, { now, action: 'submitted', user, subjectType: 'season', subjectId: IDS.seasonAfrica, detail: { need: req.input.id || 'need' } });
        return redirect(res, '/organiser/needs?notice=saved');
      }
      if ((pathname === '/api/results' || pathname === '/coach/results') && method === 'POST') {
        const schoolId = postedSchool(db, user, req.input);
        const result = submitIdempotentResult(db, user, { ...req.input, schoolId, filesDir }, now);
        if (json || pathname.startsWith('/api/')) {
          return sendJson(res, result.already ? 200 : 201, {
            id: result.claim.id,
            already: result.already,
            status: result.claim.status,
            numerator: result.claim.numerator,
            denominator: result.claim.denominator,
          });
        }
        return redirect(res, '/coach/result?notice=submitted');
      }
      if (pathname === '/student/journey' && method === 'GET') return sendHtml(res, 200, journeyPage(db, user, session));
      if (pathname === '/student/family' && method === 'GET') return sendHtml(res, 200, familyPage(db, user, session));
      if (pathname === '/student/link' && method === 'GET') return sendHtml(res, 200, setupPage('student', user, session, db));
      if (pathname === '/student/join' && method === 'GET') return sendHtml(res, 200, setupPage('student', user, session, db));
      if (pathname === '/settings' && method === 'GET') {
        const saver = cookies(req).data_saver === '1';
        return sendHtml(res, 200, settingsPage(user, session, db, saver));
      }
      if (pathname === '/settings' && method === 'POST') {
        const on = req.input.dataSaver === '1';
        res.setHeader('set-cookie', `data_saver=${on ? '1' : '0'}; Path=/; SameSite=Lax; Max-Age=31536000`);
        return redirect(res, '/settings');
      }
      if (pathname === '/lite' && method === 'GET') {
        const membership = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ?', [user.id, 'coach']);
        const gaps = membership ? consentGaps(db, [membership.school_id]) : [];
        return send(res, 200, liteHome(user.display_name, gaps), { 'content-type': 'text/html; charset=utf-8' });
      }
      if (pathname === '/lite/log' && method === 'GET') {
        return send(res, 200, liteHome(user.display_name, []), { 'content-type': 'text/html; charset=utf-8' });
      }
      if (pathname === '/organiser' && method === 'GET') return sendHtml(res, 200, organiserPage(db, user, now, session, pageOpts));
      if (pathname === '/auditor' && method === 'GET') return sendHtml(res, 200, auditorPage(db, user, now, session, pageOpts));
      const traceView = pathname.match(/^\/auditor\/trace\/([a-z0-9-]+)$/);
      if (traceView && method === 'GET') return sendHtml(res, 200, traceResultScreen(db, user, now, session, traceView[1]));
      if (pathname === '/student' && method === 'GET') return sendHtml(res, 200, studentPage(db, user, now, session, pageOpts));
      if (pathname === '/print' && method === 'GET') return sendHtml(res, 200, printPage(db, user, now, session));
      if (pathname === '/records' && method === 'GET') {
        return sendHtml(res, 200, recordsPage(db, user, now, session, Object.fromEntries(url.searchParams.entries())));
      }
      if (pathname === '/audit' && method === 'GET') {
        return sendHtml(res, 200, auditPage(db, user, now, session, Object.fromEntries(url.searchParams.entries())));
      }
      if (pathname === '/audit.csv' && method === 'GET') {
        const csv = eventsCsv(filterEvents(db, user, now, Object.fromEntries(url.searchParams.entries())));
        return send(res, 200, csv, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audit-log.csv"' });
      }
      if (pathname === '/integrity' && method === 'GET') return sendHtml(res, 200, integrityPage(db, user, now, session));
      if (pathname === '/access' && method === 'GET') return sendHtml(res, 200, accessPage(db, user, now, session));
      if (pathname === '/verify' && method === 'GET') return sendHtml(res, 200, verifyPage(user, session, null, db, now));
      if (pathname === '/search' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        return sendHtml(res, 200, searchPage(db, user, now, session, q, searchRecords(db, user, now, q)));
      }

      if ((pathname === '/coach/claims' || pathname === '/api/claims') && method === 'POST') {
        const schoolId = postedSchool(db, user, req.input);
        touched = { subjectType: 'school', subjectId: schoolId };
        const claim = submitClaim(db, user, { ...req.input, schoolId }, now);
        if (json) return sendJson(res, 201, publicClaim(claim));
        return redirect(res, '/coach?notice=submitted');
      }
      if ((pathname === '/coach/evidence' || pathname === '/api/evidence') && method === 'POST') {
        const schoolId = postedSchool(db, user, req.input);
        const item = addEvidence(db, user, { ...req.input, schoolId }, now, filesDir);
        if (json) return sendJson(res, 201, { id: item.id, redactionState: item.redaction_state });
        return redirect(res, '/coach?notice=submitted');
      }
      if ((pathname === '/coach/drafts' || pathname === '/api/claims/draft') && method === 'POST') {
        const schoolId = postedSchool(db, user, req.input);
        const claim = saveClaimDraft(db, user, { ...req.input, schoolId }, now);
        if (json) return sendJson(res, 201, publicClaim(claim));
        return redirect(res, '/coach?notice=drafted');
      }
      if ((pathname === '/coach/practice-complete' || pathname === '/api/practice-complete') && method === 'POST') {
        const schoolId = postedSchool(db, user, req.input);
        completeFromPracticeLesson(db, user, { ...req.input, schoolId }, now);
      }

      const correction = pathname.match(/^\/(?:api\/claims|coach\/claims)\/([a-z0-9-]+)\/corrections$/);
      if (correction && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: correction[1] };
        const claim = submitCorrection(db, user, correction[1], req.input, now);
        if (json) return sendJson(res, 201, publicClaim(claim));
        return redirect(res, '/coach?notice=corrected');
      }
      const approve = pathname.match(/^\/(?:api\/claims|organiser\/claims)\/([a-z0-9-]+)\/approve$/);
      if (approve && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: approve[1] };
        const result = approveClaim(db, user, approve[1], now, req.input);
        if (json) return sendJson(res, 200, { id: result.claim.id, status: result.claim.status, digest: result.digest, version: result.claim.version });
        return redirect(res, '/organiser?notice=approved');
      }
      const returned = pathname.match(/^\/(?:api\/claims|organiser\/claims)\/([a-z0-9-]+)\/return$/);
      if (returned && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: returned[1] };
        returnClaim(db, user, returned[1], req.input.note, now);
        if (json) return sendJson(res, 200, { ok: true });
        return redirect(res, '/organiser?notice=returned');
      }
      const resubmit = pathname.match(/^\/api\/claims\/([a-z0-9-]+)\/resubmit$/);
      if (resubmit && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: resubmit[1] };
        const claim = resubmitClaim(db, user, resubmit[1], req.input, now);
        return sendJson(res, 200, publicClaim(claim));
      }
      const verify = pathname.match(/^\/(?:api\/projects|organiser\/projects)\/([a-z0-9-]+)\/verify$/);
      if (verify && method === 'POST') {
        touched = { subjectType: 'project', subjectId: verify[1] };
        approveVerifiedOutcome(db, user, verify[1], now);
        if (json) return sendJson(res, 200, { ok: true });
        return redirect(res, '/organiser?notice=verified');
      }
      const resultCorrection = pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/result-corrections$/);
      if (resultCorrection && method === 'POST') {
        touched = { subjectType: 'project', subjectId: resultCorrection[1] };
        const row = submitResultCorrection(db, user, resultCorrection[1], req.input, now);
        return sendJson(res, 201, { id: row.id, value: row.value, version: row.version });
      }
      const withdraw = pathname.match(/^\/api\/evidence\/([a-z0-9-]+)\/withdraw$/);
      if (withdraw && method === 'POST') {
        touched = { subjectType: 'evidence', subjectId: withdraw[1] };
        withdrawEvidence(db, user, withdraw[1], now, filesDir);
        return sendJson(res, 200, { ok: true });
      }
      const download = pathname.match(/^\/evidence\/([a-z0-9-]+)\/download$/);
      if (download && method === 'GET') {
        touched = { subjectType: 'evidence', subjectId: download[1] };
        const file = readEvidenceBody(db, user, download[1], now, filesDir);
        return send(res, 200, file.body, {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': `attachment; filename="${String(file.filename).replaceAll('"', '')}"`,
        });
      }
      const studentSave = pathname.match(/^\/(?:api\/projects|student\/projects)\/([a-z0-9-]+)$/);
      if (studentSave && method === 'POST') {
        touched = { subjectType: 'project', subjectId: studentSave[1] };
        const project = updateStudentDraft(db, user, studentSave[1], req.input, now);
        if (json) return sendJson(res, 200, { id: project.id, localProblem: project.local_problem });
        return redirect(res, '/student?notice=saved');
      }
      if ((pathname === '/organiser/clone' || pathname === '/api/seasons/clone') && method === 'POST') {
        const result = cloneSeasonMaterials(db, user, IDS.seasonAfrica, IDS.seasonUs, now);
        if (json) return sendJson(res, 200, result);
        return redirect(res, '/organiser?notice=cloned');
      }
      const grantRevoke = pathname.match(/^\/api\/grants\/([a-z0-9-]+)\/revoke$/);
      if (grantRevoke && method === 'POST') {
        touched = { subjectType: 'access_grant', subjectId: grantRevoke[1] };
        revokeGrant(db, user, grantRevoke[1], now);
        return sendJson(res, 200, { ok: true });
      }
      const exportPost = pathname.match(/^\/(?:api\/claims|auditor\/exports)\/([a-z0-9-]+)\/export$/);
      if (exportPost && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: exportPost[1] };
        const pack = createExport(db, user, exportPost[1], now);
        if (json) return sendJson(res, 201, { packId: pack.packId, manifest: pack.manifest, files: pack.files });
        return redirect(res, `/exports/${pack.packId}`);
      }
      const exportGet = pathname.match(/^\/exports\/([a-z0-9-]+)$/);
      if (exportGet && method === 'GET') {
        touched = { subjectType: 'export', subjectId: exportGet[1] };
        const pack = readExport(db, user, exportGet[1], now);
        if (json) return sendJson(res, 200, pack);
        return sendHtml(res, 200, exportPage(db, user, now, session, pack));
      }
      const exportFile = pathname.match(/^\/exports\/([a-z0-9-]+)\/files\/([a-z0-9.-]+)$/);
      if (exportFile && method === 'GET') {
        touched = { subjectType: 'export', subjectId: exportFile[1] };
        const pack = readExport(db, user, exportFile[1], now);
        const contents = pack.files[exportFile[2]];
        if (typeof contents !== 'string') throw notFound();
        return send(res, 200, contents, {
          'content-type': exportFile[2].endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${exportFile[2]}"`,
        });
      }

      if (pathname === '/api/claims' && method === 'GET') return sendJson(res, 200, listClaims(db, user, now).map(publicClaim));
      const oneClaim = pathname.match(/^\/api\/claims\/([a-z0-9-]+)$/);
      if (oneClaim && method === 'GET') {
        touched = { subjectType: 'claim', subjectId: oneClaim[1] };
        const trace = traceClaim(db, user, oneClaim[1], now);
        return sendJson(res, 200, {
          current: trace.current ? publicClaim(trace.current) : null,
          versions: trace.versions.map(publicClaim),
          snapshots: trace.snapshots.map((row) => ({
            id: row.id,
            subject_id: row.subject_id,
            version: row.version,
            digest_sha256: row.digest_sha256,
            canonical_json: row.canonical_json,
          })),
          evidence: trace.evidence.map((row) => ({ id: row.id, source_type: row.source_type, body_redacted: row.body_redacted })),
        });
      }
      if (pathname === '/api/projects' && method === 'GET') {
        return sendJson(res, 200, listProjects(db, user, now).map((project) => ({
          id: project.id,
          stableCode: project.stable_code,
          visibility: project.visibility,
          localProblem: project.local_problem,
          primarySdg: project.primary_sdg,
          status: project.status,
        })));
      }
      const oneProject = pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/);
      if (oneProject && method === 'GET') {
        touched = { subjectType: 'project', subjectId: oneProject[1] };
        const projects = listProjects(db, user, now);
        const project = projects.find((row) => row.id === oneProject[1]);
        if (!project) throw notFound();
        return sendJson(res, 200, { id: project.id, localProblem: project.local_problem, visibility: project.visibility });
      }
      if (pathname === '/api/events' && method === 'GET') {
        return sendJson(res, 200, visibleEvents(db, user, now).map((event) => ({
          at: event.at,
          action: event.action,
          actor_role: event.actor_role,
          subject_type: event.subject_type,
          subject_id: event.subject_id,
          detail: JSON.parse(event.detail_json),
        })));
      }
      const recordGet = pathname.match(/^\/records\/([a-z0-9-]+)$/);
      if (recordGet && method === 'GET') {
        touched = { subjectType: 'claim', subjectId: recordGet[1] };
        return sendHtml(res, 200, recordPage(db, user, now, session, recordGet[1], url.searchParams.get('tab') || 'overview'));
      }
      if ((pathname === '/api/search' || pathname === '/search') && method === 'GET' && json) {
        return sendJson(res, 200, searchRecords(db, user, now, url.searchParams.get('q') || ''));
      }
      if (pathname === '/api/integrity' && method === 'GET') return sendJson(res, 200, integrityReport(db, user, now));
      if (pathname === '/api/retention' && method === 'GET') return sendJson(res, 200, retentionSchedule(db));
      if (pathname === '/api/access' && method === 'GET') return sendJson(res, 200, accessReviewRows(db, user, now));
      if ((pathname === '/api/verify' || pathname === '/verify') && method === 'POST') {
        let payload = req.input;
        if (typeof req.input.pack === 'string') {
          try { payload = JSON.parse(req.input.pack); } catch { throw new HttpError(422, 'That pack is not valid JSON.'); }
        }
        const result = verifyPastedPack(payload);
        if (json || pathname.startsWith('/api/')) return sendJson(res, 200, result);
        return sendHtml(res, 200, verifyPage(user, session, result, db, now));
      }
      const hold = pathname.match(/^\/api\/evidence\/([a-z0-9-]+)\/hold$/);
      if (hold && method === 'POST') {
        touched = { subjectType: 'evidence', subjectId: hold[1] };
        const item = readEvidenceBody(db, user, hold[1], now, filesDir);
        if (!item) throw notFound();
        placeLegalHold(db, user, hold[1], req.input.reason, now);
        return sendJson(res, 200, { ok: true });
      }
      const release = pathname.match(/^\/api\/evidence\/([a-z0-9-]+)\/release-hold$/);
      if (release && method === 'POST') {
        touched = { subjectType: 'evidence', subjectId: release[1] };
        releaseLegalHold(db, user, release[1], now);
        return sendJson(res, 200, { ok: true });
      }
      const auditPack = pathname.match(/^\/api\/claims\/([a-z0-9-]+)\/audit-pack$/);
      if (auditPack && method === 'POST') {
        touched = { subjectType: 'claim', subjectId: auditPack[1] };
        const pack = createExport(db, user, auditPack[1], now);
        const prov = provenanceDocument(db, user, auditPack[1], now);
        const zip = buildAuditZip(pack, prov);
        return send(res, 201, zip, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${pack.packId}.zip"` });
      }
      if (pathname === '/api/me' && method === 'GET') {
        return sendJson(res, 200, { role: user.role, displayName: user.display_name, mocked: true });
      }

      throw notFound();
    } catch (error) {
      if (error instanceof HttpError) {
        if ((error.status === 404 || error.status === 403) && user && touched?.subjectId) {
          try {
            addEvent(db, {
              now,
              action: 'denied',
              user,
              subjectType: touched.subjectType || 'record',
              subjectId: touched.subjectId,
              detail: {},
            });
          } catch { /* the denial response still stands */ }
        }
        if (error.status === 404) {
          if (json) return sendJson(res, 404, { error: 'Not found' });
          return sendHtml(res, 404, unavailablePage());
        }
        if (json || error.status !== 422) {
          const message = error.status === 403 && error.message === 'Not available' ? 'Not available' : error.message;
          if (json) return sendJson(res, error.status, { error: message });
          return sendHtml(res, error.status, unavailablePage());
        }
        const again = { error: error.message };
        if (user.role === 'coach') return sendHtml(res, 422, coachPage(db, user, now, session, again));
        if (user.role === 'organiser') return sendHtml(res, 422, organiserPage(db, user, now, session, again));
        if (user.role === 'auditor') return sendHtml(res, 422, auditorPage(db, user, now, session, again));
        return sendHtml(res, 422, studentPage(db, user, now, session, again));
      }
      console.error(error);
      if (json) return sendJson(res, 500, { error: 'Something went wrong.' });
      return sendHtml(res, 500, layoutError());
    }
  }

  return { db, filesDir, handle, now };
}

function postedSchool(db, user, input) {
  const own = coachSchool(db, user);
  if (!own) throw notFound();
  if (input.schoolId && input.schoolId !== own) throw notFound();
  return own;
}

function publicClaim(claim) {
  return {
    id: claim.id,
    schoolId: claim.school_id,
    status: claim.status,
    version: claim.version,
    numerator: claim.numerator,
    denominator: claim.denominator,
    activityDate: claim.activity_date,
    correctionReason: claim.correction_reason,
    priorClaimId: claim.prior_claim_id,
    seriesId: claim.series_id,
    submittedBy: claim.submitted_by,
    approvedBy: claim.approved_by,
  };
}

function home(role) {
  if (role === 'organiser') return '/organiser';
  if (role === 'auditor') return '/auditor';
  if (role === 'student') return '/student';
  return '/coach';
}

function redirect(res, location) {
  send(res, 303, '', { location });
}

function layoutError() {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><main id="main"><h1>Something went wrong</h1><p>The demo could not finish that step.</p></main></body></html>';
}

export function start(options = {}) {
  const app = createApp(options);
  const server = http.createServer((req, res) => {
    Promise.resolve(app.handle(req, res)).catch((error) => {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong.' });
    });
  });
  const host = options.host || '127.0.0.1';
  const port = options.port ?? 8787;
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        app,
        url: `http://${host}:${address.port}`,
        close() {
          server.close();
          app.db.close();
        },
      });
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  start({ port }).then(({ url }) => {
    console.log(`AfroBot evidence demo (mocked sign-in, synthetic data) at ${url}`);
    console.log('Demo usernames:');
    for (const row of DEMO_USERS) console.log(`  ${row.username}  (${row.role})`);
    console.log('Passwords are the fictional demo passwords in platform-app/README.md.');
  });
}
