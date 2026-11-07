# Risks

## Children and privacy

The program is for minors. The interest form is for adults: the name field is labeled “Your name (adult)” and the `Student` role is no longer accepted by the page or the API. A free-text “kids” field remains optional for parents and educators, and asks for ages rather than a full date of birth. Copy tells anyone under 18 to have a parent or guardian submit, and asks people not to send a school ID or financial documents.

Risk: a child submits anyway, or a parent writes a full name and school in the message. Mitigation now: the note, the parent-managed student path, and private Blob storage. Residual risk: staff must treat submissions as confidential. Phase 3 cannot ship child profiles until privacy and safeguarding tests pass. Public profiles are out of scope permanently.

The 2024 photos show children. They were already published. Phase 1 does not add new child photography, does not name the children, and does not add a public gallery beyond those existing assets.

## False certainty

The baseline page listed proposed 2027–28 dates, fees, awards, and scholarships. Republishing them as design would keep the same harm: a family could think registration is real. Phase 1 deletes that calendar and those prices. The $10 workshop may appear only as a goal.

Risk: a later edit pastes the old season table back. Mitigation: `npm run site:lint` fails on 2027/2028, on dollar amounts other than `$10`, on percents, and on `$10` if the word “goal” is missing.

## Partners, trademarks, and IP

Naming a company implies an agreement. The public site must not list UT Dallas, WhalesBot, FIRST as a partner, K-Scale, Zeroth, LEGO, NSBE, venture firms, or university logos. FIRST Tech Challenge may be mentioned only with the sentence that AfroBot is not affiliated with FIRST. Lint requires that sentence on any HTML file that says FIRST.

WAAW Foundation appears only as Dr. Okorafor’s affiliation. Glappy Foundation appears as the organization that runs AfroBot, not as a sponsor logo.

Disney and Baymax names and imagery are banned. Lint looks for those strings. The humanoid in the logo is the existing AfroBot mark.

## Tax status

Glappy Foundation’s 501(c)(3) good standing is unconfirmed. Calling a gift tax-deductible would be a false statement. Lint rejects deductibility phrasing and “501(c)(3)”.

## Address

A street address with a unit number must not be published. Phase 1 publishes no street address. If a later page must show one, use only the owner-approved Richardson line, with no unit, suite, or apartment added. Lint rejects street fragments, suite, and unit labels in the public HTML.

## Deployment

Production is whatever Vercel builds from `main`. This branch must stay a draft pull request. Do not merge, do not promote, and do not change `vercel.json` or DNS.

`package.json` scripts are `site:build` and `site:lint`, not `build`, so an auto-detected `npm run build` does not become a new production step. Generated HTML is committed and remains the deployed artifact, which matches today’s static setup.

Risk: a preview deployment on the pull request may still be created by the existing Git integration. That is not a production promotion. Do not run `vercel --prod` or an alias assignment.

Risk: a successful test post to `/api/interest` would write into the production Blob store if `BLOB_READ_WRITE_TOKEN` is present. Verification must not do that.

## Accessibility

`--ink-40` fails on steel. New text does not use it. The mobile menu and form errors need a manual keyboard pass each time the header changes. The build-day video has no full audio description yet; the events page says so and does not autoplay.

## Form regression

Shared partials can drift from `api/_lib.js` roles. Lint checks that every role option in the form is one of the server roles, and that the honeypot and consent field remain. Client and server email checks are still separate copies and can drift; Phase 1 does not rewrite the server.

## Scope of “community platform”

Accounts, directories of real programs, and impact numbers are easy to fake in a redesign. The backlog gates them. Shipping a login form or a child profile in Phase 1 would create data we are not ready to protect.
