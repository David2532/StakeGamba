import { BOOT_INTRO_PROFILES, createInitialIntroState } from './intro-config.js';

const TERMINAL_STATES = new Set(['completed', 'skipped', 'bypassed', 'destroyed']);

export class IntroController {
	/**
	 * @param {{
	 *   onState?: (state: import('./intro-config.js').IntroState) => void,
	 *   setTimer?: (callback: () => void, delay: number) => any,
	 *   clearTimer?: (handle: any) => void
	 * }} [options]
	 */
	constructor({
		onState = () => {},
		setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
		clearTimer = (handle) => globalThis.clearTimeout(handle),
	} = {}) {
		if (typeof onState !== 'function') throw new TypeError('Intro onState must be a function.');
		if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
			throw new TypeError('Intro scheduler must expose setTimer and clearTimer functions.');
		}
		this.onState = onState;
		this.setTimer = setTimer;
		this.clearTimer = clearTimer;
		/** @type {import('./intro-config.js').IntroState} */
		this.state = createInitialIntroState();
		/** @type {Set<any>} */
		this.timers = new Set();
		this.generation = 0;
		/** @type {Promise<import('./intro-config.js').IntroState> | null} */
		this.activePromise = null;
		/** @type {((state: import('./intro-config.js').IntroState) => void) | null} */
		this.resolveActive = null;
		this.destroyed = false;
	}

	snapshot() {
		return this.state;
	}

	get activeTimerCount() {
		return this.timers.size;
	}

	/** @param {import('./intro-config.js').IntroState} nextState */
	emit(nextState) {
		this.state = Object.freeze(nextState);
		try {
			this.onState(this.state);
		} catch {
			// Presentation observers cannot strand the cinematic lifecycle.
		}
	}

	clearScheduledWork() {
		for (const handle of this.timers) this.clearTimer(handle);
		this.timers.clear();
	}

	/** @param {() => void} callback @param {number} delay @param {number} generation */
	schedule(callback, delay, generation) {
		/** @type {any} */
		let handle;
		handle = this.setTimer(() => {
			this.timers.delete(handle);
			if (this.destroyed || generation !== this.generation) return;
			callback();
		}, delay);
		this.timers.add(handle);
	}

	/** @param {'normal' | 'turbo'} [profileName] */
	playBoot(profileName = 'normal') {
		if (this.destroyed) return Promise.resolve(this.state);
		if (this.state.status === 'playing') return this.activePromise;
		const profile = BOOT_INTRO_PROFILES[profileName];
		if (!profile) throw new RangeError(`Unknown intro timing profile: ${profileName}`);

		this.clearScheduledWork();
		const generation = ++this.generation;
		this.activePromise = new Promise((resolve) => {
			this.resolveActive = resolve;
		});
		this.emit({
			status: 'playing',
			beat: profile.beats[0].id,
			profile: profileName,
			dismissReason: null,
		});

		try {
			for (const beat of profile.beats.slice(1)) {
				this.schedule(
					() =>
						this.emit({
							status: 'playing',
							beat: beat.id,
							profile: profileName,
							dismissReason: null,
						}),
					beat.atMs,
					generation,
				);
			}
			this.schedule(() => this.complete('natural'), profile.durationMs, generation);
			this.schedule(() => this.complete('watchdog-fallback'), profile.watchdogMs, generation);
		} catch {
			this.complete('scheduler-fallback');
		}
		return this.activePromise ?? Promise.resolve(this.state);
	}

	finish(status, dismissReason) {
		if (TERMINAL_STATES.has(this.state.status)) return Promise.resolve(this.state);
		this.generation += 1;
		this.clearScheduledWork();
		this.emit({
			status,
			beat: this.state.beat,
			profile: this.state.profile,
			dismissReason,
		});
		const resolve = this.resolveActive;
		this.resolveActive = null;
		this.activePromise = null;
		resolve?.(this.state);
		return Promise.resolve(this.state);
	}

	complete(reason = 'natural') {
		return this.finish('completed', reason);
	}

	skip(reason = 'player') {
		return this.finish('skipped', reason);
	}

	bypass(reason) {
		return this.finish('bypassed', reason);
	}

	reset() {
		if (this.destroyed) return this.state;
		if (this.state.status === 'playing') this.finish('bypassed', 'reset');
		this.generation += 1;
		this.clearScheduledWork();
		this.emit(createInitialIntroState());
		return this.state;
	}

	destroy() {
		if (this.destroyed) return Promise.resolve(this.state);
		this.generation += 1;
		this.clearScheduledWork();
		this.destroyed = true;
		this.emit({
			status: 'destroyed',
			beat: this.state.beat,
			profile: this.state.profile,
			dismissReason: 'teardown',
		});
		const resolve = this.resolveActive;
		this.resolveActive = null;
		this.activePromise = null;
		resolve?.(this.state);
		return Promise.resolve(this.state);
	}
}
