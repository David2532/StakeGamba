import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildComplianceEvidence } from '../../../scripts/blacksite-compliance-evidence.mjs';
import {
	BLACKSITE_PERFORMANCE_BUDGET,
	summarizePerformanceRuns,
} from '../../../scripts/blacksite-performance-budget.mjs';
import { buildRepositoryGateEvidence } from '../../../scripts/blacksite-repository-evidence.mjs';
import {
	RELEASE_BUNDLE_SCHEMA,
	assembleReleaseEvidenceBundleForTests,
	captureGitHubActionsReleaseIdentity,
	createReleaseTreeManifest,
	repositoryInputBundlePath,
	validateReleaseRepositoryIdentity,
} from '../../../scripts/blacksite-release-bundle.mjs';
import {
	BLACKSITE_SECURITY_POLICY,
	buildSecurityEvidence,
	collectPackageManifestPaths,
} from '../../../scripts/blacksite-security-evidence.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const bundleScriptPath = join(repoRoot, 'scripts', 'blacksite-release-bundle.mjs');
const evidenceMapPath = join(repoRoot, 'docs', 'blacksite', 'RELEASE_EVIDENCE_51.json');
const evidenceMap = JSON.parse(readFileSync(evidenceMapPath, 'utf8'));
const expectedBranch = 'codex/blacksite-aaa-studio';
const expectedGitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
	cwd: repoRoot,
	encoding: 'utf8',
}).trim();
const mathFingerprintSha256 = '2'.repeat(64);
const browserSourceTreeSha256 = '3'.repeat(64);
const criticalRepositoryPaths = [
	'docs/blacksite/RELEASE_EVIDENCE_51.json',
	'docs/blacksite/STAKE_REQUIREMENTS_51.md',
	'scripts/blacksite-compliance-evidence.mjs',
	'scripts/blacksite-package-verify.mjs',
	'scripts/blacksite-release-bundle.mjs',
];

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

function repositoryIdentity() {
	return {
		source: 'git-head-and-tracked-worktree-v1',
		gitSha: expectedGitSha,
		gitTreeSha: '4'.repeat(40),
		trackedWorktreeClean: true,
		indexClean: true,
		untrackedArtifactsAllowed: true,
		criticalFiles: criticalRepositoryPaths.map((path, index) => {
			const current = fileFact(join(repoRoot, ...path.split('/')));
			return {
				path,
				head: { gitBlobOid: String(index + 5).repeat(40), ...current },
				current,
				matchesHead: true,
			};
		}),
	};
}

function ciIdentity() {
	return {
		provider: 'github-actions',
		authenticity: 'EXTERNAL_RUN_VERIFICATION_REQUIRED',
		repository: 'David2532/StakeGamba',
		eventName: 'push',
		workflow: 'BlackSite CI',
		workflowRef: `David2532/StakeGamba/.github/workflows/blacksite-ci.yml@refs/heads/${expectedBranch}`,
		workflowSha: expectedGitSha,
		job: 'blacksite-quality',
		ref: `refs/heads/${expectedBranch}`,
		refName: expectedBranch,
		refType: 'branch',
		sha: expectedGitSha,
		runId: '123456789',
		runAttempt: '2',
	};
}

