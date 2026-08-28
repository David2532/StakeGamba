const DEFAULT_CACHE_LIMIT = 12;
const DEFAULT_DECODE_AHEAD = 3;
const DEFAULT_REDUCED_MOTION_HOLD_MS = 150;
const DEFAULT_DEDUPE_LIMIT = 128;

export const OPERATOR_SEQUENCE = Object.freeze({
	IDLE: 'idle',
	LOSS: 'loss',
	LOSS_STREAK: 'lossStreak',
	WIN: 'win',
	BIG_WIN: 'bigWin',
	BONUS: 'bonus',
	RAGE: 'rage',
});

export const OPERATOR_REACTION_PRIORITY = Object.freeze({
	[OPERATOR_SEQUENCE.IDLE]: 0,
	[OPERATOR_SEQUENCE.LOSS]: 1,
	[OPERATOR_SEQUENCE.LOSS_STREAK]: 2,
	[OPERATOR_SEQUENCE.WIN]: 3,
	[OPERATOR_SEQUENCE.BIG_WIN]: 4,
	[OPERATOR_SEQUENCE.BONUS]: 5,
	[OPERATOR_SEQUENCE.RAGE]: 6,
});

function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPositiveInteger(value, label) {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new TypeError(`${label} must be a positive safe integer.`);
	}
}

