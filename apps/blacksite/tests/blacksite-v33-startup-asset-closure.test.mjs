import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { normalizeBlacksiteIntroManifest } from '../src/lib/assets/blacksite-intro-assets.js';

const assetRoot = new URL('../static/assets/blacksite/', import.meta.url);
const v33Root = new URL('v33/intro/', assetRoot);
const manifestUrl = new URL('blacksite-startup-manifest-v33.json', v33Root);
const videoUrl = new URL('blacksite-vault-opening-v33.mp4', v33Root);
const rulesScreenUrl = new URL('blacksite-breach-start-screen-v33.webp', v33Root);
const prunerUrl = new URL('../scripts/prune-production-assets.mjs', import.meta.url);

const EXPECTED = Object.freeze({
	manifestPath: 'v33/intro/blacksite-startup-manifest-v33.json',
	videoPath: 'v33/intro/blacksite-vault-opening-v33.mp4',
	rulesScreenPath: 'v33/intro/blacksite-breach-start-screen-v33.webp',
	videoBytes: 2_621_261,
	videoSha256: '1e158d67ef3942cacca08a4e0b9b42983e8ace101079e2c4d3b9ec6cf6efce51',
	videoWidth: 1_280,
	videoHeight: 720,
	videoDurationSeconds: 10.006,
	rulesScreenBytes: 391_062,
	rulesScreenSha256: '6edd0ff2d0ab0b1a8ea1b2e1852a5f65c4159d99cf03e577dc0a4d6d81fc0503',
	rulesScreenWidth: 1_672,
	rulesScreenHeight: 941,
	completeBuildHardMaxBytes: 64 * 1024 * 1024,
});

function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

function inspectWebpGeometry(bytes) {
	assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
	assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const chunkId = bytes.subarray(offset, offset + 4).toString('ascii');
		const chunkSize = bytes.readUInt32LE(offset + 4);
		const payloadOffset = offset + 8;
		if (chunkId === 'VP8X') {
			return {
				width: 1 + bytes.readUIntLE(payloadOffset + 4, 3),
				height: 1 + bytes.readUIntLE(payloadOffset + 7, 3),
			};
		}
		if (
			chunkId === 'VP8 '
			&& bytes.subarray(payloadOffset + 3, payloadOffset + 6)
				.equals(Buffer.from([0x9d, 0x01, 0x2a]))
		) {
			return {
				width: bytes.readUInt16LE(payloadOffset + 6) & 0x3fff,
				height: bytes.readUInt16LE(payloadOffset + 8) & 0x3fff,
			};
		}
		offset = payloadOffset + chunkSize + (chunkSize & 1);
	}
	return { width: 0, height: 0 };
}

function mp4Boxes(bytes, start = 0, end = bytes.length) {
	const boxes = [];
	let offset = start;
	while (offset + 8 <= end) {
		let size = bytes.readUInt32BE(offset);
		const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
		let headerBytes = 8;
		if (size === 1) {
			assert.ok(offset + 16 <= end, `${type} extended header fits its parent`);
			const extendedSize = bytes.readBigUInt64BE(offset + 8);
			assert.ok(extendedSize <= BigInt(Number.MAX_SAFE_INTEGER), `${type} size is safely representable`);
			size = Number(extendedSize);
			headerBytes = 16;
		} else if (size === 0) {
			size = end - offset;
		}
		assert.ok(size >= headerBytes && offset + size <= end, `${type} box is bounded by its parent`);
		boxes.push({
			type,
			start: offset,
			end: offset + size,
			payloadStart: offset + headerBytes,
		});
		offset += size;
	}
	return boxes;
}

function requiredBox(boxes, type, label) {
	const box = boxes.find((candidate) => candidate.type === type);
	assert.ok(box, `${label} contains ${type}`);
	return box;
}

