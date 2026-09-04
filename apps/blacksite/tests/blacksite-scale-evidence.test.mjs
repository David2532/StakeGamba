import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	SCALE_ARTIFACT_BINDING_SCHEMA,
	SCALE_EVIDENCE_SCHEMA,
	createScaleArtifactAttestation,
	createScaleArtifactProof,
	createScaleNormalizedSource,
	createScaleSourceReport,
	createScaleTrustStore,
	createSelfTestEvidence,
	verifyScaleEvidence,
	verifyScaleEvidenceArtifacts,
} from '../../../scripts/blacksite-scale-evidence.mjs';

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function signerFixture(evidence) {
	const definitions = [
		[evidence.approval.workloadOwner, ['load-report']],
		[evidence.approval.providerOwner, ['provider-ledger', 'resilience-report']],
		[evidence.approval.platformOwner, ['cdn-report', 'observability-export', 'rollback-report']],
	];
	const privateKeys = new Map();
	const signers = definitions.map(([id, roles]) => {
		const { privateKey, publicKey } = generateKeyPairSync('ed25519');
		privateKeys.set(id, privateKey);
		return { id, roles, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) };
	});
	return { privateKeys, trustStore: createScaleTrustStore(evidence, signers) };
}

function signerForRole(evidence, role) {
	if (role === 'load-report') return evidence.approval.workloadOwner;
	if (role === 'provider-ledger' || role === 'resilience-report')
		return evidence.approval.providerOwner;
	return evidence.approval.platformOwner;
}

function writeSignedArtifacts(evidence, directory, privateKeys, signedAt) {
	mkdirSync(join(directory, 'raw'), { recursive: true });
	for (const artifact of evidence.artifacts) {
		const rawName = `raw/${artifact.role}.source.json`;
		const kindByRole = {
			'load-report': 'load-generator-export',
			'cdn-report': 'cdn-telemetry-export',
			'provider-ledger': 'provider-idempotency-ledger',
			'resilience-report': 'fault-injection-export',
			'observability-export': 'observability-export',
			'rollback-report': 'rollback-rehearsal-export',
		};
		const kind = kindByRole[artifact.role];
		const rawContent = `${JSON.stringify(
			createScaleNormalizedSource(evidence, artifact.role, {
				sourceSystem: 'test-source-system',
				sourceVersion: '1',
				exportId: `${evidence.run.id}:${artifact.role}`,
				capturedAt: evidence.run.completedAt,
			}),
		)}\n`;
		writeFileSync(join(directory, rawName), rawContent, 'utf8');
		const unsignedReport = {
			...createScaleArtifactProof(evidence, artifact.role),
			blacksiteScaleSourceReport: createScaleSourceReport(
				evidence,
				artifact.role,
				[
					{
						kind,
						name: rawName,
						mediaType: 'application/json',
						bytes: Buffer.byteLength(rawContent),
						sha256: createHash('sha256').update(rawContent).digest('hex'),
					},
				],
				{
					generatedAt: evidence.run.completedAt,
					generatorName: 'test-report-generator',
					generatorVersion: '1',
				},
			),
			report: { source: 'test' },
		};
		const signerId = signerForRole(evidence, artifact.role);
		const content = `${JSON.stringify({
			...unsignedReport,
			blacksiteScaleAttestation: createScaleArtifactAttestation(
				evidence,
				artifact.role,
				unsignedReport,
				{
					signerId,
					privateKey: privateKeys.get(signerId),
					...(signedAt ? { signedAt } : {}),
				},
			),
		})}\n`;
		writeFileSync(join(directory, artifact.name), content, 'utf8');
		artifact.bytes = Buffer.byteLength(content);
		artifact.sha256 = createHash('sha256').update(content).digest('hex');
	}
}

test('scale evidence binds exact client and external release identity', () => {
	const evidence = createSelfTestEvidence();
	const result = verifyScaleEvidence(evidence, {
		gitSha: evidence.identity.gitSha,
		frontendTreeSha256: evidence.identity.frontendTreeSha256,
		mathTreeSha256: evidence.identity.mathTreeSha256,
	});
	assert.equal(result.schema, SCALE_EVIDENCE_SCHEMA);
	assert.equal(result.status, 'STRUCTURALLY_VALID');
	assert.equal(result.claim, 'SUPPLIED_SCALE_METADATA_SCHEMA_AND_CONSISTENCY_VALIDATED');
	assert.equal(result.achievedWorkload.rps, 25_000);
});

