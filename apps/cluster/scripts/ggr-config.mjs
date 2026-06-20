// Single source of truth for Golden Goal Rush feature math.
// Imported by build-preview-html.mjs (the playable demo) AND ggr-sim.mjs
// (the RTP simulation), so what is measured is exactly what is played.

// Board symbols: weight = reel frequency, pay = base 5-cluster multiplier.
export const SYMBOL_MATH = {
	ten: { weight: 22, pay: 0.1 },
	j: { weight: 20, pay: 0.1 },
	q: { weight: 17, pay: 0.15 },
	k: { weight: 15, pay: 0.2 },
	a: { weight: 13, pay: 0.25 },
	football: { weight: 9, pay: 0.4 },
	whistle: { weight: 8, pay: 0.5 },
	trophy: { weight: 6, pay: 0.75 },
	jersey: { weight: 6, pay: 1 },
	wild: { weight: 2, pay: 0, wild: true },
	scatter: { weight: 2, pay: 0, scatter: true },
	rainbow: { weight: 2, pay: 0, rainbow: true },
};

export const CONFIG = {
	// reveal weights (relative) for a marked golden cell when Rainbow activates.
	// blank = the cell reveals nothing (keeps RTP in range; most cells blank).
	blankWeight: 88, bronzeWeight: 60, silverWeight: 11, goldWeight: 1.5, multiplierWeight: 8, collectorWeight: 3,
	// board feature-symbol weights (frequency on the reels)
	rainbowWeight: 0.12, scatterWeight: 2,
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
	// bonus buy options (price = mult * bet); tier 3 intentionally absent
	bonusBuy: [
		{ id: 'hunt', label: 'Feature Spins', mult: 3, desc: 'One paid spin with boosted feature chance' },
		{ id: 'rainbow', label: 'Rainbow Spin', mult: 50, desc: 'One paid spin with a guaranteed Golden Arc' },
		{ id: 'tier1', label: 'Golden Chance', mult: 100, desc: 'Start 8 Free Spins (Tier 1)' },
		{ id: 'tier2', label: 'All That Glitters', mult: 250, desc: 'Start 12 Free Spins (Tier 2)' },
	],
};
