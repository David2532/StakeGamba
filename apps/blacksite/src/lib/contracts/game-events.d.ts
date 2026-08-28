export type Uint = number;
export type ModeId = 'base' | 'deep_access' | 'blackout';
export type Phase = 'base' | 'feature';
export type RegularSymbolId =
	| 'operative'
	| 'encrypted_drive'
	| 'tactical_radio'
	| 'classified_folder'
	| 'night_vision_goggles'
	| 'supply_crate'
	| 'a'
	| 'k'
	| 'q'
	| 'j'
	| 'ten';
export type PayingSymbolId = RegularSymbolId | 'ghost_wild';
export type SymbolId = PayingSymbolId | 'breach';

export interface Position {
	column: Uint;
	row: Uint;
}

/** Exactly five column-major arrays containing three canonical symbols each. */
export type ReelMatrix = ReadonlyArray<ReadonlyArray<SymbolId>>;

export interface RoundStartEvent {
	index: Uint;
	type: 'round_start';
	schema_version: 3;
	event_contract: 'blacksite-book-events-v3';
	mode: ModeId;
	cost_multiplier: number;
	payout_unit: 'centi-x_uint64';
	max_win_raw: 1_000_000;
	board_columns: 5;
	board_rows: 3;
	payline_count: 10;
	initial_phase: Phase;
	guaranteed_breach_positions: ReadonlyArray<Position>;
}

export interface SpinSetEvent {
	index: Uint;
	type: 'spin_set';
	phase: Phase;
	spin_index: Uint;
	board: ReelMatrix;
}

export interface ExpansionAppliedEvent {
	index: Uint;
	type: 'expansion_applied';
	free_spin_index: Uint;
	target_symbol: RegularSymbolId;
	expanded_reels: ReadonlyArray<Uint>;
	evaluated_board: ReelMatrix;
}

export interface AuthoritativeLineWin {
	line_id: Uint;
	symbol: PayingSymbolId;
	match_count: 3 | 4 | 5;
	positions: ReadonlyArray<Position>;
	wild_positions: ReadonlyArray<Position>;
	base_payout_raw: Uint;
	calculated_award_raw: Uint;
	applied_award_raw: Uint;
}

export interface LineWinEvent {
	index: Uint;
	type: 'line_win';
	phase: Phase;
	spin_index: Uint;
	wins: ReadonlyArray<AuthoritativeLineWin>;
	step_calculated_raw: Uint;
	step_payout_raw: Uint;
	cumulative_before_raw: Uint;
	cumulative_after_raw: Uint;
	cap_applied: boolean;
}

export interface FeatureTriggerEvent {
	index: Uint;
	type: 'feature_trigger';
	positions: ReadonlyArray<Position>;
	distinct_reels: Uint;
	awarded_free_spins: 8;
}

export interface FeatureStartEvent {
	index: Uint;
	type: 'feature_start';
	direct: boolean;
	target_symbol: RegularSymbolId;
	total_free_spins: 8;
}

export interface FreeSpinStartEvent {
	index: Uint;
	type: 'free_spin_start';
	free_spin_index: Uint;
	total_free_spins: 8;
	remaining_after_current: Uint;
}

export interface FeatureEndEvent {
	index: Uint;
	type: 'feature_end';
	spins_played: 8;
	total_free_spins: 8;
	cumulative_payout_raw: Uint;
	capped: false;
}

export interface CapReachedEvent {
	index: Uint;
	type: 'cap_reached';
	cap_raw: 1_000_000;
	gross_award_raw: Uint;
	accepted_award_raw: Uint;
	discarded_award_raw: Uint;
	cumulative_payout_raw: 1_000_000;
}

export interface RoundEndEvent {
	index: Uint;
	type: 'round_end';
	mode: ModeId;
	final_phase: Phase;
	payout_multiplier_raw: Uint;
	capped: boolean;
}

export type BlacksiteGameEvent =
	| RoundStartEvent
	| SpinSetEvent
	| ExpansionAppliedEvent
	| LineWinEvent
	| FeatureTriggerEvent
	| FeatureStartEvent
	| FreeSpinStartEvent
	| FeatureEndEvent
	| CapReachedEvent
	| RoundEndEvent;

export interface BlacksiteBook {
	id: Uint;
	events: ReadonlyArray<BlacksiteGameEvent>;
	payoutMultiplier: Uint;
}

export type PresentationCue =
	| { kind: 'round_started'; eventIndex: Uint; event: RoundStartEvent }
	| { kind: 'board_snapshot'; eventIndex: Uint; event: SpinSetEvent }
	| { kind: 'expansion'; eventIndex: Uint; event: ExpansionAppliedEvent }
	| { kind: 'win'; eventIndex: Uint; event: LineWinEvent }
	| { kind: 'feature_armed'; eventIndex: Uint; event: FeatureTriggerEvent }
	| { kind: 'feature_started'; eventIndex: Uint; event: FeatureStartEvent }
	| { kind: 'feature_cycle'; eventIndex: Uint; event: FreeSpinStartEvent }
	| { kind: 'feature_ended'; eventIndex: Uint; event: FeatureEndEvent }
	| { kind: 'cap_reached'; eventIndex: Uint; event: CapReachedEvent }
	| { kind: 'settled'; eventIndex: Uint; event: RoundEndEvent };
