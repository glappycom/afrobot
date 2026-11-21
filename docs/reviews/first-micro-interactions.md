# Micro-interaction review: FIRST (firstinspires.org) vs AfroBot

Audited 20 Nov 2026 with headless Chromium (Playwright) at 1440×900 and 390×844.
- **FIRST:** home and /robotics/frc. Values come from computed styles, captured before and after a real hover, click or scroll.
- **AfroBot:** the preview URL needs a Vercel login (302), so I audited the `cursor/inner-pages-e878` branch (PR 28) served locally, plus live afrobot.org. Files checked: `home.css`, `inner.css`, `script.js`, `index.html`, `about.html`, `programs.html`.

**Headline finding:** AfroBot's new homepage and inner pages have **no hover, press or transition feedback at all**.
- `home.css` and `inner.css` contain zero `transition` and zero `:hover` rules. The only interactive state is the orange `:focus-visible` outline.
- The header is `position: static`, and the phone menu snaps open with `display` and no animation.
- `script.js` already has hooks with nothing styling them:
  - It adds `.will-reveal`/`.is-revealed` (7 sections on About).
  - It toggles `.nav.is-scrolled`.
  - It has a `[data-count]` counter (560 ms, easeOutCubic).
  - The homepage doesn't load `script.js`, and none of the matching CSS exists.

FIRST isn't flashy either. It's a HubSpot theme with **quick, consistent, colour-led feedback**: 100 ms ease-in on buttons, 250 ms ease-in on nav and cards. That consistency is a big part of why it reads as "serious".

## Pattern table

| Pattern | FIRST (measured) | AfroBot now | Rec. | Impact / effort |
|---|---|---|---|---|
| Primary button hover | bg `#231F20` → `rgba(35,31,32,.7)`, `transition: .1s ease-in`. No lift, no shadow | Nothing changes | **Adapt** (darken + 1px lift + press) | High / Low |
| Outline button hover | transparent → filled `rgba(35,31,32,.7)`, text to white, .1s ease-in | Nothing | **Borrow** (fill navy) | High / Low |
| Text CTA / "Read more" | arrow `::after` slides `translateX(4px)`, .1s ease-in | `.more` has a static orange underline and no hover | **Borrow** arrow nudge + underline grow | High / Low |
| Utility/top-bar links | opacity 1→.8 + underline, .25s ease-in | Nothing | **Adapt** | Low / Low |
| Main nav item hover | parent item gets bg `#E9E9E9`, .25s; caret rotates −180° over .25s | Nothing | **Adapt** (orange underline slide; no caret, since there are no dropdowns) | Med / Low |
| Mega-menu | about 200–250 ms hover-intent delay, then opacity 0→1 over .25s ease-in; programme colour-coded cards (red/orange/blue headers) | No dropdowns (flat nav) | **Skip** for now (only about 7 links). Revisit if nav grows | Low / High |
| Sticky header | `position: fixed`; after scroll primary nav min-height 100→80px (header 140→120), adds `box-shadow: 0 4px 40px rgba(35,31,32,.2)`, `transition: padding .25s ease-in, min-height .25s ease-in`. Stays visible on scroll-up | `static`, so it scrolls away. `script.js` toggles `.nav.is-scrolled` but the element has no `.nav` class and no CSS | **Adapt** (sticky + compact + shadow) | High / Med |
| Card hover (feature cards) | bg `#fff`→`#FDFDFD`, border transparent→`#E3E2E3`, .25s ease-in. No lift | Nothing | **Adapt**, stronger (lift + shadow + image zoom) | High / Med |
| Blog/news card hover | 80% programme-blue overlay `rgba(0,102,179,.8)` fades 0→1 over the photo, .25s ease-in; arrow nudge | Nothing | **Adapt** with a lighter navy tint (≤.35), so kids' faces stay visible | Med / Low |
| Logo/partner wall | img `scale(1.05)` on hover, .1s ease-in | No logo wall shown yet | **Adapt** later, when partner logos go public | Low / Low |
| Tabs ("programs for every age") | active tab: 4px border in programme colour + 8% tint bg (e.g. `rgba(245,126,37,.08)`), .25s ease-in; panel `transform .5s, opacity .5s` | Age cards are static | **Adapt** only if age cards become tabs. Otherwise borrow the "colour bar on active/hover" idea | Low / Med |
| Accordion | summary `::after` icon rotates, `.2s ease-in-out` | `<details>` with no animation | Adapt (rotate chevron 180°, 200 ms) | Low / Low |
| Carousel | Slick slider, 11 slides, 5 dots, autoplay in markup | None | **Skip** (autoplay hurts accessibility and attention) | n/a |
| Scroll reveals | AOS library loaded (`data-aos-duration=1000`, `ease`) but **no elements use it** on home or FRC | JS adds `.will-reveal` on inner pages, but there's no CSS, so nothing happens | **Adapt**, restrained | Med / Low |
| Stat counters | `.number.count` counts up from 0 when scrolled into view, about 2–3 s total (slow) | Static numbers; counter JS exists but no `data-count` attributes | **Adapt** (≈900 ms, once) | Med / Low |
| Focus ring | 2px solid outline, mostly blue, offset −1/−2px (inset); skip link present | 2px solid `#C4461A`, offset 2px. Skip link on inner pages only, **missing on homepage**. Orange on navy is ≈3.0:1 contrast (borderline) | **Adapt** (dual ring on dark bands + homepage skip link) | High (a11y) / Low |
| Mobile menu | hamburger morphs to ×, sequenced: lines collapse .3s, then rotate 45° after a .5s delay (≈0.9s total); off-screen panel visibility, .25s ease-in. **No `aria-expanded`**, no scroll lock | Instant `display:none→flex`. Has `aria-expanded`, Esc-to-close and scroll lock (better a11y than FIRST) | **Adapt** the animation, faster (≈250 ms), and keep our a11y | Med / Low |
| Video play | lightbox trigger icon bg changes, `background-color .3s` | `.video-play__icon` orange circle, no hover | **Adapt** (scale 1.08 + ring) | Med / Low |
| Search overlay | fade .25s ease-in | No search | Skip (small site) | n/a |
| Back-to-top | none | none | Skip | n/a |
| Reduced motion | `@media (prefers-reduced-motion: reduce){*{animation-duration:.001s!important;transition-duration:.001s!important}}` | JS respects it; no CSS block (nothing to reduce yet) | **Borrow + improve** (keep colour changes, drop movement) | High (a11y) / Low |

