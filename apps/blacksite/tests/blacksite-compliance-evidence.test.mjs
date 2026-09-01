import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildComplianceEvidence } from '../../../scripts/blacksite-compliance-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const map = JSON.parse(
	readFileSync(join(repoRoot, 'docs/blacksite/RELEASE_EVIDENCE_51.json'), 'utf8'),
);
const gitSha = '1'.repeat(40);
const frontendTreeSha256 = '2'.repeat(64);
const mathTreeSha256 = '3'.repeat(64);
const mathFingerprintSha256 = '4'.repeat(64);

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blacksite-compliance-'));
	const candidateRoot = join(root, 'candidate');
	mkdirSync(candidateRoot);
	writeJson(join(candidateRoot, 'candidate-manifest.json'), {
		schema: 'blacksite-upload-candidate-v1',
		git: { sha: gitSha },
		packages: {
			frontend: { treeSha256: frontendTreeSha256 },
			math: { treeSha256: mathTreeSha256 },
		},
		mathEvidence: { candidateFingerprintSha256: mathFingerprintSha256 },
	});
	writeJson(join(candidateRoot, 'package-verification.json'), {
		schema: 'blacksite-upload-candidate-verification-v1',
		result: 'PASS',
		gitSha,
		frontend: { treeSha256: frontendTreeSha256 },
		math: { treeSha256: mathTreeSha256 },
	});
	const scenarioNames = [...new Set(map.items.flatMap((item) => item.browserScenarios ?? []))];
	const checkNames = [...new Set(map.items.flatMap((item) => item.browserChecks ?? []))];
	const browserEvidencePath = join(root, 'browser.json');
	const browserEvidence = {
		identity: {
			testedGitSha: gitSha,
			buildTreeSha256: frontendTreeSha256,
			expectedBuildTreeSha256: frontendTreeSha256,
		},
		scenarios: scenarioNames.map((name) => ({ name, status: 'PASS' })),
		checks: checkNames.map((name) => ({ name, status: 'PASS' })),
		summary: {
			pass: scenarioNames.length + checkNames.length,
			fail: 0,
			scenarios: scenarioNames.length,
			passedScenarios: scenarioNames.length,
			failedScenarios: 0,
		},
	};
	writeJson(browserEvidencePath, browserEvidence);
	return { root, candidateRoot, browserEvidencePath, browserEvidence };
}

