import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	cpSync,
	createReadStream,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CANDIDATE_FINGERPRINT_SHA256,
	EVENT_CONTRACT,
	EVENT_SCHEMA_SHA256,
} from '../apps/blacksite/src/lib/contracts/modes.js';
import { GameEventAdapter } from '../apps/blacksite/src/lib/runtime/game-event-adapter.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const frontendSource = join(repoRoot, 'apps', 'blacksite', 'build');
const mathLibrary = join(repoRoot, 'math', 'games', 'blacksite_breach', 'library');
const mathIndexSource = join(mathLibrary, 'publish_files', 'index.json');
const mathConfigSource = join(mathLibrary, 'configs', 'game_config.json');
const mathEventSchemaSource = join(mathLibrary, 'configs', 'event_schema.json');
const mathVerifySource = join(mathLibrary, 'publish_files', 'VERIFY_RESULT.json');
const mathCandidateSource = join(mathLibrary, 'publish_files', 'CANDIDATE_MANIFEST.json');
const expectedMathLifecycle = 'MATH_V3_CANDIDATE_NOT_RELEASE';
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
const expectedFrontendEntries = Object.freeze(['_app', 'assets', 'index.html']);
const sourceInputPaths = Object.freeze([
	'apps/blacksite/package.json',
	'apps/blacksite/svelte.config.js',
	'apps/blacksite/vite.config.js',
	'apps/blacksite/src',
	'apps/blacksite/static',
	'apps/blacksite/scripts',
	'math/games/blacksite_breach/config',
	'math/games/blacksite_breach/src',
	'math/games/blacksite_breach/generate.mjs',
	'math/games/blacksite_breach/verify.mjs',
	'math/games/blacksite_breach/library/configs',
	'math/games/blacksite_breach/library/publish_files',
	'math/games/blacksite_breach/library/lookup_tables',
	'math/games/blacksite_breach/library/books_compressed',
]);
const eventAdapter = new GameEventAdapter();

function fail(message) {
	throw new Error(message);
}

function argumentValue(name) {
	const index = process.argv.indexOf(name);
	if (index < 0) return null;
	if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(`Missing value for ${name}`);
	}
	return process.argv[index + 1];
}

