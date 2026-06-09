export const BET = 1;

export const LOW_SYMBOLS = ["10", "j", "q", "k", "a"];
export const HIGH_SYMBOLS = ["fussball", "pfeife", "pokal", "trikot"];
export const NORMAL_SYMBOLS = [...LOW_SYMBOLS, ...HIGH_SYMBOLS];
export const SPECIAL_SYMBOLS = ["wild", "scatter", "rainbow", "collector"];
export const COLS = 6;
export const ROWS = 5;

export const BASE_SYMBOL_WEIGHTS = {
	"10": 18,
	j: 17,
	q: 15,
	k: 13,
	a: 11,
	fussball: 8,
	pfeife: 7,
	pokal: 6,
	trikot: 5,
	wild: 1.2,
	scatter: 0.55,
	rainbow: 0.18,
};

export const FS_SYMBOL_WEIGHTS_BONUS_1 = {
	"10": 16,
	j: 15,
	q: 14,
	k: 12,
	a: 10,
	fussball: 8,
	pfeife: 7,
	pokal: 6,
	trikot: 5,
	wild: 1.5,
	scatter: 0.35,
	rainbow: 0.45,
};

export const FS_SYMBOL_WEIGHTS_BONUS_2 = {
	"10": 15,
	j: 14,
	q: 13,
	k: 11,
	a: 9,
	fussball: 8,
	pfeife: 7,
	pokal: 6,
	trikot: 5,
	wild: 1.7,
	scatter: 0.3,
	rainbow: 0.7,
};

export const FS_SYMBOL_WEIGHTS_BONUS_3 = {
	"10": 14,
	j: 13,
	q: 12,
	k: 10,
	a: 8,
	fussball: 8,
	pfeife: 7,
	pokal: 6,
	trikot: 5,
	wild: 1.8,
	scatter: 0.25,
	rainbow: 0,
};

export const PAYTABLE = {
	"10": { 5: 0.1, 7: 0.2, 9: 0.4, 11: 0.8, 13: 1.5, 16: 3 },
	j: { 5: 0.1, 7: 0.25, 9: 0.5, 11: 1, 13: 2, 16: 4 },
	q: { 5: 0.15, 7: 0.3, 9: 0.7, 11: 1.4, 13: 2.8, 16: 5 },
	k: { 5: 0.2, 7: 0.4, 9: 1, 11: 2, 13: 4, 16: 7.5 },
	a: { 5: 0.25, 7: 0.6, 9: 1.5, 11: 3, 13: 6, 16: 10 },
	fussball: { 5: 0.4, 7: 1, 9: 2.5, 11: 5, 13: 10, 16: 20 },
	pfeife: { 5: 0.5, 7: 1.25, 9: 3, 11: 6, 13: 12, 16: 25 },
	pokal: { 5: 0.75, 7: 2, 9: 5, 11: 10, 13: 20, 16: 40 },
	trikot: { 5: 1, 7: 3, 9: 8, 11: 15, 13: 35, 16: 75 },
};

export const GOLDEN_SQUARE_REWARDS_BASE = {
	bronzeCoin: 73,
	silverCoin: 18,
	goldCoin: 3.5,
	multiplier: 3,
	collector: 1.5,
	blank: 1,
};

export const GOLDEN_SQUARE_REWARDS_BONUS_1 = {
	bronzeCoin: 68,
	silverCoin: 20,
	goldCoin: 4.5,
	multiplier: 4,
	collector: 2.5,
	blank: 1,
};

export const GOLDEN_SQUARE_REWARDS_BONUS_2 = {
	bronzeCoin: 60,
	silverCoin: 25,
	goldCoin: 6,
	multiplier: 5,
	collector: 3.5,
	blank: 0.5,
};

export const GOLDEN_SQUARE_REWARDS_BONUS_3 = {
	bronzeCoin: 0,
	silverCoin: 67,
	goldCoin: 15,
	multiplier: 9,
	collector: 8,
	blank: 1,
};

export const BRONZE_COIN_VALUES = [
	{ value: 0.2, weight: 34 },
	{ value: 0.5, weight: 28 },
	{ value: 1, weight: 20 },
	{ value: 2, weight: 11 },
	{ value: 4, weight: 7 },
];

export const SILVER_COIN_VALUES = [
	{ value: 5, weight: 40 },
	{ value: 10, weight: 28 },
	{ value: 15, weight: 18 },
	{ value: 20, weight: 10 },
	{ value: 25, weight: 4 },
];

