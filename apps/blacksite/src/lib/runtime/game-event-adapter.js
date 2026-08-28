import {
	EVENT_CONTRACT,
	MAX_WIN_RAW,
	PAYOUT_UNIT,
	getMode,
	isCanonicalMode,
} from '../contracts/modes.js';
import {
	ALL_SYMBOLS,
	FREE_SPIN_COUNT,
	PAYING_SYMBOLS,
	PAYLINES,
	PAYLINE_COUNT,
	REEL_COLUMNS,
	REEL_ROWS,
	REGULAR_SYMBOLS,
	TRIGGER_SYMBOL,
	WILD_SYMBOL,
	cellKey,
	linePayoutRaw,
} from '../contracts/reels.js';

const EVENT_KEYS = Object.freeze({
	round_start: Object.freeze([
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
		'payline_count',
		'initial_phase',
		'guaranteed_breach_positions',
	]),
	spin_set: Object.freeze(['index', 'type', 'phase', 'spin_index', 'board']),
	expansion_applied: Object.freeze([
		'index',
		'type',
		'free_spin_index',
		'target_symbol',
		'expanded_reels',
		'evaluated_board',
	]),
	line_win: Object.freeze([
		'index',
		'type',
		'phase',
		'spin_index',
		'wins',
		'step_calculated_raw',
		'step_payout_raw',
		'cumulative_before_raw',
		'cumulative_after_raw',
		'cap_applied',
	]),
	feature_trigger: Object.freeze([
		'index',
		'type',
		'positions',
		'distinct_reels',
		'awarded_free_spins',
	]),
	feature_start: Object.freeze([
		'index',
		'type',
		'direct',
		'target_symbol',
		'total_free_spins',
	]),
	free_spin_start: Object.freeze([
		'index',
		'type',
		'free_spin_index',
		'total_free_spins',
		'remaining_after_current',
	]),
	feature_end: Object.freeze([
		'index',
		'type',
		'spins_played',
		'total_free_spins',
		'cumulative_payout_raw',
		'capped',
	]),
	cap_reached: Object.freeze([
		'index',
		'type',
		'cap_raw',
		'gross_award_raw',
		'accepted_award_raw',
		'discarded_award_raw',
		'cumulative_payout_raw',
	]),
	round_end: Object.freeze([
		'index',
		'type',
		'mode',
		'final_phase',
		'payout_multiplier_raw',
		'capped',
	]),
});

const LINE_WIN_KEYS = Object.freeze([
	'line_id',
	'symbol',
	'match_count',
	'positions',
	'wild_positions',
	'base_payout_raw',
	'calculated_award_raw',
	'applied_award_raw',
]);

const CUE_BY_EVENT = Object.freeze({
	round_start: 'round_started',
	spin_set: 'board_snapshot',
	expansion_applied: 'expansion',
	line_win: 'win',
	feature_trigger: 'feature_armed',
	feature_start: 'feature_started',
	free_spin_start: 'feature_cycle',
	feature_end: 'feature_ended',
	cap_reached: 'cap_reached',
	round_end: 'settled',
});

const SYMBOL_ORDER = new Map(PAYING_SYMBOLS.map((symbol, index) => [symbol, index]));

export class ContractViolation extends Error {
	constructor(message, eventIndex = null) {
		super(eventIndex === null ? message : `event ${eventIndex}: ${message}`);
		this.name = 'ContractViolation';
		this.eventIndex = eventIndex;
	}
}

function fail(message, eventIndex = null) {
	throw new ContractViolation(message, eventIndex);
}

function isPlainRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expected, context, eventIndex = null) {
	if (!isPlainRecord(value)) fail(`${context} must be an object`, eventIndex);
	const actual = Object.keys(value).sort();
	const canonical = [...expected].sort();
	if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
		fail(`${context} is not a closed record`, eventIndex);
	}
}

function assertUint(value, context, eventIndex = null) {
	if (!Number.isSafeInteger(value) || value < 0) {
		fail(`${context} must be a non-negative safe integer`, eventIndex);
	}
}

function assertPositiveUint(value, context, eventIndex = null) {
	assertUint(value, context, eventIndex);
	if (value === 0) fail(`${context} must be positive`, eventIndex);
}

function assertBoolean(value, context, eventIndex = null) {
	if (typeof value !== 'boolean') fail(`${context} must be boolean`, eventIndex);
}

function assertPhase(value, context, eventIndex = null) {
	if (value !== 'base' && value !== 'feature') {
		fail(`${context} must be base or feature`, eventIndex);
	}
}

