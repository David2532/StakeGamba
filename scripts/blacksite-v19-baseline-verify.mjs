import {
	OUTPUTS_ROOT,
	REPO_ROOT,
	V19_EVIDENCE_ROOT_NAME,
	V19_FRONTEND_ROOT_NAME,
	V19_MATH_ROOT_NAME,
	gitText,
	loadContract,
	verifyV18Baseline,
} from './blacksite-v19-package-contract.mjs';

function main() {
	const contract = loadContract();
	const baseline = verifyV18Baseline(contract);
	process.stdout.write(
		`${JSON.stringify(
			{
				result: 'PASS',
				schema: 'blacksite-v19-baseline-verification-v1',
				lifecycle: contract.lifecycle,
				repositoryRoot: REPO_ROOT,
				outputsRoot: OUTPUTS_ROOT,
				currentGitSha: gitText(['rev-parse', 'HEAD']),
				v18Baseline: baseline,
				v19OutputNames: [
					V19_FRONTEND_ROOT_NAME,
					V19_MATH_ROOT_NAME,
					V19_EVIDENCE_ROOT_NAME,
				],
				frontendAcceptance: contract.frontendAcceptance,
				mathAcceptance: contract.mathAcceptance,
				releaseTruth: contract.releaseTruth,
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
