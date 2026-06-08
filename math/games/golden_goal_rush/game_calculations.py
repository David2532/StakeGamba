from __future__ import annotations

from dataclasses import dataclass

from game_config import PAYLINES, PAYTABLE, SCATTER_SYMBOL, WILD_SYMBOL


@dataclass(frozen=True)
class LineWin:
    symbol: str
    kind: int
    win: int
    positions: list[dict[str, int]]
    line_index: int
    multiplier: int = 1


def visible_symbols(board: list[list[dict[str, str]]]) -> list[list[str]]:
    """Return each reel's 3 visible symbols from the 5-row padded frontend board."""
    return [[cell["name"] for cell in reel[1:4]] for reel in board]


def scatter_positions(board: list[list[dict[str, str]]]) -> list[dict[str, int]]:
    positions: list[dict[str, int]] = []
    for reel_index, reel in enumerate(board):
        for visible_row, cell in enumerate(reel[1:4], start=1):
            if cell["name"] == SCATTER_SYMBOL:
                positions.append({"reel": reel_index, "row": visible_row})
    return positions


def _line_symbol(line_symbols: list[str]) -> str | None:
    for symbol in line_symbols:
        if symbol not in (WILD_SYMBOL, SCATTER_SYMBOL):
            return symbol
    if all(symbol == WILD_SYMBOL for symbol in line_symbols):
        return WILD_SYMBOL
    return None


def calculate_line_wins(board: list[list[dict[str, str]]], bet_per_line: int = 1) -> list[LineWin]:
    visible = visible_symbols(board)
    wins: list[LineWin] = []

    for line_index, rows in PAYLINES.items():
        line_symbols = [visible[reel_index][row_index] for reel_index, row_index in enumerate(rows)]
        pay_symbol = _line_symbol(line_symbols)
        if pay_symbol is None:
            continue

        count = 0
        positions: list[dict[str, int]] = []
        for reel_index, row_index in enumerate(rows):
            symbol = line_symbols[reel_index]
            if symbol in (pay_symbol, WILD_SYMBOL):
                count += 1
                positions.append({"reel": reel_index, "row": row_index + 1})
                continue
            break

        pay = PAYTABLE.get(pay_symbol, {}).get(count)
        if pay is None:
            continue

        wins.append(
            LineWin(
                symbol=pay_symbol,
                kind=count,
                win=int(round(pay * bet_per_line * 100)),
                positions=positions,
                line_index=line_index,
            )
        )

    return wins


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
