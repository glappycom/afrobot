// POST /api/interest  -> validates the Register interest form and stores it durably in the private Vercel Blob store.
import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { ROLES, KIDS_ROLES, readJson, appendToSheet, toRow } from './_lib.js';

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const clean = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
// keep spreadsheet cells literal: neutralise leading formula characters
const cell = v => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const b = await readJson(req);
  if (!b) return res.status(400).json({ ok: false, error: 'bad_request' });

  // spam traps: hidden honeypot field filled, or submitted faster than a person could type
  const elapsed = Number(b.t) ? Date.now() - Number(b.t) : 99999;
  if (clean(b.website, 200) || elapsed < 2500) return res.status(200).json({ ok: true });

  const s = {
    name: clean(b.name, 120), email: clean(b.email, 200).toLowerCase(), role: clean(b.role, 40),
    city: clean(b.city, 120), organization: clean(b.organization, 160), kids: clean(b.kids, 120),
    message: clean(b.message, 2000), consent: b.consent === true || b.consent === 'yes' || b.consent === 'on',
  };
  const errors = {};
  if (s.name.length < 2) errors.name = 'Please enter your name.';
  if (!EMAIL.test(s.email)) errors.email = 'Please enter a valid email address.';
  if (!ROLES.includes(s.role)) errors.role = 'Please choose the option that fits you best.';
  if (s.city.length < 2) errors.city = 'Please enter your city and state.';
  if (!s.consent) errors.consent = 'Please confirm we may contact you.';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, error: 'validation', errors });
  if (!KIDS_ROLES.includes(s.role)) s.kids = '';

  const now = new Date();
  const rec = {
    id: crypto.randomUUID(), submittedAt: now.toISOString().replace('T', ' ').slice(0, 19),
    ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'string' ? cell(v) : v])),
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
