import { execFileSync } from 'node:child_process';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import {
  BOOK_ROOT,
  BOOKS_PER_MODE,
  CONFIG_ROOT,
  GAME_ROOT,
  GAME_CONFIG,
  LIBRARY_CONFIG_ROOT,
  LOOKUP_ROOT,
  MAX_WIN_RAW,
  MODE_NAMES,
  MODE_REGISTRY,
  PUBLISH_ROOT,
  TARGET_RTP,
  VERIFICATION_PROFILE,
  assert,
  sha256Bytes,
  sha256File,
} from './src/config.mjs';
import { operatorTemplateProbe, shortWindowRisk, summarizeDistribution } from './src/analytics.mjs';
import { FIXTURE_RESERVED_IDS, TAIL_ANCHORS } from './src/model.mjs';
import { BOOK_EVENT_CONTRACT, EVENT_SCHEMA_SHA256, validateBook } from './src/validate-book.mjs';

const UINT64_MAX = (1n << 64n) - 1n;

function readUint64(text, context) {
  assert(/^(0|[1-9][0-9]*)$/.test(text), `${context}: not canonical uint64 text`);
  const value = BigInt(text);
  assert(value <= UINT64_MAX, `${context}: exceeds uint64`);
  assert(value <= BigInt(Number.MAX_SAFE_INTEGER), `${context}: exceeds JavaScript safe integer`);
  return Number(value);
}

function readLookup(mode) {
  const path = join(LOOKUP_ROOT, `${mode.name}_lookup.csv`);
  const text = readFileSync(path, 'utf8');
  assert(text.endsWith('\n'), `${mode.name}: lookup must end with newline`);
  const lines = text.trimEnd().split(/\r?\n/);
  assert(lines.length === BOOKS_PER_MODE, `${mode.name}: lookup rows ${lines.length} != ${BOOKS_PER_MODE}`);
  const payouts = new Uint32Array(BOOKS_PER_MODE + 1);
  const weights = new Uint32Array(BOOKS_PER_MODE + 1);
  for (let index = 0; index < lines.length; index += 1) {
    const columns = lines[index].split(',');
    assert(columns.length === 3, `${mode.name}: lookup row ${index + 1} must have three headerless columns`);
    const id = readUint64(columns[0], `${mode.name} lookup id`);
    const weight = readUint64(columns[1], `${mode.name}/${id} lookup weight`);
    const payout = readUint64(columns[2], `${mode.name}/${id} lookup payout`);
    assert(id === index + 1, `${mode.name}: IDs must be contiguous 1..${BOOKS_PER_MODE}`);
    assert(weight > 0, `${mode.name}/${id}: weight must be positive`);
    assert(weight === 1, `${mode.name}/${id}: M1 equal-weight contract requires weight 1`);
    assert(payout <= MAX_WIN_RAW, `${mode.name}/${id}: lookup payout exceeds cap`);
    payouts[id] = payout;
    weights[id] = weight;
  }
  return { path, payouts, weights };
}

function anchorFixtureIds(mode) {
  const anchors = TAIL_ANCHORS[mode.name];
  const veryBig = mode.zero_books + 1;
  const big = veryBig + anchors[0].count;
  const medium = big + anchors[1].count;
  return { veryBig, big, medium };
}

function findSmallPositiveId(payouts, excluded) {
  let bestId = null;
  let bestPayout = Infinity;
  for (let id = 1; id < payouts.length; id += 1) {
    if (payouts[id] > 0 && payouts[id] < bestPayout && !excluded.has(id)) {
      bestId = id;
      bestPayout = payouts[id];
    }
  }
  return bestId;
}

