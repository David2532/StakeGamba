import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign as signValue } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	DEVICE_EVIDENCE_SCHEMA,
	DEVICE_EVIDENCE_VALIDATION_SCHEMA,
	DEVICE_OWNER_REVIEW_SCHEMA,
	DEVICE_OWNER_REVIEW_VALIDATION_SCHEMA,
	DEVICE_QA_CONTRACT_VERSION,
	OLD_DEVICE_FLOOR_VERSION,
	REQUIRED_SCENARIOS_BY_ENVIRONMENT,
	verifyDeviceEvidence,
	verifyDeviceOwnerReview,
} from '../../../scripts/blacksite-device-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const validatorPath = fileURLToPath(
	new URL('../../../scripts/blacksite-device-evidence.mjs', import.meta.url),
);
const verificationTime = '2026-09-03T12:00:00Z';
const identity = Object.freeze({
	gitSha: '1'.repeat(40),
	frontendTreeSha256: '2'.repeat(64),
	mathTreeSha256: '3'.repeat(64),
	mathCandidateFingerprintSha256: '4'.repeat(64),
});

function environmentFixture(coverageKind) {
	const common = {
		provenance: { observation: 'OPERATOR_REPORTED', verification: 'UNVERIFIED' },
		device: {
			manufacturer: 'Evidence Hardware Co',
			model: 'Physical Test Device',
			modelIdentifier: `model-${coverageKind.toLowerCase()}`,
			physical: 'OPERATOR_ASSERTED_PHYSICAL',
		},
		hardware: {
			chipset: 'Recorded physical chipset',
			cpuArchitecture: 'arm64',
			gpu: 'Recorded physical GPU',
			ramMiB: 3072,
		},
		os: {
			name: 'Recorded OS',
			version: '16.7.10',
			build: '20H350',
		},
		browser: {
			name: 'Recorded browser',
			version: '16.6.1',
			engine: 'Recorded engine',
		},
		viewport: {
			widthCssPx: 375,
			heightCssPx: 812,
			devicePixelRatio: 3,
		},
		connection: {
			kind: 'wifi',
			label: 'controlled QA network',
		},
		notes: 'Physical device condition and power settings were recorded before execution.',
	};
	if (coverageKind === 'IOS_OLD_FLOOR') {
		return {
			id: 'ios-floor-device',
			coverageKind,
			executionMode: 'PHYSICAL_DEVICE',
			floorRelation: 'AT_PROPOSED_FLOOR',
			...common,
			device: {
				manufacturer: 'Apple',
				model: 'iPhone X',
				modelIdentifier: 'iPhone10,6',
				physical: 'OPERATOR_ASSERTED_PHYSICAL',
			},
			hardware: {
				chipset: 'Apple A11 Bionic',
				cpuArchitecture: 'arm64',
				gpu: 'Apple three-core GPU',
				ramMiB: 3072,
			},
			os: { name: 'iOS', version: '16.7.10', build: '20H350' },
			browser: { name: 'Mobile Safari', version: '16.6.1', engine: 'WebKit' },
			assistiveTechnology: { name: 'VoiceOver', version: 'bundled with iOS build 20H350' },
		};
	}
	if (coverageKind === 'ANDROID_OLD_FLOOR') {
		return {
			id: 'android-floor-device',
			coverageKind,
			executionMode: 'PHYSICAL_DEVICE',
			floorRelation: 'AT_PROPOSED_FLOOR',
			...common,
			device: {
				manufacturer: 'Motorola',
				model: 'Moto G7 Power',
				modelIdentifier: 'XT1955-5',
				physical: 'OPERATOR_ASSERTED_PHYSICAL',
			},
			hardware: {
				chipset: 'Qualcomm Snapdragon 632',
				cpuArchitecture: 'arm64',
				gpu: 'Adreno 506',
				ramMiB: 3072,
			},
			os: { name: 'Android', version: '10', build: 'QPYS30.52-22-8' },
			browser: { name: 'Google Chrome', version: '139.0.7258.94', engine: 'Blink' },
			viewport: { widthCssPx: 360, heightCssPx: 740, devicePixelRatio: 2 },
			assistiveTechnology: { name: 'TalkBack', version: '14.2.0' },
		};
	}
	const size = coverageKind === 'POPOUT_S' ? 'S' : 'L';
	return {
		id: `popout-${size.toLowerCase()}-device`,
		coverageKind,
		executionMode: 'REAL_STAKE_POPOUT',
		floorRelation: 'NOT_APPLICABLE',
		...common,
		device: {
			manufacturer: 'QA Workstation Co',
			model: 'Physical QA Workstation',
			modelIdentifier: 'qa-workstation-2026',
			physical: 'OPERATOR_ASSERTED_PHYSICAL',
		},
		hardware: {
			chipset: 'Recorded desktop processor',
			cpuArchitecture: 'x86_64',
			gpu: 'Recorded desktop GPU',
			ramMiB: 16384,
		},
		os: { name: 'Windows', version: '11 24H2', build: '26100.4946' },
		browser: { name: 'Google Chrome', version: '139.0.7258.94', engine: 'Blink' },
		viewport:
			size === 'S'
				? { widthCssPx: 360, heightCssPx: 640, devicePixelRatio: 1 }
				: { widthCssPx: 1366, heightCssPx: 768, devicePixelRatio: 1 },
		stakeContainer: {
			size,
			version: 'recorded Stake QA container 2026.09',
			source: 'OPERATOR_ASSERTED_REAL_STAKE',
		},
	};
}

