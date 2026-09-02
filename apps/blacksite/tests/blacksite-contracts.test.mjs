import assert from 'node:assert/strict';
import { createReadStream, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createZstdDecompress } from 'node:zlib';
import {
	CANDIDATE_FINGERPRINT_SHA256,
	EVENT_SCHEMA_SHA256,
	MODES,
} from '../src/lib/contracts/modes.js';
import {
	CLUSTER_BANDS,
	CONTROL_GUIDE,
	RULES_CONTRACT,
	SYMBOL_PAYOUTS,
	getRulesDisclaimer,
} from '../src/lib/contracts/rules.js';
import { BASE_ZERO_FIXTURE } from '../src/lib/fixtures/base-zero.js';
import {
	FIXTURES as GENERATED_FIXTURES,
	FIXTURE_IDS as GENERATED_FIXTURE_IDS,
} from '../src/lib/fixtures/catalog.generated.js';
import {
	ContractViolation,
	GameEventAdapter,
} from '../src/lib/runtime/game-event-adapter.js';
import { resolveLaunchMode } from '../src/lib/runtime/launch-mode.js';
import {
	PRESENTATION_TIMINGS,
	PresentationDirector,
	createInitialPresentationState,
	planPresentationRestore,
} from '../src/lib/runtime/presentation-director.js';
import { playerVisibleRestrictedHits } from 'utils-shared/stake-social.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function cloneFixtureBook() {
	return structuredClone(BASE_ZERO_FIXTURE.book);
}

async function readPublishedBaseBookOne() {
	const source = createReadStream(
		join(
			repoRoot,
			'math/games/blacksite_breach/library/books_compressed/base_books.jsonl.zst',
		),
	).pipe(createZstdDecompress());
	const lines = createInterface({ input: source, crlfDelay: Infinity });
	for await (const line of lines) {
		return JSON.parse(line);
	}
	throw new Error('Published base book file is empty');
}

test('canonical modes and final M1 identities are frozen in the app boundary', () => {
	assert.deepEqual(
		MODES.map(({ id, costMultiplier, normalLabel, socialLabel, isBuyBonus }) => ({
			id,
			costMultiplier,
			normalLabel,
			socialLabel,
			isBuyBonus,
		})),
		[
			{
				id: 'base',
				costMultiplier: 1,
				normalLabel: 'BREACH RUN',
				socialLabel: 'STANDARD RUN',
				isBuyBonus: false,
			},
			{
				id: 'deep_access',
				costMultiplier: 4,
				normalLabel: 'DEEP ACCESS',
				socialLabel: 'DEEP ACCESS',
				isBuyBonus: true,
			},
			{
				id: 'blackout',
				costMultiplier: 80,
				normalLabel: 'BLACKOUT PROTOCOL',
				socialLabel: 'BLACKOUT ENTRY',
				isBuyBonus: true,
			},
		],
	);
	const verification = JSON.parse(
		readFileSync(
			join(
				repoRoot,
				'math/games/blacksite_breach/library/publish_files/VERIFY_RESULT.json',
			),
			'utf8',
		),
	);
	assert.equal(verification.candidate_fingerprint_sha256, CANDIDATE_FINGERPRINT_SHA256);
	assert.equal(verification.canonical_event_schema_sha256, EVENT_SCHEMA_SHA256);
	assert.equal(verification.all_gates_passed, true);
});

test('base_zero is byte-content-equivalent to final published base book 1', async () => {
	const published = await readPublishedBaseBookOne();
	assert.deepEqual(BASE_ZERO_FIXTURE.book, published);
	assert.equal(BASE_ZERO_FIXTURE.candidateFingerprint, CANDIDATE_FINGERPRINT_SHA256);
	assert.equal(BASE_ZERO_FIXTURE.eventSchemaSha256, EVENT_SCHEMA_SHA256);
});

test('development catalog exposes all 48 M1-backed deterministic fixtures', () => {
	const fixtureIndex = JSON.parse(
		readFileSync(
			join(
				repoRoot,
				'math/games/blacksite_breach/library/publish_files/FIXTURE_INDEX.json',
			),
			'utf8',
		),
	);
	assert.equal(GENERATED_FIXTURES.length, 48);
	assert.deepEqual(GENERATED_FIXTURE_IDS, Object.keys(fixtureIndex.fixtures));
	for (const fixture of GENERATED_FIXTURES) {
		const indexed = fixtureIndex.fixtures[fixture.id];
		assert.equal(fixture.book.id, indexed.book_id);
		assert.equal(fixture.book.payoutMultiplier, indexed.payout_raw);
		assert.equal(fixture.mode, indexed.mode);
		assert(Object.isFrozen(fixture.book));
		new GameEventAdapter().adaptBook(fixture.book, { expectedMode: fixture.mode });
	}
});

