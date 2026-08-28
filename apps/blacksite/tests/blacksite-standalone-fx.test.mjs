import assert from 'node:assert/strict';
import test from 'node:test';

import {
	StandaloneFxDecodeCache,
	StandaloneFxDirector,
} from '../src/lib/runtime/standalone-fx-director.js';

function effect(prefix, frameCount, fps, loop = false, priority = undefined) {
	return {
		id: prefix,
		frames: Array.from({ length: frameCount }, (_, index) => (
			`/fx/${prefix}_${String(index).padStart(3, '0')}.png`
		)),
		fps,
		loop,
		priority,
	};
}

function catalog() {
	return {
		bonusCratePulse: effect('BONUS_CRATE_PULSE', 3, 10, true),
		bonusCrateSpin: effect('BONUS_CRATE_SPIN', 3, 10, true),
		winFlash: effect('FX_WIN_FLASH', 3, 10),
		coinBurst: effect('FX_COIN_BURST', 3, 10),
		screenImpact: effect('FX_SCREEN_IMPACT', 3, 10),
	};
}

function keyposes() {
	return {
		bonusCrate: { frames: ['/keypose/BONUS_CRATE_STATIC.png'] },
		win: { frames: ['/keypose/CHAR_POSE_WIN_HAPPY.png'] },
		rage: { frames: ['/keypose/CHAR_POSE_RAGE_PC_SMASH.png'] },
	};
}

function createFrameClock() {
	let handle = 0;
	let currentTime = 0;
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
			currentTime = timestamp;
			const pending = [...callbacks.values()];
			callbacks.clear();
			pending.forEach((callback) => callback(timestamp));
		},
		now: () => currentTime,
		get pending() {
			return callbacks.size;
		},
	};
}

function createVisibilityDocument() {
	const listeners = new Set();
	return {
		hidden: false,
		visibilityState: 'visible',
		addEventListener(name, callback) {
			if (name === 'visibilitychange') listeners.add(callback);
		},
		removeEventListener(name, callback) {
			if (name === 'visibilitychange') listeners.delete(callback);
		},
		setHidden(hidden) {
			this.hidden = hidden;
			this.visibilityState = hidden ? 'hidden' : 'visible';
			listeners.forEach((callback) => callback());
		},
	};
}

function resolvedCache() {
	return { maxEntries: 8, decode: async (source) => source, clear() {} };
}

function createDirector(options = {}) {
	const clock = options.clock ?? createFrameClock();
	const director = new StandaloneFxDirector({
		catalog: catalog(),
		keyposes: keyposes(),
		decodeCache: resolvedCache(),
		requestFrame: (callback) => clock.request(callback),
		cancelFrame: (handle) => clock.cancel(handle),
		now: clock.now,
		documentRef: null,
		motionQuery: null,
		...options,
	});
	return { director, clock };
}

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

test('default runtime consumes the package-safe OPERATOR_FX_CATALOG', async () => {
	const director = new StandaloneFxDirector({
		decodeCache: resolvedCache(),
		documentRef: null,
		motionQuery: null,
		requestFrame: () => 1,
		cancelFrame: () => {},
	});
	assert.equal(await director.trigger('coinBurst'), true);
	assert.match(
		director.snapshot.frameSrc,
		/assets\/blacksite\/runtime-rgba-v1\/standalone_fx\/FX_COIN_BURST\/rgba\/FX_COIN_BURST_000\.webp$/u,
	);
	director.destroy();
});

test('catalog rejects non-contiguous numeric manifest ordering', () => {
	assert.throws(() => new StandaloneFxDirector({
		catalog: {
			winFlash: {
				frames: ['/fx/FX_WIN_FLASH_000.png', '/fx/FX_WIN_FLASH_002.png'],
				fps: 15,
				loop: false,
			},
		},
		keyposes: keyposes(),
		decodeCache: resolvedCache(),
		documentRef: null,
		motionQuery: null,
	}), /contiguous and numerically ordered/);
});

