/**
 * Generates Golden Goal Rush 6x5 cluster/cascade sample books for the
 * Storybook stories, using the REAL game math from
 * stake-upload/golden-goal-rush/math/math.js as the single source of truth.
 *
 * Output format mirrors apps/cluster/src/game/typesBookEvent.ts.
 *
 * Run: node apps/cluster/scripts/generate-ggr-books.mjs
 *
 * Notes:
 * - Amounts are book units: 1.00x bet == 100.
 * - Golden-square / coin / collector / rainbow feature wins from math.js are
 *   accounted for in the win meters (updateTumbleWin/setWin/totals) but are
 *   not yet presented with their own animation events — see
 *   documentation/sponsor-bonus-design.md for the planned event contract.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPaidSpin, COLS, ROWS } from '../../../stake-upload/golden-goal-rush/math/math.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'stories', 'data');

const SYMBOL_MAP = {
	10: 'L5',
	j: 'L4',
	q: 'L3',
	k: 'L2',
	a: 'L1',
	fussball: 'H1',
	pokal: 'H2',
	pfeife: 'H3',
	trikot: 'H4',
	wild: 'W',
	scatter: 'S',
	rainbow: 'RB',
	collector: 'CL',
};
const PAD_POOL = ['L1', 'L2', 'L3', 'L4', 'L5', 'H1', 'H2', 'H3', 'H4'];
const M = 100; // book units per 1x bet

const mapName = (id) => SYMBOL_MAP[id] ?? 'L5';
const randomPad = () => ({ name: PAD_POOL[Math.floor(Math.random() * PAD_POOL.length)] });
const round2 = (value) => Math.round(value * 100) / 100;
const toUnits = (multiple) => Math.round(multiple * M);

// grid[col][row] (row 0 = top) -> board[reel] with 1 padding symbol top+bottom
const boardFromGrid = (grid) =>
	grid.map((column) => [randomPad(), ...column.map((id) => ({ name: mapName(id) })), randomPad()]);

const mapPosition = ({ col, row }) => ({ reel: col, row: row + 1 });

const scatterPositions = (grid) => {
	const positions = [];
	grid.forEach((column, col) =>
		column.forEach((id, row) => {
			if (id === 'scatter') positions.push(mapPosition({ col, row }));
		}),
	);
	return positions;
};

const winLevelFor = (multiple) => {
	if (multiple <= 0) return 1;
	if (multiple < 1) return 2;
	if (multiple < 2) return 3;
	if (multiple < 5) return 4;
	if (multiple < 20) return 5;
	if (multiple < 50) return 6;
	if (multiple < 100) return 7;
	if (multiple < 250) return 8;
	if (multiple < 1000) return 9;
	return 10;
};

/**
 * Convert one math.js cascading-spin result into book events.
 * Returns the spin's own total win (bet multiples).
 */
const pushSpinEvents = (events, spin, gameType) => {
	const steps = spin.events;
	const startGrid = steps[0].grid;
	events.push({
		type: 'reveal',
		board: boardFromGrid(startGrid),
		paddingPositions: Array.from({ length: COLS }, () => Math.floor(Math.random() * 200)),
		gameType,
		anticipation: Array.from({ length: COLS }, () => 0),
	});

	let cumulative = 0;
	for (let i = 0; i < steps.length; i += 1) {
		const step = steps[i];
		if (step.type === 'clusters') {
			cumulative = round2(cumulative + step.amount);
			events.push({
				type: 'winInfo',
				totalWin: toUnits(step.amount),
				wins: step.wins.map((win) => ({
					symbol: mapName(win.symbol),
					clusterSize: win.count,
					win: toUnits(win.amount),
					positions: win.positions.map(mapPosition),
					meta: {
						globalMult: 1,
						clusterMult: 1,
						winWithoutMult: round2(win.amount),
						overlay: mapPosition(win.positions[Math.floor(win.positions.length / 2)]),
					},
				})),
			});
			events.push({ type: 'updateTumbleWin', amount: toUnits(cumulative) });
		}
		if (step.type === 'cascade') {
			// step.dropping = [{col,row}] of NEW cells; new symbols are the top
			// rows of the post-cascade grid, top-first per column.
			const addCountByCol = Array.from({ length: COLS }, () => 0);
			for (const drop of step.dropping) addCountByCol[drop.col] += 1;
			const previousClusters = steps[i - 1];
			events.push({
				type: 'tumbleBoard',
				explodingSymbols: (previousClusters?.positions ?? []).map(mapPosition),
				newSymbols: step.grid.map((column, col) =>
					column.slice(0, addCountByCol[col]).map((id) => ({ name: mapName(id) })),
				),
			});
		}
	}

	// Feature wins (golden squares / coins / collector / rainbow) that math.js
	// added beyond cluster pays: account for them in the win meter.
	const featureWin = round2(spin.totalWin - cumulative);
	if (featureWin > 0.001) {
		cumulative = round2(cumulative + featureWin);
		events.push({ type: 'updateTumbleWin', amount: toUnits(cumulative) });
	}

	return round2(spin.totalWin);
};

