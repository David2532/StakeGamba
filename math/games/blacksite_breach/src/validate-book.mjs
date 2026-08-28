import {
  EVENT_SCHEMA,
  EVENT_SCHEMA_SHA256 as CONFIG_EVENT_SCHEMA_SHA256,
  MAX_WIN_RAW,
  MECHANICS,
  PAYOUT_UNIT,
  REGULAR_SYMBOLS,
  assert,
  cellKey,
  compareCells,
  isUint,
} from './config.mjs';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  FREE_SPINS,
  breachPositions,
  evaluatePaylines,
  expandTarget,
  featureTriggered,
  sameBoard,
  validateBoardShape,
} from './line-math.mjs';

export const BOOK_EVENT_CONTRACT = EVENT_SCHEMA.contract;
export const EVENT_SCHEMA_SHA256 = CONFIG_EVENT_SCHEMA_SHA256;

const EVENT_KEYS = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_SCHEMA.events).map(([type, fields]) => [type, fields.map((field) => field.name)]),
));
const LINE_WIN_KEYS = Object.freeze(EVENT_SCHEMA.records.line_win_item.map((field) => field.name));

assert(EVENT_SCHEMA.schema_version === 3, 'event schema version mismatch');
assert(EVENT_SCHEMA.closed_records === true, 'event schema must close records');
assert(BOOK_EVENT_CONTRACT === 'blacksite-book-events-v3', 'event contract mismatch');