function inspectMp4Metadata(bytes) {
	const topLevel = mp4Boxes(bytes);
	const ftyp = requiredBox(topLevel, 'ftyp', 'MP4');
	const moov = requiredBox(topLevel, 'moov', 'MP4');
	const moovChildren = mp4Boxes(bytes, moov.payloadStart, moov.end);
	const mvhd = requiredBox(moovChildren, 'mvhd', 'moov');
	const mvhdVersion = bytes[mvhd.payloadStart];
	assert.ok(mvhdVersion === 0 || mvhdVersion === 1, 'mvhd uses a supported version');
	const timescaleOffset = mvhd.payloadStart + (mvhdVersion === 1 ? 20 : 12);
	const durationOffset = mvhd.payloadStart + (mvhdVersion === 1 ? 24 : 16);
	const timescale = bytes.readUInt32BE(timescaleOffset);
	const durationUnits = mvhdVersion === 1
		? Number(bytes.readBigUInt64BE(durationOffset))
		: bytes.readUInt32BE(durationOffset);

	let videoGeometry = null;
	for (const trak of moovChildren.filter(({ type }) => type === 'trak')) {
		const trakChildren = mp4Boxes(bytes, trak.payloadStart, trak.end);
		const mdia = trakChildren.find(({ type }) => type === 'mdia');
		if (!mdia) continue;
		const mdiaChildren = mp4Boxes(bytes, mdia.payloadStart, mdia.end);
		const hdlr = mdiaChildren.find(({ type }) => type === 'hdlr');
		if (!hdlr || bytes.subarray(hdlr.payloadStart + 8, hdlr.payloadStart + 12).toString('ascii') !== 'vide') {
			continue;
		}
		const tkhd = requiredBox(trakChildren, 'tkhd', 'video trak');
		videoGeometry = {
			width: bytes.readUInt32BE(tkhd.end - 8) / 65_536,
			height: bytes.readUInt32BE(tkhd.end - 4) / 65_536,
		};
		break;
	}
	assert.ok(videoGeometry, 'MP4 contains a video track');
	return {
		...videoGeometry,
		durationSeconds: durationUnits / timescale,
	};
}

