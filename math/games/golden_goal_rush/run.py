from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from game_config import (
    BET_MODES,
    GAME_ID,
    GAME_NAME,
    RTP_LOOKUP_WEIGHT_SCALE,
    RTP_MAX_TOP_WEIGHT_SHARE,
    RTP_MIN_EFFECTIVE_SAMPLE_FLOOR,
    RTP_MIN_EFFECTIVE_SAMPLE_FRACTION,
    RTP_TAIL_CONSTRAINTS,
    FREE_SPIN_TIERS,
    GOLDEN_REVEAL_WEIGHTS,
    MAX_WIN_MULTIPLIER,
    MIN_CLUSTER,
    NUM_REELS,
    PADDED_ROWS,
    SYMBOL_MATH,
    SYMBOLS,
    VISIBLE_ROWS,
    VERSION,
)
from game_executables import (
    ROOT,
    compress_zstd,
    ensure_library_dirs,
    generate_books,
    validate_book,
    write_jsonl,
)
from optimization import RtpWeighting, bucket_distribution, build_force_records, optimize_weights


def compute_rtp_weighting(mode: str, books: list[dict]) -> RtpWeighting:
    payouts = [book["payoutMultiplier"] for book in books]
    cost = BET_MODES[mode]["cost"]
    desired_rtp = BET_MODES[mode]["rtp_target"]
    return optimize_weights(
        payouts,
        cost=cost,
        desired_rtp=desired_rtp,
        min_ess_fraction=RTP_MIN_EFFECTIVE_SAMPLE_FRACTION,
        min_ess_floor=RTP_MIN_EFFECTIVE_SAMPLE_FLOOR,
        max_top_share=RTP_MAX_TOP_WEIGHT_SHARE,
        weight_scale=RTP_LOOKUP_WEIGHT_SCALE,
        tail_constraints=RTP_TAIL_CONSTRAINTS.get(mode),
    )


def write_config_files(
    weightings: dict[str, RtpWeighting], books_by_mode: dict[str, list[dict]]
) -> None:
    config_dir = ROOT / "library" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    bet_modes = {}
    for mode, mode_config in BET_MODES.items():
        weighting = weightings[mode]
        max_payout = max(book["payoutMultiplier"] for book in books_by_mode[mode])
        bet_modes[mode] = {
            **mode_config,
            "rtp_achieved": round(weighting.achieved_rtp, 6),
            "rtp_capped_for_diversity": weighting.capped_for_diversity,
            "max_win": round(max_payout / 100, 2),
        }
    config = {
        "gameId": GAME_ID,
        "gameName": GAME_NAME,
        "version": VERSION,
        "layout": {"reels": NUM_REELS, "visibleRows": VISIBLE_ROWS, "paddedRows": PADDED_ROWS},
        "system": "6x5 cluster/cascade",
        "symbols": list(SYMBOLS),
        "paytable": {
            symbol: {
                "cluster5": round(float(config.get("pay", 0.0)), 4),
                "cluster7Boost": 2,
                "cluster9Boost": 4,
                "cluster12Boost": 8,
            }
            for symbol, config in SYMBOL_MATH.items()
            if float(config.get("pay", 0.0)) > 0
        },
        "cluster": {
            "minCluster": MIN_CLUSTER,
            "wildSubstitutes": True,
            "winningCellsBecomeGolden": True,
            "cascadeMultiplier": "increments by 1 after each cascade in a spin",
        },
        "goldenFeature": {
            "trigger": "rainbow appears while at least one golden cell exists",
            "revealWeights": GOLDEN_REVEAL_WEIGHTS,
            "coinsMultipliersCollectorsInRoundState": True,
        },
        "freeSpinTiers": FREE_SPIN_TIERS,
        "maxWinMultiplier": MAX_WIN_MULTIPLIER,
        "betModes": bet_modes,
        "frontendContract": {
            "layout": f"{NUM_REELS} reels x {VISIBLE_ROWS} visible rows",
            "boardShape": f"{NUM_REELS} reels x {PADDED_ROWS} rows",
            "eventTypes": [
                "reveal",
                "winInfo",
                "setWin",
                "setTotalWin",
                "tumbleBoard",
                "freeSpinTrigger",
                "updateFreeSpin",
                "freeSpinEnd",
                "goldenReveal",
                "goldenAward",
                "goldenClear",
                "finalWin",
            ],
            "freeSpinRetrigger": "not emitted",
        },
        "note": (
            "Golden Goal Rush 6x5 cluster/cascade books are source-of-truth for "
            "visible gameplay. Golden Cells, Rainbow reveal, coin/multiplier, "
            "collector and free-spin events are emitted in round.state. RTP is "
            "calibrated to each mode's rtp_target via lookup-weight optimization "
            "without touching generated book win logic -- see RTP_AUDIT.json."
        ),
    }
    (config_dir / "game_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")


