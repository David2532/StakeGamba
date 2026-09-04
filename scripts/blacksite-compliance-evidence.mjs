import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODES } from '../apps/blacksite/src/lib/contracts/modes.js';
import {
	CONTROL_GUIDE,
	RULES_CONTRACT,
	SYMBOL_PAYOUTS,
} from '../apps/blacksite/src/lib/contracts/rules.js';
import {
	BLACKSITE_PERFORMANCE_BUDGET,
	summarizePerformanceRuns,
} from './blacksite-performance-budget.mjs';
import {
	BLACKSITE_SECURITY_EVIDENCE_SCHEMA,
	BLACKSITE_SECURITY_POLICY,
} from './blacksite-security-evidence.mjs';
import {
	BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA,
	BLACKSITE_REPOSITORY_GATES,
} from './blacksite-repository-evidence.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const defaultEvidenceMapPath = resolve(repoRoot, 'docs/blacksite/RELEASE_EVIDENCE_51.json');
const defaultRepositoryEvidencePath = resolve(
	repoRoot,
	'artifacts/blacksite-ci/repository-gates.json',
);
const defaultSecurityEvidencePath = resolve(
	repoRoot,
	'artifacts/blacksite-security/security-evidence.json',
);
const canonicalRequirementsSource = 'docs/blacksite/STAKE_REQUIREMENTS_51.md';
const canonicalRequirementsPath = resolve(repoRoot, canonicalRequirementsSource);
const canonicalStatusDefinitions = Object.freeze({
	AUTOMATED_PASS:
		'Repository-owned automated proof is complete for the exact candidate; no manual or external gate is required for this row.',
	AUTOMATED_PASS_MANUAL_OPEN:
		'Automated proof passes, but the row remains open until the recorded manual review is completed.',
	MANUAL_OPEN:
		'The requirement needs human or real-device evidence that repository automation cannot self-certify.',
	EXTERNAL_OPEN:
		'The requirement depends on Stake, ACP, Slack, publication, or live evidence outside repository authority.',
	NOT_APPLICABLE: 'The versioned product contract does not include the conditional feature.',
});
const allowedStatuses = new Set(Object.keys(canonicalStatusDefinitions));
const canonicalRequirementIdsByStatus = Object.freeze({
	AUTOMATED_PASS: Object.freeze([
		1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 24, 30, 32, 36, 40, 41, 42, 43,
	]),
	AUTOMATED_PASS_MANUAL_OPEN: Object.freeze([
		17, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 31, 33, 35, 37, 38, 39, 44,
	]),
	MANUAL_OPEN: Object.freeze([5, 6, 7, 8, 49]),
	EXTERNAL_OPEN: Object.freeze([45, 46, 47, 48, 50, 51]),
	NOT_APPLICABLE: Object.freeze([23, 34]),
});
const canonicalStatusByRequirement = new Map(
	Object.entries(canonicalRequirementIdsByStatus).flatMap(([status, ids]) =>
		ids.map((id) => [id, status]),
	),
);
if (
	canonicalStatusByRequirement.size !== 51 ||
	Array.from({ length: 51 }, (_, index) => index + 1).some(
		(id) => !canonicalStatusByRequirement.has(id),
	)
) {
	throw new Error('Canonical 51-point status policy must classify every requirement exactly once');
}
const openFieldByStatus = new Map([
	['AUTOMATED_PASS_MANUAL_OPEN', 'manualOpen'],
	['MANUAL_OPEN', 'manualOpen'],
	['EXTERNAL_OPEN', 'externalOpen'],
	['NOT_APPLICABLE', 'notApplicableReason'],
]);
const lifecycleFields = Object.freeze(['manualOpen', 'externalOpen', 'notApplicableReason']);
const allowedBrowserStatuses = new Set(['PASS', 'FAIL']);
const fullGitSha = /^[0-9a-f]{40}$/u;
const sha256 = /^[0-9a-f]{64}$/u;
const browserEvidenceSchema = 'blacksite-browser-evidence-v2';
const expectedAccessibilitySurfaces = Object.freeze([
	'live-authenticating',
	'boot-intro-modal-mobile',
	'live-ready-desktop',
	'live-result-desktop',
	'rules-modal-desktop',
	'high-cost-confirmation-modal-desktop',
	'replay-ready-popout-s',
	'replay-completed-popout-s',
]);
const expectedAccessibilityTags = Object.freeze([
	'wcag2a',
	'wcag2aa',
	'wcag21a',
	'wcag21aa',
	'wcag22aa',
]);
const expectedSecurityCheckIds = Object.freeze([
	'exact-git-identity',
	'repository-inputs-readable',
	'package-manager-version',
	'workspace-package-manager-policy',
	'audit-registry-and-npmrc-policy',
	'vite-exact-manifest-pin',
	'adapter-static-exact-pin',
	'devalue-exact-override',
	'vite-lockfile-floor',
	'devalue-lockfile-floor',
	'production-registry-audit',
]);
const repositoryReceiptRequirements = new Map([
	['candidateManifest:allMathVerificationGates', new Set([45])],
	['packageVerification:bookLookupIdAndPayoutMatch', new Set([18])],
]);

function fail(message) {
	throw new Error(message);
}

function argument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing required argument ${name}`);
	}
	return resolve(repoRoot, process.argv[index + 1]);
}

function optionalArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0) return null;
	if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing value for argument ${name}`);
	}
	return resolve(repoRoot, process.argv[index + 1]);
}

function readPhysicalDocument(path, label) {
	if (!existsSync(path)) fail(`Missing ${label}: ${path}`);
	const stats = lstatSync(path);
	if (stats.isSymbolicLink() || !stats.isFile()) {
		fail(`${label} must be a physical regular file: ${path}`);
	}
	if (realpathSync(path) !== resolve(path)) {
		fail(`${label} must not resolve through a symbolic-link ancestor: ${path}`);
	}
	const bytes = readFileSync(path);
	return {
		bytes,
		file: {
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		},
	};
}

function readJsonDocument(path, label) {
	const document = readPhysicalDocument(path, label);
	try {
		return {
			value: JSON.parse(document.bytes.toString('utf8')),
			file: document.file,
		};
	} catch (error) {
		fail(`Invalid ${label}: ${error.message}`);
	}
}

