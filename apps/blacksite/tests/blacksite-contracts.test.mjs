import assert from 'node:assert/strict';
import { createReadStream, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createZstdDecompress } from 'node:zlib';
import {
	CANDIDATE_FINGERPRINT_SHA256,
	EVENT_CONTRACT,
	EVENT_SCHEMA_SHA256,
	MODES,
	getModeActionDescription,
} from '../src/lib/contracts/modes.js';
import {
	ALL_SYMBOLS,
	FREE_SPIN_COUNT,
	LINE_PAYTABLE_RAW,
	PAYING_SYMBOLS,
	PAYLINES,
	PAYLINE_COUNT,
	REEL_COLUMNS,
	REEL_ROWS,
	REGULAR_SYMBOLS,
	TRIGGER_SYMBOL,
	WILD_SYMBOL,
} from '../src/lib/contracts/reels.js';
import {
	RULES_CONTRACT,
	RULES_INTERFACE_COPY,
	SYMBOL_PAYOUTS,
	getRulesDisclaimer,
	getRulesInterfaceCopy,
} from '../src/lib/contracts/rules.js';
import { BASE_ZERO_FIXTURE } from '../src/lib/fixtures/base-zero.js';
import {
	PRESENTATION_FIXTURE_IDS,
	getFixture as getGeneratedFixture,
	getPresentationFixture,
} from '../src/lib/fixtures/catalog.generated.js';
import {
	ContractViolation,
	GameEventAdapter,
	evaluatePaylines,
	expandTargetBoard,
} from '../src/lib/runtime/game-event-adapter.js';
import { resolveLaunchMode } from '../src/lib/runtime/launch-mode.js';
import {
	PresentationDirector,
	createInitialPresentationState,
	planPresentationRestore,
} from '../src/lib/runtime/presentation-director.js';
import { playerVisibleRestrictedHits } from 'utils-shared/stake-social.js';
import { MODE_BY_NAME } from '../../../math/games/blacksite_breach/src/config.mjs';
import { buildBook } from '../../../math/games/blacksite_breach/src/model.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const fixtureIndex = JSON.parse(readFileSync(
	join(repoRoot, 'math/games/blacksite_breach/library/publish_files/FIXTURE_INDEX.json'),
	'utf8',
));

function clone(value) {
	return structuredClone(value);
}

function fixtureRecord(fixtureId) {
	const record = fixtureIndex.fixtures[fixtureId];
	assert(record, `missing v3 fixture ${fixtureId}`);
	return record;
}

function bookForFixture(fixtureId) {
	const record = fixtureRecord(fixtureId);
	return buildBook(MODE_BY_NAME.get(record.mode), record.book_id, record.payout_raw);
}

async function readPublishedBookOne(mode = 'base') {
	const source = createReadStream(join(
		repoRoot,
		`math/games/blacksite_breach/library/books_compressed/${mode}_books.jsonl.zst`,
	)).pipe(createZstdDecompress());
	for await (const line of createInterface({ input: source, crlfDelay: Infinity })) {
		return JSON.parse(line);
	}
	throw new Error(`Published ${mode} book file is empty`);
}

function findEvent(book, type) {
	const event = book.events.find((candidate) => candidate.type === type);
	assert(event, `book ${book.id} must contain ${type}`);
	return event;
}

function adapt(book, expectedMode = book.events[0].mode) {
	return new GameEventAdapter().adaptBook(book, { expectedMode });
}

function rejectMutation(fixtureId, mutate, expectation) {
	const book = clone(bookForFixture(fixtureId));
	mutate(book);
	assert.throws(() => adapt(book), expectation);
}

