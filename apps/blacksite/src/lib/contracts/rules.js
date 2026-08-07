import { MAX_WIN_RAW, MODES, PAYOUT_UNIT, TARGET_RTP } from './modes.js';

export const CLUSTER_BANDS = Object.freeze([
	Object.freeze({ id: 'cluster_5_7', label: '5–7' }),
	Object.freeze({ id: 'cluster_8_11', label: '8–11' }),
	Object.freeze({ id: 'cluster_12_16', label: '12–16' }),
	Object.freeze({ id: 'cluster_17_23', label: '17–23' }),
	Object.freeze({ id: 'cluster_24_31', label: '24–31' }),
	Object.freeze({ id: 'cluster_32_39', label: '32–39' }),
	Object.freeze({ id: 'cluster_40_48', label: '40–48' }),
	Object.freeze({ id: 'cluster_49', label: '49' }),
]);

const symbolPayouts = {
	byte: [1, 2, 3, 4, 14, 100, 500, 2500],
	relay: [2, 5, 6, 7, 25, 250, 750, 5000],
	proxy: [3, 6, 8, 9, 207, 500, 1000, 10000],
	cipher: [4, 7, 9, 10, 207, 100, 2500, 25000],
	daemon: [5, 8, 10, 11, 250, 1000, 5000, 50000],
	vault: [6, 9, 12, 13, 500, 2500, 10000, 100000],
};

export const SYMBOL_PAYOUTS = Object.freeze(
	Object.fromEntries(
		Object.entries(symbolPayouts).map(([symbol, values]) => [symbol, Object.freeze(values)]),
	),
);

export const RULES_CONTRACT = Object.freeze({
	board: Object.freeze({ columns: 7, rows: 7, adjacency: 'orthogonal', minimumCluster: 5 }),
	payoutUnit: PAYOUT_UNIT,
	targetRtp: TARGET_RTP,
	maxWinRaw: MAX_WIN_RAW,
	modes: MODES,
	accessMultipliers: Object.freeze([1, 2, 3, 5]),
	featureMultipliers: Object.freeze([5, 7, 10, 15]),
	initialFeatureCycles: 6,
	cyclesPerPort: 2,
	maximumFeatureCycles: 12,
	mechanic: Object.freeze([
		'Form orthogonally connected groups of five or more matching symbols on the 7 × 7 board.',
		'All simultaneous groups are resolved from one authoritative snapshot, then their cells are removed and each column refills.',
		'Winning cells breach the Ghost Route only after their current award is fixed. Live route cells connect to one of the three ingress cells.',
		'A group touching an already-live cell uses the current Access multiplier. Route upgrades apply to the next evaluation only.',
		'When the Core becomes live, BLACKOUT PROTOCOL begins after the current cascade chain ends.',
	]),
	feature: Object.freeze([
		'BLACKOUT PROTOCOL begins with six cycles.',
		'Each north, west or east EXFIL port can extend the feature once by two cycles, up to twelve cycles total.',
		'Linked feature groups use 5×, 7×, 10× or 15× according to the number of ports already reached.',
		'There are no Wild, Scatter or Mystery symbols and no symbol-based retrigger.',
	]),
	controls: Object.freeze([
		'Mode buttons select one canonical access profile.',
		'Play Amount lists every level supplied by the authenticated game service.',
		'Initiate Breach starts one round; Space activates the same control when permitted.',
		'DEEP ACCESS and BLACKOUT ENTRY require a second explicit confirmation showing the complete play amount.',
		'Info opens this rules and interface guide.',
	]),
	disclaimer:
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.',
});

export function getRulesDisclaimer(social = false) {
	return social
		? RULES_CONTRACT.disclaimer.replace('Stake Engine', 'the game provider')
		: RULES_CONTRACT.disclaimer;
}
