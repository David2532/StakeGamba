import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AudioDirector } from '../src/lib/runtime/audio-director.js';
import {
	hasExplicitRecovery,
	presentationCanSkip,
	primaryActionDisabled,
	primaryActionLabel,
	resolvePresentationTimingProfile,
} from '../src/lib/runtime/player-ui-state.js';

const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const introUrl = new URL('../src/lib/components/BootIntro.svelte', import.meta.url);
const pageLifecycleUrl = new URL('../src/lib/runtime/page-lifecycle.js', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

const baseActionState = Object.freeze({
	launchKind: 'live',
	liveStatus: 'ready',
	replayStatus: 'idle',
	busy: false,
	confirming: false,
	showingRules: false,
	fixtureReady: false,
	insufficient: false,
	modeBlocked: false,
});

test('primary action exposes an honest label and enabled state across product outcomes', () => {
	const cases = [
		[{ ...baseActionState, launchKind: 'booting' }, 'UNAVAILABLE', true],
		[{ ...baseActionState, liveStatus: 'authenticating' }, 'AUTHENTICATING', true],
		[{ ...baseActionState }, 'INITIATE BREACH', false],
		[{ ...baseActionState, insufficient: true }, 'INSUFFICIENT BALANCE', true],
		[{ ...baseActionState, modeBlocked: true }, 'SELECT AVAILABLE MODE', true],
		[{ ...baseActionState, liveStatus: 'playing' }, 'REQUESTING RESULT', true],
		[{ ...baseActionState, liveStatus: 'presenting' }, 'CONTINUE ROUND', false],
		[{ ...baseActionState, liveStatus: 'settling' }, 'SETTLING', true],
		[{ ...baseActionState, liveStatus: 'error' }, 'RELOAD REQUIRED', true],
		[{ ...baseActionState, liveStatus: 'reauthentication-required' }, 'RELOAD REQUIRED', true],
		[{ ...baseActionState, launchKind: 'replay', replayStatus: 'loading' }, 'LOADING REPLAY', true],
		[{ ...baseActionState, launchKind: 'replay', replayStatus: 'ready' }, 'PLAY REPLAY', false],
		[{ ...baseActionState, launchKind: 'replay', replayStatus: 'playing' }, 'REPLAYING', true],
		[{ ...baseActionState, launchKind: 'replay', replayStatus: 'completed' }, 'PLAY AGAIN', false],
		[
			{ ...baseActionState, launchKind: 'replay', replayStatus: 'error' },
			'REPLAY UNAVAILABLE',
			true,
		],
		[{ ...baseActionState, launchKind: 'fixture', fixtureReady: true }, 'PLAY DEV FIXTURE', false],
		[
			{
				...baseActionState,
				launchKind: 'fixture',
				fixtureReady: true,
				fixtureCompleted: true,
			},
			'REPLAY DEV FIXTURE',
			false,
		],
	];

	for (const [state, expectedLabel, expectedDisabled] of cases) {
		assert.equal(primaryActionLabel(state), expectedLabel, JSON.stringify(state));
		assert.equal(primaryActionDisabled(state), expectedDisabled, JSON.stringify(state));
	}

	for (const overlayState of [{ busy: true }, { confirming: true }, { showingRules: true }]) {
		assert.equal(primaryActionDisabled({ ...baseActionState, ...overlayState }), true);
	}
});

test('SKIP is enabled only for an active cancellable presentation', () => {
	for (const state of [
		{ launchKind: 'fixture', runtimeState: 'fixture-playing', replayStatus: 'idle' },
		{ launchKind: 'live', runtimeState: 'live-presenting', replayStatus: 'idle' },
		{ launchKind: 'live', runtimeState: 'live-restoring', replayStatus: 'idle' },
		{ launchKind: 'replay', runtimeState: 'replay-playing', replayStatus: 'playing' },
	]) {
		assert.equal(presentationCanSkip(state), true, JSON.stringify(state));
	}

	for (const runtimeState of [
		'booting',
		'live-authenticating',
		'live-requesting',
		'live-minimum-duration',
		'live-settling',
		'live-ready',
		'live-error',
	]) {
		assert.equal(
			presentationCanSkip({ launchKind: 'live', runtimeState, replayStatus: 'idle' }),
			false,
			runtimeState,
		);
	}
	assert.equal(
		presentationCanSkip({
			launchKind: 'replay',
			runtimeState: 'replay-loading',
			replayStatus: 'loading',
		}),
		false,
	);
	assert.equal(
		presentationCanSkip({
			launchKind: 'replay',
			runtimeState: 'replay-completed',
			replayStatus: 'completed',
		}),
		false,
	);
	assert.equal(
		presentationCanSkip({
			launchKind: 'live',
			runtimeState: 'live-presenting',
			replayStatus: 'idle',
			slamstopDisabled: true,
		}),
		false,
	);
});

test('jurisdiction and reduced-motion rules override a stored Turbo preference', () => {
	assert.equal(
		resolvePresentationTimingProfile({ reducedMotion: false, motionMode: 'turbo' }),
		'turbo',
	);
	assert.equal(
		resolvePresentationTimingProfile({
			reducedMotion: false,
			motionMode: 'turbo',
			turboDisabled: true,
		}),
		'normal',
	);
	assert.equal(
		resolvePresentationTimingProfile({
			reducedMotion: true,
			motionMode: 'turbo',
			turboDisabled: true,
		}),
		'reduced',
	);
});

test('recovery is offered only where reload can start an authoritative restore handshake', () => {
	const runtimeError = { code: 'NETWORK_ERROR' };
	assert.equal(hasExplicitRecovery({ launchKind: 'live', runtimeError }), true);
	assert.equal(hasExplicitRecovery({ launchKind: 'replay', runtimeError }), true);
	assert.equal(hasExplicitRecovery({ launchKind: 'error', runtimeError }), false);
	assert.equal(hasExplicitRecovery({ launchKind: 'fixture', runtimeError }), false);
	assert.equal(hasExplicitRecovery({ launchKind: 'live', runtimeError: null }), false);
});

test('unsupported audio becomes a visible disabled capability instead of a dead control', async () => {
	const audio = new AudioDirector();
	assert.equal(await audio.unlock(), false);
	assert.equal(audio.state.status, 'unsupported');
	assert.equal(audio.state.unlocked, false);
	audio.destroy();
});

test('loading, fixed-board and error surfaces retain explicit accessible semantics', async () => {
	const [page, browserQa] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(browserQaUrl, 'utf8'),
	]);
	assert.match(page, /presentationSkippable = presentationCanSkip\(/u);
	assert.match(page, /data-testid="skip-presentation"[\s\S]*?disabled=\{!presentationSkippable\}/u);
	assert.match(page, /class="launch-card pending" aria-live="polite"/u);
	assert.match(page, /class="launch-card error" data-testid="launch-error" role="alert"/u);
	assert.match(page, /data-testid="recovery-action" on:click=\{recoverRuntime\}/u);
	assert.match(page, /Array\.from\(\{ length: 49 \}/u);
	assert.match(page, /role="grid"[\s\S]*aria-rowcount="7"[\s\S]*aria-colcount="7"/u);
	assert.match(page, /\{:else\}[\s\S]*class="concealed-cell" aria-hidden="true"/u);
	assert.match(page, /audioUnavailable = audioState\.status === 'unsupported'/u);
	assert.match(page, /audioOff = !audioState\.unlocked \|\| audioState\.volume === 0/u);
	assert.match(page, /aria-pressed=\{audioOff\}/u);
	assert.match(page, /'Game audio unavailable on this device'/u);
	assert.match(page, /disabled=\{audioUnavailable\}/u);
	assert.match(page, /SOUND \{audioUnavailable \? 'UNAVAILABLE'/u);
	assert.match(
		page,
		/function activatePrimary\(\) \{[\s\S]*?primeAudioFromPrimaryGesture\(\);[\s\S]*?requestLivePlay\(\);/u,
	);
	assert.doesNotMatch(
		page,
		/function activatePrimary\(\) \{[\s\S]*?await audioDirector\?\.unlock/u,
	);
	assert.match(page, /data-testid="total-play">\s*\{visibleTotalAmountText\}\s*<\/strong/u);
	assert.match(
		page,
		/data-testid="summary-total-play"[^>]*>\s*\{visibleTotalAmountText\}\s*<\/strong/u,
	);
	assert.match(
		page,
		/function focusFirstAvailablePlayerControl\(\)[\s\S]*?primaryActionElement[\s\S]*?base-amount[\s\S]*?info-action/u,
	);
	assert.match(browserQa, /minimum-duration hold does not expose a dead presentation Skip action/u);
	assert.match(
		browserQa,
		/Skip becomes available only after the minimum-duration hold enters cancellable presentation/u,
	);
	const presentationFailureStart = page.indexOf(
		"runtimeError = publicError(error, 'PRESENTATION_ERROR');",
	);
	const presentationFailureEnd = page.indexOf(
		'\n\t\t\tprimaryBusy = false;\n\t\t\treturn;',
		presentationFailureStart,
	);
	assert.notEqual(presentationFailureStart, -1);
	assert.notEqual(presentationFailureEnd, -1);
	const presentationFailureBlock = page.slice(presentationFailureStart, presentationFailureEnd);
	assert.match(presentationFailureBlock, /await liveSession\.failPresentation\(error\);/u);
	assert.match(presentationFailureBlock, /runtimeState = 'live-ready'/u);
	assert.doesNotMatch(presentationFailureBlock, /runtimeError = null/u);
});

test('every authored button has a handler and whole-surface dismissals require backdrop self-hit', async () => {
	const [page, intro] = await Promise.all([readFile(pageUrl, 'utf8'), readFile(introUrl, 'utf8')]);
	const buttonPattern = /<button\b[\s\S]*?<\/button\s*>/gu;
	const buttonBlocks = [...page.matchAll(buttonPattern), ...intro.matchAll(buttonPattern)].map(
		(match) => match[0],
	);
	assert(buttonBlocks.length >= 10);
	for (const button of buttonBlocks) {
		assert.match(button, /type="button"/u, button);
		assert.match(button, /on:click/u, button);
	}

	const pageWithoutButtons = page.replace(buttonPattern, '');
	const surfaceClicks = pageWithoutButtons.match(/on:click[^=]*=/gu) ?? [];
	assert.deepEqual(surfaceClicks, ['on:click|self=', 'on:click|self=']);
	assert.doesNotMatch(pageWithoutButtons, /class="(?:board|cell|panel)[^"]*"[^>]*on:click/u);
});

test('persisted page restoration tears down once and forces authoritative browser rebootstrap', async () => {
	const [page, lifecycle, browserQa] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(pageLifecycleUrl, 'utf8'),
		readFile(browserQaUrl, 'utf8'),
	]);
	assert.match(page, /createAuthoritativePageLifecycle/u);
	assert.match(page, /window\.addEventListener\('pagehide', pageLifecycle\.handlePageHide\)/u);
	assert.match(page, /window\.addEventListener\('pageshow', pageLifecycle\.handlePageShow\)/u);
	assert.match(page, /window\.removeEventListener\('pageshow', pageLifecycle\.handlePageShow\)/u);
	assert.match(lifecycle, /event\?\.persisted !== true/u);
	assert.match(lifecycle, /reloadRequested = true;\s*reload\(\)/u);
	assert.match(lifecycle, /function teardownOnce\(\)/u);
	for (const scenario of [
		'persisted-pageshow-live-ready-reauthenticates',
		'persisted-pageshow-active-round-restores',
		'persisted-pageshow-replay-refetches-read-only',
		'persisted-pageshow-fresh-intro-restarts-safely',
	]) {
		assert.match(browserQa, new RegExp(`runScenario\\('${scenario}'`, 'u'));
	}
	assert.match(browserQa, /persisted live-ready transition performs a real document reload/u);
	assert.match(
		browserQa,
		/restarted intro dismisses to a focused operable surface without an inert leak/u,
	);
});

test('browser QA binds delayed audio resume independently from immutable paid intent', async () => {
	const browserQa = await readFile(browserQaUrl, 'utf8');
	assert.match(browserQa, /delayed-audio-resume-never-delays-or-mutates-play-intent/u);
	assert.match(
		browserQa,
		/paid request starts while the gesture-owned AudioContext resume remains unresolved/u,
	);
	assert.match(
		browserQa,
		/delayed audio cannot mutate the captured amount or mode and leaves Play operable/u,
	);
});
