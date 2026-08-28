import {
  BOOKS_PER_MODE,
  BREACH_SYMBOL,
  MAX_WIN_RAW,
  MECHANICS,
  PAYTABLE,
  REGULAR_SYMBOLS,
  TARGET_RTP,
  WILD_SYMBOL,
  assert,
  compareCells,
} from './config.mjs';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  FREE_SPINS,
  breachPositions,
  cloneBoard,
  evaluatePaylines,
  expandTarget,
  featureTriggered,
  paytableValue,
  validateBoardShape,
} from './line-math.mjs';

export const EXPANSION_FIXTURE_OFFSET = 10;
export const DISTINCT_RESERVED_PAYOUTS = 100;
export const BASE_LINE_BOOK_COUNT = 10000;

export function mixSeed(...values) {
  let seed = 0x9e3779b9;
  for (const value of values) {
    seed ^= Number(value) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35) >>> 0;
    seed ^= seed >>> 16;
  }
  return seed >>> 0 || 0x6d2b79f5;
}

export function xorshift32(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

const DEFAULT_TARGET = 'operative';
const TEMPLATE_FILLERS = REGULAR_SYMBOLS.filter((symbol) => symbol !== DEFAULT_TARGET);
const ATOM_TEMPLATE_CACHE = new Map();
const ZERO_TEMPLATE_CACHE = new Map();
const DECOMPOSITION_CACHE = new Map();

const atomEntries = [];
for (const symbol of [...REGULAR_SYMBOLS.filter((candidate) => candidate !== DEFAULT_TARGET), WILD_SYMBOL]) {
  for (const matchCount of PAYTABLE.matches) {
    atomEntries.push({ symbol, matchCount, payoutRaw: paytableValue(symbol, matchCount) });
  }
}
const uniqueByPayout = new Map();
for (const atom of atomEntries) {
  if (!uniqueByPayout.has(atom.payoutRaw)) uniqueByPayout.set(atom.payoutRaw, atom);
}
const DECOMPOSITION_ATOMS = Object.freeze([...uniqueByPayout.values()].sort((left, right) =>
  right.payoutRaw - left.payoutRaw || left.symbol.localeCompare(right.symbol) || right.matchCount - left.matchCount));

function randomBoard(rng, fillers = TEMPLATE_FILLERS) {
  return Array.from({ length: BOARD_COLUMNS }, () =>
    Array.from({ length: BOARD_ROWS }, () => fillers[rng() % fillers.length]));
}

function searchBoard({ seed, mutate, accept, fillers = TEMPLATE_FILLERS }) {
  const rng = xorshift32(seed);
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const board = randomBoard(rng, fillers);
    mutate(board);
    validateBoardShape(board, 'generated template');
    if (accept(board)) return board;
  }
  throw new Error(`unable to construct deterministic board template for seed ${seed}`);
}

function zeroBoard(requiredBreaches = [], avoidSymbol = DEFAULT_TARGET) {
  const sorted = [...requiredBreaches].sort(compareCells);
  const key = `${avoidSymbol}:${sorted.map((position) => `${position.column},${position.row}`).join('|') || 'none'}`;
  if (!ZERO_TEMPLATE_CACHE.has(key)) {
    const seenColumns = new Set();
    for (const position of sorted) {
      assert(Number.isInteger(position.column) && position.column >= 0 && position.column < BOARD_COLUMNS, `${key}: invalid BREACH column`);
      assert(Number.isInteger(position.row) && position.row >= 0 && position.row < BOARD_ROWS, `${key}: invalid BREACH row`);
      assert(!seenColumns.has(position.column), `${key}: more than one BREACH on a reel`);
      seenColumns.add(position.column);
    }
    const board = searchBoard({
      seed: mixSeed(0xb10c, sorted.length, ...sorted.flatMap((position) => [position.column, position.row])),
      fillers: REGULAR_SYMBOLS.filter((symbol) => symbol !== avoidSymbol),
      mutate(candidate) {
        for (const position of sorted) candidate[position.column][position.row] = BREACH_SYMBOL;
      },
      accept(candidate) {
        return evaluatePaylines(candidate).length === 0;
      },
    });
    ZERO_TEMPLATE_CACHE.set(key, board);
  }
  return cloneBoard(ZERO_TEMPLATE_CACHE.get(key));
}

