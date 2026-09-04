import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = resolve(dirname(scriptPath), '..');

export const BLACKSITE_SECURITY_EVIDENCE_SCHEMA = 'blacksite-security-evidence-v3';
export const BLACKSITE_SECURITY_POLICY = Object.freeze({
	id: 'blacksite-dependency-security-policy-v3',
	reviewedAt: '2026-09-04',
	audit: Object.freeze({
		pnpmVersion: '11.25.0',
		level: 'high',
		registry: 'https://registry.npmjs.org/',
		allowedOrigins: Object.freeze(['https://registry.npmjs.org']),
		npmrcSha256: '52860f9b45d3e516986ecb81ffbf853f5e3f9bee82666148e37df24691e693de',
		workspaceSha256: 'e346af4998c89c048140e06a80876885085fde0d17979e397ffa58dfe919a9fa',
	}),
	versions: Object.freeze({
		vite: '6.4.3',
		devalue: '5.8.1',
		adapterStatic: '3.0.10',
	}),
	advisories: Object.freeze([
		Object.freeze({
			id: 'GHSA-p9ff-h696-f583',
			package: 'vite',
			policyFloorContribution: 'Vite 6.4.2',
			url: 'https://github.com/advisories/GHSA-p9ff-h696-f583',
		}),
		Object.freeze({
			id: 'GHSA-fx2h-pf6j-xcff',
			package: 'vite',
			policyFloorContribution: 'Vite 6.4.3',
			url: 'https://github.com/advisories/GHSA-fx2h-pf6j-xcff',
		}),
		Object.freeze({
			id: 'GHSA-vj54-72f3-p5jv',
			package: 'devalue',
			policyFloorContribution: 'devalue 5.3.2',
			url: 'https://github.com/advisories/GHSA-vj54-72f3-p5jv',
		}),
		Object.freeze({
			id: 'GHSA-g2pg-6438-jwpf',
			package: 'devalue',
			policyFloorContribution: 'devalue 5.6.2',
			url: 'https://github.com/advisories/GHSA-g2pg-6438-jwpf',
		}),
		Object.freeze({
			id: 'GHSA-77vg-94rm-hx3p',
			package: 'devalue',
			policyFloorContribution: 'devalue 5.8.1',
			url: 'https://github.com/advisories/GHSA-77vg-94rm-hx3p',
		}),
	]),
});

const dependencySections = Object.freeze([
	'dependencies',
	'devDependencies',
	'optionalDependencies',
	'peerDependencies',
]);
const ignoredDirectories = new Set([
	'.git',
	'.svelte-kit',
	'.turbo',
	'build',
	'dist',
	'node_modules',
]);
const auditSeverities = Object.freeze(['info', 'low', 'moderate', 'high', 'critical']);
const auditDependencyCounts = Object.freeze([
	'dependencies',
	'devDependencies',
	'optionalDependencies',
	'totalDependencies',
]);

function sha256(source) {
	return createHash('sha256').update(source).digest('hex');
}

function portablePath(root, path) {
	return relative(root, path).split(sep).join('/');
}

function check(id, status, detail) {
	return { id, status, detail };
}

function isExactSha(value) {
	return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
	return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(version, floor) {
	const actual = parseVersion(version);
	const minimum = parseVersion(floor);
	if (!actual || !minimum) return false;
	for (let index = 0; index < minimum.length; index += 1) {
		if (actual[index] > minimum[index]) return true;
		if (actual[index] < minimum[index]) return false;
	}
	return true;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function extractLockPackageVersions(lockfileSource, packageName) {
	const escapedName = escapeRegExp(packageName);
	const pattern = new RegExp(`(?:^\\s+|[(/])${escapedName}@(\\d+\\.\\d+\\.\\d+)(?=[:(])`, 'gmu');
	return [...new Set([...lockfileSource.matchAll(pattern)].map((match) => match[1]))].sort();
}

function isPlainObject(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function countDetailedFindings(advisories) {
	const counts = Object.fromEntries(auditSeverities.map((severity) => [severity, 0]));
	for (const finding of Object.values(advisories)) {
		if (!isPlainObject(finding) || !auditSeverities.includes(finding.severity)) return null;
		counts[finding.severity] += 1;
	}
	return counts;
}

function npmrcRegistryDeclarations(source) {
	if (typeof source !== 'string') return [];
	return source
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#') && !line.startsWith(';'))
		.map((line) => {
			const separator = line.indexOf('=');
			if (separator < 0) return null;
			return {
				key: line.slice(0, separator).trim().toLowerCase(),
				value: line.slice(separator + 1).trim(),
			};
		})
		.filter((entry) => entry?.key === 'registry')
		.map(({ value }) => value);
}

function safeRegistryUrl(value) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
			return null;
		}
		return url;
	} catch {
		return null;
	}
}

