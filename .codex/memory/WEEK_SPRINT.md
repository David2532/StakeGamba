# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 2
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                         | PASS — Vite static build on exact run `33345753819`, exit 0, run BS-20260831-13 |
| Lint                                     | PASS — app lint on exact run `33345753819`, exit 0, run BS-20260831-13 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings locally and on exact run `33345753819`, exit 0 |
| Automated app tests                      | PASS — 92/92, exit 0, exact run `33345753819`, BS-20260831-13; includes the package/CI identity regression |
| Math/package invariants                  | PASS — 7/7 math gates and 300,000 books; isolated package has exact 9-file frontend tree `fc20dd2a…e303`, exact 7-file math tree `6bd0c4c7…01da`, and a second 300,000-book readback; fingerprint `d03fab…78d8`; exact run `33345753819` |
| Current-head browser/E2E                 | PASS — clean exact commit `49d1134`; Chromium served the isolated copied frontend, verified its pinned tree, and passed 40/40 scenarios plus 965/965 checks; unexpected console/network/request failures 0 |
| Desktop/portrait/landscape visual review | PASS — exact-package screenshots inspected at 1920x1080, 1366x768, 390x844, 844x390 and 360x640 Replay; controls remain legible, boards square/on-screen, and no overlap/scroll regression is visible |
| Live wallet/replay/restore               | PARTIAL — fractional new-play/restore, uncertain paid-play reload/restore and auth-503 explicit reload/re-auth are exact-browser proven with no duplicate writes; broader gameplay-state/provider evidence remains |
| Gameplay state matrix                    | PARTIAL — M2 deterministic fixtures exist; full requested production interaction matrix is not current-head proven                                                                                 |
| Player HUD/responsiveness/accessibility  | PASS for the current control surface — computed centering, uncut labels, >=44px touch geometry, safe viewport placement and 3px/2px keyboard focus evidence pass all required viewports            |
| Animation/cinematics                     | PARTIAL — authoritative spin/reveal/feature anticipation, BLACKOUT vault entry/exit, hit/remove/drop/settle cascades, normal/turbo/reduced profiles, skip, cleanup and exact-payout browser proof pass; character/rig fallback and full frame-pacing evidence remain |
| Audio                                    | PARTIAL — one procedural master bus, authoritative/UI cues, one ambience instance, gesture unlock, mute/level persistence, visibility suspend/resume, turbo cooldown, voice cap and teardown are unit/browser proven; final authored mix, reel/character detail and manual clipping/listening/device QA remain open |
| Product identity/assets/licenses         | PARTIAL — original penguin fallback and separate desktop/portrait base-vault plates are hash/provenance-bound, optimized and exact-browser integrated; human approval, cleanup/Spine, BLACKOUT and foreground layers remain open |
| Stake/provider checklist                 | PARTIAL — current-head isolated-package and Chromium evidence now exist; the complete 51-point automated/manual/external matrix and later milestone approvals remain open                          |
| Release blockers                         | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY`                                                                                                                 |

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. CI/typecheck/Chromium are clean; responsive HUD, penguin/vault environments and authoritative cascade presentation are exact-browser integrated. Proceed to rig/BLACKOUT and remaining cinematic completion.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
