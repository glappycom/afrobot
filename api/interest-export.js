// GET /api/interest-export (Authorization: Bearer <INTEREST_EXPORT_TOKEN>) -> all stored submissions as JSON, oldest first.
// DELETE /api/interest-export?id=<submission id> (same auth) -> removes one stored submission (e.g. a test entry).
import crypto from 'node:crypto';
import { list, get, del } from '@vercel/blob';
import { HEADERS, toRow } from './_lib.js';

function authorised(req) {
  const want = process.env.INTEREST_EXPORT_TOKEN || '';
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function all() {
  const blobs = []; let cursor;
  do { const r = await list({ prefix: 'submissions/', cursor, limit: 1000 }); blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!authorised(req)) return res.status(401).json({ ok: false });
  const blobs = await all();
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const hit = blobs.filter(b => id && b.pathname.endsWith(`_${id}.json`));
    if (hit.length) await del(hit.map(b => b.url));
    return res.status(200).json({ ok: true, deleted: hit.length });
  }
  const since = String(req.query.since || '');
  const out = [];
  for (const b of blobs) {
    if (since && b.pathname <= `submissions/${since}`) continue;
    const r = await get(b.pathname, { access: 'private', useCache: false });
    if (!r || !r.stream) continue;
    const txt = await new Response(r.stream).text();
    try { out.push({ key: b.pathname.slice(12), ...JSON.parse(txt) }); } catch {}
  }
  return res.status(200).json({ ok: true, headers: HEADERS, count: out.length, rows: out.map(toRow), submissions: out });
}
