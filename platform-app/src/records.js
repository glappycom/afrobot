import { sha256 } from './canonical.js';
import { readableSchools } from './access.js';
import { all, get, insert } from './db.js';
import { listClaims, listProjects, traceClaim, visibleEvents } from './domain.js';
import { HttpError, notAvailable, notFound } from './http-error.js';
import { localStamp } from './time.js';
import { zipStore } from './zip.js';

const FIXED_IDS = {
  'claim-cm-rubric-v1': 'AFB-CLM-000001',
  'claim-cm-rubric-v2': 'AFB-CLM-000002',
  'claim-tz-rubric-v1': 'AFB-CLM-000003',
  'ev-cm-test-log': 'AFB-EVD-000001',
  'ev-cm-result': 'AFB-EVD-000002',
  'ev-cm-removable': 'AFB-EVD-000003',
  'proj-cm-sdg12': 'AFB-PRJ-000001',
  'proj-tz-sdg6': 'AFB-PRJ-000002',
  'snap-claim-cm-rubric-v1': 'AFB-SNP-000001',
  'snap-claim-cm-rubric-v2': 'AFB-SNP-000002',
};

export function displayId(id) {
  if (FIXED_IDS[id]) return FIXED_IDS[id];
  const kind = String(id).startsWith('ev-') ? 'EVD' : String(id).startsWith('proj-') ? 'PRJ' : String(id).startsWith('snap-') ? 'SNP' : 'CLM';
  const n = (parseInt(sha256(String(id)).slice(0, 6), 16) % 900000) + 100000;
  return `AFB-${kind}-${String(n).padStart(6, '0')}`;
}

