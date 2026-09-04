#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	copyFileSync,
	constants as fsConstants,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildComplianceEvidence } from './blacksite-compliance-evidence.mjs';

export const RELEASE_BUNDLE_SCHEMA = 'blacksite-release-evidence-bundle-v1';
export const RELEASE_BUNDLE_GENERATOR_VERSION = '1.0.0';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const repoRoot = resolve(scriptDirectory, '..');
const defaultEvidenceMapPath = join(repoRoot, 'docs', 'blacksite', 'RELEASE_EVIDENCE_51.json');
const defaultRequirementsChecklistPath = join(
	repoRoot,
	'docs',
	'blacksite',
	'STAKE_REQUIREMENTS_51.md',
);
const packageVerifierPath = join(repoRoot, 'scripts', 'blacksite-package-verify.mjs');
const criticalRepositoryPaths = Object.freeze([
	'docs/blacksite/RELEASE_EVIDENCE_51.json',
	'docs/blacksite/STAKE_REQUIREMENTS_51.md',
	'scripts/blacksite-compliance-evidence.mjs',
	'scripts/blacksite-package-verify.mjs',
	'scripts/blacksite-release-bundle.mjs',
]);
const candidateManifestName = 'candidate-manifest.json';
const packageVerificationName = 'package-verification.json';
const browserEvidenceName = 'blacksite-browser-evidence.json';
const complianceEvidenceName = 'blacksite-51-evidence.json';
const evidenceMapName = 'release-evidence-map.json';
const requirementsChecklistName = 'stake-requirements-51.md';
const bundleManifestName = 'release-bundle-manifest.json';
const treeAlgorithm =
	'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)';
const fullGitShaPattern = /^[0-9a-f]{40}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const positiveDecimalPattern = /^[1-9][0-9]*$/u;
const allowedComplianceStatuses = Object.freeze([
	'AUTOMATED_PASS',
	'AUTOMATED_PASS_MANUAL_OPEN',
	'MANUAL_OPEN',
	'EXTERNAL_OPEN',
	'NOT_APPLICABLE',
]);

function fail(message) {
	throw new Error(message);
}

function requireValue(condition, message) {
	if (!condition) fail(message);
}

