import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const frontendSource = join(repoRoot, 'apps', 'blacksite', 'build');
const mathLibrary = join(repoRoot, 'math', 'games', 'blacksite_breach', 'library');
const mathIndexSource = join(mathLibrary, 'publish_files', 'index.json');
const mathConfigSource = join(mathLibrary, 'configs', 'game_config.json');
const verifyResultSource = join(mathLibrary, 'publish_files', 'VERIFY_RESULT.json');
const mathCandidateManifestSource = join(mathLibrary, 'publish_files', 'CANDIDATE_MANIFEST.json');
const expectedModes = Object.freeze([
	{ name: 'base', cost: 1 },
	{ name: 'deep_access', cost: 4 },
	{ name: 'blackout', cost: 80 },
]);

function fail(message) {
	throw new Error(message);
}

function requiredArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing required argument ${name}`);
	}
	return process.argv[index + 1];
}

function parseArguments() {
	const usage =
		'Usage: node scripts/blacksite-package-candidate.mjs --output <new-directory> --expected-commit <full-sha> --expected-frontend-tree <sha256>';
	try {
		const outputRoot = resolve(repoRoot, requiredArgument('--output'));
		const expectedCommit = requiredArgument('--expected-commit');
		const expectedFrontendTreeSha256 = requiredArgument('--expected-frontend-tree');
		if (!/^[0-9a-f]{40}$/iu.test(expectedCommit)) fail('--expected-commit must be a full Git SHA');
		if (!/^[0-9a-f]{64}$/iu.test(expectedFrontendTreeSha256)) {
			fail('--expected-frontend-tree must be a SHA-256 hex digest');
		}
		return { outputRoot, expectedCommit, expectedFrontendTreeSha256 };
	} catch (error) {
		if (error instanceof Error) error.message = `${error.message}\n${usage}`;
		throw error;
	}
}

function pathIsWithin(parent, child) {
	const path = relative(parent, child);
	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function assertSafeNewOutput(outputRoot) {
	if (existsSync(outputRoot)) fail(`Output already exists; refusing to overwrite: ${outputRoot}`);
	for (const protectedPath of [repoRoot, frontendSource, mathLibrary]) {
		if (pathIsWithin(outputRoot, protectedPath) || pathIsWithin(protectedPath, outputRoot)) {
			fail(`Output must not contain or be contained by a protected source path: ${outputRoot}`);
		}
	}
}

function assertBasename(value, extension, context) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value !== value.replaceAll('\\', '/').split('/').at(-1) ||
		!value.endsWith(extension)
	) {
		fail(`${context} must be a local ${extension} basename`);
	}
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function fileFact(path) {
	const bytes = readFileSync(path);
	return {
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
	};
}

function collectFiles(target, files = []) {
	const targetStats = statSync(target);
	if (targetStats.isFile()) {
		files.push(target);
		return files;
	}
	if (!targetStats.isDirectory()) return files;
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((left, right) =>
		left.name.localeCompare(right.name, 'en'),
	)) {
		const child = join(target, entry.name);
		if (entry.isDirectory()) collectFiles(child, files);
		else if (entry.isFile()) files.push(child);
		else fail(`Unsupported package entry type: ${child}`);
	}
	return files;
}

function createFileManifest(root) {
	const files = collectFiles(root).sort((left, right) =>
		relative(root, left)
			.replaceAll('\\', '/')
			.localeCompare(relative(root, right).replaceAll('\\', '/'), 'en'),
	);
	const treeHash = createHash('sha256');
	const records = files.map((absolutePath) => {
		const path = relative(root, absolutePath).replaceAll('\\', '/');
		const bytes = readFileSync(absolutePath);
		const pathBytes = Buffer.byteLength(path, 'utf8');
		treeHash.update(Buffer.from(`${pathBytes}\0${path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		return {
			path,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		};
	});
	return {
		algorithm:
			'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)',
		treeSha256: treeHash.digest('hex'),
		fileCount: records.length,
		totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
		files: records,
	};
}

