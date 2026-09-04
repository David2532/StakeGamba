import {
  BOOKS_PER_MODE,
  MAX_WIN_RAW,
  MECHANICS,
  PAYTABLE,
  SYMBOLS,
  TARGET_RTP,
  assert,
  cellKey,
  parseCellKey,
  sortedCells,
} from './config.mjs';

const BAND_BY_ID = new Map(MECHANICS.board.cluster_bands.map((band, index) => [band.id, { ...band, index }]));
const ALL_ATOMS = [];
for (const symbol of SYMBOLS) {
  PAYTABLE.symbols[symbol].forEach((payoutRaw, bandIndex) => {
    const bandId = PAYTABLE.cluster_bands[bandIndex];
    const band = BAND_BY_ID.get(bandId);
    ALL_ATOMS.push({
      symbol,
      band_id: bandId,
      cluster_size: band.representative_size,
      base_payout_raw: payoutRaw,
    });
  });
}

const CASCADE_SYMBOLS = Object.freeze(['byte', 'relay', 'proxy', 'cipher']);
const FILLER_SYMBOLS = Object.freeze(['daemon', 'vault']);
const SAFE_ATOM_BY_PAYOUT = new Map();
for (const atom of ALL_ATOMS
  .filter((candidate) => CASCADE_SYMBOLS.includes(candidate.symbol))
  .sort((left, right) => left.cluster_size - right.cluster_size || CASCADE_SYMBOLS.indexOf(left.symbol) - CASCADE_SYMBOLS.indexOf(right.symbol))) {
  if (!SAFE_ATOM_BY_PAYOUT.has(atom.base_payout_raw)) SAFE_ATOM_BY_PAYOUT.set(atom.base_payout_raw, atom);
}
const SAFE_DENOMINATIONS = [...SAFE_ATOM_BY_PAYOUT.keys()].sort((left, right) => right - left);
const CAP_ATOM = ALL_ATOMS.find((atom) => atom.symbol === 'vault' && atom.cluster_size === 49 && atom.base_payout_raw === 100000);

const INGRESS_KEYS = new Set(MECHANICS.underlay.ingress_cells.map(cellKey));
const CORE_KEY = cellKey(MECHANICS.underlay.core_cell);
const PORT_BY_KEY = new Map(MECHANICS.underlay.exfil_ports.map((port) => [cellKey(port), port]));
const ALL_CELL_KEYS = new Set(Array.from({ length: 49 }, (_, index) => `${index % 7},${Math.floor(index / 7)}`));
const TOP_COLUMN_ORDER = Object.freeze([3, 2, 4, 1, 5, 0, 6]);
const TOP_POSITION_ORDER = Object.freeze(Array.from({ length: 7 }, (_, row) =>
  TOP_COLUMN_ORDER.map((column) => Object.freeze({ column, row }))).flat());

const BASE_ARM_POSITIONS = Object.freeze([
  { column: 3, row: 6 }, { column: 3, row: 5 }, { column: 3, row: 4 },
  { column: 3, row: 3 }, { column: 2, row: 6 },
]);
const DEEP_ARM_POSITIONS = Object.freeze([
  { column: 3, row: 5 }, { column: 3, row: 4 }, { column: 3, row: 3 },
  { column: 2, row: 4 }, { column: 2, row: 5 },
]);
const EXFIL_PATHS = Object.freeze({
  north: Object.freeze([
    { column: 3, row: 3 }, { column: 3, row: 2 }, { column: 3, row: 1 },
    { column: 3, row: 0 }, { column: 2, row: 2 },
  ]),
  west: Object.freeze([
    { column: 3, row: 3 }, { column: 2, row: 3 }, { column: 1, row: 3 },
    { column: 0, row: 3 }, { column: 1, row: 2 },
  ]),
  east: Object.freeze([
    { column: 3, row: 3 }, { column: 4, row: 3 }, { column: 5, row: 3 },
    { column: 6, row: 3 }, { column: 5, row: 2 },
  ]),
});
const MULTI_CLUSTER_POSITIONS = Object.freeze([
  Object.freeze([
    { column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 },
    { column: 1, row: 1 }, { column: 2, row: 1 },
  ]),
  Object.freeze([
    { column: 4, row: 0 }, { column: 5, row: 0 }, { column: 6, row: 0 },
    { column: 4, row: 1 }, { column: 5, row: 1 },
  ]),
]);

export const TAIL_ANCHORS = Object.freeze({
  base: Object.freeze([
    Object.freeze({ count: 5, payout_raw: 100000, fixture_band: 'very_big' }),
    Object.freeze({ count: 20, payout_raw: 20000, fixture_band: 'big' }),
    Object.freeze({ count: 100, payout_raw: 5000, fixture_band: 'medium' }),
  ]),
  deep_access: Object.freeze([
    Object.freeze({ count: 5, payout_raw: 200000, fixture_band: 'very_big' }),
    Object.freeze({ count: 20, payout_raw: 50000, fixture_band: 'big' }),
    Object.freeze({ count: 100, payout_raw: 10000, fixture_band: 'medium' }),
  ]),
  blackout: Object.freeze([
    Object.freeze({ count: 20, payout_raw: 250000, fixture_band: 'very_big' }),
    Object.freeze({ count: 100, payout_raw: 100000, fixture_band: 'big' }),
    Object.freeze({ count: 300, payout_raw: 50000, fixture_band: 'medium' }),
  ]),
});

