export const VAULT_STATE = Object.freeze({
	IDLE: 'idle',
	TRIGGER_LOCK: 'trigger-lock',
	WHEEL: 'wheel-turn',
	LOCKS: 'locks-release',
	DOOR: 'door-opening',
	LIGHT: 'light-entry',
	AWARD: 'free-spins-awarded',
	BONUS: 'bonus-entry',
	EXTRACTION: 'extraction-report',
});

export const VAULT_AWARDED_SPINS = 8;

export const DEFAULT_VAULT_TIMINGS = Object.freeze({
	triggerLock: 520,
	wheel: 1_100,
	locks: 680,
	door: 1_100,
	light: 720,
	award: 1_500,
	bonus: 520,
	skipDoor: 120,
	skipLight: 180,
	skipAward: 900,
	skipBonus: 120,
});

export const NORMAL_V26_VAULT_TIMINGS = Object.freeze({
	...DEFAULT_VAULT_TIMINGS,
	triggerLock: 637,
	wheel: 1_347,
	locks: 833,
	door: 1_347,
	light: 878,
});

export const MAX_VAULT_CINEMATIC_MS = 7_500;

const STAGE_BLUEPRINT = Object.freeze([
	Object.freeze({ state: VAULT_STATE.TRIGGER_LOCK, timing: 'triggerLock', cue: 'vault-notice' }),
	Object.freeze({ state: VAULT_STATE.WHEEL, timing: 'wheel', cue: 'vault-wheel-turn' }),
	Object.freeze({ state: VAULT_STATE.LOCKS, timing: 'locks', cue: 'vault-locks-release' }),
	Object.freeze({ state: VAULT_STATE.DOOR, timing: 'door', cue: 'vault-door-open' }),
	Object.freeze({ state: VAULT_STATE.LIGHT, timing: 'light', cue: 'vault-light-entry' }),
	Object.freeze({ state: VAULT_STATE.AWARD, timing: 'award', cue: 'free-spins-awarded' }),
	Object.freeze({ state: VAULT_STATE.BONUS, timing: 'bonus', cue: 'bonus-ready' }),
]);

function boundedDuration(value, fallback) {
	const duration = Number(value);
	if (!Number.isFinite(duration)) return fallback;
	return Math.max(1, Math.min(3_000, Math.round(duration)));
}

function normalizedTimings(overrides = {}, defaults = DEFAULT_VAULT_TIMINGS) {
	return Object.freeze(Object.fromEntries(
		Object.entries(defaults).map(([key, fallback]) => [
			key,
			boundedDuration(overrides?.[key], fallback),
		]),
	));
}

function timingDefaultsForOptions({ direct, turbo, reducedMotion }) {
	return !direct && !turbo && !reducedMotion
		? NORMAL_V26_VAULT_TIMINGS
		: DEFAULT_VAULT_TIMINGS;
}

function awardHoldFloor(timings, { turbo, reducedMotion }) {
	const semanticFloor = turbo || reducedMotion ? 900 : 1_500;
	// Explicit short timings keep deterministic unit tests and diagnostic previews fast.
	return Math.min(timings.award, semanticFloor);
}

function buildStages(timings, { direct, turbo, reducedMotion }) {
	let scale = direct ? 0.78 : 1;
	if (turbo) scale *= 0.38;
	if (reducedMotion) scale *= 0.16;
	const protectedAwardHold = awardHoldFloor(timings, { turbo, reducedMotion });

	const scaled = STAGE_BLUEPRINT.map((stage) => ({
		...stage,
		durationMs: stage.state === VAULT_STATE.AWARD
			? Math.max(protectedAwardHold, Math.round(timings[stage.timing] * scale))
			: Math.max(1, Math.round(timings[stage.timing] * scale)),
	}));
	const totalDuration = scaled.reduce((total, stage) => total + stage.durationMs, 0);
	if (totalDuration <= MAX_VAULT_CINEMATIC_MS) {
		return Object.freeze(scaled.map((stage) => Object.freeze(stage)));
	}

	const awardDuration = scaled.find((stage) => stage.state === VAULT_STATE.AWARD)?.durationMs ?? 0;
	const otherDuration = totalDuration - awardDuration;
	const otherBudget = Math.max(scaled.length - 1, MAX_VAULT_CINEMATIC_MS - awardDuration);
	const boundScale = otherDuration > 0 ? Math.min(1, otherBudget / otherDuration) : 1;
	return Object.freeze(scaled.map((stage) => Object.freeze({
		...stage,
		durationMs: stage.state === VAULT_STATE.AWARD
			? stage.durationMs
			: Math.max(1, Math.floor(stage.durationMs * boundScale)),
	})));
}

export function createVaultCinematicTimeline({
	direct = false,
	turbo = false,
	reducedMotion = false,
	timings = {},
} = {}) {
	const options = { direct, turbo, reducedMotion };
	return buildStages(
		normalizedTimings(timings, timingDefaultsForOptions(options)),
		options,
	);
}