function fixtureIdsForMode(mode, payouts) {
  const anchors = anchorFixtureIds(mode);
  const initiallyExcluded = new Set([1, BOOKS_PER_MODE, anchors.veryBig, anchors.big, anchors.medium]);
  const small = findSmallPositiveId(payouts, initiallyExcluded);
  let ruleWins;
  if (mode.name === 'base') {
    ruleWins = [
      FIXTURE_RESERVED_IDS.base.win_01,
      FIXTURE_RESERVED_IDS.base.win_02,
      FIXTURE_RESERVED_IDS.base.win_03,
      FIXTURE_RESERVED_IDS.base.win_04,
      FIXTURE_RESERVED_IDS.base.win_05,
    ];
  } else {
    const baselineStart = mode.zero_books + TAIL_ANCHORS[mode.name].reduce((sum, anchor) => sum + anchor.count, 0) + 1;
    ruleWins = [anchors.veryBig, anchors.big, anchors.medium, baselineStart, BOOKS_PER_MODE];
  }
  const ids = {
    zero: 1,
    small,
    medium: anchors.medium,
    big: anchors.big,
    veryBig: anchors.veryBig,
    max: BOOKS_PER_MODE,
    ruleWin1: ruleWins[0],
    ruleWin2: ruleWins[1],
    ruleWin3: ruleWins[2],
    ruleWin4: ruleWins[3],
    ruleWin5: ruleWins[4],
    feature: anchors.veryBig,
  };
  if (mode.name === 'base') {
    Object.assign(ids, {
      cascade3: FIXTURE_RESERVED_IDS.base.cascade_3,
      cascade5: FIXTURE_RESERVED_IDS.base.cascade_5,
      simultaneous: FIXTURE_RESERVED_IDS.base.cascade_5,
      routeTease: FIXTURE_RESERVED_IDS.base.access_2,
      access2: FIXTURE_RESERVED_IDS.base.access_2,
      access3: FIXTURE_RESERVED_IDS.base.access_3,
      coreLive: FIXTURE_RESERVED_IDS.base.natural_blackout,
      naturalFeature: FIXTURE_RESERVED_IDS.base.natural_blackout,
    });
  }
  assert(Object.values(ids).every((id) => Number.isInteger(id) && id >= 1 && id <= BOOKS_PER_MODE), `${mode.name}: invalid fixture ID`);
  return ids;
}

function mechanicSignature(result) {
  return JSON.stringify({
    cascade: result.maxCascadeWins,
    clusters: result.maxClustersInStep,
    access: result.accessValues,
    ports: result.portCounts,
    natural: result.sawNaturalFeature,
    direct: result.sawDirectFeature,
    signatures: result.clusterSignatures,
  });
}

function fixtureCase(mode, fixtureId, book, validation, acceptance) {
  const clusterChecks = [];
  for (const event of book.events) {
    if (event.type !== 'cluster_win') continue;
    for (const cluster of event.clusters) {
      clusterChecks.push({
        event_index: event.index,
        phase: event.phase,
        feature_cycle: event.feature_cycle,
        symbol: cluster.symbol,
        cluster_band: cluster.cluster_band,
        cluster_size: cluster.cluster_size,
        positions: cluster.positions,
        linked: cluster.linked,
        base_payout_raw: cluster.base_payout_raw,
        access_multiplier: cluster.access_multiplier,
        calculated_award_raw: cluster.calculated_award_raw,
        applied_award_raw: cluster.applied_award_raw,
        cumulative_after_raw: event.cumulative_after_raw,
      });
    }
  }
  return {
    fixture_id: fixtureId,
    acceptance,
    book_id: book.id,
    lookup_weight: 1,
    event_contract: BOOK_EVENT_CONTRACT,
    event_schema_sha256: EVENT_SCHEMA_SHA256,
    mode: mode.name,
    cost_multiplier: mode.cost,
    payout_raw: book.payoutMultiplier,
    payout_human_x: book.payoutMultiplier / 100,
    cost_normalized_return: book.payoutMultiplier / (100 * mode.cost),
    event_types: book.events.map((event) => event.type),
    validator_facts: {
      max_cascade_wins: validation.maxCascadeWins,
      max_clusters_in_step: validation.maxClustersInStep,
      access_values: validation.accessValues,
      reached_port_counts: validation.portCounts,
      core_live: validation.sawCoreLive,
      natural_feature: validation.sawNaturalFeature,
      direct_feature: validation.sawDirectFeature,
      maximum_total_cycles: validation.maxTotalCycles,
      cluster_signatures: validation.clusterSignatures,
    },
    cluster_formula_checks: clusterChecks,
    final_event: book.events.at(-1),
  };
}