export const GOLD_COIN_VALUES = [
	{ value: 50, weight: 45 },
	{ value: 100, weight: 28 },
	{ value: 250, weight: 8 },
	{ value: 500, weight: 2 },
];

export const MULTIPLIER_VALUES = [
	{ value: 2, weight: 50 },
	{ value: 3, weight: 28 },
	{ value: 4, weight: 12 },
	{ value: 5, weight: 7 },
	{ value: 10, weight: 3 },
];

export const COLLECTOR_REACTIVATION_CHANCE = {
	base: 0.1,
	bonus1: 0.18,
	bonus2: 0.25,
	bonus3: 0.35,
};

export const MATH_CONFIG = {
	grid: { cols: COLS, rows: ROWS },
	paytable: PAYTABLE,
	baseSymbolWeights: BASE_SYMBOL_WEIGHTS,
	freeSpinSymbolWeights: {
		bonus1: FS_SYMBOL_WEIGHTS_BONUS_1,
		bonus2: FS_SYMBOL_WEIGHTS_BONUS_2,
		bonus3: FS_SYMBOL_WEIGHTS_BONUS_3,
	},
	goldenSquareRewards: {
		base: GOLDEN_SQUARE_REWARDS_BASE,
		bonus1: GOLDEN_SQUARE_REWARDS_BONUS_1,
		bonus2: GOLDEN_SQUARE_REWARDS_BONUS_2,
		bonus3: GOLDEN_SQUARE_REWARDS_BONUS_3,
	},
	coinValues: {
		bronze: BRONZE_COIN_VALUES,
		silver: SILVER_COIN_VALUES,
		gold: GOLD_COIN_VALUES,
	},
	multiplierValues: MULTIPLIER_VALUES,
	collectorReactivationChance: COLLECTOR_REACTIVATION_CHANCE,
	maxWinMultiplier: 10000,
	tuning: {
		baseScatterWeight: 1.55,
		baseRainbowWeight: 0.096,
		baseClusterBias: 0.09,
		freeSpinClusterBias: 0.095,
	},
};

export const SYMBOLS = Object.entries(BASE_SYMBOL_WEIGHTS).map(([id, weight]) => ({
	id,
	weight,
	type: NORMAL_SYMBOLS.includes(id) ? "regular" : id,
}));

export const COINS = [...BRONZE_COIN_VALUES, ...SILVER_COIN_VALUES, ...GOLD_COIN_VALUES].map((coin) => ({
	id: coinId(coin.value),
	value: coin.value,
	tier: coin.value < 5 ? "bronze" : coin.value < 50 ? "silver" : "gold",
}));

export const MULTIPLIERS = MULTIPLIER_VALUES.map((multiplier) => ({
	id: multiplierId(multiplier.value),
	type: "multiplier",
	value: multiplier.value,
	weight: multiplier.weight,
}));

const CLUSTER_STEPS = [16, 13, 11, 9, 7, 5];
const MAX_CASCADES = 30;
const MAX_TOTAL_FREE_SPINS = 30;
const BASE_REACTIVATION_LIMIT = 3;
const BONUS_REACTIVATION_LIMIT = 5;

function coinId(value) {
	return `coin_${String(value).replace(".", "_")}`;
}

function multiplierId(value) {
	return `multi_x${value}`;
}

function posKey(pos) {
	return `${pos.col}:${pos.row}`;
}

function fromKey(value) {
	const [col, row] = value.split(":").map(Number);
	return { col, row };
}

function cloneGrid(grid) {
	return grid.map((reel) => [...reel]);
}

function weightedEntry(weights) {
	const entries = Array.isArray(weights) ? weights : Object.entries(weights).map(([id, weight]) => ({ id, weight }));
	const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
	let roll = Math.random() * total;
	for (const entry of entries) {
		roll -= Math.max(0, entry.weight);
		if (roll <= 0) return entry.id ?? entry.value ?? entry;
	}
	return entries[0].id ?? entries[0].value ?? entries[0];
}

function modeKey(mode = "base") {
	if (mode === "bonus1" || mode === 1) return "bonus1";
	if (mode === "bonus2" || mode === 2) return "bonus2";
	if (mode === "bonus3" || mode === 3) return "bonus3";
	return "base";
}