const secondaryEvidenceKind = Object.freeze({
	'load-and-readiness': ['log', 'text/plain'],
	'live-play': ['log', 'application/json'],
	'heavy-cascade': ['trace', 'application/json'],
	replay: ['log', 'application/json'],
	'mute-resume-and-audio': ['audio-recording', 'audio/wav'],
	'memory-pressure': ['device-report', 'application/json'],
	thermal: ['device-report', 'application/json'],
	battery: ['device-report', 'application/json'],
});

function attachmentBytes(kind, mediaType, label) {
	if (mediaType === 'video/mp4') {
		const bytes = Buffer.alloc(2_048, 0x2a);
		bytes.writeUInt32BE(24, 0);
		bytes.write('ftyp', 4, 'ascii');
		bytes.write(label, 16, 'utf8');
		return bytes;
	}
	if (mediaType === 'audio/wav') {
		const bytes = Buffer.alloc(1_024, 0x35);
		bytes.write('RIFF', 0, 'ascii');
		bytes.write('WAVE', 8, 'ascii');
		bytes.write(label, 16, 'utf8');
		return bytes;
	}
	const text = JSON.stringify({ kind, label, candidate: identity.gitSha });
	return Buffer.from(`${text}\n${text}\n`, 'utf8');
}

function resultMeasurement(scenarioId) {
	const sustained = scenarioId === 'thermal' || scenarioId === 'battery';
	const measurement = {
		startedAt: sustained ? '2026-09-03T10:00:00Z' : '2026-09-03T10:29:00Z',
		completedAt: sustained ? '2026-09-03T10:20:00Z' : '2026-09-03T10:30:00Z',
		durationSeconds: sustained ? 1_200 : 60,
		method: 'operator video and device instrumentation',
	};
	if (scenarioId === 'memory-pressure') measurement.cycles = 3;
	if (scenarioId === 'thermal') {
		measurement.poweredExternally = false;
		measurement.startThermalState = 'nominal device-reported state';
		measurement.endThermalState = 'fair device-reported state';
	}
	if (scenarioId === 'battery') {
		measurement.poweredExternally = false;
		measurement.startBatteryPercent = 90;
		measurement.endBatteryPercent = 84;
		measurement.brightnessPercent = 60;
		measurement.radios = ['Wi-Fi enabled', 'Bluetooth disabled'];
	}
	return measurement;
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blacksite-device-evidence-'));
	const environments = Object.keys(REQUIRED_SCENARIOS_BY_ENVIRONMENT).map(environmentFixture);
	const attachments = [];
	const addAttachment = ({ environment, id, scope, scenarios, kind, mediaType }) => {
		const extension =
			mediaType === 'video/mp4' ? 'mp4' : mediaType === 'audio/wav' ? 'wav' : 'json';
		const path = `${id}.${extension}`;
		const bytes = attachmentBytes(kind, mediaType, `${environment.id}-${id}`);
		writeFileSync(join(root, path), bytes);
		attachments.push({
			id,
			environmentId: environment.id,
			operatorId: 'qa-operator',
			captureScope: scope,
			scenarioIds: scenarios,
			path,
			kind,
			mediaType,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
			capturedAt: '2026-09-03T10:10:00Z',
		});
	};

	for (const environment of environments) {
		const scenarios = REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind];
		addAttachment({
			environment,
			id: `${environment.id}-sequence`,
			scope: 'ENVIRONMENT_SEQUENCE',
			scenarios: [...scenarios],
			kind: 'video',
			mediaType: 'video/mp4',
		});
		for (const scenarioId of scenarios) {
			const secondary = secondaryEvidenceKind[scenarioId];
			if (!secondary) continue;
			addAttachment({
				environment,
				id: `${environment.id}-${scenarioId}-support`,
				scope: 'SCENARIO',
				scenarios: [scenarioId],
				kind: secondary[0],
				mediaType: secondary[1],
			});
		}
	}

	const results = environments.flatMap((environment) =>
		REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind].map((scenarioId) => ({
			environmentId: environment.id,
			scenarioId,
			status: 'PASS',
			operatorId: 'qa-operator',
			observedAt:
				scenarioId === 'thermal' || scenarioId === 'battery'
					? '2026-09-03T10:20:00Z'
					: '2026-09-03T10:30:00Z',
			fixture: `candidate fixture for ${scenarioId}`,
			notes: `The named operator executed ${scenarioId} and recorded the physical observation.`,
			attachmentIds: [
				`${environment.id}-sequence`,
				...(secondaryEvidenceKind[scenarioId] ? [`${environment.id}-${scenarioId}-support`] : []),
			],
			measurement: resultMeasurement(scenarioId),
		})),
	);
	return {
		root,
		evidence: {
			schema: DEVICE_EVIDENCE_SCHEMA,
			contractVersion: DEVICE_QA_CONTRACT_VERSION,
			floorVersion: OLD_DEVICE_FLOOR_VERSION,
			claim: 'STRUCTURAL_RECORD_ONLY_NOT_DEVICE_APPROVAL',
			identity: { ...identity },
			record: {
				id: 'device-run-20260903',
				startedAt: '2026-09-03T10:00:00Z',
				completedAt: '2026-09-03T11:00:00Z',
			},
			operators: [
				{
					id: 'qa-operator',
					name: 'Alex Device Reviewer',
					organization: 'BLACKSITE QA',
					role: 'Manual device operator',
				},
			],
			environments,
			attachments,
			results,
			claims: {
				deviceApproval: 'NOT_CLAIMED',
				releaseApproval: 'NOT_CLAIMED',
			},
		},
	};
}

