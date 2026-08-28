import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	DEFAULT_DEV_VAULT_MOTION_TIMINGS,
	DEV_VAULT_CUE,
	DEV_VAULT_STAGE,
	DevVaultMotionDirector,
	MAX_DEV_VAULT_MOTION_MS,
	createDevVaultMotionTimeline,
} from '../src/lib/runtime/dev-vault-motion-director.js';

class RafClock {
	constructor({ leakyCancel = false } = {}) {
		this.time = 0;
		this.nextId = 1;
		this.callbacks = new Map();
		this.leakyCancel = leakyCancel;
		this.maxPending = 0;
	}

	request(callback) {
		const id = this.nextId++;
		this.callbacks.set(id, callback);
		this.maxPending = Math.max(this.maxPending, this.callbacks.size);
		return id;
	}

	cancel(id) {
		if (!this.leakyCancel) this.callbacks.delete(id);
	}

	step(deltaMs) {
		this.time += deltaMs;
		const pending = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of pending) callback(this.time);
	}
}

function makeDirector(clock, options = {}) {
	return new DevVaultMotionDirector({
		requestFrame: (callback) => clock.request(callback),
		cancelFrame: (handle) => clock.cancel(handle),
		...options,
	});
}

function drive(clock, director, stepMs = 1000 / 60, limit = 1_000) {
	clock.step(0);
	for (let index = 0; director.snapshot.active && index < limit; index += 1) clock.step(stepMs);
	assert.equal(director.snapshot.active, false, 'motion should complete inside the bounded drive');
}

test('default DEV Vault timeline is semantic, contiguous and bounded before award', () => {
	const timeline = createDevVaultMotionTimeline();
	assert.deepEqual(timeline.stages.map(({ stage }) => stage), [
		'sealed', 'wheel', 'locks', 'door', 'light', 'award',
	]);
	assert.deepEqual(timeline.stages.map(({ cue }) => cue), [
		'vault-notice', 'vault-wheel-turn', 'vault-locks-release',
		'vault-door-open', 'vault-light-entry', 'free-spins-awarded',
	]);
	assert.ok(timeline.motionDurationMs <= MAX_DEV_VAULT_MOTION_MS);
	assert.equal(timeline.motionDurationMs, 4_120);
	assert.equal(timeline.durationMs, 5_620);
	for (let index = 1; index < timeline.stages.length; index += 1) {
		assert.equal(timeline.stages[index].startMs, timeline.stages[index - 1].endMs);
	}

	const capped = createDevVaultMotionTimeline({
		timings: Object.fromEntries(Object.keys(DEFAULT_DEV_VAULT_MOTION_TIMINGS).map((key) => [key, 5_000])),
	});
	assert.equal(capped.motionDurationMs, MAX_DEV_VAULT_MOTION_MS);
});

test('reduced motion uses compact semantic holds instead of a high-rate spatial trajectory', () => {
	const timeline = createDevVaultMotionTimeline({ reducedMotion: true });
	assert.deepEqual(timeline.stages.map(({ durationMs }) => durationMs), [
		83, 176, 109, 176, 115, 900,
	]);
	assert.equal(timeline.motionDurationMs, 659);
	assert.equal(timeline.durationMs, 1_559);
	assert.deepEqual(timeline.stages.map(({ cue }) => cue), Object.values(DEV_VAULT_CUE));

	const directTurbo = createDevVaultMotionTimeline({
		reducedMotion: true,
		turbo: true,
		direct: true,
	});
	assert.equal(directTurbo.stages.at(-1).durationMs, 900, 'award semantics keep a readable hold');
	assert.ok(directTurbo.motionDurationMs < timeline.motionDurationMs);
});

