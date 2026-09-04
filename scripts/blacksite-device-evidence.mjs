import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEVICE_EVIDENCE_SCHEMA = 'blacksite-device-qa-evidence-v3';
export const DEVICE_EVIDENCE_VALIDATION_SCHEMA = 'blacksite-device-qa-validation-v3';
export const DEVICE_QA_CONTRACT_VERSION = 'blacksite-device-qa-contract-v3';
export const DEVICE_OWNER_REVIEW_SCHEMA = 'blacksite-device-qa-owner-review-v1';
export const DEVICE_OWNER_REVIEW_VALIDATION_SCHEMA =
	'blacksite-device-qa-owner-review-validation-v1';
export const OLD_DEVICE_FLOOR_VERSION = 'blacksite-old-device-floor-proposed-v1';
export const DEVICE_EVIDENCE_MAX_AGE_DAYS = 30;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const maxClockSkewMs = 5 * 60 * 1_000;
const maxEvidenceAgeMs = DEVICE_EVIDENCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1_000;
const timingToleranceMs = 1_000;
const digestPattern = /^[0-9a-f]{64}$/u;
const gitShaPattern = /^[0-9a-f]{40}$/u;
const identifierPattern = /^[a-z0-9][a-z0-9._-]{1,79}$/u;
const mediaTypePattern = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/iu;
const placeholderPattern =
	/(?:^|\b)(?:replace(?:[_ -]?me)?|placeholder|tbd|todo)(?:\b|$)|<[^>]+>/iu;
const timestampPattern =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;

const mobileScenarios = Object.freeze([
	'load-and-readiness',
	'live-play',
	'heavy-cascade',
	'blackout-mode',
	'feature-entry-and-play',
	'max-win',
	'replay',
	'orientation',
	'safe-areas',
	'touch',
	'dialog-zoom-and-scroll',
	'mute-resume-and-audio',
	'memory-pressure',
	'thermal',
	'battery',
]);

const popoutScenarios = Object.freeze([
	'load-and-readiness',
	'live-play',
	'heavy-cascade',
	'blackout-mode',
	'feature-entry-and-play',
	'max-win',
	'replay',
	'popout-layout',
	'dialog-zoom-and-scroll',
	'mute-resume-and-audio',
	'memory-pressure',
]);

export const REQUIRED_SCENARIOS_BY_ENVIRONMENT = Object.freeze({
	IOS_OLD_FLOOR: Object.freeze([...mobileScenarios, 'voiceover']),
	ANDROID_OLD_FLOOR: Object.freeze([...mobileScenarios, 'talkback']),
	POPOUT_S: popoutScenarios,
	POPOUT_L: popoutScenarios,
});

const environmentKinds = Object.freeze(Object.keys(REQUIRED_SCENARIOS_BY_ENVIRONMENT));
const resultStatuses = new Set(['PASS', 'FAIL', 'NOT_RUN']);
const attachmentKinds = new Set([
	'screenshot',
	'video',
	'trace',
	'log',
	'audio-recording',
	'device-report',
	'other',
]);
const attachmentCaptureScopes = new Set(['SCENARIO', 'ENVIRONMENT_SEQUENCE']);
const floorRelations = new Set([
	'AT_PROPOSED_FLOOR',
	'BELOW_PROPOSED_FLOOR',
	'ABOVE_PROPOSED_FLOOR',
	'NOT_OBSERVED',
	'NOT_APPLICABLE',
]);
const environmentObservationStatuses = new Set(['NOT_OBSERVED', 'OPERATOR_REPORTED']);
const executionModes = new Set([
	'NOT_EXECUTED',
	'PHYSICAL_DEVICE',
	'DEVICE_FARM',
	'REAL_STAKE_POPOUT',
]);
const physicalProvenanceValues = new Set([
	'NOT_OBSERVED',
	'OPERATOR_ASSERTED_PHYSICAL',
	'PROVIDER_ASSERTED_PHYSICAL',
]);
const minimumAttachmentBytesByKind = Object.freeze({
	screenshot: 256,
	video: 1_024,
	trace: 64,
	log: 64,
	'audio-recording': 512,
	'device-report': 64,
	other: 256,
});
const ownerDecisionStatuses = new Set(['ACCEPTED', 'REJECTED', 'CHANGES_REQUIRED']);

const requiredAttachmentKindGroupsByScenario = Object.freeze({
	'load-and-readiness': Object.freeze([
		Object.freeze(['video']),
		Object.freeze(['trace', 'log', 'device-report']),
	]),
	'live-play': Object.freeze([Object.freeze(['video']), Object.freeze(['trace', 'log'])]),
	'heavy-cascade': Object.freeze([
		Object.freeze(['video']),
		Object.freeze(['trace', 'device-report']),
	]),
	'blackout-mode': Object.freeze([Object.freeze(['video'])]),
	'feature-entry-and-play': Object.freeze([Object.freeze(['video'])]),
	'max-win': Object.freeze([Object.freeze(['video'])]),
	replay: Object.freeze([Object.freeze(['video']), Object.freeze(['trace', 'log'])]),
	orientation: Object.freeze([Object.freeze(['video'])]),
	'safe-areas': Object.freeze([Object.freeze(['screenshot', 'video'])]),
	touch: Object.freeze([Object.freeze(['video'])]),
	'dialog-zoom-and-scroll': Object.freeze([Object.freeze(['video'])]),
	'mute-resume-and-audio': Object.freeze([
		Object.freeze(['video']),
		Object.freeze(['audio-recording']),
	]),
	'memory-pressure': Object.freeze([
		Object.freeze(['video']),
		Object.freeze(['trace', 'device-report']),
	]),
	thermal: Object.freeze([Object.freeze(['video']), Object.freeze(['trace', 'device-report'])]),
	battery: Object.freeze([Object.freeze(['video']), Object.freeze(['trace', 'device-report'])]),
	voiceover: Object.freeze([Object.freeze(['video'])]),
	talkback: Object.freeze([Object.freeze(['video'])]),
	'popout-layout': Object.freeze([Object.freeze(['screenshot', 'video'])]),
});

function fail(message) {
	throw new Error(message);
}

function requireValue(condition, message) {
	if (!condition) fail(message);
}

function objectValue(value, context) {
	requireValue(
		value && typeof value === 'object' && !Array.isArray(value),
		`${context} must be an object`,
	);
	return value;
}

function exactKeys(value, required, optional, context) {
	objectValue(value, context);
	const allowed = new Set([...required, ...optional]);
	for (const key of required)
		requireValue(Object.hasOwn(value, key), `${context}.${key} is required`);
	for (const key of Object.keys(value))
		requireValue(allowed.has(key), `${context}.${key} is not allowed`);
	return value;
}

function meaningfulString(value, context, minimumLength = 2) {
	requireValue(typeof value === 'string', `${context} must be a string`);
	const normalized = value.trim();
	requireValue(normalized.length >= minimumLength, `${context} must be meaningful`);
	requireValue(!placeholderPattern.test(normalized), `${context} contains a placeholder`);
	return normalized;
}

function identifier(value, context) {
	meaningfulString(value, context);
	requireValue(identifierPattern.test(value), `${context} must be a lowercase identifier`);
	return value;
}

function positiveInteger(value, context) {
	requireValue(Number.isSafeInteger(value) && value > 0, `${context} must be a positive integer`);
	return value;
}

function positiveNumber(value, context) {
	requireValue(Number.isFinite(value) && value > 0, `${context} must be a positive number`);
	return value;
}

function digest(value, context) {
	requireValue(
		typeof value === 'string' && digestPattern.test(value),
		`${context} must be a lowercase SHA-256 digest`,
	);
	requireValue(!/^0{64}$/u.test(value), `${context} must not be the template digest`);
	return value;
}

function gitSha(value, context) {
	requireValue(
		typeof value === 'string' && gitShaPattern.test(value),
		`${context} must be a lowercase full Git SHA`,
	);
	requireValue(!/^0{40}$/u.test(value), `${context} must not be the template Git SHA`);
	return value;
}

