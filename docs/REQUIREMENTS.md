# Objectives and requirements (v7)

Status as of 2026-11-06. "Met" means checked by the development tests in `docs/TESTING.md`; nothing here is a result from real users.

## General objective

To develop a frontend-only, bilingual (English/Filipino) web guide that gives students, visitors and tourism offices accurate, source-tagged and respectful information about the Moryonan of Marinduque, and to check how well it meets its requirements.

## Specific objectives

| # | Objective | How it is checked | Status |
|---|---|---|---|
| O1 | Deliver at least three working interactive features (heritage modules, searchable directory, quiz with etiquette checklist). | Feature walk-through and browser checks (docs/TESTING.md #2–#8). | Met; two extensions added (Plan a visit, 3D mask) |
| O2 | Attach at least one source id to every factual content item and label unsourced guidance as “pending”. | tools/validate-data.js (exit code 0 on the real data; broken test copy fails). | Met (checked by the validator) |
| O3 | Provide every interface string and content item in both English and Filipino, with the Filipino reviewed by a native speaker before final submission. | Validator checks both languages are present; native-speaker review log. | Drafted; review pending |
| O4 | Meet the automated WCAG 2.x A/AA checks on all views in light and dark themes and make every interaction keyboard-operable. | axe-core scan (14 view/theme runs, 0 violations in v7); keyboard checks; screen-reader check planned. | Met for automated checks; manual checks pending |
| O5 | Collect no personal data and require no server or database; keep all state in the browser. | Design review and code inspection (no network calls except links to sources). | Met by design |
| O6 | Pilot the guide with at least five students or visitors using the usability kit (five tasks and the SUS questionnaire) and report completion rate and SUS score. | docs/USABILITY_TEST.md; results to be reported as measured, with no target claimed in advance. | Planned (Week 3) |
| O7 | Have the content reviewed by at least one local reviewer (cultural bearer, tourism office or Diocese) and record the review in content.json. | Review labels on each item; Sources page counts reviewed items. | Planned; 0 items reviewed so far |

## Functional requirements and where they are met (requirements-to-features table)

Features: **F1** Interactive heritage modules, **F2** Searchable directory, **F3** Quiz, badges and etiquette checklist (the three core features); **E1** Plan a visit and **E2** 3D mask (extensions).

| ID | Requirement | Feature | Implemented in | Test evidence | Status |
|---|---|---|---|---|---|
| FR1 | The user can switch the whole interface and content between English and Filipino. | All | js/app.js (state.lang, ui()); content.json | TESTING #8, #34 | Implemented |
| FR2 | The system shows the legend with source tags and states where sources disagree on the origin date. | F1 Heritage modules | legendHTML(); content.json legend | TESTING #2 | Implemented |
| FR3 | The system shows the Holy Week rites as an ordered timeline. | F1 Heritage modules | ritesHTML(); content.json rites (8) | TESTING #2 | Implemented |
| FR4 | The user can select any of six costume parts by pointer or keyboard and read its description, sources and review status; progress is counted. | F1 Heritage modules | figureSVG(), selectPart(); glossary (6) | TESTING #3 | Implemented |
| FR5 | The user can turn and zoom an original 3D mask, show or hide the helmet and optional flowers, and highlight the mask or crest; if 3D is unavailable the illustration is shown. | E2 3D mask | src3d/mask3d.js → js/mask3d.js; bindFigure() | TESTING #32, #33 | Implemented |
| FR6 | The user can search the directory by keyword in English or Filipino, ignoring case and accents. | F2 Directory | filterDirectory(); directory (12) | TESTING #4 | Implemented |
| FR7 | The user can filter by municipality and category, see the result count, get suggestions when nothing matches, and share the filter state in the address. | F2 Directory | drawDirectory(), setHash() | TESTING #4, #16–#18 | Implemented |
| FR8 | The user can pick a day and town, see what the sources report, and save or remove items in a personal plan that persists. | E1 Plan a visit | planView(), togglePlan(); days (8) | TESTING #19, #20 | Implemented |
| FR9 | The user can copy the plan as text, download it as .txt or print it; a link is offered only when the site is served over http(s). | E1 Plan a visit | planText(), copyText(), downloadText() | TESTING #31 | Implemented |
| FR10 | The user can take an 8-question quiz with immediate feedback, explanation and source, and see score, best score and attempts. | F3 Quiz and etiquette | drawQuiz(); quiz (8) | TESTING #5 | Implemented |
| FR11 | The system awards five badges for defined achievements and shows which are earned. | F3 Quiz and etiquette | award(), drawStats() | TESTING #5 | Implemented |
| FR12 | The user can tick a six-item etiquette checklist whose items are labelled “Sourced” or “Pending review”, and print it. | F3 Quiz and etiquette | drawChecklist(); etiquette (6) | TESTING #6, #7 | Implemented |
| FR13 | The system lists all sources, shows each item's review status, and counts items reviewed by a local reviewer. | Cross-cutting | sourcesHTML(), reviewChip() | TESTING #23 | Implemented |
| FR14 | The user can reset saved progress. | F3 Quiz and etiquette | bindQuizView() | TESTING #7 | Implemented |

## Non-functional requirements

| ID | Area | Requirement | Evidence |
|---|---|---|---|
| NFR1 | Accessibility | Semantic landmarks, keyboard operation, visible focus, text alternatives for the 3D view, reduced-motion support, light and dark themes, WCAG 2.2 A/AA automated checks pass. | TESTING #10, #13, #26, #34 |
| NFR2 | Privacy | No personal data collected; no accounts; only language, progress, checklist and plan are stored in the browser's localStorage (key mhg.v1); storage access is guarded. | Code review; TESTING #7 |
| NFR3 | Portability | Opens from disk (file://) and from static hosting; content falls back to data/content.js when the browser blocks fetch(); no build step is needed to run the site (the 3D bundle is prebuilt). | TESTING #11, #28 |
| NFR4 | Desktop-first layout | Designed for laptop and desktop screens (wide layout, larger type, multi-column lists); narrow screens still work but are not the focus. | TESTING #30 |
| NFR5 | Content integrity | Every factual item carries a source id; both languages present; quiz answers valid; content.js in sync with content.json; checked by tools/validate-data.js. | TESTING #25 |
| NFR6 | Cultural respect | A respectful-framing notice is visible on every page; costume art and the 3D mask are original generic designs, not copies of a specific mask or maker; no real person's photo is used. | Design review; AI_DISCLOSURE #10 |
| NFR7 | Load cost | The 3D library is loaded only when needed (about 0.5 MB, about 0.13 MB compressed with gzip, measured on the group's build). | File size check |

## Out of scope

Server, database, accounts or logins, payments or bookings, maps and live event data, user-generated content, AR/VR, and any collection of personal data.
