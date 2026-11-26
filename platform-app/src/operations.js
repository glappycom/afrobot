import { sha256 } from './canonical.js';
import { IDS, INCLUSION_RULES } from './constants.js';
import { all, get, insert, run, transaction } from './db.js';
import { addEvent, claimById, recordAttendance, resubmitClaim } from './domain.js';
import { rateLabel } from './format.js';
import { hashPassword } from './passwords.js';
import {
  isId,
  readableSchools,
  requireCoach,
  requireOrganiser,
} from './access.js';
import { HttpError, notAvailable, notFound } from './http-error.js';

function at(now) {
  return typeof now === 'function' ? now() : now;
}

function newId(prefix) {
  return `${prefix}-${sha256(`${Math.random()}-${Date.now()}`).slice(0, 12)}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(422, 'Use a date in the form YYYY-MM-DD.');
  }
  return value;
}

function parseCount(value, label) {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) throw new HttpError(422, `${label} must be a whole number.`);
  return Number(text);
}

function cleanName(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < 2 || text.length > 80) throw new HttpError(422, `${label} should be 2 to 80 characters.`);
  if (/[<>]/.test(text)) throw new HttpError(422, `${label} cannot include HTML.`);
  return text;
}

function requireOrganiserRole(user) {
  if (!user || user.role !== 'organiser') throw notAvailable();
}

export function marksFrom(input) {
  if (Array.isArray(input.attendance)) {
    return input.attendance.map((row) => ({
      learnerId: String(row.learnerId || ''),
      present: row.present === true || row.present === 1 || row.present === '1' || row.present === 'present',
    }));
  }
  const marks = [];
  for (const [key, value] of Object.entries(input || {})) {
    if (!key.startsWith('mark-')) continue;
    marks.push({ learnerId: key.slice(5), present: value === 'present' || value === '1' });
  }
  return marks;
}

function stampText(value, label, min) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > 240) throw new HttpError(422, `${label} should be ${min} to 240 characters. Do not include student names.`);
  return text;
}

export function isoWeek(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function cohortForSchool(db, schoolId) {
  return get(db, 'SELECT * FROM cohorts WHERE school_id = ? ORDER BY id LIMIT 1', [schoolId]);
}

export function meetingsFor(db, user, now) {
  const schools = readableSchools(db, user, at(now));
  if (!schools.length || user.role === 'student') return [];
  const rows = all(db, `SELECT * FROM meetings WHERE school_id IN (${schools.map(() => '?').join(',')}) ORDER BY meets_on, label`, schools);
  if (user.role === 'coach') return rows.filter((row) => row.coach_id === user.id);
  return rows;
}

export function createClub(db, user, input, now) {
  requireOrganiserRole(user);
  const displayName = cleanName(input.displayName, 'Club name');
  const countryName = cleanName(input.countryName, 'Country');
  const label = cleanName(input.label || displayName, 'Team name');
  const windowStart = parseDate(input.windowStart);
  const windowEnd = parseDate(input.windowEnd);
  if (windowEnd < windowStart) throw new HttpError(422, 'The reporting period end is before the start.');
  const org = get(db, 'SELECT id FROM organisations ORDER BY id LIMIT 1');
  const region = get(db, 'SELECT id FROM regions WHERE id = ?', [IDS.regionAfrica]) || get(db, 'SELECT id FROM regions ORDER BY id LIMIT 1');
  if (!org || !region) throw new HttpError(422, 'The pilot organisation is not set up yet.');
  const season = get(db, 'SELECT id FROM seasons WHERE id = ?', [IDS.seasonAfrica]);
  if (!season) throw new HttpError(422, 'The pilot reporting season is not set up yet.');
  const schoolId = newId('sch');
  const cohortId = newId('coh');
  const code = `CLB-${sha256(schoolId).slice(0, 4).toUpperCase()}`;
  const stamp = at(now);
  transaction(db, () => {
    insert(db, 'schools', {
      id: schoolId,
      organisation_id: org.id,
      region_id: region.id,
      country_name: countryName,
      display_name: displayName,
    });
    insert(db, 'cohorts', {
      id: cohortId,
      school_id: schoolId,
      season_id: season.id,
      label,
      age_band: '12-14',
      challenge_tier: 'intermediate',
      window_start: windowStart,
      window_end: windowEnd,
    });
    insert(db, 'memberships', {
      id: newId('mem'),
      user_id: user.id,
      school_id: schoolId,
      cohort_id: null,
      season_id: season.id,
      role: 'organiser',
    });
    insert(db, 'join_codes', { cohort_id: cohortId, code });
    addEvent(db, {
      now: stamp,
      action: 'submitted',
      user,
      subjectType: 'school',
      subjectId: schoolId,
      schoolId,
      detail: { display_name: displayName, window_start: windowStart, window_end: windowEnd },
    });
  });
  return { schoolId, cohortId, joinCode: code, displayName };
}

export function setReportingPeriod(db, user, input, now) {
  requireOrganiserRole(user);
  const schoolId = String(input.schoolId || '');
  requireOrganiser(db, user, schoolId, at(now));
  const windowStart = parseDate(input.windowStart);
  const windowEnd = parseDate(input.windowEnd);
  if (windowEnd < windowStart) throw new HttpError(422, 'The reporting period end is before the start.');
  const cohort = cohortForSchool(db, schoolId);
  if (!cohort) throw notFound();
  run(db, 'UPDATE cohorts SET window_start = ?, window_end = ? WHERE id = ?', [windowStart, windowEnd, cohort.id]);
  addEvent(db, {
    now: at(now),
    action: 'submitted',
    user,
    subjectType: 'school',
    subjectId: schoolId,
    schoolId,
    detail: { window_start: windowStart, window_end: windowEnd },
  });
  return cohortForSchool(db, schoolId);
}

export function createCoachAccount(db, user, input, now) {
  requireOrganiserRole(user);
  const schoolId = String(input.schoolId || '');
  requireOrganiser(db, user, schoolId, at(now));
  const username = String(input.username || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(username)) throw new HttpError(422, 'Username should be 3 to 40 letters, numbers, or hyphens.');
  if (get(db, 'SELECT id FROM users WHERE username = ?', [username])) throw new HttpError(422, 'That username is already in use.');
  const password = String(input.password || '');
  if (password.length < 8 || password.length > 80) throw new HttpError(422, 'Password should be 8 to 80 characters.');
  const displayName = cleanName(input.displayName, 'Coach name');
  const cohort = cohortForSchool(db, schoolId);
  if (!cohort) throw notFound();
  const id = newId('user');
  transaction(db, () => {
    insert(db, 'users', {
      id,
      username,
      display_name: displayName,
      role: 'coach',
      password: hashPassword(password),
      mocked: 1,
    });
    insert(db, 'memberships', {
      id: newId('mem'),
      user_id: id,
      school_id: schoolId,
      cohort_id: cohort.id,
      season_id: cohort.season_id,
      role: 'coach',
    });
    addEvent(db, {
      now: at(now),
      action: 'submitted',
      user,
      subjectType: 'school',
      subjectId: schoolId,
      schoolId,
      detail: { coach_id: id, username },
    });
  });
  return { id, username, displayName };
}

export function createLearnerAccount(db, user, input, now) {
  requireOrganiserRole(user);
  const schoolId = String(input.schoolId || '');
  requireOrganiser(db, user, schoolId, at(now));
  const letter = String(input.letter || '').trim().toUpperCase();
  if (!/^[A-Z]$/.test(letter)) throw new HttpError(422, 'Use a single letter for the student, such as A.');
  const consent = ['active', 'missing', 'expired'].includes(input.consent) ? input.consent : 'active';
  const cohort = cohortForSchool(db, schoolId);
  if (!cohort) throw notFound();
  if (get(db, 'SELECT id FROM learners WHERE school_id = ? AND letter = ?', [schoolId, letter])) {
    throw new HttpError(422, 'That letter is already used at this club.');
  }
  const id = newId('lrn');
  insert(db, 'learners', {
    id,
    school_id: schoolId,
    cohort_id: cohort.id,
    letter,
    consent,
    consent_until: consent === 'active' ? cohort.window_end : null,
    user_id: null,
  });
  addEvent(db, {
    now: at(now),
    action: 'submitted',
    user,
    subjectType: 'school',
    subjectId: schoolId,
    schoolId,
    detail: { learner_id: id, letter, consent },
  });
  return { id, letter, consent };
}

export function createMeeting(db, user, input, now) {
  requireOrganiserRole(user);
  const schoolId = String(input.schoolId || '');
  requireOrganiser(db, user, schoolId, at(now));
  const coachId = String(input.coachId || '');
  const coach = get(db, `SELECT users.id FROM users
    JOIN memberships ON memberships.user_id = users.id
    WHERE users.id = ? AND users.role = 'coach' AND memberships.school_id = ? AND memberships.role = 'coach'`, [coachId, schoolId]);
  if (!coach) throw notFound();
  const cohort = cohortForSchool(db, schoolId);
  if (!cohort) throw notFound();
  const meetsOn = parseDate(input.meetsOn);
  if (meetsOn < cohort.window_start || meetsOn > cohort.window_end) {
    throw new HttpError(422, 'That date is outside this club reporting period.');
  }
  const label = cleanName(input.label, 'Session name');
  const id = newId('mtg');
  insert(db, 'meetings', {
    id,
    school_id: schoolId,
    cohort_id: cohort.id,
    coach_id: coachId,
    meets_on: meetsOn,
    label,
    created_at: at(now),
    created_by: user.id,
  });
  addEvent(db, {
    now: at(now),
    action: 'submitted',
    user,
    subjectType: 'school',
    subjectId: schoolId,
    schoolId,
    detail: { meeting_id: id, meets_on: meetsOn, label },
  });
  return { id, meetsOn, label, schoolId, coachId };
}

function evidenceNote(marks, learners, projectResult, note) {
  const byId = new Map(learners.map((row) => [row.id, row]));
  const present = [];
  const absent = [];
  for (const mark of marks) {
    const letter = byId.get(mark.learnerId)?.letter;
    if (!letter) continue;
    (mark.present ? present : absent).push(letter);
  }
  return `Present: ${present.sort().join(', ') || 'none'}. Absent: ${absent.sort().join(', ') || 'none'}. Project result: ${projectResult}. Note: ${note}. No photo. Student names and faces are not included.`;
}

export function submitSessionCapture(db, user, input, now) {
  const meetingId = String(input.meetingId || '');
  if (!isId(meetingId)) throw new HttpError(422, 'Choose a session.');
  const meeting = get(db, 'SELECT * FROM meetings WHERE id = ?', [meetingId]);
  if (!meeting) throw notFound();
  requireCoach(db, user, meeting.school_id, at(now));
  if (meeting.coach_id !== user.id) throw notFound();
  const key = String(input.idempotencyKey || `meet-${meeting.id}`).trim().toLowerCase();
  if (!/^[a-z0-9-]{8,64}$/.test(key)) throw new HttpError(422, 'A session key is required.');
  const existingKey = get(db, 'SELECT * FROM claims WHERE idempotency_key = ?', [key]);
  if (existingKey) {
    if (existingKey.school_id !== meeting.school_id) throw notFound();
    return { claim: existingKey, already: true };
  }
  const latest = get(db, 'SELECT * FROM claims WHERE meeting_id = ? ORDER BY version DESC LIMIT 1', [meeting.id]);
  if (latest && (latest.status === 'submitted' || latest.status === 'approved')) {
    throw new HttpError(422, 'This session already has a record.');
  }
  if (latest && latest.status === 'returned') {
    throw new HttpError(422, 'This session was sent back. Fix that version.');
  }
  const numerator = parseCount(input.numerator, 'Completions');
  const denominator = parseCount(input.denominator, 'Starters');
  if (denominator === 0) throw new HttpError(422, 'Starters are required. The rate stays blank until they are known.');
  if (numerator > denominator) throw new HttpError(422, 'Completions cannot be larger than starters.');
  const projectResult = stampText(input.projectResult, 'Project result', 3);
  const note = stampText(input.note, 'Note', 8);
  const marks = marksFrom(input);
  const cohort = get(db, 'SELECT * FROM cohorts WHERE id = ?', [meeting.cohort_id]);
  if (!cohort) throw notFound();
  const rubric = get(db, 'SELECT id FROM rubric_versions WHERE season_id = ? ORDER BY id LIMIT 1', [cohort.season_id]);
  if (!rubric) throw new HttpError(422, 'This reporting period has no rubric yet.');
  const learners = all(db, 'SELECT * FROM learners WHERE school_id = ?', [meeting.school_id]);
  const id = newId('clm');
  const stamp = at(now);
  const body = evidenceNote(marks, learners, projectResult, note);
  transaction(db, () => {
    insert(db, 'claims', {
      id,
      school_id: meeting.school_id,
      cohort_id: cohort.id,
      season_id: cohort.season_id,
      series_id: id,
      definition_label: 'Session completions',
      metric_version: 'session-completions-v1',
      rubric_version_id: rubric.id,
      window_start: cohort.window_start,
      window_end: cohort.window_end,
      numerator,
      denominator,
      coach_hours: null,
      evidence_coverage: 1,
      scope_key: `${cohort.challenge_tier}|${cohort.age_band}|${cohort.season_id}`,
      inclusion_rules: `${INCLUSION_RULES} This row is one session.`,
      status: 'submitted',
      version: 1,
      prior_claim_id: null,
      correction_reason: null,
      meeting_id: meeting.id,
      return_note: null,
      project_result: projectResult,
      coach_note: note,
      activity_date: meeting.meets_on,
      submitted_by: user.id,
      submitted_at: stamp,
      approved_by: null,
      approved_at: null,
      created_at: stamp,
      idempotency_key: key,
    });
    recordAttendance(db, meeting.school_id, id, marks);
    insert(db, 'evidence_items', {
      id: newId('ev'),
      project_id: null,
      claim_id: id,
      school_id: meeting.school_id,
      activity_date: meeting.meets_on,
      server_timestamp: stamp,
      source_type: 'coach_attestation',
      submitter_role: 'coach',
      submitter_user_id: user.id,
      reviewer_user_id: null,
      metric_version: 'session-completions-v1',
      rubric_version_id: rubric.id,
      redaction_state: 'redacted',
      permission_state: 'active',
      access_scope: `school:${meeting.school_id}`,
      retention_class: 'light_evidence',
      version_ref: id,
      body_redacted: body,
      filename: 'redacted-note.txt',
      withdrawn_at: null,
    });
    addEvent(db, {
      now: stamp,
      action: 'submitted',
      user,
      subjectType: 'claim',
      subjectId: id,
      schoolId: meeting.school_id,
      detail: { meeting_id: meeting.id, numerator, denominator, version: 1 },
    });
  });
  return { claim: claimById(db, id), already: false };
}

export function resubmitSession(db, user, claimId, input, now) {
  const marks = marksFrom(input);
  return resubmitClaim(db, user, claimId, { ...input, attendance: marks.length ? marks : input.attendance }, now);
}

function statusLabel(status) {
  if (status === 'approved') return 'Sent';
  if (status === 'returned') return 'Needs attention';
  if (status === 'submitted') return 'Pending review';
  if (status === 'draft') return 'Saved on this device';
  return status || 'Missing';
}

export function coachHistory(db, user, now) {
  const schools = readableSchools(db, user, at(now));
  if (!schools.length || user.role === 'student') return [];
  const claims = all(db, `SELECT * FROM claims WHERE school_id IN (${schools.map(() => '?').join(',')}) ORDER BY activity_date, version`, schools);
  return claims.map((claim) => {
    const meeting = claim.meeting_id ? get(db, 'SELECT * FROM meetings WHERE id = ?', [claim.meeting_id]) : null;
    const latest = get(db, 'SELECT id FROM claims WHERE series_id = ? ORDER BY version DESC LIMIT 1', [claim.series_id]);
    return {
      id: claim.id,
      version: claim.version,
      status: claim.status,
      statusLabel: statusLabel(claim.status),
      figure: rateLabel(claim.numerator, claim.denominator),
      label: meeting ? `${meeting.label} · ${meeting.meets_on}` : claim.definition_label,
      why: claim.status === 'returned' ? claim.return_note : '',
      canFix: claim.status === 'returned' && latest?.id === claim.id,
      meetingId: claim.meeting_id,
      schoolId: claim.school_id,
    };
  });
}

export function sessionBoard(db, user, now) {
  if (!user || user.role === 'student') throw notAvailable();
  const meetings = meetingsFor(db, user, now);
  return meetings.map((meeting) => {
    const school = get(db, 'SELECT display_name FROM schools WHERE id = ?', [meeting.school_id]);
    const coach = get(db, 'SELECT display_name FROM users WHERE id = ?', [meeting.coach_id]);
    const claim = get(db, 'SELECT * FROM claims WHERE meeting_id = ? ORDER BY version DESC LIMIT 1', [meeting.id]);
    return {
      meetingId: meeting.id,
      schoolId: meeting.school_id,
      schoolName: school?.display_name || '',
      coachName: coach?.display_name || '',
      week: isoWeek(meeting.meets_on),
      meetsOn: meeting.meets_on,
      label: meeting.label,
      status: claim ? statusLabel(claim.status) : 'Missing',
      claimId: claim?.id || null,
      version: claim?.version || null,
      figure: claim ? rateLabel(claim.numerator, claim.denominator) : null,
      why: claim?.status === 'returned' ? claim.return_note : '',
    };
  });
}

export function sessionTotals(db, user, now) {
  if (!user || user.role === 'student') throw notAvailable();
  const schools = readableSchools(db, user, at(now));
  return schools.map((schoolId) => {
    const school = get(db, 'SELECT display_name FROM schools WHERE id = ?', [schoolId]);
    const claims = all(db, `SELECT * FROM claims WHERE school_id = ? AND meeting_id IS NOT NULL AND status = 'approved'`, [schoolId]);
    const latest = new Map();
    for (const claim of claims) {
      const prev = latest.get(claim.series_id);
      if (!prev || claim.version > prev.version) latest.set(claim.series_id, claim);
    }
    let numerator = 0;
    let denominator = 0;
    for (const claim of latest.values()) {
      numerator += Number(claim.numerator);
      denominator += Number(claim.denominator);
    }
    return {
      schoolId,
      displayName: school?.display_name || '',
      numerator,
      denominator,
      sessions: latest.size,
      label: denominator ? rateLabel(numerator, denominator) : null,
    };
  });
}

export function learnerProgress(db, user) {
  if (!user || user.role !== 'student') return null;
  const learner = get(db, 'SELECT * FROM learners WHERE user_id = ?', [user.id]);
  if (!learner) return null;
  const rows = all(db, `SELECT attendance.present AS present, claims.series_id AS series_id, claims.version AS version, claims.status AS status
    FROM attendance JOIN claims ON claims.id = attendance.claim_id
    WHERE attendance.learner_id = ?`, [learner.id]);
  const latest = new Map();
  for (const row of rows) {
    const prev = latest.get(row.series_id);
    if (!prev || row.version > prev.version) latest.set(row.series_id, row);
  }
  const counted = [...latest.values()].filter((row) => row.status === 'approved' || row.status === 'submitted');
  const came = counted.filter((row) => Number(row.present) === 1).length;
  return { came, total: counted.length, letter: learner.letter };
}

export function approvedSessions(db, user, now) {
  if (!user || user.role === 'student') return [];
  const schools = readableSchools(db, user, at(now));
  if (!schools.length) return [];
  const claims = all(db, `SELECT * FROM claims WHERE meeting_id IS NOT NULL AND status = 'approved' AND school_id IN (${schools.map(() => '?').join(',')}) ORDER BY activity_date, version`, schools);
  const latest = new Map();
  for (const claim of claims) {
    const prev = latest.get(claim.series_id);
    if (!prev || claim.version > prev.version) latest.set(claim.series_id, claim);
  }
  return [...latest.values()].map((claim) => {
    const meeting = get(db, 'SELECT label, meets_on FROM meetings WHERE id = ?', [claim.meeting_id]);
    return {
      id: claim.id,
      label: meeting ? `${meeting.label} · ${meeting.meets_on}` : claim.definition_label,
      figure: rateLabel(claim.numerator, claim.denominator),
      numerator: claim.numerator,
      denominator: claim.denominator,
    };
  });
}

export function ensureDemoMeetings(db) {
  const rows = [
    ['mtg-cm-w1', IDS.schoolCm, IDS.cohortCm, 'user-coach-a', '2026-03-09', 'Week 1'],
    ['mtg-cm-w2', IDS.schoolCm, IDS.cohortCm, 'user-coach-a', '2026-03-16', 'Week 2'],
    ['mtg-tz-w1', IDS.schoolTz, IDS.cohortTz, 'user-coach-b', '2026-03-10', 'Week 1'],
    ['mtg-tz-w2', IDS.schoolTz, IDS.cohortTz, 'user-coach-b', '2026-03-17', 'Week 2'],
  ];
  for (const row of rows) {
    if (get(db, 'SELECT id FROM meetings WHERE id = ?', [row[0]])) continue;
    const school = get(db, 'SELECT id FROM schools WHERE id = ?', [row[1]]);
    if (!school) continue;
    insert(db, 'meetings', {
      id: row[0],
      school_id: row[1],
      cohort_id: row[2],
      coach_id: row[3],
      meets_on: row[4],
      label: row[5],
      created_at: '2026-03-01T00:00:00.000Z',
      created_by: 'user-organiser',
    });
  }
  for (const [learnerId, userId] of [['lrn-cm-a', 'user-student-a'], ['lrn-cm-b', 'user-student-b']]) {
    run(db, 'UPDATE learners SET user_id = ? WHERE id = ? AND user_id IS NULL', [userId, learnerId]);
  }
}
