export const GAME_ID = 'blacksite_breach';
export const GAME_TITLE = 'BLACKSITE // BREACH';
export const EVENT_CONTRACT = 'blacksite-book-events-v3';

export const EVENT_SCHEMA_SHA256 =
	'8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75';
export const CANDIDATE_FINGERPRINT_SHA256 =
	'a30e33d3aa5b7b121cc94053306944f22714888952a95f5432177121e591a2d7';
export const PAYOUT_UNIT = 'centi-x_uint64';
export const MAX_WIN_RAW = 1_000_000;
export const TARGET_RTP = 0.962;

const modeDefinitions = [
	{
		id: 'base',
		normalLabel: 'BREACH RUN',
		socialLabel: 'STANDARD RUN',
		costMultiplier: 1,
		initialPhase: 'base',
		guaranteedBreachSymbols: 0,
		guaranteedBreachPositions: [],
		freeSpins: 0,
		directFeature: false,
		isBuyBonus: false,
		actionDescription:
			'Standard five-reel game. Three VAULT symbols trigger eight BLACKOUT free spins.',
		socialActionDescription:
			'Standard five-reel game. Three VAULT symbols trigger eight BLACKOUT free spins.',
	},
	{
		id: 'deep_access',
		normalLabel: 'DEEP ACCESS',
		socialLabel: 'DEEP ACCESS',
		costMultiplier: 4,
		initialPhase: 'base',
		guaranteedBreachSymbols: 2,
		guaranteedBreachPositions: [{ column: 0, row: 1 }, { column: 4, row: 1 }],
		freeSpins: 0,
		directFeature: false,
		isBuyBonus: true,
		actionDescription:
			'Two VAULT symbols are guaranteed. A third triggers eight BLACKOUT free spins.',
		socialActionDescription:
			'Two VAULT symbols are guaranteed. A third triggers eight BLACKOUT free spins.',
	},
	{
		id: 'blackout',
		normalLabel: 'BLACKOUT PROTOCOL',
		socialLabel: 'BLACKOUT ENTRY',
		costMultiplier: 80,
		initialPhase: 'feature',
		guaranteedBreachSymbols: 0,
		guaranteedBreachPositions: [],
		freeSpins: 8,
		directFeature: true,
		isBuyBonus: true,
		actionDescription:
			'Starts eight free spins. One regular symbol is chosen and expands on every reel where it lands.',
		socialActionDescription:
			'Starts eight free spins. One regular symbol is chosen and expands on every reel where it lands.',
	},
];

export const MODES = Object.freeze(
	modeDefinitions.map((mode) =>
		Object.freeze({
			...mode,
			guaranteedBreachPositions: Object.freeze(
				mode.guaranteedBreachPositions.map((position) => Object.freeze({ ...position })),
			),
			targetRtp: TARGET_RTP,
			maxWinRaw: MAX_WIN_RAW,
		}),
	),
);

const modesById = new Map(MODES.map((mode) => [mode.id, mode]));

export function isCanonicalMode(value) {
	return typeof value === 'string' && modesById.has(value);
}

export function getMode(modeId) {
	const mode = modesById.get(modeId);
	if (!mode) {
		throw new Error(`Unknown BLACKSITE mode: ${String(modeId)}`);
	}
	return mode;
}

export function getModeLabel(modeId, social = false) {
	const mode = getMode(modeId);
	return social ? mode.socialLabel : mode.normalLabel;
}

export function getModeActionDescription(modeId, social = false) {
	const mode = getMode(modeId);
	return social ? mode.socialActionDescription : mode.actionDescription;
}
