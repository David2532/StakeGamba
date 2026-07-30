// Central, testable contracts shared by the generated frontend and QA.

export const STAKE_SOCIAL_RESTRICTED_TERMS = Object.freeze([
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

export function formatMaxWinMultiplier(value) {
	return new Intl.NumberFormat('en-US', {
		useGrouping: true,
		maximumFractionDigits: 20,
	}).format(Number(value));
}

export function socialRestrictedHits(text) {
	const normalized = String(text || '');
	return STAKE_SOCIAL_RESTRICTED_TERMS.filter((term) => {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
		return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(normalized);
	});
}

// Summarize the feature portion of an authoritative RGS event book. The
// `freeSpinEnd.amount` field is the feature total in book units; setTotalWin
// is the cumulative round total and is used only to close each spin boundary.
export function summarizeFeatureEvents(events) {
	const list = Array.isArray(events) ? events : [];
	const readUnits = (value, label) => {
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
			throw new Error(`${label} must be a non-negative integer`);
		}
		return value;
	};
	const triggerIndex = list.findIndex((event) => event && event.type === 'freeSpinTrigger');
	const endIndex = list.findIndex((event, index) => index > triggerIndex && event && event.type === 'freeSpinEnd');
	if (triggerIndex < 0 || endIndex < 0) return { ok: false, error: 'Feature book is missing freeSpinTrigger/freeSpinEnd' };
	const endUnits = readUnits(list[endIndex].amount, 'freeSpinEnd.amount');
	const baselineEvent = [...list.slice(0, triggerIndex)].reverse().find((event) => event && event.type === 'setTotalWin');
	const baselineUnits = baselineEvent ? readUnits(baselineEvent.amount, 'feature baseline setTotalWin.amount') : 0;
	let latestCumulativeUnits = baselineUnits;
	let previousFeatureUnits = 0;
	let openSpin = false;
	const perSpinWins = [];
	for (let index = triggerIndex + 1; index < endIndex; index += 1) {
		const event = list[index];
		if (!event) continue;
		if (event.type === 'setTotalWin') {
			const next = readUnits(event.amount, `setTotalWin.amount at event ${index}`);
			if (next < latestCumulativeUnits) return { ok: false, error: `Non-monotonic cumulative total at event ${index}` };
			latestCumulativeUnits = next;
		}
		if (event.type === 'updateFreeSpin') {
			if (openSpin) {
				const featureUnits = latestCumulativeUnits - baselineUnits;
				if (featureUnits < previousFeatureUnits) return { ok: false, error: `Non-monotonic feature total at spin boundary ${index}` };
				perSpinWins.push(featureUnits - previousFeatureUnits);
				previousFeatureUnits = featureUnits;
			}
			openSpin = true;
		}
	}
	if (!openSpin) return { ok: false, error: 'Feature book contains no updateFreeSpin boundaries' };
	if (endUnits < previousFeatureUnits) return { ok: false, error: 'freeSpinEnd is below the last spin total' };
	perSpinWins.push(endUnits - previousFeatureUnits);
	const sumUnits = perSpinWins.reduce((sum, value) => sum + value, 0);
	if (sumUnits !== endUnits) return { ok: false, error: `Per-spin total ${sumUnits} does not equal freeSpinEnd ${endUnits}` };
	const finalEvent = [...list].reverse().find((event) => event && event.type === 'finalWin');
	return {
		ok: true,
		featureTotalUnits: endUnits,
		perSpinWins,
		bestSpinUnits: Math.max(...perSpinWins),
		spinsPlayed: perSpinWins.length,
		finalWinUnits: finalEvent ? readUnits(finalEvent.amount, 'finalWin.amount') : null,
	};
}

// Active rounds may only use the /wallet/end-round balance. Inactive rounds
// may only use the /wallet/play balance. Both values are raw API micro-units.
export function reconcileWalletBalance({ active, playBalance, endRoundBalance }) {
	const selected = active ? endRoundBalance : playBalance;
	if (typeof selected !== 'number' || !Number.isSafeInteger(selected) || selected < 0) {
		throw new Error(active ? 'Active round is missing an authoritative end-round balance' : 'Inactive round is missing an authoritative play balance');
	}
	return selected;
}
