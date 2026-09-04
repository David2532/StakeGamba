import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	createReadStream,
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	assertPhysicalPackageDirectory,
	verifyBlacksiteFrontendHygiene,
} from './blacksite-frontend-hygiene.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const assetManifestSource = join(repoRoot, 'apps', 'blacksite', 'art', 'asset-manifest.json');
const frontendPackageJsonSource = join(repoRoot, 'apps', 'blacksite', 'package.json');
const rootPackageJsonSource = join(repoRoot, 'package.json');
const mathLibrary = join(repoRoot, 'math', 'games', 'blacksite_breach', 'library');
const expectedModes = Object.freeze([
	{ name: 'base', cost: 1, events: 'base_books.jsonl.zst', weights: 'base_lookup.csv' },
	{
		name: 'deep_access',
		cost: 4,
		events: 'deep_access_books.jsonl.zst',
		weights: 'deep_access_lookup.csv',
	},
	{
		name: 'blackout',
		cost: 80,
		events: 'blackout_books.jsonl.zst',
		weights: 'blackout_lookup.csv',
	},
]);
const booksPerMode = 100_000;
const maxPayoutRaw = 1_000_000;
const expectedWarnings = Object.freeze([
	'In-progress production frontend; final asset rights/Creative approval, penguin Spine rig, authored character/reel polish, final audio mix and real-device review remain open.',
	'M1 initial non-release math candidate; the math upload root contains only the seven official minimal payload files and no Stake Math approval is claimed.',
	'No manual visual/device, extracted archive, Stake/ACP, upload, release or live approval is claimed.',
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

function validateExpectedBranch(branch) {
	if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u.test(branch)) {
		fail('--expected-branch must be a non-empty canonical Git branch name');
	}
	try {
		if (gitText(['check-ref-format', '--branch', branch]) !== branch) {
			fail('--expected-branch was normalized by Git');
		}
	} catch {
		fail('--expected-branch must be a non-empty canonical Git branch name');
	}
	return branch;
}

function parseArguments() {
	const usage =
		'Usage: node scripts/blacksite-package-verify.mjs --candidate <directory> --expected-branch <branch> [--write-result] [--allow-untracked-artifacts]';
	try {
		return {
			candidateRoot: resolve(repoRoot, requiredArgument('--candidate')),
			expectedBranch: validateExpectedBranch(requiredArgument('--expected-branch')),
			allowUntrackedArtifacts: process.argv.includes('--allow-untracked-artifacts'),
		};
	} catch (error) {
		if (error instanceof Error) error.message = `${error.message}\n${usage}`;
		throw error;
	}
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function assertPhysicalRegularFile(path, context) {
	if (!existsSync(path)) fail(`${context} is missing: ${path}`);
	const stats = lstatSync(path);
	if (stats.isSymbolicLink() || !stats.isFile()) {
		fail(`${context} must be a physical regular file: ${path}`);
	}
}

function fileFact(path) {
	const bytes = readFileSync(path);
	return {
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
	};
}

function collectFiles(target, files = []) {
	const targetStats = lstatSync(target);
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

function assertManifestEqual(actual, expected, context) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		fail(`${context} tree manifest does not match candidate-manifest.json`);
	}
}

function assertFileEquals(actual, canonical, context) {
	if (!readFileSync(actual).equals(readFileSync(canonical))) {
		fail(`${context} differs from the canonical versioned source`);
	}
}

function readLookup(path, modeName) {
	const text = readFileSync(path, 'utf8');
	if (!text.endsWith('\n')) fail(`${modeName}: lookup must end with newline`);
	const lines = text.trimEnd().split(/\r?\n/u);
	if (lines.length !== booksPerMode) fail(`${modeName}: expected ${booksPerMode} lookup rows`);
	const payouts = new Uint32Array(booksPerMode + 1);
	for (let index = 0; index < lines.length; index += 1) {
		const columns = lines[index].split(',');
		if (columns.length !== 3 || columns.some((value) => !/^(0|[1-9][0-9]*)$/u.test(value))) {
			fail(`${modeName}: invalid uint64 lookup row ${index + 1}`);
		}
		const id = Number(columns[0]);
		const weight = Number(columns[1]);
		const payout = Number(columns[2]);
		if (![id, weight, payout].every(Number.isSafeInteger))
			fail(`${modeName}: unsafe lookup integer`);
		if (id !== index + 1 || weight !== 1 || payout > maxPayoutRaw) {
			fail(`${modeName}: invalid ID/weight/payout at lookup row ${index + 1}`);
		}
		payouts[id] = payout;
	}
	return payouts;
}

async function verifyBook(path, modeName, payouts) {
	const input = createReadStream(path).pipe(createZstdDecompress());
	const lines = createInterface({ input, crlfDelay: Infinity });
	let id = 0;
	for await (const line of lines) {
		if (line.length === 0) fail(`${modeName}: empty JSONL line`);
		id += 1;
		if (id > booksPerMode) fail(`${modeName}: too many books`);
		const book = JSON.parse(line);
		if (
			book.id !== id ||
			!Array.isArray(book.events) ||
			!Number.isSafeInteger(book.payoutMultiplier) ||
			book.payoutMultiplier !== payouts[id]
		) {
			fail(`${modeName}: book/lookup mismatch at ID ${id}`);
		}
	}
	if (id !== booksPerMode) fail(`${modeName}: expected ${booksPerMode} books, received ${id}`);
	return id;
}

function gitText(args) {
	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function gitHead() {
	return gitText(['rev-parse', 'HEAD']);
}

function checkoutBranchEvidence() {
	const githubHeadRef = process.env.GITHUB_HEAD_REF?.trim();
	if (githubHeadRef) return githubHeadRef;
	const githubRef = process.env.GITHUB_REF?.trim();
	if (githubRef?.startsWith('refs/heads/')) return githubRef.slice('refs/heads/'.length);
	return gitText(['branch', '--show-current']);
}

function assertExpectedBranch(expectedBranch) {
	const checkoutBranch = checkoutBranchEvidence();
	if (checkoutBranch && checkoutBranch !== expectedBranch) {
		fail(
			`Current checkout branch ${checkoutBranch} does not match --expected-branch ${expectedBranch}`,
		);
	}
}

function expectedReadme(gitBranch, gitSha, frontendVersion, mathCandidateVersion) {
	return [
		'BLACKSITE // BREACH — ISOLATED UPLOAD-FOLDER CANDIDATE',
		'',
		`Git branch: ${gitBranch}`,
		`Git SHA: ${gitSha}`,
		`Frontend version: ${frontendVersion}`,
		`Math candidate: ${mathCandidateVersion}`,
		'',
		'Use frontend/ only as the frontend upload root.',
		'Use math/ only as the math upload root.',
		'The math/ root contains exactly index.json, three lookup CSV files and three zstd JSONL books.',
		'Do not upload the repository publish/ folder; it belongs to Golden Goal Rush.',
		'',
		'IMPORTANT: This is a SHA-bound technical package candidate, not Stake-approved or release-ready.',
		'Final asset approval/Spine work/audio mix, manual device/visual review and external Stake gates remain open.',
		'',
	].join('\n');
}

function validatePackagedFrontendBuildIdentity(frontendRoot, expectedGitSha, expectedGitTreeSha) {
	const path = join(frontendRoot, '_app', 'blacksite-build-identity.json');
	assertPhysicalRegularFile(path, 'Frontend build identity');
	const identity = readJson(path);
	if (
		JSON.stringify(identity) !==
		JSON.stringify({
			schema: 'blacksite-frontend-build-identity-v1',
			gitSha: expectedGitSha,
			gitTreeSha: expectedGitTreeSha,
			clean: true,
		})
	) {
		fail('Packaged frontend build identity does not match the current clean checkout');
	}
	const recoveryMetadata = readJson(join(frontendRoot, '_app', 'version.json'));
	if (
		JSON.stringify(Object.keys(recoveryMetadata)) !== JSON.stringify(['version']) ||
		recoveryMetadata.version !== expectedGitSha
	) {
		fail('Packaged frontend recovery build version does not match the exact Git SHA');
	}
}

function gitStatus({ includeUntracked = true } = {}) {
	return execFileSync(
		'git',
		['status', '--porcelain=v1', `--untracked-files=${includeUntracked ? 'all' : 'no'}`],
		{
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	).trim();
}

async function main() {
	const {
		candidateRoot: candidateArgument,
		expectedBranch,
		allowUntrackedArtifacts,
	} = parseArguments();
	const currentGitSha = gitHead();
	const currentGitTreeSha = gitText(['rev-parse', 'HEAD^{tree}']);
	assertExpectedBranch(expectedBranch);
	const candidateRoot = assertPhysicalPackageDirectory(candidateArgument, 'Candidate package root');
	const frontendRoot = assertPhysicalPackageDirectory(
		join(candidateRoot, 'frontend'),
		'Candidate frontend root',
	);
	const mathRoot = assertPhysicalPackageDirectory(
		join(candidateRoot, 'math'),
		'Candidate math root',
	);
	const manifestPath = join(candidateRoot, 'candidate-manifest.json');
	const readmePath = join(candidateRoot, 'README_UPLOAD_CANDIDATE.txt');
	const priorVerificationPath = join(candidateRoot, 'package-verification.json');
	for (const [path, context] of [
		[manifestPath, 'Candidate manifest'],
		[readmePath, 'Candidate README'],
		[join(frontendRoot, 'index.html'), 'Candidate frontend entrypoint'],
	]) {
		assertPhysicalRegularFile(path, context);
	}
	if (existsSync(priorVerificationPath)) {
		assertPhysicalRegularFile(priorVerificationPath, 'Prior package verification result');
	}
	const candidateTopLevel = readdirSync(candidateRoot).sort();
	const expectedCandidateTopLevel = [
		'README_UPLOAD_CANDIDATE.txt',
		'candidate-manifest.json',
		'frontend',
		'math',
		...(existsSync(priorVerificationPath) ? ['package-verification.json'] : []),
	].sort();
	if (JSON.stringify(candidateTopLevel) !== JSON.stringify(expectedCandidateTopLevel)) {
		fail(`Unexpected candidate root entries: ${candidateTopLevel.join(', ')}`);
	}

	const manifest = readJson(manifestPath);
	if (
		JSON.stringify(Object.keys(manifest)) !==
		JSON.stringify([
			'schema',
			'lifecycle',
			'approvalStatus',
			'uploadAuthorized',
			'generatedAt',
			'git',
			'toolchain',
			'commands',
			'game',
			'mathEvidence',
			'frontendEvidence',
			'packages',
			'uploadRoots',
			'warnings',
		])
	) {
		fail('Candidate manifest fields do not match the canonical schema');
	}
	if (manifest.schema !== 'blacksite-upload-candidate-v1')
		fail('Unknown candidate manifest schema');
	if (manifest.lifecycle !== 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY') {
		fail('Candidate lifecycle must remain explicitly non-submission-ready');
	}
	if (manifest.approvalStatus !== 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN') {
		fail('Candidate approval status must retain the open manual/production/external gates');
	}
	if (
		typeof manifest.generatedAt !== 'string' ||
		Number.isNaN(Date.parse(manifest.generatedAt)) ||
		new Date(manifest.generatedAt).toISOString() !== manifest.generatedAt
	) {
		fail('Candidate generatedAt must be a canonical ISO timestamp');
	}
	if (
		JSON.stringify(manifest.git) !==
			JSON.stringify({
				branch: expectedBranch,
				sha: currentGitSha,
				expectedSha: currentGitSha,
				cleanBefore: true,
				cleanAfter: true,
				dirty: false,
			}) ||
		gitStatus({ includeUntracked: !allowUntrackedArtifacts }) !== ''
	) {
		fail('Candidate and current checkout must be bound to the same clean worktree');
	}
	const rootPackageJson = readJson(rootPackageJsonSource);
	if (
		JSON.stringify(manifest.toolchain) !==
		JSON.stringify({
			node: process.version,
			packageManager: rootPackageJson.packageManager,
			platform: process.platform,
			arch: process.arch,
		})
	) {
		fail('Candidate toolchain identity does not match this verifier runtime');
	}
	if (
		JSON.stringify(manifest.uploadRoots) !==
			JSON.stringify({ frontend: 'frontend/', math: 'math/' }) ||
		JSON.stringify(manifest.warnings) !== JSON.stringify(expectedWarnings)
	) {
		fail('Candidate upload roots or release-truth warnings changed');
	}
	if (manifest.uploadAuthorized !== false)
		fail('Candidate must explicitly remain unauthorized for upload');

	const frontendManifest = createFileManifest(frontendRoot);
	const mathManifest = createFileManifest(mathRoot);
	assertManifestEqual(frontendManifest, manifest.packages?.frontend, 'Frontend');
	assertManifestEqual(mathManifest, manifest.packages?.math, 'Math');
	if (
		JSON.stringify(manifest.packages) !==
		JSON.stringify({ frontend: frontendManifest, math: mathManifest })
	) {
		fail('Candidate payload manifests contain unexpected or missing fields');
	}
	validatePackagedFrontendBuildIdentity(frontendRoot, currentGitSha, currentGitTreeSha);
	const frontendHygiene = verifyBlacksiteFrontendHygiene(
		frontendRoot,
		readJson(assetManifestSource),
		repoRoot,
	);
	if (
		JSON.stringify(manifest.frontendEvidence) !==
		JSON.stringify({
			assetManifest: fileFact(assetManifestSource),
			hygiene: frontendHygiene,
		})
	) {
		fail('Frontend hygiene evidence does not match the exact package and asset manifest');
	}
	const expectedCommands = {
		build: 'pnpm --filter blacksite build',
		mathVerify: 'pnpm blacksite:math:verify -- --no-write',
		package: `node scripts/blacksite-package-candidate.mjs --output <path> --expected-branch ${expectedBranch} --expected-commit ${currentGitSha} --expected-frontend-tree ${frontendManifest.treeSha256}`,
		verify: `node scripts/blacksite-package-verify.mjs --candidate <path> --expected-branch ${expectedBranch} --write-result`,
		packageBrowserQa: `BLACKSITE_QA_BUILD_ROOT=<path>/frontend BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=${frontendManifest.treeSha256} node scripts/blacksite-qa-e2e.mjs`,
	};
	if (JSON.stringify(manifest.commands) !== JSON.stringify(expectedCommands)) {
		fail('Candidate verification commands do not match the exact payload identity');
	}

	const frontendTopLevel = readdirSync(frontendRoot).sort();
	if (JSON.stringify(frontendTopLevel) !== JSON.stringify(['_app', 'assets', 'index.html'])) {
		fail(`Unexpected frontend root entries: ${frontendTopLevel.join(', ')}`);
	}

	const index = readJson(join(mathRoot, 'index.json'));
	if (JSON.stringify(index) !== JSON.stringify({ modes: expectedModes })) {
		fail('Packaged index.json does not match canonical mode/order/cost/file contract');
	}
	const expectedMathFiles = [
		'index.json',
		...expectedModes.flatMap((mode) => [mode.events, mode.weights]),
	].sort();
	const actualMathFiles = readdirSync(mathRoot).sort();
	if (JSON.stringify(actualMathFiles) !== JSON.stringify(expectedMathFiles)) {
		fail(`Unexpected math root entries: ${actualMathFiles.join(', ')}`);
	}

	assertFileEquals(
		join(mathRoot, 'index.json'),
		join(mathLibrary, 'publish_files', 'index.json'),
		'index.json',
	);
	const configEvidence = manifest.mathEvidence?.gameConfigEvidenceOnly;
	const canonicalConfigPath = join(mathLibrary, 'configs', 'game_config.json');
	const canonicalConfigFact = fileFact(canonicalConfigPath);
	const canonicalConfig = readJson(canonicalConfigPath);
	if (
		configEvidence?.bytes !== canonicalConfigFact.bytes ||
		configEvidence?.sha256 !== canonicalConfigFact.sha256 ||
		configEvidence?.gameId !== 'blacksite_breach'
	) {
		fail('External game_config evidence does not match the canonical BLACKSITE config');
	}
	const candidateManifestFact = fileFact(
		join(mathLibrary, 'publish_files', 'CANDIDATE_MANIFEST.json'),
	);
	const verifyResultFact = fileFact(join(mathLibrary, 'publish_files', 'VERIFY_RESULT.json'));
	const canonicalCandidateManifest = readJson(
		join(mathLibrary, 'publish_files', 'CANDIDATE_MANIFEST.json'),
	);
	const canonicalVerifyResult = readJson(join(mathLibrary, 'publish_files', 'VERIFY_RESULT.json'));
	const frontendPackageJson = readJson(frontendPackageJsonSource);
	const recordedConfig = canonicalCandidateManifest.files?.find(
		(record) => record.path === 'configs/game_config.json',
	);
	if (
		JSON.stringify(manifest.mathEvidence?.candidateManifest) !==
			JSON.stringify(candidateManifestFact) ||
		JSON.stringify(manifest.mathEvidence?.verifyResult) !== JSON.stringify(verifyResultFact)
	) {
		fail('Math evidence file identity changed after packaging');
	}
	if (
		manifest.mathEvidence?.candidateFingerprintSha256 !==
			canonicalCandidateManifest.candidate_fingerprint_sha256 ||
		manifest.mathEvidence?.candidateFingerprintSha256 !==
			canonicalVerifyResult.candidate_fingerprint_sha256 ||
		manifest.mathEvidence?.eventSchemaSha256 !==
			canonicalVerifyResult.canonical_event_schema_sha256 ||
		manifest.mathEvidence?.booksVerified !== canonicalVerifyResult.books_verified ||
		manifest.mathEvidence?.gatesPassed !== canonicalVerifyResult.gates_passed ||
		manifest.mathEvidence?.gatesTotal !== canonicalVerifyResult.gates_total ||
		JSON.stringify(manifest.mathEvidence?.uploadPayloadFiles) !==
			JSON.stringify(canonicalCandidateManifest.upload_payload_files) ||
		manifest.game?.mathCandidateVersion !== canonicalVerifyResult.candidate_version ||
		manifest.game?.mathLifecycle !== canonicalVerifyResult.lifecycle ||
		canonicalCandidateManifest.candidate_version !== canonicalVerifyResult.candidate_version ||
		canonicalCandidateManifest.lifecycle !== canonicalVerifyResult.lifecycle ||
		canonicalConfig.candidate_version !== canonicalVerifyResult.candidate_version ||
		canonicalConfig.lifecycle !== canonicalVerifyResult.lifecycle ||
		recordedConfig?.bytes !== canonicalConfigFact.bytes ||
		recordedConfig?.sha256 !== canonicalConfigFact.sha256 ||
		canonicalVerifyResult.lifecycle !== 'M1_INITIAL_CANDIDATE_NOT_RELEASE'
	) {
		fail(
			'Outer candidate math identity/lifecycle fields are not bound to the canonical M1 evidence',
		);
	}
	const expectedGame = {
		id: canonicalConfig.game_id,
		name: canonicalConfig.game_name,
		frontendVersion: frontendPackageJson.version,
		mathCandidateVersion: canonicalConfig.candidate_version,
		mathLifecycle: canonicalConfig.lifecycle,
		modes: index.modes,
	};
	if (JSON.stringify(manifest.game) !== JSON.stringify(expectedGame)) {
		fail('Candidate game identity does not match the canonical frontend and math sources');
	}
	const expectedMathEvidence = {
		candidateFingerprintSha256: canonicalVerifyResult.candidate_fingerprint_sha256,
		eventSchemaSha256: canonicalVerifyResult.canonical_event_schema_sha256,
		booksVerified: canonicalVerifyResult.books_verified,
		gatesPassed: canonicalVerifyResult.gates_passed,
		gatesTotal: canonicalVerifyResult.gates_total,
		candidateManifest: candidateManifestFact,
		verifyResult: verifyResultFact,
		gameConfigEvidenceOnly: {
			...canonicalConfigFact,
			gameId: canonicalConfig.game_id,
			candidateVersion: canonicalConfig.candidate_version,
			note: 'Evidence only; official minimal math upload folder contains index.json plus referenced CSV/ZST files.',
		},
		uploadPayloadFiles: canonicalCandidateManifest.upload_payload_files,
	};
	if (JSON.stringify(manifest.mathEvidence) !== JSON.stringify(expectedMathEvidence)) {
		fail('Candidate math evidence fields do not exactly match the canonical M1 sources');
	}
	if (
		readFileSync(readmePath, 'utf8') !==
		expectedReadme(
			expectedBranch,
			currentGitSha,
			frontendPackageJson.version,
			canonicalConfig.candidate_version,
		)
	) {
		fail('Candidate README does not match the canonical payload identity and release boundary');
	}

	const modeResults = [];
	for (const mode of expectedModes) {
		const lookupPath = join(mathRoot, mode.weights);
		const bookPath = join(mathRoot, mode.events);
		assertFileEquals(lookupPath, join(mathLibrary, 'lookup_tables', mode.weights), mode.weights);
		assertFileEquals(bookPath, join(mathLibrary, 'books_compressed', mode.events), mode.events);
		const payouts = readLookup(lookupPath, mode.name);
		const books = await verifyBook(bookPath, mode.name, payouts);
		modeResults.push({ mode: mode.name, cost: mode.cost, books, lookupRows: payouts.length - 1 });
	}

	const verification = {
		schema: 'blacksite-upload-candidate-verification-v1',
		result: 'PASS',
		lifecycle: manifest.lifecycle,
		verifiedAt: new Date().toISOString(),
		gitBranch: manifest.git.branch,
		gitSha: manifest.git.sha,
		candidateRoot,
		frontend: frontendManifest,
		frontendHygiene,
		math: mathManifest,
		modeResults,
		claims: {
			uploadPayloadStructureAndIdentity: 'PASS',
			bookLookupIdAndPayoutMatch: 'PASS',
			stakeApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	};
	if (process.argv.includes('--write-result')) {
		writeFileSync(
			join(candidateRoot, 'package-verification.json'),
			`${JSON.stringify(verification, null, 2)}\n`,
		);
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				result: verification.result,
				gitBranch: verification.gitBranch,
				gitSha: verification.gitSha,
				frontendTreeSha256: frontendManifest.treeSha256,
				frontendHygiene,
				mathTreeSha256: mathManifest.treeSha256,
				modeResults,
			},
			null,
			2,
		)}\n`,
	);
}

main().catch((error) => {
	console.error(error.stack || error);
	process.exitCode = 1;
});
