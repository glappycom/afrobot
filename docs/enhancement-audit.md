# Enhancement audit

Base: `main` at `c22482d` (2027 program path, hubs, and sponsor goals). This pass enhances that site. It does not replace the build, the volunteer form, or the Sheets webhook.

## Pages and features now

- Home: hero, audience tiles, planned sessions (Discover, Build, Innovate, Compete, Advance), $100 camp-week goal, McKinney Build Day photo, three program photos, three story videos, adult interest form.
- Programs: Access as a cost theme, the five stages with ages 6–9, 9–12, and 13–17, same $100 goal.
- Competitions: one yearly competition, 2027 hubs in Texas (DFW), Cameroon (Yaoundé), and Tanzania, separate dates, two-way livestream, “Dates coming soon.”
- University Pathways: Advance, older students mentoring with an adult coach, admission and scholarships not guaranteed.
- Partners: sponsor goals (Discover $100 through Advance $25,000, plus in-kind Venue and Host). No named partners. Tax treatment is not stated.
- Volunteer: adults-only form posts to `/api/volunteer`, which forwards to the Google Sheet webhook.
- Events, About, Community, Contact, Privacy, Terms, Child Safety, Accessibility, Social, Partnership inquiries.
- Nav: Programs, Events, About, Volunteer, Partners, and Get updates.

## Design system

- White page, light gray bands (`#F5F6F8`), navy text (`#142033`), orange accent (`#B9380F`).
- Header logo: navy wordmark and orange icon. Footer logo: white on navy.
- Public Sans, self-hosted. Buttons are 48px, orange, line, or inverse.
- Glappy Foundation appears only in the footer copyright.

## Leave untouched

- Volunteer form fields, adults-only note, do-not-send lines, and `/api/volunteer` plus `SHEETS_WEBHOOK_URL` / `SHEETS_WEBHOOK_SECRET`.
- Primary nav labels and the Get updates button.
- The Lighthouse result on the current home (97 performance, 100 accessibility, best practices, and SEO on a gzip server). New sections must not undo that.

## Brief items already met

- 2027 age bands 6–9 and 9–12, and 13–17 through older partner schools. Compete has an age.
- Discover and Build are life-size vehicle builds. Innovate and Compete use humanoid robots. An AI agent is described as the robot’s brain.
- Access is a theme, not a sixth stage. Live stage names stay Discover, Build, Innovate, Compete, Advance.
- Competition hubs, livestream, and “Dates coming soon” are on the Competitions page.
- $100 per child per camp week is already stated as a goal. Sponsor tiers are goals. No tax-deductibility claim.
- Orange is the only accent. No FIRST or vendor names on the public pages.

## Closed on this branch

- Hero, impact figures in `content/impact.json`, Cameroon-to-Dallas timeline, success measures, the $10 illustrative story, a stage line, Dallas 2027 targets, mentorship page, partner categories, affordability band, and a client-side journey finder.
- Live stage names stay Discover, Build, Innovate, Compete, Advance. `?stages=access` previews Access, Discover, Build, Compete, Advance, and that preview has no Innovate card. `content/site.json` `stageNames` can switch the default.
