import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { normalizeBlacksiteIntroManifest } from '../src/lib/assets/blacksite-intro-assets.js';

const appRoot = new URL('../', import.meta.url);
const assetRoot = new URL('../static/assets/blacksite/', import.meta.url);
const manifestUrl = new URL('v30/intro/blacksite-intro-manifest.json', assetRoot);
const promptRecordUrl = new URL('../../../docs/kling-blacksite-intro-prompt.md', import.meta.url);

const expectedVideoPaths = Object.freeze([
	'assets/blacksite/v30/intro/blacksite-intro-desktop.webm',
	'assets/blacksite/v30/intro/blacksite-intro-desktop.mp4',
	'assets/blacksite/v30/intro/blacksite-intro-mobile.webm',
	'assets/blacksite/v30/intro/blacksite-intro-mobile.mp4',
]);

const expectedRuntimeVideoPaths = Object.freeze([
	'v30/intro/blacksite-intro-desktop.webm',
	'v30/intro/blacksite-intro-desktop.mp4',
	'v30/intro/blacksite-intro-mobile.webm',
	'v30/intro/blacksite-intro-mobile.mp4',
]);

const expectedPosters = Object.freeze({
	desktop: Object.freeze({
		path: 'assets/blacksite/v28/environment/blackout-interior-desktop.webp',
		width: 2560,
		height: 1440,
		bytes: 365658,
		sha256: 'd86a9147acf331429ee7618c1170377f1ae00ea397faa904e34723862ae76b47',
	}),
	portrait: Object.freeze({
		path: 'assets/blacksite/v28/environment/blackout-interior-portrait.webp',
		width: 1536,
		height: 2048,
		bytes: 294358,
		sha256: '17bdf133304212832611b2b16c2498bb2ff87549c71a010aacb3ee7813759c98',
	}),
	shortLandscape: Object.freeze({
		path: 'assets/blacksite/v28/environment/blackout-interior-short-landscape.webp',
		width: 1792,
		height: 828,
		bytes: 203388,
		sha256: '2594474f3cc2f051348e3673009984ca05b7d2132b3764d0c7d7f301738ac938',
	}),
});

const expectedEndFrames = Object.freeze({
	desktop: 'assets/blacksite/v28/environment/base-desktop.webp',
	portrait: 'assets/blacksite/v28/environment/base-portrait.webp',
	shortLandscape: 'assets/blacksite/v28/environment/base-short-landscape.webp',
});

function runtimeFileUrl(path) {
	assert.match(path, /^assets\/blacksite\//u);
	return new URL(path.slice('assets/blacksite/'.length), assetRoot);
}

async function exists(url) {
	try {
		await stat(url);
		return true;
	} catch (error) {
		if (error?.code === 'ENOENT') return false;
		throw error;
	}
}

async function collectRelativeFiles(directoryUrl, relativeRoot = '') {
	const files = [];
	for (const entry of await readdir(directoryUrl, { withFileTypes: true })) {
		const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...await collectRelativeFiles(new URL(`${entry.name}/`, directoryUrl), relativePath));
			continue;
		}
		assert.equal(entry.isFile(), true, `unsupported V30 asset entry: ${relativePath}`);
		files.push(relativePath);
	}
	return files.sort((left, right) => left.localeCompare(right, 'en'));
}

