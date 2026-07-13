from __future__ import annotations

import sys
import unittest
from pathlib import Path


GAME_DIR = Path(__file__).resolve().parents[1]
if str(GAME_DIR) not in sys.path:
    sys.path.insert(0, str(GAME_DIR))

from game_config import NORMAL_SYMBOLS
from game_calculations import _find_clusters_for_targets, board_symbols, find_clusters


COLS = 6
ROWS = 5


def board(fill: str = "scatter") -> list[list[str]]:
    return [[fill for _ in range(ROWS)] for _ in range(COLS)]


def serialized(clusters) -> list[tuple[str, int, int, tuple[tuple[int, int], ...]]]:
    return [
        (
            cluster.symbol,
            cluster.kind,
            cluster.win,
            tuple((position["col"], position["row"]) for position in cluster.positions),
        )
        for cluster in clusters
    ]


class WildClusterRegressionTests(unittest.TestCase):
    def test_wild_substitutes_for_paying_symbol(self) -> None:
        grid = board()
        for col, row, symbol in [
            (0, 0, "q"),
            (1, 0, "q"),
            (1, 1, "wild"),
            (2, 1, "q"),
            (3, 1, "q"),
        ]:
            grid[col][row] = symbol

        clusters = find_clusters(grid)
        q_cluster = next(cluster for cluster in clusters if cluster.symbol == "q")

        self.assertEqual(q_cluster.kind, 5)
        self.assertEqual(q_cluster.win, 36)
        self.assertEqual(
            {(position["col"], position["row"]) for position in q_cluster.positions},
            {(0, 0), (1, 0), (1, 1), (2, 1), (3, 1)},
        )

    def test_wild_only_component_never_pays(self) -> None:
        grid = board()
        for col, row in [(0, 0), (1, 0), (1, 1), (2, 1), (3, 1)]:
            grid[col][row] = "wild"

        self.assertEqual(find_clusters(grid), [])

    def test_losing_component_cannot_consume_wild_before_later_paying_cluster(self) -> None:
        grid = board()
        grid[0][0] = "ten"
        grid[0][1] = "wild"
        for col, row in [(1, 1), (1, 2), (2, 1), (2, 2)]:
            grid[col][row] = "q"

        clusters = find_clusters(grid)
        q_cluster = next(cluster for cluster in clusters if cluster.symbol == "q")

        self.assertEqual(q_cluster.kind, 5)
        self.assertIn((0, 1), {(position["col"], position["row"]) for position in q_cluster.positions})

    def test_six_j_plus_connecting_wild_pays_as_seven_symbol_cluster(self) -> None:
        grid = board()
        grid[0][0] = "wild"
        for col, row in [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (5, 1)]:
            grid[col][row] = "j"

        clusters = find_clusters(grid)
        j_cluster = next(cluster for cluster in clusters if cluster.symbol == "j")

        self.assertEqual(j_cluster.kind, 7)
        self.assertEqual(j_cluster.win, 56)
        self.assertEqual(len(j_cluster.positions), 7)

    def test_cluster_positions_are_deduplicated_even_when_wild_is_shared(self) -> None:
        grid = board()
        grid[1][1] = "wild"
        for col, row in [(0, 1), (0, 2), (1, 2), (2, 1)]:
            grid[col][row] = "ten"
        for col, row in [(1, 0), (2, 0), (2, 1), (3, 1)]:
            grid[col][row] = "q"

        clusters = find_clusters(grid)

        for cluster in clusters:
            coordinates = [(position["col"], position["row"]) for position in cluster.positions]
            self.assertEqual(len(coordinates), len(set(coordinates)), cluster)

    def test_result_serialization_is_independent_of_target_order(self) -> None:
        grid = board()
        grid[0][1] = "wild"
        for col, row in [(0, 0), (1, 0), (1, 1), (2, 1)]:
            grid[col][row] = "ten"
        for col, row in [(1, 2), (2, 2), (2, 3), (3, 2)]:
            grid[col][row] = "q"

        symbols = board_symbols(grid)
        natural = _find_clusters_for_targets(symbols, list(NORMAL_SYMBOLS), 1)
        reversed_targets = _find_clusters_for_targets(symbols, list(reversed(NORMAL_SYMBOLS)), 1)
        duplicated_targets = _find_clusters_for_targets(symbols, ["q", "ten", "q", "ten"], 1)

        self.assertEqual(serialized(natural), serialized(reversed_targets))
        self.assertEqual(serialized(natural), serialized(duplicated_targets))


if __name__ == "__main__":
    unittest.main()
