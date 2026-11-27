import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import jpegJs from 'jpeg-js';
import { PNG } from 'pngjs';
import decodeWebp, { init as initWebpDecode } from '@jsquash/webp/decode.js';

const require = createRequire(import.meta.url);
let webpReady;

function webpDecoder() {
  if (!webpReady) {
    const wasm = fs.readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    webpReady = initWebpDecode({ wasmBinary: wasm });
  }
  return webpReady;
}
import { isFamilyRole, isId, canReadSchool } from './access.js';
import { all, get, insert, run, transaction } from './db.js';
import { addEvent } from './domain.js';
import { HttpError, notAvailable, notFound } from './http-error.js';

const MAX_INPUT = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const MAX_STORED = 700_000;
const TYPICAL_PHOTO = 250_000;

function at(now) {
  return typeof now === 'function' ? now() : now;
}

function newPhotoId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(9).toString('hex')}`;
}

export function clubPhotoCapBytes() {
  const raw = process.env.AFROBOT_PHOTO_CAP_BYTES;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  return 20_000_000;
}

export function globalPhotoCapBytes() {
  const raw = process.env.AFROBOT_PHOTO_GLOBAL_CAP_BYTES;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  return 100_000_000;
}

export function photoCapacity() {
  const clubBytes = clubPhotoCapBytes();
  return {
    clubBytes,
    globalBytes: globalPhotoCapBytes(),
    photosPerClub: Math.max(1, Math.floor(clubBytes / TYPICAL_PHOTO)),
  };
}

function sniff(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return '';
}

function resize(data, width, height) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const out = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y += 1) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < targetW; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const from = (sy * width + sx) * 4;
      const to = (y * targetW + x) * 4;
      const alpha = data[from + 3] / 255;
      out[to] = Math.round(data[from] * alpha + 255 * (1 - alpha));
      out[to + 1] = Math.round(data[from + 1] * alpha + 255 * (1 - alpha));
      out[to + 2] = Math.round(data[from + 2] * alpha + 255 * (1 - alpha));
      out[to + 3] = 255;
    }
  }
  return { data: out, width: targetW, height: targetH };
}

function encodeJpeg(rgba, width, height) {
  let quality = 80;
  let encoded = jpegJs.encode({ data: rgba, width, height }, quality);
  while (encoded.data.length > MAX_STORED && quality > 40) {
    quality -= 10;
    encoded = jpegJs.encode({ data: rgba, width, height }, quality);
  }
  if (encoded.data.length > 1_500_000) throw new HttpError(422, 'That photo is still too large after resizing.');
  return Buffer.from(encoded.data);
}

export async function preparePhoto(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length > MAX_INPUT) throw new HttpError(422, 'That photo is over 5 MB.');
  const kind = sniff(bytes);
  if (!kind) throw new HttpError(422, 'Use a JPEG, PNG, or WebP photo.');
  let decoded;
  try {
    if (kind === 'jpeg') {
      decoded = jpegJs.decode(bytes, { useTArray: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 128, formatAsRGBA: true });
    } else if (kind === 'png') {
      const png = PNG.sync.read(bytes);
      decoded = { data: png.data, width: png.width, height: png.height };
    } else {
      await webpDecoder();
      const image = await decodeWebp(bytes);
      decoded = { data: image.data, width: image.width, height: image.height };
    }
  } catch {
    throw new HttpError(422, 'That file is not a usable photo.');
  }
  if (!decoded?.width || !decoded?.height || !decoded.data) throw new HttpError(422, 'That file is not a usable photo.');
  if (decoded.width * decoded.height > 16_000_000) throw new HttpError(422, 'That photo is too large to process.');
  const fitted = resize(decoded.data, decoded.width, decoded.height);
  const stored = encodeJpeg(fitted.data, fitted.width, fitted.height);
  if (sniff(stored) !== 'jpeg') throw new HttpError(422, 'That file is not a usable photo.');
  return { bytes: stored, mediaType: 'image/jpeg', width: fitted.width, height: fitted.height };
}

function imageBytes(input) {
  const raw = typeof input?.image === 'string' ? input.image.trim() : '';
  const data = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const cleaned = data.replace(/\s/g, '');
  if (cleaned.length < 16) throw new HttpError(422, 'Choose a JPEG, PNG, or WebP photo.');
  if (cleaned.length > 7_000_000) throw new HttpError(422, 'That photo is over 5 MB.');
  return Buffer.from(cleaned, 'base64');
}

function linkedLearnerIds(db, user) {
  return all(db, `SELECT learner_id FROM guardian_links WHERE user_id = ? AND status = 'confirmed'`, [user.id]).map((row) => row.learner_id);
}

function tagsFor(db, photoId) {
  return all(db, 'SELECT learner_id FROM photo_tags WHERE photo_id = ? ORDER BY learner_id', [photoId]).map((row) => row.learner_id);
}

export function latestPhotoConsent(db, learnerId) {
  return get(db, 'SELECT * FROM photo_consent WHERE learner_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1', [learnerId]) || null;
}

export function explainPhotoAccess(db, user, photo, now) {
  if (!user) return { ok: false, status: 401, error: 'Sign in required' };
  if (!photo) return { ok: false, status: 404, error: 'Not found' };
  if (photo.removed_at || photo.hidden_at || photo.byte_size === 0) {
    return { ok: false, status: 403, error: 'That photo is not available.' };
  }
  const tags = tagsFor(db, photo.id);
  if (isFamilyRole(user.role)) {
    const mine = linkedLearnerIds(db, user);
    const onlyMine = Number(photo.no_students) !== 1 && tags.length === 1 && mine.includes(tags[0]);
    if (!onlyMine) {
      return { ok: false, status: 403, error: 'A guardian can only open a photo that shows their own child and nobody else.' };
    }
    return { ok: true };
  }
  if (!['coach', 'organiser', 'auditor'].includes(user.role) || !canReadSchool(db, user, photo.school_id, at(now))) {
    if (user.role === 'coach') return { ok: false, status: 403, error: 'That photo is in another club.' };
    return { ok: false, status: 403, error: 'That photo is outside your access.' };
  }
  return { ok: true };
}

function photoMeta(db, id) {
  if (!isId(id)) return null;
  return get(db, `SELECT id, claim_id, school_id, media_type, sha256, width, height, byte_size, no_students, created_by, created_at, removed_at, removed_by, remove_reason, hidden_at, hidden_reason
    FROM session_photos WHERE id = ?`, [id]);
}

function usage(db, schoolId) {
  const club = get(db, `SELECT COALESCE(SUM(byte_size), 0) AS n FROM session_photos WHERE school_id = ? AND removed_at IS NULL AND hidden_at IS NULL`, [schoolId]);
  const allBytes = get(db, `SELECT COALESCE(SUM(byte_size), 0) AS n FROM session_photos WHERE removed_at IS NULL AND hidden_at IS NULL`);
  return { club: Number(club?.n || 0), global: Number(allBytes?.n || 0) };
}

function learnerLetters(db, ids) {
  if (!ids.length) return [];
  const rows = all(db, `SELECT id, letter FROM learners WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  const byId = new Map(rows.map((row) => [row.id, row.letter]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function savePhoto(db, user, claimId, input, now) {
  if (!user || user.role !== 'coach') throw notAvailable();
  if (!isId(claimId)) throw notFound();
  const claim = get(db, 'SELECT * FROM claims WHERE id = ?', [claimId]);
  if (!claim || claim.submitted_by !== user.id) throw notFound();
  if (!canReadSchool(db, user, claim.school_id, at(now))) throw notFound();
  if (claim.status !== 'submitted') throw new HttpError(422, 'Add photos to the version that is waiting for review.');
  const prepared = await preparePhoto(imageBytes(input));
  const noStudents = input.noStudents === true || input.noStudents === '1' || input.noStudents === 'on';
  const learnerIds = [...new Set((Array.isArray(input.learnerIds) ? input.learnerIds : String(input.learnerIds || '').split(','))
    .map((id) => String(id || '').trim())
    .filter(Boolean))];
  if (noStudents === Boolean(learnerIds.length)) {
    throw new HttpError(422, 'Say who is in the photo, or mark that no students are shown.');
  }
  for (const learnerId of learnerIds) {
    if (!isId(learnerId)) throw new HttpError(422, 'That student is not in this club.');
    const learner = get(db, 'SELECT * FROM learners WHERE id = ?', [learnerId]);
    if (!learner || learner.school_id !== claim.school_id || Number(learner.active) === 0) {
      throw new HttpError(422, 'That student is not in this club.');
    }
  }
  const missing = learnerIds.filter((learnerId) => latestPhotoConsent(db, learnerId)?.status !== 'active');
  if (missing.length) {
    const letters = learnerLetters(db, missing).map((letter) => `Student ${letter}`);
    throw new HttpError(422, `${letters.join(' and ') || 'A tagged student'} has no photo consent, so this picture cannot be stored.`);
  }
  const cap = clubPhotoCapBytes();
  const globalCap = globalPhotoCapBytes();
  const stamp = at(now);
  const id = newPhotoId('pho');
  const digest = crypto.createHash('sha256').update(prepared.bytes).digest('hex');
  transaction(db, () => {
    const spent = usage(db, claim.school_id);
    if (spent.club + prepared.bytes.length > cap) {
      const room = photoCapacity();
      throw new HttpError(422, `This club has reached its photo storage limit. A club can store about ${room.photosPerClub} photos (${Math.round(room.clubBytes / (1024 * 1024))} MB) on the free plan.`);
    }
    if (spent.global + prepared.bytes.length > globalCap) {
      throw new HttpError(422, 'Photo storage on this free plan is full.');
    }
    insert(db, 'session_photos', {
      id,
      claim_id: claim.id,
      school_id: claim.school_id,
      bytes: prepared.bytes,
      media_type: prepared.mediaType,
      sha256: digest,
      width: prepared.width,
      height: prepared.height,
      byte_size: prepared.bytes.length,
      no_students: noStudents ? 1 : 0,
      created_by: user.id,
      created_at: stamp,
      removed_at: null,
      removed_by: null,
      remove_reason: null,
      hidden_at: null,
      hidden_reason: null,
    });
    for (const learnerId of learnerIds) insert(db, 'photo_tags', { photo_id: id, learner_id: learnerId });
    addEvent(db, {
      now: stamp,
      action: 'photo-uploaded',
      user,
      subjectType: 'photo',
      subjectId: id,
      schoolId: claim.school_id,
      detail: { claim_id: claim.id, no_students: noStudents, learners: learnerLetters(db, learnerIds) },
    });
  });
  return { id, byteSize: prepared.bytes.length, mediaType: prepared.mediaType };
}

export function removePhoto(db, user, photoId, input, now) {
  const photo = photoMeta(db, photoId);
  if (!photo) throw notFound();
  if (photo.removed_at || photo.hidden_at) throw new HttpError(422, 'That photo is already gone.');
  const claim = get(db, 'SELECT * FROM claims WHERE id = ?', [photo.claim_id]);
  if (!claim) throw notFound();
  const approved = get(db, `SELECT id FROM claims WHERE series_id = ? AND status = 'approved' LIMIT 1`, [claim.series_id]);
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
  const stamp = at(now);
  if (user.role === 'coach') {
    if (photo.created_by !== user.id || !canReadSchool(db, user, photo.school_id, stamp)) {
      throw new HttpError(403, 'That photo is in another club.');
    }
    if (approved || claim.status === 'approved') {
      throw new HttpError(422, 'After approval only the organiser can remove a photo, and they need a reason.');
    }
  } else if (user.role === 'organiser') {
    if (!canReadSchool(db, user, photo.school_id, stamp)) throw new HttpError(403, 'That photo is outside your access.');
    if (!approved && claim.status !== 'approved') throw new HttpError(422, 'Before approval the coach removes their own photo.');
    if (reason.length < 3) throw new HttpError(422, 'A reason is required to remove a photo after approval.');
  } else {
    throw notAvailable();
  }
  run(db, `UPDATE session_photos SET bytes = NULL, byte_size = 0, removed_at = ?, removed_by = ?, remove_reason = ? WHERE id = ?`, [
    stamp, user.id, reason || null, photo.id,
  ]);
  addEvent(db, {
    now: stamp,
    action: 'photo-removed',
    user,
    subjectType: 'photo',
    subjectId: photo.id,
    schoolId: photo.school_id,
    detail: { claim_id: photo.claim_id, reason: reason || null },
  });
  return { id: photo.id };
}

export function readPhoto(db, user, photoId, now, download) {
  const photo = photoMeta(db, photoId);
  const access = explainPhotoAccess(db, user, photo, now);
  if (!access.ok) return access;
  const stored = get(db, 'SELECT bytes, media_type FROM session_photos WHERE id = ?', [photo.id]);
  const bytes = stored?.bytes ? Buffer.from(stored.bytes) : null;
  if (!bytes?.length) return { ok: false, status: 403, error: 'That photo is not available.' };
  addEvent(db, {
    now: at(now),
    action: download ? 'photo-downloaded' : 'photo-viewed',
    user,
    subjectType: 'photo',
    subjectId: photo.id,
    schoolId: photo.school_id,
    detail: { claim_id: photo.claim_id },
  });
  return { ok: true, status: 200, bytes, mediaType: stored.media_type || 'image/jpeg' };
}

function requireConsentActor(db, user, learnerId, now) {
  if (!user || !isId(learnerId)) throw notFound();
  const learner = get(db, 'SELECT * FROM learners WHERE id = ?', [learnerId]);
  if (!learner) throw notFound();
  if (user.role === 'organiser') {
    if (!canReadSchool(db, user, learner.school_id, at(now))) throw new HttpError(403, 'That student is outside your access.');
    return learner;
  }
  if (isFamilyRole(user.role)) {
    if (!linkedLearnerIds(db, user).includes(learner.id)) throw new HttpError(403, 'A guardian can only change photo consent for their own child.');
    return learner;
  }
  throw notAvailable();
}

export function recordPhotoConsent(db, user, learnerId, now) {
  const learner = requireConsentActor(db, user, learnerId, now);
  const stamp = at(now);
  const id = newPhotoId('pc');
  insert(db, 'photo_consent', {
    id,
    learner_id: learner.id,
    status: 'active',
    recorded_by: user.id,
    recorded_at: stamp,
  });
  addEvent(db, {
    now: stamp,
    action: 'photo-consent-recorded',
    user,
    subjectType: 'learner',
    subjectId: learner.id,
    schoolId: learner.school_id,
    detail: { letter: learner.letter },
  });
  return { id, learnerId: learner.id, status: 'active', recordedAt: stamp };
}

export function withdrawPhotoConsent(db, user, learnerId, now) {
  const learner = requireConsentActor(db, user, learnerId, now);
  const stamp = at(now);
  const id = newPhotoId('pc');
  const photos = all(db, `SELECT session_photos.id FROM session_photos
    JOIN photo_tags ON photo_tags.photo_id = session_photos.id
    WHERE photo_tags.learner_id = ? AND session_photos.hidden_at IS NULL AND session_photos.removed_at IS NULL`, [learner.id]);
  transaction(db, () => {
    insert(db, 'photo_consent', {
      id,
      learner_id: learner.id,
      status: 'withdrawn',
      recorded_by: user.id,
      recorded_at: stamp,
    });
    for (const photo of photos) {
      run(db, `UPDATE session_photos SET bytes = NULL, byte_size = 0, hidden_at = ?, hidden_reason = ? WHERE id = ?`, [
        stamp, 'photo consent withdrawn', photo.id,
      ]);
      insert(db, 'photo_deletion_queue', {
        id: newPhotoId('pdq'),
        photo_id: photo.id,
        learner_id: learner.id,
        queued_at: stamp,
        reason: 'photo consent withdrawn',
      });
    }
    addEvent(db, {
      now: stamp,
      action: 'photo-consent-withdrawn',
      user,
      subjectType: 'learner',
      subjectId: learner.id,
      schoolId: learner.school_id,
      detail: { letter: learner.letter, photos: photos.map((row) => row.id) },
    });
  });
  return { id, learnerId: learner.id, status: 'withdrawn', hidden: photos.length };
}

function describe(db, row) {
  const tags = tagsFor(db, row.id);
  return {
    id: row.id,
    claimId: row.claim_id,
    schoolId: row.school_id,
    noStudents: Number(row.no_students) === 1,
    byteSize: row.byte_size,
    letters: learnerLetters(db, tags),
  };
}

export function listClaimPhotos(db, user, claimId, now) {
  if (!isId(claimId)) return [];
  const claim = get(db, 'SELECT * FROM claims WHERE id = ?', [claimId]);
  if (!claim) return [];
  const rows = all(db, `SELECT id, claim_id, school_id, byte_size, no_students, hidden_at, removed_at, created_by
    FROM session_photos WHERE claim_id = ? ORDER BY created_at, id`, [claimId]);
  return rows.filter((row) => !row.hidden_at && !row.removed_at && explainPhotoAccess(db, user, row, now).ok).map((row) => describe(db, row));
}

export function listSeriesPhotos(db, user, seriesId, now) {
  if (!isId(seriesId)) return [];
  const versions = all(db, 'SELECT id, version FROM claims WHERE series_id = ? ORDER BY version', [seriesId]);
  if (!versions.length) return [];
  const versionOf = new Map(versions.map((row) => [row.id, row.version]));
  const rows = all(db, `SELECT id, claim_id, school_id, byte_size, no_students, hidden_at, removed_at
    FROM session_photos WHERE claim_id IN (${versions.map(() => '?').join(',')}) ORDER BY created_at, id`, versions.map((row) => row.id));
  return rows
    .filter((row) => !row.hidden_at && !row.removed_at && explainPhotoAccess(db, user, row, now).ok)
    .map((row) => ({ ...describe(db, row), version: versionOf.get(row.claim_id) }));
}

export function guardianPhotos(db, user, now) {
  if (!user || !isFamilyRole(user.role)) return [];
  const mine = linkedLearnerIds(db, user);
  if (mine.length !== 1) return [];
  const rows = all(db, `SELECT session_photos.id, session_photos.claim_id, session_photos.school_id, session_photos.byte_size, session_photos.no_students, session_photos.hidden_at, session_photos.removed_at
    FROM session_photos JOIN photo_tags ON photo_tags.photo_id = session_photos.id
    WHERE photo_tags.learner_id = ? AND session_photos.hidden_at IS NULL AND session_photos.removed_at IS NULL AND session_photos.no_students = 0
    ORDER BY session_photos.created_at`, [mine[0]]);
  return rows.filter((row) => tagsFor(db, row.id).length === 1 && explainPhotoAccess(db, user, row, now).ok).map((row) => describe(db, row));
}

export function consentLabel(db, learnerId) {
  const row = latestPhotoConsent(db, learnerId);
  if (!row) return { status: 'missing', text: 'No photo consent on record.' };
  const person = get(db, 'SELECT display_name FROM users WHERE id = ?', [row.recorded_by]);
  const when = String(row.recorded_at).slice(0, 10);
  if (row.status === 'withdrawn') return { status: 'withdrawn', text: `Photo consent withdrawn on ${when} by ${person?.display_name || 'the recorder'}.` };
  return { status: 'active', text: `Photo consent recorded on ${when} by ${person?.display_name || 'the recorder'}.` };
}
