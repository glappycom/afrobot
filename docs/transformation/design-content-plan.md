# Design and content plan

## Brand

| Token | Value | Use |
| --- | --- | --- |
| Type | Public Sans, self-hosted WOFF2 | One sans. Headlines are heavy. Body is at least 18px |
| Ink | `#142033` | Text on white. About 16:1 |
| Orange | `#B9380F` | Buttons, links, and the call-to-action band. White text on it is about 5.8:1. Hover is `#8C2A0A` |
| Orange | `#B9380F` | The only accent, including age labels and the price underline. About 5.9:1 on white |
| White | `#FFFFFF` | Page background |
| Danger | `#9A3412` | Form errors |

Wordmark: keep `assets/logo-afrobot.svg` on white and `assets/logo-afrobot-reversed.svg` on the navy footer. Do not recolor the wordmark, and do not introduce a second lockup.

Deep orange fills buttons, links, and the main call-to-action band. Blue is only for small labels. Headlines stay left-aligned and heavy. Focus is a 2px near-black outline. There is no sticky mobile bar.

The header is one row: For Parents, For Community Leaders, For Partners, About, and a Get updates button. The mobile menu repeats those links.

Buttons and header actions are at least 48px tall. The build-day video does not autoplay; it has controls and a text description.

## Homepage copy

The homepage is short. Headline: “A place for kids to build robots and keep asking questions.” Say what AfroBot is (hands-on robotics and AI for kids, community-run) and that future sessions are being prepared. Primary action for parents: “Get session updates.” Secondary: “Ask about hosting” and “Talk about supporting AfroBot.”

Audience cards sit near the top: For Parents, For Community Leaders, For Partners.

“McKinney Build Day” uses facts already in the repo. “Affordable sessions” states a $100 participation goal. Do not say what the $100 covers. The homepage status is “Dates coming soon,” once, beside the updates button.

Do not publish the scaffolding lines “This page does not invent a statistic…”, “That line is a direction, not a promise”, or “This section has no counts and no percentages.” Do not keep an empty “Success Is Measured in Opportunity” section.

The McKinney photograph is the original, served as AVIF and WebP with width and height. It is not the background-removed cutout.

## Voice

Plain and specific. Say when something is not open, not affiliated, or not a promise. Do not use a statistic, a date, a scholarship, a partner logo, or a dollar figure unless this plan allows it. The only dollar figure allowed on the marketing pages is the $100 participation goal, in a sentence that calls it a goal.

Do not claim that gifts are tax-deductible. Call giving a sponsorship inquiry.

Do not name UT Dallas, WhalesBot, K-Scale, Zeroth, LEGO, NSBE, venture firms, universities, or a competition brand. Do not use Disney or Baymax imagery or names.

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
