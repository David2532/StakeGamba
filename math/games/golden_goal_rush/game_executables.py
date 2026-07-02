from __future__ import annotations

import json
import random
from dataclasses import replace
from pathlib import Path

from game_calculations import ClusterWin, find_clusters, scatter_positions
from game_config import (
    BET_MODES,
    BRONZE_VALUES,
    DEFAULT_TOTAL_FREE_SPINS,
    FREE_SPIN_TIERS,
    GOLD_VALUES,
    GOLDEN_REVEAL_WEIGHTS,
    HUNT_RAINBOW_BOOST,
    MAX_COLLECTOR_CYCLES,
    MAX_WIN_AMOUNT,
    MULTIPLIER_VALUES,
    NORMAL_SYMBOLS,
    NUM_REELS,
    PADDED_ROWS,
    RAINBOW_SYMBOL,
    RAINBOW_WEIGHT,
    SCATTER_SYMBOL,
    SCATTER_WEIGHT,
    SILVER_VALUES,
    SYMBOL_MATH,
    SYMBOLS,
    VISIBLE_ROWS,
)
from game_events import (
    KNOWN_EVENT_TYPES,
    append_win_sequence,
    final_win_event,
    free_spin_end_event,
    free_spin_trigger_event,
    golden_award_event,
    golden_clear_event,
    golden_reveal_event,
    reindex,
    reveal_event,
    tumble_event,
    update_free_spin_event,
    win_info_event,
)

ROOT = Path(__file__).resolve().parent


def weighted_pick(rng: random.Random, entries: list[tuple[str, float]]) -> str:
    total = sum(max(0.0, weight) for _, weight in entries)
    if total <= 0:
        return entries[0][0]
    roll = rng.random() * total
    for value, weight in entries:
        roll -= max(0.0, weight)
        if roll <= 0:
            return value
    return entries[-1][0]


def symbol_entries(
    *,
    no_rainbow: bool = False,
    boost_rainbow: float = 1.0,
    boost_scatter: float = 1.0,
    allow_scatter: bool = True,
) -> list[tuple[str, float]]:
    entries: list[tuple[str, float]] = []
    for symbol in SYMBOLS:
        weight = float(SYMBOL_MATH[symbol]["weight"])
        if symbol == RAINBOW_SYMBOL:
            weight = 0.0 if no_rainbow else RAINBOW_WEIGHT * boost_rainbow
        elif symbol == SCATTER_SYMBOL:
            weight = SCATTER_WEIGHT * boost_scatter if allow_scatter else 0.0
        entries.append((symbol, weight))
    return entries


def random_symbol(rng: random.Random, opts: dict | None = None) -> str:
    opts = opts or {}
    return weighted_pick(
        rng,
        symbol_entries(
            no_rainbow=bool(opts.get("no_rainbow", False)),
            boost_rainbow=float(opts.get("boost_rainbow", 1.0)),
            boost_scatter=float(opts.get("boost_scatter", 1.0)),
            allow_scatter=bool(opts.get("allow_scatter", True)),
        ),
    )


def make_cell(symbol: str) -> dict[str, str]:
    return {"name": symbol}


def clone_board(board: list[list[dict[str, str]]]) -> list[list[dict[str, str]]]:
    return [[{"name": cell["name"]} for cell in reel] for reel in board]


def count_scatters(board: list[list[dict[str, str]]]) -> int:
    return sum(1 for reel in board for cell in reel if cell["name"] == SCATTER_SYMBOL)


def replacement_normal_symbol(rng: random.Random, current: str | None = None) -> str:
    choices = [symbol for symbol in NORMAL_SYMBOLS if symbol != current]
    return rng.choice(choices or list(NORMAL_SYMBOLS))


def limit_scatters(board: list[list[dict[str, str]]], rng: random.Random, max_count: int = 2) -> None:
    positions = [(col, row) for col, reel in enumerate(board) for row, cell in enumerate(reel) if cell["name"] == SCATTER_SYMBOL]
    if len(positions) <= max_count:
        return
    rng.shuffle(positions)
    for col, row in positions[max_count:]:
        board[col][row]["name"] = replacement_normal_symbol(rng, SCATTER_SYMBOL)


