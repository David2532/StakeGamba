import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite JSON number`);
	return value;
}

function sameNumber(left, right) {
	return Math.abs(number(left, 'left value') - number(right, 'right value')) <= 1e-9;
}

function artifactPathFormatter(logicalRoot) {
	if (!logicalRoot) return (value) => value;
	const root = resolve(logicalRoot);
	return (value) => {
		const resolvedValue = resolve(value);
		const child = relative(root, resolvedValue);
		if (!child || child.startsWith(`..${sep}`) || child === '..' || isAbsolute(child)) {
			if (!child) return '.';
			throw new Error(`Evidence path escapes logical root: ${resolvedValue}`);
		}
		return child.split(sep).join('/');
	};
}

const PRODUCTION_MODE_KEYS = Object.freeze(['base', 'hunt', 'rainbow', 'bonus_tier1', 'bonus']);

export function verifyModeMaximumEvidence(mathPath, mathConfig, { pathFor = (value) => value } = {}) {
	const mathRoot = dirname(mathPath);
	const auditPath = resolve(mathRoot, 'RTP_AUDIT.json');
	const failures = [];
	const modes = [];
	let audit = null;
	if (!existsSync(auditPath)) {
		failures.push(`math artifact is missing ${auditPath}`);
	} else {
		try {
			audit = JSON.parse(readFileSync(auditPath, 'utf8'));
		} catch (error) {
			failures.push(`math RTP audit is not valid JSON: ${error.message}`);
		}
	}
	const configuredModeKeys = Object.keys(mathConfig?.betModes || {});
	if (JSON.stringify(configuredModeKeys) !== JSON.stringify(PRODUCTION_MODE_KEYS)) {
		failures.push(`math betModes must contain the canonical modes in order: ${PRODUCTION_MODE_KEYS.join(', ')}`);
	}
	const auditModeKeys = audit && typeof audit === 'object' && !Array.isArray(audit) ? Object.keys(audit) : [];
	if (JSON.stringify(auditModeKeys) !== JSON.stringify(PRODUCTION_MODE_KEYS)) {
		failures.push(`RTP_AUDIT must contain the canonical modes in order: ${PRODUCTION_MODE_KEYS.join(', ')}`);
	}

	for (const mode of PRODUCTION_MODE_KEYS) {
		const lookupPath = resolve(mathRoot, `${mode}_lookup.csv`);
		const rawConfigured = mathConfig.betModes?.[mode]?.max_win;
		const configured = typeof rawConfigured === 'number' && Number.isFinite(rawConfigured) ? rawConfigured : Number.NaN;
		const configuredBookUnits = Math.round(configured * 100);
		let maximumLookupBookUnits = null;
		let maximumPositiveWeightBookUnits = null;
		let rows = 0;
		if (!Number.isFinite(configured) || configured <= 0 || Math.abs(configured * 100 - configuredBookUnits) > 1e-9) {
			failures.push(`math betModes.${mode}.max_win must be a positive value with at most two decimal places`);
		}
		if (!existsSync(lookupPath)) {
			failures.push(`math artifact is missing ${lookupPath}`);
		} else {
			const seenIds = new Set();
			for (const [lineIndex, rawLine] of readFileSync(lookupPath, 'utf8').split(/\r?\n/).entries()) {
				const line = rawLine.trim();
				if (!line) continue;
				const fields = line.split(',');
				if (fields.length !== 3) {
					failures.push(`${mode} lookup row ${lineIndex + 1} must contain id, weight and payout`);
					continue;
				}
				if (!fields.every((field) => /^(0|[1-9]\d*)$/.test(field))) {
					failures.push(`${mode} lookup row ${lineIndex + 1} contains non-canonical integer fields`);
					continue;
				}
				const [id, weight, payout] = fields.map((field) => Number(field));
				if (![id, weight, payout].every(Number.isSafeInteger) || id <= 0) {
					failures.push(`${mode} lookup row ${lineIndex + 1} contains invalid integer fields`);
					continue;
				}
				if (seenIds.has(id)) {
					failures.push(`${mode} lookup contains duplicate book id ${id}`);
					continue;
				}
				seenIds.add(id);
				rows += 1;
				maximumLookupBookUnits = Math.max(maximumLookupBookUnits ?? payout, payout);
				if (weight > 0) maximumPositiveWeightBookUnits = Math.max(maximumPositiveWeightBookUnits ?? payout, payout);
			}
			if (rows === 0) failures.push(`${mode} lookup must contain at least one row`);
		}
		const rawAudited = audit?.[mode]?.maxPayoutMultiplierObserved;
		const audited = typeof rawAudited === 'number' && Number.isFinite(rawAudited) ? rawAudited : Number.NaN;
		if (!Number.isFinite(audited) || Math.abs(audited * 100 - configuredBookUnits) > 1e-9) {
			failures.push(`RTP_AUDIT ${mode}.maxPayoutMultiplierObserved=${audit?.[mode]?.maxPayoutMultiplierObserved} differs from config ${configured}`);
		}
		if (maximumLookupBookUnits !== configuredBookUnits) {
			failures.push(`${mode} lookup maximum ${maximumLookupBookUnits} book units differs from config ${configuredBookUnits}`);
		}
		if (maximumPositiveWeightBookUnits !== configuredBookUnits) {
			failures.push(`${mode} positive-weight lookup maximum ${maximumPositiveWeightBookUnits} book units differs from config ${configuredBookUnits}`);
		}
		modes.push({
			mode,
			rows,
			configuredMaxWin: configured,
			configuredBookUnits,
			auditedMaxWin: audited,
			maximumLookupBookUnits,
			maximumPositiveWeightBookUnits,
			lookupPath: pathFor(lookupPath),
		});
	}

	return { ok: failures.length === 0, auditPath: pathFor(auditPath), modes, failures };
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
	const embeddedModeMaximumsText = extractBalancedObject(html, 'const PRODUCTION_MODE_MAX_WINS =');
	let embedded;
	let embeddedModeMaximums;
	try {
		embedded = JSON.parse(embeddedText);
	} catch (error) {
		throw new Error(`Embedded PRODUCTION_PAYTABLE is not valid JSON: ${error.message}`);
	}
	try {
		embeddedModeMaximums = JSON.parse(embeddedModeMaximumsText);
	} catch (error) {
		throw new Error(`Embedded PRODUCTION_MODE_MAX_WINS is not valid JSON: ${error.message}`);
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

	const configuredModes = Object.keys(mathConfig.betModes || {}).sort();
	const requiredModes = [...PRODUCTION_MODE_KEYS].sort();
	if (configuredModes.length !== requiredModes.length || configuredModes.some((mode, index) => mode !== requiredModes[index])) {
		failures.push(`math bet modes must match ${requiredModes.join(', ')} exactly; received ${configuredModes.join(', ') || '(none)'}`);
	}
	const expectedModeMaximums = Object.fromEntries(PRODUCTION_MODE_KEYS.map((mode) => [mode, mathConfig.betModes?.[mode]?.max_win]));
	const expectedModes = Object.keys(expectedModeMaximums).sort();
	const actualModes = Object.keys(embeddedModeMaximums).sort();
	for (const mode of expectedModes) {
		if (!actualModes.includes(mode)) {
			failures.push(`frontend maximum-award map is missing production mode ${mode}`);
			continue;
		}
		if (!sameNumber(embeddedModeMaximums[mode], expectedModeMaximums[mode])) {
			failures.push(`frontend maximum-award map ${mode}=${embeddedModeMaximums[mode]} differs from math ${expectedModeMaximums[mode]}`);
		}
		checked.push({
			mode,
			field: 'max_win',
			expected: Number(expectedModeMaximums[mode]),
			actual: Number(embeddedModeMaximums[mode]),
		});
	}
	for (const mode of actualModes) {
		if (!expectedModes.includes(mode)) failures.push(`frontend maximum-award map has unexpected production mode ${mode}`);
	}

	return {
		ok: failures.length === 0,
		mathVersion: mathConfig.version || null,
		symbols: expectedSymbols,
		modes: expectedModes,
		checked,
		failures,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.html || !args.math) {
		throw new Error('Usage: node scripts/verify-stake-paytable.mjs --html <index.html> --math <game_config.json> [--report <report.json>] [--logical-root <artifact-root>]');
	}
	const htmlPath = resolve(args.html);
	const mathPath = resolve(args.math);
	const html = readFileSync(htmlPath, 'utf8');
	const mathConfig = JSON.parse(readFileSync(mathPath, 'utf8'));
	const frontendContract = verifyPaytableContract(html, mathConfig);
	const pathFor = artifactPathFormatter(args['logical-root']);
	const modeMaximumEvidence = verifyModeMaximumEvidence(mathPath, mathConfig, { pathFor });
	const failures = [...frontendContract.failures, ...modeMaximumEvidence.failures];
	const report = {
		...frontendContract,
		ok: failures.length === 0,
		failures,
		modeMaximumEvidence,
		htmlPath: pathFor(htmlPath),
		mathPath: pathFor(mathPath),
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
	console.log(`Stake frontend/math contract passed for ${report.symbols.length} paying symbols and ${report.modes.length} mode maximums (${report.checked.length} numerical fields).`);
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
