from __future__ import annotations

from game_calculations import LineWin, calculate_line_wins, scatter_positions, win_level_for_amount
from game_config import DEFAULT_TOTAL_FREE_SPINS


KNOWN_EVENT_TYPES = {
    "reveal",
    "winInfo",
    "setWin",
    "setTotalWin",
    "freeSpinTrigger",
    "updateFreeSpin",
    "freeSpinEnd",
    "finalWin",
}


def reveal_event(index: int, board: list[list[dict[str, str]]], game_type: str, padding_positions: list[int]) -> dict:
    return {
        "index": index,
        "type": "reveal",
        "board": board,
        "paddingPositions": padding_positions,
        "gameType": game_type,
        "anticipation": [0, 0, 0, 0, 0],
    }


def win_info_event(index: int, wins: list[LineWin]) -> dict:
    return {
        "index": index,
        "type": "winInfo",
        "totalWin": sum(win.win for win in wins),
        "wins": [
            {
                "symbol": win.symbol,
                "kind": win.kind,
                "win": win.win,
                "positions": win.positions,
                "meta": {
                    "lineIndex": win.line_index,
                    "multiplier": win.multiplier,
                    "winWithoutMult": win.win,
                    "globalMult": 1,
                    "lineMultiplier": 1.0,
                },
            }
            for win in wins
        ],
    }


def append_win_sequence(events: list[dict], amount: int) -> None:
    if amount <= 0:
        return
    events.append({"index": len(events), "type": "setWin", "amount": amount, "winLevel": win_level_for_amount(amount)})
    events.append({"index": len(events), "type": "setTotalWin", "amount": amount})


def base_spin_events(
    board: list[list[dict[str, str]]],
    padding_positions: list[int],
    total_free_spins: int = DEFAULT_TOTAL_FREE_SPINS,
) -> list[dict]:
    events = [reveal_event(0, board, "basegame", padding_positions)]
    wins = calculate_line_wins(board)
    amount = sum(win.win for win in wins)
    if wins:
        events.append(win_info_event(len(events), wins))
        append_win_sequence(events, amount)

    scatters = scatter_positions(board)
    if len(scatters) >= 3:
        events.append(
            {
                "index": len(events),
                "type": "freeSpinTrigger",
                "totalFs": total_free_spins,
                "positions": scatters,
            }
        )

    events.append({"index": len(events), "type": "finalWin", "amount": amount})
    return events


def free_spin_events(
    board: list[list[dict[str, str]]],
    padding_positions: list[int],
    free_spin_index: int,
    total_free_spins: int,
    accumulated_before: int,
    include_end: bool = False,
) -> tuple[list[dict], int]:
    events = [
        {"index": 0, "type": "updateFreeSpin", "amount": free_spin_index, "total": total_free_spins},
        reveal_event(1, board, "freegame", padding_positions),
    ]
    wins = calculate_line_wins(board)
    spin_win = sum(win.win for win in wins)
    total_win = accumulated_before + spin_win
    if wins:
        events.append(win_info_event(len(events), wins))
        append_win_sequence(events, spin_win)
    if include_end:
        events.append(
            {
                "index": len(events),
                "type": "freeSpinEnd",
                "amount": total_win,
                "winLevel": win_level_for_amount(total_win),
            }
        )
    events.append({"index": len(events), "type": "finalWin", "amount": total_win})
    return events, total_win