export const FIXTURE_RESERVED_IDS = Object.freeze({
  base: Object.freeze({
    win_01: 65126,
    win_02: 65127,
    win_03: 65128,
    win_04: 65129,
    win_05: 65130,
    cascade_5: 65126,
    cascade_3: 65129,
    access_2: 65326,
    access_3: 65346,
    natural_blackout: 65001,
  }),
});

export function xorshift32(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

export function mixSeed(...values) {
  let mixed = 0x811c9dc5;
  for (const value of values) {
    mixed ^= Number(value) >>> 0;
    mixed = Math.imul(mixed, 0x01000193) >>> 0;
  }
  return mixed || 1;
}

function distributeRemainder(payouts, mode, ids, targetTotal) {
  const count = ids.length;
  if (count <= 0) return;
  const rng = xorshift32(mixSeed(mode.generation_seed, 0xa110ca7e));
  const minimum = mode.name === 'base' ? 38 : mode.name === 'deep_access' ? 106 : 1423;
  const mean = Math.floor(targetTotal / count);
  const extra = targetTotal - mean * count;
  assert(mean >= minimum, `${mode.name}: allocation mean ${mean} is below positive minimum ${minimum}`);
  const amplitude = mean - minimum;
  const order = [...ids];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = rng() % (index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  const pairedLength = order.length - (order.length % 2);
  for (let index = 0; index < pairedLength; index += 2) {
    const delta = rng() % (amplitude + 1);
    payouts[order[index]] = mean - delta;
    payouts[order[index + 1]] = mean + delta;
  }
  if (pairedLength < order.length) payouts[order.at(-1)] = mean;
  for (let index = 0; index < extra; index += 1) payouts[order[index]] += 1;
}

export function allocateModePayouts(mode) {
  const payouts = new Uint32Array(BOOKS_PER_MODE + 1);
  let cursor = mode.zero_books + 1;
  let reservedTotal = 0;
  for (const anchor of TAIL_ANCHORS[mode.name]) {
    for (let count = 0; count < anchor.count; count += 1) {
      payouts[cursor] = anchor.payout_raw;
      reservedTotal += anchor.payout_raw;
      cursor += 1;
    }
  }
  payouts[BOOKS_PER_MODE] = MAX_WIN_RAW;
  reservedTotal += MAX_WIN_RAW;
  if (mode.name === 'base') {
    for (const id of new Set([
      FIXTURE_RESERVED_IDS.base.win_01,
      FIXTURE_RESERVED_IDS.base.win_02,
      FIXTURE_RESERVED_IDS.base.win_03,
      FIXTURE_RESERVED_IDS.base.win_04,
      FIXTURE_RESERVED_IDS.base.win_05,
      FIXTURE_RESERVED_IDS.base.access_2,
      FIXTURE_RESERVED_IDS.base.access_3,
    ])) {
      payouts[id] = 207;
      reservedTotal += 207;
    }
  }
  const targetTotal = TARGET_RTP * 100 * mode.cost * BOOKS_PER_MODE;
  assert(Number.isSafeInteger(targetTotal), `${mode.name}: target payout total must be integer`);
  const remainingIds = [];
  for (let id = cursor; id < BOOKS_PER_MODE; id += 1) {
    if (payouts[id] === 0) remainingIds.push(id);
  }
  distributeRemainder(payouts, mode, remainingIds, targetTotal - reservedTotal);
  const observedTotal = payouts.slice(1).reduce((sum, payout) => sum + payout, 0);
  const observedZeros = payouts.slice(1).filter((payout) => payout === 0).length;
  assert(observedTotal === targetTotal, `${mode.name}: deterministic payout allocation total mismatch`);
  assert(observedZeros === mode.zero_books, `${mode.name}: deterministic zero count mismatch`);
  return payouts;
}

export function shouldUseFeature(mode, id, payoutRaw) {
  if (mode.direct_feature) return true;
  if (mode.name === 'deep_access') return payoutRaw > 0 && featurePayoutPlan(mode, payoutRaw, false) !== null;
  if (mode.name === 'base' && [FIXTURE_RESERVED_IDS.base.access_2, FIXTURE_RESERVED_IDS.base.access_3, FIXTURE_RESERVED_IDS.base.cascade_5].includes(id)) {
    return false;
  }
  if (mode.name === 'base' && id === FIXTURE_RESERVED_IDS.base.win_05) return true;
  const minimum = mode.name === 'deep_access' ? 24 : 23;
  if (payoutRaw < minimum) return false;
  if (id === BOOKS_PER_MODE || id <= mode.zero_books + 5 || payoutRaw >= 5000) return featurePayoutPlan(mode, payoutRaw, false) !== null;
  const cadence = mode.name === 'base' ? 97 : 19;
  return (id - mode.zero_books) % cadence === 0 && featurePayoutPlan(mode, payoutRaw, false) !== null;
}

export function decomposeBasePayout(basePayoutRaw, { excludeFourteen = false } = {}) {
  assert(Number.isSafeInteger(basePayoutRaw) && basePayoutRaw >= 0, `invalid base payout ${basePayoutRaw}`);
  const atoms = [];
  let remaining = basePayoutRaw;
  const denominations = excludeFourteen ? SAFE_DENOMINATIONS.filter((value) => value !== 14) : SAFE_DENOMINATIONS;
  for (const denomination of denominations) {
    while (remaining >= denomination) {
      atoms.push(SAFE_ATOM_BY_PAYOUT.get(denomination));
      remaining -= denomination;
    }
  }
  assert(remaining === 0, `cannot decompose ${basePayoutRaw} centi-x`);
  return atoms;
}

function neighbours(cell) {
  return [
    { column: cell.column, row: cell.row - 1 },
    { column: cell.column - 1, row: cell.row },
    { column: cell.column + 1, row: cell.row },
    { column: cell.column, row: cell.row + 1 },
  ].filter((next) => next.column >= 0 && next.column < 7 && next.row >= 0 && next.row < 7);
}

export function computeLiveCells(breachedKeys) {
  const live = new Set();
  const queue = [];
  for (const ingressKey of INGRESS_KEYS) {
    if (breachedKeys.has(ingressKey)) {
      live.add(ingressKey);
      queue.push(parseCellKey(ingressKey));
    }
  }
  while (queue.length > 0) {
    const cell = queue.shift();
    for (const next of neighbours(cell)) {
      const key = cellKey(next);
      if (breachedKeys.has(key) && !live.has(key)) {
        live.add(key);
        queue.push(next);
      }
    }
  }
  return live;
}

export function isLinkedToLive(positions, liveKeys) {
  return positions.some((position) => liveKeys.has(cellKey(position)));
}

export function accessForLiveCells(liveKeys) {
  if (liveKeys.size === 0) return MECHANICS.access.no_live_cells_multiplier;
  const core = MECHANICS.underlay.core_cell;
  let minimumDistance = Infinity;
  for (const key of liveKeys) {
    const cell = parseCellKey(key);
    minimumDistance = Math.min(minimumDistance, Math.abs(cell.column - core.column) + Math.abs(cell.row - core.row));
  }
  const mapping = MECHANICS.access.pre_feature_by_minimum_live_manhattan_distance_to_core.find((entry) =>
    minimumDistance >= entry.minimum_distance && minimumDistance <= entry.maximum_distance);
  assert(mapping, `no access mapping for live distance ${minimumDistance}`);
  return mapping.multiplier;
}

function featureAccessForPorts(reachedPorts) {
  return MECHANICS.access.feature_linked_multiplier_by_reached_port_count[reachedPorts.size];
}

function cloneBoard(board) {
  return board.map((column) => [...column]);
}

function checkerboard(offset = 0) {
  return Array.from({ length: 7 }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => FILLER_SYMBOLS[(column + row + offset) % FILLER_SYMBOLS.length]));
}

function randomBoard(seed, allowedSymbols) {
  const rng = xorshift32(seed);
  return Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => allowedSymbols[rng() % allowedSymbols.length]));
}

