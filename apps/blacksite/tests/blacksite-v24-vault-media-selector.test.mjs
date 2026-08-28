import assert from 'node:assert/strict';
import test from 'node:test';

import {
	VAULT_COMPACT_MEDIA_QUERY,
	VAULT_DIRECTOR_OPENING_DURATION_SECONDS,
	VAULT_MEDIA_TIER,
	VAULT_PRIMARY_VIDEO_DURATION_SECONDS,
	VAULT_VIDEO_CONTENT_TYPE,
	createVaultUltraHdDecodeConfiguration,
	requiresVaultUltraHd,
	resolveVaultMediaSelection,
	resolveVaultVideoResumeTime,
	selectVaultMediaTier,
	vaultOpeningAnchor,
	vaultOpeningDurationForTier,
	vaultOpeningPlaybackRateForTier,
} from '../src/lib/runtime/vault-media-selector.js';

const cinematicAssets = Object.freeze({
	vaultOpeningVideo2160: '/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-2160p60.webm',
	vaultOpeningVideo1080: '/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-1080p60.webm',
	vaultOpeningPoster: '/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-poster-1080p.webp',
});

const v26CinematicAssets = Object.freeze({
	vaultOpeningVideoV26: '/assets/blacksite/v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
	vaultOpeningPoster: '/assets/blacksite/v26/cinematic/vault-opening-blackout-v26-poster-720p.webp',
});

test('V24 only spends the 4K decode budget when rendered device pixels exceed 1080p', () => {
	assert.equal(requiresVaultUltraHd({ cssWidth: 1_280, cssHeight: 720, devicePixelRatio: 1 }), false);
	assert.equal(requiresVaultUltraHd({ cssWidth: 1_920, cssHeight: 1_080, devicePixelRatio: 1 }), false);
	assert.equal(requiresVaultUltraHd({ cssWidth: 1_440, cssHeight: 900, devicePixelRatio: 2 }), true);
	assert.equal(requiresVaultUltraHd({ cssWidth: 2_560, cssHeight: 1_440, devicePixelRatio: 1 }), true);
	assert.equal(requiresVaultUltraHd({ cssWidth: Number.NaN, cssHeight: -1, devicePixelRatio: 0 }), false);
});

test('V24 media tier selection keeps reduced motion static and constrained clients at 1080p', () => {
	assert.equal(selectVaultMediaTier({ reducedMotion: true, ultraHdCapable: true }), VAULT_MEDIA_TIER.POSTER);
	assert.equal(selectVaultMediaTier({ reducedMotion: true, turbo: true }), VAULT_MEDIA_TIER.POSTER);
	assert.equal(selectVaultMediaTier({ turbo: true, ultraHdCapable: true }), VAULT_MEDIA_TIER.FULL_HD);
	assert.equal(selectVaultMediaTier({ compactViewport: true, ultraHdCapable: true }), VAULT_MEDIA_TIER.FULL_HD);
	assert.equal(selectVaultMediaTier({ saveData: true, ultraHdCapable: true }), VAULT_MEDIA_TIER.FULL_HD);
	assert.equal(selectVaultMediaTier({ ultraHdCapable: false }), VAULT_MEDIA_TIER.FULL_HD);
	assert.equal(selectVaultMediaTier({ ultraHdCapable: true }), VAULT_MEDIA_TIER.ULTRA_HD);
	assert.equal(
		VAULT_COMPACT_MEDIA_QUERY,
		'(max-width: 1040px), (max-aspect-ratio: 4/3), (max-height: 560px), (pointer: coarse)',
	);
});

test('V24 media selection resolves reduced motion to poster and capable clients to the matching WebM tier', () => {
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: cinematicAssets, reducedMotion: true, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.POSTER, source: null, poster: cinematicAssets.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: cinematicAssets, turbo: true, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.FULL_HD, source: cinematicAssets.vaultOpeningVideo1080, poster: cinematicAssets.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: cinematicAssets, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.ULTRA_HD, source: cinematicAssets.vaultOpeningVideo2160, poster: cinematicAssets.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({
			assets: { ...cinematicAssets, vaultOpeningVideo2160: null },
			ultraHdCapable: true,
		}),
		{ tier: VAULT_MEDIA_TIER.FULL_HD, source: cinematicAssets.vaultOpeningVideo1080, poster: cinematicAssets.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({
			assets: {
				vaultOpeningVideo2160: cinematicAssets.vaultOpeningVideo2160,
				vaultOpeningPoster: cinematicAssets.vaultOpeningPoster,
			},
			ultraHdCapable: true,
		}),
		{ tier: VAULT_MEDIA_TIER.ULTRA_HD, source: cinematicAssets.vaultOpeningVideo2160, poster: cinematicAssets.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({
			assets: {
				vaultOpeningVideo2160: cinematicAssets.vaultOpeningVideo2160,
				vaultOpeningVideo1080: cinematicAssets.vaultOpeningVideo1080,
				vaultOpeningPoster: cinematicAssets.vaultOpeningPoster,
			},
			ultraHdCapable: true,
		}),
		{ tier: VAULT_MEDIA_TIER.ULTRA_HD, source: cinematicAssets.vaultOpeningVideo2160, poster: cinematicAssets.vaultOpeningPoster },
		'the V24 adaptive selector retains the 2160p tier when it is available',
	);
	assert.equal(Object.isFrozen(resolveVaultMediaSelection({ assets: cinematicAssets })), true);
});

test('V26 is the canonical non-reduced opening film on every client class', () => {
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: v26CinematicAssets, reducedMotion: true, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.POSTER, source: null, poster: v26CinematicAssets.vaultOpeningPoster },
	);
	for (const signals of [
		{},
		{ turbo: true },
		{ compactViewport: true },
		{ saveData: true },
		{ ultraHdCapable: true },
	]) {
		assert.deepEqual(
			resolveVaultMediaSelection({ assets: v26CinematicAssets, ...signals }),
			{
				tier: VAULT_MEDIA_TIER.PRIMARY,
				source: v26CinematicAssets.vaultOpeningVideoV26,
				poster: v26CinematicAssets.vaultOpeningPoster,
			},
		);
	}
});

