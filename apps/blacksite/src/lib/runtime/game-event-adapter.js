import {
	EVENT_CONTRACT,
	MAX_WIN_RAW,
	PAYOUT_UNIT,
	getMode,
	isCanonicalMode,
} from '../contracts/modes.js';
import { CLUSTER_BANDS, SYMBOL_PAYOUTS } from '../contracts/rules.js';

const SYMBOLS = new Set(['byte', 'relay', 'proxy', 'cipher', 'daemon', 'vault']);
const PHASES = new Set(['base', 'feature']);
const PORT_BY_ID = new Map([
	['north', Object.freeze({ column: 3, row: 0 })],
	['west', Object.freeze({ column: 0, row: 3 })],
	['east', Object.freeze({ column: 6, row: 3 })],
]);
const PORTS = new Set(PORT_BY_ID.keys());
const CORE_KEY = '3,3';
const INGRESS_KEYS = new Set(['2,6', '3,6', '4,6']);
const ALL_CELL_KEYS = new Set(
	Array.from({ length: 49 }, (_, index) => `${index % 7},${Math.floor(index / 7)}`),
);
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

const PAYTABLE_BANDS = Object.freeze(
	CLUSTER_BANDS.map((band, index) => {
		const match = /^cluster_(\d+)(?:_(\d+))?$/.exec(band.id);
		return Object.freeze({
			id: band.id,
			index,
			minimum: match ? Number(match[1]) : Number.NaN,
			maximum: match ? Number(match[2] ?? match[1]) : Number.NaN,
		});
	}),
);
const PAYTABLE_BAND_BY_ID = new Map(PAYTABLE_BANDS.map((band) => [band.id, band]));

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

function computeLiveCells(breached) {
	const live = new Set();
	const queue = [];
	for (const ingressKey of INGRESS_KEYS) {
		if (breached.has(ingressKey)) {
			live.add(ingressKey);
			const [column, row] = ingressKey.split(',').map(Number);
			queue.push({ column, row });
		}
	}
	while (queue.length > 0) {
		const cell = queue.shift();
		for (const next of orthogonalNeighbours(cell)) {
			const key = cellKey(next);
			if (breached.has(key) && !live.has(key)) {
				live.add(key);
				queue.push(next);
			}
		}
	}
	return live;
}

function routeSnapshot(breached, live) {
	return {
		breached,
		live,
		dormant: new Set([...breached].filter((key) => !live.has(key))),
		sealed: new Set([...ALL_CELL_KEYS].filter((key) => !breached.has(key))),
		reachedPorts: new Set(
			[...PORT_BY_ID].filter(([, position]) => live.has(cellKey(position))).map(([id]) => id),
		),
		coreLive: live.has(CORE_KEY),
	};
}

function routePayloadMatches(value, route, { includeBreached = false } = {}) {
	return Boolean(
		value &&
			value.core_live === route.coreLive &&
			sameSet(new Set(value.sealed_cells.map(cellKey)), route.sealed) &&
			sameSet(new Set(value.dormant_cells.map(cellKey)), route.dormant) &&
			sameSet(new Set(value.live_cells.map(cellKey)), route.live) &&
			sameSet(new Set(value.reached_exfil_ports), route.reachedPorts) &&
			(!includeBreached || sameSet(new Set(value.breached_cells.map(cellKey)), route.breached)),
	);
}

function accessForLiveCells(live) {
	if (live.size === 0) return 1;
	let minimumDistance = Number.POSITIVE_INFINITY;
	for (const key of live) {
		const [column, row] = key.split(',').map(Number);
		minimumDistance = Math.min(minimumDistance, Math.abs(column - 3) + Math.abs(row - 3));
	}
	if (minimumDistance === 0) return 5;
	if (minimumDistance === 1) return 3;
	if (minimumDistance === 2) return 2;
	return 1;
}

function featureAccessForPorts(reachedPorts) {
	return [5, 7, 10, 15][reachedPorts.size];
}

