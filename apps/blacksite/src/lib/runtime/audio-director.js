export const AUDIO_STORAGE_KEY = 'blacksite.audio.volume.v1';

export const AUDIO_LEVELS = Object.freeze([0, 0.28, 0.62]);

const AMBIENCE_GAIN = 0.018;
const DUCKED_AMBIENCE_GAIN = 0.0045;
const MAX_VOICES = 8;

const REEL_STOP_OFFSETS = Object.freeze({
	normal: Object.freeze([0, 0.024, 0.048, 0.072, 0.096, 0.12, 0.144]),
	turbo: Object.freeze([0, 0.008, 0.016, 0.024, 0.032, 0.04, 0.048]),
});

const CUE_TONES = Object.freeze({
	round_started: Object.freeze({
		frequency: 82,
		target: 138,
		duration: 0.16,
		gain: 0.12,
		priority: 2,
		recipe: 'vault_motor',
	}),
	board_snapshot: Object.freeze({
		frequency: 176,
		target: 118,
		duration: 0.055,
		gain: 0.052,
		priority: 1,
		recipe: 'reel_stop_cadence',
	}),
	win: Object.freeze({
		frequency: 330,
		target: 660,
		duration: 0.24,
		gain: 0.1,
		priority: 2,
		recipe: 'vaultkeeper_acknowledge',
	}),
	route_snapshot: Object.freeze({
		frequency: 205,
		target: 310,
		duration: 0.11,
		gain: 0.065,
		priority: 1,
		recipe: 'breach_cell_activation',
	}),
	access_changed: Object.freeze({ frequency: 260, target: 390, duration: 0.18, gain: 0.08 }),
	feature_armed: Object.freeze({
		frequency: 110,
		target: 220,
		duration: 0.42,
		gain: 0.1,
		priority: 2,
		recipe: 'lock_anticipation',
	}),
	feature_started: Object.freeze({
		frequency: 64,
		target: 96,
		duration: 0.72,
		gain: 0.14,
		priority: 3,
		recipe: 'blackout_lock',
	}),
	feature_cycle: Object.freeze({ frequency: 150, target: 225, duration: 0.13, gain: 0.07 }),
	exfil_reached: Object.freeze({
		frequency: 420,
		target: 840,
		duration: 0.28,
		gain: 0.1,
		priority: 2,
		recipe: 'exfil_confirm',
	}),
	tumble: Object.freeze({ frequency: 140, target: 76, duration: 0.1, gain: 0.075 }),
	feature_ended: Object.freeze({
		frequency: 180,
		target: 90,
		duration: 0.45,
		gain: 0.11,
		priority: 2,
		recipe: 'blackout_release',
	}),
	cap_reached: Object.freeze({
		frequency: 520,
		target: 1040,
		duration: 0.55,
		gain: 0.12,
		priority: 3,
		recipe: 'vaultkeeper_max_win',
	}),
	settled: Object.freeze({ frequency: 220, target: 165, duration: 0.16, gain: 0.065 }),
	ui: Object.freeze({ frequency: 360, target: 300, duration: 0.055, gain: 0.04 }),
});

function clampVolume(value) {
	if (!Number.isFinite(value)) return AUDIO_LEVELS.at(-1);
	return Math.min(1, Math.max(0, value));
}

function readStoredVolume(storage) {
	try {
		const stored = storage?.getItem(AUDIO_STORAGE_KEY);
		if (stored === null || stored === undefined || stored === '') return AUDIO_LEVELS.at(-1);
		const value = Number(stored);
		return Number.isFinite(value) && value >= 0 && value <= 1 ? value : AUDIO_LEVELS.at(-1);
	} catch {
		return AUDIO_LEVELS.at(-1);
	}
}

function levelLabel(volume) {
	if (volume === 0) return 'MUTED';
	if (volume <= AUDIO_LEVELS[1]) return 'LOW';
	return 'FULL';
}