def make_board(rng: random.Random, opts: dict | None = None, max_scatters: int | None = None) -> list[list[dict[str, str]]]:
    opts = opts or {}
    board = [
        [make_cell(random_symbol(rng, opts)) for _ in range(VISIBLE_ROWS)]
        for _ in range(NUM_REELS)
    ]
    if opts.get("force_rainbow") and not any(cell["name"] == RAINBOW_SYMBOL for reel in board for cell in reel):
        board[rng.randrange(NUM_REELS)][rng.randrange(VISIBLE_ROWS)]["name"] = RAINBOW_SYMBOL
    if max_scatters is not None:
        limit_scatters(board, rng, max_scatters)
    return board


def board_has_rainbow(board: list[list[dict[str, str]]]) -> bool:
    return any(cell["name"] == RAINBOW_SYMBOL for reel in board for cell in reel)


def scale_cluster_wins(clusters: list[ClusterWin], remaining: int) -> list[ClusterWin]:
    raw_total = sum(cluster.win for cluster in clusters)
    if raw_total <= remaining:
        return clusters
    if remaining <= 0:
        return []
    scaled: list[ClusterWin] = []
    allocated = 0
    for index, cluster in enumerate(clusters):
        if index == len(clusters) - 1:
            win = max(0, remaining - allocated)
        else:
            win = int(round(cluster.win * remaining / raw_total))
            win = min(win, max(0, remaining - allocated))
        allocated += win
        if win > 0:
            scaled.append(replace(cluster, win=win))
    return scaled


def tumble_board(
    board: list[list[dict[str, str]]],
    removed_positions: list[dict[str, int]],
    rng: random.Random,
    opts: dict | None = None,
    max_scatters: int | None = None,
) -> tuple[list[list[dict[str, str]]], list[list[dict[str, str]]]]:
    opts = opts or {}
    removed_by_col = [set() for _ in range(NUM_REELS)]
    for pos in removed_positions:
        removed_by_col[int(pos["reel"])].add(int(pos["row"]))

    new_symbols: list[list[dict[str, str]]] = [[] for _ in range(NUM_REELS)]
    next_board = clone_board(board)
    for col in range(NUM_REELS):
        if not removed_by_col[col]:
            continue
        survivors = [board[col][row] for row in range(VISIBLE_ROWS) if row not in removed_by_col[col]]
        add_count = VISIBLE_ROWS - len(survivors)
        additions = [make_cell(random_symbol(rng, opts)) for _ in range(add_count)]
        new_symbols[col] = clone_board([additions])[0]
        next_board[col] = additions + [{"name": cell["name"]} for cell in survivors]

    if max_scatters is not None:
        limit_scatters(next_board, rng, max_scatters)
    return next_board, new_symbols


def resolve_cascades(
    events: list[dict],
    board: list[list[dict[str, str]]],
    rng: random.Random,
    total_win: int,
    golden_cells: set[tuple[int, int]],
    opts: dict | None = None,
    max_scatters: int | None = None,
) -> tuple[int, set[tuple[int, int]], list[list[dict[str, str]]]]:
    multiplier = 1
    cascade_count = 0
    while total_win < MAX_WIN_AMOUNT and cascade_count < 40:
        clusters = find_clusters(board, multiplier)
        if not clusters:
            break
        clusters = scale_cluster_wins(clusters, MAX_WIN_AMOUNT - total_win)
        if not clusters:
            break

        cascade_count += 1
        step_win = sum(cluster.win for cluster in clusters)
        total_win = min(MAX_WIN_AMOUNT, total_win + step_win)
        removed_positions: list[dict[str, int]] = []
        seen_positions: set[tuple[int, int]] = set()
        for cluster in clusters:
            for pos in cluster.positions:
                cell = (int(pos["reel"]), int(pos["row"]))
                golden_cells.add(cell)
                if cell in seen_positions:
                    continue
                seen_positions.add(cell)
                removed_positions.append({"reel": cell[0], "col": cell[0], "row": cell[1]})

        events.append(win_info_event(len(events), clusters, total_win))
        append_win_sequence(events, total_win)
        board, new_symbols = tumble_board(board, removed_positions, rng, opts, max_scatters=max_scatters)
        events.append(tumble_event(len(events), removed_positions, new_symbols, clone_board(board)))
        multiplier += 1

    return total_win, golden_cells, board


