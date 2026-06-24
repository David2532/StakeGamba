"""Phase 8B feature contract for Golden Goal Rush.

This file is intentionally a contract, not live math. The current Python MVP
still emits the existing Stake-compatible 5-reel/3-row line-pay book events.
Do not wire these feature tiers into production probabilities until cluster
pays, cascades, Golden Tiles, Goal Collector activation, retriggers, bonus buys, RTP
and max-win behavior have all been simulated and audited.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

FeatureTier = Literal[
    "feature_spins",
    "collector_rush",
    "golden_goal_bonus",
    "trophy_rush_bonus",
]

GoldenGoalFeatureEvent = Literal[
    "goldenTileMark",
    "cascadeDrop",
    "goalCollectorHit",
    "stadiumRewardReveal",
    "freeSpinRetrigger",
    "bonusLevelUpgrade",
    "maxWinCap",
]

RewardType = Literal["coin", "cash", "multiplier", "extra_spin", "blank"]


@dataclass(frozen=True)
class FeatureTierConfig:
    id: FeatureTier
    label: str
    preview_cost_x_bet: int
    free_spins: int | None
    collector_behavior: str
    golden_tile_persistence: str
    reward_profile: str
    math_status: str = "Preview TODO: align with final math simulation."


GRID_CONTRACT = {
    "targetCols": 6,
    "targetRows": 5,
    "pays": "cluster/ways-oriented",
    "cascade": True,
    "current_python_mvp": "5 reels x 3 visible rows, line pays",
}

FEATURE_TIERS: tuple[FeatureTierConfig, ...] = (
    FeatureTierConfig(
        id="feature_spins",
        label="Feature Spins",
        preview_cost_x_bet=3,
        free_spins=None,
        collector_behavior="base collector chance is boosted through a paid-spin feature mode",
        golden_tile_persistence="base game tiles clear after the paid spin resolves",
        reward_profile="base-game Stadium Rewards only",
    ),
    FeatureTierConfig(
        id="collector_rush",
        label="Collector Rush",
        preview_cost_x_bet=50,
        free_spins=None,
        collector_behavior="Goal Collector presence is guaranteed or heavily boosted",
        golden_tile_persistence="base game tiles clear after activation or spin end",
        reward_profile="small-to-mid Goal Rewards, multiplier reveals",
    ),
    FeatureTierConfig(
        id="golden_goal_bonus",
        label="Golden Goal Bonus",
        preview_cost_x_bet=100,
        free_spins=8,
        collector_behavior="moderate Goal Collector presence",
        golden_tile_persistence="tiles persist within the current spin or until activation",
        reward_profile="moderate Goal Rewards and occasional Extra Spins",
    ),
    FeatureTierConfig(
        id="trophy_rush_bonus",
        label="Trophy Rush Bonus",
        preview_cost_x_bet=250,
        free_spins=12,
        collector_behavior="Goal Collector is guaranteed or strongly increased",
        golden_tile_persistence="tiles persist for the full bonus until activated",
        reward_profile="low rewards reduced, higher volatility Trophy Rewards enabled",
    ),
)

MAX_WIN_MULTIPLIER_TARGET = 10_000

MATH_AUDIT_REQUIREMENTS = (
    "Read current production math before implementation.",
    "Choose one final grid/pay model and regenerate books from that model.",
    "Simulate RTP, hit rate, bonus frequency, retrigger frequency and buy-bonus EV.",
    "Validate max-win capping across base and bonus aggregation.",
    "Emit Stake-compatible book events for Golden Tiles, Goal Collector hits and reward reveals.",
    "Only then tune probabilities and publish lookup/books.",
)
