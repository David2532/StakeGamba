import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPaytableContract } from './verify-stake-paytable.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mathPath = join(root, 'math', 'games', 'golden_goal_rush', 'library', 'configs', 'game_config.json');
const mathConfig = JSON.parse(readFileSync(mathPath, 'utf8'));

function frontendPaytableFromMath(config) {
	return Object.fromEntries(Object.entries(config.paytable).map(([symbol, entry]) => {
		const cluster5 = Number(entry.cluster5);
		const cluster7Boost = Number(entry.cluster7Boost);
		const cluster9Boost = Number(entry.cluster9Boost);
		const cluster12Boost = Number(entry.cluster12Boost);
		return [symbol, {
			cluster5,
			cluster7Boost,
			cluster9Boost,
			cluster12Boost,
			cluster7: cluster5 * cluster7Boost,
			cluster9: cluster5 * cluster9Boost,
			cluster12: cluster5 * cluster12Boost,
		}];
	}));
}

function htmlWith(paytable) {
	return `<!doctype html><script>const PRODUCTION_PAYTABLE = ${JSON.stringify(paytable)};</script>`;
}

const validPaytable = frontendPaytableFromMath(mathConfig);
const validResult = verifyPaytableContract(htmlWith(validPaytable), mathConfig);
if (!validResult.ok) {
	throw new Error(`Valid Paytable fixture was rejected: ${validResult.failures.join('; ')}`);
}

const stalePaytable = structuredClone(validPaytable);
const targetSymbol = stalePaytable.k ? 'k' : Object.keys(stalePaytable)[0];
stalePaytable[targetSymbol].cluster5 = Number(stalePaytable[targetSymbol].cluster5) + 0.01;
const staleResult = verifyPaytableContract(htmlWith(stalePaytable), mathConfig);
if (staleResult.ok) {
	throw new Error('Stale Paytable fixture unexpectedly passed');
}
if (!staleResult.failures.some((failure) => failure.includes(`${targetSymbol}.cluster5`))) {
	throw new Error(`Stale fixture failed for the wrong reason: ${staleResult.failures.join('; ')}`);
}

console.log(`Stake Paytable gate self-test passed: valid fixture accepted and stale ${targetSymbol}.cluster5 fixture rejected.`);
