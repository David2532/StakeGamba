import { MODES, getMode, isCanonicalMode } from '../contracts/modes.js';

export const API_AMOUNT_SCALE = 1_000_000;

export class RgsContractError extends Error {
	/** @param {string} code @param {string} message @param {{details?: any, cause?: any}} [options] */
	constructor(code, message, { details = null, cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = 'RgsContractError';
		this.code = code;
		this.details = details;
	}
}

export class InsufficientBalanceError extends RgsContractError {
	/** @param {{requiredAmountApi?: number | null, availableAmountApi?: number | null, source?: string, cause?: any}} [options] */
	constructor({ requiredAmountApi = null, availableAmountApi = null, source = 'client', cause } = {}) {
		super('INSUFFICIENT_BALANCE', 'The authoritative balance cannot cover this play.', {
			details: { requiredAmountApi, availableAmountApi, source },
			cause,
		});
		this.name = 'InsufficientBalanceError';
		this.requiredAmountApi = requiredAmountApi;
		this.availableAmountApi = availableAmountApi;
		this.source = source;
	}
}

function fail(code, message, details = null) {
	throw new RgsContractError(code, message, { details });
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
	if (!isObject(value)) fail('OBJECT_REQUIRED', `${label} must be an object.`);
}

function assertSafeInteger(value, label, { positive = false } = {}) {
	if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
		fail(
			'MONEY_INTEGER_INVALID',
			`${label} must be a ${positive ? 'positive' : 'non-negative'} safe integer.`,
			{ label, value },
		);
	}
	return value;
}

function normalizeCurrency(value, label = 'currency') {
	if (typeof value !== 'string') fail('CURRENCY_INVALID', `${label} must be a currency code.`);
	const currency = value.trim().toUpperCase();
	if (!/^[A-Z]{2,8}$/.test(currency)) {
		fail('CURRENCY_INVALID', `${label} must contain two to eight ASCII letters.`, { value });
	}
	return currency;
}

function cloneValue(value) {
	if (Array.isArray(value)) return value.map(cloneValue);
	if (isObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
	}
	return value;
}

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const item of Object.values(value)) deepFreeze(item);
	}
	return value;
}

function normalizeBalance(rawBalance, label) {
	assertObject(rawBalance, label);
	return deepFreeze({
		amountApi: assertSafeInteger(rawBalance.amount, `${label}.amount`),
		currency: normalizeCurrency(rawBalance.currency, `${label}.currency`),
	});
}

function normalizeStepBet(config) {
	const hasStepBet = config.stepBet !== undefined && config.stepBet !== null;
	const hasMinStep = config.minStep !== undefined && config.minStep !== null;
	if (!hasStepBet && !hasMinStep) {
		fail('STEP_BET_MISSING', 'Authenticate config must include stepBet or the supported minStep alias.');
	}
	const stepBet = hasStepBet
		? assertSafeInteger(config.stepBet, 'config.stepBet', { positive: true })
		: null;
	const minStep = hasMinStep
		? assertSafeInteger(config.minStep, 'config.minStep', { positive: true })
		: null;
	if (stepBet !== null && minStep !== null && stepBet !== minStep) {
		fail('STEP_BET_CONFLICT', 'Authenticate stepBet and minStep disagree.', {
			stepBet,
			minStep,
		});
	}
	return stepBet ?? minStep;
}

function normalizeBetModes(rawModes) {
	assertObject(rawModes, 'config.betModes');
	const expectedIds = MODES.map((mode) => mode.id).sort();
	const actualIds = Object.keys(rawModes).sort();
	if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
		fail('BET_MODE_SET_MISMATCH', 'Authenticate betModes must exactly match the BLACKSITE modes.', {
			expected: expectedIds,
			actual: actualIds,
		});
	}

	const normalized = {};
	for (const mode of MODES) {
		const rawMode = rawModes[mode.id];
		assertObject(rawMode, `config.betModes.${mode.id}`);
		if (rawMode.costMultiplier !== mode.costMultiplier) {
			fail('BET_MODE_COST_MISMATCH', `Authenticate cost for ${mode.id} is not canonical.`, {
				expected: mode.costMultiplier,
				actual: rawMode.costMultiplier,
			});
		}
		if (rawMode.mode !== undefined && rawMode.mode !== mode.id) {
			fail('BET_MODE_IDENTITY_MISMATCH', `Authenticate mode identity for ${mode.id} disagrees.`);
		}
		if (rawMode.feature !== undefined && rawMode.feature !== mode.isBuyBonus) {
			fail('BET_MODE_FEATURE_MISMATCH', `Authenticate feature identity for ${mode.id} disagrees.`, {
				expected: mode.isBuyBonus,
				actual: rawMode.feature,
			});
		}
		normalized[mode.id] = Object.freeze({
			mode: mode.id,
			costMultiplier: mode.costMultiplier,
			feature: mode.isBuyBonus,
		});
	}
	return deepFreeze(normalized);
}

