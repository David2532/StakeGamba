import {
	BLACKSITE_AUDIO_V28_BANKS,
	BLACKSITE_AUDIO_V28_BUSES,
	BLACKSITE_AUDIO_V28_CATALOG,
	BLACKSITE_AUDIO_V28_CUES,
	blacksiteAudioV28Asset,
} from '../assets/blacksite-audio-v28.js';

const STORAGE_KEY = 'blacksite_breach:audio-muted:v1';
const LEGACY_ASSET_ROOT = 'assets/blacksite/audio/v19';
const MASTER_LEVEL = 0.76;
const MAX_CONSUMED_KEYS = 2_048;
const MUTE_RAMP_SECONDS = 0.02;
const LOOP_FADE_SECONDS = 0.12;

const LEGACY_ALIASES = Object.freeze({
	'ui-confirm': 'ui.confirm',
	'ui-open': 'ui.modal.open',
	'ui-select': 'ui.press',
	'spin-start': 'spin.confirmed',
	'vault-tease': 'anticipation.confirmed',
	'vault-notice': 'vault.hold',
	'vault-lock': 'vault.lock.1',
	'vault-approach': 'vault.focus',
	'vault-device-attach': 'vault.focus',
	'vault-hack-start': 'vault.focus',
	'vault-hack-loop': 'vault.wheel',
	'vault-hack-success': 'vault.bolts',
	'vault-bolts': 'vault.bolts',
	'vault-door': 'vault.door',
	'vault-access': 'vault.gold',
	'blackout-entry': 'blackout.enter',
	'free-spins-awarded': 'vault.handoff',
	'bonus-ready': 'blackout.enter',
	'direct-entry': 'blackout.direct.prep',
	extraction: 'feature.summary.open',
	'return-base': 'feature.summary.close',
	win: 'win.small',
	loss: 'round.loss',
});

const LEGACY_SEQUENCES = Object.freeze({
	'reel-stop': Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({ cueId: `reel.stop.${index + 1}`, delayMs: index * 82, ordinal: index + 1 }))),
	'reel-stop-turbo': Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({ cueId: `reel.stop.${index + 1}`, delayMs: index * 35, ordinal: index + 1 }))),
	'vault-locks-release': Object.freeze(Array.from({ length: 6 }, (_, index) => Object.freeze({ cueId: `vault.lock.${index + 1}`, delayMs: index * 130, ordinal: index + 1 }))),
	'vault-wheel-turn': Object.freeze([{ cueId: 'vault.wheel', delayMs: 0, ordinal: 0 }]),
	'vault-door-open': Object.freeze([
		{ cueId: 'vault.door', delayMs: 0, ordinal: 0 },
		{ cueId: 'vault.door.impact', delayMs: 1_050, ordinal: 1 },
	]),
	'vault-light-entry': Object.freeze([
		{ cueId: 'vault.gold', delayMs: 0, ordinal: 0 },
		{ cueId: 'vault.camera', delayMs: 260, ordinal: 1 },
	]),
});

const SCENE_LOOPS = Object.freeze({
	silent: Object.freeze([]),
	// Base idle stays quiet. BLACKOUT deliberately owns only the long-form
	// freespin techno bed; short machine samples remain event-driven or retired.
	base: Object.freeze([]),
	blackout: Object.freeze(['music.blackout']),
});

// Keep retired/background loops managed so a scene transition also clears an
// old voice/intent that may still exist during restore or hot reload. The short
// BLACKOUT music, the win rollup and one bounded last-reel anticipation are the
// only loops still started deliberately by live presentation.
const SCENE_MANAGED_LOOPS = Object.freeze([
	'music.blackout',
	'reels.motor.loop',
	'anticipation.confirmed',
	'ambience.tension',
]);

const DUCKING = Object.freeze({
	vault: Object.freeze({ Music: -8, Ambience: -4 }),
	win: Object.freeze({ Music: -6, Ambience: -3 }),
	voice: Object.freeze({ Music: -5, Ambience: -5, Reels: -3 }),
});

function dbToGain(db) {
	return 10 ** (db / 20);
}

