from __future__ import annotations

import json
import random
from pathlib import Path

from game_config import DEFAULT_TOTAL_FREE_SPINS, GAME_ID, SYMBOLS
from game_events import base_spin_events, free_spin_events

ROOT = Path(__file__).resolve().parent


def load_reels(mode: str) -> list[list[str]]:
    path = ROOT / "reels" / ("bonus_reels.json" if mode == "freegame" else "base_reels.json")
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data["reels"]


def make_board(reels: list[list[str]], rng: random.Random) -> tuple[list[list[dict[str, str]]], list[int]]:
    board: list[list[dict[str, str]]] = []
    padding_positions: list[int] = []
    for reel in reels:
        stop = rng.randrange(len(reel))
        padding_positions.append(stop)
        symbols = [reel[(stop + offset) % len(reel)] for offset in range(5)]
        board.append([{"name": symbol} for symbol in symbols])
    return board, padding_positions


def generate_base_book(book_id: int, rng: random.Random) -> dict:
    board, padding_positions = make_board(load_reels("basegame"), rng)
    events = base_spin_events(board, padding_positions, DEFAULT_TOTAL_FREE_SPINS)
    return {
        "id": book_id,
        "mode": "base",
        "payoutMultiplier": events[-1]["amount"],
        "events": events,
    }


def generate_bonus_book(book_id: int, rng: random.Random, total_free_spins: int = DEFAULT_TOTAL_FREE_SPINS) -> dict:
    accumulated = 0
    all_events: list[dict] = []
    for free_spin_index in range(total_free_spins):
        board, padding_positions = make_board(load_reels("freegame"), rng)
        spin_events, accumulated = free_spin_events(
            board,
            padding_positions,
            free_spin_index,
            total_free_spins,
            accumulated,
            include_end=free_spin_index == total_free_spins - 1,
        )
        for event in spin_events:
            event = dict(event)
            event["index"] = len(all_events)
            all_events.append(event)

    return {
        "id": book_id,
        "mode": "bonus",
        "payoutMultiplier": accumulated,
        "events": all_events,
    }


def validate_book(book: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(book.get("id"), int) or book.get("id", 0) <= 0:
        errors.append(f"{book.get('id')}: id must be a positive integer")
    if not isinstance(book.get("payoutMultiplier"), int) or book.get("payoutMultiplier", -1) < 0:
        errors.append(f"{book.get('id')}: payoutMultiplier must be an unsigned integer")

    events = book.get("events", [])
    for expected_index, event in enumerate(events):
        if event.get("index") != expected_index:
            errors.append(f"{book['id']}: event index {event.get('index')} should be {expected_index}")

        event_type = event.get("type")
        if event_type not in {
            "reveal",
            "winInfo",
            "setWin",
            "setTotalWin",
            "freeSpinTrigger",
            "updateFreeSpin",
            "freeSpinEnd",
            "finalWin",
        }:
            errors.append(f"{book['id']}: unknown event type {event_type}")

        if event_type == "reveal":
            board = event.get("board")
            if not isinstance(board, list) or len(board) != 5:
                errors.append(f"{book['id']}: reveal board must have 5 reels")
                continue
            for reel_index, reel in enumerate(board):
                if not isinstance(reel, list) or len(reel) != 5:
                    errors.append(f"{book['id']}: reel {reel_index} must have 5 padded rows")
                    continue
                for cell in reel:
                    if cell.get("name") not in SYMBOLS:
                        errors.append(f"{book['id']}: invalid symbol {cell.get('name')}")

        if event_type == "winInfo":
            for win in event.get("wins", []):
                for pos in win.get("positions", []):
                    if not (0 <= pos.get("reel", -1) < 5 and 1 <= pos.get("row", -1) <= 3):
                        errors.append(f"{book['id']}: invalid win position {pos}")

    final_events = [event for event in events if event.get("type") == "finalWin"]
    if not final_events:
        errors.append(f"{book['id']}: missing finalWin")
    else:
        final_amount = final_events[-1].get("amount", 0)
        expected_multiplier = final_amount
        if book.get("payoutMultiplier", 0) != expected_multiplier:
            errors.append(
                f"{book['id']}: payoutMultiplier {book.get('payoutMultiplier')} "
                f"does not match finalWin {final_amount}"
            )
    return errors


def generate_books(mode: str, count: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    if mode == "bonus":
        return [generate_bonus_book(index + 1, rng) for index in range(count)]
    return [generate_base_book(index + 1, rng) for index in range(count)]


def write_jsonl(path: Path, books: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        for book in books:
            file.write(json.dumps(book, separators=(",", ":")) + "\n")


def compress_zstd(source: Path, target: Path) -> bool:
    try:
        import zstandard as zstd  # type: ignore
    except ImportError:
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    compressor = zstd.ZstdCompressor(level=10)
    with source.open("rb") as src, target.open("wb") as dst:
        dst.write(compressor.compress(src.read()))
    return True


def ensure_library_dirs() -> None:
    for relative in [
        "library/books",
        "library/books_compressed",
        "library/configs",
        "library/forces",
        "library/lookup_tables",
        "library/publish_files",
    ]:
        (ROOT / relative).mkdir(parents=True, exist_ok=True)
