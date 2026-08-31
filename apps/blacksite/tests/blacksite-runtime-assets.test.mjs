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
const environmentAssets = Object.freeze([
	{
		id: 'product.environment.mechanical_vault.desktop.v1',
		source: new URL('../art/production/environment/mechanical-vault-desktop-v1.png', import.meta.url),
		runtime: new URL('../static/assets/blacksite/environment/mechanical-vault-desktop-v1.webp', import.meta.url),
		bytes: 77_992,
	},
	{
		id: 'product.environment.mechanical_vault.portrait.v1',
		source: new URL('../art/production/environment/mechanical-vault-portrait-v1.png', import.meta.url),
		runtime: new URL('../static/assets/blacksite/environment/mechanical-vault-portrait-v1.webp', import.meta.url),
		bytes: 48_628,
	},
]);
const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const assetMapUrl = new URL('../src/lib/assets/blacksite-assets.js', import.meta.url);
const imagePaintUrl = new URL('../src/lib/assets/image-paint.js', import.meta.url);
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
	assert.match(
		page,
		/data-testid="vaultkeeper-presence"[\s\S]*data-character-state=[\s\S]*data-asset-state=[\s\S]*aria-hidden="true"/u,
	);
	assert.match(page, /on:error=\{handleCharacterAssetError\}/u);
	assert.match(page, /data-asset-paint-state=\{characterAssetState\}/u);
	assert.match(page, /data-testid="vaultkeeper-safe-fallback"/u);
	assert.match(page, /\[data-asset-state='fallback'\][\s\S]*vaultkeeper-safe-fallback/u);
	assert.match(page, /\.vaultkeeper-presence \{[\s\S]*pointer-events: none;/u);
	assert.equal((page.match(/\.vaultkeeper-presence,/gu) ?? []).length >= 2, true);
});

test('responsive mechanical vault sources and optimized runtime exports match the manifest', async () => {
	const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
	for (const expected of environmentAssets) {
		const asset = manifest.assets.find((candidate) => candidate.id === expected.id);
		const [source, runtime] = await Promise.all([
			readFile(expected.source),
			readFile(expected.runtime),
		]);

		assert.ok(asset);
		assert.equal(asset.status, 'production-candidate');
		assert.equal(asset.runtimeEligible, true);
		assert.equal(asset.sourceSha256, sha256(source));
		assert.equal(asset.sha256, sha256(runtime));
		assert.equal(runtime.byteLength, expected.bytes);
	}
});

test('runtime selects an independent portrait vault plate without exposing decorative semantics', async () => {
	const [page, assetMap] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(assetMapUrl, 'utf8'),
	]);

	assert.match(assetMap, /vaultDesktop:[\s\S]*mechanical-vault-desktop-v1\.webp/u);
	assert.match(assetMap, /vaultPortrait:[\s\S]*mechanical-vault-portrait-v1\.webp/u);
	assert.match(page, /data-testid="vault-environment"[\s\S]*aria-hidden="true"/u);
	assert.match(page, /media="\(max-width: 820px\)"[\s\S]*BLACKSITE_ASSETS\.environment\.vaultPortrait/u);
	assert.match(page, /BLACKSITE_ASSETS\.environment\.vaultDesktop/u);
	assert.match(page, /\.vault-environment \{[\s\S]*pointer-events: none;/u);
	assert.match(page, /data-asset-paint-state=\{environmentAssetState\}/u);
	assert.match(page, /waitForDecodedImagePaint/u);
});

test('asset paint barrier decodes, reveals and waits for two compositor frames', async () => {
	const { waitForDecodedImagePaint } = await import(imagePaintUrl.href);
	const order = [];
	const image = {
		complete: true,
		naturalWidth: 64,
		async decode() {
			order.push('decode');
		},
	};
	await waitForDecodedImagePaint(image, {
		reveal: () => order.push('reveal'),
		nextFrame: (callback) => {
			order.push('frame');
			callback(0);
			return 1;
		},
	});
	assert.deepEqual(order, ['decode', 'reveal', 'frame', 'frame']);
	await assert.rejects(
		waitForDecodedImagePaint({ complete: false, naturalWidth: 0 }),
		/IMAGE_NOT_LOADED/u,
	);
});

test('browser evidence identity includes shipped static assets', async () => {
	const source = await readFile(browserQaUrl, 'utf8');
	assert.match(source, /join\(repoRoot, 'apps', 'blacksite', 'static'\)/u);
	assert.match(source, /vaultkeeper fallback is.*compact-hidden.*and loaded/u);
	assert.match(source, /missing Vaultkeeper image switches to the deterministic mechanical silhouette/u);
	assert.match(source, /responsive mechanical vault environment selects/u);
});
