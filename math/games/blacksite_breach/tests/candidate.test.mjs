import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOOKS_PER_MODE,
  EVENT_SCHEMA,
  MAX_WIN_RAW,
  MECHANICS,
  MODE_REGISTRY,
  PAYLINES,
  PAYTABLE,
  REGULAR_SYMBOLS,
  SPECIAL_SYMBOLS,
  TARGET_RTP,
} from '../src/config.mjs';
import {
  evaluatePaylines,
  expandTarget,
  validateBoardShape,
} from '../src/line-math.mjs';
import {
  BASE_LINE_BOOK_COUNT,
  DISTINCT_RESERVED_PAYOUTS,
  EXPANSION_FIXTURE_OFFSET,
  allocateModePayouts,
  buildBook,
  decomposePayout,
} from '../src/model.mjs';
import { EVENT_SCHEMA_SHA256, validateBook } from '../src/validate-book.mjs';
import { verifyCandidate } from '../verify.mjs';

test('v3 freezes a column-major 5x3 board and ten unique canonical paylines', () => {
  assert.deepEqual(MECHANICS.board, {
    columns: 5,
    rows: 3,
    storage: 'column-major',
    pay_direction: 'left-to-right from column 0',
    minimum_match: 3,
    maximum_match: 5,
  });
  assert.deepEqual(PAYLINES.map((line) => line.rows), [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [0, 1, 0, 1, 0],
  ]);
  assert.equal(new Set(PAYLINES.map((line) => JSON.stringify(line.rows))).size, 10);
});

test('v3 freezes exactly thirteen reel symbol ids and the canonical paytable', () => {
  const exactReelSymbols = [
    'operative', 'encrypted_drive', 'tactical_radio', 'classified_folder',
    'night_vision_goggles', 'supply_crate', 'ghost_wild', 'breach',
    'a', 'k', 'q', 'j', 'ten',
  ];
  assert.deepEqual(EVENT_SCHEMA.enums.symbol, exactReelSymbols);
  assert.deepEqual(new Set([...REGULAR_SYMBOLS, ...SPECIAL_SYMBOLS]), new Set(exactReelSymbols));
  assert.equal(new Set([...REGULAR_SYMBOLS, ...SPECIAL_SYMBOLS]).size, 13);
  assert.deepEqual(PAYTABLE.symbol_order, [
    'operative', 'encrypted_drive', 'tactical_radio', 'classified_folder',
    'night_vision_goggles', 'supply_crate', 'a', 'k', 'q', 'j', 'ten', 'ghost_wild',
  ]);
  assert.deepEqual(PAYTABLE.symbols, {
    operative: [25, 250, 1000],
    encrypted_drive: [15, 150, 750],
    tactical_radio: [10, 100, 500],
    classified_folder: [7, 75, 400],
    night_vision_goggles: [5, 50, 250],
    supply_crate: [4, 40, 200],
    a: [3, 30, 150],
    k: [2, 20, 100],
    q: [2, 15, 75],
    j: [1, 10, 50],
    ten: [1, 8, 40],
    ghost_wild: [100, 2500, 125000],
  });
  assert.deepEqual(PAYTABLE.non_paying_symbols, ['breach']);
});

test('payline evaluator resolves WILD ambiguity by award, WILD self-pays, and BREACH neither substitutes nor pays', () => {
  const board = [
    ['ghost_wild', 'k', 'a'],
    ['ghost_wild', 'a', 'night_vision_goggles'],
    ['ghost_wild', 'night_vision_goggles', 'tactical_radio'],
    ['ten', 'tactical_radio', 'k'],
    ['breach', 'k', 'a'],
  ];
  validateBoardShape(board);
  const top = evaluatePaylines(board).find((win) => win.line_id === 1);
  assert.deepEqual({ symbol: top.symbol, count: top.match_count, raw: top.base_payout_raw }, {
    symbol: 'ghost_wild', count: 3, raw: PAYTABLE.symbols.ghost_wild[0],
  });
  assert.ok(evaluatePaylines(board).every((win) => win.symbol !== 'breach'));
  const invalid = structuredClone(board);
  invalid[4][1] = 'breach';
  assert.throws(() => validateBoardShape(invalid), /at most once/);
});

test('selected regular target expands every containing reel before ten-line evaluation', () => {
  const board = [
    ['ten', 'k', 'a'],
    ['k', 'ten', 'night_vision_goggles'],
    ['a', 'night_vision_goggles', 'ten'],
    ['k', 'a', 'night_vision_goggles'],
    ['a', 'night_vision_goggles', 'tactical_radio'],
  ];
  const expanded = expandTarget(board, 'ten');
  assert.deepEqual(expanded.expandedReels, [0, 1, 2]);
  assert.deepEqual(expanded.evaluatedBoard.slice(0, 3), [
    ['ten', 'ten', 'ten'],
    ['ten', 'ten', 'ten'],
    ['ten', 'ten', 'ten'],
  ]);
  const wins = evaluatePaylines(expanded.evaluatedBoard);
  assert.equal(wins.length, 10);
  assert.ok(wins.every((win) => win.symbol === 'ten' && win.match_count === 3 && win.base_payout_raw === 1));
});

