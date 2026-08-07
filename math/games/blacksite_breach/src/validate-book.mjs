import {
  EVENT_SCHEMA,
  EVENT_SCHEMA_SHA256 as CONFIG_EVENT_SCHEMA_SHA256,
  MAX_WIN_RAW,
  MECHANICS,
  PAYOUT_UNIT,
  SYMBOLS,
  assert,
  cellKey,
  compareCells,
  isUint,
  sortedCells,
} from './config.mjs';
import {
  accessForLiveCells,
  computeLiveCells,
  isLinkedToLive,
  paytableAtom,
} from './model.mjs';

export const BOOK_EVENT_CONTRACT = EVENT_SCHEMA.contract;
export const EVENT_SCHEMA_SHA256 = CONFIG_EVENT_SCHEMA_SHA256;

const EVENT_KEYS = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_SCHEMA.events).map(([type, fields]) => [type, fields.map((field) => field.name)]),
));
const RECORD_KEYS = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_SCHEMA.records).map(([type, fields]) => [type, fields.map((field) => field.name)]),
));
const PORT_BY_ID = new Map(MECHANICS.underlay.exfil_ports.map((port) => [port.id, port]));
const CORE_KEY = cellKey(MECHANICS.underlay.core_cell);
const ALL_KEYS = new Set(Array.from({ length: 49 }, (_, index) => `${index % 7},${Math.floor(index / 7)}`));

assert(EVENT_SCHEMA.schema_version === 1, 'event schema version mismatch');
assert(EVENT_SCHEMA.closed_records === true, 'event schema must close records');
assert(BOOK_EVENT_CONTRACT === 'blacksite-book-events-v1', 'event contract mismatch');