test('player rules are mechanically identical to the frozen math registry', () => {
	const paytable = JSON.parse(
		readFileSync(join(repoRoot, 'math/games/blacksite_breach/config/paytable.json'), 'utf8'),
	);
	const mechanics = JSON.parse(
		readFileSync(join(repoRoot, 'math/games/blacksite_breach/config/mechanics.json'), 'utf8'),
	);
	const modeRegistry = JSON.parse(
		readFileSync(join(repoRoot, 'math/games/blacksite_breach/config/mode_registry.json'), 'utf8'),
	);
	assert.deepEqual(
		CLUSTER_BANDS.map((band) => band.id),
		paytable.cluster_bands,
	);
	assert.deepEqual(SYMBOL_PAYOUTS, paytable.symbols);
	assert.equal(RULES_CONTRACT.board.columns, mechanics.board.columns);
	assert.equal(RULES_CONTRACT.board.rows, mechanics.board.rows);
	assert.equal(RULES_CONTRACT.board.minimumCluster, mechanics.board.minimum_cluster_size);
	assert.deepEqual(
		RULES_CONTRACT.featureMultipliers,
		mechanics.access.feature_linked_multiplier_by_reached_port_count,
	);
	assert.equal(
		RULES_CONTRACT.maximumFeatureCycles,
		mechanics.feature.maximum_cycles,
	);
	for (const mode of MODES) {
		const mathMode = modeRegistry.modes.find(({ name }) => name === mode.id);
		assert(mathMode, `missing frozen math mode ${mode.id}`);
		assert.deepEqual(mode.seedBreachedCells, mathMode.seed_breached_cells);
		assert.deepEqual(mode.seedLiveCells, mathMode.seed_live_cells);
		assert.equal(mode.startingAccessMultiplier, mathMode.starting_access_multiplier);
		assert.equal(mode.initialPhase, mathMode.direct_feature ? 'feature' : 'base');
	}
	const playerVisibleSocialCopy = [
		...RULES_CONTRACT.mechanic,
		...RULES_CONTRACT.feature,
		...RULES_CONTRACT.controls,
		getRulesDisclaimer(true),
		...RULES_CONTRACT.modes.map((mode) => mode.socialLabel),
	].join(' ');
	assert.deepEqual(playerVisibleRestrictedHits(playerVisibleSocialCopy), []);
});

test('Game Information maps every versioned control and input method', () => {
	assert.deepEqual(
		CONTROL_GUIDE.map(({ key }) => key),
		[
			'input-methods',
			'sound',
			'mode-select',
			'play-amount',
			'presentation-speed',
			'skip',
			'primary-action',
			'confirmation',
			'info-rules',
			'close-rules',
		],
	);
	assert.equal(new Set(CONTROL_GUIDE.map(({ key }) => key)).size, CONTROL_GUIDE.length);
	assert.deepEqual(RULES_CONTRACT.controls, CONTROL_GUIDE.map(({ description }) => description));
	const guideText = CONTROL_GUIDE.map(({ label, description }) => `${label}: ${description}`).join(' ');
	for (const requiredTerm of [
		'pointer', 'touch', 'keyboard', 'Space', 'Escape', 'SOUND', 'TURBO', 'SKIP',
		'CONFIRM', 'CANCEL', 'INFO / RULES',
	]) {
		assert.match(guideText, new RegExp(requiredTerm, 'iu'));
	}
});

test('launch parser fails paid live play closed and never promotes fixtures in production', () => {
	assert.deepEqual(resolveLaunchMode('', { dev: false }), {
		kind: 'error',
		code: 'RGS_URL_MISSING',
		message: 'Live launch requires rgs_url. No local game was started.',
		surface: 'live',
	});
	assert.equal(resolveLaunchMode('?rgs_url=not-a-url').code, 'RGS_URL_INVALID');
	assert.deepEqual(resolveLaunchMode('?dev_fixture=base_zero', { dev: true }), {
		kind: 'fixture',
		fixtureId: 'base_zero',
	});
	assert.equal(
		resolveLaunchMode('?dev_fixture=base_zero', { dev: false }).code,
		'DEV_FIXTURE_FORBIDDEN',
	);
	assert.equal(
		resolveLaunchMode('?rgs_url=https%3A%2F%2Frgs.example%2F').code,
		'LIVE_QUERY_INVALID',
	);
	assert.deepEqual(resolveLaunchMode(
		'?sessionID=live-session&rgs_url=https%3A%2F%2Frgs.example%2F' +
			'&currency=xsc&lang=en&device=mobile&social=true',
	), {
		kind: 'live',
		rgsUrl: 'https://rgs.example',
		sessionId: 'live-session',
		language: 'en',
		currency: 'XSC',
		device: 'mobile',
		social: true,
	});
	assert.equal(
		resolveLaunchMode(
			'?sessionID=s&rgs_url=https%3A%2F%2Frgs.example%2Fbase%3Fx%3D1' +
				'&currency=USD&lang=en&device=desktop',
		).code,
		'RGS_URL_INVALID',
	);
});

test('Replay identity and optional values are parsed separately without inventing units', () => {
	assert.equal(resolveLaunchMode('?replay=true').code, 'REPLAY_QUERY_INVALID');
	const replay = resolveLaunchMode(
		'?replay=true&game=blacksite_breach&version=0.1.0-m1&mode=base&event=1' +
			'&rgs_url=https%3A%2F%2Frgs.example&currency=xsc&amount=0.0496' +
			'&lang=de-DE&device=tablet&social=true',
	);
	assert.deepEqual(replay, {
		kind: 'replay',
		game: 'blacksite_breach',
		version: '0.1.0-m1',
		mode: 'base',
		event: '1',
		rgsUrl: 'https://rgs.example',
		currency: 'XSC',
		amountUnitsRaw: '0.0496',
		language: 'en',
		device: 'tablet',
		social: true,
	});
	assert.equal(
		resolveLaunchMode(
			'?replay=true&game=blacksite_breach&version=1&mode=base&event=0' +
				'&rgs_url=https%3A%2F%2Frgs.example&amount=1e6',
		).code,
		'REPLAY_QUERY_INVALID',
	);
});