function validPerformanceEvidence(buildTreeSha256) {
	const stateIds = Object.keys(BLACKSITE_PERFORMANCE_BUDGET.states);
	const runs = stateIds.flatMap((stateId) =>
		Array.from({ length: BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState }, (_, index) => ({
			stateId,
			run: index + 1,
			readyMs: 100,
			completeMs: 120,
			lcpMs: 90,
			scriptedInteractionLatencyMs: 16,
			cls: 0,
			lifecycleLongTaskBlockingMs: 0,
			frameIntervalP95Ms: 17,
			frameIntervalMaxMs: 20,
			frameIntervalsOver50Count: 0,
			decodedBodyBytes: 400_000,
			navigation: {
				responseEndMs: 20,
				domInteractiveMs: 60,
				domContentLoadedMs: 70,
				loadEventEndMs: 80,
			},
			primaryInteraction: {
				selector: '[data-testid="primary-action"]',
				testId: 'primary-action',
				armedAt: 80,
				trustedClickCount: 1,
				observedEntryCount: 3,
			},
			eventTimingSource: 'event',
			interactionCount: 1,
			frameSamples: 20,
			resourceCount: 5,
			support: {
				largestContentfulPaint: true,
				layoutShift: true,
				longTask: true,
				eventTiming: true,
				firstInput: true,
			},
			observerErrors: [],
		})),
	);
	const summaries = stateIds.map((stateId) =>
		summarizePerformanceRuns(
			stateId,
			runs.filter((run) => run.stateId === stateId),
		),
	);
	return {
		schema: 'blacksite-performance-lab-evidence-v1',
		measurementKind: BLACKSITE_PERFORMANCE_BUDGET.measurementKind,
		fieldData: false,
		fieldDataStatus: 'NOT_COLLECTED',
		fieldDataReason: 'Fixture represents controlled CI lab evidence, not field data.',
		budget: BLACKSITE_PERFORMANCE_BUDGET,
		environment: {
			testedGitSha: expectedGitSha,
			buildTreeSha256,
			ci: true,
			headless: true,
			node: 'v22.16.0',
			playwright: '1.61.1',
			chromium: '149.0.0.0',
			viewport: BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.viewport,
			cache: BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.cache,
			network: BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.network,
			motion: BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.motion,
			sequence: BLACKSITE_PERFORMANCE_BUDGET.comparisonProfile.sequence,
		},
		runs,
		summaries,
		summary: { states: 3, pass: 3, fail: 0, runs: 9 },
	};
}

