# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 2
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                         | PASS — Vite static build on exact run `33385664641`, exit 0, run BS-20260831-23 |
| Lint                                     | PASS — app lint on exact run `33385664641`, exit 0, run BS-20260831-23 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings locally and on exact run `33385664641`, exit 0 |
| Automated app tests                      | PASS — 104/104, exit 0, exact run `33385664641`, BS-20260831-23; includes fail-closed binding for five deterministic wins in each canonical mode |
| Math/package invariants                  | PASS — 7/7 math gates and 300,000 books; exact package generation/readback PASS; fingerprint `d03fab…78d8`; exact run `33385664641` |
| Current-head browser/E2E                 | PASS — clean exact commit `b10d446`; isolated-package Chromium passed 58/58 scenarios plus 1405/1405 checks; 15 rule-win cases prove 121 win events and 122 clusters; unexpected network/page/request failures 0; five expected negative-path HTTP console messages remain explicitly scoped |
| Desktop/portrait/landscape visual review | PASS for current surfaces — exact-package screenshots from artifact `9755786881` inspected at 1920x1080, 1366x768, 390x844, 844x390 and 360x640 Replay plus all 15 rule-win completions. Intended penguin/vault pixels render, boards remain square and values/controls remain visible without overlap, scroll or crop regression; required human rule-win sign-off remains open |
| Live wallet/replay/restore               | PARTIAL — fractional new-play/restore, uncertain paid-play reload/restore, auth-503 explicit reload/re-auth, competing-input deduplication and exact Social/USD/JPY/unknown-code displays are current-package browser proven with exact requests; broader gameplay-state/provider evidence remains |
| Gameplay state matrix                    | PARTIAL — exact current-package proof now covers five deterministic rule wins per canonical mode, 121 win events and 122 clusters; the full requested production interaction matrix is not yet current-head proven |
| Player HUD/responsiveness/accessibility  | PASS for the current control surface — computed centering, uncut labels, >=44px touch geometry, safe viewport placement and 3px/2px keyboard focus evidence pass all required viewports            |
| Animation/cinematics                     | PARTIAL — authoritative spin/reveal/feature anticipation, BLACKOUT entry/exit, cascades, semantic Vaultkeeper reactions and seven-column stops pass normal/turbo/reduced, skip, cleanup and exact-payout proof. Turbo and normal cascade are 16.7ms p95/16.8ms max with no >50ms stalls; full BLACKOUT is 33.4ms p95/66.7ms max with one >50ms stall. Approved Spine clips and real-device pacing remain |
| Audio                                    | PARTIAL — one procedural master bus, seven-stop reel cadence, semantic Vaultkeeper/feature recipes, priority ambience duck/restore, one ambience instance, gesture unlock, mute/level persistence, visibility suspend/resume, cooldown, voice cap and teardown are unit/browser proven; final approved assets and manual clipping/listening/device QA remain open |
| Product identity/assets/licenses         | PARTIAL — original penguin fallback and separate desktop/portrait base-vault plates are hash/provenance-bound, optimized and exact-browser integrated; human approval, cleanup/Spine, BLACKOUT and foreground layers remain open |
| Stake/provider checklist                 | PARTIAL — all 51 rows are exactly mapped: 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only, 6 external and 2 N/A; 38 automated references resolve against current package/browser identity, while 23 manual gates and 6 external approvals remain explicitly unclaimed |
| Release blockers                         | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY`                                                                                                                 |

Run `BS-20260831-24` added no DoD credit: the proposed live natural-Base/Deep-Access feature evidence passed static, contract, code, math and package gates, but its required exact browser gate was unavailable and GitHub attached no Actions run to the API-authored commits. The evidence patch was fully reverted by fast-forward commit `907816c`; current product tree remains identical to the last verified state.

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. CI/typecheck/Chromium are clean; responsive HUD, penguin/vault environments and authoritative cascade presentation are exact-browser integrated. Proceed to rig/BLACKOUT and remaining cinematic completion.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
