from __future__ import annotations

from dataclasses import dataclass

from game_config import (
    MIN_CLUSTER,
    NORMAL_SYMBOLS,
    SCATTER_SYMBOL,
    SYMBOL_MATH,
    VISIBLE_ROWS,
    WILD_SYMBOL,
)


@dataclass(frozen=True)
class ClusterWin:
    symbol: str
    kind: int
    win: int
    positions: list[dict[str, int]]
    multiplier: int = 1


def symbol_name(cell: dict[str, str] | str) -> str:
    if isinstance(cell, str):
        return cell
    return str(cell.get("name", "ten"))


def board_symbols(board: list[list[dict[str, str]]]) -> list[list[str]]:
    return [[symbol_name(cell) for cell in reel] for reel in board]


def scatter_positions(board: list[list[dict[str, str]]]) -> list[dict[str, int]]:
    positions: list[dict[str, int]] = []
    for reel_index, reel in enumerate(board):
        for row, cell in enumerate(reel):
            if symbol_name(cell) == SCATTER_SYMBOL:
                positions.append({"reel": reel_index, "col": reel_index, "row": row})
    return positions


def symbols_connect(target: str, candidate: str) -> bool:
    """Return whether *candidate* participates in *target*'s cluster.

    Wilds are substitutes, never a cluster target of their own.  Keeping the
    relationship directional makes the ownership rule explicit: every paying
    symbol is evaluated independently over cells containing that symbol or a
    Wild.  A Wild may therefore help simultaneous clusters of different
    symbols, but a Wild-only component never pays.
    """

    return target in NORMAL_SYMBOLS and candidate in {target, WILD_SYMBOL}


def pay_for(symbol: str, count: int, multiplier: int = 1) -> int:
    pay = float(SYMBOL_MATH.get(symbol, {}).get("pay", 0.0))
    if pay <= 0:
        return 0
    size_boost = 8 if count >= 12 else 4 if count >= 9 else 2 if count >= 7 else 1
    return int(round(pay * size_boost * multiplier * 100))


def _find_clusters_for_targets(
    symbols: list[list[str]],
    targets: tuple[str, ...] | list[str],
    multiplier: int,
) -> list[ClusterWin]:
    """Find clusters using target-specific visitation state.

    The previous implementation shared one ``seen`` matrix between all
    symbols.  A losing component encountered early in board order could mark a
    Wild as seen and prevent a later paying component from using it.  Each
    target now has its own visitation state, so discovery cannot depend on
    either board scan order or paying-symbol iteration order.
    """

    cols = len(symbols)
    rows = VISIBLE_ROWS
    clusters: list[tuple[tuple[tuple[int, int], ...], ClusterWin]] = []

    # A set removes a duplicated caller-supplied target; sorting makes the
    # result stable even when tests deliberately reverse the target order.
    paying_targets = sorted(
        {
            target
            for target in targets
            if target in NORMAL_SYMBOLS and float(SYMBOL_MATH.get(target, {}).get("pay", 0.0)) > 0
        }
    )
    for target in paying_targets:
        seen = [[False for _ in range(rows)] for _ in range(cols)]
        for col in range(cols):
            for row in range(rows):
                if seen[col][row] or symbols[col][row] != target:
                    continue

                stack = [(col, row)]
                seen[col][row] = True
                cells: set[tuple[int, int]] = set()
                while stack:
                    current_col, current_row = stack.pop()
                    cells.add((current_col, current_row))
                    for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        next_col = current_col + dc
                        next_row = current_row + dr
                        if next_col < 0 or next_col >= cols or next_row < 0 or next_row >= rows:
                            continue
                        if seen[next_col][next_row]:
                            continue
                        if symbols_connect(target, symbols[next_col][next_row]):
                            seen[next_col][next_row] = True
                            stack.append((next_col, next_row))

                ordered_cells = tuple(sorted(cells))
                if len(ordered_cells) < MIN_CLUSTER:
                    continue

                win = pay_for(target, len(ordered_cells), multiplier)
                if win <= 0:
                    continue

                cluster = ClusterWin(
                    symbol=target,
                    kind=len(ordered_cells),
                    win=win,
                    positions=[{"reel": c, "col": c, "row": r} for c, r in ordered_cells],
                    multiplier=multiplier,
                )
                clusters.append((ordered_cells, cluster))

    # Reading-order position first keeps serialized win order deterministic;
    # symbol is an explicit tie-breaker when clusters share a substituting Wild.
    clusters.sort(key=lambda item: (item[0][0], item[1].symbol, item[0]))
    return [cluster for _, cluster in clusters]


def find_clusters(board: list[list[dict[str, str]]], multiplier: int = 1) -> list[ClusterWin]:
    return _find_clusters_for_targets(board_symbols(board), list(NORMAL_SYMBOLS), multiplier)


def win_level_for_amount(amount: int) -> int:
    if amount >= 500000:
        return 7
    if amount >= 100000:
        return 6
    if amount >= 50000:
        return 5
    if amount >= 10000:
        return 4
    if amount >= 5000:
        return 3
    if amount >= 1000:
        return 2
    return 1


def payout_multiplier(amount: int, total_bet: int) -> float:
    if total_bet <= 0:
        return 0.0
    return round(amount / total_bet, 4)
