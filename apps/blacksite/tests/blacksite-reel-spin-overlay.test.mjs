import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BLACKSITE_ASSETS } from '../src/lib/assets/blacksite-assets.js';

const componentSource = await readFile(
	new URL('../src/lib/components/ReelSpinOverlay.svelte', import.meta.url),
	'utf8',
);
const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const styleSource = componentSource.slice(
	componentSource.indexOf('<style>'),
	componentSource.lastIndexOf('</style>'),
);

function timingValue(block, variableName) {
	const match = block.match(new RegExp(`--${variableName}:\\s*(\\d+)ms`, 'u'));
	assert.ok(match, `missing --${variableName}`);
	return Number(match[1]);
}

test('overlay mounts exactly five pre-rendered raster strips and no per-stop symbol stack', () => {
	assert.deepEqual(BLACKSITE_ASSETS.ui.reelStrips, Array.from(
		{ length: 5 },
		(_, index) => `assets/blacksite/v22/ui/reel-strips/reel-${String(index + 1).padStart(2, '0')}.webp`,
	));
	assert.match(
		componentSource,
		/import \{ BLACKSITE_ASSETS \} from '\.\.\/assets\/blacksite-assets\.js';/u,
	);
	assert.match(componentSource, /const REEL_COUNT = 5;/u);
	assert.match(componentSource, /const REEL_STRIPS = BLACKSITE_ASSETS\.ui\.reelStrips;/u);
	assert.match(componentSource, /export let stripSources = REEL_STRIPS;/u);
	assert.match(componentSource, /renderedStripSources = Array\.isArray\(stripSources\) && stripSources\.length === REEL_COUNT/u);
	assert.match(componentSource, /\{#each renderedStripSources as stripSrc, columnIndex\}/u);
	assert.match(componentSource, /src=\{stripSrc\}/u);
	assert.equal((componentSource.match(/class="reel-spin-column-layer"/gu) ?? []).length, 1);
	assert.match(styleSource, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/u);
	assert.doesNotMatch(componentSource, /SYMBOL_MASTER_IDS|symbols\.master|stopIndex|reel-spin-stop|repeat\((?:15|16|80)\b/u);
	assert.equal((componentSource.match(/<img\b/gu) ?? []).length, 1, 'one IMG template expands to five strips');
});

test('active, settling and turbo own mount state and left-to-right release timing', () => {
	assert.match(componentSource, /export let active = false;/u);
	assert.match(componentSource, /export let settling = false;/u);
	assert.match(componentSource, /export let anticipating = false;/u);
	assert.match(componentSource, /export let lockedReels = \[\];/u);
	assert.match(componentSource, /export let turbo = false;/u);
	assert.match(componentSource, /\{#if active\}[\s\S]*data-testid="reel-spin-overlay"[\s\S]*\{\/if\}/u);
	assert.match(componentSource, /class:settling/u);
	assert.match(componentSource, /class:turbo/u);
	assert.match(componentSource, /data-state=\{anticipating \? 'anticipating' : settling \? 'settling' : 'spinning'\}/u);
	assert.match(componentSource, /data-turbo=\{turbo \? 'true' : 'false'\}/u);
	assert.match(componentSource, /style=\{`--column-index:\$\{columnIndex\}`\}/u);
	assert.match(
		styleSource,
		/\.reel-spin-overlay\.settling \.reel-column-window\s*\{[^}]*opacity:\s*0;[^}]*transition-delay:\s*calc\(var\(--column-index\) \* var\(--settle-step\)\);/u,
	);

	const baseBlock = styleSource.match(/\.reel-spin-overlay\s*\{([\s\S]*?)\n\t\}/u)?.[1] ?? '';
	const turboBlock = styleSource.match(/\.reel-spin-overlay\.turbo\s*\{([\s\S]*?)\n\t\}/u)?.[1] ?? '';
	assert.notEqual(baseBlock, '');
	assert.notEqual(turboBlock, '');
	assert.match(baseBlock, /background:\s*transparent;/u);
	assert.deepEqual(
		['fade-duration', 'settle-step', 'spin-duration'].map((timing) => timingValue(baseBlock, timing)),
		[72, 82, 720],
	);
	assert.deepEqual(
		['fade-duration', 'settle-step', 'spin-duration'].map((timing) => timingValue(turboBlock, timing)),
		[10, 4, 250],
	);
	for (const timing of ['fade-duration', 'settle-step', 'spin-duration']) {
		const baseMs = timingValue(baseBlock, timing);
		const turboMs = timingValue(turboBlock, timing);
		assert.ok(turboMs > 0 && turboMs < baseMs, `${timing} must accelerate in turbo mode`);
	}
});

test('overlay is decorative and limits compositor work to its five rolling columns', () => {
	assert.match(componentSource, /data-testid="reel-spin-overlay"[\s\S]*aria-hidden="true"/u);
	assert.match(componentSource, /<img[\s\S]*?alt=""[\s\S]*?aria-hidden="true"[\s\S]*?draggable="false"/u);
	assert.match(styleSource, /\.reel-spin-overlay\s*\{[^}]*pointer-events:\s*none;/u);
	assert.doesNotMatch(
		styleSource,
		/(?:^|[;{\s])(?:filter|backdrop-filter|mix-blend-mode)\s*:/u,
	);
	assert.doesNotMatch(styleSource, /\bblur\s*\(/u);
	assert.equal((styleSource.match(/will-change:\s*transform;/gu) ?? []).length, 1);
	assert.match(
		styleSource,
		/\.reel-spin-overlay:not\(\.settling\) \.reel-spin-column-layer\s*\{[^}]*will-change:\s*transform;/u,
	);
});

test('reduced motion disables rolling, fading and transform promotion', () => {
	const reducedMotionSource = styleSource.slice(
		styleSource.indexOf('@media (prefers-reduced-motion: reduce)'),
	);
	assert.notEqual(reducedMotionSource, '');
	assert.match(
		reducedMotionSource,
		/\.reel-spin-column-layer\s*\{[^}]*animation:\s*none;[^}]*will-change:\s*auto;/u,
	);
	assert.match(
		reducedMotionSource,
		/\.reel-column-window\s*\{[^}]*transition:\s*none;/u,
	);
});

test('page starts reel motion before authority returns and reveals each authoritative board left to right', () => {
	assert.match(pageSource, /import ReelSpinOverlay from '\.\.\/lib\/components\/ReelSpinOverlay\.svelte';/u);
	assert.match(pageSource, /async function executeLivePlay\(\)[\s\S]*?beginReelMotion\(\);[\s\S]*?await liveSession\.play/u);
	assert.match(pageSource, /case 'feature_cycle':[\s\S]*?beginReelMotion\(\);/u);
	assert.match(pageSource, /case 'board_snapshot':[\s\S]*?settleReelMotion\(\{[\s\S]*?board: cue\.event\?\.board/u);
	assert.match(
		pageSource,
		/<ReelSpinOverlay[\s\S]*?active=\{reelMotionActive\}[\s\S]*?stripSources=\{activeReelStripSources\}[\s\S]*?settling=\{reelMotionSettling\}[\s\S]*?lockedReels=\{reelMotionLockedReels\}[\s\S]*?turbo=\{turboEnabled\}/u,
	);
	assert.match(pageSource, /activeReelStripSources = BLACKSITE_ASSETS\.ui\.reelStrips;/u);
	assert.match(pageSource, /NORMAL_REEL_SETTLE_MS = 420/u);
	assert.match(pageSource, /TURBO_REEL_SETTLE_MS = 30/u);
});

test('two authoritative VAULT reels before reel five create a bounded final-reel anticipation beat', () => {
	assert.match(pageSource, /NORMAL_VAULT_ANTICIPATION_MS = 780/u);
	assert.match(pageSource, /TURBO_VAULT_ANTICIPATION_MS = 180/u);
	assert.match(pageSource, /const secondVaultReel = vaultReels\[1\] \?\? -1;/u);
	assert.match(pageSource, /secondVaultReel >= 0 && secondVaultReel < 4/u);
	assert.match(pageSource, /reelMotionLockedReels = holdsForVault \? vaultReels : \[\];/u);
	assert.match(pageSource, /allowAnticipation: context\.origin !== 'restore'/u);
	assert.match(pageSource, /anticipating=\{reelMotionAnticipating\}/u);
	assert.match(componentSource, /lockedThroughReel = authoritativeVaultReels\.length >= 2 \? authoritativeVaultReels\[1\] : -1/u);
	assert.match(componentSource, /class:locked-reel=\{anticipating && columnIndex <= lockedThroughReel\}/u);
	assert.match(componentSource, /class:searching-reel=\{anticipating && columnIndex > lockedThroughReel\}/u);
	assert.match(componentSource, /\.reel-spin-overlay\.anticipating \.reel-column-window\.searching-reel \.reel-spin-column-layer/u);
	const searchBlock = styleSource.match(
		/\.reel-spin-overlay\.anticipating \.reel-column-window\.searching-reel \.reel-spin-column-layer\s*\{([^}]*)\}/u,
	)?.[1] ?? '';
	const turboSearchBlock = styleSource.match(
		/\.reel-spin-overlay\.turbo\.anticipating \.reel-column-window\.searching-reel \.reel-spin-column-layer\s*\{([^}]*)\}/u,
	)?.[1] ?? '';
	assert.equal(timingValue(searchBlock, 'spin-duration'), 1_080);
	assert.equal(timingValue(turboSearchBlock, 'spin-duration'), 360);
	assert.match(pageSource, /return new Promise\(\(resolve\) => \{/u);
	assert.match(pageSource, /reelMotionPresentationResolve = resolve;/u);
	assert.match(pageSource, /cueId: 'anticipation\.confirmed'/u);
	assert.match(pageSource, /setOperatorReaction\('vault-anticipation'\)/u);
	assert.doesNotMatch(componentSource, /nth-child\(/u);
	assert.doesNotMatch(pageSource, /Math\.random/u);
});