test('closed-schema adapter accepts the published zero book without deriving payout', () => {
	const cues = new GameEventAdapter().adaptBook(BASE_ZERO_FIXTURE.book, {
		expectedMode: 'base',
	});
	assert.deepEqual(
		cues.map((cue) => cue.kind),
		['round_started', 'board_snapshot', 'settled'],
	);
	assert.equal(cues.at(-1).event.payout_multiplier_raw, 0);
	assert.equal(cues.at(-1).event.payout_multiplier_raw, BASE_ZERO_FIXTURE.book.payoutMultiplier);
	assert.deepEqual(
		new GameEventAdapter().adaptRoundEvents(BASE_ZERO_FIXTURE.book.events, {
			expectedMode: 'base',
			expectedPayoutRaw: 0,
		}),
		cues,
	);
});

test('closed-schema adapter rejects unknown fields, broken indices, boards and payout identity', () => {
	const extraField = cloneFixtureBook();
	extraField.events[0].unexpected = true;
	assert.throws(() => new GameEventAdapter().adaptBook(extraField), ContractViolation);

	const brokenIndex = cloneFixtureBook();
	brokenIndex.events[1].index = 7;
	assert.throws(() => new GameEventAdapter().adaptBook(brokenIndex), /contiguous/);

	const brokenBoard = cloneFixtureBook();
	brokenBoard.events[1].board[0][0] = 'unknown_symbol';
	assert.throws(() => new GameEventAdapter().adaptBook(brokenBoard), /invalid symbol/);

	const payoutConflict = cloneFixtureBook();
	payoutConflict.events[2].payout_multiplier_raw = 1;
	assert.throws(() => new GameEventAdapter().adaptBook(payoutConflict), /payout centi-x mismatch/);
});

test('cluster_win rejects every locally checkable frozen payout invariant', () => {
	const cloneWinningBook = (fixtureId = 'base_win_01') => {
		const fixture = GENERATED_FIXTURES.find(({ id }) => id === fixtureId);
		assert(fixture, `missing generated fixture ${fixtureId}`);
		return structuredClone(fixture.book);
	};
	const firstWin = (book) => {
		const event = book.events.find(({ type }) => type === 'cluster_win');
		assert(event, 'fixture must contain a cluster_win');
		return event;
	};
	const rejectMutation = (mutate, expectation, fixtureId = 'base_win_01') => {
		const book = cloneWinningBook(fixtureId);
		mutate(firstWin(book), book);
		assert.throws(() => new GameEventAdapter().adaptBook(book), expectation);
	};

	rejectMutation((win) => {
		win.clusters[0].cluster_band = 'cluster_unknown';
	}, /canonical paytable band/);
	rejectMutation((win) => {
		win.clusters[0].cluster_band = CLUSTER_BANDS.find(
			({ id }) => id !== win.clusters[0].cluster_band,
		).id;
	}, /outside its paytable band/);
	rejectMutation((win) => {
		win.clusters[0].base_payout_raw += 1;
	}, /paytable band value/);
	rejectMutation((win) => {
		win.clusters[0].calculated_award_raw += 1;
	}, /must equal base payout times access/);
	rejectMutation((win) => {
		win.clusters[0].applied_award_raw += 1;
	}, /remaining cap/);
	rejectMutation((win) => {
		win.step_payout_raw += 1;
	}, /sum of applied awards/);
	rejectMutation((win) => {
		win.cumulative_after_raw += 1;
	}, /must equal cumulative_before_raw plus step payout/);
	rejectMutation((win) => {
		win.cap_applied = !win.cap_applied;
	}, /does not match clipped cluster awards/);
	rejectMutation((win) => {
		win.cumulative_before_raw += 1;
		win.cumulative_after_raw += 1;
	}, /breaks round continuity/);
	rejectMutation((win, book) => {
		const cluster = win.clusters[0];
		const occupied = new Set(cluster.positions.map(({ column, row }) => `${column},${row}`));
		const board = book.events[win.index - 1].board;
		let replacement = null;
		for (let column = 0; column < 7 && replacement === null; column += 1) {
			for (let row = 0; row < 7; row += 1) {
				if (!occupied.has(`${column},${row}`) && board[column][row] !== cluster.symbol) {
					replacement = { column, row };
					break;
				}
			}
		}
		assert(replacement, 'fixture needs a non-component replacement cell');
		cluster.positions[0] = replacement;
	}, /exact board flood-fill component/);
	rejectMutation((win) => {
		assert.equal(win.clusters[0].symbol, 'proxy');
		assert.equal(win.clusters[0].cluster_band, 'cluster_24_31');
		win.clusters[0].symbol = 'cipher';
	}, /exact board flood-fill component/, 'base_win_02');

	const overlappingBook = cloneWinningBook('base_simultaneous_two_clusters');
	const overlappingWin = overlappingBook.events.find(
		(event) => event.type === 'cluster_win' && event.clusters.length === 2,
	);
	assert(overlappingWin, 'fixture needs two simultaneous clusters');
	assert.equal(overlappingWin.clusters.length, 2);
	overlappingWin.clusters[1].positions[0] = structuredClone(
		overlappingWin.clusters[0].positions[0],
	);
	assert.throws(
		() => new GameEventAdapter().adaptBook(overlappingBook),
		/simultaneous clusters overlap/,
	);

	const linkedBook = cloneWinningBook('base_medium');
	const linkedWin = linkedBook.events.find(
		(event) => event.type === 'cluster_win' && event.clusters.some((cluster) => cluster.linked),
	);
	assert(linkedWin, 'fixture needs a route-linked cluster');
	const linkedCluster = linkedWin.clusters.find((cluster) => cluster.linked);
	linkedCluster.linked = false;
	assert.throws(
		() => new GameEventAdapter().adaptBook(linkedBook),
		/linked does not match the latest route/,
	);

	const accessBook = cloneWinningBook('base_medium');
	const accessWin = accessBook.events.find(
		(event) => event.type === 'cluster_win' && event.clusters.some(
			(cluster) => cluster.linked && cluster.access_multiplier > 1,
		),
	);
	assert(accessWin, 'fixture needs a multiplied route-linked cluster');
	const precedingRoute = accessBook.events
		.slice(0, accessWin.index)
		.reverse()
		.find((event) => event.type === 'breach_state');
	assert(precedingRoute, 'linked cluster needs preceding route authority');
	precedingRoute.current_access_multiplier = precedingRoute.current_access_multiplier === 3 ? 2 : 3;
	assert.throws(
		() => new GameEventAdapter().adaptBook(accessBook),
		/access_multiplier does not match linked route authority/,
	);

	const cascadeBook = cloneWinningBook('base_cascade_3');
	const cascadeWins = cascadeBook.events.filter(({ type }) => type === 'cluster_win');
	assert(cascadeWins.length >= 2);
	cascadeWins[1].cumulative_before_raw += 1;
	cascadeWins[1].cumulative_after_raw += 1;
	assert.throws(
		() => new GameEventAdapter().adaptBook(cascadeBook),
		/breaks round continuity/,
	);

	const breachBook = cloneWinningBook();
	const breachWin = firstWin(breachBook);
	breachBook.events[breachWin.index + 1].cumulative_payout_raw += 1;
	assert.throws(
		() => new GameEventAdapter().adaptBook(breachBook),
		/does not match preceding cluster_win/,
	);

	const finalBook = cloneWinningBook();
	finalBook.payoutMultiplier += 1;
	finalBook.events.at(-1).payout_multiplier_raw += 1;
	assert.throws(
		() => new GameEventAdapter().adaptBook(finalBook),
		/round_end payout does not match cluster_win cumulative total/,
	);

	const cappedBook = cloneWinningBook('base_max_win');
	const cappedWin = cappedBook.events.find(
		(event) => event.type === 'cluster_win' && event.cap_applied,
	);
	assert(cappedWin, 'max-win fixture must contain a cap-applied cluster_win');
	const clippedCluster = cappedWin.clusters.find(
		(cluster) => cluster.applied_award_raw < cluster.calculated_award_raw,
	);
	assert(clippedCluster, 'max-win fixture must contain a clipped cluster award');
	clippedCluster.applied_award_raw = clippedCluster.calculated_award_raw;
	assert.throws(
		() => new GameEventAdapter().adaptBook(cappedBook),
		/remaining cap/,
	);
});

