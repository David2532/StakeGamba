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
