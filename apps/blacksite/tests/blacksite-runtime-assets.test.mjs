import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../art/asset-manifest.json', import.meta.url);
const runtimeAssetUrl = new URL(
	'../static/assets/blacksite/character/penguin-vaultkeeper-fallback-v1.webp',
	import.meta.url,
);
const sourceAssetUrl = new URL(
	'../art/production/character/penguin-vaultkeeper-fallback-v1.png',
	import.meta.url,
);
const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const assetMapUrl = new URL('../src/lib/assets/blacksite-assets.js', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

function sha256(buffer) {
	return createHash('sha256').update(buffer).digest('hex');
}

test('penguin fallback source and optimized runtime export match the manifest', async () => {
	const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
	const asset = manifest.assets.find(
		(candidate) => candidate.id === 'product.character.penguin_vaultkeeper.fallback.v1',
	);
	const [source, runtime] = await Promise.all([
		readFile(sourceAssetUrl),
		readFile(runtimeAssetUrl),
	]);

	assert.ok(asset);
	assert.equal(asset.status, 'production-candidate');
	assert.equal(asset.runtimeEligible, true);
	assert.equal(asset.sourceSha256, sha256(source));
	assert.equal(asset.sha256, sha256(runtime));
	assert.equal(runtime.byteLength, 78_732);
	assert.equal(
		asset.runtimePath,
		'apps/blacksite/static/assets/blacksite/character/penguin-vaultkeeper-fallback-v1.webp',
	);
});

test('runtime uses the semantic asset map and hides decorative character in compact layouts', async () => {
	const [page, assetMap] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(assetMapUrl, 'utf8'),
	]);

	assert.match(assetMap, /vaultkeeperFallback:[\s\S]*penguin-vaultkeeper-fallback-v1\.webp/u);
	assert.match(page, /BLACKSITE_ASSETS\.character\.vaultkeeperFallback/u);
	assert.match(page, /data-testid="vaultkeeper-presence" aria-hidden="true"/u);
	assert.match(page, /\.vaultkeeper-presence \{[\s\S]*pointer-events: none;/u);
	assert.equal((page.match(/\.vaultkeeper-presence,/gu) ?? []).length >= 2, true);
});

test('browser evidence identity includes shipped static assets', async () => {
	const source = await readFile(browserQaUrl, 'utf8');
	assert.match(source, /join\(repoRoot, 'apps', 'blacksite', 'static'\)/u);
	assert.match(source, /vaultkeeper fallback is.*compact-hidden.*and loaded/u);
});
