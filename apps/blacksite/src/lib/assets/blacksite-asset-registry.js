import { BLACKSITE_ASSETS, SYMBOL_MASTER_IDS } from './blacksite-assets.js';
import { BLACKSITE_UI_V21_GLYPHS, BLACKSITE_UI_V21_STATES } from './blacksite-ui-v21.js';
import { BLACKSITE_UI_V27_KINDS } from './blacksite-ui-v27.js';
import { PENGUIN_OPERATOR_ASSETS } from './penguin-operator-assets.js';
import { SYMBOL_DISPLAY_NAMES } from '../contracts/reels.js';

const PENGUIN_RUNTIME_FILES = Object.freeze([
	...Object.entries(PENGUIN_OPERATOR_ASSETS)
		.filter(([, value]) => typeof value === 'string')
		.map(([, value]) => value),
	...Object.values(PENGUIN_OPERATOR_ASSETS.enterTransitions),
	...Object.values(PENGUIN_OPERATOR_ASSETS.exitTransitions),
]);

const SYMBOL_DEFINITIONS = Object.freeze([
	Object.freeze({ id: 'operative', code: 'SYM_01', tier: 'premium' }),
	Object.freeze({ id: 'encrypted_drive', code: 'SYM_02', tier: 'premium' }),
	Object.freeze({ id: 'tactical_radio', code: 'SYM_03', tier: 'premium' }),
	Object.freeze({ id: 'classified_folder', code: 'SYM_04', tier: 'premium' }),
	Object.freeze({ id: 'night_vision_goggles', code: 'SYM_05', tier: 'premium' }),
	Object.freeze({ id: 'supply_crate', code: 'SYM_06', tier: 'premium' }),
	Object.freeze({ id: 'ghost_wild', code: 'SYM_07', tier: 'special', role: 'wild' }),
	Object.freeze({ id: 'breach', code: 'SYM_08', tier: 'special', role: 'scatter' }),
	Object.freeze({ id: 'a', code: 'SYM_09', tier: 'low' }),
	Object.freeze({ id: 'k', code: 'SYM_10', tier: 'low' }),
	Object.freeze({ id: 'q', code: 'SYM_11', tier: 'low' }),
	Object.freeze({ id: 'j', code: 'SYM_12', tier: 'low' }),
	Object.freeze({ id: 'ten', code: 'SYM_13', tier: 'low' }),
]);

export const BLACKSITE_SYMBOL_LIBRARY = Object.freeze(
	SYMBOL_DEFINITIONS.map((definition) =>
		Object.freeze({
			...definition,
			label: SYMBOL_DISPLAY_NAMES[definition.id],
			master: BLACKSITE_ASSETS.symbols.master[definition.id],
			stateAssets: BLACKSITE_ASSETS.symbols.states[definition.id],
			states: Object.freeze(Object.keys(BLACKSITE_ASSETS.symbols.states[definition.id])),
			stateDelivery: 'dedicated-webp-state-pack',
		}),
	),
);

