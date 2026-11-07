/**
 * Bound to the volunteer Google Sheet. Deploy as a web app:
 * Execute as: Me. Who has access: Anyone.
 * Set script property SHEETS_WEBHOOK_SECRET to the same value as Vercel SHEETS_WEBHOOK_SECRET.
 * The sheet’s first row is written once, in this order:
 * Submitted (UTC), Your name (adult), Email, I am a, City and state,
 * Organization, Number of kids and ages, Message, Consent to contact
 */
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData && e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'bad_request' }); }

  var secret = PropertiesService.getScriptProperties().getProperty('SHEETS_WEBHOOK_SECRET');
  if (!secret || body.secret !== secret) return json_({ ok: false, error: 'unauthorized' });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = [
    'Submitted (UTC)',
    'Your name (adult)',
    'Email',
    'I am a',
    'City and state',
    'Organization',
    'Number of kids and ages',
    'Message',
    'Consent to contact'
  ];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);

  sheet.appendRow([
    body.submittedAt || new Date().toISOString(),
    body.name || '',
    body.email || '',
    body.role || '',
    body.city || '',
    body.organization || '',
    body.kids || '',
    body.message || '',
    body.consent || ''
  ]);
  return json_({ ok: true });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
