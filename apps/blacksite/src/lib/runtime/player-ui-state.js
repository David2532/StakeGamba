const SKIPPABLE_LIVE_STATES = new Set(['live-presenting', 'live-restoring']);

/**
 * @param {{
 *   launchKind: string,
 *   liveStatus: string,
 *   replayStatus: string,
 *   fixtureCompleted: boolean,
 *   insufficient: boolean,
 *   modeBlocked: boolean,
 * }} state
 */
export function primaryActionLabel({
	launchKind,
	liveStatus,
	replayStatus,
	fixtureCompleted,
	insufficient,
	modeBlocked,
}) {
	if (launchKind === 'fixture') {
		return fixtureCompleted ? 'REPLAY DEV FIXTURE' : 'PLAY DEV FIXTURE';
	}
	if (launchKind === 'replay') {
		if (replayStatus === 'loading') return 'LOADING REPLAY';
		if (replayStatus === 'ready') return 'PLAY REPLAY';
		if (replayStatus === 'playing') return 'REPLAYING';
		if (replayStatus === 'completed') return 'PLAY AGAIN';
		return 'REPLAY UNAVAILABLE';
	}
	if (launchKind === 'live') {
		if (liveStatus === 'presenting') return 'CONTINUE ROUND';
		if (liveStatus === 'playing') return 'REQUESTING RESULT';
		if (liveStatus === 'error' || liveStatus === 'reauthentication-required') {
			return 'RELOAD REQUIRED';
		}
		if (liveStatus === 'ready' && modeBlocked) return 'SELECT AVAILABLE MODE';
		if (liveStatus === 'ready' && insufficient) return 'INSUFFICIENT BALANCE';
		if (liveStatus === 'ready') return 'INITIATE BREACH';
		if (liveStatus === 'authenticating') return 'AUTHENTICATING';
		if (liveStatus === 'settling') return 'SETTLING';
	}
	return 'UNAVAILABLE';
}

/**
 * @param {{
 *   launchKind: string,
 *   liveStatus: string,
 *   replayStatus: string,
 *   busy: boolean,
 *   confirming: boolean,
 *   showingRules: boolean,
 *   fixtureReady: boolean,
 *   insufficient: boolean,
 *   modeBlocked: boolean,
 * }} state
 */
export function primaryActionDisabled({
	launchKind,
	liveStatus,
	replayStatus,
	busy,
	confirming,
	showingRules,
	fixtureReady,
	insufficient,
	modeBlocked,
}) {
	if (busy || confirming || showingRules) return true;
	if (launchKind === 'fixture') return !fixtureReady;
	if (launchKind === 'replay') return !['ready', 'completed'].includes(replayStatus);
	if (launchKind === 'live') {
		return (
			insufficient ||
			(modeBlocked && liveStatus === 'ready') ||
			!['ready', 'presenting'].includes(liveStatus)
		);
	}
	return true;
}

/**
 * Returns true only while the presentation director owns an active, cancellable sequence.
 * Network requests, minimum-duration holds and settlement are deliberately not skippable.
 *
 * @param {{
 *   launchKind: string,
 *   runtimeState: string,
 *   replayStatus: string,
 *   slamstopDisabled?: boolean,
 * }} state
 */
export function presentationCanSkip({
	launchKind,
	runtimeState,
	replayStatus,
	slamstopDisabled = false,
}) {
	if (launchKind === 'fixture') return runtimeState === 'fixture-playing';
	if (launchKind === 'live') {
		return !slamstopDisabled && SKIPPABLE_LIVE_STATES.has(runtimeState);
	}
	if (launchKind === 'replay') return replayStatus === 'playing';
	return false;
}

/**
 * @param {{ reducedMotion: boolean, motionMode: string, turboDisabled?: boolean }} state
 */
export function resolvePresentationTimingProfile({
	reducedMotion,
	motionMode,
	turboDisabled = false,
}) {
	if (reducedMotion) return 'reduced';
	if (turboDisabled) return 'normal';
	return motionMode === 'turbo' ? 'turbo' : 'normal';
}

/**
 * A malformed launch cannot be repaired by reloading the same URL. Runtime transport and
 * authority failures can, because reload starts the documented restore handshake.
 *
 * @param {{ launchKind: string, runtimeError: unknown }} state
 */
export function hasExplicitRecovery({ launchKind, runtimeError }) {
	return Boolean(runtimeError) && (launchKind === 'live' || launchKind === 'replay');
}
