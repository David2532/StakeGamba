import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
	CONTRACT_PATH,
	FRONTEND_BUILD_ROOT,
	OUTPUTS_ROOT,
	V18_FRONTEND_TREE,
	V19_EVIDENCE_ROOT_NAME,
	V19_EVIDENCE_PAYLOAD_FILES,
	V19_FRONTEND_ROOT_NAME,
	V19_MATH_ROOT_NAME,
	assertDisposableStagePath,
	assertManifestSummary,
	assertV19OutputsAbsent,
	assertV19SourceIdentity,
	createFileManifest,
	createSelectedFileManifest,
	createStagePath,
	extensionCounts,
	fail,
	fileFact,
	gitText,
	loadContract,
	releaseGateEvidence,
	verifyV18Baseline,
	writeJsonExclusive,
} from './blacksite-v19-package-contract.mjs';

function requiredArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing required argument ${name}`);
	}
	return process.argv[index + 1];
}

function parseArguments() {
	const usage =
		'Usage: node scripts/blacksite-v19-package-candidate.mjs --expected-commit <full-sha> --expected-frontend-tree <sha256> --accept-final-build-tree';
	try {
		const expectedCommit = requiredArgument('--expected-commit');
		const expectedFrontendTreeSha256 = requiredArgument('--expected-frontend-tree');
		if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) {
			fail('--expected-commit must be a full lowercase Git SHA');
		}
		if (!/^[0-9a-f]{64}$/u.test(expectedFrontendTreeSha256)) {
			fail('--expected-frontend-tree must be a lowercase SHA-256 digest');
		}
		if (!process.argv.includes('--accept-final-build-tree')) {
			fail('Refusing to bind a V19 frontend without --accept-final-build-tree');
		}
		return { expectedCommit, expectedFrontendTreeSha256 };
	} catch (error) {
		if (error instanceof Error) error.message = `${error.message}\n${usage}`;
		throw error;
	}
}

function assertFrontendRootShape(frontendRoot) {
	if (!existsSync(join(frontendRoot, 'index.html'))) {
		fail('Missing BLACKSITE frontend build index; run the final V19 build first');
	}
	const topLevel = readdirSync(frontendRoot).sort();
	if (JSON.stringify(topLevel) !== JSON.stringify(['_app', 'assets', 'index.html'])) {
		fail(`Unexpected frontend build root entries: ${topLevel.join(', ')}`);
	}
}

function safeRemoveStage(stageRoot) {
	if (!existsSync(stageRoot)) return;
	rmSync(assertDisposableStagePath(stageRoot), { recursive: true, force: false });
}

function promoteStage(stageRoot, stagePaths, finalPaths) {
	const moves = [
		[stagePaths.frontend, finalPaths.v19Frontend],
		[stagePaths.math, finalPaths.v19Math],
		[stagePaths.evidence, finalPaths.v19Evidence],
	];
	const completed = [];
	try {
		for (const [source, target] of moves) {
			if (existsSync(target)) fail(`V19 output appeared during packaging: ${target}`);
			renameSync(source, target);
			completed.push([source, target]);
		}
		safeRemoveStage(stageRoot);
	} catch (error) {
		const rollbackErrors = [];
		for (const [source, target] of completed.reverse()) {
			try {
				if (existsSync(target) && !existsSync(source)) renameSync(target, source);
			} catch (rollbackError) {
				rollbackErrors.push(String(rollbackError));
			}
		}
		if (rollbackErrors.length === 0) safeRemoveStage(stageRoot);
		if (rollbackErrors.length > 0 && error instanceof Error) {
			error.message += `\nRollback failed; inspect the V19 output siblings manually:\n${rollbackErrors.join('\n')}`;
		}
		throw error;
	}
}

function main() {
	const { expectedCommit, expectedFrontendTreeSha256 } = parseArguments();
	const contract = loadContract();
	const sourceIdentity = assertV19SourceIdentity(expectedCommit);
	const finalPaths = assertV19OutputsAbsent(contract);
	const baseline = verifyV18Baseline(contract);
	assertFrontendRootShape(FRONTEND_BUILD_ROOT);

	const frontendSource = createFileManifest(FRONTEND_BUILD_ROOT);
	if (frontendSource.treeSha256 === V18_FRONTEND_TREE) {
		fail('Fresh V19 frontend hash equals the V18 baseline; refusing a version-label-only package');
	}
	if (frontendSource.treeSha256 !== expectedFrontendTreeSha256) {
		fail(
			`Frontend build tree ${frontendSource.treeSha256} does not match the caller-pinned final tree ${expectedFrontendTreeSha256}`,
		);
	}

	const stageRoot = createStagePath(`${process.pid}_${Date.now()}`);
	const stagePaths = {
		frontend: join(stageRoot, V19_FRONTEND_ROOT_NAME),
		math: join(stageRoot, V19_MATH_ROOT_NAME),
		evidence: join(stageRoot, V19_EVIDENCE_ROOT_NAME),
	};
	let stageCreated = false;
	let promoted = false;
	try {
		mkdirSync(stageRoot, { recursive: false });
		stageCreated = true;
		cpSync(FRONTEND_BUILD_ROOT, stagePaths.frontend, { recursive: true, errorOnExist: true });
		cpSync(finalPaths.v18Math, stagePaths.math, { recursive: true, errorOnExist: true });
		mkdirSync(stagePaths.evidence);

		const frontendPackage = createFileManifest(stagePaths.frontend);
		const mathPackage = createFileManifest(stagePaths.math);
		assertManifestSummary(frontendPackage, frontendSource, 'Copied V19 frontend');
		if (JSON.stringify(frontendPackage.files) !== JSON.stringify(frontendSource.files)) {
			fail('Copied V19 frontend file identities differ from the caller-pinned final build');
		}
		assertManifestSummary(mathPackage, contract.v18Baseline.math, 'Copied V19 math');
		if (JSON.stringify(mathPackage.files) !== JSON.stringify(contract.v18Baseline.math.files)) {
			fail('Copied V19 math is not byte-identical to all seven V18 math files');
		}

		const gitStatusAfterCopy = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
		if (gitStatusAfterCopy !== '') {
			fail(`Worktree changed during V19 packaging:\n${gitStatusAfterCopy}`);
		}
		const generatedAt = new Date().toISOString();
		const releaseGates = releaseGateEvidence(contract);
		const frontendAcceptance = {
			schema: 'blacksite-v19-frontend-build-acceptance-v1',
			status: 'CALLER_PIN_MATCHED',
			acceptedAt: generatedAt,
			gitSha: expectedCommit,
			treeSha256: frontendPackage.treeSha256,
			fileCount: frontendPackage.fileCount,
			totalBytes: frontendPackage.totalBytes,
			extensionCounts: extensionCounts(frontendPackage),
			v18TreeRejected: frontendPackage.treeSha256 !== V18_FRONTEND_TREE,
			manualVisualApproval: 'NOT_CLAIMED',
			note:
				'This proves that the staged bytes match the explicitly supplied final-build hash. It does not prove visual, device, Stake or release approval.',
		};
		const manifest = {
			schema: 'blacksite-v19-technical-candidate-v1',
			version: 19,
			lifecycle: contract.releaseTruth.lifecycle,
			releaseDecision: contract.releaseTruth.releaseDecision,
			releaseReady: false,
			uploadAuthorized: false,
			generatedAt,
			contract: {
				path: 'docs/blacksite/V19_PACKAGE_CONTRACT.json',
				...fileFact(CONTRACT_PATH),
			},
			git: {
				sha: sourceIdentity.head,
				expectedSha: expectedCommit,
				v18BaselineSha: contract.v18Baseline.gitCommit,
				v18IsAncestor: true,
				cleanBefore: true,
				cleanAfter: true,
				dirty: false,
			},
			toolchain: {
				node: process.version,
				platform: process.platform,
				arch: process.arch,
			},
			outputRoots: {
				parent: OUTPUTS_ROOT,
				frontend: V19_FRONTEND_ROOT_NAME,
				math: V19_MATH_ROOT_NAME,
				evidence: V19_EVIDENCE_ROOT_NAME,
			},
			v18Baseline: baseline,
			frontendAcceptance,
			mathAcceptance: {
				status: 'PASS_BYTE_IDENTICAL_TO_V18',
				treeSha256: mathPackage.treeSha256,
				v18TreeSha256: contract.v18Baseline.math.treeSha256,
				fileCount: mathPackage.fileCount,
				totalBytes: mathPackage.totalBytes,
			},
			packages: {
				frontend: frontendPackage,
				math: mathPackage,
			},
			releaseGates,
			commands: {
				baseline:
					'node scripts/blacksite-v19-baseline-verify.mjs',
				build: 'pnpm --filter blacksite build',
				package: `node scripts/blacksite-v19-package-candidate.mjs --expected-commit ${expectedCommit} --expected-frontend-tree ${frontendPackage.treeSha256} --accept-final-build-tree`,
				verify: 'node scripts/blacksite-v19-package-verify.mjs --write-result',
				extractedBrowserQa: `BLACKSITE_QA_BUILD_ROOT=../${V19_FRONTEND_ROOT_NAME} BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=${frontendPackage.treeSha256} node scripts/blacksite-qa-e2e.mjs`,
			},
			warnings: [
				'Technical package candidate only; not release-ready and not authorized for upload.',
				'Automated extracted-package browser QA is not performed by this packager.',
				'Manual visual, responsive, older-device, animation, audio and asset-rights review remain open.',
				'External Stake/ACP/Slack/live gates remain EXTERNAL_PENDING.',
			],
		};

		writeJsonExclusive(join(stagePaths.evidence, 'V18_BASELINE_VERIFY.json'), {
			schema: 'blacksite-v19-v18-baseline-evidence-v1',
			result: 'PASS',
			verifiedAt: generatedAt,
			...baseline,
		});
		writeJsonExclusive(
			join(stagePaths.evidence, 'V19_FRONTEND_BUILD_ACCEPTANCE.json'),
			frontendAcceptance,
		);
		writeJsonExclusive(join(stagePaths.evidence, 'V19_RELEASE_GATES.json'), releaseGates);
		writeFileSync(
			join(stagePaths.evidence, 'README_V19_CANDIDATE.txt'),
			[
				'BLACKSITE // BREACH V19 - TECHNICAL PACKAGE CANDIDATE',
				'',
				`Git SHA: ${expectedCommit}`,
				`Frontend tree SHA-256: ${frontendPackage.treeSha256}`,
				`Math tree SHA-256: ${mathPackage.treeSha256}`,
				'',
				`Frontend upload root: ${V19_FRONTEND_ROOT_NAME}`,
				`Math upload root: ${V19_MATH_ROOT_NAME}`,
				`Evidence root: ${V19_EVIDENCE_ROOT_NAME}`,
				'',
				'The V19 math folder is byte-identical to the pinned V18 math package.',
				'This package is NOT release-ready and is NOT authorized for upload.',
				'Run exact-package browser QA, manual review and all external Stake gates separately.',
				'',
			].join('\n'),
			{ encoding: 'utf8', flag: 'wx' },
		);
		manifest.bootstrapEvidencePayload = createSelectedFileManifest(
			stagePaths.evidence,
			V19_EVIDENCE_PAYLOAD_FILES,
		);
		writeJsonExclusive(join(stagePaths.evidence, 'V19_CANDIDATE_MANIFEST.json'), manifest);

		const gitStatusBeforePromote = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
		const gitHeadBeforePromote = gitText(['rev-parse', 'HEAD']);
		if (gitStatusBeforePromote !== '' || gitHeadBeforePromote !== expectedCommit) {
			fail('Git source identity changed before V19 package promotion');
		}
		assertV19OutputsAbsent(contract);
		promoteStage(stageRoot, stagePaths, finalPaths);
		promoted = true;
		process.stdout.write(
			`${JSON.stringify(
				{
					result: 'PASS',
					lifecycle: manifest.lifecycle,
					releaseDecision: manifest.releaseDecision,
					uploadAuthorized: manifest.uploadAuthorized,
					gitSha: expectedCommit,
					frontendTreeSha256: frontendPackage.treeSha256,
					mathTreeSha256: mathPackage.treeSha256,
					outputs: manifest.outputRoots,
				},
				null,
				2,
			)}\n`,
		);
	} finally {
		if (
			stageCreated &&
			!promoted &&
			!existsSync(finalPaths.v19Frontend) &&
			!existsSync(finalPaths.v19Math) &&
			!existsSync(finalPaths.v19Evidence)
		) {
			safeRemoveStage(stageRoot);
		}
	}
}

try {
	main();
} catch (error) {
	console.error(error.stack || error);
	process.exitCode = 1;
}