function validAccessibilityEvidence() {
	const surfaces = [
		'live-authenticating',
		'boot-intro-modal-mobile',
		'live-ready-desktop',
		'live-result-desktop',
		'rules-modal-desktop',
		'high-cost-confirmation-modal-desktop',
		'replay-ready-popout-s',
		'replay-completed-popout-s',
	];
	const audits = surfaces.map((surface, index) => ({
		surface,
		passes: [{ id: `rule-${index + 1}` }],
		violations: [],
		incomplete: [],
	}));
	return {
		schema: 'blacksite-accessibility-evidence-v1',
		standard: 'WCAG 2.2 Level A and AA automated rules',
		engine: { name: 'axe-core', version: '4.13.0' },
		tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
		audits,
		summary: { audits: 8, passes: 8, violations: 0, incomplete: 0 },
	};
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blacksite-release-bundle-'));
	const candidateRoot = join(root, 'candidate');
	const frontendRoot = join(candidateRoot, 'frontend');
	const mathRoot = join(candidateRoot, 'math');
	mkdirSync(join(frontendRoot, '_app'), { recursive: true });
	mkdirSync(mathRoot);
	writeFileSync(join(frontendRoot, 'index.html'), '<!doctype html><title>BLACKSITE</title>\n');
	writeJson(join(frontendRoot, '_app', 'version.json'), { version: expectedGitSha });
	writeJson(join(mathRoot, 'index.json'), {
		modes: [{ name: 'base', cost: 1, events: 'base.jsonl.zst', weights: 'base.csv' }],
	});
	writeFileSync(join(mathRoot, 'base.csv'), '1,1,0\n');
	writeFileSync(join(mathRoot, 'base.jsonl.zst'), Buffer.from([0x28, 0xb5, 0x2f, 0xfd]));
	writeFileSync(
		join(candidateRoot, 'README_UPLOAD_CANDIDATE.txt'),
		'Technical candidate only; manual and external gates remain open.\n',
	);
	const frontendTree = createReleaseTreeManifest(frontendRoot);
	const mathTree = createReleaseTreeManifest(mathRoot);
	const candidateManifestPath = join(candidateRoot, 'candidate-manifest.json');
	writeJson(candidateManifestPath, {
		schema: 'blacksite-upload-candidate-v1',
		lifecycle: 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY',
		approvalStatus: 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN',
		uploadAuthorized: false,
		generatedAt: '2026-09-03T00:00:00.000Z',
		git: {
			branch: expectedBranch,
			sha: expectedGitSha,
			expectedSha: expectedGitSha,
			cleanBefore: true,
			cleanAfter: true,
			dirty: false,
		},
		game: { id: 'blacksite_breach' },
		frontendEvidence: { hygiene: { result: 'PASS', fixture: true } },
		mathEvidence: {
			candidateFingerprintSha256: mathFingerprintSha256,
			gatesPassed: 90,
			gatesTotal: 90,
		},
		packages: { frontend: frontendTree, math: mathTree },
	});
	const packageVerificationPath = join(candidateRoot, 'package-verification.json');
	writeJson(packageVerificationPath, {
		schema: 'blacksite-upload-candidate-verification-v1',
		result: 'PASS',
		lifecycle: 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY',
		verifiedAt: '2026-09-03T00:00:00.000Z',
		gitBranch: expectedBranch,
		gitSha: expectedGitSha,
		candidateRoot,
		frontend: frontendTree,
		frontendHygiene: { result: 'PASS', fixture: true },
		math: mathTree,
		modeResults: [
			{ mode: 'base', cost: 1, books: 100_000, lookupRows: 100_000 },
			{ mode: 'deep_access', cost: 4, books: 100_000, lookupRows: 100_000 },
			{ mode: 'blackout', cost: 80, books: 100_000, lookupRows: 100_000 },
		],
		claims: {
			uploadPayloadStructureAndIdentity: 'PASS',
			bookLookupIdAndPayoutMatch: 'PASS',
			stakeApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	});

	const runName = '2026-09-03T00-00-00-000Z';
	const browserRunRoot = join(root, 'browser-runs', runName);
	mkdirSync(join(browserRunRoot, 'screenshots'), { recursive: true });
	writeFileSync(join(browserRunRoot, 'screenshots', 'scenario.png'), Buffer.from('screenshot'));
	writeFileSync(
		join(browserRunRoot, 'screenshots', 'unreferenced-diagnostic.png'),
		Buffer.from('diagnostic'),
	);
	const browserEvidencePath = join(browserRunRoot, 'blacksite-browser-evidence.json');
	const requiredScenarioNames = [
		...new Set(evidenceMap.items.flatMap((item) => item.browserScenarios ?? [])),
	];
	const requiredChecks = [
		...new Map(
			evidenceMap.items
				.flatMap((item) => item.browserChecks ?? [])
				.map((check) => [JSON.stringify([check.group, check.name]), check]),
		).values(),
	];
	const scenarios = [
		{
			name: 'bundle-fixture',
			status: 'PASS',
			screenshot: `artifacts/blacksite-qa/${runName}/screenshots/scenario.png`,
			screenshots: [
				`artifacts/blacksite-qa/${runName}/screenshots/scenario.png`,
				`artifacts/blacksite-qa/${runName}/screenshots/unreferenced-diagnostic.png`,
			],
		},
		...requiredScenarioNames.map((name) => ({ name, status: 'PASS' })),
	];
	const checks = requiredChecks.map((check) => ({
		...check,
		occurrence: 1,
		status: 'PASS',
	}));
	const browserEvidence = {
		schema: 'blacksite-browser-evidence-v2',
		identity: {
			startedAt: '2026-09-03T00:00:00.000Z',
			completedAt: '2026-09-03T00:01:00.000Z',
			testedGitSha: expectedGitSha,
			worktreeDirty: false,
			testedBuildRoot: frontendRoot,
			expectedBuildTreeSha256: frontendTree.treeSha256,
			buildTreeSha256: frontendTree.treeSha256,
			sourceTreeSha256: browserSourceTreeSha256,
		},
		playwright: { version: '1.61.1', browser: '149.0.0.0', executable: 'fixture' },
		manifests: {
			build: frontendTree,
			sources: {
				algorithm: 'fixture-sha256',
				treeSha256: browserSourceTreeSha256,
				fileCount: 1,
				totalBytes: 10,
				files: [{ path: 'fixture.js', bytes: 10, sha256: '5'.repeat(64) }],
			},
		},
		productionBuildScan: {
			loaderHits: [],
			generatedFixtureHits: [],
			touchActionManipulationPresent: true,
			viewportMeta: { content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
		},
		scenarios,
		checks,
		summary: {
			pass: checks.length,
			fail: 0,
			scenarios: scenarios.length,
			passedScenarios: scenarios.length,
			failedScenarios: 0,
		},
		performance: validPerformanceEvidence(frontendTree.treeSha256),
		accessibility: validAccessibilityEvidence(),
	};
	writeJson(browserEvidencePath, browserEvidence);

	const securityRoot = join(root, 'security');
	mkdirSync(securityRoot);
	const auditReportPath = join(securityRoot, 'pnpm-audit.json');
	writeJson(auditReportPath, {
		actions: [],
		advisories: {},
		muted: [],
		metadata: {
			vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
			dependencies: 100,
			devDependencies: 0,
			optionalDependencies: 0,
			totalDependencies: 100,
		},
	});
	const auditStderrPath = join(securityRoot, 'pnpm-audit.stderr.txt');
	writeFileSync(auditStderrPath, '');
	const securityEvidencePath = join(securityRoot, 'security-evidence.json');
	const manifestInputs = collectPackageManifestPaths(repoRoot).map((path) => ({
		path: relative(repoRoot, path).replaceAll('\\', '/'),
		source: readFileSync(path, 'utf8'),
	}));
	writeJson(
		securityEvidencePath,
		buildSecurityEvidence({
			expectedGitSha,
			actualGitSha: expectedGitSha,
			manifestInputs,
			lockfileSource: readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
			npmrcSource: readFileSync(join(repoRoot, '.npmrc'), 'utf8'),
			effectiveAuditRegistry: BLACKSITE_SECURITY_POLICY.audit.registry,
			auditReportSource: readFileSync(auditReportPath, 'utf8'),
			auditExitCode: 0,
			requireAudit: true,
			generatedAt: '2026-09-03T00:02:00.000Z',
		}),
	);
	const repositoryEvidencePath = join(root, 'repository-gates.json');
	const repositorySources = [
		['workflow', join(repoRoot, '.github', 'workflows', 'blacksite-ci.yml')],
		['npmrc', join(repoRoot, '.npmrc')],
		['package-manifest', join(repoRoot, 'package.json')],
		['lockfile', join(repoRoot, 'pnpm-lock.yaml')],
		['security-evidence', securityEvidencePath],
		['candidate-manifest', candidateManifestPath],
		['package-verification', packageVerificationPath],
		['browser-evidence', browserEvidencePath],
	].map(([label, path]) => ({
		label,
		path: relative(repoRoot, path).replaceAll('\\', '/'),
		source: readFileSync(path, 'utf8'),
	}));
	writeJson(
		repositoryEvidencePath,
		buildRepositoryGateEvidence({
			expectedGitSha,
			actualGitSha: expectedGitSha,
			inputSources: repositorySources,
			generatedAt: '2026-09-03T00:03:00.000Z',
		}),
	);
	const complianceEvidencePath = join(root, 'blacksite-51-evidence.json');
	writeJson(
		complianceEvidencePath,
		buildComplianceEvidence({
			candidateRoot,
			browserEvidencePath,
			repositoryEvidencePath,
			securityEvidencePath,
		}),
	);
	return {
		root,
		candidateRoot,
		browserRunRoot,
		browserEvidencePath,
		repositoryEvidencePath,
		securityEvidencePath,
		auditReportPath,
		auditStderrPath,
		complianceEvidencePath,
		options: {
			candidateRoot,
			browserRunRoot,
			complianceEvidencePath,
			repositoryEvidencePath,
			securityEvidencePath,
			auditReportPath,
			auditStderrPath,
			expectedBranch,
			expectedGitSha,
			ciRunId: '123456789',
			ciRunAttempt: '2',
			repositoryIdentity: repositoryIdentity(),
			ciIdentity: ciIdentity(),
		},
	};
}

test('release bundle is deterministic, self-contained, and keeps manual/external gates open', () => {
	const value = fixture();
	try {
		const candidateBefore = createReleaseTreeManifest(value.candidateRoot);
		const first = assembleReleaseEvidenceBundleForTests({
			...value.options,
			outputPath: join(value.root, 'bundle-one'),
		});
		const second = assembleReleaseEvidenceBundleForTests({
			...value.options,
			outputPath: join(value.root, 'bundle-two'),
		});
		assert.equal(first.manifest.schema, RELEASE_BUNDLE_SCHEMA);
		assert.equal(first.manifest.identity.expectedBranch, expectedBranch);
		assert.equal(first.manifest.identity.expectedGitSha, expectedGitSha);
		assert.deepEqual(first.manifest.identity.ci, ciIdentity());
		assert.equal(first.manifest.repository.gitSha, expectedGitSha);
		assert.equal(first.manifest.repository.gitTreeSha, '4'.repeat(40));
		assert.deepEqual(
			first.manifest.repository.criticalFiles.map((file) => file.path),
			criticalRepositoryPaths,
		);
		assert.equal(first.manifest.claims.transportArchiveIntegrity, 'PASS');
		assert.equal(first.manifest.claims.repositoryGateEvidence, 'PASS');
		assert.equal(first.manifest.claims.dependencySecurityEvidence, 'PASS');
		assert.equal(first.manifest.claims.productionAuditReceipt, 'PASS');
		assert.equal(first.manifest.claims.auditStderrDiagnostics, 'NO_PASS_SEMANTICS');
		assert.equal(first.manifest.claims.githubActionsRunAuthenticity, 'NOT_CLAIMED');
		assert.equal(first.manifest.claims.candidateMutation, 'NONE');
		assert.equal(first.manifest.claims.manualEvidence, 'NOT_CLAIMED');
		assert.equal(first.manifest.claims.externalApproval, 'NOT_CLAIMED');
		assert.equal(first.manifest.claims.releaseReadiness, 'NOT_CLAIMED');
		assert(first.manifest.openGates.stakeChecklist.manualRequirementIds.length > 0);
		assert(first.manifest.openGates.stakeChecklist.externalLifecycleRequirementIds.length > 0);
		assert.deepEqual(
			first.manifest.openGates.stakeChecklist.externalWithRepositoryProofIds,
			[45, 46],
		);
		assert.deepEqual(
			first.manifest.openGates.projectBlockers.map((blocker) => blocker.id),
			['BSB-SCALE-001', 'BSB-ASSET-001', 'BSB-MOTION-001', 'BSB-AUDIO-001', 'BSB-DEVICE-001'],
		);
		assert.deepEqual(
			first.manifest.openGates.projectBlockers.find(({ id }) => id === 'BSB-DEVICE-001')
				.evidenceRequired,
			{
				deviceQaResultCount: 54,
				realPopoutExecution: true,
				assistiveTechnologyReview: true,
				nativeControlsConsoleAndChromeVisibilityReview: true,
				namedOwnerReview: true,
			},
		);
		assert.equal(first.manifest.browserRun.tree.fileCount, 3);
		assert.equal(first.manifest.browserRun.screenshotFiles.length, 2);
		assert.equal(first.manifest.browserRun.screenshotReferences.length, 3);
		assert.equal(
			first.manifest.browserRun.screenshotReferences.find(
				(reference) => reference.jsonPointer === '/scenarios/0/screenshots/1',
			)?.recordedPath,
			'artifacts/blacksite-qa/2026-09-03T00-00-00-000Z/screenshots/unreferenced-diagnostic.png',
		);
		assert.equal(
			first.manifest.browserRun.screenshotReferences.find(
				(reference) => reference.jsonPointer === '/scenarios/0/screenshot',
			)?.recordedPath,
			'artifacts/blacksite-qa/2026-09-03T00-00-00-000Z/screenshots/scenario.png',
		);
		for (const name of [
			'frontend.tar',
			'math.tar',
			'candidate-manifest.json',
			'package-verification.json',
			'release-evidence-map.json',
			'stake-requirements-51.md',
			'blacksite-51-evidence.json',
			'release-bundle-manifest.json',
		]) {
			assert(readFileSync(join(first.outputRoot, name)).length > 0, `${name} is empty`);
		}
		for (const [bundlePath, sourcePath] of [
			[first.manifest.inputs.repositoryGateEvidence.bundlePath, value.repositoryEvidencePath],
			[first.manifest.inputs.securityEvidence.bundlePath, value.securityEvidencePath],
			[first.manifest.inputs.productionAuditReport.bundlePath, value.auditReportPath],
			[first.manifest.diagnostics.productionAuditStderr.bundlePath, value.auditStderrPath],
		]) {
			assert.deepEqual(fileFact(join(first.outputRoot, bundlePath)), fileFact(sourcePath));
		}
		assert.equal(
			first.manifest.inputs.securityEvidence.auditReportSha256,
			first.manifest.inputs.productionAuditReport.sha256,
		);
		const retainedNpmrc = first.manifest.inputs.repositorySourceInputs.files.find(
			({ sourcePath }) => sourcePath === '.npmrc',
		);
		const retainedWorkflow = first.manifest.inputs.repositorySourceInputs.files.find(
			({ sourcePath }) => sourcePath === '.github/workflows/blacksite-ci.yml',
		);
		assert.equal(retainedNpmrc.bundlePath, 'repository-inputs/npmrc');
		assert.equal(
			retainedWorkflow.bundlePath,
			'repository-inputs/github/workflows/blacksite-ci.yml',
		);
		assert(
			first.manifest.inputs.repositorySourceInputs.files.every(
				({ bundlePath }) => !bundlePath.split('/').some((part) => part.startsWith('.')),
			),
		);
		for (const { bundlePath, sourcePath, bytes, sha256 } of first.manifest.inputs
			.repositorySourceInputs.files) {
			assert.deepEqual(fileFact(join(first.outputRoot, bundlePath)), { bytes, sha256 });
			assert.deepEqual(fileFact(join(repoRoot, sourcePath)), { bytes, sha256 });
		}
		assert.equal(
			first.manifest.inputs.securityEvidence.rawInputs.manifests.length,
			collectPackageManifestPaths(repoRoot).length,
		);
		const screenshotReference = first.manifest.browserRun.screenshotReferences.find(
			(reference) => reference.jsonPointer === '/scenarios/0/screenshot',
		);
		const copiedScreenshot = join(first.outputRoot, screenshotReference.recordedPath);
		assert.deepEqual(fileFact(copiedScreenshot), {
			bytes: screenshotReference.bytes,
			sha256: screenshotReference.sha256,
		});
		for (const file of ['frontend.tar', 'math.tar', 'release-bundle-manifest.json']) {
			assert(
				readFileSync(join(first.outputRoot, file)).equals(
					readFileSync(join(second.outputRoot, file)),
				),
				`${file} differs across deterministic reruns`,
			);
		}
		assert.deepEqual(createReleaseTreeManifest(value.candidateRoot), candidateBefore);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('production CLI rejects a mismatched checkout and modified critical HEAD blob identity', () => {
	const value = fixture();
	try {
		const outputPath = join(value.root, 'cli-bundle');
		const mismatchedGitSha = expectedGitSha === 'f'.repeat(40) ? 'e'.repeat(40) : 'f'.repeat(40);
		const cli = spawnSync(
			process.execPath,
			[
				bundleScriptPath,
				'--candidate',
				value.candidateRoot,
				'--browser-run',
				value.browserRunRoot,
				'--compliance-evidence',
				value.complianceEvidencePath,
				'--repository-evidence',
				value.repositoryEvidencePath,
				'--security-evidence',
				value.securityEvidencePath,
				'--audit-report',
				value.auditReportPath,
				'--audit-stderr',
				value.auditStderrPath,
				'--output',
				outputPath,
				'--expected-branch',
				expectedBranch,
				'--expected-commit',
				mismatchedGitSha,
				'--ci-run-id',
				'123456789',
				'--ci-run-attempt',
				'2',
			],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		assert.notEqual(cli.status, 0);
		assert.match(cli.stderr, /Repository HEAD .* does not match expected candidate SHA/u);
		assert.equal(existsSync(outputPath), false);

		const modifiedMapIdentity = structuredClone(repositoryIdentity());
		const mapIdentity = modifiedMapIdentity.criticalFiles.find(
			(file) => file.path === 'docs/blacksite/RELEASE_EVIDENCE_51.json',
		);
		mapIdentity.current.sha256 = '0'.repeat(64);
		assert.throws(
			() => validateReleaseRepositoryIdentity(modifiedMapIdentity, expectedGitSha),
			/Repository current-vs-HEAD blob identity mismatch: docs\/blacksite\/RELEASE_EVIDENCE_51\.json/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('production COMPLETE identity is source-only and exact GitHub Actions metadata', () => {
	const environment = {
		GITHUB_ACTIONS: 'true',
		CI: '1',
		GITHUB_REPOSITORY: 'David2532/StakeGamba',
		GITHUB_EVENT_NAME: 'push',
		GITHUB_WORKFLOW: 'BlackSite CI',
		GITHUB_WORKFLOW_REF: `David2532/StakeGamba/.github/workflows/blacksite-ci.yml@refs/heads/${expectedBranch}`,
		GITHUB_WORKFLOW_SHA: expectedGitSha,
		GITHUB_JOB: 'blacksite-quality',
		GITHUB_REF: `refs/heads/${expectedBranch}`,
		GITHUB_REF_NAME: expectedBranch,
		GITHUB_REF_TYPE: 'branch',
		GITHUB_SHA: expectedGitSha,
		GITHUB_RUN_ID: '123456789',
		GITHUB_RUN_ATTEMPT: '2',
	};
	const arguments_ = {
		expectedBranch,
		expectedGitSha,
		ciRunId: '123456789',
		ciRunAttempt: '2',
	};
	assert.deepEqual(captureGitHubActionsReleaseIdentity(arguments_, environment), ciIdentity());
	assert.throws(
		() =>
			captureGitHubActionsReleaseIdentity(arguments_, {
				...environment,
				GITHUB_EVENT_NAME: 'pull_request',
			}),
		/Release COMPLETE status requires the exact source-only/u,
	);
	assert.throws(
		() =>
			captureGitHubActionsReleaseIdentity(arguments_, {
				...environment,
				GITHUB_RUN_ID: '987654321',
			}),
		/Release COMPLETE status requires the exact source-only/u,
	);
	assert.throws(
		() => captureGitHubActionsReleaseIdentity(arguments_, { ...environment, CI: 'true' }),
		/available only inside GitHub Actions CI/u,
	);
});

test('repository source mappings cannot become traversal or hidden upload paths', () => {
	for (const sourcePath of [
		'apps/.../package.json',
		'apps/..nested/package.json',
		'.hidden/package.json',
		'../package.json',
	]) {
		const bundlePath = repositoryInputBundlePath(sourcePath);
		assert(bundlePath.startsWith('repository-inputs/'));
		assert(
			bundlePath
				.slice('repository-inputs/'.length)
				.split('/')
				.every((part) => part && part !== '.' && part !== '..' && !part.startsWith('.')),
		);
	}
	assert.equal(repositoryInputBundlePath('.npmrc'), 'repository-inputs/npmrc');
	assert.equal(
		repositoryInputBundlePath('.github/workflows/blacksite-ci.yml'),
		'repository-inputs/github/workflows/blacksite-ci.yml',
	);
});

test('release bundle rejects legacy browser evidence and non-identical build manifests', () => {
	const legacy = fixture();
	try {
		const browser = JSON.parse(readFileSync(legacy.browserEvidencePath, 'utf8'));
		delete browser.schema;
		writeJson(legacy.browserEvidencePath, browser);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...legacy.options,
					outputPath: join(legacy.root, 'bundle'),
				}),
			/current blacksite-browser-evidence-v2 schema/u,
		);
	} finally {
		rmSync(legacy.root, { recursive: true, force: true });
	}

	const forgedManifest = fixture();
	try {
		const browser = JSON.parse(readFileSync(forgedManifest.browserEvidencePath, 'utf8'));
		browser.manifests.build.files[0].sha256 = '0'.repeat(64);
		writeJson(forgedManifest.browserEvidencePath, browser);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...forgedManifest.options,
					outputPath: join(forgedManifest.root, 'bundle'),
				}),
			/Browser build manifest differs from the exact packaged frontend tree/u,
		);
	} finally {
		rmSync(forgedManifest.root, { recursive: true, force: true });
	}
});

test('release bundle independently rejects audit, security, repository and claim tampering', () => {
	const auditTamper = fixture();
	try {
		const report = JSON.parse(readFileSync(auditTamper.auditReportPath, 'utf8'));
		report.metadata.dependencies += 1;
		writeJson(auditTamper.auditReportPath, report);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...auditTamper.options,
					outputPath: join(auditTamper.root, 'bundle'),
				}),
			/not bound to the exact passing raw production audit report/u,
		);
	} finally {
		rmSync(auditTamper.root, { recursive: true, force: true });
	}

	const securityTamper = fixture();
	try {
		const security = JSON.parse(readFileSync(securityTamper.securityEvidencePath, 'utf8'));
		security.checks[0].detail.actualGitSha = 'f'.repeat(40);
		writeJson(securityTamper.securityEvidencePath, security);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...securityTamper.options,
					outputPath: join(securityTamper.root, 'bundle'),
				}),
			/Security evidence differs from independent recomputation/u,
		);
	} finally {
		rmSync(securityTamper.root, { recursive: true, force: true });
	}

	const repositoryTamper = fixture();
	try {
		const repository = JSON.parse(readFileSync(repositoryTamper.repositoryEvidencePath, 'utf8'));
		repository.gates[0].status = 'FAIL';
		writeJson(repositoryTamper.repositoryEvidencePath, repository);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...repositoryTamper.options,
					outputPath: join(repositoryTamper.root, 'bundle'),
				}),
			/Repository gate evidence differs from independent recomputation/u,
		);
	} finally {
		rmSync(repositoryTamper.root, { recursive: true, force: true });
	}

	const claimTamper = fixture();
	try {
		const compliance = JSON.parse(readFileSync(claimTamper.complianceEvidencePath, 'utf8'));
		compliance.claims.performanceLabBudgets = 'NOT_CLAIMED';
		writeJson(claimTamper.complianceEvidencePath, compliance);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...claimTamper.options,
					outputPath: join(claimTamper.root, 'bundle'),
				}),
			/Compliance claims do not preserve the manual\/external release boundary/u,
		);
	} finally {
		rmSync(claimTamper.root, { recursive: true, force: true });
	}
});

