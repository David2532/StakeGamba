import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectWebp } from '../../../scripts/blacksite-validate-runtime-rgba.mjs';
import {
	BLACKSITE_ASSETS,
	SYMBOL_MASTER_IDS,
} from '../src/lib/assets/blacksite-assets.js';
import {
	BLACKSITE_AUDIO_RUNTIMEPACK_FILES,
	BLACKSITE_AUDIO_RUNTIMEPACK_RUNTIME_MANIFEST,
} from '../src/lib/assets/blacksite-audio-v28.js';
import { BLACKSITE_INTRO_MANIFEST_URL } from '../src/lib/assets/blacksite-intro-assets.js';
import {
	OPERATOR_ANIMATION_CATALOG,
	OPERATOR_FX_CATALOG,
	OPERATOR_STATIC_KEYPOSES,
	RUNTIME_RGBA_MANIFEST_URL,
} from '../src/lib/assets/operator-animation-assets.js';
import { PENGUIN_OPERATOR_CLIPS } from '../src/lib/assets/penguin-operator-assets.js';
import {
	BLACKSITE_SYMBOL_LIBRARY,
	BLACKSITE_UI_ASSET_REGISTRY,
	assertBlacksiteAssetRegistry,
} from '../src/lib/assets/blacksite-asset-registry.js';
import { BLACKSITE_AUDIO_ASSETS } from '../src/lib/runtime/blacksite-audio-director.js';

const EXPECTED_OPERATOR_SEQUENCES = Object.freeze({
	idle: Object.freeze({ id: 'CHAR_IDLE_WATCH', frameCount: 12, fps: 8, loop: true }),
	loss: Object.freeze({ id: 'CHAR_LOSS_SINGLE', frameCount: 16, fps: 10, loop: false }),
	lossStreak: Object.freeze({ id: 'CHAR_LOSS_STREAK', frameCount: 20, fps: 12, loop: false }),
	win: Object.freeze({ id: 'CHAR_WIN_HAPPY', frameCount: 18, fps: 12, loop: false }),
	bigWin: Object.freeze({ id: 'CHAR_BIG_WIN', frameCount: 20, fps: 12, loop: false }),
	bonus: Object.freeze({ id: 'CHAR_BONUS_TOSS', frameCount: 20, fps: 12, loop: false }),
	rage: Object.freeze({ id: 'CHAR_RAGE_PC_SMASH', frameCount: 24, fps: 14, loop: false }),
});

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

