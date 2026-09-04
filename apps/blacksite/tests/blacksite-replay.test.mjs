import assert from 'node:assert/strict';
import test from 'node:test';
import { getMode } from '../src/lib/contracts/modes.js';
import { getFixture } from '../src/lib/fixtures/catalog.generated.js';
import { GameEventAdapter } from '../src/lib/runtime/game-event-adapter.js';
import { ReplayClientError, createReplayClient } from '../src/lib/replay/client.js';
import { ReplayController } from '../src/lib/replay/controller.js';
import {
	MAX_PACKAGE_PAYOUT_CENTI_X,
	assertReplayWalletMicroUnitsAbsent,
	normalizePackagePayoutCentiX,
	normalizeReplayQueryAmountUnitsRaw,
	normalizeReplayResponseMultiplierX,
	replayQueryUnitsTimesCentiX,
	replayQueryUnitsTimesInteger,
	replayResponseMultiplierXToCentiX,
} from '../src/lib/replay/money-domains.js';
import { createReplayNormalizer } from '../src/lib/replay/normalizer.js';

const clone = (value) => structuredClone(value);

function launch(overrides = {}) {
	return {
		kind: 'replay',
		game: 'blacksite_breach',
		version: '0.1.0-m1',
		mode: 'base',
		event: '0',
		rgsUrl: 'https://rgs.example',
		currency: 'XSC',
		amountUnitsRaw: '000001.2500',
		language: 'en',
		device: 'desktop',
		social: true,
		...overrides,
	};
}

function eventsForMode(mode = 'base') {
	const fixture = getFixture(`${mode}_zero`);
	assert(fixture, `missing canonical zero fixture for ${mode}`);
	return clone(fixture.book.events);
}

function replayPayload(mode = 'base', overrides = {}) {
	return {
		payoutMultiplier: 0,
		costMultiplier: getMode(mode).costMultiplier,
		state: { events: eventsForMode(mode) },
		...overrides,
	};
}

function adapter(spy = null) {
	const gameEventAdapter = new GameEventAdapter();
	if (!spy) return gameEventAdapter;
	return {
		adaptRoundEvents(events, options) {
			spy(events, options);
			return gameEventAdapter.adaptRoundEvents(events, options);
		},
	};
}

function normalizer(spy = null) {
	return createReplayNormalizer({ gameEventAdapter: adapter(spy) });
}

function httpResponse(body, { ok = true, status = 200 } = {}) {
	return {
		ok,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
	};
}

test('money domains preserve Replay amount opacity and reject cross-domain ambiguity', () => {
	assert.equal(normalizeReplayQueryAmountUnitsRaw('000001.2500'), '000001.2500');
	assert.equal(normalizeReplayQueryAmountUnitsRaw(null), null);
	assert.throws(() => normalizeReplayQueryAmountUnitsRaw(1_250_000), /opaque string/);
	assert.throws(() => normalizeReplayQueryAmountUnitsRaw('   '), /opaque string/);

	for (const multiplier of [0, 0.29, 1, 1.2, 10_000]) {
		assert.equal(normalizeReplayResponseMultiplierX(multiplier), multiplier);
	}
	for (const invalid of [-1, Infinity, NaN, '1.25', 0.001]) {
		assert.throws(() => normalizeReplayResponseMultiplierX(invalid));
	}
	assert.equal(replayResponseMultiplierXToCentiX(0.29), 29);
	assert.equal(replayResponseMultiplierXToCentiX(10_000), MAX_PACKAGE_PAYOUT_CENTI_X);
	assert.equal(normalizePackagePayoutCentiX(MAX_PACKAGE_PAYOUT_CENTI_X), 1_000_000);
	assert.throws(() => normalizePackagePayoutCentiX(1_000_001));
	assert.equal(assertReplayWalletMicroUnitsAbsent(undefined), null);
	assert.throws(() => assertReplayWalletMicroUnitsAbsent(1), /must not contain or infer/);
	assert.equal(replayQueryUnitsTimesInteger('0.0496', 80), '3.968');
	assert.equal(replayQueryUnitsTimesCentiX('0.0496', 29), '0.014384');
	assert.equal(replayQueryUnitsTimesCentiX('1.2500', 0), '0');
	assert.equal(replayQueryUnitsTimesInteger(null, 80), null);
});

