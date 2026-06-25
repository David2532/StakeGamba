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
  python run.py publish --spins 80000 --bonus-spins 40000 --seed 1

Compression:
- If Python package zstandard is installed, publish creates .jsonl.zst files.
- If zstandard is missing, publish writes uncompressed .jsonl debug/publish books and records this in index.json.
- Install with: pip install zstandard

RTP calibration (lookup-weight optimization):
- `optimization.py` implements the Stake Engine convention of shaping RTP through
  per-simulation selection weights in the lookup CSV, never by touching reels,
  paytable, or win-calculation logic (those stay exactly as designed).
- Weights are computed via maximum-entropy/exponential-tilting reweighting of the
  raw simulation pool toward each bet mode's `rtp_target` in game_config.py.
- Diversity safety bounds (effective sample size, top single-book weight share)
  automatically cap the achieved RTP if hitting the full target would concentrate
  selection probability onto too few simulations. Capped modes are flagged in
  RTP_AUDIT.json/.txt with an explanation.
- Current finding: with the existing MVP reels/paytable, `base` (cost=1x) reaches
  its 96% target cleanly with high diversity. `bonus` (cost=100x buy-feature) is
  diversity-capped to roughly ~39% achieved RTP -- the existing free-spin
  paytable/wild density cannot naturally produce enough distinct large-payout
  simulations to support 96% RTP at that bet cost without concentrating
  selection probability on very few books. Raising it further is a design change
  (richer feature math or a different bet-mode cost), intentionally out of scope
  for this MVP calibration pass. See library/publish_files/RTP_AUDIT.txt.
- Force records (library/forces/force_record_<mode>.json) catalogue representative
  already-generated books (no-win, max-win, typical-win, scatter-trigger) for QA
  bookkeeping. `game_override.py` intentionally does not implement reel forcing in
  this MVP, so these are indexed natural examples, not synthesized outcomes.

Stake upload note:
- This scaffold prepares local publish files in library/publish_files/.
- It is MVP-only and needs real Stake SDK validation, math tuning, and production simulation before upload.
- "RTP-optimized" here means the lookup-table weighting has been calibrated and
  audited per the Stake Engine math-sdk convention; it is not a regulatory or
  certification claim.
