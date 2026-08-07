# BLACKSITE // BREACH — M1 Compliance Review

Review date: **2026-08-07**
Scope: frozen M1 mechanic/math/event contract and the repository state visible during this review
Lifecycle: **M1 complete for the verified initial non-release math candidate; M2 greybox started; not a frontend, release or Stake approval**

This is the BLACKSITE-specific evidence view of the immutable checklist in `STAKE_REQUIREMENTS_51.md`. It does not replace or rewrite that source checklist. Golden Goal Rush evidence is reusable architecture knowledge only and never closes a BLACKSITE item.

## Status summary

| Status | Count |
|---|---:|
| `TODO` | **37** |
| `IMPLEMENTED_UNPROVEN` | **8** |
| `PASS_AUTOMATED` | **0** |
| `PASS_MANUAL` | **0** |
| `EXTERNAL_PENDING` | **5** |
| `NOT_APPLICABLE` | **1** |
| `BLOCKED` | **0** |
| **Total** | **51** |

`IMPLEMENTED_UNPROVEN` means that a frozen contract or partial implementation exists, but the complete requirement lacks its required BLACKSITE candidate/browser/manual evidence. A math sub-gate may later become `PASS_AUTOMATED` while its checklist row remains unproven because the same row also requires rendered rules or browser behavior. External items cannot be self-certified by this repository.

## 01–04 — PreChecks

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 01 | Authenticate with RGS on launch | `TODO` | RGS authority is frozen in `M1_GAME_MATH_CONTRACT.md`; no BLACKSITE app/network trace exists | M2 browser proof for one launch-time `/wallet/authenticate`, dynamic `rgs_url`, valid session and no local paid fallback |
| 02 | Invalid `rgs_url` fails safely | `TODO` | Fatal contract-error policy exists; no BLACKSITE error UI or browser run | M2 invalid-URL E2E: visible terminal error, no simulated result and no stuck loader |
| 03 | Bet action sends successful RGS play | `TODO` | Canonical modes/costs are frozen; no BLACKSITE play integration | M2 network proof for exactly one correct play request and authoritative book rendering |
| 04 | No Stake Engine Loader | `TODO` | Product contract forbids it; no exact BLACKSITE frontend package exists | Static scan plus extracted-build visual/network inspection |

## 05–07 — Compliance

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 05 | Unique title; no restricted terms | `IMPLEMENTED_UNPROVEN` | `BLACKSITE // BREACH` is explicitly a working title; social labels avoid wager/cash language | Manual legal/title/search review and full normal/social string scan; title remains `REVIEW_REQUIRED` |
| 06 | No offensive/inappropriate imagery | `TODO` | No candidate asset set exists | Original-asset manifest plus Creative/Compliance human visual review |
| 07 | Distinct from existing titles/series | `IMPLEMENTED_UNPROVEN` | Original cyber-intrusion setting, Ghost Route/Core topology and BLACKOUT feature are frozen | Competitive/originality review of final mechanic presentation, composition, art and branding |

## 08 — Game Thumbnail / Tile

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 08 | Thumbnail meets Stake artwork guidelines | `TODO` | No tile assets or preview evidence | Produce original BG, transparent FG/key art and provider mark within size budget; manual preview on exact files |

## 09–10 — Bet Levels

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 09 | Dynamically use all authenticate bet parameters | `TODO` | Mode costs are frozen, but wager levels are intentionally not hardcoded | M2 parameterized auth/UI tests for levels, min/max, increment/step, default, flags and mode costs |
| 10 | Restore active-round bet amount | `TODO` | Restore must use authoritative round/auth state per the M1 contract | Interrupted-round browser proof with restored mode/amount and zero duplicate play requests |

## 11–12 — Currency Support

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 11 | Correct currency support/display | `TODO` | Micro-unit versus centi-x boundary and code-fallback policy are frozen | M2 formatter/browser matrix across representative fiat and XSC/XGC/XEC |
| 12 | Correct sub-cent payout display | `TODO` | Contract separates win precision from balance precision | Exact three-/four-decimal win, Replay and fractional-cost browser cases without premature rounding |

## 13–14 — RGS Requests

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 13 | No unnecessary end-round on zero win | `TODO` | All modes freeze `auto_close_disabled=false`; actual call is gated solely by normalized `round.active` | Zero-win and active-round network assertions proving exact end-round request counts |
| 14 | No play request on insufficient balance | `TODO` | Safe-stop invariant exists; no BLACKSITE control state | Known-insufficient UI guard and RGS race/error E2E with zero improper play calls |