function pathIsWithin(parent, child) {
	const path = relative(parent, child);
	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function validateOutputPath({
	outputPath,
	candidateRoot,
	browserEvidencePath,
	evidenceMapPath,
	repositoryEvidencePath,
	securityEvidencePath,
}) {
	if (existsSync(outputPath)) fail(`Output already exists; refusing to overwrite: ${outputPath}`);
	const outputParent = dirname(outputPath);
	if (!existsSync(outputParent)) fail(`Output parent must already exist: ${outputParent}`);
	const parentStats = lstatSync(outputParent);
	if (
		parentStats.isSymbolicLink() ||
		!parentStats.isDirectory() ||
		realpathSync(outputParent) !== resolve(outputParent)
	) {
		fail(
			`Output parent must be a physical directory without symbolic-link ancestors: ${outputParent}`,
		);
	}
	for (const [protectedPath, label] of [
		[resolve(candidateRoot), 'candidate'],
		[dirname(resolve(browserEvidencePath)), 'browser run'],
	]) {
		if (pathIsWithin(protectedPath, outputPath) || pathIsWithin(outputPath, protectedPath)) {
			fail(`Output must not contain or be contained by the ${label} input: ${outputPath}`);
		}
	}
	for (const [inputPath, label] of [
		[resolve(candidateRoot, 'candidate-manifest.json'), 'candidate manifest'],
		[resolve(candidateRoot, 'package-verification.json'), 'package verification'],
		[resolve(browserEvidencePath), 'browser evidence'],
		[resolve(evidenceMapPath), '51-point source map'],
		...(repositoryEvidencePath
			? [[resolve(repositoryEvidencePath), 'repository gate evidence']]
			: []),
		...(securityEvidencePath ? [[resolve(securityEvidencePath), 'security evidence']] : []),
	]) {
		if (outputPath === inputPath) fail(`Output must not overwrite the ${label}: ${outputPath}`);
	}
	return outputPath;
}

function meaningfulString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function sourceBinding(relativePath) {
	const document = readPhysicalDocument(resolve(repoRoot, relativePath), 'absence-proof source');
	return { path: relativePath, ...document.file };
}

function fileBinding(path) {
	const document = readPhysicalDocument(path, 'evidence input');
	return {
		path: relative(repoRoot, path).split(sep).join('/'),
		...document.file,
	};
}

const automatedAbsenceProofs = new Map([
	[
		'blacksite-autoplay-surface-absent-v1',
		() => {
			const pagePath = 'apps/blacksite/src/routes/+page.svelte';
			const pageSource = readFileSync(resolve(repoRoot, pagePath), 'utf8');
			const controlKeys = CONTROL_GUIDE.map(({ key }) => key);
			const autoplaySurface = /(?:autoplay|auto[-_ ]?(?:bet|spin))/iu;
			if (
				controlKeys.some((key) => autoplaySurface.test(key)) ||
				autoplaySurface.test(pageSource)
			) {
				fail('Autoplay absence proof failed: an autoplay control or surface is present');
			}
			return {
				id: 'blacksite-autoplay-surface-absent-v1',
				status: 'PASS',
				assertion:
					'The canonical control inventory and rendered application expose no autoplay action.',
				observed: { canonicalControlKeys: controlKeys },
				sources: [
					sourceBinding('apps/blacksite/src/lib/contracts/rules.js'),
					sourceBinding(pagePath),
				],
			};
		},
	],
	[
		'blacksite-mystery-product-contract-absent-v1',
		() => {
			const eventContractPath = 'apps/blacksite/src/lib/contracts/game-events.d.ts';
			const eventContract = readFileSync(resolve(repoRoot, eventContractPath), 'utf8');
			const modeIds = MODES.map(({ id }) => id);
			const symbolIds = Object.keys(SYMBOL_PAYOUTS);
			const mystery = /mystery/iu;
			const rulesDeclareAbsence = RULES_CONTRACT.feature.some((line) =>
				/no Wild, Scatter or Mystery symbols/iu.test(line),
			);
			if (
				MODES.some((mode) => mystery.test(JSON.stringify(mode))) ||
				symbolIds.some((symbol) => mystery.test(symbol)) ||
				mystery.test(eventContract) ||
				!rulesDeclareAbsence
			) {
				fail(
					'Mystery absence proof failed: the canonical product or event contract includes Mystery',
				);
			}
			return {
				id: 'blacksite-mystery-product-contract-absent-v1',
				status: 'PASS',
				assertion:
					'The canonical mode, symbol, rules and event contracts contain no Mystery feature or symbol.',
				observed: { canonicalModeIds: modeIds, canonicalSymbolIds: symbolIds },
				sources: [
					sourceBinding('apps/blacksite/src/lib/contracts/modes.js'),
					sourceBinding('apps/blacksite/src/lib/contracts/rules.js'),
					sourceBinding(eventContractPath),
				],
			};
		},
	],
]);

function checkReferenceIdentity(check) {
	return JSON.stringify([check.group, check.name]);
}

function browserCheckIdentity(check) {
	return JSON.stringify([check.group, check.name, check.occurrence]);
}

function repositoryGateIdentity(gate) {
	return `${gate.receipt}:${gate.claim}`;
}

function requireUnique(values, label) {
	const seen = new Set();
	for (const value of values) {
		if (seen.has(value)) fail(`${label} must be unique: ${value}`);
		seen.add(value);
	}
}

function validateStatusDefinitions(definitions) {
	if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) {
		fail('Evidence-map statusDefinitions must preserve the canonical lifecycle meanings');
	}
	const expectedKeys = Object.keys(canonicalStatusDefinitions).sort();
	const actualKeys = Object.keys(definitions).sort();
	if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
		fail('Evidence-map statusDefinitions must preserve the canonical lifecycle meanings');
	}
	for (const [status, definition] of Object.entries(canonicalStatusDefinitions)) {
		if (definitions[status] !== definition) {
			fail(`Evidence-map status definition changed for ${status}`);
		}
	}
}

function validateLifecycleFields(item) {
	const expectedField = openFieldByStatus.get(item.status);
	for (const field of lifecycleFields) {
		if (field === expectedField) {
			if (!meaningfulString(item[field])) {
				fail(`Requirement ${item.id} must name its canonical ${field} gate`);
			}
		} else if (Object.hasOwn(item, field)) {
			fail(`Requirement ${item.id} must not declare ${field} for status ${item.status}`);
		}
	}
}