function atomBoard(atom) {
  if (atom.symbol === WILD_SYMBOL && atom.matchCount === 4 && atom.payoutRaw === 2500) {
    return expansionBoard(DEFAULT_TARGET, 4);
  }
  const key = `${atom.symbol}:${atom.matchCount}`;
  if (!ATOM_TEMPLATE_CACHE.has(key)) {
    const fillers = TEMPLATE_FILLERS.filter((symbol) => symbol !== atom.symbol);
    const board = searchBoard({
      seed: mixSeed(0xa70d, atom.payoutRaw, atom.matchCount, PAYTABLE.symbol_order.indexOf(atom.symbol)),
      fillers,
      mutate(candidate) {
        for (let column = 0; column < atom.matchCount; column += 1) candidate[column][0] = atom.symbol;
        if (atom.matchCount < BOARD_COLUMNS) candidate[atom.matchCount][0] = BREACH_SYMBOL;
      },
      accept(candidate) {
        const wins = evaluatePaylines(candidate);
        return wins.length === 1 && wins[0].line_id === 1 && wins[0].symbol === atom.symbol &&
          wins[0].match_count === atom.matchCount && wins[0].base_payout_raw === atom.payoutRaw;
      },
    });
    ATOM_TEMPLATE_CACHE.set(key, board);
  }
  return cloneBoard(ATOM_TEMPLATE_CACHE.get(key));
}

function expansionBoard(targetSymbol, expandedReels = 3) {
  assert(REGULAR_SYMBOLS.includes(targetSymbol), 'expansion target must be regular');
  assert(expandedReels >= 3 && expandedReels <= 5, 'expansion reel count must be 3..5');
  const fillers = REGULAR_SYMBOLS.filter((symbol) => symbol !== targetSymbol);
  const rng = xorshift32(mixSeed(0xeaa1, expandedReels, REGULAR_SYMBOLS.indexOf(targetSymbol)));
  const board = randomBoard(rng, fillers);
  for (let column = 0; column < expandedReels; column += 1) {
    board[column][column % BOARD_ROWS] = targetSymbol;
  }
  validateBoardShape(board, 'expansion fixture board');
  const expanded = expandTarget(board, targetSymbol);
  assert(expanded.expandedReels.length === expandedReels, 'expansion fixture reel count mismatch');
  const wins = evaluatePaylines(expanded.evaluatedBoard);
  assert(wins.length === 10 && wins.every((win) => win.symbol === targetSymbol && win.match_count === expandedReels), 'expansion fixture wins mismatch');
  return board;
}

function maxWinBoard() {
  const board = Array.from({ length: BOARD_COLUMNS }, () =>
    Array.from({ length: BOARD_ROWS }, () => WILD_SYMBOL));
  const wins = evaluatePaylines(board);
  assert(wins.length === 10 && wins.every((win) => win.symbol === WILD_SYMBOL && win.match_count === 5), 'max-win board must produce ten WILD-5 lines');
  assert(wins.reduce((sum, win) => sum + win.base_payout_raw, 0) > MAX_WIN_RAW, 'max-win board must exercise cap truncation');
  return board;
}

function baseMultiLineBoard() {
  const board = randomBoard(xorshift32(mixSeed(0xba5e, 250)), REGULAR_SYMBOLS.filter((symbol) => symbol !== 'operative'));
  for (let column = 0; column < 3; column += 1) board[column] = Array.from({ length: BOARD_ROWS }, () => 'operative');
  const wins = evaluatePaylines(board);
  assert(wins.length === 10 && wins.every((win) => win.symbol === 'operative' && win.match_count === 3 && win.base_payout_raw === 25), 'base multiline board mismatch');
  return board;
}

