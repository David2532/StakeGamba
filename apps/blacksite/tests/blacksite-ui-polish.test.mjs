import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const v37Source = pageSource.slice(pageSource.indexOf('V37 HARD CLEAN'));
const hudRestoreSource = v37Source.slice(
	v37Source.indexOf('/* V38 HUD ASSET RESTORE'),
	v37Source.indexOf('/* Free spins have one persistent telemetry rail.'),
);
const shortLandscapeSource = v37Source.slice(
	v37Source.lastIndexOf('@media (max-height: 560px) and (min-aspect-ratio: 2 / 1)'),
	v37Source.lastIndexOf('@media (prefers-reduced-motion: reduce)'),
);

test('V39 snapshot keeps V37 as the final in-component polish owner', () => {
	assert.match(pageSource, /class:blacksite-ui-v37=\{devUiV22Enabled\}/u);
	assert.match(pageSource, /data-polish-revision=\{devUiV22Enabled \? 'repo-snapshot-v39' : undefined\}/u);
	assert.doesNotMatch(pageSource, /blacksite-ui-polish\.css/u);
	assert.match(v37Source, /V38 HUD ASSET RESTORE[\s\S]*?<\/style>/u);
});

test('authored V22 and V27 rasters own the HUD chrome again', () => {
	const featureCardBlock = /feature-strip > :global\(\.feature-hud-surface\) \{([^}]*)\}/u.exec(v37Source)?.[1] ?? '';
	assert.match(pageSource, /V22 machine rasters already own the complete physical HUD chrome/u);
	assert.match(pageSource, /class="v27-responsive-hud-rail"[\s\S]*?<UiSurface enabled kit=\{BLACKSITE_ASSETS\.ui\.v27\}/u);
	assert.doesNotMatch(v37Source, /\.premium-hud \.v27-responsive-hud-rail/u);
	assert.doesNotMatch(v37Source, /\.premium-hud \.premium-panel-art/u);
	assert.doesNotMatch(v37Source, /\.premium-hud :global\(\.hud-icon--v21 > \.ui-surface\)/u);
	assert.doesNotMatch(v37Source, /\.app-shell\.blacksite-ui-v37 \.premium-hud \{/u);
	assert.doesNotMatch(v37Source, /\.app-shell\.blacksite-ui-v37 \.control-deck \.bet-step \{/u);
	assert.doesNotMatch(v37Source, /\.app-shell\.blacksite-ui-v37 \.control-deck \.reel-spin \{/u);
	assert.doesNotMatch(v37Source, /feature-hud-surface > \.ui-surface\)[^{]*\{\s*display:\s*none/u);
	assert.doesNotMatch(featureCardBlock, /border:|background:|box-shadow:/u);
	assert.doesNotMatch(pageSource, /content:\s*'BLACKOUT ACTIVE'/u);
});

test('HUD restoration changes alignment only and centres every live layer', () => {
	assert.match(hudRestoreSource, /\.premium-hud :is\([\s\S]*?\.hud-tools \.round-tool,[\s\S]*?\.control-deck \.bet-step,[\s\S]*?\.control-deck \.reel-spin[\s\S]*?> :global\(\.hud-icon\) \{[\s\S]*?position: absolute !important;[\s\S]*?inset: 0 !important;[\s\S]*?margin: auto !important;[\s\S]*?transform: none !important;/u);
	assert.match(hudRestoreSource, /\.reel-bet-control,[\s\S]*?\.balance-meter,[\s\S]*?\.control-meter[\s\S]*?justify-items: center !important;[\s\S]*?text-align: center !important;/u);
	assert.match(hudRestoreSource, /\.hud-tool-label,[\s\S]*?\.responsive-spin-label[\s\S]*?left: 50% !important;[\s\S]*?text-align: center !important;[\s\S]*?transform: translateX\(-50%\) !important;/u);
	assert.equal((pageSource.match(/class="hud-tool-label"/gu) ?? []).length, 6);
	assert.doesNotMatch(hudRestoreSource, /border:|border-radius:|background:|box-shadow:/u);
});

test('phone controls register to the six authored circular wells', () => {
	assert.match(pageSource, /@media \(max-width: 380px\) and \(max-height: 700px\) and \(orientation: portrait\) \{\s*\.app-shell\.dev-ui-v21 \.compact-value-strip/u);
	assert.match(pageSource, /@media \(max-width: 480px\) and \(min-height: 431px\) and \(orientation: portrait\) \{\s*\.app-shell\.blacksite-ui-v36 \.monitor-identity/u);
	assert.match(v37Source, /@media \(max-width: 480px\) and \(min-height: 431px\) and \(orientation: portrait\) \{[\s\S]*?\.premium-hud \.hud-tools \{[\s\S]*?display: grid !important;/u);
	assert.match(v37Source, /390x844 shell owns one six-well row[\s\S]*?\.premium-hud \.hud-tools \{[\s\S]*?top: 66% !important;[\s\S]*?bottom: auto !important;[\s\S]*?height: 22% !important;/u);
	assert.match(v37Source, /\.premium-hud \.hud-tools-left \{\s*left: 2% !important;\s*width: 46% !important;/u);
	assert.match(v37Source, /\.premium-hud \.hud-tools-right \{\s*left: 52% !important;\s*width: 46% !important;/u);
	assert.match(v37Source, /320x568 shell owns two authored rows[\s\S]*?\.premium-hud \.hud-tools-left \{ top: 51% !important; \}[\s\S]*?\.premium-hud \.hud-tools-right \{ top: 73% !important; \}/u);
	assert.match(v37Source, /@media \(max-width: 380px\) and \(min-height: 431px\) and \(max-height: 700px\) and \(orientation: portrait\)/u);
	assert.doesNotMatch(v37Source, /@media \(max-width: 480px\) and \(orientation: portrait\) \{[\s\S]*?\.premium-hud \.hud-tools \{[\s\S]*?display: grid !important;/u);
	assert.doesNotMatch(v37Source, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\) !important/u);
});

test('base facts share one baseline and the obsolete footer cannot cover controls', () => {
	assert.match(pageSource, /\.reel-mechanic-strip:not\(\.feature-strip\) > :global\(\.feature-hud-surface\) \{[\s\S]*?display: flex !important;[\s\S]*?align-items: center !important;[\s\S]*?justify-content: center !important;/u);
	assert.match(pageSource, /\.status-plate,\s*\.app-shell\.blacksite-ui-v37 \.reel-footer,[\s\S]*?display: none !important;/u);
});

test('free spins retain one telemetry rail and the real target asset', () => {
	assert.match(pageSource, /\.breach-monitor\.feature-active \.reel-mechanic-strip\.feature-strip \{[\s\S]*?grid-template-columns: minmax\(0, 1\.2fr\) minmax\(0, 1\.25fr\) minmax\(0, \.8fr\)/u);
	assert.match(pageSource, /data-feature-hud-kind='target'[\s\S]*?\.feature-hud-surface__icon\) \{[\s\S]*?min-width: 48px !important;[\s\S]*?min-height: 48px !important;/u);
	assert.match(pageSource, /<FeatureHudSurface enabled kind="target"[\s\S]*?iconSrc=\{featureTargetAsset\}/u);
	assert.match(pageSource, /<span>BLACKOUT<\/span><strong>REELS IN MOTION<\/strong>/u);
	assert.doesNotMatch(pageSource, /<span>FREE SPIN \{featureSpin\} OF \{featureSpinsAwarded\}<\/span>/u);
});

test('portrait free-spin telemetry separates remaining spins without rebuilding the HUD', () => {
	assert.match(pageSource, /data-feature-hud-kind='progress'\]\) \{\s*grid-template-columns: minmax\(0, 1fr\) !important;\s*grid-template-rows: auto minmax\(0, 1fr\) auto !important;/u);
	assert.match(pageSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__secondary\) \{[\s\S]*?grid-row: 3 !important;[\s\S]*?grid-column: 1 !important;/u);
	assert.doesNotMatch(v37Source, /\.breach-monitor\.feature-active \.control-deck \.balance-meter/u);
	assert.doesNotMatch(v37Source, /\.breach-monitor\.feature-active \.premium-hud/u);
});

test('dialogs keep the separate V37 readability polish', () => {
	assert.match(pageSource, /\.modal-backdrop > :is\(\.menu-dialog, \.mode-dialog, \.confirmation-dialog, \.rules-dialog, \.auto-dialog, \.settings-dialog\) \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) !important;[\s\S]*?overflow: hidden !important;/u);
	assert.match(pageSource, /\.premium-dialog-frame,[\s\S]*?display: none !important;/u);
	assert.match(pageSource, /\.mode-dialog-list \.mode-card-effect \{[\s\S]*?font-size: 12px !important;[\s\S]*?line-height: 1\.42 !important;[\s\S]*?line-clamp: unset !important;/u);
	assert.match(pageSource, /\.game-guide-panel :is\(p, small\),[\s\S]*?font-size: 12\.5px !important;[\s\S]*?line-height: 1\.52 !important;/u);
});

test('mobile dialogs remain reachable while short landscape keeps authored HUD geometry', () => {
	assert.match(pageSource, /@media \(max-width: 700px\)[\s\S]*?width: 100vw !important;[\s\S]*?height: 100dvh !important;/u);
	assert.match(pageSource, /\.v27-modal-header > button \{[\s\S]*?width: 46px !important;[\s\S]*?height: 46px !important;/u);
	assert.match(pageSource, /\.guide-tabs \{[\s\S]*?display: flex !important;[\s\S]*?overflow-x: auto !important;/u);
	assert.match(shortLandscapeSource, /@media \(min-width: 701px\) \{[\s\S]*?\.premium-hud \.hud-tools-right \{[\s\S]*?width: 15\.7% !important;/u);
	assert.match(shortLandscapeSource, /\.premium-hud \.total-meter > \.hud-meter-label \{[\s\S]*?font-size: 7px !important;[\s\S]*?letter-spacing: \.02em !important;[\s\S]*?white-space: nowrap !important;/u);
	assert.doesNotMatch(shortLandscapeSource, /control-deck/u);
});