test('historical V30 boot intro remains a truthful poster-only manifest with reserved responsive video paths', async () => {
	const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
	assert.equal(manifest.schema, 'blacksite-intro-manifest/v1');
	assert.equal(manifest.version, 30);
	assert.equal(manifest.status, 'poster-fallback-only');
	assert.equal(manifest.releaseStatus, 'FALLBACK_ONLY_NOT_RELEASE_APPROVED');
	assert.equal(manifest.videoAvailable, false);
	assert.equal(manifest.durationSeconds, null);
	assert.equal(manifest.generation.status, 'NOT_GENERATED');
	assert.equal(manifest.generation.generationIds.length, 0);
	assert.match(manifest.generation.blockedReason, /0\.0 available credits/u);
	assert.equal(manifest.budget.currentV30VideoBytes, 0);

	const declaredVideoVariants = [
		manifest.videoVariants.desktop.webm,
		manifest.videoVariants.desktop.mp4,
		manifest.videoVariants.mobile.webm,
		manifest.videoVariants.mobile.mp4,
	];
	assert.deepEqual(declaredVideoVariants.map(({ path }) => path), expectedVideoPaths);
	assert.equal(declaredVideoVariants.every(({ available }) => available === false), true);
	assert.deepEqual([
		manifest.video.desktop.webm,
		manifest.video.desktop.mp4,
		manifest.video.mobile.webm,
		manifest.video.mobile.mp4,
	], expectedRuntimeVideoPaths);
	const normalized = normalizeBlacksiteIntroManifest(manifest);
	assert.equal(normalized.schema, manifest.schema);
	assert.equal(normalized.status, manifest.status);
	assert.equal(normalized.videoAvailable, false);
	assert.deepEqual(Object.values(normalized.poster), [
		'assets/blacksite/v28/environment/blackout-interior-desktop.webp',
		'assets/blacksite/v28/environment/blackout-interior-portrait.webp',
		'assets/blacksite/v28/environment/blackout-interior-short-landscape.webp',
	]);
	assert.equal(normalized.endFrame, 'assets/blacksite/v28/environment/base-desktop.webp');
	assert.deepEqual([
		normalized.video.desktop.webm,
		normalized.video.desktop.mp4,
		normalized.video.mobile.webm,
		normalized.video.mobile.mp4,
	], expectedVideoPaths);
	for (const path of expectedVideoPaths) {
		assert.equal(await exists(runtimeFileUrl(path)), false, `${path} remains a non-shipped reservation`);
	}
});

