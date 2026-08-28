import {
  BREACH_SYMBOL,
  MODE_BY_NAME,
  REGULAR_SYMBOLS,
  WILD_SYMBOL,
  assert,
  cellKey,
} from '../../../math/games/blacksite_breach/src/config.mjs';
import {
  breachPositions,
  cloneBoard,
  evaluatePaylines,
  expandTarget,
  featureTriggered,
} from '../../../math/games/blacksite_breach/src/line-math.mjs';
import { validateBook } from '../../../math/games/blacksite_breach/src/validate-book.mjs';

const UINT32_MAX = 0xffff_ffff;
const FALLBACK_RNG_STATE = 0x6d2b_79f5;

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hashString(value) {
  let hash = 0x811c_9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return hash;
}

function normalizeSeed(seed) {
  if (typeof seed === 'number') {
    assert(Number.isSafeInteger(seed) && seed >= 0 && seed <= UINT32_MAX, 'DEV visual seed must be a uint32');
    return seed >>> 0;
  }
  if (typeof seed === 'bigint') {
    assert(seed >= 0n, 'DEV visual seed must not be negative');
    return Number(seed & BigInt(UINT32_MAX));
  }
  assert(typeof seed === 'string' && seed.length > 0, 'DEV visual seed must be a uint32, bigint, or non-empty string');
  return hashString(seed);
}

function createRng(seed) {
  let state = normalizeSeed(seed) || FALLBACK_RNG_STATE;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function shuffle(values, rng) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const replacement = rng() % (index + 1);
    [shuffled[index], shuffled[replacement]] = [shuffled[replacement], shuffled[index]];
  }
  return shuffled;
}

function outcomeProjection(book) {
  return book.events.map((event) => {
    const projected = clonePlain(event);
    if (projected.type === 'spin_set') delete projected.board;
    if (projected.type === 'expansion_applied') delete projected.evaluated_board;
    return projected;
  });
}

function expectedBoardState(board, targetSymbol) {
  const expansion = targetSymbol
    ? expandTarget(board, targetSymbol)
    : { expandedReels: [], evaluatedBoard: board };
  return {
    breachPositions: breachPositions(board),
    featureTriggered: featureTriggered(board),
    expandedReels: expansion.expandedReels,
    evaluatedBoard: expansion.evaluatedBoard,
    wins: evaluatePaylines(expansion.evaluatedBoard),
  };
}

function candidateState(board, targetSymbol) {
  const expansion = targetSymbol
    ? expandTarget(board, targetSymbol)
    : { expandedReels: [], evaluatedBoard: board };
  return {
    breachPositions: breachPositions(board),
    featureTriggered: featureTriggered(board),
    expandedReels: expansion.expandedReels,
    evaluatedBoard: expansion.evaluatedBoard,
    wins: evaluatePaylines(expansion.evaluatedBoard),
  };
}

function preservesBoardMath(candidate, expected, targetSymbol) {
  const observed = candidateState(candidate, targetSymbol);
  return sameValue(observed.breachPositions, expected.breachPositions)
    && observed.featureTriggered === expected.featureTriggered
    && sameValue(observed.expandedReels, expected.expandedReels)
    && sameValue(observed.wins, expected.wins);
}

function winningCellsThatRemainVisible(expected) {
  const expandedReels = new Set(expected.expandedReels);
  const cells = new Set();
  for (const win of expected.wins) {
    for (const position of win.positions) {
      if (!expandedReels.has(position.column)) cells.add(cellKey(position));
    }
  }
  return cells;
}

function mutableCells(board, expected, targetSymbol, rng) {
  const protectedWinCells = winningCellsThatRemainVisible(expected);
  const cells = [];
  for (let column = 0; column < board.length; column += 1) {
    for (let row = 0; row < board[column].length; row += 1) {
      const symbol = board[column][row];
      if (symbol === BREACH_SYMBOL || symbol === WILD_SYMBOL) continue;
      if (targetSymbol && symbol === targetSymbol) continue;
      if (protectedWinCells.has(cellKey({ column, row }))) continue;
      cells.push({ column, row });
    }
  }
  return shuffle(cells, rng);
}

