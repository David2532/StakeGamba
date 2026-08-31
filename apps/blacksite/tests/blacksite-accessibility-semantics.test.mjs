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

test('exact-package browser QA verifies semantic groups, status regions and confirmation description', async () => {
	const source = await readFile(browserQaUrl, 'utf8');

	assert.match(source, /route and presentation controls expose named accessibility groups/u);
	assert.match(source, /connection and board states expose atomic polite status announcements/u);
	assert.match(source, /confirmation accessible description binds the mode factor and exact complete amount/u);
});
