# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 2
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                         | PASS — Vite static build on exact run `33432657970`, exit 0, run BS-20260831-27 |
| Lint                                     | PASS — app lint on exact run `33432657970`, exit 0, run BS-20260831-27 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings on exact run `33432657970`, exit 0 |
| Automated app tests                      | PASS — 106/106, exit 0, exact run `33432657970`, BS-20260831-27; includes fail-closed binding for settlement-503 explicit restore plus canonical mode wins and live feature lifecycles |
| Math/package invariants                  | PASS — 7/7 math gates and 300,000 books; exact package generation/readback PASS; fingerprint `d03fab…78d8`; exact run `33432657970` |
| Current-head browser/E2E                 | PASS — clean exact commit `6abd0c1`; isolated-package Chromium passed 61/61 scenarios plus 1472/1472 checks; failed settlement remains active without automatic retry and settles once after explicit restore; unexpected network/page/request failures 0; expected negative-path HTTP diagnostics remain scenario-scoped |
| Desktop/portrait/landscape visual review | PASS for current surfaces — exact-package failure/recovery screenshots and geometry from artifact `9773640454` inspected at 1280x720, 1920x1080, 390x844 and 844x390. Error/recovery controls, penguin/vault pixels, square boards and values remain visible without overlap, scroll or crop regression; prior 1366x768 and 360x640 Replay evidence remains source-identical and manual/device sign-off remains open |
| Live wallet/replay/restore               | PARTIAL — fractional new-play/restore, uncertain paid-play reload/restore, auth-503 explicit reload/re-auth, failed-settlement explicit restore with no automatic or duplicate write, competing-input deduplication, exact currency families and natural/confirmed feature plays are current-package browser proven; broader provider evidence remains |
| Gameplay state matrix                    | PARTIAL — exact current-package proof covers five deterministic rule wins per canonical mode plus natural Base and confirmed Deep Access feature entry/cycles/exit/ready cleanup; the full requested production interaction matrix is not yet current-head proven |
| Player HUD/responsiveness/accessibility  | PASS for the current control surface — computed centering, uncut labels, >=44px touch geometry, safe viewport placement and 3px/2px keyboard focus evidence pass all required viewports            |
| Animation/cinematics                     | PARTIAL — authoritative spin/reveal/feature anticipation, BLACKOUT entry/exit, cascades, semantic Vaultkeeper reactions and seven-column stops pass normal/turbo/reduced, skip, cleanup and exact-payout proof. Turbo and normal cascade are 16.7ms p95/16.8ms max with no >50ms stalls; full BLACKOUT is 33.4ms p95/66.7ms max with one >50ms stall. Approved Spine clips and real-device pacing remain |
| Audio                                    | PARTIAL — one procedural master bus, seven-stop reel cadence, semantic Vaultkeeper/feature recipes, priority ambience duck/restore, one ambience instance, gesture unlock, mute/level persistence, visibility suspend/resume, cooldown, voice cap and teardown are unit/browser proven; final approved assets and manual clipping/listening/device QA remain open |
| Product identity/assets/licenses         | PARTIAL — original penguin fallback and separate desktop/portrait base-vault plates are hash/provenance-bound, optimized and exact-browser integrated; human approval, cleanup/Spine, BLACKOUT and foreground layers remain open |
| Stake/provider checklist                 | PARTIAL — all 51 rows are exactly mapped: 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only, 6 external and 2 N/A; 38 automated references resolve against current package/browser identity, while 23 manual gates and 6 external approvals remain explicitly unclaimed |
| Release blockers                         | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY`                                                                                                                 |

Run `BS-20260831-25` corrected the delayed-Actions diagnosis from run 24: the previously cancelled source run was resumed and passed exactly, then the byte-identical three-file patch was fast-forwarded as `b94c059` and verified again on current HEAD. This closes the bounded live natural-Base/confirmed-Deep-Access browser-evidence gap without claiming the still-open human wording review.

Run `BS-20260831-26` attempted the next interrupted-feature restore proof. Frozen install, lint, typecheck, 106 tests, build, full math and package generation passed in both exact source runs, but Chromium timed out twice on two distinct transient-state observations in the new scenario. The slice was reverted after the second attempt; DoD evidence is unchanged and the final product tree matches the previously verified `30cf194` tree exactly.

Run `BS-20260831-27` moved to a distinct provider-recovery gap and proved it end to end. An accepted play whose first settlement returns HTTP 503 remains active, makes no automatic retry, exposes explicit `RELOAD / RESTORE`, reauthenticates once and performs exactly one successful second settlement. Exact CI run `33432657970` passes 106 tests, full math/package gates and 61 Chromium scenarios / 1472 checks without changing runtime, math, assets or dependencies.

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. CI/typecheck/Chromium are clean; responsive HUD, penguin/vault environments and authoritative cascade presentation are exact-browser integrated. Proceed to rig/BLACKOUT and remaining cinematic completion.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
