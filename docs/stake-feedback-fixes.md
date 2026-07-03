# Stake Feedback Fixes

This document tracks the Stake Engine feedback fixes for Golden Goal Rush:
what Stake asked for, what was implemented, where, and which automated check
proves it. Every point below is enforced by `npm run stake:qa` (static +
functional + browser end-to-end gates) so a regression cannot slip through
unnoticed.

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

- **Fix:** fixed fullscreen viewport (`100dvh`, `overflow: hidden`), the
  stage extends beyond its 1200×675 base to cover the screen, and
  `--stage-x-shift`/`--stage-y-shift` re-center the play area (logo, board,
  meters, win overlays) inside the extended stage so portrait has no dead gap
  and landscape is no longer offset left. Dialogs counter-scale
  (`--stage-inv-scale`) so rules/menus render at native, readable size on
  phones.
- **Tests:** `stake-qa-e2e.mjs mobile` runs 390×844, 430×932, 768×1024 and
  844×390 in Chromium and asserts: stage and background art cover ≥98% of the
  viewport (no letterboxing), no scrollbars, board/HUD visible, spin button
  visible and actually hittable (`elementFromPoint`). Screenshots are stored
  in `artifacts/stake-qa/<timestamp>/e2e-screenshots/` as QA evidence.

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
```

Reports land in `artifacts/stake-qa/<timestamp>/` (`report.json`,
`e2e-report.json`, `e2e-screenshots/`). The publish/release pipelines
(`scripts/sync-stake-publish.ps1`, `scripts/stake-release-pipeline.ps1`) run
`scripts/stake-qa.mjs all` as a hard gate. The browser suite needs Playwright
and Chromium; without them `stake:qa` records an explicit SKIP with install
instructions (`npm i -D playwright && npx playwright install chromium`), and
`STAKE_QA_REQUIRE_E2E=1` turns that into a hard failure for CI.
