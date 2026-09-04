import assert from 'node:assert/strict';
import test from 'node:test';
import {
	formatBalanceApi,
	formatCentiMultiplier,
	formatExactApi,
	formatReplayQueryUnits,
	formatSignedExactApi,
} from '../src/lib/runtime/display-money.js';
import {
	RULES_CONTRACT,
	getRulesDisclaimer,
} from '../src/lib/contracts/rules.js';
import {
	CURRENCY_META,
	currencyMetaFor,
	normalizeCurrency,
} from 'utils-shared/currency.js';
import {
	STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS,
	playerVisibleRestrictedHits,
} from 'utils-shared/stake-social.js';

const CURRENT_OFFICIAL_SOCIAL_RESTRICTED_PHRASES = Object.freeze([
	'win feature',
	'pay out',
	'paid out',
	'stake',
	'pays out',
	'betting',
	'total bet',
	'bet',
	'bets',
	'cash',
	'payer',
	'pay',
	'pays',
	'paid',
	'money',
	'buy',
	'bought',
	'purchase',
	'at the cost of',
	'rebet',
	'cost of',
	'credit',
	'buy bonus',
	'gamble',
	'wager',
	'deposit',
	'withdraw',
	'bonus buy',
	'be awarded to player’s accounts',
	'place your bets',
	'bet/s',
	'currency',
	'fund',
]);

test('balance display uses native currency precision and exact integer micro-unit rounding', () => {
	assert.equal(formatBalanceApi(49_600, 'USD'), '$0.05');
	assert.equal(formatBalanceApi(44_999, 'USD'), '$0.04');
	assert.equal(formatBalanceApi(1_499_999, 'JPY'), '¥1');
	assert.equal(formatBalanceApi(1_500_000, 'JPY'), '¥2');
	assert.equal(formatBalanceApi(1_234_567, 'DKK'), '1.23 KR');
	assert.equal(formatBalanceApi(Number.MAX_SAFE_INTEGER, 'USD'), '$9007199254.74');

	for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '1000000']) {
		assert.throws(() => formatBalanceApi(invalid, 'USD'), /non-negative safe integer/);
	}
});

test('WIN and total-play display preserve authoritative micro-units through six decimals', () => {
	const cases = [
		[1, '$0.000001'],
		[10, '$0.00001'],
		[100, '$0.0001'],
		[49_600, '$0.0496'],
		[1_230_000, '$1.23'],
		[1_000_001, '$1.000001'],
		[Number.MAX_SAFE_INTEGER, '$9007199254.740991'],
	];
	for (const [amountApi, expected] of cases) {
		assert.equal(formatExactApi(amountApi, 'USD'), expected);
	}

	// These neighboring integers would be vulnerable to Number-based decimal conversion.
	assert.equal(formatExactApi(9_007_199_254_740_990, 'USD'), '$9007199254.74099');
	assert.notEqual(
		formatExactApi(9_007_199_254_740_990, 'USD'),
		formatExactApi(Number.MAX_SAFE_INTEGER, 'USD'),
	);
	assert.equal(formatSignedExactApi(-49_600, 'USD'), '−$0.0496');
	assert.equal(formatSignedExactApi(49_600, 'XSC'), '+0.0496 SC');
	assert.equal(formatSignedExactApi(0, 'EUR'), '€0.00');
	assert.equal(formatExactApi(49_600, 'JPY'), '¥0.0496');
	assert.equal(formatExactApi(49_600, 'IDR'), 'Rp0.0496');
	assert.equal(formatExactApi(49_600, 'VND'), '0.0496 ₫');
	assert.equal(formatExactApi(49_600, 'ISK'), 'kr0.0496');
	assert.throws(() => formatSignedExactApi(0.5, 'USD'), /safe integer/);
});

test('fiat and unknown currencies retain exact symbol/code placement', () => {
	assert.equal(normalizeCurrency(' eur '), 'EUR');
	assert.deepEqual(currencyMetaFor('eur'), CURRENCY_META.EUR);
	assert.equal(currencyMetaFor('ZZZ'), null);
	assert.equal(formatBalanceApi(1_234_567, 'EUR'), '€1.23');
	assert.equal(formatExactApi(1_234_567, 'PLN'), '1.234567 zł');
	assert.equal(formatBalanceApi(1_234_567, 'zzz'), '1.23 ZZZ');
	assert.equal(formatExactApi(1, 'zzz'), '0.000001 ZZZ');
	assert.equal(formatBalanceApi(1_000_000, ''), '1.00 UNKNOWN');
	assert.deepEqual(Object.keys(CURRENCY_META), [
		'USD', 'CAD', 'NZD', 'JPY', 'EUR', 'RUB', 'CNY', 'PHP', 'INR', 'PKR',
		'IDR', 'KRW', 'BRL', 'BOB', 'MXN', 'DKK', 'PLN', 'VND', 'TRY', 'CLP',
		'ARS', 'PEN', 'NGN', 'GHS', 'KES', 'MAD', 'EGP', 'SAR', 'ILS', 'AED',
		'TWD', 'NOK', 'KWD', 'JOD', 'CRC', 'TND', 'SGD', 'MYR', 'OMR', 'QAR',
		'BHD', 'BAM', 'ISK', 'TZS', 'UGX', 'XOF', 'XGC', 'XSC', 'XEC',
	]);
	assert.deepEqual(
		[
			['PKR', '₨10.00'], ['EGP', 'ج.م10.00'], ['NZD', 'NZ$10.00'],
			['BOB', 'Bs10.00'], ['GHS', 'GH₵10.00'], ['KES', 'KSh10.00'],
			['MAD', 'MAD10.00'], ['BAM', 'KM10.00'], ['ISK', 'kr10'],
			['TZS', 'TSh10.00'], ['UGX', 'USh10'], ['XOF', 'CFA10'],
		].map(([code]) => formatBalanceApi(10_000_000, code)),
		['₨10.00', 'ج.م10.00', 'NZ$10.00', 'Bs10.00', 'GH₵10.00', 'KSh10.00',
			'MAD10.00', 'KM10.00', 'kr10', 'TSh10.00', 'USh10', 'CFA10'],
	);
});