export const BLACKSITE_UI_ASSET_REGISTRY = Object.freeze({
	environment: Object.freeze({
		machineShells: Object.freeze({
			desktop: BLACKSITE_ASSETS.environment.premiumMachineV22,
			portrait: BLACKSITE_ASSETS.environment.premiumMachinePortraitV22,
			phone: BLACKSITE_ASSETS.environment.premiumMachinePhoneV22,
			compactPhone: BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22,
			shortLandscape: BLACKSITE_ASSETS.environment.premiumMachineShortLandscapeV22,
		}),
		selection: 'v22-responsive-picture-source',
		v28CandidatePlates: BLACKSITE_ASSETS.environment.v28Candidate,
		v28CandidatePolicy: 'catalog-and-responsive-preload-only-until-transparent-shell-separation',
	}),
	branding: Object.freeze(['logo-main', 'logo-compact', 'status-indicator']),
	characterStage: Object.freeze([
		'floor-anchor',
		'red-backlight',
		'cyan-rim-light',
		'ground-shadow',
	]),
	character: Object.freeze({
		canonical: 'swat-penguin-v20',
		assets: PENGUIN_RUNTIME_FILES,
		fallback: 'penguin-poster-v20',
	}),
	reels: Object.freeze([
		'outer-frame',
		'inner-frame',
		'column-dividers',
		'tile-base',
		'glass-overlay',
		'line-markers',
		'raster-payline-01',
		'raster-payline-02',
		'raster-payline-03',
		'raster-payline-04',
		'raster-payline-05',
		'raster-payline-06',
		'raster-payline-07',
		'raster-payline-08',
		'raster-payline-09',
		'raster-payline-10',
		'raster-reel-strip-01',
		'raster-reel-strip-02',
		'raster-reel-strip-03',
		'raster-reel-strip-04',
		'raster-reel-strip-05',
	]),
	feature: Object.freeze(['banner', 'vault-callout', 'free-spin-counter', 'target-readout']),
	v21: BLACKSITE_ASSETS.ui.v21,
	v22: BLACKSITE_ASSETS.ui.v22,
	v27: BLACKSITE_ASSETS.ui.v27,
	v19: Object.freeze({
		vaultSymbol: BLACKSITE_ASSETS.v19.vaultSymbol,
		cinematic: BLACKSITE_ASSETS.v19.cinematic,
		logicalVaultStates: Object.freeze({
			base: BLACKSITE_ASSETS.v19.vaultSymbol.base,
			win: BLACKSITE_ASSETS.v19.vaultSymbol.triggered,
			dim: BLACKSITE_ASSETS.v19.vaultSymbol.dim,
			anticipation: BLACKSITE_ASSETS.v19.vaultSymbol.anticipation,
			triggered: BLACKSITE_ASSETS.v19.vaultSymbol.triggered,
		}),
		scenes: BLACKSITE_ASSETS.v19.scenes,
		modes: BLACKSITE_ASSETS.v19.modes,
		reelStripVaultStopsZeroBased: Object.freeze([4, 6, 8, 10, 12]),
	}),
	hud: Object.freeze({
		controls: Object.freeze([
			'menu',
			'buy',
			'auto',
			'minus',
			'plus',
			'spin',
			'turbo',
			'info',
			'settings',
			'close',
			'resume',
		]),
		panels: Object.freeze([
			'mode-card',
			'meter-bet',
			'meter-total',
			'meter-win',
			'meter-balance',
			'how-to',
			'ticker',
			'marker',
		]),
	}),
	interactionStates: Object.freeze(['normal', 'hover', 'pressed', 'active', 'disabled']),
	modeCardStates: Object.freeze(['normal', 'hover', 'selected', 'disabled']),
	markerStates: Object.freeze(['normal', 'active', 'disabled']),
	dialogFrames: Object.freeze({
		mode: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.mode,
		menu: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.menu,
		confirmation: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation,
		rules: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.rules,
		auto: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.auto,
		settings: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.settings,
		runtimeError: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError,
	}),
	fx: Object.freeze([
		'reel-spin-blur',
		'reel-stop-impact',
		'symbol-land',
		'wild-land',
		'scatter-land',
		'line-trace',
		'win-pulse',
		'blackout-transition',
		'spin-ring-energy',
	]),
	delivery: 'v28-vertical-slice-v22-shell-v21-v22-v27-ui-canonical-penguin-webp-canonical-reels-v28-environment-candidate-v26-vault-film',
});