async function verifyBooks(mode, payouts, fixtureIds) {
  const path = join(BOOK_ROOT, `${mode.name}_books.jsonl.zst`);
  const decompressor = createZstdDecompress();
  const input = createReadStream(path).pipe(decompressor);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let id = 0;
  let eventCount = 0;
  const aggregateEventCounts = {};
  const selectedBooks = new Map();
  const selectedResults = new Map();
  const fixedIds = new Set(Object.values(fixtureIds));
  const coverage = {
    accessValues: new Set(),
    portCounts: new Set(),
    maxCascadeWins: 0,
    maxClustersInStep: 0,
    maxTotalCycles: 0,
    sawCoreLive: false,
    sawNaturalFeature: false,
    sawDirectFeature: false,
  };
  for await (const line of lines) {
    assert(line.length > 0, `${mode.name}: empty JSONL line`);
    id += 1;
    assert(id <= BOOKS_PER_MODE, `${mode.name}: too many books`);
    const book = JSON.parse(line);
    const result = validateBook(book, mode, id, payouts[id]);
    eventCount += result.eventCount;
    for (const [eventType, count] of Object.entries(result.eventCounts)) {
      aggregateEventCounts[eventType] = (aggregateEventCounts[eventType] ?? 0) + count;
    }
    for (const access of result.accessValues) coverage.accessValues.add(access);
    for (const count of result.portCounts) coverage.portCounts.add(count);
    coverage.maxCascadeWins = Math.max(coverage.maxCascadeWins, result.maxCascadeWins);
    coverage.maxClustersInStep = Math.max(coverage.maxClustersInStep, result.maxClustersInStep);
    coverage.maxTotalCycles = Math.max(coverage.maxTotalCycles, result.maxTotalCycles);
    coverage.sawCoreLive ||= result.sawCoreLive;
    coverage.sawNaturalFeature ||= result.sawNaturalFeature;
    coverage.sawDirectFeature ||= result.sawDirectFeature;
    if (fixedIds.has(id)) {
      selectedBooks.set(id, book);
      selectedResults.set(id, result);
    }
    if (id % 10000 === 0) process.stdout.write(`[verify] ${mode.name}: ${id}/${BOOKS_PER_MODE} books\n`);
  }
  assert(id === BOOKS_PER_MODE, `${mode.name}: decompressed books ${id} != ${BOOKS_PER_MODE}`);
  assert(selectedBooks.size === fixedIds.size, `${mode.name}: not every fixed fixture book was found`);
  return { path, eventCount, aggregateEventCounts, selectedBooks, selectedResults, coverage };
}

function verifyIndex() {
  const path = join(PUBLISH_ROOT, 'index.json');
  const index = JSON.parse(readFileSync(path, 'utf8'));
  assert(index && Object.keys(index).length === 1 && Array.isArray(index.modes), 'index.json must contain only modes array');
  assert(index.modes.length === MODE_REGISTRY.modes.length, 'index mode count mismatch');
  for (let position = 0; position < MODE_REGISTRY.modes.length; position += 1) {
    const expected = MODE_REGISTRY.modes[position];
    const actual = index.modes[position];
    assert(JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(['cost', 'events', 'name', 'weights']), `${expected.name}: index keys mismatch`);
    assert(actual.name === expected.name && actual.cost === expected.cost, `${expected.name}: index mode/cost mismatch`);
    assert(actual.events === `${expected.name}_books.jsonl.zst`, `${expected.name}: index events path mismatch`);
    assert(actual.weights === `${expected.name}_lookup.csv`, `${expected.name}: index weights path mismatch`);
  }
  assert(JSON.stringify(index.modes.map((mode) => mode.name)) === JSON.stringify(MODE_NAMES), 'index canonical mode set/order mismatch');
  return { path, index };
}

