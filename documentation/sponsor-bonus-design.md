# Golden Goal Rush — "Golden Sponsor Bonus" design (prepared, not yet live)

Status: **concept + integration plan**. The current math
(`math/games/golden_goal_rush/`) is a 5x3, 20-line game with a plain
8-free-spin bonus. None of the features below exist in the books yet, so the
frontend deliberately does **not** fake them — this document and the imported
`special/` assets prepare the feature so it can be implemented math-first.

## Theme

During Free Spins the stadium's sponsors "activate". Special symbols land on
the reels:

| Feature symbol | Asset (already imported) | Role |
| -------------- | ------------------------ | ---- |
| Sponsor Coin | `special/coin_*.png` (0.2x–500x) | carries a bet-multiple cash value |
| Sponsor Multiplier | `special/x2|x3|x4|x5|x10.png` | multiplies collected coins, rare |
| Trophy Collector | `special/collector.png`, `special/symbol_collector.png` | collects all visible coins, count-up animation |
| VIP Ticket (Scatter) | existing `scatter.png` | triggers / retriggers the bonus |
| Golden Goal | `special/gold|silber|bronze|rainbow.png` tiers | rare booster: extra respins, multiplier or extra coins |

Assets live in `apps/lines/src/assets/golden-goal-rush/special/` (copied 1:1
from the stake-upload master).

## Required book-event contract (to be emitted by the math)

The frontend event pipeline (`bookEventHandlerMap.ts`) needs these new book
events; names follow the existing camelCase convention:

- `sponsorCoinLand` — `{ reel, row, valueMultiplier }`
- `sponsorMultiplierLand` — `{ reel, row, factor }`
- `sponsorCollect` — `{ collectorPosition, coinPositions, totalAmount }`
- `goldenGoalBoost` — `{ kind: 'respins' | 'multiplier' | 'coins', ... }`

Frontend work once the math emits them: handler entries in
`bookEventHandlerMap.ts`, a coin/collector overlay component (coin flip +
value reveal, fly-to-collector tween, count-up via `WinCountUpProvider`), and
a bonus-intro overlay ("SPONSOR BONUS" + stadium flash).

## Balancing guardrails (hard requirements before shipping)

The bonus is currently massively overpowered even WITHOUT these features
(see `math/games/golden_goal_rush/BALANCING_NOTES.md`: ~1351x mean on a 100x
buy). Any sponsor-feature math must be designed inside a rebalance to ~96%
total RTP:

- coin values weighted heavily toward 0.2x–5x; 100x+ coins exceptional
- multipliers capped (suggest max x10, at most one active per spin)
- collector limited per bonus (no infinite collect loops)
- respins strictly bounded (e.g. max 3 per bonus)
- 5000x max-win cap enforced at calculation time
- bonus-buy price re-derived from simulated bonus EV
- full simulation run (`run.py publish` with large counts) before any claim
  about RTP

## Explicitly out of scope until the math exists

- No frontend-side random coin values (would diverge from server books)
- No InfoBook page describing the feature (InfoBook only documents live rules)
- No 6x5/cascade board: the visual board mirrors the real 5x3/20-line math;
  switching to 6x5 cascades is a math-engine rewrite, tracked as its own task