export function assertBlacksiteAssetRegistry() {
	const ids = BLACKSITE_SYMBOL_LIBRARY.map(({ id }) => id);
	const paths = BLACKSITE_SYMBOL_LIBRARY.map(({ master }) => master);
	const environmentShells = Object.values(BLACKSITE_UI_ASSET_REGISTRY.environment.machineShells);
	const v28EnvironmentPlates = [
		...Object.values(BLACKSITE_UI_ASSET_REGISTRY.environment.v28CandidatePlates.base),
		...Object.values(BLACKSITE_UI_ASSET_REGISTRY.environment.v28CandidatePlates.blackout),
	];
	const dialogFrames = Object.values(BLACKSITE_UI_ASSET_REGISTRY.dialogFrames);
	const v19VaultFiles = Object.values(BLACKSITE_UI_ASSET_REGISTRY.v19.vaultSymbol);
	const v19CinematicFiles = Object.values(BLACKSITE_UI_ASSET_REGISTRY.v19.cinematic);
	const v19Scenes = Object.values(BLACKSITE_UI_ASSET_REGISTRY.v19.scenes);
	const v19Modes = Object.values(BLACKSITE_UI_ASSET_REGISTRY.v19.modes);
	const v21 = BLACKSITE_UI_ASSET_REGISTRY.v21;
	const v21Sources = v21?.preload ?? [];
	const v22 = BLACKSITE_ASSETS.ui.v22;
	const v27 = BLACKSITE_UI_ASSET_REGISTRY.v27;
	const v27RuntimeSources = [
		...BLACKSITE_UI_V27_KINDS.map((kind) => v27?.nineSlice?.[kind]?.states?.idle),
		v27?.decor?.rewardHalo,
	];
	const penguinRuntimeFiles = BLACKSITE_UI_ASSET_REGISTRY.character.assets;
	if (JSON.stringify(ids) !== JSON.stringify(SYMBOL_MASTER_IDS)) {
		throw new Error('BLACKSITE symbol registry does not match the canonical 13-symbol order');
	}
	if (new Set(ids).size !== 13 || new Set(paths).size !== 13) {
		throw new Error('BLACKSITE requires exactly 13 unique symbol IDs and master assets');
	}
	if (BLACKSITE_SYMBOL_LIBRARY.some(({ label, master }) => !label || !master)) {
		throw new Error('BLACKSITE symbol registry contains an incomplete entry');
	}
	if (
		!BLACKSITE_ASSETS.symbols.master.operative.includes('/v22/symbols/operative/base.webp')
		|| Object.values(BLACKSITE_ASSETS.symbols.states.operative)
			.some((asset) => !asset.includes('/v22/symbols/operative/'))
	) {
		throw new Error('BLACKSITE visible operative symbol must use the V22 Penguin pack');
	}
	if (BLACKSITE_SYMBOL_LIBRARY.some(({ stateAssets, states }) =>
		!stateAssets
		|| !states.includes('base')
		|| !states.includes('win')
		|| !states.includes('dim')
		|| states.some((state) => !stateAssets[state]))) {
		throw new Error('BLACKSITE symbol registry contains an incomplete raster state pack');
	}
	if (
		environmentShells.length !== 5
		|| new Set(environmentShells).size !== 5
		|| environmentShells.some((asset) => !asset)
		|| environmentShells.some((asset) => !asset.includes('/v22/environment/'))
	) {
		throw new Error('BLACKSITE responsive machine-shell registry is incomplete');
	}
	if (
		BLACKSITE_UI_ASSET_REGISTRY.environment.v28CandidatePlates.status !== 'catalogued-preload-candidate'
		|| BLACKSITE_UI_ASSET_REGISTRY.environment.v28CandidatePlates.runtimeOwner !== 'v22-responsive-machine-shell'
		|| v28EnvironmentPlates.length !== 6
		|| new Set(v28EnvironmentPlates).size !== 6
		|| v28EnvironmentPlates.some((asset) => !asset.includes('/v28/environment/'))
	) {
		throw new Error('BLACKSITE V28 environment candidate registry is incomplete');
	}
	if (
		dialogFrames.length !== 7
		|| new Set(dialogFrames).size !== 7
		|| dialogFrames.some((asset) => !asset)
	) {
		throw new Error('BLACKSITE dialog-frame registry is incomplete');
	}
	if (
		v19VaultFiles.length !== 4
		|| new Set(v19VaultFiles).size !== 4
		|| v19VaultFiles.some((asset) => !asset)
		|| BLACKSITE_SYMBOL_LIBRARY.find(({ id }) => id === 'breach')?.master
			!== BLACKSITE_UI_ASSET_REGISTRY.v19.vaultSymbol.base
		|| BLACKSITE_UI_ASSET_REGISTRY.v19.logicalVaultStates.win
			!== BLACKSITE_UI_ASSET_REGISTRY.v19.vaultSymbol.triggered
	) {
		throw new Error('BLACKSITE V19 Vault symbol registry is incomplete');
	}
	if (
		v19CinematicFiles.length !== 2
		|| new Set(v19CinematicFiles).size !== 2
		|| BLACKSITE_UI_ASSET_REGISTRY.v19.cinematic.vaultOpeningVideoV26
			?.endsWith('/v26/cinematic/vault-opening-blackout-v26-720p24.mp4') !== true
		|| BLACKSITE_UI_ASSET_REGISTRY.v19.cinematic.vaultOpeningPoster
			?.endsWith('/v26/cinematic/vault-opening-blackout-v26-poster-720p.webp') !== true
	) {
		throw new Error('BLACKSITE V19 Vault cinematic registry is incomplete');
	}
	if (
		BLACKSITE_UI_ASSET_REGISTRY.character.canonical !== 'swat-penguin-v20'
		|| penguinRuntimeFiles.length !== 26
		|| new Set(penguinRuntimeFiles).size !== 26
		|| penguinRuntimeFiles.some((asset) => !asset.includes('/v20/penguin-operator/'))
	) {
		throw new Error('BLACKSITE production Penguin character registry is incomplete');
	}
	if (
		v19Scenes.length !== 3
		|| new Set(v19Scenes).size !== 3
		|| v19Scenes.some((asset) => !asset)
		|| v19Modes.length !== 3
		|| new Set(v19Modes).size !== 3
		|| v19Modes.some((asset) => !asset)
		|| JSON.stringify(BLACKSITE_UI_ASSET_REGISTRY.v19.reelStripVaultStopsZeroBased)
			!== JSON.stringify([4, 6, 8, 10, 12])
	) {
		throw new Error('BLACKSITE V19 scene, mode or reel-strip registry is incomplete');
	}
	if (
		v21?.devOnly !== false
		|| v21.productionScope !== 'shared-control-atlases-and-nine-slice'
		|| v21.version !== 21
		|| JSON.stringify(v21.states) !== JSON.stringify(BLACKSITE_UI_V21_STATES)
		|| v21Sources.length !== 12
		|| new Set(v21Sources).size !== 12
		|| !v21Sources.every((source) => source.endsWith('.webp'))
		|| !v21.manifest?.endsWith('/v21/ui-kit/manifest.json')
	) {
		throw new Error('BLACKSITE shared production V21 UI asset catalog is incomplete');
	}
	if (
		v21.nineSlice.control.width !== 288
		|| v21.nineSlice.control.height !== 144
		|| JSON.stringify(v21.nineSlice.control.sliceInsets) !== JSON.stringify({ top: 48, right: 48, bottom: 48, left: 48 })
		|| Object.keys(v21.nineSlice.control.states).join(',') !== BLACKSITE_UI_V21_STATES.join(',')
		|| v21.nineSlice.panel.width !== 384
		|| v21.nineSlice.panel.height !== 256
		|| JSON.stringify(v21.nineSlice.panel.sliceInsets) !== JSON.stringify({ top: 64, right: 64, bottom: 64, left: 64 })
		|| Object.keys(v21.nineSlice.panel.states).join(',') !== 'idle,danger'
		|| v21.nineSlice.readout.width !== 320
		|| v21.nineSlice.readout.height !== 128
		|| JSON.stringify(v21.nineSlice.readout.sliceInsets) !== JSON.stringify({ top: 32, right: 48, bottom: 32, left: 48 })
	) {
		throw new Error('BLACKSITE V21 nine-slice geometry contract is invalid');
	}
	if (
		v21.atlases.roundStates.width !== 1400
		|| v21.atlases.roundStates.height !== 200
		|| Object.keys(v21.atlases.roundStates.states).join(',') !== BLACKSITE_UI_V21_STATES.join(',')
		|| v21.atlases.glyphs.width !== 1536
		|| v21.atlases.glyphs.height !== 480
		|| Object.keys(v21.atlases.glyphs.glyphs).join(',') !== BLACKSITE_UI_V21_GLYPHS.join(',')
	) {
		throw new Error('BLACKSITE V21 atlas geometry contract is invalid');
	}
	if (
		v22?.devOnly !== false
		|| v22.productionScope !== 'penguin-operative-reels-surface-and-depth'
		|| v22.version !== 22
		|| JSON.stringify(v22.reelStrips) !== JSON.stringify(BLACKSITE_ASSETS.ui.reelStrips)
		|| !v22.reelStrips.every((source) => source.includes('/v22/ui/reel-strips/'))
		|| !v22.reelStage?.innerBezel?.source?.includes('/v22/ui-kit/reel-stage/')
		|| !v22.reelStage?.cellDepth?.source?.includes('/v22/ui-kit/reel-stage/')
	) {
		throw new Error('BLACKSITE production-safe V22 surface closure is invalid');
	}
	if (
		v27?.devOnly !== false
		|| v27.version !== 27
		|| v27.inheritedFrom !== 22
		|| JSON.stringify(v27.states) !== JSON.stringify(BLACKSITE_UI_V21_STATES)
		|| !v27.manifest?.endsWith('/v27/ui-kit/manifest.json')
		|| v27.nineSlice.control !== v22.nineSlice.control
		|| v27.nineSlice.panel !== v22.nineSlice.panel
		|| v27.nineSlice.readout !== v22.nineSlice.readout
		|| v27.atlases !== v22.atlases
		|| v27.reelStrips !== v22.reelStrips
		|| v27.reelStage !== v22.reelStage
	) {
		throw new Error('BLACKSITE production V27 inheritance contract is invalid');
	}
	const v27Geometry = Object.freeze({
		feature: Object.freeze([960, 384, 128, 176, 128, 176]),
		content: Object.freeze([768, 512, 112, 128, 112, 128]),
		header: Object.freeze([1280, 256, 64, 160, 64, 160]),
		award: Object.freeze([1280, 640, 144, 176, 144, 176]),
		chip: Object.freeze([768, 240, 60, 96, 60, 96]),
		progress: Object.freeze([1024, 96, 28, 48, 28, 48]),
	});
	for (const kind of BLACKSITE_UI_V27_KINDS) {
		const surface = v27.nineSlice[kind];
		const [width, height, top, right, bottom, left] = v27Geometry[kind];
		if (
			surface?.width !== width
			|| surface.height !== height
			|| JSON.stringify(surface.sliceInsets) !== JSON.stringify({ top, right, bottom, left })
			|| Object.keys(surface.states ?? {}).join(',') !== BLACKSITE_UI_V21_STATES.join(',')
			|| !Object.values(surface.states ?? {}).every((source) => source === surface.states.idle)
		) {
			throw new Error(`BLACKSITE V27 ${kind} nine-slice geometry contract is invalid`);
		}
	}
	if (
		v27RuntimeSources.length !== 7
		|| new Set(v27RuntimeSources).size !== 7
		|| v27RuntimeSources.some((source) => !source?.includes('/v27/ui-kit/') || !source.endsWith('.webp'))
		|| v27.decorGeometry?.rewardHalo?.width !== 768
		|| v27.decorGeometry?.rewardHalo?.height !== 768
		|| JSON.stringify(v27.decorGeometry?.rewardHalo?.openingInsets)
			!== JSON.stringify({ top: 220, right: 220, bottom: 220, left: 220 })
		|| !v27RuntimeSources.every((source) => v27.preload.includes(source))
	) {
		throw new Error('BLACKSITE production V27 runtime asset closure is incomplete');
	}
	return true;
}