function minimumCoinDecomposition(payoutRaw) {
  if (payoutRaw === 0) return [];
  if (payoutRaw === MAX_WIN_RAW) {
    const maxAtom = DECOMPOSITION_ATOMS.find((atom) => atom.symbol === WILD_SYMBOL && atom.matchCount === 5);
    assert(maxAtom && maxAtom.payoutRaw * FREE_SPINS === MAX_WIN_RAW, 'max-win atom does not exactly fill eight spins');
    return Array.from({ length: FREE_SPINS }, () => maxAtom);
  }
  assert(Number.isSafeInteger(payoutRaw) && payoutRaw > 0 && payoutRaw < MAX_WIN_RAW, `invalid decomposition target ${payoutRaw}`);
  const best = Array.from({ length: payoutRaw + 1 }, () => null);
  best[0] = [];
  for (let amount = 1; amount <= payoutRaw; amount += 1) {
    for (const atom of DECOMPOSITION_ATOMS) {
      if (atom.payoutRaw > amount || best[amount - atom.payoutRaw] === null) continue;
      const candidate = [...best[amount - atom.payoutRaw], atom];
      if (candidate.length > FREE_SPINS) continue;
      if (best[amount] === null || candidate.length < best[amount].length) best[amount] = candidate;
    }
  }
  assert(best[payoutRaw] !== null && best[payoutRaw].length <= FREE_SPINS, `payout ${payoutRaw} is not constructible within ${FREE_SPINS} free spins`);
  return best[payoutRaw];
}

export function decomposePayout(payoutRaw) {
  if (!DECOMPOSITION_CACHE.has(payoutRaw)) DECOMPOSITION_CACHE.set(payoutRaw, minimumCoinDecomposition(payoutRaw));
  return [...DECOMPOSITION_CACHE.get(payoutRaw)];
}

export function allocateModePayouts(mode) {
  assert(mode.zero_books + mode.positive_books === BOOKS_PER_MODE, `${mode.name}: zero/positive book counts must cover the library`);
  assert(mode.positive_books > DISTINCT_RESERVED_PAYOUTS + 1, `${mode.name}: insufficient positive books`);
  const payouts = new Uint32Array(BOOKS_PER_MODE + 1);
  const firstPositive = mode.zero_books + 1;
  for (let payout = 1; payout <= DISTINCT_RESERVED_PAYOUTS; payout += 1) {
    payouts[firstPositive + payout - 1] = payout;
    decomposePayout(payout);
  }
  payouts[BOOKS_PER_MODE] = MAX_WIN_RAW;
  const targetTotal = TARGET_RTP * 100 * mode.cost * BOOKS_PER_MODE;
  assert(Number.isSafeInteger(targetTotal), `${mode.name}: target payout total must be integer`);
  let reservedTotal = (DISTINCT_RESERVED_PAYOUTS * (DISTINCT_RESERVED_PAYOUTS + 1)) / 2 + MAX_WIN_RAW;
  let baselineStart = firstPositive + DISTINCT_RESERVED_PAYOUTS;
  if (mode.name === 'base') {
    for (let offset = 0; offset < BASE_LINE_BOOK_COUNT; offset += 1) payouts[baselineStart + offset] = 250;
    reservedTotal += BASE_LINE_BOOK_COUNT * 250;
    baselineStart += BASE_LINE_BOOK_COUNT;
  }
  const baselineCount = BOOKS_PER_MODE - baselineStart;
  const remaining = targetTotal - reservedTotal;
  const baseline = Math.floor(remaining / baselineCount);
  const raisedCount = remaining % baselineCount;
  decomposePayout(baseline);
  decomposePayout(baseline + 1);
  for (let offset = 0; offset < baselineCount; offset += 1) {
    payouts[baselineStart + offset] = baseline + (offset < raisedCount ? 1 : 0);
  }
  const observedTotal = payouts.slice(1).reduce((sum, payout) => sum + payout, 0);
  const observedZeros = payouts.slice(1).filter((payout) => payout === 0).length;
  assert(observedTotal === targetTotal, `${mode.name}: deterministic payout allocation total mismatch`);
  assert(observedZeros === mode.zero_books, `${mode.name}: deterministic zero count mismatch`);
  assert(new Set(payouts.slice(1).filter((payout) => payout > 0)).size >= 100, `${mode.name}: positive payout diversity below 100`);
  return payouts;
}