def position_dict(col: int, row: int) -> dict[str, int]:
    return {"reel": col, "col": col, "row": row}


def reveal_reward_for_cell(rng: random.Random, col: int, row: int, tier: int) -> dict:
    tier_config = FREE_SPIN_TIERS.get(tier, {})
    reduce_bronze = bool(tier_config.get("reduceBronze", False))
    weights = dict(GOLDEN_REVEAL_WEIGHTS)
    if reduce_bronze:
        weights["bronze"] = max(1.0, round(weights["bronze"] * 0.12))

    kind = weighted_pick(rng, [(key, weights[key]) for key in ("blank", "bronze", "silver", "gold", "mult", "collector")])
    reward = {**position_dict(col, row), "kind": kind, "value": 0}
    if kind == "blank":
        return reward
    if kind == "mult":
        reward["value"] = rng.choice(MULTIPLIER_VALUES)
        return reward
    if kind == "collector":
        return reward

    values = GOLD_VALUES if kind == "gold" else SILVER_VALUES if kind == "silver" else BRONZE_VALUES
    reward["kind"] = "coin"
    reward["tier"] = kind
    reward["value"] = rng.choice(values)
    return reward


def apply_reward_multipliers(rewards: list[dict]) -> None:
    by_cell = {(int(reward["col"]), int(reward["row"])): reward for reward in rewards}
    for reward in list(rewards):
        if reward.get("kind") != "mult":
            continue
        col = int(reward["col"])
        row = int(reward["row"])
        mult = float(reward.get("value", 1))
        for dc in (-1, 0, 1):
            for dr in (-1, 0, 1):
                if dc == 0 and dr == 0:
                    continue
                neighbor = by_cell.get((col + dc, row + dr))
                if neighbor and neighbor.get("kind") == "coin":
                    neighbor["value"] = round(float(neighbor.get("value", 0)) * mult, 2)


def reward_amount(reward: dict) -> int:
    if reward.get("kind") != "coin":
        return 0
    return int(round(float(reward.get("value", 0)) * 100))


def run_golden_feature(
    events: list[dict],
    rng: random.Random,
    total_win: int,
    golden_cells: set[tuple[int, int]],
    tier: int,
) -> tuple[int, set[tuple[int, int]]]:
    if not golden_cells or total_win >= MAX_WIN_AMOUNT:
        return total_win, golden_cells

    for cycle in range(MAX_COLLECTOR_CYCLES):
        rewards = [reveal_reward_for_cell(rng, col, row, tier) for col, row in sorted(golden_cells, key=lambda cell: (cell[1], cell[0]))]
        apply_reward_multipliers(rewards)
        events.append(golden_reveal_event(len(events), rewards, cycle))

        coin_sum = sum(reward_amount(reward) for reward in rewards)
        collector_positions = [position_dict(int(reward["col"]), int(reward["row"])) for reward in rewards if reward.get("kind") == "collector"]
        for collector_pos in collector_positions:
            if coin_sum <= 0 or total_win >= MAX_WIN_AMOUNT:
                continue
            delta = min(coin_sum, MAX_WIN_AMOUNT - total_win)
            total_win += delta
            events.append(golden_award_event(len(events), delta, total_win, cycle, [collector_pos]))

        if coin_sum > 0 and total_win < MAX_WIN_AMOUNT:
            delta = min(coin_sum, MAX_WIN_AMOUNT - total_win)
            total_win += delta
            events.append(golden_award_event(len(events), delta, total_win, cycle, []))

        if not collector_positions or total_win >= MAX_WIN_AMOUNT:
            break
        events.append(golden_clear_event(len(events), clear_golden=False))

    events.append(golden_clear_event(len(events), clear_golden=False))
    return total_win, golden_cells


def spin_options_for_mode(mode: str, tier: int = 0) -> tuple[dict, bool, int | None]:
    if mode == "hunt":
        return {"boost_rainbow": HUNT_RAINBOW_BOOST}, False, 2
    if mode == "rainbow":
        return {"force_rainbow": True}, True, None
    if tier:
        tier_config = FREE_SPIN_TIERS.get(tier, {})
        return {
            "force_rainbow": bool(tier_config.get("guaranteedRainbow", False)),
            "boost_rainbow": float(tier_config.get("rainbowBoost", 1.0)),
        }, False, 2
    return {}, True, None