function parseArguments() {
	const output = argumentValue('--output');
	const verify = argumentValue('--verify');
	if (Boolean(output) === Boolean(verify)) {
		fail(
			'Usage: node scripts/blacksite-stake-working-tree-snapshot.mjs (--output <new-directory> | --verify <existing-directory>) [--write-result]',
		);
	}
	return {
		mode: output ? 'create' : 'verify',
		candidateRoot: resolve(repoRoot, output ?? verify),
		writeResult: process.argv.includes('--write-result') || Boolean(output),
	};
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

function manifestFromFiles(root, files, includeRecords = true) {
	const uniqueFiles = [...new Set(files.map((path) => resolve(path)))].sort((left, right) =>
		relative(root, left)
			.replaceAll('\\', '/')
			.localeCompare(relative(root, right).replaceAll('\\', '/'), 'en'),
	);
	const treeHash = createHash('sha256');
	const records = uniqueFiles.map((absolutePath) => {
		const path = relative(root, absolutePath).replaceAll('\\', '/');
		if (path.startsWith('../') || path === '..')
			fail(`File escapes manifest root: ${absolutePath}`);
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
	const manifest = {
		algorithm:
			'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)',
		treeSha256: treeHash.digest('hex'),
		fileCount: records.length,
		totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
	};
	if (includeRecords) manifest.files = records;
	return manifest;
}

function createFileManifest(root, includeRecords = true) {
	return manifestFromFiles(root, collectFiles(root), includeRecords);
}

function createSourceInputManifest() {
	const files = [];
	for (const inputPath of sourceInputPaths) {
		const absolutePath = join(repoRoot, inputPath);
		if (!existsSync(absolutePath)) fail(`Missing source snapshot input: ${inputPath}`);
		collectFiles(absolutePath, files);
	}
	return manifestFromFiles(repoRoot, files, false);
}

function gitText(args) {
	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function gitStatusSnapshot() {
	const text = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).replaceAll('\r\n', '\n');
	return {
		dirty: text.length > 0,
		entryCount: text.length === 0 ? 0 : text.trimEnd().split('\n').length,
		sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
		text,
	};
}

function assertFrontendRoot(frontendRoot) {
	if (!existsSync(join(frontendRoot, 'index.html'))) {
		fail(`Missing frontend index.html: ${frontendRoot}`);
	}
	const entries = readdirSync(frontendRoot).sort();
	if (JSON.stringify(entries) !== JSON.stringify(expectedFrontendEntries)) {
		fail(`Unexpected frontend root entries: ${entries.join(', ')}`);
	}
}

function assertCanonicalMathEvidence() {
	for (const path of [
		mathIndexSource,
		mathConfigSource,
		mathEventSchemaSource,
		mathVerifySource,
		mathCandidateSource,
	]) {
		if (!existsSync(path)) fail(`Missing canonical BLACKSITE math evidence: ${path}`);
	}
	const index = readJson(mathIndexSource);
	if (JSON.stringify(index) !== JSON.stringify({ modes: expectedModes })) {
		fail('Canonical BLACKSITE math index differs from the exact mode contract');
	}
	const gameConfig = readJson(mathConfigSource);
	const eventSchema = readJson(mathEventSchemaSource);
	const verifyResult = readJson(mathVerifySource);
	const candidateManifest = readJson(mathCandidateSource);
	if (
		gameConfig.game_id !== 'blacksite_breach' ||
		gameConfig.lifecycle !== expectedMathLifecycle ||
		verifyResult.result !== 'PASS' ||
		!verifyResult.all_gates_passed ||
		candidateManifest.lifecycle !== expectedMathLifecycle ||
		candidateManifest.candidate_fingerprint_sha256 !== CANDIDATE_FINGERPRINT_SHA256 ||
		verifyResult.candidate_fingerprint_sha256 !== CANDIDATE_FINGERPRINT_SHA256 ||
		verifyResult.canonical_event_schema_sha256 !== EVENT_SCHEMA_SHA256 ||
		eventSchema.contract !== EVENT_CONTRACT ||
		eventSchema.schema_version !== 3
	) {
		fail('Canonical BLACKSITE math identity/lifecycle evidence is not the verified v3 candidate');
	}
	const files = [
		{ outputName: 'index.json', absolutePath: mathIndexSource },
		...expectedModes.flatMap((mode) => [
			{
				outputName: mode.weights,
				absolutePath: join(mathLibrary, 'lookup_tables', mode.weights),
			},
			{
				outputName: mode.events,
				absolutePath: join(mathLibrary, 'books_compressed', mode.events),
			},
		]),
	];
	const expectedEvidencePaths = new Map(
		candidateManifest.upload_payload_files.map((record) => [record.path, record]),
	);
	for (const file of files) {
		if (!existsSync(file.absolutePath))
			fail(`Missing canonical math upload file: ${file.absolutePath}`);
		const libraryPath = relative(mathLibrary, file.absolutePath).replaceAll('\\', '/');
		const expected = expectedEvidencePaths.get(libraryPath);
		const actual = fileFact(file.absolutePath);
		if (!expected || expected.bytes !== actual.bytes || expected.sha256 !== actual.sha256) {
			fail(`Math upload byte identity differs from candidate evidence: ${libraryPath}`);
		}
	}
	return { index, gameConfig, eventSchema, verifyResult, candidateManifest, files };
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
		const [id, weight, payout] = columns.map(Number);
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
		eventAdapter.adaptBook(book, { expectedMode: modeName });
	}
	if (id !== booksPerMode) fail(`${modeName}: expected ${booksPerMode} books, received ${id}`);
	return id;
}

function assertFileEquals(actual, canonical, context) {
	if (!readFileSync(actual).equals(readFileSync(canonical))) {
		fail(`${context} differs from the canonical source`);
	}
}

function assertManifestEqual(actual, expected, context) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		fail(`${context} tree manifest does not match candidate-manifest.json`);
	}
}

