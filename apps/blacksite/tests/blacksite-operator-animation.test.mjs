import assert from 'node:assert/strict';
import test from 'node:test';

import {
	FrameDecodeCache,
	OPERATOR_SEQUENCE,
	OperatorAnimationDirector,
} from '../src/lib/runtime/operator-animation-director.js';
import { LiveOutcomeStreakTracker } from '../src/lib/runtime/live-outcome-streak.js';

function sequence(prefix, frames, fps, loop = false) {
	return {
		frames: Array.from({ length: frames }, (_, index) => (
			`/operator/${prefix}_${String(index).padStart(3, '0')}.png`
		)),
		fps,
		loop,
	};
}

function catalog() {
	return {
		idle: sequence('CHAR_IDLE_WATCH', 3, 8, true),
		loss: sequence('CHAR_LOSS_SINGLE', 2, 10),
		lossStreak: sequence('CHAR_LOSS_STREAK', 2, 12),
		win: sequence('CHAR_WIN_HAPPY', 3, 10),
		bigWin: sequence('CHAR_BIG_WIN', 3, 12),
		bonus: sequence('CHAR_BONUS_TOSS', 3, 12),
		rage: sequence('CHAR_RAGE_PC_SMASH', 3, 14),
	};
}

function createFrameClock() {
	let handle = 0;
	const callbacks = new Map();
	return {
		request(callback) {
			handle += 1;
			callbacks.set(handle, callback);
			return handle;
		},
		cancel(id) {
			callbacks.delete(id);
		},
		step(timestamp) {
			const pending = [...callbacks.values()];
			callbacks.clear();
			pending.forEach((callback) => callback(timestamp));
		},
		get pending() {
			return callbacks.size;
		},
	};
}

function resolvedDecodeCache() {
	return {
		decode: async (source) => source,
		clear() {},
	};
}

function createVisibilityDocument() {
	const listeners = new Set();
	return {
		hidden: false,
		visibilityState: 'visible',
		addEventListener(name, listener) {
			if (name === 'visibilitychange') listeners.add(listener);
		},
		removeEventListener(name, listener) {
			if (name === 'visibilitychange') listeners.delete(listener);
		},
		setHidden(hidden) {
			this.hidden = hidden;
			this.visibilityState = hidden ? 'hidden' : 'visible';
			listeners.forEach((listener) => listener());
		},
	};
}

function createDirector(options = {}) {
	const clock = options.clock ?? createFrameClock();
	const director = new OperatorAnimationDirector({
		catalog: catalog(),
		decodeCache: resolvedDecodeCache(),
		requestFrame: (callback) => clock.request(callback),
		cancelFrame: (handle) => clock.cancel(handle),
		documentRef: null,
		motionQuery: null,
		...options,
	});
	return { director, clock };
}

test('catalog rejects lexicographic or incomplete numeric frame ordering', () => {
	assert.throws(
		() => new OperatorAnimationDirector({
			catalog: {
				idle: {
					frames: ['/operator/CHAR_IDLE_WATCH_000.png', '/operator/CHAR_IDLE_WATCH_002.png'],
					fps: 8,
					loop: true,
				},
			},
			decodeCache: resolvedDecodeCache(),
		}),
		/contiguous and numerically ordered/,
	);
});

test('rAF advances only at sequence fps and exposes one visible frame source', async () => {
	const states = [];
	const { director, clock } = createDirector({ onChange: (state) => states.push(state) });
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.WIN);
	clock.step(0);
	clock.step(99);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(100);
	assert.equal(director.snapshot.frameIndex, 1);
	assert.equal(director.snapshot.frameSrc, '/operator/CHAR_WIN_HAPPY_001.png');
	assert.equal(Object.hasOwn(director.snapshot, 'frames'), false);
	assert.equal(states.filter((state) => state.reason === 'frame').length, 1);
	director.destroy();
});

test('reaction keeps the current src visible until its first frame is decoded', async () => {
	let releaseFirstFrame;
	const firstFrameReady = new Promise((resolve) => { releaseFirstFrame = resolve; });
	const decodeCache = {
		decode: (source) => source.endsWith('CHAR_WIN_HAPPY_000.png')
			? firstFrameReady
			: Promise.resolve(source),
		clear() {},
	};
	const { director } = createDirector({ decodeCache });
	director.start();
	const pendingTrigger = director.trigger(OPERATOR_SEQUENCE.WIN);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	releaseFirstFrame();
	assert.equal(await pendingTrigger, true);
	assert.equal(director.snapshot.frameSrc, '/operator/CHAR_WIN_HAPPY_000.png');
	director.destroy();
});