test('v3 identities, thirteen symbols, 5x3 reels and ten fixed paylines are frozen at the app boundary', () => {
	assert.equal(EVENT_CONTRACT, 'blacksite-book-events-v3');
	assert.equal(fixtureIndex.event_contract, EVENT_CONTRACT);
	assert.equal(fixtureIndex.candidate_version, '0.3.0-math-v3');
	assert.equal(fixtureIndex.event_schema_sha256, EVENT_SCHEMA_SHA256);
	assert.equal(fixtureIndex.candidate_fingerprint_sha256, CANDIDATE_FINGERPRINT_SHA256);
	assert.deepEqual(REGULAR_SYMBOLS, [
		'operative',
		'encrypted_drive',
		'tactical_radio',
		'classified_folder',
		'night_vision_goggles',
		'supply_crate',
		'a',
		'k',
		'q',
		'j',
		'ten',
	]);
	assert.deepEqual(PAYING_SYMBOLS, [...REGULAR_SYMBOLS, 'ghost_wild']);
	assert.deepEqual(Object.keys(LINE_PAYTABLE_RAW), PAYING_SYMBOLS);
	assert.deepEqual(new Set(ALL_SYMBOLS), new Set([
		...REGULAR_SYMBOLS,
		'ghost_wild',
		'breach',
	]));
	assert.equal(ALL_SYMBOLS.length, 13);
	assert.equal(REEL_COLUMNS, 5);
	assert.equal(REEL_ROWS, 3);
	assert.equal(PAYLINE_COUNT, 10);
	assert.equal(FREE_SPIN_COUNT, 8);
	assert.equal(new Set(PAYLINES.map((line) => JSON.stringify(line))).size, 10);
	assert(PAYLINES.every((line) => line.length === 5 && line.every((row) => row >= 0 && row < 3)));
	assert.deepEqual(
		MODES.map(({ id, costMultiplier, normalLabel, socialLabel, directFeature }) => ({
			id, costMultiplier, normalLabel, socialLabel, directFeature,
		})),
		[
			{ id: 'base', costMultiplier: 1, normalLabel: 'BREACH RUN', socialLabel: 'STANDARD RUN', directFeature: false },
			{ id: 'deep_access', costMultiplier: 4, normalLabel: 'DEEP ACCESS', socialLabel: 'DEEP ACCESS', directFeature: false },
			{ id: 'blackout', costMultiplier: 80, normalLabel: 'BLACKOUT PROTOCOL', socialLabel: 'BLACKOUT ENTRY', directFeature: true },
		],
	);
});

test('base_zero is byte-content-equivalent to published v3 base book 1', async () => {
	const published = await readPublishedBookOne();
	assert.deepEqual(BASE_ZERO_FIXTURE.book, published);
	assert.deepEqual(BASE_ZERO_FIXTURE.book, buildBook(MODE_BY_NAME.get('base'), 1, 0));
	assert.equal(BASE_ZERO_FIXTURE.candidateFingerprint, CANDIDATE_FINGERPRINT_SHA256);
	assert.equal(BASE_ZERO_FIXTURE.eventSchemaSha256, EVENT_SCHEMA_SHA256);
});

test('every current FIXTURE_INDEX entry is reproducible by buildBook and accepted by the runtime adapter', () => {
	const entries = Object.entries(fixtureIndex.fixtures);
	assert.equal(entries.length, 41);
	for (const [fixtureId, record] of entries) {
		const book = bookForFixture(fixtureId);
		assert.equal(book.id, record.book_id, fixtureId);
		assert.equal(book.payoutMultiplier, record.payout_raw, fixtureId);
		assert.deepEqual(book.events.map(({ type }) => type), record.event_types, fixtureId);
		assert.equal(book.events[0].event_contract, EVENT_CONTRACT, fixtureId);
		assert.equal(book.events[0].board_columns, 5, fixtureId);
		assert.equal(book.events[0].board_rows, 3, fixtureId);
		assert.equal(book.events[0].payline_count, 10, fixtureId);
		const cues = adapt(book, record.mode);
		assert.equal(cues.length, book.events.length, fixtureId);
		assert.equal(cues.at(-1).event.payout_multiplier_raw, book.payoutMultiplier, fixtureId);
	}
});