function assertPosition(position, context, eventIndex = null) {
	assertExactKeys(position, ['column', 'row'], context, eventIndex);
	assertUint(position.column, `${context}.column`, eventIndex);
	assertUint(position.row, `${context}.row`, eventIndex);
	if (position.column >= REEL_COLUMNS || position.row >= REEL_ROWS) {
		fail(`${context} is outside the 5x3 reel window`, eventIndex);
	}
}

function assertPositions(positions, context, eventIndex = null) {
	if (!Array.isArray(positions)) fail(`${context} must be an array`, eventIndex);
	const keys = new Set();
	positions.forEach((position, index) => {
		assertPosition(position, `${context}[${index}]`, eventIndex);
		const key = cellKey(position);
		if (keys.has(key)) fail(`${context} contains duplicate ${key}`, eventIndex);
		keys.add(key);
	});
	return keys;
}

function assertBoard(board, context, eventIndex = null) {
	if (!Array.isArray(board) || board.length !== REEL_COLUMNS) {
		fail(`${context} must contain exactly ${REEL_COLUMNS} reels`, eventIndex);
	}
	const breachPositions = [];
	for (let column = 0; column < REEL_COLUMNS; column += 1) {
		const reel = board[column];
		if (!Array.isArray(reel) || reel.length !== REEL_ROWS) {
			fail(`${context}[${column}] must contain exactly ${REEL_ROWS} rows`, eventIndex);
		}
		let breachCount = 0;
		for (let row = 0; row < REEL_ROWS; row += 1) {
			const symbol = reel[row];
			if (!ALL_SYMBOLS.includes(symbol)) {
				fail(`${context}[${column}][${row}] has invalid symbol`, eventIndex);
			}
			if (symbol === TRIGGER_SYMBOL) {
				breachCount += 1;
				breachPositions.push({ column, row });
			}
		}
		if (breachCount > 1) fail(`${context} has more than one BREACH on reel ${column}`, eventIndex);
	}
	return breachPositions.sort((left, right) => left.row - right.row || left.column - right.column);
}

