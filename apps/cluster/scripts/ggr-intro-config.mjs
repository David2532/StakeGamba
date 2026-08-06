/**
 * Golden Goal Rush cinematic-intro source of truth.
 *
 * This configuration is deliberately independent of the game/RGS state. The
 * renderer treats unavailable artwork or audio as a non-fatal degraded asset
 * and always exposes the real game. Keep player-facing copy here so a future
 * theme or locale change has one reviewable source.
 */

const ASSET_ROOT = 'src/assets/golden-goal-rush';

const localizedCopy = Object.freeze({
	en: Object.freeze({
		loading: 'Preparing the stadium',
		arrival: 'UNDER THE FLOODLIGHTS',
		reveal: 'THE GOLDEN GOAL AWAITS',
		logo: 'A NIGHT MADE FOR MOMENTS',
		ready: 'THE STADIUM IS READY',
		enter: 'ENTER STADIUM',
		enterWithSound: 'PLAY WITH SOUND',
		enterSilent: 'PLAY SILENT',
		skip: 'SKIP INTRO',
		soundChoice: 'Choose your matchday sound',
		loaded: 'Intro assets ready',
		degraded: 'Some cinematic assets were unavailable. The game is ready.',
	}),
});

export const INTRO_CONFIG = Object.freeze({
	version: 1,
	theme: 'stadium-night',
	/**
	 * Named release/event variants. Select one by assigning its key to `theme`.
	 * Variants only change presentational data; RGS and replay state never live
	 * in this configuration.
	 */
	themes: Object.freeze({
		'stadium-night': Object.freeze({
			label: 'Stadium night',
			accent: 'gold',
			assetSet: 'default',
		}),
	}),
	/** `once-per-version`, `per-session`, or `always`. */
	runPolicy: 'once-per-version',
	/** Replay is read-only and always enters the saved game directly. */
	skipInReplay: true,
	quality: Object.freeze({
		lowMemoryDeviceThresholdGb: 4,
		maxParticleCount: 96,
		lowQualityParticleCount: 24,
		frameRateCap: 60,
	}),
	assets: Object.freeze({
		desktopBackdrop: `${ASSET_ROOT}/intro/stadium-arrival-desktop.png`,
		mobileBackdrop: `${ASSET_ROOT}/intro/stadium-arrival-mobile.png`,
		fallbackBackdrop: `${ASSET_ROOT}/slot-background.webp`,
		logo: `${ASSET_ROOT}/logo-horizontal-tight.webp`,
		ambience: `${ASSET_ROOT}/audio/background-music.mp3`,
		stadiumRoar: `${ASSET_ROOT}/audio/stadium-roar.mp3`,
		revealAccent: `${ASSET_ROOT}/audio/rainbow-reveal.mp3`,
	}),
	/** Ordered visual planes: the renderer uses the data for asset selection and parallax depth. */
	layers: Object.freeze([
		Object.freeze({ id: 'stadium', role: 'background', desktopAsset: 'desktopBackdrop', mobileAsset: 'mobileBackdrop', depth: 0.28 }),
		Object.freeze({ id: 'wordmark', role: 'foreground', asset: 'logo', depth: 0.76 }),
	]),
	parallax: Object.freeze({
		enabled: true,
		pointerMaxOffsetPx: 9,
		touchMaxOffsetPx: 0,
	}),
	locales: localizedCopy,
	skip: Object.freeze({
		afterMs: 1150,
		behavior: 'ready-screen',
		keyboard: Object.freeze(['Escape']),
	}),
	mobile: Object.freeze({
		usePortraitBackdrop: true,
		cameraScale: 1.08,
	}),
	reducedMotion: Object.freeze({
		enabled: true,
		showReadyScreenImmediately: true,
		particleCount: 0,
	}),
	scenes: Object.freeze([
		Object.freeze({
			id: 'arrival',
			kind: 'cinematic',
			durationMs: 1550,
			transitionMs: 480,
			copyKey: 'arrival',
			camera: Object.freeze({ scaleFrom: 1.16, scaleTo: 1.06, xPercent: 50, yPercent: 53 }),
			atmosphere: Object.freeze({ particles: 'gold-dust', lightBurst: 0.24, ambience: 'stadiumRoar' }),
		}),
		Object.freeze({
			id: 'reveal',
			kind: 'cinematic',
			durationMs: 1260,
			transitionMs: 390,
			copyKey: 'reveal',
			camera: Object.freeze({ scaleFrom: 1.08, scaleTo: 1, xPercent: 50, yPercent: 50 }),
			atmosphere: Object.freeze({ particles: 'gold-dust', lightBurst: 0.84, ambience: 'revealAccent' }),
		}),
		Object.freeze({
			id: 'title',
			kind: 'title',
			durationMs: 1050,
			transitionMs: 350,
			copyKey: 'logo',
			camera: Object.freeze({ scaleFrom: 1.01, scaleTo: 1, xPercent: 50, yPercent: 48 }),
			atmosphere: Object.freeze({ particles: 'gold-dust', lightBurst: 0.58, ambience: 'revealAccent' }),
		}),
		Object.freeze({
			id: 'ready',
			kind: 'ready',
			durationMs: 0,
			transitionMs: 280,
			copyKey: 'ready',
			camera: Object.freeze({ scaleFrom: 1, scaleTo: 1, xPercent: 50, yPercent: 50 }),
			atmosphere: Object.freeze({ particles: 'gold-dust', lightBurst: 0.36, ambience: null }),
		}),
	]),
});

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isFiniteNonNegative = (value) => Number.isFinite(value) && value >= 0;

