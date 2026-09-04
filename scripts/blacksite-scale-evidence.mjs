import {
	createHash,
	createPublicKey,
	generateKeyPairSync,
	sign as signPayload,
	verify as verifySignature,
} from 'node:crypto';
import {
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCALE_EVIDENCE_SCHEMA = 'blacksite-scale-evidence-v7';
export const SCALE_ARTIFACT_BINDING_SCHEMA = 'blacksite-scale-artifact-binding-v3';
export const SCALE_ARTIFACT_ATTESTATION_SCHEMA = 'blacksite-scale-artifact-attestation-v2';
export const SCALE_TRUST_STORE_SCHEMA = 'blacksite-scale-trusted-signers-v4';
export const SCALE_SOURCE_REPORT_SCHEMA = 'blacksite-scale-source-report-v1';
export const SCALE_NORMALIZED_SOURCE_SCHEMA = 'blacksite-scale-normalized-source-v1';
const expectedResilienceScenarios = Object.freeze([
	'cdn-origin-degradation',
	'rgs-http-5xx',
	'provider-timeout',
	'instance-restart',
]);
const requiredArtifactRoles = Object.freeze([
	'load-report',
	'cdn-report',
	'provider-ledger',
	'resilience-report',
	'observability-export',
	'rollback-report',
]);
const requiredLatencyEndpoints = Object.freeze([
	'frontend',
	'authenticate',
	'play',
	'event',
	'endRound',
	'replay',
]);
const requiredSourceKindByRole = Object.freeze({
	'load-report': 'load-generator-export',
	'cdn-report': 'cdn-telemetry-export',
	'provider-ledger': 'provider-idempotency-ledger',
	'resilience-report': 'fault-injection-export',
	'observability-export': 'observability-export',
	'rollback-report': 'rollback-rehearsal-export',
});

function fail(message) {
	throw new Error(message);
}

function requireValue(condition, message) {
	if (!condition) fail(message);
}

function finitePositive(value, name) {
	requireValue(Number.isFinite(value) && value > 0, `${name} must be a positive number`);
}

function positiveInteger(value, name) {
	requireValue(Number.isSafeInteger(value) && value > 0, `${name} must be a positive safe integer`);
}

function nonNegativeInteger(value, name) {
	requireValue(
		Number.isSafeInteger(value) && value >= 0,
		`${name} must be a non-negative safe integer`,
	);
}

function boundedRatio(value, name) {
	requireValue(Number.isFinite(value) && value >= 0 && value <= 1, `${name} must be within 0..1`);
}

function nonEmpty(value, name) {
	requireValue(typeof value === 'string' && value.trim().length > 0, `${name} is required`);
}

function exactHex(value, length, name) {
	requireValue(
		typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value),
		`${name} must be ${length} lowercase hexadecimal characters`,
	);
}

function timestamp(value, name) {
	nonEmpty(value, name);
	const parsed = Date.parse(value);
	requireValue(
		Number.isFinite(parsed) && new Date(parsed).toISOString() === value,
		`${name} must be a canonical UTC ISO-8601 timestamp`,
	);
}

function uniqueNonEmptyStrings(values, name) {
	requireValue(Array.isArray(values) && values.length > 0, `${name} is required`);
	for (const value of values) nonEmpty(value, `${name} entry`);
	requireValue(new Set(values).size === values.length, `${name} must contain unique values`);
}

function exactStringSet(values, expected, name) {
	uniqueNonEmptyStrings(values, name);
	requireValue(
		values.length === expected.length && expected.every((value) => values.includes(value)),
		`${name} must contain the exact required set`,
	);
}

function exactObjectKeys(value, expected, name) {
	requireValue(value && typeof value === 'object' && !Array.isArray(value), `${name} is required`);
	exactStringSet(Object.keys(value), expected, `${name} keys`);
}