const JURISDICTION_BOOLEAN_FIELDS = Object.freeze([
	'socialCasino',
	'disabledFullscreen',
	'disabledTurbo',
	'disabledSuperTurbo',
	'disabledAutoplay',
	'disabledSlamstop',
	'disabledSpacebar',
	'disabledBuyFeature',
	'displayNetPosition',
	'displayRTP',
	'displaySessionTimer',
]);

const JURISDICTION_FIELDS = Object.freeze([
	...JURISDICTION_BOOLEAN_FIELDS,
	'minimumRoundDuration',
]);

function normalizeJurisdiction(rawJurisdiction) {
	assertObject(rawJurisdiction, 'config.jurisdiction');
	const expectedFields = [...JURISDICTION_FIELDS].sort();
	const actualFields = Object.keys(rawJurisdiction).sort();
	if (JSON.stringify(actualFields) !== JSON.stringify(expectedFields)) {
		const expectedSet = new Set(expectedFields);
		const actualSet = new Set(actualFields);
		fail(
			'JURISDICTION_KEY_SET_MISMATCH',
			'config.jurisdiction must contain exactly the known RGS jurisdiction fields.',
			{
				expected: expectedFields,
				actual: actualFields,
				missing: expectedFields.filter((field) => !actualSet.has(field)),
				unknown: actualFields.filter((field) => !expectedSet.has(field)),
			},
		);
	}
	const normalized = {};
	for (const field of JURISDICTION_BOOLEAN_FIELDS) {
		if (typeof rawJurisdiction[field] !== 'boolean') {
			fail(
				'JURISDICTION_FIELD_INVALID',
				`config.jurisdiction.${field} must be boolean.`,
				{ field, value: rawJurisdiction[field] },
			);
		}
		normalized[field] = rawJurisdiction[field];
	}
	if (!Number.isSafeInteger(rawJurisdiction.minimumRoundDuration)
		|| rawJurisdiction.minimumRoundDuration < 0) {
		fail(
			'JURISDICTION_FIELD_INVALID',
			'config.jurisdiction.minimumRoundDuration must be a non-negative safe integer in milliseconds.',
			{ field: 'minimumRoundDuration', value: rawJurisdiction.minimumRoundDuration },
		);
	}
	normalized.minimumRoundDuration = rawJurisdiction.minimumRoundDuration;
	return deepFreeze(normalized);
}

function readBetConfig(config) {
	assertObject(config, 'bet config');
	const minBetApi = config.minBetApi ?? config.minBet;
	const maxBetApi = config.maxBetApi ?? config.maxBet;
	let stepBetApi = config.stepBetApi;
	if (stepBetApi === undefined) stepBetApi = normalizeStepBet(config);
	const betLevelsApi = config.betLevelsApi ?? config.betLevels ?? [];
	return {
		minBetApi: assertSafeInteger(minBetApi, 'minBet', { positive: true }),
		maxBetApi: assertSafeInteger(maxBetApi, 'maxBet', { positive: true }),
		stepBetApi: assertSafeInteger(stepBetApi, 'stepBet', { positive: true }),
		betLevelsApi,
	};
}

export function validateBaseAmount(
	amountApi,
	config,
	{ requireReturnedLevel = true } = {},
) {
	assertSafeInteger(amountApi, 'base amount', { positive: true });
	const { minBetApi, maxBetApi, stepBetApi, betLevelsApi } = readBetConfig(config);
	if (minBetApi > maxBetApi) fail('BET_RANGE_INVALID', 'minBet cannot exceed maxBet.');
	if (amountApi < minBetApi || amountApi > maxBetApi) {
		fail('BASE_AMOUNT_OUT_OF_RANGE', 'Base amount is outside authenticate min/max bounds.', {
			amountApi,
			minBetApi,
			maxBetApi,
		});
	}
	if (amountApi % stepBetApi !== 0) {
		fail('BASE_AMOUNT_STEP_MISMATCH', 'Base amount is not divisible by authenticate stepBet.', {
			amountApi,
			stepBetApi,
		});
	}
	if (!Array.isArray(betLevelsApi)) fail('BET_LEVELS_INVALID', 'betLevels must be an array.');
	if (requireReturnedLevel && betLevelsApi.length > 0 && !betLevelsApi.includes(amountApi)) {
		fail('BASE_AMOUNT_NOT_RETURNED', 'Base amount is not one of the authenticate betLevels.', {
			amountApi,
		});
	}
	return amountApi;
}

