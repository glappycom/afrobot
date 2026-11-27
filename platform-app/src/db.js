import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  cloned_from_season_id TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES organisations(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  country_name TEXT NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  label TEXT NOT NULL,
  age_band TEXT NOT NULL,
  challenge_tier TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  mocked INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  school_id TEXT REFERENCES schools(id),
  cohort_id TEXT REFERENCES cohorts(id),
  season_id TEXT REFERENCES seasons(id),
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  granted_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rubric_versions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  version_label TEXT NOT NULL,
  criteria_json TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  non_identifying INTEGER NOT NULL DEFAULT 1,
  source_rubric_id TEXT
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  can_complete_season_project INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  non_identifying INTEGER NOT NULL DEFAULT 1,
  source_lesson_id TEXT
);

CREATE TABLE IF NOT EXISTS coach_materials (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  non_identifying INTEGER NOT NULL DEFAULT 1,
  source_material_id TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  school_id TEXT REFERENCES schools(id),
  cohort_id TEXT REFERENCES cohorts(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  stable_code TEXT NOT NULL,
  local_problem TEXT NOT NULL,
  confirmation_date TEXT,
  verifier_role TEXT,
  primary_sdg INTEGER,
  sdg_other_explanation TEXT,
  sdg_target_ref TEXT,
  pathway TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id),
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  lesson_id TEXT REFERENCES lessons(id),
  peer_review_json TEXT,
  remote_fallback TEXT,
  event_readiness TEXT,
  dream_prize_status TEXT NOT NULL DEFAULT 'deferred',
  participating_schools_json TEXT NOT NULL DEFAULT '[]',
  revision_note TEXT,
  next_resource_ask TEXT,
  methodology TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  attestation_date TEXT,
  attestor_role TEXT,
  attestor_user_id TEXT,
  method_note TEXT,
  independent_verifier INTEGER NOT NULL DEFAULT 0,
  redacted_source_id TEXT,
  approved_by TEXT,
  approved_at TEXT,
  UNIQUE(project_id, stage)
);

CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL,
  measure TEXT NOT NULL,
  units TEXT NOT NULL,
  value REAL,
  denominator REAL,
  not_measured INTEGER NOT NULL DEFAULT 0,
  period_label TEXT NOT NULL,
  comparable_group TEXT NOT NULL,
  version INTEGER NOT NULL,
  prior_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  evidence_id TEXT,
  submitted_by TEXT,
  submitted_at TEXT,
  approved_by TEXT,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  cohort_id TEXT NOT NULL REFERENCES cohorts(id),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  series_id TEXT NOT NULL,
  definition_label TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  rubric_version_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  numerator INTEGER,
  denominator INTEGER,
  coach_hours REAL,
  evidence_coverage REAL,
  scope_key TEXT NOT NULL,
  inclusion_rules TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  prior_claim_id TEXT,
  correction_reason TEXT,
  meeting_id TEXT,
  return_note TEXT,
  project_result TEXT,
  coach_note TEXT,
  activity_date TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  idempotency_key TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  subject TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  claim_id TEXT,
  school_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  server_timestamp TEXT NOT NULL,
  source_type TEXT NOT NULL,
  submitter_role TEXT NOT NULL,
  submitter_user_id TEXT NOT NULL,
  reviewer_user_id TEXT,
  metric_version TEXT,
  rubric_version_id TEXT,
  redaction_state TEXT NOT NULL,
  permission_state TEXT NOT NULL,
  access_scope TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  version_ref TEXT,
  body_redacted TEXT,
  filename TEXT,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  digest_sha256 TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  validation_script TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  UNIQUE(subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  school_id TEXT,
  detail_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comparison_cases (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  lever TEXT NOT NULL,
  baseline_json TEXT NOT NULL,
  candidate_json TEXT NOT NULL,
  guardrail_json TEXT NOT NULL,
  source_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guardrail_reviews (
  id TEXT PRIMARY KEY,
  comparison_id TEXT NOT NULL,
  learning_delta TEXT NOT NULL,
  access_delta TEXT NOT NULL,
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  venue_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_log (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  bottleneck TEXT NOT NULL,
  proposed_lever TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  test_plan TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  cost_note TEXT NOT NULL,
  guardrail_note TEXT NOT NULL,
  decision TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER,
  eligible_denominator INTEGER,
  response_coverage REAL,
  verifier_role TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  month_review TEXT,
  quarter_decision TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_log (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  files_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retention_schedule (
  record_type TEXT PRIMARY KEY,
  classification TEXT NOT NULL,
  retention_label TEXT NOT NULL,
  retain_years INTEGER,
  disposition TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legal_holds (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  active INTEGER NOT NULL,
  placed_by TEXT NOT NULL,
  placed_at TEXT NOT NULL,
  released_at TEXT
);

CREATE TABLE IF NOT EXISTS reason_codes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  letter TEXT NOT NULL,
  consent TEXT NOT NULL,
  consent_until TEXT,
  user_id TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS join_codes (
  cohort_id TEXT PRIMARY KEY,
  code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS season_progress (
  cohort_id TEXT PRIMARY KEY,
  planned INTEGER NOT NULL,
  done INTEGER NOT NULL,
  weeks_left INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_logs (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  meets_on TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  school_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guardian_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  confirmed_by TEXT,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  present INTEGER NOT NULL,
  UNIQUE(claim_id, learner_id)
);

CREATE TRIGGER IF NOT EXISTS events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS snapshots_no_update
BEFORE UPDATE ON snapshots
BEGIN
  SELECT RAISE(ABORT, 'snapshots are append-only');
END;

CREATE TRIGGER IF NOT EXISTS snapshots_no_delete
BEFORE DELETE ON snapshots
BEGIN
  SELECT RAISE(ABORT, 'snapshots are append-only');
END;

CREATE TRIGGER IF NOT EXISTS claims_freeze_approved
BEFORE UPDATE ON claims
WHEN OLD.status = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'approved claims are frozen');
END;

CREATE TRIGGER IF NOT EXISTS stages_freeze_approved
BEFORE UPDATE ON project_stages
WHEN OLD.status = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'approved stages are frozen');
END;

CREATE TRIGGER IF NOT EXISTS evidence_withdrawal_only
BEFORE UPDATE ON evidence_items
WHEN NOT (
  OLD.permission_state = 'active'
  AND NEW.permission_state = 'withdrawn'
  AND NEW.body_redacted IS NULL
  AND NEW.filename IS NULL
  AND NEW.id = OLD.id
  AND NEW.school_id = OLD.school_id
  AND NEW.source_type = OLD.source_type
  AND NEW.submitter_user_id = OLD.submitter_user_id
  AND IFNULL(NEW.project_id, '') = IFNULL(OLD.project_id, '')
  AND IFNULL(NEW.claim_id, '') = IFNULL(OLD.claim_id, '')
)
BEGIN
  SELECT RAISE(ABORT, 'evidence changes are limited to withdrawal');
END;
`;

export const LEDGER_SCHEMA = `
CREATE TABLE IF NOT EXISTS digest_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  digest_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS ledger_no_update
BEFORE UPDATE ON digest_ledger
BEGIN
  SELECT RAISE(ABORT, 'digest ledger is append-only');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete
BEFORE DELETE ON digest_ledger
BEGIN
  SELECT RAISE(ABORT, 'digest ledger is append-only');
END;
`;

class Store {
  constructor(records, ledger) {
    this.records = records;
    this.ledger = ledger;
    this.driver = 'sqlite';
  }

  target(sql) {
    return /\bdigest_ledger\b/i.test(sql) ? this.ledger : this.records;
  }

  prepare(sql) {
    return this.target(sql).prepare(sql);
  }

  exec(sql) {
    return this.target(sql).exec(sql);
  }

  close() {
    this.records.close();
    this.ledger.close();
  }
}

function openSqlite(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

function applied(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  return db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
}

export function openDatabase(dbPath, ledgerPath) {
  const ledgerLocation = ledgerPath || (dbPath === ':memory:' ? ':memory:' : path.join(path.dirname(dbPath), 'ledger.sqlite'));
  const records = openSqlite(dbPath);
  const ledger = openSqlite(ledgerLocation);
  const version = applied(records);
  if (!version?.version) {
    records.exec(SCHEMA);
    ledger.exec(LEDGER_SCHEMA);
    records.exec('INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING');
  }
  ensureClaimKey(records);
  ensureSqliteWork(records);
  records.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
    subject TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    locked_until TEXT,
    updated_at TEXT NOT NULL
  )`);
  const store = new Store(records, ledger);
  store.ledgerPath = ledgerLocation;
  return store;
}

function ensureClaimKey(records) {
  const cols = records.prepare('PRAGMA table_info(claims)').all();
  if (!cols.length) return;
  if (!cols.some((col) => col.name === 'idempotency_key')) {
    records.exec('ALTER TABLE claims ADD COLUMN idempotency_key TEXT');
  }
  records.exec('CREATE UNIQUE INDEX IF NOT EXISTS claims_idempotency_key ON claims(idempotency_key)');
}

function addColumn(records, table, name, type) {
  const cols = records.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.length || cols.some((col) => col.name === name)) return;
  records.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}

function ensureSqliteWork(records) {
  for (const name of ['meeting_id', 'return_note', 'project_result', 'coach_note']) addColumn(records, 'claims', name, 'TEXT');
  addColumn(records, 'learners', 'user_id', 'TEXT');
  addColumn(records, 'learners', 'active', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(records, 'users', 'active', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(records, 'users', 'totp_secret', 'TEXT');
  addColumn(records, 'users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(records, 'users', 'mfa_exempt', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(records, 'meetings', 'status', "TEXT NOT NULL DEFAULT 'scheduled'");
  records.exec(`CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    cohort_id TEXT NOT NULL,
    coach_id TEXT NOT NULL,
    meets_on TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    present INTEGER NOT NULL,
    UNIQUE(claim_id, learner_id)
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, username TEXT NOT NULL, display_name TEXT NOT NULL,
    role TEXT NOT NULL, school_id TEXT, expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
    used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS guardian_links (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, learner_id TEXT NOT NULL, status TEXT NOT NULL,
    created_at TEXT NOT NULL, confirmed_by TEXT, confirmed_at TEXT
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS recovery_codes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, code_hash TEXT NOT NULL, used_at TEXT
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS mfa_challenges (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS session_photos (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    bytes BLOB,
    media_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    byte_size INTEGER NOT NULL,
    no_students INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    removed_at TEXT,
    removed_by TEXT,
    remove_reason TEXT,
    hidden_at TEXT,
    hidden_reason TEXT
  )`);
  records.exec('CREATE INDEX IF NOT EXISTS session_photos_claim ON session_photos(claim_id)');
  records.exec('CREATE INDEX IF NOT EXISTS session_photos_school ON session_photos(school_id)');
  records.exec(`CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    PRIMARY KEY (photo_id, learner_id)
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS photo_consent (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    status TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  )`);
  records.exec(`CREATE TABLE IF NOT EXISTS photo_deletion_queue (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    queued_at TEXT NOT NULL,
    reason TEXT NOT NULL
  )`);
}

export const POSTGRES_WORK_SQL = [
  'ALTER TABLE claims ADD COLUMN IF NOT EXISTS meeting_id TEXT',
  'ALTER TABLE claims ADD COLUMN IF NOT EXISTS return_note TEXT',
  'ALTER TABLE claims ADD COLUMN IF NOT EXISTS project_result TEXT',
  'ALTER TABLE claims ADD COLUMN IF NOT EXISTS coach_note TEXT',
  'ALTER TABLE learners ADD COLUMN IF NOT EXISTS user_id TEXT',
  'ALTER TABLE learners ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_exempt INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT \'scheduled\'',
  `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    cohort_id TEXT NOT NULL,
    coach_id TEXT NOT NULL,
    meets_on TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    present INTEGER NOT NULL,
    UNIQUE(claim_id, learner_id)
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, username TEXT NOT NULL, display_name TEXT NOT NULL,
    role TEXT NOT NULL, school_id TEXT, expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
    used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS guardian_links (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, learner_id TEXT NOT NULL, status TEXT NOT NULL,
    created_at TEXT NOT NULL, confirmed_by TEXT, confirmed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS recovery_codes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, code_hash TEXT NOT NULL, used_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mfa_challenges (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS session_photos (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    bytes BYTEA,
    media_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    byte_size INTEGER NOT NULL,
    no_students INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    removed_at TEXT,
    removed_by TEXT,
    remove_reason TEXT,
    hidden_at TEXT,
    hidden_reason TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS session_photos_claim ON session_photos(claim_id)',
  'CREATE INDEX IF NOT EXISTS session_photos_school ON session_photos(school_id)',
  `CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    PRIMARY KEY (photo_id, learner_id)
  )`,
  `CREATE TABLE IF NOT EXISTS photo_consent (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    status TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photo_deletion_queue (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    queued_at TEXT NOT NULL,
    reason TEXT NOT NULL
  )`,
];

export function insert(db, table, row) {
  if (!/^[a-z_]+$/.test(table)) throw new Error('bad table');
  const keys = Object.keys(row);
  for (const key of keys) if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`bad column ${key}`);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(...keys.map((key) => row[key]));
}

export function all(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(db, sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function run(db, sql, params = []) {
  return db.prepare(sql).run(...params);
}

export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const value = fn();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* already closed */ }
    throw error;
  }
}