function validateEvidenceMap(map, requirementsFile) {
	if (map.schema !== 'blacksite-stake-51-evidence-map-v2') fail('Unknown evidence-map schema');
	if (map.source !== canonicalRequirementsSource) {
		fail(`Evidence map source must be exactly ${canonicalRequirementsSource}`);
	}
	if (!sha256.test(map.sourceSha256 ?? '')) {
		fail('Evidence map sourceSha256 must be a lowercase SHA-256 digest');
	}
	if (map.sourceSha256 !== requirementsFile.sha256) {
		fail('Evidence map sourceSha256 does not match the canonical checklist bytes');
	}
	validateStatusDefinitions(map.statusDefinitions);
	if (!Array.isArray(map.items) || map.items.length !== 51) {
		fail(`Evidence map must contain exactly 51 items; received ${map.items?.length ?? 0}`);
	}
	const expectedIds = Array.from({ length: 51 }, (_, index) => index + 1);
	const actualIds = map.items.map((item) => item.id);
	if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
		fail('Evidence-map IDs must be unique and ordered from 1 through 51');
	}
	for (const item of map.items) {
		if (typeof item.requirement !== 'string' || item.requirement.trim().length < 8) {
			fail(`Requirement ${item.id} has no meaningful summary`);
		}
		if (!allowedStatuses.has(item.status)) fail(`Requirement ${item.id} has invalid status`);
		const canonicalStatus = canonicalStatusByRequirement.get(item.id);
		if (item.status !== canonicalStatus) {
			fail(
				`Requirement ${item.id} status must remain ${canonicalStatus} under the canonical 51-point policy; received ${item.status}`,
			);
		}
		validateLifecycleFields(item);
		const scenarios = item.browserScenarios ?? [];
		const checks = item.browserChecks ?? [];
		const repositoryGates = item.repositoryGates ?? [];
		const automatedAbsenceChecks = item.automatedAbsenceChecks ?? [];
		if (![scenarios, checks, repositoryGates, automatedAbsenceChecks].every(Array.isArray)) {
			fail(`Requirement ${item.id} evidence references must be arrays`);
		}
		if (!scenarios.every(meaningfulString)) {
			fail(`Requirement ${item.id} browser scenario references must be non-empty strings`);
		}
		for (const check of checks) {
			if (
				!check ||
				typeof check !== 'object' ||
				Array.isArray(check) ||
				JSON.stringify(Object.keys(check).sort()) !== JSON.stringify(['group', 'name']) ||
				!meaningfulString(check.group) ||
				!meaningfulString(check.name)
			) {
				fail(
					`Requirement ${item.id} browser check references must contain exact group/name identity`,
				);
			}
		}
		for (const gate of repositoryGates) {
			if (
				!gate ||
				typeof gate !== 'object' ||
				Array.isArray(gate) ||
				JSON.stringify(Object.keys(gate).sort()) !== JSON.stringify(['claim', 'receipt']) ||
				!meaningfulString(gate.receipt) ||
				!meaningfulString(gate.claim)
			) {
				fail(
					`Requirement ${item.id} repository gates must be structured candidate/package receipts`,
				);
			}
			const supportedRequirements = repositoryReceiptRequirements.get(repositoryGateIdentity(gate));
			if (!supportedRequirements?.has(item.id)) {
				fail(`Requirement ${item.id} names an unsupported repository receipt for this row`);
			}
		}
		requireUnique(scenarios, `Requirement ${item.id} browser scenario references`);
		requireUnique(
			checks.map(checkReferenceIdentity),
			`Requirement ${item.id} browser check references`,
		);
		requireUnique(
			repositoryGates.map(repositoryGateIdentity),
			`Requirement ${item.id} repository gate references`,
		);
		if (item.status === 'NOT_APPLICABLE') {
			if (automatedAbsenceChecks.length === 0) {
				fail(`Requirement ${item.id} must reference an automated absence proof`);
			}
			requireUnique(
				automatedAbsenceChecks,
				`Requirement ${item.id} automated absence-proof references`,
			);
			for (const proofId of automatedAbsenceChecks) {
				if (!meaningfulString(proofId) || !automatedAbsenceProofs.has(proofId)) {
					fail(`Requirement ${item.id} references an unknown automated absence proof: ${proofId}`);
				}
			}
		} else if (automatedAbsenceChecks.length > 0) {
			fail(`Requirement ${item.id} may not use absence proof outside NOT_APPLICABLE`);
		}
		if (
			item.status.startsWith('AUTOMATED_PASS') &&
			scenarios.length + checks.length + repositoryGates.length === 0
		) {
			fail(`Requirement ${item.id} claims automated proof without an evidence reference`);
		}
	}
	return map.items;
}

function validatePackage(candidateRoot) {
	const manifestDocument = readJsonDocument(
		resolve(candidateRoot, 'candidate-manifest.json'),
		'candidate manifest',
	);
	const verificationDocument = readJsonDocument(
		resolve(candidateRoot, 'package-verification.json'),
		'package verification',
	);
	const manifest = manifestDocument.value;
	const verification = verificationDocument.value;
	if (
		manifest.schema !== 'blacksite-upload-candidate-v1' ||
		verification.schema !== 'blacksite-upload-candidate-verification-v1' ||
		verification.result !== 'PASS' ||
		manifest.lifecycle !== 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY' ||
		manifest.approvalStatus !== 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN' ||
		manifest.uploadAuthorized !== false ||
		verification.claims?.uploadPayloadStructureAndIdentity !== 'PASS' ||
		verification.claims?.stakeApproval !== 'NOT_CLAIMED' ||
		verification.claims?.releaseReadiness !== 'NOT_CLAIMED' ||
		!fullGitSha.test(manifest.git?.sha ?? '') ||
		!sha256.test(manifest.packages?.frontend?.treeSha256 ?? '') ||
		!sha256.test(manifest.packages?.math?.treeSha256 ?? '') ||
		!sha256.test(manifest.mathEvidence?.candidateFingerprintSha256 ?? '') ||
		manifest.git?.sha !== verification.gitSha ||
		manifest.packages?.frontend?.treeSha256 !== verification.frontend?.treeSha256 ||
		manifest.packages?.math?.treeSha256 !== verification.math?.treeSha256
	) {
		fail('Candidate manifest and successful package verification are not identity-consistent');
	}
	return { manifest, verification, manifestDocument, verificationDocument };
}