function validAwardedSpins(value) {
	return value === VAULT_AWARDED_SPINS ? VAULT_AWARDED_SPINS : null;
}

function validPositiveRaw(value) {
	return Number.isSafeInteger(value) && value > 0;
}

function resolveAwardedSpins(...candidates) {
	for (const candidate of candidates) {
		const valid = validAwardedSpins(candidate);
		if (valid !== null) return valid;
	}
	return VAULT_AWARDED_SPINS;
}

function initialState(generation = 0) {
	return Object.freeze({
		active: false,
		state: VAULT_STATE.IDLE,
		phase: 'idle',
		stageIndex: -1,
		stageCount: STAGE_BLUEPRINT.length,
		progress: 0,
		skippable: false,
		direct: false,
		turbo: false,
		reducedMotion: false,
		targetSymbol: null,
		triggerCount: 0,
		awardedSpins: VAULT_AWARDED_SPINS,
		reportKind: null,
		reportScope: null,
		completedSpins: null,
		capRaw: null,
		winRaw: 0,
		capped: false,
		generation,
	});
}

function absorbCallback(result) {
	if (result && typeof result.then === 'function') void result.catch(() => {});
}

export class VaultCinematicDirector {
	constructor({ onChange = () => {}, onAudioCue = () => {}, timings = {} } = {}) {
		if (typeof onChange !== 'function' || typeof onAudioCue !== 'function') {
			throw new TypeError('Vault cinematic callbacks must be functions.');
		}
		this.onChange = onChange;
		this.onAudioCue = onAudioCue;
		this.timingOverrides = Object.freeze({ ...(timings ?? {}) });
		this.timings = normalizedTimings(timings);
		this.state = initialState();
		this.timer = null;
		this.flow = null;
		this.destroyed = false;
	}