test('closed-schema adapter rejects truncated and out-of-order round lifecycles', () => {
	const adapter = new GameEventAdapter();
	const reindex = (events) => events.map((event, index) => ({ ...structuredClone(event), index }));
	const blackoutFixture = GENERATED_FIXTURES.find(({ id }) => id === 'blackout_zero');
	const deepAccessFixture = GENERATED_FIXTURES.find(({ id }) => id === 'deep_access_zero');
	const baseWinFixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_win_01');
	const baseRouteFixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_route_tease');
	const baseMaxFixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_max_win');
	assert(blackoutFixture, 'missing blackout_zero fixture');
	assert(deepAccessFixture, 'missing deep_access_zero fixture');
	assert(baseWinFixture, 'missing base_win_01 fixture');
	assert(baseRouteFixture, 'missing base_route_tease fixture');
	assert(baseMaxFixture, 'missing base_max_win fixture');

	const missingSeedMetadata = structuredClone(deepAccessFixture.book);
	missingSeedMetadata.events[0].seeded_breached_cells = [];
	missingSeedMetadata.events[0].seeded_live_cells = [];
	assert.throws(
		() => adapter.adaptBook(missingSeedMetadata),
		/seed cells do not match the canonical mode/,
	);

	const missingSeedLifecycle = structuredClone(deepAccessFixture.book);
	missingSeedLifecycle.events = reindex([
		missingSeedLifecycle.events[0],
		missingSeedLifecycle.events.find(({ type }) => type === 'board_set'),
		missingSeedLifecycle.events.at(-1),
	]);
	assert.throws(
		() => adapter.adaptBook(missingSeedLifecycle),
		/event sequence expected breach_state/,
	);

	const startToEnd = structuredClone(BASE_ZERO_FIXTURE.book);
	startToEnd.events = reindex([startToEnd.events[0], startToEnd.events.at(-1)]);
	assert.throws(
		() => adapter.adaptBook(startToEnd),
		/event sequence expected board_set/,
	);

	const wrongBreachPhase = structuredClone(baseWinFixture.book);
	wrongBreachPhase.events.find(({ type }) => type === 'breach_state').phase = 'feature';
	assert.throws(
		() => adapter.adaptBook(wrongBreachPhase),
		/breach_state phase breaks the authoritative lifecycle/,
	);

	const forgedCoreRoute = structuredClone(baseRouteFixture.book);
	const forgedRoute = forgedCoreRoute.events.find(
		(event) => event.type === 'breach_state' && event.live_cells.length > 0 && !event.core_live,
	);
	assert(forgedRoute, 'route-tease fixture needs a live non-Core breach snapshot');
	const displacedLive = forgedRoute.live_cells[0];
	const samePosition = (position) =>
		position.column === displacedLive.column && position.row === displacedLive.row;
	const sealedCoreIndex = forgedRoute.sealed_cells.findIndex(
		({ column, row }) => column === 3 && row === 3,
	);
	const breachedIndex = forgedRoute.breached_cells.findIndex(samePosition);
	const newlyIndex = forgedRoute.newly_breached_cells.findIndex(samePosition);
	assert(sealedCoreIndex >= 0 && breachedIndex >= 0 && newlyIndex >= 0);
	forgedRoute.live_cells[0] = { column: 3, row: 3 };
	forgedRoute.sealed_cells[sealedCoreIndex] = displacedLive;
	forgedRoute.breached_cells[breachedIndex] = { column: 3, row: 3 };
	forgedRoute.newly_breached_cells[newlyIndex] = { column: 3, row: 3 };
	assert.throws(
		() => adapter.adaptBook(forgedCoreRoute),
		/authoritative post-win route/,
	);

	const forgedTumble = structuredClone(baseWinFixture.book);
	const firstTumble = forgedTumble.events.find(({ type }) => type === 'tumble');
	assert(firstTumble?.entering_symbols.length > 0, 'base win fixture needs a populated tumble');
	firstTumble.entering_symbols[0].symbol =
		firstTumble.entering_symbols[0].symbol === 'vault' ? 'daemon' : 'vault';
	assert.throws(
		() => adapter.adaptBook(forgedTumble),
		/tumble entrant symbol mismatch/,
	);

	const forgedCap = structuredClone(baseMaxFixture.book);
	forgedCap.events.find(({ type }) => type === 'cap_reached').gross_award_raw += 1;
	assert.throws(
		() => adapter.adaptBook(forgedCap),
		/cap_reached is not reconciled/,
	);

	const falseCap = structuredClone(BASE_ZERO_FIXTURE.book);
	falseCap.events.at(-1).capped = true;
	assert.throws(
		() => adapter.adaptBook(falseCap),
		/round_end does not match the authoritative lifecycle total/,
	);

	const contradictoryInitialRoute = structuredClone(blackoutFixture.book);
	const initialRoute = contradictoryInitialRoute.events.find(
		({ type }) => type === 'feature_start',
	).initial_route;
	const sealedCell = initialRoute.sealed_cells[0];
	const liveCell = initialRoute.live_cells.at(-1);
	initialRoute.sealed_cells[0] = liveCell;
	initialRoute.live_cells[initialRoute.live_cells.length - 1] = sealedCell;
	assert.throws(
		() => adapter.adaptBook(contradictoryInitialRoute),
		/feature_start is not justified by the authoritative lifecycle/,
	);

	const missingFeatureLifecycle = structuredClone(blackoutFixture.book);
	const featureStartIndex = missingFeatureLifecycle.events.findIndex(
		({ type }) => type === 'feature_start',
	);
	assert(featureStartIndex > 0, 'blackout fixture must enter its direct feature');
	missingFeatureLifecycle.events = reindex([
		...missingFeatureLifecycle.events.slice(0, featureStartIndex),
		missingFeatureLifecycle.events.at(-1),
	]);
	assert.throws(
		() => adapter.adaptBook(missingFeatureLifecycle),
		/event sequence expected feature_start/,
	);

	const unauthorizedAfterBoard = structuredClone(BASE_ZERO_FIXTURE.book);
	unauthorizedAfterBoard.events = reindex([
		unauthorizedAfterBoard.events[0],
		unauthorizedAfterBoard.events[1],
		{
			index: 2,
			type: 'access_changed',
			previous_multiplier: 1,
			next_multiplier: 2,
			effective_from_next_evaluation: true,
			reason: 'route_proximity',
		},
		unauthorizedAfterBoard.events.at(-1),
	]);
	assert.throws(
		() => adapter.adaptBook(unauthorizedAfterBoard),
		/event sequence expected round_end/,
	);

	const prematureFeatureEnd = structuredClone(blackoutFixture.book);
	const firstFeatureCycleIndex = prematureFeatureEnd.events.findIndex(
		({ type }) => type === 'feature_cycle',
	);
	const featureEnd = prematureFeatureEnd.events.find(({ type }) => type === 'feature_end');
	assert(firstFeatureCycleIndex > featureStartIndex && featureEnd, 'blackout fixture needs cycle and end');
	prematureFeatureEnd.events = reindex([
		...prematureFeatureEnd.events.slice(0, firstFeatureCycleIndex),
		featureEnd,
		prematureFeatureEnd.events.at(-1),
	]);
	assert.throws(
		() => adapter.adaptBook(prematureFeatureEnd),
		/event sequence expected feature_cycle/,
	);
});

