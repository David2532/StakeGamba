import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { inspectWebp } from '../../../scripts/blacksite-validate-runtime-rgba.mjs';
import {
	DEV_FX_RUNTIME_MANIFEST_URL,
	OPERATOR_FX_CATALOG,
	OPERATOR_FX_DEV_V22_CATALOG,
} from '../src/lib/assets/operator-animation-assets.js';

const assetRoot = new URL('../static/assets/blacksite/', import.meta.url);
const reportUrl = new URL('../art/generated/v22/standalone-fx-30fps-v1/BUILD_REPORT.json', import.meta.url);
const EXPECTED = Object.freeze({
	bonusCratePulse: Object.freeze({ id: 'BONUS_CRATE_PULSE_30FPS', frames: 40, sourceFrames: 16, sourceFps: 12, loop: true, width: 512, height: 512 }),
	bonusCrateSpin: Object.freeze({ id: 'BONUS_CRATE_SPIN_30FPS', frames: 40, sourceFrames: 20, sourceFps: 15, loop: true, width: 512, height: 512 }),
	coinBurst: Object.freeze({ id: 'FX_COIN_BURST_30FPS', frames: 50, sourceFrames: 20, sourceFps: 12, loop: false, width: 1280, height: 1024 }),
	screenImpact: Object.freeze({ id: 'FX_SCREEN_IMPACT_30FPS', frames: 24, sourceFrames: 12, sourceFps: 15, loop: false, width: 1280, height: 1024 }),
	winFlash: Object.freeze({ id: 'FX_WIN_FLASH_30FPS', frames: 20, sourceFrames: 10, sourceFps: 15, loop: false, width: 1280, height: 1024 }),
});

function relativeAssetPath(packagePath) {
	const normalized = packagePath.startsWith('/') ? packagePath.slice(1) : packagePath;
	const prefix = 'assets/blacksite/';
	assert.equal(normalized.startsWith(prefix), true, `${packagePath} stays package-relative`);
	return normalized.slice(prefix.length);
}

test('DEV V22 standalone FX catalog is an explicit 30 fps opt-in with exact authored durations', () => {
	assert.equal(
		Object.values(OPERATOR_FX_CATALOG).every(({ frames }) => frames.every((path) => path.includes('/runtime-rgba-v1/'))),
		true,
		'production mappings stay on runtime-rgba-v1',
	);
	for (const [name, expected] of Object.entries(EXPECTED)) {
		const clip = OPERATOR_FX_DEV_V22_CATALOG[name];
		assert.equal(clip.id, expected.id);
		assert.equal(clip.fps, 30);
		assert.equal(clip.loop, expected.loop);
		assert.equal(clip.frames.length, expected.frames);
		assert.equal(new Set(clip.frames).size, clip.frames.length);
		assert.deepEqual(clip.frameSize, { width: expected.width, height: expected.height });
		assert.equal(clip.frames.length / clip.fps, expected.sourceFrames / expected.sourceFps);
		clip.frames.forEach((path, index) => {
			assert.match(path, /assets\/blacksite\/runtime-rgba-dev-fx-v1\/standalone_fx\//u);
			assert.equal(path.endsWith(`_${String(index).padStart(3, '0')}.webp`), true);
		});
	}
});

test('DEV standalone FX manifest, RIFF payloads, alpha and bounded delivery budget are valid', async () => {
	const manifest = JSON.parse(await readFile(
		new URL(relativeAssetPath(DEV_FX_RUNTIME_MANIFEST_URL), assetRoot),
		'utf8',
	));
	assert.equal(manifest.devOnly, true);
	assert.equal(manifest.fps, 30);
	assert.equal(manifest.decodedFrameBudget, 2);
	assert.equal(manifest.lazyLoad, true);
	assert.ok(manifest.totalBytes > 0);
	assert.ok(manifest.totalBytes <= 8 * 1024 * 1024, `compressed pack is ${manifest.totalBytes} bytes`);

	let observedBytes = 0;
	for (const [name, expected] of Object.entries(EXPECTED)) {
		const entry = manifest.effects[expected.id];
		const clip = OPERATOR_FX_DEV_V22_CATALOG[name];
		assert.equal(entry.frameCount, expected.frames);
		assert.equal(entry.fps, 30);
		assert.equal(entry.loop, expected.loop);
		assert.ok(Math.abs(entry.durationMs - expected.sourceFrames / expected.sourceFps * 1000) < 0.000_001);
		assert.deepEqual(entry.frameSize, { width: expected.width, height: expected.height });
		assert.equal(entry.frames.length, clip.frames.length);

		for (const [index, relativePath] of entry.frames.entries()) {
			assert.equal(relativeAssetPath(clip.frames[index]), `runtime-rgba-dev-fx-v1/${relativePath}`);
			const fileUrl = new URL(`runtime-rgba-dev-fx-v1/${relativePath}`, assetRoot);
			const [bytes, metadata] = await Promise.all([
				readFile(fileUrl),
				stat(fileUrl),
			]);
			observedBytes += metadata.size;
			const errors = [];
			const webp = inspectWebp(bytes, relativePath, {
				width: expected.width,
				height: expected.height,
				hasAlpha: true,
			}, errors);
			assert.deepEqual(errors, []);
			assert.ok(webp, `${relativePath} has a valid WebP RIFF envelope`);
		}
	}
	assert.equal(observedBytes, manifest.totalBytes);
});

test('DEV standalone FX build report records smoothness and visible-frame integrity gates', async () => {
	const report = JSON.parse(await readFile(reportUrl, 'utf8'));
	assert.equal(report.devOnly, true);
	assert.equal(report.totalBytes <= 8 * 1024 * 1024, true);
	for (const expected of Object.values(EXPECTED)) {
		const effect = report.effects[expected.id];
		assert.equal(effect.outputFrames.length, expected.frames);
		assert.equal(effect.qa.consecutiveDuplicateVisibleFrames, 0);
		assert.equal(effect.qa.transparentRgbMax, 0);
		assert.ok(effect.qa.temporalDeltaRatio < 0.9);
		assert.ok(effect.qa.synthesizedAlphaEdgeOvershootMax <= 1.2);
		if (expected.loop) assert.ok(effect.qa.loopSeamAlphaIou > 0.5);
	}
});
