import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BLACKSITE_ASSETS } from '../src/lib/assets/blacksite-assets.js';
import { assertBlacksiteAssetRegistry } from '../src/lib/assets/blacksite-asset-registry.js';
import { BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA } from '../src/lib/assets/blacksite-audio-runtimepack-v1.generated.js';
import {
	VAULT_MEDIA_TIER,
	resolveVaultMediaSelection,
} from '../src/lib/runtime/vault-media-selector.js';

const appRoot = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, appRoot), 'utf8');

test('production presentation and DEV fixture authority use independent compile-time flags', async () => {
	const [viteSource, pageSource, hudSource, panelSource] = await Promise.all([
		source('vite.config.js'),
		source('src/routes/+page.svelte'),
		source('src/lib/components/HudIcon.svelte'),
		source('src/lib/components/PanelStateArt.svelte'),
	]);

	assert.match(viteSource, /__BLACKSITE_DEV_FIXTURES__:\s*JSON\.stringify\(command === 'serve'\)/u);
	assert.match(viteSource, /__BLACKSITE_MODERN_PRESENTATION__:\s*JSON\.stringify\(true\)/u);
	assert.match(pageSource, /devUiV21Enabled = __BLACKSITE_MODERN_PRESENTATION__/u);
	assert.match(pageSource, /devUiV22Enabled = __BLACKSITE_MODERN_PRESENTATION__/u);
	assert.match(pageSource, /resolveLaunchMode\(window\.location\.search, \{ dev: __BLACKSITE_DEV_FIXTURES__ \}\)/u);
	assert.match(pageSource, /penguinOperatorEnabled = __BLACKSITE_MODERN_PRESENTATION__/u);
	assert.match(pageSource, /import PenguinOperator from '..\/lib\/components\/PenguinOperator\.svelte'/u);
	assert.match(pageSource, /catalog: OPERATOR_FX_CATALOG/u);
	assert.match(pageSource, /href=\{PENGUIN_OPERATOR_ASSETS\.idle\}/u);
	assert.match(hudSource, /\{#if __BLACKSITE_MODERN_PRESENTATION__\}/u);
	assert.match(panelSource, /\{#if __BLACKSITE_MODERN_PRESENTATION__\}/u);
});

test('production catalog keeps the BLACKSITE BREACH title while presenting the trigger symbol as VAULT', async () => {
	const [assetSource, pageSource] = await Promise.all([
		source('src/lib/assets/blacksite-assets.js'),
		source('src/routes/+page.svelte'),
	]);

	assert.equal(Object.hasOwn(BLACKSITE_ASSETS.symbols, 'v22Operative'), false);
	assert.equal(BLACKSITE_ASSETS.symbols.master.operative.includes('/v22/symbols/operative/base.webp'), true);
	assert.equal(Object.values(BLACKSITE_ASSETS.symbols.states.operative).every((path) => path.includes('/v22/symbols/operative/')), true);
	assert.equal(BLACKSITE_ASSETS.ui.reelStrips.length, 5);
	assert.equal(BLACKSITE_ASSETS.ui.reelStrips.every((path) => path.includes('/v22/ui/reel-strips/')), true);
	assert.deepEqual(BLACKSITE_ASSETS.ui.v22.reelStrips, BLACKSITE_ASSETS.ui.reelStrips);
	assert.equal(BLACKSITE_ASSETS.symbols.special.feature.label, 'VAULT');
	assert.match(pageSource, /activeReelStripSources = BLACKSITE_ASSETS\.ui\.reelStrips/u);
	assert.match(pageSource, /function visualSymbolStates\(symbol\) \{\s*return BLACKSITE_ASSETS\.symbols\.states\?\.\[symbol\]/u);
	assert.match(pageSource, /<title>BLACKSITE \/\/ BREACH<\/title>/u);
	assert.match(pageSource, /breach: 'VAULT'/u);
	assert.match(pageSource, /label: 'BLACKOUT BONUS'/u);
	assert.match(pageSource, /'3× VAULT'/u);
	assert.match(pageSource, /function displaySpecialSymbolCopy\(copy\) \{\s*return copy;\s*\}/u);
	assert.doesNotMatch(pageSource, /Three BREACH symbols|LAND 3 BREACHES|BREACH TRIGGER/u);
	assert.doesNotMatch(pageSource, /SCATTER/u);
	assert.doesNotMatch(assetSource, /v22Operative/u);
	assert.doesNotMatch(assetSource, /sym_01_operative|ui\/reel-strips-v1/u);
	assert.match(pageSource, /<PenguinOperator state=\{penguinOperatorState\} suspended=\{operatorSuspended\} \/>/u);
	assert.match(pageSource, /responsive-penguin-cameo/u);
	assert.match(pageSource, /PENGUIN_OPERATOR_ASSETS\.poster/u);
});

test('authoritative audio waits for round confirmation and carries deterministic presentation identity', async () => {
	const pageSource = await source('src/routes/+page.svelte');
	const activateStart = pageSource.indexOf('async function activatePrimary()');
	const activateEnd = pageSource.indexOf('\n\tfunction primaryActionLabel', activateStart);
	const activateSource = pageSource.slice(activateStart, activateEnd);

	assert.match(activateSource, /audioDirector\?\.play\('spin\.press'\)/u);
	assert.doesNotMatch(activateSource, /spin-start|spin\.confirmed/u);
	assert.match(pageSource, /case 'round_started':[\s\S]*?if \(context\.origin !== 'restore'\) \{[\s\S]*?playAuthoritativeAudio\(cue, state, context\)/u);
	assert.match(pageSource, /case 'round_started':[\s\S]*?\{ cueId: 'spin\.confirmed', ordinal: 0 \}/u);
	const optionsStart = pageSource.indexOf('function presentationAudioOptions');
	const optionsEnd = pageSource.indexOf('\n\tfunction playPresentationAudio', optionsStart);
	const optionsSource = pageSource.slice(optionsStart, optionsEnd);
	assert.match(optionsSource, /`\$\{context\.source\}:\$\{String\(context\.roundId \?\? 'local'\)\}`/u);
	assert.doesNotMatch(optionsSource, /playbackGeneration/u);
	assert.match(pageSource, /eventIndex: cue\.eventIndex,[\s\S]*?ordinal,/u);
	for (const cue of ['breach.trigger', 'feature.summary.open', 'round.loss', 'win.max']) {
		assert.equal(pageSource.includes(`cueId: '${cue}'`), true);
	}
	assert.match(pageSource, /audioDirector\?\.resetPresentation\(\{ preserveConsumed: true \}\)/u);
	assert.match(pageSource, /audioDirector\?\.primeConsumed\(events\)/u);
	assert.match(pageSource, /function ensureVaultAudioReady\(\)[\s\S]*?audioDirector\.preloadVault\(\)/u);
	assert.match(pageSource, /cue\.event\?\.mode === 'blackout'\) await ensureVaultAudioReady\(\)/u);
	assert.match(pageSource, /setPresentationAudioScene\('blackout'\)/u);
	assert.match(pageSource, /setPresentationAudioScene\('base'\)/u);
	const featureStart = pageSource.indexOf("case 'feature_started':", pageSource.indexOf('function handleOperatorCue'));
	const featureCycle = pageSource.indexOf("case 'feature_cycle':", featureStart);
	assert.match(pageSource.slice(featureStart, featureCycle), /await ensureVaultAudioReady\(\)[\s\S]*?setPresentationAudioScene\('blackout'\)[\s\S]*?playAuthoritativeAudio/u);
	assert.match(pageSource.slice(featureStart, featureCycle), /stop\('anticipation\.confirmed'\)[\s\S]*?stop\('ambience\.tension'\)[\s\S]*?setPresentationAudioScene\('blackout'\)/u);
	const vaultAudioStart = pageSource.indexOf('function playVaultCinematicAudio');
	const vaultAudioEnd = pageSource.indexOf('\n\tfunction bindVaultAudioAuthority', vaultAudioStart);
	const vaultAudioSource = pageSource.slice(vaultAudioStart, vaultAudioEnd);
	assert.match(vaultAudioSource, /case 'vault-tease':[\s\S]*?return play\('vault\.focus'\)/u);
	assert.doesNotMatch(vaultAudioSource, /play\('anticipation\.confirmed'\)|play\('ambience\.tension'\)/u);
	const restoreStart = pageSource.indexOf('async function presentLiveRound()');
	const restoreEnd = pageSource.indexOf('\n\tasync function executeLivePlay()', restoreStart);
	const restoreSource = pageSource.slice(restoreStart, restoreEnd);
	assert.match(restoreSource, /director\.state\.phase === 'feature'[\s\S]*?await ensureVaultAudioReady\(\)[\s\S]*?setPresentationAudioScene/u);
	assert.doesNotMatch(restoreSource, /play\('reels\.motor\.loop'/u);
	const authoritativeEventsStart = pageSource.indexOf('function authoritativeAudioEvents');
	const authoritativeEventsEnd = pageSource.indexOf('\n\tfunction playAuthoritativeAudio', authoritativeEventsStart);
	const authoritativeEventsSource = pageSource.slice(authoritativeEventsStart, authoritativeEventsEnd);
	assert.doesNotMatch(authoritativeEventsSource, /cueId: 'reels\.motor\.loop'/u);
	const outcomeStart = pageSource.indexOf('const outcome = liveOutcomeStreak.commit');
	const outcomeEnd = pageSource.indexOf('// Cosmetic reactions can never invalidate', outcomeStart);
	const outcomeSource = pageSource.slice(outcomeStart, outcomeEnd);
	assert.match(outcomeSource, /'operative\.rage'/u);
	assert.match(outcomeSource, /'operative\.loss_streak'/u);
	assert.doesNotMatch(outcomeSource, /'operative\.loss'/u);
});

test('feature completion stops the BLACKOUT techno bed before the extraction report remains open', async () => {
	const pageSource = await source('src/routes/+page.svelte');
	const featureEndStart = pageSource.indexOf("case 'feature_ended':", pageSource.indexOf('function handleOperatorCue'));
	const settledStart = pageSource.indexOf("case 'settled':", featureEndStart);
	const featureEndSource = pageSource.slice(featureEndStart, settledStart);

	assert.ok(featureEndStart >= 0 && settledStart > featureEndStart);
	assert.match(
		featureEndSource,
		/stop\('anticipation\.confirmed'\)[\s\S]*?stop\('ambience\.tension'\)[\s\S]*?setPresentationAudioScene\('base'\)[\s\S]*?playAuthoritativeAudio\(cue, state, context\)[\s\S]*?showExtraction/u,
	);
	assert.doesNotMatch(featureEndSource, /setPresentationAudioScene\('blackout'\)/u);
});

test('all curated semantic cues have guarded runtime owners', async () => {
	const pageSource = await source('src/routes/+page.svelte');
	for (const cueId of [
		'ui.hover',
		'ui.cancel',
		'ui.toggle.off',
		'ui.modal.close',
		'ui.error',
		'ui.deny',
		'win.rollup.loop',
		'win.rollup.end',
		'round.complete',
		'ambience.tension',
		'operative.gear',
		'operative.anticipation',
		'operative.recover',
	]) {
		assert.equal(pageSource.includes(`'${cueId}'`), true, `${cueId} has a runtime binding`);
	}
	assert.match(pageSource, /\(hover: hover\) and \(pointer: fine\)/u);
	assert.match(pageSource, /UI_HOVER_COOLDOWN_MS = 70/u);
	assert.match(pageSource, /UI_DENY_COOLDOWN_MS = 250/u);
	assert.match(pageSource, /startWinRollup\([\s\S]*?playPresentationAudio\('win\.rollup\.loop'[\s\S]*?finishWinRollup/u);
	assert.match(pageSource, /winRollupActive \? winRollupDisplayedRaw : presentation\.cumulativeWinRaw/u);
	assert.match(pageSource, /operatorGearTimer = window\.setInterval\([\s\S]*?12_000/u);
	assert.match(pageSource, /events\.push\(\{ cueId: 'anticipation\.confirmed'[\s\S]*?events\.push\(\{ cueId: 'operative\.anticipation'/u);
	assert.doesNotMatch(pageSource, /events\.push\(\{ cueId: 'ambience\.tension'/u);
	assert.match(pageSource, /return roundTerminalAudioAcknowledged[\s\S]*?'round\.complete'/u);
});

test('V21, V22 and V27 expose a truthful production surface inheritance chain', () => {
	assert.equal(BLACKSITE_ASSETS.ui.v21.devOnly, false);
	assert.equal(BLACKSITE_ASSETS.ui.v21.productionScope, 'shared-control-atlases-and-nine-slice');
	assert.equal(BLACKSITE_ASSETS.ui.v22.devOnly, false);
	assert.equal(BLACKSITE_ASSETS.ui.v22.productionScope, 'penguin-operative-reels-surface-and-depth');
	assert.equal(BLACKSITE_ASSETS.ui.v27.devOnly, false);
	assert.equal(BLACKSITE_ASSETS.ui.v27.inheritedFrom, 22);
	assert.equal(assertBlacksiteAssetRegistry(), true);
});

test('V28 environment plates are catalogued as a six-plate preload candidate without replacing the V22 shell owner', async () => {
	const [pageSource, registrySource] = await Promise.all([
		source('src/routes/+page.svelte'),
		source('src/lib/assets/blacksite-asset-registry.js'),
	]);
	const candidate = BLACKSITE_ASSETS.environment.v28Candidate;
	assert.equal(candidate.status, 'catalogued-preload-candidate');
	assert.equal(candidate.runtimeOwner, 'v22-responsive-machine-shell');
	assert.equal(Object.keys(candidate.base).length, 3);
	assert.equal(Object.keys(candidate.blackout).length, 3);
	assert.equal(
		new Set([...Object.values(candidate.base), ...Object.values(candidate.blackout)]).size,
		6,
	);
	assert.match(pageSource, /prewarmV28EnvironmentCandidate\('base'\)/u);
	assert.match(pageSource, /case 'feature_armed':[\s\S]*?prewarmV28EnvironmentCandidate\('blackout'\)/u);
	assert.match(pageSource, /V22 remains the sole opaque machine/u);
	assert.match(registrySource, /catalog-and-responsive-preload-only-until-transparent-shell-separation/u);
});

test('Vault media ships the canonical V26 MP4 and exact-frame poster while retaining synthetic V24 selector fallback semantics', async () => {
	const [assetSource, selectorSource, componentSource, registrySource] = await Promise.all([
		source('src/lib/assets/blacksite-assets.js'),
		source('src/lib/runtime/vault-media-selector.js'),
		source('src/lib/components/VaultCinematic.svelte'),
		source('src/lib/assets/blacksite-asset-registry.js'),
	]);
	const cinematic = BLACKSITE_ASSETS.v19.cinematic;

	assert.deepEqual(Object.keys(cinematic), [
		'vaultOpeningVideoV26',
		'vaultOpeningPoster',
	]);
	assert.equal(cinematic.vaultOpeningVideoV26.endsWith('/v26/cinematic/vault-opening-blackout-v26-720p24.mp4'), true);
	assert.equal(cinematic.vaultOpeningPoster.endsWith('/v26/cinematic/vault-opening-blackout-v26-poster-720p.webp'), true);
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: cinematic, reducedMotion: true, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.POSTER, source: null, poster: cinematic.vaultOpeningPoster },
	);
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: cinematic, ultraHdCapable: true }),
		{ tier: VAULT_MEDIA_TIER.PRIMARY, source: cinematic.vaultOpeningVideoV26, poster: cinematic.vaultOpeningPoster },
	);
	const syntheticV24Fallback = Object.freeze({
		vaultOpeningVideo1080: '/synthetic/v24-vault-fallback.webm',
		vaultOpeningPoster: '/synthetic/vault-poster.webp',
	});
	assert.deepEqual(
		resolveVaultMediaSelection({ assets: syntheticV24Fallback, ultraHdCapable: false }),
		{
			tier: VAULT_MEDIA_TIER.FULL_HD,
			source: syntheticV24Fallback.vaultOpeningVideo1080,
			poster: syntheticV24Fallback.vaultOpeningPoster,
		},
	);
	assert.match(assetSource, /vaultOpeningVideoV26:\s*packageAsset\('v26\/cinematic\/vault-opening-blackout-v26-720p24\.mp4'\)/u);
	assert.match(assetSource, /vaultOpeningPoster:\s*packageAsset\('v26\/cinematic\/vault-opening-blackout-v26-poster-720p\.webp'\)/u);
	assert.doesNotMatch(assetSource, /v24\/cinematic|vaultOpeningVideo1080/u);
	assert.match(selectorSource, /primary = assets\?\.vaultOpeningVideoV26/u);
	assert.match(registrySource, /vaultOpeningVideoV26[\s\S]*v26\/cinematic\/vault-opening-blackout-v26-720p24\.mp4/u);
	assert.match(componentSource, /MODERN_PRESENTATION_ENABLED = __BLACKSITE_MODERN_PRESENTATION__/u);
	assert.match(componentSource, /openingHasV26Contract[\s\S]*vaultOpeningVideoV26[\s\S]*vaultOpeningPoster/u);
	assert.match(componentSource, /openingMediaTier === VAULT_MEDIA_TIER\.PRIMARY[\s\S]*'v26-720p24'/u);
	assert.match(componentSource, /openingReduced[\s\S]*VAULT_MEDIA_TIER\.POSTER/u);
	assert.doesNotMatch(componentSource, /on:ended/u);
});

test('production pruner keeps canonical media, six V28 environment plates and the exact curated V29 audio closure', async () => {
	const prunerSource = await source('scripts/prune-production-assets.mjs');
	const deniedRootsSource = prunerSource.match(/const DENIED_PRODUCTION_ROOTS = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] ?? '';
	const v28AllowlistSource = prunerSource.match(/\n\tv28: Object\.freeze\(\[([\s\S]*?)\n\t\]\),/u)?.[1] ?? '';
	const v29AllowlistSource = prunerSource.match(/\n\tv29: Object\.freeze\(\[([\s\S]*?)\n\t\]\),/u)?.[1] ?? '';
	const curatedAudioFiles = [...new Set(
		BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.cues.flatMap((cue) => cue.runtimeFiles),
	)].sort((left, right) => left.localeCompare(right, 'en'));
	for (const root of [
		'audio/v19',
		'environment',
		'runtime-rgba-dev-v1',
		'runtime-rgba-dev-fx-v1',
		'symbols/sym_01_operative',
		'ui/reel-depth-v1',
		'ui/reel-strips-v1',
		'v19/cinematic/dev-rig-v1',
		'v24',
	]) {
		assert.match(deniedRootsSource, new RegExp(`['\"]${root.replaceAll('/', '\\/')}['\"]`, 'u'));
	}
	assert.doesNotMatch(deniedRootsSource, /['"]v26['"]/u);
	assert.match(prunerSource, /SCOPED_PRODUCTION_ALLOWLISTS/u);
	assert.match(prunerSource, /v22\/environment\/premium-machine-shell-v22\.webp/u);
	assert.match(prunerSource, /v20\/penguin-operator\/transitions\/idle-to-spin\.webp/u);
	assert.match(prunerSource, /v22\/symbols\/operative\/base\.webp/u);
	assert.match(prunerSource, /v22\/ui\/reel-strips\/reel-01\.webp/u);
	assert.match(prunerSource, /v22\/ui-kit\/reel-stage\/inner-bezel-depth-overlay\.webp/u);
	assert.match(prunerSource, /rgbaFrameFiles\('standalone_fx', 'FX_WIN_FLASH', 10\)/u);
	assert.match(prunerSource, /v28: Object\.freeze\(\[/u);
	assert.match(prunerSource, /v28\/environment\/base-desktop\.webp/u);
	assert.match(prunerSource, /v28\/environment\/blackout-interior-short-landscape\.webp/u);
	assert.equal((v28AllowlistSource.match(/v28\/environment\//gu) ?? []).length, 6);
	assert.doesNotMatch(v28AllowlistSource, /audio|BLACKSITE_AUDIO/u);
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot, 'assets/blacksite/v29/audio');
	assert.equal(curatedAudioFiles.length, 121);
	assert.equal(new Set(curatedAudioFiles).size, curatedAudioFiles.length);
	assert.equal(
		curatedAudioFiles.every((path) => path.startsWith(`${BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot}/`)),
		true,
	);
	assert.match(prunerSource, /blacksite-audio-runtimepack-v1\.generated\.js/u);
	assert.match(prunerSource, /new Set\(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA\.cues\.flatMap/u);
	assert.match(prunerSource, /BLACKSITE_AUDIO_V29_FILES\.length, 121/u);
	assert.match(v29AllowlistSource, /BLACKSITE_AUDIO_V29_RUNTIME_MANIFEST/u);
	assert.match(v29AllowlistSource, /\.\.\.BLACKSITE_AUDIO_V29_FILES\.map\(productionRelativeAsset\)/u);
	assert.match(prunerSource, /v26: Object\.freeze\(\[[\s\S]*vault-opening-blackout-v26-720p24\.mp4[\s\S]*vault-opening-blackout-v26-poster-720p\.webp/u);
	assert.doesNotMatch(prunerSource, /MP4 media is not allowed in V28 production/u);
	assert.doesNotMatch(prunerSource, /vault-opening-blackout-v24-1080p60\.webm|vault-opening-blackout-v24-poster-1080p\.webp/u);
	assert.doesNotMatch(prunerSource, /vault-opening-blackout-v24-2160p60\.webm/u);
	assert.match(prunerSource, /completeBuildBytes < MAX_COMPLETE_BUILD_BYTES/u);
});
