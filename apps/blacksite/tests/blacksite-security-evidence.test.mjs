import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	BLACKSITE_SECURITY_EVIDENCE_SCHEMA,
	BLACKSITE_SECURITY_POLICY,
	assessPnpmAudit,
	buildSecurityEvidence,
	extractLockPackageVersions,
} from '../../../scripts/blacksite-security-evidence.mjs';

const gitSha = '0123456789abcdef0123456789abcdef01234567';
const npmrcSource = [
	'registry = https://registry.npmjs.org/',
	'',
].join('\n');
const workspaceSource = [
	'packages:',
	'  - "apps/*"',
	'  - "packages/*"',
	'autoInstallPeers: true',
	'publicHoistPattern:',
	'  - "*storybook*"',
	'allowBuilds:',
	'  esbuild: true',
	'overrides:',
	'  devalue: "5.8.1"',
	'  "@isaacs/brace-expansion": "5.0.1"',
	'  "@sveltejs/kit": "2.57.1"',
	'  "@xmldom/xmldom": "0.8.15"',
	'  "brace-expansion@<2": "1.1.18"',
	'  "brace-expansion@>=4 <5.0.9": "5.0.9"',
	'  browserslist: "4.28.7"',
	'  flatted: "3.4.2"',
	'  glob: "12.0.0"',
	'  immutable: "5.1.8"',
	'  js-yaml: "4.3.1"',
	'  lodash: "4.18.1"',
	'  "minimatch@<4": "3.1.4"',
	'  "minimatch@>=10 <10.2.3": "10.2.5"',
	'  "nanoid@<4": "3.3.18"',
	'  "picomatch@<3": "2.3.2"',
	'  postcss: "8.5.18"',
	'  rollup: "4.59.0"',
	'  storybook: "9.1.19"',
	'  svelte: "5.45.0"',
	'  tmp: "0.2.7"',
	'  "ws@<9": "8.21.0"',
	'',
].join('\n');
const cleanAudit = JSON.stringify({
	advisories: {},
	metadata: {
		vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
		dependencies: 100,
		devDependencies: 0,
		optionalDependencies: 0,
		totalDependencies: 100,
	},
});
const belowThresholdAudit = JSON.stringify({
	advisories: {},
	metadata: {
		vulnerabilities: { info: 0, low: 1, moderate: 1, high: 0, critical: 0 },
		dependencies: 100,
		devDependencies: 0,
		optionalDependencies: 0,
		totalDependencies: 100,
	},
});

function manifest(path, value) {
	return { path, source: `${JSON.stringify(value, null, 2)}\n` };
}

function validInputs(overrides = {}) {
	return {
		expectedGitSha: gitSha,
		actualGitSha: gitSha,
		manifestInputs: [
			manifest('package.json', {
				packageManager: 'pnpm@11.25.0',
			}),
			manifest('apps/blacksite/package.json', {
				dependencies: { vite: '6.4.3' },
			}),
			manifest('packages/config-svelte/package.json', {
				dependencies: { '@sveltejs/adapter-static': '3.0.10', vite: '6.4.3' },
			}),
			manifest('packages/envs/package.json', {
				dependencies: { vite: '6.4.3' },
			}),
			manifest('packages/components-storybook/package.json', {
				devDependencies: { '@sveltejs/adapter-static': '3.0.10' },
			}),
		],
		npmrcSource,
		workspaceSource,
		effectiveAuditRegistry: 'https://registry.npmjs.org/',
		lockfileSource: [
			"lockfileVersion: '9.0'",
			'packages:',
			'  devalue@5.8.1:',
			'  vite@6.4.3:',
			'snapshots:',
			'  devalue@5.8.1: {}',
			'  vite@6.4.3(@types/node@22.0.0): {}',
			'',
		].join('\n'),
		auditReportSource: cleanAudit,
		auditExitCode: 0,
		requireAudit: true,
		generatedAt: '2026-09-03T12:00:00.000Z',
		...overrides,
	};
}

