# AfroBot website

Static site for **AfroBot**, a national youth program in AI agents and robotics.
Born from the African diaspora. Built for every kid who's been left out of tech.

Concept preview: dates, partners and costs on the site are proposals.

## Structure
- `index.html`, `styles.css`, `script.js`: the whole site. No build step.
- `assets/`: logo and favicon SVGs (official lockup: H3 "Cutout" icon + single-colour "afrobot" wordmark, `logo-afrobot*.svg`; source files in the brand kit. `og-image.png` and `apple-touch-icon.png` are the social and home-screen images).
- `fonts/`: self-hosted Outfit (headings), Inter (body) and Space Grotesk, all under the SIL Open Font License (licence files included).

## Run locally
Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Deploy
Deployed on Vercel as a static site from the repository root (`vercel.json`). Pushes to `main` deploy to production.

## Preview switches
- `?static` turns off scroll animations.
- `?header=none` plain paper header (default: bone with a thin clay rule). No full clay backgrounds: clay is accent only.
- `?font=poppins` headline font preview.
- `?logo=e1|d2|a|b|c` archived logo directions (e1 = previous E1 icon + Space Grotesk lockup).
- `?accent=blue` preview with Cobalt #1E4BD2 accents instead of clay (default: clay). Blue share image: `assets/og-image-blue.png` (not wired to the meta tags).
- Default background is steel #E6E8EA (subtle brushed streaks), alternate sections #F1F2F4, lines #CDD2D8, steel header with the clay rule. `?bg=bone` previews the previous bone/paper theme.