const EXPECTED_SYMBOL_STATES = Object.freeze(Object.fromEntries(
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

const EXPECTED_SYMBOL_MASTERS = Object.freeze(Object.fromEntries(
	Object.entries(EXPECTED_SYMBOL_STATES).map(([symbolId, states]) => [symbolId, states.base]),
));

const EXPECTED_ENVIRONMENT_ART = Object.freeze({
	desktop: Object.freeze({ path: 'environment/server-bunker-desktop-v1.webp', width: 1672, height: 941, hasAlpha: false }),
	premiumMachine: Object.freeze({
		path: 'environment/premium-machine-shell-v1.webp',
		width: 1672,
		height: 941,
		hasAlpha: false,
	}),
	premiumMachinePortrait: Object.freeze({ path: 'environment/premium-machine-shell-portrait-v1.webp', width: 768, height: 1024, hasAlpha: false }),
	premiumMachinePhone: Object.freeze({ path: 'environment/premium-machine-shell-phone-v1.webp', width: 390, height: 844, hasAlpha: false }),
	premiumMachineShortLandscape: Object.freeze({ path: 'environment/premium-machine-shell-short-landscape-v1.webp', width: 844, height: 390, hasAlpha: false }),
});

const EXPECTED_V22_ENVIRONMENT_ART = Object.freeze({
	premiumMachineV22: Object.freeze({
		path: 'v22/environment/premium-machine-shell-v22.webp',
		width: 1672,
		height: 941,
		hasAlpha: false,
		bytes: 218554,
		sha256: 'a82be9c86a4aa512c97b834b7869c8c563c90f86c5610c3ff82ef1f70b802160',
	}),
	premiumMachinePortraitV22: Object.freeze({
		path: 'v22/environment/premium-machine-shell-portrait-v22.webp',
		width: 768,
		height: 1024,
		hasAlpha: false,
		bytes: 157792,
		sha256: '45417369d4be318f738808423d7d926ede0a41d5d38d90fafdba6a245db06f4b',
	}),
	premiumMachinePhoneV22: Object.freeze({
		path: 'v22/environment/premium-machine-shell-phone-v22.webp',
		width: 390,
		height: 844,
		hasAlpha: false,
		bytes: 233916,
		sha256: 'feea830b31cc157423d41aeb29a932c498c8b90b49e8b1c7276fe7f08465afd8',
	}),
	premiumMachineCompactPhoneV22: Object.freeze({
		path: 'v22/environment/premium-machine-shell-compact-phone-v22.webp',
		width: 320,
		height: 568,
		hasAlpha: false,
		bytes: 32212,
		sha256: 'de4a828f79452e1dce2b06cbe066018c35730fca6b339dd42ecd1f7739b57a3f',
	}),
	premiumMachineShortLandscapeV22: Object.freeze({
		path: 'v22/environment/premium-machine-shell-short-landscape-v22.webp',
		width: 844,
		height: 390,
		hasAlpha: false,
		bytes: 57392,
		sha256: '0920755f8110ceabe047b5f42fba3774c315d174495a8ebc78c2fdcddb4368e9',
	}),
});

const EXPECTED_V22_OPERATIVE_ART = Object.freeze({
	base: Object.freeze({
		path: 'v22/symbols/operative/base.webp',
		width: 512,
		height: 512,
		hasAlpha: true,
		bytes: 46996,
		sha256: '0db1443e6b03e32f475e4080411abfbcc01d7caf4a172eeaa62cc64ec2dde802',
	}),
	win: Object.freeze({
		path: 'v22/symbols/operative/win.webp',
		width: 512,
		height: 512,
		hasAlpha: true,
		bytes: 54200,
		sha256: 'd347cfc88cb437dbe2fcc643634aac9eebeabf5dd36322f8dde257f87a954c54',
	}),
	dim: Object.freeze({
		path: 'v22/symbols/operative/dim.webp',
		width: 512,
		height: 512,
		hasAlpha: true,
		bytes: 44338,
		sha256: '14691eb87543257819c79d0043cb3560664e523bce65c1934313f38a55bf2181',
	}),
});

const PREMIUM_HUD_STATES = Object.freeze(['normal', 'hover', 'pressed', 'active', 'disabled']);
const EXPECTED_PREMIUM_HUD_ART = Object.freeze({
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

const EXPECTED_PREMIUM_PANEL_ART = Object.freeze({
	meterBet: Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-bet.webp', width: 480, height: 240 }),
	meterTotal: Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-total.webp', width: 420, height: 240 }),
	meterWin: Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-win.webp', width: 420, height: 240 }),
	meterBalance: Object.freeze({ path: 'ui/premium-hud-v2/panels/meter-balance.webp', width: 720, height: 220 }),
	howTo: Object.freeze({ path: 'ui/premium-hud-v2/panels/how-to.webp', width: 620, height: 180 }),
	ticker: Object.freeze({ path: 'ui/premium-hud-v2/panels/ticker.webp', width: 1600, height: 144 }),
});

const EXPECTED_DIALOG_ART = Object.freeze({
	mode: Object.freeze({ path: 'ui/premium-panels-v1/dialog-mode.webp', width: 1640, height: 640 }),
	menu: Object.freeze({ path: 'ui/premium-panels-v1/dialog-menu.webp', width: 1040, height: 480 }),
	confirmation: Object.freeze({ path: 'ui/premium-panels-v1/dialog-confirmation.webp', width: 1040, height: 680 }),
	rules: Object.freeze({ path: 'ui/premium-panels-v1/dialog-rules.webp', width: 1880, height: 1640 }),
	auto: Object.freeze({ path: 'ui/premium-panels-v1/dialog-auto.webp', width: 1080, height: 760 }),
	settings: Object.freeze({ path: 'ui/premium-panels-v1/dialog-settings.webp', width: 1040, height: 520 }),
	runtimeError: Object.freeze({ path: 'ui/premium-panels-v1/dialog-runtime-error.webp', width: 880, height: 520 }),
});

const EXPECTED_MODE_CARD_ART = Object.freeze(Object.fromEntries(
	['normal', 'hover', 'selected', 'disabled'].map((state) => [
		state,
		Object.freeze({ path: `ui/premium-hud-v2/panels/mode-card/${state}.webp`, width: 960, height: 360 }),
	]),
));

const EXPECTED_MARKER_ART = Object.freeze(Object.fromEntries(
	['normal', 'active', 'disabled'].map((state) => [
		state,
		Object.freeze({ path: `ui/premium-hud-v2/panels/marker/${state}.webp`, width: 128, height: 128 }),
	]),
));

const EXPECTED_REEL_STRIPS = Object.freeze(Array.from(
	{ length: 5 },
	(_, index) => `ui/reel-strips-v1/reel-${String(index + 1).padStart(2, '0')}.webp`,
));

const EXPECTED_V22_REEL_STRIPS = Object.freeze([
	Object.freeze({
		path: 'v22/ui/reel-strips/reel-01.webp',
		bytes: 546314,
		sha256: '416cf196e355a5a0d995471607b687db75ca448edf5c08bafb20f4ea2fe4d93b',
	}),
	Object.freeze({
		path: 'v22/ui/reel-strips/reel-02.webp',
		bytes: 539078,
		sha256: 'eab92f2511fda0c5b8bdf32f3843236780b1d27d0967a6310bae30189f20628c',
	}),
	Object.freeze({
		path: 'v22/ui/reel-strips/reel-03.webp',
		bytes: 573286,
		sha256: '4fc574ce66ad2ef7aedd4ae56b7bb2403550d8d7f0ae5f5c4f8da84952e2b810',
	}),
	Object.freeze({
		path: 'v22/ui/reel-strips/reel-04.webp',
		bytes: 571122,
		sha256: 'd223a730acb99fc76d52cd1e16115fcc6764449adf3bbb82eea4d5a2dd3f99d5',
	}),
	Object.freeze({
		path: 'v22/ui/reel-strips/reel-05.webp',
		bytes: 563832,
		sha256: '94da7858c7b7c1b808b66486ea0ffff9b877f6ccc971b57db4fd624470cff740',
	}),
]);

const EXPECTED_REEL_DEPTH_ART = Object.freeze({
	cellOverlay: Object.freeze({ path: 'ui/reel-depth-v1/reel-cell-depth-overlay.webp', width: 640, height: 512 }),
});

const EXPECTED_V26_CINEMATIC_ART = Object.freeze({
	vaultOpeningVideoV26: Object.freeze({
		path: 'v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
		width: 1280,
		height: 720,
		format: 'mp4',
		hasAlpha: false,
		bytes: 5956543,
		sha256: '5edad7d2f7c56ec48d3e6afd7c344c9b0704053baaeb14b2f7a0fd6084ac3acf',
	}),
	vaultOpeningPoster: Object.freeze({
		path: 'v26/cinematic/vault-opening-blackout-v26-poster-720p.webp',
		width: 1280,
		height: 720,
		format: 'webp',
		hasAlpha: false,
		bytes: 74342,
		sha256: 'c0ce502b59f7e9d51c6de1cb2758c74e920be52dd412ea1005deda50cf54d9f9',
	}),
});

const EXPECTED_V19_DEV_CINEMATIC_ART = Object.freeze({
	doorBase: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/door-base.webp', width: 1254, height: 1254 }),
	doorBack: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/door-back.webp', width: 1254, height: 1254 }),
	sideRim: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/side-rim.webp', width: 1254, height: 1254 }),
	wheel: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/wheel.webp', width: 1254, height: 1254 }),
	bolt: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/bolt.webp', width: 1254, height: 1254 }),
	portalLight: Object.freeze({ path: 'v19/cinematic/dev-rig-v1/portal-light.webp', width: 1672, height: 941 }),
});

const EXPECTED_AUDIO_ART = Object.freeze({
	baseAmbience: Object.freeze({
		path: 'audio/v19/base-ambience.mp3',
		sha256: '4f5e7f035dad8ce32d8c04393ec11470da52383dce0ffd421220c2de0ee2bf5d',
	}),
	featureAward: Object.freeze({
		path: 'audio/v19/free-spins-award.mp3',
		sha256: '208916af7b2b26ee70171a964595ace1ccaf4534abfbfa816d340179e13fe289',
	}),
	vaultAnticipation: Object.freeze({
		path: 'audio/v19/vault-anticipation.mp3',
		sha256: '4aba1f1a01f328e0337a3764eb89d8d69e13ea2a86929840c787f4d736565b82',
	}),
});

const DEV_RUNTIME_ROOT = 'runtime-rgba-dev-v1';
const DEV_RUNTIME_MANIFEST = `${DEV_RUNTIME_ROOT}/animation_manifest.json`;
const EXPECTED_DEV_RUNTIME_FILMS = Object.freeze([
	`${DEV_RUNTIME_ROOT}/CHAR_IDLE_WATCH_24FPS.webp`,
	`${DEV_RUNTIME_ROOT}/CHAR_IDLE_WATCH_60FPS.webp`,
]);
const PENGUIN_RUNTIME_ROOT = 'v20/penguin-operator';
const PENGUIN_RUNTIME_MANIFEST = `${PENGUIN_RUNTIME_ROOT}/manifest.json`;
const AUDIO_PROVENANCE_FILE = 'audio/v19/PROVENANCE.md';

const LEGACY_ASSET_NAMES = Object.freeze([
	'industrial-symbol-sheet-v1.png',
	'ghost-wild-v2.png',
	'breach-core-v2.png',
	'operative-idle-v1.png',
	'operative-male-v1.png',
	'operative-front-idle-v2.png',
	'operative-front-anticipation-v2.png',
	'operative-front-win-small-v2.png',
	'operative-front-win-big-v2.png',
	'operative-front-loss-v2.png',
	'operative-front-feature-v2.png',
]);

const assetRoot = new URL('../static/assets/blacksite/', import.meta.url);
const buildAssetRoot = new URL('../build/assets/blacksite/', import.meta.url);
const buildRoot = new URL('../build/', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);
const runtimeClips = Object.freeze([
	...Object.values(OPERATOR_ANIMATION_CATALOG),
	...Object.values(OPERATOR_FX_CATALOG),
	...Object.values(OPERATOR_STATIC_KEYPOSES),
]);
const runtimeWebpPaths = Object.freeze(runtimeClips.flatMap(({ frames }) => frames));

function relativeToBlacksiteRoot(assetPath) {
	const prefix = 'assets/blacksite/';
	assert.equal(assetPath.startsWith(prefix), true, `${assetPath} must be package-relative`);
	return assetPath.slice(prefix.length);
}

function relativeCatalogAssetPath(assetPath) {
	assert.equal(typeof assetPath, 'string');
	return relativeToBlacksiteRoot(assetPath.startsWith('/') ? assetPath.slice(1) : assetPath);
}

function relativePenguinManifestPath(assetPath) {
	const prefix = 'apps/blacksite/static/assets/blacksite/';
	const normalized = assetPath.replaceAll('\\', '/');
	assert.equal(normalized.startsWith(prefix), true, `${assetPath} must stay in the BLACKSITE runtime root`);
	return normalized.slice(prefix.length);
}

function metadataFromWebpBytes(bytes, expectedSize, label) {
	const errors = [];
	const metadata = inspectWebp(bytes, label, expectedSize, errors);
	if (expectedSize.hasAlpha === false) {
		const alphaError = `${label}: WebP must retain an alpha channel`;
		const alphaErrorIndex = errors.indexOf(alphaError);
		if (alphaErrorIndex !== -1) errors.splice(alphaErrorIndex, 1);
	}
	assert.deepEqual(errors, [], `${label} is a valid WebP delivery raster`);
	assert.ok(metadata, `${label} exposes WebP metadata`);
	return metadata;
}

async function readWebpMetadata(fileUrl, expectedSize, label = String(fileUrl)) {
	return metadataFromWebpBytes(await readFile(fileUrl), expectedSize, label);
}

async function collectRelativeFiles(directoryUrl, prefix = '') {
	const entries = await readdir(directoryUrl, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...await collectRelativeFiles(new URL(`${entry.name}/`, directoryUrl), relativePath));
		} else if (entry.isFile()) {
			files.push(relativePath);
		}
	}
	return files.sort();
}

function countFileTypes(paths) {
	const counts = {};
	for (const path of paths) {
		const match = /(?:^|\/)(?:[^/]+)(\.[^.\/]+)$/u.exec(path);
		const extension = match?.[1]?.toLowerCase() ?? '(none)';
		counts[extension] = (counts[extension] ?? 0) + 1;
	}
	return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, 'en')));
}

async function deliveryStats(root, paths) {
	const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right, 'en'));
	const treeHash = createHash('sha256');
	let bytes = 0;
	for (const path of sortedPaths) {
		const fileBytes = await readFile(new URL(path, root));
		const sha256 = createHash('sha256').update(fileBytes).digest('hex');
		bytes += fileBytes.byteLength;
		treeHash.update(`${path}\n${sha256}\n`, 'utf8');
	}
	return {
		fileCount: sortedPaths.length,
		bytes,
		treeSha256: treeHash.digest('hex'),
		typeCounts: countFileTypes(sortedPaths),
	};
}

async function deliveryGroupStats(root, paths) {
	const grouped = Object.groupBy(paths, (path) => path.split('/')[0]);
	return Object.fromEntries(await Promise.all(Object.entries(grouped).map(async ([group, groupPaths]) => {
		const stats = await deliveryStats(root, groupPaths);
		return [group, {
			files: stats.fileCount,
			bytes: stats.bytes,
			treeSha256: stats.treeSha256,
		}];
	})));
}

test('operator catalog exposes the seven manifest-backed reaction sequences exactly', async () => {
	assert.deepEqual(Object.keys(OPERATOR_ANIMATION_CATALOG), Object.keys(EXPECTED_OPERATOR_SEQUENCES));
	assert.equal(Object.isFrozen(OPERATOR_ANIMATION_CATALOG), true);
	assert.equal(
		RUNTIME_RGBA_MANIFEST_URL,
		'assets/blacksite/runtime-rgba-v1/animation_manifest.json',
	);
	const manifest = JSON.parse(await readFile(
		new URL(relativeToBlacksiteRoot(RUNTIME_RGBA_MANIFEST_URL), assetRoot),
		'utf8',
	));

	for (const [name, expected] of Object.entries(EXPECTED_OPERATOR_SEQUENCES)) {
		const clip = OPERATOR_ANIMATION_CATALOG[name];
		const declared = manifest.runtime_sequences[expected.id];
		assert.equal(clip.id, expected.id, `${name} sequence ID`);
		assert.equal(clip.frames.length, expected.frameCount, `${name} frame count`);
		assert.equal(clip.fps, expected.fps, `${name} fps`);
		assert.equal(clip.loop, expected.loop, `${name} loop contract`);
		assert.deepEqual(clip.frameSize, { width: 1280, height: 1024 }, `${name} geometry`);
		assert.deepEqual(clip.anchor, { x: 310, y: 1000 }, `${name} anchor`);
		assert.equal(declared.frame_count, expected.frameCount, `${name} manifest frame count`);
		assert.equal(declared.fps, expected.fps, `${name} manifest fps`);
		assert.equal(declared.loop, expected.loop, `${name} manifest loop`);
		assert.deepEqual(
			clip.frames,
			declared.frames.map((path) => `assets/blacksite/runtime-rgba-v1/${path}`),
			`${name} catalog paths match the supplied manifest in numeric order`,
		);
	}
});