test('security policy records the cumulative Vite and devalue advisory floors', () => {
	assert.equal(BLACKSITE_SECURITY_POLICY.id, 'blacksite-dependency-security-policy-v3');
	assert.equal(BLACKSITE_SECURITY_POLICY.reviewedAt, '2026-09-04');
	assert.equal(BLACKSITE_SECURITY_POLICY.versions.vite, '6.4.3');
	assert.equal(BLACKSITE_SECURITY_POLICY.versions.devalue, '5.8.1');
	assert.equal(BLACKSITE_SECURITY_POLICY.versions.adapterStatic, '3.0.10');
	assert.equal(BLACKSITE_SECURITY_POLICY.audit.pnpmVersion, '11.25.0');
	assert.equal(BLACKSITE_SECURITY_POLICY.audit.registry, 'https://registry.npmjs.org/');
	assert.equal(
		BLACKSITE_SECURITY_POLICY.audit.workspaceSha256,
		'49ed9fc95a5202be35874cc13c802ec2f3bc1945f6b08523a4b427ad9c2e1502',
	);
	assert.deepEqual(BLACKSITE_SECURITY_POLICY.audit.allowedOrigins, ['https://registry.npmjs.org']);
	assert.deepEqual(
		BLACKSITE_SECURITY_POLICY.advisories.map(({ id }) => id),
		[
			'GHSA-p9ff-h696-f583',
			'GHSA-fx2h-pf6j-xcff',
			'GHSA-vj54-72f3-p5jv',
			'GHSA-g2pg-6438-jwpf',
			'GHSA-77vg-94rm-hx3p',
		],
	);
});

test('lock parser discovers vulnerable versions in package keys and peer suffixes', () => {
	const source = [
		'  vite@6.2.0:',
		'  vite@6.4.3:',
		'  plugin@1.0.0(vite@6.2.0):',
		'  devalue@5.1.1: {}',
	].join('\n');
	assert.deepEqual(extractLockPackageVersions(source, 'vite'), ['6.2.0', '6.4.3']);
	assert.deepEqual(extractLockPackageVersions(source, 'devalue'), ['5.1.1']);
});

test('exact-SHA evidence passes only when offline floors and required audit both pass', () => {
	const evidence = buildSecurityEvidence(validInputs());
	assert.equal(evidence.schema, BLACKSITE_SECURITY_EVIDENCE_SCHEMA);
	assert.equal(evidence.status, 'PASS');
	assert.deepEqual(evidence.identity, {
		testedGitSha: gitSha,
		expectedGitSha: gitSha,
	});
	assert.equal(evidence.generatedAt, '2026-09-03T12:00:00.000Z');
	assert.deepEqual(evidence.inputs.auditRegistry, {
		url: 'https://registry.npmjs.org/',
		origin: 'https://registry.npmjs.org',
	});
	assert.equal(evidence.inputs.npmrc.sha256, BLACKSITE_SECURITY_POLICY.audit.npmrcSha256);
	assert.equal(evidence.inputs.lockfile.sha256.length, 64);
	assert.ok(evidence.inputs.manifests.every(({ sha256 }) => sha256.length === 64));
	assert.equal(evidence.summary.fail, 0);
	assert.equal(evidence.summary.notRun, 0);
	assert.equal(
		evidence.checks.find(({ id }) => id === 'audit-registry-and-npmrc-policy').status,
		'PASS',
	);
	assert.equal(evidence.checks.find(({ id }) => id === 'production-registry-audit').status, 'PASS');
});

test('offline policy is independently testable without claiming that an audit ran', () => {
	const evidence = buildSecurityEvidence(
		validInputs({
			auditReportSource: undefined,
			auditExitCode: undefined,
			requireAudit: false,
		}),
	);
	assert.equal(evidence.status, 'INCOMPLETE');
	assert.equal(evidence.summary.notRun, 1);
	const audit = evidence.checks.find(({ id }) => id === 'production-registry-audit');
	assert.equal(audit.status, 'NOT_RUN');
	assert.match(audit.detail.reason, /no audit result is claimed/u);
});

