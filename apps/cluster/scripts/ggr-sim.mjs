// Golden Goal Rush RTP simulation — a pure-math port of the playable engine
// (apps/cluster/scripts/build-preview-html.mjs) sharing the same CONFIG.
// Usage: node apps/cluster/scripts/ggr-sim.mjs [baseSpins] [buySpins]
//
// It validates coin logging (base coins always come from the value tables;
// e.g. silver 60x can only exist after a multiplier) and reports RTP for the
// base game and each bonus-buy mode.

import { SYMBOL_MATH, CONFIG } from './ggr-config.mjs';

const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
const CAP = CONFIG.maxWinMultiplier; // bet is 1 throughout, so wins are bet-multiples
const KEYS = Object.keys(SYMBOL_MATH);
const rand = (arr) => arr[(Math.random() * arr.length) | 0];
const ck = (c, r) => c + ',' + r;
const wpick = (entries) => { const t = entries.reduce((s, e) => s + e[1], 0); let x = Math.random() * t; for (const [v, w] of entries) { x -= w; if (x < 0) return v; } return entries[0][0]; };

// coin-spawn audit
const audit = { silverBaseMax: 0, goldBaseMax: 0, bronzeBaseMax: 0, badBase: 0 };

const POOL_SCALE = 50; // allows fractional feature-symbol weights
function buildPool({ noRainbow = false, boostRainbow = 1, boostScatter = 1 } = {}) {
	const pool = [];
	for (const k of KEYS) {
		let w = SYMBOL_MATH[k].weight;
		if (k === 'rainbow') w = noRainbow ? 0 : CONFIG.rainbowWeight * boostRainbow;
		if (k === 'scatter') w = CONFIG.scatterWeight * boostScatter;
		const n = Math.round(w * POOL_SCALE);
		for (let i = 0; i < n; i += 1) pool.push(k);
	}
	return pool;
}
function newGrid(opts = {}) {
	const pool = buildPool(opts);
	const rk = () => pool[(Math.random() * pool.length) | 0];
	const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, rk));
	if (opts.forceRainbow && !grid.flat().includes('rainbow')) grid[(Math.random() * COLS) | 0][(Math.random() * ROWS) | 0] = 'rainbow';
	return { grid, pool };
}

function findClusters(grid) {
	const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
	const clusters = [];
	const sameAs = (target, k) => k === target || SYMBOL_MATH[k].wild || (SYMBOL_MATH[target].wild && SYMBOL_MATH[k].pay > 0);
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
		const key = grid[c][r];
		if (seen[c][r] || SYMBOL_MATH[key].wild || SYMBOL_MATH[key].scatter) continue;
		const stack = [[c, r]]; const cells = []; seen[c][r] = true;
		while (stack.length) {
			const [cc, rr] = stack.pop(); cells.push([cc, rr]);
			for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nc = cc + dc, nr = rr + dr;
				if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nc][nr]) continue;
				if (sameAs(key, grid[nc][nr])) { seen[nc][nr] = true; stack.push([nc, nr]); }
			}
		}
		if (cells.length >= MIN_CLUSTER) clusters.push({ key, cells });
	}
	return clusters;
}
const payFor = (key, count) => SYMBOL_MATH[key].pay * (count >= 12 ? 8 : count >= 9 ? 4 : count >= 7 ? 2 : 1);

function resolveCascades(grid, pool, golden, startWin) {
	let win = startWin, multiplier = 1;
	const rk = () => pool[(Math.random() * pool.length) | 0];
	while (true) {
		const clusters = findClusters(grid);
		if (!clusters.length) break;
		const flat = clusters.flatMap((cl) => cl.cells);
		flat.forEach(([c, r]) => golden.add(ck(c, r)));
		const step = clusters.reduce((s, cl) => s + payFor(cl.key, cl.cells.length), 0) * multiplier;
		win = Math.min(CAP, win + step);
		const removed = Array.from({ length: COLS }, () => new Set());
		flat.forEach(([c, r]) => removed[c].add(r));
		for (let c = 0; c < COLS; c += 1) {
			const kept = [];
			for (let r = 0; r < ROWS; r += 1) if (!removed[c].has(r)) kept.push(grid[c][r]);
			const add = ROWS - kept.length;
			grid[c] = [...Array.from({ length: add }, rk), ...kept];
		}
		multiplier += 1;
		if (win >= CAP) break;
	}
	return win;
}

