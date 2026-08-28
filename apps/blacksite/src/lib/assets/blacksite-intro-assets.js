import { packageAsset } from './blacksite-assets.js';

export const BLACKSITE_INTRO_MANIFEST_URL = packageAsset(
	'v33/intro/blacksite-startup-manifest-v33.json',
);

export const BLACKSITE_INTRO_FALLBACK = Object.freeze({
	schema: 'blacksite-intro-manifest/v2',
	status: 'runtime-integrated-review-pending',
	videoAvailable: true,
	durationSeconds: 10.006,
	poster: Object.freeze({
		desktop: 'v28/environment/blackout-interior-desktop.webp',
		portrait: 'v28/environment/blackout-interior-portrait.webp',
		shortLandscape: 'v28/environment/blackout-interior-short-landscape.webp',
	}),
	endFrame: 'v33/intro/blacksite-breach-start-screen-v33.webp',
	rulesScreen: 'v33/intro/blacksite-breach-start-screen-v33.webp',
	video: Object.freeze({
		desktop: Object.freeze({
			webm: null,
			mp4: 'v33/intro/blacksite-vault-opening-v33.mp4',
		}),
		mobile: Object.freeze({
			webm: null,
			mp4: 'v33/intro/blacksite-vault-opening-v33.mp4',
		}),
	}),
});

function safeAssetPath(value, fallback) {
	return typeof value === 'string' && /^v\d+\/[a-z0-9_./-]+$/iu.test(value)
		? value
		: fallback;
}

function safeOptionalAssetPath(value, fallback = null) {
	if (value === null) return null;
	return typeof value === 'string' && /^v\d+\/[a-z0-9_./-]+$/iu.test(value)
		? value
		: fallback;
}

function packageOptionalAsset(value) {
	return value ? packageAsset(value) : null;
}

export function normalizeBlacksiteIntroManifest(value) {
	const source = value && typeof value === 'object' ? value : {};
	const fallback = BLACKSITE_INTRO_FALLBACK;
	return Object.freeze({
		schema: typeof source.schema === 'string' ? source.schema : fallback.schema,
		status: typeof source.status === 'string' ? source.status : fallback.status,
		videoAvailable: source.videoAvailable === true,
		durationSeconds: Number.isFinite(source.durationSeconds) && source.durationSeconds > 0
			? source.durationSeconds
			: null,
		poster: Object.freeze({
			desktop: packageAsset(safeAssetPath(source.poster?.desktop, fallback.poster.desktop)),
			portrait: packageAsset(safeAssetPath(source.poster?.portrait, fallback.poster.portrait)),
			shortLandscape: packageAsset(safeAssetPath(
				source.poster?.shortLandscape,
				fallback.poster.shortLandscape,
			)),
		}),
		endFrame: packageAsset(safeAssetPath(source.endFrame, fallback.endFrame)),
		rulesScreen: packageAsset(safeAssetPath(source.rulesScreen, fallback.rulesScreen)),
		video: Object.freeze({
			desktop: Object.freeze({
				webm: packageOptionalAsset(safeOptionalAssetPath(
					source.video?.desktop?.webm,
					fallback.video.desktop.webm,
				)),
				mp4: packageAsset(safeAssetPath(source.video?.desktop?.mp4, fallback.video.desktop.mp4)),
			}),
			mobile: Object.freeze({
				webm: packageOptionalAsset(safeOptionalAssetPath(
					source.video?.mobile?.webm,
					fallback.video.mobile.webm,
				)),
				mp4: packageAsset(safeAssetPath(source.video?.mobile?.mp4, fallback.video.mobile.mp4)),
			}),
		}),
	});
}

export async function loadBlacksiteIntroManifest(fetchFn = globalThis.fetch) {
	if (typeof fetchFn !== 'function') return normalizeBlacksiteIntroManifest(BLACKSITE_INTRO_FALLBACK);
	try {
		const response = await fetchFn(BLACKSITE_INTRO_MANIFEST_URL, { cache: 'no-store' });
		if (!response?.ok) throw new Error(`intro manifest response ${response?.status ?? 'failed'}`);
		return normalizeBlacksiteIntroManifest(await response.json());
	} catch {
		return normalizeBlacksiteIntroManifest(BLACKSITE_INTRO_FALLBACK);
	}
}
