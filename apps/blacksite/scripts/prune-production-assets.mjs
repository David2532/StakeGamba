#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
	existsSync,
	readdirSync,
	realpathSync,
	rmSync,
	rmdirSync,
	statSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA } from '../src/lib/assets/blacksite-audio-runtimepack-v1.generated.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, '..');
const buildRoot = resolve(appRoot, 'build');
const assetRoot = resolve(buildRoot, 'assets', 'blacksite');
const MAX_COMPLETE_BUILD_BYTES = 64 * 1024 * 1024;
const BLACKSITE_ASSET_PREFIX = 'assets/blacksite/';

assert.equal(
	BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot,
	'assets/blacksite/v29/audio',
	'unexpected curated audio runtime root',
);
const BLACKSITE_AUDIO_V29_FILES = Object.freeze([
	...new Set(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.cues.flatMap((cue) => cue.runtimeFiles)),
].sort((left, right) => left.localeCompare(right, 'en')));
assert.equal(BLACKSITE_AUDIO_V29_FILES.length, 121, 'curated V29 audio closure must contain exactly 121 files');
const BLACKSITE_AUDIO_V29_RUNTIME_MANIFEST = `${BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot}/audio-manifest.json`;

function productionRelativeAsset(path) {
	assert.equal(path.startsWith(BLACKSITE_ASSET_PREFIX), true, `unexpected BLACKSITE asset path: ${path}`);
	return path.slice(BLACKSITE_ASSET_PREFIX.length);
}

function rgbaFrameFiles(group, id, frameCount) {
	return Array.from(
		{ length: frameCount },
		(_, index) => `runtime-rgba-v1/${group}/${id}/rgba/${id}_${String(index).padStart(3, '0')}.webp`,
	);
}

const DENIED_PRODUCTION_ROOTS = Object.freeze([
	'audio/v19',
	'environment',
	'runtime-rgba-dev-v1',
	'runtime-rgba-dev-fx-v1',
	'symbols/sym_01_operative',
	'symbols/sym_03_tactical_radio',
	'symbols/sym_04_classified_folder',
	'symbols/sym_05_night_vision_goggles',
	'symbols/sym_06_supply_crate',
	'symbols/sym_08_breach_scatter',
	'symbols/sym_09_a',
	'symbols/sym_11_q',
	'symbols/sym_13_ten',
	'ui/reel-depth-v1',
	'ui/reel-strips-v1',
	'v19/cinematic/dev-rig-v1',
	'v19/vault-symbol',
	'v24',
	'v30',
	'v31',
]);

