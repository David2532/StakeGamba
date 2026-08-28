import {
	PENGUIN_IDLE_CLIP_IDS,
	PENGUIN_IDLE_PACE_CLIP_IDS,
	isPenguinReactionState,
	penguinEnterClipId,
	penguinExitClipId,
} from '../assets/penguin-operator-assets.js';

export function normalizePenguinState(state) {
	if (state === 'poster' || state === 'idle' || isPenguinReactionState(state)) return state;
	return 'idle';
}

export function nextPenguinIdleIndex(idleIndex) {
	const normalized = Number.isInteger(idleIndex) && idleIndex >= 0 ? idleIndex : 0;
	return (normalized + 1) % PENGUIN_IDLE_CLIP_IDS.length;
}

export function nextPenguinIdlePaceIndex(idlePaceIndex) {
	const normalized = Number.isInteger(idlePaceIndex) && idlePaceIndex >= 0 ? idlePaceIndex : 0;
	return (normalized + 1) % PENGUIN_IDLE_PACE_CLIP_IDS.length;
}

export function penguinIdleSafeWindowDelayMs({
	positionMs,
	loopMs,
	safeGateWindowsMs,
	armBudgetMs = 0,
}) {
	if (!Number.isFinite(loopMs) || loopMs <= 0 || !Number.isFinite(positionMs)) return null;
	const normalizedPositionMs = ((positionMs % loopMs) + loopMs) % loopMs;
	const windows = (safeGateWindowsMs ?? [])
		.map((window) => Array.isArray(window)
			? window
			: [window?.startMs, window?.endMs])
		.filter(([startMs, endMs]) => (
			Number.isFinite(startMs)
			&& Number.isFinite(endMs)
			&& startMs >= 0
			&& startMs < endMs
			&& endMs <= loopMs
		))
		.sort(([leftStart], [rightStart]) => leftStart - rightStart);
	if (windows.length === 0) return null;

	const safeArmBudgetMs = Number.isFinite(armBudgetMs) ? Math.max(0, armBudgetMs) : 0;
	const currentWindow = windows.find(([startMs, endMs]) => (
		normalizedPositionMs >= startMs && normalizedPositionMs < endMs
	));
	if (
		currentWindow
		&& normalizedPositionMs + safeArmBudgetMs < currentWindow[1]
	) return 0;

	const nextWindow = windows.find(([startMs]) => startMs > normalizedPositionMs);
	const waitUntilWindowMs = nextWindow
		? nextWindow[0] - normalizedPositionMs
		: loopMs - normalizedPositionMs + windows[0][0];
	return Math.max(0, waitUntilWindowMs);
}

function idleIndexForClip(clipId) {
	const idleIndex = PENGUIN_IDLE_CLIP_IDS.indexOf(clipId);
	return idleIndex >= 0 ? idleIndex : 0;
}

function step(clipId, phase, options = {}) {
	return Object.freeze({ clipId, phase, required: options.required !== false, reaction: options.reaction ?? null });
}

export function planPenguinSemanticTransition({
	targetState,
	activeReaction = null,
	idleIndex = 0,
	idlePaceIndex = 0,
	currentClipId = 'poster',
}) {
	const target = normalizePenguinState(targetState);
	if (target === 'poster') {
		return Object.freeze({
			targetState: target,
			nextIdleIndex: idleIndex,
			nextIdlePaceIndex: idlePaceIndex,
			steps: Object.freeze([step('poster', 'poster')]),
		});
	}

	if (target === 'idle') {
		if (!activeReaction && PENGUIN_IDLE_CLIP_IDS.includes(currentClipId)) {
			return Object.freeze({
				targetState: target,
				nextIdleIndex: idleIndex,
				nextIdlePaceIndex: idlePaceIndex,
				steps: Object.freeze([]),
			});
		}
		// Reactions recover through the quiet canonical patrol. This does not sample
		// or alter any gameplay state; it only resets the DEV presentation cadence.
		const nextIdleIndex = activeReaction ? 0 : idleIndex;
		const nextIdlePaceIndex = activeReaction ? 0 : idlePaceIndex;
		const steps = [];
		if (activeReaction) {
			steps.push(step(penguinExitClipId(activeReaction), 'exit', {
				required: false,
				reaction: activeReaction,
			}));
		}
		steps.push(step(PENGUIN_IDLE_CLIP_IDS[nextIdleIndex], 'idle'));
		return Object.freeze({
			targetState: target,
			nextIdleIndex,
			nextIdlePaceIndex,
			steps: Object.freeze(steps),
		});
	}

	const steps = [];
	if (activeReaction && activeReaction !== target) {
		steps.push(step(penguinExitClipId(activeReaction), 'exit', {
			required: false,
			reaction: activeReaction,
		}));
	}
	if (activeReaction !== target || currentClipId !== target) {
		steps.push(step(penguinEnterClipId(target), 'enter', { required: false, reaction: target }));
	}
	steps.push(step(target, 'reaction', { reaction: target }));
	return Object.freeze({
		targetState: target,
		nextIdleIndex: idleIndex,
		nextIdlePaceIndex: idlePaceIndex,
		steps: Object.freeze(steps),
	});
}

export function planPenguinIdleRotation(idlePaceIndex = 0) {
	const nextIdlePaceIndex = nextPenguinIdlePaceIndex(idlePaceIndex);
	const nextIdleClipId = PENGUIN_IDLE_PACE_CLIP_IDS[nextIdlePaceIndex];
	const nextIdleIndex = idleIndexForClip(nextIdleClipId);
	return Object.freeze({
		nextIdleIndex,
		nextIdlePaceIndex,
		steps: Object.freeze([
			step('idle-handoff', 'idle-handoff', { required: false }),
			step(nextIdleClipId, 'idle'),
		]),
	});
}
