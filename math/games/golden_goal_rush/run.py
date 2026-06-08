from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from game_config import BET_MODES, GAME_ID, GAME_NAME, PAYLINES, PAYTABLE, SYMBOLS, VERSION
from game_executables import (
    ROOT,
    compress_zstd,
    ensure_library_dirs,
    generate_books,
    validate_book,
    write_jsonl,
)


def write_config_files() -> None:
    config_dir = ROOT / "library" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "gameId": GAME_ID,
        "gameName": GAME_NAME,
        "version": VERSION,
        "layout": {"reels": 5, "visibleRows": 3, "paddedRows": 5},
        "system": "20-lines",
        "symbols": list(SYMBOLS),
        "paylines": PAYLINES,
        "paytable": PAYTABLE,
        "betModes": BET_MODES,
        "note": "MVP configuration only. Not final RTP or regulatory math.",
    }
    (config_dir / "game_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")


def write_lookup(mode: str, books: list[dict]) -> Path:
    lookup_path = ROOT / "library" / "lookup_tables" / f"{mode}_lookup.csv"
    lookup_path.parent.mkdir(parents=True, exist_ok=True)
    with lookup_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        for book in books:
            writer.writerow([book["id"], 1, book["payoutMultiplier"]])
    return lookup_path


def write_publish_index(base_books: list[dict], bonus_books: list[dict], compressed: dict[str, bool]) -> None:
    publish_dir = ROOT / "library" / "publish_files"
    publish_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "gameId": GAME_ID,
        "gameName": GAME_NAME,
        "version": VERSION,
        "status": "mvp_not_regulatory_final",
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
        "files": {
            "baseLookup": "../lookup_tables/base_lookup.csv",
            "bonusLookup": "../lookup_tables/bonus_lookup.csv",
            "baseBooks": "../books/base_books.jsonl",
            "bonusBooks": "../books/bonus_books.jsonl",
            "baseBooksCompressed": "../books_compressed/base_books.jsonl.zst" if compressed["base"] else None,
            "bonusBooksCompressed": "../books_compressed/bonus_books.jsonl.zst" if compressed["bonus"] else None,
            "config": "../configs/game_config.json",
        },
        "counts": {"baseBooks": len(base_books), "bonusBooks": len(bonus_books)},
        "compression": {
            "zstandardAvailable": compressed["base"] and compressed["bonus"],
            "installIfMissing": "pip install zstandard",
        },
    }
    (publish_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")


def verify_publish_outputs(base_books: list[dict], bonus_books: list[dict]) -> list[str]:
    errors: list[str] = []
    publish_index = ROOT / "library" / "publish_files" / "index.json"
    base_lookup = ROOT / "library" / "lookup_tables" / "base_lookup.csv"
    bonus_lookup = ROOT / "library" / "lookup_tables" / "bonus_lookup.csv"
    for path in [publish_index, base_lookup, bonus_lookup]:
        if not path.exists():
            errors.append(f"missing publish file: {path}")

    if base_lookup.exists():
        with base_lookup.open("r", encoding="utf-8", newline="") as file:
            rows = list(csv.reader(file))
        if len(rows) != len(base_books):
            errors.append(f"base lookup row count {len(rows)} != {len(base_books)}")
        for expected_id, row in enumerate(rows, start=1):
            if len(row) != 3:
                errors.append(f"base lookup row must have 3 columns: {row}")
                continue
            try:
                values = [int(value) for value in row]
            except ValueError:
                errors.append(f"base lookup row must contain uint64 values: {row}")
                continue
            if values[0] != expected_id:
                errors.append(f"base lookup id {values[0]} != expected {expected_id}")
            if any(value < 0 for value in values):
                errors.append(f"base lookup row must contain unsigned values: {row}")
            if values[2] != base_books[expected_id - 1]["payoutMultiplier"]:
                errors.append(f"base lookup payout {values[2]} does not match book {expected_id}")

    if bonus_lookup.exists():
        with bonus_lookup.open("r", encoding="utf-8", newline="") as file:
            rows = list(csv.reader(file))
        if len(rows) != len(bonus_books):
            errors.append(f"bonus lookup row count {len(rows)} != {len(bonus_books)}")
        for expected_id, row in enumerate(rows, start=1):
            if len(row) != 3:
                errors.append(f"bonus lookup row must have 3 columns: {row}")
                continue
            try:
                values = [int(value) for value in row]
            except ValueError:
                errors.append(f"bonus lookup row must contain uint64 values: {row}")
                continue
            if values[0] != expected_id:
                errors.append(f"bonus lookup id {values[0]} != expected {expected_id}")
            if any(value < 0 for value in values):
                errors.append(f"bonus lookup row must contain unsigned values: {row}")
            if values[2] != bonus_books[expected_id - 1]["payoutMultiplier"]:
                errors.append(f"bonus lookup payout {values[2]} does not match book {expected_id}")

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

    write_lookup("base", base_books)
    write_lookup("bonus", bonus_books)
    write_config_files()
    write_publish_index(base_books, bonus_books, compressed)
    publish_errors = verify_publish_outputs(base_books, bonus_books)
    if publish_errors:
        print("Publish output validation failed:")
        for error in publish_errors:
            print(f"- {error}")
        raise SystemExit(1)
    print(f"Wrote publish files to {ROOT / 'library' / 'publish_files'}")
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
    publish.add_argument("--spins", type=int, default=100)
    publish.add_argument("--bonus-spins", type=int, default=25)
    publish.add_argument("--seed", type=int, default=1)
    publish.set_defaults(func=command_publish)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
