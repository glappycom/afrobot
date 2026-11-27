import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import jpegJs from 'jpeg-js';
import { PNG } from 'pngjs';
import { simd } from 'wasm-feature-detect';
import encodeWebp, { init as initWebpEncode } from '@jsquash/webp/encode.js';

const require = createRequire(import.meta.url);
import { packBinary, unpackBinary } from '../src/binary-json.js';
import { preparePhoto } from '../src/photos.js';
import { api, demo, login, page } from './helpers.js';

function solidJpeg(width, height, rgb = [30, 90, 160]) {
  const data = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  }
  return Buffer.from(jpegJs.encode({ data, width, height }, 80).data);
}

function withExif(jpeg) {
  const payload = Buffer.from('Exif\0\0GPSLatitude SECRET-LOCATION', 'latin1');
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

function solidPng() {
  const png = new PNG({ width: 12, height: 8 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 200;
    png.data[i + 1] = 40;
    png.data[i + 2] = 40;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

test('photo files are checked, resized, and stripped of location data', async () => {
  const dirty = withExif(solidJpeg(32, 16));
  assert.ok(dirty.includes(Buffer.from('GPSLatitude')));
  const clean = await preparePhoto(dirty);
  assert.equal(clean.mediaType, 'image/jpeg');
  assert.ok(clean.bytes[0] === 0xff && clean.bytes[1] === 0xd8);
  assert.equal(clean.bytes.includes(Buffer.from('Exif')), false);
  assert.equal(clean.bytes.includes(Buffer.from('GPSLatitude')), false);
  assert.equal(clean.bytes.includes(Buffer.from('SECRET-LOCATION')), false);
  assert.ok(clean.width <= 1600 && clean.height <= 1600);

  const png = await preparePhoto(solidPng());
  assert.equal(png.mediaType, 'image/jpeg');
  assert.equal(sniffJpeg(png.bytes), true);

  const wide = await preparePhoto(solidJpeg(2400, 800));
  assert.ok(wide.width <= 1600);
  assert.ok(wide.height <= 1600);

  const rgba = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 10;
    rgba[i + 1] = 20;
    rgba[i + 2] = 30;
    rgba[i + 3] = 255;
  }
  const wasmName = (await simd()) ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
  const wasm = fs.readFileSync(require.resolve(`@jsquash/webp/codec/enc/${wasmName}`));
  await initWebpEncode({ wasmBinary: wasm });
  const webp = Buffer.from(await encodeWebp({ data: rgba, width: 8, height: 8 }));
  const fromWebp = await preparePhoto(webp);
  assert.equal(fromWebp.mediaType, 'image/jpeg');

  await assert.rejects(() => preparePhoto(Buffer.from('this is not a picture')), /JPEG, PNG, or WebP/);
  await assert.rejects(() => preparePhoto(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)])), /over 5 MB/);
});

test('binary values survive the hosted database channel encoding', () => {
  const packed = packBinary(Buffer.from([1, 2, 255]));
  assert.deepEqual(unpackBinary(packed), Buffer.from([1, 2, 255]));
  assert.equal(packBinary(undefined), null);
  assert.equal(unpackBinary('plain'), 'plain');
});