test('PresentationDirector consumes authority, cancels pending timing and cleans up', async () => {
	const states = [];
	const cues = new GameEventAdapter().adaptBook(BASE_ZERO_FIXTURE.book);
	const director = new PresentationDirector((state) => states.push(state));
	assert.equal(await director.play(cues), true);
	assert.equal(director.state.status, 'complete');
	assert.equal(director.state.board, BASE_ZERO_FIXTURE.book.events[1].board);
	assert.equal(director.state.finalWinRaw, 0);

	const pending = director.play(cues, { stepDelayMs: 50, timingProfile: 'normal' });
	director.reset();
	assert.equal(await pending, false);
	assert.deepEqual(director.state, createInitialPresentationState());
	assert(states.length > 0);

	director.destroy();
	assert.throws(() => director.consume(cues[0]), /destroyed/);
});

test('restore planning primes completed authority and resumes at exactly the next event index', () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_win_01');
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'base' });
	const cursor = cues.find(({ kind }) => kind === 'board_snapshot').eventIndex + 1;
	const plan = planPresentationRestore(cues, cursor);
	assert.equal(plan.primeCues.at(-1).eventIndex, cursor - 1);
	assert.equal(plan.resumeCues[0].eventIndex, cursor);
	const states = [];
	const director = new PresentationDirector((state) => states.push(state));
	for (const cue of plan.primeCues) director.consume(cue);
	assert.equal(director.state.board, plan.primeCues.at(-1).event.board);
	assert.equal(states.some((state) => state.status === 'presenting'), true);
	assert.throws(() => planPresentationRestore(cues, cues.length + 1), /next presentation event/);
	assert.throws(
		() => planPresentationRestore([{ ...cues[0], eventIndex: 1 }], 0),
		/contiguous authoritative event indices/,
	);
});

