/**
 * Le Bandit / "Bounty Collect" feature engine (client-side prototype).
 *
 * Mechanic (Le Bandit / Money-Cart style collect):
 *  - The feature grid holds MULTIPLIER cells (each worth Nx) and COLLECTOR cells.
 *  - Multiplier values persist on the grid.
 *  - Each Collector "collects" the sum of ALL multiplier values currently on the grid.
 *    Collectors are processed reel-by-reel, row-by-row; the collected amount accumulates
 *    into a running total. More collectors => the persistent multipliers are collected again.
 *  - Final win multiplier = accumulated total (0 if there is no collector on the grid).
 *
 * This is a deterministic, side-effect-free prototype used for the Storybook demo and as the
 * basis for the eventual book-event integration. It does NOT touch the base-game math/config.
 */
import type { Position } from './types';

export type FeatureCell =
	| { kind: 'blank' }
	| { kind: 'multiplier'; value: number }
	| { kind: 'collector' };

export type FeatureGrid = FeatureCell[][]; // indexed [reel][row]

export type CollectStep = {
	collector: Position;
	collected: { position: Position; value: number }[];
	stepWin: number; // multiplier collected during this step
	runningTotal: number; // cumulative multiplier after this step
};

export type FeatureResult = {
	grid: FeatureGrid;
	multipliers: { position: Position; value: number }[];
	collectors: Position[];
	steps: CollectStep[];
	totalMultiplier: number;
};

/** Coin art that ships in assets.ts (special/coin_*x). Keep generated values within this set. */
export const MULTIPLIER_VALUES = [2, 3, 5, 10, 15, 20, 25, 50, 100, 250, 500] as const;

/** Maps a multiplier value to its registered coin asset key (e.g. 25 -> "coin_25x"). */
export const coinAssetKey = (value: number): string => `coin_${value}x`;

const scanGrid = (grid: FeatureGrid) => {
	const multipliers: { position: Position; value: number }[] = [];
	const collectors: Position[] = [];
	grid.forEach((reelCells, reel) =>
		reelCells.forEach((cell, row) => {
			if (cell.kind === 'multiplier') multipliers.push({ position: { reel, row }, value: cell.value });
			else if (cell.kind === 'collector') collectors.push({ reel, row });
		}),
	);
	return { multipliers, collectors };
};

/** Evaluate a feature grid into an ordered collect sequence + final multiplier. */
export function evaluateCollect(grid: FeatureGrid): FeatureResult {
	const { multipliers, collectors } = scanGrid(grid);
	const sumMultipliers = multipliers.reduce((sum, entry) => sum + entry.value, 0);

	const steps: CollectStep[] = [];
	let runningTotal = 0;
	for (const collector of collectors) {
		runningTotal += sumMultipliers;
		steps.push({
			collector,
			collected: multipliers.map((entry) => ({ ...entry })),
			stepWin: sumMultipliers,
			runningTotal,
		});
	}

	return {
		grid,
		multipliers,
		collectors,
		steps,
		totalMultiplier: collectors.length > 0 ? runningTotal : 0,
	};
}

/** Resolve the win amount (in bet units) for a feature result. */
export const featureWin = ({ totalMultiplier, bet }: { totalMultiplier: number; bet: number }) =>
	totalMultiplier * bet;

type Rng = () => number;
const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

/**
 * Generate a random feature grid for demo/variety: scatters a handful of multiplier coins and
 * one or two collectors across an empty grid.
 */
export function generateFeatureGrid({
	reels = 5,
	rows = 4,
	multiplierCount = 6,
	collectorCount = 2,
	rng = Math.random,
}: {
	reels?: number;
	rows?: number;
	multiplierCount?: number;
	collectorCount?: number;
	rng?: Rng;
} = {}): FeatureGrid {
	const grid: FeatureGrid = Array.from({ length: reels }, () =>
		Array.from({ length: rows }, () => ({ kind: 'blank' }) as FeatureCell),
	);

	const freeCells = (): Position[] => {
		const cells: Position[] = [];
		grid.forEach((reelCells, reel) =>
			reelCells.forEach((cell, row) => {
				if (cell.kind === 'blank') cells.push({ reel, row });
			}),
		);
		return cells;
	};

	for (let i = 0; i < multiplierCount; i++) {
		const free = freeCells();
		if (!free.length) break;
		const { reel, row } = pick(free, rng);
		grid[reel][row] = { kind: 'multiplier', value: pick(MULTIPLIER_VALUES, rng) };
	}
	for (let i = 0; i < collectorCount; i++) {
		const free = freeCells();
		if (!free.length) break;
		const { reel, row } = pick(free, rng);
		grid[reel][row] = { kind: 'collector' };
	}

	return grid;
}
