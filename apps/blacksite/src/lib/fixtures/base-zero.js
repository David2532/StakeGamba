import {
	CANDIDATE_FINGERPRINT_SHA256,
	EVENT_CONTRACT,
	EVENT_SCHEMA_SHA256,
	MAX_WIN_RAW,
	PAYOUT_UNIT,
} from '../contracts/modes.js';

export const CANDIDATE_FINGERPRINT = CANDIDATE_FINGERPRINT_SHA256;

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		Object.values(value).forEach(deepFreeze);
	}
	return value;
}

const board = [
	['classified_folder', 'q', 'encrypted_drive'],
	['q', 'j', 'supply_crate'],
	['ten', 'classified_folder', 'q'],
	['q', 'a', 'encrypted_drive'],
	['a', 'tactical_radio', 'encrypted_drive'],
];

export const BASE_ZERO_FIXTURE = deepFreeze({
	id: 'base_zero',
	label: 'Published v3 base zero-win / book 1',
	mode: 'base',
	mathBacked: true,
	bookId: 1,
	lookupWeight: 1,
	candidateFingerprint: CANDIDATE_FINGERPRINT,
	eventSchemaSha256: EVENT_SCHEMA_SHA256,
	book: {
		id: 1,
		payoutMultiplier: 0,
		events: [
			{
				index: 0,
				type: 'round_start',
				schema_version: 3,
				event_contract: EVENT_CONTRACT,
				mode: 'base',
				cost_multiplier: 1,
				payout_unit: PAYOUT_UNIT,
				max_win_raw: MAX_WIN_RAW,
				board_columns: 5,
				board_rows: 3,
				payline_count: 10,
				initial_phase: 'base',
				guaranteed_breach_positions: [],
			},
			{
				index: 1,
				type: 'spin_set',
				phase: 'base',
				spin_index: 0,
				board,
			},
			{
				index: 2,
				type: 'round_end',
				mode: 'base',
				final_phase: 'base',
				payout_multiplier_raw: 0,
				capped: false,
			},
		],
	},
});

export const FIXTURE_IDS = Object.freeze(['base_zero']);

export function getFixture(fixtureId) {
	return fixtureId === BASE_ZERO_FIXTURE.id ? BASE_ZERO_FIXTURE : null;
}
