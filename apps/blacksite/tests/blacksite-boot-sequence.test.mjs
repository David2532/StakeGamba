import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	BOOT_SEQUENCE_STATE,
	BootSequenceDirector,
} from '../src/lib/runtime/boot-sequence-director.js';

const source = await readFile(
	new URL('../src/lib/runtime/boot-sequence-director.js', import.meta.url),
	'utf8',
);

const FAST_TIMINGS = Object.freeze({
	preloadTimeoutMs: 50,
	skipDelayMs: 15,
	introTimeoutMs: 50,
	introWatchdogBufferMs: 20,
	endFrameHoldMs: 10,
	fallbackHoldMs: 10,
	enteringDurationMs: 10,
});

class FakeClock {
	constructor() {
		this.time = 0;
		this.nextId = 1;
		this.timers = new Map();
	}

	now = () => this.time;

	setTimer = (callback, durationMs) => {
		const id = this.nextId;
		this.nextId += 1;
		this.timers.set(id, {
			callback,
			dueAt: this.time + durationMs,
		});
		return id;
	};

	clearTimer = (id) => {
		this.timers.delete(id);
	};

	tick(durationMs) {
		const target = this.time + durationMs;
		while (true) {
			const next = [...this.timers.entries()]
				.filter(([, timer]) => timer.dueAt <= target)
				.sort(([leftId, left], [rightId, right]) => left.dueAt - right.dueAt || leftId - rightId)[0];
			if (!next) break;
			const [id, timer] = next;
			this.time = timer.dueAt;
			this.timers.delete(id);
			timer.callback();
		}
		this.time = target;
	}
}

function createDirector(options = {}) {
	const clock = new FakeClock();
	const changes = [];
	const director = new BootSequenceDirector({
		onChange: (snapshot) => changes.push(snapshot),
		timings: FAST_TIMINGS,
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
		now: clock.now,
		...options,
	});
	return { clock, changes, director };
}

function statePath(initialState, changes) {
	const states = [initialState, ...changes.map((snapshot) => snapshot.state)];
	return states.filter((state, index) => index === 0 || state !== states[index - 1]);
}

function reachGameReady(director, clock) {
	assert.equal(director.beginPreloading(0), true);
	assert.equal(director.showMissionBriefing('test-bypass'), true);
	assert.equal(director.beginEnteringGame(), true);
	clock.tick(FAST_TIMINGS.enteringDurationMs);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.GAME_READY);
}

test('normal boot follows every guarded state and reports only real asset progress', () => {
	const { clock, changes, director } = createDirector();
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.BOOT);
	assert.equal(director.snapshot.inputLocked, true);

	assert.equal(director.beginPreloading(2), true);
	assert.deepEqual(director.snapshot.preload, {
		total: 2,
		settled: 0,
		loaded: 0,
		failed: 0,
		remaining: 2,
		timedOut: 0,
		fraction: 0,
		percent: 0,
		recordedIds: [],
		failureIds: [],
	});
	clock.tick(12);
	assert.equal(director.snapshot.preload.percent, 0, 'elapsed time must not fake asset progress');

	assert.equal(director.recordAsset('shell', { ok: true }), true);
	assert.equal(director.snapshot.preload.loaded, 1);
	assert.equal(director.snapshot.preload.percent, 50);
	assert.equal(director.recordAsset('symbols', { ok: true }), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.READY_FOR_INTRO);
	assert.equal(director.snapshot.preload.percent, 100);

	assert.equal(director.beginIntro(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	assert.equal(director.showMissionBriefing('intro-skip'), false, 'skip is gated');
	clock.tick(14);
	assert.equal(director.snapshot.skippable, false);
	clock.tick(1);
	assert.equal(director.snapshot.skippable, true);
	assert.equal(director.showMissionBriefing('intro-skip'), true);
	assert.equal(director.beginEnteringGame(), true);
	clock.tick(9);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.ENTERING_GAME);
	assert.equal(director.snapshot.inputLocked, true);
	clock.tick(1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.GAME_READY);
	assert.equal(director.snapshot.inputLocked, false);
	assert.equal(clock.timers.size, 0);

	assert.deepEqual(statePath(BOOT_SEQUENCE_STATE.BOOT, changes), [
		BOOT_SEQUENCE_STATE.BOOT,
		BOOT_SEQUENCE_STATE.PRELOADING,
		BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
		BOOT_SEQUENCE_STATE.INTRO_PLAYING,
		BOOT_SEQUENCE_STATE.MISSION_BRIEFING,
		BOOT_SEQUENCE_STATE.ENTERING_GAME,
		BOOT_SEQUENCE_STATE.GAME_READY,
	]);
	director.destroy();
});

