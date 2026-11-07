# Sitemap and navigation

Information architecture for the community opportunity platform. Paths below are the clean URLs Vercel already serves (`cleanUrls: true` in `vercel.json`). Source files live at the repository root as `name.html` so a local static server resolves them too. Internal links use the `.html` form for that reason. Canonical tags use the clean path on `https://afrobot.org`.

No new redirects were added.

## Header

Left: existing one-colour AfroBot wordmark, linking home.

Primary navigation, in this order:

| Label | URL | Role of the page |
| --- | --- | --- |
| Home | `/` | Journey from access to advance, interest form |
| About | `/about` | Program, Glappy Foundation, founders, values |
| Programs | `/programs` | Access plus Discover, Build, Innovate, Compete, Advance |
| Competitions | `/competitions` | Preparation for outside competitions; non-affiliation |
| University Pathways | `/university-pathways` | Further learning without admission promises |
| Community | `/community` | Parents, students, mentors, sponsors, schools, manufacturers |
| Partners | `/partners` | Public roster. Empty on purpose until someone agrees to be named |
| Events | `/events` | Only confirmed events. Today: McKinney 2024 as past, nothing upcoming |

Header actions, in this order:

1. **Join the Community** → home interest form (`index.html?intent=join#register`)
2. **Sponsor a Student** → same form, sponsor intent (`index.html?intent=sponsor#register`)

The mobile menu repeats the eight links and both actions. It is a `<button>` with `aria-expanded` and `aria-controls`, closes on Escape, and scrolls inside the viewport.

## Homepage sections

In order, after the header:

1. Hero
2. Talent Is Everywhere. Opportunity Isn’t.
3. From Curiosity to Opportunity (five stages)
4. Find Your Starting Point (five programs)
5. World-Class Opportunities. Community-Friendly Costs.
6. From Our Community to the Competition Stage.
7. The Journey Doesn’t End With a Robot.
8. It Takes a Community to Build the Future.
9. Success Is Measured in Opportunity.
10. Final call to action, then the existing interest form
11. Footer, including the tagline

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
