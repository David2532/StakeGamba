import { packageAsset } from './blacksite-assets.js';

const PENGUIN_OPERATOR_ROOT = 'v20/penguin-operator';
const PENGUIN_TRANSITION_ROOT = `${PENGUIN_OPERATOR_ROOT}/transitions`;

const penguinAsset = (path) => packageAsset(path);

export const PENGUIN_REACTION_STATES = Object.freeze([
	'spin',
	'anticipation',
	'win-small',
	'win-big',
	'loss',
	'rage',
	'bonus',
]);

export const PENGUIN_IDLE_CLIP_IDS = Object.freeze(['idle-01', 'idle-02', 'idle-03']);
export const PENGUIN_IDLE_PACE_CLIP_IDS = Object.freeze([
	'idle-01',
	'idle-02',
	'idle-01',
	'idle-03',
]);

const ENTER_TRANSITIONS = Object.freeze(Object.fromEntries(
	PENGUIN_REACTION_STATES.map((reaction) => [
		reaction,
		penguinAsset(`${PENGUIN_TRANSITION_ROOT}/idle-to-${reaction}.webp`),
	]),
));

const EXIT_TRANSITIONS = Object.freeze(Object.fromEntries(
	PENGUIN_REACTION_STATES.map((reaction) => [
		reaction,
		penguinAsset(`${PENGUIN_TRANSITION_ROOT}/${reaction}-to-idle.webp`),
	]),
));

export const PENGUIN_OPERATOR_ASSETS = Object.freeze({
	poster: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/poster.webp`),
	idle: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/idle.webp`),
	idle02: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/idle-02.webp`),
	idle03: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/idle-03.webp`),
	idleHandoff: penguinAsset(`${PENGUIN_TRANSITION_ROOT}/idle-handoff.webp`),
	spin: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/spin.webp`),
	anticipation: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/anticipation.webp`),
	winSmall: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/win-small.webp`),
	winBig: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/win-big.webp`),
	loss: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/loss.webp`),
	rage: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/rage.webp`),
	bonus: penguinAsset(`${PENGUIN_OPERATOR_ROOT}/bonus.webp`),
	enterTransitions: ENTER_TRANSITIONS,
	exitTransitions: EXIT_TRANSITIONS,
});

const IDLE_01_SAFE_WINDOWS_MS = Object.freeze([
	Object.freeze([0, 3_500]),
	Object.freeze([4_500, 5_300]),
]);
const IDLE_02_SAFE_WINDOWS_MS = Object.freeze([
	Object.freeze([0, 4_700]),
	Object.freeze([5_700, 6_600]),
]);
const IDLE_03_SAFE_WINDOWS_MS = Object.freeze([
	Object.freeze([0, 5_700]),
	Object.freeze([6_700, 8_100]),
]);

function clip(id, source, options) {
	return Object.freeze({ id, source, ...options });
}

