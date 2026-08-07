export type Uint = number;
export type ModeId = 'base' | 'deep_access' | 'blackout';
export type Phase = 'base' | 'feature';
export type SymbolId = 'byte' | 'relay' | 'proxy' | 'cipher' | 'daemon' | 'vault';
export type ExfilPortId = 'north' | 'west' | 'east';

export interface Position {
	column: Uint;
	row: Uint;
}

export type Board = ReadonlyArray<ReadonlyArray<SymbolId>>;

export interface RouteSnapshot {
	sealed_cells: ReadonlyArray<Position>;
	dormant_cells: ReadonlyArray<Position>;
	live_cells: ReadonlyArray<Position>;
	reached_exfil_ports: ReadonlyArray<ExfilPortId>;
	core_live: boolean;
}

export interface RoundStartEvent {
	index: Uint;
	type: 'round_start';
	schema_version: 1;
	event_contract: 'blacksite-book-events-v1';
	mode: ModeId;
	cost_multiplier: number;
	payout_unit: 'centi-x_uint64';
	max_win_raw: Uint;
	board_columns: 7;
	board_rows: 7;
	initial_phase: Phase;
	seeded_breached_cells: ReadonlyArray<Position>;
	seeded_live_cells: ReadonlyArray<Position>;
}

export interface BoardSetEvent {
	index: Uint;
	type: 'board_set';
	phase: Phase;
	feature_cycle: Uint;
	tumble_index: Uint;
	board: Board;
}

export interface AuthoritativeCluster {
	symbol: SymbolId;
	cluster_band: string;
	cluster_size: Uint;
	positions: ReadonlyArray<Position>;
	linked: boolean;
	base_payout_raw: Uint;
	access_multiplier: Uint;
	calculated_award_raw: Uint;
	applied_award_raw: Uint;
}

export interface ClusterWinEvent {
	index: Uint;
	type: 'cluster_win';
	phase: Phase;
	feature_cycle: Uint;
	clusters: ReadonlyArray<AuthoritativeCluster>;
	step_payout_raw: Uint;
	cumulative_before_raw: Uint;
	cumulative_after_raw: Uint;
	cap_applied: boolean;
}

export interface BreachStateEvent extends RouteSnapshot {
	index: Uint;
	type: 'breach_state';
	phase: Phase;
	newly_breached_cells: ReadonlyArray<Position>;
	breached_cells: ReadonlyArray<Position>;
	current_access_multiplier: Uint;
	feature_multiplier: Uint;
	access_multiplier_used: Uint;
	cumulative_payout_raw: Uint;
}

export interface AccessChangedEvent {
	index: Uint;
	type: 'access_changed';
	previous_multiplier: Uint;
	next_multiplier: Uint;
	effective_from_next_evaluation: true;
	reason:
		| 'mode_seed'
		| 'route_proximity'
		| 'core_live'
		| 'exfil_north'
		| 'exfil_west'
		| 'exfil_east';
}

export interface FeatureArmedEvent {
	index: Uint;
	type: 'feature_armed';
	reason: 'core_became_live';
	enter_after_current_cascade_chain: true;
	cumulative_payout_raw: Uint;
}

export interface FeatureStartEvent {
	index: Uint;
	type: 'feature_start';
	feature: 'blackout_protocol';
	direct: boolean;
	initial_cycles: Uint;
	total_cycles: Uint;
	access_multiplier: Uint;
	core_live: true;
	initial_route: RouteSnapshot;
}

export interface FeatureCycleEvent {
	index: Uint;
	type: 'feature_cycle';
	cycle: Uint;
	total_cycles_awarded: Uint;
	remaining_cycles_after_current: Uint;
	access_multiplier: Uint;
	reached_exfil_ports: ReadonlyArray<ExfilPortId>;
}

export interface ExfilReachedEvent {
	index: Uint;
	type: 'exfil_reached';
	port_id: ExfilPortId;
	position: Position;
	awarded_cycles: Uint;
	total_cycles_after: Uint;
	remaining_cycles_after_current: Uint;
	next_access_multiplier: Uint;
}

export interface TumbleEvent {
	index: Uint;
	type: 'tumble';
	phase: Phase;
	tumble_index: Uint;
	removed_positions: ReadonlyArray<Position>;
	entering_symbols: ReadonlyArray<Position & { symbol: SymbolId }>;
}

export interface FeatureEndEvent {
	index: Uint;
	type: 'feature_end';
	cycles_played: Uint;
	total_cycles: Uint;
	reached_exfil_ports: ReadonlyArray<ExfilPortId>;
	cumulative_payout_raw: Uint;
	capped: false;
}

export interface CapReachedEvent {
	index: Uint;
	type: 'cap_reached';
	cap_raw: Uint;
	gross_award_raw: Uint;
	accepted_award_raw: Uint;
	discarded_award_raw: Uint;
	cumulative_payout_raw: Uint;
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
	| BoardSetEvent
	| ClusterWinEvent
	| BreachStateEvent
	| AccessChangedEvent
	| FeatureArmedEvent
	| FeatureStartEvent
	| FeatureCycleEvent
	| ExfilReachedEvent
	| TumbleEvent
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
	| { kind: 'board_snapshot'; eventIndex: Uint; event: BoardSetEvent }
	| { kind: 'win'; eventIndex: Uint; event: ClusterWinEvent }
	| { kind: 'route_snapshot'; eventIndex: Uint; event: BreachStateEvent }
	| { kind: 'access_changed'; eventIndex: Uint; event: AccessChangedEvent }
	| { kind: 'feature_armed'; eventIndex: Uint; event: FeatureArmedEvent }
	| { kind: 'feature_started'; eventIndex: Uint; event: FeatureStartEvent }
	| { kind: 'feature_cycle'; eventIndex: Uint; event: FeatureCycleEvent }
	| { kind: 'exfil_reached'; eventIndex: Uint; event: ExfilReachedEvent }
	| { kind: 'tumble'; eventIndex: Uint; event: TumbleEvent }
	| { kind: 'feature_ended'; eventIndex: Uint; event: FeatureEndEvent }
	| { kind: 'cap_reached'; eventIndex: Uint; event: CapReachedEvent }
	| { kind: 'settled'; eventIndex: Uint; event: RoundEndEvent };
