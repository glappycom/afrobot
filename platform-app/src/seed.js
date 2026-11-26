import { COMPARISONS, CORRECTION_REASON, DEMO_USERS, IDS, INCLUSION_RULES, OTHER_DRAFT_TOKEN, PRIVATE_NOTE, RUBRIC_CRITERIA } from './constants.js';
import {
  addEvidence,
  approveClaim,
  cloneSeasonMaterials,
  recordHold,
  submitClaim,
  submitCorrection,
  withdrawEvidence,
} from './domain.js';
import { insert } from './db.js';

function user(id) {
  return DEMO_USERS.find((row) => row.id === id);
}

export function seedFoundation(db) {
  insert(db, 'organisations', { id: IDS.org, name: 'AfroBot fictional pilot' });
  insert(db, 'regions', { id: IDS.regionAfrica, name: 'Africa' });
  insert(db, 'regions', { id: IDS.regionUs, name: 'United States' });
  insert(db, 'seasons', {
    id: IDS.seasonAfrica,
    region_id: IDS.regionAfrica,
    name: 'Africa first season (fictional pilot)',
    status: 'open',
    published: 0,
    cloned_from_season_id: null,
    notes: 'Synthetic season. Not a public programme record.',
  });
  insert(db, 'seasons', {
    id: IDS.seasonUs,
    region_id: IDS.regionUs,
    name: 'United States season draft',
    status: 'draft',
    published: 0,
    cloned_from_season_id: null,
    notes: 'Unpublished. No venue, date, or partner commitment is seeded.',
  });
  insert(db, 'schools', {
    id: IDS.schoolCm,
    organisation_id: IDS.org,
    region_id: IDS.regionAfrica,
    country_name: 'Cameroon',
    display_name: 'North Ridge Learning Circle (fictional)',
  });
  insert(db, 'schools', {
    id: IDS.schoolTz,
    organisation_id: IDS.org,
    region_id: IDS.regionAfrica,
    country_name: 'Tanzania',
    display_name: 'Lakeside Makers Circle (fictional)',
  });
  insert(db, 'cohorts', {
    id: IDS.cohortCm,
    school_id: IDS.schoolCm,
    season_id: IDS.seasonAfrica,
    label: 'Fictional cohort, intermediate',
    age_band: '12-14',
    challenge_tier: 'intermediate',
    window_start: '2026-03-02',
    window_end: '2026-04-24',
  });
  insert(db, 'cohorts', {
    id: IDS.cohortTz,
    school_id: IDS.schoolTz,
    season_id: IDS.seasonAfrica,
    label: 'Fictional cohort, starter',
    age_band: '12-14',
    challenge_tier: 'starter',
    window_start: '2026-03-02',
    window_end: '2026-04-24',
  });

  for (const row of DEMO_USERS) {
    insert(db, 'users', {
      id: row.id,
      username: row.username,
      display_name: row.displayName,
      role: row.role,
      password: row.password,
      mocked: 1,
    });
  }
  insert(db, 'memberships', { id: 'mem-coach-a', user_id: 'user-coach-a', school_id: IDS.schoolCm, cohort_id: IDS.cohortCm, season_id: IDS.seasonAfrica, role: 'coach' });
  insert(db, 'memberships', { id: 'mem-coach-b', user_id: 'user-coach-b', school_id: IDS.schoolTz, cohort_id: IDS.cohortTz, season_id: IDS.seasonAfrica, role: 'coach' });
  insert(db, 'memberships', { id: 'mem-org-cm', user_id: 'user-organiser', school_id: IDS.schoolCm, cohort_id: null, season_id: IDS.seasonAfrica, role: 'organiser' });
  insert(db, 'memberships', { id: 'mem-org-tz', user_id: 'user-organiser', school_id: IDS.schoolTz, cohort_id: null, season_id: IDS.seasonAfrica, role: 'organiser' });
  insert(db, 'memberships', { id: 'mem-stu-a', user_id: 'user-student-a', school_id: IDS.schoolCm, cohort_id: IDS.cohortCm, season_id: IDS.seasonAfrica, role: 'student' });
  insert(db, 'memberships', { id: 'mem-stu-b', user_id: 'user-student-b', school_id: IDS.schoolCm, cohort_id: IDS.cohortCm, season_id: IDS.seasonAfrica, role: 'student' });
  for (const row of [
    ['lrn-cm-a', IDS.schoolCm, IDS.cohortCm, 'A', 'active', '2027-06-01'],
    ['lrn-cm-b', IDS.schoolCm, IDS.cohortCm, 'B', 'active', '2027-06-01'],
    ['lrn-cm-c', IDS.schoolCm, IDS.cohortCm, 'C', 'missing', null],
    ['lrn-tz-a', IDS.schoolTz, IDS.cohortTz, 'A', 'active', '2027-01-14'],
    ['lrn-tz-b', IDS.schoolTz, IDS.cohortTz, 'B', 'expired', '2026-11-01'],
  ]) {
    insert(db, 'learners', { id: row[0], school_id: row[1], cohort_id: row[2], letter: row[3], consent: row[4], consent_until: row[5] });
  }
  insert(db, 'join_codes', { cohort_id: IDS.cohortCm, code: 'NRLC-4821' });
  insert(db, 'join_codes', { cohort_id: IDS.cohortTz, code: 'LMC-2294' });
  insert(db, 'season_progress', { cohort_id: IDS.cohortCm, planned: 4, done: 4, weeks_left: 3 });
  insert(db, 'season_progress', { cohort_id: IDS.cohortTz, planned: 6, done: 2, weeks_left: 3 });
  insert(db, 'access_grants', {
    id: IDS.grantAuditor,
    user_id: 'user-auditor',
    scope_type: 'school',
    scope_id: IDS.schoolCm,
    permission: 'read',
    starts_at: IDS.grantStarts,
    expires_at: IDS.grantExpires,
    revoked_at: null,
    granted_by: 'user-organiser',
  });

  insert(db, 'rubric_versions', {
    id: IDS.rubric,
    season_id: IDS.seasonAfrica,
    version_label: 'AFR-RUBRIC-1',
    criteria_json: JSON.stringify(RUBRIC_CRITERIA),
    approved: 1,
    non_identifying: 1,
    source_rubric_id: null,
  });
  insert(db, 'lessons', {
    id: IDS.lessonSorter,
    season_id: IDS.seasonAfrica,
    title: 'Paper and plastic sorter',
    kind: 'practice',
    can_complete_season_project: 0,
    body: 'Training milestone only. Sorting paper and plastic in a lesson does not complete a season project and does not prove a community result.',
    approved: 1,
    non_identifying: 1,
    source_lesson_id: null,
  });
  insert(db, 'coach_materials', {
    id: IDS.coachPack,
    season_id: IDS.seasonAfrica,
    title: 'Coach session card (non-identifying)',
    body: 'Open the room, run the practice sorter, then start the separate local project. Hardware spend is not a score.',
    approved: 1,
    non_identifying: 1,
    source_material_id: null,
  });

  insert(db, 'projects', {
    id: IDS.projectCm,
    school_id: IDS.schoolCm,
    cohort_id: IDS.cohortCm,
    season_id: IDS.seasonAfrica,
    stable_code: 'CM-SDG12-STATION',
    local_problem: 'A fictional community collection point mis-sorts paper and plastic. The cohort chose a station checklist and a second-day recount, which is a different record from the practice sorter lesson.',
    confirmation_date: '2026-03-15',
    verifier_role: 'fictional community verifier role, independent of the coach',
    primary_sdg: 12,
    sdg_other_explanation: null,
    sdg_target_ref: '12.5',
    pathway: 'intermediate',
    owner_user_id: null,
    visibility: 'school',
    status: 'submitted',
    lesson_id: null,
    peer_review_json: JSON.stringify({
      from_country: 'Tanzania',
      from_team: 'fictional team at the other pilot school',
      note: 'Repeat the count on a second day before calling it a fair test.',
      response: 'Added a second-day recount before recording the result.',
      change: 'Second-day recount added to the test log.',
    }),
    remote_fallback: 'The showcase can be a remote call. Travel is not required for learning or recognition.',
    event_readiness: 'remote',
    dream_prize_status: 'deferred',
    participating_schools_json: JSON.stringify([IDS.schoolCm]),
    revision_note: 'Version 2 of the station aid: added a second-day recount after peer review.',
    next_resource_ask: 'One printed recount sheet per session.',
    methodology: 'Same item mix, two count windows. Mis-sorts per 100 items. Not a UN indicator result and not an endorsement.',
    created_at: '2026-03-16T09:00:00.000Z',
  });
  insert(db, 'projects', {
    id: IDS.projectTz,
    school_id: IDS.schoolTz,
    cohort_id: IDS.cohortTz,
    season_id: IDS.seasonAfrica,
    stable_code: 'TZ-SDG6-MAP',
    local_problem: 'A fictional water-point map. This prototype does not prove access or safety.',
    confirmation_date: '2026-03-20',
    verifier_role: null,
    primary_sdg: 6,
    sdg_other_explanation: null,
    sdg_target_ref: null,
    pathway: 'starter',
    owner_user_id: null,
    visibility: 'school',
    status: 'draft',
    lesson_id: null,
    peer_review_json: null,
    remote_fallback: 'Remote showcase is enough.',
    event_readiness: 'remote',
    dream_prize_status: 'deferred',
    participating_schools_json: JSON.stringify([IDS.schoolTz]),
    revision_note: null,
    next_resource_ask: 'A paper map template.',
    methodology: 'Prototype only. No safety or access claim.',
    created_at: '2026-03-20T09:00:00.000Z',
  });
  insert(db, 'projects', {
    id: IDS.projectCross,
    school_id: null,
    cohort_id: null,
    season_id: IDS.seasonAfrica,
    stable_code: 'CROSS-REDACTED',
    local_problem: 'Redacted shared note: two fictional schools may compare a checklist. No learner records move with this note.',
    confirmation_date: null,
    verifier_role: null,
    primary_sdg: null,
    sdg_other_explanation: null,
    sdg_target_ref: null,
    pathway: 'intermediate',
    owner_user_id: null,
    visibility: 'redacted_shared',
    status: 'draft',
    lesson_id: null,
    peer_review_json: null,
    remote_fallback: 'Remote only.',
    event_readiness: 'undecided',
    dream_prize_status: 'deferred',
    participating_schools_json: JSON.stringify([IDS.schoolCm, IDS.schoolTz]),
    revision_note: null,
    next_resource_ask: null,
    methodology: 'Shared redacted note only.',
    created_at: '2026-04-01T09:00:00.000Z',
  });
  insert(db, 'projects', {
    id: IDS.projectStudentA,
    school_id: IDS.schoolCm,
    cohort_id: IDS.cohortCm,
    season_id: IDS.seasonAfrica,
    stable_code: 'STU-CM-1',
    local_problem: 'Fictional note from Learner CM-1 about a station checklist.',
    confirmation_date: null,
    verifier_role: null,
    primary_sdg: 12,
    sdg_other_explanation: null,
    sdg_target_ref: null,
    pathway: 'intermediate',
    owner_user_id: 'user-student-a',
    visibility: 'student_private',
    status: 'draft',
    lesson_id: null,
    peer_review_json: null,
    remote_fallback: null,
    event_readiness: null,
    dream_prize_status: 'deferred',
    participating_schools_json: '[]',
    revision_note: null,
    next_resource_ask: null,
    methodology: null,
    created_at: '2026-04-02T09:00:00.000Z',
  });
  insert(db, 'projects', {
    id: IDS.projectStudentB,
    school_id: IDS.schoolCm,
    cohort_id: IDS.cohortCm,
    season_id: IDS.seasonAfrica,
    stable_code: 'STU-CM-2',
    local_problem: `Fictional private draft from Learner CM-2. Token: ${OTHER_DRAFT_TOKEN}`,
    confirmation_date: null,
    verifier_role: null,
    primary_sdg: null,
    sdg_other_explanation: null,
    sdg_target_ref: null,
    pathway: 'intermediate',
    owner_user_id: 'user-student-b',
    visibility: 'student_private',
    status: 'draft',
    lesson_id: null,
    peer_review_json: null,
    remote_fallback: null,
    event_readiness: null,
    dream_prize_status: 'deferred',
    participating_schools_json: '[]',
    revision_note: null,
    next_resource_ask: null,
    methodology: null,
    created_at: '2026-04-02T09:30:00.000Z',
  });

  for (const [projectId, stage, status, extra] of [
    [IDS.projectCm, 'prototype', 'attested', { attestation_date: '2026-04-10', attestor_role: 'coach', attestor_user_id: 'user-coach-a', method_note: 'Station checklist built and tried.', independent_verifier: 0 }],
    [IDS.projectCm, 'confirmed_use', 'attested', { attestation_date: '2026-04-18', attestor_role: 'fictional community verifier role, independent of the coach', attestor_user_id: null, method_note: 'Verifier role confirmed the checklist was used at the fictional collection point.', independent_verifier: 1 }],
    [IDS.projectCm, 'verified_outcome', 'missing', { attestation_date: null, attestor_role: null, attestor_user_id: null, method_note: null, independent_verifier: 0 }],
    [IDS.projectTz, 'prototype', 'attested', { attestation_date: '2026-04-12', attestor_role: 'coach', attestor_user_id: 'user-coach-b', method_note: 'Paper map only. This does not prove access or safety.', independent_verifier: 0 }],
    [IDS.projectTz, 'confirmed_use', 'missing', { attestation_date: null, attestor_role: null, attestor_user_id: null, method_note: null, independent_verifier: 0 }],
    [IDS.projectTz, 'verified_outcome', 'missing', { attestation_date: null, attestor_role: null, attestor_user_id: null, method_note: null, independent_verifier: 0 }],
  ]) {
    insert(db, 'project_stages', {
      id: `stage-${projectId}-${stage}`,
      project_id: projectId,
      stage,
      status,
      attestation_date: extra.attestation_date,
      attestor_role: extra.attestor_role,
      attestor_user_id: extra.attestor_user_id,
      method_note: extra.method_note,
      independent_verifier: extra.independent_verifier,
      redacted_source_id: null,
      approved_by: null,
      approved_at: null,
    });
  }

  insert(db, 'measurements', {
    id: 'meas-cm-base',
    project_id: IDS.projectCm,
    kind: 'baseline',
    measure: 'mis-sorts',
    units: 'mis-sorts per 100 items',
    value: 40,
    denominator: 100,
    not_measured: 0,
    period_label: 'fictional count window A',
    comparable_group: 'same station, same item mix',
    version: 1,
    prior_id: null,
    status: 'recorded',
    reason: null,
    evidence_id: null,
    submitted_by: 'user-coach-a',
    submitted_at: '2026-03-28T10:00:00.000Z',
    approved_by: null,
    approved_at: null,
  });
  insert(db, 'measurements', {
    id: 'meas-cm-result',
    project_id: IDS.projectCm,
    kind: 'result',
    measure: 'mis-sorts',
    units: 'mis-sorts per 100 items',
    value: 25,
    denominator: 100,
    not_measured: 0,
    period_label: 'fictional count window B',
    comparable_group: 'same station, same item mix',
    version: 1,
    prior_id: null,
    status: 'recorded',
    reason: null,
    evidence_id: IDS.evidenceResult,
    submitted_by: 'user-coach-a',
    submitted_at: '2026-04-18T10:00:00.000Z',
    approved_by: null,
    approved_at: null,
  });

  for (const row of COMPARISONS) {
    insert(db, 'comparison_cases', {
      id: row.id,
      label: row.label,
      lever: row.lever,
      baseline_json: JSON.stringify(row.baseline),
      candidate_json: JSON.stringify(row.candidate),
      guardrail_json: JSON.stringify(row.guardrail),
      source_note: row.sourceNote,
    });
  }

  for (const [id, kind] of [
    ['fu-rerun', 'independent_rerun'],
    ['fu-stem-6', 'stem_6m'],
    ['fu-stem-12', 'stem_12m'],
    ['fu-joint', 'second_joint_project'],
  ]) {
    insert(db, 'followups', {
      id,
      cohort_id: IDS.cohortCm,
      kind,
      count: null,
      eligible_denominator: null,
      response_coverage: null,
      verifier_role: null,
      status: 'missing',
    });
  }

  insert(db, 'milestones', {
    id: 'ms-regional',
    season_id: IDS.seasonAfrica,
    kind: 'regional_showcase',
    state: 'draft',
    published: 0,
    label: 'Proposed regional showcase',
    venue_note: 'Unpublished. No venue and no partner commitment.',
  });
  insert(db, 'milestones', {
    id: 'ms-final',
    season_id: IDS.seasonAfrica,
    kind: 'final',
    state: 'draft',
    published: 0,
    label: 'Proposed final milestone',
    venue_note: 'Unpublished. No date is confirmed.',
  });
  insert(db, 'experiment_log', {
    id: 'exp-kit',
    season_id: IDS.seasonAfrica,
    bottleneck: 'Coach hours per qualifying completion',
    proposed_lever: 'Reusable coach kit',
    owner_role: 'organiser',
    test_plan: 'Use the same rubric and scope. Compare coach-hours only after coverage is complete.',
    evidence_note: 'Illustrative 24/24 and 36/18 are fixtures, not school records.',
    cost_note: 'Print cost only. No hardware-spend score.',
    guardrail_note: 'A faster count fails if learning or equitable access worsens.',
    decision: 'undecided',
  });
  for (const row of [
    ['claim', 'internal', 'Aggregate count', 7, 'review'],
    ['snapshot', 'internal', 'Approved snapshot', null, 'keep'],
    ['evidence_light', 'internal', 'Light redacted evidence', 3, 'review'],
    ['evidence_removable', 'restricted', 'Removable private note', 1, 'delete-when-eligible'],
    ['audit_event', 'internal', 'Audit event', 7, 'keep'],
  ]) {
    insert(db, 'retention_schedule', {
      record_type: row[0], classification: row[1], retention_label: row[2], retain_years: row[3], disposition: row[4],
    });
  }
  for (const [code, label] of [
    ['COUNT-CONFIRMED', 'Count matches the redacted source'],
    ['CORRECTION-ACCEPTED', 'Correction accepted'],
    ['EVIDENCE-SUFFICIENT', 'Evidence is sufficient to approve'],
  ]) insert(db, 'reason_codes', { code, label });

  insert(db, 'weekly_goals', {
    id: 'goal-cm-1',
    project_id: IDS.projectCm,
    goal: 'Recount one fictional sample with the checklist.',
    owner_role: 'coach',
    month_review: 'Checklist used once. Coverage of a second site is still missing.',
    quarter_decision: 'keep',
  });
}