async function verifyCandidate(candidateRoot, writeResult) {
	const frontendRoot = join(candidateRoot, 'frontend');
	const mathRoot = join(candidateRoot, 'math');
	const manifestPath = join(candidateRoot, 'candidate-manifest.json');
	for (const path of [frontendRoot, mathRoot, manifestPath]) {
		if (!existsSync(path)) fail(`Missing candidate path: ${path}`);
	}
	assertFrontendRoot(frontendRoot);
	const manifest = readJson(manifestPath);
	if (manifest.schema !== 'blacksite-working-tree-upload-snapshot-v1') {
		fail('Unknown technical snapshot manifest schema');
	}
	if (manifest.lifecycle !== 'WORKTREE_SNAPSHOT_TECHNICAL_UPLOAD_SHAPE_NOT_RELEASE') {
		fail('Technical snapshot lifecycle must remain explicitly non-release');
	}
	if (manifest.uploadAuthorized !== false) fail('Technical snapshot must remain unauthorized');
	if (manifest.approvalStatus !== 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN') {
		fail('Technical snapshot must preserve all manual/production/external gates');
	}
	const frontendManifest = createFileManifest(frontendRoot);
	const mathManifest = createFileManifest(mathRoot);
	assertManifestEqual(frontendManifest, manifest.packages?.frontend, 'Frontend');
	assertManifestEqual(mathManifest, manifest.packages?.math, 'Math');

	const { gameConfig, verifyResult, files } = assertCanonicalMathEvidence();
	const expectedMathNames = files.map((file) => file.outputName).sort();
	const actualMathNames = readdirSync(mathRoot).sort();
	if (JSON.stringify(actualMathNames) !== JSON.stringify(expectedMathNames)) {
		fail(`Unexpected math root entries: ${actualMathNames.join(', ')}`);
	}
	for (const file of files) {
		assertFileEquals(join(mathRoot, file.outputName), file.absolutePath, file.outputName);
	}
	if (
		manifest.game?.id !== gameConfig.game_id ||
		manifest.game?.mathCandidateVersion !== gameConfig.candidate_version ||
		manifest.mathEvidence?.candidateFingerprintSha256 !== CANDIDATE_FINGERPRINT_SHA256 ||
		manifest.mathEvidence?.eventContract !== EVENT_CONTRACT ||
		manifest.mathEvidence?.eventSchemaSha256 !== EVENT_SCHEMA_SHA256 ||
		manifest.mathEvidence?.booksVerified !== verifyResult.books_verified
	) {
		fail('Technical snapshot math identity does not match canonical evidence');
	}

	const modeResults = [];
	for (const mode of expectedModes) {
		const payouts = readLookup(join(mathRoot, mode.weights), mode.name);
		const books = await verifyBook(join(mathRoot, mode.events), mode.name, payouts);
		modeResults.push({ mode: mode.name, cost: mode.cost, books, lookupRows: payouts.length - 1 });
	}
	const verification = {
		schema: 'blacksite-working-tree-upload-snapshot-verification-v1',
		result: 'PASS',
		lifecycle: manifest.lifecycle,
		verifiedAt: new Date().toISOString(),
		candidateRoot,
		frontend: frontendManifest,
		math: mathManifest,
		modeResults,
		claims: {
			packageStructureAndIdentity: 'PASS',
			bookLookupIdAndPayoutMatch: 'PASS',
			stakeApproval: 'NOT_CLAIMED',
			releaseReadiness: 'NOT_CLAIMED',
		},
	};
	if (writeResult) {
		writeFileSync(
			join(candidateRoot, 'package-verification.json'),
			`${JSON.stringify(verification, null, 2)}\n`,
		);
	}
	return verification;
}

