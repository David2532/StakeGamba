import { createHash } from 'node:crypto';
import {
	existsSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
} from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';

const staticPrefix = 'apps/blacksite/static/';
const buildIdentityPath = '_app/blacksite-build-identity.json';
const generatedInlineResidue = Object.freeze([
	'_app/immutable',
	'_app/env.js',
	'_app/version.json',
]);
const textExtensions = new Set(['.atlas', '.css', '.html', '.js', '.json']);
const forbiddenReleaseContent = Object.freeze([
	{
		label: 'private key',
		pattern: /-----BEGIN (?:DSA |EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/u,
	},
	{ label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u },
	{ label: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u },
	{ label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/u },
	{ label: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/u },
	{ label: 'Stripe key', pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/u },
	{ label: 'source map directive', pattern: /[#@]\s*sourceMappingURL\s*=/u },
	{ label: 'debugger statement', pattern: /\bdebugger\s*;/u },
	{ label: 'console debug statement', pattern: /\bconsole\.(?:debug|log|trace)\s*\(/u },
]);

function fail(message) {
	throw new Error(message);
}

function normalizedRelativePath(root, path) {
	return relative(root, path).replaceAll('\\', '/');
}

function collectRegularFiles(root, target = root, output = []) {
	const stats = statSync(target);
	if (stats.isFile()) {
		output.push(target);
		return output;
	}
	if (!stats.isDirectory()) fail(`Unsupported frontend package entry: ${target}`);
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((left, right) =>
		left.name.localeCompare(right.name, 'en'),
	)) {
		const child = join(target, entry.name);
		if (entry.isDirectory()) collectRegularFiles(root, child, output);
		else if (entry.isFile()) output.push(child);
		else fail(`Unsupported frontend package entry: ${normalizedRelativePath(root, child)}`);
	}
	return output;
}

function fileFact(path) {
	const bytes = readFileSync(path);
	return {
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
	};
}

function runtimeAssetRecords(assetManifest) {
	if (
		assetManifest?.schema !== 'blacksite-asset-manifest-v1' ||
		!Array.isArray(assetManifest.assets)
	) {
		fail('Invalid BLACKSITE asset manifest');
	}
	const records = [];
	const ids = new Set();
	const paths = new Set();
	for (const asset of assetManifest.assets) {
		if (asset?.runtimeEligible !== true) continue;
		if (typeof asset.id !== 'string' || asset.id.length === 0 || ids.has(asset.id)) {
			fail('Runtime asset IDs must be unique non-empty strings');
		}
		if (
			typeof asset.runtimePath !== 'string' ||
			!asset.runtimePath.startsWith(staticPrefix)
		) {
			fail(`${asset.id}: runtimePath must be inside ${staticPrefix}`);
		}
		const path = asset.runtimePath.slice(staticPrefix.length).replaceAll('\\', '/');
		if (
			path.length === 0 ||
			path.startsWith('/') ||
			posix.normalize(path) !== path ||
			path.split('/').includes('..') ||
			paths.has(path)
		) {
			fail(`${asset.id}: runtime asset path must be unique and normalized`);
		}
		if (typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(asset.sha256)) {
			fail(`${asset.id}: runtime asset requires a lowercase SHA-256 digest`);
		}
		ids.add(asset.id);
		paths.add(path);
		records.push({ id: asset.id, path, sha256: asset.sha256, status: asset.status ?? null });
	}
	return records.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function scanForbiddenContent(root, files) {
	for (const absolutePath of files) {
		const path = normalizedRelativePath(root, absolutePath);
		const extension = posix.extname(path).toLowerCase();
		if (!textExtensions.has(extension)) continue;
		const content = readFileSync(absolutePath, 'utf8');
		for (const rule of forbiddenReleaseContent) {
			if (rule.pattern.test(content)) {
				fail(`Forbidden release content ${rule.label} in ${path}`);
			}
		}
	}
}

export function pruneBlacksiteInlineBuildResidue(buildRoot) {
	const root = resolve(buildRoot);
	const indexPath = join(root, 'index.html');
	if (!existsSync(indexPath)) fail('Cannot prune inline build without index.html');
	const index = readFileSync(indexPath, 'utf8');
	const staticResourcePattern =
		/\b(?:href|poster|src|srcset)\s*=\s*(["'])[^"']*_app\/(?:env\.js|immutable\/|version\.json)[^"']*\1/iu;
	if (staticResourcePattern.test(index)) {
		fail('Inline build markup still loads generated _app residue');
	}
	const removed = [];
	for (const path of generatedInlineResidue) {
		const absolutePath = join(root, ...path.split('/'));
		if (!existsSync(absolutePath)) continue;
		const files = collectRegularFiles(root, absolutePath);
		for (const file of files) {
			const relativePath = normalizedRelativePath(root, file);
			removed.push({ path: relativePath, ...fileFact(file) });
		}
		rmSync(absolutePath, { recursive: true, force: true });
	}
	return {
		removedFiles: removed.length,
		removedBytes: removed.reduce((total, file) => total + file.bytes, 0),
		files: removed,
	};
}

export function verifyBlacksiteFrontendHygiene(frontendRoot, assetManifest) {
	const root = resolve(frontendRoot);
	const files = collectRegularFiles(root);
	const actualPaths = files
		.map((path) => normalizedRelativePath(root, path))
		.sort((left, right) => left.localeCompare(right, 'en'));
	const assets = runtimeAssetRecords(assetManifest);
	const expectedPaths = [
		buildIdentityPath,
		'index.html',
		...assets.map((asset) => asset.path),
	].sort((left, right) => left.localeCompare(right, 'en'));
	if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
		fail(
			`Unexpected or missing frontend package files: expected ${JSON.stringify(expectedPaths)}, received ${JSON.stringify(actualPaths)}`,
		);
	}

	const index = readFileSync(join(root, 'index.html'), 'utf8');
	for (const asset of assets) {
		const fact = fileFact(join(root, ...asset.path.split('/')));
		if (fact.sha256 !== asset.sha256) {
			fail(`Runtime asset hash mismatch for ${asset.path}`);
		}
		if (!index.includes(`/${asset.path}`) && !index.includes(asset.path)) {
			fail(`Runtime asset is packaged but unreachable from index.html: ${asset.path}`);
		}
		asset.bytes = fact.bytes;
	}
	scanForbiddenContent(root, files);
	return {
		result: 'PASS',
		contract: 'blacksite-inline-frontend-hygiene-v1',
		fileCount: actualPaths.length,
		totalBytes: files.reduce((total, file) => total + statSync(file).size, 0),
		runtimeAssetCount: assets.length,
		runtimeAssetPaths: assets.map((asset) => asset.path),
		runtimeAssets: assets,
		claims: {
			exactFileAllowlist: 'PASS',
			runtimeAssetProvenance: 'PASS',
			deadRuntimeAssets: 'NONE',
			highConfidenceSecretScan: 'PASS',
			debugAndSourceMapScan: 'PASS',
			assetRightsApproval: 'NOT_CLAIMED',
		},
	};
}