test('pnpm 11.25 JSON omits below-threshold advisories and exits zero for them', () => {
	const audit = assessPnpmAudit({
		source: belowThresholdAudit,
		exitCode: 0,
		required: true,
		registry: 'https://registry.npmjs.org/',
	});
	assert.equal(audit.status, 'PASS');
	assert.equal(audit.vulnerabilities.total, 2);
	assert.match(audit.reason, /below the high-severity release threshold/u);
});

test('audit handling fails closed for missing, malformed, registry-error and invalid exits', () => {
	for (const audit of [
		assessPnpmAudit({ source: undefined, exitCode: 124, required: true }),
		assessPnpmAudit({ source: '', exitCode: 1, required: true }),
		assessPnpmAudit({
			source: JSON.stringify({ error: { code: 'ERR_PNPM_META_FETCH_FAIL' } }),
			exitCode: 1,
			required: true,
		}),
		assessPnpmAudit({ source: cleanAudit, exitCode: 1, required: true }),
		assessPnpmAudit({ source: belowThresholdAudit, exitCode: 1, required: true }),
		assessPnpmAudit({ source: belowThresholdAudit, exitCode: 2, required: true }),
	]) {
		assert.equal(audit.status, 'FAIL');
	}
});

test('audit handling rejects incomplete and internally inconsistent JSON reports', () => {
	const incomplete = assessPnpmAudit({
		source: JSON.stringify({
			advisories: {},
			metadata: { vulnerabilities: { high: 0, critical: 0 } },
		}),
		exitCode: 0,
		required: true,
	});
	assert.equal(incomplete.status, 'FAIL');
	assert.match(incomplete.reason, /incomplete/u);

	const inconsistent = JSON.parse(cleanAudit);
	inconsistent.metadata.vulnerabilities.high = 1;
	const assessed = assessPnpmAudit({
		source: JSON.stringify(inconsistent),
		exitCode: 1,
		required: true,
	});
	assert.equal(assessed.status, 'FAIL');
	assert.match(assessed.reason, /conflict/u);

	const unexpectedBelowThresholdDetail = JSON.parse(belowThresholdAudit);
	unexpectedBelowThresholdDetail.advisories = { 1001: { severity: 'moderate' } };
	assert.equal(
		assessPnpmAudit({
			source: JSON.stringify(unexpectedBelowThresholdDetail),
			exitCode: 0,
			required: true,
		}).status,
		'FAIL',
	);

	const contradictoryDependencies = JSON.parse(cleanAudit);
	contradictoryDependencies.metadata.totalDependencies = 99;
	assert.equal(
		assessPnpmAudit({
			source: JSON.stringify(contradictoryDependencies),
			exitCode: 0,
			required: true,
		}).status,
		'FAIL',
	);
});

test('reported or contradictory detailed high findings fail with a pnpm finding exit', () => {
	const reportedHigh = assessPnpmAudit({
		source: JSON.stringify({
			advisories: { 2001: { severity: 'high' } },
			metadata: {
				vulnerabilities: {
					info: 0,
					low: 0,
					moderate: 0,
					high: 1,
					critical: 0,
				},
				dependencies: 100,
				devDependencies: 0,
				optionalDependencies: 0,
				totalDependencies: 100,
			},
		}),
		exitCode: 1,
		required: true,
	});
	assert.equal(reportedHigh.status, 'FAIL');

	const inconsistentReport = JSON.parse(cleanAudit);
	inconsistentReport.advisories = { 1: { severity: 'critical' } };
	const inconsistentDetail = assessPnpmAudit({
		source: JSON.stringify(inconsistentReport),
		exitCode: 1,
		required: true,
	});
	assert.equal(inconsistentDetail.status, 'FAIL');
});

