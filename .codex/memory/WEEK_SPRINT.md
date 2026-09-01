# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 3
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area                                     | Current evidence                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                         | PASS — deterministic pre-clean Vite static build plus exact commit/tree/clean identity on run `33478922886`, exit 0, run BS-20260901-10 |
| Lint                                     | PASS — app lint on exact run `33478922886`, exit 0, run BS-20260901-10 |
| Typecheck                                | PASS — production source/config `svelte-check`, `checkJs: true`, 0 errors / 0 warnings on exact run `33478922886`, exit 0 |
| Automated app tests                      | PASS — 122/122, exit 0, exact run `33478922886`, BS-20260901-10; includes real double-tap/touch-scroll evidence plus prior package/accessibility/provider/gameplay coverage |
| Math/package invariants                  | PASS — 7/7 math gates and 300,000 books; exact identity-bound package generation/readback PASS; fingerprint `d03fab…78d8`; exact run `33478922886` |
| Current-head browser/E2E                 | PASS — clean exact commit `099c9fe`; isolated-package Chromium passed 71/71 scenarios plus 1854/1854 checks; exact build tree `c051cc1a…f2e0`; unexpected network/page/request failures 0 |
| Desktop/portrait/landscape visual review | PASS for current surfaces — exact-package geometry from artifact `9789541385` passed at 1920x1080, 1366x768, 390x844, 360x740, 844x390, 768x1024 and Replay 360x640 plus the orientation round trip. The 1920, 390, 844, Replay and touch-scrolled Rules captures were inspected; penguin/vault pixels, named square boards, centered values and >=44px controls remain visible without overlap, document scroll or crop regression; screen-reader/physical-device sign-off remains open |
| Live wallet/replay/restore               | PARTIAL — dynamic/ambiguous authenticate parameters, fractional new-play/restore, uncertain paid-play reload/restore, auth-503, expired-play and expired-settlement explicit reauthentication, failed-settlement and `ERR_IPB` recovery with no automatic or duplicate write, competing-input deduplication, exact currency families, natural/confirmed feature plays and Social Replay loss/win/feature/max-win surfaces are current-package browser proven; broader provider evidence remains |
| Gameplay state matrix                    | PARTIAL — exact current-package proof covers five deterministic rule wins per canonical mode plus natural Base and confirmed Deep Access feature entry/cycles/exit/ready cleanup; the full requested production interaction matrix is not yet current-head proven |
| Player HUD/responsiveness/accessibility  | PASS for the current automated control surface — computed centering, uncut labels, >=44px touch geometry, safe viewport placement, real double-tap/no-zoom plus touch-scroll behavior, 3px/2px keyboard focus, named route/presentation groups, atomic state/net-position statuses, a named non-live timer, exact high-cost descriptions and a ten-entry visible interaction guide pass exact-package checks; real screen-reader/device sign-off remains open |
| Animation/cinematics                     | PARTIAL — authoritative spin/reveal/feature anticipation, BLACKOUT entry/exit, cascades, semantic Vaultkeeper reactions and seven-column stops pass normal/turbo/reduced, skip, cleanup and exact-payout proof. Turbo and normal cascade are 16.7ms p95/16.8ms max with no >50ms stalls; full BLACKOUT is 33.4ms p95/66.7ms max with one >50ms stall. Approved Spine clips and real-device pacing remain |
| Audio                                    | PARTIAL — one procedural master bus, seven-stop reel cadence, semantic Vaultkeeper/feature recipes, priority ambience duck/restore, one ambience instance, gesture unlock, mute/level persistence, visibility suspend/resume, cooldown, voice cap and teardown are unit/browser proven; final approved assets and manual clipping/listening/device QA remain open |
| Product identity/assets/licenses         | PARTIAL — original penguin fallback and separate desktop/portrait base-vault plates are hash/provenance-bound, optimized and exact-browser integrated; human approval, cleanup/Spine, BLACKOUT and foreground layers remain open |
| Stake/provider checklist                 | PARTIAL — all 51 rows are exactly mapped: 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only, 6 external and 2 N/A; 38 automated references resolve against current package/browser identity, while 23 manual gates and 6 external approvals remain explicitly unclaimed |
| Release blockers                         | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY`                                                                                                                 |

Run `BS-20260831-25` corrected the delayed-Actions diagnosis from run 24: the previously cancelled source run was resumed and passed exactly, then the byte-identical three-file patch was fast-forwarded as `b94c059` and verified again on current HEAD. This closes the bounded live natural-Base/confirmed-Deep-Access browser-evidence gap without claiming the still-open human wording review.

Run `BS-20260831-26` attempted the next interrupted-feature restore proof. Frozen install, lint, typecheck, 106 tests, build, full math and package generation passed in both exact source runs, but Chromium timed out twice on two distinct transient-state observations in the new scenario. The slice was reverted after the second attempt; DoD evidence is unchanged and the final product tree matches the previously verified `30cf194` tree exactly.

Run `BS-20260831-27` moved to a distinct provider-recovery gap and proved it end to end. An accepted play whose first settlement returns HTTP 503 remains active, makes no automatic retry, exposes explicit `RELOAD / RESTORE`, reauthenticates once and performs exactly one successful second settlement. Exact CI run `33432657970` passes 106 tests, full math/package gates and 61 Chromium scenarios / 1472 checks without changing runtime, math, assets or dependencies.

Run `BS-20260831-28` proves the distinct API-level `ERR_IPB` recovery path. A balance race rejects one legal play, remains fail-closed without automatic retry, then explicit reload discovers and settles the authoritative active zero-win round exactly once. Exact CI run `33436799735` passes 107 tests, full math/package gates and 61 Chromium scenarios / 1490 checks without changing runtime, math, assets or dependencies.

Run `BS-20260831-29` proves the distinct expired-session path. API `ERR_SESSION` rejects one play fail-closed, explicit reload performs one reauthentication without resubmitting that action, and only a subsequent deliberate click sends one new successful play. Exact CI run `33439810616` passes 108 tests, full math/package gates and 62 Chromium scenarios / 1518 checks without changing runtime, math, assets or dependencies.

Run `BS-20260831-30` proves the distinct expired-settlement-session path. After one accepted play and checkpoint, API `ERR_SESSION` leaves settlement fail-closed without automatic retry; explicit reload reauthenticates once and completes the restored active round once without duplicate play/checkpoint. Exact CI run `33442885524` passes 108 tests, full math/package gates and 63 Chromium scenarios / 1550 checks without changing runtime, math, assets or dependencies.

Run `BS-20260901-01` proves the ambiguous authenticate-step path. A nominally successful response with conflicting official `stepBet` and supported `minStep` aliases is visibly rejected as `STEP_BET_CONFLICT`; the exact package keeps paid play unavailable after one authenticate and sends no play, event or settlement writes. Exact CI run `33448128514` passes 109 tests, full math/package gates and 64 Chromium scenarios / 1558 checks without changing runtime, math, assets or dependencies.

Run `BS-20260901-02` closes the highest-impact automated day-3 semantic gap. Access-level and motion controls are explicitly named groups, launch/board updates are atomic polite statuses, and high-cost confirmation binds the 4×/$4.00 or 80×/$80.00 explanation to the dialog. Exact CI run `33450641637` passes 112 tests, full math/package gates and 64 Chromium scenarios / 1576 checks; visual layout remains unchanged and real screen-reader/device approval remains open.

Run `BS-20260901-03` closes the generated-frontend provenance gap. Production build now removes only its generated root before Vite, writes exact commit/tree/clean identity, and packaging fails closed for stale or foreign output. An injected stale bundle is removed and repeated builds each contain 10 files with one JS bundle; exact CI run `33453194613` passes 112 tests, full math/package gates and 64 Chromium scenarios / 1576 checks without changing runtime UI, math, assets or dependencies.

Run `BS-20260901-04` closes the automated interaction-guide gap behind checklist row 29. One immutable ten-entry contract now documents every visible control plus pointer/touch, keyboard, Space and Escape behaviour; Game Information renders it, and exact Chromium proves both directions of the control/guide mapping. Exact CI run `33456368436` passes 113 tests, full math/package gates and 64 Chromium scenarios / 1579 checks; manual final-control reconciliation remains explicitly open.

Run `BS-20260901-05` closes the automated orientation-transition gap behind checklist row 27. One authenticated mobile context now performs 390x844 → 844x390 → 390x844 while proving responsive asset swaps, square 49-cell board, centered HUD, focus, >=44px controls, zero wallet writes and portrait return within 0.5 CSS px. Exact CI run `33461309637` passes 114 tests, full math/package gates and 65 Chromium scenarios / 1739 checks; physical-device sign-off remains explicitly open.

Run `BS-20260901-06` closes the automated Social Replay outcome-matrix gap behind checklist row 38. Math-backed loss, positive Base win, complete Deep Access feature and exact 10,000x max-win books are scanned in ready and completed states for official restricted terms and dollar-prefixed Social display; each performs one Replay GET and no wallet/event write. Exact CI run `33463575542` passes 115 tests, full math/package gates and 69 Chromium scenarios / 1821 checks; the required human final-surface sign-off remains explicitly open.

Run `BS-20260901-07` closes persisted presentation-speed behavior behind checklist row 29. Normal/Turbo is stored through one versioned contract; reduced-motion overrides and disables the control without erasing Turbo, and Turbo resumes when the override clears. Exact CI run `33468510345` passes 119 tests, full math/package gates and 70 Chromium scenarios / 1832 checks; four authentications produce no play, settlement or event write, while manual final-control reconciliation remains open.

Run `BS-20260901-08` closes the automated board-topology accessibility gap. The visible board is now one named 7x7 ARIA grid with seven owned rows and exact one-based row/column positions on every cell; exact geometry proves the structural wrapper preserves the square 49-cell layout across all eight surfaces. Exact CI run `33471069057` passes 120 tests, full math/package gates and 70 Chromium scenarios / 1843 checks; real screen-reader and physical-device approval remain open.

Run `BS-20260901-09` closes a jurisdiction-readout accessibility defect. Session Position remains an atomic polite status, while Session Time is now a labelled non-live timer instead of forcing a screen-reader announcement every second. Exact mobile Chromium proves the timer still advances `00:00 → 00:01`, the authoritative position updates `$0.00 → +$7.00`, and the one-play path emits no settlement/event write. Exact CI run `33474573594` passes 121 tests, full math/package gates and 70 Chromium scenarios / 1845 checks; real screen-reader/device sign-off remains open.

Run `BS-20260901-10` closes checklist row 28's CSS-only interaction-evidence gap. Exact 390x844 Chromium performs two real board taps and one real touch drag: viewport scale and page position remain fixed, while Game Information scrollTop moves `0 → 1022` inside its own 1767px surface. Exact CI run `33478922886` passes 122 tests, full math/package gates and 71 Chromium scenarios / 1854 checks; real iOS/Android sign-off remains open.

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. CI/typecheck/Chromium are clean; responsive HUD, penguin/vault environments and authoritative cascade presentation are exact-browser integrated. Proceed to rig/BLACKOUT and remaining cinematic completion.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