export function applyStory(db, options = {}) {
  const coachA = user('user-coach-a');
  const coachB = user('user-coach-b');
  const organiser = user('user-organiser');
  const filesDir = options.filesDir;

  addEvidence(db, coachA, {
    id: IDS.evidenceLog,
    schoolId: IDS.schoolCm,
    claimId: IDS.claimV1,
    projectId: IDS.projectCm,
    activityDate: '2026-04-20',
    sourceType: 'test_log',
    redactionState: 'redacted',
    versionRef: IDS.claimV1,
    body: 'Redacted test log for the season project. Eight starters. Practice sorter completions are excluded. No learner names.',
  }, '2026-04-20T10:00:00.000Z', filesDir);

  addEvidence(db, coachA, {
    id: IDS.evidenceResult,
    schoolId: IDS.schoolCm,
    projectId: IDS.projectCm,
    activityDate: '2026-04-18',
    sourceType: 'redacted_diagram',
    redactionState: 'redacted',
    versionRef: 'meas-cm-result',
    body: 'Redacted count sheet. Window B: 25 mis-sorts in 100 items. Window A baseline: 40 in 100. Same item mix. No learner names.',
  }, '2026-04-18T11:00:00.000Z', filesDir);

  submitClaim(db, coachA, {
    id: IDS.claimV1,
    schoolId: IDS.schoolCm,
    numerator: 6,
    denominator: 8,
    activityDate: '2026-04-24',
  }, '2026-04-24T15:00:00.000Z');
  approveClaim(db, organiser, IDS.claimV1, '2026-04-24T16:00:00.000Z');
  submitCorrection(db, coachA, IDS.claimV1, {
    id: IDS.claimV2,
    numerator: 5,
    denominator: 8,
    activityDate: '2026-05-02',
    reason: CORRECTION_REASON,
  }, '2026-05-02T15:00:00.000Z');
  approveClaim(db, organiser, IDS.claimV2, '2026-05-03T15:00:00.000Z');

  submitClaim(db, coachB, {
    id: IDS.claimTz,
    schoolId: IDS.schoolTz,
    numerator: 2,
    denominator: 4,
    activityDate: '2026-04-24',
  }, '2026-04-24T15:30:00.000Z');

  addEvidence(db, coachA, {
    id: IDS.evidencePrivate,
    schoolId: IDS.schoolCm,
    claimId: IDS.claimV1,
    projectId: IDS.projectCm,
    activityDate: '2026-05-04',
    sourceType: 'school_attestation',
    redactionState: 'private_removable',
    body: PRIVATE_NOTE,
  }, '2026-05-04T10:00:00.000Z', filesDir);
  withdrawEvidence(db, coachA, IDS.evidencePrivate, '2026-05-04T11:00:00.000Z', filesDir);

  cloneSeasonMaterials(db, organiser, IDS.seasonAfrica, IDS.seasonUs, '2026-05-05T09:00:00.000Z');
  recordHold(db, organiser, 'cmp-guardrail', '2026-05-05T10:00:00.000Z');
}

export function seedAll(db, options = {}) {
  seedFoundation(db);
  if (options.story !== false) applyStory(db, options);
}

export { INCLUSION_RULES };
