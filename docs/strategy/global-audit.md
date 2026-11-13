# Global identity audit

Audit of afrobot.org before the public-identity enhancement. Source of truth is `src/pages`, `src/partials`, `scripts/build.mjs`, `content/impact.json`, and `scripts/lint.mjs` on `main` at `3033f64`.

## What the site is today

The public site is a static build. `scripts/build.mjs` compiles `src/pages/*.html` with shared header, footer, roles, and the interest form into root HTML files. Vercel `cleanUrls` serves them without `.html`.

The voice is a kids-only robotics and AI program preparing a 2027 season. Cameroon appears as program history and a Yaoundé hub. The United States appears as a McKinney 2024 pilot and a Dallas–Fort Worth 2027 target. The home page still leads with “Every Child Deserves a Chance to Build the Future.”

## Routes

| File | URL | Role |
| --- | --- | --- |
| index.html | / | Home |
| programs.html | /programs | Age path Discover through Advance, camp-week cost |
| competitions.html | /competitions | 2027 footprint: DFW and Yaoundé; 8-team pilot |
| events.html | /events | McKinney 2024 and the same 2027 hubs |
| about.html | /about | Legal home, founders, Cameroon counts, values |
| partners.html | /partners | Named schools and sponsor goals |
| partnership.html | /partnership | Partnership form |
| community.html | /community | Interest form |
| mentorship.html | /mentorship | Mentor page and form |
| volunteer.html | /volunteer | Same form, posts to `/api/volunteer` |
| university-pathways.html | /university-pathways | Advance / older students |
| contact.html | /contact | info@afrobot.org |
| privacy, terms, child-safety, accessibility, social | matching paths | Policies |

No routes yet for USA, Africa, Impact, Moonshot, global collaboration, or a challenge.

## Navigation

Desktop row: Programs, Events, Volunteer, Partners, plus Sponsor a Student. The menu is one row. About and Contact sit in the mobile footer only. Nothing is under a “More” menu. Lint enforces that.

Site footer: Programs, Events, About, Mentorship, Contact, policies, info@afrobot.org, tagline “From Africa to the World.”

## Components worth keeping

- Graphite `#1E2326`, yellow `#F6C445`, CTA blue, Outfit and Public Sans, navy and reversed logos.
- Home close: Parents, Mentors, Community rows, one white gap, yellow Sponsor a Student band, graphite footer.
- Impact strip: two large numbers side by side.
- Age path: Discover 6–9, Build 9–12, Innovate 13–17, Compete 13–17, Advance 13–17.
- Season block and competitions copy: 90 students, 15 teams, 8-team pilot, Yaoundé hosted by AfroBot.
- Registration interest form and volunteer form.

## Forms and where they post

`src/partials/register.html` is `POST /api/interest` with name, email, role, city, organization, kids, message, consent, and a website honeypot. Roles must match `api/_lib.js`.

- community.html, mentorship.html, and partnership.html include that form.
- volunteer.html is the same form with the action rewritten to `POST /api/volunteer`.
- programs.html has a journey finder that only writes a sentence on the page. It does not post.

## Roadmap content already published

- McKinney Build Day, 2024.
- 2027 targets: Dallas 90 students and 15 teams, labeled proposed targets on the home page.
- 2027 hubs: Texas (Dallas–Fort Worth) and Cameroon (Yaoundé, hosted).
- First season: an 8-team pilot, about 8 students plus coaches.
- Camp week: a $100 participation goal. A $10 workshop is described as a hope, not today’s price.
- Sponsor goals: $100, $1,000, $5,000, $10,000, $25,000, each labeled a goal.

The assignment’s US city list (August 2027 start; DC/Maryland, Atlanta, Houston, DFW; Dallas championship April 2028) is not on the site. It has to be labeled Proposed.

## Counts

`content/impact.json` holds 5,000 trained, 1,500 ongoing, 4 years, and the Dallas 2027 targets. About says “about 5,000” and “about 1,500.” McKinney headcount of about 30 is documented in content/facts.json. None of these counts are marked verified.

## Keep

Brand, logos, tagline, forms, age divisions, camp-week and sponsor goals, child-safety rules, the published 2027 season wording, the home audience rows and close, and photos already on the site.

## Gaps

- No page treats Cameroon as the operating base and the US as a pilot plus a proposed season.
- No single lead line for a two-continent organization.
- Partners names schools in public. The new brief says not to list named partners until approved.
- No Impact, Moonshot, Africa, USA, collaboration, or challenge pages.
- 2028 is banned by lint as an unconfirmed year. The brief now asks for an April 2028 championship labeled Proposed.
