# Prioritized release backlog

| ID | Priority | State | Vertical slice and exit condition |
| --- | --- | --- | --- |
| BSB-RGS-001 | High | DONE | Accept only the documented half-up whole-micro-unit payout for fractional centi-x products; real fixture, boundary, new-play, and restore tests pass. Commit `2977b4d`. |
| BSB-CI-001 | High | OPEN | Add branch-aware BlackSite CI with lint, typecheck, app tests, build, one non-duplicated full math test, browser E2E, and failure artifacts. Exit: clean workflow evidence on this branch. |
| BSB-QA-001 | High | OPEN | Make Playwright Chromium reproducibly available and rerun exact-HEAD E2E/visual QA. Exit: desktop, 390x844, and 844x390 screenshots plus clean console/network and fractional wallet browser cases. |
| BSB-ID-001 | Critical | OPEN | Reconcile explicit penguin + lock/vault identity across master plan, animation bible, asset manifest, and runtime plan. Exit: no active human-operative production direction; stable original-asset acceptance criteria exist. |
| BSB-HUD-001 | Critical | OPEN | Replace production-facing greybox diagnostics and 3-letter cells with a player HUD/art integration slice while preserving deterministic authority. Exit: usable desktop/mobile controls with no internal schema/hash copy. |
| BSB-MOBILE-001 | High | OPEN | Center Base Amount, mode labels, meters and HUD; remove mobile truncation; add distinct focus ring and real touch geometry assertions. Exit: current-head 1920x1080, 1366x768, 390x844, 844x390 evidence. |
| BSB-MOTION-001 | High | OPEN | Implement authoritative hit/remove/drop/settle cascade motion with normal/turbo timing, skip, cleanup and fallback. Exit: deterministic cascade fixtures and frame-pacing evidence. |
| BSB-AUDIO-001 | High | OPEN | Implement production audio bus, cues, ambience, mute/volume persistence, pause/resume and cleanup. Exit: deterministic trigger and leak regression evidence. |
| BSB-EVIDENCE-001 | High | OPEN | Correct any historical M2 evidence overclaim for non-divisible live payout products and add current-head browser/package proof. Exit: SHA-bound matrix accurately separates automated/manual/external evidence. |
| BSB-README-001 | Medium | OPEN | Update stale `apps/blacksite/README.md` lifecycle/run instructions after the next verified milestone. |

Do not split a run across unrelated open items. After two failed attempts without new evidence, record the blocker and move to the next safe item.
