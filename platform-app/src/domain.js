import fs from 'node:fs';
import path from 'node:path';
import { canonicalString, digestOf, sha256 } from './canonical.js';
import { compareSeasons } from './compare.js';
import { IDS, INCLUSION_RULES, RUBRIC_CRITERIA, VALIDATION_SCRIPT } from './constants.js';
import { all, get, insert, run, transaction } from './db.js';
import {
  canReadClaim,
  canReadEvidence,
  canReadProject,
  canReadSchool,
  claimById,
  evidenceById,
  isId,
  projectById,
  requireClaim,
  requireCoach,
  requireEvidence,
  requireOrganiser,
  requireProject,
  requireSchool,
} from './access.js';
import { HttpError, notAvailable, notFound } from './http-error.js';

function at(now) {
  return typeof now === 'function' ? now() : now;
}

function newId(prefix) {
  return `${prefix}-${sha256(String(Math.random()) + Date.now()).slice(0, 12)}`;
}

function parseCount(value, label, required) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(422, `${label} is required. Save a draft if you do not have it yet.`);
    return null;
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new HttpError(422, `${label} must be a whole number.`);
  return Number(text);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(422, 'Use an activity date in the form YYYY-MM-DD.');
  }
  return value;
}

export function addEvent(db, { now, action, user, subjectType, subjectId, schoolId = null, detail = {} }) {
  insert(db, 'events', {
    at: at(now),
    action,
    actor_role: user.role,
    actor_id: user.id,
    subject_type: subjectType,
    subject_id: subjectId,
    school_id: schoolId,
    detail_json: JSON.stringify(detail),
  });
}

function claimDefaults(schoolId) {
  const cohort = schoolId === IDS.schoolTz
    ? { id: IDS.cohortTz, season: IDS.seasonAfrica, tier: 'starter', scope: 'starter|ages-12-14|season-africa-1' }
    : { id: IDS.cohortCm, season: IDS.seasonAfrica, tier: 'intermediate', scope: 'intermediate|ages-12-14|season-africa-1' };
  return cohort;
}

function evidenceForSeries(db, seriesId) {
  return all(db, `SELECT * FROM evidence_items
    WHERE permission_state = 'active' AND redaction_state = 'redacted'
      AND claim_id IN (SELECT id FROM claims WHERE series_id = ?)
    ORDER BY id`, [seriesId]);
}

function snapshotPayload(claim, evidenceRows) {
  return {
    record: 'approved_claim',
    claim_id: claim.id,
    series_id: claim.series_id,
    version: claim.version,
    school_id: claim.school_id,
    cohort_id: claim.cohort_id,
    season_id: claim.season_id,
    definition_label: claim.definition_label,
    metric_version: claim.metric_version,
    rubric_version_id: claim.rubric_version_id,
    window_start: claim.window_start,
    window_end: claim.window_end,
    numerator: claim.numerator,
    denominator: claim.denominator,
    inclusion_rules: claim.inclusion_rules,
    scope_key: claim.scope_key,
    activity_date: claim.activity_date,
    correction_reason: claim.correction_reason,
    prior_claim_id: claim.prior_claim_id,
    approved_by_role: 'organiser',
    evidence: evidenceRows.map((row) => ({
      id: row.id,
      source_type: row.source_type,
      activity_date: row.activity_date,
      redaction_state: row.redaction_state,
      body_sha256: sha256(row.body_redacted || ''),
    })),
  };
}

export function listClaims(db, user, now) {
  if (!user || user.role === 'student') return [];
  return all(db, 'SELECT * FROM claims ORDER BY school_id, series_id, version')
    .filter((claim) => canReadClaim(db, user, claim, at(now)));
}

export function listProjects(db, user, now) {
  return all(db, 'SELECT * FROM projects ORDER BY id')
    .filter((project) => canReadProject(db, user, project, at(now)));
}

export function listEvidence(db, user, now) {
  if (!user || user.role === 'student') return [];
  return all(db, 'SELECT * FROM evidence_items ORDER BY id')
    .filter((item) => canReadEvidence(db, user, item, at(now)));
}

