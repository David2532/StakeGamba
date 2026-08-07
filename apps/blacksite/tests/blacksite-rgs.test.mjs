import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
	API_AMOUNT_SCALE,
	InsufficientBalanceError,
	RgsContractError,
	encodePresentationCursor,
	normalizeAuthenticateResponse,
	normalizeEndRoundResponse,
	normalizeEventResponse,
	normalizePlayResponse,
	normalizeRound,
	totalPlayAmountApi,
	validateBaseAmount,
} from '../src/lib/rgs/contracts.js';
import { createLiveRgsClient } from '../src/lib/rgs/client.js';
import { LiveSessionController } from '../src/lib/rgs/live-session.js';
import { BASE_ZERO_FIXTURE } from '../src/lib/fixtures/base-zero.js';
import { GameEventAdapter } from '../src/lib/runtime/game-event-adapter.js';

const clone = (value) => structuredClone(value);

function canonicalConfig(overrides = {}) {
	return {
		minBet: 100_000,
		maxBet: 10_000_000,
		stepBet: 100_000,
		defaultBetLevel: 1_000_000,
		betLevels: [100_000, 1_000_000, 10_000_000],
		betModes: {
			base: { costMultiplier: 1 },
			deep_access: { costMultiplier: 4 },
			blackout: { costMultiplier: 80 },
		},
		jurisdiction: {
			socialCasino: false,
			disabledFullscreen: false,
			disabledTurbo: false,
			disabledSuperTurbo: false,
			disabledAutoplay: true,
			disabledSlamstop: false,
			disabledSpacebar: false,
			disabledBuyFeature: false,
			displayNetPosition: false,
			displayRTP: true,
			displaySessionTimer: false,
			minimumRoundDuration: 0,
		},
		...overrides,
	};
}

function roundEvents(mode, payoutMultiplierRaw = 0) {
	return [
		{ index: 0, type: 'round_start', mode },
		{ index: 1, type: 'round_end', mode, payout_multiplier_raw: payoutMultiplierRaw },
	];
}

function contractAdapter() {
	return {
		adaptRoundEvents(events, { expectedMode } = {}) {
			assert(Array.isArray(events));
			assert(events.length >= 2);
			assert.equal(events[0].mode, expectedMode);
			assert.equal(events.at(-1).mode, expectedMode);
			assert.equal(events.at(-1).type, 'round_end');
			return events.map((event, eventIndex) => ({
				kind: eventIndex === events.length - 1 ? 'settled' : 'round_started',
				eventIndex,
				event,
			}));
		},
	};
}

function roundPayload({
	id = 'round-1',
	active = false,
	mode = 'base',
	amount = 1_000_000,
	payoutMultiplierRaw = 0,
	payoutMultiplier = payoutMultiplierRaw / 100,
	payout,
	event = null,
	stateShape = 'object',
} = {}) {
	const events = roundEvents(mode, payoutMultiplierRaw);
	const resolvedPayout = payout === undefined
		&& Number.isSafeInteger(amount)
		&& Number.isSafeInteger(payoutMultiplierRaw)
		? Number((BigInt(amount) * BigInt(payoutMultiplierRaw)) / 100n)
		: (payout ?? 0);
	return {
		roundID: id,
		active,
		mode,
		amount,
		payout: resolvedPayout,
		payoutMultiplier,
		event,
		state: stateShape === 'array' ? events : { events },
	};
}

function authPayload({ amount = 100_000_000, currency = 'XSC', config, round = null } = {}) {
	return {
		status: { statusCode: 'SUCCESS' },
		balance: { amount, currency },
		config: config ?? canonicalConfig(),
		round,
	};
}

function playPayload({ amount = 99_000_000, currency = 'XSC', round } = {}) {
	return {
		status: { statusCode: 'SUCCESS' },
		balance: { amount, currency },
		round: round ?? roundPayload(),
	};
}

function endPayload({ amount = 100_000_000, currency = 'XSC' } = {}) {
	return {
		status: { statusCode: 'SUCCESS' },
		balance: { amount, currency },
	};
}

function response(body, { ok = true, status = 200 } = {}) {
	return {
		ok,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
	};
}

