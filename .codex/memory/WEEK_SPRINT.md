# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 1
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production build                         | PASS — Vite static build locally and on exact run `33320205882`, exit 0, run BS-20260830-04                                                                                                                        |
| Lint                                     | PASS — app lint locally and on exact run `33320205882`, exit 0, run BS-20260830-04                                                                                                                                 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings locally and on exact run `33320205882`, exit 0, run BS-20260830-04                                                          |
| Automated app tests                      | PASS — 72/72, exit 0, run BS-20260830-04; includes 3 locked product-identity regressions                                                                                                                           |
| Math/package invariants                  | PASS — 300,000 books; 7/7 gates; fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`, exact run `33320205882`, BS-20260830-04                                                           |
| Current-head browser/E2E                 | PASS — clean exact commit `e243fe7`; run `33320205882`; 36/36 scenarios and 736/736 checks; console/network/request failures 0                                                                                     |
| Desktop/portrait/landscape visual review | PASS for the technical greybox baseline — exact current-commit screenshots inspected at 1920x1080, 390x844 and 844x390; boards square/on-screen and controls hittable; no production art/HUD completion is claimed |
| Live wallet/replay/restore               | PARTIAL — unit coverage and exact browser network proof are clean, including fractional new-play and active restore; reconnect and broader production-state evidence remain                                        |
| Gameplay state matrix                    | PARTIAL — M2 deterministic fixtures exist; full requested production interaction matrix is not current-head proven                                                                                                 |
| Player HUD/responsiveness/accessibility  | BLOCKED — runtime is an M2 greybox with known centering, focus, truncation, and missing-control issues                                                                                                             |
| Animation/cinematics                     | BLOCKED — no production cascade, penguin, or vault cinematic runtime                                                                                                                                               |
| Audio                                    | BLOCKED — production audio, mute, persistence, pause/resume, and leak evidence absent                                                                                                                              |
| Product identity/assets/licenses         | PARTIAL — penguin Vaultkeeper + physical lock/vault identity is locked and regression-tested; production art/rig, rights review and runtime integration remain absent                                              |
| Stake/provider checklist                 | PARTIAL — historical M2 evidence exists, but current-head browser/package and later milestone evidence remain open                                                                                                 |
| Release blockers                         | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY`                                                                                                                                 |

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. BlackSite-specific CI, production-source typecheck and exact remote Chromium evidence are clean. Replay Popout S distortion is fixed. The penguin/Vault product identity is locked and the human-operative path is superseded. Day-1 baseline is complete; proceed to the next highest release blocker.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
