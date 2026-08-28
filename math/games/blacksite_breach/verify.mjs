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
  MECHANICS,
  MODE_NAMES,
  MODE_REGISTRY,
  PAYLINES,
  PUBLISH_ROOT,
  TARGET_RTP,
  VERIFICATION_PROFILE,
  assert,
  sha256Bytes,
  sha256File,
} from './src/config.mjs';
import { operatorTemplateProbe, shortWindowRisk, summarizeDistribution } from './src/analytics.mjs';
import { BASE_LINE_BOOK_COUNT, DISTINCT_RESERVED_PAYOUTS, EXPANSION_FIXTURE_OFFSET } from './src/model.mjs';
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
    assert(weight === 1, `${mode.name}/${id}: v3 unit-weight contract requires weight 1`);
    assert(payout <= MAX_WIN_RAW, `${mode.name}/${id}: lookup payout exceeds cap`);
    payouts[id] = payout;
    weights[id] = weight;
  }
  return { path, payouts, weights };
}

function fixtureIdsForMode(mode) {
  const firstPositive = mode.zero_books + 1;
  return {
    zero: 1,
    small: firstPositive,
    expansion: mode.zero_books + EXPANSION_FIXTURE_OFFSET,
    medium: mode.zero_books + DISTINCT_RESERVED_PAYOUTS,
    big: mode.zero_books + DISTINCT_RESERVED_PAYOUTS + 1,
    max: BOOKS_PER_MODE,
    ruleWins: Array.from({ length: 5 }, (_, index) => firstPositive + index),
  };
}

function fixtureCase(mode, fixtureId, book, validation, acceptance) {
  const lineChecks = book.events
    .filter((event) => event.type === 'line_win')
    .flatMap((event) => event.wins.map((win) => ({
      event_index: event.index,
      phase: event.phase,
      spin_index: event.spin_index,
      line_id: win.line_id,
      symbol: win.symbol,
      match_count: win.match_count,
      positions: win.positions,
      wild_positions: win.wild_positions,
      base_payout_raw: win.base_payout_raw,
      applied_award_raw: win.applied_award_raw,
      cumulative_after_raw: event.cumulative_after_raw,
    })));
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
      line_signatures: validation.lineSignatures,
      maximum_lines_in_one_spin: validation.maxLinesInSpin,
      expansion_count: validation.expansionCount,
      maximum_expanded_reels: validation.maximumExpandedReels,
      expansion_targets: validation.expansionTargets,
      natural_feature: validation.sawNaturalFeature,
      direct_feature: validation.sawDirectFeature,
      free_spins_played: validation.freeSpinsPlayed,
      base_lines_won: validation.baseLinesWon,
      capped: validation.capped,
    },
    line_formula_checks: lineChecks,
    final_event: book.events.at(-1),
  };
}