function exactKeys(value, expected, context) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${context}: expected object`);
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(canonical), `${context}: keys ${actual.join(',')} != ${canonical.join(',')}`);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validatePosition(position, context) {
  exactKeys(position, ['column', 'row'], context);
  assert(isUint(position.column) && position.column < BOARD_COLUMNS, `${context}: column out of range`);
  assert(isUint(position.row) && position.row < BOARD_ROWS, `${context}: row out of range`);
}

function validatePositions(positions, context, { unique = true } = {}) {
  assert(Array.isArray(positions), `${context}: expected position array`);
  const keys = new Set();
  for (let index = 0; index < positions.length; index += 1) {
    validatePosition(positions[index], `${context}[${index}]`);
    const key = cellKey(positions[index]);
    if (unique) assert(!keys.has(key), `${context}: duplicate ${key}`);
    keys.add(key);
  }
  return keys;
}

function validateLineEvent(event, canonicalWins, cumulativeRaw, context) {
  assert(canonicalWins.length > 0, `${context}: line_win has no canonical wins`);
  assert(Array.isArray(event.wins) && event.wins.length === canonicalWins.length, `${context}: line win count mismatch`);
  let capRemaining = MAX_WIN_RAW - cumulativeRaw;
  let stepCalculatedRaw = 0;
  let stepPayoutRaw = 0;
  const signatures = [];
  for (let index = 0; index < canonicalWins.length; index += 1) {
    const actual = event.wins[index];
    const expected = canonicalWins[index];
    exactKeys(actual, LINE_WIN_KEYS, `${context}.wins[${index}]`);
    assert(actual.line_id === expected.line_id, `${context}: line order/id mismatch`);
    assert(actual.symbol === expected.symbol && actual.match_count === expected.match_count, `${context}: line symbol/count mismatch`);
    validatePositions(actual.positions, `${context}.wins[${index}].positions`);
    validatePositions(actual.wild_positions, `${context}.wins[${index}].wild_positions`);
    assert(sameValue(actual.positions, expected.positions), `${context}: line positions mismatch`);
    assert(sameValue(actual.wild_positions, expected.wild_positions), `${context}: wild positions mismatch`);
    assert(actual.base_payout_raw === expected.base_payout_raw, `${context}: paytable value mismatch`);
    assert(actual.calculated_award_raw === expected.base_payout_raw, `${context}: calculated award mismatch`);
    const applied = Math.min(expected.base_payout_raw, capRemaining);
    assert(actual.applied_award_raw === applied, `${context}: applied award mismatch`);
    capRemaining -= applied;
    stepCalculatedRaw += expected.base_payout_raw;
    stepPayoutRaw += applied;
    signatures.push(`${actual.line_id}:${actual.symbol}:${actual.match_count}:${actual.base_payout_raw}`);
  }
  assert(event.step_calculated_raw === stepCalculatedRaw, `${context}: calculated step total mismatch`);
  assert(event.step_payout_raw === stepPayoutRaw && stepPayoutRaw > 0, `${context}: applied step total mismatch`);
  assert(event.cumulative_before_raw === cumulativeRaw, `${context}: cumulative_before mismatch`);
  assert(event.cumulative_after_raw === cumulativeRaw + stepPayoutRaw, `${context}: cumulative_after mismatch`);
  assert(event.cap_applied === (stepCalculatedRaw !== stepPayoutRaw), `${context}: cap_applied mismatch`);
  return { cumulativeRaw: cumulativeRaw + stepPayoutRaw, stepCalculatedRaw, stepPayoutRaw, signatures };
}

export function validateBook(book, mode, expectedId, expectedPayoutRaw) {
  exactKeys(book, ['events', 'id', 'payoutMultiplier'], `${mode.name}/${expectedId} book`);
  assert(book.id === expectedId, `${mode.name}/${expectedId}: book ID mismatch`);
  assert(book.payoutMultiplier === expectedPayoutRaw && isUint(book.payoutMultiplier), `${mode.name}/${expectedId}: payout mismatch`);
  assert(Array.isArray(book.events) && book.events.length >= 2, `${mode.name}/${expectedId}: events missing`);
  const eventCounts = {};
  for (let index = 0; index < book.events.length; index += 1) {
    const event = book.events[index];
    assert(event && Object.hasOwn(EVENT_KEYS, event.type), `${mode.name}/${expectedId}/${index}: unknown event type`);
    exactKeys(event, EVENT_KEYS[event.type], `${mode.name}/${expectedId}/${index} ${event.type}`);
    assert(event.index === index && isUint(event.index), `${mode.name}/${expectedId}/${index}: event index mismatch`);
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }

  let cursor = 0;
  const consume = (type) => {
    const event = book.events[cursor];
    assert(event?.type === type, `${mode.name}/${expectedId}/${cursor}: expected ${type}, got ${event?.type ?? 'EOF'}`);
    cursor += 1;
    return event;
  };
  const peek = () => book.events[cursor] ?? null;
  const start = consume('round_start');
  assert(start.schema_version === 3 && start.event_contract === BOOK_EVENT_CONTRACT, `${mode.name}/${expectedId}: round contract mismatch`);
  assert(start.mode === mode.name && start.cost_multiplier === mode.cost, `${mode.name}/${expectedId}: mode/cost mismatch`);
  assert(start.payout_unit === PAYOUT_UNIT && start.max_win_raw === MAX_WIN_RAW, `${mode.name}/${expectedId}: payout unit/cap mismatch`);
  assert(start.board_columns === BOARD_COLUMNS && start.board_rows === BOARD_ROWS && start.payline_count === MECHANICS.paylines.length, `${mode.name}/${expectedId}: layout mismatch`);
  assert(start.initial_phase === (mode.direct_feature ? 'feature' : 'base'), `${mode.name}/${expectedId}: initial phase mismatch`);
  validatePositions(start.guaranteed_breach_positions, `${mode.name}/${expectedId}: guaranteed positions`);
  assert(sameValue(start.guaranteed_breach_positions, mode.guaranteed_breach_positions), `${mode.name}/${expectedId}: guaranteed positions mismatch`);

  let cumulativeRaw = 0;
  let entersFeature = mode.direct_feature;
  let sawNaturalFeature = false;
  let sawDirectFeature = false;
  let expansionCount = 0;
  let maximumExpandedReels = 0;
  const expansionTargets = new Set();
  const lineSignatures = new Set();
  let maxLinesInSpin = 0;
  let baseLinesWon = 0;
  let freeSpinsPlayed = 0;
  let capped = false;

  if (!mode.direct_feature) {
    const spin = consume('spin_set');
    assert(spin.phase === 'base' && spin.spin_index === 0, `${mode.name}/${expectedId}: opening spin identity mismatch`);
    validateBoardShape(spin.board, `${mode.name}/${expectedId}: opening board`);
    for (const guaranteed of mode.guaranteed_breach_positions) {
      assert(spin.board[guaranteed.column][guaranteed.row] === 'breach', `${mode.name}/${expectedId}: guaranteed BREACH missing at ${cellKey(guaranteed)}`);
    }
    const canonicalWins = evaluatePaylines(spin.board);
    if (canonicalWins.length > 0) {
      const lineEvent = consume('line_win');
      assert(lineEvent.phase === 'base' && lineEvent.spin_index === 0, `${mode.name}/${expectedId}: opening line phase/index mismatch`);
      const result = validateLineEvent(lineEvent, canonicalWins, cumulativeRaw, `${mode.name}/${expectedId}: opening line_win`);
      cumulativeRaw = result.cumulativeRaw;
      result.signatures.forEach((signature) => lineSignatures.add(signature));
      maxLinesInSpin = Math.max(maxLinesInSpin, canonicalWins.length);
      baseLinesWon = canonicalWins.length;
    } else {
      assert(peek()?.type !== 'line_win', `${mode.name}/${expectedId}: non-paying opening spin emitted line_win`);
    }
    entersFeature = featureTriggered(spin.board);
    if (entersFeature) {
      const trigger = consume('feature_trigger');
      const positions = breachPositions(spin.board).sort(compareCells);
      validatePositions(trigger.positions, `${mode.name}/${expectedId}: trigger positions`);
      assert(sameValue(trigger.positions, positions), `${mode.name}/${expectedId}: trigger positions mismatch`);
      assert(trigger.distinct_reels === new Set(positions.map((position) => position.column)).size && trigger.distinct_reels >= 3, `${mode.name}/${expectedId}: distinct trigger reels mismatch`);
      assert(trigger.awarded_free_spins === FREE_SPINS, `${mode.name}/${expectedId}: awarded spins mismatch`);
      sawNaturalFeature = true;
    } else {
      assert(peek()?.type !== 'feature_trigger', `${mode.name}/${expectedId}: feature trigger is not justified`);
      if (mode.name === 'deep_access') {
        assert(breachPositions(spin.board).length === mode.guaranteed_breach_positions.length, `${mode.name}/${expectedId}: non-trigger opening must contain exactly the two guaranteed BREACH symbols`);
      }
    }
  }

  if (entersFeature) {
    const featureStart = consume('feature_start');
    assert(featureStart.direct === mode.direct_feature, `${mode.name}/${expectedId}: direct feature flag mismatch`);
    assert(REGULAR_SYMBOLS.includes(featureStart.target_symbol), `${mode.name}/${expectedId}: invalid expansion target`);
    assert(featureStart.total_free_spins === FREE_SPINS, `${mode.name}/${expectedId}: total free spins mismatch`);
    sawDirectFeature = mode.direct_feature;
    for (let freeSpinIndex = 1; freeSpinIndex <= FREE_SPINS; freeSpinIndex += 1) {
      const freeSpin = consume('free_spin_start');
      assert(freeSpin.free_spin_index === freeSpinIndex && freeSpin.total_free_spins === FREE_SPINS && freeSpin.remaining_after_current === FREE_SPINS - freeSpinIndex, `${mode.name}/${expectedId}: free spin counter mismatch`);
      const spin = consume('spin_set');
      assert(spin.phase === 'feature' && spin.spin_index === freeSpinIndex, `${mode.name}/${expectedId}: feature spin identity mismatch`);
      validateBoardShape(spin.board, `${mode.name}/${expectedId}: free spin ${freeSpinIndex} board`);
      const expanded = expandTarget(spin.board, featureStart.target_symbol);
      let evaluatedBoard = spin.board;
      if (expanded.expandedReels.length > 0) {
        const expansion = consume('expansion_applied');
        assert(expansion.free_spin_index === freeSpinIndex && expansion.target_symbol === featureStart.target_symbol, `${mode.name}/${expectedId}: expansion identity mismatch`);
        assert(sameValue(expansion.expanded_reels, expanded.expandedReels), `${mode.name}/${expectedId}: expanded reel set mismatch`);
        assert(sameBoard(expansion.evaluated_board, expanded.evaluatedBoard), `${mode.name}/${expectedId}: evaluated expansion board mismatch`);
        evaluatedBoard = expansion.evaluated_board;
        expansionCount += 1;
        maximumExpandedReels = Math.max(maximumExpandedReels, expansion.expanded_reels.length);
        expansionTargets.add(expansion.target_symbol);
      } else {
        assert(peek()?.type !== 'expansion_applied', `${mode.name}/${expectedId}: expansion event emitted without target`);
      }
      const canonicalWins = evaluatePaylines(evaluatedBoard);
      if (canonicalWins.length > 0) {
        const lineEvent = consume('line_win');
        assert(lineEvent.phase === 'feature' && lineEvent.spin_index === freeSpinIndex, `${mode.name}/${expectedId}: feature line phase/index mismatch`);
        const result = validateLineEvent(lineEvent, canonicalWins, cumulativeRaw, `${mode.name}/${expectedId}: free spin ${freeSpinIndex} line_win`);
        cumulativeRaw = result.cumulativeRaw;
        result.signatures.forEach((signature) => lineSignatures.add(signature));
        maxLinesInSpin = Math.max(maxLinesInSpin, canonicalWins.length);
        if (cumulativeRaw === MAX_WIN_RAW) {
          const cap = consume('cap_reached');
          assert(cap.cap_raw === MAX_WIN_RAW && cap.cumulative_payout_raw === MAX_WIN_RAW, `${mode.name}/${expectedId}: cap identity mismatch`);
          assert(cap.gross_award_raw === result.stepCalculatedRaw && cap.accepted_award_raw === result.stepPayoutRaw, `${mode.name}/${expectedId}: cap step reconciliation mismatch`);
          assert(cap.discarded_award_raw === result.stepCalculatedRaw - result.stepPayoutRaw, `${mode.name}/${expectedId}: cap discarded award mismatch`);
          capped = true;
          freeSpinsPlayed = freeSpinIndex;
          break;
        }
      } else {
        assert(peek()?.type !== 'line_win', `${mode.name}/${expectedId}: non-paying free spin emitted line_win`);
      }
      freeSpinsPlayed = freeSpinIndex;
    }
    if (!capped) {
      const featureEnd = consume('feature_end');
      assert(featureEnd.spins_played === FREE_SPINS && featureEnd.total_free_spins === FREE_SPINS, `${mode.name}/${expectedId}: feature end spin count mismatch`);
      assert(featureEnd.cumulative_payout_raw === cumulativeRaw && featureEnd.capped === false, `${mode.name}/${expectedId}: feature end payout mismatch`);
    }
  }

  const end = consume('round_end');
  assert(cursor === book.events.length, `${mode.name}/${expectedId}: trailing events after round_end`);
  assert(end.mode === mode.name && end.final_phase === (entersFeature ? 'feature' : 'base'), `${mode.name}/${expectedId}: round_end identity mismatch`);
  assert(end.payout_multiplier_raw === expectedPayoutRaw && end.payout_multiplier_raw === cumulativeRaw, `${mode.name}/${expectedId}: terminal payout mismatch`);
  assert(end.capped === capped && capped === (expectedPayoutRaw === MAX_WIN_RAW), `${mode.name}/${expectedId}: terminal cap mismatch`);
  assert((eventCounts.round_start ?? 0) === 1 && (eventCounts.round_end ?? 0) === 1, `${mode.name}/${expectedId}: start/end uniqueness mismatch`);
  assert((eventCounts.feature_trigger ?? 0) <= 1 && (eventCounts.feature_start ?? 0) <= 1 && (eventCounts.cap_reached ?? 0) <= 1, `${mode.name}/${expectedId}: singleton event count mismatch`);
  assert((eventCounts.free_spin_start ?? 0) === freeSpinsPlayed, `${mode.name}/${expectedId}: free spin event count mismatch`);
  assert(!entersFeature || capped || freeSpinsPlayed === FREE_SPINS, `${mode.name}/${expectedId}: incomplete feature`);
  assert(cumulativeRaw === book.payoutMultiplier, `${mode.name}/${expectedId}: cumulative payout mismatch`);
  return {
    eventCount: book.events.length,
    eventCounts,
    lineSignatures: [...lineSignatures].sort(),
    maxLinesInSpin,
    baseLinesWon,
    expansionCount,
    maximumExpandedReels,
    expansionTargets: [...expansionTargets].sort(),
    sawNaturalFeature,
    sawDirectFeature,
    freeSpinsPlayed,
    deepAccessGuaranteeObserved: mode.name !== 'deep_access' || !mode.direct_feature,
    capped,
  };
}
