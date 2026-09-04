// Current Stake.US player-visible language boundary. Keep this list aligned
// with the first-party Jurisdiction Requirements before every release freeze.
export const STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS = Object.freeze([
	'win feature',
	'pay out',
	'paid out',
	'pays out',
	'payout',
	'payouts',
	'paying',
	'stake',
	'betting',
	'total bet',
	'place your bets',
	'bet/s',
	'bet',
	'bets',
	'cash',
	'payer',
	'pay',
	'pays',
	'paid',
	'money',
	'buy bonus',
	'bonus buy',
	'buy',
	'bought',
	'purchase',
	'purchased',
	'at the cost of',
	'cost of',
	'rebet',
	'credit',
	'gamble',
	'wager',
	'deposit',
	'withdraw',
	'be awarded to player’s accounts',
	'currency',
	'fund',
]);

export function playerVisibleRestrictedHits(text) {
	const normalized = String(text || '');
	return STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS.filter((term) => {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
		return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(
			normalized,
		);
	});
}
