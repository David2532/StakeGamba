from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class GameState:
    mode: str = "basegame"
    total_free_spins: int = 0
    current_free_spin: int = 0
    accumulated_win: int = 0
    history: list[dict] = field(default_factory=list)

    def start_free_spins(self, total: int) -> None:
        self.mode = "freegame"
        self.total_free_spins = total
        self.current_free_spin = 0
        self.accumulated_win = 0

    def advance_free_spin(self) -> None:
        self.current_free_spin += 1

    def end_free_spins(self) -> None:
        self.mode = "basegame"
        self.total_free_spins = 0
        self.current_free_spin = 0
