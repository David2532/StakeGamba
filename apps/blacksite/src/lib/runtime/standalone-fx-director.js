import {
	OPERATOR_FX_CATALOG,
	OPERATOR_STATIC_KEYPOSES,
} from '../assets/operator-animation-assets.js';

const MAX_DECODED_FRAMES = 8;
const DEFAULT_DECODE_AHEAD = 2;
const DEFAULT_REDUCED_MOTION_HOLD_MS = 150;
const DEFAULT_DEDUPE_LIMIT = 64;

export const STANDALONE_FX_PRIORITY = Object.freeze({
	bonusCratePulse: 1,
	bonusCrateSpin: 1,
	winFlash: 2,
	coinBurst: 3,
	screenImpact: 4,
});

export const STANDALONE_FX_REDUCED_KEYPOSE = Object.freeze({
	bonusCratePulse: 'bonusCrate',
	bonusCrateSpin: 'bonusCrate',
	winFlash: 'win',
	coinBurst: 'win',
	screenImpact: 'rage',
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
	const match = String(source).match(/_(\d+)\.(?:png|webp)(?:[?#].*)?$/iu);
	return match ? Number(match[1]) : null;
}

function normalizeCatalog(catalog) {
	if (!isRecord(catalog) || Object.keys(catalog).length === 0) {
		throw new TypeError('Standalone FX catalog must be a non-empty object.');
	}
	const normalized = {};
	for (const [name, candidate] of Object.entries(catalog)) {
		if (!isRecord(candidate)) throw new TypeError(`${name} effect must be an object.`);
		if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) {
			throw new TypeError(`${name} effect must contain at least one frame.`);
		}
		const frames = candidate.frames.map((source, index) => {
			if (typeof source !== 'string' || source.length === 0) {
				throw new TypeError(`${name}.frames[${index}] must be a non-empty string.`);
			}
			return source;
		});
		if (new Set(frames).size !== frames.length) {
			throw new TypeError(`${name} effect contains duplicate frame paths.`);
		}
		const numericIndices = frames.map(numericFrameIndex);
		if (numericIndices.some((index) => index !== null)) {
			if (numericIndices.some((index) => index === null)) {
				throw new TypeError(`${name} effect mixes numbered and unnumbered raster frames.`);
			}
			numericIndices.forEach((frameIndex, position) => {
				if (frameIndex !== position) {
					throw new TypeError(`${name} effect frames must be contiguous and numerically ordered.`);
				}
			});
		}
		if (!Number.isFinite(candidate.fps) || candidate.fps <= 0 || candidate.fps > 60) {
			throw new TypeError(`${name}.fps must be greater than zero and no more than 60.`);
		}
		if (typeof candidate.loop !== 'boolean') throw new TypeError(`${name}.loop must be boolean.`);
		const priority = candidate.priority ?? STANDALONE_FX_PRIORITY[name] ?? 1;
		if (!Number.isSafeInteger(priority) || priority < 0) {
			throw new TypeError(`${name}.priority must be a non-negative safe integer.`);
		}
		normalized[name] = Object.freeze({
			id: candidate.id ?? name,
			frames: Object.freeze(frames),
			fps: candidate.fps,
			loop: candidate.loop,
			priority,
		});
	}
	return Object.freeze(normalized);
}

function normalizeKeyposes(keyposes) {
	if (!isRecord(keyposes)) throw new TypeError('Standalone FX keyposes must be an object.');
	const normalized = {};
	for (const [name, candidate] of Object.entries(keyposes)) {
		const source = typeof candidate === 'string' ? candidate : candidate?.frames?.[0];
		if (typeof source !== 'string' || source.length === 0) {
			throw new TypeError(`${name} keypose must expose one non-empty frame source.`);
		}
		normalized[name] = source;
	}
	return Object.freeze(normalized);
}

function defaultImageFactory() {
	if (typeof Image !== 'function') throw new Error('Image decoding is unavailable in this runtime.');
	return new Image();
}

/** LRU cache for decoded frames. Production use is hard-capped at eight images. */
export class StandaloneFxDecodeCache {
	constructor({ maxEntries = MAX_DECODED_FRAMES, imageFactory = defaultImageFactory } = {}) {
		assertPositiveInteger(maxEntries, 'maxEntries');
		if (maxEntries > MAX_DECODED_FRAMES) {
			throw new RangeError(`maxEntries cannot exceed ${MAX_DECODED_FRAMES}.`);
		}
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
			return Promise.reject(new TypeError('FX frame source must be a non-empty string.'));
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
		if (image === null || (typeof image !== 'object' && typeof image !== 'function')) {
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
			image.onerror = () => finish(reject, new Error(`Unable to decode FX frame: ${source}`));
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

function defaultMotionQuery() {
	return typeof globalThis.matchMedia === 'function'
		? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
		: null;
}

function hiddenDocument(documentRef) {
	return Boolean(documentRef?.hidden || documentRef?.visibilityState === 'hidden');
}

function inactiveSnapshot(generation = 0) {
	return Object.freeze({ active: false, name: null, frameIndex: -1, frameSrc: null, generation });
}

export class StandaloneFxDirector {
	constructor({
		catalog = OPERATOR_FX_CATALOG,
		keyposes = OPERATOR_STATIC_KEYPOSES,
		reducedMotionKeyposeMap = STANDALONE_FX_REDUCED_KEYPOSE,
		onChange = () => {},
		onError = () => {},
		decodeCache = null,
		maxDecodedFrames = MAX_DECODED_FRAMES,
		decodeAhead = DEFAULT_DECODE_AHEAD,
		surfaceManagedDecoding = false,
		requestFrame = defaultRequestFrame,
		cancelFrame = defaultCancelFrame,
		now = defaultNow,
		documentRef = globalThis.document ?? null,
		motionQuery = defaultMotionQuery(),
		reducedMotion = null,
		reducedMotionHoldMs = DEFAULT_REDUCED_MOTION_HOLD_MS,
		dedupeLimit = DEFAULT_DEDUPE_LIMIT,
		imageFactory = defaultImageFactory,
	} = {}) {
		this.catalog = normalizeCatalog(catalog);
		this.keyposes = normalizeKeyposes(keyposes);
		if (!isRecord(reducedMotionKeyposeMap)) {
			throw new TypeError('reducedMotionKeyposeMap must be an object.');
		}
		if (typeof onChange !== 'function') throw new TypeError('onChange must be a function.');
		if (typeof onError !== 'function') throw new TypeError('onError must be a function.');
		if (typeof requestFrame !== 'function') throw new TypeError('requestFrame must be a function.');
		if (typeof cancelFrame !== 'function') throw new TypeError('cancelFrame must be a function.');
		if (typeof now !== 'function') throw new TypeError('now must be a function.');
		assertPositiveInteger(maxDecodedFrames, 'maxDecodedFrames');
		if (maxDecodedFrames > MAX_DECODED_FRAMES) {
			throw new RangeError(`maxDecodedFrames cannot exceed ${MAX_DECODED_FRAMES}.`);
		}
		assertPositiveInteger(decodeAhead, 'decodeAhead');
		assertPositiveInteger(reducedMotionHoldMs, 'reducedMotionHoldMs');
		assertPositiveInteger(dedupeLimit, 'dedupeLimit');
		if (typeof surfaceManagedDecoding !== 'boolean') {
			throw new TypeError('surfaceManagedDecoding must be boolean.');
		}
		if (reducedMotion !== null && typeof reducedMotion !== 'boolean') {
			throw new TypeError('reducedMotion must be boolean or null.');
		}
		if (decodeCache !== null && typeof decodeCache.decode !== 'function') {
			throw new TypeError('decodeCache must expose decode(source).');
		}
		if (Number.isFinite(decodeCache?.maxEntries) && decodeCache.maxEntries > MAX_DECODED_FRAMES) {
			throw new RangeError(`decodeCache cannot retain more than ${MAX_DECODED_FRAMES} frames.`);
		}

		this.reducedMotionKeyposeMap = Object.freeze({ ...reducedMotionKeyposeMap });
		this.onChange = onChange;
		this.onError = onError;
		this.cache = decodeCache ?? new StandaloneFxDecodeCache({
			maxEntries: maxDecodedFrames,
			imageFactory,
		});
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
		this.dedupeLimit = dedupeLimit;
		this.dedupeKeys = new Set();
		this.dedupeQueue = [];
		this.generation = 0;
		this.state = inactiveSnapshot(this.generation);
		this.currentName = null;
		this.frameIndex = -1;
		this.frameHandle = null;
		this.lastFrameAt = null;
		this.pending = null;
		this.requestId = 0;
		this.waitingForDecode = false;
		this.failedSources = new Set();
		this.documentHidden = hiddenDocument(documentRef);
		this.externallySuspended = false;
		this.paused = this.documentHidden;
		this.destroyed = false;
		this.handleFrame = (timestamp) => this.#tick(timestamp);
		this.handleVisibilityChange = () => this.#syncVisibility();
		this.handleMotionChange = (event) => {
			if (this.reducedMotionOverride === null) this.setReducedMotion(Boolean(event.matches));
		};
		this.documentRef?.addEventListener?.('visibilitychange', this.handleVisibilityChange);
		if (typeof this.motionQuery?.addEventListener === 'function') {
			this.motionQuery.addEventListener('change', this.handleMotionChange);
		} else {
			this.motionQuery?.addListener?.(this.handleMotionChange);
		}
	}

	get snapshot() {
		return this.state;
	}

	async trigger(name, { dedupeKey = null } = {}) {
		this.#assertUsable();
		const effect = this.catalog[name];
		if (!effect) {
			this.#reportError(new Error(`Unknown standalone FX sequence: ${String(name)}`));
			this.stop();
			return false;
		}
		if (dedupeKey !== null && this.dedupeKeys.has(dedupeKey)) return false;
		const activePriority = this.currentName === null ? -1 : this.catalog[this.currentName].priority;
		if (effect.priority < activePriority) return false;
		if (this.pending && effect.priority < this.pending.priority) return false;

		const source = this.#initialSource(name);
		if (source === null) {
			this.#reportError(new Error(`No reduced-motion keypose is available for ${name}.`));
			this.stop();
			return false;
		}
		const requestId = ++this.requestId;
		this.pending = { requestId, name, priority: effect.priority, dedupeKey };
		if (!this.surfaceManagedDecoding) {
			try {
				await this.cache.decode(source);
			} catch (error) {
				this.failedSources.add(source);
				this.#reportError(error);
				if (this.pending?.requestId === requestId) {
					this.pending = null;
					this.stop();
				}
				return false;
			}
		}
		if (this.destroyed || this.pending?.requestId !== requestId) return false;
		this.pending = null;
		const latestPriority = this.currentName === null ? -1 : this.catalog[this.currentName].priority;
		if (effect.priority < latestPriority) return false;
		if (dedupeKey !== null && this.dedupeKeys.has(dedupeKey)) return false;
		if (dedupeKey !== null) this.#rememberDedupeKey(dedupeKey);
		this.#activate(name, source);
		return true;
	}

	stop() {
		if (this.destroyed) return this.state;
		this.requestId += 1;
		this.pending = null;
		this.generation += 1;
		this.waitingForDecode = false;
		this.currentName = null;
		this.frameIndex = -1;
		this.lastFrameAt = null;
		this.#cancelFrame();
		if (this.state.active) this.#emitInactive();
		else this.state = inactiveSnapshot(this.generation);
		return this.state;
	}

	async preload(effectNames = Object.keys(this.catalog), { framesPerEffect = 1 } = {}) {
		this.#assertUsable();
		if (!Array.isArray(effectNames)) throw new TypeError('effectNames must be an array.');
		assertPositiveInteger(framesPerEffect, 'framesPerEffect');
		if (this.surfaceManagedDecoding) {
			return Object.freeze({ loaded: 0, failed: 0 });
		}
		const sources = [];
		for (const name of effectNames) {
			const effect = this.catalog[name];
			if (!effect) continue;
			sources.push(...effect.frames.slice(0, framesPerEffect));
			const keyposeName = this.reducedMotionKeyposeMap[name];
			if (this.keyposes[keyposeName]) sources.push(this.keyposes[keyposeName]);
		}
		const results = await Promise.allSettled([...new Set(sources)].map((source) => this.cache.decode(source)));
		return Object.freeze({
			loaded: results.filter(({ status }) => status === 'fulfilled').length,
			failed: results.filter(({ status }) => status === 'rejected').length,
		});
	}

	reportFrameError(source = this.state.frameSrc) {
		if (this.destroyed || !this.state.active || source !== this.state.frameSrc) return false;
		this.failedSources.add(source);
		this.#reportError(new Error(`Standalone FX frame failed while visible: ${source}`));
		this.stop();
		return true;
	}

	setReducedMotion(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('Reduced motion state must be boolean.');
		if (enabled === this.reducedMotion) return this.state;
		this.reducedMotion = enabled;
		const restartName = this.currentName;
		this.stop();
		if (restartName !== null) void this.trigger(restartName);
		return this.state;
	}

	/** Freeze the active cosmetic frame until both visibility and caller pauses clear. */
	setSuspended(enabled) {
		this.#assertUsable();
		if (typeof enabled !== 'boolean') throw new TypeError('Suspended state must be boolean.');
		if (enabled === this.externallySuspended) return this.state;
		this.externallySuspended = enabled;
		this.#syncPause();
		return this.state;
	}

	destroy() {
		if (this.destroyed) return;
		this.stop();
		this.documentRef?.removeEventListener?.('visibilitychange', this.handleVisibilityChange);
		if (typeof this.motionQuery?.removeEventListener === 'function') {
			this.motionQuery.removeEventListener('change', this.handleMotionChange);
		} else {
			this.motionQuery?.removeListener?.(this.handleMotionChange);
		}
		this.cache.clear?.();
		this.destroyed = true;
		this.onChange = () => {};
		this.onError = () => {};
	}

	#assertUsable() {
		if (this.destroyed) throw new Error('StandaloneFxDirector is destroyed.');
	}

	#initialSource(name) {
		if (!this.reducedMotion) return this.catalog[name].frames[0];
		return this.keyposes[this.reducedMotionKeyposeMap[name]] ?? null;
	}

	#rememberDedupeKey(key) {
		this.dedupeKeys.add(key);
		this.dedupeQueue.push(key);
		while (this.dedupeQueue.length > this.dedupeLimit) {
			this.dedupeKeys.delete(this.dedupeQueue.shift());
		}
	}

	#activate(name, source) {
		this.generation += 1;
		this.currentName = name;
		this.frameIndex = 0;
		this.lastFrameAt = null;
		this.waitingForDecode = false;
		this.#cancelFrame();
		this.#emitActive(source);
		if (!this.reducedMotion && !this.paused) this.#predecodeAhead();
		this.#schedule();
	}

	#emitActive(source) {
		this.state = Object.freeze({
			active: true,
			name: this.currentName,
			frameIndex: this.frameIndex,
			frameSrc: source,
			generation: this.generation,
		});
		this.#notify();
	}

	#emitInactive() {
		this.state = inactiveSnapshot(this.generation);
		this.#notify();
	}

	#notify() {
		try {
			this.onChange(this.state);
		} catch (error) {
			this.#reportError(error);
		}
	}

	#schedule() {
		if (
			this.destroyed ||
			this.paused ||
			!this.state.active ||
			this.frameHandle !== null ||
			this.waitingForDecode ||
			(this.reducedMotion && this.catalog[this.currentName].loop)
		) return;
		this.frameHandle = this.requestFrame(this.handleFrame);
	}

	#cancelFrame() {
		if (this.frameHandle === null) return;
		this.cancelFrame(this.frameHandle);
		this.frameHandle = null;
	}

	#tick(timestamp) {
		this.frameHandle = null;
		if (this.destroyed || this.paused || !this.state.active) return;
		const currentTime = Number.isFinite(timestamp) ? timestamp : this.now();
		if (this.lastFrameAt === null) {
			this.lastFrameAt = currentTime;
			this.#schedule();
			return;
		}
		const effect = this.catalog[this.currentName];
		const frameDuration = this.reducedMotion
			? this.reducedMotionHoldMs
			: 1000 / effect.fps;
		const elapsed = currentTime - this.lastFrameAt;
		if (elapsed < frameDuration) {
			this.#schedule();
			return;
		}
		if (this.reducedMotion) {
			this.stop();
			return;
		}
		const steps = Math.max(1, Math.floor(elapsed / frameDuration));
		const candidateIndex = this.frameIndex + steps;
		if (!effect.loop && candidateIndex >= effect.frames.length) {
			this.stop();
			return;
		}
		const nextIndex = effect.loop ? candidateIndex % effect.frames.length : candidateIndex;
		this.lastFrameAt += steps * frameDuration;
		if (this.surfaceManagedDecoding) {
			this.frameIndex = nextIndex;
			this.#emitActive(effect.frames[nextIndex]);
			this.#schedule();
			return;
		}
		void this.#decodeAndDisplay(nextIndex);
	}

	async #decodeAndDisplay(nextIndex) {
		const generation = this.generation;
		const name = this.currentName;
		const source = this.catalog[name].frames[nextIndex];
		if (this.failedSources.has(source)) {
			this.stop();
			return;
		}
		this.waitingForDecode = true;
		try {
			await this.cache.decode(source);
		} catch (error) {
			this.failedSources.add(source);
			this.#reportError(error);
			if (!this.destroyed && generation === this.generation && name === this.currentName) this.stop();
			return;
		} finally {
			if (generation === this.generation) this.waitingForDecode = false;
		}
		if (this.destroyed || generation !== this.generation || name !== this.currentName) return;
		if (this.paused) {
			this.lastFrameAt = null;
			return;
		}
		this.frameIndex = nextIndex;
		this.#emitActive(source);
		this.#predecodeAhead();
		this.#schedule();
	}

	#predecodeAhead() {
		if (
			this.surfaceManagedDecoding
			|| this.destroyed
			|| this.paused
			|| !this.state.active
			|| this.currentName === null
		) return;
		const generation = this.generation;
		const name = this.currentName;
		const effect = this.catalog[name];
		const sources = [];
		for (let offset = 1; offset <= this.decodeAhead; offset += 1) {
			const index = this.frameIndex + offset;
			if (!effect.loop && index >= effect.frames.length) break;
			sources.push(effect.frames[index % effect.frames.length]);
		}
		for (const source of new Set(sources)) {
			this.cache.decode(source).catch((error) => {
				this.failedSources.add(source);
				this.#reportError(error);
				if (this.destroyed || generation !== this.generation || name !== this.currentName) return;
				if (source === this.state.frameSrc) this.stop();
			});
		}
	}

	#reportError(error) {
		try {
			this.onError(error instanceof Error ? error : new Error(String(error)));
		} catch {
			// Cosmetic FX failures must never escape into authoritative game flow.
		}
	}

	#syncVisibility() {
		if (this.destroyed) return;
		this.documentHidden = hiddenDocument(this.documentRef);
		this.#syncPause();
	}

	#syncPause() {
		const nextPaused = this.documentHidden || this.externallySuspended;
		if (nextPaused === this.paused) return;
		this.paused = nextPaused;
		this.lastFrameAt = null;
		if (nextPaused) {
			this.#cancelFrame();
			return;
		}
		if (!this.reducedMotion) this.#predecodeAhead();
		this.#schedule();
	}
}
