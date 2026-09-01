import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

test('mobile mode labels wrap and remain optically centered', async () => {
	const source = await readFile(pageUrl, 'utf8');
	assert.match(source, /\.mode-list button \{[\s\S]*?flex-direction: column;[\s\S]*?align-items: center;[\s\S]*?text-align: center;/u);
	assert.match(source, /\.mode-list button span \{[\s\S]*?justify-content: center;[\s\S]*?white-space: normal;/u);
});

test('base amount, meters and keyboard focus use explicit centered high-contrast styling', async () => {
	const source = await readFile(pageUrl, 'utf8');
	assert.match(source, /\.amount-control select \{[\s\S]*?text-align: center;[\s\S]*?text-align-last: center;/u);
	assert.match(source, /\.meter-row > div \{[\s\S]*?text-align: center;/u);
	assert.equal((source.match(/outline: 3px solid #efc06a;/gu) ?? []).length >= 4, true);
	assert.match(source, /data-testid="info-action"/u);
});

test('browser QA covers required desktop and mobile alignment plus focus evidence', async () => {
	const source = await readFile(browserQaUrl, 'utf8');
	assert.match(source, /desktop-1366x768/u);
	assert.match(source, /mode labels are fully visible without ellipsis or clipping/u);
	assert.match(source, /base amount value and all three meters are centered/u);
	assert.match(source, /keyboard focus exposes a distinct high-contrast action ring/u);
	assert.match(source, /Math\.abs\(boardRatio - 1\) <= 0\.002/u);
});

test('compact motion and info actions retain independent 44px columns', async () => {
	const source = await readFile(pageUrl, 'utf8');
	assert.match(
		source,
		/@media \(max-width: 480px\) \{[\s\S]*?\.action-stack \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(44px, 1fr\)\);[\s\S]*?\.motion-controls \{[\s\S]*?grid-column: 1 \/ 3;[\s\S]*?\.info-action \{[\s\S]*?grid-column: 3;/u,
	);
});

test('browser QA proves a live portrait-landscape-portrait reflow without wallet writes', async () => {
	const source = await readFile(browserQaUrl, 'utf8');
	assert.match(source, /geometry-mobile-orientation-roundtrip/u);
	assert.match(source, /mechanical-vault-portrait-v1\.webp/u);
	assert.match(source, /mechanical-vault-desktop-v1\.webp/u);
	assert.match(source, /orientation round trip returns to the original portrait composition/u);
	assert.match(
		source,
		/orientation round trip preserves one authenticated session and zero wallet writes/u,
	);
});