function fakeClient({ authenticate, play, saveEvent, endRound } = {}) {
	const calls = { authenticate: [], play: [], saveEvent: [], endRound: [] };
	return {
		calls,
		async authenticate(args) {
			calls.authenticate.push(clone(args));
			return typeof authenticate === 'function'
				? authenticate(args)
				: clone(authenticate ?? authPayload());
		},
		async play(args) {
			calls.play.push(clone(args));
			return typeof play === 'function'
				? play(args)
				: clone(play ?? playPayload());
		},
		async saveEvent(args) {
			calls.saveEvent.push(clone(args));
			return typeof saveEvent === 'function'
				? saveEvent(args)
				: clone(saveEvent ?? { event: args.event });
		},
		async endRound(args) {
			calls.endRound.push(clone(args));
			return typeof endRound === 'function'
				? endRound(args)
				: clone(endRound ?? endPayload());
		},
	};
}

test('RGS money remains safe integer micro-units and canonical mode cost is applied once', () => {
	assert.equal(API_AMOUNT_SCALE, 1_000_000);
	assert.equal(totalPlayAmountApi(1_000_000, 'base'), 1_000_000);
	assert.equal(totalPlayAmountApi(1_000_000, 'deep_access'), 4_000_000);
	assert.equal(totalPlayAmountApi(1_000_000, 'blackout'), 80_000_000);
	assert.equal(validateBaseAmount(1_000_000, canonicalConfig()), 1_000_000);

	for (const invalid of [1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
		assert.throws(
			() => totalPlayAmountApi(invalid, 'base'),
			(error) => error instanceof RgsContractError && error.code === 'MONEY_INTEGER_INVALID',
		);
	}
	assert.throws(
		() => totalPlayAmountApi(Number.MAX_SAFE_INTEGER, 'blackout'),
		(error) => error.code === 'TOTAL_PLAY_AMOUNT_UNSAFE',
	);
	assert.throws(
		() => validateBaseAmount(50_000, canonicalConfig()),
		(error) => error.code === 'BASE_AMOUNT_OUT_OF_RANGE',
	);
	assert.throws(
		() => validateBaseAmount(150_000, canonicalConfig()),
		(error) => error.code === 'BASE_AMOUNT_STEP_MISMATCH',
	);
	assert.throws(
		() => validateBaseAmount(200_000, canonicalConfig()),
		(error) => error.code === 'BASE_AMOUNT_NOT_RETURNED',
	);
});

test('authenticate accepts only unambiguous step aliases and the exact BLACKSITE mode table', () => {
	const adapter = contractAdapter();
	for (const config of [
		canonicalConfig(),
		canonicalConfig({ stepBet: undefined, minStep: 100_000 }),
		canonicalConfig({ stepBet: 100_000, minStep: 100_000 }),
	]) {
		const normalized = normalizeAuthenticateResponse(authPayload({ config }), { adapter });
		assert.equal(normalized.config.stepBetApi, 100_000);
		assert.deepEqual(Object.keys(normalized.config.betModes).sort(), [
			'base',
			'blackout',
			'deep_access',
		]);
		assert.deepEqual(
			Object.values(normalized.config.betModes).map((mode) => mode.costMultiplier),
			[1, 4, 80],
		);
		assert.deepEqual(
			Object.values(normalized.config.betModes).map((mode) => mode.feature),
			[false, true, true],
		);
		assert(Object.isFrozen(normalized));
		assert(Object.isFrozen(normalized.config.betModes));
		assert(Object.isFrozen(normalized.config.jurisdiction));
	}

	const conflicts = [
		[canonicalConfig({ minStep: 200_000 }), 'STEP_BET_CONFLICT'],
		[canonicalConfig({ betModes: { ...canonicalConfig().betModes, bonus: { costMultiplier: 2 } } }), 'BET_MODE_SET_MISMATCH'],
		[canonicalConfig({ betModes: { ...canonicalConfig().betModes, blackout: { costMultiplier: 79 } } }), 'BET_MODE_COST_MISMATCH'],
		[canonicalConfig({ betModes: { ...canonicalConfig().betModes, deep_access: { costMultiplier: 4, feature: false } } }), 'BET_MODE_FEATURE_MISMATCH'],
		[canonicalConfig({ jurisdiction: { ...canonicalConfig().jurisdiction, disabledSpacebar: 'false' } }), 'JURISDICTION_FIELD_INVALID'],
		[canonicalConfig({ jurisdiction: { ...canonicalConfig().jurisdiction, minimumRoundDuration: -1 } }), 'JURISDICTION_FIELD_INVALID'],
	];
	for (const [config, code] of conflicts) {
		assert.throws(
			() => normalizeAuthenticateResponse(authPayload({ config }), { adapter }),
			(error) => error.code === code,
		);
	}

	const missingJurisdictionField = canonicalConfig();
	delete missingJurisdictionField.jurisdiction.disabledTurbo;
	assert.throws(
		() => normalizeAuthenticateResponse(authPayload({ config: missingJurisdictionField }), { adapter }),
		(error) => error.code === 'JURISDICTION_KEY_SET_MISMATCH'
			&& error.details.missing.includes('disabledTurbo')
			&& error.details.unknown.length === 0,
	);
	const unknownJurisdictionField = canonicalConfig({
		jurisdiction: { ...canonicalConfig().jurisdiction, disabledRealityCheck: false },
	});
	assert.throws(
		() => normalizeAuthenticateResponse(authPayload({ config: unknownJurisdictionField }), { adapter }),
		(error) => error.code === 'JURISDICTION_KEY_SET_MISMATCH'
			&& error.details.missing.length === 0
			&& error.details.unknown.includes('disabledRealityCheck'),
	);
});

test('round normalization accepts both official state shapes and reconciles multiplier-x exactly', () => {
	const adapter = contractAdapter();
	for (const stateShape of ['array', 'object']) {
		const source = roundPayload({
			stateShape,
			payoutMultiplierRaw: 112,
			payoutMultiplier: 1.12,
		});
		const normalized = normalizeRound(source, { adapter, expectedMode: 'base' });
		assert.equal(normalized.payoutMultiplierX, 1.12);
		assert.equal(normalized.payoutMultiplierRaw, 112);
		assert.equal(normalized.payoutApi, 1_120_000);
		assert.equal(normalized.cues.at(-1).kind, 'settled');
		assert.notEqual(normalized.state.events, source.state.events);
		assert(Object.isFrozen(normalized.state.events));
	}

	assert.throws(
		() => normalizeRound(roundPayload({ payoutMultiplierRaw: 112, payoutMultiplier: 112 }), { adapter }),
		(error) => error.code === 'ROUND_PAYOUT_MULTIPLIER_MISMATCH',
		'raw centi-x integers must never be reinterpreted as multiplier-x',
	);
	assert.equal(
		normalizeRound(roundPayload({ event: encodePresentationCursor(1) }), { adapter }).eventCursor,
		1,
	);
	assert.equal(normalizeRound(roundPayload({ event: '2' }), { adapter }).eventCursor, 2);
	assert.equal(normalizeRound(roundPayload({ event: 'cursor-1' }), { adapter }).eventCursor, 0);
	assert.equal(normalizeRound(roundPayload({ event: 3 }), { adapter }).eventCursor, 0);
	assert.throws(
		() => normalizeRound(roundPayload({ payoutMultiplierRaw: 112, payoutMultiplier: 1.123 }), { adapter }),
		(error) => error.code === 'PAYOUT_MULTIPLIER_PRECISION',
	);
	for (const missing of [undefined, null]) {
		const missingMultiplierRound = roundPayload();
		if (missing === undefined) delete missingMultiplierRound.payoutMultiplier;
		else missingMultiplierRound.payoutMultiplier = missing;
		assert.throws(
			() => normalizeRound(missingMultiplierRound, { adapter }),
			(error) => error.code === 'PAYOUT_MULTIPLIER_INVALID',
		);
	}
	assert.throws(
		() => normalizeRound(roundPayload({ mode: 'base' }), { adapter, expectedMode: 'blackout' }),
		(error) => error.code === 'ROUND_MODE_MISMATCH',
	);
	assert.throws(
		() => normalizeRound(roundPayload({ amount: 1.25 }), { adapter }),
		(error) => error.code === 'MONEY_INTEGER_INVALID',
	);
	for (const [payout, relation] of [[2_499_999, 'too-small'], [2_500_001, 'too-large']]) {
		assert.throws(
			() => normalizeRound(roundPayload({
				amount: 1_000_000,
				payoutMultiplierRaw: 250,
				payoutMultiplier: 2.5,
				payout,
			}), { adapter }),
			(error) => error.code === 'ROUND_PAYOUT_AMOUNT_MISMATCH'
				&& error.details.relation === relation,
		);
	}
	assert.throws(
		() => normalizeRound(roundPayload({
			amount: 100_001,
			payoutMultiplierRaw: 112,
			payoutMultiplier: 1.12,
			payout: 112_001,
		}), { adapter }),
		(error) => error.code === 'ROUND_PAYOUT_AMOUNT_MISMATCH'
			&& error.details.expectedCentiMicroUnits === '11200112',
		'inexact fractions of one API micro-unit must fail closed',
	);
	const maxSafeNormalized = normalizeRound(roundPayload({
		amount: Number.MAX_SAFE_INTEGER,
		payoutMultiplierRaw: 100,
		payoutMultiplier: 1,
		payout: Number.MAX_SAFE_INTEGER,
	}), { adapter });
	assert.equal(maxSafeNormalized.payoutApi, Number.MAX_SAFE_INTEGER);
	for (const missing of [undefined, null]) {
		const withoutPayout = roundPayload();
		if (missing === undefined) delete withoutPayout.payout;
		else withoutPayout.payout = missing;
		assert.throws(
			() => normalizeRound(withoutPayout, { adapter }),
			(error) => error.code === 'ROUND_PAYOUT_MISSING',
		);
	}
});

test('round normalization composes with the real closed-schema GameEventAdapter', () => {
	const events = clone(BASE_ZERO_FIXTURE.book.events);
	const normalized = normalizeRound({
		roundID: 'published-base-zero',
		active: false,
		mode: 'base',
		amount: 100_000,
		payout: 0,
		payoutMultiplier: 0,
		state: { events },
	}, { adapter: new GameEventAdapter(), expectedMode: 'base' });
	assert.equal(normalized.payoutMultiplierRaw, BASE_ZERO_FIXTURE.book.payoutMultiplier);
	assert.equal(normalized.cues[0].kind, 'round_started');
	assert.equal(normalized.cues.at(-1).kind, 'settled');
	assert(Object.isFrozen(normalized.cues));
});

test('play and end-round normalization preserve RGS authority and reject contradictions', () => {
	const adapter = contractAdapter();
	const played = normalizePlayResponse(
		playPayload({ round: roundPayload({ mode: 'deep_access', amount: 1_000_000 }) }),
		{
			adapter,
			expectedMode: 'deep_access',
			expectedAmountApi: 1_000_000,
			expectedCurrency: 'XSC',
		},
	);
	assert.equal(played.balance.amountApi, 99_000_000);
	assert.equal(played.round.amountApi, 1_000_000);
	assert.deepEqual(
		normalizeEventResponse(
			{ event: encodePresentationCursor(2) },
			{ expectedEvent: encodePresentationCursor(2) },
		),
		{ event: encodePresentationCursor(2), echoed: true },
	);
	assert.deepEqual(
		normalizeEventResponse(
			{ status: { statusCode: 'SUCCESS' } },
			{ expectedEvent: encodePresentationCursor(2) },
		),
		{ event: null, echoed: false },
	);
	assert.throws(
		() => normalizeEventResponse({ event: 'wrong' }, { expectedEvent: encodePresentationCursor(2) }),
		(error) => error.code === 'EVENT_RESPONSE_MISMATCH',
	);

	assert.throws(
		() => normalizePlayResponse(playPayload(), {
			adapter,
			expectedMode: 'base',
			expectedAmountApi: 2_000_000,
			expectedCurrency: 'XSC',
		}),
		(error) => error.code === 'PLAY_AMOUNT_MISMATCH',
	);
	assert.throws(
		() => normalizePlayResponse(playPayload({ currency: 'USD' }), {
			adapter,
			expectedMode: 'base',
			expectedAmountApi: 1_000_000,
			expectedCurrency: 'XSC',
		}),
		(error) => error.code === 'PLAY_CURRENCY_MISMATCH',
	);
	assert.throws(
		() => normalizeEndRoundResponse({
			balance: { amount: 1, currency: 'XSC' },
			round: { active: true },
		}),
		(error) => error.code === 'END_ROUND_STILL_ACTIVE',
	);
	assert.throws(
		() => normalizeEndRoundResponse({ balance: { amount: 1.1, currency: 'XSC' } }),
		(error) => error.code === 'MONEY_INTEGER_INVALID',
	);
	for (const active of ['true', 1, null]) {
		assert.throws(
			() => normalizeEndRoundResponse({
				balance: { amount: 1, currency: 'XSC' },
				round: { active },
			}),
			(error) => error.code === 'END_ROUND_ACTIVE_INVALID',
		);
	}
});

test('live RGS client POSTs exact endpoint bodies to a full base URL', async (t) => {
	const requests = [];
	const server = http.createServer((request, reply) => {
		const chunks = [];
		request.on('data', (chunk) => chunks.push(chunk));
		request.on('end', () => {
			requests.push({
				method: request.method,
				url: request.url,
				headers: request.headers,
				body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
			});
			const payload = request.url.endsWith('/authenticate')
				? authPayload()
				: request.url.endsWith('/play')
					? playPayload()
					: request.url.endsWith('/event')
						? { event: requests.at(-1).body.event }
						: endPayload();
			reply.writeHead(200, { 'content-type': 'application/json' });
			reply.end(JSON.stringify(payload));
		});
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	}));
	const { port } = server.address();
	const client = createLiveRgsClient({ baseUrl: `http://127.0.0.1:${port}/rgs/` });

	await client.authenticate({ sessionID: 'session-1', language: 'de' });
	await client.play({
		sessionID: 'session-1',
		currency: 'xsc',
		amountApi: 1_000_000,
		mode: 'deep_access',
	});
	await client.saveEvent({ sessionID: 'session-1', event: encodePresentationCursor(2) });
	await client.endRound({ sessionID: 'session-1' });

	assert.deepEqual(requests.map(({ method, url }) => ({ method, url })), [
		{ method: 'POST', url: '/rgs/wallet/authenticate' },
		{ method: 'POST', url: '/rgs/wallet/play' },
		{ method: 'POST', url: '/rgs/bet/event' },
		{ method: 'POST', url: '/rgs/wallet/end-round' },
	]);
	assert.deepEqual(requests[0].body, { sessionID: 'session-1', language: 'de' });
	assert.deepEqual(requests[1].body, {
		sessionID: 'session-1',
		currency: 'XSC',
		amount: 1_000_000,
		mode: 'deep_access',
	});
	assert.deepEqual(requests[2].body, {
		sessionID: 'session-1',
		event: encodePresentationCursor(2),
	});
	assert.deepEqual(requests[3].body, { sessionID: 'session-1' });
	assert.equal(requests[1].headers['content-type'], 'application/json');
});

