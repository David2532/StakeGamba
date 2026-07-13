import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		const key = argv[index];
		if (!key.startsWith('--')) continue;
		const value = argv[index + 1];
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
		result[key.slice(2)] = value;
		index += 1;
	}
	return result;
}

function extractBalancedObject(content, marker) {
	const markerIndex = content.indexOf(marker);
	if (markerIndex < 0) throw new Error(`Generated frontend is missing ${marker}`);
	const start = content.indexOf('{', markerIndex);
	if (start < 0) throw new Error(`Generated frontend has no object after ${marker}`);
	let depth = 0;
	let quote = '';
	let escaped = false;
	for (let index = start; index < content.length; index += 1) {
		const char = content[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === quote) quote = '';
			continue;
		}
		if (char === '"' || char === "'" || char === '`') {
			quote = char;
			continue;
		}
		if (char === '{') depth += 1;
		else if (char === '}') {
			depth -= 1;
			if (depth === 0) return content.slice(start, index + 1);
		}
	}
	throw new Error(`Generated frontend contains an unterminated object after ${marker}`);
}

function number(value, label) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
	return parsed;
}

function sameNumber(left, right) {
	return Math.abs(number(left, 'left value') - number(right, 'right value')) <= 1e-9;
}

function expectedEntry(entry, symbol) {
	const cluster5 = number(entry.cluster5, `${symbol}.cluster5`);
	const cluster7Boost = number(entry.cluster7Boost, `${symbol}.cluster7Boost`);
	const cluster9Boost = number(entry.cluster9Boost, `${symbol}.cluster9Boost`);
	const cluster12Boost = number(entry.cluster12Boost, `${symbol}.cluster12Boost`);
	return {
		cluster5,
		cluster7Boost,
		cluster9Boost,
		cluster12Boost,
		cluster7: cluster5 * cluster7Boost,
		cluster9: cluster5 * cluster9Boost,
		cluster12: cluster5 * cluster12Boost,
	};
}

export function verifyPaytableContract(html, mathConfig) {
	if (!mathConfig || typeof mathConfig !== 'object' || !mathConfig.paytable) {
		throw new Error('Math configuration has no paytable');
	}
	const embeddedText = extractBalancedObject(html, 'const PRODUCTION_PAYTABLE =');
	let embedded;
	try {
		embedded = JSON.parse(embeddedText);
	} catch (error) {
		throw new Error(`Embedded PRODUCTION_PAYTABLE is not valid JSON: ${error.message}`);
	}

	const expectedSymbols = Object.keys(mathConfig.paytable).sort();
	const actualSymbols = Object.keys(embedded).sort();
	const failures = [];
	for (const symbol of expectedSymbols) {
		if (!actualSymbols.includes(symbol)) failures.push(`frontend is missing paying symbol ${symbol}`);
	}
	for (const symbol of actualSymbols) {
		if (!expectedSymbols.includes(symbol)) failures.push(`frontend has unexpected paying symbol ${symbol}`);
	}

	const checked = [];
	for (const symbol of expectedSymbols) {
		if (!embedded[symbol]) continue;
		const expected = expectedEntry(mathConfig.paytable[symbol], symbol);
		const actual = embedded[symbol];
		for (const [field, expectedValue] of Object.entries(expected)) {
			if (!(field in actual)) {
				failures.push(`frontend is missing ${symbol}.${field}`);
				continue;
			}
			if (!sameNumber(actual[field], expectedValue)) {
				failures.push(`frontend ${symbol}.${field}=${actual[field]} differs from math ${expectedValue}`);
			}
			checked.push({ symbol, field, expected: expectedValue, actual: Number(actual[field]) });
		}
	}

	return {
		ok: failures.length === 0,
		mathVersion: mathConfig.version || null,
		symbols: expectedSymbols,
		checked,
		failures,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.html || !args.math) {
		throw new Error('Usage: node scripts/verify-stake-paytable.mjs --html <index.html> --math <game_config.json> [--report <report.json>]');
	}
	const htmlPath = resolve(args.html);
	const mathPath = resolve(args.math);
	const html = readFileSync(htmlPath, 'utf8');
	const mathConfig = JSON.parse(readFileSync(mathPath, 'utf8'));
	const report = {
		...verifyPaytableContract(html, mathConfig),
		htmlPath,
		mathPath,
		generatedAt: new Date().toISOString(),
	};
	if (args.report) {
		const reportPath = resolve(args.report);
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	}
	if (!report.ok) {
		console.error('Stake Paytable contract failed:');
		for (const failure of report.failures) console.error(`- ${failure}`);
		process.exitCode = 1;
		return;
	}
	console.log(`Stake Paytable contract passed for ${report.symbols.length} paying symbols (${report.checked.length} numerical fields).`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
