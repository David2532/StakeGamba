export const BOOT_INTRO_VERSION = 1;
export const INTRO_SEEN_KEY = `blacksite.boot-intro.v${BOOT_INTRO_VERSION}.seen`;

/**
 * @typedef {{
 *   status: 'idle' | 'playing' | 'completed' | 'skipped' | 'bypassed' | 'destroyed',
 *   beat: null | 'wake' | 'scan' | 'title' | 'breach' | 'resolve',
 *   profile: null | 'normal' | 'turbo',
 *   dismissReason: string | null
 * }} IntroState
 */

function profile(durationMs, watchdogMs, beats) {
	return Object.freeze({
		durationMs,
		watchdogMs,
		beats: Object.freeze(beats.map((beat) => Object.freeze(beat))),
	});
}

export const BOOT_INTRO_PROFILES = Object.freeze({
	normal: profile(4_000, 4_250, [
		{ id: 'wake', atMs: 0 },
		{ id: 'scan', atMs: 350 },
		{ id: 'title', atMs: 1_200 },
		{ id: 'breach', atMs: 2_200 },
		{ id: 'resolve', atMs: 3_200 },
	]),
	turbo: profile(1_200, 1_450, [
		{ id: 'wake', atMs: 0 },
		{ id: 'scan', atMs: 100 },
		{ id: 'title', atMs: 300 },
		{ id: 'breach', atMs: 600 },
		{ id: 'resolve', atMs: 900 },
	]),
});

/** @returns {IntroState} */
export function createInitialIntroState() {
	return Object.freeze({
		status: 'idle',
		beat: null,
		profile: null,
		dismissReason: null,
	});
}

export function readIntroSeen(storage) {
	try {
		return storage?.getItem(INTRO_SEEN_KEY) === String(BOOT_INTRO_VERSION);
	} catch {
		return false;
	}
}

export function writeIntroSeen(storage) {
	try {
		storage?.setItem(INTRO_SEEN_KEY, String(BOOT_INTRO_VERSION));
		return true;
	} catch {
		return false;
	}
}

export function getBrowserStorage(browserWindow) {
	try {
		return browserWindow?.localStorage ?? null;
	} catch {
		return null;
	}
}

export function introEligibility({
	launchKind = 'booting',
	activeRound = false,
	reducedMotion = false,
	seen = false,
	motionMode = 'normal',
	disabledTurbo = false,
	documentHidden = false,
} = {}) {
	if (launchKind === 'replay') return { play: false, profile: null, reason: 'replay' };
	if (launchKind === 'fixture') return { play: false, profile: null, reason: 'fixture' };
	if (launchKind === 'error') return { play: false, profile: null, reason: 'launch-error' };
	if (launchKind !== 'live') return { play: false, profile: null, reason: 'not-live' };
	if (activeRound) return { play: false, profile: null, reason: 'active-round-restore' };
	if (reducedMotion) return { play: false, profile: null, reason: 'reduced-motion' };
	if (documentHidden) return { play: false, profile: null, reason: 'document-hidden' };
	if (seen) return { play: false, profile: null, reason: 'seen' };
	return {
		play: true,
		profile: motionMode === 'turbo' && !disabledTurbo ? 'turbo' : 'normal',
		reason: null,
	};
}
