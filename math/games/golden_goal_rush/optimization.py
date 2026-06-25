"""RTP lookup-weight optimization for Golden Goal Rush.

This implements the Stake Engine math-sdk convention of shaping a game's RTP
through per-simulation *selection weights* in the lookup table, rather than
through the reels, paytable, or any win-calculation logic. The simulation
pool (board RNG, line evaluation, event emission) in `game_executables.py`
stays completely unweighted and untouched; this module only decides how
often each already-generated book gets served.

The weighting itself uses exponential tilting (maximum-entropy reweighting):
for a target mean payout, it finds weights w_i = exp(lam * payout_i) that hit
the target exactly while minimizing the KL-divergence from the natural,
uniform-probability simulation pool. This is the smallest possible distortion
of the raw simulation distribution that still satisfies the RTP target, so it
preserves the relative shape (volatility character) of the underlying
reels/paytable as closely as mathematically possible.

If hitting the desired RTP would concentrate too much selection probability
onto too few simulations (a diversity/predictability risk -- the lookup
table should keep many different outcomes plausible), the achievable RTP is
automatically capped to the highest value that still satisfies the configured
diversity bounds, and the result is flagged accordingly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class RtpWeighting:
    target_rtp: float
    achieved_rtp: float
    cost: float
    lam: float
    weights: list[int]
    hit_rate: float
    effective_sample_size: float
    top_weight_share: float
    capped_for_diversity: bool
    raw_rtp: float


def _weighted_mean(payouts: list[int], lam: float) -> float:
    shift = max(lam * p for p in payouts)
    num = 0.0
    den = 0.0
    for p in payouts:
        w = math.exp(lam * p - shift)
        num += w * p
        den += w
    return num / den


def _solve_lambda(payouts: list[int], target_mean: float, iterations: int = 200) -> float:
    pmax = max(payouts)
    if pmax <= 0:
        return 0.0
    lo, hi = -100.0 / pmax, 100.0 / pmax
    f_lo = _weighted_mean(payouts, lo) - target_mean
    for _ in range(iterations):
        mid = (lo + hi) / 2
        f_mid = _weighted_mean(payouts, mid) - target_mean
        if (f_mid > 0) == (f_lo > 0):
            lo, f_lo = mid, f_mid
        else:
            hi = mid
    return (lo + hi) / 2


def _probabilities(payouts: list[int], lam: float) -> list[float]:
    shift = max(lam * p for p in payouts)
    raw = [math.exp(lam * p - shift) for p in payouts]
    total = sum(raw)
    return [w / total for w in raw]


def _diversity(probs: list[float]) -> tuple[float, float]:
    ess = 1.0 / sum(p * p for p in probs)
    top_share = max(probs)
    return ess, top_share


def optimize_weights(
    payouts: list[int],
    cost: float,
    desired_rtp: float,
    min_ess_fraction: float,
    min_ess_floor: float,
    max_top_share: float,
    weight_scale: int,
    search_steps: int = 40,
) -> RtpWeighting:
    """Compute integer lookup weights hitting `desired_rtp` as closely as
    the configured diversity bounds allow.

    `cost` is the bet-mode cost in multiples of bet (matches game_config's
    BET_MODES[mode]["cost"]); `payouts` are raw payoutMultiplier values in
    the existing "amount" units (hundredths of one bet multiplier).
    """
    n = len(payouts)
    min_ess = max(min_ess_floor, min_ess_fraction * n)
    raw_rtp = sum(payouts) / n / 100 / cost

    def evaluate(rtp: float) -> tuple[float, list[float], float, float]:
        target_mean = rtp * cost * 100
        lam = _solve_lambda(payouts, target_mean)
        probs = _probabilities(payouts, lam)
        ess, top_share = _diversity(probs)
        return lam, probs, ess, top_share

    lam, probs, ess, top_share = evaluate(desired_rtp)
    capped = False
    achieved_target = desired_rtp

    if ess < min_ess or top_share > max_top_share:
        capped = True
        lo_rtp, hi_rtp = min(desired_rtp, raw_rtp), desired_rtp
        lam, probs, ess, top_share = evaluate(lo_rtp)
        achieved_target = lo_rtp
        for _ in range(search_steps):
            mid_rtp = (lo_rtp + hi_rtp) / 2
            mid_lam, mid_probs, mid_ess, mid_top = evaluate(mid_rtp)
            if mid_ess >= min_ess and mid_top <= max_top_share:
                lam, probs, ess, top_share = mid_lam, mid_probs, mid_ess, mid_top
                achieved_target = mid_rtp
                lo_rtp = mid_rtp
            else:
                hi_rtp = mid_rtp

    weights = [max(1, round(p * weight_scale)) for p in probs]
    total_weight = sum(weights)
    achieved_mean = sum(w * p for w, p in zip(weights, payouts)) / total_weight
    achieved_rtp = achieved_mean / 100 / cost
    hit_rate = sum(w for w, p in zip(weights, payouts) if p > 0) / total_weight
    ess_final = (total_weight**2) / sum(w * w for w in weights)
    top_share_final = max(weights) / total_weight

    return RtpWeighting(
        target_rtp=desired_rtp,
        achieved_rtp=achieved_rtp,
        cost=cost,
        lam=lam,
        weights=weights,
        hit_rate=hit_rate,
        effective_sample_size=ess_final,
        top_weight_share=top_share_final,
        capped_for_diversity=capped,
        raw_rtp=raw_rtp,
    )


WIN_BUCKETS: tuple[tuple[int, int | None, str], ...] = (
    (0, 0, "0x"),
    (1, 100, "0-1x"),
    (101, 500, "1-5x"),
    (501, 2000, "5-20x"),
    (2001, 5000, "20-50x"),
    (5001, None, "50x+"),
)


def bucket_distribution(payouts: list[int], weights: list[int]) -> list[dict]:
    total = sum(weights)
    buckets = []
    for low, high, label in WIN_BUCKETS:
        mass = sum(
            w
            for p, w in zip(payouts, weights)
            if p >= low and (high is None or p <= high)
        )
        buckets.append({"range": label, "weightShare": round(mass / total, 6)})
    return buckets


def build_force_records(books: list[dict], mode: str) -> dict:
    """Catalogue representative existing books by outcome category.

    This indexes already-generated, unmodified simulations -- it does not
    force or synthesize new outcomes. `game_override.py` intentionally does
    not implement reel forcing in this MVP, so force records here serve the
    math-sdk's hit-rate/QA bookkeeping role by tagging natural examples
    instead of fabricating new gameplay.
    """
    records: list[dict] = []

    def add(symbol: str, kind: str, book: dict, note: str) -> None:
        records.append(
            {
                "symbol": symbol,
                "kind": kind,
                "bookId": book["id"],
                "payoutMultiplier": book["payoutMultiplier"],
                "note": note,
            }
        )

    zero_books = [b for b in books if b["payoutMultiplier"] == 0]
    if zero_books:
        add("NONE", "no_win", zero_books[0], "Naturally occurring zero-win round, indexed for QA baseline.")

    max_book = max(books, key=lambda b: b["payoutMultiplier"])
    add("W", "max_win_observed", max_book, "Highest payoutMultiplier observed in this simulation pool.")

    sorted_books = sorted(books, key=lambda b: b["payoutMultiplier"])
    median_book = sorted_books[len(sorted_books) // 2]
    add("MIXED", "typical_win", median_book, "Median payoutMultiplier round, indexed for QA baseline.")

    if mode == "base":
        trigger_books = [
            b for b in books if any(event.get("type") == "freeSpinTrigger" for event in b["events"])
        ]
        if trigger_books:
            add(
                "S",
                "scatter_trigger",
                trigger_books[0],
                "First naturally occurring free-spin trigger (3+ scatters) in this pool.",
            )

    return {
        "mode": mode,
        "description": (
            "Indexed reference simulations from the unweighted raw pool, tagged by "
            "outcome category for QA and hit-rate bookkeeping. These are catalogue "
            "entries over already-generated books, not forced/synthetic outcomes -- "
            "the MVP generator does not support forcing new reel results "
            "(see game_override.py)."
        ),
        "records": records,
    }
