import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createZstdDecompress } from 'node:zlib';
import {
	CANDIDATE_FINGERPRINT_SHA256,
	EVENT_CONTRACT,
	EVENT_SCHEMA_SHA256,
} from '../src/lib/contracts/modes.js';
import { PAYLINE_COUNT, REEL_COLUMNS, REEL_ROWS } from '../src/lib/contracts/reels.js';
import { GameEventAdapter } from '../src/lib/runtime/game-event-adapter.js';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../..');
const libraryRoot = join(repoRoot, 'math/games/blacksite_breach/library');
const fixtureIndex = JSON.parse(
	readFileSync(join(libraryRoot, 'publish_files/FIXTURE_INDEX.json'), 'utf8'),
);

if (
	fixtureIndex.event_contract !== EVENT_CONTRACT ||
	fixtureIndex.event_contract !== 'blacksite-book-events-v3' ||
	fixtureIndex.event_schema_sha256 !== EVENT_SCHEMA_SHA256 ||
	fixtureIndex.candidate_fingerprint_sha256 !== CANDIDATE_FINGERPRINT_SHA256
) {
	throw new Error(
		'Refusing to replace catalog.generated.js: FIXTURE_INDEX.json is not the current BLACKSITE v3 candidate.',
	);
}
const fixtureEntries = Object.entries(fixtureIndex.fixtures);
if (fixtureEntries.length === 0) throw new Error('FIXTURE_INDEX.json contains no v3 fixtures.');
const presentationFixtureIds = Object.freeze({
	base_simple_line_win: 'base_classic_line_win',
	base_feature_small: 'base_small',
	blackout_small_no_expansion: 'blackout_small',
	blackout_expansion: 'blackout_expanding_breach',
});
const wantedByMode = new Map();

for (const [fixtureId, fixture] of fixtureEntries) {
	if (!wantedByMode.has(fixture.mode)) wantedByMode.set(fixture.mode, new Map());
	const wanted = wantedByMode.get(fixture.mode);
	if (!wanted.has(fixture.book_id)) wanted.set(fixture.book_id, []);
	wanted.get(fixture.book_id).push({ fixtureId, fixture });
}

const collected = new Map();
for (const [mode, wanted] of wantedByMode) {
	const source = createReadStream(
		join(libraryRoot, `books_compressed/${mode}_books.jsonl.zst`),
	).pipe(createZstdDecompress());
	const lines = createInterface({ input: source, crlfDelay: Infinity });
	for await (const line of lines) {
		const book = JSON.parse(line);
		const matches = wanted.get(book.id) ?? [];
		for (const match of matches) collected.set(match.fixtureId, { ...match, book });
		if (collected.size === fixtureEntries.length) break;
	}
}

const missing = fixtureEntries
	.map(([fixtureId]) => fixtureId)
	.filter((fixtureId) => !collected.has(fixtureId));
if (missing.length) throw new Error(`Missing published fixture books: ${missing.join(', ')}`);

function selectedBook(purpose) {
	const fixtureId = presentationFixtureIds[purpose];
	const selected = collected.get(fixtureId);
	if (!selected) throw new Error(`Missing semantic presentation fixture ${purpose}: ${fixtureId}`);
	return selected.book;
}

const baseSimpleLineWin = selectedBook('base_simple_line_win');
if (
	baseSimpleLineWin.payoutMultiplier !== 250 ||
	baseSimpleLineWin.events.some(({ type }) => type === 'feature_start') ||
	!baseSimpleLineWin.events.some(({ type }) => type === 'line_win') ||
	!baseSimpleLineWin.events
		.filter(({ type }) => type === 'line_win')
		.flatMap(({ wins }) => wins)
		.every(({ symbol }) => symbol === 'operative') ||
	baseSimpleLineWin.events.at(-1)?.final_phase !== 'base'
) {
	throw new Error(
		'base_simple_line_win must be the published v3 OPERATIVE base-only line-win book',
	);
}

const baseFeatureSmall = selectedBook('base_feature_small');
if (
	baseFeatureSmall.payoutMultiplier !== 1 ||
	!baseFeatureSmall.events.some(({ type }) => type === 'feature_start') ||
	baseFeatureSmall.events.find(({ type }) => type === 'feature_start')?.target_symbol !==
		'operative' ||
	baseFeatureSmall.events.at(-1)?.final_phase !== 'feature'
) {
	throw new Error(
		'base_feature_small must retain the published v3 0.01x natural-BLACKOUT semantics',
	);
}