function validateFileManifest(fileManifest, label) {
	if (
		typeof fileManifest?.algorithm !== 'string' ||
		fileManifest.algorithm.length === 0 ||
		!sha256.test(fileManifest.treeSha256 ?? '') ||
		!Number.isSafeInteger(fileManifest.fileCount) ||
		fileManifest.fileCount <= 0 ||
		!Number.isSafeInteger(fileManifest.totalBytes) ||
		fileManifest.totalBytes <= 0 ||
		!Array.isArray(fileManifest.files) ||
		fileManifest.files.length !== fileManifest.fileCount
	) {
		fail(`Browser ${label} manifest is incomplete`);
	}
	const paths = new Set();
	let totalBytes = 0;
	for (const file of fileManifest.files) {
		if (
			typeof file?.path !== 'string' ||
			file.path.length === 0 ||
			paths.has(file.path) ||
			!Number.isSafeInteger(file.bytes) ||
			file.bytes < 0 ||
			!sha256.test(file.sha256 ?? '')
		) {
			fail(`Browser ${label} manifest contains an invalid file record`);
		}
		paths.add(file.path);
		totalBytes += file.bytes;
	}
	if (totalBytes !== fileManifest.totalBytes) {
		fail(`Browser ${label} manifest byte total is inconsistent`);
	}
}

function validatePerformanceEvidence(performance, manifest) {
	if (
		performance?.schema !== 'blacksite-performance-lab-evidence-v1' ||
		performance.measurementKind !== BLACKSITE_PERFORMANCE_BUDGET.measurementKind ||
		performance.fieldData !== false ||
		performance.fieldDataStatus !== 'NOT_COLLECTED' ||
		!meaningfulString(performance.fieldDataReason) ||
		!sameJson(performance.budget, BLACKSITE_PERFORMANCE_BUDGET)
	) {
		fail('Browser performance evidence does not match the predeclared lab contract');
	}
	if (
		performance.environment?.testedGitSha !== manifest.git.sha ||
		performance.environment?.buildTreeSha256 !== manifest.packages.frontend.treeSha256 ||
		performance.environment?.ci !== true ||
		performance.environment?.headless !== true ||
		!sameJson(
			performance.environment?.viewport,
			BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.viewport,
		) ||
		performance.environment?.cache !== BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.cache ||
		performance.environment?.network !== BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.network ||
		performance.environment?.motion !== BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.motion ||
		performance.environment?.sequence !== BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.sequence ||
		!meaningfulString(performance.environment?.node) ||
		!meaningfulString(performance.environment?.playwright) ||
		!meaningfulString(performance.environment?.chromium)
	) {
		fail('Browser performance evidence is not bound to the exact candidate environment');
	}
	if (!Array.isArray(performance.runs) || !Array.isArray(performance.summaries)) {
		fail('Browser performance evidence must contain run and summary arrays');
	}
	const stateIds = Object.keys(BLACKSITE_PERFORMANCE_BUDGET.states);
	if (
		performance.runs.length !==
			stateIds.length * BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState ||
		performance.summaries.length !== stateIds.length
	) {
		fail('Browser performance evidence has incomplete state or run coverage');
	}
	const recomputedSummaries = stateIds.map((stateId) => {
		const runs = performance.runs.filter((run) => run?.stateId === stateId);
		if (
			runs.length !== BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState ||
			!sameJson(
				runs.map((run) => run.run),
				Array.from(
					{ length: BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState },
					(_, index) => index + 1,
				),
			) ||
			runs.some((run) => {
				const support = run.support;
				return (
					run.primaryInteraction?.selector !== '[data-testid="primary-action"]' ||
					run.primaryInteraction?.testId !== 'primary-action' ||
					!Number.isFinite(run.primaryInteraction?.armedAt) ||
					run.primaryInteraction.armedAt <= 0 ||
					run.primaryInteraction?.trustedClickCount !== 1 ||
					run.primaryInteraction?.observedEntryCount < 1 ||
					!['event', 'first-input'].includes(run.eventTimingSource) ||
					!Number.isSafeInteger(run.interactionCount) ||
					run.interactionCount < 1 ||
					!Number.isSafeInteger(run.frameSamples) ||
					run.frameSamples < 3 ||
					!Number.isSafeInteger(run.resourceCount) ||
					run.resourceCount < 0 ||
					!support ||
					Object.values(support).length !== 5 ||
					Object.values(support).some((value) => value !== true) ||
					!Array.isArray(run.observerErrors) ||
					run.observerErrors.length > 0
				);
			})
		) {
			fail(`Browser performance state ${stateId} is not bound to three primary interactions`);
		}
		return summarizePerformanceRuns(stateId, runs);
	});
	if (!sameJson(performance.summaries, recomputedSummaries)) {
		fail('Browser performance summaries are inconsistent with their measured runs');
	}
	const summary = {
		states: recomputedSummaries.length,
		pass: recomputedSummaries.filter(({ status }) => status === 'PASS').length,
		fail: recomputedSummaries.filter(({ status }) => status === 'FAIL').length,
		runs: performance.runs.length,
	};
	if (!sameJson(performance.summary, summary) || summary.fail > 0) {
		fail('Browser performance evidence does not pass every predeclared budget');
	}
	return summary;
}