function addEvent(state, event) {
  state.events.push({ index: state.events.length, ...event });
}

function addLineWin(state, phase, spinIndex, board) {
  const canonicalWins = evaluatePaylines(board);
  if (canonicalWins.length === 0) return null;
  let remainingCap = MAX_WIN_RAW - state.cumulativeRaw;
  let stepCalculatedRaw = 0;
  let stepPayoutRaw = 0;
  const wins = canonicalWins.map((win) => {
    const calculated = win.base_payout_raw;
    const applied = Math.min(calculated, remainingCap);
    remainingCap -= applied;
    stepCalculatedRaw += calculated;
    stepPayoutRaw += applied;
    return {
      ...win,
      calculated_award_raw: calculated,
      applied_award_raw: applied,
    };
  });
  const cumulativeBefore = state.cumulativeRaw;
  state.cumulativeRaw += stepPayoutRaw;
  addEvent(state, {
    type: 'line_win',
    phase,
    spin_index: spinIndex,
    wins,
    step_calculated_raw: stepCalculatedRaw,
    step_payout_raw: stepPayoutRaw,
    cumulative_before_raw: cumulativeBefore,
    cumulative_after_raw: state.cumulativeRaw,
    cap_applied: stepCalculatedRaw !== stepPayoutRaw,
  });
  return { stepCalculatedRaw, stepPayoutRaw };
}

function openingBreachPositions(mode, triggerFeature) {
  const positions = mode.guaranteed_breach_positions.map((position) => ({ ...position }));
  if (triggerFeature) {
    const occupied = new Set(positions.map((position) => position.column));
    const triggerColumn = [2, 1, 3, 0, 4].find((column) => !occupied.has(column));
    positions.push({ column: triggerColumn, row: mode.name === 'deep_access' ? 1 : 2 });
    while (positions.length < 3) {
      const column = [0, 2, 4, 1, 3].find((candidate) => !positions.some((position) => position.column === candidate));
      positions.push({ column, row: positions.length % BOARD_ROWS });
    }
  }
  return positions.sort(compareCells);
}

function roundStart(mode) {
  return {
    type: 'round_start',
    schema_version: 3,
    event_contract: 'blacksite-book-events-v3',
    mode: mode.name,
    cost_multiplier: mode.cost,
    payout_unit: 'centi-x_uint64',
    max_win_raw: MAX_WIN_RAW,
    board_columns: BOARD_COLUMNS,
    board_rows: BOARD_ROWS,
    payline_count: MECHANICS.paylines.length,
    initial_phase: mode.direct_feature ? 'feature' : 'base',
    guaranteed_breach_positions: mode.guaranteed_breach_positions.map((position) => ({ ...position })),
  };
}