export function saveClaimDraft(db, user, input, now) {
  const schoolId = input.schoolId;
  requireCoach(db, user, schoolId, at(now));
  const cohort = get(db, 'SELECT * FROM cohorts WHERE id = ? AND school_id = ?', [input.cohortId || claimDefaults(schoolId).id, schoolId]);
  if (!cohort) throw notFound();
  const id = input.id || newId('claim');
  if (!isId(id)) throw new HttpError(422, 'That identifier is not valid.');
  if (claimById(db, id)) throw new HttpError(422, 'That draft already exists.');
  const numerator = parseCount(input.numerator, 'Numerator', false);
  const denominator = parseCount(input.denominator, 'Denominator', false);
  if (numerator != null && denominator != null && numerator > denominator) {
    throw new HttpError(422, 'The numerator cannot be larger than the denominator.');
  }
  const row = {
    id,
    school_id: schoolId,
    cohort_id: cohort.id,
    season_id: cohort.season_id,
    series_id: id,
    definition_label: 'Qualifying rubric completions',
    metric_version: 'qualifying-completions-v1',
    rubric_version_id: IDS.rubric,
    window_start: cohort.window_start,
    window_end: cohort.window_end,
    numerator,
    denominator,
    coach_hours: null,
    evidence_coverage: null,
    scope_key: claimDefaults(schoolId).scope,
    inclusion_rules: INCLUSION_RULES,
    status: 'draft',
    version: 1,
    prior_claim_id: null,
    correction_reason: null,
    activity_date: input.activityDate ? parseDate(input.activityDate) : cohort.window_end,
    submitted_by: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    created_at: at(now),
  };
  insert(db, 'claims', row);
  return claimById(db, id);
}

export function submitClaim(db, user, input, now) {
  const schoolId = input.schoolId;
  requireCoach(db, user, schoolId, at(now));
  const numerator = parseCount(input.numerator, 'Numerator', true);
  const denominator = parseCount(input.denominator, 'Denominator', true);
  if (denominator === 0) throw new HttpError(422, 'The denominator is missing. The rate stays blank until it is known.');
  if (numerator > denominator) throw new HttpError(422, 'The numerator cannot be larger than the denominator.');
  const activityDate = parseDate(input.activityDate);
  const cohort = get(db, 'SELECT * FROM cohorts WHERE school_id = ? AND season_id = ?', [schoolId, IDS.seasonAfrica]);
  if (!cohort) throw notFound();
  const id = input.id || newId('claim');
  if (!isId(id)) throw new HttpError(422, 'That identifier is not valid.');
  if (claimById(db, id)) throw new HttpError(422, 'A record with that id already exists. File a correction instead of replacing it.');
  const stamp = at(now);
  const row = {
    id,
    school_id: schoolId,
    cohort_id: cohort.id,
    season_id: cohort.season_id,
    series_id: input.seriesId && isId(input.seriesId) ? input.seriesId : id,
    definition_label: 'Qualifying rubric completions',
    metric_version: 'qualifying-completions-v1',
    rubric_version_id: IDS.rubric,
    window_start: cohort.window_start,
    window_end: cohort.window_end,
    numerator,
    denominator,
    coach_hours: null,
    evidence_coverage: null,
    scope_key: claimDefaults(schoolId).scope,
    inclusion_rules: INCLUSION_RULES,
    status: 'submitted',
    version: 1,
    prior_claim_id: null,
    correction_reason: null,
    activity_date: activityDate,
    submitted_by: user.id,
    submitted_at: stamp,
    approved_by: null,
    approved_at: null,
    created_at: stamp,
  };
  transaction(db, () => {
    insert(db, 'claims', row);
    addEvent(db, {
      now: stamp,
      action: 'submitted',
      user,
      subjectType: 'claim',
      subjectId: id,
      schoolId,
      detail: { version: 1, numerator, denominator },
    });
  });
  return claimById(db, id);
}