function floodComponents(board) {
  const seen = new Set();
  const components = [];
  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row < 7; row += 1) {
      const start = { column, row };
      const startKey = cellKey(start);
      if (seen.has(startKey)) continue;
      const symbol = board[column][row];
      const queue = [start];
      const positions = [];
      seen.add(startKey);
      while (queue.length > 0) {
        const cell = queue.shift();
        positions.push(cell);
        for (const next of neighbours(cell)) {
          const key = cellKey(next);
          if (!seen.has(key) && board[next.column][next.row] === symbol) {
            seen.add(key);
            queue.push(next);
          }
        }
      }
      if (positions.length >= MECHANICS.board.minimum_cluster_size) components.push({ symbol, positions: sortedCells(positions) });
    }
  }
  return components;
}

function positionsEqual(left, right) {
  return left.length === right.length && left.every((cell, index) => cellKey(cell) === cellKey(right[index]));
}

function boardHasExactlyClusters(board, clusters) {
  const actual = floodComponents(board);
  if (actual.length !== clusters.length) return false;
  return clusters.every((cluster) => {
    const expected = sortedCells(cluster.positions);
    return actual.some((component) => component.symbol === cluster.atom.symbol && positionsEqual(component.positions, expected));
  });
}

function topPositions(size) {
  assert(size >= 5 && size <= 49, `invalid top cluster size ${size}`);
  return TOP_POSITION_ORDER.slice(0, size).map((cell) => ({ ...cell }));
}

function ordinaryStep(atom) {
  return { clusters: [{ atom, positions: topPositions(atom.cluster_size) }], fixture_kind: 'ordinary' };
}

function multiClusterStep() {
  return {
    clusters: [
      { atom: SAFE_ATOM_BY_PAYOUT.get(1), positions: MULTI_CLUSTER_POSITIONS[0].map((cell) => ({ ...cell })) },
      { atom: SAFE_ATOM_BY_PAYOUT.get(2), positions: MULTI_CLUSTER_POSITIONS[1].map((cell) => ({ ...cell })) },
    ],
    fixture_kind: 'simultaneous_two_cluster',
  };
}

function boardForStep(step, background) {
  const board = cloneBoard(background);
  for (const cluster of step.clusters) {
    for (const position of cluster.positions) board[position.column][position.row] = cluster.atom.symbol;
  }
  assert(boardHasExactlyClusters(board, step.clusters), 'scripted top board has unexpected paying component');
  return board;
}