function verify(value) {
	return verifyDeviceEvidence(value.evidence, {
		expectedIdentity: identity,
		attachmentsRoot: value.root,
		verificationTime,
	});
}

function markResultNotRun(
	value,
	result,
	reason = 'The required external execution was unavailable.',
) {
	result.status = 'NOT_RUN';
	result.observedAt = 'NOT_OBSERVED';
	result.notes = 'This scenario was not executed and remains externally owned.';
	result.attachmentIds = [];
	delete result.measurement;
	result.blocker = {
		reason,
		owner: 'Device QA owner',
		nextAction: 'Provision the required environment and execute the documented procedure.',
	};
	for (const attachment of value.evidence.attachments) {
		if (attachment.environmentId !== result.environmentId) continue;
		attachment.scenarioIds = attachment.scenarioIds.filter(
			(scenarioId) => scenarioId !== result.scenarioId,
		);
	}
	value.evidence.attachments = value.evidence.attachments.filter(
		(attachment) => attachment.scenarioIds.length > 0,
	);
}

function markAllNotRun(value) {
	for (const result of value.evidence.results) markResultNotRun(value, result);
	value.evidence.attachments = [];
	for (const environment of value.evidence.environments) {
		environment.provenance = { observation: 'NOT_OBSERVED', verification: 'UNVERIFIED' };
		environment.executionMode = 'NOT_EXECUTED';
		environment.device.physical = 'NOT_OBSERVED';
		if (
			environment.coverageKind === 'IOS_OLD_FLOOR' ||
			environment.coverageKind === 'ANDROID_OLD_FLOOR'
		) {
			environment.floorRelation = 'NOT_OBSERVED';
		} else {
			environment.stakeContainer.source = 'NOT_OBSERVED';
		}
	}
}

function canonicalJsonValue(value) {
	if (Array.isArray(value)) return value.map(canonicalJsonValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort((left, right) => left.localeCompare(right, 'en'))
				.map((key) => [key, canonicalJsonValue(value[key])]),
		);
	}
	return value;
}

function signedOwnerReview(value, status = 'ACCEPTED') {
	const evidenceSourceBytes = Buffer.from(`${JSON.stringify(value.evidence, null, 2)}\n`);
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
	const publicKeySpkiSha256 = createHash('sha256')
		.update(publicKey.export({ type: 'spki', format: 'der' }))
		.digest('hex');
	const review = {
		schema: DEVICE_OWNER_REVIEW_SCHEMA,
		claim: 'SIGNED_OWNER_DECISION_NOT_STAKE_OR_RELEASE_APPROVAL',
		evidence: {
			schema: DEVICE_EVIDENCE_SCHEMA,
			recordId: value.evidence.record.id,
			identity: { ...identity },
			exactSourceBytes: {
				bytes: evidenceSourceBytes.length,
				sha256: createHash('sha256').update(evidenceSourceBytes).digest('hex'),
			},
		},
		reviewer: {
			id: 'qa-release-owner',
			name: 'Jordan QA Owner',
			organization: 'BLACKSITE Release QA',
			role: 'Authorized manual device review owner',
		},
		decision: {
			status,
			scope: 'DEVICE_QA_MANUAL_REVIEW',
			decidedAt: '2026-09-03T11:10:00Z',
			notes: 'Reviewed the complete candidate-bound observations, attachments, and defect state.',
		},
		signature: {
			algorithm: 'Ed25519',
			keyId: 'qa-release-key-2026',
			publicKeySpkiSha256,
			signedAt: '2026-09-03T11:11:00Z',
			valueBase64: '',
		},
		claims: {
			stakeApproval: 'NOT_CLAIMED',
			releaseApproval: 'NOT_CLAIMED',
		},
	};
	const { valueBase64: ignoredValue, ...signatureMetadata } = review.signature;
	void ignoredValue;
	const signedValue = { ...review, signature: signatureMetadata };
	review.signature.valueBase64 = signValue(
		null,
		Buffer.from(JSON.stringify(canonicalJsonValue(signedValue)), 'utf8'),
		privateKey,
	).toString('base64');
	return { evidenceSourceBytes, publicKeyPem, review };
}