function validatePhysicalTumble(previousBoard, nextBoard, removed, entering, eventIndex) {
	if (entering.length !== removed.size) {
		fail('tumble entering_symbols count must equal removed_positions count', eventIndex);
	}
	const enteringByKey = new Map(entering.map((entry) => [cellKey(entry), entry.symbol]));
	for (let column = 0; column < 7; column += 1) {
		const survivors = [];
		let removedCount = 0;
		for (let row = 0; row < 7; row += 1) {
			if (removed.has(`${column},${row}`)) removedCount += 1;
			else survivors.push(previousBoard[column][row]);
		}
		const expectedEntering = new Set(
			Array.from({ length: removedCount }, (_, row) => `${column},${row}`),
		);
		const actualEntering = new Set(
			[...enteringByKey.keys()].filter((key) => Number(key.split(',')[0]) === column),
		);
		if (!sameSet(expectedEntering, actualEntering)) {
			fail(`tumble entrants must occupy top rows in column ${column}`, eventIndex);
		}
		for (let row = 0; row < removedCount; row += 1) {
			if (nextBoard[column][row] !== enteringByKey.get(`${column},${row}`)) {
				fail(`tumble entrant symbol mismatch at ${column},${row}`, eventIndex);
			}
		}
		if (JSON.stringify(nextBoard[column].slice(removedCount)) !== JSON.stringify(survivors)) {
			fail(`tumble survivor gravity/order mismatch in column ${column}`, eventIndex);
		}
	}
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

function orthogonalNeighbours(position) {
	return [
		{ column: position.column, row: position.row - 1 },
		{ column: position.column - 1, row: position.row },
		{ column: position.column + 1, row: position.row },
		{ column: position.column, row: position.row + 1 },
	].filter(
		(next) => next.column >= 0 && next.column < 7 && next.row >= 0 && next.row < 7,
	);
}

function payingComponents(board) {
	const seen = new Set();
	const components = [];
	const minimumClusterSize = PAYTABLE_BANDS[0]?.minimum ?? 5;

	for (let column = 0; column < 7; column += 1) {
		for (let row = 0; row < 7; row += 1) {
			const start = { column, row };
			const startKey = cellKey(start);
			if (seen.has(startKey)) continue;
			const symbol = board[column][row];
			const queue = [start];
			const keys = new Set([startKey]);
			seen.add(startKey);

			while (queue.length > 0) {
				const cell = queue.shift();
				for (const next of orthogonalNeighbours(cell)) {
					const key = cellKey(next);
					if (seen.has(key) || board[next.column][next.row] !== symbol) continue;
					seen.add(key);
					keys.add(key);
					queue.push(next);
				}
			}

			if (keys.size >= minimumClusterSize) components.push({ symbol, keys });
		}
	}

	return components;
}

function validateClusterBoardAndRoute(event, eventIndex, boardState, liveKeys, currentAccess) {
	if (!boardState || boardState.consumed || boardState.components.length === 0) {
		fail('cluster_win requires one unresolved paying board_set', eventIndex);
	}
	if (event.clusters.length !== boardState.components.length) {
		fail('cluster_win must resolve every paying board component exactly once', eventIndex);
	}

	const usedPositions = new Set();
	for (let clusterIndex = 0; clusterIndex < event.clusters.length; clusterIndex += 1) {
		const cluster = event.clusters[clusterIndex];
		const positions = new Set(cluster.positions.map(cellKey));
		for (const key of positions) {
			if (usedPositions.has(key)) {
				fail(`simultaneous clusters overlap at ${key}`, eventIndex);
			}
			usedPositions.add(key);
		}

		const component = boardState.components.find(
			(candidate) => candidate.symbol === cluster.symbol && sameSet(candidate.keys, positions),
		);
		if (!component) {
			fail(`cluster ${clusterIndex} is not an exact board flood-fill component`, eventIndex);
		}

		const linked = cluster.positions.some((position) => liveKeys.has(cellKey(position)));
		if (cluster.linked !== linked) {
			fail(`cluster ${clusterIndex}.linked does not match the latest route`, eventIndex);
		}
		const expectedAccess = linked ? currentAccess : 1;
		if (cluster.access_multiplier !== expectedAccess) {
			fail(
				`cluster ${clusterIndex}.access_multiplier does not match linked route authority`,
				eventIndex,
			);
		}
	}

	boardState.consumed = true;
}

function validateClusterAward(cluster, clusterIndex, eventIndex, capRemaining) {
	const label = `cluster ${clusterIndex}`;
	const band = PAYTABLE_BAND_BY_ID.get(cluster.cluster_band);
	if (
		!band ||
		!Number.isSafeInteger(band.minimum) ||
		!Number.isSafeInteger(band.maximum)
	) {
		fail(`${label}.cluster_band is not a canonical paytable band`, eventIndex);
	}
	if (cluster.cluster_size < band.minimum || cluster.cluster_size > band.maximum) {
		fail(`${label}.cluster_size is outside its paytable band`, eventIndex);
	}

	const paytableValue = SYMBOL_PAYOUTS[cluster.symbol]?.[band.index];
	if (!Number.isSafeInteger(paytableValue) || cluster.base_payout_raw !== paytableValue) {
		fail(`${label}.base_payout_raw does not match the paytable band value`, eventIndex);
	}

	const calculatedAward = cluster.base_payout_raw * cluster.access_multiplier;
	if (!Number.isSafeInteger(calculatedAward)) {
		fail(`${label}.calculated_award_raw exceeds the safe integer domain`, eventIndex);
	}
	if (cluster.calculated_award_raw !== calculatedAward) {
		fail(`${label}.calculated_award_raw must equal base payout times access`, eventIndex);
	}

	const appliedAward = Math.min(calculatedAward, capRemaining);
	if (cluster.applied_award_raw !== appliedAward) {
		fail(`${label}.applied_award_raw does not match the remaining cap`, eventIndex);
	}
	return { calculatedAward, appliedAward, capRemaining: capRemaining - appliedAward };
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
		const seededBreached = validatePositions(
			event.seeded_breached_cells,
			'seeded_breached_cells',
			eventIndex,
		);
		const seededLive = validatePositions(
			event.seeded_live_cells,
			'seeded_live_cells',
			eventIndex,
		);
		const expectedBreached = new Set(mode.seedBreachedCells.map(cellKey));
		const expectedLive = new Set(mode.seedLiveCells.map(cellKey));
		if (!sameSet(seededBreached, expectedBreached) || !sameSet(seededLive, expectedLive)) {
			fail('round_start seed cells do not match the canonical mode', eventIndex);
		}
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
		for (const field of ['step_payout_raw', 'cumulative_before_raw', 'cumulative_after_raw']) {
			assertUint(event[field], field, eventIndex);
		}
		assertBoolean(event.cap_applied, 'cap_applied', eventIndex);
		if (event.cumulative_before_raw >= MAX_WIN_RAW) {
			fail('cluster_win cannot start at or above the complete-round cap', eventIndex);
		}

		let capRemaining = MAX_WIN_RAW - event.cumulative_before_raw;
		let calculatedStep = 0;
		let appliedStep = 0;
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
			const validated = validateClusterAward(
				cluster,
				clusterIndex,
				eventIndex,
				capRemaining,
			);
			capRemaining = validated.capRemaining;
			calculatedStep += validated.calculatedAward;
			appliedStep += validated.appliedAward;
			if (!Number.isSafeInteger(calculatedStep) || !Number.isSafeInteger(appliedStep)) {
				fail('cluster_win award total exceeds the safe integer domain', eventIndex);
			}
		});
		if (event.step_payout_raw !== appliedStep || appliedStep === 0) {
			fail('step_payout_raw must equal the positive sum of applied awards', eventIndex);
		}
		if (event.cumulative_after_raw !== event.cumulative_before_raw + appliedStep) {
			fail('cumulative_after_raw must equal cumulative_before_raw plus step payout', eventIndex);
		}
		if (event.cumulative_after_raw > MAX_WIN_RAW) {
			fail('cluster_win cumulative payout exceeds the complete-round cap', eventIndex);
		}
		if (event.cap_applied !== (appliedStep !== calculatedStep)) {
			fail('cap_applied does not match clipped cluster awards', eventIndex);
		}
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

