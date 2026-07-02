Golden Goal Rush Math Upload Package

Status: generated 6x5 cluster/cascade math package. Not a certification claim.

This package contains the Stake Engine upload math for Golden Goal Rush:
- 6 reels x 5 visible rows
- cluster/cascade wins with 5+ connected symbols
- winning cells become Golden Cells
- Rainbow activation, coin reveals, multipliers and Collector awards are emitted in round.state
- free-spin starts and bought bonus starts are emitted as complete RGS event sequences

Supported round.state events:
- reveal
- winInfo
- setWin
- setTotalWin
- tumbleBoard
- goldenReveal
- goldenAward
- goldenClear
- freeSpinTrigger
- updateFreeSpin
- freeSpinEnd
- finalWin

Bet modes in index.json:
- base: normal paid spin, cost 1x
- hunt: boosted-rainbow Feature Spins buy, cost 4.2x
- rainbow: guaranteed-rainbow spin buy, cost 6x
- bonus_tier1: Golden Chance buy, cost 31x
- bonus: All That Glitters buy, cost 95x

Lookup-table weights are calibrated via exponential-tilting RTP optimization
(see ../../optimization.py and RTP_AUDIT.json/.txt in this directory) against
each bet mode's rtp_target, under diversity-safety bounds. This reweights
selection of already-generated, unmodified simulations only.

All shipped modes reach the 96.5% RTP target with healthy lookup diversity and
no diversity capping. Each mode's declared rtp_achieved equals the weighted RTP
of its lookup table, so the package is internally consistent.

Upload the repository-root publish/math folder as the math package.
