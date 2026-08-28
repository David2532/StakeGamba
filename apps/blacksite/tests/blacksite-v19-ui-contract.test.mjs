import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { BLACKSITE_ASSETS } from '../src/lib/assets/blacksite-assets.js';

const sourceRoot = new URL('../src/', import.meta.url);
const pageSource = await readFile(new URL('routes/+page.svelte', sourceRoot), 'utf8');
const featureHudSource = await readFile(new URL('lib/components/FeatureHudSurface.svelte', sourceRoot), 'utf8');
const uiSurfaceSource = await readFile(new URL('lib/components/UiSurface.svelte', sourceRoot), 'utf8');
const cinematicStatusSource = await readFile(new URL('lib/components/CinematicStatusSurface.svelte', sourceRoot), 'utf8');
const vaultCinematicSource = await readFile(new URL('lib/components/VaultCinematic.svelte', sourceRoot), 'utf8');

async function collectSvelteSources(directoryUrl, prefix = '') {
	const entries = await readdir(directoryUrl, { withFileTypes: true });
	const records = [];
	for (const entry of entries) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			records.push(...await collectSvelteSources(new URL(`${entry.name}/`, directoryUrl), relativePath));
		} else if (entry.isFile() && entry.name.endsWith('.svelte')) {
			records.push({
				path: relativePath,
				source: await readFile(new URL(entry.name, directoryUrl), 'utf8'),
			});
		}
	}
	return records;
}

const svelteSources = await collectSvelteSources(sourceRoot);
const combinedSvelteSource = svelteSources.map(({ path, source }) => `\n/* ${path} */\n${source}`).join('\n');

function sourceBetween(source, startMarker, endMarker) {
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start + startMarker.length);
	assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
	assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
	return source.slice(start, end);
}

function assertOrderedText(source, labels, message) {
	let cursor = -1;
	for (const label of labels) {
		const next = source.indexOf(label, cursor + 1);
		assert.ok(next > cursor, `${message}: missing or out-of-order ${label}`);
		cursor = next;
	}
}

function assertStableHook(hook, { count = 1 } = {}) {
	const matches = combinedSvelteSource.match(new RegExp(`data-testid=["']${hook}["']`, 'gu')) ?? [];
	assert.equal(matches.length, count, `${hook} must be declared exactly ${count} time(s)`);
}

function assertDeclaredHook(hook) {
	const pattern = new RegExp(
		`data-testid=(?:["']${hook}["']|\\{[^}]*["']${hook}["'][^}]*\\})`,
		'u',
	);
	assert.match(combinedSvelteSource, pattern, `${hook} must be exposed as a stable test hook`);
}

test('V19 Operations Hub exposes exactly Continue, Select Mode and Game Guide entry hooks', () => {
	for (const hook of [
		'operations-hub-dialog',
		'operations-hub-continue',
		'operations-hub-select-mode',
		'operations-hub-game-guide',
	]) {
		assertStableHook(hook);
	}
	assert.doesNotMatch(combinedSvelteSource, /openSettingsFromMenu/u);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']operations-hub-settings["']/u);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']operations-hub-how-to-play["']/u);
});

test('Operations Hub uses the canonical three-row copy and exposes active mode plus exact total', () => {
	const hubSource = sourceBetween(pageSource, '{#if menuOpen}', '{#if modeDialogOpen}');
	assert.match(hubSource, /<h2[^>]*>OPERATIONS HUB<\/h2>/u);
	assertOrderedText(
		hubSource,
		['CONTINUE OPERATION', 'SELECT MODE', 'GAME GUIDE'],
		'Operations Hub action order',
	);
	assert.doesNotMatch(hubSource, />\s*SETTINGS\s*</u);
	assert.match(
		hubSource,
		/getModeLabel\(selectedMode\.id,\s*social\)[\s\S]*totalAmountText/u,
		'Select Mode row must summarize the active mode and current authenticated total',
	);
});