## Top 8 for AfroBot (navy `#0E2747`, orange `#C4461A`)

Shared tokens to add to `home.css`:

```css
:root{
  --ease-out: cubic-bezier(.2,.7,.2,1);      /* snappy settle */
  --ease-reveal: cubic-bezier(.22,.61,.36,1);
  --t-fast: 160ms; --t-med: 240ms; --t-slow: 480ms;
  --acc-dark:#A63A14;                         /* orange hover, AA with white */
  --shadow-1: 0 2px 6px rgba(14,39,71,.10);
  --shadow-2: 0 12px 28px rgba(14,39,71,.16);
}
```

### 1. Buttons that answer back (hover, press, focus). High impact, low effort
```css
.btn{transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out),
     border-color var(--t-fast) var(--ease-out),box-shadow var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.btn.b1:hover{background:var(--acc-dark);transform:translateY(-1px);box-shadow:0 6px 16px rgba(196,70,26,.28)}
.btn.b3:hover{background:#163A66;transform:translateY(-1px);box-shadow:var(--shadow-1)}
.btn.b4:hover,.btn.b2:hover{background:var(--navy);color:#fff}      /* outline fills, as FIRST does */
.btn:active{transform:translateY(0) scale(.98);box-shadow:none;transition-duration:60ms}
```

### 2. Cards and photo tiles that lift. High, medium
```css
.card,.news article{transition:transform var(--t-med) var(--ease-out),box-shadow var(--t-med) var(--ease-out),border-color var(--t-med)}
.card picture{overflow:hidden}
.card img{transition:transform var(--t-slow) var(--ease-out)}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-2);border-color:transparent}
.card:hover img{transform:scale(1.04)}
.card h3{background:linear-gradient(var(--acc),var(--acc)) 0 100%/0 2px no-repeat;transition:background-size var(--t-med) var(--ease-out)}
.card:hover h3{background-size:100% 2px}
/* optional photo tint (FIRST uses 80% blue; keep faces visible): */
.card picture{position:relative}.card picture::after{content:"";position:absolute;inset:0;background:var(--navy);opacity:0;transition:opacity var(--t-med)}
.card:hover picture::after{opacity:.18}
```
Make the whole card one click target with a stretched link (`.card a.more::before{content:"";position:absolute;inset:0}` on a `position:relative` card).

### 3. Link affordances: arrow nudge and underline grow. High, low
```css
.more{background:linear-gradient(var(--acc),var(--acc)) 0 100%/100% 2px no-repeat;border-bottom:0;padding-bottom:3px;
      transition:color var(--t-fast),background-size var(--t-med) var(--ease-out)}
.more::after{content:"→";display:inline-block;margin-left:6px;transition:transform var(--t-fast) var(--ease-out)}
.more:hover{color:var(--acc)} .more:hover::after{transform:translateX(4px)}
nav ul a{position:relative}
nav ul a::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--acc);
      transform:scaleX(0);transform-origin:left;transition:transform var(--t-med) var(--ease-out)}
nav ul a:hover::after,nav ul a[aria-current="page"]::after{transform:scaleX(1)}
footer a:hover{color:#fff;text-decoration:underline;text-underline-offset:3px}
```