const blackoutSmall = selectedBook('blackout_small_no_expansion');
const blackoutSmallStart = blackoutSmall.events.find(({ type }) => type === 'feature_start');
if (
	blackoutSmall.payoutMultiplier !== 1 ||
	blackoutSmallStart?.target_symbol !== 'operative' ||
	blackoutSmall.events.some(({ type }) => type === 'expansion_applied')
) {
	throw new Error(
		'blackout_small_no_expansion must expose OPERATIVE as its target without an expansion',
	);
}

const blackoutExpansion = selectedBook('blackout_expansion');
const blackoutExpansionStart = blackoutExpansion.events.find(
	({ type }) => type === 'feature_start',
);
const blackoutExpansionEvent = blackoutExpansion.events.find(
	({ type }) => type === 'expansion_applied',
);
if (
	blackoutExpansionStart?.target_symbol !== 'ten' ||
	blackoutExpansionEvent?.target_symbol !== blackoutExpansionStart.target_symbol
) {
	throw new Error('blackout_expansion must retain its authoritative TEN target and expansion');
}

const uniqueBooks = new Map();
const fixtureRecords = fixtureEntries.map(([fixtureId]) => {
	const { fixture, book } = collected.get(fixtureId);
	if (book.payoutMultiplier !== fixture.payout_raw) {
		throw new Error(`${fixtureId} payout does not match FIXTURE_INDEX.json`);
	}
	const start = book.events?.[0];
	if (
		start?.schema_version !== 3 ||
		start?.event_contract !== EVENT_CONTRACT ||
		start?.board_columns !== REEL_COLUMNS ||
		start?.board_rows !== REEL_ROWS ||
		start?.payline_count !== PAYLINE_COUNT
	) {
		throw new Error(`${fixtureId} is not an exact 5x3 / ten-payline v3 book`);
	}
	new GameEventAdapter().adaptBook(book, { expectedMode: fixture.mode });
	const bookKey = `${fixture.mode}:${fixture.book_id}`;
	uniqueBooks.set(bookKey, book);
	return {
		id: fixtureId,
		label: fixture.acceptance,
		mode: fixture.mode,
		mathBacked: true,
		bookId: fixture.book_id,
		lookupWeight: fixture.lookup_weight,
		candidateFingerprint: fixtureIndex.candidate_fingerprint_sha256,
		eventSchemaSha256: fixtureIndex.event_schema_sha256,
		bookKey,
	};
});

const bookRecord = Object.fromEntries(uniqueBooks);

const output =
	`// Generated by apps/blacksite/scripts/build-fixture-catalog.mjs.\n` +
	`// Development-only: do not import this module from the production launch path.\n\n` +
	`function deepFreeze(value) {\n` +
	`\tif (value && typeof value === 'object' && !Object.isFrozen(value)) {\n` +
	`\t\tObject.freeze(value);\n` +
	`\t\tObject.values(value).forEach(deepFreeze);\n` +
	`\t}\n` +
	`\treturn value;\n` +
	`}\n\n` +
	`const BOOKS = ${JSON.stringify(bookRecord)};\n\n` +
	`const FIXTURE_RECORDS = ${JSON.stringify(fixtureRecords, null, 2)};\n` +
	`export const FIXTURES = deepFreeze(FIXTURE_RECORDS.map(({ bookKey, ...fixture }) => ({ ...fixture, book: BOOKS[bookKey] })));\n\n` +
	`const FIXTURE_MAP = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));\n` +
	`export const FIXTURE_IDS = Object.freeze(FIXTURES.map((fixture) => fixture.id));\n` +
	`export const PRESENTATION_FIXTURE_IDS = Object.freeze(${JSON.stringify(presentationFixtureIds, null, 2)});\n` +
	`export function getFixture(fixtureId) { return FIXTURE_MAP.get(fixtureId) ?? null; }\n` +
	`export function getPresentationFixture(purpose) { return getFixture(PRESENTATION_FIXTURE_IDS[purpose]); }\n`;

writeFileSync(join(appRoot, 'src/lib/fixtures/catalog.generated.js'), output);
console.log(
	`Wrote ${fixtureRecords.length} verified BLACKSITE fixtures over ${uniqueBooks.size} unique books.`,
);
