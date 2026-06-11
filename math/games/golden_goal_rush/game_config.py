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

# TODO(balancing): the 100x bonus buy price is far below the measured bonus EV
# (~1351x mean payout over 250 generated books) and base RTP is ~37.5%.
# See BALANCING_NOTES.md before changing any value here.
BET_MODES = {
    "base": {
        "cost": 1.0,
        "feature": True,
        "buyBonus": False,
        "rtp_target_note": "MVP configurable target, not final",
    },
    "bonus": {
        "cost": 100.0,
        "feature": False,
        "buyBonus": True,
        "rtp_target_note": "MVP configurable target, not final",
    },
}

WIN_LEVELS = [
    (5000, 7),
    (1000, 6),
    (500, 5),
    (100, 4),
    (50, 3),
    (10, 2),
    (0, 1),
]
