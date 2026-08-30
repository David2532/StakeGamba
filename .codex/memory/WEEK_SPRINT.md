# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 2
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                         | PASS — Vite static build on exact run `33337862476`, exit 0, run BS-20260831-10 |
| Lint                                     | PASS — app lint on exact run `33337862476`, exit 0, run BS-20260831-10 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings locally and on exact run `33337862476`, exit 0 |
| Automated app tests                      | PASS — 87/87, exit 0, run BS-20260831-10; includes authoritative BLACKOUT lifecycle, timing grammar, skip settlement and compact motion-target regressions |
| Math/package invariants                  | PASS — 300,000 books; 7/7 gates; fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`, exact run `33337862476`, BS-20260831-10 |
| Current-head browser/E2E                 | PASS — clean exact commit `90f7c3d`; run `33337862476`; 39/39 scenarios and 910/910 checks; console/network/request failures 0 |
| Desktop/portrait/landscape visual review | PASS — exact screenshots inspected at 1920x1080, 1366x768, 390x844, 844x390 and 360x640 Replay plus the active BLACKOUT transition; controls remain legible, boards square/on-screen, and no overlap/scroll regression is visible |
| Live wallet/replay/restore               | PARTIAL — unit coverage and exact browser network proof are clean, including fractional new-play and active restore; reconnect and broader production-state evidence remain                        |
| Gameplay state matrix                    | PARTIAL — M2 deterministic fixtures exist; full requested production interaction matrix is not current-head proven                                                                                 |
| Player HUD/responsiveness/accessibility  | PASS for the current control surface — computed centering, uncut labels, >=44px touch geometry, safe viewport placement and 3px/2px keyboard focus evidence pass all required viewports            |
| Animation/cinematics                     | PARTIAL — authoritative spin/reveal/feature anticipation, BLACKOUT vault entry/exit, hit/remove/drop/settle cascades, normal/turbo/reduced profiles, skip, cleanup and exact-payout browser proof pass; character/rig fallback and full frame-pacing evidence remain |
| Audio                                    | BLOCKED — production audio, mute, persistence, pause/resume, and leak evidence absent                                                                                                              |
| Product identity/assets/licenses         | PARTIAL — original penguin fallback and separate desktop/portrait base-vault plates are hash/provenance-bound, optimized and exact-browser integrated; human approval, cleanup/Spine, BLACKOUT and foreground layers remain open |
| Stake/provider checklist                 | PARTIAL — historical M2 evidence exists, but current-head browser/package and later milestone evidence remain open                                                                                 |
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