test('PresentationDirector preserves authoritative cluster positions and award arithmetic for rendering', () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_win_01');
	assert(fixture);
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'base' });
	const winCue = cues.find(({ kind }) => kind === 'win');
	assert(winCue);
	const director = new PresentationDirector();
	director.consume(cues[0]);
	director.consume(cues.find(({ kind }) => kind === 'board_snapshot'));
	director.consume(winCue);
	assert.equal(director.state.activeClusters, winCue.event.clusters);
	assert.equal(director.state.stepWinRaw, winCue.event.step_payout_raw);
	for (const cluster of director.state.activeClusters) {
		assert(cluster.positions.length >= 5);
		assert.equal(
			cluster.calculated_award_raw,
			cluster.base_payout_raw * cluster.access_multiplier,
		);
		assert(cluster.applied_award_raw <= cluster.calculated_award_raw);
	}
	const tumbleCue = cues.find(({ kind }) => kind === 'tumble');
	if (tumbleCue) {
		director.consume(tumbleCue);
		assert.equal(director.state.activeClusters, winCue.event.clusters);
		assert.equal(director.state.motion.phase, 'remove');
		assert.deepEqual(director.state.motion.cells, tumbleCue.event.removed_positions);
		const nextBoardCue = cues.find(
			(cue) => cue.kind === 'board_snapshot' && cue.eventIndex > tumbleCue.eventIndex,
		);
		assert(nextBoardCue);
		director.consume(nextBoardCue);
		assert.deepEqual(director.state.activeClusters, []);
		assert.equal(director.state.stepWinRaw, 0);
		assert.equal(director.state.motion.phase, 'drop');
		assert.deepEqual(director.state.motion.cells, tumbleCue.event.entering_symbols);
	}
});

test('PresentationDirector exposes bounded normal, turbo and reduced timing grammars', () => {
	assert.deepEqual(Object.keys(PRESENTATION_TIMINGS), ['normal', 'turbo', 'reduced']);
	for (const phase of [
		'step',
		'spin',
		'reveal',
		'anticipation',
		'feature',
		'hit',
		'remove',
		'drop',
		'settle',
		'recover',
		'maxWin',
	]) {
		assert(PRESENTATION_TIMINGS.normal[phase] > PRESENTATION_TIMINGS.turbo[phase]);
		assert(PRESENTATION_TIMINGS.turbo[phase] > 0);
		assert.equal(PRESENTATION_TIMINGS.reduced[phase], 0);
	}
	assert(PRESENTATION_TIMINGS.normal.hit >= 180);
	assert.equal(PRESENTATION_TIMINGS.normal.spin, 160);
	assert.equal(PRESENTATION_TIMINGS.turbo.spin, 110);
	assert.equal(PRESENTATION_TIMINGS.normal.reveal, 360);
	assert.equal(PRESENTATION_TIMINGS.turbo.reveal, 130);
	assert(PRESENTATION_TIMINGS.normal.drop <= 550);
	assert(PRESENTATION_TIMINGS.normal.anticipation >= 450);
	assert(PRESENTATION_TIMINGS.normal.feature >= 900);
	assert(PRESENTATION_TIMINGS.normal.feature <= 2_200);
	assert.equal(PRESENTATION_TIMINGS.normal.maxWin, 1_000);
	assert.equal(PRESENTATION_TIMINGS.turbo.maxWin, 360);
	assert.equal(PRESENTATION_TIMINGS.normal.recover, 1_000);
	assert.equal(PRESENTATION_TIMINGS.turbo.recover, 360);
	assert(Object.isFrozen(PRESENTATION_TIMINGS));
});