function sameValue(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function candidateForLine(board, rows, lineId, symbol) {
	const positions = [];
	const wildPositions = [];
	let containsRegularTarget = false;
	for (let column = 0; column < REEL_COLUMNS; column += 1) {
		const row = rows[column];
		const cell = board[column][row];
		const matches = symbol === WILD_SYMBOL
			? cell === WILD_SYMBOL
			: cell === symbol || cell === WILD_SYMBOL;
		if (!matches) break;
		const position = { column, row };
		positions.push(position);
		if (cell === WILD_SYMBOL) wildPositions.push(position);
		if (symbol !== WILD_SYMBOL && cell === symbol) containsRegularTarget = true;
	}
	if (positions.length < 3) return null;
	if (symbol !== WILD_SYMBOL && !containsRegularTarget) return null;
	const basePayoutRaw = linePayoutRaw(symbol, positions.length);
	if (!Number.isSafeInteger(basePayoutRaw) || basePayoutRaw <= 0) return null;
	return {
		line_id: lineId,
		symbol,
		match_count: positions.length,
		positions,
		wild_positions: wildPositions,
		base_payout_raw: basePayoutRaw,
	};
}

function betterCandidate(left, right) {
	if (right.base_payout_raw !== left.base_payout_raw) {
		return right.base_payout_raw > left.base_payout_raw ? right : left;
	}
	if (right.match_count !== left.match_count) {
		return right.match_count > left.match_count ? right : left;
	}
	return SYMBOL_ORDER.get(right.symbol) < SYMBOL_ORDER.get(left.symbol) ? right : left;
}

export function evaluatePaylines(board) {
	assertBoard(board, 'evaluated board');
	const wins = [];
	PAYLINES.forEach((rows, lineId) => {
		let selected = null;
		for (const symbol of PAYING_SYMBOLS) {
			const candidate = candidateForLine(board, rows, lineId, symbol);
			if (candidate) selected = selected ? betterCandidate(selected, candidate) : candidate;
		}
		if (selected) wins.push(selected);
	});
	return wins;
}

export function expandTargetBoard(board, targetSymbol) {
	assertBoard(board, 'original feature board');
	if (!REGULAR_SYMBOLS.includes(targetSymbol)) fail('invalid feature target symbol');
	const evaluatedBoard = board.map((reel) => [...reel]);
	const expandedReels = [];
	for (let column = 0; column < REEL_COLUMNS; column += 1) {
		if (board[column].includes(targetSymbol)) {
			expandedReels.push(column);
			evaluatedBoard[column] = Array.from({ length: REEL_ROWS }, () => targetSymbol);
		}
	}
	return { evaluatedBoard, expandedReels };
}

function validateLineWinItem(item, context, eventIndex) {
	assertExactKeys(item, LINE_WIN_KEYS, context, eventIndex);
	assertUint(item.line_id, `${context}.line_id`, eventIndex);
	if (item.line_id >= PAYLINE_COUNT) fail(`${context}.line_id is unknown`, eventIndex);
	if (!PAYING_SYMBOLS.includes(item.symbol)) fail(`${context}.symbol is not paying`, eventIndex);
	assertUint(item.match_count, `${context}.match_count`, eventIndex);
	if (item.match_count < 3 || item.match_count > 5) {
		fail(`${context}.match_count must be 3, 4, or 5`, eventIndex);
	}
	assertPositions(item.positions, `${context}.positions`, eventIndex);
	assertPositions(item.wild_positions, `${context}.wild_positions`, eventIndex);
	if (item.positions.length !== item.match_count) {
		fail(`${context}.positions length does not match match_count`, eventIndex);
	}
	const positionKeys = new Set(item.positions.map(cellKey));
	if (item.wild_positions.some((position) => !positionKeys.has(cellKey(position)))) {
		fail(`${context}.wild_positions must be a subset of positions`, eventIndex);
	}
	assertPositiveUint(item.base_payout_raw, `${context}.base_payout_raw`, eventIndex);
	assertPositiveUint(item.calculated_award_raw, `${context}.calculated_award_raw`, eventIndex);
	assertUint(item.applied_award_raw, `${context}.applied_award_raw`, eventIndex);
}

function validateEventShape(event, eventIndex) {
	if (!isPlainRecord(event) || typeof event.type !== 'string' || !EVENT_KEYS[event.type]) {
		fail('unknown or malformed event type', eventIndex);
	}
	assertExactKeys(event, EVENT_KEYS[event.type], event.type, eventIndex);
	assertUint(event.index, 'event.index', eventIndex);
	if (event.index !== eventIndex) fail('event indices must be contiguous and zero-based', eventIndex);

	switch (event.type) {
		case 'round_start':
			assertUint(event.schema_version, 'schema_version', eventIndex);
			if (!isCanonicalMode(event.mode)) fail('round_start mode is not canonical', eventIndex);
			assertPositiveUint(event.cost_multiplier, 'cost_multiplier', eventIndex);
			assertPositiveUint(event.max_win_raw, 'max_win_raw', eventIndex);
			assertPositiveUint(event.board_columns, 'board_columns', eventIndex);
			assertPositiveUint(event.board_rows, 'board_rows', eventIndex);
			assertPositiveUint(event.payline_count, 'payline_count', eventIndex);
			assertPhase(event.initial_phase, 'initial_phase', eventIndex);
			assertPositions(event.guaranteed_breach_positions, 'guaranteed_breach_positions', eventIndex);
			break;
		case 'spin_set':
			assertPhase(event.phase, 'phase', eventIndex);
			assertUint(event.spin_index, 'spin_index', eventIndex);
			assertBoard(event.board, 'board', eventIndex);
			break;
		case 'expansion_applied':
			assertPositiveUint(event.free_spin_index, 'free_spin_index', eventIndex);
			if (!REGULAR_SYMBOLS.includes(event.target_symbol)) fail('invalid expansion target', eventIndex);
			if (!Array.isArray(event.expanded_reels) || event.expanded_reels.length === 0) {
				fail('expanded_reels must be nonempty', eventIndex);
			}
			event.expanded_reels.forEach((column, index) => {
				assertUint(column, `expanded_reels[${index}]`, eventIndex);
				if (column >= REEL_COLUMNS) fail('expanded reel is out of range', eventIndex);
				if (index > 0 && event.expanded_reels[index - 1] >= column) {
					fail('expanded_reels must be sorted and unique', eventIndex);
				}
			});
			assertBoard(event.evaluated_board, 'evaluated_board', eventIndex);
			break;
		case 'line_win':
			assertPhase(event.phase, 'phase', eventIndex);
			assertUint(event.spin_index, 'spin_index', eventIndex);
			if (!Array.isArray(event.wins) || event.wins.length === 0) {
				fail('line_win.wins must be nonempty', eventIndex);
			}
			event.wins.forEach((win, index) =>
				validateLineWinItem(win, `wins[${index}]`, eventIndex),
			);
			assertPositiveUint(event.step_calculated_raw, 'step_calculated_raw', eventIndex);
			assertPositiveUint(event.step_payout_raw, 'step_payout_raw', eventIndex);
			assertUint(event.cumulative_before_raw, 'cumulative_before_raw', eventIndex);
			assertUint(event.cumulative_after_raw, 'cumulative_after_raw', eventIndex);
			assertBoolean(event.cap_applied, 'cap_applied', eventIndex);
			break;
		case 'feature_trigger':
			assertPositions(event.positions, 'positions', eventIndex);
			assertUint(event.distinct_reels, 'distinct_reels', eventIndex);
			assertPositiveUint(event.awarded_free_spins, 'awarded_free_spins', eventIndex);
			break;
		case 'feature_start':
			assertBoolean(event.direct, 'direct', eventIndex);
			if (!REGULAR_SYMBOLS.includes(event.target_symbol)) fail('invalid feature target', eventIndex);
			assertPositiveUint(event.total_free_spins, 'total_free_spins', eventIndex);
			break;
		case 'free_spin_start':
			assertPositiveUint(event.free_spin_index, 'free_spin_index', eventIndex);
			assertPositiveUint(event.total_free_spins, 'total_free_spins', eventIndex);
			assertUint(event.remaining_after_current, 'remaining_after_current', eventIndex);
			break;
		case 'feature_end':
			assertPositiveUint(event.spins_played, 'spins_played', eventIndex);
			assertPositiveUint(event.total_free_spins, 'total_free_spins', eventIndex);
			assertUint(event.cumulative_payout_raw, 'cumulative_payout_raw', eventIndex);
			assertBoolean(event.capped, 'capped', eventIndex);
			break;
		case 'cap_reached':
			assertPositiveUint(event.cap_raw, 'cap_raw', eventIndex);
			assertPositiveUint(event.gross_award_raw, 'gross_award_raw', eventIndex);
			assertPositiveUint(event.accepted_award_raw, 'accepted_award_raw', eventIndex);
			assertUint(event.discarded_award_raw, 'discarded_award_raw', eventIndex);
			assertPositiveUint(event.cumulative_payout_raw, 'cumulative_payout_raw', eventIndex);
			break;
		case 'round_end':
			if (!isCanonicalMode(event.mode)) fail('round_end mode is not canonical', eventIndex);
			assertPhase(event.final_phase, 'final_phase', eventIndex);
			assertUint(event.payout_multiplier_raw, 'payout_multiplier_raw', eventIndex);
			assertBoolean(event.capped, 'capped', eventIndex);
			break;
	}
}

function validateCanonicalLineEvent(event, canonicalWins, cumulativeRaw) {
	const eventIndex = event.index;
	if (event.wins.length !== canonicalWins.length) {
		fail('line_win must contain every and only canonical winning line', eventIndex);
	}
	let remainingCap = MAX_WIN_RAW - cumulativeRaw;
	let stepCalculatedRaw = 0;
	let stepPayoutRaw = 0;
	for (let index = 0; index < canonicalWins.length; index += 1) {
		const actual = event.wins[index];
		const expected = canonicalWins[index];
		if (
			actual.line_id !== expected.line_id ||
			actual.symbol !== expected.symbol ||
			actual.match_count !== expected.match_count ||
			!sameValue(actual.positions, expected.positions) ||
			!sameValue(actual.wild_positions, expected.wild_positions) ||
			actual.base_payout_raw !== expected.base_payout_raw ||
			actual.calculated_award_raw !== expected.base_payout_raw
		) {
			fail(`line_win.wins[${index}] contradicts the evaluated reel window`, eventIndex);
		}
		const applied = Math.min(expected.base_payout_raw, remainingCap);
		if (actual.applied_award_raw !== applied) {
			fail(`line_win.wins[${index}] cap application is invalid`, eventIndex);
		}
		remainingCap -= applied;
		stepCalculatedRaw += expected.base_payout_raw;
		stepPayoutRaw += applied;
	}
	if (
		event.step_calculated_raw !== stepCalculatedRaw ||
		event.step_payout_raw !== stepPayoutRaw ||
		event.cumulative_before_raw !== cumulativeRaw ||
		event.cumulative_after_raw !== cumulativeRaw + stepPayoutRaw ||
		event.cap_applied !== (stepCalculatedRaw !== stepPayoutRaw)
	) {
		fail('line_win totals do not reconcile with paylines and complete-round cap', eventIndex);
	}
	return {
		cumulativeRaw: cumulativeRaw + stepPayoutRaw,
		grossAwardRaw: stepCalculatedRaw,
		acceptedAwardRaw: stepPayoutRaw,
	};
}

function validateCapEvent(event, lineResult) {
	if (
		event.cap_raw !== MAX_WIN_RAW ||
		event.gross_award_raw !== lineResult.grossAwardRaw ||
		event.accepted_award_raw !== lineResult.acceptedAwardRaw ||
		event.discarded_award_raw !== lineResult.grossAwardRaw - lineResult.acceptedAwardRaw ||
		event.cumulative_payout_raw !== MAX_WIN_RAW
	) {
		fail('cap_reached does not reconcile with the immediately preceding line_win', event.index);
	}
}

function validateRoundLifecycle(events, expectedMode, expectedPayoutRaw) {
	let cursor = 0;
	const peek = () => events[cursor] ?? null;
	const consume = (type) => {
		const event = events[cursor];
		if (event?.type !== type) {
			fail(`expected ${type}, got ${event?.type ?? 'end of stream'}`, cursor);
		}
		cursor += 1;
		return event;
	};

	const start = consume('round_start');
	const mode = getMode(start.mode);
	if (expectedMode !== null && start.mode !== expectedMode) {
		fail('book mode does not match requested mode', start.index);
	}
	if (
		start.schema_version !== 3 ||
		start.event_contract !== EVENT_CONTRACT ||
		start.cost_multiplier !== mode.costMultiplier ||
		start.payout_unit !== PAYOUT_UNIT ||
		start.max_win_raw !== MAX_WIN_RAW ||
		start.board_columns !== REEL_COLUMNS ||
		start.board_rows !== REEL_ROWS ||
		start.payline_count !== PAYLINE_COUNT ||
		start.initial_phase !== mode.initialPhase ||
		!sameValue(start.guaranteed_breach_positions, mode.guaranteedBreachPositions)
	) {
		fail('round_start contradicts the canonical v3 mode contract', start.index);
	}

	let cumulativeRaw = 0;
	let entersFeature = mode.directFeature;
	let capped = false;
	let finalPhase = 'base';

	if (!mode.directFeature) {
		const spin = consume('spin_set');
		if (spin.phase !== 'base' || spin.spin_index !== 0) {
			fail('opening spin identity is invalid', spin.index);
		}
		const breachPositions = assertBoard(spin.board, 'opening board', spin.index);
		for (const guaranteed of mode.guaranteedBreachPositions) {
			if (spin.board[guaranteed.column][guaranteed.row] !== TRIGGER_SYMBOL) {
				fail(`guaranteed BREACH missing at ${cellKey(guaranteed)}`, spin.index);
			}
		}
		const canonicalWins = evaluatePaylines(spin.board);
		let lineResult = null;
		if (canonicalWins.length > 0) {
			const lineEvent = consume('line_win');
			if (lineEvent.phase !== 'base' || lineEvent.spin_index !== 0) {
				fail('opening line_win phase/index mismatch', lineEvent.index);
			}
			lineResult = validateCanonicalLineEvent(lineEvent, canonicalWins, cumulativeRaw);
			cumulativeRaw = lineResult.cumulativeRaw;
		} else if (peek()?.type === 'line_win') {
			fail('non-paying opening board emitted line_win', peek().index);
		}

		if (cumulativeRaw === MAX_WIN_RAW) {
			const cap = consume('cap_reached');
			validateCapEvent(cap, lineResult);
			capped = true;
		} else {
			const distinctReels = new Set(breachPositions.map((position) => position.column)).size;
			entersFeature = distinctReels >= 3;
			if (entersFeature) {
				const trigger = consume('feature_trigger');
				if (
					!sameValue(trigger.positions, breachPositions) ||
					trigger.distinct_reels !== distinctReels ||
					trigger.awarded_free_spins !== FREE_SPIN_COUNT
				) {
					fail('feature_trigger does not match distinct BREACH reels', trigger.index);
				}
			} else {
				if (peek()?.type === 'feature_trigger') {
					fail('feature_trigger is not justified by the opening board', peek().index);
				}
				if (
					start.mode === 'deep_access' &&
					breachPositions.length !== mode.guaranteedBreachPositions.length
				) {
					fail('non-trigger DEEP ACCESS board must contain exactly its two guarantees', spin.index);
				}
			}
		}
	}

	if (entersFeature && !capped) {
		finalPhase = 'feature';
		const featureStart = consume('feature_start');
		if (
			featureStart.direct !== mode.directFeature ||
			!REGULAR_SYMBOLS.includes(featureStart.target_symbol) ||
			featureStart.total_free_spins !== FREE_SPIN_COUNT
		) {
			fail('feature_start contradicts the canonical BLACKOUT feature', featureStart.index);
		}

		for (let freeSpinIndex = 1; freeSpinIndex <= FREE_SPIN_COUNT; freeSpinIndex += 1) {
			const freeSpin = consume('free_spin_start');
			if (
				freeSpin.free_spin_index !== freeSpinIndex ||
				freeSpin.total_free_spins !== FREE_SPIN_COUNT ||
				freeSpin.remaining_after_current !== FREE_SPIN_COUNT - freeSpinIndex
			) {
				fail('free-spin counter is not contiguous', freeSpin.index);
			}

			const spin = consume('spin_set');
			if (spin.phase !== 'feature' || spin.spin_index !== freeSpinIndex) {
				fail('feature spin identity is invalid', spin.index);
			}
			assertBoard(spin.board, 'feature board', spin.index);
			const expanded = expandTargetBoard(spin.board, featureStart.target_symbol);
			let evaluatedBoard = spin.board;
			if (expanded.expandedReels.length > 0) {
				const expansion = consume('expansion_applied');
				if (
					expansion.free_spin_index !== freeSpinIndex ||
					expansion.target_symbol !== featureStart.target_symbol ||
					!sameValue(expansion.expanded_reels, expanded.expandedReels) ||
					!sameValue(expansion.evaluated_board, expanded.evaluatedBoard)
				) {
					fail(
						'expansion_applied contradicts deterministic expansion of the original feature board',
						expansion.index,
					);
				}
				evaluatedBoard = expansion.evaluated_board;
			} else if (peek()?.type === 'expansion_applied') {
				fail('expansion_applied emitted without the selected target', peek().index);
			}

			const canonicalWins = evaluatePaylines(evaluatedBoard);
			let lineResult = null;
			if (canonicalWins.length > 0) {
				const lineEvent = consume('line_win');
				if (lineEvent.phase !== 'feature' || lineEvent.spin_index !== freeSpinIndex) {
					fail('feature line_win phase/index mismatch', lineEvent.index);
				}
				lineResult = validateCanonicalLineEvent(lineEvent, canonicalWins, cumulativeRaw);
				cumulativeRaw = lineResult.cumulativeRaw;
			} else if (peek()?.type === 'line_win') {
				fail('non-paying feature board emitted line_win', peek().index);
			}

			if (cumulativeRaw === MAX_WIN_RAW) {
				const cap = consume('cap_reached');
				validateCapEvent(cap, lineResult);
				capped = true;
				break;
			}
		}

		if (!capped) {
			const featureEnd = consume('feature_end');
			if (
				featureEnd.spins_played !== FREE_SPIN_COUNT ||
				featureEnd.total_free_spins !== FREE_SPIN_COUNT ||
				featureEnd.cumulative_payout_raw !== cumulativeRaw ||
				featureEnd.capped !== false
			) {
				fail('feature_end counters or payout are inconsistent', featureEnd.index);
			}
		}
	}

	const end = consume('round_end');
	if (cursor !== events.length) fail('round_end must be the final event', end.index);
	if (
		end.mode !== start.mode ||
		end.final_phase !== finalPhase ||
		end.payout_multiplier_raw !== cumulativeRaw ||
		end.capped !== capped ||
		capped !== (cumulativeRaw === MAX_WIN_RAW)
	) {
		fail('round_end does not match the validated authoritative lifecycle', end.index);
	}
	if (expectedPayoutRaw !== null && end.payout_multiplier_raw !== expectedPayoutRaw) {
		fail('book and round_end payout centi-x mismatch', end.index);
	}
	return end;
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
		if (expectedMode !== null && !isCanonicalMode(expectedMode)) {
			fail('expectedMode is not canonical');
		}
		if (expectedPayoutRaw !== null) assertUint(expectedPayoutRaw, 'expectedPayoutRaw');
		events.forEach((event, eventIndex) => validateEventShape(event, eventIndex));
		validateRoundLifecycle(events, expectedMode, expectedPayoutRaw);
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
