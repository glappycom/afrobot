import crypto from 'node:crypto';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { generateRandomString } from 'better-auth/crypto';
import { sha256 } from './canonical.js';
import { all, get, insert, run } from './db.js';
import { addEvent } from './domain.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { HttpError, notAvailable, notFound } from './http-error.js';
import { isId, requireOrganiser } from './access.js';

const ROLES = new Set(['coach', 'organiser', 'auditor', 'guardian']);
const FAMILY = new Set(['guardian', 'student']);

function at(now) {
  return typeof now === 'function' ? now() : now;
}

function plusMs(stamp, ms) {
  return new Date(Date.parse(stamp) + ms).toISOString();
}

export function newToken() {
  return generateRandomString(32).replaceAll('-', 'a').replaceAll('_', 'b');
}

function hashToken(token) {
  return sha256(String(token));
}

export function authEvent(db, now, actor, action, detail, schoolId = null) {
  const user = actor || { id: 'auth', role: 'organiser' };
  addEvent(db, {
    now: at(now),
    action,
    user,
    subjectType: 'auth',
    subjectId: String(detail.subject || user.id || 'auth').slice(0, 80),
    schoolId,
    detail,
  });
}

export function mfaMustEnroll(user, demoSeed) {
  if (!user) return false;
  if (Number(user.mfa_enabled) === 1) return false;
  if (user.role !== 'organiser' && user.role !== 'auditor') return false;
  return !(demoSeed && Number(user.mfa_exempt) === 1);
}

export function mfaChallengeRequired(user, demoSeed) {
  if (Number(user?.mfa_enabled) === 1) return true;
  return mfaMustEnroll(user, demoSeed);
}

export async function startTotp(db, userId, now) {
  const user = get(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user || Number(user.active) === 0) throw notFound();
  const secret = crypto.randomBytes(20);
  const label = base32.encode(secret, { padding: false });
  const otp = createOTP(secret);
  const codes = Array.from({ length: 8 }, () => generateRandomString(10));
  run(db, 'DELETE FROM recovery_codes WHERE user_id = ?', [user.id]);
  for (const code of codes) {
    insert(db, 'recovery_codes', { id: `rc-${sha256(code).slice(0, 16)}`, user_id: user.id, code_hash: sha256(code), used_at: null });
  }
  run(db, 'UPDATE users SET totp_secret = ?, mfa_enabled = 0 WHERE id = ?', [label, user.id]);
  return {
    secret: label,
    uri: otp.url('AfroBot preview', user.username),
    recoveryCodes: codes,
  };
}

export async function confirmTotp(db, userId, code, now, actor) {
  const user = get(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user?.totp_secret) throw new HttpError(422, 'Set up an authenticator first.');
  const ok = await createOTP(base32.decode(user.totp_secret)).verify(String(code || '').trim());
  if (!ok) throw new HttpError(401, 'That authenticator code is not valid.');
  run(db, 'UPDATE users SET mfa_enabled = 1 WHERE id = ?', [user.id]);
  authEvent(db, now, actor || user, 'mfa-enrolled', { subject: user.id, username: user.username });
  return get(db, 'SELECT * FROM users WHERE id = ?', [user.id]);
}

