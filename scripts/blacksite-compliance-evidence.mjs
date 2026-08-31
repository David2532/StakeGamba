import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const evidenceMapPath = resolve(repoRoot, 'docs/blacksite/RELEASE_EVIDENCE_51.json');
const allowedStatuses = new Set([
	'AUTOMATED_PASS',
	'AUTOMATED_PASS_MANUAL_OPEN',
	'MANUAL_OPEN',
	'EXTERNAL_OPEN',
	'NOT_APPLICABLE',
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

function readJson(path, label) {
	if (!existsSync(path)) fail(`Missing ${label}: ${path}`);
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		fail(`Invalid ${label}: ${error.message}`);
	}
}

function validateEvidenceMap(map) {
	if (map.schema !== 'blacksite-stake-51-evidence-map-v1') fail('Unknown evidence-map schema');
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
		const scenarios = item.browserScenarios ?? [];
		const checks = item.browserChecks ?? [];
		const repositoryGates = item.repositoryGates ?? [];
		if (![scenarios, checks, repositoryGates].every(Array.isArray)) {
			fail(`Requirement ${item.id} evidence references must be arrays`);
		}
		if (
			item.status.startsWith('AUTOMATED_PASS') &&
			scenarios.length + checks.length + repositoryGates.length === 0
		) {
			fail(`Requirement ${item.id} claims automated proof without an evidence reference`);
		}
		if (item.status === 'AUTOMATED_PASS_MANUAL_OPEN' && !item.manualOpen) {
			fail(`Requirement ${item.id} must name its open manual gate`);
		}
		if (item.status === 'MANUAL_OPEN' && !item.manualOpen) {
			fail(`Requirement ${item.id} must name its required manual evidence`);
		}
		if (item.status === 'EXTERNAL_OPEN' && !item.externalOpen) {
			fail(`Requirement ${item.id} must name its required external evidence`);
		}
		if (item.status === 'NOT_APPLICABLE' && !item.notApplicableReason) {
			fail(`Requirement ${item.id} must explain why it is not applicable`);
		}
	}
	return map.items;
}

function validatePackage(candidateRoot) {
	const manifest = readJson(
		resolve(candidateRoot, 'candidate-manifest.json'),
		'candidate manifest',
	);
	const verification = readJson(
		resolve(candidateRoot, 'package-verification.json'),
		'package verification',
	);
	if (
		manifest.schema !== 'blacksite-upload-candidate-v1' ||
		verification.schema !== 'blacksite-upload-candidate-verification-v1' ||
		verification.result !== 'PASS' ||
		manifest.git?.sha !== verification.gitSha ||
		manifest.packages?.frontend?.treeSha256 !== verification.frontend?.treeSha256 ||
		manifest.packages?.math?.treeSha256 !== verification.math?.treeSha256
	) {
		fail('Candidate manifest and successful package verification are not identity-consistent');
	}
	return { manifest, verification };
}

function validateBrowser(browserEvidence, manifest) {
	if (
		browserEvidence.summary?.fail !== 0 ||
		browserEvidence.summary?.failedScenarios !== 0 ||
		browserEvidence.summary?.scenarios !== browserEvidence.summary?.passedScenarios
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
	const scenarios = new Map(
		browserEvidence.scenarios.map((scenario) => [scenario.name, scenario.status]),
	);
	const checks = new Map();
	for (const check of browserEvidence.checks) {
		const statuses = checks.get(check.name) ?? [];
		statuses.push(check.status);
		checks.set(check.name, statuses);
	}
	return { scenarios, checks };
}

function resolveItems(items, browserIndex) {
	return items.map((item) => {
		const missingScenarios = (item.browserScenarios ?? []).filter(
			(name) => browserIndex.scenarios.get(name) !== 'PASS',
		);
		const missingChecks = (item.browserChecks ?? []).filter((name) => {
			const statuses = browserIndex.checks.get(name) ?? [];
			return statuses.length === 0 || statuses.some((status) => status !== 'PASS');
		});
		if (missingScenarios.length > 0 || missingChecks.length > 0) {
			fail(
				`Requirement ${item.id} has unresolved browser evidence: ${[
					...missingScenarios,
					...missingChecks,
				].join(', ')}`,
			);
		}
		return {
			...item,
			browserEvidenceResolved: [...(item.browserScenarios ?? []), ...(item.browserChecks ?? [])],
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

export function buildComplianceEvidence({ candidateRoot, browserEvidencePath }) {
	const map = readJson(evidenceMapPath, '51-point evidence map');
	const items = validateEvidenceMap(map);
	const { manifest, verification } = validatePackage(candidateRoot);
	const browserEvidence = readJson(browserEvidencePath, 'browser evidence');
	const browserIndex = validateBrowser(browserEvidence, manifest);
	const resolvedItems = resolveItems(items, browserIndex);
	return {
		schema: 'blacksite-stake-51-candidate-evidence-v1',
		generatedAt: new Date().toISOString(),
		candidate: {
			gitSha: manifest.git.sha,
			frontendTreeSha256: manifest.packages.frontend.treeSha256,
			mathTreeSha256: manifest.packages.math.treeSha256,
			mathFingerprintSha256: manifest.mathEvidence.candidateFingerprintSha256,
			packageVerification: verification.result,
			browserSummary: browserEvidence.summary,
		},
		statusDefinitions: map.statusDefinitions,
		summary: summarize(resolvedItems),
		items: resolvedItems,
		claims: {
			matrixCompleteness: 'PASS',
			automatedReferencesResolved: 'PASS',
			manualEvidence: 'NOT_CLAIMED',
			externalApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	};
}

function main() {
	const candidateRoot = argument('--candidate');
	const browserEvidencePath = argument('--browser-evidence');
	const outputPath = argument('--output');
	const evidence = buildComplianceEvidence({ candidateRoot, browserEvidencePath });
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
	process.stdout.write(
		`${JSON.stringify(
			{
				result: 'PASS',
				output: outputPath,
				candidate: evidence.candidate,
				summary: evidence.summary,
				claims: evidence.claims,
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
