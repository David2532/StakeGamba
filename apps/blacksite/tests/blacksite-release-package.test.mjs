import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageScriptUrl = new URL(
	'../../../scripts/blacksite-package-candidate.mjs',
	import.meta.url,
);
const verifyScriptUrl = new URL('../../../scripts/blacksite-package-verify.mjs', import.meta.url);
const workflowUrl = new URL('../../../.github/workflows/blacksite-ci.yml', import.meta.url);
const buildScriptUrl = new URL('../scripts/build-production.mjs', import.meta.url);
const svelteConfigUrl = new URL('../svelte.config.js', import.meta.url);
const packageJsonUrl = new URL('../package.json', import.meta.url);
const recoveryMetadataUrl = new URL('../build/_app/version.json', import.meta.url);
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const packageScriptPath = fileURLToPath(packageScriptUrl);
const verifyScriptPath = fileURLToPath(verifyScriptUrl);

function runCli(script, arguments_, environment = process.env) {
	return spawnSync(process.execPath, [script, ...arguments_], {
		cwd: repoRoot,
		encoding: 'utf8',
		env: environment,
	});
}

test('CI packages, verifies and browser-tests the exact extracted BlackSite frontend', async () => {
	const [packageScript, verifyScript, workflow, buildScript, svelteConfig, packageJson] =
		await Promise.all([
			readFile(packageScriptUrl, 'utf8'),
			readFile(verifyScriptUrl, 'utf8'),
			readFile(workflowUrl, 'utf8'),
			readFile(buildScriptUrl, 'utf8'),
			readFile(svelteConfigUrl, 'utf8'),
			readFile(packageJsonUrl, 'utf8').then(JSON.parse),
		]);

	assert.match(packageScript, /--print-frontend-tree-sha256/u);
	assert.match(packageScript, /createFileManifest\(frontendSource\)\.treeSha256/u);
	assert.match(
		packageScript,
		/validateFrontendBuildIdentity\(gitSha, gitTreeSha, gitStatusBefore === ''\)/u,
	);
	assert.match(packageScript, /blacksite-frontend-build-identity-v1/u);
	assert.match(packageScript, /requiredArgument\('--expected-branch'\)/u);
	assert.match(packageScript, /branch: expectedBranch/u);
	assert.match(packageScript, /recoveryMetadata\.version !== expectedGitSha/u);
	assert.match(verifyScript, /requiredArgument\('--expected-branch'\)/u);
	assert.match(verifyScript, /branch: expectedBranch/u);
	assert.match(verifyScript, /recoveryMetadata\.version !== expectedGitSha/u);
	assert.match(buildScript, /rmSync\(buildRoot, \{ recursive: true, force: true \}\)/u);
	assert.match(buildScript, /pruneBlacksiteInlineBuildResidue\(buildRoot\)/u);
	assert.match(buildScript, /blacksite-build-identity\.json/u);
	assert.match(buildScript, /gitText\(\['rev-parse', 'HEAD\^\{tree\}'\]\)/u);
	assert.match(buildScript, /BLACKSITE_BUILD_GIT_SHA: gitSha/u);
	assert.match(buildScript, /recoveryMetadata\.version !== gitSha/u);
	assert.match(svelteConfig, /name: gitSha/u);
	assert.match(svelteConfig, /expectedGitSha !== undefined && expectedGitSha !== gitSha/u);
	assert.equal(packageJson.scripts.build, 'node scripts/build-production.mjs');
	assert.match(packageJson.scripts['qa:e2e'], /pnpm run build/u);
	assert.doesNotMatch(
		packageScript,
		/final production assets, animation and audio are not present/u,
	);
	assert.match(verifyScript, /JSON\.stringify\(\['_app', 'assets', 'index\.html'\]\)/u);
	assert.match(verifyScript, /verifyBlacksiteFrontendHygiene/u);
	assert.match(verifyScript, /assertPhysicalPackageDirectory/u);
	assert.match(verifyScript, /'Candidate package root'/u);
	assert.match(verifyScript, /'Candidate frontend root'/u);
	assert.match(verifyScript, /'Candidate math root'/u);
	assert.match(verifyScript, /validatePackagedFrontendBuildIdentity/u);
	assert.match(verifyScript, /currentGitTreeSha/u);
	assert.match(verifyScript, /JSON\.stringify\(manifest\.game\)/u);
	assert.match(verifyScript, /JSON\.stringify\(manifest\.mathEvidence\)/u);
	assert.match(verifyScript, /expectedReadme/u);
	assert.match(verifyScript, /JSON\.stringify\(manifest\.frontendEvidence\)/u);
	assert.match(packageScript, /frontendEvidence: \{/u);
	assert.match(packageScript, /assetManifest: fileFact\(assetManifestSource\)/u);

	const packageStep = workflow.indexOf('Generate and verify isolated BlackSite package');
	const browserStep = workflow.indexOf('Test exact extracted frontend in Chromium');
	const complianceStep = workflow.indexOf('Resolve exact 51-point candidate evidence');
	const releaseBundleStep = workflow.indexOf('Generate deterministic release evidence bundle');
	const stageStep = workflow.indexOf('Stage current run artifacts');
	assert(packageStep > 0);
	assert(browserStep > packageStep);
	assert(complianceStep > browserStep);
	assert(releaseBundleStep > complianceStep);
	assert(stageStep > releaseBundleStep);
	assert.match(
		workflow,
		/EXPECTED_BRANCH: \$\{\{ github\.event\.pull_request\.head\.ref \|\| github\.ref_name \}\}/u,
	);
	assert.match(workflow, /--expected-branch "\$EXPECTED_BRANCH"/u);
	assert.match(workflow, /--expected-commit "\$EXPECTED_SHA"/u);
	assert.match(workflow, /--expected-frontend-tree "\$frontend_tree"/u);
	assert.match(workflow, /blacksite-package-verify\.mjs[\s\S]*--write-result/u);
	assert.match(workflow, /> "\$\{RUNNER_TEMP\}\/blacksite-ci\/identity\.txt"/u);
	assert.match(
		workflow,
		/cp "\$\{RUNNER_TEMP\}\/blacksite-ci\/identity\.txt"[\s\\]+"\$\{blacksite_upload_root\}\/artifacts\/blacksite-ci\//u,
	);
	assert.match(workflow, /BLACKSITE_QA_BUILD_ROOT="\$\{BLACKSITE_CANDIDATE_ROOT\}\/frontend"/u);
	assert.match(
		workflow,
		/BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256="\$\{BLACKSITE_FRONTEND_TREE_SHA256\}"/u,
	);
	assert.match(workflow, /blacksite-package\/blacksite-candidate-\$\{GITHUB_SHA\}/u);
	assert.match(workflow, /value\.identity\?\.testedGitSha/u);
	assert.match(workflow, /if \[\[ "\$tested_sha" = "\$EXPECTED_SHA" \]\]/u);
	assert.match(workflow, /test "\$\{#browser_evidence\[@\]\}" -eq 1/u);
	assert.match(workflow, /blacksite-compliance-evidence\.mjs/u);
	assert.match(workflow, /blacksite-release-bundle\.mjs/u);
	assert.match(workflow, /--ci-run-id "\$GITHUB_RUN_ID"/u);
	assert.match(workflow, /--output "\$\{blacksite_upload_root\}\/release-bundle"/u);
	assert.match(workflow, /blacksite-upload-\$\{\{ github\.sha \}\}\/\*\*/u);
	assert.doesNotMatch(workflow, /path:\s+artifacts\//u);
});

test('candidate package CLIs fail closed without the pinned source branch', () => {
	const missingCandidateBranch = runCli(packageScriptPath, [
		'--output',
		join(tmpdir(), 'blacksite-missing-branch-candidate'),
		'--expected-commit',
		'0'.repeat(40),
		'--expected-frontend-tree',
		'0'.repeat(64),
	]);
	assert.notEqual(missingCandidateBranch.status, 0);
	assert.match(missingCandidateBranch.stderr, /Missing required argument --expected-branch/u);

	const missingVerifierBranch = runCli(verifyScriptPath, [
		'--candidate',
		join(tmpdir(), 'blacksite-missing-branch-verifier'),
	]);
	assert.notEqual(missingVerifierBranch.status, 0);
	assert.match(missingVerifierBranch.stderr, /Missing required argument --expected-branch/u);
});

test('candidate package CLIs reject a caller branch that contradicts CI checkout identity', () => {
	const environment = {
		...process.env,
		GITHUB_HEAD_REF: 'codex/blacksite-aaa-studio',
		GITHUB_REF: '',
	};
	const wrongCandidateBranch = runCli(
		packageScriptPath,
		[
			'--output',
			join(tmpdir(), 'blacksite-wrong-branch-candidate'),
			'--expected-branch',
			'codex/not-the-checked-out-branch',
			'--expected-commit',
			'0'.repeat(40),
			'--expected-frontend-tree',
			'0'.repeat(64),
		],
		environment,
	);
	assert.notEqual(wrongCandidateBranch.status, 0);
	assert.match(wrongCandidateBranch.stderr, /does not match --expected-branch/u);

	const wrongVerifierBranch = runCli(
		verifyScriptPath,
		[
			'--candidate',
			join(tmpdir(), 'blacksite-wrong-branch-verifier'),
			'--expected-branch',
			'codex/not-the-checked-out-branch',
		],
		environment,
	);
	assert.notEqual(wrongVerifierBranch.status, 0);
	assert.match(wrongVerifierBranch.stderr, /does not match --expected-branch/u);
});

test(
	'production frontend builds are byte-identical at one Git SHA',
	{ timeout: 30_000 },
	async () => {
		const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
		const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repoRoot,
			encoding: 'utf8',
		}).trim();
		const build = async () => {
			execFileSync(pnpmCommand, ['--filter', 'blacksite', 'build'], {
				cwd: repoRoot,
				stdio: ['ignore', 'pipe', 'pipe'],
				maxBuffer: 20 * 1024 * 1024,
			});
			const version = JSON.parse(await readFile(recoveryMetadataUrl, 'utf8')).version;
			const treeSha256 = execFileSync(
				process.execPath,
				[packageScriptPath, '--print-frontend-tree-sha256'],
				{ cwd: repoRoot, encoding: 'utf8' },
			).trim();
			return { version, treeSha256 };
		};

		const first = await build();
		const second = await build();
		assert.equal(first.version, gitSha);
		assert.equal(second.version, gitSha);
		assert.match(first.treeSha256, /^[0-9a-f]{64}$/u);
		assert.equal(second.treeSha256, first.treeSha256);
	},
);