export function assessPnpmAudit({ source, exitCode, required, registry = null }) {
	const command = registry
		? `pnpm audit --prod --audit-level high --json --registry ${registry}`
		: 'pnpm audit --prod --audit-level high --json';
	if (source === undefined || source === null) {
		return {
			status: required ? 'FAIL' : 'NOT_RUN',
			command,
			exitCode: exitCode ?? null,
			reportSha256: null,
			vulnerabilities: null,
			reason: required
				? 'A machine-readable production audit report is required.'
				: 'Registry audit was not requested; no audit result is claimed.',
		};
	}

	const reportSha256 = sha256(source);
	let report;
	try {
		report = JSON.parse(source);
	} catch (error) {
		return {
			status: 'FAIL',
			command,
			exitCode: exitCode ?? null,
			reportSha256,
			vulnerabilities: null,
			reason: `Audit report is not valid JSON: ${error.message}`,
		};
	}

	if (!isPlainObject(report)) {
		return {
			status: 'FAIL',
			command,
			exitCode: exitCode ?? null,
			reportSha256,
			vulnerabilities: null,
			reason: 'Audit report must be a JSON object.',
		};
	}
	if (report.error) {
		return {
			status: 'FAIL',
			command,
			exitCode: exitCode ?? null,
			reportSha256,
			vulnerabilities: null,
			reason: 'The package registry returned an audit error.',
		};
	}

	const vulnerabilities = report.metadata?.vulnerabilities;
	const countsComplete =
		isPlainObject(vulnerabilities) &&
		Object.keys(vulnerabilities).length === auditSeverities.length &&
		auditSeverities.every(
			(severity) =>
				Object.hasOwn(vulnerabilities, severity) &&
				Number.isSafeInteger(vulnerabilities[severity]) &&
				vulnerabilities[severity] >= 0,
		);
	const dependencyCountsComplete =
		isPlainObject(report.metadata) &&
		auditDependencyCounts.every(
			(key) =>
				Object.hasOwn(report.metadata, key) &&
				Number.isSafeInteger(report.metadata[key]) &&
				report.metadata[key] >= 0,
		);
	if (
		!isPlainObject(report.advisories) ||
		!countsComplete ||
		!dependencyCountsComplete
	) {
		return {
			status: 'FAIL',
			command,
			exitCode: exitCode ?? null,
			reportSha256,
			vulnerabilities: null,
			reason:
				'Audit report is incomplete; pnpm 11.25 advisories, dependency metadata and every vulnerability count are required.',
		};
	}

	const severityTotal = auditSeverities.reduce(
		(total, severity) => total + vulnerabilities[severity],
		0,
	);
	const dependencyTotal =
		report.metadata.dependencies +
		report.metadata.devDependencies +
		report.metadata.optionalDependencies;
	const normalizedCounts = {
		...Object.fromEntries(auditSeverities.map((severity) => [severity, vulnerabilities[severity]])),
		total: severityTotal,
	};
	const detailedCounts = countDetailedFindings(report.advisories);
	const reportedAuditSeverities = Object.values(report.advisories).map(
		(finding) => finding?.severity,
	);
	const blockingFindingTotal = vulnerabilities.high + vulnerabilities.critical;
	const countsConsistent =
		Number.isSafeInteger(severityTotal) &&
		Number.isSafeInteger(dependencyTotal) &&
		dependencyTotal === report.metadata.totalDependencies &&
		Boolean(detailedCounts) &&
		reportedAuditSeverities.every((severity) => severity === 'high' || severity === 'critical') &&
		detailedCounts.high === vulnerabilities.high &&
		detailedCounts.critical === vulnerabilities.critical;
	const exitSemanticsValid =
		(blockingFindingTotal === 0 && exitCode === 0) ||
		(blockingFindingTotal > 0 && exitCode === 1);
	const noReleaseBlockingFinding = blockingFindingTotal === 0;
	const passed = countsConsistent && exitSemanticsValid && noReleaseBlockingFinding;

	return {
		status: passed ? 'PASS' : 'FAIL',
		command,
		exitCode: exitCode ?? null,
		reportSha256,
		vulnerabilities: normalizedCounts,
		detailedVulnerabilities: detailedCounts,
		reason: passed
			? severityTotal === 0
				? 'Registry audit completed with no production findings and the expected pnpm 11.25 exit code.'
				: 'Registry audit reported only findings below the high-severity release threshold and returned the expected pnpm 11.25 exit code.'
			: !countsConsistent
				? 'High/critical advisories or report totals conflict with the pnpm 11.25 audit metadata.'
				: !exitSemanticsValid
					? 'Audit exit code contradicts pnpm 11.25 high-threshold JSON semantics; registry failures and timeouts fail closed.'
					: 'Audit reported at least one high or critical production finding.',
	};
}

