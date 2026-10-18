// Shared helpers for the AfroBot interest form API (files starting with _ are not deployed as routes).
import crypto from 'node:crypto';

export const ROLES = ['Parent/guardian', 'Student', 'School/educator', 'Volunteer/mentor', 'Sponsor/partner', 'Other'];
export const KIDS_ROLES = ['Parent/guardian', 'School/educator'];
export const HEADERS = ['Submitted (UTC)', 'Name', 'Email', 'Role', 'City / state', 'Organization', 'Kids / age range', 'Message', 'Consent to contact', 'Submission ID', 'Source page'];

export function toRow(s) {
  return [s.submittedAt, s.name, s.email, s.role, s.city, s.organization, s.kids, s.message, s.consent ? 'Yes' : 'No', s.id, s.page];
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20000) return null; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; }
}

// Optional: append straight to the Google Sheet when a service account is configured.
// Needs env GOOGLE_SERVICE_ACCOUNT_JSON (the key file JSON) and SHEET_ID; the sheet must be shared with the service account email (Editor).
export async function appendToSheet(row) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON, sheetId = process.env.SHEET_ID;
  if (!raw || !sheetId) return { skipped: true };
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) }).then(r => r.json());
  if (!tok.access_token) throw new Error('google token: ' + (tok.error || 'failed'));
  const tab = encodeURIComponent((process.env.SHEET_TAB || 'Submissions') + '!A1');
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: { authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error('sheets append ' + r.status);
  return { appended: true };
}
