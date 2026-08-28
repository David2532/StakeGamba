/**
 * DEV-only motion clock for prototyping a coherent Vault animation surface.
 *
 * This module owns presentation time only. It deliberately has no knowledge of
 * gameplay authority. A future visual surface can consume the normalized
 * channels without making animation completion authoritative.
 */

export const DEV_VAULT_STAGE = Object.freeze({
	SEALED: 'sealed',
	WHEEL: 'wheel',
	LOCKS: 'locks',
	DOOR: 'door',
	LIGHT: 'light',
	AWARD: 'award',
});

export const DEV_VAULT_CUE = Object.freeze({
	[DEV_VAULT_STAGE.SEALED]: 'vault-notice',
	[DEV_VAULT_STAGE.WHEEL]: 'vault-wheel-turn',
	[DEV_VAULT_STAGE.LOCKS]: 'vault-locks-release',
	[DEV_VAULT_STAGE.DOOR]: 'vault-door-open',
	[DEV_VAULT_STAGE.LIGHT]: 'vault-light-entry',
	[DEV_VAULT_STAGE.AWARD]: 'free-spins-awarded',
});

export const DEFAULT_DEV_VAULT_MOTION_TIMINGS = Object.freeze({
	sealed: 520,
	wheel: 1_100,
	locks: 680,
	door: 1_100,
	light: 720,
	award: 1_500,
});

export const MAX_DEV_VAULT_MOTION_MS = 4_200;

const MIN_STAGE_MS = 16;
const MAX_STAGE_MS = 5_000;
const SKIP_TO_AWARD_MS = 240;
const SKIP_AWARD_MS = 160;
const TURBO_RATE = 2.5;
const REDUCED_MOTION_SCALE = 0.16;
const REDUCED_MOTION_TURBO_SCALE = 0.38;
const DIRECT_ENTRY_SCALE = 0.78;
const REDUCED_MOTION_AWARD_HOLD_MS = 900;

const STAGE_ORDER = Object.freeze([
	DEV_VAULT_STAGE.SEALED,
	DEV_VAULT_STAGE.WHEEL,
	DEV_VAULT_STAGE.LOCKS,
	DEV_VAULT_STAGE.DOOR,
	DEV_VAULT_STAGE.LIGHT,
	DEV_VAULT_STAGE.AWARD,
]);

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function boundedDuration(value, fallback) {
	const duration = Number(value);
	if (!Number.isFinite(duration)) return fallback;
	return Math.max(MIN_STAGE_MS, Math.min(MAX_STAGE_MS, Math.round(duration)));
}

function fitMotionDurations(durations) {
	const motionStages = STAGE_ORDER.slice(0, -1);
	const total = motionStages.reduce((sum, stage) => sum + durations[stage], 0);
	if (total <= MAX_DEV_VAULT_MOTION_MS) return durations;

	const scale = MAX_DEV_VAULT_MOTION_MS / total;
	const fitted = { ...durations };
	for (const stage of motionStages) {
		fitted[stage] = Math.max(MIN_STAGE_MS, Math.floor(durations[stage] * scale));
	}

	let overflow = motionStages.reduce((sum, stage) => sum + fitted[stage], 0)
		- MAX_DEV_VAULT_MOTION_MS;
	for (const stage of [...motionStages].reverse()) {
		if (overflow <= 0) break;
		const removable = Math.max(0, fitted[stage] - MIN_STAGE_MS);
		const removed = Math.min(removable, overflow);
		fitted[stage] -= removed;
		overflow -= removed;
	}
	return fitted;
}

export function createDevVaultMotionTimeline({
	timings = {},
	reducedMotion = false,
	turbo = false,
	direct = false,
} = {}) {
	const normalized = Object.fromEntries(STAGE_ORDER.map((stage) => [
		stage,
		boundedDuration(timings?.[stage], DEFAULT_DEV_VAULT_MOTION_TIMINGS[stage]),
	]));
	const reducedScale = REDUCED_MOTION_SCALE
		* (turbo ? REDUCED_MOTION_TURBO_SCALE : 1)
		* (direct ? DIRECT_ENTRY_SCALE : 1);
	const durations = reducedMotion
		? Object.fromEntries(STAGE_ORDER.map((stage) => [
			stage,
			stage === DEV_VAULT_STAGE.AWARD
				? Math.max(
					Math.min(normalized[stage], REDUCED_MOTION_AWARD_HOLD_MS),
					Math.round(normalized[stage] * reducedScale),
				)
				: Math.max(MIN_STAGE_MS, Math.round(normalized[stage] * reducedScale)),
		]))
		: fitMotionDurations(normalized);
	let cursor = 0;
	const stages = STAGE_ORDER.map((stage, index) => {
		const durationMs = durations[stage];
		const entry = Object.freeze({
			stage,
			cue: DEV_VAULT_CUE[stage],
			index,
			startMs: cursor,
			endMs: cursor + durationMs,
			durationMs,
		});
		cursor = entry.endMs;
		return entry;
	});
	const motionDurationMs = stages.at(-1).startMs;

	return Object.freeze({
		stages: Object.freeze(stages),
		motionDurationMs,
		durationMs: cursor,
	});
}