test('one rAF timeline publishes continuous 60Hz progress and exact cue crossings once', async () => {
	const clock = new RafClock();
	const changes = [];
	const cues = [];
	const director = makeDirector(clock, {
		onChange: (snapshot) => changes.push(snapshot),
		onCue: (cue, crossing) => cues.push({ cue, ...crossing }),
	});

	const completion = director.play();
	assert.equal(director.completion, completion);
	drive(clock, director);
	assert.equal(await completion, true);
	assert.equal(clock.maxPending, 1);
	assert.ok(changes.length > 250, 'normal playback should expose real frame-by-frame progress');
	assert.ok(changes.every(({ progress }) => progress >= 0 && progress <= 1));
	for (let index = 1; index < changes.length; index += 1) {
		assert.ok(changes[index].progress >= changes[index - 1].progress);
	}
	assert.deepEqual(cues.map(({ cue }) => cue), Object.values(DEV_VAULT_CUE));
	assert.deepEqual(cues.map(({ stage }) => stage), Object.values(DEV_VAULT_STAGE));
	for (const crossing of cues) {
		assert.equal(crossing.elapsedMs, director.timeline.stages[crossing.stageIndex].startMs);
	}
	assert.equal(director.snapshot.stage, DEV_VAULT_STAGE.AWARD);
	assert.equal(director.snapshot.stageProgress, 1);
	assert.equal(director.snapshot.progress, 1);
	assert.equal(director.snapshot.completed, true);
});

test('pause freezes elapsed time and resume does not absorb the paused wall-clock gap', async () => {
	const clock = new RafClock();
	const director = makeDirector(clock);
	const completion = director.play();
	clock.step(0);
	clock.step(600);
	const frozenElapsed = director.snapshot.elapsedMs;
	assert.equal(director.pause(), true);
	clock.step(10_000);
	assert.equal(director.snapshot.elapsedMs, frozenElapsed);
	assert.equal(director.snapshot.paused, true);
	assert.equal(director.resume(), true);
	clock.step(0);
	clock.step(100);
	assert.equal(director.snapshot.elapsedMs, frozenElapsed + 100);
	assert.equal(director.cancel('test-complete'), true);
	assert.equal(await completion, false);
});

test('skip fast-forwards on the same rAF clock while retaining every semantic crossing and award hold', async () => {
	const clock = new RafClock();
	const cues = [];
	const director = makeDirector(clock, { onCue: (cue) => cues.push(cue) });
	const completion = director.play();
	clock.step(0);
	clock.step(600);
	assert.equal(director.snapshot.stage, DEV_VAULT_STAGE.WHEEL);
	assert.equal(director.skip(), true);
	for (let index = 0; director.snapshot.stage !== DEV_VAULT_STAGE.AWARD && index < 30; index += 1) {
		clock.step(1000 / 60);
	}
	assert.equal(director.snapshot.stage, DEV_VAULT_STAGE.AWARD);
	assert.equal(director.snapshot.skipping, false);
	assert.deepEqual(cues, Object.values(DEV_VAULT_CUE));
	assert.equal(director.skip(), true, 'a second skip can shorten only the award hold');
	drive(clock, director);
	assert.equal(await completion, true);
	assert.deepEqual(cues, Object.values(DEV_VAULT_CUE), 'skip never duplicates cue crossings');
});

test('turbo/reduced rates are continuous and stale generation callbacks cannot mutate a replacement run', async () => {
	const clock = new RafClock({ leakyCancel: true });
	const generations = [];
	const director = makeDirector(clock, { onChange: ({ generation }) => generations.push(generation) });
	const first = director.play();
	clock.step(0);
	clock.step(200);
	const firstGeneration = director.snapshot.generation;
	const second = director.play({ turbo: true });
	const secondGeneration = director.snapshot.generation;
	assert.ok(secondGeneration > firstGeneration);
	assert.equal(await first, false);
	clock.step(0);
	clock.step(100);
	assert.equal(director.snapshot.generation, secondGeneration);
	assert.equal(director.snapshot.elapsedMs, 250);
	assert.equal(director.snapshot.rate, 2.5);
	director.setReducedMotion(true);
	assert.equal(director.snapshot.rate, 1);
	const replacementStart = generations.lastIndexOf(secondGeneration);
	assert.ok(generations.slice(replacementStart).every((generation) => generation === secondGeneration));
	drive(clock, director);
	assert.equal(await second, true);
});

test('DEV controller stays isolated from timers and gameplay authority modules', async () => {
	const source = await readFile(
		new URL('../src/lib/runtime/dev-vault-motion-director.js', import.meta.url),
		'utf8',
	);
	assert.doesNotMatch(source, /setTimeout|setInterval/u);
	assert.doesNotMatch(source, /(?:from|import\()[^\n]*(?:[\\/]math[\\/]|[\\/]rgs[\\/]|wallet)/iu);
	assert.doesNotMatch(source, /^\s*import\s/mu);
});