export function totalPlayAmountApi(baseAmountApi, modeId) {
	assertSafeInteger(baseAmountApi, 'base amount', { positive: true });
	if (!isCanonicalMode(modeId)) fail('MODE_INVALID', `Unknown BLACKSITE mode: ${String(modeId)}.`);
	const total = BigInt(baseAmountApi) * BigInt(getMode(modeId).costMultiplier);
	if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
		fail('TOTAL_PLAY_AMOUNT_UNSAFE', 'Mode-adjusted play amount exceeds the safe integer range.');
	}
	return Number(total);
}

function normalizeConfig(rawConfig) {
	assertObject(rawConfig, 'authenticate.config');
	const minBetApi = assertSafeInteger(rawConfig.minBet, 'config.minBet', { positive: true });
	const maxBetApi = assertSafeInteger(rawConfig.maxBet, 'config.maxBet', { positive: true });
	if (minBetApi > maxBetApi) fail('BET_RANGE_INVALID', 'Authenticate minBet exceeds maxBet.');
	const stepBetApi = normalizeStepBet(rawConfig);
	const defaultBetLevelApi = assertSafeInteger(
		rawConfig.defaultBetLevel,
		'config.defaultBetLevel',
		{ positive: true },
	);
	if (rawConfig.betLevels !== undefined && !Array.isArray(rawConfig.betLevels)) {
		fail('BET_LEVELS_INVALID', 'Authenticate betLevels must be an array.');
	}
	const betLevelsApi = (rawConfig.betLevels ?? []).map((level, index) =>
		assertSafeInteger(level, `config.betLevels[${index}]`, { positive: true }));
	if (new Set(betLevelsApi).size !== betLevelsApi.length) {
		fail('BET_LEVELS_DUPLICATE', 'Authenticate betLevels must not contain duplicates.');
	}
	const validationConfig = { minBetApi, maxBetApi, stepBetApi, betLevelsApi };
	validateBaseAmount(minBetApi, validationConfig, { requireReturnedLevel: false });
	validateBaseAmount(maxBetApi, validationConfig, { requireReturnedLevel: false });
	for (const level of betLevelsApi) {
		validateBaseAmount(level, validationConfig, { requireReturnedLevel: false });
	}
	validateBaseAmount(defaultBetLevelApi, validationConfig, {
		requireReturnedLevel: betLevelsApi.length > 0,
	});
	const betModes = normalizeBetModes(rawConfig.betModes);
	const jurisdiction = normalizeJurisdiction(rawConfig.jurisdiction);

	return deepFreeze({
		minBetApi,
		maxBetApi,
		stepBetApi,
		defaultBetLevelApi,
		betLevelsApi: Object.freeze([...betLevelsApi]),
		betModes,
		jurisdiction,
	});
}

function eventsFromState(state) {
	if (Array.isArray(state)) return state;
	if (isObject(state) && Array.isArray(state.events)) return state.events;
	fail('ROUND_STATE_INVALID', 'RGS round.state must be an event array or an object containing events.');
}

function decimalMultiplierToRaw(value) {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		fail('PAYOUT_MULTIPLIER_INVALID', 'round.payoutMultiplier must be a finite non-negative multiplier-x number.');
	}
	const match = String(value).toLowerCase().match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
	if (!match) fail('PAYOUT_MULTIPLIER_INVALID', 'round.payoutMultiplier is not a decimal number.');
	const fraction = match[2] ?? '';
	const exponent = Number(match[3] ?? 0);
	const digits = BigInt(`${match[1]}${fraction}`);
	const decimalPlaces = fraction.length - exponent;
	const power = 2 - decimalPlaces;
	let raw;
	if (power >= 0) {
		raw = digits * (10n ** BigInt(power));
	} else {
		const divisor = 10n ** BigInt(-power);
		if (digits % divisor !== 0n) {
			fail('PAYOUT_MULTIPLIER_PRECISION', 'round.payoutMultiplier cannot be represented exactly in centi-x.');
		}
		raw = digits / divisor;
	}
	if (raw > BigInt(Number.MAX_SAFE_INTEGER)) {
		fail('PAYOUT_MULTIPLIER_UNSAFE', 'round.payoutMultiplier exceeds the safe centi-x range.');
	}
	return Number(raw);
}

