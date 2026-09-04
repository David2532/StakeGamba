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
		'Current runtime status',
		'BASE BET',
		'TOTAL BET',
		'base bet',
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

test('authenticate jurisdiction flags guard optional presentation controls and the HUD RTP readout', async () => {
	const pageSource = await readSource(pageUrl);
	const browserSource = await readSource(browserQaUrl);

	assert.match(
		pageSource,
		/turboDisabled =[\s\S]*?launch\.kind === 'booting'[\s\S]*?launch\.kind === 'error'[\s\S]*?launch\.kind === 'live'[\s\S]*?disabledTurbo !== false/u,
	);
	assert.match(
		pageSource,
		/slamstopDisabled = liveSnapshot\.config\?\.jurisdiction\?\.disabledSlamstop === true/u,
	);
	assert.match(
		pageSource,
		/displayRTP = liveSnapshot\.config\?\.jurisdiction\?\.displayRTP === true/u,
	);
	assert.match(pageSource, /reducedMotion[\s\S]*?turboDisabled[\s\S]*?'normal'[\s\S]*?motionMode/u);
	assert.match(pageSource, /if \(introBlocking \|\| reducedMotion \|\| turboDisabled\) return;/u);
	assert.match(pageSource, /if \(slamstopDisabled\) return;/u);
	assert.match(
		pageSource,
		/if \(launch\.kind === 'live' && spacebarDisabled && event\.code === 'Space'\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?return;/u,
	);
	assert.match(
		pageSource,
		/disabled=\{introBlocking \|\| reducedMotion \|\| turboDisabled \|\| presentationBusy\}/u,
	);
	assert.match(pageSource, /disabled=\{slamstopDisabled \|\| !presentationBusy\}/u);
	assert.match(
		pageSource,
		/showHudRtp =[\s\S]*?launch\.kind === 'fixture'[\s\S]*?launch\.kind === 'replay'[\s\S]*?launch\.kind === 'live'[\s\S]*?liveSnapshot\.config !== null[\s\S]*?displayRTP/u,
	);
	assert.match(pageSource, /\{#if showHudRtp\}[\s\S]*?data-testid="hud-rtp"[\s\S]*?\{\/if\}/u);
	assert.equal(pageSource.includes("{#if launch.kind !== 'live' || displayRTP}"), false);
	assert.match(pageSource, /<th>RTP<\/th>[\s\S]*?\{\(mode\.targetRtp \* 100\)\.toFixed\(2\)\}%/u);
	assert.match(browserSource, /jurisdiction-enforces-turbo-slamstop-and-optional-rtp-hud/u);
	assert.match(
		browserSource,
		/disabledTurbo forces effective normal timing without erasing stored Turbo/u,
	);
	assert.match(
		browserSource,
		/disabledSlamstop rejects a synthetic Skip click instead of draining the presentation/u,
	);
	assert.match(
		browserSource,
		/Game Information retains mandatory RTP disclosure when the optional HUD readout is hidden/u,
	);
});

test('Replay uses one exact total-play value for every HUD surface', async () => {
	const pageSource = await readSource(pageUrl);
	const browserSource = await readSource(browserQaUrl);

	assert.match(
		pageSource,
		/visibleTotalAmountText =[\s\S]*?launch\.kind === 'replay'[\s\S]*?formatReplayQueryUnits\(replayTotalUnits, launch\.currency\)/u,
	);
	assert.equal((pageSource.match(/data-total-play-surface/gu) ?? []).length, 2);
	assert.equal(
		(pageSource.match(/<strong[^>]*>\{visibleTotalAmountText\}<\/strong>/gu) ?? []).length,
		2,
	);
	assert.match(browserSource, /function exactReplayTotalPlaySurfaces/u);
	assert.match(
		browserSource,
		/every visible desktop Replay TOTAL PLAY surface is exact in the ready state/u,
	);
	assert.match(
		browserSource,
		/every Social Replay TOTAL PLAY surface remains exact after completion/u,
	);
});