function containedRelativePath(root, candidate, name) {
	const fromRoot = relative(root, candidate);
	requireValue(
		fromRoot.length > 0 &&
			fromRoot !== '..' &&
			!fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`),
		`${name} must stay inside the artifacts root`,
	);
}

function requirePathOutsideRoot(root, candidate, name) {
	const fromRoot = relative(root, candidate);
	const parentPrefix = `..${process.platform === 'win32' ? '\\' : '/'}`;
	requireValue(
		fromRoot === '..' || fromRoot.startsWith(parentPrefix) || isAbsolute(fromRoot),
		`${name} must be outside artifacts-root`,
	);
}

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalize(value[key])]),
		);
	}
	return value;
}

function sha256Value(value) {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(value)))
		.digest('hex');
}

function canonicalBytes(value) {
	return Buffer.from(JSON.stringify(canonicalize(value)), 'utf8');
}

function sha256Bytes(value) {
	return createHash('sha256').update(value).digest('hex');
}

function requiredSignerForRole(evidence, role) {
	const byRole = {
		'load-report': evidence.approval.workloadOwner,
		'cdn-report': evidence.approval.platformOwner,
		'provider-ledger': evidence.approval.providerOwner,
		'resilience-report': evidence.approval.providerOwner,
		'observability-export': evidence.approval.platformOwner,
		'rollback-report': evidence.approval.platformOwner,
	};
	requireValue(Object.hasOwn(byRole, role), `artifact role ${role} has no signer owner`);
	return byRole[role];
}

function measurementsForRole(evidence, role) {
	const byRole = {
		'load-report': {
			environment: evidence.environment,
			latency: evidence.latency,
			run: evidence.run,
			workload: evidence.workload,
		},
		'cdn-report': { cdn: evidence.cdn, run: evidence.run },
		'provider-ledger': { idempotency: evidence.idempotency, run: evidence.run },
		'resilience-report': {
			resilience: evidence.resilience,
			run: evidence.run,
			saturation: evidence.saturation,
		},
		'observability-export': { observability: evidence.observability, run: evidence.run },
		'rollback-report': { rollback: evidence.rollback, run: evidence.run },
	};
	requireValue(Object.hasOwn(byRole, role), `artifact role ${role} cannot be bound`);
	return byRole[role];
}

export function createScaleArtifactBinding(evidence, role) {
	return {
		schema: SCALE_ARTIFACT_BINDING_SCHEMA,
		role,
		runId: evidence.run.id,
		identitySha256: sha256Value(evidence.identity),
		measurementsSha256: sha256Value(measurementsForRole(evidence, role)),
	};
}

export function createScaleArtifactProof(evidence, role) {
	return {
		blacksiteScaleBinding: createScaleArtifactBinding(evidence, role),
		blacksiteScaleIdentity: evidence.identity,
		blacksiteScaleMeasurements: measurementsForRole(evidence, role),
	};
}

function sourceRecordsForRole(evidence, role) {
	const byRole = {
		'load-report': [
			{
				type: 'environment',
				productionEquivalent: evidence.environment?.productionEquivalent,
				mocked: evidence.environment?.mocked,
				regions: evidence.environment?.regions,
				dataPolicy: evidence.environment?.dataPolicy,
			},
			{
				type: 'workload-summary',
				achievedPeakConcurrentUsers: evidence.workload?.achievedPeakConcurrentUsers,
				measuredRequests: evidence.workload?.measuredRequests,
				rateWindowStartedAt: evidence.workload?.rateMeasurement?.startedAt,
				rateWindowCompletedAt: evidence.workload?.rateMeasurement?.completedAt,
				rateWindowSeconds: evidence.workload?.rateMeasurement?.windowSeconds,
				rateWindowEndpointRequests: evidence.workload?.rateMeasurement?.endpointRequests,
			},
			...requiredLatencyEndpoints.map((endpoint) => ({
				type: 'endpoint-latency',
				endpoint,
				requests: evidence.latency?.[endpoint]?.requests,
				p50Ms: evidence.latency?.[endpoint]?.p50Ms,
				p95Ms: evidence.latency?.[endpoint]?.p95Ms,
				p99Ms: evidence.latency?.[endpoint]?.p99Ms,
				errorRate: evidence.latency?.[endpoint]?.errorRate,
				timeoutRate: evidence.latency?.[endpoint]?.timeoutRate,
			})),
		],
		'cdn-report': [
			{
				type: 'cdn-summary',
				requests: evidence.cdn?.requests,
				cacheableRequests: evidence.cdn?.cacheableRequests,
				cacheHits: evidence.cdn?.cacheHits,
				originRequests: evidence.cdn?.originRequests,
				originEgressBytes: evidence.cdn?.originEgressBytes,
				invalidationValidated: evidence.cdn?.invalidationValidated,
			},
		],
		'provider-ledger': [{ ...evidence.idempotency, type: 'provider-ledger-summary' }],
		'resilience-report': [
			...evidence.resilience.scenarios.map((scenario) => ({
				...scenario,
				type: 'resilience-scenario',
			})),
			...evidence.saturation.map((metric) => ({ ...metric, type: 'saturation-metric' })),
		],
		'observability-export': [
			...['logs', 'metrics', 'traces'].map((signal) => ({
				type: 'correlation',
				signal,
				correlated: evidence.observability?.[`${signal}Correlated`],
			})),
			{ type: 'dashboard-capture', captured: evidence.observability?.dashboardsCaptured },
			...evidence.observability.alertDrills.map((drill) => ({ ...drill, type: 'alert-drill' })),
		],
		'rollback-report': [{ ...evidence.rollback, type: 'rollback-rehearsal' }],
	};
	requireValue(Object.hasOwn(byRole, role), `artifact role ${role} has no source-record contract`);
	return byRole[role];
}

export function createScaleNormalizedSource(
	evidence,
	role,
	{ sourceSystem, sourceVersion, exportId, capturedAt = evidence.run.completedAt } = {},
) {
	const binding = createScaleArtifactBinding(evidence, role);
	const records = sourceRecordsForRole(evidence, role);
	return {
		blacksiteScaleNormalizedSource: {
			schema: SCALE_NORMALIZED_SOURCE_SCHEMA,
			role,
			runId: evidence.run.id,
			kind: requiredSourceKindByRole[role],
			identitySha256: binding.identitySha256,
			measurementsSha256: binding.measurementsSha256,
			recordsSha256: sha256Value(records),
			sourceSystem,
			sourceVersion,
			exportId,
			capturedAt,
		},
		records,
	};
}

export function createScaleSourceReport(
	evidence,
	role,
	attachments,
	{ generatedAt = evidence.run.completedAt, generatorName, generatorVersion } = {},
) {
	requireValue(
		Object.hasOwn(requiredSourceKindByRole, role),
		`artifact role ${role} has no source-report contract`,
	);
	return {
		schema: SCALE_SOURCE_REPORT_SCHEMA,
		role,
		runId: evidence.run.id,
		generatedAt,
		generator: {
			name: generatorName,
			version: generatorVersion,
		},
		attachments,
	};
}

function createAttestationPayload(evidence, role, unsignedReport, signerId, signedAt) {
	return {
		schema: SCALE_ARTIFACT_ATTESTATION_SCHEMA,
		role,
		runId: evidence.run.id,
		signerId,
		signedAt,
		bindingSha256: sha256Value(createScaleArtifactBinding(evidence, role)),
		reportSha256: sha256Value(unsignedReport),
	};
}

export function createScaleArtifactAttestation(
	evidence,
	role,
	unsignedReport,
	{ signerId, privateKey, signedAt = evidence.run.completedAt },
) {
	const payload = createAttestationPayload(evidence, role, unsignedReport, signerId, signedAt);
	return {
		...payload,
		signatureBase64: signPayload(null, canonicalBytes(payload), privateKey).toString('base64'),
	};
}

function preRunApprovalPlan(evidence) {
	return {
		approval: evidence.approval,
		environment: evidence.environment,
		workload: {
			populationUsers: evidence.workload?.populationUsers,
			peakConcurrentUsers: evidence.workload?.peakConcurrentUsers,
			targetRps: evidence.workload?.targetRps,
			rampSeconds: evidence.workload?.rampSeconds,
			steadyStateSeconds: evidence.workload?.steadyStateSeconds,
			soakSeconds: evidence.workload?.soakSeconds,
			rateMeasurement: {
				windowSeconds: evidence.workload?.rateMeasurement?.windowSeconds,
				minimumEndpointRequests: evidence.workload?.rateMeasurement?.minimumEndpointRequests,
			},
		},
		latencyLimits: Object.fromEntries(
			requiredLatencyEndpoints.map((name) => [name, evidence.latency?.[name]?.limits]),
		),
		cdnLimits: evidence.cdn?.limits,
		resilienceLimits: evidence.resilience?.scenarios?.map((scenario) => ({
			name: scenario?.name,
			limitSeconds: scenario?.limitSeconds,
		})),
		saturationLimits: evidence.saturation?.map((metric) => ({
			name: metric?.name,
			unit: metric?.unit,
			aggregation: metric?.aggregation,
			limit: metric?.limit,
		})),
		alertDrills: evidence.observability?.alertDrills?.map((drill) => drill?.name),
		rollbackLimitSeconds: evidence.rollback?.limitSeconds,
	};
}

export function createScaleTrustStore(evidence, signers) {
	return {
		schema: SCALE_TRUST_STORE_SCHEMA,
		identitySha256: sha256Value(evidence.identity),
		approvedPlanSha256: sha256Value(preRunApprovalPlan(evidence)),
		signers,
	};
}

function verifyTrustedSigners(evidence, trustStore) {
	requireValue(
		trustStore && typeof trustStore === 'object',
		'trusted signer trust store is required',
	);
	requireValue(
		trustStore.schema === SCALE_TRUST_STORE_SCHEMA,
		`trust store schema must be ${SCALE_TRUST_STORE_SCHEMA}`,
	);
	requireValue(
		trustStore.identitySha256 === sha256Value(evidence.identity),
		'trust store release identity does not match evidence',
	);
	requireValue(
		trustStore.approvedPlanSha256 === sha256Value(preRunApprovalPlan(evidence)),
		'trust store pre-run approval plan does not match evidence',
	);
	requireValue(
		Array.isArray(trustStore.signers) && trustStore.signers.length > 0,
		'trusted signers are required',
	);
	const ids = trustStore.signers.map((signer) => signer?.id);
	requireValue(new Set(ids).size === ids.length, 'trusted signer ids must be unique');
	const trusted = new Map();
	const publicKeyFingerprints = new Set();
	for (const signer of trustStore.signers) {
		nonEmpty(signer?.id, 'trusted signer id');
		requireValue(
			Array.isArray(signer.roles) && signer.roles.length > 0,
			`trusted signer ${signer.id}.roles is required`,
		);
		requireValue(
			new Set(signer.roles).size === signer.roles.length,
			`trusted signer ${signer.id}.roles must be unique`,
		);
		for (const role of signer.roles) {
			requireValue(
				requiredArtifactRoles.includes(role),
				`trusted signer ${signer.id} has unknown role ${role}`,
			);
		}
		nonEmpty(signer.publicKeyPem, `trusted signer ${signer.id}.publicKeyPem`);
		let publicKey;
		try {
			publicKey = createPublicKey(signer.publicKeyPem);
		} catch {
			fail(`trusted signer ${signer.id} public key is invalid`);
		}
		requireValue(
			publicKey.asymmetricKeyType === 'ed25519',
			`trusted signer ${signer.id} key must be Ed25519`,
		);
		const publicKeyFingerprint = createHash('sha256')
			.update(publicKey.export({ type: 'spki', format: 'der' }))
			.digest('hex');
		requireValue(
			!publicKeyFingerprints.has(publicKeyFingerprint),
			'trusted signer public keys must be unique across approval owners',
		);
		publicKeyFingerprints.add(publicKeyFingerprint);
		trusted.set(signer.id, { ...signer, publicKey });
	}
	return trusted;
}

function readDigestBoundFile(realRoot, descriptor, label, realPaths) {
	nonEmpty(descriptor?.name, `${label}.name`);
	requireValue(!isAbsolute(descriptor.name), `${label}.name must be relative`);
	requireValue(!descriptor.name.includes('\\'), `${label}.name must use portable separators`);
	requireValue(
		descriptor.name
			.split('/')
			.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
		`${label}.name contains an unsafe path segment`,
	);
	positiveInteger(descriptor?.bytes, `${label}.bytes`);
	exactHex(descriptor?.sha256, 64, `${label}.sha256`);

	const candidate = resolve(realRoot, descriptor.name);
	containedRelativePath(realRoot, candidate, `${label}.name`);
	const candidateStat = lstatSync(candidate, { throwIfNoEntry: false });
	requireValue(candidateStat, `${label} is missing`);
	requireValue(candidateStat.isSymbolicLink() === false, `${label} must not be a symbolic link`);
	requireValue(candidateStat.isFile() === true, `${label} must be a regular file`);

	const realCandidate = realpathSync(candidate);
	containedRelativePath(realRoot, realCandidate, `${label}.realPath`);
	requireValue(!realPaths.has(realCandidate), 'scale evidence files must be unique');
	realPaths.add(realCandidate);
	requireValue(candidateStat.size === descriptor.bytes, `${label}.bytes mismatch`);
	const content = readFileSync(realCandidate);
	requireValue(content.byteLength === descriptor.bytes, `${label}.bytes changed during readback`);
	const digest = sha256Bytes(content);
	requireValue(digest === descriptor.sha256, `${label}.sha256 mismatch`);
	return { bytes: candidateStat.size, content, name: descriptor.name, sha256: digest };
}

function parseStructuredJson(content, label) {
	let parsed;
	try {
		parsed = JSON.parse(content.toString('utf8'));
	} catch {
		fail(`${label} must be structured JSON`);
	}
	requireValue(
		parsed && typeof parsed === 'object' && !Array.isArray(parsed),
		`${label} must contain a JSON object`,
	);
	return parsed;
}

function verifyScaleSourceReport(
	evidence,
	role,
	sourceReport,
	attestation,
	verificationTime,
	realRoot,
	realPaths,
) {
	requireValue(
		sourceReport && typeof sourceReport === 'object' && !Array.isArray(sourceReport),
		`artifact ${role} source report is required`,
	);
	requireValue(
		sourceReport.schema === SCALE_SOURCE_REPORT_SCHEMA,
		`artifact ${role} source report schema must be ${SCALE_SOURCE_REPORT_SCHEMA}`,
	);
	requireValue(sourceReport.role === role, `artifact ${role} source report role mismatch`);
	requireValue(
		sourceReport.runId === evidence.run.id,
		`artifact ${role} source report runId mismatch`,
	);
	timestamp(sourceReport.generatedAt, `artifact ${role}.sourceReport.generatedAt`);
	requireValue(
		Date.parse(sourceReport.generatedAt) >= Date.parse(evidence.run.completedAt),
		`artifact ${role} source report was generated before the run completed`,
	);
	requireValue(
		Date.parse(sourceReport.generatedAt) <= Date.parse(attestation.signedAt),
		`artifact ${role} source report was generated after its attestation`,
	);
	requireValue(
		Date.parse(sourceReport.generatedAt) <= verificationTime,
		`artifact ${role} source report is in the future relative to verification time`,
	);
	nonEmpty(sourceReport.generator?.name, `artifact ${role}.sourceReport.generator.name`);
	nonEmpty(sourceReport.generator?.version, `artifact ${role}.sourceReport.generator.version`);
	requireValue(
		Array.isArray(sourceReport.attachments) && sourceReport.attachments.length > 0,
		`artifact ${role} source attachments are required`,
	);

	const attachmentNames = sourceReport.attachments.map((attachment) => attachment?.name);
	const attachmentKinds = sourceReport.attachments.map((attachment) => attachment?.kind);
	uniqueNonEmptyStrings(attachmentNames, `artifact ${role} source attachment names`);
	uniqueNonEmptyStrings(attachmentKinds, `artifact ${role} source attachment kinds`);
	requireValue(
		attachmentKinds.includes(requiredSourceKindByRole[role]),
		`artifact ${role} is missing required ${requiredSourceKindByRole[role]} source attachment`,
	);

	const expectedBinding = createScaleArtifactBinding(evidence, role);
	const verifiedAttachments = [];
	for (const attachment of sourceReport.attachments) {
		requireValue(
			attachment.mediaType === 'application/json',
			`artifact ${role} source attachment ${attachment.kind}.mediaType must be application/json`,
		);
		const readback = readDigestBoundFile(
			realRoot,
			attachment,
			`artifact ${role} source attachment ${attachment.kind}`,
			realPaths,
		);
		const sourceDocument = parseStructuredJson(
			readback.content,
			`artifact ${role} source attachment ${attachment.kind}`,
		);
		const normalizedSource = sourceDocument.blacksiteScaleNormalizedSource;
		requireValue(
			normalizedSource && typeof normalizedSource === 'object' && !Array.isArray(normalizedSource),
			`artifact ${role} source attachment ${attachment.kind} normalized-source header is required`,
		);
		requireValue(
			normalizedSource.schema === SCALE_NORMALIZED_SOURCE_SCHEMA,
			`artifact ${role} source attachment ${attachment.kind} normalized-source schema must be ${SCALE_NORMALIZED_SOURCE_SCHEMA}`,
		);
		requireValue(
			normalizedSource.role === role,
			`artifact ${role} source attachment ${attachment.kind} normalized-source role mismatch`,
		);
		requireValue(
			normalizedSource.runId === evidence.run.id,
			`artifact ${role} source attachment ${attachment.kind} normalized-source runId mismatch`,
		);
		requireValue(
			normalizedSource.kind === attachment.kind,
			`artifact ${role} source attachment ${attachment.kind} normalized-source kind mismatch`,
		);
		requireValue(
			normalizedSource.identitySha256 === expectedBinding.identitySha256,
			`artifact ${role} source attachment ${attachment.kind} normalized-source identity mismatch`,
		);
		requireValue(
			normalizedSource.measurementsSha256 === expectedBinding.measurementsSha256,
			`artifact ${role} source attachment ${attachment.kind} normalized-source measurements mismatch`,
		);
		exactHex(
			normalizedSource.recordsSha256,
			64,
			`artifact ${role} source attachment ${attachment.kind}.recordsSha256`,
		);
		nonEmpty(
			normalizedSource.sourceSystem,
			`artifact ${role} source attachment ${attachment.kind}.sourceSystem`,
		);
		nonEmpty(
			normalizedSource.sourceVersion,
			`artifact ${role} source attachment ${attachment.kind}.sourceVersion`,
		);
		nonEmpty(
			normalizedSource.exportId,
			`artifact ${role} source attachment ${attachment.kind}.exportId`,
		);
		timestamp(
			normalizedSource.capturedAt,
			`artifact ${role} source attachment ${attachment.kind}.capturedAt`,
		);
		requireValue(
			Date.parse(normalizedSource.capturedAt) >= Date.parse(evidence.run.startedAt),
			`artifact ${role} source attachment ${attachment.kind} predates the run`,
		);
		requireValue(
			Date.parse(normalizedSource.capturedAt) <= Date.parse(sourceReport.generatedAt),
			`artifact ${role} source attachment ${attachment.kind} postdates its source report`,
		);
		requireValue(
			Array.isArray(sourceDocument.records) &&
				sourceDocument.records.length > 0 &&
				sourceDocument.records.every(
					(record) =>
						record &&
						typeof record === 'object' &&
						!Array.isArray(record) &&
						Object.keys(record).length > 0,
				),
			`artifact ${role} source attachment ${attachment.kind} must contain non-empty source records`,
		);
		const recordsSha256 = sha256Value(sourceDocument.records);
		requireValue(
			recordsSha256 === normalizedSource.recordsSha256,
			`artifact ${role} source attachment ${attachment.kind} recordsSha256 mismatch`,
		);
		requireValue(
			recordsSha256 === sha256Value(sourceRecordsForRole(evidence, role)),
			`artifact ${role} source attachment ${attachment.kind} does not contain the required role-specific source records`,
		);
		verifiedAttachments.push({
			kind: attachment.kind,
			name: readback.name,
			bytes: readback.bytes,
			sha256: readback.sha256,
			sourceSystem: normalizedSource.sourceSystem,
			sourceVersion: normalizedSource.sourceVersion,
			exportId: normalizedSource.exportId,
			capturedAt: normalizedSource.capturedAt,
			recordCount: sourceDocument.records.length,
			recordsSha256,
		});
	}
	return verifiedAttachments;
}

export async function verifyScaleEvidenceArtifacts(evidence, artifactsRoot, trustStore) {
	const verifiedAt = new Date().toISOString();
	const verificationTime = Date.parse(verifiedAt);
	verifyScaleEvidence(evidence);
	nonEmpty(artifactsRoot, 'artifacts-root');
	const trustedSigners = verifyTrustedSigners(evidence, trustStore);
	const rootStat = lstatSync(artifactsRoot, { throwIfNoEntry: false });
	requireValue(
		rootStat?.isDirectory() === true && rootStat.isSymbolicLink() === false,
		'artifacts-root must be a real directory',
	);
	const realRoot = realpathSync(artifactsRoot);
	const names = evidence.artifacts.map((artifact) => artifact?.name);
	uniqueNonEmptyStrings(names, 'artifact names');

	const realPaths = new Set();
	const verifiedArtifacts = [];
	for (const artifact of evidence.artifacts) {
		const readback = readDigestBoundFile(
			realRoot,
			artifact,
			`artifact ${artifact.role}`,
			realPaths,
		);
		const parsed = parseStructuredJson(readback.content, `artifact ${artifact.role}`);
		const binding = parsed?.blacksiteScaleBinding;
		requireValue(
			binding && typeof binding === 'object',
			`artifact ${artifact.role} structured binding is required`,
		);
		const expectedBinding = createScaleArtifactBinding(evidence, artifact.role);
		for (const key of ['schema', 'role', 'runId', 'identitySha256', 'measurementsSha256']) {
			requireValue(
				binding[key] === expectedBinding[key],
				`artifact ${artifact.role} binding.${key} mismatch`,
			);
		}
		requireValue(
			sha256Value(parsed.blacksiteScaleIdentity) === binding.identitySha256,
			`artifact ${artifact.role} embedded identity does not match its binding`,
		);
		requireValue(
			sha256Value(parsed.blacksiteScaleMeasurements) === binding.measurementsSha256,
			`artifact ${artifact.role} embedded measurements do not match its binding`,
		);
		const attestation = parsed.blacksiteScaleAttestation;
		requireValue(
			attestation && typeof attestation === 'object',
			`artifact ${artifact.role} signer attestation is required`,
		);
		const expectedSignerId = requiredSignerForRole(evidence, artifact.role);
		requireValue(
			attestation.signerId === expectedSignerId,
			`artifact ${artifact.role} signer does not match its approved owner`,
		);
		const trustedSigner = trustedSigners.get(attestation.signerId);
		requireValue(
			trustedSigner,
			`artifact ${artifact.role} signer is not in the trusted signer store`,
		);
		requireValue(
			trustedSigner.roles.includes(artifact.role),
			`artifact ${artifact.role} signer is not trusted for this role`,
		);
		timestamp(attestation.signedAt, `artifact ${artifact.role}.attestation.signedAt`);
		requireValue(
			Date.parse(attestation.signedAt) >= Date.parse(evidence.run.completedAt),
			`artifact ${artifact.role} was attested before the run completed`,
		);
		requireValue(
			Date.parse(attestation.signedAt) <= verificationTime,
			`artifact ${artifact.role} attestation is in the future relative to verification time`,
		);
		requireValue(
			Date.parse(attestation.signedAt) - Date.parse(evidence.run.completedAt) <=
				evidence.approval.maxAttestationDelaySeconds * 1000,
			`artifact ${artifact.role} attestation exceeded the approved signing delay`,
		);
		nonEmpty(attestation.signatureBase64, `artifact ${artifact.role}.attestation.signatureBase64`);
		let signature;
		try {
			signature = Buffer.from(attestation.signatureBase64, 'base64');
		} catch {
			fail(`artifact ${artifact.role} attestation signature is invalid base64`);
		}
		requireValue(
			signature.length > 0 && signature.toString('base64') === attestation.signatureBase64,
			`artifact ${artifact.role} attestation signature is invalid base64`,
		);
		const unsignedReport = { ...parsed };
		delete unsignedReport.blacksiteScaleAttestation;
		const expectedAttestation = createAttestationPayload(
			evidence,
			artifact.role,
			unsignedReport,
			attestation.signerId,
			attestation.signedAt,
		);
		for (const key of [
			'schema',
			'role',
			'runId',
			'signerId',
			'signedAt',
			'bindingSha256',
			'reportSha256',
		]) {
			requireValue(
				attestation[key] === expectedAttestation[key],
				`artifact ${artifact.role} attestation.${key} mismatch`,
			);
		}
		requireValue(
			verifySignature(
				null,
				canonicalBytes(expectedAttestation),
				trustedSigner.publicKey,
				signature,
			),
			`artifact ${artifact.role} attestation signature is not valid`,
		);
		const verifiedSourceAttachments = verifyScaleSourceReport(
			evidence,
			artifact.role,
			parsed.blacksiteScaleSourceReport,
			attestation,
			verificationTime,
			realRoot,
			realPaths,
		);
		verifiedArtifacts.push({
			role: artifact.role,
			name: artifact.name,
			bytes: readback.bytes,
			sha256: readback.sha256,
			signerId: attestation.signerId,
			signedAt: attestation.signedAt,
			sourceAttachments: verifiedSourceAttachments,
		});
	}

	return {
		status: 'STRUCTURALLY_VALID',
		claim: 'SUPPLIED_SIGNED_ARTIFACT_STRUCTURE_AND_READBACK_VALIDATED',
		verifiedAt,
		verifiedArtifacts,
		validationScope: {
			validated: [
				'supplied-evidence-schema-and-cross-field-consistency',
				'supplied-trust-plan-binding',
				'artifact-file-digest-readback',
				'role-owner-signatures',
				'freshness',
			],
			notValidated: [
				'evidence-file-provenance',
				'trust-store-file-provenance',
				'tool-native-export-semantics',
				'physical-load-execution',
				'production-capacity',
				'external-release-approval',
			],
		},
		warning:
			'This validates the structure and consistency of supplied evidence and trust objects plus signed artifact readback; it does not establish their file provenance, tool-native semantics, physical execution, capacity, or release approval.',
	};
}

function verifyLatencyMetric(name, metric) {
	requireValue(metric && typeof metric === 'object', `latency.${name} is required`);
	positiveInteger(metric.requests, `latency.${name}.requests`);
	for (const key of ['p50Ms', 'p95Ms', 'p99Ms'])
		finitePositive(metric[key], `latency.${name}.${key}`);
	requireValue(
		metric.p50Ms <= metric.p95Ms && metric.p95Ms <= metric.p99Ms,
		`latency.${name} percentiles must be monotonic`,
	);
	boundedRatio(metric.errorRate, `latency.${name}.errorRate`);
	boundedRatio(metric.timeoutRate, `latency.${name}.timeoutRate`);
	requireValue(
		metric.limits && typeof metric.limits === 'object',
		`latency.${name}.limits is required`,
	);
	finitePositive(metric.limits.p95Ms, `latency.${name}.limits.p95Ms`);
	finitePositive(metric.limits.p99Ms, `latency.${name}.limits.p99Ms`);
	boundedRatio(metric.limits.errorRate, `latency.${name}.limits.errorRate`);
	boundedRatio(metric.limits.timeoutRate, `latency.${name}.limits.timeoutRate`);
	requireValue(metric.p95Ms <= metric.limits.p95Ms, `latency.${name}.p95Ms exceeds approved limit`);
	requireValue(metric.p99Ms <= metric.limits.p99Ms, `latency.${name}.p99Ms exceeds approved limit`);
	requireValue(
		metric.errorRate <= metric.limits.errorRate,
		`latency.${name}.errorRate exceeds approved limit`,
	);
	requireValue(
		metric.timeoutRate <= metric.limits.timeoutRate,
		`latency.${name}.timeoutRate exceeds approved limit`,
	);
}

export function verifyScaleEvidence(evidence, expected = {}) {
	const verifiedAt = new Date().toISOString();
	const verificationTime = Date.parse(verifiedAt);
	requireValue(
		evidence && typeof evidence === 'object' && !Array.isArray(evidence),
		'evidence must be an object',
	);
	requireValue(
		evidence.schema === SCALE_EVIDENCE_SCHEMA,
		`schema must be ${SCALE_EVIDENCE_SCHEMA}`,
	);

	exactHex(evidence.identity?.gitSha, 40, 'identity.gitSha');
	exactHex(evidence.identity?.frontendTreeSha256, 64, 'identity.frontendTreeSha256');
	exactHex(evidence.identity?.mathTreeSha256, 64, 'identity.mathTreeSha256');
	exactHex(evidence.identity?.providerReleaseSha256, 64, 'identity.providerReleaseSha256');
	exactHex(evidence.identity?.cdnReleaseSha256, 64, 'identity.cdnReleaseSha256');
	exactHex(evidence.identity?.rgsReleaseSha256, 64, 'identity.rgsReleaseSha256');
	exactHex(evidence.identity?.environmentConfigSha256, 64, 'identity.environmentConfigSha256');
	if (expected.gitSha)
		requireValue(evidence.identity.gitSha === expected.gitSha, 'identity.gitSha mismatch');
	if (expected.frontendTreeSha256) {
		requireValue(
			evidence.identity.frontendTreeSha256 === expected.frontendTreeSha256,
			'identity.frontendTreeSha256 mismatch',
		);
	}
	if (expected.mathTreeSha256)
		requireValue(
			evidence.identity.mathTreeSha256 === expected.mathTreeSha256,
			'identity.mathTreeSha256 mismatch',
		);

	requireValue(evidence.approval?.status === 'approved', 'approval.status must be approved');
	timestamp(evidence.approval?.approvedAt, 'approval.approvedAt');
	nonEmpty(evidence.approval?.evidenceRef, 'approval.evidenceRef');
	nonEmpty(evidence.approval?.workloadOwner, 'approval.workloadOwner');
	nonEmpty(evidence.approval?.providerOwner, 'approval.providerOwner');
	nonEmpty(evidence.approval?.platformOwner, 'approval.platformOwner');
	const approvalOwners = [
		evidence.approval.workloadOwner,
		evidence.approval.providerOwner,
		evidence.approval.platformOwner,
	];
	requireValue(
		new Set(approvalOwners).size === approvalOwners.length,
		'approval owners must be distinct',
	);
	positiveInteger(evidence.approval?.evidenceValiditySeconds, 'approval.evidenceValiditySeconds');
	positiveInteger(
		evidence.approval?.maxAttestationDelaySeconds,
		'approval.maxAttestationDelaySeconds',
	);

	requireValue(
		evidence.environment?.productionEquivalent === true,
		'environment must be production-equivalent',
	);
	requireValue(
		evidence.environment?.mocked === false,
		'mocked environment evidence is not accepted',
	);
	uniqueNonEmptyStrings(evidence.environment?.regions, 'environment.regions');
	nonEmpty(evidence.environment?.dataPolicy, 'environment.dataPolicy');

	requireValue(
		evidence.workload?.populationUsers === 1_000_000,
		'workload.populationUsers must bind the one-million-user planning population',
	);
	positiveInteger(evidence.workload?.peakConcurrentUsers, 'workload.peakConcurrentUsers');
	positiveInteger(
		evidence.workload?.achievedPeakConcurrentUsers,
		'workload.achievedPeakConcurrentUsers',
	);
	finitePositive(evidence.workload?.targetRps, 'workload.targetRps');
	for (const key of ['rampSeconds', 'steadyStateSeconds', 'soakSeconds'])
		positiveInteger(evidence.workload?.[key], `workload.${key}`);
	requireValue(
		evidence.workload.achievedPeakConcurrentUsers >= evidence.workload.peakConcurrentUsers,
		'approved peak concurrency was not achieved',
	);
	timestamp(evidence.run?.startedAt, 'run.startedAt');
	timestamp(evidence.run?.completedAt, 'run.completedAt');
	nonEmpty(evidence.run?.id, 'run.id');
	requireValue(
		Date.parse(evidence.approval.approvedAt) <= Date.parse(evidence.run.startedAt),
		'workload and limits must be approved before the run starts',
	);
	requireValue(
		Date.parse(evidence.run.completedAt) > Date.parse(evidence.run.startedAt),
		'run duration is invalid',
	);
	requireValue(
		Date.parse(evidence.run.completedAt) <= verificationTime,
		'run.completedAt is in the future relative to verification time',
	);
	const runDurationSeconds =
		(Date.parse(evidence.run.completedAt) - Date.parse(evidence.run.startedAt)) / 1000;
	const claimedPhaseSeconds =
		evidence.workload.rampSeconds +
		evidence.workload.steadyStateSeconds +
		evidence.workload.soakSeconds;
	requireValue(
		runDurationSeconds >= claimedPhaseSeconds,
		'run duration is shorter than the claimed workload phase duration',
	);
	requireValue(
		verificationTime - Date.parse(evidence.run.completedAt) <=
			evidence.approval.evidenceValiditySeconds * 1000,
		'scale evidence has exceeded the approved validity period',
	);

	for (const name of requiredLatencyEndpoints) verifyLatencyMetric(name, evidence.latency?.[name]);
	positiveInteger(evidence.workload?.measuredRequests, 'workload.measuredRequests');
	const measuredEndpointRequests = requiredLatencyEndpoints.reduce((sum, name) => {
		positiveInteger(evidence.latency[name].requests, `latency.${name}.requests`);
		return sum + evidence.latency[name].requests;
	}, 0);
	positiveInteger(measuredEndpointRequests, 'summed endpoint request samples');
	requireValue(
		evidence.workload.measuredRequests === measuredEndpointRequests,
		'workload.measuredRequests must equal the sum of endpoint request samples',
	);

	const rateMeasurement = evidence.workload?.rateMeasurement;
	requireValue(
		rateMeasurement && typeof rateMeasurement === 'object' && !Array.isArray(rateMeasurement),
		'workload.rateMeasurement is required',
	);
	positiveInteger(rateMeasurement.windowSeconds, 'workload.rateMeasurement.windowSeconds');
	timestamp(rateMeasurement.startedAt, 'workload.rateMeasurement.startedAt');
	timestamp(rateMeasurement.completedAt, 'workload.rateMeasurement.completedAt');
	const rateWindowStart = Date.parse(rateMeasurement.startedAt);
	const rateWindowEnd = Date.parse(rateMeasurement.completedAt);
	requireValue(rateWindowEnd > rateWindowStart, 'workload.rateMeasurement window is invalid');
	requireValue(
		(rateWindowEnd - rateWindowStart) / 1000 === rateMeasurement.windowSeconds,
		'workload.rateMeasurement timestamps must equal the approved windowSeconds',
	);
	const steadyStateStart =
		Date.parse(evidence.run.startedAt) + evidence.workload.rampSeconds * 1000;
	const steadyStateEnd = steadyStateStart + evidence.workload.steadyStateSeconds * 1000;
	requireValue(
		rateWindowStart >= steadyStateStart && rateWindowEnd <= steadyStateEnd,
		'workload.rateMeasurement must stay inside the steady-state phase',
	);
	exactObjectKeys(
		rateMeasurement.endpointRequests,
		requiredLatencyEndpoints,
		'workload.rateMeasurement.endpointRequests',
	);
	exactObjectKeys(
		rateMeasurement.minimumEndpointRequests,
		requiredLatencyEndpoints,
		'workload.rateMeasurement.minimumEndpointRequests',
	);
	let rateWindowRequests = 0;
	for (const name of requiredLatencyEndpoints) {
		positiveInteger(
			rateMeasurement.endpointRequests[name],
			`workload.rateMeasurement.endpointRequests.${name}`,
		);
		positiveInteger(
			rateMeasurement.minimumEndpointRequests[name],
			`workload.rateMeasurement.minimumEndpointRequests.${name}`,
		);
		requireValue(
			rateMeasurement.endpointRequests[name] >= rateMeasurement.minimumEndpointRequests[name],
			`workload.rateMeasurement.endpointRequests.${name} is below the approved minimum`,
		);
		requireValue(
			rateMeasurement.endpointRequests[name] <= evidence.latency[name].requests,
			`workload.rateMeasurement.endpointRequests.${name} exceeds the endpoint request total`,
		);
		rateWindowRequests += rateMeasurement.endpointRequests[name];
	}
	positiveInteger(rateWindowRequests, 'summed rate-window endpoint requests');
	const achievedRps = rateWindowRequests / rateMeasurement.windowSeconds;
	requireValue(
		achievedRps >= evidence.workload.targetRps,
		'approved request rate was not achieved by the measured request window',
	);

	positiveInteger(evidence.cdn?.requests, 'cdn.requests');
	positiveInteger(evidence.cdn?.cacheableRequests, 'cdn.cacheableRequests');
	nonNegativeInteger(evidence.cdn?.cacheHits, 'cdn.cacheHits');
	nonNegativeInteger(evidence.cdn?.originRequests, 'cdn.originRequests');
	nonNegativeInteger(evidence.cdn?.originEgressBytes, 'cdn.originEgressBytes');
	requireValue(
		evidence.cdn.cacheableRequests <= evidence.cdn.requests,
		'cdn.cacheableRequests exceeds requests',
	);
	requireValue(
		evidence.cdn.cacheHits <= evidence.cdn.cacheableRequests,
		'cdn.cacheHits exceeds cacheableRequests',
	);
	requireValue(
		evidence.cdn.originRequests <= evidence.cdn.requests,
		'cdn.originRequests exceeds requests',
	);
	requireValue(
		evidence.cdn.cacheHits + evidence.cdn.originRequests <= evidence.cdn.requests,
		'cdn cache-hit and origin request counters exceed total requests',
	);
	const cacheHitRate = evidence.cdn.cacheHits / evidence.cdn.cacheableRequests;
	const originRequestRatio = evidence.cdn.originRequests / evidence.cdn.requests;
	boundedRatio(evidence.cdn.limits?.minCacheHitRate, 'cdn.limits.minCacheHitRate');
	boundedRatio(evidence.cdn.limits?.maxOriginRequestRatio, 'cdn.limits.maxOriginRequestRatio');
	positiveInteger(evidence.cdn.limits?.maxOriginEgressBytes, 'cdn.limits.maxOriginEgressBytes');
	requireValue(
		cacheHitRate >= evidence.cdn.limits.minCacheHitRate,
		'CDN cache hit rate is below approved limit',
	);
	requireValue(
		originRequestRatio <= evidence.cdn.limits.maxOriginRequestRatio,
		'CDN origin ratio exceeds approved limit',
	);
	requireValue(
		evidence.cdn.originEgressBytes <= evidence.cdn.limits.maxOriginEgressBytes,
		'CDN origin egress exceeds approved limit',
	);
	requireValue(evidence.cdn.invalidationValidated === true, 'CDN invalidation was not validated');

	positiveInteger(evidence.idempotency?.paidPlayAttempts, 'idempotency.paidPlayAttempts');
	positiveInteger(evidence.idempotency?.settlementAttempts, 'idempotency.settlementAttempts');
	nonNegativeInteger(
		evidence.idempotency?.uncertainRecoveryCases,
		'idempotency.uncertainRecoveryCases',
	);
	requireValue(
		evidence.idempotency.paidPlayAttempts === evidence.latency.play.requests,
		'idempotency.paidPlayAttempts must equal latency.play.requests',
	);
	requireValue(
		evidence.idempotency.settlementAttempts === evidence.latency.endRound.requests,
		'idempotency.settlementAttempts must equal latency.endRound.requests',
	);
	requireValue(
		evidence.idempotency.uncertainRecoveryCases <=
			evidence.idempotency.paidPlayAttempts + evidence.idempotency.settlementAttempts,
		'idempotency.uncertainRecoveryCases exceeds eligible wallet attempts',
	);
	for (const key of [
		'duplicateAcceptedPaidPlays',
		'duplicateSettlements',
		'negativeBalances',
		'payoutMismatches',
		'uncertainRecoveryDuplicateWrites',
	]) {
		nonNegativeInteger(evidence.idempotency?.[key], `idempotency.${key}`);
		requireValue(evidence.idempotency[key] === 0, `idempotency.${key} must be zero`);
	}

	requireValue(Array.isArray(evidence.resilience?.scenarios), 'resilience.scenarios is required');
	const resilienceNames = evidence.resilience.scenarios.map((scenario) => scenario?.name);
	exactStringSet(resilienceNames, expectedResilienceScenarios, 'resilience scenario names');
	for (const scenario of evidence.resilience.scenarios) {
		const { name } = scenario;
		requireValue(scenario?.executed === true, `resilience scenario ${name} was not executed`);
		requireValue(scenario?.recovered === true, `resilience scenario ${name} did not recover`);
		nonNegativeInteger(scenario?.duplicateWrites, `resilience scenario ${name}.duplicateWrites`);
		requireValue(
			scenario?.duplicateWrites === 0,
			`resilience scenario ${name} produced duplicate writes`,
		);
		finitePositive(scenario?.recoverySeconds, `resilience scenario ${name}.recoverySeconds`);
		finitePositive(scenario?.limitSeconds, `resilience scenario ${name}.limitSeconds`);
		requireValue(
			scenario.recoverySeconds <= scenario.limitSeconds,
			`resilience scenario ${name} exceeded recovery limit`,
		);
	}

	requireValue(
		Array.isArray(evidence.saturation) && evidence.saturation.length > 0,
		'saturation metrics are required',
	);
	uniqueNonEmptyStrings(
		evidence.saturation.map((metric) => metric?.name),
		'saturation metric names',
	);
	for (const metric of evidence.saturation) {
		nonEmpty(metric?.unit, `saturation.${metric?.name}.unit`);
		nonEmpty(metric?.aggregation, `saturation.${metric?.name}.aggregation`);
		requireValue(
			Number.isFinite(metric?.maxObserved) && metric.maxObserved >= 0,
			`saturation.${metric?.name}.maxObserved is invalid`,
		);
		finitePositive(metric?.limit, `saturation.${metric?.name}.limit`);
		requireValue(
			metric.maxObserved <= metric.limit,
			`saturation.${metric.name} exceeds approved limit`,
		);
	}

	for (const key of [
		'logsCorrelated',
		'metricsCorrelated',
		'tracesCorrelated',
		'dashboardsCaptured',
	]) {
		requireValue(evidence.observability?.[key] === true, `observability.${key} must be true`);
	}
	requireValue(
		Array.isArray(evidence.observability?.alertDrills),
		'observability.alertDrills is required',
	);
	uniqueNonEmptyStrings(
		evidence.observability.alertDrills.map((drill) => drill?.name),
		'observability alert drill names',
	);
	requireValue(
		evidence.observability.alertDrills.every(
			(drill) => drill?.fired === true && drill?.acknowledged === true,
		),
		'observability alert drills must fire and be acknowledged',
	);

	requireValue(evidence.rollback?.executed === true, 'rollback rehearsal was not executed');
	requireValue(evidence.rollback?.healthyAfterRollback === true, 'rollback did not restore health');
	finitePositive(evidence.rollback?.recoverySeconds, 'rollback.recoverySeconds');
	finitePositive(evidence.rollback?.limitSeconds, 'rollback.limitSeconds');
	requireValue(
		evidence.rollback.recoverySeconds <= evidence.rollback.limitSeconds,
		'rollback exceeded approved limit',
	);

	requireValue(Array.isArray(evidence.artifacts), 'evidence artifacts are required');
	const artifactRoles = evidence.artifacts.map((artifact) => artifact?.role);
	exactStringSet(artifactRoles, requiredArtifactRoles, 'artifact roles');
	for (const artifact of evidence.artifacts) {
		nonEmpty(artifact?.role, 'artifact.role');
		nonEmpty(artifact?.name, 'artifact.name');
		requireValue(artifact?.runId === evidence.run.id, `artifact ${artifact?.role}.runId mismatch`);
		positiveInteger(artifact?.bytes, `artifact ${artifact?.role}.bytes`);
		exactHex(artifact?.sha256, 64, `artifact ${artifact?.name}.sha256`);
	}

	return {
		schema: SCALE_EVIDENCE_SCHEMA,
		status: 'STRUCTURALLY_VALID',
		claim: 'SUPPLIED_SCALE_METADATA_SCHEMA_AND_CONSISTENCY_VALIDATED',
		verifiedAt,
		identity: evidence.identity,
		approvedWorkload: {
			populationUsers: evidence.workload.populationUsers,
			peakConcurrentUsers: evidence.workload.peakConcurrentUsers,
			targetRps: evidence.workload.targetRps,
		},
		achievedWorkload: {
			peakConcurrentUsers: evidence.workload.achievedPeakConcurrentUsers,
			rps: achievedRps,
			rateWindowRequests,
			rateWindowSeconds: rateMeasurement.windowSeconds,
		},
		cdn: { cacheHitRate, originRequestRatio },
		warning:
			'Schema and cross-field consistency validation only; supplied measurements are not independently observed and do not prove physical execution or capacity.',
	};
}

export function createSelfTestEvidence() {
	const completedAtMs = Date.now() - 60_000;
	const startedAtMs = completedAtMs - 7_200_000;
	const approvedAtMs = startedAtMs - 60_000;
	const rateMeasurementStartedAtMs = startedAtMs + 900_000;
	const latency = Object.fromEntries(
		['frontend', 'authenticate', 'play', 'event', 'endRound', 'replay'].map((name) => [
			name,
			{
				requests: 300_000,
				p50Ms: 40,
				p95Ms: 90,
				p99Ms: 140,
				errorRate: 0.0005,
				timeoutRate: 0.0001,
				limits: { p95Ms: 100, p99Ms: 150, errorRate: 0.001, timeoutRate: 0.0005 },
			},
		]),
	);
	return {
		schema: SCALE_EVIDENCE_SCHEMA,
		identity: {
			gitSha: 'a'.repeat(40),
			frontendTreeSha256: 'b'.repeat(64),
			mathTreeSha256: 'c'.repeat(64),
			providerReleaseSha256: 'd'.repeat(64),
			cdnReleaseSha256: 'e'.repeat(64),
			rgsReleaseSha256: 'f'.repeat(64),
			environmentConfigSha256: '1'.repeat(64),
		},
		approval: {
			status: 'approved',
			approvedAt: new Date(approvedAtMs).toISOString(),
			evidenceRef: 'change-test-approved-001',
			workloadOwner: 'test-workload-owner',
			providerOwner: 'test-provider-owner',
			platformOwner: 'test-platform-owner',
			evidenceValiditySeconds: 86_400,
			maxAttestationDelaySeconds: 30,
		},
		environment: {
			productionEquivalent: true,
			mocked: false,
			regions: ['eu-test-1'],
			dataPolicy: 'approved synthetic non-player funds',
		},
		workload: {
			populationUsers: 1_000_000,
			peakConcurrentUsers: 100_000,
			targetRps: 25_000,
			achievedPeakConcurrentUsers: 100_000,
			measuredRequests: 1_800_000,
			rampSeconds: 900,
			steadyStateSeconds: 1800,
			soakSeconds: 3600,
			rateMeasurement: {
				windowSeconds: 60,
				startedAt: new Date(rateMeasurementStartedAtMs).toISOString(),
				completedAt: new Date(rateMeasurementStartedAtMs + 60_000).toISOString(),
				endpointRequests: Object.fromEntries(
					requiredLatencyEndpoints.map((name) => [name, 250_000]),
				),
				minimumEndpointRequests: Object.fromEntries(
					requiredLatencyEndpoints.map((name) => [name, 10_000]),
				),
			},
		},
		run: {
			id: 'scale-run-test-001',
			startedAt: new Date(startedAtMs).toISOString(),
			completedAt: new Date(completedAtMs).toISOString(),
		},
		latency,
		cdn: {
			requests: 1_000_000,
			cacheableRequests: 800_000,
			cacheHits: 760_000,
			originRequests: 40_000,
			originEgressBytes: 1_000_000_000,
			limits: {
				minCacheHitRate: 0.9,
				maxOriginRequestRatio: 0.05,
				maxOriginEgressBytes: 2_000_000_000,
			},
			invalidationValidated: true,
		},
		idempotency: {
			paidPlayAttempts: 300_000,
			settlementAttempts: 300_000,
			uncertainRecoveryCases: 0,
			duplicateAcceptedPaidPlays: 0,
			duplicateSettlements: 0,
			negativeBalances: 0,
			payoutMismatches: 0,
			uncertainRecoveryDuplicateWrites: 0,
		},
		resilience: {
			scenarios: expectedResilienceScenarios.map((name) => ({
				name,
				executed: true,
				recovered: true,
				duplicateWrites: 0,
				recoverySeconds: 20,
				limitSeconds: 60,
			})),
		},
		saturation: [
			{ name: 'rgs-cpu-percent', unit: 'percent', aggregation: 'max', maxObserved: 70, limit: 80 },
			{
				name: 'provider-connection-pool-percent',
				unit: 'percent',
				aggregation: 'max',
				maxObserved: 65,
				limit: 80,
			},
		],
		observability: {
			logsCorrelated: true,
			metricsCorrelated: true,
			tracesCorrelated: true,
			dashboardsCaptured: true,
			alertDrills: [{ name: 'rgs-error-rate', fired: true, acknowledged: true }],
		},
		rollback: {
			executed: true,
			healthyAfterRollback: true,
			recoverySeconds: 45,
			limitSeconds: 120,
		},
		artifacts: requiredArtifactRoles.map((role) => ({
			role,
			name: `${role}.json`,
			runId: 'scale-run-test-001',
			bytes: 1_024,
			sha256: createHash('sha256').update(role).digest('hex'),
		})),
	};
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function createSelfTestTrust(evidence) {
	const signerRoles = new Map([
		[evidence.approval.workloadOwner, ['load-report']],
		[evidence.approval.providerOwner, ['provider-ledger', 'resilience-report']],
		[evidence.approval.platformOwner, ['cdn-report', 'observability-export', 'rollback-report']],
	]);
	const privateKeys = new Map();
	const signers = [];
	for (const [id, roles] of signerRoles) {
		const { privateKey, publicKey } = generateKeyPairSync('ed25519');
		privateKeys.set(id, privateKey);
		signers.push({
			id,
			roles,
			publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
		});
	}
	return { privateKeys, trustStore: createScaleTrustStore(evidence, signers) };
}

function materializeSelfTestArtifacts(evidence, directory, privateKeys, signedAt) {
	mkdirSync(join(directory, 'raw'), { recursive: true });
	for (const artifact of evidence.artifacts) {
		const rawName = `raw/${artifact.role}.source.json`;
		const rawContent = `${JSON.stringify(
			createScaleNormalizedSource(evidence, artifact.role, {
				sourceSystem: 'blacksite-scale-self-test',
				sourceVersion: '1',
				exportId: `${evidence.run.id}:${artifact.role}`,
				capturedAt: evidence.run.completedAt,
			}),
		)}\n`;
		writeFileSync(join(directory, rawName), rawContent, 'utf8');
		const sourceReport = createScaleSourceReport(
			evidence,
			artifact.role,
			[
				{
					kind: requiredSourceKindByRole[artifact.role],
					name: rawName,
					mediaType: 'application/json',
					bytes: Buffer.byteLength(rawContent),
					sha256: sha256Bytes(rawContent),
				},
			],
			{
				generatedAt: evidence.run.completedAt,
				generatorName: 'blacksite-scale-self-test',
				generatorVersion: '1',
			},
		);
		const unsignedReport = {
			...createScaleArtifactProof(evidence, artifact.role),
			blacksiteScaleSourceReport: sourceReport,
			selfTest: true,
		};
		const signerId = requiredSignerForRole(evidence, artifact.role);
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

function rewriteSelfTestArtifact(evidence, directory, index, report) {
	const artifact = evidence.artifacts[index];
	const content = `${JSON.stringify(report)}\n`;
	writeFileSync(join(directory, artifact.name), content, 'utf8');
	artifact.bytes = Buffer.byteLength(content);
	artifact.sha256 = createHash('sha256').update(content).digest('hex');
}

async function runSelfTest() {
	const valid = createSelfTestEvidence();
	const cases = [
		['valid evidence', valid, true],
		[
			'wrong commit',
			Object.assign(clone(valid), { identity: { ...valid.identity, gitSha: 'c'.repeat(40) } }),
			false,
		],
		[
			'wrong population',
			Object.assign(clone(valid), { workload: { ...valid.workload, populationUsers: 999_999 } }),
			false,
		],
		[
			'mocked environment',
			Object.assign(clone(valid), { environment: { ...valid.environment, mocked: true } }),
			false,
		],
		[
			'missed concurrency',
			Object.assign(clone(valid), {
				workload: { ...valid.workload, achievedPeakConcurrentUsers: 99_999 },
			}),
			false,
		],
		[
			'unsupported rps claim',
			(() => {
				const value = clone(valid);
				value.workload.rateMeasurement.endpointRequests = Object.fromEntries(
					requiredLatencyEndpoints.map((name) => [name, 1]),
				);
				value.workload.rateMeasurement.minimumEndpointRequests = Object.fromEntries(
					requiredLatencyEndpoints.map((name) => [name, 1]),
				);
				return value;
			})(),
			false,
		],
		[
			'latency breach',
			(() => {
				const value = clone(valid);
				value.latency.play.p99Ms = 151;
				return value;
			})(),
			false,
		],
		[
			'cache breach',
			(() => {
				const value = clone(valid);
				value.cdn.cacheHits = 700_000;
				return value;
			})(),
			false,
		],
		[
			'impossible CDN counters',
			(() => {
				const value = clone(valid);
				value.cdn.requests = 1;
				value.cdn.cacheableRequests = 1_000_000_000;
				value.cdn.cacheHits = 900_000_000;
				value.cdn.originRequests = 0;
				return value;
			})(),
			false,
		],
		[
			'fractional ledger counters',
			(() => {
				const value = clone(valid);
				value.idempotency.paidPlayAttempts = 0.1;
				return value;
			})(),
			false,
		],
		[
			'duplicate settlement',
			(() => {
				const value = clone(valid);
				value.idempotency.duplicateSettlements = 1;
				return value;
			})(),
			false,
		],
		[
			'missing resilience',
			(() => {
				const value = clone(valid);
				value.resilience.scenarios.pop();
				return value;
			})(),
			false,
		],
		[
			'contradictory duplicate resilience',
			(() => {
				const value = clone(valid);
				value.resilience.scenarios.push({
					...value.resilience.scenarios[0],
					executed: false,
					recovered: false,
					duplicateWrites: 1,
				});
				return value;
			})(),
			false,
		],
		[
			'saturation breach',
			(() => {
				const value = clone(valid);
				value.saturation[0].maxObserved = 81;
				return value;
			})(),
			false,
		],
		[
			'missing observability',
			(() => {
				const value = clone(valid);
				value.observability.tracesCorrelated = false;
				return value;
			})(),
			false,
		],
		[
			'unnamed region',
			(() => {
				const value = clone(valid);
				value.environment.regions = [null];
				return value;
			})(),
			false,
		],
		[
			'unnamed alert drill',
			(() => {
				const value = clone(valid);
				value.observability.alertDrills = [{ fired: true, acknowledged: true }];
				return value;
			})(),
			false,
		],
		[
			'rollback breach',
			(() => {
				const value = clone(valid);
				value.rollback.recoverySeconds = 121;
				return value;
			})(),
			false,
		],
		[
			'invalid artifact digest',
			(() => {
				const value = clone(valid);
				value.artifacts[0].sha256 = 'nope';
				return value;
			})(),
			false,
		],
		[
			'approval after start',
			(() => {
				const value = clone(valid);
				value.approval.approvedAt = new Date(Date.parse(value.run.startedAt) + 1_000).toISOString();
				return value;
			})(),
			false,
		],
		[
			'phase duration mismatch',
			(() => {
				const value = clone(valid);
				value.run.completedAt = new Date(Date.parse(value.run.startedAt) + 3_600_000).toISOString();
				return value;
			})(),
			false,
		],
		[
			'expired evidence',
			(() => {
				const value = clone(valid);
				value.approval.evidenceValiditySeconds = 1;
				return value;
			})(),
			false,
		],
		[
			'future run completion',
			(() => {
				const value = clone(valid);
				value.approval.approvedAt = '9999-01-01T00:00:00.000Z';
				value.run.startedAt = '9999-01-01T01:00:00.000Z';
				value.run.completedAt = '9999-01-01T03:00:00.000Z';
				return value;
			})(),
			false,
		],
		[
			'request total mismatch',
			(() => {
				const value = clone(valid);
				value.workload.measuredRequests -= 1;
				return value;
			})(),
			false,
		],
		[
			'duplicate artifact role',
			(() => {
				const value = clone(valid);
				value.artifacts[5] = { ...value.artifacts[0] };
				return value;
			})(),
			false,
		],
		[
			'missing artifact role',
			(() => {
				const value = clone(valid);
				value.artifacts = value.artifacts.filter((artifact) => artifact.role !== 'rollback-report');
				return value;
			})(),
			false,
		],
	];
	let passed = 0;
	for (const [name, evidence, expectedPass] of cases) {
		let didPass = false;
		try {
			verifyScaleEvidence(evidence, {
				gitSha: valid.identity.gitSha,
				frontendTreeSha256: valid.identity.frontendTreeSha256,
				mathTreeSha256: valid.identity.mathTreeSha256,
			});
			didPass = true;
		} catch {
			didPass = false;
		}
		requireValue(didPass === expectedPass, `self-test failed: ${name}`);
		passed += 1;
	}

	const artifactCases = [
		['valid artifact readback', () => {}, true],
		[
			'tampered artifact',
			(evidence, directory) =>
				writeFileSync(join(directory, evidence.artifacts[0].name), 'tampered\n', 'utf8'),
			false,
		],
		[
			'artifact size mismatch',
			(evidence) => {
				evidence.artifacts[0].bytes += 1;
			},
			false,
		],
		[
			'artifact measurement contradiction',
			(evidence, directory) => {
				const artifact = evidence.artifacts[0];
				const artifactPath = join(directory, artifact.name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				report.blacksiteScaleMeasurements.workload.rateMeasurement.endpointRequests.frontend -= 1;
				const content = `${JSON.stringify(report)}\n`;
				writeFileSync(artifactPath, content, 'utf8');
				artifact.bytes = Buffer.byteLength(content);
				artifact.sha256 = createHash('sha256').update(content).digest('hex');
			},
			false,
		],
		[
			'unstructured artifact',
			(evidence, directory) => {
				const artifact = evidence.artifacts[0];
				const artifactPath = join(directory, artifact.name);
				const content = `${artifact.role}\n`;
				writeFileSync(artifactPath, content, 'utf8');
				artifact.bytes = Buffer.byteLength(content);
				artifact.sha256 = createHash('sha256').update(content).digest('hex');
			},
			false,
		],
		[
			'missing signer attestation',
			(evidence, directory) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				delete report.blacksiteScaleAttestation;
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'rehashed report with stale signature',
			(evidence, directory) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				report.selfTest = 'forged-after-signing';
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'wrong role signer',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				delete report.blacksiteScaleAttestation;
				const signerId = evidence.approval.platformOwner;
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{ signerId, privateKey: privateKeys.get(signerId) },
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'future signer attestation',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				delete report.blacksiteScaleAttestation;
				const signerId = requiredSignerForRole(evidence, evidence.artifacts[0].role);
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{
						signerId,
						privateKey: privateKeys.get(signerId),
						signedAt: '9999-01-01T00:00:00.000Z',
					},
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'late signer attestation',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				delete report.blacksiteScaleAttestation;
				const signerId = requiredSignerForRole(evidence, evidence.artifacts[0].role);
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{
						signerId,
						privateKey: privateKeys.get(signerId),
						signedAt: new Date(
							Date.parse(evidence.run.completedAt) +
								(evidence.approval.maxAttestationDelaySeconds + 1) * 1000,
						).toISOString(),
					},
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'missing signed source report',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				delete report.blacksiteScaleAttestation;
				delete report.blacksiteScaleSourceReport;
				const signerId = requiredSignerForRole(evidence, evidence.artifacts[0].role);
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{
						signerId,
						privateKey: privateKeys.get(signerId),
					},
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'tampered raw source attachment',
			(evidence, directory) => {
				const report = JSON.parse(
					readFileSync(join(directory, evidence.artifacts[0].name), 'utf8'),
				);
				writeFileSync(
					join(directory, report.blacksiteScaleSourceReport.attachments[0].name),
					'tampered\n',
					'utf8',
				);
			},
			false,
		],
		[
			'empty raw source records with valid owner signature',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				const attachment = report.blacksiteScaleSourceReport.attachments[0];
				const rawPath = join(directory, attachment.name);
				const rawDocument = JSON.parse(readFileSync(rawPath, 'utf8'));
				rawDocument.records = [];
				const rawContent = `${JSON.stringify(rawDocument)}\n`;
				writeFileSync(rawPath, rawContent, 'utf8');
				attachment.bytes = Buffer.byteLength(rawContent);
				attachment.sha256 = sha256Bytes(rawContent);
				delete report.blacksiteScaleAttestation;
				const signerId = requiredSignerForRole(evidence, evidence.artifacts[0].role);
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{
						signerId,
						privateKey: privateKeys.get(signerId),
					},
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'arbitrary raw source record with valid owner signature',
			(evidence, directory, _trustStore, privateKeys) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
				const attachment = report.blacksiteScaleSourceReport.attachments[0];
				const rawPath = join(directory, attachment.name);
				const rawDocument = JSON.parse(readFileSync(rawPath, 'utf8'));
				rawDocument.records = [{ signedBooleanOnly: true }];
				rawDocument.blacksiteScaleNormalizedSource.recordsSha256 = sha256Value(rawDocument.records);
				const rawContent = `${JSON.stringify(rawDocument)}\n`;
				writeFileSync(rawPath, rawContent, 'utf8');
				attachment.bytes = Buffer.byteLength(rawContent);
				attachment.sha256 = sha256Bytes(rawContent);
				delete report.blacksiteScaleAttestation;
				const signerId = requiredSignerForRole(evidence, evidence.artifacts[0].role);
				report.blacksiteScaleAttestation = createScaleArtifactAttestation(
					evidence,
					evidence.artifacts[0].role,
					report,
					{
						signerId,
						privateKey: privateKeys.get(signerId),
					},
				);
				rewriteSelfTestArtifact(evidence, directory, 0, report);
			},
			false,
		],
		[
			'untrusted replacement public key',
			(_evidence, _directory, trustStore) => {
				const { publicKey } = generateKeyPairSync('ed25519');
				trustStore.signers[0].publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
			},
			false,
		],
		[
			'shared signer key across approval owners',
			(evidence, directory, trustStore, privateKeys) => {
				const workloadOwner = evidence.approval.workloadOwner;
				const providerOwner = evidence.approval.providerOwner;
				const sharedPublicKey = trustStore.signers.find(
					(signer) => signer.id === workloadOwner,
				).publicKeyPem;
				privateKeys.set(providerOwner, privateKeys.get(workloadOwner));
				trustStore.signers.find((signer) => signer.id === providerOwner).publicKeyPem =
					sharedPublicKey;
				materializeSelfTestArtifacts(evidence, directory, privateKeys);
			},
			false,
		],
		[
			'substituted pre-run approval metadata',
			(evidence) => {
				evidence.approval.evidenceRef = 'substituted-after-the-run';
			},
			false,
		],
		[
			'missing artifact',
			(evidence, directory) => rmSync(join(directory, evidence.artifacts[0].name)),
			false,
		],
		[
			'artifact path traversal',
			(evidence) => {
				evidence.artifacts[0].name = '../outside.json';
			},
			false,
		],
		[
			'artifact symbolic link',
			(evidence, directory) => {
				const artifactPath = join(directory, evidence.artifacts[0].name);
				rmSync(artifactPath);
				symlinkSync(evidence.artifacts[1].name, artifactPath);
			},
			false,
		],
	];
	for (const [name, mutate, expectedPass] of artifactCases) {
		const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-self-test-'));
		let didPass = false;
		try {
			const evidence = createSelfTestEvidence();
			const { privateKeys, trustStore } = createSelfTestTrust(evidence);
			materializeSelfTestArtifacts(evidence, directory, privateKeys);
			mutate(evidence, directory, trustStore, privateKeys);
			await verifyScaleEvidenceArtifacts(evidence, directory, trustStore);
			didPass = true;
		} catch {
			didPass = false;
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
		requireValue(didPass === expectedPass, `self-test failed: ${name}`);
		passed += 1;
	}
	process.stdout.write(
		`BLACKSITE scale evidence gate self-test: ${passed}/${cases.length + artifactCases.length} PASS\n`,
	);
}

function argument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	if (process.argv.includes('--self-test')) {
		await runSelfTest();
	} else {
		const evidencePath = argument('--evidence');
		const gitSha = argument('--expected-commit');
		const frontendTreeSha256 = argument('--expected-frontend-tree');
		const mathTreeSha256 = argument('--expected-math-tree');
		const artifactsRoot = argument('--artifacts-root');
		const trustedSignersPath = argument('--trusted-signers');
		const expectedTrustStoreSha256 = argument('--expected-trust-store-sha256');
		requireValue(
			evidencePath &&
				gitSha &&
				frontendTreeSha256 &&
				mathTreeSha256 &&
				artifactsRoot &&
				trustedSignersPath &&
				expectedTrustStoreSha256,
			'Usage: node scripts/blacksite-scale-evidence.mjs --evidence <json> --artifacts-root <directory> --trusted-signers <json> --expected-trust-store-sha256 <sha256> --expected-commit <sha> --expected-frontend-tree <sha256> --expected-math-tree <sha256> [--output <new-json>]',
		);
		exactHex(gitSha, 40, 'expected-commit');
		exactHex(frontendTreeSha256, 64, 'expected-frontend-tree');
		exactHex(mathTreeSha256, 64, 'expected-math-tree');
		exactHex(expectedTrustStoreSha256, 64, 'expected-trust-store-sha256');

		const evidenceStat = lstatSync(evidencePath, { throwIfNoEntry: false });
		requireValue(
			evidenceStat?.isFile() === true && evidenceStat.isSymbolicLink() === false,
			'evidence must be a real regular file',
		);
		const evidenceBytes = readFileSync(realpathSync(evidencePath));
		const evidenceSha256 = sha256Bytes(evidenceBytes);
		const evidence = parseStructuredJson(evidenceBytes, 'evidence');
		const artifactsRootStat = lstatSync(artifactsRoot, { throwIfNoEntry: false });
		requireValue(
			artifactsRootStat?.isDirectory() === true && artifactsRootStat.isSymbolicLink() === false,
			'artifacts-root must be a real directory',
		);
		const realArtifactsRoot = realpathSync(artifactsRoot);
		const trustedSignersStat = lstatSync(trustedSignersPath, { throwIfNoEntry: false });
		requireValue(
			trustedSignersStat?.isFile() === true && trustedSignersStat.isSymbolicLink() === false,
			'trusted-signers must be a real regular file',
		);
		requirePathOutsideRoot(realArtifactsRoot, realpathSync(trustedSignersPath), 'trusted-signers');
		const outputPath = argument('--output');
		let exclusiveOutputPath;
		if (outputPath) {
			requireValue(
				!lstatSync(outputPath, { throwIfNoEntry: false }),
				'output must not overwrite an existing path',
			);
			const outputParent = dirname(resolve(outputPath));
			const outputParentStat = lstatSync(outputParent, { throwIfNoEntry: false });
			requireValue(
				outputParentStat?.isDirectory() === true && outputParentStat.isSymbolicLink() === false,
				'output parent must be a real directory',
			);
			exclusiveOutputPath = join(realpathSync(outputParent), basename(outputPath));
			requirePathOutsideRoot(realArtifactsRoot, exclusiveOutputPath, 'output');
		}
		const trustStoreBytes = readFileSync(trustedSignersPath);
		const trustStoreSha256 = sha256Bytes(trustStoreBytes);
		requireValue(trustStoreSha256 === expectedTrustStoreSha256, 'trusted-signers sha256 mismatch');
		const trustStore = parseStructuredJson(trustStoreBytes, 'trusted-signers');
		const metadata = verifyScaleEvidence(evidence, { gitSha, frontendTreeSha256, mathTreeSha256 });
		const artifactReadback = await verifyScaleEvidenceArtifacts(
			evidence,
			artifactsRoot,
			trustStore,
		);
		const result = {
			...metadata,
			status: 'PASS',
			claim: 'SIGNED_SCALE_EVIDENCE_CONTRACT_VALIDATED',
			evidenceReadback: {
				bytes: evidenceBytes.byteLength,
				sha256: evidenceSha256,
			},
			trustStoreReadback: {
				schema: trustStore.schema,
				sha256: trustStoreSha256,
				approvedPlanSha256: trustStore.approvedPlanSha256,
			},
			artifactReadback,
			validationScope: {
				validated: [
					'schema-and-cross-field-consistency',
					'release-and-plan-binding',
					'file-digest-readback',
					'role-owner-signatures',
					'freshness',
				],
				notValidated: [
					'tool-native-export-semantics',
					'physical-load-execution',
					'production-capacity',
					'external-release-approval',
				],
			},
			warning:
				'This validates owner-signed normalized claims and exact file readback only; it does not validate tool-native record semantics, physical execution, capacity, or release approval.',
		};
		const output = `${JSON.stringify(result, null, 2)}\n`;
		if (exclusiveOutputPath)
			writeFileSync(exclusiveOutputPath, output, { encoding: 'utf8', flag: 'wx' });
		else process.stdout.write(output);
	}
}
