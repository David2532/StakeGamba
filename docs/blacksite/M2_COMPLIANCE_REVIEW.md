# BLACKSITE // BREACH — M2 Compliance Review

Review date: **2026-08-07**
Scope: authoritative RGS/Replay greybox, frozen-event adapter, rules/controls and automated browser evidence
Lifecycle: **M2 closed for the evidence-bound greybox candidate; M3 may start; this is not release, Stake, manual, extracted-package or 3-star approval**

This is the BLACKSITE-specific M2 evidence view of the immutable checklist in `STAKE_REQUIREMENTS_51.md`. It does not replace that source checklist or transfer evidence from another game. `PASS_AUTOMATED` means only that the stated requirement passed the repository-owned automated gate on the exact candidate below. Rows that require final artwork, a human judgment, an extracted package, real hardware or an external Stake action remain deliberately unpassed.

## Evidence identity and result

| Evidence field | Exact value |
|---|---|
| Tested commit | `0a63db9f5aef8c59ba67d7ec71b8e656fdca9455` |
| Browser artifact | [`artifacts/blacksite-qa/2026-08-07T21-42-48-633Z/blacksite-browser-evidence.json`](../../artifacts/blacksite-qa/2026-08-07T21-42-48-633Z/blacksite-browser-evidence.json) |
| Browser result | **735/735 checks; 36/36 scenarios** |
| Source-tree SHA-256 | `dfe7a3c07af23923e48f7323549bcaeb86f8d2f7cae0c8ccb6be486ec19debdb` |
| Built-tree SHA-256 | `35271ed00e3a0c6ed538b2d67e2f3743bfaf705bf9e93888090287b3580d6a2f` |
| Unit result | **66/66 tests passed** |
| Static/build result | **lint PASS; production build PASS** |

The browser artifact is the authority for M2 browser assertions: it binds the successful run to the tested commit and both tree hashes. Later source changes require a fresh evidence artifact; a passing run is not silently inherited.

