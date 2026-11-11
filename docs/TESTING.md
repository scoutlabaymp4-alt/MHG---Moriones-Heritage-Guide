# Testing log (Week 2 MVP)

Date: 2026-11-04. Browser: Chromium (Playwright), served with `python3 -m http.server`.
Results below are from automated checks run during development; they are NOT user-feedback results.

| # | Check | Result |
|---|---|---|
| 1 | Page loads, no console or page errors across all views | Pass |
| 2 | Legend shows 4 paragraph cards + origin note; Timeline shows 8 items | Pass |
| 3 | SVG glossary: all 6 hotspots operable by keyboard (focus + Enter); panel updates; progress 6/6 | Pass |
| 4 | Directory: 12 entries; "pugutan" → 3; Boac → 5; Boac + site → 2; nonsense → "no match" message; reset → 12; "KATEDRAL" (Filipino, case-insensitive) → 1 | Pass |
| 5 | Quiz: all-correct run → 8/8, 4 badges (First Steps, Heritage Learner, Perfect Score, Costume Explorer); wrong answer shows "Not quite" + explanation | Pass |
| 6 | Checklist: ticking all 6 awards "Respectful Visitor" | Pass |
| 7 | Persistence: after reload, badges (5), checked items (6), best score 8/8 and attempts persist | Pass |
| 8 | Language toggle: `<html lang>` becomes `fil`, nav and content switch | Pass |
| 9 | 375 px wide viewport: no horizontal scroll | Pass |
| 10 | axe-core (WCAG 2.0/2.1/2.2 A/AA rules) on 6 views × light/dark themes | 0 violations after fixing link contrast in dark mode (initial run: 6 contrast violations, fixed in `styles.css`) |

Not covered: screen-reader testing by a human, real-device testing, Firefox/Safari, usability testing with students, content review by cultural bearers.
Automated accessibility tools find only part of the issues; this is not a full WCAG conformance claim.

