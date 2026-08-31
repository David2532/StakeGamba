import { MAX_WIN_RAW, MODES, PAYOUT_UNIT, TARGET_RTP } from './modes.js';
import { LINE_PAYTABLE_RAW } from './reels.js';

export const LINE_LENGTHS = Object.freeze([
	Object.freeze({ id: 'line_3', label: '3' }),
	Object.freeze({ id: 'line_4', label: '4' }),
	Object.freeze({ id: 'line_5', label: '5' }),
]);

const symbolPayouts = Object.fromEntries(
	Object.entries(LINE_PAYTABLE_RAW).map(([symbol, payouts]) => [
		symbol,
		[3, 4, 5].map((matchCount) => payouts[matchCount]),
	]),
);

export const SYMBOL_PAYOUTS = Object.freeze(
	Object.fromEntries(
		Object.entries(symbolPayouts).map(([symbol, values]) => [symbol, Object.freeze(values)]),
	),
);

export const RULES_INTERFACE_COPY = Object.freeze({
	normal: Object.freeze({
		gameplayHint: 'MATCH 3+ FROM THE LEFT / CHOOSE BET / PRESS SPIN',
		controlDeckLabel: 'Bet, total, win and spin controls',
		amountLabel: 'BET',
		rulesLead:
			'Choose the entry mode and BET, check TOTAL, then press SPIN. All ten paylines are fixed and always active.',
		totalFormula: 'TOTAL = BET × MODE COST',
		resultHeading: 'PAYOUTS / CONSECUTIVE SYMBOLS / BET MULTIPLIER',
		resultExplanation:
			'Values are multiples of BET. Each line pays at most one deterministic symbol result; VAULT is a non-paying trigger.',
	}),
	social: Object.freeze({
		gameplayHint: 'MATCH 3+ FROM THE LEFT / CHOOSE PLAY AMOUNT / PRESS SPIN',
		controlDeckLabel: 'Play amount, total play, win and spin controls',
		amountLabel: 'PLAY AMOUNT',
		rulesLead:
			'Choose the entry mode and play amount, check TOTAL PLAY, then press SPIN. All ten paylines are fixed and always active.',
		totalFormula: 'TOTAL PLAY = PLAY AMOUNT × MODE COST',
		resultHeading: 'RESULTS / CONSECUTIVE SYMBOLS / PLAY AMOUNT MULTIPLIER',
		resultExplanation:
			'Values are multiples of the play amount. Each line awards at most one deterministic symbol result; VAULT is a trigger with no line award.',
	}),
});

export const RULES_CONTRACT = Object.freeze({
	board: Object.freeze({
		columns: 5,
		rows: 3,
		paylines: 10,
		direction: 'left-to-right',
		minimumMatch: 3,
	}),
	payoutUnit: PAYOUT_UNIT,
	targetRtp: TARGET_RTP,
	maxWinRaw: MAX_WIN_RAW,
	modes: MODES,
	initialFeatureSpins: 8,
	initialFeatureCycles: 8,
	featureRetrigger: false,
	wildSymbol: 'ghost_wild',
	featureSymbol: 'breach',
	quickStart: Object.freeze([
		Object.freeze({
			step: '01',
			title: 'MATCH 3+',
			copy: 'Land three, four or five matching symbols on any fixed line, starting from the leftmost reel.',
		}),
		Object.freeze({
			step: '02',
			title: 'GHOST WILD',
			copy: 'GHOST WILD substitutes for every regular symbol. It does not substitute for VAULT.',
		}),
		Object.freeze({
			step: '03',
			title: 'TRIGGER BLACKOUT',
			copy: 'Land three VAULT symbols on three distinct reels to award eight free spins.',
		}),
	]),
	specialSymbols: Object.freeze([
		Object.freeze({
			id: 'ghost_wild',
			label: 'GHOST WILD',
			copy: 'Substitutes for all eleven regular symbols.',
		}),
		Object.freeze({
			id: 'breach',
			label: 'VAULT',
			copy: 'Three on distinct reels award eight BLACKOUT free spins.',
		}),
	]),
	mechanic: Object.freeze([
		'All ten paylines are fixed and always active; there is no line selector.',
		'Line wins require three, four or five consecutive matching symbols from reel one toward reel five.',
		'More than one line may win in the same spin. All winning line awards are added together.',
		'GHOST WILD substitutes for a regular symbol when completing a line win.',
		'VAULT has no line award. Three VAULT symbols on three distinct reels trigger BLACKOUT; GHOST WILD never substitutes for it.',
	]),
	feature: Object.freeze([
		'BLACKOUT begins with exactly eight free spins.',
		'At feature start, one of the eleven regular symbols becomes the expanding target for all eight spins.',
		'When the target lands, it expands first; any resulting line wins are shown before the next free spin.',
		'BLACKOUT cannot retrigger.',
	]),
	controls: Object.freeze([
		'MODE selects an entry route. High-cost modes require confirmation.',
		'PLAY AMOUNT selects an available value; TOTAL shows the complete play cost.',
		'SPIN or Space starts one permitted round. AUTO requires confirmation.',
		'TURBO changes timing only. INFO opens these rules. SETTINGS controls game audio.',
	]),
	disclaimer:
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.',
});

export function getRulesDisclaimer(social = false) {
	return social
		? RULES_CONTRACT.disclaimer.replace('Stake Engine', 'the game provider')
		: RULES_CONTRACT.disclaimer;
}

export function getRulesInterfaceCopy(social = false) {
	return social ? RULES_INTERFACE_COPY.social : RULES_INTERFACE_COPY.normal;
}