function gitText(args) {
	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function validateIndex(index) {
	if (
		!index ||
		JSON.stringify(Object.keys(index)) !== JSON.stringify(['modes']) ||
		!Array.isArray(index.modes)
	) {
		fail('BLACKSITE math index must contain only the modes array');
	}
	if (index.modes.length !== expectedModes.length) fail('BLACKSITE math index mode count mismatch');
	for (let position = 0; position < expectedModes.length; position += 1) {
		const expected = expectedModes[position];
		const actual = index.modes[position];
		if (
			JSON.stringify(Object.keys(actual).sort()) !==
			JSON.stringify(['cost', 'events', 'name', 'weights'])
		) {
			fail(`${expected.name}: index keys mismatch`);
		}
		if (actual.name !== expected.name || actual.cost !== expected.cost) {
			fail(`${expected.name}: canonical name/cost mismatch`);
		}
		assertBasename(actual.events, '.jsonl.zst', `${expected.name} events`);
		assertBasename(actual.weights, '.csv', `${expected.name} weights`);
	}
}

function canonicalMathUploadFiles(index) {
	return [
		{ path: 'publish_files/index.json', absolutePath: mathIndexSource, outputName: 'index.json' },
		...index.modes.flatMap((mode) => [
			{
				path: `lookup_tables/${mode.weights}`,
				absolutePath: join(mathLibrary, 'lookup_tables', mode.weights),
				outputName: mode.weights,
			},
			{
				path: `books_compressed/${mode.events}`,
				absolutePath: join(mathLibrary, 'books_compressed', mode.events),
				outputName: mode.events,
			},
		]),
	];
}

function validateMathEvidence(index, candidateManifest, verifyResult, gameConfig) {
	if (
		candidateManifest.candidate_fingerprint_sha256 !== verifyResult.candidate_fingerprint_sha256 ||
		candidateManifest.lifecycle !== verifyResult.lifecycle ||
		candidateManifest.lifecycle !== gameConfig.lifecycle ||
		candidateManifest.candidate_version !== verifyResult.candidate_version ||
		candidateManifest.candidate_version !== gameConfig.candidate_version ||
		gameConfig.lifecycle !== 'M1_INITIAL_CANDIDATE_NOT_RELEASE'
	) {
		fail('Math candidate manifest and verification result identity mismatch');
	}
	const recordedConfig = candidateManifest.files?.find(
		(record) => record.path === 'configs/game_config.json',
	);
	const actualConfig = fileFact(mathConfigSource);
	if (
		!recordedConfig ||
		recordedConfig.bytes !== actualConfig.bytes ||
		recordedConfig.sha256 !== actualConfig.sha256
	) {
		fail('Canonical game_config.json differs from the retained M1 candidate evidence');
	}
	const expectedFiles = canonicalMathUploadFiles(index);
	const recordedFiles = candidateManifest.upload_payload_files;
	if (!Array.isArray(recordedFiles) || recordedFiles.length !== expectedFiles.length) {
		fail('Math candidate manifest upload payload file count mismatch');
	}
	const recordsByPath = new Map(recordedFiles.map((record) => [record.path, record]));
	for (const file of expectedFiles) {
		if (!existsSync(file.absolutePath))
			fail(`Missing canonical math upload file: ${file.absolutePath}`);
		const actual = { path: file.path, ...fileFact(file.absolutePath) };
		const recorded = recordsByPath.get(file.path);
		if (!recorded || recorded.bytes !== actual.bytes || recorded.sha256 !== actual.sha256) {
			fail(`Canonical math upload file differs from M1 candidate evidence: ${file.path}`);
		}
	}
	const expectedPaths = expectedFiles.map((file) => file.path).sort();
	const recordedPaths = [...recordsByPath.keys()].sort();
	if (JSON.stringify(expectedPaths) !== JSON.stringify(recordedPaths)) {
		fail('Math candidate manifest contains stale or unexpected upload payload paths');
	}
	return expectedFiles;
}

function copyMath(files, mathRoot) {
	for (const file of files) {
		cpSync(file.absolutePath, join(mathRoot, file.outputName));
	}
}

function main() {
	const { outputRoot, expectedCommit, expectedFrontendTreeSha256 } = parseArguments();
	assertSafeNewOutput(outputRoot);
	if (!existsSync(join(frontendSource, 'index.html'))) {
		fail('Missing BLACKSITE frontend build; run pnpm --filter blacksite build first');
	}
	for (const path of [
		mathIndexSource,
		mathConfigSource,
		verifyResultSource,
		mathCandidateManifestSource,
	]) {
		if (!existsSync(path)) fail(`Missing BLACKSITE math candidate input: ${path}`);
	}

	const gitSha = gitText(['rev-parse', 'HEAD']);
	const gitBranch = gitText(['branch', '--show-current']);
	const gitStatusBefore = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
	if (!/^[0-9a-f]{40}$/iu.test(gitSha)) fail(`Invalid git SHA: ${gitSha}`);
	if (gitSha !== expectedCommit)
		fail(`Current Git SHA ${gitSha} does not match --expected-commit ${expectedCommit}`);
	if (gitStatusBefore !== '') fail(`Worktree must be clean before packaging:\n${gitStatusBefore}`);

	const index = readJson(mathIndexSource);
	const gameConfig = readJson(mathConfigSource);
	const verifyResult = readJson(verifyResultSource);
	const mathCandidateManifest = readJson(mathCandidateManifestSource);
	validateIndex(index);
	if (gameConfig.game_id !== 'blacksite_breach') fail('Math config is not BLACKSITE');
	if (verifyResult.result !== 'PASS' || !verifyResult.all_gates_passed) {
		fail('Canonical BLACKSITE math verification result is not PASS');
	}
	const canonicalMathFiles = validateMathEvidence(
		index,
		mathCandidateManifest,
		verifyResult,
		gameConfig,
	);
	const frontendSourceManifest = createFileManifest(frontendSource);
	if (frontendSourceManifest.treeSha256 !== expectedFrontendTreeSha256) {
		fail(
			`Frontend build tree ${frontendSourceManifest.treeSha256} does not match --expected-frontend-tree ${expectedFrontendTreeSha256}`,
		);
	}

	mkdirSync(outputRoot, { recursive: true });
	const frontendRoot = join(outputRoot, 'frontend');
	const mathRoot = join(outputRoot, 'math');
	cpSync(frontendSource, frontendRoot, { recursive: true, errorOnExist: true });
	mkdirSync(mathRoot);
	copyMath(canonicalMathFiles, mathRoot);

	const frontendPackage = createFileManifest(frontendRoot);
	const mathPackage = createFileManifest(mathRoot);
	if (JSON.stringify(frontendPackage) !== JSON.stringify(frontendSourceManifest)) {
		fail('Copied frontend package differs from the caller-pinned build tree');
	}
	const gitStatusAfter = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
	if (gitStatusAfter !== '') fail(`Worktree changed while packaging:\n${gitStatusAfter}`);
	const frontendPackageJson = readJson(join(repoRoot, 'apps', 'blacksite', 'package.json'));
	const rootPackageJson = readJson(join(repoRoot, 'package.json'));
	const manifest = {
		schema: 'blacksite-upload-candidate-v1',
		lifecycle: 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY',
		approvalStatus: 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN',
		uploadAuthorized: false,
		generatedAt: new Date().toISOString(),
		git: {
			branch: gitBranch,
			sha: gitSha,
			expectedSha: expectedCommit,
			cleanBefore: gitStatusBefore === '',
			cleanAfter: gitStatusAfter === '',
			dirty: false,
		},
		toolchain: {
			node: process.version,
			packageManager: rootPackageJson.packageManager,
			platform: process.platform,
			arch: process.arch,
		},
		commands: {
			build: 'pnpm --filter blacksite build',
			mathVerify: 'pnpm blacksite:math:verify -- --no-write',
			package: `node scripts/blacksite-package-candidate.mjs --output <path> --expected-commit ${gitSha} --expected-frontend-tree ${frontendPackage.treeSha256}`,
			verify: 'node scripts/blacksite-package-verify.mjs --candidate <path> --write-result',
			packageBrowserQa: `BLACKSITE_QA_BUILD_ROOT=<path>/frontend BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=${frontendPackage.treeSha256} node scripts/blacksite-qa-e2e.mjs`,
		},
		game: {
			id: gameConfig.game_id,
			name: gameConfig.game_name,
			frontendVersion: frontendPackageJson.version,
			mathCandidateVersion: gameConfig.candidate_version,
			mathLifecycle: gameConfig.lifecycle,
			modes: index.modes,
		},
		mathEvidence: {
			candidateFingerprintSha256: verifyResult.candidate_fingerprint_sha256,
			eventSchemaSha256: verifyResult.canonical_event_schema_sha256,
			booksVerified: verifyResult.books_verified,
			gatesPassed: verifyResult.gates_passed,
			gatesTotal: verifyResult.gates_total,
			candidateManifest: fileFact(mathCandidateManifestSource),
			verifyResult: fileFact(verifyResultSource),
			gameConfigEvidenceOnly: {
				...fileFact(mathConfigSource),
				gameId: gameConfig.game_id,
				candidateVersion: gameConfig.candidate_version,
				note: 'Evidence only; official minimal math upload folder contains index.json plus referenced CSV/ZST files.',
			},
			uploadPayloadFiles: mathCandidateManifest.upload_payload_files,
		},
		packages: {
			frontend: frontendPackage,
			math: mathPackage,
		},
		uploadRoots: {
			frontend: 'frontend/',
			math: 'math/',
		},
		warnings: [
			'M2 authoritative greybox frontend; final production assets, animation and audio are not present.',
			'M1 initial non-release math candidate; the math upload root contains only the seven official minimal payload files and no Stake Math approval is claimed.',
			'No manual visual/device, extracted archive, Stake/ACP, upload, release or live approval is claimed.',
		],
	};
	writeFileSync(
		join(outputRoot, 'candidate-manifest.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	writeFileSync(
		join(outputRoot, 'README_UPLOAD_CANDIDATE.txt'),
		[
			'BLACKSITE // BREACH — ISOLATED UPLOAD-FOLDER CANDIDATE',
			'',
			`Git SHA: ${gitSha}`,
			`Frontend version: ${frontendPackageJson.version}`,
			`Math candidate: ${gameConfig.candidate_version}`,
			'',
			'Use frontend/ only as the frontend upload root.',
			'Use math/ only as the math upload root.',
			'The math/ root contains exactly index.json, three lookup CSV files and three zstd JSONL books.',
			'Do not upload the repository publish/ folder; it belongs to Golden Goal Rush.',
			'',
			'IMPORTANT: This is a SHA-bound technical package candidate, not Stake-approved or release-ready.',
			'Production art/Spine/audio, manual device/visual review and external Stake gates remain open.',
			'',
		].join('\n'),
	);

	process.stdout.write(
		`${JSON.stringify(
			{
				status: 'PASS',
				outputRoot,
				gitSha,
				frontendTreeSha256: frontendPackage.treeSha256,
				mathTreeSha256: mathPackage.treeSha256,
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