test('every manifest-declared runtime WebP is package-relative, alpha-capable and has its declared geometry', async () => {
	assert.equal(runtimeWebpPaths.length, 215);
	assert.equal(new Set(runtimeWebpPaths).size, runtimeWebpPaths.length);
	for (const clip of runtimeClips) {
		for (const [index, assetPath] of clip.frames.entries()) {
			assert.doesNotMatch(assetPath, /^(?:[a-z]+:|\/|\\)/iu, `${assetPath} must not be absolute`);
			assert.doesNotMatch(assetPath, /(?:^|\/)\.\.?\//u, `${assetPath} must not traverse directories`);
			assert.match(assetPath, /\/rgba\/[^/]+\.webp$/u, `${assetPath} must come from rgba/`);
			if (clip.frames.length > 1) {
				assert.match(assetPath, new RegExp(`_${String(index).padStart(3, '0')}\\.webp$`, 'u'));
			}
			const metadata = await readWebpMetadata(
				new URL(relativeToBlacksiteRoot(assetPath), assetRoot),
				clip.frameSize,
				assetPath,
			);
			assert.equal(metadata.format, 'webp');
			assert.equal(metadata.has_alpha, true, `${assetPath} preserves its alpha channel`);
		}
	}
});

test('V19 exposes exactly thirteen ordered raster symbol state packs with the Vault trigger family', () => {
	assert.equal(assertBlacksiteAssetRegistry(), true);
	assert.deepEqual(SYMBOL_MASTER_IDS, Object.keys(EXPECTED_SYMBOL_MASTERS));
	assert.deepEqual(BLACKSITE_SYMBOL_LIBRARY.map(({ id }) => id), SYMBOL_MASTER_IDS);
	assert.deepEqual(BLACKSITE_ASSETS.symbols.master, Object.fromEntries(
		Object.entries(EXPECTED_SYMBOL_MASTERS).map(([id, path]) => [id, `assets/blacksite/${path}`]),
	));
	assert.deepEqual(BLACKSITE_ASSETS.symbols.states, Object.fromEntries(
		Object.entries(EXPECTED_SYMBOL_STATES).map(([id, states]) => [id, Object.fromEntries(
			Object.entries(states).map(([state, path]) => [state, `assets/blacksite/${path}`]),
		)]),
	));
	assert.equal(new Set(Object.values(BLACKSITE_ASSETS.symbols.master)).size, 13);
	assert(BLACKSITE_SYMBOL_LIBRARY.every(({ id, master, stateDelivery, states }) =>
		master === BLACKSITE_ASSETS.symbols.master[id]
		&& stateDelivery === 'dedicated-webp-state-pack'
		&& Object.keys(BLACKSITE_ASSETS.symbols.states[id]).every((state) => states.includes(state))));
	assert.match(BLACKSITE_UI_ASSET_REGISTRY.delivery, /webp/iu);
	assert.doesNotMatch(BLACKSITE_UI_ASSET_REGISTRY.delivery, /svg/iu);
});

test('all thirteen symbol packs decode as 512-square alpha WebP delivery rasters', async () => {
	const hashes = new Set();
	let stateCount = 0;
	for (const [symbolId, states] of Object.entries(EXPECTED_SYMBOL_STATES)) {
		assert.equal(Object.keys(states).length, ['ghost_wild', 'breach'].includes(symbolId) ? 5 : 3);
		for (const [state, relativePath] of Object.entries(states)) {
			const bytes = await readFile(new URL(relativePath, assetRoot));
			const sha256 = createHash('sha256').update(bytes).digest('hex');
			const expectedSharedTriggeredState = symbolId === 'breach' && state === 'triggered';
			assert.equal(
				hashes.has(sha256),
				expectedSharedTriggeredState,
				expectedSharedTriggeredState
					? 'BREACH win and triggered intentionally share the one V19 armed Vault raster'
					: `${symbolId}/${state} must be a dedicated raster`,
			);
			hashes.add(sha256);
			stateCount += 1;
			const metadata = metadataFromWebpBytes(bytes, { width: 512, height: 512 }, `${symbolId}/${state}`);
			assert.equal(metadata.has_alpha, true, `${symbolId}/${state} preserves alpha`);
			assert.ok(bytes.byteLength > 8 * 1024, `${symbolId}/${state} must contain production raster data`);
		}
	}
	assert.equal(stateCount, 43);
	assert.equal(hashes.size, stateCount - 1);
});

test('V22 production environment shells and Penguin operative states match immutable catalog rasters', async () => {
	assert.deepEqual(
		Object.fromEntries(Object.keys(EXPECTED_V22_ENVIRONMENT_ART).map((name) => [
			name,
			BLACKSITE_ASSETS.environment[name],
		])),
		Object.fromEntries(Object.entries(EXPECTED_V22_ENVIRONMENT_ART).map(([name, asset]) => [
			name,
			`assets/blacksite/${asset.path}`,
		])),
	);
	assert.deepEqual(
		BLACKSITE_ASSETS.symbols.states.operative,
		Object.fromEntries(Object.entries(EXPECTED_V22_OPERATIVE_ART).map(([state, asset]) => [
			state,
			`assets/blacksite/${asset.path}`,
		])),
	);

	const assets = [
		...Object.entries(EXPECTED_V22_ENVIRONMENT_ART).map(([name, asset]) => [`environment-${name}`, asset]),
		...Object.entries(EXPECTED_V22_OPERATIVE_ART).map(([state, asset]) => [`operative-${state}`, asset]),
	];
	const hashes = new Set();
	for (const [name, asset] of assets) {
		const bytes = await readFile(new URL(asset.path, assetRoot));
		assert.equal(bytes.byteLength, asset.bytes, `${name} byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${name} SHA-256`);
		const metadata = metadataFromWebpBytes(bytes, asset, name);
		assert.equal(metadata.has_alpha, asset.hasAlpha, `${name} alpha contract`);
		hashes.add(asset.sha256);
	}
	assert.equal(hashes.size, assets.length, 'every V22 environment/state raster remains dedicated');
});

test('premium machine shells and raster UI v2 package are package-safe catalog assets', async () => {
	assert.deepEqual(
		Object.fromEntries(Object.keys({
			...EXPECTED_ENVIRONMENT_ART,
			...EXPECTED_V22_ENVIRONMENT_ART,
		}).map((name) => [name, BLACKSITE_ASSETS.environment[name]])),
		Object.fromEntries([
			...Object.entries(EXPECTED_ENVIRONMENT_ART),
			...Object.entries(EXPECTED_V22_ENVIRONMENT_ART),
		].map(([name, asset]) => [
			name,
			`assets/blacksite/${asset.path}`,
		])),
	);
	assert.deepEqual(BLACKSITE_ASSETS.environment.v28Candidate, {
		status: 'catalogued-preload-candidate',
		runtimeOwner: 'v22-responsive-machine-shell',
		base: {
			desktop: 'assets/blacksite/v28/environment/base-desktop.webp',
			portrait: 'assets/blacksite/v28/environment/base-portrait.webp',
			shortLandscape: 'assets/blacksite/v28/environment/base-short-landscape.webp',
		},
		blackout: {
			desktop: 'assets/blacksite/v28/environment/blackout-interior-desktop.webp',
			portrait: 'assets/blacksite/v28/environment/blackout-interior-portrait.webp',
			shortLandscape: 'assets/blacksite/v28/environment/blackout-interior-short-landscape.webp',
		},
	});
	assert.deepEqual(
		BLACKSITE_ASSETS.ui.premiumHud,
		Object.fromEntries(Object.keys(EXPECTED_PREMIUM_HUD_ART).map((name) => [
			name,
			Object.fromEntries(PREMIUM_HUD_STATES.map((state) => [
				state,
				`assets/blacksite/ui/premium-hud-v2/controls/${name}/${state}.webp`,
			])),
		])),
	);
	assert.deepEqual(BLACKSITE_ASSETS.ui.premiumPanels, {
		dialogs: Object.fromEntries(Object.entries(EXPECTED_DIALOG_ART).map(([name, asset]) => [name, `assets/blacksite/${asset.path}`])),
		modeCard: Object.fromEntries(Object.entries(EXPECTED_MODE_CARD_ART).map(([state, asset]) => [state, `assets/blacksite/${asset.path}`])),
		meters: {
			bet: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.meterBet.path}`,
			total: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.meterTotal.path}`,
			win: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.meterWin.path}`,
			balance: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.meterBalance.path}`,
			howTo: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.howTo.path}`,
		},
		ticker: `assets/blacksite/${EXPECTED_PREMIUM_PANEL_ART.ticker.path}`,
		marker: Object.fromEntries(Object.entries(EXPECTED_MARKER_ART).map(([state, asset]) => [state, `assets/blacksite/${asset.path}`])),
	});

	const exactAssets = [
		...Object.entries(EXPECTED_ENVIRONMENT_ART),
		...Object.entries(EXPECTED_PREMIUM_PANEL_ART),
		...Object.entries(EXPECTED_DIALOG_ART).map(([name, asset]) => [`dialog-${name}`, asset]),
		...Object.entries(EXPECTED_MODE_CARD_ART).map(([state, asset]) => [`mode-card-${state}`, asset]),
		...Object.entries(EXPECTED_MARKER_ART).map(([state, asset]) => [`marker-${state}`, asset]),
	];
	for (const [name, asset] of exactAssets) {
		const assetUrl = new URL(asset.path, assetRoot);
		const metadata = await readWebpMetadata(assetUrl, asset, name);
		assert.equal(metadata.has_alpha, asset.hasAlpha ?? true, `${name} alpha contract`);
		assert.ok((await readFile(assetUrl)).byteLength > 1024, `${name} must contain production raster data`);
	}

	for (const [name, dimensions] of Object.entries(EXPECTED_PREMIUM_HUD_ART)) {
		const hashes = new Set();
		for (const state of PREMIUM_HUD_STATES) {
			const path = `ui/premium-hud-v2/controls/${name}/${state}.webp`;
			const assetUrl = new URL(path, assetRoot);
			const hasAlpha = state === 'active' || name === 'close' || name === 'resume';
			const metadata = await readWebpMetadata(
				assetUrl,
				{ ...dimensions, hasAlpha },
				`${name}/${state}`,
			);
			assert.equal(metadata.has_alpha, hasAlpha, `${name}/${state} preserves its authored alpha mode`);
			hashes.add(createHash('sha256').update(await readFile(assetUrl)).digest('hex'));
		}
		assert.equal(hashes.size, PREMIUM_HUD_STATES.length, `${name} must ship unique state rasters`);
	}
});

test('ten paylines ship as dedicated unique 1000x600 alpha WebP rasters', async () => {
	assert.deepEqual(BLACKSITE_ASSETS.ui.paylines, Array.from(
		{ length: 10 },
		(_, index) => `assets/blacksite/ui/paylines-v1/line-${String(index + 1).padStart(2, '0')}.webp`,
	));
	const hashes = new Set();
	for (const [index, assetPath] of BLACKSITE_ASSETS.ui.paylines.entries()) {
		const relativePath = relativeToBlacksiteRoot(assetPath);
		const bytes = await readFile(new URL(relativePath, assetRoot));
		const metadata = metadataFromWebpBytes(bytes, { width: 1000, height: 600 }, `line ${index + 1}`);
		assert.equal(metadata.has_alpha, true, `line ${index + 1} preserves alpha`);
		hashes.add(createHash('sha256').update(bytes).digest('hex'));
	}
	assert.equal(hashes.size, 10, 'each authoritative payline must have unique raster geometry');
});

test('spin overlay selects exactly five unique V22 Penguin 320x3840 opaque WebP reel strips', async () => {
	assert.deepEqual(BLACKSITE_ASSETS.ui.reelStrips, EXPECTED_V22_REEL_STRIPS.map(({ path }) =>
		`assets/blacksite/${path}`));
	const hashes = new Set();
	for (const [index, { path: relativePath }] of EXPECTED_V22_REEL_STRIPS.entries()) {
		const bytes = await readFile(new URL(relativePath, assetRoot));
		const metadata = metadataFromWebpBytes(
			bytes,
			{ width: 320, height: 3840, hasAlpha: false },
			`reel strip ${index + 1}`,
		);
		assert.equal(metadata.has_alpha, false, `reel strip ${index + 1} remains intentionally opaque`);
		hashes.add(createHash('sha256').update(bytes).digest('hex'));
	}
	assert.equal(hashes.size, 5, 'each reel must ship a dedicated deterministic strip');
});

test('V22 catalog orders exactly five immutable 320x3840 opaque WebP reel strips', async () => {
	const expectedCatalogPaths = EXPECTED_V22_REEL_STRIPS.map(({ path }) => `assets/blacksite/${path}`);
	assert.deepEqual(BLACKSITE_ASSETS.ui.v22.reelStrips, expectedCatalogPaths);

	let totalBytes = 0;
	const hashes = new Set();
	for (const [index, entry] of EXPECTED_V22_REEL_STRIPS.entries()) {
		const bytes = await readFile(new URL(entry.path, assetRoot));
		totalBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, entry.bytes, `V22 reel ${index + 1} byte count`);
		assert.equal(
			createHash('sha256').update(bytes).digest('hex'),
			entry.sha256,
			`V22 reel ${index + 1} SHA-256`,
		);
		const metadata = metadataFromWebpBytes(
			bytes,
			{ width: 320, height: 3840, hasAlpha: false },
			`V22 reel ${index + 1}`,
		);
		assert.equal(metadata.has_alpha, false, `V22 reel ${index + 1} remains intentionally opaque`);
		hashes.add(entry.sha256);
	}
	assert.equal(totalBytes, 2793632);
	assert.equal(hashes.size, 5, 'each V22 reel remains a dedicated deterministic strip');
	assert.deepEqual(
		await collectRelativeFiles(new URL('v22/ui/reel-strips/', assetRoot)),
		EXPECTED_V22_REEL_STRIPS.map(({ path }) => path.slice('v22/ui/reel-strips/'.length)).sort(),
	);
});

test('reel depth source and production V26 720p Vault cinematic are closed catalog-backed assets', async () => {
	assert.deepEqual(
		BLACKSITE_ASSETS.ui.reelDepth,
		Object.fromEntries(Object.entries(EXPECTED_REEL_DEPTH_ART).map(([name, asset]) => [
			name,
			`assets/blacksite/${asset.path}`,
		])),
	);
	assert.deepEqual(
		BLACKSITE_ASSETS.v19.cinematic,
		Object.fromEntries(Object.entries(EXPECTED_V26_CINEMATIC_ART).map(([name, asset]) => [
			name,
			`assets/blacksite/${asset.path}`,
		])),
	);
	const hashes = new Set();
	const assets = [
		...Object.entries(EXPECTED_REEL_DEPTH_ART),
		...Object.entries(EXPECTED_V26_CINEMATIC_ART),
		...Object.entries(EXPECTED_V19_DEV_CINEMATIC_ART),
	];
	for (const [name, asset] of assets) {
		const bytes = await readFile(new URL(asset.path, assetRoot));
		if (Number.isInteger(asset.bytes)) {
			assert.equal(bytes.byteLength, asset.bytes, `${name} byte count`);
		}
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		if (asset.sha256) {
			assert.equal(sha256, asset.sha256, `${name} SHA-256`);
		}
		if (asset.format === 'mp4') {
			assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp', `${name} has an ISO BMFF file-type box`);
			assert.equal(bytes.includes(Buffer.from('avc1')), true, `${name} declares H.264/AVC video`);
			assert.equal(bytes.includes(Buffer.from('mp4a')), true, `${name} retains its source AAC audio track`);
			assert.ok(bytes.byteLength > 5 * 1024 * 1024, `${name} contains the byte-preserved owner-supplied film`);
			hashes.add(sha256);
			continue;
		}
		const metadata = metadataFromWebpBytes(bytes, asset, name);
		assert.equal(metadata.has_alpha, asset.hasAlpha ?? true, `${name} preserves its authored alpha contract`);
		assert.ok(bytes.byteLength > 8 * 1024, `${name} contains production raster data`);
		hashes.add(sha256);
	}
	assert.equal(hashes.size, assets.length, 'cinematic and reel-depth layers remain dedicated rasters');
});

test('DEV interpolated operator package is manifest-closed and retains 1280x1024 alpha delivery', async () => {
	const manifest = JSON.parse(await readFile(new URL(DEV_RUNTIME_MANIFEST, assetRoot), 'utf8'));
	assert.deepEqual(
		{
			schemaVersion: manifest.schemaVersion,
			devOnly: manifest.devOnly,
			pack: manifest.pack,
			sequence: manifest.sequence,
			fps: manifest.fps,
			frameCount: manifest.frameCount,
			width: manifest.width,
			height: manifest.height,
			alpha: manifest.alpha,
		},
		{
			schemaVersion: 1,
			devOnly: true,
			pack: DEV_RUNTIME_ROOT,
			sequence: 'CHAR_IDLE_WATCH_24FPS',
			fps: 24,
			frameCount: 36,
			width: 1280,
			height: 1024,
			alpha: true,
		},
	);
	assert.equal(manifest.frames.length, manifest.frameCount);
	assert.equal(new Set(manifest.frames).size, manifest.frameCount);

	let frameBytes = 0;
	for (const [index, path] of manifest.frames.entries()) {
		assert.equal(
			path,
			`runtime_sequences/CHAR_IDLE_WATCH_24FPS/rgba/CHAR_IDLE_WATCH_24FPS_${String(index).padStart(3, '0')}.webp`,
		);
		const bytes = await readFile(new URL(`${DEV_RUNTIME_ROOT}/${path}`, assetRoot));
		frameBytes += bytes.byteLength;
		const metadata = metadataFromWebpBytes(bytes, manifest, path);
		assert.equal(metadata.has_alpha, true, `${path} preserves alpha`);
	}
	assert.equal(frameBytes, manifest.totalBytes, 'DEV frame bytes match the delivery manifest');

	const filmHashes = new Set();
	for (const path of EXPECTED_DEV_RUNTIME_FILMS) {
		const bytes = await readFile(new URL(path, assetRoot));
		const metadata = metadataFromWebpBytes(bytes, manifest, path);
		assert.equal(metadata.has_alpha, true, `${path} preserves alpha`);
		filmHashes.add(createHash('sha256').update(bytes).digest('hex'));
	}
	assert.equal(filmHashes.size, EXPECTED_DEV_RUNTIME_FILMS.length);
	assert.deepEqual(
		await collectRelativeFiles(new URL(`${DEV_RUNTIME_ROOT}/`, assetRoot)),
		[
			'CHAR_IDLE_WATCH_24FPS.webp',
			'CHAR_IDLE_WATCH_60FPS.webp',
			'animation_manifest.json',
			...manifest.frames,
		].sort(),
	);
});

test('V20 Penguin catalog and manifest declare exactly the same 26 alpha WebP clips', async () => {
	const manifest = JSON.parse(await readFile(new URL(PENGUIN_RUNTIME_MANIFEST, assetRoot), 'utf8'));
	const manifestClips = [...manifest.primaryClips, ...manifest.transitions];
	const manifestPaths = manifestClips.map(({ path }) => relativePenguinManifestPath(path));
	const catalogPaths = [...new Set(Object.values(PENGUIN_OPERATOR_CLIPS).map(({ source }) =>
		relativeCatalogAssetPath(source)))];
	assert.equal(manifest.schemaVersion, 6);
	assert.equal(manifest.devOnly, true);
	assert.deepEqual(manifest.canvas, { width: 1280, height: 1024 });
	assert.equal(manifestClips.length, 26);
	assert.equal(new Set(manifestPaths).size, 26);
	assert.deepEqual(catalogPaths.sort(), manifestPaths.sort());

	let runtimeBytes = 0;
	for (const clip of manifestClips) {
		const path = relativePenguinManifestPath(clip.path);
		const bytes = await readFile(new URL(path, assetRoot));
		runtimeBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, clip.bytes, `${clip.slug} manifest byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256, `${clip.slug} manifest hash`);
		const metadata = metadataFromWebpBytes(bytes, manifest.canvas, clip.slug);
		assert.equal(metadata.has_alpha, clip.alpha, `${clip.slug} alpha contract`);
	}
	assert.equal(runtimeBytes, manifest.runtimeBudget.totalBytes);
	assert.equal(manifest.runtimeBudget.runtimeWebpCount, manifestClips.length);
	assert.equal(runtimeBytes <= manifest.runtimeBudget.hardMaxBytes, true);
	assert.equal(manifest.runtimeBudget.pass, true);
	assert.deepEqual(
		await collectRelativeFiles(new URL(`${PENGUIN_RUNTIME_ROOT}/`, assetRoot)),
		['manifest.json', ...manifestPaths.map((path) => path.slice(`${PENGUIN_RUNTIME_ROOT}/`.length))].sort(),
	);
});