function verifyOwnerReview(value, signedReview) {
	return verifyDeviceOwnerReview(signedReview.review, {
		expectedIdentity: identity,
		attachmentsRoot: value.root,
		verificationTime,
		evidenceSourceBytes: signedReview.evidenceSourceBytes,
		reviewSourceBytes: Buffer.from(`${JSON.stringify(signedReview.review, null, 2)}\n`),
		trustedReviewer: {
			id: 'qa-release-owner',
			keyId: 'qa-release-key-2026',
			publicKeyPem: signedReview.publicKeyPem,
		},
	});
}

function withFixture(callback) {
	const value = fixture();
	try {
		return callback(value);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
}

test('valid manual-device fixture is structurally complete without claiming approval', () => {
	withFixture((value) => {
		const result = verify(value);
		assert.equal(result.schema, DEVICE_EVIDENCE_VALIDATION_SCHEMA);
		assert.equal(result.status, 'STRUCTURALLY_COMPLETE');
		assert.equal(result.claim, 'RECORD_STRUCTURE_IDENTITY_AND_ATTACHMENT_READBACK_ONLY');
		assert.equal(result.verifiedAt, new Date(verificationTime).toISOString());
		assert.equal(result.evidenceJson.binding, 'CANONICAL_JSON_VALUE');
		assert.match(result.evidenceJson.sha256, /^[0-9a-f]{64}$/u);
		assert.equal(result.results.total, 54);
		assert.equal(result.results.operatorReportedPass, 54);
		assert.equal(result.results.outcome, 'ALL_RESULTS_REPORTED_PASS_PENDING_OWNER_REVIEW');
		assert.equal(result.oldDeviceFloor.proof, 'NOT_CLAIMED');
		assert.equal(result.deviceApproval, 'NOT_CLAIMED');
		assert.equal(result.releaseApproval, 'NOT_CLAIMED');
		assert.equal(result.manualReviewRequired, true);
		assert.equal(result.attachments.readback, 'BYTES_AND_SHA256_VERIFIED');
		assert.equal(result.attachments.identities.length, value.evidence.attachments.length);
		assert.deepEqual(
			new Set(result.attachments.identities.map((attachment) => attachment.environmentId)),
			new Set(['ios-floor-device', 'android-floor-device', 'popout-s-device', 'popout-l-device']),
		);
	});
});

test('manual-device evidence rejects a candidate identity mismatch', () => {
	withFixture((value) => {
		value.evidence.identity.frontendTreeSha256 = '5'.repeat(64);
		assert.throws(
			() => verify(value),
			/does not match the independently supplied candidate identity/u,
		);
	});
	withFixture((value) => {
		const differentBytes = Buffer.from(
			`${JSON.stringify({ ...value.evidence, claim: 'different' })}\n`,
		);
		assert.throws(
			() =>
				verifyDeviceEvidence(value.evidence, {
					expectedIdentity: identity,
					attachmentsRoot: value.root,
					verificationTime,
					evidenceSourceBytes: differentBytes,
				}),
			/evidenceSourceBytes do not encode the evidence value/u,
		);
	});
});

test('manual-device evidence enforces canonical facts for AT_PROPOSED_FLOOR', () => {
	withFixture((value) => {
		value.evidence.environments.find(
			(environment) => environment.coverageKind === 'IOS_OLD_FLOOR',
		).device.model = 'iPhone 15';
		assert.throws(() => verify(value), /device\.model must be "iPhone X"/u);
	});
	withFixture((value) => {
		value.evidence.environments.find(
			(environment) => environment.coverageKind === 'ANDROID_OLD_FLOOR',
		).hardware.ramMiB = 4096;
		assert.throws(() => verify(value), /hardware\.ramMiB must be 3072/u);
	});
});

test('manual-device evidence rejects missing scenarios and missing coverage devices', () => {
	withFixture((value) => {
		value.evidence.results = value.evidence.results.filter(
			(result) => !(result.environmentId === 'ios-floor-device' && result.scenarioId === 'max-win'),
		);
		assert.throws(() => verify(value), /Missing required max-win result for ios-floor-device/u);
	});
	withFixture((value) => {
		value.evidence.environments = value.evidence.environments.filter(
			(environment) => environment.coverageKind !== 'ANDROID_OLD_FLOOR',
		);
		value.evidence.results = value.evidence.results.filter(
			(result) => result.environmentId !== 'android-floor-device',
		);
		assert.throws(
			() => verify(value),
			/separate IOS_OLD_FLOOR, ANDROID_OLD_FLOOR, POPOUT_S, POPOUT_L coverage/u,
		);
	});
});

test('NOT_RUN is structurally recordable but remains explicit and never becomes approval', () => {
	withFixture((value) => {
		const result = value.evidence.results.find(
			(candidate) =>
				candidate.environmentId === 'android-floor-device' && candidate.scenarioId === 'talkback',
		);
		markResultNotRun(
			value,
			result,
			'The required physical TalkBack operator was unavailable for this run.',
		);
		delete result.blocker;
		assert.throws(() => verify(value), /results\[\d+\]\.blocker must be an object/u);
		result.blocker = {
			reason: 'The required physical TalkBack operator was unavailable for this run.',
			owner: 'Accessibility QA owner',
			nextAction: 'Schedule and execute the complete TalkBack core-flow procedure.',
		};
		const report = verify(value);
		assert.equal(report.status, 'STRUCTURALLY_COMPLETE');
		assert.equal(report.results.operatorReportedNotRun, 1);
		assert.equal(report.results.outcome, 'RECORDED_NOT_RUN');
		assert.equal(report.deviceApproval, 'NOT_CLAIMED');
		assert.equal(report.releaseApproval, 'NOT_CLAIMED');
	});
});

test('all-NOT_RUN evidence stays unobserved and cannot carry physical or real-Stake assertions', () => {
	withFixture((value) => {
		markAllNotRun(value);
		const report = verify(value);
		assert.equal(report.results.outcome, 'ALL_RESULTS_NOT_RUN');
		assert.equal(report.attachments.count, 0);
		assert.equal(report.attachments.readback, 'NO_EXECUTED_RESULTS_NO_ATTACHMENTS');
		assert.equal(report.oldDeviceFloor.coverage, 'NOT_OBSERVED');
		assert.ok(
			report.environmentProvenance.every(
				(environment) =>
					environment.observation === 'NOT_OBSERVED' &&
					environment.verification === 'UNVERIFIED' &&
					environment.executionMode === 'NOT_EXECUTED' &&
					environment.physical === 'NOT_OBSERVED',
			),
		);
	});
	withFixture((value) => {
		markAllNotRun(value);
		value.evidence.environments[0].executionMode = 'PHYSICAL_DEVICE';
		value.evidence.environments[0].device.physical = 'OPERATOR_ASSERTED_PHYSICAL';
		assert.throws(() => verify(value), /executionMode must be NOT_EXECUTED/u);
	});
	withFixture((value) => {
		markAllNotRun(value);
		const popout = value.evidence.environments.find(
			(environment) => environment.coverageKind === 'POPOUT_S',
		);
		popout.stakeContainer.source = 'OPERATOR_ASSERTED_REAL_STAKE';
		assert.throws(() => verify(value), /stakeContainer\.source must be NOT_OBSERVED/u);
	});
});

test('mobile evidence supports an explicitly identified physical device-farm route', () => {
	withFixture((value) => {
		const android = value.evidence.environments.find(
			(environment) => environment.coverageKind === 'ANDROID_OLD_FLOOR',
		);
		android.executionMode = 'DEVICE_FARM';
		android.device.physical = 'PROVIDER_ASSERTED_PHYSICAL';
		android.deviceFarm = {
			provider: 'Named physical-device farm',
			sessionId: 'provider-session-20260903-001',
			deviceType: 'PROVIDER_ASSERTED_PHYSICAL',
		};
		const report = verify(value);
		assert.equal(
			report.environmentProvenance.find((environment) => environment.id === android.id)
				.executionMode,
			'DEVICE_FARM',
		);
	});
});

test('manual-device evidence forbids cross-environment, out-of-scope, and cross-operator attachments', () => {
	withFixture((value) => {
		const result = value.evidence.results.find(
			(candidate) =>
				candidate.environmentId === 'ios-floor-device' && candidate.scenarioId === 'max-win',
		);
		result.attachmentIds = ['android-floor-device-sequence'];
		assert.throws(() => verify(value), /belongs to a different environment/u);
	});
	withFixture((value) => {
		const attachment = value.evidence.attachments.find(
			(candidate) => candidate.environmentId === 'ios-floor-device',
		);
		attachment.scenarioIds = attachment.scenarioIds.filter(
			(scenarioId) => scenarioId !== 'max-win',
		);
		assert.throws(() => verify(value), /does not declare scenario max-win/u);
	});
	withFixture((value) => {
		value.evidence.operators.push({
			id: 'second-operator',
			name: 'Second Device Reviewer',
			organization: 'BLACKSITE QA',
			role: 'Manual device operator',
		});
		value.evidence.results[0].operatorId = 'second-operator';
		assert.throws(() => verify(value), /belongs to a different operator/u);
	});
});

test('manual-device evidence rejects cross-environment byte reuse and incompatible media kinds', () => {
	withFixture((value) => {
		const androidAttachment = value.evidence.attachments.find(
			(attachment) => attachment.environmentId === 'android-floor-device',
		);
		androidAttachment.sha256 = value.evidence.attachments[0].sha256;
		assert.throws(() => verify(value), /identical attachment bytes across environments/u);
	});
	withFixture((value) => {
		value.evidence.attachments.find((attachment) => attachment.kind === 'log').kind = 'screenshot';
		assert.throws(() => verify(value), /mediaType is not compatible with kind screenshot/u);
	});
});

test('executed scenarios require meaningful scenario-specific evidence kinds', () => {
	withFixture((value) => {
		const sequence = value.evidence.attachments.find(
			(attachment) => attachment.id === 'ios-floor-device-sequence',
		);
		sequence.kind = 'log';
		sequence.mediaType = 'text/plain';
		assert.throws(() => verify(value), /requires continuous video evidence/u);
	});
	withFixture((value) => {
		const heavy = value.evidence.results.find(
			(result) =>
				result.environmentId === 'ios-floor-device' && result.scenarioId === 'heavy-cascade',
		);
		heavy.attachmentIds = ['ios-floor-device-sequence'];
		assert.throws(() => verify(value), /requires trace or device-report evidence/u);
	});
	withFixture((value) => {
		const sequence = value.evidence.attachments.find(
			(attachment) => attachment.id === 'ios-floor-device-sequence',
		);
		const bytes = Buffer.from('tiny fake video');
		writeFileSync(join(value.root, sequence.path), bytes);
		sequence.bytes = bytes.length;
		sequence.sha256 = createHash('sha256').update(bytes).digest('hex');
		assert.throws(() => verify(value), /bytes is too small for kind video/u);
	});
	withFixture((value) => {
		const sequence = value.evidence.attachments.find(
			(attachment) => attachment.id === 'ios-floor-device-sequence',
		);
		const bytes = Buffer.alloc(2_048, 0x61);
		writeFileSync(join(value.root, sequence.path), bytes);
		sequence.bytes = bytes.length;
		sequence.sha256 = createHash('sha256').update(bytes).digest('hex');
		assert.throws(() => verify(value), /bytes do not match media type video\/mp4/u);
	});
});

test('structured measurements enforce memory cycles and sustained unplugged mobile runs', () => {
	withFixture((value) => {
		const memory = value.evidence.results.find(
			(result) =>
				result.environmentId === 'ios-floor-device' && result.scenarioId === 'memory-pressure',
		);
		memory.measurement.cycles = 2;
		assert.throws(() => verify(value), /at least three complete heavy-sequence cycles/u);
	});
	withFixture((value) => {
		const thermal = value.evidence.results.find(
			(result) => result.environmentId === 'ios-floor-device' && result.scenarioId === 'thermal',
		);
		thermal.measurement.completedAt = '2026-09-03T10:19:59Z';
		thermal.measurement.durationSeconds = 1_199;
		thermal.observedAt = thermal.measurement.completedAt;
		assert.throws(() => verify(value), /at least 20 minutes/u);
	});
	withFixture((value) => {
		const battery = value.evidence.results.find(
			(result) =>
				result.environmentId === 'android-floor-device' && result.scenarioId === 'battery',
		);
		battery.measurement.poweredExternally = true;
		assert.throws(() => verify(value), /must be false for the unplugged battery run/u);
	});
});

test('manual-device evidence rejects unhashed attachments and attachment readback mismatches', () => {
	withFixture((value) => {
		delete value.evidence.attachments[0].sha256;
		assert.throws(() => verify(value), /attachments\[0\]\.sha256 is required/u);
	});
	withFixture((value) => {
		value.evidence.attachments[0].sha256 = '6'.repeat(64);
		assert.throws(() => verify(value), /SHA-256 does not match readback/u);
	});
});

test('manual-device evidence rejects stale and future records', () => {
	withFixture((value) => {
		value.evidence.record.startedAt = '2026-07-01T10:00:00Z';
		value.evidence.record.completedAt = '2026-07-01T11:00:00Z';
		for (const attachment of value.evidence.attachments) {
			attachment.capturedAt = '2026-07-01T10:30:00Z';
		}
		for (const result of value.evidence.results) result.observedAt = '2026-07-01T10:30:00Z';
		assert.throws(() => verify(value), /stale/u);
	});
	withFixture((value) => {
		value.evidence.record.startedAt = '2026-09-03T13:00:00Z';
		value.evidence.record.completedAt = '2026-09-03T14:00:00Z';
		for (const attachment of value.evidence.attachments) {
			attachment.capturedAt = '2026-09-03T13:30:00Z';
		}
		for (const result of value.evidence.results) result.observedAt = '2026-09-03T13:30:00Z';
		assert.throws(() => verify(value), /future/u);
	});
});

test('standalone manual-device validator emits structural status rather than PASS', () => {
	withFixture((value) => {
		const evidencePath = join(value.root, 'device-evidence.json');
		const evidenceBytes = Buffer.from(`${JSON.stringify(value.evidence, null, 2)}\n`);
		writeFileSync(evidencePath, evidenceBytes);
		const result = spawnSync(
			process.execPath,
			[
				validatorPath,
				'--evidence',
				evidencePath,
				'--attachments-root',
				value.root,
				'--expected-git-sha',
				identity.gitSha,
				'--expected-frontend-tree',
				identity.frontendTreeSha256,
				'--expected-math-tree',
				identity.mathTreeSha256,
				'--expected-math-fingerprint',
				identity.mathCandidateFingerprintSha256,
			],
			{
				encoding: 'utf8',
				env: { ...process.env },
			},
		);
		assert.equal(result.status, 0, result.stderr);
		const report = JSON.parse(result.stdout);
		assert.equal(report.status, 'STRUCTURALLY_COMPLETE');
		assert.equal(report.evidenceJson.binding, 'EXACT_SOURCE_BYTES');
		assert.equal(report.evidenceJson.bytes, evidenceBytes.length);
		assert.equal(
			report.evidenceJson.sha256,
			createHash('sha256').update(evidenceBytes).digest('hex'),
		);
		assert.match(report.verifiedAt, /^\d{4}-\d{2}-\d{2}T/u);
		assert.equal(report.attachments.identities.length, value.evidence.attachments.length);
		assert.equal(report.deviceApproval, 'NOT_CLAIMED');
		assert.equal(Object.values(report).includes('PASS'), false);
	});
});

test('separate owner review verifies an exact evidence binding and Ed25519 signature only', () => {
	withFixture((value) => {
		const signedReview = signedOwnerReview(value);
		const report = verifyOwnerReview(value, signedReview);
		assert.equal(report.schema, DEVICE_OWNER_REVIEW_VALIDATION_SCHEMA);
		assert.equal(report.status, 'SIGNED_OWNER_DECISION_VERIFIED');
		assert.equal(
			report.claim,
			'SIGNATURE_AND_BINDING_ONLY_AUTHORITY_AND_EXTERNAL_APPROVAL_NOT_ATTESTED',
		);
		assert.equal(report.decision.status, 'ACCEPTED');
		assert.equal(report.reviewer.authority, 'CALLER_SUPPLIED_TRUST_NOT_MACHINE_ATTESTED');
		assert.equal(report.deviceApproval, 'NOT_CLAIMED');
		assert.equal(report.stakeApproval, 'NOT_CLAIMED');
		assert.equal(report.releaseApproval, 'NOT_CLAIMED');
	});
});

test('standalone owner-review flow uses independently supplied evidence bytes and reviewer key', () => {
	withFixture((value) => {
		const signedReview = signedOwnerReview(value);
		const trustRoot = mkdtempSync(join(tmpdir(), 'blacksite-device-review-trust-'));
		const evidencePath = join(value.root, 'device-evidence.json');
		const reviewPath = join(value.root, 'device-owner-review.json');
		const publicKeyPath = join(trustRoot, 'reviewer-public-key.pem');
		writeFileSync(evidencePath, signedReview.evidenceSourceBytes);
		writeFileSync(reviewPath, `${JSON.stringify(signedReview.review, null, 2)}\n`);
		writeFileSync(publicKeyPath, signedReview.publicKeyPem);
		const keyDigest = createHash('sha256').update(signedReview.publicKeyPem).digest('hex');
		try {
			const result = spawnSync(
				process.execPath,
				[
					validatorPath,
					'--owner-review',
					reviewPath,
					'--evidence',
					evidencePath,
					'--attachments-root',
					value.root,
					'--reviewer-public-key',
					publicKeyPath,
					'--expected-reviewer-public-key-sha256',
					keyDigest,
					'--expected-reviewer-id',
					'qa-release-owner',
					'--expected-reviewer-key-id',
					'qa-release-key-2026',
					'--expected-git-sha',
					identity.gitSha,
					'--expected-frontend-tree',
					identity.frontendTreeSha256,
					'--expected-math-tree',
					identity.mathTreeSha256,
					'--expected-math-fingerprint',
					identity.mathCandidateFingerprintSha256,
				],
				{ encoding: 'utf8', env: { ...process.env } },
			);
			assert.equal(result.status, 0, result.stderr);
			const report = JSON.parse(result.stdout);
			assert.equal(report.status, 'SIGNED_OWNER_DECISION_VERIFIED');
			assert.equal(report.reviewJson.binding, 'EXACT_SOURCE_BYTES');
			assert.equal(report.evidenceJson.binding, 'EXACT_SOURCE_BYTES');
			assert.equal(report.reviewer.publicKeySourceSha256, keyDigest);
			assert.equal(report.releaseApproval, 'NOT_CLAIMED');
		} finally {
			rmSync(trustRoot, { recursive: true, force: true });
		}
	});
});

test('standalone owner review rejects bundle-supplied or digest-substituted reviewer keys', () => {
	withFixture((value) => {
		const signedReview = signedOwnerReview(value);
		const evidencePath = join(value.root, 'device-evidence.json');
		const reviewPath = join(value.root, 'device-owner-review.json');
		const publicKeyPath = join(value.root, 'reviewer-public-key.pem');
		writeFileSync(evidencePath, signedReview.evidenceSourceBytes);
		writeFileSync(reviewPath, `${JSON.stringify(signedReview.review, null, 2)}\n`);
		writeFileSync(publicKeyPath, signedReview.publicKeyPem);
		const commonArguments = [
			validatorPath,
			'--owner-review',
			reviewPath,
			'--evidence',
			evidencePath,
			'--attachments-root',
			value.root,
			'--reviewer-public-key',
			publicKeyPath,
			'--expected-reviewer-public-key-sha256',
			createHash('sha256').update(signedReview.publicKeyPem).digest('hex'),
			'--expected-reviewer-id',
			'qa-release-owner',
			'--expected-reviewer-key-id',
			'qa-release-key-2026',
			'--expected-git-sha',
			identity.gitSha,
			'--expected-frontend-tree',
			identity.frontendTreeSha256,
			'--expected-math-tree',
			identity.mathTreeSha256,
			'--expected-math-fingerprint',
			identity.mathCandidateFingerprintSha256,
		];
		const bundled = spawnSync(process.execPath, commonArguments, {
			encoding: 'utf8',
			env: { ...process.env },
		});
		assert.notEqual(bundled.status, 0);
		assert.match(bundled.stderr, /outside the evidence and attachment roots/u);

		const externalRoot = mkdtempSync(join(tmpdir(), 'blacksite-device-review-trust-'));
		try {
			const externalKeyPath = join(externalRoot, 'reviewer-public-key.pem');
			writeFileSync(externalKeyPath, signedReview.publicKeyPem);
			const substituted = spawnSync(
				process.execPath,
				commonArguments.map((argument) =>
					argument === publicKeyPath
						? externalKeyPath
						: argument === createHash('sha256').update(signedReview.publicKeyPem).digest('hex')
							? 'f'.repeat(64)
							: argument,
				),
				{ encoding: 'utf8', env: { ...process.env } },
			);
			assert.notEqual(substituted.status, 0);
			assert.match(substituted.stderr, /digest does not match/u);
		} finally {
			rmSync(externalRoot, { recursive: true, force: true });
		}
	});
});

test('owner review rejects tampering, evidence-byte drift, and ACCEPTED open results', () => {
	withFixture((value) => {
		const signedReview = signedOwnerReview(value);
		signedReview.review.decision.notes = 'Tampered owner decision after the signature was created.';
		assert.throws(() => verifyOwnerReview(value, signedReview), /signature verification failed/u);
	});
	withFixture((value) => {
		const signedReview = signedOwnerReview(value);
		signedReview.evidenceSourceBytes = Buffer.concat([
			signedReview.evidenceSourceBytes,
			Buffer.from(' '),
		]);
		assert.throws(() => verifyOwnerReview(value, signedReview), /byte identity does not match/u);
	});
	withFixture((value) => {
		const result = value.evidence.results.find(
			(candidate) =>
				candidate.environmentId === 'android-floor-device' && candidate.scenarioId === 'talkback',
		);
		markResultNotRun(value, result);
		const signedReview = signedOwnerReview(value, 'ACCEPTED');
		assert.throws(
			() => verifyOwnerReview(value, signedReview),
			/cannot ACCEPT evidence containing/u,
		);
	});
});

test('checked-in schema and starter template stay versioned and scenario-complete', () => {
	const schema = JSON.parse(
		readFileSync(join(repoRoot, 'docs/blacksite/DEVICE_QA_EVIDENCE.schema.json'), 'utf8'),
	);
	const template = JSON.parse(
		readFileSync(join(repoRoot, 'docs/blacksite/DEVICE_QA_EVIDENCE.template.json'), 'utf8'),
	);
	const ownerReviewSchema = JSON.parse(
		readFileSync(join(repoRoot, 'docs/blacksite/DEVICE_QA_OWNER_REVIEW.schema.json'), 'utf8'),
	);
	const ownerReviewTemplate = JSON.parse(
		readFileSync(join(repoRoot, 'docs/blacksite/DEVICE_QA_OWNER_REVIEW.template.json'), 'utf8'),
	);
	assert.equal(schema.properties.schema.const, DEVICE_EVIDENCE_SCHEMA);
	assert.equal(schema.properties.contractVersion.const, DEVICE_QA_CONTRACT_VERSION);
	assert.equal(schema.properties.floorVersion.const, OLD_DEVICE_FLOOR_VERSION);
	assert.equal(template.schema, DEVICE_EVIDENCE_SCHEMA);
	assert.equal(template.claim, 'STRUCTURAL_RECORD_ONLY_NOT_DEVICE_APPROVAL');
	assert.equal(template.claims.deviceApproval, 'NOT_CLAIMED');
	assert.equal(template.claims.releaseApproval, 'NOT_CLAIMED');
	assert.equal(template.attachments.length, 0);
	assert.ok(
		template.environments.every(
			(environment) =>
				environment.provenance.observation === 'NOT_OBSERVED' &&
				environment.provenance.verification === 'UNVERIFIED' &&
				environment.executionMode === 'NOT_EXECUTED' &&
				environment.device.physical === 'NOT_OBSERVED' &&
				(!environment.stakeContainer || environment.stakeContainer.source === 'NOT_OBSERVED'),
		),
	);
	assert.equal(ownerReviewSchema.properties.schema.const, DEVICE_OWNER_REVIEW_SCHEMA);
	assert.equal(ownerReviewTemplate.schema, DEVICE_OWNER_REVIEW_SCHEMA);
	assert.equal(ownerReviewTemplate.claims.stakeApproval, 'NOT_CLAIMED');
	assert.equal(ownerReviewTemplate.claims.releaseApproval, 'NOT_CLAIMED');
	for (const environment of template.environments) {
		const expected = REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind];
		const actual = template.results
			.filter((result) => result.environmentId === environment.id)
			.map((result) => result.scenarioId);
		assert.deepEqual(actual, expected);
	}
	assert.ok(
		template.results.every(
			(result) =>
				result.status === 'NOT_RUN' &&
				result.observedAt === 'NOT_OBSERVED' &&
				result.attachmentIds.length === 0,
		),
	);
	const attachmentRoot = mkdtempSync(join(tmpdir(), 'blacksite-device-template-red-'));
	try {
		assert.throws(
			() =>
				verifyDeviceEvidence(template, {
					expectedIdentity: template.identity,
					attachmentsRoot: attachmentRoot,
					verificationTime,
				}),
			/placeholder|stale/u,
		);
	} finally {
		rmSync(attachmentRoot, { recursive: true, force: true });
	}
});
