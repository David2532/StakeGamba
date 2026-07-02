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
    if candidate == target:
        return True
    if candidate == WILD_SYMBOL and target in NORMAL_SYMBOLS:
        return True
    if target == WILD_SYMBOL and candidate in NORMAL_SYMBOLS:
        return True
    return False


def pay_for(symbol: str, count: int, multiplier: int = 1) -> int:
    pay = float(SYMBOL_MATH.get(symbol, {}).get("pay", 0.0))
    if pay <= 0:
        return 0
    size_boost = 8 if count >= 12 else 4 if count >= 9 else 2 if count >= 7 else 1
    return int(round(pay * size_boost * multiplier * 100))


def find_clusters(board: list[list[dict[str, str]]], multiplier: int = 1) -> list[ClusterWin]:
    symbols = board_symbols(board)
    cols = len(symbols)
    rows = VISIBLE_ROWS
    seen = [[False for _ in range(rows)] for _ in range(cols)]
    clusters: list[ClusterWin] = []

    for col in range(cols):
        for row in range(rows):
            target = symbols[col][row]
            if seen[col][row] or target not in NORMAL_SYMBOLS:
                continue

            stack = [(col, row)]
            cells: list[tuple[int, int]] = []
            seen[col][row] = True
            while stack:
                current_col, current_row = stack.pop()
                cells.append((current_col, current_row))
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

            if len(cells) < MIN_CLUSTER:
                continue

            win = pay_for(target, len(cells), multiplier)
            if win <= 0:
                continue

            clusters.append(
                ClusterWin(
                    symbol=target,
                    kind=len(cells),
                    win=win,
                    positions=[{"reel": c, "col": c, "row": r} for c, r in cells],
                    multiplier=multiplier,
                )
            )

    return clusters


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