test('V21 UI catalog is byte-and-geometry identical to its closed 12-raster manifest', async () => {
	const catalog = BLACKSITE_ASSETS.ui.v21;
	const manifestPath = relativeToBlacksiteRoot(catalog.manifest);
	const manifest = JSON.parse(await readFile(new URL(manifestPath, assetRoot), 'utf8'));
	const root = `${catalog.root}/`;
	const catalogPaths = catalog.preload.map(relativeToBlacksiteRoot);
	const manifestPaths = manifest.files.map(({ path }) => `${root}${path}`);
	assert.equal(catalog.devOnly, false);
	assert.equal(catalog.sourceManifestDevOnly, true);
	assert.equal(catalog.version, 21);
	assert.equal(manifest.schema, 'blacksite-ui-kit-v21');
	assert.deepEqual(manifest.statePriority, catalog.statePrecedence);
	assert.deepEqual(manifest.control.states, catalog.states);
	assert.deepEqual(catalogPaths.sort(), manifestPaths.sort());
	assert.equal(new Set(catalogPaths).size, 12);

	const geometryByPath = new Map([
		...Object.values(catalog.nineSlice.control.states).map((path) => [
			relativeToBlacksiteRoot(path),
			{ width: catalog.nineSlice.control.width, height: catalog.nineSlice.control.height, hasAlpha: true },
		]),
		...Object.values(catalog.nineSlice.panel.states).map((path) => [
			relativeToBlacksiteRoot(path),
			{ width: catalog.nineSlice.panel.width, height: catalog.nineSlice.panel.height, hasAlpha: false },
		]),
		...Object.values(catalog.nineSlice.readout.states).map((path) => [
			relativeToBlacksiteRoot(path),
			{ width: catalog.nineSlice.readout.width, height: catalog.nineSlice.readout.height, hasAlpha: true },
		]),
		[
			relativeToBlacksiteRoot(catalog.atlases.roundStates.source),
			{ width: catalog.atlases.roundStates.width, height: catalog.atlases.roundStates.height, hasAlpha: true },
		],
		[
			relativeToBlacksiteRoot(catalog.atlases.glyphs.source),
			{ width: catalog.atlases.glyphs.width, height: catalog.atlases.glyphs.height, hasAlpha: true },
		],
	]);

	let totalBytes = 0;
	for (const file of manifest.files) {
		const path = `${root}${file.path}`;
		const bytes = await readFile(new URL(path, assetRoot));
		totalBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, file.bytes, `${file.path} manifest byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${file.path} manifest hash`);
		const expectedGeometry = geometryByPath.get(path);
		const metadata = metadataFromWebpBytes(bytes, expectedGeometry, file.path);
		assert.equal(metadata.has_alpha, expectedGeometry.hasAlpha, `${file.path} authored alpha mode`);
	}
	assert.equal(totalBytes, manifest.totalBytes);
	assert.deepEqual(
		await collectRelativeFiles(new URL(root, assetRoot)),
		['manifest.json', ...manifest.files.map(({ path }) => path)].sort(),
	);
});