test('live RGS client classifies HTTP, API, JSON, network, funds and timeout failures', async (t) => {
	for (const baseUrl of ['', 'not-a-url', 'ftp://rgs.example', 'https://user:secret@rgs.example']) {
		assert.throws(
			() => createLiveRgsClient({ baseUrl, fetchImpl: async () => response({}) }),
			(error) => error.code === 'RGS_BASE_URL_INVALID',
		);
	}
	const cases = [
		{
			name: 'HTTP',
			fetchImpl: async () => response({ error: { message: 'down' } }, { ok: false, status: 503 }),
			code: 'RGS_HTTP_ERROR',
		},
		{
			name: 'API status',
			fetchImpl: async () => response({ status: { statusCode: 'ERR_SESSION' } }),
			code: 'RGS_API_ERROR',
		},
		{
			name: 'invalid JSON',
			fetchImpl: async () => response('{broken'),
			code: 'RGS_INVALID_JSON',
		},
		{
			name: 'network',
			fetchImpl: async () => {
				throw new Error('offline');
			},
			code: 'RGS_NETWORK_ERROR',
		},
		{
			name: 'response body',
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				text: async () => {
					throw new Error('stream interrupted');
				},
			}),
			code: 'RGS_RESPONSE_READ_ERROR',
		},
	];
	for (const errorCase of cases) {
		await t.test(errorCase.name, async () => {
			const client = createLiveRgsClient({
				baseUrl: 'https://rgs.example/root',
				fetchImpl: errorCase.fetchImpl,
			});
			await assert.rejects(
				client.authenticate({ sessionID: 'session-1' }),
				(error) => error instanceof RgsContractError && error.code === errorCase.code,
			);
		});
	}

	await t.test('authoritative insufficient balance', async () => {
		const client = createLiveRgsClient({
			baseUrl: 'https://rgs.example',
			fetchImpl: async () => response(
				{ status: { statusCode: 'ERR_IPB', statusMessage: 'insufficient' } },
				{ ok: false, status: 400 },
			),
		});
		await assert.rejects(
			client.play({ sessionID: 's', currency: 'XSC', amountApi: 1, mode: 'base' }),
			(error) => error instanceof InsufficientBalanceError && error.source === 'rgs',
		);
	});

	await t.test('timeout includes response body consumption', async () => {
		const client = createLiveRgsClient({
			baseUrl: 'https://rgs.example',
			timeoutMs: 5,
			fetchImpl: async (_url, { signal }) => ({
				ok: true,
				status: 200,
				text: async () => new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => {
						reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
					}, { once: true });
				}),
			}),
		});
		await assert.rejects(
			client.authenticate({ sessionID: 'session-1' }),
			(error) => error.code === 'RGS_TIMEOUT',
		);
	});
});