function validateAccessibilityEvidence(accessibility) {
	if (
		accessibility?.schema !== 'blacksite-accessibility-evidence-v1' ||
		accessibility.standard !== 'WCAG 2.2 Level A and AA automated rules' ||
		accessibility.engine?.name !== 'axe-core' ||
		accessibility.engine?.version !== '4.13.0' ||
		!sameJson(accessibility.tags, expectedAccessibilityTags) ||
		!Array.isArray(accessibility.audits) ||
		accessibility.audits.length !== expectedAccessibilitySurfaces.length
	) {
		fail('Browser accessibility evidence is incomplete or uses an unreviewed engine');
	}
	const surfaces = new Set();
	for (const audit of accessibility.audits) {
		if (
			!meaningfulString(audit?.surface) ||
			surfaces.has(audit.surface) ||
			!Array.isArray(audit.passes) ||
			audit.passes.length === 0 ||
			!Array.isArray(audit.violations) ||
			!Array.isArray(audit.incomplete) ||
			audit.violations.length > 0
		) {
			fail('Browser accessibility evidence contains an invalid or failing whole-document audit');
		}
		surfaces.add(audit.surface);
	}
	if (expectedAccessibilitySurfaces.some((surface) => !surfaces.has(surface))) {
		fail('Browser accessibility evidence omits a required product surface');
	}
	const summary = {
		audits: accessibility.audits.length,
		passes: accessibility.audits.reduce((total, audit) => total + audit.passes.length, 0),
		violations: accessibility.audits.reduce((total, audit) => total + audit.violations.length, 0),
		incomplete: accessibility.audits.reduce((total, audit) => total + audit.incomplete.length, 0),
	};
	if (!sameJson(accessibility.summary, summary) || summary.violations > 0) {
		fail('Browser accessibility summary is inconsistent or contains violations');
	}
	return summary;
}

function validateExtendedBrowserEvidence(browserEvidence, manifest) {
	if (
		browserEvidence.schema !== browserEvidenceSchema ||
		browserEvidence.identity?.worktreeDirty !== false ||
		!fullGitSha.test(browserEvidence.identity?.testedGitSha ?? '') ||
		!sha256.test(browserEvidence.identity?.sourceTreeSha256 ?? '') ||
		!meaningfulString(browserEvidence.identity?.startedAt) ||
		!meaningfulString(browserEvidence.identity?.completedAt) ||
		Number.isNaN(Date.parse(browserEvidence.identity.startedAt)) ||
		Number.isNaN(Date.parse(browserEvidence.identity.completedAt)) ||
		Date.parse(browserEvidence.identity.completedAt) <
			Date.parse(browserEvidence.identity.startedAt)
	) {
		fail('Browser evidence has an invalid schema, clean-worktree identity or execution window');
	}
	validateFileManifest(browserEvidence.manifests?.build, 'build');
	validateFileManifest(browserEvidence.manifests?.sources, 'source');
	if (
		browserEvidence.manifests.build.treeSha256 !== browserEvidence.identity.buildTreeSha256 ||
		browserEvidence.manifests.sources.treeSha256 !== browserEvidence.identity.sourceTreeSha256 ||
		!Array.isArray(browserEvidence.productionBuildScan?.loaderHits) ||
		browserEvidence.productionBuildScan.loaderHits.length > 0 ||
		!Array.isArray(browserEvidence.productionBuildScan?.generatedFixtureHits) ||
		browserEvidence.productionBuildScan.generatedFixtureHits.length > 0 ||
		browserEvidence.productionBuildScan?.touchActionManipulationPresent !== true ||
		!/width=device-width/iu.test(
			browserEvidence.productionBuildScan?.viewportMeta?.content ?? '',
		) ||
		!/initial-scale=1/iu.test(browserEvidence.productionBuildScan?.viewportMeta?.content ?? '') ||
		/maximum-scale|user-scalable\s*=\s*(?:no|0)/iu.test(
			browserEvidence.productionBuildScan?.viewportMeta?.content ?? '',
		) ||
		!meaningfulString(browserEvidence.playwright?.version) ||
		!meaningfulString(browserEvidence.playwright?.browser)
	) {
		fail('Browser evidence does not contain a valid exact-build execution manifest');
	}
	return {
		performance: validatePerformanceEvidence(browserEvidence.performance, manifest),
		accessibility: validateAccessibilityEvidence(browserEvidence.accessibility),
	};
}

function validateBrowser(browserEvidence, manifest, { requireExtended = false } = {}) {
	const hasExtendedContract =
		Object.hasOwn(browserEvidence, 'schema') ||
		Object.hasOwn(browserEvidence, 'performance') ||
		Object.hasOwn(browserEvidence, 'accessibility') ||
		Object.hasOwn(browserEvidence, 'manifests') ||
		Object.hasOwn(browserEvidence, 'productionBuildScan');
	const extended =
		requireExtended || hasExtendedContract
			? validateExtendedBrowserEvidence(browserEvidence, manifest)
			: { performance: null, accessibility: null };
	if (!Array.isArray(browserEvidence.scenarios) || !Array.isArray(browserEvidence.checks)) {
		fail('Browser evidence scenarios and checks must be arrays');
	}
	for (const scenario of browserEvidence.scenarios) {
		if (
			!scenario ||
			typeof scenario !== 'object' ||
			Array.isArray(scenario) ||
			!meaningfulString(scenario.name) ||
			!allowedBrowserStatuses.has(scenario.status)
		) {
			fail('Browser scenario identity/status is invalid');
		}
	}
	for (const check of browserEvidence.checks) {
		if (
			!check ||
			typeof check !== 'object' ||
			Array.isArray(check) ||
			!meaningfulString(check.group) ||
			!meaningfulString(check.name) ||
			!Number.isSafeInteger(check.occurrence) ||
			check.occurrence < 1 ||
			!allowedBrowserStatuses.has(check.status)
		) {
			fail('Browser check group/name identity or status is invalid');
		}
	}
	requireUnique(
		browserEvidence.scenarios.map((scenario) => scenario.name),
		'Browser scenario identities',
	);
	requireUnique(browserEvidence.checks.map(browserCheckIdentity), 'Browser check identities');
	const occurrenceCounts = new Map();
	for (const check of browserEvidence.checks) {
		const referenceIdentity = checkReferenceIdentity(check);
		const expectedOccurrence = (occurrenceCounts.get(referenceIdentity) ?? 0) + 1;
		if (check.occurrence !== expectedOccurrence) {
			fail(
				`Browser check occurrences must be contiguous for ${referenceIdentity}; expected ${expectedOccurrence}`,
			);
		}
		occurrenceCounts.set(referenceIdentity, expectedOccurrence);
	}

	const summary = {
		pass: browserEvidence.checks.filter((check) => check.status === 'PASS').length,
		fail: browserEvidence.checks.filter((check) => check.status === 'FAIL').length,
		scenarios: browserEvidence.scenarios.length,
		passedScenarios: browserEvidence.scenarios.filter((scenario) => scenario.status === 'PASS')
			.length,
		failedScenarios: browserEvidence.scenarios.filter((scenario) => scenario.status === 'FAIL')
			.length,
	};
	for (const [field, expected] of Object.entries(summary)) {
		if (browserEvidence.summary?.[field] !== expected) {
			fail(`Browser evidence summary ${field} does not match recomputed value ${expected}`);
		}
	}
	if (
		summary.fail !== 0 ||
		summary.failedScenarios !== 0 ||
		summary.scenarios !== summary.passedScenarios
	) {
		fail('Browser evidence is not completely green');
	}
	if (
		browserEvidence.identity?.testedGitSha !== manifest.git.sha ||
		browserEvidence.identity?.buildTreeSha256 !== manifest.packages.frontend.treeSha256 ||
		browserEvidence.identity?.expectedBuildTreeSha256 !== manifest.packages.frontend.treeSha256
	) {
		fail('Browser evidence is not bound to the exact packaged frontend and git identity');
	}
	const scenarios = new Map(browserEvidence.scenarios.map((scenario) => [scenario.name, scenario]));
	const checks = new Map();
	for (const check of browserEvidence.checks) {
		const identity = checkReferenceIdentity(check);
		const matches = checks.get(identity) ?? [];
		matches.push(check);
		checks.set(identity, matches);
	}
	return { scenarios, checks, summary, ...extended };
}