test('V22 UI catalog and manifest close over five runtime masters plus five authoring WebPs', async () => {
	const catalog = BLACKSITE_ASSETS.ui.v22;
	const manifestPath = relativeToBlacksiteRoot(catalog.manifest);
	const manifest = JSON.parse(await readFile(new URL(manifestPath, assetRoot), 'utf8'));
	const root = `${catalog.root}/`;
	const manifestMasters = Object.values(manifest.masters);
	const manifestMasterPaths = manifestMasters.map(({ path }) => `${root}${path}`);
	const catalogMasterNames = ['control', 'panel', 'readout', 'reelStageInnerBezel', 'reelCellDepthOverlay'];
	const ownCatalogPaths = [...new Set([
		...Object.values(catalog.nineSlice.control.states),
		...Object.values(catalog.nineSlice.panel.states),
		...Object.values(catalog.nineSlice.readout.states),
		catalog.reelStage.innerBezel.source,
		catalog.reelStage.cellDepth.source,
	].map(relativeToBlacksiteRoot))];

	assert.equal(catalog.devOnly, false);
	assert.deepEqual(catalog.excludes, ['ui-authoring']);
	assert.equal(catalog.version, 22);
	assert.equal(manifest.schema, 'blacksite-ui-kit-v22');
	assert.equal(manifest.version, 22);
	assert.equal(manifest.devOnly, true);
	assert.equal(manifest.integrationStatus, 'asset-only-not-wired');
	assert.deepEqual(catalog.states, manifest.states);
	assert.deepEqual(Object.keys(manifest.stateDerivation.recipes), manifest.states);
	assert.deepEqual(
		Object.keys(manifest.masters),
		catalogMasterNames,
		'V22 manifest master identities are closed and ordered',
	);
	assert.deepEqual(
		ownCatalogPaths.sort(),
		catalogMasterNames.map((name) => `${root}${manifest.masters[name].path}`).sort(),
		'V22 catalog exposes every manifest runtime master exactly',
	);
	assert.equal(ownCatalogPaths.length, 5);
	assert.equal(manifestMasterPaths.length, 5);
	assert.equal(new Set(manifestMasterPaths).size, 5);
	assert.deepEqual(
		{
			path: manifest.masters.reelCellDepthOverlay.path,
			width: manifest.masters.reelCellDepthOverlay.width,
			height: manifest.masters.reelCellDepthOverlay.height,
			contentInsets: manifest.masters.reelCellDepthOverlay.contentInsets,
			centerMode: manifest.masters.reelCellDepthOverlay.centerMode,
			alpha: manifest.masters.reelCellDepthOverlay.alpha,
		},
		{
			path: 'reel-stage/cell-depth-overlay.webp',
			width: 640,
			height: 512,
			contentInsets: { top: 104, right: 104, bottom: 104, left: 104 },
			centerMode: 'transparent-opening',
			alpha: true,
		},
		'cell-depth master retains the intended delivery geometry and alpha role',
	);
	assert.deepEqual(
		catalog.reelStage.cellDepth,
		{
			source: `assets/blacksite/${root}${manifest.masters.reelCellDepthOverlay.path}`,
			width: manifest.masters.reelCellDepthOverlay.width,
			height: manifest.masters.reelCellDepthOverlay.height,
			sliceInsets: { top: 96, right: 96, bottom: 96, left: 96 },
		},
		'cell-depth catalog entry matches the manifest path, delivery geometry, and 9-slice contract',
	);

	const catalogSurfaces = {
		control: catalog.nineSlice.control,
		panel: catalog.nineSlice.panel,
		readout: catalog.nineSlice.readout,
		reelStageInnerBezel: catalog.reelStage.innerBezel,
	};
	for (const [name, surface] of Object.entries(catalogSurfaces)) {
		const declared = manifest.masters[name];
		assert.equal(surface.width, declared.width, `${name} catalog width`);
		assert.equal(surface.height, declared.height, `${name} catalog height`);
		assert.deepEqual(surface.contentInsets, declared.contentInsets, `${name} content insets`);
		if (surface.sliceInsets) assert.deepEqual(surface.sliceInsets, declared.sliceInsets, `${name} slice insets`);
		if (surface.states) {
			assert.deepEqual(Object.keys(surface.states), catalog.states, `${name} state coverage`);
			assert.deepEqual(
				[...new Set(Object.values(surface.states))],
				[`assets/blacksite/${root}${declared.path}`],
				`${name} states derive from one master`,
			);
		} else {
			assert.equal(surface.source, `assets/blacksite/${root}${declared.path}`);
		}
	}

	assert.deepEqual(
		[...new Set(catalog.preload.map(relativeToBlacksiteRoot))].sort(),
		[
			...ownCatalogPaths,
			...EXPECTED_V22_REEL_STRIPS.map(({ path }) => path),
			relativeToBlacksiteRoot(BLACKSITE_ASSETS.ui.v21.atlases.roundStates.source),
			relativeToBlacksiteRoot(BLACKSITE_ASSETS.ui.v21.atlases.glyphs.source),
		].sort(),
		'V22 catalog preloads all five masters, five reel strips, and deliberately reused V21 atlases only',
	);

	let runtimeBytes = 0;
	for (const entry of manifestMasters) {
		const path = `${root}${entry.path}`;
		const bytes = await readFile(new URL(path, assetRoot));
		runtimeBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, entry.bytes, `${entry.path} manifest byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.path} manifest hash`);
		const metadata = metadataFromWebpBytes(bytes, entry, entry.path);
		assert.equal(metadata.has_alpha, entry.alpha, `${entry.path} alpha contract`);
	}

	let authoringBytes = 0;
	for (const entry of manifest.authoringSources) {
		const path = `${root}${entry.path}`;
		const bytes = await readFile(new URL(path, assetRoot));
		authoringBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, entry.bytes, `${entry.path} manifest byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.path} manifest hash`);
		const metadata = metadataFromWebpBytes(bytes, entry, entry.path);
		assert.equal(metadata.has_alpha, true, `${entry.path} preserves authoring alpha`);
	}

	assert.equal(manifest.budgets.runtimeWebpCount, 5);
	assert.equal(manifest.budgets.runtimeWebpCount, manifestMasters.length);
	assert.equal(runtimeBytes, manifest.budgets.runtimeBytes);
	assert.equal(runtimeBytes <= manifest.budgets.runtimeHardMaxBytes, true);
	assert.equal(manifest.budgets.authoringWebpCount, 5);
	assert.equal(manifest.budgets.authoringWebpCount, manifest.authoringSources.length);
	assert.equal(authoringBytes, manifest.budgets.authoringBytes);
	assert.equal(authoringBytes <= manifest.budgets.authoringHardMaxBytes, true);
	assert.equal(runtimeBytes + authoringBytes, manifest.budgets.totalRasterBytes);
	assert.equal(manifest.budgets.totalRasterBytes <= manifest.budgets.totalRasterHardMaxBytes, true);
	assert.equal(manifest.budgets.pass, true);
	assert.deepEqual(manifest.qa.visiblePoliceLightPixels, { red: 0, cyan: 0, blue: 0, magenta: 0 });
	assert.deepEqual(
		{
			mode: manifest.qa.cellDepthOverlay.mode,
			safeOpeningAlphaMaximum: manifest.qa.cellDepthOverlay.safeOpeningAlphaMaximum,
			enclosed: manifest.qa.cellDepthOverlay.enclosed,
		},
		{ mode: 'RGBA', safeOpeningAlphaMaximum: 0, enclosed: true },
	);
	assert.equal(
		manifest.qa.cellDepthOverlay.connectedTransparentFraction
			>= manifest.masters.reelCellDepthOverlay.openingContract.minimumConnectedTransparentFraction,
		true,
	);
	assert.deepEqual(
		manifest.metadataFiles,
		[
			'manifest.json',
			'PROVENANCE.md',
			'authoring/PROMPTS.md',
			'authoring/build_v22_ui_kit.py',
			'authoring/validate_v22_ui_kit.py',
		],
	);
	assert.deepEqual(
		await collectRelativeFiles(new URL(root, assetRoot)),
		[
			...manifestMasters.map(({ path }) => path),
			...manifest.authoringSources.map(({ path }) => path),
			...manifest.metadataFiles,
		].sort(),
	);
});