test('the final asset auto-enters READY_FOR_INTRO and explicit finish is guarded and idempotent', () => {
	const { director } = createDirector();
	assert.equal(director.beginPreloading(2), true);
	assert.equal(director.finishPreloading(), false);
	assert.equal(director.readyForIntro(), false);
	assert.equal(director.recordAsset('first', { ok: true }), true);
	assert.equal(director.finishPreloading(), false);
	assert.equal(director.recordAsset('second', { ok: true }), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.READY_FOR_INTRO);
	assert.equal(director.finishPreloading(), true);
	assert.equal(director.readyForIntro(), true);
	director.destroy();
});

test('an ended intro shows the mandatory briefing before entering the game', () => {
	const { clock, director } = createDirector();
	assert.equal(director.beginPreloading(0), true);
	assert.equal(director.beginIntro(), true);
	assert.equal(director.showMissionBriefing('intro-ended'), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(director.gameReady(), false, 'briefing cannot jump directly to GAME_READY');
	assert.equal(director.beginEnteringGame(), true);
	assert.equal(director.gameReady(), true, 'transitionend may complete the bounded entry early');
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.GAME_READY);
	assert.equal(clock.timers.size, 0);
	director.destroy();
});

test('intro unavailable and intro error each expose an error state before bounded fallback', async (context) => {
	for (const scenario of [
		{
			name: 'unavailable',
			state: BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
			trigger: (director) => director.introUnavailable('codec-unavailable'),
		},
		{
			name: 'error',
			state: BOOT_SEQUENCE_STATE.INTRO_ERROR,
			trigger: (director) => director.introError(new Error('decode failed')),
		},
	]) {
		await context.test(scenario.name, () => {
			const { clock, director } = createDirector();
			director.beginPreloading(0);
			director.beginIntro();
			assert.equal(scenario.trigger(director), true);
			assert.equal(director.snapshot.state, scenario.state);
			clock.tick(9);
			assert.equal(director.snapshot.state, scenario.state);
			clock.tick(1);
			assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
			assert.equal(clock.timers.size, 0);
			director.destroy();
		});
	}
});

test('critical asset failure exposes ASSET_ERROR and then falls back to briefing', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(3);
	director.recordAsset('shell', { ok: true });
	assert.equal(director.recordAsset('intro-poster', {
		ok: false,
		critical: true,
		error: new Error('poster decode failed'),
	}), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.ASSET_ERROR);
	assert.equal(director.snapshot.preload.settled, 2);
	assert.equal(director.snapshot.preload.failed, 1);
	assert.equal(director.snapshot.error.message, 'poster decode failed');
	assert.equal(director.recordAsset('late', { ok: true }), false);
	clock.tick(FAST_TIMINGS.fallbackHoldMs);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	director.destroy();
});

test('preload watchdog accounts for missing assets as failures without fabricated progress', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(3);
	director.recordAsset('shell', { ok: true });
	clock.tick(49);
	assert.equal(director.snapshot.preload.settled, 1);
	assert.equal(director.snapshot.preload.percent, 33);
	clock.tick(1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.ASSET_ERROR);
	assert.equal(director.snapshot.preload.settled, 3);
	assert.equal(director.snapshot.preload.failed, 2);
	assert.equal(director.snapshot.preload.timedOut, 2);
	assert.equal(director.snapshot.preload.percent, 100);
	clock.tick(FAST_TIMINGS.fallbackHoldMs);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	director.destroy();
});

test('non-critical asset failure remains truthful but does not block READY_FOR_INTRO', () => {
	const { director } = createDirector();
	director.beginPreloading(2);
	director.recordAsset('optional-grain', {
		ok: false,
		critical: false,
		error: new Error('optional grain missing'),
	});
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.PRELOADING);
	director.recordAsset('shell', { ok: true });
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.READY_FOR_INTRO);
	assert.equal(director.snapshot.preload.loaded, 1);
	assert.equal(director.snapshot.preload.failed, 1);
	assert.deepEqual(director.snapshot.preload.failureIds, ['optional-grain']);
	director.destroy();
});

