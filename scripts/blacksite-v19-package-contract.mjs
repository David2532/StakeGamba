import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(scriptDirectory, '..');
export const OUTPUTS_ROOT = dirname(REPO_ROOT);
export const FRONTEND_BUILD_ROOT = join(REPO_ROOT, 'apps', 'blacksite', 'build');
export const MATH_LIBRARY_ROOT = join(REPO_ROOT, 'math', 'games', 'blacksite_breach', 'library');
export const CONTRACT_PATH = join(
	REPO_ROOT,
	'docs',
	'blacksite',
	'V19_PACKAGE_CONTRACT.json',
);
export const STAGE_PREFIX = '.BLACKSITE_V19_STAGE_';

export const V18_COMMIT = '1edbc06c699bd6f1bbbd248cc16ac0c5dbe1ed94';
export const V18_FRONTEND_TREE =
	'65c5bd22b41edf9a4ba5332bc8d44c823b9382254fab08b4c95d43a9a480e88f';
export const V18_MATH_TREE =
	'778c128a547adbfdddb038e05957e206ae129dff2941df98a2aca3ee36276297';
export const V18_FRONTEND_ROOT_NAME = 'BLACKSITE_FRONTEND_UPLOAD_V18';
export const V18_MATH_ROOT_NAME = 'BLACKSITE_MATH_UPLOAD_V18';
export const V19_FRONTEND_ROOT_NAME = 'BLACKSITE_FRONTEND_UPLOAD_V19';
export const V19_MATH_ROOT_NAME = 'BLACKSITE_MATH_UPLOAD_V19';
export const V19_EVIDENCE_ROOT_NAME = 'BLACKSITE_V19_EVIDENCE';
export const V19_EVIDENCE_PAYLOAD_FILES = Object.freeze([
	'README_V19_CANDIDATE.txt',
	'V18_BASELINE_VERIFY.json',
	'V19_FRONTEND_BUILD_ACCEPTANCE.json',
	'V19_RELEASE_GATES.json',
]);

const V18_MATH_PATHS = Object.freeze([
	'base_books.jsonl.zst',
	'base_lookup.csv',
	'blackout_books.jsonl.zst',
	'blackout_lookup.csv',
	'deep_access_books.jsonl.zst',
	'deep_access_lookup.csv',
	'index.json',
]);

const TREE_ALGORITHM =
	'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)';

export function fail(message) {
	throw new Error(message);
}