async function verifyBooks(mode, payouts, fixtureIds) {
  const path = join(BOOK_ROOT, `${mode.name}_books.jsonl.zst`);
  const lines = createInterface({ input: createReadStream(path).pipe(createZstdDecompress()), crlfDelay: Infinity });
  const fixedIds = new Set(Object.values(fixtureIds).flat());
  const selectedBooks = new Map();
  const selectedResults = new Map();
  const aggregateEventCounts = {};
  const coverage = {
    sawNaturalFeature: false,
    sawDirectFeature: false,
    expansionCount: 0,
    maximumExpandedReels: 0,
    expansionTargets: new Set(),
    lineSignatures: new Set(),
    maxLinesInSpin: 0,
    sawDeepAccessGuarantee: false,
    sawMaxWin: false,
    baseLineBooks: 0,
  };
  let id = 0;
  let eventCount = 0;
  for await (const line of lines) {
    assert(line.length > 0, `${mode.name}: empty JSONL line`);
    id += 1;
    assert(id <= BOOKS_PER_MODE, `${mode.name}: too many books`);
    const book = JSON.parse(line);
    const result = validateBook(book, mode, id, payouts[id]);
    eventCount += result.eventCount;
    for (const [type, count] of Object.entries(result.eventCounts)) aggregateEventCounts[type] = (aggregateEventCounts[type] ?? 0) + count;
    coverage.sawNaturalFeature ||= result.sawNaturalFeature;
    coverage.sawDirectFeature ||= result.sawDirectFeature;
    coverage.expansionCount += result.expansionCount;
    coverage.maximumExpandedReels = Math.max(coverage.maximumExpandedReels, result.maximumExpandedReels);
    result.expansionTargets.forEach((symbol) => coverage.expansionTargets.add(symbol));
    result.lineSignatures.forEach((signature) => coverage.lineSignatures.add(signature));
    coverage.maxLinesInSpin = Math.max(coverage.maxLinesInSpin, result.maxLinesInSpin);
    coverage.sawDeepAccessGuarantee ||= mode.name === 'deep_access' && result.deepAccessGuaranteeObserved;
    coverage.sawMaxWin ||= book.payoutMultiplier === MAX_WIN_RAW && result.capped;
    if (result.baseLinesWon > 0) coverage.baseLineBooks += 1;
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
    assert(readFileSync(join(CONFIG_ROOT, name)).equals(readFileSync(join(LIBRARY_CONFIG_ROOT, name))), `${name}: published config is stale`);
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
  const files = [...uploadFiles, ...configNames.map((name) => join(LIBRARY_CONFIG_ROOT, name))];
  const records = files.map((path) => ({
    path: relative(join(PUBLISH_ROOT, '..'), path).replaceAll('\\', '/'),
    ...fileFact(path),
  })).sort((left, right) => left.path.localeCompare(right.path));
  const sourceFiles = [
    join(GAME_ROOT, 'generate.mjs'),
    join(GAME_ROOT, 'verify.mjs'),
    join(GAME_ROOT, 'src', 'config.mjs'),
    join(GAME_ROOT, 'src', 'line-math.mjs'),
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
    gitDirtyPaths = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/).filter(Boolean);
  } catch {
    gitDirtyPaths = ['git identity unavailable; source file hashes remain authoritative'];
  }
  const fingerprintInput = [...records, ...sourceRecords].map((record) => `${record.path}:${record.sha256}:${record.bytes}`).join('\n');
  const uploadPathSet = new Set(uploadFiles.map((path) => relative(join(PUBLISH_ROOT, '..'), path).replaceAll('\\', '/')));
  return {
    candidate_version: GAME_CONFIG.candidate_version,
    lifecycle: GAME_CONFIG.lifecycle,
    generated_from: 'deterministic constructible 5x3 line-pay archetypes and source configs',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    rng: { algorithm: 'xorshift32', mode_seeds: Object.fromEntries(MODE_REGISTRY.modes.map((mode) => [mode.name, mode.generation_seed])) },
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
  const fixtureCatalog = {};
  const fixtureModes = {};

  for (const mode of MODE_REGISTRY.modes) {
    const lookup = readLookup(mode);
    const fixtureIds = fixtureIdsForMode(mode);
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
    const addFixture = (fixtureId, bookId, acceptance, predicate = () => true) => {
      assert(!Object.hasOwn(fixtureCatalog, fixtureId), `duplicate fixture ID ${fixtureId}`);
      const book = books.selectedBooks.get(bookId);
      const validation = books.selectedResults.get(bookId);
      assert(book && validation, `${fixtureId}: selected book ${bookId} missing`);
      assert(predicate(book, validation), `${fixtureId}: mechanical acceptance predicate failed`);
      fixtureCatalog[fixtureId] = fixtureCase(mode, fixtureId, book, validation, acceptance);
      return fixtureId;
    };
    const zero = addFixture(`${mode.name}_zero`, fixtureIds.zero, 'zero payout with canonical mode grammar and no line_win', (book, result) => book.payoutMultiplier === 0 && (result.eventCounts.line_win ?? 0) === 0);
    const small = addFixture(`${mode.name}_small`, fixtureIds.small, 'lowest positive constructible line payout', (book) => book.payoutMultiplier === 1);
    const medium = addFixture(`${mode.name}_medium`, fixtureIds.medium, '100-centi-x positive line-pay anchor', (book) => book.payoutMultiplier === 100);
    const big = addFixture(`${mode.name}_big`, fixtureIds.big, 'cost-scaled baseline distribution anchor', (book) => book.payoutMultiplier > 100);
    const ruleWins = fixtureIds.ruleWins.map((bookId, index) => addFixture(
      `${mode.name}_win_${String(index + 1).padStart(2, '0')}`,
      bookId,
      'positive-weight deterministic payline reconciliation fixture',
      (book, result) => book.payoutMultiplier > 0 && result.lineSignatures.length > 0,
    ));
    const feature = addFixture(`${mode.name}_feature`, fixtureIds.expansion, 'eight-spin feature with a genuine three-reel expanding target and ten evaluated paylines', (book, result) =>
      book.payoutMultiplier === 10 && result.expansionCount > 0 && result.maximumExpandedReels === 3 && result.maxLinesInSpin === 10);
    const max = addFixture(`${mode.name}_max_win`, fixtureIds.max, 'exact 10,000x cap reached by a genuine ten-line WILD board with deterministic truncation', (book, result) =>
      book.payoutMultiplier === MAX_WIN_RAW && result.capped && book.events.at(-2)?.type === 'cap_reached');
    if (mode.name === 'base') {
      addFixture('base_classic_line_win', fixtureIds.big, 'opening base spin pays all ten fixed paylines left-to-right without entering BLACKOUT', (book, result) =>
        book.payoutMultiplier === 250 && result.baseLinesWon === 10 && !result.sawNaturalFeature && book.events.at(-1)?.final_phase === 'base');
      addFixture('base_natural_blackout', fixtureIds.expansion, 'three BREACH symbols on distinct opening reels naturally trigger exactly eight free spins', (_book, result) => result.sawNaturalFeature && result.freeSpinsPlayed === 8);
      addFixture('base_expanding_breach', fixtureIds.expansion, 'selected TEN target expands three reels before ten-line evaluation', (_book, result) => result.expansionTargets.includes('ten') && result.maximumExpandedReels === 3);
    } else if (mode.name === 'deep_access') {
      addFixture('deep_access_guaranteed_pair', fixtureIds.zero, 'non-trigger opening contains exactly the two canonical guaranteed BREACH positions', (book, result) => result.deepAccessGuaranteeObserved && !result.sawNaturalFeature && book.events[1]?.type === 'spin_set');
      addFixture('deep_access_natural_blackout', fixtureIds.expansion, 'two guaranteed BREACH positions plus a third distinct reel trigger exactly eight free spins', (_book, result) => result.sawNaturalFeature && result.freeSpinsPlayed === 8);
      addFixture('deep_access_expanding_breach', fixtureIds.expansion, 'enhanced entry resolves the same authoritative three-reel expansion contract', (_book, result) => result.expansionTargets.includes('ten'));
    } else {
      addFixture('blackout_direct_entry', fixtureIds.expansion, '80x BLACKOUT enters feature_start directly and plays eight free spins', (book, result) => result.sawDirectFeature && book.events[1]?.type === 'feature_start' && result.freeSpinsPlayed === 8);
      addFixture('blackout_expanding_breach', fixtureIds.expansion, 'direct BLACKOUT resolves a genuine three-reel selected-symbol expansion', (_book, result) => result.expansionTargets.includes('ten'));
    }
    fixtureModes[mode.name] = { zero, small, medium, big, five_rule_wins: ruleWins, feature, max };
    modeResults.push({ mode, summary, gateResults, payouts: payoutValues, contractCoverage: books.coverage });
  }

  const achievedRtps = modeResults.map((result) => result.summary.achieved_rtp);
  const rtpSpread = Math.max(...achievedRtps) - Math.min(...achievedRtps);
  const baseResult = modeResults.find((result) => result.mode.name === 'base');
  const deepResult = modeResults.find((result) => result.mode.name === 'deep_access');
  const templateProbe = operatorTemplateProbe(MODE_REGISTRY.modes);
  const requiredFixtures = [
    ...MODE_REGISTRY.modes.flatMap((mode) => [
      `${mode.name}_zero`, `${mode.name}_small`, `${mode.name}_medium`, `${mode.name}_big`,
      ...Array.from({ length: 5 }, (_, index) => `${mode.name}_win_${String(index + 1).padStart(2, '0')}`),
      `${mode.name}_feature`, `${mode.name}_max_win`,
    ]),
    'base_classic_line_win', 'base_natural_blackout', 'base_expanding_breach', 'deep_access_guaranteed_pair',
    'deep_access_natural_blackout', 'deep_access_expanding_breach', 'blackout_direct_entry', 'blackout_expanding_breach',
  ];
  const crossModeGates = {
    exact_mode_set: JSON.stringify(MODE_NAMES) === JSON.stringify(['base', 'deep_access', 'blackout']),
    exact_mode_costs: JSON.stringify(MODE_REGISTRY.modes.map((mode) => mode.cost)) === JSON.stringify([1, 4, 80]),
    base_is_cheapest: MODE_REGISTRY.modes.every((mode) => mode.cost >= 1),
    exact_target_rtp_all_modes: achievedRtps.every((rtp) => rtp === TARGET_RTP),
    cross_mode_rtp_spread: rtpSpread <= VERIFICATION_PROFILE.hard_gates.maximum_cross_mode_rtp_spread,
    base_minimum_standard_deviation: baseResult.summary.standard_deviation_cost_normalized_return >= VERIFICATION_PROFILE.hard_gates.base_min_cost_normalized_standard_deviation,
    base_3star_maximum_standard_deviation: baseResult.summary.standard_deviation_cost_normalized_return <= VERIFICATION_PROFILE.three_star_review_bands.maximum_base_cost_normalized_standard_deviation,
    operator_bet_template_viable: templateProbe.viable,
    event_contract_is_v3: BOOK_EVENT_CONTRACT === 'blacksite-book-events-v3',
    board_is_column_major_5x3: GAME_CONFIG.layout.columns === 5 && GAME_CONFIG.layout.rows === 3 && MECHANICS.board.storage === 'column-major',
    ten_unique_fixed_paylines: PAYLINES.length === 10 && new Set(PAYLINES.map((line) => JSON.stringify(line.rows))).size === 10,
    natural_and_direct_feature_entry_proven: modeResults.some((result) => result.contractCoverage.sawNaturalFeature) && modeResults.some((result) => result.contractCoverage.sawDirectFeature),
    genuine_expansion_and_ten_line_evaluation_proven: modeResults.every((result) => result.contractCoverage.expansionCount > 0 && result.contractCoverage.maxLinesInSpin === 10),
    base_classic_line_pay_books_present: baseResult.contractCoverage.baseLineBooks === BASE_LINE_BOOK_COUNT,
    deep_access_guaranteed_pair_proven: deepResult.contractCoverage.sawDeepAccessGuarantee,
    max_win_positive_each_mode: modeResults.every((result) => result.contractCoverage.sawMaxWin),
    at_least_100_distinct_positive_payouts_each_mode: modeResults.every((result) => result.summary.distinct_positive_raw_payout_values >= 100),
    canonical_schema_bound_to_every_fixture: Object.values(fixtureCatalog).every((fixture) => fixture.event_contract === BOOK_EVENT_CONTRACT && fixture.event_schema_sha256 === EVENT_SCHEMA_SHA256),
    complete_v3_fixture_catalog: requiredFixtures.every((fixtureId) => Object.hasOwn(fixtureCatalog, fixtureId)),
  };
  assert(Object.values(crossModeGates).every(Boolean), `cross-mode gate failed ${JSON.stringify(crossModeGates)}`);

  const mathAudit = {
    verification_result: 'PASS',
    lifecycle: GAME_CONFIG.lifecycle,
    candidate_version: GAME_CONFIG.candidate_version,
    candidate_fingerprint_sha256: manifest.candidate_fingerprint_sha256,
    verified_at_source_review_date: VERIFICATION_PROFILE.source_checked,
    commands: { generate: GAME_CONFIG.generation.command, verify: GAME_CONFIG.generation.verification_command, tests: 'node --test math/games/blacksite_breach/tests/*.test.mjs' },
    payout_unit_contract: { package: 'centi-x uint64; raw 100 = 1.00x', cost_normalized_return_formula: 'raw / (100 * mode cost)', wallet_units_present: false },
    mode_results: modeResults.map(({ summary, gateResults, contractCoverage }) => ({
      summary,
      gate_results: gateResults,
      contract_coverage: {
        natural_feature_observed: contractCoverage.sawNaturalFeature,
        direct_feature_observed: contractCoverage.sawDirectFeature,
        expansion_events: contractCoverage.expansionCount,
        maximum_expanded_reels: contractCoverage.maximumExpandedReels,
        expansion_targets: [...contractCoverage.expansionTargets].sort(),
        distinct_line_signatures: contractCoverage.lineSignatures.size,
        maximum_lines_in_one_spin: contractCoverage.maxLinesInSpin,
        max_win_observed: contractCoverage.sawMaxWin,
        base_line_books: contractCoverage.baseLineBooks,
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
    all_books_decompressed_and_schema_formula_payline_validated: true,
    all_wild_resolution_and_expansion_recomputed: true,
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
