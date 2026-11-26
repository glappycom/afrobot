export const DEMO_USERS = [
  {
    id: 'user-coach-a',
    username: 'coach-a',
    password: 'demo-coach-a',
    displayName: 'Coach A',
    role: 'coach',
    schoolId: 'sch-cm-north',
  },
  {
    id: 'user-coach-b',
    username: 'coach-b',
    password: 'demo-coach-b',
    displayName: 'Coach B',
    role: 'coach',
    schoolId: 'sch-tz-lakeside',
  },
  {
    id: 'user-organiser',
    username: 'organiser',
    password: 'demo-organiser',
    displayName: 'Organiser',
    role: 'organiser',
    schoolId: null,
  },
  {
    id: 'user-auditor',
    username: 'auditor',
    password: 'demo-auditor',
    displayName: 'Auditor',
    role: 'auditor',
    schoolId: null,
  },
  {
    id: 'user-student-a',
    username: 'student-a',
    password: 'demo-student-a',
    displayName: 'Learner CM-1',
    role: 'student',
    schoolId: 'sch-cm-north',
  },
  {
    id: 'user-student-b',
    username: 'student-b',
    password: 'demo-student-b',
    displayName: 'Learner CM-2',
    role: 'student',
    schoolId: 'sch-cm-north',
  },
];

export const IDS = {
  org: 'org-afrobot-demo',
  regionAfrica: 'region-africa',
  regionUs: 'region-us',
  seasonAfrica: 'season-africa-1',
  seasonUs: 'season-us-draft',
  schoolCm: 'sch-cm-north',
  schoolTz: 'sch-tz-lakeside',
  cohortCm: 'coh-cm-s1',
  cohortTz: 'coh-tz-s1',
  rubric: 'rubric-afr-1',
  lessonSorter: 'lesson-sorter',
  coachPack: 'material-session-card',
  claimV1: 'claim-cm-rubric-v1',
  claimV2: 'claim-cm-rubric-v2',
  claimTz: 'claim-tz-rubric-v1',
  projectCm: 'proj-cm-sdg12',
  projectTz: 'proj-tz-sdg6',
  projectCross: 'proj-cross-redacted',
  projectStudentA: 'proj-stu-cm-1',
  projectStudentB: 'proj-stu-cm-2',
  evidenceLog: 'ev-cm-test-log',
  evidenceResult: 'ev-cm-result',
  evidencePrivate: 'ev-cm-removable',
  grantAuditor: 'grant-auditor-cm',
  grantStarts: '2026-11-01T00:00:00.000Z',
  grantExpires: '2027-06-01T00:00:00.000Z',
  exportAt: '2026-11-26T12:00:00.000Z',
};

export const RUBRIC_CRITERIA = [
  'local relevance',
  'student explanation',
  'evidence of a fair test',
  'meaningful revision',
];

export const VALIDATION_SCRIPT = 'platform-app/scripts/validate-snapshot.mjs';

export const PRIVATE_NOTE = 'Synthetic removable note. Not a learner record. Token: scratch-token-should-vanish';

export const OTHER_DRAFT_TOKEN = 'other-learner-draft';

const SHARED_SCOPE = 'intermediate|ages-12-14|8-week';
const SHARED_RUBRIC = 'AFR-RUBRIC-1';
const SHARED_METRIC = 'qualifying-completions-v1';

function seasonSide(name, completions, coachHours, extras = {}) {
  return {
    name,
    completions,
    coachHours,
    scopeKey: SHARED_SCOPE,
    rubricVersion: SHARED_RUBRIC,
    metricVersion: SHARED_METRIC,
    baselinePresent: true,
    coverage: 1,
    window: extras.window,
    evidenceVersion: extras.evidenceVersion,
    lever: 'coach hours on the same rubric',
    ...extras,
  };
}

export const COMPARISONS = [
  {
    id: 'cmp-like-for-like',
    label: 'Illustrative like-for-like seasons',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, { window: 'fictional window B', evidenceVersion: 'cmp-src-b' }),
    guardrail: { learning: 'unchanged', access: 'unchanged' },
    sourceNote: 'Fictional totals for the acceptance check. Not AfroBot programme results. Coach-hours include preparation, delivery, follow-up, and any central coaching time.',
  },
  {
    id: 'cmp-scope',
    label: 'Same counts, scope differs',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, {
      window: 'fictional window B',
      evidenceVersion: 'cmp-src-b',
      scopeKey: 'starter|ages-15-17|8-week',
    }),
    guardrail: { learning: 'unchanged', access: 'unchanged' },
    sourceNote: 'Scope is not the same, so the multiplier is suppressed.',
  },
  {
    id: 'cmp-rubric',
    label: 'Same counts, rubric differs',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, {
      window: 'fictional window B',
      evidenceVersion: 'cmp-src-b',
      rubricVersion: 'AFR-RUBRIC-2',
    }),
    guardrail: { learning: 'unchanged', access: 'unchanged' },
    sourceNote: 'Rubric version is not the same, so the multiplier is suppressed.',
  },
  {
    id: 'cmp-baseline',
    label: 'Baseline missing',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, {
      window: 'fictional window B',
      evidenceVersion: 'cmp-src-b',
      baselinePresent: false,
    }),
    guardrail: { learning: 'unchanged', access: 'unchanged' },
    sourceNote: 'The comparison baseline was not measured. The multiplier is suppressed. The cell stays blank rather than a made-up zero.',
  },
  {
    id: 'cmp-coverage',
    label: 'Coverage missing',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, {
      window: 'fictional window B',
      evidenceVersion: 'cmp-src-b',
      coverage: null,
    }),
    guardrail: { learning: 'unchanged', access: 'unchanged' },
    sourceNote: 'Evidence coverage is missing, so the multiplier is suppressed.',
  },
  {
    id: 'cmp-guardrail',
    label: 'Efficiency rose, learning worsened',
    lever: 'coach hours on the same rubric',
    baseline: seasonSide('Illustrative season A', 24, 24, { window: 'fictional window A', evidenceVersion: 'cmp-src-a' }),
    candidate: seasonSide('Illustrative season B', 36, 18, { window: 'fictional window B', evidenceVersion: 'cmp-src-b' }),
    guardrail: { learning: 'worsened', access: 'unchanged' },
    sourceNote: 'The per-hour figure rises, and the learning guardrail fails. A person records a hold. Nothing here is an automatic decision.',
  },
];

export const CORRECTION_REASON = 'One finisher had only completed the paper/plastic sorter practice lesson, which cannot complete the season project.';

export const INCLUSION_RULES = 'Count a finisher only when all four rubric criteria are met on the season project. The paper/plastic sorter practice lesson does not count. Starters are the denominator.';