test('INFO and Operations Hub target one five-tab Game Guide implementation', () => {
	assertStableHook('hud-info');
	assertStableHook('game-guide-dialog');
	assertStableHook('game-guide-scroll');
	const guideTabs = /const GUIDE_TABS = Object\.freeze\(\[([\s\S]*?)\]\);/u.exec(pageSource);
	assert.ok(guideTabs, 'page declares the five Guide tab identities');
	assert.deepEqual(
		[...guideTabs[1].matchAll(/id:\s*'([^']+)'/gu)].map((match) => match[1]),
		['overview', 'symbols', 'modes', 'vault', 'controls'],
	);
	assert.match(combinedSvelteSource, /data-testid=\{`game-guide-tab-\$\{tab\.id\}`\}/u);
	assert.match(
		combinedSvelteSource,
		/<button[^>]*data-testid=\{`game-guide-tab-\$\{tab\.id\}`\}[^>]*role=["']tab["'][^>]*aria-selected=/u,
	);
	assertStableHook('game-guide-panel');
	assert.match(combinedSvelteSource, /data-testid=["']game-guide-panel["'][^>]*role=["']tabpanel["']/u);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']rules-dialog["']/u);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']how-to-play-content["']/u);
});

test('BUY and Operations Hub share one Mode Select surface and the three authoritative mode hooks', () => {
	assertStableHook('hud-shop');
	assertStableHook('mode-dialog');
	assert.match(combinedSvelteSource, /data-testid=\{`mode-\$\{mode\.id\}`\}/u);
	assert.equal(
		(combinedSvelteSource.match(/data-testid=["']mode-dialog["']/gu) ?? []).length,
		1,
		'there must not be a second divergent Mode Select implementation',
	);
});

test('Mode Select renders contract copy, exact cost, total amount and a visible selection state', () => {
	const modeSource = sourceBetween(pageSource, '{#if modeDialogOpen}', '{#if confirmationOpen}');
	assert.match(modeSource, /ENTRY PROTOCOL/u);
	assert.match(modeSource, /<h2[^>]*>\{devFixtureUiPreview \? 'CURRENT MODE' : 'SELECT MODE'\}<\/h2>/u);
	assert.match(modeSource, /\{getModeLabel\(mode\.id,\s*social\)\}/u);
	assert.match(modeSource, /\{displaySpecialSymbolCopy\(getModeActionDescription\(mode\.id,\s*social\)\)\}/u);
	assert.match(modeSource, /\{mode\.costMultiplier\}[^<]*[x\u00d7]/u);
	assert.match(
		modeSource,
		/(?:modeTotalText|totalAmountText|safeTotalAmount|totalPlayAmountApi)/u,
		'each illustrated mode card must expose its current total amount',
	);
	assert.match(
		modeSource,
		/(?:ACTIVE|CURRENT|PREVIEW|SELECT|UNAVAILABLE)/u,
		'each mode card must expose a visible current, selectable, preview or unavailable state',
	);
});

test('V19 removes the HOW TO PLAY primary, keeps a passive status plate and renders no reel captions', () => {
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']info-action["']/u);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']how-to-play-primary["']/u);
	assertStableHook('status-plate');
	const statusOpeningTag = /<([a-z][\w:-]*)\b[^>]*data-testid=["']status-plate["'][^>]*>/iu.exec(
		combinedSvelteSource,
	);
	assert.ok(statusOpeningTag, 'status plate has a concrete DOM element');
	assert.notEqual(statusOpeningTag[1].toLowerCase(), 'button', 'status plate is not a button');
	assert.doesNotMatch(statusOpeningTag[0], /(?:on:click|onclick|role=["']button["']|tabindex=["']0["'])/iu);
	assert.doesNotMatch(combinedSvelteSource, /class=["'][^"']*\bsymbol-code\b/iu);
	assert.doesNotMatch(combinedSvelteSource, /data-testid=["']reel-symbol-caption["']/iu);
});

test('DEV v21 header keeps selected mode identity visible without creating a second live region', () => {
	assertStableHook('selected-mode-carrier');
	const headerSource = sourceBetween(pageSource, '<header class="monitor-header">', '</header>');
	assert.match(headerSource, /\{#if devUiV21Enabled\}[\s\S]*?data-testid="selected-mode-carrier"/u);
	assert.match(headerSource, /data-mode-id=\{selectedModeId\}/u);
	assert.match(headerSource, /getModeLabel\(selectedModeId, social\)/u);
	assert.match(headerSource, /selectedMode\.costMultiplier/u);
	assert.doesNotMatch(headerSource.slice(headerSource.indexOf('selected-mode-carrier'), headerSource.indexOf('{#if devUiV21Enabled && cinematicLifecycle}')), /aria-live=/u);
	assert.match(pageSource, /\.app-shell\.dev-ui-v21 \.selected-mode-carrier/u);
	assert.match(pageSource, /grid-template-rows:\s*auto minmax\(22px, 1fr\);/u);
	assert.match(pageSource, /replayLoading\s*\?\s*'LOADING REPLAY'/u);
});

test('internal breach id presents package-local VAULT WebP art in every exposed state', () => {
	const breachStates = BLACKSITE_ASSETS.symbols?.states?.breach;
	assert.ok(breachStates && typeof breachStates === 'object');
	assert.ok(Object.keys(breachStates).length >= 3, 'VAULT exposes idle/win/dim or richer visual states');
	for (const [state, assetPath] of Object.entries(breachStates)) {
		assert.match(assetPath, /^assets\/blacksite\//u, `${state} is package-local`);
		assert.match(assetPath, /vault/iu, `${state} identifies the V19 Vault art family`);
		assert.match(assetPath, /\.webp$/iu, `${state} is a WebP runtime raster`);
		assert.doesNotMatch(assetPath, /(?:^|\/)\.\.?\//u, `${state} cannot traverse directories`);
	}
});

test('high-cost confirmation exposes all authoritative values and a START second action', () => {
	assertStableHook('confirmation-dialog');
	for (const field of ['mode', 'base', 'multiplier', 'total', 'effect']) {
		assertStableHook(`confirmation-${field}`);
	}
	assertStableHook('confirmation-start');
	assert.doesNotMatch(combinedSvelteSource, /Confirm complete play amount/iu);
});

test('high-cost confirmation uses the canonical ledger labels and action copy', () => {
	const confirmationSource = sourceBetween(pageSource, '{#if confirmationOpen}', '{#if rulesOpen}');
	assert.match(
		confirmationSource,
		/<h2[^>]*data-testid=["']confirmation-mode["'][^>]*>\{devFixtureUiPreview \? 'MODE PREVIEW' : 'CONFIRM'\}\s+\{getModeLabel\(selectedMode\.id,\s*social\)\}<\/h2>/u,
	);
	assertOrderedText(
		confirmationSource,
		['BASE PLAY AMOUNT', 'MODE COST', 'COMPLETE PLAY AMOUNT'],
		'confirmation ledger',
	);
	const actionSource = sourceBetween(confirmationSource, '<div class="modal-actions"', '</div>');
	assert.match(actionSource, /class:preview-only=\{devFixtureUiPreview\}/u);
	const previewActionSource = sourceBetween(actionSource, '{#if devFixtureUiPreview}', '{:else}');
	assert.match(previewActionSource, /class="preview-close-action"[\s\S]*?>\s*<PanelStateArt[\s\S]*?<span>CLOSE PREVIEW<\/span>/u);
	assert.doesNotMatch(previewActionSource, /confirmation-start|disabled=/u);
	const liveActionSource = sourceBetween(actionSource, '{:else}', '{/if}');
	assert.match(liveActionSource, />\s*<PanelStateArt[\s\S]*?<span>CANCEL<\/span>/u);
	assert.match(
		liveActionSource,
		/data-testid="confirmation-start"[\s\S]*?<span>START \{getModeLabel\(selectedMode\.id, social\)\} — \{totalAmountText\}<\/span>/u,
		'live confirmation keeps the canonical START mode — total copy',
	);
	assert.doesNotMatch(confirmationSource, /disabled=\{devFixtureUiPreview\}|READ ONLY PREVIEW/u);
});

test('fixture mode preview copy is explicit and never renders a disabled START action', () => {
	const hubSource = sourceBetween(pageSource, '{#if menuOpen}', '{#if modeDialogOpen}');
	assert.match(hubSource, /devFixtureUiPreview \? 'CURRENT MODE' : 'SELECT MODE'/u);

	const modeSource = sourceBetween(pageSource, '{#if modeDialogOpen}', '{#if confirmationOpen}');
	assert.match(modeSource, /devFixtureUiPreview \? 'CURRENT MODE' : 'SELECT MODE'/u);

	const confirmationSource = sourceBetween(pageSource, '{#if confirmationOpen}', '{#if rulesOpen}');
	assert.match(confirmationSource, /devFixtureUiPreview \? 'MODE PREVIEW' : 'CONFIRM'/u);
	const actionSource = sourceBetween(confirmationSource, '<div class="modal-actions"', '</div>');
	const previewActionSource = sourceBetween(actionSource, '{#if devFixtureUiPreview}', '{:else}');
	assert.match(previewActionSource, />CLOSE PREVIEW</u);
	assert.doesNotMatch(previewActionSource, /confirmation-start|START \{|disabled=/u);
});

test('V19 Vault scenes, mode key art and trigger states join the controlled async preload set', () => {
	const preloadSource = sourceBetween(
		pageSource,
		'const requiredVisualUrls = Array.from(new Set([',
		'void (async () => {',
	);
	for (const collection of [
		'BLACKSITE_ASSETS.v19.vaultSymbol',
		'BLACKSITE_ASSETS.v19.scenes',
		'BLACKSITE_ASSETS.v19.modes',
	]) {
		assert.match(
			preloadSource,
			new RegExp(`\\.\\.\\.Object\\.values\\(${collection.replaceAll('.', '\\.') }\\)`, 'u'),
			`${collection} must be in the V19 preload set`,
		);
	}
	assert.match(preloadSource, /image\.decoding\s*=\s*['"]async['"]/u);
	assert.match(preloadSource, /Promise\.all\(visualPreloadImages\.map\(\(image\)\s*=>\s*image\.decode\(\)\)\)/u);
	assert.match(preloadSource, /ASSET_LOAD_ERROR/u);
});

test('Vault presentation exposes deterministic state, skip, access, extraction and return hooks', () => {
	for (const hook of [
		'vault-cinematic',
		'vault-cinematic-skip',
		'return-to-base',
	]) {
		assertStableHook(hook);
	}
	assertDeclaredHook('vault-access-scene');
	assertDeclaredHook('extraction-report');
	assert.match(combinedSvelteSource, /data-vault-state=/u);
});

test('free-spin award and persistent feature HUD explain the authoritative eight-spin run', () => {
	for (const hook of [
		'vault-free-spins-award',
		'vault-free-spins-count',
		'vault-free-spins-target',
		'feature-progress',
		'feature-spins-remaining',
		'feature-target',
		'feature-running-win',
	]) {
		assertStableHook(hook);
	}
	assert.match(pageSource, /awardedSpins:\s*cue\.event\?\.awarded_free_spins/u);
	assert.match(pageSource, /awardedSpins:\s*cue\.event\?\.total_free_spins/u);
	assert.match(pageSource, /awardedSpins:\s*state\.totalFreeSpins/u);
	assert.match(pageSource, /authoritativeFeatureActive\s*=\s*presentationActive/u);
	assert.match(pageSource, /FREE SPIN \$\{featureSpin\} OF \$\{featureSpinsAwarded\}/u);
	assert.doesNotMatch(pageSource, /featureSpin\s*\|\|\s*1/u);
	assert.match(pageSource, /reel-mechanic-strip:not\(\.feature-strip\)\s*\{\s*display:\s*none\s*!important;/u);
	assert.doesNotMatch(
		pageSource.slice(pageSource.indexOf('case \'feature_started\''), pageSource.indexOf("case 'feature_cycle'")),
		/(?:executeLivePlay|requestLivePlay|liveSession\.play|Math\.random)/u,
	);
});

test('feature HUD keeps a one-row shallow-rail fallback without presentation-side timing authority', () => {
	assert.match(featureHudSource, /data-feature-hud-has-secondary=\{hasSecondary \? 'true' : 'false'\}/u);
	const telemetrySource = featureHudSource.slice(featureHudSource.indexOf('/* Free-spin telemetry'));
	assert.match(
		telemetrySource,
		/\.feature-hud-surface:is\([\s\S]*?\[data-feature-hud-kind='progress'\],[\s\S]*?\[data-feature-hud-kind='target'\],[\s\S]*?\[data-feature-hud-kind='win'\][\s\S]*?\)\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\);[\s\S]*?align-items:\s*center;/u,
	);
	assert.match(telemetrySource, /\) \.feature-hud-surface__label\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*1;/u);
	assert.match(telemetrySource, /\) \.feature-hud-surface__value-row\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*2;/u);
	assert.match(
		telemetrySource,
		/data-feature-hud-kind='progress'\] \.feature-hud-surface__secondary\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*3;/u,
	);
	assert.match(
		telemetrySource,
		/data-feature-hud-kind='target'\] \.feature-hud-surface__value-row,[\s\S]*?data-feature-hud-kind='win'\] \.feature-hud-surface__value-row\s*\{[\s\S]*?grid-column:\s*2 \/ -1;/u,
	);
	assert.doesNotMatch(featureHudSource, /(?:requestAnimationFrame|setTimeout|setInterval|Math\.random|rgs|wallet|payout)/iu);
});

test('five-tab Guide contains the canonical Vault timeline and derives RTP/max win from mode contracts', () => {
	const guideSource = sourceBetween(pageSource, '{#if rulesOpen}', '{#if autoDialogOpen}');
	const modePanel = sourceBetween(
		guideSource,
		"{:else if guideTab === 'modes'}",
		"{:else if guideTab === 'vault'}",
	);
	assert.match(modePanel, /\{#each MODES as mode\}/u);
	assert.match(modePanel, /mode\.targetRtp/u);
	assert.match(modePanel, /mode\.maxWinRaw/u);
	assert.doesNotMatch(modePanel, /RTP\s+96\.2(?:0)?%|MAX WIN\s+10000x/u);

	const vaultPanel = sourceBetween(
		guideSource,
		"{:else if guideTab === 'vault'}",
		'{:else}',
	);
	assert.match(vaultPanel, /\{#each VAULT_GUIDE_STEPS as step, index\}/u);
	const timelineDeclaration = /const VAULT_TIMELINE = Object\.freeze\(\[([\s\S]*?)\]\);/u.exec(pageSource)?.[1];
	assert.ok(timelineDeclaration, 'page declares the canonical Vault timeline once');
	assertOrderedText(
		timelineDeclaration,
		[
			'3\u00d7 VAULT',
			'TRIGGER LOCK',
			'WHEEL TURNS',
			'LOCKS RELEASE',
			'DOOR OPENS',
			'LIGHT ENTERS',
			'8 FREE SPINS',
			'BLACKOUT STARTS',
			'EXTRACTION',
		],
		'Vault Bonus semantic timeline',
	);
	assert.doesNotMatch(timelineDeclaration, /OPERATIVE HACK|VAULT ACCESS|TARGET ACQUIRED/iu);
	const guideDeclaration = /const VAULT_GUIDE_STEPS = Object\.freeze\(\[([\s\S]*?)\]\);/u.exec(pageSource)?.[1];
	assert.ok(guideDeclaration, 'page declares one concise player-facing BLACKOUT guide');
	assertOrderedText(
		guideDeclaration,
		['3 VAULTS TRIGGER', '1 OF 11 TARGETS IS CHOSEN', '8 FREE SPINS · TARGET EXPANDS', 'TOTAL WIN RETURNS TO BASE'],
		'concise BLACKOUT guide',
	);
	assert.match(vaultPanel, /\{#each RULES_CONTRACT\.feature as line\}/u);
	assert.equal(
		(vaultPanel.match(/RULES_CONTRACT\.feature/gu) ?? []).length,
		1,
		'the BLACKOUT guide renders the canonical feature copy once instead of duplicating it below the timeline',
	);
});

test('V19 presentation surfaces and runtime asset references remain raster-only and non-authoritative', () => {
	const v19AssetPaths = [
		...Object.values(BLACKSITE_ASSETS.v19.vaultSymbol),
		...Object.values(BLACKSITE_ASSETS.v19.scenes),
		...Object.values(BLACKSITE_ASSETS.v19.modes),
	];
	assert.ok(v19AssetPaths.length >= 10, 'focused V19 contract includes the shipped Vault, scene and mode rasters');
	for (const assetPath of v19AssetPaths) {
		assert.match(assetPath, /^assets\/blacksite\/.*\.webp$/u);
		assert.doesNotMatch(assetPath, /\.svg(?:$|[?#])/iu);
	}
	assert.doesNotMatch(combinedSvelteSource, /<svg\b|data:image\/svg\+xml|\.svg(?:["'?#)])/iu);
});

test('one global mute control mirrors an observable app-wide audio state', () => {
	assertStableHook('global-mute-toggle');
	assert.match(combinedSvelteSource, /data-audio-muted=/u);
	const muteOpeningTag = /<button\b[^>]*data-testid=["']global-mute-toggle["'][^>]*>/iu.exec(
		combinedSvelteSource,
	);
	assert.ok(muteOpeningTag, 'global mute hook belongs to a native button');
	assert.match(muteOpeningTag[0], /aria-pressed=/u);
});

test('V22 cabinet chrome remains the single visible HUD surface owner', () => {
	assert.equal(
		(pageSource.match(/class="premium-hud"[^>]*data-testid="bottom-hud"/gu) ?? []).length,
		1,
		'the page must expose exactly one interactive HUD container',
	);
	const singleChromeSource = sourceBetween(
		pageSource,
		'/* V22 machine rasters already own the complete physical HUD chrome.',
		'.app-shell.dev-ui-v22 :is(\n\t\t.amount-control,',
	);
	assert.match(singleChromeSource, /\.premium-hud :global\(\.hud-icon--v21 > \.ui-surface\)/u);
	assert.match(singleChromeSource, /\.premium-hud \.premium-panel-art/u);
	assert.match(singleChromeSource, /\.result-ticker \.premium-panel-art/u);
	assert.match(singleChromeSource, /display:\s*none;/u);
	assert.doesNotMatch(singleChromeSource, /ui-glyph|button\s*\{/u);

	const precisionNativeSource = sourceBetween(
		pageSource,
		'/* Final V22 precision pass.',
		'.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button {',
	);
	assert.match(precisionNativeSource, /\.premium-hud :global\(\.hud-icon__v21-fallback\)/u);
	assert.match(precisionNativeSource, /display:\s*none;/u);
});

test('V22 reflow profiles restore live surfaces above exactly one opaque rail', () => {
	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const tabletRailSource = sourceBetween(
		precisionSource,
		'@media (min-width: 481px) and (max-width: 1040px) and (min-height: 561px),',
		'@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.equal((tabletRailSource.match(/\.premium-hud::before/gu) ?? []).length, 1);
	assert.match(tabletRailSource, /\.premium-hud::before\s*\{[\s\S]*?z-index:\s*0;[\s\S]*?background:[\s\S]*?rgba\(3, 6, 7, \.995\)[\s\S]*?content:\s*'';[\s\S]*?pointer-events:\s*none;/u);
	assert.match(tabletRailSource, /\.premium-hud :is\(\.round-tool, \.bet-step, \.reel-bet-control, \.reel-spin\)\s*\{\s*z-index:\s*1;/u);
	assert.match(
		tabletRailSource,
		/\.premium-hud :global\(\.hud-icon--v21 > \.ui-surface\),[\s\S]*?\.reel-bet-control \.premium-panel-art\s*\{\s*display:\s*block;/u,
	);
	assert.doesNotMatch(tabletRailSource, /hud-icon__v21-fallback[\s\S]*?display:\s*block/u);

	const shortRailSource = sourceBetween(
		precisionSource,
		'@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(shortRailSource, /\.premium-hud\s*\{[\s\S]*?isolation:\s*isolate;[\s\S]*?background:[\s\S]*?rgba\(3, 6, 7, \.998\)/u);
	assert.match(
		shortRailSource,
		/\.premium-hud :global\(\.hud-icon--v21 > \.ui-surface\),[\s\S]*?\.reel-bet-control \.premium-panel-art\s*\{\s*display:\s*block;/u,
	);
	assert.doesNotMatch(shortRailSource, /\.premium-hud::before|hud-icon__v21-fallback[\s\S]*?display:\s*block/u);
});

test('desktop V22 operator clearance and HUD registration stay pinned to the master', () => {
	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const desktopSource = sourceBetween(
		precisionSource,
		'@media (min-width: 1041px) and (min-height: 561px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 481px) and (max-width: 1040px) and (min-height: 561px),',
	);
	assert.match(desktopSource, /\.operative-stage\s*\{\s*width:\s*44%;\s*height:\s*61\.4%;/u);
	assertOrderedText(
		desktopSource,
		[
			'.hud-tools-left { translate: 0 -.72cqw; }',
			'.hud-tools-left .round-tool:nth-child(1) { translate: -.53cqw 0; }',
			'.hud-tools-left .round-tool:nth-child(2) { translate: -.09cqw 0; }',
			'.hud-tools-left .round-tool:nth-child(3) { translate: -.67cqw 0; }',
			'.hud-tools-right { translate: -.76cqw -.72cqw; }',
		],
		'desktop master HUD registration',
	);
	assert.match(
		desktopSource,
		/\.reel-console \.reel-spin\s*\{\s*width:\s*calc\(12\.51% - 2px\);\s*translate:\s*-\.24cqw -\.27cqw;\s*\}/u,
	);
	assert.doesNotMatch(desktopSource, /transform:\s*translate/u);
});

test('480px legacy layout media stays portrait-only and keeps each three-button tool rail square', () => {
	const responsiveKitSource = pageSource.slice(pageSource.indexOf('/* DEV v21 UI kit:'));
	const width480MediaQueries = responsiveKitSource.match(/@media\s+[^\{]*max-width:\s*480px[^\{]*\{/gu) ?? [];
	assert.ok(width480MediaQueries.length >= 5, 'the established phone layout families remain present');
	for (const query of width480MediaQueries) {
		assert.match(query, /\(orientation:\s*portrait\)/u, `${query.trim()} must not affect landscape`);
	}
	assert.doesNotMatch(responsiveKitSource, /@media\s*\(max-width:\s*480px\)\s*\{/u);

	const responsiveGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Keep every responsive control square and in one deterministic reading-order grid. */'),
	);
	const phoneRailSource = sourceBetween(
		responsiveGeometrySource,
		'@media (min-width: 381px) and (max-width: 480px) and (orientation: portrait)',
		'@media (max-width: 480px) and (orientation: portrait)',
	);
	assert.match(phoneRailSource, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/u);
	assert.match(phoneRailSource, /gap:\s*4px;/u);
	assert.match(
		phoneRailSource,
		/\.hud-tools \.round-tool\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?aspect-ratio:\s*1;/u,
	);
});

test('tablet responsive HUD assigns ten square controls to ten deterministic grid cells', () => {
	const responsiveGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Keep every responsive control square and in one deterministic reading-order grid. */'),
	);
	const tabletSource = sourceBetween(
		responsiveGeometrySource,
		'@media (min-width: 481px) and (max-width: 1040px) and (min-height: 561px),',
		'@media (min-width: 381px) and (max-width: 480px) and (orientation: portrait)',
	);
	assert.match(tabletSource, /--responsive-control-size:\s*clamp\(44px,\s*calc\(10cqw - 4px\),\s*64px\);/u);
	assert.match(tabletSource, /grid-template-columns:\s*repeat\(10,\s*minmax\(0,\s*1fr\)\);/u);
	assert.match(tabletSource, /\.hud-tools,[\s\S]*?\.control-deck\s*\{\s*display:\s*contents;/u);
	assert.match(
		tabletSource,
		/:is\([\s\S]*?\.reel-console \.reel-spin[\s\S]*?\)\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?top:\s*auto\s*!important;[\s\S]*?left:\s*auto\s*!important;[\s\S]*?width:\s*var\(--responsive-control-size\);[\s\S]*?height:\s*var\(--responsive-control-size\);[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?grid-row:\s*1;/u,
	);
	assertOrderedText(
		tabletSource,
		[
			'.hud-tools-left .round-tool:nth-child(1) { grid-column: 1; }',
			'.hud-tools-left .round-tool:nth-child(2) { grid-column: 2; }',
			'.hud-tools-left .round-tool:nth-child(3) { grid-column: 3; }',
			'.bet-step-minus { grid-column: 4; }',
			'.reel-console .reel-bet-control { grid-column: 5; }',
			'.bet-step-plus { grid-column: 6; }',
			'.reel-console .reel-spin { grid-column: 7; }',
			'.hud-tools-right .round-tool:nth-child(1) { grid-column: 8; }',
			'.hud-tools-right .round-tool:nth-child(2) { grid-column: 9; }',
			'.hud-tools-right .round-tool:nth-child(3) { grid-column: 10; }',
		],
		'tablet HUD reading order',
	);
});

test('narrow tablet scene container falls back to a padded five-by-two control grid', () => {
	const responsiveGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Keep every responsive control square and in one deterministic reading-order grid. */'),
	);
	const containerFallbackSource = sourceBetween(
		responsiveGeometrySource,
		'@media (min-width: 481px) and (min-height: 561px)',
		'@media (max-width: 480px) and (orientation: portrait)',
	);
	assert.match(
		containerFallbackSource,
		/^@media \(min-width: 481px\) and \(min-height: 561px\)\s*\{\s*@container \(width < 440px\)\s*\{/u,
	);
	assert.match(containerFallbackSource, /--responsive-control-size:\s*44px;/u);
	assert.match(containerFallbackSource, /grid-template-columns:\s*repeat\(5,\s*minmax\(44px,\s*1fr\)\);/u);
	assert.match(containerFallbackSource, /grid-template-rows:\s*repeat\(2,\s*44px\);/u);
	assert.match(containerFallbackSource, /gap:\s*4px 0;/u);
	assert.match(containerFallbackSource, /padding-top:\s*4px;/u);
	assertOrderedText(
		containerFallbackSource,
		[
			'.hud-tools-left .round-tool:nth-child(1) { grid-column: 1; grid-row: 1; }',
			'.hud-tools-left .round-tool:nth-child(2) { grid-column: 2; grid-row: 1; }',
			'.hud-tools-left .round-tool:nth-child(3) { grid-column: 3; grid-row: 1; }',
			'.control-deck .bet-step-minus { grid-column: 4; grid-row: 1; }',
			'.reel-console .reel-bet-control { grid-column: 5; grid-row: 1; }',
			'.control-deck .bet-step-plus { grid-column: 1; grid-row: 2; }',
			'.reel-console .reel-spin { grid-column: 2; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(1) { grid-column: 3; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(2) { grid-column: 4; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(3) { grid-column: 5; grid-row: 2; }',
		],
		'narrow scene-container HUD reading order',
	);
});

test('short landscape switches cleanly from one ten-cell row to two five-cell rows', () => {
	const finalGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Final responsive control geometry: every hit target owns a distinct grid cell. */'),
	);
	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const oneRowSource = sourceBetween(
		finalGeometrySource,
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(oneRowSource, /width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?grid-row:\s*1;/u);
	assertOrderedText(
		oneRowSource,
		[
			'.hud-tools-left .round-tool:nth-child(1) { grid-column: 1; }',
			'.hud-tools-left .round-tool:nth-child(2) { grid-column: 2; }',
			'.hud-tools-left .round-tool:nth-child(3) { grid-column: 3; }',
			'.bet-step-minus { grid-column: 4; }',
			'.reel-console .reel-bet-control { grid-column: 5; }',
			'.bet-step-plus { grid-column: 6; }',
			'.reel-console .reel-spin { grid-column: 7; }',
			'.hud-tools-right .round-tool:nth-child(1) { grid-column: 8; }',
			'.hud-tools-right .round-tool:nth-child(2) { grid-column: 9; }',
			'.hud-tools-right .round-tool:nth-child(3) { grid-column: 10; }',
		],
		'short-landscape single-row reading order',
	);
	const effectiveOneRowSource = sourceBetween(
		precisionSource,
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(effectiveOneRowSource, /grid-template-columns:\s*repeat\(10,\s*44px\);/u);
	assert.match(effectiveOneRowSource, /grid-template-rows:\s*44px;/u);
	assert.match(effectiveOneRowSource, /align-content:\s*center;/u);
	assert.match(effectiveOneRowSource, /justify-content:\s*space-evenly;/u);

	const twoRowSource = sourceBetween(
		finalGeometrySource,
		'@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait)',
	);
	assert.match(twoRowSource, /\.scene-world\s*\{[\s\S]*?overflow:\s*visible;/u);
	assert.match(twoRowSource, /\.breach-monitor\s*\{\s*clip-path:\s*none;/u);
	assert.match(twoRowSource, /\.compact-value-strip\s*\{\s*display:\s*none;/u);
	assertOrderedText(
		twoRowSource,
		[
			'.hud-tools-left .round-tool:nth-child(1) { grid-column: 1; grid-row: 1; }',
			'.hud-tools-left .round-tool:nth-child(2) { grid-column: 2; grid-row: 1; }',
			'.hud-tools-left .round-tool:nth-child(3) { grid-column: 3; grid-row: 1; }',
			'.bet-step-minus { grid-column: 4; grid-row: 1; }',
			'.reel-console .reel-bet-control { grid-column: 5; grid-row: 1; }',
			'.bet-step-plus { grid-column: 1; grid-row: 2; }',
			'.reel-console .reel-spin { grid-column: 2; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(1) { grid-column: 3; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(2) { grid-column: 4; grid-row: 2; }',
			'.hud-tools-right .round-tool:nth-child(3) { grid-column: 5; grid-row: 2; }',
		],
		'short-landscape two-row reading order',
	);
	const effectiveTwoRowSource = sourceBetween(
		precisionSource,
		'@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (max-width: 620px)',
	);
	assert.match(effectiveTwoRowSource, /height:\s*92px;/u);
	assert.match(effectiveTwoRowSource, /grid-template-columns:\s*repeat\(5,\s*44px\);/u);
	assert.match(effectiveTwoRowSource, /grid-template-rows:\s*repeat\(2,\s*44px\);/u);
	assert.match(effectiveTwoRowSource, /align-content:\s*center;/u);
	assert.match(effectiveTwoRowSource, /justify-content:\s*space-around;/u);
	assert.match(effectiveTwoRowSource, /gap:\s*4px 0;/u);

	const authoredShortLandscapeSource = sourceBetween(
		finalGeometrySource,
		'@media (min-width: 701px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(
		authoredShortLandscapeSource,
		/\.reel-console \.reel-spin\s*\{\s*height:\s*auto\s*!important;\s*aspect-ratio:\s*1;/u,
		'authored short-landscape Spin remains circular and cannot protrude below the viewport',
	);
});

test('responsive amount field aligns to the same square cell as adjacent hit targets', () => {
	const responsiveGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Keep every responsive control square and in one deterministic reading-order grid. */'),
	);
	const tabletSource = sourceBetween(
		responsiveGeometrySource,
		'@media (min-width: 481px) and (max-width: 1040px) and (min-height: 561px),',
		'@media (min-width: 381px) and (max-width: 480px) and (orientation: portrait)',
	);
	const shortLandscapeSource = sourceBetween(
		responsiveGeometrySource,
		'@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	const compactPortraitSource = sourceBetween(
		responsiveGeometrySource,
		'@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait)',
		'@media (prefers-reduced-motion: reduce)',
	);

	for (const [name, source, expectedHeight] of [
		['tablet', tabletSource, 'var\\(--responsive-control-size\\) !important'],
		['short landscape', shortLandscapeSource, '44px'],
		['compact portrait', compactPortraitSource, '44px'],
	]) {
		assert.match(source, /\.reel-bet-control\s*>\s*span:first-child\s*\{\s*display:\s*none;/u, `${name} removes the external amount label from the square cell`);
		assert.match(source, /\.reel-bet-control :is\(select, \.amount-range\)\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?width:\s*100%;/u, `${name} stretches the amount input across its own cell`);
		assert.match(source, new RegExp(`height:\\s*${expectedHeight};[\\s\\S]*?min-height:\\s*44px;`, 'u'), `${name} amount height matches adjacent controls`);
	}
});

test('dialog close targets, Guide tabs and short-menu scrolling retain non-overlapping geometry', () => {
	const responsiveGeometrySource = pageSource.slice(
		pageSource.indexOf('/* Keep every responsive control square and in one deterministic reading-order grid. */'),
	);
	const closeSource = sourceBetween(
		responsiveGeometrySource,
		'.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button',
		'@media (max-width: 700px)',
	);
	assert.match(closeSource, /flex:\s*0 0 46px;/u);
	assert.match(closeSource, /width:\s*46px;/u);
	assert.match(closeSource, /height:\s*46px;/u);
	assert.match(closeSource, /min-width:\s*46px;/u);
	assert.match(closeSource, /min-height:\s*46px;/u);
	assert.match(closeSource, /\.guide-tabs button\s*\{\s*min-height:\s*46px;/u);
	const precisionDialogSource = sourceBetween(
		pageSource,
		'/* Final V22 precision pass.',
		'.app-shell.dev-ui-v22 .modal-actions.preview-only',
	);
	assert.match(
		precisionDialogSource,
		/> header > button :global\(\.hud-icon__v21-fallback\),[\s\S]*?> header > button :global\(\.hud-icon--v21 > \.ui-surface\)\s*\{\s*display:\s*none;/u,
	);
	assert.match(
		precisionDialogSource,
		/> header > button\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?border-color:[\s\S]*?background:[\s\S]*?box-shadow:/u,
	);
	assert.match(precisionDialogSource, /> header > button > :global\(\.hud-icon\)\s*\{\s*width:\s*30px\s*!important;\s*height:\s*30px\s*!important;/u);

	const guideTabsSource = sourceBetween(
		responsiveGeometrySource,
		'@media (max-width: 700px)',
		'/* Final responsive control geometry: every hit target owns a distinct grid cell. */',
	);
	assert.match(pageSource, /<div class="guide-tabs" role="tablist"/u);
	assert.match(guideTabsSource, /\.guide-tabs\s*\{\s*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/u);
	assert.match(guideTabsSource, /\.guide-tabs button\s*\{[\s\S]*?grid-column:\s*span 2;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/u);
	assert.match(guideTabsSource, /button:nth-child\(4\)\s*\{\s*grid-column:\s*2 \/ span 2;/u);
	assert.match(guideTabsSource, /button:nth-child\(5\)\s*\{\s*grid-column:\s*4 \/ span 2;/u);
	assert.doesNotMatch(guideTabsSource, /\.game-guide-tabs/u);

	const shortDialogSource = sourceBetween(
		pageSource.slice(pageSource.indexOf('/* V22 extreme visual pass.')),
		'@media (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 701px) and (min-height: 561px)',
	);
	assert.match(shortDialogSource, /\.settings-dialog\s*\{\s*display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);/u);
	assert.match(shortDialogSource, /\.settings-dialog \.settings-body\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/u);

	const shortLandscapeSource = sourceBetween(
		responsiveGeometrySource,
		'@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(shortLandscapeSource, /\.menu-dialog:not\(\.mode-dialog\)\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?overflow:\s*hidden\s*!important;/u);
	assert.match(shortLandscapeSource, /\.menu-actions\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/u);
});

test('modal safe areas and narrow-screen content reflow without page-level overflow', () => {
	const modalBackdropSource = sourceBetween(
		pageSource,
		'.reel-error-status button { min-height:44px; }',
		'.confirmation-dialog,',
	);
	assert.match(modalBackdropSource, /\.modal-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;/u);
	assert.match(
		modalBackdropSource,
		/padding:\s*max\(clamp\(8px,\s*3vw,\s*34px\),\s*env\(safe-area-inset-top\)\)\s*max\(clamp\(8px,\s*3vw,\s*34px\),\s*env\(safe-area-inset-right\)\)\s*max\(clamp\(8px,\s*3vw,\s*34px\),\s*env\(safe-area-inset-bottom\)\)\s*max\(clamp\(8px,\s*3vw,\s*34px\),\s*env\(safe-area-inset-left\)\);/u,
	);

	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const mobileRulesSource = sourceBetween(
		precisionSource,
		'@media (max-width: 620px)',
		'@media (max-width: 700px) and (max-height: 430px)',
	);
	assert.match(mobileRulesSource, /\.rules-copy-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/u);

	const shortPortraitSource = sourceBetween(
		precisionSource,
		'@media (max-width: 700px) and (max-height: 430px)',
		'@media (prefers-reduced-motion: reduce)',
	);
	assert.match(
		shortPortraitSource,
		/:is\(\.menu-dialog:not\(\.mode-dialog\), \.settings-dialog\)\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?overflow:\s*hidden\s*!important;/u,
	);
	assert.match(
		shortPortraitSource,
		/\.menu-dialog:not\(\.mode-dialog\) \.menu-actions,[\s\S]*?\.settings-dialog \.settings-body,[\s\S]*?\.confirmation-dialog \.confirmation-scroll\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?align-content:\s*start;/u,
	);
});

test('381–480px ultra-short portrait selects the Compact Phone shell in every routing layer', () => {
	const compactMedia = '(max-width: 380px) and (max-height: 700px) and (orientation: portrait), (min-width: 381px) and (max-width: 480px) and (max-height: 430px) and (orientation: portrait)';
	assert.equal(
		pageSource.split(compactMedia).length - 1,
		3,
		'the identical compact query must own runtime selection, preload and picture routing',
	);

	const runtimeShellSource = sourceBetween(
		pageSource,
		'const responsiveMachineShell =',
		'liveOutcomeStreak = null;',
	);
	assertOrderedText(
		runtimeShellSource,
		[
			`window.matchMedia('${compactMedia}').matches`,
			'BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22',
			"window.matchMedia('(max-width: 480px) and (orientation: portrait)').matches",
			'BLACKSITE_ASSETS.environment.premiumMachinePhoneV22',
		],
		'compact runtime shell precedence',
	);

	const headSource = sourceBetween(pageSource, '<svelte:head>', '</svelte:head>');
	assertOrderedText(
		headSource,
		[
			`href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} media="${compactMedia}"`,
			'href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachinePhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} media="(min-width: 381px) and (max-width: 480px) and (min-height: 431px) and (orientation: portrait)"',
		],
		'compact preload precedence',
	);

	const pictureSource = sourceBetween(
		pageSource,
		'<picture class="premium-machine-shell-picture"',
		'</picture>',
	);
	assertOrderedText(
		pictureSource,
		[
			`<source media="${compactMedia}" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} />`,
			'<source media="(max-width: 480px) and (orientation: portrait)" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachinePhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} />',
		],
		'compact picture source precedence',
	);

	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const ultraShortSource = sourceBetween(
		precisionSource,
		'@media (max-width: 480px) and (max-height: 430px) and (orientation: portrait)',
		'@media (prefers-reduced-motion: reduce)',
	);
	assert.match(
		ultraShortSource,
		/\.scene-world\s*\{[\s\S]*?top:\s*50%;[\s\S]*?left:\s*50%;[\s\S]*?width:\s*min\(100vw,\s*calc\(100dvh \* 320 \/ 568\)\);[\s\S]*?height:\s*auto;[\s\S]*?aspect-ratio:\s*320 \/ 568;[\s\S]*?transform:\s*translate\(-50%,\s*-50%\);/u,
	);
});

test('ultra-short confirmation scrolls from the top and focuses its carrier without CTA scroll', () => {
	const focusSource = sourceBetween(
		pageSource,
		'function focusConfirmationEntry()',
		'async function openConfirmation()',
	);
	assert.match(focusSource, /window\.matchMedia\('\(max-width: 700px\) and \(max-height: 430px\)'\)\.matches/u);
	const shortFocusSource = sourceBetween(focusSource, 'if (shortViewport) {', 'return;');
	assertOrderedText(
		shortFocusSource,
		[
			"confirmationDialog?.querySelector('.confirmation-scroll')?.scrollTo({ top: 0 });",
			'confirmationDialog?.focus({ preventScroll: true });',
		],
		'ultra-short confirmation focus entry',
	);
	assert.doesNotMatch(shortFocusSource, /confirmationCancelButton|confirmation-start/u);
	assert.match(focusSource, /return;\s*\}\s*confirmationCancelButton\?\.focus\(\);/u);

	const precisionSource = pageSource.slice(pageSource.indexOf('/* Final V22 precision pass.'));
	const shortDialogSource = sourceBetween(
		precisionSource,
		'@media (max-width: 700px) and (max-height: 430px)',
		'@media (max-width: 480px) and (max-height: 430px) and (orientation: portrait)',
	);
	assert.match(
		shortDialogSource,
		/\.confirmation-dialog\s*\{\s*height:\s*calc\(100dvh - 16px\);\s*max-height:\s*calc\(100dvh - 16px\)\s*!important;\s*overflow:\s*hidden\s*!important;/u,
	);
	assert.match(
		shortDialogSource,
		/\.settings-dialog \.settings-body,[\s\S]*?\.confirmation-dialog \.confirmation-scroll\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/u,
	);
	assertOrderedText(
		pageSource,
		['confirmationOpen = true;', 'await tick();', 'focusConfirmationEntry();'],
		'confirmation opens before focus is transferred',
	);
});

test('V27 semantic assets cover HUD, modal, cinematic and Vault carriers without replacing live copy', () => {
	assert.match(pageSource, /class:dev-ui-v27=\{devUiV22Enabled\}/u);
	assert.match(pageSource, /BLACKSITE_ASSETS\.ui\.v27\.preload/u);
	for (const kind of ['feature', 'content', 'header', 'chip']) {
		assert.match(pageSource, new RegExp(`kind=["']${kind}["']`, 'u'));
	}
	assert.match(pageSource, /\{#if devUiV22Enabled\}<UiSurface enabled kit=\{BLACKSITE_ASSETS\.ui\.v27\}/u);
	assert.match(featureHudSource, /surface: 'feature'/u);
	assert.match(cinematicStatusSource, /data-cinematic-ui-inner-surface=\{enabled \? 'content' : undefined\}/u);
	assert.match(cinematicStatusSource, /kind="content"/u);
	assert.match(cinematicStatusSource, /kind="progress"/u);
	for (const kind of ['award', 'feature', 'content', 'progress']) {
		assert.match(vaultCinematicSource, new RegExp(`kind=["']${kind}["']`, 'u'));
	}
	assert.match(vaultCinematicSource, /V27_REWARD_HALO/u);
	assert.match(vaultCinematicSource, /\{#if MODERN_V27_ENABLED\}/u);
	assert.match(pageSource, /<small[^>]*>WIN<\/small><b>\{hudWinText\}<\/b>/u);
});

test('V27 free-spin telemetry replaces the normal header with large responsive count and symbol cards', () => {
	assert.match(pageSource, /featureProgressValue\s*=\s*`\$\{featureSpin\}\/\$\{featureSpinsAwarded\}`/u);
	assert.match(pageSource, /featureRemainingValue\s*=\s*`\$\{remainingFeatureSpins\} LEFT`/u);
	assert.doesNotMatch(pageSource, /featureProgressValue[\s\S]{0,160}'READY'/u);
	assert.match(pageSource, /label="FREE SPINS" compactLabel="SPINS"/u);
	assert.match(pageSource, /label="EXPANDING SYMBOL" compactLabel="EXPANDING"/u);
	assert.match(pageSource, /label=\{social \? 'RESULT' : 'BONUS WIN'\} compactLabel="WIN"/u);
	assert.match(pageSource, /ariaLabel=\{`Free spins \$\{featureProgressValue\}, \$\{featureRemainingValue\}`\}/u);
	assert.match(pageSource, /ariaLabel=\{`Expanding symbol \$\{featureTargetLabel\}`\}/u);
	assert.match(pageSource, /class:feature-active=\{hudPhase === 'feature'\}/u);

	const telemetrySource = featureHudSource.slice(featureHudSource.indexOf('/* Free-spin telemetry'));
	const deDuplicatedTargetSource = featureHudSource.slice(featureHudSource.indexOf("/* The expanding target's authoritative"));
	assert.match(
		deDuplicatedTargetSource,
		/data-feature-hud-kind='target'\] \.feature-hud-surface__value--icon-label\s*\{[\s\S]*?position:\s*absolute !important;[\s\S]*?width:\s*1px !important;[\s\S]*?height:\s*1px !important;[\s\S]*?clip:\s*rect\(0, 0, 0, 0\) !important;/u,
		'the expanding-symbol rank stays semantic but is not printed twice beside its authoritative asset',
	);
	assert.match(
		telemetrySource,
		/data-feature-hud-kind='target'\] \.feature-hud-surface__icon\s*\{[\s\S]*?--feature-hud-target-icon-size:\s*26px;[\s\S]*?width:\s*min\(var\(--feature-hud-target-icon-size\),\s*calc\(100cqh - 2px\)\);[\s\S]*?height:\s*min\(var\(--feature-hud-target-icon-size\),\s*calc\(100cqh - 2px\)\);/u,
		'the expanding symbol is capped by the real rail height instead of clipping at short viewports',
	);

	const tallTelemetrySource = telemetrySource.slice(telemetrySource.indexOf('/* A tall feature rail'));
	const tallCardSource = sourceBetween(
		tallTelemetrySource,
		'@container feature-telemetry-rail (min-height: 60px)',
		'@media (max-width: 480px) and (orientation: portrait)',
	);
	assert.match(tallCardSource, /grid-template-columns:\s*minmax\(0, 1fr\) auto;/u);
	assert.match(tallCardSource, /grid-template-rows:\s*auto minmax\(0, 1fr\);/u);
	assert.match(tallCardSource, /feature-hud-surface__label\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?font-size:\s*clamp\(9px, 12cqh, 12px\);/u);
	assert.match(tallCardSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__value\s*\{\s*font-size:\s*clamp\(24px, 34cqh, 34px\);/u);
	assert.match(tallCardSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__secondary\s*\{[\s\S]*?grid-row:\s*2;[\s\S]*?grid-column:\s*2;[\s\S]*?font-size:\s*clamp\(14px, 20cqh, 20px\);/u);
	assert.match(tallCardSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__icon\s*\{\s*--feature-hud-target-icon-size:\s*clamp\(38px, 65cqh, 64px\);/u);
	assert.match(tallCardSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__value--icon-label\s*\{\s*font-size:\s*clamp\(15px, 22cqh, 22px\);/u);
	assert.match(tallCardSource, /data-feature-hud-kind='win'\] \.feature-hud-surface__value\s*\{\s*font-size:\s*clamp\(20px, 30cqh, 30px\);/u);

	const phoneCardSource = sourceBetween(
		tallTelemetrySource,
		'@media (max-width: 480px) and (orientation: portrait)',
		'@media (max-width: 699px) and (max-height: 560px)',
	);
	assert.match(phoneCardSource, /@container feature-telemetry-rail \(min-height:\s*60px\)/u);
	assert.match(phoneCardSource, /grid-template-columns:\s*minmax\(0, 1fr\);/u);
	assert.match(phoneCardSource, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/u);
	assert.match(phoneCardSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__value\s*\{\s*font-size:\s*clamp\(22px, 28cqh, 27px\);/u);
	assert.match(phoneCardSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__secondary\s*\{[\s\S]*?grid-row:\s*3;[\s\S]*?grid-column:\s*1;[\s\S]*?justify-self:\s*center;[\s\S]*?font-size:\s*clamp\(13px, 17cqh, 17px\);/u);
	assert.match(phoneCardSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__value-row\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*1px;/u);
	assert.match(phoneCardSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__icon\s*\{\s*--feature-hud-target-icon-size:\s*clamp\(38px, 52cqh, 56px\);/u);
	assert.match(phoneCardSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__value--icon-label\s*\{[\s\S]*?font-size:\s*clamp\(13px, 17cqh, 17px\);/u);

	const shortLandscapeSource = sourceBetween(
		tallTelemetrySource,
		'@media (max-height: 560px) and (min-aspect-ratio: 4 / 3)',
		'@media (max-width: 699px) and (max-height: 560px)',
	);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__label\.has-compact-label \.feature-hud-surface__label-full\s*\{\s*display:\s*none;/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__label-compact\s*\{\s*display:\s*inline;/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='progress'\]\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto;[\s\S]*?padding:\s*8px 5px;/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__label\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*1;[\s\S]*?justify-self:\s*center;/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__value-row\s*\{[\s\S]*?grid-row:\s*2;[\s\S]*?grid-column:\s*1;/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='progress'\] \.feature-hud-surface__secondary\s*\{[\s\S]*?grid-row:\s*3;[\s\S]*?grid-column:\s*1;[\s\S]*?justify-self:\s*center;/u);
	assert.match(shortLandscapeSource, /feature-hud-surface__value \{\s*font-size:\s*clamp\(20px, 3\.2vw, 32px\);\s*\}/u);
	assert.match(shortLandscapeSource, /feature-hud-surface__secondary \{\s*font-size:\s*clamp\(12px, 2vw, 18px\);\s*\}/u);
	assert.match(shortLandscapeSource, /feature-hud-surface__icon \{\s*--feature-hud-target-icon-size:\s*clamp\(30px, 7vw, 64px\);\s*\}/u);
	assert.match(shortLandscapeSource, /data-feature-hud-kind='target'\] \.feature-hud-surface__value-row\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*2px;/u);
	assert.match(shortLandscapeSource, /feature-hud-surface__value--icon-label\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*1px;[\s\S]*?height:\s*1px;[\s\S]*?clip:\s*rect\(0, 0, 0, 0\);/u);

	const extremeShortSource = tallTelemetrySource.slice(tallTelemetrySource.indexOf('@media (max-width: 699px)'));
	assert.match(extremeShortSource, /feature-hud-surface__value \{ font-size:\s*18px; \}/u);
	assert.match(extremeShortSource, /feature-hud-surface__secondary \{ font-size:\s*12px; \}/u);
	assert.match(extremeShortSource, /feature-hud-surface__icon \{ --feature-hud-target-icon-size:\s*24px; \}/u);
	assert.match(extremeShortSource, /feature-hud-surface__value--icon-label \{ font-size:\s*13px; \}/u);

	const featureRailSource = pageSource.slice(pageSource.indexOf('/* During free spins the telemetry becomes the primary header.'));
	assert.match(featureRailSource, /\.app-shell\.dev-ui-v22 \.breach-monitor\.feature-active \.monitor-header\s*\{\s*display:\s*none;/u);
	assert.match(
		featureRailSource,
		/\.app-shell\.dev-ui-v22 \.reel-mechanic-strip\.feature-strip\s*\{\s*container-name:\s*feature-telemetry-rail;\s*container-type:\s*size;\s*grid-template-columns:\s*1\.3fr 1\.5fr \.7fr;/u,
		'the rail provides exact height container units for the clipping-safe target symbol cap',
	);
	assert.match(
		featureRailSource,
		/@media \(min-width: 1041px\) and \(min-height: 561px\) and \(min-aspect-ratio: 4\/3\)\s*\{[\s\S]*?\.breach-monitor\.feature-active \.reel-mechanic-strip\.feature-strip\s*\{\s*top:\s*8\.077%;\s*height:\s*12\.15%;/u,
	);
	assert.match(
		featureRailSource,
		/@media \(min-width: 481px\) and \(max-width: 1040px\) and \(min-height: 561px\),[\s\S]*?\(max-aspect-ratio: 4\/3\)\s*\{[\s\S]*?\.breach-monitor\.feature-active \.reel-mechanic-strip\.feature-strip\s*\{\s*top:\s*4\.2%;\s*height:\s*15\.6%;/u,
	);
	const phoneRailSource = sourceBetween(
		featureRailSource,
		'@media (max-width: 480px) and (orientation: portrait)',
		'@media (max-height: 560px) and (min-aspect-ratio: 4/3)',
	);
	assert.match(
		phoneRailSource,
		/\.breach-monitor\.feature-active \.reel-mechanic-strip\.feature-strip\s*\{\s*top:\s*3\.7%;\s*height:\s*14\.1%;\s*grid-template-columns:\s*1\.2fr 1\.4fr \.9fr;/u,
	);
	assert.doesNotMatch(phoneRailSource, /\.reel-machine/u, 'phone feature telemetry must preserve the authored reel geometry');

	const shortRailSource = sourceBetween(
		featureRailSource,
		'@media (max-height: 560px) and (min-aspect-ratio: 4/3)',
		'@media (prefers-reduced-motion: reduce)',
	);
	assert.match(
		shortRailSource,
		/\.breach-monitor\.feature-active \.reel-mechanic-strip\.feature-strip\s*\{\s*top:\s*0;\s*left:\s*0;\s*display:\s*block !important;\s*width:\s*100%;\s*height:\s*100%;\s*pointer-events:\s*none;/u,
	);
	assert.match(
		shortRailSource,
		/data-feature-hud-kind='progress'\]\)\s*\{\s*position:\s*absolute;\s*top:\s*10%;\s*left:\s*1\.2%;\s*width:\s*13\.7%;\s*height:\s*28%;/u,
	);
	assert.match(
		shortRailSource,
		/data-feature-hud-kind='target'\]\)\s*\{\s*position:\s*absolute;\s*top:\s*10%;\s*left:\s*85\.1%;\s*width:\s*13\.7%;\s*height:\s*28%;/u,
	);
	assert.match(
		shortRailSource,
		/data-feature-hud-kind='win'\]\)\s*\{\s*position:\s*absolute;\s*top:\s*\.8%;\s*left:\s*31%;\s*width:\s*38%;\s*height:\s*5\.3%;/u,
	);
	assert.doesNotMatch(shortRailSource, /\.reel-machine/u, 'short-landscape telemetry overlays the scene without changing reel geometry');
});

test('V27 quick-start facts never stack value text over their labels', () => {
	assert.match(featureHudSource, /data-feature-hud-kind='base'\] \{[\s\S]*?grid-template-columns:\s*minmax\(0, auto\) auto;[\s\S]*?column-gap:\s*12px;/u);
	assert.match(featureHudSource, /data-feature-hud-kind='base'\] \.feature-hud-surface__value-row \{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*2;/u);
	assert.match(featureHudSource, /data-feature-hud-kind='base'\] \.feature-hud-surface__secondary \{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*1;/u);

	const responsiveStart = featureHudSource.indexOf('@media (max-width: 960px), (max-aspect-ratio: 4 / 3)');
	const responsiveEnd = featureHudSource.indexOf('@media (max-width: 640px)', responsiveStart);
	assert.ok(responsiveStart >= 0 && responsiveEnd > responsiveStart);
	const responsiveQuickStart = featureHudSource.slice(responsiveStart, responsiveEnd);
	assert.match(responsiveQuickStart, /grid-template-columns:\s*minmax\(0, 1fr\);/u);
	assert.match(responsiveQuickStart, /grid-template-rows:\s*minmax\(0, 1fr\) minmax\(0, 1fr\);/u);
	assert.match(responsiveQuickStart, /feature-hud-surface__value-row \{[\s\S]*?grid-row:\s*1;[\s\S]*?grid-column:\s*1;/u);
	assert.match(responsiveQuickStart, /feature-hud-surface__secondary \{[\s\S]*?grid-row:\s*2;[\s\S]*?grid-column:\s*1;/u);
});

test('every V27 surface has an automatic inherited V22 raster fallback', () => {
	assert.match(uiSurfaceSource, /const V27_FALLBACK_KINDS = Object\.freeze\(\{[\s\S]*?feature: 'readout',[\s\S]*?content: 'panel',[\s\S]*?header: 'panel',[\s\S]*?award: 'panel',[\s\S]*?chip: 'readout',[\s\S]*?progress: 'readout'/u);
	assert.match(uiSurfaceSource, /activeKit\?\.version === 27 && !fallbackSrc/u);
	assert.match(uiSurfaceSource, /sourceForState\(BLACKSITE_ASSETS\.ui\.v22 \?\? BLACKSITE_ASSETS\.ui\.v21, inheritedFallbackKind, resolvedState\)/u);
	assert.match(uiSurfaceSource, /data-ui-fallback-kind=\{automaticFallbackSrc \? `v22-\$\{inheritedFallbackKind\}`/u);
	assert.match(uiSurfaceSource, /\{:else if effectiveFallbackSrc\}[\s\S]*src=\{effectiveFallbackSrc\}/u);
});

test('V36 command UI owns one event line, readable controls and recomposed portrait metrics', () => {
	assert.match(pageSource, /class:blacksite-ui-v36=\{devUiV22Enabled\}/u);
	assert.match(pageSource, /data-ui-revision=\{devUiV22Enabled \? 'v36'/u);
	assert.match(pageSource, /class:result-ticker-passive=\{resultTickerPassive\}/u);
	assert.match(pageSource, /activeLineWins\.length === 1 \? `LINE[\s\S]*?: `\$\{activeLineWins\.length\} LINES WON`/u);
	assert.match(pageSource, /hudPhase === 'feature'[\s\S]*?featureRunningWinText/u);
	assert.doesNotMatch(pageSource, /PLAY DEV FIXTURE|REPLAY DEV FIXTURE|SPIN · DEV MATH/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.hud-tools \.round-tool > span \{[\s\S]*?display:\s*block !important;/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.reel-spin \.responsive-spin-label \{[\s\S]*?display:\s*block !important;/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.payline-overlay img:not\(:first-child\) \{\s*display:\s*none;/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.compact-value-strip \{\s*display:\s*none !important;/u);
	assert.match(pageSource, /\.menu-dialog:not\(\.mode-dialog\) \.menu-actions button \{[\s\S]*?grid-template-rows:\s*auto auto !important;/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.status-plate \{\s*display:\s*none !important;/u);
	assert.match(pageSource, /\.app-shell\.blacksite-ui-v36 \.reel-console \.reel-spin \{[\s\S]*?top:\s*52%;[\s\S]*?height:\s*26%;/u);
	assert.match(pageSource, /\.breach-monitor\.feature-active :is\(\.bet-step, \.reel-bet-control, \.reel-spin, \.hud-tools\) \{[\s\S]*?visibility:\s*hidden;/u);
	assert.match(pageSource, /\.control-deck \.balance-meter \{ left: 2%; \}/u);
	assert.match(pageSource, /\.control-deck \.total-meter \{ left: 36%; \}/u);
	assert.match(pageSource, /\.control-deck \.win-meter \{ left: 70%; \}/u);
});