test('LiveSessionController deduplicates authentication and trusts only RGS balances', async () => {
	let releaseAuthenticate;
	const client = fakeClient({
		authenticate: () => new Promise((resolve) => {
			releaseAuthenticate = () => resolve(authPayload({ amount: 50_000_000 }));
		}),
	});
	const states = [];
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
		onState: (state) => states.push(state),
	});
	const first = controller.bootstrap();
	const second = controller.bootstrap();
	assert.equal(first, second);
	await Promise.resolve();
	assert.equal(client.calls.authenticate.length, 1);
	releaseAuthenticate();
	const ready = await first;
	assert.equal(ready.status, 'ready');
	assert.equal(ready.balance.amountApi, 50_000_000);
	assert.equal(ready.selectedBaseAmountApi, 1_000_000);
	assert.equal(states.at(-1).status, 'ready');
});

test('LiveSessionController isolates throwing and reentrant state observers', async () => {
	const client = fakeClient({
		authenticate: authPayload({ round: roundPayload({ active: true }) }),
	});
	let controller;
	let reentrantBootstrap = null;
	let reentrantSettlement = null;
	controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
		onState(state) {
			if (state.status === 'authenticating' && !reentrantBootstrap) {
				reentrantBootstrap = controller.bootstrap();
			}
			if (state.status === 'settling' && !reentrantSettlement) {
				reentrantSettlement = controller.completePresentation();
			}
			throw new Error('observer failure');
		},
	});
	const bootstrap = controller.bootstrap();
	assert.equal(reentrantBootstrap, bootstrap);
	const restored = await bootstrap;
	assert.equal(restored.status, 'presenting');
	assert.equal(client.calls.authenticate.length, 1);

	const settlement = controller.completePresentation();
	assert.equal(reentrantSettlement, settlement);
	const ready = await settlement;
	assert.equal(ready.status, 'ready');
	assert.equal(client.calls.endRound.length, 1);
});

