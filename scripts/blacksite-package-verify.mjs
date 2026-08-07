import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	createReadStream,
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
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

function fail(message) {
	throw new Error(message);
}

function parseCandidateArgument() {
	const index = process.argv.indexOf('--candidate');
	if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
		fail(
			'Usage: node scripts/blacksite-package-verify.mjs --candidate <directory> [--write-result]',
		);
	}
	return resolve(repoRoot, process.argv[index + 1]);
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

function gitHead() {
	return execFileSync('git', ['rev-parse', 'HEAD'], {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function gitStatus() {
	return execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

async function main() {
	const candidateRoot = parseCandidateArgument();
	const frontendRoot = join(candidateRoot, 'frontend');
	const mathRoot = join(candidateRoot, 'math');
	const manifestPath = join(candidateRoot, 'candidate-manifest.json');
	for (const path of [frontendRoot, join(frontendRoot, 'index.html'), mathRoot, manifestPath]) {
		if (!existsSync(path)) fail(`Missing candidate path: ${path}`);
	}

	const manifest = readJson(manifestPath);
	if (manifest.schema !== 'blacksite-upload-candidate-v1')
		fail('Unknown candidate manifest schema');
	if (manifest.lifecycle !== 'PACKAGE_CANDIDATE_GENERATED_NOT_SUBMISSION_READY') {
		fail('Candidate lifecycle must remain explicitly non-submission-ready');
	}
	if (manifest.approvalStatus !== 'MANUAL_PRODUCTION_AND_EXTERNAL_GATES_OPEN') {
		fail('Candidate approval status must retain the open manual/production/external gates');
	}
	if (manifest.git?.sha !== gitHead()) fail('Candidate SHA does not match current checkout');
	if (
		manifest.git?.dirty !== false ||
		manifest.git?.cleanBefore !== true ||
		manifest.git?.cleanAfter !== true ||
		manifest.git?.sha !== manifest.git?.expectedSha ||
		gitStatus() !== ''
	) {
		fail('Candidate and current checkout must be bound to the same clean worktree');
	}
	if (manifest.uploadAuthorized !== false)
		fail('Candidate must explicitly remain unauthorized for upload');

	const frontendManifest = createFileManifest(frontendRoot);
	const mathManifest = createFileManifest(mathRoot);
	assertManifestEqual(frontendManifest, manifest.packages?.frontend, 'Frontend');
	assertManifestEqual(mathManifest, manifest.packages?.math, 'Math');

	const frontendTopLevel = readdirSync(frontendRoot).sort();
	if (JSON.stringify(frontendTopLevel) !== JSON.stringify(['_app', 'index.html'])) {
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
		gitSha: manifest.git.sha,
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
				gitSha: verification.gitSha,
				frontendTreeSha256: frontendManifest.treeSha256,
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