function validateSecurityEvidence(securityEvidence, manifest) {
	if (
		securityEvidence.schema !== BLACKSITE_SECURITY_EVIDENCE_SCHEMA ||
		securityEvidence.status !== 'PASS' ||
		securityEvidence.identity?.testedGitSha !== manifest.git.sha ||
		securityEvidence.identity?.expectedGitSha !== manifest.git.sha ||
		!sameJson(securityEvidence.policy, BLACKSITE_SECURITY_POLICY) ||
		securityEvidence.inputs?.npmrc?.path !== '.npmrc' ||
		securityEvidence.inputs?.npmrc?.sha256 !== BLACKSITE_SECURITY_POLICY.audit.npmrcSha256 ||
		securityEvidence.inputs?.workspace?.path !== 'pnpm-workspace.yaml' ||
		securityEvidence.inputs?.workspace?.sha256 !==
			BLACKSITE_SECURITY_POLICY.audit.workspaceSha256 ||
		securityEvidence.inputs?.auditRegistry?.url !== BLACKSITE_SECURITY_POLICY.audit.registry ||
		!BLACKSITE_SECURITY_POLICY.audit.allowedOrigins.includes(
			securityEvidence.inputs?.auditRegistry?.origin,
		) ||
		securityEvidence.inputs?.lockfile?.path !== 'pnpm-lock.yaml' ||
		securityEvidence.inputs?.lockfile?.sha256 !==
			fileBinding(resolve(repoRoot, 'pnpm-lock.yaml')).sha256 ||
		!Array.isArray(securityEvidence.checks) ||
		!sameJson(
			securityEvidence.checks.map(({ id }) => id),
			expectedSecurityCheckIds,
		)
	) {
		fail('Security evidence is not a passing result for the exact candidate');
	}
	const ids = new Set();
	for (const check of securityEvidence.checks) {
		if (!meaningfulString(check?.id) || ids.has(check.id) || check.status !== 'PASS') {
			fail('Security evidence contains a duplicate, invalid or non-passing check');
		}
		ids.add(check.id);
	}
	const summary = {
		checks: securityEvidence.checks.length,
		pass: securityEvidence.checks.length,
		fail: 0,
		notRun: 0,
	};
	if (
		!sameJson(securityEvidence.summary, summary) ||
		!ids.has('production-registry-audit') ||
		!ids.has('audit-registry-and-npmrc-policy')
	) {
		fail('Security evidence summary is inconsistent or omits the registry audit');
	}
	return summary;
}

function validateRepositoryGates(repositoryEvidence, manifest) {
	if (repositoryEvidence.schema !== BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA) {
		fail('Unknown repository gate evidence schema');
	}
	if (
		repositoryEvidence.identity?.testedGitSha !== manifest.git.sha ||
		repositoryEvidence.identity?.expectedGitSha !== manifest.git.sha
	) {
		fail('Repository gate evidence is not bound to the exact candidate git identity');
	}
	const expectedInputLabels = [
		'workflow',
		'npmrc',
		'workspace-config',
		'package-manifest',
		'lockfile',
		'security-evidence',
		'candidate-manifest',
		'package-verification',
		'browser-evidence',
	];
	if (
		!Array.isArray(repositoryEvidence.inputs) ||
		!sameJson(
			repositoryEvidence.inputs.map(({ label }) => label).sort(),
			[...expectedInputLabels].sort(),
		) ||
		repositoryEvidence.inputs.some(
			(input) =>
				!meaningfulString(input?.path) ||
				!sha256.test(input.sha256 ?? '') ||
				!Number.isSafeInteger(input.bytes) ||
				input.bytes <= 0,
		) ||
		!Array.isArray(repositoryEvidence.gates) ||
		!sameJson(
			repositoryEvidence.gates.map(({ name }) => name),
			BLACKSITE_REPOSITORY_GATES,
		)
	) {
		fail('Repository gate evidence omits a required gate or bound raw input');
	}
	const gates = new Map();
	for (const gate of repositoryEvidence.gates) {
		if (!meaningfulString(gate?.name) || gates.has(gate.name) || gate.status !== 'PASS') {
			fail('Repository gate evidence contains a duplicate, invalid or non-passing gate');
		}
		gates.set(gate.name, gate.status);
	}
	const summary = {
		gates: repositoryEvidence.gates.length,
		pass: repositoryEvidence.gates.length,
		fail: 0,
	};
	if (!sameJson(repositoryEvidence.summary, summary)) {
		fail('Repository gate evidence summary is inconsistent with its gate results');
	}
	return {
		gates,
		summary,
		inputs: new Map(repositoryEvidence.inputs.map((input) => [input.label, input])),
	};
}

function validateRepositoryInputBindings(repositoryIndex, bindings) {
	for (const [label, binding] of Object.entries(bindings)) {
		const recorded = repositoryIndex.inputs.get(label);
		if (recorded?.sha256 !== binding.sha256 || recorded?.bytes !== binding.bytes) {
			fail(`Repository gate input ${label} is not bound to the exact consumed file`);
		}
	}
}