async function consumeRecoveryCode(db, user, code) {
  const row = get(db, 'SELECT * FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL', [user.id, sha256(String(code || '').trim())]);
  if (!row) return false;
  run(db, 'UPDATE recovery_codes SET used_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
  return true;
}

export async function checkSecondFactor(db, user, code) {
  const text = String(code || '').trim();
  if (/^\d{6}$/.test(text) && user.totp_secret) {
    return createOTP(base32.decode(user.totp_secret)).verify(text);
  }
  return consumeRecoveryCode(db, user, text);
}

export function createInvite(db, actor, input, now) {
  if (!actor || actor.role !== 'organiser') throw notAvailable();
  const role = String(input.role || '');
  if (!ROLES.has(role) || role === 'student') throw new HttpError(422, 'Choose coach, organiser, auditor, or guardian.');
  const username = String(input.username || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(username)) throw new HttpError(422, 'Username should be 3 to 40 letters, numbers, or hyphens.');
  if (get(db, 'SELECT id FROM users WHERE username = ?', [username])) throw new HttpError(422, 'That username is already in use.');
  const displayName = String(input.displayName || '').trim();
  if (displayName.length < 2 || displayName.length > 80) throw new HttpError(422, 'Name should be 2 to 80 characters.');
  const schoolId = input.schoolId ? String(input.schoolId) : null;
  if (role === 'coach' || role === 'guardian') {
    if (!schoolId) throw new HttpError(422, 'Choose a club.');
    requireOrganiser(db, actor, schoolId, at(now));
  }
  const token = newToken();
  const stamp = at(now);
  const id = `inv-${sha256(token).slice(0, 12)}`;
  insert(db, 'invites', {
    id,
    token_hash: hashToken(token),
    username,
    display_name: displayName,
    role,
    school_id: schoolId,
    expires_at: plusMs(stamp, 7 * 24 * 60 * 60 * 1000),
    used_at: null,
    created_by: actor.id,
    created_at: stamp,
  });
  authEvent(db, now, actor, 'invite-created', { subject: id, username, role }, schoolId);
  return { id, token, path: `/invite/${token}`, expiresAt: plusMs(stamp, 7 * 24 * 60 * 60 * 1000), username, role };
}

export function previewInvite(db, token, now) {
  const invite = get(db, 'SELECT * FROM invites WHERE token_hash = ?', [hashToken(token)]);
  if (!invite || invite.used_at || invite.expires_at <= at(now)) return null;
  return invite;
}

export function acceptInvite(db, token, password, now) {
  const invite = get(db, 'SELECT * FROM invites WHERE token_hash = ?', [hashToken(token)]);
  if (!invite || invite.used_at || invite.expires_at <= at(now)) throw new HttpError(422, 'This invite link is no longer valid.');
  const secret = String(password || '');
  if (secret.length < 8 || secret.length > 80) throw new HttpError(422, 'Password should be 8 to 80 characters.');
  if (get(db, 'SELECT id FROM users WHERE username = ?', [invite.username])) throw new HttpError(422, 'That username is already in use.');
  const id = `user-${sha256(invite.id + secret).slice(0, 12)}`;
  const stamp = at(now);
  insert(db, 'users', {
    id,
    username: invite.username,
    display_name: invite.display_name,
    role: invite.role,
    password: hashPassword(secret),
    mocked: 0,
    active: 1,
    mfa_enabled: 0,
    mfa_exempt: 0,
  });
  if (invite.school_id) {
    const cohort = get(db, 'SELECT id, season_id FROM cohorts WHERE school_id = ? ORDER BY id LIMIT 1', [invite.school_id]);
    insert(db, 'memberships', {
      id: `mem-${id}`,
      user_id: id,
      school_id: invite.school_id,
      cohort_id: invite.role === 'coach' ? cohort?.id || null : null,
      season_id: cohort?.season_id || null,
      role: invite.role,
    });
  }
  run(db, 'UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL', [stamp, invite.id]);
  const user = get(db, 'SELECT * FROM users WHERE id = ?', [id]);
  authEvent(db, now, user, 'invite-used', { subject: invite.id, username: user.username, role: user.role }, invite.school_id);
  return user;
}

export function createReset(db, actor, userId, now) {
  if (!actor || actor.role !== 'organiser') throw notAvailable();
  if (!isId(String(userId || ''))) throw notFound();
  const person = get(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!person || FAMILY.has(person.role) === false && person.role !== 'coach' && person.role !== 'organiser' && person.role !== 'auditor' && person.role !== 'guardian') {
    if (!person) throw notFound();
  }
  if (!person) throw notFound();
  const token = newToken();
  const stamp = at(now);
  insert(db, 'password_resets', {
    id: `rst-${sha256(token).slice(0, 12)}`,
    token_hash: hashToken(token),
    user_id: person.id,
    expires_at: plusMs(stamp, 7 * 24 * 60 * 60 * 1000),
    used_at: null,
    created_by: actor.id,
    created_at: stamp,
  });
  authEvent(db, now, actor, 'reset-issued', { subject: person.id, username: person.username });
  return { token, path: `/reset/${token}`, username: person.username };
}

export function previewReset(db, token, now) {
  const row = get(db, 'SELECT * FROM password_resets WHERE token_hash = ?', [hashToken(token)]);
  if (!row || row.used_at || row.expires_at <= at(now)) return null;
  return row;
}

export function acceptReset(db, token, password, now) {
  const row = get(db, 'SELECT * FROM password_resets WHERE token_hash = ?', [hashToken(token)]);
  if (!row || row.used_at || row.expires_at <= at(now)) throw new HttpError(422, 'This reset link is no longer valid.');
  const secret = String(password || '');
  if (secret.length < 8 || secret.length > 80) throw new HttpError(422, 'Password should be 8 to 80 characters.');
  const stamp = at(now);
  run(db, 'UPDATE users SET password = ? WHERE id = ?', [hashPassword(secret), row.user_id]);
  run(db, 'UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL', [stamp, row.id]);
  run(db, 'DELETE FROM sessions WHERE user_id = ?', [row.user_id]);
  const user = get(db, 'SELECT * FROM users WHERE id = ?', [row.user_id]);
  authEvent(db, now, user, 'reset-used', { subject: user.id, username: user.username });
  return user;
}

export function joinWithCode(db, input, now) {
  const code = String(input.code || '').trim().toUpperCase();
  const join = get(db, 'SELECT * FROM join_codes WHERE code = ?', [code]);
  if (!join) throw new HttpError(422, 'That join code is not valid.');
  const cohort = get(db, 'SELECT * FROM cohorts WHERE id = ?', [join.cohort_id]);
  if (!cohort) throw notFound();
  const letter = String(input.letter || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) throw new HttpError(422, 'Use the child letter, such as A.');
  const learner = get(db, 'SELECT * FROM learners WHERE cohort_id = ? AND letter = ? AND (active IS NULL OR active = 1)', [cohort.id, letter]);
  if (!learner) throw new HttpError(422, 'That child is not on this team.');
  if (learner.consent !== 'active') throw new HttpError(422, `Student ${letter} is hidden until consent is recorded.`);
  const username = String(input.username || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(username)) throw new HttpError(422, 'Username should be 3 to 40 letters, numbers, or hyphens.');
  if (get(db, 'SELECT id FROM users WHERE username = ?', [username])) throw new HttpError(422, 'That username is already in use.');
  const secret = String(input.password || '');
  if (secret.length < 8 || secret.length > 80) throw new HttpError(422, 'Password should be 8 to 80 characters.');
  const displayName = String(input.displayName || '').trim();
  if (displayName.length < 2) throw new HttpError(422, 'Add your name. Do not use the child\'s real name.');
  const stamp = at(now);
  const id = `user-${sha256(username + stamp).slice(0, 12)}`;
  insert(db, 'users', {
    id, username, display_name: displayName, role: 'guardian', password: hashPassword(secret), mocked: 0, active: 1, mfa_enabled: 0, mfa_exempt: 0,
  });
  insert(db, 'memberships', {
    id: `mem-${id}`, user_id: id, school_id: cohort.school_id, cohort_id: cohort.id, season_id: cohort.season_id, role: 'guardian',
  });
  insert(db, 'guardian_links', {
    id: `glink-${id}`, user_id: id, learner_id: learner.id, status: 'pending', created_at: stamp, confirmed_by: null, confirmed_at: null,
  });
  const user = get(db, 'SELECT * FROM users WHERE id = ?', [id]);
  authEvent(db, now, user, 'scope-changed', { subject: id, username, letter, status: 'pending' }, cohort.school_id);
  return { user, learnerId: learner.id, status: 'pending' };
}

export function confirmGuardian(db, actor, linkId, now) {
  if (!actor || actor.role !== 'organiser') throw notAvailable();
  const link = get(db, 'SELECT * FROM guardian_links WHERE id = ?', [String(linkId || '')]);
  if (!link) throw notFound();
  const learner = get(db, 'SELECT * FROM learners WHERE id = ?', [link.learner_id]);
  if (!learner) throw notFound();
  requireOrganiser(db, actor, learner.school_id, at(now));
  const stamp = at(now);
  run(db, `UPDATE guardian_links SET status = 'confirmed', confirmed_by = ?, confirmed_at = ? WHERE id = ?`, [actor.id, stamp, link.id]);
  authEvent(db, now, actor, 'scope-changed', { subject: link.user_id, learner_id: learner.id, status: 'confirmed' }, learner.school_id);
  return get(db, 'SELECT * FROM guardian_links WHERE id = ?', [link.id]);
}

export function endAllSessions(db, user, now) {
  run(db, 'DELETE FROM sessions WHERE user_id = ?', [user.id]);
  authEvent(db, now, user, 'signed-out', { subject: user.id, username: user.username, everywhere: true });
}

export function linkedLetters(db, userId) {
  return all(db, `SELECT learners.letter AS letter, guardian_links.status AS status FROM guardian_links
    JOIN learners ON learners.id = guardian_links.learner_id
    WHERE guardian_links.user_id = ? AND guardian_links.status = 'confirmed' ORDER BY learners.letter`, [userId]);
}
