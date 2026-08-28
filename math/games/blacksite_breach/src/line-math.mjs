import {
  BREACH_SYMBOL,
  GAME_CONFIG,
  MECHANICS,
  PAYLINES,
  PAYTABLE,
  REGULAR_SYMBOLS,
  SYMBOLS,
  WILD_SYMBOL,
  assert,
  cellKey,
} from './config.mjs';

export const BOARD_COLUMNS = GAME_CONFIG.layout.columns;
export const BOARD_ROWS = GAME_CONFIG.layout.rows;
export const FREE_SPINS = MECHANICS.feature.free_spins;
export const PAYING_SYMBOLS = Object.freeze([...PAYTABLE.symbol_order]);

const SYMBOL_ORDER = new Map(PAYING_SYMBOLS.map((symbol, index) => [symbol, index]));

assert(BOARD_COLUMNS === 5 && BOARD_ROWS === 3, 'v3 board must be 5x3');
assert(PAYLINES.length === 10, 'v3 must expose exactly ten paylines');
assert(new Set(PAYLINES.map((line) => JSON.stringify(line.rows))).size === PAYLINES.length, 'paylines must be unique');
assert(PAYLINES.every((line, index) => line.id === index && line.rows.length === BOARD_COLUMNS && line.rows.every((row) => Number.isInteger(row) && row >= 0 && row < BOARD_ROWS)), 'payline registry is invalid');
assert(PAYING_SYMBOLS.at(-1) === WILD_SYMBOL, 'wild must have a deterministic final symbol-order position');

export function cloneBoard(board) {
  return board.map((column) => [...column]);
}

export function validateBoardShape(board, context = 'board') {
  assert(Array.isArray(board) && board.length === BOARD_COLUMNS, `${context}: expected ${BOARD_COLUMNS} columns`);
  const breachColumns = new Set();
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    assert(Array.isArray(board[column]) && board[column].length === BOARD_ROWS, `${context}: column ${column} expected ${BOARD_ROWS} rows`);
    let breachCount = 0;
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      assert(SYMBOLS.includes(board[column][row]), `${context}: unknown symbol at ${column},${row}`);
      if (board[column][row] === BREACH_SYMBOL) breachCount += 1;
    }
    assert(breachCount <= 1, `${context}: BREACH may appear at most once on reel ${column}`);
    if (breachCount === 1) breachColumns.add(column);
  }
  return breachColumns;
}

export function positionsForSymbol(board, symbol) {
  const positions = [];
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      if (board[column][row] === symbol) positions.push({ column, row });
    }
  }
  return positions;
}

export function breachPositions(board) {
  return positionsForSymbol(board, BREACH_SYMBOL);
}

export function featureTriggered(board) {
  return new Set(breachPositions(board).map((position) => position.column)).size >= MECHANICS.trigger.minimum_distinct_reels;
}

export function paytableValue(symbol, matchCount) {
  const matchIndex = PAYTABLE.matches.indexOf(matchCount);
  assert(matchIndex >= 0, `unsupported match count ${matchCount}`);
  const value = PAYTABLE.symbols[symbol]?.[matchIndex];
  assert(Number.isSafeInteger(value) && value > 0, `missing paytable value for ${symbol}/${matchCount}`);
  return value;
}

function candidateForLine(board, line, symbol) {
  const positions = [];
  const wildPositions = [];
  let containsRegularTarget = false;
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    const position = { column, row: line.rows[column] };
    const cell = board[column][position.row];
    const matches = symbol === WILD_SYMBOL
      ? cell === WILD_SYMBOL
      : cell === symbol || cell === WILD_SYMBOL;
    if (!matches) break;
    positions.push(position);
    if (cell === WILD_SYMBOL) wildPositions.push(position);
    if (cell === symbol && symbol !== WILD_SYMBOL) containsRegularTarget = true;
  }
  if (positions.length < MECHANICS.board.minimum_match) return null;
  if (symbol !== WILD_SYMBOL && !containsRegularTarget) return null;
  return {
    line_id: line.id,
    symbol,
    match_count: positions.length,
    positions,
    wild_positions: wildPositions,
    base_payout_raw: paytableValue(symbol, positions.length),
  };
}

function betterCandidate(left, right) {
  if (right.base_payout_raw !== left.base_payout_raw) return right.base_payout_raw > left.base_payout_raw ? right : left;
  if (right.match_count !== left.match_count) return right.match_count > left.match_count ? right : left;
  return SYMBOL_ORDER.get(right.symbol) < SYMBOL_ORDER.get(left.symbol) ? right : left;
}

export function evaluatePaylines(board) {
  validateBoardShape(board, 'evaluated board');
  const wins = [];
  for (const line of PAYLINES) {
    let selected = null;
    for (const symbol of PAYING_SYMBOLS) {
      const candidate = candidateForLine(board, line, symbol);
      if (candidate) selected = selected ? betterCandidate(selected, candidate) : candidate;
    }
    if (selected) wins.push(selected);
  }
  return wins;
}

export function expandTarget(board, targetSymbol) {
  validateBoardShape(board, 'original feature board');
  assert(REGULAR_SYMBOLS.includes(targetSymbol), `invalid expansion target ${targetSymbol}`);
  const evaluatedBoard = cloneBoard(board);
  const expandedReels = [];
  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    if (board[column].includes(targetSymbol)) {
      expandedReels.push(column);
      evaluatedBoard[column] = Array.from({ length: BOARD_ROWS }, () => targetSymbol);
    }
  }
  return { evaluatedBoard, expandedReels };
}

export function sameBoard(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function samePositions(left, right) {
  return JSON.stringify(left.map(cellKey)) === JSON.stringify(right.map(cellKey));
}
