import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	DEFAULT_VAULT_TIMINGS,
	MAX_VAULT_CINEMATIC_MS,
	NORMAL_V26_VAULT_TIMINGS,
	VAULT_AWARDED_SPINS,
	VAULT_STATE,
	VaultCinematicDirector,
	createVaultCinematicTimeline,
} from '../src/lib/runtime/vault-cinematic-director.js';

const directorSource = await readFile(
	new URL('../src/lib/runtime/vault-cinematic-director.js', import.meta.url),
	'utf8',
);
const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const presentationDirectorSource = await readFile(
	new URL('../src/lib/runtime/presentation-director.js', import.meta.url),
	'utf8',
);
const cinematicComponentSource = await readFile(
	new URL('../src/lib/components/VaultCinematic.svelte', import.meta.url),
	'utf8',
);
const FAST_TIMINGS = Object.freeze(Object.fromEntries(
	Object.keys(DEFAULT_VAULT_TIMINGS).map((key) => [key, 2]),
));

async function waitFor(predicate, timeoutMs = 2_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error('Timed out waiting for Vault cinematic state.');
}

test('Vault cinematic is a presentation-only module with no RNG, wallet or play authority', () => {
	assert.doesNotMatch(
		directorSource,
		/Math\.random|crypto\.getRandomValues|\bfetch\s*\(|\/wallet\/play|authenticate|end-round|live-session|rgs-client|contracts\/(?:modes|rules|reels)/iu,
	);
	assert.doesNotMatch(directorSource, /payout\s*[+*=]|freeSpins\s*[+*=]|targetSymbol\s*=\s*(?:random|Math\.)/iu);
	assert.match(pageSource, /targetSymbol:\s*cue\.event\?\.target_symbol/u);
	assert.match(pageSource, /targetSymbol:\s*state\.featureTarget/u);
});

test('responsive Vault skip keeps a dedicated 44px lane outside the status copy', () => {
	assert.match(
		cinematicComponentSource,
		/\.vault-stage-status button\.vault-skip\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*3;[\s\S]*?min-height:\s*44px;/u,
	);
	assert.match(
		cinematicComponentSource,
		/\.vault-stage-status \.vault-status-copy\s*\{[\s\S]*?width:\s*min\(520px, calc\(100% - 124px\)\);/u,
	);
});

test('normal Vault cinematic presents mechanics, light, authoritative award and bonus entry in order', async () => {
	const states = [];
	const audioCues = [];
	const director = new VaultCinematicDirector({
		onChange: (state) => states.push(state.state),
		onAudioCue: (cue) => audioCues.push(cue),
		timings: FAST_TIMINGS,
	});
	assert.equal(await director.play({ direct: false, targetSymbol: 'operative' }), true);
	assert.deepEqual(states, [
		VAULT_STATE.IDLE,
		VAULT_STATE.TRIGGER_LOCK,
		VAULT_STATE.WHEEL,
		VAULT_STATE.LOCKS,
		VAULT_STATE.DOOR,
		VAULT_STATE.LIGHT,
		VAULT_STATE.AWARD,
		VAULT_STATE.BONUS,
		VAULT_STATE.IDLE,
	]);
	assert.deepEqual(audioCues, [
		'vault-notice',
		'vault-wheel-turn',
		'vault-locks-release',
		'vault-door-open',
		'vault-light-entry',
		'free-spins-awarded',
		'bonus-ready',
	]);
	assert.equal(director.state.targetSymbol, 'operative');
	assert.equal(director.state.active, false);
	director.destroy();
});

test('reduced motion shortens motion without deleting semantic states', async () => {
	const states = [];
	const director = new VaultCinematicDirector({
		onChange: (state) => states.push(state.state),
		timings: FAST_TIMINGS,
	});
	assert.equal(await director.play({ direct: false, reducedMotion: true, turbo: true }), true);
	assert.deepEqual(states, [
		VAULT_STATE.IDLE,
		VAULT_STATE.TRIGGER_LOCK,
		VAULT_STATE.WHEEL,
		VAULT_STATE.LOCKS,
		VAULT_STATE.DOOR,
		VAULT_STATE.LIGHT,
		VAULT_STATE.AWARD,
		VAULT_STATE.BONUS,
		VAULT_STATE.IDLE,
	]);
	assert.equal(director.state.active, false);
	director.destroy();
});

test('Skip is locked until trigger confirmation, then preserves door, light, award and bonus order', async () => {
	const states = [];
	const director = new VaultCinematicDirector({
		onChange: (state) => states.push(state.state),
		timings: { ...FAST_TIMINGS, notice: 8, triggerLock: 8 },
	});
	const flow = director.play({ direct: false, targetSymbol: 'operative', turbo: true, reducedMotion: true });
	assert.equal(director.skip(), false, 'the unconfirmed first stage cannot be skipped');
	await waitFor(() => director.state.skippable === true);
	assert.equal(director.skip(), true);
	assert.equal(await flow, true);
	assert.equal(director.state.active, false);
	assert.equal(director.state.state, VAULT_STATE.IDLE);
	assert.ok(states.includes(VAULT_STATE.TRIGGER_LOCK));
	assert.ok(states.includes(VAULT_STATE.DOOR));
	assert.ok(states.includes(VAULT_STATE.LIGHT));
	assert.ok(states.includes(VAULT_STATE.AWARD));
	assert.ok(states.includes(VAULT_STATE.BONUS));
	assert.ok(states.indexOf(VAULT_STATE.DOOR) < states.indexOf(VAULT_STATE.LIGHT));
	assert.ok(states.indexOf(VAULT_STATE.LIGHT) < states.indexOf(VAULT_STATE.AWARD));
	assert.ok(states.indexOf(VAULT_STATE.AWARD) < states.indexOf(VAULT_STATE.BONUS));
	director.destroy();
});

test('award and bonus handoff cannot be skipped after they become visible', async () => {
	const director = new VaultCinematicDirector({ timings: FAST_TIMINGS });
	const flow = director.play({ targetSymbol: 'ten', awardedSpins: 8 });
	await waitFor(() => director.state.state === VAULT_STATE.AWARD);
	assert.equal(director.state.skippable, false);
	assert.equal(director.skip(), false);
	await flow;
	director.destroy();
});

test('awarded screen presents the canonical eight-spin count, target, next spin and completion copy', () => {
	assert.match(cinematicComponentSource, /data-testid="vault-free-spins-award"/u);
	assert.match(cinematicComponentSource, /data-testid="vault-free-spins-count"/u);
	assert.match(cinematicComponentSource, /data-testid="vault-free-spins-target"/u);
	assert.match(cinematicComponentSource, /data-testid="vault-free-spins-target-art"/u);
	assert.match(cinematicComponentSource, /`\$\{awardedSpins\} FREE SPINS AWARDED`/u);
	assert.match(cinematicComponentSource, /<span>EXPANDING TARGET<\/span>/u);
	assert.match(cinematicComponentSource, /data-target-label=\{targetLabel\}/u);
	assert.match(cinematicComponentSource, /class="vault-award-count"/u);
	assert.match(cinematicComponentSource, /class="vault-award-target"/u);
	assert.match(cinematicComponentSource, /`\$\{triggerCount\} VAULTS CONFIRMED`/u);
	assert.match(cinematicComponentSource, /NEXT: FREE SPIN 1 OF \{awardedSpins\}/u);
	assert.match(cinematicComponentSource, /`\$\{awardedSpins\}\/\$\{awardedSpins\} FREE SPINS COMPLETE`/u);
	assert.match(cinematicComponentSource, /BLACKOUT COMPLETE/u);
	assert.match(cinematicComponentSource, /TOTAL BONUS WIN/u);
	assert.match(cinematicComponentSource, /BLACKOUT STARTS NOW/u);
	assert.match(cinematicComponentSource, /EXPANDS TO FILL EVERY REEL IT LANDS ON/u);
	assert.match(directorSource, /export const VAULT_AWARDED_SPINS = 8;/u);
	assert.match(cinematicComponentSource, /cinematic\?\.awardedSpins === VAULT_AWARDED_SPINS/u);
	assert.doesNotMatch(cinematicComponentSource, /(?:fetch|wallet|rgs-client|Math\.random)/iu);
});

test('arm and feature-start presentation normalize every non-eight award count to eight', async () => {
	const states = [];
	const director = new VaultCinematicDirector({
		onChange: (state) => states.push(state),
		timings: FAST_TIMINGS,
	});
	director.arm({ triggerCount: 4, targetSymbol: 'q', awardedSpins: 10 });
	assert.equal(director.state.awardedSpins, VAULT_AWARDED_SPINS);
	await director.play({ targetSymbol: 'operative', awardedSpins: 12 });
	const award = states.find((state) => state.state === VAULT_STATE.AWARD);
	assert.equal(award.awardedSpins, VAULT_AWARDED_SPINS);
	assert.equal(award.triggerCount, 4);
	assert.equal(award.targetSymbol, 'operative');

	director.arm({ awardedSpins: 9 });
	await director.play({ awardedSpins: 0 });
	const laterAward = states.filter((state) => state.state === VAULT_STATE.AWARD).at(-1);
	assert.equal(laterAward.awardedSpins, VAULT_AWARDED_SPINS);
	director.destroy();
});

test('showExtraction normalizes stored and explicit award totals to canonical eight', () => {
	const director = new VaultCinematicDirector();
	director.arm({ awardedSpins: 11 });
	director.showExtraction({ targetSymbol: 'q', winRaw: 125 });
	assert.equal(director.state.awardedSpins, VAULT_AWARDED_SPINS);
	director.returnToBase();
	director.showExtraction({ awardedSpins: 6 });
	assert.equal(director.state.awardedSpins, VAULT_AWARDED_SPINS);
	director.destroy();
});

test('feature max-win report preserves authoritative context and returns to idle', () => {
	const director = new VaultCinematicDirector();
	assert.equal(director.showCapReport({
		reportScope: 'feature',
		targetSymbol: 'operative',
		awardedSpins: 12,
		completedSpins: 3,
		capRaw: 1_000_000,
		winRaw: 1_000_000,
	}), true);
	assert.equal(director.state.active, true);
	assert.equal(director.state.state, VAULT_STATE.EXTRACTION);
	assert.equal(director.state.phase, 'cap-report');
	assert.equal(director.state.reportKind, 'max-win');
	assert.equal(director.state.reportScope, 'feature');
	assert.equal(director.state.targetSymbol, 'operative');
	assert.equal(director.state.awardedSpins, VAULT_AWARDED_SPINS);
	assert.equal(director.state.completedSpins, 3);
	assert.equal(director.state.capRaw, 1_000_000);
	assert.equal(director.state.winRaw, 1_000_000);
	assert.equal(director.state.capped, true);

	assert.equal(director.returnToBase(), true);
	assert.equal(director.state.active, false);
	assert.equal(director.state.state, VAULT_STATE.IDLE);
	assert.equal(director.state.reportKind, null);
	director.destroy();
});

test('base max-win report cannot leak stale free-spin or target context', () => {
	const director = new VaultCinematicDirector();
	director.arm({ targetSymbol: 'operative', awardedSpins: VAULT_AWARDED_SPINS });
	assert.equal(director.showCapReport({
		reportScope: 'base',
		targetSymbol: 'operative',
		awardedSpins: VAULT_AWARDED_SPINS,
		completedSpins: 7,
		capRaw: 1_000_000,
		winRaw: 1_000_000,
	}), true);
	assert.equal(director.state.reportScope, 'base');
	assert.equal(director.state.targetSymbol, null);
	assert.equal(director.state.awardedSpins, null);
	assert.equal(director.state.completedSpins, null);
	assert.equal(director.state.capRaw, director.state.winRaw);
	director.destroy();
});

test('max-win report rejects missing, invalid and mismatched authoritative raw values without mutation', () => {
	const director = new VaultCinematicDirector();
	const initialState = director.state;
	const unsafeRaw = Number.MAX_SAFE_INTEGER + 1;
	for (const input of [
		{},
		{ capRaw: 0, winRaw: 0 },
		{ capRaw: 1.5, winRaw: 1.5 },
		{ capRaw: unsafeRaw, winRaw: unsafeRaw },
		{ capRaw: 1_000_000, winRaw: 999_999 },
	]) {
		assert.equal(director.showCapReport(input), false);
		assert.equal(director.state, initialState, 'rejected report must not publish or increment generation');
	}
	director.destroy();
});

test('max-win report source contract keeps Base clean, Feature conditional and dialog focus intact', () => {
	const operatorCueStart = pageSource.indexOf('function handleOperatorCue');
	const capCaseStart = pageSource.indexOf("case 'cap_reached':", operatorCueStart);
	const capCaseEnd = pageSource.indexOf("case 'feature_ended':", capCaseStart);
	assert.ok(capCaseStart >= 0 && capCaseEnd > capCaseStart);
	const capCaseSource = pageSource.slice(capCaseStart, capCaseEnd);
	assert.match(capCaseSource, /const featureCap = state\.phase === 'feature'/u);
	assert.match(capCaseSource, /showCapReport\(\{/u);
	assert.match(capCaseSource, /reportScope: featureCap \? 'feature' : 'base'/u);
	assert.match(capCaseSource, /targetSymbol: featureCap \? state\.featureTarget : null/u);
	assert.match(capCaseSource, /awardedSpins: featureCap \? state\.totalFreeSpins : null/u);
	assert.match(capCaseSource, /completedSpins: featureCap \? state\.freeSpinIndex : null/u);
	assert.match(capCaseSource, /capRaw: cue\.event\?\.cap_raw/u);
	assert.match(capCaseSource, /winRaw: cue\.event\?\.cumulative_payout_raw/u);
	assert.doesNotMatch(capCaseSource, /VAULT_AWARDED_SPINS|Math\.random|targetLabel/u);

	for (const copy of [
		'MAX WIN CONFIRMED',
		'CAP REACHED',
		'Base-game payout locked at the authoritative maximum',
		'BLACKOUT feature payout locked at the maximum',
		'`BLACKOUT stopped at free spin ${reportedCompletedSpins} of ${reportedAwardedSpins}`',
		'TOTAL ROUND WIN',
		'TOTAL FEATURE WIN',
		'MAXIMUM PAYOUT CONFIRMED',
	]) {
		assert.ok(cinematicComponentSource.includes(copy), `missing cap-report copy: ${copy}`);
	}
	for (const hook of [
		'data-vault-report=',
		'data-vault-report-scope=',
		'data-testid="vault-cap-reached"',
		'data-testid="vault-cap-feature-context"',
		'data-testid="return-to-base"',
	]) {
		assert.ok(cinematicComponentSource.includes(hook), `missing cap-report DOM hook: ${hook}`);
	}
	const featureContextStart = cinematicComponentSource.indexOf('{#if isFeatureCapReport && hasCapTarget}');
	const featureContextEnd = cinematicComponentSource.indexOf('data-testid="return-to-base"', featureContextStart);
	assert.ok(featureContextStart >= 0 && featureContextEnd > featureContextStart);
	const featureContextSource = cinematicComponentSource.slice(featureContextStart, featureContextEnd);
	assert.match(featureContextSource, /BLACKOUT TARGET/u);
	assert.match(featureContextSource, /\{targetLabel\}/u);

	const restoreFocusStart = cinematicComponentSource.indexOf('function restoreFocusAfterClose()');
	const restoreFocusEnd = cinematicComponentSource.indexOf('function syncFocusLifecycle', restoreFocusStart);
	const restoreFocusSource = cinematicComponentSource.slice(restoreFocusStart, restoreFocusEnd);
	assert.match(restoreFocusSource, /focusSafely\(targetBeforeOpen\)/u);
	assert.match(restoreFocusSource, /\[data-testid="primary-action"\]:not\(:disabled\)/u);

	const focusLifecycleStart = restoreFocusEnd;
	const focusLifecycleEnd = cinematicComponentSource.indexOf('function handleDialogKeydown', focusLifecycleStart);
	const focusLifecycleSource = cinematicComponentSource.slice(focusLifecycleStart, focusLifecycleEnd);
	assert.match(focusLifecycleSource, /if \(activeClosed\) \{[\s\S]*restoreFocusAfterClose\(\)/u);
	assert.match(focusLifecycleSource, /if \(extractionStarted\) focusAfterRender\('return'\)/u);
	assert.match(cinematicComponentSource, /bind:this=\{returnButton\}/u);
	assert.match(cinematicComponentSource, /on:click=\{\(\) => dispatch\('return'\)\}/u);
	assert.match(cinematicComponentSource, /isCapped \? ` \$\{CAP_BANNER_ID\}` : ''/u);
	assert.match(pageSource, /function returnVaultToBase\(\) \{[\s\S]*vaultCinematicDirector\?\.returnToBase\(\)/u);
	assert.match(pageSource, /on:return=\{returnVaultToBase\}/u);
});

test('legacy and native-V26 Vault timing contracts stay exact and bounded', () => {
	assert.deepEqual(DEFAULT_VAULT_TIMINGS, {
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
	assert.deepEqual(NORMAL_V26_VAULT_TIMINGS, {
		...DEFAULT_VAULT_TIMINGS,
		triggerLock: 637,
		wheel: 1_347,
		locks: 833,
		door: 1_347,
		light: 878,
	});
	const legacyTotal = Object.entries(DEFAULT_VAULT_TIMINGS)
		.filter(([key]) => !key.startsWith('skip'))
		.reduce((sum, [, duration]) => sum + duration, 0);
	const normalV26Total = Object.entries(NORMAL_V26_VAULT_TIMINGS)
		.filter(([key]) => !key.startsWith('skip'))
		.reduce((sum, [, duration]) => sum + duration, 0);
	assert.equal(legacyTotal, 6_140);
	assert.equal(normalV26Total, 7_062);
	assert.equal(MAX_VAULT_CINEMATIC_MS, 7_500);
	assert.ok(normalV26Total <= MAX_VAULT_CINEMATIC_MS);
	assert.equal(DEFAULT_VAULT_TIMINGS.award, 1_500);
	assert.equal(DEFAULT_VAULT_TIMINGS.skipAward, 900);
	const durations = (options) => createVaultCinematicTimeline(options).map((stage) => stage.durationMs);
	assert.deepEqual(durations({}), [637, 1_347, 833, 1_347, 878, 1_500, 520]);
	assert.deepEqual(durations({ direct: true }), [406, 858, 530, 858, 562, 1_500, 406]);
	assert.deepEqual(durations({ turbo: true }), [198, 418, 258, 418, 274, 900, 198]);
	assert.deepEqual(durations({ reducedMotion: true }), [83, 176, 109, 176, 115, 900, 83]);
	for (const options of [
		{},
		{ direct: true },
		{ turbo: true },
		{ reducedMotion: true },
		{ turbo: true, reducedMotion: true },
	]) {
		const timeline = createVaultCinematicTimeline(options);
		const award = timeline.find((stage) => stage.state === VAULT_STATE.AWARD);
		const expectedFloor = options.turbo || options.reducedMotion ? 900 : 1_500;
		assert.ok(award.durationMs >= expectedFloor, JSON.stringify(options));
		assert.ok(timeline.reduce((sum, stage) => sum + stage.durationMs, 0) <= MAX_VAULT_CINEMATIC_MS);
	}
});

test('custom award timings remain fast while preserving ordered semantics', async () => {
	const timeline = createVaultCinematicTimeline({ turbo: true, reducedMotion: true, timings: FAST_TIMINGS });
	assert.equal(timeline.find((stage) => stage.state === VAULT_STATE.AWARD).durationMs, 2);
	assert.equal(VAULT_AWARDED_SPINS, 8);
});

test('player-facing director contract contains no hack, device or scan stages', () => {
	assert.doesNotMatch(directorSource, /hack|device|scan|decrypt|cipher/iu);
	assert.match(pageSource, /'WHEEL TURNS'[\s\S]*'LOCKS RELEASE'[\s\S]*'DOOR OPENS'[\s\S]*'LIGHT ENTERS'[\s\S]*'8 FREE SPINS'[\s\S]*'BLACKOUT STARTS'/u);
	assert.doesNotMatch(pageSource, /OPERATIVE HACK|target scanner|SCANNING REELS/iu);
});

test('feature-start awaits bonus entry before the authoritative first free-spin cue continues', () => {
	const operatorCueStart = pageSource.indexOf('function handleOperatorCue');
	const featureStartSource = pageSource.slice(
		pageSource.indexOf("case 'feature_started':", operatorCueStart),
		pageSource.indexOf("case 'feature_cycle':", operatorCueStart),
	);
	assert.match(featureStartSource, /const cinematicPlay = vaultCinematicDirector\?\.play\(cinematicOptions\)/u);
	assert.match(
		featureStartSource,
		/if \(!devVaultRigEnabled \|\| !devVaultMotionDirector\) return cinematicPlay/u,
	);
	assert.match(featureStartSource, /void devVaultMotionDirector\.play\(cinematicOptions\)/u);
	assert.match(featureStartSource, /return cinematicPlay/u);
	assert.doesNotMatch(featureStartSource, /await devVaultMotionDirector\.play/u);
	assert.match(presentationDirectorSource, /if \(onCue\) await onCue\(cue, this\.state\);/u);
	assert.match(directorSource, /VAULT_STATE\.LIGHT[\s\S]*VAULT_STATE\.AWARD[\s\S]*VAULT_STATE\.BONUS/u);
});

test('cancelling a cinematic resolves its pending presentation promise and clears active state', async () => {
	const director = new VaultCinematicDirector();
	const flow = director.play({ direct: true, targetSymbol: 'q', turbo: true });
	assert.equal(director.cancel('restore-boundary'), true);
	assert.equal(await flow, false);
	assert.equal(director.state.active, false);
	assert.equal(director.state.state, VAULT_STATE.IDLE);
	director.destroy();
});

test('audio cue failures are swallowed and cannot deadlock cinematic completion', async () => {
	const director = new VaultCinematicDirector({
		async onAudioCue() {
			throw new Error('missing vault audio');
		},
		timings: FAST_TIMINGS,
	});
	const completed = await Promise.race([
		director.play({ direct: true, turbo: true, reducedMotion: true }),
		new Promise((_, reject) => setTimeout(() => reject(new Error('cinematic deadlocked')), 2_000)),
	]);
	assert.equal(completed, true);
	assert.equal(director.state.active, false);
	director.destroy();
});

test('Extraction and Return to Base are cosmetic state changes only', () => {
	const audioCues = [];
	const director = new VaultCinematicDirector({ onAudioCue: (cue) => audioCues.push(cue) });
	director.showExtraction({ targetSymbol: 'operative', winRaw: 125, capped: false });
	assert.equal(director.state.state, VAULT_STATE.EXTRACTION);
	assert.equal(director.state.winRaw, 125);
	assert.equal(director.returnToBase(), true);
	assert.equal(director.state.active, false);
	assert.deepEqual(audioCues, ['extraction', 'return-base']);
	director.destroy();
});

test('Replay and restore contexts cannot commit the live loss streak or manufacture a new play', () => {
	assert.match(pageSource, /const suppressOutcome = context\.source === 'live' && context\.origin === 'restore'/u);
	assert.match(pageSource, /if \(roundOrigin === 'play' && liveOutcomeStreak\)/u);
	assert.match(pageSource, /pendingRoundOrigin \?\?= 'restore'/u);
	assert.doesNotMatch(
		pageSource.slice(pageSource.indexOf('function skipVaultCinematic'), pageSource.indexOf('function returnVaultToBase')),
		/(?:executeLivePlay|requestLivePlay|liveSession\.play|replayController\.play)/u,
	);
	assert.doesNotMatch(
		pageSource.slice(pageSource.indexOf('function returnVaultToBase'), pageSource.indexOf('function openAutoDialog')),
		/(?:executeLivePlay|requestLivePlay|liveSession\.play|replayController\.play)/u,
	);
});