function timestamp(value, context) {
	requireValue(
		typeof value === 'string' && timestampPattern.test(value),
		`${context} must be an ISO-8601 timestamp with an explicit UTC offset`,
	);
	const milliseconds = Date.parse(value);
	requireValue(Number.isFinite(milliseconds), `${context} is not a valid timestamp`);
	return milliseconds;
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

function bindEvidenceJson(evidence, sourceBytes) {
	const canonicalJson = JSON.stringify(canonicalJsonValue(evidence));
	if (sourceBytes === undefined) {
		const canonicalBytes = Buffer.from(canonicalJson, 'utf8');
		return {
			binding: 'CANONICAL_JSON_VALUE',
			bytes: canonicalBytes.length,
			sha256: createHash('sha256').update(canonicalBytes).digest('hex'),
		};
	}
	let exactBytes;
	if (Buffer.isBuffer(sourceBytes)) exactBytes = sourceBytes;
	else if (typeof sourceBytes === 'string') exactBytes = Buffer.from(sourceBytes, 'utf8');
	else if (sourceBytes instanceof Uint8Array) {
		exactBytes = Buffer.from(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
	} else fail('evidenceSourceBytes must be a Buffer, Uint8Array, or UTF-8 string');
	requireValue(exactBytes.length > 0, 'evidenceSourceBytes must not be empty');
	let parsed;
	try {
		parsed = JSON.parse(exactBytes.toString('utf8'));
	} catch (error) {
		fail(`evidenceSourceBytes are not valid JSON: ${error.message}`);
	}
	requireValue(
		JSON.stringify(canonicalJsonValue(parsed)) === canonicalJson,
		'evidenceSourceBytes do not encode the evidence value being validated',
	);
	return {
		binding: 'EXACT_SOURCE_BYTES',
		bytes: exactBytes.length,
		sha256: createHash('sha256').update(exactBytes).digest('hex'),
	};
}

function exactCandidateIdentity(identity, expectedIdentity) {
	exactKeys(
		identity,
		['gitSha', 'frontendTreeSha256', 'mathTreeSha256', 'mathCandidateFingerprintSha256'],
		[],
		'identity',
	);
	gitSha(identity.gitSha, 'identity.gitSha');
	digest(identity.frontendTreeSha256, 'identity.frontendTreeSha256');
	digest(identity.mathTreeSha256, 'identity.mathTreeSha256');
	digest(identity.mathCandidateFingerprintSha256, 'identity.mathCandidateFingerprintSha256');

	exactKeys(
		expectedIdentity,
		['gitSha', 'frontendTreeSha256', 'mathTreeSha256', 'mathCandidateFingerprintSha256'],
		[],
		'expectedIdentity',
	);
	gitSha(expectedIdentity.gitSha, 'expectedIdentity.gitSha');
	digest(expectedIdentity.frontendTreeSha256, 'expectedIdentity.frontendTreeSha256');
	digest(expectedIdentity.mathTreeSha256, 'expectedIdentity.mathTreeSha256');
	digest(
		expectedIdentity.mathCandidateFingerprintSha256,
		'expectedIdentity.mathCandidateFingerprintSha256',
	);

	for (const key of Object.keys(expectedIdentity)) {
		requireValue(
			identity[key] === expectedIdentity[key],
			`identity.${key} does not match the independently supplied candidate identity`,
		);
	}
}

function validateRecord(record, verificationTime) {
	exactKeys(record, ['id', 'startedAt', 'completedAt'], [], 'record');
	identifier(record.id, 'record.id');
	const startedAt = timestamp(record.startedAt, 'record.startedAt');
	const completedAt = timestamp(record.completedAt, 'record.completedAt');
	requireValue(startedAt <= completedAt, 'record.startedAt must not follow record.completedAt');
	requireValue(startedAt <= verificationTime + maxClockSkewMs, 'record.startedAt is in the future');
	requireValue(
		completedAt <= verificationTime + maxClockSkewMs,
		'record.completedAt is in the future',
	);
	requireValue(
		verificationTime - completedAt <= maxEvidenceAgeMs,
		`record.completedAt is stale; device evidence must be no more than ${DEVICE_EVIDENCE_MAX_AGE_DAYS} days old`,
	);
	return { startedAt, completedAt };
}

function validateOperators(operators) {
	requireValue(
		Array.isArray(operators) && operators.length > 0,
		'operators must contain at least one named operator',
	);
	const ids = new Set();
	for (const [index, operator] of operators.entries()) {
		const context = `operators[${index}]`;
		exactKeys(operator, ['id', 'name', 'organization', 'role'], [], context);
		identifier(operator.id, `${context}.id`);
		meaningfulString(operator.name, `${context}.name`);
		meaningfulString(operator.organization, `${context}.organization`);
		meaningfulString(operator.role, `${context}.role`);
		requireValue(!ids.has(operator.id), `${context}.id must be unique`);
		ids.add(operator.id);
	}
	return ids;
}

function requireExactFact(actual, expected, context) {
	requireValue(
		actual === expected,
		`${context} must be ${JSON.stringify(expected)} for AT_PROPOSED_FLOOR`,
	);
}

function validateCanonicalFloorFacts(environment, context) {
	if (environment.floorRelation !== 'AT_PROPOSED_FLOOR') return;
	if (environment.coverageKind === 'IOS_OLD_FLOOR') {
		requireExactFact(environment.device.manufacturer, 'Apple', `${context}.device.manufacturer`);
		requireExactFact(environment.device.model, 'iPhone X', `${context}.device.model`);
		requireValue(
			['iPhone10,3', 'iPhone10,6'].includes(environment.device.modelIdentifier),
			`${context}.device.modelIdentifier must be iPhone10,3 or iPhone10,6 for AT_PROPOSED_FLOOR`,
		);
		requireExactFact(
			environment.hardware.chipset,
			'Apple A11 Bionic',
			`${context}.hardware.chipset`,
		);
		requireExactFact(
			environment.hardware.cpuArchitecture,
			'arm64',
			`${context}.hardware.cpuArchitecture`,
		);
		requireExactFact(environment.hardware.gpu, 'Apple three-core GPU', `${context}.hardware.gpu`);
		requireExactFact(environment.hardware.ramMiB, 3072, `${context}.hardware.ramMiB`);
		requireExactFact(environment.os.name, 'iOS', `${context}.os.name`);
		requireValue(
			/^16\.7(?:\.\d+)?$/u.test(environment.os.version),
			`${context}.os.version must be an exact iOS 16.7.x version for AT_PROPOSED_FLOOR`,
		);
		requireExactFact(environment.browser.name, 'Mobile Safari', `${context}.browser.name`);
		requireExactFact(environment.browser.engine, 'WebKit', `${context}.browser.engine`);
	} else if (environment.coverageKind === 'ANDROID_OLD_FLOOR') {
		requireExactFact(environment.device.manufacturer, 'Motorola', `${context}.device.manufacturer`);
		requireExactFact(environment.device.model, 'Moto G7 Power', `${context}.device.model`);
		requireValue(
			/^XT1955(?:-\d+)?$/u.test(environment.device.modelIdentifier),
			`${context}.device.modelIdentifier must be an XT1955 family identifier for AT_PROPOSED_FLOOR`,
		);
		requireExactFact(
			environment.hardware.chipset,
			'Qualcomm Snapdragon 632',
			`${context}.hardware.chipset`,
		);
		requireExactFact(
			environment.hardware.cpuArchitecture,
			'arm64',
			`${context}.hardware.cpuArchitecture`,
		);
		requireExactFact(environment.hardware.gpu, 'Adreno 506', `${context}.hardware.gpu`);
		requireExactFact(environment.hardware.ramMiB, 3072, `${context}.hardware.ramMiB`);
		requireExactFact(environment.os.name, 'Android', `${context}.os.name`);
		requireValue(
			/^10(?:\.0)?$/u.test(environment.os.version),
			`${context}.os.version must be Android 10 for AT_PROPOSED_FLOOR`,
		);
		requireExactFact(environment.browser.name, 'Google Chrome', `${context}.browser.name`);
		requireExactFact(environment.browser.engine, 'Blink', `${context}.browser.engine`);
	}
}

function validateEnvironment(environment, index) {
	const context = `environments[${index}]`;
	exactKeys(
		environment,
		[
			'id',
			'coverageKind',
			'provenance',
			'executionMode',
			'floorRelation',
			'device',
			'hardware',
			'os',
			'browser',
			'viewport',
			'connection',
			'notes',
		],
		['stakeContainer', 'assistiveTechnology', 'deviceFarm'],
		context,
	);
	identifier(environment.id, `${context}.id`);
	requireValue(
		environmentKinds.includes(environment.coverageKind),
		`${context}.coverageKind is not supported`,
	);
	requireValue(
		floorRelations.has(environment.floorRelation),
		`${context}.floorRelation is invalid`,
	);
	requireValue(
		executionModes.has(environment.executionMode),
		`${context}.executionMode is invalid`,
	);
	exactKeys(environment.provenance, ['observation', 'verification'], [], `${context}.provenance`);
	requireValue(
		environmentObservationStatuses.has(environment.provenance.observation),
		`${context}.provenance.observation must be NOT_OBSERVED or OPERATOR_REPORTED`,
	);
	requireValue(
		environment.provenance.verification === 'UNVERIFIED',
		`${context}.provenance.verification must remain UNVERIFIED pending separate owner review`,
	);
	meaningfulString(environment.notes, `${context}.notes`, 8);

	exactKeys(
		environment.device,
		['manufacturer', 'model', 'modelIdentifier', 'physical'],
		[],
		`${context}.device`,
	);
	meaningfulString(environment.device.manufacturer, `${context}.device.manufacturer`);
	meaningfulString(environment.device.model, `${context}.device.model`);
	meaningfulString(environment.device.modelIdentifier, `${context}.device.modelIdentifier`);
	requireValue(
		physicalProvenanceValues.has(environment.device.physical),
		`${context}.device.physical must preserve explicit observation provenance`,
	);

	exactKeys(
		environment.hardware,
		['chipset', 'cpuArchitecture', 'gpu', 'ramMiB'],
		[],
		`${context}.hardware`,
	);
	meaningfulString(environment.hardware.chipset, `${context}.hardware.chipset`);
	meaningfulString(environment.hardware.cpuArchitecture, `${context}.hardware.cpuArchitecture`);
	meaningfulString(environment.hardware.gpu, `${context}.hardware.gpu`);
	positiveInteger(environment.hardware.ramMiB, `${context}.hardware.ramMiB`);

	exactKeys(environment.os, ['name', 'version', 'build'], [], `${context}.os`);
	meaningfulString(environment.os.name, `${context}.os.name`);
	meaningfulString(environment.os.version, `${context}.os.version`);
	meaningfulString(environment.os.build, `${context}.os.build`);

	exactKeys(environment.browser, ['name', 'version', 'engine'], [], `${context}.browser`);
	meaningfulString(environment.browser.name, `${context}.browser.name`);
	meaningfulString(environment.browser.version, `${context}.browser.version`);
	meaningfulString(environment.browser.engine, `${context}.browser.engine`);

	exactKeys(
		environment.viewport,
		['widthCssPx', 'heightCssPx', 'devicePixelRatio'],
		[],
		`${context}.viewport`,
	);
	positiveInteger(environment.viewport.widthCssPx, `${context}.viewport.widthCssPx`);
	positiveInteger(environment.viewport.heightCssPx, `${context}.viewport.heightCssPx`);
	positiveNumber(environment.viewport.devicePixelRatio, `${context}.viewport.devicePixelRatio`);

	exactKeys(environment.connection, ['kind', 'label'], [], `${context}.connection`);
	meaningfulString(environment.connection.kind, `${context}.connection.kind`);
	meaningfulString(environment.connection.label, `${context}.connection.label`);

	const isIos = environment.coverageKind === 'IOS_OLD_FLOOR';
	const isAndroid = environment.coverageKind === 'ANDROID_OLD_FLOOR';
	const isPopout =
		environment.coverageKind === 'POPOUT_S' || environment.coverageKind === 'POPOUT_L';
	if (isIos || isAndroid) {
		requireValue(
			['NOT_EXECUTED', 'PHYSICAL_DEVICE', 'DEVICE_FARM'].includes(environment.executionMode),
			`${context}.executionMode must be NOT_EXECUTED, PHYSICAL_DEVICE, or DEVICE_FARM`,
		);
		requireValue(
			environment.floorRelation !== 'NOT_APPLICABLE',
			`${context}.floorRelation must compare the device with the proposed floor`,
		);
		exactKeys(
			environment.assistiveTechnology,
			['name', 'version'],
			[],
			`${context}.assistiveTechnology`,
		);
		const expectedName = isIos ? 'VoiceOver' : 'TalkBack';
		requireValue(
			environment.assistiveTechnology.name === expectedName,
			`${context}.assistiveTechnology.name must be ${expectedName}`,
		);
		meaningfulString(
			environment.assistiveTechnology.version,
			`${context}.assistiveTechnology.version`,
		);
		requireValue(
			!Object.hasOwn(environment, 'stakeContainer'),
			`${context}.stakeContainer is only valid for Popout evidence`,
		);
		if (environment.executionMode === 'DEVICE_FARM') {
			exactKeys(
				environment.deviceFarm,
				['provider', 'sessionId', 'deviceType'],
				[],
				`${context}.deviceFarm`,
			);
			meaningfulString(environment.deviceFarm.provider, `${context}.deviceFarm.provider`);
			meaningfulString(environment.deviceFarm.sessionId, `${context}.deviceFarm.sessionId`);
			requireValue(
				environment.deviceFarm.deviceType === 'PROVIDER_ASSERTED_PHYSICAL',
				`${context}.deviceFarm.deviceType must be PROVIDER_ASSERTED_PHYSICAL`,
			);
		} else {
			requireValue(
				!Object.hasOwn(environment, 'deviceFarm'),
				`${context}.deviceFarm is only valid for DEVICE_FARM execution`,
			);
		}
	} else if (isPopout) {
		requireValue(
			['NOT_EXECUTED', 'REAL_STAKE_POPOUT'].includes(environment.executionMode),
			`${context}.executionMode must be NOT_EXECUTED or REAL_STAKE_POPOUT`,
		);
		requireValue(
			environment.floorRelation === 'NOT_APPLICABLE',
			`${context}.floorRelation must be NOT_APPLICABLE`,
		);
		requireValue(
			!Object.hasOwn(environment, 'assistiveTechnology'),
			`${context}.assistiveTechnology is only valid for mobile evidence`,
		);
		requireValue(
			!Object.hasOwn(environment, 'deviceFarm'),
			`${context}.deviceFarm is only valid for mobile DEVICE_FARM execution`,
		);
		exactKeys(
			environment.stakeContainer,
			['size', 'version', 'source'],
			[],
			`${context}.stakeContainer`,
		);
		const expectedSize = environment.coverageKind === 'POPOUT_S' ? 'S' : 'L';
		requireValue(
			environment.stakeContainer.size === expectedSize,
			`${context}.stakeContainer.size must be ${expectedSize}`,
		);
		meaningfulString(environment.stakeContainer.version, `${context}.stakeContainer.version`);
		requireValue(
			['NOT_OBSERVED', 'OPERATOR_ASSERTED_REAL_STAKE'].includes(environment.stakeContainer.source),
			`${context}.stakeContainer.source must preserve explicit observation provenance`,
		);
	}
	validateCanonicalFloorFacts(environment, context);
	return environment;
}

function validateEnvironments(environments) {
	requireValue(
		Array.isArray(environments) && environments.length >= environmentKinds.length,
		`environments must include separate ${environmentKinds.join(', ')} coverage`,
	);
	const ids = new Set();
	const coverage = new Map(environmentKinds.map((kind) => [kind, 0]));
	for (const [index, environment] of environments.entries()) {
		validateEnvironment(environment, index);
		requireValue(!ids.has(environment.id), `environments[${index}].id must be unique`);
		ids.add(environment.id);
		coverage.set(environment.coverageKind, coverage.get(environment.coverageKind) + 1);
	}
	for (const [kind, count] of coverage)
		requireValue(count > 0, `Missing required ${kind} environment`);
	return {
		ids,
		coverage,
		environmentById: new Map(environments.map((environment) => [environment.id, environment])),
	};
}

function validateAttachmentPath(path, context) {
	meaningfulString(path, context);
	requireValue(!isAbsolute(path), `${context} must be relative to the attachment root`);
	requireValue(!path.includes('\\'), `${context} must use forward slashes`);
	const segments = path.split('/');
	requireValue(
		segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
		`${context} must not traverse or contain empty path segments`,
	);
	return path;
}

function mediaTypeMatchesKind(kind, mediaType) {
	if (kind === 'screenshot') return /^image\/(?:png|jpeg|webp)$/iu.test(mediaType);
	if (kind === 'video') return new Set(['video/mp4', 'video/webm']).has(mediaType);
	if (kind === 'audio-recording')
		return new Set(['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/webm']).has(
			mediaType,
		);
	if (kind === 'log')
		return /^text\/[a-z0-9.+-]+$/iu.test(mediaType) || mediaType === 'application/json';
	if (kind === 'trace') {
		return new Set([
			'application/json',
			'application/zip',
			'application/gzip',
			'application/x-gzip',
			'application/octet-stream',
		]).has(mediaType);
	}
	if (kind === 'device-report') {
		return new Set([
			'application/json',
			'application/pdf',
			'application/zip',
			'text/plain',
			'text/csv',
		]).has(mediaType);
	}
	return kind === 'other';
}

function validateAttachments(attachments, recordTimes, environmentById, operatorIds) {
	requireValue(Array.isArray(attachments), 'attachments must be an array');
	const byId = new Map();
	const paths = new Set();
	const digestEnvironment = new Map();
	for (const [index, attachment] of attachments.entries()) {
		const context = `attachments[${index}]`;
		exactKeys(
			attachment,
			[
				'id',
				'environmentId',
				'operatorId',
				'captureScope',
				'scenarioIds',
				'path',
				'kind',
				'mediaType',
				'bytes',
				'sha256',
				'capturedAt',
			],
			[],
			context,
		);
		identifier(attachment.id, `${context}.id`);
		identifier(attachment.environmentId, `${context}.environmentId`);
		requireValue(
			environmentById.has(attachment.environmentId),
			`${context}.environmentId does not resolve`,
		);
		identifier(attachment.operatorId, `${context}.operatorId`);
		requireValue(operatorIds.has(attachment.operatorId), `${context}.operatorId does not resolve`);
		requireValue(
			attachmentCaptureScopes.has(attachment.captureScope),
			`${context}.captureScope must be SCENARIO or ENVIRONMENT_SEQUENCE`,
		);
		requireValue(
			Array.isArray(attachment.scenarioIds) && attachment.scenarioIds.length > 0,
			`${context}.scenarioIds must be a non-empty array`,
		);
		const environment = environmentById.get(attachment.environmentId);
		const applicableScenarios = REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind];
		const scenarioIds = new Set();
		for (const [scenarioIndex, scenarioId] of attachment.scenarioIds.entries()) {
			identifier(scenarioId, `${context}.scenarioIds[${scenarioIndex}]`);
			requireValue(
				applicableScenarios.includes(scenarioId),
				`${context}.scenarioIds[${scenarioIndex}] is not applicable to ${environment.coverageKind}`,
			);
			requireValue(!scenarioIds.has(scenarioId), `${context}.scenarioIds must be unique`);
			scenarioIds.add(scenarioId);
		}
		if (attachment.captureScope === 'SCENARIO') {
			requireValue(
				attachment.scenarioIds.length === 1,
				`${context}.captureScope SCENARIO requires exactly one scenarioId`,
			);
		} else {
			requireValue(
				attachment.scenarioIds.length >= 2,
				`${context}.captureScope ENVIRONMENT_SEQUENCE requires at least two scenarioIds`,
			);
			requireValue(
				attachment.kind === 'video',
				`${context}.captureScope ENVIRONMENT_SEQUENCE requires continuous video evidence`,
			);
		}
		validateAttachmentPath(attachment.path, `${context}.path`);
		requireValue(attachmentKinds.has(attachment.kind), `${context}.kind is invalid`);
		requireValue(
			typeof attachment.mediaType === 'string' && mediaTypePattern.test(attachment.mediaType),
			`${context}.mediaType must be a valid media type`,
		);
		requireValue(
			mediaTypeMatchesKind(attachment.kind, attachment.mediaType),
			`${context}.mediaType is not compatible with kind ${attachment.kind}`,
		);
		positiveInteger(attachment.bytes, `${context}.bytes`);
		requireValue(
			attachment.bytes >= minimumAttachmentBytesByKind[attachment.kind],
			`${context}.bytes is too small for kind ${attachment.kind}`,
		);
		digest(attachment.sha256, `${context}.sha256`);
		const previousDigestEnvironment = digestEnvironment.get(attachment.sha256);
		requireValue(
			!previousDigestEnvironment || previousDigestEnvironment === attachment.environmentId,
			`${context}.sha256 reuses identical attachment bytes across environments`,
		);
		digestEnvironment.set(attachment.sha256, attachment.environmentId);
		const capturedAt = timestamp(attachment.capturedAt, `${context}.capturedAt`);
		requireValue(
			capturedAt >= recordTimes.startedAt && capturedAt <= recordTimes.completedAt,
			`${context}.capturedAt must fall within the record run`,
		);
		requireValue(!byId.has(attachment.id), `${context}.id must be unique`);
		requireValue(!paths.has(attachment.path), `${context}.path must be unique`);
		byId.set(attachment.id, attachment);
		paths.add(attachment.path);
	}
	return byId;
}

function validateMeasurement(measurement, scenarioId, context, recordTimes, observedAt) {
	const specialKeys = {
		'memory-pressure': ['cycles'],
		thermal: ['poweredExternally', 'startThermalState', 'endThermalState'],
		battery: [
			'poweredExternally',
			'startBatteryPercent',
			'endBatteryPercent',
			'brightnessPercent',
			'radios',
		],
	};
	const extraKeys = specialKeys[scenarioId] ?? [];
	exactKeys(
		measurement,
		['startedAt', 'completedAt', 'durationSeconds', 'method', ...extraKeys],
		[],
		context,
	);
	const startedAt = timestamp(measurement.startedAt, `${context}.startedAt`);
	const completedAt = timestamp(measurement.completedAt, `${context}.completedAt`);
	requireValue(startedAt < completedAt, `${context}.startedAt must precede completedAt`);
	requireValue(
		startedAt >= recordTimes.startedAt && completedAt <= recordTimes.completedAt,
		`${context} interval must fall within the record run`,
	);
	positiveInteger(measurement.durationSeconds, `${context}.durationSeconds`);
	const measuredDurationMs = measurement.durationSeconds * 1_000;
	requireValue(
		Math.abs(completedAt - startedAt - measuredDurationMs) <= timingToleranceMs,
		`${context}.durationSeconds must match the timestamp interval`,
	);
	requireValue(
		observedAt >= startedAt && observedAt <= completedAt,
		`${context} interval must contain the result observedAt timestamp`,
	);
	meaningfulString(measurement.method, `${context}.method`, 4);

	if (scenarioId === 'memory-pressure') {
		requireValue(
			Number.isSafeInteger(measurement.cycles) && measurement.cycles >= 3,
			`${context}.cycles must record at least three complete heavy-sequence cycles`,
		);
	} else if (scenarioId === 'thermal') {
		requireValue(
			measurement.durationSeconds >= 20 * 60,
			`${context}.durationSeconds must record at least 20 minutes`,
		);
		requireValue(
			measurement.poweredExternally === false,
			`${context}.poweredExternally must be false for the unplugged thermal run`,
		);
		meaningfulString(measurement.startThermalState, `${context}.startThermalState`);
		meaningfulString(measurement.endThermalState, `${context}.endThermalState`);
	} else if (scenarioId === 'battery') {
		requireValue(
			measurement.durationSeconds >= 20 * 60,
			`${context}.durationSeconds must record at least 20 minutes`,
		);
		requireValue(
			measurement.poweredExternally === false,
			`${context}.poweredExternally must be false for the unplugged battery run`,
		);
		for (const field of ['startBatteryPercent', 'endBatteryPercent', 'brightnessPercent']) {
			requireValue(
				Number.isFinite(measurement[field]) && measurement[field] >= 0 && measurement[field] <= 100,
				`${context}.${field} must be between 0 and 100`,
			);
		}
		requireValue(
			measurement.startBatteryPercent >= measurement.endBatteryPercent,
			`${context}.endBatteryPercent must not exceed startBatteryPercent`,
		);
		requireValue(
			Array.isArray(measurement.radios) && measurement.radios.length > 0,
			`${context}.radios must record at least one radio state`,
		);
		for (const [index, radio] of measurement.radios.entries())
			meaningfulString(radio, `${context}.radios[${index}]`);
	}
}

function requireScenarioAttachmentCoverage(result, attachments, context) {
	const requiredGroups = requiredAttachmentKindGroupsByScenario[result.scenarioId];
	requireValue(requiredGroups, `${context}.scenarioId has no attachment coverage contract`);
	const kinds = new Set(attachments.map((attachment) => attachment.kind));
	for (const acceptedKinds of requiredGroups) {
		requireValue(
			acceptedKinds.some((kind) => kinds.has(kind)),
			`${context} ${result.status} requires ${acceptedKinds.join(' or ')} evidence for ${result.scenarioId}`,
		);
	}
}

function validateResult(result, index, indexes, recordTimes) {
	const context = `results[${index}]`;
	exactKeys(
		result,
		[
			'environmentId',
			'scenarioId',
			'status',
			'operatorId',
			'observedAt',
			'fixture',
			'notes',
			'attachmentIds',
		],
		['blocker', 'measurement'],
		context,
	);
	identifier(result.environmentId, `${context}.environmentId`);
	requireValue(
		indexes.environmentById.has(result.environmentId),
		`${context}.environmentId does not resolve`,
	);
	const environment = indexes.environmentById.get(result.environmentId);
	identifier(result.scenarioId, `${context}.scenarioId`);
	requireValue(
		resultStatuses.has(result.status),
		`${context}.status must be PASS, FAIL, or NOT_RUN`,
	);
	identifier(result.operatorId, `${context}.operatorId`);
	requireValue(
		indexes.operatorIds.has(result.operatorId),
		`${context}.operatorId does not resolve`,
	);
	meaningfulString(result.fixture, `${context}.fixture`);
	meaningfulString(result.notes, `${context}.notes`, 8);
	requireValue(Array.isArray(result.attachmentIds), `${context}.attachmentIds must be an array`);
	const attachmentIds = new Set();
	const resultAttachments = [];
	for (const [attachmentIndex, attachmentId] of result.attachmentIds.entries()) {
		identifier(attachmentId, `${context}.attachmentIds[${attachmentIndex}]`);
		requireValue(
			indexes.attachmentById.has(attachmentId),
			`${context}.attachmentIds[${attachmentIndex}] does not resolve`,
		);
		requireValue(!attachmentIds.has(attachmentId), `${context}.attachmentIds must be unique`);
		const attachment = indexes.attachmentById.get(attachmentId);
		requireValue(
			attachment.environmentId === result.environmentId,
			`${context}.attachmentIds[${attachmentIndex}] belongs to a different environment`,
		);
		requireValue(
			attachment.operatorId === result.operatorId,
			`${context}.attachmentIds[${attachmentIndex}] belongs to a different operator`,
		);
		requireValue(
			attachment.scenarioIds.includes(result.scenarioId),
			`${context}.attachmentIds[${attachmentIndex}] does not declare scenario ${result.scenarioId}`,
		);
		attachmentIds.add(attachmentId);
		resultAttachments.push(attachment);
		indexes.referencedAttachmentIds.add(attachmentId);
		indexes.referencedAttachmentScenarioKeys.add(`${attachmentId}\0${result.scenarioId}`);
	}
	if (result.status === 'NOT_RUN') {
		requireValue(
			result.observedAt === 'NOT_OBSERVED',
			`${context}.observedAt must be NOT_OBSERVED when status is NOT_RUN`,
		);
		requireValue(
			result.attachmentIds.length === 0,
			`${context} NOT_RUN must not reference fabricated evidence attachments`,
		);
		requireValue(
			!Object.hasOwn(result, 'measurement'),
			`${context}.measurement is only valid for executed PASS or FAIL results`,
		);
		exactKeys(result.blocker, ['reason', 'owner', 'nextAction'], [], `${context}.blocker`);
		meaningfulString(result.blocker.reason, `${context}.blocker.reason`, 8);
		meaningfulString(result.blocker.owner, `${context}.blocker.owner`);
		meaningfulString(result.blocker.nextAction, `${context}.blocker.nextAction`, 8);
	} else {
		const observedAt = timestamp(result.observedAt, `${context}.observedAt`);
		requireValue(
			observedAt >= recordTimes.startedAt && observedAt <= recordTimes.completedAt,
			`${context}.observedAt must fall within the record run`,
		);
		requireValue(
			result.attachmentIds.length > 0,
			`${context} ${result.status} requires at least one hashed attachment`,
		);
		requireValue(!Object.hasOwn(result, 'blocker'), `${context}.blocker is only valid for NOT_RUN`);
		validateMeasurement(
			result.measurement,
			result.scenarioId,
			`${context}.measurement`,
			recordTimes,
			observedAt,
		);
		requireScenarioAttachmentCoverage(result, resultAttachments, context);
	}

	const requiredScenarios = REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind];
	requireValue(
		requiredScenarios.includes(result.scenarioId),
		`${context}.scenarioId is not applicable to ${environment.coverageKind}`,
	);
	return `${result.environmentId}\0${result.scenarioId}`;
}

