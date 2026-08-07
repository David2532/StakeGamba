# BLACKSITE // BREACH — Stake 51-Point Approval Matrix

Status: **PROJECT CONTRACT — NOT YET PASSED**  
Source set reviewed: **2026-08-07**

This file turns the exact 51-point checklist supplied for this project into a build/test/release contract. Do **not** tick an item because the Golden Goal Rush implementation passed it; BLACKSITE needs evidence from its own exact frontend/math candidate.

Statuses allowed: `TODO`, `IMPLEMENTED_UNPROVEN`, `PASS_AUTOMATED`, `PASS_MANUAL`, `EXTERNAL_PENDING`, `NOT_APPLICABLE`, `BLOCKED`.

## Evidence rule

Each item must eventually record:

- exact requirement;
- implementation owner/file;
- automated test or manual procedure;
- exact candidate commit + frontend/math hashes;
- evidence artifact/screenshot/network proof;
- status and date;
- external confirmation when the item is outside repository authority.

## A. PreChecks

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 01 | Game authenticates with RGS successfully on game launch | RGS/Replay Engineer | Browser network proof for `/wallet/authenticate`, valid session, no local fallback, exact launch URL/query handling. |
| 02 | Game authentication fails correctly with an invalid `rgs_url` | RGS/Replay Engineer | Browser test with invalid URL: visible/fatal safe error, no simulated paid game, no stuck loader. |
| 03 | Clicking bet sends a successful play request to RGS | Frontend + RGS | Browser proof that user action results in one correct `/wallet/play` request with authoritative amount/mode and renders returned book. |
| 04 | Game does not contain the Stake Engine Loader | Frontend + Compliance | Static scan + extracted-build visual/network check. |

## B. Compliance Checks

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 05 | Game title is unique and does not use restricted terms | Creative + Compliance | Current title/search/legal check and Social Mode terminology scan. |
| 06 | Assets/imagery contain no offensive or inappropriate content | Creative + Asset + Compliance | Asset manifest review + human visual review. |
| 07 | Game is sufficiently distinct from existing titles/series | Creative Director | Competitive review documenting original mechanic, identity, composition and art direction; no copied branding/assets. |

## C. Game Thumbnail / Tile

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 08 | Game thumbnail meets Stake artwork guidelines | Asset Director | Required background, transparent foreground/key art and provider logo; high-resolution source files; combined BG+FG size budget; manual tile preview. |

## D. Bet Levels

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 09 | Game dynamically uses all betting parameters from authenticate | Frontend + RGS | Tests for `minBet`, `maxBet`, `stepBet`, `defaultBetLevel`, `betLevels`, jurisdiction flags and mode costs; no hardcoded production bet list. |
| 10 | Active rounds restore the bet amount from authenticate response | RGS/Replay Engineer | Interrupted-round browser test proving restored amount/mode from authoritative round/auth data and zero duplicate play requests. |

## E. Currency Support

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 11 | Game supports and displays currencies correctly | Frontend + QA | Parameterized browser/format tests for Stake-supported fiat/social currencies and fallback currency-code handling. |
| 12 | Game displays sub-cent payouts correctly | Frontend + QA | Exact fractional WIN/float/replay cases at tiny bet levels; no premature rounding. Balance precision is tested separately from win precision. |

## F. RGS Requests

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 13 | Zero-win bets do not send an unnecessary frontend end-round request | RGS/Replay Engineer | Network proof matching current RGS auto-close/round-state contract. No settlement call based merely on loss/win presentation. |
| 14 | Insufficient-balance bets do not send a play request | Frontend + RGS | UI guard + RGS error-path browser tests; zero `/wallet/play` calls when known balance is insufficient. |

## G. Frontend Requirements

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 15 | Main game frame is not scrollable | Frontend + Mobile/Performance | Browser geometry checks for all target viewports; no horizontal/vertical document scrollbars. |
| 16 | Space bar is bound to the bet button | Frontend + QA | Keyboard E2E: one legal play action, respects blocking/confirm/replay/insufficient-funds states. |

## H. Game Rules

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 17 | RTP and Max Win clearly stated in rules | Math + Compliance | Values generated/validated from shipped math for every mode; browser text check. |
| 18 | Payout information per symbol clearly communicated | Math + Frontend | Paytable contract compares displayed values with shipped config/books. |
| 19 | Win combinations displayed in rules | Math + Compliance | Rules describe cluster/ways/lines/other exact win mechanic and thresholds; five-win spot checks. |
| 20 | Game modes include description and cost | Math + Frontend | All published modes listed with canonical name, action and cost multiplier. |
| 21 | Free-game and re-trigger conditions clearly displayed | Math + Compliance | Rules match actual emitted triggers/retriggers; if no retrigger exists, say so unambiguously. |
| 22 | General disclaimer included | Compliance | Current Stake-equivalent disclaimer text present in Game Information and verified in extracted build. |

## I. Auto Play / High-Cost Actions

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 23 | Auto-bet requires confirmation before starting | Frontend + QA | First action opens selection/config; explicit Confirm required; Cancel/Escape/backdrop does not start. |
| 24 | High-cost bet modes require confirmation before activation | Frontend + Compliance | Confirmation gate includes exact total play cost and selected mode before sending RGS play. |