function verifyConfigCopies() {
  const names = ['game_config.json', 'mode_registry.json', 'mechanics.json', 'paytable.json', 'event_schema.json', 'math_verification_profile.json'];
  for (const name of names) {
    const source = readFileSync(join(CONFIG_ROOT, name));
    const published = readFileSync(join(LIBRARY_CONFIG_ROOT, name));
    assert(source.equals(published), `${name}: published config is stale`);
  }
  return names;
}

function fileFact(path) {
  return { bytes: statSync(path).size, sha256: sha256File(path) };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildManifest(indexPath, configNames) {
  const uploadFiles = [indexPath];
  for (const mode of MODE_REGISTRY.modes) {
    uploadFiles.push(join(LOOKUP_ROOT, `${mode.name}_lookup.csv`));
    uploadFiles.push(join(BOOK_ROOT, `${mode.name}_books.jsonl.zst`));
  }
  const files = [...uploadFiles];
  for (const name of configNames) files.push(join(LIBRARY_CONFIG_ROOT, name));
  const records = files.map((path) => ({
    path: relative(join(PUBLISH_ROOT, '..'), path).replaceAll('\\', '/'),
    ...fileFact(path),
  })).sort((left, right) => left.path.localeCompare(right.path));
  const sourceFiles = [
    join(GAME_ROOT, 'generate.mjs'),
    join(GAME_ROOT, 'verify.mjs'),
    join(GAME_ROOT, 'src', 'config.mjs'),
    join(GAME_ROOT, 'src', 'model.mjs'),
    join(GAME_ROOT, 'src', 'analytics.mjs'),
    join(GAME_ROOT, 'src', 'validate-book.mjs'),
    join(GAME_ROOT, 'tests', 'candidate.test.mjs'),
    ...configNames.map((name) => join(CONFIG_ROOT, name)),
  ];
  const repoRoot = join(GAME_ROOT, '..', '..', '..');
  const sourceRecords = sourceFiles.map((path) => ({
    path: relative(repoRoot, path).replaceAll('\\', '/'),
    ...fileFact(path),
  })).sort((left, right) => left.path.localeCompare(right.path));
  let gitHead = 'UNAVAILABLE';
  let gitDirtyPaths = [];
  try {
    gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    gitDirtyPaths = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split(/\r?\n/).filter(Boolean);
  } catch {
    gitDirtyPaths = ['git identity unavailable; source file hashes remain authoritative'];
  }
  const fingerprintInput = [...records, ...sourceRecords].map((record) => `${record.path}:${record.sha256}:${record.bytes}`).join('\n');
  const uploadPathSet = new Set(uploadFiles.map((path) => relative(join(PUBLISH_ROOT, '..'), path).replaceAll('\\', '/')));
  return {
    candidate_version: GAME_CONFIG.candidate_version,
    lifecycle: GAME_CONFIG.lifecycle,
    generated_from: 'deterministic source configs and seeds',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    rng: {
      algorithm: 'xorshift32',
      mode_seeds: Object.fromEntries(MODE_REGISTRY.modes.map((mode) => [mode.name, mode.generation_seed])),
    },
    git: { head_at_generation: gitHead, dirty: gitDirtyPaths.length > 0, porcelain_paths: gitDirtyPaths },
    upload_payload_note: 'Only index.json plus the referenced lookup CSV and zstd JSONL books form the minimal Stake math payload; configs and audits are evidence.',
    upload_payload_files: records.filter((record) => uploadPathSet.has(record.path)),
    files: records,
    source_files: sourceRecords,
    candidate_fingerprint_sha256: sha256Bytes(Buffer.from(fingerprintInput)),
  };
}

export async function verifyCandidate({ writeAudits = true } = {}) {
  process.stdout.write(`[verify] ${GAME_CONFIG.game_id} ${GAME_CONFIG.candidate_version}\n`);
  const { path: indexPath } = verifyIndex();
  const configNames = verifyConfigCopies();
  const manifest = buildManifest(indexPath, configNames);
  const modeResults = [];
  const fixtureModes = {};
  const fixtureCatalog = {};

  for (const mode of MODE_REGISTRY.modes) {
    const lookup = readLookup(mode);
    const fixtureIds = fixtureIdsForMode(mode, lookup.payouts);
    const books = await verifyBooks(mode, lookup.payouts, fixtureIds);
    const payoutValues = Array.from(lookup.payouts.slice(1));
    const packageFacts = {
      lookup_bytes: statSync(lookup.path).size,
      compressed_book_bytes: statSync(books.path).size,
      event_count: books.eventCount,
      aggregate_event_counts: books.aggregateEventCounts,
      lookup_sha256: sha256File(lookup.path),
      compressed_book_sha256: sha256File(books.path),
    };
    const { summary, gateResults } = summarizeDistribution(mode, payoutValues, packageFacts);
    assert(Object.values(gateResults).every(Boolean), `${mode.name}: mode gate failed ${JSON.stringify(gateResults)}`);

    const selected = books.selectedBooks;
    const selectedResults = books.selectedResults;
    const addFixture = (fixtureId, bookId, acceptance, predicate = () => true) => {
      assert(!Object.hasOwn(fixtureCatalog, fixtureId), `duplicate fixture ID ${fixtureId}`);
      const book = selected.get(bookId);
      const validation = selectedResults.get(bookId);
      assert(book && validation, `${fixtureId}: selected book ${bookId} missing`);
      assert(predicate(book, validation), `${fixtureId}: mechanical acceptance predicate failed`);
      fixtureCatalog[fixtureId] = fixtureCase(mode, fixtureId, book, validation, acceptance);
      return fixtureId;
    };

    const zeroId = addFixture(`${mode.name}_zero`, fixtureIds.zero, 'zero payout; no cluster_win; canonical zero grammar', (book, result) =>
      book.payoutMultiplier === 0 && (result.eventCounts.cluster_win ?? 0) === 0);
    const smallId = addFixture(`${mode.name}_small`, fixtureIds.small, 'positive lowest candidate payout', (book) => book.payoutMultiplier > 0);
    const mediumId = addFixture(`${mode.name}_medium`, fixtureIds.medium, 'positive medium tail anchor', (book) => book.payoutMultiplier > 0);
    const bigId = addFixture(`${mode.name}_big`, fixtureIds.big, 'positive big tail anchor', (book) => book.payoutMultiplier > 0);

    const ruleBookIds = [fixtureIds.ruleWin1, fixtureIds.ruleWin2, fixtureIds.ruleWin3, fixtureIds.ruleWin4, fixtureIds.ruleWin5];
    assert(new Set(ruleBookIds).size === 5, `${mode.name}: five rule-win books must have unique positive-weight IDs`);
    const ruleResults = ruleBookIds.map((id) => selectedResults.get(id));
    assert(ruleBookIds.every((id) => lookup.payouts[id] > 0), `${mode.name}: rule-win fixture has zero payout`);
    assert(new Set(ruleResults.map(mechanicSignature)).size === 5, `${mode.name}: five rule-win fixtures are not mechanically distinct`);
    assert(new Set(ruleResults.flatMap((result) => result.clusterSignatures)).size >= 5, `${mode.name}: rule-win fixtures cover fewer than five symbol/size/multiplier signatures`);
    const ruleFixtureIds = ruleBookIds.map((bookId, index) => addFixture(
      `${mode.name}_win_${String(index + 1).padStart(2, '0')}`,
      bookId,
      'positive-weight rule reconciliation with a mechanically distinct symbol/size/multiplier signature',
      (book) => book.payoutMultiplier > 0,
    ));

    const featureId = addFixture(`${mode.name}_feature`, fixtureIds.feature, 'feature entry plus deterministic feature cascade evidence', (book, result) =>
      book.payoutMultiplier > 0 && (mode.direct_feature ? result.sawDirectFeature : result.sawNaturalFeature));
    const maxId = addFixture(`${mode.name}_max_win`, fixtureIds.max, 'exact cap_reached -> round_end at 1,000,000 raw centi-x', (book) =>
      book.payoutMultiplier === MAX_WIN_RAW && book.events.at(-2)?.type === 'cap_reached' && book.events.at(-1)?.type === 'round_end');

    if (mode.name === 'base') {
      addFixture('base_cascade_3', fixtureIds.cascade3, 'exactly three consecutive cluster evaluations linked by physical tumbles', (_book, result) => result.maxCascadeWins === 3);
      addFixture('base_cascade_5', fixtureIds.cascade5, 'at least five consecutive physical cascade wins', (_book, result) => result.maxCascadeWins >= 5);
      addFixture('base_simultaneous_two_clusters', fixtureIds.simultaneous, 'one immutable board resolves two disjoint paying components together', (_book, result) => result.maxClustersInStep >= 2);
      addFixture('base_route_tease', fixtureIds.routeTease, 'live route advances toward Core without arming it', (_book, result) => result.accessValues.includes(2) && !result.sawCoreLive);
      addFixture('base_access_2', fixtureIds.access2, 'post-breach access authority reaches 2x', (_book, result) => result.accessValues.includes(2) && !result.sawCoreLive);
      addFixture('base_access_3', fixtureIds.access3, 'post-breach access authority reaches 3x', (_book, result) => result.accessValues.includes(3) && !result.sawCoreLive);
      addFixture('base_core_live', fixtureIds.coreLive, 'Core is live in an authoritative breach_state', (_book, result) => result.sawCoreLive);
      addFixture('base_natural_blackout', fixtureIds.naturalFeature, 'Core arms and BLACKOUT starts only after the physical cascade resolves', (_book, result) => result.sawNaturalFeature && result.sawCoreLive);
    } else if (mode.name === 'deep_access') {
      addFixture('deep_access_natural_blackout', fixtureIds.feature, 'seeded access 2x progresses to a natural Core-triggered BLACKOUT', (_book, result) =>
        result.accessValues.includes(2) && result.accessValues.includes(5) && result.sawNaturalFeature);
    } else {
      addFixture('blackout_direct_entry', fixtureIds.feature, 'direct BLACKOUT seed uses feature phase from its first breach snapshot', (book, result) =>
        result.sawDirectFeature && book.events[1]?.type === 'breach_state' && book.events[1]?.phase === 'feature');
      addFixture('blackout_12_cycles', fixtureIds.feature, 'three one-time ports extend six cycles to exactly twelve', (_book, result) =>
        result.maxTotalCycles === 12 && [0, 1, 2, 3].every((count) => result.portCounts.includes(count)));
      for (const portCount of [0, 1, 2, 3]) {
        addFixture(`blackout_ports_${portCount}`, fixtureIds.feature, `authoritative feature state observes ${portCount} reached port(s)`, (_book, result) =>
          result.portCounts.includes(portCount));
      }
    }

    fixtureModes[mode.name] = {
      zero: zeroId,
      small: smallId,
      medium: mediumId,
      big: bigId,
      five_rule_wins: ruleFixtureIds,
      feature: featureId,
      max: maxId,
    };
    modeResults.push({ mode, summary, gateResults, payouts: payoutValues, contractCoverage: books.coverage });
  }

  const achievedRtps = modeResults.map((result) => result.summary.achieved_rtp);
  const rtpSpread = Math.max(...achievedRtps) - Math.min(...achievedRtps);
  const baseResult = modeResults.find((result) => result.mode.name === 'base');
  const templateProbe = operatorTemplateProbe(MODE_REGISTRY.modes);
  const baseCoverage = modeResults.find((result) => result.mode.name === 'base').contractCoverage;
  const requiredContractFixtures = [
    ...MODE_REGISTRY.modes.flatMap((mode) => [
      `${mode.name}_zero`, `${mode.name}_small`, `${mode.name}_medium`, `${mode.name}_big`,
      ...Array.from({ length: 5 }, (_, index) => `${mode.name}_win_${String(index + 1).padStart(2, '0')}`),
      `${mode.name}_feature`, `${mode.name}_max_win`,
    ]),
    'base_cascade_3', 'base_cascade_5', 'base_simultaneous_two_clusters', 'base_route_tease',
    'base_access_2', 'base_access_3', 'base_core_live', 'base_natural_blackout',
    'deep_access_natural_blackout', 'blackout_direct_entry', 'blackout_12_cycles',
    'blackout_ports_0', 'blackout_ports_1', 'blackout_ports_2', 'blackout_ports_3',
  ];
  const crossModeGates = {
    exact_mode_set: JSON.stringify(MODE_REGISTRY.modes.map((mode) => mode.name)) === JSON.stringify(['base', 'deep_access', 'blackout']),
    base_cost_is_one: MODE_REGISTRY.modes[0].name === 'base' && MODE_REGISTRY.modes[0].cost === 1,
    base_is_cheapest: MODE_REGISTRY.modes.every((mode) => mode.cost >= MODE_REGISTRY.modes[0].cost),
    exact_target_rtp_all_modes: achievedRtps.every((rtp) => rtp === TARGET_RTP),
    cross_mode_rtp_spread: rtpSpread <= VERIFICATION_PROFILE.hard_gates.maximum_cross_mode_rtp_spread,
    base_minimum_standard_deviation: baseResult.summary.standard_deviation_cost_normalized_return >= VERIFICATION_PROFILE.hard_gates.base_min_cost_normalized_standard_deviation,
    base_3star_maximum_standard_deviation: baseResult.summary.standard_deviation_cost_normalized_return <= VERIFICATION_PROFILE.three_star_review_bands.maximum_base_cost_normalized_standard_deviation,
    operator_bet_template_viable: templateProbe.viable,
    all_effective_sample_size_ratios_gte_0_50: modeResults.every((result) => result.summary.effective_sample_size / result.summary.books >= 0.5),
    all_top_single_book_shares_lte_0_0001: modeResults.every((result) => result.summary.top_single_book_selection_share <= 0.0001),
    five_positive_fixtures_each_mode: Object.values(fixtureModes).every((fixtures) => fixtures.five_rule_wins.length === 5),
    canonical_typed_event_schema_bound_to_every_fixture: Object.values(fixtureCatalog).every((fixture) =>
      fixture.event_contract === BOOK_EVENT_CONTRACT && fixture.event_schema_sha256 === EVENT_SCHEMA_SHA256),
    physical_gravity_and_top_refill_validated_for_every_tumble: true,
    simultaneous_disjoint_cluster_step_proven: baseCoverage.maxClustersInStep >= 2,
    pre_feature_access_ladder_1_2_3_5_proven: [1, 2, 3, 5].every((access) => baseCoverage.accessValues.has(access)),
    natural_and_direct_feature_entry_proven: modeResults.some((result) => result.contractCoverage.sawNaturalFeature) &&
      modeResults.some((result) => result.contractCoverage.sawDirectFeature),
    twelve_cycle_and_all_port_counts_proven: modeResults.some((result) => result.contractCoverage.maxTotalCycles === 12 &&
      [0, 1, 2, 3].every((count) => result.contractCoverage.portCounts.has(count))),
    complete_stable_contract_fixture_catalog: requiredContractFixtures.every((fixtureId) => Object.hasOwn(fixtureCatalog, fixtureId)),
  };
  assert(Object.values(crossModeGates).every(Boolean), `cross-mode gate failed ${JSON.stringify(crossModeGates)}`);

  const mathAudit = {
    verification_result: 'PASS',
    lifecycle: GAME_CONFIG.lifecycle,
    candidate_version: GAME_CONFIG.candidate_version,
    candidate_fingerprint_sha256: manifest.candidate_fingerprint_sha256,
    verified_at_source_review_date: VERIFICATION_PROFILE.source_checked,
    commands: {
      generate: GAME_CONFIG.generation.command,
      verify: GAME_CONFIG.generation.verification_command,
      tests: 'node --test math/games/blacksite_breach/tests/*.test.mjs',
    },
    payout_unit_contract: {
      package: 'centi-x uint64; raw 100 = 1.00x',
      cost_normalized_return_formula: 'raw / (100 * mode cost)',
      wallet_units_present: false,
    },
    mode_results: modeResults.map(({ summary, gateResults, contractCoverage }) => ({
      summary,
      gate_results: gateResults,
      contract_coverage: {
        access_values: [...contractCoverage.accessValues].sort((left, right) => left - right),
        reached_port_counts: [...contractCoverage.portCounts].sort((left, right) => left - right),
        maximum_cascade_wins: contractCoverage.maxCascadeWins,
        maximum_clusters_in_one_step: contractCoverage.maxClustersInStep,
        maximum_total_feature_cycles: contractCoverage.maxTotalCycles,
        core_live_observed: contractCoverage.sawCoreLive,
        natural_feature_observed: contractCoverage.sawNaturalFeature,
        direct_feature_observed: contractCoverage.sawDirectFeature,
      },
    })),
    cross_mode: { achieved_rtp_spread: rtpSpread, gates: crossModeGates },
    operator_template_probe: templateProbe,
    source_ambiguity: VERIFICATION_PROFILE.tail_probability_interpretations,
  };
  const riskAudit = {
    verification_result: 'PASS',
    lifecycle: GAME_CONFIG.lifecycle,
    candidate_fingerprint_sha256: manifest.candidate_fingerprint_sha256,
    modes: modeResults.map(({ mode, summary, payouts }) => ({
      mode: mode.name,
      exact_distribution: {
        hit_rate: summary.hit_rate,
        zero_rate: summary.zero_rate,
        standard_deviation_cost_normalized_return: summary.standard_deviation_cost_normalized_return,
        cvar_worst_0_1_percent: summary.cvar_worst_0_1_percent,
        tail: summary.tail,
        payout_bands_cost_normalized: summary.payout_bands_cost_normalized,
      },
      short_windows: shortWindowRisk(mode, payouts),
    })),
    note: 'Risk visibility only. Runtime selection remains fixed, stateless and player/history independent.',
  };
  const fixtureIndex = {
    candidate_version: GAME_CONFIG.candidate_version,
    lifecycle: GAME_CONFIG.lifecycle,
    candidate_fingerprint_sha256: manifest.candidate_fingerprint_sha256,
    payout_unit: 'centi-x_uint64',
    event_contract: BOOK_EVENT_CONTRACT,
    event_schema_sha256: EVENT_SCHEMA_SHA256,
    fixtures: fixtureCatalog,
    modes: fixtureModes,
  };
  const modeGateCount = modeResults.reduce((sum, result) => sum + Object.keys(result.gateResults).length, 0);
  const crossModeGateCount = Object.keys(crossModeGates).length;
  const verifyResult = {
    result: 'PASS',
    lifecycle: GAME_CONFIG.lifecycle,
    candidate_version: GAME_CONFIG.candidate_version,
    candidate_fingerprint_sha256: manifest.candidate_fingerprint_sha256,
    books_verified: BOOKS_PER_MODE * MODE_REGISTRY.modes.length,
    gates_passed: modeGateCount + crossModeGateCount,
    gates_total: modeGateCount + crossModeGateCount,
    all_lookup_weights_positive_and_equal_one: true,
    all_books_decompressed_and_schema_formula_topology_validated: true,
    all_tumbles_physical_gravity_and_top_refill_validated: true,
    all_contract_fixture_predicates_passed: true,
    canonical_event_schema_sha256: EVENT_SCHEMA_SHA256,
    all_gates_passed: true,
  };

  if (writeAudits) {
    writeJson(join(PUBLISH_ROOT, 'CANDIDATE_MANIFEST.json'), manifest);
    writeJson(join(PUBLISH_ROOT, 'MATH_AUDIT.json'), mathAudit);
    writeJson(join(PUBLISH_ROOT, 'RISK_AUDIT.json'), riskAudit);
    writeJson(join(PUBLISH_ROOT, 'FIXTURE_INDEX.json'), fixtureIndex);
    writeJson(join(PUBLISH_ROOT, 'VERIFY_RESULT.json'), verifyResult);
  }
  process.stdout.write(`[verify] PASS ${manifest.candidate_fingerprint_sha256}\n`);
  return { manifest, mathAudit, riskAudit, fixtureIndex, verifyResult };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  verifyCandidate({ writeAudits: !process.argv.includes('--no-write') }).catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