test('surface-managed playback delegates every decode and advances one stable generation', async () => {
	const decoded = [];
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		surfaceManagedDecoding: true,
		decodeCache: {
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	director.start();
	assert.deepEqual(decoded, [], 'mounted surface must be the only automatic decode gate');
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.WIN), true);
	const reactionGeneration = director.snapshot.generation;
	assert.deepEqual(decoded, []);
	clock.step(0);
	clock.step(100);
	assert.equal(director.snapshot.frameIndex, 1);
	assert.equal(director.snapshot.generation, reactionGeneration);
	assert.deepEqual(await director.preload([OPERATOR_SEQUENCE.WIN]), { loaded: 0, failed: 0 });
	assert.deepEqual(decoded, []);
	director.returnToIdle('test_complete');
	assert.ok(director.snapshot.generation > reactionGeneration);
	director.destroy();
});

test('higher-priority reactions interrupt and lower-priority reactions cannot', async () => {
	const { director } = createDirector();
	director.start();
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.WIN, { dedupeKey: 'round:8:win' }), true);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.LOSS), false);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.WIN);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.BONUS), true);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.BONUS);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.WIN), false);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.RAGE), true);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.RAGE);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.RAGE, { dedupeKey: 'round:8:win' }), false);
	director.destroy();
});

test('a presentation-only big win can start after the higher-priority bonus returns idle', async () => {
	const { director, clock } = createDirector();
	director.start();
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.BONUS), true);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.BIG_WIN), false);
	const bonusCompleted = director.waitForIdle({ timeoutMs: 1_000 });
	clock.step(0);
	clock.step(84);
	clock.step(167);
	clock.step(251);
	assert.equal(await bonusCompleted, true);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	assert.equal(await director.trigger(OPERATOR_SEQUENCE.BIG_WIN), true);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.BIG_WIN);
	director.destroy();
});

test('one-shot reaction returns to looping idle after its final frame duration', async () => {
	const { director, clock } = createDirector();
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.LOSS);
	clock.step(0);
	clock.step(100);
	assert.equal(director.snapshot.frameIndex, 1);
	clock.step(200);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	assert.equal(director.snapshot.frameIndex, 0);
	director.destroy();
});

test('bounded completion resolves on idle and returns false on timeout', async () => {
	const timers = new Map();
	let timerId = 0;
	const { director, clock } = createDirector({
		setTimer(callback) {
			timerId += 1;
			timers.set(timerId, callback);
			return timerId;
		},
		clearTimer(handle) { timers.delete(handle); },
	});
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.LOSS);
	const completed = director.waitForIdle({ timeoutMs: 500 });
	clock.step(0);
	clock.step(100);
	clock.step(200);
	assert.equal(await completed, true);
	assert.equal(timers.size, 0);

	await director.trigger(OPERATOR_SEQUENCE.WIN);
	const timedOut = director.waitForIdle({ timeoutMs: 500 });
	assert.equal(timers.size, 1);
	[...timers.values()][0]();
	assert.equal(await timedOut, false);
	director.destroy();
});

test('destroy clears bounded completion timers and resolves waiters false', async () => {
	const timers = new Map();
	let timerId = 0;
	const { director } = createDirector({
		setTimer(callback) {
			timerId += 1;
			timers.set(timerId, callback);
			return timerId;
		},
		clearTimer(handle) { timers.delete(handle); },
	});
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.BIG_WIN);
	const completion = director.waitForIdle({ timeoutMs: 500 });
	director.destroy();
	assert.equal(await completion, false);
	assert.equal(timers.size, 0);
});

test('visibility pauses playback without consuming hidden elapsed time', async () => {
	let now = 0;
	const clock = createFrameClock();
	const documentRef = createVisibilityDocument();
	const { director } = createDirector({ clock, documentRef, now: () => now });
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.WIN);
	clock.step(0);
	now = 50;
	documentRef.setHidden(true);
	assert.equal(clock.pending, 0);
	assert.equal(director.snapshot.paused, true);
	now = 5_000;
	documentRef.setHidden(false);
	clock.step(5_000);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_099);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_100);
	assert.equal(director.snapshot.frameIndex, 1);
	director.destroy();
});

test('external suspension freezes rAF and automatic decode without catching up elapsed time', async () => {
	let now = 0;
	const decoded = [];
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		now: () => now,
		decodeCache: {
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	director.setSuspended(true);
	director.start();
	assert.equal(clock.pending, 0);
	assert.equal(decoded.length, 0, 'suspended startup must not launch a decode window');
	await director.trigger(OPERATOR_SEQUENCE.WIN);
	assert.equal(decoded.length, 1, 'only the required first frame may decode while suspended');
	assert.equal(director.snapshot.frameIndex, 0);
	assert.equal(director.snapshot.paused, true);
	assert.equal(director.snapshot.suspended, true);

	now = 5_000;
	director.setSuspended(false);
	assert.equal(clock.pending, 1);
	clock.step(5_000);
	clock.step(5_099);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_100);
	assert.equal(director.snapshot.frameIndex, 1);
	director.destroy();
	assert.equal(clock.pending, 0);
});