test('presentation fixture purposes do not confuse payout size with base-only or expansion semantics', () => {
	assert.deepEqual(PRESENTATION_FIXTURE_IDS, {
		base_simple_line_win: 'base_classic_line_win',
		base_feature_small: 'base_small',
		blackout_small_no_expansion: 'blackout_small',
		blackout_expansion: 'blackout_expanding_breach',
	});

	const baseSimple = getPresentationFixture('base_simple_line_win');
	assert.equal(baseSimple, getGeneratedFixture('base_classic_line_win'));
	assert.equal(baseSimple.book.payoutMultiplier, 250);
	assert.deepEqual(baseSimple.book.events.map(({ type }) => type), [
		'round_start', 'spin_set', 'line_win', 'round_end',
	]);
	assert.equal(baseSimple.book.events.at(-1).final_phase, 'base');

	const baseFeatureSmall = getPresentationFixture('base_feature_small');
	assert.equal(baseFeatureSmall, getGeneratedFixture('base_small'));
	assert.equal(baseFeatureSmall.book.payoutMultiplier, 1);
	assert(baseFeatureSmall.book.events.some(({ type }) => type === 'feature_start'));
	assert.equal(baseFeatureSmall.book.events.at(-1).final_phase, 'feature');

	const blackoutSmall = getPresentationFixture('blackout_small_no_expansion');
	assert.equal(
		blackoutSmall.book.events.find(({ type }) => type === 'feature_start').target_symbol,
		'operative',
	);
	assert.equal(blackoutSmall.book.events.some(({ type }) => type === 'expansion_applied'), false);

	const blackoutExpansion = getPresentationFixture('blackout_expansion');
	const featureStart = blackoutExpansion.book.events.find(({ type }) => type === 'feature_start');
	const expansion = blackoutExpansion.book.events.find(({ type }) => type === 'expansion_applied');
	assert.equal(featureStart.target_symbol, 'ten');
	assert.equal(expansion.target_symbol, featureStart.target_symbol);
	assert.equal(getPresentationFixture('not_a_purpose'), null);
});

test('player rules are mechanically identical to the v3 math registry', () => {
	const paytable = JSON.parse(readFileSync(
		join(repoRoot, 'math/games/blacksite_breach/config/paytable.json'), 'utf8',
	));
	const mechanics = JSON.parse(readFileSync(
		join(repoRoot, 'math/games/blacksite_breach/config/mechanics.json'), 'utf8',
	));
	const modeRegistry = JSON.parse(readFileSync(
		join(repoRoot, 'math/games/blacksite_breach/config/mode_registry.json'), 'utf8',
	));

	assert.deepEqual(SYMBOL_PAYOUTS, paytable.symbols);
	assert.deepEqual(LINE_PAYTABLE_RAW, Object.fromEntries(
		Object.entries(paytable.symbols).map(([symbol, awards]) => [
			symbol,
			{ 3: awards[0], 4: awards[1], 5: awards[2] },
		]),
	));
	assert.deepEqual(RULES_CONTRACT.board, {
		columns: mechanics.board.columns,
		rows: mechanics.board.rows,
		paylines: mechanics.paylines.length,
		direction: 'left-to-right',
		minimumMatch: mechanics.board.minimum_match,
	});
	assert.deepEqual(PAYLINES, mechanics.paylines.map(({ rows }) => rows));
	assert.equal(RULES_CONTRACT.wildSymbol, mechanics.wild.symbol);
	assert.equal(RULES_CONTRACT.featureSymbol, mechanics.trigger.symbol);
	assert.equal(RULES_CONTRACT.initialFeatureSpins, mechanics.feature.free_spins);
	assert.equal(RULES_CONTRACT.featureRetrigger, mechanics.feature.retrigger);
	assert.deepEqual(RULES_CONTRACT.quickStart.map(({ title }) => title), [
		'MATCH 3+', 'GHOST WILD', 'TRIGGER BLACKOUT',
	]);
	assert.match(RULES_CONTRACT.feature.join(' '), /exactly eight free spins/i);
	assert.match(RULES_CONTRACT.feature.join(' '), /cannot retrigger/i);

	for (const mode of MODES) {
		const mathMode = modeRegistry.modes.find(({ name }) => name === mode.id);
		assert(mathMode, `missing math mode ${mode.id}`);
		assert.equal(mode.costMultiplier, mathMode.cost);
		assert.deepEqual(mode.guaranteedBreachPositions, mathMode.guaranteed_breach_positions);
		assert.equal(mode.directFeature, mathMode.direct_feature);
		assert.equal(mode.isBuyBonus, mathMode.is_buybonus);
	}

	const playerVisibleSocialCopy = [
		...RULES_CONTRACT.quickStart.flatMap(({ title, copy }) => [title, copy]),
		...RULES_CONTRACT.specialSymbols.flatMap(({ label, copy }) => [label, copy]),
		...RULES_CONTRACT.mechanic,
		...RULES_CONTRACT.feature,
		...RULES_CONTRACT.controls,
		...Object.values(getRulesInterfaceCopy(true)),
		getRulesDisclaimer(true),
		...RULES_CONTRACT.modes.flatMap((mode) => [
			mode.socialLabel,
			getModeActionDescription(mode.id, true),
		]),
	].join(' ');
	assert.deepEqual(playerVisibleRestrictedHits(playerVisibleSocialCopy), []);
	assert.equal(getRulesInterfaceCopy(false), RULES_INTERFACE_COPY.normal);
	assert.equal(getRulesInterfaceCopy(true), RULES_INTERFACE_COPY.social);
	assert.equal(RULES_INTERFACE_COPY.normal.amountLabel, 'BET');
	assert.equal(RULES_INTERFACE_COPY.normal.resultHeading, 'PAYOUTS / CONSECUTIVE SYMBOLS / BET MULTIPLIER');
	assert.equal(RULES_INTERFACE_COPY.social.amountLabel, 'PLAY AMOUNT');
	assert.deepEqual(playerVisibleRestrictedHits(Object.values(RULES_INTERFACE_COPY.social).join(' ')), []);
});