## Update 2026-11-04 (visual redesign + file:// fix)
| # | Check | Result |
|---|---|---|
| 11 | Page opened directly from disk (`file://`): content loads from `data/content.js`, directory shows 12 entries, EN/FIL toggle works, no errors, fonts load | Pass |
| 12 | Re-ran checks 1-9 after the redesign (hero, new timeline, quiz layout, badges) | Pass |
| 13 | axe-core on 6 views x light/dark after the redesign (after the entrance animation finished) | 0 violations |
| 14 | 375 px wide: no horizontal scroll on Legend and Timeline | Pass |
| 15 | Keyboard: Learn tabs keep focus on the active tab after Arrow-key or click navigation (fix from the group's zip) | Pass |

Not covered (unchanged): human screen-reader testing, Safari/Firefox, real devices, usability testing with students, content review.

## Update 2026-11-05 (extension features)
Run in Chromium with Playwright against `python3 -m http.server`. Development testing only, not user testing.
| # | Check | Result |
|---|---|---|
| 16 | Directory towns now come from a `towns` list: Gasan → 2, Torrijos → 1, Boac → 5, Boac + site → 2 (Torrijos filter added) | Pass |
| 17 | Directory filters are written to the address and restored after reload (`#/directory?q=pugutan` → 3 results) | Pass |
| 18 | "No results" now offers 4 suggested searches; clicking one runs it | Pass |
| 19 | Plan: Good Friday / any town → 8 cards (4 events + 4 places); Good Friday / Santa Cruz → 2; Holy Thursday / Santa Cruz → parade + Battle of the Morions | Pass |
| 20 | Plan: save/unsave, My plan list, remove, persistence after reload, link contains day, town and ids | Pass |
| 21 | Shared link in a fresh browser shows the shared day/town and offers "Use this plan" (2 items); malformed parameters do not crash | Pass |
| 22 | Copy link: works over http (clipboard contained the link); on `file://` the app shows the "copy by hand" message because browsers block the clipboard there | Pass |
| 23 | Reviewer labels: all unreviewed by default; a test item marked reviewed shows "Reviewed by … · date"; Sources page counts 1 / 44 in that test | Pass |
| 24 | Offline: after the first visit the service worker controls the page; with the network switched off the home page, plan page and all 4 fonts still load; footer says "Saved for offline use" | Pass |
| 25 | `tools/validate-data.js`: passes on the real data; a deliberately broken copy (unknown source, bad town, wrong quiz answer, empty Filipino text, sources on a pending item, stale content.js) fails with 6 messages and exit code 1 | Pass |
| 26 | axe-core (WCAG 2.x A/AA), 7 views x light/dark | 0 violations |
| 27 | 375 px: no horizontal scroll on Plan, Directory, Legend, Quiz | Pass |
| 28 | `file://`: Plan view loads 8 cards, no errors | Pass |

Not tested: Safari/Firefox, Windows/Edge, screen readers, printing on paper (print style written but only reviewed in code), real users.

Note (v7): checks 24 (offline/PWA) and 27 (375 px) no longer apply: the PWA was removed and the site is desktop-first. See the v7 table below.

## Update 2026-11-05 (v7: desktop-first, plan copy, 3D mask)
Run in Chromium with Playwright. 3D checks used a **software renderer (SwiftShader)**, so speed was not measured and real GPUs, Firefox and Safari were not tested.
| # | Check | Result |
|---|---|---|
| 29 | PWA removed: no `sw.js`, manifest or PNG icons; the page only unregisters old service workers and deletes `mhg-` caches | Pass (code and file check; cleanup on a browser that still has the old worker not tested) |
| 30 | Layout at 1440x900 and 1920x1080: directory, plan, quiz show no horizontal scroll; directory shows 3 columns at 1920 | Pass (screenshots viewed) |
| 31 | Plan: "Copy plan as text" puts the itinerary on the clipboard (http and `file://`); with the clipboard API removed the fallback still copies; the text box holds the plan; "Download .txt" saves `moriones-visit-plan.txt`; "Copy link" is hidden on `file://` and works on http; Filipino text works; copy is disabled when the plan is empty | Pass (headless Chromium; real Edge/Chrome still to confirm) |
| 32 | 3D mask loads on Home and Learn → Anatomy; no console errors; canvas has a text label; Illustration/3D switch; helmet and flowers toggles (flowers disabled when helmet is off); crest highlight; "not modelled" note for other parts | Pass (software renderer) |
| 33 | WebGL unavailable: Anatomy shows the illustration (6 hotspots) with a message; the home hero keeps the drawing; no errors | Pass |
| 34 | axe-core (WCAG 2.x A/AA) on 7 views x light/dark at 1440x900, including the 3D views | 0 violations (first run found 1 label mismatch on the logo link; fixed) |
### v8 pre-hosting audit (10 Nov 2026)
Checks run in headless Chromium (Playwright) on 10 November 2026 before publishing to GitHub Pages or Vercel. The official Vercel web-interface-guidelines file could not be fetched from the build environment, so the guideline check used the usual rule areas (accessibility, forms, focus, performance, metadata), not the fetched text.

| # | Check | Result |
|---|---|---|
| 35 | Quiz answer position: before the fix every question had the right answer as option A (clicking A scored 8/8); after the fix the options are shuffled per run (3 runs x 8 questions gave positions 0-3 mixed), and the right option is still marked right by its text | Fixed, Pass |
| 36 | Corrupted saved data (not JSON, `"x"`, `null`, `parts` as a number, `etiquette` null, `plan` as a string, `badges` null, mixed types): before the fix 4 of these made every page show "content could not be loaded"; after the fix all views load and bad values fall back to defaults | Fixed, Pass |
| 37 | Heading structure: exactly one `<h1>` on each of 7 views; no skipped heading levels (axe best-practice rules) | Fixed, Pass |
| 38 | Browser tab title changes per page ("Directory · Moriones Heritage Guide", ...) and follows the language | Fixed, Pass |
| 39 | Crafted links `?town=constructor`, `?cat=__proto__`, `?ids=constructor,__proto__`, `?day=toString`, bad `%` escapes, `?q=<img onerror>`: no errors, filters fall back to "All", no HTML injected | Fixed, Pass |
| 40 | Data loading: online only `content.json` is requested; if it is blocked the page falls back to `content.js`; `file://` still works (12 directory cards, no page errors) | Pass |
| 41 | 3D: switching EN/FIL on the home page keeps the same canvas (no new WebGL context); 8 round trips between pages leave exactly 1 canvas and no console errors; a failed script download can be retried | Pass (software renderer) |
| 42 | Layout at 1280x720, 1366x768, 1920x1080, 1024x768, 820x1180, 390x844: no horizontal scroll; header is one 76 px row at 1366 wide (was 161 px) and sticky above 1100 px; hero fits one screen at 1366x768; Anatomy 3D viewer ends at about y=826 (the old figure box ended at y=1307) | Pass (screenshots viewed) |
| 43 | axe-core WCAG 2.x A/AA plus best-practice rules, 7 views x light/dark, 3D blocked | 0 violations (the first run found 2 best-practice issues: heading order and a notice outside any landmark; fixed) |

| 44 | Logo (background-removed photo) in the header, favicon and share image: loads (naturalWidth > 0), header 83 px tall at 1366 wide, 128 px (two rows) at 1100; no horizontal scroll at 6 screen sizes; axe-core 0 violations | Pass |
| 45 | 3D mask v8.2: all three helmet styles (red, black, woven) render from front, side and back with no console errors; style picker switches style, disables the silver-flower option on the woven style, keeps helmet on/off working; EN/FIL labels. Software renderer only. | Pass (screenshots checked by eye) |

Not tested: Firefox and Safari, a real phone, print output after the header change, 3D speed on a real graphics card.

Manual checks still needed on the group's own computers (Windows, Edge/Chrome, real GPU): speed of the 3D view, that the mask looks right, that copy-to-clipboard works.
