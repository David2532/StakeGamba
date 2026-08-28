import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rigSource = await readFile(
	new URL('../src/lib/components/DevVaultRig.svelte', import.meta.url),
	'utf8',
);
const cinematicSource = await readFile(
	new URL('../src/lib/components/VaultCinematic.svelte', import.meta.url),
	'utf8',
);

function cssBlock(source, selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'u'))?.[1] ?? '';
}

test('DEV Vault door exposes one volumetric assembly with front, back and depth hooks', () => {
	assert.match(rigSource, /data-testid="vault-dev-2d5-rig"/u);
	assert.match(rigSource, /data-dev-only="true"/u);
	assert.match(rigSource, /data-testid="vault-dev-door-assembly"/u);
	assert.match(rigSource, /data-vault-hinge="right"/u);

	for (const layer of ['front', 'back', 'depth']) {
		assert.equal(
			(rigSource.match(new RegExp(`data-vault-door-layer="${layer}"`, 'gu')) ?? []).length,
			1,
			`DEV Vault door must expose exactly one ${layer} geometry layer`,
		);
	}
});

test('DEV Vault door uses perspective, preserved 3D geometry and an exact right-edge hinge', () => {
	const perspective = cssBlock(rigSource, '.dev-vault-perspective');
	const assembly = cssBlock(rigSource, '.dev-vault-door-assembly');
	const front = cssBlock(rigSource, '.dev-vault-door-front');
	const back = cssBlock(rigSource, '.dev-vault-door-back');
	const depth = cssBlock(rigSource, '.dev-vault-door-depth');

	assert.match(perspective, /perspective:\s*(?!none)[^;]+;/u);
	assert.match(assembly, /transform-style:\s*preserve-3d\s*;/u);
	assert.match(
		assembly,
		/transform-origin:\s*(?:right\s+center|100%\s+50%)\s*;/u,
		'the physical hinge must sit on the exact right edge, not an approximate inset pivot',
	);
	assert.match(front, /translateZ\(\s*(?!0(?:px)?\s*\))[^)]+\)/u);
	assert.match(back, /rotateY\(\s*180deg\s*\)/u);
	assert.match(back, /translateZ\(\s*(?!0(?:px)?\s*\))[^)]+\)/u);
	assert.match(depth, /transform-style:\s*preserve-3d\s*;/u);
	assert.match(depth, /(?:translateZ|translate3d|rotateX|rotateY)\(/u);
});

test('reduced motion swaps the spatial door/dolly for stable semantic keyposes', () => {
	assert.match(rigSource, /doorProgress = reducedMotion \? 0 : smootherstep\(channels\.door\)/u);
	assert.match(rigSource, /cameraScale = reducedMotion \? 1 :/u);
	assert.match(rigSource, /data-vault-door-direction=\{reducedMotion \? 'static-crossfade' : 'away-right'\}/u);
	assert.match(rigSource, /data-vault-camera-motion=\{reducedMotion \? 'static-keypose' : 'aperture-dolly'\}/u);
	assert.match(rigSource, /transition:\s*opacity 140ms ease-out/u);
});

test('DEV reduced-motion rig stays raster/CSS-only and full motion keeps the canonical V26 poster fallback', () => {
	assert.doesNotMatch(rigSource, /<svg\b|\.svg\b|data:image\/svg\+xml/iu);
	assert.match(
		cinematicSource,
		/useDevRig = DEV_RUNTIME_ENABLED[\s\S]*&& devRigEnabled === true[\s\S]*&& openingReduced[\s\S]*&& Boolean\(assets\?\.devCinematic\)/u,
	);
	assert.match(
		cinematicSource,
		/\{#if useDevRig\}[\s\S]*<DevVaultRig[\s\S]*\{:else if \(!openingMediaCommitted \|\| openingMediaTier === VAULT_MEDIA_TIER\.POSTER\) && openingPosterSrc\}[\s\S]*\{:else if openingMediaCommitted && openingVideoSrc\}[\s\S]*<video[\s\S]*data-vault-media=\{openingMediaTier === VAULT_MEDIA_TIER\.PRIMARY[\s\S]*'v26-720p24'[\s\S]*VAULT_MEDIA_TIER\.ULTRA_HD[\s\S]*'v24-2160p60'[\s\S]*'v24-1080p60'\}/u,
	);
	assert.match(
		cinematicSource,
		/openingHasV26Contract = Boolean\([\s\S]*vaultOpeningVideoV26[\s\S]*vaultOpeningPoster/u,
	);
	assert.match(cinematicSource, /src=\{openingVideoSrc\}/u);
	assert.match(
		cinematicSource,
		/'static-poster-pending'[\s\S]*'static-poster'[\s\S]*'static-poster-fallback'[\s\S]*src=\{openingPosterSrc\}/u,
	);
});