test('Replay client exposes one read-only method and emits the exact safe GET', async () => {
	const calls = [];
	const client = createReplayClient({
		fetchImpl: async (url, options) => {
			calls.push({ url, options });
			return httpResponse(replayPayload());
		},
	});
	assert.deepEqual(Object.keys(client), ['fetchRound', 'abortPending']);
	for (const forbidden of ['authenticate', 'play', 'endRound', 'saveEvent']) {
		assert.equal(client[forbidden], undefined);
	}

	await client.fetchRound(
		launch({
			version: '0.1.0-m2',
			event: 'event-0_qa~1',
			rgsUrl: 'https://rgs.example/root/',
			language: 'sweeps en',
		}),
	);
	assert.equal(calls.length, 1);
	assert.equal(
		calls[0].url,
		'https://rgs.example/root/bet/replay/blacksite_breach/0.1.0-m2/base/event-0_qa~1',
	);
	assert.equal(calls[0].options.method, 'GET');
	assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
	assert.equal(calls[0].options.credentials, 'omit');
	assert.equal(calls[0].options.redirect, 'error');
	assert.equal(Object.hasOwn(calls[0].options, 'body'), false);
	assert(calls[0].options.signal instanceof AbortSignal);
});

test('Replay client rejects unsafe path segments before fetch and preserves safe dotted identity', async () => {
	const urls = [];
	const client = createReplayClient({
		fetchImpl: async (url) => {
			urls.push(url);
			return httpResponse(replayPayload());
		},
	});

	for (const field of ['version', 'event']) {
		for (const unsafeSegment of [
			'.',
			'..',
			'%2E',
			'%2e%2E',
			'%252E%252E',
			'../admin',
			'..%2fadmin',
			'event/child',
			'event%2fchild',
			'event\\child',
			'event?query',
			'event#fragment',
		]) {
			await assert.rejects(
				client.fetchRound(launch({ [field]: unsafeSegment })),
				(error) => error instanceof ReplayClientError && error.code === 'REPLAY_REQUEST_INVALID',
			);
		}
	}
	assert.deepEqual(urls, []);

	await client.fetchRound(
		launch({
			version: '0.1.0-m2',
			event: 'round..1',
			rgsUrl: 'https://rgs.example/root/',
		}),
	);
	assert.deepEqual(urls, [
		'https://rgs.example/root/bet/replay/blacksite_breach/0.1.0-m2/base/round..1',
	]);
});

test('Replay client classifies HTTP, RGS, JSON, network and timeout failures', async (t) => {
	const cases = [
		{
			name: 'HTTP',
			fetchImpl: async () => httpResponse({ error: 'down' }, { ok: false, status: 503 }),
			code: 'REPLAY_HTTP_ERROR',
		},
		{
			name: 'RGS',
			fetchImpl: async () =>
				httpResponse({ status: { statusCode: 'ERR_REPLAY', statusMessage: 'missing' } }),
			code: 'REPLAY_RGS_ERROR',
		},
		{
			name: 'JSON',
			fetchImpl: async () => httpResponse('{broken'),
			code: 'REPLAY_JSON_INVALID',
		},
		{
			name: 'network',
			fetchImpl: async () => {
				throw new Error('offline');
			},
			code: 'REPLAY_NETWORK_ERROR',
		},
		{
			name: 'response body network',
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				text: async () => {
					throw new Error('stream failed');
				},
			}),
			code: 'REPLAY_NETWORK_ERROR',
		},
	];
	for (const errorCase of cases) {
		await t.test(errorCase.name, async () => {
			const client = createReplayClient({ fetchImpl: errorCase.fetchImpl });
			await assert.rejects(
				client.fetchRound(launch()),
				(error) => error instanceof ReplayClientError && error.code === errorCase.code,
			);
		});
	}

	await t.test('timeout', async () => {
		const client = createReplayClient({
			timeoutMs: 5,
			fetchImpl: async (_url, { signal }) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener(
						'abort',
						() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
						{ once: true },
					);
				}),
		});
		await assert.rejects(
			client.fetchRound(launch()),
			(error) => error instanceof ReplayClientError && error.code === 'REPLAY_TIMEOUT',
		);
	});
});