export function createInitialAudioState(storage = null) {
	const volume = readStoredVolume(storage);
	return Object.freeze({
		status: 'locked',
		unlocked: false,
		volume,
		level: levelLabel(volume),
		contextState: 'none',
		lastCue: null,
		cueCount: 0,
		activeVoices: 0,
		ambienceInstances: 0,
		lastRecipe: null,
		reelStopPulses: 0,
		priorityCues: 0,
		duckCount: 0,
	});
}

export class AudioDirector {
	constructor({
		audioContextFactory = null,
		storage = null,
		documentRef = null,
		onState = () => {},
		now = () => Date.now(),
	} = {}) {
		if (audioContextFactory !== null && typeof audioContextFactory !== 'function') {
			throw new TypeError('audioContextFactory must be a function when supplied.');
		}
		if (typeof onState !== 'function') throw new TypeError('Audio onState must be a function.');
		this.audioContextFactory = audioContextFactory;
		this.storage = storage;
		this.documentRef = documentRef;
		/** @type {(state: any) => void} */
		this.onState = onState;
		this.now = now;
		this.context = null;
		this.masterGain = null;
		this.ambienceGain = null;
		this.ambienceOscillator = null;
		this.voices = new Set();
		this.voiceGains = new Map();
		this.cooldowns = new Map();
		this.destroyed = false;
		this.visibilityTransition = Promise.resolve(false);
		/** @type {any} */
		this.state = createInitialAudioState(storage);
		this.handleContextStateChange = () => {
			if (this.destroyed || !this.context) return;
			if (this.context.state === 'closed') this.stopAudioSources();
			if (this.context.state === 'running' && this.state.unlocked && this.state.volume > 0) {
				this.ensureAmbience();
			}
			this.emit({ status: this.statusForContext() });
		};
		this.handleVisibilityChange = () => {
			const hidden = Boolean(this.documentRef?.hidden);
			return (this.visibilityTransition = this.visibilityTransition
				.catch(() => false)
				.then(() => {
					if (this.destroyed) return false;
					return hidden ? this.suspend() : this.resume();
				})
				.catch(() => {
					if (!this.destroyed) {
						this.emit({ status: this.statusForContext() });
					}
					return false;
				}));
		};
		this.documentRef?.addEventListener?.('visibilitychange', this.handleVisibilityChange);
	}

	statusForContext({ volume = this.state.volume, unlocked = this.state.unlocked } = {}) {
		if (!this.context) return this.state.status === 'unsupported' ? 'unsupported' : 'locked';
		if (this.context.state === 'closed') return 'closed';
		if (this.context.state !== 'running') return 'suspended';
		if (!unlocked) return 'locked';
		return volume === 0 ? 'muted' : 'running';
	}

	emit(patch = {}) {
		if (this.destroyed) return;
		this.state = Object.freeze({
			...this.state,
			...patch,
			contextState: this.context?.state ?? 'none',
			activeVoices: this.voices.size,
			ambienceInstances: this.ambienceOscillator ? 1 : 0,
		});
		this.onState(this.state);
	}

	async unlock() {
		if (this.destroyed) return false;
		if (!this.context) {
			if (!this.audioContextFactory) {
				this.emit({ status: 'unsupported' });
				return false;
			}
			try {
				const context = this.audioContextFactory();
				const masterGain = context.createGain();
				masterGain.gain.setValueAtTime(this.state.volume, context.currentTime);
				masterGain.connect(context.destination);
				this.context = context;
				this.masterGain = masterGain;
				this.context.addEventListener?.('statechange', this.handleContextStateChange);
			} catch {
				this.context = null;
				this.masterGain = null;
				this.emit({ status: 'unsupported' });
				return false;
			}
		}
		try {
			if (this.context.state === 'closed') {
				this.emit({ status: 'closed', unlocked: false });
				return false;
			}
			if (this.context.state !== 'running') await this.context.resume();
			if (this.context.state !== 'running') {
				this.emit({ status: this.statusForContext(), unlocked: false });
				return false;
			}
			if (this.state.volume > 0) this.ensureAmbience();
			this.emit({ status: this.state.volume === 0 ? 'muted' : 'running', unlocked: true });
			return true;
		} catch {
			this.emit({ status: this.statusForContext(), unlocked: false });
			return false;
		}
	}