function normalizeRoundId(rawRound) {
	const value = rawRound.roundID
		?? rawRound.roundId
		?? rawRound.betID
		?? rawRound.betId
		?? rawRound.id
		?? null;
	if (value === null) return null;
	if (Number.isSafeInteger(value) && value >= 0) return value;
	if (typeof value === 'string' && value.trim() && value.length <= 256) return value;
	fail('ROUND_ID_INVALID', 'RGS round identity must be a safe integer or bounded non-empty string.');
}

export const PRESENTATION_CURSOR_PREFIX = 'blacksite-book-events-v1:';

export function encodePresentationCursor(nextEventIndex) {
	if (!Number.isSafeInteger(nextEventIndex) || nextEventIndex < 0) {
		fail('ROUND_EVENT_CURSOR_INVALID', 'The next presentation event index must be a non-negative safe integer.');
	}
	return `${PRESENTATION_CURSOR_PREFIX}${nextEventIndex}`;
}

function normalizeEventCursor(value) {
	if (value === undefined || value === null || value === '') return null;
	if (Number.isSafeInteger(value) && value >= 0) return value;
	if (typeof value !== 'string' || value.length > 512) return 0;
	const match = value.match(/^(?:blacksite-book-events-v1:)?(0|[1-9]\d*)$/);
	if (!match) return 0;
	const parsed = Number(match[1]);
	if (!Number.isSafeInteger(parsed)) return 0;
	return parsed;
}

/** @param {any} rawRound @param {{adapter?: any, expectedMode?: string | null}} [options] */
export function normalizeRound(rawRound, { adapter, expectedMode = null } = {}) {
	assertObject(rawRound, 'round');
	if (typeof rawRound.active !== 'boolean') fail('ROUND_ACTIVE_INVALID', 'round.active must be boolean.');
	if (!isCanonicalMode(rawRound.mode)) {
		fail('ROUND_MODE_INVALID', `round.mode is not canonical: ${String(rawRound.mode)}.`);
	}
	if (expectedMode !== null && rawRound.mode !== expectedMode) {
		fail('ROUND_MODE_MISMATCH', 'RGS round mode differs from the requested mode.', {
			expectedMode,
			actualMode: rawRound.mode,
		});
	}
	if (!adapter || typeof adapter.adaptRoundEvents !== 'function') {
		fail('ROUND_ADAPTER_REQUIRED', 'normalizeRound requires GameEventAdapter.adaptRoundEvents.');
	}

	const amountApi = assertSafeInteger(rawRound.amount, 'round.amount', { positive: true });
	const payoutMultiplierX = rawRound.payoutMultiplier;
	const responseRaw = decimalMultiplierToRaw(payoutMultiplierX);
	const events = cloneValue(eventsFromState(rawRound.state));
	let cues;
	try {
		cues = adapter.adaptRoundEvents(events, {
			expectedMode: rawRound.mode,
			expectedPayoutRaw: responseRaw,
		});
	} catch (cause) {
		throw new RgsContractError('ROUND_EVENT_CONTRACT_INVALID', 'RGS round events violate the BLACKSITE event contract.', {
			cause,
		});
	}
	if (!Array.isArray(cues)) {
		fail('ROUND_ADAPTER_RESULT_INVALID', 'GameEventAdapter.adaptRoundEvents must return presentation cues.');
	}
	const settled = cues.filter((cue) => cue?.kind === 'settled');
	if (settled.length !== 1 || cues.at(-1)?.kind !== 'settled') {
		fail('ROUND_TERMINAL_EVENT_INVALID', 'RGS round must have exactly one terminal settled cue.');
	}
	const terminalRaw = settled[0]?.event?.payout_multiplier_raw;
	assertSafeInteger(terminalRaw, 'round_end.payout_multiplier_raw');

	if (responseRaw !== terminalRaw) {
		fail(
			'ROUND_PAYOUT_MULTIPLIER_MISMATCH',
			'round.payoutMultiplier multiplier-x differs from round_end centi-x.',
			{ payoutMultiplierX, responseRaw, terminalRaw },
		);
	}
	if (rawRound.payout === undefined || rawRound.payout === null) {
		fail('ROUND_PAYOUT_MISSING', 'round.payout is required for an exact player-visible result.');
	}
	const payoutApi = assertSafeInteger(rawRound.payout, 'round.payout');
	// The vendored RGS schema defines payoutMultiplier as Payout / Amount. BLACKSITE
	// carries Amount and Payout as whole API micro-units, while round_end stores
	// multiplier-x in centi-x. Apply the documented non-negative half-up conversion
	// with BigInt so fractional micro-units round deterministically without float or
	// Number multiplication overflow.
	const payoutNumerator = BigInt(amountApi) * BigInt(terminalRaw);
	const expectedPayoutApi = (payoutNumerator + 50n) / 100n;
	const payoutApiBigInt = BigInt(payoutApi);
	if (payoutApiBigInt !== expectedPayoutApi) {
		fail(
			'ROUND_PAYOUT_AMOUNT_MISMATCH',
			'round.payout micro-units must equal the half-up rounded product of round.amount and the terminal centi-x payout multiplier.',
			{
				amountApi,
				payoutApi,
				terminalRaw,
				payoutNumerator: payoutNumerator.toString(),
				expectedPayoutApi: expectedPayoutApi.toString(),
				relation: payoutApiBigInt < expectedPayoutApi ? 'too-small' : 'too-large',
			},
		);
	}

	const normalizedEventCursor = normalizeEventCursor(rawRound.event);
	const eventCursor = normalizedEventCursor !== null && normalizedEventCursor > events.length
		? 0
		: normalizedEventCursor;

	return deepFreeze({
		roundId: normalizeRoundId(rawRound),
		active: rawRound.active,
		mode: rawRound.mode,
		amountApi,
		payoutApi,
		payoutMultiplierX,
		payoutMultiplierRaw: terminalRaw,
		eventCursor,
		state: { events },
		cues: cloneValue(cues),
	});
}

