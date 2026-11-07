# Design and content plan

## Brand

| Token | Value | Use |
| --- | --- | --- |
| Heading face | Outfit, weight 900 (Black) | Headlines only |
| Body face | Inter | Text, navigation, forms |
| Ink | `#0E0F12` | Text and the one-colour wordmark |
| Ink 80 | `#2B2D33` | Secondary paragraphs |
| Ink 60 | `#5A5D66` | Labels and notes. About 5.4:1 on steel |
| Clay | `#E2461E` | Rules, focus rings, large marks. Not small text |
| Clay text | `#AD3210` | Links and small accents. About 5.3:1 on steel |
| Deep clay | `#BF3712` | Button fill with white text. About 5.6:1 |
| Steel | `#E6E8EA` | Page background |
| Steel card | `#F1F2F4` | Alternate bands |
| Bone | `#F3EEE5` | Light button on ink |
| White | `#FFFFFF` | Text on ink and on deep clay |

Wordmark: keep `assets/logo-afrobot.svg` on light surfaces and `assets/logo-afrobot-reversed.svg` on the footer. Do not recolor the wordmark with clay, and do not introduce a second lockup.

Clay never fills a page section. Ink bands may carry a 4px clay rule.

The existing preview switches stay (`?accent=blue`, `?bg=bone`, `?logo=`, `?font=poppins`, `?header=none`, `?hero=photo`, `?static`).

## Components

New shared pieces, styled in `components.css` and fed by `tokens.css`:

- Two-row header (wordmark and actions, then the eight links) and a scrollable mobile menu
- Journey: five stages, columns on wide screens, a vertical rail under 1000px
- Program card: name, guidance age, short description, schedule, price, registration
- Cost pillars and a goal note that cannot be mistaken for a price table
- Role cards for the six community paths
- Measure list with no figures
- Final ink band
- Interior page hero, prose, pending note, pull quote, callout
- Interest form partial, including a live region for the intent note

Buttons keep the existing `.btn` sizes. Header actions are at least 44px tall. Footer links are at least 44px. Focus uses a 2px clay outline. Motion is limited to hover and the existing reveal script, and `prefers-reduced-motion: reduce` removes transitions, smooth scroll, and autoplay. The build-day video does not autoplay; it has controls and a text description.

## Homepage copy

Required lines, in order:

1. Headline: “Every Child Deserves a Chance to Build the Future.”
2. Support: “Affordable robotics, AI, and engineering education that helps young people move from curiosity to creation, from local communities to recognized competitions, and from limited access to meaningful opportunity.”
3. Actions: Join the AfroBot Community, Explore Programs, Sponsor a Student.
4. “Talent Is Everywhere. Opportunity Isn’t.” No statistics.
5. “From Curiosity to Opportunity.” Stages Access, Discover, Build, Compete, Advance, each a link.
6. “Find Your Starting Point.” Discover (suggested ages 5–8), Build (9–12), Innovate (12–15), Compete (eligibility set by the competition), Advance (15–18). Ages are guidance. Schedule, price, and registration read as coming soon / register interest.
7. “World-Class Opportunities. Community-Friendly Costs.” Shared equipment, sponsored places, volunteer mentors, and grants. An entry workshop around $10 is a goal, never a current price. Financial-assistance inquiry collects no financial documents.
8. “From Our Community to the Competition Stage.” AfroBot aims to prepare students for established competitions such as FIRST Tech Challenge. The page says AfroBot is not affiliated with FIRST. The interest list is not team placement.
9. “The Journey Doesn’t End With a Robot.” Includes “AfroBot helps students build more than robots. We help them build futures.” No guarantee of admission or scholarships.
10. “It Takes a Community to Build the Future.” Separate paths for parents, students (parent-managed), mentors (screening required), sponsors, schools and universities, and manufacturers.
11. “Success Is Measured in Opportunity.” Describes future measures. Shows no numbers.
12. “The Future Is Being Built. Let’s Make Sure Every Child Has a Place in It.” Actions: Join AfroBot, Become a Mentor, Sponsor Opportunity.
13. Tagline: “From Curiosity to Creation. From Community to the World.”

Hero photograph: the existing McKinney 2024 cut-out, captioned as that day. It is not a current event listing.

## Voice

Plain and specific. Say when something is not open, not affiliated, or not a promise. Do not use a statistic, a date, a scholarship, a partner logo, or a dollar figure unless this plan allows it. The only dollar figure allowed on the marketing pages is the $10 workshop goal, in a sentence that calls it a goal.

Do not claim that gifts are tax-deductible. Call giving a sponsorship inquiry.

Do not name UT Dallas, WhalesBot, K-Scale, Zeroth, LEGO, NSBE, venture firms, or universities. Do not treat FIRST as a partner. Do not use Disney or Baymax imagery or names.

## Content states

Three labels used in the interface:

- **Coming soon / register interest** — the program shape is described, and registration is not open.
- **Content pending** — the page exists so navigation is honest, and the body is not a finished policy or history.
- **Past** — used only for the McKinney 2024 photographs and video, which are already in the repo.

## Accessibility

Target WCAG 2.2 AA.

- One `h1` per page. Section titles are `h2`.
- Skip link, `lang="en"`, landmarks, visible focus, keyboard menu.
- Form errors are tied to fields with `aria-describedby` and a status message.
- Contrast pairs used for new UI are the ones that pass in `assessment.md`. `--ink-40` is not used for text on steel.
- The 2024 video is user-started. A caption next to it describes the scene. A fuller audio description is still a gap.
- No information is conveyed by color alone: links are underlined or sit in a card with a text label.

## Implementation shape

`tokens.css` holds the custom properties. `styles.css` imports it and keeps the existing component CSS. `components.css` holds the new patterns. `src/partials` and `src/pages` are assembled by `scripts/build.mjs` into root HTML files. Those HTML files are what Vercel serves. The script is named `site:build`, not `build`, so a host that auto-runs `npm run build` does not gain a new production step. `vercel.json` stays as it was.