async function createCandidate(candidateRoot) {
	assertSafeNewOutput(candidateRoot);
	assertFrontendRoot(frontendSource);
	const math = assertCanonicalMathEvidence();
	const gitSha = gitText(['rev-parse', 'HEAD']);
	const gitBranch = gitText(['branch', '--show-current']);
	if (!/^[0-9a-f]{40}$/iu.test(gitSha)) fail(`Invalid git SHA: ${gitSha}`);
	const statusBefore = gitStatusSnapshot();
	const sourceInputsBefore = createSourceInputManifest();
	const frontendSourceManifest = createFileManifest(frontendSource);

	mkdirSync(candidateRoot, { recursive: true });
	const frontendRoot = join(candidateRoot, 'frontend');
	const mathRoot = join(candidateRoot, 'math');
	cpSync(frontendSource, frontendRoot, { recursive: true, errorOnExist: true });
	mkdirSync(mathRoot);
	for (const file of math.files) cpSync(file.absolutePath, join(mathRoot, file.outputName));

	const frontendPackage = createFileManifest(frontendRoot);
	const mathPackage = createFileManifest(mathRoot);
	assertManifestEqual(frontendPackage, frontendSourceManifest, 'Copied frontend');
	const statusAfter = gitStatusSnapshot();
	const sourceInputsAfter = createSourceInputManifest();
	if (statusAfter.text !== statusBefore.text) fail('Worktree status changed while packaging');
	if (JSON.stringify(sourceInputsAfter) !== JSON.stringify(sourceInputsBefore)) {
		fail('Frontend/math source inputs changed while packaging');
	}

	const frontendPackageJson = readJson(join(repoRoot, 'apps', 'blacksite', 'package.json'));
	const rootPackageJson = readJson(join(repoRoot, 'package.json'));
	const manifest = {
		schema: 'blacksite-working-tree-upload-snapshot-v1',
		lifecycle: 'WORKTREE_SNAPSHOT_TECHNICAL_UPLOAD_SHAPE_NOT_RELEASE',
		approvalStatus: 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN',
		uploadAuthorized: false,
		generatedAt: new Date().toISOString(),
		git: {
			branch: gitBranch,
			sha: gitSha,
			dirty: statusBefore.dirty,
			statusEntryCount: statusBefore.entryCount,
			statusSha256: statusBefore.sha256,
			unchangedDuringPackaging: true,
		},
		sourceSnapshot: {
			kind: 'WORKTREE_BUILD_INPUTS',
			inputRoots: sourceInputPaths,
			...sourceInputsBefore,
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
			verify: `node scripts/blacksite-stake-working-tree-snapshot.mjs --verify "${candidateRoot}" --write-result`,
			packageBrowserQa: `BLACKSITE_QA_BUILD_ROOT=<candidate>/frontend BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=${frontendPackage.treeSha256} node scripts/blacksite-qa-e2e.mjs`,
		},
		game: {
			id: math.gameConfig.game_id,
			name: math.gameConfig.game_name,
			frontendVersion: frontendPackageJson.version,
			mathCandidateVersion: math.gameConfig.candidate_version,
			mathLifecycle: math.gameConfig.lifecycle,
			modes: expectedModes,
		},
		mathEvidence: {
			candidateFingerprintSha256: CANDIDATE_FINGERPRINT_SHA256,
			eventContract: EVENT_CONTRACT,
			eventSchemaVersion: 3,
			eventSchemaSha256: EVENT_SCHEMA_SHA256,
			booksVerified: math.verifyResult.books_verified,
			gatesPassed: math.verifyResult.gates_passed,
			gatesTotal: math.verifyResult.gates_total,
			candidateManifest: fileFact(mathCandidateSource),
			verifyResult: fileFact(mathVerifySource),
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
			'This package is a byte-verified working-tree snapshot because the current UI/audio work is not committed.',
			'Upload only frontend/ as the frontend root and math/ as the math root; evidence files stay outside both roots.',
			'Math remains MATH_V3_CANDIDATE_NOT_RELEASE; no Stake, ACP, rights, audible, device or production approval is claimed.',
		],
	};
	writeFileSync(
		join(candidateRoot, 'candidate-manifest.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	writeFileSync(
		join(candidateRoot, 'README_UPLOAD_SNAPSHOT.txt'),
		[
			'BLACKSITE // BREACH — STAKE-SHAPED WORKTREE SNAPSHOT',
			'',
			'1. Upload frontend/ only as the frontend folder.',
			'2. Upload math/ only as the math folder.',
			'3. Keep candidate-manifest.json, package-verification.json and this README as local evidence.',
			'',
			`Git HEAD: ${gitSha}`,
			`Dirty worktree recorded: ${statusBefore.dirty ? 'YES' : 'NO'}`,
			`Frontend tree: ${frontendPackage.treeSha256}`,
			`Math tree: ${mathPackage.treeSha256}`,
			'',
			'This is an exact technical upload-shape snapshot. It is not an external Stake approval or release authorization.',
			'',
		].join('\n'),
	);
	return verifyCandidate(candidateRoot, true);
}

async function main() {
	const { mode, candidateRoot, writeResult } = parseArguments();
	const verification =
		mode === 'create'
			? await createCandidate(candidateRoot)
			: await verifyCandidate(candidateRoot, writeResult);
	process.stdout.write(
		`${JSON.stringify(
			{
				result: verification.result,
				candidateRoot,
				frontendTreeSha256: verification.frontend.treeSha256,
				frontendFiles: verification.frontend.fileCount,
				frontendBytes: verification.frontend.totalBytes,
				mathTreeSha256: verification.math.treeSha256,
				mathFiles: verification.math.fileCount,
				mathBytes: verification.math.totalBytes,
				modeResults: verification.modeResults,
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