	#notify() {
		if (this.destroyed) return;
		try {
			absorbCallback(this.onChange(this.state));
		} catch {
			// Presentation observers are isolated from sequence completion.
		}
	}

	#publish(patch) {
		if (this.destroyed) return;
		this.state = Object.freeze({ ...this.state, ...patch });
		this.#notify();
	}

	#audio(cue) {
		try {
			absorbCallback(this.onAudioCue(cue, this.state));
		} catch {
			// Audio is cosmetic and can never stall or invalidate presentation.
		}
	}

	#clearTimer() {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
	}

	#finish(generation, completed) {
		if (this.flow?.generation !== generation) return false;
		this.#clearTimer();
		const { resolve } = this.flow;
		this.flow = null;
		resolve(completed);
		return true;
	}

	#schedule(generation, durationMs, callback) {
		this.#clearTimer();
		this.timer = setTimeout(() => {
			this.timer = null;
			if (this.destroyed || generation !== this.state.generation) {
				this.#finish(generation, false);
				return;
			}
			callback();
		}, durationMs);
	}

	arm({ triggerCount = 3, targetSymbol = null, awardedSpins } = {}) {
		if (this.destroyed || this.state.active) return false;
		this.#publish({
			state: VAULT_STATE.TRIGGER_LOCK,
			phase: 'triggerLock',
			triggerCount,
			targetSymbol,
			awardedSpins: resolveAwardedSpins(awardedSpins),
			skippable: false,
		});
		this.#audio('vault-tease');
		return true;
	}

	play({ direct = false, targetSymbol = null, awardedSpins, turbo = false, reducedMotion = false } = {}) {
		if (this.destroyed) return Promise.resolve(false);
		const armedTriggerCount = this.state.triggerCount;
		const armedTargetSymbol = this.state.targetSymbol;
		const armedAwardedSpins = this.state.awardedSpins;
		this.cancel('superseded');
		const generation = this.state.generation + 1;
		const resolvedTarget = targetSymbol ?? armedTargetSymbol;
		const resolvedAwardedSpins = resolveAwardedSpins(awardedSpins, armedAwardedSpins);
		const options = { direct, turbo, reducedMotion };
		const stages = buildStages(
			normalizedTimings(this.timingOverrides, timingDefaultsForOptions(options)),
			options,
		);

		return new Promise((resolve) => {
			this.flow = { generation, resolve };
			this.state = Object.freeze({
				...initialState(generation),
				direct,
				turbo,
				reducedMotion,
				targetSymbol: resolvedTarget,
				triggerCount: armedTriggerCount,
				awardedSpins: resolvedAwardedSpins,
			});

			const advance = (stageIndex) => {
				if (this.destroyed || generation !== this.state.generation) {
					this.#finish(generation, false);
					return;
				}
				if (stageIndex >= stages.length) {
					this.#publish({
						active: false,
						state: VAULT_STATE.IDLE,
						phase: 'idle',
						stageIndex: -1,
						progress: 1,
						skippable: false,
					});
					this.#finish(generation, true);
					return;
				}

				const stage = stages[stageIndex];
				this.#publish({
					active: true,
					state: stage.state,
					phase: stage.timing,
					stageIndex,
					stageCount: stages.length,
					progress: stageIndex / stages.length,
					// Trigger confirmation has completed by the time the wheel begins. The award and
					// handoff remain mandatory so the player always sees what was won.
					skippable: stageIndex >= 1
						&& stage.state !== VAULT_STATE.AWARD
						&& stage.state !== VAULT_STATE.BONUS,
				});
				this.#audio(stage.cue);
				this.#schedule(generation, stage.durationMs, () => advance(stageIndex + 1));
			};

			advance(0);
		});
	}

	skip() {
		if (!this.state.active || !this.state.skippable || !this.flow) return false;
		const generation = this.state.generation;
		this.#publish({
			state: VAULT_STATE.DOOR,
			phase: 'skipDoor',
			stageIndex: this.state.stageCount,
			progress: 0.82,
			skippable: false,
		});
		this.#audio('vault-door-open');
		this.#schedule(generation, this.timings.skipDoor, () => {
			this.#publish({
				state: VAULT_STATE.LIGHT,
				phase: 'skipLight',
				stageIndex: this.state.stageCount + 1,
				progress: 0.9,
			});
			this.#audio('vault-light-entry');
			this.#schedule(generation, this.timings.skipLight, () => {
				this.#publish({
					state: VAULT_STATE.AWARD,
					phase: 'skipAward',
					stageIndex: this.state.stageCount + 2,
					progress: 0.96,
					skippable: false,
				});
				this.#audio('free-spins-awarded');
				this.#schedule(generation, this.timings.skipAward, () => {
					this.#publish({
						state: VAULT_STATE.BONUS,
						phase: 'skipBonus',
						stageIndex: this.state.stageCount + 3,
						progress: 1,
						skippable: false,
					});
					this.#audio('bonus-ready');
					this.#schedule(generation, this.timings.skipBonus, () => {
						this.#publish({
							active: false,
							state: VAULT_STATE.IDLE,
							phase: 'idle',
							stageIndex: -1,
							skippable: false,
						});
						this.#finish(generation, true);
					});
				});
			});
		});
		return true;
	}

	showExtraction({ targetSymbol = null, awardedSpins, winRaw = 0, capped = false } = {}) {
		if (this.destroyed) return false;
		const presentedAwardedSpins = this.state.awardedSpins;
		this.cancel('extraction');
		const generation = this.state.generation + 1;
		this.state = Object.freeze({
			...initialState(generation),
			active: true,
			state: VAULT_STATE.EXTRACTION,
			phase: 'extraction',
			stageIndex: 0,
			stageCount: 1,
			progress: 1,
			reportKind: 'feature-extraction',
			reportScope: 'feature',
			targetSymbol,
			awardedSpins: resolveAwardedSpins(awardedSpins, presentedAwardedSpins),
			winRaw,
			capped,
		});
		this.#notify();
		this.#audio('extraction');
		return true;
	}

	showCapReport({
		reportScope = 'base',
		targetSymbol = null,
		awardedSpins = null,
		completedSpins = null,
		capRaw,
		winRaw,
	} = {}) {
		if (this.destroyed) return false;
		if (!validPositiveRaw(capRaw) || !validPositiveRaw(winRaw) || capRaw !== winRaw) return false;

		const featureReport = reportScope === 'feature';
		const resolvedAwardedSpins = featureReport ? resolveAwardedSpins(awardedSpins) : null;
		const resolvedCompletedSpins = featureReport
			&& resolvedAwardedSpins !== null
			&& Number.isSafeInteger(completedSpins)
			&& completedSpins > 0
			&& completedSpins <= resolvedAwardedSpins
				? completedSpins
				: null;

		this.cancel('cap-report');
		const generation = this.state.generation + 1;
		this.state = Object.freeze({
			...initialState(generation),
			active: true,
			state: VAULT_STATE.EXTRACTION,
			phase: 'cap-report',
			stageIndex: 0,
			stageCount: 1,
			progress: 1,
			reportKind: 'max-win',
			reportScope: featureReport ? 'feature' : 'base',
			targetSymbol: featureReport ? targetSymbol : null,
			awardedSpins: resolvedAwardedSpins,
			completedSpins: resolvedCompletedSpins,
			capRaw,
			winRaw,
			capped: true,
		});
		this.#notify();
		return true;
	}

	returnToBase() {
		if (this.state.state !== VAULT_STATE.EXTRACTION) return false;
		const generation = this.state.generation + 1;
		this.state = initialState(generation);
		this.#notify();
		this.#audio('return-base');
		return true;
	}

	cancel(reason = 'cancelled') {
		this.#clearTimer();
		const pending = this.flow;
		this.flow = null;
		const generation = this.state.generation + 1;
		this.state = Object.freeze({ ...initialState(generation), reason });
		this.#notify();
		pending?.resolve(false);
		return pending !== null;
	}

	destroy() {
		if (this.destroyed) return;
		this.cancel('destroyed');
		this.destroyed = true;
		this.onChange = () => {};
		this.onAudioCue = () => {};
	}
}
