// Golden Goal Rush — 6x5 cluster/cascade game.
// Mirrors the real math in stake-upload/golden-goal-rush/math/math.js
// (PAYTABLE, cluster steps 5/7/9/11/13/16, RTP target 0.96, max win 10000x).
// Sample books for Storybook are generated from that math via
// apps/cluster/scripts/generate-ggr-books.mjs.

const clusterPaytable = (steps: Record<string, number>) =>
	Object.entries(steps).map(([count, pay]) => ({ [count]: pay }));

export default {
	providerName: 'noble_spin',
	gameName: 'golden_goal_rush',
	gameID: '0_0_cluster',
	rtp: 0.96,
	numReels: 6,
	numRows: [5, 5, 5, 5, 5, 5],
	betModes: {
		base: {
			cost: 1.0,
			feature: true,
			buyBonus: false,
			rtp: 0.96,
			max_win: 10000.0,
		},
		bonus: {
			cost: 100.0,
			feature: true,
			buyBonus: true,
			rtp: 0.96,
			max_win: 10000.0,
		},
	},
	symbols: {
		// Low symbols (a/k/q/j/10 art)
		L1: { paytable: clusterPaytable({ 5: 0.25, 7: 0.6, 9: 1.5, 11: 3, 13: 6, 16: 10 }) },
		L2: { paytable: clusterPaytable({ 5: 0.2, 7: 0.4, 9: 1, 11: 2, 13: 4, 16: 7.5 }) },
		L3: { paytable: clusterPaytable({ 5: 0.15, 7: 0.3, 9: 0.7, 11: 1.4, 13: 2.8, 16: 5 }) },
		L4: { paytable: clusterPaytable({ 5: 0.1, 7: 0.25, 9: 0.5, 11: 1, 13: 2, 16: 4 }) },
		L5: { paytable: clusterPaytable({ 5: 0.1, 7: 0.2, 9: 0.4, 11: 0.8, 13: 1.5, 16: 3 }) },
		// High symbols (fussball/pfeife/pokal/trikot art)
		H1: { paytable: clusterPaytable({ 5: 0.4, 7: 1, 9: 2.5, 11: 5, 13: 10, 16: 20 }) },
		H3: { paytable: clusterPaytable({ 5: 0.5, 7: 1.25, 9: 3, 11: 6, 13: 12, 16: 25 }) },
		H2: { paytable: clusterPaytable({ 5: 0.75, 7: 2, 9: 5, 11: 10, 13: 20, 16: 40 }) },
		H4: { paytable: clusterPaytable({ 5: 1, 7: 3, 9: 8, 11: 15, 13: 35, 16: 75 }) },
		W: {
			paytable: null,
			special_properties: ['wild'],
		},
		S: {
			paytable: null,
			special_properties: ['scatter'],
		},
		// Sponsor-feature symbols (rainbow / collector) from the final math.
		RB: {
			paytable: null,
			special_properties: ['rainbow'],
		},
		CL: {
			paytable: null,
			special_properties: ['collector'],
		},
	},
	paddingReels: {
		basegame: '',
		freegame: '',
	},
};