def play_single_spin(
    events: list[dict],
    rng: random.Random,
    total_win: int,
    golden_cells: set[tuple[int, int]],
    *,
    game_type: str,
    mode: str = "base",
    tier: int = 0,
    allow_free_trigger: bool = False,
) -> tuple[int, set[tuple[int, int]], list[list[dict[str, str]]]]:
    opts, _, max_scatters = spin_options_for_mode(mode, tier)
    if not allow_free_trigger and game_type != "basegame":
        max_scatters = 2
    board = make_board(rng, opts, max_scatters=max_scatters)
    events.append(reveal_event(len(events), clone_board(board), game_type))
    total_win, golden_cells, board = resolve_cascades(events, board, rng, total_win, golden_cells, opts, max_scatters=max_scatters)
    if board_has_rainbow(board) and golden_cells:
        total_win, golden_cells = run_golden_feature(events, rng, total_win, golden_cells, tier)
        tier_config = FREE_SPIN_TIERS.get(tier, {})
        if game_type == "freegame" and not bool(tier_config.get("persistAfterReveal", False)):
            golden_cells.clear()
            events.append(golden_clear_event(len(events), clear_golden=True))
    return total_win, golden_cells, board


def play_free_spins(
    events: list[dict],
    rng: random.Random,
    total_win: int,
    *,
    tier: int,
    golden_cells: set[tuple[int, int]] | None = None,
) -> tuple[int, set[tuple[int, int]]]:
    tier_config = FREE_SPIN_TIERS[tier]
    total_spins = int(tier_config["spins"])
    golden_cells = set(golden_cells or set())
    for free_spin_index in range(total_spins):
        events.append(update_free_spin_event(len(events), free_spin_index, total_spins, tier))
        total_win, golden_cells, _ = play_single_spin(
            events,
            rng,
            total_win,
            golden_cells,
            game_type="freegame",
            tier=tier,
            allow_free_trigger=False,
        )
    events.append(free_spin_end_event(len(events), total_win))
    return total_win, golden_cells


def trigger_tier_for_scatters(count: int) -> int:
    if count >= 5:
        return 3
    if count >= 4:
        return 2
    return 1


def generate_base_like_book(book_id: int, rng: random.Random, mode: str = "base") -> dict:
    events: list[dict] = []
    total_win = 0
    golden_cells: set[tuple[int, int]] = set()
    allow_free_trigger = mode in {"base", "rainbow"}
    total_win, golden_cells, board = play_single_spin(
        events,
        rng,
        total_win,
        golden_cells,
        game_type="basegame",
        mode=mode,
        allow_free_trigger=allow_free_trigger,
    )

    scatters = scatter_positions(board)
    if allow_free_trigger and len(scatters) >= 3 and total_win < MAX_WIN_AMOUNT:
        tier = trigger_tier_for_scatters(len(scatters))
        total_spins = int(FREE_SPIN_TIERS[tier]["spins"])
        events.append(free_spin_trigger_event(len(events), total_spins, scatters, tier))
        if golden_cells:
            golden_cells.clear()
            events.append(golden_clear_event(len(events), clear_golden=True))
        total_win, golden_cells = play_free_spins(events, rng, total_win, tier=tier)

    if golden_cells:
        events.append(golden_clear_event(len(events), clear_golden=True))
    events.append(final_win_event(len(events), total_win))
    reindex(events)
    return {
        "id": book_id,
        "mode": mode,
        "payoutMultiplier": total_win,
        "events": events,
    }


def generate_base_book(book_id: int, rng: random.Random) -> dict:
    return generate_base_like_book(book_id, rng, "base")


def generate_bonus_book(book_id: int, rng: random.Random, total_free_spins: int = DEFAULT_TOTAL_FREE_SPINS, tier: int = 2) -> dict:
    del total_free_spins
    events: list[dict] = []
    total_win = 0
    total_spins = int(FREE_SPIN_TIERS[tier]["spins"])
    events.append(free_spin_trigger_event(len(events), total_spins, [], tier))
    total_win, golden_cells = play_free_spins(events, rng, total_win, tier=tier)
    if golden_cells:
        events.append(golden_clear_event(len(events), clear_golden=True))
    events.append(final_win_event(len(events), total_win))
    reindex(events)
    return {
        "id": book_id,
        "mode": "bonus_tier1" if tier == 1 else "bonus",
        "payoutMultiplier": total_win,
        "events": events,
    }