function weightsForMode(mode = "base", options = {}) {
	const key = modeKey(mode);
	const weights =
		key === "base" ? { ...BASE_SYMBOL_WEIGHTS } : { ...MATH_CONFIG.freeSpinSymbolWeights[key] };
	if (key === "base") weights.scatter = MATH_CONFIG.tuning.baseScatterWeight;
	if (key === "base") weights.rainbow = MATH_CONFIG.tuning.baseRainbowWeight;
	if (options.bonusHunt) {
		weights.scatter *= 5;
	}
	if (options.ante) {
		weights.scatter *= 3;
	}
	return weights;
}

export function generateGrid(mode = "base", options = {}) {
	const weights = weightsForMode(mode, options);
	const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null));
	let rainbowPlaced = false;
	const bias = modeKey(mode) === "base" ? MATH_CONFIG.tuning.baseClusterBias : MATH_CONFIG.tuning.freeSpinClusterBias;

	for (let col = 0; col < COLS; col += 1) {
		let scatterPlacedInColumn = false;
		for (let row = 0; row < ROWS; row += 1) {
			const localWeights = { ...weights };
			if (scatterPlacedInColumn) localWeights.scatter = 0;
			if (rainbowPlaced || modeKey(mode) === "bonus3") localWeights.rainbow = 0;
			let symbol = weightedEntry(localWeights);
			const stickyCandidates = [
				col > 0 ? grid[col - 1][row] : null,
				row > 0 ? grid[col][row - 1] : null,
			].filter((candidate) => NORMAL_SYMBOLS.includes(candidate));
			if (stickyCandidates.length && Math.random() < bias) {
				symbol = stickyCandidates[Math.floor(Math.random() * stickyCandidates.length)];
			}
			if (symbol === "scatter") scatterPlacedInColumn = true;
			if (symbol === "rainbow") rainbowPlaced = true;
			grid[col][row] = symbol;
		}
	}

	if (options.forceRainbow || modeKey(mode) === "bonus3") {
		placeOneSymbol(grid, "rainbow", { replaceSpecial: true });
	}

	if (options.forceCluster) {
		forceSmallCluster(grid);
	}

	if (options.forceScatters) {
		placeScatters(grid, options.forceScatters);
	}

	return grid;
}

function placeOneSymbol(grid, symbol, { replaceSpecial = false } = {}) {
	const candidates = [];
	for (let col = 0; col < COLS; col += 1) {
		for (let row = 0; row < ROWS; row += 1) {
			if (replaceSpecial || NORMAL_SYMBOLS.includes(grid[col][row])) candidates.push({ col, row });
		}
	}
	const pos = candidates[Math.floor(Math.random() * candidates.length)] ?? { col: 0, row: 0 };
	for (let col = 0; col < COLS; col += 1) {
		for (let row = 0; row < ROWS; row += 1) {
			if (grid[col][row] === symbol) grid[col][row] = weightedEntry(BASE_SYMBOL_WEIGHTS);
		}
	}
	grid[pos.col][pos.row] = symbol;
}

function forceSmallCluster(grid) {
	const symbol = LOW_SYMBOLS[Math.floor(Math.random() * LOW_SYMBOLS.length)];
	const col = Math.floor(Math.random() * (COLS - 2));
	const row = Math.floor(Math.random() * (ROWS - 1));
	grid[col][row] = symbol;
	grid[col + 1][row] = symbol;
	grid[col + 2][row] = symbol;
	grid[col][row + 1] = symbol;
	grid[col + 1][row + 1] = symbol;
}

function placeScatters(grid, count) {
	const target = Math.max(0, Math.min(COLS, count));
	const columns = Array.from({ length: COLS }, (_, col) => col).sort(() => Math.random() - 0.5);
	for (let i = 0; i < target; i += 1) {
		const col = columns[i];
		const row = Math.floor(Math.random() * ROWS);
		grid[col][row] = "scatter";
	}
}

function isClusterSymbol(symbol) {
	return NORMAL_SYMBOLS.includes(symbol) || symbol === "wild";
}

function canJoin(symbol, target) {
	return symbol === target || symbol === "wild";
}

function orthogonalNeighbors(pos) {
	return [
		{ col: pos.col - 1, row: pos.row },
		{ col: pos.col + 1, row: pos.row },
		{ col: pos.col, row: pos.row - 1 },
		{ col: pos.col, row: pos.row + 1 },
	].filter((p) => p.col >= 0 && p.col < COLS && p.row >= 0 && p.row < ROWS);
}

