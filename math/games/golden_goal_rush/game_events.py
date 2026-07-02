from __future__ import annotations

from game_calculations import ClusterWin, win_level_for_amount


KNOWN_EVENT_TYPES = {
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
}


def reindex(events: list[dict]) -> list[dict]:
    for index, event in enumerate(events):
        event["index"] = index
    return events


def reveal_event(index: int, board: list[list[dict[str, str]]], game_type: str) -> dict:
    cols = len(board)
    return {
        "index": index,
        "type": "reveal",
        "board": board,
        "paddingPositions": [0 for _ in range(cols)],
        "gameType": game_type,
        "anticipation": [0 for _ in range(cols)],
    }


def win_info_event(index: int, wins: list[ClusterWin], total_win: int) -> dict:
    step_win = sum(win.win for win in wins)
    return {
        "index": index,
        "type": "winInfo",
        "totalWin": step_win,
        "runningTotalWin": total_win,
        "wins": [
            {
                "symbol": win.symbol,
                "kind": win.kind,
                "win": win.win,
                "positions": win.positions,
                "meta": {
                    "clusterSize": win.kind,
                    "multiplier": win.multiplier,
                    "winWithoutMult": win.win,
                    "globalMult": win.multiplier,
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


def tumble_event(
    index: int,
    exploding_symbols: list[dict[str, int]],
    new_symbols: list[list[dict[str, str]]],
    board: list[list[dict[str, str]]],
) -> dict:
    return {
        "index": index,
        "type": "tumbleBoard",
        "explodingSymbols": exploding_symbols,
        "newSymbols": new_symbols,
        "board": board,
    }


def free_spin_trigger_event(index: int, total_free_spins: int, positions: list[dict[str, int]], tier: int = 1) -> dict:
    names = {1: "Golden Chance", 2: "All That Glitters", 3: "End of the Rainbow"}
    return {
        "index": index,
        "type": "freeSpinTrigger",
        "totalFs": total_free_spins,
        "positions": positions,
        "tier": tier,
        "title": names.get(tier, "Golden Chance"),
    }


def update_free_spin_event(index: int, amount: int, total: int, tier: int) -> dict:
    return {"index": index, "type": "updateFreeSpin", "amount": amount, "total": total, "tier": tier}


def free_spin_end_event(index: int, amount: int) -> dict:
    return {"index": index, "type": "freeSpinEnd", "amount": amount, "winLevel": win_level_for_amount(amount)}


def golden_reveal_event(index: int, rewards: list[dict], cycle: int) -> dict:
    return {"index": index, "type": "goldenReveal", "cycle": cycle, "rewards": rewards}


def golden_award_event(
    index: int,
    amount: int,
    total_win: int,
    cycle: int,
    collector_positions: list[dict[str, int]] | None = None,
) -> dict:
    return {
        "index": index,
        "type": "goldenAward",
        "cycle": cycle,
        "amount": amount,
        "totalWin": total_win,
        "collectorPositions": collector_positions or [],
        "winLevel": win_level_for_amount(total_win),
    }


def golden_clear_event(index: int, clear_golden: bool = False) -> dict:
    return {"index": index, "type": "goldenClear", "clearGolden": clear_golden}


def final_win_event(index: int, amount: int) -> dict:
    return {"index": index, "type": "finalWin", "amount": amount}