function validateEventSequence(events) {
	let requiredType = 'round_start';
	let afterNotificationsType = null;
	let notifications = [];
	let mode = null;
	let directFeature = false;
	let phaseFeature = false;
	let featureStarted = false;
	let playedFeature = false;
	let featureArmed = false;
	let featureCycle = 0;
	let totalFeatureCycles = 6;
	let tumbleIndex = 0;
	let pendingSeed = false;
	let pendingWin = null;
	let pendingTumble = null;
	let boardState = null;
	let breached = new Set();
	let live = new Set();
	let reachedPorts = new Set();
	let currentAccess = 1;
	let cumulativeRaw = 0;
	let capped = false;

	const setRequiredFromNotifications = () => {
		requiredType = notifications[0]?.type ?? afterNotificationsType;
		if (notifications.length === 0) afterNotificationsType = null;
	};
	const consumeNotification = (type, eventIndex) => {
		if (notifications[0]?.type !== type) {
			fail(`${type} is not the next authoritative notification`, eventIndex);
		}
		notifications.shift();
		setRequiredFromNotifications();
	};

	for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
		const event = events[eventIndex];
		if (event.type !== requiredType) {
			fail(
				`event sequence expected ${requiredType ?? 'no further event'} but received ${event.type}`,
				eventIndex,
			);
		}
		requiredType = null;

		if (event.type === 'round_start') {
			mode = getMode(event.mode);
			directFeature = event.initial_phase === 'feature';
			phaseFeature = directFeature;
			pendingSeed = mode.seedBreachedCells.length > 0;
			breached = new Set(mode.seedBreachedCells.map(cellKey));
			live = computeLiveCells(breached);
			if (!sameSet(live, new Set(mode.seedLiveCells.map(cellKey)))) {
				fail('canonical mode live seed is not connected to ingress', eventIndex);
			}
			requiredType = pendingSeed ? 'breach_state' : 'board_set';
			continue;
		}

		if (event.type === 'board_set') {
			if (event.phase !== (phaseFeature ? 'feature' : 'base')) {
				fail('board_set phase breaks the authoritative lifecycle', eventIndex);
			}
			if (event.feature_cycle !== (phaseFeature ? featureCycle : 0)) {
				fail('board_set feature_cycle breaks the authoritative lifecycle', eventIndex);
			}
			if (event.tumble_index !== tumbleIndex) {
				fail('board_set tumble_index breaks the authoritative lifecycle', eventIndex);
			}
			if (pendingTumble) {
				validatePhysicalTumble(
					pendingTumble.board,
					event.board,
					pendingTumble.removed,
					pendingTumble.entering,
					eventIndex,
				);
				pendingTumble = null;
			}
			const components = payingComponents(event.board);
			boardState = { board: event.board, consumed: false };
			if (components.length > 0) {
				requiredType = 'cluster_win';
			} else if (phaseFeature) {
				requiredType = featureCycle < totalFeatureCycles ? 'feature_cycle' : 'feature_end';
			} else {
				requiredType = featureArmed ? 'feature_start' : 'round_end';
			}
			continue;
		}

		if (event.type === 'cluster_win') {
			if (
				pendingWin ||
				!boardState ||
				boardState.consumed ||
				event.phase !== (phaseFeature ? 'feature' : 'base') ||
				event.feature_cycle !== (phaseFeature ? featureCycle : 0)
			) {
				fail('cluster_win breaks the authoritative phase lifecycle', eventIndex);
			}
			const previousCoreLive = live.has(CORE_KEY);
			const previousPorts = new Set(reachedPorts);
			const removed = new Set(
				event.clusters.flatMap((cluster) => cluster.positions.map(cellKey)),
			);
			const newlyBreached = new Set([...removed].filter((key) => !breached.has(key)));
			const nextBreached = new Set([...breached, ...removed]);
			const nextLive = computeLiveCells(nextBreached);
			const route = routeSnapshot(nextBreached, nextLive);
			const newlyReachedPorts = [...route.reachedPorts]
				.filter((port) => !previousPorts.has(port))
				.sort();
			const nextAccess = phaseFeature
				? featureAccessForPorts(route.reachedPorts)
				: accessForLiveCells(nextLive);
			const gross = event.clusters.reduce(
				(sum, cluster) => sum + cluster.calculated_award_raw,
				0,
			);
			const accepted = event.clusters.reduce(
				(sum, cluster) => sum + cluster.applied_award_raw,
				0,
			);
			cumulativeRaw = event.cumulative_after_raw;
			capped = cumulativeRaw === MAX_WIN_RAW;
			pendingWin = {
				preAccess: currentAccess,
				nextAccess,
				newlyBreached,
				route,
				newlyReachedPorts,
				coreArmed: !phaseFeature && !previousCoreLive && route.coreLive,
				capped,
				removed,
				gross,
				accepted,
				discarded: gross - accepted,
			};
			boardState.consumed = true;
			requiredType = 'breach_state';
			continue;
		}

		if (event.type === 'breach_state') {
			if (event.phase !== (phaseFeature ? 'feature' : 'base')) {
				fail('breach_state phase breaks the authoritative lifecycle', eventIndex);
			}
			if (pendingSeed) {
				const route = routeSnapshot(breached, live);
				const nextAccess = directFeature
					? featureAccessForPorts(route.reachedPorts)
					: accessForLiveCells(live);
				if (
					!sameSet(new Set(event.newly_breached_cells.map(cellKey)), breached) ||
					!routePayloadMatches(event, route, { includeBreached: true }) ||
					event.current_access_multiplier !== nextAccess ||
					event.feature_multiplier !== (directFeature ? nextAccess : 1) ||
					event.access_multiplier_used !== 1 ||
					event.cumulative_payout_raw !== 0
				) {
					fail('seed breach_state does not match the canonical mode', eventIndex);
				}
				currentAccess = nextAccess;
				reachedPorts = route.reachedPorts;
				pendingSeed = false;
				notifications = [{
					type: 'access_changed',
					previous: 1,
					next: currentAccess,
					reason: 'mode_seed',
				}];
				afterNotificationsType = directFeature ? 'feature_start' : 'board_set';
				setRequiredFromNotifications();
				continue;
			}

			if (!pendingWin) fail('breach_state requires a preceding cluster_win', eventIndex);
			if (
				!sameSet(
					new Set(event.newly_breached_cells.map(cellKey)),
					pendingWin.newlyBreached,
				) ||
				!routePayloadMatches(event, pendingWin.route, { includeBreached: true }) ||
				event.current_access_multiplier !== pendingWin.nextAccess ||
				event.feature_multiplier !== (phaseFeature ? pendingWin.nextAccess : 1) ||
				event.access_multiplier_used !== pendingWin.preAccess ||
				event.cumulative_payout_raw !== cumulativeRaw
			) {
				fail('breach_state does not match the authoritative post-win route', eventIndex);
			}
			breached = pendingWin.route.breached;
			live = pendingWin.route.live;
			reachedPorts = pendingWin.route.reachedPorts;
			currentAccess = pendingWin.nextAccess;
			notifications = [];
			if (pendingWin.nextAccess !== pendingWin.preAccess) {
				let reason = pendingWin.nextAccess === 5 ? 'core_live' : 'route_proximity';
				if (phaseFeature) {
					if (pendingWin.newlyReachedPorts.length !== 1) {
						fail('feature access change must correspond to one newly reached port', eventIndex);
					}
					reason = `exfil_${pendingWin.newlyReachedPorts[0]}`;
				}
				notifications.push({
					type: 'access_changed',
					previous: pendingWin.preAccess,
					next: pendingWin.nextAccess,
					reason,
				});
			}
			if (pendingWin.coreArmed) {
				notifications.push({ type: 'feature_armed', cumulative: cumulativeRaw });
			}
			if (phaseFeature) {
				for (const port of pendingWin.newlyReachedPorts) {
					notifications.push({ type: 'exfil_reached', port });
				}
			}
			afterNotificationsType = pendingWin.capped ? 'cap_reached' : 'tumble';
			setRequiredFromNotifications();
			continue;
		}

		if (event.type === 'access_changed') {
			const expected = notifications[0];
			if (
				expected?.type !== 'access_changed' ||
				event.previous_multiplier !== expected.previous ||
				event.next_multiplier !== expected.next ||
				event.reason !== expected.reason
			) {
				fail('access_changed does not match the authoritative route transition', eventIndex);
			}
			consumeNotification('access_changed', eventIndex);
			continue;
		}

		if (event.type === 'feature_armed') {
			const expected = notifications[0];
			if (expected?.type !== 'feature_armed' || event.cumulative_payout_raw !== expected.cumulative) {
				fail('feature_armed does not match the authoritative route transition', eventIndex);
			}
			featureArmed = true;
			consumeNotification('feature_armed', eventIndex);
			continue;
		}

		if (event.type === 'exfil_reached') {
			const expected = notifications[0];
			const expectedPosition = PORT_BY_ID.get(event.port_id);
			if (
				expected?.type !== 'exfil_reached' ||
				event.port_id !== expected.port ||
				event.position.column !== expectedPosition?.column ||
				event.position.row !== expectedPosition?.row
			) {
				fail('exfil_reached does not match the authoritative port transition', eventIndex);
			}
			totalFeatureCycles = Math.min(12, totalFeatureCycles + event.awarded_cycles);
			if (
				event.total_cycles_after !== totalFeatureCycles ||
				event.remaining_cycles_after_current !== totalFeatureCycles - featureCycle ||
				event.next_access_multiplier !== currentAccess
			) {
				fail('exfil_reached cycle/access totals are inconsistent', eventIndex);
			}
			consumeNotification('exfil_reached', eventIndex);
			continue;
		}

		if (event.type === 'tumble') {
			const removed = new Set(event.removed_positions.map(cellKey));
			if (
				!pendingWin ||
				pendingWin.capped ||
				!boardState?.consumed ||
				!sameSet(removed, pendingWin.removed) ||
				event.phase !== (phaseFeature ? 'feature' : 'base')
			) {
				fail('tumble does not match the authoritative resolved win', eventIndex);
			}
			tumbleIndex += 1;
			if (event.tumble_index !== tumbleIndex) {
				fail('tumble_index must be contiguous across the round', eventIndex);
			}
			pendingTumble = {
				board: boardState.board,
				removed,
				entering: event.entering_symbols,
			};
			pendingWin = null;
			requiredType = 'board_set';
			continue;
		}

		if (event.type === 'feature_start') {
			const route = routeSnapshot(breached, live);
			const expectedAccess = featureAccessForPorts(route.reachedPorts);
			if (
				featureStarted ||
				!route.coreLive ||
				event.direct !== directFeature ||
				event.total_cycles !== totalFeatureCycles ||
				event.access_multiplier !== expectedAccess ||
				!routePayloadMatches(event.initial_route, route)
			) {
				fail('feature_start is not justified by the authoritative lifecycle', eventIndex);
			}
			phaseFeature = true;
			featureStarted = true;
			playedFeature = true;
			featureArmed = false;
			currentAccess = expectedAccess;
			requiredType = 'feature_cycle';
			continue;
		}

		if (event.type === 'feature_cycle') {
			if (!phaseFeature || !featureStarted || featureCycle >= totalFeatureCycles) {
				fail('feature_cycle is outside the active feature lifecycle', eventIndex);
			}
			featureCycle += 1;
			if (
				event.cycle !== featureCycle ||
				event.total_cycles_awarded !== totalFeatureCycles ||
				event.remaining_cycles_after_current !== totalFeatureCycles - featureCycle ||
				event.access_multiplier !== currentAccess ||
				!sameSet(new Set(event.reached_exfil_ports), reachedPorts)
			) {
				fail('feature_cycle counters/access are inconsistent', eventIndex);
			}
			requiredType = 'board_set';
			continue;
		}

		if (event.type === 'feature_end') {
			if (!phaseFeature || !featureStarted || capped || featureCycle !== totalFeatureCycles) {
				fail('feature_end occurs before the feature lifecycle is complete', eventIndex);
			}
			if (
				event.cycles_played !== featureCycle ||
				event.total_cycles !== totalFeatureCycles ||
				event.cumulative_payout_raw !== cumulativeRaw ||
				!sameSet(new Set(event.reached_exfil_ports), reachedPorts)
			) {
				fail('feature_end counters/ports/payout are inconsistent', eventIndex);
			}
			phaseFeature = false;
			requiredType = 'round_end';
			continue;
		}

		if (event.type === 'cap_reached') {
			if (
				!pendingWin?.capped ||
				event.gross_award_raw !== pendingWin.gross ||
				event.accepted_award_raw !== pendingWin.accepted ||
				event.discarded_award_raw !== pendingWin.discarded ||
				event.accepted_award_raw + event.discarded_award_raw !== event.gross_award_raw
			) {
				fail('cap_reached is not reconciled with the authoritative cluster total', eventIndex);
			}
			pendingWin = null;
			requiredType = 'round_end';
			continue;
		}

		if (event.type === 'round_end') {
			if (eventIndex !== events.length - 1) fail('round_end must be final', eventIndex);
			const expectedFinalPhase = playedFeature || directFeature ? 'feature' : 'base';
			if (
				event.mode !== mode.id ||
				event.final_phase !== expectedFinalPhase ||
				event.payout_multiplier_raw !== cumulativeRaw ||
				event.capped !== capped
			) {
				fail('round_end does not match the authoritative lifecycle total', eventIndex);
			}
			requiredType = null;
		}
	}

	if (requiredType !== null) {
		fail(`truncated event stream; expected ${requiredType}`);
	}
	if (
		pendingSeed ||
		pendingWin ||
		pendingTumble ||
		notifications.length > 0 ||
		afterNotificationsType !== null
	) {
		fail('event stream ended with unresolved authoritative state');
	}
}

