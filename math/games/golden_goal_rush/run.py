from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from game_config import (
    BET_MODES,
    GAME_ID,
    GAME_NAME,
    PAYLINES,
    PAYTABLE,
    RTP_LOOKUP_WEIGHT_SCALE,
    RTP_MAX_TOP_WEIGHT_SHARE,
    RTP_MIN_EFFECTIVE_SAMPLE_FLOOR,
    RTP_MIN_EFFECTIVE_SAMPLE_FRACTION,
    SYMBOLS,
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
    )


def write_config_files(weightings: dict[str, RtpWeighting]) -> None:
    config_dir = ROOT / "library" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    bet_modes = {}
    for mode, mode_config in BET_MODES.items():
        weighting = weightings[mode]
        bet_modes[mode] = {
            **mode_config,
            "rtp_achieved": round(weighting.achieved_rtp, 6),
            "rtp_capped_for_diversity": weighting.capped_for_diversity,
        }
    config = {
        "gameId": GAME_ID,
        "gameName": GAME_NAME,
        "version": VERSION,
        "layout": {"reels": 5, "visibleRows": 3, "paddedRows": 5},
        "system": "20-lines",
        "symbols": list(SYMBOLS),
        "paylines": PAYLINES,
        "paytable": PAYTABLE,
        "betModes": bet_modes,
        "frontendContract": {
            "layout": "5 reels x 3 visible rows",
            "boardShape": "5 reels x 5 padded rows",
            "eventTypes": [
                "reveal",
                "winInfo",
                "setWin",
                "setTotalWin",
                "freeSpinTrigger",
                "updateFreeSpin",
                "freeSpinEnd",
                "finalWin",
            ],
            "freeSpinRetrigger": "not emitted",
        },
        "note": (
            "MVP feature set (Phase 8B grid/cluster contract not wired in). "
            "RTP is calibrated via lookup-weight optimization -- see RTP_AUDIT.json. "
            "Not regulatory-approved math."
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
    all_books = generate_books("base", args.spins, args.seed) + generate_books(
        "bonus", max(1, args.spins // 2), args.seed + 1000
    )
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


def command_publish(args: argparse.Namespace) -> None:
    ensure_library_dirs()
    base_books = generate_books("base", args.spins, args.seed)
    bonus_books = generate_books("bonus", args.bonus_spins, args.seed + 1000)
    books_by_mode = {"base": base_books, "bonus": bonus_books}

    errors: list[str] = []
    for book in base_books + bonus_books:
        errors.extend(validate_book(book))
    if errors:
        print("Publish validation failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    base_jsonl = ROOT / "library" / "books" / "base_books.jsonl"
    bonus_jsonl = ROOT / "library" / "books" / "bonus_books.jsonl"
    write_jsonl(base_jsonl, base_books)
    write_jsonl(bonus_jsonl, bonus_books)

    compressed = {
        "base": compress_zstd(base_jsonl, ROOT / "library" / "books_compressed" / "base_books.jsonl.zst"),
        "bonus": compress_zstd(bonus_jsonl, ROOT / "library" / "books_compressed" / "bonus_books.jsonl.zst"),
    }

    weightings = {mode: compute_rtp_weighting(mode, books) for mode, books in books_by_mode.items()}
    for mode, weighting in weightings.items():
        write_lookup(mode, books_by_mode[mode], weighting.weights)
        write_force_records(mode, books_by_mode[mode])

    write_config_files(weightings)
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
    debug.add_argument("--mode", choices=["base", "bonus"], default="base")
    debug.set_defaults(func=command_debug)

    smoke = subparsers.add_parser("smoke", help="Validate generated book/event contract")
    smoke.add_argument("--spins", type=int, default=10)
    smoke.add_argument("--seed", type=int, default=1)
    smoke.set_defaults(func=command_smoke)

    publish = subparsers.add_parser("publish", help="Generate MVP publish files")
    publish.add_argument("--spins", type=int, default=80_000)
    publish.add_argument("--bonus-spins", type=int, default=40_000)
    publish.add_argument("--seed", type=int, default=1)
    publish.set_defaults(func=command_publish)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
