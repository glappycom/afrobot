// POST /api/updates — footer email sign-up. Reuses the interest form's private Blob store and optional Google Sheet.
// Does not send mail: the interest and volunteer handlers do not notify hello@afrobot.org.
import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { appendToSheet, readJson, toRow } from './_lib.js';

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const clean = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
const cell = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  const b = await readJson(req);
  if (!b) return res.status(400).json({ ok: false, error: 'bad_request' });

  const elapsed = Number(b.t) ? Date.now() - Number(b.t) : 99999;
  if (clean(b.website, 200) || elapsed < 2500) return res.status(200).json({ ok: true });

  const email = cell(clean(b.email, 200).toLowerCase());
  if (!EMAIL.test(email)) return res.status(422).json({ ok: false, error: 'validation', errors: { email: 'Please enter a valid email address.' } });

  const now = new Date();
  const rec = {
    id: crypto.randomUUID(),
    submittedAt: now.toISOString().replace('T', ' ').slice(0, 19),
    name: '',
    email,
    role: 'Other',
    city: '',
    organization: '',
    kids: '',
    message: 'footer-updates',
    consent: true,
    source: 'footer-updates',
    page: clean(b.page, 300) || clean(req.headers.referer, 300),
  };
  try {
    await put(`submissions/${now.toISOString().replace(/[:.]/g, '-')}_${rec.id}.json`, JSON.stringify(rec), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false,
    });
  } catch (e) {
    console.error('blob put failed', e);
    return res.status(500).json({ ok: false, error: 'store' });
  }
  try { await appendToSheet(toRow(rec)); } catch (e) { console.error('sheet append failed (kept in blob store)', e.message); }
  return res.status(200).json({ ok: true });
}
