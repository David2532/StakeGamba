# Golden Goal Rush

Standalone HTML/CSS/JS prototype with separate frontend and slot math.

## Start

```powershell
cd "C:\Users\uschi\Desktop\wm slot"
node dev-server.js
```

Open:

```text
http://127.0.0.1:6077/
```

## Structure

- `index.html`: app entry
- `front/`: UI, animations, symbol rendering
- `math/`: cluster pays, cascades, golden squares, rainbow rewards, bonuses, simulation
- `assets/`: existing Golden Goal Rush assets
- `assets/special/`: existing coin, rainbow, multiplier and collector assets

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
- Scatter, Rainbow, Coins, Multipliers and Collector do not pay as clusters.
- Winning cells become Golden Squares.
- Basegame Golden Squares expire at the end of the spin if no Rainbow activates them.
- Bonus Golden Squares persist until Rainbow activation.
- Rainbow activates Golden Squares into Coins, Multipliers, Collector or Blank.
- Multipliers apply additively to adjacent Coins in all 8 directions.
- Collector pays the final visible Coin sum again.
- Collector can re-activate Golden Squares, with strict limits.
- Max win cap: 10,000x bet.

Final 100,000-spin sample after tuning:

```text
RTP: 95.948%
Hit rate: 31.035%
Bonus trigger: 1 in 196.9
Rainbow activation: 1 in 113
Max win observed: 1823.5x
```
