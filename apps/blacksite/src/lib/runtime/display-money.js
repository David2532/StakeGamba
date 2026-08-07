import { CURRENCY_META, normalizeCurrency } from 'utils-shared/currency.js';

export const API_AMOUNT_SCALE = 1_000_000;

function requireApiAmount(value, label = 'amountApi') {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new TypeError(`${label} must be a non-negative safe integer`);
	}
	return BigInt(value);
}

function pow10(exponent) {
	return 10n ** BigInt(exponent);
}

function decimalParts(amountApi, decimals, { round = false } = {}) {
	let scaled = requireApiAmount(amountApi);
	if (decimals < 0 || decimals > 6 || !Number.isInteger(decimals)) {
		throw new TypeError('display decimals must be an integer in 0..6');
	}
	const divisor = pow10(6 - decimals);
	if (round && divisor > 1n) scaled += divisor / 2n;
	const displayUnits = scaled / divisor;
	const decimalScale = pow10(decimals);
	return {
		whole: displayUnits / decimalScale,
		fraction: decimals === 0 ? '' : (displayUnits % decimalScale).toString().padStart(decimals, '0'),
	};
}

function exactDecimal(amountApi, minimumDecimals, maximumDecimals) {
	const { whole, fraction } = decimalParts(amountApi, maximumDecimals);
	let trimmed = fraction;
	while (trimmed.length > minimumDecimals && trimmed.endsWith('0')) trimmed = trimmed.slice(0, -1);
	return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

function roundedDecimal(amountApi, decimals) {
	const { whole, fraction } = decimalParts(amountApi, decimals, { round: true });
	return fraction ? `${whole}.${fraction}` : whole.toString();
}

function decorateCurrency(value, currency) {
	const code = normalizeCurrency(currency);
	const meta = CURRENCY_META[code];
	if (!meta) return `${value} ${code || 'UNKNOWN'}`;
	return meta.symbolAfter ? `${value} ${meta.symbol}` : `${meta.symbol}${value}`;
}

export function formatBalanceApi(amountApi, currency) {
	const code = normalizeCurrency(currency);
	const decimals = CURRENCY_META[code]?.decimals ?? 2;
	return decorateCurrency(roundedDecimal(amountApi, decimals), code);
}

export function formatExactApi(amountApi, currency) {
	const code = normalizeCurrency(currency);
	const minimumDecimals = CURRENCY_META[code]?.decimals ?? 2;
	const maximumDecimals = 6;
	return decorateCurrency(exactDecimal(amountApi, minimumDecimals, maximumDecimals), code);
}

export function formatSignedExactApi(amountApi, currency) {
	if (!Number.isSafeInteger(amountApi)) {
		throw new TypeError('amountApi must be a safe integer');
	}
	const sign = amountApi > 0 ? '+' : amountApi < 0 ? '−' : '';
	return `${sign}${formatExactApi(Math.abs(amountApi), currency)}`;
}

export function formatCentiMultiplier(payoutCentiX) {
	if (!Number.isSafeInteger(payoutCentiX) || payoutCentiX < 0) {
		throw new TypeError('payoutCentiX must be a non-negative safe integer');
	}
	const whole = Math.floor(payoutCentiX / 100);
	const fraction = String(payoutCentiX % 100).padStart(2, '0').replace(/0+$/, '');
	return `${whole}${fraction ? `.${fraction}` : ''}×`;
}

export function formatReplayQueryUnits(amountUnitsRaw, currency = null) {
	if (!amountUnitsRaw) return 'not supplied';
	return currency
		? `${decorateCurrency(amountUnitsRaw, currency)} units`
		: `${amountUnitsRaw} units`;
}
