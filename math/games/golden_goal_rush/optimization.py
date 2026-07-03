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
    etl40_share: float = 0.0
    cvar_x: float = 0.0
    tail_damping: float = 1.0
    tail_constrained: bool = False
    tail_met: bool = True
    max_win_weight: int = 0
    max_win_total_weight: int = 0
    max_win_odds: float = float("inf")
    max_win_met: bool = True


def _weighted_mean(
    payouts: list[int],
    lam: float,
    mults: list[float] | None = None,
    exps: list[float] | None = None,
) -> float:
    stats = exps if exps is not None else payouts
    shift = max(lam * s for s in stats)
    num = 0.0
    den = 0.0
    for i, p in enumerate(payouts):
        m = mults[i] if mults is not None else 1.0
        w = m * math.exp(lam * stats[i] - shift)
        num += w * p
        den += w
    return num / den


def _solve_lambda(
    payouts: list[int],
    target_mean: float,
    mults: list[float] | None = None,
    exps: list[float] | None = None,
    iterations: int = 200,
) -> float:
    stats = exps if exps is not None else payouts
    smax = max(stats)
    if smax <= 0:
        return 0.0
    lo, hi = -100.0 / smax, 100.0 / smax
    f_lo = _weighted_mean(payouts, lo, mults, exps) - target_mean
    for _ in range(iterations):
        mid = (lo + hi) / 2
        f_mid = _weighted_mean(payouts, mid, mults, exps) - target_mean
        if (f_mid > 0) == (f_lo > 0):
            lo, f_lo = mid, f_mid
        else:
            hi = mid
    return (lo + hi) / 2


def _probabilities(
    payouts: list[int],
    lam: float,
    mults: list[float] | None = None,
    exps: list[float] | None = None,
) -> list[float]:
    stats = exps if exps is not None else payouts
    shift = max(lam * s for s in stats)
    raw = [
        (mults[i] if mults is not None else 1.0) * math.exp(lam * stats[i] - shift)
        for i in range(len(payouts))
    ]
    total = sum(raw)
    return [w / total for w in raw]


def _tail_metrics(
    payouts: list[int],
    probs: list[float],
    cost: float,
    etl_threshold_x: float,
    cvar_quantile: float,
) -> tuple[float, float]:
    """Selection-weighted tail stats matching Stake's bet-level compliance:

    - ETL share: the RTP share carried by wins strictly above
      `etl_threshold_x` times the mode cost.
    - CVaR: the expected payout (in multiples of cost) across the worst
      (largest-payout) `cvar_quantile` slice of the outcome distribution.
    """
    thr_units = etl_threshold_x * cost * 100.0
    etl = sum(pr * p for pr, p in zip(probs, payouts) if p > thr_units) / (100.0 * cost)
    order = sorted(range(len(payouts)), key=lambda i: payouts[i], reverse=True)
    q = max(1e-12, cvar_quantile)
    acc = 0.0
    exp_pay = 0.0
    for i in order:
        take = min(probs[i], q - acc)
        if take <= 0.0:
            break
        exp_pay += take * payouts[i]
        acc += take
        if acc >= q:
            break
    cvar = (exp_pay / acc) / (100.0 * cost) if acc > 0.0 else 0.0
    return etl, cvar


def _diversity(probs: list[float]) -> tuple[float, float]:
    ess = 1.0 / sum(p * p for p in probs)
    top_share = max(probs)
    return ess, top_share


def _max_win_stats(payouts: list[int], weights: list[int]) -> tuple[int, int, float, bool]:
    max_payout = max(payouts)
    max_weight = sum(weight for payout, weight in zip(payouts, weights) if payout == max_payout)
    total_weight = sum(weights)
    odds = total_weight / max_weight if max_weight > 0 else float("inf")
    return max_weight, total_weight, odds, max_weight > 0


def _enforce_max_win_achievability(
    payouts: list[int],
    weights: list[int],
    cost: float,
    target_rtp: float,
    target_odds: float,
) -> list[int]:
    """Ensure advertised max win is realistically selectable in the lookup.

    Stake's compliance view checks the lookup odds for the max-win outcome.
    The natural exponential tilt can leave 10,000x books with only a handful
    of integer weight units, so the max win exists but is effectively outside
    the allowed odds window. This raises real generated max-win books to the
    target mass, then removes equivalent RTP mass from other high-win books.
    """
    adjusted = list(weights)
    max_payout = max(payouts)
    max_indices = [i for i, payout in enumerate(payouts) if payout == max_payout]
    if not max_indices or target_odds <= 0:
        return adjusted

    max_weight = sum(adjusted[i] for i in max_indices)
    total_weight = sum(adjusted)
    # Solve (max_weight + delta) / (total_weight + delta) >= 1 / target_odds.
    required_delta = math.ceil(max(0.0, (total_weight - target_odds * max_weight) / (target_odds - 1.0)))
    if required_delta <= 0:
        return adjusted

    for step in range(required_delta):
        adjusted[max_indices[step % len(max_indices)]] += 1

    target_mean = target_rtp * cost * 100.0
    error = sum(weight * (payout - target_mean) for payout, weight in zip(payouts, adjusted))
    if error <= 0:
        return adjusted

    candidates = [
        i
        for i, payout in enumerate(payouts)
        if payout != max_payout and payout > target_mean and adjusted[i] > 1
    ]
    candidates.sort(key=lambda i: payouts[i], reverse=True)
    for i in candidates:
        contribution = payouts[i] - target_mean
        if contribution <= 0:
            continue
        removable = adjusted[i] - 1
        take = min(removable, max(1, math.ceil(error / contribution)))
        adjusted[i] -= take
        error -= take * contribution
        if error <= 0:
            break
    return adjusted


