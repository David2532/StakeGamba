export const BOOT_SEQUENCE_STATE = Object.freeze({
	BOOT: 'BOOT',
	PRELOADING: 'PRELOADING',
	READY_FOR_INTRO: 'READY_FOR_INTRO',
	INTRO_PLAYING: 'INTRO_PLAYING',
	MISSION_BRIEFING: 'MISSION_BRIEFING',
	ENTERING_GAME: 'ENTERING_GAME',
	GAME_READY: 'GAME_READY',
	INTRO_UNAVAILABLE: 'INTRO_UNAVAILABLE',
	INTRO_ERROR: 'INTRO_ERROR',
	ASSET_ERROR: 'ASSET_ERROR',
});

export const DEFAULT_BOOT_SEQUENCE_TIMINGS = Object.freeze({
	preloadTimeoutMs: 20_000,
	skipDelayMs: 1_500,
	introTimeoutMs: 20_000,
	introWatchdogBufferMs: 4_000,
	endFrameHoldMs: 480,
	fallbackHoldMs: 900,
	enteringDurationMs: 450,
});

const TRANSITIONS = Object.freeze({
	[BOOT_SEQUENCE_STATE.BOOT]: Object.freeze([BOOT_SEQUENCE_STATE.PRELOADING]),
	[BOOT_SEQUENCE_STATE.PRELOADING]: Object.freeze([
		BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
		BOOT_SEQUENCE_STATE.ASSET_ERROR,
	]),
	[BOOT_SEQUENCE_STATE.READY_FOR_INTRO]: Object.freeze([
		BOOT_SEQUENCE_STATE.INTRO_PLAYING,
		BOOT_SEQUENCE_STATE.MISSION_BRIEFING,
		BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
		BOOT_SEQUENCE_STATE.INTRO_ERROR,
	]),
	[BOOT_SEQUENCE_STATE.INTRO_PLAYING]: Object.freeze([
		BOOT_SEQUENCE_STATE.MISSION_BRIEFING,
		BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
		BOOT_SEQUENCE_STATE.INTRO_ERROR,
	]),
	[BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE]: Object.freeze([BOOT_SEQUENCE_STATE.MISSION_BRIEFING]),
	[BOOT_SEQUENCE_STATE.INTRO_ERROR]: Object.freeze([BOOT_SEQUENCE_STATE.MISSION_BRIEFING]),
	[BOOT_SEQUENCE_STATE.ASSET_ERROR]: Object.freeze([BOOT_SEQUENCE_STATE.MISSION_BRIEFING]),
	[BOOT_SEQUENCE_STATE.MISSION_BRIEFING]: Object.freeze([BOOT_SEQUENCE_STATE.ENTERING_GAME]),
	[BOOT_SEQUENCE_STATE.ENTERING_GAME]: Object.freeze([BOOT_SEQUENCE_STATE.GAME_READY]),
	[BOOT_SEQUENCE_STATE.GAME_READY]: Object.freeze([
		BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
		BOOT_SEQUENCE_STATE.MISSION_BRIEFING,
	]),
});

const STATE_TIMER_NAMES = Object.freeze({
	[BOOT_SEQUENCE_STATE.PRELOADING]: Object.freeze(['preload-watchdog']),
	[BOOT_SEQUENCE_STATE.INTRO_PLAYING]: Object.freeze([
		'intro-skip-gate',
		'intro-watchdog',
		'intro-end-frame',
	]),
	[BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE]: Object.freeze(['fallback']),
	[BOOT_SEQUENCE_STATE.INTRO_ERROR]: Object.freeze(['fallback']),
	[BOOT_SEQUENCE_STATE.ASSET_ERROR]: Object.freeze(['fallback']),
	[BOOT_SEQUENCE_STATE.ENTERING_GAME]: Object.freeze(['entering-game']),
});

function boundedTiming(value, fallback, maximum) {
	const candidate = Number(value);
	if (!Number.isFinite(candidate)) return fallback;
	return Math.max(1, Math.min(maximum, Math.round(candidate)));
}

function normalizeTimings(overrides = {}) {
	return Object.freeze({
		preloadTimeoutMs: boundedTiming(overrides?.preloadTimeoutMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.preloadTimeoutMs, 60_000),
		skipDelayMs: boundedTiming(overrides?.skipDelayMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.skipDelayMs, 10_000),
		introTimeoutMs: boundedTiming(overrides?.introTimeoutMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.introTimeoutMs, 60_000),
		introWatchdogBufferMs: boundedTiming(
			overrides?.introWatchdogBufferMs,
			DEFAULT_BOOT_SEQUENCE_TIMINGS.introWatchdogBufferMs,
			15_000,
		),
		endFrameHoldMs: boundedTiming(overrides?.endFrameHoldMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.endFrameHoldMs, 2_000),
		fallbackHoldMs: boundedTiming(overrides?.fallbackHoldMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.fallbackHoldMs, 10_000),
		enteringDurationMs: boundedTiming(overrides?.enteringDurationMs, DEFAULT_BOOT_SEQUENCE_TIMINGS.enteringDurationMs, 10_000),
	});
}

