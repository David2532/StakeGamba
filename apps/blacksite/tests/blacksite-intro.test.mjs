import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configUrl = new URL('../src/lib/runtime/intro-config.js', import.meta.url);
const controllerUrl = new URL('../src/lib/runtime/intro-controller.js', import.meta.url);
const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const introComponentUrl = new URL('../src/lib/components/BootIntro.svelte', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

function createClock() {
	let now = 0;
	let nextId = 1;
	const tasks = new Map();
	return {
		setTimer(callback, delay) {
			const id = nextId++;
			tasks.set(id, { at: now + delay, callback });
			return id;
		},
		clearTimer(id) {
			tasks.delete(id);
		},
		advanceTo(target) {
			while (true) {
				const next = [...tasks.entries()]
					.filter(([, task]) => task.at <= target)
					.sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
				if (!next) break;
				const [id, task] = next;
				tasks.delete(id);
				now = task.at;
				task.callback();
			}
			now = target;
		},
		get size() {
			return tasks.size;
		},
	};
}

test('boot intro config locks the normal and turbo beat contracts', async () => {
	const { BOOT_INTRO_PROFILES, BOOT_INTRO_VERSION, INTRO_SEEN_KEY } = await import(configUrl.href);
	assert.equal(BOOT_INTRO_VERSION, 1);
	assert.equal(INTRO_SEEN_KEY, 'blacksite.boot-intro.v1.seen');
	assert.deepEqual(BOOT_INTRO_PROFILES.normal, {
		durationMs: 4_000,
		watchdogMs: 4_250,
		beats: [
			{ id: 'wake', atMs: 0 },
			{ id: 'scan', atMs: 350 },
			{ id: 'title', atMs: 1_200 },
			{ id: 'breach', atMs: 2_200 },
			{ id: 'resolve', atMs: 3_200 },
		],
	});
	assert.deepEqual(BOOT_INTRO_PROFILES.turbo, {
		durationMs: 1_200,
		watchdogMs: 1_450,
		beats: [
			{ id: 'wake', atMs: 0 },
			{ id: 'scan', atMs: 100 },
			{ id: 'title', atMs: 300 },
			{ id: 'breach', atMs: 600 },
			{ id: 'resolve', atMs: 900 },
		],
	});
});

test('boot intro eligibility is presentation-only and fails open for storage errors', async () => {
	const { introEligibility, readIntroSeen, writeIntroSeen } = await import(configUrl.href);
	assert.deepEqual(
		introEligibility({ launchKind: 'live', activeRound: false, reducedMotion: false, seen: false, motionMode: 'normal' }),
		{ play: true, profile: 'normal', reason: null },
	);
	assert.deepEqual(
		introEligibility({ launchKind: 'live', activeRound: false, reducedMotion: false, seen: false, motionMode: 'turbo' }),
		{ play: true, profile: 'turbo', reason: null },
	);
	for (const [input, reason] of [
		[{ launchKind: 'replay' }, 'replay'],
		[{ launchKind: 'fixture' }, 'fixture'],
		[{ launchKind: 'error' }, 'launch-error'],
		[{ launchKind: 'live', activeRound: true }, 'active-round-restore'],
		[{ launchKind: 'live', reducedMotion: true }, 'reduced-motion'],
		[{ launchKind: 'live', seen: true }, 'seen'],
	]) {
		assert.equal(introEligibility(input).reason, reason);
		assert.equal(introEligibility(input).play, false);
	}
	const throwingStorage = {
		getItem() {
			throw new Error('denied');
		},
		setItem() {
			throw new Error('denied');
		},
	};
	assert.equal(readIntroSeen(throwingStorage), false);
	assert.equal(writeIntroSeen(throwingStorage), false);
});

test('IntroController completes exact normal beats once and clears every timer', async () => {
	const { IntroController } = await import(controllerUrl.href);
	const clock = createClock();
	const states = [];
	const controller = new IntroController({
		onState: (state) => states.push(`${state.status}:${state.beat ?? '-'}`),
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
	});
	const completion = controller.playBoot('normal');
	assert.equal(controller.snapshot().beat, 'wake');
	clock.advanceTo(350);
	clock.advanceTo(1_200);
	clock.advanceTo(2_200);
	clock.advanceTo(3_200);
	clock.advanceTo(4_000);
	const terminal = await completion;
	assert.deepEqual(states, [
		'playing:wake',
		'playing:scan',
		'playing:title',
		'playing:breach',
		'playing:resolve',
		'completed:resolve',
	]);
	assert.equal(terminal.dismissReason, 'natural');
	assert.equal(clock.size, 0);
	assert.equal(controller.activeTimerCount, 0);
});

test('IntroController supports exact turbo timing, idempotent skip, bypass and teardown', async () => {
	const { IntroController } = await import(controllerUrl.href);
	const clock = createClock();
	const controller = new IntroController({
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
	});
	const completion = controller.playBoot('turbo');
	clock.advanceTo(900);
	assert.equal(controller.snapshot().beat, 'resolve');
	const skipped = await controller.skip('player');
	assert.equal(skipped.status, 'skipped');
	assert.equal(skipped.dismissReason, 'player');
	assert.equal(await controller.skip('player'), skipped);
	assert.equal(await completion, skipped);
	assert.equal(clock.size, 0);

	controller.reset();
	assert.equal((await controller.bypass('reduced-motion')).status, 'bypassed');
	controller.reset();
	const pending = controller.playBoot('normal');
	assert.equal((await controller.destroy()).status, 'destroyed');
	assert.equal(await pending, controller.snapshot());
	clock.advanceTo(5_000);
	assert.equal(controller.snapshot().status, 'destroyed');
});

test('IntroController fails playable when scheduling infrastructure is unavailable', async () => {
	const { IntroController } = await import(controllerUrl.href);
	const controller = new IntroController({
		setTimer() {
			throw new Error('timer unavailable');
		},
		clearTimer() {},
	});
	const terminal = await controller.playBoot('normal');
	assert.equal(terminal.status, 'completed');
	assert.equal(terminal.dismissReason, 'scheduler-fallback');
	assert.equal(controller.activeTimerCount, 0);
});

test('player and exact-package QA bind intro blocking, skip and bypass paths', async () => {
	const [page, component, browserQa] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(introComponentUrl, 'utf8'),
		readFile(browserQaUrl, 'utf8'),
	]);
	assert.match(page, /introEligibility/u);
	assert.match(page, /introBlocking/u);
	assert.match(page, /active-round-restore/u);
	assert.match(page, /reduced-motion/u);
	assert.match(page, /launch\.kind === 'replay'[\s\S]*bypassIntro/u);
	assert.match(component, /data-testid="boot-intro"/u);
	assert.match(component, /data-testid="skip-intro"/u);
	assert.match(component, />SKIP INTRO</u);
	assert.match(browserQa, /boot-intro-full-fresh-live/u);
	assert.match(browserQa, /boot-intro-skip-mobile/u);
	assert.match(browserQa, /boot intro never issues a wallet write/u);
});