export const PENGUIN_OPERATOR_CLIPS = Object.freeze({
	poster: clip('poster', PENGUIN_OPERATOR_ASSETS.poster, {
		kind: 'poster',
		semanticState: 'poster',
		durationMs: 0,
		loop: false,
	}),
	'idle-01': clip('idle-01', PENGUIN_OPERATOR_ASSETS.idle, {
		kind: 'idle',
		semanticState: 'idle',
		durationMs: 5_300,
		loop: true,
		rotateAfterMs: 5_300,
		safeGateWindowsMs: IDLE_01_SAFE_WINDOWS_MS,
	}),
	'idle-02': clip('idle-02', PENGUIN_OPERATOR_ASSETS.idle02, {
		kind: 'idle',
		semanticState: 'idle',
		durationMs: 6_600,
		loop: true,
		rotateAfterMs: 6_600,
		safeGateWindowsMs: IDLE_02_SAFE_WINDOWS_MS,
	}),
	'idle-03': clip('idle-03', PENGUIN_OPERATOR_ASSETS.idle03, {
		kind: 'idle',
		semanticState: 'idle',
		durationMs: 8_100,
		loop: true,
		rotateAfterMs: 8_100,
		safeGateWindowsMs: IDLE_03_SAFE_WINDOWS_MS,
	}),
	'idle-handoff': clip('idle-handoff', PENGUIN_OPERATOR_ASSETS.idleHandoff, {
		kind: 'bridge',
		semanticState: 'idle',
		durationMs: 400,
		loop: false,
	}),
	spin: clip('spin', PENGUIN_OPERATOR_ASSETS.spin, {
		kind: 'reaction', semanticState: 'spin', durationMs: 1_000, minimumHoldMs: 900, loop: true, priority: 10,
	}),
	anticipation: clip('anticipation', PENGUIN_OPERATOR_ASSETS.anticipation, {
		kind: 'reaction', semanticState: 'anticipation', durationMs: 800, minimumHoldMs: 900, loop: true, priority: 30,
	}),
	'win-small': clip('win-small', PENGUIN_OPERATOR_ASSETS.winSmall, {
		kind: 'reaction', semanticState: 'win-small', durationMs: 800, minimumHoldMs: 1_200, loop: false, priority: 20,
	}),
	'win-big': clip('win-big', PENGUIN_OPERATOR_ASSETS.winBig, {
		kind: 'reaction', semanticState: 'win-big', durationMs: 1_000, minimumHoldMs: 1_600, loop: false, priority: 40,
	}),
	loss: clip('loss', PENGUIN_OPERATOR_ASSETS.loss, {
		kind: 'reaction', semanticState: 'loss', durationMs: 1_200, minimumHoldMs: 1_400, loop: false, priority: 20,
	}),
	rage: clip('rage', PENGUIN_OPERATOR_ASSETS.rage, {
		kind: 'reaction', semanticState: 'rage', durationMs: 800, minimumHoldMs: 1_600, loop: false, priority: 45,
	}),
	bonus: clip('bonus', PENGUIN_OPERATOR_ASSETS.bonus, {
		kind: 'reaction', semanticState: 'bonus', durationMs: 800, minimumHoldMs: 1_600, loop: true, priority: 50,
	}),
	...Object.fromEntries(PENGUIN_REACTION_STATES.flatMap((reaction) => [
		[
			`idle-to-${reaction}`,
			clip(`idle-to-${reaction}`, ENTER_TRANSITIONS[reaction], {
				kind: 'bridge', semanticState: reaction, durationMs: 400, loop: false, reaction,
			}),
		],
		[
			`${reaction}-to-idle`,
			clip(`${reaction}-to-idle`, EXIT_TRANSITIONS[reaction], {
				kind: 'bridge', semanticState: 'idle', durationMs: 400, loop: false, reaction,
			}),
		],
	])),
});

const OPERATOR_REACTION_TO_PENGUIN_STATE = Object.freeze({
	idle: 'idle',
	recover: 'idle',
	'spin-start': 'spin',
	'spin-loop': 'spin',
	'vault-anticipation': 'anticipation',
	'feature-tease': 'anticipation',
	'win-small': 'win-small',
	'win-medium': 'win-small',
	'win-big': 'win-big',
	'bonus-win': 'win-big',
	'max-win': 'win-big',
	loss: 'loss',
	'loss-streak': 'loss',
	rage: 'rage',
	alert: 'rage',
	'feature-trigger': 'bonus',
	'bonus-idle': 'bonus',
});

export function isPenguinReactionState(state) {
	return PENGUIN_REACTION_STATES.includes(state);
}

export function penguinStateForOperatorReaction(reaction) {
	return OPERATOR_REACTION_TO_PENGUIN_STATE[reaction] ?? 'idle';
}

export function penguinClipForId(clipId) {
	return PENGUIN_OPERATOR_CLIPS[clipId] ?? null;
}

export function penguinEnterClipId(reaction) {
	return isPenguinReactionState(reaction) ? `idle-to-${reaction}` : null;
}

export function penguinExitClipId(reaction) {
	return isPenguinReactionState(reaction) ? `${reaction}-to-idle` : null;
}

export function penguinSourceForState(state) {
	return penguinClipForId(isPenguinReactionState(state) ? state : 'idle-01')?.source
		?? PENGUIN_OPERATOR_ASSETS.idle;
}
