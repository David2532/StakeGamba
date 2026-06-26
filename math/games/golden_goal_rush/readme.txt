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
  would automatically cap the achieved RTP if hitting the full target required
  concentrating selection probability onto too few simulations. Any capped mode
  is flagged in RTP_AUDIT.json/.txt with an explanation. (In the current
  configuration nothing is capped -- both modes reach target cleanly.)
- RTP target is 96.5%. Stake's math compliance requires Return to Player to fall
  within 90%-96.70%; an earlier 97% target overshot that ceiling and failed the
  RTP-range check, so both modes are now calibrated to 96.5% (a clean ~0.2%
  margin under the cap, keeping Cross-Mode RTP variance at 0%).
- Current result: both modes reach their 96.5% rtp_target with healthy diversity.
  base (cost=1x):  achieved ~96.50%, effective sample size ~76% of the pool.
  bonus (cost=15x): achieved ~96.50%, effective sample size ~99.7% of the pool.
- Buy-feature cost note: the free-spin feature naturally returns ~14.5x bet on
  average (max observed ~130x). The bonus buy cost is therefore set to 15x so the
  buy feature is a fair ~96.5% RTP with near-uniform lookup diversity. An earlier
  100x cost made the buy feature a ~14% raw / 133x-max outcome that could only be
  pushed toward target by collapsing the lookup to ~32 effective outcomes -- a
  diversity/predictability problem. Right-sizing the cost (a bet-mode parameter,
  not reels/paytable/win-logic) is the clean fix and keeps the math internally
  consistent. apps/lines/src/game/config.ts is kept in sync (bonus cost 15x).
  See library/publish_files/RTP_AUDIT.txt.
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