def validate_book(book: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(book.get("id"), int) or book.get("id", 0) <= 0:
        errors.append(f"{book.get('id')}: id must be a positive integer")
    if book.get("mode") not in BET_MODES:
        errors.append(f"{book.get('id')}: unknown mode {book.get('mode')}")
    if not isinstance(book.get("payoutMultiplier"), int) or book.get("payoutMultiplier", -1) < 0:
        errors.append(f"{book.get('id')}: payoutMultiplier must be an unsigned integer")

    events = book.get("events", [])
    for expected_index, event in enumerate(events):
        if event.get("index") != expected_index:
            errors.append(f"{book['id']}: event index {event.get('index')} should be {expected_index}")

        event_type = event.get("type")
        if event_type not in KNOWN_EVENT_TYPES:
            errors.append(f"{book['id']}: unknown event type {event_type}")

        if event_type == "reveal":
            board = event.get("board")
            if not isinstance(board, list) or len(board) != NUM_REELS:
                errors.append(f"{book['id']}: reveal board must have {NUM_REELS} reels")
                continue
            for reel_index, reel in enumerate(board):
                if not isinstance(reel, list) or len(reel) != PADDED_ROWS:
                    errors.append(f"{book['id']}: reel {reel_index} must have {PADDED_ROWS} rows")
                    continue
                for cell in reel:
                    if cell.get("name") not in SYMBOLS:
                        errors.append(f"{book['id']}: invalid symbol {cell.get('name')}")

        if event_type == "winInfo":
            total = sum(int(win.get("win", 0)) for win in event.get("wins", []))
            if total != int(event.get("totalWin", 0)):
                errors.append(f"{book['id']}: winInfo totalWin mismatch")
            for win in event.get("wins", []):
                for pos in win.get("positions", []):
                    if not (0 <= pos.get("reel", -1) < NUM_REELS and 0 <= pos.get("row", -1) < VISIBLE_ROWS):
                        errors.append(f"{book['id']}: invalid win position {pos}")

        if event_type in {"freeSpinTrigger", "goldenAward"}:
            for pos in event.get("positions", []) + event.get("collectorPositions", []):
                if not (0 <= pos.get("reel", -1) < NUM_REELS and 0 <= pos.get("row", -1) < VISIBLE_ROWS):
                    errors.append(f"{book['id']}: invalid event position {pos}")

        if event_type == "goldenReveal":
            for reward in event.get("rewards", []):
                if reward.get("kind") not in {"blank", "coin", "mult", "collector"}:
                    errors.append(f"{book['id']}: invalid golden reward {reward}")
                if not (0 <= reward.get("reel", -1) < NUM_REELS and 0 <= reward.get("row", -1) < VISIBLE_ROWS):
                    errors.append(f"{book['id']}: invalid golden reward position {reward}")

    final_events = [event for event in events if event.get("type") == "finalWin"]
    if not final_events:
        errors.append(f"{book['id']}: missing finalWin")
    else:
        final_amount = int(final_events[-1].get("amount", 0))
        if book.get("payoutMultiplier", 0) != final_amount:
            errors.append(
                f"{book['id']}: payoutMultiplier {book.get('payoutMultiplier')} "
                f"does not match finalWin {final_amount}"
            )
    return errors


def generate_books(mode: str, count: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    if mode == "base":
        return [generate_base_book(index + 1, rng) for index in range(count)]
    if mode == "hunt":
        return [generate_base_like_book(index + 1, rng, "hunt") for index in range(count)]
    if mode == "rainbow":
        return [generate_base_like_book(index + 1, rng, "rainbow") for index in range(count)]
    if mode == "bonus_tier1":
        return [generate_bonus_book(index + 1, rng, tier=1) for index in range(count)]
    if mode == "bonus":
        return [generate_bonus_book(index + 1, rng, tier=2) for index in range(count)]
    raise ValueError(f"Unknown mode: {mode}")


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