const SCOPED_PRODUCTION_ALLOWLISTS = Object.freeze({
	'runtime-rgba-v1': Object.freeze([
		...rgbaFrameFiles('standalone_fx', 'BONUS_CRATE_PULSE', 16),
		...rgbaFrameFiles('standalone_fx', 'BONUS_CRATE_SPIN', 20),
		...rgbaFrameFiles('standalone_fx', 'FX_COIN_BURST', 20),
		...rgbaFrameFiles('standalone_fx', 'FX_SCREEN_IMPACT', 12),
		...rgbaFrameFiles('standalone_fx', 'FX_WIN_FLASH', 10),
	]),
	v21: Object.freeze([
		'v21/ui-kit/manifest.json',
		'v21/ui-kit/atlas/round-states.webp',
		'v21/ui-kit/nine-slice/control/danger.webp',
		'v21/ui-kit/nine-slice/control/disabled.webp',
		'v21/ui-kit/nine-slice/control/focus.webp',
		'v21/ui-kit/nine-slice/control/hover.webp',
		'v21/ui-kit/nine-slice/control/idle.webp',
		'v21/ui-kit/nine-slice/control/pressed.webp',
		'v21/ui-kit/nine-slice/control/selected.webp',
		'v21/ui-kit/nine-slice/panel/danger.webp',
		'v21/ui-kit/nine-slice/panel/idle.webp',
		'v21/ui-kit/nine-slice/readout/idle.webp',
	]),
	v22: Object.freeze([
		'v22/environment/premium-machine-shell-compact-phone-v22.webp',
		'v22/environment/premium-machine-shell-phone-v22.webp',
		'v22/environment/premium-machine-shell-portrait-v22.webp',
		'v22/environment/premium-machine-shell-short-landscape-v22.webp',
		'v22/environment/premium-machine-shell-v22.webp',
		'v22/ui-kit/manifest.json',
		'v22/ui-kit/nine-slice/control/master.webp',
		'v22/ui-kit/nine-slice/panel/master.webp',
		'v22/ui-kit/nine-slice/readout/master.webp',
		'v22/ui-kit/reel-stage/cell-depth-overlay.webp',
		'v22/ui-kit/reel-stage/inner-bezel-depth-overlay.webp',
		'v22/symbols/operative/base.webp',
		'v22/symbols/operative/dim.webp',
		'v22/symbols/operative/win.webp',
	]),
	v39: Object.freeze([
		'v39/symbols/sym_03_tactical_radio/base.webp',
		'v39/symbols/sym_03_tactical_radio/dim.webp',
		'v39/symbols/sym_03_tactical_radio/win.webp',
		'v39/symbols/sym_04_classified_folder/base.webp',
		'v39/symbols/sym_04_classified_folder/dim.webp',
		'v39/symbols/sym_04_classified_folder/win.webp',
		'v39/symbols/sym_05_night_vision_goggles/base.webp',
		'v39/symbols/sym_05_night_vision_goggles/dim.webp',
		'v39/symbols/sym_05_night_vision_goggles/win.webp',
		'v39/symbols/sym_06_supply_crate/base.webp',
		'v39/symbols/sym_06_supply_crate/dim.webp',
		'v39/symbols/sym_06_supply_crate/win.webp',
		'v39/symbols/sym_08_breach_vault/anticipation.webp',
		'v39/symbols/sym_08_breach_vault/base.webp',
		'v39/symbols/sym_08_breach_vault/dim.webp',
		'v39/symbols/sym_08_breach_vault/triggered.webp',
		'v39/symbols/sym_08_breach_vault/win.webp',
		'v39/symbols/sym_09_a/base.webp',
		'v39/symbols/sym_09_a/dim.webp',
		'v39/symbols/sym_09_a/win.webp',
		'v39/symbols/sym_11_q/base.webp',
		'v39/symbols/sym_11_q/dim.webp',
		'v39/symbols/sym_11_q/win.webp',
		'v39/symbols/sym_13_ten/base.webp',
		'v39/symbols/sym_13_ten/dim.webp',
		'v39/symbols/sym_13_ten/win.webp',
		'v39/ui/reel-strips/reel-01.webp',
		'v39/ui/reel-strips/reel-02.webp',
		'v39/ui/reel-strips/reel-03.webp',
		'v39/ui/reel-strips/reel-04.webp',
		'v39/ui/reel-strips/reel-05.webp',
		'v39/ui-kit/atlas/glyphs.webp',
		'v39/ui-kit/manifest.json',
	]),
	v20: Object.freeze([
		'v20/penguin-operator/anticipation.webp',
		'v20/penguin-operator/bonus.webp',
		'v20/penguin-operator/idle-02.webp',
		'v20/penguin-operator/idle-03.webp',
		'v20/penguin-operator/idle.webp',
		'v20/penguin-operator/loss.webp',
		'v20/penguin-operator/manifest.json',
		'v20/penguin-operator/poster.webp',
		'v20/penguin-operator/rage.webp',
		'v20/penguin-operator/spin.webp',
		'v20/penguin-operator/transitions/anticipation-to-idle.webp',
		'v20/penguin-operator/transitions/bonus-to-idle.webp',
		'v20/penguin-operator/transitions/idle-handoff.webp',
		'v20/penguin-operator/transitions/idle-to-anticipation.webp',
		'v20/penguin-operator/transitions/idle-to-bonus.webp',
		'v20/penguin-operator/transitions/idle-to-loss.webp',
		'v20/penguin-operator/transitions/idle-to-rage.webp',
		'v20/penguin-operator/transitions/idle-to-spin.webp',
		'v20/penguin-operator/transitions/idle-to-win-big.webp',
		'v20/penguin-operator/transitions/idle-to-win-small.webp',
		'v20/penguin-operator/transitions/loss-to-idle.webp',
		'v20/penguin-operator/transitions/rage-to-idle.webp',
		'v20/penguin-operator/transitions/spin-to-idle.webp',
		'v20/penguin-operator/transitions/win-big-to-idle.webp',
		'v20/penguin-operator/transitions/win-small-to-idle.webp',
		'v20/penguin-operator/win-big.webp',
		'v20/penguin-operator/win-small.webp',
	]),
	v26: Object.freeze([
		'v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
		'v26/cinematic/vault-opening-blackout-v26-poster-720p.webp',
	]),
	v27: Object.freeze([
		'v27/ui-kit/manifest.json',
		'v27/ui-kit/decor/reward-halo.webp',
		'v27/ui-kit/nine-slice/award/master.webp',
		'v27/ui-kit/nine-slice/chip/master.webp',
		'v27/ui-kit/nine-slice/content/master.webp',
		'v27/ui-kit/nine-slice/feature/master.webp',
		'v27/ui-kit/nine-slice/header/master.webp',
		'v27/ui-kit/nine-slice/progress/master.webp',
	]),
	v28: Object.freeze([
		'v28/environment/base-desktop.webp',
		'v28/environment/base-portrait.webp',
		'v28/environment/base-short-landscape.webp',
		'v28/environment/blackout-interior-desktop.webp',
		'v28/environment/blackout-interior-portrait.webp',
		'v28/environment/blackout-interior-short-landscape.webp',
	]),
	v29: Object.freeze([
		productionRelativeAsset(BLACKSITE_AUDIO_V29_RUNTIME_MANIFEST),
		...BLACKSITE_AUDIO_V29_FILES.map(productionRelativeAsset),
	]),
	v33: Object.freeze([
		'v33/intro/blacksite-breach-start-screen-v33.webp',
		'v33/intro/blacksite-startup-manifest-v33.json',
		'v33/intro/blacksite-vault-opening-v33.mp4',
	]),
});