test('scale evidence requires immutable external release and configuration digests', () => {
	for (const key of [
		'mathTreeSha256',
		'providerReleaseSha256',
		'cdnReleaseSha256',
		'rgsReleaseSha256',
		'environmentConfigSha256',
	]) {
		const evidence = createSelfTestEvidence();
		evidence.identity[key] = 'latest';
		assert.throws(() => verifyScaleEvidence(evidence), new RegExp(key, 'u'));
	}

	const evidence = createSelfTestEvidence();
	assert.throws(
		() => verifyScaleEvidence(evidence, { mathTreeSha256: '0'.repeat(64) }),
		/identity\.mathTreeSha256 mismatch/u,
	);
});

test('scale evidence rejects mocked or non-production-equivalent targets', () => {
	const evidence = createSelfTestEvidence();
	evidence.environment.mocked = true;
	assert.throws(() => verifyScaleEvidence(evidence), /mocked environment/u);
	evidence.environment.mocked = false;
	evidence.environment.productionEquivalent = false;
	assert.throws(() => verifyScaleEvidence(evidence), /production-equivalent/u);
});

test('scale evidence distinguishes planning population from achieved concurrency and rate', () => {
	const evidence = createSelfTestEvidence();
	evidence.workload.achievedPeakConcurrentUsers -= 1;
	assert.throws(() => verifyScaleEvidence(evidence), /peak concurrency/u);
	const rateEvidence = createSelfTestEvidence();
	rateEvidence.workload.rateMeasurement.endpointRequests = Object.fromEntries(
		Object.keys(rateEvidence.workload.rateMeasurement.endpointRequests).map((name) => [name, 1]),
	);
	rateEvidence.workload.rateMeasurement.minimumEndpointRequests = Object.fromEntries(
		Object.keys(rateEvidence.workload.rateMeasurement.minimumEndpointRequests).map((name) => [
			name,
			1,
		]),
	);
	assert.throws(() => verifyScaleEvidence(rateEvidence), /request rate/u);

	const shortWindow = createSelfTestEvidence();
	shortWindow.workload.rateMeasurement.completedAt = new Date(
		Date.parse(shortWindow.workload.rateMeasurement.completedAt) - 1_000,
	).toISOString();
	assert.throws(() => verifyScaleEvidence(shortWindow), /approved windowSeconds/u);

	const starvedEndpoint = createSelfTestEvidence();
	starvedEndpoint.workload.rateMeasurement.endpointRequests.play =
		starvedEndpoint.workload.rateMeasurement.minimumEndpointRequests.play - 1;
	assert.throws(() => verifyScaleEvidence(starvedEndpoint), /below the approved minimum/u);
});

test('scale evidence rejects impossible CDN and inconsistent provider-ledger counters', () => {
	const impossibleCdn = createSelfTestEvidence();
	impossibleCdn.cdn.requests = 1;
	impossibleCdn.cdn.cacheableRequests = 1_000_000_000;
	impossibleCdn.cdn.cacheHits = 900_000_000;
	impossibleCdn.cdn.originRequests = 0;
	assert.throws(() => verifyScaleEvidence(impossibleCdn), /cacheableRequests exceeds requests/u);

	const fractionalCdn = createSelfTestEvidence();
	fractionalCdn.cdn.requests = 0.5;
	assert.throws(() => verifyScaleEvidence(fractionalCdn), /safe integer/u);

	const fractionalLedger = createSelfTestEvidence();
	fractionalLedger.idempotency.paidPlayAttempts = 0.5;
	assert.throws(() => verifyScaleEvidence(fractionalLedger), /safe integer/u);

	const zeroUncertainRecoveries = createSelfTestEvidence();
	zeroUncertainRecoveries.idempotency.uncertainRecoveryCases = 0;
	assert.doesNotThrow(() => verifyScaleEvidence(zeroUncertainRecoveries));

	for (const invalid of [-1, 0.5]) {
		const invalidUncertainRecoveries = createSelfTestEvidence();
		invalidUncertainRecoveries.idempotency.uncertainRecoveryCases = invalid;
		assert.throws(
			() => verifyScaleEvidence(invalidUncertainRecoveries),
			/non-negative safe integer/u,
		);
	}

	const inconsistentLedger = createSelfTestEvidence();
	inconsistentLedger.idempotency.paidPlayAttempts -= 1;
	assert.throws(
		() => verifyScaleEvidence(inconsistentLedger),
		/must equal latency\.play\.requests/u,
	);
});

