# Golden Goal Rush — bonus balancing notes (pre-work, no math changed yet)

Status: the current math is MVP-only and the bonus is heavily overpowered.
Nothing in this document changes behaviour — it maps where the numbers live
so the next balancing pass can be done deliberately.

## Measured state (generated library, 1000 base / 250 bonus books)

| Mode  | Cost | Mean payout multiplier | Implied RTP |
| ----- | ---- | ---------------------- | ----------- |
| base  | 1x   | ~0.375x                | ~37.5%      |
| bonus | 100x | ~1351.9x               | ~1351.9% of the 100x price |

- `library/lookup_tables/bonus_lookup.csv`: max payout **5050x** (book 228),
  21 books >= 2800x, 16 books >= 3000x.
- A 100x bonus buy returning ~1352x on average is a ~13.5x EV — this is the
  "bonus way too cheap / wins around 2800x-3000x too easy" report.
- Base game at ~37.5% RTP is far below any plausible target (config says 97%).

## Where the numbers come from

| Concern | Location |
| ------- | -------- |
| Bonus buy price (100x) | `game_config.py` -> `BET_MODES["bonus"]["cost"]` |
| Free spins count (8) | `game_config.py` -> `DEFAULT_TOTAL_FREE_SPINS` |
| Scatter trigger (3+) | `game_events.py` (`len(scatters) >= 3`) via `game_calculations.scatter_positions` |
| Line pays / paytable | `game_config.py` paytable + `game_calculations.calculate_line_wins` |
| Win level thresholds | `game_calculations.win_level_for_amount` |
| Reel strips (hit frequency) | `game_config.py` reels / `game_executables.py` board generation |
| Book/event generation | `game_executables.py`, `game_events.py`, `gamestate.py` |
| Frontend mirror of cost/RTP | `apps/lines/src/game/config.ts` (`betModes`, `rtp`, `max_win`) |
| Published artifacts | `library/` (books, lookup tables, `configs/game_config.json`, `publish_files/index.json`) |

Not implemented (do not document to players, do not balance yet):
collector feature, respins, retriggers, win multipliers (LineWin.multiplier is
always 1), and any "Golden Goal" special mechanic beyond the free spins.

## How to re-run the simulation

```bash
cd math/games/golden_goal_rush
python run.py publish --spins 100000 --bonus-spins 25000 --seed 1
```

Outputs land in `library/` (books, lookup tables, frontend config). The mean
of the lookup-table payout column per mode, divided by the mode cost, is the
empirical RTP.

## Recommended next balancing pass (separate task)

1. Decide the target base-game RTP and bonus RTP split (e.g. 96% total).
2. Tune free-spin EV first: reel strips for the freegame, free spin count,
   and/or introduce the planned multiplier logic — until mean bonus payout
   lands near `target_bonus_rtp * bonus_cost` (e.g. ~96x for a 100x buy).
3. Re-price `BET_MODES["bonus"]["cost"]` so cost ~= bonus EV / target RTP.
4. Raise base-game hit rate / pays toward the base RTP target.
5. Enforce the 5000x max-win cap during win calculation (books currently
   exceed it: 5050x observed) — cap in `game_calculations`/`game_executables`.
6. Regenerate `library/` with large simulation counts and update
   `apps/lines/src/game/config.ts` (`rtp`, `max_win`, costs) from the
   regenerated `library/configs/game_config.json`.