function removedPositions(step) {
  return sortedCells(new Map(step.clusters.flatMap((cluster) => cluster.positions.map((position) => [cellKey(position), position]))).values());
}

function deriveTumble(currentBoard, nextBoard, removed) {
  const removedSet = new Set(removed.map(cellKey));
  const enteringSymbols = [];
  for (let column = 0; column < 7; column += 1) {
    const survivors = [];
    for (let row = 0; row < 7; row += 1) {
      if (!removedSet.has(`${column},${row}`)) survivors.push(currentBoard[column][row]);
    }
    const removedCount = 7 - survivors.length;
    assert(JSON.stringify(survivors) === JSON.stringify(nextBoard[column].slice(removedCount)), `physical survivor mismatch in column ${column}`);
    for (let row = 0; row < removedCount; row += 1) {
      enteringSymbols.push({ column, row, symbol: nextBoard[column][row] });
    }
  }
  return enteringSymbols;
}

function buildTopCascade(steps, offset = 0) {
  const background = checkerboard(offset);
  const boards = steps.map((step) => boardForStep(step, background));
  boards.push(cloneBoard(background));
  const transitions = steps.map((step, index) => {
    const removed = removedPositions(step);
    return { removed, entering: deriveTumble(boards[index], boards[index + 1], removed) };
  });
  return { boards, transitions };
}

const CUSTOM_TEMPLATE_CACHE = new Map();

function customTemplate(clusters) {
  const key = clusters.map((cluster) => `${cluster.atom.symbol}:${cluster.positions.map(cellKey).sort().join('|')}`).join('::');
  if (CUSTOM_TEMPLATE_CACHE.has(key)) return CUSTOM_TEMPLATE_CACHE.get(key);
  const removed = sortedCells(new Map(clusters.flatMap((cluster) => cluster.positions.map((position) => [cellKey(position), position]))).values());
  const removedSet = new Set(removed.map(cellKey));
  const excluded = new Set(clusters.map((cluster) => cluster.atom.symbol));
  const fillers = SYMBOLS.filter((symbol) => !excluded.has(symbol));
  assert(fillers.length >= 2, 'custom template needs at least two filler symbols');
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const nextBoard = randomBoard(mixSeed(0xc0570f, key.length, attempt), fillers);
    if (floodComponents(nextBoard).length > 0) continue;
    const currentBoard = Array.from({ length: 7 }, () => Array(7));
    for (let column = 0; column < 7; column += 1) {
      const removedRows = new Set(removed.filter((cell) => cell.column === column).map((cell) => cell.row));
      const survivorSymbols = nextBoard[column].slice(removedRows.size);
      let survivorIndex = 0;
      for (let row = 0; row < 7; row += 1) {
        if (!removedRows.has(row)) {
          currentBoard[column][row] = survivorSymbols[survivorIndex];
          survivorIndex += 1;
        }
      }
    }
    for (const cluster of clusters) {
      for (const position of cluster.positions) currentBoard[position.column][position.row] = cluster.atom.symbol;
    }
    if (!boardHasExactlyClusters(currentBoard, clusters)) continue;
    const template = {
      boards: [currentBoard, nextBoard],
      transitions: [{ removed, entering: deriveTumble(currentBoard, nextBoard, removed) }],
    };
    CUSTOM_TEMPLATE_CACHE.set(key, template);
    return template;
  }
  throw new Error(`could not build physical custom template ${key}`);
}

function routePositions(minimumDistance, size) {
  const core = MECHANICS.underlay.core_cell;
  const portKeys = new Set(MECHANICS.underlay.exfil_ports.map(cellKey));
  const allowed = (cell) => !portKeys.has(cellKey(cell)) && Math.abs(cell.column - core.column) + Math.abs(cell.row - core.row) >= minimumDistance;
  const queue = [{ column: 3, row: 6 }];
  const seen = new Set();
  const positions = [];
  while (queue.length > 0 && positions.length < size) {
    const cell = queue.shift();
    const key = cellKey(cell);
    if (seen.has(key) || !allowed(cell)) continue;
    seen.add(key);
    positions.push(cell);
    const next = neighbours(cell).sort((left, right) => {
      const leftDistance = Math.abs(left.column - core.column) + Math.abs(left.row - core.row);
      const rightDistance = Math.abs(right.column - core.column) + Math.abs(right.row - core.row);
      return leftDistance - rightDistance || left.row - right.row || left.column - right.column;
    });
    queue.push(...next);
  }
  assert(positions.length === size, `route shape distance ${minimumDistance} cannot reach size ${size}`);
  const observedMinimum = Math.min(...positions.map((cell) => Math.abs(cell.column - core.column) + Math.abs(cell.row - core.row)));
  assert(observedMinimum === minimumDistance, `route shape minimum distance ${observedMinimum} != ${minimumDistance}`);
  return positions;
}