function normalizeLaunchKind(value) {
	return value === 'replay' ? 'replay' : 'live';
}

function normalizeIntroDurationMs(value) {
	const seconds = Number(value);
	if (!Number.isFinite(seconds) || seconds <= 0) return null;
	return Math.min(60_000, Math.max(1_000, Math.round(seconds * 1_000)));
}

function normalizeReason(value, fallback) {
	const reason = typeof value === 'string' ? value.trim() : '';
	return reason || fallback;
}

function serializeError(error, fallbackMessage) {
	if (error && typeof error === 'object') {
		const message = normalizeReason(error.message, fallbackMessage);
		const name = normalizeReason(error.name, 'Error');
		const code = typeof error.code === 'string' || Number.isSafeInteger(error.code)
			? error.code
			: null;
		return Object.freeze({ name, message, code });
	}
	return Object.freeze({
		name: 'Error',
		message: normalizeReason(error, fallbackMessage),
		code: null,
	});
}

function absorbCallback(result) {
	if (result && typeof result.then === 'function') void result.catch(() => {});
}

function isValidTotal(value) {
	return Number.isSafeInteger(value) && value >= 0;
}

function isValidAssetId(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * DOM-free boot flow coordinator. Media and asset loaders report events into this
 * class; the UI owns rendering, focus, media elements and visibility listeners.
 */
export class BootSequenceDirector {
	constructor({
		onChange = () => {},
		timings = {},
		setTimer = (callback, durationMs) => setTimeout(callback, durationMs),
		clearTimer = (timer) => clearTimeout(timer),
		now = () => Date.now(),
		reducedMotion = false,
		launchKind = 'live',
		activeRound = false,
	} = {}) {
		if (
			typeof onChange !== 'function'
			|| typeof setTimer !== 'function'
			|| typeof clearTimer !== 'function'
			|| typeof now !== 'function'
		) {
			throw new TypeError('Boot sequence callbacks and clock adapters must be functions.');
		}

		this.onChange = onChange;
		this.setTimer = setTimer;
		this.clearTimer = clearTimer;
		this.now = now;
		this.timings = normalizeTimings(timings);
		this.timers = new Map();
		this.assetRecords = new Map();
		this.destroyed = false;
		this.suspended = false;
		this.generation = 0;
		this.revision = 0;
		this.state = BOOT_SEQUENCE_STATE.BOOT;
		this.origin = 'startup';
		this.reason = 'created';
		this.error = null;
		this.skippable = false;
		this.reducedMotion = reducedMotion === true;
		this.launchKind = normalizeLaunchKind(launchKind);
		this.activeRound = activeRound === true;
		this.preloadTotal = 0;
		this.preloadLoaded = 0;
		this.preloadFailed = 0;
		this.preloadTimedOut = 0;
		this.currentSnapshot = this.#buildSnapshot();
	}

	get snapshot() {
		return this.currentSnapshot;
	}

	#buildSnapshot() {
		const settled = this.preloadLoaded + this.preloadFailed;
		const fraction = this.preloadTotal === 0
			? (this.state === BOOT_SEQUENCE_STATE.BOOT ? 0 : 1)
			: Math.min(1, settled / this.preloadTotal);
		const records = [...this.assetRecords.values()];
		const preload = Object.freeze({
			total: this.preloadTotal,
			settled,
			loaded: this.preloadLoaded,
			failed: this.preloadFailed,
			remaining: Math.max(0, this.preloadTotal - settled),
			timedOut: this.preloadTimedOut,
			fraction,
			percent: Math.round(fraction * 100),
			recordedIds: Object.freeze(records.map((record) => record.id)),
			failureIds: Object.freeze(records.filter((record) => !record.ok).map((record) => record.id)),
		});

		return Object.freeze({
			state: this.state,
			inputLocked: this.state !== BOOT_SEQUENCE_STATE.GAME_READY,
			skippable: this.skippable,
			suspended: this.suspended,
			origin: this.origin,
			preferences: Object.freeze({
				reducedMotion: this.reducedMotion,
				launchKind: this.launchKind,
				activeRound: this.activeRound,
			}),
			preload,
			error: this.error,
			reason: this.reason,
			generation: this.generation,
			revision: this.revision,
			pendingTimerCount: this.timers.size,
			destroyed: this.destroyed,
		});
	}

	#notify() {
		if (this.destroyed) return;
		try {
			absorbCallback(this.onChange(this.currentSnapshot));
		} catch {
			// Presentation observers cannot stall or corrupt the boot sequence.
		}
	}

	#publish() {
		if (this.destroyed) return false;
		this.revision += 1;
		this.currentSnapshot = this.#buildSnapshot();
		this.#notify();
		return true;
	}

	#clearNamedTimer(name) {
		const record = this.timers.get(name);
		if (!record) return false;
		if (record.handle !== null) this.clearTimer(record.handle);
		this.timers.delete(name);
		return true;
	}

	#clearStateTimers(state) {
		for (const name of STATE_TIMER_NAMES[state] ?? []) this.#clearNamedTimer(name);
	}

	#clearAllTimers() {
		for (const name of [...this.timers.keys()]) this.#clearNamedTimer(name);
	}

	#armTimer(record) {
		if (this.suspended || this.destroyed) return;
		record.dueAt = this.now() + record.remainingMs;
		record.handle = this.setTimer(() => {
			if (this.timers.get(record.name) !== record) return;
			this.timers.delete(record.name);
			record.handle = null;
			if (this.destroyed || record.generation !== this.generation) return;
			record.callback();
		}, record.remainingMs);
	}

	#schedule(
		name,
		durationMs,
		callback,
		expectedState = this.state,
		expectedGeneration = this.generation,
	) {
		if (
			this.destroyed
			|| this.state !== expectedState
			|| this.generation !== expectedGeneration
		) return false;
		this.#clearNamedTimer(name);
		const record = {
			name,
			callback,
			generation: expectedGeneration,
			remainingMs: durationMs,
			dueAt: null,
			handle: null,
		};
		this.timers.set(name, record);
		this.#armTimer(record);
		this.#publish();
		return this.state === expectedState && this.generation === expectedGeneration;
	}

	#transition(nextState, { reason = null, error = null, origin = this.origin } = {}) {
		if (this.destroyed || !TRANSITIONS[this.state]?.includes(nextState)) return false;
		this.#clearStateTimers(this.state);
		this.state = nextState;
		this.origin = origin;
		this.reason = reason;
		this.error = error;
		this.skippable = false;
		this.generation += 1;
		this.#publish();
		return true;
	}

	#scheduleFallback() {
		if (![
			BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
			BOOT_SEQUENCE_STATE.INTRO_ERROR,
			BOOT_SEQUENCE_STATE.ASSET_ERROR,
		].includes(this.state)) return false;
		const state = this.state;
		const generation = this.generation;
		return this.#schedule('fallback', this.timings.fallbackHoldMs, () => {
			this.showMissionBriefing('automatic-fallback');
		}, state, generation);
	}

	beginPreloading(total) {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.BOOT || !isValidTotal(total)) return false;
		this.assetRecords.clear();
		this.preloadTotal = total;
		this.preloadLoaded = 0;
		this.preloadFailed = 0;
		this.preloadTimedOut = 0;
		if (!this.#transition(BOOT_SEQUENCE_STATE.PRELOADING, { reason: 'preloading-started', origin: 'startup' })) {
			return false;
		}

		if (total === 0) return this.readyForIntro();
		const generation = this.generation;
		this.#schedule('preload-watchdog', this.timings.preloadTimeoutMs, () => {
			const missingCount = Math.max(0, this.preloadTotal - this.preloadLoaded - this.preloadFailed);
			this.preloadFailed += missingCount;
			this.preloadTimedOut += missingCount;
			const error = serializeError(
				new Error(`${missingCount} required boot asset${missingCount === 1 ? '' : 's'} timed out.`),
				'Boot assets timed out.',
			);
			this.#transition(BOOT_SEQUENCE_STATE.ASSET_ERROR, { reason: 'preload-timeout', error });
			this.#scheduleFallback();
		}, BOOT_SEQUENCE_STATE.PRELOADING, generation);
		return true;
	}

	recordAsset(id, { ok = true, critical = true, error = null } = {}) {
		const normalizedId = typeof id === 'string' ? id.trim() : '';
		const settled = this.preloadLoaded + this.preloadFailed;
		if (
			this.destroyed
			|| this.state !== BOOT_SEQUENCE_STATE.PRELOADING
			|| !isValidAssetId(normalizedId)
			|| this.assetRecords.has(normalizedId)
			|| settled >= this.preloadTotal
		) {
			return false;
		}

		const succeeded = ok === true;
		const serialized = succeeded ? null : serializeError(error, `Failed to load boot asset: ${normalizedId}`);
		this.assetRecords.set(normalizedId, Object.freeze({
			id: normalizedId,
			ok: succeeded,
			critical: critical !== false,
			error: serialized,
		}));
		if (succeeded) this.preloadLoaded += 1;
		else this.preloadFailed += 1;

		if (!succeeded && critical !== false) {
			this.#transition(BOOT_SEQUENCE_STATE.ASSET_ERROR, {
				reason: `asset-failed:${normalizedId}`,
				error: serialized,
			});
			this.#scheduleFallback();
			return true;
		}

		if (this.preloadLoaded + this.preloadFailed === this.preloadTotal) this.readyForIntro();
		else this.#publish();
		return true;
	}

	finishPreloading() {
		return this.readyForIntro();
	}

	readyForIntro() {
		if (this.destroyed) return false;
		if (this.state === BOOT_SEQUENCE_STATE.READY_FOR_INTRO) return true;
		if (
			this.state !== BOOT_SEQUENCE_STATE.PRELOADING
			|| this.preloadLoaded + this.preloadFailed !== this.preloadTotal
		) {
			return false;
		}
		return this.#transition(BOOT_SEQUENCE_STATE.READY_FOR_INTRO, { reason: 'assets-settled' });
	}

	beginIntro({ durationSeconds = null } = {}) {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.READY_FOR_INTRO) return false;
		const restoreBypass = this.launchKind === 'replay' || this.activeRound;
		if (this.reducedMotion || restoreBypass) {
			return this.showMissionBriefing(
				this.reducedMotion
					? 'reduced-motion'
					: 'restore-detected',
			);
		}
		if (!this.#transition(BOOT_SEQUENCE_STATE.INTRO_PLAYING, { reason: 'intro-started' })) return false;
		const generation = this.generation;
		if (!this.#schedule('intro-skip-gate', this.timings.skipDelayMs, () => {
			this.skippable = true;
			this.#publish();
		}, BOOT_SEQUENCE_STATE.INTRO_PLAYING, generation)) return true;
		const declaredDurationMs = normalizeIntroDurationMs(durationSeconds);
		const watchdogDurationMs = Math.max(
			this.timings.introTimeoutMs,
			(declaredDurationMs ?? 0) + this.timings.introWatchdogBufferMs,
		);
		this.#schedule('intro-watchdog', watchdogDurationMs, () => {
			this.introError(new Error('Boot intro did not complete before its watchdog expired.'));
		}, BOOT_SEQUENCE_STATE.INTRO_PLAYING, generation);
		return true;
	}

	completeIntroPlayback() {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING) return false;
		this.#clearNamedTimer('intro-skip-gate');
		this.#clearNamedTimer('intro-watchdog');
		this.skippable = false;
		this.reason = 'intro-ended-end-frame';
		const generation = this.generation;
		return this.#schedule(
			'intro-end-frame',
			this.timings.endFrameHoldMs,
			() => this.showMissionBriefing('intro-ended'),
			BOOT_SEQUENCE_STATE.INTRO_PLAYING,
			generation,
		);
	}

	introUnavailable(reason = 'intro-unavailable') {
		if (
			this.destroyed
			|| ![
				BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
				BOOT_SEQUENCE_STATE.INTRO_PLAYING,
			].includes(this.state)
		) {
			return false;
		}
		if (!this.#transition(BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE, {
			reason: normalizeReason(reason, 'intro-unavailable'),
		})) return false;
		this.#scheduleFallback();
		return true;
	}

	introError(error) {
		if (
			this.destroyed
			|| ![
				BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
				BOOT_SEQUENCE_STATE.INTRO_PLAYING,
			].includes(this.state)
		) {
			return false;
		}
		const serialized = serializeError(error, 'The boot intro could not be played.');
		if (!this.#transition(BOOT_SEQUENCE_STATE.INTRO_ERROR, {
			reason: 'intro-error',
			error: serialized,
		})) return false;
		this.#scheduleFallback();
		return true;
	}

	showMissionBriefing(reason = 'intro-ended') {
		if (this.destroyed) return false;
		if (this.state === BOOT_SEQUENCE_STATE.MISSION_BRIEFING) return true;
		const normalized = normalizeReason(reason, 'intro-ended');
		const skipRequested = normalized.toLowerCase().includes('skip');
		if (this.state === BOOT_SEQUENCE_STATE.INTRO_PLAYING && skipRequested && !this.skippable) {
			return false;
		}
		if (![
			BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
			BOOT_SEQUENCE_STATE.INTRO_PLAYING,
			BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
			BOOT_SEQUENCE_STATE.INTRO_ERROR,
			BOOT_SEQUENCE_STATE.ASSET_ERROR,
		].includes(this.state)) {
			return false;
		}
		return this.#transition(BOOT_SEQUENCE_STATE.MISSION_BRIEFING, { reason: normalized });
	}

	beginEnteringGame() {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.MISSION_BRIEFING) return false;
		if (!this.#transition(BOOT_SEQUENCE_STATE.ENTERING_GAME, { reason: 'mission-accepted' })) return false;
		const generation = this.generation;
		this.#schedule(
			'entering-game',
			this.timings.enteringDurationMs,
			() => this.gameReady(),
			BOOT_SEQUENCE_STATE.ENTERING_GAME,
			generation,
		);
		return true;
	}

	gameReady() {
		if (this.destroyed) return false;
		if (this.state === BOOT_SEQUENCE_STATE.GAME_READY) return true;
		if (this.state !== BOOT_SEQUENCE_STATE.ENTERING_GAME) return false;
		return this.#transition(BOOT_SEQUENCE_STATE.GAME_READY, { reason: 'game-ready' });
	}

	replayIntro() {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.GAME_READY) return false;
		return this.#transition(BOOT_SEQUENCE_STATE.READY_FOR_INTRO, {
			reason: 'intro-replay-requested',
			origin: 'intro-replay',
		});
	}

	openMissionBriefing() {
		if (this.destroyed || this.state !== BOOT_SEQUENCE_STATE.GAME_READY) return false;
		return this.#transition(BOOT_SEQUENCE_STATE.MISSION_BRIEFING, {
			reason: 'mission-briefing-reopened',
			origin: 'briefing-reopen',
		});
	}

	setReducedMotion(value) {
		if (this.destroyed) return false;
		const nextValue = value === true;
		if (this.reducedMotion === nextValue) return true;
		this.reducedMotion = nextValue;
		this.#publish();
		if (nextValue && this.state === BOOT_SEQUENCE_STATE.INTRO_PLAYING) {
			this.showMissionBriefing('reduced-motion');
		}
		return true;
	}

	setLaunchContext({ launchKind = this.launchKind, activeRound = this.activeRound } = {}) {
		if (this.destroyed) return false;
		const nextLaunchKind = normalizeLaunchKind(launchKind);
		const nextActiveRound = activeRound === true;
		const changed = this.launchKind !== nextLaunchKind || this.activeRound !== nextActiveRound;
		this.launchKind = nextLaunchKind;
		this.activeRound = nextActiveRound;
		if (changed) this.#publish();

		const restoreDetected = this.launchKind === 'replay' || this.activeRound;
		if (restoreDetected && [
			BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
			BOOT_SEQUENCE_STATE.INTRO_PLAYING,
		].includes(this.state)) {
			return this.showMissionBriefing('restore-detected');
		}
		return true;
	}

	setSuspended(value) {
		if (this.destroyed) return false;
		const nextValue = value === true;
		if (nextValue === this.suspended) return true;
		this.suspended = nextValue;
		if (nextValue) {
			const now = this.now();
			for (const record of this.timers.values()) {
				if (record.handle === null) continue;
				this.clearTimer(record.handle);
				record.handle = null;
				record.remainingMs = Math.max(0, record.dueAt - now);
				record.dueAt = null;
			}
		} else {
			for (const record of this.timers.values()) this.#armTimer(record);
		}
		this.#publish();
		return true;
	}

	reset({ reducedMotion, launchKind, activeRound } = {}) {
		if (this.destroyed) return false;
		this.#clearAllTimers();
		this.assetRecords.clear();
		this.preloadTotal = 0;
		this.preloadLoaded = 0;
		this.preloadFailed = 0;
		this.preloadTimedOut = 0;
		this.state = BOOT_SEQUENCE_STATE.BOOT;
		this.origin = 'startup';
		this.reason = 'reset';
		this.error = null;
		this.skippable = false;
		this.suspended = false;
		if (reducedMotion !== undefined) this.reducedMotion = reducedMotion === true;
		if (launchKind !== undefined) this.launchKind = normalizeLaunchKind(launchKind);
		if (activeRound !== undefined) this.activeRound = activeRound === true;
		this.generation += 1;
		this.#publish();
		return true;
	}

	destroy() {
		if (this.destroyed) return;
		this.#clearAllTimers();
		this.assetRecords.clear();
		this.destroyed = true;
		this.skippable = false;
		this.currentSnapshot = this.#buildSnapshot();
		this.onChange = () => {};
	}
}