function validateResults(results, environments, operatorIds, attachmentById, recordTimes) {
	requireValue(Array.isArray(results) && results.length > 0, 'results must be a non-empty array');
	const environmentById = new Map(environments.map((environment) => [environment.id, environment]));
	const indexes = {
		environmentById,
		operatorIds,
		attachmentById,
		referencedAttachmentIds: new Set(),
		referencedAttachmentScenarioKeys: new Set(),
	};
	const resultKeys = new Set();
	const statusCounts = { PASS: 0, FAIL: 0, NOT_RUN: 0 };
	const statusCountsByEnvironment = new Map(
		environments.map((environment) => [environment.id, { PASS: 0, FAIL: 0, NOT_RUN: 0 }]),
	);
	for (const [index, result] of results.entries()) {
		const key = validateResult(result, index, indexes, recordTimes);
		requireValue(
			!resultKeys.has(key),
			`results[${index}] duplicates an environment/scenario result`,
		);
		resultKeys.add(key);
		statusCounts[result.status] += 1;
		statusCountsByEnvironment.get(result.environmentId)[result.status] += 1;
	}
	for (const environment of environments) {
		for (const scenarioId of REQUIRED_SCENARIOS_BY_ENVIRONMENT[environment.coverageKind]) {
			requireValue(
				resultKeys.has(`${environment.id}\0${scenarioId}`),
				`Missing required ${scenarioId} result for ${environment.id} (${environment.coverageKind})`,
			);
		}
	}
	for (const attachmentId of attachmentById.keys()) {
		requireValue(
			indexes.referencedAttachmentIds.has(attachmentId),
			`Attachment ${attachmentId} is not referenced by a result`,
		);
		const attachment = attachmentById.get(attachmentId);
		for (const scenarioId of attachment.scenarioIds) {
			requireValue(
				indexes.referencedAttachmentScenarioKeys.has(`${attachmentId}\0${scenarioId}`),
				`Attachment ${attachmentId} declares unreferenced scenario ${scenarioId}`,
			);
		}
	}
	return { statusCounts, statusCountsByEnvironment };
}

