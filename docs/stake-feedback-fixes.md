# Stake Feedback Fixes

This document tracks the Stake Engine feedback fixes for Golden Goal Rush:
what Stake asked for, what was implemented, where, and which automated check
proves it. The final release run must complete `npm run stake:qa`, the mandatory
browser suite, and the publish/release gates before this document can be used as
approval evidence.

## 1. Currency display

> "Please ensure that each currency displays the correct abbreviation or
> symbol. Different currencies should not share the same symbol."

- **Fix:** central metadata + formatter in `packages/utils-shared/currency.js`
  (all 36 Stake currencies incl. `XGC → 10.00 GC`, `XSC → 10.00 SC`, suffix
  currencies like DKK/PLN/CLP/ARS/SAR, zero-decimal JPY/IDR/KRW/VND/CLP,
  unknown-currency fallback `10.00 XYZ`). The preview
  (`apps/cluster/scripts/build-preview-html.mjs`) uses it for balance, bet,
  win, bet panel, bonus-buy prices, confirmation dialogs, banners and
  summaries; `packages/utils-shared/amount.ts` routes the shared Svelte UI
  through the same formatter. The WIN meter is formatted through
  `updateMeters()` too, so it reads `0 CLP` / `0.00 SC` at load.
- **Tests:**
  - `stake-qa.mjs currency` — imports the real module and asserts all 36
    Stake example strings plus fallback and Stake.us symbols (unit test).
  - `currency-source` gate — repo-wide scan (apps/*/src, apps/cluster/scripts,
    packages/**) fails on any hardcoded currency symbol outside
    `currency.js`.
  - `stake-qa-e2e.mjs currency` — real Chromium run asserting the live HUD
    strings for EUR, USD, XSC, XGC, JPY, DKK, CLP.

## 2. Interrupted bonus / refresh mid-bonus

> "When we refresh the page in the middle of the bonus, please make sure that
> there is a message letting the user know that their round has been
> interrupted and that they can continue where they left off."

- **Fix:** on launch, `resumeLaunchRound()` authenticates with the RGS; if an
  active bonus round comes back, the persistent modal
  `#modal-interrupted-round` shows "Your previous round was interrupted. You
  can continue where you left off." with a Continue button. While it is open,
  `walletBusy` blocks spin, Auto-Bet, Bonus Buy and bet changes, and the
  modal backdrop physically covers the controls. Continue replays the saved
  RGS round state (`playRgsBookRound` from the stored resume index) — no new
  `/wallet/play`, therefore no second bet — and settles once via
  `/wallet/end-round`, applying the wallet balance from the settlement.
- **Tests:** `stake-qa-e2e.mjs interrupted-round` mocks the Stake RGS
  (`/wallet/authenticate` returns an active bonus round) and proves, for EUR
  and XSC/Stake.us: message + exact copy, all actions blocked (physically and
  logically), `play calls = 0`, `end-round calls = 1`, progress events saved,
  settled balance applied and shown, modal cleaned up, game back to idle.
  Static gates keep the modal markup, copy and resume-order markers in place.

## 3. Auto-Bet / major actions need confirmation

> "Please ensure that the Auto-Bet feature cannot be initiated with a single
> click … selection of spin amounts, such as 10, 25, 50, 100, 200, and
> Infinite, followed by a confirmation step." / "No major action … should be
> activated with a single click."

- **Fix:** the Auto-Bet button only opens the selection modal
  (10/25/50/100/200/∞); picking an amount reveals a Confirm/Cancel step;
  only Confirm starts the scheduler. Bonus Buy keeps its two-step flow
  (offer list → price confirmation → purchase). For future major actions
  (e.g. a Double Chance toggle) the preview now ships a generic
  `confirmMajorAction({ title, body })` gate (promise resolves `true` only on
  an explicit Confirm; Cancel/backdrop/Escape resolve `false`), exposed via
  `window.__ggr.confirmMajorAction` and backed by `#modal-major-confirm`.
- **Tests:** `stake-qa-e2e.mjs major-actions` proves in the browser: first
  click starts nothing, options are exactly 10/25/50/100/200/∞, selection
  alone does not arm auto-bet, Cancel keeps it off, Confirm starts it, Bonus
  Buy first click buys nothing and its Cancel path leaves the balance
  untouched, and the `confirmMajorAction` gate resolves correctly for
  Confirm/Cancel/Escape. Static gates pin the option list, the confirm
  functions and the gate's existence.

## 4. Insufficient Funds / Insufficient Balance

> "Please add the message 'Insufficient Funds' when the player's bet amount
> exceeds the available balance. Also, the message should state 'Insufficient
> Balance' for Stake.us translation."

- **Fix:** `insufficientFundsTitle()` picks "Insufficient Balance" for
  Stake.us (social flag or XGC/XSC) and "Insufficient Funds" otherwise; the
  check runs before any animation or wallet call for manual spin, Auto-Bet
  confirm/loop and Bonus Buy (both the offer click and the final confirm).
  The shared Svelte UI derives the same copy via
  `insufficientFundsMessage()` in `packages/components-ui-html`.
- **Tests:** `stake-qa-e2e.mjs insufficient-funds` launches with a mocked
  RGS balance of 0.01 and proves for EUR ("Insufficient Funds") and
  XSC/Stake.us ("Insufficient Balance"): correct message for spin, Auto-Bet
  and Bonus Buy, `/wallet/play` is never called, no spin starts, balance
  unchanged.

## 5. Mobile view fills the screen

> "Please make sure that the game fills the screen in Mobile views."

- **Fix:** fixed fullscreen viewport (`100dvh` with `svh`/`vh` fallbacks,
  `overflow: hidden`), the stage extends beyond its 1200×675 base to cover
  the screen, and `--stage-x-shift`/`--stage-y-shift` re-center the play area
  (logo, board, meters, win overlays) inside the extended stage so portrait
  has no dead gap and landscape is no longer offset left. Dialogs
  counter-scale (`--stage-inv-scale`) so rules/menus render at native,
  readable size on phones.
- **Playable portrait (phones ≤700px):** `fitViewport()` switches to a
  board-first fit (`.mobile-portrait`): the board scales to ~94vw (max
  460px), and the HUD/controls counter-scale to fixed on-screen sizes via
  `--mobile-control-size`/`--mobile-spin-size`/`--mobile-hud-font-size` —
  spin 66×66px, every other button ≥44×48px, balance/bet/win at 13px, the
  bottom bar wraps into two thumb rows inside the safe area
  (`--mobile-bottom-safe-padding` with `env(safe-area-inset-bottom)`). Same
  buttons, same DOM, layout/scaling only.
- **Tests:** `stake-qa-e2e.mjs mobile` runs 360×740, 390×844, 430×932,
  450×900, 768×1024 and 844×390 in Chromium and asserts: stage and background
  art cover ≥98% of the viewport (no letterboxing), no scrollbars, board/HUD
  visible, spin button visible and actually hittable (`elementFromPoint`);
  on portrait phones additionally: board ≥88vw, HUD value text ≥10px, spin
  ≥56×56, and every control button ≥44×44 and fully on screen. Screenshots
  are stored in `artifacts/stake-qa/<timestamp>/e2e-screenshots/` as QA
  evidence.

## 6. Rules explain every button

> "Please make sure to outline the purpose of each button in the game rules;
> Explain what each button does. Also, please attach the symbol of every
> button and a description next to it."

- **Fix:** the Rules modal has a "Buttons & Controls" section with the real
  UI icon, name and description for all 14 controls (Spin, Auto-Bet, Turbo,
  Bonus Buy, Bet −/+, Bet Selector, Info/Rules, Settings, Menu, Sound/Music,
  Collect, Free-Spins panel, Close Modal), rendered from the same asset files
  as the HUD.
- **Tests:** `stake-qa-e2e.mjs rules` enumerates the visible controls in the
  DOM and fails if any visible control has no rules entry, verifies every
  entry's icon actually loads (`naturalWidth > 0`), rejects placeholder
  descriptions, and checks the dialog is on-screen, readable and scrollable
  on mobile. `stake-qa.mjs rules` additionally verifies every asset path in
  the generated preview exists on disk.

## 7. Stake Replay Mode compliance

### Launch, endpoint, and read-only boundary

- Replay Mode is selected only by the Stake launch parameter `replay=true`.
  Replay launch validation handles `rgs_url`, `game`, `version`, `mode`,
  `event`, `amount`, `currency`, `lang`, and `device` separately from a normal
  wallet launch; it does not require a normal `sessionID`.
- The standalone Stake frontend in
  `apps/cluster/scripts/build-preview-html.mjs` owns the dedicated `Replay`
  controller. It requests the saved round with:

  `GET /bet/replay/{game}/{version}/{mode}/{event}`

  Each path segment is URL-encoded and the request is made against the supplied
  `rgs_url`. Replay does not authenticate a wallet and never saves or settles
  an event.
- The replay path is a hard read-only boundary. It must make zero calls to
  `/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`, `/bet/event`,
  local paid-spin generation, or any bonus-purchase action. Normal spin, bet,
  Auto-Bet, Bonus Buy, keyboard, recovery, and authentication entry points all
  retain logical replay guards in addition to UI hiding.

### Lifecycle and controls

- The explicit lifecycle is `loading`, `ready`, `running`, `completed`, or
  `error`. Loading and replay-specific errors occupy the game stage; an error
  remains read-only and never falls back to a random/demo result.
- After a valid saved round loads, playback waits for the dedicated **Replay
  Play** control. It does not reuse or resemble the normal Spin action.
  Playback uses the existing authoritative `playRgsBookRound()` event renderer
  for reveal, cluster positions and step wins, tumbles, Golden Cells, feature
  awards, free spins, and the final result.
- Completion exposes **Play Again**. It resets board/highlights, Golden Cells,
  feature and free-spin counters, running/final win, overlays, skip/audio state,
  and playback cursors, then replays an immutable copy of the same saved event
  sequence. Repeated playback must therefore show the same outcome without
  accumulating winnings.

### Hidden versus displayed UI

Replay removes from layout, pointer interaction, and keyboard navigation:

- Balance
- normal Spin
- editable Bet selector and Bet minus/plus
- Auto-Bet and autoplay settings
- Bonus Buy and every other paid-round action

Replay keeps visible and display-only:

- **Win Amount**, sourced from the saved RGS round/event result
- **Replay Bet Amount**, sourced from replay launch/response data
- the replay currency, formatted by the shared fiat/Stake.us currency metadata
- **Replay Play** and **Play Again**
- permitted non-betting settings such as sound/replay speed

The same contract applies in desktop, mobile landscape, phone portrait, and
tablet layouts; hidden normal controls may not remain clickable below an
overlay.

## 8. Paytable / payout root cause and fix

### Root cause

The reported visible round amounts were correct for the submitted production
math, but the standalone frontend Paytable was stale. Its former local demo
configuration showed lower base values (including K `0.18`, Q `0.13`, and J
`0.09`) while the production RGS books used K `0.48`, Q `0.36`, and J `0.28`
with the production cluster-size boosts.

No approved production specification supporting the lower values exists in
this repository. Therefore production math, books, lookup weights,
probabilities, RTP, and max-win behavior are not changed for this fix.

### Production source of truth

For this submission the exact contract is `publish/math/game_config.json`. Its
generation/publish chain is:

1. `math/games/golden_goal_rush/game_config.py` defines symbol base pays.
2. `math/games/golden_goal_rush/game_calculations.py` applies cluster ranges
   5-6 x1, 7-8 x2, 9-11 x4, and 12+ x8.
3. `math/games/golden_goal_rush/run.py` writes
   `math/games/golden_goal_rush/library/configs/game_config.json` and the books,
   lookups, and audit files.
4. `scripts/sync-stake-publish.ps1` copies those exact files to `publish/math`
   before building the standalone frontend.
5. `apps/cluster/scripts/production-math-contract.mjs` validates and imports
   the generated/published config at build time. Missing symbols, thresholds,
   boosts, invalid numbers, or generated/published drift fail the build; there
   is no hardcoded production Paytable fallback.

`ggr-config.mjs` is now explicitly limited to local visual/demo frequencies
and feature settings. Its paying values come from the production contract; it
no longer claims to be a second global math source.

### Correct payout examples

| Symbol / cluster | Production base pay | Cluster-size boost | Paytable / RGS step |
| --- | ---: | ---: | ---: |
| K 5+ (5-6) | 0.48x | 1x | **0.48x** |
| Q 5+ (5-6) | 0.36x | 1x | **0.36x** |
| J 7+ (7-8) | 0.28x | 2x | **0.56x** |

All values are multipliers of the active bet. A winning cluster contains at
least five orthogonally connected matching symbols; substituting Wilds count
toward the displayed cluster size. The cascade multiplier starts at 1x and
increments after each successful cascade, so a later per-cluster animation may
exceed the unmultiplied Paytable entry. A floating amount is one win step; the
final WIN meter is cumulative for the complete round.

RGS play and replay rendering use authoritative `wins[].win`, `totalWin`,
`finalWin`, and settled round payout fields. Client Paytable values are not
used to recalculate or invent an RGS result.

## 9. Drift-prevention release gates

- The production contract validates every paying symbol and its `cluster5`,
  `cluster7Boost`, `cluster9Boost`, and `cluster12Boost` values, then embeds the
  normalized numerical Paytable in `preview.html`.
- The Paytable formatter preserves significant precision (for example `0.48`,
  `2.88`, and `3.84`) while trimming only insignificant trailing zeroes.
- The publish sync refreshes/reuses math first, copies the authoritative config
  into `publish/math`, builds the frontend second, and runs the deterministic
  builder `--check` mode.
- The sync fails unless the generated math config and published math config are
  byte-identical, `apps/cluster/preview.html` and
  `publish/frontend/index.html` are byte-identical, and every embedded frontend
  symbol/base/boost/computed threshold value numerically equals
  `publish/math/game_config.json`.
- Static/unit/browser QA additionally covers the production K/Q/J examples,
  all symbols and thresholds, six J plus one connecting Wild, Paytable DOM
  content/formatting, authoritative event totals, replay read-only networking,
  hidden/interactivity requirements, and deterministic Play Again behavior.

## 10. Final QA evidence for this Stake response

Populate these paths from the final clean release run; do not replace them with
older evidence:

- Combined QA report: **TBD - `artifacts/stake-qa/<final-timestamp>/report.json`**
- Browser report: **TBD - `artifacts/stake-qa/<final-timestamp>/e2e-report.json`**
- Replay screenshots: **TBD - `artifacts/stake-qa/<final-timestamp>/e2e-screenshots/`**
- Final release report: **TBD - `stake-release/<final-release>/stake-release-report.md`**
- Final approval checklist: **TBD - `stake-release/<final-release>/stake-approval-checklist.md`**
- Final release manifest/ZIP: **TBD - `stake-release/<final-release>/manifest.json` and matching `.zip`**

The final evidence must include Base and bonus/free-spin replay runs, all
required viewports, the observed replay GET URL, a forbidden wallet/session
call count of zero, production Paytable DOM comparisons, and before/after
SHA-256 confirmation that production configs, books, lookups, and RTP audit
artifacts did not change.

## Existing behavior preserved

- Math configuration, RTP values, symbol weights, lookup/book generation and
  win-calculation rules were not changed.
- RGS `authenticate`, `play`, `endRound`, active-base settlement,
  active-bonus resume and book-rendering flows remain in place (pinned by the
  `regression-markers` QA group).
- Bonus Buy still uses the existing `showBuyConfirm` flow before purchase.
- Free Spins, cascade resolution, Golden Cells, coin/multiplier/collector
  feature logic, win banners and audio hooks were not rebuilt.

## Verification

```
npm run stake:qa          # static + functional + browser e2e, one report
npm run stake:qa:e2e      # browser e2e only
npm run stake:publish     # authoritative math -> frontend -> publish snapshot
npm run stake:release     # final validated release folder, reports and ZIP
```

Reports land in `artifacts/stake-qa/<timestamp>/` (`report.json`,
`e2e-report.json`, `e2e-screenshots/`). The publish/release pipelines
(`scripts/sync-stake-publish.ps1`, `scripts/stake-release-pipeline.ps1`) run
`scripts/stake-qa.mjs all` as a hard gate. Playwright and Chromium are required
for a releasable package (`npm i -D playwright && npx playwright install
chromium`). CI and the final release run set `STAKE_QA_REQUIRE_E2E=1`; a missing
browser or any skipped browser suite is a release failure, not acceptable Stake
approval evidence.
