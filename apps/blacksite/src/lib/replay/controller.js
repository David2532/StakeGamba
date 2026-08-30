export class ReplayControllerError extends Error {
	constructor(code, message, { cause = null } = {}) {
		super(message, cause ? { cause } : undefined);
		this.name = 'ReplayControllerError';
		this.code = code;
	}
}

function errorState(error, fallbackCode) {
	return Object.freeze({
		code: typeof error?.code === 'string' ? error.code : fallbackCode,
		message: error?.message || 'Replay failed.',
	});
}

function initialState() {
	return Object.freeze({
		status: 'idle',
		error: null,
		replay: null,
		canPlay: false,
		canPlayAgain: false,
	});
}

export class ReplayController {
	/**
	 * @param {{client?: any, normalizer?: any, director?: any, onState?: (state: any) => void, stepDelayMs?: number, winDelayMs?: number}} [options]
	 */
	constructor({
		client,
		normalizer,
		director,
		onState = () => {},
		stepDelayMs = 16,
		winDelayMs = 220,
	} = {}) {
		if (!client || typeof client.fetchRound !== 'function') {
			throw new TypeError('ReplayController requires client.fetchRound.');
		}
		if (!normalizer || typeof normalizer.normalize !== 'function') {
			throw new TypeError('ReplayController requires normalizer.normalize.');
		}
		if (
			!director ||
			typeof director.reset !== 'function' ||
			typeof director.play !== 'function'
		) {
			throw new TypeError('ReplayController requires a resettable presentation director.');
		}
		if (typeof onState !== 'function') throw new TypeError('Replay onState must be a function.');
		if (!Number.isSafeInteger(stepDelayMs) || stepDelayMs < 0) {
			throw new TypeError('Replay stepDelayMs must be a non-negative safe integer.');
		}
		if (!Number.isSafeInteger(winDelayMs) || winDelayMs < 0) {
			throw new TypeError('Replay winDelayMs must be a non-negative safe integer.');
		}

		this.client = client;
		this.normalizer = normalizer;
		this.director = director;
		this.onState = onState;
		this.stepDelayMs = stepDelayMs;
		this.winDelayMs = winDelayMs;
		/** @type {Readonly<{status: string, error: any, replay: any, canPlay: boolean, canPlayAgain: boolean}>} */
		this.state = initialState();
		this.replay = null;
		this.loadAttempted = false;
		this.operation = null;
		this.generation = 0;
		this.destroyed = false;
	}

	transition(status, { error = null } = {}) {
		if (this.destroyed) return;
		this.state = Object.freeze({
			status,
			error,
			replay: this.replay,
			canPlay: status === 'ready',
			canPlayAgain: status === 'completed',
		});
		this.onState(this.state);
	}

	async load(launch) {
		if (this.destroyed) return false;
		if (this.loadAttempted) {
			throw new ReplayControllerError(
				'REPLAY_LOAD_ALREADY_ATTEMPTED',
				'ReplayController permits exactly one load request.',
			);
		}
		this.loadAttempted = true;
		const generation = ++this.generation;
		const operation = Symbol('replay-load');
		this.operation = operation;
		this.transition('loading');

		try {
			const payload = await this.client.fetchRound(launch);
			if (this.destroyed || generation !== this.generation) return false;
			this.replay = this.normalizer.normalize(payload, launch);
			this.transition('ready');
			return true;
		} catch (error) {
			if (this.destroyed || generation !== this.generation) return false;
			this.transition('error', { error: errorState(error, 'REPLAY_LOAD_FAILED') });
			return false;
		} finally {
			if (this.operation === operation) this.operation = null;
		}
	}

	async play() {
		if (
			this.destroyed ||
			this.operation ||
			!this.replay ||
			!['ready', 'completed'].includes(this.state.status)
		) {
			return false;
		}
		const generation = ++this.generation;
		const operation = Symbol('replay-play');
		this.operation = operation;
		this.transition('playing');

		try {
			this.director.reset();
			const completed = await this.director.play(this.replay.cues, {
				stepDelayMs: this.stepDelayMs,
				winDelayMs: this.winDelayMs,
			});
			if (this.destroyed || generation !== this.generation) return false;
			if (completed !== true) {
				throw new ReplayControllerError(
					'REPLAY_PLAYBACK_CANCELLED',
					'Replay presentation did not complete.',
				);
			}
			if (
				this.director.state?.status !== 'complete' ||
				this.director.state?.finalWinRaw !== this.replay.packagePayoutCentiX
			) {
				throw new ReplayControllerError(
					'REPLAY_PRESENTATION_MISMATCH',
					'Replay presentation does not match the authoritative final payout.',
				);
			}
			this.transition('completed');
			return true;
		} catch (error) {
			if (this.destroyed || generation !== this.generation) return false;
			this.transition('error', { error: errorState(error, 'REPLAY_PLAYBACK_FAILED') });
			return false;
		} finally {
			if (this.operation === operation) this.operation = null;
		}
	}

	playAgain() {
		if (this.state.status !== 'completed') return Promise.resolve(false);
		return this.play();
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.generation += 1;
		this.operation = null;
		if (typeof this.director.destroy === 'function') this.director.destroy();
		else this.director.reset();
		this.onState = () => {};
	}
}
