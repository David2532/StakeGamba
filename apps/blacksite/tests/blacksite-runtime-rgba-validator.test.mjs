import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
	RuntimeRgbaValidationError,
	validateRuntimeRgbaPackage,
} from '../../../scripts/blacksite-validate-runtime-rgba.mjs';

function webpHeader(width, height, { hasAlpha = true } = {}) {
	const bytes = Buffer.alloc(30);
	bytes.write('RIFF', 0, 'ascii');
	bytes.writeUInt32LE(bytes.length - 8, 4);
	bytes.write('WEBP', 8, 'ascii');
	bytes.write('VP8X', 12, 'ascii');
	bytes.writeUInt32LE(10, 16);
	bytes[20] = hasAlpha ? 0x10 : 0;
	bytes.writeUIntLE(width - 1, 24, 3);
	bytes.writeUIntLE(height - 1, 27, 3);
	return bytes;
}

async function makeFixture() {
	const root = await mkdtemp(join(tmpdir(), 'blacksite-webp-validator-'));
	const manifest = {
		package: 'test',
		version: '1',
		runtime_sequences: {
			CHAR_IDLE_WATCH: {
				name: 'CHAR_IDLE_WATCH', frame_count: 2, frame_size: { width: 1280, height: 1024 },
				frames: [
					'runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_000.webp',
					'runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_001.webp',
				],
			},
		},
		standalone_fx: {
			BONUS_CRATE_PULSE: {
				name: 'BONUS_CRATE_PULSE', frame_count: 1, frame_size: { width: 512, height: 512 },
				frames: ['standalone_fx/BONUS_CRATE_PULSE/rgba/BONUS_CRATE_PULSE_000.webp'],
			},
		},
		static_keyposes: {
			CHAR_POSE_IDLE: {
				rgba: 'static_keyposes/rgba/CHAR_POSE_IDLE.webp', size: { width: 1280, height: 1024 },
			},
		},
	};
	const files = [
		['runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_000.webp', 1280, 1024],
		['runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_001.webp', 1280, 1024],
		['standalone_fx/BONUS_CRATE_PULSE/rgba/BONUS_CRATE_PULSE_000.webp', 512, 512],
		['static_keyposes/rgba/CHAR_POSE_IDLE.webp', 1280, 1024],
	];
	for (const [path, width, height] of files) {
		const absolutePath = join(root, ...path.split('/'));
		await mkdir(join(absolutePath, '..'), { recursive: true });
		await writeFile(absolutePath, webpHeader(width, height));
	}
	const manifestPath = join(root, 'manifest.json');
	await writeFile(manifestPath, JSON.stringify(manifest));
	return { root, manifest, manifestPath };
}

test('Runtime RGBA intake validates exact alpha-WebP paths, dimensions, totals and hashes', async (t) => {
	const fixture = await makeFixture();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	const report = await validateRuntimeRgbaPackage({ root: fixture.root, manifest: fixture.manifestPath });
	assert.equal(report.ok, true);
	assert.deepEqual(report.totals, {
		runtime_sequences: 1, standalone_fx: 1, animated_frames: 3,
		static_keyposes: 1, runtime_webps: 4, bytes: 120,
	});
	assert.match(report.hashes.manifest_sha256, /^[a-f0-9]{64}$/u);
	assert.match(report.hashes.runtime_tree_sha256, /^[a-f0-9]{64}$/u);
	for (const { metadata, size } of report.files) {
		assert.deepEqual(metadata, {
			format: 'webp', width: size.width, height: size.height, has_alpha: true,
		});
	}
});

test('Runtime RGBA intake rejects non-rgba/order paths before integration', async (t) => {
	const fixture = await makeFixture();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	fixture.manifest.runtime_sequences.CHAR_IDLE_WATCH.frames[0] =
		'runtime_sequences/CHAR_IDLE_WATCH/pink/CHAR_IDLE_WATCH_001.webp';
	await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest));
	await assert.rejects(
		validateRuntimeRgbaPackage({ root: fixture.root, manifest: fixture.manifestPath }),
		(error) => error instanceof RuntimeRgbaValidationError
			&& error.errors.some((detail) => detail.includes('expected runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_000.webp'))
			&& error.errors.some((detail) => detail.includes('only from an rgba directory')),
	);
});

test('Runtime RGBA intake rejects WebP frames that dropped their alpha channel', async (t) => {
	const fixture = await makeFixture();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	const relativePath = 'runtime_sequences/CHAR_IDLE_WATCH/rgba/CHAR_IDLE_WATCH_000.webp';
	await writeFile(
		join(fixture.root, ...relativePath.split('/')),
		webpHeader(1280, 1024, { hasAlpha: false }),
	);
	await assert.rejects(
		validateRuntimeRgbaPackage({ root: fixture.root, manifest: fixture.manifestPath }),
		(error) => error instanceof RuntimeRgbaValidationError
			&& error.errors.some((detail) => detail.includes(`${relativePath}: WebP must retain an alpha channel`)),
	);
});

test('Runtime RGBA intake rejects authoring-only fields and undeployed asset references', async (t) => {
	const fixture = await makeFixture();
	t.after(() => rm(fixture.root, { recursive: true, force: true }));
	fixture.manifest.pink_background = '#FF00C8';
	fixture.manifest.concept_keyframes = {};
	fixture.manifest.runtime_sequences.CHAR_IDLE_WATCH.pink_frames = [
		'runtime_sequences/CHAR_IDLE_WATCH/pink/CHAR_IDLE_WATCH_000.webp',
	];
	fixture.manifest.runtime_sequences.CHAR_IDLE_WATCH.preview_gif =
		'runtime_sequences/CHAR_IDLE_WATCH/CHAR_IDLE_WATCH_preview.gif';
	fixture.manifest.static_keyposes.CHAR_POSE_IDLE.pink =
		'static_keyposes/pink/CHAR_POSE_IDLE.webp';
	await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest));

	await assert.rejects(
		validateRuntimeRgbaPackage({ root: fixture.root, manifest: fixture.manifestPath }),
		(error) => error instanceof RuntimeRgbaValidationError
			&& error.errors.some((detail) => detail.includes('manifest.pink_background: authoring-only field'))
			&& error.errors.some((detail) => detail.includes('manifest.concept_keyframes: authoring-only field'))
			&& error.errors.some((detail) => detail.includes('pink_frames: authoring-only field'))
			&& error.errors.some((detail) => detail.includes('preview_gif: authoring-only field'))
			&& error.errors.some((detail) => detail.includes('static_keyposes.CHAR_POSE_IDLE.pink: authoring-only field'))
			&& error.errors.some((detail) => detail.includes('local asset reference is not a declared shipped RGBA asset')),
	);
});
