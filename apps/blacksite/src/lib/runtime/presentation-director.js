import { SYMBOL_DISPLAY_NAMES } from '../contracts/reels.js';

function symbolLabel(symbol) {
	return SYMBOL_DISPLAY_NAMES[symbol] ?? String(symbol).replaceAll('_', ' ').toUpperCase();
}

export function createInitialPresentationState() {
	return Object.freeze({
		status: 'idle',
		lastEventIndex: -1,
		mode: null,
		phase: 'base',
		board: null,
		evaluatedBoard: null,
		activeLines: Object.freeze([]),
		featureTarget: null,
		freeSpinIndex: 0,
		totalFreeSpins: 0,
		remainingFreeSpins: 0,
		stepWinRaw: 0,
		cumulativeWinRaw: 0,
		finalWinRaw: null,
		capped: false,
		notice: 'Choose a bet and press SPIN',
	});
}

export function planPresentationRestore(cues, nextEventIndex = 0) {
	if (!Array.isArray(cues)) throw new TypeError('Presentation cues must be an array.');
	if (!Number.isSafeInteger(nextEventIndex) || nextEventIndex < 0 || nextEventIndex > cues.length) {
		throw new RangeError('Restore cursor must identify the next presentation event.');
	}
	for (let index = 0; index < cues.length; index += 1) {
		if (cues[index]?.eventIndex !== index) {
			throw new Error('Presentation cues must retain contiguous authoritative event indices.');
		}
	}
	return Object.freeze({
		primeCues: Object.freeze(cues.slice(0, nextEventIndex)),
		resumeCues: Object.freeze(cues.slice(nextEventIndex)),
	});
}

export class PresentationDirector {
	constructor(onState = () => {}) {
		this.onState = onState;
		this.state = createInitialPresentationState();
		this.playbackGeneration = 0;
		this.timers = new Map();
		this.destroyed = false;
	}

	update(patch) {
		if (this.destroyed) return;
		this.state = Object.freeze({ ...this.state, ...patch });
		this.onState(this.state);
	}

	consume(cue) {
		if (this.destroyed) throw new Error('PresentationDirector is destroyed');
		const event = cue.event;
		const common = { lastEventIndex: cue.eventIndex };

		switch (cue.kind) {
			case 'round_started':
				this.update({
					...createInitialPresentationState(),
					...common,
					status: 'presenting',
					mode: event.mode,
					phase: event.initial_phase,
					notice: event.initial_phase === 'feature' ? 'BLACKOUT selected' : 'Reels spinning',
				});
				break;
			case 'board_snapshot':
				this.update({
					...common,
					phase: event.phase,
					board: event.board,
					evaluatedBoard: event.board,
					activeLines: Object.freeze([]),
					stepWinRaw: 0,
					notice: event.phase === 'feature'
						? `Free spin ${event.spin_index}: checking all 10 lines`
						: 'Checking all 10 lines',
				});
				break;
			case 'expansion':
				this.update({
					...common,
					evaluatedBoard: event.evaluated_board,
					featureTarget: event.target_symbol,
					notice: `${symbolLabel(event.target_symbol)} expanded on ${event.expanded_reels.length} reel(s)`,
				});
				break;
			case 'win':
				this.update({
					...common,
					phase: event.phase,
					activeLines: Object.freeze(event.wins),
					stepWinRaw: event.step_payout_raw,
					cumulativeWinRaw: event.cumulative_after_raw,
					notice: `${event.wins.length} winning line${event.wins.length === 1 ? '' : 's'}`,
				});
				break;
			case 'feature_armed':
				this.update({
					...common,
					notice: `${event.distinct_reels} VAULT reels award ${event.awarded_free_spins} free spins`,
				});
				break;
			case 'feature_started':
				this.update({
					...common,
					phase: 'feature',
					featureTarget: event.target_symbol,
					freeSpinIndex: 0,
					totalFreeSpins: event.total_free_spins,
					remainingFreeSpins: event.total_free_spins,
					activeLines: Object.freeze([]),
					stepWinRaw: 0,
					notice: `${event.total_free_spins} free spins awarded - expanding target ${symbolLabel(event.target_symbol)}`,
				});
				break;
			case 'feature_cycle':
				this.update({
					...common,
					phase: 'feature',
					freeSpinIndex: event.free_spin_index,
					totalFreeSpins: event.total_free_spins,
					remainingFreeSpins: event.remaining_after_current,
					activeLines: Object.freeze([]),
					stepWinRaw: 0,
					notice: `Free spin ${event.free_spin_index} of ${event.total_free_spins} - ${event.remaining_after_current} remaining`,
				});
				break;
			case 'feature_ended':
				this.update({
					...common,
					remainingFreeSpins: 0,
					cumulativeWinRaw: event.cumulative_payout_raw,
					notice: `${this.state.totalFreeSpins}/${this.state.totalFreeSpins} free spins complete`,
				});
				break;
			case 'cap_reached':
				this.update({
					...common,
					capped: true,
					cumulativeWinRaw: event.cumulative_payout_raw,
					notice: '10,000x maximum win reached',
				});
				break;
			case 'settled':
				this.update({
					...common,
					status: 'complete',
					phase: event.final_phase,
					finalWinRaw: event.payout_multiplier_raw,
					cumulativeWinRaw: event.payout_multiplier_raw,
					capped: event.capped,
					notice: event.payout_multiplier_raw === 0 ? 'No line win' : 'Round win confirmed',
				});
				break;
			default:
				throw new Error(`Unhandled presentation cue: ${String(cue.kind)}`);
		}
		return this.state;
	}

	delay(milliseconds, generation) {
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.timers.delete(timer);
				resolve(generation === this.playbackGeneration);
			}, milliseconds);
			this.timers.set(timer, resolve);
		});
	}

	async play(cues, { stepDelayMs = 0, winDelayMs = stepDelayMs, onCue = null } = {}) {
		if (!Number.isSafeInteger(stepDelayMs) || stepDelayMs < 0) {
			throw new TypeError('stepDelayMs must be a non-negative safe integer.');
		}
		if (!Number.isSafeInteger(winDelayMs) || winDelayMs < 0) {
			throw new TypeError('winDelayMs must be a non-negative safe integer.');
		}
		if (onCue !== null && typeof onCue !== 'function') {
			throw new TypeError('onCue must be a function when supplied.');
		}
		const generation = ++this.playbackGeneration;
		for (const cue of cues) {
			if (this.destroyed || generation !== this.playbackGeneration) return false;
			this.consume(cue);
			if (onCue) await onCue(cue, this.state);
			if (this.destroyed || generation !== this.playbackGeneration) return false;
			const delayMs = cue.kind === 'win' ? winDelayMs : stepDelayMs;
			if (delayMs > 0 && !(await this.delay(delayMs, generation))) return false;
		}
		return true;
	}

	reset() {
		this.playbackGeneration += 1;
		for (const [timer, resolve] of this.timers) {
			clearTimeout(timer);
			resolve(false);
		}
		this.timers.clear();
		this.state = createInitialPresentationState();
		this.onState(this.state);
	}

	destroy() {
		this.reset();
		this.destroyed = true;
		this.onState = () => {};
	}
}