test('visibility and external suspension must both clear before operator playback resumes', async () => {
	const clock = createFrameClock();
	const documentRef = createVisibilityDocument();
	const { director } = createDirector({ clock, documentRef });
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.WIN);
	clock.step(0);
	documentRef.setHidden(true);
	director.setSuspended(true);
	documentRef.setHidden(false);
	assert.equal(director.snapshot.paused, true);
	assert.equal(clock.pending, 0);
	director.setSuspended(false);
	assert.equal(director.snapshot.paused, false);
	assert.equal(clock.pending, 1);
	director.destroy();
});

test('reduced motion shows a final keypose briefly, then returns to static idle', async () => {
	let now = 0;
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		now: () => now,
		reducedMotion: true,
		reducedMotionHoldMs: 150,
	});
	director.start();
	assert.equal(clock.pending, 0);
	await director.trigger(OPERATOR_SEQUENCE.BIG_WIN);
	assert.equal(director.snapshot.frameIndex, 2);
	assert.equal(clock.pending, 1);
	now = 149;
	clock.step(149);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.BIG_WIN);
	now = 150;
	clock.step(150);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	assert.equal(director.snapshot.frameIndex, 0);
	assert.equal(clock.pending, 0);
	director.destroy();
});

test('explicit full-motion operator overrides a reduced-motion host and advances decoded idle frames', async () => {
	const decoded = [];
	const states = [];
	const clock = createFrameClock();
	const motionQuery = {
		matches: true,
		addEventListener() {},
		removeEventListener() {},
	};
	const { director } = createDirector({
		clock,
		motionQuery,
		reducedMotion: false,
		decodeCache: {
			async decode(source) { decoded.push(source); },
			clear() {},
		},
		onChange: (state) => states.push(state),
	});
	director.start();
	clock.step(0);
	clock.step(125);
	clock.step(250);
	clock.step(375);
	await new Promise((resolve) => setImmediate(resolve));

	assert.equal(director.snapshot.reducedMotion, false);
	assert.deepEqual(
		[...new Set(states.filter(({ sequence }) => sequence === OPERATOR_SEQUENCE.IDLE).map(({ frameIndex }) => frameIndex))],
		[0, 1, 2],
	);
	assert.ok(new Set(decoded).size >= 3);
	director.destroy();
});

