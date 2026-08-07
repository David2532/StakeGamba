import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOOKS_PER_MODE,
  EVENT_SCHEMA,
  EVENT_SCHEMA_SHA256,
  MAX_WIN_RAW,
  MODE_REGISTRY,
  TARGET_RTP,
} from '../src/config.mjs';
import { FIXTURE_RESERVED_IDS, allocateModePayouts, buildBook } from '../src/model.mjs';
import { validateBook } from '../src/validate-book.mjs';
import { verifyCandidate } from '../verify.mjs';

test('deterministic equal-weight allocations satisfy exact per-mode totals and cardinality', () => {
  for (const mode of MODE_REGISTRY.modes) {
    const first = allocateModePayouts(mode);
    const second = allocateModePayouts(mode);
    assert.deepEqual(first, second);
    assert.equal(first.length, BOOKS_PER_MODE + 1);
    assert.equal(first.slice(1).filter((payout) => payout === 0).length, mode.zero_books);
    assert.equal(first.slice(1).filter((payout) => payout > 0).length, mode.positive_books);
    assert.equal(first[BOOKS_PER_MODE], MAX_WIN_RAW);
    assert.equal(first.slice(1).reduce((sum, payout) => sum + payout, 0), TARGET_RTP * 100 * mode.cost * BOOKS_PER_MODE);
  }
});

test('representative zero, normal, feature, tail and max books satisfy strict v1 event/formula/topology validation', () => {
  for (const mode of MODE_REGISTRY.modes) {
    const payouts = allocateModePayouts(mode);
    const ids = new Set([
      1,
      mode.zero_books,
      mode.zero_books + 1,
      mode.zero_books + 4,
      mode.zero_books + 126,
      Math.min(BOOKS_PER_MODE - 1, mode.zero_books + 1000),
      BOOKS_PER_MODE,
    ]);
    for (const id of ids) {
      const book = buildBook(mode, id, payouts[id]);
      const result = validateBook(book, mode, id, payouts[id]);
      assert.equal(result.eventCount, book.events.length);
      assert.equal(book.events.at(-1).payout_multiplier_raw, payouts[id]);
    }
  }
});

test('canonical event schema binds closed keys, types, units and ordering grammar', () => {
  assert.equal(EVENT_SCHEMA.contract, 'blacksite-book-events-v1');
  assert.equal(EVENT_SCHEMA.closed_records, true);
  assert.match(EVENT_SCHEMA.units.payout_raw, /centi-x/);
  assert.ok(EVENT_SCHEMA.events.cluster_win.every((field) => field.name && field.type));
  assert.match(EVENT_SCHEMA.ordering_grammar.cap_termination, /cap_reached -> round_end/);
  assert.equal(EVENT_SCHEMA_SHA256.length, 64);
});

test('contract fixtures prove access 2/3, physical cascade 3/5, simultaneous clusters and natural feature entry', () => {
  const mode = MODE_REGISTRY.modes.find((candidate) => candidate.name === 'base');
  const payouts = allocateModePayouts(mode);
  const cases = [
    [FIXTURE_RESERVED_IDS.base.access_2, (result) => result.accessValues.includes(2) && !result.sawCoreLive],
    [FIXTURE_RESERVED_IDS.base.access_3, (result) => result.accessValues.includes(3) && !result.sawCoreLive],
    [FIXTURE_RESERVED_IDS.base.cascade_3, (result) => result.maxCascadeWins === 3],
    [FIXTURE_RESERVED_IDS.base.cascade_5, (result) => result.maxCascadeWins >= 5 && result.maxClustersInStep >= 2],
    [FIXTURE_RESERVED_IDS.base.natural_blackout, (result) => result.sawCoreLive && result.sawNaturalFeature && result.maxTotalCycles === 12],
  ];
  for (const [id, predicate] of cases) {
    const book = buildBook(mode, id, payouts[id]);
    assert.ok(predicate(validateBook(book, mode, id, payouts[id])), `fixture ${id} predicate failed`);
  }
});

test('zero grammar and direct BLACKOUT seed phase are exact', () => {
  for (const mode of MODE_REGISTRY.modes) {
    const book = buildBook(mode, 1, 0);
    validateBook(book, mode, 1, 0);
    if (mode.name === 'base') assert.deepEqual(book.events.map((event) => event.type), ['round_start', 'board_set', 'round_end']);
    if (mode.name === 'deep_access') assert.deepEqual(book.events.slice(0, 4).map((event) => event.type), ['round_start', 'breach_state', 'access_changed', 'board_set']);
    if (mode.name === 'blackout') {
      assert.equal(book.events[0].initial_phase, 'feature');
      assert.equal(book.events[1].type, 'breach_state');
      assert.equal(book.events[1].phase, 'feature');
      assert.equal(book.events.at(-2).type, 'feature_end');
    }
  }
});

test('validator rejects a non-physical post-tumble survivor mutation', () => {
  const mode = MODE_REGISTRY.modes.find((candidate) => candidate.name === 'base');
  const payouts = allocateModePayouts(mode);
  const id = FIXTURE_RESERVED_IDS.base.cascade_3;
  const book = structuredClone(buildBook(mode, id, payouts[id]));
  const tumbleIndex = book.events.findIndex((event) => event.type === 'tumble');
  const tumble = book.events[tumbleIndex];
  const nextBoard = book.events[tumbleIndex + 1];
  const removedInColumn = tumble.removed_positions.filter((cell) => cell.column === 0).length;
  const survivorRow = Math.max(removedInColumn, 6);
  const current = nextBoard.board[0][survivorRow];
  nextBoard.board[0][survivorRow] = current === 'byte' ? 'relay' : 'byte';
  assert.throws(() => validateBook(book, mode, id, payouts[id]), /survivor gravity\/order mismatch|cluster is not an exact board/);
});

test('published candidate fully decompresses and passes all package/math/risk gates', async () => {
  const result = await verifyCandidate({ writeAudits: false });
  assert.equal(result.verifyResult.result, 'PASS');
  assert.equal(result.verifyResult.books_verified, 300000);
  assert.equal(result.verifyResult.all_tumbles_physical_gravity_and_top_refill_validated, true);
  assert.equal(result.verifyResult.all_contract_fixture_predicates_passed, true);
  assert.equal(result.verifyResult.all_gates_passed, true);
});