test('LiveSessionController sends the base amount, never the mode-adjusted debit', async () => {
	const client = fakeClient({
		play: playPayload({
			amount: 46_000_000,
			round: roundPayload({ active: false, mode: 'deep_access', amount: 1_000_000 }),
		}),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await controller.bootstrap();
	const presenting = await controller.play('deep_access');
	assert.deepEqual(client.calls.play, [{
		sessionID: 'session-1',
		currency: 'XSC',
		amountApi: 1_000_000,
		mode: 'deep_access',
	}]);
	assert.equal(presenting.balance.amountApi, 46_000_000);
	assert.equal(presenting.presentationPending, true);
	const ready = await controller.completePresentation();
	assert.equal(ready.status, 'ready');
	assert.equal(ready.balance.amountApi, 46_000_000);
	assert.equal(client.calls.endRound.length, 0);
});

test('LiveSessionController blocks known insufficient funds without a paid fallback', async () => {
	const client = fakeClient({ authenticate: authPayload({ amount: 3_999_999 }) });
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await controller.bootstrap();
	await assert.rejects(
		controller.play('deep_access'),
		(error) => error instanceof InsufficientBalanceError
			&& error.requiredAmountApi === 4_000_000
			&& error.availableAmountApi === 3_999_999,
	);
	assert.equal(client.calls.play.length, 0);
	assert.equal(controller.snapshot().status, 'ready');
	assert.equal(controller.snapshot().lastError.code, 'INSUFFICIENT_BALANCE');
});

test('LiveSessionController handles an RGS insufficient-balance race without fallback', async () => {
	const error = new InsufficientBalanceError({ source: 'rgs' });
	const client = fakeClient({
		authenticate: () => client.calls.authenticate.length === 1
			? authPayload()
			: authPayload({ round: roundPayload({ active: true }) }),
		play: () => Promise.reject(error),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await controller.bootstrap();
	await assert.rejects(controller.play('base'), (received) => received === error);
	assert.equal(client.calls.play.length, 1);
	assert.equal(client.calls.endRound.length, 0);
	assert.equal(controller.snapshot().status, 'reauthentication-required');
	assert.equal(controller.snapshot().balance, null);
	assert.equal(controller.snapshot().lastError.code, 'INSUFFICIENT_BALANCE');
	const restored = await controller.bootstrap();
	assert.equal(client.calls.authenticate.length, 2);
	assert.equal(client.calls.play.length, 1);
	assert.equal(restored.status, 'presenting');
	assert.equal(restored.round.active, true);
	await controller.completePresentation();
	assert.equal(client.calls.endRound.length, 1);
});

test('LiveSessionController resets an out-of-catalog restored amount after settlement', async () => {
	const client = fakeClient({
		authenticate: authPayload({
			round: roundPayload({ active: true, amount: 500_000 }),
		}),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	const restored = await controller.bootstrap();
	assert.equal(restored.selectedBaseAmountApi, 500_000);
	const settled = await controller.completePresentation();
	assert.equal(settled.selectedBaseAmountApi, 1_000_000);
	await controller.play('base');
	assert.equal(client.calls.play[0].amountApi, 1_000_000);
});

test('LiveSessionController restores and settles every active canonical mode exactly once', async (t) => {
	for (const mode of ['base', 'deep_access', 'blackout']) {
		await t.test(mode, async () => {
			let releaseEnd;
			const client = fakeClient({
				authenticate: authPayload({
					amount: 7_000_000,
					round: roundPayload({ active: true, mode, amount: 100_000 }),
				}),
				endRound: () => new Promise((resolve) => {
					releaseEnd = () => resolve(endPayload({ amount: 8_000_000 }));
				}),
			});
			const controller = new LiveSessionController({
				client,
				adapter: contractAdapter(),
				sessionID: `session-${mode}`,
			});
			const restored = await controller.bootstrap();
			assert.equal(restored.status, 'presenting');
			assert.equal(restored.round.mode, mode);
			assert.equal(restored.selectedBaseAmountApi, 100_000);
			assert.equal(client.calls.play.length, 0);

			const first = controller.completePresentation();
			const second = controller.completePresentation();
			assert.equal(first, second);
			await Promise.resolve();
			assert.equal(client.calls.endRound.length, 1);
			releaseEnd();
			const settled = await first;
			assert.equal(settled.status, 'ready');
			assert.equal(settled.balance.amountApi, 8_000_000);
			assert.equal(settled.round, null);
			assert.equal(settled.settlementAttempted, true);
			await controller.completePresentation();
			assert.equal(client.calls.endRound.length, 1);
		});
	}
});

test('LiveSessionController persists monotonic next-event checkpoints for active presentation only', async () => {
	const client = fakeClient({
		authenticate: authPayload({
			round: roundPayload({ active: true, event: encodePresentationCursor(0) }),
		}),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-checkpoint',
	});
	const restored = await controller.bootstrap();
	assert.equal(restored.lastSavedEventCursor, 0);
	const first = await controller.savePresentationCursor(1);
	assert.deepEqual(first, {
		event: encodePresentationCursor(1),
		echoed: true,
		nextEventIndex: 1,
	});
	assert.deepEqual(client.calls.saveEvent, [{
		sessionID: 'session-checkpoint',
		event: encodePresentationCursor(1),
	}]);
	await controller.savePresentationCursor(1);
	assert.equal(client.calls.saveEvent.length, 1, 'duplicate checkpoint is acknowledged locally');
	await assert.rejects(
		controller.savePresentationCursor(3),
		(error) => error.code === 'SESSION_EVENT_CURSOR_INVALID',
	);
	await controller.completePresentation();
	await assert.rejects(
		controller.savePresentationCursor(1),
		(error) => error.code === 'SESSION_EVENT_NOT_ACTIVE',
	);
});

test('LiveSessionController settles an active paid round and records presentation failure', async () => {
	const client = fakeClient({
		play: playPayload({
			amount: 99_000_000,
			round: roundPayload({
				active: true,
				mode: 'base',
				payoutMultiplierRaw: 250,
				payoutMultiplier: 2.5,
				payout: 2_500_000,
			}),
		}),
		endRound: endPayload({ amount: 101_000_000 }),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await controller.bootstrap();
	await controller.play('base');
	const settled = await controller.failPresentation(new Error('renderer interrupted'));
	assert.equal(client.calls.endRound.length, 1);
	assert.equal(settled.status, 'ready');
	assert.equal(settled.balance.amountApi, 101_000_000);
	assert.equal(settled.presentationError.message, 'renderer interrupted');
});

test('LiveSessionController never retries a failed active-round settlement', async () => {
	const failure = new RgsContractError('RGS_NETWORK_ERROR', 'settlement offline');
	const client = fakeClient({
		authenticate: authPayload({ round: roundPayload({ active: true }) }),
		endRound: () => Promise.reject(failure),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await controller.bootstrap();
	await assert.rejects(controller.completePresentation(), (error) => error === failure);
	assert.equal(client.calls.endRound.length, 1);
	assert.equal(controller.snapshot().status, 'error');
	assert.equal(controller.snapshot().settlementAttempted, true);
	await assert.rejects(
		controller.completePresentation(),
		(error) => error.code === 'ROUND_SETTLEMENT_ALREADY_ATTEMPTED',
	);
	assert.equal(client.calls.endRound.length, 1);
});

test('LiveSessionController deduplicates play and fails closed on authoritative errors', async () => {
	let releasePlay;
	const delayedClient = fakeClient({
		play: () => new Promise((resolve) => {
			releasePlay = () => resolve(playPayload());
		}),
	});
	const delayed = new LiveSessionController({
		client: delayedClient,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	await delayed.bootstrap();
	const first = delayed.play('base');
	const second = delayed.play('base');
	assert.equal(first, second);
	await assert.rejects(
		delayed.play('blackout'),
		(error) => error.code === 'SESSION_BUSY',
	);
	await Promise.resolve();
	assert.equal(delayedClient.calls.play.length, 1);
	await assert.rejects(
		delayed.completePresentation(),
		(error) => error.code === 'SESSION_BUSY',
	);
	releasePlay();
	await first;

	const failure = new RgsContractError('RGS_NETWORK_ERROR', 'offline');
	const failingClient = fakeClient({
		play: () => Promise.reject(failure),
	});
	const failing = new LiveSessionController({
		client: failingClient,
		adapter: contractAdapter(),
		sessionID: 'session-2',
	});
	await failing.bootstrap();
	await assert.rejects(failing.play('base'), (error) => error === failure);
	assert.equal(failingClient.calls.play.length, 1);
	assert.equal(failing.snapshot().status, 'error');
	assert.equal(failing.snapshot().round, null);
	assert.equal(failing.snapshot().lastError.code, 'RGS_NETWORK_ERROR');
});

test('LiveSessionController ignores late authentication after destroy', async () => {
	let releaseAuthenticate;
	const client = fakeClient({
		authenticate: () => new Promise((resolve) => {
			releaseAuthenticate = () => resolve(authPayload());
		}),
	});
	const controller = new LiveSessionController({
		client,
		adapter: contractAdapter(),
		sessionID: 'session-1',
	});
	const pending = controller.bootstrap();
	await Promise.resolve();
	assert.equal(client.calls.authenticate.length, 1);
	controller.destroy();
	releaseAuthenticate();
	const snapshot = await pending;
	assert.equal(snapshot.status, 'destroyed');
	assert.equal(controller.snapshot().status, 'destroyed');
	assert.throws(() => controller.selectBaseAmount(100_000), /destroyed/);
});