export function submitCorrection(db, user, priorId, input, now) {
  const prior = claimById(db, priorId);
  requireClaim(db, user, prior, at(now));
  requireCoach(db, user, prior.school_id, at(now));
  if (prior.status !== 'approved') throw new HttpError(422, 'Only an approved version can be corrected. The approved row stays as it is.');
  const latest = get(db, 'SELECT * FROM claims WHERE series_id = ? ORDER BY version DESC LIMIT 1', [prior.series_id]);
  if (!latest || latest.id !== prior.id) throw new HttpError(422, 'Correct the latest version in this series.');
  const open = get(db, `SELECT id FROM claims WHERE series_id = ? AND status IN ('draft','submitted','returned')`, [prior.series_id]);
  if (open) throw new HttpError(422, 'A correction is already waiting for review.');
  const numerator = parseCount(input.numerator, 'Numerator', true);
  const denominator = parseCount(input.denominator, 'Denominator', true);
  if (denominator === 0) throw new HttpError(422, 'The denominator is missing. The rate stays blank until it is known.');
  if (numerator > denominator) throw new HttpError(422, 'The numerator cannot be larger than the denominator.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 8) throw new HttpError(422, 'A correction needs a short reason. Do not include learner names.');
  const activityDate = parseDate(input.activityDate);
  const id = input.id || newId('claim');
  if (!isId(id)) throw new HttpError(422, 'That identifier is not valid.');
  const stamp = at(now);
  transaction(db, () => {
    insert(db, 'claims', {
      id,
      school_id: prior.school_id,
      cohort_id: prior.cohort_id,
      season_id: prior.season_id,
      series_id: prior.series_id,
      definition_label: prior.definition_label,
      metric_version: prior.metric_version,
      rubric_version_id: prior.rubric_version_id,
      window_start: prior.window_start,
      window_end: prior.window_end,
      numerator,
      denominator,
      coach_hours: prior.coach_hours,
      evidence_coverage: prior.evidence_coverage,
      scope_key: prior.scope_key,
      inclusion_rules: prior.inclusion_rules,
      status: 'submitted',
      version: prior.version + 1,
      prior_claim_id: prior.id,
      correction_reason: reason,
      activity_date: activityDate,
      submitted_by: user.id,
      submitted_at: stamp,
      approved_by: null,
      approved_at: null,
      created_at: stamp,
    });
    addEvent(db, {
      now: stamp,
      action: 'corrected',
      user,
      subjectType: 'claim',
      subjectId: id,
      schoolId: prior.school_id,
      detail: {
        prior_claim_id: prior.id,
        from_numerator: prior.numerator,
        to_numerator: numerator,
        denominator,
        reason,
      },
    });
  });
  return claimById(db, id);
}

export function approveClaim(db, user, claimId, now, input = {}) {
  const claim = claimById(db, claimId);
  requireClaim(db, user, claim, at(now));
  requireOrganiser(db, user, claim.school_id, at(now));
  if (claim.status !== 'submitted') throw new HttpError(422, 'Only a submitted version can be approved.');
  if (claim.submitted_by === user.id) throw new HttpError(422, 'A different person has to approve this.');
  if (claim.numerator == null || claim.denominator == null || claim.denominator === 0) {
    throw new HttpError(422, 'Numerator and denominator are required. Missing values stay blank.');
  }
  const evidenceRows = evidenceForSeries(db, claim.series_id);
  const payload = snapshotPayload(claim, evidenceRows);
  const canonical = canonicalString(payload);
  const digest = sha256(canonical);
  const stamp = at(now);
  const snapshotId = `snap-${claim.id}`;
  const reasonCode = typeof input.reasonCode === 'string' && input.reasonCode.trim() ? input.reasonCode.trim() : 'COUNT-CONFIRMED';
  const approvalMark = sha256(`demo-approval-mark|${digest}|${reasonCode}|${stamp}`);
  transaction(db, () => {
    insert(db, 'snapshots', {
      id: snapshotId,
      subject_type: 'claim',
      subject_id: claim.id,
      version: claim.version,
      digest_sha256: digest,
      canonical_json: canonical,
      validation_script: VALIDATION_SCRIPT,
      created_at: stamp,
      created_by_role: 'organiser',
    });
    insert(db, 'digest_ledger', {
      snapshot_id: snapshotId,
      digest_sha256: digest,
      created_at: stamp,
    });
    run(db, `UPDATE claims SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND status = 'submitted'`, [user.id, stamp, claim.id]);
    addEvent(db, {
      now: stamp,
      action: 'approved',
      user,
      subjectType: 'claim',
      subjectId: claim.id,
      schoolId: claim.school_id,
      detail: {
        version: claim.version,
        numerator: claim.numerator,
        denominator: claim.denominator,
        digest_sha256: digest,
        reason_code: reasonCode,
        approval_mark: approvalMark,
        dual_control: true,
      },
    });
  });
  return { claim: claimById(db, claim.id), digest, snapshotId };
}

export function returnClaim(db, user, claimId, note, now) {
  const claim = claimById(db, claimId);
  requireClaim(db, user, claim, at(now));
  requireOrganiser(db, user, claim.school_id, at(now));
  if (claim.status !== 'submitted') throw new HttpError(422, 'Only a submitted version can be sent back.');
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length < 8) throw new HttpError(422, 'Say what needs to change. Do not include learner names.');
  const stamp = at(now);
  transaction(db, () => {
    run(db, `UPDATE claims SET status = 'returned' WHERE id = ? AND status = 'submitted'`, [claim.id]);
    addEvent(db, {
      now: stamp,
      action: 'returned',
      user,
      subjectType: 'claim',
      subjectId: claim.id,
      schoolId: claim.school_id,
      detail: { note: text },
    });
  });
  return claimById(db, claim.id);
}

