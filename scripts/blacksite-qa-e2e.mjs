#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	LINE_LENGTHS,
	RULES_CONTRACT,
	SYMBOL_PAYOUTS,
	getRulesDisclaimer,
} from '../apps/blacksite/src/lib/contracts/rules.js';
import {
	ALL_SYMBOLS,
	PAYLINES,
	SYMBOL_DISPLAY_NAMES,
} from '../apps/blacksite/src/lib/contracts/reels.js';
import { BASE_ZERO_FIXTURE } from '../apps/blacksite/src/lib/fixtures/base-zero.js';
import { encodePresentationCursor } from '../apps/blacksite/src/lib/rgs/contracts.js';
import {
	FIXTURE_IDS as GENERATED_FIXTURE_IDS,
	getFixture as getGeneratedFixture,
} from '../apps/blacksite/src/lib/fixtures/catalog.generated.js';
import {
	OPERATOR_FX_CATALOG,
} from '../apps/blacksite/src/lib/assets/operator-animation-assets.js';
import { BLACKSITE_ASSETS } from '../apps/blacksite/src/lib/assets/blacksite-assets.js';
import { BLACKSITE_INTRO_MANIFEST_URL } from '../apps/blacksite/src/lib/assets/blacksite-intro-assets.js';
import {
	BLACKSITE_AUDIO_V28_FILES,
	BLACKSITE_AUDIO_V28_RUNTIME_MANIFEST,
} from '../apps/blacksite/src/lib/assets/blacksite-audio-v28.js';
import { PENGUIN_OPERATOR_CLIPS } from '../apps/blacksite/src/lib/assets/penguin-operator-assets.js';
import { playerVisibleRestrictedHits } from '../packages/utils-shared/stake-social.js';
import {
	BLACKSITE_QA_RGS_ORIGIN,
	installMockRgs,
	mockHttpResponse,
} from '../apps/blacksite/tests/browser/mock-rgs.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const requestedBuildRoot = process.env.BLACKSITE_QA_BUILD_ROOT?.trim();
const buildRoot = requestedBuildRoot
	? resolve(repoRoot, requestedBuildRoot)
	: join(repoRoot, 'apps', 'blacksite', 'build');
const buildEntry = join(buildRoot, 'index.html');
const expectedBuildTreeSha256 = process.env.BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256?.trim() ?? '';
const allowDirtyDevelopmentRun = process.env.BLACKSITE_QA_ALLOW_DIRTY === '1';
const v18MathRoot = resolve(
	process.env.BLACKSITE_QA_V18_MATH_ROOT?.trim() || join(repoRoot, '..', 'BLACKSITE_MATH_UPLOAD_V18'),
);
const v19MathRoot = resolve(
	process.env.BLACKSITE_QA_V19_MATH_ROOT?.trim() || join(repoRoot, '..', 'BLACKSITE_MATH_UPLOAD_V19'),
);
const requireV19Output = process.env.BLACKSITE_QA_REQUIRE_V19_OUTPUT === '1'
	|| /BLACKSITE_FRONTEND_UPLOAD_V19$/iu.test(buildRoot.replaceAll('\\', '/'));
const startedAt = new Date().toISOString();
const timestamp = startedAt.replace(/[:.]/g, '-');
const artifactRoot = join(repoRoot, 'artifacts', 'blacksite-qa', timestamp);
const screenshotRoot = join(artifactRoot, 'screenshots');
const evidenceFile = join(artifactRoot, 'blacksite-browser-evidence.json');

const SESSION_ID = 'blacksite-qa-session';
const API_UNIT = 1_000_000;
const DEFAULT_BASE_AMOUNT = API_UNIT;
const DEFAULT_BALANCE = 1_000 * API_UNIT;
const REPLAY_VERSION = '0.3.0-math-v3';
const MODE_COSTS = Object.freeze({ base: 1, deep_access: 4, blackout: 80 });
const MAX_RUNTIME_ASSET_BYTES = 64 * 1024 * 1024;
const NESTED_BUILD_PREFIX = '/stake/games/blacksite/v1/';
const STAKE_FILE_BASE_ORIGIN = 'https://stake-qa.invalid';
const STAKE_V5_PREFIX = '/blacksite-breach/v5/';
const STAKE_FILE_BASE_HREF =
	'file:///C:/Stake/packages/blacksite-breach/v5/index.html';
const OPERATIVE_FRAME_WIDTH = 1_280;
const OPERATIVE_FRAME_HEIGHT = 1_024;
const OPERATIVE_IDLE_ALPHA_ENVELOPE = Object.freeze({
	left: 128,
	top: 67,
	right: 493,
	bottom: 1_004,
	canvasWidth: OPERATIVE_FRAME_WIDTH,
	canvasHeight: OPERATIVE_FRAME_HEIGHT,
});
const PENGUIN_OPERATOR_SEQUENCE_NAMES = Object.freeze([...new Set(
	Object.values(PENGUIN_OPERATOR_CLIPS).map(({ semanticState }) => semanticState),
)]);
const PENGUIN_OPERATOR_CLIP_IDS = Object.freeze(Object.keys(PENGUIN_OPERATOR_CLIPS));
const PENGUIN_OPERATOR_FRAME_ASSETS = Object.freeze([...new Set(
	Object.values(PENGUIN_OPERATOR_CLIPS).map(({ source }) => normalizedAssetPath(source)),
)]);
const STANDALONE_FX_NAMES = Object.freeze(Object.keys(OPERATOR_FX_CATALOG));
const STANDALONE_FX_FRAME_ASSETS = Object.freeze(
	Object.values(OPERATOR_FX_CATALOG).flatMap(({ frames }) => frames),
);
const PRODUCTION_RUNTIME_FX_ASSETS = Object.freeze([...STANDALONE_FX_FRAME_ASSETS]);
const SYMBOL_DIRECTORIES = Object.freeze({
	operative: 'sym_01_operative',
	encrypted_drive: 'sym_02_encrypted_drive',
	tactical_radio: 'sym_03_tactical_radio',
	classified_folder: 'sym_04_classified_folder',
	night_vision_goggles: 'sym_05_night_vision_goggles',
	supply_crate: 'sym_06_supply_crate',
	ghost_wild: 'sym_07_ghost_wild',
	breach: 'sym_08_breach_scatter',
	a: 'sym_09_a',
	k: 'sym_10_k',
	q: 'sym_11_q',
	j: 'sym_12_j',
	ten: 'sym_13_ten',
});
const SYMBOL_STATE_ASSETS = Object.freeze(Object.fromEntries(
	Object.entries(SYMBOL_DIRECTORIES).map(([symbolId, directory]) => {
		if (symbolId === 'operative') {
			return [symbolId, Object.freeze({
				base: 'v22/symbols/operative/base.webp',
				win: 'v22/symbols/operative/win.webp',
				dim: 'v22/symbols/operative/dim.webp',
			})];
		}
		if (symbolId === 'breach') {
			return [symbolId, Object.freeze({
				base: 'v19/vault-symbol/base.webp',
				win: 'v19/vault-symbol/triggered.webp',
				dim: 'v19/vault-symbol/dim.webp',
				anticipation: 'v19/vault-symbol/anticipation.webp',
				triggered: 'v19/vault-symbol/triggered.webp',
			})];
		}
		const stateNames = ['base', 'win', 'dim'];
		if (symbolId === 'ghost_wild') {
			stateNames.push('anticipation', 'triggered');
		}
		return [symbolId, Object.freeze(Object.fromEntries(stateNames.map((state) => [
			state,
			`symbols/${directory}/states-v4/${state}-v4.webp`,
		])))];
	}),
));
const SYMBOL_MASTER_ASSETS = Object.freeze(Object.fromEntries(
	Object.entries(SYMBOL_STATE_ASSETS).map(([symbolId, states]) => [symbolId, states.base]),
));
const ENVIRONMENT_ASSETS = Object.freeze({
	premiumMachine: 'v22/environment/premium-machine-shell-v22.webp',
	premiumMachinePortrait: 'v22/environment/premium-machine-shell-portrait-v22.webp',
	premiumMachinePhone: 'v22/environment/premium-machine-shell-phone-v22.webp',
	premiumMachineCompactPhone: 'v22/environment/premium-machine-shell-compact-phone-v22.webp',
	premiumMachineShortLandscape: 'v22/environment/premium-machine-shell-short-landscape-v22.webp',
});
const V19_PRESENTATION_ASSETS = Object.freeze([
	'v19/scenes/vault-access-desktop.webp',
	'v19/scenes/blackout-interior-desktop.webp',
	'v19/scenes/extraction-report-desktop.webp',
	'v19/modes/base.webp',
	'v19/modes/deep-access.webp',
	'v19/modes/blackout.webp',
]);
const MACHINE_SHELL_ASSETS = Object.freeze({
	wide: Object.freeze({ path: ENVIRONMENT_ASSETS.premiumMachine, width: 1672, height: 941, boardRatio: 1.94, aperture: Object.freeze({ left: 0.36, top: 0.22, width: 0.49, height: 0.43 }) }),
	portrait: Object.freeze({ path: ENVIRONMENT_ASSETS.premiumMachinePortrait, width: 768, height: 1024, boardRatio: 1.41, aperture: Object.freeze({ left: 0.11, top: 0.21, width: 0.78, height: 0.41 }) }),
	phone: Object.freeze({ path: ENVIRONMENT_ASSETS.premiumMachinePhone, width: 390, height: 844, boardRatio: 1.05, aperture: Object.freeze({ left: 0.09, top: 0.19, width: 0.81, height: 0.36 }) }),
	compactPhone: Object.freeze({ path: ENVIRONMENT_ASSETS.premiumMachineCompactPhone, width: 320, height: 568, boardRatio: 1.29, aperture: Object.freeze({ left: 0.09, top: 0.19, width: 0.81, height: 0.36 }) }),
	shortLandscape: Object.freeze({ path: ENVIRONMENT_ASSETS.premiumMachineShortLandscape, width: 844, height: 390, boardRatio: 2.50, aperture: Object.freeze({ left: 0.17, top: 0.07, width: 0.65, height: 0.56 }) }),
});

function machineShellForViewport({ width, height }) {
	if (
		height >= width &&
		((width <= 380 && height <= 700) || (width >= 381 && width <= 480 && height <= 430))
	) return MACHINE_SHELL_ASSETS.compactPhone;
	if (width <= 480 && height >= width) return MACHINE_SHELL_ASSETS.phone;
	if (height <= 560 && width / height >= (4 / 3)) return MACHINE_SHELL_ASSETS.shortLandscape;
	if (width <= 1040 || width / height <= (4 / 3)) return MACHINE_SHELL_ASSETS.portrait;
	return MACHINE_SHELL_ASSETS.wide;
}
const PREMIUM_HUD_STATES = Object.freeze(['normal', 'hover', 'pressed', 'active', 'disabled']);
const PREMIUM_HUD_DIMENSIONS = Object.freeze({
	menu: Object.freeze({ width: 162, height: 220 }),
	buy: Object.freeze({ width: 202, height: 220 }),
	auto: Object.freeze({ width: 212, height: 220 }),
	minus: Object.freeze({ width: 124, height: 126 }),
	plus: Object.freeze({ width: 124, height: 126 }),
	spin: Object.freeze({ width: 316, height: 310 }),
	turbo: Object.freeze({ width: 190, height: 220 }),
	info: Object.freeze({ width: 166, height: 220 }),
	settings: Object.freeze({ width: 182, height: 220 }),
	close: Object.freeze({ width: 128, height: 128 }),
	resume: Object.freeze({ width: 640, height: 184 }),
});
const PREMIUM_HUD_ASSETS = Object.freeze(Object.fromEntries(
	Object.entries(PREMIUM_HUD_DIMENSIONS).map(([name, dimensions]) => [
		name,
		Object.freeze(Object.fromEntries(PREMIUM_HUD_STATES.map((state) => [
			state,
			Object.freeze({ path: `ui/premium-hud-v2/controls/${name}/${state}.webp`, ...dimensions }),
		]))),
	]),
));
const PREMIUM_PANEL_ASSETS = Object.freeze([
	...['normal', 'hover', 'selected', 'disabled'].map((state) =>
		Object.freeze({ path: `ui/premium-hud-v2/panels/mode-card/${state}.webp`, width: 960, height: 360 })),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-bet.webp', width: 480, height: 240 }),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-total.webp', width: 420, height: 240 }),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-win.webp', width: 420, height: 240 }),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-balance.webp', width: 720, height: 220 }),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/how-to.webp', width: 620, height: 180 }),
	Object.freeze({ path: 'ui/premium-hud-v2/panels/ticker.webp', width: 1600, height: 144 }),
	...['normal', 'active', 'disabled'].map((state) =>
		Object.freeze({ path: `ui/premium-hud-v2/panels/marker/${state}.webp`, width: 128, height: 128 })),
]);
const DIALOG_ASSETS = Object.freeze({
	mode: Object.freeze({ path: 'ui/premium-panels-v1/dialog-mode.webp', width: 1640, height: 640 }),
	menu: Object.freeze({ path: 'ui/premium-panels-v1/dialog-menu.webp', width: 1040, height: 480 }),
	confirmation: Object.freeze({ path: 'ui/premium-panels-v1/dialog-confirmation.webp', width: 1040, height: 680 }),
	rules: Object.freeze({ path: 'ui/premium-panels-v1/dialog-rules.webp', width: 1880, height: 1640 }),
	auto: Object.freeze({ path: 'ui/premium-panels-v1/dialog-auto.webp', width: 1080, height: 760 }),
	settings: Object.freeze({ path: 'ui/premium-panels-v1/dialog-settings.webp', width: 1040, height: 520 }),
	runtimeError: Object.freeze({ path: 'ui/premium-panels-v1/dialog-runtime-error.webp', width: 880, height: 520 }),
});
const PAYLINE_ASSETS = Object.freeze(Array.from(
	{ length: 10 },
	(_, index) => `ui/paylines-v1/line-${String(index + 1).padStart(2, '0')}.webp`,
));
function normalizedAssetPath(path) {
	return path.replace(/^\/+/, '');
}

function blacksiteRelativeAssetPath(path) {
	const normalized = normalizedAssetPath(path);
	assert.equal(
		normalized.startsWith('assets/blacksite/'),
		true,
		`asset is outside the BLACKSITE package: ${path}`,
	);
	return normalized.slice('assets/blacksite/'.length);
}

function productionAssetPath(path) {
	const normalized = normalizedAssetPath(path);
	return normalized.startsWith('assets/blacksite/')
		? normalized
		: `assets/blacksite/${normalized}`;
}

const REEL_STRIP_ASSETS = Object.freeze(
	BLACKSITE_ASSETS.ui.reelStrips.map(blacksiteRelativeAssetPath),
);
const PRODUCTION_CINEMATIC_ASSETS = Object.freeze(
	Object.values(BLACKSITE_ASSETS.v19.cinematic).map(blacksiteRelativeAssetPath),
);
const EXPECTED_V26_CINEMATIC_ASSET_RECORDS = Object.freeze([
	Object.freeze({
		path: productionAssetPath('v26/cinematic/vault-opening-blackout-v26-720p24.mp4'),
		bytes: 5_956_543,
		sha256: '5edad7d2f7c56ec48d3e6afd7c344c9b0704053baaeb14b2f7a0fd6084ac3acf',
	}),
	Object.freeze({
		path: productionAssetPath('v26/cinematic/vault-opening-blackout-v26-poster-720p.webp'),
		bytes: 74_342,
		sha256: 'c0ce502b59f7e9d51c6de1cb2758c74e920be52dd412ea1005deda50cf54d9f9',
	}),
]);
const EXPECTED_V26_CINEMATIC_ASSET_PATHS = Object.freeze(
	EXPECTED_V26_CINEMATIC_ASSET_RECORDS.map(({ path }) => path),
);
const PRODUCTION_AUDIO_ASSETS = Object.freeze([
	BLACKSITE_AUDIO_V28_RUNTIME_MANIFEST,
	...BLACKSITE_AUDIO_V28_FILES,
].map(blacksiteRelativeAssetPath));
const PENGUIN_CHARACTER_ASSETS = Object.freeze([...new Set([
	'v20/penguin-operator/manifest.json',
	...Object.values(PENGUIN_OPERATOR_CLIPS).map(({ source }) => blacksiteRelativeAssetPath(source)),
])].sort((left, right) => left.localeCompare(right, 'en')));
const V21_UI_ASSETS = Object.freeze([...new Set([
	BLACKSITE_ASSETS.ui.v21.manifest,
	...BLACKSITE_ASSETS.ui.v21.preload,
].map(blacksiteRelativeAssetPath))].sort((left, right) => left.localeCompare(right, 'en')));
const V22_UI_ASSETS = Object.freeze([...new Set([
	BLACKSITE_ASSETS.ui.v22.manifest,
	...BLACKSITE_ASSETS.ui.v22.preload,
].map(blacksiteRelativeAssetPath).filter((path) => path.startsWith('v22/ui-kit/')))]
	.sort((left, right) => left.localeCompare(right, 'en')));
const V27_UI_ASSETS = Object.freeze([...new Set([
	BLACKSITE_ASSETS.ui.v27.manifest,
	...BLACKSITE_ASSETS.ui.v27.preload,
].map(blacksiteRelativeAssetPath).filter((path) => path.startsWith('v27/ui-kit/')))]
	.sort((left, right) => left.localeCompare(right, 'en')));
const V28_ENVIRONMENT_ASSETS = Object.freeze([
	...Object.values(BLACKSITE_ASSETS.environment.v28Candidate.base),
	...Object.values(BLACKSITE_ASSETS.environment.v28Candidate.blackout),
].map(blacksiteRelativeAssetPath));
const V33_INTRO_ASSETS = Object.freeze([
	BLACKSITE_INTRO_MANIFEST_URL,
	'assets/blacksite/v33/intro/blacksite-vault-opening-v33.mp4',
	'assets/blacksite/v33/intro/blacksite-breach-start-screen-v33.webp',
].map(blacksiteRelativeAssetPath));
const EXPECTED_V33_STARTUP_ASSET_PATHS = Object.freeze(
	V33_INTRO_ASSETS.map(productionAssetPath).sort((left, right) => left.localeCompare(right, 'en')),
);
const EXPECTED_RUNTIME_ASSET_TYPE_COUNTS = Object.freeze({
	'.flac': 1,
	'.json': 6,
	'.mp4': 2,
	'.ogg': 102,
	'.opus': 1,
	'.wav': 17,
	'.webp': 279,
});
const EXPECTED_RUNTIME_JSON_ASSETS = Object.freeze([
	'v20/penguin-operator/manifest.json',
	'v21/ui-kit/manifest.json',
	'v22/ui-kit/manifest.json',
	'v27/ui-kit/manifest.json',
	'v29/audio/audio-manifest.json',
	'v33/intro/blacksite-startup-manifest-v33.json',
].map(productionAssetPath));
const EXPECTED_RUNTIME_ASSET_BYTES = 63_282_387;
const EXPECTED_RUNTIME_ASSET_TREE_SHA256 = '6d3b851b319c6f0197d7905370ba8189fe9a932ced23350bb1d872add96d099d';
const EXPECTED_COMPLETE_BUILD_FILE_COUNT = 414;
const EXPECTED_COMPLETE_BUILD_BYTES = 65_546_227;
const EXPECTED_COMPLETE_BUILD_DELIVERY_TREE_SHA256 = '7ae6db730ed606eea59ece217df9ed3e9ce7fc5cc5d121100489e523ddab5be0';
const EXPECTED_V29_AUDIO_MANIFEST_FACTS = Object.freeze({
	schema: 'blacksite-audio-runtime-manifest-v29',
	status: 'TECHNICAL_IMPORT_PASS_AUDIBLE_QA_PENDING',
	runtimeRoot: 'assets/blacksite/v29/audio',
	cueCount: 76,
	fileCount: 121,
	sourceArchive: Object.freeze({
		fileName: 'Blackside_Breach_Audio_Complete_RuntimePack_v1.0.zip',
		bytes: 37_929_735,
		sha256: '00bd81eb277623763b5b3626617c3eca0e035b46f0547a8d772b4c63582aad1a',
		manifestSha256: '5ef7ee6fb51b47754a5ac4ddae39dddece1fbe48712383a19379b3c3f2d8f7a7',
		licensePolicy: 'CC0-only; see 03_LICENSES_AND_PROVENANCE',
	}),
	budgets: Object.freeze({
		runtimeBytes: 3_236_044,
		criticalRuntimeBytes: 980_633,
		hardMaxRuntimeBytes: 8_388_608,
		pass: true,
	}),
	typeCounts: Object.freeze({
		'.flac': 1,
		'.ogg': 102,
		'.opus': 1,
		'.wav': 17,
	}),
});
const EXPECTED_V29_AUDIO_DECODE_SAMPLES = Object.freeze([
	Object.freeze({
		path: 'assets/blacksite/v29/audio/spin_controls/bsb_sfx_spin_press_standard_v01.wav',
		cueId: 'spin.press',
		sourceEvent: 'spin.press.standard',
		contentType: 'audio/wav',
		containerSignature: 'RIFF/WAVE',
		sourceFile: '01_RUNTIME_READY/audio/spin_controls/bsb_sfx_spin_press_standard_v01.wav',
		bytes: 34_138,
		sha256: '9a15c881345c1ce1c39cc31f52f081c8c4dc81fa41111e0079400f39d3ba0e45',
		codec: 'pcm_s24le',
		sampleRateHz: 44_100,
		channels: 2,
		durationMs: 126,
	}),
	Object.freeze({
		path: 'assets/blacksite/v29/audio/ui/bsb_sfx_ui_press_primary_v01.ogg',
		cueId: 'ui.press',
		sourceEvent: 'ui.press.primary',
		contentType: 'audio/ogg',
		containerSignature: 'OggS/Vorbis',
		sourceFile: '01_RUNTIME_READY/audio/ui/bsb_sfx_ui_press_primary_v01.ogg',
		bytes: 4_983,
		sha256: '59175ac17cd49a68dd736285738441287636112a84a6f7ce0d89921bda5a5360',
		codec: 'vorbis',
		sampleRateHz: 44_100,
		channels: 2,
		durationMs: 94,
	}),
	Object.freeze({
		path: 'assets/blacksite/v29/audio/music_and_ambience_compact/bsb_music_freespins_v02.opus',
		cueId: 'music.blackout',
		sourceEvent: 'music.freespins',
		contentType: 'audio/ogg',
		containerSignature: 'OggS/Opus',
		sourceFile: '01_RUNTIME_READY/audio/music_and_ambience_compact/bsb_music_freespins_v02.opus',
		bytes: 1_002_091,
		sha256: '6ba2f79922c908dca262d141237758845b6f8834ee30222c2cb062ab960be896',
		codec: 'opus',
		sampleRateHz: 48_000,
		channels: 2,
		durationMs: 80_392,
	}),
	Object.freeze({
		path: 'assets/blacksite/v29/audio/cinematic/bsb_cin_cinematic_vault_wheel_ratchet_v02.flac',
		cueId: 'vault.wheel',
		sourceEvent: 'cinematic.vault.wheel.ratchet',
		contentType: 'audio/flac',
		containerSignature: 'fLaC',
		sourceFile: '01_RUNTIME_READY/audio/cinematic/bsb_cin_cinematic_vault_wheel_ratchet_v02.flac',
		bytes: 170_671,
		sha256: 'efbe681aa625950174b6642c387c5716ced6d34de38d3212beaad3e5f51c29e7',
		codec: 'flac',
		sampleRateHz: 96_000,
		channels: 2,
		durationMs: 542,
	}),
]);
const FORBIDDEN_PRODUCTION_ASSET_PATTERN = /^assets\/blacksite\/(?:audio\/v19|environment|runtime-rgba-dev(?:-fx)?-v1|runtime-rgba-v1\/(?:runtime_sequences|static_keyposes)|symbols\/sym_01_operative|ui\/reel-(?:depth|strips)-v1|v19\/cinematic\/dev-rig-v1|v24|v28\/audio)(?:\/|$)|2160p/iu;
const LEGACY_ASSET_PATTERN = /(?:industrial-symbol-sheet-v1|ghost-wild-v2|breach-core-v2|operative-(?:idle|male)-v1|operative-front-(?:idle|anticipation|win-small|win-big|loss|feature)-v2)\.(?:png|svg)$/iu;
const EXPECTED_RUNTIME_ASSET_PATHS = Object.freeze([...new Set([
	...Object.values(ENVIRONMENT_ASSETS),
	...V19_PRESENTATION_ASSETS,
	...Object.values(PREMIUM_HUD_ASSETS).flatMap((states) => Object.values(states).map(({ path }) => path)),
	...PREMIUM_PANEL_ASSETS.map(({ path }) => path),
	...Object.values(DIALOG_ASSETS).map(({ path }) => path),
	...PAYLINE_ASSETS,
	...REEL_STRIP_ASSETS,
	...PRODUCTION_CINEMATIC_ASSETS,
	...PRODUCTION_AUDIO_ASSETS,
	...PENGUIN_CHARACTER_ASSETS,
	...V21_UI_ASSETS,
	...V22_UI_ASSETS,
	...V27_UI_ASSETS,
	...V28_ENVIRONMENT_ASSETS,
	...V33_INTRO_ASSETS,
	...PRODUCTION_RUNTIME_FX_ASSETS,
	...Object.values(SYMBOL_STATE_ASSETS).flatMap((states) => Object.values(states)),
].map(productionAssetPath))].sort((left, right) => left.localeCompare(right, 'en')));

const SELECTORS = Object.freeze({
	appShell: 'main.app-shell',
	bootSequence: '[data-testid="boot-sequence"]',
	bootLoadingScreen: '[data-testid="boot-loading-screen"]',
	bootProgress: '[data-testid="boot-progress"]',
	bootIntro: '[data-testid="boot-intro"]',
	bootIntroSkip: '[data-testid="boot-intro-skip"]',
	bootRulesScreen: '[data-testid="boot-rules-screen"]',
	bootRulesImage: '[data-testid="boot-rules-image"]',
	bootStartCard: '[data-testid="boot-start-card"]',
	missionBriefing: '[data-testid="mission-briefing"]',
	missionBriefingScroll: '[data-testid="mission-briefing-scroll"]',
	missionStart: '[data-testid="mission-start"]',
	bootEntryTransition: '[data-testid="boot-entry-transition"]',
	launchStatus: '[data-testid="launch-status"]',
	launchError: '[data-testid="launch-error"]',
	scene: '[data-testid="scene"]',
	slotMonitor: '[data-testid="slot-monitor"]',
	bottomHud: '[data-testid="bottom-hud"]',
	hudMenu: '[data-testid="hud-menu"]',
	hudShop: '[data-testid="hud-shop"]',
	hudAuto: '[data-testid="hud-auto"]',
	hudBetMinus: '[data-testid="hud-bet-minus"]',
	hudBetPlus: '[data-testid="hud-bet-plus"]',
	hudTurbo: '[data-testid="hud-turbo"]',
	hudInfo: '[data-testid="hud-info"]',
	hudSettings: '[data-testid="hud-settings"]',
	operative: '[data-testid="operative"]',
	penguinOperator: '[data-testid="penguin-operator"]',
	operativeImage: '[data-testid="penguin-operator-active"]',
	operativePoseImages: '[data-testid="penguin-operator"] img.penguin-buffer',
	standaloneFx: '[data-testid="standalone-fx"]',
	standaloneFxFrame: '[data-testid="standalone-fx-frame"]',
	standaloneFxBuffers: '[data-testid="standalone-fx"] img[data-buffer-testid="standalone-fx-buffer"]',
	environmentImage: '.bunker-backdrop',
	premiumMachineShell: '.premium-machine-shell',
	boardFrame: '.board-frame',
	board: '[data-testid="board"]',
	gameplayHint: '[data-testid="gameplay-hint"]',
	quickStartHud: '[data-testid="quick-start-hud"]',
	primaryAction: '[data-testid="primary-action"]',
	modeBase: '[data-testid="mode-base"]',
	modeDeepAccess: '[data-testid="mode-deep_access"]',
	modeBlackout: '[data-testid="mode-blackout"]',
	modeReadout: '.reel-footer',
	baseAmount: '[data-testid="base-amount"]',
	leftLineMarkers: '[data-testid="line-markers-left"] [data-line-id]',
	rightLineMarkers: '[data-testid="line-markers-right"] [data-line-id]',
	walletBalance: '[data-testid="wallet-balance"]',
	totalPlay: '[data-testid="total-play"]',
	finalWin: '[data-testid="final-win"]',
	menuDialog: '[data-testid="operations-hub-dialog"]',
	operationsHubContinue: '[data-testid="operations-hub-continue"]',
	operationsHubSelectMode: '[data-testid="operations-hub-select-mode"]',
	operationsHubGameGuide: '[data-testid="operations-hub-game-guide"]',
	modeDialog: '[data-testid="mode-dialog"]',
	rulesDialog: '[data-testid="game-guide-dialog"]',
	rulesClose: '[data-testid="game-guide-dialog"] button[aria-label*="Close"]',
	rulesQuickStart: '[data-testid="game-guide-panel"]',
	gameGuideScroll: '[data-testid="game-guide-scroll"]',
	gameGuideOverview: '[data-testid="game-guide-tab-overview"]',
	gameGuideSymbols: '[data-testid="game-guide-tab-symbols"]',
	gameGuideModes: '[data-testid="game-guide-tab-modes"]',
	gameGuideVault: '[data-testid="game-guide-tab-vault"]',
	gameGuideControls: '[data-testid="game-guide-tab-controls"]',
	gameGuideReplayIntro: '[data-testid="game-guide-replay-intro"]',
	gameGuideOpenBriefing: '[data-testid="game-guide-open-briefing"]',
	statusPlate: '[data-testid="status-plate"]',
	resultTicker: '[data-testid="line-win-cue"]',
	legacyHowToPrimary: '[data-testid="info-action"], [data-testid="how-to-play-primary"]',
	reelCaption: '[data-testid="reel-symbol-caption"], .symbol-code',
	confirmationDialog: '[data-testid="confirmation-dialog"]',
	confirmationMode: '[data-testid="confirmation-mode"]',
	confirmationBase: '[data-testid="confirmation-base"]',
	confirmationMultiplier: '[data-testid="confirmation-multiplier"]',
	confirmationTotal: '[data-testid="confirmation-total"]',
	confirmationEffect: '[data-testid="confirmation-effect"]',
	confirmationStart: '[data-testid="confirmation-start"]',
	globalMute: '[data-testid="global-mute-toggle"]',
	rageOut: '[data-testid="rage-out-toggle"]',
	vaultCinematic: '[data-testid="vault-cinematic"]',
	vaultSkip: '[data-testid="vault-cinematic-skip"]',
	vaultAccess: '[data-testid="vault-access-scene"]',
	vaultFreeSpinsAward: '[data-testid="vault-free-spins-award"]',
	vaultFreeSpinsCount: '[data-testid="vault-free-spins-count"]',
	vaultFreeSpinsTarget: '[data-testid="vault-free-spins-target"]',
	featureProgress: '[data-testid="feature-progress"]',
	featureSpinsRemaining: '[data-testid="feature-spins-remaining"]',
	featureTarget: '[data-testid="feature-target"]',
	featureRunningWin: '[data-testid="feature-running-win"]',
	extractionReport: '[data-testid="extraction-report"]',
	returnToBase: '[data-testid="return-to-base"]',
	settingsDialog: '[data-testid="settings-dialog"]',
	autoDialog: '[data-testid="auto-dialog"]',
	sessionNetPosition: '[data-testid="session-net-position"]',
	sessionTimer: '[data-testid="session-timer"]',
});

const MIME_TYPES = Object.freeze({
	'.css': 'text/css; charset=utf-8',
	'.flac': 'audio/flac',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.wav': 'audio/wav',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
});

const viewports = Object.freeze([
	{
		name: 'reference-1672x941',
		width: 1672,
		height: 941,
		minBoard: 720,
		minBoardViewportRatio: 0.47,
		maxBoardViewportRatio: 0.51,
		expectPremiumShell: true,
		expectOperative: true,
	},
	{
		name: 'desktop-1920x1080',
		width: 1920,
		height: 1080,
		minBoard: 320,
		expectPremiumShell: true,
		expectOperative: true,
	},
	{
		name: 'desktop-1280x720',
		width: 1280,
		height: 720,
		minBoard: 240,
		expectPremiumShell: true,
		expectOperative: true,
	},
	{
		name: 'square-900x900',
		width: 900,
		height: 900,
		minBoard: 340,
		expectOperative: false,
	},
	{
		name: 'breakpoint-821x844',
		width: 821,
		height: 844,
		minBoard: 320,
		expectOperative: false,
	},
	{
		name: 'phone-old-320x568',
		width: 320,
		height: 568,
		minBoard: 200,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'phone-360x740',
		width: 360,
		height: 740,
		minBoard: 240,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'phone-390x844',
		width: 390,
		height: 844,
		minBoard: 280,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'tablet-768x1024',
		width: 768,
		height: 1024,
		minBoard: 340,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'landscape-844x390',
		width: 844,
		height: 390,
		minBoard: 180,
		isMobile: true,
		hasTouch: true,
	},
]);

const replayViewports = Object.freeze([
	{
		name: 'replay-popout-s-360x640',
		width: 360,
		height: 640,
		minBoard: 220,
		isMobile: true,
		hasTouch: true,
		assumption:
			'Conservative 360x640 small-popout proxy; no first-party exact Popout-S pixel contract is asserted.',
	},
	{
		name: 'replay-popout-l-640x480',
		width: 640,
		height: 480,
		minBoard: 250,
		isMobile: true,
		hasTouch: true,
		expectOperative: false,
		assumption:
			'Conservative 640x480 large-popout proxy; no first-party exact Popout-L pixel contract is asserted.',
	},
]);

const sourceIdentityTargets = Object.freeze([
	join(repoRoot, '.gitattributes'),
	join(repoRoot, 'apps', 'blacksite', 'package.json'),
	join(repoRoot, 'apps', 'blacksite', 'svelte.config.js'),
	join(repoRoot, 'apps', 'blacksite', 'tsconfig.json'),
	join(repoRoot, 'apps', 'blacksite', 'vite.config.js'),
	join(repoRoot, 'apps', 'blacksite', 'scripts'),
	join(repoRoot, 'apps', 'blacksite', 'static'),
	join(repoRoot, 'apps', 'blacksite', 'src'),
	join(repoRoot, 'apps', 'blacksite', 'tests'),
	join(repoRoot, 'packages', 'utils-shared', 'currency.js'),
	join(repoRoot, 'packages', 'utils-shared', 'stake-social.js'),
	join(repoRoot, 'packages', 'config-svelte', 'index.js'),
	join(repoRoot, 'packages', 'config-svelte', 'package.json'),
	join(repoRoot, 'package.json'),
	join(repoRoot, 'pnpm-lock.yaml'),
	join(repoRoot, 'scripts', 'blacksite-qa-e2e.mjs'),
	join(repoRoot, 'scripts', 'blacksite-package-candidate.mjs'),
	join(repoRoot, 'scripts', 'blacksite-package-verify.mjs'),
]);
const runtimeDeliverySourceTargets = Object.freeze([
	join(repoRoot, 'apps', 'blacksite', 'src'),
	join(
		repoRoot,
		'apps',
		'blacksite',
		'static',
		'assets',
		'blacksite',
		'runtime-rgba-v1',
		'animation_manifest.json',
	),
]);

const gitSha = spawnSync('git', ['rev-parse', 'HEAD'], {
	cwd: repoRoot,
	encoding: 'utf8',
}).stdout.trim();
const gitStatus = spawnSync('git', ['status', '--porcelain'], {
	cwd: repoRoot,
	encoding: 'utf8',
}).stdout.trim();

const evidence = {
	identity: {
		startedAt,
		completedAt: null,
		testedGitSha: gitSha,
		worktreeDirty: gitStatus !== '',
		dirtyDevelopmentRunExplicitlyAllowed: allowDirtyDevelopmentRun,
		testedBuildRoot: buildRoot,
		expectedBuildTreeSha256: expectedBuildTreeSha256 || null,
		buildTreeSha256: null,
		sourceTreeSha256: null,
	},
	target: relative(repoRoot, buildEntry).replaceAll('\\', '/'),
	nestedBuildPrefix: NESTED_BUILD_PREFIX,
	stakeFileBaseContract: {
		origin: STAKE_FILE_BASE_ORIGIN,
		path: STAKE_V5_PREFIX,
		baseHref: STAKE_FILE_BASE_HREF,
	},
	playwright: {
		version: null,
		browser: null,
		executable: null,
	},
	selectors: SELECTORS,
	viewports: [...viewports, ...replayViewports],
	viewportAssumptions: replayViewports.map(({ name, assumption }) => ({ name, assumption })),
	manifests: {
		build: null,
		sources: null,
	},
	productionBuildScan: null,
	mathIdentity: null,
	scenarios: [],
	geometry: [],
	checks: [],
	summary: null,
};

class QaAssertionError extends Error {
	constructor(message) {
		super(message);
		this.name = 'QaAssertionError';
	}
}

function serialize(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function collectFiles(target, files = []) {
	const targetStats = statSync(target);
	if (targetStats.isFile()) {
		files.push(target);
		return files;
	}
	if (!targetStats.isDirectory()) return files;
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name, 'en'))) {
		const child = join(target, entry.name);
		if (entry.isDirectory()) collectFiles(child, files);
		else if (entry.isFile()) files.push(child);
	}
	return files;
}

function createFileManifest(targets, baseDirectory) {
	const absoluteFiles = [...new Set(targets.flatMap((target) => collectFiles(target)))].sort(
		(left, right) =>
			relative(baseDirectory, left).replaceAll('\\', '/').localeCompare(
				relative(baseDirectory, right).replaceAll('\\', '/'),
				'en',
			),
	);
	const treeHash = createHash('sha256');
	const files = absoluteFiles.map((absolutePath) => {
		const path = relative(baseDirectory, absolutePath).replaceAll('\\', '/');
		const bytes = readFileSync(absolutePath);
		const pathBytes = Buffer.byteLength(path, 'utf8');
		treeHash.update(Buffer.from(`${pathBytes}\0${path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		return {
			path,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		};
	});
	return {
		algorithm:
			'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)',
		treeSha256: treeHash.digest('hex'),
		fileCount: files.length,
		totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
		files,
	};
}

function verifyV19MathByteIdentity() {
	const baselineExists = existsSync(v18MathRoot);
	const candidateExists = existsSync(v19MathRoot);
	const result = {
		required: requireV19Output,
		v18Root: v18MathRoot,
		v19Root: v19MathRoot,
		v18Exists: baselineExists,
		v19Exists: candidateExists,
		v18: null,
		v19: null,
		byteIdentical: false,
	};
	if (baselineExists) result.v18 = createFileManifest([v18MathRoot], v18MathRoot);
	if (candidateExists) result.v19 = createFileManifest([v19MathRoot], v19MathRoot);
	result.byteIdentical = Boolean(
		result.v18 &&
		result.v19 &&
		serialize(result.v18.files) === serialize(result.v19.files) &&
		result.v18.fileCount === result.v19.fileCount &&
		result.v18.totalBytes === result.v19.totalBytes &&
		result.v18.treeSha256 === result.v19.treeSha256,
	);
	return result;
}

function scanRuntimePngSourceReferences() {
	const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svelte', '.ts']);
	const hits = [];
	for (const absolutePath of runtimeDeliverySourceTargets.flatMap((target) => collectFiles(target))) {
		if (!textExtensions.has(extname(absolutePath).toLowerCase())) continue;
		const text = readFileSync(absolutePath, 'utf8');
		const references = text.match(/[^"'`\s)]+\.png\b/giu) ?? [];
		for (const signature of references) {
			hits.push({
				path: relative(repoRoot, absolutePath).replaceAll('\\', '/'),
				signature,
			});
		}
	}
	return hits;
}

function scanProductionBuild(buildManifest) {
	const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
	const textFiles = buildManifest.files.filter((file) => textExtensions.has(extname(file.path).toLowerCase()));
	const loaderPatterns = [
		/stake[-_ ]engine[-_ ]loader/iu,
		/stakeEngineLoader/iu,
		/stake-engine-loader\.gif/iu,
	];
	const loaderHits = [];
	const generatedFixtureHits = [];
	const legacyContractHits = [];
	const svgReferenceHits = [];
	const runtimePngReferenceHits = [];
	let textBytesScanned = 0;
	let concatenatedText = '';
	for (const file of textFiles) {
		const text = readFileSync(join(buildRoot, file.path), 'utf8');
		textBytesScanned += Buffer.byteLength(text, 'utf8');
		concatenatedText += `\n${text}`;
		for (const pattern of loaderPatterns) {
			if (pattern.test(file.path) || pattern.test(text)) {
				loaderHits.push({ path: file.path, pattern: pattern.source });
			}
		}
		if (
			/catalog\.generated/iu.test(file.path) ||
			/catalog\.generated/iu.test(text) ||
			/build-fixture-catalog/iu.test(text)
		) {
			generatedFixtureHits.push({ path: file.path, signature: 'generated-catalog' });
		}
		for (const fixtureId of GENERATED_FIXTURE_IDS) {
			if (text.includes(fixtureId)) {
				generatedFixtureHits.push({ path: file.path, signature: `fixture-id:${fixtureId}` });
			}
		}
		for (const signature of [
			'blacksite-book-events-v2',
			'0.2.0-math-v2',
			'industrial-symbol-sheet-v1.png',
			'ghost-wild-v2.png',
			'breach-core-v2.png',
		]) {
			if (text.includes(signature)) legacyContractHits.push({ path: file.path, signature });
		}
		const svgReferences = text.match(/(?:<svg\b|assets\/blacksite\/(?:symbols|ui)\/[^"'`\s)]+\.svg\b)/giu) ?? [];
		for (const signature of svgReferences) svgReferenceHits.push({ path: file.path, signature });
		const runtimePngReferences = text.match(/assets\/blacksite\/[^"'`\s)]+\.png\b/giu) ?? [];
		for (const signature of runtimePngReferences) {
			runtimePngReferenceHits.push({ path: file.path, signature });
		}
	}
	for (const file of buildManifest.files) {
		if (loaderPatterns.some((pattern) => pattern.test(file.path))) {
			loaderHits.push({ path: file.path, pattern: 'filename' });
		}
		if (/catalog\.generated/iu.test(file.path)) {
			generatedFixtureHits.push({ path: file.path, signature: 'generated-catalog-filename' });
		}
	}

	const html = readFileSync(buildEntry, 'utf8');
	const runtimeAssetRecords = buildManifest.files
		.filter(({ path }) => path.startsWith('assets/blacksite/'))
		.sort((left, right) => left.path.localeCompare(right.path, 'en'));
	const runtimeAssets = runtimeAssetRecords.map(({ path }) => path);
	const runtimeMp4Assets = runtimeAssets.filter((path) => /\.mp4$/iu.test(path));
	const runtimeV26CinematicAssetRecords = runtimeAssetRecords
		.filter(({ path }) => path.startsWith('assets/blacksite/v26/cinematic/'))
		.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
	const runtimeWebpAssets = runtimeAssets.filter((path) => /\.webp$/iu.test(path));
	const runtimeJsonAssets = runtimeAssets.filter((path) => /\.json$/iu.test(path));
	const runtimePngAssets = runtimeAssets.filter((path) => /\.png$/iu.test(path));
	const svgRuntimeAssets = runtimeAssets.filter((path) => /\.svg$/iu.test(path));
	const runtimeAssetTypeCounts = Object.fromEntries(Object.entries(runtimeAssets.reduce((counts, path) => {
		const extension = extname(path).toLowerCase() || '(none)';
		counts[extension] = (counts[extension] ?? 0) + 1;
		return counts;
	}, {})).sort(([left], [right]) => left.localeCompare(right, 'en')));
	const runtimeAssetTreeHash = createHash('sha256');
	for (const { path, sha256 } of runtimeAssetRecords) {
		runtimeAssetTreeHash.update(`${path.slice('assets/blacksite/'.length)}\n${sha256.toLowerCase()}\n`, 'utf8');
	}
	const completeBuildDeliveryTreeHash = createHash('sha256');
	for (const { path, sha256 } of buildManifest.files) {
		completeBuildDeliveryTreeHash.update(`${path}\n${sha256.toLowerCase()}\n`, 'utf8');
	}
	const viewportTag = html.match(/<meta\s+[^>]*name=["']viewport["'][^>]*>/iu)?.[0] ?? null;
	const viewportContent = viewportTag?.match(/content=["']([^"']+)["']/iu)?.[1] ?? null;
	return {
		textFilesScanned: textFiles.length,
		textBytesScanned,
		loaderHits,
		generatedFixtureHits,
		legacyContractHits,
		svgReferenceHits,
		runtimePngReferenceHits,
		sourceRuntimePngReferenceHits: scanRuntimePngSourceReferences(),
		svgRuntimeAssets,
		runtimePngAssets,
		runtimeWebpAssets,
		runtimeJsonAssets,
		runtimeMp4Assets,
		runtimeV26CinematicAssetRecords,
		runtimeAssetTypeCounts,
		runtimeAssetBytes: runtimeAssetRecords.reduce((sum, { bytes }) => sum + bytes, 0),
		runtimeAssetTreeSha256: runtimeAssetTreeHash.digest('hex'),
		completeBuildDeliveryTreeSha256: completeBuildDeliveryTreeHash.digest('hex'),
		runtimeAssets,
		viewportMeta: {
			tag: viewportTag,
			content: viewportContent,
		},
		touchActionManipulationPresent: /touch-action\s*:\s*manipulation/iu.test(concatenatedText),
	};
}

function check(group, name, condition, detail = '') {
	const status = condition ? 'PASS' : 'FAIL';
	evidence.checks.push({ group, name, status, detail });
	if (!condition) throw new QaAssertionError(`${group}: ${name}${detail ? ` (${detail})` : ''}`);
}

function recordFailure(group, error) {
	evidence.checks.push({
		group,
		name: 'scenario completed without an uncaught error',
		status: 'FAIL',
		detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
	});
}

function successStatus() {
	return { statusCode: 'SUCCESS', statusMessage: 'BLACKSITE QA mock success' };
}

function jurisdiction(overrides = {}) {
	return {
		socialCasino: false,
		disabledFullscreen: false,
		disabledTurbo: false,
		disabledSuperTurbo: false,
		disabledAutoplay: true,
		disabledSlamstop: false,
		disabledSpacebar: false,
		disabledBuyFeature: false,
		displayNetPosition: false,
		displayRTP: true,
		displaySessionTimer: false,
		minimumRoundDuration: 0,
		...overrides,
	};
}

function authenticateResponse({
	balance = DEFAULT_BALANCE,
	currency = 'USD',
	round = null,
	betConfig = {},
	jurisdictionOverrides = {},
} = {}) {
	const defaultBetModes = {
		base: { mode: 'base', costMultiplier: 1, feature: false },
		deep_access: { mode: 'deep_access', costMultiplier: 4, feature: true },
		blackout: { mode: 'blackout', costMultiplier: 80, feature: true },
	};
	return {
		status: successStatus(),
		balance: { amount: balance, currency },
		config: {
			gameID: 'blacksite_breach',
			minBet: 100_000,
			maxBet: 10_000_000,
			stepBet: 100_000,
			defaultBetLevel: DEFAULT_BASE_AMOUNT,
			betLevels: [100_000, 500_000, 1_000_000, 2_000_000, 5_000_000],
			betModes: defaultBetModes,
			...betConfig,
			jurisdiction: jurisdiction(jurisdictionOverrides),
		},
		round,
	};
}

function authoritativeZeroRound({
	active = false,
	id = 'blacksite-qa-zero',
	amount = DEFAULT_BASE_AMOUNT,
	currency = 'USD',
	mode = 'base',
	event = null,
} = {}) {
	const fixture = mode === 'base' ? BASE_ZERO_FIXTURE : getGeneratedFixture(`${mode}_zero`);
	if (!fixture) throw new Error(`Missing authoritative zero fixture for ${mode}`);
	return {
		active,
		amount,
		betID: id,
		currency,
		event,
		mode,
		payout: 0,
		payoutMultiplier: fixture.book.payoutMultiplier,
		state: structuredClone(fixture.book.events),
	};
}

function authoritativeFixtureRound({
	fixture,
	active = true,
	id = 'blacksite-qa-fixture-round',
	amount = DEFAULT_BASE_AMOUNT,
	currency = 'USD',
	event = null,
} = {}) {
	if (!fixture?.mathBacked || !fixture.book || !MODE_COSTS[fixture.mode]) {
		throw new Error(`Missing math-backed fixture round: ${fixture?.id}`);
	}
	const payoutNumerator = amount * fixture.book.payoutMultiplier;
	if (!Number.isSafeInteger(payoutNumerator) || payoutNumerator % 100 !== 0) {
		throw new Error(`Fixture payout is not exactly representable in API units: ${fixture.id}`);
	}
	return {
		active,
		amount,
		betID: id,
		currency,
		event,
		mode: fixture.mode,
		payout: payoutNumerator / 100,
		payoutMultiplier: fixture.book.payoutMultiplier / 100,
		state: structuredClone(fixture.book.events),
	};
}

function playResponse({
	active = false,
	amount = DEFAULT_BASE_AMOUNT,
	mode = 'base',
	currency = 'USD',
	balanceBefore = DEFAULT_BALANCE,
	id = active ? 'blacksite-qa-active-play' : 'blacksite-qa-inactive-play',
} = {}) {
	const balanceAfter = balanceBefore - amount * MODE_COSTS[mode];
	return {
		status: successStatus(),
		balance: { amount: balanceAfter, currency },
		round: authoritativeZeroRound({
			active,
			amount,
			currency,
			mode,
			id,
		}),
	};
}

function playResponseFromFixture({
	fixture,
	active = true,
	amount = DEFAULT_BASE_AMOUNT,
	currency = 'USD',
	balanceBefore = DEFAULT_BALANCE,
	id = 'blacksite-qa-feature-play',
} = {}) {
	if (!fixture?.mathBacked || !MODE_COSTS[fixture.mode]) {
		throw new Error(`Missing math-backed play fixture: ${fixture?.id}`);
	}
	return {
		status: successStatus(),
		balance: {
			amount: balanceBefore - amount * MODE_COSTS[fixture.mode],
			currency,
		},
		round: authoritativeFixtureRound({ fixture, active, amount, currency, id }),
	};
}

function endRoundResponse({
	balance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT,
	currency = 'USD',
} = {}) {
	return {
		status: successStatus(),
		balance: { amount: balance, currency },
	};
}

function replayResponse() {
	return replayResponseFromFixture(BASE_ZERO_FIXTURE);
}

function replayResponseFromFixture(fixture) {
	if (!fixture?.mathBacked || !fixture.book || !MODE_COSTS[fixture.mode]) {
		throw new Error(`Replay QA fixture is not a math-backed canonical mode: ${fixture?.id}`);
	}
	const packagePayoutCentiX = fixture.book.payoutMultiplier;
	const terminalPayoutCentiX = fixture.book.events.at(-1)?.payout_multiplier_raw;
	if (
		!Number.isSafeInteger(packagePayoutCentiX) ||
		packagePayoutCentiX < 0 ||
		terminalPayoutCentiX !== packagePayoutCentiX
	) {
		throw new Error(`Replay QA fixture payout identity is invalid: ${fixture.id}`);
	}
	return {
		// Replay speaks multiplier-x while math books and round_end speak centi-x.
		payoutMultiplier: packagePayoutCentiX / 100,
		costMultiplier: MODE_COSTS[fixture.mode],
		state: { events: structuredClone(fixture.book.events) },
	};
}

function exactReplayProductUnits(amountUnitsRaw, multiplier, multiplierScale = 0) {
	const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amountUnitsRaw);
	if (!match || !Number.isSafeInteger(multiplier) || multiplier < 0) {
		throw new Error(`Invalid exact Replay product inputs: ${serialize({ amountUnitsRaw, multiplier, multiplierScale })}`);
	}
	const fraction = match[2] ?? '';
	const scale = fraction.length + multiplierScale;
	const amountDigits = BigInt(`${match[1]}${fraction}`);
	let text = (amountDigits * BigInt(multiplier)).toString().padStart(scale + 1, '0');
	if (scale > 0) {
		text = `${text.slice(0, -scale)}.${text.slice(-scale)}`;
		while (text.includes('.') && text.endsWith('0')) text = text.slice(0, -1);
		if (text.endsWith('.')) text = text.slice(0, -1);
	}
	return text;
}

function decorateExpectedReplayUnits(units, currency) {
	if (currency === 'USD') return `$${units} units`;
	if (currency === 'EUR') return `€${units} units`;
	if (currency === 'XSC') return `${units} SC units`;
	if (currency === 'XGC') return `${units} GC units`;
	return `${units} ${currency} units`;
}

function expectedReplayTotalPlay(amountUnitsRaw, costMultiplier, currency) {
	return decorateExpectedReplayUnits(
		exactReplayProductUnits(amountUnitsRaw, costMultiplier),
		currency,
	);
}

function expectedReplayFinalWin(amountUnitsRaw, payoutCentiX, currency) {
	return decorateExpectedReplayUnits(
		exactReplayProductUnits(amountUnitsRaw, payoutCentiX, 2),
		currency,
	);
}

function invalidReplayResponse() {
	return {
		payoutMultiplier: 0,
		costMultiplier: 1,
		state: {
			events: [{ index: 0, type: 'not_a_blacksite_event' }],
		},
	};
}

function liveQuery(overrides = {}) {
	const params = new URLSearchParams({
		sessionID: SESSION_ID,
		rgs_url: BLACKSITE_QA_RGS_ORIGIN,
		currency: 'USD',
		lang: 'en',
		device: 'desktop',
		...overrides,
	});
	return `?${params.toString()}`;
}

function replayQuery(overrides = {}) {
	const params = new URLSearchParams({
		replay: 'true',
		game: 'blacksite_breach',
		version: REPLAY_VERSION,
		mode: 'base',
		event: '1',
		rgs_url: BLACKSITE_QA_RGS_ORIGIN,
		currency: 'USD',
		amount: String(DEFAULT_BASE_AMOUNT),
		lang: 'en',
		device: 'desktop',
		...overrides,
	});
	return `?${params.toString()}`;
}

function stakeFileBaseQuery(overrides = {}) {
	const params = new URLSearchParams({
		sessionID: SESSION_ID,
		rgs_url: 'rgsd.stake-engine.com',
		currency: 'USD',
		lang: 'en',
		device: 'desktop',
		...overrides,
	});
	return `?${params.toString()}`;
}

function startStaticServer() {
	const rootPrefix = `${resolve(buildRoot)}${sep}`;
	const server = createServer((request, response) => {
		try {
			if (!['GET', 'HEAD'].includes(request.method ?? '')) {
				response.writeHead(405, { 'cache-control': 'no-store' });
				response.end('method not allowed');
				return;
			}

			const url = new URL(request.url ?? '/', 'http://127.0.0.1');
			const pathname = decodeURIComponent(url.pathname);
			const nestedRoot = NESTED_BUILD_PREFIX.slice(0, -1);
			let requested;
			if (pathname === nestedRoot || pathname === NESTED_BUILD_PREFIX) {
				requested = 'index.html';
			} else if (pathname.startsWith(NESTED_BUILD_PREFIX)) {
				requested = pathname.slice(NESTED_BUILD_PREFIX.length) || 'index.html';
			} else {
				requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
			}
			const file = resolve(buildRoot, requested);
			if (!file.startsWith(rootPrefix) || !existsSync(file) || !statSync(file).isFile()) {
				response.writeHead(404, { 'cache-control': 'no-store' });
				response.end('not found');
				return;
			}

			const body = readFileSync(file);
			response.writeHead(200, {
				'cache-control': 'no-store',
				'content-type': MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
			});
			if (request.method === 'HEAD') response.end();
			else response.end(body);
		} catch (error) {
			response.writeHead(500, { 'cache-control': 'no-store' });
			response.end(error instanceof Error ? error.message : 'server error');
		}
	});

	return new Promise((resolvePromise, rejectPromise) => {
		server.once('error', rejectPromise);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				rejectPromise(new Error('BLACKSITE QA static server did not expose a TCP port'));
				return;
			}
			resolvePromise({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

function stakeFileBaseHtml() {
	const html = readFileSync(buildEntry, 'utf8');
	const head = /<head(?:\s[^>]*)?>/iu.exec(html);
	if (!head || head.index === undefined) {
		throw new Error('BLACKSITE QA could not inject the Stake file-base fixture into build/index.html');
	}
	const insertion = head.index + head[0].length;
	return `${html.slice(0, insertion)}\n\t\t<base href="${STAKE_FILE_BASE_HREF}" />${html.slice(insertion)}`;
}

async function installStakeFileBaseBuild(context) {
	const rootPrefix = `${resolve(buildRoot)}${sep}`;
	const documentHtml = stakeFileBaseHtml();
	await context.route(`${STAKE_FILE_BASE_ORIGIN}/**`, async (route) => {
		const request = route.request();
		if (!['GET', 'HEAD'].includes(request.method())) {
			await route.fulfill({
				status: 405,
				headers: { 'cache-control': 'no-store' },
				body: 'method not allowed',
			});
			return;
		}

		const url = new URL(request.url());
		const pathname = decodeURIComponent(url.pathname);
		if (pathname === STAKE_V5_PREFIX || pathname === `${STAKE_V5_PREFIX}index.html`) {
			await route.fulfill({
				status: 200,
				contentType: MIME_TYPES['.html'],
				headers: { 'cache-control': 'no-store' },
				...(request.method() === 'HEAD' ? {} : { body: documentHtml }),
			});
			return;
		}

		if (!pathname.startsWith(STAKE_V5_PREFIX)) {
			await route.fulfill({ status: 404, body: 'outside Stake package mount' });
			return;
		}
		const requested = pathname.slice(STAKE_V5_PREFIX.length);
		const file = resolve(buildRoot, requested);
		if (!file.startsWith(rootPrefix) || !existsSync(file) || !statSync(file).isFile()) {
			await route.fulfill({ status: 404, body: 'not found' });
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
			headers: { 'cache-control': 'no-store' },
			...(request.method() === 'HEAD' ? {} : { body: readFileSync(file) }),
		});
	});
}

function resolvePlaywright() {
	const attempts = [];
	const candidates = [process.env.STAKE_QA_PLAYWRIGHT_DIR, repoRoot, scriptDirectory].filter(Boolean);
	for (const base of candidates) {
		try {
			const requireFrom = createRequire(join(base, 'blacksite-qa-loader.cjs'));
			const playwright = requireFrom('playwright');
			const packageJson = requireFrom('playwright/package.json');
			return { playwright, version: packageJson.version };
		} catch (error) {
			attempts.push(`${base}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	throw new Error(`Playwright could not be loaded. ${attempts.join(' | ')}`);
}

async function launchBrowser(playwright) {
	const candidates = [
		process.env.STAKE_QA_CHROMIUM,
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
		undefined,
	];
	const attempted = [];
	for (const executablePath of [...new Set(candidates)]) {
		if (executablePath && !existsSync(executablePath)) continue;
		try {
			const browser = await playwright.chromium.launch({
				headless: true,
				...(executablePath ? { executablePath } : {}),
			});
			return { browser, executablePath: executablePath ?? 'playwright-default' };
		} catch (error) {
			attempted.push(
				`${executablePath ?? 'playwright-default'}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	throw new Error(`Chromium could not be launched. ${attempted.join(' | ')}`);
}

async function pageDiagnostics(page, { origin, mountPrefix = '/' }) {
	const diagnostics = {
		consoleErrors: [],
		pageErrors: [],
		failedRequests: [],
		teardownAbortedRequests: [],
		sameOriginResponses: [],
		sameOriginHttpErrors: [],
		assetEscapes: [],
		localFileRequests: [],
		runtimePngRequests: [],
		runtimeWebpResponses: [],
		invalidRuntimeWebpResponses: [],
	};
	const pendingFailureClassifications = new Set();
	const requestNavigationGenerations = new WeakMap();
	const successfulSameOriginResponsesByUrl = new Map();
	const normalizedDiagnosticUrl = (value) => {
		try {
			const url = new URL(value);
			url.hash = '';
			return url.href;
		} catch {
			return null;
		}
	};
	let mainNavigationCount = 0;
	let lastMainNavigationStartedAt = 0;
	Object.defineProperty(diagnostics, 'flush', {
		enumerable: false,
		value: async () => {
			while (pendingFailureClassifications.size > 0) {
				await Promise.allSettled([...pendingFailureClassifications]);
			}
		},
	});
	await page.addInitScript(() => {
		const events = [];
		const recordLifecycleEvent = (event) => {
			events.push(event);
			if (events.length > 8_192) events.splice(0, events.length - 8_192);
		};
		const absolute = (source) => {
			if (typeof source !== 'string' || source.length === 0) return null;
			try {
				const url = new URL(source, document.baseURI);
				url.hash = '';
				return url.href;
			} catch {
				return null;
			}
		};
		const sourcesFor = (element) => {
			const sources = new Set();
			for (const source of [element?.currentSrc, element?.src, element?.getAttribute?.('src')]) {
				const resolved = absolute(source);
				if (resolved) sources.add(resolved);
			}
			return [...sources];
		};
		const recordElement = (element, reason) => {
			for (const url of sourcesFor(element)) {
				recordLifecycleEvent({ at: Date.now(), reason, tag: element?.tagName?.toLowerCase?.() ?? null, url });
			}
		};
		const recordTree = (node, reason) => {
			if (!(node instanceof Element)) return;
			if (node.matches('img,video,audio,source')) recordElement(node, reason);
			for (const element of node.querySelectorAll('img,video,audio,source')) recordElement(element, reason);
		};
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.removedNodes) recordTree(node, 'node-removed');
				} else if (mutation.type === 'attributes') {
					const oldUrl = absolute(mutation.oldValue);
					if (oldUrl) {
						recordLifecycleEvent({ at: Date.now(), reason: `${mutation.attributeName}-changed`, tag: mutation.target?.tagName?.toLowerCase?.() ?? null, url: oldUrl });
					}
				}
			}
		});
		observer.observe(document, {
			attributes: true,
			attributeFilter: ['src'],
			attributeOldValue: true,
			childList: true,
			subtree: true,
		});
		const nativePause = globalThis.HTMLMediaElement?.prototype?.pause;
		if (typeof nativePause === 'function') {
			globalThis.HTMLMediaElement.prototype.pause = function (...args) {
				recordElement(this, 'media-paused');
				return nativePause.apply(this, args);
			};
		}
		const currentTimeDescriptor = Object.getOwnPropertyDescriptor(
			globalThis.HTMLMediaElement?.prototype ?? {},
			'currentTime',
		);
		if (typeof currentTimeDescriptor?.set === 'function') {
			Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'currentTime', {
				...currentTimeDescriptor,
				set(value) {
					if (value === 0) recordElement(this, 'media-current-time-reset');
					return currentTimeDescriptor.set.call(this, value);
				},
			});
		}
		const nativeFetch = globalThis.fetch;
		if (typeof nativeFetch === 'function') {
			globalThis.fetch = function (...args) {
				const [input, init] = args;
				const url = absolute(typeof input === 'string' ? input : input?.url);
				const signal = init?.signal ?? input?.signal ?? null;
				let releaseAbortListener = null;
				if (url && signal && typeof signal.addEventListener === 'function') {
					const recordAbort = () => recordLifecycleEvent({
						at: Date.now(),
						reason: 'fetch-signal-aborted',
						tag: 'fetch',
						url,
					});
					if (signal.aborted) recordAbort();
					else {
						signal.addEventListener('abort', recordAbort, { once: true });
						releaseAbortListener = () => signal.removeEventListener('abort', recordAbort);
					}
				}
				const request = nativeFetch.apply(this, args);
				if (releaseAbortListener) request.then(releaseAbortListener, releaseAbortListener);
				return request;
			};
		}
		addEventListener('pagehide', () => {
			for (const element of document.querySelectorAll('img,video,audio,source')) {
				recordElement(element, 'document-pagehide');
			}
		}, { once: true });
		globalThis.__blacksiteQaMediaLifecycle = { events };
	});
	page.on('console', (message) => {
		if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
	page.on('requestfailed', (request) => {
		const failureAt = Date.now();
		const requestNavigationGeneration = requestNavigationGenerations.get(request) ?? null;
		const item = {
			method: request.method(),
			url: request.url(),
			resourceType: request.resourceType(),
			error: request.failure()?.errorText ?? null,
			failureAt,
			requestNavigationGeneration,
		};
		const classification = (async () => {
			let parsed = null;
			let lifecycleEvidence = null;
			try {
				parsed = new URL(item.url);
			} catch {
				// Invalid request URLs remain strict failures below.
			}
			const eligibleAssetAbort = item.method === 'GET' &&
				item.error === 'net::ERR_ABORTED' &&
				parsed?.origin === origin &&
				/\/assets\/blacksite\//u.test(parsed.pathname);
			const navigationAbortProof = () => {
				const navigationLeadToleranceMs = 500;
				const navigationFollowWindowMs = 5_000;
				if (
					!eligibleAssetAbort ||
					mainNavigationCount <= 1 ||
					!Number.isInteger(requestNavigationGeneration) ||
					requestNavigationGeneration >= mainNavigationCount ||
					!Number.isFinite(lastMainNavigationStartedAt) ||
					failureAt < lastMainNavigationStartedAt - navigationLeadToleranceMs ||
					failureAt - lastMainNavigationStartedAt > navigationFollowWindowMs
				) return null;
				return {
					reason: 'main-frame-navigation',
					expectedOrigin: origin,
					requestNavigationGeneration,
					mainNavigationCount,
					navigationStartedAt: lastMainNavigationStartedAt,
					navigationLeadToleranceMs,
					navigationFollowWindowMs,
					failureAt,
				};
			};
			let proof = navigationAbortProof();
			if (!proof && eligibleAssetAbort && !page.isClosed()) {
				await page.waitForTimeout(250).catch(() => {});
				proof = navigationAbortProof();
				const lifecycle = await page.evaluate(({ url, failureAt: failedAt }) => {
					const sourcesFor = (element) => [...new Set([
						element?.currentSrc,
						element?.src,
						element?.getAttribute?.('src'),
					].filter(Boolean).map((source) => {
						try {
							const sourceUrl = new URL(source, document.baseURI);
							sourceUrl.hash = '';
							return sourceUrl.href;
						} catch {
							return null;
						}
					}).filter(Boolean))];
					const matchingEvents = (globalThis.__blacksiteQaMediaLifecycle?.events ?? [])
						.filter((event) => event.url === url && Math.abs(failedAt - event.at) <= 2_000);
					const owners = [...document.querySelectorAll('img,video,audio,source')]
						.filter((element) => sourcesFor(element).includes(url))
						.map((element) => ({
							tag: element.tagName.toLowerCase(),
							sources: sourcesFor(element),
							readyState: typeof element.readyState === 'number' ? element.readyState : null,
							networkState: typeof element.networkState === 'number' ? element.networkState : null,
							paused: typeof element.paused === 'boolean' ? element.paused : null,
						}));
					return { connectedOwners: owners.length, owners, matchingEvents };
				}, { url: item.url, failureAt }).catch(() => null);
				lifecycleEvidence = lifecycle;
				const hasExplicitMediaRelease = item.resourceType === 'media' &&
					lifecycle?.matchingEvents.some(({ reason }) =>
						reason === 'media-paused' ||
							reason === 'media-current-time-reset' ||
							reason === 'src-changed' ||
							reason === 'node-removed',
					);
				const hasDisconnectedOwnerRelease = lifecycle?.connectedOwners === 0 &&
					lifecycle?.matchingEvents.some(({ reason }) =>
						reason === 'src-changed' || reason === 'node-removed',
					);
				const hasExplicitFetchAbort = item.resourceType === 'fetch' &&
					lifecycle?.matchingEvents.some(({ reason, tag }) =>
						reason === 'fetch-signal-aborted' && tag === 'fetch',
					);
				if (hasExplicitFetchAbort) {
					proof = {
						reason: 'component-fetch-teardown',
						expectedOrigin: origin,
						failureAt,
						eventWindowMs: 2_000,
						events: lifecycle.matchingEvents,
					};
				}
				if (
					!proof &&
					lifecycle?.matchingEvents.length > 0 &&
					(hasDisconnectedOwnerRelease || hasExplicitMediaRelease)
				) {
					proof = {
						reason: 'component-media-teardown',
						expectedOrigin: origin,
						failureAt,
						eventWindowMs: 2_000,
						connectedOwners: lifecycle.connectedOwners,
						explicitMediaRelease: hasExplicitMediaRelease,
						disconnectedOwnerRelease: hasDisconnectedOwnerRelease,
						events: lifecycle.matchingEvents,
					};
				}
				if (
					!proof &&
					item.resourceType === 'media' &&
					lifecycle?.connectedOwners > 0 &&
					lifecycle.owners?.some(({ tag, sources }) =>
						['video', 'audio', 'source'].includes(tag) && sources.includes(item.url),
					)
				) {
					proof = {
						reason: 'connected-media-request-superseded',
						expectedOrigin: origin,
						failureAt,
						connectedOwners: lifecycle.connectedOwners,
						owners: lifecycle.owners,
					};
				}
				const successfulImageSupersessions = [
					...(successfulSameOriginResponsesByUrl.get(normalizedDiagnosticUrl(item.url))?.entries() ?? []),
				]
					.filter(([successfulRequest]) => successfulRequest !== request)
					.map(([, response]) => response);
				if (
					!proof &&
					item.resourceType === 'image' &&
					/\/assets\/blacksite\/v20\/penguin-operator\/(?:transitions\/)?[^/]+\.webp$/iu.test(parsed?.pathname ?? '') &&
					successfulImageSupersessions.length > 0
				) {
					proof = {
						reason: 'successful-image-request-supersession',
						expectedOrigin: origin,
						failureAt,
						successfulResponses: successfulImageSupersessions,
					};
				}
			}
			if (proof) diagnostics.teardownAbortedRequests.push({ ...item, proof });
			else diagnostics.failedRequests.push({
				...item,
				teardownAssessment: {
					eligibleAssetAbort,
					lifecycle: lifecycleEvidence,
					mainNavigationCount,
					lastMainNavigationStartedAt,
				},
			});
		})();
		pendingFailureClassifications.add(classification);
		void classification.finally(() => pendingFailureClassifications.delete(classification));
	});
	page.on('request', (request) => {
		try {
			if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
				mainNavigationCount += 1;
				lastMainNavigationStartedAt = Date.now();
			}
			requestNavigationGenerations.set(request, mainNavigationCount);
			const url = new URL(request.url());
			if (url.protocol === 'file:') {
				diagnostics.localFileRequests.push({
					method: request.method(),
					resourceType: request.resourceType(),
					url: request.url(),
				});
			}
			if (/\/assets\/blacksite\/.*\.png$/iu.test(url.pathname)) {
				diagnostics.runtimePngRequests.push({
					method: request.method(),
					resourceType: request.resourceType(),
					url: request.url(),
				});
			}
		} catch {
			// Playwright request URLs are absolute; keep the diagnostic collector fail-safe.
		}
	});
	page.on('response', (response) => {
		try {
			const url = new URL(response.url());
			if (url.origin !== origin) return;
			const item = {
				contentType: response.headers()['content-type'] ?? null,
				method: response.request().method(),
				resourceType: response.request().resourceType(),
				status: response.status(),
				url: response.url(),
			};
			diagnostics.sameOriginResponses.push(item);
			if (
				item.method === 'GET' &&
				item.resourceType === 'image' &&
				item.status === 200 &&
				/^image\/webp(?:\s*;|$)/iu.test(item.contentType ?? '')
			) {
				const key = normalizedDiagnosticUrl(item.url);
				if (key) {
					const responses = successfulSameOriginResponsesByUrl.get(key) ?? new Map();
					responses.set(response.request(), item);
					successfulSameOriginResponsesByUrl.set(key, responses);
				}
			}
			if (/\/assets\/blacksite\/.*\.webp$/iu.test(url.pathname)) {
				diagnostics.runtimeWebpResponses.push(item);
				if (!/^image\/webp(?:\s*;|$)/iu.test(item.contentType ?? '')) {
					diagnostics.invalidRuntimeWebpResponses.push(item);
				}
			}
			if (item.status >= 400) diagnostics.sameOriginHttpErrors.push(item);
			if (mountPrefix !== '/' && url.pathname.startsWith('/assets/')) {
				diagnostics.assetEscapes.push(item);
			}
		} catch {
			// Playwright only reports absolute response URLs, but preserve diagnostics if that changes.
		}
	});
	return diagnostics;
}

async function waitForEndpoint(network, endpoint, count, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (network.byEndpoint[endpoint].length >= count) return;
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
	}
	throw new Error(`Timed out waiting for ${endpoint} request count ${count}`);
}

async function runtimeState(page) {
	return page.evaluate(
		() => document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? null,
	);
}

async function waitForRuntimeState(page, expectedState, timeoutMs = 10_000) {
	await page.waitForFunction(
		(expected) =>
			(document.documentElement.dataset.runtimeState ??
				document.body.dataset.runtimeState ??
				null) === expected,
		expectedState,
		{ timeout: timeoutMs },
	);
}

async function waitForStableAction(page, timeoutMs = 10_000) {
	await page.locator(SELECTORS.primaryAction).waitFor({ state: 'visible', timeout: timeoutMs });
	await page.waitForFunction(
		(selector) => {
			const action = document.querySelector(selector);
			const state =
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? '';
			return (
				action &&
				!action.disabled &&
				!/(?:booting|authenticating|loading|playing|presenting|settling)/i.test(state)
			);
		},
		SELECTORS.primaryAction,
		{ timeout: timeoutMs },
	);
}

async function waitForReplayComplete(page, timeoutMs = 10_000) {
	await page.waitForFunction(
		(selector) => {
			const action = document.querySelector(selector);
			const state =
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? '';
			return (
				action &&
				!action.disabled &&
				(/replay[-_ ]?completed/i.test(state) || /play\s+again/i.test(action.textContent ?? ''))
			);
		},
		SELECTORS.primaryAction,
		{ timeout: timeoutMs },
	);
}

async function returnFromExtraction(page, timeoutMs = 30_000) {
	const report = page.locator(SELECTORS.extractionReport);
	await report.waitFor({ state: 'visible', timeout: timeoutMs });
	const returnAction = page.locator(SELECTORS.returnToBase);
	await returnAction.waitFor({ state: 'visible', timeout: timeoutMs });
	await returnAction.click();
	await report.waitFor({ state: 'detached', timeout: 2_000 });
}

async function beginOperatorReactionTrace(page) {
	await page.evaluate((selectors) => {
		globalThis.__blacksiteOperatorReactionObserver?.disconnect();
		const operative = document.querySelector(selectors.operative);
		const frame = document.querySelector(selectors.operativeImage);
		const values = [];
		const record = () => {
			const sequence = operative?.getAttribute('data-sequence')
				?? frame?.getAttribute('data-sequence');
			if (sequence && values.at(-1) !== sequence) values.push(sequence);
		};
		record();
		const observer = new MutationObserver(record);
		if (operative) {
			observer.observe(operative, {
				attributes: true,
				subtree: true,
				attributeFilter: ['data-sequence'],
			});
		}
		globalThis.__blacksiteOperatorReactionTrace = values;
		globalThis.__blacksiteOperatorReactionObserver = observer;
	}, SELECTORS);
}

async function operatorReactionTrace(page) {
	return page.evaluate(() => [...(globalThis.__blacksiteOperatorReactionTrace ?? [])]);
}

function penguinClipPathsForSequence(sequence) {
	return Object.fromEntries(Object.entries(PENGUIN_OPERATOR_CLIPS)
		.filter(([, clip]) => clip.semanticState === sequence)
		.map(([clipId, clip]) => [clipId, normalizedAssetPath(clip.source)]));
}

async function waitForDecodedOperatorSequenceTrace(page, sequence, timeoutMs = 8_000) {
	const expectedClips = penguinClipPathsForSequence(sequence);
	await page.waitForFunction(
		({ expectedSequence, clipPaths, width, height }) =>
			(globalThis.__blacksiteOperatorPoseTrace?.transitions ?? []).some((transition) => {
				const expectedPath = clipPaths[transition.clip];
				if (
					transition.sequence !== expectedSequence ||
					typeof expectedPath !== 'string' ||
					transition.stageVisible !== true ||
					transition.activeCount !== 1 ||
					transition.activeDecoded !== true ||
					transition.image?.sequence !== expectedSequence ||
					transition.image?.clip !== transition.clip ||
					transition.image?.complete !== true ||
					transition.image?.naturalWidth !== width ||
					transition.image?.naturalHeight !== height
				) return false;
				try {
					const url = new URL(transition.image.source, document.baseURI);
					return url.protocol !== 'file:' && url.pathname.endsWith(`/${expectedPath}`);
				} catch {
					return false;
				}
			}),
		{
			expectedSequence: sequence,
			clipPaths: expectedClips,
			width: OPERATIVE_FRAME_WIDTH,
			height: OPERATIVE_FRAME_HEIGHT,
		},
		{ timeout: timeoutMs },
	);
}

function poseTraceHasDecodedSequence(poseTrace, sequence) {
	const expectedClips = penguinClipPathsForSequence(sequence);
	return Boolean(poseTrace?.transitions.some((transition) => {
		const expectedSource = expectedClips[transition.clip];
		if (
			transition.sequence !== sequence ||
			typeof expectedSource !== 'string' ||
			transition.stageVisible !== true ||
			transition.imageCount < 1 ||
			transition.imageCount > 2 ||
			transition.activeCount !== 1 ||
			transition.visibleDecodedCount < 1 ||
			transition.visibleDecodedCount > 2 ||
			transition.activeDecoded !== true ||
			transition.image?.sequence !== sequence ||
			transition.image?.clip !== transition.clip ||
			transition.image?.complete !== true ||
			transition.image?.naturalWidth !== OPERATIVE_FRAME_WIDTH ||
			transition.image?.naturalHeight !== OPERATIVE_FRAME_HEIGHT
		) return false;
		try {
			const url = new URL(transition.image.source);
			return url.protocol !== 'file:' && url.pathname.endsWith(`/${expectedSource}`);
		} catch {
			return false;
		}
	}));
}

async function beginOperatorPoseTrace(page) {
	await page.evaluate(({ selectors, states, clipIds, frameAssets, width, height }) => {
		globalThis.__blacksiteOperatorPoseObserver?.disconnect();
		if (globalThis.__blacksiteOperatorPoseFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteOperatorPoseFrame);
		}
		const stage = document.querySelector(selectors.operative);
		const penguin = document.querySelector(selectors.penguinOperator);
		const frameImages = () => [...document.querySelectorAll(selectors.operativePoseImages)];
		const allowedStates = new Set(states);
		const allowedClipIds = new Set(clipIds);
		const allowedFrameAssets = new Set(frameAssets);
		const normalizedSource = (source) => {
			if (!source) return null;
			try {
				const url = new URL(source, document.baseURI);
				url.hash = '';
				return url.href;
			} catch {
				return null;
			}
		};
		const sourceIsAllowed = (source) => {
			try {
				const url = new URL(source, document.baseURI);
				return url.protocol !== 'file:' && [...allowedFrameAssets].some(
					(path) => url.pathname.endsWith(`/${path}`),
				);
			} catch {
				return false;
			}
		};
		const stageVisible = () => {
			if (!stage) return false;
			const style = getComputedStyle(stage);
			const bounds = stage.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity) > 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const visibleDecoded = (image) => {
			const style = getComputedStyle(image);
			const bounds = image.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity) > 0 &&
				bounds.width > 0 &&
				bounds.height > 0 &&
				image.complete &&
				image.naturalWidth === width &&
				image.naturalHeight === height &&
				sourceIsAllowed(image.currentSrc || image.src)
			);
		};
		const trace = {
			frames: 0,
			visibleStageFrames: 0,
			blankFrames: 0,
			imageCountViolations: 0,
			visibleBufferCountViolations: 0,
			sequenceMismatchFrames: 0,
			clipMismatchFrames: 0,
			unexpectedSourceFrames: 0,
			undecodedFrames: 0,
			fileProtocolFrames: 0,
			transitions: [],
			lastTransitionKey: null,
			stopped: false,
		};
		const snapshot = (frame) => {
			const images = frameImages();
			const activeImages = images.filter((candidate) => candidate.getAttribute('data-active') === 'true');
			const image = activeImages[0] ?? null;
			const visible = stageVisible();
			const stageSequence = stage?.getAttribute('data-sequence') ?? null;
			const penguinSequence = penguin?.getAttribute('data-state') ?? null;
			const imageSequence = image?.getAttribute('data-state') ?? null;
			const penguinClip = penguin?.getAttribute('data-current-clip') ?? null;
			const imageClip = image?.getAttribute('data-clip') ?? null;
			const state = {
				sequence: penguinSequence ?? imageSequence ?? stageSequence,
				requestedSequence: stageSequence,
				clip: penguinClip ?? imageClip,
				imageCount: images.length,
				activeCount: activeImages.length,
				image: image ? {
					sequence: imageSequence,
					clip: imageClip,
					source: normalizedSource(image.currentSrc || image.src || null),
					complete: image.complete,
					naturalWidth: image.naturalWidth,
					naturalHeight: image.naturalHeight,
				} : null,
				visibleDecodedCount: images.filter(visibleDecoded).length,
				activeDecoded: Boolean(image && visibleDecoded(image)),
				stageVisible: visible,
			};
			const key = JSON.stringify({
				sequence: state.sequence,
				clip: state.clip,
				source: state.image?.source,
				complete: state.image?.complete,
				naturalWidth: state.image?.naturalWidth,
				naturalHeight: state.image?.naturalHeight,
				visibleDecodedCount: state.visibleDecodedCount,
				activeDecoded: state.activeDecoded,
			});
			if (key !== trace.lastTransitionKey) {
				trace.lastTransitionKey = key;
				trace.transitions.push(state);
			}
			if (!frame) return;
			trace.frames += 1;
			if (!visible) return;
			trace.visibleStageFrames += 1;
			if (state.visibleDecodedCount === 0) trace.blankFrames += 1;
			if (images.length < 1 || images.length > 2 || activeImages.length !== 1) {
				trace.imageCountViolations += 1;
			}
			if (state.visibleDecodedCount < 1 || state.visibleDecodedCount > 2) {
				trace.visibleBufferCountViolations += 1;
			}
			if (
				!allowedStates.has(penguinSequence) ||
				imageSequence !== penguinSequence
			) {
				trace.sequenceMismatchFrames += 1;
			}
			if (
				!allowedClipIds.has(penguinClip) ||
				imageClip !== penguinClip
			) {
				trace.clipMismatchFrames += 1;
			}
			if (!sourceIsAllowed(image?.currentSrc || image?.src)) trace.unexpectedSourceFrames += 1;
			// A newly selected animated WebP can be pending for a frame while the
			// previous decoded buffer remains visible. Only an uncovered pending
			// frame breaks the intended two-buffer continuity contract.
			if (!state.activeDecoded && state.visibleDecodedCount === 0) {
				trace.undecodedFrames += 1;
			}
			if (
				images
					.map((candidate) => candidate.currentSrc || candidate.getAttribute('src'))
					.filter(Boolean)
					.some((source) => {
					try {
						return new URL(source, document.baseURI).protocol === 'file:';
					} catch {
						return true;
					}
				})
			) {
				trace.fileProtocolFrames += 1;
			}
		};
		const frame = () => {
			if (trace.stopped) return;
			snapshot(true);
			globalThis.__blacksiteOperatorPoseFrame = requestAnimationFrame(frame);
		};
		snapshot(false);
		const observer = new MutationObserver(() => snapshot(false));
		if (stage) {
			observer.observe(stage, {
				attributes: true,
				subtree: true,
				attributeFilter: ['data-sequence', 'data-state', 'data-clip', 'data-current-clip', 'data-active', 'class', 'src'],
			});
		}
		globalThis.__blacksiteOperatorPoseTrace = trace;
		globalThis.__blacksiteOperatorPoseObserver = observer;
		globalThis.__blacksiteOperatorPoseFrame = requestAnimationFrame(frame);
	}, {
		selectors: SELECTORS,
		states: PENGUIN_OPERATOR_SEQUENCE_NAMES,
		clipIds: PENGUIN_OPERATOR_CLIP_IDS,
		frameAssets: PENGUIN_OPERATOR_FRAME_ASSETS,
		width: OPERATIVE_FRAME_WIDTH,
		height: OPERATIVE_FRAME_HEIGHT,
	});
}

async function operatorPoseTrace(page) {
	return page.evaluate(() => {
		const trace = globalThis.__blacksiteOperatorPoseTrace;
		if (!trace) return null;
		trace.stopped = true;
		globalThis.__blacksiteOperatorPoseObserver?.disconnect();
		if (globalThis.__blacksiteOperatorPoseFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteOperatorPoseFrame);
		}
		return structuredClone({
			frames: trace.frames,
			visibleStageFrames: trace.visibleStageFrames,
			blankFrames: trace.blankFrames,
			imageCountViolations: trace.imageCountViolations,
			visibleBufferCountViolations: trace.visibleBufferCountViolations,
			sequenceMismatchFrames: trace.sequenceMismatchFrames,
			clipMismatchFrames: trace.clipMismatchFrames,
			unexpectedSourceFrames: trace.unexpectedSourceFrames,
			undecodedFrames: trace.undecodedFrames,
			fileProtocolFrames: trace.fileProtocolFrames,
			transitions: trace.transitions,
		});
	});
}

async function beginStandaloneFxTrace(page) {
	await page.evaluate(({ selectors, names, frameAssets }) => {
		globalThis.__blacksiteStandaloneFxObserver?.disconnect();
		if (globalThis.__blacksiteStandaloneFxFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteStandaloneFxFrame);
		}
		const layer = document.querySelector(selectors.standaloneFx);
		const allowedNames = new Set(names);
		const allowedSources = new Set(
			frameAssets.map((assetPath) => new URL(assetPath, document.baseURI).href),
		);
		const trace = {
			samples: 0,
			activeSamples: 0,
			activeImageCountViolations: 0,
			inactiveImageViolations: 0,
			metadataMismatchFrames: 0,
			unknownNameFrames: 0,
			undecodedFrames: 0,
			invalidGeometryFrames: 0,
			unexpectedSourceFrames: 0,
			fileProtocolFrames: 0,
			activations: [],
			activationCounts: {},
			transitions: [],
			lastTransitionKey: null,
			priorActive: false,
			priorName: null,
			stopped: false,
		};
		const visibleDecoded = (image) => {
			const style = getComputedStyle(image);
			const bounds = image.getBoundingClientRect();
			return style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity) > 0 &&
				bounds.width > 0 &&
				bounds.height > 0 &&
				image.complete &&
				image.naturalWidth > 0 &&
				image.naturalHeight > 0;
		};
		const isFileOrInvalidSource = (source) => {
			try {
				return new URL(source, document.baseURI).protocol === 'file:';
			} catch {
				return true;
			}
		};
		const snapshot = (sampledFrame) => {
			const images = layer
				? [...layer.querySelectorAll(selectors.standaloneFxBuffers)]
				: [];
			const activeImages = images.filter((candidate) => candidate.getAttribute('data-active') === 'true');
			const visibleImages = images.filter(visibleDecoded);
			const image = activeImages[0] ?? null;
			const active = layer?.getAttribute('data-active') === 'true';
			const name = layer?.getAttribute('data-name') || null;
			const layerFrameIndexRaw = layer?.getAttribute('data-frame-index') ?? null;
			const imageFrameIndexRaw = image?.getAttribute('data-frame-index') ?? null;
			const source = image?.currentSrc || image?.src || null;
			const state = {
				active,
				name,
				frameIndex: layerFrameIndexRaw === null ? null : Number(layerFrameIndexRaw),
				imageCount: images.length,
				activeCount: activeImages.length,
				visibleDecodedCount: visibleImages.length,
				image: image ? {
					name: image.getAttribute('data-name') || null,
					frameIndex: imageFrameIndexRaw === null ? null : Number(imageFrameIndexRaw),
					source,
					complete: image.complete,
					naturalWidth: image.naturalWidth,
					naturalHeight: image.naturalHeight,
				} : null,
			};
			const transitionKey = JSON.stringify({
				active: state.active,
				name: state.name,
				frameIndex: state.frameIndex,
				source,
			});
			if (transitionKey !== trace.lastTransitionKey) {
				trace.lastTransitionKey = transitionKey;
				trace.transitions.push(state);
			}
			if (active && (!trace.priorActive || trace.priorName !== name)) {
				trace.activations.push(name);
				trace.activationCounts[name] = (trace.activationCounts[name] ?? 0) + 1;
			}
			trace.priorActive = active;
			trace.priorName = name;
			if (!sampledFrame) return;
			trace.samples += 1;
			if (!active) {
				if (
					images.length < 1 ||
					images.length > 2 ||
					activeImages.length !== 0 ||
					visibleImages.length !== 0
				) trace.inactiveImageViolations += 1;
				const populatedSources = images
					.map((candidate) => candidate.currentSrc || candidate.getAttribute('src'))
					.filter(Boolean);
				if (populatedSources.some((candidate) => !allowedSources.has(candidate))) {
					trace.unexpectedSourceFrames += 1;
				}
				if (populatedSources.some(isFileOrInvalidSource)) {
					trace.fileProtocolFrames += 1;
				}
				return;
			}
			trace.activeSamples += 1;
			if (
				images.length < 1 ||
				images.length > 2 ||
				activeImages.length !== 1 ||
				visibleImages.length !== 1 ||
				visibleImages[0] !== image
			) trace.activeImageCountViolations += 1;
			if (!allowedNames.has(name)) trace.unknownNameFrames += 1;
			if (
				image?.getAttribute('data-name') !== name ||
				imageFrameIndexRaw !== layerFrameIndexRaw
			) {
				trace.metadataMismatchFrames += 1;
			}
			if (!image?.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
				trace.undecodedFrames += 1;
			}
			const expectedWidth = name?.startsWith('bonusCrate') ? 512 : 1_280;
			const expectedHeight = name?.startsWith('bonusCrate') ? 512 : 1_024;
			if (
				image?.naturalWidth !== expectedWidth ||
				image?.naturalHeight !== expectedHeight
			) {
				trace.invalidGeometryFrames += 1;
			}
			const populatedSources = images
				.map((candidate) => candidate.currentSrc || candidate.getAttribute('src'))
				.filter(Boolean);
			if (populatedSources.some((candidate) => !allowedSources.has(candidate))) {
				trace.unexpectedSourceFrames += 1;
			}
			if (populatedSources.some(isFileOrInvalidSource)) {
				trace.fileProtocolFrames += 1;
			}
		};
		const sample = () => {
			if (trace.stopped) return;
			snapshot(true);
			globalThis.__blacksiteStandaloneFxFrame = requestAnimationFrame(sample);
		};
		snapshot(false);
		const observer = new MutationObserver(() => snapshot(false));
		if (layer) {
			observer.observe(layer, {
				attributes: true,
				childList: true,
				subtree: true,
				attributeFilter: ['data-active', 'data-name', 'data-frame-index', 'class', 'src'],
			});
		}
		globalThis.__blacksiteStandaloneFxTrace = trace;
		globalThis.__blacksiteStandaloneFxObserver = observer;
		globalThis.__blacksiteStandaloneFxFrame = requestAnimationFrame(sample);
	}, {
		selectors: SELECTORS,
		names: STANDALONE_FX_NAMES,
		frameAssets: STANDALONE_FX_FRAME_ASSETS,
	});
}

async function standaloneFxTrace(page) {
	return page.evaluate(() => {
		const trace = globalThis.__blacksiteStandaloneFxTrace;
		if (!trace) return null;
		trace.stopped = true;
		globalThis.__blacksiteStandaloneFxObserver?.disconnect();
		if (globalThis.__blacksiteStandaloneFxFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteStandaloneFxFrame);
		}
		return structuredClone({
			samples: trace.samples,
			activeSamples: trace.activeSamples,
			activeImageCountViolations: trace.activeImageCountViolations,
			inactiveImageViolations: trace.inactiveImageViolations,
			metadataMismatchFrames: trace.metadataMismatchFrames,
			unknownNameFrames: trace.unknownNameFrames,
			undecodedFrames: trace.undecodedFrames,
			invalidGeometryFrames: trace.invalidGeometryFrames,
			unexpectedSourceFrames: trace.unexpectedSourceFrames,
			fileProtocolFrames: trace.fileProtocolFrames,
			activations: trace.activations,
			activationCounts: trace.activationCounts,
			transitions: trace.transitions,
		});
	});
}

async function waitForStandaloneFxActivation(page, name, timeoutMs = 3_000) {
	await page.waitForFunction(
		(expectedName) =>
			(globalThis.__blacksiteStandaloneFxTrace?.activationCounts?.[expectedName] ?? 0) >= 1,
		name,
		{ timeout: timeoutMs },
	);
}

async function waitForStandaloneFxInactive(page, timeoutMs = 4_000) {
	await page.waitForFunction(
		(selectors) => {
			const layer = document.querySelector(selectors.standaloneFx);
			const buffers = [...document.querySelectorAll(selectors.standaloneFxBuffers)];
			return layer?.getAttribute('data-active') === 'false' &&
				buffers.length >= 1 &&
				buffers.length <= 2 &&
				buffers.every((buffer) => {
					const style = getComputedStyle(buffer);
					return buffer.getAttribute('data-active') === 'false' &&
						style.visibility === 'hidden' &&
						Number.parseFloat(style.opacity) === 0;
				});
		},
		SELECTORS,
		{ timeout: timeoutMs },
	);
}

async function waitForOperatorIdleSurface(page, timeoutMs = 4_000) {
	await page.waitForFunction(
		({ selectors, width, height }) => {
			const stage = document.querySelector(selectors.operative);
			const penguin = document.querySelector(selectors.penguinOperator);
			const active = document.querySelector(selectors.operativeImage);
			return stage?.getAttribute('data-sequence') === 'idle' &&
				penguin?.getAttribute('data-state') === 'idle' &&
				penguin.getAttribute('data-settled-state') === 'idle' &&
				penguin.getAttribute('data-ready') === 'true' &&
				penguin.getAttribute('data-fallback') === 'false' &&
				active?.getAttribute('data-active') === 'true' &&
				active.getAttribute('data-state') === 'idle' &&
				active.getAttribute('data-clip') === penguin.getAttribute('data-current-clip') &&
				active.complete &&
				active.naturalWidth === width &&
				active.naturalHeight === height;
		},
		{ selectors: SELECTORS, width: OPERATIVE_FRAME_WIDTH, height: OPERATIVE_FRAME_HEIGHT },
		{ timeout: timeoutMs },
	);
}

async function waitForOperatorCrossfadeSettled(page, timeoutMs = 2_000) {
	await page.waitForFunction(
		({ selectors, frameAssets, width, height }) => {
			const penguin = document.querySelector(selectors.penguinOperator);
			const buffers = [...document.querySelectorAll(selectors.operativePoseImages)];
			const activeBuffers = buffers.filter(
				(buffer) => buffer.getAttribute('data-active') === 'true',
			);
			const active = activeBuffers[0] ?? null;
			const normalizedUrl = (source) => {
				if (!source) return null;
				try {
					const url = new URL(source, document.baseURI);
					url.hash = '';
					return url;
				} catch {
					return null;
				}
			};
			const isCanonicalSource = (source) => {
				const url = normalizedUrl(source);
				return Boolean(
					url &&
					url.protocol !== 'file:' &&
					url.origin === location.origin &&
					frameAssets.some((path) => url.pathname.endsWith(`/${path}`)),
				);
			};
			const isDecodedCanonicalFrame = (buffer) =>
				buffer instanceof HTMLImageElement &&
				buffer.complete &&
				buffer.naturalWidth === width &&
				buffer.naturalHeight === height &&
				isCanonicalSource(buffer.currentSrc || buffer.src);
			const isFullyVisibleDecodedFrame = (buffer) => {
				if (!isDecodedCanonicalFrame(buffer)) return false;
				const style = getComputedStyle(buffer);
				const bounds = buffer.getBoundingClientRect();
				return style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					Number.parseFloat(style.opacity) >= 0.99 &&
					bounds.width > 0 &&
					bounds.height > 0;
			};
			const activeSource = normalizedUrl(active?.currentSrc || active?.src);
			const declaredSource = normalizedUrl(penguin?.getAttribute('data-source'));
			const fullyVisibleDecodedBuffers = buffers.filter(isFullyVisibleDecodedFrame);
			return penguin?.getAttribute('data-ready') === 'true' &&
				penguin.getAttribute('data-fallback') === 'false' &&
				buffers.length >= 1 &&
				buffers.length <= 2 &&
				activeBuffers.length === 1 &&
				active?.getAttribute('data-state') === penguin.getAttribute('data-state') &&
				active.getAttribute('data-clip') === penguin.getAttribute('data-current-clip') &&
				isDecodedCanonicalFrame(active) &&
				activeSource?.href === declaredSource?.href &&
				fullyVisibleDecodedBuffers.length === 1 &&
				fullyVisibleDecodedBuffers[0] === active;
		},
		{
			selectors: SELECTORS,
			frameAssets: PENGUIN_OPERATOR_FRAME_ASSETS,
			width: OPERATIVE_FRAME_WIDTH,
			height: OPERATIVE_FRAME_HEIGHT,
		},
		{ timeout: timeoutMs },
	);
}

async function standaloneFxSnapshot(page) {
	return page.locator(SELECTORS.standaloneFx).evaluate((layer) => {
		const buffers = [...layer.querySelectorAll('[data-buffer-testid="standalone-fx-buffer"]')];
		return {
			active: layer.getAttribute('data-active') === 'true',
			name: layer.getAttribute('data-name') || null,
			frameIndex: Number(layer.getAttribute('data-frame-index')),
			frameImageCount: layer.querySelectorAll('[data-testid="standalone-fx-frame"]').length,
			bufferImageCount: buffers.length,
			activeBufferCount: buffers.filter((buffer) => buffer.getAttribute('data-active') === 'true').length,
			visibleBufferCount: buffers.filter((buffer) => {
				const style = getComputedStyle(buffer);
				return style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0;
			}).length,
		};
	});
}

function standaloneFxIsInactive(snapshot) {
	return Boolean(
		snapshot &&
			snapshot.active === false &&
			snapshot.name === null &&
			snapshot.frameIndex === -1 &&
			snapshot.frameImageCount === 0 &&
			snapshot.bufferImageCount >= 1 &&
			snapshot.bufferImageCount <= 2 &&
			snapshot.activeBufferCount === 0 &&
			snapshot.visibleBufferCount === 0,
	);
}

function assertStandaloneFxTraceClean(group, trace) {
	check(
		group,
		'standalone FX sampler keeps one active visible decoded buffer across at most two persistent package buffers',
		Boolean(
			trace &&
				trace.samples > 0 &&
				trace.activeImageCountViolations === 0 &&
				trace.inactiveImageViolations === 0 &&
				trace.metadataMismatchFrames === 0 &&
				trace.unknownNameFrames === 0 &&
				trace.undecodedFrames === 0 &&
				trace.invalidGeometryFrames === 0 &&
				trace.unexpectedSourceFrames === 0 &&
				trace.fileProtocolFrames === 0
		),
		serialize(trace),
	);
}

async function beginQuickStartHudTrace(page) {
	await page.evaluate((selector) => {
		globalThis.__blacksiteQuickStartHudObserver?.disconnect();
		if (globalThis.__blacksiteQuickStartHudFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteQuickStartHudFrame);
		}
		const hud = document.querySelector(selector);
		const trace = { samples: [], lastKey: null, stopped: false };
		const visible = (element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const sample = () => {
			if (!hud) return;
			const segments = [...hud.children].map((element) => ({
				kind: element.getAttribute('data-feature-hud-kind') ??
					(element.classList.contains('objective-chip') ? 'objective' : ''),
				label:
					element.querySelector('small')?.innerText?.trim().replace(/\s+/g, ' ') ??
					(element.classList.contains('objective-chip') ? 'OBJECTIVE' : ''),
				value:
					element.querySelector('strong')?.innerText?.trim().replace(/\s+/g, ' ') ??
					element.innerText?.trim().replace(/\s+/g, ' ') ??
					'',
				visible: visible(element),
			}));
			const snapshot = {
				phase: document.querySelector('main.app-shell')?.getAttribute('data-phase') ?? null,
				text: hud.innerText?.trim().replace(/\s+/g, ' ') ?? '',
				segments,
				visibleLabels: segments.filter(({ visible: shown }) => shown).map(({ label }) => label),
			};
			const key = JSON.stringify(snapshot);
			if (key === trace.lastKey) return;
			trace.lastKey = key;
			trace.samples.push(snapshot);
		};
		const frame = () => {
			if (trace.stopped) return;
			sample();
			globalThis.__blacksiteQuickStartHudFrame = requestAnimationFrame(frame);
		};
		sample();
		const observer = new MutationObserver(sample);
		if (hud) {
			observer.observe(hud, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true,
			});
		}
		globalThis.__blacksiteQuickStartHudTrace = trace;
		globalThis.__blacksiteQuickStartHudObserver = observer;
		globalThis.__blacksiteQuickStartHudFrame = requestAnimationFrame(frame);
	}, SELECTORS.quickStartHud);
}

async function quickStartHudTrace(page) {
	return page.evaluate(() => {
		const trace = globalThis.__blacksiteQuickStartHudTrace;
		if (!trace) return [];
		trace.stopped = true;
		globalThis.__blacksiteQuickStartHudObserver?.disconnect();
		if (globalThis.__blacksiteQuickStartHudFrame !== undefined) {
			cancelAnimationFrame(globalThis.__blacksiteQuickStartHudFrame);
		}
		return structuredClone(trace.samples);
	});
}

async function beginVaultStateTrace(page) {
	await page.evaluate((selector) => {
		globalThis.__blacksiteVaultObserver?.disconnect();
		const trace = [];
		const sample = () => {
			const cinematic = document.querySelector(selector);
			const state = cinematic?.getAttribute('data-vault-state') ?? null;
			if (state && trace.at(-1) !== state) trace.push(state);
		};
		sample();
		const observer = new MutationObserver(sample);
		observer.observe(document.body, { attributes: true, childList: true, subtree: true });
		globalThis.__blacksiteVaultTrace = trace;
		globalThis.__blacksiteVaultObserver = observer;
	}, SELECTORS.vaultCinematic);
}

async function finishVaultStateTrace(page) {
	return page.evaluate(() => {
		globalThis.__blacksiteVaultObserver?.disconnect();
		return structuredClone(globalThis.__blacksiteVaultTrace ?? []);
	});
}

async function installBootHarnessInit(
	context,
	{ traceBoot = false } = {},
) {
	await context.addInitScript(
		({ traceEnabled, selectors }) => {
			if (!traceEnabled) return;

			const trace = {
				states: [],
				progress: [],
				startedAtMs: Math.round(performance.now() * 1_000) / 1_000,
			};
			globalThis.__blacksiteBootTrace = trace;
			let lastState = null;
			let lastProgress = null;
			let sawBootRoot = false;

			const timestamp = () => Math.round(performance.now() * 1_000) / 1_000;
			const recordState = (value, source) => {
				if (typeof value !== 'string' || value.length === 0 || value === lastState) return;
				if (value === 'READY_FOR_INTRO') recordProgress(100, 'ready-for-intro');
				lastState = value;
				trace.states.push({ state: value, atMs: timestamp(), source });
			};
			const recordProgress = (value, source) => {
				const percent = Number(value);
				if (!Number.isFinite(percent) || percent < 0 || percent > 100 || percent === lastProgress) return;
				lastProgress = percent;
				trace.progress.push({ percent, atMs: timestamp(), state: lastState, source });
			};
			recordState('BOOT', 'harness-start');
			const capture = (source = 'capture') => {
				const root = document.querySelector(selectors.bootSequence);
				if (root) {
					sawBootRoot = true;
					recordState(root.getAttribute('data-boot-state'), source);
					const progress = root.querySelector(selectors.bootProgress);
					if (progress) recordProgress(progress.getAttribute('aria-valuenow'), source);
				} else if (sawBootRoot) {
					recordState('GAME_READY', 'boot-root-detached');
				}
			};
			const install = () => {
				if (!document.documentElement) {
					setTimeout(install, 0);
					return;
				}
				let observedRoot = null;
				let rootObserver = null;
				const observeRoot = (root, source) => {
					if (root === observedRoot) return;
					rootObserver?.disconnect();
					observedRoot = root;
					sawBootRoot = true;
					rootObserver = new MutationObserver((mutations) => {
						for (const mutation of mutations) {
							if (mutation.type !== 'attributes') continue;
							if (mutation.attributeName === 'data-boot-state') {
								recordState(mutation.oldValue, 'attribute-old-value');
								recordState(
									mutation.target.getAttribute('data-boot-state'),
									'attribute-current-value',
								);
							}
							if (
								mutation.attributeName === 'aria-valuenow'
								&& mutation.target.matches?.(selectors.bootProgress)
							) {
								recordProgress(mutation.oldValue, 'attribute-old-value');
								recordProgress(
									mutation.target.getAttribute('aria-valuenow'),
									'attribute-current-value',
								);
							}
						}
						capture('root-mutation');
					});
					rootObserver.observe(root, {
						attributes: true,
						attributeFilter: ['data-boot-state', 'aria-valuenow'],
						attributeOldValue: true,
						subtree: true,
					});
					globalThis.__blacksiteBootRootObserver = rootObserver;
					capture(source);
				};
				const observer = new MutationObserver(() => {
					if (observedRoot?.isConnected) return;
					if (observedRoot && !observedRoot.isConnected) {
						rootObserver?.disconnect();
						rootObserver = null;
						observedRoot = null;
						recordState('GAME_READY', 'boot-root-detached');
					}
					const root = document.querySelector(selectors.bootSequence);
					if (root) observeRoot(root, 'boot-root-attached');
				});
				observer.observe(document.documentElement, {
					childList: true,
					subtree: true,
				});
				globalThis.__blacksiteBootObserver = observer;
				const root = document.querySelector(selectors.bootSequence);
				if (root) observeRoot(root, 'installed');
			};
			install();
		},
		{
			traceEnabled: traceBoot,
			selectors: {
				bootSequence: SELECTORS.bootSequence,
				bootProgress: SELECTORS.bootProgress,
			},
		},
	);
}

async function bootStateTrace(page) {
	return page.evaluate(() => structuredClone(globalThis.__blacksiteBootTrace ?? {
		states: [],
		progress: [],
		startedAtMs: null,
	}));
}

function traceContainsStatesInOrder(trace, expectedStates) {
	const states = trace.states.map(({ state }) => state);
	let cursor = -1;
	for (const expected of expectedStates) {
		cursor = states.findIndex((state, index) => index > cursor && state === expected);
		if (cursor < 0) return false;
	}
	return true;
}

function traceProgressIsMonotonic(trace) {
	const values = trace.progress.map(({ percent }) => percent);
	return values.length >= 2
		&& values[0] === 0
		&& values.at(-1) === 100
		&& values.every((value, index) => index === 0 || value >= values[index - 1]);
}

async function completeStandardStartup(page, timeoutMs = 30_000) {
	const root = page.locator(SELECTORS.bootSequence);
	const startupFailure = page.locator(SELECTORS.launchError);
	const initialSurface = await Promise.race([
		root.waitFor({ state: 'attached', timeout: timeoutMs }).then(() => 'boot'),
		startupFailure.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error'),
	]);
	if (initialSurface === 'error') return;

	const introOrRules = await Promise.race([
		page.locator(`${SELECTORS.bootSequence}[data-boot-state="INTRO_PLAYING"]`)
			.waitFor({ state: 'visible', timeout: timeoutMs })
			.then(() => 'intro'),
		page.locator(SELECTORS.bootStartCard)
			.waitFor({ state: 'visible', timeout: timeoutMs })
			.then(() => 'rules'),
		startupFailure.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error'),
	]);
	if (introOrRules === 'error') return;

	if (introOrRules === 'intro') {
		const introExit = await Promise.race([
			page.locator(SELECTORS.bootIntroSkip)
				.waitFor({ state: 'visible', timeout: timeoutMs })
				.then(() => 'skip'),
			page.locator(SELECTORS.bootStartCard)
				.waitFor({ state: 'visible', timeout: timeoutMs })
				.then(() => 'rules'),
			startupFailure.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error'),
		]);
		if (introExit === 'error') return;
		if (introExit === 'skip') await page.locator(SELECTORS.bootIntroSkip).click();
	}

	const rulesOutcome = await Promise.race([
		page.locator(SELECTORS.bootStartCard)
			.waitFor({ state: 'visible', timeout: timeoutMs })
			.then(() => 'rules'),
		startupFailure.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'error'),
	]);
	if (rulesOutcome === 'error') return;
	await page.locator(SELECTORS.bootStartCard).click();
	await root.waitFor({ state: 'detached', timeout: timeoutMs });
}

async function openPage(
	context,
	origin,
	query,
	{
		path = '/',
		mountPrefix = '/',
		startupFlow = 'standard',
		traceBoot = false,
	} = {},
) {
	await installBootHarnessInit(context, { traceBoot });
	const page = await context.newPage();
	const diagnostics = await pageDiagnostics(page, { origin, mountPrefix });
	await page.goto(`${origin}${path}${query}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
	// The dedicated short-landscape raster intentionally gives the reels and
	// controls the full height; runtime status remains in the accessible DOM.
	await page.locator(SELECTORS.launchStatus).waitFor({ state: 'attached', timeout: 10_000 });
	if (startupFlow === 'standard') await completeStandardStartup(page);
	return { page, diagnostics };
}

async function saveScreenshot(page, name) {
	mkdirSync(screenshotRoot, { recursive: true });
	const path = join(screenshotRoot, `${name}.png`);
	await page.screenshot({ path, fullPage: false });
	return relative(repoRoot, path).replaceAll('\\', '/');
}

function assertExactRequest(group, request, { method, path, body }) {
	check(group, `${path} uses ${method}`, request?.method === method, serialize(request));
	check(group, `${path} endpoint is exact`, request?.path === path, serialize(request));
	check(
		group,
		`${path} uses application/json`,
		typeof request?.contentType === 'string' && request.contentType.includes('application/json'),
		serialize(request?.contentType),
	);
	let exact = false;
	try {
		assert.deepEqual(request?.body, body);
		exact = true;
	} catch {
		exact = false;
	}
	check(group, `${path} body is exact`, exact, serialize({ actual: request?.body, expected: body }));
}

function assertCleanNetwork(group, network) {
	check(group, 'no unexpected RGS or external requests', network.unexpected.length === 0, serialize(network.unexpected));
	check(group, 'no forbidden Replay writes', network.forbidden.length === 0, serialize(network.forbidden));
}

function rgsRequestCount(network) {
	return Object.values(network.byEndpoint).reduce((sum, requests) => sum + requests.length, 0);
}

function walletWriteCount(network) {
	return (
		network.byEndpoint.authenticate.length +
		network.byEndpoint.play.length +
		network.byEndpoint.endRound.length +
		network.byEndpoint.event.length
	);
}

function teardownAbortEvidenceIsStrict(item) {
	let parsed;
	try {
		parsed = new URL(item?.url);
	} catch {
		return false;
	}
	const proof = item?.proof;
	const eligibleAbort = item?.method === 'GET' &&
		item?.error === 'net::ERR_ABORTED' &&
		/\/assets\/blacksite\//u.test(parsed.pathname) &&
		typeof proof?.expectedOrigin === 'string' &&
		parsed.origin === proof.expectedOrigin &&
		Number.isFinite(item?.failureAt) &&
		item.failureAt === proof.failureAt;
	if (!eligibleAbort) return false;
	if (proof.reason === 'main-frame-navigation') {
		return Number.isInteger(item.requestNavigationGeneration) &&
			item.requestNavigationGeneration === proof.requestNavigationGeneration &&
			Number.isInteger(proof.mainNavigationCount) &&
			proof.requestNavigationGeneration < proof.mainNavigationCount &&
			Number.isFinite(proof.navigationStartedAt) &&
			proof.navigationLeadToleranceMs === 500 &&
			proof.navigationFollowWindowMs === 5_000 &&
			proof.failureAt >= proof.navigationStartedAt - proof.navigationLeadToleranceMs &&
			proof.failureAt - proof.navigationStartedAt <= proof.navigationFollowWindowMs;
	}
	if (proof.reason === 'connected-media-request-superseded') {
		return item.resourceType === 'media' &&
			Number.isInteger(proof.connectedOwners) &&
			proof.connectedOwners > 0 &&
			Array.isArray(proof.owners) &&
			proof.owners.length === proof.connectedOwners &&
			proof.owners.some(({ tag, sources }) =>
				['video', 'audio', 'source'].includes(tag) &&
				Array.isArray(sources) &&
				sources.includes(item.url),
			);
	}
	if (proof.reason === 'successful-image-request-supersession') {
		const failedUrl = new URL(item.url);
		failedUrl.hash = '';
		return item.resourceType === 'image' &&
			/\/assets\/blacksite\/v20\/penguin-operator\/(?:transitions\/)?[^/]+\.webp$/iu.test(failedUrl.pathname) &&
			Array.isArray(proof.successfulResponses) &&
			proof.successfulResponses.length > 0 &&
			proof.successfulResponses.every((response) => {
				try {
					const successfulUrl = new URL(response.url);
					successfulUrl.hash = '';
					return response.method === 'GET' &&
						response.resourceType === 'image' &&
						response.status === 200 &&
						/^image\/webp(?:\s*;|$)/iu.test(response.contentType ?? '') &&
						successfulUrl.href === failedUrl.href;
				} catch {
					return false;
				}
			});
	}
	if (proof.reason === 'component-fetch-teardown') {
		return item.resourceType === 'fetch' &&
			proof.eventWindowMs === 2_000 &&
			Array.isArray(proof.events) &&
			proof.events.length > 0 &&
			proof.events.every(({ at }) =>
				Number.isFinite(at) && Math.abs(proof.failureAt - at) <= proof.eventWindowMs,
			) &&
			proof.events.some(({ reason, tag, url }) =>
				reason === 'fetch-signal-aborted' && tag === 'fetch' && url === item.url,
			);
	}
	if (
		proof.reason !== 'component-media-teardown' ||
		proof.eventWindowMs !== 2_000 ||
		!Array.isArray(proof.events) ||
		proof.events.length === 0 ||
		!proof.events.every(({ at }) =>
			Number.isFinite(at) && Math.abs(proof.failureAt - at) <= proof.eventWindowMs,
		)
	) return false;
	const hasExplicitMediaRelease = item.resourceType === 'media' &&
		proof.explicitMediaRelease === true &&
		proof.events.some(({ reason }) =>
			reason === 'media-paused' ||
				reason === 'media-current-time-reset' ||
				reason === 'src-changed' ||
				reason === 'node-removed',
		);
	const hasDisconnectedOwnerRelease = proof.connectedOwners === 0 &&
		proof.disconnectedOwnerRelease === true &&
		proof.events.some(({ reason }) => reason === 'src-changed' || reason === 'node-removed');
	return hasExplicitMediaRelease || hasDisconnectedOwnerRelease;
}

async function assertCleanDiagnostics(group, diagnostics) {
	await diagnostics.flush();
	check(group, 'browser has no console errors', diagnostics.consoleErrors.length === 0, serialize(diagnostics.consoleErrors));
	check(group, 'browser has no uncaught page errors', diagnostics.pageErrors.length === 0, serialize(diagnostics.pageErrors));
	check(group, 'browser has no failed requests', diagnostics.failedRequests.length === 0, serialize(diagnostics.failedRequests));
	check(
		group,
		'any excluded net::ERR_ABORTED request has same-origin navigation, successful exact-image supersession, connected-media supersession or teardown proof',
		diagnostics.teardownAbortedRequests.every(teardownAbortEvidenceIsStrict),
		serialize(diagnostics.teardownAbortedRequests),
	);
	check(group, 'same-origin build requests have no HTTP errors', diagnostics.sameOriginHttpErrors.length === 0, serialize(diagnostics.sameOriginHttpErrors));
	check(group, 'nested build assets do not escape to origin /assets', diagnostics.assetEscapes.length === 0, serialize(diagnostics.assetEscapes));
	check(group, 'HTTPS pages issue no local file requests', diagnostics.localFileRequests.length === 0, serialize(diagnostics.localFileRequests));
	check(group, 'browser issues no BLACKSITE runtime PNG request', diagnostics.runtimePngRequests.length === 0, serialize(diagnostics.runtimePngRequests));
	check(group, 'BLACKSITE WebP responses use image/webp', diagnostics.invalidRuntimeWebpResponses.length === 0, serialize(diagnostics.invalidRuntimeWebpResponses));
}

async function assertOnlyExpectedHttpDiagnostic(group, diagnostics, statusCode) {
	await diagnostics.flush();
	const expectedMessage = {
		401: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
		503: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
	}[statusCode];
	check(
		group,
		`browser reports exactly one expected HTTP ${statusCode} console diagnostic`,
		diagnostics.consoleErrors.length === 1 && diagnostics.consoleErrors[0] === expectedMessage,
		serialize(diagnostics.consoleErrors),
	);
	check(group, 'browser has no uncaught page errors', diagnostics.pageErrors.length === 0, serialize(diagnostics.pageErrors));
	check(group, 'browser has no failed requests', diagnostics.failedRequests.length === 0, serialize(diagnostics.failedRequests));
	check(
		group,
		'any excluded net::ERR_ABORTED request has same-origin BLACKSITE navigation or disconnected-media teardown proof',
		diagnostics.teardownAbortedRequests.every(teardownAbortEvidenceIsStrict),
		serialize(diagnostics.teardownAbortedRequests),
	);
	check(group, 'same-origin build requests have no HTTP errors', diagnostics.sameOriginHttpErrors.length === 0, serialize(diagnostics.sameOriginHttpErrors));
	check(group, 'nested build assets do not escape to origin /assets', diagnostics.assetEscapes.length === 0, serialize(diagnostics.assetEscapes));
	check(group, 'HTTPS pages issue no local file requests', diagnostics.localFileRequests.length === 0, serialize(diagnostics.localFileRequests));
	check(group, 'browser issues no BLACKSITE runtime PNG request', diagnostics.runtimePngRequests.length === 0, serialize(diagnostics.runtimePngRequests));
	check(group, 'BLACKSITE WebP responses use image/webp', diagnostics.invalidRuntimeWebpResponses.length === 0, serialize(diagnostics.invalidRuntimeWebpResponses));
}

async function collectSceneAssetAudit(page) {
	await waitForOperatorCrossfadeSettled(page);
	return page.evaluate(async ({ selectors, symbolMasterAssets }) => {
		const withTimeout = (promise, label) =>
			new Promise((resolvePromise, rejectPromise) => {
				const timer = setTimeout(
					() => rejectPromise(new Error(`${label} decode timed out`)),
					10_000,
				);
				promise.then(
					(value) => {
						clearTimeout(timer);
						resolvePromise(value);
					},
					(error) => {
						clearTimeout(timer);
						rejectPromise(error);
					},
				);
			});
		const describeImage = (element, error = null) => {
			const style = element instanceof Element ? getComputedStyle(element) : null;
			const rect = element instanceof Element ? element.getBoundingClientRect() : null;
			return {
				exists: element instanceof HTMLImageElement,
				tagName: element?.tagName ?? null,
				connected: element instanceof Element && element.isConnected,
				sequence: element instanceof Element ? element.getAttribute('data-sequence') : null,
				state: element instanceof Element ? element.getAttribute('data-state') : null,
				clip: element instanceof Element ? element.getAttribute('data-clip') : null,
				name: element instanceof Element ? element.getAttribute('data-name') : null,
				active: element instanceof Element ? element.getAttribute('data-active') : null,
				frameIndex: element instanceof Element && element.hasAttribute('data-frame-index')
					? Number(element.getAttribute('data-frame-index'))
					: null,
				currentSrc:
					element instanceof HTMLImageElement && element.currentSrc
						? element.currentSrc
						: null,
				source:
					element instanceof HTMLImageElement
						? element.currentSrc || element.src || null
						: null,
				complete: element instanceof HTMLImageElement && element.complete,
				decoded:
					element instanceof HTMLImageElement &&
					error === null &&
					element.complete &&
					element.naturalWidth > 0,
				naturalWidth: element instanceof HTMLImageElement ? element.naturalWidth : 0,
				naturalHeight: element instanceof HTMLImageElement ? element.naturalHeight : 0,
				display: style?.display ?? null,
				visibility: style?.visibility ?? null,
				opacity: style ? Number.parseFloat(style.opacity) : 0,
				width: rect?.width ?? 0,
				height: rect?.height ?? 0,
				viewportVisible:
					Boolean(rect) &&
					rect.width > 0 &&
					rect.height > 0 &&
					rect.right > 0 &&
					rect.bottom > 0 &&
					rect.left < innerWidth &&
					rect.top < innerHeight,
				error,
			};
		};
		const auditImage = async (element, label, { decode = true } = {}) => {
			let error = null;
			if (decode && element instanceof HTMLImageElement) {
				try {
					await withTimeout(element.decode(), label);
				} catch (caught) {
					error = caught instanceof Error ? caught.message : String(caught);
				}
			}
			return describeImage(element, error);
		};
		const captureOperativeSurface = () => {
			const stage = document.querySelector(selectors.operative);
			const penguin = document.querySelector(selectors.penguinOperator);
			const stageStyle = stage instanceof Element ? getComputedStyle(stage) : null;
			const stageRect = stage instanceof Element ? stage.getBoundingClientRect() : null;
			const frameElements = [
				...document.querySelectorAll(selectors.operativePoseImages),
			];
			const frames = frameElements.map((image) => describeImage(image));
			const activeElement = frameElements.find(
				(image) => image.getAttribute('data-active') === 'true',
			) ?? null;
			const activeIndex = frameElements.indexOf(activeElement);
			return {
				stage: {
					exists: Boolean(stage),
					sequence: stage?.getAttribute('data-sequence') ?? null,
					penguinExists: Boolean(penguin),
					penguinKind: penguin?.getAttribute('data-operator-kind') ?? null,
					penguinState: penguin?.getAttribute('data-state') ?? null,
					penguinSettledState: penguin?.getAttribute('data-settled-state') ?? null,
					penguinClip: penguin?.getAttribute('data-current-clip') ?? null,
					penguinReady: penguin?.getAttribute('data-ready') ?? null,
					penguinFallback: penguin?.getAttribute('data-fallback') ?? null,
					adultFrameImageCount: document.querySelectorAll(
						'[data-testid="operative-animation-frame"], [data-buffer-testid="operative-animation-buffer"]',
					).length,
					visible:
						Boolean(stageRect) &&
						stageStyle?.display !== 'none' &&
						stageStyle?.visibility !== 'hidden' &&
						Number.parseFloat(stageStyle?.opacity ?? '0') > 0 &&
						stageRect.width > 0 &&
						stageRect.height > 0,
					frameImageCount: frames.length,
					activeFrameCount: frames.filter(({ active }) => active === 'true').length,
				},
				activeFrame: frames[activeIndex] ?? describeImage(null),
				frames,
			};
		};
		// Capture the settled Penguin surface atomically before any asynchronous
		// board, master-symbol or scene-asset decode can advance its next handoff.
		const operativeSurface = captureOperativeSurface();

		const backdrop = document.querySelector(selectors.environmentImage);
		const premiumMachineShell = document.querySelector(selectors.premiumMachineShell);
		const symbolImages = [...document.querySelectorAll('.symbol-art img')];
		const visibleSymbolImage = symbolImages.find((image) => {
			const style = getComputedStyle(image);
			const rect = image.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity) > 0 &&
				rect.width > 0 &&
				rect.height > 0 &&
				rect.right > 0 &&
				rect.bottom > 0 &&
				rect.left < innerWidth &&
				rect.top < innerHeight
			);
		});
		const symbolImage = visibleSymbolImage ?? symbolImages[0];
		const boardSymbols = await Promise.all(symbolImages.map(async (image) => ({
			...(await auditImage(image, `board symbol ${image.closest('[data-symbol-id]')?.getAttribute('data-symbol-id') ?? 'unknown'}`)),
			symbolId: image.closest('[data-symbol-id]')?.getAttribute('data-symbol-id') ?? null,
		})));
		const symbolMasters = await Promise.all(
			Object.entries(symbolMasterAssets).map(async ([symbolId, relativePath]) => {
				const image = new Image();
				image.src = new URL(`assets/blacksite/${relativePath}`, window.location.href).href;
				return {
					...(await auditImage(image, `symbol master ${symbolId}`)),
					symbolId,
					relativePath,
				};
			}),
		);
		const appShell = document.querySelector('main.app-shell');
		const captureStandaloneFxSurface = () => {
			const layer = document.querySelector(selectors.standaloneFx);
			const frameElements = [
				...document.querySelectorAll(selectors.standaloneFxBuffers),
			];
			const frames = frameElements.map((image) => describeImage(image));
			const activeElement = frameElements.find(
				(image) => image.getAttribute('data-active') === 'true',
			) ?? null;
			const activeIndex = frameElements.indexOf(activeElement);
			return {
				stage: {
					exists: Boolean(layer),
					active: layer?.getAttribute('data-active') === 'true',
					name: layer?.getAttribute('data-name') || null,
					frameIndex: layer?.hasAttribute('data-frame-index')
						? Number(layer.getAttribute('data-frame-index'))
						: null,
					frameImageCount: frames.length,
					activeFrameCount: frames.filter(({ active }) => active === 'true').length,
				},
				activeFrame: frames[activeIndex] ?? describeImage(null),
				frames,
			};
		};
		const standaloneFxSurface = captureStandaloneFxSurface();
		return {
			viewport: { width: innerWidth, height: innerHeight },
			appShell: {
				inlineStyle: appShell?.getAttribute('style') ?? null,
				environmentImageVariable:
					appShell instanceof HTMLElement
						? appShell.style.getPropertyValue('--environment-image').trim()
						: null,
				symbolSheetVariable:
					appShell instanceof HTMLElement
						? appShell.style.getPropertyValue('--symbol-sheet').trim()
						: null,
			},
			operativeStage: operativeSurface.stage,
			operative: operativeSurface.activeFrame,
			operativeFrames: operativeSurface.frames,
			standaloneFx: standaloneFxSurface.stage,
			standaloneFxActiveFrame: standaloneFxSurface.activeFrame,
			standaloneFxFrames: standaloneFxSurface.frames,
			background: await auditImage(backdrop, 'scene background'),
			premiumMachine: await auditImage(premiumMachineShell, 'premium machine shell'),
			symbolSheet: await auditImage(symbolImage, 'visible symbol sheet'),
			boardSymbols,
			symbolMasters,
		};
	}, { selectors: SELECTORS, symbolMasterAssets: SYMBOL_MASTER_ASSETS });
}

function assertOperativePoseAssetAudit(group, audit, origin, mountPrefix) {
	const frames = audit.operativeFrames;
	const activeFrames = frames.filter(({ active }) => active === 'true');
	check(
		group,
		'Penguin operative mounts one active frame across at most two persistent decode buffers with no adult runtime frame',
		frames.length >= 1 &&
			frames.length <= 2 &&
			audit.operativeStage.frameImageCount === frames.length &&
			audit.operativeStage.activeFrameCount === 1 &&
			activeFrames.length === 1 &&
			audit.operativeStage.penguinExists === true &&
			audit.operativeStage.penguinKind === 'swat-penguin-v1' &&
			audit.operativeStage.adultFrameImageCount === 0,
		serialize({ stage: audit.operativeStage, frames }),
	);
	const frame = activeFrames[0];
	const visibleFrames = frames.filter(({ display, visibility, opacity, width, height }) =>
		display !== 'none' &&
		visibility !== 'hidden' &&
		opacity > 0 &&
		width > 0 &&
		height > 0,
	);
	const fullyVisibleFrames = visibleFrames.filter(({ opacity }) => opacity >= 0.99);
	let packaged = false;
	let secureWhenRequired = false;
	let nonFile = false;
	try {
		const url = new URL(frame?.source);
		const expectedPaths = new Set(
			PENGUIN_OPERATOR_FRAME_ASSETS.map((path) => `${mountPrefix}${path}`),
		);
		packaged = url.origin === origin && expectedPaths.has(url.pathname);
		secureWhenRequired = new URL(origin).protocol !== 'https:' || url.protocol === 'https:';
		nonFile = url.protocol !== 'file:';
	} catch {
		packaged = false;
		secureWhenRequired = false;
		nonFile = false;
	}
	const populatedBufferUrlsAreSafe = frames.every(({ source }) => {
		if (!source) return true;
		try {
			const url = new URL(source);
			const expectedPaths = new Set(
				PENGUIN_OPERATOR_FRAME_ASSETS.map((path) => `${mountPrefix}${path}`),
			);
			return url.origin === origin &&
				expectedPaths.has(url.pathname) &&
				url.protocol !== 'file:' &&
				(new URL(origin).protocol !== 'https:' || url.protocol === 'https:');
		} catch {
			return false;
		}
	});
	check(
		group,
		'visible Penguin stage exposes exactly one active decoded 1280x1024 canonical V20 buffer with matching state and clip metadata',
		!audit.operativeStage.visible ||
			(frame?.state === audit.operativeStage.penguinState &&
				frame?.clip === audit.operativeStage.penguinClip &&
				visibleFrames.length >= 1 &&
				visibleFrames.length <= 2 &&
				fullyVisibleFrames.length === 1 &&
				fullyVisibleFrames[0]?.source === frame?.source &&
				activeFrames[0]?.source === frame?.source &&
				PENGUIN_OPERATOR_SEQUENCE_NAMES.includes(frame?.state) &&
				PENGUIN_OPERATOR_CLIP_IDS.includes(frame?.clip) &&
				audit.operativeStage.penguinReady === 'true' &&
				audit.operativeStage.penguinFallback === 'false' &&
				frame.complete &&
				frame.decoded &&
				frame.naturalWidth === OPERATIVE_FRAME_WIDTH &&
				frame.naturalHeight === OPERATIVE_FRAME_HEIGHT &&
				packaged && secureWhenRequired && nonFile && populatedBufferUrlsAreSafe),
		serialize({ stage: audit.operativeStage, frame, frames, visibleFrames, packaged, secureWhenRequired, nonFile, populatedBufferUrlsAreSafe }),
	);
}

function assertStandaloneFxAssetAudit(group, audit, origin, mountPrefix) {
	const stage = audit.standaloneFx;
	const frames = audit.standaloneFxFrames;
	const activeFrames = frames.filter(({ active }) => active === 'true');
	const visibleFrames = frames.filter(({ display, visibility, opacity, width, height }) =>
		display !== 'none' &&
		visibility !== 'hidden' &&
		opacity > 0 &&
		width > 0 &&
		height > 0,
	);
	const populatedBufferUrlsAreSafe = frames.every((candidate) => {
		if (!candidate.source) return true;
		const candidateEffect = OPERATOR_FX_CATALOG[candidate.name];
		if (!candidateEffect) return false;
		try {
			const url = new URL(candidate.source);
			const expectedPaths = new Set(
				candidateEffect.frames.map((path) => `${mountPrefix}${path}`),
			);
			return url.origin === origin &&
				expectedPaths.has(url.pathname) &&
				url.protocol !== 'file:' &&
				(new URL(origin).protocol !== 'https:' || url.protocol === 'https:');
		} catch {
			return false;
		}
	});
	check(
		group,
		'standalone FX owns one state layer with at most two persistent decode buffers',
		stage?.exists === true &&
			frames.length >= 1 &&
			frames.length <= 2 &&
			stage.frameImageCount === frames.length &&
			stage.activeFrameCount === activeFrames.length &&
			populatedBufferUrlsAreSafe,
		serialize({ stage, frames }),
	);
	if (!stage?.active) {
		check(
			group,
			'inactive standalone FX is fail-closed with zero active/visible buffers and no retained cue name',
			activeFrames.length === 0 &&
				visibleFrames.length === 0 &&
				stage?.name === null &&
				stage?.frameIndex === -1,
			serialize({ stage, frames }),
		);
		return;
	}

	const frame = audit.standaloneFxActiveFrame;
	const effect = OPERATOR_FX_CATALOG[stage.name];
	let packaged = false;
	let secureWhenRequired = false;
	let nonFile = false;
	try {
		if (!effect) throw new Error(`Unknown standalone FX cue: ${String(stage.name)}`);
		const url = new URL(frame?.source);
		const expectedPaths = new Set(
			effect.frames.map((path) => `${mountPrefix}${path}`),
		);
		packaged = url.origin === origin && expectedPaths.has(url.pathname);
		secureWhenRequired = new URL(origin).protocol !== 'https:' || url.protocol === 'https:';
		nonFile = url.protocol !== 'file:';
	} catch {
		packaged = false;
		secureWhenRequired = false;
		nonFile = false;
	}
	check(
		group,
		'active standalone FX has exactly one visible decoded manifest buffer with matching cue metadata',
		Boolean(
			effect &&
				activeFrames.length === 1 &&
				visibleFrames.length === 1 &&
				activeFrames[0]?.source === frame?.source &&
				visibleFrames[0]?.source === frame?.source &&
				frame?.name === stage.name &&
				frame?.frameIndex === stage.frameIndex &&
				Number.isSafeInteger(frame?.frameIndex) &&
				frame.frameIndex >= 0 &&
				frame.complete &&
				frame.decoded &&
				frame.naturalWidth === effect.frameSize.width &&
				frame.naturalHeight === effect.frameSize.height &&
				packaged && secureWhenRequired && nonFile && populatedBufferUrlsAreSafe
		),
		serialize({ stage, frame, frames, visibleFrames, packaged, secureWhenRequired, nonFile, populatedBufferUrlsAreSafe }),
	);
}

function assertSceneAssetAudit(
	group,
	audit,
	origin,
	mountPrefix,
	{ requireVisibleSymbol = false } = {},
) {
	assertOperativePoseAssetAudit(group, audit, origin, mountPrefix);
	assertStandaloneFxAssetAudit(group, audit, origin, mountPrefix);
	const expectedMasterEntries = Object.entries(SYMBOL_MASTER_ASSETS);
	const actualMasterIds = audit.symbolMasters.map(({ symbolId }) => symbolId);
	check(
		group,
		'all thirteen canonical v4 symbol base rasters are audited exactly once',
		audit.symbolMasters.length === 13 &&
			serialize(actualMasterIds) === serialize(expectedMasterEntries.map(([symbolId]) => symbolId)),
		serialize({ actualMasterIds, expectedMasterIds: expectedMasterEntries.map(([symbolId]) => symbolId) }),
	);
	const uniqueMasterSources = new Set(audit.symbolMasters.map(({ source }) => source));
	check(
		group,
		'all thirteen v4 symbol base rasters expose unique package URLs',
		uniqueMasterSources.size === 13,
		serialize([...uniqueMasterSources]),
	);
	for (const [symbolId, relativePath] of expectedMasterEntries) {
		const asset = audit.symbolMasters.find((candidate) => candidate.symbolId === symbolId);
		let exactPackageUrl = false;
		let nonFile = false;
		try {
			const url = new URL(asset?.source);
			exactPackageUrl =
				url.origin === origin &&
				url.pathname === `${mountPrefix}assets/blacksite/${relativePath}`;
			nonFile = url.protocol !== 'file:';
		} catch {
			exactPackageUrl = false;
			nonFile = false;
		}
		check(
			group,
			`${symbolId} base raster decodes from its exact nested package path`,
			asset?.complete === true &&
				asset.decoded === true &&
				asset.naturalWidth === 512 &&
				asset.naturalHeight === 512 &&
				exactPackageUrl &&
				nonFile,
			serialize({ asset, origin, mountPrefix, relativePath }),
		);
	}
	check(
		group,
		'visible board images use only canonical v4 state rasters and contain no legacy asset name',
		audit.boardSymbols.every(({ source, symbolId, complete, decoded }) => {
			if (!ALL_SYMBOLS.includes(symbolId) || !complete || !decoded || typeof source !== 'string') return false;
			try {
				const url = new URL(source);
				const allowedPaths = new Set(Object.values(SYMBOL_STATE_ASSETS[symbolId] ?? {})
					.map((relativePath) => `${mountPrefix}assets/blacksite/${relativePath}`));
				return url.origin === origin &&
					allowedPaths.has(url.pathname) &&
					!LEGACY_ASSET_PATTERN.test(url.pathname);
			} catch {
				return false;
			}
		}),
		serialize(audit.boardSymbols),
	);
	const expectedAssets = [
		['operative image', audit.operative],
		['premium machine shell', audit.premiumMachine],
	];
	if (audit.background.exists) expectedAssets.push(['scene background image', audit.background]);
	if (requireVisibleSymbol || audit.symbolSheet.exists) {
		expectedAssets.push(['visible symbol-sheet image', audit.symbolSheet]);
	}
	check(
		group,
		'app shell has no runtime asset CSS variables',
		audit.appShell.environmentImageVariable === '' &&
			audit.appShell.symbolSheetVariable === '',
		serialize(audit.appShell),
	);
	const environmentPlates = [audit.background, audit.premiumMachine];
	const visibleEnvironmentPlates = environmentPlates.filter((asset) =>
		asset.display !== 'none' &&
		asset.visibility !== 'hidden' &&
		asset.opacity > 0 &&
		asset.width > 0 &&
		asset.height > 0
	);
	check(
		group,
		'exactly one decoded environment plate owns the visible modern scene while the retired backdrop stays absent',
		visibleEnvironmentPlates.length === 1 &&
			audit.background.exists === false &&
			audit.premiumMachine === visibleEnvironmentPlates[0] &&
			environmentPlates.filter(({ exists }) => exists).every((asset) =>
			asset.exists &&
			asset.tagName === 'IMG' &&
			asset.connected &&
			typeof asset.currentSrc === 'string' &&
			asset.currentSrc.length > 0 &&
			asset.source === asset.currentSrc &&
			asset.complete &&
			asset.decoded
		),
		serialize(environmentPlates),
	);
	const expectedMachineShell = machineShellForViewport(audit.viewport);
	let premiumShellPackaged = false;
	try {
		const premiumShellUrl = new URL(audit.premiumMachine.source);
		premiumShellPackaged = premiumShellUrl.origin === origin &&
			premiumShellUrl.pathname === `${mountPrefix}assets/blacksite/${expectedMachineShell.path}` &&
			premiumShellUrl.protocol !== 'file:';
	} catch {
		premiumShellPackaged = false;
	}
	check(
		group,
		`premium machine shell selects and decodes the exact ${expectedMachineShell.width}x${expectedMachineShell.height} viewport raster`,
		audit.premiumMachine.naturalWidth === expectedMachineShell.width &&
			audit.premiumMachine.naturalHeight === expectedMachineShell.height &&
			premiumShellPackaged,
		serialize({ viewport: audit.viewport, expectedMachineShell, actual: audit.premiumMachine }),
	);
	check(
		group,
		`${requireVisibleSymbol ? 'at least one visible' : 'a'} .symbol-art img is connected and decoded from currentSrc`,
		!requireVisibleSymbol || (
			audit.symbolSheet.exists &&
			audit.symbolSheet.tagName === 'IMG' &&
			audit.symbolSheet.connected &&
			typeof audit.symbolSheet.currentSrc === 'string' &&
			audit.symbolSheet.currentSrc.length > 0 &&
			audit.symbolSheet.source === audit.symbolSheet.currentSrc &&
			audit.symbolSheet.complete &&
			audit.symbolSheet.decoded &&
			audit.symbolSheet.display !== 'none' &&
			audit.symbolSheet.visibility !== 'hidden' &&
			audit.symbolSheet.opacity > 0 &&
			audit.symbolSheet.viewportVisible
		),
		serialize(audit.symbolSheet),
	);
	for (const [label, asset] of expectedAssets) {
		check(group, `${label} exposes a packaged URL`, typeof asset.source === 'string' && asset.source.length > 0, serialize(asset));
		check(group, `${label} completes and decodes`, asset.complete && asset.decoded && asset.naturalWidth > 0 && asset.naturalHeight > 0, serialize(asset));
		let packaged = false;
		try {
			const url = new URL(asset.source);
			packaged = url.origin === origin && url.pathname.startsWith(`${mountPrefix}assets/`);
		} catch {
			packaged = false;
		}
		check(group, `${label} resolves inside the nested package mount`, packaged, serialize({ source: asset.source, origin, mountPrefix }));
	}
}

async function collectPlayerVisibleSurface(page) {
	return page.evaluate(() => {
		const isVisible = (element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const attributes = [...document.querySelectorAll('*')]
			.filter(isVisible)
			.flatMap((element) =>
				[...element.attributes].flatMap(({ name: attribute, value: rawValue }) => {
					if (
						!attribute.startsWith('aria-') &&
						!['title', 'placeholder', 'alt'].includes(attribute)
					) {
						return [];
					}
					const value = rawValue.trim();
					return value ? [{ tag: element.tagName.toLowerCase(), attribute, value }] : [];
				}),
			);
		const visibleText = document.body.innerText;
		return {
			visibleText,
			attributes,
			combined: [visibleText, ...attributes.map(({ value }) => value)].join('\n'),
		};
	});
}

async function readyGuideSnapshot(page) {
	return page.evaluate((selectors) => {
			const visible = (element) => {
				if (!element) return false;
				const style = getComputedStyle(element);
				const bounds = element.getBoundingClientRect();
				return (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					Number(style.opacity) !== 0 &&
					bounds.width > 0 &&
					bounds.height > 0
				);
			};
			const board = document.querySelector(selectors.board);
			const cells = board ? [...board.querySelectorAll('[role="gridcell"]')] : [];
			const quickStartHud = document.querySelector(selectors.quickStartHud);
			const gameplayHint = document.querySelector(selectors.gameplayHint);
			const infoAction = document.querySelector(selectors.hudInfo);
			const statusPlate = document.querySelector(selectors.statusPlate);
			const resultTicker = document.querySelector(selectors.resultTicker);
			const finalWin = document.querySelector(selectors.finalWin);

			return {
				runtimeState:
					document.documentElement.dataset.runtimeState ??
					document.body.dataset.runtimeState ??
					null,
				legacyFieldBriefCount: document.querySelectorAll('[data-testid="field-brief"]').length,
				board: {
					exists: Boolean(board),
					visible: visible(board),
					authoritative: board?.getAttribute('data-authoritative') ?? null,
					paylineOverlayCount: document.querySelectorAll('.payline-overlay [data-line-id]').length,
					cells: cells.map((cell) => ({
						authoritative: cell.getAttribute('data-authoritative'),
						symbolId: cell.getAttribute('data-symbol-id'),
						lineActive: cell.getAttribute('data-line-active'),
						winningLines: cell.getAttribute('data-winning-lines'),
						visible: visible(cell),
					})),
				},
				quickStartHud: {
					exists: Boolean(quickStartHud),
					visible: visible(quickStartHud),
					text: quickStartHud?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
				},
				gameplayHint: gameplayHint?.textContent?.trim() ?? '',
				finalWin: finalWin?.textContent?.trim() ?? '',
				infoAction: {
					exists: Boolean(infoAction),
					visible: visible(infoAction),
					testId: infoAction?.getAttribute('data-testid') ?? null,
					ariaLabel: infoAction?.getAttribute('aria-label') ?? null,
				},
				legacyHowToPrimaryCount: [...document.querySelectorAll(selectors.legacyHowToPrimary)]
					.filter(visible).length,
				reelCaptionCount: [...document.querySelectorAll(selectors.reelCaption)]
					.filter(visible).length,
				statusPlate: {
					exists: Boolean(statusPlate),
					visible: visible(statusPlate),
					tagName: statusPlate?.tagName?.toLowerCase() ?? null,
					role: statusPlate?.getAttribute('role') ?? null,
					tabIndex: statusPlate?.getAttribute('tabindex') ?? null,
					text: statusPlate?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
				},
				resultTicker: {
					exists: Boolean(resultTicker),
					visible: visible(resultTicker),
					role: resultTicker?.getAttribute('role') ?? null,
					ariaLive: resultTicker?.getAttribute('aria-live') ?? null,
					priority: resultTicker?.getAttribute('data-ticker-priority') ?? null,
					text: resultTicker?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
				},
			};
		}, SELECTORS);
}

async function modalAccessibilitySnapshot(dialog) {
	return dialog.evaluate((dialogElement) => {
		const focusableSelector = [
			'a[href]',
			'button:not([disabled])',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'[tabindex]:not([tabindex="-1"])',
		].join(',');
		const visible = (element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
		};
		const describe = (element) => ({
			tag: element?.tagName?.toLowerCase() ?? null,
			id: element?.id || null,
			testId: element?.getAttribute?.('data-testid') ?? null,
			ariaLabel: element?.getAttribute?.('aria-label') ?? null,
			text: element?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? null,
		});
		let nativeModal = false;
		try {
			nativeModal = dialogElement.matches(':modal');
		} catch {
			nativeModal = false;
		}
		const dialogFocusable = [...dialogElement.querySelectorAll(focusableSelector)].filter(visible);
		const backgroundInteractive = [...document.querySelectorAll(focusableSelector)]
			.filter((element) => !dialogElement.contains(element) && visible(element));
		const backgroundUnisolated = backgroundInteractive.filter(
			(element) => !nativeModal && !element.closest('[inert]'),
		);
		return {
			ariaModal: dialogElement.getAttribute('aria-modal'),
			nativeModal,
			dialogInsideInertSubtree: Boolean(dialogElement.closest('[inert]')),
			activeInside: dialogElement.contains(document.activeElement),
			active: describe(document.activeElement),
			dialogFocusableCount: dialogFocusable.length,
			backgroundInteractiveCount: backgroundInteractive.length,
			backgroundUnisolated: backgroundUnisolated.map(describe),
		};
	});
}

async function auditModalAccessibility(page, dialog, group) {
	await page.waitForFunction(
		() => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
			.some((element) => element.contains(document.activeElement)),
		undefined,
		{ timeout: 3_000 },
	);
	const initial = await modalAccessibilitySnapshot(dialog);
	check(group, 'modal moves focus inside an aria-modal dialog', initial.ariaModal === 'true' && initial.activeInside, serialize(initial));
	check(group, 'modal has at least one keyboard-focusable control', initial.dialogFocusableCount > 0, serialize(initial));
	check(group, 'modal itself is outside every inert background subtree', !initial.dialogInsideInertSubtree, serialize(initial));
	check(group, 'visible background controls are inert while modal is open', initial.backgroundInteractiveCount > 0 && initial.backgroundUnisolated.length === 0, serialize(initial));

	const steps = Math.min(12, Math.max(3, initial.dialogFocusableCount + 2));
	const forward = [];
	for (let index = 0; index < steps; index += 1) {
		await page.keyboard.press('Tab');
		forward.push(await dialog.evaluate((element) => element.contains(document.activeElement)));
	}
	check(group, 'forward Tab traversal is trapped inside the modal', forward.every(Boolean), serialize(forward));

	const reverse = [];
	for (let index = 0; index < steps; index += 1) {
		await page.keyboard.press('Shift+Tab');
		reverse.push(await dialog.evaluate((element) => element.contains(document.activeElement)));
	}
	check(group, 'reverse Tab traversal is trapped inside the modal', reverse.every(Boolean), serialize(reverse));
	return { initial, forward, reverse };
}

async function assertDialogRaster(page, dialog, dialogKey, group, origin, mountPrefix = '/') {
	const fallback = DIALOG_ASSETS[dialogKey];
	check(
		group,
		`${dialogKey} dialog retains its declared fallback raster inside the exact production closure`,
		Boolean(fallback) && EXPECTED_RUNTIME_ASSET_PATHS.includes(productionAssetPath(fallback.path)),
		serialize({ dialogKey, fallback }),
	);
	const frames = dialog.locator('.premium-dialog-frame');
	check(group, `${dialogKey} dialog mounts exactly one premium frame carrier`, await frames.count() === 1, String(await frames.count()));
	const frame = frames.first();
	await frame.waitFor({ state: 'visible' });
	await dialog.locator('[data-testid="ui-v21-surface"][data-ui-kit="v27"][data-ui-primitive="panel"][data-ui-ready="true"]').first().waitFor({ state: 'attached' });
	await dialog.locator('[data-testid="ui-v21-surface"][data-ui-kit="v27"]:not([data-ui-primitive="panel"])[data-ui-ready="true"]').first().waitFor({ state: 'attached' });
	await dialog.evaluate((element) => new Promise((resolveReady, rejectReady) => {
		const surfaces = () => [...element.querySelectorAll('[data-testid="ui-v21-surface"][data-ui-kit="v27"]')];
		const complete = () => surfaces().length >= 2 && surfaces().every((surface) =>
			surface.getAttribute('data-ui-ready') === 'true' &&
			surface.getAttribute('data-ui-failed') === 'false',
		);
		if (complete()) {
			resolveReady();
			return;
		}
		const observer = new MutationObserver(() => {
			if (!complete()) return;
			clearTimeout(timer);
			observer.disconnect();
			resolveReady();
		});
		const timer = setTimeout(() => {
			observer.disconnect();
			rejectReady(new Error('V27 dialog surfaces did not become ready'));
		}, 5_000);
		observer.observe(element, { attributes: true, subtree: true, attributeFilter: ['data-ui-ready', 'data-ui-failed'] });
	}));
	const audit = await dialog.evaluate(async (element) => {
		const inspectSurface = async (surface) => {
			const source = surface.getAttribute('data-ui-source') || '';
			const probe = new Image();
			let decodeError = null;
			probe.src = source;
			try {
				await probe.decode();
			} catch (error) {
				decodeError = error instanceof Error ? error.message : String(error);
			}
			return {
				kit: surface.getAttribute('data-ui-kit'),
				primitive: surface.getAttribute('data-ui-primitive'),
				ready: surface.getAttribute('data-ui-ready'),
				failed: surface.getAttribute('data-ui-failed'),
				fallbackKind: surface.getAttribute('data-ui-fallback-kind'),
				source,
				frameCount: surface.querySelectorAll('.ui-surface__frame').length,
				decoded: decodeError === null && probe.complete && probe.naturalWidth > 0,
				decodeError,
				naturalWidth: probe.naturalWidth,
				naturalHeight: probe.naturalHeight,
			};
		};
		const surfaces = [...element.querySelectorAll('[data-testid="ui-v21-surface"]')];
		return {
			frameTagName: element.querySelector('.premium-dialog-frame')?.tagName ?? null,
			panel: await inspectSurface(surfaces.find((surface) =>
				surface.getAttribute('data-ui-kit') === 'v27' &&
				surface.getAttribute('data-ui-primitive') === 'panel',
			)),
			v27: await Promise.all(surfaces
				.filter((surface) =>
					surface.getAttribute('data-ui-kit') === 'v27' &&
					surface.getAttribute('data-ui-primitive') !== 'panel',
				)
				.map(inspectSurface)),
		};
	});
	const v22Panel = BLACKSITE_ASSETS.ui.v27.nineSlice.panel;
	const v27ByKind = BLACKSITE_ASSETS.ui.v27.nineSlice;
	const exactSurface = (surface, expected) => {
		if (!surface || !expected) return false;
		try {
			const url = new URL(surface.source, origin);
			const expectedSource = typeof expected.states?.idle === 'string'
				? expected.states.idle
				: expected.source;
			return url.origin === origin &&
				url.pathname === `${mountPrefix}${normalizedAssetPath(expectedSource)}` &&
				url.protocol !== 'file:' &&
				surface.ready === 'true' &&
				surface.failed === 'false' &&
				surface.frameCount === 1 &&
				surface.decoded &&
				surface.naturalWidth === expected.width &&
				surface.naturalHeight === expected.height;
		} catch {
			return false;
		}
	};
	check(
		group,
		`${dialogKey} dialog decodes its exact V22 960x640 panel carrier and current V27 semantic surfaces`,
		audit.frameTagName === 'DIV' &&
			audit.panel?.fallbackKind === 'explicit' &&
			exactSurface(audit.panel, v22Panel) &&
			audit.v27.length >= 1 &&
			audit.v27.every((surface) => exactSurface(
				surface,
				surface.primitive === 'round'
					? BLACKSITE_ASSETS.ui.v27.atlases.roundStates
					: v27ByKind[surface.primitive],
			)),
		serialize({ dialogKey, fallback, audit, origin, mountPrefix }),
	);
	return audit;
}

async function openModeSelection(page) {
	const opener = page.locator(SELECTORS.hudShop);
	const dialog = page.locator(SELECTORS.modeDialog);
	await opener.click();
	await dialog.waitFor({ state: 'visible' });
	return { opener, dialog };
}

async function closeModeSelection(page, dialog) {
	await page.keyboard.press('Escape');
	await dialog.waitFor({ state: 'detached' });
}

async function chooseModeFromDialog(page, selector) {
	const { dialog } = await openModeSelection(page);
	const mode = dialog.locator(selector);
	await mode.click();
	await dialog.waitFor({ state: 'detached' });
}

async function replayPresentationSnapshot(page) {
	return {
		runtimeState: await runtimeState(page),
		finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
		totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
		walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
		replayCard: await page.locator('.replay-card').count()
			? (await page.locator('.replay-card').innerText()).trim()
			: null,
		boardAuthoritative: await page.locator(SELECTORS.board).getAttribute('data-authoritative'),
		board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).evaluateAll((cells) =>
			cells.map((cell) => ({
				text: cell.innerText,
				ariaLabel: cell.getAttribute('aria-label'),
				className: cell.className,
				column: cell.getAttribute('data-column'),
				row: cell.getAttribute('data-row'),
				symbol: cell.getAttribute('data-symbol'),
				symbolId: cell.getAttribute('data-symbol-id'),
				authoritative: cell.getAttribute('data-authoritative'),
			}))),
		activePaylines: await page.locator('.payline-overlay img[data-line-id]').evaluateAll((lines) =>
			lines.map((line) => ({
				lineId: line.getAttribute('data-line-id'),
				source: line.currentSrc || line.src || null,
				complete: line.complete,
				naturalWidth: line.naturalWidth,
				naturalHeight: line.naturalHeight,
			}))),
	};
}

async function runScenario(name, execute) {
	const record = { name, status: 'RUNNING', screenshot: null, network: null, diagnostics: null };
	evidence.scenarios.push(record);
	try {
		await execute(record);
		record.status = 'PASS';
	} catch (error) {
		record.status = 'FAIL';
		record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
		if (!(error instanceof QaAssertionError)) recordFailure(name, error);
	}
}

async function runAudioDecodeScenario(browser, origin) {
	await runScenario('v29-curated-runtimepack-webaudio-decode', async (record) => {
		const group = 'v29-curated-runtimepack-webaudio-decode';
		const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
		try {
			const page = await context.newPage();
			await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 15_000 });
			const result = await page.evaluate(async ({ manifestPath, samples }) => {
				const ascii = (bytes, offset, length) => new TextDecoder('ascii').decode(
					bytes.subarray(offset, offset + length),
				);
				const containerSignature = (bytes) => {
					const head = ascii(bytes, 0, Math.min(bytes.length, 96));
					if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'RIFF/WAVE';
					if (ascii(bytes, 0, 4) === 'fLaC') return 'fLaC';
					if (ascii(bytes, 0, 4) === 'OggS' && head.includes('OpusHead')) return 'OggS/Opus';
					if (ascii(bytes, 0, 4) === 'OggS' && head.includes('vorbis')) return 'OggS/Vorbis';
					return head.slice(0, 16);
				};
				const sha256 = async (payload) => {
					const digest = await crypto.subtle.digest('SHA-256', payload);
					return [...new Uint8Array(digest)]
						.map((byte) => byte.toString(16).padStart(2, '0'))
						.join('');
				};

				const manifestResponse = await fetch(manifestPath, { cache: 'no-store' });
				const manifest = await manifestResponse.json();
				const manifestSummary = {
					statusCode: manifestResponse.status,
					contentType: manifestResponse.headers.get('content-type'),
					schema: manifest.schema,
					status: manifest.status,
					runtimeRoot: manifest.runtimeRoot,
					cueCount: manifest.cues?.length ?? null,
					fileCount: manifest.files?.length ?? null,
					sourceArchive: manifest.sourceArchive,
					budgets: manifest.budgets,
					typeCounts: manifest.typeCounts,
				};
				const AudioContextClass = window.AudioContext || window.webkitAudioContext;
				if (typeof AudioContextClass !== 'function') {
					return {
						manifest: manifestSummary,
						samples: samples.map(({ path }) => ({ path, error: 'AudioContext unavailable' })),
					};
				}
				const audioContext = new AudioContextClass();
				const audioContextSampleRate = audioContext.sampleRate;
				const decodedSamples = [];
				try {
					for (const expected of samples) {
						try {
							const response = await fetch(`/${expected.path}`, { cache: 'no-store' });
							const payload = await response.arrayBuffer();
							const bytes = new Uint8Array(payload);
							const decoded = await audioContext.decodeAudioData(payload.slice(0));
							const manifestFile = manifest.files?.find(({ path }) => path === expected.path) ?? null;
							const manifestCue = manifest.cues?.find(({ cueId }) => cueId === expected.cueId) ?? null;
							decodedSamples.push({
								path: expected.path,
								status: response.status,
								contentType: response.headers.get('content-type'),
								bytes: payload.byteLength,
								sha256: await sha256(payload),
								containerSignature: containerSignature(bytes),
								manifestFile: manifestFile && {
									path: manifestFile.path,
									sourceFile: manifestFile.sourceFile,
									bytes: manifestFile.bytes,
									sha256: manifestFile.sha256,
									codec: manifestFile.codec,
									sampleRateHz: manifestFile.sampleRateHz,
									channels: manifestFile.channels,
									durationMs: manifestFile.durationMs,
								},
								manifestCue: manifestCue && {
									cueId: manifestCue.cueId,
									sourceEvent: manifestCue.sourceEvent,
									runtimeFiles: manifestCue.runtimeFiles,
								},
								decoded: {
									duration: decoded.duration,
									sampleRate: decoded.sampleRate,
									channels: decoded.numberOfChannels,
								},
								audioContextSampleRate,
							});
						} catch (error) {
							decodedSamples.push({
								path: expected.path,
								error: error instanceof Error ? error.message : String(error),
							});
						}
					}
				} finally {
					await audioContext.close();
				}
				return { manifest: manifestSummary, samples: decodedSamples };
			}, {
				manifestPath: `/${productionAssetPath(BLACKSITE_AUDIO_V28_RUNTIME_MANIFEST)}`,
				samples: EXPECTED_V29_AUDIO_DECODE_SAMPLES,
			});
			record.audioDecode = result;
			const actualManifestFacts = {
				schema: result.manifest.schema,
				status: result.manifest.status,
				runtimeRoot: result.manifest.runtimeRoot,
				cueCount: result.manifest.cueCount,
				fileCount: result.manifest.fileCount,
				sourceArchive: result.manifest.sourceArchive,
				budgets: result.manifest.budgets,
				typeCounts: result.manifest.typeCounts,
			};
			check(
				group,
				'V29 runtime manifest is served as JSON and pins the curated source archive, budgets, 76 cues and 121 unique files',
				result.manifest.statusCode === 200 &&
					result.manifest.contentType?.startsWith('application/json') &&
					serialize(actualManifestFacts) === serialize(EXPECTED_V29_AUDIO_MANIFEST_FACTS),
				serialize({ actual: result.manifest, expected: EXPECTED_V29_AUDIO_MANIFEST_FACTS }),
			);
			check(
				group,
				'exact V29 WAV, OGG/Vorbis, Opus music and FLAC vault bytes match their manifest provenance and decode through WebAudio',
				result.samples.length === EXPECTED_V29_AUDIO_DECODE_SAMPLES.length &&
					result.samples.every((sample, index) => {
						const expected = EXPECTED_V29_AUDIO_DECODE_SAMPLES[index];
						const expectedManifestFile = {
							path: expected.path,
							sourceFile: expected.sourceFile,
							bytes: expected.bytes,
							sha256: expected.sha256,
							codec: expected.codec,
							sampleRateHz: expected.sampleRateHz,
							channels: expected.channels,
							durationMs: expected.durationMs,
						};
						const durationToleranceMs = Math.max(30, expected.durationMs * 0.005);
						return sample.path === expected.path &&
							sample.status === 200 &&
							sample.contentType?.startsWith(expected.contentType) &&
							sample.bytes === expected.bytes &&
							sample.sha256 === expected.sha256 &&
							sample.containerSignature === expected.containerSignature &&
							serialize(sample.manifestFile) === serialize(expectedManifestFile) &&
							sample.manifestCue?.cueId === expected.cueId &&
							sample.manifestCue?.sourceEvent === expected.sourceEvent &&
							sample.manifestCue?.runtimeFiles?.includes(expected.path) &&
							sample.decoded?.channels === expected.channels &&
							Number.isFinite(sample.decoded?.duration) &&
							Math.abs((sample.decoded.duration * 1_000) - expected.durationMs) <= durationToleranceMs &&
							Number.isFinite(sample.decoded?.sampleRate) &&
							sample.decoded.sampleRate > 0 &&
							Number.isFinite(sample.audioContextSampleRate) &&
							sample.audioContextSampleRate > 0 &&
							!sample.error;
					}),
				serialize({ actual: result.samples, expected: EXPECTED_V29_AUDIO_DECODE_SAMPLES }),
			);
		} finally {
			await context.close();
		}
	});
}

async function missionBriefingLockSnapshot(page) {
	return page.evaluate((selectors) => {
		const root = document.querySelector(selectors.bootSequence);
		const appShell = document.querySelector(selectors.appShell);
		const primary = document.querySelector(selectors.primaryAction);
		const briefing = document.querySelector(selectors.bootRulesScreen)
			?? document.querySelector(selectors.missionBriefing);
		const missionStart = document.querySelector(selectors.bootStartCard)
			?? document.querySelector(selectors.missionStart);
		const primaryBounds = primary?.getBoundingClientRect?.() ?? null;
		const briefingBounds = briefing?.getBoundingClientRect?.() ?? null;
		const missionStartBounds = missionStart?.getBoundingClientRect?.() ?? null;
		const hit = primaryBounds
			? document.elementFromPoint(
				primaryBounds.left + primaryBounds.width / 2,
				primaryBounds.top + primaryBounds.height / 2,
			)
			: null;
		const boundsInsideViewport = (bounds) => Boolean(
			bounds
			&& bounds.width > 0
			&& bounds.height > 0
			&& bounds.left >= -1
			&& bounds.top >= -1
			&& bounds.right <= innerWidth + 1
			&& bounds.bottom <= innerHeight + 1,
		);
		return {
			bootState: root?.getAttribute('data-boot-state') ?? null,
			introMode: root?.getAttribute('data-intro-mode') ?? null,
			appShellInert: Boolean(appShell?.hasAttribute('inert') && appShell.inert),
			appShellAriaHidden: appShell?.getAttribute('aria-hidden') ?? null,
			primaryDisabled: Boolean(primary?.disabled),
			primaryCenterHitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? null,
			primaryCenterInterceptedByBoot: Boolean(root && hit && root.contains(hit)),
			focusInsideBoot: Boolean(root && root.contains(document.activeElement)),
			missionStartFocused: document.activeElement === missionStart,
			briefingInsideViewport: boundsInsideViewport(briefingBounds),
			missionStartInsideViewport: boundsInsideViewport(missionStartBounds),
			missionStartWidth: missionStartBounds?.width ?? 0,
			missionStartHeight: missionStartBounds?.height ?? 0,
			documentScrollWidth: document.documentElement.scrollWidth,
			documentScrollHeight: document.documentElement.scrollHeight,
			viewportWidth: innerWidth,
			viewportHeight: innerHeight,
			primaryCenter: primaryBounds
				? {
					x: primaryBounds.left + primaryBounds.width / 2,
					y: primaryBounds.top + primaryBounds.height / 2,
				}
				: null,
		};
	}, {
		appShell: SELECTORS.appShell,
		bootSequence: SELECTORS.bootSequence,
		bootRulesScreen: SELECTORS.bootRulesScreen,
		bootStartCard: SELECTORS.bootStartCard,
		missionBriefing: SELECTORS.missionBriefing,
		missionStart: SELECTORS.missionStart,
		primaryAction: SELECTORS.primaryAction,
	});
}

async function runBootSequenceScenarios(browser, origin) {
	await runScenario('boot-v33-video-then-rules-screen-locks-game-until-start', async (record) => {
		const group = 'boot-v33-video-then-rules-screen-locks-game-until-start';
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			reducedMotion: 'no-preference',
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery(),
				{ startupFlow: 'observe', traceBoot: true },
			);
			await waitForEndpoint(network, 'authenticate', 1);
			const root = page.locator(SELECTORS.bootSequence);
			await root.waitFor({ state: 'visible', timeout: 10_000 });
			await page.locator(`${SELECTORS.bootSequence}[data-boot-state="INTRO_PLAYING"]`)
				.waitFor({ state: 'visible', timeout: 15_000 });

			const introLock = await missionBriefingLockSnapshot(page);
			const introVideo = page.locator(`${SELECTORS.bootIntro} video.intro-video`);
			await introVideo.waitFor({ state: 'visible', timeout: 10_000 });
			await page.waitForFunction(
				(selector) => {
					const video = document.querySelector(selector);
					return Boolean(video?.currentSrc?.includes('/assets/blacksite/v33/intro/blacksite-vault-opening-v33.mp4'));
				},
				`${SELECTORS.bootIntro} video.intro-video`,
				{ timeout: 10_000 },
			);
			const videoAudit = await introVideo.evaluate((video) => ({
				currentSrc: video.currentSrc,
				poster: video.poster,
				muted: video.muted,
				playsInline: video.playsInline,
				readyState: video.readyState,
			}));
			if (introLock.primaryCenter) {
				await page.mouse.click(introLock.primaryCenter.x, introLock.primaryCenter.y);
			}
			await page.waitForTimeout(120);
			check(
				group,
				'V33 intro mounts the supplied muted inline MP4 while the game remains fully inert',
				videoAudit.currentSrc.includes('/assets/blacksite/v33/intro/blacksite-vault-opening-v33.mp4')
					&& videoAudit.muted
					&& videoAudit.playsInline
					&& introLock.appShellInert
					&& introLock.appShellAriaHidden === 'true'
					&& introLock.primaryDisabled
					&& introLock.primaryCenterInterceptedByBoot,
				serialize({ videoAudit, introLock }),
			);
			check(
				group,
				'a pointer hit over the underlying Spin sends no paid-play write during the cinematic',
				network.byEndpoint.play.length === 0
					&& network.byEndpoint.endRound.length === 0
					&& network.byEndpoint.event.length === 0
					&& await root.getAttribute('data-boot-state') === 'INTRO_PLAYING',
				serialize(network.order),
			);

			const skip = page.locator(SELECTORS.bootIntroSkip);
			await skip.waitFor({ state: 'visible', timeout: 10_000 });
			await skip.click();
			const rulesScreen = page.locator(SELECTORS.bootRulesScreen);
			const startCard = page.locator(SELECTORS.bootStartCard);
			await rulesScreen.waitFor({ state: 'visible', timeout: 10_000 });
			await startCard.waitFor({ state: 'visible' });
			await page.waitForFunction(
				(selector) => {
					const image = document.querySelector(selector);
					return Boolean(
						image?.currentSrc?.includes('/assets/blacksite/v33/intro/blacksite-breach-start-screen-v33.webp')
						&& image.complete
						&& image.naturalWidth === 1672
						&& image.naturalHeight === 941
					);
				},
				SELECTORS.bootRulesImage,
				{ timeout: 10_000 },
			);
			await page.keyboard.press('Escape');
			const rulesLock = await missionBriefingLockSnapshot(page);
			const traceBeforeStart = await bootStateTrace(page);
			const rulesImageAudit = await page.locator(SELECTORS.bootRulesImage).evaluate((image) => ({
				currentSrc: image.currentSrc,
				naturalWidth: image.naturalWidth,
				naturalHeight: image.naturalHeight,
				complete: image.complete,
			}));
			check(
				group,
				'actual critical-asset progress is monotonic from 0 to 100 before the startup sequence',
				traceProgressIsMonotonic(traceBeforeStart),
				serialize(traceBeforeStart.progress),
			);
			check(
				group,
				'normal startup follows BOOT through the V33 video and then the mandatory rules screen',
				traceContainsStatesInOrder(traceBeforeStart, [
					'BOOT',
					'PRELOADING',
					'READY_FOR_INTRO',
					'INTRO_PLAYING',
					'MISSION_BRIEFING',
				])
					&& !traceBeforeStart.states.some(({ state }) => [
						'INTRO_UNAVAILABLE',
						'INTRO_ERROR',
						'ASSET_ERROR',
					].includes(state)),
				serialize(traceBeforeStart.states),
			);
			check(
				group,
				'the mandatory screen uses the packaged V33 start image at its authored 1672x941 resolution',
				rulesLock.introMode === 'video'
					&& rulesImageAudit.currentSrc.includes('/assets/blacksite/v33/intro/blacksite-breach-start-screen-v33.webp')
					&& rulesImageAudit.complete
					&& rulesImageAudit.naturalWidth === 1672
					&& rulesImageAudit.naturalHeight === 941,
				serialize({ rulesLock, rulesImageAudit }),
			);
			check(
				group,
				'the rules image remains modal on Escape, traps focus and keeps the full-image start target reachable',
				rulesLock.bootState === 'MISSION_BRIEFING'
					&& rulesLock.appShellInert
					&& rulesLock.focusInsideBoot
					&& rulesLock.missionStartFocused
					&& rulesLock.briefingInsideViewport
					&& rulesLock.missionStartInsideViewport
					&& rulesLock.missionStartWidth >= 44
					&& rulesLock.missionStartHeight >= 44
					&& rulesLock.documentScrollWidth <= rulesLock.viewportWidth + 1
					&& rulesLock.documentScrollHeight <= rulesLock.viewportHeight + 1,
				serialize(rulesLock),
			);
			record.rulesScreenshot = await saveScreenshot(page, `${group}-rules`);

			await startCard.click();
			await root.waitFor({ state: 'detached', timeout: 10_000 });
			await waitForStableAction(page);
			const traceAfterStart = await bootStateTrace(page);
			check(
				group,
				'the V33 start card is the only handoff through ENTERING_GAME to GAME_READY',
				traceContainsStatesInOrder(traceAfterStart, [
					'MISSION_BRIEFING',
					'ENTERING_GAME',
					'GAME_READY',
				])
					&& !(await page.locator(SELECTORS.primaryAction).isDisabled()),
				serialize(traceAfterStart.states),
			);
			check(
				group,
				'completing boot never sends a play, settlement or event write',
				network.byEndpoint.authenticate.length === 1
					&& network.byEndpoint.play.length === 0
					&& network.byEndpoint.endRound.length === 0
					&& network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.bootTrace = traceAfterStart;
			record.lockAudit = { intro: introLock, rules: rulesLock };
			record.videoAudit = videoAudit;
			record.rulesImageAudit = rulesImageAudit;
			record.screenshot = await saveScreenshot(page, `${group}-game-ready`);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('boot-info-reentry-remains-presentation-only', async (record) => {
		const group = 'boot-info-reentry-remains-presentation-only';
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			reducedMotion: 'no-preference',
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery(),
				{ startupFlow: 'standard', traceBoot: true },
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const root = page.locator(SELECTORS.bootSequence);

			await page.locator(SELECTORS.hudInfo).click();
			const guide = page.locator(SELECTORS.rulesDialog);
			await guide.waitFor({ state: 'visible' });
			const legacyIntroPreference = await page.evaluate(
				() => localStorage.getItem('blacksite_breach:intro-on-startup:v1'),
			);
			check(
				group,
				'normal startup does not seed the removed intro preference and Game Guide exposes no stale toggle',
				legacyIntroPreference === null
					&& await guide.locator('[data-testid="game-guide-intro-startup-toggle"]').count() === 0
					&& network.byEndpoint.play.length === 0,
				serialize({ legacyIntroPreference, order: network.order }),
			);

			const traceBeforeIntroReplay = await bootStateTrace(page);
			await guide.locator(SELECTORS.gameGuideReplayIntro).click();
			await guide.waitFor({ state: 'detached' });
			await page.locator(`${SELECTORS.bootSequence}[data-boot-state="INTRO_PLAYING"]`)
				.waitFor({ state: 'visible', timeout: 15_000 });
			await page.locator(`${SELECTORS.bootIntro} video.intro-video`).waitFor({ state: 'visible' });
			await page.locator(SELECTORS.bootIntroSkip).waitFor({ state: 'visible', timeout: 10_000 });
			await page.locator(SELECTORS.bootIntroSkip).click();
			await page.locator(SELECTORS.bootStartCard).waitFor({ state: 'visible', timeout: 10_000 });
			const traceAfterIntroReplay = await bootStateTrace(page);
			const introReplayTrace = {
				states: traceAfterIntroReplay.states.slice(traceBeforeIntroReplay.states.length),
				progress: [],
			};
			check(
				group,
				'Replay Intro replays the supplied V33 video and always returns to the mandatory start image',
				traceContainsStatesInOrder(introReplayTrace, [
					'READY_FOR_INTRO',
					'INTRO_PLAYING',
					'MISSION_BRIEFING',
				])
					&& !introReplayTrace.states.some(({ state }) => [
						'INTRO_UNAVAILABLE',
						'INTRO_ERROR',
					].includes(state))
					&& network.byEndpoint.play.length === 0,
				serialize(introReplayTrace.states),
			);
			await page.locator(SELECTORS.bootStartCard).click();
			await root.waitFor({ state: 'detached', timeout: 10_000 });
			await waitForStableAction(page);

			await page.locator(SELECTORS.hudInfo).click();
			await guide.waitFor({ state: 'visible' });
			const traceBeforeBriefingReplay = await bootStateTrace(page);
			await guide.locator(SELECTORS.gameGuideOpenBriefing).click();
			await guide.waitFor({ state: 'detached' });
			await page.locator(SELECTORS.missionBriefing).waitFor({ state: 'visible' });
			const traceAfterBriefingReplay = await bootStateTrace(page);
			const briefingReplayTrace = {
				states: traceAfterBriefingReplay.states.slice(traceBeforeBriefingReplay.states.length),
				progress: [],
			};
			check(
				group,
				'Open Mission Briefing re-enters briefing directly without replaying an intro or making a play',
				traceContainsStatesInOrder(briefingReplayTrace, ['MISSION_BRIEFING'])
					&& !briefingReplayTrace.states.some(({ state }) => state === 'INTRO_PLAYING')
					&& network.byEndpoint.play.length === 0,
				serialize(briefingReplayTrace.states),
			);
			await page.locator(SELECTORS.missionStart).click();
			await root.waitFor({ state: 'detached', timeout: 10_000 });
			await waitForStableAction(page);

			await page.locator(SELECTORS.hudSettings).click();
			const settings = page.locator(SELECTORS.settingsDialog);
			await settings.waitFor({ state: 'visible' });
			check(
				group,
				'Settings exposes no stale control that can disable the mandatory startup sequence',
				await settings.locator('[data-testid="settings-intro-startup-toggle"]').count() === 0
					&& await page.evaluate(
						() => localStorage.getItem('blacksite_breach:intro-on-startup:v1'),
					) === null,
				await settings.innerText(),
			);
			await page.keyboard.press('Escape');
			await settings.waitFor({ state: 'detached' });
			check(
				group,
				'all Info re-entry actions remain presentation-only',
				network.byEndpoint.authenticate.length === 1
					&& network.byEndpoint.play.length === 0
					&& network.byEndpoint.endRound.length === 0
					&& network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.bootTrace = await bootStateTrace(page);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('boot-reduced-motion-bypasses-video-but-keeps-mandatory-rules-screen', async (record) => {
		const group = 'boot-reduced-motion-bypasses-video-but-keeps-mandatory-rules-screen';
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
			reducedMotion: 'reduce',
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ device: 'mobile', lang: 'de' }),
				{ startupFlow: 'observe', traceBoot: true },
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.bootRulesScreen).waitFor({ state: 'visible', timeout: 15_000 });
			const root = page.locator(SELECTORS.bootSequence);
			const trace = await bootStateTrace(page);
			const reducedMotionAudit = await page.evaluate((selectors) => {
				const rootElement = document.querySelector(selectors.bootSequence);
				const backdrop = rootElement?.querySelector('.boot-backdrop img') ?? null;
				const video = rootElement?.querySelector('video') ?? null;
				const rulesImage = rootElement?.querySelector(selectors.bootRulesImage) ?? null;
				const startCard = rootElement?.querySelector(selectors.bootStartCard) ?? null;
				return {
					introMode: rootElement?.getAttribute('data-intro-mode') ?? null,
					backdropAnimationName: backdrop ? getComputedStyle(backdrop).animationName : null,
					videoCount: rootElement?.querySelectorAll('video').length ?? 0,
					videoPaused: video?.paused ?? null,
					skipCount: rootElement?.querySelectorAll(selectors.bootIntroSkip).length ?? 0,
					appShellInert: Boolean(document.querySelector(selectors.appShell)?.inert),
					startCardVisible: Boolean(startCard?.getClientRects().length),
					startCardAriaLabel: startCard?.getAttribute('aria-label') ?? null,
					rulesImageSrc: rulesImage?.currentSrc ?? null,
					rulesImageWidth: rulesImage?.naturalWidth ?? 0,
					rulesImageHeight: rulesImage?.naturalHeight ?? 0,
				};
			}, {
				appShell: SELECTORS.appShell,
				bootIntroSkip: SELECTORS.bootIntroSkip,
				bootSequence: SELECTORS.bootSequence,
				bootRulesImage: SELECTORS.bootRulesImage,
				bootStartCard: SELECTORS.bootStartCard,
			});
			check(
				group,
				'reduced motion preserves loading and READY_FOR_INTRO but bypasses all moving intro states',
				traceContainsStatesInOrder(trace, [
					'BOOT',
					'PRELOADING',
					'READY_FOR_INTRO',
					'MISSION_BRIEFING',
				])
					&& !trace.states.some(({ state }) => [
						'INTRO_PLAYING',
						'INTRO_UNAVAILABLE',
						'INTRO_ERROR',
					].includes(state)),
				serialize(trace.states),
			);
			check(
				group,
				'reduced motion mounts no video or Skip but still locks the game behind the packaged V33 rules image',
				reducedMotionAudit.introMode === 'video'
					&& reducedMotionAudit.backdropAnimationName === 'none'
					&& reducedMotionAudit.videoCount === 0
					&& reducedMotionAudit.skipCount === 0
					&& reducedMotionAudit.appShellInert
					&& reducedMotionAudit.startCardVisible
					&& reducedMotionAudit.rulesImageSrc.includes('/assets/blacksite/v33/intro/blacksite-breach-start-screen-v33.webp')
					&& reducedMotionAudit.rulesImageWidth === 1672
					&& reducedMotionAudit.rulesImageHeight === 941,
				serialize(reducedMotionAudit),
			);
			check(
				group,
				'German launch keeps a localized accessible start-card action around the authored image',
				reducedMotionAudit.startCardAriaLabel?.includes('MISSION STARTEN') === true,
				reducedMotionAudit.startCardAriaLabel,
			);
			record.rulesScreenshot = await saveScreenshot(page, `${group}-rules`);
			await page.locator(SELECTORS.bootStartCard).click();
			await root.waitFor({ state: 'detached', timeout: 10_000 });
			await waitForStableAction(page);
			const completedTrace = await bootStateTrace(page);
			check(
				group,
				'reduced-motion start card reaches GAME_READY without a paid-play write',
				traceContainsStatesInOrder(completedTrace, [
					'MISSION_BRIEFING',
					'ENTERING_GAME',
					'GAME_READY',
				])
					&& network.byEndpoint.play.length === 0
					&& network.byEndpoint.endRound.length === 0
					&& network.byEndpoint.event.length === 0,
				serialize({ states: completedTrace.states, order: network.order }),
			);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.bootTrace = completedTrace;
			record.reducedMotionAudit = reducedMotionAudit;
			record.screenshot = await saveScreenshot(page, `${group}-game-ready`);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('boot-v33-rules-screen-responsive-matrix', async (record) => {
		const group = 'boot-v33-rules-screen-responsive-matrix';
		const matrix = [
			{ name: 'desktop-1920x1080-en', width: 1920, height: 1080, language: 'en', device: 'desktop' },
			{ name: 'desktop-1440x900-de', width: 1440, height: 900, language: 'de', device: 'desktop' },
			{ name: 'tablet-768x1024-en', width: 768, height: 1024, language: 'en', device: 'mobile', isMobile: true, hasTouch: true },
			{ name: 'mobile-390x844-de', width: 390, height: 844, language: 'de', device: 'mobile', isMobile: true, hasTouch: true },
			{ name: 'mobile-landscape-844x390-en', width: 844, height: 390, language: 'en', device: 'mobile', isMobile: true, hasTouch: true },
		];
		record.matrix = [];
		record.screenshots = [];

		for (const viewport of matrix) {
			const viewportGroup = `${group}:${viewport.name}`;
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: viewport.isMobile ?? false,
				hasTouch: viewport.hasTouch ?? false,
				reducedMotion: 'reduce',
			});
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: { authenticate: () => authenticateResponse() },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					liveQuery({ device: viewport.device, lang: viewport.language }),
					{ startupFlow: 'observe', traceBoot: true },
				);
				await waitForEndpoint(network, 'authenticate', 1);
				const rulesScreen = page.locator(SELECTORS.bootRulesScreen);
				await rulesScreen.waitFor({ state: 'visible', timeout: 15_000 });
				await page.waitForFunction(
					(selector) => {
						const root = document.querySelector(selector);
						return Boolean(root && root.contains(document.activeElement));
					},
					SELECTORS.bootSequence,
					{ timeout: 5_000 },
				);

				const lockAudit = await missionBriefingLockSnapshot(page);
				const layoutAudit = await page.evaluate((selectors) => {
					const screen = document.querySelector(selectors.bootRulesScreen);
					const card = document.querySelector(selectors.bootStartCard);
					const image = document.querySelector(selectors.bootRulesImage);
					if (!screen || !card || !image) return null;
					const screenBounds = screen.getBoundingClientRect();
					const cardBounds = card.getBoundingClientRect();
					const imageBounds = image.getBoundingClientRect();
					const imageStyle = getComputedStyle(image);
					return {
						currentSrc: image.currentSrc,
						naturalWidth: image.naturalWidth,
						naturalHeight: image.naturalHeight,
						objectFit: imageStyle.objectFit,
						cardAspectRatio: cardBounds.width / cardBounds.height,
						cardAriaLabel: card.getAttribute('aria-label') ?? null,
						cardInsideScreen: cardBounds.left >= screenBounds.left - 1
							&& cardBounds.right <= screenBounds.right + 1
							&& cardBounds.top >= screenBounds.top - 1
							&& cardBounds.bottom <= screenBounds.bottom + 1,
						imageInsideCard: imageBounds.left >= cardBounds.left - 1
							&& imageBounds.right <= cardBounds.right + 1
							&& imageBounds.top >= cardBounds.top - 1
							&& imageBounds.bottom <= cardBounds.bottom + 1,
					};
				}, {
					bootRulesImage: SELECTORS.bootRulesImage,
					bootRulesScreen: SELECTORS.bootRulesScreen,
					bootStartCard: SELECTORS.bootStartCard,
				});
				const copyMatchesLanguage = viewport.language === 'de'
					? layoutAudit?.cardAriaLabel?.includes('MISSION STARTEN') === true
					: layoutAudit?.cardAriaLabel?.includes('MISSION START') === true;

				check(
					viewportGroup,
					'V33 rules screen and full-image start target remain fully inside the viewport',
					lockAudit.bootState === 'MISSION_BRIEFING'
						&& lockAudit.briefingInsideViewport
						&& lockAudit.missionStartInsideViewport
						&& lockAudit.missionStartWidth >= 44
						&& lockAudit.missionStartHeight >= 44,
					serialize(lockAudit),
				);
				check(
					viewportGroup,
					'boot overlay keeps the app inert, owns focus and prevents document horizontal overflow',
					lockAudit.appShellInert
						&& lockAudit.appShellAriaHidden === 'true'
						&& lockAudit.focusInsideBoot
						&& lockAudit.documentScrollWidth <= lockAudit.viewportWidth + 1,
					serialize(lockAudit),
				);
				check(
					viewportGroup,
					'authored 1672x941 V33 image is contained without cropping inside its matching-aspect start card',
					Boolean(layoutAudit
						&& layoutAudit.currentSrc.includes('/assets/blacksite/v33/intro/blacksite-breach-start-screen-v33.webp')
						&& layoutAudit.naturalWidth === 1672
						&& layoutAudit.naturalHeight === 941
						&& layoutAudit.objectFit === 'contain'
						&& Math.abs(layoutAudit.cardAspectRatio - (1672 / 941)) <= 0.02
						&& layoutAudit.cardInsideScreen
						&& layoutAudit.imageInsideCard),
					serialize(layoutAudit),
				);
				check(
					viewportGroup,
					`${viewport.language.toUpperCase()} accessible start-card action matches the requested launch language`,
					copyMatchesLanguage,
					layoutAudit?.cardAriaLabel,
				);

				const screenshot = await saveScreenshot(page, `${group}-${viewport.name}`);
				record.screenshots.push(screenshot);
				await page.locator(SELECTORS.bootStartCard).click();
				await page.locator(SELECTORS.bootSequence).waitFor({ state: 'detached', timeout: 10_000 });
				await waitForStableAction(page);
				const completedTrace = await bootStateTrace(page);
				check(
					viewportGroup,
					'V33 start card reaches GAME_READY without play, settlement or event writes',
					traceContainsStatesInOrder(completedTrace, [
						'MISSION_BRIEFING',
						'ENTERING_GAME',
						'GAME_READY',
					])
						&& network.byEndpoint.authenticate.length === 1
						&& network.byEndpoint.play.length === 0
						&& network.byEndpoint.endRound.length === 0
						&& network.byEndpoint.event.length === 0,
					serialize({ states: completedTrace.states, order: network.order }),
				);
				assertCleanNetwork(viewportGroup, network);
				await assertCleanDiagnostics(viewportGroup, diagnostics);
				record.matrix.push({
					viewport,
					lockAudit,
					layoutAudit,
					copyLanguage: viewport.language,
					screenshot,
					bootTrace: completedTrace,
					networkOrder: network.order,
				});
			} finally {
				await context.close();
			}
		}
		record.screenshot = record.screenshots.at(-1) ?? null;
	});
}

async function runNetworkScenarios(browser, origin) {
	await runScenario('stake-https-file-base-keeps-assets-on-package-origin', async (record) => {
		const group = 'stake-https-file-base-keeps-assets-on-package-origin';
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			reducedMotion: 'no-preference',
		});
		try {
			const stakeAuthenticateFixture = authenticateResponse();
			Reflect.deleteProperty(stakeAuthenticateFixture.config, 'betModes');
			const network = await installMockRgs(context, {
				pageOrigin: STAKE_FILE_BASE_ORIGIN,
				rgsOrigin: 'https://rgsd.stake-engine.com',
				handlers: {
					authenticate: () => stakeAuthenticateFixture,
					play: (request) =>
						playResponse({ amount: request.body.amount, mode: request.body.mode }),
				},
			});
			await installStakeFileBaseBuild(context);
			const { page, diagnostics } = await openPage(
				context,
				STAKE_FILE_BASE_ORIGIN,
				stakeFileBaseQuery(),
				{ path: STAKE_V5_PREFIX, mountPrefix: STAKE_V5_PREFIX },
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const actionBeforePlay = await page.locator(SELECTORS.primaryAction).evaluate((element) => ({
				disabled: element.disabled,
				label: element.textContent?.trim() ?? '',
			}));
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			const assetAudit = await collectSceneAssetAudit(page);
			const baseState = await page.evaluate(() => ({
				locationHref: location.href,
				locationProtocol: location.protocol,
				baseURI: document.baseURI,
				baseProtocol: new URL(document.baseURI).protocol,
				baseTagHref: document.querySelector('base')?.href ?? null,
				rgsUrl: new URL(location.href).searchParams.get('rgs_url'),
				runtimeState:
					document.documentElement.dataset.runtimeState ??
					document.body.dataset.runtimeState ??
					null,
			}));
			const documentResponse = diagnostics.sameOriginResponses.find(
				(response) => response.resourceType === 'document',
			);
			const fileAssetSources = [
				assetAudit.operative.source,
				...assetAudit.operativeFrames.map(({ source }) => source),
				assetAudit.background.source,
				assetAudit.premiumMachine.source,
				assetAudit.symbolSheet.source,
				...assetAudit.symbolMasters.map(({ source }) => source),
			].filter((source) => {
				try {
					return typeof source === 'string' && new URL(source).protocol === 'file:';
				} catch {
					return false;
				}
			});

			record.baseState = baseState;
			record.actionBeforePlay = actionBeforePlay;
			record.assets = assetAudit;
			record.authenticateFixture = stakeAuthenticateFixture;
			record.network = network;
			record.diagnostics = diagnostics;
			record.screenshot = await saveScreenshot(page, group);
			check(
				group,
				'fixture serves the final inline build from an HTTPS Stake v5 URL',
				baseState.locationProtocol === 'https:' &&
					documentResponse?.status === 200 &&
					new URL(documentResponse.url).pathname === STAKE_V5_PREFIX,
				serialize({ baseState, documentResponse }),
			);
			check(
				group,
				'fixture reproduces a foreign file base without changing the HTTPS document location',
				baseState.baseProtocol === 'file:' &&
					baseState.baseURI === STAKE_FILE_BASE_HREF &&
					baseState.baseTagHref === STAKE_FILE_BASE_HREF,
				serialize(baseState),
			);
			check(
				group,
				'fixture preserves the observed bare Stake rgs_url parameter',
				baseState.rgsUrl === 'rgsd.stake-engine.com',
				serialize(baseState),
			);
			check(
				group,
				'production-shaped Stake authenticate config omits betModes',
				!Object.hasOwn(stakeAuthenticateFixture.config, 'betModes'),
				serialize(stakeAuthenticateFixture.config),
			);
			check(
				group,
				'asset resolver ignores a foreign file base and emits no file URLs',
				fileAssetSources.length === 0 && diagnostics.localFileRequests.length === 0,
				serialize({ fileAssetSources, localFileRequests: diagnostics.localFileRequests }),
			);
			assertSceneAssetAudit(
				group,
				assetAudit,
				STAKE_FILE_BASE_ORIGIN,
				STAKE_V5_PREFIX,
				{ requireVisibleSymbol: true },
			);
			check(group, 'bare Stake RGS host authenticates exactly once', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check(
				group,
				'bare Stake RGS launch exposes an enabled Spin action',
				actionBeforePlay.disabled === false && /spin/i.test(actionBeforePlay.label),
				serialize(actionBeforePlay),
			);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'bare Stake RGS launch spins exactly once', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
		} finally {
			await context.close();
		}
	});

	await runScenario('nested-build-assets-and-scene-load', async (record) => {
		const group = 'nested-build-assets-and-scene-load';
		const viewport = {
			name: 'nested-desktop-1280x720',
			width: 1280,
			height: 720,
			minBoard: 240,
			expectPremiumShell: true,
			expectOperative: true,
		};
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery(),
				{ path: NESTED_BUILD_PREFIX, mountPrefix: NESTED_BUILD_PREFIX },
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const assetAudit = await collectSceneAssetAudit(page);
			const geometry = await geometryAudit(page);
			const documentResponse = diagnostics.sameOriginResponses.find(
				(response) => response.resourceType === 'document',
			);
			record.assets = assetAudit;
			record.geometry = geometry;
			record.network = network;
			record.diagnostics = diagnostics;
			check(
				group,
				'nested document is served successfully from the Stake package prefix',
				documentResponse?.status === 200 &&
					new URL(documentResponse.url).pathname === NESTED_BUILD_PREFIX,
				serialize(documentResponse),
			);
			assertSceneAssetAudit(group, assetAudit, origin, NESTED_BUILD_PREFIX);
			assertGeometryRecord(group, geometry, viewport, origin, NESTED_BUILD_PREFIX);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-rgs-url-fails-closed-before-network', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, { pageOrigin: origin });
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ rgs_url: 'ftp://not-a-valid-rgs-url' }),
			);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			await assertDialogRaster(page, page.locator(SELECTORS.launchError), 'runtimeError', 'invalid-rgs-url-fails-closed-before-network', origin);
			const errorFx = await standaloneFxSnapshot(page);
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url is visibly rejected', /rgs_url/i.test(errorText), errorText);
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url enters a bounded error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url produces zero RGS requests', rgsRequestCount(network) === 0 && network.preflights.length === 0, serialize(network));
			check('invalid-rgs-url-fails-closed-before-network', 'launch error keeps standalone FX idle and hidden', standaloneFxIsInactive(errorFx), serialize(errorFx));
			assertCleanNetwork('invalid-rgs-url-fails-closed-before-network', network);
			await assertCleanDiagnostics('invalid-rgs-url-fails-closed-before-network', diagnostics);
			record.screenshot = await saveScreenshot(page, 'invalid-rgs-url');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-session-auth-response-fails-closed', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						mockHttpResponse(401, {
							status: {
								statusCode: 'INVALID_SESSION',
								statusMessage: 'BLACKSITE QA invalid session',
							},
						}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const errorFx = await standaloneFxSnapshot(page);
			check('invalid-session-auth-response-fails-closed', 'invalid session response is visibly reported', errorText.trim().length > 0, errorText);
			check('invalid-session-auth-response-fails-closed', 'invalid session response enters an error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-session-auth-response-fails-closed', 'invalid session authenticates exactly once', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check('invalid-session-auth-response-fails-closed', 'invalid session sends zero play or settlement writes', network.byEndpoint.play.length === 0 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check('invalid-session-auth-response-fails-closed', 'authentication error keeps standalone FX idle and hidden', standaloneFxIsInactive(errorFx), serialize(errorFx));
			assertCleanNetwork('invalid-session-auth-response-fails-closed', network);
			await assertOnlyExpectedHttpDiagnostic('invalid-session-auth-response-fails-closed', diagnostics, 401);
			record.screenshot = await saveScreenshot(page, 'invalid-session-auth');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('rgs-err-ipb-after-auth-race-fails-closed', async (record) => {
		const group = 'rgs-err-ipb-after-auth-race-fails-closed';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => ({
						status: {
							statusCode: 'ERR_IPB',
							statusMessage: 'Authoritative balance changed before play.',
						},
					}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const beforeResultSurface = {
				board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts(),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
			};
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const boardText = await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts();
			const finalWin = (await page.locator(SELECTORS.finalWin).innerText()).trim();
			const errorFx = await standaloneFxSnapshot(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'ERR_IPB race is visibly reported after successful auth', /balance|authoritative|continue/i.test(errorText), errorText);
			check(group, 'ERR_IPB race reaches a fail-closed insufficient/error state', /insufficient|error/i.test(state ?? ''), serialize(state));
			check(group, 'ERR_IPB race sends exactly one play request', network.byEndpoint.play.length === 1, serialize(network.order));
			check(group, 'ERR_IPB race sends no settlement/event request', network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check(
				group,
				'ERR_IPB race keeps only the non-authoritative attract reels',
				boardText.length === 15 && await page.locator(SELECTORS.board).getAttribute('data-authoritative') === 'false',
				serialize(boardText),
			);
			check(group, 'ERR_IPB race exposes no invented final result', finalWin === '—', finalWin);
			check(group, 'ERR_IPB leaves the result surface byte-for-byte unchanged from pre-play', serialize({ board: boardText, finalWin }) === serialize(beforeResultSurface), serialize({ beforeResultSurface, afterResultSurface: { board: boardText, finalWin } }));
			check(group, 'ERR_IPB race disables further play until authoritative reauthentication', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			check(group, 'ERR_IPB network order is authenticate then one play', serialize(network.order) === serialize(['authenticate', 'play']), serialize(network.order));
			check(group, 'paid-play error cancels standalone FX and leaves no frame mounted', standaloneFxIsInactive(errorFx), serialize(errorFx));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'rgs-err-ipb-race');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('recoverable-auth-http-503-visible-no-fallback', async (record) => {
		const group = 'recoverable-auth-http-503-visible-no-fallback';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						mockHttpResponse(503, {
							error: {
								code: 'SERVICE_UNAVAILABLE',
								message: 'Authoritative service temporarily unavailable.',
							},
						}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const errorFx = await standaloneFxSnapshot(page);
			check(group, 'authenticate 503 is visible and bounded', errorText.trim().length > 0, errorText);
			check(group, 'authenticate 503 exits boot/auth/loading states', /error/i.test(state ?? '') && !/boot|authenticating|loading/i.test(state ?? ''), serialize(state));
			check(group, 'authenticate 503 performs exactly one auth request', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check(group, 'authenticate 503 sends no wallet play/settlement writes', network.byEndpoint.play.length === 0 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'authenticate 503 leaves primary action fail-closed', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			check(group, 'authenticate 503 exposes an explicit reload/restore control', await page.locator('[data-testid="recovery-action"]').isVisible(), await page.locator(SELECTORS.launchError).innerText());
			check(group, 'recoverable authentication error keeps standalone FX idle and hidden', standaloneFxIsInactive(errorFx), serialize(errorFx));
			assertCleanNetwork(group, network);
			await assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, 'recoverable-auth-503');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('uncertain-live-play-reloads-and-restores-without-retry', async (record) => {
		const group = 'uncertain-live-play-reloads-and-restores-without-retry';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? authenticateResponse()
							: authenticateResponse({
								round: authoritativeZeroRound({
									active: true,
									id: 'blacksite-qa-uncertain-play-restore',
									event: encodePresentationCursor(2),
								}),
							}),
					play: () =>
						mockHttpResponse(503, {
							error: {
								code: 'PLAY_STATUS_UNCERTAIN',
								message: 'Play status must be restored from the authoritative session.',
							},
						}),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible' });
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'uncertain Live play exposes explicit reload/restore without enabling Play', await recovery.isVisible() && await page.locator(SELECTORS.primaryAction).isDisabled(), serialize({ state: await runtimeState(page), order: network.order }));
			await Promise.all([
				page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
				recovery.click(),
			]);
			await completeStandardStartup(page);
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			check(group, 'reload authenticates and restores the authoritative active round', network.byEndpoint.authenticate.length === 2 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'recovery never retries the uncertain paid play', network.byEndpoint.play.length === 1, serialize(network.order));
			check(group, 'recovered round exposes its exact authoritative result', (await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00', await page.locator(SELECTORS.finalWin).innerText());
			check(group, 'uncertain play recovery order is authenticate, play, authenticate, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'authenticate', 'endRound']), serialize(network.order));
			assertCleanNetwork(group, network);
			await assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('recoverable-replay-http-503-visible-read-only', async (record) => {
		const group = 'recoverable-replay-http-503-visible-read-only';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: {
					replay: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.replay.length === 1
							? mockHttpResponse(503, {
								error: {
									code: 'SERVICE_UNAVAILABLE',
									message: 'Replay service temporarily unavailable.',
								},
							})
							: replayResponse(),
				},
			});
			const query = replayQuery({ event: 'recoverable-503' });
			const { page, diagnostics } = await openPage(context, origin, query);
			await waitForEndpoint(network, 'replay', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const replayRequest = network.byEndpoint.replay[0];
			check(group, 'Replay 503 is visible and bounded', errorText.trim().length > 0, errorText);
			check(group, 'Replay 503 exits loading into an error state', /error/i.test(state ?? '') && !/loading/i.test(state ?? ''), serialize(state));
			check(group, 'Replay 503 GET path is exact', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/recoverable-503`, replayRequest.path);
			check(group, 'Replay 503 GET remains queryless', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
			check(group, 'Replay 503 sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
			check(group, 'Replay 503 performs exactly one Replay request', network.byEndpoint.replay.length === 1, serialize(network.order));
			check(group, 'Replay 503 leaves primary action fail-closed', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'Replay 503 exposes an explicit reload/restore control', await recovery.isVisible() && !(await recovery.isDisabled()), await recovery.innerText());
			await Promise.all([
				page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }),
				recovery.click(),
			]);
			await completeStandardStartup(page);
			await waitForEndpoint(network, 'replay', 2);
			await waitForStableAction(page);
			check(group, 'Replay reload recovers to a playable read-only state', await runtimeState(page) === 'replay-ready' && !(await page.locator(SELECTORS.primaryAction).isDisabled()), await runtimeState(page));
			check(group, 'Replay recovery performs exactly one additional GET and zero writes', network.byEndpoint.replay.length === 2 && walletWriteCount(network) === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, 'recoverable-replay-503');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('authenticate-drives-levels-default-and-modes', async (record) => {
		const group = 'authenticate-drives-levels-default-and-modes';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const returnedLevels = [200_000, 700_000, 3_000_000];
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							betConfig: {
								minBet: 200_000,
								maxBet: 3_000_000,
								stepBet: 100_000,
								defaultBetLevel: 700_000,
								betLevels: returnedLevels,
							},
						}),
					play: (request) =>
						playResponse({ amount: request.body.amount, mode: request.body.mode }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const readyGuide = await readyGuideSnapshot(page);
			check(group, 'ready state is authoritative and playable before any local result is invented', readyGuide.runtimeState === 'live-ready', serialize(readyGuide));
			check(group, 'ready state contains no legacy Field Brief tutorial card', readyGuide.legacyFieldBriefCount === 0, serialize(readyGuide));
			check(
				group,
				'ready board exposes fifteen visible non-authoritative, non-winning cells',
				readyGuide.board.exists &&
					readyGuide.board.visible &&
					readyGuide.board.authoritative === 'false' &&
					readyGuide.board.cells.length === 15 &&
					readyGuide.board.cells.every(({ authoritative, lineActive, winningLines, visible }) =>
						authoritative === 'false' &&
						lineActive !== 'true' &&
						(winningLines === null || winningLines === '') &&
						visible) &&
					readyGuide.board.paylineOverlayCount === 0 &&
					['—', 'â€”'].includes(readyGuide.finalWin),
				serialize(readyGuide),
			);
			check(group, 'Quick Start HUD exposes ten lines, 3+ from left, WILD and VAULT', readyGuide.quickStartHud.exists && readyGuide.quickStartHud.visible && /10\s*FIXED LINES/iu.test(readyGuide.quickStartHud.text) && /3\+\s*FROM LEFT/iu.test(readyGuide.quickStartHud.text) && /WILD\s*SUBSTITUTES/iu.test(readyGuide.quickStartHud.text) && /0\/3\s*VAULT/iu.test(readyGuide.quickStartHud.text), serialize(readyGuide.quickStartHud));
			check(group, 'INFO is the one stable direct Game Guide entry', readyGuide.infoAction.exists && readyGuide.infoAction.visible && readyGuide.infoAction.testId === 'hud-info' && /(?:INFO|GAME GUIDE)/iu.test(readyGuide.infoAction.ariaLabel ?? ''), serialize(readyGuide.infoAction));
			check(group, 'ready layout has no separate HOW TO PLAY primary', readyGuide.legacyHowToPrimaryCount === 0, serialize(readyGuide));
			check(group, 'ready board has no visible symbol captions', readyGuide.reelCaptionCount === 0, serialize(readyGuide));
			check(
				group,
				'V36 exposes one visible passive status line and retires the duplicate plate',
				readyGuide.statusPlate.exists
					&& !readyGuide.statusPlate.visible
					&& readyGuide.statusPlate.tagName !== 'button'
					&& readyGuide.statusPlate.role !== 'button'
					&& readyGuide.statusPlate.tabIndex !== '0'
					&& readyGuide.resultTicker.exists
					&& readyGuide.resultTicker.visible
					&& readyGuide.resultTicker.role === 'status'
					&& readyGuide.resultTicker.ariaLive === 'polite'
					&& readyGuide.resultTicker.priority === 'false'
					&& /PRESS SPIN/iu.test(readyGuide.resultTicker.text),
				serialize({ statusPlate: readyGuide.statusPlate, resultTicker: readyGuide.resultTicker }),
			);
			check(group, 'ready guide causes no play before the explicit primary action', network.byEndpoint.play.length === 0, serialize(network.order));
			const selectSnapshot = await page.locator(SELECTORS.baseAmount).evaluate((element) => ({
				value: element.value,
				options: [...element.options].map((option) => option.value),
			}));
			check(group, 'select contains exactly the authenticate betLevels in returned order', serialize(selectSnapshot.options) === serialize(returnedLevels.map(String)), serialize(selectSnapshot));
			check(group, 'select uses authenticate defaultBetLevel', selectSnapshot.value === '700000', serialize(selectSnapshot));
			const { opener: modeOpener, dialog: modeDialog } = await openModeSelection(page);
			const modeSurfaces = {
				base: await modeDialog.locator(SELECTORS.modeBase).innerText(),
				deep_access: await modeDialog.locator(SELECTORS.modeDeepAccess).innerText(),
				blackout: await modeDialog.locator(SELECTORS.modeBlackout).innerText(),
			};
			for (const [modeId, cost] of Object.entries(MODE_COSTS)) {
				check(group, `${modeId} authenticate mode is selectable with ${cost}x cost`, modeSurfaces[modeId].includes(`${cost}×`) && !(await modeDialog.locator(SELECTORS[`mode${modeId === 'base' ? 'Base' : modeId === 'deep_access' ? 'DeepAccess' : 'Blackout'}`]).isDisabled()), modeSurfaces[modeId]);
			}
			await closeModeSelection(page, modeDialog);
			check(group, 'closing BUY mode selection restores focus to its HUD opener', await modeOpener.evaluate((element) => document.activeElement === element), SELECTORS.hudShop);
			await page.locator(SELECTORS.baseAmount).selectOption('3000000');
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			const playedPresentation = await replayPresentationSnapshot(page);
			const authoritativeBoard = BASE_ZERO_FIXTURE.book.events.find(({ type }) => type === 'spin_set').board;
			check(
				group,
				'first spin_set replaces attract cells with the exact authoritative 5x3 board',
				playedPresentation.boardAuthoritative === 'true' &&
					playedPresentation.board.length === 15 &&
					playedPresentation.board.every(({ column, row, symbolId, authoritative }) =>
						authoritative === 'true' &&
						symbolId === authoritativeBoard[Number(column)]?.[Number(row)]),
				serialize({ playedPresentation, authoritativeBoard }),
			);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: 3_000_000,
					mode: 'base',
				},
			});
			check(group, 'changed returned level produces exactly one play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'authenticate-dynamic-controls');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('bottom-hud-controls-are-hooked-functional-and-44px-ready', async (record) => {
		const group = 'bottom-hud-controls-are-hooked-functional-and-44px-ready';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse({ jurisdictionOverrides: { disabledAutoplay: false } }) },
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const hookSelectors = [
				SELECTORS.hudMenu,
				SELECTORS.hudShop,
				SELECTORS.hudAuto,
				SELECTORS.hudBetMinus,
				SELECTORS.hudBetPlus,
				SELECTORS.hudTurbo,
				SELECTORS.hudInfo,
				SELECTORS.hudSettings,
				SELECTORS.primaryAction,
			];
			for (const selector of hookSelectors) {
				check(group, `${selector} resolves to one visible Bottom HUD control`, await page.locator(selector).count() === 1 && await page.locator(selector).isVisible(), selector);
			}

			const initialAmount = await page.locator(SELECTORS.baseAmount).inputValue();
			await page.locator(SELECTORS.hudBetPlus).click();
			check(group, 'BET plus advances to the next authenticated level without a play', initialAmount === '1000000' && await page.locator(SELECTORS.baseAmount).inputValue() === '2000000' && network.byEndpoint.play.length === 0, serialize({ initialAmount, nextAmount: await page.locator(SELECTORS.baseAmount).inputValue() }));
			await page.locator(SELECTORS.hudBetMinus).click();
			check(group, 'BET minus restores the prior authenticated level without a play', await page.locator(SELECTORS.baseAmount).inputValue() === initialAmount && network.byEndpoint.play.length === 0, await page.locator(SELECTORS.baseAmount).inputValue());

			const turbo = page.locator(SELECTORS.hudTurbo);
			check(group, 'Turbo exposes an explicit off state', await turbo.getAttribute('aria-pressed') === 'false', await turbo.getAttribute('aria-pressed'));
			await turbo.click();
			check(group, 'Turbo toggles presentation only and performs no RGS write', await turbo.getAttribute('aria-pressed') === 'true' && network.byEndpoint.play.length === 0, serialize(network.order));

			const settings = page.locator(SELECTORS.hudSettings);
			await settings.click();
			const settingsDialog = page.locator(SELECTORS.settingsDialog);
			await settingsDialog.waitFor({ state: 'visible' });
			await assertDialogRaster(page, settingsDialog, 'settings', group, origin);
			await auditModalAccessibility(page, settingsDialog, group);
			const mute = settingsDialog.locator(SELECTORS.globalMute);
			check(group, 'Settings exposes exactly one global mute control', await mute.count() === 1 && await mute.isVisible(), String(await mute.count()));
			const muteBefore = await mute.getAttribute('aria-pressed');
			await mute.click();
			const muteAfter = await mute.getAttribute('aria-pressed');
			const audioMutedState = await page.locator('main.app-shell').getAttribute('data-audio-muted');
			check(
				group,
				'global mute toggles one observable game-owned audio state without an RGS write',
				muteBefore === 'true' &&
					muteAfter === 'false' &&
					audioMutedState === 'true' &&
					network.byEndpoint.play.length === 0,
				serialize({ muteBefore, muteAfter, audioMutedState, order: network.order }),
			);
			await page.keyboard.press('Escape');
			await settingsDialog.waitFor({ state: 'detached' });
			check(group, 'Settings Escape restores focus to the Bottom HUD settings control', await settings.evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));

			const menuOpener = page.locator(SELECTORS.hudMenu);
			await menuOpener.click();
			const menuDialog = page.locator(SELECTORS.menuDialog);
			await menuDialog.waitFor({ state: 'visible' });
			await assertDialogRaster(page, menuDialog, 'menu', group, origin);
			await auditModalAccessibility(page, menuDialog, group);
			const hubActions = [
				SELECTORS.operationsHubContinue,
				SELECTORS.operationsHubSelectMode,
				SELECTORS.operationsHubGameGuide,
			];
			check(group, 'Operations Hub contains exactly Continue, Select Mode and Game Guide actions', (await Promise.all(hubActions.map(async (selector) => await menuDialog.locator(selector).count() === 1 && await menuDialog.locator(selector).isVisible()))).every(Boolean) && !/SETTINGS|HOW TO PLAY/iu.test(await menuDialog.innerText()), await menuDialog.innerText());
			await menuDialog.locator(SELECTORS.operationsHubContinue).click();
			await menuDialog.waitFor({ state: 'detached' });
			check(group, 'Operations Hub Continue closes without a play and restores focus', network.byEndpoint.play.length === 0 && await menuOpener.evaluate((element) => document.activeElement === element), serialize(network.order));

			await menuOpener.click();
			await menuDialog.waitFor({ state: 'visible' });
			await menuDialog.locator(SELECTORS.operationsHubSelectMode).click();
			await menuDialog.waitFor({ state: 'detached' });
			const hubModeDialog = page.locator(SELECTORS.modeDialog);
			await hubModeDialog.waitFor({ state: 'visible' });
			const hubModeFingerprint = await hubModeDialog.locator('[data-testid^="mode-"]').evaluateAll((items) => items.map((item) => ({ testId: item.getAttribute('data-testid'), text: item.textContent?.trim().replace(/\s+/g, ' ') ?? '' })));
			await closeModeSelection(page, hubModeDialog);

			await menuOpener.click();
			await menuDialog.waitFor({ state: 'visible' });
			await menuDialog.locator(SELECTORS.operationsHubGameGuide).click();
			await menuDialog.waitFor({ state: 'detached' });
			const hubGuideDialog = page.locator(SELECTORS.rulesDialog);
			await hubGuideDialog.waitFor({ state: 'visible' });
			const hubGuideFingerprint = await hubGuideDialog.locator('[data-testid^="game-guide-tab-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')));
			await page.keyboard.press('Escape');
			await hubGuideDialog.waitFor({ state: 'detached' });

			const infoOpener = page.locator(SELECTORS.hudInfo);
			await infoOpener.click();
			const rulesDialog = page.locator(SELECTORS.rulesDialog);
			await rulesDialog.waitFor({ state: 'visible' });
			await assertDialogRaster(page, rulesDialog, 'rules', group, origin);
			const infoGuideFingerprint = await rulesDialog.locator('[data-testid^="game-guide-tab-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')));
			check(group, 'INFO and Operations Hub open the same five-tab Game Guide', serialize(infoGuideFingerprint) === serialize(hubGuideFingerprint) && serialize(infoGuideFingerprint) === serialize(['game-guide-tab-overview', 'game-guide-tab-symbols', 'game-guide-tab-modes', 'game-guide-tab-vault', 'game-guide-tab-controls']), serialize({ hubGuideFingerprint, infoGuideFingerprint }));
			await page.keyboard.press('Escape');
			await rulesDialog.waitFor({ state: 'detached' });
			check(group, 'INFO opens the Game Guide and restores focus on Escape', await infoOpener.evaluate((element) => document.activeElement === element), SELECTORS.hudInfo);

			const { opener: modeOpener, dialog: modeDialog } = await openModeSelection(page);
			await assertDialogRaster(page, modeDialog, 'mode', group, origin);
			const buyModeFingerprint = await modeDialog.locator('[data-testid^="mode-"]').evaluateAll((items) => items.map((item) => ({ testId: item.getAttribute('data-testid'), text: item.textContent?.trim().replace(/\s+/g, ' ') ?? '' })));
			check(group, 'BUY and Operations Hub Select Mode expose the same component/view model', serialize(buyModeFingerprint) === serialize(hubModeFingerprint), serialize({ hubModeFingerprint, buyModeFingerprint }));
			const modeModalAccessibility = await auditModalAccessibility(page, modeDialog, group);
			await modeDialog.locator(SELECTORS.modeBlackout).click();
			await modeDialog.waitFor({ state: 'detached' });
			check(group, 'BUY selects the canonical BLACKOUT mode without starting a play and restores focus', network.byEndpoint.play.length === 0 && await modeOpener.evaluate((element) => document.activeElement === element), serialize(network.order));
			const { dialog: selectedModeDialog } = await openModeSelection(page);
			check(group, 'reopened BUY marks BLACKOUT as the selected entry mode', await selectedModeDialog.locator(SELECTORS.modeBlackout).getAttribute('aria-pressed') === 'true', await selectedModeDialog.innerText());
			await closeModeSelection(page, selectedModeDialog);
			const autoOpener = page.locator(SELECTORS.hudAuto);
			check(group, 'Auto remains enabled when Stake jurisdiction permits autoplay', !(await autoOpener.isDisabled()), await autoOpener.evaluate((element) => element.outerHTML));
			await autoOpener.click();
			const autoDialog = page.locator(SELECTORS.autoDialog);
			await autoDialog.waitFor({ state: 'visible' });
			await assertDialogRaster(page, autoDialog, 'auto', group, origin);
			await auditModalAccessibility(page, autoDialog, group);
			await page.keyboard.press('Escape');
			await autoDialog.waitFor({ state: 'detached' });
			check(group, 'AUTO Escape restores focus to its Bottom HUD opener', await autoOpener.evaluate((element) => document.activeElement === element), SELECTORS.hudAuto);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
			record.modeModalAccessibility = modeModalAccessibility;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('authenticate-empty-levels-exposes-full-step-range', async (record) => {
		const group = 'authenticate-empty-levels-exposes-full-step-range';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							betConfig: {
								minBet: 200_000,
								maxBet: 1_000_000,
								stepBet: 100_000,
								defaultBetLevel: 700_000,
								betLevels: [],
							},
						}),
					play: (request) =>
						playResponse({ amount: request.body.amount, mode: request.body.mode }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const amountControl = page.locator(SELECTORS.baseAmount);
			const rangeSnapshot = await amountControl.evaluate((element) => ({
				type: element.type,
				min: element.min,
				max: element.max,
				step: element.step,
				value: element.value,
				ariaValueText: element.getAttribute('aria-valuetext'),
			}));
			check(
				group,
				'empty betLevels exposes the authoritative min/max/step range and default',
				serialize(rangeSnapshot) ===
					serialize({
						type: 'range',
						min: '200000',
						max: '1000000',
						step: '100000',
						value: '700000',
						ariaValueText: '$0.70',
					}),
				serialize(rangeSnapshot),
			);
			await amountControl.focus();
			await amountControl.press('ArrowLeft');
			await amountControl.press('ArrowLeft');
			const amountOutput = page.locator('.amount-range output');
			check(
				group,
				'keyboard-selected legal intermediate range value is displayed and announced exactly',
				(await amountOutput.innerText()).trim() === '$0.50' && await amountControl.getAttribute('aria-valuetext') === '$0.50',
				serialize({ output: await amountOutput.innerText(), ariaValueText: await amountControl.getAttribute('aria-valuetext') }),
			);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: 500_000,
					mode: 'base',
				},
			});
			check(group, 'range value produces exactly one play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'authenticate-empty-levels-range');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-language-live-falls-back-to-english', async (record) => {
		const group = 'invalid-language-live-falls-back-to-english';
		const viewport = {
			name: 'tablet-768x1024-invalid-language',
			width: 768,
			height: 1024,
			minBoard: 340,
		};
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ lang: '%%%invalid-language%%%', device: 'tablet' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: { sessionID: SESSION_ID, language: 'en' },
			});
			const bodyText = await page.locator('body').innerText();
			const state = await runtimeState(page);
			check(
				group,
				'invalid language resolves to ready English UI',
				state === 'live-ready' && /(?:MATCH\s+)?3\+\s+FROM(?:\s+THE)?\s+LEFT/iu.test(bodyText) && /SPIN/iu.test(bodyText),
				serialize({ state, bodyText }),
			);
			check(group, 'invalid language input is never reflected into visible UI', !bodyText.includes('invalid-language'), bodyText);
			check(group, 'invalid language fallback sends no play request', network.byEndpoint.play.length === 0, serialize(network.order));
			const audit = await geometryAudit(page);
			audit.name = viewport.name;
			audit.surface = 'live-invalid-language-fallback';
			audit.screenshot = await saveScreenshot(page, group);
			evidence.geometry.push(audit);
			assertGeometryRecord(group, audit, viewport, origin);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = audit.screenshot;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('jurisdiction-disables-space-and-feature-modes-only', async (record) => {
		const group = 'jurisdiction-disables-space-and-feature-modes-only';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: {
								disabledSpacebar: true,
								disabledBuyFeature: true,
							},
						}),
					play: () => playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const { dialog: modeDialog } = await openModeSelection(page);
			check(group, 'Base mode remains enabled by jurisdiction inside BUY', !(await modeDialog.locator(SELECTORS.modeBase).isDisabled()), await modeDialog.locator(SELECTORS.modeBase).innerText());
			check(group, 'DEEP ACCESS is hidden in BUY when feature actions are disabled', await modeDialog.locator(SELECTORS.modeDeepAccess).count() === 0, String(await modeDialog.locator(SELECTORS.modeDeepAccess).count()));
			check(group, 'BLACKOUT is hidden in BUY when feature actions are disabled', await modeDialog.locator(SELECTORS.modeBlackout).count() === 0, String(await modeDialog.locator(SELECTORS.modeBlackout).count()));
			await closeModeSelection(page, modeDialog);
			await page.evaluate(() => document.activeElement?.blur());
			await page.keyboard.press('Space');
			await page.waitForTimeout(200);
			check(group, 'disabledSpacebar produces zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			await chooseModeFromDialog(page, SELECTORS.modeBase);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'explicit Base click remains one legal play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'jurisdiction-space-feature-disabled');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('spacebar-one-base-play-and-blocked-space-zero', async (record) => {
		const group = 'spacebar-one-base-play-and-blocked-space-zero';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.hudInfo).click();
			await page.locator(SELECTORS.rulesDialog).waitFor({ state: 'visible' });
			await page.evaluate(() => document.activeElement?.blur());
			await page.keyboard.press('Space');
			await page.waitForTimeout(200);
			check(group, 'Space is blocked while Game Information is open', network.byEndpoint.play.length === 0, serialize(network.order));
			await page.getByRole('button', { name: /CLOSE/i }).click();
			await page.evaluate(() => document.activeElement?.blur());
			await waitForStableAction(page);
			await page.keyboard.press('Space');
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			await page.waitForTimeout(200);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'one legal Space press produces exactly one Base play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'spacebar-base-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	for (const { modeId, selector, cost } of [
		{ modeId: 'deep_access', selector: SELECTORS.modeDeepAccess, cost: 4 },
		{ modeId: 'blackout', selector: SELECTORS.modeBlackout, cost: 80 },
	]) {
		await runScenario(`high-cost-${modeId}-requires-confirmation`, async (record) => {
			const group = `high-cost-${modeId}-requires-confirmation`;
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: {
						authenticate: () => authenticateResponse(),
						play: (request) =>
							playResponse({ amount: request.body.amount, mode: request.body.mode }),
					},
				});
				const { page, diagnostics } = await openPage(context, origin, liveQuery());
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				await chooseModeFromDialog(page, selector);
				const exactTotal = (await page.locator(SELECTORS.totalPlay).innerText()).trim();

				await page.locator(SELECTORS.primaryAction).click();
				let dialog = page.locator(SELECTORS.confirmationDialog);
				await dialog.waitFor({ state: 'visible' });
				await assertDialogRaster(page, dialog, 'confirmation', group, origin);
				const modalAccessibility = await auditModalAccessibility(page, dialog, group);
				const firstDialogText = await dialog.innerText();
				check(group, 'first action opens confirmation before any play', network.byEndpoint.play.length === 0, serialize(network.order));
				const confirmation = {
					mode: (await dialog.locator(SELECTORS.confirmationMode).innerText()).trim(),
					base: (await dialog.locator(SELECTORS.confirmationBase).innerText()).trim(),
					multiplier: (await dialog.locator(SELECTORS.confirmationMultiplier).innerText()).trim(),
					total: (await dialog.locator(SELECTORS.confirmationTotal).innerText()).trim(),
					effect: (await dialog.locator(SELECTORS.confirmationEffect).innerText()).trim(),
					start: (await dialog.locator(SELECTORS.confirmationStart).innerText()).trim(),
				};
				check(group, 'confirmation names the selected mode', confirmation.mode.length > 0 && firstDialogText.includes(confirmation.mode), serialize(confirmation));
				check(group, 'confirmation shows the selected Base amount', confirmation.base.length > 0 && firstDialogText.includes(confirmation.base), serialize(confirmation));
				check(group, 'confirmation shows the exact complete play amount', exactTotal.length > 0 && confirmation.total === exactTotal, serialize({ exactTotal, confirmation }));
				check(group, `confirmation shows ${cost}x mode factor`, confirmation.multiplier.replace('×', 'x').includes(`${cost}x`), serialize(confirmation));
				check(group, 'confirmation describes the selected mode effect and uses START as the explicit second action', confirmation.effect.length > 0 && /START/iu.test(confirmation.start) && !/Confirm complete play amount/iu.test(firstDialogText), serialize(confirmation));
				await page.evaluate(() => document.activeElement?.blur());
				await page.keyboard.press('Space');
				await page.waitForTimeout(150);
				check(group, 'Space is blocked while confirmation is open', network.byEndpoint.play.length === 0, serialize(network.order));
				await dialog.getByRole('button', { name: /^CANCEL$/i }).click();
				await dialog.waitFor({ state: 'detached' });
				check(group, 'Cancel sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
				check(group, 'Cancel restores focus to the confirmation trigger', await page.locator(SELECTORS.primaryAction).evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));

				await waitForStableAction(page);
				await page.locator(SELECTORS.primaryAction).click();
				dialog = page.locator(SELECTORS.confirmationDialog);
				await dialog.waitFor({ state: 'visible' });
				await page.keyboard.press('Escape');
				await dialog.waitFor({ state: 'detached' });
				check(group, 'Escape sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
				check(group, 'Escape restores focus to the confirmation trigger', await page.locator(SELECTORS.primaryAction).evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));

				await waitForStableAction(page);
				await page.locator(SELECTORS.primaryAction).click();
				dialog = page.locator(SELECTORS.confirmationDialog);
				await dialog.waitFor({ state: 'visible' });
				await dialog.locator(SELECTORS.confirmationStart).click();
				await waitForEndpoint(network, 'play', 1);
				if (modeId === 'blackout') await returnFromExtraction(page);
				await waitForStableAction(page);
				assertExactRequest(group, network.byEndpoint.play[0], {
					method: 'POST',
					path: '/wallet/play',
					body: {
						sessionID: SESSION_ID,
						currency: 'USD',
						amount: DEFAULT_BASE_AMOUNT,
						mode: modeId,
					},
				});
				check(group, 'START sends exactly one correctly-modeled Base-amount play', network.byEndpoint.play.length === 1, serialize(network.order));
				assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
				record.modalAccessibility = modalAccessibility;
				record.screenshot = await saveScreenshot(page, `high-cost-${modeId}-confirmed`);
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('vault-cinematic-skip-is-presentation-only-and-settles-once', async (record) => {
		const group = 'vault-cinematic-skip-is-presentation-only-and-settles-once';
		const fixture = getGeneratedFixture('base_expanding_breach');
		const context = await browser.newContext({
			viewport: { width: 1280, height: 720 },
			reducedMotion: 'no-preference',
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponseFromFixture({ fixture }),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			// Capture the physical Vault Access state at normal cinematic speed.
			// Turbo intentionally compresses this state to a sub-frame-scale QA window
			// on busy hosts, which makes the screenshot timing nondeterministic.
			await beginVaultStateTrace(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			const cinematic = page.locator(SELECTORS.vaultCinematic);
			await cinematic.waitFor({ state: 'visible', timeout: 10_000 });
			await page.locator(`${SELECTORS.vaultCinematic}[data-vault-state="light-entry"]`).waitFor({ state: 'visible', timeout: 5_000 });
			record.vaultAccessScreenshot = await saveScreenshot(page, `${group}-light-entry`);
			const skip = page.locator(SELECTORS.vaultSkip);
			await skip.waitFor({ state: 'visible', timeout: 5_000 });
			const playCountBeforeSkip = network.byEndpoint.play.length;
			await skip.click();
			check(group, 'Skip changes presentation only and sends no second paid play', playCountBeforeSkip === 1 && network.byEndpoint.play.length === 1, serialize(network.order));
			const featureStart = fixture.book.events.find(({ type }) => type === 'feature_start');
			const expectedFreeSpins = featureStart?.total_free_spins;
			const expectedTarget = SYMBOL_DISPLAY_NAMES[featureStart?.target_symbol] ?? featureStart?.target_symbol?.toUpperCase();
			const award = page.locator(SELECTORS.vaultFreeSpinsAward);
			await award.waitFor({ state: 'visible', timeout: 5_000 });
			const awardCount = await page.locator(SELECTORS.vaultFreeSpinsCount).innerText();
			const awardTargetNode = page.locator(SELECTORS.vaultFreeSpinsTarget);
			const awardTarget = (await awardTargetNode.getAttribute('data-target-label')) ?? await awardTargetNode.innerText();
			const awardGeometry = await page.evaluate(({ awardSelector, countSelector, targetSelector }) => {
				const award = document.querySelector(awardSelector);
				const count = document.querySelector(countSelector);
				const target = document.querySelector(targetSelector);
				if (!award || !count || !target) return null;
				const rect = (element) => {
					const bounds = element.getBoundingClientRect();
					return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
				};
				const countBounds = rect(count);
				const targetBounds = rect(target);
				return {
					award: rect(award),
					count: countBounds,
					target: targetBounds,
					separated: countBounds.right <= targetBounds.left + 1 || targetBounds.right <= countBounds.left + 1,
					viewport: { width: innerWidth, height: innerHeight },
				};
			}, { awardSelector: SELECTORS.vaultFreeSpinsAward, countSelector: SELECTORS.vaultFreeSpinsCount, targetSelector: SELECTORS.vaultFreeSpinsTarget });
			check(group, 'award screen exposes the authoritative free-spin total', Number(awardCount.trim()) === expectedFreeSpins, serialize({ awardCount, expectedFreeSpins }));
			check(group, 'award screen exposes the authoritative expanding target', typeof expectedTarget === 'string' && awardTarget.toUpperCase().includes(expectedTarget.toUpperCase()), serialize({ awardTarget, expectedTarget }));
			check(group, 'award count and target are visually separated and remain inside the viewport', Boolean(awardGeometry && awardGeometry.separated && awardGeometry.award.left >= -1 && awardGeometry.award.top >= -1 && awardGeometry.award.right <= awardGeometry.viewport.width + 1 && awardGeometry.award.bottom <= awardGeometry.viewport.height + 1), serialize(awardGeometry));
			record.freeSpinsAwardScreenshot = await saveScreenshot(page, `${group}-free-spins-awarded`);
			const extraction = page.locator(SELECTORS.extractionReport);
			await extraction.waitFor({ state: 'visible', timeout: 30_000 });
			record.extractionScreenshot = await saveScreenshot(page, `${group}-extraction-report`);
			check(group, 'feature flow reaches a separate Extraction Report', await extraction.count() === 1, await cinematic.innerText());
			await page.locator(SELECTORS.returnToBase).click();
			await waitForEndpoint(network, 'endRound', 1, 15_000);
			await waitForRuntimeState(page, 'live-ready', 15_000);
			const trace = await finishVaultStateTrace(page);
			check(group, 'Vault trace contains trigger, light entry, award, BLACKOUT and extraction states', trace.includes('trigger-lock') && trace.includes('light-entry') && trace.includes('free-spins-awarded') && trace.includes('bonus-entry') && trace.includes('extraction-report'), serialize(trace));
			check(group, 'Return to Base sends no play and the authoritative round settles exactly once', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.trace = trace;
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	for (const viewport of [
		{ id: 'phone-390x844', width: 390, height: 844, device: 'mobile' },
		{ id: 'phone-320x568', width: 320, height: 568, device: 'mobile' },
		{ id: 'landscape-844x390', width: 844, height: 390, device: 'desktop' },
	]) {
		await runScenario(`vault-free-spins-award-responsive-${viewport.id}`, async (record) => {
			const group = `vault-free-spins-award-responsive-${viewport.id}`;
			const fixture = getGeneratedFixture('base_expanding_breach');
			const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'no-preference' });
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: {
						authenticate: () => authenticateResponse(),
						play: () => playResponseFromFixture({ fixture }),
						event: (request) => ({ event: request.body.event }),
						endRound: () => endRoundResponse(),
					},
				});
				const { page, diagnostics } = await openPage(context, origin, liveQuery({ device: viewport.device }));
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				await page.locator(SELECTORS.primaryAction).click();
				await waitForEndpoint(network, 'play', 1);
				const skip = page.locator(SELECTORS.vaultSkip);
				await skip.waitFor({ state: 'visible', timeout: 10_000 });
				await skip.click();
				const award = page.locator(SELECTORS.vaultFreeSpinsAward);
				await award.waitFor({ state: 'visible', timeout: 5_000 });
				const geometry = await page.evaluate(({ awardSelector, countSelector, targetSelector }) => {
					const award = document.querySelector(awardSelector);
					const count = document.querySelector(countSelector);
					const target = document.querySelector(targetSelector);
					if (!award || !count || !target) return null;
					const rect = (element) => {
						const bounds = element.getBoundingClientRect();
						return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
					};
					const countBounds = rect(count);
					const targetBounds = rect(target);
					return { award: rect(award), count: countBounds, target: targetBounds, separated: countBounds.right <= targetBounds.left + 1 || targetBounds.right <= countBounds.left + 1, viewport: { width: innerWidth, height: innerHeight } };
				}, { awardSelector: SELECTORS.vaultFreeSpinsAward, countSelector: SELECTORS.vaultFreeSpinsCount, targetSelector: SELECTORS.vaultFreeSpinsTarget });
				check(group, 'responsive award is visible, separated and fully inside the viewport', Boolean(geometry && geometry.separated && geometry.award.left >= -1 && geometry.award.top >= -1 && geometry.award.right <= geometry.viewport.width + 1 && geometry.award.bottom <= geometry.viewport.height + 1), serialize(geometry));
				check(group, 'responsive award sends no second paid play', network.byEndpoint.play.length === 1, serialize(network.order));
				record.awardScreenshot = await saveScreenshot(page, group);
				assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
				record.geometry = geometry;
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('vault-cinematic-replay-remains-read-only', async (record) => {
		const group = 'vault-cinematic-replay-remains-read-only';
		const fixture = getGeneratedFixture('base_expanding_breach');
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { replay: () => replayResponseFromFixture(fixture) },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				replayQuery({ mode: fixture.mode, event: 'vault-feature' }),
			);
			await waitForEndpoint(network, 'replay', 1);
			await waitForStableAction(page);
			await beginVaultStateTrace(page);
			await page.locator(SELECTORS.primaryAction).click();
			const cinematic = page.locator(SELECTORS.vaultCinematic);
			await cinematic.waitFor({ state: 'visible', timeout: 10_000 });
			const skip = page.locator(SELECTORS.vaultSkip);
			await skip.waitFor({ state: 'visible', timeout: 5_000 });
			await skip.click();
			await page.locator(SELECTORS.extractionReport).waitFor({ state: 'visible', timeout: 25_000 });
			await page.locator(SELECTORS.returnToBase).click();
			await waitForReplayComplete(page, 15_000);
			const trace = await finishVaultStateTrace(page);
			check(group, 'Replay cinematic uses the feature states but no wallet write', trace.includes('bonus-entry') && trace.includes('extraction-report') && walletWriteCount(network) === 0, serialize({ trace, order: network.order }));
			check(group, 'Replay payload is fetched exactly once across Skip and Return', network.byEndpoint.replay.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.trace = trace;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('missing-vault-scene-does-not-deadlock-settlement', async (record) => {
		const group = 'missing-vault-scene-does-not-deadlock-settlement';
		const fixture = getGeneratedFixture('base_expanding_breach');
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponseFromFixture({ fixture }),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			let blockedVaultSceneRequests = 0;
			await page.route(/\/assets\/blacksite\/v19\/scenes\/.*\.webp(?:\?.*)?$/iu, async (route) => {
				blockedVaultSceneRequests += 1;
				await route.abort('failed');
			});
			await page.locator(SELECTORS.hudTurbo).click();
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			const skip = page.locator(SELECTORS.vaultSkip);
			await skip.waitFor({ state: 'visible', timeout: 10_000 });
			await skip.click();
			await page.locator(SELECTORS.extractionReport).waitFor({ state: 'visible', timeout: 25_000 });
			await page.locator(SELECTORS.returnToBase).click();
			await waitForEndpoint(network, 'endRound', 1, 15_000);
			await waitForRuntimeState(page, 'live-ready', 15_000);
			check(group, 'the fixture actually exercised a missing V19 Vault scene request', blockedVaultSceneRequests > 0, serialize({ blockedVaultSceneRequests, failedRequests: diagnostics.failedRequests }));
			check(group, 'missing Vault art cannot create a second play or prevent one settlement', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			record.blockedVaultSceneRequests = blockedVaultSceneRequests;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('social-xsc-rules-paytable-and-terminology', async (record) => {
		const group = 'social-xsc-rules-paytable-and-terminology';
		const context = await browser.newContext({
			viewport: { width: 360, height: 740 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							currency: 'XSC',
							betConfig: { betLevels: [] },
							jurisdictionOverrides: { socialCasino: true },
						}),
				},
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ currency: 'XSC', social: 'true', lang: 'de', device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: { sessionID: SESSION_ID, language: 'de' },
			});
			const balanceText = (await page.locator(SELECTORS.walletBalance).innerText()).trim();
			const totalText = (await page.locator(SELECTORS.totalPlay).innerText()).trim();
			const socialRangeValueText = await page.locator(SELECTORS.baseAmount).getAttribute('aria-valuetext');
			check(group, 'XSC Balance is displayed as SC without a dollar prefix', balanceText.endsWith(' SC') && !balanceText.includes('$'), balanceText);
			check(group, 'XSC complete play amount is displayed as SC without a dollar prefix', totalText.endsWith(' SC') && !totalText.includes('$'), totalText);
			check(group, 'Social XSC range announces the exact SC value without a dollar prefix', socialRangeValueText === '1.00 SC' && !socialRangeValueText.includes('$'), socialRangeValueText);
			const { dialog: socialModeDialog } = await openModeSelection(page);
			check(group, 'Social Base mode uses STANDARD RUN label inside BUY', /STANDARD RUN/i.test(await socialModeDialog.locator(SELECTORS.modeBase).innerText()), await socialModeDialog.locator(SELECTORS.modeBase).innerText());
			check(group, 'Social Blackout mode uses BLACKOUT ENTRY label inside BUY', /BLACKOUT ENTRY/i.test(await socialModeDialog.locator(SELECTORS.modeBlackout).innerText()), await socialModeDialog.locator(SELECTORS.modeBlackout).innerText());
			await closeModeSelection(page, socialModeDialog);

			const infoAction = page.locator(SELECTORS.hudInfo);
			check(group, 'INFO Game Guide control exposes its stable test selector', await infoAction.count() === 1 && await infoAction.isVisible(), String(await infoAction.count()));
			await infoAction.click();
			const dialog = page.locator(SELECTORS.rulesDialog);
			await dialog.waitFor({ state: 'visible' });
			check(group, 'Game Guide stable selector resolves to the named modal dialog', await dialog.getAttribute('role') === 'dialog' && await dialog.getAttribute('aria-modal') === 'true', await dialog.evaluate((element) => element.outerHTML.slice(0, 500)));
			const modalAccessibility = await auditModalAccessibility(page, dialog, group);
			await page.keyboard.press('Escape');
			await dialog.waitFor({ state: 'detached' });
			check(group, 'Game Guide Escape restores focus to INFO', await infoAction.evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));
			await infoAction.click();
			await dialog.waitFor({ state: 'visible' });
			const tabs = [
				['overview', SELECTORS.gameGuideOverview],
				['symbols', SELECTORS.gameGuideSymbols],
				['modes', SELECTORS.gameGuideModes],
				['vault', SELECTORS.gameGuideVault],
				['controls', SELECTORS.gameGuideControls],
			];
			const guideText = {};
			for (const [name, selector] of tabs) {
				const tab = dialog.locator(selector);
				check(group, `Game Guide exposes the ${name} tab once`, await tab.count() === 1 && await tab.isVisible(), selector);
				await tab.click();
				const panels = dialog.locator(SELECTORS.rulesQuickStart);
				check(group, `${name} selects exactly one visible Game Guide panel`, await tab.getAttribute('aria-selected') === 'true' && await panels.count() === 1 && await panels.isVisible(), await dialog.innerText());
				guideText[name] = (await panels.innerText()).trim();
			}
			const completeGuideText = Object.values(guideText).join('\n');
			const normalizedGuideText = completeGuideText.replaceAll(',', '').replaceAll('×', 'x');
			check(group, 'Overview explains fixed lines and leftmost consecutive evaluation', /(?:10|ten)\s+(?:fixed\s+)?(?:pay)?lines/iu.test(guideText.overview) && /(?:3\+|consecutive).*left/isu.test(guideText.overview), guideText.overview);
			check(group, 'Symbols tab exposes all regular symbols, GHOST WILD and VAULT TRIGGER', Object.keys(SYMBOL_PAYOUTS).every((symbol) => guideText.symbols.toUpperCase().includes(SYMBOL_DISPLAY_NAMES[symbol])) && /GHOST WILD/iu.test(guideText.symbols) && /VAULT TRIGGER/iu.test(guideText.symbols), guideText.symbols);
			for (const length of LINE_LENGTHS) check(group, `Symbols tab exposes line length ${length.label}`, guideText.symbols.includes(length.label), guideText.symbols);
			check(group, 'Modes tab uses Social labels and exact authoritative costs', /STANDARD RUN/iu.test(guideText.modes) && /BLACKOUT ENTRY/iu.test(guideText.modes) && /1\s*[x×]/iu.test(guideText.modes) && /4\s*[x×]/iu.test(guideText.modes) && /80\s*[x×]/iu.test(guideText.modes), guideText.modes);
			check(group, 'Modes tab shows exact RTP and max win', guideText.modes.includes(`${(RULES_CONTRACT.targetRtp * 100).toFixed(2)}%`) && normalizedGuideText.includes(`${RULES_CONTRACT.maxWinRaw / 100}x`), guideText.modes);
			check(group, 'BLACKOUT tab freezes VAULT trigger isolation, eight spins, expansion and no retrigger', /BLACKOUT/iu.test(guideText.vault) && /VAULT/iu.test(guideText.vault) && /(?:exactly\s+)?eight|8\s+free spins/iu.test(guideText.vault) && /expan/iu.test(guideText.vault) && /(?:cannot|no)\s+retrigger/iu.test(guideText.vault), guideText.vault);
			check(group, 'Controls tab includes the complete Social disclaimer', guideText.controls.includes(getRulesDisclaimer(true)), guideText.controls);
			const guideScroll = dialog.locator(SELECTORS.gameGuideScroll);
			const guideScrollGeometry = await guideScroll.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
			check(group, 'Game Guide owns exactly one internal scroll container with no horizontal overflow', await guideScroll.count() === 1 && guideScrollGeometry.scrollWidth <= guideScrollGeometry.clientWidth + 1, serialize(guideScrollGeometry));

			const rulesGeometry = await page.evaluate((selectors) => {
				const dialogElement = document.querySelector(selectors.rulesDialog);
				const close = dialogElement?.querySelector(selectors.rulesClose);
				const documentElement = document.documentElement;
				const rect = (element) => {
					const bounds = element?.getBoundingClientRect();
					return bounds
						? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height }
						: null;
				};
				return {
					dialog: rect(dialogElement),
					close: rect(close),
					documentHasHorizontalScroll: documentElement.scrollWidth > innerWidth + 1,
					documentHasVerticalScroll: documentElement.scrollHeight > innerHeight + 1,
				};
			}, SELECTORS);
			check(group, 'mobile Rules dialog remains fully inside the viewport', Boolean(rulesGeometry.dialog && rulesGeometry.dialog.left >= -0.5 && rulesGeometry.dialog.top >= -0.5 && rulesGeometry.dialog.right <= 360.5 && rulesGeometry.dialog.bottom <= 740.5), serialize(rulesGeometry));
			check(group, 'mobile Rules close control is at least 44x44 CSS pixels', Boolean(rulesGeometry.close && rulesGeometry.close.width >= 44 && rulesGeometry.close.height >= 44), serialize(rulesGeometry.close));
			check(group, 'mobile Rules do not make the document scroll', !rulesGeometry.documentHasHorizontalScroll && !rulesGeometry.documentHasVerticalScroll, serialize(rulesGeometry));

			const surface = await collectPlayerVisibleSurface(page);
			const restrictedHits = playerVisibleRestrictedHits(surface.combined);
			check(group, 'complete visible DOM and visible ARIA surface has zero official Social restricted hits', restrictedHits.length === 0, serialize({ hits: restrictedHits, attributes: surface.attributes }));
			check(group, 'Social HUD and Game Guide use PLAY AMOUNT, TOTAL PLAY and RESULTS terminology', /PLAY AMOUNT/iu.test(surface.combined) && /TOTAL PLAY/iu.test(surface.combined) && /RESULTS/iu.test(surface.combined), surface.combined);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.surface = surface;
			record.rulesGeometry = rulesGeometry;
			record.modalAccessibility = modalAccessibility;
			record.screenshot = await saveScreenshot(page, 'social-xsc-rules');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('live-auth-exact', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const expectedAuth = { sessionID: SESSION_ID, language: 'en' };
			assertExactRequest('live-auth-exact', network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: expectedAuth,
			});
			check('live-auth-exact', 'authenticate happens exactly once', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check('live-auth-exact', 'no play occurs before user action', network.byEndpoint.play.length === 0, serialize(network.order));
			check('live-auth-exact', 'request order is authenticate only', serialize(network.order) === serialize(['authenticate']), serialize(network.order));
			assertCleanNetwork('live-auth-exact', network);
			record.screenshot = await saveScreenshot(page, 'live-auth-exact');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('minimum-round-duration-hides-result-until-ready', async (record) => {
		const group = 'minimum-round-duration-hides-result-until-ready';
		const minimumRoundDurationMs = 400;
		const lowerBoundToleranceMs = 50;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: { minimumRoundDuration: minimumRoundDurationMs },
						}),
					play: async () => {
						await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
						return playResponse({ active: false });
					},
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const readyBeforePlay = {
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
			};
			check(group, 'live ready surface has no result before a completed round', readyBeforePlay.runtimeState === 'live-ready' && readyBeforePlay.finalWin === '—', serialize(readyBeforePlay));

			const startedAtMs = Date.now();
			await page.locator(SELECTORS.primaryAction).click();
			const immediate = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts(),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
				boardAuthoritative: await page.locator(SELECTORS.board).getAttribute('data-authoritative'),
			};
			check(group, 'immediately after Play the result remains hidden behind non-authoritative attract reels', immediate.finalWin === '—' && immediate.boardAuthoritative === 'false', serialize(immediate));
			check(group, 'immediately after Play the round is not ready and cannot be replayed', immediate.runtimeState !== 'live-ready' && immediate.actionDisabled, serialize(immediate));

			await waitForEndpoint(network, 'play', 1);
			await waitForRuntimeState(page, 'live-minimum-duration');
			const held = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts(),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
				boardAuthoritative: await page.locator(SELECTORS.board).getAttribute('data-authoritative'),
			};
			check(group, 'minimum-duration hold exposes neither result nor authoritative outcome board', held.runtimeState === 'live-minimum-duration' && held.finalWin === '—' && held.boardAuthoritative === 'false' && held.actionDisabled, serialize(held));

			await waitForStableAction(page);
			const completed = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts(),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
				boardAuthoritative: await page.locator(SELECTORS.board).getAttribute('data-authoritative'),
			};
			check(group, 'round cannot become ready before the configured minimum duration', completed.elapsedMs >= minimumRoundDurationMs - lowerBoundToleranceMs, serialize({ minimumRoundDurationMs, lowerBoundToleranceMs, completed }));
			check(group, 'completed live round exposes the exact authoritative result, board, and ready action', completed.runtimeState === 'live-ready' && completed.finalWin === '$0.00' && completed.boardAuthoritative === 'true' && completed.board.some((cell) => !cell.includes('--')) && !completed.actionDisabled, serialize(completed));
			check(group, 'minimum-duration round sends exactly one play and no end-round write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.timing = { minimumRoundDurationMs, lowerBoundToleranceMs, readyBeforePlay, immediate, held, completed };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('session-position-and-timer-follow-authoritative-balance', async (record) => {
		const group = 'session-position-and-timer-follow-authoritative-balance';
		const authoritativePostPlayBalance = DEFAULT_BALANCE - 7 * API_UNIT;
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: {
								displayNetPosition: true,
								displaySessionTimer: true,
							},
						}),
					play: () =>
						playResponse({
							active: false,
							balanceBefore: authoritativePostPlayBalance + DEFAULT_BASE_AMOUNT,
						}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery({ device: 'mobile' }));
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.sessionNetPosition).waitFor({ state: 'visible' });
			await page.locator(SELECTORS.sessionTimer).waitFor({ state: 'visible' });
			const initialUi = {
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				sessionTimer: (await page.locator(SELECTORS.sessionTimer).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
			};
			check(group, 'enabled session position and timer are both visible at 390×844 mobile', await page.locator(SELECTORS.sessionNetPosition).isVisible() && await page.locator(SELECTORS.sessionTimer).isVisible(), serialize(initialUi));
			check(group, 'session position opens at exact zero from authenticated balance', initialUi.netPosition === '$0.00', serialize(initialUi));
			check(group, 'session timer uses a bounded minutes-and-seconds display', /^\d{2}:\d{2}$/.test(initialUi.sessionTimer), serialize(initialUi));

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			const updatedUi = {
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				sessionTimer: (await page.locator(SELECTORS.sessionTimer).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
			};
			check(group, 'session position reports authoritative total wagered minus total won', updatedUi.netPosition === '+$7.00' && updatedUi.walletBalance === '$993.00', serialize({ authoritativePostPlayBalance, initialUi, updatedUi }));
			check(group, 'session timer remains visible and well-formed after play', await page.locator(SELECTORS.sessionTimer).isVisible() && /^\d{2}:\d{2}$/.test(updatedUi.sessionTimer), serialize(updatedUi));
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'session UI scenario sends exactly one play and no end-round write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.sessionUi = { authoritativePostPlayBalance, initialUi, updatedUi };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('inactive-zero-play', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse({ active: false }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			await page.waitForTimeout(250);
			assertExactRequest('inactive-zero-play', network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check('inactive-zero-play', 'one play request is sent', network.byEndpoint.play.length === 1, serialize(network.order));
			check('inactive-zero-play', 'inactive zero round sends no end-round', network.byEndpoint.endRound.length === 0, serialize(network.order));
			check('inactive-zero-play', 'order is authenticate then play', serialize(network.order) === serialize(['authenticate', 'play']), serialize(network.order));
			assertCleanNetwork('inactive-zero-play', network);
			record.screenshot = await saveScreenshot(page, 'inactive-zero-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('active-play-settles-once', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse({ active: true }),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForStableAction(page);
			await page.waitForTimeout(200);
			assertExactRequest('active-play-settles-once', network.byEndpoint.endRound[0], {
				method: 'POST',
				path: '/wallet/end-round',
				body: { sessionID: SESSION_ID },
			});
			assertExactRequest('active-play-settles-once', network.byEndpoint.event[0], {
				method: 'POST',
				path: '/bet/event',
				body: {
					sessionID: SESSION_ID,
					event: encodePresentationCursor(2),
				},
			});
			check('active-play-settles-once', 'play occurs once', network.byEndpoint.play.length === 1, serialize(network.order));
			check('active-play-settles-once', 'durable board checkpoint is persisted exactly once', network.byEndpoint.event.length === 1, serialize(network.order));
			check('active-play-settles-once', 'end-round occurs exactly once', network.byEndpoint.endRound.length === 1, serialize(network.order));
			check('active-play-settles-once', 'order is authenticate, play, checkpoint, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound']), serialize(network.order));
			assertCleanNetwork('active-play-settles-once', network);
			record.screenshot = await saveScreenshot(page, 'active-play-settles-once');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('live-zero-streak-screen-impact-post-settlement', async (record) => {
		const group = 'live-zero-streak-screen-impact-post-settlement';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		let releaseSixthEndRound = () => {};
		const sixthEndRoundGate = new Promise((resolvePromise) => {
			releaseSixthEndRound = resolvePromise;
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: (_request, networkEvidence) => playResponse({
						active: true,
						id: `blacksite-qa-zero-streak-${networkEvidence.byEndpoint.play.length}`,
					}),
					event: (request) => ({ event: request.body.event }),
					endRound: async (_request, networkEvidence) => {
						if (networkEvidence.byEndpoint.endRound.length === 6) {
							await sixthEndRoundGate;
						}
						return endRoundResponse();
					},
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.hudSettings).click();
			const settingsDialog = page.locator(SELECTORS.settingsDialog);
			await settingsDialog.waitFor({ state: 'visible' });
			await settingsDialog.locator(SELECTORS.rageOut).click();
			check(
				group,
				'Rage Out is explicitly opted in for this settlement-order scenario',
				await settingsDialog.locator(SELECTORS.rageOut).getAttribute('aria-pressed') === 'true',
				await settingsDialog.innerText(),
			);
			await page.keyboard.press('Escape');
			await settingsDialog.waitFor({ state: 'detached' });

			for (let zeroStreak = 1; zeroStreak <= 5; zeroStreak += 1) {
				await page.locator(SELECTORS.primaryAction).click();
				await waitForEndpoint(network, 'endRound', zeroStreak);
				await page.waitForFunction(
					({ selector, expected }) =>
						document.querySelector(selector)?.getAttribute('data-zero-streak') === String(expected),
					{ selector: SELECTORS.operative, expected: zeroStreak },
					{ timeout: 10_000 },
				);
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('data-sequence') === 'idle',
					SELECTORS.operative,
					{ timeout: 4_000 },
				);
				await waitForStableAction(page);
				const interimFx = await standaloneFxSnapshot(page);
				check(
					group,
					`finalized zero round ${zeroStreak} does not trigger screen impact early`,
					standaloneFxIsInactive(interimFx),
					serialize(interimFx),
				);
			}

			await beginStandaloneFxTrace(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'endRound', 6);
			await page.waitForTimeout(150);
			const blockedFx = await standaloneFxSnapshot(page);
			const blockedZeroStreak = await page.locator(SELECTORS.operative).getAttribute('data-zero-streak');
			const preSettlementFxStarts = await page.evaluate(() =>
				globalThis.__blacksiteStandaloneFxTrace?.activationCounts?.screenImpact ?? 0,
			);
			check(
				group,
				'sixth zero result remains visually hidden while end-round authority is pending',
				blockedZeroStreak === '5' && preSettlementFxStarts === 0 && standaloneFxIsInactive(blockedFx),
				serialize({ blockedZeroStreak, preSettlementFxStarts, blockedFx }),
			);

			releaseSixthEndRound();
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-zero-streak') === '6',
				SELECTORS.operative,
				{ timeout: 10_000 },
			);
			await waitForStandaloneFxActivation(page, 'screenImpact', 4_000);
			await page.waitForTimeout(80);
			const settledFxAudit = await collectSceneAssetAudit(page);
			assertStandaloneFxAssetAudit(group, settledFxAudit, origin, '/');
			const fxTrace = await standaloneFxTrace(page);
			assertStandaloneFxTraceClean(group, fxTrace);
			check(
				group,
				'sixth finalized live zero starts screenImpact exactly once only after end-round resolves',
				fxTrace?.activationCounts?.screenImpact === 1 &&
					fxTrace.activations.length === 1 &&
					network.byEndpoint.endRound.length === 6,
				serialize({ fxTrace, networkOrder: network.order }),
			);
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.fxTrace = fxTrace;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			releaseSixthEndRound();
			await context.close();
		}
	});

	await runScenario('checkpoint-failure-settles-paid-win-exactly', async (record) => {
		const group = 'checkpoint-failure-settles-paid-win-exactly';
		const fixture = getGeneratedFixture('base_big');
		const round = authoritativeFixtureRound({ fixture, id: 'blacksite-qa-event-failure-paid-win' });
		const debitedBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT;
		const settledBalance = debitedBalance + round.payout;
		const expectedFinalWin = `$${(round.payout / 1_000_000).toFixed(2)}`;
		const expectedWalletBalance = `$${(settledBalance / 1_000_000).toFixed(2)}`;
		const sessionNetApi = DEFAULT_BALANCE - settledBalance;
		const expectedSessionNet = sessionNetApi === 0
			? '$0.00'
			: `${sessionNetApi < 0 ? '−' : '+'}$${(Math.abs(sessionNetApi) / 1_000_000).toFixed(2)}`;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: { displayNetPosition: true },
						}),
					play: () => ({
						status: successStatus(),
						balance: { amount: debitedBalance, currency: 'USD' },
						round,
					}),
					event: () =>
						mockHttpResponse(503, {
							error: {
								code: 'CHECKPOINT_UNAVAILABLE',
								message: 'Presentation checkpoint temporarily unavailable.',
							},
						}),
					endRound: () => endRoundResponse({ balance: settledBalance }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'event', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible' });
			const result = {
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				error: (await page.locator(SELECTORS.launchError).innerText()).trim(),
			};
			check(group, 'checkpoint failure remains visibly reported after fallback settlement', result.error.length > 0, serialize(result));
			check(group, 'fallback settlement exposes the exact already-authoritative paid win', result.finalWin === expectedFinalWin, serialize({ payoutApi: round.payout, expectedFinalWin, result }));
			check(group, 'fallback settlement adopts the exact authoritative settled balance', result.walletBalance === expectedWalletBalance, serialize({ settledBalance, expectedWalletBalance, result }));
			check(group, 'settled winning balance reports total wagered minus total won with the correct sign', result.netPosition === expectedSessionNet, serialize({ expectedSessionNet, result }));
			check(group, 'checkpoint failure settles exactly once', network.byEndpoint.event.length === 1 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'checkpoint failure order is authenticate, play, event, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound']), serialize(network.order));
			assertCleanNetwork(group, network);
			await assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.result = { ...result, payoutApi: round.payout, settledBalance };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('active-restore-no-duplicate-play', async (record) => {
		const group = 'active-restore-no-duplicate-play';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
					handlers: {
						authenticate: () =>
							authenticateResponse({
								round: authoritativeZeroRound({
									active: true,
									id: 'blacksite-qa-active-restore',
									amount: 500_000,
									mode: 'deep_access',
									event: encodePresentationCursor(3),
								}),
							}),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			await waitForOperatorIdleSurface(page);
			const restoredBoard = await page.locator(`${SELECTORS.board} [role="gridcell"]`).allInnerTexts();
			const restoredOperator = await page.locator(SELECTORS.operative).evaluate((stage) => ({
				sequence: stage.getAttribute('data-sequence'),
				zeroStreak: stage.getAttribute('data-zero-streak'),
				penguinKind: stage.querySelector('[data-testid="penguin-operator"]')?.getAttribute('data-operator-kind') ?? null,
				penguinState: stage.querySelector('[data-testid="penguin-operator"]')?.getAttribute('data-state') ?? null,
				penguinReady: stage.querySelector('[data-testid="penguin-operator"]')?.getAttribute('data-ready') ?? null,
				activeImages: stage.querySelectorAll('[data-testid="penguin-operator"] img.penguin-buffer[data-active="true"]').length,
				bufferImages: stage.querySelectorAll('[data-testid="penguin-operator"] img.penguin-buffer').length,
				adultImages: stage.querySelectorAll('[data-testid="operative-animation-frame"], [data-buffer-testid="operative-animation-buffer"]').length,
			}));
			const restoredFx = await standaloneFxSnapshot(page);
			check(group, 'Restore presents the already-active feature round without starting a duplicate play', restoredBoard.length === 15 && restoredBoard.some((text) => !text.includes('--')) && network.byEndpoint.play.length === 0, serialize({ restoredBoard, order: network.order }));
			check(group, 'all-primed Restore keeps the canonical Penguin idle with one active frame across at most two buffers and no adult/outcome one-shot', restoredOperator.sequence === 'idle' && restoredOperator.penguinState === 'idle' && restoredOperator.penguinKind === 'swat-penguin-v1' && restoredOperator.penguinReady === 'true' && restoredOperator.activeImages === 1 && restoredOperator.bufferImages >= 1 && restoredOperator.bufferImages <= 2 && restoredOperator.adultImages === 0, serialize(restoredOperator));
			check(group, 'Restore never mutates the finalized live zero-loss streak', restoredOperator.zeroStreak === '0', serialize(restoredOperator));
			check(group, 'all-primed Restore never replays an outcome FX cue', standaloneFxIsInactive(restoredFx), serialize(restoredFx));
			check(group, 'restored feature round exposes its exact result only after completion', (await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00', await page.locator(SELECTORS.finalWin).innerText());
			check(group, 'restore sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			check(group, 'restore does not rewrite already-persisted checkpoints', network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'restore settles exactly once', network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'restore order is authenticate then end-round', serialize(network.order) === serialize(['authenticate', 'endRound']), serialize(network.order));
			check(group, 'restored non-default Base amount remains selected after settlement', await page.locator(SELECTORS.baseAmount).inputValue() === '500000', await page.locator(SELECTORS.baseAmount).inputValue());
			const { opener: restoredModeOpener, dialog: restoredModeDialog } = await openModeSelection(page);
			const restoredDeepAccess = restoredModeDialog.locator(SELECTORS.modeDeepAccess);
			check(
				group,
				'restored DEEP ACCESS identity remains selected inside BUY after settlement',
				await restoredDeepAccess.count() === 1 &&
					await restoredDeepAccess.getAttribute('aria-pressed') === 'true',
				await restoredModeDialog.innerText(),
			);
			await closeModeSelection(page, restoredModeDialog);
			check(group, 'closing restored BUY selection returns focus to its HUD opener', await restoredModeOpener.evaluate((element) => document.activeElement === element), SELECTORS.hudShop);
			check(group, 'restored mode and Base amount produce exact complete play display', (await page.locator(SELECTORS.totalPlay).innerText()).trim() === '$2.00', await page.locator(SELECTORS.totalPlay).innerText());
			check(group, 'restored settled feature selection is ready without sending a play', !(await page.locator(SELECTORS.primaryAction).isDisabled()) && network.byEndpoint.play.length === 0, serialize({ action: await page.locator(SELECTORS.primaryAction).innerText(), order: network.order }));
			const { dialog: switchModeDialog } = await openModeSelection(page);
			check(group, 'Base mode remains legal in BUY after restored feature settlement', !(await switchModeDialog.locator(SELECTORS.modeBase).isDisabled()), await switchModeDialog.locator(SELECTORS.modeBase).innerText());
			await switchModeDialog.locator(SELECTORS.modeBase).click();
			await switchModeDialog.waitFor({ state: 'detached' });
			await waitForStableAction(page);
			const { dialog: verifiedModeDialog } = await openModeSelection(page);
			const basePressed = await verifiedModeDialog.locator(SELECTORS.modeBase).getAttribute('aria-pressed');
			check(group, 'switching to Base restores a legal ready action without sending play', basePressed === 'true' && network.byEndpoint.play.length === 0, serialize({ basePressed, order: network.order }));
			await closeModeSelection(page, verifiedModeDialog);
			check(group, 'Base keeps the restored amount and exact legal complete-play display', await page.locator(SELECTORS.baseAmount).inputValue() === '500000' && (await page.locator(SELECTORS.totalPlay).innerText()).trim() === '$0.50', serialize({ baseAmount: await page.locator(SELECTORS.baseAmount).inputValue(), totalPlay: await page.locator(SELECTORS.totalPlay).innerText() }));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'active-restore-no-duplicate-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('known-insufficient-balance-blocks-play', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse({ balance: 50_000 }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.primaryAction).waitFor({ state: 'visible' });
			const action = page.locator(SELECTORS.primaryAction);
			const disabled = await action.isDisabled();
			if (!disabled) {
				await action.click();
				await page.waitForTimeout(300);
			}
			const state = await runtimeState(page);
			const visibleText = await page.locator('body').innerText();
			check('known-insufficient-balance-blocks-play', 'known insufficient balance sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			check('known-insufficient-balance-blocks-play', 'insufficient guard is disabled or visibly reported', disabled || /insufficient/i.test(`${state ?? ''} ${visibleText}`), serialize({ disabled, state }));
			assertCleanNetwork('known-insufficient-balance-blocks-play', network);
			record.screenshot = await saveScreenshot(page, 'known-insufficient-balance');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	const replayMatrixCases = [
		{
			caseId: 'base-zero',
			fixture: BASE_ZERO_FIXTURE,
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'zero',
			expectedSequence: 'loss',
			expectedFx: null,
			expectedFxNames: [],
		},
		{
			caseId: 'base-win',
			fixture: getGeneratedFixture('base_classic_line_win'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'win',
			expectedSequence: 'win-small',
			expectedFx: 'winFlash',
			expectedFxNames: ['winFlash'],
		},
		{
			caseId: 'feature-mode-win',
			fixture: getGeneratedFixture('deep_access_small'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'feature-mode-win',
			expectedSequence: 'bonus',
			expectedFx: 'bonusCrateSpin',
			expectedFxNames: ['bonusCratePulse', 'bonusCrateSpin', 'winFlash'],
		},
		{
			caseId: 'max-win',
			fixture: getGeneratedFixture('base_max_win'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'max-win',
			expectedSequence: 'win-big',
			expectedFx: 'coinBurst',
			expectedFxNames: ['bonusCratePulse', 'bonusCrateSpin', 'coinBurst'],
		},
		{
			caseId: 'fractional-query-amount',
			fixture: getGeneratedFixture('blackout_small'),
			amountUnitsRaw: '0.0496',
			expectedClass: 'fractional',
			expectedSequence: 'bonus',
			expectedFx: 'bonusCrateSpin',
			expectedFxNames: ['bonusCrateSpin', 'winFlash'],
		},
	];

	for (const matrixCase of replayMatrixCases) {
		await runScenario(`replay-matrix-${matrixCase.caseId}`, async (record) => {
			const group = `replay-matrix-${matrixCase.caseId}`;
			const {
				fixture,
				amountUnitsRaw,
				expectedClass,
				expectedSequence,
				expectedFx,
				expectedFxNames,
			} = matrixCase;
			const currency = 'USD';
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			try {
				const payload = replayResponseFromFixture(fixture);
				const event = String(fixture.bookId);
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					replayOnly: true,
					handlers: { replay: () => payload },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					replayQuery({
						mode: fixture.mode,
						event,
						amount: amountUnitsRaw,
						currency,
					}),
				);
				await waitForEndpoint(network, 'replay', 1);
				await waitForStableAction(page);
				const request = network.byEndpoint.replay[0];
				const expectedPath = `/bet/replay/blacksite_breach/${REPLAY_VERSION}/${fixture.mode}/${event}`;
				check(group, 'fixture is math-backed', fixture.mathBacked === true, serialize({ fixtureId: fixture.id, mathBacked: fixture.mathBacked }));
				check(group, 'Replay payload converts exact book centi-x to multiplier-x', payload.payoutMultiplier === fixture.book.payoutMultiplier / 100, serialize({ responseMultiplierX: payload.payoutMultiplier, bookPayoutCentiX: fixture.book.payoutMultiplier }));
				check(group, 'Replay payload uses canonical mode cost', payload.costMultiplier === MODE_COSTS[fixture.mode], serialize({ actual: payload.costMultiplier, expected: MODE_COSTS[fixture.mode] }));
				check(group, 'Replay matrix uses GET', request.method === 'GET', serialize(request));
				check(group, 'Replay matrix path is exact', request.path === expectedPath, serialize({ actual: request.path, expected: expectedPath }));
				check(group, 'Replay matrix GET is queryless', Object.keys(request.search).length === 0, serialize(request.search));
				check(group, 'Replay matrix GET has no body', request.body === null, serialize(request.body));
				const expectedTotalPlay = expectedReplayTotalPlay(amountUnitsRaw, MODE_COSTS[fixture.mode], currency);
				const expectedFinalWin = expectedReplayFinalWin(amountUnitsRaw, fixture.book.payoutMultiplier, currency);
				const readyPresentation = await replayPresentationSnapshot(page);
				check(group, 'Replay ready state keeps FINAL WIN hidden', readyPresentation.runtimeState === 'replay-ready' && readyPresentation.finalWin === '—', serialize(readyPresentation));
				check(group, 'Replay TOTAL PLAY is exact query amount times canonical cost', readyPresentation.totalPlay === expectedTotalPlay, serialize({ actual: readyPresentation.totalPlay, expected: expectedTotalPlay, amountUnitsRaw, costMultiplier: MODE_COSTS[fixture.mode] }));
				check(group, 'Replay ready surface is read-only while keeping the final result hidden', readyPresentation.walletBalance === 'READ-ONLY' && readyPresentation.finalWin === '—', serialize(readyPresentation));

				const poseAssetAudit = await collectSceneAssetAudit(page);
				assertOperativePoseAssetAudit(group, poseAssetAudit, origin, '/');
				assertStandaloneFxAssetAudit(group, poseAssetAudit, origin, '/');
				await waitForStandaloneFxInactive(page);
				await waitForOperatorIdleSurface(page);
				await beginOperatorReactionTrace(page);
				await beginOperatorPoseTrace(page);
				await beginStandaloneFxTrace(page);
				await page.locator(SELECTORS.primaryAction).click();
				const fixtureHasFeaturePresentation = fixture.book.events.some(({ type }) => type === 'feature_start');
				if (fixtureHasFeaturePresentation) {
					await returnFromExtraction(page);
				}
				await waitForReplayComplete(page);
				if (expectedSequence) await waitForDecodedOperatorSequenceTrace(page, expectedSequence);
				if (expectedFx) await waitForStandaloneFxActivation(page, expectedFx);
				const reactionTrace = await operatorReactionTrace(page);
				const poseTrace = await operatorPoseTrace(page);
				const firstFxTrace = await standaloneFxTrace(page);
				const firstPresentation = await replayPresentationSnapshot(page);
				const zeroStreakAfterFirst = await page.locator(SELECTORS.operative).getAttribute('data-zero-streak');
				const completedSceneAssetAudit = await collectSceneAssetAudit(page);
				assertSceneAssetAudit(group, completedSceneAssetAudit, origin, '/', { requireVisibleSymbol: true });
				check(
					group,
					'Replay never mutates the live finalized-loss streak',
					zeroStreakAfterFirst === '0',
					serialize({ zeroStreakAfterFirst, reactionTrace }),
				);
				if (expectedSequence) {
					check(
						group,
						`${fixture.id} reaches and decodes the canonical ${expectedSequence} Penguin clip in the first explicit Replay playback`,
						reactionTrace.includes(expectedSequence) &&
							poseTraceHasDecodedSequence(poseTrace, expectedSequence),
						serialize({ reactionTrace, poseTrace }),
					);
				}
				check(
					group,
					'operative frame sampler preserves one decoded visible buffer during pending handoffs, at most two total buffers, and no metadata/file mismatch',
					Boolean(
						poseTrace &&
							poseTrace.frames > 0 &&
							poseTrace.visibleStageFrames > 0 &&
							poseTrace.blankFrames === 0 &&
							poseTrace.imageCountViolations === 0 &&
							poseTrace.visibleBufferCountViolations === 0 &&
							poseTrace.sequenceMismatchFrames === 0 &&
							poseTrace.clipMismatchFrames === 0 &&
							poseTrace.unexpectedSourceFrames === 0 &&
							poseTrace.undecodedFrames === 0 &&
							poseTrace.fileProtocolFrames === 0,
					),
					serialize(poseTrace),
				);
				assertStandaloneFxTraceClean(group, firstFxTrace);
				check(
					group,
					expectedFx
						? `confirmed Replay cues start ${expectedFx} exactly once and no undeclared standalone FX`
						: 'zero-result Replay starts no standalone FX before or after settlement',
					expectedFx
						? firstFxTrace?.activationCounts?.[expectedFx] === 1 &&
							firstFxTrace.activations.every((name) => expectedFxNames.includes(name))
						: firstFxTrace?.activations.length === 0,
					serialize({ expectedFx, expectedFxNames, firstFxTrace }),
				);
				check(group, 'Replay completes rather than remaining loading/playing', firstPresentation.runtimeState === 'replay-completed', serialize(firstPresentation.runtimeState));
				check(group, 'Replay FINAL WIN is exact query amount times authoritative package payout', firstPresentation.finalWin === expectedFinalWin, serialize({ actual: firstPresentation.finalWin, expected: expectedFinalWin, amountUnitsRaw, packagePayoutCentiX: fixture.book.payoutMultiplier }));
				check(group, 'Replay TOTAL PLAY remains exact query amount times canonical cost', firstPresentation.totalPlay === expectedTotalPlay, serialize({ actual: firstPresentation.totalPlay, expected: expectedTotalPlay }));
				check(group, 'completed Replay remains read-only after revealing the authoritative result', firstPresentation.walletBalance === 'READ-ONLY' && firstPresentation.finalWin === expectedFinalWin, serialize(firstPresentation));
				check(group, 'Replay presents all 15 authoritative reel cells', firstPresentation.board.length === 15, String(firstPresentation.board.length));
				const finalBoardEvent = [...fixture.book.events]
					.reverse()
					.find(({ type }) => type === 'expansion_applied' || type === 'spin_set');
				const authoritativeFinalBoard = finalBoardEvent?.type === 'expansion_applied'
					? finalBoardEvent.evaluated_board
					: finalBoardEvent?.board;
				check(
					group,
					'Replay data-symbol-id values exactly match all 15 authoritative cells',
					Boolean(
						finalBoardEvent &&
							firstPresentation.boardAuthoritative === 'true' &&
							firstPresentation.board.length === 15 &&
							firstPresentation.board.every((cell) => {
								const column = Number(cell.column);
								const row = Number(cell.row);
								return (
									Number.isInteger(column) && column >= 0 && column < 5 &&
									Number.isInteger(row) && row >= 0 && row < 3 &&
									cell.authoritative === 'true' &&
									cell.symbolId === authoritativeFinalBoard?.[column]?.[row]
								);
							}),
					),
					serialize({ board: firstPresentation.board, authoritative: authoritativeFinalBoard }),
				);
				const finalBoardEventIndex = fixture.book.events.lastIndexOf(finalBoardEvent);
				const terminalLineWins = fixture.book.events
					.slice(finalBoardEventIndex + 1)
					.filter(
						(event) =>
							event.type === 'line_win' &&
							event.spin_index === finalBoardEvent?.spin_index &&
							(finalBoardEvent?.phase === undefined || event.phase === finalBoardEvent.phase),
					);
				const expectedTerminalLineIds = terminalLineWins.flatMap(({ wins }) =>
					wins.map(({ line_id }) => String(line_id)),
				);
				check(
					group,
					'Replay payline overlay exactly matches wins on the terminal authoritative board',
					serialize(firstPresentation.activePaylines.map(({ lineId }) => lineId)) ===
						serialize(expectedTerminalLineIds),
					serialize({
						actual: firstPresentation.activePaylines,
						expectedTerminalLineIds,
						terminalBoardEvent: finalBoardEvent,
					}),
				);
				check(
					group,
					'Replay payline overlay uses exact decoded 1000x600 raster paths',
					firstPresentation.activePaylines.every(({ lineId, source, complete, naturalWidth, naturalHeight }) => {
						const expectedPath = PAYLINE_ASSETS[Number(lineId)];
						if (!expectedPath || !complete || naturalWidth !== 1000 || naturalHeight !== 600) return false;
						try {
							return new URL(source).pathname.endsWith(`/assets/blacksite/${expectedPath}`);
						} catch {
							return false;
						}
					}),
					serialize(firstPresentation.activePaylines),
				);
				if (expectedClass === 'zero') {
					check(group, 'zero/loss case has exact zero book result', fixture.book.payoutMultiplier === 0, String(fixture.book.payoutMultiplier));
				} else {
					check(group, `${expectedClass} case has a positive book result`, fixture.book.payoutMultiplier > 0, String(fixture.book.payoutMultiplier));
				}
				if (expectedClass === 'feature-mode-win') {
					check(group, 'feature-mode case is a non-base canonical mode', fixture.mode !== 'base' && MODE_COSTS[fixture.mode] > 1, serialize({ mode: fixture.mode, cost: MODE_COSTS[fixture.mode] }));
					check(group, 'feature-mode Replay triggers the manifest-backed bonus sequence', reactionTrace.includes('bonus'), serialize(reactionTrace));
				}
				if (expectedClass === 'max-win') {
					const bonusSequenceIndex = reactionTrace.indexOf('bonus');
					const bigWinSequenceIndex = reactionTrace.indexOf('win-big');
					const visibleBonus = poseTrace?.transitions.some(
						(transition) =>
							transition.sequence === 'bonus' &&
							transition.stageVisible === true &&
							transition.imageCount >= 1 &&
							transition.imageCount <= 2 &&
							transition.activeCount === 1 &&
							transition.visibleDecodedCount >= 1 &&
							transition.visibleDecodedCount <= 2 &&
							transition.activeDecoded === true &&
							transition.image?.sequence === 'bonus' &&
							transition.image?.complete === true &&
							transition.image?.naturalWidth === OPERATIVE_FRAME_WIDTH &&
							transition.image?.naturalHeight === OPERATIVE_FRAME_HEIGHT,
					);
					const visibleBigWin = poseTrace?.transitions.some(
						(transition) =>
							transition.sequence === 'win-big' &&
							transition.stageVisible === true &&
							transition.imageCount >= 1 &&
							transition.imageCount <= 2 &&
							transition.activeCount === 1 &&
							transition.visibleDecodedCount >= 1 &&
							transition.visibleDecodedCount <= 2 &&
							transition.activeDecoded === true &&
							transition.image?.sequence === 'win-big' &&
							transition.image?.complete === true &&
							transition.image?.naturalWidth === OPERATIVE_FRAME_WIDTH &&
							transition.image?.naturalHeight === OPERATIVE_FRAME_HEIGHT,
					);
					check(group, 'max-win case applies the exact 10,000x package cap to opaque query units', fixture.book.payoutMultiplier === 1_000_000 && firstPresentation.finalWin === expectedReplayFinalWin(amountUnitsRaw, 1_000_000, currency), serialize(firstPresentation));
					check(
						group,
						'max-win Replay visibly presents a decoded BONUS before the deferred decoded BIG WIN',
						bonusSequenceIndex >= 0 &&
							bigWinSequenceIndex > bonusSequenceIndex &&
							reactionTrace.includes('bonus') &&
							reactionTrace.includes('win-big') &&
							visibleBonus === true &&
							visibleBigWin === true,
						serialize({ reactionTrace, bonusSequenceIndex, bigWinSequenceIndex, visibleBonus, visibleBigWin, poseTrace }),
					);
					check(group, 'max-win reel window decodes a dedicated v4 GHOST WILD state raster', Object.values(SYMBOL_STATE_ASSETS.ghost_wild).some((path) => new URL(completedSceneAssetAudit.symbolSheet.source).pathname.endsWith(`/assets/blacksite/${path}`)), serialize(completedSceneAssetAudit.symbolSheet));
				}
				if (expectedClass === 'win') {
					check(group, 'base win authority triggers a canonical Penguin win sequence', reactionTrace.some((sequence) => ['win-small', 'win-big'].includes(sequence)), serialize(reactionTrace));
				}
				if (expectedClass === 'fractional') {
					check(group, 'fractional BLACKOUT arithmetic remains exact and lossless', fixture.mode === 'blackout' && fixture.book.payoutMultiplier === 1 && firstPresentation.totalPlay === '$3.968 units' && firstPresentation.finalWin === '$0.000496 units', serialize({ fixture: fixture.id, mode: fixture.mode, payoutCentiX: fixture.book.payoutMultiplier, firstPresentation }));
					check(group, 'direct BLACKOUT Replay triggers the manifest-backed bonus sequence', reactionTrace.includes('bonus'), serialize(reactionTrace));
				}

				await waitForStandaloneFxInactive(page);
				await waitForOperatorIdleSurface(page);
				await beginOperatorReactionTrace(page);
				await beginOperatorPoseTrace(page);
				await beginStandaloneFxTrace(page);
				await page.locator(SELECTORS.primaryAction).click();
				await page.waitForTimeout(50);
				if (fixtureHasFeaturePresentation) {
					await returnFromExtraction(page);
				}
				await waitForReplayComplete(page);
				if (expectedSequence) await waitForDecodedOperatorSequenceTrace(page, expectedSequence);
				if (expectedFx) await waitForStandaloneFxActivation(page, expectedFx);
				const secondReactionTrace = await operatorReactionTrace(page);
				const secondPoseTrace = await operatorPoseTrace(page);
				const secondFxTrace = await standaloneFxTrace(page);
				const secondPresentation = await replayPresentationSnapshot(page);
				const zeroStreakAfterSecond = await page.locator(SELECTORS.operative).getAttribute('data-zero-streak');
				check(group, 'Play Again reproduces the exact result and board presentation', serialize(secondPresentation) === serialize(firstPresentation), serialize({ firstPresentation, secondPresentation }));
				check(
					group,
					'Play Again receives a fresh playback generation and reproduces the canonical decoded Penguin clip count',
					secondReactionTrace.filter((sequence) => sequence === expectedSequence).length ===
							reactionTrace.filter((sequence) => sequence === expectedSequence).length &&
						secondReactionTrace.includes(expectedSequence) &&
						poseTraceHasDecodedSequence(secondPoseTrace, expectedSequence),
					serialize({ expectedSequence, reactionTrace, secondReactionTrace, secondPoseTrace }),
				);
				if (expectedClass === 'max-win') {
					const secondBonusSequenceIndex = secondReactionTrace.indexOf('bonus');
					const secondBigWinSequenceIndex = secondReactionTrace.indexOf('win-big');
					const secondVisibleBonus = secondPoseTrace?.transitions.some(
						(transition) =>
							transition.sequence === 'bonus' &&
							transition.stageVisible === true &&
							transition.activeCount === 1 &&
							transition.visibleDecodedCount >= 1 &&
							transition.visibleDecodedCount <= 2 &&
							transition.activeDecoded === true &&
							transition.image?.sequence === 'bonus' &&
							transition.image?.complete === true,
					);
					const secondVisibleBigWin = secondPoseTrace?.transitions.some(
						(transition) =>
							transition.sequence === 'win-big' &&
							transition.stageVisible === true &&
							transition.activeCount === 1 &&
							transition.visibleDecodedCount >= 1 &&
							transition.visibleDecodedCount <= 2 &&
							transition.activeDecoded === true &&
							transition.image?.sequence === 'win-big' &&
							transition.image?.complete === true,
					);
					check(
						group,
						'max-win Play Again visibly repeats decoded BONUS before the deferred decoded BIG WIN',
						secondBonusSequenceIndex >= 0 &&
							secondBigWinSequenceIndex > secondBonusSequenceIndex &&
							secondReactionTrace.filter((sequence) => sequence === 'bonus').length ===
								reactionTrace.filter((sequence) => sequence === 'bonus').length &&
							secondReactionTrace.filter((sequence) => sequence === 'win-big').length ===
								reactionTrace.filter((sequence) => sequence === 'win-big').length &&
							secondVisibleBonus === true &&
							secondVisibleBigWin === true,
						serialize({
							secondReactionTrace,
							secondBonusSequenceIndex,
							secondBigWinSequenceIndex,
							secondVisibleBonus,
							secondVisibleBigWin,
							secondPoseTrace,
						}),
					);
				}
				assertStandaloneFxTraceClean(group, secondFxTrace);
				check(
					group,
					expectedFx
						? 'Play Again receives a fresh FX playback generation without duplicate one-shots'
						: 'zero-result Play Again remains free of standalone FX',
					expectedFx
						? secondFxTrace?.activationCounts?.[expectedFx] === 1 &&
							secondFxTrace.activations.every((name) => expectedFxNames.includes(name))
						: secondFxTrace?.activations.length === 0,
					serialize({ expectedFx, expectedFxNames, secondFxTrace }),
				);
				check(group, 'Play Again still leaves the live finalized-loss streak untouched', zeroStreakAfterSecond === '0', serialize({ zeroStreakAfterFirst, zeroStreakAfterSecond }));
				check(group, 'Play Again does not refetch Replay', network.byEndpoint.replay.length === 1, serialize(network.order));
				check(group, 'Replay matrix sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
				assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
				record.fixture = {
					id: fixture.id,
					mode: fixture.mode,
					bookId: fixture.bookId,
					bookPayoutCentiX: fixture.book.payoutMultiplier,
					responsePayoutMultiplierX: payload.payoutMultiplier,
					costMultiplier: payload.costMultiplier,
					amountUnitsRaw,
					currency,
					expectedTotalPlay,
					expectedFinalWin,
				};
				record.readyPresentation = readyPresentation;
				record.firstPresentation = firstPresentation;
				record.secondPresentation = secondPresentation;
				record.operatorReactionTrace = reactionTrace;
				record.operatorPoseTrace = poseTrace;
				record.secondOperatorSequenceTrace = secondReactionTrace;
				record.secondOperatorFrameTrace = secondPoseTrace;
				record.firstStandaloneFxTrace = firstFxTrace;
				record.secondStandaloneFxTrace = secondFxTrace;
				record.operativeFrameAssets = poseAssetAudit.operativeFrames;
				record.completedSceneAssets = completedSceneAssetAudit;
				record.screenshot = await saveScreenshot(page, group);
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('social-replay-dom-aria-restricted-scan', async (record) => {
		const group = 'social-replay-dom-aria-restricted-scan';
		const fixture = getGeneratedFixture('blackout_small');
		const payload = replayResponseFromFixture(fixture);
		const amountUnitsRaw = '0.0496';
		const currency = 'XSC';
		const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => payload },
			});
			const event = 'bet-stake-wager';
			const { page, diagnostics } = await openPage(
				context,
				origin,
				replayQuery({
					mode: fixture.mode,
					event,
					amount: amountUnitsRaw,
					currency,
					lang: 'de',
					social: 'true',
					device: 'mobile',
				}),
			);
			await waitForEndpoint(network, 'replay', 1);
			await waitForStableAction(page);
			const request = network.byEndpoint.replay[0];
			check(group, 'Social Replay GET path is exact', request.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/${fixture.mode}/${event}`, request.path);
			check(group, 'Social Replay GET remains queryless', Object.keys(request.search).length === 0, serialize(request.search));
			const expectedTotalPlay = expectedReplayTotalPlay(amountUnitsRaw, MODE_COSTS[fixture.mode], currency);
			const expectedFinalWin = expectedReplayFinalWin(amountUnitsRaw, fixture.book.payoutMultiplier, currency);
			const expectedFeatureTarget = fixture.book.events
				.find(({ type }) => type === 'feature_start')
				?.target_symbol?.toUpperCase();
			const socialReady = await replayPresentationSnapshot(page);
			check(group, 'Social Replay ready state keeps FINAL WIN hidden', socialReady.finalWin === '—' && socialReady.runtimeState === 'replay-ready', serialize(socialReady));
			check(group, 'Social Replay decorates exact query amount × cost with SC units', expectedTotalPlay === '3.968 SC units' && socialReady.totalPlay === expectedTotalPlay, serialize({ expectedTotalPlay, socialReady }));
			check(group, 'Social Replay ready surface is read-only without leaking result', socialReady.walletBalance === 'READ-ONLY' && socialReady.finalWin === '—', serialize(socialReady));
			await beginQuickStartHudTrace(page);
			await page.locator(SELECTORS.primaryAction).click();
			await returnFromExtraction(page);
			await waitForReplayComplete(page);
			const hudTrace = await quickStartHudTrace(page);
			const socialCompleted = await replayPresentationSnapshot(page);
			const hudProgressIndex = (value, secondaryPattern) => hudTrace.findIndex(({ phase, text, segments }) =>
				phase === 'feature' &&
				segments.some(({ kind, value: segmentValue, visible }) =>
					visible && kind === 'progress' && segmentValue === value,
				) &&
				secondaryPattern.test(text),
			);
			const readyIndex = hudProgressIndex('0/8', /\b8\s+LEFT\b/iu);
			const firstSpinIndex = hudProgressIndex('1/8', /\b7\s+LEFT\b/iu);
			const finalSpinIndex = hudProgressIndex('8/8', /\b0\s+LEFT\b/iu);
			check(group, 'direct BLACKOUT HUD exposes the pre-spin 0/8 and 8 LEFT state', readyIndex >= 0, serialize(hudTrace));
			check(group, 'free-spin HUD progresses authoritatively from 0/8 to 1/8 and 8/8', readyIndex >= 0 && firstSpinIndex > readyIndex && finalSpinIndex > firstSpinIndex, serialize({ readyIndex, firstSpinIndex, finalSpinIndex, hudTrace }));
			check(
				group,
				'direct BLACKOUT HUD exposes the exact authoritative expansion target',
				typeof expectedFeatureTarget === 'string' &&
					hudTrace.some(
						({ phase, segments }) =>
							phase === 'feature' &&
							segments.some(
								({ kind, value, visible }) =>
									visible && kind === 'target' && value === expectedFeatureTarget,
							),
					),
				serialize({ expectedFeatureTarget, hudTrace }),
			);
			check(group, 'mobile BLACKOUT HUD keeps semantic free-spin progress and expansion target visible together', hudTrace.some(({ phase, segments }) => phase === 'feature' && segments.some(({ kind, visible }) => kind === 'progress' && visible) && segments.some(({ kind, visible }) => kind === 'target' && visible)), serialize(hudTrace));
			check(group, 'Social Replay decorates exact query amount × payout with SC units', expectedFinalWin === '0.000496 SC units' && socialCompleted.finalWin === expectedFinalWin, serialize({ expectedFinalWin, socialCompleted }));
			check(group, 'Social Replay preserves exact decorated TOTAL PLAY after completion', socialCompleted.totalPlay === expectedTotalPlay, serialize(socialCompleted));
			check(group, 'completed Social Replay remains read-only after revealing the exact result', socialCompleted.walletBalance === 'READ-ONLY' && socialCompleted.finalWin === expectedFinalWin, serialize(socialCompleted));
			check(group, 'Social Replay keeps BUY disabled and mounts no mutable mode actions', await page.locator(SELECTORS.hudShop).isDisabled() && await page.locator(SELECTORS.modeDialog).count() === 0 && await page.locator(SELECTORS.modeBase).count() === 0 && await page.locator(SELECTORS.modeBlackout).count() === 0, await page.locator(SELECTORS.hudShop).evaluate((element) => element.outerHTML));
			await page.locator(SELECTORS.hudInfo).click();
			await page.locator(SELECTORS.rulesDialog).waitFor({ state: 'visible' });
			await page.locator(SELECTORS.gameGuideModes).click();
			const surface = await collectPlayerVisibleSurface(page);
			const restrictedHits = playerVisibleRestrictedHits(surface.combined);
			check(group, 'Social Replay rules retain STANDARD RUN and BLACKOUT ENTRY terminology', /STANDARD RUN/iu.test(surface.combined) && /BLACKOUT ENTRY/iu.test(surface.combined), surface.combined);
			check(group, 'Social Replay visible DOM and ARIA surface has zero official restricted hits', restrictedHits.length === 0, serialize({ hits: restrictedHits, attributes: surface.attributes }));
			check(group, 'Social Replay uses PLAY AMOUNT, TOTAL PLAY and RESULTS terminology', /PLAY AMOUNT/iu.test(surface.combined) && /TOTAL PLAY/iu.test(surface.combined) && /RESULTS/iu.test(surface.combined), surface.combined);
			check(group, 'Social Replay surface contains no dollar-prefixed social display', !surface.combined.includes('$'), surface.combined);
			check(group, 'Social Replay sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
			check(group, 'Social Replay fetches exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
			record.surface = surface;
			record.quickStartHudTrace = hudTrace;
			record.replayUnits = { amountUnitsRaw, currency, expectedTotalPlay, expectedFinalWin };
			record.screenshot = await saveScreenshot(page, 'social-replay-restricted-scan');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('replay-read-only-play-again', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => replayResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, replayQuery());
			await waitForEndpoint(network, 'replay', 1);
			await waitForStableAction(page);
			const replayRequest = network.byEndpoint.replay[0];
			check('replay-read-only-play-again', 'Replay uses GET', replayRequest.method === 'GET', serialize(replayRequest));
			check('replay-read-only-play-again', 'Replay path is exact', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/1`, replayRequest.path);
			check('replay-read-only-play-again', 'Replay GET has an exact empty query string', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
			check('replay-read-only-play-again', 'Replay has no request body', replayRequest.body === null, serialize(replayRequest.body));
			await page.locator(SELECTORS.primaryAction).click();
			await waitForReplayComplete(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForReplayComplete(page);
			await page.waitForTimeout(200);
			const walletWrites =
				network.byEndpoint.authenticate.length +
				network.byEndpoint.play.length +
				network.byEndpoint.endRound.length +
				network.byEndpoint.event.length;
			check('replay-read-only-play-again', 'Replay fetch occurs exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
			check('replay-read-only-play-again', 'Play Again does not refetch Replay', network.byEndpoint.replay.length === 1, serialize(network.order));
			check('replay-read-only-play-again', 'Replay makes zero wallet/event writes', walletWrites === 0, serialize(network.order));
			check('replay-read-only-play-again', 'Replay request order contains only replay', serialize(network.order) === serialize(['replay']), serialize(network.order));
			assertCleanNetwork('replay-read-only-play-again', network);
			record.screenshot = await saveScreenshot(page, 'replay-play-again');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-replay-payload-fails-closed', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => invalidReplayResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, replayQuery({ event: 'invalid' }));
			await waitForEndpoint(network, 'replay', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const walletWrites =
				network.byEndpoint.authenticate.length +
				network.byEndpoint.play.length +
				network.byEndpoint.endRound.length +
				network.byEndpoint.event.length;
			check('invalid-replay-payload-fails-closed', 'invalid Replay exposes a bounded error', errorText.trim().length > 0, errorText);
			check('invalid-replay-payload-fails-closed', 'invalid Replay runtime is an error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-replay-payload-fails-closed', 'invalid Replay makes zero wallet/event writes', walletWrites === 0, serialize(network.order));
			assertCleanNetwork('invalid-replay-payload-fails-closed', network);
			record.screenshot = await saveScreenshot(page, 'invalid-replay-payload');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});
}

async function geometryAudit(page) {
	return page.evaluate(async ({ selectors, operativeEnvelope }) => {
		const rect = (element) => {
			if (!element) return null;
			const value = element.getBoundingClientRect();
			return {
				left: value.left,
				top: value.top,
				right: value.right,
				bottom: value.bottom,
				width: value.width,
				height: value.height,
			};
		};
		const alphaEnvelopeRect = (element, envelope) => {
			const bounds = rect(element);
			if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
			const scale = Math.min(
				bounds.width / envelope.canvasWidth,
				bounds.height / envelope.canvasHeight,
			);
			const renderedWidth = envelope.canvasWidth * scale;
			const renderedHeight = envelope.canvasHeight * scale;
			const renderedLeft = bounds.left;
			const renderedTop = bounds.bottom - renderedHeight;
			return {
				left: renderedLeft + envelope.left * scale,
				top: renderedTop + envelope.top * scale,
				right: renderedLeft + envelope.right * scale,
				bottom: renderedTop + envelope.bottom * scale,
				width: (envelope.right - envelope.left) * scale,
				height: (envelope.bottom - envelope.top) * scale,
			};
		};
		const isVisible = (element) => {
			if (!element) return false;
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const insideViewport = (bounds) =>
			bounds &&
			bounds.left >= -0.5 &&
			bounds.top >= -0.5 &&
			bounds.right <= innerWidth + 0.5 &&
			bounds.bottom <= innerHeight + 0.5;
		const encloses = (outer, inner, tolerance = 1) =>
			Boolean(
				outer &&
					inner &&
					inner.left >= outer.left - tolerance &&
					inner.top >= outer.top - tolerance &&
					inner.right <= outer.right + tolerance &&
					inner.bottom <= outer.bottom + tolerance,
			);
		const intersectionRatio = (subject, container) => {
			if (!subject || !container || subject.width <= 0 || subject.height <= 0) return 0;
			const width = Math.max(
				0,
				Math.min(subject.right, container.right) - Math.max(subject.left, container.left),
			);
			const height = Math.max(
				0,
				Math.min(subject.bottom, container.bottom) - Math.max(subject.top, container.top),
			);
			return (width * height) / (subject.width * subject.height);
		};
		const scene = document.querySelector(selectors.scene);
		const sceneBounds = rect(scene);
		const premiumMachineShell = document.querySelector(selectors.premiumMachineShell);
		const premiumMachineShellBounds = rect(premiumMachineShell);
		let premiumMachineShellDecodeError = null;
		if (premiumMachineShell instanceof HTMLImageElement) {
			try {
				await premiumMachineShell.decode();
			} catch (error) {
				premiumMachineShellDecodeError = error instanceof Error ? error.message : String(error);
			}
		}
		const slotMonitor = document.querySelector(selectors.slotMonitor);
		const slotMonitorBounds = rect(slotMonitor);
		const operative = document.querySelector(selectors.operative);
		const operativeStageBounds = rect(operative);
		const operativeFrame = document.querySelector(selectors.operativeImage);
		const operativeFrameBounds = rect(operativeFrame);
		const operativeBounds = alphaEnvelopeRect(operativeFrame, operativeEnvelope);
		const bottomHud = document.querySelector(selectors.bottomHud);
		const bottomHudBounds = rect(bottomHud);
		const hudActionSelectors = [
			selectors.hudMenu,
			selectors.hudShop,
			selectors.hudAuto,
			selectors.hudBetMinus,
			selectors.hudBetPlus,
			selectors.hudTurbo,
			selectors.hudInfo,
			selectors.hudSettings,
			selectors.primaryAction,
		];
		const actionSelectors = [
			...hudActionSelectors,
			selectors.baseAmount,
		];
		const actions = actionSelectors.map((selector) => {
			const element = document.querySelector(selector);
			const bounds = rect(element);
			const bottomHudAction = hudActionSelectors.includes(selector);
			const bottomHudHorizontalEnclosure = Boolean(
				bottomHudBounds &&
					bounds &&
					bounds.left >= bottomHudBounds.left - 1 &&
					bounds.right <= bottomHudBounds.right + 1,
			);
			const bottomHudBottomEnclosure = Boolean(
				bottomHudBounds && bounds && bounds.bottom <= bottomHudBounds.bottom + 1,
			);
			const topProtrusion = bottomHudBounds && bounds
				? Math.max(0, bottomHudBounds.top - bounds.top)
				: null;
			const shortLandscapeComposition = innerHeight <= 560 && innerWidth / innerHeight >= (4 / 3);
			const targetTopProtrusionAllowance = (sceneBounds?.height ?? innerHeight) * (shortLandscapeComposition ? 0.025 : 0.022);
			const hit = bounds
				? document.elementFromPoint(
						bounds.left + bounds.width / 2,
						bounds.top + bounds.height / 2,
					)
				: null;
			return {
				selector,
				exists: Boolean(element),
				visible: isVisible(element),
				bounds,
				insideViewport: insideViewport(bounds),
				insideScene: encloses(sceneBounds, bounds),
				insideSlotMonitor: encloses(slotMonitorBounds, bounds),
				insideBottomHud: bottomHudAction
					? encloses(bottomHudBounds, bounds)
					: null,
				bottomHudHorizontalEnclosure,
				bottomHudBottomEnclosure,
				topProtrusion,
				targetTopProtrusionAllowance,
				insideBottomHudWithTargetSpinProtrusion:
					selector === selectors.primaryAction &&
					bottomHudHorizontalEnclosure &&
					bottomHudBottomEnclosure &&
					typeof topProtrusion === 'number' &&
					topProtrusion <= targetTopProtrusionAllowance,
				bottomHudAction,
				centerHit:
					Boolean(element && hit) &&
					(element === hit || element.contains(hit) || hit.contains(element)),
			};
		});
		const boardFrame = document.querySelector(selectors.boardFrame);
		const boardFrameBounds = rect(boardFrame);
		const board = document.querySelector(selectors.board);
		const boardBounds = rect(board);
		const cells = board ? [...board.querySelectorAll('[role="gridcell"]')] : [];
		const quickStartHud = document.querySelector(selectors.quickStartHud);
		const quickStartHudBounds = rect(quickStartHud);
		const markerSnapshot = (selector) => [...document.querySelectorAll(selector)].map((element) => ({
			lineId: element.getAttribute('data-line-id'),
			visible: isVisible(element),
			bounds: rect(element),
		}));
		const leftLineMarkers = markerSnapshot(selectors.leftLineMarkers);
		const rightLineMarkers = markerSnapshot(selectors.rightLineMarkers);
		return {
			viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
			interaction: {
				viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
				htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
				bodyTouchAction: getComputedStyle(document.body).touchAction,
			},
			runtimeState:
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? null,
			scroll: {
				documentWidth: document.documentElement.scrollWidth,
				documentHeight: document.documentElement.scrollHeight,
				bodyWidth: document.body.scrollWidth,
				bodyHeight: document.body.scrollHeight,
				hasHorizontal:
					document.documentElement.scrollWidth > innerWidth + 1 ||
					document.body.scrollWidth > innerWidth + 1,
				hasVertical:
					document.documentElement.scrollHeight > innerHeight + 1 ||
					document.body.scrollHeight > innerHeight + 1,
			},
			scene: {
				exists: Boolean(scene),
				visible: isVisible(scene),
				bounds: sceneBounds,
				insideViewport: insideViewport(sceneBounds),
			},
			premiumMachineShell: {
				exists: Boolean(premiumMachineShell),
				visible: isVisible(premiumMachineShell),
				bounds: premiumMachineShellBounds,
				insideViewport: insideViewport(premiumMachineShellBounds),
				insideScene: encloses(sceneBounds, premiumMachineShellBounds),
				currentSrc: premiumMachineShell instanceof HTMLImageElement ? premiumMachineShell.currentSrc || null : null,
				src: premiumMachineShell instanceof HTMLImageElement ? premiumMachineShell.src || null : null,
				complete: premiumMachineShell instanceof HTMLImageElement && premiumMachineShell.complete,
				decoded: premiumMachineShell instanceof HTMLImageElement && premiumMachineShellDecodeError === null && premiumMachineShell.complete && premiumMachineShell.naturalWidth > 0,
				decodeError: premiumMachineShellDecodeError,
				naturalWidth: premiumMachineShell instanceof HTMLImageElement ? premiumMachineShell.naturalWidth : 0,
				naturalHeight: premiumMachineShell instanceof HTMLImageElement ? premiumMachineShell.naturalHeight : 0,
			},
			slotMonitor: {
				exists: Boolean(slotMonitor),
				visible: isVisible(slotMonitor),
				bounds: slotMonitorBounds,
				insideViewport: insideViewport(slotMonitorBounds),
				insideScene: encloses(sceneBounds, slotMonitorBounds),
			},
			bottomHud: {
				exists: Boolean(bottomHud),
				visible: isVisible(bottomHud),
				bounds: bottomHudBounds,
				insideViewport: insideViewport(bottomHudBounds),
				insideSlotMonitor: encloses(slotMonitorBounds, bottomHudBounds),
				insideScene: encloses(sceneBounds, bottomHudBounds),
			},
			operative: {
				exists: Boolean(operative),
				visible: isVisible(operative) && isVisible(operativeFrame),
				bounds: operativeBounds,
				stageBounds: operativeStageBounds,
				frameBounds: operativeFrameBounds,
				alphaEnvelope: operativeEnvelope,
				sequence: operative?.getAttribute('data-sequence') ?? null,
				insideViewport: insideViewport(operativeBounds),
				insideScene: encloses(sceneBounds, operativeBounds),
				visibleAreaRatioInScene: intersectionRatio(operativeBounds, sceneBounds),
				horizontalGapFromBoard:
					operativeBounds && boardFrameBounds
						? boardFrameBounds.left - operativeBounds.right
						: null,
			},
			board: {
				exists: Boolean(board),
				visible: isVisible(board),
				authoritative: board?.getAttribute('data-authoritative') ?? null,
				bounds: boardBounds,
				insideViewport: insideViewport(boardBounds),
				insideSlotMonitor: encloses(slotMonitorBounds, boardBounds),
				insideBoardFrame: encloses(boardFrameBounds, boardBounds),
				cellCount: cells.length,
				visibleCellCount: cells.filter(isVisible).length,
				cells: cells.map((cell) => ({
					column: cell.getAttribute('data-column'),
					row: cell.getAttribute('data-row'),
					symbolId: cell.getAttribute('data-symbol-id'),
					authoritative: cell.getAttribute('data-authoritative'),
					ariaLabel: cell.getAttribute('aria-label'),
				})),
			},
			quickStartHud: {
				exists: Boolean(quickStartHud),
				visible: isVisible(quickStartHud),
				bounds: quickStartHudBounds,
				insideViewport: insideViewport(quickStartHudBounds),
				insideSlotMonitor: encloses(slotMonitorBounds, quickStartHudBounds),
				text: quickStartHud?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
			},
			lineMarkers: {
				left: leftLineMarkers,
				right: rightLineMarkers,
			},
			actions,
		};
	}, { selectors: SELECTORS, operativeEnvelope: OPERATIVE_IDLE_ALPHA_ENVELOPE });
}

function assertGeometryRecord(group, audit, viewport, origin, mountPrefix = '/') {
	check(group, 'browser viewport meta binds device width', /(?:^|,)\s*width=device-width(?:\s*,|$)/iu.test(audit.interaction.viewportMeta ?? ''), serialize(audit.interaction));
	check(group, 'browser viewport meta preserves user zoom', !/maximum-scale\s*=/iu.test(audit.interaction.viewportMeta ?? '') && !/user-scalable\s*=\s*(?:no|0)/iu.test(audit.interaction.viewportMeta ?? ''), serialize(audit.interaction));
	check(group, 'browser computed body touch-action is manipulation', audit.interaction.bodyTouchAction === 'manipulation', serialize(audit.interaction));
	check(group, 'document has no horizontal scroll', !audit.scroll.hasHorizontal, serialize(audit.scroll));
	check(group, 'document has no vertical scroll', !audit.scroll.hasVertical, serialize(audit.scroll));
	check(group, 'scene exists and is visible', audit.scene.exists && audit.scene.visible, serialize(audit.scene));
	check(group, 'scene is fully inside the browser viewport', audit.scene.insideViewport, serialize(audit.scene.bounds));
	const expectedMachineShell = machineShellForViewport(audit.viewport);
	const shellMatchesScene = audit.premiumMachineShell.bounds && audit.scene.bounds &&
		Math.abs(audit.premiumMachineShell.bounds.left - audit.scene.bounds.left) <= 5 &&
		Math.abs(audit.premiumMachineShell.bounds.top - audit.scene.bounds.top) <= 5 &&
		Math.abs(audit.premiumMachineShell.bounds.width - audit.scene.bounds.width) <= 5 &&
		Math.abs(audit.premiumMachineShell.bounds.height - audit.scene.bounds.height) <= 5;
	let exactShellUrl = false;
	let shellNonFile = false;
	try {
		const shellUrl = new URL(audit.premiumMachineShell.currentSrc);
		exactShellUrl = shellUrl.origin === origin &&
			shellUrl.pathname === `${mountPrefix}assets/blacksite/${expectedMachineShell.path}`;
		shellNonFile = shellUrl.protocol !== 'file:';
	} catch {
		exactShellUrl = false;
		shellNonFile = false;
	}
	check(
		group,
		`viewport loads one visible decoded ${expectedMachineShell.width}x${expectedMachineShell.height} premium shell from exact currentSrc`,
		audit.premiumMachineShell.exists &&
			audit.premiumMachineShell.visible &&
			audit.premiumMachineShell.insideViewport &&
			shellMatchesScene &&
			audit.premiumMachineShell.complete &&
			audit.premiumMachineShell.decoded &&
			audit.premiumMachineShell.naturalWidth === expectedMachineShell.width &&
			audit.premiumMachineShell.naturalHeight === expectedMachineShell.height &&
			exactShellUrl &&
			shellNonFile,
		serialize({ viewport: audit.viewport, expectedMachineShell, scene: audit.scene.bounds, shell: audit.premiumMachineShell, origin, mountPrefix }),
	);
	check(group, 'slot monitor exists and is visible', audit.slotMonitor.exists && audit.slotMonitor.visible, serialize(audit.slotMonitor));
	check(group, 'slot monitor is fully inside the browser viewport', audit.slotMonitor.insideViewport, serialize(audit.slotMonitor.bounds));
	check(group, 'scene encloses the complete slot monitor', audit.slotMonitor.insideScene, serialize({ scene: audit.scene.bounds, slotMonitor: audit.slotMonitor.bounds }));
	check(
		group,
		'premium Bottom HUD exists, is visible and remains fully inside the scene viewport',
		audit.bottomHud.exists && audit.bottomHud.visible && audit.bottomHud.insideViewport && audit.bottomHud.insideScene,
		serialize(audit.bottomHud),
	);
	if (viewport.expectOperative) {
		check(group, 'desktop operative exists and is visible', audit.operative.exists && audit.operative.visible, serialize(audit.operative));
		check(group, 'desktop scene contains at least 90% of the operative stage', audit.operative.visibleAreaRatioInScene >= 0.9, serialize(audit.operative));
		check(group, 'desktop operative remains horizontally separate from the reel aperture', typeof audit.operative.horizontalGapFromBoard === 'number' && audit.operative.horizontalGapFromBoard >= -0.5, serialize(audit.operative));
	} else {
		check(group, 'compact/mobile operative is optional and, when visible, remains substantially in scene', !audit.operative.visible || audit.operative.visibleAreaRatioInScene >= 0.8, serialize(audit.operative));
	}
	check(group, '5x3 reel window exists and is visible', audit.board.exists && audit.board.visible, serialize(audit.board));
	check(group, 'board is fully inside viewport', audit.board.insideViewport, serialize(audit.board.bounds));
	check(group, 'slot monitor encloses the complete board', audit.board.insideSlotMonitor, serialize({ slotMonitor: audit.slotMonitor.bounds, board: audit.board.bounds }));
	check(group, 'board frame encloses the complete reel grid', audit.board.insideBoardFrame, serialize(audit.board));
	check(group, 'board contains exactly 15 visible cells', audit.board.cellCount === 15 && audit.board.visibleCellCount === 15, serialize(audit.board));
	const reelCoordinates = new Set(audit.board.cells.map(({ column, row }) => `${column},${row}`));
	check(group, 'board exposes each of five reels by three rows exactly once', reelCoordinates.size === 15 && Array.from({ length: 5 }, (_, column) => Array.from({ length: 3 }, (_, row) => reelCoordinates.has(`${column},${row}`))).flat().every(Boolean), serialize(audit.board.cells));
	check(group, 'every reel cell exposes data-symbol-id and an accessible reel/row name', audit.board.cells.every(({ symbolId, ariaLabel }) => typeof symbolId === 'string' && symbolId.length > 0 && /Reel\s+[1-5],\s*row\s+[1-3]/iu.test(ariaLabel ?? '')), serialize(audit.board.cells));
	const isUnplayedLiveSurface =
		typeof audit.surface === 'string'
			? audit.surface.startsWith('live')
			: typeof audit.runtimeState === 'string' && audit.runtimeState.startsWith('live-');
	const expectedAuthority = isUnplayedLiveSurface ? 'false' : 'true';
	const surfaceLabel = audit.surface ?? audit.runtimeState ?? 'unknown';
	check(
		group,
		`${surfaceLabel} board exposes explicit ${expectedAuthority === 'true' ? 'authoritative' : 'attract'} provenance`,
		audit.board.authoritative === expectedAuthority &&
			audit.board.cells.every(({ authoritative }) => authoritative === expectedAuthority),
		serialize(audit.board),
	);
	const boardRatio = audit.board.bounds ? audit.board.bounds.width / audit.board.bounds.height : 0;
	const expectedBoardRatio = expectedMachineShell.boardRatio;
	const boardRatioTolerance = 0.12;
	check(group, 'reel window keeps its responsive shell-specific aspect including cell gaps', Math.abs(boardRatio - expectedBoardRatio) <= boardRatioTolerance, serialize({ boardRatio, expectedBoardRatio, boardRatioTolerance, expectedMachineShell }));
	check(group, 'board width meets viewport readability floor', Boolean(audit.board.bounds && audit.board.bounds.width >= viewport.minBoard), serialize({ bounds: audit.board.bounds, minimumWidth: viewport.minBoard }));
	if (viewport.minBoardViewportRatio) {
		const boardViewportRatio = audit.board.bounds ? audit.board.bounds.width / audit.viewport.width : 0;
		check(
			group,
			'reference desktop board occupies its configured dominant viewport share',
			Boolean(audit.board.bounds && boardViewportRatio >= viewport.minBoardViewportRatio && (!viewport.maxBoardViewportRatio || boardViewportRatio <= viewport.maxBoardViewportRatio)),
			serialize({ bounds: audit.board.bounds, viewport: audit.viewport, boardViewportRatio, minimumRatio: viewport.minBoardViewportRatio, maximumRatio: viewport.maxBoardViewportRatio ?? null }),
		);
	}
	const normalizedBoard = audit.board.bounds ? {
		left: (audit.board.bounds.left - audit.scene.bounds.left) / audit.scene.bounds.width,
		top: (audit.board.bounds.top - audit.scene.bounds.top) / audit.scene.bounds.height,
		width: audit.board.bounds.width / audit.scene.bounds.width,
		height: audit.board.bounds.height / audit.scene.bounds.height,
	} : null;
	const apertureTolerance = 0.05;
	check(
		group,
		'premium board is registered to its responsive shell aperture',
		Boolean(normalizedBoard && Object.entries(expectedMachineShell.aperture).every(
			([key, expectedValue]) => Math.abs(normalizedBoard[key] - expectedValue) <= apertureTolerance,
		)),
		serialize({ normalizedBoard, aperture: expectedMachineShell.aperture, apertureTolerance }),
	);
	const expectedMarkerIds = Array.from({ length: PAYLINES.length }, (_, lineId) => String(lineId));
	const compactRasterComposition = expectedMachineShell !== MACHINE_SHELL_ASSETS.wide;
	for (const [side, markers] of Object.entries(audit.lineMarkers)) {
		check(
			group,
			`${side} gutter exposes all ten fixed payline marker identities in its responsive visibility state`,
			markers.length === 10 &&
				serialize(markers.map(({ lineId }) => lineId)) === serialize(expectedMarkerIds) &&
				(compactRasterComposition
					? markers.every(({ visible }) => !visible)
					: markers.every(({ visible, bounds }) => visible && bounds && bounds.width > 0 && bounds.height > 0)),
			serialize({ compactRasterComposition, markers }),
		);
	}
	const visibleLineMarkers = [...audit.lineMarkers.left, ...audit.lineMarkers.right]
		.filter(({ visible }) => visible).length;
	check(
		group,
		'line gutters mount twenty authoritative marker instances and follow responsive visibility',
		audit.lineMarkers.left.length + audit.lineMarkers.right.length === 20 &&
			visibleLineMarkers === (compactRasterComposition ? 0 : 20),
		serialize({ compactRasterComposition, visibleLineMarkers, lineMarkers: audit.lineMarkers }),
	);
	if (expectedMachineShell === MACHINE_SHELL_ASSETS.shortLandscape) {
		check(
			group,
			'Quick Start HUD stays mounted but yields its limited short-landscape space to the reels',
			audit.quickStartHud.exists && !audit.quickStartHud.visible,
			serialize(audit.quickStartHud),
		);
	} else {
		check(group, 'Quick Start HUD is visible inside the slot monitor and exposes lines/WILD/VAULT', audit.quickStartHud.exists && audit.quickStartHud.visible && audit.quickStartHud.insideViewport && audit.quickStartHud.insideSlotMonitor && /10\s*FIXED LINES/iu.test(audit.quickStartHud.text) && /WILD/iu.test(audit.quickStartHud.text) && /VAULT/iu.test(audit.quickStartHud.text), serialize(audit.quickStartHud));
	}
	for (const action of audit.actions) {
		check(group, `${action.selector} exists and is visible`, action.exists && action.visible, serialize(action));
		check(group, `${action.selector} is inside viewport`, action.insideViewport, serialize(action.bounds));
		if (action.bottomHudAction) {
			if (action.selector === SELECTORS.primaryAction) {
				check(
					group,
					`${action.selector} stays inside the premium scene and Bottom HUD horizontally, with only the shell-specific target top protrusion`,
					action.insideScene && action.insideBottomHudWithTargetSpinProtrusion,
					serialize({ bottomHud: audit.bottomHud.bounds, action }),
				);
			} else {
				check(group, `${action.selector} is enclosed by the Bottom HUD`, action.insideBottomHud, serialize({ bottomHud: audit.bottomHud.bounds, action: action.bounds }));
			}
		} else {
			check(group, `${action.selector} is enclosed by the slot monitor`, action.insideSlotMonitor, serialize({ slotMonitor: audit.slotMonitor.bounds, action: action.bounds }));
		}
		check(group, `${action.selector} is at least 44x44 CSS pixels`, Boolean(action.bounds && action.bounds.width >= 44 && action.bounds.height >= 44), serialize(action.bounds));
		check(group, `${action.selector} center is physically hittable`, action.centerHit, serialize(action));
	}
}

async function modeDialogGeometryAudit(page) {
	await page.waitForFunction(
		(selector) => [...document.querySelectorAll(selector)].some((element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			const animationsSettled = element.getAnimations({ subtree: true })
				.every((animation) => animation.playState !== 'running' && animation.playState !== 'pending');
			return style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) >= 0.99 &&
				bounds.width > 0 &&
				bounds.height > 0 &&
				animationsSettled;
		}),
		SELECTORS.modeDialog,
		{ timeout: 3_000 },
	);
	return page.evaluate(async (selectors) => {
		const rect = (element) => {
			if (!element) return null;
			const value = element.getBoundingClientRect();
			return {
				left: value.left,
				top: value.top,
				right: value.right,
				bottom: value.bottom,
				width: value.width,
				height: value.height,
			};
		};
		const isVisible = (element) => {
			if (!element) return false;
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0;
		};
		const inside = (outer, inner, tolerance = 1) => Boolean(
			outer && inner &&
			inner.left >= outer.left - tolerance &&
			inner.top >= outer.top - tolerance &&
			inner.right <= outer.right + tolerance &&
			inner.bottom <= outer.bottom + tolerance
		);
		const viewportBounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
		const dialog = [...document.querySelectorAll(selectors.modeDialog)]
			.find((candidate) => isVisible(candidate)) ?? null;
		const dialogBounds = rect(dialog);
		const modeSelectors = [selectors.modeBase, selectors.modeDeepAccess, selectors.modeBlackout];
		const modes = [];
		for (const selector of modeSelectors) {
			const element = dialog?.querySelector(selector) ?? null;
			element?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
			await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
			const bounds = rect(element);
			const hit = bounds
				? document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
				: null;
			modes.push({
				selector,
				exists: Boolean(element),
				visible: isVisible(element),
				bounds,
				insideDialog: inside(dialogBounds, bounds),
				insideViewport: inside(viewportBounds, bounds),
				centerHit: Boolean(element && hit) &&
					(element === hit || element.contains(hit)),
			});
		}
		return {
			dialog: {
				exists: Boolean(dialog),
				visible: isVisible(dialog),
				bounds: dialogBounds,
				insideViewport: inside(viewportBounds, dialogBounds),
				role: dialog?.getAttribute('role') ?? null,
				ariaModal: dialog?.getAttribute('aria-modal') ?? null,
			},
			modes,
		};
	}, SELECTORS);
}

function assertModeDialogGeometryRecord(group, audit) {
	check(group, 'BUY opens one visible aria-modal mode dialog inside the viewport', audit.dialog.exists && audit.dialog.visible && audit.dialog.insideViewport && audit.dialog.role === 'dialog' && audit.dialog.ariaModal === 'true', serialize(audit.dialog));
	check(group, 'BUY exposes exactly Base, Deep Access and Blackout mode actions', audit.modes.length === 3 && serialize(audit.modes.map(({ selector }) => selector)) === serialize([SELECTORS.modeBase, SELECTORS.modeDeepAccess, SELECTORS.modeBlackout]), serialize(audit.modes));
	for (const mode of audit.modes) {
		check(group, `${mode.selector} exists visibly inside the BUY dialog and viewport`, mode.exists && mode.visible && mode.insideDialog && mode.insideViewport, serialize(mode));
		check(group, `${mode.selector} is at least 44x44 CSS pixels`, Boolean(mode.bounds && mode.bounds.width >= 44 && mode.bounds.height >= 44), serialize(mode.bounds));
		check(group, `${mode.selector} center is physically hittable`, mode.centerHit, serialize(mode));
	}
}

async function runGeometryScenarios(browser, origin) {
	for (const viewport of viewports) {
		await runScenario(`geometry-${viewport.name}`, async (record) => {
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: viewport.isMobile ?? false,
				hasTouch: viewport.hasTouch ?? false,
			});
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: { authenticate: () => authenticateResponse() },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					liveQuery({ device: viewport.isMobile ? 'mobile' : 'desktop' }),
				);
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				const audit = await geometryAudit(page);
				audit.name = viewport.name;
				audit.surface = 'live';
				const { opener: modeOpener, dialog: modeDialog } = await openModeSelection(page);
				audit.modeDialog = await modeDialogGeometryAudit(page);
				audit.modeDialogScreenshot = await saveScreenshot(page, `geometry-${viewport.name}-buy`);
				assertModeDialogGeometryRecord(`geometry-${viewport.name}`, audit.modeDialog);
				await closeModeSelection(page, modeDialog);
				check(
					`geometry-${viewport.name}`,
					'closing BUY after geometry audit restores focus to its HUD opener',
					await modeOpener.evaluate((element) => document.activeElement === element),
					SELECTORS.hudShop,
				);
				audit.screenshot = await saveScreenshot(page, `geometry-${viewport.name}`);
				evidence.geometry.push(audit);
				assertGeometryRecord(`geometry-${viewport.name}`, audit, viewport, origin);
				assertCleanNetwork(`geometry-${viewport.name}`, network);
				await assertCleanDiagnostics(`geometry-${viewport.name}`, diagnostics);
				record.screenshot = audit.screenshot;
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	for (const viewport of replayViewports) {
		await runScenario(`geometry-${viewport.name}`, async (record) => {
			const group = `geometry-${viewport.name}`;
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: viewport.isMobile ?? false,
				hasTouch: viewport.hasTouch ?? false,
			});
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					replayOnly: true,
					handlers: { replay: () => replayResponse() },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					replayQuery({ device: 'mobile' }),
				);
				await waitForEndpoint(network, 'replay', 1);
				await waitForStableAction(page);
				const replayRequest = network.byEndpoint.replay[0];
				check(group, 'Popout Replay GET has the exact event path', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/1`, replayRequest.path);
				check(group, 'Popout Replay GET has no query parameters', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
				await page.locator(SELECTORS.primaryAction).click();
				await waitForReplayComplete(page);
				const audit = await geometryAudit(page);
				audit.name = viewport.name;
				audit.surface = 'replay-completed';
				audit.assumption = viewport.assumption;
				audit.screenshot = await saveScreenshot(page, `geometry-${viewport.name}`);
				evidence.geometry.push(audit);
				assertGeometryRecord(group, audit, viewport, origin);
				check(group, 'Popout Replay remains read-only', walletWriteCount(network) === 0, serialize(network.order));
				check(group, 'Popout Replay fetches exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
				assertCleanNetwork(group, network);
			await assertCleanDiagnostics(group, diagnostics);
				record.screenshot = audit.screenshot;
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}
}

function writeEvidence() {
	mkdirSync(artifactRoot, { recursive: true });
	evidence.identity.completedAt = new Date().toISOString();
	evidence.summary = {
		pass: evidence.checks.filter((item) => item.status === 'PASS').length,
		fail: evidence.checks.filter((item) => item.status === 'FAIL').length,
		scenarios: evidence.scenarios.length,
		passedScenarios: evidence.scenarios.filter((item) => item.status === 'PASS').length,
		failedScenarios: evidence.scenarios.filter((item) => item.status === 'FAIL').length,
	};
	writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main() {
	mkdirSync(artifactRoot, { recursive: true });
	let browser = null;
	let server = null;
	try {
		check('infrastructure', 'tested identity is a full git SHA', /^[0-9a-f]{40}$/i.test(gitSha), gitSha || '(empty)');
		check(
			'infrastructure',
			'tested worktree is clean or dirty development QA was explicitly opted in',
			!evidence.identity.worktreeDirty || allowDirtyDevelopmentRun,
			gitStatus || '(clean)',
		);
		check(
			'infrastructure',
			'custom build-root QA is pinned to an expected SHA-256 tree identity',
			!requestedBuildRoot || /^[0-9a-f]{64}$/u.test(expectedBuildTreeSha256),
			serialize({ requestedBuildRoot: requestedBuildRoot || null, expectedBuildTreeSha256: expectedBuildTreeSha256 || null }),
		);
		check('infrastructure', 'static BLACKSITE build exists', existsSync(buildEntry), relative(repoRoot, buildEntry));
		check(
			'infrastructure',
			'QA static server declares the WebP image MIME type',
			MIME_TYPES['.webp'] === 'image/webp',
			serialize(MIME_TYPES['.webp']),
		);
		check(
			'infrastructure',
			'QA static server declares the V29 WAV, OGG/Vorbis, Opus-in-Ogg and FLAC audio MIME types',
			MIME_TYPES['.wav'] === 'audio/wav' &&
				MIME_TYPES['.ogg'] === 'audio/ogg' &&
				MIME_TYPES['.opus'] === 'audio/ogg' &&
				MIME_TYPES['.flac'] === 'audio/flac',
			serialize({ wav: MIME_TYPES['.wav'], ogg: MIME_TYPES['.ogg'], opus: MIME_TYPES['.opus'], flac: MIME_TYPES['.flac'] }),
		);
		evidence.manifests.build = createFileManifest([buildRoot], buildRoot);
		evidence.manifests.sources = createFileManifest(sourceIdentityTargets, repoRoot);
		evidence.mathIdentity = verifyV19MathByteIdentity();
		evidence.identity.buildTreeSha256 = evidence.manifests.build.treeSha256;
		evidence.identity.sourceTreeSha256 = evidence.manifests.sources.treeSha256;
		check('infrastructure', 'build tree manifest contains files', evidence.manifests.build.fileCount > 0, serialize(evidence.manifests.build));
		check('infrastructure', 'build tree has a deterministic SHA-256 identity', /^[0-9a-f]{64}$/.test(evidence.identity.buildTreeSha256), evidence.identity.buildTreeSha256);
		if (expectedBuildTreeSha256) {
			check(
				'infrastructure',
				'tested build tree matches the caller-pinned package identity',
				/^[0-9a-f]{64}$/u.test(expectedBuildTreeSha256) &&
					evidence.identity.buildTreeSha256 === expectedBuildTreeSha256,
				serialize({
					expectedBuildTreeSha256,
					actualBuildTreeSha256: evidence.identity.buildTreeSha256,
				}),
			);
		}
		check('infrastructure', 'central source and lockfile manifest contains files', evidence.manifests.sources.fileCount > 0, serialize(evidence.manifests.sources));
		check('infrastructure', 'central source and lockfile tree has a deterministic SHA-256 identity', /^[0-9a-f]{64}$/.test(evidence.identity.sourceTreeSha256), evidence.identity.sourceTreeSha256);
		check(
			'infrastructure',
			'V18 Math baseline is present with the immutable seven-file package shape',
			evidence.mathIdentity.v18Exists &&
				evidence.mathIdentity.v18?.fileCount === 7 &&
				serialize(evidence.mathIdentity.v18?.files.map(({ path }) => path)) === serialize([
					'base_books.jsonl.zst',
					'base_lookup.csv',
					'blackout_books.jsonl.zst',
					'blackout_lookup.csv',
					'deep_access_books.jsonl.zst',
					'deep_access_lookup.csv',
					'index.json',
				]),
			serialize(evidence.mathIdentity),
		);
		check(
			'infrastructure',
			'V19 Math output is byte-identical to V18 whenever a V19 package is supplied or required',
			(!evidence.mathIdentity.required && !evidence.mathIdentity.v19Exists) ||
				(evidence.mathIdentity.v19Exists && evidence.mathIdentity.byteIdentical),
			serialize(evidence.mathIdentity),
		);
		evidence.productionBuildScan = scanProductionBuild(evidence.manifests.build);
		check(
			'infrastructure',
			'complete generated production build matches the frozen V33 file, byte and delivery SHA-256 identity',
			evidence.manifests.build.fileCount === EXPECTED_COMPLETE_BUILD_FILE_COUNT
				&& evidence.manifests.build.totalBytes === EXPECTED_COMPLETE_BUILD_BYTES
				&& evidence.productionBuildScan.completeBuildDeliveryTreeSha256
					=== EXPECTED_COMPLETE_BUILD_DELIVERY_TREE_SHA256,
			serialize({
				actual: {
					fileCount: evidence.manifests.build.fileCount,
					totalBytes: evidence.manifests.build.totalBytes,
					deliveryTreeSha256: evidence.productionBuildScan.completeBuildDeliveryTreeSha256,
				},
				expected: {
					fileCount: EXPECTED_COMPLETE_BUILD_FILE_COUNT,
					totalBytes: EXPECTED_COMPLETE_BUILD_BYTES,
					deliveryTreeSha256: EXPECTED_COMPLETE_BUILD_DELIVERY_TREE_SHA256,
				},
			}),
		);
		const forbiddenProductionAssets = evidence.productionBuildScan.runtimeAssets
			.filter((path) => FORBIDDEN_PRODUCTION_ASSET_PATTERN.test(path));
		check('infrastructure', 'production build contains no Stake Engine Loader signature', evidence.productionBuildScan.loaderHits.length === 0, serialize(evidence.productionBuildScan.loaderHits));
		check('infrastructure', 'production build excludes generated fixture catalog and fixture IDs', evidence.productionBuildScan.generatedFixtureHits.length === 0, serialize(evidence.productionBuildScan.generatedFixtureHits));
		check(
			'infrastructure',
			'production build contains exactly the manifest-declared BLACKSITE runtime assets',
			serialize(evidence.productionBuildScan.runtimeAssets) === serialize(EXPECTED_RUNTIME_ASSET_PATHS),
			serialize({ actual: evidence.productionBuildScan.runtimeAssets, expected: EXPECTED_RUNTIME_ASSET_PATHS }),
		);
		check(
			'infrastructure',
			'BLACKSITE static delivery contains exactly the declared 408-file Penguin/V29/V33 production type closure',
			evidence.productionBuildScan.runtimeAssets.length === EXPECTED_RUNTIME_ASSET_PATHS.length &&
				serialize(evidence.productionBuildScan.runtimeAssetTypeCounts) === serialize(EXPECTED_RUNTIME_ASSET_TYPE_COUNTS) &&
				serialize(evidence.productionBuildScan.runtimeJsonAssets) === serialize(EXPECTED_RUNTIME_JSON_ASSETS) &&
				evidence.productionBuildScan.runtimePngAssets.length === 0 &&
				evidence.productionBuildScan.svgRuntimeAssets.length === 0,
			serialize({
				total: evidence.productionBuildScan.runtimeAssets.length,
				typeCounts: evidence.productionBuildScan.runtimeAssetTypeCounts,
				jsonAssets: evidence.productionBuildScan.runtimeJsonAssets,
				png: evidence.productionBuildScan.runtimePngAssets,
				svg: evidence.productionBuildScan.svgRuntimeAssets,
			}),
		);
		check(
			'infrastructure',
			'production cinematic closure contains the canonical V26 feature film plus the supplied V33 startup MP4',
			serialize(PRODUCTION_CINEMATIC_ASSETS.map(productionAssetPath)) ===
				serialize(EXPECTED_V26_CINEMATIC_ASSET_PATHS) &&
			serialize(evidence.productionBuildScan.runtimeMp4Assets) ===
				serialize([
					EXPECTED_V26_CINEMATIC_ASSET_PATHS[0],
					'assets/blacksite/v33/intro/blacksite-vault-opening-v33.mp4',
				]) &&
			serialize(evidence.productionBuildScan.runtimeV26CinematicAssetRecords) ===
				serialize(EXPECTED_V26_CINEMATIC_ASSET_RECORDS),
			serialize({
				catalog: PRODUCTION_CINEMATIC_ASSETS.map(productionAssetPath),
				mp4Assets: evidence.productionBuildScan.runtimeMp4Assets,
				actualRecords: evidence.productionBuildScan.runtimeV26CinematicAssetRecords,
				expectedRecords: EXPECTED_V26_CINEMATIC_ASSET_RECORDS,
			}),
		);
		check(
			'infrastructure',
			'BLACKSITE runtime asset bytes and SHA-256 exactly match the immutable production closure',
			evidence.productionBuildScan.runtimeAssetBytes === EXPECTED_RUNTIME_ASSET_BYTES &&
				evidence.productionBuildScan.runtimeAssetTreeSha256 === EXPECTED_RUNTIME_ASSET_TREE_SHA256 &&
				evidence.productionBuildScan.runtimeAssetBytes < MAX_RUNTIME_ASSET_BYTES,
			serialize({
				actualBytes: evidence.productionBuildScan.runtimeAssetBytes,
				expectedBytes: EXPECTED_RUNTIME_ASSET_BYTES,
				actualTreeSha256: evidence.productionBuildScan.runtimeAssetTreeSha256,
				expectedTreeSha256: EXPECTED_RUNTIME_ASSET_TREE_SHA256,
				maximumBytes: MAX_RUNTIME_ASSET_BYTES,
			}),
		);
		check(
			'infrastructure',
			'complete generated production build remains below the strict 64 MiB ceiling',
			evidence.manifests.build.totalBytes < MAX_RUNTIME_ASSET_BYTES,
			serialize({ actualBytes: evidence.manifests.build.totalBytes, maximumBytes: MAX_RUNTIME_ASSET_BYTES }),
		);
		check(
			'infrastructure',
			'production asset contract contains the complete Penguin character, V22 Penguin reel identity, V26 film, V27 UI, V28 environment, curated V29 audio and V33 startup delivery',
			Object.values(SYMBOL_STATE_ASSETS).flatMap(Object.values).length === 43 &&
				new Set(Object.values(SYMBOL_STATE_ASSETS).flatMap(Object.values)).size === 42 &&
				V19_PRESENTATION_ASSETS.length === 6 &&
				Object.values(PREMIUM_HUD_ASSETS).flatMap(Object.values).length === 55 &&
				PREMIUM_PANEL_ASSETS.length === 13 &&
				Object.keys(DIALOG_ASSETS).length === 7 &&
				PAYLINE_ASSETS.length === 10 &&
				REEL_STRIP_ASSETS.length === 5 &&
				PENGUIN_CHARACTER_ASSETS.length === 27 &&
				V21_UI_ASSETS.length === 13 &&
				Object.values(ENVIRONMENT_ASSETS).length === 5 &&
				V22_UI_ASSETS.length === 6 &&
				PRODUCTION_CINEMATIC_ASSETS.length === 2 &&
				PRODUCTION_AUDIO_ASSETS.length === 122 &&
				BLACKSITE_AUDIO_V28_FILES.length === 121 &&
				PRODUCTION_AUDIO_ASSETS.every((path) => path.startsWith('v29/audio/')) &&
				PRODUCTION_AUDIO_ASSETS.includes('v29/audio/audio-manifest.json') &&
				V27_UI_ASSETS.length === 8 &&
				V28_ENVIRONMENT_ASSETS.length === 6 &&
				V33_INTRO_ASSETS.length === 3 &&
				serialize(V33_INTRO_ASSETS.map(productionAssetPath).sort((left, right) => left.localeCompare(right, 'en'))) ===
					serialize(EXPECTED_V33_STARTUP_ASSET_PATHS) &&
				EXPECTED_RUNTIME_ASSET_PATHS.length === 408,
			serialize({
				symbolStates: Object.values(SYMBOL_STATE_ASSETS).flatMap(Object.values).length,
				hudStates: Object.values(PREMIUM_HUD_ASSETS).flatMap(Object.values).length,
				panels: PREMIUM_PANEL_ASSETS.length,
				dialogs: Object.keys(DIALOG_ASSETS).length,
				paylines: PAYLINE_ASSETS.length,
				reelStrips: REEL_STRIP_ASSETS.length,
				penguinCharacterAssets: PENGUIN_CHARACTER_ASSETS.length,
				v19PresentationAssets: V19_PRESENTATION_ASSETS.length,
				v21UiAssets: V21_UI_ASSETS.length,
				v22EnvironmentAssets: Object.values(ENVIRONMENT_ASSETS).length,
				v22UiAssets: V22_UI_ASSETS.length,
				productionCinematicAssets: PRODUCTION_CINEMATIC_ASSETS.length,
				productionAudioAssets: PRODUCTION_AUDIO_ASSETS.length,
				v27UiAssets: V27_UI_ASSETS.length,
				v28EnvironmentAssets: V28_ENVIRONMENT_ASSETS.length,
				v33StartupAssets: V33_INTRO_ASSETS.length,
				total: EXPECTED_RUNTIME_ASSET_PATHS.length,
			}),
		);
		check(
			'infrastructure',
			'production FX closure exposes exactly 78 unique standalone alpha-WebP frames and no adult operator frame',
			PRODUCTION_RUNTIME_FX_ASSETS.length === 78 &&
				new Set(PRODUCTION_RUNTIME_FX_ASSETS).size === 78 &&
				PRODUCTION_RUNTIME_FX_ASSETS.every((path) => EXPECTED_RUNTIME_ASSET_PATHS.includes(productionAssetPath(path))),
			serialize({ standaloneFxFrames: PRODUCTION_RUNTIME_FX_ASSETS.length }),
		);
		check(
			'infrastructure',
			'production closure excludes adult/human, V24, DEV, old reel chrome, V19/V28 audio and 2160p assets',
			forbiddenProductionAssets.length === 0,
			serialize(forbiddenProductionAssets),
		);
		check(
			'infrastructure',
			'production BLACKSITE runtime contains no PNG/SVG file or runtime PNG/SVG reference',
			evidence.productionBuildScan.svgRuntimeAssets.length === 0 &&
				evidence.productionBuildScan.svgReferenceHits.length === 0 &&
				evidence.productionBuildScan.runtimePngAssets.length === 0 &&
				evidence.productionBuildScan.runtimePngReferenceHits.length === 0,
			serialize({
				svgRuntimeAssets: evidence.productionBuildScan.svgRuntimeAssets,
				svgReferenceHits: evidence.productionBuildScan.svgReferenceHits,
				runtimePngAssets: evidence.productionBuildScan.runtimePngAssets,
				runtimePngReferenceHits: evidence.productionBuildScan.runtimePngReferenceHits,
			}),
		);
		check(
			'infrastructure',
			'BLACKSITE production source and deployed runtime manifest contain no PNG reference',
			evidence.productionBuildScan.sourceRuntimePngReferenceHits.length === 0,
			serialize(evidence.productionBuildScan.sourceRuntimePngReferenceHits),
		);
		check(
			'infrastructure',
			'production build contains no v2 contract or superseded asset signature',
			evidence.productionBuildScan.legacyContractHits.length === 0 &&
				evidence.productionBuildScan.runtimeAssets.every((path) => !LEGACY_ASSET_PATTERN.test(path)),
			serialize(evidence.productionBuildScan.legacyContractHits),
		);
		const viewportContent = evidence.productionBuildScan.viewportMeta.content ?? '';
		check('infrastructure', 'production viewport meta binds device width and initial scale', /(?:^|,)\s*width=device-width(?:\s*,|$)/iu.test(viewportContent) && /(?:^|,)\s*initial-scale=1(?:\s*,|$)/iu.test(viewportContent), viewportContent || '(missing)');
		check('infrastructure', 'production viewport meta preserves user zoom and covers safe areas', !/maximum-scale\s*=/iu.test(viewportContent) && !/user-scalable\s*=\s*(?:no|0)/iu.test(viewportContent) && /(?:^|,)\s*viewport-fit=cover(?:\s*,|$)/iu.test(viewportContent), viewportContent || '(missing)');
		check('infrastructure', 'production CSS contains touch-action manipulation contract', evidence.productionBuildScan.touchActionManipulationPresent, serialize(evidence.productionBuildScan));
		const resolvedPlaywright = resolvePlaywright();
		evidence.playwright.version = resolvedPlaywright.version;
		const launched = await launchBrowser(resolvedPlaywright.playwright);
		browser = launched.browser;
		evidence.playwright.browser = browser.version();
		evidence.playwright.executable = launched.executablePath;
		const staticServer = await startStaticServer();
		server = staticServer.server;
		await runAudioDecodeScenario(browser, staticServer.origin);
		await runBootSequenceScenarios(browser, staticServer.origin);
		await runNetworkScenarios(browser, staticServer.origin);
		await runGeometryScenarios(browser, staticServer.origin);
	} catch (error) {
		recordFailure('infrastructure', error);
	} finally {
		if (browser) await browser.close().catch(() => {});
		if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
		writeEvidence();
	}

	for (const item of evidence.checks) {
		console.log(`${item.status} [${item.group}] ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
	}
	console.log(`BLACKSITE browser evidence: ${relative(repoRoot, evidenceFile).replaceAll('\\', '/')}`);
	if (evidence.summary.fail > 0 || evidence.summary.failedScenarios > 0) process.exitCode = 1;
}

await main();