function parseManifestInputs(manifestInputs) {
	return manifestInputs.map(({ path, source }) => {
		try {
			return { path, source, sha256: sha256(source), value: JSON.parse(source), error: null };
		} catch (error) {
			return { path, source, sha256: sha256(source), value: null, error: error.message };
		}
	});
}

export function buildSecurityEvidence({
	expectedGitSha,
	actualGitSha,
	manifestInputs,
	lockfileSource,
	npmrcSource,
	workspaceSource,
	effectiveAuditRegistry,
	auditReportSource,
	auditExitCode,
	requireAudit = false,
	generatedAt = new Date().toISOString(),
}) {
	const manifests = parseManifestInputs(manifestInputs);
	const rootManifest = manifests.find(({ path }) => path === 'package.json');
	const packageManager = rootManifest?.value?.packageManager ?? null;
	const requiredPackageManager = `pnpm@${BLACKSITE_SECURITY_POLICY.audit.pnpmVersion}`;
	const malformedManifests = manifests
		.filter(({ error }) => error)
		.map(({ path, error }) => ({ path, error }));
	const vitePins = [];
	const adapterStaticPins = [];
	for (const manifest of manifests) {
		if (!manifest.value) continue;
		for (const section of dependencySections) {
			if (Object.hasOwn(manifest.value[section] ?? {}, 'vite')) {
				vitePins.push({
					path: manifest.path,
					section,
					version: manifest.value[section].vite,
				});
			}
			if (Object.hasOwn(manifest.value[section] ?? {}, '@sveltejs/adapter-static')) {
				adapterStaticPins.push({
					path: manifest.path,
					section,
					version: manifest.value[section]['@sveltejs/adapter-static'],
				});
			}
		}
	}

	const lockfileReadable = typeof lockfileSource === 'string' && lockfileSource.length > 0;
	const npmrcReadable = typeof npmrcSource === 'string' && npmrcSource.length > 0;
	const workspaceReadable = typeof workspaceSource === 'string' && workspaceSource.length > 0;
	const npmrcSha256 = npmrcReadable ? sha256(npmrcSource) : null;
	const workspaceSha256 = workspaceReadable ? sha256(workspaceSource) : null;
	const workspaceDevalueOverride = workspaceReadable
		? /^\s{2}devalue:\s*["']?([^\s"']+)["']?\s*$/mu.exec(workspaceSource)?.[1] ?? null
		: null;
	const configuredRegistryDeclarations = npmrcRegistryDeclarations(npmrcSource);
	const configuredRegistry =
		configuredRegistryDeclarations.length === 1 ? configuredRegistryDeclarations[0] : null;
	const effectiveRegistryUrl = safeRegistryUrl(effectiveAuditRegistry);
	const configuredRegistryUrl = safeRegistryUrl(configuredRegistry);
	const registryPolicyPassed =
		npmrcSha256 === BLACKSITE_SECURITY_POLICY.audit.npmrcSha256 &&
		effectiveAuditRegistry === BLACKSITE_SECURITY_POLICY.audit.registry &&
		configuredRegistry === BLACKSITE_SECURITY_POLICY.audit.registry &&
		Boolean(effectiveRegistryUrl) &&
		Boolean(configuredRegistryUrl) &&
		BLACKSITE_SECURITY_POLICY.audit.allowedOrigins.includes(effectiveRegistryUrl.origin) &&
		configuredRegistryUrl.origin === effectiveRegistryUrl.origin;
	const viteLockVersions = lockfileReadable
		? extractLockPackageVersions(lockfileSource, 'vite')
		: [];
	const devalueLockVersions = lockfileReadable
		? extractLockPackageVersions(lockfileSource, 'devalue')
		: [];
	const audit = assessPnpmAudit({
		source: auditReportSource,
		exitCode: auditExitCode,
		required: requireAudit,
		registry: effectiveRegistryUrl?.href ?? null,
	});

	const checks = [
		check(
			'exact-git-identity',
			isExactSha(expectedGitSha) && actualGitSha === expectedGitSha ? 'PASS' : 'FAIL',
			{
				expectedGitSha: expectedGitSha ?? null,
				actualGitSha: actualGitSha ?? null,
				expectedShaFormatValid: isExactSha(expectedGitSha),
			},
		),
		check(
			'repository-inputs-readable',
			rootManifest &&
			lockfileReadable &&
			npmrcReadable &&
			workspaceReadable &&
			malformedManifests.length === 0
				? 'PASS'
				: 'FAIL',
			{
				rootManifestPresent: Boolean(rootManifest),
				lockfilePresent: lockfileReadable,
				npmrcPresent: npmrcReadable,
				workspacePresent: workspaceReadable,
				malformedManifests,
			},
		),
		check(
			'package-manager-version',
			packageManager === requiredPackageManager ? 'PASS' : 'FAIL',
			{ actual: packageManager, required: requiredPackageManager },
		),
		check(
			'workspace-package-manager-policy',
			workspaceSha256 === BLACKSITE_SECURITY_POLICY.audit.workspaceSha256 ? 'PASS' : 'FAIL',
			{
				sha256: workspaceSha256,
				requiredSha256: BLACKSITE_SECURITY_POLICY.audit.workspaceSha256,
			},
		),
		check('audit-registry-and-npmrc-policy', registryPolicyPassed ? 'PASS' : 'FAIL', {
			requiredRegistry: BLACKSITE_SECURITY_POLICY.audit.registry,
			allowedOrigins: BLACKSITE_SECURITY_POLICY.audit.allowedOrigins,
			effectiveRegistry: effectiveRegistryUrl?.href ?? null,
			effectiveOrigin: effectiveRegistryUrl?.origin ?? null,
			configuredRegistry: configuredRegistryUrl?.href ?? null,
			configuredRegistryDeclarations: configuredRegistryDeclarations.length,
			npmrcSha256,
			requiredNpmrcSha256: BLACKSITE_SECURITY_POLICY.audit.npmrcSha256,
		}),
		check(
			'vite-exact-manifest-pin',
			vitePins.length > 0 &&
				vitePins.every(({ version }) => version === BLACKSITE_SECURITY_POLICY.versions.vite)
				? 'PASS'
				: 'FAIL',
			{
				requiredVersion: BLACKSITE_SECURITY_POLICY.versions.vite,
				pins: vitePins,
			},
		),
		check(
			'adapter-static-exact-pin',
			adapterStaticPins.length > 0 &&
				adapterStaticPins.every(
					({ version }) => version === BLACKSITE_SECURITY_POLICY.versions.adapterStatic,
				)
				? 'PASS'
				: 'FAIL',
			{
				requiredVersion: BLACKSITE_SECURITY_POLICY.versions.adapterStatic,
				pins: adapterStaticPins,
			},
		),
		check(
			'devalue-exact-override',
			workspaceDevalueOverride === BLACKSITE_SECURITY_POLICY.versions.devalue
				? 'PASS'
				: 'FAIL',
			{
				requiredVersion: BLACKSITE_SECURITY_POLICY.versions.devalue,
				actualVersion: workspaceDevalueOverride,
			},
		),
		check(
			'vite-lockfile-floor',
			viteLockVersions.length > 0 &&
				viteLockVersions.every((version) =>
					versionAtLeast(version, BLACKSITE_SECURITY_POLICY.versions.vite),
				)
				? 'PASS'
				: 'FAIL',
			{
				requiredMinimumVersion: BLACKSITE_SECURITY_POLICY.versions.vite,
				resolvedVersions: viteLockVersions,
			},
		),
		check(
			'devalue-lockfile-floor',
			devalueLockVersions.length > 0 &&
				devalueLockVersions.every((version) =>
					versionAtLeast(version, BLACKSITE_SECURITY_POLICY.versions.devalue),
				)
				? 'PASS'
				: 'FAIL',
			{
				requiredMinimumVersion: BLACKSITE_SECURITY_POLICY.versions.devalue,
				resolvedVersions: devalueLockVersions,
			},
		),
		check('production-registry-audit', audit.status, audit),
	];
	const summary = {
		checks: checks.length,
		pass: checks.filter(({ status }) => status === 'PASS').length,
		fail: checks.filter(({ status }) => status === 'FAIL').length,
		notRun: checks.filter(({ status }) => status === 'NOT_RUN').length,
	};

	return {
		schema: BLACKSITE_SECURITY_EVIDENCE_SCHEMA,
		generatedAt,
		status: summary.fail > 0 ? 'FAIL' : summary.notRun > 0 ? 'INCOMPLETE' : 'PASS',
		identity: {
			testedGitSha: actualGitSha ?? null,
			expectedGitSha: expectedGitSha ?? null,
		},
		policy: BLACKSITE_SECURITY_POLICY,
		inputs: {
			auditRegistry: {
				url: effectiveRegistryUrl?.href ?? null,
				origin: effectiveRegistryUrl?.origin ?? null,
			},
			npmrc: {
				path: '.npmrc',
				sha256: npmrcSha256,
			},
			workspace: {
				path: 'pnpm-workspace.yaml',
				sha256: workspaceSha256,
			},
			lockfile: {
				path: 'pnpm-lock.yaml',
				sha256: lockfileReadable ? sha256(lockfileSource) : null,
			},
			manifests: manifests.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
		},
		checks,
		summary,
	};
}

