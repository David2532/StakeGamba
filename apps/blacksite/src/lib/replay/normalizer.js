import {
	GAME_ID,
	getMode,
	isCanonicalMode,
} from '../contracts/modes.js';
import {
	REPLAY_WALLET_MICRO_UNITS,
	normalizePackagePayoutCentiX,
	normalizeReplayQueryAmountUnitsRaw,
	normalizeReplayResponseMultiplierX,
	replayResponseMultiplierXToCentiX,
} from './money-domains.js';

const RESPONSE_KEYS = Object.freeze(['costMultiplier', 'payoutMultiplier', 'state']);

export class ReplayNormalizationError extends Error {
	constructor(code, message, { cause = null } = {}) {
		super(message, cause ? { cause } : undefined);
		this.name = 'ReplayNormalizationError';
		this.code = code;
	}
}

function fail(code, message, cause = null) {
	throw new ReplayNormalizationError(code, message, { cause });
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expected, code, message) {
	if (!isObject(value)) fail(code, message);
	const actual = Object.keys(value).sort();
	if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) fail(code, message);
}

function clone(value) {
	return structuredClone(value);
}

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		Object.values(value).forEach(deepFreeze);
	}
	return value;
}

function requireLaunch(launch) {
	if (!isObject(launch) || launch.kind !== 'replay') {
		fail('REPLAY_LAUNCH_INVALID', 'Replay normalization requires a Replay launch.');
	}
	for (const field of ['game', 'version', 'mode', 'event']) {
		if (typeof launch[field] !== 'string' || launch[field].trim() === '') {
			fail('REPLAY_LAUNCH_INVALID', `Replay launch ${field} is required.`);
		}
	}
	if (launch.game !== GAME_ID || !isCanonicalMode(launch.mode)) {
		fail('REPLAY_LAUNCH_IDENTITY_INVALID', 'Replay launch identity is not canonical BLACKSITE.');
	}
}

function terminalPayout(events, expectedMode) {
	const first = events[0];
	const last = events.at(-1);
	if (
		!isObject(first) ||
		first.type !== 'round_start' ||
		first.mode !== expectedMode ||
		!isObject(last) ||
		last.type !== 'round_end' ||
		last.mode !== expectedMode
	) {
		fail(
			'REPLAY_EVENT_IDENTITY_MISMATCH',
			'Replay first and last events must identify the requested canonical mode.',
		);
	}
	if (events.filter((event) => event?.type === 'round_end').length !== 1) {
		fail(
			'REPLAY_TERMINAL_EVENT_INVALID',
			'Replay events must end with exactly one authoritative round_end.',
		);
	}
	try {
		return normalizePackagePayoutCentiX(last.payout_multiplier_raw);
	} catch (cause) {
		fail('REPLAY_PACKAGE_PAYOUT_INVALID', 'Replay round_end payout is invalid.', cause);
	}
}

/** @param {{gameEventAdapter?: any}} [options] */
export function createReplayNormalizer({ gameEventAdapter } = {}) {
	if (!gameEventAdapter || typeof gameEventAdapter.adaptRoundEvents !== 'function') {
		throw new TypeError('createReplayNormalizer requires GameEventAdapter.adaptRoundEvents.');
	}

	const normalize = (payload, launch) => {
		requireLaunch(launch);
		assertExactKeys(
			payload,
			RESPONSE_KEYS,
			'REPLAY_ENVELOPE_INVALID',
			'Replay response must contain exactly payoutMultiplier, costMultiplier and state.',
		);
		assertExactKeys(
			payload.state,
			['events'],
			'REPLAY_STATE_INVALID',
			'Replay state must contain exactly one events array.',
		);
		if (!Array.isArray(payload.state.events)) {
			fail('REPLAY_STATE_INVALID', 'Replay state.events must be an array.');
		}

		const canonicalMode = getMode(launch.mode);
		if (
			typeof payload.costMultiplier !== 'number' ||
			!Number.isFinite(payload.costMultiplier) ||
			payload.costMultiplier !== canonicalMode.costMultiplier
		) {
			fail('REPLAY_COST_MISMATCH', 'Replay response costMultiplier is not canonical.');
		}

		let replayResponseMultiplierX;
		let responsePayoutCentiX;
		try {
			replayResponseMultiplierX = normalizeReplayResponseMultiplierX(
				payload.payoutMultiplier,
			);
			responsePayoutCentiX = replayResponseMultiplierXToCentiX(
				replayResponseMultiplierX,
			);
		} catch (cause) {
			fail('REPLAY_RESPONSE_MULTIPLIER_INVALID', 'Replay response payoutMultiplier is invalid.', cause);
		}

		const events = clone(payload.state.events);
		const packagePayoutCentiX = terminalPayout(events, launch.mode);
		if (responsePayoutCentiX !== packagePayoutCentiX) {
			fail(
				'REPLAY_PAYOUT_MISMATCH',
				'Replay response multiplier differs from the authoritative package payout.',
			);
		}

		let cues;
		try {
			cues = gameEventAdapter.adaptRoundEvents(clone(events), {
				expectedMode: launch.mode,
				expectedPayoutRaw: packagePayoutCentiX,
			});
		} catch (cause) {
			fail('REPLAY_EVENTS_INVALID', 'Replay events violate the BLACKSITE event contract.', cause);
		}
		if (!Array.isArray(cues) || cues.length === 0) {
			fail('REPLAY_EVENTS_INVALID', 'Replay event adapter returned no presentation cues.');
		}

		let replayQueryAmountUnitsRaw;
		try {
			replayQueryAmountUnitsRaw = normalizeReplayQueryAmountUnitsRaw(
				launch.amountUnitsRaw,
			);
		} catch (cause) {
			fail('REPLAY_QUERY_AMOUNT_INVALID', 'Replay query amount is invalid.', cause);
		}

		return deepFreeze({
			identity: {
				game: launch.game,
				version: launch.version,
				mode: launch.mode,
				event: launch.event,
			},
			costMultiplier: canonicalMode.costMultiplier,
			replayQueryAmountUnitsRaw,
			replayResponseMultiplierX,
			packagePayoutCentiX,
			walletMicroUnits: REPLAY_WALLET_MICRO_UNITS,
			context: {
				currency: launch.currency ?? null,
				language: launch.language ?? null,
				device: launch.device ?? null,
				social: launch.social === true,
			},
			events: clone(events),
			cues: clone(cues),
		});
	};

	return Object.freeze({ normalize });
}