test('Replay client aborts every pending read and remains reusable', async () => {
	let successfulFetches = 0;
	const client = createReplayClient({
		fetchImpl: async (_url, { signal }) => {
			if (successfulFetches > 0) return httpResponse(replayPayload());
			return new Promise((_resolve, reject) => {
				signal.addEventListener(
					'abort',
					() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
					{ once: true },
				);
			});
		},
	});
	const first = client.fetchRound(launch({ event: 'first' }));
	const second = client.fetchRound(launch({ event: 'second' }));
	await Promise.resolve();
	assert.equal(client.abortPending(), 2);
	await assert.rejects(
		first,
		(error) => error instanceof ReplayClientError && error.code === 'REPLAY_ABORTED',
	);
	await assert.rejects(
		second,
		(error) => error instanceof ReplayClientError && error.code === 'REPLAY_ABORTED',
	);
	assert.equal(client.abortPending(), 0);

	successfulFetches += 1;
	assert.deepEqual(await client.fetchRound(launch({ event: 'recovered' })), replayPayload());
});

test('Replay normalizer accepts only the direct official response and canonical costs', () => {
	for (const mode of ['base', 'deep_access', 'blackout']) {
		const normalized = normalizer().normalize(replayPayload(mode), launch({ mode }));
		assert.equal(normalized.identity.mode, mode);
		assert.equal(normalized.costMultiplier, getMode(mode).costMultiplier);
		assert.equal(normalized.replayQueryAmountUnitsRaw, '000001.2500');
		assert.equal(normalized.replayResponseMultiplierX, 0);
		assert.equal(normalized.packagePayoutCentiX, 0);
		assert.equal(normalized.walletMicroUnits, null);
		assert.equal(normalized.context.currency, 'XSC');
		assert.equal(normalized.context.language, 'en');
		assert.equal(normalized.context.social, true);
		assert(Object.isFrozen(normalized));
		assert(Object.isFrozen(normalized.events));
		assert(Object.isFrozen(normalized.cues));
	}

	assert.throws(
		() => normalizer().normalize({ round: replayPayload() }, launch()),
		(error) => error.code === 'REPLAY_ENVELOPE_INVALID',
	);
	assert.throws(
		() => normalizer().normalize({ replay: { round: replayPayload() } }, launch()),
		(error) => error.code === 'REPLAY_ENVELOPE_INVALID',
	);
	assert.throws(
		() =>
			normalizer().normalize({ ...replayPayload(), status: { statusCode: 'SUCCESS' } }, launch()),
		(error) => error.code === 'REPLAY_ENVELOPE_INVALID',
	);
	assert.throws(
		() =>
			normalizer().normalize(
				{ ...replayPayload(), state: { events: eventsForMode(), extra: true } },
				launch(),
			),
		(error) => error.code === 'REPLAY_STATE_INVALID',
	);
});