export function resubmitClaim(db, user, claimId, input, now) {
  const claim = claimById(db, claimId);
  requireClaim(db, user, claim, at(now));
  requireCoach(db, user, claim.school_id, at(now));
  if (claim.status !== 'returned' && claim.status !== 'draft') {
    throw new HttpError(422, 'Approved versions stay as they are. File a correction.');
  }
  const numerator = parseCount(input.numerator, 'Numerator', true);
  const denominator = parseCount(input.denominator, 'Denominator', true);
  if (numerator > denominator || denominator === 0) throw new HttpError(422, 'Check the numerator and the denominator.');
  const stamp = at(now);
  transaction(db, () => {
    run(db, `UPDATE claims SET status = 'submitted', numerator = ?, denominator = ?, activity_date = ?, submitted_by = ?, submitted_at = ? WHERE id = ?`, [
      numerator, denominator, parseDate(input.activityDate), user.id, stamp, claim.id,
    ]);
    addEvent(db, {
      now: stamp,
      action: 'submitted',
      user,
      subjectType: 'claim',
      subjectId: claim.id,
      schoolId: claim.school_id,
      detail: { version: claim.version, numerator, denominator, resubmit: true },
    });
  });
  return claimById(db, claim.id);
}

export function traceClaim(db, user, claimId, now) {
  const claim = claimById(db, claimId);
  requireClaim(db, user, claim, at(now));
  const versions = all(db, 'SELECT * FROM claims WHERE series_id = ? ORDER BY version', [claim.series_id]);
  const snapshots = all(db, `SELECT * FROM snapshots WHERE subject_type = 'claim' AND subject_id IN (${versions.map(() => '?').join(',')}) ORDER BY version`, versions.map((row) => row.id));
  const evidence = evidenceForSeries(db, claim.series_id);
  const current = versions.filter((row) => row.status === 'approved').at(-1) || null;
  return { requested: claim, current, versions, snapshots, evidence, rubric: RUBRIC_CRITERIA };
}

export function addEvidence(db, user, input, now, filesDir) {
  requireCoach(db, user, input.schoolId, at(now));
  const id = input.id || newId('ev');
  if (!isId(id)) throw new HttpError(422, 'That identifier is not valid.');
  if (evidenceById(db, id)) throw new HttpError(422, 'That evidence id already exists.');
  const redaction = input.redactionState === 'private_removable' ? 'private_removable' : 'redacted';
  const body = typeof input.body === 'string' ? input.body : '';
  if (!body.trim()) throw new HttpError(422, 'Add the redacted note. Do not attach learner names or photos.');
  if (body.length > 20000) throw new HttpError(422, 'Keep the note short. Video is not required.');
  const filename = redaction === 'redacted' ? 'redacted-note.txt' : 'removable-note.txt';
  const stamp = at(now);
  transaction(db, () => {
    insert(db, 'evidence_items', {
      id,
      project_id: input.projectId && isId(input.projectId) ? input.projectId : null,
      claim_id: input.claimId && isId(input.claimId) ? input.claimId : null,
      school_id: input.schoolId,
      activity_date: parseDate(input.activityDate),
      server_timestamp: stamp,
      source_type: input.sourceType || 'test_log',
      submitter_role: 'coach',
      submitter_user_id: user.id,
      reviewer_user_id: null,
      metric_version: 'qualifying-completions-v1',
      rubric_version_id: IDS.rubric,
      redaction_state: redaction,
      permission_state: 'active',
      access_scope: `school:${input.schoolId}`,
      retention_class: redaction === 'redacted' ? 'light_evidence' : 'removable_private',
      version_ref: input.versionRef || null,
      body_redacted: body,
      filename,
      withdrawn_at: null,
    });
    addEvent(db, {
      now: stamp,
      action: 'submitted',
      user,
      subjectType: 'evidence',
      subjectId: id,
      schoolId: input.schoolId,
      detail: { source_type: input.sourceType || 'test_log', redaction_state: redaction },
    });
  });
  if (filesDir) {
    fs.mkdirSync(filesDir, { recursive: true });
    const file = path.resolve(filesDir, `${id}.txt`);
    if (!file.startsWith(path.resolve(filesDir) + path.sep)) throw notFound();
    fs.writeFileSync(file, body);
  }
  return evidenceById(db, id);
}

