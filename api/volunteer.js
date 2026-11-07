// POST /api/volunteer — validates the adult volunteer form and forwards it to the Apps Script web app.
// SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET stay on the server.
import { ROLES, KIDS_ROLES, readJson } from './_lib.js';

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const clean = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
const cell = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 8;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function limited(ip) {
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_HITS) { HITS.set(ip, recent); return true; }
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 5000) {
    for (const [key, times] of HITS) {
      if (!times.some((t) => now - t < WINDOW_MS)) HITS.delete(key);
    }
  }
  return false;
}

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
  if (limited(clientIp(req))) return res.status(429).json({ ok: false, error: 'rate_limit' });

  const s = {
    name: cell(clean(b.name, 120)),
    email: cell(clean(b.email, 200).toLowerCase()),
    role: cell(clean(b.role, 40)),
    city: cell(clean(b.city, 120)),
    organization: cell(clean(b.organization, 160)),
    kids: cell(clean(b.kids, 120)),
    message: cell(clean(b.message, 2000)),
    consent: b.consent === true || b.consent === 'yes' || b.consent === 'on',
  };
  const errors = {};
  if (s.name.length < 2) errors.name = 'Please enter your name.';
  if (!EMAIL.test(s.email)) errors.email = 'Please enter a valid email address.';
  if (!ROLES.includes(s.role)) errors.role = 'Please choose the option that fits you best.';
  if (s.city.length < 2) errors.city = 'Please enter your city and state.';
  if (!s.consent) errors.consent = 'Please confirm we may contact you.';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, error: 'validation', errors });
  if (!KIDS_ROLES.includes(s.role)) s.kids = '';

  const url = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!url || !secret) return res.status(503).json({ ok: false, error: 'not_configured' });

  const submittedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let forwarded;
  try {
    forwarded = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret,
        submittedAt,
        name: s.name,
        email: s.email,
        role: s.role,
        city: s.city,
        organization: s.organization,
        kids: s.kids,
        message: s.message,
        consent: s.consent ? 'Yes' : 'No',
      }),
    });
  } catch (e) {
    console.error('volunteer forward failed', e.message);
    return res.status(502).json({ ok: false, error: 'forward' });
  }
  if (!forwarded.ok) return res.status(502).json({ ok: false, error: 'forward' });
  return res.status(200).json({ ok: true });
}