const REQUIRED_PRODUCTION_FILES = Object.freeze([
	...Object.values(SCOPED_PRODUCTION_ALLOWLISTS).flat(),
]);

function normalizePath(path) {
	const normalized = resolve(path);
	return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function collectRelativeFiles(root) {
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const absolutePath = join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(absolutePath);
				continue;
			}
			assert.equal(entry.isFile(), true, `unsupported build asset entry: ${absolutePath}`);
			files.push(relative(root, absolutePath).replaceAll('\\', '/'));
		}
	};
	visit(root);
	return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function countTypes(files) {
	const counts = {};
	for (const path of files) {
		const extension = extname(path).toLowerCase() || '(none)';
		counts[extension] = (counts[extension] ?? 0) + 1;
	}
	return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, 'en')));
}

function totalBytes(root, files) {
	return files.reduce((sum, path) => sum + statSync(resolve(root, ...path.split('/'))).size, 0);
}

function validateAssetRoot() {
	assert.equal(existsSync(buildRoot), true, `BLACKSITE build root does not exist: ${buildRoot}`);
	assert.equal(statSync(buildRoot).isDirectory(), true, `BLACKSITE build root is not a directory: ${buildRoot}`);
	assert.equal(existsSync(assetRoot), true, `BLACKSITE build asset root does not exist: ${assetRoot}`);
	assert.equal(statSync(assetRoot).isDirectory(), true, `BLACKSITE build asset root is not a directory: ${assetRoot}`);

	const resolvedBuildRoot = realpathSync.native(buildRoot);
	const resolvedAssetRoot = realpathSync.native(assetRoot);
	const expectedAssetRoot = resolve(resolvedBuildRoot, 'assets', 'blacksite');
	assert.equal(
		normalizePath(resolvedAssetRoot),
		normalizePath(expectedAssetRoot),
		`refusing to prune outside the exact generated build/assets/blacksite root: ${resolvedAssetRoot}`,
	);
	assert.equal(
		relative(resolvedBuildRoot, resolvedAssetRoot).replaceAll('\\', '/'),
		'assets/blacksite',
		`refusing to prune unexpected build-relative path: ${resolvedAssetRoot}`,
	);
	return resolvedAssetRoot;
}

function assertAssetTarget(resolvedAssetRoot, relativeTarget) {
	const target = resolve(resolvedAssetRoot, ...relativeTarget.split('/'));
	assert.equal(
		relative(resolvedAssetRoot, target).replaceAll('\\', '/'),
		relativeTarget,
		`refusing unexpected generated-asset target: ${target}`,
	);
	return target;
}