function linkedPositions(size) {
  const core = MECHANICS.underlay.core_cell;
  const portKeys = new Set(MECHANICS.underlay.exfil_ports.map(cellKey));
  const queue = [{ ...core }];
  const seen = new Set();
  const positions = [];
  while (queue.length > 0 && positions.length < size) {
    const cell = queue.shift();
    const key = cellKey(cell);
    if (seen.has(key) || portKeys.has(key)) continue;
    seen.add(key);
    positions.push(cell);
    queue.push(...neighbours(cell).sort((left, right) =>
      Math.abs(left.column - core.column) + Math.abs(left.row - core.row) -
      (Math.abs(right.column - core.column) + Math.abs(right.row - core.row)) ||
      left.row - right.row || left.column - right.column));
  }
  assert(positions.length === size, `linked shape cannot reach size ${size}`);
  return positions;
}

function createRoundState(mode, id) {
  const breached = new Set(mode.seed_breached_cells.map(cellKey));
  const live = computeLiveCells(breached);
  return {
    mode,
    id,
    events: [],
    breached,
    live,
    reachedPorts: new Set(MECHANICS.underlay.exfil_ports.filter((port) => live.has(cellKey(port))).map((port) => port.id)),
    currentAccess: mode.direct_feature ? featureAccessForPorts(new Set()) : accessForLiveCells(live),
    cumulativeRaw: 0,
    featureActive: mode.direct_feature,
    featureArmed: false,
    playedFeature: false,
    featureCycle: 0,
    totalFeatureCycles: MECHANICS.feature.initial_cycles,
    tumbleCounter: 0,
    capped: false,
    lastWin: null,
  };
}

function emit(state, event) {
  state.events.push({ index: state.events.length, ...event });
}

function emitRoundStart(state) {
  emit(state, {
    type: 'round_start',
    schema_version: 1,
    event_contract: 'blacksite-book-events-v1',
    mode: state.mode.name,
    cost_multiplier: state.mode.cost,
    payout_unit: 'centi-x_uint64',
    max_win_raw: MAX_WIN_RAW,
    board_columns: 7,
    board_rows: 7,
    initial_phase: state.mode.direct_feature ? 'feature' : 'base',
    seeded_breached_cells: state.mode.seed_breached_cells,
    seeded_live_cells: state.mode.seed_live_cells,
  });
}

function routeSnapshot(state) {
  const dormant = new Set([...state.breached].filter((key) => !state.live.has(key)));
  const sealed = new Set([...ALL_CELL_KEYS].filter((key) => !state.breached.has(key)));
  return {
    sealed_cells: sortedCells(sealed),
    dormant_cells: sortedCells(dormant),
    live_cells: sortedCells(state.live),
    reached_exfil_ports: [...state.reachedPorts].sort(),
    core_live: state.live.has(CORE_KEY),
  };
}

function emitBreachState(state, accessUsed, newlyBreached) {
  const route = routeSnapshot(state);
  emit(state, {
    type: 'breach_state',
    phase: state.featureActive ? 'feature' : 'base',
    newly_breached_cells: sortedCells(newlyBreached),
    breached_cells: sortedCells(state.breached),
    sealed_cells: route.sealed_cells,
    dormant_cells: route.dormant_cells,
    live_cells: route.live_cells,
    core_live: route.core_live,
    reached_exfil_ports: route.reached_exfil_ports,
    current_access_multiplier: state.currentAccess,
    feature_multiplier: state.featureActive ? state.currentAccess : 1,
    access_multiplier_used: accessUsed,
    cumulative_payout_raw: state.cumulativeRaw,
  });
}

function emitAccessChanged(state, previous, next, reason) {
  emit(state, {
    type: 'access_changed',
    previous_multiplier: previous,
    next_multiplier: next,
    effective_from_next_evaluation: true,
    reason,
  });
}

function emitInitialSeed(state) {
  if (state.mode.seed_breached_cells.length === 0) return;
  const initialAccess = state.currentAccess;
  emitBreachState(state, 1, new Set(state.mode.seed_breached_cells.map(cellKey)));
  emitAccessChanged(state, 1, initialAccess, 'mode_seed');
}

function emitBoard(state, board) {
  emit(state, {
    type: 'board_set',
    phase: state.featureActive ? 'feature' : 'base',
    feature_cycle: state.featureActive ? state.featureCycle : 0,
    tumble_index: state.tumbleCounter,
    board: cloneBoard(board),
  });
}

function emitTumble(state, transition) {
  state.tumbleCounter += 1;
  emit(state, {
    type: 'tumble',
    phase: state.featureActive ? 'feature' : 'base',
    tumble_index: state.tumbleCounter,
    removed_positions: transition.removed,
    entering_symbols: transition.entering,
  });
}

function accessChangeReason(state, nextAccess, newlyReachedPorts) {
  if (state.featureActive) {
    assert(newlyReachedPorts.length === 1, 'feature access changes require exactly one newly reached port');
    return `exfil_${newlyReachedPorts[0]}`;
  }
  return nextAccess === 5 ? 'core_live' : 'route_proximity';
}

