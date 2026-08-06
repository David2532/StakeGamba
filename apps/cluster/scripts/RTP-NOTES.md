# Golden Goal Rush - legacy local-demo balancing notes

> **Not production Stake math.** This file documents historical measurements
> of the optional browser-local demo generator and `ggr-sim.mjs`. It does not
> describe the published RGS books, lookup probabilities, or certified RTP and
> must not be quoted as submission evidence.

The authoritative submission sources are:

- `publish/math/game_config.json` for the published symbol/cluster contract
- `publish/math/RTP_AUDIT.json` (and `RTP_AUDIT.txt`) for achieved RTP and tail
  metrics
- the books and lookup tables referenced by `publish/math/index.json`

`ggr-config.mjs` contains only local visual/demo frequencies and feature
settings. Its paying values are imported from the production math contract so
it cannot become a second Paytable source. The local demo and `ggr-sim.mjs`
share those demo settings, but neither determines Stake RGS outcomes or RTP.

Run the simulation:

```bash
node apps/cluster/scripts/ggr-sim.mjs 10000000 120000   # baseSpins buySpins
```

## Every way to win

1. **Cluster pays (base game).** 5+ orthogonally-connected matching symbols
   pay `SYMBOL_MATH[symbol].pay`, scaled by cluster size (×1 at 5–6, ×2 at
   7–8, ×4 at 9–11, ×8 at 12+). Each cascade in a chain raises a step
   multiplier (×1, ×2, ×3 …). Wilds substitute; scatters/rainbow do not pay.
2. **Coin feature (Golden Cells + Golden Arc).** Every winning position becomes
   a Golden Cell. While a Rainbow/Arc is on the board the Golden Cells reveal:
   Bronze (0.2–4×), Silver (5–20×) or Gold (25–500×) coins, Multiplier Badges
   (×2–×10, applied to adjacent coins) and Collector Cups (collect the sum of
   all visible coins, then re-roll — up to `maxCollectorCycles`).
3. **Free Spins (scatter triggered).** 3 / 4 / 5 scatters start Tier 1 / 2 / 3
   (Golden Chance 8 / All That Glitters 12 / End of the Rainbow 12). Tiers
   persist Golden Cells, boost the rainbow rate and (Tier 3) guarantee an Arc
   each spin. 2+ scatters during the bonus retrigger (+2/+4 spins), and 4
   scatters in Tier 1 escalates it to Tier 2.
4. **Bonus Buy.** Feature Spins, Rainbow Spin, Golden Chance (Tier 1) and All
   That Glitters (Tier 2). Tier 3 is **not** buyable — it can only trigger
   naturally from 5 scatters.

## Historical local-demo measurements (non-authoritative)

The figures below are retained only as development history. They are not the
current published Stake RTP; use `publish/math/RTP_AUDIT.json` instead.

| Mode                | Price  | RTP    | Notes |
| ------------------- | ------ | ------ | ----- |
| Base game           | 1×     | 96.2%  | 4M spins; ~73% of it is free-spin triggers |
| Buy: Feature Spins  | 4.2×   | ~95%   | one paid spin, rainbow chance ×`huntBoost` |
| Buy: Rainbow Spin   | 6×     | ~96%   | one paid spin, guaranteed Arc |
| Buy: Golden Chance  | 31×    | ~98%   | Tier 1, 8 free spins |
| Buy: All That Glit. | 95×    | ~97%   | Tier 2, 12 free spins |

Coin audit (always clean): base silver max = 20, base gold max = 500, zero
out-of-table base coins — i.e. a 60× silver can only ever come from a 20× coin
times an ×3 badge, never from the RNG directly.

## Historical local-demo tuning context

The old local demo tuning described below was performed in `ggr-config.mjs`.
It did not create or approve the production Stake books or lookup weights:

- **Buy prices** were the real problem: at the old 3 / 50 / 100 / 250× prices
  the buys returned only 12–37 %, i.e. the player lost 60–88 % per purchase.
  Each price is now set to `avg feature win / 0.96`, so every buy returns ~96 %
  and is never a rip-off. `huntBoost` (the rainbow multiplier on the Feature
  Spins buy) was raised so that buy is a meaningful purchase, not a near-noop.
- **Base game** was ~99.5 % (12M-spin baseline). Symbol pays were trimmed ~11 %
  to land it at ~96 %. Because free-spin wins are feature-dominated (~92 %
  feature, ~8 % cluster), trimming cluster pays moves the base game without
  disturbing the buy modes.

## Variance / verification

Base RTP is dominated by rare free-spin triggers, and the feature can reach the
10,000× cap, so the headline figure has a fat upper tail — it needs large
samples to converge (a 2M run read 105 % where 12M converged to ~99.5 %). This
is normal for a 10,000×-cap cluster-cascade game. The expected value is set via
the stable, low-variance levers (cluster pays for the base, measured average
feature win for each buy price); the cap and coin tables are deliberately left
intact so the big-win ceiling (Golden Goal takeover) is preserved.

The local demo levers live in `ggr-config.mjs` (visual RNG weights,
`blankWeight`, coin weights/values, `rainbowWeight`, `scatterWeight`,
`huntBoost`, per-tier parameters, and local bonus-buy presentation). Production
base pays and cluster boosts come from `publish/math/game_config.json`; Stake
probabilities and RTP come from the published books, lookups, and RTP audit.