## 15–16 — Frontend Requirements

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 15 | Main game frame is not scrollable | `TODO` | No BLACKSITE layout | M2 geometry suite on desktop, mobile, landscape and Popout S/L |
| 16 | Space bar binds to legal bet action | `TODO` | Required behavior is recorded in the master UI standard | M2 keyboard E2E across idle, blocked, confirmation, Replay and insufficient-funds states |

## 17–22 — Game Rules

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 17 | RTP and Max Win stated | `IMPLEMENTED_UNPROVEN` | **Math sub-gate PASS:** exact candidate audit proves `96.20%` cost-normalized RTP and `10,000x` cap in all modes (`MATH_AUDIT.json`, fingerprint `d03fab…278d8`) | Rendered and extracted Game Information must show the candidate-derived values exactly |
| 18 | Symbol payout information stated | `IMPLEMENTED_UNPROVEN` | **Math sub-gate PASS:** six-symbol paytable, books and representative rule fixtures passed the typed event/paytable verifier (`FIXTURE_INDEX.json`) | Import/verify the exact candidate table in the M2 rules UI and extracted frontend |
| 19 | Win combinations explained | `IMPLEMENTED_UNPROVEN` | **Math sub-gate PASS:** 7 × 7 orthogonal `5+` clusters, simultaneous resolution, cascade continuity and payout reconciliation passed candidate fixtures/tests | Implement and browser-check exact rule wording and five rendered cases per mode |
| 20 | Every mode description and cost stated | `IMPLEMENTED_UNPROVEN` | **Math sub-gate PASS:** registry/index/config agree on `base/deep_access/blackout`, costs `1/4/80`, labels and flags | Verify normal/social mode descriptions, costs and confirmations in the greybox/extracted frontend |
| 21 | Free-game/retrigger conditions stated | `IMPLEMENTED_UNPROVEN` | **Math sub-gate PASS:** Core arm, natural/direct BLACKOUT, 6–12 cycles, one-time ports, multipliers and cap event order passed deterministic fixtures | Render the exact trigger/extension/no-Scatter-retrigger rules and compare in browser |
| 22 | General disclaimer present | `TODO` | Current official disclaimer source is tracked elsewhere; no BLACKSITE Game Information UI | Insert current approved-equivalent text and verify exact extracted build |

## 23–24 — Auto Play / High-Cost Actions

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 23 | Auto-bet requires confirmation | `TODO` | No autoplay decision/UI exists | If implemented, selection then explicit Confirm E2E; otherwise document feature absence without hiding a requirement |
| 24 | High-cost modes require confirmation | `TODO` | DEEP ACCESS `4x` and BLACKOUT `80x` are frozen as enhanced/direct paid actions | M2 modal must show selected mode and exact total cost; Cancel/Escape/backdrop produce zero play calls |

## 25–29 — Responsive Checks

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 25 | Works on desktop/laptop | `TODO` | Presentation fixture contract exists; no app | Deterministic M2 suite on target desktop sizes, then exact-package run |
| 26 | Works on Popout S/L | `TODO` | Popout fixture IDs are reserved | Dedicated S/L geometry, legibility, input and Replay evidence |
| 27 | Works on mobile | `TODO` | Responsive recomposition is a later presentation gate | Portrait/landscape/common-device browser evidence and later real-device review |
| 28 | Double-tap zoom disabled | `TODO` | No viewport/touch implementation | Touch-action/viewport contract test without breaking accessible dialog scrolling |
| 29 | Interaction guide included | `TODO` | Rules contract requires a complete guide; no rendered controls | Map every final visible control/keyboard/touch action and verify Game Information |

## 30 — Sounds / Music

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 30 | Sound can be disabled | `TODO` | Audio is outside M1; mute requirement is retained | M3–M5 mute/session/Replay behavior and exact-package manual audio review |

## 31–34 — Language / Gameplay Validation

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 31 | English supported | `TODO` | Canonical English mode labels/rule semantics are frozen, not implemented | Complete first-render, controls, rules, Replay and error copy audit |
| 32 | Invalid language is safe | `TODO` | Fallback policy exists only at architecture level | Unknown-`lang` browser matrix with complete English fallback |
| 33 | Five wins per mode match rules | `TODO` | **Math sub-gate PASS:** all required positive-weight math cases are indexed within the 48/48 passing fixture set and reconcile to the typed schema/paytable | M2 must play and visually compare five cases per mode against rendered rules before the checklist row can pass |
| 34 | Mystery probabilities accurate if present | `NOT_APPLICABLE` | M1 explicitly freezes no Mystery Mode or Mystery symbol | Reopen only through a versioned product/math/compliance contract change |