function exactKeys(value, expected, context) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${context}: expected object`);
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(canonical), `${context}: keys ${actual.join(',')} != ${canonical.join(',')}`);
}

function validateCells(cells, context, { allowEmpty = true } = {}) {
  assert(Array.isArray(cells), `${context}: expected cell array`);
  if (!allowEmpty) assert(cells.length > 0, `${context}: cells must not be empty`);
  const keys = new Set();
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    exactKeys(cell, RECORD_KEYS.position, `${context}[${index}]`);
    assert(isUint(cell.column) && cell.column < 7 && isUint(cell.row) && cell.row < 7, `${context}[${index}]: out-of-range position`);
    const key = cellKey(cell);
    assert(!keys.has(key), `${context}: duplicate ${key}`);
    keys.add(key);
  }
  return keys;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function assertCellsEqual(actual, expected, context) {
  const actualSet = validateCells(actual, context);
  const expectedSet = expected instanceof Set ? expected : new Set(expected.map(cellKey));
  assert(sameSet(actualSet, expectedSet), `${context}: cell set mismatch`);
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function routeSnapshot(breached, live) {
  const reachedPorts = new Set(MECHANICS.underlay.exfil_ports.filter((port) => live.has(cellKey(port))).map((port) => port.id));
  return {
    breached,
    live,
    dormant: new Set([...breached].filter((key) => !live.has(key))),
    sealed: new Set([...ALL_KEYS].filter((key) => !breached.has(key))),
    reachedPorts,
    coreLive: live.has(CORE_KEY),
  };
}

function validateRouteFields(event, route, context) {
  assertCellsEqual(event.breached_cells, route.breached, `${context}.breached_cells`);
  assertCellsEqual(event.sealed_cells, route.sealed, `${context}.sealed_cells`);
  assertCellsEqual(event.dormant_cells, route.dormant, `${context}.dormant_cells`);
  assertCellsEqual(event.live_cells, route.live, `${context}.live_cells`);
  assert(event.core_live === route.coreLive, `${context}: core_live mismatch`);
  assert(Array.isArray(event.reached_exfil_ports), `${context}: reached ports must be array`);
  assert(new Set(event.reached_exfil_ports).size === event.reached_exfil_ports.length, `${context}: duplicate reached port`);
  assert(event.reached_exfil_ports.every((port) => PORT_BY_ID.has(port)), `${context}: invalid reached port`);
  assert(sameSet(new Set(event.reached_exfil_ports), route.reachedPorts), `${context}: reached ports mismatch`);
}

function validateRouteObject(value, route, context) {
  exactKeys(value, RECORD_KEYS.route_snapshot, context);
  assertCellsEqual(value.sealed_cells, route.sealed, `${context}.sealed_cells`);
  assertCellsEqual(value.dormant_cells, route.dormant, `${context}.dormant_cells`);
  assertCellsEqual(value.live_cells, route.live, `${context}.live_cells`);
  assert(value.core_live === route.coreLive, `${context}: core mismatch`);
  assert(sameSet(new Set(value.reached_exfil_ports), route.reachedPorts), `${context}: reached ports mismatch`);
}

function validateBoard(board, context) {
  assert(Array.isArray(board) && board.length === 7, `${context}: board columns must equal 7`);
  for (let column = 0; column < 7; column += 1) {
    assert(Array.isArray(board[column]) && board[column].length === 7, `${context}: column ${column} rows must equal 7`);
    for (let row = 0; row < 7; row += 1) {
      assert(SYMBOLS.includes(board[column][row]), `${context}: unknown symbol at ${column},${row}`);
    }
  }
}

function orthogonal(cell) {
  return [
    { column: cell.column, row: cell.row - 1 },
    { column: cell.column - 1, row: cell.row },
    { column: cell.column + 1, row: cell.row },
    { column: cell.column, row: cell.row + 1 },
  ].filter((next) => next.column >= 0 && next.column < 7 && next.row >= 0 && next.row < 7);
}

function payingComponents(board) {
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
        for (const next of orthogonal(cell)) {
          const key = cellKey(next);
          if (!seen.has(key) && board[next.column][next.row] === symbol) {
            seen.add(key);
            queue.push(next);
          }
        }
      }
      if (positions.length >= MECHANICS.board.minimum_cluster_size) {
        components.push({ symbol, positions: sortedCells(positions), keys: new Set(positions.map(cellKey)) });
      }
    }
  }
  return components;
}

function featureAccess(reachedPorts) {
  return MECHANICS.access.feature_linked_multiplier_by_reached_port_count[reachedPorts.size];
}

function validatePhysicalTumble(previousBoard, nextBoard, removedKeys, enteringSymbols, context) {
  assert(Array.isArray(enteringSymbols), `${context}: entering_symbols must be array`);
  assert(enteringSymbols.length === removedKeys.size, `${context}: entering count must equal removed count`);
  const enteringByKey = new Map();
  for (let index = 0; index < enteringSymbols.length; index += 1) {
    const entering = enteringSymbols[index];
    exactKeys(entering, RECORD_KEYS.entering_symbol, `${context}.entering_symbols[${index}]`);
    assert(isUint(entering.column) && entering.column < 7 && isUint(entering.row) && entering.row < 7, `${context}: invalid entering position`);
    assert(SYMBOLS.includes(entering.symbol), `${context}: invalid entering symbol`);
    const key = `${entering.column},${entering.row}`;
    assert(!enteringByKey.has(key), `${context}: duplicate entering ${key}`);
    enteringByKey.set(key, entering.symbol);
  }

  for (let column = 0; column < 7; column += 1) {
    const survivors = [];
    let removedCount = 0;
    for (let row = 0; row < 7; row += 1) {
      if (removedKeys.has(`${column},${row}`)) removedCount += 1;
      else survivors.push(previousBoard[column][row]);
    }
    const expectedEnteringKeys = new Set(Array.from({ length: removedCount }, (_, row) => `${column},${row}`));
    const actualEnteringKeys = new Set([...enteringByKey.keys()].filter((key) => Number(key.split(',')[0]) === column));
    assert(sameSet(expectedEnteringKeys, actualEnteringKeys), `${context}: entrants must occupy top rows in column ${column}`);
    for (let row = 0; row < removedCount; row += 1) {
      assert(nextBoard[column][row] === enteringByKey.get(`${column},${row}`), `${context}: entrant symbol mismatch at ${column},${row}`);
    }
    assert(sameArray(nextBoard[column].slice(removedCount), survivors), `${context}: survivor gravity/order mismatch in column ${column}`);
  }
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function validateBook(book, mode, expectedId, expectedPayoutRaw) {
  exactKeys(book, ['id', 'payoutMultiplier', 'events'], `${mode.name}/${expectedId}`);
  assert(book.id === expectedId, `${mode.name}/${expectedId}: book ID mismatch`);
  assert(book.payoutMultiplier === expectedPayoutRaw && isUint(book.payoutMultiplier), `${mode.name}/${expectedId}: payout mismatch`);
  assert(Array.isArray(book.events) && book.events.length >= 3, `${mode.name}/${expectedId}: events missing`);

  let requiredType = 'round_start';
  let afterAccessType = null;
  let phaseFeature = mode.direct_feature;
  let featureStarted = false;
  let playedFeature = false;
  let featureArmed = false;
  let featureCycle = 0;
  let totalFeatureCycles = MECHANICS.feature.initial_cycles;
  let cumulativeRaw = 0;
  let capped = false;
  let tumbleIndex = 0;
  let breached = new Set();
  let live = new Set();
  let reachedPorts = new Set();
  let currentAccess = 1;
  let boardState = null;
  let pendingTumble = null;
  let pendingWin = null;
  let pendingSeed = mode.seed_breached_cells.length > 0;
  let notificationQueue = [];
  let lastWin = null;
  let currentCascadeWins = 0;
  let maxCascadeWins = 0;
  let maxClustersInStep = 0;
  let maxTotalCycles = totalFeatureCycles;
  let sawNaturalFeature = false;
  let sawDirectFeature = false;
  let sawCoreLive = false;
  const accessValues = new Set([1]);
  const portCounts = new Set([0]);
  const clusterSignatures = new Set();
  const eventCounts = {};

  const setRequiredFromQueue = () => {
    requiredType = notificationQueue.length > 0 ? notificationQueue[0].type : null;
  };
  const consumeQueue = (type) => {
    assert(notificationQueue[0]?.type === type, `${mode.name}/${expectedId}: unexpected ${type} notification`);
    notificationQueue.shift();
    setRequiredFromQueue();
  };

  for (let eventIndex = 0; eventIndex < book.events.length; eventIndex += 1) {
    const event = book.events[eventIndex];
    const context = `${mode.name}/${expectedId}/event/${eventIndex}/${event?.type ?? 'missing'}`;
    assert(event && Object.hasOwn(EVENT_KEYS, event.type), `${context}: unknown event type`);
    exactKeys(event, EVENT_KEYS[event.type], context);
    assert(event.index === eventIndex && isUint(event.index), `${context}: noncontiguous event index`);
    assert(requiredType === event.type, `${context}: expected ${requiredType ?? 'no event'}`);
    requiredType = null;
    increment(eventCounts, event.type);

    if (event.type === 'round_start') {
      assert(eventIndex === 0, `${context}: round_start must be first`);
      assert(event.schema_version === EVENT_SCHEMA.schema_version && event.event_contract === BOOK_EVENT_CONTRACT, `${context}: schema contract mismatch`);
      assert(event.mode === mode.name && event.cost_multiplier === mode.cost, `${context}: mode/cost mismatch`);
      assert(event.payout_unit === PAYOUT_UNIT && event.max_win_raw === MAX_WIN_RAW, `${context}: payout unit/cap mismatch`);
      assert(event.board_columns === 7 && event.board_rows === 7, `${context}: board dimensions mismatch`);
      assert(event.initial_phase === (mode.direct_feature ? 'feature' : 'base'), `${context}: initial phase mismatch`);
      assertCellsEqual(event.seeded_breached_cells, new Set(mode.seed_breached_cells.map(cellKey)), `${context}.seeded_breached_cells`);
      assertCellsEqual(event.seeded_live_cells, new Set(mode.seed_live_cells.map(cellKey)), `${context}.seeded_live_cells`);
      requiredType = pendingSeed ? 'breach_state' : 'board_set';
      continue;
    }

    if (event.type === 'board_set') {
      validateBoard(event.board, `${context}.board`);
      assert(event.phase === (phaseFeature ? 'feature' : 'base'), `${context}: phase mismatch`);
      assert(event.feature_cycle === (phaseFeature ? featureCycle : 0), `${context}: feature cycle mismatch`);
      assert(event.tumble_index === tumbleIndex, `${context}: tumble index mismatch`);
      if (pendingTumble) {
        validatePhysicalTumble(pendingTumble.board, event.board, pendingTumble.removed, pendingTumble.entering, context);
        pendingTumble = null;
      }
      const components = payingComponents(event.board);
      boardState = { board: event.board, components, consumed: false };
      if (components.length > 0) {
        requiredType = 'cluster_win';
      } else {
        maxCascadeWins = Math.max(maxCascadeWins, currentCascadeWins);
        currentCascadeWins = 0;
        if (phaseFeature) requiredType = featureCycle < totalFeatureCycles ? 'feature_cycle' : 'feature_end';
        else requiredType = featureArmed ? 'feature_start' : 'round_end';
      }
      continue;
    }

    if (event.type === 'cluster_win') {
      assert(boardState && !boardState.consumed && boardState.components.length > 0, `${context}: cluster_win needs an unresolved paying board`);
      assert(event.phase === (phaseFeature ? 'feature' : 'base') && event.feature_cycle === (phaseFeature ? featureCycle : 0), `${context}: phase/cycle mismatch`);
      assert(Array.isArray(event.clusters) && event.clusters.length === boardState.components.length && event.clusters.length > 0, `${context}: cluster count mismatch`);
      maxClustersInStep = Math.max(maxClustersInStep, event.clusters.length);
      const usedPositions = new Set();
      const preAccess = currentAccess;
      const cumulativeBefore = cumulativeRaw;
      let capRemaining = MAX_WIN_RAW - cumulativeRaw;
      let calculatedStep = 0;
      let appliedStep = 0;
      const removed = new Set();
      for (let clusterIndex = 0; clusterIndex < event.clusters.length; clusterIndex += 1) {
        const cluster = event.clusters[clusterIndex];
        exactKeys(cluster, RECORD_KEYS.cluster, `${context}.clusters[${clusterIndex}]`);
        const positions = validateCells(cluster.positions, `${context}.clusters[${clusterIndex}].positions`, { allowEmpty: false });
        assert(cluster.cluster_size === positions.size && cluster.cluster_size >= 5 && cluster.cluster_size <= 49, `${context}: cluster size mismatch`);
        for (const position of positions) {
          assert(!usedPositions.has(position), `${context}: simultaneous clusters overlap at ${position}`);
          usedPositions.add(position);
          removed.add(position);
        }
        const component = boardState.components.find((candidate) => candidate.symbol === cluster.symbol && sameSet(candidate.keys, positions));
        assert(component, `${context}: cluster is not an exact board flood-fill component`);
        const atom = paytableAtom(cluster.symbol, cluster.cluster_band);
        assert(cluster.cluster_size >= atom.minimum_size && cluster.cluster_size <= atom.maximum_size, `${context}: cluster outside paytable band`);
        assert(cluster.base_payout_raw === atom.base_payout_raw, `${context}: base payout mismatch`);
        const linked = isLinkedToLive(cluster.positions, live);
        assert(cluster.linked === linked, `${context}: linked flag mismatch`);
        const expectedMultiplier = linked ? preAccess : 1;
        assert(cluster.access_multiplier === expectedMultiplier, `${context}: applied access mismatch`);
        const calculated = cluster.base_payout_raw * expectedMultiplier;
        const applied = Math.min(calculated, capRemaining);
        capRemaining -= applied;
        assert(cluster.calculated_award_raw === calculated, `${context}: calculated award mismatch`);
        assert(cluster.applied_award_raw === applied, `${context}: applied award mismatch`);
        calculatedStep += calculated;
        appliedStep += applied;
        clusterSignatures.add(`${cluster.symbol}/${cluster.cluster_band}/${cluster.access_multiplier}/${cluster.linked}`);
      }
      assert(event.step_payout_raw === appliedStep && appliedStep > 0, `${context}: step payout mismatch`);
      assert(event.cumulative_before_raw === cumulativeBefore && event.cumulative_after_raw === cumulativeBefore + appliedStep, `${context}: cumulative mismatch`);
      assert(event.cap_applied === (appliedStep !== calculatedStep), `${context}: cap flag mismatch`);
      cumulativeRaw += appliedStep;
      capped = cumulativeRaw === MAX_WIN_RAW;
      boardState.consumed = true;
      currentCascadeWins += 1;

      const previousCoreLive = live.has(CORE_KEY);
      const previousPorts = new Set(reachedPorts);
      const newlyBreached = new Set([...removed].filter((key) => !breached.has(key)));
      breached = new Set([...breached, ...removed]);
      live = computeLiveCells(breached);
      const route = routeSnapshot(breached, live);
      reachedPorts = route.reachedPorts;
      const newlyReachedPorts = [...reachedPorts].filter((port) => !previousPorts.has(port)).sort();
      const nextAccess = phaseFeature ? featureAccess(reachedPorts) : accessForLiveCells(live);
      const coreArmed = !phaseFeature && !previousCoreLive && route.coreLive;
      pendingWin = {
        preAccess,
        nextAccess,
        newlyBreached,
        route,
        newlyReachedPorts,
        coreArmed,
        capped,
      };
      lastWin = {
        gross: calculatedStep,
        accepted: appliedStep,
        discarded: calculatedStep - appliedStep,
        removed,
      };
      requiredType = 'breach_state';
      continue;
    }

    if (event.type === 'breach_state') {
      if (pendingSeed) {
        breached = new Set(mode.seed_breached_cells.map(cellKey));
        live = computeLiveCells(breached);
        const route = routeSnapshot(breached, live);
        reachedPorts = route.reachedPorts;
        const nextAccess = phaseFeature ? featureAccess(reachedPorts) : accessForLiveCells(live);
        assertCellsEqual(event.newly_breached_cells, breached, `${context}.newly_breached_cells`);
        validateRouteFields(event, route, context);
        assert(event.phase === (phaseFeature ? 'feature' : 'base'), `${context}: seeded phase mismatch`);
        assert(event.current_access_multiplier === nextAccess, `${context}: seeded current access mismatch`);
        assert(event.feature_multiplier === (phaseFeature ? nextAccess : 1), `${context}: seeded feature access mismatch`);
        assert(event.access_multiplier_used === 1 && event.cumulative_payout_raw === 0, `${context}: seeded snapshot payout/access mismatch`);
        currentAccess = nextAccess;
        accessValues.add(nextAccess);
        pendingSeed = false;
        notificationQueue = [{ type: 'access_changed', previous: 1, next: nextAccess, reason: 'mode_seed' }];
        afterAccessType = mode.direct_feature ? 'feature_start' : 'board_set';
        setRequiredFromQueue();
        continue;
      }

      assert(pendingWin, `${context}: breach_state must follow a cluster win or mode seed`);
      assertCellsEqual(event.newly_breached_cells, pendingWin.newlyBreached, `${context}.newly_breached_cells`);
      validateRouteFields(event, pendingWin.route, context);
      assert(event.phase === (phaseFeature ? 'feature' : 'base'), `${context}: phase mismatch`);
      assert(event.current_access_multiplier === pendingWin.nextAccess, `${context}: post-breach current access mismatch`);
      assert(event.feature_multiplier === (phaseFeature ? pendingWin.nextAccess : 1), `${context}: feature multiplier mismatch`);
      assert(event.access_multiplier_used === pendingWin.preAccess, `${context}: pre-evaluation ambient access mismatch`);
      assert(event.cumulative_payout_raw === cumulativeRaw, `${context}: cumulative mismatch`);
      currentAccess = pendingWin.nextAccess;
      accessValues.add(currentAccess);
      sawCoreLive ||= pendingWin.route.coreLive;
      portCounts.add(pendingWin.route.reachedPorts.size);

      notificationQueue = [];
      if (pendingWin.nextAccess !== pendingWin.preAccess) {
        let reason;
        if (phaseFeature) {
          assert(pendingWin.newlyReachedPorts.length === 1, `${context}: feature access change must correspond to one port`);
          reason = `exfil_${pendingWin.newlyReachedPorts[0]}`;
        } else reason = pendingWin.nextAccess === 5 ? 'core_live' : 'route_proximity';
        notificationQueue.push({ type: 'access_changed', previous: pendingWin.preAccess, next: pendingWin.nextAccess, reason });
      }
      if (pendingWin.coreArmed) notificationQueue.push({ type: 'feature_armed' });
      if (phaseFeature) {
        for (const port of pendingWin.newlyReachedPorts) notificationQueue.push({ type: 'exfil_reached', port });
      }
      notificationQueue.push({ type: pendingWin.capped ? 'cap_reached' : 'tumble' });
      setRequiredFromQueue();
      continue;
    }

    if (event.type === 'access_changed') {
      const expected = notificationQueue[0];
      assert(expected?.type === 'access_changed', `${context}: access notification not expected`);
      assert(event.previous_multiplier === expected.previous && event.next_multiplier === expected.next, `${context}: access transition mismatch`);
      assert(event.effective_from_next_evaluation === true && event.reason === expected.reason, `${context}: access reason/timing mismatch`);
      consumeQueue('access_changed');
      if (notificationQueue.length === 0 && afterAccessType) {
        requiredType = afterAccessType;
        afterAccessType = null;
      }
      continue;
    }

    if (event.type === 'feature_armed') {
      assert(pendingWin?.coreArmed && !phaseFeature, `${context}: feature arm not justified`);
      assert(event.reason === 'core_became_live' && event.enter_after_current_cascade_chain === true, `${context}: arm contract mismatch`);
      assert(event.cumulative_payout_raw === cumulativeRaw, `${context}: arm cumulative mismatch`);
      featureArmed = true;
      consumeQueue('feature_armed');
      continue;
    }

    if (event.type === 'exfil_reached') {
      const expected = notificationQueue[0];
      assert(expected?.type === 'exfil_reached' && expected.port === event.port_id, `${context}: exfil order mismatch`);
      const port = PORT_BY_ID.get(event.port_id);
      assert(port && sameArray(event.position, { column: port.column, row: port.row }), `${context}: exfil position mismatch`);
      assert(event.awarded_cycles === MECHANICS.feature.cycles_per_first_exfil_reach, `${context}: exfil award mismatch`);
      totalFeatureCycles = Math.min(MECHANICS.feature.maximum_cycles, totalFeatureCycles + event.awarded_cycles);
      maxTotalCycles = Math.max(maxTotalCycles, totalFeatureCycles);
      assert(event.total_cycles_after === totalFeatureCycles, `${context}: total cycles mismatch`);
      assert(event.remaining_cycles_after_current === totalFeatureCycles - featureCycle, `${context}: remaining cycles mismatch`);
      assert(event.next_access_multiplier === currentAccess, `${context}: exfil next access mismatch`);
      consumeQueue('exfil_reached');
      continue;
    }

    if (event.type === 'tumble') {
      assert(boardState?.consumed && pendingWin && !pendingWin.capped && lastWin, `${context}: tumble needs an under-cap win`);
      assert(event.phase === (phaseFeature ? 'feature' : 'base'), `${context}: tumble phase mismatch`);
      tumbleIndex += 1;
      assert(event.tumble_index === tumbleIndex, `${context}: tumble index mismatch`);
      const removed = validateCells(event.removed_positions, `${context}.removed_positions`, { allowEmpty: false });
      assert(sameSet(removed, lastWin.removed), `${context}: removed positions must equal all simultaneous wins`);
      pendingTumble = { board: boardState.board, removed, entering: event.entering_symbols };
      pendingWin = null;
      consumeQueue('tumble');
      requiredType = 'board_set';
      continue;
    }

    if (event.type === 'feature_start') {
      assert(!featureStarted && live.has(CORE_KEY), `${context}: feature start requires live Core and single entry`);
      assert(event.feature === 'blackout_protocol' && event.direct === mode.direct_feature, `${context}: feature identity/direct mismatch`);
      assert(event.initial_cycles === MECHANICS.feature.initial_cycles && event.total_cycles === totalFeatureCycles, `${context}: initial cycle mismatch`);
      const route = routeSnapshot(breached, live);
      validateRouteObject(event.initial_route, route, `${context}.initial_route`);
      const expectedAccess = featureAccess(route.reachedPorts);
      assert(event.access_multiplier === expectedAccess && event.core_live === true, `${context}: feature access/Core mismatch`);
      phaseFeature = true;
      featureStarted = true;
      playedFeature = true;
      sawDirectFeature ||= event.direct;
      sawNaturalFeature ||= !event.direct;
      featureArmed = false;
      currentAccess = expectedAccess;
      requiredType = 'feature_cycle';
      continue;
    }

    if (event.type === 'feature_cycle') {
      assert(phaseFeature && featureStarted && featureCycle < totalFeatureCycles, `${context}: invalid feature cycle state`);
      featureCycle += 1;
      assert(event.cycle === featureCycle, `${context}: noncontiguous feature cycle`);
      assert(event.total_cycles_awarded === totalFeatureCycles, `${context}: awarded cycle total mismatch`);
      assert(event.remaining_cycles_after_current === totalFeatureCycles - featureCycle, `${context}: remaining cycles mismatch`);
      assert(event.access_multiplier === currentAccess, `${context}: cycle access mismatch`);
      assert(sameSet(new Set(event.reached_exfil_ports), reachedPorts), `${context}: cycle reached ports mismatch`);
      requiredType = 'board_set';
      continue;
    }

    if (event.type === 'feature_end') {
      assert(phaseFeature && !capped && featureCycle === totalFeatureCycles, `${context}: feature_end before normal cycle exhaustion`);
      assert(event.cycles_played === featureCycle && event.total_cycles === totalFeatureCycles, `${context}: feature_end cycle mismatch`);
      assert(sameSet(new Set(event.reached_exfil_ports), reachedPorts), `${context}: feature_end ports mismatch`);
      assert(event.cumulative_payout_raw === cumulativeRaw && event.capped === false, `${context}: feature_end payout/cap mismatch`);
      phaseFeature = false;
      requiredType = 'round_end';
      continue;
    }

    if (event.type === 'cap_reached') {
      assert(pendingWin?.capped && capped && lastWin, `${context}: cap event not justified`);
      assert(event.cap_raw === MAX_WIN_RAW && event.cumulative_payout_raw === MAX_WIN_RAW, `${context}: cap total mismatch`);
      assert(event.gross_award_raw === lastWin.gross && event.accepted_award_raw === lastWin.accepted && event.discarded_award_raw === lastWin.discarded, `${context}: cap award reconciliation mismatch`);
      assert(event.accepted_award_raw + event.discarded_award_raw === event.gross_award_raw, `${context}: cap arithmetic mismatch`);
      pendingWin = null;
      consumeQueue('cap_reached');
      requiredType = 'round_end';
      continue;
    }

    if (event.type === 'round_end') {
      assert(eventIndex === book.events.length - 1, `${context}: round_end must be final`);
      assert(event.mode === mode.name, `${context}: end mode mismatch`);
      assert(event.final_phase === (playedFeature || mode.direct_feature ? 'feature' : 'base'), `${context}: final phase mismatch`);
      assert(event.payout_multiplier_raw === expectedPayoutRaw && event.payout_multiplier_raw === cumulativeRaw, `${context}: final payout mismatch`);
      assert(event.capped === capped, `${context}: final cap mismatch`);
      requiredType = null;
      continue;
    }
  }

  maxCascadeWins = Math.max(maxCascadeWins, currentCascadeWins);
  assert(requiredType === null, `${mode.name}/${expectedId}: truncated stream, expected ${requiredType}`);
  assert((eventCounts.round_start ?? 0) === 1 && (eventCounts.round_end ?? 0) === 1, `${mode.name}/${expectedId}: start/end uniqueness mismatch`);
  assert((eventCounts.feature_start ?? 0) <= 1 && (eventCounts.cap_reached ?? 0) <= 1, `${mode.name}/${expectedId}: feature/cap uniqueness mismatch`);
  assert(!pendingTumble && !pendingSeed && notificationQueue.length === 0, `${mode.name}/${expectedId}: unresolved validator state`);
  assert(cumulativeRaw === expectedPayoutRaw, `${mode.name}/${expectedId}: cumulative payout mismatch`);

  return {
    eventCount: book.events.length,
    eventCounts,
    tumbles: eventCounts.tumble ?? 0,
    maxCascadeWins,
    maxClustersInStep,
    accessValues: [...accessValues].sort((left, right) => left - right),
    portCounts: [...portCounts].sort((left, right) => left - right),
    sawCoreLive,
    sawNaturalFeature,
    sawDirectFeature,
    maxTotalCycles,
    clusterSignatures: [...clusterSignatures].sort(),
  };
}
