export function createInitialPresentationState() {
	return Object.freeze({
		status: 'idle',
		lastEventIndex: -1,
		mode: null,
		phase: 'base',
		board: null,
		activeClusters: Object.freeze([]),
		routeSnapshot: null,
		featureCycle: 0,
		featureCyclesAwarded: 0,
		accessMultiplier: 1,
		stepWinRaw: 0,
		cumulativeWinRaw: 0,
		finalWinRaw: null,
		capped: false,
		notice: 'Awaiting authoritative events',
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
					notice: `${event.mode} round accepted`,
				});
				break;
			case 'board_snapshot':
				this.update({
					...common,
					board: event.board,
					activeClusters: Object.freeze([]),
					stepWinRaw: 0,
					phase: event.phase,
					featureCycle: event.feature_cycle,
					notice: `Authoritative board ${event.tumble_index}`,
				});
				break;
			case 'win':
				this.update({
					...common,
					phase: event.phase,
					activeClusters: event.clusters,
					stepWinRaw: event.step_payout_raw,
					cumulativeWinRaw: event.cumulative_after_raw,
					notice: `${event.clusters.length} authoritative cluster cue(s)`,
				});
				break;
			case 'route_snapshot':
				this.update({
					...common,
					routeSnapshot: event,
					accessMultiplier: event.current_access_multiplier,
					cumulativeWinRaw: event.cumulative_payout_raw,
					notice: 'Authoritative Ghost Route snapshot',
				});
				break;
			case 'access_changed':
				this.update({
					...common,
					accessMultiplier: event.next_multiplier,
					notice: `Access ${event.previous_multiplier} -> ${event.next_multiplier}`,
				});
				break;
			case 'feature_armed':
				this.update({ ...common, notice: 'BLACKOUT armed after cascade chain' });
				break;
			case 'feature_started':
				this.update({
					...common,
					phase: 'feature',
					routeSnapshot: event.initial_route,
					featureCyclesAwarded: event.total_cycles,
					accessMultiplier: event.access_multiplier,
					notice: event.direct ? 'Direct BLACKOUT entry' : 'Natural BLACKOUT entry',
				});
				break;
			case 'feature_cycle':
				this.update({
					...common,
					featureCycle: event.cycle,
					featureCyclesAwarded: event.total_cycles_awarded,
					accessMultiplier: event.access_multiplier,
					notice: `Feature cycle ${event.cycle}`,
				});
				break;
			case 'exfil_reached':
				this.update({
					...common,
					featureCyclesAwarded: event.total_cycles_after,
					accessMultiplier: event.next_access_multiplier,
					notice: `EXFIL ${event.port_id} reached`,
				});
				break;
			case 'tumble':
				this.update({
					...common,
					activeClusters: Object.freeze([]),
					stepWinRaw: 0,
					notice: `Tumble ${event.tumble_index}`,
				});
				break;
			case 'feature_ended':
				this.update({
					...common,
					cumulativeWinRaw: event.cumulative_payout_raw,
					notice: 'BLACKOUT complete',
				});
				break;
			case 'cap_reached':
				this.update({
					...common,
					capped: true,
					cumulativeWinRaw: event.cumulative_payout_raw,
					notice: 'Complete-round cap reached',
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
					notice: 'Authoritative round_end reached',
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