/** @param {any} rawResponse @param {{expectedEvent?: string}} [options] */
export function normalizeEventResponse(rawResponse, { expectedEvent } = {}) {
	assertObject(rawResponse, 'event response');
	if (rawResponse.event === undefined || rawResponse.event === null) {
		return deepFreeze({ event: null, echoed: false });
	}
	if (typeof rawResponse.event !== 'string' || rawResponse.event.length === 0 || rawResponse.event.length > 512) {
		fail('EVENT_RESPONSE_INVALID', 'Event response must contain the persisted event cursor.');
	}
	if (expectedEvent !== undefined && rawResponse.event !== expectedEvent) {
		fail('EVENT_RESPONSE_MISMATCH', 'Event response does not acknowledge the requested cursor.');
	}
	return deepFreeze({ event: rawResponse.event, echoed: true });
}

/** @param {any} rawResponse @param {{adapter?: any}} [options] */
export function normalizeAuthenticateResponse(rawResponse, { adapter } = {}) {
	assertObject(rawResponse, 'authenticate response');
	const balance = normalizeBalance(rawResponse.balance, 'authenticate.balance');
	const config = normalizeConfig(rawResponse.config);
	const round = rawResponse.round === undefined || rawResponse.round === null
		? null
		: normalizeRound(rawResponse.round, { adapter });
	return deepFreeze({ balance, config, round });
}

export function normalizePlayResponse(
	/** @type {any} */
	rawResponse,
	/** @type {{adapter?: any, expectedMode?: string | null, expectedAmountApi?: number | null, expectedCurrency?: string | null}} */
	{ adapter, expectedMode = null, expectedAmountApi = null, expectedCurrency = null } = {},
) {
	assertObject(rawResponse, 'play response');
	const balance = normalizeBalance(rawResponse.balance, 'play.balance');
	if (expectedCurrency !== null && balance.currency !== normalizeCurrency(expectedCurrency)) {
		fail('PLAY_CURRENCY_MISMATCH', 'Play response balance currency changed unexpectedly.');
	}
	const round = normalizeRound(rawResponse.round, { adapter, expectedMode });
	if (expectedAmountApi !== null) {
		assertSafeInteger(expectedAmountApi, 'expected play amount', { positive: true });
		if (round.amountApi !== expectedAmountApi) {
			fail('PLAY_AMOUNT_MISMATCH', 'RGS round amount differs from the selected base amount.', {
				expectedAmountApi,
				actualAmountApi: round.amountApi,
			});
		}
	}
	return deepFreeze({ balance, round });
}

export function normalizeEndRoundResponse(rawResponse, { expectedCurrency = null } = {}) {
	assertObject(rawResponse, 'end-round response');
	const balance = normalizeBalance(rawResponse.balance, 'end-round.balance');
	if (expectedCurrency !== null && balance.currency !== normalizeCurrency(expectedCurrency)) {
		fail('END_ROUND_CURRENCY_MISMATCH', 'End-round response balance currency changed unexpectedly.');
	}
	if (rawResponse.round !== undefined && rawResponse.round !== null) {
		if (!isObject(rawResponse.round) || typeof rawResponse.round.active !== 'boolean') {
			fail('END_ROUND_ACTIVE_INVALID', 'End-round response round.active must be false.');
		}
		if (rawResponse.round.active) {
			fail('END_ROUND_STILL_ACTIVE', 'End-round response still reports an active round.');
		}
	}
	return deepFreeze({ balance });
}