## 35–39 — Stake.US / Social Mode

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 35 | Required Social translations/terminology | `TODO` | Social labels and restricted-copy policy are frozen; no complete string set | DOM/canvas-accessibility/rules/Replay/error scan from first render |
| 36 | SC/GC display without `$` | `TODO` | XSC/XGC/XEC no-dollar invariant is frozen | Game and Replay currency E2E including tiny values |
| 37 | Social mode naming is compliant | `IMPLEMENTED_UNPROVEN` | `STANDARD RUN`, `DEEP ACCESS`, `BLACKOUT ENTRY` are the frozen Social aliases | Compliance review against current vocabulary plus UI/confirmation/rules/Replay assertions |
| 38 | Social Replay has no restricted words | `TODO` | Replay uses the same social vocabulary contract; no Replay UI | Social Replay DOM/accessibility scan on loss, win, feature and max fixtures |
| 39 | English-only Social Mode | `TODO` | Contract requires approved English-only behavior; no runtime resolver | `social=true` with every supported/invalid `lang` resolves to the approved English social strings |

## 40–44 — Replay Support

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 40 | Replay URL loads/plays requested event | `TODO` | Sessionless/read-only, common event-handler contract is frozen | M2 exact URL/endpoint E2E with zero auth/play/end-round/wallet calls |
| 41 | Optional Replay currency/language/amount | `TODO` | Precision/social/fallback policy is defined | Fractional amount, fiat/social currency and invalid-language parameter matrix |
| 42 | Play Again repeats event | `TODO` | Deterministic reset semantics are frozen | Same final result/events on repeat with no wallet side effects or listener accumulation |
| 43 | Replay shows play cost and multiplier | `TODO` | Canonical mode cost and final centi-x units are frozen | Query amount × mode cost and final win browser equality, including fractional cases |
| 44 | Replay works in Popout S | `TODO` | Fixture is reserved | Popout-S Replay loading/ready/playing/completed geometry and input proof |

## 45–51 — Final Approval / Release

| ID | Requirement | M1 status | Current M1 evidence | Next gate to advance |
|---:|---|---|---|---|
| 45 | Bet-level templates applied | `EXTERNAL_PENDING` | **Repository math sub-gate PASS:** the verified candidate's Base `1x`, max cost `80x`, Max Win `10,000x` and exposure probe satisfy at least one viable template (`MATH_AUDIT.json`) | Retain exact Stake-side template application/ACP evidence for this candidate version; repository math cannot self-certify application |
| 46 | Provably Fair and Replay enabled | `TODO` | Stateless fixed-book and Replay contracts exist; no BLACKSITE frontend/publication | Repository Replay proof first, then Stake-side enablement/publication evidence |
| 47 | Front and Math requests approved | `EXTERNAL_PENDING` | No submission has occurred and no approval is claimed | External Stake/ACP approvals tied to exact frontend/math versions and hashes |
| 48 | Posted in approved Slack channel | `EXTERNAL_PENDING` | Not performed in M1 | External Slack link/evidence after actual approval |
| 49 | Works on older Android/iOS | `TODO` | No frontend or defined tested device floor yet | M5 real-device/device-farm/manual evidence; emulation alone is insufficient |
| 50 | Close approval request after live; Slack emoji workflow | `EXTERNAL_PENDING` | Post-release operation cannot occur in M1 | External evidence only after verified go-live |
| 51 | Game Released | `EXTERNAL_PENDING` | No candidate submission or production availability | Verify actual production game; never infer from build, commit, push, merge or upload |

## M1 compliance verdict

- Gate D has **no known product-design contradiction**: the frozen game is stateless, has one canonical Base, fixed mode identity/cost/RTP/cap, authoritative events, Replay/restore boundaries, explicit high-cost actions, Social aliases and no prohibited continuation/cashout/jackpot mechanic.
- Gate B is **PASS for the initial non-release math candidate**: 300,000 books, 90/90 automated gates, 48/48 fixtures and 7/7 tests passed under fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8` and typed schema `bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29`. Evidence is `VERIFY_RESULT.json`, `CANDIDATE_MANIFEST.json`, `MATH_AUDIT.json`, `RISK_AUDIT.json` and `FIXTURE_INDEX.json`.
- The automated candidate passes the selected mathematical 3-star verification profile, including both interpretations of the unresolved official tail-source values. This is not an earned visual/studio quality rating or external Stake verdict.
- Working-title clearance remains `REVIEW_REQUIRED`; this does not authorize branding publication.
- M1 is closed for the initial candidate and M2 has started only as a greybox behind the frozen event/state interface. It cannot turn any frontend, manual, exact-package or external row green by architecture inheritance alone.
- Current truthful checklist result is **0 automated PASS + 0 manual PASS + 1 not applicable + 50 still requiring evidence or external action**.