test('photo routes enforce consent, scope, withdrawal, versioning, and the storage cap', async () => {
  const previous = process.env.AFROBOT_PHOTO_CAP_BYTES;
  const app = await demo();
  try {
    const coachA = await login(app.url, 'coach-a', 'demo-coach-a');
    const coachB = await login(app.url, 'coach-b', 'demo-coach-b');
    const organiser = await login(app.url, 'organiser', 'demo-organiser');
    const auditor = await login(app.url, 'auditor', 'demo-auditor');
    const guardianA = await login(app.url, 'student-a', 'demo-student-a');
    const guardianB = await login(app.url, 'student-b', 'demo-student-b');
    const sent = await api(app.url, coachA, 'POST', '/api/captures', {
      meetingId: 'mtg-cm-w1',
      idempotencyKey: 'photo-week-one-0001',
      numerator: 1,
      denominator: 2,
      projectResult: 'Kit moved',
      note: 'Robot only. No names here.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(sent.status, 201, await sent.clone().text());
    const claimId = (await sent.json()).id;
    const jpeg = solidJpeg(24, 24);
    const blocked = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/photos`, {
      image: jpeg.toString('base64'),
      learnerIds: ['lrn-cm-a'],
      noStudents: false,
    });
    assert.equal(blocked.status, 422);
    assert.match((await blocked.json()).error, /Student A has no photo consent/);

    assert.equal((await api(app.url, organiser, 'POST', '/api/photo-consent', { learnerId: 'lrn-cm-a' })).status, 201);
    assert.equal((await api(app.url, organiser, 'POST', '/api/photo-consent', { learnerId: 'lrn-cm-b' })).status, 201);
    const robot = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/photos`, {
      image: jpeg.toString('base64'),
      filename: 'notes.jpg',
      noStudents: true,
    });
    assert.equal(robot.status, 201, await robot.clone().text());
    const robotId = (await robot.json()).id;
    const onlyA = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/photos`, {
      image: solidPng().toString('base64'),
      filename: 'student.jpg',
      learnerIds: ['lrn-cm-a'],
    });
    assert.equal(onlyA.status, 201, await onlyA.clone().text());
    const onlyAId = (await onlyA.json()).id;
    const both = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/photos`, {
      image: jpeg.toString('base64'),
      learnerIds: ['lrn-cm-a', 'lrn-cm-b'],
    });
    assert.equal(both.status, 201, await both.clone().text());
    const bothId = (await both.json()).id;
    const extra = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/photos`, {
      image: jpeg.toString('base64'),
      noStudents: true,
    });
    assert.equal(extra.status, 201, await extra.clone().text());
    const extraId = (await extra.json()).id;
    assert.equal((await api(app.url, coachA, 'POST', `/api/photos/${extraId}/remove`, {})).status, 200);
    assert.equal((await fetch(`${app.url}/photos/${extraId}`, { headers: { cookie: coachA.cookie, accept: 'application/json' } })).status, 403);

    const anon = await fetch(`${app.url}/photos/${robotId}`);
    assert.equal(anon.status, 401);
    const otherClub = await fetch(`${app.url}/photos/${robotId}`, { headers: { cookie: coachB.cookie, accept: 'application/json' } });
    assert.equal(otherClub.status, 403);
    assert.match((await otherClub.json()).error, /another club/);
    const seen = await fetch(`${app.url}/photos/${robotId}`, { headers: { cookie: coachA.cookie } });
    assert.equal(seen.status, 200);
    assert.match(seen.headers.get('cache-control'), /private/);
    assert.match(seen.headers.get('cache-control'), /no-store/);
    assert.match(seen.headers.get('content-type'), /image\/jpeg/);
    const seenBytes = Buffer.from(await seen.arrayBuffer());
    assert.equal(seenBytes.includes(Buffer.from('GPSLatitude')), false);

    assert.equal((await fetch(`${app.url}/photos/${bothId}`, { headers: { cookie: guardianA.cookie, accept: 'application/json' } })).status, 403);
    assert.equal((await fetch(`${app.url}/photos/${robotId}`, { headers: { cookie: guardianA.cookie, accept: 'application/json' } })).status, 403);
    const guardianSeen = await fetch(`${app.url}/photos/${onlyAId}`, { headers: { cookie: guardianA.cookie } });
    assert.equal(guardianSeen.status, 200);
    assert.equal((await fetch(`${app.url}/photos/${onlyAId}`, { headers: { cookie: guardianB.cookie, accept: 'application/json' } })).status, 403);

    const tz = await api(app.url, coachB, 'POST', '/api/captures', {
      meetingId: 'mtg-tz-w1',
      idempotencyKey: 'photo-tz-week-one-01',
      numerator: 1,
      denominator: 1,
      projectResult: 'Kit moved',
      note: 'Robot only. No names here.',
      attendance: [{ learnerId: 'lrn-tz-a', present: true }],
    });
    assert.equal(tz.status, 201, await tz.clone().text());
    const tzPhoto = await api(app.url, coachB, 'POST', `/api/claims/${(await tz.json()).id}/photos`, {
      image: jpeg.toString('base64'),
      noStudents: true,
    });
    assert.equal(tzPhoto.status, 201, await tzPhoto.clone().text());
    const tzPhotoId = (await tzPhoto.json()).id;
    const outside = await fetch(`${app.url}/photos/${tzPhotoId}`, { headers: { cookie: auditor.cookie, accept: 'application/json' } });
    assert.equal(outside.status, 403);
    assert.match((await outside.json()).error, /outside your access/);
    assert.equal((await fetch(`${app.url}/photos/${onlyAId}`, { headers: { cookie: auditor.cookie } })).status, 200);

    const returned = await api(app.url, organiser, 'POST', `/api/claims/${claimId}/return`, { note: 'Add the project note again' });
    assert.equal(returned.status, 200, await returned.clone().text());
    const resubmit = await api(app.url, coachA, 'POST', `/api/claims/${claimId}/resubmit`, {
      numerator: 1,
      denominator: 2,
      projectResult: 'Kit moved',
      note: 'Robot only. Note added.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(resubmit.status, 200, await resubmit.clone().text());
    const next = await resubmit.json();
    assert.notEqual(next.id, claimId);
    assert.equal((await fetch(`${app.url}/photos/${robotId}`, { headers: { cookie: coachA.cookie } })).status, 200);
    const oldRows = app.app.db.prepare('SELECT id FROM session_photos WHERE claim_id = ? AND removed_at IS NULL').all(claimId);
    assert.ok(oldRows.some((row) => row.id === robotId));
    const newRows = app.app.db.prepare('SELECT id FROM session_photos WHERE claim_id = ?').all(next.id);
    assert.equal(newRows.length, 0);
    const trace = await page(app.url, auditor, `/auditor/trace/${next.id}`);
    assert.equal(trace.status, 200);
    assert.match(trace.text, /Photo count 3/);
    assert.match(trace.text, new RegExp(`/photos/${robotId}`));
    assert.match(trace.text, /Version 1/);

    const approved = await api(app.url, organiser, 'POST', `/api/claims/${next.id}/approve`, {});
    assert.equal(approved.status, 200, await approved.clone().text());
    const coachRemove = await api(app.url, coachA, 'POST', `/api/photos/${robotId}/remove`, {});
    assert.equal(coachRemove.status, 422);
    assert.match((await coachRemove.json()).error, /only the organiser/);
    const noReason = await api(app.url, organiser, 'POST', `/api/photos/${robotId}/remove`, {});
    assert.equal(noReason.status, 422);
    const removed = await api(app.url, organiser, 'POST', `/api/photos/${robotId}/remove`, { reason: 'Kit photo no longer needed' });
    assert.equal(removed.status, 200, await removed.clone().text());
    assert.equal((await fetch(`${app.url}/photos/${robotId}`, { headers: { cookie: coachA.cookie, accept: 'application/json' } })).status, 403);

    const familyBefore = await page(app.url, guardianA, '/student/family');
    assert.match(familyBefore.text, new RegExp(`/photos/${onlyAId}`));
    assert.equal(familyBefore.text.includes(`/photos/${bothId}`), false);
    const withdrawn = await api(app.url, guardianA, 'POST', '/student/photo-consent/withdraw', { learnerId: 'lrn-cm-a' });
    assert.equal(withdrawn.status, 200, await withdrawn.clone().text());
    assert.equal((await fetch(`${app.url}/photos/${onlyAId}`, { headers: { cookie: guardianA.cookie, accept: 'application/json' } })).status, 403);
    assert.equal((await fetch(`${app.url}/photos/${onlyAId}`, { headers: { cookie: coachA.cookie, accept: 'application/json' } })).status, 403);
    assert.equal((await fetch(`${app.url}/photos/${bothId}`, { headers: { cookie: auditor.cookie, accept: 'application/json' } })).status, 403);
    const hidden = app.app.db.prepare('SELECT bytes, hidden_at FROM session_photos WHERE id = ?').get(onlyAId);
    assert.equal(hidden.bytes, null);
    assert.ok(hidden.hidden_at);
    const queued = app.app.db.prepare('SELECT COUNT(*) AS n FROM photo_deletion_queue WHERE photo_id = ?').get(onlyAId);
    assert.equal(Number(queued.n), 1);
    const familyAfter = await page(app.url, guardianA, '/student/family');
    assert.equal(familyAfter.text.includes(`/photos/${onlyAId}`), false);
    assert.match(familyAfter.text, /Photo consent withdrawn/);
    const audit = await page(app.url, organiser, '/audit');
    assert.match(audit.text, /photo-viewed/);
    assert.match(audit.text, /photo-consent-withdrawn/);
    assert.match(audit.text, /photo-removed/);

    const coachHelp = await page(app.url, coachA, '/help');
    const organiserHelp = await page(app.url, organiser, '/help');
    const auditorHelp = await page(app.url, auditor, '/help');
    const guardianHelp = await page(app.url, guardianA, '/help');
    assert.match(coachHelp.text, /photo consent/);
    assert.match(organiserHelp.text, /photo consent/);
    assert.match(auditorHelp.text, /audit log/);
    assert.match(guardianHelp.text, /withdraw/i);

    process.env.AFROBOT_PHOTO_CAP_BYTES = '1';
    const again = await api(app.url, coachA, 'POST', '/api/captures', {
      meetingId: 'mtg-cm-w2',
      idempotencyKey: 'photo-week-two-0001',
      numerator: 1,
      denominator: 2,
      projectResult: 'Kit moved',
      note: 'Robot only. No names here.',
      attendance: [
        { learnerId: 'lrn-cm-a', present: true },
        { learnerId: 'lrn-cm-b', present: false },
      ],
    });
    assert.equal(again.status, 201, await again.clone().text());
    const capped = await api(app.url, coachA, 'POST', `/api/claims/${(await again.json()).id}/photos`, {
      image: jpeg.toString('base64'),
      noStudents: true,
    });
    assert.equal(capped.status, 422);
    assert.match((await capped.json()).error, /photo storage limit/);
  } finally {
    if (previous === undefined) delete process.env.AFROBOT_PHOTO_CAP_BYTES;
    else process.env.AFROBOT_PHOTO_CAP_BYTES = previous;
    await app.stop();
  }
});

function sniffJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