test('historical V30 responsive posters and transition frames reuse the exact V28 source plates', async () => {
	const [manifest, v28Manifest] = await Promise.all([
		readFile(manifestUrl, 'utf8').then(JSON.parse),
		readFile(new URL('../art/v28/environment/PACK_MANIFEST.json', import.meta.url), 'utf8').then(JSON.parse),
	]);
	const v28Assets = new Map(v28Manifest.assets.map((asset) => [
		asset.runtimePath.replace(/^apps\/blacksite\/static\//u, ''),
		asset,
	]));

	assert.deepEqual(manifest.poster, {
		desktop: 'v28/environment/blackout-interior-desktop.webp',
		portrait: 'v28/environment/blackout-interior-portrait.webp',
		shortLandscape: 'v28/environment/blackout-interior-short-landscape.webp',
	});
	assert.equal(manifest.endFrame, 'v28/environment/base-desktop.webp');
	assert.deepEqual(manifest.transitionEndFrames, expectedEndFrames);
	for (const [layout, expected] of Object.entries(expectedPosters)) {
		const poster = manifest.fallbackPosters[layout];
		assert.deepEqual(poster, {
			path: expected.path,
			dimensions: { width: expected.width, height: expected.height },
			bytes: expected.bytes,
			sha256: expected.sha256,
		});
		const bytes = await readFile(runtimeFileUrl(expected.path));
		assert.equal(bytes.byteLength, expected.bytes, `${layout} V28 poster byte count`);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${layout} V28 poster hash`);
		const sourceRecord = v28Assets.get(expected.path);
		assert.ok(sourceRecord, `${expected.path} is present in the V28 authoring manifest`);
		assert.deepEqual(sourceRecord.runtimeGeometry, { width: expected.width, height: expected.height, channels: 3 });
		assert.equal(sourceRecord.runtimeBytes, expected.bytes);
		assert.equal(sourceRecord.sha256Runtime, expected.sha256);
	}
	for (const path of Object.values(expectedEndFrames)) {
		assert.equal(await exists(runtimeFileUrl(path)), true, `${path} exists`);
		assert.ok(v28Assets.has(path), `${path} is manifest-backed by V28`);
	}
});

test('historical V30 source closure contains only the manifest and no binary duplicate', async () => {
	const v30Files = await collectRelativeFiles(new URL('v30/', assetRoot));
	assert.deepEqual(v30Files, ['intro/blacksite-intro-manifest.json']);
	assert.equal(v30Files.some((path) => /\.(?:mp4|webm|webp|png|jpe?g)$/iu.test(path)), false);
});

test('historical Kling generation record preserves the requested prompt contract and truthful zero-credit state', async () => {
	const promptRecord = await readFile(promptRecordUrl, 'utf8');
	assert.match(promptRecord, /Status: \*\*NOT_GENERATED\*\*/u);
	assert.match(promptRecord, /connected Free account reported \*\*0\.0 available credits\*\*/u);
	assert.match(promptRecord, /Submitted candidates \| 0/u);
	assert.match(promptRecord, /Shot 1: exterior establishing shot of an isolated fortified blacksite during heavy night rain/u);
	assert.match(promptRecord, /Shot 2: seamless transition into a narrow underground security corridor/u);
	assert.match(promptRecord, /Shot 3: reveal a gigantic circular high-security vault door directly ahead/u);
	assert.match(promptRecord, /Shot 4: the vault door rotates open with immense weight/u);
	assert.match(promptRecord, /text, letters, subtitles, captions, logos, watermark, Stake branding/u);
	for (const setting of [
		'Modell: Kling VIDEO 3.0',
		'Modus: Professional',
		'Dauer: 10–12 Sekunden, maximal 15 Sekunden',
		'Seitenverhältnis: 16:9',
		'Framerate: 30 FPS',
		'Multi-Shot: aktiviert',
		'Native Audio: aktiviert, sofern zuverlässig',
		'Prompt Adherence: hoch',
		'Creativity: mittel',
		'Camera Motion: kontrolliert',
	]) {
		assert.equal(promptRecord.includes(setting), true, `requested setting retained: ${setting}`);
	}
	for (const shotWindow of ['0.0–2.5 s', '2.5–5.0 s', '5.0–8.5 s', '8.5–12.0 s']) {
		assert.equal(promptRecord.includes(shotWindow), true, `shot plan retains ${shotWindow}`);
	}
	for (const candidate of ['01', '02', '03']) {
		assert.match(
			promptRecord,
			new RegExp(`\\| ${candidate} \\| — \\| Not submitted \\| — \\| NOT_GENERATED \\| 0 credits \\|`, 'u'),
		);
	}
});

test('production pruner retires V30/V31 and admits only the exact V33 startup package', async () => {
	const prunerSource = await readFile(new URL('scripts/prune-production-assets.mjs', appRoot), 'utf8');
	const v33Allowlist = prunerSource.match(/\n\tv33: Object\.freeze\(\[([\s\S]*?)\n\t\]\),/u)?.[1] ?? '';
	assert.deepEqual(
		[...v33Allowlist.matchAll(/['"](v33\/intro\/[^'"]+)['"]/gu)].map((match) => match[1]),
		[
			'v33/intro/blacksite-breach-start-screen-v33.webp',
			'v33/intro/blacksite-startup-manifest-v33.json',
			'v33/intro/blacksite-vault-opening-v33.mp4',
		],
	);
	assert.match(prunerSource, /v26: Object\.freeze\(\[[\s\S]*vault-opening-blackout-v26-720p24\.mp4[\s\S]*vault-opening-blackout-v26-poster-720p\.webp/u);
	const deniedRoots = prunerSource.match(/const DENIED_PRODUCTION_ROOTS = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] ?? '';
	assert.match(deniedRoots, /['"]v24['"]/u);
	assert.match(deniedRoots, /['"]v30['"]/u);
	assert.match(deniedRoots, /['"]v31['"]/u);
	assert.doesNotMatch(deniedRoots, /['"]v26['"]/u);
	assert.doesNotMatch(deniedRoots, /['"]v33['"]/u);
});