export function buildBook(mode, id, payoutRaw) {
  assert(Number.isSafeInteger(id) && id >= 1 && id <= BOOKS_PER_MODE, `invalid book id ${id}`);
  assert(Number.isSafeInteger(payoutRaw) && payoutRaw >= 0 && payoutRaw <= MAX_WIN_RAW, `invalid payout ${payoutRaw}`);
  const state = { events: [], cumulativeRaw: 0 };
  addEvent(state, roundStart(mode));
  const baseLineStart = mode.zero_books + DISTINCT_RESERVED_PAYOUTS + 1;
  const baseOnlyLineWin = mode.name === 'base' && id >= baseLineStart && id < baseLineStart + BASE_LINE_BOOK_COUNT;
  assert(!baseOnlyLineWin || payoutRaw === 250, `${mode.name}/${id}: base-only line book must pay 250 raw`);
  const entersFeature = mode.direct_feature || (payoutRaw > 0 && !baseOnlyLineWin);

  if (!mode.direct_feature) {
    const requiredBreaches = openingBreachPositions(mode, entersFeature);
    const openingBoard = baseOnlyLineWin ? baseMultiLineBoard() : zeroBoard(requiredBreaches);
    addEvent(state, { type: 'spin_set', phase: 'base', spin_index: 0, board: openingBoard });
    if (baseOnlyLineWin) addLineWin(state, 'base', 0, openingBoard);
    else assert(evaluatePaylines(openingBoard).length === 0, `${mode.name}/${id}: opening trigger board unexpectedly pays`);
    const triggered = featureTriggered(openingBoard);
    assert(triggered === entersFeature, `${mode.name}/${id}: opening trigger state mismatch`);
    if (triggered) {
      const positions = breachPositions(openingBoard).sort(compareCells);
      addEvent(state, {
        type: 'feature_trigger',
        positions,
        distinct_reels: new Set(positions.map((position) => position.column)).size,
        awarded_free_spins: FREE_SPINS,
      });
    }
  }

  let capped = false;
  if (entersFeature) {
    const expansionFixture = id === mode.zero_books + EXPANSION_FIXTURE_OFFSET && payoutRaw === 10;
    const targetSymbol = expansionFixture ? 'ten' : DEFAULT_TARGET;
    addEvent(state, {
      type: 'feature_start',
      direct: mode.direct_feature,
      target_symbol: targetSymbol,
      total_free_spins: FREE_SPINS,
    });
    const atoms = expansionFixture || payoutRaw === MAX_WIN_RAW ? [] : decomposePayout(payoutRaw);
    for (let freeSpinIndex = 1; freeSpinIndex <= FREE_SPINS; freeSpinIndex += 1) {
      addEvent(state, {
        type: 'free_spin_start',
        free_spin_index: freeSpinIndex,
        total_free_spins: FREE_SPINS,
        remaining_after_current: FREE_SPINS - freeSpinIndex,
      });
      let board;
      if (payoutRaw === MAX_WIN_RAW && freeSpinIndex === 1) board = maxWinBoard();
      else if (expansionFixture && freeSpinIndex === 1) board = expansionBoard(targetSymbol, 3);
      else if (atoms[freeSpinIndex - 1]) board = atomBoard(atoms[freeSpinIndex - 1]);
      else board = zeroBoard([], targetSymbol);
      addEvent(state, { type: 'spin_set', phase: 'feature', spin_index: freeSpinIndex, board });
      const expanded = expandTarget(board, targetSymbol);
      if (expanded.expandedReels.length > 0) {
        addEvent(state, {
          type: 'expansion_applied',
          free_spin_index: freeSpinIndex,
          target_symbol: targetSymbol,
          expanded_reels: expanded.expandedReels,
          evaluated_board: expanded.evaluatedBoard,
        });
      }
      const lineResult = addLineWin(state, 'feature', freeSpinIndex, expanded.evaluatedBoard);
      if (state.cumulativeRaw === MAX_WIN_RAW) {
        assert(lineResult, `${mode.name}/${id}: cap requires a line win`);
        addEvent(state, {
          type: 'cap_reached',
          cap_raw: MAX_WIN_RAW,
          gross_award_raw: lineResult.stepCalculatedRaw,
          accepted_award_raw: lineResult.stepPayoutRaw,
          discarded_award_raw: lineResult.stepCalculatedRaw - lineResult.stepPayoutRaw,
          cumulative_payout_raw: MAX_WIN_RAW,
        });
        capped = true;
        break;
      }
    }
    if (!capped) {
      addEvent(state, {
        type: 'feature_end',
        spins_played: FREE_SPINS,
        total_free_spins: FREE_SPINS,
        cumulative_payout_raw: state.cumulativeRaw,
        capped: false,
      });
    }
  }

  assert(state.cumulativeRaw === payoutRaw, `${mode.name}/${id}: constructed payout ${state.cumulativeRaw} != ${payoutRaw}`);
  addEvent(state, {
    type: 'round_end',
    mode: mode.name,
    final_phase: entersFeature ? 'feature' : 'base',
    payout_multiplier_raw: payoutRaw,
    capped,
  });
  return { id, payoutMultiplier: payoutRaw, events: state.events };
}
