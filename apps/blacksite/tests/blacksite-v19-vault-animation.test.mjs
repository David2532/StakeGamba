import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const componentSource = await readFile(
	new URL('../src/lib/components/VaultCinematic.svelte', import.meta.url),
	'utf8',
);
const assetSource = await readFile(
	new URL('../src/lib/assets/blacksite-assets.js', import.meta.url),
	'utf8',
);
const video2160Url = new URL(
	'../static/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-2160p60.webm',
	import.meta.url,
);
const video1080Url = new URL(
	'../static/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-1080p60.webm',
	import.meta.url,
);
const v24PosterUrl = new URL(
	'../static/assets/blacksite/v24/cinematic/vault-opening-blackout-v24-poster-1080p.webp',
	import.meta.url,
);
const v26VideoUrl = new URL(
	'../static/assets/blacksite/v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
	import.meta.url,
);
const v26PosterUrl = new URL(
	'../static/assets/blacksite/v26/cinematic/vault-opening-blackout-v26-poster-720p.webp',
	import.meta.url,
);
const v26StagedVideoUrl = new URL(
	'../art/generated/v26/cinematic/vault-opening-kling/runtime-staging/vault-opening-blackout-v26-720p24.mp4',
	import.meta.url,
);
const v26PromotionReportUrl = new URL(
	'../art/generated/v26/cinematic/vault-opening-kling/RUNTIME_PROMOTION_REPORT.json',
	import.meta.url,
);
const buildReportUrl = new URL(
	'../art/generated/v24/cinematic/vault-opening/BUILD_REPORT.json',
	import.meta.url,
);

function inspectWebpGeometry(bytes) {
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const chunkId = bytes.subarray(offset, offset + 4).toString('ascii');
		const chunkSize = bytes.readUInt32LE(offset + 4);
		const payloadOffset = offset + 8;
		if (chunkId === 'VP8X') {
			return {
				width: 1 + bytes.readUIntLE(payloadOffset + 4, 3),
				height: 1 + bytes.readUIntLE(payloadOffset + 7, 3),
			};
		}
		if (chunkId === 'VP8 ' && bytes.subarray(payloadOffset + 3, payloadOffset + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
			return {
				width: bytes.readUInt16LE(payloadOffset + 6) & 0x3fff,
				height: bytes.readUInt16LE(payloadOffset + 8) & 0x3fff,
			};
		}
		offset = payloadOffset + chunkSize + (chunkSize & 1);
	}
	return { width: 0, height: 0 };
}

test('V24 source pack remains reproducible provenance while production selects the supplied V26 film', async () => {
	const [video2160Bytes, video1080Bytes, posterBytes, report] = await Promise.all([
		readFile(video2160Url),
		readFile(video1080Url),
		readFile(v24PosterUrl),
		readFile(buildReportUrl, 'utf8').then(JSON.parse),
	]);
	const films = [
		{
			label: '2160p film',
			bytes: video2160Bytes,
			url: video2160Url,
			runtime: report.runtimeStaging.video2160,
			expectedWidth: 3_840,
			expectedHeight: 2_160,
		},
		{
			label: '1080p film',
			bytes: video1080Bytes,
			url: video1080Url,
			runtime: report.runtimeStaging.video1080,
			expectedWidth: 1_920,
			expectedHeight: 1_080,
		},
	];

	for (const { label, bytes, url, runtime, expectedWidth, expectedHeight } of films) {
		assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], `${label} starts with an EBML header`);
		assert.equal(bytes.includes(Buffer.from('V_VP8')), true, `${label} declares the VP8 codec`);
		assert.equal(bytes.includes(Buffer.from('A_OPUS')), false, `${label} has no Opus audio track`);
		assert.equal(bytes.includes(Buffer.from('A_VORBIS')), false, `${label} has no Vorbis audio track`);
		assert.deepEqual(
			{
				width: runtime.width,
				height: runtime.height,
				fps: runtime.fps,
				frames: runtime.frames,
				durationMs: runtime.durationMs,
				codec: runtime.codec,
				pixelFormat: runtime.pixelFormat,
			},
			{
				width: expectedWidth,
				height: expectedHeight,
				fps: 60,
				frames: 247,
				durationMs: 4_116.666667,
				codec: 'VP8',
				pixelFormat: 'yuv420p',
			},
		);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), runtime.sha256, `${label} hash matches its build report`);
		assert.equal((await stat(url)).size, runtime.bytes, `${label} bytes match its build report`);
	}

	assert.equal(posterBytes.subarray(0, 4).toString('ascii'), 'RIFF');
	assert.equal(posterBytes.subarray(8, 12).toString('ascii'), 'WEBP');
	assert.deepEqual(inspectWebpGeometry(posterBytes), { width: 1_920, height: 1_080 });
	assert.equal(createHash('sha256').update(posterBytes).digest('hex'), report.runtimeStaging.poster1080.sha256);
	assert.equal((await stat(v24PosterUrl)).size, report.runtimeStaging.poster1080.bytes);
	assert.equal(report.runtimeStaging.poster1080.width, 1_920);
	assert.equal(report.runtimeStaging.poster1080.height, 1_080);
	assert.ok(video2160Bytes.byteLength > video1080Bytes.byteLength, '2160p delivery retains more visual information than the fallback');
	assert.match(assetSource, /vaultOpeningVideoV26:\s*packageAsset\('v26\/cinematic\/vault-opening-blackout-v26-720p24\.mp4'\)/u);
	assert.match(assetSource, /vaultOpeningPoster:\s*packageAsset\('v26\/cinematic\/vault-opening-blackout-v26-poster-720p\.webp'\)/u);
	assert.doesNotMatch(assetSource, /vaultOpeningVideo2160/u);
	assert.doesNotMatch(assetSource, /vaultOpeningVideo1080/u);
	assert.doesNotMatch(assetSource, /vaultOpeningSequence/u);
});

