# Volunteer form to Google Sheet

The volunteer page posts to `/api/volunteer`. That route checks the fields, drops honeypot hits, and forwards the row to a Google Apps Script web app. The script URL is not in the page.

1. In Google Drive, create a spreadsheet. Name the first sheet anything you like. The script uses the first sheet.
2. Extensions → Apps Script. Replace the default file with `docs/volunteer-sheet-apps-script.gs`.
3. Project Settings → Script properties. Add `SHEETS_WEBHOOK_SECRET` with a long random value.
4. Deploy → New deployment → Web app. Execute as **Me**. Who has access: **Anyone**. Copy the web app URL (it ends in `/exec`).
5. In the Vercel project, set:
   - `SHEETS_WEBHOOK_URL` = that `/exec` URL
   - `SHEETS_WEBHOOK_SECRET` = the same secret
6. Redeploy the site so the function can read the variables.

If either variable is missing, `/api/volunteer` returns `503` and `{ "ok": false, "error": "not_configured" }`. The static site still builds.

The honeypot field `website` is not a column. A filled honeypot is not written to the sheet.

Column order:

1. Submitted (UTC)
2. Your name (adult) — `name`
3. Email — `email`
4. I am a — `role`
5. City and state — `city`
6. Organization — `organization`
7. Number of kids and ages — `kids`
8. Message — `message`
9. Consent to contact — `consent`