test('PresentationDirector preserves the authored recovery before returning to idle', async () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_max_win');
	assert(fixture);
	const settledCue = new GameEventAdapter()
		.adaptBook(fixture.book, { expectedMode: 'base' })
		.find(({ kind }) => kind === 'settled');
	assert(settledCue);
	const states = [];
	const director = new PresentationDirector((state) => states.push(state.character.state));
	const startedAt = performance.now();
	assert.equal(await director.play([settledCue], { timingProfile: 'normal' }), true);
	const elapsedMs = performance.now() - startedAt;
	assert(elapsedMs >= 900, `recovery was cut after ${elapsedMs.toFixed(1)}ms`);
	assert(elapsedMs <= 1_400, `recovery exceeded its bounded window at ${elapsedMs.toFixed(1)}ms`);
	assert.deepEqual(states, ['recover', 'idle_a']);
	assert.equal(director.timers.size, 0);
});

test('PresentationDirector preserves the authored turbo spin-start reaction', async () => {
	const roundStartedCue = new GameEventAdapter()
		.adaptBook(BASE_ZERO_FIXTURE.book, { expectedMode: 'base' })
		.find(({ kind }) => kind === 'round_started');
	assert(roundStartedCue);
	const states = [];
	const director = new PresentationDirector((state) => states.push(state.character.state));
	const startedAt = performance.now();
	assert.equal(await director.play([roundStartedCue], { timingProfile: 'turbo' }), true);
	const elapsedMs = performance.now() - startedAt;
	assert(elapsedMs >= 95, `turbo spin-start was cut after ${elapsedMs.toFixed(1)}ms`);
	assert(elapsedMs <= 300, `turbo spin-start exceeded its bounded window at ${elapsedMs.toFixed(1)}ms`);
	assert.equal(states.at(0), 'spin_start');
	assert.equal(states.at(-1), 'idle_a');
	assert(states.slice(0, -1).every((state) => state === 'spin_start'));
	assert.equal(director.timers.size, 0);
});

test('PresentationDirector keeps the authoritative max-win hero state visible until its bounded exit', async () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_max_win');
	assert(fixture);
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'base' });
	const capCue = cues.find(({ kind }) => kind === 'cap_reached');
	const settledCue = cues.find(({ kind }) => kind === 'settled');
	assert(capCue && settledCue);
	const director = new PresentationDirector();
	const pending = director.play([capCue, settledCue], {
		timingProfile: 'normal',
		stepDelayMs: 0,
		winDelayMs: 0,
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(director.state.character.state, 'max_win');
	assert.equal(director.timers.size, 1);
	assert.equal(director.skip(), true);
	assert.equal(await pending, true);
	assert.equal(director.state.status, 'complete');
	assert.equal(director.state.character.state, 'idle_a');
	assert.equal(director.timers.size, 0);
});

test('exact-browser QA measures normal cascade and BLACKOUT frame pacing', () => {
	const source = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(source, /normal cascade has no sustained frame-pacing stalls/u);
	assert.match(source, /normal cascade hit, remove, drop and settle clips complete their authored windows/u);
	assert.match(source, /turbo cascade hit, remove, drop and settle clips complete their authored windows/u);
	assert.match(source, /cascadePhaseWindows/u);
	assert.match(source, /normal BLACKOUT transition has no sustained frame-pacing stalls/u);
	assert.match(source, /normalReelStopCadence/u);
	assert.match(source, /max-win-hero-timing-normal-and-turbo/u);
	assert.match(source, /normal max-win hero clip remains visible for its complete authored window/u);
	assert.match(source, /turbo max-win hero clip remains visible for its complete authored window/u);
	assert.match(source, /normal recovery clip remains visible for its complete authored window/u);
	assert.match(source, /turbo recovery clip remains visible for its complete authored window/u);
	assert.match(source, /normal spin-start reaction remains visible for its complete authored window/u);
	assert.match(source, /turbo spin-start reaction remains visible for its complete authored window/u);
	assert.match(source, /replay-hit-timing-normal-and-turbo/u);
	assert.match(source, /normal Replay hit remains visible for its authored timing profile/u);
	assert.match(source, /turbo Replay hit remains visible for its authored timing profile/u);
	assert.match(
		source,
		/reduced-motion profile disables Vaultkeeper animation, transitions and compositor hints/u,
	);
});