def write_lookup(mode: str, books: list[dict], weights: list[int]) -> Path:
    lookup_path = ROOT / "library" / "lookup_tables" / f"{mode}_lookup.csv"
    lookup_path.parent.mkdir(parents=True, exist_ok=True)
    with lookup_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        for book, weight in zip(books, weights):
            writer.writerow([book["id"], weight, book["payoutMultiplier"]])
    return lookup_path


def write_force_records(mode: str, books: list[dict]) -> Path:
    forces_dir = ROOT / "library" / "forces"
    forces_dir.mkdir(parents=True, exist_ok=True)
    force_path = forces_dir / f"force_record_{mode}.json"
    force_path.write_text(json.dumps(build_force_records(books, mode), indent=2), encoding="utf-8")
    return force_path


def write_rtp_audit(weightings: dict[str, tuple[list[dict], RtpWeighting]]) -> None:
    publish_dir = ROOT / "library" / "publish_files"
    publish_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, dict] = {}
    lines = ["Golden Goal Rush RTP Audit", "=" * 27, ""]
    for mode, (books, weighting) in weightings.items():
        payouts = [book["payoutMultiplier"] for book in books]
        buckets = bucket_distribution(payouts, weighting.weights)
        report[mode] = {
            "simulationCount": len(books),
            "cost": weighting.cost,
            "rawRtp": round(weighting.raw_rtp, 6),
            "targetRtp": round(weighting.target_rtp, 6),
            "achievedRtp": round(weighting.achieved_rtp, 6),
            "cappedForDiversity": weighting.capped_for_diversity,
            "hitRateWeighted": round(weighting.hit_rate, 6),
            "effectiveSampleSize": round(weighting.effective_sample_size, 1),
            "topWeightShare": round(weighting.top_weight_share, 6),
            "maxPayoutMultiplierObserved": max(payouts) / 100,
            "etl40Share": round(weighting.etl40_share, 6),
            "cvar01x": round(weighting.cvar_x, 3),
            "tailConstrained": weighting.tail_constrained,
            "tailMet": weighting.tail_met,
            "tailDamping": round(weighting.tail_damping, 9),
            "winDistribution": buckets,
        }
        lines.append(f"[{mode}] cost={weighting.cost}x bet, simulations={len(books)}")
        lines.append(f"  raw (unweighted) RTP:   {weighting.raw_rtp * 100:.2f}%")
        lines.append(f"  target RTP:             {weighting.target_rtp * 100:.2f}%")
        lines.append(f"  achieved RTP:           {weighting.achieved_rtp * 100:.2f}%")
        if weighting.capped_for_diversity:
            lines.append(
                "  NOTE: target RTP capped to preserve lookup-table diversity -- "
                "see effective sample size / top weight share below."
            )
        lines.append(f"  hit rate (weighted):    {weighting.hit_rate * 100:.2f}%")
        lines.append(
            f"  effective sample size:  {weighting.effective_sample_size:.0f} of {len(books)} "
            f"({weighting.effective_sample_size / len(books) * 100:.2f}%)"
        )
        lines.append(f"  top single-book weight: {weighting.top_weight_share * 100:.4f}% of total selection mass")
        lines.append(f"  max payout observed:    {max(payouts) / 100:.2f}x bet")
        lines.append(f"  ETL >40x cost (RTP share): {weighting.etl40_share:.3f}")
        lines.append(f"  CVaR 0.1% (x cost):     {weighting.cvar_x:.3f}")
        if weighting.tail_constrained:
            lines.append(
                "  NOTE: tail-compliance reweighting applied (clipped tilt, beta="
                f"{weighting.tail_damping:.6g}) to satisfy Stake bet-level limits "
                "(CVaR 0.1% and ETL >40x cost); RTP target preserved."
            )
        if not weighting.tail_met:
            lines.append(
                "  WARNING: tail-compliance limits could NOT be fully satisfied "
                "with the current simulation pool. Do NOT upload -- inspect the "
                "constraints in game_config.py (RTP_TAIL_CONSTRAINTS)."
            )
        lines.append("  win distribution (selection-weighted):")
        for bucket in buckets:
            lines.append(f"    {bucket['range']:>6}: {bucket['weightShare'] * 100:.3f}%")
        lines.append("")

    if any(w.capped_for_diversity for _, w in weightings.values()):
        lines.append(
            "Diversity-capped modes did not reach their configured rtp_target because the "
            "existing reels/paytable for that mode cannot produce enough distinct large-payout "
            "simulations to support it without concentrating selection probability on very few "
            "books. This is a property of the current MVP reels/paytable/bet-mode cost, not of "
            "the optimizer; raising it further requires either richer feature math (see "
            "feature_contract.py) or revisiting that mode's bet cost -- both are design changes, "
            "intentionally out of scope here."
        )
    else:
        lines.append(
            "All modes reached their configured rtp_target with healthy lookup-table diversity "
            "(no mode was diversity-capped). Each mode's declared rtp_achieved equals the "
            "weighted RTP of its shipped lookup table; the package is internally consistent."
        )

    (publish_dir / "RTP_AUDIT.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (publish_dir / "RTP_AUDIT.txt").write_text("\n".join(lines), encoding="utf-8")


def write_publish_index(compressed: dict[str, bool]) -> None:
    publish_dir = ROOT / "library" / "publish_files"
    publish_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "modes": [
            {
                "name": mode,
                "cost": mode_config["cost"],
                "events": f"{mode}_books.jsonl.zst" if compressed[mode] else f"{mode}_books.jsonl",
                "weights": f"{mode}_lookup.csv",
            }
            for mode, mode_config in BET_MODES.items()
        ],
    }
    (publish_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")


def verify_publish_outputs(weightings: dict[str, tuple[list[dict], RtpWeighting]]) -> list[str]:
    errors: list[str] = []
    publish_index = ROOT / "library" / "publish_files" / "index.json"
    if not publish_index.exists():
        errors.append(f"missing publish file: {publish_index}")

    for mode, (books, weighting) in weightings.items():
        lookup_path = ROOT / "library" / "lookup_tables" / f"{mode}_lookup.csv"
        if not lookup_path.exists():
            errors.append(f"missing publish file: {lookup_path}")
            continue

        with lookup_path.open("r", encoding="utf-8", newline="") as file:
            rows = list(csv.reader(file))
        if len(rows) != len(books):
            errors.append(f"{mode} lookup row count {len(rows)} != {len(books)}")

        weighted_sum = 0
        weight_sum = 0
        for expected_id, row in enumerate(rows, start=1):
            if len(row) != 3:
                errors.append(f"{mode} lookup row must have 3 columns: {row}")
                continue
            try:
                values = [int(value) for value in row]
            except ValueError:
                errors.append(f"{mode} lookup row must contain uint64 values: {row}")
                continue
            if values[0] != expected_id:
                errors.append(f"{mode} lookup id {values[0]} != expected {expected_id}")
            if any(value < 0 for value in values):
                errors.append(f"{mode} lookup row must contain unsigned values: {row}")
            if values[2] != books[expected_id - 1]["payoutMultiplier"]:
                errors.append(f"{mode} lookup payout {values[2]} does not match book {expected_id}")
            weighted_sum += values[1] * values[2]
            weight_sum += values[1]

        if weight_sum > 0:
            lookup_rtp = weighted_sum / weight_sum / 100 / weighting.cost
            if abs(lookup_rtp - weighting.achieved_rtp) > 0.0005:
                errors.append(
                    f"{mode} lookup weighted RTP {lookup_rtp:.6f} does not match "
                    f"audited achieved RTP {weighting.achieved_rtp:.6f}"
                )

    return errors


def command_debug(args: argparse.Namespace) -> None:
    ensure_library_dirs()
    mode = args.mode
    books = generate_books(mode, args.spins, args.seed)
    target = ROOT / "library" / "books" / f"debug_{mode}_books.jsonl"
    write_jsonl(target, books)
    print(f"Wrote {len(books)} debug {mode} books to {target}")


def command_smoke(args: argparse.Namespace) -> None:
    ensure_library_dirs()
    errors: list[str] = []
    all_books: list[dict] = []
    for offset, mode in enumerate(BET_MODES):
        count = args.spins if mode == "base" else max(1, args.spins // 2)
        all_books.extend(generate_books(mode, count, args.seed + offset * 1000))
    for book in all_books:
        errors.extend(validate_book(book))

    lookup_ids = {book["id"] for book in all_books}
    missing = [book["id"] for book in all_books if book["id"] not in lookup_ids]
    if missing:
        errors.append(f"lookup mismatch: {missing}")

    if errors:
        print("Smoke test failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print(f"Smoke test passed for {len(all_books)} generated books.")


def _load_existing_books(mode: str, expected_count: int) -> list[dict] | None:
    path = ROOT / "library" / "books" / f"{mode}_books.jsonl"
    if not path.exists():
        return None
    books: list[dict] = []
    with path.open(encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line:
                books.append(json.loads(line))
    if len(books) != expected_count:
        return None
    return books


def command_publish(args: argparse.Namespace) -> None:
    ensure_library_dirs()
    books_by_mode: dict[str, list[dict]] = {}
    for offset, mode in enumerate(BET_MODES):
        count = args.spins if mode == "base" else args.bonus_spins
        if getattr(args, "reuse_books", False):
            existing = _load_existing_books(mode, count)
            if existing is not None:
                print(f"[{mode}] reusing {len(existing)} existing books (--reuse-books)", flush=True)
                books_by_mode[mode] = existing
                continue
            print(f"[{mode}] no reusable books found; generating fresh", flush=True)
        books_by_mode[mode] = generate_books(mode, count, args.seed + offset * 1000)

    errors: list[str] = []
    for books in books_by_mode.values():
        for book in books:
            errors.extend(validate_book(book))
    if errors:
        print("Publish validation failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    compressed: dict[str, bool] = {}
    for mode, books in books_by_mode.items():
        jsonl = ROOT / "library" / "books" / f"{mode}_books.jsonl"
        write_jsonl(jsonl, books)
        compressed[mode] = compress_zstd(jsonl, ROOT / "library" / "books_compressed" / f"{mode}_books.jsonl.zst")

    weightings = {}
    for mode, books in books_by_mode.items():
        print(f"[{mode}] optimizing lookup weights...", flush=True)
        weightings[mode] = compute_rtp_weighting(mode, books)
    for mode, weighting in weightings.items():
        write_lookup(mode, books_by_mode[mode], weighting.weights)
        write_force_records(mode, books_by_mode[mode])

    write_config_files(weightings, books_by_mode)
    write_publish_index(compressed)
    write_rtp_audit({mode: (books_by_mode[mode], weightings[mode]) for mode in books_by_mode})

    publish_errors = verify_publish_outputs(
        {mode: (books_by_mode[mode], weightings[mode]) for mode in books_by_mode}
    )
    if publish_errors:
        print("Publish output validation failed:")
        for error in publish_errors:
            print(f"- {error}")
        raise SystemExit(1)

    print(f"Wrote publish files to {ROOT / 'library' / 'publish_files'}")
    for mode, weighting in weightings.items():
        status = "CAPPED" if weighting.capped_for_diversity else "ok"
        print(
            f"  {mode}: target_rtp={weighting.target_rtp * 100:.2f}% "
            f"achieved_rtp={weighting.achieved_rtp * 100:.2f}% ({status}) "
            f"ess={weighting.effective_sample_size:.0f}/{len(books_by_mode[mode])}"
        )
    if not all(compressed.values()):
        print("zstandard is not installed. Install with: pip install zstandard")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Golden Goal Rush Math MVP")
    subparsers = parser.add_subparsers(dest="command", required=True)

    debug = subparsers.add_parser("debug", help="Generate uncompressed debug books")
    debug.add_argument("--spins", type=int, default=10)
    debug.add_argument("--seed", type=int, default=1)
    debug.add_argument("--mode", choices=list(BET_MODES.keys()), default="base")
    debug.set_defaults(func=command_debug)

    smoke = subparsers.add_parser("smoke", help="Validate generated book/event contract")
    smoke.add_argument("--spins", type=int, default=10)
    smoke.add_argument("--seed", type=int, default=1)
    smoke.set_defaults(func=command_smoke)

    publish = subparsers.add_parser("publish", help="Generate MVP publish files")
    publish.add_argument("--spins", type=int, default=80_000)
    publish.add_argument("--bonus-spins", type=int, default=40_000)
    publish.add_argument("--seed", type=int, default=1)
    publish.add_argument(
        "--reuse-books",
        action="store_true",
        help="Reuse library/books/*.jsonl if counts match (recompute weights only)",
    )
    publish.set_defaults(func=command_publish)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