export function withdrawEvidence(db, user, evidenceId, now, filesDir) {
  const item = evidenceById(db, evidenceId);
  requireEvidence(db, user, item, at(now));
  requireCoach(db, user, item.school_id, at(now));
  if (item.retention_class !== 'removable_private') {
    throw new HttpError(422, 'This redacted note stays with the approved snapshot. Only a removable private file can be withdrawn.');
  }
  const hold = get(db, 'SELECT id FROM legal_holds WHERE record_id = ? AND active = 1', [item.id]);
  if (hold) throw new HttpError(422, 'Legal hold blocks removal.');
  const stamp = at(now);
  transaction(db, () => {
    run(db, `UPDATE evidence_items
      SET permission_state = 'withdrawn', body_redacted = NULL, filename = NULL, withdrawn_at = ?
      WHERE id = ? AND permission_state = 'active'`, [stamp, item.id]);
    addEvent(db, {
      now: stamp,
      action: 'revoked',
      user,
      subjectType: 'evidence',
      subjectId: item.id,
      schoolId: item.school_id,
      detail: { evidence_id: item.id },
    });
  });
  if (filesDir) {
    const file = path.resolve(filesDir, `${item.id}.txt`);
    if (file.startsWith(path.resolve(filesDir) + path.sep) && fs.existsSync(file)) fs.unlinkSync(file);
  }
  return evidenceById(db, item.id);
}

export function readEvidenceBody(db, user, evidenceId, now, filesDir) {
  const item = evidenceById(db, evidenceId);
  requireEvidence(db, user, item, at(now));
  if (item.body_redacted == null) throw notFound();
  if (filesDir) {
    const file = path.resolve(filesDir, `${item.id}.txt`);
    if (file.startsWith(path.resolve(filesDir) + path.sep) && fs.existsSync(file)) {
      return { filename: item.filename, body: fs.readFileSync(file, 'utf8') };
    }
  }
  return { filename: item.filename, body: item.body_redacted };
}

export function completeFromPracticeLesson(db, user, input, now) {
  requireCoach(db, user, input.schoolId || userSchool(db, user), at(now));
  const lesson = get(db, 'SELECT * FROM lessons WHERE id = ?', [input.lessonId || IDS.lessonSorter]);
  if (!lesson || lesson.kind === 'practice' || Number(lesson.can_complete_season_project) !== 1) {
    throw new HttpError(422, 'The paper/plastic sorter is a practice lesson. It cannot complete a season project. Record a separate local project.');
  }
  throw new HttpError(422, 'This lesson is not a season project.');
}

function userSchool(db, user) {
  const row = get(db, 'SELECT school_id FROM memberships WHERE user_id = ? AND school_id IS NOT NULL LIMIT 1', [user.id]);
  return row?.school_id;
}

export function approveVerifiedOutcome(db, user, projectId, now) {
  const project = projectById(db, projectId);
  requireProject(db, user, project, at(now));
  requireOrganiser(db, user, project.school_id, at(now));
  if (project.lesson_id) {
    const lesson = get(db, 'SELECT * FROM lessons WHERE id = ?', [project.lesson_id]);
    if (!lesson || Number(lesson.can_complete_season_project) !== 1) {
      throw new HttpError(422, 'The paper/plastic sorter is a practice lesson. It cannot complete a season project.');
    }
  }
  const stage = get(db, `SELECT * FROM project_stages WHERE project_id = ? AND stage = 'verified_outcome'`, [project.id]);
  if (!stage) throw notFound();
  if (stage.status === 'approved') throw new HttpError(422, 'That verified outcome is already approved.');
  const baseline = currentMeasurement(db, project.id, 'baseline');
  const result = currentMeasurement(db, project.id, 'result');
  if (!baseline || baseline.not_measured || baseline.value == null) {
    throw new HttpError(422, 'A verified outcome needs a measured baseline. The cell stays blank until then.');
  }
  if (!result || result.value == null) throw new HttpError(422, 'A verified outcome needs a measured result.');
  if (baseline.comparable_group !== result.comparable_group) {
    throw new HttpError(422, 'The baseline and the result are not on a comparable basis.');
  }
  if (result.evidence_id) {
    const evidence = evidenceById(db, result.evidence_id);
    if (!evidence || evidence.permission_state !== 'active' || evidence.redaction_state !== 'redacted') {
      throw new HttpError(422, 'The redacted source is missing, so this stays unverified.');
    }
  } else {
    throw new HttpError(422, 'A verified outcome needs a redacted source.');
  }
  const use = get(db, `SELECT * FROM project_stages WHERE project_id = ? AND stage = 'confirmed_use'`, [project.id]);
  if (!use || Number(use.independent_verifier) !== 1) {
    throw new HttpError(422, 'A local verifier independent of the submitter has to attest confirmed use first.');
  }
  if (use.attestor_user_id && use.attestor_user_id === user.id) {
    throw new HttpError(422, 'The organiser approving the outcome has to be a different person from the use attestor.');
  }
  const stamp = at(now);
  transaction(db, () => {
    run(db, `UPDATE project_stages
      SET status = 'approved', approved_by = ?, approved_at = ?, method_note = ?, redacted_source_id = ?
      WHERE id = ? AND status != 'approved'`, [
      user.id,
      stamp,
      'Reviewed baseline comparison on the same item mix. Not a UN indicator movement.',
      result.evidence_id,
      stage.id,
    ]);
    addEvent(db, {
      now: stamp,
      action: 'approved',
      user,
      subjectType: 'project_stage',
      subjectId: stage.id,
      schoolId: project.school_id,
      detail: { project_id: project.id, stage: 'verified_outcome', primary_sdg: project.primary_sdg },
    });
  });
  return get(db, 'SELECT * FROM project_stages WHERE id = ?', [stage.id]);
}

