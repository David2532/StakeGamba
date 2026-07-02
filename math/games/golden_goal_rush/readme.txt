Golden Goal Rush Math
=====================

This folder generates the Stake Engine math package for Golden Goal Rush.

Current contract:
- 6 reels x 5 visible rows.
- 5+ connected symbols pay as clusters.
- Winning positions become Golden Cells.
- Cascades are emitted as tumbleBoard events.
- Rainbow activation, coin rewards, multipliers and Collector awards are emitted
  as goldenReveal / goldenAward / goldenClear events.
- Free spins are complete RGS books, not frontend-local fake features.

Main commands:
  cd math/games/golden_goal_rush
  python run.py debug --mode base --spins 10 --seed 1
  python run.py smoke --spins 100 --seed 1
  python run.py publish --spins 80000 --bonus-spins 40000 --seed 1

Upload sync from repo root:
  .\scripts\sync-stake-publish.ps1 -BuildFrontend -SkipMathStalenessCheck

Current RGS modes:
- base: cost 1x
- hunt: cost 4.2x
- rainbow: cost 6x
- bonus_tier1: cost 31x
- bonus: cost 95x

RTP:
- Target is 96.5% for each mode.
- RTP is shaped through lookup-table weights over already-generated books.
- See library/publish_files/RTP_AUDIT.txt for the current achieved RTP,
  hit rate, effective sample size and max observed payout.

Stake flow:
- The frontend renders round.state from /wallet/play.
- /wallet/end-round is called only when round.active === true.
- If a base-mode active round is found on authenticate, the frontend settles it
  immediately as required by Stake review.