test('full-motion override remains paused while the compact viewport suspends the operator', async () => {
	const decoded = [];
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		motionQuery: { matches: true, addEventListener() {}, removeEventListener() {} },
		reducedMotion: false,
		decodeCache: {
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	director.setSuspended(true);
	director.start();
	clock.step(0);
	clock.step(1_000);
	await new Promise((resolve) => setImmediate(resolve));

	assert.equal(director.snapshot.reducedMotion, false);
	assert.equal(director.snapshot.suspended, true);
	assert.equal(director.snapshot.paused, true);
	assert.equal(director.snapshot.frameIndex, 0);
	assert.equal(clock.pending, 0);
	assert.deepEqual(decoded, []);
	director.destroy();
});

test('decode cache remains bounded and refreshes least-recently-used entries', async () => {
	const cache = new FrameDecodeCache({
		maxEntries: 2,
		imageFactory: () => ({ decode: async () => {} }),
	});
	await cache.decode('/a.png');
	await cache.decode('/b.png');
	await cache.decode('/a.png');
	await cache.decode('/c.png');
	assert.equal(cache.size, 2);
	assert.equal(cache.has('/a.png'), true);
	assert.equal(cache.has('/b.png'), false);
	assert.equal(cache.has('/c.png'), true);
});

test('a missing active reaction frame falls back to idle without throwing into game flow', async () => {
	const errors = [];
	const decodeCache = {
		decode(source) {
			return source.includes('CHAR_WIN_HAPPY')
				? Promise.reject(new Error('missing frame'))
				: Promise.resolve(source);
		},
		clear() {},
	};
	const { director } = createDirector({ decodeCache, onError: (error) => errors.push(error.message) });
	director.start();
	await director.trigger(OPERATOR_SEQUENCE.WIN);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	assert.match(director.snapshot.reason, /fallback/);
	assert.ok(errors.includes('missing frame'));
	director.destroy();
});

test('idle loop skips a frame that predecode marked unavailable', async () => {
	const clock = createFrameClock();
	const decodeCache = {
		decode(source) {
			return source.endsWith('_001.png')
				? Promise.reject(new Error('missing idle frame'))
				: Promise.resolve(source);
		},
		clear() {},
	};
	const { director } = createDirector({ clock, decodeCache, decodeAhead: 2 });
	director.start();
	await new Promise((resolve) => setImmediate(resolve));
	clock.step(0);
	clock.step(125);
	assert.equal(director.snapshot.sequence, OPERATOR_SEQUENCE.IDLE);
	assert.equal(director.snapshot.frameIndex, 2);
	assert.equal(director.snapshot.frameSrc, '/operator/CHAR_IDLE_WATCH_002.png');
	director.destroy();
});

test('finalized zero outcomes escalate but rage remains disabled by default', () => {
	const tracker = new LiveOutcomeStreakTracker();
	const reactions = Array.from({ length: 12 }, (_, index) => (
		tracker.commit({ dedupeToken: `live:${index + 1}`, payoutRaw: 0 }).reaction
	));
	assert.deepEqual(reactions, [
		OPERATOR_SEQUENCE.LOSS,
		OPERATOR_SEQUENCE.LOSS,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
		OPERATOR_SEQUENCE.LOSS_STREAK,
	]);
	assert.deepEqual(tracker.snapshot, { zeroStreak: 12, committedRounds: 12 });
});

test('rage can be enabled only through the explicit presentation feature flag', () => {
	const tracker = new LiveOutcomeStreakTracker({ rageEnabled: true });
	const reactions = Array.from({ length: 12 }, (_, index) => (
		tracker.commit({ dedupeToken: `flagged:${index + 1}`, payoutRaw: 0 }).reaction
	));
	assert.equal(reactions[5], OPERATOR_SEQUENCE.RAGE);
	assert.equal(reactions[11], OPERATOR_SEQUENCE.RAGE);
	assert.equal(reactions.filter((reaction) => reaction === OPERATOR_SEQUENCE.RAGE).length, 2);
});

test('duplicate finalized-round token cannot mutate or retrigger a loss streak', () => {
	const tracker = new LiveOutcomeStreakTracker();
	tracker.commit({ dedupeToken: 'book:44', payoutRaw: 0 });
	const duplicate = tracker.commit({ dedupeToken: 'book:44', payoutRaw: 0 });
	assert.deepEqual(duplicate, {
		accepted: false,
		duplicate: true,
		reaction: null,
		zeroStreak: 1,
		committedRounds: 1,
	});
	assert.deepEqual(tracker.snapshot, { zeroStreak: 1, committedRounds: 1 });
});

test('a positive finalized outcome resets the streak before the next zero', () => {
	const tracker = new LiveOutcomeStreakTracker();
	tracker.commit({ dedupeToken: 1, payoutRaw: 0 });
	tracker.commit({ dedupeToken: 2, payoutRaw: 0 });
	tracker.commit({ dedupeToken: 3, payoutRaw: 0 });
	const win = tracker.commit({ dedupeToken: 4, payoutRaw: 25 });
	assert.equal(win.reaction, null);
	assert.equal(win.zeroStreak, 0);
	const nextLoss = tracker.commit({ dedupeToken: 5, payoutRaw: 0 });
	assert.equal(nextLoss.reaction, OPERATOR_SEQUENCE.LOSS);
	assert.equal(nextLoss.zeroStreak, 1);
});

test('invalid commits fail before mutating finalized-round state', () => {
	const tracker = new LiveOutcomeStreakTracker();
	assert.throws(() => tracker.commit({ dedupeToken: '', payoutRaw: 0 }), /dedupeToken/);
	assert.throws(() => tracker.commit({ dedupeToken: 'live:1', payoutRaw: -1 }), /payoutRaw/);
	assert.deepEqual(tracker.snapshot, { zeroStreak: 0, committedRounds: 0 });
});

test('finalized-round dedupe memory stays within its rolling bound', () => {
	const tracker = new LiveOutcomeStreakTracker({ dedupeLimit: 3 });
	for (let index = 0; index < 20; index += 1) {
		tracker.commit({ dedupeToken: `live:${index}`, payoutRaw: index % 2 });
	}
	assert.equal(tracker.dedupeSize, 3);
	assert.equal(tracker.snapshot.committedRounds, 20);
	assert.equal(tracker.commit({ dedupeToken: 'live:19', payoutRaw: 0 }).accepted, false);
	assert.equal(tracker.snapshot.committedRounds, 20);
});
