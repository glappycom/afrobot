# AfroBot site assessment

Baseline reviewed before the Phase 1 redesign. The live site is a static concept preview for AfroBot, the kids-only youth robotics and AI program of Glappy Foundation. Founders named on the page are Dr. Unoma Okorafor and Dr. Russell Avre.

This note describes what was in the repository at that baseline. It does not describe the redesigned homepage.

## Stack and hosting

- No framework and no bundler. The public site is `index.html`, `styles.css`, and `script.js`.
- `package.json` names the project `afrobot-site`, requires Node 20 or newer, and depends only on `@vercel/blob`. There was no build script, test script, or linter.
- Hosting is Vercel. `vercel.json` turns on clean URLs and a long cache for `/fonts/*`. There is no build command, rewrite, or redirect in the repo. Pushes to `main` are what the README treats as production. This work must not change that file, DNS, or production settings.
- Server code is two Vercel functions: `api/interest.js` (POST) and `api/interest-export.js` (GET and DELETE). `api/_lib.js` is a shared module. Files prefixed with `_` are not deployed as routes.
- There is no auth, database, CMS, or CI config in the repo.

## What the baseline page does

One long homepage, anchored in place rather than routed:

- Hero with a Season 1 / 2027–28 framing, a countdown to a proposed 11 December 2027 regional, and the McKinney build-day cut-out (2024).
- Audience strip, proposed fees ($100 / $50 / $75 / $0 waiver), a six-step season, AI and robotics tracks, age divisions (Discover 6–9, Junior 9–12, Senior 13–17), values, a proposed competition calendar, awards, FAQ, founders, a partner list (WAAW Foundation and Glappy Foundation), sponsor tiers, and the interest form.
- Header links scroll to page sections. Header actions are “Sponsor” and “Register interest”.
- Footer links scroll on-page. Contact is `info@afrobot.org` plus the city line “Dallas, Texas”. No street address is published. No privacy, terms, child-safety, accessibility, volunteer, partnership, or social URLs exist.
- Preview switches live in `script.js`: `?static`, `?header=none`, `?font=poppins`, `?logo=`, `?accent=blue`, `?bg=bone`, `?hero=photo`.

Real media already in `assets/` should be treated as licensed program photography, not as stock to replace with invented scenes: McKinney build day and AI track (2024), founder portraits, logo and favicon lockups, Open Graph image. Fonts are self-hosted (Outfit, Inter, Space Grotesk, Poppins) under the SIL Open Font License.

The official lockup is `assets/logo-afrobot.svg`: H3 cut-out icon plus a one-colour “afrobot” wordmark in ink `#0E0F12`. The reversed file is for the ink footer. Clay is already documented as an accent only.

## Interest capture (preserve)

`#interest` posts JSON to `/api/interest`.

Fields, and the API contract they must keep:

| Field | Required | Notes |
| --- | --- | --- |
| name | yes | 2–120 characters |
| email | yes | checked with the same shape on client and server |
| role | yes | `Parent/guardian`, `Student`, `School/educator`, `Volunteer/mentor`, `Sponsor/partner`, `Other` |
| city | yes | city and state, free text |
| organization | no | |
| kids | no | stored only for Parent/guardian and School/educator |
| message | no | up to 2000 characters |
| consent | yes | contact by email |
| website | honeypot | a filled value is accepted as success and not stored |
| t | hidden | client timestamp; submits faster than 2.5s are dropped the same way |
| page | hidden | URL, added by the client |

Storage is a private Vercel Blob object under `submissions/`, using `BLOB_READ_WRITE_TOKEN`. If `GOOGLE_SERVICE_ACCOUNT_JSON` and `SHEET_ID` are set, the same row is appended to a sheet; a sheet failure does not fail the request. Export and delete require `Authorization: Bearer $INTEREST_EXPORT_TOKEN`.

The client shows field errors, a status message, and a sent state that hides the fields. `[data-sponsor]` pre-selects `Sponsor/partner`.

Nothing in Phase 1 should replace this endpoint, add a second store, or change export auth.

## What to preserve

- The Blob-backed interest API, its validation, honeypot, and sheet fallback.
- Field names, role strings, and consent behavior.
- The logo files, favicon, Open Graph image, self-hosted fonts, and the 2024 photographs and build-day video, with captions that keep them in 2024.
- Preview switches, reduced-motion handling, skip link, and the steel / clay / Outfit / Inter visual system.
- `vercel.json`, production branch behavior, and environment variables. Do not print or invent secrets.
- Founder names and the fact that AfroBot is a program of Glappy Foundation. Dr. Okorafor’s affiliation with WAAW Foundation can stay on About as an affiliation. It should not be presented as a public partner logo wall.

## What the baseline over-claims

The README calls dates, partners, and costs proposals. The page still shows a countdown, city-by-city events, fee cards, award names, and scholarship language (“will be announced”). Those specifics are not confirmed offerings. Phase 1 removes them from the public homepage rather than restyling them.

Also absent, and still absent after Phase 1 except as labeled stubs: accounts, child profiles, payments, a program directory with real dates, a published partner roster, and a legal opinion on tax-deductible gifts. Glappy Foundation’s 501(c)(3) standing is unconfirmed, so the site must not claim deductibility.

## Technical debt

- CSS is a single file layered from “v2” through “v27”. Later rules cancel earlier ones. There was no token file that new pages could share.
- There is one HTML document, so a second page would have copied the header by hand.
- No automated check for contrast, broken links, banned claims, or the form contract.
- `Student` is a public role on a form that also has a free-text kids field. That is legal only if a parent is the person we expect, and it is a poor fit for a kids-only program. Phase 1 keeps the option so the API contract stays stable, and tells anyone under 18 to have a parent submit.
- Optional Google export and the Blob store are production data paths. Local and preview tests must not write real submissions.
- The mobile sticky control and reveal-on-scroll script assume homepage nodes. New pages have to tolerate missing nodes, which the script mostly already does.
- `#8E9099` (`--ink-40`) on steel `#E6E8EA` is about 2.6:1. It is not acceptable for text. Labels need `--ink-60` (`#5A5D66`, about 5.4:1) or darker. Brand clay `#E2461E` on steel is about 3.3:1, so it can be a rule or a large graphic, not small text. Small clay text should use `#AD3210` (about 5.3:1 on steel). White on deep clay `#BF3712` is about 5.6:1.

## Implications for later phases

Phase 2 can add a real directory only when a program has a true schedule. Until then, cards stay “coming soon”. Phase 3 (accounts, child profiles, consent, RBAC) should not start in the UI until privacy and safeguarding tests exist. The public site should never grow a child profile page. Phases 4 and 5 depend on that privacy boundary and on not inventing impact numbers.
