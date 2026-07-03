# Stake QA Checklist

Run this checklist before uploading a new Stake package.

## Required Commands

```powershell
npm run stake:qa
npm run stake:publish
```

For focused checks:

```powershell
npm run stake:qa:currency
npm run stake:qa:i18n
npm run stake:qa:major-actions
npm run stake:qa:interrupted-round
npm run stake:qa:mobile
```

## Checks Covered

- Currency examples for all Stake-supported fiat, XGC, and XSC currencies.
- No old hardcoded Euro image usage in active Golden Goal Rush preview sources.
- Social casino insufficient copy uses "Insufficient Balance"; fiat uses "Insufficient Funds".
- Auto-Bet options are restricted to 10, 25, 50, 100, 200, and infinity.
- Auto-Bet does not start from the first button click; it requires confirmation.
- Bonus Buy and manual spin show insufficient-balance feedback before wallet play.
- Interrupted active bonus rounds show the required continue message before resume playback.
- Rules explain the main buttons and controls.
- Mobile fullscreen uses fixed viewport, `100dvh`, and stage fit variables.
- Regression markers confirm RGS, book rendering, end-round, and demo-only fallback guards are still present.

## Manual Visual Pass

- Open `apps/cluster/preview.html` with `?currency=XSC&social=true` and verify balance/bet/win use `SC` and insufficient copy says "Insufficient Balance".
- Open with `?currency=DKK` and verify suffix formatting such as `10.00 KR`.
- Resize to a mobile portrait viewport and verify there are no large black bars or scrollbars.
- Click Auto-Bet and verify no spin starts until an amount is selected and confirmed.
- Click Rules and verify Buttons & Controls is present.