test('launch parser remains fail-closed for live, fixture and replay surfaces', () => {
	assert.equal(resolveLaunchMode('', { dev: false }).code, 'RGS_URL_MISSING');
	assert.equal(resolveLaunchMode('?rgs_url=not%20a%20url').code, 'RGS_URL_INVALID');
	assert.equal(resolveLaunchMode('?dev_fixture=base_zero', { dev: true }).kind, 'fixture');
	assert.equal(resolveLaunchMode('?dev_fixture=base_zero', { dev: false }).code, 'DEV_FIXTURE_FORBIDDEN');
	const live = resolveLaunchMode(
		'?sessionID=stake-session&rgs_url=rgsd.stake-engine.com&currency=USD&lang=en&device=desktop',
	);
	assert.equal(live.kind, 'live');
	assert.equal(live.rgsUrl, 'https://rgsd.stake-engine.com');
	assert.equal(resolveLaunchMode(
		'?sessionID=stake-session&rgs_url=rgsd.stake-engine.com&currency=EUR&lang=de-DE&device=mobile',
	).language, 'de');
	assert.equal(resolveLaunchMode(
		'?sessionID=stake-session&rgs_url=rgsd.stake-engine.com&currency=EUR&lang=fr-FR&device=mobile',
	).language, 'en');
	assert.equal(resolveLaunchMode('?replay=true').code, 'REPLAY_QUERY_INVALID');
	const replay = resolveLaunchMode(
		'?replay=true&game=blacksite_breach&version=0.3.0-math-v3&mode=base&event=1' +
		'&rgs_url=https%3A%2F%2Frgs.example&currency=xsc&amount=0.0496&social=true',
	);
	assert.equal(replay.kind, 'replay');
	assert.equal(replay.version, '0.3.0-math-v3');
	assert.equal(replay.amountUnitsRaw, '0.0496');
	assert.equal(replay.social, true);
});

test('adapter accepts canonical zero, line, natural-feature, direct-feature, expansion and cap books', () => {
	const cases = [
		['base_zero', ['round_started', 'board_snapshot', 'settled']],
		['base_classic_line_win', ['round_started', 'board_snapshot', 'win', 'settled']],
		['base_natural_blackout', null],
		['blackout_direct_entry', null],
		['base_expanding_breach', null],
		['base_max_win', null],
	];
	for (const [fixtureId, exactKinds] of cases) {
		const book = bookForFixture(fixtureId);
		const cues = adapt(book);
		if (exactKinds) assert.deepEqual(cues.map(({ kind }) => kind), exactKinds);
		assert.equal(cues.at(-1).kind, 'settled');
		assert.equal(cues.at(-1).event.payout_multiplier_raw, book.payoutMultiplier);
	}
	const naturalKinds = adapt(bookForFixture('base_natural_blackout')).map(({ kind }) => kind);
	assert.equal(naturalKinds.filter((kind) => kind === 'feature_armed').length, 1);
	assert.equal(naturalKinds.filter((kind) => kind === 'feature_started').length, 1);
	assert.equal(naturalKinds.filter((kind) => kind === 'feature_cycle').length, 8);
});