function revealGolden(golden, reduceBronze) {
	const reveals = new Map();
	const w = {
		bronze: reduceBronze ? Math.max(1, Math.round(CONFIG.bronzeWeight * 0.12)) : CONFIG.bronzeWeight,
		silver: CONFIG.silverWeight, gold: CONFIG.goldWeight, mult: CONFIG.multiplierWeight, collector: CONFIG.collectorWeight,
	};
	for (const key of golden) {
		const kind = wpick([['blank', CONFIG.blankWeight], ['bronze', w.bronze], ['silver', w.silver], ['gold', w.gold], ['mult', w.mult], ['collector', w.collector]]);
		if (kind === 'blank') continue;
		if (kind === 'mult') reveals.set(key, { kind: 'mult', value: rand(CONFIG.multiplierValues) });
		else if (kind === 'collector') reveals.set(key, { kind: 'collector', value: 0 });
		else {
			const tbl = kind === 'gold' ? CONFIG.goldValues : kind === 'silver' ? CONFIG.silverValues : CONFIG.bronzeValues;
			const v = rand(tbl);
			// audit: a base coin must be exactly a table value
			if (!tbl.includes(v)) audit.badBase += 1;
			if (kind === 'silver') audit.silverBaseMax = Math.max(audit.silverBaseMax, v);
			if (kind === 'gold') audit.goldBaseMax = Math.max(audit.goldBaseMax, v);
			if (kind === 'bronze') audit.bronzeBaseMax = Math.max(audit.bronzeBaseMax, v);
			reveals.set(key, { kind: 'coin', tier: kind, value: v });
		}
	}
	return reveals;
}
function applyMultipliers(reveals) {
	for (const [key, badge] of reveals) {
		if (badge.kind !== 'mult') continue;
		const [c, r] = key.split(',').map(Number);
		for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
			const nv = reveals.get(ck(c + dc, r + dr));
			if (nv && nv.kind === 'coin') nv.value = Math.round(nv.value * badge.value * 100) / 100;
		}
	}
}
function runFeature(golden, reduceBronze) {
	let coinMult = 0;
	for (let cycle = 0; cycle < CONFIG.maxCollectorCycles; cycle += 1) {
		const reveals = revealGolden(golden, reduceBronze);
		applyMultipliers(reveals);
		const coins = [...reveals.values()].filter((v) => v.kind === 'coin');
		const sum = coins.reduce((s, c) => s + c.value, 0);
		const collectors = [...reveals.values()].filter((v) => v.kind === 'collector').length;
		for (let i = 0; i < collectors; i += 1) { coinMult += sum; if (coinMult >= CAP) return CAP; }
		coinMult += sum;
		if (!collectors || coinMult >= CAP) break;
	}
	return Math.min(CAP, coinMult);
}

function evalSpin(gridObj, golden, mode, tier) {
	const { grid, pool } = gridObj;
	const baseWin = resolveCascades(grid, pool, golden, 0);
	let featureWin = 0;
	if (grid.flat().includes('rainbow') && golden.size) {
		featureWin = runFeature(golden, mode === 'free' && CONFIG.tiers[tier] && CONFIG.tiers[tier].reduceBronze);
		if (mode === 'free' && CONFIG.tiers[tier] && !CONFIG.tiers[tier].persistAfterReveal) golden.clear();
	}
	const scatters = grid.flat().filter((k) => k === 'scatter').length;
	return { win: Math.min(CAP, baseWin + featureWin), scatters };
}

function runFreeSpins(startTier) {
	let tier = startTier, total = 0, golden = new Set();
	let spinsLeft = CONFIG.tiers[tier].spins, guard = 0;
	while (spinsLeft > 0 && total < CAP && guard < 400) {
		spinsLeft -= 1; guard += 1;
		const g = newGrid({ forceRainbow: CONFIG.tiers[tier].guaranteedRainbow, boostRainbow: CONFIG.tiers[tier].rainbowBoost || 1 });
		const r = evalSpin(g, golden, 'free', tier);
		total = Math.min(CAP, total + r.win);
		if (r.scatters >= 2) { const add = r.scatters >= 3 ? 4 : 2; if (tier === 1 && r.scatters >= 4) tier = 2; spinsLeft += add; }
	}
	return total;
}

function baseSpin(opts = {}) {
	const golden = new Set();
	const g = newGrid(opts);
	const r = evalSpin(g, golden, 'base', 0);
	let win = r.win;
	if (r.scatters >= 3 && !opts.noBonus) win = Math.min(CAP, win + runFreeSpins(r.scatters >= 5 ? 3 : r.scatters >= 4 ? 2 : 1));
	return win;
}

function rtp(label, spins, costPerSpin, runner) {
	let totalWin = 0, hits = 0, max = 0;
	for (let i = 0; i < spins; i += 1) { const w = runner(); totalWin += w; if (w > 0) hits += 1; if (w > max) max = w; }
	const r = totalWin / (spins * costPerSpin);
	console.log(`${label.padEnd(22)} RTP ${(r * 100).toFixed(2)}%  hit ${(hits / spins * 100).toFixed(1)}%  max ${max.toFixed(0)}x  (${spins.toLocaleString()} spins @ ${costPerSpin}x)`);
	return r;
}

const baseSpins = Number(process.argv[2] || 200000);
const buySpins = Number(process.argv[3] || 40000);
console.log('Golden Goal Rush — RTP simulation (bet = 1)\n');
rtp('Base game', baseSpins, 1, () => baseSpin());
rtp('Buy: Feature Spins', buySpins, 3, () => baseSpin({ boostRainbow: 5, noBonus: true }));
rtp('Buy: Rainbow Spin', buySpins, 50, () => baseSpin({ forceRainbow: true }));
rtp('Buy: Golden Chance', buySpins, 100, () => runFreeSpins(1));
rtp('Buy: All That Glitters', buySpins, 250, () => runFreeSpins(2));
console.log('\nCoin audit:', JSON.stringify(audit));
console.log('  -> base silver max:', audit.silverBaseMax, '(must be <= 20)',
	'| base gold max:', audit.goldBaseMax, '(must be <= 500)',
	'| out-of-table base coins:', audit.badBase, '(must be 0)');