test('registry and project npmrc must match the pinned HTTPS allowlist and reviewed hash', () => {
	for (const input of [
		validInputs({ effectiveAuditRegistry: 'http://registry.npmjs.org/' }),
		validInputs({ effectiveAuditRegistry: 'https://registry.example/' }),
		validInputs({ npmrcSource: npmrcSource.replace('https://', 'http://') }),
		validInputs({ npmrcSource: `${npmrcSource}registry=https://registry.npmjs.org/\n` }),
	]) {
		const evidence = buildSecurityEvidence(input);
		assert.equal(
			evidence.checks.find(({ id }) => id === 'audit-registry-and-npmrc-policy').status,
			'FAIL',
		);
	}
	const credentialed = buildSecurityEvidence(
		validInputs({ effectiveAuditRegistry: 'https://user:token@registry.npmjs.org/' }),
	);
	assert.equal(JSON.stringify(credentialed).includes('token'), false);
});

test('the committed npmrc content is the exact reviewed registry policy input', async () => {
	const source = await readFile(new URL('../../../.npmrc', import.meta.url), 'utf8');
	assert.equal(source, npmrcSource);
	assert.equal(
		createHash('sha256').update(source).digest('hex'),
		BLACKSITE_SECURITY_POLICY.audit.npmrcSha256,
	);
});

test('the committed workspace config is the exact pnpm 11 policy input', async () => {
	const source = await readFile(new URL('../../../pnpm-workspace.yaml', import.meta.url), 'utf8');
	assert.equal(source, workspaceSource);
	assert.equal(
		createHash('sha256').update(source).digest('hex'),
		BLACKSITE_SECURITY_POLICY.audit.workspaceSha256,
	);
});

test('the package manifest and both release workflows pin the reviewed pnpm version', async () => {
	const [manifestSource, blacksiteWorkflow, stakeWorkflow] = await Promise.all([
		readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
		readFile(new URL('../../../.github/workflows/blacksite-ci.yml', import.meta.url), 'utf8'),
		readFile(new URL('../../../.github/workflows/stake-compliance-ci.yml', import.meta.url), 'utf8'),
	]);
	assert.equal(JSON.parse(manifestSource).packageManager, 'pnpm@11.25.0');
	assert.match(blacksiteWorkflow, /version: 11\.25\.0/u);
	assert.match(stakeWorkflow, /version: 11\.25\.0/u);
});

test('wrong SHA and vulnerable Vite or devalue inputs each fail their exact checks', () => {
	const wrongSha = buildSecurityEvidence(validInputs({ actualGitSha: 'f'.repeat(40) }));
	assert.equal(wrongSha.status, 'FAIL');
	assert.equal(wrongSha.checks.find(({ id }) => id === 'exact-git-identity').status, 'FAIL');

	const vulnerableManifests = validInputs();
	vulnerableManifests.manifestInputs[0] = manifest('package.json', {
		packageManager: 'pnpm@11.25.0',
	});
	vulnerableManifests.workspaceSource = workspaceSource.replace('5.8.1', '5.1.1');
	vulnerableManifests.manifestInputs[1] = manifest('apps/blacksite/package.json', {
		dependencies: { vite: '6.2.0' },
	});
	vulnerableManifests.lockfileSource = [
		"lockfileVersion: '9.0'",
		'  vite@6.2.0:',
		'  devalue@5.1.1:',
	].join('\n');
	const evidence = buildSecurityEvidence(vulnerableManifests);
	for (const id of [
		'vite-exact-manifest-pin',
		'devalue-exact-override',
		'vite-lockfile-floor',
		'devalue-lockfile-floor',
	]) {
		assert.equal(evidence.checks.find((entry) => entry.id === id).status, 'FAIL', id);
	}
});

test('every adapter-static declaration must use the exact reviewed pin', () => {
	const inputs = validInputs();
	inputs.manifestInputs.push(
		manifest('packages/another-storybook/package.json', {
			devDependencies: { '@sveltejs/adapter-static': 'latest' },
		}),
	);
	const evidence = buildSecurityEvidence(inputs);
	assert.equal(evidence.checks.find(({ id }) => id === 'adapter-static-exact-pin').status, 'FAIL');
});