test('payline evaluation is left-to-right, resolves WILD deterministically, self-pays WILD and never substitutes BREACH', () => {
	const empty = clone(BASE_ZERO_FIXTURE.book.events[1].board);
	assert.deepEqual(evaluatePaylines(empty), []);

	const mixed = clone(empty);
	mixed[0][1] = WILD_SYMBOL;
	mixed[1][1] = WILD_SYMBOL;
	mixed[2][1] = WILD_SYMBOL;
	mixed[3][1] = 'q';
	mixed[4][1] = TRIGGER_SYMBOL;
	const wildWinThree = evaluatePaylines(mixed).find(({ line_id }) => line_id === 0);
	assert.deepEqual(wildWinThree, {
		line_id: 0,
		symbol: 'ghost_wild',
		match_count: 3,
		positions: [{ column: 0, row: 1 }, { column: 1, row: 1 }, { column: 2, row: 1 }],
		wild_positions: [{ column: 0, row: 1 }, { column: 1, row: 1 }, { column: 2, row: 1 }],
		base_payout_raw: 100,
	});

	const wildOnly = clone(empty);
	for (let column = 0; column < 5; column += 1) wildOnly[column][1] = WILD_SYMBOL;
	const wildWin = evaluatePaylines(wildOnly).find(({ line_id }) => line_id === 0);
	assert.equal(wildWin.symbol, WILD_SYMBOL);
	assert.equal(wildWin.match_count, 5);
	assert.equal(wildWin.base_payout_raw, 125_000);

	const rightOnly = clone(empty);
	rightOnly[0][1] = 'operative';
	rightOnly[1][1] = 'encrypted_drive';
	for (let column = 2; column < 5; column += 1) rightOnly[column][1] = 'supply_crate';
	assert.equal(evaluatePaylines(rightOnly).some(({ symbol }) => symbol === 'supply_crate'), false);
});

test('v3 line fixture matrix covers every paying symbol at three, four and five matches', () => {
	for (const symbol of PAYING_SYMBOLS) {
		for (const matchCount of [3, 4, 5]) {
			const board = clone([
				['a', 'k', 'q'],
				['k', 'q', 'j'],
				['q', 'j', 'ten'],
				['j', 'ten', 'a'],
				['ten', 'a', 'k'],
			]);
			for (let column = 0; column < matchCount; column += 1) board[column][1] = symbol;
			const neutral = symbol === WILD_SYMBOL
				? TRIGGER_SYMBOL
				: REGULAR_SYMBOLS.find((candidate) => candidate !== symbol);
			for (let column = matchCount; column < 5; column += 1) board[column][1] = neutral;
			const lineZero = evaluatePaylines(board).find(({ line_id }) => line_id === 0);
			assert(lineZero, `${symbol} x${matchCount} must pay line zero`);
			assert.equal(lineZero.symbol, symbol, `${symbol} x${matchCount} identity`);
			assert.equal(lineZero.match_count, matchCount, `${symbol} x${matchCount} length`);
			assert.equal(
				lineZero.base_payout_raw,
				LINE_PAYTABLE_RAW[symbol][matchCount],
				`${symbol} x${matchCount} award`,
			);
			assert.deepEqual(
				lineZero.positions,
				Array.from({ length: matchCount }, (_, column) => ({ column, row: 1 })),
			);
		}
	}
});

test('expansion replaces every cell on target reels before authoritative line evaluation', () => {
	const board = [
		['operative', 'encrypted_drive', 'tactical_radio'],
		['classified_folder', 'operative', 'night_vision_goggles'],
		['supply_crate', 'encrypted_drive', 'operative'],
		['tactical_radio', 'operative', 'classified_folder'],
		['encrypted_drive', 'night_vision_goggles', 'operative'],
	];
	const { evaluatedBoard, expandedReels } = expandTargetBoard(board, 'operative');
	assert.deepEqual(expandedReels, [0, 1, 2, 3, 4]);
	assert(evaluatedBoard.every((reel) => reel.every((symbol) => symbol === 'operative')));
	assert.notDeepEqual(evaluatedBoard, board);
	assert.throws(() => expandTargetBoard(board, WILD_SYMBOL), /invalid feature target/);
});

