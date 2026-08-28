export const VAULT_MEDIA_TIER = Object.freeze({
	POSTER: 'poster',
	PRIMARY: 'v26-720p',
	FULL_HD: '1080p',
	ULTRA_HD: '2160p',
});

export const VAULT_VIDEO_CONTENT_TYPE = 'video/webm; codecs="vp8"';

export const VAULT_COMPACT_MEDIA_QUERY = [
	'(max-width: 1040px)',
	'(max-aspect-ratio: 4/3)',
	'(max-height: 560px)',
	'(pointer: coarse)',
].join(', ');

export const VAULT_OPENING_ANCHORS = Object.freeze({
	'wheel-turn': 0.52,
	'locks-release': 1.62,
	'door-opening': 2.30,
	'light-entry': 3.40,
});

export const VAULT_DIRECTOR_OPENING_DURATION_SECONDS = 4.116667;
export const VAULT_PRIMARY_VIDEO_DURATION_SECONDS = 5.041667;
export const VAULT_NORMAL_OPENING_DURATION_SECONDS = VAULT_PRIMARY_VIDEO_DURATION_SECONDS;

export function vaultOpeningDurationForTier(tier) {
	return tier === VAULT_MEDIA_TIER.PRIMARY
		? VAULT_PRIMARY_VIDEO_DURATION_SECONDS
		: VAULT_DIRECTOR_OPENING_DURATION_SECONDS;
}

export function vaultOpeningPlaybackRateForTier(tier, {
	direct = false,
	turbo = false,
} = {}) {
	const directorWindow = !direct && !turbo
		? VAULT_NORMAL_OPENING_DURATION_SECONDS
		: VAULT_DIRECTOR_OPENING_DURATION_SECONDS;
	let playbackRate = vaultOpeningDurationForTier(tier) / directorWindow;
	if (direct) playbackRate /= 0.78;
	if (turbo) playbackRate /= 0.38;
	return playbackRate;
}

export function requiresVaultUltraHd({
	cssWidth = 0,
	cssHeight = 0,
	devicePixelRatio = 1,
} = {}) {
	const width = Number.isFinite(cssWidth) ? Math.max(0, cssWidth) : 0;
	const height = Number.isFinite(cssHeight) ? Math.max(0, cssHeight) : 0;
	const density = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1;
	return width * density > 1_920 || height * density > 1_080;
}

export function selectVaultMediaTier({
	reducedMotion = false,
	turbo = false,
	compactViewport = false,
	saveData = false,
	ultraHdCapable = false,
} = {}) {
	if (reducedMotion) return VAULT_MEDIA_TIER.POSTER;
	if (turbo || compactViewport || saveData) return VAULT_MEDIA_TIER.FULL_HD;
	return ultraHdCapable ? VAULT_MEDIA_TIER.ULTRA_HD : VAULT_MEDIA_TIER.FULL_HD;
}

export function resolveVaultMediaSelection({
	assets = null,
	reducedMotion = false,
	turbo = false,
	compactViewport = false,
	saveData = false,
	ultraHdCapable = false,
} = {}) {
	const poster = assets?.vaultOpeningPoster ?? null;
	const primary = assets?.vaultOpeningVideoV26 ?? null;
	const fullHd = assets?.vaultOpeningVideo1080 ?? null;
	const ultraHd = assets?.vaultOpeningVideo2160 ?? null;
	if (reducedMotion) {
		return Object.freeze({ tier: VAULT_MEDIA_TIER.POSTER, source: null, poster });
	}
	if (primary) {
		return Object.freeze({ tier: VAULT_MEDIA_TIER.PRIMARY, source: primary, poster });
	}
	const preferredTier = selectVaultMediaTier({
		reducedMotion: false,
		turbo,
		compactViewport,
		saveData,
		ultraHdCapable,
	});

	if (preferredTier === VAULT_MEDIA_TIER.ULTRA_HD && ultraHd) {
		return Object.freeze({ tier: VAULT_MEDIA_TIER.ULTRA_HD, source: ultraHd, poster });
	}
	if (fullHd) {
		return Object.freeze({ tier: VAULT_MEDIA_TIER.FULL_HD, source: fullHd, poster });
	}
	return Object.freeze({ tier: VAULT_MEDIA_TIER.POSTER, source: null, poster });
}

export function createVaultUltraHdDecodeConfiguration({
	bitrate = 60_000_000,
	playbackRate = 1 / 0.78,
} = {}) {
	const normalizedRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
	return Object.freeze({
		type: 'file',
		video: Object.freeze({
			contentType: VAULT_VIDEO_CONTENT_TYPE,
			width: 3_840,
			height: 2_160,
			bitrate: Math.max(1, Math.round(bitrate)),
			framerate: Math.ceil(60 * normalizedRate),
		}),
	});
}

export function vaultOpeningAnchor(state) {
	return VAULT_OPENING_ANCHORS[state] ?? 0;
}

export function resolveVaultVideoResumeTime({
	state,
	currentTime = 0,
	durationSeconds = VAULT_DIRECTOR_OPENING_DURATION_SECONDS,
} = {}) {
	const normalizedDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
		? durationSeconds
		: VAULT_DIRECTOR_OPENING_DURATION_SECONDS;
	const normalizedCurrentTime = Number.isFinite(currentTime)
		? Math.max(0, Math.min(normalizedDuration, currentTime))
		: 0;
	const stateAnchor = vaultOpeningAnchor(state)
		* (normalizedDuration / VAULT_DIRECTOR_OPENING_DURATION_SECONDS);
	return Math.max(stateAnchor, normalizedCurrentTime);
}
