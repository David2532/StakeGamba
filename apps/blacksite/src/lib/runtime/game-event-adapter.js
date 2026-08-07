import {
	EVENT_CONTRACT,
	MAX_WIN_RAW,
	PAYOUT_UNIT,
	getMode,
	isCanonicalMode,
} from '../contracts/modes.js';

const SYMBOLS = new Set(['byte', 'relay', 'proxy', 'cipher', 'daemon', 'vault']);
const PHASES = new Set(['base', 'feature']);
const PORTS = new Set(['north', 'west', 'east']);
const ACCESS_MULTIPLIERS = new Set([1, 2, 3, 5, 7, 10, 15]);
const FEATURE_MULTIPLIERS = new Set([5, 7, 10, 15]);
const ACCESS_REASONS = new Set([
	'mode_seed',
	'route_proximity',
	'core_live',
	'exfil_north',
	'exfil_west',
	'exfil_east',
]);

const EVENT_KEYS = Object.freeze({
	round_start: [
		'index',
		'type',
		'schema_version',
		'event_contract',
		'mode',
		'cost_multiplier',
		'payout_unit',
		'max_win_raw',
		'board_columns',
		'board_rows',
		'initial_phase',
		'seeded_breached_cells',
		'seeded_live_cells',
	],
	board_set: ['index', 'type', 'phase', 'feature_cycle', 'tumble_index', 'board'],
	cluster_win: [
		'index',
		'type',
		'phase',
		'feature_cycle',
		'clusters',
		'step_payout_raw',
		'cumulative_before_raw',
		'cumulative_after_raw',
		'cap_applied',
	],
	breach_state: [
		'index',
		'type',
		'phase',
		'newly_breached_cells',
		'breached_cells',
		'sealed_cells',
		'dormant_cells',
		'live_cells',
		'core_live',
		'reached_exfil_ports',
		'current_access_multiplier',
		'feature_multiplier',
		'access_multiplier_used',
		'cumulative_payout_raw',
	],
	access_changed: [
		'index',
		'type',
		'previous_multiplier',
		'next_multiplier',
		'effective_from_next_evaluation',
		'reason',
	],
	feature_armed: [
		'index',
		'type',
		'reason',
		'enter_after_current_cascade_chain',
		'cumulative_payout_raw',
	],
	feature_start: [
		'index',
		'type',
		'feature',
		'direct',
		'initial_cycles',
		'total_cycles',
		'access_multiplier',
		'core_live',
		'initial_route',
	],
	feature_cycle: [
		'index',
		'type',
		'cycle',
		'total_cycles_awarded',
		'remaining_cycles_after_current',
		'access_multiplier',
		'reached_exfil_ports',
	],
	exfil_reached: [
		'index',
		'type',
		'port_id',
		'position',
		'awarded_cycles',
		'total_cycles_after',
		'remaining_cycles_after_current',
		'next_access_multiplier',
	],
	tumble: [
		'index',
		'type',
		'phase',
		'tumble_index',
		'removed_positions',
		'entering_symbols',
	],
	feature_end: [
		'index',
		'type',
		'cycles_played',
		'total_cycles',
		'reached_exfil_ports',
		'cumulative_payout_raw',
		'capped',
	],
	cap_reached: [
		'index',
		'type',
		'cap_raw',
		'gross_award_raw',
		'accepted_award_raw',
		'discarded_award_raw',
		'cumulative_payout_raw',
	],
	round_end: ['index', 'type', 'mode', 'final_phase', 'payout_multiplier_raw', 'capped'],
});

const CLUSTER_KEYS = [
	'symbol',
	'cluster_band',
	'cluster_size',
	'positions',
	'linked',
	'base_payout_raw',
	'access_multiplier',
	'calculated_award_raw',
	'applied_award_raw',
];

const ROUTE_KEYS = [
	'sealed_cells',
	'dormant_cells',
	'live_cells',
	'reached_exfil_ports',
	'core_live',
];

