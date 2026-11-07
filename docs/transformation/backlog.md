# Backlog

Phases 1–5. Phase 1 is the work in this branch. Later phases are not started. Each item lists what it depends on and how to know it is done.

## Phase 1 — Homepage, navigation, honest stubs

Depends on: nothing in the product. Must not depend on a new vendor, a new datastore, or a DNS change.

| Item | Acceptance |
| --- | --- |
| Baseline notes in `docs/transformation/` | Assessment, sitemap, design plan, backlog, and risks exist and match the repo |
| Design tokens and shared header, footer, form, role list | New pages use the partials. Logo, type, and clay rules match the design plan |
| Homepage sections in the required order, with the required lines | A reader can move Access → Discover → Build → Compete → Advance without meeting a fake date, fee, partner, or metric |
| Program cards | Five programs, guidance ages, dates coming soon, no live price except the $100 participation goal |
| Header and footer | Labels and order match `sitemap.md`. Stub pages say they are pending |
| Interest form | Still posts to `/api/interest` with the same fields and roles. Intent only prefills role and message. Assistance path asks for no financial documents |
| Competitions | Do not name a competition brand. Interest is not team placement |
| Safeguarding copy | Students are parent-managed. No public child profile. Mentors require screening |
| Giving | Sponsorship inquiry language. No tax-deductibility claim |
| Quality bar | `npm run site:build` and `npm run site:lint` pass. Keyboard, reduced motion, and the form’s error states work on desktop and mobile widths |
| Release | Pull request stays a draft. `main` and `vercel.json` are unchanged |

## Phase 2 — Public program directory and inquiry forms

Depends on: Phase 1 routes and the interest API. Depends on a human confirming any program that is marked open. Blocked if the only data is still “coming soon”.

| Item | Acceptance |
| --- | --- |
| Directory model | A program can be unpublished, interest-only, or open. Open requires a real schedule, place, and price or a real “no fee” decision |
| Public directory | Lists only programs in interest-only or open. No placeholder dates rendered as events |
| Inquiry binding | The existing form can name the program in the message, or a new optional field is added on both client and server and in the export columns together |
| Assistance inquiry | Separate intent, still no document upload and no income fields |
| School / manufacturer / sponsor variants | Same store, distinct intent text, no public logo |
| Editorial checklist | A second person can tell an open program from a draft. Lint or review rejects banned partner names and unconfirmed prices |
| Out of scope | Accounts, payments, team assignment |

## Phase 3 — Parent accounts, child profiles, consent, RBAC

Depends on: written privacy and child-safety policies that have passed a safeguarding review. Depends on Phase 2 only for knowing which programs exist. **Do not build the account UI until those tests exist.** This phase is gated.

| Item | Acceptance |
| --- | --- |
| Threat model | Document who can see a child’s name, age, school, and work. Default is parent and assigned staff. Nothing is public |
| Consent | A parent account is the only way to create a child record. The record stores the minimum needed to run a program. No public profile URL |
| RBAC | Roles such as parent, screened mentor, and staff are explicit. A mentor cannot open a child record before screening is recorded |
| Student login | Not offered to children under 13. Older students, if ever given access, use a parent-managed account |
| Tests that gate release | Privacy review recorded. Safeguarding review recorded. Automated tests show a child record 404s for anonymous users and for unscreened mentors |
| Data rights | A parent can request export and deletion. The path is tested |
| Out of scope | Public portfolios, leaderboards, behavior tracking |

## Phase 4 — Student development

Depends on: Phase 3 consent and RBAC in production, not only in a design. No Phase 4 feature may store a child’s work in a public bucket.

| Item | Acceptance |
| --- | --- |
| Private progress | A parent can see attendance or project notes for their own child |
| Mentor notes | Visible to the parent and to screened mentors on that program |
| No guarantees | Copy cannot promise scholarships, selection, or admission |
| Competition prep | Links out to the organizer. Does not imply AfroBot placed the student on a team |
| Audit | Staff can see who opened a child record |

## Phase 5 — Sponsorship and impact

Depends on: Phase 1 measurement language, a counsel decision on tax status, and Phase 3 if a sponsored place is tied to a named child. A sponsor must not receive a child’s profile by default.

| Item | Acceptance |
| --- | --- |
| Inquiry to commitment | Sponsorship stays an inquiry until a human confirms it. No card checkout in the first release |
| Tax language | Deductibility is stated only if counsel confirms standing. Until then the site stays on “sponsorship inquiry” |
| Restricted data | Sponsors see aggregate opportunity measures, not names, photos, or free-text family notes |
| Impact page | Numbers appear only with a published method and a date. Zero is allowed. Invented totals are not |
| Financial assistance | Still no document upload. A staff workflow can record “assistance requested” without storing bank or tax files |

## Suggested order

1. Finish and get owner approval on the Phase 1 draft.
2. Confirm at least one real program, or explicitly keep the directory interest-only (Phase 2).
3. Commission privacy and safeguarding reviews (gate for Phase 3).
4. Only then design accounts.
5. Student development and sponsorship reporting follow the privacy model, not the other way around.