function currentMeasurement(db, projectId, kind) {
  const rows = all(db, 'SELECT * FROM measurements WHERE project_id = ? AND kind = ? ORDER BY version', [projectId, kind]);
  return rows.at(-1) || null;
}

export function projectReport(db, project) {
  const baseline = currentMeasurement(db, project.id, 'baseline');
  const result = currentMeasurement(db, project.id, 'result');
  const stages = all(db, 'SELECT * FROM project_stages WHERE project_id = ? ORDER BY stage', [project.id]);
  const resultEvidence = result?.evidence_id ? evidenceById(db, result.evidence_id) : null;
  const resultWithdrawn = resultEvidence && resultEvidence.permission_state !== 'active';
  return {
    project,
    baseline: baseline && !baseline.not_measured ? baseline : null,
    baselineMissing: !baseline || baseline.not_measured || baseline.value == null,
    result: result && !resultWithdrawn ? result : null,
    resultWithdrawn: Boolean(resultWithdrawn),
    stages,
    output: stages.some((stage) => stage.stage === 'prototype' && stage.status !== 'missing'),
    confirmedUse: stages.some((stage) => stage.stage === 'confirmed_use' && stage.status !== 'missing'),
    verified: stages.some((stage) => stage.stage === 'verified_outcome' && stage.status === 'approved') && !resultWithdrawn,
  };
}

export function goalRollup(db, user, now) {
  const projects = listProjects(db, user, now).filter((project) => project.visibility === 'school');
  const projectsByGoal = {};
  const outputByGoal = {};
  const confirmedUseByGoal = {};
  const verifiedByGoal = {};
  for (const project of projects) {
    if (project.lesson_id) {
      const lesson = get(db, 'SELECT * FROM lessons WHERE id = ?', [project.lesson_id]);
      if (!lesson || Number(lesson.can_complete_season_project) !== 1) continue;
    }
    if (project.primary_sdg == null) continue;
    const key = String(project.primary_sdg);
    const report = projectReport(db, project);
    projectsByGoal[key] = (projectsByGoal[key] || 0) + 1;
    if (report.output) outputByGoal[key] = (outputByGoal[key] || 0) + 1;
    if (report.confirmedUse) confirmedUseByGoal[key] = (confirmedUseByGoal[key] || 0) + 1;
    if (report.verified) verifiedByGoal[key] = (verifiedByGoal[key] || 0) + 1;
  }
  return { projectsByGoal, outputByGoal, confirmedUseByGoal, verifiedByGoal };
}