test('V24 capability probe describes worst-case VP8 2160p playback demand', () => {
	const configuration = createVaultUltraHdDecodeConfiguration();
	assert.equal(VAULT_VIDEO_CONTENT_TYPE, 'video/webm; codecs="vp8"');
	assert.deepEqual(configuration, {
		type: 'file',
		video: {
			contentType: 'video/webm; codecs="vp8"',
			width: 3_840,
			height: 2_160,
			bitrate: 60_000_000,
			framerate: 77,
		},
	});
	assert.equal(Object.isFrozen(configuration), true);
	assert.equal(Object.isFrozen(configuration.video), true);
});

test('normal V24 playback stretches its 4.116667 second fallback across the native V26 window', () => {
	assert.equal(VAULT_DIRECTOR_OPENING_DURATION_SECONDS, 4.116667);
	assert.equal(vaultOpeningDurationForTier(VAULT_MEDIA_TIER.ULTRA_HD), 4.116667);
	assert.equal(vaultOpeningDurationForTier(VAULT_MEDIA_TIER.FULL_HD), 4.116667);
	assert.equal(
		vaultOpeningPlaybackRateForTier(VAULT_MEDIA_TIER.ULTRA_HD),
		4.116667 / 5.041667,
	);
	assert.equal(
		vaultOpeningPlaybackRateForTier(VAULT_MEDIA_TIER.FULL_HD),
		4.116667 / 5.041667,
	);
	assert.equal(vaultOpeningAnchor('wheel-turn'), 0.52);
	assert.equal(vaultOpeningAnchor('locks-release'), 1.62);
	assert.equal(vaultOpeningAnchor('door-opening'), 2.3);
	assert.equal(vaultOpeningAnchor('light-entry'), 3.4);
	assert.equal(vaultOpeningAnchor('unknown'), 0);
	assert.equal(resolveVaultVideoResumeTime({ state: 'door-opening', currentTime: 1.1 }), 2.3);
	assert.equal(resolveVaultVideoResumeTime({ state: 'door-opening', currentTime: 3.1 }), 3.1);
	assert.equal(resolveVaultVideoResumeTime({ state: 'light-entry', currentTime: Number.NaN }), 3.4);
	assert.equal(resolveVaultVideoResumeTime({ state: 'wheel-turn', currentTime: 99 }), 4.116667);
	assert.equal(
		resolveVaultVideoResumeTime({
			state: 'wheel-turn',
			currentTime: 0,
			durationSeconds: VAULT_DIRECTOR_OPENING_DURATION_SECONDS,
		}),
		0.52,
	);
	assert.equal(
		resolveVaultVideoResumeTime({
			state: 'wheel-turn',
			currentTime: 99,
			durationSeconds: VAULT_DIRECTOR_OPENING_DURATION_SECONDS,
		}),
		4.116667,
	);
});

test('normal V26 playback preserves the exact supplied film at native speed', () => {
	assert.equal(VAULT_PRIMARY_VIDEO_DURATION_SECONDS, 5.041667);
	assert.equal(vaultOpeningDurationForTier(VAULT_MEDIA_TIER.PRIMARY), 5.041667);
	assert.equal(vaultOpeningPlaybackRateForTier(VAULT_MEDIA_TIER.PRIMARY), 1);
	assert.ok(
		Math.abs(
			resolveVaultVideoResumeTime({
				state: 'door-opening',
				currentTime: 0,
				durationSeconds: VAULT_PRIMARY_VIDEO_DURATION_SECONDS,
			})
			- (2.3 * VAULT_PRIMARY_VIDEO_DURATION_SECONDS / VAULT_DIRECTOR_OPENING_DURATION_SECONDS)
		) < 1e-12,
	);
});

test('direct and turbo playback preserve the legacy acceleration factors for every video tier', () => {
	for (const [tier, sourceDuration] of [
		[VAULT_MEDIA_TIER.FULL_HD, VAULT_DIRECTOR_OPENING_DURATION_SECONDS],
		[VAULT_MEDIA_TIER.ULTRA_HD, VAULT_DIRECTOR_OPENING_DURATION_SECONDS],
		[VAULT_MEDIA_TIER.PRIMARY, VAULT_PRIMARY_VIDEO_DURATION_SECONDS],
	]) {
		const legacyWindowRate = sourceDuration / VAULT_DIRECTOR_OPENING_DURATION_SECONDS;
		assert.equal(
			vaultOpeningPlaybackRateForTier(tier, { direct: true }),
			legacyWindowRate / 0.78,
		);
		assert.equal(
			vaultOpeningPlaybackRateForTier(tier, { turbo: true }),
			legacyWindowRate / 0.38,
		);
		assert.equal(
			vaultOpeningPlaybackRateForTier(tier, { direct: true, turbo: true }),
			legacyWindowRate / 0.78 / 0.38,
		);
	}
});