/** Throws a useful build-time error instead of shipping a broken cinematic. */
export function validateIntroConfig(config = INTRO_CONFIG) {
	if (!isRecord(config)) throw new Error('Intro config must be an object.');
	if (!['once-per-version', 'per-session', 'always'].includes(config.runPolicy)) {
		throw new Error('Intro runPolicy must be once-per-version, per-session, or always.');
	}
	if (!isRecord(config.themes) || !isRecord(config.themes[config.theme])) throw new Error('Intro theme must resolve to a declared theme variant.');
	if (!isRecord(config.assets)) throw new Error('Intro config assets are required.');
	for (const key of ['desktopBackdrop', 'mobileBackdrop', 'fallbackBackdrop', 'logo']) {
		if (typeof config.assets[key] !== 'string' || !config.assets[key].startsWith('src/assets/')) {
			throw new Error(`Intro asset ${key} must be a project asset path.`);
		}
	}
	if (!Array.isArray(config.layers) || !config.layers.length) throw new Error('Intro needs declared visual layers.');
	if (new Set(config.layers.map((layer) => layer?.id)).size !== config.layers.length) throw new Error('Intro layer ids must be unique.');
	for (const layer of config.layers) {
		if (!isRecord(layer) || !/^[a-z0-9-]+$/i.test(layer.id || '') || !['background', 'foreground'].includes(layer.role)) {
			throw new Error('Every intro layer needs a safe id and supported role.');
		}
		if (!Number.isFinite(layer.depth) || layer.depth < 0 || layer.depth > 1) throw new Error(`Intro layer ${layer.id} has an invalid parallax depth.`);
	}
	if (!isRecord(config.parallax) || typeof config.parallax.enabled !== 'boolean' || !isFiniteNonNegative(config.parallax.pointerMaxOffsetPx)) {
		throw new Error('Intro parallax configuration is invalid.');
	}
	if (!isRecord(config.quality) || !Number.isFinite(config.quality.frameRateCap) || config.quality.frameRateCap < 24 || config.quality.frameRateCap > 60) {
		throw new Error('Intro quality frameRateCap must be between 24 and 60 FPS.');
	}
	for (const layer of config.layers) {
		for (const key of [layer.asset, layer.desktopAsset, layer.mobileAsset].filter(Boolean)) {
			if (typeof config.assets[key] !== 'string') throw new Error(`Intro layer ${layer.id} references unknown asset key ${key}.`);
		}
	}
	if (!isRecord(config.skip) || !['ready-screen', 'enter-silent'].includes(config.skip.behavior) || !Array.isArray(config.skip.keyboard)) {
		throw new Error('Intro skip policy is invalid.');
	}
	if (!Array.isArray(config.scenes) || !config.scenes.length) throw new Error('Intro needs at least one scene.');
	if (new Set(config.scenes.map((scene) => scene?.id)).size !== config.scenes.length) throw new Error('Intro scene ids must be unique.');
	for (const scene of config.scenes) {
		if (!isRecord(scene) || !/^[a-z0-9-]+$/i.test(scene.id || '')) throw new Error('Each intro scene needs a safe id.');
		if (!['cinematic', 'title', 'ready'].includes(scene.kind)) throw new Error(`Intro scene ${scene.id} has an unsupported kind.`);
		if (!isFiniteNonNegative(scene.durationMs) || !isFiniteNonNegative(scene.transitionMs)) throw new Error(`Intro scene ${scene.id} has invalid timing.`);
		if (!isRecord(scene.camera) || !isFiniteNonNegative(scene.camera.scaleFrom) || !isFiniteNonNegative(scene.camera.scaleTo)) {
			throw new Error(`Intro scene ${scene.id} needs valid camera scales.`);
		}
	}
	if (!config.scenes.some((scene) => scene.kind === 'ready')) throw new Error('Intro needs one ready scene.');
	if (!isRecord(config.locales) || !isRecord(config.locales.en)) throw new Error('Intro English copy is required.');
	for (const key of ['loading', 'ready', 'enter', 'enterWithSound', 'enterSilent', 'skip', 'soundChoice']) {
		if (typeof config.locales.en[key] !== 'string' || !config.locales.en[key].trim()) throw new Error(`Intro copy ${key} is required.`);
	}
	return config;
}

validateIntroConfig();
