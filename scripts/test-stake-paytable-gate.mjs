import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyModeMaximumEvidence, verifyPaytableContract } from './verify-stake-paytable.mjs';

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

function frontendModeMaximumsFromMath(config) {
	return Object.fromEntries(Object.entries(config.betModes).map(([mode, entry]) => [mode, Number(entry.max_win)]));
}

function htmlWith(paytable, modeMaximums) {
	return `<!doctype html><script>const PRODUCTION_PAYTABLE = ${JSON.stringify(paytable)}; const PRODUCTION_MODE_MAX_WINS = ${JSON.stringify(modeMaximums)};</script>`;
}

const validPaytable = frontendPaytableFromMath(mathConfig);
const validModeMaximums = frontendModeMaximumsFromMath(mathConfig);
const validResult = verifyPaytableContract(htmlWith(validPaytable, validModeMaximums), mathConfig);
if (!validResult.ok) {
	throw new Error(`Valid Paytable fixture was rejected: ${validResult.failures.join('; ')}`);
}

const stalePaytable = structuredClone(validPaytable);
const targetSymbol = stalePaytable.k ? 'k' : Object.keys(stalePaytable)[0];
stalePaytable[targetSymbol].cluster5 = Number(stalePaytable[targetSymbol].cluster5) + 0.01;
const staleResult = verifyPaytableContract(htmlWith(stalePaytable, validModeMaximums), mathConfig);
if (staleResult.ok) {
	throw new Error('Stale Paytable fixture unexpectedly passed');
}
if (!staleResult.failures.some((failure) => failure.includes(`${targetSymbol}.cluster5`))) {
	throw new Error(`Stale fixture failed for the wrong reason: ${staleResult.failures.join('; ')}`);
}

const staleModeMaximums = structuredClone(validModeMaximums);
staleModeMaximums.base = Number(staleModeMaximums.base) + 0.01;
const staleModeResult = verifyPaytableContract(htmlWith(validPaytable, staleModeMaximums), mathConfig);
if (staleModeResult.ok) {
	throw new Error('Stale mode-maximum fixture unexpectedly passed');
}
if (!staleModeResult.failures.some((failure) => failure.includes('maximum-award map base='))) {
	throw new Error(`Stale mode-maximum fixture failed for the wrong reason: ${staleModeResult.failures.join('; ')}`);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), 'stake-mode-maximum-gate-'));
try {
	const audit = {};
	for (const [mode, maximum] of Object.entries(validModeMaximums)) {
		const units = Math.round(Number(maximum) * 100);
		writeFileSync(join(fixtureRoot, `${mode}_lookup.csv`), `1,1,${units}\n`, 'utf8');
		audit[mode] = { maxPayoutMultiplierObserved: Number(maximum) };
	}
	writeFileSync(join(fixtureRoot, 'RTP_AUDIT.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
	const fixtureMathPath = join(fixtureRoot, 'game_config.json');
	const validModeEvidence = verifyModeMaximumEvidence(fixtureMathPath, mathConfig);
	if (!validModeEvidence.ok) {
		throw new Error(`Valid mode-maximum evidence fixture was rejected: ${validModeEvidence.failures.join('; ')}`);
	}

	const baseUnits = Math.round(Number(validModeMaximums.base) * 100);
	writeFileSync(join(fixtureRoot, 'base_lookup.csv'), `1,1,${baseUnits}\n1,1,${baseUnits}\n`, 'utf8');
	const duplicateLookupEvidence = verifyModeMaximumEvidence(fixtureMathPath, mathConfig);
	if (duplicateLookupEvidence.ok || !duplicateLookupEvidence.failures.some((failure) => failure.includes('duplicate book id 1'))) {
		throw new Error(`Duplicate lookup-ID fixture did not fail closed: ${duplicateLookupEvidence.failures.join('; ')}`);
	}
	writeFileSync(join(fixtureRoot, 'base_lookup.csv'), '', 'utf8');
	const emptyLookupEvidence = verifyModeMaximumEvidence(fixtureMathPath, mathConfig);
	if (emptyLookupEvidence.ok || !emptyLookupEvidence.failures.some((failure) => failure.includes('must contain at least one row'))) {
		throw new Error(`Empty lookup fixture did not fail closed: ${emptyLookupEvidence.failures.join('; ')}`);
	}
	writeFileSync(join(fixtureRoot, 'base_lookup.csv'), `1,1,${baseUnits}\n`, 'utf8');
	const stringMaximumConfig = structuredClone(mathConfig);
	stringMaximumConfig.betModes.base.max_win = String(stringMaximumConfig.betModes.base.max_win);
	const stringMaximumEvidence = verifyModeMaximumEvidence(fixtureMathPath, stringMaximumConfig);
	if (stringMaximumEvidence.ok || !stringMaximumEvidence.failures.some((failure) => failure.includes('betModes.base.max_win must be a positive value'))) {
		throw new Error(`String maximum fixture did not fail closed: ${stringMaximumEvidence.failures.join('; ')}`);
	}
	const stringAudit = structuredClone(audit);
	stringAudit.base.maxPayoutMultiplierObserved = String(stringAudit.base.maxPayoutMultiplierObserved);
	writeFileSync(join(fixtureRoot, 'RTP_AUDIT.json'), `${JSON.stringify(stringAudit, null, 2)}\n`, 'utf8');
	const stringAuditEvidence = verifyModeMaximumEvidence(fixtureMathPath, mathConfig);
	if (stringAuditEvidence.ok || !stringAuditEvidence.failures.some((failure) => failure.includes('RTP_AUDIT base.maxPayoutMultiplierObserved'))) {
		throw new Error(`String RTP-audit maximum fixture did not fail closed: ${stringAuditEvidence.failures.join('; ')}`);
	}
	writeFileSync(join(fixtureRoot, 'RTP_AUDIT.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

	const jointlyStaleConfig = structuredClone(mathConfig);
	jointlyStaleConfig.betModes.base.max_win = Number(jointlyStaleConfig.betModes.base.max_win) + 0.01;
	const jointlyStaleAudit = structuredClone(audit);
	jointlyStaleAudit.base.maxPayoutMultiplierObserved = Number(jointlyStaleConfig.betModes.base.max_win);
	writeFileSync(join(fixtureRoot, 'RTP_AUDIT.json'), `${JSON.stringify(jointlyStaleAudit, null, 2)}\n`, 'utf8');
	const jointlyStaleEvidence = verifyModeMaximumEvidence(fixtureMathPath, jointlyStaleConfig);
	if (jointlyStaleEvidence.ok) {
		throw new Error('Jointly stale config/RTP-audit maximum unexpectedly passed lookup-derived evidence validation');
	}
	if (!jointlyStaleEvidence.failures.some((failure) => failure.includes('base lookup maximum'))) {
		throw new Error(`Jointly stale config/RTP-audit fixture failed for the wrong reason: ${jointlyStaleEvidence.failures.join('; ')}`);
	}
} finally {
	rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`Stake Paytable gate self-test passed: valid fixtures accepted; stale ${targetSymbol}.cluster5, frontend base maximum, duplicate/empty lookup, string-typed evidence, and jointly stale config/RTP-audit fixtures rejected.`);
