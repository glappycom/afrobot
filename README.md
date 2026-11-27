# AfroBot website

Static site for **AfroBot**, a national youth program in AI agents and robotics.
Born from the African diaspora. Built for every kid who's been left out of tech.

Concept preview: dates, partners and costs on the site are proposals.

## Structure
- `src/pages` and `src/partials` are the source. `npm run site:build` writes the root HTML files. `npm run site:lint` checks them.
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
- The homepage uses the original McKinney 2024 photograph (AVIF, WebP, and JPEG), not the background-removed cutout. The page background is white. Type is self-hosted Public Sans. The action color is deep orange `#B9380F`.

## Register interest form
- The form (`#interest`) posts JSON to `/api/interest` (Vercel function, `api/interest.js`). It validates fields, drops spam (hidden `website` honeypot, too-fast submits) and stores each submission as a private JSON file in the Vercel Blob store `afrobot-interest` (env `BLOB_READ_WRITE_TOKEN`, added automatically).
- `GET /api/interest-export` with `Authorization: Bearer $INTEREST_EXPORT_TOKEN` returns all submissions (rows match the Google Sheet "AfroBot Interest" columns); `DELETE /api/interest-export?id=<id>` removes one.
- Direct Google Sheet writes switch on when `GOOGLE_SERVICE_ACCOUNT_JSON` and `SHEET_ID` are set and the sheet is shared with the service account email.

## Workbench

Smart Sorter is a browser lesson for students and coaches. It is a page on this site at `/workbench`. It is not linked from the site navigation. A student starts an image project, adds labeled examples, trains a real image classifier in the browser, and watches the result move a simulated flap.

Paper goes to the paper bin. Plastic goes to the plastic bin. No item, a score under 70%, a close call, or a stopped camera returns the flap to Hold. An object that stays in view is sorted once. The flap logic lives in `workbench/src/sorter.js`. The classifier lives in `workbench/src/classifier.js`. A later hardware adapter can send the sorter’s `command` to a servo. This release does not connect a robot.

### Setup

```
git clone https://github.com/glappycom/afrobot.git
cd afrobot
npm install
python3 -m http.server 8000
```

Open `http://localhost:8000/workbench/` in desktop Chrome. Serve the folder. Opening the HTML file directly will not load the lesson. Node 20 or newer is required for the tests.

After changing files in `workbench/src`, rebuild the browser bundle:

```
npm run workbench:build
```

The bundle is committed, so a clone can run the lesson without that step.

### Tests

```
npm run workbench:test
npm run workbench:e2e
npm run site:lint
npm run site:build
```

`workbench:test` checks the sorter rules and trains the classifier on synthetic drawings. `workbench:e2e` runs the lesson in desktop Chrome, including upload, a fake camera, a denied camera, training, and the flap.

### Browser and camera

Use desktop Chrome. The camera needs permission and a secure page (`http://localhost` or `https`). If the camera is blocked, use Upload. Upload accepts JPG and PNG files from the computer. The optional practice button adds illustrated drawings when a class has no objects handy.

The first visit downloads the page and the TensorFlow.js bundle from this website. The first training downloads MobileNet v1 0.25 (about 1.9 MB) from this website. The browser can reuse that file after the first download. No student image is sent anywhere. The optional Gather Samples video is on YouTube and loads only after Play.

### Coach exercise

1. Start an image project and open Smart Sorter.
2. Add at least four examples each of Paper, Plastic, and No item. Use photos, the webcam, or the illustrated practice drawings.
3. Train the model.
4. Test a picture that was not in the training set, then test an empty frame. The empty frame should hold.
5. Find a mistake: a wrong bin, or a confident guess on a confusing object.
6. Remove the misleading example or add clearer ones, train again, and test the same picture.

### Privacy and limits

Examples and predictions stay in the browser tab. Closing the tab clears them. There is no account, no analytics, and no upload. This release has three classes, one simulated flap, and no saved projects. Google Drive, public model links, extra export formats, and a physical servo are not part of the lesson.

Dependencies and image credits are in `workbench/THIRD_PARTY.md`.