test('single-img snapshot exposes exactly one decoded current frame in rAF/FPS order', async () => {
	const decoded = new Set();
	const cache = {
		maxEntries: 8,
		async decode(source) { decoded.add(source); },
		clear() {},
	};
	const { director, clock } = createDirector({ decodeCache: cache });
	assert.deepEqual(Object.keys(director.snapshot), ['active', 'name', 'frameIndex', 'frameSrc', 'generation']);
	assert.equal(await director.trigger('winFlash'), true);
	assert.equal(decoded.has(director.snapshot.frameSrc), true, 'visible src must already be decoded');
	clock.step(0);
	clock.step(99);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(100);
	await flush();
	assert.equal(director.snapshot.frameIndex, 1);
	assert.equal(director.snapshot.frameSrc, '/fx/FX_WIN_FLASH_001.png');
	assert.equal(decoded.has(director.snapshot.frameSrc), true);
	assert.equal(Object.hasOwn(director.snapshot, 'frames'), false);
	director.destroy();
});

test('surface-managed FX delegates decoding and keeps one generation for every emitted frame', async () => {
	const decoded = [];
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		surfaceManagedDecoding: true,
		decodeCache: {
			maxEntries: 8,
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	assert.equal(await director.trigger('winFlash'), true);
	const effectGeneration = director.snapshot.generation;
	assert.deepEqual(decoded, [], 'mounted FX surface must be the only automatic decode gate');
	clock.step(0);
	clock.step(100);
	assert.equal(director.snapshot.frameIndex, 1);
	assert.equal(director.snapshot.generation, effectGeneration);
	assert.deepEqual(await director.preload(['winFlash']), { loaded: 0, failed: 0 });
	assert.deepEqual(decoded, []);
	director.stop();
	assert.ok(director.snapshot.generation > effectGeneration);
	director.destroy();
});

test('decode cache is hard-capped at eight frames with LRU eviction', async () => {
	assert.throws(() => new StandaloneFxDecodeCache({ maxEntries: 9 }), /cannot exceed 8/);
	const cache = new StandaloneFxDecodeCache({
		maxEntries: 8,
		imageFactory: () => ({ decode: async () => {} }),
	});
	for (let index = 0; index < 10; index += 1) await cache.decode(`/fx/frame-${index}.png`);
	assert.equal(cache.size, 8);
	assert.equal(cache.has('/fx/frame-0.png'), false);
	assert.equal(cache.has('/fx/frame-9.png'), true);
});

test('impact interrupts coin, coin blocks win, and win blocks bonus', async () => {
	const { director } = createDirector();
	assert.equal(await director.trigger('bonusCratePulse'), true);
	assert.equal(await director.trigger('winFlash'), true);
	assert.equal(await director.trigger('bonusCrateSpin'), false);
	assert.equal(await director.trigger('coinBurst'), true);
	assert.equal(await director.trigger('winFlash'), false);
	assert.equal(await director.trigger('screenImpact'), true);
	assert.equal(await director.trigger('coinBurst'), false);
	assert.equal(director.snapshot.name, 'screenImpact');
	director.destroy();
});

test('one-shot displays its final frame for one frame duration then becomes invisible', async () => {
	const { director, clock } = createDirector();
	await director.trigger('winFlash');
	clock.step(0);
	clock.step(100);
	await flush();
	clock.step(200);
	await flush();
	assert.equal(director.snapshot.frameIndex, 2);
	clock.step(300);
	assert.deepEqual(director.snapshot, {
		active: false, name: null, frameIndex: -1, frameSrc: null, generation: 2,
	});
	director.destroy();
});

test('loop remains opt-in, preload stays invisible, and stop is explicit', async () => {
	const { director, clock } = createDirector();
	const preload = await director.preload(['bonusCratePulse']);
	assert.equal(preload.failed, 0);
	assert.equal(director.snapshot.active, false);
	await director.trigger('bonusCratePulse');
	clock.step(0);
	for (const timestamp of [100, 200, 300, 400]) {
		clock.step(timestamp);
		await flush();
	}
	assert.equal(director.snapshot.active, true);
	assert.equal(director.snapshot.name, 'bonusCratePulse');
	director.stop();
	assert.equal(director.snapshot.active, false);
	assert.equal(clock.pending, 0);
	director.destroy();
});

test('reduced motion decodes the matching static keypose and hides one-shots after 150ms', async () => {
	const decoded = [];
	const { director, clock } = createDirector({
		reducedMotion: true,
		decodeCache: {
			maxEntries: 8,
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	await director.trigger('screenImpact');
	assert.equal(director.snapshot.frameSrc, '/keypose/CHAR_POSE_RAGE_PC_SMASH.png');
	assert.equal(decoded.at(-1), director.snapshot.frameSrc);
	clock.step(0);
	clock.step(149);
	assert.equal(director.snapshot.active, true);
	clock.step(150);
	assert.equal(director.snapshot.active, false);

	await director.trigger('bonusCratePulse');
	assert.equal(director.snapshot.frameSrc, '/keypose/BONUS_CRATE_STATIC.png');
	assert.equal(clock.pending, 0, 'reduced-motion loops remain static until explicit stop');
	director.stop();
	director.destroy();
});

test('visibility pauses without consuming one-shot frame time', async () => {
	const clock = createFrameClock();
	const documentRef = createVisibilityDocument();
	const { director } = createDirector({ clock, documentRef });
	await director.trigger('winFlash');
	clock.step(0);
	documentRef.setHidden(true);
	assert.equal(clock.pending, 0);
	clock.step(5_000);
	assert.equal(director.snapshot.frameIndex, 0);
	documentRef.setHidden(false);
	clock.step(5_000);
	clock.step(5_099);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_100);
	await flush();
	assert.equal(director.snapshot.frameIndex, 1);
	director.destroy();
});

test('external suspension freezes FX rAF and bounded decode until a fresh resume clock starts', async () => {
	const decoded = [];
	const clock = createFrameClock();
	const { director } = createDirector({
		clock,
		decodeCache: {
			maxEntries: 8,
			async decode(source) { decoded.push(source); },
			clear() {},
		},
	});
	director.setSuspended(true);
	await director.trigger('winFlash');
	assert.equal(decoded.length, 1, 'only the required first frame may decode while suspended');
	assert.equal(clock.pending, 0);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_000);
	assert.equal(director.snapshot.frameIndex, 0);

	director.setSuspended(false);
	assert.equal(clock.pending, 1);
	clock.step(5_000);
	clock.step(5_099);
	assert.equal(director.snapshot.frameIndex, 0);
	clock.step(5_100);
	await flush();
	assert.equal(director.snapshot.frameIndex, 1);
	director.destroy();
	assert.equal(clock.pending, 0);
});

test('visibility and external suspension must both clear before FX playback resumes', async () => {
	const clock = createFrameClock();
	const documentRef = createVisibilityDocument();
	const { director } = createDirector({ clock, documentRef });
	await director.trigger('winFlash');
	clock.step(0);
	documentRef.setHidden(true);
	director.setSuspended(true);
	documentRef.setHidden(false);
	assert.equal(clock.pending, 0);
	assert.equal(director.snapshot.frameIndex, 0);
	director.setSuspended(false);
	assert.equal(clock.pending, 1);
	director.destroy();
});

test('missing or visibly failed assets fail closed to an invisible snapshot', async () => {
	const errors = [];
	const { director } = createDirector({
		decodeCache: {
			maxEntries: 8,
			decode(source) {
				return source.endsWith('_000.png')
					? Promise.reject(new Error('missing FX frame'))
					: Promise.resolve(source);
			},
			clear() {},
		},
		onError: (error) => errors.push(error.message),
	});
	assert.equal(await director.trigger('coinBurst'), false);
	assert.equal(director.snapshot.active, false);
	assert.ok(errors.includes('missing FX frame'));

	const healthy = createDirector();
	await healthy.director.trigger('winFlash');
	assert.equal(healthy.director.reportFrameError(), true);
	assert.equal(healthy.director.snapshot.active, false);
	healthy.director.destroy();
	director.destroy();
});
