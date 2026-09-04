import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildComplianceEvidence } from '../../../scripts/blacksite-compliance-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const complianceScriptPath = join(repoRoot, 'scripts', 'blacksite-compliance-evidence.mjs');
const requirementsPath = join(repoRoot, 'docs', 'blacksite', 'STAKE_REQUIREMENTS_51.md');
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

function fileFact(path) {
	const bytes = readFileSync(path);
	return {
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
	};
}

function browserSummary(browserEvidence) {
	return {
		pass: browserEvidence.checks.filter((check) => check.status === 'PASS').length,
		fail: browserEvidence.checks.filter((check) => check.status === 'FAIL').length,
		scenarios: browserEvidence.scenarios.length,
		passedScenarios: browserEvidence.scenarios.filter((scenario) => scenario.status === 'PASS')
			.length,
		failedScenarios: browserEvidence.scenarios.filter((scenario) => scenario.status === 'FAIL')
			.length,
	};
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blacksite-compliance-'));
	const candidateRoot = join(root, 'candidate');
	mkdirSync(candidateRoot);
	const candidateManifestPath = join(candidateRoot, 'candidate-manifest.json');
	const packageVerificationPath = join(candidateRoot, 'package-verification.json');
	const evidenceMapPath = join(root, 'release-evidence-map.json');
	writeJson(evidenceMapPath, map);
	writeJson(candidateManifestPath, {
		schema: 'blacksite-upload-candidate-v1',
		lifecycle: 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY',
		approvalStatus: 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN',
		uploadAuthorized: false,
		git: { sha: gitSha },
		packages: {
			frontend: { treeSha256: frontendTreeSha256 },
			math: { treeSha256: mathTreeSha256 },
		},
		mathEvidence: {
			candidateFingerprintSha256: mathFingerprintSha256,
			gatesPassed: 90,
			gatesTotal: 90,
		},
	});
	writeJson(packageVerificationPath, {
		schema: 'blacksite-upload-candidate-verification-v1',
		result: 'PASS',
		gitSha,
		frontend: { treeSha256: frontendTreeSha256 },
		math: { treeSha256: mathTreeSha256 },
		claims: {
			uploadPayloadStructureAndIdentity: 'PASS',
			bookLookupIdAndPayoutMatch: 'PASS',
			stakeApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	});
	const scenarioNames = [...new Set(map.items.flatMap((item) => item.browserScenarios ?? []))];
	const browserChecks = [
		...new Map(
			map.items
				.flatMap((item) => item.browserChecks ?? [])
				.map((check) => [JSON.stringify([check.group, check.name]), check]),
		).values(),
	];
	const browserEvidencePath = join(root, 'browser.json');
	const browserEvidence = {
		identity: {
			testedGitSha: gitSha,
			buildTreeSha256: frontendTreeSha256,
			expectedBuildTreeSha256: frontendTreeSha256,
			sourceTreeSha256: '5'.repeat(64),
		},
		scenarios: scenarioNames.map((name) => ({ name, status: 'PASS' })),
		checks: browserChecks.map((check) => ({ ...check, occurrence: 1, status: 'PASS' })),
	};
	browserEvidence.summary = browserSummary(browserEvidence);
	writeJson(browserEvidencePath, browserEvidence);
	return {
		root,
		candidateRoot,
		candidateManifestPath,
		packageVerificationPath,
		browserEvidencePath,
		browserEvidence,
		evidenceMapPath,
	};
}

test('51-point candidate evidence is complete, identity-bound, and keeps open gates explicit', () => {
	const value = fixture();
	try {
		const evidence = buildComplianceEvidence(value);
		assert.equal(evidence.schema, 'blacksite-stake-51-candidate-evidence-v3');
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
		assert.equal(evidence.summary.repositoryEvidenceResolved, 40);
		assert.deepEqual(evidence.summary.externalOpenWithRepositoryEvidence, [45, 46]);
		assert.equal(evidence.claims.matrixCompleteness, 'PASS');
		assert.equal(evidence.claims.repositoryReferencesResolved, 'PASS');
		assert.equal(evidence.claims.inputByteIdentityRecorded, 'PASS');
		assert.equal(evidence.claims.manualEvidence, 'NOT_CLAIMED');
		assert.equal(evidence.claims.externalApproval, 'NOT_CLAIMED');
		assert.equal(evidence.claims.releaseReadiness, 'NOT_CLAIMED');
		assert.equal(evidence.candidate.gitSha, gitSha);
		assert.equal(evidence.candidate.frontendTreeSha256, frontendTreeSha256);
		assert.equal(evidence.candidate.mathTreeSha256, mathTreeSha256);
		assert.deepEqual(
			{
				path: evidence.inputs.requirementsChecklist.path,
				bytes: evidence.inputs.requirementsChecklist.bytes,
				sha256: evidence.inputs.requirementsChecklist.sha256,
			},
			{
				path: 'docs/blacksite/STAKE_REQUIREMENTS_51.md',
				...fileFact(requirementsPath),
			},
		);
		assert.deepEqual(
			{
				bytes: evidence.inputs.sourceMap.bytes,
				sha256: evidence.inputs.sourceMap.sha256,
			},
			fileFact(value.evidenceMapPath),
		);
		assert.deepEqual(
			{
				bytes: evidence.inputs.candidateManifest.bytes,
				sha256: evidence.inputs.candidateManifest.sha256,
			},
			fileFact(value.candidateManifestPath),
		);
		assert.deepEqual(
			{
				bytes: evidence.inputs.packageVerification.bytes,
				sha256: evidence.inputs.packageVerification.sha256,
			},
			fileFact(value.packageVerificationPath),
		);
		assert.deepEqual(
			{
				bytes: evidence.inputs.browserEvidence.bytes,
				sha256: evidence.inputs.browserEvidence.sha256,
			},
			fileFact(value.browserEvidencePath),
		);
		assert.deepEqual(evidence.inputs.browserEvidence.summary, value.browserEvidence.summary);

		const templateItem = evidence.items.find((item) => item.id === 45);
		const replayEnablementItem = evidence.items.find((item) => item.id === 46);
		assert.equal(templateItem.status, 'EXTERNAL_OPEN');
		assert.equal(templateItem.repositoryEvidence.claim, 'PARTIAL_REPOSITORY_PROOF');
		assert.deepEqual(templateItem.repositoryEvidence.candidatePackageReceipts, [
			{
				receipt: 'candidateManifest',
				claim: 'allMathVerificationGates',
				status: 'PASS',
				sourceSha256: evidence.inputs.candidateManifest.sha256,
			},
		]);
		assert.equal(replayEnablementItem.status, 'EXTERNAL_OPEN');
		assert.equal(replayEnablementItem.repositoryEvidence.claim, 'PARTIAL_REPOSITORY_PROOF');
		assert.deepEqual(replayEnablementItem.repositoryEvidence.browserScenarios, [
			{ name: 'replay-read-only-play-again', status: 'PASS' },
		]);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('candidate evidence pins every row lifecycle class against manual or external relabeling', () => {
	const attacks = [
		{ id: 5, from: 'MANUAL_OPEN', remove: 'manualOpen' },
		{ id: 17, from: 'AUTOMATED_PASS_MANUAL_OPEN', remove: 'manualOpen' },
		{ id: 47, from: 'EXTERNAL_OPEN', remove: 'externalOpen' },
	];
	for (const attack of attacks) {
		const value = fixture();
		try {
			const attackedMap = structuredClone(map);
			const item = attackedMap.items.find((candidate) => candidate.id === attack.id);
			assert(item);
			assert.equal(item.status, attack.from);
			item.status = 'AUTOMATED_PASS';
			delete item[attack.remove];
			item.browserScenarios = ['live-auth-exact'];
			writeJson(value.evidenceMapPath, attackedMap);
			assert.throws(
				() => buildComplianceEvidence(value),
				new RegExp(
					`Requirement ${attack.id} status must remain ${attack.from} under the canonical 51-point policy`,
					'u',
				),
			);
		} finally {
			rmSync(value.root, { recursive: true, force: true });
		}
	}
});

test('candidate evidence binds the exact canonical checklist path and bytes', () => {
	const alternateSource = fixture();
	try {
		const attackedMap = structuredClone(map);
		attackedMap.source = 'docs/blacksite/LOOKALIKE_REQUIREMENTS_51.md';
		writeJson(alternateSource.evidenceMapPath, attackedMap);
		assert.throws(
			() => buildComplianceEvidence(alternateSource),
			/Evidence map source must be exactly docs\/blacksite\/STAKE_REQUIREMENTS_51\.md/u,
		);
	} finally {
		rmSync(alternateSource.root, { recursive: true, force: true });
	}

	const tamperedDigest = fixture();
	try {
		const attackedMap = structuredClone(map);
		attackedMap.sourceSha256 = '0'.repeat(64);
		writeJson(tamperedDigest.evidenceMapPath, attackedMap);
		assert.throws(
			() => buildComplianceEvidence(tamperedDigest),
			/Evidence map sourceSha256 does not match the canonical checklist bytes/u,
		);
	} finally {
		rmSync(tamperedDigest.root, { recursive: true, force: true });
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
		'jurisdiction-enforces-turbo-slamstop-and-optional-rtp-hud',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /runScenario\('conflicting-auth-step-aliases-fail-closed'/u);
	assert.match(browserQa, /conflicting step aliases expose the exact fail-closed contract error/u);
	assert.match(
		browserQa,
		/conflicting step aliases authenticate once and send zero wallet or event writes/u,
	);
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
	assert.match(browserQa, new RegExp(`runScenario\\(\\s*'${scenario}'`, 'u'));
	assert.match(browserQa, /expired session never retries the rejected play automatically/u);
	assert.match(browserQa, /reauthentication alone never resubmits the rejected paid action/u);
	assert.match(browserQa, /a new deliberate action succeeds once after reauthentication/u);
	assert.match(
		browserQa,
		/serialize\(network\.order\)\s*===\s*serialize\(\[\s*'authenticate',\s*'play',\s*'authenticate',\s*'play',?\s*\]\)/u,
	);
});

test('launch timeout evidence binds an abort-driven browser recovery without wallet writes', () => {
	const item = map.items.find((candidate) => candidate.id === 2);
	assert(item);
	const scenario = 'recoverable-auth-timeout-reloads-and-recovers';
	assert(item.browserScenarios.includes(scenario));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	assert.match(browserQa, /browser transport observes the app-owned timeout abort/u);
	assert.match(
		browserQa,
		/timeout recovery performs one successful authenticate and zero wallet writes/u,
	);
});

test('navigation teardown evidence binds transport cancellation without wallet writes', () => {
	const item = map.items.find((candidate) => candidate.id === 2);
	assert(item);
	const scenario = 'navigation-teardown-aborts-auth-without-wallet-write';
	assert(item.browserScenarios.includes(scenario));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	const pageSource = readFileSync(join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'), 'utf8');
	assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	assert.match(browserQa, /navigation teardown aborts the pending app-owned RGS transport/u);
	assert.match(
		browserQa,
		/teardown recovery performs one successful authenticate and zero wallet writes/u,
	);
	assert.match(pageSource, /window\.addEventListener\('pagehide', destroyLiveSession\)/u);
	assert.match(pageSource, /window\.removeEventListener\('pagehide', destroyLiveSession\)/u);
});

test('Replay navigation teardown evidence binds read cancellation without wallet writes', () => {
	const item = map.items.find((candidate) => candidate.id === 40);
	assert(item);
	const scenario = 'replay-navigation-teardown-aborts-read-only-load';
	assert(item.browserScenarios.includes(scenario));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	const pageSource = readFileSync(join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'), 'utf8');
	assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	assert.match(browserQa, /navigation teardown aborts the pending app-owned Replay transport/u);
	assert.match(
		browserQa,
		/Replay teardown recovery performs one exact GET and zero wallet writes/u,
	);
	assert.match(pageSource, /window\.addEventListener\('pagehide', destroyReplaySession\)/u);
	assert.match(pageSource, /window\.removeEventListener\('pagehide', destroyReplaySession\)/u);
});

test('mute evidence proves active voice and ambience gain nodes leave no orphan graph edges', () => {
	const item = map.items.find((candidate) => candidate.id === 30);
	assert(item);
	const scenario = 'audio-policy-cues-mute-and-persistence';
	assert(item.browserScenarios.includes(scenario));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	assert.match(
		browserQa,
		/mute disconnects the active voice gain and ambience gain without orphan graph edges/u,
	);
});

test('active-round evidence binds uncertain play and failed-settlement recovery', () => {
	const item = map.items.find((candidate) => candidate.id === 10);
	assert(item);
	assert.deepEqual(item.browserScenarios, [
		'active-restore-no-duplicate-play',
		'active-feature-restore-resumes-at-checkpoint-once',
		'uncertain-live-play-reloads-and-restores-without-retry',
		'accepted-winning-play-response-loss-restores-and-pays-exactly-once',
		'accepted-checkpoint-response-loss-restores-without-rewrite',
		'accepted-winning-checkpoint-response-loss-restores-and-pays-exactly-once',
		'settlement-http-503-reloads-and-restores-exactly-once',
		'accepted-settlement-response-loss-reauthenticates-without-retry',
		'accepted-winning-settlement-response-loss-prevents-double-payout',
		'settlement-session-expiry-reauthenticates-and-settles-once',
	]);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	for (const scenario of item.browserScenarios) {
		assert.match(browserQa, new RegExp(`runScenario\\(\\s*'${scenario}'`, 'u'));
	}
	assert.match(browserQa, /never retried automatically/u);
	assert.match(
		browserQa,
		/accepted winning play response loss aborts the pending client transport on reload/u,
	);
	assert.match(
		browserQa,
		/accepted winning play response loss reports exactly the intentionally aborted paid transport/u,
	);
	assert.match(browserQa, /expectedAbortedRequests\[0\]\?\.error === 'net::ERR_ABORTED'/u);
	assert.match(browserQa, /accepted winning play response loss never sends a duplicate paid play/u);
	assert.match(
		browserQa,
		/accepted winning play recovery persists each checkpoint exactly once in order/u,
	);
	assert.match(browserQa, /accepted winning play response loss restores and pays exactly once/u);
	assert.match(
		browserQa,
		/accepted checkpoint response loss aborts only the pending client transport/u,
	);
	assert.match(browserQa, /accepted checkpoint is not rewritten after authoritative restore/u);
	assert.match(browserQa, /accepted checkpoint recovery order is authoritative and exact/u);
	assert.match(
		browserQa,
		/accepted winning checkpoint is never rewritten after authoritative restore/u,
	);
	assert.match(
		browserQa,
		/accepted winning checkpoint recovery persists every remaining cursor exactly once/u,
	);
	assert.match(
		browserQa,
		/accepted winning checkpoint recovery pays the authoritative result exactly once/u,
	);
	assert.match(browserQa, /const acceptedCursor = expectedCheckpointCursors\[0\]/u);
	assert.match(
		browserQa,
		/const expectedRemainingCursors = expectedCheckpointCursors\.slice\(1\)/u,
	);
	assert.match(
		browserQa,
		/const playRound = authoritativeFixtureRound\(\{[\s\S]*?active: true,[\s\S]*?\}\);/u,
	);
	assert.match(browserQa, /round: playRound/u);
	assert(
		browserQa.includes(
			'expectedAbortedRequests[0]?.url === `${BLACKSITE_QA_RGS_ORIGIN}/bet/event`',
		),
	);
	assert.match(browserQa, /exactly one new settlement attempt/u);
	assert.match(
		browserQa,
		/accepted settlement response loss aborts only the pending client transport/u,
	);
	assert.match(browserQa, /accepted settlement response loss never sends a duplicate end-round/u);
	assert.match(browserQa, /accepted settlement recovery order is authoritative and exact/u);
	assert.match(
		browserQa,
		/accepted winning settlement response loss never retries payout settlement/u,
	);
	assert.match(
		browserQa,
		/accepted winning settlement recovery adopts the one-time authoritative payout balance/u,
	);
	assert(
		browserQa.includes(
			'expectedAbortedRequests[0]?.url === `${BLACKSITE_QA_RGS_ORIGIN}/wallet/end-round`',
		),
	);
	assert.match(
		browserQa,
		/expired settlement session never retries authentication or settlement automatically/u,
	);
	assert.match(
		browserQa,
		/reauthenticated settlement performs exactly one new completion attempt/u,
	);
	assert.match(
		browserQa,
		/event-driven trace observes the primed feature checkpoint without polling a transient state/u,
	);
	assert.match(
		browserQa,
		/restore persists each remaining durable checkpoint exactly once in order/u,
	);
	assert.match(browserQa, /network\.byEndpoint\.authenticate\[0\]/u);
	assert.match(
		browserQa,
		/serialize\(network\.order\)\s*===\s*serialize\(\[\s*'authenticate',\s*'play',\s*'event',\s*'endRound',\s*'authenticate',\s*'endRound',?\s*\]\)/u,
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
	assert.match(
		browserQa,
		/explicit ERR_IPB reload restores and completes the authoritative active round/u,
	);
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

test('Play Again evidence proves repeated cached playback drains browser timers', () => {
	const item = map.items.find((candidate) => candidate.id === 42);
	assert(item);
	assert.equal(item.status, 'AUTOMATED_PASS');
	assert(item.browserScenarios.includes('replay-repeated-play-again-drains-timers'));
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /const REPLAY_LIFECYCLE_CYCLES = 6;/u);
	assert.match(browserQa, /every repeated Replay returns to the exact authoritative presentation/u);
	assert.match(browserQa, /repeated Replay playback drains every presentation timeout/u);
	assert.match(browserQa, /six cached Replay cycles perform one read and zero wallet writes/u);
});

test('feature evidence binds natural, purchased, and active-skip live lifecycles while human review remains open', () => {
	const item = map.items.find((candidate) => candidate.id === 21);
	assert(item);
	assert.equal(item.status, 'AUTOMATED_PASS_MANUAL_OPEN');
	assert.deepEqual(item.browserScenarios, [
		'blackout-hero-timing-normal-and-turbo',
		'authoritative-blackout-vault-transition',
		'live-natural-base-blackout-enters-and-returns',
		'live-deep-access-feature-confirms-enters-and-returns',
		'active-feature-skip-persists-and-settles-once',
		'social-xsc-rules-paytable-and-terminology',
	]);
	assert.match(item.manualOpen, /Human comparison/u);
	const browserQa = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(browserQa, /fixtureId: 'base_natural_blackout'/u);
	assert.match(browserQa, /fixtureId: 'deep_access_feature'/u);
	assert.match(
		browserQa,
		/Skip drains an active feature through every durable checkpoint and exactly one settlement/u,
	);
	assert.match(
		browserQa,
		/active feature Skip never duplicates play, checkpoint, or settlement writes/u,
	);
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
	for (const sourcePattern of [
		/\{\s*caseId:\s*'loss',\s*fixture:\s*BASE_ZERO_FIXTURE,\s*expectedClass:\s*'loss',?\s*\}/u,
		/\{\s*caseId:\s*'win',\s*fixture:\s*getGeneratedFixture\('base_small'\),\s*expectedClass:\s*'win',?\s*\}/u,
		/\{\s*caseId:\s*'feature',\s*fixture:\s*getGeneratedFixture\('deep_access_small'\),\s*expectedClass:\s*'feature',?\s*\}/u,
		/\{\s*caseId:\s*'max-win',\s*fixture:\s*getGeneratedFixture\('base_max_win'\),\s*expectedClass:\s*'max-win',?\s*\}/u,
	]) {
		assert.match(browserQa, sourcePattern);
	}
	assert.match(browserQa, /Social Replay outcome ready surface has zero restricted hits/u);
	assert.match(browserQa, /Social Replay outcome completed surface has zero restricted hits/u);
	assert.match(
		browserQa,
		/Social Replay feature case uses a complete canonical feature lifecycle/u,
	);
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

test('candidate evidence rejects duplicate browser scenario and check identities', () => {
	const scenarioValue = fixture();
	try {
		scenarioValue.browserEvidence.scenarios.push({
			...scenarioValue.browserEvidence.scenarios[0],
		});
		scenarioValue.browserEvidence.summary = browserSummary(scenarioValue.browserEvidence);
		writeJson(scenarioValue.browserEvidencePath, scenarioValue.browserEvidence);
		assert.throws(
			() => buildComplianceEvidence(scenarioValue),
			/Browser scenario identities must be unique/u,
		);
	} finally {
		rmSync(scenarioValue.root, { recursive: true, force: true });
	}

	const checkValue = fixture();
	try {
		checkValue.browserEvidence.checks.push({ ...checkValue.browserEvidence.checks[0] });
		checkValue.browserEvidence.summary = browserSummary(checkValue.browserEvidence);
		writeJson(checkValue.browserEvidencePath, checkValue.browserEvidence);
		assert.throws(
			() => buildComplianceEvidence(checkValue),
			/Browser check identities must be unique/u,
		);
	} finally {
		rmSync(checkValue.root, { recursive: true, force: true });
	}

	const repeatedCheckValue = fixture();
	try {
		const firstCheck = repeatedCheckValue.browserEvidence.checks[0];
		repeatedCheckValue.browserEvidence.checks.push({ ...firstCheck, occurrence: 2 });
		repeatedCheckValue.browserEvidence.summary = browserSummary(repeatedCheckValue.browserEvidence);
		writeJson(repeatedCheckValue.browserEvidencePath, repeatedCheckValue.browserEvidence);
		const evidence = buildComplianceEvidence(repeatedCheckValue);
		assert.deepEqual(
			evidence.items.find((item) => item.id === 4).repositoryEvidence.browserChecks,
			[
				{
					group: firstCheck.group,
					name: firstCheck.name,
					status: 'PASS',
					matches: [
						{ occurrence: 1, status: 'PASS' },
						{ occurrence: 2, status: 'PASS' },
					],
				},
			],
		);
	} finally {
		rmSync(repeatedCheckValue.root, { recursive: true, force: true });
	}
});

test('candidate evidence recomputes browser counts and rejects a mismatched summary', () => {
	const value = fixture();
	try {
		value.browserEvidence.summary.pass += 1;
		writeJson(value.browserEvidencePath, value.browserEvidence);
		assert.throws(
			() => buildComplianceEvidence(value),
			/Browser evidence summary pass does not match recomputed value/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('repository gates must be structured supported receipts and resolve from candidate bytes', () => {
	const decorativeValue = fixture();
	try {
		const decorativeMap = structuredClone(map);
		decorativeMap.items.find((item) => item.id === 18).repositoryGates = [
			'pnpm --filter blacksite test',
		];
		writeJson(decorativeValue.evidenceMapPath, decorativeMap);
		assert.throws(
			() => buildComplianceEvidence(decorativeValue),
			/Requirement 18 repository gates must be structured candidate\/package receipts/u,
		);
	} finally {
		rmSync(decorativeValue.root, { recursive: true, force: true });
	}

	const unrelatedReceiptValue = fixture();
	try {
		const unrelatedReceiptMap = structuredClone(map);
		unrelatedReceiptMap.items.find((item) => item.id === 45).repositoryGates = [
			{
				receipt: 'packageVerification',
				claim: 'bookLookupIdAndPayoutMatch',
			},
		];
		writeJson(unrelatedReceiptValue.evidenceMapPath, unrelatedReceiptMap);
		assert.throws(
			() => buildComplianceEvidence(unrelatedReceiptValue),
			/Requirement 45 names an unsupported repository receipt for this row/u,
		);
	} finally {
		rmSync(unrelatedReceiptValue.root, { recursive: true, force: true });
	}

	const unresolvedPackageValue = fixture();
	try {
		const verification = JSON.parse(
			readFileSync(unresolvedPackageValue.packageVerificationPath, 'utf8'),
		);
		verification.claims.bookLookupIdAndPayoutMatch = 'NOT_CLAIMED';
		writeJson(unresolvedPackageValue.packageVerificationPath, verification);
		assert.throws(
			() => buildComplianceEvidence(unresolvedPackageValue),
			/Requirement 18 has unresolved repository evidence: packageVerification:bookLookupIdAndPayoutMatch/u,
		);
	} finally {
		rmSync(unresolvedPackageValue.root, { recursive: true, force: true });
	}

	const unresolvedMathValue = fixture();
	try {
		const manifest = JSON.parse(readFileSync(unresolvedMathValue.candidateManifestPath, 'utf8'));
		manifest.mathEvidence.gatesPassed -= 1;
		writeJson(unresolvedMathValue.candidateManifestPath, manifest);
		assert.throws(
			() => buildComplianceEvidence(unresolvedMathValue),
			/Requirement 45 has unresolved repository evidence: candidateManifest:allMathVerificationGates/u,
		);
	} finally {
		rmSync(unresolvedMathValue.root, { recursive: true, force: true });
	}
});

test('compliance CLI cannot overwrite or write inside candidate/browser inputs', () => {
	const value = fixture();
	const outputRoot = mkdtempSync(join(tmpdir(), 'blacksite-compliance-output-'));
	try {
		const originalManifest = readFileSync(value.candidateManifestPath);
		const collision = spawnSync(
			process.execPath,
			[
				complianceScriptPath,
				'--candidate',
				value.candidateRoot,
				'--browser-evidence',
				value.browserEvidencePath,
				'--output',
				value.candidateManifestPath,
			],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		assert.notEqual(collision.status, 0);
		assert.match(collision.stderr, /Output already exists; refusing to overwrite/u);
		assert(readFileSync(value.candidateManifestPath).equals(originalManifest));

		const contained = spawnSync(
			process.execPath,
			[
				complianceScriptPath,
				'--candidate',
				value.candidateRoot,
				'--browser-evidence',
				value.browserEvidencePath,
				'--output',
				join(value.candidateRoot, 'new-compliance.json'),
			],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		assert.notEqual(contained.status, 0);
		assert.match(contained.stderr, /contained by the candidate input/u);

		const outputPath = join(outputRoot, 'compliance.json');
		const success = spawnSync(
			process.execPath,
			[
				complianceScriptPath,
				'--candidate',
				value.candidateRoot,
				'--browser-evidence',
				value.browserEvidencePath,
				'--output',
				outputPath,
			],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		assert.equal(success.status, 0, success.stderr);
		const report = JSON.parse(success.stdout);
		assert.equal(report.status, 'STRUCTURALLY_VALID');
		assert.equal(report.scope, 'EXACT_REPOSITORY_REFERENCE_RESOLUTION');
		assert.equal(report.result, undefined);
		assert.equal(report.manualAndExternalEvidence, 'NOT_CLAIMED');
		assert.equal(
			JSON.parse(readFileSync(outputPath, 'utf8')).schema,
			'blacksite-stake-51-candidate-evidence-v3',
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
		rmSync(outputRoot, { recursive: true, force: true });
	}
});