function defaultRequestFrame(callback) {
	if (typeof globalThis.requestAnimationFrame !== 'function') {
		throw new Error('DevVaultMotionDirector requires requestAnimationFrame or an injected requestFrame.');
	}
	return globalThis.requestAnimationFrame(callback);
}

function defaultCancelFrame(handle) {
	globalThis.cancelAnimationFrame?.(handle);
}

function absorbCallback(callback, ...args) {
	try {
		const result = callback(...args);
		if (result && typeof result.then === 'function') void result.catch(() => {});
	} catch {
		// DEV visual observers and audio must never control completion.
	}
}

function playbackRate({ turbo, reducedMotion }) {
	// Reduced motion owns a compact semantic timeline instead of accelerating the
	// full spatial trajectory. Keeping its clock at 1x prevents a 4x door/dolly.
	if (reducedMotion) return 1;
	if (turbo) return TURBO_RATE;
	return 1;
}

function channelProgress(entry, elapsedMs) {
	return clamp01((elapsedMs - entry.startMs) / entry.durationMs);
}

function frozenChannels(timeline, elapsedMs) {
	return Object.freeze(Object.fromEntries(
		timeline.stages.map((entry) => [entry.stage, channelProgress(entry, elapsedMs)]),
	));
}

function inactiveSnapshot(generation = 0, reason = 'idle', preferences = {}) {
	return Object.freeze({
		active: false,
		completed: false,
		paused: false,
		skipping: false,
		stage: null,
		stageIndex: -1,
		stageCount: STAGE_ORDER.length,
		stageProgress: 0,
		progress: 0,
		motionProgress: 0,
		elapsedMs: 0,
		durationMs: 0,
		motionDurationMs: 0,
		effectiveDurationMs: 0,
		effectiveMotionDurationMs: 0,
		rate: playbackRate(preferences),
		turbo: Boolean(preferences.turbo),
		reducedMotion: Boolean(preferences.reducedMotion),
		channels: Object.freeze(Object.fromEntries(STAGE_ORDER.map((stage) => [stage, 0]))),
		generation,
		reason,
	});
}

export class DevVaultMotionDirector {
	constructor({
		onChange = () => {},
		onCue = () => {},
		requestFrame = defaultRequestFrame,
		cancelFrame = defaultCancelFrame,
		timings = {},
		turbo = false,
		reducedMotion = false,
	} = {}) {
		if (typeof onChange !== 'function') throw new TypeError('onChange must be a function.');
		if (typeof onCue !== 'function') throw new TypeError('onCue must be a function.');
		if (typeof requestFrame !== 'function') throw new TypeError('requestFrame must be a function.');
		if (typeof cancelFrame !== 'function') throw new TypeError('cancelFrame must be a function.');
		if (typeof turbo !== 'boolean') throw new TypeError('turbo must be boolean.');
		if (typeof reducedMotion !== 'boolean') throw new TypeError('reducedMotion must be boolean.');

		this.onChange = onChange;
		this.onCue = onCue;
		this.requestFrame = requestFrame;
		this.cancelFrame = cancelFrame;
		this.defaultTimings = Object.freeze({ ...timings });
		this.turbo = turbo;
		this.reducedMotion = reducedMotion;
		this.timeline = null;
		this.flow = null;
		this.frameHandle = null;
		this.frameToken = 0;
		this.lastTimestamp = null;
		this.elapsedMs = 0;
		this.stageIndex = -1;
		this.skipRate = 1;
		this.skipTargetMs = null;
		this.destroyed = false;
		this.generation = 0;
		this.state = inactiveSnapshot(this.generation, 'created', this);
		this.completionPromise = Promise.resolve(false);
	}

	get snapshot() {
		return this.state;
	}

	get completion() {
		return this.completionPromise;
	}

