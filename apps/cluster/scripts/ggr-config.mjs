// Single source of truth for Golden Goal Rush feature math.
// Imported by build-preview-html.mjs (the playable demo) AND ggr-sim.mjs
// (the RTP simulation), so what is measured is exactly what is played.

// Board symbols: weight = reel frequency, pay = base 5-cluster multiplier.
// Pays trimmed ~11% from the original to bring the base game to ~96% RTP
// (free-spin wins are feature-dominated, so this barely moves the buy modes).
export const SYMBOL_MATH = {
	ten: { weight: 22, pay: 0.09 },
	j: { weight: 20, pay: 0.09 },
	q: { weight: 17, pay: 0.13 },
	k: { weight: 15, pay: 0.18 },
	a: { weight: 13, pay: 0.22 },
	football: { weight: 9, pay: 0.35 },
	whistle: { weight: 8, pay: 0.45 },
	trophy: { weight: 6, pay: 0.65 },
	jersey: { weight: 6, pay: 0.9 },
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
		{ id: 'hunt', label: 'Feature Spins', mult: 4.2, desc: 'One paid spin with boosted feature chance' },
		{ id: 'rainbow', label: 'Rainbow Spin', mult: 6, desc: 'One paid spin with a guaranteed Golden Arc' },
		{ id: 'tier1', label: 'Golden Chance', mult: 31, desc: 'Start 8 Free Spins (Tier 1)' },
		{ id: 'tier2', label: 'All That Glitters', mult: 95, desc: 'Start 12 Free Spins (Tier 2)' },
	],
};