test('V33 manifest fixes the local video -> rules image -> slot startup contract', async () => {
	const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
	assert.equal(manifest.schema, 'blacksite-intro-manifest/v2');
	assert.equal(manifest.version, 33);
	assert.equal(manifest.videoAvailable, true);
	assert.equal(manifest.durationSeconds, EXPECTED.videoDurationSeconds);
	assert.equal(manifest.rulesScreen, EXPECTED.rulesScreenPath);
	assert.equal(manifest.endFrame, EXPECTED.rulesScreenPath);
	assert.equal(manifest.video.desktop.mp4, EXPECTED.videoPath);
	assert.equal(manifest.video.mobile.mp4, EXPECTED.videoPath);
	assert.equal(manifest.video.desktop.webm, null);
	assert.equal(manifest.video.mobile.webm, null);
	assert.deepEqual(manifest.runtimePolicy, {
		sequence: 'preload -> video -> rules-screen -> slot',
		normalLaunch: 'mandatory-every-start',
		skip: 'skip-video-only-rules-screen-remains-mandatory',
		reducedMotion: 'skip-video-show-rules-screen',
		replayAndRestore: 'skip-video-show-rules-screen-without-wallet-mutation',
		autoplay: 'muted-playsinline',
		embeddedVideoAudio: false,
		failureFallback: 'poster-then-rules-screen',
		remoteRuntimeDependencies: false,
	});
	assert.doesNotMatch(JSON.stringify(manifest), /https?:\/\//iu);

	const normalized = normalizeBlacksiteIntroManifest(manifest);
	assert.equal(normalized.videoAvailable, true);
	assert.equal(normalized.durationSeconds, EXPECTED.videoDurationSeconds);
	assert.equal(normalized.rulesScreen, `assets/blacksite/${EXPECTED.rulesScreenPath}`);
	assert.equal(normalized.endFrame, `assets/blacksite/${EXPECTED.rulesScreenPath}`);
	assert.equal(normalized.video.desktop.mp4, `assets/blacksite/${EXPECTED.videoPath}`);
	assert.equal(normalized.video.mobile.mp4, `assets/blacksite/${EXPECTED.videoPath}`);
});

test('V33 startup MP4 is the exact supplied, browser-compatible H.264 asset', async () => {
	const [videoBytes, manifest, videoStat] = await Promise.all([
		readFile(videoUrl),
		readFile(manifestUrl, 'utf8').then(JSON.parse),
		stat(videoUrl),
	]);
	const metadata = inspectMp4Metadata(videoBytes);
	assert.equal(videoBytes.subarray(4, 8).toString('ascii'), 'ftyp');
	assert.equal(videoBytes.includes(Buffer.from('avc1')), true, 'startup video declares H.264/AVC');
	assert.equal(videoBytes.includes(Buffer.from('mp4a')), true, 'supplied audio track remains byte-preserved');
	assert.equal(videoStat.size, EXPECTED.videoBytes);
	assert.equal(videoBytes.byteLength, EXPECTED.videoBytes);
	assert.equal(sha256(videoBytes), EXPECTED.videoSha256);
	assert.deepEqual(metadata, {
		width: EXPECTED.videoWidth,
		height: EXPECTED.videoHeight,
		durationSeconds: EXPECTED.videoDurationSeconds,
	});

	const record = manifest.assetRecords.find(({ id }) => id === 'intro.video.shared.mp4.v33');
	assert.ok(record, 'manifest contains the startup video record');
	assert.deepEqual(
		{
			path: record.path,
			container: record.container,
			width: record.dimensions?.width,
			height: record.dimensions?.height,
			durationSeconds: record.durationSeconds,
			bytes: record.bytes,
			sha256: record.sha256,
		},
		{
			path: `assets/blacksite/${EXPECTED.videoPath}`,
			container: 'mp4',
			width: metadata.width,
			height: metadata.height,
			durationSeconds: metadata.durationSeconds,
			bytes: EXPECTED.videoBytes,
			sha256: EXPECTED.videoSha256,
		},
	);
});

test('V33 rules screen is the exact optimized 1672x941 local WebP', async () => {
	const [rulesBytes, manifest, rulesStat] = await Promise.all([
		readFile(rulesScreenUrl),
		readFile(manifestUrl, 'utf8').then(JSON.parse),
		stat(rulesScreenUrl),
	]);
	assert.deepEqual(inspectWebpGeometry(rulesBytes), {
		width: EXPECTED.rulesScreenWidth,
		height: EXPECTED.rulesScreenHeight,
	});
	assert.equal(rulesStat.size, EXPECTED.rulesScreenBytes);
	assert.equal(rulesBytes.byteLength, EXPECTED.rulesScreenBytes);
	assert.equal(sha256(rulesBytes), EXPECTED.rulesScreenSha256);

	const record = manifest.assetRecords.find(({ id }) => id === 'intro.rules-screen.v33');
	assert.ok(record, 'manifest contains the mandatory rules-screen record');
	assert.deepEqual(
		{
			path: record.path,
			format: record.format,
			dimensions: record.dimensions,
			bytes: record.bytes,
			sha256: record.sha256,
		},
		{
			path: `assets/blacksite/${EXPECTED.rulesScreenPath}`,
			format: 'webp',
			dimensions: {
				width: EXPECTED.rulesScreenWidth,
				height: EXPECTED.rulesScreenHeight,
			},
			bytes: EXPECTED.rulesScreenBytes,
			sha256: EXPECTED.rulesScreenSha256,
		},
	);
});

test('V33 startup closure is exact, pruner-owned and within its declared runtime budget', async () => {
	const [files, manifest, prunerSource] = await Promise.all([
		readdir(v33Root),
		readFile(manifestUrl, 'utf8').then(JSON.parse),
		readFile(prunerUrl, 'utf8'),
	]);
	assert.deepEqual(files.sort((left, right) => left.localeCompare(right, 'en')), [
		'blacksite-breach-start-screen-v33.webp',
		'blacksite-startup-manifest-v33.json',
		'blacksite-vault-opening-v33.mp4',
	]);
	assert.deepEqual(manifest.budget, {
		completeBuildHardMaxBytes: EXPECTED.completeBuildHardMaxBytes,
		videoBytes: EXPECTED.videoBytes,
		rulesScreenBytes: EXPECTED.rulesScreenBytes,
		combinedV33RuntimeBytes: EXPECTED.videoBytes + EXPECTED.rulesScreenBytes,
		pass: true,
	});
	assert.ok(
		manifest.budget.combinedV33RuntimeBytes < 4 * 1024 * 1024,
		'V33 startup delivery stays below its four-MiB runtime allocation',
	);

	const v33Allowlist = prunerSource.match(/\n\tv33: Object\.freeze\(\[([\s\S]*?)\n\t\]\),/u)?.[1] ?? '';
	for (const path of [EXPECTED.manifestPath, EXPECTED.videoPath, EXPECTED.rulesScreenPath]) {
		assert.equal((v33Allowlist.match(new RegExp(path.replaceAll('.', '\\.').replaceAll('/', '\\/'), 'gu')) ?? []).length, 1);
	}
	assert.match(
		prunerSource,
		/productionFiles\.filter\(\(path\) => path\.endsWith\('\.mp4'\)\)[\s\S]*vault-opening-blackout-v26-720p24\.mp4[\s\S]*blacksite-vault-opening-v33\.mp4/u,
	);
});
