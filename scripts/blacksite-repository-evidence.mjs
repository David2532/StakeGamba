import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');

export const BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA = 'blacksite-repository-gate-evidence-v2';
export const BLACKSITE_REPOSITORY_GATES = Object.freeze([
	'pnpm install --frozen-lockfile --reporter=silent',
	'pnpm audit --prod --audit-level high --json',
	'pnpm lint',
	'pnpm --filter blacksite check',
	'pnpm --filter blacksite test',
	'pnpm build',
	'pnpm blacksite:scale:contract',
	'pnpm blacksite:math:test',
	'isolated candidate package verification',
	'exact extracted frontend Chromium QA',
]);

const REQUIRED_INPUT_LABELS = Object.freeze([
	'workflow',
	'npmrc',
	'package-manifest',
	'lockfile',
	'security-evidence',
	'candidate-manifest',
	'package-verification',
	'browser-evidence',
]);

function fail(message) {
	throw new Error(message);
}

function sha256(source) {
	return createHash('sha256').update(source).digest('hex');
}

function isExactSha(value) {
	return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

function requiredArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing required argument ${name}`);
	}
	return process.argv[index + 1];
}

export function buildRepositoryGateEvidence({
	expectedGitSha,
	actualGitSha,
	inputSources,
	generatedAt = new Date().toISOString(),
}) {
	if (!isExactSha(expectedGitSha) || actualGitSha !== expectedGitSha) {
		fail('Repository gate evidence must be bound to one exact current git SHA');
	}
	if (!Array.isArray(inputSources)) fail('Repository gate inputs must be an array');
	const inputs = inputSources.map(({ label, path, source }) => {
		if (!REQUIRED_INPUT_LABELS.includes(label) || typeof path !== 'string' || !path) {
			fail('Repository gate evidence contains an unknown or invalid input');
		}
		if (typeof source !== 'string' || source.length === 0) {
			fail(`Repository gate input ${label} is empty`);
		}
		return { label, path, sha256: sha256(source), bytes: Buffer.byteLength(source) };
	});
	if (
		inputs.length !== REQUIRED_INPUT_LABELS.length ||
		new Set(inputs.map(({ label }) => label)).size !== REQUIRED_INPUT_LABELS.length ||
		REQUIRED_INPUT_LABELS.some((label) => !inputs.some((input) => input.label === label))
	) {
		fail('Repository gate evidence must bind every required input exactly once');
	}
	const gates = BLACKSITE_REPOSITORY_GATES.map((name) => ({ name, status: 'PASS' }));
	return {
		schema: BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA,
		generatedAt,
		identity: { testedGitSha: actualGitSha, expectedGitSha },
		execution: {
			workflow: 'BlackSite CI / blacksite/quality',
			contract:
				'Emitted only by the final sequential workflow step after every named command completed successfully.',
		},
		inputs,
		gates,
		summary: { gates: gates.length, pass: gates.length, fail: 0 },
	};
}

function readInput(label, path) {
	const absolutePath = resolve(repoRoot, path);
	if (!existsSync(absolutePath)) fail(`Missing repository gate input ${label}: ${absolutePath}`);
	return {
		label,
		path: relative(repoRoot, absolutePath).replaceAll('\\', '/'),
		source: readFileSync(absolutePath, 'utf8'),
	};
}

function main() {
	const expectedGitSha = requiredArgument('--expected-commit');
	const outputPath = resolve(repoRoot, requiredArgument('--output'));
	const inputSources = [
		readInput('workflow', '.github/workflows/blacksite-ci.yml'),
		readInput('npmrc', '.npmrc'),
		readInput('package-manifest', 'package.json'),
		readInput('lockfile', 'pnpm-lock.yaml'),
		readInput('security-evidence', requiredArgument('--security-evidence')),
		readInput('candidate-manifest', requiredArgument('--candidate-manifest')),
		readInput('package-verification', requiredArgument('--package-verification')),
		readInput('browser-evidence', requiredArgument('--browser-evidence')),
	];
	const actualGitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
		cwd: repoRoot,
		encoding: 'utf8',
	}).trim();
	const evidence = buildRepositoryGateEvidence({ expectedGitSha, actualGitSha, inputSources });
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
	process.stdout.write(
		`${JSON.stringify({ result: 'PASS', output: outputPath, summary: evidence.summary }, null, 2)}\n`,
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