test('canonical V26 Kling film remains byte-preserved with its exact frame-zero poster', async () => {
	const [videoBytes, stagedVideoBytes, posterBytes, report] = await Promise.all([
		readFile(v26VideoUrl),
		readFile(v26StagedVideoUrl),
		readFile(v26PosterUrl),
		readFile(v26PromotionReportUrl, 'utf8').then(JSON.parse),
	]);
	assert.equal(videoBytes.subarray(4, 8).toString('ascii'), 'ftyp');
	assert.equal(videoBytes.includes(Buffer.from('avc1')), true, 'V26 declares H.264/AVC video');
	assert.equal(videoBytes.includes(Buffer.from('mp4a')), true, 'the supplied native audio track remains byte-preserved');
	assert.deepEqual(videoBytes, stagedVideoBytes, 'runtime V26 MP4 is byte-identical to its staged native source');
	assert.deepEqual(
		{
			bytes: videoBytes.byteLength,
			sha256: createHash('sha256').update(videoBytes).digest('hex'),
			width: report.runtime.video.width,
			height: report.runtime.video.height,
			fps: report.runtime.video.fps,
			durationMs: report.runtime.video.durationMs,
			container: report.runtime.video.container,
			videoCodec: report.runtime.video.videoCodec,
			hasAudio: report.runtime.video.hasAudio,
		},
		{
			bytes: 5956543,
			sha256: '5edad7d2f7c56ec48d3e6afd7c344c9b0704053baaeb14b2f7a0fd6084ac3acf',
			width: 1280,
			height: 720,
			fps: 24,
			durationMs: 5041.667,
			container: 'mp4',
			videoCodec: 'h264',
			hasAudio: true,
		},
	);
	assert.equal(posterBytes.subarray(0, 4).toString('ascii'), 'RIFF');
	assert.equal(posterBytes.subarray(8, 12).toString('ascii'), 'WEBP');
	assert.deepEqual(inspectWebpGeometry(posterBytes), { width: 1280, height: 720 });
	assert.equal(posterBytes.byteLength, 74342);
	assert.equal(
		createHash('sha256').update(posterBytes).digest('hex'),
		'c0ce502b59f7e9d51c6de1cb2758c74e920be52dd412ea1005deda50cf54d9f9',
	);
	assert.deepEqual(report.runtime.poster, {
		path: 'static/assets/blacksite/v26/cinematic/vault-opening-blackout-v26-poster-720p.webp',
		bytes: 74342,
		sha256: 'c0ce502b59f7e9d51c6de1cb2758c74e920be52dd412ea1005deda50cf54d9f9',
		width: 1280,
		height: 720,
		format: 'webp',
	});
});

