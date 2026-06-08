"""Local override hooks for Golden Goal Rush math.

This file mirrors the shape of Stake-style game folders while keeping the MVP
logic explicit. Add deterministic force hooks here later instead of changing
generated frontend contracts.
"""

from __future__ import annotations


def apply_reel_override(reels: list[list[str]], force: dict | None = None) -> list[list[str]]:
    if not force:
        return reels
    raise NotImplementedError("Force overrides are intentionally not implemented in the MVP.")
