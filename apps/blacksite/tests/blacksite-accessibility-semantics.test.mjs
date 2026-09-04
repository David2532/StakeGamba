import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);

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

test('policy-locked audio reports the same off state visually and programmatically', async () => {
	const [page, browserQa] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(browserQaUrl, 'utf8'),
	]);

	assert.match(page, /audioOff = !audioState\.unlocked \|\| audioState\.volume === 0/u);
	assert.match(page, /aria-pressed=\{audioOff\}/u);
	assert.match(browserQa, /policy-locked audio exposes one consistent off toggle state/u);
});

test('live authentication remains perceivable until the intro actually opens', async () => {
	const [page, browserQa] = await Promise.all([
		readFile(pageUrl, 'utf8'),
		readFile(browserQaUrl, 'utf8'),
	]);

	assert.match(
		page,
		/introModalActive = launch\.kind === 'live' && introState\.status === 'playing'/u,
	);
	assert.match(
		page,
		/introBlocking = launch\.kind === 'live' && \(introGatePending \|\| introModalActive\)/u,
	);
	assert.match(page, /data-testid="auth-pending-status"[\s\S]*?role="status"/u);
	assert.match(
		browserQa,
		/stalled authentication presents a dedicated live status while controls stay isolated/u,
	);
	assert.match(
		browserQa,
		/delayed authentication isolates controls and cannot leave Rules open behind the intro/u,
	);
	assert.match(browserQa, /'live-authenticating'/u);
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
	assert.match(
		source,
		/confirmation accessible description binds the mode factor and exact complete amount/u,
	);
	assert.match(source, /every visible game control maps to a Game Information guide entry/u);
	assert.match(source, /interaction guide documents touch, keyboard, Space and Escape behaviour/u);
	assert.match(
		source,
		/board exposes one named 7x7 ARIA grid with explicit row ownership and positions/u,
	);
	assert.match(source, /session position is polite while the ticking timer remains non-live/u);
});

test('exact-package browser QA runs pinned whole-document WCAG 2.2 A and AA audits', async () => {
	const [source, packageJson] = await Promise.all([
		readFile(browserQaUrl, 'utf8'),
		readFile(packageUrl, 'utf8').then(JSON.parse),
	]);

	assert.equal(packageJson.devDependencies['axe-core'], '4.13.0');
	assert.match(
		source,
		/const WCAG_AA_TAGS = Object\.freeze\(\[[\s\S]*?'wcag2a'[\s\S]*?'wcag2aa'[\s\S]*?'wcag21a'[\s\S]*?'wcag21aa'[\s\S]*?'wcag22aa'[\s\S]*?\]\);/u,
	);
	assert.match(source, /globalThis\.axe\.run\(document,/u);
	assert.match(source, /runOnly: \{ type: 'tag', values: tags \}/u);
	assert.match(source, /resultTypes: \['violations', 'incomplete'\]/u);
	assert.match(source, /whole-document axe WCAG 2\.2 A\/AA audit has zero violations/u);
	for (const surface of [
		'boot-intro-modal-mobile',
		'live-ready-desktop',
		'live-result-desktop',
		'rules-modal-desktop',
		'high-cost-confirmation-modal-desktop',
		'replay-ready-popout-s',
		'replay-completed-popout-s',
	]) {
		assert.match(source, new RegExp(`['\"]${surface}['\"]`, 'u'));
	}
	assert.match(source, /Every axe-core incomplete result requires human review\./u);
});