function emitClusterStep(state, step) {
  const preAccess = state.currentAccess;
  const cumulativeBefore = state.cumulativeRaw;
  let remainingCap = MAX_WIN_RAW - cumulativeBefore;
  const clusters = [];
  for (const planned of step.clusters) {
    const linked = isLinkedToLive(planned.positions, state.live);
    const appliedMultiplier = linked ? preAccess : 1;
    const calculatedRaw = planned.atom.base_payout_raw * appliedMultiplier;
    const appliedRaw = Math.min(calculatedRaw, remainingCap);
    remainingCap -= appliedRaw;
    clusters.push({
      symbol: planned.atom.symbol,
      cluster_band: planned.atom.band_id,
      cluster_size: planned.positions.length,
      positions: sortedCells(planned.positions),
      linked,
      base_payout_raw: planned.atom.base_payout_raw,
      access_multiplier: appliedMultiplier,
      calculated_award_raw: calculatedRaw,
      applied_award_raw: appliedRaw,
    });
  }
  const stepPayoutRaw = clusters.reduce((sum, cluster) => sum + cluster.applied_award_raw, 0);
  const grossRaw = clusters.reduce((sum, cluster) => sum + cluster.calculated_award_raw, 0);
  assert(stepPayoutRaw > 0, `${state.mode.name}/${state.id}: zero award cluster step`);
  emit(state, {
    type: 'cluster_win',
    phase: state.featureActive ? 'feature' : 'base',
    feature_cycle: state.featureActive ? state.featureCycle : 0,
    clusters,
    step_payout_raw: stepPayoutRaw,
    cumulative_before_raw: cumulativeBefore,
    cumulative_after_raw: cumulativeBefore + stepPayoutRaw,
    cap_applied: stepPayoutRaw !== grossRaw,
  });
  state.cumulativeRaw += stepPayoutRaw;

  const previousCoreLive = state.live.has(CORE_KEY);
  const previousPorts = new Set(state.reachedPorts);
  const newlyBreached = new Set();
  for (const position of removedPositions(step)) {
    const key = cellKey(position);
    if (!state.breached.has(key)) newlyBreached.add(key);
    state.breached.add(key);
  }
  state.live = computeLiveCells(state.breached);
  state.reachedPorts = new Set(MECHANICS.underlay.exfil_ports.filter((port) => state.live.has(cellKey(port))).map((port) => port.id));
  const newlyReachedPorts = [...state.reachedPorts].filter((port) => !previousPorts.has(port)).sort();
  const nextAccess = state.featureActive ? featureAccessForPorts(state.reachedPorts) : accessForLiveCells(state.live);
  state.currentAccess = nextAccess;
  state.capped = state.cumulativeRaw === MAX_WIN_RAW;
  state.lastWin = {
    gross_award_raw: grossRaw,
    accepted_award_raw: stepPayoutRaw,
    discarded_award_raw: grossRaw - stepPayoutRaw,
  };
  emitBreachState(state, preAccess, newlyBreached);
  if (nextAccess !== preAccess) emitAccessChanged(state, preAccess, nextAccess, accessChangeReason(state, nextAccess, newlyReachedPorts));

  if (!state.featureActive && !previousCoreLive && state.live.has(CORE_KEY)) {
    state.featureArmed = true;
    emit(state, {
      type: 'feature_armed',
      reason: 'core_became_live',
      enter_after_current_cascade_chain: true,
      cumulative_payout_raw: state.cumulativeRaw,
    });
  }
  if (state.featureActive) {
    for (const portId of newlyReachedPorts) {
      state.totalFeatureCycles = Math.min(
        MECHANICS.feature.maximum_cycles,
        state.totalFeatureCycles + MECHANICS.feature.cycles_per_first_exfil_reach,
      );
      const port = MECHANICS.underlay.exfil_ports.find((candidate) => candidate.id === portId);
      emit(state, {
        type: 'exfil_reached',
        port_id: portId,
        position: { column: port.column, row: port.row },
        awarded_cycles: MECHANICS.feature.cycles_per_first_exfil_reach,
        total_cycles_after: state.totalFeatureCycles,
        remaining_cycles_after_current: state.totalFeatureCycles - state.featureCycle,
        next_access_multiplier: state.currentAccess,
      });
    }
  }
  return removedPositions(step);
}

function playTemplate(state, steps, template) {
  emitBoard(state, template.boards[0]);
  for (let index = 0; index < steps.length; index += 1) {
    emitClusterStep(state, steps[index]);
    if (state.capped) return;
    emitTumble(state, template.transitions[index]);
    emitBoard(state, template.boards[index + 1]);
  }
}

function playTopCascade(state, atoms, { appendMulti = false } = {}) {
  const ordered = [...atoms].sort((left, right) => right.cluster_size - left.cluster_size || right.base_payout_raw - left.base_payout_raw);
  const steps = ordered.map(ordinaryStep);
  if (appendMulti) {
    assert(steps.at(-1)?.clusters[0].atom.cluster_size >= 12, 'multi-cluster fixture requires a preceding 12+ top refill');
    steps.push(multiClusterStep());
  }
  if (steps.length === 0) {
    emitBoard(state, checkerboard(state.id % 2));
    return;
  }
  playTemplate(state, steps, buildTopCascade(steps, state.id % 2));
}

function playCustomSingle(state, atom, positions) {
  const steps = [{ clusters: [{ atom, positions: positions.map((cell) => ({ ...cell })) }], fixture_kind: 'custom_route' }];
  playTemplate(state, steps, customTemplate(steps[0].clusters));
}

function emitFeatureStart(state, direct) {
  state.featureActive = true;
  state.playedFeature = true;
  state.currentAccess = featureAccessForPorts(state.reachedPorts);
  emit(state, {
    type: 'feature_start',
    feature: 'blackout_protocol',
    direct,
    initial_cycles: MECHANICS.feature.initial_cycles,
    total_cycles: state.totalFeatureCycles,
    access_multiplier: state.currentAccess,
    core_live: state.live.has(CORE_KEY),
    initial_route: routeSnapshot(state),
  });
}