test('Vault cinematic freezes the V26 film per generation and falls back without gameplay authority', () => {
	assert.match(componentSource, /openingMediaSelectionReady = mounted && openingMediaSignalsResolved[\s\S]*sequenceKey !== openingMediaGeneration/u);
	assert.match(componentSource, /openingHasV26Contract = Boolean\([\s\S]*vaultOpeningVideoV26[\s\S]*vaultOpeningPoster/u);
	assert.match(componentSource, /resolveVaultMediaSelection\([\s\S]*reducedMotion:[\s\S]*turbo:[\s\S]*compactViewport:[\s\S]*saveData:[\s\S]*ultraHdCapable:/u);
	assert.match(componentSource, /\{#key `\$\{sequenceKey\}:\$\{openingMediaTier\}`\}/u);
	assert.match(componentSource, /data-testid="vault-opening-animation"/u);
	assert.match(componentSource, /<video[\s\S]*?src=\{openingVideoSrc\}[\s\S]*?autoplay[\s\S]*?muted[\s\S]*?playsinline/u);
	assert.match(componentSource, /data-vault-media=\{openingMediaTier === VAULT_MEDIA_TIER\.PRIMARY[\s\S]*'v26-720p24'[\s\S]*VAULT_MEDIA_TIER\.ULTRA_HD[\s\S]*'v24-2160p60'[\s\S]*'v24-1080p60'\}/u);
	assert.match(componentSource, /data-vault-source-tier=\{openingMediaTier\}/u);
	assert.match(componentSource, /poster=\{openingPosterSrc\}/u);
	assert.match(componentSource, /outgoingTier === VAULT_MEDIA_TIER\.PRIMARY \|\| outgoingTier === VAULT_MEDIA_TIER\.ULTRA_HD[\s\S]*vaultOpeningVideo1080[\s\S]*openingMediaTier = VAULT_MEDIA_TIER\.FULL_HD[\s\S]*openingVideoSrc = assets\.cinematic\.vaultOpeningVideo1080/u);
	assert.match(componentSource, /openingMediaTier = VAULT_MEDIA_TIER\.POSTER;[\s\S]*openingVideoSrc = null/u);
	assert.match(componentSource, /resolveVaultVideoResumeTime\(\{[\s\S]*state: nextState,[\s\S]*durationSeconds: vaultOpeningDurationForTier\(openingMediaTier\)/u);
	assert.match(componentSource, /syncOpeningVideoState\(openingVideo, state, openingPlaybackRate\)/u);
	assert.match(componentSource, /video\.dataset\.vaultPlaybackSynchronized === identity[\s\S]*nextState === VAULT_STATE\.TRIGGER_LOCK[\s\S]*resolveVaultVideoResumeTime\([\s\S]*durationSeconds: vaultOpeningDurationForTier\(openingMediaTier\)[\s\S]*video\.dataset\.vaultPlaybackSynchronized = identity/u);
	assert.match(componentSource, /Later semantic stage changes must never seek a film that is already playing/u);
	assert.match(componentSource, /on:waiting=\{handleOpeningVideoWaiting\}/u);
	assert.match(componentSource, /on:stalled=\{handleOpeningVideoWaiting\}/u);
	assert.match(componentSource, /on:canplay=\{handleOpeningVideoRecovered\}[\s\S]*on:playing=\{handleOpeningVideoRecovered\}[\s\S]*on:progress=\{handleOpeningVideoRecovered\}/u);
	assert.match(componentSource, /function handleOpeningVideoRecovered[\s\S]*cancelOpeningWaitingWatchdog\(\);[\s\S]*syncOpeningVideoState\(video, state, openingPlaybackRate\)/u);
	assert.match(componentSource, /on:error=\{handleOpeningVideoError\}/u);
	assert.match(componentSource, /'static-poster-pending'[\s\S]*'static-poster-fallback'[\s\S]*src=\{openingPosterSrc\}/u);
	assert.match(componentSource, /useDevRig = DEV_RUNTIME_ENABLED[\s\S]*&& devRigEnabled === true[\s\S]*&& openingReduced/u);
	assert.doesNotMatch(componentSource, /on:ended/u, 'media completion never owns feature progression');
	assert.match(
		componentSource,
		/openingPlaybackRate = vaultOpeningPlaybackRateForTier\(openingMediaTier, \{[\s\S]*direct: cinematic\?\.direct === true,[\s\S]*turbo: cinematic\?\.turbo === true,[\s\S]*\}\)/u,
	);
	assert.match(componentSource, /navigator\.mediaCapabilities[\s\S]*createVaultUltraHdDecodeConfiguration/u);
	assert.match(componentSource, /void probeOpeningUltraHdCapability\(\)\.then\(\(capable\) => \{[\s\S]*openingCapabilityResolved = true/u);
	assert.match(componentSource, /showOpeningSequence = !isPresentationCard/u);
	assert.doesNotMatch(componentSource, /vault-door-layer|vault-wheel-layer|vault-portal-light|rotateY\(/u);
	assert.doesNotMatch(componentSource, /<svg|\.svg\b/iu);
});

test('Vault V26 media resilience is bounded, identity-guarded and prewarms only the armed source', () => {
	assert.match(componentSource, /VAULT_CAPABILITY_TIMEOUT_MS = 800/u);
	assert.match(componentSource, /timeout = setTimeout\(cancel, Math\.max\(1, timeoutMs\)\)/u);
	assert.match(componentSource, /openingCapabilityResolved = true/u);
	assert.match(componentSource, /VAULT_WAITING_WATCHDOG_MS = 800/u);
	assert.match(componentSource, /VAULT_DRIFT_WINDOW_MS = 750[\s\S]*VAULT_MAX_PLAYBACK_LAG_SECONDS = 0\.35/u);
	assert.match(componentSource, /watchdogToken !== openingWaitingWatchdogToken[\s\S]*downgradeOpeningVideo\(video, expected\)/u);
	assert.match(componentSource, /ultraHdCapable: openingUltraHdCapable && openingUltraHdRequired/u);
	assert.match(componentSource, /openingUltraHdRequired = requiresVaultUltraHd\(\{[\s\S]*cssWidth: window\.innerWidth[\s\S]*devicePixelRatio: window\.devicePixelRatio/u);
	assert.match(componentSource, /handleOpeningVideoTimeUpdate[\s\S]*expectedSeconds - mediaSeconds > VAULT_MAX_PLAYBACK_LAG_SECONDS[\s\S]*downgradeOpeningVideo\(video\)/u);
	assert.match(componentSource, /on:timeupdate=\{handleOpeningVideoTimeUpdate\}/u);
	assert.match(componentSource, /video === openingVideo[\s\S]*generation === sequenceKey[\s\S]*identity === openingMediaIdentity[\s\S]*tier === openingMediaTier/u);
	assert.match(componentSource, /video\.pause\(\)[\s\S]*video\.removeAttribute\('src'\)[\s\S]*video\.load\(\)/u);
	assert.match(componentSource, /releaseOpeningVideoNode\(video\);[\s\S]*openingVideo = null;[\s\S]*openingMediaIdentity \+= 1/u);
	assert.match(componentSource, /cancelOpeningCapabilityProbe\?\.\(\)[\s\S]*releaseOpeningMediaNodes\(\)/u);

	assert.match(componentSource, /openingPrewarmEligible = mounted[\s\S]*!isActive[\s\S]*state === VAULT_STATE\.TRIGGER_LOCK[\s\S]*!openingReduced[\s\S]*!openingSystemReducedMotion[\s\S]*!openingSaveData/u);
	assert.match(componentSource, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/u);
	const prewarmBlock = componentSource.match(/\{#if openingPrewarmEligible\}([\s\S]*?)\{\/if\}/u)?.[1] ?? '';
	assert.match(prewarmBlock, /<video[\s\S]*hidden[\s\S]*data-vault-prewarm="armed"[\s\S]*src=\{openingVideoSrc\}[\s\S]*preload="auto"/u);
	assert.doesNotMatch(prewarmBlock, /autoplay/u, 'armed prewarm never starts a second playing film');
	assert.match(prewarmBlock, /on:playing=\{handleOpeningPrewarmPlaying\}/u);
	assert.doesNotMatch(componentSource, /on:ended/u, 'media cannot advance or complete the Director');
});

test('Door film hands off to the stable free-spin award', () => {
	assert.match(componentSource, /data-testid="vault-free-spins-award"/u);
	assert.match(componentSource, /data-testid="vault-free-spins-count"/u);
	assert.match(componentSource, /data-testid="vault-free-spins-target"/u);
	assert.match(componentSource, /NEXT: FREE SPIN 1 OF \{awardedSpins\}/u);
	assert.match(componentSource, /data-testid="vault-cinematic-skip"/u);
	assert.match(componentSource, /data-testid=\{isExtraction \? 'extraction-report' : 'vault-access-scene'\}/u);
	assert.match(componentSource, /data-testid="return-to-base"/u);
	assert.match(componentSource, /\.vault-opening-sequence \{[\s\S]*object-fit:\s*cover/u);
	assert.match(componentSource, /@media \(max-width: 1040px\), \(max-height: 560px\), \(pointer: coarse\)[\s\S]*\.vault-opening-sequence \{ object-fit:\s*contain/u);
	assert.match(componentSource, /@media \(max-width: 640px\)[\s\S]*\.vault-opening-sequence \{ object-fit:\s*contain/u);
	assert.match(componentSource, /@media \(max-aspect-ratio: 4 \/ 3\), \(min-aspect-ratio: 2 \/ 1\)[\s\S]*object-fit:\s*contain/u);
});
