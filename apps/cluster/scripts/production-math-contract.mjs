import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..');
const generatedConfigPath = join(root, 'math', 'games', 'golden_goal_rush', 'library', 'configs', 'game_config.json');
const publishedConfigPath = join(root, 'publish', 'math', 'game_config.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const generatedConfigText = readFileSync(generatedConfigPath, 'utf8');
const publishedConfigText = readFileSync(publishedConfigPath, 'utf8');

if (generatedConfigText !== publishedConfigText) {
	throw new Error(
		`Production math drift: ${generatedConfigPath} and ${publishedConfigPath} are not byte-identical. Run npm run stake:publish:full-math or npm run stake:publish before building.`,
	);
}

export const PRODUCTION_GAME_CONFIG = Object.freeze(readJson(publishedConfigPath));

export const PRODUCTION_BET_MODE_KEYS = Object.freeze([
	'base',
	'hunt',
	'rainbow',
	'bonus_tier1',
	'bonus',
]);

export const PAYING_SYMBOLS = Object.freeze([
	'ten',
	'j',
	'q',
	'k',
	'a',
	'football',
	'whistle',
	'trophy',
	'jersey',
]);

export const CLUSTER_THRESHOLDS = Object.freeze([
	Object.freeze({ label: '5-6', min: 5, max: 6, valueKey: 'cluster5', boostKey: null }),
	Object.freeze({ label: '7-8', min: 7, max: 8, valueKey: 'cluster7', boostKey: 'cluster7Boost' }),
	Object.freeze({ label: '9-11', min: 9, max: 11, valueKey: 'cluster9', boostKey: 'cluster9Boost' }),
	Object.freeze({ label: '12+', min: 12, max: Infinity, valueKey: 'cluster12', boostKey: 'cluster12Boost' }),
]);

function finiteNumber(value, label) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
	return parsed;
}

function buildModeMaxWins(config) {
	if (!config?.betModes || typeof config.betModes !== 'object') {
		throw new Error('Production math config has no betModes');
	}
	const actualKeys = Object.keys(config.betModes).sort();
	const expectedKeys = [...PRODUCTION_BET_MODE_KEYS].sort();
	if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
		throw new Error(`Production math betModes must match the supported frontend modes exactly: expected ${expectedKeys.join(', ')}, received ${actualKeys.join(', ')}`);
	}
	const globalCap = finiteNumber(config.maxWinMultiplier, 'maxWinMultiplier');
	return Object.freeze(Object.fromEntries(PRODUCTION_BET_MODE_KEYS.map((mode) => {
		const raw = config.betModes[mode];
		if (!raw || typeof raw !== 'object') throw new Error(`Production math config is missing betModes.${mode}`);
		const maxWin = finiteNumber(raw.max_win, `betModes.${mode}.max_win`);
		if (maxWin <= 0 || maxWin > globalCap) {
			throw new Error(`betModes.${mode}.max_win must be greater than zero and no higher than maxWinMultiplier`);
		}
		return [mode, maxWin];
	})));
}

// Player-facing maximum-award copy must come from the exact shipped math
// configuration. The global maxWinMultiplier is only the engine safety cap;
// it is not necessarily attainable in every published mode.
export const PRODUCTION_MODE_MAX_WINS = buildModeMaxWins(PRODUCTION_GAME_CONFIG);

function buildPaytable(config) {
	if (!config || typeof config !== 'object') throw new Error('Production math config is not an object');
	if (!config.paytable || typeof config.paytable !== 'object') throw new Error('Production math config has no paytable');

	const paytable = {};
	for (const symbol of PAYING_SYMBOLS) {
		const raw = config.paytable[symbol];
		if (!raw || typeof raw !== 'object') throw new Error(`Production math config is missing paytable.${symbol}`);

		const cluster5 = finiteNumber(raw.cluster5, `${symbol}.cluster5`);
		const cluster7Boost = finiteNumber(raw.cluster7Boost, `${symbol}.cluster7Boost`);
		const cluster9Boost = finiteNumber(raw.cluster9Boost, `${symbol}.cluster9Boost`);
		const cluster12Boost = finiteNumber(raw.cluster12Boost, `${symbol}.cluster12Boost`);
		paytable[symbol] = Object.freeze({
			cluster5,
			cluster7Boost,
			cluster9Boost,
			cluster12Boost,
			cluster7: cluster5 * cluster7Boost,
			cluster9: cluster5 * cluster9Boost,
			cluster12: cluster5 * cluster12Boost,
		});
	}

	for (const symbol of Object.keys(config.paytable)) {
		if (!PAYING_SYMBOLS.includes(symbol)) {
			throw new Error(`Production math config contains unexpected paying symbol ${symbol}`);
		}
	}

	return Object.freeze(paytable);
}

export const PRODUCTION_PAYTABLE = buildPaytable(PRODUCTION_GAME_CONFIG);

export function formatPaytableMultiplier(value) {
	const parsed = finiteNumber(value, 'Paytable multiplier');
	if (Math.abs(parsed) < 1e-12) return '0';
	return parsed.toFixed(8).replace(/(?:\.0+|(\.\d*?)0+)$/, '$1');
}

export function payoutForCluster(symbol, clusterSize, cascadeMultiplier = 1) {
	const pay = PRODUCTION_PAYTABLE[symbol];
	if (!pay) throw new Error(`Unknown paying symbol ${symbol}`);
	const size = finiteNumber(clusterSize, 'clusterSize');
	const cascade = finiteNumber(cascadeMultiplier, 'cascadeMultiplier');
	if (size < 5) return 0;
	const threshold = CLUSTER_THRESHOLDS.find((entry) => size >= entry.min && size <= entry.max);
	if (!threshold) throw new Error(`Unsupported cluster size ${clusterSize}`);
	return pay[threshold.valueKey] * cascade;
}