function validateEnvironmentExecutionProvenance(environments, statusCountsByEnvironment) {
	for (const [index, environment] of environments.entries()) {
		const context = `environments[${index}]`;
		const counts = statusCountsByEnvironment.get(environment.id);
		const executed = counts.PASS + counts.FAIL > 0;
		const isMobile =
			environment.coverageKind === 'IOS_OLD_FLOOR' ||
			environment.coverageKind === 'ANDROID_OLD_FLOOR';
		if (!executed) {
			requireValue(
				environment.provenance.observation === 'NOT_OBSERVED',
				`${context}.provenance.observation must be NOT_OBSERVED when every result is NOT_RUN`,
			);
			requireValue(
				environment.executionMode === 'NOT_EXECUTED',
				`${context}.executionMode must be NOT_EXECUTED when every result is NOT_RUN`,
			);
			requireValue(
				environment.device.physical === 'NOT_OBSERVED',
				`${context}.device.physical must be NOT_OBSERVED when every result is NOT_RUN`,
			);
			if (isMobile) {
				requireValue(
					environment.floorRelation === 'NOT_OBSERVED',
					`${context}.floorRelation must be NOT_OBSERVED when every result is NOT_RUN`,
				);
			} else {
				requireValue(
					environment.stakeContainer.source === 'NOT_OBSERVED',
					`${context}.stakeContainer.source must be NOT_OBSERVED when every result is NOT_RUN`,
				);
			}
			continue;
		}

		requireValue(
			environment.provenance.observation === 'OPERATOR_REPORTED',
			`${context}.provenance.observation must be OPERATOR_REPORTED for executed results`,
		);
		requireValue(
			environment.executionMode !== 'NOT_EXECUTED',
			`${context}.executionMode must identify the execution route for PASS or FAIL results`,
		);
		if (environment.executionMode === 'DEVICE_FARM') {
			requireValue(
				environment.device.physical === 'PROVIDER_ASSERTED_PHYSICAL',
				`${context}.device.physical must be PROVIDER_ASSERTED_PHYSICAL for DEVICE_FARM`,
			);
		} else {
			requireValue(
				environment.device.physical === 'OPERATOR_ASSERTED_PHYSICAL',
				`${context}.device.physical must be OPERATOR_ASSERTED_PHYSICAL for local hardware execution`,
			);
		}
		if (isMobile) {
			requireValue(
				environment.floorRelation !== 'NOT_OBSERVED',
				`${context}.floorRelation must be recorded for executed mobile results`,
			);
		} else {
			requireValue(
				environment.stakeContainer.source === 'OPERATOR_ASSERTED_REAL_STAKE',
				`${context}.stakeContainer.source must be OPERATOR_ASSERTED_REAL_STAKE for executed Popout results`,
			);
		}
	}
}