function resolveRepositoryGate(item, gate, packageEvidence) {
	const identity = repositoryGateIdentity(gate);
	let resolved = false;
	let sourceSha256;
	if (identity === 'candidateManifest:allMathVerificationGates') {
		const { gatesPassed, gatesTotal } = packageEvidence.manifest.mathEvidence ?? {};
		resolved =
			Number.isSafeInteger(gatesPassed) &&
			gatesPassed > 0 &&
			Number.isSafeInteger(gatesTotal) &&
			gatesPassed === gatesTotal;
		sourceSha256 = packageEvidence.manifestDocument.file.sha256;
	} else if (identity === 'packageVerification:bookLookupIdAndPayoutMatch') {
		resolved = packageEvidence.verification.claims?.bookLookupIdAndPayoutMatch === 'PASS';
		sourceSha256 = packageEvidence.verificationDocument.file.sha256;
	} else {
		fail(`Requirement ${item.id} names an unsupported repository receipt`);
	}
	if (!resolved) {
		fail(`Requirement ${item.id} has unresolved repository evidence: ${identity}`);
	}
	return { ...gate, status: 'PASS', sourceSha256 };
}

function resolveItems(items, browserIndex, packageEvidence) {
	return items.map((item) => {
		const missingScenarios = (item.browserScenarios ?? []).filter(
			(name) => browserIndex.scenarios.get(name)?.status !== 'PASS',
		);
		const missingChecks = (item.browserChecks ?? []).filter((check) => {
			const matches = browserIndex.checks.get(checkReferenceIdentity(check)) ?? [];
			return matches.length === 0 || matches.some((match) => match.status !== 'PASS');
		});
		if (missingScenarios.length > 0 || missingChecks.length > 0) {
			fail(
				`Requirement ${item.id} has unresolved browser evidence: ${[
					...missingScenarios,
					...missingChecks.map(checkReferenceIdentity),
				].join(', ')}`,
			);
		}
		const resolvedRepositoryGates = (item.repositoryGates ?? []).map((gate) =>
			resolveRepositoryGate(item, gate, packageEvidence),
		);
		const automatedAbsenceEvidence = (item.automatedAbsenceChecks ?? []).map((proofId) =>
			automatedAbsenceProofs.get(proofId)(),
		);
		const browserScenarios = (item.browserScenarios ?? []).map((name) => ({
			name,
			status: browserIndex.scenarios.get(name).status,
		}));
		const browserChecks = (item.browserChecks ?? []).map((check) => {
			const matches = browserIndex.checks.get(checkReferenceIdentity(check));
			return {
				...check,
				status: 'PASS',
				matches: matches.map(({ occurrence, status }) => ({ occurrence, status })),
			};
		});
		const referenceCount =
			browserScenarios.length + browserChecks.length + resolvedRepositoryGates.length;
		return {
			...item,
			...(automatedAbsenceEvidence.length > 0 ? { automatedAbsenceEvidence } : {}),
			...(referenceCount > 0
				? {
						repositoryEvidence: {
							claim: item.status.startsWith('AUTOMATED_PASS')
								? 'AUTOMATED_PROOF_COMPLETE'
								: 'PARTIAL_REPOSITORY_PROOF',
							referencesResolved: 'PASS',
							browserScenarios,
							browserChecks,
							candidatePackageReceipts: resolvedRepositoryGates,
						},
					}
				: {}),
		};
	});
}

function summarize(items) {
	const byStatus = Object.fromEntries([...allowedStatuses].map((status) => [status, 0]));
	for (const item of items) byStatus[item.status] += 1;
	return {
		total: items.length,
		byStatus,
		automatedProofComplete: items.filter((item) => item.status.startsWith('AUTOMATED_PASS')).length,
		repositoryEvidenceResolved: items.filter(
			(item) => item.repositoryEvidence?.referencesResolved === 'PASS',
		).length,
		externalOpenWithRepositoryEvidence: items
			.filter(
				(item) =>
					item.status === 'EXTERNAL_OPEN' && item.repositoryEvidence?.referencesResolved === 'PASS',
			)
			.map((item) => item.id),
		manualGateOpen: items
			.filter(
				(item) => item.status === 'AUTOMATED_PASS_MANUAL_OPEN' || item.status === 'MANUAL_OPEN',
			)
			.map((item) => item.id),
		externalGateOpen: items
			.filter((item) => item.status === 'EXTERNAL_OPEN')
			.map((item) => item.id),
		notApplicable: items.filter((item) => item.status === 'NOT_APPLICABLE').map((item) => item.id),
	};
}