function startFeatureCycle(state) {
  state.featureCycle += 1;
  emit(state, {
    type: 'feature_cycle',
    cycle: state.featureCycle,
    total_cycles_awarded: state.totalFeatureCycles,
    remaining_cycles_after_current: state.totalFeatureCycles - state.featureCycle,
    access_multiplier: state.currentAccess,
    reached_exfil_ports: [...state.reachedPorts].sort(),
  });
}

function playPortCycle(state, portId) {
  startFeatureCycle(state);
  const atom = SAFE_ATOM_BY_PAYOUT.get(1);
  playCustomSingle(state, atom, EXFIL_PATHS[portId]);
  assert(state.reachedPorts.has(portId), `${state.mode.name}/${state.id}: ${portId} did not become live`);
}

function correctionPlan(remainder) {
  let best = null;
  for (let atFive = 0; atFive < 15; atFive += 1) {
    for (let atSeven = 0; atSeven < 15; atSeven += 1) {
      for (let atTen = 0; atTen < 15; atTen += 1) {
        const payout = atFive * 5 + atSeven * 7 + atTen * 10;
        if (payout > remainder || (remainder - payout) % 15 !== 0) continue;
        const baseUnits = atFive + atSeven + atTen;
        if (!best || payout < best.payout || payout === best.payout && baseUnits < best.baseUnits) {
          best = { atFive, atSeven, atTen, payout, baseUnits };
        }
      }
    }
  }
  return best;
}

function featurePayoutPlan(mode, payoutRaw, direct) {
  if (direct && payoutRaw === 0) return { armAtom: null, armAward: 0, remainder: 0, correction: { atFive: 0, atSeven: 0, atTen: 0, payout: 0, baseUnits: 0 } };
  const armAtoms = direct
    ? [null]
    : ALL_ATOMS.filter((atom) => CASCADE_SYMBOLS.includes(atom.symbol) && atom.cluster_size === 5 && atom.base_payout_raw >= 1 && atom.base_payout_raw <= 4);
  let best = null;
  for (const armAtom of armAtoms) {
    const armAward = direct ? 0 : armAtom.base_payout_raw * mode.starting_access_multiplier;
    const remainder = payoutRaw - armAward - 22;
    if (remainder < 0) continue;
    const correction = correctionPlan(remainder);
    if (!correction) continue;
    const candidate = { armAtom, armAward, remainder, correction };
    if (!best || correction.payout < best.correction.payout ||
      correction.payout === best.correction.payout && armAward < best.armAward) best = candidate;
  }
  return best;
}

function playLinkedCorrectionCycles(state, baseRaw) {
  for (const atom of decomposeBasePayout(baseRaw, { excludeFourteen: true })) {
    startFeatureCycle(state);
    playCustomSingle(state, atom, linkedPositions(atom.cluster_size));
  }
}

function playFeature(state, payoutRaw, direct) {
  const payoutPlan = featurePayoutPlan(state.mode, payoutRaw, direct);
  assert(payoutPlan, `${state.mode.name}/${state.id}: no exact feature payout plan for ${payoutRaw}`);
  const armAward = payoutPlan.armAward;
  const portAwards = payoutRaw === 0 ? 0 : 5 + 7 + 10;
  assert(payoutRaw === 0 || payoutRaw >= armAward + portAwards, `${state.mode.name}/${state.id}: feature payout too small`);
  let remainder = payoutRaw - armAward - portAwards;

  if (!direct) {
    const armPositions = state.mode.name === 'deep_access' ? DEEP_ARM_POSITIONS : BASE_ARM_POSITIONS;
    playCustomSingle(state, payoutPlan.armAtom, armPositions);
    assert(state.featureArmed && state.live.has(CORE_KEY), `${state.mode.name}/${state.id}: natural feature did not arm`);
  }
  emitFeatureStart(state, direct);

  if (payoutRaw > 0) {
    const correction = payoutPlan.correction;
    playLinkedCorrectionCycles(state, correction.atFive);
    playPortCycle(state, 'north');
    playLinkedCorrectionCycles(state, correction.atSeven);
    playPortCycle(state, 'west');
    playLinkedCorrectionCycles(state, correction.atTen);
    playPortCycle(state, 'east');
    remainder -= correction.payout;
    if (!state.capped && remainder > 0) {
      startFeatureCycle(state);
      if (payoutRaw === MAX_WIN_RAW) {
        const step = ordinaryStep(CAP_ATOM);
        playTemplate(state, [step], buildTopCascade([step], state.id % 2));
      } else {
        playTopCascade(state, decomposeBasePayout(remainder / 15));
      }
    }
  }

  while (!state.capped && state.featureCycle < state.totalFeatureCycles) {
    startFeatureCycle(state);
    emitBoard(state, checkerboard((state.id + state.featureCycle) % 2));
  }
  if (!state.capped) {
    emit(state, {
      type: 'feature_end',
      cycles_played: state.featureCycle,
      total_cycles: state.totalFeatureCycles,
      reached_exfil_ports: [...state.reachedPorts].sort(),
      cumulative_payout_raw: state.cumulativeRaw,
      capped: false,
    });
  }
  state.featureActive = false;
}