test('scale evidence fails on latency, cache and saturation breaches', () => {
	const latency = createSelfTestEvidence();
	latency.latency.play.p99Ms = latency.latency.play.limits.p99Ms + 1;
	assert.throws(() => verifyScaleEvidence(latency), /p99Ms exceeds/u);
	const cache = createSelfTestEvidence();
	cache.cdn.cacheHits = 0;
	assert.throws(() => verifyScaleEvidence(cache), /cache hit rate/u);
	const saturation = createSelfTestEvidence();
	saturation.saturation[0].maxObserved = saturation.saturation[0].limit + 1;
	assert.throws(() => verifyScaleEvidence(saturation), /exceeds approved limit/u);
});

test('scale evidence requires zero wallet and settlement integrity violations', () => {
	for (const key of [
		'duplicateAcceptedPaidPlays',
		'duplicateSettlements',
		'negativeBalances',
		'payoutMismatches',
		'uncertainRecoveryDuplicateWrites',
	]) {
		const evidence = createSelfTestEvidence();
		evidence.idempotency[key] = 1;
		assert.throws(() => verifyScaleEvidence(evidence), new RegExp(key, 'u'));
	}
});

test('scale evidence requires every resilience drill and bounded recovery', () => {
	const missing = createSelfTestEvidence();
	missing.resilience.scenarios.pop();
	assert.throws(() => verifyScaleEvidence(missing), /exact required set/u);
	const slow = createSelfTestEvidence();
	slow.resilience.scenarios[0].recoverySeconds = slow.resilience.scenarios[0].limitSeconds + 1;
	assert.throws(() => verifyScaleEvidence(slow), /exceeded recovery limit/u);

	const duplicate = createSelfTestEvidence();
	duplicate.resilience.scenarios.push({
		...duplicate.resilience.scenarios[0],
		executed: false,
		recovered: false,
		duplicateWrites: 1,
	});
	assert.throws(() => verifyScaleEvidence(duplicate), /exact required set|unique/u);
});

test('scale evidence requires unique named regions, saturation metrics and alert drills', () => {
	const unnamedRegion = createSelfTestEvidence();
	unnamedRegion.environment.regions = [null];
	assert.throws(() => verifyScaleEvidence(unnamedRegion), /environment\.regions entry/u);

	const duplicateSaturation = createSelfTestEvidence();
	duplicateSaturation.saturation.push({ ...duplicateSaturation.saturation[0] });
	assert.throws(
		() => verifyScaleEvidence(duplicateSaturation),
		/saturation metric names must contain unique/u,
	);

	const unnamedAlert = createSelfTestEvidence();
	unnamedAlert.observability.alertDrills = [{ fired: true, acknowledged: true }];
	assert.throws(() => verifyScaleEvidence(unnamedAlert), /alert drill names entry/u);
});

test('scale evidence requires correlated observability and exercised alerts', () => {
	const evidence = createSelfTestEvidence();
	evidence.observability.logsCorrelated = false;
	assert.throws(() => verifyScaleEvidence(evidence), /logsCorrelated/u);
	const alert = createSelfTestEvidence();
	alert.observability.alertDrills[0].acknowledged = false;
	assert.throws(() => verifyScaleEvidence(alert), /alert drills/u);
});

test('scale evidence requires a successful bounded rollback rehearsal', () => {
	const evidence = createSelfTestEvidence();
	evidence.rollback.healthyAfterRollback = false;
	assert.throws(() => verifyScaleEvidence(evidence), /restore health/u);
	const slow = createSelfTestEvidence();
	slow.rollback.recoverySeconds = slow.rollback.limitSeconds + 1;
	assert.throws(() => verifyScaleEvidence(slow), /rollback exceeded/u);
});