function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function sha256Bytes(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

function fileFact(path) {
	const bytes = readFileSync(path);
	return { bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

function pathIsWithin(parent, child) {
	const path = relative(parent, child);
	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function assertNonOverlapping(left, right, context) {
	requireValue(
		!pathIsWithin(left, right) && !pathIsWithin(right, left),
		`${context} must not contain or be contained by another input/output path`,
	);
}

function assertPhysicalDirectory(path, context) {
	const absolutePath = resolve(path);
	requireValue(existsSync(absolutePath), `${context} is missing: ${absolutePath}`);
	const stats = lstatSync(absolutePath);
	requireValue(
		!stats.isSymbolicLink() && stats.isDirectory(),
		`${context} must be a physical directory: ${absolutePath}`,
	);
	requireValue(
		realpathSync(absolutePath) === absolutePath,
		`${context} must not resolve through a symbolic-link ancestor: ${absolutePath}`,
	);
	return absolutePath;
}

function assertPhysicalFile(path, context) {
	const absolutePath = resolve(path);
	requireValue(existsSync(absolutePath), `${context} is missing: ${absolutePath}`);
	const stats = lstatSync(absolutePath);
	requireValue(
		!stats.isSymbolicLink() && stats.isFile(),
		`${context} must be a physical regular file: ${absolutePath}`,
	);
	requireValue(
		realpathSync(absolutePath) === absolutePath,
		`${context} must not resolve through a symbolic-link ancestor: ${absolutePath}`,
	);
	return absolutePath;
}

function safeRelativePath(root, absolutePath, context) {
	const path = relative(root, absolutePath).replaceAll('\\', '/');
	requireValue(
		path.length > 0 &&
			!path.startsWith('/') &&
			!path.split('/').some((part) => part === '' || part === '.' || part === '..') &&
			!/[\\\u0000-\u001f\u007f]/u.test(path),
		`${context} has an unsafe relative path: ${JSON.stringify(path)}`,
	);
	return path;
}

function collectFiles(root, target = root, output = []) {
	const stats = lstatSync(target);
	if (stats.isSymbolicLink()) fail(`Symbolic links are forbidden in evidence inputs: ${target}`);
	if (stats.isFile()) {
		output.push(target);
		return output;
	}
	if (!stats.isDirectory()) fail(`Unsupported evidence input entry: ${target}`);
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((left, right) =>
		left.name.localeCompare(right.name, 'en'),
	)) {
		collectFiles(root, join(target, entry.name), output);
	}
	return output;
}

export function createReleaseTreeManifest(root, { archiveSource = false } = {}) {
	const physicalRoot = assertPhysicalDirectory(root, 'Tree root');
	const files = collectFiles(physicalRoot).sort((left, right) =>
		safeRelativePath(physicalRoot, left, 'Tree entry').localeCompare(
			safeRelativePath(physicalRoot, right, 'Tree entry'),
			'en',
		),
	);
	requireValue(files.length > 0, `Tree root must contain at least one file: ${physicalRoot}`);
	const treeHash = createHash('sha256');
	const records = files.map((absolutePath) => {
		const path = safeRelativePath(physicalRoot, absolutePath, 'Tree entry');
		const stats = lstatSync(absolutePath);
		if (archiveSource && (stats.mode & 0o111) !== 0) {
			fail(`Archive source files must not be executable: ${path}`);
		}
		const bytes = readFileSync(absolutePath);
		const pathBytes = Buffer.byteLength(path, 'utf8');
		treeHash.update(Buffer.from(`${pathBytes}\0${path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		return { path, bytes: bytes.length, sha256: sha256Bytes(bytes) };
	});
	return {
		algorithm: treeAlgorithm,
		treeSha256: treeHash.digest('hex'),
		fileCount: records.length,
		totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
		files: records,
	};
}

function readJsonDocument(path, context) {
	const physicalPath = assertPhysicalFile(path, context);
	const bytes = readFileSync(physicalPath);
	try {
		return {
			path: physicalPath,
			value: JSON.parse(bytes.toString('utf8')),
			file: { bytes: bytes.length, sha256: sha256Bytes(bytes) },
		};
	} catch (error) {
		fail(`${context} is not valid JSON: ${error.message}`);
	}
}

function assertRecordedFact(recorded, actual, context) {
	requireValue(
		recorded?.bytes === actual.bytes && recorded?.sha256 === actual.sha256,
		`${context} byte identity mismatch`,
	);
}

function validateExpectedBranch(branch) {
	requireValue(
		typeof branch === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u.test(branch),
		'expectedBranch must be a non-empty canonical Git branch name',
	);
	let normalized;
	try {
		normalized = execFileSync('git', ['check-ref-format', '--branch', branch], {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim();
	} catch {
		fail('expectedBranch must be a non-empty canonical Git branch name');
	}
	requireValue(normalized === branch, 'expectedBranch was normalized by Git');
	return branch;
}

function gitText(arguments_) {
	return execFileSync('git', arguments_, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

export function validateReleaseRepositoryIdentity(identity, expectedGitSha) {
	requireValue(
		identity && typeof identity === 'object' && !Array.isArray(identity),
		'Repository identity is required',
	);
	requireValue(
		identity.source === 'git-head-and-tracked-worktree-v1',
		'Repository identity must be captured from the current Git checkout',
	);
	requireValue(
		identity.gitSha === expectedGitSha && fullGitShaPattern.test(identity.gitSha ?? ''),
		'Repository identity does not match the expected full Git SHA',
	);
	requireValue(
		fullGitShaPattern.test(identity.gitTreeSha ?? ''),
		'Repository identity must record the HEAD tree SHA',
	);
	requireValue(
		identity.trackedWorktreeClean === true && identity.indexClean === true,
		'Repository tracked worktree and index must be clean',
	);
	requireValue(
		Array.isArray(identity.criticalFiles) &&
			sameJson(
				identity.criticalFiles.map((file) => file.path),
				criticalRepositoryPaths,
			),
		'Repository identity must contain the exact critical release files in order',
	);
	for (const file of identity.criticalFiles) {
		requireValue(
			fullGitShaPattern.test(file.head?.gitBlobOid ?? '') &&
				Number.isSafeInteger(file.head?.bytes) &&
				file.head.bytes >= 0 &&
				sha256Pattern.test(file.head?.sha256 ?? '') &&
				Number.isSafeInteger(file.current?.bytes) &&
				file.current.bytes >= 0 &&
				sha256Pattern.test(file.current?.sha256 ?? '') &&
				file.current.bytes === file.head.bytes &&
				file.current.sha256 === file.head.sha256 &&
				file.matchesHead === true,
			`Repository current-vs-HEAD blob identity mismatch: ${file.path}`,
		);
	}
	return identity;
}

function captureReleaseRepositoryIdentity(expectedGitSha) {
	const gitSha = gitText(['rev-parse', 'HEAD']);
	requireValue(
		gitSha === expectedGitSha,
		`Repository HEAD ${gitSha} does not match expected candidate SHA ${expectedGitSha}`,
	);
	const gitTreeSha = gitText(['rev-parse', 'HEAD^{tree}']);
	const trackedChanges = gitText(['diff', '--name-only', '--no-ext-diff', '--']);
	const indexChanges = gitText(['diff', '--cached', '--name-only', '--no-ext-diff', '--']);
	requireValue(
		trackedChanges === '' && indexChanges === '',
		`Repository tracked worktree and index must be clean before bundling${
			trackedChanges || indexChanges
				? `: ${[trackedChanges, indexChanges].filter(Boolean).join(', ')}`
				: ''
		}`,
	);
	const criticalFiles = criticalRepositoryPaths.map((path) => {
		const absolutePath = assertPhysicalFile(
			join(repoRoot, ...path.split('/')),
			`Critical file ${path}`,
		);
		const current = fileFact(absolutePath);
		const headBytes = execFileSync('git', ['show', `${gitSha}:${path}`], {
			cwd: repoRoot,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const head = {
			gitBlobOid: gitText(['rev-parse', `${gitSha}:${path}`]),
			bytes: headBytes.length,
			sha256: sha256Bytes(headBytes),
		};
		return {
			path,
			head,
			current,
			matchesHead: sameJson(current, { bytes: head.bytes, sha256: head.sha256 }),
		};
	});
	return validateReleaseRepositoryIdentity(
		{
			source: 'git-head-and-tracked-worktree-v1',
			gitSha,
			gitTreeSha,
			trackedWorktreeClean: true,
			indexClean: true,
			untrackedArtifactsAllowed: true,
			criticalFiles,
		},
		expectedGitSha,
	);
}

function assertReleaseRepositoryIdentityUnchanged(identity, expectedGitSha) {
	requireValue(
		sameJson(captureReleaseRepositoryIdentity(expectedGitSha), identity),
		'Repository identity changed during release bundle generation',
	);
}

function validateCandidate(candidateRoot, expectedBranch, expectedGitSha) {
	const root = assertPhysicalDirectory(candidateRoot, 'Candidate root');
	const expectedTopLevel = [
		'README_UPLOAD_CANDIDATE.txt',
		candidateManifestName,
		'frontend',
		'math',
		packageVerificationName,
	].sort((left, right) => left.localeCompare(right, 'en'));
	const topLevel = readdirSync(root).sort((left, right) => left.localeCompare(right, 'en'));
	requireValue(
		sameJson(topLevel, expectedTopLevel),
		`Candidate root entries do not match the verified package contract: ${topLevel.join(', ')}`,
	);
	const frontendRoot = assertPhysicalDirectory(join(root, 'frontend'), 'Candidate frontend root');
	const mathRoot = assertPhysicalDirectory(join(root, 'math'), 'Candidate math root');
	const manifestDocument = readJsonDocument(
		join(root, candidateManifestName),
		'Candidate manifest',
	);
	const verificationDocument = readJsonDocument(
		join(root, packageVerificationName),
		'Package verification',
	);
	assertPhysicalFile(join(root, 'README_UPLOAD_CANDIDATE.txt'), 'Candidate README');
	const manifest = manifestDocument.value;
	const verification = verificationDocument.value;
	requireValue(manifest.schema === 'blacksite-upload-candidate-v1', 'Unknown candidate schema');
	requireValue(
		manifest.lifecycle === 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY' &&
			manifest.approvalStatus === 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN' &&
			manifest.uploadAuthorized === false,
		'Candidate must retain its non-submission lifecycle and open manual/external gates',
	);
	const generatedAtMilliseconds = Date.parse(manifest.generatedAt ?? '');
	requireValue(
		Number.isFinite(generatedAtMilliseconds) &&
			new Date(generatedAtMilliseconds).toISOString() === manifest.generatedAt,
		'Candidate generatedAt must be an exact ISO timestamp',
	);
	requireValue(
		manifest.game?.id === 'blacksite_breach',
		'Candidate game identity must be blacksite_breach',
	);
	requireValue(
		manifest.git?.branch === expectedBranch &&
			manifest.git?.sha === expectedGitSha &&
			manifest.git?.expectedSha === expectedGitSha &&
			manifest.git?.cleanBefore === true &&
			manifest.git?.cleanAfter === true &&
			manifest.git?.dirty === false,
		'Candidate manifest does not match the expected clean branch/full SHA identity',
	);
	requireValue(
		verification.schema === 'blacksite-upload-candidate-verification-v1' &&
			verification.result === 'PASS' &&
			verification.lifecycle === manifest.lifecycle &&
			verification.gitBranch === expectedBranch &&
			verification.gitSha === expectedGitSha &&
			verification.candidateRoot === root,
		'Package verification does not match the candidate path/branch/full SHA identity',
	);
	const verifiedAtMilliseconds = Date.parse(verification.verifiedAt ?? '');
	requireValue(
		Number.isFinite(verifiedAtMilliseconds) &&
			new Date(verifiedAtMilliseconds).toISOString() === verification.verifiedAt,
		'Package verification verifiedAt must be an exact ISO timestamp',
	);
	requireValue(
		verification.claims?.uploadPayloadStructureAndIdentity === 'PASS' &&
			verification.claims?.bookLookupIdAndPayoutMatch === 'PASS' &&
			verification.claims?.stakeApproval === 'NOT_CLAIMED' &&
			verification.claims?.releaseReadiness === 'NOT_CLAIMED',
		'Package verification claims do not preserve the candidate release boundary',
	);
	const frontendTree = createReleaseTreeManifest(frontendRoot, { archiveSource: true });
	const mathTree = createReleaseTreeManifest(mathRoot, { archiveSource: true });
	requireValue(
		sameJson(manifest.packages?.frontend, frontendTree) &&
			sameJson(verification.frontend, frontendTree),
		'Candidate frontend tree does not match both package receipts',
	);
	requireValue(
		sameJson(manifest.packages?.math, mathTree) && sameJson(verification.math, mathTree),
		'Candidate math tree does not match both package receipts',
	);
	requireValue(
		sameJson(verification.frontendHygiene, manifest.frontendEvidence?.hygiene),
		'Package verification frontend hygiene differs from the candidate receipt',
	);
	requireValue(
		sameJson(verification.modeResults, [
			{ mode: 'base', cost: 1, books: 100_000, lookupRows: 100_000 },
			{ mode: 'deep_access', cost: 4, books: 100_000, lookupRows: 100_000 },
			{ mode: 'blackout', cost: 80, books: 100_000, lookupRows: 100_000 },
		]),
		'Package verification does not contain the exact canonical book/lookup results',
	);
	requireValue(
		sha256Pattern.test(manifest.mathEvidence?.candidateFingerprintSha256 ?? '') &&
			Number.isSafeInteger(manifest.mathEvidence?.gatesPassed) &&
			manifest.mathEvidence.gatesPassed > 0 &&
			manifest.mathEvidence.gatesPassed === manifest.mathEvidence?.gatesTotal,
		'Candidate math receipt does not prove all repository verification gates',
	);
	return {
		root,
		frontendRoot,
		mathRoot,
		manifest,
		verification,
		manifestDocument,
		verificationDocument,
		frontendTree,
		mathTree,
		candidateTree: createReleaseTreeManifest(root),
	};
}

function verifyCandidateWithCanonicalVerifier(candidate, expectedBranch, expectedGitSha) {
	let output;
	try {
		output = execFileSync(
			process.execPath,
			[
				packageVerifierPath,
				'--candidate',
				candidate.root,
				'--expected-branch',
				expectedBranch,
				'--allow-untracked-artifacts',
			],
			{
				cwd: repoRoot,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			},
		);
	} catch (error) {
		const stderr = error?.stderr?.toString('utf8').trim();
		fail(`Canonical package verifier failed${stderr ? `: ${stderr}` : ''}`);
	}
	let result;
	try {
		result = JSON.parse(output);
	} catch (error) {
		fail(`Canonical package verifier returned invalid JSON: ${error.message}`);
	}
	requireValue(
		result.result === 'PASS' &&
			result.gitBranch === expectedBranch &&
			result.gitSha === expectedGitSha &&
			result.frontendTreeSha256 === candidate.frontendTree.treeSha256 &&
			result.mathTreeSha256 === candidate.mathTree.treeSha256 &&
			sameJson(result.frontendHygiene, candidate.verification.frontendHygiene) &&
			sameJson(result.modeResults, candidate.verification.modeResults),
		'Canonical package verifier result differs from the persisted package receipt',
	);
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

function collectScreenshotReferences(value, path = [], output = []) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => collectScreenshotReferences(entry, [...path, index], output));
		return output;
	}
	if (!value || typeof value !== 'object') return output;
	for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'))) {
		const entry = value[key];
		if (/screenshots$/iu.test(key)) {
			requireValue(
				Array.isArray(entry) &&
					entry.length > 0 &&
					entry.every((path) => typeof path === 'string' && path.length > 0),
				`Browser screenshot collection ${[...path, key].join('.')} must be a non-empty string array`,
			);
			entry.forEach((recordedPath, index) => {
				output.push({ jsonPath: [...path, key, index], recordedPath });
			});
			continue;
		}
		if (/screenshot$/iu.test(key)) {
			if (entry === null || entry === undefined) continue;
			requireValue(
				typeof entry === 'string' && entry.length > 0,
				`Browser screenshot reference ${[...path, key].join('.')} must be a path string`,
			);
			output.push({ jsonPath: [...path, key], recordedPath: entry });
		}
		collectScreenshotReferences(entry, [...path, key], output);
	}
	return output;
}

function jsonPointer(path) {
	return `/${path.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function validateBrowserRun(browserRunRoot, candidate, expectedGitSha) {
	const root = assertPhysicalDirectory(browserRunRoot, 'Browser run root');
	const runName = basename(root);
	requireValue(
		runName.length > 0 && !/[\\/\u0000-\u001f\u007f]/u.test(runName),
		'Browser run directory name is unsafe',
	);
	const evidenceDocument = readJsonDocument(join(root, browserEvidenceName), 'Browser evidence');
	const runTree = createReleaseTreeManifest(root);
	const evidenceRecord = runTree.files.find((file) => file.path === browserEvidenceName);
	assertRecordedFact(evidenceRecord, evidenceDocument.file, 'Browser run evidence');
	const browserEvidence = evidenceDocument.value;
	requireValue(
		Array.isArray(browserEvidence.scenarios) && Array.isArray(browserEvidence.checks),
		'Browser evidence must contain scenario and check arrays',
	);
	const summary = browserSummary(browserEvidence);
	requireValue(
		sameJson(browserEvidence.summary, summary),
		'Browser evidence summary is not recomputed truth',
	);
	requireValue(
		summary.fail === 0 &&
			summary.failedScenarios === 0 &&
			summary.scenarios > 0 &&
			summary.scenarios === summary.passedScenarios,
		'Browser evidence is not completely green',
	);
	const scenarioNames = browserEvidence.scenarios.map((scenario) => {
		requireValue(
			scenario && typeof scenario.name === 'string' && scenario.name.length > 0,
			'Browser scenario identity is invalid',
		);
		requireValue(scenario.status === 'PASS', `Browser scenario is not PASS: ${scenario.name}`);
		return scenario.name;
	});
	requireValue(
		new Set(scenarioNames).size === scenarioNames.length,
		'Browser scenario identities must be unique',
	);
	const checkIdentities = [];
	const occurrences = new Map();
	for (const check of browserEvidence.checks) {
		requireValue(
			check &&
				typeof check.group === 'string' &&
				check.group.length > 0 &&
				typeof check.name === 'string' &&
				check.name.length > 0 &&
				Number.isSafeInteger(check.occurrence) &&
				check.occurrence > 0 &&
				check.status === 'PASS',
			'Browser check identity/status is invalid',
		);
		const referenceIdentity = JSON.stringify([check.group, check.name]);
		const expectedOccurrence = (occurrences.get(referenceIdentity) ?? 0) + 1;
		requireValue(
			check.occurrence === expectedOccurrence,
			`Browser check occurrence is not contiguous for ${referenceIdentity}`,
		);
		occurrences.set(referenceIdentity, expectedOccurrence);
		checkIdentities.push(JSON.stringify([check.group, check.name, check.occurrence]));
	}
	requireValue(
		new Set(checkIdentities).size === checkIdentities.length,
		'Browser check identities must be unique',
	);
	const identity = browserEvidence.identity;
	requireValue(
		identity?.testedGitSha === expectedGitSha &&
			identity?.worktreeDirty === false &&
			identity?.buildTreeSha256 === candidate.frontendTree.treeSha256 &&
			identity?.expectedBuildTreeSha256 === candidate.frontendTree.treeSha256 &&
			sha256Pattern.test(identity?.sourceTreeSha256 ?? '') &&
			typeof identity?.testedBuildRoot === 'string' &&
			resolve(identity.testedBuildRoot) === candidate.frontendRoot,
		'Browser evidence is not bound to the exact clean packaged frontend/full SHA',
	);
	const byPath = new Map(runTree.files.map((file) => [file.path, file]));
	const expectedPrefix = `artifacts/blacksite-qa/${runName}/`;
	const screenshotReferences = collectScreenshotReferences(browserEvidence)
		.map((reference) => {
			const { recordedPath } = reference;
			requireValue(
				!recordedPath.includes('\\') &&
					!recordedPath.startsWith('/') &&
					recordedPath.startsWith(expectedPrefix),
				`Browser screenshot path must remain under ${expectedPrefix}: ${recordedPath}`,
			);
			const runRelativePath = recordedPath.slice(expectedPrefix.length);
			requireValue(
				runRelativePath.startsWith('screenshots/') &&
					!runRelativePath
						.split('/')
						.some((part) => part === '' || part === '.' || part === '..') &&
					!/[\u0000-\u001f\u007f]/u.test(runRelativePath),
				`Browser screenshot path is unsafe: ${recordedPath}`,
			);
			const file = byPath.get(runRelativePath);
			requireValue(file, `Browser screenshot is absent from the run tree: ${recordedPath}`);
			return {
				jsonPointer: jsonPointer(reference.jsonPath),
				recordedPath,
				runRelativePath,
				bytes: file.bytes,
				sha256: file.sha256,
			};
		})
		.sort((left, right) => left.jsonPointer.localeCompare(right.jsonPointer, 'en'));
	requireValue(
		screenshotReferences.length > 0,
		'Browser evidence contains no screenshot references',
	);
	const screenshotFiles = runTree.files.filter((file) => file.path.startsWith('screenshots/'));
	requireValue(screenshotFiles.length > 0, 'Browser run contains no screenshot files');
	return {
		root,
		runName,
		evidence: browserEvidence,
		evidenceDocument,
		runTree,
		summary,
		screenshotReferences,
		screenshotFiles,
		bundleRoot: `artifacts/blacksite-qa/${runName}`,
	};
}

function recomputeComplianceSummary(items) {
	const byStatus = Object.fromEntries(allowedComplianceStatuses.map((status) => [status, 0]));
	for (const item of items) {
		requireValue(
			item && Number.isSafeInteger(item.id) && allowedComplianceStatuses.includes(item.status),
			'Compliance evidence contains an invalid requirement identity/status',
		);
		byStatus[item.status] += 1;
	}
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

function validateCompliance(
	complianceEvidencePath,
	evidenceMapPath,
	candidate,
	browser,
	expectedGitSha,
) {
	const document = readJsonDocument(complianceEvidencePath, 'Compliance evidence');
	const evidenceMapDocument = readJsonDocument(evidenceMapPath, '51-point source map');
	const requirementsChecklistPath = assertPhysicalFile(
		defaultRequirementsChecklistPath,
		'51-point requirements checklist',
	);
	const requirementsChecklistFile = fileFact(requirementsChecklistPath);
	const compliance = document.value;
	const sourceMap = evidenceMapDocument.value;
	requireValue(
		sourceMap.schema === 'blacksite-stake-51-evidence-map-v2' &&
			Array.isArray(sourceMap.items) &&
			sourceMap.items.length === 51 &&
			sourceMap.items.every((item, index) => item.id === index + 1),
		'51-point source map does not contain exact ordered rows 1 through 51',
	);
	requireValue(
		compliance.schema === 'blacksite-stake-51-candidate-evidence-v3',
		'Unknown compliance evidence schema',
	);
	requireValue(
		Array.isArray(compliance.items) &&
			compliance.items.length === 51 &&
			compliance.items.every((item, index) => item.id === index + 1),
		'Compliance evidence does not contain exact ordered rows 1 through 51',
	);
	for (let index = 0; index < sourceMap.items.length; index += 1) {
		requireValue(
			compliance.items[index].status === sourceMap.items[index].status,
			`Compliance row ${index + 1} status differs from the source map`,
		);
	}
	const summary = recomputeComplianceSummary(compliance.items);
	requireValue(sameJson(compliance.summary, summary), 'Compliance summary is not recomputed truth');
	requireValue(
		summary.manualGateOpen.length > 0 && summary.externalGateOpen.length > 0,
		'Compliance evidence must retain open manual and external gates',
	);
	for (const id of summary.externalOpenWithRepositoryEvidence) {
		requireValue(
			compliance.items[id - 1].status === 'EXTERNAL_OPEN',
			`Repository proof must not convert external row ${id} to PASS`,
		);
	}
	assertRecordedFact(
		compliance.inputs?.sourceMap,
		evidenceMapDocument.file,
		'Compliance source-map input',
	);
	assertRecordedFact(
		compliance.inputs?.requirementsChecklist,
		requirementsChecklistFile,
		'Compliance requirements-checklist input',
	);
	requireValue(
		compliance.inputs?.requirementsChecklist?.path === 'docs/blacksite/STAKE_REQUIREMENTS_51.md',
		'Compliance requirements-checklist path is not canonical',
	);
	assertRecordedFact(
		compliance.inputs?.candidateManifest,
		candidate.manifestDocument.file,
		'Compliance candidate-manifest input',
	);
	assertRecordedFact(
		compliance.inputs?.packageVerification,
		candidate.verificationDocument.file,
		'Compliance package-verification input',
	);
	assertRecordedFact(
		compliance.inputs?.browserEvidence,
		browser.evidenceDocument.file,
		'Compliance browser-evidence input',
	);
	requireValue(
		compliance.inputs?.sourceMap?.schema === sourceMap.schema &&
			compliance.inputs?.sourceMap?.itemCount === 51 &&
			compliance.inputs?.candidateManifest?.schema === candidate.manifest.schema &&
			compliance.inputs?.candidateManifest?.gitSha === expectedGitSha &&
			compliance.inputs?.candidateManifest?.frontendTreeSha256 ===
				candidate.frontendTree.treeSha256 &&
			compliance.inputs?.candidateManifest?.mathTreeSha256 === candidate.mathTree.treeSha256 &&
			compliance.inputs?.candidateManifest?.mathFingerprintSha256 ===
				candidate.manifest.mathEvidence.candidateFingerprintSha256 &&
			compliance.inputs?.packageVerification?.schema === candidate.verification.schema &&
			compliance.inputs?.packageVerification?.result === 'PASS' &&
			compliance.inputs?.packageVerification?.gitSha === expectedGitSha &&
			compliance.inputs?.packageVerification?.frontendTreeSha256 ===
				candidate.frontendTree.treeSha256 &&
			compliance.inputs?.packageVerification?.mathTreeSha256 === candidate.mathTree.treeSha256,
		'Compliance candidate/package input identity is inconsistent',
	);
	requireValue(
		sameJson(compliance.inputs?.browserEvidence?.identity, {
			testedGitSha: browser.evidence.identity.testedGitSha,
			buildTreeSha256: browser.evidence.identity.buildTreeSha256,
			expectedBuildTreeSha256: browser.evidence.identity.expectedBuildTreeSha256,
			sourceTreeSha256: browser.evidence.identity.sourceTreeSha256 ?? null,
		}) && sameJson(compliance.inputs?.browserEvidence?.summary, browser.summary),
		'Compliance browser input identity/summary is inconsistent',
	);
	requireValue(
		compliance.candidate?.gitSha === expectedGitSha &&
			compliance.candidate?.frontendTreeSha256 === candidate.frontendTree.treeSha256 &&
			compliance.candidate?.mathTreeSha256 === candidate.mathTree.treeSha256 &&
			compliance.candidate?.mathFingerprintSha256 ===
				candidate.manifest.mathEvidence.candidateFingerprintSha256 &&
			compliance.candidate?.packageVerification === 'PASS' &&
			sameJson(compliance.candidate?.browserSummary, browser.summary),
		'Compliance candidate identity is inconsistent',
	);
	requireValue(
		compliance.claims?.matrixCompleteness === 'PASS' &&
			compliance.claims?.automatedReferencesResolved === 'PASS' &&
			compliance.claims?.repositoryReferencesResolved === 'PASS' &&
			compliance.claims?.inputByteIdentityRecorded === 'PASS' &&
			compliance.claims?.manualEvidence === 'NOT_CLAIMED' &&
			compliance.claims?.externalApproval === 'NOT_CLAIMED' &&
			compliance.claims?.releaseReadiness === 'NOT_CLAIMED',
		'Compliance claims do not preserve the manual/external release boundary',
	);
	const generatedAtMilliseconds = Date.parse(compliance.generatedAt ?? '');
	requireValue(
		Number.isFinite(generatedAtMilliseconds) &&
			new Date(generatedAtMilliseconds).toISOString() === compliance.generatedAt,
		'Compliance generatedAt must be an exact ISO timestamp',
	);
	const independentlyResolved = buildComplianceEvidence({
		candidateRoot: candidate.root,
		browserEvidencePath: browser.evidenceDocument.path,
		evidenceMapPath: evidenceMapDocument.path,
	});
	independentlyResolved.generatedAt = compliance.generatedAt;
	requireValue(
		sameJson(compliance, independentlyResolved),
		'Compliance evidence differs from the exact resolver output',
	);
	return {
		document,
		evidenceMapDocument,
		requirementsChecklistPath,
		requirementsChecklistFile,
		compliance,
		sourceMap,
		summary,
	};
}

function tarVersion() {
	const output = execFileSync('tar', ['--version'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const version = output.split(/\r?\n/u)[0]?.trim();
	requireValue(version?.startsWith('tar (GNU tar) '), 'Deterministic bundles require GNU tar');
	return version;
}

function createDeterministicArchive(candidateRoot, directoryName, destination) {
	execFileSync(
		'tar',
		[
			'--sort=name',
			'--mtime=@0',
			'--owner=0',
			'--group=0',
			'--numeric-owner',
			'--mode=a=rX,u+w',
			'--format=gnu',
			'--no-acls',
			'--no-xattrs',
			'--no-selinux',
			'--hard-dereference',
			'--create',
			'--file',
			destination,
			'--',
			directoryName,
		],
		{
			cwd: candidateRoot,
			env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);
	assertPhysicalFile(destination, `${directoryName} transport archive`);
}

function verifyArchive(archivePath, directoryName, expectedTree, outputRoot) {
	const listing = execFileSync('tar', ['--list', '--file', archivePath], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
		.trimEnd()
		.split(/\r?\n/u)
		.filter(Boolean);
	requireValue(listing.length > 0, `${directoryName} transport archive is empty`);
	for (const member of listing) {
		requireValue(
			(member === directoryName || member.startsWith(`${directoryName}/`)) &&
				!member.startsWith('/') &&
				!member.split('/').some((part) => part === '..'),
			`${directoryName} transport archive contains an unsafe member: ${member}`,
		);
	}
	const verificationRoot = join(outputRoot, `.verify-${directoryName}`);
	mkdirSync(verificationRoot, { mode: 0o700 });
	try {
		execFileSync('tar', ['--extract', '--file', archivePath, '--directory', verificationRoot], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const extractedTree = createReleaseTreeManifest(join(verificationRoot, directoryName), {
			archiveSource: true,
		});
		requireValue(
			sameJson(extractedTree, expectedTree),
			`${directoryName} transport archive does not extract to the candidate tree`,
		);
	} finally {
		rmSync(verificationRoot, { recursive: true, force: true });
	}
}

function copyFileExclusive(source, destination, expectedFact) {
	mkdirSync(dirname(destination), { recursive: true, mode: 0o755 });
	copyFileSync(source, destination, fsConstants.COPYFILE_EXCL);
	assertRecordedFact(fileFact(destination), expectedFact, `Copied evidence ${destination}`);
}

function copyTreeExclusive(sourceRoot, destinationRoot, tree) {
	for (const file of tree.files) {
		const source = join(sourceRoot, ...file.path.split('/'));
		const destination = join(destinationRoot, ...file.path.split('/'));
		copyFileExclusive(source, destination, file);
	}
	const copiedTree = createReleaseTreeManifest(destinationRoot);
	requireValue(sameJson(copiedTree, tree), 'Copied browser run tree differs from its source');
}

function bundleFile(path, bundlePath, details = {}) {
	return { bundlePath, ...fileFact(path), ...details };
}

function assertInputsUnchanged(candidate, browser, compliance) {
	requireValue(
		sameJson(createReleaseTreeManifest(candidate.root), candidate.candidateTree),
		'Candidate bytes changed while generating the release bundle',
	);
	requireValue(
		sameJson(createReleaseTreeManifest(browser.root), browser.runTree),
		'Browser run bytes changed while generating the release bundle',
	);
	assertRecordedFact(
		fileFact(compliance.document.path),
		compliance.document.file,
		'Compliance evidence changed during bundle generation',
	);
	assertRecordedFact(
		fileFact(compliance.evidenceMapDocument.path),
		compliance.evidenceMapDocument.file,
		'51-point source map changed during bundle generation',
	);
	assertRecordedFact(
		fileFact(compliance.requirementsChecklistPath),
		compliance.requirementsChecklistFile,
		'51-point requirements checklist changed during bundle generation',
	);
}

function validateOutputPath(outputPath, protectedPaths) {
	const outputRoot = resolve(outputPath);
	requireValue(
		!existsSync(outputRoot),
		`Output already exists; refusing to overwrite: ${outputRoot}`,
	);
	const parent = assertPhysicalDirectory(dirname(outputRoot), 'Output parent');
	requireValue(dirname(outputRoot) === parent, 'Output parent path is not canonical');
	requireValue(
		basename(outputRoot) !== '' && !/[\\/\u0000-\u001f\u007f]/u.test(basename(outputRoot)),
		'Output directory name is unsafe',
	);
	for (const protectedPath of protectedPaths) {
		assertNonOverlapping(outputRoot, protectedPath, 'Output directory');
	}
	return outputRoot;
}

function assembleReleaseEvidenceBundle(
	{
		candidateRoot,
		browserRunRoot,
		complianceEvidencePath,
		outputPath,
		expectedBranch,
		expectedGitSha,
		ciRunId,
		ciRunAttempt,
		evidenceMapPath = defaultEvidenceMapPath,
		repositoryIdentity,
	},
	assertRepositoryIdentity = null,
	verifyCanonicalCandidate = null,
) {
	requireValue(
		process.platform === 'linux',
		'Deterministic release bundle generation is Linux-only',
	);
	validateExpectedBranch(expectedBranch);
	requireValue(
		fullGitShaPattern.test(expectedGitSha ?? ''),
		'expectedGitSha must be a full lowercase Git SHA',
	);
	requireValue(
		positiveDecimalPattern.test(ciRunId ?? ''),
		'ciRunId must be a positive decimal string',
	);
	requireValue(
		positiveDecimalPattern.test(ciRunAttempt ?? ''),
		'ciRunAttempt must be a positive decimal string',
	);
	validateReleaseRepositoryIdentity(repositoryIdentity, expectedGitSha);
	assertRepositoryIdentity?.(repositoryIdentity, expectedGitSha);
	const candidate = validateCandidate(candidateRoot, expectedBranch, expectedGitSha);
	verifyCanonicalCandidate?.(candidate, expectedBranch, expectedGitSha);
	assertRepositoryIdentity?.(repositoryIdentity, expectedGitSha);
	const browser = validateBrowserRun(browserRunRoot, candidate, expectedGitSha);
	assertNonOverlapping(candidate.root, browser.root, 'Candidate and browser roots');
	const physicalCompliancePath = assertPhysicalFile(complianceEvidencePath, 'Compliance evidence');
	const physicalEvidenceMapPath = assertPhysicalFile(evidenceMapPath, '51-point source map');
	requireValue(
		!pathIsWithin(candidate.root, physicalCompliancePath) &&
			!pathIsWithin(browser.root, physicalCompliancePath),
		'Compliance evidence must be outside candidate and browser input trees',
	);
	const compliance = validateCompliance(
		physicalCompliancePath,
		physicalEvidenceMapPath,
		candidate,
		browser,
		expectedGitSha,
	);
	const outputRoot = validateOutputPath(outputPath, [
		candidate.root,
		browser.root,
		physicalCompliancePath,
		physicalEvidenceMapPath,
		compliance.requirementsChecklistPath,
	]);
	const version = tarVersion();
	let outputCreated = false;
	try {
		mkdirSync(outputRoot, { mode: 0o755 });
		outputCreated = true;
		const frontendArchivePath = join(outputRoot, 'frontend.tar');
		const mathArchivePath = join(outputRoot, 'math.tar');
		createDeterministicArchive(candidate.root, 'frontend', frontendArchivePath);
		createDeterministicArchive(candidate.root, 'math', mathArchivePath);
		verifyArchive(frontendArchivePath, 'frontend', candidate.frontendTree, outputRoot);
		verifyArchive(mathArchivePath, 'math', candidate.mathTree, outputRoot);

		copyFileExclusive(
			candidate.manifestDocument.path,
			join(outputRoot, candidateManifestName),
			candidate.manifestDocument.file,
		);
		copyFileExclusive(
			candidate.verificationDocument.path,
			join(outputRoot, packageVerificationName),
			candidate.verificationDocument.file,
		);
		copyFileExclusive(
			compliance.evidenceMapDocument.path,
			join(outputRoot, evidenceMapName),
			compliance.evidenceMapDocument.file,
		);
		copyFileExclusive(
			compliance.requirementsChecklistPath,
			join(outputRoot, requirementsChecklistName),
			compliance.requirementsChecklistFile,
		);
		copyFileExclusive(
			compliance.document.path,
			join(outputRoot, complianceEvidenceName),
			compliance.document.file,
		);
		copyTreeExclusive(
			browser.root,
			join(outputRoot, ...browser.bundleRoot.split('/')),
			browser.runTree,
		);

		assertInputsUnchanged(candidate, browser, compliance);
		assertRepositoryIdentity?.(repositoryIdentity, expectedGitSha);
		const frontendArchive = bundleFile(frontendArchivePath, 'frontend.tar', {
			mediaType: 'application/x-tar',
			archiveRoot: 'frontend/',
		});
		const mathArchive = bundleFile(mathArchivePath, 'math.tar', {
			mediaType: 'application/x-tar',
			archiveRoot: 'math/',
		});
		const manifest = {
			schema: RELEASE_BUNDLE_SCHEMA,
			lifecycle: 'EVIDENCE_BUNDLE_GENERATED_MANUAL_AND_EXTERNAL_GATES_OPEN',
			uploadAuthorized: false,
			identity: {
				expectedBranch,
				expectedGitSha,
				ci: { runId: ciRunId, runAttempt: ciRunAttempt },
				gameId: candidate.manifest.game?.id ?? null,
				frontendTreeSha256: candidate.frontendTree.treeSha256,
				mathTreeSha256: candidate.mathTree.treeSha256,
				mathCandidateFingerprintSha256: candidate.manifest.mathEvidence.candidateFingerprintSha256,
			},
			generator: {
				name: 'blacksite-release-bundle',
				version: RELEASE_BUNDLE_GENERATOR_VERSION,
				script: 'scripts/blacksite-release-bundle.mjs',
				scriptSha256: fileFact(scriptPath).sha256,
				node: process.version,
				platform: process.platform,
				tar: version,
				archiveFormat: 'GNU tar with sorted names, epoch mtime, uid/gid 0, normalized modes',
			},
			repository: repositoryIdentity,
			inputs: {
				candidateTree: candidate.candidateTree,
				candidateManifest: {
					bundlePath: candidateManifestName,
					...candidate.manifestDocument.file,
					schema: candidate.manifest.schema,
					lifecycle: candidate.manifest.lifecycle,
					approvalStatus: candidate.manifest.approvalStatus,
					uploadAuthorized: candidate.manifest.uploadAuthorized,
					gitBranch: candidate.manifest.git.branch,
					gitSha: candidate.manifest.git.sha,
				},
				packageVerification: {
					bundlePath: packageVerificationName,
					...candidate.verificationDocument.file,
					schema: candidate.verification.schema,
					result: candidate.verification.result,
					gitBranch: candidate.verification.gitBranch,
					gitSha: candidate.verification.gitSha,
				},
				sourceMap: {
					bundlePath: evidenceMapName,
					...compliance.evidenceMapDocument.file,
					schema: compliance.sourceMap.schema,
					itemCount: compliance.sourceMap.items.length,
				},
				requirementsChecklist: {
					bundlePath: requirementsChecklistName,
					...compliance.requirementsChecklistFile,
					sourcePath: 'docs/blacksite/STAKE_REQUIREMENTS_51.md',
				},
				browserEvidence: {
					bundlePath: `${browser.bundleRoot}/${browserEvidenceName}`,
					...browser.evidenceDocument.file,
					format: 'blacksite-qa-e2e-browser-evidence',
					identity: {
						testedGitSha: browser.evidence.identity.testedGitSha,
						buildTreeSha256: browser.evidence.identity.buildTreeSha256,
						expectedBuildTreeSha256: browser.evidence.identity.expectedBuildTreeSha256,
						sourceTreeSha256: browser.evidence.identity.sourceTreeSha256,
					},
					summary: browser.summary,
				},
				complianceEvidence: {
					bundlePath: complianceEvidenceName,
					...compliance.document.file,
					schema: compliance.compliance.schema,
					identity: {
						gitSha: compliance.compliance.candidate.gitSha,
						frontendTreeSha256: compliance.compliance.candidate.frontendTreeSha256,
						mathTreeSha256: compliance.compliance.candidate.mathTreeSha256,
						mathFingerprintSha256: compliance.compliance.candidate.mathFingerprintSha256,
					},
				},
			},
			transport: {
				frontend: { sourceTree: candidate.frontendTree, archive: frontendArchive },
				math: { sourceTree: candidate.mathTree, archive: mathArchive },
			},
			browserRun: {
				bundleRoot: browser.bundleRoot,
				tree: browser.runTree,
				screenshotFiles: browser.screenshotFiles,
				screenshotReferences: browser.screenshotReferences,
			},
			compliance: {
				summary: compliance.summary,
				claims: compliance.compliance.claims,
			},
			openGates: {
				stakeChecklist: {
					manualRequirementIds: compliance.summary.manualGateOpen,
					externalLifecycleRequirementIds: compliance.summary.externalGateOpen,
					externalWithRepositoryProofIds: compliance.summary.externalOpenWithRepositoryEvidence,
				},
				projectBlockers: [
					{
						id: 'BSB-SCALE-001',
						category: 'PRODUCTION_EQUIVALENT_SCALE_AND_RESILIENCE',
						status: 'EXTERNAL_OWNER_EVIDENCE_OPEN',
					},
					{
						id: 'BSB-ASSET-001',
						category: 'FINAL_ASSETS_LAYERS_RIGHTS_AND_CREATIVE_APPROVAL',
						status: 'MANUAL_AND_EXTERNAL_OWNER_EVIDENCE_OPEN',
					},
					{
						id: 'BSB-MOTION-001',
						category: 'APPROVED_SPINE_CLIPS_AND_REAL_DEVICE_PACING',
						status: 'MANUAL_AND_EXTERNAL_OWNER_EVIDENCE_OPEN',
					},
					{
						id: 'BSB-AUDIO-001',
						category: 'FINAL_AUDIO_MASTERS_LISTENING_CLIPPING_AND_DEVICE_QA',
						status: 'MANUAL_AND_EXTERNAL_OWNER_EVIDENCE_OPEN',
					},
				],
			},
			claims: {
				candidatePackageVerification: 'PASS',
				browserEvidence: 'PASS',
				complianceEvidence: 'STRUCTURALLY_VALID',
				transportArchiveIntegrity: 'PASS',
				candidateMutation: 'NONE',
				manualEvidence: 'NOT_CLAIMED',
				externalApproval: 'NOT_CLAIMED',
				uploadAuthorization: 'NOT_CLAIMED',
				releaseReadiness: 'NOT_CLAIMED',
			},
		};
		const manifestPath = join(outputRoot, bundleManifestName);
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
			encoding: 'utf8',
			flag: 'wx',
			mode: 0o644,
		});
		const expectedOutputEntries = [
			'artifacts',
			complianceEvidenceName,
			candidateManifestName,
			'frontend.tar',
			'math.tar',
			packageVerificationName,
			evidenceMapName,
			requirementsChecklistName,
			bundleManifestName,
		].sort();
		const outputEntries = readdirSync(outputRoot).sort();
		requireValue(
			sameJson(outputEntries, expectedOutputEntries),
			`Release bundle contains unexpected top-level entries: ${outputEntries.join(', ')}`,
		);
		assertInputsUnchanged(candidate, browser, compliance);
		assertRepositoryIdentity?.(repositoryIdentity, expectedGitSha);
		return { outputRoot, manifestPath, manifest, manifestFile: fileFact(manifestPath) };
	} catch (error) {
		if (outputCreated) rmSync(outputRoot, { recursive: true, force: true });
		throw error;
	}
}

// Fixture-only seam: production callers must use createReleaseEvidenceBundle or
// the CLI, which assert the live Git checkout and rerun the canonical verifier.
export function assembleReleaseEvidenceBundleForTests(arguments_) {
	return assembleReleaseEvidenceBundle(arguments_);
}

export function createReleaseEvidenceBundle(arguments_) {
	return assembleReleaseEvidenceBundle(
		{
			...arguments_,
			evidenceMapPath: defaultEvidenceMapPath,
			repositoryIdentity: captureReleaseRepositoryIdentity(arguments_.expectedGitSha),
		},
		assertReleaseRepositoryIdentityUnchanged,
		verifyCandidateWithCanonicalVerifier,
	);
}

function requiredArgument(arguments_, name) {
	const matches = arguments_
		.map((value, index) => ({ value, index }))
		.filter((entry) => entry.value === name);
	requireValue(matches.length === 1, `Expected exactly one ${name} argument`);
	const value = arguments_[matches[0].index + 1];
	requireValue(value && !value.startsWith('--'), `Missing value for ${name}`);
	return value;
}

function parseArguments(arguments_) {
	const allowed = new Set([
		'--candidate',
		'--browser-run',
		'--compliance-evidence',
		'--output',
		'--expected-branch',
		'--expected-commit',
		'--ci-run-id',
		'--ci-run-attempt',
	]);
	requireValue(
		arguments_.length === 16,
		'Release bundle CLI requires exactly eight option/value pairs',
	);
	for (let index = 0; index < arguments_.length; index += 2) {
		requireValue(
			allowed.has(arguments_[index]),
			`Unknown release bundle option: ${arguments_[index]}`,
		);
	}
	return {
		candidateRoot: resolve(process.cwd(), requiredArgument(arguments_, '--candidate')),
		browserRunRoot: resolve(process.cwd(), requiredArgument(arguments_, '--browser-run')),
		complianceEvidencePath: resolve(
			process.cwd(),
			requiredArgument(arguments_, '--compliance-evidence'),
		),
		outputPath: resolve(process.cwd(), requiredArgument(arguments_, '--output')),
		expectedBranch: requiredArgument(arguments_, '--expected-branch'),
		expectedGitSha: requiredArgument(arguments_, '--expected-commit'),
		ciRunId: requiredArgument(arguments_, '--ci-run-id'),
		ciRunAttempt: requiredArgument(arguments_, '--ci-run-attempt'),
	};
}

function main() {
	const arguments_ = parseArguments(process.argv.slice(2));
	const result = createReleaseEvidenceBundle(arguments_);
	process.stdout.write(
		`${JSON.stringify(
			{
				status: 'EVIDENCE_BUNDLE_COMPLETE',
				scope: 'REPOSITORY_CANDIDATE_AND_EVIDENCE_INTEGRITY',
				output: result.outputRoot,
				manifest: { ...result.manifestFile, schema: result.manifest.schema },
				identity: result.manifest.identity,
				openGates: result.manifest.openGates,
				claims: result.manifest.claims,
			},
			null,
			2,
		)}\n`,
	);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	try {
		main();
	} catch (error) {
		console.error(error.stack || error);
		process.exitCode = 1;
	}
}