function pruneDeniedRoot(resolvedAssetRoot, relativeRoot) {
	const target = assertAssetTarget(resolvedAssetRoot, relativeRoot);
	if (!existsSync(target)) return 0;
	assert.equal(statSync(target).isDirectory(), true, `denied production asset root is not a directory: ${target}`);
	const resolvedTarget = realpathSync.native(target);
	assert.equal(
		normalizePath(resolvedTarget),
		normalizePath(target),
		`refusing to follow a linked denied production root: ${target}`,
	);
	const removedFileCount = collectRelativeFiles(resolvedTarget).length;
	rmSync(resolvedTarget, { recursive: true, force: false, maxRetries: 3, retryDelay: 50 });
	return removedFileCount;
}

function pruneScopedRoot(resolvedAssetRoot, relativeRoot, allowedPaths) {
	const allowed = new Set(allowedPaths);
	const candidates = collectRelativeFiles(resolvedAssetRoot)
		.filter((path) => path.startsWith(`${relativeRoot}/`) && !allowed.has(path));
	for (const path of candidates) {
		const target = assertAssetTarget(resolvedAssetRoot, path);
		assert.equal(statSync(target).isFile(), true, `scoped production removal is not a file: ${target}`);
		rmSync(target, { force: false });
	}
	const scopedRoot = assertAssetTarget(resolvedAssetRoot, relativeRoot);
	const pruneEmptyChildren = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) pruneEmptyChildren(join(directory, entry.name));
		}
		if (directory !== scopedRoot && readdirSync(directory).length === 0) rmdirSync(directory);
	};
	pruneEmptyChildren(scopedRoot);
	return candidates.length;
}

const resolvedAssetRoot = validateAssetRoot();
const beforeFiles = collectRelativeFiles(resolvedAssetRoot);
let removedFileCount = DENIED_PRODUCTION_ROOTS.reduce(
	(total, relativeRoot) => total + pruneDeniedRoot(resolvedAssetRoot, relativeRoot),
	0,
);
for (const [relativeRoot, allowlist] of Object.entries(SCOPED_PRODUCTION_ALLOWLISTS)) {
	removedFileCount += pruneScopedRoot(resolvedAssetRoot, relativeRoot, allowlist);
}

const productionFiles = collectRelativeFiles(resolvedAssetRoot);
const productionTypeCounts = countTypes(productionFiles);
const productionAssetBytes = totalBytes(resolvedAssetRoot, productionFiles);
const completeBuildFiles = collectRelativeFiles(buildRoot);
const completeBuildBytes = totalBytes(buildRoot, completeBuildFiles);

for (const relativeRoot of DENIED_PRODUCTION_ROOTS) {
	assert.equal(
		productionFiles.some((path) => path === relativeRoot || path.startsWith(`${relativeRoot}/`)),
		false,
		`denied production asset root remains in build: ${relativeRoot}`,
	);
}
for (const [relativeRoot, allowlist] of Object.entries(SCOPED_PRODUCTION_ALLOWLISTS)) {
	assert.deepEqual(
		productionFiles.filter((path) => path.startsWith(`${relativeRoot}/`)),
		[...allowlist].sort((left, right) => left.localeCompare(right, 'en')),
		`scoped production closure mismatch: ${relativeRoot}`,
	);
}
for (const path of REQUIRED_PRODUCTION_FILES) {
	assert.equal(productionFiles.includes(path), true, `required production asset is missing: ${path}`);
}
assert.deepEqual(
	productionFiles.filter((path) => path.endsWith('.mp4')),
	[
		'v26/cinematic/vault-opening-blackout-v26-720p24.mp4',
		'v33/intro/blacksite-vault-opening-v33.mp4',
	],
	'only the canonical V26 feature and V33 startup MP4 files are allowed in production',
);
assert.equal(completeBuildBytes < MAX_COMPLETE_BUILD_BYTES, true, `complete production build exceeds 64 MiB: ${completeBuildBytes}`);

console.log(JSON.stringify({
	assetRoot: relative(appRoot, resolvedAssetRoot).replaceAll('\\', '/'),
	beforeFileCount: beforeFiles.length,
	removedFileCount,
	productionFileCount: productionFiles.length,
	productionAssetBytes,
	productionTypeCounts,
	completeBuildFileCount: completeBuildFiles.length,
	completeBuildBytes,
	maxCompleteBuildBytes: MAX_COMPLETE_BUILD_BYTES,
	prunedRoots: DENIED_PRODUCTION_ROOTS,
	scopedProductionAllowlists: SCOPED_PRODUCTION_ALLOWLISTS,
}, null, 2));