const buildBook = (id, result) => {
	const events = [];
	const baseWin = round2(result.totalWin - (result.bonus?.totalWin ?? 0));

	// math.js result.events = cascading spin steps (+ trailing bonus event)
	const baseSpin = { events: result.events.filter((e) => e.type !== 'bonus'), totalWin: baseWin };
	pushSpinEvents(events, baseSpin, 'basegame');

	if (baseWin > 0) {
		events.push({ type: 'setWin', amount: toUnits(baseWin), winLevel: winLevelFor(baseWin) });
	}
	events.push({ type: 'setTotalWin', amount: toUnits(baseWin) });

	if (result.bonus) {
		const bonus = result.bonus;
		const initialFs = result.bonusLevel === 1 ? 8 : 12;
		const startGrid = baseSpin.events[0].grid;
		events.push({ type: 'freeSpinTrigger', totalFs: initialFs, positions: scatterPositions(startGrid) });

		let runningTotal = baseWin;
		let plannedTotal = initialFs;
		bonus.events.forEach((fsEvent, fsIndex) => {
			const spin = fsEvent.spin;
			events.push({ type: 'updateFreeSpin', amount: fsIndex, total: plannedTotal });
			const spinWin = pushSpinEvents(events, spin, 'freegame');
			runningTotal = round2(runningTotal + spinWin);
			if (spinWin > 0) {
				events.push({ type: 'setWin', amount: toUnits(spinWin), winLevel: winLevelFor(spinWin) });
			}
			events.push({ type: 'setTotalWin', amount: toUnits(runningTotal) });

			// Retrigger: 3+/4/5+ scatters in a free spin add spins (math.js rule).
			const scatters = scatterPositions(spin.events[0].grid);
			if (scatters.length >= 3 && fsIndex < bonus.events.length - 1) {
				const extra = scatters.length >= 5 ? 8 : scatters.length === 4 ? 5 : 3;
				plannedTotal = Math.min(plannedTotal + extra, bonus.totalSpins);
				events.push({ type: 'freeSpinRetrigger', totalFs: plannedTotal, positions: scatters });
			}
		});

		events.push({
			type: 'freeSpinEnd',
			amount: toUnits(bonus.totalWin),
			winLevel: winLevelFor(bonus.totalWin),
		});
	}

	events.push({ type: 'finalWin', amount: toUnits(result.totalWin) });
	events.forEach((event, index) => (event.index = index));

	return { id, payoutMultiplier: round2(result.totalWin), events };
};

const generate = ({ count, options = {}, requireBonus = false, maxAttempts = 5000 }) => {
	const books = [];
	let attempts = 0;
	while (books.length < count && attempts < maxAttempts) {
		attempts += 1;
		const result = runPaidSpin(1, options);
		if (requireBonus && !result.bonus) continue;
		if (!requireBonus && result.bonus) continue; // keep base books bonus-free
		books.push(buildBook(books.length + 1, result));
	}
	return books;
};

const baseBooks = generate({ count: 30 });
const bonusBooks = generate({ count: 8, options: { forceScatters: 3 }, requireBonus: true });

const header =
	'// GENERATED by apps/cluster/scripts/generate-ggr-books.mjs from\n' +
	'// stake-upload/golden-goal-rush/math/math.js — do not edit by hand.\n';

writeFileSync(
	join(OUT_DIR, 'base_books.ts'),
	`${header}export default ${JSON.stringify(baseBooks, null, '\t')};\n`,
);
writeFileSync(
	join(OUT_DIR, 'bonus_books.ts'),
	`${header}export default ${JSON.stringify(bonusBooks, null, '\t')};\n`,
);

const stats = (books) => ({
	count: books.length,
	mean: round2(books.reduce((sum, book) => sum + book.payoutMultiplier, 0) / (books.length || 1)),
	max: Math.max(...books.map((book) => book.payoutMultiplier)),
});
console.log('base:', stats(baseBooks));
console.log('bonus:', stats(bonusBooks));