export function collectPackageManifestPaths(repoRoot) {
	const paths = [resolve(repoRoot, 'package.json')];
	function visit(directory) {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
			const child = resolve(directory, entry.name);
			const manifest = resolve(child, 'package.json');
			if (existsSync(manifest) && statSync(manifest).isFile()) {
				paths.push(manifest);
			} else {
				visit(child);
			}
		}
	}
	visit(resolve(repoRoot, 'apps'));
	visit(resolve(repoRoot, 'packages'));
	return paths;
}

function argumentValue(name, { required = false } = {}) {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (required && (!value || value.startsWith('--'))) {
		throw new Error(`Missing required argument ${name}`);
	}
	return value;
}

function actualGitSha(repoRoot) {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return null;
	}
}

export function runSecurityEvidenceCli({ repoRoot = defaultRepoRoot } = {}) {
	const expectedGitSha = argumentValue('--expected-commit', { required: true });
	const outputArgument = argumentValue('--output', { required: true });
	const auditReportArgument = argumentValue('--audit-report');
	const auditExitCodeArgument = argumentValue('--audit-exit-code');
	const effectiveAuditRegistry = argumentValue('--audit-registry', { required: true });
	const requireAudit = process.argv.includes('--require-audit');
	const outputPath = resolve(repoRoot, outputArgument);
	const auditReportPath = auditReportArgument ? resolve(repoRoot, auditReportArgument) : null;
	const manifestInputs = collectPackageManifestPaths(repoRoot).map((path) => ({
		path: portablePath(repoRoot, path),
		source: readFileSync(path, 'utf8'),
	}));
	const lockfilePath = resolve(repoRoot, 'pnpm-lock.yaml');
	const lockfileSource = existsSync(lockfilePath) ? readFileSync(lockfilePath, 'utf8') : null;
	const npmrcPath = resolve(repoRoot, '.npmrc');
	const npmrcSource = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : null;
	const workspacePath = resolve(repoRoot, 'pnpm-workspace.yaml');
	const workspaceSource = existsSync(workspacePath)
		? readFileSync(workspacePath, 'utf8')
		: null;
	const auditReportSource =
		auditReportPath && existsSync(auditReportPath)
			? readFileSync(auditReportPath, 'utf8')
			: undefined;
	const auditExitCode =
		auditExitCodeArgument !== undefined && /^-?\d+$/u.test(auditExitCodeArgument)
			? Number(auditExitCodeArgument)
			: undefined;
	const evidence = buildSecurityEvidence({
		expectedGitSha,
		actualGitSha: actualGitSha(repoRoot),
		manifestInputs,
		lockfileSource,
		npmrcSource,
		workspaceSource,
		effectiveAuditRegistry,
		auditReportSource,
		auditExitCode,
		requireAudit,
	});
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
	if (evidence.status !== 'PASS') {
		const failed = evidence.checks
			.filter(({ status }) => status === 'FAIL')
			.map(({ id }) => id)
			.join(', ');
		throw new Error(`BLACKSITE security gate failed: ${failed}`);
	}
	process.stdout.write(
		`BLACKSITE security gate PASS for ${evidence.identity.testedGitSha}; evidence=${portablePath(repoRoot, outputPath)}\n`,
	);
	return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	try {
		runSecurityEvidenceCli();
	} catch (error) {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	}
}
