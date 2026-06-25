Golden Goal Rush Math Upload Package

Status: MVP Math, not regulatory final.

This package contains a technical MVP math bundle for Golden Goal Rush using the current apps/lines frontend contract:
- 5 reels x 3 visible rows
- padded reveal boards with 5 reels x 5 rows
- symbol IDs: L1, L2, L3, L4, L5, H1, H2, H3, H4, W, S
- supported events only: reveal, winInfo, setWin, setTotalWin, freeSpinTrigger, updateFreeSpin, freeSpinEnd, finalWin

Lookup-table weights are calibrated via exponential-tilting RTP optimization
(see ../../optimization.py and RTP_AUDIT.json/.txt in this directory) against
each bet mode's rtp_target, under diversity-safety bounds. This reweights
selection of already-generated, unmodified simulations only -- reels,
paytable, paylines, and win-calculation logic are unchanged.

Do not treat this package as final RTP, final volatility, or regulatory-approved math.