export function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function fileFact(path) {
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

function createManifestFromRecords(records) {
	const normalized = records
		.map((record) => ({
			path: record.path.replaceAll('\\', '/'),
			absolutePath: record.absolutePath,
		}))
		.sort((left, right) => left.path.localeCompare(right.path, 'en'));
	const treeHash = createHash('sha256');
	const files = normalized.map((record) => {
		const bytes = readFileSync(record.absolutePath);
		const pathBytes = Buffer.byteLength(record.path, 'utf8');
		treeHash.update(Buffer.from(`${pathBytes}\0${record.path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		return {
			path: record.path,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		};
	});
	return {
		algorithm: TREE_ALGORITHM,
		treeSha256: treeHash.digest('hex'),
		fileCount: files.length,
		totalBytes: files.reduce((sum, record) => sum + record.bytes, 0),
		files,
	};
}

export function createFileManifest(root) {
	if (!existsSync(root)) fail(`Missing manifest root: ${root}`);
	return createManifestFromRecords(
		collectFiles(root).map((absolutePath) => ({
			path: relative(root, absolutePath),
			absolutePath,
		})),
	);
}

export function createFileManifestExcluding(root, excludedRelativePaths = []) {
	if (!existsSync(root)) fail(`Missing manifest root: ${root}`);
	const excluded = new Set(excludedRelativePaths.map((path) => path.replaceAll('\\', '/')));
	for (const path of excluded) {
		if (path.length === 0 || path.startsWith('/') || path.split('/').includes('..')) {
			fail(`Unsafe excluded manifest path: ${path}`);
		}
	}
	return createManifestFromRecords(
		collectFiles(root)
			.map((absolutePath) => ({
				path: relative(root, absolutePath).replaceAll('\\', '/'),
				absolutePath,
			}))
			.filter((record) => !excluded.has(record.path)),
	);
}

export function createSelectedFileManifest(root, relativePaths) {
	const uniquePaths = [...new Set(relativePaths)];
	if (uniquePaths.length !== relativePaths.length) fail('Selected manifest contains duplicate paths');
	return createManifestFromRecords(
		uniquePaths.map((path) => {
			if (
				typeof path !== 'string' ||
				path.length === 0 ||
				path.includes('\\') ||
				path.startsWith('/') ||
				path.split('/').includes('..')
			) {
				fail(`Unsafe selected manifest path: ${path}`);
			}
			const absolutePath = resolve(root, path);
			if (relative(resolve(root), absolutePath).replaceAll('\\', '/') !== path) {
				fail(`Selected manifest path escapes or changes identity: ${path}`);
			}
			if (!existsSync(absolutePath)) fail(`Missing selected manifest file: ${absolutePath}`);
			return { path, absolutePath };
		}),
	);
}

export function summarizeManifest(manifest) {
	return {
		treeSha256: manifest.treeSha256,
		fileCount: manifest.fileCount,
		totalBytes: manifest.totalBytes,
	};
}

export function extensionCounts(manifest) {
	const counts = {};
	for (const file of manifest.files) {
		const name = file.path.toLowerCase();
		const extension = name.includes('.') ? `.${name.split('.').at(-1)}` : '(none)';
		counts[extension] = (counts[extension] ?? 0) + 1;
	}
	return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function assertManifestSummary(actual, expected, context) {
	for (const field of ['treeSha256', 'fileCount', 'totalBytes']) {
		if (actual[field] !== expected[field]) {
			fail(`${context} ${field} mismatch: expected ${expected[field]}, received ${actual[field]}`);
		}
	}
}

function assertManifestFiles(actual, expectedFiles, context) {
	if (JSON.stringify(actual.files) !== JSON.stringify(expectedFiles)) {
		fail(`${context} file identity set differs from the pinned V18 contract`);
	}
}

function assertExactChild(parent, child, expectedName, context) {
	const resolvedParent = resolve(parent);
	const resolvedChild = resolve(child);
	if (dirname(resolvedChild) !== resolvedParent || basename(resolvedChild) !== expectedName) {
		fail(`${context} must be the direct child ${expectedName} of ${resolvedParent}`);
	}
	return resolvedChild;
}

export function outputPaths(contract = loadContract()) {
	return {
		v18Frontend: assertExactChild(
			OUTPUTS_ROOT,
			join(OUTPUTS_ROOT, contract.v18Baseline.frontend.rootName),
			V18_FRONTEND_ROOT_NAME,
			'V18 frontend root',
		),
		v18Math: assertExactChild(
			OUTPUTS_ROOT,
			join(OUTPUTS_ROOT, contract.v18Baseline.math.rootName),
			V18_MATH_ROOT_NAME,
			'V18 math root',
		),
		v19Frontend: assertExactChild(
			OUTPUTS_ROOT,
			join(OUTPUTS_ROOT, contract.v19Outputs.frontendRootName),
			V19_FRONTEND_ROOT_NAME,
			'V19 frontend root',
		),
		v19Math: assertExactChild(
			OUTPUTS_ROOT,
			join(OUTPUTS_ROOT, contract.v19Outputs.mathRootName),
			V19_MATH_ROOT_NAME,
			'V19 math root',
		),
		v19Evidence: assertExactChild(
			OUTPUTS_ROOT,
			join(OUTPUTS_ROOT, contract.v19Outputs.evidenceRootName),
			V19_EVIDENCE_ROOT_NAME,
			'V19 evidence root',
		),
	};
}

function validateGateValues(record, expected, context) {
	if (!record || Object.keys(record).length === 0) fail(`${context} must not be empty`);
	for (const [name, value] of Object.entries(record)) {
		if (value !== expected) fail(`${context}.${name} must remain ${expected}`);
	}
}

export function validateContract(contract) {
	if (contract.schema !== 'blacksite-v19-package-contract-v1') fail('Unknown V19 contract schema');
	if (contract.lifecycle !== 'V19_IMPLEMENTATION_BASELINE_NOT_RELEASE' || contract.version !== 19) {
		fail('V19 contract lifecycle/version mismatch');
	}
	if (
		contract.v18Baseline?.gitCommit !== V18_COMMIT ||
		contract.v18Baseline?.frontend?.rootName !== V18_FRONTEND_ROOT_NAME ||
		contract.v18Baseline?.frontend?.treeSha256 !== V18_FRONTEND_TREE ||
		contract.v18Baseline?.frontend?.fileCount !== 360 ||
		contract.v18Baseline?.frontend?.totalBytes !== 22_158_429 ||
		contract.v18Baseline?.math?.rootName !== V18_MATH_ROOT_NAME ||
		contract.v18Baseline?.math?.treeSha256 !== V18_MATH_TREE ||
		contract.v18Baseline?.math?.fileCount !== 7 ||
		contract.v18Baseline?.math?.totalBytes !== 4_429_320
	) {
		fail('V18 baseline identity is not the pinned 1edbc06/V18 package set');
	}
	const mathPaths = contract.v18Baseline.math.files?.map((file) => file.path);
	if (JSON.stringify(mathPaths) !== JSON.stringify(V18_MATH_PATHS)) {
		fail('V18 math file set/order mismatch');
	}
	if (
		contract.v19Outputs?.frontendRootName !== V19_FRONTEND_ROOT_NAME ||
		contract.v19Outputs?.mathRootName !== V19_MATH_ROOT_NAME ||
		contract.v19Outputs?.evidenceRootName !== V19_EVIDENCE_ROOT_NAME
	) {
		fail('V19 output root names must remain exact and isolated from V18');
	}
	if (
		contract.frontendAcceptance?.state !== 'UNBOUND_UNTIL_FINAL_BUILD' ||
		contract.frontendAcceptance?.treeSha256 !== null ||
		contract.frontendAcceptance?.requireCallerPinnedTree !== true ||
		contract.frontendAcceptance?.requireCleanExactCommit !== true ||
		contract.frontendAcceptance?.requireV18Ancestor !== true ||
		contract.frontendAcceptance?.rejectV18Tree !== true
	) {
		fail('V19 frontend must remain unbound until a caller pins the final fresh build tree');
	}
	if (
		contract.mathAcceptance?.state !== 'PINNED_BYTE_IDENTICAL_TO_V18' ||
		contract.mathAcceptance?.copySource !== V18_MATH_ROOT_NAME ||
		contract.mathAcceptance?.requireRepositoryPayloadMatch !== true
	) {
		fail('V19 math policy must remain byte-identical to the V18 upload package');
	}
	const releaseTruth = contract.releaseTruth;
	if (
		releaseTruth?.lifecycle !== 'V19_TECHNICAL_CANDIDATE_NOT_RELEASE' ||
		releaseTruth?.releaseDecision !== 'BLOCKED' ||
		releaseTruth?.releaseReady !== false ||
		releaseTruth?.uploadAuthorized !== false ||
		releaseTruth?.automatedExactPackageGate !== 'NOT_RUN'
	) {
		fail('V19 release truth must remain blocked and unauthorized');
	}
	validateGateValues(releaseTruth.manualGates, 'OPEN', 'releaseTruth.manualGates');
	validateGateValues(releaseTruth.externalGates, 'EXTERNAL_PENDING', 'releaseTruth.externalGates');
	return contract;
}

export function loadContract() {
	if (!existsSync(CONTRACT_PATH)) fail(`Missing V19 package contract: ${CONTRACT_PATH}`);
	return validateContract(readJson(CONTRACT_PATH));
}

function canonicalMathSourcePath(fileName) {
	if (fileName === 'index.json') return join(MATH_LIBRARY_ROOT, 'publish_files', fileName);
	if (fileName.endsWith('_lookup.csv')) return join(MATH_LIBRARY_ROOT, 'lookup_tables', fileName);
	if (fileName.endsWith('_books.jsonl.zst')) {
		return join(MATH_LIBRARY_ROOT, 'books_compressed', fileName);
	}
	fail(`Unsupported pinned math file: ${fileName}`);
}

export function createCanonicalMathManifest(contract = loadContract()) {
	return createManifestFromRecords(
		contract.v18Baseline.math.files.map((file) => ({
			path: file.path,
			absolutePath: canonicalMathSourcePath(file.path),
		})),
	);
}

export function gitText(args) {
	return execFileSync('git', args, {
		cwd: REPO_ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

export function gitCommitExists(commit) {
	const result = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
		cwd: REPO_ROOT,
		stdio: 'ignore',
	});
	return result.status === 0;
}

export function gitIsAncestor(ancestor, descendant) {
	const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
		cwd: REPO_ROOT,
		stdio: 'ignore',
	});
	return result.status === 0;
}

export function assertV19SourceIdentity(expectedCommit) {
	if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) fail('Expected commit must be a full lowercase Git SHA');
	const head = gitText(['rev-parse', 'HEAD']);
	const status = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
	if (head !== expectedCommit) {
		fail(`Current Git SHA ${head} does not match the caller-pinned V19 SHA ${expectedCommit}`);
	}
	if (status !== '') fail(`Worktree must be clean before V19 packaging:\n${status}`);
	if (head === V18_COMMIT) fail('V19 packaging refuses to relabel the unchanged V18 baseline as V19');
	if (!gitCommitExists(V18_COMMIT) || !gitIsAncestor(V18_COMMIT, head)) {
		fail(`V19 candidate commit must descend from the pinned V18 baseline ${V18_COMMIT}`);
	}
	return { head, status };
}

export function verifyV18Baseline(contract = loadContract()) {
	if (!gitCommitExists(V18_COMMIT)) fail(`Pinned V18 commit is unavailable: ${V18_COMMIT}`);
	const paths = outputPaths(contract);
	for (const path of [paths.v18Frontend, paths.v18Math]) {
		if (!existsSync(path)) fail(`Missing pinned V18 baseline package: ${path}`);
	}
	const frontend = createFileManifest(paths.v18Frontend);
	const math = createFileManifest(paths.v18Math);
	const repositoryMath = createCanonicalMathManifest(contract);
	assertManifestSummary(frontend, contract.v18Baseline.frontend, 'V18 frontend baseline');
	assertManifestSummary(math, contract.v18Baseline.math, 'V18 math baseline');
	assertManifestFiles(math, contract.v18Baseline.math.files, 'V18 math baseline');
	assertManifestSummary(repositoryMath, contract.v18Baseline.math, 'Repository math payload');
	assertManifestFiles(repositoryMath, contract.v18Baseline.math.files, 'Repository math payload');
	return {
		contract: fileFact(CONTRACT_PATH),
		gitCommit: V18_COMMIT,
		frontend: summarizeManifest(frontend),
		math: summarizeManifest(math),
		repositoryMath: summarizeManifest(repositoryMath),
		mathByteIdentical: true,
	};
}

export function assertV19OutputsAbsent(contract = loadContract()) {
	const paths = outputPaths(contract);
	for (const path of [paths.v19Frontend, paths.v19Math, paths.v19Evidence]) {
		if (existsSync(path)) fail(`V19 output already exists; refusing to overwrite: ${path}`);
	}
	return paths;
}

export function createStagePath(identifier) {
	if (!/^[0-9A-Za-z_-]+$/u.test(identifier)) fail('Unsafe V19 stage identifier');
	const name = `${STAGE_PREFIX}${identifier}`;
	return assertExactChild(OUTPUTS_ROOT, join(OUTPUTS_ROOT, name), name, 'V19 stage root');
}

export function assertDisposableStagePath(path) {
	const resolvedPath = resolve(path);
	if (dirname(resolvedPath) !== OUTPUTS_ROOT || !basename(resolvedPath).startsWith(STAGE_PREFIX)) {
		fail(`Refusing destructive cleanup outside an exact V19 stage sibling: ${resolvedPath}`);
	}
	return resolvedPath;
}

export function writeJsonExclusive(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

export function releaseGateEvidence(contract = loadContract()) {
	return {
		schema: 'blacksite-v19-release-gates-v1',
		lifecycle: contract.releaseTruth.lifecycle,
		releaseDecision: contract.releaseTruth.releaseDecision,
		releaseReady: contract.releaseTruth.releaseReady,
		uploadAuthorized: contract.releaseTruth.uploadAuthorized,
		automatedExactPackageGate: contract.releaseTruth.automatedExactPackageGate,
		manualGates: contract.releaseTruth.manualGates,
		externalGates: contract.releaseTruth.externalGates,
		note:
			'Package generation proves byte identity only. Manual, external, extracted-browser and live gates remain open until separately evidenced.',
	};
}
