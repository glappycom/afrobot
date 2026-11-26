import { all, get } from './db.js';
import { notAvailable, notFound } from './http-error.js';

export function isId(value) {
  return typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value);
}

export function userById(db, id) {
  return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

export function userByUsername(db, username) {
  return get(db, 'SELECT * FROM users WHERE username = ?', [username]);
}

function membershipSchools(db, user, role) {
  return all(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND role = ? AND school_id IS NOT NULL', [user.id, role])
    .map((row) => row.school_id);
}

export function activeGrants(db, user, now) {
  return all(db, `SELECT * FROM access_grants
    WHERE user_id = ? AND revoked_at IS NULL AND starts_at <= ? AND expires_at > ?`, [user.id, now, now]);
}

export function readableSchools(db, user, now) {
  if (!user) return [];
  if (user.role === 'coach') return membershipSchools(db, user, 'coach');
  if (user.role === 'organiser') return membershipSchools(db, user, 'organiser');
  if (user.role === 'auditor') {
    return activeGrants(db, user, now)
      .filter((grant) => grant.scope_type === 'school' && grant.permission === 'read')
      .map((grant) => grant.scope_id);
  }
  return [];
}

export function canReadSchool(db, user, schoolId, now) {
  if (!user || !schoolId) return false;
  return readableSchools(db, user, now).includes(schoolId);
}

export function requireSchool(db, user, schoolId, now) {
  if (!canReadSchool(db, user, schoolId, now)) throw notFound();
}

export function requireOrganiser(db, user, schoolId, now) {
  requireSchool(db, user, schoolId, now);
  if (user.role !== 'organiser') throw notAvailable();
}

export function requireCoach(db, user, schoolId, now) {
  requireSchool(db, user, schoolId, now);
  if (user.role !== 'coach') throw notAvailable();
}

export function canReadProject(db, user, project, now) {
  if (!user || !project) return false;
  if (project.visibility === 'student_private') return user.role === 'student' && project.owner_user_id === user.id;
  if (user.role === 'student') return false;
  if (project.visibility === 'redacted_shared') {
    if (user.role === 'auditor') return false;
    if (user.role === 'organiser') return true;
    const schools = JSON.parse(project.participating_schools_json || '[]');
    return schools.some((schoolId) => canReadSchool(db, user, schoolId, now));
  }
  return canReadSchool(db, user, project.school_id, now);
}

export function requireProject(db, user, project, now) {
  if (!canReadProject(db, user, project, now)) throw notFound();
  return project;
}

export function canReadClaim(db, user, claim, now) {
  if (!user || !claim || user.role === 'student') return false;
  return canReadSchool(db, user, claim.school_id, now);
}

export function requireClaim(db, user, claim, now) {
  if (!canReadClaim(db, user, claim, now)) throw notFound();
  return claim;
}

export function canReadEvidence(db, user, item, now) {
  if (!user || !item || item.permission_state !== 'active') return false;
  if (user.role === 'student') return false;
  if (user.role === 'auditor') {
    return item.redaction_state === 'redacted' && canReadSchool(db, user, item.school_id, now);
  }
  return canReadSchool(db, user, item.school_id, now);
}

export function requireEvidence(db, user, item, now) {
  if (!canReadEvidence(db, user, item, now)) throw notFound();
  return item;
}

export function projectById(db, id) {
  if (!isId(id)) return undefined;
  return get(db, 'SELECT * FROM projects WHERE id = ?', [id]);
}

export function claimById(db, id) {
  if (!isId(id)) return undefined;
  return get(db, 'SELECT * FROM claims WHERE id = ?', [id]);
}

export function evidenceById(db, id) {
  if (!isId(id)) return undefined;
  return get(db, 'SELECT * FROM evidence_items WHERE id = ?', [id]);
}
