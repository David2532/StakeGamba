import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);

async function readSource(url) {
	return readFile(url, 'utf8');
}

test('production HUD omits internal greybox and candidate diagnostics', async () => {
	const source = await readSource(pageUrl);
	const forbiddenPlayerFragments = [
		'M2 Greybox',
		'CLASSIFIED SYSTEM / AUTHORITATIVE PRESENTATION',
		'<h2>Mode control</h2>',
		'<h2>Runtime status</h2>',
		'blacksite-book-events-v1',
		'column-major 7×7',
		'centi-x uint64',
		'CANDIDATE_FINGERPRINT_SHA256.slice',
		'EVENT_SCHEMA_SHA256.slice',
	];

	for (const fragment of forbiddenPlayerFragments) {
		assert.equal(source.includes(fragment), false, `player surface still exposes ${fragment}`);
	}
	assert.match(source, /data-testid="player-hud"/u);
	assert.match(source, /data-testid="board-status"/u);
});

test('board uses semantic full-name symbols without coordinate or three-letter debug labels', async () => {
	const source = await readSource(pageUrl);

	for (const label of ['BYTE', 'RELAY', 'PROXY', 'CIPHER', 'DAEMON', 'VAULT']) {
		assert.match(source, new RegExp(`label: '${label}'`, 'u'));
	}
	for (const code of ['BYT', 'RLY', 'PRX', 'CPH', 'DMN', 'VLT']) {
		assert.equal(source.includes(`'${code}'`), false, `debug symbol code ${code} remains`);
	}
	assert.equal(source.includes('<small>{cell.column}{cell.row}</small>'), false);
	assert.match(source, /data-symbol=\{symbol \?\? ''\}/u);
});

test('browser QA reads semantic symbol state and rejects internal player copy', async () => {
	const source = await readSource(browserQaUrl);

	assert.match(source, /getAttribute\('data-symbol'\)/u);
	assert.match(source, /player HUD exposes no internal schema or greybox diagnostics/u);
	assert.equal(source.includes("cell.includes('--')"), false);
});