export function submitResultCorrection(db, user, projectId, input, now) {
  const project = projectById(db, projectId);
  requireProject(db, user, project, at(now));
  requireCoach(db, user, project.school_id, at(now));
  const prior = currentMeasurement(db, project.id, 'result');
  if (!prior) throw notFound();
  const value = parseCount(input.value, 'Result', true);
  const denominator = parseCount(input.denominator, 'Denominator', true);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 8) throw new HttpError(422, 'A correction needs a short reason. Do not include learner names.');
  const id = input.id || newId('meas');
  if (!isId(id)) throw new HttpError(422, 'That identifier is not valid.');
  const stamp = at(now);
  transaction(db, () => {
    insert(db, 'measurements', {
      id,
      project_id: project.id,
      kind: 'result',
      measure: prior.measure,
      units: prior.units,
      value,
      denominator,
      not_measured: 0,
      period_label: input.periodLabel || prior.period_label,
      comparable_group: prior.comparable_group,
      version: prior.version + 1,
      prior_id: prior.id,
      status: 'recorded',
      reason,
      evidence_id: prior.evidence_id,
      submitted_by: user.id,
      submitted_at: stamp,
      approved_by: null,
      approved_at: null,
    });
    addEvent(db, {
      now: stamp,
      action: 'corrected',
      user,
      subjectType: 'measurement',
      subjectId: id,
      schoolId: project.school_id,
      detail: { project_id: project.id, from_value: prior.value, to_value: value, reason },
    });
  });
  return get(db, 'SELECT * FROM measurements WHERE id = ?', [id]);
}

export function cloneSeasonMaterials(db, user, fromSeasonId, toSeasonId, now) {
  if (user.role !== 'organiser') throw notAvailable();
  const source = get(db, 'SELECT * FROM seasons WHERE id = ?', [fromSeasonId]);
  const target = get(db, 'SELECT * FROM seasons WHERE id = ?', [toSeasonId]);
  if (!source || !target) throw notFound();
  const already = get(db, 'SELECT id FROM rubric_versions WHERE season_id = ? AND source_rubric_id IS NOT NULL', [target.id]);
  if (already) {
    return { already: true, rubrics: 0, lessons: 0, materials: 0, projectsCopied: 0, studentsCopied: 0, grantsCopied: 0 };
  }
  const rubrics = all(db, 'SELECT * FROM rubric_versions WHERE season_id = ? AND approved = 1 AND non_identifying = 1', [source.id]);
  const lessons = all(db, 'SELECT * FROM lessons WHERE season_id = ? AND approved = 1 AND non_identifying = 1', [source.id]);
  const materials = all(db, 'SELECT * FROM coach_materials WHERE season_id = ? AND approved = 1 AND non_identifying = 1', [source.id]);
  const stamp = at(now);
  transaction(db, () => {
    for (const rubric of rubrics) {
      insert(db, 'rubric_versions', {
        id: `${rubric.id}-us`,
        season_id: target.id,
        version_label: rubric.version_label,
        criteria_json: rubric.criteria_json,
        approved: 1,
        non_identifying: 1,
        source_rubric_id: rubric.id,
      });
    }
    for (const lesson of lessons) {
      insert(db, 'lessons', {
        id: `${lesson.id}-us`,
        season_id: target.id,
        title: lesson.title,
        kind: lesson.kind,
        can_complete_season_project: lesson.can_complete_season_project,
        body: lesson.body,
        approved: 1,
        non_identifying: 1,
        source_lesson_id: lesson.id,
      });
    }
    for (const material of materials) {
      insert(db, 'coach_materials', {
        id: `${material.id}-us`,
        season_id: target.id,
        title: material.title,
        body: material.body,
        approved: 1,
        non_identifying: 1,
        source_material_id: material.id,
      });
    }
    addEvent(db, {
      now: stamp,
      action: 'cloned',
      user,
      subjectType: 'season',
      subjectId: target.id,
      detail: { from_season_id: source.id, rubrics: rubrics.length, lessons: lessons.length, materials: materials.length, students_copied: 0, grants_copied: 0, projects_copied: 0 },
    });
  });
  return {
    already: false,
    rubrics: rubrics.length,
    lessons: lessons.length,
    materials: materials.length,
    projectsCopied: 0,
    studentsCopied: 0,
    grantsCopied: 0,
  };
}

