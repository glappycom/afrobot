# AfroBot website

Static site for **AfroBot**, a national youth program in AI agents and robotics.
Born from the African diaspora. Built for every kid who's been left out of tech.

Concept preview: dates, partners and costs on the site are proposals.

## Structure
- `index.html`, `styles.css`, `script.js`: the whole site. No build step.
- `assets/`: logo and favicon SVGs (official logo: E1 "Glow"; source files in the brand kit. `og-image.png` and `apple-touch-icon.png` are the social and home-screen images).
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
- `?header=bone|deep` toned-down header options; `?header=none|green|green-signal|blue` older mocks (default: clay).
- `?font=poppins` headline font preview.
- `?logo=d2|a|b|c` archived logo directions.