M1 math evidence is unchanged: **300,000 books, 90/90 math gates, 48/48 fixtures and 7/7 math tests** remain verified under math fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8` and event-schema fingerprint `bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29`. The retained evidence is [`VERIFY_RESULT.json`](../../math/games/blacksite_breach/library/publish_files/VERIFY_RESULT.json), [`CANDIDATE_MANIFEST.json`](../../math/games/blacksite_breach/library/publish_files/CANDIDATE_MANIFEST.json), [`MATH_AUDIT.json`](../../math/games/blacksite_breach/library/publish_files/MATH_AUDIT.json), [`RISK_AUDIT.json`](../../math/games/blacksite_breach/library/publish_files/RISK_AUDIT.json) and [`FIXTURE_INDEX.json`](../../math/games/blacksite_breach/library/publish_files/FIXTURE_INDEX.json).

## Status summary

| Status | IDs | Count |
|---|---|---:|
| `PASS_AUTOMATED` | 01–04, 09–16, 24, 32, 36, 40, 42, 43 | **18** |
| `IMPLEMENTED_UNPROVEN` | 05, 07, 17–22, 25–29, 31, 33, 35, 37–39, 41, 44 | **21** |
| `TODO` | 06, 08, 30, 49 | **4** |
| `EXTERNAL_PENDING` | 45–48, 50, 51 | **6** |
| `NOT_APPLICABLE` | 23, 34 | **2** |
| `PASS_MANUAL` | — | **0** |
| `BLOCKED` | — | **0** |
| **Total** | **01–51** | **51** |

## Row-by-row review

| ID | Requirement | M2 status | Current evidence | Next gate |
|---:|---|---|---|---|
| 01 | Authenticate with RGS on launch | `PASS_AUTOMATED` | Browser scenarios prove launch-time `/wallet/authenticate`, authoritative session hydration and no local paid fallback. | Re-run unchanged behavior on the exact extracted release candidate. |
| 02 | Invalid `rgs_url` fails safely | `PASS_AUTOMATED` | Invalid URL/session and recoverable HTTP failure scenarios show a visible safe error, no simulated result and no stuck loader. | Preserve the fail-closed path through final-package QA. |
| 03 | Bet action sends successful RGS play | `PASS_AUTOMATED` | A legal user action produces exactly one authoritative `/wallet/play`; the returned book drives presentation. | Re-prove against the submission RGS/environment. |
| 04 | No Stake Engine Loader | `PASS_AUTOMATED` | Static/runtime checks find no Stake Engine Loader in the M2 source or rendered greybox. | Repeat static and visual scan on the extracted package. |
| 05 | Unique title; no restricted terms | `IMPLEMENTED_UNPROVEN` | The working title and normal/social copy are implemented and automated terminology checks pass. Uniqueness/legal clearance is a human judgment. | Complete current title, trademark/search and legal review; keep `BLACKSITE // BREACH` review-required until signed off. |
| 06 | No offensive/inappropriate imagery | `TODO` | M2 is a neutral greybox, not the production asset set; no final-art human review exists. | Review the complete original asset manifest and every final visual with Creative/Compliance. |
| 07 | Distinct from existing titles/series | `IMPLEMENTED_UNPROVEN` | Ghost Route, Core topology, BLACKOUT cycles and the cyber-intrusion presentation are project-specific contracts. Distinctiveness is not automatable. | Perform documented competitive/originality review on final mechanic presentation, art, branding and composition. |
| 08 | Thumbnail meets Stake artwork guidelines | `TODO` | No approval-ready background, transparent foreground/key art, provider mark or exact tile preview exists. | Produce the final tile package, verify dimensions/size budget and approve a manual Stake-layout preview. |
| 09 | Dynamically use authenticate bet parameters | `PASS_AUTOMATED` | Parameterized browser cases consume authoritative bet levels, min/max, step, default, flags and mode costs rather than a production hardcoded list. | Re-run with submission-environment authenticate payloads. |
| 10 | Restore active-round bet amount | `PASS_AUTOMATED` | Interrupted/active-round scenarios restore authoritative amount, mode and event cursor without a duplicate play. | Re-prove with the submission RGS and retained network trace. |
| 11 | Correct currency support/display | `PASS_AUTOMATED` | Exact money-domain tests and browser cases cover fiat, social currencies and unknown-code fallback without mixing wallet micro-units with centi-x math units. | Extend only if the final authenticate currency set changes. |
| 12 | Correct sub-cent payout display | `PASS_AUTOMATED` | Fractional live/Replay values retain required payout precision without premature rounding; balance and win precision stay separate. | Re-run on final typography/layout to catch visual truncation. |
| 13 | No unnecessary end-round on zero win | `PASS_AUTOMATED` | Network assertions gate `/wallet/end-round` by authoritative round state, not by the displayed win value; zero-win auto-close produces no extra write. | Preserve request-count proof against the submission RGS. |
| 14 | No play request on insufficient balance | `PASS_AUTOMATED` | Known-insufficient balance is blocked before play; browser/network evidence records zero `/wallet/play` calls. | Re-test the final controls and RGS race/error response. |
| 15 | Main game frame is not scrollable | `PASS_AUTOMATED` | Browser geometry checks pass across the M2 viewport matrix with no document overflow and an undistorted board. | Repeat on the final-art bundle and exact target viewport list. |
| 16 | Space bar binds to legal bet action | `PASS_AUTOMATED` | Keyboard E2E proves one legal action and blocking during modal, replay, busy and insufficient-funds states. | Re-run after final control/animation integration. |
| 17 | RTP and Max Win stated | `IMPLEMENTED_UNPROVEN` | Greybox rules display candidate-derived `96.20%` RTP and `10,000x` Max Win; M1 verifies both for all modes. | Verify the exact values in the extracted submission package and complete human rules review. |
| 18 | Symbol payout information stated | `IMPLEMENTED_UNPROVEN` | Greybox paytable is sourced from the frozen six-symbol contract and unit/browser checks protect its values. | Compare every rendered final symbol/value with the shipped config/books in the extracted build. |
| 19 | Win combinations explained | `IMPLEMENTED_UNPROVEN` | Rules implement 7 × 7 orthogonal `5+` clusters, simultaneous resolution and cascade behavior from the frozen contract. | Human-check wording plus five visually inspected wins per mode against the final presentation. |
| 20 | Every mode description and cost stated | `IMPLEMENTED_UNPROVEN` | Base, Deep Access and BLACKOUT descriptions/costs (`1x`, `4x`, `80x`) appear in the greybox and match the canonical registry. | Verify normal/social text and final extracted UI after production copy/layout integration. |
| 21 | Free-game/retrigger conditions stated | `IMPLEMENTED_UNPROVEN` | Rules describe Core arming, natural/direct BLACKOUT, cycle range, one-time ports, multiplier and extension semantics. | Human-compare final wording with emitted feature sequences and confirm the absence of a Scatter-style retrigger claim. |
| 22 | General disclaimer present | `IMPLEMENTED_UNPROVEN` | A current project-approved equivalent disclaimer is rendered in Game Information and covered by browser checks. | Re-check the current official wording and exact extracted package immediately before submission. |
| 23 | Auto-bet requires confirmation | `NOT_APPLICABLE` | **Autoplay is not offered** in BLACKSITE; no autoplay control, route or hidden start action exists. This product decision is frozen for this candidate. | Reopen the row only through a versioned product/compliance change that introduces autoplay. |
| 24 | High-cost modes require confirmation | `PASS_AUTOMATED` | Deep Access/BLACKOUT actions open a focus-safe confirmation showing selected mode and exact total cost; Cancel, Escape and backdrop send no play. | Re-run after final modal styling and on the extracted candidate. |
| 25 | Works on desktop/laptop | `IMPLEMENTED_UNPROVEN` | Deterministic desktop browser scenarios and geometry checks pass for the M2 greybox. Final art/performance and exact-package manual coverage do not yet exist. | Run the final candidate on the approved desktop/laptop matrix and record manual visual evidence. |
| 26 | Works on Popout S/L | `IMPLEMENTED_UNPROVEN` | M2 Popout viewport proxies pass controls, board geometry and result readability checks. They are not final Stake-container approval. | Test exact Popout S/L containers with final art, animation and extracted files. |
| 27 | Works on mobile | `IMPLEMENTED_UNPROVEN` | Portrait/landscape greybox scenarios exercise responsive recomposition and control parity. Real final-device coverage remains open. | Run final-art candidate across the defined mobile/device matrix, then real-device QA. |
| 28 | Double-tap zoom disabled | `IMPLEMENTED_UNPROVEN` | M2 viewport/touch-action behavior is implemented and automated checks protect the main game surface without disabling legitimate dialog access. | Confirm on real iOS/Android browsers with final controls and accessible dialog scrolling. |
| 29 | Interaction guide included | `IMPLEMENTED_UNPROVEN` | Game Information maps the current greybox controls and keyboard behavior. M3–M5 can still change the visible control set. | Reconcile every final mouse/touch/keyboard/audio control with the extracted guide. |
| 30 | Sound can be disabled | `TODO` | No production audio system or mute control exists in M2. | Implement global mute, session persistence and Replay behavior; test and manually audit every audio source. |
| 31 | English supported | `IMPLEMENTED_UNPROVEN` | English first-render, controls, rules, Replay and error paths are implemented in the greybox; selected paths are automated. | Complete a full-string English audit on the extracted final package. |
| 32 | Invalid language is safe | `PASS_AUTOMATED` | Unknown `lang` browser cases fall back to complete English UI without empty or corrupt output. | Retain the matrix when production strings are added. |
| 33 | Five wins per mode match rules | `IMPLEMENTED_UNPROVEN` | The 48 frozen fixtures and event adapter reconcile positions, symbols, multipliers and final payouts, but five rendered wins per mode have not received the required human visual sign-off. | Manually inspect and record five final-presentation wins for Base, Deep Access and BLACKOUT against rules/paytable. |
| 34 | Mystery probabilities accurate if present | `NOT_APPLICABLE` | **No Mystery feature or Mystery symbol exists** in the frozen product/math contract or M2 runtime. | Reopen only through a versioned product/math/compliance change that adds Mystery behavior. |
| 35 | Required Social translations/terminology | `IMPLEMENTED_UNPROVEN` | Automated normal/social DOM and accessibility scans cover the M2 controls, rules and selected errors. A final all-surface human scan is still required. | Scan every final DOM/canvas-accessibility/rules/Replay/error string with current Social vocabulary guidance. |
| 36 | SC/GC display without `$` | `PASS_AUTOMATED` | Live and Replay E2E verify XSC/XGC/XEC formatting with SC/GC-style units and no dollar prefix, including fractional values. | Re-run if final formatting or currency mapping changes. |
| 37 | Social mode naming is compliant | `IMPLEMENTED_UNPROVEN` | `STANDARD RUN`, `DEEP ACCESS` and `BLACKOUT ENTRY` are implemented across tested Social controls, confirmations, rules and Replay. | Current-guidance human review of every final normal/social mode surface. |
| 38 | Social Replay has no restricted words | `IMPLEMENTED_UNPROVEN` | Social Replay DOM/text/accessibility scans pass for the automated M2 cases. The full loss/win/feature/max final matrix is not yet signed off. | Run and retain the complete final Replay surface scan on all representative outcomes. |
| 39 | English-only Social Mode | `IMPLEMENTED_UNPROVEN` | Runtime forces Social Mode to the approved English string set for tested non-English/invalid language inputs. | Expand to the final supported-language matrix and inspect every final Social surface. |
| 40 | Replay URL loads/plays requested event | `PASS_AUTOMATED` | Exact Replay query and `GET /bet/replay/{game}/{version}/{mode}/{event}` scenarios load the requested event sessionlessly with zero auth/play/end-round/wallet writes. | Re-prove the exact endpoint/version against the submission RGS. |
| 41 | Optional Replay currency/language/amount | `IMPLEMENTED_UNPROVEN` | Fractional amount, fiat/social currency and invalid-language cases pass exact BigInt/UI checks. The complete final optional-parameter contract is not yet exhaustively certified. | Run the submission parameter matrix for every supported optional parameter and final currency/language set. |
| 42 | Play Again repeats event | `PASS_AUTOMATED` | Browser evidence proves deterministic presentation reset and identical final result without new Replay fetches, wallet mutations or accumulated listeners. | Re-run after final animation/audio integration. |
| 43 | Replay shows play cost and multiplier | `PASS_AUTOMATED` | Exact query amount × canonical mode cost and authoritative final win are shown correctly, including fractional and Social cases. | Preserve exact arithmetic/display proof on the extracted release candidate. |
| 44 | Replay works in Popout S | `IMPLEMENTED_UNPROVEN` | The 360 × 640 Replay proxy passes readable controls/result, square-board geometry and no-clipping checks. It is not exact Stake-container/manual evidence. | Test final Replay in the real Popout S container with production assets and animation. |
| 45 | Bet-level templates applied | `EXTERNAL_PENDING` | Repository math shows a viable Base `1x`, maximum cost `80x`, `10,000x` cap and exposure profile; it cannot prove Stake-side template application. | Obtain and retain ACP/Stake template evidence tied to the exact submission math version. |
| 46 | Provably Fair and Replay enabled | `EXTERNAL_PENDING` | Repository Replay is automated-pass and frozen books are stateless; Stake-side Provably Fair/publication enablement is not repository-observable. | Obtain external enablement/publication proof for the exact frontend/math versions. |
| 47 | Front and Math requests approved | `EXTERNAL_PENDING` | No external approval is claimed by M2 or its passing CI. | Submit only the gated candidate and retain both Stake/ACP approvals with exact hashes/versions. |
| 48 | Posted in approved Slack channel | `EXTERNAL_PENDING` | No approved-channel post has been made or claimed. | Retain the real `stake-engine-game-approved` message/link after actual approval. |
| 49 | Works on older Android/iOS | `TODO` | Browser emulation/proxies are insufficient and no agreed older-device evidence exists. | Define the device/OS floor and run the final candidate on real devices or an approved device farm. |
| 50 | Close approval request after live; Slack emoji workflow | `EXTERNAL_PENDING` | This is a post-live operational action; BLACKSITE is not live. | After verified go-live, close the real request and retain Slack emoji/workflow evidence. |
| 51 | Game Released | `EXTERNAL_PENDING` | No release or production availability is claimed. A build, commit, push, merge, upload or automated pass is not a release. | Verify actual production availability through the authorized release process. |

## M2 verdict and next gate

- The exact M2 candidate is **green for its repository-owned automated greybox gate**: 66/66 unit tests, lint, production build, and 735/735 browser checks across 36/36 scenarios.
- Strict RGS authority, restore/recovery, read-only Replay, exact money domains, frozen-event validation, high-cost confirmation, responsive greybox behavior and the enumerated currency/language cases are closed at M2 for the evidence-bound commit.
- The 51-point matrix is truthfully **18 `PASS_AUTOMATED`, 21 `IMPLEMENTED_UNPROVEN`, 4 `TODO`, 6 `EXTERNAL_PENDING`, 2 `NOT_APPLICABLE`, 0 `PASS_MANUAL`, 0 `BLOCKED`**.
- M2 does **not** grant release approval, Stake/ACP approval, manual approval, extracted-package approval, production-asset approval or a visual/studio 3-star rating.
- The next gate is **M3 production asset and animation integration behind the frozen event/state interfaces**, beginning with an original asset manifest and provenance record. M3 must preserve all M1/M2 evidence invariants and re-run unit, lint, build and SHA-bound browser evidence after integration; rows requiring human/external proof remain unpassed until that proof exists.
