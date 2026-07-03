# Stake QA Checklist

Run this checklist before uploading a new Stake package.

## Required Commands

```powershell
npm run stake:qa       # all gates: static + functional + browser e2e
npm run stake:publish  # publish pipeline (runs stake:qa internally)
```

For focused checks:

```powershell
npm run stake:qa:currency            # currency formats + hardcode scan + HUD e2e
npm run stake:qa:insufficient-funds  # insufficient funds/balance behaviour e2e
npm run stake:qa:major-actions       # auto-bet/bonus-buy/major-action confirmation
npm run stake:qa:interrupted-round   # refresh-mid-bonus resume flow e2e
npm run stake:qa:mobile              # mobile fullscreen asserts + screenshots
npm run stake:qa:rules               # rules button audit + icon existence
npm run stake:qa:i18n                # insufficient copy wiring (static)
npm run stake:qa:regression          # RGS/math regression markers (static)
npm run stake:qa:e2e                 # the full browser suite on its own
```

The browser suite needs Playwright + Chromium. If they are missing,
`stake:qa` prints a SKIP with install instructions
(`npm i -D playwright && npx playwright install chromium`);
set `STAKE_QA_REQUIRE_E2E=1` (CI) to turn that SKIP into a failure.

## Checks Covered Automatically

- All 36 Stake currency examples (incl. `10.00 GC` / `10.00 SC`, suffix and
  zero-decimal currencies, `10.00 XYZ` fallback) — unit level and live in the
  HUD (EUR, USD, XSC, XGC, JPY, DKK, CLP).
- Repo-wide scan: no hardcoded currency symbol outside
  `packages/utils-shared/currency.js`.
- "Insufficient Funds" (fiat) vs "Insufficient Balance" (Stake.us/XSC/XGC)
  for spin, Auto-Bet and Bonus Buy — with proof that `/wallet/play` is never
  called and no spin/purchase starts.
- Auto-Bet: first click only opens the selection (10/25/50/100/200/∞),
  confirmation required, Cancel keeps it off; Bonus Buy needs its price
  confirmation; `confirmMajorAction()` gate for future major actions
  (e.g. Double Chance) resolves true only on explicit Confirm.
- Interrupted bonus: mocked RGS active round → resume message with the exact
  required copy, spin/auto/bonus blocked while open, Continue resumes the
  saved round without a second bet, exactly one `/wallet/end-round`, settled
  balance applied, state cleaned up (EUR and XSC/Stake.us).
- Mobile fullscreen at 390×844, 430×932, 768×1024, 844×390: stage and
  background cover ≥98% of the viewport, no scrollbars, board/HUD visible,
  spin button hittable; screenshots saved under
  `artifacts/stake-qa/<timestamp>/e2e-screenshots/`.
- Rules → Buttons & Controls: every visible control has an entry, every icon
  loads (no 404), no placeholder texts, dialog readable/scrollable on mobile,
  every referenced asset file exists on disk.
- Regression markers: RGS endpoints, end-round guard, book renderer,
  demo-only local free spins and math config imports are still intact.

## Manual Visual Pass

- Open `apps/cluster/preview.html` with `?currency=XSC&social=true` and verify
  balance/bet/win use `SC` and insufficient copy says "Insufficient Balance".
- Open with `?currency=DKK` and verify suffix formatting such as `10.00 KR`.
- Resize to a mobile portrait viewport and verify the board is centered with
  no large black bars or scrollbars; rotate to landscape and verify the
  controls stay centered.
- Click Auto-Bet and verify no spin starts until an amount is selected and
  confirmed; cancel once and confirm once.
- Open Bonus Buy and verify the price confirmation appears before purchase.
- Click Rules and verify Buttons & Controls lists every button with its icon,
  on desktop and on a phone-sized window.
- With a Stake session: start a bonus, refresh mid-bonus, and verify the
  interrupted-round message appears and Continue resumes without a new bet.
