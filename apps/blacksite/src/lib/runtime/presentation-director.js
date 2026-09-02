const EMPTY_CELLS = Object.freeze([]);

export const PRESENTATION_TIMINGS = Object.freeze({
	normal: Object.freeze({
		step: 32,
		spin: 160,
		reveal: 360,
		anticipation: 600,
		feature: 1_000,
		hit: 280,
		remove: 150,
		drop: 250,
		settle: 90,
		recover: 1_000,
		maxWin: 1_000,
	}),
	turbo: Object.freeze({
		step: 12,
		spin: 110,
		reveal: 130,
		anticipation: 180,
		feature: 360,
		hit: 110,
		remove: 55,
		drop: 105,
		settle: 35,
		recover: 360,
		maxWin: 360,
	}),
	reduced: Object.freeze({
		step: 0,
		spin: 0,
		reveal: 0,
		anticipation: 0,
		feature: 0,
		hit: 0,
		remove: 0,
		drop: 0,
		settle: 0,
		recover: 0,
		maxWin: 0,
	}),
});

function freezeCells(cells = []) {
	return Object.freeze(cells.map((cell) => Object.freeze({ ...cell })));
}

function motionState(phase = 'idle', cells = EMPTY_CELLS, tumbleIndex = null) {
	return Object.freeze({ phase, cells, tumbleIndex });
}