export function buildComplianceEvidence({
	candidateRoot,
	browserEvidencePath,
	evidenceMapPath = defaultEvidenceMapPath,
	repositoryEvidencePath = process.env.BLACKSITE_REPOSITORY_EVIDENCE
		? resolve(repoRoot, process.env.BLACKSITE_REPOSITORY_EVIDENCE)
		: existsSync(defaultRepositoryEvidencePath)
			? defaultRepositoryEvidencePath
			: null,
	securityEvidencePath = process.env.BLACKSITE_SECURITY_EVIDENCE
		? resolve(repoRoot, process.env.BLACKSITE_SECURITY_EVIDENCE)
		: existsSync(defaultSecurityEvidencePath)
			? defaultSecurityEvidencePath
			: null,
}) {
	if (Boolean(repositoryEvidencePath) !== Boolean(securityEvidencePath)) {
		fail('Repository and security evidence must be supplied together');
	}
	const mapDocument = readJsonDocument(evidenceMapPath, '51-point evidence map');
	const requirementsDocument = readPhysicalDocument(
		canonicalRequirementsPath,
		'canonical Stake requirements checklist',
	);
	const map = mapDocument.value;
	const items = validateEvidenceMap(map, requirementsDocument.file);
	const packageEvidence = validatePackage(candidateRoot);
	const { manifest, verification, manifestDocument, verificationDocument } = packageEvidence;
	const browserDocument = readJsonDocument(browserEvidencePath, 'browser evidence');
	const browserEvidence = browserDocument.value;
	const browserIndex = validateBrowser(browserEvidence, manifest, {
		requireExtended: Boolean(repositoryEvidencePath),
	});
	let repositoryDocument = null;
	let securityDocument = null;
	let repositoryIndex = null;
	let securitySummary = null;
	if (repositoryEvidencePath && securityEvidencePath) {
		repositoryDocument = readJsonDocument(repositoryEvidencePath, 'repository gate evidence');
		securityDocument = readJsonDocument(securityEvidencePath, 'security evidence');
		repositoryIndex = validateRepositoryGates(repositoryDocument.value, manifest);
		securitySummary = validateSecurityEvidence(securityDocument.value, manifest);
		validateRepositoryInputBindings(repositoryIndex, {
			workflow: fileBinding(resolve(repoRoot, '.github/workflows/blacksite-ci.yml')),
			npmrc: fileBinding(resolve(repoRoot, '.npmrc')),
			'package-manifest': fileBinding(resolve(repoRoot, 'package.json')),
			lockfile: fileBinding(resolve(repoRoot, 'pnpm-lock.yaml')),
			'security-evidence': { path: securityEvidencePath, ...securityDocument.file },
			'candidate-manifest': {
				path: resolve(candidateRoot, 'candidate-manifest.json'),
				...manifestDocument.file,
			},
			'package-verification': {
				path: resolve(candidateRoot, 'package-verification.json'),
				...verificationDocument.file,
			},
			'browser-evidence': { path: browserEvidencePath, ...browserDocument.file },
		});
	}
	const resolvedItems = resolveItems(items, browserIndex, packageEvidence);
	return {
		schema: 'blacksite-stake-51-candidate-evidence-v3',
		generatedAt: new Date().toISOString(),
		inputs: {
			requirementsChecklist: {
				path: canonicalRequirementsSource,
				...requirementsDocument.file,
			},
			sourceMap: {
				...mapDocument.file,
				schema: map.schema,
				source: map.source,
				sourceSha256: map.sourceSha256,
				itemCount: items.length,
			},
			candidateManifest: {
				...manifestDocument.file,
				schema: manifest.schema,
				gitSha: manifest.git.sha,
				frontendTreeSha256: manifest.packages.frontend.treeSha256,
				mathTreeSha256: manifest.packages.math.treeSha256,
				mathFingerprintSha256: manifest.mathEvidence.candidateFingerprintSha256,
			},
			packageVerification: {
				...verificationDocument.file,
				schema: verification.schema,
				result: verification.result,
				gitSha: verification.gitSha,
				frontendTreeSha256: verification.frontend.treeSha256,
				mathTreeSha256: verification.math.treeSha256,
			},
			browserEvidence: {
				...browserDocument.file,
				identity: {
					testedGitSha: browserEvidence.identity.testedGitSha,
					buildTreeSha256: browserEvidence.identity.buildTreeSha256,
					expectedBuildTreeSha256: browserEvidence.identity.expectedBuildTreeSha256,
					sourceTreeSha256: browserEvidence.identity.sourceTreeSha256 ?? null,
				},
				summary: browserIndex.summary,
			},
			...(repositoryDocument
				? {
						repositoryGateEvidence: {
							...repositoryDocument.file,
							schema: repositoryDocument.value.schema,
							identity: repositoryDocument.value.identity,
							summary: repositoryIndex.summary,
						},
						securityEvidence: {
							...securityDocument.file,
							schema: securityDocument.value.schema,
							identity: securityDocument.value.identity,
							summary: securitySummary,
						},
					}
				: {}),
		},
		candidate: {
			gitSha: manifest.git.sha,
			frontendTreeSha256: manifest.packages.frontend.treeSha256,
			mathTreeSha256: manifest.packages.math.treeSha256,
			mathFingerprintSha256: manifest.mathEvidence.candidateFingerprintSha256,
			packageVerification: verification.result,
			browserSummary: browserIndex.summary,
			performanceSummary: browserIndex.performance,
			accessibilitySummary: browserIndex.accessibility,
			repositoryGateSummary: repositoryIndex?.summary ?? null,
			securitySummary,
		},
		statusDefinitions: map.statusDefinitions,
		repositoryEvidenceDefinitions: {
			AUTOMATED_PROOF_COMPLETE:
				'Every repository-owned reference required by an automated status resolved against the exact candidate inputs.',
			PARTIAL_REPOSITORY_PROOF:
				'Repository evidence resolved, but the row status remains controlled by its named manual or external gate.',
		},
		summary: summarize(resolvedItems),
		items: resolvedItems,
		claims: {
			matrixCompleteness: 'PASS',
			automatedReferencesResolved: 'PASS',
			repositoryReferencesResolved: 'PASS',
			inputByteIdentityRecorded: 'PASS',
			notApplicableAbsenceEvidence: 'PASS',
			performanceLabBudgets: browserIndex.performance ? 'PASS' : 'NOT_CLAIMED',
			performanceFieldData: 'NOT_CLAIMED',
			automatedAccessibility: browserIndex.accessibility ? 'PASS' : 'NOT_CLAIMED',
			dependencySecurity: securitySummary ? 'PASS' : 'NOT_CLAIMED',
			repositoryGateLedger: repositoryIndex ? 'PASS' : 'NOT_CLAIMED',
			manualEvidence: 'NOT_CLAIMED',
			externalApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	};
}

function main() {
	const candidateRoot = argument('--candidate');
	const browserEvidencePath = argument('--browser-evidence');
	const repositoryEvidencePath = optionalArgument('--repository-evidence');
	const securityEvidencePath = optionalArgument('--security-evidence');
	const outputPath = validateOutputPath({
		outputPath: argument('--output'),
		candidateRoot,
		browserEvidencePath,
		evidenceMapPath: defaultEvidenceMapPath,
		repositoryEvidencePath,
		securityEvidencePath,
	});
	const evidence = buildComplianceEvidence({
		candidateRoot,
		browserEvidencePath,
		repositoryEvidencePath,
		securityEvidencePath,
	});
	writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
	process.stdout.write(
		`${JSON.stringify(
			{
				status: 'STRUCTURALLY_VALID',
				scope: 'EXACT_REPOSITORY_REFERENCE_RESOLUTION',
				output: outputPath,
				candidate: evidence.candidate,
				summary: evidence.summary,
				claims: evidence.claims,
				manualAndExternalEvidence: 'NOT_CLAIMED',
			},
			null,
			2,
		)}\n`,
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(error.stack || error);
		process.exitCode = 1;
	}
}
