# Phase 1 verification

Draft only. Nothing was merged, and production was not deployed or promoted. `vercel.json` was not changed.

## Files changed

New:

- `tokens.css`, `components.css`
- `src/layout.html`, `src/partials/` (header, footer, interest form, community roles)
- `src/pages/` for the homepage and the fifteen other routes
- `scripts/build.mjs`, `scripts/lint.mjs`
- `docs/transformation/` (assessment, sitemap, design-content plan, backlog, risks, this note)
- Generated HTML at the repo root: `index.html`, `about.html`, `programs.html`, `competitions.html`, `university-pathways.html`, `community.html`, `partners.html`, `events.html`, `contact.html`, `privacy.html`, `terms.html`, `child-safety.html`, `accessibility.html`, `volunteer.html`, `partnership.html`, `social.html`

Edited:

- `styles.css` now imports `tokens.css` instead of repeating the first token block
- `script.js` keeps the interest form, logo previews, and mobile menu, and adds intent notes, current-page state, and Escape to close the menu
- `package.json` adds `site:build` and `site:lint` (not `build`, so a host that auto-runs `npm run build` does not gain a new production step)

Unchanged on purpose:

- `api/interest.js`, `api/interest-export.js`, `api/_lib.js`
- `vercel.json`, fonts, logo files, and the 2024 photographs and video

## What was tested

- `npm run site:build` writes the sixteen pages. `npm run site:lint` passed: one `h1` per page, required homepage lines, form fields match the API roles, internal links resolve, and the banned-claim checks (partners, tax status, street address, unconfirmed years, percentages, prices other than the `$100` participation goal) are clean. `node --check` passed on the site script, the API files, and the build and lint scripts.
- Every page returned HTTP 200 from a local static server (`python3 -m http.server`).
- Desktop (1440) and mobile (390) screenshots of the homepage. The wide layout shows the five stages in a row. The narrow layout stacks them on a vertical rail. Header actions are Join the Community and Sponsor a Student. The mobile menu lists the eight destinations plus both actions, and Escape closes it (checked in the browser debugger).
- Interest form, against the local server so nothing was written to the production Blob store:
  - Empty submit reports name, email, role, city, and consent, and sets `aria-invalid` on the name field.
  - A bad email is rejected after the other fields are valid.
  - “Ask about financial assistance” sets role to Parent/guardian, explains that no financial documents are wanted, and does not add a file upload.
  - Mentor sets Volunteer/mentor and the screening note. Sponsor sets Sponsor/partner.
  - A fully filled submit posts to `/api/interest` and, with no local function running, shows the existing failure message and does not mark the form sent.
- A recorded browser pass scrolled the homepage (photo, journey, program cards, the $100 participation goal, the final call to action), repeated the assistance note and the empty-form errors, opened Child Safety and Privacy, and opened the hamburger menu at about 390px. No overlapping type or missing headline showed up in that pass.

Contrast used for new text was checked in the linter: ink on steel about 15.6:1, ink-60 on steel about 5.4:1, clay text `#AD3210` on steel about 5.3:1, white on deep clay about 5.6:1. Brand clay `#E2461E` is used for rules and large marks, not for small text. `--ink-40` is not used for new text on steel.

## Known issues

- The interest API was not executed against Vercel. A successful local post would risk writing to the production store if a Blob token were present. Client validation and the unchanged server contract were what this pass covered.
- There is no Vercel preview URL from this session. The pull request is a draft. Do not merge it and do not promote a deployment.
- Stub pages (privacy, terms, child safety, partners, social, and parts of about, programs, events, and pathways) are marked content pending. They are not finished policies.
- The 2024 build-day video has no full audio description. The events page says so, and the clip does not autoplay.
- The mobile “Join the community” bar still covers the bottom of the viewport while you are between the hero and the form, which is the previous sticky-button behavior.
- `Student` remains a role on the form so the API contract stays the same. The page tells anyone under 18 to have a parent submit. That is not a technical block.
- Preview query switches (`?accent=blue`, `?bg=bone`, `?logo=`, `?font=poppins`, `?hero=photo`, `?static`) are still in `script.js`. They were not re-tested one by one.
- A full WCAG audit was not commissioned. The target is 2.2 AA. Keyboard access, focus, form errors, contrast tokens, reduced-motion CSS, and the non-autoplaying video were checked. An audit date is not claimed.

## Next tasks

See `backlog.md`. The next product step is Phase 2, a public directory, and only for programs a person has confirmed are real. Phase 3 (accounts, child profiles, consent, RBAC) stays blocked until privacy and safeguarding reviews exist. This draft should stay a draft until the owner says otherwise.
