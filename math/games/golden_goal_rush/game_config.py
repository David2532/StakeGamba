"""Golden Goal Rush MVP configuration.

Values here are a first simulation pass only. They are not final RTP or
regulatory claims.
"""

from __future__ import annotations

GAME_ID = "golden_goal_rush"
GAME_NAME = "Golden Goal Rush"
VERSION = "0.1.0-mvp"

NUM_REELS = 5
VISIBLE_ROWS = 3
PADDED_ROWS = 5
DEFAULT_TOTAL_FREE_SPINS = 8

SYMBOLS = ("L1", "L2", "L3", "L4", "L5", "H1", "H2", "H3", "H4", "W", "S")
NORMAL_SYMBOLS = ("L1", "L2", "L3", "L4", "L5", "H1", "H2", "H3", "H4")
LOW_SYMBOLS = ("L1", "L2", "L3", "L4", "L5")
HIGH_SYMBOLS = ("H1", "H2", "H3", "H4")
WILD_SYMBOL = "W"
SCATTER_SYMBOL = "S"

# Mirrors apps/lines/src/game/config.ts.
PAYLINES = {
    1: [0, 0, 0, 0, 0],
    2: [1, 1, 1, 1, 1],
    3: [2, 2, 2, 2, 2],
    4: [0, 1, 2, 1, 0],
    5: [2, 1, 0, 1, 2],
    6: [0, 0, 1, 2, 2],
    7: [2, 2, 1, 0, 0],
    8: [1, 0, 1, 2, 1],
    9: [1, 2, 1, 0, 1],
    10: [0, 1, 1, 1, 2],
    11: [2, 1, 1, 1, 0],
    12: [0, 1, 0, 1, 2],
    13: [2, 1, 2, 1, 0],
    14: [1, 1, 0, 1, 1],
    15: [1, 1, 2, 1, 1],
    16: [0, 2, 1, 0, 2],
    17: [2, 0, 1, 2, 0],
    18: [0, 0, 2, 0, 0],
    19: [2, 2, 0, 2, 2],
    20: [1, 0, 0, 0, 1],
}

# MVP paytable in bet multipliers per line. Scatter only triggers free spins.
PAYTABLE = {
    "L5": {3: 0.10, 4: 0.30, 5: 1.00},
    "L4": {3: 0.20, 4: 0.50, 5: 2.00},
    "L3": {3: 0.30, 4: 0.70, 5: 3.00},
    "L2": {3: 0.30, 4: 0.70, 5: 3.00},
    "L1": {3: 0.50, 4: 1.00, 5: 5.00},
    "H4": {3: 1.00, 4: 2.00, 5: 8.00},
    "H3": {3: 2.00, 4: 3.00, 5: 10.00},
    "H2": {3: 3.00, 4: 5.00, 5: 15.00},
    "H1": {3: 5.00, 4: 10.00, 5: 20.00},
    "W": {3: 5.00, 4: 10.00, 5: 20.00},
}

BET_MODES = {
    "base": {
        "cost": 1.0,
        "feature": True,
        "buyBonus": False,
        # 96.5% RTP. Stake's math compliance requires RTP within 90%-96.70%;
        # a 97% target overshoots that ceiling and fails the RTP-range check,
        # so the calibrated target sits at 96.5% (a clean ~0.2% margin under
        # the cap) for both modes, keeping cross-mode RTP variance at 0%.
        "rtp_target": 0.965,
    },
    "bonus": {
        # Buy-feature cost is sized to the feature's actual expected return.
        # The free-spin math pays ~14.5x bet on average, so a 15x buy cost
        # yields a fair ~96.5% RTP with full lookup diversity. A higher cost
        # would force the lookup to over-concentrate selection weight on a
        # handful of rare large wins to reach target -- see RTP_AUDIT for the
        # diversity metrics that drove this choice.
        "cost": 15.0,
        "feature": False,
        "buyBonus": True,
        # Matches base so Cross-Mode RTP Consistency stays at 0% variance and
        # both modes land inside Stake's 90%-96.70% compliance band.
        "rtp_target": 0.965,
    },
}

# Lookup-weight optimization safety bounds (see optimization.py). RTP is
# calibrated by reweighting the unweighted simulation pool, never by
# touching reels/paytable. These bounds stop that reweighting from
# concentrating selection probability onto too few simulations -- if a bet
# mode's natural payout distribution can't reach its rtp_target without
# violating them, the achieved RTP is capped and the gap is reported in
# RTP_AUDIT.json instead of silently produced.
RTP_MIN_EFFECTIVE_SAMPLE_FRACTION = 0.01
RTP_MIN_EFFECTIVE_SAMPLE_FLOOR = 200.0
RTP_MAX_TOP_WEIGHT_SHARE = 0.05
RTP_LOOKUP_WEIGHT_SCALE = 1_000_000_000

WIN_LEVELS = [
    (5000, 7),
    (1000, 6),
    (500, 5),
    (100, 4),
    (50, 3),
    (10, 2),
    (0, 1),
]