test('v3 expansion fixture matrix accepts each of the eleven regular targets only', () => {
	for (const target of REGULAR_SYMBOLS) {
		const fillers = REGULAR_SYMBOLS.filter((symbol) => symbol !== target);
		const board = Array.from({ length: 5 }, (_, column) => [
			fillers[column % fillers.length],
			column % 2 === 0 ? target : fillers[(column + 1) % fillers.length],
			fillers[(column + 2) % fillers.length],
		]);
		const result = expandTargetBoard(board, target);
		assert.deepEqual(result.expandedReels, [0, 2, 4], target);
		for (const column of result.expandedReels) {
			assert.deepEqual(result.evaluatedBoard[column], [target, target, target], target);
		}
	}
	for (const invalid of [WILD_SYMBOL, TRIGGER_SYMBOL, 'byte', null]) {
		assert.throws(() => expandTargetBoard(BASE_ZERO_FIXTURE.book.events[1].board, invalid), /invalid feature target/);
	}
});

test('closed-schema adapter rejects unknown fields, indices, shape, symbols and payout identity', () => {
	const extra = clone(BASE_ZERO_FIXTURE.book);
	extra.events[0].unexpected = true;
	assert.throws(() => adapt(extra), /closed record/);

	const brokenIndex = clone(BASE_ZERO_FIXTURE.book);
	brokenIndex.events[1].index = 7;
	assert.throws(() => adapt(brokenIndex), /contiguous/);

	const shortBoard = clone(BASE_ZERO_FIXTURE.book);
	shortBoard.events[1].board.pop();
	assert.throws(() => adapt(shortBoard), /exactly 5 reels/);

	const tallReel = clone(BASE_ZERO_FIXTURE.book);
	tallReel.events[1].board[0].push('operative');
	assert.throws(() => adapt(tallReel), /exactly 3 rows/);

	const unknown = clone(BASE_ZERO_FIXTURE.book);
	unknown.events[1].board[0][0] = 'unknown_symbol';
	assert.throws(() => adapt(unknown), /invalid symbol/);

	const duplicateBreach = clone(BASE_ZERO_FIXTURE.book);
	duplicateBreach.events[1].board[0] = [TRIGGER_SYMBOL, TRIGGER_SYMBOL, 'operative'];
	assert.throws(() => adapt(duplicateBreach), /more than one BREACH/);

	const payoutMismatch = clone(BASE_ZERO_FIXTURE.book);
	payoutMismatch.payoutMultiplier = 1;
	assert.throws(() => adapt(payoutMismatch), /book and round_end payout/);
});

test('line_win rejects forged line, WILD, formula, completeness, order and cumulative fields', () => {
	const fixtureId = 'base_classic_line_win';
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins[0].line_id = 10;
	}, /line_id is unknown/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins[0].positions[0].row = 2;
	}, /contradicts the evaluated reel window/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins[0].wild_positions = [findEvent(book, 'line_win').wins[0].positions[0]];
	}, /contradicts the evaluated reel window/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins[0].base_payout_raw += 1;
	}, /contradicts the evaluated reel window/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins.pop();
	}, /every and only canonical winning line/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').wins.reverse();
	}, /contradicts the evaluated reel window/);
	rejectMutation(fixtureId, (book) => {
		findEvent(book, 'line_win').cumulative_after_raw += 1;
	}, /totals do not reconcile/);
});

test('feature grammar rejects forged BREACH triggers, counters, expansion and terminal state', () => {
	rejectMutation('base_natural_blackout', (book) => {
		findEvent(book, 'feature_trigger').positions.pop();
	}, /does not match distinct BREACH reels/);
	rejectMutation('base_natural_blackout', (book) => {
		findEvent(book, 'feature_trigger').awarded_free_spins = 7;
	}, /does not match distinct BREACH reels/);
	rejectMutation('base_natural_blackout', (book) => {
		findEvent(book, 'free_spin_start').remaining_after_current = 99;
	}, /free-spin counter is not contiguous/);
	rejectMutation('base_expanding_breach', (book) => {
		findEvent(book, 'expansion_applied').evaluated_board[0][0] = 'supply_crate';
	}, /expansion_applied contradicts .*original feature board/);
	rejectMutation('blackout_direct_entry', (book) => {
		findEvent(book, 'feature_start').direct = false;
	}, /feature_start contradicts the canonical BLACKOUT feature/);
	rejectMutation('base_natural_blackout', (book) => {
		findEvent(book, 'feature_end').spins_played = 7;
	}, /feature_end counters or payout are inconsistent/);
});