function characterState(state = 'idle_a', sourceEventIndex = -1) {
	return Object.freeze({ state, sourceEventIndex });
}

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
		motion: motionState(),
		character: characterState(),
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
	/**
	 * @param {(state: any) => void} [onState]
	 * @param {(cue: any, state: any) => void} [onCue]
	 */
	constructor(onState = () => {}, onCue = () => {}) {
		if (typeof onState !== 'function')
			throw new TypeError('Presentation onState must be a function.');
		if (typeof onCue !== 'function') throw new TypeError('Presentation onCue must be a function.');
		this.onState = onState;
		this.onCue = onCue;
		this.state = createInitialPresentationState();
		this.playbackGeneration = 0;
		this.timers = new Map();
		this.pendingTumble = null;
		this.skipGeneration = null;
		this.defaultTimingProfile = 'reduced';
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
				this.pendingTumble = null;
				this.update({
					...createInitialPresentationState(),
					...common,
					status: 'presenting',
					mode: event.mode,
					phase: event.initial_phase,
					motion: motionState('spin'),
					character: characterState('spin_start', cue.eventIndex),
					notice: `${event.mode} round accepted`,
				});
				break;
			case 'board_snapshot': {
				const enteringCells = this.pendingTumble
					? freezeCells(this.pendingTumble.entering_symbols)
					: EMPTY_CELLS;
				const boardMotion = this.pendingTumble
					? motionState('drop', enteringCells, this.pendingTumble.tumble_index)
					: motionState('reveal');
				this.pendingTumble = null;
				this.update({
					...common,
					board: event.board,
					activeClusters: Object.freeze([]),
					stepWinRaw: 0,
					phase: event.phase,
					featureCycle: event.feature_cycle,
					motion: boardMotion,
					character: characterState('monitoring', cue.eventIndex),
					notice: `Authoritative board ${event.tumble_index}`,
				});
				break;
			}
			case 'win': {
				const winningCells = freezeCells(event.clusters.flatMap((cluster) => cluster.positions));
				this.update({
					...common,
					phase: event.phase,
					activeClusters: event.clusters,
					stepWinRaw: event.step_payout_raw,
					cumulativeWinRaw: event.cumulative_after_raw,
					motion: motionState('hit', winningCells),
					character: characterState('win_acknowledge', cue.eventIndex),
					notice: `${event.clusters.length} authoritative cluster cue(s)`,
				});
				break;
			}
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
				this.update({
					...common,
					motion: motionState('anticipation'),
					character: characterState('feature_tease', cue.eventIndex),
					notice: 'BLACKOUT armed after cascade chain',
				});
				break;
			case 'feature_started':
				this.update({
					...common,
					phase: 'feature',
					routeSnapshot: event.initial_route,
					featureCyclesAwarded: event.total_cycles,
					accessMultiplier: event.access_multiplier,
					motion: motionState('blackout-enter'),
					character: characterState('feature_trigger', cue.eventIndex),
					notice: event.direct ? 'Direct BLACKOUT entry' : 'Natural BLACKOUT entry',
				});
				break;
			case 'feature_cycle':
				this.update({
					...common,
					featureCycle: event.cycle,
					featureCyclesAwarded: event.total_cycles_awarded,
					accessMultiplier: event.access_multiplier,
					character: characterState('bonus_idle', cue.eventIndex),
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
				this.pendingTumble = event;
				this.update({
					...common,
					motion: motionState('remove', freezeCells(event.removed_positions), event.tumble_index),
					notice: `Tumble ${event.tumble_index}`,
				});
				break;
			case 'feature_ended':
				this.update({
					...common,
					cumulativeWinRaw: event.cumulative_payout_raw,
					motion: motionState('blackout-exit'),
					character: characterState('recover', cue.eventIndex),
					notice: 'BLACKOUT complete',
				});
				break;
			case 'cap_reached':
				this.update({
					...common,
					capped: true,
					cumulativeWinRaw: event.cumulative_payout_raw,
					character: characterState('max_win', cue.eventIndex),
					notice: 'Complete-round cap reached',
				});
				break;
			case 'settled':
				this.pendingTumble = null;
				this.update({
					...common,
					status: 'complete',
					phase: event.final_phase,
					finalWinRaw: event.payout_multiplier_raw,
					cumulativeWinRaw: event.payout_multiplier_raw,
					capped: event.capped,
					activeClusters: Object.freeze([]),
					stepWinRaw: 0,
					motion: motionState(),
					character: characterState('recover', cue.eventIndex),
					notice: 'Authoritative round_end reached',
				});
				break;
			default:
				throw new Error(`Unhandled presentation cue: ${String(cue.kind)}`);
		}
		this.onCue(cue, this.state);
		return this.state;
	}

	delay(milliseconds, generation) {
		return new Promise((resolve) => {
			if (this.skipGeneration === generation) {
				resolve(true);
				return;
			}
			const timer = setTimeout(() => {
				this.timers.delete(timer);
				resolve(generation === this.playbackGeneration);
			}, milliseconds);
			this.timers.set(timer, { generation, resolve });
		});
	}

	setTimingProfile(timingProfile) {
		if (!Object.hasOwn(PRESENTATION_TIMINGS, timingProfile)) {
			throw new TypeError('timingProfile must be normal, turbo, or reduced.');
		}
		this.defaultTimingProfile = timingProfile;
	}

	async play(
		cues,
		{
			stepDelayMs = null,
			winDelayMs = null,
			timingProfile = this.defaultTimingProfile,
			onCue = null,
		} = {},
	) {
		if (!Object.hasOwn(PRESENTATION_TIMINGS, timingProfile)) {
			throw new TypeError('timingProfile must be normal, turbo, or reduced.');
		}
		const timings = PRESENTATION_TIMINGS[timingProfile];
		stepDelayMs ??= timings.step;
		winDelayMs ??= timings.hit;
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
		this.skipGeneration = null;
		for (const cue of cues) {
			if (this.destroyed || generation !== this.playbackGeneration) return false;
			const priorCharacterState = this.state.character.state;
			this.consume(cue);
			if (onCue) await onCue(cue, this.state);
			if (this.destroyed || generation !== this.playbackGeneration) return false;
			let delayMs = cue.kind === 'win' ? winDelayMs : stepDelayMs;
			if (cue.kind === 'round_started') delayMs = timings.spin;
			if (cue.kind === 'feature_armed') delayMs = timings.anticipation;
			if (cue.kind === 'feature_started' || cue.kind === 'feature_ended') {
				delayMs = timings.feature;
			}
			if (cue.kind === 'cap_reached') delayMs = timings.maxWin;
			if (cue.kind === 'settled' && priorCharacterState !== 'recover') {
				delayMs = timings.recover;
			}
			if (cue.kind === 'tumble') delayMs = timings.remove;
			if (cue.kind === 'board_snapshot') {
				delayMs = this.state.motion.phase === 'drop' ? timings.drop : timings.reveal;
			}
			if (delayMs > 0 && !(await this.delay(delayMs, generation))) return false;
			if (cue.kind === 'board_snapshot' && this.state.motion.phase === 'drop') {
				this.update({
					motion: motionState('settle', this.state.motion.cells, this.state.motion.tumbleIndex),
				});
				if (timings.settle > 0 && !(await this.delay(timings.settle, generation))) return false;
				this.update({ motion: motionState() });
			}
			if (
				cue.kind === 'round_started' ||
				cue.kind === 'feature_armed' ||
				cue.kind === 'feature_started' ||
				cue.kind === 'feature_ended' ||
				(cue.kind === 'board_snapshot' && this.state.motion.phase === 'reveal')
			) {
				this.update({ motion: motionState() });
			}
		}
		this.skipGeneration = null;
		if (this.state.character.state !== 'idle_a') {
			this.update({ character: characterState('idle_a', this.state.lastEventIndex) });
		}
		return true;
	}

	skip() {
		if (this.destroyed || this.playbackGeneration === 0) return false;
		this.skipGeneration = this.playbackGeneration;
		for (const [timer, pending] of this.timers) {
			if (pending.generation !== this.playbackGeneration) continue;
			clearTimeout(timer);
			this.timers.delete(timer);
			pending.resolve(true);
		}
		return true;
	}

	reset() {
		this.playbackGeneration += 1;
		for (const [timer, pending] of this.timers) {
			clearTimeout(timer);
			pending.resolve(false);
		}
		this.timers.clear();
		this.pendingTumble = null;
		this.skipGeneration = null;
		this.state = createInitialPresentationState();
		this.onState(this.state);
	}

	destroy() {
		this.reset();
		this.destroyed = true;
		this.onState = () => {};
		this.onCue = () => {};
	}
}