test('51-point candidate evidence is complete, identity-bound, and keeps open gates explicit', () => {
	const value = fixture();
	try {
		const evidence = buildComplianceEvidence(value);
		assert.equal(evidence.items.length, 51);
		assert.deepEqual(
			evidence.items.map((item) => item.id),
			Array.from({ length: 51 }, (_, index) => index + 1),
		);
		assert.deepEqual(evidence.summary.byStatus, {
			AUTOMATED_PASS: 20,
			AUTOMATED_PASS_MANUAL_OPEN: 18,
			MANUAL_OPEN: 5,
			EXTERNAL_OPEN: 6,
			NOT_APPLICABLE: 2,
		});
		assert.equal(evidence.summary.automatedProofComplete, 38);
		assert.equal(evidence.claims.matrixCompleteness, 'PASS');
		assert.equal(evidence.claims.manualEvidence, 'NOT_CLAIMED');
		assert.equal(evidence.claims.externalApproval, 'NOT_CLAIMED');
		assert.equal(evidence.claims.releaseReadiness, 'NOT_CLAIMED');
		assert.equal(evidence.candidate.gitSha, gitSha);
		assert.equal(evidence.candidate.frontendTreeSha256, frontendTreeSha256);
		assert.equal(evidence.candidate.mathTreeSha256, mathTreeSha256);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('currency evidence binds social, native fiat, fallback, and authoritative balance families', () => {
	const currencyItem = map.items.find((item) => item.id === 11);
	assert(currencyItem);
	assert.deepEqual(currencyItem.browserScenarios, [
		'social-xsc-rules-paytable-and-terminology',
		'live-jpy-native-balance-and-exact-win',
		'live-unknown-currency-code-fallback',
		'session-position-and-timer-follow-authoritative-balance',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	for (const scenario of currencyItem.browserScenarios) {
		assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	}
});

test('authenticate parameter evidence rejects ambiguous step aliases in the exact browser', () => {
	const item = map.items.find((candidate) => candidate.id === 9);
	assert(item);
	assert.deepEqual(item.browserScenarios, [
		'authenticate-drives-levels-default-and-modes',
		'authenticate-empty-levels-exposes-full-step-range',
		'conflicting-auth-step-aliases-fail-closed',
		'jurisdiction-disables-space-and-feature-modes-only',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /runScenario\('conflicting-auth-step-aliases-fail-closed'/u);
	assert.match(browserQa, /conflicting step aliases expose the exact fail-closed contract error/u);
	assert.match(browserQa, /conflicting step aliases authenticate once and send zero wallet or event writes/u);
});

test('session-expiry evidence binds explicit reauthentication and a fresh deliberate play', () => {
	const authenticateItem = map.items.find((item) => item.id === 1);
	const playItem = map.items.find((item) => item.id === 3);
	assert(authenticateItem);
	assert(playItem);
	const scenario = 'expired-session-on-play-reauthenticates-without-automatic-retry';
	assert(authenticateItem.browserScenarios.includes(scenario));
	assert(playItem.browserScenarios.includes(scenario));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	assert.match(browserQa, /expired session never retries the rejected play automatically/u);
	assert.match(browserQa, /reauthentication alone never resubmits the rejected paid action/u);
	assert.match(browserQa, /a new deliberate action succeeds once after reauthentication/u);
	assert.match(
		browserQa,
		/serialize\(network\.order\) === serialize\(\['authenticate', 'play', 'authenticate', 'play'\]\)/u,
	);
});

test('active-round evidence binds uncertain play and failed-settlement recovery', () => {
	const item = map.items.find((candidate) => candidate.id === 10);
	assert(item);
	assert.deepEqual(item.browserScenarios, [
		'active-restore-no-duplicate-play',
		'active-feature-restore-resumes-at-checkpoint-once',
		'uncertain-live-play-reloads-and-restores-without-retry',
		'settlement-http-503-reloads-and-restores-exactly-once',
		'settlement-session-expiry-reauthenticates-and-settles-once',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	for (const scenario of item.browserScenarios) {
		assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	}
	assert.match(browserQa, /never retried automatically/u);
	assert.match(browserQa, /exactly one new settlement attempt/u);
	assert.match(browserQa, /expired settlement session never retries authentication or settlement automatically/u);
	assert.match(browserQa, /reauthenticated settlement performs exactly one new completion attempt/u);
	assert.match(browserQa, /event-driven trace observes the primed feature checkpoint without polling a transient state/u);
	assert.match(browserQa, /restore persists each remaining durable checkpoint exactly once in order/u);
	assert.match(browserQa, /network\.byEndpoint\.authenticate\[0\]/u);
	assert.match(
		browserQa,
		/serialize\(network\.order\) === serialize\(\['authenticate', 'play', 'event', 'endRound', 'authenticate', 'endRound'\]\)/u,
	);
});

test('insufficient-balance evidence binds known guard and authoritative ERR_IPB recovery', () => {
	const item = map.items.find((candidate) => candidate.id === 14);
	assert(item);
	assert.deepEqual(item.browserScenarios, [
		'known-insufficient-balance-blocks-play',
		'rgs-err-ipb-after-auth-race-fails-closed',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	for (const scenario of item.browserScenarios) {
		assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	}
	assert.match(browserQa, /ERR_IPB recovery never retries the rejected paid play automatically/u);
	assert.match(browserQa, /explicit ERR_IPB reload restores and completes the authoritative active round/u);
});

test('five-win evidence binds five exact final-presentation replays for every canonical mode', () => {
	const item = map.items.find((candidate) => candidate.id === 33);
	assert(item);
	const expectedScenarios = ['base', 'deep_access', 'blackout'].flatMap((modeId) =>
		Array.from(
			{ length: 5 },
			(_, index) => `replay-matrix-rules-${modeId}-${String(index + 1).padStart(2, '0')}`,
		),
	);
	assert.equal(item.status, 'AUTOMATED_PASS_MANUAL_OPEN');
	assert.deepEqual(item.browserScenarios, expectedScenarios);
	assert.match(item.manualOpen, /Human visual sign-off/u);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /getGeneratedFixture\(`\$\{modeId\}_win_\$\{ordinal\}`\)/u);
	assert.match(
		browserQa,
		/every cluster position, symbol, paytable band and multiplier matches Game Rules/u,
	);
});

test('feature evidence binds natural and purchased live lifecycles while human review remains open', () => {
	const item = map.items.find((candidate) => candidate.id === 21);
	assert(item);
	assert.equal(item.status, 'AUTOMATED_PASS_MANUAL_OPEN');
	assert.deepEqual(item.browserScenarios, [
		'authoritative-blackout-vault-transition',
		'live-natural-base-blackout-enters-and-returns',
		'live-deep-access-feature-confirms-enters-and-returns',
		'social-xsc-rules-paytable-and-terminology',
	]);
	assert.match(item.manualOpen, /Human comparison/u);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /fixtureId: 'base_natural_blackout'/u);
	assert.match(browserQa, /fixtureId: 'deep_access_feature'/u);
	for (const scenario of item.browserScenarios) {
		assert.match(
			browserQa,
			new RegExp(`(?:runScenario\\('${scenario}'|scenario: '${scenario}')`, 'u'),
		);
	}
});

test('Social Replay evidence covers loss, win, feature, and max-win surfaces', () => {
	const item = map.items.find((candidate) => candidate.id === 38);
	assert(item);
	assert.equal(item.status, 'AUTOMATED_PASS_MANUAL_OPEN');
	assert.deepEqual(item.browserScenarios, [
		'social-replay-dom-aria-restricted-scan',
		'social-replay-outcome-loss',
		'social-replay-outcome-win',
		'social-replay-outcome-feature',
		'social-replay-outcome-max-win',
	]);
	assert.match(item.manualOpen, /Final loss, win, feature, and max-win Replay surface sign-off/u);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	for (const source of [
		"{ caseId: 'loss', fixture: BASE_ZERO_FIXTURE, expectedClass: 'loss' }",
		"{ caseId: 'win', fixture: getGeneratedFixture('base_small'), expectedClass: 'win' }",
		"{ caseId: 'feature', fixture: getGeneratedFixture('deep_access_small'), expectedClass: 'feature' }",
		"{ caseId: 'max-win', fixture: getGeneratedFixture('base_max_win'), expectedClass: 'max-win' }",
	]) {
		assert(browserQa.includes(source));
	}
	assert.match(browserQa, /Social Replay outcome ready surface has zero restricted hits/u);
	assert.match(browserQa, /Social Replay outcome completed surface has zero restricted hits/u);
	assert.match(browserQa, /Social Replay feature case uses a complete canonical feature lifecycle/u);
	assert.match(browserQa, /Social Replay outcome sends zero wallet\/event writes/u);
	assert.match(browserQa, /Social Replay outcome fetches exactly once/u);
});

test('candidate evidence fails closed when a referenced browser scenario is absent', () => {
	const value = fixture();
	try {
		value.browserEvidence.scenarios = value.browserEvidence.scenarios.filter(
			(scenario) => scenario.name !== 'live-auth-exact',
		);
		value.browserEvidence.summary.scenarios -= 1;
		value.browserEvidence.summary.passedScenarios -= 1;
		writeJson(value.browserEvidencePath, value.browserEvidence);
		assert.throws(() => buildComplianceEvidence(value), /Requirement 1.*live-auth-exact/u);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});
