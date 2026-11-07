# Sitemap and navigation

Information architecture for the community opportunity platform. Paths below are the clean URLs Vercel already serves (`cleanUrls: true` in `vercel.json`). Source files live at the repository root as `name.html` so a local static server resolves them too. Internal links use the `.html` form for that reason. Canonical tags use the clean path on `https://afrobot.org`.

No new redirects were added.

## Header

Left: existing one-colour AfroBot wordmark, linking home.

Primary navigation, in this order:

| Label | URL | Role of the page |
| --- | --- | --- |
| For Parents | `/#parents` | Session updates for parents and guardians |
| For Community Leaders | `/#leaders` | Ask about hosting |
| For Partners | `/#partners` | Talk about supporting AfroBot. Not the empty partner directory |
| About | `/about` | Program, Glappy Foundation, founders, values |

One header action: **Get updates** → home interest form (`index.html?intent=updates#register`).

Programs, Competitions, University Pathways, Community, Events, and the empty Partner list stay in the footer. Social stays in the footer. They are not in the header.

The mobile menu repeats the eight links and both actions. It is a `<button>` with `aria-expanded` and `aria-controls`, closes on Escape, and scrolls inside the viewport.

## Homepage sections

In order, after the header:

1. Headline and a short description of AfroBot
2. Audience cards: For Parents, For Community Leaders, For Partners
3. What happened in McKinney in 2024, with the original photograph
4. Affordable sessions, with the $100 participation goal
5. One note that sessions are not open
6. The existing interest form
7. Footer

Stage links:

| Stage | Goes to |
| --- | --- |
| Access | `/programs#access` |
| Discover | `/programs#discover` |
| Build | `/programs#build` |
| Compete | `/competitions` |
| Advance | `/university-pathways` |

## Footer

| Label | URL |
| --- | --- |
| Contact | `/contact` |
| Privacy | `/privacy` |
| Terms | `/terms` |
| Child Safety | `/child-safety` |
| Accessibility | `/accessibility` |
| Volunteer | `/volunteer` |
| Partnership Inquiries | `/partnership` |
| Social | `/social` |

The footer also repeats the main destinations, `info@afrobot.org`, and the tagline “From Curiosity to Creation. From Community to the World.” No street address is published. No social network URLs are published, because none are confirmed.

## Page status

| Page | Status |
| --- | --- |
| Home | Phase 1 narrative. Programs are interest-only |
| About | Real founders and organizational identity. Longer history not written yet |
| Programs | Five programs described. Schedule, price, and registration are not open |
| Competitions | Position and non-affiliation. No calendar |
| University Pathways | Position only. No institutions named |
| Community | Audience paths into the existing form |
| Partners | Explicitly unpublished roster |
| Events | 2024 McKinney media only. No future dates |
| Contact | Existing interest form |
| Privacy | What the form actually does, plus a pending legal review |
| Terms | Pending legal review. A few boundaries so the form is not mistaken for enrollment |
| Child Safety | Operating rules. Formal policy pending |
| Accessibility | Target and contact. Not a finished audit |
| Volunteer | Screening required. No role catalogue |
| Partnership Inquiries | Same form. Not a checkout and not a tax receipt |
| Social | States that channels are not listed yet |

## Forms

There is still one backend. Pages that collect interest embed the same form partial (`name`, `email`, `role`, `city`, `organization`, `kids`, `message`, `consent`, honeypot). Intent buttons only set the role and an editable message prefix. They do not add fields.
