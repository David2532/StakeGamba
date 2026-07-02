"""Golden Goal Rush 6x5 cluster/cascade configuration.

Amounts inside books are stored as bet multipliers * 100. For example
``50`` means 0.50x bet, matching the Stake Engine payoutMultiplier contract
already used by this game.
"""

from __future__ import annotations

GAME_ID = "golden_goal_rush"
GAME_NAME = "Golden Goal Rush"
VERSION = "0.2.1-cluster"

NUM_REELS = 6
VISIBLE_ROWS = 5
PADDED_ROWS = 5
MIN_CLUSTER = 5
DEFAULT_TOTAL_FREE_SPINS = 8

SYMBOLS = (
    "ten",
    "j",
    "q",
    "k",
    "a",
    "football",
    "whistle",
    "trophy",
    "jersey",
    "wild",
    "scatter",
    "rainbow",
)
WILD_SYMBOL = "wild"
SCATTER_SYMBOL = "scatter"
RAINBOW_SYMBOL = "rainbow"
NORMAL_SYMBOLS = tuple(symbol for symbol in SYMBOLS if symbol not in {WILD_SYMBOL, SCATTER_SYMBOL, RAINBOW_SYMBOL})

SYMBOL_MATH = {
    "ten": {"weight": 30.0, "pay": 0.24},
    "j": {"weight": 25.0, "pay": 0.28},
    "q": {"weight": 20.0, "pay": 0.36},
    "k": {"weight": 16.0, "pay": 0.48},
    "a": {"weight": 12.0, "pay": 0.62},
    "football": {"weight": 6.5, "pay": 0.82},
    "whistle": {"weight": 5.0, "pay": 1.05},
    "trophy": {"weight": 3.5, "pay": 1.35},
    "jersey": {"weight": 3.5, "pay": 1.85},
    "wild": {"weight": 2.5, "pay": 0.0, "wild": True},
    "scatter": {"weight": 2.0, "pay": 0.0, "scatter": True},
    "rainbow": {"weight": 2.0, "pay": 0.0, "rainbow": True},
}

RAINBOW_WEIGHT = 0.12
SCATTER_WEIGHT = 2.0
HUNT_RAINBOW_BOOST = 40.0

GOLDEN_REVEAL_WEIGHTS = {
    "blank": 88.0,
    "bronze": 60.0,
    "silver": 11.0,
    "gold": 1.5,
    "mult": 8.0,
    "collector": 3.0,
}
BRONZE_VALUES = (0.2, 0.5, 1.0, 2.0, 3.0, 4.0)
SILVER_VALUES = (5.0, 10.0, 15.0, 20.0)
GOLD_VALUES = (25.0, 50.0, 100.0, 250.0, 500.0)
MULTIPLIER_VALUES = (2, 3, 4, 5, 10)
MAX_COLLECTOR_CYCLES = 4
MAX_WIN_MULTIPLIER = 10_000
MAX_WIN_AMOUNT = MAX_WIN_MULTIPLIER * 100

FREE_SPIN_TIERS = {
    1: {
        "name": "Golden Chance",
        "spins": 8,
        "persistGolden": True,
        "persistAfterReveal": False,
        "guaranteedRainbow": False,
        "rainbowBoost": 3.0,
        "reduceBronze": False,
    },
    2: {
        "name": "All That Glitters",
        "spins": 12,
        "persistGolden": True,
        "persistAfterReveal": True,
        "guaranteedRainbow": False,
        "rainbowBoost": 3.0,
        "reduceBronze": False,
    },
    3: {
        "name": "End of the Rainbow",
        "spins": 12,
        "persistGolden": True,
        "persistAfterReveal": True,
        "guaranteedRainbow": True,
        "rainbowBoost": 1.0,
        "reduceBronze": True,
    },
}

BET_MODES = {
    "base": {
        "cost": 1.0,
        "feature": True,
        "buyBonus": False,
        "rtp_target": 0.9645,
        "description": "Normal 6x5 cluster/cascade base spin",
    },
    "hunt": {
        "cost": 4.2,
        "feature": True,
        "buyBonus": True,
        "rtp_target": 0.9645,
        "description": "Feature Spins buy: one paid base spin with boosted rainbow chance and no free-spin trigger",
    },
    "rainbow": {
        "cost": 6.0,
        "feature": True,
        "buyBonus": True,
        "rtp_target": 0.9645,
        "description": "Rainbow Spin buy: one paid base spin with a guaranteed rainbow symbol",
    },
    "bonus_tier1": {
        "cost": 31.0,
        "feature": False,
        "buyBonus": True,
        "rtp_target": 0.9645,
        "description": "Golden Chance buy: 8 free spins",
    },
    "bonus": {
        "cost": 95.0,
        "feature": False,
        "buyBonus": True,
        "rtp_target": 0.9645,
        "description": "All That Glitters buy: 12 free spins",
    },
}

RTP_MIN_EFFECTIVE_SAMPLE_FRACTION = 0.01
RTP_MIN_EFFECTIVE_SAMPLE_FLOOR = 200.0
RTP_MAX_TOP_WEIGHT_SHARE = 0.05
RTP_LOOKUP_WEIGHT_SCALE = 1_000_000_000

# Stake Engine bet-level tail compliance ("2 Star" limits: CVaR(0.1%) <= 700x
# cost, ETL >40x cost <= 0.800 RTP share). Targets carry a safety margin so
# integer weight rounding and Stake's own re-measurement stay inside the
# limits. Only the base mode currently violates them; all buy modes pass
# unconstrained, so they get no entry here (no distortion applied).
RTP_TAIL_CONSTRAINTS = {
    "base": {
        "cvar_quantile": 0.001,
        "cvar_max_x": 680.0,
        "etl_threshold_x": 40.0,
        "etl_max_share": 0.78,
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