test('release bundle rejects symlinks in the complete browser run tree', () => {
	const value = fixture();
	try {
		symlinkSync(
			join(value.browserRunRoot, 'screenshots', 'scenario.png'),
			join(value.browserRunRoot, 'screenshots', 'linked.png'),
		);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...value.options,
					outputPath: join(value.root, 'bundle'),
				}),
			/Symbolic links are forbidden/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('release bundle rejects malformed plural screenshot collections', () => {
	const value = fixture();
	try {
		const browser = JSON.parse(readFileSync(value.browserEvidencePath, 'utf8'));
		browser.scenarios[0].screenshots.push(42);
		writeJson(value.browserEvidencePath, browser);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...value.options,
					outputPath: join(value.root, 'bundle'),
				}),
			/Browser screenshot collection scenarios\.0\.screenshots must be a non-empty string array/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('release bundle rejects stale compliance input digests and unsafe screenshot paths', () => {
	const stale = fixture();
	try {
		const compliance = JSON.parse(readFileSync(stale.complianceEvidencePath, 'utf8'));
		compliance.inputs.browserEvidence.sha256 = '0'.repeat(64);
		writeJson(stale.complianceEvidencePath, compliance);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...stale.options,
					outputPath: join(stale.root, 'bundle'),
				}),
			/Compliance browser-evidence input byte identity mismatch/u,
		);
	} finally {
		rmSync(stale.root, { recursive: true, force: true });
	}

	const unsafe = fixture();
	try {
		const browser = JSON.parse(readFileSync(unsafe.browserEvidencePath, 'utf8'));
		browser.scenarios[0].screenshot = '../outside.png';
		writeJson(unsafe.browserEvidencePath, browser);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...unsafe.options,
					outputPath: join(unsafe.root, 'bundle'),
				}),
			/Browser screenshot path must remain under/u,
		);
	} finally {
		rmSync(unsafe.root, { recursive: true, force: true });
	}
});