function adjacentEight(pos) {
	const result = [];
	for (let dc = -1; dc <= 1; dc += 1) {
		for (let dr = -1; dr <= 1; dr += 1) {
			if (dc === 0 && dr === 0) continue;
			const col = pos.col + dc;
			const row = pos.row + dr;
			if (col >= 0 && col < COLS && row >= 0 && row < ROWS) result.push({ col, row });
		}
	}
	return result;
}

function findCluster(grid, start, target, blocked) {
	const stack = [start];
	const visited = new Set();
	const positions = [];
	while (stack.length) {
		const pos = stack.pop();
		const key = posKey(pos);
		if (visited.has(key) || blocked.has(key)) continue;
		if (!canJoin(grid[pos.col][pos.row], target)) continue;
		visited.add(key);
		positions.push(pos);
		stack.push(...orthogonalNeighbors(pos));
	}
	return positions;
}

function wildTargetFor(grid, pos) {
	const counts = new Map();
	for (const neighbor of orthogonalNeighbors(pos)) {
		const symbol = grid[neighbor.col][neighbor.row];
		if (!NORMAL_SYMBOLS.includes(symbol)) continue;
		counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "10";
}

export function findClusters(grid) {
	const blocked = new Set();
	const clusters = [];
	for (let col = 0; col < COLS; col += 1) {
		for (let row = 0; row < ROWS; row += 1) {
			const symbol = grid[col][row];
			if (!isClusterSymbol(symbol) || blocked.has(`${col}:${row}`)) continue;
			const target = symbol === "wild" ? wildTargetFor(grid, { col, row }) : symbol;
			const positions = findCluster(grid, { col, row }, target, blocked);
			if (positions.length < 5) continue;
			positions.forEach((pos) => blocked.add(posKey(pos)));
			clusters.push({ symbol: target, positions, count: positions.length });
		}
	}
	return clusters;
}

export function evaluateClusters(grid, bet = BET) {
	return findClusters(grid).map((cluster) => ({
		...cluster,
		amount: payoutForCluster(cluster.symbol, cluster.count, bet),
	}));
}

function payoutForCluster(symbol, count, bet) {
	const table = PAYTABLE[symbol];
	if (!table) return 0;
	const step = CLUSTER_STEPS.find((value) => count >= value) ?? 5;
	return table[step] * bet;
}

export function markGoldenSquares(_grid, winningCells, goldenSquares = new Set()) {
	for (const pos of winningCells) goldenSquares.add(posKey(pos));
	return goldenSquares;
}

export function cascadeGrid(grid, winningCells, mode = "base", options = {}) {
	const removeByColumn = Array.from({ length: COLS }, () => new Set());
	for (const pos of winningCells) removeByColumn[pos.col].add(pos.row);

	const next = cloneGrid(grid);
	const dropping = [];
	let rainbowAlreadyInDrop = grid.flat().includes("rainbow");
	let scatterByColumn = Array.from({ length: COLS }, (_, col) =>
		next[col].some((symbol, row) => !removeByColumn[col].has(row) && symbol === "scatter"),
	);

	for (let col = 0; col < COLS; col += 1) {
		const kept = [];
		for (let row = ROWS - 1; row >= 0; row -= 1) {
			if (!removeByColumn[col].has(row)) kept.unshift(next[col][row]);
		}
		const addCount = ROWS - kept.length;
		const incoming = [];
		for (let i = 0; i < addCount; i += 1) {
			const weights = weightsForMode(mode, options);
			if (scatterByColumn[col]) weights.scatter = 0;
			if (rainbowAlreadyInDrop || modeKey(mode) === "bonus3") weights.rainbow = 0;
			const symbol = weightedEntry(weights);
			if (symbol === "scatter") scatterByColumn[col] = true;
			if (symbol === "rainbow") rainbowAlreadyInDrop = true;
			incoming.push(symbol);
		}
		next[col] = [...incoming, ...kept];
		for (let row = 0; row < addCount; row += 1) dropping.push({ col, row });
	}

	if (options.forceRainbow && !hasRainbow(next)) {
		placeOneSymbol(next, "rainbow", { replaceSpecial: true });
	}

	return { grid: next, dropping };
}

export function hasRainbow(grid) {
	return grid.flat().includes("rainbow");
}

export function revealGoldenSquareReward(mode = "base") {
	const key = modeKey(mode);
	const reward = weightedEntry(MATH_CONFIG.goldenSquareRewards[key]);
	if (reward === "bronzeCoin") return rollCoinValue("bronze", { minValue: key === "bonus2" ? 1 : 0 });
	if (reward === "silverCoin") return rollCoinValue("silver");
	if (reward === "goldCoin") return rollCoinValue("gold");
	if (reward === "multiplier") {
		const value = weightedEntry(MULTIPLIER_VALUES);
		return { type: "multiplier", value, id: multiplierId(value) };
	}
	if (reward === "collector") return { type: "collector", value: 0, id: "collector" };
	return { type: "blank", value: 0, id: "blank" };
}

export function rollCoinValue(type, options = {}) {
	const values = MATH_CONFIG.coinValues[type].filter((entry) => entry.value >= (options.minValue ?? 0));
	const value = weightedEntry(values.length ? values : MATH_CONFIG.coinValues[type]);
	return { type: "coin", tier: type, value, id: coinId(value) };
}

function coinAssetIdForValue(value) {
	const values = COINS.map((coin) => coin.value).sort((a, b) => a - b);
	let selected = values[0];
	for (const candidate of values) {
		if (candidate <= value) selected = candidate;
	}
	return coinId(selected);
}

export function applyMultipliers(rewards) {
	const rewardMap = new Map(rewards.map((reward) => [posKey(reward.pos), reward]));
	const multiplierPositions = rewards.filter((reward) => reward.type === "multiplier");
	const changed = [];

	for (const reward of rewards) {
		if (reward.type !== "coin") continue;
		let multiplierSum = 0;
		for (const pos of adjacentEight(reward.pos)) {
			const adjacentReward = rewardMap.get(posKey(pos));
			if (adjacentReward?.type === "multiplier") multiplierSum += adjacentReward.value;
		}
		if (multiplierSum <= 0) continue;
		reward.baseValue = reward.value;
		reward.value = Math.min(500, reward.value * multiplierSum);
		reward.id = coinAssetIdForValue(reward.value);
		changed.push(reward.pos);
	}

	return { rewards, changed, multiplierPositions: multiplierPositions.map((reward) => reward.pos) };
}

export function resolveCollectors(rewards, bet = BET) {
	const coins = rewards.filter((reward) => reward.type === "coin");
	const collectors = rewards.filter((reward) => reward.type === "collector");
	const coinSum = coins.reduce((sum, coin) => sum + coin.value * bet, 0);
	return {
		coinWin: coinSum,
		collectorWin: coinSum * collectors.length,
		collectorPositions: collectors.map((collector) => collector.pos),
		coinPositions: coins.map((coin) => coin.pos),
		collectorCount: collectors.length,
	};
}

export function maybeReactivateCollector(mode = "base") {
	return Math.random() < MATH_CONFIG.collectorReactivationChance[modeKey(mode)];
}

export function activateGoldenSquares(grid, mode = "base", goldenSquares = new Set(), bet = BET, options = {}) {
	const events = [];
	const rewards = [];
	let totalWin = 0;
	let reactivations = 0;
	const limit = modeKey(mode) === "base" ? BASE_REACTIVATION_LIMIT : BONUS_REACTIVATION_LIMIT;
	let activeKeys = [...goldenSquares];

	while (activeKeys.length && reactivations <= limit) {
		const batch = activeKeys.map((value) => {
			const pos = fromKey(value);
			return { ...revealGoldenSquareReward(mode), pos };
		});
		const visibleRewards = batch.filter((reward) => reward.type !== "blank");
		const multiplierResult = applyMultipliers(visibleRewards);
		const collectorResult = resolveCollectors(multiplierResult.rewards, bet);
		const batchWin = collectorResult.coinWin + collectorResult.collectorWin;
		totalWin += batchWin;
		rewards.push(...visibleRewards);
		events.push({
			type: "goldenActivation",
			positions: activeKeys.map(fromKey),
			rewards: visibleRewards,
			amount: batchWin,
			multiplied: multiplierResult.changed,
			multiplierPositions: multiplierResult.multiplierPositions,
			collectorPositions: collectorResult.collectorPositions,
			coinPositions: collectorResult.coinPositions,
			reactivation: reactivations,
		});

		if (!collectorResult.collectorCount || !maybeReactivateCollector(mode) || totalWin >= options.maxRemaining) break;
		reactivations += 1;
		events.push({ type: "reactivation", positions: activeKeys.map(fromKey), reactivation: reactivations });
	}

	const nextGrid = cloneGrid(grid);
	for (const reward of rewards) {
		nextGrid[reward.pos.col][reward.pos.row] = reward.id;
	}

	return {
		grid: nextGrid,
		rewards,
		events,
		win: totalWin,
		reactivations,
	};
}

function scatterCount(grid) {
	return grid.flat().filter((symbol) => symbol === "scatter").length;
}

function bonusLevelFromScatters(count) {
	if (count >= 5) return 3;
	if (count === 4) return 2;
	if (count === 3) return 1;
	return 0;
}

function capWin(value, bet) {
	return Math.min(value, bet * MATH_CONFIG.maxWinMultiplier);
}

export function runPaidSpin(bet = BET, options = {}) {
	const mode = "base";
	const totalCost = bet * (options.ante ? 2 : options.rainbowBuy ? 50 : options.bonusHunt ? 3 : 1);
	let grid = generateGrid(mode, {
		ante: options.ante,
		bonusHunt: options.bonusHunt,
		forceRainbow: options.forceRainbow || options.rainbowBuy,
		forceCluster: options.rainbowBuy,
		forceScatters: options.forceScatters,
	});
	const result = runCascadingSpin(grid, bet, mode, { ...options, clearGoldAtEnd: true });
	const scatters = scatterCount(grid);
	const bonusLevel = bonusLevelFromScatters(scatters);
	let bonus = null;
	if (bonusLevel) {
		bonus = runFreeSpins(bet, bonusLevel, result.totalWin);
		result.totalWin = capWin(result.totalWin + bonus.totalWin, bet);
		result.events.push({ type: "bonus", level: bonusLevel, bonus });
	}
	return { ...result, bet, totalBet: totalCost, bonusLevel, bonus };
}

export function runFreeSpins(bet = BET, bonusLevel = 1, existingWin = 0) {
	const mode = `bonus${bonusLevel}`;
	let spinsLeft = bonusLevel === 1 ? 8 : 12;
	let totalSpins = 0;
	let totalWin = 0;
	let goldenSquares = new Set();
	const events = [];
	let rainbowTriggered = false;

	while (spinsLeft > 0 && totalSpins < MAX_TOTAL_FREE_SPINS && existingWin + totalWin < bet * MATH_CONFIG.maxWinMultiplier) {
		spinsLeft -= 1;
		totalSpins += 1;
		const forceRainbow = bonusLevel === 3;
		const spin = runCascadingSpin(generateGrid(mode, { forceRainbow }), bet, mode, {
			preservedGoldenSquares: goldenSquares,
			forceRainbow,
			maxStartingWin: existingWin + totalWin,
		});
		goldenSquares = spin.remainingGoldenSquares;
		totalWin = capWin(totalWin + spin.totalWin, bet);
		events.push({ type: "freeSpin", index: totalSpins, spin });
		if (spin.rainbowActivations > 0) rainbowTriggered = true;

		const scatters = scatterCount(spin.initialGrid);
		if (scatters >= 5) spinsLeft += 8;
		else if (scatters === 4) spinsLeft += 5;
		else if (scatters === 3) spinsLeft += 3;
		spinsLeft = Math.min(spinsLeft, MAX_TOTAL_FREE_SPINS - totalSpins);
	}

	return { totalWin, totalSpins, events, rainbowTriggered };
}

function runCascadingSpin(startGrid, bet = BET, mode = "base", options = {}) {
	let grid = cloneGrid(startGrid);
	let totalWin = 0;
	let cascades = 0;
	let goldenSquares = new Set(options.preservedGoldenSquares ?? []);
	let rainbowActivations = 0;
	const events = [{ type: "start", grid: cloneGrid(grid) }];
	const initialGrid = cloneGrid(grid);
	const maxWin = bet * MATH_CONFIG.maxWinMultiplier;

	for (; cascades < MAX_CASCADES && totalWin < maxWin; cascades += 1) {
		const wins = evaluateClusters(grid, bet);
		if (!wins.length) break;
		const winningCells = wins.flatMap((win) => win.positions);
		const clusterWin = wins.reduce((sum, win) => sum + win.amount, 0);
		totalWin = capWin(totalWin + clusterWin, bet);
		markGoldenSquares(grid, winningCells, goldenSquares);
		events.push({ type: "clusters", wins, positions: winningCells, amount: clusterWin, grid: cloneGrid(grid) });
		const cascade = cascadeGrid(grid, winningCells, mode, options);
		grid = cascade.grid;
		events.push({ type: "cascade", dropping: cascade.dropping, grid: cloneGrid(grid) });
		const feature = maybeActivateFeatures(grid, mode, goldenSquares, bet, maxWin - totalWin);
		if (feature) {
			grid = feature.grid;
			totalWin = capWin(totalWin + feature.win, bet);
			goldenSquares = new Set();
			rainbowActivations += 1;
			events.push(...feature.events);
		}
	}

	const finalFeature = maybeActivateFeatures(grid, mode, goldenSquares, bet, maxWin - totalWin);
	if (finalFeature && totalWin < maxWin) {
		grid = finalFeature.grid;
		totalWin = capWin(totalWin + finalFeature.win, bet);
		goldenSquares = new Set();
		rainbowActivations += 1;
		events.push(...finalFeature.events);
	}

	if (modeKey(mode) === "base" && options.clearGoldAtEnd) {
		goldenSquares = new Set();
	}

	return {
		initialGrid,
		finalGrid: grid,
		totalWin,
		cascades,
		events,
		remainingGoldenSquares: goldenSquares,
		rainbowSeen: hasRainbow(initialGrid) || events.some((event) => event.grid && hasRainbow(event.grid)),
		rainbowActivations,
		maxWin: totalWin >= maxWin,
	};
}

function maybeActivateFeatures(grid, mode, goldenSquares, bet, maxRemaining) {
	if (!hasRainbow(grid) || goldenSquares.size <= 0 || maxRemaining <= 0) return null;
	return activateGoldenSquares(grid, mode, goldenSquares, bet, { maxRemaining });
}

export function createMathEngine() {
	let grid = generateGrid();
	let goldenSquares = new Set();
	let coinedSquares = new Set();
	let currentMode = "base";
	let currentBet = BET;

	function startSpin(options = {}) {
		currentMode = modeKey(options.mode ?? (options.bonusLevel ? `bonus${options.bonusLevel}` : options.bonus ? "bonus1" : "base"));
		currentBet = options.bet ?? BET;
		if (!options.preserveGold) goldenSquares = new Set();
		coinedSquares = new Set();
		grid = generateGrid(currentMode, {
			ante: options.ante,
			bonusHunt: options.bonusHunt,
			forceRainbow: options.forceRainbow,
			forceCluster: options.forceCluster,
			forceScatters: options.forceScatters,
		});
		return snapshot();
	}

	function findWins() {
		return evaluateClusters(grid, currentBet);
	}

	function removeAndDrop(positions, options = {}) {
		markGoldenSquares(grid, positions, goldenSquares);
		const cascade = cascadeGrid(grid, positions, currentMode, options);
		grid = cascade.grid;
		return { board: snapshot().board, dropping: cascade.dropping };
	}

	function activateFeatures() {
		const feature = maybeActivateFeatures(grid, currentMode, goldenSquares, currentBet, currentBet * MATH_CONFIG.maxWinMultiplier);
		if (!feature) return [];
		grid = feature.grid;
		goldenSquares = new Set();
		for (const reward of feature.rewards) coinedSquares.add(posKey(reward.pos));
		return feature.events;
	}

	function visibleCoinTotal() {
		return 0;
	}

	function expireGoldenSquares() {
		goldenSquares = new Set();
		return snapshot();
	}

	function snapshot() {
		return {
			board: cloneGrid(grid),
			goldenSquares: new Set(goldenSquares),
			coinedSquares: new Set(coinedSquares),
		};
	}

	return {
		startSpin,
		findWins,
		removeAndDrop,
		activateFeatures,
		visibleCoinTotal,
		expireGoldenSquares,
		snapshot,
		hasRainbow: () => hasRainbow(grid),
	};
}

export function simulateSpins(count = 100000, bet = BET) {
	const stats = {
		totalSpins: count,
		totalBet: 0,
		totalWin: 0,
		hits: 0,
		maxWinObserved: 0,
		bonusTriggers: 0,
		bonus1: 0,
		bonus2: 0,
		bonus3: 0,
		rainbowSeen: 0,
		rainbowActivations: 0,
		goldenSquaresActivated: 0,
		bronzeCoins: 0,
		silverCoins: 0,
		goldCoins: 0,
		multipliers: 0,
		collectors: 0,
		reactivations: 0,
		winsOver50x: 0,
		winsOver100x: 0,
		winsOver500x: 0,
		winsOver1000x: 0,
		maxWinCount: 0,
		topWins: [],
	};

	for (let i = 0; i < count; i += 1) {
		const spin = runPaidSpin(bet);
		stats.totalBet += spin.totalBet;
		stats.totalWin += spin.totalWin;
		if (spin.totalWin > 0) stats.hits += 1;
		if (spin.bonusLevel) {
			stats.bonusTriggers += 1;
			stats[`bonus${spin.bonusLevel}`] += 1;
		}
		if (spin.rainbowSeen) stats.rainbowSeen += 1;
		if (spin.rainbowActivations > 0) stats.rainbowActivations += 1;
		stats.maxWinObserved = Math.max(stats.maxWinObserved, spin.totalWin / bet);
		if (spin.totalWin / bet > 50) stats.winsOver50x += 1;
		if (spin.totalWin / bet > 100) stats.winsOver100x += 1;
		if (spin.totalWin / bet > 500) stats.winsOver500x += 1;
		if (spin.totalWin / bet > 1000) stats.winsOver1000x += 1;
		if (spin.maxWin) stats.maxWinCount += 1;

		for (const event of spin.events) collectSimulationEventStats(event, stats);
		stats.topWins.push(spin.totalWin / bet);
		stats.topWins.sort((a, b) => b - a);
		if (stats.topWins.length > 20) stats.topWins.length = 20;
	}

	const output = {
		totalSpins: stats.totalSpins,
		totalBet: round(stats.totalBet),
		totalWin: round(stats.totalWin),
		RTP: `${round((stats.totalWin / stats.totalBet) * 100, 3)}%`,
		hitRate: `${round((stats.hits / count) * 100, 3)}%`,
		averageWin: round(stats.totalWin / count, 4),
		maxWinObserved: `${round(stats.maxWinObserved, 2)}x`,
		bonusTriggerRate: rate(stats.bonusTriggers, count),
		bonus1Rate: rate(stats.bonus1, count),
		bonus2Rate: rate(stats.bonus2, count),
		bonus3Rate: rate(stats.bonus3, count),
		rainbowSeenRate: rate(stats.rainbowSeen, count),
		rainbowActivationRate: rate(stats.rainbowActivations, count),
		averageGoldenSquaresPerActivation: stats.rainbowActivations ? round(stats.goldenSquaresActivated / stats.rainbowActivations, 3) : 0,
		bronzeCoinRate: rate(stats.bronzeCoins, Math.max(1, stats.goldenSquaresActivated)),
		silverCoinRate: rate(stats.silverCoins, Math.max(1, stats.goldenSquaresActivated)),
		goldCoinRate: rate(stats.goldCoins, Math.max(1, stats.goldenSquaresActivated)),
		multiplierRate: rate(stats.multipliers, Math.max(1, stats.goldenSquaresActivated)),
		collectorRate: rate(stats.collectors, Math.max(1, stats.goldenSquaresActivated)),
		reactivationRate: rate(stats.reactivations, Math.max(1, stats.rainbowActivations)),
		winsOver50x: stats.winsOver50x,
		winsOver100x: stats.winsOver100x,
		winsOver500x: stats.winsOver500x,
		winsOver1000x: stats.winsOver1000x,
		maxWinCount: stats.maxWinCount,
		top20Wins: stats.topWins.map((win) => `${round(win, 2)}x`),
	};
	console.table(output);
	return output;
}

function collectSimulationEventStats(event, stats) {
	if (event.type === "goldenActivation") {
		stats.goldenSquaresActivated += event.positions.length;
		for (const reward of event.rewards) {
			if (reward.type === "coin") {
				if (reward.tier === "bronze") stats.bronzeCoins += 1;
				if (reward.tier === "silver") stats.silverCoins += 1;
				if (reward.tier === "gold") stats.goldCoins += 1;
			}
			if (reward.type === "multiplier") stats.multipliers += 1;
			if (reward.type === "collector") stats.collectors += 1;
		}
	}
	if (event.type === "reactivation") stats.reactivations += 1;
	if (event.type === "bonus") {
		for (const freeSpin of event.bonus.events) {
			for (const nested of freeSpin.spin.events) collectSimulationEventStats(nested, stats);
		}
	}
}

function rate(value, total) {
	if (!value) return "0";
	return `1 in ${round(total / value, 1)} (${round((value / total) * 100, 3)}%)`;
}

function round(value, digits = 2) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}