test('scale evidence artifact digests fail closed', () => {
	const evidence = createSelfTestEvidence();
	evidence.artifacts[0].sha256 = 'unbound';
	assert.throws(() => verifyScaleEvidence(evidence), /lowercase hexadecimal/u);
	const untouched = createSelfTestEvidence();
	assert.doesNotThrow(() => verifyScaleEvidence(clone(untouched)));
});

test('scale evidence binds approvals, phase duration, request totals and required artifact roles', () => {
	const lateApproval = createSelfTestEvidence();
	lateApproval.approval.approvedAt = new Date(
		Date.parse(lateApproval.run.startedAt) + 1_000,
	).toISOString();
	assert.throws(() => verifyScaleEvidence(lateApproval), /approved before the run/u);

	const shortRun = createSelfTestEvidence();
	shortRun.run.completedAt = new Date(Date.parse(shortRun.run.startedAt) + 3_600_000).toISOString();
	assert.throws(() => verifyScaleEvidence(shortRun), /phase duration/u);

	const requestMismatch = createSelfTestEvidence();
	requestMismatch.workload.measuredRequests -= 1;
	assert.throws(() => verifyScaleEvidence(requestMismatch), /measuredRequests/u);

	const duplicateArtifact = createSelfTestEvidence();
	duplicateArtifact.artifacts[5] = { ...duplicateArtifact.artifacts[0] };
	assert.throws(() => verifyScaleEvidence(duplicateArtifact), /unique/u);

	const missingArtifactRole = createSelfTestEvidence();
	missingArtifactRole.artifacts = missingArtifactRole.artifacts.filter(
		(artifact) => artifact.role !== 'rollback-report',
	);
	assert.throws(() => verifyScaleEvidence(missingArtifactRole), /exact required set/u);
});

