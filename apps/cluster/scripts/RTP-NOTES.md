# Golden Goal Rush — RTP / balancing notes

The playable demo (`build-preview-html.mjs` → `preview.html`/`play.html`) and
the RTP simulation (`ggr-sim.mjs`) share one math config (`ggr-config.mjs`),
so what is measured is exactly what is played.

Run the simulation:

```bash
node apps/cluster/scripts/ggr-sim.mjs 1000000 40000   # baseSpins buySpins
```

## What was fixed

The feature was massively overpowered. The simulation proved it and drove the
tuning:

| Mode                | Before (orig config) | After tuning |
| ------------------- | -------------------- | ------------ |
| Base game           | **2526 %**           | **~98 %** (1M spins) |
| Buy: Feature Spins  | 10 290 %             | ~32 %        |
| Buy: Rainbow Spin   | 100 %                | ~12 %        |
| Buy: Golden Chance  | 423 %                | ~29 %        |
| Buy: All That Glit. | 1090 %               | ~37 %        |

Coin audit (always clean): base silver max = 20, base gold max = 500, zero
out-of-table base coins — i.e. a 60x silver can only ever come from a 20x coin
times an x3 badge, never from the RNG directly.

## Status

- **Base game ≈ 96–98 %** — the dominant metric; the exploit is gone.
- **No buy mode is exploitable** (all run player-unfavourable, ≤ ~37 %).
- The feature win distribution is very high-variance (rare 5 000–10 000x hits
  dominate), so reliable RTP needs large samples (≥ 1M base, the buy modes
  even more) — this matches the requested 10M-spin runs.

## Open (next balancing pass)

The bonus-buy modes are calibrated to the requested fixed Le-Bandit prices
(3 / 50 / 100 / 250×) but currently return well under 96 % because a single
rainbow spin / short free-spin set cannot pay those prices with the
base-safe feature strength. Bringing each buy to ~96 % at the fixed prices
needs either a free-spin-specific feature boost (stronger reveals / more
guaranteed arcs in the bought modes only) or a structural coin-distribution
redesign, then re-validated with large simulation runs. All levers live in
`ggr-config.mjs` (`blankWeight`, coin weights/values, `rainbowWeight`,
per-tier `rainbowBoost`, `maxCollectorCycles`, `maxWinMultiplier`).