test('Replay normalizer rejects cost, payout, state and event-mode contradictions', () => {
	const cases = [
		['wrong cost', replayPayload('base', { costMultiplier: 4 }), 'REPLAY_COST_MISMATCH'],
		[
			'missing multiplier',
			replayPayload('base', { payoutMultiplier: null }),
			'REPLAY_RESPONSE_MULTIPLIER_INVALID',
		],
		[
			'string multiplier',
			replayPayload('base', { payoutMultiplier: '0' }),
			'REPLAY_RESPONSE_MULTIPLIER_INVALID',
		],
		[
			'fractional centi-x',
			replayPayload('base', { payoutMultiplier: 0.001 }),
			'REPLAY_RESPONSE_MULTIPLIER_INVALID',
		],
		['malformed state', replayPayload('base', { state: { events: {} } }), 'REPLAY_STATE_INVALID'],
	];
	for (const [name, payload, code] of cases) {
		assert.throws(
			() => normalizer().normalize(payload, launch()),
			(error) => error.code === code,
			name,
		);
	}

	assert.throws(
		() => normalizer().normalize(replayPayload('base', { payoutMultiplier: 0.01 }), launch()),
		(error) => error.code === 'REPLAY_PAYOUT_MISMATCH',
	);
	const wrongFirstMode = replayPayload();
	wrongFirstMode.state.events[0].mode = 'deep_access';
	assert.throws(
		() => normalizer().normalize(wrongFirstMode, launch()),
		(error) => error.code === 'REPLAY_EVENT_IDENTITY_MISMATCH',
	);
	const wrongLastMode = replayPayload();
	wrongLastMode.state.events.at(-1).mode = 'blackout';
	assert.throws(
		() => normalizer().normalize(wrongLastMode, launch()),
		(error) => error.code === 'REPLAY_EVENT_IDENTITY_MISMATCH',
	);
	const missingEnd = replayPayload();
	missingEnd.state.events.pop();
	assert.throws(
		() => normalizer().normalize(missingEnd, launch()),
		(error) => error.code === 'REPLAY_EVENT_IDENTITY_MISMATCH',
	);
	assert.throws(
		() => normalizer().normalize(replayPayload(), launch({ mode: 'feature' })),
		(error) => error.code === 'REPLAY_LAUNCH_IDENTITY_INVALID',
	);
});

test('Replay normalizer calls adaptRoundEvents directly and returns immutable data', () => {
	let adapterCall = null;
	const source = replayPayload();
	const normalized = normalizer((events, options) => {
		adapterCall = { events, options };
	}).normalize(source, launch());
	assert.deepEqual(adapterCall.options, { expectedMode: 'base', expectedPayoutRaw: 0 });
	assert.notEqual(adapterCall.events, source.state.events);
	assert.throws(() => {
		normalized.events[0].mode = 'blackout';
	}, TypeError);
	assert.equal(source.state.events[0].mode, 'base');
	assert.equal(normalized.cues.at(-1).kind, 'settled');
});

class FakeDirector {
	constructor(finalWinRaw = 0) {
		this.finalWinRaw = finalWinRaw;
		this.state = { status: 'idle', finalWinRaw: null };
		this.resetCount = 0;
		this.playCount = 0;
		this.destroyed = false;
	}

	reset() {
		this.resetCount += 1;
		this.state = { status: 'idle', finalWinRaw: null };
	}

	async play(cues, options) {
		this.playCount += 1;
		this.lastCues = cues;
		this.lastOptions = options;
		this.state = { status: 'complete', finalWinRaw: this.finalWinRaw };
		return true;
	}

	destroy() {
		this.destroyed = true;
	}
}

test('ReplayController loads once and Play Again uses cached immutable cues only', async () => {
	let fetchCount = 0;
	let normalizeCount = 0;
	const observedMethods = [];
	const client = createReplayClient({
		fetchImpl: async (_url, options) => {
			fetchCount += 1;
			observedMethods.push(options.method);
			return httpResponse(replayPayload());
		},
	});
	const baseNormalizer = normalizer();
	const wrappedNormalizer = {
		normalize(payload, replayLaunch) {
			normalizeCount += 1;
			return baseNormalizer.normalize(payload, replayLaunch);
		},
	};
	const director = new FakeDirector();
	const statuses = [];
	const controller = new ReplayController({
		client,
		normalizer: wrappedNormalizer,
		director,
		onState: (state) => statuses.push(state.status),
	});

	assert.equal(await controller.load(launch()), true);
	assert.equal(controller.state.status, 'ready');
	const immutableCues = controller.state.replay.cues;
	assert.equal(await controller.play(), true);
	assert.equal(controller.state.status, 'completed');
	assert.equal(await controller.playAgain(), true);
	assert.equal(controller.state.status, 'completed');
	assert.equal(fetchCount, 1);
	assert.equal(normalizeCount, 1);
	assert.equal(director.playCount, 2);
	assert.equal(director.lastCues, immutableCues);
	assert.deepEqual(director.lastOptions, { stepDelayMs: null, winDelayMs: null });
	assert.deepEqual(observedMethods, ['GET']);
	assert.deepEqual(statuses, ['loading', 'ready', 'playing', 'completed', 'playing', 'completed']);
	await assert.rejects(
		controller.load(launch()),
		(error) => error.code === 'REPLAY_LOAD_ALREADY_ATTEMPTED',
	);
	assert.equal(fetchCount, 1);
});