function readMuted(storage) {
	try {
		return storage?.getItem(STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

function absorbPromise(result) {
	if (result && typeof result.then === 'function') void result.catch(() => {});
}

function stableHash(value) {
	let hash = 2_166_136_261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return hash >>> 0;
}

function identityFrom(options = {}) {
	return options.roundOrReplayId ?? options.roundId ?? options.replayId ?? options.fixtureId ?? null;
}

export function blacksiteAudioEventKey({ roundOrReplayId, roundId, replayId, fixtureId, eventIndex = 0, cueId, ordinal = 0 } = {}) {
	const identity = roundOrReplayId ?? roundId ?? replayId ?? fixtureId;
	if (identity == null || !cueId) return null;
	return `${String(identity)}|${Number(eventIndex) || 0}|${cueId}|${Number(ordinal) || 0}`;
}

export function deterministicAudioVariant(cueId, variantCount, options = {}) {
	const count = Math.max(1, Number(variantCount) || 1);
	const identity = identityFrom(options) ?? 'cosmetic-local';
	const eventIndex = Number(options.eventIndex) || 0;
	const ordinal = Number(options.ordinal) || 0;
	return stableHash(`${String(identity)}|${eventIndex}|${cueId}|${ordinal}`) % count;
}

export function blacksiteAudioAsset(path) {
	const relativePath = `${LEGACY_ASSET_ROOT}/${path}`;
	if (typeof window === 'undefined') return relativePath;
	const packageBase = new URL(window.location.href);
	packageBase.search = '';
	packageBase.hash = '';
	if (!packageBase.pathname.endsWith('/')) {
		const lastSegment = packageBase.pathname.split('/').at(-1) ?? '';
		packageBase.pathname = /\.html?$/iu.test(lastSegment) ? packageBase.pathname.slice(0, -lastSegment.length) : `${packageBase.pathname}/`;
	}
	return new URL(relativePath, packageBase).href;
}

// Retained until the global production asset registry is migrated. RuntimePack
// playback uses BLACKSITE_AUDIO_CATALOG and never reads these V19 derivatives.
export const BLACKSITE_AUDIO_ASSETS = Object.freeze({
	baseAmbience: blacksiteAudioAsset('base-ambience.mp3'),
	featureAward: blacksiteAudioAsset('free-spins-award.mp3'),
	vaultAnticipation: blacksiteAudioAsset('vault-anticipation.mp3'),
});

export const BLACKSITE_AUDIO_BUSES = BLACKSITE_AUDIO_V28_BUSES;
export const BLACKSITE_AUDIO_CATALOG = BLACKSITE_AUDIO_V28_CATALOG;
export const BLACKSITE_AUDIO_LEGACY_ALIASES = LEGACY_ALIASES;
export const BLACKSITE_AUDIO_CUES = Object.freeze([
	...BLACKSITE_AUDIO_V28_CUES,
	...Object.keys(LEGACY_ALIASES),
	...Object.keys(LEGACY_SEQUENCES),
]);

export class BlacksiteAudioDirector {
	constructor({
		storage = globalThis.localStorage,
		AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
		AudioClass: _legacyAudioClass = globalThis.Audio,
		fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
		assetLoader = null,
		documentRef = globalThis.document,
		autoPreload = true,
	} = {}) {
		this.storage = storage;
		this.AudioContextClass = AudioContextClass;
		this.fetchFn = fetchFn;
		this.assetLoader = assetLoader;
		this.documentRef = documentRef;
		this.context = null;
		this.master = null;
		this.limiter = null;
		this.busNodes = new Map();
		this.buffers = new Map();
		this.loads = new Map();
		this.loadFailures = new Map();
		this.abortControllers = new Set();
		this.activeVoices = new Map(Object.keys(BLACKSITE_AUDIO_V28_BUSES).map((bus) => [bus, []]));
		this.activeNodes = new Set();
		this.desiredLoops = new Map();
		this.consumedKeys = new Set();
		this.consumedOrder = [];
		this.localOrdinals = new Map();
		this.duckers = new Set();
		this.muted = readMuted(storage);
		this.destroyed = false;
		this.visibilitySuspended = documentRef?.visibilityState === 'hidden';
		this.unlocked = false;
		this.scene = 'silent';
		this.generation = 0;
		this.visibilityListener = () => this.#handleVisibility();
		this.documentRef?.addEventListener?.('visibilitychange', this.visibilityListener);
		if (autoPreload) queueMicrotask(() => {
			if (!this.destroyed) absorbPromise(this.preloadCritical());
		});
	}

	snapshot() {
		return Object.freeze({
			muted: this.muted,
			available: typeof this.AudioContextClass === 'function',
			unlocked: this.unlocked,
			visible: !this.visibilitySuspended,
			scene: this.scene,
			decoded: this.buffers.size,
			pending: this.loads.size,
			failures: this.loadFailures.size,
			voices: Object.freeze(Object.fromEntries([...this.activeVoices].map(([bus, voices]) => [bus, voices.length]))),
		});
	}

	#ensureContext() {
		if (this.destroyed || typeof this.AudioContextClass !== 'function') return null;
		try {
			if (!this.context) {
				this.context = new this.AudioContextClass();
				this.master = this.context.createGain();
				this.master.gain.value = MASTER_LEVEL;
				if (typeof this.context.createDynamicsCompressor === 'function') {
					this.limiter = this.context.createDynamicsCompressor();
					this.limiter.threshold.value = -1;
					this.limiter.knee.value = 0;
					this.limiter.ratio.value = 20;
					this.limiter.attack.value = 0.003;
					this.limiter.release.value = 0.12;
					this.master.connect(this.limiter);
					this.limiter.connect(this.context.destination);
				} else {
					this.master.connect(this.context.destination);
				}
				for (const [bus, spec] of Object.entries(BLACKSITE_AUDIO_V28_BUSES)) {
					const busNode = this.context.createGain();
					busNode.gain.value = this.muted ? 0.0001 : dbToGain(spec.gainDb);
					busNode.connect(this.master);
					this.busNodes.set(bus, busNode);
				}
			}
			return this.context;
		} catch {
			try { absorbPromise(this.context?.close?.()); } catch { /* cosmetic graph only */ }
			this.context = null;
			this.master = null;
			this.limiter = null;
			this.busNodes.clear();
			return null;
		}
	}

	async unlock() {
		const context = this.#ensureContext();
		if (!context || this.destroyed || this.visibilitySuspended) return false;
		try {
			if (context.state === 'suspended') await context.resume?.();
			if (context.state === 'closed') return false;
			this.unlocked = true;
			return true;
		} catch {
			return false;
		}
	}

	async #loadFile(path) {
		if (this.buffers.has(path)) return this.buffers.get(path);
		if (this.loads.has(path)) return this.loads.get(path);
		const context = this.#ensureContext();
		if (!context) throw new Error('WebAudio unavailable');
		const generation = this.generation;
		const task = (async () => {
			let buffer;
			if (typeof this.assetLoader === 'function') {
				buffer = await this.assetLoader(path, context);
			} else {
				if (typeof this.fetchFn !== 'function' || typeof context.decodeAudioData !== 'function') throw new Error('local audio loader unavailable');
				const controller = typeof AbortController === 'function' ? new AbortController() : null;
				if (controller) this.abortControllers.add(controller);
				try {
					const response = await this.fetchFn(blacksiteAudioV28Asset(path), controller ? { signal: controller.signal } : undefined);
					if (!response?.ok) throw new Error(`audio asset response ${response?.status ?? 'failed'}`);
					const bytes = await response.arrayBuffer();
					buffer = await context.decodeAudioData(bytes.slice(0));
				} finally {
					if (controller) this.abortControllers.delete(controller);
				}
			}
			if (this.destroyed || generation !== this.generation) throw new Error('audio director disposed');
			if (!buffer) throw new Error('audio decode produced no buffer');
			this.buffers.set(path, buffer);
			this.loadFailures.delete(path);
			return buffer;
		})().catch((error) => {
			this.loadFailures.set(path, error instanceof Error ? error.message : String(error));
			throw error;
		}).finally(() => this.loads.delete(path));
		this.loads.set(path, task);
		return task;
	}

	async preloadCues(cueIds) {
		const files = [...new Set(cueIds.flatMap((cueId) => BLACKSITE_AUDIO_V28_CATALOG[cueId]?.files ?? []))];
		const results = await Promise.allSettled(files.map((path) => this.#loadFile(path)));
		const failed = results.filter((result) => result.status === 'rejected').length;
		return Object.freeze({ requested: files.length, loaded: files.length - failed, failed });
	}

	preloadBank(bank) { return this.preloadCues(BLACKSITE_AUDIO_V28_BANKS[bank] ?? []); }
	preloadCritical() { return this.preloadBank('critical'); }
	preloadVault() {
		return Promise.all([
			this.preloadBank('vault'),
			this.preloadBank('blackout'),
			this.preloadBank('extended'),
		]);
	}

	#rememberConsumed(key) {
		if (!key || this.consumedKeys.has(key)) return;
		this.consumedKeys.add(key);
		this.consumedOrder.push(key);
		while (this.consumedOrder.length > MAX_CONSUMED_KEYS) {
			const stale = this.consumedOrder.shift();
			this.consumedKeys.delete(stale);
		}
	}

	primeConsumed(events) {
		for (const event of Array.isArray(events) ? events : [events]) {
			this.#rememberConsumed(typeof event === 'string' ? event : blacksiteAudioEventKey(event));
		}
		return this.consumedKeys.size;
	}

	#localOrdinal(cueId) {
		const next = (this.localOrdinals.get(cueId) ?? 0) + 1;
		this.localOrdinals.set(cueId, next);
		return next;
	}

	play(cue, options = {}) {
		if (this.destroyed) return false;
		const sequence = LEGACY_SEQUENCES[cue];
		if (sequence) {
			return sequence.reduce((accepted, item) => this.#playSemantic(item.cueId, {
				...options,
				delayMs: (Number(options.delayMs) || 0) + item.delayMs,
				ordinal: options.ordinal == null ? item.ordinal : Number(options.ordinal) + item.ordinal,
			}) || accepted, false);
		}
		return this.#playSemantic(LEGACY_ALIASES[cue] ?? cue, options);
	}

	#playSemantic(cueId, options) {
		const entry = BLACKSITE_AUDIO_V28_CATALOG[cueId];
		if (!entry) return false;
		const identity = identityFrom(options);
		const ordinal = options.ordinal == null ? this.#localOrdinal(cueId) : Number(options.ordinal) || 0;
		const eventOptions = { ...options, ordinal };
		const eventKey = blacksiteAudioEventKey({ ...eventOptions, cueId });
		const shouldDedupe = options.dedupe ?? identity != null;
		if (shouldDedupe && eventKey && this.consumedKeys.has(eventKey)) return false;
		if (shouldDedupe && eventKey) this.#rememberConsumed(eventKey);
		const variant = deterministicAudioVariant(cueId, entry.files.length, eventOptions);
		const path = entry.files[variant];
		if (entry.loop) this.desiredLoops.set(cueId, Object.freeze({ ...eventOptions, cueId, path }));
		// Muting suppresses audible starts, but scene loops still need to remain
		// desired so one correct loop set can resume after unmute. One-shots are
		// consumed while muted and never leak out later.
		if (this.muted) return entry.loop;
		if (this.visibilitySuspended) return entry.loop;
		const generation = this.generation;
		const task = Promise.all([this.#loadFile(path), this.unlock()]).then(([buffer, unlocked]) => {
			if (!unlocked || this.destroyed || this.muted || this.visibilitySuspended || generation !== this.generation) return false;
			if (entry.loop && !this.desiredLoops.has(cueId)) return false;
			return this.#startBuffer(entry, path, buffer, eventOptions);
		}).catch(() => false);
		absorbPromise(task);
		return true;
	}

	#startBuffer(entry, path, buffer, options) {
		const context = this.context;
		const busNode = this.busNodes.get(entry.bus);
		if (!context || !busNode || typeof context.createBufferSource !== 'function') return false;
		const voices = this.activeVoices.get(entry.bus);
		if (entry.loop && voices.some((voice) => voice.cueId === entry.cueId && voice.loop)) return true;
		const limit = BLACKSITE_AUDIO_V28_BUSES[entry.bus].maxVoices;
		if (voices.length >= limit) {
			const candidates = voices.filter((voice) => !voice.protected || entry.protected)
				.sort((left, right) => left.priority - right.priority || left.startedAt - right.startedAt);
			const victim = candidates[0];
			if (!victim || (!entry.protected && entry.priority < victim.priority)) return false;
			this.#stopVoice(victim, MUTE_RAMP_SECONDS);
		}
		let source;
		try {
			source = context.createBufferSource();
			const voiceGain = context.createGain();
			voiceGain.gain.value = 1;
			source.buffer = buffer;
			source.loop = entry.loop;
			if (typeof context.createStereoPanner === 'function') {
				const panner = context.createStereoPanner();
				panner.pan.value = Math.max(-1, Math.min(1, Number(options.pan ?? entry.pan) || 0));
				source.connect(panner);
				panner.connect(voiceGain);
			} else {
				source.connect(voiceGain);
			}
			voiceGain.connect(busNode);
			const voice = {
				bus: entry.bus, cueId: entry.cueId, path, source, gain: voiceGain,
				priority: Number(options.priority ?? entry.priority), protected: options.protected ?? entry.protected,
				loop: entry.loop, duck: entry.duck, startedAt: context.currentTime, stopped: false,
			};
			voices.push(voice);
			this.activeNodes.add(source);
			if (voice.duck) { this.duckers.add(voice); this.#updateBusGains(voice.duck === 'voice' ? .05 : .06); }
			const ended = () => this.#releaseVoice(voice);
			if (typeof source.addEventListener === 'function') source.addEventListener('ended', ended, { once: true });
			else source.onended = ended;
			source.start(context.currentTime + Math.max(0, Number(options.delayMs) || 0) / 1_000);
			return true;
		} catch {
			try { source?.stop?.(); } catch { /* partial source is inert */ }
			this.activeNodes.delete(source);
			return false;
		}
	}

	#releaseVoice(voice) {
		if (voice.stopped) return;
		voice.stopped = true;
		const voices = this.activeVoices.get(voice.bus);
		const index = voices.indexOf(voice);
		if (index >= 0) voices.splice(index, 1);
		this.activeNodes.delete(voice.source);
		if (this.duckers.delete(voice)) this.#updateBusGains(.28);
	}

	#stopVoice(voice, fadeSeconds = MUTE_RAMP_SECONDS) {
		if (!voice || voice.stopped) return;
		const now = this.context?.currentTime ?? 0;
		try {
			voice.gain.gain.cancelScheduledValues?.(now);
			voice.gain.gain.setValueAtTime?.(Math.max(.0001, voice.gain.gain.value || 1), now);
			voice.gain.gain.linearRampToValueAtTime?.(.0001, now + fadeSeconds);
			voice.source.stop(now + fadeSeconds + .005);
		} catch {
			try { voice.source.stop(); } catch { /* already ended */ }
		}
		this.#releaseVoice(voice);
	}

	#busDuckDb(bus) {
		let duckDb = 0;
		for (const voice of this.duckers) duckDb = Math.min(duckDb, DUCKING[voice.duck]?.[bus] ?? 0);
		return duckDb;
	}

	#updateBusGains(rampSeconds = MUTE_RAMP_SECONDS) {
		const now = this.context?.currentTime ?? 0;
		for (const [bus, node] of this.busNodes) {
			const target = this.muted ? .0001 : dbToGain(BLACKSITE_AUDIO_V28_BUSES[bus].gainDb + this.#busDuckDb(bus));
			try {
				node.gain.cancelScheduledValues?.(now);
				node.gain.setValueAtTime?.(Math.max(.0001, node.gain.value || target), now);
				node.gain.linearRampToValueAtTime?.(Math.max(.0001, target), now + rampSeconds);
				node.gain.value = target;
			} catch { node.gain.value = target; }
		}
	}

	stop(cue, { preserveIntent = false, fadeSeconds = LOOP_FADE_SECONDS } = {}) {
		const cueId = LEGACY_ALIASES[cue] ?? cue;
		if (!preserveIntent) this.desiredLoops.delete(cueId);
		let stopped = false;
		for (const voices of this.activeVoices.values()) {
			for (const voice of [...voices]) {
				if (voice.cueId !== cueId) continue;
				this.#stopVoice(voice, fadeSeconds);
				stopped = true;
			}
		}
		return stopped;
	}

	setScene(scene) {
		const requestedLoops = SCENE_LOOPS[scene];
		if (!requestedLoops) return false;
		this.scene = scene;
		for (const cueId of [...this.desiredLoops.keys()]) {
			if (SCENE_MANAGED_LOOPS.includes(cueId) && !requestedLoops.includes(cueId)) this.stop(cueId);
		}
		for (const cueId of requestedLoops) this.play(cueId, { dedupe: false });
		return true;
	}

	#restoreLoops() {
		if (this.muted || this.destroyed || this.visibilitySuspended) return;
		for (const [cueId, options] of this.desiredLoops) {
			const active = this.activeVoices.get(BLACKSITE_AUDIO_V28_CATALOG[cueId].bus).some((voice) => voice.cueId === cueId && voice.loop);
			if (!active) this.#playSemantic(cueId, { ...options, dedupe: false });
		}
	}

	muteWithCue(cue = 'ui.toggle.off') {
		if (this.destroyed || this.muted) return this.snapshot();
		const cueId = LEGACY_ALIASES[cue] ?? cue;
		const entry = BLACKSITE_AUDIO_V28_CATALOG[cueId];
		if (entry && !entry.loop && !this.visibilitySuspended) {
			const ordinal = this.#localOrdinal(cueId);
			const path = entry.files[deterministicAudioVariant(cueId, entry.files.length, { ordinal })];
			const buffer = this.buffers.get(path);
			// The critical bank is predecoded. If browser activation has not unlocked
			// WebAudio yet, mute immediately and omit the cosmetic latch rather than
			// delaying or weakening the global 20 ms mute guarantee.
			if (buffer && this.unlocked) this.#startBuffer(entry, path, buffer, { ordinal });
		}
		return this.setMuted(true);
	}

	setMuted(muted) {
		this.muted = Boolean(muted);
		try { this.storage?.setItem(STORAGE_KEY, this.muted ? '1' : '0'); } catch { /* storage is cosmetic */ }
		this.#updateBusGains(MUTE_RAMP_SECONDS);
		if (this.muted) {
			for (const voices of this.activeVoices.values()) for (const voice of [...voices]) this.#stopVoice(voice, MUTE_RAMP_SECONDS);
		} else {
			this.#restoreLoops();
		}
		return this.snapshot();
	}

	toggleMuted() { return this.setMuted(!this.muted); }

	#handleVisibility() {
		const hidden = this.documentRef?.visibilityState === 'hidden';
		if (hidden === this.visibilitySuspended || this.destroyed) return;
		this.visibilitySuspended = hidden;
		if (hidden) {
			for (const voices of this.activeVoices.values()) for (const voice of [...voices]) this.#stopVoice(voice, voice.loop ? LOOP_FADE_SECONDS : MUTE_RAMP_SECONDS);
			absorbPromise(this.context?.suspend?.());
			return;
		}
		if (this.unlocked) {
			const resume = this.context?.resume?.();
			if (resume && typeof resume.then === 'function') void resume.then(() => this.#restoreLoops()).catch(() => {});
			else this.#restoreLoops();
		}
	}

	resetPresentation({ preserveConsumed = true } = {}) {
		this.generation += 1;
		for (const voices of this.activeVoices.values()) for (const voice of [...voices]) this.#stopVoice(voice, MUTE_RAMP_SECONDS);
		this.desiredLoops.clear();
		this.duckers.clear();
		this.localOrdinals.clear();
		this.scene = 'silent';
		if (!preserveConsumed) { this.consumedKeys.clear(); this.consumedOrder.length = 0; }
		return this.snapshot();
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.generation += 1;
		this.documentRef?.removeEventListener?.('visibilitychange', this.visibilityListener);
		for (const controller of this.abortControllers) controller.abort();
		this.abortControllers.clear();
		for (const voices of this.activeVoices.values()) for (const voice of [...voices]) this.#stopVoice(voice, 0);
		this.activeNodes.clear();
		this.desiredLoops.clear();
		this.loads.clear();
		this.buffers.clear();
		this.duckers.clear();
		try { absorbPromise(this.context?.close?.()); } catch { /* browser teardown */ }
		this.context = null;
		this.master = null;
		this.limiter = null;
		this.busNodes.clear();
	}
}

export { STORAGE_KEY as BLACKSITE_AUDIO_STORAGE_KEY };
