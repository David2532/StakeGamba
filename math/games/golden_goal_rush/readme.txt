Golden Goal Rush Math MVP
=========================

This is a local MVP math scaffold for the existing apps/lines frontend.
It is intentionally not a final or regulator-approved math package.

Structure choice:
- The repository had no existing math/, games/, Stake Math SDK sample, or publish_files root.
- This game therefore lives under math/games/golden_goal_rush/ to keep it separate from the frontend monorepo apps and packages.

Frontend contract:
- 5 reels x 3 visible rows.
- reveal.board is emitted as 5 reels x 5 symbols, matching current mock books with one padding symbol above and below the visible area.
- Visible win/scatter positions use { reel, row } where reel is 0-based and row is 1..3.
- Event types are limited to the handlers currently present in apps/lines:
  reveal, winInfo, setWin, setTotalWin, freeSpinTrigger, updateFreeSpin, freeSpinEnd, finalWin.
- freeSpinRetrigger is intentionally not emitted.

Phase 8B feature contract:
- `feature_contract.py` defines the intended Golden Goal Rush feature interfaces:
  6x5 cluster/cascade target grid, Golden Tiles, Goal Collector activations,
  Stadium Reward reveals, bonus tiers, retriggers and a 10,000x max-win target.
- This is not wired into the current Python book generator yet. The current
  generator remains a Stake-compatible MVP path and must not receive blind
  probability/reward changes.
- Before production implementation, run a full simulation/audit for RTP, hit
  rate, bonus frequency, retrigger frequency, bonus-buy EV and max-win capping.
- Preview TODO: align the standalone JS prototype and Storybook visuals with
  the final math contract before publishing production books.

Useful commands:
  cd math/games/golden_goal_rush
  python run.py debug --spins 10 --seed 1
  python run.py smoke --spins 10 --seed 1
  python run.py publish --spins 100 --bonus-spins 25 --seed 1

Compression:
- If Python package zstandard is installed, publish creates .jsonl.zst files.
- If zstandard is missing, publish writes uncompressed .jsonl debug/publish books and records this in index.json.
- Install with: pip install zstandard

Stake upload note:
- This scaffold prepares local publish files in library/publish_files/.
- It is MVP-only and needs real Stake SDK validation, math tuning, and production simulation before upload.
