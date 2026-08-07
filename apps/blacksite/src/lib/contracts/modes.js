export const GAME_ID = 'blacksite_breach';
export const GAME_TITLE = 'BLACKSITE // BREACH';
export const EVENT_CONTRACT = 'blacksite-book-events-v1';
export const EVENT_SCHEMA_SHA256 =
	'bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29';
export const CANDIDATE_FINGERPRINT_SHA256 =
	'd03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8';
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
	},
	{
		id: 'deep_access',
		normalLabel: 'DEEP ACCESS',
		socialLabel: 'DEEP ACCESS',
		costMultiplier: 4,
		initialPhase: 'base',
	},
	{
		id: 'blackout',
		normalLabel: 'BLACKOUT PROTOCOL',
		socialLabel: 'BLACKOUT ENTRY',
		costMultiplier: 80,
		initialPhase: 'feature',
	},
];

export const MODES = Object.freeze(
	modeDefinitions.map((mode) =>
		Object.freeze({
			...mode,
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