test('V27 UI extension is a closed seven-raster runtime pack with live-content-safe surfaces', async () => {
	const catalog = BLACKSITE_ASSETS.ui.v27;
	const manifestPath = relativeToBlacksiteRoot(catalog.manifest);
	const manifest = JSON.parse(await readFile(new URL(manifestPath, assetRoot), 'utf8'));
	const root = `${catalog.root}/`;
	const surfaceKinds = ['feature', 'content', 'header', 'award', 'chip', 'progress'];
	const ownCatalogPaths = surfaceKinds.map((kind) => (
		relativeToBlacksiteRoot(catalog.nineSlice[kind].states.idle)
	));
	const rewardHaloPath = relativeToBlacksiteRoot(catalog.decor.rewardHalo);

	assert.equal(catalog.devOnly, false);
	assert.equal(catalog.version, 27);
	assert.equal(manifest.schema, 'blacksite-ui-kit-v27');
	assert.equal(manifest.version, 27);
	assert.equal(manifest.devOnly, false);
	assert.match(manifest.integrationStatus, /catalog-wired/u);
	assert.deepEqual(catalog.states, manifest.states);
	assert.deepEqual(Object.keys(manifest.nineSlice), surfaceKinds);
	assert.deepEqual(catalog.nineSlice.control, BLACKSITE_ASSETS.ui.v22.nineSlice.control);
	assert.deepEqual(catalog.nineSlice.panel, BLACKSITE_ASSETS.ui.v22.nineSlice.panel);
	assert.deepEqual(catalog.nineSlice.readout, BLACKSITE_ASSETS.ui.v22.nineSlice.readout);

	for (const kind of surfaceKinds) {
		const surface = catalog.nineSlice[kind];
		const declared = manifest.nineSlice[kind];
		assert.equal(surface.width, declared.width, `${kind} catalog width`);
		assert.equal(surface.height, declared.height, `${kind} catalog height`);
		assert.deepEqual(surface.sliceInsets, declared.sliceInsets, `${kind} slice insets`);
		assert.deepEqual(surface.contentInsets, declared.contentInsets, `${kind} content insets`);
		assert.deepEqual(Object.keys(surface.states), catalog.states, `${kind} state coverage`);
		assert.deepEqual(
			[...new Set(Object.values(surface.states))],
			[`assets/blacksite/${root}${declared.path}`],
			`${kind} states derive from one textless master`,
		);
	}

	assert.equal(catalog.decor.rewardHalo, `assets/blacksite/${root}${manifest.decor.rewardHalo.path}`);
	assert.deepEqual(catalog.decorGeometry.rewardHalo, {
		width: manifest.decor.rewardHalo.width,
		height: manifest.decor.rewardHalo.height,
		openingInsets: manifest.decor.rewardHalo.openingInsets,
	});
	assert.equal(new Set([...ownCatalogPaths, rewardHaloPath]).size, 7);
	assert.deepEqual(
		[...new Set(catalog.preload.map(relativeToBlacksiteRoot))].filter((path) => path.startsWith(root)).sort(),
		[...ownCatalogPaths, rewardHaloPath].sort(),
		'V27 preload exposes every own runtime raster exactly once',
	);

	let runtimeBytes = 0;
	for (const entry of [...Object.values(manifest.nineSlice), manifest.decor.rewardHalo]) {
		const path = `${root}${entry.path}`;
		const bytes = await readFile(new URL(path, assetRoot));
		runtimeBytes += bytes.byteLength;
		assert.equal(bytes.byteLength, entry.bytes, `${entry.path} byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.path} hash`);
		const metadata = metadataFromWebpBytes(bytes, entry, entry.path);
		assert.equal(metadata.has_alpha, true, `${entry.path} keeps alpha`);
		assert.deepEqual(entry.qa.cornerAlpha, [0, 0, 0, 0], `${entry.path} transparent corners`);
		assert.equal(entry.qa.invisibleRgbPixels, 0, `${entry.path} has no invisible RGB fringe`);
		assert.deepEqual(entry.qa.visiblePoliceLightPixels, { red: 0, cyan: 0, blue: 0, magenta: 0 });
	}
	assert.equal(runtimeBytes, manifest.budgets.runtimeBytes);
	assert.equal(runtimeBytes, 1635206);
	assert.equal(runtimeBytes <= manifest.budgets.runtimeHardMaxBytes, true);
	assert.equal(manifest.budgets.pass, true);
	assert.equal(manifest.materialSystem.textPolicy.includes('no baked live text'), true);
	assert.deepEqual(
		await collectRelativeFiles(new URL(root, assetRoot)),
		[...manifest.runtimeFiles, ...manifest.metadataFiles].sort(),
		'V27 static subtree contains runtime delivery only; authoring stays outside static',
	);
});