test('release bundle independently rejects forged per-row compliance receipts', () => {
	const value = fixture();
	try {
		const compliance = JSON.parse(readFileSync(value.complianceEvidencePath, 'utf8'));
		for (const item of compliance.items) delete item.repositoryEvidence;
		compliance.summary.repositoryEvidenceResolved = 0;
		compliance.summary.externalOpenWithRepositoryEvidence = [];
		writeJson(value.complianceEvidencePath, compliance);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...value.options,
					outputPath: join(value.root, 'bundle'),
				}),
			/Compliance evidence differs from the exact resolver output/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});

test('release bundle rejects a substituted game and forged canonical mode receipt', () => {
	const substitutedGame = fixture();
	try {
		const manifestPath = join(substitutedGame.candidateRoot, 'candidate-manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		manifest.game.id = 'lookalike_game';
		writeJson(manifestPath, manifest);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...substitutedGame.options,
					outputPath: join(substitutedGame.root, 'bundle'),
				}),
			/Candidate game identity must be blacksite_breach/u,
		);
	} finally {
		rmSync(substitutedGame.root, { recursive: true, force: true });
	}

	const forgedReceipt = fixture();
	try {
		const verificationPath = join(forgedReceipt.candidateRoot, 'package-verification.json');
		const verification = JSON.parse(readFileSync(verificationPath, 'utf8'));
		verification.modeResults[2].books = 1;
		writeJson(verificationPath, verification);
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...forgedReceipt.options,
					outputPath: join(forgedReceipt.root, 'bundle'),
				}),
			/Package verification does not contain the exact canonical book\/lookup results/u,
		);
	} finally {
		rmSync(forgedReceipt.root, { recursive: true, force: true });
	}
});

test('release bundle refuses output overwrite and output paths inside the candidate', () => {
	const value = fixture();
	try {
		const existingOutput = join(value.root, 'existing-bundle');
		mkdirSync(existingOutput);
		writeFileSync(join(existingOutput, 'owner.txt'), 'preserve me\n');
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...value.options,
					outputPath: existingOutput,
				}),
			/Output already exists; refusing to overwrite/u,
		);
		assert.equal(readFileSync(join(existingOutput, 'owner.txt'), 'utf8'), 'preserve me\n');
		assert.throws(
			() =>
				assembleReleaseEvidenceBundleForTests({
					...value.options,
					outputPath: join(value.candidateRoot, 'bundle'),
				}),
			/Output directory must not contain or be contained/u,
		);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
});
