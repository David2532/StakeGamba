import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const operatorRuntimeSource = await readFile(
	new URL('../src/lib/runtime/operator-animation-director.js', import.meta.url),
	'utf8',
);
const standaloneFxRuntimeSource = await readFile(
	new URL('../src/lib/runtime/standalone-fx-director.js', import.meta.url),
	'utf8',
);
const performanceGuard = pageSource.slice(pageSource.indexOf('/* Performance guard:'));

test('normal presentation keeps the reels visible for more than two frames', () => {
	assert.match(
		pageSource,
		/NORMAL_PLAYBACK_TIMING = Object\.freeze\(\{ stepDelayMs: 650, winDelayMs: 900 \}\)/,
	);
	assert.match(
		pageSource,
		/TURBO_PLAYBACK_TIMING = Object\.freeze\(\{ stepDelayMs: 55, winDelayMs: 160 \}\)/,
	);
	assert.match(
		pageSource,
		/WIN_ROLLUP_DURATION_MS = Object\.freeze\(\{ big: 650, top: 900, turbo: 120 \}\)/,
	);
});

test('optional visual assets warm in bounded idle batches and pause during presentation', () => {
	assert.match(pageSource, /const batchSize = idleBudgetMs >= 10 \? 2 : 1/u);
	assert.match(pageSource, /deferredVisualUrls\.slice\([\s\S]*?deferredVisualPreloadCursor \+ batchSize/u);
	assert.match(
		pageSource,
		/document\.hidden \|\| primaryBusy \|\| reelMotionActive \|\| vaultCinematicState\.active \|\| modalOpen/u,
	);
	assert.doesNotMatch(pageSource, /deferredVisualUrls\.map\(\(url\) =>/u);
});

test('final performance guard delegates reel motion to five bounded column layers', () => {
	assert.notEqual(performanceGuard, '');
	assert.match(pageSource, /import ReelSpinOverlay from '\.\.\/lib\/components\/ReelSpinOverlay\.svelte';/u);
	assert.match(
		pageSource,
		/<ReelSpinOverlay[\s\S]*?active=\{reelMotionActive\}[\s\S]*?settling=\{reelMotionSettling\}/u,
	);
	assert.match(
		performanceGuard,
		/reel-grid \.reel-cell \.symbol-art \{[\s\S]*?animation: none !important;/,
	);
	assert.match(
		performanceGuard,
		/reel-grid\[data-spinning='true'\][\s\S]*?animation: none !important;[\s\S]*?will-change: auto;/u,
	);
	assert.doesNotMatch(
		performanceGuard,
		/reel-grid\[data-spinning='true'\] \.reel-cell \.symbol-art \{[\s\S]*?animation:/,
	);
});

test('canonical Penguin owns the visible operative surface while the legacy fallback remains double-buffered', () => {
	assert.match(pageSource, /data-phase=\{visualPhase\}/);
	assert.match(pageSource, /\{#if penguinOperatorEnabled\}[\s\S]*?<PenguinOperator state=\{penguinOperatorState\} suspended=\{operatorSuspended\} \/>[\s\S]*?\{:else\}/u);
	assert.match(pageSource, /OPERATOR_BUFFER_INDICES = Object\.freeze\(\[0, 1\]\)/u);
	assert.match(pageSource, /\{#each OPERATOR_BUFFER_INDICES as bufferIndex \(bufferIndex\)\}/u);
	assert.match(pageSource, /'operative-animation-frame'[\s\S]*?: 'operative-animation-buffer'/u);
	assert.match(
		pageSource,
		/data-sequence=\{penguinOperatorEnabled \? penguinOperatorState : operatorVisibleFrame\.sequence\}/u,
	);
	assert.match(pageSource, /data-sequence=\{operatorFrameBuffers\[bufferIndex\]\.sequence\}/u);
	assert.match(pageSource, /data-frame-index=\{operatorFrameBuffers\[bufferIndex\]\.frameIndex\}/u);
	assert.match(pageSource, /await image\.decode\(\)/u);
	assert.equal((pageSource.match(/surfaceManagedDecoding: true/gu) ?? []).length, 2);
	assert.match(pageSource, /nextFrame\.generation !== operatorFrame\?\.generation/u);
	assert.doesNotMatch(pageSource, /\|\| operatorPendingFrame !== null/u);
	assert.match(performanceGuard, /\.operative-frame\.operative-frame-active \{[\s\S]*?visibility: visible;/u);
	assert.doesNotMatch(
		pageSource,
		/\{#each\s+Object\.entries\(BLACKSITE_ASSETS\.character\.poses\)/u,
	);
	assert.doesNotMatch(pageSource, /<div\s+class=["']operative-pose-stack["']/u);
	assert.match(performanceGuard, /backdrop-filter: none;/);
});

test('operator frame playback uses rAF with a bounded decode cache and explicit fallbacks', () => {
	assert.match(operatorRuntimeSource, /DEFAULT_CACHE_LIMIT = 12/u);
	assert.match(operatorRuntimeSource, /requestAnimationFrame/u);
	assert.match(operatorRuntimeSource, /class FrameDecodeCache/u);
	assert.match(operatorRuntimeSource, /while \(this\.entries\.size > this\.maxEntries\)/u);
	assert.match(operatorRuntimeSource, /frames\.slice\(0, framesPerSequence\)/u);
	assert.match(operatorRuntimeSource, /reportFrameError\(source\)/u);
	assert.match(operatorRuntimeSource, /prefers-reduced-motion: reduce/u);
	assert.match(operatorRuntimeSource, /documentIsHidden/u);
	assert.doesNotMatch(operatorRuntimeSource, /setInterval\(/u);
});

test('standalone FX uses two persistent buffers and exposes one decoded active frame only', () => {
	assert.match(pageSource, /catalog: OPERATOR_FX_CATALOG/u);
	assert.doesNotMatch(pageSource, /OPERATOR_FX_DEV_V22_CATALOG/u);
	assert.match(pageSource, /data-testid=["']standalone-fx["']/u);
	assert.match(pageSource, /data-active=\{standaloneFxVisibleFrame\.active \? 'true' : 'false'\}/u);
	assert.match(pageSource, /'standalone-fx-frame'[\s\S]*?: 'standalone-fx-buffer'/u);
	assert.match(pageSource, /class:standalone-fx-frame-active=\{standaloneFxVisibleFrame\.active/u);
	assert.match(pageSource, /while \(standaloneFxPendingFrame\)/u);
	assert.match(pageSource, /await decodeMountedFrame\(standaloneFxElements\[pendingBuffer\], source, 'standalone FX'\)/u);
	assert.match(pageSource, /data-name=\{standaloneFxVisibleFrame\.name \?\? ''\}/u);
	assert.match(pageSource, /data-frame-index=\{standaloneFxVisibleFrame\.frameIndex\}/u);
	assert.match(pageSource, /nextFrame\.generation !== standaloneFxFrame\.generation/u);
	assert.doesNotMatch(pageSource, /\|\| standaloneFxPendingFrame !== null/u);
	assert.match(performanceGuard, /\.standalone-fx-frame\.standalone-fx-frame-active \{[\s\S]*?visibility: visible;/u);
});

test('standalone FX playback uses rAF, bounded decode and reduced-motion/error hooks', () => {
	assert.match(standaloneFxRuntimeSource, /MAX_DECODED_FRAMES = 8/u);
	assert.match(standaloneFxRuntimeSource, /requestAnimationFrame/u);
	assert.match(standaloneFxRuntimeSource, /class StandaloneFxDecodeCache/u);
	assert.match(standaloneFxRuntimeSource, /reportFrameError\(source/u);
	assert.match(standaloneFxRuntimeSource, /setSuspended\(enabled\)/u);
	assert.match(standaloneFxRuntimeSource, /prefers-reduced-motion: reduce/u);
	assert.doesNotMatch(standaloneFxRuntimeSource, /setInterval\(/u);
});
