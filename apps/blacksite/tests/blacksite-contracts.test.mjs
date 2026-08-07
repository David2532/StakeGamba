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
import { BASE_ZERO_FIXTURE } from '../src/lib/fixtures/base-zero.js';
import {
	ContractViolation,
	GameEventAdapter,
} from '../src/lib/runtime/game-event-adapter.js';
import { resolveLaunchMode } from '../src/lib/runtime/launch-mode.js';
import {
	PresentationDirector,
	createInitialPresentationState,
} from '../src/lib/runtime/presentation-director.js';

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
		MODES.map(({ id, costMultiplier, normalLabel, socialLabel }) => ({
			id,
			costMultiplier,
			normalLabel,
			socialLabel,
		})),
		[
			{
				id: 'base',
				costMultiplier: 1,
				normalLabel: 'BREACH RUN',
				socialLabel: 'STANDARD RUN',
			},
			{
				id: 'deep_access',
				costMultiplier: 4,
				normalLabel: 'DEEP ACCESS',
				socialLabel: 'DEEP ACCESS',
			},
			{
				id: 'blackout',
				costMultiplier: 80,
				normalLabel: 'BLACKOUT PROTOCOL',
				socialLabel: 'BLACKOUT ENTRY',
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

test('launch parser fails paid live play closed and never promotes fixtures in production', () => {
	assert.deepEqual(resolveLaunchMode('', { dev: false }), {
		kind: 'error',
		code: 'RGS_URL_MISSING',
		message: 'Paid live launch requires rgs_url. No local game was started.',
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
	assert.deepEqual(resolveLaunchMode('?rgs_url=https%3A%2F%2Frgs.example%2F'), {
		kind: 'live',
		rgsUrl: 'https://rgs.example',
		status: 'RGS_WIRING_PENDING',
	});
});

test('Replay identity is parsed separately and remains read-only pending', () => {
	assert.equal(resolveLaunchMode('?replay=true').code, 'REPLAY_QUERY_INVALID');
	const replay = resolveLaunchMode(
		'?replay=true&game=blacksite_breach&version=0.1.0-m1&mode=base&event=1' +
			'&rgs_url=https%3A%2F%2Frgs.example&currency=XSC&amount=1250&social=true',
	);
	assert.deepEqual(replay, {
		kind: 'replay',
		game: 'blacksite_breach',
		version: '0.1.0-m1',
		mode: 'base',
		event: '1',
		rgsUrl: 'https://rgs.example',
		currency: 'XSC',
		amount: '1250',
		lang: null,
		device: null,
		social: true,
	});
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

test('PresentationDirector consumes authority, cancels pending timing and cleans up', async () => {
	const states = [];
	const cues = new GameEventAdapter().adaptBook(BASE_ZERO_FIXTURE.book);
	const director = new PresentationDirector((state) => states.push(state));
	assert.equal(await director.play(cues), true);
	assert.equal(director.state.status, 'complete');
	assert.equal(director.state.board, BASE_ZERO_FIXTURE.book.events[1].board);
	assert.equal(director.state.finalWinRaw, 0);

	const pending = director.play(cues, { stepDelayMs: 50 });
	director.reset();
	assert.equal(await pending, false);
	assert.deepEqual(director.state, createInitialPresentationState());
	assert(states.length > 0);

	director.destroy();
	assert.throws(() => director.consume(cues[0]), /destroyed/);
});