test('complete-round cap clips a canonical line and terminates without feature_end', () => {
	const book = bookForFixture('base_max_win');
	const line = findEvent(book, 'line_win');
	const cap = findEvent(book, 'cap_reached');
	assert.equal(line.cumulative_after_raw, 1_000_000);
	assert.equal(line.cap_applied, true);
	assert(line.wins.some((win) => win.applied_award_raw < win.calculated_award_raw));
	assert.equal(book.events.some(({ type }) => type === 'feature_end'), false);
	assert.equal(cap.discarded_award_raw, cap.gross_award_raw - cap.accepted_award_raw);

	rejectMutation('base_max_win', (mutated) => {
		findEvent(mutated, 'cap_reached').discarded_award_raw += 1;
	}, /cap_reached does not reconcile/);
});

test('PresentationDirector preserves authoritative reels, lines, WILD positions, expansion and free-spin counters', () => {
	const book = bookForFixture('base_expanding_breach');
	const cues = adapt(book);
	const director = new PresentationDirector();
	const featureCycles = [];
	for (const cue of cues) {
		director.consume(cue);
		assert.equal(director.state.lastEventIndex, cue.eventIndex);
		if (cue.kind === 'feature_started') {
			assert.equal(director.state.freeSpinIndex, 0);
			assert.equal(director.state.totalFreeSpins, 8);
			assert.equal(director.state.remainingFreeSpins, 8);
		}
		if (cue.kind === 'board_snapshot') {
			assert.equal(director.state.board, cue.event.board);
			assert.equal(director.state.board.length, 5);
			assert(director.state.board.every((reel) => reel.length === 3));
		}
		if (cue.kind === 'expansion') {
			assert.equal(director.state.evaluatedBoard, cue.event.evaluated_board);
			assert.equal(director.state.featureTarget, cue.event.target_symbol);
		}
		if (cue.kind === 'win') {
			assert.equal(director.state.activeLines, cue.event.wins);
			assert.equal(director.state.stepWinRaw, cue.event.step_payout_raw);
			for (const win of director.state.activeLines) {
				assert(win.positions.length >= 3 && win.positions.length <= 5);
				assert(win.wild_positions.every((position) =>
					win.positions.some((candidate) => candidate.column === position.column && candidate.row === position.row)));
			}
		}
		if (cue.kind === 'feature_cycle') {
			assert.equal(director.state.totalFreeSpins, 8);
			assert.equal(director.state.remainingFreeSpins, 8 - director.state.freeSpinIndex);
			featureCycles.push({
				index: director.state.freeSpinIndex,
				total: director.state.totalFreeSpins,
				remaining: director.state.remainingFreeSpins,
			});
		}
	}
	assert.deepEqual(featureCycles[0], { index: 1, total: 8, remaining: 7 });
	assert.deepEqual(featureCycles.at(-1), { index: 8, total: 8, remaining: 0 });
	assert.equal(director.state.finalWinRaw, book.payoutMultiplier);
});

test('restore planning primes v3 feature state and resumes at the exact next event', () => {
	const cues = adapt(bookForFixture('base_natural_blackout'));
	const cursor = cues.find(({ kind }) => kind === 'feature_cycle').eventIndex + 1;
	const plan = planPresentationRestore(cues, cursor);
	assert.equal(plan.primeCues.length, cursor);
	assert.equal(plan.resumeCues[0].eventIndex, cursor);
	const director = new PresentationDirector();
	for (const cue of plan.primeCues) director.consume(cue);
	assert.equal(director.state.freeSpinIndex, 1);
	assert.equal(director.state.totalFreeSpins, 8);
	assert.equal(director.state.status, 'presenting');
	for (const cue of plan.resumeCues) director.consume(cue);
	assert.equal(director.state.status, 'complete');
});

test('initial presentation state carries no local board, line or settlement authority', () => {
	const initial = createInitialPresentationState();
	assert.equal(initial.board, null);
	assert.equal(initial.evaluatedBoard, null);
	assert.deepEqual(initial.activeLines, []);
	assert.equal(initial.finalWinRaw, null);
	assert.equal(initial.freeSpinIndex, 0);
	assert.equal(Object.isFrozen(initial), true);
	assert.deepEqual(new Set(ALL_SYMBOLS), new Set([
		...REGULAR_SYMBOLS, WILD_SYMBOL, TRIGGER_SYMBOL,
	]));
});