	#assertUsable() {
		if (this.destroyed) throw new Error('DevVaultMotionDirector has been destroyed.');
	}

	#currentRate() {
		return Math.max(playbackRate(this), this.skipRate);
	}

	#snapshotAt(elapsedMs, patch = {}) {
		const timeline = this.timeline;
		if (!timeline) return inactiveSnapshot(this.generation, patch.reason, this);
		const boundedElapsed = Math.max(0, Math.min(timeline.durationMs, elapsedMs));
		let stageIndex = timeline.stages.length - 1;
		for (let index = timeline.stages.length - 1; index >= 0; index -= 1) {
			if (boundedElapsed >= timeline.stages[index].startMs) {
				stageIndex = index;
				break;
			}
		}
		const entry = timeline.stages[stageIndex];
		const baseRate = playbackRate(this);
		return Object.freeze({
			active: true,
			completed: false,
			paused: false,
			skipping: this.skipTargetMs !== null,
			stage: entry.stage,
			stageIndex,
			stageCount: timeline.stages.length,
			stageProgress: channelProgress(entry, boundedElapsed),
			progress: clamp01(boundedElapsed / timeline.durationMs),
			motionProgress: clamp01(boundedElapsed / timeline.motionDurationMs),
			elapsedMs: boundedElapsed,
			durationMs: timeline.durationMs,
			motionDurationMs: timeline.motionDurationMs,
			effectiveDurationMs: timeline.durationMs / baseRate,
			effectiveMotionDurationMs: timeline.motionDurationMs / baseRate,
			rate: this.#currentRate(),
			turbo: this.turbo,
			reducedMotion: this.reducedMotion,
			channels: frozenChannels(timeline, boundedElapsed),
			generation: this.generation,
			reason: 'frame',
			...patch,
		});
	}

	#publish(snapshot) {
		if (this.destroyed) return;
		this.state = snapshot;
		absorbCallback(this.onChange, snapshot);
	}

	#emitCue(index) {
		const entry = this.timeline?.stages[index];
		if (!entry) return;
		absorbCallback(this.onCue, entry.cue, Object.freeze({
			stage: entry.stage,
			stageIndex: index,
			elapsedMs: entry.startMs,
			generation: this.generation,
			snapshot: this.state,
		}));
	}

	#clearFrame() {
		this.frameToken += 1;
		if (this.frameHandle !== null) this.cancelFrame(this.frameHandle);
		this.frameHandle = null;
	}

	#schedule(generation) {
		if (this.frameHandle !== null || this.destroyed || !this.flow || this.state.paused) return;
		const token = ++this.frameToken;
		this.frameHandle = this.requestFrame((timestamp) => {
			if (token !== this.frameToken) return;
			this.frameHandle = null;
			this.#tick(timestamp, generation);
		});
	}

	#tick(timestamp, generation) {
		if (this.destroyed || !this.flow || generation !== this.generation || this.state.paused) return;
		if (!Number.isFinite(timestamp)) {
			this.#schedule(generation);
			return;
		}
		if (this.lastTimestamp === null) {
			this.lastTimestamp = timestamp;
			this.#schedule(generation);
			return;
		}

		const deltaMs = Math.max(0, timestamp - this.lastTimestamp);
		this.lastTimestamp = timestamp;
		this.#advanceTo(this.elapsedMs + (deltaMs * this.#currentRate()), generation);
		if (this.flow && generation === this.generation && !this.state.paused) this.#schedule(generation);
	}

	#advanceTo(candidateElapsedMs, generation) {
		if (!this.flow || generation !== this.generation) return;
		const target = Math.min(this.timeline.durationMs, Math.max(this.elapsedMs, candidateElapsedMs));
		let enteredAtTarget = false;

		for (let index = this.stageIndex + 1; index < this.timeline.stages.length; index += 1) {
			const entry = this.timeline.stages[index];
			if (entry.startMs > target) break;
			this.elapsedMs = entry.startMs;
			this.stageIndex = index;
			this.#publish(this.#snapshotAt(this.elapsedMs, { reason: 'cue-crossing' }));
			this.#emitCue(index);
			enteredAtTarget = entry.startMs === target;
		}

		this.elapsedMs = target;
		if (this.skipTargetMs !== null && target >= this.skipTargetMs) {
			this.skipTargetMs = null;
			this.skipRate = 1;
			enteredAtTarget = false;
		}

		if (target >= this.timeline.durationMs) {
			this.#complete(generation);
			return;
		}
		if (!enteredAtTarget) this.#publish(this.#snapshotAt(target));
	}

	#complete(generation) {
		if (!this.flow || generation !== this.generation) return false;
		this.#clearFrame();
		this.elapsedMs = this.timeline.durationMs;
		this.stageIndex = this.timeline.stages.length - 1;
		const finalState = this.#snapshotAt(this.elapsedMs, {
			active: false,
			completed: true,
			paused: false,
			skipping: false,
			rate: playbackRate(this),
			reason: 'completed',
		});
		this.#publish(finalState);
		const { resolve } = this.flow;
		this.flow = null;
		resolve(true);
		return true;
	}

	play(options = {}) {
		this.#assertUsable();
		if (options.turbo !== undefined && typeof options.turbo !== 'boolean') {
			throw new TypeError('turbo must be boolean.');
		}
		if (options.reducedMotion !== undefined && typeof options.reducedMotion !== 'boolean') {
			throw new TypeError('reducedMotion must be boolean.');
		}
		if (options.direct !== undefined && typeof options.direct !== 'boolean') {
			throw new TypeError('direct must be boolean.');
		}
		if (this.flow) this.cancel('superseded');
		this.turbo = options.turbo ?? this.turbo;
		this.reducedMotion = options.reducedMotion ?? this.reducedMotion;
		this.timeline = createDevVaultMotionTimeline({
			timings: { ...this.defaultTimings, ...options.timings },
			reducedMotion: this.reducedMotion,
			turbo: this.turbo,
			direct: options.direct === true,
		});
		this.generation += 1;
		this.elapsedMs = 0;
		this.stageIndex = 0;
		this.skipRate = 1;
		this.skipTargetMs = null;
		this.lastTimestamp = null;

		let resolveCompletion;
		this.completionPromise = new Promise((resolve) => { resolveCompletion = resolve; });
		this.flow = { generation: this.generation, resolve: resolveCompletion };
		this.#publish(this.#snapshotAt(0, { reason: 'play' }));
		this.#emitCue(0);
		this.#schedule(this.generation);
		return this.completionPromise;
	}

	pause() {
		this.#assertUsable();
		if (!this.flow || this.state.paused) return false;
		this.#clearFrame();
		this.lastTimestamp = null;
		this.#publish(this.#snapshotAt(this.elapsedMs, { paused: true, reason: 'paused' }));
		return true;
	}

	resume() {
		this.#assertUsable();
		if (!this.flow || !this.state.paused) return false;
		this.lastTimestamp = null;
		this.#publish(this.#snapshotAt(this.elapsedMs, { paused: false, reason: 'resumed' }));
		this.#schedule(this.generation);
		return true;
	}

	skip() {
		this.#assertUsable();
		if (!this.flow || this.skipTargetMs !== null) return false;
		const awardStart = this.timeline.motionDurationMs;
		const target = this.elapsedMs < awardStart ? awardStart : this.timeline.durationMs;
		const remaining = Math.max(0, target - this.elapsedMs);
		if (remaining === 0) return false;
		const budget = target === awardStart ? SKIP_TO_AWARD_MS : SKIP_AWARD_MS;
		this.skipTargetMs = target;
		this.skipRate = Math.max(playbackRate(this), remaining / budget);
		this.#publish(this.#snapshotAt(this.elapsedMs, { reason: 'skip' }));
		return true;
	}

	setTurbo(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('turbo must be boolean.');
		if (enabled === this.turbo) return this.state;
		this.turbo = enabled;
		if (this.timeline) this.#publish(this.#snapshotAt(this.elapsedMs, { reason: 'turbo' }));
		else this.#publish(inactiveSnapshot(this.generation, 'turbo', this));
		return this.state;
	}

	setReducedMotion(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('reducedMotion must be boolean.');
		if (enabled === this.reducedMotion) return this.state;
		this.reducedMotion = enabled;
		if (this.timeline) this.#publish(this.#snapshotAt(this.elapsedMs, { reason: 'reduced-motion' }));
		else this.#publish(inactiveSnapshot(this.generation, 'reduced-motion', this));
		return this.state;
	}

	cancel(reason = 'cancelled') {
		this.#assertUsable();
		if (!this.flow) return false;
		this.#clearFrame();
		const { resolve } = this.flow;
		this.flow = null;
		this.generation += 1;
		this.lastTimestamp = null;
		this.elapsedMs = 0;
		this.stageIndex = -1;
		this.skipRate = 1;
		this.skipTargetMs = null;
		this.timeline = null;
		this.#publish(inactiveSnapshot(this.generation, reason, this));
		resolve(false);
		return true;
	}

	destroy() {
		if (this.destroyed) return;
		if (this.flow) this.cancel('destroyed');
		this.#clearFrame();
		this.destroyed = true;
		this.onChange = () => {};
		this.onCue = () => {};
	}
}