function replacementSymbols(currentSymbol, column, expected, targetSymbol, rng) {
  const expandedReels = new Set(expected.expandedReels);
  const symbols = REGULAR_SYMBOLS.filter((symbol) => {
    if (symbol === currentSymbol) return false;
    if (targetSymbol && !expandedReels.has(column) && symbol === targetSymbol) return false;
    return true;
  });
  return shuffle(symbols, rng);
}

function variantizeBoard(board, targetSymbol, rng) {
  const expected = expectedBoardState(board, targetSymbol);
  let candidate = cloneBoard(board);
  let changedCells = 0;

  for (const { column, row } of mutableCells(candidate, expected, targetSymbol, rng)) {
    const currentSymbol = candidate[column][row];
    for (const replacement of replacementSymbols(currentSymbol, column, expected, targetSymbol, rng)) {
      const trial = cloneBoard(candidate);
      trial[column][row] = replacement;
      if (!preservesBoardMath(trial, expected, targetSymbol)) continue;
      candidate = trial;
      changedCells += 1;
      break;
    }
  }

  const observed = candidateState(candidate, targetSymbol);
  assert(sameValue(observed.breachPositions, expected.breachPositions), 'DEV variant changed BREACH positions');
  assert(observed.featureTriggered === expected.featureTriggered, 'DEV variant changed feature trigger state');
  assert(sameValue(observed.expandedReels, expected.expandedReels), 'DEV variant changed expanded reels');
  assert(sameValue(observed.wins, expected.wins), 'DEV variant changed canonical line wins');

  return {
    board: candidate,
    evaluatedBoard: observed.evaluatedBoard,
    changedCells,
  };
}

function inferMode(book) {
  const modeName = book?.events?.[0]?.type === 'round_start' ? book.events[0].mode : null;
  const mode = MODE_BY_NAME.get(modeName);
  assert(mode, 'DEV variant book must begin with a canonical round_start mode');
  return mode;
}

export function variantizeDevBookWithReport(sourceBook, seed) {
  const mode = inferMode(sourceBook);
  const beforeValidation = validateBook(sourceBook, mode, sourceBook.id, sourceBook.payoutMultiplier);
  const beforeProjection = outcomeProjection(sourceBook);
  const book = clonePlain(sourceBook);
  const rng = createRng(seed);
  const featureStart = book.events.find((event) => event.type === 'feature_start') ?? null;
  const expansionBySpin = new Map(book.events
    .filter((event) => event.type === 'expansion_applied')
    .map((event) => [event.free_spin_index, event]));
  let changedBoards = 0;
  let changedCells = 0;

  for (const event of book.events) {
    if (event.type !== 'spin_set') continue;
    const targetSymbol = event.phase === 'feature' ? featureStart?.target_symbol ?? null : null;
    const originalBoard = cloneBoard(event.board);
    const variant = variantizeBoard(originalBoard, targetSymbol, rng);
    event.board = variant.board;
    changedCells += variant.changedCells;
    if (!sameValue(originalBoard, variant.board)) changedBoards += 1;

    if (event.phase === 'feature') {
      const originalExpansion = expandTarget(originalBoard, targetSymbol);
      const expansionEvent = expansionBySpin.get(event.spin_index) ?? null;
      assert(Boolean(expansionEvent) === (originalExpansion.expandedReels.length > 0), 'DEV variant expansion event grammar mismatch');
      if (expansionEvent) expansionEvent.evaluated_board = variant.evaluatedBoard;
    }
  }

  assert(sameValue(outcomeProjection(book), beforeProjection), 'DEV variant changed a non-visual book field');
  const afterValidation = validateBook(book, mode, book.id, book.payoutMultiplier);
  assert(sameValue(afterValidation, beforeValidation), 'DEV variant changed the canonical book validation result');

  return {
    book,
    report: Object.freeze({
      seed: normalizeSeed(seed),
      boardCount: book.events.filter((event) => event.type === 'spin_set').length,
      changedBoards,
      changedCells,
    }),
  };
}

export function variantizeDevBook(sourceBook, seed) {
  return variantizeDevBookWithReport(sourceBook, seed).book;
}