	ensureAmbience(volume = this.state.volume) {
		if (
			!this.context ||
			this.context.state !== 'running' ||
			!this.masterGain ||
			volume === 0 ||
			this.ambienceOscillator
		) {
			return;
		}
		const oscillator = this.context.createOscillator();
		const gain = this.context.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(43, this.context.currentTime);
		gain.gain.setValueAtTime(AMBIENCE_GAIN, this.context.currentTime);
		oscillator.connect(gain);
		gain.connect(this.masterGain);
		oscillator.start();
		this.ambienceOscillator = oscillator;
		this.ambienceGain = gain;
	}

	stopVoice(voice) {
		const gain = this.voiceGains.get(voice);
		voice.onended = null;
		voice.stop();
		voice.disconnect?.();
		gain?.disconnect?.();
		this.voices.delete(voice);
		this.voiceGains.delete(voice);
	}

	stopAudioSources() {
		for (const voice of [...this.voices]) this.stopVoice(voice);
		this.ambienceOscillator?.stop();
		this.ambienceOscillator?.disconnect?.();
		this.ambienceGain?.disconnect?.();
		this.ambienceOscillator = null;
		this.ambienceGain = null;
		this.cooldowns.clear();
	}

	setVolume(value) {
		if (this.destroyed) return this.state;
		const volume = clampVolume(value);
		try {
			this.storage?.setItem(AUDIO_STORAGE_KEY, String(volume));
		} catch {
			// Audio remains usable when storage is unavailable.
		}
		if (this.masterGain && this.context) {
			this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
		}
		if (volume === 0) this.stopAudioSources();
		else if (this.state.unlocked && this.context?.state === 'running') this.ensureAmbience(volume);
		this.emit({
			volume,
			level: levelLabel(volume),
			status: this.statusForContext({ volume }),
		});
		return this.state;
	}

	cycleVolume() {
		const currentIndex = AUDIO_LEVELS.findIndex((level) => level === this.state.volume);
		const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % AUDIO_LEVELS.length;
		return this.setVolume(AUDIO_LEVELS[nextIndex]);
	}

	consume(cue, { timingProfile = 'normal' } = {}) {
		if (!cue || !Object.hasOwn(CUE_TONES, cue.kind)) return false;
		if (
			cue.kind === 'route_snapshot' &&
			(!Array.isArray(cue.event?.newly_breached_cells) ||
				cue.event.newly_breached_cells.length === 0)
		) {
			return false;
		}
		return this.playTone(cue.kind, { timingProfile });
	}

	playUi() {
		return this.playTone('ui', { timingProfile: 'normal' });
	}