export function recordHold(db, user, comparisonId, now) {
  if (user.role !== 'organiser') throw notAvailable();
  const row = get(db, 'SELECT * FROM comparison_cases WHERE id = ?', [comparisonId]);
  if (!row) throw notFound();
  const existing = get(db, 'SELECT * FROM guardrail_reviews WHERE comparison_id = ?', [comparisonId]);
  if (existing) throw new HttpError(422, 'A hold is already recorded.');
  const guardrail = JSON.parse(row.guardrail_json);
  if (guardrail.learning !== 'worsened' && guardrail.access !== 'worsened') {
    throw new HttpError(422, 'This comparison has no guardrail failure to hold.');
  }
  const stamp = at(now);
  const id = `hold-${comparisonId}`;
  transaction(db, () => {
    insert(db, 'guardrail_reviews', {
      id,
      comparison_id: comparisonId,
      learning_delta: guardrail.learning,
      access_delta: guardrail.access,
      decision: 'hold',
      decided_by: user.id,
      decided_at: stamp,
      note: 'Efficiency rose, and the learning check worsened. Hold. No automatic change.',
    });
    run(db, `UPDATE experiment_log SET decision = 'hold' WHERE season_id = ?`, [IDS.seasonAfrica]);
    addEvent(db, {
      now: stamp,
      action: 'held',
      user,
      subjectType: 'comparison',
      subjectId: comparisonId,
      detail: { decision: 'hold' },
    });
  });
  return get(db, 'SELECT * FROM guardrail_reviews WHERE id = ?', [id]);
}

export function comparisonViews(db) {
  const reviews = new Map(all(db, 'SELECT * FROM guardrail_reviews').map((row) => [row.comparison_id, row]));
  return all(db, 'SELECT * FROM comparison_cases ORDER BY id').map((row) => {
    const baseline = JSON.parse(row.baseline_json);
    const candidate = JSON.parse(row.candidate_json);
    const guardrail = JSON.parse(row.guardrail_json);
    const review = reviews.get(row.id) || null;
    const result = compareSeasons(baseline, candidate, guardrail, review?.decision || null);
    return { row, baseline, candidate, guardrail, review, result };
  });
}

export function followupsFor(db, cohortId) {
  return all(db, 'SELECT * FROM followups WHERE cohort_id = ? ORDER BY kind', [cohortId]);
}

export function visibleEvents(db, user, now) {
  return all(db, 'SELECT * FROM events ORDER BY id').filter((event) => {
    if (event.subject_type === 'claim') return canReadClaim(db, user, claimById(db, event.subject_id), at(now));
    if (event.subject_type === 'evidence') {
      const item = evidenceById(db, event.subject_id);
      if (!item) return false;
      if (item.permission_state !== 'active') {
        return canReadSchool(db, user, item.school_id, at(now)) && user.role !== 'student';
      }
      return canReadEvidence(db, user, item, at(now));
    }
    if (event.subject_type === 'project' || event.subject_type === 'project_stage' || event.subject_type === 'measurement') {
      return false;
    }
    if (event.subject_type === 'season' || event.subject_type === 'comparison') return user.role === 'organiser';
    if (event.school_id) return canReadSchool(db, user, event.school_id, at(now));
    return false;
  });
}

export function updateStudentDraft(db, user, projectId, input, now) {
  const project = projectById(db, projectId);
  requireProject(db, user, project, at(now));
  if (user.role !== 'student' || project.owner_user_id !== user.id) throw notAvailable();
  if (project.status !== 'draft') throw new HttpError(422, 'This draft can no longer be edited.');
  const text = typeof input.localProblem === 'string' ? input.localProblem.trim() : '';
  if (text.length < 8) throw new HttpError(422, 'Write a short note. Do not add a real name or contact detail.');
  if (text.length > 500) throw new HttpError(422, 'Keep the note short.');
  run(db, 'UPDATE projects SET local_problem = ? WHERE id = ? AND status = ?', [text, project.id, 'draft']);
  return projectById(db, project.id);
}

export function revokeGrant(db, user, grantId, now) {
  if (user.role !== 'organiser') throw notAvailable();
  if (!isId(grantId)) throw notFound();
  const grant = get(db, 'SELECT * FROM access_grants WHERE id = ?', [grantId]);
  if (!grant) throw notFound();
  if (!canReadSchool(db, user, grant.scope_id, at(now)) && grant.scope_type === 'school') throw notFound();
  if (grant.revoked_at) return grant;
  const stamp = at(now);
  transaction(db, () => {
    run(db, 'UPDATE access_grants SET revoked_at = ? WHERE id = ?', [stamp, grant.id]);
    addEvent(db, {
      now: stamp,
      action: 'revoked',
      user,
      subjectType: 'access_grant',
      subjectId: grant.id,
      schoolId: grant.scope_type === 'school' ? grant.scope_id : null,
      detail: { scope_type: grant.scope_type, scope_id: grant.scope_id },
    });
  });
  return get(db, 'SELECT * FROM access_grants WHERE id = ?', [grant.id]);
}

export function digestOfPayload(value) {
  return digestOf(value);
}

export { claimById, evidenceById, projectById };
