import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

test('route and presentation controls expose named groups with atomic runtime status', async () => {
	const source = await readFile(pageUrl, 'utf8');

	assert.match(source, /id="access-level-title">Choose your route<\/h2>/u);
	assert.match(source, /class="mode-list" role="group" aria-labelledby="access-level-title"/u);
	assert.match(
		source,
		/class="motion-controls"[\s\S]*?role="group"[\s\S]*?aria-label="Presentation speed controls"/u,
	);
	assert.match(
		source,
		/data-testid="launch-status"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/u,
	);
	assert.match(
		source,
		/data-testid="board-status"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/u,
	);
});

test('high-cost confirmation binds factor and exact amount to its accessible description', async () => {
	const source = await readFile(pageUrl, 'utf8');

	assert.match(source, /aria-describedby="confirm-description confirm-total"/u);
	assert.match(source, /<p id="confirm-description">/u);
	assert.match(source, /<strong id="confirm-total">\{totalAmountText\}<\/strong>/u);
});

test('vault board exposes a named 7x7 row-owned grid with explicit cell positions', async () => {
	const source = await readFile(pageUrl, 'utf8');

	assert.match(
		source,
		/role="grid"[\s\S]*?aria-label="Vault symbol grid"[\s\S]*?aria-rowcount="7"[\s\S]*?aria-colcount="7"/u,
	);
	assert.match(source, /class="board-row" role="row" aria-rowindex=\{row \+ 1\}/u);
	assert.match(
		source,
		/role="gridcell"[\s\S]*?aria-rowindex=\{cell\.row \+ 1\}[\s\S]*?aria-colindex=\{cell\.column \+ 1\}/u,
	);
});

test('jurisdiction readouts announce balance changes without speaking every timer tick', async () => {
	const source = await readFile(pageUrl, 'utf8');

	assert.match(
		source,
		/data-testid="session-net-position"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"[\s\S]*?aria-labelledby="session-position-label"/u,
	);
	assert.match(
		source,
		/data-testid="session-timer"[\s\S]*?role="timer"[\s\S]*?aria-live="off"[\s\S]*?aria-atomic="true"[\s\S]*?aria-labelledby="session-timer-label"/u,
	);
	assert.doesNotMatch(source, /class="jurisdiction-readouts" aria-live=/u);
	assert.match(source, /const SESSION_TIMER_INTERVAL_MS = 1_000;/u);
	assert.match(source, /window\.setInterval\([\s\S]*?SESSION_TIMER_INTERVAL_MS\);/u);
	assert.doesNotMatch(source, /window\.setInterval\([\s\S]*?\}, 250\);/u);
});

test('exact-package browser QA verifies semantic groups, status regions and confirmation description', async () => {
	const source = await readFile(browserQaUrl, 'utf8');

	assert.match(source, /route and presentation controls expose named accessibility groups/u);
	assert.match(source, /connection and board states expose atomic polite status announcements/u);
	assert.match(source, /confirmation accessible description binds the mode factor and exact complete amount/u);
	assert.match(source, /every visible game control maps to a Game Information guide entry/u);
	assert.match(source, /interaction guide documents touch, keyboard, Space and Escape behaviour/u);
	assert.match(source, /board exposes one named 7x7 ARIA grid with explicit row ownership and positions/u);
	assert.match(source, /session position is polite while the ticking timer remains non-live/u);
});