function pathIsWithin(parent, child) {
	const path = relative(parent, child);
	return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function readTrustedReviewerPublicKey({
	publicKeyPath,
	expectedSha256,
	evidencePath,
	ownerReviewPath,
	attachmentsRoot,
}) {
	digest(expectedSha256, 'expected reviewer public-key SHA-256');
	requireValue(existsSync(publicKeyPath), `Reviewer public key does not exist: ${publicKeyPath}`);
	const stats = lstatSync(publicKeyPath);
	requireValue(
		stats.isFile() && !stats.isSymbolicLink(),
		'Reviewer public key must be a regular file, not a symlink',
	);
	const realPublicKeyPath = realpathSync(publicKeyPath);
	const untrustedRoots = [attachmentsRoot, dirname(evidencePath), dirname(ownerReviewPath)].map(
		(path) => realpathSync(path),
	);
	requireValue(
		untrustedRoots.every((root) => !pathIsWithin(root, realPublicKeyPath)),
		'Reviewer public key must resolve outside the evidence and attachment roots',
	);
	const bytes = readFileSync(realPublicKeyPath);
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	requireValue(
		sha256 === expectedSha256,
		'Reviewer public-key digest does not match the independently supplied SHA-256',
	);
	return { publicKeyPem: bytes.toString('utf8'), publicKeySourceSha256: sha256 };
}

function bytesMatchMediaType(bytes, mediaType) {
	if (mediaType === 'image/png')
		return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	if (mediaType === 'image/jpeg')
		return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	if (mediaType === 'image/webp')
		return (
			bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
			bytes.subarray(8, 12).toString('ascii') === 'WEBP'
		);
	if (mediaType === 'video/mp4' || mediaType === 'audio/mp4')
		return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
	if (mediaType === 'video/webm' || mediaType === 'audio/webm')
		return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
	if (mediaType === 'audio/wav')
		return (
			bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
			bytes.subarray(8, 12).toString('ascii') === 'WAVE'
		);
	if (mediaType === 'audio/ogg') return bytes.subarray(0, 4).toString('ascii') === 'OggS';
	if (mediaType === 'audio/mpeg') {
		return (
			bytes.subarray(0, 3).toString('ascii') === 'ID3' ||
			(bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
		);
	}
	return true;
}

function verifyAttachmentFiles(attachments, attachmentsRoot) {
	requireValue(
		typeof attachmentsRoot === 'string' && attachmentsRoot.length > 0,
		'attachmentsRoot is required for attachment readback',
	);
	requireValue(existsSync(attachmentsRoot), `Attachment root does not exist: ${attachmentsRoot}`);
	const rootStats = lstatSync(attachmentsRoot);
	requireValue(
		rootStats.isDirectory() && !rootStats.isSymbolicLink(),
		'Attachment root must be a real directory, not a symlink',
	);
	const realRoot = realpathSync(attachmentsRoot);
	let totalBytes = 0;
	const identities = [];
	for (const attachment of attachments) {
		const candidatePath = resolve(realRoot, attachment.path);
		requireValue(
			pathIsWithin(realRoot, candidatePath),
			`Attachment ${attachment.id} escapes the attachment root`,
		);
		requireValue(
			existsSync(candidatePath),
			`Attachment ${attachment.id} is missing: ${attachment.path}`,
		);
		const stats = lstatSync(candidatePath);
		requireValue(
			stats.isFile() && !stats.isSymbolicLink(),
			`Attachment ${attachment.id} must be a regular file, not a symlink`,
		);
		const realPath = realpathSync(candidatePath);
		requireValue(
			pathIsWithin(realRoot, realPath),
			`Attachment ${attachment.id} resolves outside the attachment root`,
		);
		const bytes = readFileSync(realPath);
		const actualSha256 = createHash('sha256').update(bytes).digest('hex');
		requireValue(
			bytes.length === attachment.bytes,
			`Attachment ${attachment.id} byte count does not match readback`,
		);
		requireValue(
			actualSha256 === attachment.sha256,
			`Attachment ${attachment.id} SHA-256 does not match readback`,
		);
		requireValue(
			bytesMatchMediaType(bytes, attachment.mediaType),
			`Attachment ${attachment.id} bytes do not match media type ${attachment.mediaType}`,
		);
		totalBytes += bytes.length;
		identities.push({
			id: attachment.id,
			environmentId: attachment.environmentId,
			operatorId: attachment.operatorId,
			captureScope: attachment.captureScope,
			scenarioIds: [...attachment.scenarioIds],
			path: attachment.path,
			bytes: bytes.length,
			sha256: actualSha256,
		});
	}
	return { totalBytes, identities };
}

function resultOutcome(statusCounts) {
	if (statusCounts.PASS === 0 && statusCounts.FAIL === 0) return 'ALL_RESULTS_NOT_RUN';
	if (statusCounts.FAIL > 0 && statusCounts.NOT_RUN > 0) return 'RECORDED_FAILURES_AND_NOT_RUN';
	if (statusCounts.FAIL > 0) return 'RECORDED_FAILURES';
	if (statusCounts.NOT_RUN > 0) return 'RECORDED_NOT_RUN';
	return 'ALL_RESULTS_REPORTED_PASS_PENDING_OWNER_REVIEW';
}

export function verifyDeviceEvidence(evidence, options = {}) {
	objectValue(options, 'options');
	const verificationTime =
		options.verificationTime instanceof Date
			? options.verificationTime.getTime()
			: Date.parse(options.verificationTime ?? new Date().toISOString());
	requireValue(
		Number.isFinite(verificationTime),
		'verificationTime must be a valid Date or ISO timestamp',
	);
	const evidenceJson = bindEvidenceJson(evidence, options.evidenceSourceBytes);
	exactKeys(
		evidence,
		[
			'schema',
			'contractVersion',
			'floorVersion',
			'claim',
			'identity',
			'record',
			'operators',
			'environments',
			'attachments',
			'results',
			'claims',
		],
		[],
		'evidence',
	);
	requireValue(
		evidence.schema === DEVICE_EVIDENCE_SCHEMA,
		`schema must be ${DEVICE_EVIDENCE_SCHEMA}`,
	);
	requireValue(
		evidence.contractVersion === DEVICE_QA_CONTRACT_VERSION,
		`contractVersion must be ${DEVICE_QA_CONTRACT_VERSION}`,
	);
	requireValue(
		evidence.floorVersion === OLD_DEVICE_FLOOR_VERSION,
		`floorVersion must be ${OLD_DEVICE_FLOOR_VERSION}`,
	);
	requireValue(
		evidence.claim === 'STRUCTURAL_RECORD_ONLY_NOT_DEVICE_APPROVAL',
		'claim must preserve the structural-only evidence boundary',
	);
	exactCandidateIdentity(evidence.identity, options.expectedIdentity);
	exactKeys(evidence.claims, ['deviceApproval', 'releaseApproval'], [], 'claims');
	requireValue(
		evidence.claims.deviceApproval === 'NOT_CLAIMED',
		'claims.deviceApproval must remain NOT_CLAIMED',
	);
	requireValue(
		evidence.claims.releaseApproval === 'NOT_CLAIMED',
		'claims.releaseApproval must remain NOT_CLAIMED',
	);
	const recordTimes = validateRecord(evidence.record, verificationTime);
	const operatorIds = validateOperators(evidence.operators);
	const { coverage, environmentById } = validateEnvironments(evidence.environments);
	const attachmentById = validateAttachments(
		evidence.attachments,
		recordTimes,
		environmentById,
		operatorIds,
	);
	const { statusCounts, statusCountsByEnvironment } = validateResults(
		evidence.results,
		evidence.environments,
		operatorIds,
		attachmentById,
		recordTimes,
	);
	validateEnvironmentExecutionProvenance(evidence.environments, statusCountsByEnvironment);
	const attachmentReadback = verifyAttachmentFiles(evidence.attachments, options.attachmentsRoot);
	const mobileEnvironments = evidence.environments.filter(
		(environment) =>
			environment.coverageKind === 'IOS_OLD_FLOOR' ||
			environment.coverageKind === 'ANDROID_OLD_FLOOR',
	);
	const observedMobileEnvironments = mobileEnvironments.filter(
		(environment) => environment.provenance.observation === 'OPERATOR_REPORTED',
	);
	const physicalFloorRelations = observedMobileEnvironments
		.filter((environment) => environment.floorRelation !== 'NOT_OBSERVED')
		.map((environment) => environment.floorRelation);
	let floorCoverage = 'NOT_OBSERVED';
	if (observedMobileEnvironments.length > 0) {
		const relation = physicalFloorRelations.every(
			(value) => value === 'AT_PROPOSED_FLOOR' || value === 'BELOW_PROPOSED_FLOOR',
		)
			? 'AT_OR_BELOW_RELATION_RECORDED_PENDING_OWNER_REVIEW'
			: 'ABOVE_FLOOR_RELATION_RECORDED_PENDING_OWNER_REVIEW';
		floorCoverage =
			observedMobileEnvironments.length === mobileEnvironments.length
				? relation
				: `PARTIAL_${relation}`;
	}
	return {
		schema: DEVICE_EVIDENCE_VALIDATION_SCHEMA,
		status: 'STRUCTURALLY_COMPLETE',
		claim: 'RECORD_STRUCTURE_IDENTITY_AND_ATTACHMENT_READBACK_ONLY',
		verifiedAt: new Date(verificationTime).toISOString(),
		evidenceJson,
		candidate: { ...evidence.identity },
		record: {
			id: evidence.record.id,
			completedAt: evidence.record.completedAt,
		},
		coverage: Object.fromEntries(coverage),
		environmentProvenance: evidence.environments.map((environment) => ({
			id: environment.id,
			observation: environment.provenance.observation,
			verification: environment.provenance.verification,
			executionMode: environment.executionMode,
			physical: environment.device.physical,
		})),
		results: {
			total: evidence.results.length,
			operatorReportedPass: statusCounts.PASS,
			operatorReportedFail: statusCounts.FAIL,
			operatorReportedNotRun: statusCounts.NOT_RUN,
			outcome: resultOutcome(statusCounts),
		},
		attachments: {
			count: evidence.attachments.length,
			totalBytes: attachmentReadback.totalBytes,
			readback:
				evidence.attachments.length === 0
					? 'NO_EXECUTED_RESULTS_NO_ATTACHMENTS'
					: 'BYTES_AND_SHA256_VERIFIED',
			identities: attachmentReadback.identities,
		},
		oldDeviceFloor: {
			version: OLD_DEVICE_FLOOR_VERSION,
			coverage: floorCoverage,
			atProposedFloorFacts: 'CANONICAL_FACTS_ENFORCED_WHEN_ASSERTED',
			proof: 'NOT_CLAIMED',
		},
		deviceApproval: 'NOT_CLAIMED',
		releaseApproval: 'NOT_CLAIMED',
		manualReviewRequired: true,
	};
}

function strictBase64(value, context) {
	meaningfulString(value, context, 16);
	requireValue(/^[A-Za-z0-9+/]+={0,2}$/u.test(value), `${context} must be canonical base64`);
	const bytes = Buffer.from(value, 'base64');
	requireValue(bytes.length > 0, `${context} must not be empty`);
	requireValue(bytes.toString('base64') === value, `${context} must be canonical base64`);
	return bytes;
}

function reviewSigningBytes(review) {
	const { valueBase64: ignoredValue, ...signatureMetadata } = review.signature;
	void ignoredValue;
	const signedValue = { ...review, signature: signatureMetadata };
	return Buffer.from(JSON.stringify(canonicalJsonValue(signedValue)), 'utf8');
}

function readJsonBytes(bytes, context) {
	requireValue(Buffer.isBuffer(bytes), `${context} must be exact file bytes`);
	requireValue(bytes.length > 0, `${context} must not be empty`);
	try {
		return JSON.parse(bytes.toString('utf8'));
	} catch (error) {
		fail(`${context} are not valid JSON: ${error.message}`);
	}
}

export function verifyDeviceOwnerReview(review, options = {}) {
	objectValue(options, 'options');
	const verificationTime =
		options.verificationTime instanceof Date
			? options.verificationTime.getTime()
			: Date.parse(options.verificationTime ?? new Date().toISOString());
	requireValue(
		Number.isFinite(verificationTime),
		'verificationTime must be a valid Date or ISO timestamp',
	);
	const evidence = readJsonBytes(options.evidenceSourceBytes, 'evidenceSourceBytes');
	const evidenceValidation = verifyDeviceEvidence(evidence, {
		expectedIdentity: options.expectedIdentity,
		attachmentsRoot: options.attachmentsRoot,
		verificationTime: new Date(verificationTime),
		evidenceSourceBytes: options.evidenceSourceBytes,
	});
	const reviewJson = bindEvidenceJson(review, options.reviewSourceBytes);
	exactKeys(
		review,
		['schema', 'claim', 'evidence', 'reviewer', 'decision', 'signature', 'claims'],
		[],
		'ownerReview',
	);
	requireValue(
		review.schema === DEVICE_OWNER_REVIEW_SCHEMA,
		`ownerReview.schema must be ${DEVICE_OWNER_REVIEW_SCHEMA}`,
	);
	requireValue(
		review.claim === 'SIGNED_OWNER_DECISION_NOT_STAKE_OR_RELEASE_APPROVAL',
		'ownerReview.claim must preserve the owner-only decision boundary',
	);
	exactKeys(
		review.evidence,
		['schema', 'recordId', 'identity', 'exactSourceBytes'],
		[],
		'ownerReview.evidence',
	);
	requireValue(
		review.evidence.schema === DEVICE_EVIDENCE_SCHEMA,
		`ownerReview.evidence.schema must be ${DEVICE_EVIDENCE_SCHEMA}`,
	);
	identifier(review.evidence.recordId, 'ownerReview.evidence.recordId');
	requireValue(
		review.evidence.recordId === evidenceValidation.record.id,
		'ownerReview.evidence.recordId does not match the validated evidence record',
	);
	exactCandidateIdentity(review.evidence.identity, options.expectedIdentity);
	exactKeys(
		review.evidence.exactSourceBytes,
		['bytes', 'sha256'],
		[],
		'ownerReview.evidence.exactSourceBytes',
	);
	positiveInteger(
		review.evidence.exactSourceBytes.bytes,
		'ownerReview.evidence.exactSourceBytes.bytes',
	);
	digest(review.evidence.exactSourceBytes.sha256, 'ownerReview.evidence.exactSourceBytes.sha256');
	requireValue(
		review.evidence.exactSourceBytes.bytes === evidenceValidation.evidenceJson.bytes &&
			review.evidence.exactSourceBytes.sha256 === evidenceValidation.evidenceJson.sha256,
		'ownerReview evidence byte identity does not match the exact validated evidence file',
	);

	exactKeys(review.reviewer, ['id', 'name', 'organization', 'role'], [], 'ownerReview.reviewer');
	identifier(review.reviewer.id, 'ownerReview.reviewer.id');
	meaningfulString(review.reviewer.name, 'ownerReview.reviewer.name');
	meaningfulString(review.reviewer.organization, 'ownerReview.reviewer.organization');
	meaningfulString(review.reviewer.role, 'ownerReview.reviewer.role');
	exactKeys(
		options.trustedReviewer,
		['id', 'keyId', 'publicKeyPem'],
		['publicKeySourceSha256'],
		'trustedReviewer',
	);
	identifier(options.trustedReviewer.id, 'trustedReviewer.id');
	identifier(options.trustedReviewer.keyId, 'trustedReviewer.keyId');
	meaningfulString(options.trustedReviewer.publicKeyPem, 'trustedReviewer.publicKeyPem', 32);
	if (options.trustedReviewer.publicKeySourceSha256 !== undefined) {
		digest(
			options.trustedReviewer.publicKeySourceSha256,
			'trustedReviewer.publicKeySourceSha256',
		);
		const actualPublicKeySourceSha256 = createHash('sha256')
			.update(Buffer.from(options.trustedReviewer.publicKeyPem, 'utf8'))
			.digest('hex');
		requireValue(
			options.trustedReviewer.publicKeySourceSha256 === actualPublicKeySourceSha256,
			'trustedReviewer.publicKeySourceSha256 does not match the exact publicKeyPem bytes',
		);
	}
	requireValue(
		review.reviewer.id === options.trustedReviewer.id,
		'ownerReview.reviewer.id does not match the independently trusted reviewer',
	);

	exactKeys(review.decision, ['status', 'scope', 'decidedAt', 'notes'], [], 'ownerReview.decision');
	requireValue(
		ownerDecisionStatuses.has(review.decision.status),
		'ownerReview.decision.status must be ACCEPTED, REJECTED, or CHANGES_REQUIRED',
	);
	requireValue(
		review.decision.scope === 'DEVICE_QA_MANUAL_REVIEW',
		'ownerReview.decision.scope must be DEVICE_QA_MANUAL_REVIEW',
	);
	const decidedAt = timestamp(review.decision.decidedAt, 'ownerReview.decision.decidedAt');
	requireValue(
		decidedAt >= Date.parse(evidenceValidation.record.completedAt),
		'ownerReview.decision.decidedAt must not precede evidence completion',
	);
	requireValue(
		decidedAt <= verificationTime + maxClockSkewMs,
		'ownerReview.decision.decidedAt is in the future',
	);
	requireValue(
		verificationTime - decidedAt <= maxEvidenceAgeMs,
		`ownerReview.decision.decidedAt is stale; review must be no more than ${DEVICE_EVIDENCE_MAX_AGE_DAYS} days old`,
	);
	meaningfulString(review.decision.notes, 'ownerReview.decision.notes', 12);
	if (review.decision.status === 'ACCEPTED') {
		requireValue(
			evidenceValidation.results.operatorReportedPass === evidenceValidation.results.total,
			'ownerReview cannot ACCEPT evidence containing FAIL or NOT_RUN results',
		);
		requireValue(
			evidenceValidation.oldDeviceFloor.coverage ===
				'AT_OR_BELOW_RELATION_RECORDED_PENDING_OWNER_REVIEW',
			'ownerReview cannot ACCEPT incomplete or above-floor mobile coverage',
		);
	}

	exactKeys(
		review.signature,
		['algorithm', 'keyId', 'publicKeySpkiSha256', 'signedAt', 'valueBase64'],
		[],
		'ownerReview.signature',
	);
	requireValue(
		review.signature.algorithm === 'Ed25519',
		'ownerReview.signature.algorithm must be Ed25519',
	);
	identifier(review.signature.keyId, 'ownerReview.signature.keyId');
	requireValue(
		review.signature.keyId === options.trustedReviewer.keyId,
		'ownerReview.signature.keyId does not match the independently trusted key',
	);
	digest(review.signature.publicKeySpkiSha256, 'ownerReview.signature.publicKeySpkiSha256');
	const signedAt = timestamp(review.signature.signedAt, 'ownerReview.signature.signedAt');
	requireValue(signedAt >= decidedAt, 'ownerReview.signature.signedAt must not precede decidedAt');
	requireValue(
		signedAt <= verificationTime + maxClockSkewMs,
		'ownerReview.signature.signedAt is in the future',
	);
	const signatureBytes = strictBase64(
		review.signature.valueBase64,
		'ownerReview.signature.valueBase64',
	);
	let publicKey;
	try {
		publicKey = createPublicKey(options.trustedReviewer.publicKeyPem);
	} catch (error) {
		fail(`trustedReviewer.publicKeyPem is invalid: ${error.message}`);
	}
	requireValue(
		publicKey.asymmetricKeyType === 'ed25519',
		'trustedReviewer.publicKeyPem must contain an Ed25519 public key',
	);
	const publicKeySpki = publicKey.export({ type: 'spki', format: 'der' });
	const publicKeySpkiSha256 = createHash('sha256').update(publicKeySpki).digest('hex');
	requireValue(
		review.signature.publicKeySpkiSha256 === publicKeySpkiSha256,
		'ownerReview.signature.publicKeySpkiSha256 does not match the trusted public key',
	);
	requireValue(
		verifySignature(null, reviewSigningBytes(review), publicKey, signatureBytes),
		'ownerReview signature verification failed',
	);

	exactKeys(review.claims, ['stakeApproval', 'releaseApproval'], [], 'ownerReview.claims');
	requireValue(
		review.claims.stakeApproval === 'NOT_CLAIMED',
		'ownerReview.claims.stakeApproval must remain NOT_CLAIMED',
	);
	requireValue(
		review.claims.releaseApproval === 'NOT_CLAIMED',
		'ownerReview.claims.releaseApproval must remain NOT_CLAIMED',
	);
	return {
		schema: DEVICE_OWNER_REVIEW_VALIDATION_SCHEMA,
		status: 'SIGNED_OWNER_DECISION_VERIFIED',
		claim: 'SIGNATURE_AND_BINDING_ONLY_AUTHORITY_AND_EXTERNAL_APPROVAL_NOT_ATTESTED',
		verifiedAt: new Date(verificationTime).toISOString(),
		reviewJson,
		evidenceJson: { ...evidenceValidation.evidenceJson },
		candidate: { ...evidenceValidation.candidate },
		recordId: evidenceValidation.record.id,
		reviewer: {
			id: review.reviewer.id,
			keyId: review.signature.keyId,
			publicKeySpkiSha256,
			publicKeySourceSha256:
				options.trustedReviewer.publicKeySourceSha256 ?? 'NOT_PROVIDED_MODULE_CALL',
			authority: 'CALLER_SUPPLIED_TRUST_NOT_MACHINE_ATTESTED',
		},
		decision: {
			status: review.decision.status,
			scope: review.decision.scope,
			decidedAt: review.decision.decidedAt,
		},
		deviceApproval: 'NOT_CLAIMED',
		stakeApproval: 'NOT_CLAIMED',
		releaseApproval: 'NOT_CLAIMED',
	};
}

function requiredArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing required argument ${name}`);
	}
	return process.argv[index + 1];
}

function parseArguments() {
	const evidenceUsage = [
		'Usage: node scripts/blacksite-device-evidence.mjs',
		'  --evidence <record.json>',
		'  --attachments-root <directory>',
		'  --expected-git-sha <40-hex>',
		'  --expected-frontend-tree <64-hex>',
		'  --expected-math-tree <64-hex>',
		'  --expected-math-fingerprint <64-hex>',
	].join(' \\\n');
	const ownerReviewUsage = [
		'Owner review: node scripts/blacksite-device-evidence.mjs',
		'  --owner-review <review.json>',
		'  --evidence <record.json>',
		'  --attachments-root <directory>',
		'  --reviewer-public-key <ed25519-public-key.pem>',
		'  --expected-reviewer-public-key-sha256 <64-hex>',
		'  --expected-reviewer-id <identifier>',
		'  --expected-reviewer-key-id <identifier>',
		'  --expected-git-sha <40-hex>',
		'  --expected-frontend-tree <64-hex>',
		'  --expected-math-tree <64-hex>',
		'  --expected-math-fingerprint <64-hex>',
	].join(' \\\n');
	try {
		const common = {
			evidencePath: resolve(repoRoot, requiredArgument('--evidence')),
			attachmentsRoot: resolve(repoRoot, requiredArgument('--attachments-root')),
			expectedIdentity: {
				gitSha: requiredArgument('--expected-git-sha'),
				frontendTreeSha256: requiredArgument('--expected-frontend-tree'),
				mathTreeSha256: requiredArgument('--expected-math-tree'),
				mathCandidateFingerprintSha256: requiredArgument('--expected-math-fingerprint'),
			},
		};
		if (!process.argv.includes('--owner-review')) return { mode: 'evidence', ...common };
		return {
			mode: 'owner-review',
			...common,
			ownerReviewPath: resolve(repoRoot, requiredArgument('--owner-review')),
			trustedReviewer: {
				id: requiredArgument('--expected-reviewer-id'),
				keyId: requiredArgument('--expected-reviewer-key-id'),
				publicKeyPath: resolve(repoRoot, requiredArgument('--reviewer-public-key')),
				expectedPublicKeySha256: requiredArgument(
					'--expected-reviewer-public-key-sha256',
				),
			},
		};
	} catch (error) {
		if (error instanceof Error)
			error.message = `${error.message}\n${evidenceUsage}\n\n${ownerReviewUsage}`;
		throw error;
	}
}

function readEvidenceFile(path) {
	requireValue(existsSync(path), `Evidence file does not exist: ${path}`);
	const bytes = readFileSync(path);
	try {
		return { bytes, evidence: JSON.parse(bytes.toString('utf8')) };
	} catch (error) {
		fail(`Evidence file is not valid JSON: ${error.message}`);
	}
}

function main() {
	try {
		const argumentsValue = parseArguments();
		const source = readEvidenceFile(argumentsValue.evidencePath);
		let result;
		if (argumentsValue.mode === 'owner-review') {
			const reviewSource = readEvidenceFile(argumentsValue.ownerReviewPath);
			const trustedPublicKey = readTrustedReviewerPublicKey({
				publicKeyPath: argumentsValue.trustedReviewer.publicKeyPath,
				expectedSha256: argumentsValue.trustedReviewer.expectedPublicKeySha256,
				evidencePath: argumentsValue.evidencePath,
				ownerReviewPath: argumentsValue.ownerReviewPath,
				attachmentsRoot: argumentsValue.attachmentsRoot,
			});
			result = verifyDeviceOwnerReview(reviewSource.evidence, {
				...argumentsValue,
				evidenceSourceBytes: source.bytes,
				reviewSourceBytes: reviewSource.bytes,
				trustedReviewer: {
					id: argumentsValue.trustedReviewer.id,
					keyId: argumentsValue.trustedReviewer.keyId,
					...trustedPublicKey,
				},
			});
		} else {
			result = verifyDeviceEvidence(source.evidence, {
				...argumentsValue,
				evidenceSourceBytes: source.bytes,
			});
		}
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} catch (error) {
		process.stderr.write(`BLACKSITE device evidence rejected: ${error.message}\n`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