test('BLACKOUT environment pulse stays on compositor-friendly opacity', () => {
	const source = readFileSync(join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'), 'utf8');
	const animation = source.match(/@keyframes environment-lock-pulse \{[\s\S]*?\n\t\}/u)?.[0];

	assert(animation, 'missing environment-lock-pulse keyframes');
	assert.match(animation, /opacity: 0\.44/u);
	assert.doesNotMatch(animation, /filter:/u);
	assert.match(
		source,
		/\.board-stage\[data-motion-phase='blackout-enter'\] \.vault-environment,[\s\S]*?will-change: opacity;/u,
	);
});

test('Vaultkeeper compositor hints are bounded to active reactions', () => {
	const source = readFileSync(join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'), 'utf8');
	const baseImageRule = source.match(/\.vaultkeeper-presence img \{[\s\S]*?\n\t\}/u)?.[0];

	assert(baseImageRule, 'missing Vaultkeeper image rule');
	assert.doesNotMatch(baseImageRule, /will-change:/u);
	assert.match(
		source,
		/\.vaultkeeper-presence\[data-character-state='spin_start'\] img,[\s\S]*?\[data-character-state='max_win'\] img \{[\s\S]*?will-change: transform, filter;/u,
	);
	assert.match(
		source,
		/\.vaultkeeper-presence\[data-motion-profile='reduced'\] img \{\s*animation: none !important;\s*transition: none;\s*will-change: auto;/u,
	);
});

test('Turbo Vaultkeeper hero and BLACKOUT reactions finish within the semantic cue window', () => {
	const source = readFileSync(join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'), 'utf8');
	assert.match(
		source,
		/\.vaultkeeper-presence\[data-motion-profile='turbo'\]\[data-character-state='feature_trigger'\] img,\s*\.vaultkeeper-presence\[data-motion-profile='turbo'\]\[data-character-state='recover'\] img,\s*\.vaultkeeper-presence\[data-motion-profile='turbo'\]\[data-character-state='max_win'\] img \{\s*animation-duration: 360ms;/u,
	);
});

test('exact-browser QA deduplicates competing paid-play input paths', () => {
	const source = readFileSync(join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'), 'utf8');
	assert.match(source, /concurrent-click-spacebar-deduplicates-paid-play/u);
	assert.match(source, /button-button-Space burst emits exactly one paid play while RGS is pending/u);
	assert.match(source, /base amount is locked while the authoritative play request is pending/u);
});

test('held Space cannot initiate another paid round after the first round completes', () => {
	const pageSource = readFileSync(
		join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'),
		'utf8',
	);
	const browserSource = readFileSync(
		join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'),
		'utf8',
	);

	assert.match(pageSource, /event\.preventDefault\(\);\s*if \(event\.repeat\) return;\s*void activatePrimary\(\);/u);
	assert.match(browserSource, /held Space emits one initial and one repeat keydown/u);
	assert.match(browserSource, /held Space cannot spend a second base bet after returning to ready/u);
});

test('held Enter on the focused primary action cannot repeat a paid round', () => {
	const pageSource = readFileSync(
		join(repoRoot, 'apps/blacksite/src/routes/+page.svelte'),
		'utf8',
	);
	const browserSource = readFileSync(
		join(repoRoot, 'scripts/blacksite-qa-e2e.mjs'),
		'utf8',
	);

	assert.match(pageSource, /function suppressPrimaryKeyRepeat\(event\)/u);
	assert.match(pageSource, /on:keydown=\{suppressPrimaryKeyRepeat\}/u);
	assert.match(browserSource, /held Enter emits one initial and one prevented repeat keydown/u);
	assert.match(browserSource, /held Enter cannot spend a second base bet after returning to ready/u);
});

test('PresentationDirector binds BLACKOUT transitions to authoritative feature cues', async () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'blackout_zero');
	assert(fixture);
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'blackout' });
	const phases = [];
	const director = new PresentationDirector((state) => phases.push(state.motion.phase));
	director.setTimingProfile('reduced');
	assert.equal(await director.play(cues), true);
	for (const phase of ['spin', 'blackout-enter', 'reveal', 'blackout-exit']) {
		assert(phases.includes(phase), `missing ${phase} presentation phase`);
	}
	assert.equal(director.state.status, 'complete');
	assert.equal(director.state.finalWinRaw, fixture.book.payoutMultiplier);
	assert.equal(director.state.motion.phase, 'idle');
	assert.equal(director.timers.size, 0);
});

test('PresentationDirector drives the static Vaultkeeper fallback from authoritative cues only', async () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_natural_blackout');
	assert(fixture);
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'base' });
	const director = new PresentationDirector();
	const expectedStates = new Map([
		['round_started', 'spin_start'],
		['board_snapshot', 'monitoring'],
		['win', 'win_acknowledge'],
		['feature_armed', 'feature_tease'],
		['feature_started', 'feature_trigger'],
		['feature_cycle', 'bonus_idle'],
		['feature_ended', 'recover'],
		['settled', 'recover'],
	]);
	const seen = new Set();
	for (const cue of cues) {
		director.consume(cue);
		const expected = expectedStates.get(cue.kind);
		if (!expected) continue;
		seen.add(cue.kind);
		assert.equal(director.state.character.state, expected);
		assert.equal(director.state.character.sourceEventIndex, cue.eventIndex);
		assert(Object.isFrozen(director.state.character));
	}
	for (const kind of expectedStates.keys()) assert(seen.has(kind), `missing ${kind} cue`);
	director.reset();
	director.setTimingProfile('reduced');
	assert.equal(await director.play(cues), true);
	assert.deepEqual(director.state.character, {
		state: 'idle_a',
		sourceEventIndex: cues.at(-1).eventIndex,
	});
	assert.equal(director.timers.size, 0);
});

test('PresentationDirector skip drains authority, preserves motion order and settles cleanly', async () => {
	const fixture = GENERATED_FIXTURES.find(({ id }) => id === 'base_cascade_3');
	assert(fixture);
	const cues = new GameEventAdapter().adaptBook(fixture.book, { expectedMode: 'base' });
	const phases = [];
	const director = new PresentationDirector((state) => phases.push(state.motion.phase));
	director.setTimingProfile('normal');
	const pending = director.play(cues);
	assert.equal(director.skip(), true);
	assert.equal(await pending, true);
	assert.equal(director.state.status, 'complete');
	assert.equal(director.state.finalWinRaw, fixture.book.payoutMultiplier);
	assert(phases.includes('hit'));
	assert(phases.includes('spin'));
	assert(phases.includes('reveal'));
	assert(phases.includes('remove'));
	assert(phases.includes('drop'));
	assert(phases.includes('settle'));
	assert.equal(director.state.motion.phase, 'idle');
	assert.equal(director.state.character.state, 'idle_a');
	assert.equal(director.timers.size, 0);
});
