import { sha256 } from './canonical.js';
import { rateLabel } from './format.js';
import { addEvent, traceClaim } from './domain.js';
import { all, get, insert, transaction } from './db.js';
import { notFound } from './http-error.js';

function csv(rows) {
  return rows.map((row) => row.map((cell) => {
    if (cell == null) return '';
    const text = String(cell);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  }).join(',')).join('\n') + '\n';
}

function fileEntry(name, contents) {
  const text = typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`;
  return { name, contents: text, sha256: sha256(text), bytes: Buffer.byteLength(text) };
}

export function createExport(db, user, claimId, now) {
  const trace = traceClaim(db, user, claimId, now);
  if (!trace.current) throw notFound();
  const priorExports = all(db, 'SELECT id FROM export_log WHERE claim_id = ?', [trace.current.id]);
  const packId = priorExports.length === 0 ? `pack-${trace.current.id}` : `pack-${trace.current.id}-${priorExports.length + 1}`;
  const stamp = typeof now === 'function' ? now() : now;
  transaction(db, () => {
    addEvent(db, {
      now: stamp,
      action: 'export',
      user,
      subjectType: 'claim',
      subjectId: trace.current.id,
      schoolId: trace.current.school_id,
      detail: { pack_id: packId },
    });
  });

  const claimIds = trace.versions.map((row) => row.id);
  const evidenceIds = trace.evidence.map((row) => row.id);
  const events = all(db, 'SELECT * FROM events ORDER BY id').filter((event) => {
    if (event.subject_type === 'claim' && claimIds.includes(event.subject_id)) return true;
    if (event.subject_type === 'evidence' && evidenceIds.includes(event.subject_id)) return true;
    return false;
  });

  const snapshots = trace.snapshots.map((row) => ({
    id: row.id,
    subject_id: row.subject_id,
    version: row.version,
    digest_sha256: row.digest_sha256,
    canonical_json: row.canonical_json,
    validation_script: row.validation_script,
    created_at: row.created_at,
    created_by_role: row.created_by_role,
  }));

  const claimRows = trace.versions.map((row) => {
    const snap = snapshots.find((item) => item.subject_id === row.id);
    return {
      id: row.id,
      series_id: row.series_id,
      version: row.version,
      status: row.status,
      numerator: row.numerator,
      denominator: row.denominator,
      activity_date: row.activity_date,
      rubric_version_id: row.rubric_version_id,
      metric_version: row.metric_version,
      inclusion_rules: row.inclusion_rules,
      correction_reason: row.correction_reason,
      prior_claim_id: row.prior_claim_id,
      submitted_role: 'coach',
      approved_role: row.approved_by ? 'organiser' : null,
      snapshot_sha256: snap ? snap.digest_sha256 : null,
    };
  });

  const evidenceRows = trace.evidence.map((row) => ({
    id: row.id,
    source_type: row.source_type,
    activity_date: row.activity_date,
    redaction_state: row.redaction_state,
    retention_class: row.retention_class,
    body_redacted: row.body_redacted,
    body_sha256: sha256(row.body_redacted || ''),
  }));

  const eventRows = events.map((event) => ({
    at: event.at,
    action: event.action,
    actor_role: event.actor_role,
    subject_type: event.subject_type,
    subject_id: event.subject_id,
    detail: JSON.parse(event.detail_json),
  }));

  const superseded = snapshots.filter((row) => row.subject_id !== trace.current.id);
  const currentSnap = snapshots.find((row) => row.subject_id === trace.current.id);
  const priorClaim = trace.versions.find((row) => row.id === trace.current.prior_claim_id);

  const files = [
    fileEntry('claim.json', claimRows),
    fileEntry('claim.csv', csv([
      ['version', 'status', 'numerator', 'denominator', 'activity_date', 'rubric_version', 'metric_version', 'inclusion_rules', 'correction_reason', 'snapshot_sha256'],
      ...claimRows.map((row) => [
        row.version, row.status, row.numerator, row.denominator, row.activity_date,
        row.rubric_version_id, row.metric_version, row.inclusion_rules, row.correction_reason, row.snapshot_sha256,
      ]),
    ])),
    fileEntry('evidence.json', evidenceRows),
    fileEntry('evidence.csv', csv([
      ['id', 'source_type', 'activity_date', 'redaction_state', 'body_sha256'],
      ...evidenceRows.map((row) => [row.id, row.source_type, row.activity_date, row.redaction_state, row.body_sha256]),
    ])),
    fileEntry('snapshots.json', snapshots),
    fileEntry('events.json', eventRows),
  ];

  const manifest = {
    pack_id: packId,
    generated_at: stamp,
    claim_id: trace.current.id,
    school_id: trace.current.school_id,
    redaction: 'Learner identifiers removed. No rosters, raw uploads, contact details, or other schools.',
    calculation: {
      current: {
        numerator: trace.current.numerator,
        denominator: trace.current.denominator,
        label: rateLabel(trace.current.numerator, trace.current.denominator),
        digest_sha256: currentSnap?.digest_sha256 || null,
      },
      superseded: priorClaim ? {
        numerator: priorClaim.numerator,
        denominator: priorClaim.denominator,
        label: rateLabel(priorClaim.numerator, priorClaim.denominator),
        digest_sha256: superseded.find((row) => row.subject_id === priorClaim.id)?.digest_sha256 || null,
      } : null,
    },
    snapshot_digests: snapshots.map((row) => ({
      version: row.version,
      subject_id: row.subject_id,
      sha256: row.digest_sha256,
      status: row.subject_id === trace.current.id ? 'current' : 'superseded',
    })),
    files: files.map((file) => ({ name: file.name, sha256: file.sha256, bytes: file.bytes })),
    validation_script: snapshots[0]?.validation_script || null,
  };
  const manifestFile = fileEntry('manifest.json', manifest);
  const stored = Object.fromEntries([...files, manifestFile].map((file) => [file.name, file.contents]));
  insert(db, 'export_log', {
    id: packId,
    pack_id: packId,
    claim_id: trace.current.id,
    actor_id: user.id,
    created_at: stamp,
    manifest_json: manifestFile.contents,
    files_json: JSON.stringify(stored),
  });
  return { packId, manifest, files: stored };
}

export function readExport(db, user, packId, now) {
  if (!/^[a-z0-9-]{1,80}$/.test(packId || '')) throw notFound();
  const row = get(db, 'SELECT * FROM export_log WHERE id = ?', [packId]);
  if (!row) throw notFound();
  traceClaim(db, user, row.claim_id, now);
  return { manifest: JSON.parse(row.manifest_json), files: JSON.parse(row.files_json) };
}