test('unit-weight payout allocation is deterministic, exact, diverse and constructible', () => {
  for (const mode of MODE_REGISTRY.modes) {
    const first = allocateModePayouts(mode);
    const second = allocateModePayouts(mode);
    assert.deepEqual(first, second);
    assert.equal(first.length, BOOKS_PER_MODE + 1);
    assert.equal(first.slice(1).filter((payout) => payout === 0).length, mode.zero_books);
    assert.equal(first.slice(1).filter((payout) => payout > 0).length, mode.positive_books);
    assert.equal(first[BOOKS_PER_MODE], MAX_WIN_RAW);
    assert.equal(first.slice(1).reduce((sum, payout) => sum + payout, 0), TARGET_RTP * 100 * mode.cost * BOOKS_PER_MODE);
    assert.ok(new Set(first.slice(1).filter((payout) => payout > 0)).size >= 100);
    for (const payout of new Set(first.slice(1))) {
      if (payout > 0 && payout < MAX_WIN_RAW) assert.ok(decomposePayout(payout).length <= 8);
    }
  }
});

test('zero, expansion, baseline and max books pass the closed v3 validator in every mode', () => {
  for (const mode of MODE_REGISTRY.modes) {
    const payouts = allocateModePayouts(mode);
    const ids = [1, mode.zero_books + 1, mode.zero_books + EXPANSION_FIXTURE_OFFSET, mode.zero_books + 101, BOOKS_PER_MODE];
    for (const id of ids) {
      const book = buildBook(mode, id, payouts[id]);
      const result = validateBook(book, mode, id, payouts[id]);
      assert.equal(result.eventCount, book.events.length);
      assert.equal(book.events.at(-1).payout_multiplier_raw, payouts[id]);
    }
  }
});

test('DEEP ACCESS always carries its two guaranteed opening BREACH positions and needs a third distinct reel to trigger', () => {
  const mode = MODE_REGISTRY.modes.find((candidate) => candidate.name === 'deep_access');
  const payouts = allocateModePayouts(mode);
  const zero = buildBook(mode, 1, payouts[1]);
  const featureId = mode.zero_books + EXPANSION_FIXTURE_OFFSET;
  const feature = buildBook(mode, featureId, payouts[featureId]);
  for (const book of [zero, feature]) {
    const opening = book.events.find((event) => event.type === 'spin_set' && event.phase === 'base');
    for (const position of mode.guaranteed_breach_positions) assert.equal(opening.board[position.column][position.row], 'breach');
  }
  assert.equal(zero.events.some((event) => event.type === 'feature_trigger'), false);
  assert.equal(feature.events.some((event) => event.type === 'feature_trigger'), true);
});

test('Base distribution includes 10,000 familiar opening-spin line wins without feature entry', () => {
  const mode = MODE_REGISTRY.modes.find((candidate) => candidate.name === 'base');
  const payouts = allocateModePayouts(mode);
  const firstId = mode.zero_books + DISTINCT_RESERVED_PAYOUTS + 1;
  let observed = 0;
  for (let id = firstId; id < firstId + BASE_LINE_BOOK_COUNT; id += 1) {
    assert.equal(payouts[id], 250);
    observed += 1;
  }
  assert.equal(observed, BASE_LINE_BOOK_COUNT);
  const book = buildBook(mode, firstId, payouts[firstId]);
  const result = validateBook(book, mode, firstId, payouts[firstId]);
  assert.equal(result.baseLinesWon, 10);
  assert.equal(result.sawNaturalFeature, false);
  assert.deepEqual(book.events.map((event) => event.type), ['round_start', 'spin_set', 'line_win', 'round_end']);
});

test('validator rejects mutated authoritative line awards and expansion boards', () => {
  const mode = MODE_REGISTRY.modes.find((candidate) => candidate.name === 'base');
  const payouts = allocateModePayouts(mode);
  const id = mode.zero_books + EXPANSION_FIXTURE_OFFSET;
  const lineMutation = structuredClone(buildBook(mode, id, payouts[id]));
  lineMutation.events.find((event) => event.type === 'line_win').wins[0].base_payout_raw += 1;
  assert.throws(() => validateBook(lineMutation, mode, id, payouts[id]), /paytable value mismatch/);
  const expansionMutation = structuredClone(buildBook(mode, id, payouts[id]));
  const expansion = expansionMutation.events.find((event) => event.type === 'expansion_applied');
  expansion.evaluated_board[0][0] = 'k';
  assert.throws(() => validateBook(expansionMutation, mode, id, payouts[id]), /evaluated expansion board mismatch/);
});

test('canonical schema is closed blacksite-book-events-v3 with cap termination', () => {
  assert.equal(EVENT_SCHEMA.schema_version, 3);
  assert.equal(EVENT_SCHEMA.contract, 'blacksite-book-events-v3');
  assert.equal(EVENT_SCHEMA.closed_records, true);
  assert.deepEqual(Object.keys(EVENT_SCHEMA.events), [
    'round_start', 'spin_set', 'expansion_applied', 'line_win', 'feature_trigger',
    'feature_start', 'free_spin_start', 'feature_end', 'cap_reached', 'round_end',
  ]);
  assert.match(EVENT_SCHEMA.ordering_grammar.cap_termination, /line_win -> cap_reached -> round_end/);
  assert.equal(EVENT_SCHEMA_SHA256.length, 64);
});

test('published v3 candidate fully decompresses and passes package, line, expansion and risk gates', async () => {
  const result = await verifyCandidate({ writeAudits: false });
  assert.equal(result.verifyResult.result, 'PASS');
  assert.equal(result.verifyResult.books_verified, 300000);
  assert.equal(result.verifyResult.all_books_decompressed_and_schema_formula_payline_validated, true);
  assert.equal(result.verifyResult.all_wild_resolution_and_expansion_recomputed, true);
  assert.equal(result.verifyResult.all_contract_fixture_predicates_passed, true);
  assert.equal(result.verifyResult.all_gates_passed, true);
});