test('scale evidence rejects future run completion and report attestations', async () => {
	const futureRun = createSelfTestEvidence();
	futureRun.approval.approvedAt = '9999-01-01T00:00:00.000Z';
	futureRun.run.startedAt = '9999-01-01T01:00:00.000Z';
	futureRun.run.completedAt = '9999-01-01T03:00:00.000Z';
	assert.throws(() => verifyScaleEvidence(futureRun), /future|verification time/u);

	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-future-attestation-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys, '9999-01-01T00:00:00.000Z');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/future|verification time/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('scale evidence rejects expired runs and attestations outside the approved signing window', async () => {
	const staleRun = createSelfTestEvidence();
	staleRun.approval.evidenceValiditySeconds = 1;
	assert.throws(() => verifyScaleEvidence(staleRun), /approved validity period/u);

	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-late-attestation-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		const signedAt = new Date(
			Date.parse(evidence.run.completedAt) +
				(evidence.approval.maxAttestationDelaySeconds + 1) * 1_000,
		).toISOString();
		writeSignedArtifacts(evidence, directory, privateKeys, signedAt);
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/approved signing delay/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('scale evidence requires distinct approval owners and cryptographic signer keys', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-signer-separation-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		const sharedOwnerKey = privateKeys.get(evidence.approval.workloadOwner);
		const sharedPublicKey = trustStore.signers.find(
			(signer) => signer.id === evidence.approval.workloadOwner,
		).publicKeyPem;
		privateKeys.set(evidence.approval.providerOwner, sharedOwnerKey);
		trustStore.signers.find(
			(signer) => signer.id === evidence.approval.providerOwner,
		).publicKeyPem = sharedPublicKey;
		writeSignedArtifacts(evidence, directory, privateKeys);

		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/trusted signer public keys must be unique/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}

	const duplicateOwner = createSelfTestEvidence();
	duplicateOwner.approval.platformOwner = duplicateOwner.approval.providerOwner;
	assert.throws(() => verifyScaleEvidence(duplicateOwner), /approval owners must be distinct/u);
});

test('real scale verification requires artifact byte readback', () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-readback-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const evidencePath = join(directory, 'evidence.json');
		writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
		const result = spawnSync(
			process.execPath,
			[
				fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
				'--evidence',
				evidencePath,
				'--expected-commit',
				evidence.identity.gitSha,
				'--expected-frontend-tree',
				evidence.identity.frontendTreeSha256,
				'--expected-math-tree',
				evidence.identity.mathTreeSha256,
			],
			{ encoding: 'utf8' },
		);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /artifacts-root/u);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('real scale verification requires the trust store outside the artifact root', () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-trust-boundary-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys);
		const evidencePath = join(directory, 'evidence.json');
		const trustStorePath = join(directory, 'trusted-signers.json');
		writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
		const trustStoreBytes = `${JSON.stringify(trustStore)}\n`;
		writeFileSync(trustStorePath, trustStoreBytes, 'utf8');

		const result = spawnSync(
			process.execPath,
			[
				fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
				'--evidence',
				evidencePath,
				'--artifacts-root',
				directory,
				'--trusted-signers',
				trustStorePath,
				'--expected-trust-store-sha256',
				createHash('sha256').update(trustStoreBytes).digest('hex'),
				'--expected-commit',
				evidence.identity.gitSha,
				'--expected-frontend-tree',
				evidence.identity.frontendTreeSha256,
				'--expected-math-tree',
				evidence.identity.mathTreeSha256,
			],
			{ encoding: 'utf8' },
		);

		assert.equal(result.status, 1);
		assert.match(result.stderr, /trusted-signers must be outside artifacts-root/u);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('real scale verification pins the out-of-band trust store digest', () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-trust-pin-red-'));
	const trustDirectory = mkdtempSync(join(tmpdir(), 'blacksite-scale-trust-pin-store-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys);
		const evidencePath = join(directory, 'evidence.json');
		const trustStorePath = join(trustDirectory, 'trusted-signers.json');
		writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
		const trustStoreBytes = `${JSON.stringify(trustStore)}\n`;
		writeFileSync(trustStorePath, trustStoreBytes, 'utf8');

		const result = spawnSync(
			process.execPath,
			[
				fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
				'--evidence',
				evidencePath,
				'--artifacts-root',
				directory,
				'--trusted-signers',
				trustStorePath,
				'--expected-trust-store-sha256',
				'0'.repeat(64),
				'--expected-commit',
				evidence.identity.gitSha,
				'--expected-frontend-tree',
				evidence.identity.frontendTreeSha256,
				'--expected-math-tree',
				evidence.identity.mathTreeSha256,
			],
			{ encoding: 'utf8' },
		);

		assert.equal(result.status, 1);
		assert.match(result.stderr, /trusted-signers sha256 mismatch/u);
	} finally {
		rmSync(directory, { recursive: true, force: true });
		rmSync(trustDirectory, { recursive: true, force: true });
	}
});

test('real scale verification records the evidence digest and refuses output overwrite or artifact-root output', () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-output-artifacts-'));
	const controlDirectory = mkdtempSync(join(tmpdir(), 'blacksite-scale-output-control-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys);
		const evidencePath = join(directory, 'evidence.json');
		const evidenceBytes = `${JSON.stringify(evidence)}\n`;
		writeFileSync(evidencePath, evidenceBytes, 'utf8');
		const trustStorePath = join(controlDirectory, 'trusted-signers.json');
		const trustStoreBytes = `${JSON.stringify(trustStore)}\n`;
		writeFileSync(trustStorePath, trustStoreBytes, 'utf8');
		const baseArgs = [
			fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
			'--evidence',
			evidencePath,
			'--artifacts-root',
			directory,
			'--trusted-signers',
			trustStorePath,
			'--expected-trust-store-sha256',
			createHash('sha256').update(trustStoreBytes).digest('hex'),
			'--expected-commit',
			evidence.identity.gitSha,
			'--expected-frontend-tree',
			evidence.identity.frontendTreeSha256,
			'--expected-math-tree',
			evidence.identity.mathTreeSha256,
		];

		const existingOutput = join(controlDirectory, 'existing.json');
		writeFileSync(existingOutput, 'retain-me\n', 'utf8');
		const overwrite = spawnSync(process.execPath, [...baseArgs, '--output', existingOutput], {
			encoding: 'utf8',
		});
		assert.equal(overwrite.status, 1);
		assert.match(overwrite.stderr, /must not overwrite/u);
		assert.equal(readFileSync(existingOutput, 'utf8'), 'retain-me\n');

		const insideArtifacts = spawnSync(
			process.execPath,
			[...baseArgs, '--output', join(directory, 'verification.json')],
			{ encoding: 'utf8' },
		);
		assert.equal(insideArtifacts.status, 1);
		assert.match(insideArtifacts.stderr, /output must be outside artifacts-root/u);

		const outputPath = join(controlDirectory, 'verification.json');
		const success = spawnSync(process.execPath, [...baseArgs, '--output', outputPath], {
			encoding: 'utf8',
		});
		assert.equal(success.status, 0, success.stderr);
		const output = JSON.parse(readFileSync(outputPath, 'utf8'));
		assert.equal(output.evidenceReadback.bytes, Buffer.byteLength(evidenceBytes));
		assert.equal(
			output.evidenceReadback.sha256,
			createHash('sha256').update(evidenceBytes).digest('hex'),
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
		rmSync(controlDirectory, { recursive: true, force: true });
	}
});

test('scale trust store binds the complete pre-run approval plan', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-approval-binding-red-'));
	try {
		const attacks = [
			(evidence) => {
				evidence.approval.evidenceRef = 'substituted-after-the-run';
			},
			(evidence) => {
				evidence.workload.targetRps -= 1;
			},
			(evidence) => {
				evidence.latency.play.limits.p99Ms += 1;
			},
			(evidence) => {
				evidence.workload.rateMeasurement.minimumEndpointRequests.play -= 1;
			},
			(evidence) => {
				evidence.approval.evidenceValiditySeconds += 1;
			},
		];
		for (const mutate of attacks) {
			const evidence = createSelfTestEvidence();
			const { privateKeys, trustStore } = signerFixture(evidence);
			writeSignedArtifacts(evidence, directory, privateKeys);
			mutate(evidence);
			await assert.rejects(
				() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
				/trust store pre-run approval plan does not match evidence/u,
			);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('scale artifact readback verifies exact files and detects tampering', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-readback-'));
	const trustDirectory = mkdtempSync(join(tmpdir(), 'blacksite-scale-trust-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys);
		const result = await verifyScaleEvidenceArtifacts(evidence, directory, trustStore);
		assert.equal(result.status, 'STRUCTURALLY_VALID');
		assert.notEqual(result.status, 'PASS');
		assert.equal(result.claim, 'SUPPLIED_SIGNED_ARTIFACT_STRUCTURE_AND_READBACK_VALIDATED');
		assert.deepEqual(result.validationScope.notValidated, [
			'evidence-file-provenance',
			'trust-store-file-provenance',
			'tool-native-export-semantics',
			'physical-load-execution',
			'production-capacity',
			'external-release-approval',
		]);
		assert.equal(result.verifiedArtifacts.length, 6);
		assert.equal(
			result.verifiedArtifacts.every((artifact) => artifact.sourceAttachments.length === 1),
			true,
		);

		const evidencePath = join(directory, 'evidence.json');
		const trustStorePath = join(trustDirectory, 'trusted-signers.json');
		writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
		const trustStoreBytes = `${JSON.stringify(trustStore)}\n`;
		writeFileSync(trustStorePath, trustStoreBytes, 'utf8');
		const cli = spawnSync(
			process.execPath,
			[
				fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
				'--evidence',
				evidencePath,
				'--artifacts-root',
				directory,
				'--trusted-signers',
				trustStorePath,
				'--expected-trust-store-sha256',
				createHash('sha256').update(trustStoreBytes).digest('hex'),
				'--expected-commit',
				evidence.identity.gitSha,
				'--expected-frontend-tree',
				evidence.identity.frontendTreeSha256,
				'--expected-math-tree',
				evidence.identity.mathTreeSha256,
			],
			{ encoding: 'utf8' },
		);
		assert.equal(cli.status, 0, cli.stderr);
		const cliResult = JSON.parse(cli.stdout);
		assert.equal(cliResult.status, 'PASS');
		assert.equal(cliResult.claim, 'SIGNED_SCALE_EVIDENCE_CONTRACT_VALIDATED');
		assert.deepEqual(cliResult.validationScope.notValidated, [
			'tool-native-export-semantics',
			'physical-load-execution',
			'production-capacity',
			'external-release-approval',
		]);
		assert.equal(
			cliResult.evidenceReadback.sha256,
			createHash('sha256').update(readFileSync(evidencePath)).digest('hex'),
		);
		assert.equal(
			cliResult.trustStoreReadback.sha256,
			createHash('sha256').update(trustStoreBytes).digest('hex'),
		);
		assert.equal(cliResult.trustStoreReadback.approvedPlanSha256, trustStore.approvedPlanSha256);
		assert.equal(cliResult.artifactReadback.verifiedArtifacts.length, 6);
		assert.equal(
			cliResult.artifactReadback.verifiedArtifacts.every(
				(artifact) => artifact.sourceAttachments.length === 1,
			),
			true,
		);

		const forgedArtifact = evidence.artifacts[0];
		const forgedPath = join(directory, forgedArtifact.name);
		const forgedReport = JSON.parse(readFileSync(forgedPath, 'utf8'));
		forgedReport.report.source = 'rewritten-after-owner-signature';
		const forgedContent = `${JSON.stringify(forgedReport)}\n`;
		writeFileSync(forgedPath, forgedContent, 'utf8');
		forgedArtifact.bytes = Buffer.byteLength(forgedContent);
		forgedArtifact.sha256 = createHash('sha256').update(forgedContent).digest('hex');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/attestation\.reportSha256/u,
		);

		writeSignedArtifacts(evidence, directory, privateKeys);
		writeFileSync(join(directory, evidence.artifacts[0].name), 'tampered\n', 'utf8');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/bytes mismatch|sha256 mismatch/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
		rmSync(trustDirectory, { recursive: true, force: true });
	}
});

test('scale artifact readback rejects unapproved, mocked and non-production evidence instead of portraying PASS', async () => {
	const cases = [
		{
			name: 'unapproved',
			mutate: (evidence) => {
				evidence.approval.status = 'proposed';
			},
			error: /approval\.status must be approved/u,
		},
		{
			name: 'mocked',
			mutate: (evidence) => {
				evidence.environment.mocked = true;
			},
			error: /mocked environment evidence is not accepted/u,
		},
		{
			name: 'non-production-equivalent',
			mutate: (evidence) => {
				evidence.environment.productionEquivalent = false;
			},
			error: /environment must be production-equivalent/u,
		},
	];

	for (const fixture of cases) {
		const directory = mkdtempSync(join(tmpdir(), `blacksite-scale-${fixture.name}-`));
		try {
			const evidence = createSelfTestEvidence();
			fixture.mutate(evidence);
			const { privateKeys, trustStore } = signerFixture(evidence);
			writeSignedArtifacts(evidence, directory, privateKeys);
			await assert.rejects(
				() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
				fixture.error,
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
});

test('scale artifact readback requires signed role-specific normalized source records and attachment bytes', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-normalized-source-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { privateKeys, trustStore } = signerFixture(evidence);
		writeSignedArtifacts(evidence, directory, privateKeys);
		const artifact = evidence.artifacts[0];
		const artifactPath = join(directory, artifact.name);
		let report = JSON.parse(readFileSync(artifactPath, 'utf8'));
		const rawPath = join(directory, report.blacksiteScaleSourceReport.attachments[0].name);
		writeFileSync(rawPath, 'tampered\n', 'utf8');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/source attachment.*bytes mismatch|source attachment.*sha256 mismatch/u,
		);

		writeSignedArtifacts(evidence, directory, privateKeys);
		report = JSON.parse(readFileSync(artifactPath, 'utf8'));
		delete report.blacksiteScaleAttestation;
		delete report.blacksiteScaleSourceReport;
		const signerId = signerForRole(evidence, artifact.role);
		report.blacksiteScaleAttestation = createScaleArtifactAttestation(
			evidence,
			artifact.role,
			report,
			{
				signerId,
				privateKey: privateKeys.get(signerId),
			},
		);
		let reportContent = `${JSON.stringify(report)}\n`;
		writeFileSync(artifactPath, reportContent, 'utf8');
		artifact.bytes = Buffer.byteLength(reportContent);
		artifact.sha256 = createHash('sha256').update(reportContent).digest('hex');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/source report is required/u,
		);

		writeSignedArtifacts(evidence, directory, privateKeys);
		report = JSON.parse(readFileSync(artifactPath, 'utf8'));
		const attachment = report.blacksiteScaleSourceReport.attachments[0];
		const rawDocumentPath = join(directory, attachment.name);
		const rawDocument = JSON.parse(readFileSync(rawDocumentPath, 'utf8'));
		rawDocument.records = [];
		const rawContent = `${JSON.stringify(rawDocument)}\n`;
		writeFileSync(rawDocumentPath, rawContent, 'utf8');
		attachment.bytes = Buffer.byteLength(rawContent);
		attachment.sha256 = createHash('sha256').update(rawContent).digest('hex');
		delete report.blacksiteScaleAttestation;
		report.blacksiteScaleAttestation = createScaleArtifactAttestation(
			evidence,
			artifact.role,
			report,
			{
				signerId,
				privateKey: privateKeys.get(signerId),
			},
		);
		reportContent = `${JSON.stringify(report)}\n`;
		writeFileSync(artifactPath, reportContent, 'utf8');
		artifact.bytes = Buffer.byteLength(reportContent);
		artifact.sha256 = createHash('sha256').update(reportContent).digest('hex');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/non-empty source records/u,
		);

		writeSignedArtifacts(evidence, directory, privateKeys);
		report = JSON.parse(readFileSync(artifactPath, 'utf8'));
		const arbitraryAttachment = report.blacksiteScaleSourceReport.attachments[0];
		const arbitraryRawPath = join(directory, arbitraryAttachment.name);
		const arbitraryRawDocument = JSON.parse(readFileSync(arbitraryRawPath, 'utf8'));
		arbitraryRawDocument.records = [{ signedBooleanOnly: true }];
		arbitraryRawDocument.blacksiteScaleNormalizedSource.recordsSha256 = createHash('sha256')
			.update(JSON.stringify(arbitraryRawDocument.records))
			.digest('hex');
		const arbitraryRawContent = `${JSON.stringify(arbitraryRawDocument)}\n`;
		writeFileSync(arbitraryRawPath, arbitraryRawContent, 'utf8');
		arbitraryAttachment.bytes = Buffer.byteLength(arbitraryRawContent);
		arbitraryAttachment.sha256 = createHash('sha256').update(arbitraryRawContent).digest('hex');
		delete report.blacksiteScaleAttestation;
		report.blacksiteScaleAttestation = createScaleArtifactAttestation(
			evidence,
			artifact.role,
			report,
			{
				signerId,
				privateKey: privateKeys.get(signerId),
			},
		);
		reportContent = `${JSON.stringify(report)}\n`;
		writeFileSync(artifactPath, reportContent, 'utf8');
		artifact.bytes = Buffer.byteLength(reportContent);
		artifact.sha256 = createHash('sha256').update(reportContent).digest('hex');
		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/required role-specific source records/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('scale artifact readback rejects files whose structured binding contradicts the evidence', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-binding-red-'));
	try {
		const evidence = createSelfTestEvidence();
		const { trustStore } = signerFixture(evidence);
		for (const artifact of evidence.artifacts) {
			const content = `${JSON.stringify({
				blacksiteScaleBinding: {
					schema: SCALE_ARTIFACT_BINDING_SCHEMA,
					role: artifact.role,
					runId: evidence.run.id,
					identitySha256: '0'.repeat(64),
					measurementsSha256: '0'.repeat(64),
				},
			})}\n`;
			writeFileSync(join(directory, artifact.name), content, 'utf8');
			artifact.bytes = Buffer.byteLength(content);
			artifact.sha256 = createHash('sha256').update(content).digest('hex');
		}

		await assert.rejects(
			() => verifyScaleEvidenceArtifacts(evidence, directory, trustStore),
			/identitySha256/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('scale artifact readback requires externally trusted signer attestations', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-authenticity-red-'));
	try {
		const evidence = createSelfTestEvidence();
		for (const artifact of evidence.artifacts) {
			const content = `${JSON.stringify({
				...createScaleArtifactProof(evidence, artifact.role),
				report: { source: 'self-asserted' },
			})}\n`;
			writeFileSync(join(directory, artifact.name), content, 'utf8');
			artifact.bytes = Buffer.byteLength(content);
			artifact.sha256 = createHash('sha256').update(content).digest('hex');
		}

		await assert.rejects(
			() =>
				verifyScaleEvidenceArtifacts(evidence, directory, { schema: 'untrusted-self-assertion' }),
			/trusted signer|attestation|trust store/u,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