def optimize_weights(
    payouts: list[int],
    cost: float,
    desired_rtp: float,
    min_ess_fraction: float,
    min_ess_floor: float,
    max_top_share: float,
    weight_scale: int,
    search_steps: int = 40,
    tail_constraints: dict | None = None,
    max_win_target_odds: float | None = None,
    max_win_required_odds: float | None = None,
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

    # Tail compliance (Stake bet-level constraints): damp the selection
    # probability of books above the ETL threshold with a single factor
    # beta <= 1, re-solving lambda each time so the RTP target is preserved
    # exactly. Bisection finds the LARGEST beta that satisfies both limits,
    # i.e. the smallest possible distortion of the natural distribution.
    # Win amounts, books and game logic are untouched -- this only changes
    # how often large-win books are served, the same lever the RTP
    # optimization itself uses.
    tail_damping = 1.0
    tail_constrained = False
    tail_met = True
    etl_threshold_x = 40.0
    cvar_quantile = 0.001
    if tail_constraints:
        etl_threshold_x = float(tail_constraints.get("etl_threshold_x", 40.0))
        cvar_quantile = float(tail_constraints.get("cvar_quantile", 0.001))
        etl_max = float(tail_constraints.get("etl_max_share", float("inf")))
        cvar_max = float(tail_constraints.get("cvar_max_x", float("inf")))
        thr_units = etl_threshold_x * cost * 100.0
        target_mean = achieved_target * cost * 100

        # IMPORTANT: the exponent statistic is CLIPPED at the tail threshold.
        # With the plain exponential tilt, damping tail books is useless: the
        # solver simply raises lambda and exp(lambda * payout) out-scales any
        # constant damping factor for the very largest books. Clipping caps
        # the exponent at the threshold, so books above it keep their natural
        # relative frequencies, lambda controls only how much probability the
        # sub-threshold region gets, and beta genuinely scales the whole tail.
        exps = [float(min(p, thr_units)) for p in payouts]

        def evaluate_tail(beta: float):
            tail_mults = [beta if p > thr_units else 1.0 for p in payouts]
            # 90 bisection steps give lambda precision far below any effect
            # visible after integer weight rounding; keeps the beta search fast.
            lam_b = _solve_lambda(payouts, target_mean, tail_mults, exps=exps, iterations=90)
            probs_b = _probabilities(payouts, lam_b, tail_mults, exps=exps)
            etl_b, cvar_b = _tail_metrics(payouts, probs_b, cost, etl_threshold_x, cvar_quantile)
            return lam_b, probs_b, etl_b, cvar_b

        etl_now, cvar_now = _tail_metrics(payouts, probs, cost, etl_threshold_x, cvar_quantile)
        if etl_now > etl_max or cvar_now > cvar_max:
            tail_constrained = True
            lam_c, probs_c, etl_c, cvar_c = evaluate_tail(1.0)
            if etl_c <= etl_max and cvar_c <= cvar_max:
                # Clipping alone already satisfies the limits (no damping).
                lam, probs = lam_c, probs_c
            else:
                found = False
                fallback = (lam_c, probs_c)
                lo_beta, hi_beta = 0.0, 1.0
                for _ in range(40):
                    mid_beta = max((lo_beta + hi_beta) / 2, 1e-12)
                    lam_b, probs_b, etl_b, cvar_b = evaluate_tail(mid_beta)
                    if etl_b <= etl_max and cvar_b <= cvar_max:
                        lam, probs = lam_b, probs_b
                        tail_damping = mid_beta
                        lo_beta = mid_beta
                        found = True
                    else:
                        hi_beta = mid_beta
                        fallback = (lam_b, probs_b)
                if not found:
                    # Best effort: keep the strongest damping probed and flag
                    # the miss so the audit/pipeline can fail loudly.
                    lam, probs = fallback
                    tail_damping = max(hi_beta, 1e-12)
                    tail_met = False
            ess, top_share = _diversity(probs)
            if ess < min_ess or top_share > max_top_share:
                capped = True

    weights = [max(1, round(p * weight_scale)) for p in probs]
    if max_win_target_odds:
        weights = _enforce_max_win_achievability(
            payouts,
            weights,
            cost=cost,
            target_rtp=desired_rtp,
            target_odds=max_win_target_odds,
        )
    total_weight = sum(weights)
    achieved_mean = sum(w * p for w, p in zip(weights, payouts)) / total_weight
    achieved_rtp = achieved_mean / 100 / cost
    hit_rate = sum(w for w, p in zip(weights, payouts) if p > 0) / total_weight
    ess_final = (total_weight**2) / sum(w * w for w in weights)
    top_share_final = max(weights) / total_weight
    probs_final = [w / total_weight for w in weights]
    etl_final, cvar_final = _tail_metrics(payouts, probs_final, cost, etl_threshold_x, cvar_quantile)
    max_win_weight, max_win_total_weight, max_win_odds, has_max_win = _max_win_stats(payouts, weights)
    max_win_met = has_max_win and (
        max_win_required_odds is None or max_win_odds <= max_win_required_odds
    )

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
        etl40_share=etl_final,
        cvar_x=cvar_final,
        tail_damping=tail_damping,
        tail_constrained=tail_constrained,
        tail_met=tail_met,
        max_win_weight=max_win_weight,
        max_win_total_weight=max_win_total_weight,
        max_win_odds=max_win_odds,
        max_win_met=max_win_met,
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