test('reduced motion and authoritative launch recovery bypass moving video but preserve the mandatory rules screen', async (context) => {
	for (const scenario of [
		{ name: 'reduced motion', options: { reducedMotion: true } },
		{ name: 'replay launch', options: { launchKind: 'replay' } },
		{ name: 'active round restore', options: { activeRound: true } },
	]) {
		await context.test(scenario.name, () => {
			const { director } = createDirector(scenario.options);
			director.beginPreloading(0);
			assert.equal(director.beginIntro(), true);
			assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
			assert.equal(director.snapshot.inputLocked, true);
			assert.equal(director.gameReady(), false, 'rules screen cannot jump directly to GAME_READY');
			director.destroy();
		});
	}
});

test('legacy introEnabled false cannot bypass video on a normal live start', () => {
	const { clock, director } = createDirector({ introEnabled: false });
	director.beginPreloading(0);
	assert.equal(director.beginIntro({ durationSeconds: 10.006 }), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	assert.equal(director.gameReady(), false);
	assert.equal(director.showMissionBriefing('intro-skip'), false, 'Skip remains gated');
	clock.tick(FAST_TIMINGS.skipDelayMs);
	assert.equal(director.showMissionBriefing('intro-skip'), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(director.snapshot.inputLocked, true, 'Skip ends only the video, not the rules screen');
	assert.equal(director.gameReady(), false);
	director.destroy();
});

test('enabling reduced motion during playback ends motion immediately at briefing', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro();
	assert.equal(clock.timers.size, 2);
	assert.equal(director.setReducedMotion(true), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(clock.timers.size, 0);
	director.destroy();
});

test('launch context is current at intro time and a late restore cancels playback for briefing', () => {
	const preloading = createDirector();
	preloading.director.beginPreloading(1);
	assert.equal(preloading.director.setLaunchContext({ launchKind: 'replay' }), true);
	preloading.director.recordAsset('shell', { ok: true });
	assert.equal(preloading.director.snapshot.state, BOOT_SEQUENCE_STATE.READY_FOR_INTRO);
	assert.equal(preloading.director.beginIntro(), true);
	assert.equal(preloading.director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(preloading.director.snapshot.reason, 'restore-detected');
	preloading.director.destroy();

	const playing = createDirector();
	playing.director.beginPreloading(0);
	playing.director.beginIntro({ durationSeconds: 15 });
	assert.equal(playing.director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	assert.equal(playing.clock.timers.size, 2);
	assert.equal(playing.director.setLaunchContext({ activeRound: true }), true);
	assert.equal(playing.director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(playing.director.snapshot.reason, 'restore-detected');
	assert.equal(playing.clock.timers.size, 0);
	playing.director.destroy();
});

test('completed playback holds a still end frame before the mandatory briefing', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro({ durationSeconds: 15 });
	assert.equal(director.completeIntroPlayback(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	assert.equal(director.snapshot.reason, 'intro-ended-end-frame');
	assert.equal(director.snapshot.skippable, false);
	assert.equal(clock.timers.size, 1);
	clock.tick(FAST_TIMINGS.endFrameHoldMs - 1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	clock.tick(1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(clock.timers.size, 0);
	director.destroy();
});

test('intro watchdog enters INTRO_ERROR and performs the bounded fallback', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro();
	clock.tick(FAST_TIMINGS.introTimeoutMs);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_ERROR);
	assert.match(director.snapshot.error.message, /watchdog/u);
	clock.tick(FAST_TIMINGS.fallbackHoldMs);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	director.destroy();
});

test('intro watchdog honors declared manifest duration plus a safe buffer', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro({ durationSeconds: 15 });
	clock.tick(15_019);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
	clock.tick(1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_ERROR);
	assert.match(director.snapshot.error.message, /watchdog/u);
	director.destroy();
});

test('replay intro and reopened mission briefing are available only from GAME_READY', () => {
	const { clock, director } = createDirector();
	assert.equal(director.replayIntro(), false);
	assert.equal(director.openMissionBriefing(), false);
	reachGameReady(director, clock);

	assert.equal(director.replayIntro(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.READY_FOR_INTRO);
	assert.equal(director.snapshot.origin, 'intro-replay');
	assert.equal(director.beginIntro(), true);
	assert.equal(director.showMissionBriefing('intro-ended'), true);
	assert.equal(director.beginEnteringGame(), true);
	clock.tick(FAST_TIMINGS.enteringDurationMs);

	assert.equal(director.openMissionBriefing(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(director.snapshot.origin, 'briefing-reopen');
	assert.equal(director.replayIntro(), false);
	director.destroy();
});

test('duplicate, surplus and out-of-order events cannot bypass guarded transitions', () => {
	const { director } = createDirector();
	assert.equal(director.beginIntro(), false);
	assert.equal(director.beginEnteringGame(), false);
	assert.equal(director.gameReady(), false);
	assert.equal(director.beginPreloading(-1), false);
	assert.equal(director.beginPreloading(1), true);
	assert.equal(director.recordAsset('shell', { ok: true }), true);
	assert.equal(director.recordAsset('shell', { ok: true }), false);
	assert.equal(director.recordAsset('surplus', { ok: true }), false);
	assert.equal(director.snapshot.preload.settled, 1);
	assert.equal(director.gameReady(), false);
	director.destroy();
});

test('reentrant state observers cannot arm timers for a state they already advanced', () => {
	const clock = new FakeClock();
	let director = null;
	director = new BootSequenceDirector({
		onChange: (snapshot) => {
			if (snapshot.state === BOOT_SEQUENCE_STATE.INTRO_PLAYING) {
				director.showMissionBriefing('observer-ended-intro');
			}
			if (snapshot.state === BOOT_SEQUENCE_STATE.ENTERING_GAME) director.gameReady();
		},
		timings: FAST_TIMINGS,
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
		now: clock.now,
	});
	director.beginPreloading(0);
	assert.equal(director.beginIntro(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.MISSION_BRIEFING);
	assert.equal(clock.timers.size, 0);
	assert.equal(director.beginEnteringGame(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.GAME_READY);
	assert.equal(clock.timers.size, 0);
	director.destroy();
});

test('suspension freezes all active deadlines and resumes with exact remaining time', () => {
	const { clock, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro();
	clock.tick(5);
	assert.equal(director.setSuspended(true), true);
	assert.equal(director.snapshot.suspended, true);
	assert.equal(director.snapshot.pendingTimerCount, 2);
	assert.equal(clock.timers.size, 0);
	clock.tick(100);
	assert.equal(director.snapshot.skippable, false);
	assert.equal(director.setSuspended(false), true);
	clock.tick(9);
	assert.equal(director.snapshot.skippable, false);
	clock.tick(1);
	assert.equal(director.snapshot.skippable, true);

	director.showMissionBriefing('intro-skip');
	director.beginEnteringGame();
	clock.tick(3);
	director.setSuspended(true);
	clock.tick(100);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.ENTERING_GAME);
	director.setSuspended(false);
	clock.tick(6);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.ENTERING_GAME);
	clock.tick(1);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.GAME_READY);
	director.destroy();
});

test('reset and destroy cancel timers; destroyed directors ignore late callbacks and events', () => {
	const { clock, changes, director } = createDirector();
	director.beginPreloading(0);
	director.beginIntro();
	assert.equal(clock.timers.size, 2);
	assert.equal(director.reset(), true);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.BOOT);
	assert.equal(clock.timers.size, 0);

	director.beginPreloading(0);
	director.beginIntro();
	const changeCount = changes.length;
	director.destroy();
	assert.equal(clock.timers.size, 0);
	assert.equal(director.snapshot.destroyed, true);
	clock.tick(1_000);
	assert.equal(changes.length, changeCount);
	assert.equal(director.showMissionBriefing('intro-ended'), false);
	assert.equal(director.reset(), false);
	assert.equal(director.snapshot.state, BOOT_SEQUENCE_STATE.INTRO_PLAYING);
});

test('boot director stays DOM-free and uses injected, fully cleared timers', () => {
	assert.doesNotMatch(source, /\b(?:window|document|HTMLElement|HTMLVideoElement)\b/u);
	assert.doesNotMatch(source, /addEventListener|removeEventListener/u);
	assert.doesNotMatch(source, /introEnabled|intro-preference-bypass/u);
	assert.match(source, /setSuspended\(value\)/u);
	assert.match(source, /#clearAllTimers\(\)/u);
});
