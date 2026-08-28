import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	CONTRACT_PATH,
	OUTPUTS_ROOT,
	V18_COMMIT,
	V18_FRONTEND_TREE,
	V19_EVIDENCE_ROOT_NAME,
	V19_EVIDENCE_PAYLOAD_FILES,
	V19_FRONTEND_ROOT_NAME,
	V19_MATH_ROOT_NAME,
	assertManifestSummary,
	createFileManifest,
	createFileManifestExcluding,
	createSelectedFileManifest,
	extensionCounts,
	fail,
	fileFact,
	gitCommitExists,
	gitIsAncestor,
	gitText,
	loadContract,
	outputPaths,
	readJson,
	releaseGateEvidence,
	verifyV18Baseline,
	writeJsonExclusive,
} from './blacksite-v19-package-contract.mjs';

const EVIDENCE_FILES = Object.freeze([
	...V19_EVIDENCE_PAYLOAD_FILES,
	'V19_CANDIDATE_MANIFEST.json',
]);
const VERIFY_RESULT_NAME = 'V19_PACKAGE_VERIFY_RESULT.json';

function assertExactObject(actual, expected, context) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${context} mismatch`);
}

function assertFrontendRootShape(frontendRoot) {
	const topLevel = readdirSync(frontendRoot).sort();
	if (JSON.stringify(topLevel) !== JSON.stringify(['_app', 'assets', 'index.html'])) {
		fail(`Unexpected V19 frontend root entries: ${topLevel.join(', ')}`);
	}
}

function assertEvidenceRootShape(evidenceRoot) {
	const actual = readdirSync(evidenceRoot).sort();
	const missing = EVIDENCE_FILES.filter((name) => !actual.includes(name));
	if (missing.length > 0) fail(`V19 evidence root is missing: ${missing.join(', ')}`);
}

function main() {
	const contract = loadContract();
	const paths = outputPaths(contract);
	for (const requiredPath of [
		paths.v19Frontend,
		join(paths.v19Frontend, 'index.html'),
		paths.v19Math,
		paths.v19Evidence,
		join(paths.v19Evidence, 'V19_CANDIDATE_MANIFEST.json'),
	]) {
		if (!existsSync(requiredPath)) fail(`Missing exact V19 package path: ${requiredPath}`);
	}
	assertFrontendRootShape(paths.v19Frontend);
	assertEvidenceRootShape(paths.v19Evidence);

	const manifest = readJson(join(paths.v19Evidence, 'V19_CANDIDATE_MANIFEST.json'));
	if (
		manifest.schema !== 'blacksite-v19-technical-candidate-v1' ||
		manifest.version !== 19 ||
		manifest.lifecycle !== 'V19_TECHNICAL_CANDIDATE_NOT_RELEASE' ||
		manifest.releaseDecision !== 'BLOCKED' ||
		manifest.releaseReady !== false ||
		manifest.uploadAuthorized !== false
	) {
		fail('V19 manifest must remain a blocked, unauthorized technical candidate');
	}
	assertExactObject(
		manifest.contract,
		{ path: 'docs/blacksite/V19_PACKAGE_CONTRACT.json', ...fileFact(CONTRACT_PATH) },
		'V19 package contract identity',
	);
	if (
		manifest.git?.dirty !== false ||
		manifest.git?.cleanBefore !== true ||
		manifest.git?.cleanAfter !== true ||
		manifest.git?.sha !== manifest.git?.expectedSha ||
		manifest.git?.v18BaselineSha !== V18_COMMIT ||
		manifest.git?.v18IsAncestor !== true ||
		manifest.git?.sha === V18_COMMIT ||
		!gitCommitExists(manifest.git?.sha) ||
		!gitIsAncestor(V18_COMMIT, manifest.git.sha)
	) {
		fail('V19 manifest source identity is not a clean descendant of the pinned V18 commit');
	}
	if (gitText(['rev-parse', 'HEAD']) !== manifest.git.sha) {
		fail('Current checkout does not match the exact packaged V19 commit');
	}
	const gitStatus = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
	if (gitStatus !== '') fail(`Current checkout must be clean for exact V19 verification:\n${gitStatus}`);
	assertExactObject(
		manifest.outputRoots,
		{
			parent: OUTPUTS_ROOT,
			frontend: V19_FRONTEND_ROOT_NAME,
			math: V19_MATH_ROOT_NAME,
			evidence: V19_EVIDENCE_ROOT_NAME,
		},
		'V19 output-root identity',
	);

	const baseline = verifyV18Baseline(contract);
	assertExactObject(manifest.v18Baseline, baseline, 'Pinned V18 baseline evidence');
	const baselineFile = readJson(join(paths.v19Evidence, 'V18_BASELINE_VERIFY.json'));
	if (baselineFile.schema !== 'blacksite-v19-v18-baseline-evidence-v1' || baselineFile.result !== 'PASS') {
		fail('V18 baseline evidence must be PASS');
	}
	const baselineBody = { ...baselineFile };
	delete baselineBody.schema;
	delete baselineBody.result;
	delete baselineBody.verifiedAt;
	assertExactObject(baselineBody, baseline, 'Stored V18 baseline evidence');

	const frontend = createFileManifest(paths.v19Frontend);
	const math = createFileManifest(paths.v19Math);
	assertExactObject(frontend, manifest.packages?.frontend, 'V19 frontend package');
	assertExactObject(math, manifest.packages?.math, 'V19 math package');
	assertManifestSummary(math, contract.v18Baseline.math, 'V19 math vs V18');
	assertExactObject(math.files, contract.v18Baseline.math.files, 'V19 math byte identity');
	if (frontend.treeSha256 === V18_FRONTEND_TREE) {
		fail('V19 frontend is the unchanged V18 tree');
	}

	const frontendAcceptance = readJson(
		join(paths.v19Evidence, 'V19_FRONTEND_BUILD_ACCEPTANCE.json'),
	);
	if (
		frontendAcceptance.schema !== 'blacksite-v19-frontend-build-acceptance-v1' ||
		frontendAcceptance.status !== 'CALLER_PIN_MATCHED' ||
		frontendAcceptance.gitSha !== manifest.git.sha ||
		frontendAcceptance.treeSha256 !== frontend.treeSha256 ||
		frontendAcceptance.fileCount !== frontend.fileCount ||
		frontendAcceptance.totalBytes !== frontend.totalBytes ||
		frontendAcceptance.v18TreeRejected !== true ||
		frontendAcceptance.manualVisualApproval !== 'NOT_CLAIMED'
	) {
		fail('V19 frontend acceptance is not bound to the exact packaged tree');
	}
	assertExactObject(
		frontendAcceptance.extensionCounts,
		extensionCounts(frontend),
		'V19 frontend extension counts',
	);
	assertExactObject(manifest.frontendAcceptance, frontendAcceptance, 'Manifest frontend acceptance');
	if (
		manifest.mathAcceptance?.status !== 'PASS_BYTE_IDENTICAL_TO_V18' ||
		manifest.mathAcceptance?.treeSha256 !== math.treeSha256 ||
		manifest.mathAcceptance?.v18TreeSha256 !== contract.v18Baseline.math.treeSha256 ||
		manifest.mathAcceptance?.fileCount !== math.fileCount ||
		manifest.mathAcceptance?.totalBytes !== math.totalBytes
	) {
		fail('V19 manifest math acceptance is not byte-identical to V18');
	}

	const expectedReleaseGates = releaseGateEvidence(contract);
	const releaseGates = readJson(join(paths.v19Evidence, 'V19_RELEASE_GATES.json'));
	assertExactObject(releaseGates, expectedReleaseGates, 'V19 release gate truth');
	assertExactObject(manifest.releaseGates, expectedReleaseGates, 'Manifest release gate truth');
	const bootstrapEvidencePayload = createSelectedFileManifest(
		paths.v19Evidence,
		V19_EVIDENCE_PAYLOAD_FILES,
	);
	assertExactObject(
		manifest.bootstrapEvidencePayload,
		bootstrapEvidencePayload,
		'V19 bootstrap evidence payload identity',
	);
	const evidenceBundleBeforeVerificationResult = createFileManifestExcluding(paths.v19Evidence, [
		VERIFY_RESULT_NAME,
	]);

	const result = {
		schema: 'blacksite-v19-technical-package-verification-v1',
		result: 'PASS_PACKAGE_IDENTITY_ONLY',
		verifiedAt: new Date().toISOString(),
		lifecycle: manifest.lifecycle,
		releaseDecision: 'BLOCKED',
		releaseReady: false,
		uploadAuthorized: false,
		gitSha: manifest.git.sha,
		candidateManifest: fileFact(join(paths.v19Evidence, 'V19_CANDIDATE_MANIFEST.json')),
		contract: fileFact(CONTRACT_PATH),
		frontend: {
			...manifest.packages.frontend,
			extensionCounts: extensionCounts(frontend),
		},
		math: manifest.packages.math,
		bootstrapEvidencePayload,
		evidenceBundleBeforeVerificationResult,
		claims: {
			v18BaselineIdentity: 'PASS',
			v19FrontendCallerPinnedTree: 'PASS',
			v19MathByteIdenticalToV18: 'PASS',
			exactOutputFolderNames: 'PASS',
			extractedBrowserQa: 'NOT_RUN',
			manualReview: 'NOT_CLAIMED',
			externalApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	};
	const existingResultPath = join(paths.v19Evidence, VERIFY_RESULT_NAME);
	if (existsSync(existingResultPath) && !process.argv.includes('--write-result')) {
		const existingResult = readJson(existingResultPath);
		const existingStable = { ...existingResult };
		const currentStable = { ...result };
		delete existingStable.verifiedAt;
		delete currentStable.verifiedAt;
		assertExactObject(existingStable, currentStable, 'Existing V19 verification result');
	}
	if (process.argv.includes('--write-result')) {
		if (existsSync(existingResultPath)) {
			fail(`Verification result already exists; refusing overwrite: ${existingResultPath}`);
		}
		writeJsonExclusive(existingResultPath, result);
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				result: result.result,
				lifecycle: result.lifecycle,
				releaseDecision: result.releaseDecision,
				uploadAuthorized: result.uploadAuthorized,
				gitSha: result.gitSha,
				frontendTreeSha256: frontend.treeSha256,
				mathTreeSha256: math.treeSha256,
				claims: result.claims,
			},
			null,
			2,
		)}\n`,
	);
}

try {
	main();
} catch (error) {
	console.error(error.stack || error);
	process.exitCode = 1;
}
