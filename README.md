# MHG – Moriones Heritage Guide

An interactive, bilingual (English/Filipino) web-based learning and visitor companion for the Moryonan (Moriones) of Marinduque.
Student project for *Web Systems and Technologies 1*, MarSU BSI/T 3E, group **Ace Attorney**.

> The Moryonan is a religious tradition of penance and vows during Holy Week. It is not a show or a party.
> Content is sourced and the guide says so where sources disagree.

## Status (Week 2 – MVP, extended)
| Core feature | Status |
|---|---|
| 1. Interactive heritage modules (legend, Holy Week timeline, clickable SVG costume glossary, EN/FIL) | Implemented |
| 2. Searchable/filterable directory (12 sourced entries; text search, municipality, category) | Implemented |
| 3. Quiz (8 questions) with saved progress, badges and etiquette checklist | Implemented |
| 4. Plan a visit: choose a day and town, save items to a personal plan, share it as a link (extension) | Implemented |
| 5. Reviewer labels, print mode (extension) | Implemented |
| 6. Interactive 3D Morion mask (original model, Three.js) in the Learn pages | Implemented (v7) |

Not done yet: review of content by local cultural bearers, native-speaker review of the Filipino text, more directory entries,
user feedback/usability testing, deployment to GitHub Pages. See `PROJECT_DOCUMENTATION.md` (Week 2 document) and `docs/TESTING.md`.

## Run locally
**Easiest:** double-click `index.html` (Edge, Chrome or Firefox). The page falls back to `data/content.js` when the browser blocks `data/content.json` on `file://` pages. This was the cause of the "unavailable / not found" error when launching from VS Code.

**Recommended while developing** (always shows the latest `content.json`): serve the folder over HTTP.

### VS Code on Windows (no server needed)
Open this project folder in VS Code, then use either:
- **Run → Start Debugging (F5)** → "MHG in Edge (no server needed)". It opens `index.html` directly in Edge (`.vscode/launch.json`).
- **Ctrl+Shift+P → Tasks: Run Task → Open MHG in Edge** (`.vscode/tasks.json`).
- Or simply double-click `index.html`.

Neither option needs a web server. If you see "localhost refused to connect" (`ERR_CONNECTION_REFUSED`), you are opening a `http://localhost:...` address while no server is running: open the file directly as above instead.

Optional web server: `tools/serve.ps1` serves the folder on `http://localhost:8080` (run `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\serve.ps1` in a terminal and keep it open). It is only needed if you want to test over HTTP.

On other platforms any static server works, e.g. `python3 -m http.server 8000`, then open `http://localhost:8000`. It also works on GitHub Pages (Settings → Pages → deploy from branch, root).

## Extension features (added after Week 2)
- **Plan a visit** (`#/plan`): pick a day and a town; the app shows what the sources report. Save items; the plan stays on the device. "Copy link" shares the day, town and saved items (the receiver chooses whether to use the shared plan). Directory filters are also shareable (`#/directory?q=pugutan&town=boac`).
- **Reviewer labels:** every card shows "Not yet reviewed by a local reviewer" until a reviewer is recorded in `content.json` (see below). The Sources page counts reviewed items.
- **Desktop-first (v7):** the site is designed for laptop and desktop screens (wider layout, larger type, three-column directory). Narrow screens still work but are not the focus. The earlier offline/installable-app (PWA) experiment was removed; the app now removes any old service worker and `mhg-` caches it finds.
- **3D Morion mask (v7):** `js/mask3d.js` (built from `src3d/`) draws an original, procedurally generated mask with helmet, horsehair crest, beard, eyelashes and optional silver Mogpog-style flowers. It loads only when needed (home page hero and Learn → Anatomy of a Morion). Drag to turn; arrow keys, + / −, R when the model is focused; buttons for pause, reset, zoom. If WebGL is unavailable the illustration is shown instead. Rebuild after editing `src3d/mask3d.js`: `cd src3d && npm install && npm run build`.
- **Plan copy (v7):** "Copy plan as text" (works on `file://`), "Download .txt", a text box to copy by hand, and print. "Copy link" appears only when the site is served over http(s), because a link to a local file cannot be opened by other people.
- **Print mode:** Print buttons on the plan and the etiquette checklist; the print style hides navigation and quiz.
- **Data checker:** `node tools/validate-data.js` checks sources, both languages, valid ids, quiz answers and that `content.js` is up to date.
- **Usability test kit:** `docs/USABILITY_TEST.md` (tasks, SUS questionnaire, ethics script).

## Recording a review
When a local reviewer (cultural bearer, tourism office, Diocese) checks an item, add to that item in `content.json`:
```json
"review": { "status": "reviewed", "by": "Name or office", "date": "2026-11-12" }
```
then run `node tools/build-data.js` and `node tools/validate-data.js`. Do not mark anything reviewed unless the review really happened.

## Editing content
Edit **`data/content.json`** only, then regenerate the file copy with `node tools/build-data.js` (needs Node.js). Every fact needs a `src` array with ids from the `sources` object. Unsourced guidance must be marked `"type": "pending"` (etiquette) until confirmed. If you forget to regenerate, the page still shows the new JSON over HTTP, but `file://` will show the old copy.

## Structure
```
index.html          page shell
css/styles.css      design system: "penitential editorial" look, responsive, light/dark themes
js/app.js           routing, modules, SVG glossary, directory filter, quiz, localStorage
data/content.json   ALL bilingual content, each item tagged with source ids (source of truth)
data/content.js     generated copy of content.json so the page works from file://
assets/fonts/       self-hosted fonts (Fraunces, Atkinson Hyperlegible; SIL OFL licenses included)
tools/build-data.js regenerates data/content.js
tools/validate-data.js checks content.json (run before every commit)
js/mask3d.js        generated bundle of src3d/mask3d.js + Three.js (do not edit by hand)
src3d/              source of the 3D mask (package.json, mask3d.js); node_modules is not needed to run the site
THIRD_PARTY.md      licences of third-party code and fonts
assets/icons/       favicon
docs/TESTING.md     what was tested and how
.vscode/            VS Code launch.json (F5 in Edge) and a task, both open the file directly
tools/serve.ps1     optional local HTTP server for Windows
AI_DISCLOSURE.md    provisional AI-use log
```
Fonts are loaded from the project files, not from the internet.
Technologies: semantic HTML5, CSS3, vanilla JavaScript, inline SVG, JSON, `localStorage`, Three.js (WebGL) for the 3D mask. No framework, application backend, or database; a small local static server is used for development.

## Privacy
Nothing leaves the device. Quiz results, badges, checklist and language are stored in this browser's `localStorage` (key `mhg.v1`). No accounts, no analytics.

## Known limitations
- Event schedules come from news reports of past years and change yearly; the guide labels them "Verify each year".
- Filipino text is AI-drafted and unreviewed.
- Origin date of the tradition is reported differently by different sources (1870s vs 1880s); the guide shows both.
- Costume drawing and the 3D mask are original illustrations in a generic traditional style, not depictions of any specific mask or maker. The 3D mask is not based on any museum object (the Mask Museum page was not used: its licence could not be verified). No mask carver has reviewed it yet.
- 3D needs WebGL; it was tested here only with a software renderer (slow) in Chromium, not on real graphics hardware, Firefox or Safari.
