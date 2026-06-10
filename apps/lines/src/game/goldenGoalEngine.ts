/**
 * Golden Goal Rush — cluster-pays + Golden Goal Tiles engine (client preview / demo logic).
 *
 * Own football/WM take on the Le-Bandit principle (NOT a 1:1 clone):
 *   win cluster -> mark cells as Golden Goal Tiles -> Rainbow Goal activates them ->
 *   tiles reveal Bronze/Silver/Gold coins + Goal Booster + Trophy Collector -> payout.
 *
 * Pure, deterministic-by-rng, side-effect free. NOT final RTP math.
 */
import type { Position } from './types';

export const REELS = 6;
export const ROWS = 5;

export type Sym = string; // 'H1'..'H4' | 'L1'..'L5' | 'W' | 'S' | 'RAINBOW'
export const BASE_SYMBOLS: Sym[] = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'];
// weighted pool – lows more common, highs rarer
const POOL: Sym[] = [
	'L1', 'L1', 'L2', 'L2', 'L3', 'L3', 'L4', 'L4', 'L5', 'L5',
	'H1', 'H1', 'H2', 'H2', 'H3', 'H4', 'W',
];

type Rng = () => number;
const ri = (n: number, rng: Rng) => Math.floor(rng() * n);
const key = (c: number, r: number) => `${c}:${r}`;
const inB = (c: number, r: number) => c >= 0 && c < REELS && r >= 0 && r < ROWS;

export function randomSymbol(
	rng: Rng = Math.random,
	opts: { scatter?: number; rainbow?: number } = {},
): Sym {
	const r = rng();
	const sc = opts.scatter ?? 0;
	const rb = opts.rainbow ?? 0;
	if (r < sc) return 'S';
	if (r < sc + rb) return 'RAINBOW';
	return POOL[ri(POOL.length, rng)];
}

export function makeGrid(
	rng: Rng = Math.random,
	opts: { scatter?: number; rainbow?: number } = {},
): Sym[][] {
	return Array.from({ length: REELS }, () =>
		Array.from({ length: ROWS }, () => randomSymbol(rng, opts)),
	);
}

/** Connected (4-dir) clusters of >=5 same base symbol; Wild ('W') connects/extends. */
export function findClusters(grid: Sym[][]): { type: Sym; cells: Position[] }[] {
	const claimed = new Set<string>();
	const out: { type: Sym; cells: Position[] }[] = [];
	for (let c = 0; c < REELS; c++) {
		for (let r = 0; r < ROWS; r++) {
			const t = grid[c]?.[r];
			if (!BASE_SYMBOLS.includes(t) || claimed.has(key(c, r))) continue;
			const stack: [number, number][] = [[c, r]];
			const local = new Set<string>();
			const cells: Position[] = [];
			while (stack.length) {
				const [cc, rr] = stack.pop()!;
				const k = key(cc, rr);
				if (local.has(k)) continue;
				const tt = grid[cc]?.[rr];
				if (tt !== t && tt !== 'W') continue;
				local.add(k);
				cells.push({ reel: cc, row: rr });
				([[cc - 1, rr], [cc + 1, rr], [cc, rr - 1], [cc, rr + 1]] as [number, number][]).forEach(
					([nc, nr]) => {
						if (inB(nc, nr) && !local.has(key(nc, nr))) stack.push([nc, nr]);
					},
				);
			}
			if (cells.length >= 5) {
				cells.forEach((p) => claimed.add(key(p.reel, p.row)));
				out.push({ type: t, cells });
			}
		}
	}
	return out;
}

export function validateGrid(grid: Sym[][]): { valid: boolean; reason?: string; filled: number } {
	if (!Array.isArray(grid) || grid.length !== REELS)
		return { valid: false, reason: `cols=${grid?.length}`, filled: 0 };
	let filled = 0;
	for (let c = 0; c < REELS; c++) {
		if (grid[c]?.length !== ROWS) return { valid: false, reason: `reel ${c} rows=${grid[c]?.length}`, filled };
		for (let r = 0; r < ROWS; r++) {
			const s = grid[c][r];
			if (s === undefined || s === null || s === '')
				return { valid: false, reason: `empty ${c}:${r}`, filled };
			filled++;
		}
	}
	return { valid: filled === REELS * ROWS, filled };
}

// ---- coins / reveals ----
export const COIN_TIERS: Record<'bronze' | 'silver' | 'gold', number[]> = {
	bronze: [0.2, 0.5, 1, 2, 3, 4],
	silver: [5, 10, 15, 20],
	gold: [25, 50, 100, 250, 500],
};
/** value -> registered coin asset key (0.2 -> coin_0_2x, 25 -> coin_25x). */
export function coinKey(v: number): string {
	if (v < 1) return `coin_0_${Math.round(v * 10)}x`;
	return `coin_${v}x`;
}
export const BOOSTER_MULTS = [2, 3, 4, 5, 10];

export type Reveal =
	| { kind: 'coin'; tier: 'bronze' | 'silver' | 'gold'; value: number }
	| { kind: 'booster'; mult: number }
	| { kind: 'collector' };

export function rollReveal(
	rng: Rng = Math.random,
	opts: { goldBoost?: boolean; noBronze?: boolean } = {},
): Reveal {
	const r = rng();
	if (r < 0.1) return { kind: 'collector' };
	if (r < 0.22) return { kind: 'booster', mult: BOOSTER_MULTS[ri(BOOSTER_MULTS.length, rng)] };
	const cr = rng();
	let tier: 'bronze' | 'silver' | 'gold';
	if (opts.noBronze) tier = cr < 0.7 ? 'silver' : 'gold';
	else tier = cr < 0.6 ? 'bronze' : cr < 0.9 ? 'silver' : 'gold';
	if (opts.goldBoost && cr > 0.75) tier = 'gold';
	const vals = COIN_TIERS[tier];
	return { kind: 'coin', tier, value: vals[ri(vals.length, rng)] };
}

export const adjacent = ({ reel, row }: Position): Position[] =>
	([[reel - 1, row], [reel + 1, row], [reel, row - 1], [reel, row + 1]] as [number, number][])
		.filter(([c, r]) => inB(c, r))
		.map(([c, r]) => ({ reel: c, row: r }));