## J. Responsive Checks

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 25 | Game functions correctly on Desktop/Laptop | Frontend + QA | Deterministic fixture suite + real play flow on target desktop resolutions. |
| 26 | Game functions correctly on Popout S/L | Mobile/Performance + QA | Dedicated S/L viewport fixtures; board not distorted; controls/results readable. |
| 27 | Game functions correctly on Mobile | Mobile/Performance + QA | Portrait/landscape/common-device suite; gameplay/control parity. |
| 28 | Double-tap to zoom disabled on mobile | Frontend + QA | Viewport/touch-action contract and browser interaction test without breaking accessibility/scrolling inside legitimate dialogs. |
| 29 | User interaction guide included in Game Information | Frontend + Compliance | Every visible control maps to a clear guide entry; icon/keyboard/touch behaviour documented. |

## K. Sounds / Music

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 30 | Game provides option to disable sounds | Audio + Frontend | Mute toggles all game audio, persists for session as designed, and replay respects it. |

## L. Multiple Language Support / Gameplay Validation

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 31 | Game supports English | Frontend + Compliance | Complete English first render/rules/replay/error path. |
| 32 | Invalid language parameters do not break display | Frontend + QA | Unknown `lang` browser tests fall back safely without corrupt/empty UI. |
| 33 | Check five wins for each game mode against Game Rules | Math + QA | Deterministic/replay cases per mode comparing positions, symbol, multiplier, visible amount and final payout with rules/paytable. |
| 34 | If Mystery Mode exists, numerical chances/probabilities are accurate | Math + Compliance | If absent: `NOT_APPLICABLE`. If present: UI probability text is generated/verified against shipped math, never marketing guesswork. |

## M. Stake.US / Social Mode

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 35 | Game is compliant with required translations for a social game | Social/Currency lane + Compliance | Full Social Mode restricted-terminology scan across DOM, canvas accessibility strings, rules, replay and errors. |
| 36 | SC and GC display correctly without `$` prefix | Frontend + QA | XSC/XGC/XEC currency formatting E2E in game and replay. |
| 37 | Game-mode naming follows Social Mode terminology | Compliance + Frontend | Canonical social labels/phrases tested in feature panel, confirmations, rules and replay. |
| 38 | Replay window contains no restricted Social Mode words | Replay + Compliance | Social replay DOM/text/accessibility scan. |
| 39 | English is the only supported language in Social Mode | Frontend + Compliance | `social=true` with other `lang` values resolves to the approved English social strings. |

## N. Replay Support

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 40 | Supports replay URLs and loads/plays requested event | RGS/Replay Engineer | Exact query contract + `GET /bet/replay/{game}/{version}/{mode}/{event}`; no session auth/wallet mutations. |
| 41 | Supports optional replay parameters such as currency/language/amount | Replay + Frontend | Parameter matrix with fractional amount/currency/social/invalid language cases. |
| 42 | Replay allows replaying the event again after completion | Replay + QA | `Play Again` deterministically resets presentation and produces same final result without network/wallet side effects. |
| 43 | Replay UI clearly displays play cost and applied multiplier | Replay + Math | Canonical mode cost multiplier and query amount produce exact displayed final play amount; final win matches replay payload. |
| 44 | Supports Replays in Popout S view | Replay + Mobile/Performance | Popout-S replay fixture with readable controls/result and no clipping/distortion. |

## O. Final Approval / Release Checklist

These items are **release lifecycle gates**. Several require Stake/ACP/Slack evidence and cannot be marked PASS by CI.

| ID | Requirement | Primary owner | Required proof before PASS |
|---|---|---|---|
| 45 | Game has bet-level templates applied | Math/RGS + Release | Current Stake-side/template requirement verified against exact candidate; repository config and ACP evidence retained. |
| 46 | Provably Fair and Replay are enabled | Release + Replay | Replay tests plus Stake-side Provably Fair/publication evidence for exact math version. |
| 47 | Front and Math requests are approved | Release Manager | External Stake/ACP approval evidence tied to exact frontend/math versions/hashes. `EXTERNAL_PENDING` until real. |
| 48 | Game is posted in `stake-engine-game-approved` channel | Release Manager | External Slack evidence/link. |
| 49 | Game works correctly on older Android and iOS devices | Mobile/Performance + QA | Real-device/device-farm/manual evidence on defined older-device floor, not desktop emulation alone. |
| 50 | Approval request is closed after game is live and emojis are added to Slack notification | Release Manager | External operational evidence after go-live. |
| 51 | Game Released | Release Manager | Actual production availability verified. Never inferred from build/merge/upload success. |

## Public-document alignment checked 2026-08-07

The public Stake material currently reinforces the following project rules:

- approval is bound to specific frontend/math versions;
- games must be stateless and original;
- post-release math/gameplay changes are not generally allowed;
- unique audio/visual assets, mobile and popout support are required;
- rules must communicate mode cost, RTP, Max Win, payouts and feature triggers;
- all authenticate-provided bet constraints/levels must be respected;
- Replay is mandatory for new approval submissions and is sessionless/read-only;
- Stake.US Social Mode uses restricted terminology and social currencies;
- the static math package requires `index.json`, lookup CSV(s) and zstd-compressed JSONL books with exact payout consistency;
- 3-star quality requires studio-level creativity/polish, clean art/animation, device testing and optimized loading/bundle behaviour.

The public submission-checklist page currently hides some exact criteria behind login. Therefore this repository treats the supplied 51-point checklist as the explicit project contract while re-checking public official documentation before each release candidate.