test('V19 audio catalog is a closed three-file package matching its provenance hashes', async () => {
	assert.deepEqual(
		BLACKSITE_AUDIO_ASSETS,
		Object.fromEntries(Object.entries(EXPECTED_AUDIO_ART).map(([name, asset]) => [
			name,
			`assets/blacksite/${asset.path}`,
		])),
	);
	const provenance = await readFile(new URL(AUDIO_PROVENANCE_FILE, assetRoot), 'utf8');
	for (const [name, asset] of Object.entries(EXPECTED_AUDIO_ART)) {
		const bytes = await readFile(new URL(asset.path, assetRoot));
		assert.ok(bytes.byteLength > 200 * 1024, `${name} contains runtime audio data`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${name} provenance hash`);
		assert.match(provenance, new RegExp(asset.sha256, 'u'));
	}
	assert.deepEqual(
		await collectRelativeFiles(new URL('audio/v19/', assetRoot)),
		['PROVENANCE.md', ...Object.values(EXPECTED_AUDIO_ART).map(({ path }) => path.slice('audio/v19/'.length))].sort(),
	);
});

test('production build closes exactly over the Penguin/V29/V33 asset contract and excludes adult/DEV media', async () => {
	const staticFiles = await collectRelativeFiles(assetRoot);
	const legacyHits = staticFiles.filter((path) => LEGACY_ASSET_NAMES.includes(path.split('/').at(-1)));
	assert.deepEqual(legacyHits, []);

	const expectedSymbolFiles = [...new Set(Object.values(EXPECTED_SYMBOL_STATES).flatMap(Object.values))].sort();
	const legacySourceOperativeFiles = ['base', 'win', 'dim'].map((state) =>
		`symbols/sym_01_operative/states-v4/${state}-v4.webp`);
	const expectedSourceUiFiles = [
		...Object.keys(EXPECTED_PREMIUM_HUD_ART).flatMap((name) => PREMIUM_HUD_STATES.map((state) => `ui/premium-hud-v2/controls/${name}/${state}.webp`)),
		...Object.values(EXPECTED_PREMIUM_PANEL_ART).map(({ path }) => path),
		...Object.values(EXPECTED_DIALOG_ART).map(({ path }) => path),
		...Object.values(EXPECTED_MODE_CARD_ART).map(({ path }) => path),
		...Object.values(EXPECTED_MARKER_ART).map(({ path }) => path),
		...Array.from({ length: 10 }, (_, index) => `ui/paylines-v1/line-${String(index + 1).padStart(2, '0')}.webp`),
		...EXPECTED_REEL_STRIPS,
		...Object.values(BLACKSITE_ASSETS.ui.reelDepth).map(relativeToBlacksiteRoot),
	].sort();
	assert.deepEqual(
		staticFiles.filter((path) => path.startsWith('symbols/')).sort(),
		[
			...expectedSymbolFiles.filter((path) => path.startsWith('symbols/')),
			...legacySourceOperativeFiles,
		].sort(),
		'the superseded adult operative remains source-only and never enters the production closure',
	);
	assert.deepEqual(staticFiles.filter((path) => path.startsWith('ui/')).sort(), expectedSourceUiFiles);
	assert.deepEqual(staticFiles.filter((path) => /\.svg$/iu.test(path)), []);
	assert.deepEqual(staticFiles.filter((path) => /\.png$/iu.test(path)), []);

	const sourceFiles = await collectRelativeFiles(sourceRoot);
	const svgSourceReferences = [];
	for (const relativePath of sourceFiles.filter((path) => /\.(?:js|svelte)$/u.test(path))) {
		const source = await readFile(new URL(relativePath, sourceRoot), 'utf8');
		if (/<svg\b|\.svg\b/iu.test(source)) svgSourceReferences.push(relativePath);
	}
	assert.deepEqual(svgSourceReferences, []);

	const productionRuntimeFxFiles = Object.values(OPERATOR_FX_CATALOG)
		.flatMap(({ frames }) => frames.map(relativeToBlacksiteRoot));
	const productionSymbolFiles = expectedSymbolFiles.filter((path) => path.startsWith('symbols/'));
	const productionUiFiles = expectedSourceUiFiles.filter((path) => (
		!path.startsWith('ui/reel-strips-v1/') && !path.startsWith('ui/reel-depth-v1/')
	));
	const productionV19Files = [
		...expectedSymbolFiles.filter((path) => path.startsWith('v19/')),
		...Object.values(BLACKSITE_ASSETS.v19.scenes).map(relativeToBlacksiteRoot),
		...Object.values(BLACKSITE_ASSETS.v19.modes).map(relativeToBlacksiteRoot),
	];

	const penguinManifest = JSON.parse(await readFile(new URL(PENGUIN_RUNTIME_MANIFEST, assetRoot), 'utf8'));
	const productionV20Files = [
		PENGUIN_RUNTIME_MANIFEST,
		...[...penguinManifest.primaryClips, ...penguinManifest.transitions]
			.map(({ path }) => relativePenguinManifestPath(path)),
	];
	assert.equal(productionV20Files.length, 27);
	assert.equal(new Set(productionV20Files).size, 27);

	const v21Catalog = BLACKSITE_ASSETS.ui.v21;
	const productionV21Files = [
		relativeToBlacksiteRoot(v21Catalog.manifest),
		...v21Catalog.preload.map(relativeToBlacksiteRoot),
	];
	const v22Catalog = BLACKSITE_ASSETS.ui.v22;
	const v22Manifest = JSON.parse(await readFile(
		new URL(relativeToBlacksiteRoot(v22Catalog.manifest), assetRoot),
		'utf8',
	));
	const productionV22Files = [
		relativeToBlacksiteRoot(v22Catalog.manifest),
		...Object.values(v22Manifest.masters).map(({ path }) => `${v22Catalog.root}/${path}`),
		...Object.values(EXPECTED_V22_ENVIRONMENT_ART).map(({ path }) => path),
		...Object.values(EXPECTED_V22_OPERATIVE_ART).map(({ path }) => path),
		...EXPECTED_V22_REEL_STRIPS.map(({ path }) => path),
	];
	const productionV26Files = Object.values(EXPECTED_V26_CINEMATIC_ART).map(({ path }) => path);
	const v27Catalog = BLACKSITE_ASSETS.ui.v27;
	const v27Manifest = JSON.parse(await readFile(
		new URL(relativeToBlacksiteRoot(v27Catalog.manifest), assetRoot),
		'utf8',
	));
	const productionV27Files = [
		...v27Manifest.runtimeFiles.map((path) => `${v27Catalog.root}/${path}`),
		...v27Manifest.metadataFiles.map((path) => `${v27Catalog.root}/${path}`),
	];

	const v29AudioManifestPath = relativeToBlacksiteRoot(BLACKSITE_AUDIO_RUNTIMEPACK_RUNTIME_MANIFEST);
	const v29AudioManifest = JSON.parse(await readFile(new URL(v29AudioManifestPath, assetRoot), 'utf8'));
	const productionV29AudioFiles = BLACKSITE_AUDIO_RUNTIMEPACK_FILES.map(relativeToBlacksiteRoot);
	assert.equal(v29AudioManifest.schema, 'blacksite-audio-runtime-manifest-v29');
	assert.equal(v29AudioManifest.status, 'TECHNICAL_IMPORT_PASS_AUDIBLE_QA_PENDING');
	assert.equal(v29AudioManifest.files.length, 121);
	assert.equal(new Set(productionV29AudioFiles).size, 121);
	assert.deepEqual(
		v29AudioManifest.files.map(({ path }) => relativeToBlacksiteRoot(path)).sort(),
		[...productionV29AudioFiles].sort(),
		'the V29 runtime audio manifest closes over all 121 curated catalog media files',
	);
	assert.deepEqual(v29AudioManifest.typeCounts, { '.flac': 1, '.ogg': 102, '.opus': 1, '.wav': 17 });
	assert.equal(v29AudioManifest.budgets.runtimeBytes, 3236044);
	for (const file of v29AudioManifest.files) {
		const relativePath = relativeToBlacksiteRoot(file.path);
		const bytes = await readFile(new URL(relativePath, assetRoot));
		assert.equal(bytes.byteLength, file.bytes, `${relativePath} manifest byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${relativePath} manifest hash`);
	}
	const v28EnvironmentManifest = JSON.parse(await readFile(
		new URL('../art/v28/environment/PACK_MANIFEST.json', import.meta.url),
		'utf8',
	));
	const productionV28EnvironmentFiles = [
		...Object.values(BLACKSITE_ASSETS.environment.v28Candidate.base),
		...Object.values(BLACKSITE_ASSETS.environment.v28Candidate.blackout),
	].map(relativeToBlacksiteRoot);
	assert.deepEqual(
		v28EnvironmentManifest.assets.map(({ runtimePath }) => relativePenguinManifestPath(runtimePath)),
		productionV28EnvironmentFiles,
		'the six V28 environment candidates are manifest-backed preload assets only',
	);
	const productionV28Files = [
		...productionV28EnvironmentFiles,
	];
	const productionV29Files = [
		v29AudioManifestPath,
		...productionV29AudioFiles,
	];
	const v33IntroManifestPath = relativeToBlacksiteRoot(BLACKSITE_INTRO_MANIFEST_URL);
	const v33IntroManifest = JSON.parse(await readFile(new URL(v33IntroManifestPath, assetRoot), 'utf8'));
	const productionV33Files = [...new Set([
		v33IntroManifestPath,
		v33IntroManifest.endFrame,
		v33IntroManifest.rulesScreen,
		...Object.values(v33IntroManifest.video).flatMap((variant) => Object.values(variant)),
	].filter(Boolean))].sort((left, right) => left.localeCompare(right, 'en'));
	assert.equal(v33IntroManifest.schema, 'blacksite-intro-manifest/v2');
	assert.equal(v33IntroManifest.version, 33);
	assert.deepEqual(productionV33Files, [
		'v33/intro/blacksite-breach-start-screen-v33.webp',
		'v33/intro/blacksite-startup-manifest-v33.json',
		'v33/intro/blacksite-vault-opening-v33.mp4',
	]);

	const productionFiles = [
		...productionRuntimeFxFiles,
		...productionSymbolFiles,
		...productionUiFiles,
		...productionV19Files,
		...productionV20Files,
		...productionV21Files,
		...productionV22Files,
		...productionV26Files,
		...productionV27Files,
		...productionV28Files,
		...productionV29Files,
		...productionV33Files,
	];
	const productionFileSet = new Set(productionFiles);
	assert.equal(productionFileSet.size, productionFiles.length, 'production declarations contain no duplicate paths');
	const sortedProductionFiles = [...productionFileSet].sort((left, right) => left.localeCompare(right, 'en'));
	const buildFiles = await collectRelativeFiles(buildAssetRoot);
	assert.deepEqual(buildFiles, sortedProductionFiles);
	assert.equal(buildFiles.length, 408);
	assert.deepEqual(countFileTypes(buildFiles), {
		'.flac': 1,
		'.json': 6,
		'.mp4': 2,
		'.ogg': 102,
		'.opus': 1,
		'.wav': 17,
		'.webp': 279,
	});
	assert.deepEqual(
		buildFiles.filter((path) => path.endsWith('.json')),
		[
			'v20/penguin-operator/manifest.json',
			'v21/ui-kit/manifest.json',
			'v22/ui-kit/manifest.json',
			'v27/ui-kit/manifest.json',
			'v29/audio/audio-manifest.json',
			'v33/intro/blacksite-startup-manifest-v33.json',
		],
	);
	assert.deepEqual(
		buildFiles.filter((path) => /(?:sym_01_operative|runtime_sequences|static_keyposes|reel-strips-v1|reel-depth-v1|audio\/v19|^environment\/|^v24\/|^v28\/audio\/|^v30\/|^v31\/|2160p)/iu.test(path)),
		[],
		'production excludes adult operative, DEV films, V24 Vault media, legacy reel chrome, V28 audio, retired V30/V31 startup assets, and 2160p media',
	);
	assert.deepEqual(
		buildFiles.filter((path) => path.endsWith('.mp4')),
		[
			'v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
			'v33/intro/blacksite-vault-opening-v33.mp4',
		],
		'production contains only the canonical V26 feature and V33 startup MP4 files',
	);
	for (const path of buildFiles) {
		const sourceBytes = await readFile(new URL(path, assetRoot));
		const productionBytes = await readFile(new URL(path, buildAssetRoot));
		assert.equal(
			createHash('sha256').update(productionBytes).digest('hex'),
			createHash('sha256').update(sourceBytes).digest('hex'),
			`${path} is byte-identical to its declared source asset`,
		);
	}

	const productionStats = await deliveryStats(buildAssetRoot, buildFiles);
	const productionGroups = await deliveryGroupStats(buildAssetRoot, buildFiles);
	const completeBuildFiles = await collectRelativeFiles(buildRoot);
	const completeBuildStats = await deliveryStats(buildRoot, completeBuildFiles);
	const assetManifest = JSON.parse(await readFile(new URL('../art/asset-manifest.json', import.meta.url), 'utf8'));
	assert.deepEqual(assetManifest.currentProductionDelivery, {
		authority: 'apps/blacksite/tests/blacksite-character-assets.test.mjs',
		pruner: 'apps/blacksite/scripts/prune-production-assets.mjs',
		buildAssetRoot: 'apps/blacksite/build/assets/blacksite',
		runtimeFileCount: 408,
		runtimeBytes: 63282387,
		runtimeTypeCounts: {
			'.flac': 1,
			'.json': 6,
			'.mp4': 2,
			'.ogg': 102,
			'.opus': 1,
			'.wav': 17,
			'.webp': 279,
		},
		runtimeTreeSha256: '6d3b851b319c6f0197d7905370ba8189fe9a932ced23350bb1d872add96d099d',
		productionGroups: {
			'runtime-rgba-v1': { files: 78, bytes: 2383822, treeSha256: 'be3e99e96729152f610f2feb09e34c515d7805eb60f44653306c88cd6f420b0c' },
			symbols: { files: 35, bytes: 1737668, treeSha256: '2ca4dd8273abd370d9d4ff3399d8d18e643002de246a513b808876ab3836157a' },
			ui: { files: 85, bytes: 942964, treeSha256: '564829f9e40a62b107ef02014ca375a1126418a14e8e980a876dc8d73dec3acc' },
			v19: { files: 10, bytes: 1776158, treeSha256: '8d810683482a1d4eb0ae18e1aef27cb927272ad65e5c6dc6868895162f8a4228' },
			v20: { files: 27, bytes: 35703284, treeSha256: '81ed9910ab2d8009d54e9aa53ba9a1fd38c277ad3dace6abf7303dbd81da6a8c' },
			v21: { files: 13, bytes: 192091, treeSha256: '9d6b62c4afd6dfe357500d0501af78f4a397e6be272a076e1c3c7d064cea16f1' },
			v22: { files: 19, bytes: 5181068, treeSha256: '9fee55d1241763e14c500a798d028de90f07ec5359eaae8d80809484ddc72645' },
			v26: { files: 2, bytes: 6030885, treeSha256: '655f2b780f1bb47fa35b797451f3f3716e38a547c98737e5d13603ac6a79d2f4' },
			v27: { files: 8, bytes: 1646936, treeSha256: '13d616a17122eff3e62645cafa4d988da57281f081cf8bad60ef4ef0f2aaee1a' },
			v28: { files: 6, bytes: 1352930, treeSha256: 'c6f244c29c1e01e47017159f09d1cb5930402034bfea358c273987dcf0c3daa0' },
			v29: { files: 122, bytes: 3318590, treeSha256: '6916a04cded0667224aa1466cf8c92cd4ba8d63b9bd5a894eef8a7047858e47a' },
			v33: { files: 3, bytes: 3015991, treeSha256: '1cd4c04e565c8ab7f244bfdf985b540a42feb457ba79023508f74ee0464240b8' },
		},
		hardMaxBytes: 64 * 1024 * 1024,
		headroomBytes: 3826477,
		pass: true,
		completeBuild: {
			fileCount: 414,
			bytes: 65546227,
			treeSha256: '7ae6db730ed606eea59ece217df9ed3e9ce7fc5cc5d121100489e523ddab5be0',
			typeCounts: {
				'.css': 2,
				'.flac': 1,
				'.html': 1,
				'.js': 2,
				'.json': 7,
				'.mp4': 2,
				'.ogg': 102,
				'.opus': 1,
				'.wav': 17,
				'.webp': 279,
			},
			hardMaxBytes: 64 * 1024 * 1024,
			headroomBytes: 1562637,
			gate: 'the generated build is measured after production pruning; source JS/CSS identity is deliberately not part of the immutable asset closure',
			pass: true,
		},
	});
	assert.deepEqual(productionStats, {
		fileCount: 408,
		bytes: 63282387,
		treeSha256: '6d3b851b319c6f0197d7905370ba8189fe9a932ced23350bb1d872add96d099d',
		typeCounts: { '.flac': 1, '.json': 6, '.mp4': 2, '.ogg': 102, '.opus': 1, '.wav': 17, '.webp': 279 },
	});
	assert.deepEqual(productionGroups, assetManifest.currentProductionDelivery.productionGroups);
	assert.equal(completeBuildStats.fileCount, completeBuildFiles.length);
	assert.deepEqual(completeBuildStats.typeCounts, countFileTypes(completeBuildFiles));
	assert.deepEqual(completeBuildStats, {
		fileCount: 414,
		bytes: 65546227,
		treeSha256: '7ae6db730ed606eea59ece217df9ed3e9ce7fc5cc5d121100489e523ddab5be0',
		typeCounts: { '.css': 2, '.flac': 1, '.html': 1, '.js': 2, '.json': 7, '.mp4': 2, '.ogg': 102, '.opus': 1, '.wav': 17, '.webp': 279 },
	});
	assert.ok(completeBuildStats.bytes < assetManifest.currentProductionDelivery.completeBuild.hardMaxBytes);
});

test('every reel symbol omits visible captions and rank glyphs keep a late cross-viewport safe area', async () => {
	const source = await readFile(new URL('routes/+page.svelte', sourceRoot), 'utf8');
	const rankSet = /const rankGlyphSymbolIds = new Set\(\[([^\n]+)\]\);/u.exec(source);
	assert.ok(rankSet, 'page declares the rank-glyph identity set');
	assert.deepEqual(
		[...rankSet[1].matchAll(/'([^']+)'/gu)].map((match) => match[1]),
		['a', 'k', 'q', 'j', 'ten'],
	);
	assert.match(
		source,
		/class:rank-glyph=\{rankGlyphSymbolIds\.has\(symbolNameAt\(cell\)\)\}/u,
	);
	assert.doesNotMatch(source, /class=["'][^"']*\bsymbol-code\b/iu);
	assert.doesNotMatch(source, /data-testid=["']reel-symbol-caption["']/iu);
	assert.match(
		source,
		/role="gridcell"[\s\S]*?aria-label=\{`Reel \$\{cell\.column \+ 1\}, row \$\{cell\.row \+ 1\}/u,
		'symbol identity remains available through the gridcell accessible name',
	);

	const finalRule = source.indexOf('.breach-monitor .reel-cell.rank-glyph .symbol-art img {');
	const finalTenRule = source.indexOf(".breach-monitor .reel-cell.rank-glyph[data-symbol-id='ten'] .symbol-art img {");
	assert.ok(finalRule > source.indexOf('@media (max-width: 700px)'), 'rank safe-area rule follows every viewport override');
	assert.ok(finalTenRule > finalRule, '10 receives its intrinsic-aspect correction after the shared rank rule');
	assert.match(source.slice(finalRule, finalTenRule), /transform: scale\(0\.86\) !important;/u);
	assert.match(source.slice(finalTenRule), /transform: scale\(0\.98\) !important;/u);
});