	playTone(kind, { timingProfile = 'normal' } = {}) {
		if (
			this.destroyed ||
			!this.state.unlocked ||
			this.state.volume === 0 ||
			this.documentRef?.hidden ||
			!this.context ||
			this.context.state !== 'running' ||
			!this.masterGain
		) {
			return false;
		}
		const tone = CUE_TONES[kind];
		if (!tone) return false;
		const cooldownMs = timingProfile === 'turbo' ? 70 : 24;
		const nowMs = this.now();
		if (nowMs - (this.cooldowns.get(kind) ?? -Infinity) < cooldownMs) return false;
		this.cooldowns.set(kind, nowMs);

		const startedAt = this.context.currentTime;
		const duration =
			timingProfile === 'turbo' ? Math.max(0.045, tone.duration * 0.58) : tone.duration;
		const offsets =
			kind === 'board_snapshot'
				? REEL_STOP_OFFSETS[timingProfile === 'turbo' ? 'turbo' : 'normal']
				: [0];
		for (const [pulseIndex, offset] of offsets.entries()) {
			while (this.voices.size >= MAX_VOICES) {
				const oldest = this.voices.values().next().value;
				this.stopVoice(oldest);
			}
			const oscillator = this.context.createOscillator();
			const gain = this.context.createGain();
			const pulseStartedAt = startedAt + offset;
			const frequencyScale = kind === 'board_snapshot' ? 1 + pulseIndex * 0.035 : 1;
			oscillator.type = kind.includes('feature') ? 'sawtooth' : 'triangle';
			oscillator.frequency.setValueAtTime(tone.frequency * frequencyScale, pulseStartedAt);
			oscillator.frequency.exponentialRampToValueAtTime(
				tone.target * frequencyScale,
				pulseStartedAt + duration,
			);
			gain.gain.setValueAtTime(0.0001, pulseStartedAt);
			gain.gain.exponentialRampToValueAtTime(
				tone.gain,
				pulseStartedAt + Math.min(0.02, duration / 3),
			);
			gain.gain.exponentialRampToValueAtTime(0.0001, pulseStartedAt + duration);
			oscillator.connect(gain);
			gain.connect(this.masterGain);
			oscillator.onended = () => {
				this.voices.delete(oscillator);
				this.voiceGains.delete(oscillator);
				oscillator.disconnect?.();
				gain.disconnect?.();
				this.emit();
			};
			this.voices.add(oscillator);
			this.voiceGains.set(oscillator, gain);
			oscillator.start(pulseStartedAt);
			oscillator.stop(pulseStartedAt + duration + 0.01);
		}
		const priority = tone.priority ?? 0;
		if (priority >= 2 && this.ambienceGain) {
			const ambience = this.ambienceGain.gain;
			ambience.cancelScheduledValues?.(startedAt);
			ambience.setValueAtTime(Math.max(0.0001, ambience.value || AMBIENCE_GAIN), startedAt);
			ambience.exponentialRampToValueAtTime(DUCKED_AMBIENCE_GAIN, startedAt + 0.025);
			ambience.exponentialRampToValueAtTime(AMBIENCE_GAIN, startedAt + duration + 0.12);
		}
		this.emit({
			lastCue: kind,
			lastRecipe: tone.recipe ?? kind,
			cueCount: this.state.cueCount + 1,
			reelStopPulses: this.state.reelStopPulses + (kind === 'board_snapshot' ? offsets.length : 0),
			priorityCues: this.state.priorityCues + (priority >= 2 ? 1 : 0),
			duckCount: this.state.duckCount + (priority >= 2 ? 1 : 0),
		});
		return true;
	}

	async suspend() {
		if (this.destroyed || !this.context || this.context.state !== 'running') return false;
		try {
			await this.context.suspend();
			this.emit({ status: this.statusForContext() });
			return this.context.state === 'suspended';
		} catch {
			this.emit({ status: this.statusForContext() });
			return false;
		}
	}

	async resume() {
		if (
			this.destroyed ||
			!this.state.unlocked ||
			this.documentRef?.hidden ||
			!this.context ||
			this.context.state === 'closed'
		) {
			return false;
		}
		try {
			if (this.context.state !== 'running') await this.context.resume();
			if (this.context.state !== 'running') {
				this.emit({ status: this.statusForContext() });
				return false;
			}
			if (this.state.volume > 0) this.ensureAmbience();
			this.emit({ status: this.statusForContext() });
			return true;
		} catch {
			this.emit({ status: this.statusForContext() });
			return false;
		}
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.documentRef?.removeEventListener?.('visibilitychange', this.handleVisibilityChange);
		this.context?.removeEventListener?.('statechange', this.handleContextStateChange);
		this.stopAudioSources();
		void this.context?.close?.();
		this.onState = () => {};
	}
}