export function formatStamps(iso) {
  if (!iso) return { utc: '—', local: '—' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { utc: iso, local: '—' };
  const utc = `${iso.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')}`;
  return { utc, local: localStamp(iso) };
}

export function retentionSchedule(db) {
  return all(db, 'SELECT * FROM retention_schedule ORDER BY record_type');
}

export function retentionFor(db, recordType) {
  return get(db, 'SELECT * FROM retention_schedule WHERE record_type = ?', [recordType]);
}

export function activeHold(db, recordId) {
  return get(db, 'SELECT * FROM legal_holds WHERE record_id = ? AND active = 1', [recordId]);
}

export function placeLegalHold(db, user, recordId, reason, now) {
  if (!user || user.role !== 'organiser') throw notAvailable();
  const text = String(reason || '').trim();
  if (text.length < 8) throw new HttpError(422, 'A legal hold needs a short reason.');
  const stamp = typeof now === 'function' ? now() : now;
  const existing = activeHold(db, recordId);
  if (existing) throw new HttpError(422, 'A legal hold is already active.');
  const prior = get(db, 'SELECT * FROM legal_holds WHERE record_id = ?', [recordId]);
  if (prior) {
    db.prepare('UPDATE legal_holds SET active = 1, reason = ?, placed_at = ?, released_at = NULL, placed_by = ? WHERE id = ?').run(text, stamp, user.id, prior.id);
    return activeHold(db, recordId);
  }
  const id = `hold-${recordId}`;
  insert(db, 'legal_holds', {
    id,
    record_type: 'evidence',
    record_id: recordId,
    reason: text,
    active: 1,
    placed_by: user.id,
    placed_at: stamp,
    released_at: null,
  });
  return activeHold(db, recordId);
}

export function releaseLegalHold(db, user, recordId, now) {
  if (!user || user.role !== 'organiser') throw notAvailable();
  const hold = activeHold(db, recordId);
  if (!hold) throw notFound();
  const stamp = typeof now === 'function' ? now() : now;
  db.prepare('UPDATE legal_holds SET active = 0, released_at = ? WHERE id = ?').run(stamp, hold.id);
  return get(db, 'SELECT * FROM legal_holds WHERE id = ?', [hold.id]);
}

export function assertNoLegalHold(db, recordId) {
  if (activeHold(db, recordId)) throw new HttpError(422, 'Legal hold blocks removal.');
}

export function searchRecords(db, user, now, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const claims = listClaims(db, user, now).filter((claim) => {
    const school = get(db, 'SELECT display_name, country_name FROM schools WHERE id = ?', [claim.school_id]);
    const hay = [claim.id, displayId(claim.id), claim.status, String(claim.numerator), String(claim.denominator), school?.display_name, school?.country_name].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const projects = listProjects(db, user, now).filter((project) => {
    const hay = [project.id, displayId(project.id), project.stable_code, project.local_problem, project.status].join(' ').toLowerCase();
    return hay.includes(q);
  });
  return [
    ...claims.map((claim) => ({ type: 'claim', id: claim.id, displayId: displayId(claim.id), label: `${claim.numerator ?? '—'}/${claim.denominator ?? '—'}`, status: claim.status })),
    ...projects.map((project) => ({ type: 'project', id: project.id, displayId: displayId(project.id), label: project.stable_code, status: project.status })),
  ];
}

export function integrityReport(db, user, now) {
  const claims = listClaims(db, user, now);
  if (!claims.length) return [];
  const ids = claims.map((claim) => claim.id);
  const snaps = all(db, `SELECT * FROM snapshots WHERE subject_type = 'claim' AND subject_id IN (${ids.map(() => '?').join(',')}) ORDER BY version`, ids);
  return snaps.map((snap) => {
    const recomputed = sha256(snap.canonical_json);
    const ledger = get(db, 'SELECT digest_sha256 FROM digest_ledger WHERE snapshot_id = ?', [snap.id]);
    const snapshotOk = recomputed === snap.digest_sha256;
    const ledgerOk = Boolean(ledger) && ledger.digest_sha256 === snap.digest_sha256;
    return {
      id: snap.id,
      displayId: displayId(snap.id),
      subjectId: snap.subject_id,
      subjectDisplayId: displayId(snap.subject_id),
      version: snap.version,
      stored: snap.digest_sha256,
      recomputed,
      ledger: ledger?.digest_sha256 || null,
      pass: snapshotOk && ledgerOk,
      createdAt: snap.created_at,
    };
  });
}

export function verifyPastedPack(payload) {
  const pack = payload?.pack || payload || {};
  const files = pack.files || {};
  const manifest = pack.manifest || pack;
  const results = [];
  const listed = Array.isArray(manifest.files) ? manifest.files : [];
  for (const file of listed) {
    if (typeof files[file.name] !== 'string') {
      results.push({ name: file.name, kind: 'file', pass: false, detail: 'File bytes were not included.' });
      continue;
    }
    const digest = sha256(files[file.name]);
    results.push({ name: file.name, kind: 'file', pass: digest === file.sha256, detail: digest });
  }
  let snapshots = [];
  if (typeof files['snapshots.json'] === 'string') {
    try { snapshots = JSON.parse(files['snapshots.json']); } catch { snapshots = []; }
  } else if (Array.isArray(pack.snapshots)) snapshots = pack.snapshots;
  for (const snap of snapshots) {
    if (!snap?.canonical_json || !snap?.digest_sha256) continue;
    const recomputed = sha256(snap.canonical_json);
    results.push({
      name: snap.id || displayId(snap.subject_id || 'snapshot'),
      kind: 'snapshot',
      pass: recomputed === snap.digest_sha256,
      detail: recomputed,
    });
  }
  return { pass: results.length > 0 && results.every((row) => row.pass), results };
}

export function provenanceDocument(db, user, claimId, now) {
  const trace = traceClaim(db, user, claimId, now);
  const claim = trace.current || trace.requested;
  const entity = {};
  const activity = {};
  const wasGeneratedBy = {};
  const used = {};
  const wasDerivedFrom = {};
  const wasAttributedTo = {};
  const claimKey = `urn:afrobot-demo:${displayId(claim.id)}`;
  entity[claimKey] = { 'prov:type': 'afb:Claim', 'afb:status': claim.status, 'afb:utc': claim.approved_at || claim.submitted_at };
  for (const version of trace.versions) {
    const key = `urn:afrobot-demo:${displayId(version.id)}`;
    entity[key] = { 'prov:type': 'afb:ClaimVersion', 'afb:version': version.version, 'afb:utc': version.created_at };
    if (version.prior_claim_id) {
      wasDerivedFrom[`${key}-from`] = { 'prov:generatedEntity': key, 'prov:usedEntity': `urn:afrobot-demo:${displayId(version.prior_claim_id)}` };
    }
  }
  for (const snap of trace.snapshots) {
    const key = `urn:afrobot-demo:${displayId(snap.id)}`;
    entity[key] = { 'prov:type': 'afb:Snapshot', 'afb:digest': snap.digest_sha256, 'afb:utc': snap.created_at };
    const act = `urn:afrobot-demo:act-${snap.id}`;
    activity[act] = { 'prov:type': 'afb:Approval', 'prov:startTime': snap.created_at, 'afb:role': snap.created_by_role };
    wasGeneratedBy[`${key}-gen`] = { 'prov:entity': key, 'prov:activity': act };
    used[`${act}-used`] = { 'prov:activity': act, 'prov:entity': `urn:afrobot-demo:${displayId(snap.subject_id)}` };
    wasAttributedTo[`${act}-attr`] = { 'prov:entity': key, 'prov:agent': `urn:afrobot-demo:role-${snap.created_by_role}` };
  }
  for (const item of trace.evidence) {
    const key = `urn:afrobot-demo:${displayId(item.id)}`;
    entity[key] = { 'prov:type': 'afb:Evidence', 'afb:source': item.source_type, 'afb:utc': item.server_timestamp };
    used[`use-${item.id}`] = { 'prov:activity': `urn:afrobot-demo:act-snap-${trace.snapshots.at(-1)?.id || 'none'}`, 'prov:entity': key };
  }
  return {
    prefix: { prov: 'http://www.w3.org/ns/prov#', afb: 'urn:afrobot-demo:' },
    entity,
    activity,
    wasGeneratedBy,
    used,
    wasDerivedFrom,
    wasAttributedTo,
  };
}

export function custodyChain(db, user, claimId, now) {
  const trace = traceClaim(db, user, claimId, now);
  const ids = new Set(trace.versions.map((row) => row.id));
  return visibleEvents(db, user, now)
    .filter((event) => ids.has(event.subject_id) || (event.subject_type === 'evidence' && trace.evidence.some((item) => item.id === event.subject_id)))
    .map((event) => ({
      at: event.at,
      action: event.action,
      actorRole: event.actor_role,
      subjectId: event.subject_id,
      displayId: displayId(event.subject_id),
    }));
}

export function filterEvents(db, user, now, query) {
  let rows = visibleEvents(db, user, now);
  if (query.action) rows = rows.filter((event) => event.action === query.action);
  if (query.from) rows = rows.filter((event) => event.at >= query.from);
  if (query.to) rows = rows.filter((event) => event.at <= query.to);
  return rows;
}

export function eventsCsv(rows) {
  const header = ['at_utc', 'action', 'actor_role', 'subject_type', 'subject_display_id', 'subject_id'];
  const lines = [header.join(',')];
  for (const event of rows) {
    lines.push([event.at, event.action, event.actor_role, event.subject_type, displayId(event.subject_id), event.subject_id].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function accessReviewRows(db, user, now) {
  const stamp = typeof now === 'function' ? now() : now;
  if (user.role === 'auditor') {
    return all(db, 'SELECT * FROM access_grants WHERE user_id = ? ORDER BY expires_at', [user.id]).map((row) => grantView(row, stamp));
  }
  if (user.role !== 'organiser') return [];
  const schools = new Set(readableSchools(db, user, stamp));
  return all(db, 'SELECT * FROM access_grants ORDER BY expires_at')
    .filter((row) => row.scope_type !== 'school' || schools.has(row.scope_id))
    .map((row) => grantView(row, stamp));
}

function grantView(row, stamp) {
  let state = 'Active';
  if (row.revoked_at) state = 'Revoked';
  else if (row.expires_at <= stamp) state = 'Expired';
  else if (row.starts_at > stamp) state = 'Scheduled';
  return { ...row, displayState: state, subjectDisplayId: displayId(row.scope_id) };
}

export function gridClaims(db, user, now, query) {
  let rows = listClaims(db, user, now).map((claim) => {
    const school = get(db, 'SELECT display_name, country_name FROM schools WHERE id = ?', [claim.school_id]);
    return { ...claim, displayId: displayId(claim.id), schoolName: school?.display_name || '', country: school?.country_name || '' };
  });
  if (query.view === 'approved') rows = rows.filter((row) => row.status === 'approved');
  if (query.view === 'waiting') rows = rows.filter((row) => row.status === 'submitted' || row.status === 'returned');
  if (query.status) rows = rows.filter((row) => row.status === query.status);
  if (query.q) {
    const q = query.q.toLowerCase();
    rows = rows.filter((row) => `${row.displayId} ${row.id} ${row.status} ${row.schoolName}`.toLowerCase().includes(q));
  }
  const sort = ['displayId', 'status', 'activity_date', 'version'].includes(query.sort) ? query.sort : 'activity_date';
  const dir = query.dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => String(a[sort] || '').localeCompare(String(b[sort] || '')) * dir);
  const size = Math.min(Math.max(Number(query.size) || 8, 1), 50);
  const page = Math.max(Number(query.page) || 1, 1);
  const start = (page - 1) * size;
  return { rows: rows.slice(start, start + size), total: rows.length, page, size, sort, dir: dir === 1 ? 'asc' : 'desc' };
}

export function buildAuditZip(pack, prov) {
  const summary = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Audit pack ${pack.packId}</title></head><body>
<h1>Audit pack</h1>
<p>Current ${pack.manifest.calculation.current.label}. Earlier ${pack.manifest.calculation.superseded?.label || '—'}.</p>
<p>Generated ${pack.manifest.generated_at} UTC. Synthetic demo. Not a certification.</p>
<ul>${pack.manifest.files.map((file) => `<li>${file.name} ${file.sha256}</li>`).join('')}</ul>
</body></html>\n`;
  return zipStore([
    { name: 'manifest.json', data: pack.files['manifest.json'] },
    { name: 'snapshots.json', data: pack.files['snapshots.json'] },
    { name: 'events.json', data: pack.files['events.json'] },
    { name: 'claim.json', data: pack.files['claim.json'] },
    { name: 'evidence.json', data: pack.files['evidence.json'] },
    { name: 'prov.json', data: `${JSON.stringify(prov, null, 2)}\n` },
    { name: 'summary.html', data: summary },
  ], new Date(pack.manifest.generated_at));
}
