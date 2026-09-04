export const CURRENCY_META = Object.freeze({
	USD: { symbol: '$', decimals: 2, symbolAfter: false },
	CAD: { symbol: 'CA$', decimals: 2, symbolAfter: false },
	NZD: { symbol: 'NZ$', decimals: 2, symbolAfter: false },
	JPY: { symbol: '\u00a5', decimals: 0, symbolAfter: false },
	EUR: { symbol: '\u20ac', decimals: 2, symbolAfter: false },
	RUB: { symbol: '\u20bd', decimals: 2, symbolAfter: false },
	CNY: { symbol: 'CN\u00a5', decimals: 2, symbolAfter: false },
	PHP: { symbol: '\u20b1', decimals: 2, symbolAfter: false },
	INR: { symbol: '\u20b9', decimals: 2, symbolAfter: false },
	PKR: { symbol: '\u20a8', decimals: 2, symbolAfter: false },
	IDR: { symbol: 'Rp', decimals: 0, symbolAfter: false },
	KRW: { symbol: '\u20a9', decimals: 0, symbolAfter: false },
	BRL: { symbol: 'R$', decimals: 2, symbolAfter: false },
	BOB: { symbol: 'Bs', decimals: 2, symbolAfter: false },
	MXN: { symbol: 'MX$', decimals: 2, symbolAfter: false },
	DKK: { symbol: 'KR', decimals: 2, symbolAfter: true },
	PLN: { symbol: 'z\u0142', decimals: 2, symbolAfter: true },
	VND: { symbol: '\u20ab', decimals: 0, symbolAfter: true },
	TRY: { symbol: '\u20ba', decimals: 2, symbolAfter: false },
	CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true },
	ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
	PEN: { symbol: 'S/', decimals: 2, symbolAfter: false },
	NGN: { symbol: '\u20a6', decimals: 2, symbolAfter: false },
	GHS: { symbol: 'GH\u20b5', decimals: 2, symbolAfter: false },
	KES: { symbol: 'KSh', decimals: 2, symbolAfter: false },
	MAD: { symbol: 'MAD', decimals: 2, symbolAfter: false },
	EGP: { symbol: '\u062c.\u0645', decimals: 2, symbolAfter: false },
	SAR: { symbol: 'SAR', decimals: 2, symbolAfter: true },
	ILS: { symbol: 'ILS', decimals: 2, symbolAfter: true },
	AED: { symbol: 'AED', decimals: 2, symbolAfter: true },
	TWD: { symbol: 'NT$', decimals: 2, symbolAfter: false },
	NOK: { symbol: 'kr', decimals: 2, symbolAfter: false },
	KWD: { symbol: 'KD', decimals: 2, symbolAfter: false },
	JOD: { symbol: 'JD', decimals: 2, symbolAfter: false },
	CRC: { symbol: '\u20a1', decimals: 2, symbolAfter: false },
	TND: { symbol: 'TND', decimals: 2, symbolAfter: true },
	SGD: { symbol: 'SG$', decimals: 2, symbolAfter: false },
	MYR: { symbol: 'RM', decimals: 2, symbolAfter: false },
	OMR: { symbol: 'OMR', decimals: 2, symbolAfter: true },
	QAR: { symbol: 'QAR', decimals: 2, symbolAfter: true },
	BHD: { symbol: 'BD', decimals: 2, symbolAfter: false },
	BAM: { symbol: 'KM', decimals: 2, symbolAfter: false },
	ISK: { symbol: 'kr', decimals: 0, symbolAfter: false },
	TZS: { symbol: 'TSh', decimals: 2, symbolAfter: false },
	UGX: { symbol: 'USh', decimals: 0, symbolAfter: false },
	XOF: { symbol: 'CFA', decimals: 0, symbolAfter: false },
	XGC: { symbol: 'GC', decimals: 2, symbolAfter: true },
	XSC: { symbol: 'SC', decimals: 2, symbolAfter: true },
	XEC: { symbol: 'SC', decimals: 2, symbolAfter: true },
});

export const normalizeCurrency = (currency) =>
	String(currency || '').trim().toUpperCase();

export const currencyMetaFor = (currency) =>
	CURRENCY_META[normalizeCurrency(currency)] || null;

export const formatCurrencyAmount = (amount, currency) => {
	const code = normalizeCurrency(currency);
	const meta = currencyMetaFor(code);
	const value = Number(amount);
	const safeValue = Number.isFinite(value) ? value : 0;

	if (!meta) return `${safeValue.toFixed(2)} ${code || 'UNKNOWN'}`;

	const formattedAmount = safeValue.toFixed(meta.decimals);
	return meta.symbolAfter
		? `${formattedAmount} ${meta.symbol}`
		: `${meta.symbol}${formattedAmount}`;
};

// Win amounts may contain authoritative sub-cent value even when Balance and
// Play Amount use the currency's normal display precision. Preserve up to four
// fractional digits for WIN surfaces, while retaining each currency's native
// minimum precision and its symbol-placement policy.
export const formatWinCurrencyAmount = (amount, currency) => {
	const code = normalizeCurrency(currency);
	const meta = currencyMetaFor(code);
	const value = Number(amount);
	const safeValue = Number.isFinite(value) ? value : 0;
	const minimumDigits = meta?.decimals ?? 2;
	const maximumDigits = Math.max(minimumDigits, 4);
	let formattedAmount = safeValue.toFixed(maximumDigits);
	const decimalIndex = formattedAmount.indexOf('.');

	while (
		decimalIndex >= 0 &&
		formattedAmount.endsWith('0') &&
		formattedAmount.length - decimalIndex - 1 > minimumDigits
	) {
		formattedAmount = formattedAmount.slice(0, -1);
	}

	if (!meta) return `${formattedAmount} ${code || 'UNKNOWN'}`;

	return meta.symbolAfter
		? `${formattedAmount} ${meta.symbol}`
		: `${meta.symbol}${formattedAmount}`;
};

export const currencyDisplaySymbol = (currency) => {
	const code = normalizeCurrency(currency);
	return currencyMetaFor(code)?.symbol || code;
};

export const isStakeUsCurrency = (currency) => {
	const code = normalizeCurrency(currency);
	return code === 'XGC' || code === 'XSC' || code === 'XEC';
};

export const insufficientFundsMessage = () => 'Insufficient Balance';