export class GameEventAdapter {
	adaptBook(book, { expectedMode = null } = {}) {
		assertExactKeys(book, ['id', 'events', 'payoutMultiplier'], 'book');
		assertUint(book.id, 'book.id');
		assertUint(book.payoutMultiplier, 'book.payoutMultiplier');
		return this.adaptRoundEvents(book.events, {
			expectedMode,
			expectedPayoutRaw: book.payoutMultiplier,
		});
	}

	adaptRoundEvents(events, { expectedMode = null, expectedPayoutRaw = null } = {}) {
		if (!Array.isArray(events) || events.length < 2) {
			fail('book.events must contain a complete round');
		}
		if (expectedPayoutRaw !== null) {
			assertUint(expectedPayoutRaw, 'expectedPayoutRaw');
		}

		let cumulativePayoutRaw = 0;
		let boardState = null;
		let liveKeys = new Set();
		let currentAccess = 1;
		events.forEach((event, eventIndex) => {
			validateEvent(event, eventIndex);
			if (
				boardState &&
				!boardState.consumed &&
				boardState.components.length > 0 &&
				eventIndex > boardState.eventIndex &&
				event.type !== 'cluster_win'
			) {
				fail('paying board_set must be followed immediately by cluster_win', eventIndex);
			}

			if (event.type === 'round_start') {
				liveKeys = new Set(event.seeded_live_cells.map(cellKey));
				currentAccess = 1;
			}
			if (event.type === 'board_set') {
				boardState = {
					eventIndex,
					components: payingComponents(event.board),
					consumed: false,
				};
			}
			if (event.type === 'cluster_win') {
				validateClusterBoardAndRoute(
					event,
					eventIndex,
					boardState,
					liveKeys,
					currentAccess,
				);
				if (event.cumulative_before_raw !== cumulativePayoutRaw) {
					fail('cluster_win cumulative_before_raw breaks round continuity', eventIndex);
				}
				cumulativePayoutRaw = event.cumulative_after_raw;
			}
			if (event.type === 'breach_state') {
				liveKeys = new Set(event.live_cells.map(cellKey));
				currentAccess = event.current_access_multiplier;
			}
		});
		const first = events[0];
		const last = events.at(-1);
		if (first.type !== 'round_start' || last.type !== 'round_end') {
			fail('book must start with round_start and end with round_end');
		}
		if (events.filter((event) => event.type === 'round_end').length !== 1) {
			fail('book must contain exactly one round_end');
		}
		if (expectedMode && first.mode !== expectedMode) fail('book mode does not match fixture/route');
		if (last.mode !== first.mode) fail('round_start and round_end mode mismatch');
		if (expectedPayoutRaw !== null && last.payout_multiplier_raw !== expectedPayoutRaw) {
			fail('book and round_end payout centi-x mismatch', last.index);
		}
		if (last.payout_multiplier_raw !== cumulativePayoutRaw) {
			fail('round_end payout does not match cluster_win cumulative total', last.index);
		}
		if (last.payout_multiplier_raw > MAX_WIN_RAW) fail('book exceeds complete-round cap', last.index);

		for (let index = 0; index < events.length - 1; index += 1) {
			const event = events[index];
			const next = events[index + 1];
			if (event.type === 'cluster_win' && next.type !== 'breach_state') {
				fail('cluster_win must be followed by breach_state', event.index);
			}
			if (
				event.type === 'cluster_win' &&
				next.cumulative_payout_raw !== event.cumulative_after_raw
			) {
				fail(
					'breach_state cumulative_payout_raw does not match preceding cluster_win',
					next.index,
				);
			}
			if (event.type === 'tumble' && next.type !== 'board_set') {
				fail('tumble must be followed by board_set', event.index);
			}
			if (event.type === 'cap_reached' && next.type !== 'round_end') {
				fail('cap_reached must be followed by round_end', event.index);
			}
		}
		validateEventSequence(events);

		return Object.freeze(
			events.map((event) =>
				Object.freeze({
					kind: CUE_BY_EVENT[event.type],
					eventIndex: event.index,
					event,
				}),
			),
		);
	}
}