const CUE_BY_EVENT = Object.freeze({
	round_start: 'round_started',
	board_set: 'board_snapshot',
	cluster_win: 'win',
	breach_state: 'route_snapshot',
	access_changed: 'access_changed',
	feature_armed: 'feature_armed',
	feature_start: 'feature_started',
	feature_cycle: 'feature_cycle',
	exfil_reached: 'exfil_reached',
	tumble: 'tumble',
	feature_end: 'feature_ended',
	cap_reached: 'cap_reached',
	round_end: 'settled',
});

export class ContractViolation extends Error {
	constructor(message, eventIndex = null) {
		super(message);
		this.name = 'ContractViolation';
		this.eventIndex = eventIndex;
	}
}

function fail(message, eventIndex = null) {
	throw new ContractViolation(message, eventIndex);
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label, eventIndex = null) {
	if (!isObject(value)) fail(`${label} must be an object`, eventIndex);
}

function assertExactKeys(value, expected, label, eventIndex = null) {
	assertObject(value, label, eventIndex);
	const actualKeys = Object.keys(value).sort();
	const expectedKeys = [...expected].sort();
	if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
		fail(`${label} fields do not match ${expectedKeys.join(', ')}`, eventIndex);
	}
}

function assertUint(value, label, eventIndex = null) {
	if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be uint`, eventIndex);
}

function assertBoolean(value, label, eventIndex = null) {
	if (typeof value !== 'boolean') fail(`${label} must be boolean`, eventIndex);
}

function cellKey(position) {
	return `${position.column},${position.row}`;
}

function validatePosition(position, label, eventIndex, withSymbol = false) {
	assertExactKeys(
		position,
		withSymbol ? ['column', 'row', 'symbol'] : ['column', 'row'],
		label,
		eventIndex,
	);
	assertUint(position.column, `${label}.column`, eventIndex);
	assertUint(position.row, `${label}.row`, eventIndex);
	if (position.column > 6 || position.row > 6) fail(`${label} is outside 7x7 board`, eventIndex);
	if (withSymbol && !SYMBOLS.has(position.symbol)) fail(`${label}.symbol is invalid`, eventIndex);
	return cellKey(position);
}

function validatePositions(positions, label, eventIndex, withSymbol = false) {
	if (!Array.isArray(positions)) fail(`${label} must be an array`, eventIndex);
	const keys = new Set();
	positions.forEach((position, positionIndex) => {
		const key = validatePosition(
			position,
			`${label}[${positionIndex}]`,
			eventIndex,
			withSymbol,
		);
		if (keys.has(key)) fail(`${label} contains duplicate ${key}`, eventIndex);
		keys.add(key);
	});
	return keys;
}

function sameSet(left, right) {
	return left.size === right.size && [...left].every((key) => right.has(key));
}

function validatePorts(ports, label, eventIndex) {
	if (!Array.isArray(ports)) fail(`${label} must be an array`, eventIndex);
	const seen = new Set();
	for (const port of ports) {
		if (!PORTS.has(port) || seen.has(port)) fail(`${label} contains invalid port`, eventIndex);
		seen.add(port);
	}
}

function validateBoard(board, eventIndex) {
	if (!Array.isArray(board) || board.length !== 7) fail('board must have seven columns', eventIndex);
	board.forEach((column, columnIndex) => {
		if (!Array.isArray(column) || column.length !== 7) {
			fail(`board column ${columnIndex} must have seven rows`, eventIndex);
		}
		for (const symbol of column) {
			if (!SYMBOLS.has(symbol)) fail(`board contains invalid symbol ${String(symbol)}`, eventIndex);
		}
	});
}

function validateRoute(value, eventIndex, { includeBreached = false } = {}) {
	const sealed = validatePositions(value.sealed_cells, 'sealed_cells', eventIndex);
	const dormant = validatePositions(value.dormant_cells, 'dormant_cells', eventIndex);
	const live = validatePositions(value.live_cells, 'live_cells', eventIndex);
	const partition = new Set([...sealed, ...dormant, ...live]);
	if (partition.size !== 49 || sealed.size + dormant.size + live.size !== 49) {
		fail('route snapshot must partition all 49 cells exactly once', eventIndex);
	}
	validatePorts(value.reached_exfil_ports, 'reached_exfil_ports', eventIndex);
	assertBoolean(value.core_live, 'core_live', eventIndex);
	if (includeBreached) {
		const breached = validatePositions(value.breached_cells, 'breached_cells', eventIndex);
		const expectedBreached = new Set([...dormant, ...live]);
		if (!sameSet(breached, expectedBreached)) {
			fail('breached_cells must equal dormant_cells plus live_cells', eventIndex);
		}
		const newly = validatePositions(value.newly_breached_cells, 'newly_breached_cells', eventIndex);
		if ([...newly].some((key) => !breached.has(key))) {
			fail('newly_breached_cells must be part of breached_cells', eventIndex);
		}
	}
}

function validateEvent(event, eventIndex) {
	assertObject(event, `event ${eventIndex}`, eventIndex);
	if (!Object.hasOwn(EVENT_KEYS, event.type)) fail(`unknown event type ${String(event.type)}`, eventIndex);
	assertExactKeys(event, EVENT_KEYS[event.type], `event ${eventIndex}`, eventIndex);
	assertUint(event.index, 'event.index', eventIndex);
	if (event.index !== eventIndex) fail('event indices must be contiguous and zero-based', eventIndex);

	if (event.type === 'round_start') {
		if (event.schema_version !== 1 || event.event_contract !== EVENT_CONTRACT) {
			fail('round_start event contract is unsupported', eventIndex);
		}
		if (!isCanonicalMode(event.mode)) fail('round_start mode is not canonical', eventIndex);
		const mode = getMode(event.mode);
		if (
			event.cost_multiplier !== mode.costMultiplier ||
			event.initial_phase !== mode.initialPhase ||
			event.payout_unit !== PAYOUT_UNIT ||
			event.max_win_raw !== MAX_WIN_RAW ||
			event.board_columns !== 7 ||
			event.board_rows !== 7
		) {
			fail('round_start canonical metadata mismatch', eventIndex);
		}
		validatePositions(event.seeded_breached_cells, 'seeded_breached_cells', eventIndex);
		validatePositions(event.seeded_live_cells, 'seeded_live_cells', eventIndex);
	}

	if (event.type === 'board_set') {
		if (!PHASES.has(event.phase)) fail('board_set phase is invalid', eventIndex);
		assertUint(event.feature_cycle, 'feature_cycle', eventIndex);
		assertUint(event.tumble_index, 'tumble_index', eventIndex);
		validateBoard(event.board, eventIndex);
	}

	if (event.type === 'cluster_win') {
		if (!PHASES.has(event.phase) || !Array.isArray(event.clusters) || event.clusters.length === 0) {
			fail('cluster_win requires phase and clusters', eventIndex);
		}
		assertUint(event.feature_cycle, 'feature_cycle', eventIndex);
		event.clusters.forEach((cluster, clusterIndex) => {
			assertExactKeys(cluster, CLUSTER_KEYS, `cluster ${clusterIndex}`, eventIndex);
			if (!SYMBOLS.has(cluster.symbol) || typeof cluster.cluster_band !== 'string') {
				fail(`cluster ${clusterIndex} identity is invalid`, eventIndex);
			}
			validatePositions(cluster.positions, `cluster ${clusterIndex}.positions`, eventIndex);
			for (const field of [
				'cluster_size',
				'base_payout_raw',
				'access_multiplier',
				'calculated_award_raw',
				'applied_award_raw',
			]) {
				assertUint(cluster[field], `cluster ${clusterIndex}.${field}`, eventIndex);
			}
			assertBoolean(cluster.linked, `cluster ${clusterIndex}.linked`, eventIndex);
			if (cluster.cluster_size < 5 || cluster.cluster_size > 49) {
				fail(`cluster ${clusterIndex}.cluster_size is outside 5..49`, eventIndex);
			}
			if (cluster.cluster_size !== cluster.positions.length) {
				fail(`cluster ${clusterIndex}.cluster_size does not match positions`, eventIndex);
			}
			if (!ACCESS_MULTIPLIERS.has(cluster.access_multiplier)) {
				fail(`cluster ${clusterIndex}.access_multiplier is invalid`, eventIndex);
			}
		});
		for (const field of ['step_payout_raw', 'cumulative_before_raw', 'cumulative_after_raw']) {
			assertUint(event[field], field, eventIndex);
		}
		assertBoolean(event.cap_applied, 'cap_applied', eventIndex);
	}

	if (event.type === 'breach_state') {
		if (!PHASES.has(event.phase)) fail('breach_state phase is invalid', eventIndex);
		validateRoute(event, eventIndex, { includeBreached: true });
		for (const field of [
			'current_access_multiplier',
			'feature_multiplier',
			'access_multiplier_used',
			'cumulative_payout_raw',
		]) {
			assertUint(event[field], field, eventIndex);
		}
		if (
			!ACCESS_MULTIPLIERS.has(event.current_access_multiplier) ||
			!ACCESS_MULTIPLIERS.has(event.feature_multiplier) ||
			!ACCESS_MULTIPLIERS.has(event.access_multiplier_used)
		) {
			fail('breach_state access multiplier enum is invalid', eventIndex);
		}
	}

	if (event.type === 'access_changed') {
		assertUint(event.previous_multiplier, 'previous_multiplier', eventIndex);
		assertUint(event.next_multiplier, 'next_multiplier', eventIndex);
		if (
			event.effective_from_next_evaluation !== true ||
			!ACCESS_MULTIPLIERS.has(event.previous_multiplier) ||
			!ACCESS_MULTIPLIERS.has(event.next_multiplier) ||
			!ACCESS_REASONS.has(event.reason)
		) {
			fail('access_changed semantics are invalid', eventIndex);
		}
	}

	if (event.type === 'feature_armed') {
		if (
			event.reason !== 'core_became_live' ||
			event.enter_after_current_cascade_chain !== true
		) {
			fail('feature_armed semantics are invalid', eventIndex);
		}
		assertUint(event.cumulative_payout_raw, 'cumulative_payout_raw', eventIndex);
	}

	if (event.type === 'feature_start') {
		if (event.feature !== 'blackout_protocol') fail('feature_start identity is invalid', eventIndex);
		assertBoolean(event.direct, 'direct', eventIndex);
		if (event.core_live !== true) fail('feature_start requires core_live=true', eventIndex);
		for (const field of ['initial_cycles', 'total_cycles', 'access_multiplier']) {
			assertUint(event[field], field, eventIndex);
		}
		if (
			event.initial_cycles !== 6 ||
			event.total_cycles < 6 ||
			event.total_cycles > 12 ||
			!FEATURE_MULTIPLIERS.has(event.access_multiplier)
		) {
			fail('feature_start cycle/access contract is invalid', eventIndex);
		}
		assertExactKeys(event.initial_route, ROUTE_KEYS, 'initial_route', eventIndex);
		validateRoute(event.initial_route, eventIndex);
	}

	if (event.type === 'feature_cycle') {
		for (const field of [
			'cycle',
			'total_cycles_awarded',
			'remaining_cycles_after_current',
			'access_multiplier',
		]) {
			assertUint(event[field], field, eventIndex);
		}
		validatePorts(event.reached_exfil_ports, 'reached_exfil_ports', eventIndex);
		if (
			event.cycle < 1 ||
			event.cycle > 12 ||
			event.total_cycles_awarded < 6 ||
			event.total_cycles_awarded > 12 ||
			!FEATURE_MULTIPLIERS.has(event.access_multiplier)
		) {
			fail('feature_cycle bounds/access are invalid', eventIndex);
		}
	}

	if (event.type === 'exfil_reached') {
		if (!PORTS.has(event.port_id)) fail('exfil_reached port is invalid', eventIndex);
		validatePosition(event.position, 'position', eventIndex);
		for (const field of [
			'awarded_cycles',
			'total_cycles_after',
			'remaining_cycles_after_current',
			'next_access_multiplier',
		]) {
			assertUint(event[field], field, eventIndex);
		}
		if (
			event.awarded_cycles !== 2 ||
			!new Set([7, 10, 15]).has(event.next_access_multiplier)
		) {
			fail('exfil_reached award/access contract is invalid', eventIndex);
		}
	}

	if (event.type === 'tumble') {
		if (!PHASES.has(event.phase)) fail('tumble phase is invalid', eventIndex);
		assertUint(event.tumble_index, 'tumble_index', eventIndex);
		validatePositions(event.removed_positions, 'removed_positions', eventIndex);
		validatePositions(event.entering_symbols, 'entering_symbols', eventIndex, true);
	}

	if (event.type === 'feature_end') {
		assertUint(event.cycles_played, 'cycles_played', eventIndex);
		assertUint(event.total_cycles, 'total_cycles', eventIndex);
		assertUint(event.cumulative_payout_raw, 'cumulative_payout_raw', eventIndex);
		validatePorts(event.reached_exfil_ports, 'reached_exfil_ports', eventIndex);
		if (event.capped !== false) fail('feature_end cannot follow a capped path', eventIndex);
	}

	if (event.type === 'cap_reached') {
		for (const field of [
			'cap_raw',
			'gross_award_raw',
			'accepted_award_raw',
			'discarded_award_raw',
			'cumulative_payout_raw',
		]) {
			assertUint(event[field], field, eventIndex);
		}
		if (event.cap_raw !== MAX_WIN_RAW || event.cumulative_payout_raw !== MAX_WIN_RAW) {
			fail('cap_reached does not match the complete-round cap', eventIndex);
		}
	}

	if (event.type === 'round_end') {
		if (!isCanonicalMode(event.mode) || !PHASES.has(event.final_phase)) {
			fail('round_end identity is invalid', eventIndex);
		}
		assertUint(event.payout_multiplier_raw, 'payout_multiplier_raw', eventIndex);
		assertBoolean(event.capped, 'capped', eventIndex);
	}
}

export class GameEventAdapter {
	adaptBook(book, { expectedMode = null } = {}) {
		assertExactKeys(book, ['id', 'events', 'payoutMultiplier'], 'book');
		assertUint(book.id, 'book.id');
		assertUint(book.payoutMultiplier, 'book.payoutMultiplier');
		if (!Array.isArray(book.events) || book.events.length < 2) {
			fail('book.events must contain a complete round');
		}

		book.events.forEach((event, eventIndex) => validateEvent(event, eventIndex));
		const first = book.events[0];
		const last = book.events.at(-1);
		if (first.type !== 'round_start' || last.type !== 'round_end') {
			fail('book must start with round_start and end with round_end');
		}
		if (book.events.filter((event) => event.type === 'round_end').length !== 1) {
			fail('book must contain exactly one round_end');
		}
		if (expectedMode && first.mode !== expectedMode) fail('book mode does not match fixture/route');
		if (last.mode !== first.mode) fail('round_start and round_end mode mismatch');
		if (last.payout_multiplier_raw !== book.payoutMultiplier) {
			fail('book and round_end payout centi-x mismatch', last.index);
		}
		if (last.payout_multiplier_raw > MAX_WIN_RAW) fail('book exceeds complete-round cap', last.index);

		for (let index = 0; index < book.events.length - 1; index += 1) {
			const event = book.events[index];
			const next = book.events[index + 1];
			if (event.type === 'cluster_win' && next.type !== 'breach_state') {
				fail('cluster_win must be followed by breach_state', event.index);
			}
			if (event.type === 'tumble' && next.type !== 'board_set') {
				fail('tumble must be followed by board_set', event.index);
			}
			if (event.type === 'cap_reached' && next.type !== 'round_end') {
				fail('cap_reached must be followed by round_end', event.index);
			}
		}

		return Object.freeze(
			book.events.map((event) =>
				Object.freeze({
					kind: CUE_BY_EVENT[event.type],
					eventIndex: event.index,
					event,
				}),
			),
		);
	}
}