test('XSC, XGC and XEC use social token suffixes and never gain a dollar prefix', () => {
	const rendered = [
		formatBalanceApi(1_234_567, 'XSC'),
		formatExactApi(1_234_567, 'xsc'),
		formatBalanceApi(1_234_567, 'XGC'),
		formatExactApi(1, 'xgc'),
		formatBalanceApi(1_234_567, 'XEC'),
		formatExactApi(1, 'xec'),
	];
	assert.deepEqual(rendered, [
		'1.23 SC',
		'1.234567 SC',
		'1.23 GC',
		'0.000001 GC',
		'1.23 SC',
		'0.000001 SC',
	]);
	for (const value of rendered) assert.equal(value.includes('$'), false);
});

test('centi-x presentation is exact and does not manufacture trailing precision', () => {
	assert.deepEqual(
		[0, 1, 10, 29, 100, 1150, 1_000_000].map(formatCentiMultiplier),
		['0×', '0.01×', '0.1×', '0.29×', '1×', '11.5×', '10000×'],
	);
	for (const invalid of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '100']) {
		assert.throws(() => formatCentiMultiplier(invalid), /non-negative safe integer/);
	}
});

test('Replay amount stays an opaque query-unit string at the display boundary', () => {
	assert.equal(formatReplayQueryUnits('000001.2500'), '000001.2500 units');
	assert.equal(formatReplayQueryUnits('0'), '0 units');
	assert.equal(formatReplayQueryUnits('1e6'), '1e6 units');
	assert.equal(formatReplayQueryUnits(null), 'not supplied');
	assert.equal(formatReplayQueryUnits(''), 'not supplied');
	assert.equal(formatReplayQueryUnits('000001.2500').includes('$'), false);
	assert.equal(formatReplayQueryUnits('3.968', 'XSC'), '3.968 SC units');
	assert.equal(formatReplayQueryUnits('0.014384', 'USD'), '$0.014384 units');
});

test('Social vocabulary tracks the current official restricted phrases and safe replacements', () => {
	for (const phrase of CURRENT_OFFICIAL_SOCIAL_RESTRICTED_PHRASES) {
		assert(
			STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS.includes(phrase),
			`missing current official restricted phrase: ${phrase}`,
		);
		assert(
			playerVisibleRestrictedHits(`Before ${phrase} after`).includes(phrase),
			`scanner failed to detect: ${phrase}`,
		);
	}

	const approvedReplacementVocabulary = [
		'play feature',
		'win',
		'won',
		'play amount',
		'playing',
		'total play',
		'plays',
		'coins',
		'winner',
		'wins',
		'instantly triggered',
		'can be played for',
		'balance',
		'get bonus',
		'redeem',
		'appear in player’s accounts',
		'come and play',
		'token',
	];
	assert.deepEqual(playerVisibleRestrictedHits(approvedReplacementVocabulary.join(' | ')), []);
	assert.deepEqual(playerVisibleRestrictedHits('stakeholder cashback payment funding'), []);
});

test('normal rules retain the canonical disclaimer while Social rules are restricted-term clean', () => {
	const normalDisclaimer = getRulesDisclaimer(false);
	const socialDisclaimer = getRulesDisclaimer(true);
	assert.equal(normalDisclaimer, RULES_CONTRACT.disclaimer);
	assert.match(normalDisclaimer, /Stake Engine\.$/);
	assert.match(socialDisclaimer, /the game provider\.$/);
	assert.equal(socialDisclaimer.includes('Stake Engine'), false);
	assert.deepEqual(playerVisibleRestrictedHits(normalDisclaimer), ['stake']);

	const normalRulesWithoutDisclaimer = [
		...RULES_CONTRACT.mechanic,
		...RULES_CONTRACT.feature,
		...RULES_CONTRACT.controls,
		...RULES_CONTRACT.modes.map((mode) => mode.normalLabel),
	].join(' ');
	const socialRules = [
		...RULES_CONTRACT.mechanic,
		...RULES_CONTRACT.feature,
		...RULES_CONTRACT.controls,
		...RULES_CONTRACT.modes.map((mode) => mode.socialLabel),
		socialDisclaimer,
	].join(' ');
	assert.deepEqual(playerVisibleRestrictedHits(normalRulesWithoutDisclaimer), []);
	assert.match(normalRulesWithoutDisclaimer, /BREACH RUN/);
	assert.match(socialRules, /STANDARD RUN/);
	assert.match(socialRules, /BLACKOUT ENTRY/);
	assert.equal(socialRules.includes('BREACH RUN'), false);
	assert.deepEqual(playerVisibleRestrictedHits(socialRules), []);
});
