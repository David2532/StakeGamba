// Local visual/demo frequency and feature settings. These weights drive only
// the browser's non-RGS demo generator and the optional ggr-sim utility; they
// are not the published Stake math books, lookup weights, or RTP contract.
// Paying values are deliberately imported from the exact production math
// package so this file cannot become a second production Paytable.
import { PRODUCTION_PAYTABLE } from './production-math-contract.mjs';

export const SYMBOL_WEIGHTS = Object.freeze({
	ten: 22,
	j: 20,
	q: 17,
	k: 15,
	a: 13,
	football: 9,
	whistle: 8,
	trophy: 6,
	jersey: 6,
	wild: 2,
	scatter: 2,
	rainbow: 2,
});

const SPECIAL_SYMBOL_META = Object.freeze({
	wild: Object.freeze({ wild: true }),
	scatter: Object.freeze({ scatter: true }),
	rainbow: Object.freeze({ rainbow: true }),
});

export const SYMBOL_MATH = Object.freeze(Object.fromEntries(
	Object.entries(SYMBOL_WEIGHTS).map(([symbol, weight]) => [
		symbol,
		Object.freeze({
			weight,
			pay: PRODUCTION_PAYTABLE[symbol]?.cluster5 ?? 0,
			...(SPECIAL_SYMBOL_META[symbol] || {}),
		}),
	]),
));

export const CONFIG = {
	// reveal weights (relative) for a marked golden cell when Rainbow activates.
	// blank = the cell reveals nothing (keeps RTP in range; most cells blank).
	blankWeight: 88, bronzeWeight: 60, silverWeight: 11, goldWeight: 1.5, multiplierWeight: 8, collectorWeight: 3,
	// board feature-symbol weights (frequency on the reels)
	rainbowWeight: 0.12, scatterWeight: 2,
	// "Feature Spins" buy multiplies the rainbow chance on its single paid spin
	huntBoost: 40,
	// coin value tables (multipliers of bet)
	bronzeValues: [0.2, 0.5, 1, 2, 3, 4],
	silverValues: [5, 10, 15, 20],
	goldValues: [25, 50, 100, 250, 500],
	multiplierValues: [2, 3, 4, 5, 10],
	// safety limits
	maxCollectorCycles: 4,
	maxWinMultiplier: 10000,
	// free-spin tiers
	tiers: {
		1: { name: 'Golden Chance', spins: 8, persistGolden: true, persistAfterReveal: false, guaranteedRainbow: false, rainbowBoost: 3, reduceBronze: false },
		2: { name: 'All That Glitters', spins: 12, persistGolden: true, persistAfterReveal: true, guaranteedRainbow: false, rainbowBoost: 3, reduceBronze: false },
		3: { name: 'End of the Rainbow', spins: 12, persistGolden: true, persistAfterReveal: true, guaranteedRainbow: true, rainbowBoost: 1, reduceBronze: true },
	},
	// Bonus buy options (price = mult * bet); tier 3 intentionally absent.
	// Prices are tuned so every buy returns ~96% (avg feature win / 0.96),
	// measured against ggr-sim.mjs so a purchase is never a rip-off.
	bonusBuy: [
		{ id: 'hunt', label: 'Feature Spins', mult: 4.2, desc: 'One play with boosted feature chance' },
		{ id: 'rainbow', label: 'Rainbow Spin', mult: 6, desc: 'One play with a guaranteed Golden Arc' },
		{ id: 'tier1', label: 'Golden Chance', mult: 31, desc: 'Start 8 Free Spins (Tier 1)' },
		{ id: 'tier2', label: 'All That Glitters', mult: 95, desc: 'Start 12 Free Spins (Tier 2)' },
	],
};