test('ReplayController guards concurrent playback, errors safely and ignores destroyed loads', async () => {
	let releasePlay;
	const playGate = new Promise((resolve) => {
		releasePlay = resolve;
	});
	const director = new FakeDirector();
	director.play = async function play() {
		this.playCount += 1;
		await playGate;
		this.state = { status: 'complete', finalWinRaw: 0 };
		return true;
	};
	const controller = new ReplayController({
		client: { fetchRound: async () => replayPayload() },
		normalizer: normalizer(),
		director,
	});
	assert.equal(await controller.load(launch()), true);
	const pending = controller.play();
	assert.equal(controller.state.status, 'playing');
	assert.equal(await controller.play(), false);
	releasePlay();
	assert.equal(await pending, true);
	assert.equal(director.playCount, 1);

	const failing = new ReplayController({
		client: {
			fetchRound: async () => {
				throw new ReplayClientError('REPLAY_HTTP_ERROR', 'HTTP failed');
			},
		},
		normalizer: normalizer(),
		director: new FakeDirector(),
	});
	assert.equal(await failing.load(launch()), false);
	assert.equal(failing.state.status, 'error');
	assert.equal(failing.state.error.code, 'REPLAY_HTTP_ERROR');
	assert.equal(await failing.play(), false);

	let releaseLoad;
	let abortPendingCount = 0;
	const delayed = new ReplayController({
		client: {
			fetchRound: async () =>
				new Promise((resolve) => {
					releaseLoad = () => resolve(replayPayload());
				}),
			abortPending: () => {
				abortPendingCount += 1;
				return 1;
			},
		},
		normalizer: normalizer(),
		director: new FakeDirector(),
	});
	const delayedLoad = delayed.load(launch());
	delayed.destroy();
	delayed.destroy();
	assert.equal(abortPendingCount, 1);
	releaseLoad();
	assert.equal(await delayedLoad, false);
	assert.equal(delayed.state.status, 'loading');
});

test('ReplayController fails closed when presentation total disagrees with package payout', async () => {
	const director = new FakeDirector(1);
	const controller = new ReplayController({
		client: { fetchRound: async () => replayPayload() },
		normalizer: normalizer(),
		director,
	});
	assert.equal(await controller.load(launch()), true);
	assert.equal(await controller.play(), false);
	assert.equal(controller.state.status, 'error');
	assert.equal(controller.state.error.code, 'REPLAY_PRESENTATION_MISMATCH');
	assert.equal(getMode(controller.state.replay.identity.mode).costMultiplier, 1);
});

test('ReplayController validates and forwards an explicit visible playback delay', async () => {
	assert.throws(
		() =>
			new ReplayController({
				client: { fetchRound: async () => replayPayload() },
				normalizer: normalizer(),
				director: new FakeDirector(),
				stepDelayMs: -1,
			}),
		/non-negative safe integer/,
	);
	const director = new FakeDirector();
	const controller = new ReplayController({
		client: { fetchRound: async () => replayPayload() },
		normalizer: normalizer(),
		director,
		stepDelayMs: 24,
	});
	await controller.load(launch());
	await controller.play();
	assert.deepEqual(director.lastOptions, { stepDelayMs: 24, winDelayMs: null });
});