test('CI retains raw audit and normalized exact-SHA security evidence and requires both', async () => {
	const workflow = await readFile(
		new URL('../../../.github/workflows/blacksite-ci.yml', import.meta.url),
		'utf8',
	);
	assert.match(workflow, /for audit_attempt in 1 2 3; do/u);
	assert.match(workflow, /: > "\$audit_report"/u);
	assert.match(workflow, /timeout --signal=TERM --kill-after=30s 300s/u);
	assert.match(workflow, /version: 11\.25\.0/u);
	assert.match(workflow, /pnpm audit --prod --audit-level high --json/u);
	assert.match(workflow, /printf 'attempt=%s exit_code=%s\\n'/u);
	assert.match(workflow, /\[\[ "\$audit_exit_code" =~ \^\[01\]\$ \]\]/u);
	assert.match(workflow, /JSON\.parse\(fs\.readFileSync\(process\.argv\[1\], "utf8"\)\)/u);
	assert.match(workflow, /Array\.isArray\(report\) \|\| report\.error/u);
	assert.match(workflow, /if \[\[ "\$audit_attempt" -lt 3 \]\]; then/u);
	assert.match(workflow, /BLACKSITE_AUDIT_REGISTRY: https:\/\/registry\.npmjs\.org\//u);
	assert.match(workflow, /configured_audit_registry="\$\(pnpm config get registry\)"/u);
	assert.match(workflow, /--registry "\$configured_audit_registry"/u);
	assert.match(workflow, /--audit-registry "\$configured_audit_registry"/u);
	assert.match(workflow, /--expected-commit "\$EXPECTED_SHA"/u);
	assert.match(workflow, /--audit-exit-code "\$audit_exit_code"/u);
	assert.match(workflow, /--require-audit/u);
	assert.match(
		workflow,
		/for audit_attempt in 1 2 3; do[\s\S]*?\n\s+done\n\s+node scripts\/blacksite-security-evidence\.mjs/u,
	);
	assert.match(workflow, /artifacts\/blacksite-security\/pnpm-audit\.json/u);
	assert.match(workflow, /artifacts\/blacksite-security\/security-evidence\.json/u);
	const stagingStart = workflow.indexOf('      - name: Stage only current-run artifacts');
	const uploadStart = workflow.indexOf('      - name: Upload BlackSite diagnostics');
	assert.ok(
		stagingStart >= 0 && uploadStart > stagingStart,
		'missing bounded artifact staging step',
	);
	const stagingStep = workflow.slice(stagingStart, uploadStart);
	assert.match(stagingStep, /if \[\[ -d artifacts\/blacksite-security \]\]; then/u);
	assert.match(
		stagingStep,
		/mkdir -p "\$\{BLACKSITE_UPLOAD_ROOT\}\/artifacts\/blacksite-security"/u,
	);
	for (const retainedSecurityArtifact of [
		'artifacts/blacksite-security/pnpm-audit.json',
		'artifacts/blacksite-security/pnpm-audit.stderr.txt',
		'artifacts/blacksite-security/security-evidence.json',
	]) {
		assert.ok(
			stagingStep.includes(retainedSecurityArtifact),
			`missing staged security artifact: ${retainedSecurityArtifact}`,
		);
	}
	assert.match(
		stagingStep,
		/cp "\$source" "\$\{BLACKSITE_UPLOAD_ROOT\}\/artifacts\/blacksite-security\/"/u,
	);
	assert.match(workflow, /BLACKSITE_UPLOAD_ROOT: blacksite-upload-\$\{\{ github\.sha \}\}/u);
	assert.match(
		workflow,
		/test "\$BLACKSITE_UPLOAD_ROOT" = "blacksite-upload-\$\{EXPECTED_SHA\}"/u,
	);
	assert.doesNotMatch(workflow, /BLACKSITE_UPLOAD_ROOT=%s/u);
	assert.match(workflow, /path: \$\{\{ env\.BLACKSITE_UPLOAD_ROOT \}\}\/\*\*/u);
	assert.doesNotMatch(workflow, /^\s+artifacts\/blacksite-qa\/\*\*$/mu);
	const pullRequestTrigger = workflow.slice(
		workflow.indexOf('  pull_request:'),
		workflow.indexOf('  workflow_dispatch:'),
	);
	assert.doesNotMatch(pullRequestTrigger, /^\s+paths:/mu);
});