function numericFrameIndex(source) {
	const match = String(source).match(/_(\d+)\.(?:png|webp)(?:[?#].*)?$/i);
	return match ? Number(match[1]) : null;
}

function normalizeCatalog(catalog) {
	if (!isRecord(catalog)) throw new TypeError('Operator animation catalog must be an object.');
	if (!isRecord(catalog[OPERATOR_SEQUENCE.IDLE])) {
		throw new TypeError('Operator animation catalog must include an idle sequence.');
	}

	const normalized = {};
	for (const [name, candidate] of Object.entries(catalog)) {
		if (!isRecord(candidate)) throw new TypeError(`${name} sequence must be an object.`);
		if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) {
			throw new TypeError(`${name} sequence must contain at least one frame.`);
		}

		const frames = candidate.frames.map((source, index) => {
			if (typeof source !== 'string' || source.length === 0) {
				throw new TypeError(`${name}.frames[${index}] must be a non-empty string.`);
			}
			return source;
		});
		if (new Set(frames).size !== frames.length) {
			throw new TypeError(`${name} sequence contains duplicate frame paths.`);
		}

		const numericIndices = frames.map(numericFrameIndex);
		if (numericIndices.some((index) => index !== null)) {
			if (numericIndices.some((index) => index === null)) {
				throw new TypeError(`${name} sequence mixes numbered and unnumbered raster frames.`);
			}
			numericIndices.forEach((frameIndex, position) => {
				if (frameIndex !== position) {
					throw new TypeError(`${name} sequence frames must be contiguous and numerically ordered.`);
				}
			});
		}

		if (!Number.isFinite(candidate.fps) || candidate.fps <= 0 || candidate.fps > 60) {
			throw new TypeError(`${name}.fps must be greater than zero and no more than 60.`);
		}
		if (typeof candidate.loop !== 'boolean') {
			throw new TypeError(`${name}.loop must be boolean.`);
		}

		const priority = candidate.priority ?? OPERATOR_REACTION_PRIORITY[name] ?? 1;
		if (!Number.isSafeInteger(priority) || priority < 0) {
			throw new TypeError(`${name}.priority must be a non-negative safe integer.`);
		}
		const reducedMotionFrame = candidate.reducedMotionFrame ?? (
			name === OPERATOR_SEQUENCE.IDLE ? 0 : frames.length - 1
		);
		if (
			!Number.isSafeInteger(reducedMotionFrame) ||
			reducedMotionFrame < 0 ||
			reducedMotionFrame >= frames.length
		) {
			throw new RangeError(`${name}.reducedMotionFrame is outside the sequence.`);
		}

		normalized[name] = Object.freeze({
			frames: Object.freeze(frames),
			fps: candidate.fps,
			loop: candidate.loop,
			priority,
			reducedMotionFrame,
		});
	}

	if (!normalized[OPERATOR_SEQUENCE.IDLE].loop) {
		throw new TypeError('The idle operator sequence must loop.');
	}
	return Object.freeze(normalized);
}

function defaultImageFactory() {
	if (typeof Image !== 'function') throw new Error('Image decoding is unavailable in this runtime.');
	return new Image();
}

/**
 * Retains only a small number of decoded HTMLImageElements. Eviction removes
 * the strong reference from this cache; the browser remains free to reclaim it.
 */
export class FrameDecodeCache {
	constructor({ maxEntries = DEFAULT_CACHE_LIMIT, imageFactory = defaultImageFactory } = {}) {
		assertPositiveInteger(maxEntries, 'maxEntries');
		if (typeof imageFactory !== 'function') throw new TypeError('imageFactory must be a function.');
		this.maxEntries = maxEntries;
		this.imageFactory = imageFactory;
		this.entries = new Map();
	}

	get size() {
		return this.entries.size;
	}

	has(source) {
		return this.entries.has(source);
	}

	decode(source) {
		if (typeof source !== 'string' || source.length === 0) {
			return Promise.reject(new TypeError('Frame source must be a non-empty string.'));
		}
		const cached = this.entries.get(source);
		if (cached) {
			this.entries.delete(source);
			this.entries.set(source, cached);
			return cached.promise;
		}

		let image;
		try {
			image = this.imageFactory();
		} catch (error) {
			return Promise.reject(error);
		}
		if (!isRecord(image) && typeof image !== 'object') {
			return Promise.reject(new TypeError('imageFactory must return an image-like object.'));
		}

		const promise = new Promise((resolve, reject) => {
			let settled = false;
			const finish = (handler, value) => {
				if (settled) return;
				settled = true;
				handler(value);
			};
			image.onload = () => finish(resolve, image);
			image.onerror = () => finish(reject, new Error(`Unable to decode operator frame: ${source}`));
			image.decoding = 'async';
			image.src = source;

			if (typeof image.decode === 'function') {
				Promise.resolve()
					.then(() => image.decode())
					.then(() => finish(resolve, image))
					.catch((error) => finish(reject, error));
			}
		});

		this.entries.set(source, { image, promise });
		while (this.entries.size > this.maxEntries) {
			this.entries.delete(this.entries.keys().next().value);
		}
		return promise;
	}

	clear() {
		this.entries.clear();
	}
}

function defaultNow() {
	return globalThis.performance?.now?.() ?? Date.now();
}

function defaultRequestFrame(callback) {
	if (typeof globalThis.requestAnimationFrame === 'function') {
		return globalThis.requestAnimationFrame(callback);
	}
	return setTimeout(() => callback(defaultNow()), 16);
}

function defaultCancelFrame(handle) {
	if (typeof globalThis.cancelAnimationFrame === 'function') {
		globalThis.cancelAnimationFrame(handle);
		return;
	}
	clearTimeout(handle);
}

function motionQueryFromGlobal() {
	return typeof globalThis.matchMedia === 'function'
		? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
		: null;
}

function documentIsHidden(documentRef) {
	return Boolean(documentRef?.hidden || documentRef?.visibilityState === 'hidden');
}

export class OperatorAnimationDirector {
	constructor({
		catalog,
		onChange = () => {},
		onError = () => {},
		decodeCache = null,
		maxDecodedFrames = DEFAULT_CACHE_LIMIT,
		decodeAhead = DEFAULT_DECODE_AHEAD,
		surfaceManagedDecoding = false,
		requestFrame = defaultRequestFrame,
		cancelFrame = defaultCancelFrame,
		now = defaultNow,
		documentRef = globalThis.document ?? null,
		motionQuery = motionQueryFromGlobal(),
		reducedMotion = null,
		reducedMotionHoldMs = DEFAULT_REDUCED_MOTION_HOLD_MS,
		dedupeLimit = DEFAULT_DEDUPE_LIMIT,
		imageFactory = defaultImageFactory,
		setTimer = globalThis.setTimeout?.bind(globalThis),
		clearTimer = globalThis.clearTimeout?.bind(globalThis),
	} = {}) {
		this.catalog = normalizeCatalog(catalog);
		if (typeof onChange !== 'function') throw new TypeError('onChange must be a function.');
		if (typeof onError !== 'function') throw new TypeError('onError must be a function.');
		if (typeof requestFrame !== 'function') throw new TypeError('requestFrame must be a function.');
		if (typeof cancelFrame !== 'function') throw new TypeError('cancelFrame must be a function.');
		if (typeof now !== 'function') throw new TypeError('now must be a function.');
		if (typeof setTimer !== 'function') throw new TypeError('setTimer must be a function.');
		if (typeof clearTimer !== 'function') throw new TypeError('clearTimer must be a function.');
		assertPositiveInteger(maxDecodedFrames, 'maxDecodedFrames');
		assertPositiveInteger(decodeAhead, 'decodeAhead');
		assertPositiveInteger(reducedMotionHoldMs, 'reducedMotionHoldMs');
		assertPositiveInteger(dedupeLimit, 'dedupeLimit');
		if (typeof surfaceManagedDecoding !== 'boolean') {
			throw new TypeError('surfaceManagedDecoding must be boolean.');
		}
		if (decodeCache !== null && typeof decodeCache.decode !== 'function') {
			throw new TypeError('decodeCache must expose decode(source).');
		}
		if (reducedMotion !== null && typeof reducedMotion !== 'boolean') {
			throw new TypeError('reducedMotion must be boolean or null.');
		}

		this.onChange = onChange;
		this.onError = onError;
		this.cache = decodeCache ?? new FrameDecodeCache({ maxEntries: maxDecodedFrames, imageFactory });
		this.decodeAhead = decodeAhead;
		this.surfaceManagedDecoding = surfaceManagedDecoding;
		this.requestFrame = requestFrame;
		this.cancelFrame = cancelFrame;
		this.now = now;
		this.documentRef = documentRef;
		this.motionQuery = motionQuery;
		this.reducedMotionOverride = reducedMotion;
		this.reducedMotion = reducedMotion ?? Boolean(motionQuery?.matches);
		this.reducedMotionHoldMs = reducedMotionHoldMs;
		this.setTimer = setTimer;
		this.clearTimer = clearTimer;
		this.dedupeLimit = dedupeLimit;
		this.dedupeKeys = new Set();
		this.dedupeQueue = [];
		this.triggerRequestId = 0;
		this.pendingTrigger = null;
		this.idleWaiters = new Set();
		this.failedSources = new Set();
		this.started = false;
		this.destroyed = false;
		this.documentHidden = documentIsHidden(documentRef);
		this.externallySuspended = false;
		this.paused = this.documentHidden;
		this.pauseStartedAt = null;
		this.frameHandle = null;
		this.lastFrameAt = null;
		this.reducedReturnAt = null;
		this.generation = 0;
		this.currentName = OPERATOR_SEQUENCE.IDLE;
		this.frameIndex = this.reducedMotion
			? this.catalog[OPERATOR_SEQUENCE.IDLE].reducedMotionFrame
			: 0;
		this.state = this.#createState('created');
		this.handleFrame = (timestamp) => this.#tick(timestamp);
		this.handleVisibilityChange = () => this.#syncVisibility();
		this.handleMotionChange = (event) => {
			if (this.reducedMotionOverride === null) this.setReducedMotion(Boolean(event.matches));
		};
	}

	get snapshot() {
		return this.state;
	}

	start() {
		this.#assertUsable();
		if (this.started) return this.state;
		this.started = true;
		this.documentRef?.addEventListener?.('visibilitychange', this.handleVisibilityChange);
		if (typeof this.motionQuery?.addEventListener === 'function') {
			this.motionQuery.addEventListener('change', this.handleMotionChange);
		} else {
			this.motionQuery?.addListener?.(this.handleMotionChange);
		}
		this.documentHidden = documentIsHidden(this.documentRef);
		this.paused = this.documentHidden || this.externallySuspended;
		this.pauseStartedAt = this.paused ? this.now() : null;
		this.#emit('started');
		this.#decodeWindow();
		this.#schedule();
		return this.state;
	}

	async trigger(name, { dedupeKey = null } = {}) {
		this.#assertUsable();
		const sequence = this.catalog[name];
		if (!sequence) {
			this.#reportError(new Error(`Unknown operator animation sequence: ${String(name)}`));
			this.#cancelPendingTrigger();
			this.#activateIdle('missing_sequence');
			return false;
		}
		if (dedupeKey !== null && this.dedupeKeys.has(dedupeKey)) return false;

		const current = this.catalog[this.currentName];
		if (
			this.currentName !== OPERATOR_SEQUENCE.IDLE &&
			sequence.priority < current.priority
		) {
			return false;
		}
		if (this.pendingTrigger && sequence.priority < this.pendingTrigger.priority) return false;

		const requestId = ++this.triggerRequestId;
		this.pendingTrigger = { requestId, name, priority: sequence.priority, dedupeKey };
		if (!this.surfaceManagedDecoding) {
			try {
				// Standalone consumers expose a new src only after its first frame decoded.
				// A mounted no-flicker surface can opt out and own this gate instead.
				await this.cache.decode(sequence.frames[0]);
			} catch (error) {
				this.#reportError(error);
				if (this.pendingTrigger?.requestId === requestId) {
					this.pendingTrigger = null;
					this.failedSources.add(sequence.frames[0]);
					this.#activateIdle('decode_fallback');
				}
				return false;
			}
		}
		if (this.destroyed || this.pendingTrigger?.requestId !== requestId) return false;
		this.pendingTrigger = null;
		const active = this.catalog[this.currentName];
		if (
			this.currentName !== OPERATOR_SEQUENCE.IDLE &&
			sequence.priority < active.priority
		) {
			return false;
		}
		if (dedupeKey !== null && this.dedupeKeys.has(dedupeKey)) return false;
		if (dedupeKey !== null) this.#rememberDedupeKey(dedupeKey);
		this.#activate(name, 'triggered');
		return true;
	}

	returnToIdle(reason = 'requested') {
		this.#assertUsable();
		this.#cancelPendingTrigger();
		this.#activateIdle(reason);
		return this.state;
	}

	setReducedMotion(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('Reduced motion state must be boolean.');
		if (enabled === this.reducedMotion) return this.state;
		this.reducedMotion = enabled;
		const sequence = this.catalog[this.currentName];
		this.generation += 1;
		this.lastFrameAt = null;
		if (enabled) {
			this.frameIndex = sequence.reducedMotionFrame;
			this.reducedReturnAt = this.currentName === OPERATOR_SEQUENCE.IDLE
				? null
				: this.now() + this.reducedMotionHoldMs;
		} else {
			this.reducedReturnAt = null;
		}
		this.#emit('motion_preference');
		this.#decodeWindow();
		this.#schedule();
		return this.state;
	}

	/**
	 * Pauses cosmetic playback without discarding the active sequence or frame.
	 * Visibility and caller suspension are independent pause sources: playback
	 * resumes only after both have cleared.
	 */
	setSuspended(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('Suspended state must be boolean.');
		if (enabled === this.externallySuspended) return this.state;
		this.externallySuspended = enabled;
		this.#syncPause(enabled ? 'suspended' : 'resumed');
		return this.state;
	}

	/** Predecode a small, caller-selected window without mounting extra images. */
	async preload(sequenceNames, { framesPerSequence = 2 } = {}) {
		this.#assertUsable();
		if (!Array.isArray(sequenceNames)) throw new TypeError('sequenceNames must be an array.');
		assertPositiveInteger(framesPerSequence, 'framesPerSequence');
		if (this.surfaceManagedDecoding) {
			return Object.freeze({ loaded: 0, failed: 0 });
		}
		const requests = [];
		for (const name of sequenceNames) {
			const sequence = this.catalog[name];
			if (!sequence) continue;
			for (const source of sequence.frames.slice(0, framesPerSequence)) {
				requests.push(this.cache.decode(source));
			}
		}
		const results = await Promise.allSettled(requests);
		return Object.freeze({
			loaded: results.filter((result) => result.status === 'fulfilled').length,
			failed: results.filter((result) => result.status === 'rejected').length,
		});
	}

	waitForIdle({ timeoutMs = 2_400 } = {}) {
		this.#assertUsable();
		assertPositiveInteger(timeoutMs, 'timeoutMs');
		if (this.currentName === OPERATOR_SEQUENCE.IDLE && this.pendingTrigger === null) {
			return Promise.resolve(true);
		}
		return new Promise((resolve) => {
			const waiter = { resolve, timer: null };
			waiter.timer = this.setTimer(() => {
				this.idleWaiters.delete(waiter);
				resolve(false);
			}, timeoutMs);
			this.idleWaiters.add(waiter);
		});
	}

	/** Call from the single rendered img's error handler as a final safety net. */
	reportFrameError(source) {
		if (this.destroyed || source !== this.state.frameSrc) return false;
		this.failedSources.add(source);
		this.#reportError(new Error(`Operator frame failed while visible: ${source}`));
		if (this.currentName === OPERATOR_SEQUENCE.IDLE) {
			this.#selectHealthyIdleFrame('idle_frame_error');
		} else {
			this.#activateIdle('frame_error');
		}
		return true;
	}

	destroy() {
		if (this.destroyed) return;
		this.#cancelScheduledFrame();
		this.#resolveIdleWaiters(false);
		this.documentRef?.removeEventListener?.('visibilitychange', this.handleVisibilityChange);
		if (typeof this.motionQuery?.removeEventListener === 'function') {
			this.motionQuery.removeEventListener('change', this.handleMotionChange);
		} else {
			this.motionQuery?.removeListener?.(this.handleMotionChange);
		}
		this.cache.clear?.();
		this.started = false;
		this.destroyed = true;
		this.#cancelPendingTrigger();
		this.generation += 1;
		this.state = Object.freeze({ ...this.state, playing: false, paused: true, reason: 'destroyed' });
		this.onChange = () => {};
		this.onError = () => {};
	}

	#assertUsable() {
		if (this.destroyed) throw new Error('OperatorAnimationDirector is destroyed.');
	}

	#rememberDedupeKey(key) {
		this.dedupeKeys.add(key);
		this.dedupeQueue.push(key);
		while (this.dedupeQueue.length > this.dedupeLimit) {
			this.dedupeKeys.delete(this.dedupeQueue.shift());
		}
	}

	#cancelPendingTrigger() {
		this.triggerRequestId += 1;
		this.pendingTrigger = null;
	}

	#resolveIdleWaiters(completed) {
		for (const waiter of this.idleWaiters) {
			this.clearTimer(waiter.timer);
			waiter.resolve(completed);
		}
		this.idleWaiters.clear();
	}

	#activate(name, reason) {
		this.generation += 1;
		this.currentName = name;
		const sequence = this.catalog[name];
		this.frameIndex = this.reducedMotion ? sequence.reducedMotionFrame : 0;
		this.lastFrameAt = null;
		this.reducedReturnAt = this.reducedMotion && name !== OPERATOR_SEQUENCE.IDLE
			? this.now() + this.reducedMotionHoldMs
			: null;
		this.#emit(reason);
		this.#decodeWindow();
		this.#schedule();
	}

	#activateIdle(reason) {
		this.#activate(OPERATOR_SEQUENCE.IDLE, reason);
	}

	#selectHealthyIdleFrame(reason) {
		const idle = this.catalog[OPERATOR_SEQUENCE.IDLE];
		const healthyIndex = idle.frames.findIndex((source) => !this.failedSources.has(source));
		this.generation += 1;
		this.currentName = OPERATOR_SEQUENCE.IDLE;
		this.frameIndex = healthyIndex;
		this.lastFrameAt = null;
		this.reducedReturnAt = null;
		this.#emit(healthyIndex === -1 ? 'idle_unavailable' : reason);
		if (healthyIndex !== -1) {
			this.#decodeWindow();
			this.#schedule();
		} else {
			this.#cancelScheduledFrame();
		}
	}

	#createState(reason) {
		const sequence = this.catalog[this.currentName];
		const frameSrc = this.frameIndex < 0 ? null : (sequence.frames[this.frameIndex] ?? null);
		return Object.freeze({
			sequence: this.currentName,
			frameIndex: this.frameIndex,
			frameSrc,
			priority: sequence.priority,
			loop: sequence.loop,
			playing: this.started && !this.paused,
			paused: this.paused,
			suspended: this.externallySuspended,
			reducedMotion: this.reducedMotion,
			generation: this.generation,
			reason,
		});
	}

	#emit(reason) {
		this.state = this.#createState(reason);
		this.onChange(this.state);
		if (this.currentName === OPERATOR_SEQUENCE.IDLE && this.pendingTrigger === null) {
			this.#resolveIdleWaiters(true);
		}
	}

	#schedule() {
		if (
			!this.started ||
			this.destroyed ||
			this.paused ||
			this.frameHandle !== null ||
			this.frameIndex < 0 ||
			(this.reducedMotion && this.currentName === OPERATOR_SEQUENCE.IDLE)
		) {
			return;
		}
		this.frameHandle = this.requestFrame(this.handleFrame);
	}

	#cancelScheduledFrame() {
		if (this.frameHandle === null) return;
		this.cancelFrame(this.frameHandle);
		this.frameHandle = null;
	}

	#tick(timestamp) {
		this.frameHandle = null;
		if (!this.started || this.destroyed || this.paused || this.frameIndex < 0) return;
		const currentTime = Number.isFinite(timestamp) ? timestamp : this.now();

		if (this.reducedMotion) {
			if (
				this.currentName !== OPERATOR_SEQUENCE.IDLE &&
				this.reducedReturnAt !== null &&
				currentTime >= this.reducedReturnAt
			) {
				this.#activateIdle('complete');
			}
			this.#schedule();
			return;
		}

		if (this.lastFrameAt === null) {
			this.lastFrameAt = currentTime;
			this.#schedule();
			return;
		}

		const sequence = this.catalog[this.currentName];
		const frameDuration = 1000 / sequence.fps;
		const elapsed = currentTime - this.lastFrameAt;
		const steps = Math.floor(elapsed / frameDuration);
		if (steps <= 0) {
			this.#schedule();
			return;
		}
		this.lastFrameAt += steps * frameDuration;
		const nextIndex = this.frameIndex + steps;
		if (!sequence.loop && nextIndex >= sequence.frames.length) {
			this.#activateIdle('complete');
			return;
		}
		this.frameIndex = sequence.loop ? nextIndex % sequence.frames.length : nextIndex;
		if (sequence.loop && this.failedSources.has(sequence.frames[this.frameIndex])) {
			const nextHealthyOffset = Array.from(
				{ length: sequence.frames.length },
				(_, offset) => (this.frameIndex + offset + 1) % sequence.frames.length,
			).find((index) => !this.failedSources.has(sequence.frames[index]));
			if (nextHealthyOffset === undefined) {
				this.#selectHealthyIdleFrame('idle_unavailable');
				return;
			}
			this.frameIndex = nextHealthyOffset;
		}
		this.#emit('frame');
		this.#decodeWindow();
		this.#schedule();
	}

	#decodeWindow() {
		if (
			this.surfaceManagedDecoding
			|| this.destroyed
			|| this.paused
			|| this.frameIndex < 0
		) return;
		const generation = this.generation;
		const name = this.currentName;
		const sequence = this.catalog[name];
		const sources = [];
		for (let offset = 0; offset < this.decodeAhead; offset += 1) {
			const candidateIndex = this.frameIndex + offset;
			if (!sequence.loop && candidateIndex >= sequence.frames.length) break;
			const source = sequence.frames[candidateIndex % sequence.frames.length];
			if (!this.failedSources.has(source)) sources.push(source);
		}
		for (const source of new Set(sources)) {
			this.cache.decode(source).catch((error) => {
				this.failedSources.add(source);
				this.#reportError(error);
				if (this.destroyed || generation !== this.generation || name !== this.currentName) return;
				if (name === OPERATOR_SEQUENCE.IDLE) {
					this.#selectHealthyIdleFrame('idle_decode_fallback');
				} else {
					this.#activateIdle('decode_fallback');
				}
			});
		}
	}

	#reportError(error) {
		try {
			this.onError(error instanceof Error ? error : new Error(String(error)));
		} catch {
			// Asset error reporting must never break authoritative game presentation.
		}
	}

	#syncVisibility() {
		if (this.destroyed) return;
		this.documentHidden = documentIsHidden(this.documentRef);
		this.#syncPause(this.documentHidden ? 'hidden' : 'visible');
	}

	#syncPause(reason) {
		const nextPaused = this.documentHidden || this.externallySuspended;
		if (!this.started) {
			this.paused = nextPaused;
			this.pauseStartedAt = null;
			this.#emit(reason);
			return;
		}
		if (nextPaused === this.paused) {
			this.#emit(reason);
			return;
		}
		const currentTime = this.now();
		this.paused = nextPaused;
		this.lastFrameAt = null;
		if (nextPaused) {
			this.pauseStartedAt = currentTime;
			this.#cancelScheduledFrame();
		} else {
			if (this.reducedReturnAt !== null && this.pauseStartedAt !== null) {
				this.reducedReturnAt += currentTime - this.pauseStartedAt;
			}
			this.pauseStartedAt = null;
		}
		this.#emit(reason);
		if (!nextPaused) this.#decodeWindow();
		this.#schedule();
	}
}
