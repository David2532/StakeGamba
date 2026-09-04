export const MAX_PACKAGE_PAYOUT_CENTI_X = 1_000_000;
export const REPLAY_WALLET_MICRO_UNITS = null;

export class ReplayMoneyDomainError extends Error {
	constructor(code, domain, message) {
		super(message);
		this.name = 'ReplayMoneyDomainError';
		this.code = code;
		this.domain = domain;
	}
}

function fail(code, domain, message) {
	throw new ReplayMoneyDomainError(code, domain, message);
}

/**
 * Replay query `amount` is intentionally opaque. Stake's public Replay
 * contract calls it "units" without equating it to wallet micro-units.
 */
export function normalizeReplayQueryAmountUnitsRaw(value) {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string' || value.trim() === '') {
		fail(
			'REPLAY_QUERY_AMOUNT_INVALID',
			'replayQueryAmountUnitsRaw',
			'Replay query amount must be a non-empty opaque string when present.',
		);
	}
	return value;
}

function replayAmountDecimal(value) {
	const amount = normalizeReplayQueryAmountUnitsRaw(value);
	if (amount === null) return null;
	const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount);
	if (!match) {
		fail(
			'REPLAY_QUERY_AMOUNT_DECIMAL_INVALID',
			'replayQueryAmountUnitsRaw',
			'Replay query amount must be an unsigned plain decimal for exact display arithmetic.',
		);
	}
	const fraction = match[2] ?? '';
	return {
		digits: BigInt(`${match[1]}${fraction}`),
		scale: fraction.length,
	};
}

function formatScaledUnits(digits, scale) {
	let text = digits.toString().padStart(scale + 1, '0');
	if (scale > 0) {
		text = `${text.slice(0, -scale)}.${text.slice(-scale)}`;
		while (text.includes('.') && text.endsWith('0')) text = text.slice(0, -1);
		if (text.endsWith('.')) text = text.slice(0, -1);
	}
	return text;
}

export function replayQueryUnitsTimesInteger(value, multiplier) {
	const amount = replayAmountDecimal(value);
	if (amount === null) return null;
	if (!Number.isSafeInteger(multiplier) || multiplier <= 0) {
		fail(
			'REPLAY_COST_MULTIPLIER_INVALID',
			'replayCostMultiplier',
			'Replay cost multiplier must be a positive safe integer.',
		);
	}
	return formatScaledUnits(amount.digits * BigInt(multiplier), amount.scale);
}

export function replayQueryUnitsTimesCentiX(value, multiplierCentiX) {
	const amount = replayAmountDecimal(value);
	if (amount === null) return null;
	const centiX = normalizePackagePayoutCentiX(multiplierCentiX);
	return formatScaledUnits(amount.digits * BigInt(centiX), amount.scale + 2);
}

function decimalParts(value) {
	const text = String(value);
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
	if (!match) return null;
	return { whole: match[1], fraction: (match[2] ?? '').padEnd(2, '0') };
}

export function normalizeReplayResponseMultiplierX(value) {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		fail(
			'REPLAY_RESPONSE_MULTIPLIER_INVALID',
			'replayResponseMultiplierX',
			'Replay response payoutMultiplier must be a finite non-negative JSON number.',
		);
	}
	if (!decimalParts(value)) {
		fail(
			'REPLAY_RESPONSE_MULTIPLIER_PRECISION_INVALID',
			'replayResponseMultiplierX',
			'Replay response payoutMultiplier supports at most two decimal places.',
		);
	}
	return value;
}

export function replayResponseMultiplierXToCentiX(value) {
	const multiplier = normalizeReplayResponseMultiplierX(value);
	const parts = decimalParts(multiplier);
	const centiX = Number(BigInt(parts.whole) * 100n + BigInt(parts.fraction));
	return normalizePackagePayoutCentiX(centiX);
}

export function normalizePackagePayoutCentiX(value) {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value > MAX_PACKAGE_PAYOUT_CENTI_X
	) {
		fail(
			'PACKAGE_PAYOUT_CENTI_X_INVALID',
			'packagePayoutCentiX',
			`Package payout must be an unsigned integer no greater than ${MAX_PACKAGE_PAYOUT_CENTI_X} centi-x.`,
		);
	}
	return value;
}

/**
 * Replay never supplies or derives wallet money. This assertion exists so a
 * future response mapper cannot quietly introduce a fourth-domain conversion.
 */
export function assertReplayWalletMicroUnitsAbsent(value) {
	if (value !== null && value !== undefined) {
		fail(
			'REPLAY_WALLET_MICRO_UNITS_FORBIDDEN',
			'walletMicroUnits',
			'Replay must not contain or infer wallet micro-units.',
		);
	}
	return REPLAY_WALLET_MICRO_UNITS;
}