### 4. Sticky header that compacts on scroll. High, medium
```css
nav{position:sticky;top:0;z-index:50;transition:box-shadow var(--t-med) var(--ease-out)}
nav .w{transition:height var(--t-med) var(--ease-out)}
nav img{transition:height var(--t-med) var(--ease-out)}
nav.is-scrolled{box-shadow:0 4px 24px rgba(14,39,71,.12)}
nav.is-scrolled .w{height:64px} nav.is-scrolled img{height:28px}
```
JS: change the existing `document.querySelector('.nav')` to `'nav'`, threshold `scrollY > 20`, passive listener. Load `script.js` (or a tiny inline copy) on the homepage too. The utility bar scrolls away, and only the main nav sticks (FIRST: 140→120px).

### 5. Focus you can see on every background, plus a homepage skip link. High (accessibility), low
```css
:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:2px}
.stats :focus-visible,.season :focus-visible,.util :focus-visible,footer :focus-visible,.hero :focus-visible{
  outline:2px solid #fff;box-shadow:0 0 0 4px var(--acc)}           /* orange-on-navy alone is ≈3:1 */
.btn:focus-visible{outline-offset:3px}
```
Add `<a class="skip" href="#main">Skip to content</a>` to `index.html` (inner pages already have it).

### 6. Phone menu that slides, with the hamburger morphing to ×. Medium, low
```css
@media (max-width:900px){
  nav ul{display:flex;max-height:0;overflow:hidden;opacity:0;transform:translateY(-8px);visibility:hidden;
    transition:max-height var(--t-med) var(--ease-out),opacity var(--t-fast),transform var(--t-med) var(--ease-out),visibility 0s var(--t-med)}
  nav ul.is-open{max-height:80vh;opacity:1;transform:none;visibility:visible;transition-delay:0s}
  .nav-btn i{transition:transform var(--t-med) var(--ease-out),opacity var(--t-fast)}
  .nav-btn[aria-expanded="true"] i:nth-child(1){transform:translateY(7px) rotate(45deg)}
  .nav-btn[aria-expanded="true"] i:nth-child(2){opacity:0}
  .nav-btn[aria-expanded="true"] i:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
}
```
That's 240 ms instead of FIRST's ≈900 ms sequenced morph. Keep our existing `aria-expanded`, Esc and scroll lock, which FIRST lacks.

### 7. Video play button invites a click. Medium, low
```css
.video-play__icon{transition:transform var(--t-med) var(--ease-out),box-shadow var(--t-med) var(--ease-out)}
.video-play:hover .video-play__icon,.video-play:focus-visible .video-play__icon{transform:scale(1.08);box-shadow:0 0 0 8px rgba(196,70,26,.25)}
.video-play img{transition:filter var(--t-med)} .video-play:hover img{filter:brightness(.88)}
```

### 8. Quiet scroll moments: section reveal and stat count-up, once only. Medium, low
```css
.js .will-reveal{opacity:0;transform:translateY(16px);
  transition:opacity var(--t-slow) var(--ease-reveal),transform var(--t-slow) var(--ease-reveal);transition-delay:calc(var(--i,0)*60ms)}
.js .will-reveal.is-revealed{opacity:1;transform:none}
```
The hooks already exist in `script.js`: it only adds classes when JS runs and motion is allowed, so no-JS users and reduced-motion users see content immediately. Put `data-count="5000"`, `"3200"` and `"30"` on the stat numbers; the existing counter runs about 560 ms (raise to ≈900 ms; FIRST's 2–3 s feels sluggish). Don't count the year "2022". Stagger is capped at 6 items, so max delay is 300 ms.

### Reduced motion (applies to all of the above)
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-property:color,background-color,border-color,opacity,box-shadow!important;
    transition-duration:1ms!important;animation:none!important;scroll-behavior:auto!important}
  .card:hover,.btn:hover,.btn:active{transform:none!important} .card:hover img{transform:none!important}
}
```
Colour and shadow feedback stay; movement goes. This is a step past FIRST's blanket `.001s` override.

### Not recommended
- Mega-menu (too few pages).
- Autoplay carousel.
- Search overlay and back-to-top (short pages).
- FIRST's programme colours, logos or imagery.
- Heavy 80% photo overlays, which hide kids' faces.

## Screenshots (`/workspace/afrobot/first-micro/`)
- `first-megamenu-open.png`: FIRST mega-menu after hover-intent delay + 250 ms fade
- `pair-first-blogcard.png`: FIRST news card, before/hover (80% blue overlay)
- `pair-first-header-scroll.png`: FIRST header at top vs scrolled (shrink + shadow)
- `pair-first-stroked-btn.png`, `pair-first-textlink-arrow.png`, `pair-first-logo.png`: FIRST button fill, arrow nudge, logo scale
- `pair-afro-btn.png`, `pair-afro-card.png`: AfroBot before/hover (identical, so there's no feedback)
- `first-mobile-open.png`, `afro-mobile-open.png`: phone menus
- Raw data: `first-*-rules.json`, `first-behav.json`, `*-interact.json`
