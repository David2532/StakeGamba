# Golden Goal Rush

Standalone HTML/CSS/JS prototype with separate frontend and slot math.

## Start

```powershell
cd "C:\Users\david\Downloads\StakeGamba\stake-upload\golden-goal-rush"
node dev-server.js
```

Open:

```text
http://127.0.0.1:6077/
```

## Structure

- `index.html`: app entry
- `front/`: UI, animations, symbol rendering
- `math/`: cluster pays, cascades, Golden Tiles, Goal Collector activations, bonuses, simulation
- `assets/`: existing Golden Goal Rush assets
- `assets/special/`: existing coin, multiplier, collector and reward assets

## Simulation

Run from the folder:

```powershell
node --input-type=module -e "import('./math/math.js').then(m => m.simulateSpins(100000, 1))"
```

For a longer run:

```powershell
node --input-type=module -e "import('./math/math.js').then(m => m.simulateSpins(1000000, 1))"
```

You can also run it in the browser console:

```js
window.goldenGoalMath.simulateSpins(100000, 1)
```

## Current Math

- Grid: 6x5.
- Cluster pays from 5 connected matching regular symbols.
- Connections are horizontal/vertical only.
- Wild substitutes regular symbols only.
- Scatter, Goal Collector, Coins, Multipliers and reward symbols do not pay as clusters.
- Winning cells become Golden Tiles.
- Basegame Golden Tiles expire at the end of the spin if no Goal Collector activates them.
- Bonus Golden Tiles persist until Goal Collector activation.
- Goal Collector activates Golden Tiles into Goal Rewards, Trophy Rewards, Multipliers, Extra Spins, Collector rewards or Blank.
- Multipliers apply additively to adjacent Coins in all 8 directions.
- Collector pays the final visible Coin sum again.
- Collector rewards can re-activate Golden Tiles, with strict limits.
- Max win cap: 10,000x bet.

Preview TODO: this standalone simulator is not the final Stake math package.
Do not ship changed weights, reward values, bonus-buy costs or retrigger rates
without a production simulation/RTP audit against the final engine contract.

No current RTP claim is made for the Phase 8B feature preview. Run a fresh
simulation after every weight/reward change and keep the result out of
production copy until the final math package is approved.