function playBaseAccessFixture(state, targetAccess, payoutRaw) {
  const symbol = targetAccess === 2 ? 'proxy' : 'cipher';
  const atom = ALL_ATOMS.find((candidate) => candidate.symbol === symbol && candidate.base_payout_raw === payoutRaw && candidate.cluster_size === 24);
  assert(atom, `access fixture payout ${payoutRaw} is not a paytable atom`);
  playCustomSingle(state, atom, routePositions(targetAccess === 2 ? 2 : 1, atom.cluster_size));
  assert(state.currentAccess === targetAccess, `access fixture reached ${state.currentAccess}, expected ${targetAccess}`);
}

function playNonFeature(state, payoutRaw) {
  if (payoutRaw === 0) {
    emitBoard(state, checkerboard(state.id % 2));
    return;
  }
  if (state.mode.name === 'base' && state.id === FIXTURE_RESERVED_IDS.base.access_2) {
    playBaseAccessFixture(state, 2, payoutRaw);
    return;
  }
  if (state.mode.name === 'base' && state.id === FIXTURE_RESERVED_IDS.base.access_3) {
    playBaseAccessFixture(state, 3, payoutRaw);
    return;
  }
  if (state.mode.name === 'base' && state.id === FIXTURE_RESERVED_IDS.base.cascade_5) {
    assert(payoutRaw === 207, `cascade fixture payout changed: ${payoutRaw}`);
    const atoms = [25, 25, 25, 25, 25, 25, 25, 14, 9].map((value) => SAFE_ATOM_BY_PAYOUT.get(value));
    atoms.push(ALL_ATOMS.find((atom) => CASCADE_SYMBOLS.includes(atom.symbol) && atom.base_payout_raw === 6 && atom.cluster_size >= 12));
    playTopCascade(state, atoms, { appendMulti: true });
    return;
  }
  if (state.mode.name === 'base' && state.id === FIXTURE_RESERVED_IDS.base.win_03) {
    const cipherAtom = ALL_ATOMS.find((atom) => atom.symbol === 'cipher' && atom.base_payout_raw === payoutRaw && atom.cluster_size === 24);
    playTopCascade(state, [cipherAtom]);
    return;
  }
  if (state.mode.name === 'base' && state.id === FIXTURE_RESERVED_IDS.base.win_04) {
    assert(payoutRaw === 207, `cascade_3 fixture payout changed: ${payoutRaw}`);
    const atoms = [100, 100, 7].map((value) => SAFE_ATOM_BY_PAYOUT.get(value));
    playTopCascade(state, atoms);
    return;
  }
  playTopCascade(state, decomposeBasePayout(payoutRaw));
}

export function buildBook(mode, id, payoutRaw) {
  assert(Number.isSafeInteger(id) && id >= 1 && id <= BOOKS_PER_MODE, `invalid book id ${id}`);
  assert(Number.isSafeInteger(payoutRaw) && payoutRaw >= 0 && payoutRaw <= MAX_WIN_RAW, `invalid payout ${payoutRaw}`);
  const state = createRoundState(mode, id);
  emitRoundStart(state);
  emitInitialSeed(state);
  const feature = shouldUseFeature(mode, id, payoutRaw);
  if (feature) playFeature(state, payoutRaw, mode.direct_feature);
  else playNonFeature(state, payoutRaw);

  if (state.capped) {
    emit(state, {
      type: 'cap_reached',
      cap_raw: MAX_WIN_RAW,
      gross_award_raw: state.lastWin.gross_award_raw,
      accepted_award_raw: state.lastWin.accepted_award_raw,
      discarded_award_raw: state.lastWin.discarded_award_raw,
      cumulative_payout_raw: state.cumulativeRaw,
    });
  }
  assert(
    state.cumulativeRaw === payoutRaw,
    `${mode.name}/${id}: events total ${state.cumulativeRaw} != payout ${payoutRaw}; awards=${state.events.filter((event) => event.type === 'cluster_win').map((event) => event.step_payout_raw).join(',')}`,
  );
  emit(state, {
    type: 'round_end',
    mode: mode.name,
    final_phase: state.playedFeature || mode.direct_feature ? 'feature' : 'base',
    payout_multiplier_raw: state.cumulativeRaw,
    capped: state.capped,
  });
  return { id, payoutMultiplier: payoutRaw, events: state.events };
}

export function paytableAtom(symbol, bandId) {
  const band = BAND_BY_ID.get(bandId);
  assert(band, `unknown band ${bandId}`);
  const payoutRaw = PAYTABLE.symbols[symbol]?.[band.index];
  assert(Number.isSafeInteger(payoutRaw), `unknown paytable atom ${symbol}/${bandId}`);
  return {
    symbol,
    band_id: bandId,
    minimum_size: band.minimum,
    maximum_size: band.maximum,
    representative_size: band.representative_size,
    base_payout_raw: payoutRaw,
  };
}

export function portIdForCell(cell) {
  return PORT_BY_KEY.get(cellKey(cell))?.id ?? null;
}

export function coreKey() {
  return CORE_KEY;
}

export function ingressKeys() {
  return new Set(INGRESS_KEYS);
}
